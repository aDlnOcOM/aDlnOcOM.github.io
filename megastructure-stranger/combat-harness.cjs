const fs=require('node:fs'),vm=require('node:vm');
module.exports=function game(){
 const elements=new Map(),events={};
 const node=()=>({dataset:{},style:{},classList:{add(){},remove(){}},children:[],width:960,height:600,getContext:()=>({}),addEventListener(){},appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];}});
 const s=vm.createContext({window:{addEventListener(k,f){(events[k]||=[]).push(f);},requestAnimationFrame(){}},document:{getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);},createElement:node},performance:{now:()=>0},localStorage:{getItem:()=>null,setItem(){}}});
 for(const f of ['resources','arsenal','workshop','armor-system','enemy-armor','combat-model','field-medicine','ammunition','projectile-physics','equipment','power-inventory','damage-types','security-ai','perception','weapon-handling'])vm.runInContext(fs.readFileSync(`${__dirname}/${f}.js`,'utf8'),s);
 s.window.Resources.render=()=>{};s.window.PowerInventory.render=()=>{};
 const exports='state,playerStats,createPowerStock,resetPlayer,fireSmg,reloadSmg,updatePlayer,damagePlayer,damageEnemy,updateBullets,updateEnemies,update,createEnemyBullet,knifeAttack,get:()=>progression';
 vm.runInContext(fs.readFileSync(`${__dirname}/script.js`,'utf8').replace(/\}\)\(\);\s*$/,`window.game={${exports}};})();`),s);
 const g=s.window.game;g.state.powerInventory=g.createPowerStock();g.resetPlayer();g.state.active=true;g.state.runActive=true;g.state.cameraX=0;g.state.medicine=s.window.FieldMedicine.stock();
 g.state.floorMap={width:4000,walls:[],containers:[],sectors:[],sectorCount:0,sectorWidth:960,entryGate:{x:3000,y:0,width:20,height:600},exitGate:{x:3900,y:0,width:20,height:600}};g.state.sensors=[];
 return {...s.window,g,elements,events};
};
