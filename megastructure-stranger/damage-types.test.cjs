const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load() {
  const node = () => ({ dataset: {}, width: 960, height: 600, getContext: () => ({}), addEventListener() {}, appendChild() {} });
  const scope = { window: { addEventListener() {}, requestAnimationFrame() {} }, document: { getElementById: node, createElement: node },
    performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(scope);
  for (const file of ['damage-types.js', 'power-inventory.js', 'equipment.js', 'security-ai.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), scope);
  scope.window.PowerInventory.render = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.test = { state, progression, damageEnemy, createEnemyBullet, createPowerStock }; })();'), scope);
  return { damage: scope.window.DamageTypes, power: scope.window.PowerInventory, ...scope.window.test };
}
test('all enemies have four bounded susceptibilities and separate attack types', () => {
  const { damage } = load();
  assert.equal(Object.keys(damage.types).length, 4);
  for (const [enemy, values] of Object.entries(damage.profiles)) {
    assert.equal(values.length, 4); assert.ok(values.every(n => n > 0 && n <= 1.5));
    assert.ok(damage.types[damage.attacks[enemy]]);
  }
  assert.ok(damage.resolve(10, 'turret', 'mechanical') > damage.resolve(10, 'turret', 'ballistic'));
});
test('actual impacts apply the susceptibility and tag particles with the source damage type', () => {
  const { state, damageEnemy } = load();
  const enemy = { type: 'turret', health: 100, x: 0, y: 0 };
  damageEnemy(enemy, 10, 'mechanical');
  assert.equal(enemy.health, 87);
  assert.ok(state.particles.some(particle => particle.damageType === 'mechanical'));
});
test('weapon conversions create corresponding magazines and supply boxes; incompatible ammo is rejected', () => {
  const { progression, createPowerStock, power } = load();
  for (const [choice, type, reserve] of [[null, 'energy', 150], ['incendiary', 'elemental', 90], ['armor-piercing', 'ballistic', 120], ['flechette', 'mechanical', 60]]) {
    progression.equipment.smg.ammo.choice = choice;
    const stock = createPowerStock(); assert.equal(stock.type, type); assert.equal(stock.battery, reserve);
    assert.ok(stock.magazines.every(item => item.type === type));
  }
  const stock = power.create(32); stock.magazines[0].type = 'ballistic';
  assert.equal(power.fire(stock), false); assert.equal(power.startRefill(stock, 0), false);
});
test('enemy projectiles retain a configurable damage-type field independent of defenses', () => {
  const { state, createEnemyBullet } = load();
  createEnemyBullet({ type: 'marksman', x: 0, y: 0 }, 0, 300, 12, '#fff');
  assert.equal(state.bullets.at(-1).damageType, 'ballistic');
  createEnemyBullet({ type: 'marksman', damageType: 'elemental', x: 0, y: 0 }, 0, 300, 12, '#fff');
  assert.equal(state.bullets.at(-1).damageType, 'elemental');
});
