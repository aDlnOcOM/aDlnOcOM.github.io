const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(`${__dirname}/hideout-upgrades.js`, 'utf8'), context);
  return context.window.HideoutUpgrades;
}
test('five installations have five tiers and legacy saves default to unbuilt', () => {
  const api = setup();
  assert.equal(api.facilities.length, 5);
  assert.equal(api.tiers.length, 5);
  assert.deepEqual(Object.values(api.normalize()), [0, 0, 0, 0, 0]);
  assert.deepEqual(Object.values(api.normalize({ generator: 99, battery: -5, solder: 2.9, mill: '4', forming: NaN, rogue: 5 })), [5, 0, 2, 0, 0]);
});
test('dependencies, funds, unknown IDs and max level prevent spending', () => {
  const api = setup();
  const progress = { salvage: 10000, hideout: {} };
  let writes = 0;
  assert.equal(api.purchase(progress, 'mill', () => writes++).allowed, false);
  assert.equal(api.purchase(progress, 'unknown', () => writes++).allowed, false);
  progress.hideout.generator = 5;
  assert.equal(api.purchase(progress, 'generator', () => writes++).allowed, false);
  progress.salvage = 0;
  assert.equal(api.purchase(progress, 'battery', () => writes++).allowed, false);
  assert.equal(writes, 0);
});
test('all tiers are reachable in dependency order and persist without losing other progress', () => {
  const api = setup();
  const progress = { salvage: 100000, hideout: {}, equipment: { smg: {} }, implants: ['cortex'], bestFloor: 7 };
  let saved;
  let spent = 0;
  for (let tier = 1; tier <= 5; tier++) {
    for (const facility of api.facilities) {
      const offer = api.quote(progress, facility.id);
      spent += offer.cost;
      assert.equal(api.purchase(progress, facility.id, candidate => { saved = JSON.stringify(candidate); }).allowed, true);
      assert.equal(progress.hideout[facility.id], tier);
    }
  }
  assert.equal(progress.salvage, 100000 - spent);
  assert.deepEqual(JSON.parse(saved), JSON.parse(JSON.stringify(progress)));
  assert.equal(progress.bestFloor, 7);
  assert.deepEqual(progress.implants, ['cortex']);
});
test('storage failure rolls back both levels and balance', () => {
  const api = setup();
  const progress = { salvage: 100, hideout: {} };
  const before = JSON.stringify(progress);
  assert.equal(api.purchase(progress, 'generator', () => { throw Error('quota'); }).allowed, false);
  assert.equal(JSON.stringify(progress), before);
});
test('each tier requires matching infrastructure and every successful call costs exactly once', () => {
  const api = setup();
  const progress = { salvage: 1000, hideout: { generator: 1 } };
  let writes = 0;
  assert.equal(api.purchase(progress, 'solder', () => writes++).allowed, true);
  assert.equal(progress.salvage, 970);
  assert.equal(api.purchase(progress, 'solder', () => writes++).allowed, false);
  assert.equal(progress.salvage, 970);
  assert.equal(writes, 1);
});

test('game loader migrates legacy saves and preserves facility upgrades on reload', () => {
  let stored = JSON.stringify({ salvage: 400, bestFloor: 3, implants: ['cortex'] });
  function boot() {
    const node = () => ({ dataset: {}, width: 960, height: 600, getContext: () => ({}), addEventListener() {}, appendChild() {} });
    const scope = vm.createContext({ window: {}, document: { getElementById: node, createElement: node }, performance: { now: () => 0 }, localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } } });
    for (const file of ['equipment.js', 'hideout-upgrades.js']) vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, 'utf8'), scope);
    const source = fs.readFileSync(`${__dirname}/script.js`, 'utf8');
    vm.runInContext(source.slice(0, source.indexOf('  function generateFloor(')) + 'window.test = { progression, saveProgression }; })();', scope);
    return scope.window;
  }
  const first = boot();
  assert.equal(first.test.progression.hideout.generator, 0);
  first.HideoutUpgrades.purchase(first.test.progression, 'generator', candidate => { stored = JSON.stringify(candidate); });
  first.test.saveProgression();
  const second = boot();
  assert.equal(second.test.progression.hideout.generator, 1);
  assert.equal(second.test.progression.salvage, 360);
  assert.equal(second.test.progression.bestFloor, 3);
});

test('panel renders five cards, tiers, actionable build button and blocked dependencies', () => {
  const node = () => ({ children: [], style: { setProperty() {} }, attributes: {}, handlers: {}, replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); }, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, handler) { this.handlers[key] = handler; } });
  const scope = vm.createContext({ window: {}, document: { createElement: node } });
  vm.runInContext(fs.readFileSync(`${__dirname}/hideout-upgrades.js`, 'utf8'), scope);
  const container = node();
  let chosen;
  scope.window.HideoutUpgrades.render(container, { salvage: 100, hideout: {} }, id => { chosen = id; });
  assert.equal(container.children.length, 5);
  assert.equal((container.children[0].innerHTML.match(/<li /g) || []).length, 5);
  const generatorButton = container.children[0].children[0];
  assert.equal(generatorButton.disabled, false);
  generatorButton.handlers.click();
  assert.equal(chosen, 'generator');
  assert.equal(container.children[1].children[0].disabled, true);
});
