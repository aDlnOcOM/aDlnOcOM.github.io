const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=file=>fs.readFileSync(`${__dirname}/${file}`,'utf8');
function load(){const scope=vm.createContext({window:{}});vm.runInContext(read('animation.js'),scope);return scope.window;}
function canvas(){
  let depth=0;const calls=[];
  const ctx=new Proxy({save(){depth++;},restore(){assert.ok(depth>0);depth--;},get depth(){return depth;}},
    {get(target,key){return key in target?target[key]:(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));calls.push([key,...args]);};}});
  return {ctx,calls};
}
test('actual distance drives gait; blocked input, teleports and dash do not advance it',()=>{
  const A=load().GameAnimation,p={x:0,y:0};A.state(p);p.x=12;A.tick(p,.05);
  assert.ok(A.pose(p).stride!==0);const gait=A.state(p).gait;
  for(let i=0;i<15;i++)A.tick(p,.05);assert.equal(A.state(p).gait,gait);assert.ok(Math.abs(A.pose(p).stride)<.001);
  p.x=500;A.tick(p,.05);assert.equal(A.state(p).gait,gait);
  p.dash={remaining:.1};p.x+=30;A.tick(p,.05);assert.equal(A.state(p).gait,gait);
});
test('gait phase is independent of frame rate and animation never changes entity combat data',()=>{
  const A=load().GameAnimation,results=[];
  for(const frames of [30,60,120]){
    const p={x:0,y:0,health:90,radius:14,fireCooldown:.2};A.state(p);
    for(let i=0;i<frames;i++){p.x+=120/frames;A.tick(p,1/frames);}
    results.push(A.state(p).gait);assert.equal(p.health,90);assert.equal(p.radius,14);assert.equal(p.fireCooldown,.2);
    assert.deepEqual(Object.keys(p),['x','y','health','radius','fireCooldown']);
  }
  assert.ok(Math.max(...results)-Math.min(...results)<1e-10);
});
test('shot and melee events recover; render-only calls do not advance paused state',()=>{
  const A=load().GameAnimation,p={x:0,y:0};A.trigger(p,'fire');A.trigger(p,'melee');
  assert.ok(A.pose(p).flash);const time=A.state(p).time;
  for(let i=0;i<100;i++)A.pose(p);assert.equal(A.state(p).time,time);assert.equal(A.pose(p).recoil,1);
  A.tick(p,.05);assert.ok(A.pose(p).swing>0);
  for(let i=0;i<10;i++)A.tick(p,.05);assert.equal(A.pose(p).recoil,0);assert.equal(A.pose(p).swing,0);
});
test('reload gesture follows actual duration and stops on cancellation',()=>{
  const A=load().GameAnimation,p={x:0,y:0,reload:2};A.trigger(p,'reload',2);
  for(let i=0;i<10;i++)A.tick(p,.1);assert.ok(A.pose(p).reload>.99);
  p.reload=0;A.tick(p,.01);assert.equal(A.pose(p).reload,0);
});
test('breaker poses distinguish windup, charge, recovery without changing collision radius',()=>{
  const A=load().GameAnimation,e={x:0,y:0,radius:40,phaseTime:.2,attackPhase:'windup'};
  assert.ok(A.pose(e,'breaker').offset<0);e.attackPhase='charge';assert.ok(A.pose(e,'breaker').squash<1);assert.ok(A.pose(e,'breaker').offset>0);
  e.attackPhase='recover';assert.ok(A.pose(e,'breaker').offset<0);assert.equal(e.radius,40);
  e.x=20;A.tick(e,.05);assert.equal(A.pose(e,'turret').stride,0);
});
test('unbuilt facilities stay inert; scanning requires a built, working research table',()=>{
  const A=load().GameAnimation;
  assert.equal(A.facilityPose('research',10,0,true).working,false);assert.equal(A.facilityPose('research',10,0,true).cycle,0);
  assert.equal(A.facilityPose('research',10,1,false).scan,0);
  assert.ok(A.facilityPose('research',10,1,true).scan>0);
  assert.ok(A.facilityPose('mill',10,5).cycle>A.facilityPose('mill',10,1).cycle);
});
test('every actor and facility rig restores canvas state and tolerates unavailable assets',()=>{
  const W=load(),A=W.GameAnimation,{ctx,calls}=canvas(),ids=[];
  W.GameAssets={sprite(_ctx,id){ids.push(id);return true;}};
  for(const kind of ['player','watcher','drone','turret','burstTurret','enforcer','marksman','warden','breaker']){
    const e={x:0,y:0,hitFlash:.1};A.state(e);e.x+=10;A.tick(e,.05);A.trigger(e,'fire');A.trigger(e,'melee');
    assert.equal(A.actor(ctx,e,kind,42),true);assert.equal(ctx.depth,0);
  }
  for(const id of ['generator','battery','solder','mill','forming','research','storage','equipment','implants']){
    assert.equal(A.facility(ctx,id,4,2,true),true);assert.equal(ctx.depth,0);
  }
  assert.ok(calls.some(([fn,arg])=>fn==='clip'&&arg==='evenodd'));
  W.GameAssets.sprite=()=>false;assert.equal(A.actor(ctx,{x:0,y:0},'player'),false);assert.equal(A.facility(ctx,'mill',0,1),false);
  assert.equal(ctx.depth,0);assert.ok(ids.includes('props/research'));
});
test('weapon sprites recoil, reload and switch to the equipped melee asset for quick attacks',()=>{
  const W=load(),A=W.GameAnimation,{ctx}=canvas(),ids=[];W.GameAssets={sprite(_ctx,id){ids.push(id);return true;}};
  const p={x:0,y:0,weapon:'smg'};A.trigger(p,'fire');A.weapon(ctx,p,'rail');assert.equal(ids.pop(),'weapons/rail');
  p.knifeFlash=.2;A.trigger(p,'melee');A.weapon(ctx,p,'rail',12);assert.equal(ids.pop(),'weapons/melee-12');assert.equal(ctx.depth,0);
});
function game(){
  const node=()=>({dataset:{},width:960,height:600,getContext:()=>({}),addEventListener(){},appendChild(){}});
  const scope=vm.createContext({window:{addEventListener(){},requestAnimationFrame(){}},document:{getElementById:node,createElement:node},performance:{now:()=>0},localStorage:{getItem:()=>null,setItem(){}}});
  for(const file of ['animation.js','power-inventory.js','damage-types.js','equipment.js','security-ai.js','perception.js'])vm.runInContext(read(file),scope);
  scope.window.PowerInventory.render=()=>{};
  vm.runInContext(read('script.js').replace(/\}\)\(\);\s*$/,'window.test={state,createPowerStock,resetPlayer,fireSmg,reloadSmg,knifeAttack,createEnemyBullet,fireEnemy,update};})();'),scope);
  const g=scope.window.test;g.state.active=true;g.state.powerInventory=g.createPowerStock();g.resetPlayer();return {g,A:scope.window.GameAnimation};
}
test('live successful shots and attacks trigger poses; empty magazines cannot fake a muzzle flash',()=>{
  const {g,A}=game(),p=g.state.player;
  g.fireSmg();assert.ok(A.pose(p).flash);assert.ok(g.state.bullets.length>0);
  for(let i=0;i<4;i++)A.tick(p,.05);
  p.ammo=0;g.state.powerInventory.magazines.forEach(m=>m.energy=0);g.fireSmg();assert.equal(A.pose(p).flash,false);
  g.knifeAttack();A.tick(p,.05);assert.ok(A.pose(p).swing>0);
  const e={x:300,y:300,type:'burstTurret',damage:10,bulletSpeed:200};g.createEnemyBullet(e,0,200,10,'red');assert.ok(A.pose(e).flash);
  e.type='enforcer';g.fireEnemy(e,1,0);A.tick(e,.05);assert.ok(A.pose(e).swing>0);
});
test('inactive live update leaves all animation timers unchanged',()=>{
  const {g,A}=game(),p=g.state.player;g.state.active=false;A.trigger(p,'fire');g.update(.1);assert.equal(A.pose(p).recoil,1);assert.equal(A.state(p).time,0);
});
test('shelter gait does not march against a solid wall',()=>{
  const scope=vm.createContext({window:{}});vm.runInContext(read('shelter-location.js'),scope);
  const p={x:42,y:250,step:0};scope.window.ShelterLocation.move(p,new Set(['KeyA']),.05,{});assert.equal(p.step,0);
});
