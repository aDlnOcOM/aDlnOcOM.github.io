const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scripts=['td-number.js','td-data.js','td-core.js','td-render.js','field-data.js','field-core.js','field-storage.js','field-render.js','field-app.js'];
function harness({saved=null,blockedStorage=false,noCanvas=false,width=1000,height=640,viewportWidth=Infinity,viewportHeight=Infinity}={}){
  const nodes=new Map(),allStatic=[],docEvents={},winEvents={},callbacks=[],memory=new Map(),drawCalls=[];let document,now=1000000,writes=0;
  const emit=(events,type,event={})=>{for(const fn of events[type]||[])fn({preventDefault(){},...event});};
  const context2d=new Proxy({}, {get:(t,k)=>{
    if(['moveTo','lineTo','fillRect','strokeRect','arc','translate','rotate','scale','setTransform','rect'].includes(k))return(...args)=>{assert.ok(args.filter(a=>typeof a==='number').every(Number.isFinite),`${k} finite`);if(k==='arc')assert.ok(args[2]>=0);drawCalls.push(k);};
    if(k==='drawImage')return()=>assert.fail('TD must not render raster sprites');
    return t[k]||(()=>{});
  },set:(t,k,v)=>{t[k]=v;return true;}});
  class Element{
    constructor(id='',tag='DIV'){this.id=id;this.tagName=tag;this.dataset={};this.style={};this.listeners={};this.children=[];this.hidden=false;this.isConnected=true;this.disabled=false;this.checked=false;this.textContent='';this.value='';this.attrs={};this.classList={toggle:(key,value)=>this.attrs[key]=value};}
    set innerHTML(html){this.html=html;for(const child of this.children)child.isConnected=false;this.children=[];for(const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){const b=new Element('','BUTTON');b.disabled=/\bdisabled\b/.test(m[1]);b.textContent=m[2];for(const d of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[d[1]]=d[2];this.children.push(b);}}
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
  if(saved)memory.set('neon-bastion:field:v1',JSON.stringify(saved));
  const context=vm.createContext({document,innerWidth:viewportWidth,innerHeight:viewportHeight,devicePixelRatio:1,Date:class extends Date{static now(){return now;}},matchMedia:()=>({matches:false}),
    localStorage:{getItem:k=>memory.get(k),setItem(k,v){writes++;if(blockedStorage)throw Error('blocked');memory.set(k,v);}},
    requestAnimationFrame:fn=>callbacks.push(fn),addEventListener(type,fn){(winEvents[type]||=[]).push(fn);}});
  for(const script of scripts){if(script==='field-app.js'){const Original=context.FieldCore.Game;context.FieldCore.Game=class extends Original{constructor(saved){super(saved);context.game=this;}};}
    vm.runInContext(fs.readFileSync(path.join(__dirname,script),'utf8'),context,{filename:script});}
  function click(b){assert.ok(b);emit(docEvents,'click',{target:b});}
  return{nodes,context,memory,drawCalls,document,get writes(){return writes;},advanceTime(ms){now+=ms;},
    frame(stamp){const fn=callbacks.shift();assert.ok(fn);fn(stamp);},click:id=>click(nodes.get(id)),
    button(container,key,value){const b=(container?nodes.get(container).children:allStatic).find(b=>b.dataset[key]===String(value));assert.ok(b,`button ${container} ${key}=${value}`);click(b);},
    key(code,event={}){emit(docEvents,'keydown',{code,...event});},doc(type,event){emit(docEvents,type,event);},win(type,event){emit(winEvents,type,event);},element(id,type,event){emit(nodes.get(id).listeners,type,event);}
  };
}
test('field entrypoint starts with one powered turret and renders vector-only combat',()=>{
  const h=harness(),g=h.context.game;assert.equal(g.buildings.size,2);assert.equal(g.tower('1,0').powered,true);h.click('run-toggle');h.frame(0);for(let i=1;i<60;i++)h.frame(i*100);assert.ok(g.time>0);assert.ok(h.drawCalls.length>200);assert.equal(g.started,true);assert.match(h.nodes.get('power').textContent,/12/);
});
test('coordinates and selected blueprint build a network without automatic type selection',()=>{
  const h=harness(),g=h.context.game;h.nodes.get('cell-x').value='3';h.nodes.get('cell-y').value='0';h.element('cell-form','submit');h.button('catalog','blueprint','pylon');h.button('panel','action','build');assert.equal(g.tower('3,0').connected,true);
  h.nodes.get('cell-x').value='4';h.element('cell-form','submit');h.button('catalog','blueprint','generator');h.button('panel','action','build');assert.equal(g.network.capacity,36);assert.equal(g.tower('4,0').powered,true);
});
test('malformed coordinates produce textual errors without changing selection',()=>{
  const h=harness();h.nodes.get('cell-x').value='1.5';h.element('cell-form','submit');assert.equal(h.context.game.selected,'1,0');assert.equal(h.nodes.get('cell-x').attrs['aria-invalid'],'true');assert.match(h.nodes.get('cell-error').textContent,/целые/);
});
test('keyboard commands are scoped to the map and move through negative cells',()=>{
  const h=harness();h.key('ArrowLeft');assert.equal(h.context.game.selected,'1,0');h.nodes.get('field').focus();h.key('ArrowLeft');h.key('ArrowLeft');assert.equal(h.context.game.selected,'-1,0');h.key('KeyB');assert.equal(h.context.game.tower('-1,0').type,'pulse');
});
test('map drag moves camera without accidentally selecting or building',()=>{
  const h=harness(),before=h.context.game.selected;h.element('field','pointerdown',{button:0,clientX:200,clientY:200,pointerId:1});h.element('field','pointermove',{clientX:320,clientY:260});h.element('field','pointerup');h.element('field','click',{clientX:320,clientY:260});assert.equal(h.context.game.camera.x,-120);assert.equal(h.context.game.camera.y,-60);assert.equal(h.context.game.selected,before);assert.equal(h.context.game.buildings.size,2);h.click('camera-core');assert.equal(h.context.game.camera.x,0);
});
test('building health and no-power reasons are shown in the selected panel',()=>{
  const h=harness(),g=h.context.game;g.credits=h.context.TDNumber.from(1000);g.build('6,0','rail');h.nodes.get('cell-x').value='6';h.nodes.get('cell-y').value='0';h.element('cell-form','submit');assert.match(h.nodes.get('panel').innerHTML,/Нет связи/);assert.match(h.nodes.get('panel').innerHTML,/120/);assert.match(h.nodes.get('power-warning').textContent,/без связи: 1/);
});
test('manual upgrades, energy priority, and permanent automation controls work',()=>{
  const h=harness(),g=h.context.game;h.button('panel','action','upgrade');assert.equal(g.tower('1,0').level,2);h.button('panel','priority','2');assert.equal(g.tower('1,0').priority,2);assert.equal(h.nodes.get('auto-upgrade').disabled,true);
  g.cores=h.context.TDNumber.from(10);h.button(null,'tab','research');h.button('panel','research','autoUpgrade');assert.equal(h.nodes.get('auto-upgrade').disabled,false);assert.equal(h.nodes.get('auto-upgrade').checked,false);
});
test('demolition confirms loss and modal returns keyboard focus',()=>{
  const h=harness(),g=h.context.game;h.nodes.get('help').focus();h.click('help');assert.equal(h.nodes.get('app').inert,true);h.key('Escape');assert.equal(h.document.activeElement,h.nodes.get('help'));assert.equal(h.nodes.get('app').inert,false);h.button('panel','action','sell');h.button('dialog-actions','action','close');assert.ok(g.tower('1,0'));h.button('panel','action','sell');h.button('dialog-actions','action','sell-confirm');assert.equal(g.tower('1,0'),null);
});
test('hidden tab stops damage and records offline production once',()=>{
  const h=harness();h.click('run-toggle');const g=h.context.game,before=g.credits.number(),hp=g.core.hp.log;h.document.hidden=true;h.doc('visibilitychange');h.advanceTime(60000);h.frame(0);h.document.hidden=false;h.doc('visibilitychange');assert.equal(g.core.hp.log,hp);assert.ok(g.credits.number()>=before+89.9);assert.equal(h.nodes.get('dialog').hidden,false);assert.ok(h.memory.has('neon-bastion:field:v1'));
});
test('graphics and save failures remain visible and do not claim success',()=>{
  const h=harness({noCanvas:true});assert.equal(h.nodes.get('run-toggle').disabled,true);assert.match(h.nodes.get('event').textContent,/графику/);const s=harness({blockedStorage:true});assert.match(s.nodes.get('save-state').textContent,/только в памяти/);
});
test('narrow and distant views retain finite rendering coordinates',()=>{
  const h=harness({width:390,height:250}),g=h.context.game;g.camera={x:-6000000000,y:6000000000};h.frame(0);h.frame(100);assert.ok(h.drawCalls.length>100);assert.doesNotMatch(h.nodes.get('event').textContent,/Ошибка графики/);
});
test('HTML provides labels, skip link and accessible non-canvas construction',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.match(html,/<html lang="ru"/);assert.match(html,/href="#controls"/);assert.match(html,/<label for="cell-x"/);assert.match(html,/id="cell-error" role="alert"/);assert.doesNotMatch(html,/checkpoint-number|segment-next|td-app.js/);assert.ok(fs.existsSync(path.join(__dirname,'route.html')));
});
