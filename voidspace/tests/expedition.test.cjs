const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = vm.createContext({ window: { localStorage: { getItem: () => null } } });
for (const name of ['utils', 'modules', 'content', 'inventory', 'entities', 'station', 'ship', 'world']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), sandbox);
const { Content, ModuleSystem, Ship, Station, Expedition, Combat } = sandbox.window.Voidspace;
const clone = (v) => JSON.parse(JSON.stringify(v));
function fixture() {
  const game = { ship: new Ship({ credits: 5000 }), station: new Station(), asteroidsMined: 0, asteroids: [], mouse: { down: false }, input: new Set(), save() {}, notify() {} };
  const world = new Expedition(game, { seed: 12 }); game.expedition = world;
  return { game, world };
}
test('all standard enemies have valid connected, powered blueprints', () => {
  for (const blueprint of Content.ENEMIES) assert.equal(Content.validateBlueprint(blueprint).modules.length, blueprint.modules.length);
});
test('every class starter is connected, powered, and has finite stats', () => {
  for (const definition of Object.values(Content.CLASSES)) {
    const stats = ModuleSystem.calculateStats(definition.modules);
    assert.ok(ModuleSystem.isConnected(definition.modules));
    assert.ok(stats.energyUse <= stats.energy);
    assert.ok(Number.isFinite(stats.maxHp));
    for (const m of definition.modules) assert.equal(ModuleSystem.getPlacementConflict(definition.modules.filter((other) => other !== m), m), null);
  }
});
test('imports reject unknown blocks, duplicates, disconnected structures and obstructed exhaust', () => {
  const base = clone(Content.ENEMIES[0]);
  for (const edit of [b => b.modules[1].type = '__proto__', b => b.modules.push(clone(b.modules[0])), b => b.modules[1].gx = 10,
    b => b.modules.push({ type: 'hull', gx: -2, gy: 0, rotation: 0 }), b => b.modules[0].gx = Infinity]) {
    const value = clone(base); edit(value); assert.throws(() => Content.validateBlueprint(value));
  }
});
test('deterministic biomes protect the initial region and difficulty is bounded', () => {
  const { game, world } = fixture();
  assert.equal(world.biome().danger, 0);
  assert.equal(Content.biomeAt(3000, 1000, 12).id, Content.biomeAt(3000, 1000, 12).id);
  game.ship.x = 100000; world.kills = 10000;
  assert.equal(world.difficulty(), 8);
});
test('license purchase is atomic and class layouts persist without duplicating credits', () => {
  const { game, world } = fixture();
  assert.ok(world.buyLicense('scout'));
  assert.equal(game.ship.credits, 4550);
  assert.equal(world.buyLicense('scout'), false);
  const oldModules = JSON.stringify(game.ship.modules);
  assert.ok(world.switchClass('scout'));
  assert.equal(game.ship.shipClass, 'scout');
  assert.equal(game.ship.credits, 4550);
  assert.ok(world.switchClass('miner'));
  assert.equal(JSON.stringify(game.ship.modules), oldModules);
  assert.equal(game.ship.credits, 4550);
  game.ship.x = 3000;
  assert.equal(world.buyLicense('hauler'), false);
});
test('class-specific blocks cannot be installed on other ships', () => {
  const { game } = fixture(); game.ship.unlocked.add('hauler_hold');
  assert.equal(game.ship.addModule('hauler_hold', 0, 1, 0).ok, false);
});
test('translated friendly stations have local docking and safety zones', () => {
  const station = new Station(); station.x = 2000; station.y = -2000;
  assert.ok(station.isDocked({ x: 1725, y: -2000 }));
  assert.ok(station.isSafe({ x: 1900, y: -2000 }));
  assert.equal(station.isDocked({ x: -275, y: 0 }), false);
});
test('swept module collision hits rotated ships without tunnelling', () => {
  const ship = new Ship({ modules: [{ type: 'core', gx: 0, gy: 0, rotation: 0 }] }); ship.x = 0; ship.y = 0; ship.angle = Math.PI / 4;
  const hit = Combat.rayModules(ship, { x: -100, y: 0 }, { x: 1, y: 0 }, 200);
  assert.ok(hit.distance > 78 && hit.distance < 80);
  assert.equal(Combat.rayModules(ship, { x: -100, y: 50 }, { x: 1, y: 0 }, 200), null);
});
test('destroying a core awards once; destroying a gun removes its actuator', () => {
  const { game, world } = fixture();
  const enemy = new Combat.Enemy(Content.ENEMIES[0], 2000, 0);
  enemy.damage(enemy.ship.modules.find((m) => m.type === 'pulse'), 1000, world);
  assert.ok(!enemy.ship.modules.some((m) => m.type === 'pulse'));
  enemy.damage(enemy.ship.modules.find((m) => m.type === 'core'), 1000, world);
  const credits = game.ship.credits; enemy.destroy(world);
  assert.equal(game.ship.credits, credits); assert.equal(world.kills, 1);
});
test('safe starting region never spawns enemies', () => {
  const { world, game } = fixture();
  for (let i = 0; i < 300; i++) world.update(0.05, game.ship);
  assert.equal(world.enemies.length, 0);
});
test('deep space spawns capped modular patrols and projectiles can damage the player', () => {
  const { world, game } = fixture(); game.ship.x = 1900; game.ship.y = 800;
  world.spawnTimer = 0;
  for (let i = 0; i < 800; i++) world.update(0.05, game.ship);
  assert.ok(world.enemies.length > 0 && world.enemies.length <= 7);
  game.ship.hp = game.ship.stats.maxHp;
  const hp = game.ship.hp;
  world.bullets.push({ x: game.ship.x - 90, y: game.ship.y, vx: 1000, vy: 0, remaining: 200, damage: 20, faction: 'enemy', colour: '#f88' });
  world.update(0.1, game.ship);
  assert.ok(game.ship.hp < hp);
});
test('contracts are claimable only once at friendly docks', () => {
  const { game, world } = fixture(); world.contract = { kind: 'mine', target: 5, start: 0, reward: 140 }; game.asteroidsMined = 5;
  assert.ok(world.claimContract()); assert.equal(world.contracts, 1); assert.equal(game.ship.credits, 5140);
  assert.equal(world.claimContract(), false);
  const restored = new Expedition(game, world.serialize()); assert.equal(restored.contracts, 1); assert.equal(restored.seed, 12);
});

