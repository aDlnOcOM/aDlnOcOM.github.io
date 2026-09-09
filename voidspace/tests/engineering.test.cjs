const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const context = vm.createContext({ window: { localStorage: { getItem: () => null } } });
for (const name of ['utils', 'modules', 'content', 'engineering-content', 'engineering', 'inventory', 'entities', 'station', 'ship', 'world', 'weapons', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), context);
const VS = context.window.Voidspace;
const { MODULES, assemblyCells } = VS.ModuleSystem;
const m = (type, gx, gy, rotation = 0) => ({ type, gx, gy, rotation });
const makeShip = (modules) => new VS.Ship({ modules: [m('core', -1, 0), ...modules], credits: 10000 });
const advance = (ship, seconds) => { for (let i = 0; i < seconds * 40; i++) ship.engineering.step(0.025); };
function loop() {
  return makeShip([m('nuclear_reactor', 0, 0), m('heat_pipe', 1, 0), m('turbine', 2, 0), m('radiator', 2, 1), m('heat_pipe', 2, 2), m('turbine', 1, 2), m('radiator', 0, 2), m('coolant_pump', 0, 1), m('battery', -1, 1)]);
}
test('closed reactor loop starts only with turbines, cooling and powered pump', () => {
  const ship = loop(); advance(ship, 1);
  assert.equal(ship.engineering.reactorStatus(ship.modules[1]), 'Готов');
  assert.ok(ship.engineering.generation >= 48);
  ship.modules = ship.modules.filter((n) => !(n.gx === 1 && n.gy === 0)); advance(ship, 0.1);
  assert.ok(!ship.engineering.nodes.get('0,0').running);
  assert.ok(ship.engineering.nodes.get('0,0').decay > 0);
  for (const type of ['turbine', 'radiator', 'coolant_pump']) {
    const incomplete = loop(); incomplete.modules.splice(incomplete.modules.findIndex(n => n.type === type), 1); advance(incomplete, 0.2);
    assert.ok(!incomplete.engineering.nodes.get('0,0').running);
  }
});
test('heat transfers through pipes and radiators require exposed surfaces', () => {
  const ship = makeShip([m('heat_pipe', 0, 0), m('radiator', 1, 0)]);
  ship.engineering.nodes.get('0,0').temperature = 200;
  advance(ship, 1);
  assert.ok(ship.engineering.temperature(ship.modules[1]) < 200);
  assert.ok(ship.engineering.temperature(ship.modules[2]) > 20);
  const total = ship.modules.reduce((sum,n) => sum + (ship.engineering.temperature(n) - 20) * MODULES[n.type].heatCapacity, 0);
  assert.ok(total < 3 * 180 + 5);
});
test('power islands do not share energy across ceramic insulators', () => {
  const ship = makeShip([m('ceramic_armor', 0, 0), m('battery', 1, 0), m('laser', 2, 0)]);
  advance(ship, 2);
  assert.equal(ship.engineering.available(ship.modules[3]), 0);
  assert.equal(ship.engineering.request(ship.modules[3], 1), 0);
  assert.equal(ship.engineering.summary().grids, 2);
});
test('boosters work only immediately behind their own tool in all orientations', () => {
  for (let rotation = 0; rotation < 4; rotation++) for (const [tool, support] of [['laser', 'plasma_transformer'], ['drill', 'drill_power']]) {
    const [dx, dy] = VS.ModuleSystem.moduleDirection({ rotation });
    const ship = new VS.Ship({ modules: [m('core', -3, -3), m(tool, 0, 0, rotation), m(support, -dx, -dy), m('rtg', -dx + dy, -dy - dx), m('battery', -dx - dy, -dy + dx)] });
    advance(ship, 3);
    assert.ok(ship.engineering.miningFactor(ship.modules[1], 0.025) > 1.49);
    ship.modules[2].type = support === 'drill_power' ? 'plasma_transformer' : 'drill_power'; ship.engineering.sync();
    assert.ok(ship.engineering.miningFactor(ship.modules[1], 0.025) <= 1);
  }
});
test('overclock requires per-type research and changes output and heat', () => {
  const ship = makeShip([m('laser', 0, 0), m('battery', 0, 1)]); advance(ship, 3);
  const laser = ship.modules[1]; laser.overclock = true;
  assert.equal(ship.engineering.boost(laser), 1);
  ship.research.add('laser'); assert.equal(ship.engineering.boost(laser), 1.6);
  const before = ship.engineering.temperature(laser); ship.engineering.miningFactor(laser, 0.025);
  assert.ok(ship.engineering.temperature(laser) > before);
  const restored = new VS.Ship(ship.serialize()); assert.equal(restored.engineering.boost(restored.modules[1]), 1.6);
});
test('colossal weapon occupies exactly 48 cells and demolishes as one assembly', () => {
  for (const rotation of [0,1,2,3]) {
    const cells = assemblyCells(m('thermo_resonator', 0, 0, rotation));
    assert.equal(cells.length, 48); assert.equal(new Set(cells.map(n => `${n.gx},${n.gy}`)).size, 48);
  }
  const ship = makeShip([]); ship.unlocked.add('thermo_resonator');
  assert.ok(ship.addModule('thermo_resonator', 0, 0, 0).ok);
  assert.equal(ship.modules.length, 49);
  assert.equal(ship.addModule('hull', 10, 0, 0).ok, false);
  const restored = new VS.Ship(ship.serialize()); assert.equal(restored.modules.filter(n => n.assembly).length, 48);
  assert.ok(ship.removeModule(10, 0).ok); assert.equal(ship.modules.length, 1);
});
test('factories consume ingredients once and cannot create free nuclear ammo', () => {
  const ship = makeShip([m('nuclear_factory', 0, 0), m('rtg', 0, 1), m('battery', -1, 1)]);
  advance(ship, 20); assert.equal(ship.engineering.stock.nuclear_core, 0);
  ship.inventory.contents.platinum = 2; ship.inventory.contents.rareEarths = 2;
  advance(ship, 20); assert.equal(ship.inventory.contents.platinum, 0); assert.equal(ship.engineering.stock.nuclear_core, 1);
  const factory = ship.engineering.nodes.get('0,0'); factory.recipe = 'nuclear_rocket';
  advance(ship, 15); assert.equal(ship.engineering.stock.nuclear_rocket, 0);
  ship.engineering.stock.casing = 1; ship.engineering.stock.guidance = 1;
  advance(ship, 15); assert.equal(ship.engineering.stock.nuclear_rocket, 1); assert.equal(ship.engineering.stock.nuclear_core, 0);
});
test('thermal weapon consumes only available heat; armor density and penetration matter', () => {
  const ship = makeShip([m('heat_tank', 0, 0), m('thermo_resonator', 1, 0), m('tungsten_armor', 0, 1)]);
  assert.equal(ship.engineering.takeHeat(ship.modules[2], 12000), false);
  ship.engineering.nodes.get('0,0').temperature = 220;
  const total = ship.engineering.heatAvailable(ship.modules[2]);
  assert.ok(ship.engineering.takeHeat(ship.modules[2], 12000));
  assert.ok(Math.abs(ship.engineering.heatAvailable(ship.modules[2]) - total + 12000) < 0.01);
  const armor = ship.modules[3];
  assert.ok(ship.engineering.armorDamage(armor, 100) < ship.engineering.armorDamage(armor, 100, 'kinetic', 0.8));
});
test('overheating melts modules and reactor meltdown emits an explosion event', () => {
  const ship = loop(); ship.engineering.nodes.get('0,0').temperature = 1000;
  advance(ship, 0.05);
  assert.ok(!ship.modules.some(n => n.type === 'nuclear_reactor'));
  assert.ok(ship.engineering.events.some(e => e.nuclear));
});
function battlefield(weapon) {
  const ship = makeShip([m(weapon, 1, 0), m('battery', 0, 0), m('rtg', 0, 1)]); ship.x = 2000; ship.y = 0;
  const game = { ship, station: new VS.Station(), asteroidsMined: 0, asteroids: [], particles: [], pickups: [], mouse: { down: false }, input: new Set(), save() {}, notify() {} };
  const world = new VS.Expedition(game, { seed: 12 });
  const cooldowns = new Map(); return { ship, world, cooldowns };
}
test('ballistics require the correct ammunition and impart recoil', () => {
  const { ship, world, cooldowns } = battlefield('heavy_cannon');
  world.fireWeapons(ship, { x: 2400, y: 0 }, cooldowns, 'player', 0.025);
  assert.equal(world.bullets.length, 0);
  ship.engineering.stock.light_ammo = 10;
  world.fireWeapons(ship, { x: 2400, y: 0 }, cooldowns, 'player', 0.025); assert.equal(world.bullets.length, 0);
  ship.engineering.stock.heavy_ammo = 1;
  world.fireWeapons(ship, { x: 2400, y: 0 }, cooldowns, 'player', 0.025);
  assert.equal(world.bullets.length, 1); assert.equal(ship.engineering.stock.heavy_ammo, 0); assert.ok(ship.vx < 0);
});
test('swarm consumes six specific missiles atomically', () => {
  const { ship, world, cooldowns } = battlefield('swarm_launcher'); ship.engineering.stock.swarm_rocket = 5;
  world.fireWeapons(ship, { x: 2400, y: 0 }, cooldowns, 'player', 0.025); assert.equal(world.bullets.length, 0); assert.equal(ship.engineering.stock.swarm_rocket, 5);
  ship.engineering.stock.swarm_rocket = 6;
  world.fireWeapons(ship, { x: 2400, y: 0 }, cooldowns, 'player', 0.025); assert.equal(world.bullets.length, 6); assert.equal(ship.engineering.stock.swarm_rocket, 0);
});

