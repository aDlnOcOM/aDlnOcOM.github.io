const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(files,scope={window:{}}){vm.createContext(scope);for(const file of files)vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),scope);return scope;}
test('all 59 vector assets and the generated PNG exist, with no external SVG dependencies',()=>{
  const {window:{GameAssets:A}}=load(['game-assets.js']);assert.equal(A.paths.length,59);
  for(const path of A.paths){const content=fs.readFileSync(`${__dirname}/assets/${path}.svg`,'utf8');assert.match(content,/<svg /);assert.doesNotMatch(content,/<script|<foreignObject|href=/);}
  assert.equal(fs.readFileSync(`${__dirname}/assets/maintenance-floor.png`).subarray(1,4).toString(),'PNG');
});
test('sprite loader fails safely and draws loaded images without modifying collisions',()=>{
  const images=[];class FakeImage {constructor(){images.push(this);this.complete=false;this.naturalWidth=0;}}
  const {window:{GameAssets:A}}=load(['game-assets.js'],{window:{},Image:FakeImage});
  assert.equal(A.sprite({},'actors/player',0,0,42,42),false);
  const calls=[],ctx={save(){},restore(){},translate(){},rotate(){},drawImage(...args){calls.push(args);}};
  images[0].complete=true;images[0].naturalWidth=128;assert.equal(A.sprite(ctx,'actors/player',2,3,42,42),true);assert.equal(calls.length,1);
  images[1].onerror();assert.equal(A.failures.length,1);
});
test('campaign has a bounded length, every district, reasonable guard speeds and 6–12h pacing model',()=>{
  const {window:{Campaign:C,SectorGenerator:S}}=load(['campaign.js','sectors.js']);
  assert.equal(C.floors,24);assert.equal(C.route.length,24);
  assert.deepEqual([...new Set(C.route)].sort(),Array.from(S.types,x=>x.id).sort());
  for(let floor=1;floor<=24;floor++){assert.ok(C.length(floor)<=1.81);assert.ok(C.difficulty(floor).speed<=1.3);}
  const fast=C.estimate({sectorMinutes:1,bossMinutes:2,hubMinutes:2,retryRate:.05});
  const slow=C.estimate({sectorMinutes:1.4,bossMinutes:3,hubMinutes:3,retryRate:.4});
  assert.ok(fast>=6&&fast<7);assert.ok(slow>11&&slow<=12);assert.ok(C.estimate()>fast&&C.estimate()<slow);
});
test('checkpoint progress is persistent and unlocked after each third boss',()=>{
  const {window:{Campaign:C}}=load(['campaign.js']);const p={};assert.equal(C.start(p),1);
  C.record(p,2);assert.equal(C.start(p),1);C.record(p,3);assert.equal(C.start(p),4);
  const copy=JSON.parse(JSON.stringify(p));assert.equal(C.start(copy),4);
  C.record(copy,24);assert.equal(C.start(copy),24);copy.campaign.completed=true;assert.equal(C.start(copy),1);
});
test('live floor generation uses campaign sizing and final elevator completes rather than making floor 25',()=>{
  const node=()=>({style:{},dataset:{},width:960,height:600,hidden:false,getContext:()=>({}),addEventListener(){},appendChild(){}});
  const scope={window:{addEventListener(){},requestAnimationFrame(){}},document:{getElementById:node,createElement:node},performance:{now:()=>0},localStorage:{getItem:()=>null,setItem(){}}};
  load(['equipment.js','sectors.js','loot-containers.js','security-ai.js','perception.js','campaign.js'],scope);
  vm.runInContext(fs.readFileSync(`${__dirname}/script.js`,'utf8').replace(/\}\)\(\);\s*$/,'hideOverlay=()=>{};updateHome=()=>{};window.test={state,createLongFloor,tryInteract,get:()=>progression};})();'),scope);
  const g=scope.window.test;g.state.runSectorCount=11;
  for(const floor of [1,6,12,24]){g.state.floor=floor;const map=g.createLongFloor(floor);assert.ok(map.bodyLength<20000);assert.equal(map.sectors[0].id,scope.window.Campaign.route[floor-1]);}
  g.state.floor=24;g.state.active=true;g.state.runActive=true;g.state.player={x:1000,y:300,health:100};g.state.floorMap={containers:[],bossStarted:true,bossDefeated:true,exitGate:{x:900}};
  g.tryInteract();assert.equal(g.get().campaign.completed,true);assert.equal(g.state.runActive,false);assert.equal(g.state.floor,24);
});
test('removed briefing no longer leaves dangling title and stat lookups',()=>{
  const html=fs.readFileSync(`${__dirname}/index.html`,'utf8');const script=fs.readFileSync(`${__dirname}/script.js`,'utf8');
  assert.doesNotMatch(html,/id="home-title"|id="salvage-count"|id="best-floor"/);
  assert.doesNotMatch(script,/element\("(?:salvage-count|best-floor)"\)/);
});
