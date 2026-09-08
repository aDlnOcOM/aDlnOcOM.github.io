const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const name of ['utils', 'modules', 'station']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${name}.js`), 'utf8'), sandbox);
}
const { Station } = sandbox.window.Voidspace;

test('station redesign preserves docking and safety boundaries', () => {
  const station = new Station();
  assert.equal(station.isDocked({ x: -275, y: 0 }), true);
  for (const point of [{ x: -425, y: 0 }, { x: -125, y: 0 }, { x: -275, y: 110 }]) {
    assert.equal(station.isDocked(point), false);
  }
  assert.equal(station.isSafe({ x: 439, y: 0 }), true);
  assert.equal(station.isSafe({ x: 440, y: 0 }), false);
});

test('station renders with missing images and restores canvas state', () => {
  let depth = 0;
  const context = new Proxy({
    createRadialGradient() { return { addColorStop() {} }; },
    fillText() { assert.fail('Station must not display labels'); },
    measureText(text) { return { width: text.length * 8 }; },
    save() { depth++; },
    restore() { depth--; assert.ok(depth >= 0); },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  new Station().draw(context, { x: -100, y: 0 }, { width: 1000, height: 800 }, {}, 2);
  assert.equal(depth, 0);
});

test('dock connector stops at the outer face of the dock hull', () => {
  const connector = new Station().getConnectors()[0];
  assert.equal(connector.x - connector.length / 2, -110);
  assert.equal(connector.x + connector.length / 2, -55);
});
