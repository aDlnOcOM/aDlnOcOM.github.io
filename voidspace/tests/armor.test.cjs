const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = vm.createContext({ window: { localStorage: { getItem: () => null } } });
for (const file of ['utils', 'modules', 'content', 'engineering-content', 'engineering', 'inventory', 'entities', 'station', 'collisions', 'ship', 'world', 'visuals']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const VS = sandbox.window.Voidspace, M = VS.ModuleSystem, P = VS.Physics;
const cell = (type, gx = 0, gy = 0, rotation = 0) => ({ type, gx, gy, rotation });
const variants = [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3]];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const rotate = (p, rotation) => { const [x, y] = M.moduleDirection({ rotation }); return { x: p.x * x - p.y * y, y: p.x * y + p.y * x }; };
const makeShip = () => new VS.Ship({ x: 6000, y: 0, credits: 10000, modules: [cell('core', -1)] });

for (const [width, height] of variants) test(`corner armor ${width}x${height} preserves area, extent and real collision in four orientations`, () => {
  const type = `corner_armor_${width}x${height}`, def = M.MODULES[type];
  assert.equal(def.internal, false); assert.equal(def.unlock, 0);
  for (let rotation = 0; rotation < 4; rotation++) {
    const cells = M.assemblyCells(cell(type, 0, 0, rotation)), points = cells.flatMap(M.localPolygon);
    assert.equal(cells.length, width * height);
    near(cells.reduce((sum, c) => sum + M.polygonArea(M.localPolygon(c)), 0), width * height * 450);
    near(cells.reduce((sum, c) => sum + M.MODULES[c.type].hp, 0), def.assemblyHp);
    near(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), (rotation % 2 ? height : width) * 30);
    near(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)), (rotation % 2 ? width : height) * 30);
    const body = { modules: cells, angle: 0, localToWorld: (x, y) => ({ x, y }), worldToLocal: (x, y) => ({ x, y }) };
    const top = -Math.floor(height / 2) * 30 - 15;
    for (let x = 2; x < width * 30; x += 4) for (let y = 2; y < height * 30; y += 4) {
      const side = y - x * height / width;
      if (Math.abs(side) < 1) continue;
      const p = rotate({ x: x - 15, y: y + top }, rotation), filled = side > 0;
      assert.equal(Boolean(P.circleCollision(body, p.x, p.y, 0.1)), filled, `${type} ${rotation}: ${x},${y}`);
      assert.equal(Boolean(VS.Combat.rayModules(body, p, rotate({ x: 1, y: 0 }, rotation), 0.1)), filled);
    }
  }
});

for (const [width, height] of [[1, 1], [2, 1], [1, 2], [2, 2], [3, 3], [5, 5], [6, 4], [9, 8], [16, 3]]) {
  test(`rectangular ${width}x${height} assemblies occupy exactly the specified cells in every rotation`, () => {
    const type = `test_panel_${width}x${height}`;
    M.MODULES[type] = { ...M.MODULES.hull, footprint: { width, height } };
    try {
      for (let rotation = 0; rotation < 4; rotation++) {
        const cells = M.assemblyCells(cell(type, 0, 0, rotation));
        assert.equal(cells.length, width * height);
        assert.equal(new Set(cells.map(m => `${m.gx},${m.gy}`)).size, cells.length);
        assert.equal(cells.filter(m => m.type === type).length, 1);
        assert.equal(Math.max(...cells.map(m => m.gx)) - Math.min(...cells.map(m => m.gx)) + 1, rotation % 2 ? height : width);
        assert.equal(Math.max(...cells.map(m => m.gy)) - Math.min(...cells.map(m => m.gy)) + 1, rotation % 2 ? width : height);
        assert.ok(M.isConnected(cells));
        const ship = new VS.Ship({ credits: 10000, modules: [cell('core', ...Object.values(rotate({ x: -1, y: 0 }, rotation)))] });
        ship.unlocked.add(type);
        assert.equal(ship.addModule(type, 0, 0, rotation).ok, true);
        const copy = new VS.Ship(ship.serialize());
        assert.equal(copy.modules.length, width * height + 1);
        const part = copy.modules.find(m => m.type !== 'core');
        assert.equal(copy.removeModule(part.gx, part.gy).ok, true);
        assert.equal(copy.modules.length, 1);
      }
    } finally { delete M.MODULES[type]; }
  });
}

test('wedge tips and empty edges cannot anchor blocks or conduct power and heat', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const armor = cell('corner_armor_1x1', 0, 0, rotation);
    for (const [x, y, expected] of [[-1, 0, true], [0, 1, true], [1, 0, false], [0, -1, false]]) {
      const position = rotate({ x, y }, rotation), core = cell('core', position.x, position.y);
      assert.equal(M.modulesTouch(core, armor), expected);
      assert.equal(M.isConnected([core, armor]), expected);
      assert.equal(M.connectedToCore([core, armor]).has(armor), expected);
      const ship = new VS.Ship({ modules: [core, armor] });
      assert.equal(ship.engineering.neighbours(ship.modules[0]).length, expected ? 1 : 0);
    }
  }
  const ship = new VS.Ship({ modules: [cell('core', 1)], credits: 1000 });
  assert.equal(ship.addModule('corner_armor_1x1', 0, 0, 0).ok, false);
});

