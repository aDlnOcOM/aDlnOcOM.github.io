const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('./view.js');
const D = require('./data.js');
const { Game } = require('./core.js');
const combat = require('./combat.js');
const Renderer = require('./render.js');
const isolated = () => { const g = new Game({ seed: 71, combat }); g.spawnClock = g.bossAt = g.nestAt = 1e9; return g; };

test('camera-relative forward, reverse and strafe remain normalized at every bearing', () => {
  for (let yaw = -Math.PI; yaw < Math.PI; yaw += .1) {
    const forward = V.movement(yaw, 0, 1), right = V.movement(yaw, 1, 0), diag = V.movement(yaw, 1, 1);
    assert.ok(Math.abs(forward.x - Math.cos(yaw)) < 1e-10);
    assert.ok(Math.abs(forward.x * right.x + forward.y * right.y) < 1e-10);
    assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-10);
  }
});

test('look wraps yaw, clamps pitch and ignores invalid movement', () => {
  const v = { yaw: 0, pitch: 0 }; V.look(v, 1e6, 1e6); assert.equal(v.pitch, -.85); assert.ok(Math.abs(v.yaw) <= Math.PI);
  V.look(v, 0, -1e6); assert.equal(v.pitch, .7); const saved = { ...v }; V.look(v, NaN, 0); assert.deepEqual(v, saved);
});

test('the optical axis projects to the reticle for every yaw and pitch; behind-camera objects are culled', () => {
  const g = isolated(), p = g.player;
  for (const yaw of [0, 1, Math.PI, -2]) for (const pitch of [-.85, -.3, 0, .7]) {
    p.angle = yaw; p.pitch = pitch; const c = V.camera(p, 1280, 800, true);
    const point = V.project(c, Math.cos(yaw) * Math.cos(pitch) * 200, Math.sin(yaw) * Math.cos(pitch) * 200, V.EYE + Math.sin(pitch) * 200);
    assert.ok(Math.abs(point.x - 640) < 1e-8); assert.ok(Math.abs(point.y - 400) < 1e-8);
    assert.equal(V.project(c, -Math.cos(yaw) * 100, -Math.sin(yaw) * 100, V.EYE), null);
  }
});

test('ground polygons crossing the near plane are clipped to finite coordinates', () => {
  const g = isolated(); g.player.angle = 0; const c = V.camera(g.player, 800, 600, true);
  const face = V.face(c, [[-50, -50, 0], [50, -50, 0], [50, 50, 0], [-50, 50, 0]]);
  assert.equal(face.length, 4);
  for (const point of face) { assert.ok(Number.isFinite(point.x)); assert.ok(Number.isFinite(point.y)); assert.ok(point.depth >= V.NEAR); }
  assert.deepEqual(V.face(c, [[-10, -10, 0], [-10, 10, 0], [-20, 0, 0]]), []);
});

test('FPS bullets follow pitch and hit the aimed body, never a body below the ray', () => {
  const shoot = pitch => {
    const g = isolated(), p = g.player; p.angle = 0; p.pitch = pitch; p.stats.critical = 0;
    p.weapons = [{ id: 'rail', level: 1, cooldown: 0 }]; const e = g.spawn('brute', 240, 0); g.grid.build(g.enemies);
    combat.fire(g, p.weapons[0], { fps: true, aim: true, angle: 0 });
    for (let i = 0; i < 60; i++) combat.projectiles(g, .01);
    return e;
  };
  const hit = shoot(Math.atan2(24 - V.EYE, 240)); assert.ok(hit.hp < hit.maxHp);
  const miss = shoot(.5); assert.equal(miss.hp, miss.maxHp);
});

test('explosive shots collide with the floor before enemies behind that impact', () => {
  const g = isolated(); g.player.angle = 0; g.player.pitch = -.8; g.player.stats.critical = 0;
  const close = g.spawn('brute', 75, 60), far = g.spawn('brute', 350, 0); g.grid.build(g.enemies);
  combat.fire(g, { id: 'mortar', level: 1 }, { fps: true, aim: true, angle: 0 });
  for (let i = 0; i < 70; i++) combat.projectiles(g, .01);
  assert.equal(g.bullets.length, 0); assert.ok(close.hp < close.maxHp); assert.equal(far.hp, far.maxHp);
});

