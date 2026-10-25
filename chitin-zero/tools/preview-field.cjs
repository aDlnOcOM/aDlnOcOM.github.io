// Execute only the vector renderer in native Canvas, not an HTML/browser page.
const fs=require('node:fs');
const {createCanvas,GlobalFonts}=require(process.argv[2]);
const {Game}=require('../field-core.js'),{Renderer}=require('../field-render.js'),N=require('../td-number.js');
if(fs.existsSync('C:/Windows/Fonts/consola.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/consola.ttf','monospace');
const width=Number(process.argv[4])||1400,height=Number(process.argv[5])||896,canvas=createCanvas(width,height);
canvas.getBoundingClientRect=()=>({left:0,top:0,width,height});
const g=new Game();g.credits=N.from(1e6);
for(const [slot,type]of [['-1,0','rail'],['0,1','arc'],['0,-1','plasma'],['1,-1','generator'],['-1,1','regen'],['-1,-1','nano'],['2,0','pylon'],['4,0','pylon'],['5,0','generator'],['4,1','frost']])g.build(slot,type);
for(let i=-3;i<=3;i++)for(const [q,r]of [[i,-3],[i,3],[-3,i],[3,i]])if(!g.tower(`${q},${r}`)&&!(q===3&&r===0))g.build(`${q},${r}`,'wall');
g.build('6,2','plasma'); // An intentionally disconnected building to inspect the crossed-out state.
g.start();g.phase='wave';g.wave=8;g.time=23;g.total=24;
for(let i=0;i<24;i++){const e=g.spawn(),a=i*Math.PI/12+.12,radius=235+(i%3)*35;e.x=Math.cos(a)*radius;e.y=Math.sin(a)*radius;e.angle=a+Math.PI;e.progress=-radius;}
g.hurt(g.tower('3,1'),180);g.hurt(g.tower('-3,-1'),220);g.hurt(g.tower('1,0'),45);
for(const t of g.allTowers())g.attack(t);g.repairStructures(.1);g.enemies=g.enemies.filter(e=>!e.dead);g.selected='2,0';
const renderer=new Renderer(canvas);renderer.draw(g);fs.writeFileSync(process.argv[3],canvas.toBuffer('image/png'));
