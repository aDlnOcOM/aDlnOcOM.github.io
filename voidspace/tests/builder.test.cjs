const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = vm.createContext({ window: { localStorage: { getItem: () => null } } });
for (const file of ['utils', 'modules', 'content', 'engineering-content', 'visuals', 'builder', 'engineering', 'inventory', 'entities', 'station', 'collisions', 'ship', 'world', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox);
}
const VS = sandbox.window.Voidspace, B = VS.Builder, M = VS.ModuleSystem.MODULES;
const plain = value => JSON.parse(JSON.stringify(value));
const m = (type, gx, gy = 0) => ({ type, gx, gy, rotation: 0 });

test('horizontal and vertical reflection transform every assembly vertex in every rotation', () => {
  const points = root => VS.ModuleSystem.assemblyCells(root).flatMap(c => VS.ModuleSystem.localPolygon(c));
  const sorted = ps => ps.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).sort();
  for (const type of ['corner_armor_1x1', 'corner_armor_2x1', 'corner_armor_1x2', 'corner_armor_3x1', 'corner_armor_1x3', 'tesla_coil', 'thermo_resonator', 'thruster']) {
    for (let rotation = 0; rotation < 4; rotation++) for (const mirrored of [false, true]) for (const axis of ['horizontal', 'vertical']) {
      const game = { buildRotation: rotation, buildMirrored: mirrored, updateBuildHover() {}, updateBuildTools() {} };
      const before = points({ type, gx: 0, gy: 0, rotation, mirrored });
      VS.Game.prototype.mirrorBuildModule.call(game, axis);
      const after = points({ type, gx: 0, gy: 0, rotation: game.buildRotation, mirrored: game.buildMirrored });
      assert.deepEqual(plain(sorted(after)), plain(sorted(before.map(p => ({ x: axis === 'horizontal' ? -p.x : p.x, y: axis === 'vertical' ? -p.y : p.y })))));
      VS.Game.prototype.mirrorBuildModule.call(game, axis);
      assert.equal(game.buildRotation, rotation); assert.equal(game.buildMirrored, mirrored);
    }
  }
});

test('mirrored assemblies survive save and blueprint validation; mismatched sections are rejected', () => {
  const modules = [m('core', -1), m('thruster', -2), m('pulse', -1, 1), ...VS.ModuleSystem.assemblyCells({ ...m('corner_armor_1x3', 0), mirrored: true })];
  const blueprint = VS.Content.validateBlueprint({ modules });
  assert.ok(blueprint.modules.find(c => c.type === 'corner_armor_1x3').mirrored);
  const ship = new VS.Ship({ modules });
  const restored = new VS.Ship(ship.serialize());
  assert.deepEqual(plain(restored.modules), plain(ship.modules));
  const corrupt = plain(modules); corrupt.at(-1).mirrored = false;
  assert.throws(() => VS.Content.validateBlueprint({ modules: corrupt }));
});

