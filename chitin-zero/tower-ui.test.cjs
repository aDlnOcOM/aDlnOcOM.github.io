const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scripts=['tower-number.js','tower-data.js','tower-core.js','tower-storage.js','tower-render.js','tower-app.js'];
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
    set innerHTML(html){this.html=html;for(const child of this.children)child.isConnected=false;this.children=[];this.disclosures=[...html.matchAll(/<details\b([^>]*)>/g)].map(m=>({open:/\bopen\b/.test(m[1])}));this.summaries=[...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map(m=>{const s=new Element('','SUMMARY');s.textContent=m[1];return s;});for(const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){const b=new Element('','BUTTON');b.disabled=/\bdisabled\b/.test(m[1]);b.textContent=m[2];for(const d of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[d[1]]=d[2];this.children.push(b);}}
    get innerHTML(){return this.html||'';}
    closest(tag){return tag==='button'&&this.tagName==='BUTTON'?this:null;}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    setAttribute(key,value){this.attrs[key]=value;}
    focus(){document.activeElement=this;}
    querySelectorAll(selector){return selector==='details'?(this.disclosures||[]):selector==='summary'?(this.summaries||[]):selector==='summary, button:not([disabled])'?[...(this.summaries||[]),...this.children.filter(b=>!b.disabled)]:this.children.filter(b=>!b.disabled);}
    querySelector(selector){const matches=[...selector.matchAll(/\[data-([\w-]+)="([^"]+)"\]/g)];return matches.length?this.children.find(b=>matches.every(m=>b.dataset[m[1]]===m[2])):this.querySelectorAll()[0];}
    getBoundingClientRect(){return{left:10,top:20,width,height};}
    getContext(type){assert.equal(type,'2d','vector-only rendering context');return noCanvas?null:context2d;}
  }
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  for(const m of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const n=new Element(m[2],m[1].toUpperCase());n.hidden=/\bhidden\b/.test(m[0]);nodes.set(n.id,n);}
  for(const m of html.matchAll(/<button\b([^>]*)>/g)){const b=new Element('','BUTTON');for(const d of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[d[1]]=d[2];if(Object.keys(b.dataset).length)allStatic.push(b);}
  document={activeElement:null,hidden:false,getElementById(id){assert.ok(nodes.has(id),`DOM ${id}`);return nodes.get(id);},addEventListener(type,fn){(docEvents[type]||=[]).push(fn);},querySelectorAll(selector){const key=selector.match(/data-([\w-]+)/)[1];return allStatic.filter(b=>b.dataset[key]!==undefined);}};
  if(saved)memory.set('neon-ante:v1',JSON.stringify(saved));
  const context=vm.createContext({document,innerWidth:viewportWidth,innerHeight:viewportHeight,devicePixelRatio:1,Date:class extends Date{static now(){return now;}},matchMedia:()=>({matches:false}),
    localStorage:{getItem:k=>memory.get(k),setItem(k,v){writes++;if(blockedStorage)throw Error('blocked');memory.set(k,v);}},
    requestAnimationFrame:fn=>callbacks.push(fn),addEventListener(type,fn){(winEvents[type]||=[]).push(fn);}});
  for(const script of scripts){if(script==='tower-app.js'){const Original=context.TowerCore.Game;context.TowerCore.Game=class extends Original{constructor(saved){super(saved);context.game=this;}};}
    vm.runInContext(fs.readFileSync(path.join(__dirname,script),'utf8'),context,{filename:script});}
  function click(b){assert.ok(b);emit(docEvents,'click',{target:b});}
  return{nodes,context,memory,drawCalls,document,get writes(){return writes;},advanceTime(ms){now+=ms;},
    frame(stamp){const fn=callbacks.shift();assert.ok(fn);fn(stamp);},click:id=>click(nodes.get(id)),
    button(container,key,value){const b=(container?nodes.get(container).children:allStatic).find(b=>b.dataset[key]===String(value));assert.ok(b,`button ${container} ${key}=${value}`);click(b);},
    key(code,event={}){emit(docEvents,'keydown',{code,...event});},doc(type,event){emit(docEvents,type,event);},win(type,event){emit(winEvents,type,event);},element(id,type,event){emit(nodes.get(id).listeners,type,event);}
  };
}

function finish(g){g.run.spawned=g.run.total;g.run.enemies=[];return g.complete();}
test('new entrypoint boots with a single central tower and no old mode links',()=>{
  const h=harness();assert.equal(h.context.game.run,null);assert.equal(h.nodes.get('setup').hidden,false);h.frame(0);assert.ok(h.drawCalls.length>50);
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.doesNotMatch(html,/route.html|field.html|mech.html|hunters.html|td-core|field-core/);assert.match(html,/lang="ru"/);assert.match(html,/href="#decisions"/);
});
test('all entrypoint references exist and obsolete entrypoints and assets are removed',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(m[1].startsWith('#'))continue;assert.ok(fs.existsSync(path.join(__dirname,m[1])),m[1]);}for(const file of ['route.html','mech.html','hunters.html','field-core.js','td-core.js','assets'])assert.equal(fs.existsSync(path.join(__dirname,file)),false,file);
});
test('deck selection, seeded run and card preview start combat without building controls',()=>{
  const h=harness();h.nodes.get('seed').value='42';h.click('new-run');const g=h.context.game;assert.equal(g.run.seed,42);assert.equal(h.nodes.get('setup').hidden,true);assert.match(h.nodes.get('play-panel').innerHTML,/Соберите сигнал/);assert.ok(h.nodes.get('chips').textContent);
  h.button('play-panel','act','launch');assert.equal(g.run.phase,'battle');h.frame(0);for(let i=1;i<40;i++)h.frame(i*100);assert.ok(g.run.shots>0||g.run.spawned>0);
});
test('invalid seed is rejected with a visible accessible error',()=>{
  const h=harness();h.nodes.get('seed').value='1.5';h.click('new-run');assert.equal(h.context.game.run,null);assert.match(h.nodes.get('error').textContent,/целым/);
});
test('cards toggle selection and discard counts are visible',()=>{
  const h=harness();h.click('new-run');const g=h.context.game,id=g.run.hand.find(i=>!g.run.selected.includes(i)),before=g.run.selected.length;h.button('play-panel','id',id);assert.ok(g.run.selected.includes(id));assert.equal(g.run.selected.length,before+1);h.button('play-panel','act','discard');assert.equal(g.run.discards,2);assert.match(h.nodes.get('play-panel').innerHTML,/Заменить · 2/);
});
test('clearing every selected card clears the formula instead of showing stale damage',()=>{
  const h=harness();h.click('new-run');for(const id of [...h.context.game.run.selected])h.button('play-panel','id',id);assert.equal(h.nodes.get('chips').textContent,'0');assert.equal(h.nodes.get('mult').textContent,'0');assert.match(h.nodes.get('hand-name').textContent,/Выберите/);
});
test('shop offers, targeted tarot and planet purchases change run state through UI',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.launch();finish(g);g.run.cash=100;g.run.shop=[g.item('planet','pair'),g.item('tarot','foil')];h.frame(0);h.button('play-panel','id','0');assert.equal(g.run.levels.pair,2);h.button('play-panel','id','1');assert.equal(g.run.cards[0].enhance,'foil');assert.match(h.nodes.get('play-panel').innerHTML,/Куплено/);
});
test('joker order and sales are reachable without dragging',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.run.jokers=['spark','echo'];h.button('play-panel','act','best');h.button('jokers','id','0');h.button('modal-body','act','right');assert.equal(g.run.jokers[0],'echo');assert.equal(h.nodes.get('modal-title').textContent,'Искровой чип');h.key('Escape');g.launch();finish(g);h.frame(0);h.button('jokers','id','0');h.button('modal-body','act','sell');assert.equal(g.run.jokers.length,1);assert.equal(h.nodes.get('modal').hidden,true);
});
test('booster choice blocks next round until an explicit choice or skip',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.launch();finish(g);g.run.cash=100;g.run.shop=[g.item('pack','joker')];h.frame(0);h.button('play-panel','act','buy');assert.match(h.nodes.get('play-panel').innerHTML,/Оставьте один/);h.button('play-panel','act','pack');assert.equal(g.run.pack,null);assert.equal(g.run.jokers.length,1);
});
test('help traps focus, pauses combat and restores the prior pause state',()=>{
  const h=harness();h.click('new-run');h.button('play-panel','act','launch');h.nodes.get('help').focus();h.click('help');assert.equal(h.nodes.get('app').inert,true);assert.equal(h.context.game.run.paused,true);h.key('Tab');assert.ok(h.document.activeElement);h.key('Escape');assert.equal(h.nodes.get('modal').hidden,true);assert.equal(h.context.game.run.paused,false);assert.equal(h.document.activeElement.id,'help');
});
test('retirement requires confirmation and new run retains discoveries only',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.profile.discovered=['spark'];g.run.jokers=['spark'];h.click('retire');h.button('modal-actions','act','close');assert.equal(g.run.phase,'prepare');h.click('retire');h.button('modal-actions','act','retire-confirm');assert.equal(g.run.phase,'retired');assert.equal(h.nodes.get('setup').hidden,false);h.click('new-run');assert.equal(g.run.jokers.length,0);assert.equal(g.profile.discovered[0],'spark');
});
test('hidden tab never simulates battle or produces cash and reloading pauses battle',()=>{
  const h=harness();h.click('new-run');h.button('play-panel','act','launch');const g=h.context.game,before=JSON.stringify(g.serialize());h.document.hidden=true;h.doc('visibilitychange');h.advanceTime(86400000);h.frame(0);h.frame(100000);assert.equal(JSON.stringify(g.serialize()),before);const restored=harness({saved:JSON.parse(h.memory.get('neon-ante:v1'))});assert.equal(restored.context.game.run.paused,true);
});
test('space pauses only while the battlefield has focus',()=>{
  const h=harness();h.click('new-run');h.button('play-panel','act','launch');h.key('Space');assert.equal(h.context.game.run.paused,false);h.nodes.get('arena').focus();h.key('Space');assert.equal(h.context.game.run.paused,true);
});
test('storage and Canvas errors are visible instead of claiming success',()=>{
  const h=harness({blockedStorage:true});assert.match(h.nodes.get('save-state').textContent,/только в памяти/);const c=harness({noCanvas:true});assert.equal(c.nodes.get('new-run').disabled,true);assert.match(c.nodes.get('event').textContent,/графику/);
});
test('collection reports unlock requirements and stakes instead of permanent damage',()=>{
  const h=harness();h.click('collection-toggle');assert.equal(h.nodes.get('collection').hidden,true);assert.equal(h.nodes.get('modal').hidden,false);assert.equal(h.nodes.get('collection-toggle').attrs['aria-expanded'],'true');assert.match(h.nodes.get('modal-body').innerHTML,/100 врагов/);assert.match(h.nodes.get('modal-body').innerHTML,/Сыграйте Синхронизацию/);h.key('Escape');assert.equal(h.nodes.get('collection-toggle').attrs['aria-expanded'],'false');
});
test('small screens render finite vector coordinates and retain non-canvas actions',()=>{
  const h=harness({width:390,height:390,viewportWidth:390,viewportHeight:844});h.click('new-run');h.frame(0);h.frame(100);assert.ok(h.drawCalls.length>150);assert.match(h.nodes.get('play-panel').innerHTML,/В бой →/);
});

