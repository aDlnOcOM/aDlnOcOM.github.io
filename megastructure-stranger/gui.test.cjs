const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=file=>fs.readFileSync(`${__dirname}/${file}`,'utf8');
function setup(){
  const nodes=new Map();
  const node=tag=>({tag,dataset:{},children:[],handlers:{},value:'',checked:false,hidden:false,textContent:'',
    append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(){this.children=[];},
    addEventListener(type,fn){this.handlers[type]=fn;}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,node('div'));return nodes.get(id);};
  const scope=vm.createContext({window:{},document:{getElementById:get,createElement:node}});
  for(const file of ['resources.js','gui.js','workshop-ui.js'])vm.runInContext(read(file),scope);
  return {R:scope.window.Resources,UI:scope.window.GameUI,W:scope.window.WorkshopUI,get};
}
test('warehouse search is case insensitive, trims whitespace and filters without rebuilding input',()=>{
  const {R,get}=setup();R.render(get('storage-materials'),{steel:3},20);
  const search=get('storage-search');search.value=' СТАЛЬ ';search.handlers.input();
  assert.equal(get('storage-materials').children.filter(c=>!c.hidden).length,4);
  assert.equal(get('storage-result-count').textContent,'4 / 41 материалов');
  assert.equal(get('storage-search'),search);assert.equal(search.value,' СТАЛЬ ');
});
test('owned-only filter combines with search and refreshes after stock changes',()=>{
  const {R,get}=setup();R.render(get('storage-materials'),{steel:3,metal:4},0);
  get('storage-owned').checked=true;get('storage-owned').handlers.change();
  assert.equal(get('storage-materials').children.filter(c=>!c.hidden).length,2);
  get('storage-search').value='сталь';get('storage-search').handlers.input();
  assert.equal(get('storage-materials').children.filter(c=>!c.hidden).length,1);
  R.render(get('storage-materials'),{steel:0},0);
  assert.equal(get('storage-empty').hidden,false);assert.equal(get('storage-result-count').textContent,'0 / 41 материалов');
  assert.equal(get('storage-search').value,'сталь');assert.equal(get('storage-owned').checked,true);
});
test('clearing a warehouse search restores cards and hides the empty state',()=>{
  const {R,get}=setup();R.render(get('storage-materials'),{},0);
  get('storage-search').value='NOT FOUND';get('storage-search').handlers.input();assert.equal(get('storage-empty').hidden,false);
  get('storage-search').value='';get('storage-search').handlers.input();assert.equal(get('storage-empty').hidden,true);
  assert.equal(get('storage-materials').children.filter(c=>!c.hidden).length,41);
  const card=get('storage-materials').children[0];assert.equal(card.children[3].tag,'details');assert.equal(card.children[3].children[0].textContent,'Где найти');
});
test('research filters combine actual availability with the resource name',()=>{
  const {W}=setup();
  assert.equal(W.matchesResearch({name:'Сталь',status:'available'},' СТА ','available'),true);
  assert.equal(W.matchesResearch({name:'Сталь',status:'locked'},'сталь','available'),false);
  assert.equal(W.matchesResearch({name:'Металл',status:'done'},'','done'),true);
  assert.equal(W.matchesResearch({name:'Металл',status:'done'},'сталь','all'),false);
});
test('GUI is loaded after legacy styles and initialized without bypassing asset preparation',()=>{
  const html=read('index.html'),styles=[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(m=>m[1]);
  assert.equal(styles.at(-1),'gui.css');assert.ok(html.indexOf('src="gui.js"')>html.indexOf('src="script.js"'));
  assert.ok(html.indexOf('src="gui.js"')<html.indexOf('src="asset-loading.js"'));
  assert.match(html,/<main[^>]+inert/);assert.doesNotMatch(read('gui.js'),/AssetBoot|\.ready\s*=|\.inert\s*=/);
  for(const control of ['storage-search','storage-owned','storage-empty','storage-result-count'])assert.match(html,new RegExp('id="'+control+'"'));
  assert.match(html,/<kbd>Ctrl<\/kbd>/);assert.match(html,/<kbd>I<\/kbd>/);
});
test('GUI preserves gameplay canvas dimensions, hidden states and drag-to-pan behavior',()=>{
  const html=read('index.html'),css=read('gui.css');
  assert.match(html,/id="game-canvas" width="960" height="600"/);assert.match(html,/id="shelter-canvas" width="960" height="500"/);
  assert.match(read('style.css'),/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css,/@media\(max-width:800px\)/);assert.match(css,/@media\(max-width:580px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/body \{ min-width:0/);
  assert.match(read('equipment.js'),/bindPan\(viewport\)/);
});
test('primary GUI text and CTA palette meet normal-text contrast targets',()=>{
  const luminance=hex=>{
    const c=hex.match(/.{2}/g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  for(const [text,background]of [['e1e6dc','141c1f'],['a0b0aa','141c1f'],['15231e','cbd5ac']]){
    const a=luminance(text),b=luminance(background);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);
  }
});
