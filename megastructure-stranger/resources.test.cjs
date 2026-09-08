const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load() {
  const scope = vm.createContext({ window: {} });
  for (const file of ['resources.js', 'sectors.js', 'loot-containers.js']) vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, 'utf8'), scope);
  return scope.window;
}
test('all 25 resources have unique names, stable IDs and reachable sources', () => {
  const { Resources: r, SectorGenerator: s } = load();
  assert.equal(r.catalog.length, 25);
  assert.equal(new Set(r.catalog.map(item => item.id)).size, 25);
  const seen = new Set();
  for (const sector of s.types) for (let seed = 0; seed < 200; seed++) {
    Object.keys(r.roll('sectors', sector.id, s.seeded(seed), 10)).forEach(id => seen.add(id));
  }
  assert.equal(seen.size, 24);
  for (const item of r.catalog) assert.ok(item.sectors.every(id => s.types.some(type => type.id === id)));
  assert.equal(Object.hasOwn(r.normalize({salvage: 99}), 'salvage'), false);
});
test('legacy and malformed stock normalizes; extraction and death do not duplicate salvage', () => {
  const { Resources: r } = load();
  assert.equal(r.total(r.normalize()), 0);
  const stock = r.normalize({ metal: -9, acid: NaN, wood: '8', steel: 2.9, rogue: 40 });
  assert.equal(stock.steel, 2); assert.equal(r.total(stock), 2);
  r.add(stock, { metal: 10, steel: 5, salvage: 100 }, .4);
  assert.equal(stock.metal, 4); assert.equal(stock.steel, 4);
  assert.equal(Object.hasOwn(stock, 'salvage'), false);
  assert.equal(r.total(r.normalize(JSON.parse(JSON.stringify(stock)))), 8);
});
test('sector and enemy pools differ; rare boss resources are obtainable', () => {
  const { Resources: r, SectorGenerator: s } = load();
  const residential = r.roll('sectors', 'residential', s.seeded(7), 1000);
  assert.ok(residential.fabric && residential.wood);
  assert.equal(residential.superconductor, undefined);
  const boss = r.roll('enemies', 'warden', s.seeded(7), 1000);
  assert.ok(boss.superconductor && boss.superComposite && boss.premiumSteel);
  assert.equal(boss.fabric, undefined);
  assert.equal(r.total(r.roll('enemies', 'unknown', s.seeded(1))), 0);
});
test('generated crate materials are seeded, collectible once and compatible with ammo', () => {
  const { Resources: r, SectorGenerator: s, LootContainers: l } = load();
  const sectors = [{id:'robotics',index:0,x:0,width:960,lane:300}];
  const generate = () => l.generate(sectors, [], 777, s.seeded, () => true, () => [{}]);
  assert.equal(JSON.stringify(generate()), JSON.stringify(generate()));
  const crate = generate()[0], stock = {type:'energy',battery:0};
  const loot = l.collect(crate,stock);
  assert.ok(r.total(loot.resources) >= 3);
  assert.equal(l.collect(crate,stock), null);
});
test('warehouse renders every resource with stock and acquisition hints', () => {
  const node = () => ({children:[], replaceChildren(){this.children=[];}, append(...children){this.children.push(...children);}, appendChild(child){this.children.push(child);} });
  const scope = vm.createContext({window:{},document:{createElement:node}});
  vm.runInContext(fs.readFileSync(`${__dirname}/resources.js`,'utf8'),scope);
  const root = node(); scope.window.Resources.render(root,{metal:8},35);
  assert.equal(root.children.length,25);
  assert.equal(root.children[3].children[1].textContent,'8');
  assert.equal(root.children[4].children[1].textContent,'35');
  assert.match(root.children[0].children[3].textContent,/Ящики:.*Разбор/);
});

test('game extraction persists once, death uses retention, failed saves can retry safely', () => {
  for (const dead of [false,true]) {
    let stored = JSON.stringify({salvage:20,resources:{metal:2}}), fail = true;
    const node = () => ({dataset:{},width:960,height:600,getContext:()=>({}),addEventListener(){},appendChild(){}});
    const scope = vm.createContext({window:{addEventListener(){},requestAnimationFrame(){}},document:{getElementById:node,createElement:node},performance:{now:()=>0},localStorage:{getItem:()=>stored,setItem(_,value){if(fail)throw Error('quota');stored=value;}}});
    for(const file of ['equipment.js','resources.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),scope);
    scope.window.Resources.render = () => {};
    const source=fs.readFileSync(`${__dirname}/script.js`,'utf8').replace(/\}\)\(\);\s*$/, 'hideOverlay = () => {}; updateHome = () => {}; window.testing = {state, finishRun, loadProgression}; })();');
    vm.runInContext(source,scope);
    const {state,finishRun,loadProgression}=scope.window.testing;
    state.runActive=true;state.player={health:dead?0:100};state.runResources={metal:10};state.runSalvage=10;
    finishRun(1); assert.equal(state.runActive,true);assert.equal(JSON.parse(stored).resources.metal,2);
    fail=false;finishRun(1);
    assert.equal(JSON.parse(stored).resources.metal,dead?6:12);
    assert.equal(JSON.parse(stored).salvage,dead?24:30);
    const once=stored;finishRun(1);assert.equal(stored,once);
    assert.equal(loadProgression().resources.metal,dead?6:12);
  }
});