test('armor installation is atomic across sections, boundaries and reserved exhaust', () => {
  const ship = makeShip(), credits = ship.credits;
  ship.modules.push(cell('hull', 2));
  assert.equal(ship.addModule('corner_armor_3x1', 0, 0, 0).ok, false);
  assert.equal(ship.credits, credits); assert.equal(ship.modules.length, 2);
  ship.modules = [cell('core', 22)];
  assert.equal(ship.addModule('corner_armor_3x1', 23, 0, 0).ok, false);
  ship.modules = [cell('core', -1), cell('thruster', 4)];
  assert.equal(ship.addModule('corner_armor_3x1', 0, 0, 0).ok, false);
  assert.equal(ship.credits, credits);
});

test('all wedge sections persist, remove together and charge only once', () => {
  for (const [width, height] of variants) {
    const type = `corner_armor_${width}x${height}`, ship = makeShip();
    assert.equal(ship.addModule(type, 0, 0, 0).ok, true);
    assert.equal(ship.credits, 10000 - M.MODULES[type].cost);
    const saved = new VS.Ship(ship.serialize()), last = saved.modules.at(-1);
    assert.equal(saved.modules.length, ship.modules.length);
    assert.deepEqual(P.shapes(saved).map(p => p.points), P.shapes(ship).map(p => p.points));
    assert.equal(saved.removeModule(last.gx, last.gy).ok, true);
    assert.equal(saved.modules.length, 1);
    assert.equal(saved.credits, ship.credits + Math.floor(M.MODULES[type].cost / 2));
  }
});

test('hot wedge sections block demolition and section destruction leaves no invisible parts', () => {
  const ship = makeShip(); ship.addModule('corner_armor_3x1', 0, 0, 0);
  const part = ship.modules.find(m => m.gx === 2), node = ship.engineering.nodes.get('2,0');
  node.temperature = 180;
  assert.equal(ship.removeModule(0, 0).ok, false);
  ship.engineering.damage(part, 10000);
  assert.equal(ship.modules.length, 1);
  assert.equal(P.circleCollision(ship, 6060, 10, 1), null);
});

test('import rejects missing, orphaned, extra and misrotated armor sections', () => {
  const blueprint = { modules: [cell('core', -1), cell('thruster', -2), cell('pulse', -1, 1), ...M.assemblyCells(cell('corner_armor_1x3'))] };
  assert.doesNotThrow(() => VS.Content.validateBlueprint(blueprint));
  const mutate = fn => { const copy = JSON.parse(JSON.stringify(blueprint)); fn(copy.modules); return copy; };
  assert.throws(() => VS.Content.validateBlueprint(mutate(ms => ms.pop())));
  assert.throws(() => VS.Content.validateBlueprint(mutate(ms => { ms.at(-1).rotation = 1; })));
  assert.throws(() => VS.Content.validateBlueprint(mutate(ms => { ms.splice(ms.findIndex(m => m.type === 'corner_armor_1x3'), 1); })));
  assert.throws(() => VS.Content.validateBlueprint(mutate(ms => { ms.push({ ...ms.at(-1), gy: 2 }); })));
});

test('construction collision checks every wedge cell but not its empty cutout', () => {
  const ship = makeShip(), cells = M.assemblyCells(cell('corner_armor_3x1'));
  const world = { game: { ship, asteroids: [{ x: 6065, y: 12, radius: 1 }] }, enemies: [], friendlyStations: () => [], stations: [] };
  assert.ok(P.placementBlocked(ship, cells, world));
  world.game.asteroids[0].y = -10;
  assert.equal(P.placementBlocked(ship, cells, world), false);
});

test('slope ray hits have correct distance after both module and ship rotation', () => {
  const modules = M.assemblyCells(cell('corner_armor_3x1', 0, 0, 1));
  const ship = new VS.Ship({ x: 6000, y: 200, modules: [cell('core', 0, -1), ...modules] });
  ship.angle = 0.77;
  const origin = ship.localToWorld(40, 30), end = ship.localToWorld(-20, 30);
  const dir = { x: (end.x - origin.x) / 60, y: (end.y - origin.y) / 60 };
  const hit = VS.Combat.rayModules(ship, origin, dir, 60);
  assert.ok(hit); near(hit.distance, 40);
});

let canvasLibrary;
try { canvasLibrary = require('@napi-rs/canvas'); }
catch { try { canvasLibrary = require(path.join(path.dirname(process.execPath), '..', 'node_modules', '@napi-rs/canvas')); } catch { /* Optional, no new dependency. */ } }
test('armor pixels and heated damage overlays follow the collision silhouette in all orientations', { skip: !canvasLibrary }, () => {
  for (const [width, height] of variants) for (let rotation = 0; rotation < 4; rotation++) {
    const modules = M.assemblyCells(cell(`corner_armor_${width}x${height}`, 0, 0, rotation));
    const canvas = canvasLibrary.createCanvas(240, 240), ctx = canvas.getContext('2d'); ctx.translate(120, 120);
    const ship = new VS.Ship({ modules: [cell('core', -5), ...modules] });
    for (const m of modules) {
      VS.Visuals.drawCell(ctx, {}, m);
      const node = ship.engineering.nodes.get(`${m.gx},${m.gy}`); node.temperature = 500; node.integrity *= 0.5;
      ship.engineering.drawModule(ctx, m, 0, true);
    }
    const data = ctx.getImageData(0, 0, 240, 240).data;
    const body = { modules, localToWorld: (x, y) => ({ x, y }) };
    for (let y = 30; y < 210; y += 3) for (let x = 30; x < 210; x += 3) {
      const px = x - 119.5, py = y - 119.5;
      if (!P.circleCollision(body, px, py, 1.5)) assert.equal(data[(y * 240 + x) * 4 + 3], 0, `${width}x${height} r${rotation}: ${px},${py}`);
    }
  }
});
