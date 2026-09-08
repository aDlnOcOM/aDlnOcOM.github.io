const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load() {
  const node = () => ({ width: 960, height: 600, getContext: () => ({}), addEventListener() {}, appendChild() {} });
  const context = { window: { addEventListener() {}, requestAnimationFrame() {} },
    document: { getElementById: node, createElement: node }, performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(context);
  for (const file of ['equipment.js', 'perception.js', 'security-ai.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  let source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  source = source.replace(/\}\)\(\);\s*$/, 'window.testing = { state, updateSensors, emitNoise, triggerAlarm, createGuard }; })();');
  vm.runInContext(source, context);
  return { ai: context.window.SecurityAI, ...context.window.testing };
}
function guard(x = 0, y = 0) {
  return { x, y, radius: 10, type: 'watcher', health: 40, angle: 0, speed: 60,
    homeAngle: 0, phase: 0, patrolStart: 0, patrolEnd: 200, alertStart: 0, alertEnd: 300,
    patrolDirection: 1, fireTimer: 0, fireRate: 1 };
}
function environment(overrides = {}) {
  return { now: 1, player: { x: 100, y: 0 }, alarm: false, walls: [], los: () => true,
    move: (g, x, y) => { g.x += x; g.y += y; }, fire() {}, report() {}, ...overrides };
}
test('vision obeys range, facing, angle wrap and solid occlusion', () => {
  const { ai } = load(), g = guard();
  assert.ok(ai.visible(g, { x: 100, y: 0 }, 300, 1, () => true));
  assert.equal(ai.visible(g, { x: -100, y: 0 }, 300, 1, () => true), false);
  assert.equal(ai.visible(g, { x: 301, y: 0 }, 300, 1, () => true), false);
  assert.equal(ai.visible(g, { x: 100, y: 0 }, 300, 1, () => false), false);
  g.angle = Math.PI - .01;
  assert.ok(ai.visible(g, { x: -100, y: -1 }, 300, 1, () => true));
  assert.equal(ai.clear({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 50, y: -10, width: 1, height: 20 }]), false);
});
test('brief sightings build suspicion, confirmed contact fires, cover stops fire immediately', () => {
  const { ai } = load(), g = guard();
  let shots = 0, reports = 0;
  const env = environment({ fire: () => shots++, report: () => reports++ });
  ai.tick(g, .2, env);
  assert.equal(g.ai.mode, 'suspicious'); assert.equal(shots, 0);
  ai.tick(g, .2, env);
  assert.equal(g.ai.mode, 'engage'); assert.equal(shots, 1); assert.equal(reports, 1);
  env.los = () => false; env.player.x = 800; env.now = 2;
  ai.tick(g, .2, env);
  assert.equal(shots, 1);
  assert.equal(g.ai.target.x, 100);
  assert.equal(g.ai.mode, 'investigate');
});
test('global alarm alone does not reveal a player behind a patrol', () => {
  const { ai } = load(), g = guard();
  let shots = 0;
  ai.tick(g, .5, environment({ player: { x: -100, y: 0 }, alarm: true, fire: () => shots++ }));
  assert.equal(g.ai.target, null); assert.equal(shots, 0);
});
test('radio snapshots dispatch nearby guards, not remote units or current combatants', () => {
  const { ai } = load(), local = guard(100), remote = guard(2200), combat = guard(50);
  ai.init(combat).mode = 'engage'; combat.ai.target = { x: 77, y: 0 };
  const point = { x: 200, y: 20 };
  ai.report([local, remote, combat], {}, point, 1, true);
  point.x = 700;
  assert.equal(local.ai.target.x, 200); assert.equal(remote.ai.target, null);
  assert.equal(combat.ai.target.x, 77);
});
test('contact expires and search returns to patrol without tracking hidden movement', () => {
  const { ai } = load(), g = guard();
  ai.report([g], {}, { x: 0, y: 0 }, 0, true);
  ai.tick(g, .1, environment({ now: 1, los: () => false }));
  assert.equal(g.ai.mode, 'search');
  ai.tick(g, .1, environment({ now: 6, los: () => false }));
  assert.equal(g.ai.mode, 'return'); assert.equal(g.ai.target, null);
  ai.tick(g, .1, environment({ now: 7, los: () => false }));
  assert.equal(g.ai.mode, 'patrol');
});
test('routes go around obstacles with body clearance and reject sealed gates', () => {
  const { ai } = load();
  const start = { x: 20, y: 100 }, end = { x: 200, y: 100 };
  const walls = [{ x: 90, y: 50, width: 20, height: 100 }];
  const route = ai.route(start, end, walls, 10);
  assert.ok(route.length > 1);
  let previous = start;
  for (const point of route) { assert.ok(ai.clear(previous, point, walls, 10)); previous = point; }
  const sealed = [{ x: 0, y: 0, width: 300, height: 20, outer: true },
    { x: 0, y: 180, width: 300, height: 20, outer: true }, { x: 90, y: 20, width: 20, height: 160 }];
  assert.equal(ai.route(start, end, sealed, 10).length, 0);
});
test('turret radio contact does not permit firing without visual confirmation', () => {
  const { ai } = load(), g = guard(); g.type = 'turret';
  let shots = 0;
  ai.report([g], {}, { x: 100, y: 0 }, 1, true);
  ai.tick(g, 1, environment({ alarm: true, los: () => false, fire: () => shots++ }));
  assert.equal(shots, 0); assert.equal(g.x, 0);
});
function prepare(state) {
  state.floorMap = { walls: [], entryGate: { x: 2000, y: 0, width: 20, height: 600 }, exitOpen: true };
  state.enemies = [guard(100, 0)]; state.sensors = [];
  state.player = { x: 100, y: 0 }; state.elapsed = 1; state.alarm = false;
}
test('camera confirms and refreshes actual radio positions during an existing alarm', () => {
  const { state, updateSensors } = load(); prepare(state);
  const camera = { x: 0, y: 0, homeAngle: 0, angle: 0, phase: 0, range: 300, fov: 2, exposure: 0 };
  state.sensors = [camera];
  updateSensors(.2); assert.equal(state.alarm, false);
  updateSensors(.3); assert.equal(state.alarm, true);
  assert.equal(state.enemies[0].ai.target.x, 100);
  state.flashlight = true;
  state.elapsed = 2; state.player.x = 150;
  updateSensors(.5); assert.equal(state.enemies[0].ai.target.x, 150);
  assert.equal(state.flashlight, true, 'repeated reports must not switch off the flashlight');
  state.floorMap.walls = [{ x: 50, y: -50, width: 10, height: 100 }];
  state.elapsed = 3; state.player.x = 170;
  updateSensors(.5); assert.equal(state.enemies[0].ai.target.x, 150);
});
test('noise respects listeners, wall attenuation and suspicion versus alarm', () => {
  const { state, emitNoise } = load(); prepare(state);
  emitNoise(0, 0, 50, 'noise', true); assert.equal(state.alarm, false);
  emitNoise(0, 0, 200, 'noise'); assert.equal(state.alarm, false);
  assert.equal(state.enemies[0].ai.mode, 'investigate');
  state.floorMap.walls = [{ x: 50, y: -50, width: 10, height: 100 }];
  emitNoise(0, 0, 200, 'shot', true); assert.equal(state.alarm, false);
  emitNoise(0, 0, 700, 'shot', true); assert.equal(state.alarm, true);
});
