const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./economy.js');
const Store = require('./storage.js');
const { Game } = require('./core.js');
const combat = require('./combat.js');
const { WALK_FPS, walkFrame, Sprites, manifest } = require('./sprites.js');
const memory = () => ({ raw: null, getItem() { return this.raw; }, setItem(key, value) { this.raw = value; } });
const funded = () => ({ ...Store.fresh(), credits: 10000 });
function quietGame(options = {}) { const g = new Game({ seed: 7, combat, ...options }); g.spawnClock = g.nestAt = g.bossAt = 1e9; return g; }

test('walking uses eight timed frames a second regardless of chassis or upgrades', () => {
  assert.equal(WALK_FPS, 8);
  for (const speed of [1, 1.5, 2]) {
    const g = quietGame(); g.player.stats.speed = speed;
    for (let step = 1; step <= 60; step++) {
      g.updatePlayer(1 / 60, { x: 1 });
      assert.equal(walkFrame(g.player), Math.floor((step / 60 + 1e-9) * 8) % 4);
    }
  }
});
test('idle and dash use a planted pose; aiming never rotates the travel direction', () => {
  const g = quietGame(); g.updatePlayer(.04, { x: 1, aim: true, angle: Math.PI });
  assert.equal(g.player.moveAngle, 0); assert.equal(g.player.angle, Math.PI);
  g.updatePlayer(.04, {}); assert.equal(walkFrame(g.player), 1); assert.equal(g.player.walkTime, 0);
  g.updatePlayer(.04, { y: 1, dash: true }); assert.equal(walkFrame(g.player), 1); assert.equal(g.player.walkTime, 0);
  assert.ok(g.player.dashTime > 0); assert.equal(g.player.moveAngle, Math.PI / 2);
});
test('paused and level-up screens freeze the locomotion clock', () => {
  const g = quietGame(); g.step(.05, { x: 1 }); const walk = g.player.walkTime;
  g.pause(); g.step(.05, { x: 1 }); assert.equal(g.player.walkTime, walk);
  g.status = 'upgrade'; g.step(.05, { x: 1 }); assert.equal(g.player.walkTime, walk);
});
test('auto-aim keeps a stable turret bearing between shots while the legs travel elsewhere', () => {
  const g = quietGame(); g.spawn('brute', 0, -200); g.player.weapons[0].cooldown = 2;
  for (let i = 0; i < 10; i++) {
    g.step(.02, { x: 1 }); assert.equal(g.player.moveAngle, 0); assert.ok(g.player.angle < -1.5);
  }
});
test('every kill pays its bounty exactly once and elites pay triple', () => {
  const g = quietGame();
  for (const type of Object.keys(E.bounty)) {
    const previous = g.bountyTotal, e = g.spawn(type, 200, 0, true); g.hurtEnemy(e, 1e9); g.hurtEnemy(e, 1e9);
    assert.equal(g.bountyTotal - previous, E.bounty[type] * 3); assert.equal(g.bountyKills[type], 1);
  }
});
test('banking is incremental, durable, retryable and never repays credited kills', () => {
  const profile = Store.fresh(), storage = memory(), g = quietGame();
  g.bountyTotal = 20; assert.deepEqual(Store.bankBounty(storage, profile, g), { ok: true, amount: 20 });
  assert.equal(profile.credits, 20); assert.equal(g.bountyPaid, 20);
  assert.equal(Store.bankBounty(storage, profile, g).amount, 0); assert.equal(profile.credits, 20);
  g.bountyTotal = 40; assert.equal(Store.bankBounty(null, profile, g).ok, false); assert.equal(g.bountyPaid, 20); assert.equal(profile.credits, 20);
  assert.equal(Store.bankBounty(storage, profile, g).amount, 20); assert.equal(Store.load(storage).credits, 40);
});
test('purchase rejects insufficient funds, unknown ids and duplicate purchases', () => {
  const profile = Store.fresh(); assert.equal(E.purchase(profile, 'jet').ok, false); assert.equal(profile.credits, 0);
  profile.credits = 200; assert.equal(E.purchase(profile, 'jet').ok, true); assert.equal(profile.credits, 20);
  assert.equal(E.purchase(profile, 'jet').ok, false); assert.equal(E.purchase(profile, '__proto__').ok, false); assert.equal(profile.credits, 20);
});
test('failed storage transactions do not spend credits or install a component', () => {
  const profile = funded(), before = JSON.stringify(profile);
  assert.equal(Store.transact(null, profile, next => E.purchase(next, 'jet')).ok, false);
  assert.equal(JSON.stringify(profile), before);
  const storage = memory(); Store.transact(storage, profile, next => E.purchase(next, 'jet'));
  assert.equal(profile.credits, 9820);
  assert.equal(Store.transact(null, profile, next => E.equip(next, 'spectre', 'drive', 'jet')).ok, false);
  assert.deepEqual(profile.loadouts.spectre, {});
});
test('assembly enforces ownership, slot, platform compatibility and power budget', () => {
  const profile = funded();
  assert.equal(E.equip(profile, 'spectre', 'drive', 'jet').ok, false);
  for (const id of ['jet', 'lance', 'hive', 'capacitor', 'ceramic']) E.purchase(profile, id);
  assert.equal(E.equip(profile, 'spectre', 'drive', 'lance').ok, false);
  assert.equal(E.equip(profile, 'spectre', 'weapon', 'lance').ok, false);
  assert.equal(E.equip(profile, 'spectre', 'weapon', 'hive').ok, true);
  assert.equal(E.equip(profile, 'spectre', 'reactor', 'capacitor').ok, true);
  assert.equal(E.equip(profile, 'spectre', 'drive', 'jet').ok, false);
  assert.equal(E.build(profile, 'spectre').power, 8);
  assert.equal(E.equip(profile, 'spectre', 'reactor', null).ok, true);
  assert.equal(E.equip(profile, 'spectre', 'drive', 'jet').ok, true);
  assert.equal(profile.ownedParts.includes('capacitor'), true);
  assert.deepEqual(profile.loadouts.bastion, {});
});
test('all eighty models have visual definitions and real gameplay effects', () => {
  assert.equal(Object.keys(E.parts).length, 80); assert.equal(new Set(Object.values(E.parts).map(p => `${p.visual}/${p.visualHue || 0}/${p.visualScale || 1}`)).size, 80);
  for (const [id, part] of Object.entries(E.parts)) {
    const profile = funded(), chassis = part.chassis?.[0] || 'spectre'; E.purchase(profile, id); E.equip(profile, chassis, part.slot, id);
    const g = quietGame({ chassis, profile }), base = quietGame({ chassis });
    assert.equal(g.player.installedParts[part.slot], id);
    assert.equal(E.visualParts(g.player.installedParts)[0].visual, part.visual);
    if (part.weapon) assert.equal(g.player.weapons[0].id, part.weapon);
    for (const [stat, value] of Object.entries(part.effects)) {
      if (stat === 'hp' || stat === 'shield') assert.equal(g.player[stat], base.player[stat] + value);
      else assert.ok(Math.abs(g.player.stats[stat] - base.player.stats[stat] - value) < 1e-9);
    }
  }
});
test('old saves migrate without retroactive credits and corrupt assemblies are sanitized', () => {
  const old = Store.sanitize({ version: 1, bestKills: 500, totalKills: 1000 }); assert.equal(old.credits, 0); assert.equal(old.bestKills, 500);
  const profile = Store.sanitize({ version: 1, credits: -1, earnedCredits: Infinity, ownedParts: ['jet', 'jet', '__proto__', 'lance'], loadouts: { spectre: { drive: 'jet', weapon: 'lance', armor: 'jet' } } });
  assert.deepEqual(profile.ownedParts, ['jet', 'lance']); assert.deepEqual(profile.loadouts.spectre, { drive: 'jet' }); assert.equal(profile.credits, 0);
});
test('saved builds survive death and deploy as snapshots, not shared mutable objects', () => {
  const profile = funded(), storage = memory(); E.purchase(profile, 'bulwark'); E.equip(profile, 'spectre', 'armor', 'bulwark');
  Store.save(storage, profile); const loaded = Store.load(storage), g = quietGame({ profile: loaded });
  g.status = 'dead'; Store.record(loaded, g); E.equip(loaded, 'spectre', 'armor', null);
  assert.equal(g.player.installedParts.armor, 'bulwark'); assert.equal(profile.loadouts.spectre.armor, 'bulwark');
  const restarted = quietGame({ profile }); assert.equal(restarted.player.maxHp, 180); assert.equal(restarted.player.level, 1);
});
test('sprite compositor samples directional layers and every installed component without rotating the body', () => {
  const sprites = new Sprites(), calls = [], rotations = [];
  for (const [name, asset] of Object.entries(manifest)) sprites.images[name] = { name, naturalWidth: asset.width || 1254, naturalHeight: asset.height || 1254 };
  const ctx = new Proxy({}, { get: (_, name) => name === 'drawImage' ? (...args) => calls.push(args) : name === 'rotate' ? angle => rotations.push(angle) : () => {} });
  const p = quietGame().player; p.moving = true; p.walkTime = .26; p.angle = Math.PI; p.moveAngle = 0;
  p.installedParts = { armor: 'bulwark', drive: 'jet', reactor: 'barrier', weapon: 'hive', utility: 'hunter' };
  sprites.mech(ctx, p, 0, 0, 83);
  assert.equal(calls.filter(c => c[0].name === 'spectre').length, 2); assert.equal(calls.filter(c => c[0].name === 'parts').length, 5);
  assert.equal(calls.filter(c => c[0].name === 'mechs').length, 0);
  assert.equal(rotations.length, 5, 'only component icons rotate, never the directional body');
  const layers = calls.filter(c => c[0].name === 'spectre');
  assert.equal(layers[0][1], 384); assert.equal(layers[0][2], 780);
  assert.equal(layers[1][1], 384); assert.equal(layers[1][2], 0);
});
