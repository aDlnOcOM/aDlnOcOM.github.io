const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const name of ['utils', 'modules', 'content', 'engineering-content', 'visuals']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', `${name}.js`), 'utf8'), sandbox);
}
const VS = sandbox.window.Voidspace;
const { Visuals, Content, ModuleSystem } = VS;

test('every module has either a distinct body or its own weapon overlay', () => {
  for (const [type, def] of Object.entries(ModuleSystem.MODULES)) {
    assert.equal(def.visualType, type);
    assert.ok(Visuals.BODY_TYPES.includes(type) || Visuals.TURRET_TYPES.includes(type), type);
    if (def.weapon || type === 'laser') assert.ok(Visuals.TURRET_TYPES.includes(type), `Missing turret: ${type}`);
  }
  assert.equal(new Set(Visuals.BODY_TYPES).size, 36);
  assert.equal(new Set(Visuals.TURRET_TYPES).size, 20);
  for (const source of Object.values(Visuals.MANIFEST)) assert.ok(fs.existsSync(path.join(root, source.split('?')[0])));
});

test('atmosphere weights sum to one, stay bounded, and do not affect gameplay biomes', () => {
  for (let radius = 0; radius < 6500; radius += 41) for (const angle of [0, 0.7, 2, -3]) {
    const blend = Content.biomeBlend(Math.cos(angle) * radius, Math.sin(angle) * radius, 12);
    assert.ok(blend.every(layer => layer.weight >= 0 && layer.weight <= 1));
    assert.ok(Math.abs(blend.reduce((sum, layer) => sum + layer.weight, 0) - 1) < 1e-10);
  }
  assert.equal(Content.biomeAt(1399, 0).id, 'haven');
  assert.equal(Content.biomeAt(1401, 0).id, 'belt');
  assert.equal(Content.biomeBlend(0, 0)[0].weight, 1);
  assert.equal(Content.biomeBlend(6000, 0)[4].weight, 1);
});

test('all radial and angular biome borders have continuous visual weights', () => {
  for (const radius of [1080, 1400, 1720, 2320, 2700, 3080, 4500, 5000, 5500]) {
    const a = Content.biomeBlend(radius - 0.01, 0, 12), b = Content.biomeBlend(radius + 0.01, 0, 12);
    a.forEach((layer, i) => assert.ok(Math.abs(layer.weight - b[i].weight) < 0.001));
  }
  const angle = -12 / 2;
  const at = delta => Content.biomeBlend(Math.cos(angle + delta) * 4000, Math.sin(angle + delta) * 4000, 12);
  at(-0.00001).forEach((layer, i) => assert.ok(Math.abs(layer.weight - at(0.00001)[i].weight) < 0.001));
});

test('visual mining turret follows mouse within 90 degrees for all rotations', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const m = { type: 'laser', gx: 2, gy: -1, rotation }, forward = rotation * Math.PI / 2;
    assert.equal(Visuals.aimAngle(m, { x: 60, y: -30 }), forward);
    for (let i = 0; i < 40; i++) {
      const angle = i * Math.PI / 20;
      const aim = Visuals.aimAngle(m, { x: 60 + Math.cos(angle) * 100, y: -30 + Math.sin(angle) * 100 });
      assert.ok(Math.abs(VS.Utils.angleDelta(forward, aim)) <= Math.PI / 4 + 1e-9);
    }
  }
});

test('exhaust is quantized to 16 fps and never exceeds two tiles at any engine power', () => {
  assert.equal(Visuals.frameAt(0), Visuals.frameAt(0.0624));
  assert.notEqual(Visuals.frameAt(0), Visuals.frameAt(0.0625));
  assert.equal(Visuals.frameAt(0.5), Visuals.frameAt(0));
  for (const power of [1, 1.7, 3, 100]) {
    let previous = 0;
    for (let level = 0; level <= 100; level++) {
      const length = Visuals.exhaustLength(power, level / 100);
      assert.ok(length >= previous && length <= 60 + 1e-8); previous = length;
    }
  }
  assert.equal(ModuleSystem.MODULES.booster.reservedZone.length, 5);
});

test('inactive engine draws nothing and twin-nozzle exhaust uses two separate attachment points', () => {
  const calls = [], ctx = new Proxy({ globalAlpha: 1, drawImage(...args) { calls.push(['image', ...args]); }, translate(...args) { calls.push(['translate', ...args]); } }, { get: (target, key) => target[key] ?? (() => {}) });
  const images = { visualExhaust: [Array(8).fill({}), Array(8).fill({})] };
  const state = { throttle: 0, activation: 1, gimbal: 0 };
  const ship = { thrusting: true, modules: [{ type: 'booster', gx: 0, gy: 0, rotation: 0 }], engineStates: new Map([['0,0', state]]) };
  Visuals.drawExhaust(ctx, images, ship, 1);
  assert.equal(calls.length, 0);
  state.throttle = 1; state.activation = 0;
  Visuals.drawExhaust(ctx, images, ship, 1); assert.equal(calls.length, 0);
  state.activation = 1;
  Visuals.drawExhaust(ctx, images, ship, 1);
  assert.equal(calls.filter(call => call[0] === 'image').length, 2);
  const offsets = calls.filter(call => call[0] === 'translate' && call[1] === -14.5).map(call => call[2]);
  assert.deepEqual(offsets, [-7.5, 7]);
});