test('cyber systems have unique circuit art, readable codes and no traditional suit symbols',()=>{
  const h=harness(),D=h.context.TowerData;
  assert.deepEqual(Array.from(D.suits,s=>s.code),['AIM','FIX','CLK','NET']);
  assert.equal(new Set(D.suits.map(s=>s.path)).size,4);
  assert.equal(new Set(D.suits.map(s=>s.name)).size,4);
  assert.ok(Object.values(D.hands).every(hand=>hand.rule));
  h.click('new-run');const html=h.nodes.get('play-panel').innerHTML;
  assert.doesNotMatch(html,/[♠♥♣♦]|playing-card|>J<|>Q<|>K<|>A</);
  for(const s of D.suits){assert.ok(html.includes(s.path));assert.ok(html.includes(s.code));assert.ok(html.includes(s.name));}
  assert.match(html,/aria-label="[^"]+ранг \d{2}/);
  assert.match(html,/aria-pressed="true"/);assert.match(html,/aria-hidden="true">✓/);
});

test('same module renderer preserves ranks, upgrades and scoring state in battle and patch browser',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;
  const ids=[10,24,38,52]; // Ranks 11–14, one of every system.
  g.run.hand=ids;g.run.selected=[...ids];g.card(ids[0]).enhance='foil';
  h.button('play-panel','act','launch');
  const html=h.nodes.get('play-panel').innerHTML;
  for(const rank of [11,12,13,14])assert.match(html,new RegExp(`<strong>${rank}</strong>`));
  assert.match(html,/\+30 мощ\./);assert.match(html,/Вне связки/);assert.match(html,/В сети/);
  assert.doesNotMatch(html,/data-act="card"/);
  finish(g);g.run.cash=100;g.run.shop=[g.item('tarot','heart')];h.frame(0);
  h.button('play-panel','act','modules');h.button('modal-body','id',String(ids[3]));assert.equal(h.nodes.get('modal').hidden,true);assert.match(h.nodes.get('play-panel').innerHTML,/Цель: NET \/ 14/);
  h.button('play-panel','act','buy');assert.equal(g.card(ids[3]).suit,1);
  assert.match(h.nodes.get('play-panel').innerHTML,/Цель: FIX \/ 14/);
});

