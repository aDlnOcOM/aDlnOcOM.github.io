import test from 'node:test';
import assert from 'node:assert/strict';
import { newFlight, readFlight, advanceFlight, flightDirection, slideFlight, sphereBlocked } from '../flight-model.mjs';

const input = { forward: 1, right: 0, up: 0, fast: false };
test('flight accelerates smoothly, coasts briefly and converges to rest', () => {
  const s = newFlight(); s.pitch = 0;
  advanceFlight(s, input, .016); assert.ok(s.velocity[2] < 0 && s.velocity[2] > -5);
  for (let i = 0; i < 120; i++) advanceFlight(s, input, 1 / 60);
  assert.ok(Math.abs(s.velocity[2] + 26) < .001);
  const p = s.position[2]; advanceFlight(s, { ...input, forward: 0 }, .1);
  assert.ok(s.position[2] < p && Math.abs(s.velocity[2]) > 1);
  for (let i = 0; i < 120; i++) advanceFlight(s, { ...input, forward: 0 }, 1 / 60);
  assert.ok(Math.hypot(...s.velocity) < .001);
});
test('flight response is independent of frame rate and normalizes diagonals', () => {
  const simulate = (fps, controls) => { const s = newFlight(); s.pitch = 0; for (let i = 0; i < fps * 3; i++) advanceFlight(s, controls, 1 / fps); return s; };
  const a = simulate(30, input), b = simulate(144, input);
  assert.ok(Math.abs(a.position[2] - b.position[2]) < 1e-8);
  const diagonal = simulate(60, { ...input, right: 1, up: 1 });
  assert.ok(Math.abs(Math.hypot(...diagonal.velocity) - 26) < .001);
  const up = simulate(60, { ...input, forward: 0, up: 1 }); assert.ok(up.position[1] > 60);
  assert.deepEqual(flightDirection(0, 0), [-0, 0, -1]);
});
test('walls stop fast flight without tunnelling while preserving sideways movement', () => {
  const wall = { type: 'box', center: [5, 0, 0], size: [1, 100, 100] };
  const p = slideFlight([0, 0, 0], [50, 8, 3], v => sphereBlocked(v, wall));
  assert.ok(p[0] < 3.66); assert.ok(Math.abs(p[1] - 8) < 1e-8); assert.ok(Math.abs(p[2] - 3) < 1e-8);
  assert.equal(sphereBlocked([.5, 0, 0], { type: 'beam', a: [0, -10, 0], b: [0, 10, 0], radius: 1 }), true);
});
test('save restores world and view, never stale movement or game progression', () => {
  const original = { ...newFlight(823), position: [1834.2, -140, 9763], yaw: 2.4, pitch: -.8, velocity: [26, 0, 0], resources: 500 };
  const restored = readFlight(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored.position, original.position); assert.equal(restored.seed, 823); assert.equal(restored.yaw, 2.4);
  assert.deepEqual(restored.velocity, [0, 0, 0]); assert.equal('resources' in restored, false);
  for (const invalid of [null, {}, { ...original, position: [NaN, 0, 0] }, { ...original, seed: -1 }, { ...original, yaw: Infinity }]) assert.throws(() => readFlight(invalid));
});
