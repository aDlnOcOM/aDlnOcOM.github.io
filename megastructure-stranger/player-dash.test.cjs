const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load(full = false) {
  const handlers = [];
  const node = () => ({ dataset: {}, width: 960, height: 600, getContext: () => ({}), addEventListener() {}, appendChild() {} });
  const scope = vm.createContext({ window: { addEventListener(type, callback) { if (type === 'keydown') handlers.push(callback); }, requestAnimationFrame() {} }, document: { getElementById: node, createElement: node }, performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem() {} } });
  for (const file of ['player-dash.js', ...(full ? ['equipment.js', 'security-ai.js'] : [])]) vm.runInContext(fs.readFileSync(`${__dirname}/${file}`, 'utf8'), scope);
  if (full) vm.runInContext(fs.readFileSync(`${__dirname}/script.js`, 'utf8').replace(/\}\)\(\);\s*$/, 'window.testing = { state, moveCircle, updatePlayer }; })();'), scope);
  return { dash: scope.window.PlayerDash, handlers, ...scope.window.testing };
}
const player = () => ({ x: 0, y: 300, radius: 13, health: 100, invulnerability: 0, speed: 245, fireCooldown: 0, knifeCooldown: 0, knifeFlash: 0, reload: 0 });
const freeMove = (p, x, y) => { p.x += x; p.y += y; };
test('direction is locked, diagonals normalized and idle dash follows aim', () => {
  const { dash } = load();
  for (const keys of [[], ['KeyD'], ['KeyD', 'KeyW']]) {
    const p = player();
    assert.equal(dash.start(p, new Set(keys), Math.PI), true);
    for (let n = 0; n < 10; n++) dash.tick(p, .02, freeMove);
    assert.ok(Math.abs(Math.hypot(p.x, p.y - 300) - 160) < .001);
    if (!keys.length) assert.ok(p.x < 0);
    assert.equal(p.invulnerability, 0);
  }
});
test('cooldown prevents spam; trail expires and large deltas cannot extend dash', () => {
  const { dash } = load(); const p = player();
  dash.start(p, new Set(['KeyD']), 0);
  dash.tick(p, .035, freeMove);
  assert.ok(p.dash.trail.length > 0);
  assert.equal(dash.start(p, new Set(), 0), false);
  dash.tick(p, 2, freeMove);
  assert.ok(Math.abs(p.x - 160) < .001);
  dash.tick(p, .2, freeMove);
  assert.equal(p.dash.trail.length, 0);
  assert.equal(dash.start(p, new Set(), 0), true);
});
test('real world collision blocks thin and thick walls', () => {
  for (const width of [2, 30, 48]) {
    const { dash, state, moveCircle } = load(true);
    const p = player();
    state.floorMap = { walls: [{ x: 55, y: 0, width, height: 600 }], containers: [], entryGate: { x: 1000, y: 0, width: 20, height: 600 }, exitGate: { x: 2000, y: 0, width: 20, height: 600 } };
    dash.start(p, new Set(['KeyD']), 0);
    dash.tick(p, .2, moveCircle);
    assert.ok(p.x <= 42, `crossed ${width}px obstacle`);
  }
});
test('generated loot colliders and closed exit gates stop the dash', () => {
  for (const type of ['crate', 'gate']) {
    const { dash, state, moveCircle } = load(true); const p = player();
    state.floorMap = { walls: [], containers: type === 'crate' ? [{ id: 'loot', x: 70, y: 300 }] : [], entryGate: { x: 1000, y: 0, width: 20, height: 600 }, exitGate: { x: type === 'gate' ? 55 : 2000, y: 0, width: 20, height: 600 }, exitOpen: false };
    dash.start(p, new Set(['KeyD']), 0); dash.tick(p, .2, moveCircle);
    assert.ok(p.x <= 42, `crossed ${type}`);
  }
});
test('trail drawing fades visible samples and restores canvas state', () => {
  const { dash } = load(); const p = player();
  dash.start(p, new Set(['KeyD']), 0); dash.tick(p, .02, freeMove);
  let depth = 0; let rectangles = 0;
  const context = { save() { depth++; }, restore() { depth--; }, translate() {}, rotate() {}, fillRect() { rectangles++; assert.ok(this.globalAlpha > 0 && this.globalAlpha <= .28); } };
  dash.draw(context, p, 0, () => false); assert.equal(rectangles, 0);
  dash.draw(context, p, 0, () => true); assert.ok(rectangles > 0); assert.equal(depth, 0);
});
test('Ctrl starts once in active gameplay, not in overlays, inventory or key repeat', () => {
  const { state, handlers, updatePlayer } = load(true);
  state.player = player(); state.cameraX = 0;
  state.floorMap = { walls: [], containers: [], entryGate: { x: 1000, y: 0, width: 20, height: 600 }, exitGate: { x: 2000, y: 0, width: 20, height: 600 } };
  state.runActive = true;
  const send = (code, repeat = false) => handlers.forEach(handler => handler({ code, repeat, preventDefault() {} }));
  state.active = false; send('ControlLeft'); assert.equal(state.player.dash, undefined);
  state.active = true; state.inventoryOpen = true; send('ControlLeft'); assert.equal(state.player.dash, undefined);
  state.inventoryOpen = false; send('ControlLeft', true); assert.equal(state.player.dash, undefined);
  state.input.keys.add('KeyD'); send('ControlRight'); assert.ok(state.player.dash);
  updatePlayer(.02);
  assert.ok(Math.abs(state.player.x - 16) < .001, 'walking must not stack with dash');
});