test('menu and diagnostics start folded while primary actions remain outside disclosures',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),stack=[],ancestors=new Map();
  for(const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi)){
    const tag=m[2].toLowerCase();if(m[1]){assert.equal(stack.pop(),tag,`balanced ${tag}`);continue;}
    const id=m[3].match(/\bid="([^"]+)"/);if(id){assert.ok(!ancestors.has(id[1]),`unique ${id[1]}`);ancestors.set(id[1],[...stack]);}
    if(!['meta','link','input','br','hr'].includes(tag))stack.push(tag);
  }
  assert.equal(stack.length,0);assert.doesNotMatch(html,/<details\b[^>]*\bopen(?:\s|>|=)/);
  for(const id of ['help','save','retire','seed'])assert.ok(ancestors.get(id).includes('details'),id);
  assert.match(html,/<div hidden><div id="stats"[\s\S]*id="trace"[\s\S]*id="levels"/);
  for(const id of ['new-run','cash','damage','hp','pause'])assert.ok(!ancestors.get(id).includes('details'),id);
  const h=harness();assert.equal(h.nodes.get('decks').children.length,1);h.click('new-run');
  assert.match(h.nodes.get('play-panel').innerHTML,/data-act="launch"/);assert.doesNotMatch(h.nodes.get('play-panel').innerHTML,/<details/);
});

