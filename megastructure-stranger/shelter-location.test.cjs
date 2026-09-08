const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(ui=false){
  const frames=new Map(),nodes=new Map();let frameId=0;
  const drawing=new Proxy({}, {get(target,key){return target[key]||(()=>{});}});
  drawing.createRadialGradient=()=>({addColorStop(){}});
  function get(id){if(!nodes.has(id))nodes.set(id,{id,handlers:{},children:[],dataset:{},open:false,textContent:'',getContext:()=>drawing,addEventListener(type,handler){this.handlers[type]=handler;},focus(){},click(){this.clicked=true;this.handlers.click?.();},showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();}});return nodes.get(id);}
  const scope=vm.createContext({window:{addEventListener(){},requestAnimationFrame(callback){frames.set(++frameId,callback);return frameId;},cancelAnimationFrame(id){frames.delete(id);}},...(ui?{document:{getElementById:get}}:{})});
  for(const file of ['hideout-upgrades.js','shelter-location.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),scope);
  function frame(time){const entry=frames.entries().next().value;assert.ok(entry);frames.delete(entry[0]);entry[1](time);}
  return {api:scope.window.ShelterLocation,get,frames,frame};
}
test('mini-location has five facility sites, research table and four services',()=>{
  const {api}=load();assert.equal(api.points.length,10);
  for(const point of api.points){const apron={x:point.x,y:point.y+(point.y<250?65:-65)};assert.equal(api.nearest(apron).id,point.id);}
  assert.equal(api.nearest({x:470,y:250}),undefined);
});
test('movement normalizes diagonals and respects the outer walls',()=>{
  const {api}=load();const p={x:450,y:240},q={...p};
  api.move(p,new Set(['KeyD']),.05,{});api.move(q,new Set(['KeyD','KeyW']),.05,{});
  assert.ok(Math.abs(Math.hypot(p.x-450,p.y-240)-Math.hypot(q.x-450,q.y-240))<.001);
  for(let i=0;i<300;i++)api.move(p,new Set(['KeyA']),.05,{});
  assert.equal(p.x,42);
});
test('unbuilt sites are empty; built machinery and storage are solid',()=>{
  const {api}=load();const empty={x:150,y:165},built={...empty};
  for(let i=0;i<10;i++){api.move(empty,new Set(['KeyW']),.05,{});api.move(built,new Set(['KeyW']),.05,{generator:1});}
  assert.ok(empty.y<110);assert.ok(built.y>=149);
  const storage={x:350,y:330};for(let i=0;i<20;i++)api.move(storage,new Set(['KeyS']),.05,{});
  assert.ok(storage.y<=351);
});
test('building while standing on a vacant site cannot trap the player',()=>{
  const {api}=load();const p={x:150,y:110};api.unstick(p,{generator:1});assert.equal(p.y,165);
  api.move(p,new Set(['KeyD']),.05,{generator:1});assert.ok(p.x>150);
});
test('location animation starts once, pauses on exit and never runs in hidden tabs',()=>{
  const {api,frames,frame,get}=load(true);api.refresh({hideout:{}});
  assert.equal(frames.size,0);api.setActive(true);api.setActive(true);assert.equal(frames.size,1);
  frame(100);assert.equal(frames.size,1);assert.match(get('shelter-prompt').textContent,/WASD/);
  api.setActive(false);assert.equal(frames.size,0);
});
test('nearby equipment interaction opens its tab without affecting combat input',()=>{
  const {api,frame,get}=load(true);api.refresh({hideout:{}});api.setActive(true);frame(100);
  const key=code=>get('shelter-canvas').handlers.keydown({code,repeat:false,preventDefault(){},stopPropagation(){}});
  key('KeyD');for(let i=1;i<=8;i++)frame(100+i*50);
  get('shelter-canvas').handlers.blur();key('KeyS');for(let i=9;i<=16;i++)frame(100+i*50);
  get('shelter-canvas').handlers.blur();key('KeyE');assert.equal(get('tab-equipment').clicked,true);
});
test('facility terminal selects one station, refreshes and closes when leaving shelter',()=>{
  const {api,frame,get}=load(true);
  get('hideout-facilities').children=['generator','battery','solder','mill','forming'].map(facility=>({dataset:{facility}}));
  api.refresh({hideout:{}});api.setActive(true);frame(100);
  const key=code=>get('shelter-canvas').handlers.keydown({code,repeat:false,preventDefault(){},stopPropagation(){}});
  key('KeyA');for(let i=1;i<=13;i++)frame(100+i*50);
  get('shelter-canvas').handlers.blur();key('KeyW');for(let i=14;i<=20;i++)frame(100+i*50);
  get('shelter-canvas').handlers.blur();key('KeyE');
  assert.equal(get('shelter-console').open,true);
  assert.equal(get('shelter-console-title').textContent,'Аккумуляторы');
  assert.equal(get('hideout-facilities').children.filter(card=>!card.hidden).length,1);
  api.refresh({hideout:{generator:1,battery:1}});
  assert.equal(get('hideout-facilities').children.find(card=>!card.hidden).dataset.facility,'battery');
  api.setActive(false);assert.equal(get('shelter-console').open,false);
});
