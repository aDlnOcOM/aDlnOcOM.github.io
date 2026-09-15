const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const s=vm.createContext({window:{}});for(const f of ['arsenal.js','weapon-handling.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${f}`,'utf8'),s);return s.window;}
const player=()=>({x:0,y:0,weapon:'smg',reload:0});
test('every weapon has a physical role and platform-compatible firing modes',()=>{
  const {Arsenal:A}=load(),guns=A.items.filter(x=>x.kind==='ranged');assert.equal(guns.length,100);
  for(const g of guns){assert.ok(g.mass>0&&g.ergonomics>=10&&g.ergonomics<=95&&g.recoil>0);assert.ok(g.modes.length);}
  assert.ok(A.byId['smg-1'].ergonomics>A.byId['smg-0'].ergonomics);assert.ok(A.byId['smg-1'].recoil>A.byId['smg-0'].recoil);
  assert.equal(A.byId['rail-0'].modes.length,1);assert.ok(A.byId['lmg-0'].mass>A.byId['pistol-0'].mass);
});
test('ADS settles over time, improves spread and reduces walking speed',()=>{
  const H=load().WeaponHandling,p=player(),stats={spread:.06};H.tick(p,stats,.1,{});const hip=p.handling.spread;
  for(let i=0;i<10;i++)H.tick(p,stats,.1,{aim:true});assert.equal(p.handling.ads,1);assert.ok(p.handling.spread<hip);assert.ok(H.speed(p)<1);
  p.reload=1;H.tick(p,stats,.1,{aim:true});assert.ok(p.handling.ads<1);
});
test('semi-auto needs a released trigger, automatic fire does not',()=>{
  const H=load().WeaponHandling,p=player(),stats={spread:.03};H.init(p,stats);H.cycle(p,stats);
  assert.equal(H.canFire(p,stats),false);H.tick(p,stats,.02,{fire:false});assert.equal(H.canFire(p,stats),true);
  H.fired(p,stats);assert.equal(H.canFire(p,stats),false);H.tick(p,stats,.1,{fire:true});assert.equal(H.canFire(p,stats),false);
  H.cycle(p,stats);assert.equal(H.canFire(p,stats),true);
});
test('recoil accumulates and recovers; moving and worn guns are less precise',()=>{
  const H=load().WeaponHandling,p=player(),stats={spread:.04};H.tick(p,stats,.02,{});const base=p.handling.spread;
  H.fired(p,stats);H.tick(p,stats,.02,{moving:1});assert.ok(p.handling.spread>base);
  for(let i=0;i<30;i++)H.tick(p,stats,.1,{});assert.equal(p.handling.recoil,0);
  const worn={...stats,weaponProfile:{...H.profile(stats),condition:20}};H.tick(p,worn,.1,{});assert.ok(p.handling.spread>base);
});
test('heat stops shooting and recovers only below hysteresis threshold',()=>{
  const H=load().WeaponHandling,p=player(),stats={spread:.04};for(let i=0;i<35;i++)H.fired(p,stats);
  assert.equal(H.canFire(p,stats),false);for(let i=0;i<20;i++)H.tick(p,stats,.1,{});assert.equal(H.canFire(p,stats),false);
  for(let i=0;i<20;i++)H.tick(p,stats,.1,{});assert.equal(H.canFire(p,stats),true);
});
test('dash prevents aiming and shooting without altering collision data',()=>{
  const H=load().WeaponHandling,p=player();p.dash={remaining:.2};p.radius=13;H.tick(p,{spread:.03},.05,{aim:true});assert.equal(p.handling.ads,0);assert.equal(H.canFire(p,{}),false);assert.equal(p.radius,13);
});
