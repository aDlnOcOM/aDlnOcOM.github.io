const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const context = vm.createContext({ window: { localStorage: { getItem: () => null } } });
for (const file of ['utils', 'modules', 'content', 'engineering-content', 'engineering', 'inventory', 'entities', 'station', 'collisions', 'ship', 'world', 'weapons', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
}
const VS = context.window.Voidspace;
const m = (type, gx, gy, rotation = 0) => ({ type, gx, gy, rotation });
function fixture(modules = [m('core', 0, 0), m('beam', 1, 0), m('cargo', 2, 0), m('thruster', 3, 0, 2)]) {
  const ship = new VS.Ship({ x: 10000, y: 0, modules });
  const game = { ship, station: new VS.Station(), asteroids: [], asteroidsMined: 0, input: new Set(), mouse: {}, save() {}, notify() {} };
  const world = new VS.Expedition(game, { seed: 12 });
  return { ship, game, world };
}

test('player bridge destruction detaches its cargo and engine without transferring overkill to core', () => {
  const { ship, world } = fixture();
  ship.engineering.damage(ship.modules[1], 10000);
  assert.equal(ship.modules.length, 1);
  assert.equal(ship.modules[0].type, 'core');
  assert.equal(ship.hp, VS.ModuleSystem.MODULES.core.hp);
  assert.equal(ship.stats.thrust, 0);
  assert.equal(ship.stats.cargo, VS.ModuleSystem.MODULES.core.cargo);
  assert.equal(ship.engineering.nodes.size, 1);
  VS.WeaponSystem.update(world, 0.016);
  assert.equal(world.debris.length, 3);
  assert.equal(world.debris.filter(p => p.type === 'thruster').length, 1);
});

test('partial damage stays local and repair restores only surviving modules', () => {
  const { ship } = fixture();
  const before = ship.hp;
  ship.engineering.damage(ship.modules[2], 10, 'heat');
  assert.equal(ship.engineering.nodes.get('0,0').integrity, 100);
  assert.equal(ship.hp, before - 10);
  ship.engineering.repair(3); assert.equal(ship.hp, before - 7);
  ship.engineering.destroy(ship.modules[3]);
  ship.engineering.repair(); assert.ok(!ship.modules.some(n => n.type === 'thruster'));
  assert.equal(ship.hp, ship.stats.maxHp);
});

test('a redundant structural path prevents detachment; corner contact does not connect', () => {
  const { ship } = fixture([m('core', 0, 0), m('beam', 1, 0), m('cargo', 2, 0), m('hull', 0, 1), m('hull', 1, 1), m('hull', 2, 1)]);
  ship.engineering.destroy(ship.modules[1]); assert.ok(ship.modules.some(n => n.type === 'cargo'));
  const connected = VS.ModuleSystem.connectedToCore([m('core', 0, 0), m('hull', 1, 1)]);
  assert.equal(connected.size, 1);
});

test('capsule loss causes death, disconnects every other block, and cannot be passively repaired', () => {
  const { ship, game } = fixture();
  ship.engineering.damage(ship.modules[0], 10000);
  assert.equal(ship.hp, 0); assert.equal(ship.modules.length, 1);
  assert.equal(VS.Combat.rayModules(ship, { x: 9900, y: 0 }, { x: 1, y: 0 }, 200), null);
  ship.engineering.repair(); assert.equal(ship.hp, 0);
  game.expedition = { safeAt: () => true };
  VS.Game.prototype.stationSafety.call(game, 1); assert.equal(ship.hp, 0);
  const restored = new VS.Ship(ship.serialize()); assert.equal(restored.hp, 0);
  assert.equal(restored.engineering.nodes.get('0,0').integrity, 0);
});

test('player destruction and local integrity survive saving', () => {
  const { ship } = fixture();
  ship.engineering.damage(ship.modules[0], 20, 'heat');
  ship.engineering.destroy(ship.modules[1]);
  const restored = new VS.Ship(ship.serialize());
  assert.equal(restored.modules.length, 1); assert.equal(restored.hp, 80);
  assert.equal(restored.engineering.nodes.get('0,0').integrity, 80);
});

test('frame upgrades keep HUD health equal to surviving module health', () => {
  const { ship } = fixture();
  ship.engineering.damage(ship.modules[0], 20, 'heat');
  ship.upgradeLevel++; ship.recalculateStats();
  assert.equal(ship.engineering.nodes.get('0,0').integrity, 88);
  const sum = [...ship.engineering.nodes.values()].reduce((total, n) => total + n.integrity, 0);
  assert.ok(Math.abs(ship.hp - sum) < 0.01);
});

test('every visible allied station part belongs to its command node', () => {
  const station = new VS.Station();
  assert.equal(station.modules.length, station.template.length);
  assert.equal(VS.ModuleSystem.connectedToCore(station.modules).size, station.modules.length);
  assert.equal(new Set(station.modules.map(m => m.id)).size, station.modules.length);
});

test('station dock separates on connector loss while central protection remains functional', () => {
  const { game, world } = fixture();
  const station = game.station;
  station.damage(station.modules.find(n => n.id === 'connector-0'), 10000, world);
  assert.ok(!station.modules.some(n => n.role === 'dock'));
  assert.equal(station.isDocked({ x: -275, y: 0 }), false);
  assert.equal(station.isSafe({ x: 0, y: 0 }), true);
  assert.ok(world.debris.length > 20);
});

test('losing both generator supports disables station field, capsule loss destroys the station', () => {
  const station = new VS.Station();
  for (const id of ['connector-2', 'connector-3']) station.damage(station.modules.find(n => n.id === id), 10000);
  assert.equal(station.dead, false); assert.equal(station.powered, false);
  assert.equal(station.isSafe({ x: 0, y: 0 }), false);
  assert.equal(station.dockOnline, false);
  station.damage(station.modules.find(n => n.id === 'command'), 10000);
  assert.equal(station.dead, true); assert.equal(station.modules.length, 0);
});

test('projectiles hit actual station rectangles and pass through a destroyed connector', () => {
  const { game, world } = fixture();
  const origin = { x: -82.5, y: -80 }, direction = { x: 0, y: 1 };
  let contact = VS.WeaponSystem.hit(world, origin, direction, 160, 'player');
  assert.equal(contact.station, game.station); assert.equal(contact.module.id, 'connector-0');
  assert.equal(contact.distance, 69);
  game.station.damage(contact.module, 10000, world);
  contact = VS.WeaponSystem.hit(world, origin, direction, 160, 'player');
  assert.equal(contact, null);
});

test('both factions can damage station sections; safe fields do not make their own hull invulnerable', () => {
  for (const faction of ['player', 'enemy']) {
    const { game, world } = fixture();
    const part = game.station.modules.find(n => n.id === 'connector-0');
    world.bullets.push({ x: -82.5, y: -80, vx: 0, vy: 1000, remaining: 180, damage: 10000, faction, colour: '#fff', weapon: { kind: 'ballistic' } });
    VS.WeaponSystem.update(world, 0.1);
    assert.ok(!game.station.modules.includes(part)); assert.equal(world.bullets.length, 0);
  }
});

test('allied damage and destroyed station states persist with the expedition', () => {
  const { game, world } = fixture();
  game.station.damage(game.station.modules.find(n => n.id === 'connector-0'), 10000, world);
  const station = world.stations.find(s => !s.hostile);
  station.damage(station.modules.find(n => n.id === 'command'), 10000, world);
  const save = world.serialize();
  const restoredGame = { ...game, station: new VS.Station() };
  const restored = new VS.Expedition(restoredGame, save);
  assert.equal(restoredGame.station.has('connector-0'), false);
  assert.equal(restored.stations.find(s => s.id === station.id).dead, true);
});

test('partially destroyed enemy outposts do not rebuild lost blocks on reload', () => {
  const { game, world } = fixture();
  const station = world.stations.find(s => s.hostile);
  const outpost = world.spawnOutpost(station); world.enemies.push(outpost);
  const target = outpost.ship.modules.find(n => n.type === 'hauler_gun');
  outpost.damage(target, 10000, world);
  const remaining = outpost.ship.modules.length;
  const restored = new VS.Expedition({ ...game, station: new VS.Station() }, world.serialize());
  const restoredOutpost = restored.spawnOutpost(restored.stations.find(s => s.id === station.id));
  assert.equal(restoredOutpost.ship.modules.length, remaining);
  assert.ok(!restoredOutpost.ship.modules.some(n => n.gx === target.gx && n.gy === target.gy));
});

test('navigation and radar stay safe when all allied stations are gone', () => {
  const { game, world } = fixture();
  for (const station of world.friendlyStations()) station.damage(station.modules.find(n => n.id === 'command'), 10000, world);
  game.expedition = world;
  assert.equal(world.friendlyStations().length, 0);
  assert.doesNotThrow(() => VS.Game.prototype.drawStationIndicator.call(game));
});
