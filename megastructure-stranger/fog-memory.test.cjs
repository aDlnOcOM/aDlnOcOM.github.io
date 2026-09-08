const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup() {
  const scope = { window: {} }; vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'fog-memory.js'), 'utf8'), scope);
  const draws = [];
  const fog = { save() {}, restore() {}, drawImage(...args) { draws.push(args); } };
  const created = [];
  const create = () => { const calls = []; const canvas = { calls, getContext: () => ({ drawImage(...args) { calls.push(args); } }) }; created.push(canvas); return canvas; };
  return { run: scope.window.FogMemory.rememberAndDraw, fog, draws, create, created };
}
test('memory records the actual vision image with fractional world coordinates, not tile fills', () => {
  const t = setup(), map = { width: 3000 }, vision = {};
  t.run(map, vision, t.fog, 100.25, 960, 600, .22, t.create);
  assert.equal(t.created.length, 3);
  assert.equal(t.created[0].calls[0][0], vision);
  assert.equal(t.created[0].calls[0][1], 100.25);
  assert.equal(t.created[1].calls[0][1], -411.75);
  assert.equal(t.draws[1][1], 411.75);
  assert.equal(t.fog.globalCompositeOperation, 'destination-out');
});
test('camera travel reuses visited masks and a new floor starts with independent memory', () => {
  const t = setup(), map = { width: 3000 }, vision = {};
  t.run(map, vision, t.fog, 0, 960, 600, .22, t.create);
  const initial = map.fogMemory.get(0);
  t.run(map, vision, t.fog, 900, 960, 600, .09, t.create);
  t.run(map, vision, t.fog, 0, 960, 600, .22, t.create);
  assert.equal(map.fogMemory.get(0), initial);
  assert.equal(initial.calls.length, 2);
  const nextFloor = { width: 3000 };
  t.run(nextFloor, vision, t.fog, 0, 960, 600, .22, t.create);
  assert.notEqual(nextFloor.fogMemory.get(0), initial);
});