test('mirrored armor installs with matching attachment and collision; reflected engines reserve the correct side', () => {
  const ship = new VS.Ship({ modules: [m('core', -1)], credits: 1000 });
  ship.unlocked.add('corner_armor_3x1');
  assert.equal(ship.addModule('corner_armor_3x1', 0, 0, 0, true).ok, true);
  assert.equal(ship.credits, 1000 - M.corner_armor_3x1.cost);
  const body = { modules: ship.modules, localToWorld: (x, y) => ({ x, y }) };
  assert.ok(VS.Physics.circleCollision(body, 65, -12, 1));
  assert.equal(VS.Physics.circleCollision(body, 65, 12, 1), null);
  for (const cell of ship.modules) {
    const ps = VS.ModuleSystem.localPolygon(cell);
    const winding = ps.reduce((sum, p, i) => { const q = ps[(i + 1) % ps.length]; return sum + p.x * q.y - p.y * q.x; }, 0);
    assert.ok(winding > 0);
  }
  const engine = { ...m('thruster', 0), rotation: 2, mirrored: true };
  assert.deepEqual(plain(VS.ModuleSystem.reservedCellsForModule(engine).map(c => [c.gx, c.gy])), [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
});

test('build arrows are pale, point with modules, and use one marker per assembly', () => {
  const ship = new VS.Ship({ modules: [m('core', 0), { ...m('thruster', -1), rotation: 3 }, ...VS.ModuleSystem.assemblyCells(m('corner_armor_3x1', 1))] });
  const rotations = [], strokes = [], dashes = []; let depth = 0;
  const ctx = { save() { depth++; }, restore() { depth--; }, translate() {}, rotate(a) { rotations.push(a); }, beginPath() {}, moveTo() {}, lineTo() {}, setLineDash(v) { dashes.push(v); }, stroke() { strokes.push(this.strokeStyle); } };
  ship.drawBuildDirections(ctx);
  assert.equal(strokes.length, 4); assert.equal(rotations.length, 3);
  assert.ok(rotations.includes(3 * Math.PI / 2)); assert.equal(depth, 0);
  assert.match(strokes.at(-1), /0\.30/); assert.deepEqual(plain(dashes.at(-1)), [7, 6]);
  strokes.length = 0; ship.drawBuildDirections(ctx, [m('hull', 0)], false); assert.equal(strokes.length, 1);
});
test('families preserve every public block without duplicates or hidden sections', () => {
  const types = B.groups({ includeCore: true }).flatMap(group => group.types);
  assert.equal(types.length, new Set(types).size);
  assert.deepEqual([...types].sort(), Object.keys(M).filter(type => !M[type].internal).sort());
  assert.equal(B.family('corner_armor_1x3').types.length, 5);
});
test('filters retain only matching variants and do not leak other ship classes', () => {
  assert.deepEqual(plain(B.groups({ query: '1×3' }).flatMap(g => g.types)), ['corner_armor_1x3']);
  const options = { category: 'flight', shipClass: 'miner', availableOnly: true, unlocked: new Set(['thruster', 'computer', 'scout_drive']) };
  const types = B.groups(options).flatMap(g => g.types);
  assert.ok(types.includes('thruster')); assert.ok(!types.includes('scout_drive')); assert.ok(!types.includes('booster'));
  assert.equal(B.groups({ query: '<nothing>' }).length, 0);
});
test('selected variant is shown on its family card; locked variants can be inspected', () => {
  const options = { selected: 'heavy_cannon', unlocked: new Set(['light_cannon']) };
  const group = B.groups(options).find(group => group.types.includes('heavy_cannon'));
  assert.equal(group.type, 'heavy_cannon');
  assert.match(B.cards(options), /data-module="heavy_cannon"/);
  assert.match(B.detail('heavy_cannon', options), /Откройте чертёж на станции/);
  assert.doesNotMatch(B.cards(options), / disabled/);
});
test('assembly metrics sum all sections, including heat capacity and hull', () => {
  assert.equal(B.metrics('tesla_coil').cells, 9); assert.equal(B.metrics('tesla_coil').maxHp, 480);
  assert.equal(B.metrics('thermo_resonator').cells, 48);
  assert.equal(B.metrics('corner_armor_1x3').maxHp, 180);
  for (const type of Object.keys(M)) assert.ok(Number.isFinite(B.metrics(type).heatCapacity));
});
test('catalogue escapes source text and explains tool clearances', () => {
  const old = M.hull.name; M.hull.name = '<img onerror="alert(1)">';
  assert.doesNotMatch(B.cards({}), /<img onerror/); assert.match(B.detail('hull'), /&lt;img/); M.hull.name = old;
  assert.match(B.detail('thruster'), /5 свободных кл/);
  assert.match(B.detail('laser'), /плазма-трансформатор/);
});
test('history is deep, bounded, reversible and clears stale redo on a new edit', () => {
  const h = new B.History(2), state = { modules: [{ hp: 5 }] };
  h.record(state); state.modules[0].hp = 0;
  assert.equal(h.travel(state).modules[0].hp, 5);
  assert.equal(h.travel({ modules: [{ hp: 5 }] }, true).modules[0].hp, 0);
  h.record({ a: 1 }); h.record({ a: 2 }); h.record({ a: 3 });
  assert.equal(h.undoStack.length, 2); assert.equal(h.travel({ a: 4 }).a, 3);
  h.record({ a: 8 }); assert.equal(h.redoStack.length, 0); assert.equal(h.travel({}, true), null);
});
function rig() {
  return { ship: new VS.Ship({ x: 6000, modules: [m('core', -1)], credits: 1000 }), buildMode: true, buildHistory: new B.History(),
    captureBuild: VS.Game.prototype.captureBuild, renderBuildPalette() {}, updateBuildHover() {}, updateHud() {}, save() {}, notify() {} };
}
test('undo and redo restore modules, credits, damage, heat and flight velocity exactly', () => {
  const game = rig(); game.ship.vx = 13; game.ship.angularVelocity = 0.2;
  game.ship.engineering.nodes.get('-1,0').temperature = 80;
  const before = game.captureBuild();
  assert.ok(game.ship.addModule('corner_armor_3x1', 0, 0, 0).ok); game.buildHistory.record(before);
  const after = game.ship.credits;
  VS.Game.prototype.travelBuildHistory.call(game);
  assert.equal(game.ship.credits, 1000); assert.equal(game.ship.modules.length, 1);
  assert.equal(game.ship.vx, 13); assert.equal(game.ship.angularVelocity, 0.2);
  assert.equal(game.ship.engineering.nodes.get('-1,0').temperature, 80);
  VS.Game.prototype.travelBuildHistory.call(game, true);
  assert.equal(game.ship.credits, after); assert.equal(game.ship.modules.length, 4);
});
test('history cannot rewind active flight or restore a ship after leaving build mode', () => {
  const game = rig(); game.buildHistory.record(game.captureBuild()); game.ship.credits = 12; game.buildMode = false;
  VS.Game.prototype.travelBuildHistory.call(game); assert.equal(game.ship.credits, 12);
});
test('build zoom is bounded, square and has no effect in flight', () => {
  const game = { buildMode: true, buildZoom: 1, resizeCanvas() {}, updateBuildHover() {}, updateBuildTools() {} };
  VS.Game.prototype.zoomBuild.call(game, 100); assert.equal(game.buildZoom, 2.5);
  VS.Game.prototype.zoomBuild.call(game, 0); assert.equal(game.buildZoom, 0.3);
  game.buildMode = false; VS.Game.prototype.zoomBuild.call(game, 2); assert.equal(game.buildZoom, 0.3);
  for (const buildZoom of [0.3, 0.83, 1.4, 2.5]) for (const [width, height] of [[1280, 720], [390, 844], [3440, 1440]]) {
    const canvasGame = { buildMode: true, buildZoom, canvas: { getBoundingClientRect: () => ({ width, height }) }, viewport: {}, renderScale: {}, configureRenderer() {} };
    VS.Game.prototype.resizeCanvas.call(canvasGame);
    assert.ok(Math.abs(canvasGame.renderScale.x - canvasGame.renderScale.y) < 1e-8);
    assert.ok(Math.abs(canvasGame.viewport.height - 540 / buildZoom) < 1e-8);
  }
});
test('new builder pages load shared code after module data and keep readable text', () => {
  for (const page of ['index.html', 'enemy-editor.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.ok(html.indexOf('js/builder.js') > html.indexOf('js/visuals.js'));
    assert.match(html, /css\/builder.css/);
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/builder.css'), 'utf8');
  for (const match of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(match[1]) >= 14);
});
