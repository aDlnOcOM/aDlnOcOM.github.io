const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load() {
  const scope = { window: {} };
  vm.createContext(scope);
  for (const file of ['perception.js', 'security-ai.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), scope);
  return { p: scope.window.Perception, ai: scope.window.SecurityAI };
}
const eye = { x: 0, y: 0, angle: 0 };
const stats = { flashlightRange: 336, flashlightAngle: 29 };
test('lit floor gives 120 degrees of detail and 50 degrees of silhouettes on each side', () => {
  const { p } = load(), layers = p.playerLayers(false, false, stats);
  const at = degrees => p.playerStrength(eye, { x: 200 * Math.cos(degrees * Math.PI / 180), y: 200 * Math.sin(degrees * Math.PI / 180) }, layers, () => true);
  for (const side of [-1, 1]) {
    assert.equal(at(59.9 * side), 1);
    assert.equal(at(85 * side), .32);
    assert.equal(at(109.9 * side), .32);
    assert.equal(at(111 * side), 0);
  }
});
test('flashlight adds 12.5 degrees of dim spill on each side of its beam', () => {
  const { p } = load(), layers = p.playerLayers(true, true, stats);
  const halo = layers.find(layer => Math.abs(layer.fov * 180 / Math.PI - 54) < .001);
  assert.ok(halo);
  const at = degrees => p.playerStrength(eye, { x: 150 * Math.cos(degrees * Math.PI / 180), y: 150 * Math.sin(degrees * Math.PI / 180) }, layers, () => true);
  assert.ok(at(20) > .18 && at(20) < .5);
  assert.equal(at(28), 0);
});
test('soft cone and range falloffs preserve a full-strength core and a blind rear', () => {
  const { p } = load();
  assert.equal(p.strength(eye, { x: 50, y: 0 }, 100, 1, () => true), 1);
  const edge = p.strength(eye, { x: Math.cos(.45) * 50, y: Math.sin(.45) * 50 }, 100, 1, () => true);
  assert.ok(edge > 0 && edge < .5);
  assert.ok(p.strength(eye, { x: 90, y: 0 }, 100, 1, () => true) < .5);
  assert.equal(p.strength(eye, { x: -50, y: 0 }, 100, 1, () => true), 0);
});
test('shared rays block thin walls, closed gates and origins inside solids', () => {
  const { p } = load();
  const walls = [{ x: 5, y: -30, width: 1, height: 60 }];
  assert.equal(p.lineOfSight(0, 0, 7, 0, walls), false);
  assert.equal(p.lineOfSight(0, 0, 4, 0, walls), true);
  assert.equal(p.cast(5.5, 0, 0, 100, walls), 0);
  assert.equal(p.strength(eye, { x: 7, y: 0 }, 100, 1, (...args) => p.lineOfSight(...args, walls)), 0);
});
test('darkness has no distant rear vision; light adds reach without widening eyesight', () => {
  const { p } = load();
  const dark = p.playerLayers(true, false, stats), lit = p.playerLayers(true, true, stats);
  const check = (target, layers) => p.playerStrength(eye, target, layers, () => true);
  assert.equal(check({ x: -40, y: 0 }, dark), 0);
  assert.equal(check({ x: 200, y: 0 }, dark), 0);
  assert.equal(check({ x: 200, y: 0 }, lit), 1);
  assert.equal(check({ x: 200, y: 120 }, lit), 0);
  assert.ok(check({ x: 5000, y: 0 }, p.playerLayers(false, false, stats)) > .9);
  assert.equal(check({ x: 350, y: 0 }, lit), 0);
});
test('near-body awareness never bypasses occlusion', () => {
  const { p } = load();
  assert.equal(p.playerStrength(eye, { x: 10, y: 0 }, p.playerLayers(true, true, stats), () => false), 0);
});
test('rendered cone vertices stop at the same wall as gameplay rays without blur', () => {
  const { p } = load(), vertices = [];
  const ctx = { save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, moveTo() {},
    lineTo(x, y) { vertices.push({ x, y }); }, createRadialGradient: () => ({ addColorStop() {} }) };
  p.drawLayer(ctx, eye, { fov: 1, range: 200, opacity: 1 }, [{ x: 50, y: -100, width: 2, height: 200 }], 0, 1000);
  assert.ok(vertices.length > 40);
  assert.ok(vertices.every(point => point.x <= 50.00001));
  assert.equal(ctx.filter, undefined);
});
test('a visible flashlight accelerates confirmation but cannot reveal through a wall', () => {
  const { ai } = load();
  const create = () => ({ ...eye, type: 'turret', health: 40, radius: 10, speed: 0, homeAngle: 0,
    phase: 0, fireTimer: 0, fireRate: 1 });
  const env = { player: { x: 100, y: 0 }, now: 0, walls: [], alarm: true,
    los: () => true, move() {}, report() {}, fire() {} };
  const dark = create(), lit = create(), covered = create();
  ai.tick(dark, .25, env);
  ai.tick(lit, .25, { ...env, flashlight: true });
  ai.tick(covered, .25, { ...env, flashlight: true, los: () => false });
  assert.equal(dark.ai.mode, 'suspicious');
  assert.equal(lit.ai.mode, 'engage');
  assert.equal(covered.ai.exposure, 0);
});