test('all weapons have an explicit resource and missile recipes have real inputs', () => {
  for (const def of Object.values(MODULES).filter(n => n.weapon)) {
    const w = def.weapon;
    assert.ok(w.ammo || w.energy > 0 || w.heatCost > 0, def.name);
    if (w.ammo) { assert.ok(VS.EngineeringData.STOCK[w.ammo]); assert.ok(VS.EngineeringData.RECIPES[w.ammo]); }
  }
});

test('energy beams cannot fire on an empty network and spend charge on an actual shot', () => {
  const { ship, world, cooldowns } = battlefield('laser_turret');
  world.fireWeapons(ship, { x: 2350, y: 0 }, cooldowns, 'player', 0.025);
  assert.equal(world.weaponBeams?.length || 0, 0);
  advance(ship, 3);
  const gun = ship.modules[1], before = ship.engineering.available(gun);
  world.fireWeapons(ship, { x: 2350, y: 0 }, cooldowns, 'player', 0.025);
  assert.equal(world.weaponBeams.length, 1);
  assert.ok(Math.abs(ship.engineering.available(gun) - before + 9) < 0.001);
});

test('EMP disables energy weapons and shields but not ballistic ammunition', () => {
  const ship = makeShip([m('laser_turret', 0, 0), m('heavy_cannon', 1, 0), m('shield', 0, 1), m('rtg', -1, 1)]);
  advance(ship, 1);
  const guarded = ship.engineering.shieldDamage(100, 'energy'); assert.ok(guarded < 100);
  ship.engineering.applyEmp(6);
  assert.equal(ship.engineering.online(ship.modules[1]), false);
  assert.equal(ship.engineering.online(ship.modules[2]), true);
  assert.equal(ship.engineering.shieldDamage(100, 'energy'), 100);
});

