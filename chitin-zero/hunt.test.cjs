const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('./hunt-data.js');
const C = require('./hunt-core.js');
const R = require('./hunt-render.js');
const S = require('./hunt-storage.js');
function game(options={}) { const g=new C.Game({seed:7,...options});g.spawnClock=1e6;g.chestAt=1e6;g.bossAt=1e6;return g; }
function advance(g,seconds,input={fire:false}) { for(let i=0;i<Math.ceil(seconds*60);i++)g.step(1/60,input); }
function upgrade(g,type,id,level) { g.pendingLevels=1;g.status='upgrade';g.offers=[{type,id,level}];assert.equal(g.choose(0),true); }
function memory() { const map=new Map();return {map,getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}; }

test('14 original weapons map to distinct raster rows with three valid animation crops',()=>{
  assert.equal(Object.keys(D.weapons).length,14);assert.equal(new Set(Object.values(D.weapons).map(w=>w.sprite)).size,14);
  for(const id of Object.keys(D.weapons))for(let frame=0;frame<3;frame++){
    const r=R.spriteRect(id,frame),png=fs.readFileSync(path.join(__dirname,`assets/hunt/weapons-${r.sheet?'b':'a'}.png`));
    assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1536);assert.equal(png[25],6);
    assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=1024&&r.y+r.h<=1536);
  }
});
test('weapon overlay uses drawImage, never world geometry, and freezes its pose with game state',()=>{
  const sprites=new R.Sprites();sprites.ready=true;sprites.images=[{},{}];const calls=[];
  const ctx=new Proxy({drawImage:(...args)=>calls.push(args)}, {get:(t,k)=>t[k]||(()=>{})});
  for(const id of Object.keys(D.weapons))sprites.draw(ctx,id,1,300,500,240);
  assert.equal(calls.length,14);assert.ok(calls.every(a=>a.length===9&&a.slice(1).every(Number.isFinite)));
  const g=game();g.player.weapons[0].flash=.14;g.status='paused';advance(g,3);assert.equal(g.player.weapons[0].flash,.14);
});
test('all 14 gun mounts remain in peripheral screen space, including small landscape',()=>{
  for(const [w,h] of [[1440,900],[800,450],[390,844]]){
    const layout=R.weaponLayout(14,w,h);assert.equal(layout.length,14);
    assert.ok(layout.every(p=>Math.abs(p.x-w/2)-p.width/2>w*.15));assert.ok(layout.every(p=>p.y>h*.3&&p.y<h));
  }
});
test('each arena has distinct geometry and all spawnable floor cells are connected',()=>{
  const signatures=new Set();
  for(const kind of Object.keys(D.arenas)){
    const map=new C.Arena(kind);signatures.add(map.cells.join(''));assert.equal(map.blocked(map.center,map.center),false);
    for(let i=0;i<map.cells.length;i++)if(!map.cells[i])assert.ok(map.flow[i]>=0,`${kind} floor ${i}`);
    for(const x of [-1,.1,110.8,112])assert.equal(map.blocked(x,50,.32),true);
  }
  assert.equal(signatures.size,3);
});
test('substepped collision prevents walking or dashing through walls',()=>{
  const g=game(),p=g.player;p.x=4;p.z=55.5;
  g.map.move(p,-100,0);assert.ok(p.x>=3.31);assert.equal(g.map.blocked(p.x,p.z,p.radius),false);
  p.yaw=-Math.PI/2;advance(g,1,{forward:1,dash:true,fire:false});assert.ok(p.x>=3.31);
});
test('movement uses camera yaw, has inertia and normalizes diagonals',()=>{
  const g=game(),p=g.player;advance(g,1,{forward:1,yaw:Math.PI/2,fire:false});assert.ok(p.x>60);assert.ok(Math.abs(p.z-55.5)<.01);
  const vx=p.vx;g.step(1/60,{fire:false});assert.ok(p.vx>0&&p.vx<vx);
  const diagonal=game();advance(diagonal,1,{forward:1,side:1,fire:false});assert.ok(C.distance(diagonal.player,{x:55.5,z:55.5})<=p.speed);
});
test('jump returns to floor and dash provides a bounded cooldown',()=>{
  const g=game();g.step(1/60,{jump:true,dash:true,fire:false});assert.ok(g.player.y>0);assert.ok(g.player.dash>0);
  advance(g,1);assert.equal(g.player.y,0);assert.equal(g.player.dash,0);assert.ok(g.player.dashCooldown>1);
});
test('swept hit test respects height, penetration order and fast travel',()=>{
  const e={x:0,z:0,y:0,height:2,radius:.5};
  assert.ok(C.bodyHit({x:0,y:1,z:10},{x:0,y:1,z:-10},e)<.5);
  assert.equal(C.bodyHit({x:0,y:3,z:10},{x:0,y:3,z:-10},e),null);
  assert.notEqual(C.bodyHit({x:0,y:3,z:0},{x:0,y:0,z:0},e),null);
});
test('aim is truly vertical and projectiles do not auto-turn ordinary weapons',()=>{
  const g=game();const e=g.spawn('ghoul',g.player.x+4,g.player.z-10);g.player.pitch=.5;g.fire(g.player.weapons[0]);
  const b=g.bullets[0];assert.ok(b.vy>0);assert.ok(Math.abs(b.vx)<1);assert.ok(b.vz<0);g.projectiles(.05);assert.equal(e.hp,e.maxHp);
});
test('walls block projectiles and area damage while open shots hit',()=>{
  const g=game();g.player.pitch=0;const e=g.spawn('ghoul',55.5,49.5);g.player.critical=0;
  g.map.cells[17*37+18]=2;g.fire(g.player.weapons[0]);for(let i=0;i<20;i++)g.projectiles(.02);assert.equal(e.hp,e.maxHp);
  g.area(55.5,1,55.5,12,100);assert.equal(e.hp,e.maxHp);
  g.map.cells[17*37+18]=0;g.fire(g.player.weapons[0]);for(let i=0;i<20;i++)g.projectiles(.02);assert.ok(e.hp<e.maxHp);
});
test('each weapon fires with finite stats and generates either projectiles or an aura',()=>{
  for(const id of Object.keys(D.weapons)){
    const g=game(),w={id,level:6,flash:0};g.fire(w);assert.equal(g.shots,1);assert.equal(w.flash,.18);
    if(D.weapons[id].aura)assert.ok(g.effects.length);else {assert.ok(g.bullets.length);assert.ok(g.bullets.every(b=>[b.vx,b.vy,b.vz,b.life,b.damage].every(Number.isFinite)));}
  }
});
test('passive speed applies exactly eight percent once per rank',()=>{
  const g=game();upgrade(g,'passive','speed',1);assert.ok(Math.abs(g.player.speed-D.hunters.mara.speed*1.08)<1e-9);
  advance(g,1,{forward:1,fire:false});assert.ok(Math.abs(g.player.vz)<g.player.speed+.001);
});
test('evolution requires weapon V and its paired relic II',()=>{
  const g=game();g.player.weapons[0].level=5;assert.equal(g.candidates().some(c=>c.id==='revolver'),false);
  g.player.passives.critical=2;const option=g.candidates().find(c=>c.id==='revolver');assert.equal(option.level,6);
  upgrade(g,'weapon','revolver',6);assert.equal(g.player.weapons[0].level,6);assert.equal(g.candidates().some(c=>c.id==='revolver'),false);
});
test('all 14 weapons can coexist and capped builds retain repeatable progression',()=>{
  const g=game();g.player.weapons=Object.keys(D.weapons).map(id=>({id,level:6,cooldown:0,flash:0}));g.player.passives=Object.fromEntries(Object.keys(D.passives).map(id=>[id,5]));
  assert.deepEqual(g.candidates().map(c=>c.type),['heal','power']);advance(g,.1,{fire:true});assert.ok(g.shots>=14);assert.ok(g.bullets.length<=D.LIMITS.bullets);
});
test('XP pauses for every earned level and invalid choices do not consume offers',()=>{
  const g=game();g.addXp(100);g.step(1/60,{fire:false});assert.equal(g.status,'upgrade');const pending=g.pendingLevels,offers=g.offers;
  assert.equal(g.choose(10),false);assert.equal(g.offers,offers);const t=g.time;advance(g,2);assert.equal(g.time,t);g.choose(0);assert.equal(g.pendingLevels,pending-1);
});
test('enemy steering routes around walls and coincident enemies separate',()=>{
  const g=game();g.player.invulnerable=100;const a=g.spawn('ghoul',55.5,45),b=g.spawn('ghoul',55.5,45);advance(g,.5);assert.ok(C.distance(a,b)>.1);
  const map=g.map;map.cells[17*37+18]=2;map.buildFlow(55.5,55.5);const dir=map.direction({x:55.5,z:49.5},g.player);assert.ok(Math.abs(dir.x)>0);
});
test('hunters have distinct charged abilities, blocked abilities cannot be spent on pause',()=>{
  for(const hunter of Object.keys(D.hunters)){
    const g=game({hunter});g.player.charge=100;g.player.hp-=40;const e=g.spawn('brute',55.5,51);assert.equal(g.ability(),true);assert.equal(g.player.charge,0);
    if(hunter==='grimm')assert.equal(g.player.rage,8);else {assert.ok(e.hp<e.maxHp);if(hunter==='elias')assert.equal(e.slow,3);else assert.ok(g.player.hp>D.hunters[hunter].hp-40);}
    g.status='paused';g.player.charge=100;assert.equal(g.ability(),false);assert.equal(g.player.charge,100);
  }
});
test('boss slam is telegraphed; dash invulnerability avoids incoming damage',()=>{
  const g=game();g.player.invulnerable=0;const e=g.spawn('boss',55.5,48);e.timer=0;g.step(.02,{fire:false});assert.ok(e.windup>0);
  const hp=g.player.hp;g.player.dash=.2;g.hurtPlayer(100);assert.equal(g.player.hp,hp);advance(g,1.4);assert.ok(g.player.hp<hp);
});
test('trial requires killing its final boss; endless does not end at twelve minutes',()=>{
  const trial=game({endless:false});trial.time=720;trial.step(.02,{fire:false});const boss=trial.enemies.find(e=>e.final);assert.ok(boss);assert.equal(trial.status,'playing');trial.hurt(boss,1e9);assert.equal(trial.status,'won');
  const endless=game();endless.time=720;endless.step(.02,{fire:false});assert.equal(endless.status,'playing');assert.equal(endless.finalSpawned,false);
});
test('relic chest opens once, gives XP/coins/heal and is removed',()=>{
  const g=game();g.player.hp=50;g.chests.push({x:55.5,z:56,y:0});g.step(.02,{interact:true,fire:false});assert.equal(g.chests.length,0);assert.equal(g.coins,12);assert.equal(g.player.hp,70);assert.equal(g.status,'upgrade');
});
test('saves are independent from mech profiles, sanitized and transactional',()=>{
  const mem=memory();mem.map.set('chitin-zero:v1','DO NOT CHANGE');const s=new S.Store(mem);
  assert.equal(s.save({...s.profile,coins:500,meta:{power:99},hunter:'__proto__'}),true);assert.equal(s.profile.meta.power,5);assert.equal(s.profile.hunter,'mara');assert.equal(mem.map.get('chitin-zero:v1'),'DO NOT CHANGE');
  const before=JSON.stringify(s.profile);s.storage={setItem(){throw Error('quota');}};assert.equal(s.purchase('vitality'),false);assert.equal(JSON.stringify(s.profile),before);
});
test('rewards are idempotent across reloads and require a finished run',()=>{
  const mem=memory(),s=new S.Store(mem),g=game();g.coins=50;g.kills=42;g.time=123;assert.equal(s.reward('run',g),false);g.status='dead';assert.equal(s.reward('run',g),true);
  const next=new S.Store(mem);assert.equal(next.reward('run',g),true);assert.equal(next.profile.coins,50);assert.equal(next.profile.runs,1);assert.equal(next.profile.kills,42);
});
test('meta purchases reject insufficient funds, unknown keys and capped upgrades',()=>{
  const s=new S.Store(memory());assert.equal(s.purchase('power'),false);assert.equal(s.purchase('__proto__'),false);s.save({...s.profile,coins:5000});
  for(let i=0;i<5;i++)assert.equal(s.purchase('power'),true);assert.equal(s.purchase('power'),false);assert.equal(s.profile.coins,4000);
});
test('projection points forward targets at the crosshair for all yaw/pitch quadrants',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const pitch of [-.5,0,.5]){
    const p={x:4,z:6,y:0,yaw,pitch,walk:0},m=R.matrix(p,16/9,true).matrix;
    const v=[p.x+Math.sin(yaw)*Math.cos(pitch)*10,1.6+Math.sin(pitch)*10,p.z-Math.cos(yaw)*Math.cos(pitch)*10,1];
    const q=[0,1,2,3].map(r=>v.reduce((s,n,c)=>s+n*m[c*4+r],0));assert.ok(Math.abs(q[0]/q[3])<1e-6);assert.ok(Math.abs(q[1]/q[3])<1e-6);assert.ok(q[3]>0);
  }
});
test('world and enemy meshes contain only finite complete triangles',()=>{
  for(const arena of Object.keys(D.arenas)){
    const g=game({arena});for(const type of Object.keys(D.enemies))g.spawn(type,55.5,45);
    for(const mesh of [R.arenaMesh(g.map),R.dynamicMesh(g)]){assert.equal(mesh.data.length%27,0);assert.ok(mesh.data.length>0);assert.ok(mesh.data.every(Number.isFinite));}
  }
});
test('five-minute moving full-build soak keeps state finite and collections bounded',()=>{
  const g=new C.Game({seed:19});g.player.weapons=Object.keys(D.weapons).map(id=>({id,level:6,cooldown:0,flash:0}));
  for(let i=0;i<6000;i++){
    g.player.hp=g.player.maxHp;g.player.invulnerable=1;
    if(g.status==='upgrade')g.choose(0);
    g.step(.05,{forward:1,side:.5,yaw:i*.007,fire:true});
  }
  assert.ok(g.time>280);assert.ok([g.player.x,g.player.z,g.player.hp,g.time].every(Number.isFinite));
  for(const [key,limit] of Object.entries(D.LIMITS))assert.ok(g[key].length<=limit,`${key} cap`);
  assert.ok(g.hostile.length<=100);assert.ok(g.chests.length<=5);assert.equal(g.map.blocked(g.player.x,g.player.z,g.player.radius),false);
});
