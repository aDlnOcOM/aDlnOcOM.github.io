const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(full = false) {
  const node = () => ({ width: 960, height: 600, getContext: () => ({}), addEventListener() {}, appendChild() {} });
  const context = { window: { addEventListener() {}, requestAnimationFrame() {} },
    document: { getElementById: node, createElement: node }, performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(context);
  for (const file of ['sectors.js', 'security-ai.js', ...(full ? ['equipment.js'] : [])]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  }
  if (full) {
    const source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8')
      .replace(/\}\)\(\);\s*$/, 'window.testing = { createLongFloor, state }; })();');
    vm.runInContext(source, context);
  }
  return { gen: context.window.SectorGenerator, ai: context.window.SecurityAI, ...context.window.testing };
}
test('ten district weights follow the requested rarity order', () => {
  const { gen } = load(), random = gen.seeded(714);
  const counts = Object.fromEntries(gen.types.map(type => [type.id, 0]));
  assert.equal(gen.types.length, 10);
  assert.equal(gen.types.reduce((n, type) => n + type.weight, 0), 100);
  for (let n = 0; n < 50000; n++) counts[gen.pick(random).id]++;
  for (const type of gen.types) assert.ok(Math.abs(counts[type.id] / 500 - type.weight) < 1);
  assert.ok(counts.residential > counts.industrial && counts.industrial > counts.slums);
  assert.ok(counts.slums > counts.market && counts.market > counts.robotics && counts.robotics > counts.elite);
});
test('seed reproduces the complete layout while different seeds vary districts and geometry', () => {
  const { gen } = load();
  const first = JSON.stringify(gen.generate(11, 960, 600, 42));
  assert.equal(first, JSON.stringify(gen.generate(11, 960, 600, 42)));
  assert.notEqual(first, JSON.stringify(gen.generate(11, 960, 600, 43)));
});
test('200 layouts keep service corridors, entry vestibules and inter-sector links passable', () => {
  const { gen, ai } = load();
  for (let seed = 0; seed < 200; seed++) {
    const map = gen.generate(10, 960, 600, seed);
    for (let i = 0; i < map.sectors.length; i++) {
      const sector = map.sectors[i];
      const local = map.walls.filter(wall => wall.sector === i);
      assert.ok(ai.clear({ x: sector.x + 60, y: sector.lane }, { x: sector.x + 900, y: sector.lane }, local, 20));
      if (i > 0) {
        assert.ok(ai.clear({ x: sector.x - 60, y: map.sectors[i - 1].lane },
          { x: sector.x + 60, y: sector.lane }, map.walls.filter(wall => wall.sector === i || wall.sector === i - 1), 20));
      }
      for (const wall of local) {
        assert.ok(wall.x > sector.x && wall.x + wall.width < sector.x + sector.width);
        assert.ok(wall.y > 28 && wall.y + wall.height < 572);
        assert.ok(wall.width > 0 && wall.height > 0);
      }
    }
  }
});
test('integrated floors keep guards and cameras out of walls and preserve boss gates and growth', () => {
  const { createLongFloor, state, ai } = load(true);
  state.runSectorCount = 11;
  let previous;
  for (let floor = 1; floor <= 5; floor++) {
    state.floor = floor;
    const map = createLongFloor(floor);
    assert.equal(map.sectors.length, 11);
    assert.equal(map.bossWidth, 640);
    assert.ok(map.entryGate.x < map.exitGate.x);
    assert.equal(map.bossStarted, false);
    if (previous) assert.ok(Math.abs(map.bodyLength / previous - 1.2) < .0001);
    previous = map.bodyLength;
    for (const entity of [...map.guards, ...map.sensors]) {
      assert.ok(ai.clear(entity, entity, map.walls, entity.radius || 8), 'spawn collision');
      assert.ok(entity.x < map.entryGate.x);
    }
    assert.ok(ai.clear({ x: 116, y: 300 }, { x: 116, y: map.sectors[0].lane }, map.walls, 16));
    const last = map.sectors.at(-1);
    assert.ok(ai.clear({ x: last.x + last.width - 100, y: last.lane },
      { x: map.entryGate.x - 40, y: 300 }, map.walls, 16));
  }
});
