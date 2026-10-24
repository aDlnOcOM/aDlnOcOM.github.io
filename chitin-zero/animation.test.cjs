const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');
const { Sprites, manifest, joints, animations, directionIndex, animationPose, frameRect } = require('./sprites.js');
const { Game, followAngle, poseDirection } = require('./core.js');
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
    const ctx = { save() {}, restore() {}, translate() {}, transform() {}, scale(...args) { scales.push(args); }, drawImage(...args) { calls.push(args); } };
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

test('calibrated couplers sit on visible material in every source pose and view', () => {
  for (const id of chassis) {
    const alpha = rgba(fs.readFileSync(path.join(__dirname, manifest[id].src)));
    for (const [row, points] of joints[id].entries()) for (const [d, [x, y]] of points.entries()) {
      assert.ok(alpha(x, y) > 100, `${id}/${row}/${d}: coupler falls outside the actual sprite`);
    }
  }
});

test('lean, recoil, mirrored views and every gait pose keep both joints at one world point', () => {
  const sprites = new Sprites(); for (const id of chassis) sprites.images[id] = { id };
  for (const id of chassis) for (let legs = 0; legs < 8; legs++) for (let torso = 0; torso < 8; torso++) for (let phase = 0; phase < 4; phase++) {
    let m = [1, 0, 0, 1, 0, 0]; const stack = [], pivots = [];
    const multiply = (a, b, c, d, e, f) => { const [A, B, C, D, E, F] = m; m = [A*a+C*b, B*a+D*b, A*c+C*d, B*c+D*d, A*e+C*f+E, B*e+D*f+F]; };
    const ctx = { save() { stack.push([...m]); }, restore() { m = stack.pop(); }, translate(x,y) { multiply(1,0,0,1,x,y); }, scale(x,y) { multiply(x,0,0,y,0,0); }, transform: multiply,
      drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        const row = sy === 0 ? 0 : [2,3,4,1][phase], cell = frameRect(id, row, sy === 0 ? torso : legs);
        const px = dx + cell.pivotX * dw / sw, py = dy + cell.pivotY * dh / sh;
        pivots.push([m[0]*px+m[2]*py+m[4], m[1]*px+m[3]*py+m[5]]);
      } };
    sprites.mech(ctx, { chassis: id, moving: true, walkTime: phase/8, angle: angle(torso), moveAngle: angle(legs), shootTime: .12, leanX: phase%2 ? 1 : -1, leanY: 1 }, 80, 120, 90);
    assert.equal(pivots.length, 2); assert.equal(stack.length, 0);
    for (const [x,y] of pivots) { assert.ok(Math.abs(x-80)<1e-8); assert.ok(Math.abs(y-120)<1e-8); }
  }
});

test('motor acceleration is smooth, diagonal-normalized and independent of timestep subdivision', () => {
  for (const id of chassis) {
    const a = new Game({ chassis: id }), b = new Game({ chassis: id }), diagonal = new Game({ chassis: id });
    a.updatePlayer(.05, { x: 1 }); assert.ok(a.player.vx > 0 && a.player.vx < a.player.speed);
    for (let i = 0; i < 5; i++) b.updatePlayer(.01, { x: 1 });
    diagonal.updatePlayer(.05, { x: 1, y: 1 });
    assert.ok(Math.abs(a.player.x-b.player.x)<1e-8); assert.ok(Math.abs(a.player.vx-b.player.vx)<1e-8);
    assert.ok(Math.abs(a.player.x-Math.hypot(diagonal.player.x,diagonal.player.y))<1e-8);
    for (let i=0;i<30;i++) a.updatePlayer(1/60,{x:1});
    assert.ok(a.player.vx > a.player.speed*.99);
  }
});

test('release brakes to rest within a short distance and reversal does not instantly flip velocity', () => {
  for (const id of chassis) {
    const g = new Game({ chassis: id }), p = g.player;
    for (let i=0;i<60;i++) g.updatePlayer(1/60,{x:1});
    const start = p.x; g.updatePlayer(1/60,{}); assert.ok(p.vx > 0);
    for(let i=0;i<40;i++) g.updatePlayer(1/60,{});
    assert.equal(p.vx,0); assert.equal(p.moving,false); assert.ok(p.x-start<14);
    for(let i=0;i<60;i++) g.updatePlayer(1/60,{x:1});
    g.updatePlayer(1/60,{x:-1}); assert.ok(p.vx>0);
    for(let i=0;i<30;i++) g.updatePlayer(1/60,{x:-1}); assert.ok(p.vx<0);
  }
});

test('dash remains immediate and cannot inject boosted velocity into braking', () => {
  const g = new Game(), p = g.player;
  g.updatePlayer(1/60,{x:1,dash:true}); assert.ok(Math.abs(p.x-p.speed*4.3/60)<1e-8);
  for(let i=0;i<15;i++) g.updatePlayer(1/60,{});
  assert.ok(Math.hypot(p.vx,p.vy)<=p.speed);
  for(let i=0;i<30;i++) g.updatePlayer(1/60,{}); assert.equal(p.vx,0);
});

test('visual turning follows the short arc and hysteresis prevents sector boundary flicker', () => {
  const a = followAngle(Math.PI-.02,-Math.PI+.02,.016,20);
  assert.ok(a>Math.PI-.02 && a<Math.PI+.02);
  const edge = Math.PI/2+Math.PI/8;
  assert.equal(poseDirection(edge+.02,0),0); assert.equal(poseDirection(edge+.08,0),1);
  assert.equal(poseDirection(edge-.02,1),1); assert.equal(poseDirection(edge-.08,1),0);
});

test('aim and projectiles respond immediately while presentation eases and freezes on pause', () => {
  const g = new Game({combat}), p = g.player; g.spawnClock = g.bossAt = g.nestAt = 1e9; p.weapons[0].cooldown=0;
  g.step(1/60,{x:1,aim:true,angle:0});
  assert.equal(p.angle,0); assert.ok(p.torsoFacing>0 && p.torsoFacing<Math.PI/2);
  assert.ok(g.bullets[0].vx>0); assert.ok(Math.abs(g.bullets[0].vy)<30);
  const state = JSON.stringify(p); g.pause(); g.step(.05,{x:-1}); assert.equal(JSON.stringify(p),state);
  g.status='upgrade'; g.step(.05); assert.equal(JSON.stringify(p),state);
});
