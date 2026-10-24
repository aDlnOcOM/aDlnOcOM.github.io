// Offline geometry/sprite inspection, NOT a browser or WebGL execution test.
// Uses an already-installed canvas runtime; no dependencies are downloaded.
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require(process.argv[2]);
const D = require('../hunt-data.js');
const C = require('../hunt-core.js');
const R = require('../hunt-render.js');
const width = Number(process.argv[4]) || 1440, height = Number(process.argv[5]) || 900;
const count = Number(process.argv[6]) || 6;
const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
for (const [file,name] of [['georgia.ttf','Georgia'],['arial.ttf','sans-serif']]) {
  const filePath = `C:/Windows/Fonts/${file}`;
  if (fs.existsSync(filePath)) GlobalFonts.registerFromPath(filePath,name);
}
const game = new C.Game({ seed: 1897 }); game.time = 150; game.player.z = 68; game.player.pitch = -.03;
game.player.weapons = Object.keys(D.weapons).slice(0,count).map((id,i)=>({id,level:2,flash:i===0?.14:0}));
for (const [type,x,z] of [['skeleton',54,58],['ghoul',58,60],['vampire',53,62],['cultist',60,52],['brute',50,54],['boss',55,43],['bat',59,57]]) game.spawn(type,x,z);
for (let i=0;i<10;i++) game.drops.push({x:52+i*.7,z:59+(i%3),value:3});
game.chests.push({x:59,z:60});
const camera = R.matrix(game.player,width/height,true), triangles = [];
function project(p) { const a=camera.matrix; return [0,1,2,3].map(r=>a[r]*p[0]+a[4+r]*p[1]+a[8+r]*p[2]+a[12+r]); }
function clip(points) {
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=a[2]+a[3],db=b[2]+b[3];
    if(da>=0)result.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);result.push(a.map((v,j)=>v+(b[j]-v)*t));}
  }
  return result;
}
function append(mesh) {
  const data=mesh.data;
  for(let i=0;i<data.length;i+=27){
    const world=[data.slice(i,i+3),data.slice(i+9,i+12),data.slice(i+18,i+21)], p=clip(world.map(project));
    if(p.length<3)continue;
    const points=p.map(v=>[(v[0]/v[3]+1)*width/2,(1-v[1]/v[3])*height/2]);
    if(points.every(p=>p[0]<0)||points.every(p=>p[0]>width)||points.every(p=>p[1]<0)||points.every(p=>p[1]>height))continue;
    const n=data.slice(i+3,i+6), light=.43+.46*Math.max(0,(-.4*n[0]+.85*n[1]+.3*n[2])/Math.hypot(.4,.85,.3))+.12*Math.max(0,.8*n[0]+.2*n[1]-.4*n[2]);
    const center=world[0].map((_,j)=>(world[0][j]+world[1][j]+world[2][j])/3),dist=Math.hypot(...center.map((v,j)=>v-camera.eye[j]));
    const t=C.clamp((dist-16)/68,0,1),fog=t*t*(3-2*t)*.87;
    const color=data.slice(i+6,i+9).map((c,j)=>Math.round(C.clamp(c*light*(1-fog)+D.arenas.cemetery.sky[j]*fog,0,1)*255));
    triangles.push({points,color,depth:p.reduce((s,v)=>s+v[3],0)/p.length});
  }
}
async function main(){
  const sprites=new R.Sprites();sprites.images=await Promise.all(['a','b'].map(id=>loadImage(path.join(__dirname,`../assets/hunt/weapons-${id}.png`))));sprites.ready=true;
  ctx.fillStyle='#38241f';ctx.fillRect(0,0,width,height);append(R.arenaMesh(game.map));append(R.dynamicMesh(game,true));
  triangles.sort((a,b)=>b.depth-a.depth);
  for(const t of triangles){ctx.beginPath();ctx.moveTo(...t.points[0]);for(const p of t.points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=`rgb(${t.color.join(',')})`;ctx.fill();}
  const overlay=createCanvas(width,height),overlayCtx=overlay.getContext('2d');
  R.Renderer.prototype.drawOverlay.call({ctx:overlayCtx,width,height,dpr:1,reduced:true,sprites},game);ctx.drawImage(overlay,0,0);
  ctx.fillStyle='#100e13b8';ctx.fillRect(0,0,width,88);ctx.fillRect(0,height-90,width,90);
  ctx.fillStyle='#e9d7b5';ctx.font='16px Georgia';ctx.fillText('КЛАДБИЩЕ МЕХАНИЗМОВ',28,32);ctx.font='11px sans-serif';ctx.fillText('БЕСКОНЕЧНАЯ ОХОТА',28,55);
  ctx.textAlign='center';ctx.font='32px Georgia';ctx.fillText('02:30',width/2,43);ctx.textAlign='right';ctx.font='24px Georgia';ctx.fillText('127',width-28,32);ctx.font='10px sans-serif';ctx.fillText('УНИЧТОЖЕНО',width-28,55);
  ctx.textAlign='left';ctx.font='26px Georgia';ctx.fillText('110 / 110',28,height-40);ctx.fillStyle='#ad4353';ctx.fillRect(28,height-27,190,6);ctx.textAlign='right';ctx.fillStyle='#d1b583';ctx.font='14px sans-serif';ctx.fillText(`АРСЕНАЛ ${count} / 14`,width-28,height-40);
  fs.writeFileSync(process.argv[3],canvas.toBuffer('image/png'));
}
main().catch(error=>{process.stderr.write(`${error.stack}\n`);process.exitCode=1;});