test('catalog searches Russian names case-insensitively without leaking other categories', () => {
  assert.equal(Visuals.matches('battery', 'power', ' АККУМУЛЯТОР '), true);
  assert.equal(Visuals.matches('battery', 'weapons', ''), false);
  assert.equal(Visuals.matches('laser_turret', 'weapons', 'лазер'), true);
  assert.equal(Visuals.matches('laser_turret', 'all', '<script>'), false);
  for (const type of Object.keys(ModuleSystem.MODULES)) assert.ok(Visuals.CATEGORIES[Visuals.category(type)]);
});

test('redesigned DOM has unique ids and does not shrink interface fonts below 14px', () => {
  for (const file of ['index.html', 'enemy-editor.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, file);
    assert.match(html, /js\/visuals\.js/);
  }
  for (const file of ['style.css', 'editor.css']) {
    const css = fs.readFileSync(path.join(root, 'css', file), 'utf8');
    for (const match of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(match[1]) >= 14);
  }
});

test('canvas keeps module cells square on portrait, standard and ultrawide screens', () => {
  const context = { window: { devicePixelRatio: 1.5, Voidspace: { Utils: VS.Utils, ModuleSystem, Entities: {}, ORES: {} } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/game.js'), 'utf8'), context);
  for (const [width, height] of [[390, 844], [1280, 720], [3440, 1440]]) {
    const game = { canvas: { width: 1, height: 1, getBoundingClientRect: () => ({ width, height }) }, viewport: {}, renderScale: {}, configureRenderer() {} };
    context.window.Voidspace.Game.prototype.resizeCanvas.call(game);
    assert.ok(Math.abs(game.renderScale.x - game.renderScale.y) < 1e-10);
    assert.ok(Math.abs(game.viewport.width / game.viewport.height - width / height) < 1e-10);
  }
});

let canvasLibrary;
try { canvasLibrary = require('@napi-rs/canvas'); }
catch { try { canvasLibrary = require(path.join(path.dirname(process.execPath), '..', 'node_modules', '@napi-rs/canvas')); } catch { /* Optional raster verification; no project dependency. */ } }
test('real raster sheets decode with clear margins and valid uncropped turret pivots', { skip: !canvasLibrary }, async () => {
  sandbox.document = { createElement: () => canvasLibrary.createCanvas(1, 1) };
  const images = {};
  for (const [key, source] of Object.entries(Visuals.MANIFEST)) images[key] = await canvasLibrary.loadImage(path.join(root, source.split('?')[0]));
  images.module_drill = await canvasLibrary.loadImage(path.join(root, 'assets/modules/drill.png'));
  Visuals.prepare(images);
  for (const [type, body] of Object.entries(images.visualBodies)) {
    assert.ok(body.width > 145 && body.height > 145, type);
    const pixels = body.getContext('2d').getImageData(0, 0, body.width, body.height).data;
    let magenta = 0, opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 200) opaque++;
      if (pixels[i + 3] > 100 && pixels[i] > 170 && pixels[i + 1] < 60 && pixels[i + 2] > 170) magenta++;
    }
    assert.ok(opaque / (body.width * body.height) > 0.55, `Lost silhouette: ${type}`);
    assert.equal(magenta, 0, type);
  }
  for (const [type, art] of Object.entries(images.visualTurrets)) {
    assert.ok(art.pivotX > 0 && art.pivotX < art.image.width, type);
    assert.ok(art.pivotY > 0 && art.pivotY < art.image.height, type);
  }
  for (const family of images.visualExhaust) for (const frame of family) {
    const pixels = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
    assert.ok(pixels.some((value, index) => index % 4 === 3 && value === 0), 'Exhaust must have real transparency');
  }
  const ctx = canvasLibrary.createCanvas(128, 128).getContext('2d');
  ctx.translate(64, 64);
  for (const type of Object.keys(ModuleSystem.MODULES)) {
    assert.ok(Visuals.drawCell(ctx, images, { type, gx: 0, gy: 0, rotation: 0 }));
    const markup = Visuals.iconMarkup(ModuleSystem.MODULES[type]);
    assert.match(markup, /data:image\/png/);
    const icon = await canvasLibrary.loadImage(markup.match(/src="([^"]+)"/)[1]);
    const iconCanvas = canvasLibrary.createCanvas(96, 96), iconCtx = iconCanvas.getContext('2d');
    iconCtx.drawImage(icon, 0, 0);
    const pixels = iconCtx.getImageData(0, 0, 96, 96).data;
    for (let p = 0; p < 96; p++) {
      for (const [x, y] of [[p, 0], [p, 95], [0, p], [95, p]]) assert.equal(pixels[(y * 96 + x) * 4 + 3], 0, `Clipped icon: ${type}`);
    }
  }
});