test('compact cash and damage displays track play, purchases and empty selections',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;
  assert.equal(h.nodes.get('cash').textContent,'$10');assert.equal(h.nodes.get('damage').textContent,g.score().damage.format());
  for(const id of [...g.run.selected])h.button('play-panel','id',id);
  assert.equal(h.nodes.get('damage').textContent,'0');h.button('play-panel','act','best');h.button('play-panel','act','launch');
  g.run.cash+=1;h.frame(0);h.frame(100);h.frame(200);assert.equal(h.nodes.get('cash').textContent,'$11');
  finish(g);g.run.shop=[g.item('planet','pair')];h.frame(300);h.button('play-panel','act','buy');
  assert.equal(h.nodes.get('cash').textContent,`$${g.run.cash}`);
});

test('guide is an overlay with keyboard access to scrolling content and disclosures',()=>{
  const h=harness();h.click('new-run');h.click('help');h.key('Tab');assert.equal(h.document.activeElement.id,'modal-body');h.key('Tab');assert.equal(h.document.activeElement.tagName,'SUMMARY');
  h.key('Tab');assert.equal(h.document.activeElement.dataset.act,'close');
  h.key('Tab',{shiftKey:true});assert.equal(h.document.activeElement.tagName,'SUMMARY');h.key('Escape');
  h.nodes.get('menu').open=true;h.key('Escape');assert.equal(h.nodes.get('menu').open,false);assert.equal(h.document.activeElement.id,'menu-toggle');
});

test('game phases select dock, market and launch screen without expanding the page',()=>{
  const h=harness();assert.equal(h.nodes.get('app').dataset.phase,'setup');assert.equal(h.nodes.get('decisions').hidden,true);
  h.click('new-run');assert.equal(h.nodes.get('app').dataset.phase,'prepare');assert.equal(h.nodes.get('side-console').hidden,false);assert.equal(h.nodes.get('decisions').hidden,false);
  h.button('play-panel','act','launch');assert.equal(h.nodes.get('app').dataset.phase,'battle');finish(h.context.game);h.frame(0);assert.equal(h.nodes.get('app').dataset.phase,'shop');
  assert.doesNotMatch(h.nodes.get('play-panel').innerHTML,/deck-browser|<details/);
  h.button('play-panel','act','next');assert.equal(h.nodes.get('app').dataset.phase,'prepare');
});

