const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = vm.createContext({ window: { localStorage: { getItem: () => null } } });
for (const file of ['utils', 'modules', 'content', 'engineering-content', 'engineering', 'inventory', 'entities', 'station', 'collisions', 'ship', 'world', 'weapons', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const VS = sandbox.window.Voidspace, P = VS.Physics;
const m = (type, gx = 0, gy = 0, rotation = 0) => ({ type, gx, gy, rotation });
const ship = (x = 6000, y = 0, modules = [m('core')]) => new VS.Ship({ x, y, modules });
const contact = (a, b) => P.findContact(P.shapes(a), P.shapes(b));
function rock(x, y, radius = 30) {
  const asteroid = new VS.Entities.Asteroid(x, y, 'iron', 1);
  asteroid.radius = radius; asteroid.vx = asteroid.vy = 0; return asteroid;
}
function fixture(player = ship()) {
  const game = { ship: player, station: new VS.Station(), asteroids: [], particles: [], pickups: [], asteroidsMined: 0, mouse: {}, input: new Set(), notify() {}, save() {} };
  const world = new VS.Expedition(game, { seed: 12 }); world.stations = []; game.expedition = world;
  return { game, world };
}

test('square module corners collide instead of using inscribed enemy circles', () => {
  const a = ship(0, 0), b = ship(28, 28);
  assert.ok(contact(a, b)?.penetration > 1.9);
  b.angle = Math.PI / 4; b.x = 34; b.y = 0;
  assert.ok(contact(a, b)?.penetration > 2);
  b.x = 38; assert.equal(contact(a, b), null);
});

test('real station beams are solid but the dock interior and its entrance remain open', () => {
  const station = new VS.Station(), player = ship(-275, 0);
  assert.equal(contact(player, station), null);
  player.x = -450; assert.equal(contact(player, station), null);
  player.x = -82.5; player.y = 25;
  const collision = contact(player, station);
  assert.equal(collision.otherModule.id, 'connector-0');
  assert.ok(Math.abs(collision.penetration - 1) < 0.001);
  player.x = -125; player.y = 0; assert.ok(contact(player, station));
});

test('collision checks the full long ship even when command capsules are over 250 units apart', () => {
  const a = ship(0, 0, [m('core'), ...Array.from({ length: 16 }, (_, i) => m('hull', i + 1))]);
  const b = ship(480, 29);
  assert.equal(contact(a, b).module.gx, 16);
});

test('destroyed station sections and dead command capsules leave no invisible collision', () => {
  const { game, world } = fixture(ship(-82.5, 25));
  game.station.damage(game.station.modules.find(n => n.id === 'connector-0'), 10000, world);
  assert.equal(contact(game.ship, game.station), null);
  game.ship.engineering.damage(game.ship.modules[0], 10000);
  assert.equal(game.ship.getCircleCollision(game.ship.x, game.ship.y, 20), null);
});

test('resting overlap is separated without manufacturing velocity or collision damage', () => {
  const { game, world } = fixture(); const asteroid = rock(6038, 0); game.asteroids.push(asteroid);
  const hp = game.ship.hp, rockHp = asteroid.hp;
  for (let i = 0; i < 8; i++) P.solve(world, 1 / 120);
  assert.equal(game.ship.vx, 0); assert.equal(asteroid.vx, 0);
  assert.equal(game.ship.hp, hp); assert.equal(asteroid.hp, rockHp);
  assert.ok(!contact(game.ship, asteroid));
});

test('an already separating contact is not bounced again', () => {
  const a = ship(), b = rock(6038, 0); a.vx = -12;
  const speed = P.resolvePair(P.actor(a), P.actor(b), contact(a, b));
  assert.equal(speed, 0); assert.equal(a.vx, -12); assert.equal(b.vx, 0);
});

test('collision impulses conserve linear momentum and do not add kinetic energy', () => {
  const a = ship(0, 0), b = ship(29, 5); a.vx = 80; b.vx = -20; a.angularVelocity = 0.1;
  const aa = P.actor(a), bb = P.actor(b);
  const energy = () => [aa, bb].reduce((sum, item) => sum + (item.body.vx ** 2 + item.body.vy ** 2) / item.inverseMass + item.body.angularVelocity ** 2 / item.inverseInertia, 0);
  const momentum = a.vx / aa.inverseMass + b.vx / bb.inverseMass, before = energy();
  P.resolvePair(aa, bb, contact(a, b));
  assert.ok(Math.abs(momentum - a.vx / aa.inverseMass - b.vx / bb.inverseMass) < 1e-8);
  assert.ok(energy() <= before + 1e-8);
});

test('stationary ships hit with rotating outer modules, reducing angular velocity', () => {
  const a = ship(0, 0, [m('core'), m('hull', 1), m('hull', 2), m('hull', 3), m('hull', 4)]), b = rock(120, 38, 30);
  a.angularVelocity = 1;
  const impact = P.resolvePair(P.actor(a), P.actor(b), contact(a, b));
  assert.ok(impact > 100); assert.ok(a.angularVelocity < 1);
});

test('damage cooldown never disables physical separation', () => {
  const { game, world } = fixture(); const asteroid = rock(6038, 0); game.asteroids.push(asteroid); game.ship.vx = 40;
  P.solve(world, 1 / 120); const hp = game.ship.hp;
  game.ship.x = 6000; game.ship.y = 0; game.ship.vx = 40; game.ship.vy = game.ship.angularVelocity = 0;
  asteroid.x = 6038; asteroid.y = 0; asteroid.vx = asteroid.vy = 0;
  P.solve(world, 1 / 120);
  assert.equal(game.ship.hp, hp); assert.ok(!contact(game.ship, asteroid));
});

test('friendly safety protects against impact damage but never makes objects intangible', () => {
  const { game, world } = fixture(ship(-275, 0)); const asteroid = rock(-237, 0); game.asteroids.push(asteroid);
  game.ship.vx = 30; const hp = game.ship.hp;
  P.solve(world, 1 / 120);
  assert.equal(game.ship.hp, hp); assert.ok(!contact(game.ship, asteroid));
});

test('drill contact matches the projecting conical head, not a five-unit invisible bubble', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const a = ship(0, 0, [m('core', -1), m('drill', 0, 0, rotation)]), drill = a.modules[1];
    const [dx, dy] = VS.ModuleSystem.moduleDirection(drill);
    const far = { x: dx * 22, y: dy * 22, radius: 1 }, near = { x: dx * 19.5, y: dy * 19.5, radius: 1 };
    assert.equal(P.drillContact(a, drill, far), null);
    assert.ok(P.drillContact(a, drill, near));
  }
});

