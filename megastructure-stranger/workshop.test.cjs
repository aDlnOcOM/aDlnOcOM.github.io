const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(full=false){
  let stored='{}';const elements=new Map();
  const node=()=>({dataset:{},style:{},width:960,height:600,hidden:false,getContext:()=>({}),addEventListener(){},appendChild(){},replaceChildren(){}});
  const scope=vm.createContext({window:{addEventListener(){},requestAnimationFrame(){}},document:{getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);},createElement:node},performance:{now:()=>0},localStorage:{getItem:()=>stored,setItem(_,value){stored=value;}}});
  for(const file of ['resources.js','arsenal.js','workshop.js','power-inventory.js','damage-types.js','security-ai.js','equipment.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),scope);
  scope.window.Resources.render=()=>{};scope.window.PowerInventory.render=()=>{};
  if(full)vm.runInContext(fs.readFileSync(`${__dirname}/script.js`,'utf8').replace(/\}\)\(\);\s*$/,'window.game = {state, get:()=>progression, playerStats, createPowerStock, fireSmg, knifeAttack, createEquipmentProgress, installCraftedModule, finishRun}; })();'),scope);
  const p={salvage:0,resources:{},equipment:{},hideout:{}};scope.window.Workshop.init(p);
  return {...scope.window,p,saved:()=>JSON.parse(stored)};
}
function rich(p,W,R){p.salvage=99999;p.resources=Object.fromEntries(R.catalog.filter(r=>r.id!=='salvage').map(r=>[r.id,99999]));p.hideout={mill:5,forming:5,solder:5,generator:5,battery:5};p.workshop.table=1;p.workshop.research=Object.fromEntries(R.catalog.map(r=>[r.id,true]));}
test('catalog contains requested counts, four plate materials and six protection classes',()=>{
  const {Arsenal:A,Workshop:W,Resources:R}=load();
  assert.equal(A.items.filter(d=>d.kind==='ranged').length,100);
  assert.equal(A.items.filter(d=>d.kind==='melee').length,15);
  for(const slot of ['chest','helmet','pants','boots'])assert.equal(A.items.filter(d=>d.slot===slot).length,20);
  assert.equal(A.items.filter(d=>d.kind==='bag').length,10);
  assert.equal(A.items.filter(d=>d.carrier).length,8);
  assert.equal(A.items.filter(d=>d.kind==='plate').length,24);
  assert.equal(Object.keys(W.intermediate).length,16);
  assert.equal(new Set(A.items.map(d=>d.id)).size,A.items.length);
  for(const d of A.items)for(const id of Object.keys(d.costs))assert.ok(R.catalog.some(r=>r.id===id));
  assert.equal(new Set(A.items.filter(d=>d.kind==='ranged').map(d=>[d.damage,d.magazine,d.delay,d.velocity].join(':'))).size,100);
});
test('starter resources build the table once and reload never grants them again',()=>{
  const {p,Workshop:W}=load();assert.equal(p.workshop.table,0);assert.equal(p.resources.wood,12);
  assert.equal(W.build(p),'');const after=JSON.stringify(p);W.init(p);assert.equal(p.resources.wood,4);
  assert.ok(W.build(p));assert.equal(p.workshop.table,1);
  const reload=JSON.parse(after);W.init(reload);assert.equal(reload.resources.wood,4);assert.equal(reload.workshop.items.length,7);
});
test('research consumes samples once and finishes after persisted deadline',()=>{
  const {p,Workshop:W}=load();W.build(p);p.resources.metal=10;
  assert.equal(W.research(p,'metal',1000),'');assert.equal(p.resources.metal,5);
  assert.ok(W.research(p,'metal',1001));assert.equal(p.resources.metal,5);
  assert.equal(W.settle(p,45999),false);const reload=JSON.parse(JSON.stringify(p));W.init(reload);
  assert.equal(W.settle(reload,46000),true);assert.equal(reload.workshop.research.metal,true);assert.equal(reload.workshop.job,null);
});
test('crafting requires research and station tier; carriers remain loot-only',()=>{
  const {p,Workshop:W,Resources:R}=load();assert.ok(W.craft(p,'smg-0'));
  rich(p,W,R);delete p.workshop.research.steel;assert.match(W.craft(p,'smg-0'),/Исследуйте/);
  p.workshop.research.steel=true;p.hideout.solder=1;assert.match(W.craft(p,'smg-9',4),/уровня 5/);
  assert.match(W.craft(p,'chest-12'),/найти/);
  p.hideout.solder=5;const before=p.workshop.items.length;assert.equal(W.craft(p,'smg-9',4),'');assert.equal(p.workshop.items.length,before+1);assert.equal(p.workshop.items.at(-1).quality,4);
  const metal=p.resources.metal;assert.equal(W.craft(p,'fastener'),'');assert.equal(p.resources.metal,metal-2);
});
test('all craftable definitions are reachable with research and suitable stations',()=>{
  const {p,Workshop:W,Arsenal:A,Resources:R}=load();rich(p,W,R);
  for(const def of A.items.filter(d=>!d.lootOnly))assert.equal(W.craft(p,def.id,4),'',def.id);
  for(const id of Object.keys(W.intermediate))assert.equal(W.craft(p,id),'',id);
});
test('armor plates require found carriers, enforce class and cannot be mounted twice',()=>{
  const {p,Workshop:W,Resources:R}=load();rich(p,W,R);W.craft(p,'plate-steel-3');const plate=p.workshop.items.at(-1);
  assert.match(W.mount(p,plate.uid),/найдите/);
  W.receive(p,[{defId:'chest-12',quality:2,condition:100}]);const carrier=p.workshop.items.at(-1);W.equip(p,carrier.uid);
  W.craft(p,'plate-steel-6');assert.match(W.mount(p,p.workshop.items.at(-1).uid),/допуска/);
  assert.equal(W.mount(p,plate.uid),'');assert.ok(W.mount(p,plate.uid));
  const before=plate.condition;assert.ok(W.plateAbsorb(p,20,'ballistic')>0);assert.ok(plate.condition<before);
  W.unmount(p,plate.uid);assert.equal(carrier.plates.length,0);
});
test('wear, aging, quality and repair affect persistent gear without granting free repair',()=>{
  const {p,Workshop:W,Resources:R}=load();rich(p,W,R);const gun=W.equipped(p,'smg');W.wear(p,'smg',30);assert.ok(gun.condition<100);
  W.age(p);assert.equal(gun.age,1);assert.ok(gun.ceiling<100);
  const old=gun.ceiling,metal=p.resources.metal;assert.equal(W.repair(p,gun.uid),'');assert.ok(gun.ceiling<old);assert.equal(gun.condition,gun.ceiling);assert.ok(p.resources.metal<metal);
  const reloaded=JSON.parse(JSON.stringify(p));W.init(reloaded);assert.equal(W.equipped(reloaded,'smg').condition,gun.condition);
});
test('weapon upgrades stay with the individual weapon when switching',()=>{
  const {p,Workshop:W,Resources:R}=load();rich(p,W,R);p.equipment.smg={optic:{choice:'reflex',tier:false}};
  const first=W.equipped(p,'smg');W.craft(p,'pistol-0');const second=p.workshop.items.at(-1);W.equip(p,second.uid);
  assert.equal(p.equipment.smg.optic,undefined);W.equip(p,first.uid);assert.equal(p.equipment.smg.optic.choice,'reflex');
});
test('ammo keys reject another caliber even within the ballistic family',()=>{
  const {PowerInventory:P}=load();const stock=P.create(12,false,'ballistic');stock.ammoKey='pistol:ballistic';stock.magazines.forEach(m=>m.ammoKey='rifle:ballistic');
  assert.equal(P.fire(stock),false);assert.equal(P.startRefill(stock,0),false);
  stock.magazines[0].ammoKey=stock.ammoKey;assert.equal(P.fire(stock),true);
});
test('equipped shotgun and melee parameters are used by the actual game',()=>{
  const {game:g,Workshop:W,Resources:R}=load(true);const p=g.get();rich(p,W,R);W.craft(p,'shotgun-0',2);W.equip(p,p.workshop.items.at(-1).uid);p.equipment=g.createEquipmentProgress(p.equipment);
  const stats=g.playerStats();assert.equal(stats.pellets,7);assert.equal(stats.magazine,6);
  g.state.active=true;g.state.runActive=true;g.state.cameraX=0;g.state.player={x:100,y:300,ammo:6,reload:0,knifeCooldown:0};g.state.powerInventory=g.createPowerStock();g.fireSmg();
  assert.equal(g.state.bullets.length,7);assert.equal(g.state.player.ammo,5);assert.equal(g.state.player.fireCooldown,.9);
  W.craft(p,'melee-6',2);W.equip(p,p.workshop.items.at(-1).uid);p.equipment=g.createEquipmentProgress(p.equipment);
  assert.equal(g.playerStats().meleeRange,145);g.knifeAttack();assert.equal(g.state.player.knifeFlash,.25);
});
test('actual upgrade installation requires a crafted part and consumes it exactly once',()=>{
  const {game:g,Workshop:W,Resources:R}=load(true);const p=g.get();rich(p,W,R);
  const branch={id:'optic'},option={id:'reflex',cost:30,tier:{cost:60}};
  g.installCraftedModule('smg',branch,option,false);assert.equal(g.get().equipment.smg.optic.choice,null);
  const id=W.partKey('smg','optic','reflex',false);assert.equal(W.craft(p,id),'');
  const before=p.salvage;g.installCraftedModule('smg',branch,option,false);
  assert.equal(g.get().equipment.smg.optic.choice,'reflex');assert.equal(g.get().salvage,before-30);assert.equal(W.partAvailable(g.get(),id),false);
  g.installCraftedModule('smg',branch,option,false);assert.equal(g.get().salvage,before-30);
  assert.ok(g.playerStats().spread<.035,'optic must reduce actual weapon spread');
});
test('all fifteen melee weapons generate distinct animation traces',()=>{
  const {Arsenal:A}=load();const signatures=new Set();
  for(const def of A.items.filter(item=>item.kind==='melee')){
    const trace=[];const ctx=new Proxy({}, {get:(_,key)=>(...args)=>trace.push([key,...args]),set:(_,key,value)=>{trace.push([key,value]);return true;}});
    A.drawMelee(ctx,{x:100,y:100,knifeFlash:.1},0,def);signatures.add(JSON.stringify(trace));
  }assert.equal(signatures.size,15);
});
test('quality changes combat output and a broken weapon cannot fire',()=>{
  const {game:g,Workshop:W}=load(true);const item=W.equipped(g.get(),'smg');item.quality=0;const low=g.playerStats().damage;item.quality=4;assert.ok(g.playerStats().damage>low);
  item.condition=0;g.state.active=true;g.state.player={x:100,y:300,ammo:32,reload:0};g.state.powerInventory=g.createPowerStock();g.fireSmg();assert.equal(g.state.bullets.length,0);assert.equal(g.state.powerInventory.magazines[0].energy,32);
});
test('research dependencies block payment until all prerequisites and table levels are met',()=>{
  const {p,Workshop:W,Resources:R}=load();rich(p,W,R);p.workshop.research={};p.workshop.table=1;
  const before=p.resources.steel;assert.match(W.research(p,'steel',0),/уровня 2/);assert.equal(p.resources.steel,before);
  p.workshop.table=2;assert.match(W.research(p,'steel',0),/Металл/);assert.equal(p.resources.steel,before);
  p.workshop.research.metal=true;assert.equal(W.research(p,'steel',0),'');assert.equal(p.resources.steel,before-5);
});
test('table upgrades are sequential, gated, persistent and never retime active jobs',()=>{
  const {p,Workshop:W,Resources:R}=load();rich(p,W,R);p.workshop.table=1;
  p.workshop.research={};assert.ok(W.upgradeTable(p));p.workshop.research.metal=true;p.workshop.research.conductor=true;
  const steel=p.resources.steel;assert.equal(W.upgradeTable(p),'');assert.equal(p.workshop.table,2);assert.equal(p.resources.steel,steel-4);
  const seconds=W.researchQuote(p,'wood').seconds;assert.ok(seconds<45);
  W.research(p,'wood',100);const end=p.workshop.job.ends;assert.ok(W.upgradeTable(p));assert.equal(p.workshop.job.ends,end);
  W.settle(p,end);p.workshop.research=Object.fromEntries(R.catalog.map(r=>[r.id,true]));
  for(let level=3;level<=5;level++){assert.equal(W.upgradeTable(p),'');assert.equal(p.workshop.table,level);}
  assert.ok(W.upgradeTable(p));W.init(p);assert.equal(p.workshop.table,5);
});
test('research graph is acyclic and every table tier can be reached without a dependency deadlock',()=>{
  const {p,Workshop:W,Resources:R}=load();rich(p,W,R);p.workshop.research={};p.workshop.table=1;
  let now=0;
  for(let level=1;level<=5;level++){
    let advanced=true;
    while(advanced){advanced=false;for(const resource of R.catalog){
      if(p.workshop.research[resource.id]||W.researchQuote(p,resource.id).reason)continue;
      assert.equal(W.research(p,resource.id,now),'');now=p.workshop.job.ends;W.settle(p,now);advanced=true;
    }}
    if(level<5)assert.equal(W.upgradeTable(p),'',`tier ${level+1} deadlock`);
  }
  assert.equal(Object.keys(p.workshop.research).length,R.catalog.length);
});
