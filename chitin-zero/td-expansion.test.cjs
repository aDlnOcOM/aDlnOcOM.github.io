const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./td-core.js');
const N=require('./td-number.js');
const D=require('./td-data.js');
const {Renderer}=require('./td-render.js');

test('fresh network is empty and manual; the player chooses the first tower',()=>{
  const g=new C.Game();assert.equal(g.allTowers().length,0);assert.deepEqual(g.auto,{build:false,upgrade:false,evolve:false});
  assert.equal(g.start(),false);assert.equal(g.started,false);assert.match(g.event,/Сначала/);
  assert.equal(g.build(4,'plasma'),true);assert.equal(g.tower(4).type,'plasma');assert.equal(g.start(),true);
  assert.equal(D.autoPlan,undefined);
});
test('automation cannot bypass research and unlocking does not enable it',()=>{
  const g=new C.Game();g.credits=N.from(10000);g.build(0,'pulse');g.auto={build:true,upgrade:true,evolve:true};
  assert.equal(g.plan(1,'arc'),false);g.automate();assert.equal(g.tower(0).level,1);assert.equal(g.allTowers().length,1);
  g.auto.upgrade=false;g.cores=N.from(10);assert.equal(g.buyResearch('autoUpgrade'),true);assert.equal(g.auto.upgrade,false);
  const before=g.cores.log;assert.equal(g.buyResearch('autoUpgrade'),false);assert.equal(g.cores.log,before);
  g.auto.upgrade=true;g.automate();assert.equal(g.tower(0).level,2);
});
test('auto-build uses only explicit chosen plans, including later segments',()=>{
  const g=new C.Game();g.segmentCount=10;g.research.autoBuild=1;g.auto.build=true;g.credits=N.from(1e6);
  g.automate();assert.equal(g.allTowers().length,0);assert.equal(g.plan(100,'frost'),true);assert.equal(g.plan(13,'rail'),true);
  g.automate();assert.equal(g.tower(100).type,'frost');assert.equal(g.tower(13),null);g.automate();assert.equal(g.tower(13).type,'rail');
  g.sell(100);g.automate();assert.equal(g.tower(100),null);assert.equal(g.plans.size,0);assert.equal(g.tower(0),null);
});
test('path alternates vertically and remains continuous at every segment boundary',()=>{
  for(const count of [2,10,100000])for(const boundary of [1,count-1]){
    const p=boundary*C.pathLength,a=C.pointAt(p-.001,count),b=C.pointAt(p+.001,count);
    assert.ok(C.dist(a,b)<.00201);assert.ok(Math.abs(a.x-boundary*1000)<.002);
  }
  assert.deepEqual(C.pointAt(C.pathLength*2,2),{x:2000,y:140});
  assert.deepEqual(C.pointPad(12),{x:1125,y:425});assert.deepEqual(C.pointPad(24),{x:2125,y:235});
});
test('new wave records extend the route while replaying old waves does not',()=>{
  const g=new C.Game();for(let i=0;i<9;i++)g.complete();assert.equal(g.segmentCount,10);assert.equal(g.totalPathLength,C.pathLength*10);
  g.wave=2;g.complete();assert.equal(g.segmentCount,10);assert.equal(g.setView(9),true);assert.equal(g.setView(10),false);assert.equal(g.viewSegment,9);
});
test('enemies pass old reactor positions and breach only at the actual end',()=>{
  const g=new C.Game();g.build(0,'pulse');g.start();g.segmentCount=2;g.phase='wave';g.total=2;g.spawnClock=100;
  const e=g.spawn();e.progress=C.pathLength-.1;g.step(.1);assert.equal(g.hp,100);assert.ok(e.x>1000);
  e.progress=g.totalPathLength-.1;g.step(.1);assert.equal(g.hp,93);
});
test('sparse worlds and v2 saves scale with built towers, not empty segments',()=>{
  const g=new C.Game();g.segmentCount=100000;g.credits=N.from(10000);g.research.autoBuild=1;g.auto.build=true;
  const slot=99999*12;g.build(slot,'rail');g.upgrade(slot,5);g.plan(slot+1,'nano');g.setView(99999);g.reducedMotion=true;
  const value=g.serialize();assert.equal(value.towers.length,12);assert.equal(value.extraTowers.length,1);assert.ok(JSON.stringify(value).length<1800);
  const restored=new C.Game(value);assert.equal(restored.segmentCount,100000);assert.equal(restored.viewSegment,99999);assert.equal(restored.tower(slot).level,6);
  assert.equal(restored.plans.get(slot+1),'nano');assert.equal(restored.auto.build,true);assert.equal(restored.reducedMotion,true);
});
test('v1 migration preserves purchases and disables previously free automation',()=>{
  const g=new C.Game({version:1,credits:3,cores:1,best:19,cycleBest:19,wave:20,towers:[{type:'arc',level:11,evolution:'cascade',spent:3}],research:{damage:4},auto:{build:true,upgrade:true,evolve:true},started:true});
  assert.equal(g.tower(0).type,'arc');assert.equal(g.tower(0).level,11);assert.equal(g.tower(0).evolution,'cascade');assert.equal(g.credits.log,3);
  assert.equal(g.segmentCount,20);assert.equal(g.research.damage,4);assert.deepEqual(g.auto,{build:false,upgrade:false,evolve:false});assert.equal(g.serialize().version,2);
});
test('prestige retains automation research but resets world, plans and initial choice',()=>{
  const g=new C.Game();g.segmentCount=30;g.cycleBest=29;g.research.autoBuild=g.research.autoUpgrade=1;g.plan(20,'arc');g.setView(20);
  assert.equal(g.prestige(),true);assert.equal(g.canAutomate('build'),true);assert.equal(g.canAutomate('upgrade'),true);assert.equal(g.segmentCount,1);assert.equal(g.viewSegment,0);assert.equal(g.plans.size,0);assert.equal(g.allTowers().length,0);assert.equal(g.started,false);
});
test('effect generation rejects invisible bursts but preserves intersecting edges and beams',()=>{
  const g=new C.Game();g.setViewport({x:1000,y:100,width:300,height:200});
  assert.equal(g.effect({kind:'burst',x:500,y:200,radius:30,life:.3}),false);
  assert.equal(g.effect({kind:'burst',x:980,y:200,radius:30,life:.3}),true);
  assert.equal(g.effect({kind:'rail',x:900,y:200,toX:1400,toY:200,life:.2}),true);
  assert.equal(g.effect({kind:'arc',x:1100,y:50,toX:1200,toY:80,life:.2}),false);
  g.setViewport({x:5000,y:0,width:1000,height:640});assert.equal(g.effects.length,0);
  g.setViewport({x:0,y:0,width:0,height:0});assert.equal(g.effect({kind:'burst',x:0,y:0,radius:50,life:.3}),false);
});
test('viewport culling never changes damage, bounty, kills, cooldowns or simulation',()=>{
  const a=new C.Game(),b=new C.Game();for(const g of [a,b]){g.build(0,'plasma');g.start();}
  b.setViewport({x:20000,y:0,width:1000,height:640});
  for(let i=0;i<600;i++){a.step(.1);b.step(.1);}
  assert.deepEqual(a.serialize(),b.serialize());assert.ok(a.kills>0);assert.equal(b.effects.length,0);
  assert.deepEqual(a.enemies.map(e=>[e.hp.log,e.progress]),b.enemies.map(e=>[e.hp.log,e.progress]));
});
function renderer(){const calls=[];const ctx=new Proxy({}, {get:(_,key)=> (...args)=>calls.push([key,...args]),set:()=>true});const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({left:10,top:20,width:500,height:320})};return{r:new Renderer(canvas),calls};}
test('renderer intersects its segment with the window and clips fractional visibility',()=>{
  const before=[global.innerWidth,global.innerHeight];try{global.innerWidth=260;global.innerHeight=180;const {r}=renderer();r.segment=4;
    assert.deepEqual(r.viewport(),{x:4000,y:0,width:500,height:320});
    assert.equal(r.pick(10+125*.5,20+235*.5),48);r.segment=5;assert.equal(r.pick(10+125*.5,20+425*.5),60);
  }finally{[global.innerWidth,global.innerHeight]=before;}
});
test('draw skips offscreen effects even when supplied by a stale pool',()=>{
  const {r}=renderer(),g=new C.Game();g.segmentCount=10;g.setView(4);g.effects=[{kind:'burst',x:300,y:200,radius:30,life:1,max:1},{kind:'burst',x:4300,y:200,radius:30,life:1,max:1}];
  const drawn=[];r.effect=e=>drawn.push(e.x);r.draw(g);assert.deepEqual(drawn,[4300]);
});
test('far-world renderer uses small camera-local coordinates to avoid Canvas precision artifacts',()=>{
  const {r,calls}=renderer(),g=new C.Game();g.segmentCount=100000;g.setView(99999);g.build(99999*12,'pulse');r.selected=99999*12;
  const e=g.spawn();e.progress=99999*C.pathLength+100;Object.assign(e,C.pointAt(e.progress,g.segmentCount));g.effect({kind:'beam',x:e.x,y:e.y,toX:e.x+20,toY:e.y+50,life:.2});r.draw(g);
  const geometry=calls.filter(([op])=>['moveTo','lineTo','translate','arc','fillRect','strokeRect'].includes(op));
  for(const [op,...args]of geometry)assert.ok(args.slice(0,2).every(n=>Math.abs(n)<2500),`${op} should use camera-local coordinates: ${args}`);
});
test('GUI text palette reaches 4.5:1 contrast beyond the requested A baseline',()=>{
  function lum(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  for(const bg of ['101d2b','192b3d','294158','142435'])for(const fg of ['edf3f8','b8c9d9'])assert.ok((lum(fg)+.05)/(lum(bg)+.05)>=4.5,`${fg} on ${bg}`);
  assert.ok((lum('e4f28a')+.05)/(lum('16200d')+.05)>=4.5);
});
