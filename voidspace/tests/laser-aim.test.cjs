const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const context = vm.createContext({ window: {} });
for (const file of ["utils", "modules", "inventory", "entities", "ship", "game"]) {
  const filename = path.join(__dirname, "..", "js", `${file}.js`);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}
const { Ship, Game } = context.window.Voidspace;
const halfArc = Math.PI / 4;
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const laser = (rotation, gx = 1, gy = 0) => ({ type: "laser", gx, gy, rotation });
const makeShip = (modules, angle = 0) => new Ship({
  x: 120,
  y: -80,
  angle,
  modules: [{ type: "core", gx: 0, gy: 0, rotation: 0 }, ...modules],
});
const targetFrom = (center, angle, distance = 180) => ({
  x: center.x + Math.cos(angle) * distance,
  y: center.y + Math.sin(angle) * distance,
});

test("every laser stays within its forward 90-degree sector, including angle wrap", () => {
  for (const shipAngle of [-4 * Math.PI + 0.2, -Math.PI, -0.8, 0, 0.71, Math.PI, 4 * Math.PI + 0.2]) {
    for (const rotation of [-1, 0, 1, 2, 3, 4]) {
      const ship = makeShip([laser(rotation)], shipAngle);
      const center = ship.localToWorld(30, 0);
      const forward = shipAngle + rotation * Math.PI / 2;
      for (const delta of [-Math.PI, -Math.PI / 2, -halfArc - 0.001, -halfArc, 0, halfArc, halfArc + 0.001, Math.PI / 2]) {
        const [mount] = ship.getLaserMounts(targetFrom(center, forward + delta));
        const actualDelta = wrap(mount.angle - forward);
        assert.ok(Math.abs(actualDelta) <= halfArc + 1e-9);
        if (Math.abs(delta) <= halfArc) near(actualDelta, delta);
        else near(Math.abs(actualDelta), halfArc);
        near(Math.hypot(mount.origin.x - center.x, mount.origin.y - center.y), 23);
        near(wrap(Math.atan2(mount.origin.y - center.y, mount.origin.x - center.x) - mount.angle), 0);
      }
    }
  }
});

test("mount position and orientation determine each laser's own aim", () => {
  const ship = makeShip([laser(0, 1, -2), laser(1, 2, 0)]);
  const target = ship.localToWorld(150, 0);
  const [forward, sideways] = ship.getLaserMounts(target);
  near(forward.angle, Math.atan2(60, 120));
  near(sideways.angle, halfArc);
});

test("pointer at the mount center uses that module's forward direction", () => {
  const ship = makeShip([laser(2)], 0.71);
  const [mount] = ship.getLaserMounts(ship.localToWorld(30, 0));
  near(wrap(mount.angle - (ship.angle + Math.PI)), 0);
});

test("mining cannot follow the cursor behind a forward-facing laser", () => {
  const ship = makeShip([laser(0)], 0.71);
  const center = ship.localToWorld(30, 0);
  const target = targetFrom(center, ship.angle + Math.PI);
  let damage = 0;
  const game = {
    ship,
    laserBeams: [],
    asteroids: [{ ...target, radius: 4, dead: false, damage: (amount) => { damage += amount; } }],
  };
  Game.prototype.fireMiningLaser.call(game, 1, target);
  assert.equal(damage, 0);
  assert.equal(game.laserBeams.length, 1);
  const { origin, end } = game.laserBeams[0];
  near(Math.abs(wrap(Math.atan2(end.y - origin.y, end.x - origin.x) - ship.angle)), halfArc);
});

test("mining works throughout the allowed sector of a rotated mount", () => {
  for (const delta of [-halfArc, 0, halfArc]) {
    const ship = makeShip([laser(1)], 0.71);
    const center = ship.localToWorld(30, 0);
    const target = targetFrom(center, ship.angle + Math.PI / 2 + delta);
    let damage = 0;
    const game = {
      ship,
      laserBeams: [],
      asteroids: [{ ...target, radius: 4, dead: false, damage: (amount) => { damage += amount; } }],
    };
    Game.prototype.fireMiningLaser.call(game, 1, target);
    near(damage, 33);
    const { end } = game.laserBeams[0];
    near(Math.hypot(end.x - target.x, end.y - target.y), 4);
  }
});