test('destroying a large hot assembly during a heat tick is safe', () => {
  const ship = makeShip(assemblyCells(m('tesla_coil', 0, 0)));
  for (const node of ship.engineering.nodes.values()) if (node.type !== 'core') node.temperature = 1200;
  assert.doesNotThrow(() => advance(ship, 0.1));
  assert.equal(ship.modules.length, 1);
  assert.ok(Number.isFinite(ship.hp));
});

test('active production, thermal state, battery charge and stocks survive save reload', () => {
  const ship = makeShip([m('ammo_factory', 0, 0), m('battery', 0, 1), m('rtg', -1, 1)]);
  ship.inventory.contents.feNi = 1; advance(ship, 1);
  const restored = new VS.Ship(ship.serialize());
  assert.equal(restored.inventory.contents.feNi, 0);
  assert.ok(restored.engineering.nodes.get('0,0').job.progress > 0);
  assert.equal(restored.engineering.summary().stored, ship.engineering.summary().stored);
  advance(restored, 4); assert.equal(restored.engineering.stock.light_ammo, 20);
});

test('large enemy blueprints reject extra or misrotated assembly sections', () => {
  const blueprint = { name: 'Test', modules: [m('core', -1, 0), m('thruster', -2, 0), ...assemblyCells(m('thermo_resonator', 0, 0))] };
  assert.doesNotThrow(() => VS.Content.validateBlueprint(blueprint));
  blueprint.modules.push({ ...m('assembly_section', 16, 0), assembly: '0,0' });
  assert.throws(() => VS.Content.validateBlueprint(blueprint), /секция/);
  blueprint.modules.pop(); blueprint.modules[3].rotation = 1;
  assert.throws(() => VS.Content.validateBlueprint(blueprint), /секци/);
});