test('every inspection pauses combat without changing the selected build or previous pause state',()=>{
  for(const id of ['inspect-build','guide','loadout','collection-toggle']){
    const h=harness();h.click('new-run');h.button('play-panel','act','launch');const g=h.context.game,selected=JSON.stringify(g.run.selected),time=g.run.time;
    h.nodes.get(id).focus();h.click(id);assert.equal(g.run.paused,true);assert.equal(h.nodes.get('app').inert,true);h.frame(0);h.frame(100);assert.equal(g.run.time,time);
    h.key('Escape');assert.equal(g.run.paused,false);assert.equal(JSON.stringify(g.run.selected),selected);assert.equal(h.document.activeElement.id,id);
    g.run.paused=true;h.click(id);h.key('Escape');assert.equal(g.run.paused,true);
  }
});

test('compact loadout opens each implant but cannot rearrange an active battle',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.run.jokers=['spark','echo','cache','shell','scope','medic'];h.button('play-panel','act','launch');
  h.click('loadout');assert.equal(h.nodes.get('modal-body').children.length,6);h.button('modal-body','id','0');
  assert.equal(h.nodes.get('modal').dataset.kind,'implant');const right=h.nodes.get('modal-body').children.find(b=>b.dataset.act==='right');assert.equal(right.disabled,true);
  h.button('modal-body','act','right');assert.equal(g.run.jokers[0],'spark');h.key('Escape');assert.equal(g.run.paused,false);
});

test('patch picker traps keyboard focus and cancel leaves target and credits untouched',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.launch();finish(g);g.run.shop=[g.item('tarot','heart')];h.frame(0);
  const before=JSON.stringify(g.run.cards),cash=g.run.cash;h.button('play-panel','act','modules');
  h.key('Tab');assert.equal(h.document.activeElement.id,'modal-body');h.key('Tab');assert.equal(h.document.activeElement.dataset.act,'target');
  h.key('Escape');assert.equal(JSON.stringify(g.run.cards),before);assert.equal(g.run.cash,cash);assert.equal(h.nodes.get('app').inert,false);
});

test('boss rule remains visible on the field and eight or nine modules remain in the dock',()=>{
  const h=harness();h.click('new-run');const g=h.context.game;g.run.round=3;g.run.vouchers=['pocket'];g.prepare();h.button('play-panel','act','best');
  assert.equal(h.nodes.get('boss-warning').hidden,false);assert.match(h.nodes.get('boss-warning').textContent,/35%/);
  assert.match(h.nodes.get('play-panel').innerHTML,/--cards:9/);assert.equal(h.nodes.get('play-panel').children.filter(b=>b.dataset.act==='card').length,9);
  h.button('play-panel','act','launch');assert.equal(h.nodes.get('boss-warning').hidden,false);
});

test('viewport layout has bounded main regions and independently scrollable overlay content',()=>{
  const css=fs.readFileSync(path.join(__dirname,'tower.css'),'utf8');
  assert.match(css,/html,body\{[^}]*height:100%;overflow:hidden/);
  assert.match(css,/\.shell\{[^}]*height:100dvh;[^}]*minmax\(0,1fr\)/);
  assert.match(css,/\.arena canvas\{[^}]*height:100%/);
  assert.doesNotMatch(css,/height:clamp\(320px,56vh/);
  assert.match(css,/#modal-body\{[^}]*overflow:auto/);
  assert.match(css,/@media\(max-height:520px\) and \(min-width:560px\)/);
  // This asserts the CSS contract, not computed geometry in a real browser.
  for(const [width,height] of [[320,568],[390,844],[640,360],[844,390],[1366,768],[1920,1080]]){
    const h=harness({width,height,viewportWidth:width,viewportHeight:height});h.click('new-run');h.frame(0);assert.ok(h.drawCalls.length>50);assert.equal(h.nodes.get('decisions').hidden,false);
  }
});

test('version-one snapshots keep numeric module identities, enhancements and damage',()=>{
  const h=harness();h.nodes.get('seed').value='42';h.click('new-run');const g=h.context.game;
  g.card(g.run.selected[0]).enhance='steel';g.run.jokers=['spark','echo'];g.launch();
  const saved=JSON.parse(JSON.stringify(g.serialize())),restored=harness({saved}).context.game;
  assert.equal(saved.version,1);assert.equal(restored.run.phase,'battle');assert.equal(restored.run.paused,true);
  assert.equal(JSON.stringify(restored.run.cards),JSON.stringify(saved.run.cards));
  assert.equal(JSON.stringify(restored.run.selected),JSON.stringify(saved.run.selected));
  assert.equal(restored.run.active.damage.log,g.run.active.damage.log);assert.equal(restored.run.rng,g.run.rng);
});

