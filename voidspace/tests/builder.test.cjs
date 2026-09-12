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