test('all licensed ships can thrust, coast, stabilize and serialize', () => {
  for (const [id, definition] of Object.entries(Content.CLASSES)) {
    const ship = new Ship({ modules: clone(definition.modules), shipClass: id });
    for (let i = 0; i < 300; i++) ship.update(1 / 60, new Set(i < 120 ? ['KeyW'] : []), { x: 300, y: 0 });
    assert.ok(Number.isFinite(ship.x) && Number.isFinite(ship.y) && Number.isFinite(ship.angle));
    assert.equal(new Ship(ship.serialize()).shipClass, id);
  }
});
test('corrupt module saves and inventory data cannot poison simulation', () => {
  const ship = new Ship({ modules: [{ type: '__proto__', gx: 0, gy: 0 }], credits: -4, inventory: { feNi: -10, ice: Infinity } });
  assert.equal(ship.modules[0].type, 'core');
  assert.equal(ship.inventory.used, 0); assert.equal(ship.credits, 0);
  ship.update(0.02, new Set(), { x: 100, y: 0 });
  assert.ok(Number.isFinite(ship.x));
});
test('enemy projectiles cannot damage ships in any friendly safety field', () => {
  const { game, world } = fixture();
  for (const station of world.friendlyStations()) {
    game.ship.x = station.x; game.ship.y = station.y;
    const hp = game.ship.hp;
    world.bullets.push({ x: game.ship.x - 90, y: game.ship.y, vx: 1000, vy: 0, remaining: 200, damage: 200, faction: 'enemy', colour: '#f88' });
    world.update(0.1, game.ship);
    assert.equal(game.ship.hp, hp);
  }
});
