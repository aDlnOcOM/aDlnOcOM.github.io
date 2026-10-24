const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('./td-number.js');
const D=require('./td-data.js');
const C=require('./td-core.js');
const {Store,KEY}=require('./td-storage.js');
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} ≈ ${b}`);
function game(){const g=new C.Game();g.build(0,'pulse');g.credits=N.from(150);g.auto={build:false,upgrade:false,evolve:false};return g;}
function rich(){const g=game();g.credits=N.power(10,100);return g;}
function enemy(g,type='drone',x=160,y=140){g.phase='wave';g.total=20;const e=g.spawn();Object.assign(e,D.enemies[type],{type,x,y,hp:N.from(1000),maxHp:N.from(1000),progress:100});return e;}
function memory(){const values=new Map();return{values,getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}

test('large-number arithmetic preserves normal values, zero and scientific magnitudes',()=>{
  near(N.from(50).add(70).number(),120);near(N.from(120).sub(70).number(),50);near(N.from(8).mul(4).div(2).number(),16);
  assert.equal(N.from(1).sub(3).log,-Infinity);assert.equal(N.from(0).add(0).format(),'0');
  assert.equal(N.power(10,10000).format(),'1.00e10000');assert.ok(N.power(10,10000).add(N.power(10,9999)).log>10000);
  assert.equal(JSON.stringify(N.from(0)),'null');near(N.load(JSON.parse(JSON.stringify(N.from(123)))).number(),123);
});
test('amount operations reject malformed values without NaN or Infinity leaking into JSON',()=>{
  for(const value of [NaN,Infinity,-Infinity,-5,null,'100',{},undefined]){const n=N.from(value);assert.equal(n.log,-Infinity);assert.equal(n.format(),'0');assert.equal(JSON.stringify(n),'null');}
  assert.equal(N.from(5).div(0).log,-Infinity);assert.equal(N.from(0).ratio(N.from(0)),0);
});
test('piecewise path is continuous, bounded and ends at the reactor',()=>{
  assert.deepEqual(C.pointAt(0),{x:0,y:140});assert.deepEqual(C.pointAt(230),{x:230,y:140});assert.deepEqual(C.pointAt(C.pathLength),{x:1000,y:520});
  for(let p=0;p<C.pathLength;p+=5){const a=C.pointAt(p),b=C.pointAt(p+1);assert.ok(C.dist(a,b)<=1.000001);}
});
test('prepared manual tower and budget do not activate combat automatically',()=>{
  const g=game();g.step(.1);assert.equal(g.time,0);assert.equal(g.wave,1);near(g.credits.number(),150);assert.equal(g.towers.filter(Boolean).length,1);g.start();g.step(.1);assert.ok(g.time>0);
});
test('construction validates slots/types/funds and never charges failed purchases',()=>{
  const g=game(),before=g.credits.log;assert.equal(g.build(0,'rail'),false);assert.equal(g.build(-1,'arc'),false);assert.equal(g.build(1,'__proto__'),false);assert.equal(g.credits.log,before);
  assert.equal(g.build(1,'arc'),true);near(g.credits.number(),90);assert.equal(g.build(2,'rail'),true);near(g.credits.number(),0);assert.equal(g.build(3,'pulse'),false);
});
test('bulk upgrade has exactly the price of sequential upgrades',()=>{
  const a=game(),b=game();a.credits=b.credits=N.from(10000);const price=C.cost(a.towers[0],10);assert.equal(a.upgrade(0,10),true);for(let i=0;i<10;i++)assert.equal(b.upgrade(0),true);
  near(a.credits.number(),b.credits.number(),1e-6);assert.equal(a.towers[0].level,11);near(a.towers[0].spent.number(),35+price.number());
  const count=a.affordableCount(0);assert.ok(a.credits.gte(C.cost(a.towers[0],count)));assert.equal(a.credits.gte(C.cost(a.towers[0],count+1)),false);
});
test('selling refunds 70 percent of actual construction and upgrade expenditure once',()=>{
  const g=game();g.credits=N.from(1000);g.upgrade(0,3);const before=g.credits,refund=g.towers[0].spent.mul(.7);assert.equal(g.sell(0),true);near(g.credits.number(),before.add(refund).number());assert.equal(g.sell(0),false);
});
test('tower levels and research have no gameplay ceiling; every 25 levels doubles damage',()=>{
  const g=rich(),t=g.towers[0];t.level=24;const before=g.stats(t).damage;t.level=25;near(g.stats(t).damage.div(before).number(),1.16*2);
  t.level=10000;assert.ok(Number.isFinite(g.stats(t).damage.log));assert.ok(g.stats(t).damage.log>600);g.cores=N.power(10,10000);g.research.damage=5000;assert.equal(g.buyResearch('damage'),true);assert.equal(g.research.damage,5001);
});
test('ultra-high attack speed becomes finite attack packets, conserving DPS',()=>{
  const g=game(),base=g.stats(g.towers[0]);g.research.tempo=100000;const s=g.stats(g.towers[0]);assert.equal(s.delay,.12);assert.ok(Number.isFinite(s.damage.log));
  near(s.damage.div(s.delay).log-base.damage.div(base.delay).log,Math.log10(1.06)*100000,1e-7);
});
test('ordinary combinations need adjacency, not evolution or level',()=>{
  const g=rich();g.build(1,'arc');g.build(2,'frost');const links=g.links();assert.ok(links.some(l=>l.combo.name==='СВЕРХПРОВОДНИК'));
  g.towers[2].x=990;g.towers[2].y=620;assert.equal(g.links().some(l=>l.combo.name==='СВЕРХПРОВОДНИК'),false);
});
test('cryogenic chain and thermal shock actually multiply damage',()=>{
  const g=rich();g.build(1,'arc');g.build(2,'frost');g.build(3,'plasma');
  const e=enemy(g);e.slowTime=2;let before=e.hp;const arc=g.stats(g.towers[1]);g.hit(g.towers[1],e,arc);near(before.sub(e.hp).number(),arc.damage.mul(1.5).number());
  before=e.hp;const plasma=g.stats(g.towers[3]);g.hit(g.towers[3],e,plasma);near(before.sub(e.hp).number(),plasma.damage.mul(2).number());
});
test('support chooses strongest aura instead of stacking identical nanos',()=>{
  const g=rich();g.build(1,'nano');g.build(2,'nano');near(g.stats(g.towers[0]).aura,.18);g.towers[1].evolution='hive';near(g.stats(g.towers[0]).aura,.4);
});
test('evolution requires level 10, neighboring partner level 5, currency and one branch only',()=>{
  const g=rich();g.build(1,'arc');assert.equal(g.evolve(0,'storm'),false);g.upgrade(0,9);assert.equal(g.evolve(0,'storm'),false);g.upgrade(1,4);assert.equal(g.evolve(0,'storm'),true);assert.equal(g.evolve(0,'execution'),false);assert.equal(g.stats(g.towers[0]).targets,3);
});
test('a player-selected compatible layout has a valid evolution partner',()=>{
  const g=rich();for(let i=1;i<12;i++)g.build(i,['pulse','arc','frost','plasma','nano','rail','arc','frost','rail','plasma','nano','plasma'][i]);for(const t of g.towers)t.level=10;
  for(const t of g.towers)assert.ok(g.evolveOptions(t.slot).some(e=>e.ready),`node ${t.slot} ${t.type}`);
});
test('auto-build and auto-evolve reserve money instead of spending forever on cheaper upgrades',()=>{
  const g=game();g.research.autoBuild=g.research.autoUpgrade=g.research.autoEvolve=1;g.plan(1,'arc');g.auto={build:true,upgrade:true,evolve:false};g.credits=N.from(30);const level=g.towers[0].level;g.automate();assert.equal(g.towers[0].level,level);near(g.credits.number(),30);
  g.credits=N.from(100);g.automate();assert.equal(g.towers[1].type,'arc');
  g.auto={build:false,upgrade:true,evolve:true};g.towers[0].level=10;g.towers[1].level=5;g.credits=C.cost(g.towers[0]).mul(2);g.automate();assert.equal(g.towers[0].level,10);assert.equal(g.towers[1].level,5);
  g.credits=C.cost(g.towers[0]).mul(6);g.automate();assert.equal(g.towers[0].evolution,'storm');
});
test('direct attacks are range-limited and target furthest progressing enemies',()=>{
  const g=game(),t=g.towers[0],far=enemy(g,'drone',950,550);assert.equal(g.attack(t),false);const a=enemy(g),b=enemy(g);a.progress=100;b.progress=150;assert.equal(g.attack(t),true);assert.equal(a.hp.number(),1000);assert.ok(b.hp.number()<1000);assert.equal(far.hp.number(),1000);
});
test('chains, area blasts and rail penetration damage distinct multiple targets',()=>{
  for(const type of ['arc','plasma','rail']){const g=game();g.towers[0].type=type;const t=g.towers[0];t.x=100;t.y=140;const a=enemy(g,'drone',140,140),b=enemy(g,'drone',160,140),c=enemy(g,'drone',180,140);g.attack(t);assert.ok([a,b,c].every(e=>e.hp.number()<1000),type);}
});
test('burn refreshes without stacking and nano lethal hits award their marked bounty',()=>{
  const g=rich();g.towers[0].type='plasma';let e=enemy(g);const s=g.stats(g.towers[0]);g.hit(g.towers[0],e,s);const burn=e.burnDamage.log;g.hit(g.towers[0],e,s);assert.equal(e.burnDamage.log,burn);assert.equal(e.burnTime,3);
  g.towers[0].type='nano';e=enemy(g);e.hp=N.from(1);const before=g.credits;g.credits=N.from(0);g.hit(g.towers[0],e,g.stats(g.towers[0]));near(g.credits.number(),3*1.2);const once=g.credits.log;g.damage(e,N.from(100));assert.equal(g.credits.log,once);assert.ok(before.log>0);
});
test('bosses resist slowing and shield armor reduces ordinary incoming damage',()=>{
  const g=game();g.towers[0].type='frost';const boss=enemy(g,'titan');g.hit(g.towers[0],boss,g.stats(g.towers[0]));assert.ok(boss.slowFactor>.55&&boss.slowFactor<1);
  g.towers[0].type='pulse';const shield=enemy(g,'shield');const before=shield.hp,s=g.stats(g.towers[0]);g.hit(g.towers[0],shield,s);near(before.sub(shield.hp).number(),s.damage.number()*.55);
});
test('paused state freezes production, enemies, cooldowns and effects',()=>{
  const g=game();g.start();g.step(.1);const e=enemy(g);g.paused=true;const before=JSON.stringify(g.serialize()),progress=e.progress;g.step(.1);assert.equal(JSON.stringify(g.serialize()),before);assert.equal(e.progress,progress);
});
test('reactor breach restarts the decade checkpoint and retains towers and currency',()=>{
  const g=game();g.started=true;g.wave=28;g.best=27;g.hp=1;const e=enemy(g);e.progress=C.pathLength-.01;const towers=g.towers;g.step(.1);assert.equal(g.phase,'repair');assert.equal(g.wave,21);assert.equal(g.defeats,1);assert.equal(g.towers,towers);
  for(let i=0;i<81;i++)g.step(.1);assert.equal(g.hp,g.maxHp);assert.equal(g.phase,'wave');
});
test('wave completion never ends the game and every tenth wave pays cores',()=>{
  const g=game();g.wave=10;g.complete();assert.equal(g.best,10);assert.equal(g.wave,11);near(g.cores.number(),1);g.wave=100000;g.complete();assert.equal(g.wave,100001);assert.equal(g.phase,'between');assert.ok(Number.isFinite(g.credits.log));
});
test('prestige resets the cycle but retains permanent research, cores and records',()=>{
  const g=rich();assert.equal(g.prestige(),false);g.cycleBest=40;g.best=90;g.research.damage=3;g.research.hull=2;g.cores=N.from(12);g.towers[0].level=20;const reward=g.prestigeReward();assert.equal(g.prestige(),true);assert.equal(g.wave,1);assert.equal(g.best,90);assert.equal(g.cycleBest,0);assert.equal(g.research.damage,3);assert.equal(g.towers[0],null);assert.equal(g.started,false);near(g.credits.number(),150);near(g.cores.number(),12+reward.number());assert.equal(g.hp,130);assert.equal(g.prestige(),false);
});
test('research validates funds and ids without spending on rejected purchases',()=>{
  const g=game();assert.equal(g.buyResearch('damage'),false);assert.equal(g.buyResearch('__proto__'),false);g.cores=N.from(10);assert.equal(g.buyResearch('hull'),true);near(g.cores.number(),8);assert.equal(g.maxHp,115);assert.equal(g.hp,115);
});
test('offline production caps at 8 hours, ignores backwards time and does not simulate combat',()=>{
  const g=game();g.start();g.best=20;const before=g.credits,wave=g.wave;g.offline(1e8);near(g.credits.sub(before).div(g.income()).number(),28800,1e-6);assert.equal(g.wave,wave);assert.equal(g.enemies.length,0);const total=g.credits.log;g.offline(-20);assert.equal(g.credits.log,total);
});
test('save/load restores builds and huge values under an independent key',()=>{
  const mem=memory(),store=new Store(mem,()=>100000);mem.setItem('chitin-zero:v1','old mech');mem.setItem('nightfall-hunt:v1','old hunters');const g=rich();g.started=true;g.best=100;g.wave=101;g.towers[0].level=1000;g.towers[0].evolution='storm';g.credits=N.power(10,1000);store.save(g);
  const loaded=store.load();assert.equal(loaded.credits.log,1000);assert.equal(loaded.towers[0].level,1000);assert.equal(loaded.towers[0].evolution,'storm');assert.equal(loaded.wave,101);assert.equal(mem.getItem('chitin-zero:v1'),'old mech');assert.equal(mem.getItem('nightfall-hunt:v1'),'old hunters');
});
test('saving an offline award prevents replaying it on the next load',()=>{
  let now=100000;const mem=memory(),store=new Store(mem,()=>now),g=game();g.start();store.save(g);now+=3600000;const loaded=store.load();const earned=loaded.credits.log;store.save(loaded);assert.equal(store.load().credits.log,earned);
});
test('corrupt saves are backed up before replacement; failed writes do not claim success',()=>{
  const mem=memory();mem.setItem(KEY,'{bad json');const store=new Store(mem,()=>100),g=store.load();assert.equal(mem.getItem(KEY),'{bad json');assert.equal(store.save(g),true);assert.equal(mem.getItem(KEY+':recovery'),'{bad json');
  const bad=new Store({getItem(){return null;},setItem(){throw Error();}});assert.equal(bad.save(g),false);assert.match(bad.error,/только в памяти/);
});
test('malformed progress is sanitized, preventing invalid slots, negative HP and unknown evolutions',()=>{
  const g=new C.Game({version:1,credits:Infinity,cores:null,wave:-1,best:-9,research:{damage:-5,hull:NaN},towers:[{type:'__proto__'},{type:'pulse',level:-3,evolution:'invalid'}],hp:-99,auto:{build:'yes'},speed:99});
  assert.equal(g.wave,1);assert.equal(g.best,0);assert.equal(g.research.damage,0);assert.equal(g.towers[0],null);assert.equal(g.towers[1].level,1);assert.equal(g.towers[1].evolution,null);assert.equal(g.hp,1);assert.equal(g.speed,1);assert.equal(g.auto.build,false);
});
test('one-hour autonomous soak builds/evolves all nodes and keeps pools bounded',()=>{
  const g=game();g.research.autoBuild=g.research.autoUpgrade=g.research.autoEvolve=1;for(let i=1;i<12;i++)g.plan(i,['pulse','arc','frost','plasma','nano','rail','arc','frost','rail','plasma','nano','plasma'][i]);g.auto={build:true,upgrade:true,evolve:true};g.start();
  for(let i=0;i<36000;i++){g.step(.1);if(i%100===0){assert.ok(g.enemies.length<=D.limits.enemies);assert.ok(g.effects.length<=D.limits.effects);assert.ok(Number.isFinite(g.credits.log));}}
  assert.ok(g.best>=60);assert.ok(g.towers.every(t=>t&&t.level>25&&t.evolution));assert.equal(g.started,true);assert.ok(g.kills>1000);assert.ok(Number.isFinite(g.hp));
});