test('full-speed drill ramming retains four times nominal drill damage', () => {
  const { game, world } = fixture(ship(6000, 0, [m('core', -1), m('drill')]));
  const asteroid = rock(6000 + 19 + 30 * 0.84 - 0.2, 0); game.asteroids.push(asteroid);
  let damage = 0; asteroid.damage = amount => { damage += amount; };
  game.ship.vx = game.ship.getMaxSpeed(); P.solve(world, 1 / 120);
  assert.ok(Math.abs(damage - 33 * 1.6 * 4) < 0.001, String(damage));
});

test('adaptive motion steps prevent fast hulls tunnelling through narrow station beams', () => {
  const { game, world } = fixture(ship(-82.5, -60)); game.ship.vy = 1200;
  const dt = 0.05, steps = P.stepCount(world, dt);
  for (let i = 0; i < steps; i++) { game.ship.y += game.ship.vy * dt / steps; P.solve(world, dt / steps); }
  assert.ok(game.ship.y < -25); assert.ok(game.ship.vy <= 0);
});

test('step count accounts for long rotating arms even at zero linear speed', () => {
  const { world } = fixture(ship(6000, 0, [m('core'), m('hull', 20)])); world.game.ship.angularVelocity = 2;
  assert.ok(P.stepCount(world, 0.05) > 15);
});

test('construction cannot place a module inside station structure or asteroid', () => {
  const { game, world } = fixture(ship(-185, 0));
  assert.equal(P.placementBlocked(game.ship, [m('hull', 2)], world), true);
  assert.equal(P.placementBlocked(game.ship, [m('hull', -2)], world), false);
  game.asteroids.push(rock(-245, 0)); assert.equal(P.placementBlocked(game.ship, [m('hull', -2)], world), true);
});

