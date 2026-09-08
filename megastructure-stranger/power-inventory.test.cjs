const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(game = false) {
  const node = () => ({ dataset: {}, width: 960, height: 600, getContext: () => ({}), addEventListener() {}, appendChild() {} });
  const scope = { window: { addEventListener() {}, requestAnimationFrame() {} },
    document: { getElementById: node, createElement: node }, performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(scope);
  for (const file of ['power-inventory.js', ...(game ? ['equipment.js', 'security-ai.js', 'perception.js'] : [])]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), scope);
  }
  if (game) {
    scope.window.PowerInventory.render = () => {};
    const source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8')
      .replace(/\}\)\(\);\s*$/, 'window.test = { state, createPowerStock, resetPlayer, fireSmg, reloadSmg, updatePlayer }; })();');
    vm.runInContext(source, scope);
  }
  return { power: scope.window.PowerInventory, ...scope.window.test };
}
const total = stock => stock.battery + stock.magazines.reduce((sum, item) => sum + item.energy, 0);
test('starter stock has three compatible magazines and one 150-energy battery', () => {
  const { power } = load();
  for (const capacity of [32, 44, 52]) {
    const stock = power.create(capacity);
    assert.equal(stock.magazines.length, 3);
    assert.equal(stock.battery, 150);
    assert.ok(stock.magazines.every(item => item.capacity === capacity && item.energy === capacity));
  }
  assert.equal(power.create(32, true).magazines[0].variant, 'быстрой подачи');
});
test('shots consume one energy; swapping preserves partial magazines', () => {
  const { power } = load(), stock = power.create(32);
  assert.ok(power.fire(stock)); assert.equal(total(stock), 245);
  assert.equal(power.reload(stock), 32); assert.equal(stock.loaded, 1);
  assert.equal(stock.magazines[0].energy, 31); assert.equal(total(stock), 245);
});
test('charging is finite, conserved and cannot overfill', () => {
  const { power } = load(), stock = power.create(32);
  stock.magazines[0].energy = 0; stock.battery = 7;
  assert.equal(power.refill(stock, 0), 7); assert.equal(stock.battery, 0);
  assert.equal(stock.magazines[0].energy, 7);
  assert.equal(power.refill(stock, 0), 0);
  assert.equal(power.refill(stock, 99), 0);
});
test('complete depletion cannot generate further energy by reloading', () => {
  const { power } = load(), stock = power.create(32);
  let shots = 0;
  while (total(stock) > 0) {
    if (power.fire(stock)) shots++;
    else power.reload(stock);
  }
  assert.equal(shots, 246);
  assert.equal(power.canReload(stock), false);
  assert.equal(power.reload(stock), 0);
  assert.equal(power.fire(stock), false);
});
test('game firing, timed reload and floor player reset preserve stock; hideout restocks', () => {
  const { state, createPowerStock, resetPlayer, fireSmg, reloadSmg, updatePlayer } = load(true);
  state.powerInventory = createPowerStock(); state.cameraX = 0; resetPlayer(); state.active = true;
  fireSmg();
  assert.equal(state.player.ammo, 31); assert.equal(total(state.powerInventory), 245);
  resetPlayer(); assert.equal(state.player.ammo, 31);
  reloadSmg(); assert.ok(state.player.reload > 0);
  fireSmg(); assert.equal(total(state.powerInventory), 245, 'firing during reload cannot spend energy');
  assert.equal(state.powerInventory.loaded, 0);
  updatePlayer(2);
  assert.equal(state.player.reload, 0, 'completed reload must not leave a negative, truthy timer');
  assert.equal(state.powerInventory.loaded, 1); assert.equal(state.player.ammo, 32);
  assert.equal(total(state.powerInventory), 245);
  assert.equal(total(createPowerStock()), 246);
});

test('inventory uses separate loaded-magazine, rig, pocket and backpack grids', () => {
  const scope = { window: {} };
  const node = () => ({ children: [], style: { setProperty() {} }, classList: { add() {} },
    setAttribute() {}, append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; } });
  scope.document = { createElement: node };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'power-inventory.js'), 'utf8'), scope);
  const stock = scope.window.PowerInventory.create(32), container = node();
  scope.window.PowerInventory.render(container, stock);
  assert.equal(container.children.length, 5);
  const grids = container.children.slice(0, 4).map(section => section.children[1]);
  assert.equal(grids[0].children.length, 1);
  assert.equal(grids[1].children.length, 2);
  assert.equal(grids[2].children.length, 4);
  assert.equal(grids[3].children.length, 1);
  assert.equal(grids[0].children[0].style.gridRow, '1 / span 2');
  assert.equal(grids[3].children[0].style.gridColumn, '1 / span 2');
  grids[0].children[0].onclick();
  assert.ok(container.children[4].innerHTML.includes('Аккумуляторный магазин'));
});
