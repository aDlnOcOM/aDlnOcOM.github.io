const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scripts=['hunt-data.js','hunt-core.js','hunt-storage.js','audio.js','hunt-render.js','hunt-app.js'];
async function harness({failedImage=false,wrongImage=false,noWebGL=false,blockedStorage=false,lockRejected=false}={}){
  const nodes=new Map(),documentEvents={},windowEvents={},callbacks=[],crops=[],memory=new Map();let document,draws=0;
  const emit=(events,type,event={})=>{for(const fn of events[type]||[])fn({preventDefault(){},...event});};
  const ctx=new Proxy({}, {get:(t,k)=>{
    if(k==='drawImage')return(...args)=>{const [img,x,y,w,h]=args;assert.ok(img);if(args.length===9){assert.ok(args.slice(1).every(Number.isFinite));assert.ok(x>=0&&y>=0&&x+w<=img.naturalWidth&&y+h<=img.naturalHeight);crops.push(args.slice(1,5));}};
    return t[k]||(()=>{});
  },set:(t,k,v)=>{t[k]=v;return true;}});
  const gl=new Proxy({}, {get:(t,k)=>{
    if(k==='getShaderParameter'||k==='getProgramParameter')return()=>true;
    if(k==='createShader'||k==='createProgram'||k==='createBuffer'||k==='getUniformLocation')return()=>({});
    if(k==='getAttribLocation')return()=>0;
    if(k==='bufferData')return(target,data)=>{assert.equal(data.length%27,0);assert.ok(data.every(Number.isFinite));};
    if(k==='uniformMatrix4fv')return(loc,transpose,m)=>assert.ok([...m].every(Number.isFinite));
    if(k==='drawArrays')return()=>draws++;
    if(k.toUpperCase()===k)return 1;
    return()=>{};
  }});
  class Element{
    constructor(id='',tag='DIV'){this.id=id;this.tagName=tag;this.style={};this.dataset={};this.listeners={};this.children=[];this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.textContent='';this.clientWidth=1280;this.clientHeight=800;}
    set innerHTML(value){this.html=value;this.children=[];for(const match of value.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){const b=new Element('','BUTTON');b.disabled=/\bdisabled\b/.test(match[1]);b.textContent=match[2];for(const d of match[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[d[1]]=d[2];this.children.push(b);}}
    get innerHTML(){return this.html||'';}
    closest(tag){return tag==='button'&&this.tagName==='BUTTON'?this:null;}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    focus(){document.activeElement=this;}
    querySelectorAll(){return(this.id==='modal'?[...nodes.get('dialog-body').children,...nodes.get('dialog-actions').children]:this.children).filter(b=>!b.disabled);}
    querySelector(){return this.querySelectorAll()[0]||null;}
    getContext(type){return type==='webgl'?(noWebGL?null:gl):ctx;}
    setPointerCapture(){}
    getBoundingClientRect(){return{left:20,top:500,width:110,height:110};}
    requestPointerLock(){if(lockRejected)return Promise.reject(Error('blocked'));document.pointerLockElement=this;emit(documentEvents,'pointerlockchange');return Promise.resolve();}
  }
  const html=fs.readFileSync(path.join(__dirname,'hunters.html'),'utf8');
  for(const m of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const n=new Element(m[2],m[1].toUpperCase());n.hidden=/\bhidden\b/.test(m[0]);n.disabled=/\bdisabled\b/.test(m[0]);nodes.set(n.id,n);}
  document={getElementById(id){assert.ok(nodes.has(id),`DOM id: ${id}`);return nodes.get(id);},activeElement:null,pointerLockElement:null,hidden:false,
    exitPointerLock(){this.pointerLockElement=null;emit(documentEvents,'pointerlockchange');},addEventListener(type,fn){(documentEvents[type]||=[]).push(fn);}};
  const context=vm.createContext({document,innerWidth:1280,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),
    localStorage:blockedStorage?null:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
    requestAnimationFrame:fn=>callbacks.push(fn),addEventListener(type,fn){(windowEvents[type]||=[]).push(fn);},
    Image:class{set src(value){const png=fs.readFileSync(path.join(__dirname,value));this.naturalWidth=wrongImage?100:png.readUInt32BE(16);this.naturalHeight=png.readUInt32BE(20);queueMicrotask(()=>failedImage?this.onerror():this.onload());}}
  });
  for(const script of scripts){if(script==='hunt-app.js'){const Original=context.HuntCore.Game;context.HuntCore.Game=class extends Original{constructor(options){super(options);context.game=this;}};}
    vm.runInContext(fs.readFileSync(path.join(__dirname,script),'utf8'),context,{filename:script});}
  await new Promise(resolve=>setImmediate(resolve));
  return{nodes,context,memory,crops,get draws(){return draws;},document,
    frame(stamp){const fn=callbacks.shift();assert.ok(fn);fn(stamp);},
    click(id){emit(documentEvents,'click',{target:nodes.get(id)});},
    button(container,key,value){const b=nodes.get(container).children.find(b=>b.dataset[key]===String(value));assert.ok(b,`${container} ${key}=${value}`);emit(documentEvents,'click',{target:b});},
    key(code,repeat=false){emit(documentEvents,'keydown',{code,repeat});},up(code){emit(documentEvents,'keyup',{code});},
    doc(type,event){emit(documentEvents,type,event);},win(type,event){emit(windowEvents,type,event);},element(id,type,event){emit(nodes.get(id).listeners,type,event);}
  };
}
test('new entrypoint loads only hunter modules and preserves a separate mech entrypoint',()=>{
  const html=fs.readFileSync(path.join(__dirname,'hunters.html'),'utf8');assert.deepEqual([...html.matchAll(/<script defer src="([^"]+)"/g)].map(m=>m[1]),scripts);
  for(const name of [...scripts,'hunt.css','mech.html'])assert.ok(fs.existsSync(path.join(__dirname,name)));
  assert.match(fs.readFileSync(path.join(__dirname,'mech.html'),'utf8'),/src="sprites.js"/);
});
test('preload validates both real PNG atlases, starts run and draws sprites over WebGL geometry',async()=>{
  const h=await harness();assert.equal(h.nodes.get('start').disabled,false);h.click('start');assert.equal(h.nodes.get('menu').hidden,true);assert.equal(h.nodes.get('hud').hidden,false);
  h.frame(100);h.frame(150);h.frame(200);assert.ok(h.context.game.time>0);assert.ok(h.draws>0);assert.ok(h.crops.length>0);
});
test('asset errors, malformed sheets and unavailable WebGL each block deployment visibly',async()=>{
  for(const config of [{failedImage:true},{wrongImage:true},{noWebGL:true}]){const h=await harness(config);assert.equal(h.nodes.get('start').disabled,true);assert.equal(h.nodes.get('retry-assets').hidden,false);assert.match(h.nodes.get('load-status').textContent,/Ошибка/);h.click('start');assert.equal(h.nodes.get('hud').hidden,true);}
});
test('every hunter and arena can be selected before deployment',async()=>{
  const h=await harness();h.button('hunters','hunter','elias');h.button('arenas','arena','abbey');h.click('start');assert.equal(h.context.game.hunter,'elias');assert.equal(h.context.game.map.kind,'abbey');assert.equal(h.context.game.player.weapons[0].id,'tesla');
});
test('keyboard movement, view, jump and auto-fire toggle reach the simulation',async()=>{
  const h=await harness();h.click('start');h.frame(100);h.key('KeyW');h.key('ArrowRight');h.key('Space');h.key('KeyF');h.frame(180);
  const p=h.context.game.player;assert.ok(p.z<55.5);assert.ok(p.y>0);assert.ok(p.yaw>0);assert.equal(h.context.game.shots,0);
  h.key('KeyF');h.frame(280);assert.ok(h.context.game.shots>0);
});
test('pause freezes world and sprite flash, resume clears stuck keys',async()=>{
  const h=await harness();h.click('start');h.frame(100);h.key('KeyW');h.frame(200);h.key('KeyP');const g=h.context.game,t=g.time,flash=g.player.weapons[0].flash;
  h.frame(300);h.frame(400);assert.equal(g.time,t);assert.equal(g.player.weapons[0].flash,flash);assert.equal(g.status,'paused');
  h.button('dialog-actions','action','resume');h.frame(500);assert.equal(g.status,'playing');assert.ok(g.time>t);
});
test('pointer lock loss, blur and hidden tab pause the simulation',async()=>{
  for(const trigger of ['lock','blur','hidden']){const h=await harness();h.click('start');if(trigger==='lock')h.document.exitPointerLock();else if(trigger==='blur')h.win('blur');else {h.document.hidden=true;h.doc('visibilitychange');}assert.equal(h.context.game.status,'paused');}
});
test('rejected pointer lock retains drag-to-look fallback without stopping game',async()=>{
  const h=await harness({lockRejected:true});h.click('start');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.context.game.status,'playing');
  h.element('world','pointerdown',{pointerId:1,button:0,clientX:500,clientY:400,pointerType:'mouse'});h.doc('pointermove',{pointerId:1,clientX:600,clientY:350});h.frame(100);h.frame(150);assert.ok(h.context.game.player.yaw>.2);assert.ok(h.context.game.player.pitch>0);
});
test('upgrade pauses and releases mouse; reroll decrements once; number choice resumes',async()=>{
  const h=await harness();h.click('start');h.context.game.addXp(8);h.frame(100);h.frame(150);assert.equal(h.context.game.status,'upgrade');assert.equal(h.document.pointerLockElement,null);
  const before=h.context.game.rerolls;h.button('dialog-actions','action','reroll');assert.equal(h.context.game.rerolls,before-1);h.key('Digit1');assert.equal(h.context.game.status,'playing');assert.equal(h.nodes.get('modal').hidden,true);
});
test('ending hunt requires confirmation and grants a single persisted reward',async()=>{
  const h=await harness();h.click('start');h.context.game.coins=37;h.key('KeyP');h.button('dialog-actions','action','retire');assert.equal(h.context.game.status,'paused');h.button('dialog-actions','action','retire-confirm');
  const p=JSON.parse(h.memory.get('nightfall-hunt:v1'));assert.equal(p.coins,37);assert.equal(p.runs,1);h.button('dialog-actions','action','menu');assert.equal(h.nodes.get('menu').hidden,false);assert.equal(h.nodes.get('bank').textContent,'37 ◈');
});
test('blocked storage cannot silently discard run reward',async()=>{
  const h=await harness({blockedStorage:true});h.click('start');h.context.game.coins=20;h.key('KeyP');h.button('dialog-actions','action','retire');h.button('dialog-actions','action','retire-confirm');
  assert.match(h.nodes.get('dialog-error').textContent,/сохранить/);assert.ok(h.nodes.get('dialog-actions').children.some(b=>b.dataset.action==='retry-save'));
  h.button('dialog-actions','action','forfeit');assert.match(h.nodes.get('dialog-title').textContent,/без награды/);h.button('dialog-actions','action','forfeit-confirm');assert.equal(h.nodes.get('menu').hidden,false);
});
test('WebGL context loss pauses, blocks resume, then restoration allows recovery',async()=>{
  const h=await harness();h.click('start');h.element('world','webglcontextlost');assert.equal(h.context.game.status,'paused');h.button('dialog-actions','action','resume');assert.equal(h.context.game.status,'paused');
  h.element('world','webglcontextrestored');h.button('dialog-actions','action','resume');assert.equal(h.context.game.status,'playing');
});
test('fourteen weapon overlay frames render without leaving PNG bounds',async()=>{
  const h=await harness();h.click('start');h.context.game.player.weapons=Object.keys(h.context.HuntData.weapons).map(id=>({id,level:6,flash:0,cooldown:0}));
  h.frame(100);h.frame(150);h.frame(200);assert.ok(h.crops.length>=42);assert.match(h.nodes.get('arsenal-count').textContent,/14 \/ 14/);
});
