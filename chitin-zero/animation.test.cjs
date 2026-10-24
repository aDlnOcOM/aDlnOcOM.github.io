const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');
const { Sprites, manifest, animations, directionIndex, animationPose, frameRect } = require('./sprites.js');
const { Game } = require('./core.js');
const combat = require('./combat.js');
const chassis = ['spectre', 'bastion', 'vector'];
const angle = direction => Math.PI / 2 + direction * Math.PI / 4;

// Read-only RGBA PNG decoding for atlas seam checks; no image package dependency.
function rgba(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), chunks = [];
  assert.equal(png[24], 8); assert.equal(png[25], 6); assert.equal(png[28], 0);
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4, pixels = Buffer.alloc(height * stride);
  assert.equal(raw.length, height * (stride + 1));
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      pixels[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return (x, y) => pixels[(y * width + x) * 4 + 3];
}

test('eight directional views wrap at the seam without rotating the image plane', () => {
  for (let d = 0; d < 8; d++) {
    for (const turns of [-4, -1, 0, 1, 4]) assert.equal(directionIndex(angle(d) + turns * Math.PI * 2), d);
    assert.equal(directionIndex(angle(d) + .38), d);
    assert.equal(directionIndex(angle(d) - .38), d);
  }
  assert.equal(directionIndex(NaN), 0);
});

test('animation definitions select states and four timed phases at eight frames per second', () => {
  const p = { moving: true, walkTime: 0, moveAngle: 0, angle: Math.PI };
  assert.equal(animations.running.animation_speed * 60, 8);
  for (let frame = 0; frame < 16; frame++) {
    p.walkTime = frame / 8;
    assert.equal(animationPose(p).row, [2, 3, 4, 1][frame % 4]);
  }
  p.shootTime = .12; assert.equal(animationPose(p).state, 'running_with_gun');
  p.moving = false; assert.equal(animationPose(p).state, 'idle_with_gun'); assert.equal(animationPose(p).row, 1);
  p.shootTime = 0; assert.equal(animationPose(p).state, 'idle');
  p.dashTime = .1; p.moving = true; assert.equal(animationPose(p).state, 'dashing'); assert.equal(animationPose(p).row, 1);
});

test('all 120 directional cells remain inside their real PNG and share a valid attachment pivot', () => {
  for (const id of chassis) {
    const png = fs.readFileSync(path.join(__dirname, manifest[id].src));
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    for (let row = 0; row < 5; row++) for (let d = 0; d < 8; d++) {
      const cell = frameRect(id, row, d);
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.x + cell.width <= width && cell.y + cell.height <= height);
      assert.ok(cell.pivotX > 0 && cell.pivotX < cell.width && cell.pivotY > 0 && cell.pivotY < cell.height);
      assert.equal(cell.flip, d > 4);
    }
  }
  assert.equal(frameRect('unknown', 0, 0), null);
  assert.equal(frameRect('spectre', 5, 0), null);
  assert.equal(frameRect('spectre', 0, 8), null);
});

test('all 192 chassis/travel/aim combinations use whole layers, independent pivots and no body clipping', () => {
  const sprites = new Sprites();
  for (const id of chassis) sprites.images[id] = { id };
  for (const id of chassis) for (let travel = 0; travel < 8; travel++) for (let aim = 0; aim < 8; aim++) {
    const calls = [], scales = [];
    const ctx = { save() {}, restore() {}, translate() {}, scale(...args) { scales.push(args); }, drawImage(...args) { calls.push(args); } };
    sprites.mech(ctx, { chassis: id, moving: true, walkTime: .125, moveAngle: angle(travel), angle: angle(aim) }, 30, 40, 90);
    assert.equal(calls.length, 2);
    for (const [index, direction, row] of [[0, travel, 3], [1, aim, 0]]) {
      const cell = frameRect(id, row, direction), draw = calls[index];
      assert.deepEqual(draw.slice(1, 5), [cell.x, cell.y, cell.width, cell.height]);
      assert.equal(draw[5], -cell.pivotX * .3); assert.equal(draw[6], -cell.pivotY * .3);
      assert.deepEqual(scales[index], [direction > 4 ? -1 : 1, 1]);
    }
  }
});

test('directional crop borders do not cut visible pixels or leak neighboring body parts', () => {
  for (const id of chassis) {
    const alpha = rgba(fs.readFileSync(path.join(__dirname, manifest[id].src)));
    for (let row = 0; row < 5; row++) for (let d = 0; d <= 4; d++) {
      const c = frameRect(id, row, d), edges = [];
      for (let x = c.x; x < c.x + c.width; x++) edges.push(alpha(x, c.y), alpha(x, c.y + c.height - 1));
      for (let y = c.y; y < c.y + c.height; y++) edges.push(alpha(c.x, y), alpha(c.x + c.width - 1, y));
      assert.ok(edges.every(a => a <= 100), `${id} row ${row}, direction ${d} has a clipped silhouette`);
    }
  }
});

test('shooting state follows actual shots, expires in simulation time and freezes on pause', () => {
  const g = new Game({ seed: 42, combat }); g.spawnClock = g.bossAt = g.nestAt = 1e9;
  g.player.weapons[0].cooldown = 0; g.step(.016, { aim: true, angle: 0 });
  assert.equal(g.player.shootTime, .12); assert.equal(animationPose(g.player).state, 'idle_with_gun');
  g.pause(); g.step(.1, {}); assert.equal(g.player.shootTime, .12);
  g.pause(); g.player.weapons[0].cooldown = 10;
  for (let i = 0; i < 20; i++) g.step(.016, {});
  assert.equal(g.player.shootTime, 0); assert.equal(animationPose(g.player).state, 'idle');
});

test('preview uses every direction while reduced motion stays planted in one view', () => {
  const sprites = new Sprites(), poses = []; sprites.ready = true; sprites.mech = (ctx, p) => poses.push(p);
  const canvas = { width: 640, height: 640, getContext: () => ({ clearRect() {} }) };
  for (let d = 0; d < 8; d++) sprites.preview(canvas, 'vector', d * 2, false);
  assert.deepEqual(poses.map(p => animationPose(p).torso), [0, 1, 2, 3, 4, 5, 6, 7]);
  sprites.preview(canvas, 'vector', 9, true);
  assert.equal(animationPose(poses.at(-1)).state, 'idle'); assert.equal(animationPose(poses.at(-1)).torso, 0);
});
