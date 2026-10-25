// Render the real game Canvas only; this is not a browser or an HTML screenshot.
const fs=require('node:fs');
const {createCanvas,GlobalFonts}=require(process.argv[2]);
const {Game}=require('../tower-core.js'),{Renderer}=require('../tower-render.js'),N=require('../tower-number.js');
if(fs.existsSync('C:/Windows/Fonts/consola.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/consola.ttf','monospace');
const width=Number(process.argv[4])||900,height=Number(process.argv[5])||900,canvas=createCanvas(width,height);
canvas.getBoundingClientRect=()=>({left:0,top:0,width,height});
const g=new Game();g.newRun('signal',0,42);g.run.round=6;g.run.jokers=['spark','echo','chain','shell','blast'];g.launch();g.run.time=18;
for(let i=0;i<24;i++){g.spawn();const e=g.run.enemies.at(-1),angle=i*Math.PI/12+.2,radius=100+(i%5)*41;e.x=Math.cos(angle)*radius;e.y=Math.sin(angle)*radius;e.hp=e.maxHp=N.of(200);}
g.fire();g.run.hp=g.run.maxHp.mul(.73);
new Renderer(canvas).draw(g);fs.writeFileSync(process.argv[3],canvas.toBuffer('image/png'));
