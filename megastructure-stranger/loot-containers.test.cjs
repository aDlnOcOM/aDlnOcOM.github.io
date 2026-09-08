const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load() {
  const scope = { window: {} }; vm.createContext(scope);
  for (const file of ['sectors.js', 'security-ai.js', 'loot-containers.js', 'power-inventory.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), scope);
  return { gen: scope.window.SectorGenerator, ai: scope.window.SecurityAI, loot: scope.window.LootContainers, power: scope.window.PowerInventory };
}
test('loot positions are deterministic, reachable and outside walls and the patrol passage', () => {
  const { gen, ai, loot } = load();
  for (let seed = 0; seed < 25; seed++) {
    const map = gen.generate(10, 960, 600, seed);
    const crates = loot.generate(map.sectors, map.walls, seed, gen.seeded, ai.clear, ai.route);
    assert.equal(crates.length, 20);
    assert.equal(JSON.stringify(crates), JSON.stringify(loot.generate(map.sectors, map.walls, seed, gen.seeded, ai.clear, ai.route)));
    assert.equal(new Set(crates.map(crate => crate.id)).size, crates.length);
    for (const crate of crates) {
      const sector = map.sectors[Math.floor(crate.x / 960)];
      assert.ok(ai.clear(crate, crate, map.walls, 28));
      assert.ok(Math.abs(crate.y - sector.lane) >= 90);
      assert.ok(ai.route({ x: crate.x, y: sector.lane }, crate, map.walls, 18).length);
      assert.ok(Math.hypot(crate.x - 84, crate.y - 432) > 28);
    }
  }
});
test('opening is one-shot and incompatible ammo cannot refill the equipped weapon', () => {
  const { loot, power } = load(), stock = power.create(32);
  const compatible = { opened: false, salvage: 8, ammoType: 'energy', ammo: 30 };
  assert.equal(loot.collect(compatible, stock).salvage, 8); assert.equal(stock.battery, 180);
  assert.equal(loot.collect(compatible, stock), null); assert.equal(stock.battery, 180);
  loot.collect({ opened: false, salvage: 5, ammoType: 'ballistic', ammo: 20 }, stock);
  assert.equal(stock.extraSupplies.ballistic, 20); assert.equal(stock.battery, 180);
});
