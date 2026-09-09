const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=file=>fs.readFileSync(`${__dirname}/${file}`,'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function assets(){
  const images=[],timers=new Map();let timerId=0;
  class Image {
    constructor(){images.push(this);this.complete=false;this.naturalWidth=0;}
    decode(){return this.decoding||Promise.resolve();}
    done(){this.complete=true;this.naturalWidth=128;this.onload?.();}
  }
  const scope=vm.createContext({window:{},Image,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(read('game-assets.js'),scope);
  return {A:scope.window.GameAssets,scope,images,timers};
}
test('all 60 assets preload once, report real progress and wait for decoding',async()=>{
  const {A,images,timers}=assets(),updates=[];let decode,finished=false;
  images[0].decoding=new Promise(resolve=>{decode=resolve;});
  const pending=A.preload({onProgress:p=>updates.push(p.loaded)}).then(r=>{finished=true;return r;});
  const second=A.preload();assert.equal(images.length,60);
  images.forEach(image=>image.done());await flush();assert.equal(A.progress().loaded,59);assert.equal(finished,false);
  decode();const result=await pending;await second;
  assert.equal(result.loaded,60);assert.equal(result.failed,0);assert.equal(timers.size,0);
  assert.equal(updates[0],0);assert.equal(updates.at(-1),60);
  assert.ok(updates.every((value,i)=>i===0||value>=updates[i-1]));
  await A.preload();assert.equal(images.length,60,'cache must be reused on repeated calls');
});
test('failed images settle without hanging and retry only requests failed assets',async()=>{
  const {A,images}=assets();const pending=A.preload();
  images[0].onerror();images.slice(1).forEach(image=>image.done());
  const failed=await pending;assert.equal(failed.failed,1);assert.equal(failed.loaded,59);assert.match(failed.failures[0],/player/);
  const retry=A.preload({retry:true});assert.equal(images.length,61);assert.equal(A.progress().loaded,59);
  images[60].done();const result=await retry;assert.equal(result.failed,0);assert.equal(result.loaded,60);assert.equal(A.failures.length,0);
});
test('timeout covers stalled downloads and decode promises; late results cannot corrupt a retry',async()=>{
  const {A,images,timers}=assets();let decode;
  images[0].decoding=new Promise(resolve=>{decode=resolve;});images[0].done();
  const pending=A.preload();for(const fn of [...timers.values()])fn();
  assert.equal((await pending).failed,60);assert.equal(timers.size,0);
  const retry=A.preload({retry:true});images.slice(60).forEach(image=>image.done());await retry;decode();await flush();
  assert.equal(A.progress().loaded,60);assert.equal(A.progress().failed,0);
});
test('decode rejection is reported and failed images use fallback rendering',async()=>{
  const {A,images}=assets();images[0].decoding=Promise.reject(new Error('corrupt'));
  const pending=A.preload();images.forEach(image=>image.done());const result=await pending;
  assert.equal(result.failed,1);assert.equal(A.sprite({},'actors/player',0,0,42,42),false);
});
test('load works without decode and ignores observer exceptions after subscription',async()=>{
  const {A,images}=assets();let first=true;
  const pending=A.preload({onProgress(){if(first){first=false;return;}throw new Error('observer');}});
  images.forEach(image=>{image.decode=undefined;image.done();});assert.equal((await pending).loaded,60);
});
function ui(){
  const base=assets(),nodes=new Map();
  function get(id){if(!nodes.has(id))nodes.set(id,{hidden:false,inert:id==='game-shell',textContent:'',children:[],attributes:{},handlers:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},focus(){this.focused=true;},addEventListener(k,fn){this.handlers[k]=fn;}});return nodes.get(id);}
  const classes=new Set(['assets-loading']);
  base.scope.document={getElementById:get,createElement:()=>({textContent:''}),body:{classList:{remove:c=>classes.delete(c)}}};
  vm.runInContext(read('asset-loading.js'),base.scope);
  return {...base,get,classes,boot:base.scope.window.AssetBoot};
}
test('boot blocks the game until every asset is ready, then focuses menu without an artificial delay',async()=>{
  const {images,get,boot,classes}=ui();assert.equal(boot.ready,false);assert.equal(get('game-shell').inert,true);
  images.slice(1).forEach(image=>image.done());await flush();assert.equal(boot.ready,false);
  images[0].done();await flush();assert.equal(boot.ready,true);assert.equal(get('asset-loading').hidden,true);
  assert.equal(get('game-shell').inert,false);assert.equal(get('loading-progress').value,100);
  assert.ok(get('enter-hideout').focused);assert.ok(!classes.has('assets-loading'));
});
test('boot errors stay blocked until retry succeeds; double retry clicks do not duplicate requests',async()=>{
  const {images,get,boot}=ui();images[0].onerror();images.slice(1).forEach(image=>image.done());await flush();
  assert.equal(boot.ready,false);assert.equal(get('loading-retry').hidden,false);assert.equal(get('loading-errors').hidden,false);
  assert.equal(get('loading-error-list').children.length,1);
  get('loading-retry').handlers.click();get('loading-retry').handlers.click();assert.equal(images.length,61);
  get('loading-continue').handlers.click();assert.equal(boot.ready,false,'skip must not bypass an active retry');
  images[60].done();await flush();assert.equal(boot.ready,true);
});
test('degraded graphics require an explicit choice after the loading attempt finishes',async()=>{
  const {images,get,boot}=ui();get('loading-continue').handlers.click();assert.equal(boot.ready,false);
  images.forEach(image=>image.onerror());await flush();assert.equal(boot.ready,false);
  get('loading-continue').handlers.click();assert.equal(boot.ready,true);assert.equal(get('game-shell').inert,false);
});
test('initial HTML blocks mouse and keyboard interaction and starts the boot controller after game setup',()=>{
  const html=read('index.html');assert.match(html,/<main[^>]+id="game-shell"[^>]+inert/);
  assert.match(html,/id="asset-loading"/);assert.ok(html.indexOf('src="asset-loading.js"')>html.indexOf('src="script.js"'));
  const script=read('script.js');const last=script.slice(script.lastIndexOf('  function beginRun()'));
  assert.match(last,/function beginRun\(\) \{\s*if \(window.AssetBoot && !window.AssetBoot.ready\) return;/);
});