test('asteroid collision excludes transparent padding; translated station fields use local coordinates', () => {
  const asteroid = rock(2030, 1000), station = new VS.Station(); station.x = 2000; station.y = 1000;
  assert.equal(asteroid.collisionRadius, 25.2);
  assert.equal(VS.Combat.rayCircle({ x: 2000, y: 1028 }, { x: 1, y: 0 }, 100, asteroid), null);
  asteroid.update(0.1, [station]); assert.ok(asteroid.vx > 0); assert.equal(asteroid.vy, 0);
  station.modules = []; asteroid.vx = 0; asteroid.update(0.1, [station]); assert.equal(asteroid.vx, 0);
});

test('asteroid silhouette rotates consistently for hull impacts, drills and weapon rays', () => {
  const asteroid = { x: 0, y: 0, radius: 40, rotation: 0, collisionHull: [{ x: -0.8, y: -0.2 }, { x: 0.8, y: -0.2 }, { x: 0.8, y: 0.2 }, { x: -0.8, y: 0.2 }] };
  assert.equal(P.rayAsteroid({ x: -100, y: 20 }, { x: 1, y: 0 }, 200, asteroid), null);
  assert.equal(P.rayAsteroid({ x: -100, y: 0 }, { x: 1, y: 0 }, 200, asteroid), 68);
  assert.equal(contact(ship(0, 25), asteroid), null);
  asteroid.rotation = Math.PI / 2;
  assert.equal(P.rayAsteroid({ x: -100, y: 20 }, { x: 1, y: 0 }, 200, asteroid), 92);
  assert.ok(contact(ship(0, 25), asteroid));
});

test('large pre-existing builds can separate from station without an artificial speed kick', () => {
  const player = ship(-175, 0, [m('core'), ...Array.from({ length: 16 }, (_, i) => m('hull', i + 1))]);
  const { world, game } = fixture(player);
  for (let i = 0; i < 10; i++) P.solve(world, 1 / 120);
  assert.equal(contact(player, game.station), null);
  assert.equal(player.vx, 0); assert.equal(player.vy, 0);
});

test('the actual game update applies collision steps before a ship can cross the dock wall', () => {
  const { game, world } = fixture(ship(-240, 0)); Object.setPrototypeOf(game, VS.Game.prototype);
  Object.assign(game, { viewport: { width: 960, height: 540 }, mouse: { x: 800, y: 270 }, camera: { x: -240, y: 0 }, time: 0, saveTimer: 0, maintainAsteroids() {}, updateHud() {}, updateMission() {}, onDeath() {} });
  world.spawnTimer = Infinity; game.ship.vx = 145;
  for (let i = 0; i < 100; i++) game.update(1 / 60);
  assert.ok(game.ship.x < -140);
  assert.ok((contact(game.ship, game.station)?.penetration || 0) < 0.05);
  assert.ok(Math.abs(game.time - 100 / 60) < 1e-8);
});

let raster;
try { raster = require('@napi-rs/canvas'); }
catch { try { raster = require(path.join(path.dirname(process.execPath), '..', 'node_modules', '@napi-rs/canvas')); } catch { /* Optional pixel verification without a new dependency. */ } }
test('all actual asteroid textures produce nonempty convex collision silhouettes', { skip: !raster }, async () => {
  sandbox.document = { createElement: () => raster.createCanvas(1, 1) };
  const images = {};
  for (const definition of Object.values(VS.Entities.METEOR_TYPES)) images[definition.sprite] = await raster.loadImage(path.join(__dirname, '..', 'assets/ores', `${definition.sprite}.png`));
  VS.Entities.prepareAsteroidAssets(images);
  for (const type of Object.keys(VS.Entities.METEOR_TYPES)) {
    const asteroid = new VS.Entities.Asteroid(0, 0, type);
    assert.ok(asteroid.collisionHull.length >= 3 && asteroid.collisionHull.length <= 24, type);
    assert.ok(asteroid.collisionRadius < asteroid.radius * 1.2);
    for (const point of asteroid.collisionHull) assert.ok(Math.abs(point.x) < 0.87 && Math.abs(point.y) < 0.87);
    assert.ok(P.rayAsteroid({ x: -100, y: 0 }, { x: 1, y: 0 }, 200, asteroid) !== null, type);
    assert.equal(contact(ship(0, 80), asteroid), null);
  }
});
