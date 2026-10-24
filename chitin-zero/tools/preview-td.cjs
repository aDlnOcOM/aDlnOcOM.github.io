// Native inspection of the actual vector renderer. Does not open/load a web page.
const fs=require('node:fs');
const {createCanvas,GlobalFonts}=require(process.argv[2]);
const {Game}=require('../td-core.js');
const N=require('../td-number.js');
const {Renderer}=require('../td-render.js');
if(fs.existsSync('C:/Windows/Fonts/consola.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/consola.ttf','monospace');
const width=Number(process.argv[4])||1400,height=Number(process.argv[5])||896;
const canvas=createCanvas(width,height);canvas.getBoundingClientRect=()=>({left:0,top:0,width,height});
const g=new Game();g.credits=N.from(1e8);g.start();
for(let slot=1;slot<12;slot++)g.build(slot,require('../td-data.js').autoPlan[slot]);
for(let slot=0;slot<12;slot++)g.upgrade(slot,9+slot%4);g.evolve(1,'cascade');g.evolve(3,'nova');
g.auto={build:false,upgrade:false,evolve:false};g.wave=18;g.best=17;
for(let i=0;i<220;i++)g.step(.1);
// A representative active wave with different silhouettes and firing effects.
g.enemies=[];g.spawned=0;g.total=30;
for(let i=0;i<25;i++){const e=g.spawn();e.progress=35+i*65;Object.assign(e,require('../td-core.js').pointAt(e.progress));if(i%5===0){e.slowTime=2;e.slowFactor=.55;}}
for(const t of g.towers){t.cooldown=0;g.attack(t);}g.enemies=g.enemies.filter(e=>!e.dead);
const renderer=new Renderer(canvas);renderer.selected=3;renderer.draw(g);
fs.writeFileSync(process.argv[3],canvas.toBuffer('image/png'));
