const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./field-core.js'),F=require('./field-data.js'),N=require('./td-number.js'),{Store,KEY}=require('./field-storage.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ~= ${b}`);
function rich(){const g=new C.Game();g.credits=N.from(1e9);return g;}
function remote(){const g=rich();g.build('3,0','pylon');g.build('6,0','pylon');g.build('7,0','pulse');g.build('6,1','generator');return g;}
function enemy(g,x,y){g.total=20;const e=g.spawn();Object.assign(e,{x,y,hp:N.from(10000),maxHp:N.from(10000),progress:-Math.hypot(x,y)});return e;}
test('initial world contains exactly a core and a powered simple turret',()=>{
  const g=new C.Game();assert.equal(g.buildings.size,2);assert.equal(g.core.type,'core');assert.equal(g.tower('1,0').type,'pulse');assert.equal(g.tower('1,0').powered,true);assert.equal(g.network.capacity,12);assert.equal(g.network.used,4);assert.equal(g.started,false);near(g.credits.number(),150);
});
test('grid is sparse and accepts positive and negative distant coordinates',()=>{
  const g=rich();assert.equal(g.build('-1000000,1000000','wall'),true);assert.equal(g.buildings.size,3);assert.equal(g.tower('-1000000,1000000').x,-60000000);
  for(const slot of ['1.5,0','01,0','NaN,0','Infinity,0','1000000001,0','__proto__'])assert.equal(g.build(slot,'wall'),false);
  assert.equal(g.build('0,0','wall'),false);assert.equal(g.build('2,0','__proto__'),false);
});
test('relay network connects through pylons and isolated generators cannot self-power',()=>{
  const g=rich();g.build('6,0','pylon');g.build('7,0','pulse');g.build('6,1','generator');assert.equal(g.tower('7,0').powered,false);assert.equal(g.network.capacity,12);
  g.build('3,0','pylon');assert.equal(g.tower('7,0').powered,true);assert.equal(g.tower('6,1').powered,true);assert.equal(g.network.capacity,36);
});
test('destroying a bridge removes downstream energy immediately without refunds',()=>{
  const g=remote(),before=g.credits.log;g.hurt(g.tower('3,0'),N.from(1e6));assert.equal(g.tower('3,0'),null);assert.equal(g.tower('7,0').powered,false);assert.equal(g.tower('6,0').connected,false);assert.equal(g.network.capacity,12);assert.equal(g.credits.log,before);
  g.build('3,0','pylon');assert.equal(g.tower('7,0').powered,true);
});
test('alternate pylon routes remain live after losing a redundant connection',()=>{
  const g=remote();g.build('2,2','pylon');g.build('4,2','pylon');g.hurt(g.tower('3,0'),N.from(1e6));assert.equal(g.tower('6,0').powered,true);assert.equal(g.network.capacity,36);
});
test('overloaded consumers shed deterministically and obey manual priorities',()=>{
  const g=rich();g.build('-1,0','rail');g.build('0,1','plasma');assert.equal(g.network.demand,19);assert.equal(g.network.used,12);assert.equal(g.tower('0,1').powered,false);
  g.setPriority('0,1',2);assert.equal(g.tower('0,1').powered,true);assert.equal(g.tower('-1,0').powered,false);assert.equal(g.network.used,11);
  g.build('0,-1','generator');assert.equal(g.network.capacity,36);assert.equal(g.tower('-1,0').powered,true);g.hurt(g.tower('0,-1'),N.from(1e6));assert.equal(g.tower('-1,0').powered,false);
});
test('power and relay coverage boundaries are enforced',()=>{
  const g=rich();g.build('4,0','pylon');assert.equal(g.tower('4,0').connected,false);g.build('3,0','pylon');assert.equal(g.tower('4,0').connected,true);
  g.build('4,2','pulse');assert.equal(g.tower('4,2').powered,false);g.build('4,1','pylon');assert.equal(g.tower('4,2').powered,true);
});
test('unpowered weapons cannot deal damage or emit firing effects',()=>{
  const g=remote(),t=g.tower('7,0'),e=enemy(g,t.x+60,t.y);g.hurt(g.tower('3,0'),N.from(1e6));g.effects=[];const hp=e.hp.log;assert.equal(g.attack(t),false);assert.equal(e.hp.log,hp);assert.equal(g.effects.length,0);g.build('3,0','pylon');assert.equal(g.attack(t),true);assert.ok(e.hp.log<hp);
});
test('all infrastructure types have distinct durability; walls need no power',()=>{
  assert.equal(new Set(['wall','pylon','generator','regen','pulse'].map(id=>F.structures[id].hp)).size,5);const g=rich();g.build('20,20','wall');assert.equal(g.tower('20,20').powered,true);assert.equal(g.powerNeed(g.tower('20,20')),0);
});
test('waves spawn threats in all eight directions outside the connected base',()=>{
  const g=rich();const quadrants=new Set();for(let i=0;i<8;i++){const e=g.spawn();quadrants.add(`${Math.sign(e.x)},${Math.sign(e.y)}`);assert.ok(Math.hypot(e.x,e.y)>=480-1e-6);}assert.equal(quadrants.size,4);
  g.build('3,0','pylon');g.build('6,0','pylon');const e=g.spawn();assert.ok(Math.hypot(e.x,e.y)>=660-1e-6);
});
test('enemies attack and destroy pylons, generators, turrets and walls',()=>{
  for(const type of ['pylon','generator','pulse','wall']){const g=rich();g.build('-4,0',type);const t=g.tower('-4,0'),e=enemy(g,-300,0);e.damage=10000;g.moveEnemy(e,1);assert.equal(g.tower('-4,0'),null,type);}
});
test('swept collision stops fast enemies at a wall before the protected generator',()=>{
  const g=rich();g.build('-2,0','generator');g.build('-3,0','wall');const wall=g.tower('-3,0'),generator=g.tower('-2,0'),e=enemy(g,-300,0);e.speed=500;e.target=generator.slot;e.think=10;const hp=generator.hp.log;g.moveEnemy(e,1);assert.ok(e.x<-210);assert.ok(wall.hp.log<wall.maxHp.log);assert.equal(generator.hp.log,hp);
});
test('building under an enemy is rejected without charging',()=>{
  const g=rich();enemy(g,180,180);const before=g.credits.log;assert.equal(g.build('3,3','wall'),false);assert.equal(g.credits.log,before);
});
test('powered regeneration repairs one nearby target, not itself or out-of-range buildings',()=>{
  const g=rich();g.build('-1,0','regen');g.build('-1,1','wall');g.build('-1,3','wall');const module=g.tower('-1,0'),wall=g.tower('-1,1'),far=g.tower('-1,3');g.hurt(module,20);g.hurt(wall,200);g.hurt(far,200);const self=module.hp.log,farHp=far.hp.log,before=wall.hp.number();g.repairStructures(1);near(wall.hp.number(),before+9);assert.equal(module.hp.log,self);assert.equal(far.hp.log,farHp);
});
test('disconnected repair modules stop healing and cannot resurrect destroyed buildings',()=>{
  const g=remote();g.build('7,1','regen');g.build('8,1','wall');const wall=g.tower('8,1');g.hurt(wall,100);g.hurt(g.tower('3,0'),N.from(1e6));const before=wall.hp.log;g.repairStructures(1);assert.equal(wall.hp.log,before);g.hurt(wall,N.from(1e6));g.build('3,0','pylon');g.repairStructures(1);assert.equal(g.tower('8,1'),null);
});
test('repair modules share a target healing cap and do not overfill HP',()=>{
  const g=rich();g.build('0,-1','generator');g.build('-1,-1','regen');g.build('-1,1','regen');g.build('-1,0','pylon');const t=g.tower('-1,0');g.hurt(t,80);const before=t.hp.number();g.repairStructures(1);near(t.hp.number(),before+90*.04);t.hp=t.maxHp.sub(1);g.repairStructures(1);near(t.hp.number(),90);
});
test('upgrades increase durability and supply but do not silently repair damage',()=>{
  const g=rich();g.build('0,-1','generator');const t=g.tower('0,-1');g.hurt(t,110);g.upgrade(t.slot,2);near(t.hp.ratio(t.maxHp),.5);near(g.network.capacity,48);g.upgrade('1,0',10);assert.equal(g.powerNeed(g.tower('1,0')),5);g.cores=N.from(10);const ratio=t.hp.ratio(t.maxHp);g.buyResearch('hull');near(t.hp.ratio(t.maxHp),ratio);
});
test('selling a damaged structure refunds less and the core cannot be sold',()=>{
  const g=rich();g.credits=N.from(100);const t=g.tower('1,0');g.hurt(t,80);const before=g.credits.number();assert.equal(g.sell('1,0'),true);near(g.credits.number()-before,35*.7*.5);assert.equal(g.sell('0,0'),false);
});
test('research gates explicit infrastructure plans and automatic upgrades',()=>{
  const g=rich();g.auto.build=g.auto.upgrade=true;assert.equal(g.plan('3,0','pylon'),false);g.automate();assert.equal(g.tower('1,0').level,1);g.research.autoBuild=g.research.autoUpgrade=1;assert.equal(g.plan('3,0','pylon'),true);g.automate();assert.equal(g.tower('3,0').type,'pylon');g.automate();assert.equal(g.tower('1,0').level,2);
});
test('core breach pauses for reconstruction and never resurrects destroyed infrastructure',()=>{
  const g=rich();g.build('3,0','pylon');g.hurt(g.tower('3,0'),N.from(1e6));g.start();g.phase='wave';g.spawnClock=100;g.total=10;g.hurt(g.core,N.from(1e6));g.step(.1);assert.equal(g.phase,'repair');for(let i=0;i<81;i++)g.step(.1);assert.equal(g.started,false);assert.equal(g.phase,'ready');assert.equal(g.core.hp.log,g.core.maxHp.log);assert.equal(g.tower('3,0'),null);assert.equal(g.defeats,1);
});
test('field save roundtrip preserves damage, camera, network priority and queue without touching route saves',()=>{
  const g=remote();g.research.autoBuild=1;g.auto.build=true;g.plan('-1,1','wall');g.camera={x:-1200,y:600};g.selected='-20,10';g.hurt(g.tower('7,0'),30);g.setPriority('7,0',2);
  const memory=new Map([['neon-bastion:v1','route save']]),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},store=new Store(storage,()=>1000);assert.equal(store.save(g),true);const loaded=store.load();assert.equal(loaded.tower('7,0').hp.log,g.tower('7,0').hp.log);assert.equal(loaded.tower('7,0').priority,2);assert.deepEqual(loaded.camera,g.camera);assert.equal(loaded.selected,g.selected);assert.equal(loaded.plans.get('-1,1'),'wall');assert.equal(loaded.network.capacity,36);assert.equal(memory.get('neon-bastion:v1'),'route save');assert.ok(memory.has(KEY));
});
test('corrupt structure data cannot introduce invalid coordinates or an extra core',()=>{
  const g=new C.Game({mode:'field',version:1,buildings:[{slot:'2,2',type:'core'},{slot:'0,0',type:'wall'},{slot:'NaN,0',type:'pulse'},{slot:'1,0',type:'pulse',level:-1,hp:Infinity}],research:{autoBuild:-1}});assert.equal(g.core.slot,'0,0');assert.equal(g.buildings.size,2);assert.equal(g.tower('1,0').level,1);assert.equal(g.canAutomate('build'),false);
});
test('prestige keeps permanent research and restarts with core plus simple turret',()=>{
  const g=remote();g.cycleBest=20;g.best=20;g.research.autoBuild=1;g.plan('2,2','wall');assert.equal(g.prestige(),true);assert.equal(g.buildings.size,2);assert.equal(g.tower('1,0').powered,true);assert.equal(g.research.autoBuild,1);assert.equal(g.plans.size,0);assert.equal(g.started,false);
});
test('offscreen effect culling does not alter combat, destruction or power distribution',()=>{
  const a=rich(),b=rich();for(const g of [a,b]){g.build('-1,0','pulse');g.build('0,1','pulse');g.start();}b.setViewport({x:1e6,y:1e6,width:1000,height:640});for(let i=0;i<1800;i++){a.step(.1);b.step(.1);}assert.deepEqual(a.serialize(),b.serialize());assert.equal(b.effects.length,0);assert.ok(a.kills>0);
});
test('pause freezes repair, enemy attacks, particles, clocks and production',()=>{
  const g=remote();g.start();g.paused=true;const before=JSON.stringify(g.serialize()),time=g.time;g.step(.1);assert.equal(JSON.stringify(g.serialize()),before);assert.equal(g.time,time);
});
test('all six powered weapons retain damage and powerless nano loses its support aura',()=>{
  for(const type of ['pulse','arc','frost','plasma','rail','nano']){const g=rich();g.sell('1,0');g.build('-1,0',type);const e=enemy(g,-120,0);assert.equal(g.attack(g.tower('-1,0')),true);assert.ok(e.hp.number()<10000,type);}
  const g=rich();g.build('3,0','pylon');g.build('3,1','nano');near(g.stats(g.tower('1,0')).aura,.18);g.hurt(g.tower('3,0'),N.from(1e6));near(g.stats(g.tower('1,0')).aura,0);
});
test('a destroyed core reloads into recovery without reviving lost structures',()=>{
  const g=remote();g.start();g.hurt(g.tower('3,0'),N.from(1e6));g.hurt(g.core,N.from(1e9));const loaded=new C.Game(g.serialize());assert.equal(loaded.phase,'repair');assert.equal(loaded.core.hp.log,-Infinity);assert.equal(loaded.tower('3,0'),null);assert.equal(loaded.tower('7,0').powered,false);
});
test('twenty-minute defense soak preserves bounded pools, finite positions and valid networks',()=>{
  const g=rich();g.upgrade('0,0',10);for(const [slot,type]of [['-1,0','rail'],['0,-1','arc'],['0,1','plasma'],['-1,-1','frost'],['1,1','nano'],['1,-1','generator'],['-1,1','regen']])g.build(slot,type);
  for(const t of g.allBuildings())g.upgrade(t.slot,12);g.research.autoUpgrade=1;g.auto.upgrade=true;g.start();
  for(let i=0;i<12000;i++){if(!g.started)g.start();g.step(.1);if(i%100===0){assert.ok(g.enemies.length<=100);assert.ok(g.effects.length<=100);assert.ok(g.network.used<=g.network.capacity);assert.ok(Number.isFinite(g.credits.log));for(const e of g.enemies)assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));}}
  assert.ok(g.best>=10);assert.ok(g.kills>100);assert.ok(g.allBuildings().every(t=>Number.isFinite(t.maxHp.log)));
});