test('patrols carry finite conventional ammo and must assemble nuclear rockets', () => {
  const enemy = new VS.Combat.Enemy({ modules: [m('core', 0, 0), m('heavy_cannon', 1, 0), m('thruster', -1, 0)], reward: 50 }, 2000, 0);
  assert.equal(enemy.ship.engineering.stock.heavy_ammo, 24);
  const nuclear = new VS.Combat.Enemy({ modules: [m('core', 0, 0), m('nuclear_launcher', 1, 0), m('nuclear_factory', 0, 1), m('rtg', -1, 1), m('battery', -1, 0)], reward: 50 }, 2000, 0);
  assert.equal(nuclear.ship.engineering.stock.nuclear_rocket, 0);
  advance(nuclear.ship, 18);
  assert.equal(nuclear.ship.engineering.stock.nuclear_core, 1);
  nuclear.ship.engineering.nodes.get('0,1').recipe = 'nuclear_rocket'; advance(nuclear.ship, 14);
  assert.equal(nuclear.ship.engineering.stock.nuclear_rocket, 1);
});

test('thermal cannon fires only after heat storage is charged', () => {
  const { ship, world, cooldowns } = battlefield('thermo_resonator');
  const target = { x: 3000, y: 0 };
  world.fireWeapons(ship, target, cooldowns, 'player', 0.025); assert.equal(world.bullets.length, 0);
  ship.engineering.nodes.get('1,0').temperature = 220;
  const heat = ship.engineering.heatAvailable(ship.modules[1]);
  world.fireWeapons(ship, target, cooldowns, 'player', 0.025);
  assert.equal(world.bullets.length, 1); assert.ok(ship.engineering.heatAvailable(ship.modules[1]) < heat - 11990);
});

test('mining rockets damage asteroids and nuclear blasts damage nearby modules', () => {
  const { world } = battlefield('mining_missile');
  let mined = 0; world.game.asteroids = [{ x: 2200, y: 0, radius: 30, damage(value) { mined += value; } }];
  VS.WeaponSystem.detonate(world, { x: 2200, y: 0, damage: 110, colour: '#fff', weapon: MODULES.mining_missile.weapon });
  assert.equal(mined, 110);
  const before = world.game.ship.hp;
  VS.WeaponSystem.detonate(world, { x: 2060, y: 0, damage: 150, colour: '#fff', weapon: MODULES.nuclear_launcher.weapon });
  assert.ok(world.game.ship.hp < before);
});

test('licensed ships run the full powered movement loop without invalid state', () => {
  for (const [id, content] of Object.entries(VS.Content.CLASSES)) {
    const ship = new VS.Ship({ shipClass: id, modules: content.modules });
    for (let i = 0; i < 240; i++) ship.update(1 / 60, new Set(i < 120 ? ['KeyW'] : []), { x: 1000, y: 0 });
    assert.ok([ship.x, ship.y, ship.vx, ship.angularVelocity, ship.hp, ship.engineering.summary().stored].every(Number.isFinite));
    assert.ok(ship.hp > 0); assert.ok(ship.engineering.summary().generation > 0);
  }
});

test('builder navigation reaches far cells without moving or accelerating the ship', () => {
  const game = { buildMode: true, camera: { x: 0, y: 0 }, input: new Set(), updateBuildHover() {} };
  for (let i = 0; i < 24; i++) VS.Game.prototype.onKeyDown.call(game, { code: 'ArrowRight', preventDefault() {} });
  assert.equal(game.camera.x, 720); assert.equal(game.input.size, 0);
});