test('FPS aim does not turn toward rear targets; manual fire gating and module flashes are independent', () => {
  const g = isolated(), p = g.player; g.spawn('mite', -100, 0);
  p.weapons = [{ id: 'needle', level: 1, cooldown: 0 }, { id: 'rail', level: 1, cooldown: 1 }];
  g.step(.01, { fps: true, aim: true, angle: 0, pitch: -.1, fire: false }); assert.equal(p.angle, 0); assert.equal(g.bullets.length, 0);
  g.step(.01, { fps: true, aim: true, angle: 0, pitch: -.1, fire: true });
  assert.ok(p.weapons[0].flash > 0); assert.equal(p.weapons[1].flash, 0); assert.ok(g.bullets.every(b => b.vx > 0));
  const state = JSON.stringify(p); g.pause(); g.step(.05, { aim: true, angle: 2 }); assert.equal(JSON.stringify(p), state);
});

test('dash without movement uses this step’s camera heading, not the previous heading', () => {
  const g = isolated(); g.step(.01, { aim: true, fps: true, angle: 0, dash: true });
  assert.ok(g.player.x > 0); assert.equal(g.player.y, 0);
});

test('every one of twelve weapons installs in-run, persists across drafts and has a noncentral mount', () => {
  const g = isolated();
  for (const id of Object.keys(D.weapons).filter(id => id !== g.player.weapons[0].id)) {
    const choice = combat.candidates(g).find(o => o.type === 'weapon' && o.id === id); assert.ok(choice);
    g.offers = [choice]; g.pendingLevels = 1; g.status = 'upgrade'; assert.equal(combat.choose(g, 0), true);
  }
  assert.equal(g.player.weapons.length, V.MAX_WEAPONS); assert.equal(new Set(g.player.weapons.map(w => w.id)).size, 12);
  const mounts = V.mounts(12, 1280, 800); assert.equal(mounts.length, 12);
  assert.equal(new Set(mounts.map(m => `${m.x},${m.y}`)).size, 12);
  for (const m of mounts) { assert.ok(Math.abs(m.x - 640) > 300); assert.ok(m.y > 0 && m.y < 800); assert.ok(m.size > 0); }
});

test('sphere sweeps catch fast 3D bullets and reject vertical misses', () => {
  assert.equal(V.sphereHit({ x: 0, y: 0, z: 10 }, { x: 100, y: 0, z: 10 }, { x: 50, y: 0, z: 10 }, 5), .45);
  assert.equal(V.sphereHit({ x: 0, y: 0, z: 50 }, { x: 100, y: 0, z: 50 }, { x: 50, y: 0, z: 10 }, 5), null);
});

test('cockpit renders bounded finite geometry at all pitch extremes, aspect ratios and maximum population', () => {
  const calls = [];
  const context = new Proxy({}, { get(target, key) {
    if (key.startsWith('create') && key.endsWith('Gradient')) return () => ({ addColorStop() {} });
    return target[key] || ((...args) => { for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), key); calls.push(key); });
  }, set(t, k, v) { t[k] = v; return true; } });
  for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
    const canvas = { clientWidth: width, clientHeight: height, getContext: () => context }, g = isolated();
    const r = new Renderer(canvas, { getContext: () => context });
    g.player.weapons = Object.keys(D.weapons).map(id => ({ id, level: 6, flash: .1 }));
    for (let i = 0; i < D.limits.enemies; i++) g.spawn(Object.keys(D.enemies)[i % 7], Math.cos(i) * (100 + i * 5), Math.sin(i) * (100 + i * 5));
    for (const pitch of [-.85, 0, .7]) { g.player.pitch = pitch; r.draw(g); }
  }
  assert.ok(calls.length > 10000); assert.ok(calls.length < 500000);
});
