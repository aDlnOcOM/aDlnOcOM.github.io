const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(`${__dirname}/${f}`,'utf8');
function load(){const s=vm.createContext({window:{}});for(const f of ['power-inventory.js','damage-types.js','wayfinding.js','world-art.js'])vm.runInContext(read(f),s);return s.window;}
test('selecting a partly filled magazine preserves every remaining round',()=>{
  const P=load().PowerInventory,s=P.create(32);s.magazines[1].energy=9;const total=()=>s.battery+s.magazines.reduce((a,m)=>a+m.energy,0),before=total();
  assert.equal(P.selectMagazine(s,1),true);assert.equal(P.canReload(s),true);assert.equal(P.prepareReload(s),true);
  assert.equal(P.selectMagazine(s,2),false);assert.equal(P.startRefill(s,1),false);
  assert.equal(P.reload(s),9);assert.equal(s.loaded,1);assert.equal(s.magazines[0].energy,32);assert.equal(total(),before);assert.equal(s.reloadTarget,undefined);
});
test('wrong platform, damage type and empty magazines cannot be selected',()=>{
  const P=load().PowerInventory,s=P.create(32);s.ammoKey='smg:energy';s.magazines.forEach(m=>m.ammoKey=s.ammoKey);
  s.magazines[1].ammoKey='arc:energy';assert.equal(P.selectMagazine(s,1),false);
  s.magazines[2].type='ballistic';assert.equal(P.selectMagazine(s,2),false);
  s.magazines[2].type='energy';s.magazines[2].energy=0;assert.equal(P.selectMagazine(s,2),false);
});
test('reload falls back to the fuller compatible reserve and never refills magically',()=>{
  const P=load().PowerInventory,s=P.create(32);s.magazines[0].energy=5;s.magazines[1].energy=11;s.magazines[2].energy=17;
  s.nextMagazine=99;assert.equal(P.reload(s),17);assert.equal(s.magazines[0].energy,5);assert.equal(s.battery,150);
});
test('penetration only mitigates resistance and cannot amplify existing weakness',()=>{
  const D=load().DamageTypes;assert.ok(D.resolve(100,'breaker','ballistic',.6)>D.resolve(100,'breaker','ballistic'));
  assert.equal(D.resolve(100,'marksman','ballistic',.9),D.resolve(100,'marksman','ballistic'));
  assert.equal(D.resolve(100,'breaker','ballistic',NaN),D.resolve(100,'breaker','ballistic'));
  assert.ok(D.resolve(100,'breaker','ballistic',Infinity)<=100);
});
test('mission guidance changes at the airlock and never reads enemies',()=>{
  const W=load().Wayfinding,map={entryGate:{x:800},exitGate:{x:1000}},p={x:50,y:300};
  Object.defineProperty(map,'enemies',{get(){throw Error('hidden enemy data read');}});
  assert.match(W.objective(map,p).label,/ШЛЮЗ.*→/);map.bossStarted=true;assert.equal(W.objective(map,p).locked,true);
  map.bossDefeated=true;assert.match(W.objective(map,p).label,/ЛИФТ/);assert.match(W.bearing(Math.PI),/ВЛЕВО/);
});
test('scene and direction rendering restore canvas state without changing the map',()=>{
  const W=load();let depth=0;
  const ctx=new Proxy({save(){depth++;},restore(){depth--;assert.ok(depth>=0);}},{get(t,k){return t[k]||((...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));});}});
  const map={sectors:[{index:0,id:'industrial',x:0,width:1200,lane:300}]},before=JSON.stringify(map);
  W.WorldArt.floor(ctx,map,0,960,false);W.WorldArt.shadow(ctx,{x:50,y:50,width:40,height:90});W.WorldArt.edge(ctx,{x:50,y:50,width:40,height:90},true);
  W.Wayfinding.draw(ctx,{x:100,y:200},1,0);W.Wayfinding.reticle(ctx,200,300,.06,true,false);
  assert.equal(depth,0);assert.equal(JSON.stringify(map),before);
});
function game(){
  const node=()=>({dataset:{},style:{},width:960,height:600,getContext:()=>({}),addEventListener(){},appendChild(){}});
  const s=vm.createContext({window:{addEventListener(){},requestAnimationFrame(){}},document:{getElementById:node,createElement:node},performance:{now:()=>0},localStorage:{getItem:()=>null,setItem(){}}});
  for(const f of ['equipment.js','power-inventory.js','damage-types.js','security-ai.js','perception.js','weapon-handling.js'])vm.runInContext(read(f),s);
  s.window.PowerInventory.render=()=>{};
  vm.runInContext(read('script.js').replace(/\}\)\(\);\s*$/,'window.test={state,createPowerStock,resetPlayer,fireSmg,reloadSmg,updatePlayer,update,playerStats};})();'),s);
  const g=s.window.test;g.state.active=true;g.state.powerInventory=g.createPowerStock();g.resetPlayer();
  g.state.floorMap={width:4000,walls:[],containers:[],entryGate:{x:3000,y:0,width:20,height:600},exitGate:{x:3900,y:0,width:20,height:600}};
  return {g,H:s.window.WeaponHandling,P:s.window.PowerInventory};
}
test('live combat semi-auto, pause and selected-magazine reload follow handling state',()=>{
  const {g,H,P}=game(),s=g.state,p=s.player,stats=g.playerStats();H.init(p,stats);H.cycle(p,stats);H.tick(p,stats,.01,{fire:false});
  g.fireSmg();const ammo=p.ammo;g.fireSmg();assert.equal(p.ammo,ammo);
  s.active=false;const heat=p.handling.heat;g.update(.1);assert.equal(p.handling.heat,heat);s.active=true;s.input.mouseDown=false;
  s.powerInventory.magazines[1].energy=8;P.selectMagazine(s.powerInventory,1);g.reloadSmg();assert.ok(p.reload>0);
  g.fireSmg();assert.equal(p.ammo,ammo);g.updatePlayer(3);assert.equal(s.powerInventory.loaded,1);assert.equal(p.ammo,8);
});
test('live empty or overheated weapon cannot consume rounds or produce projectiles',()=>{
  const {g,H}=game(),s=g.state,p=s.player;H.init(p,g.playerStats()).overheated=true;
  const ammo=p.ammo;g.fireSmg();assert.equal(p.ammo,ammo);assert.equal(s.bullets.length,0);
  p.handling.overheated=false;p.ammo=0;s.powerInventory.magazines.forEach(m=>m.energy=0);g.fireSmg();assert.equal(s.bullets.length,0);
});
test('floor transition cancels stale reload locks and held mouse buttons without spending rounds',()=>{
  const {g,P}=game(),s=g.state;s.powerInventory.magazines[0].energy=2;P.prepareReload(s.powerInventory);
  s.input.mouseDown=true;s.input.aimDown=true;g.resetPlayer();
  assert.equal(s.powerInventory.reloadTarget,undefined);assert.equal(s.powerInventory.magazines[0].energy,2);
  assert.equal(s.input.mouseDown,false);assert.equal(s.input.aimDown,false);
});
test('different compatible magazine capacities update the live ammo readout',()=>{
  const {g,P}=game(),s=g.state;s.powerInventory.magazines[1].capacity=20;s.powerInventory.magazines[1].energy=17;
  P.selectMagazine(s.powerInventory,1);g.reloadSmg();g.updatePlayer(3);assert.equal(s.player.ammo,17);assert.equal(s.player.magazine,20);
});
test('generated supply pool includes ammunition for all guard-SMG converter types',()=>{
  const scope=vm.createContext({window:{}});for(const f of ['arsenal.js','sectors.js','loot-containers.js'])vm.runInContext(read(f),scope);
  const W=scope.window,seen=new Set();
  const sectors=[{index:0,id:'industrial',x:0,width:1000,lane:300}];
  for(let seed=0;seed<100;seed++)for(const crate of W.LootContainers.generate(sectors,[],seed,W.SectorGenerator.seeded,()=>true,()=>[{}]))seen.add(crate.ammoKey);
  for(const type of ['energy','ballistic','elemental','mechanical'])assert.ok(seen.has('smg:'+type));
});
test('installed weapon profiles and crafted attachment choices reach runtime stats',()=>{
  const scope=vm.createContext({window:{}});for(const f of ['resources.js','arsenal.js','workshop.js'])vm.runInContext(read(f),scope);
  const W=scope.window.Workshop,p={salvage:0,resources:{},equipment:{},hideout:{}};W.init(p);
  p.equipment.smg={muzzle:{choice:'compensator'},stock:{choice:'frame-stock'},ammo:{choice:'armor-piercing'}};
  const stats=W.stats(p,{damage:9,magazine:32,bulletSpeed:680,spread:.055,reload:1.22,speed:245,knifeDamage:34,knifeDelay:.42,armor:4,deathRetention:.4,salvageMultiplier:1});
  assert.ok(stats.weaponProfile.recoil<.13);assert.ok(stats.weaponProfile.penetration>.12);assert.ok(Number.isFinite(stats.speed));assert.equal(stats.weaponProfile.mass,2.3);
});
