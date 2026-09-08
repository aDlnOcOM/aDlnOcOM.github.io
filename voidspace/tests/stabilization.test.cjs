const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const context = vm.createContext({ window: {} });
for (const name of ['utils', 'modules', 'inventory', 'ship']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${name}.js`), 'utf8'), context);
}
const { Ship } = context.window.Voidspace;
const moduleAt = (type, gx, gy, rotation = 0) => ({ type, gx, gy, rotation });
function makeShip(extra = [], enabled = true) {
  return new Ship({ modules: [moduleAt('core', 0, 0), moduleAt('computer', 0, 1), ...extra], inertiaDampingEnabled: enabled });
}
function simulate(ship, seconds, keys = [], fps = 60) {
  for (let i = 0; i < seconds * fps; i++) ship.update(1 / fps, new Set(keys), { x: 100, y: 0 });
}
test('computer stops translation and rotation with bounded core actuators', () => {
  for (const fps of [30, 60, 144]) {
    const ship = makeShip();
    ship.angle = 1.2; ship.vx = 20; ship.vy = -15; ship.angularVelocity = 0.4;
    simulate(ship, 20, [], fps);
    assert.ok(Math.hypot(ship.vx, ship.vy) < 0.01);
    assert.ok(Math.abs(ship.angularVelocity) < 0.001);
  }
});
test('only braking-facing engine activates for forward drift', () => {
  const ship = makeShip([moduleAt('thruster', 1, 0, 2), moduleAt('thruster', -1, 0)]);
  ship.vx = 30;
  simulate(ship, 1 / 60);
  const levels = [...ship.engineStates.values()].map((state) => state.throttle);
  assert.ok(levels[0] > 0);
  assert.equal(levels[1], 0);
  assert.ok(ship.vx < 30);
});
test('disabled or removed computer preserves free drift', () => {
  for (const missing of [false, true]) {
    const ship = makeShip([], missing);
    if (missing) { ship.modules = ship.modules.filter((m) => m.type !== 'computer'); ship.recalculateStats(); }
    ship.vx = 20;
    simulate(ship, 5);
    assert.ok(ship.vx > 18);
  }
});
test('manual controls override automation, including opposed held keys', () => {
  for (const keys of [['KeyW'], ['KeyW', 'KeyS'], ['KeyQ'], ['KeyD']]) {
    const enabled = makeShip(); const disabled = makeShip([], false);
    for (const ship of [enabled, disabled]) { ship.vx = 10; ship.angularVelocity = 0.2; simulate(ship, 1, keys); }
    assert.equal(enabled.vx, disabled.vx);
    assert.equal(enabled.vy, disabled.vy);
    assert.equal(enabled.angularVelocity, disabled.angularVelocity);
  }
});
test('toggle persists and older saves gain access to the computer', () => {
  const ship = makeShip([], false);
  assert.equal(new Ship(ship.serialize()).inertiaDampingEnabled, false);
  assert.ok(new Ship({ unlocked: ['core'] }).unlocked.has('computer'));
  assert.equal(new Ship().canStabilize(), false);
  ship.stats.energyUse = 100;
  assert.equal(ship.canStabilize(), false);
});
test('asymmetric braking engine reduces combined motion without runaway spin', () => {
  const ship = makeShip([moduleAt('thruster', 1, 2, 2)]);
  ship.vx = 30; ship.vy = 8; ship.angularVelocity = -0.3;
  simulate(ship, 35);
  assert.ok(Math.hypot(ship.vx, ship.vy) < 0.05);
  assert.ok(Math.abs(ship.angularVelocity) < 0.01);
});
