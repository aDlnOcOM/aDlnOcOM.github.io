const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=file=>fs.readFileSync(`${__dirname}/${file}`,'utf8');
function load(){
  const node=tag=>({tag,children:[],append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(){this.children=[];}});
  const scope=vm.createContext({window:{},document:{createElement:node}});
  vm.runInContext(read('resources.js'),scope);vm.runInContext(read('game-assets.js'),scope);
  return {R:scope.window.Resources,A:scope.window.GameAssets,node};
}
test('all 41 resources have distinct self-contained SVG art and are in the preload manifest',()=>{
  const {R,A}=load(),bodies=new Set();assert.equal(R.catalog.length,41);
  for(const resource of R.catalog){
    assert.equal(resource.icon,`assets/resources/${resource.id}.svg`);
    const source=read(resource.icon);assert.match(source,/viewBox="0 0 128 128"/);
    assert.doesNotMatch(source,/<script|<foreignObject|href=|<image/);
    assert.ok(A.paths.includes('resources/'+resource.id));
    bodies.add(source.slice(source.indexOf('</defs>')));
  }
  assert.equal(bodies.size,41,'resources must not be identical placeholder icons');
  assert.equal(A.progress().total,101);
  const html=read('index.html');assert.equal(html.split('src="resources.js"').length-1,1);
  assert.ok(html.indexOf('src="resources.js"')<html.indexOf('src="game-assets.js"'));
});
test('warehouse keeps readable names, quantities and hints beside decorative resource icons',()=>{
  const {R,node}=load(),root=node('div');R.render(root,{metal:8},12);
  for(const [i,card] of root.children.entries()){
    const image=card.children.find(child=>child.tag==='img');assert.equal(image.src,R.catalog[i].icon);assert.equal(image.alt,'');
    image.onerror();assert.equal(image.hidden,true);assert.equal(card.children[0].textContent,R.catalog[i].name);
  }
  assert.equal(root.children[3].children[1].textContent,'8');assert.equal(root.children[4].children[1].textContent,'12');
});
test('ingredient icons preserve quantities without mutating resource stock',()=>{
  const {R}=load(),stock={steel:4,wire:2},chips=R.costIcons(stock);
  assert.equal(chips.children.length,2);assert.equal(chips.children[0].children[0].src,'assets/resources/steel.svg');
  assert.equal(chips.children[0].children[1].textContent,'Сталь ×4');assert.deepEqual(stock,{steel:4,wire:2});
  assert.equal(R.icon('unknown'),null);assert.equal(R.costIcons({unknown:3}).children[0].children[0].textContent,'unknown ×3');
});
