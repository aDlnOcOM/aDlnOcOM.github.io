const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scripts=['td-number.js','td-data.js','td-core.js','td-storage.js','td-render.js','td-app.js'];
function harness({saved=null,blockedStorage=false,noCanvas=false,width=1000,height=640}={}){
  const nodes=new Map(),allStatic=[],docEvents={},winEvents={},callbacks=[],memory=new Map(),drawCalls=[];let document,now=1000000,writes=0;
  const emit=(events,type,event={})=>{for(const fn of events[type]||[])fn({preventDefault(){},...event});};
  const context2d=new Proxy({}, {get:(t,k)=>{
    if(['moveTo','lineTo','fillRect','strokeRect','arc','translate','rotate','scale','setTransform','rect'].includes(k))return(...args)=>{assert.ok(args.filter(a=>typeof a==='number').every(Number.isFinite),`${k} finite`);if(k==='arc')assert.ok(args[2]>=0);drawCalls.push(k);};
    if(k==='drawImage')return()=>assert.fail('TD must not render raster sprites');
    return t[k]||(()=>{});
  },set:(t,k,v)=>{t[k]=v;return true;}});
  class Element{
    constructor(id='',tag='DIV'){this.id=id;this.tagName=tag;this.dataset={};this.style={};this.listeners={};this.children=[];this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.value='';this.attrs={};this.classList={toggle:(key,value)=>this.attrs[key]=value};}
    set innerHTML(html){this.html=html;this.children=[];for(const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){const b=new Element('','BUTTON');b.disabled=/\bdisabled\b/.test(m[1]);b.textContent=m[2];for(const d of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[d[1]]=d[2];this.children.push(b);}}
    get innerHTML(){return this.html||'';}
    closest(tag){return tag==='button'&&this.tagName==='BUTTON'?this:null;}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    setAttribute(key,value){this.attrs[key]=value;}
    focus(){document.activeElement=this;}
    querySelectorAll(){return this.children.filter(b=>!b.disabled);}
    querySelector(selector){const match=selector.match(/\[data-([\w-]+)="([^"]+)"\]/);return match?this.children.find(b=>b.dataset[match[1]]===match[2]):this.querySelectorAll()[0];}
    getBoundingClientRect(){return{left:10,top:20,width,height};}
    getContext(type){assert.equal(type,'2d','vector-only rendering context');return noCanvas?null:context2d;}
  }
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  for(const m of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const n=new Element(m[2],m[1].toUpperCase());n.hidden=/\bhidden\b/.test(m[0]);nodes.set(n.id,n);}
  for(const m of html.matchAll(/<button\b([^>]*)>/g)){const b=new Element('','BUTTON');for(const d of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[d[1]]=d[2];if(Object.keys(b.dataset).length)allStatic.push(b);}
  document={activeElement:null,hidden:false,getElementById(id){assert.ok(nodes.has(id),`DOM ${id}`);return nodes.get(id);},addEventListener(type,fn){(docEvents[type]||=[]).push(fn);},querySelectorAll(selector){const key=selector.match(/data-([\w-]+)/)[1];return allStatic.filter(b=>b.dataset[key]!==undefined);}};
  if(saved)memory.set('neon-bastion:v1',JSON.stringify(saved));
  const context=vm.createContext({document,devicePixelRatio:1,Date:class extends Date{static now(){return now;}},matchMedia:()=>({matches:false}),
    localStorage:{getItem:k=>memory.get(k),setItem(k,v){writes++;if(blockedStorage)throw Error('blocked');memory.set(k,v);}},
    requestAnimationFrame:fn=>callbacks.push(fn),addEventListener(type,fn){(winEvents[type]||=[]).push(fn);}});
  for(const script of scripts){if(script==='td-app.js'){const Original=context.TDCore.Game;context.TDCore.Game=class extends Original{constructor(saved){super(saved);context.game=this;}};}
    vm.runInContext(fs.readFileSync(path.join(__dirname,script),'utf8'),context,{filename:script});}
  function click(b){assert.ok(b);emit(docEvents,'click',{target:b});}
  return{nodes,context,memory,drawCalls,document,get writes(){return writes;},advanceTime(ms){now+=ms;},
    frame(stamp){const fn=callbacks.shift();assert.ok(fn);fn(stamp);},click:id=>click(nodes.get(id)),
    button(container,key,value){const b=(container?nodes.get(container).children:allStatic).find(b=>b.dataset[key]===String(value));assert.ok(b,`button ${container} ${key}=${value}`);click(b);},
    key(code,event={}){emit(docEvents,'keydown',{code,...event});},doc(type,event){emit(docEvents,type,event);},win(type,event){emit(winEvents,type,event);},element(id,type,event){emit(nodes.get(id).listeners,type,event);}
  };
}
test('active entrypoint loads only vector TD modules and has no raster/WebGL dependencies',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.deepEqual([...html.matchAll(/<script defer src="([^"]+)"/g)].map(m=>m[1]),scripts);
  assert.doesNotMatch(html,/<img|hunt-|cockpit|webgl/i);assert.ok(fs.existsSync(path.join(__dirname,'mech.html')));assert.ok(fs.existsSync(path.join(__dirname,'hunters.html')));
});
test('application boots, renders real vector paths and activates autonomous combat',()=>{
  const h=harness();assert.equal(h.context.game.started,false);h.click('run-toggle');h.frame(0);for(let i=1;i<40;i++)h.frame(i*100);assert.equal(h.context.game.started,true);assert.ok(h.context.game.time>0);assert.ok(h.drawCalls.length>100);assert.ok(h.memory.has('neon-bastion:v1'));
});
test('canvas-unavailable error stays visible and prevents activation',()=>{
  const h=harness({noCanvas:true});assert.equal(h.nodes.get('run-toggle').disabled,true);assert.match(h.nodes.get('event').textContent,/графику/);h.click('run-toggle');assert.equal(h.context.game.started,false);
});
test('blueprint selection, pad selection and manual build/upgrade complete through UI',()=>{
  const h=harness();h.button('catalog','blueprint','arc');assert.match(h.nodes.get('panel').innerHTML,/ДУГА/);h.button('panel','action','build');assert.equal(h.context.game.towers[1].type,'arc');
  const before=h.context.game.towers[1].level;h.button('panel','action','upgrade');assert.equal(h.context.game.towers[1].level,before+1);
});
test('vector-map hit testing selects the matching logical pad after scale/offset conversion',()=>{
  const h=harness({width:500,height:320});h.element('field','click',{clientX:10+130*.5,clientY:20+365*.5});assert.match(h.nodes.get('panel').innerHTML,/УЗЕЛ 03/);
});
test('keyboard navigation, build/upgrade and speed shortcuts work when board is focused',()=>{
  const h=harness();h.nodes.get('field').focus();h.key('ArrowRight');h.key('KeyB');assert.equal(h.context.game.towers[1].type,'pulse');h.key('KeyU');assert.equal(h.context.game.towers[1].level,2);h.key('Digit4');assert.equal(h.context.game.speed,4);h.key('Space');assert.equal(h.context.game.started,true);
});
test('pause freezes all simulation state and speed buttons apply 1x/2x/4x',()=>{
  const h=harness();h.click('run-toggle');h.frame(0);h.frame(100);h.click('run-toggle');const time=h.context.game.time;h.frame(200);h.frame(300);assert.equal(h.context.game.time,time);h.button(null,'speed',4);h.click('run-toggle');h.frame(400);h.frame(500);assert.ok(h.context.game.time>=time+.39);
});
test('automation switches persist and stop automatic purchases',()=>{
  const h=harness();for(const id of ['build','upgrade','evolve']){h.nodes.get('auto-'+id).checked=false;h.element('auto-'+id,'change');}h.click('run-toggle');h.frame(0);for(let i=1;i<20;i++)h.frame(i*100);assert.equal(h.context.game.towers.filter(Boolean).length,1);assert.equal(h.context.game.towers[0].level,1);assert.equal(JSON.parse(h.memory.get('neon-bastion:v1')).game.auto.build,false);
});
test('synthesis tab explains active combinations and node shows both evolution requirements',()=>{
  const h=harness();h.button(null,'tab','combos');assert.match(h.nodes.get('panel').innerHTML,/СВЕРХПРОВОДНИК/);assert.match(h.nodes.get('panel').innerHTML,/ТЕРМОШОК/);h.button(null,'tab','node');assert.match(h.nodes.get('panel').innerHTML,/ШТОРМ/);assert.match(h.nodes.get('panel').innerHTML,/LV 10/);
});
test('evolution branch is selected through UI and persists',()=>{
  const h=harness(),g=h.context.game,N=h.context.TDNumber;g.credits=N.from(1e6);g.build(1,'arc');g.upgrade(0,9);g.upgrade(1,4);h.button(null,'tab','node');h.button('panel','evolve','storm');assert.equal(g.towers[0].evolution,'storm');assert.equal(JSON.parse(h.memory.get('neon-bastion:v1')).game.towers[0].evolution,'storm');
});
test('research purchases spend cores and update actual gameplay stats',()=>{
  const h=harness(),g=h.context.game;g.cores=h.context.TDNumber.from(20);h.button(null,'tab','research');h.button('panel','research','damage');assert.equal(g.research.damage,1);assert.ok(g.stats(g.towers[0]).damage.number()>12);assert.match(h.nodes.get('panel').innerHTML,/LV 1/);
});
test('selling requires confirmation; cancel leaves tower and wallet unchanged',()=>{
  const h=harness(),g=h.context.game;const before=g.credits.log;h.button('panel','action','sell');assert.equal(h.nodes.get('dialog').hidden,false);h.button('dialog-actions','action','close');assert.ok(g.towers[0]);assert.equal(g.credits.log,before);h.button('panel','action','sell');h.button('dialog-actions','action','sell-confirm');assert.equal(g.towers[0],null);assert.ok(g.credits.log>before);
});
test('prestige requires confirmation and keeps permanent progress',()=>{
  const h=harness(),g=h.context.game;g.cycleBest=30;g.best=30;g.research.damage=3;h.click('prestige');assert.match(h.nodes.get('dialog-body').innerHTML,/сбросятся/);h.button('dialog-actions','action','prestige-confirm');assert.equal(g.cycleBest,0);assert.equal(g.prestiges,1);assert.equal(g.research.damage,3);assert.equal(g.started,true);
});
test('help dialog pauses and restores prior paused state, including mobile access',()=>{
  const h=harness();h.click('run-toggle');h.click('help-mobile');assert.equal(h.context.game.paused,true);h.key('Escape');assert.equal(h.context.game.paused,false);h.click('run-toggle');h.click('help');h.button('dialog-actions','action','close');assert.equal(h.context.game.paused,true);
});
test('hidden tab does not simulate waves and grants only production on return',()=>{
  const h=harness();h.click('run-toggle');h.frame(0);const g=h.context.game,time=g.time,before=g.credits.number();h.document.hidden=true;h.doc('visibilitychange');h.advanceTime(60000);h.frame(100);assert.equal(g.time,time);h.document.hidden=false;h.doc('visibilitychange');assert.ok(g.credits.number()>=before+89.9);assert.equal(g.wave,1);assert.equal(h.nodes.get('dialog').hidden,false);assert.match(h.nodes.get('dialog-body').innerHTML,/Волны не проходили/);
});
test('offline award is persisted before display and reload cannot replay it',()=>{
  const Game=require('./td-core.js').Game,g=new Game();g.start();const h=harness({saved:{savedAt:1000000-3600000,game:g.serialize()}});assert.match(h.nodes.get('dialog-title').textContent,/возвращением/);const persisted=JSON.parse(h.memory.get('neon-bastion:v1'));assert.equal(persisted.savedAt,1000000);assert.ok(h.context.game.credits.number()>5000);
});
test('failed autosave is visible and retried at bounded intervals, not every animation frame',()=>{
  const h=harness({blockedStorage:true});assert.match(h.nodes.get('save-state').textContent,/только в памяти/);const before=h.writes;for(let i=0;i<20;i++){h.advanceTime(100);h.frame(i*100);}assert.equal(h.writes,before);h.advanceTime(5000);h.frame(2200);assert.equal(h.writes,before+1);
});
test('huge late-game numbers and narrow layouts produce only finite vector coordinates',()=>{
  for(const [width,height]of [[360,230],[1280,720]]){const h=harness({width,height}),g=h.context.game;g.towers[0].level=100000;g.credits=h.context.TDNumber.power(10,10000);h.frame(0);h.frame(250);h.frame(350);assert.ok(h.drawCalls.length>0);assert.equal(h.nodes.get('credits').textContent,'1.00e10000');}
});
