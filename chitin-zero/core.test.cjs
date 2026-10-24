const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const { Game, Grid, random, segmentHit } = require('./core.js');
const combat = require('./combat.js');
const Store = require('./storage.js');
const game = options => new Game({ seed: 42, combat, ...options });
const isolated = options => { const g = game(options); g.spawnClock = 1e9; g.bossAt = g.nestAt = 1e9; return g; };

test('seeded random and default loadouts are deterministic', () => {
  const a = random(19), b = random(19);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  for (const [id, frame] of Object.entries(D.chassis)) {
    const g = game({ chassis: id }); assert.equal(g.player.hp, frame.hp); assert.equal(g.player.weapons[0].id, frame.weapon);
  }
  assert.equal(game({ chassis: 'invalid' }).player.chassis, 'spectre');
  assert.equal(game({ chassis: '__proto__', core: 'constructor' }).player.chassis, 'spectre');
});
test('movement is normalized and dash provides limited immunity and cooldown', () => {
  const a = isolated(), b = isolated(); a.step(.05, { x: 1 }); b.step(.05, { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(b.player.x, b.player.y) - a.player.x) < 1e-9);
  a.player.invulnerable = 0; assert.equal(a.dash(1, 0), true); assert.equal(a.hurtPlayer(50), false); assert.equal(a.dash(1, 0), false);
  for (let i = 0; i < 16; i++) a.step(.05);
  assert.equal(a.hurtPlayer(50), true); assert.ok(a.player.dashCooldown > 0);
});
test('shield absorbs damage, waits before recharging and death is terminal', () => {
  const g = isolated(), p = g.player; p.invulnerable = 0;
  g.hurtPlayer(60); assert.equal(p.shield, 0); assert.equal(p.hp, p.maxHp - 15);
  g.step(.05); assert.equal(p.shield, 0);
  p.sinceHit = 4.1; g.step(.05); assert.ok(p.shield > 0);
  p.invulnerable = 0; g.hurtPlayer(10000); assert.equal(g.status, 'dead');
  const time = g.time; g.step(.05, { x: 1 }); assert.equal(g.time, time); assert.equal(g.hurtPlayer(10), false);
});
test('pause and upgrade state freeze world and reject invalid timesteps', () => {
  const g = isolated(); g.pause(); const x = g.player.x; g.step(5, { x: 1 }); assert.equal(g.time, 0); assert.equal(g.player.x, x);
  g.pause(); for (const dt of [NaN, Infinity, -1, 0]) g.step(dt); assert.equal(g.time, 0);
  g.addXp(14); g.step(.01); assert.equal(g.status, 'upgrade'); const time = g.time; g.step(.05); assert.equal(g.time, time);
});
test('reactors consume charge, have distinct effects and gain duration with levels', () => {
  for (const core of Object.keys(D.cores)) {
    const g = isolated({ core }); assert.equal(g.activateCore(), false); g.player.charge = 100; g.player.coreLevel = 3; g.player.shield = 0;
    assert.equal(g.activateCore(), true); assert.equal(g.player.charge, 0); assert.equal(g.player.coreTime, D.cores[core].duration + 4);
    if (core === 'aegis') assert.equal(g.player.shield, g.player.maxShield);
    if (core === 'inferno') assert.ok(combat.profile(g, g.player.weapons[0]).damage > D.weapons.needle.damage);
    if (core === 'singularity') { const e = g.spawn('brute', 150, 0); g.step(.05); assert.ok(e.hp < e.maxHp); }
  }
});
test('kill rewards, boss count and supply drops credit an enemy only once', () => {
  const g = isolated(), e = g.spawn('queen', 100, 0);
  g.hurtEnemy(e, 99999); g.hurtEnemy(e, 99999);
  assert.equal(g.kills, 1); assert.equal(g.bossKills, 1); assert.equal(g.drops.length, 3); assert.equal(g.player.charge, 35);
});
test('bounded drop pool conserves XP when inserting repair and more experience', () => {
  const g = isolated();
  for (let i = 0; i < D.limits.drops; i++) g.drop('xp', i * 10, 0, 2);
  g.drop('xp', 10, 0, 11); g.drop('repair', 20, 0, 25);
  assert.equal(g.drops.length, D.limits.drops); assert.ok(g.drops.some(d => d.kind === 'repair'));
  assert.equal(g.drops.filter(d => d.kind === 'xp').reduce((sum, d) => sum + d.value, 0), D.limits.drops * 2 + 11);
});
test('experience queues every earned upgrade without advancing the world', () => {
  const g = isolated(); g.addXp(500); const count = g.pendingLevels; assert.ok(count > 2);
  combat.offer(g); const time = g.time;
  for (let i = 0; i < count; i++) { assert.equal(g.status, 'upgrade'); assert.equal(combat.choose(g, 0), true); }
  assert.equal(g.pendingLevels, 0); assert.equal(g.status, 'playing'); assert.equal(g.time, time); assert.equal(combat.choose(g, 0), false);
});
test('drafts contain unique options, finite rerolls and enforce twelve module slots', () => {
  const g = isolated(); g.pendingLevels = 1; combat.offer(g);
  assert.equal(new Set(g.offers.map(o => o.key)).size, 3); assert.equal(combat.choose(g, -1), false);
  for (let i = 0; i < 3; i++) assert.equal(combat.reroll(g), true);
  assert.equal(combat.reroll(g), false);
  g.player.weapons = Object.keys(D.weapons).map(id => ({ id, level: 5, cooldown: 0 }));
  assert.equal(combat.candidates(g).some(o => o.type === 'weapon'), false);
});
test('every weapon evolution requires its corresponding passive at rank two', () => {
  for (const [id, evo] of Object.entries(combat.evolutions)) {
    const g = isolated(); g.player.weapons = [{ id, level: 5, cooldown: 0 }];
    assert.equal(combat.candidates(g).some(o => o.type === 'evolution'), false);
    g.player.passives[evo.passive] = 2; const choice = combat.candidates(g).find(o => o.type === 'evolution');
    assert.equal(choice.id, id); g.pendingLevels = 1; g.status = 'upgrade'; g.offers = [choice]; combat.choose(g, 0);
    assert.equal(g.player.weapons[0].level, 6); assert.ok(Number.isFinite(combat.profile(g, g.player.weapons[0]).damage));
  }
});
test('fully completed builds can keep increasing damage in endless mode', () => {
  const g = isolated(); g.player.weapons = Object.keys(D.weapons).map(id => ({ id, level: 6, cooldown: 0 }));
  g.player.passives = Object.fromEntries(Object.entries(D.passives).map(([id, spec]) => [id, spec.max]));
  g.player.level = 100; g.player.coreLevel = 3; g.pendingLevels = 1;
  let found = false; for (let i = 0; i < 30; i++) { combat.offer(g); if (g.offers.some(o => o.id === 'overclock')) { found = true; break; } }
  assert.equal(found, true); const damage = g.player.stats.damage; combat.choose(g, g.offers.findIndex(o => o.id === 'overclock'));
  assert.ok(g.player.stats.damage > damage);
});
test('segment collision prevents tunneling and returns the earliest impact', () => {
  assert.equal(segmentHit(0, 0, 100, 0, 50, 0, 5), .45);
  assert.equal(segmentHit(0, 0, 100, 0, 50, 20, 5), null);
  assert.equal(segmentHit(0, 0, 0, 0, 0, 0, 5), 0);
  const grid = new Grid(); const a = { x: -20, y: -20 }, b = { x: 1000, y: 1000 }; grid.build([a, b]);
  assert.deepEqual(grid.near(0, 0, 50), [a]);
});
test('all twelve weapons hurt targets and piercing never repeats the same target', () => {
  for (const id of Object.keys(D.weapons)) {
    const g = isolated(); g.player.weapons = [{ id, level: 1, cooldown: 0 }];
    const e = g.spawn('queen', 100, 0); g.grid.build(g.enemies); combat.fire(g, g.player.weapons[0], {});
    for (let i = 0; i < 80; i++) combat.projectiles(g, .01);
    assert.ok(e.hp < e.maxHp, id);
  }
  const g = isolated(); const e = g.spawn('queen', 150, 0); g.player.stats.critical = 0;
  g.grid.build(g.enemies); const weapon = { id: 'rail', level: 1 }; combat.fire(g, weapon, {});
  for (let i = 0; i < 100; i++) combat.projectiles(g, .01);
  assert.equal(e.maxHp - e.hp, combat.profile(g, weapon).damage);
});
test('splash applies a single direct hit and area damage to another target', () => {
  const g = isolated(); g.player.stats.critical = 0;
  const e = g.spawn('brute', 120, 0), other = g.spawn('brute', 140, 40); g.grid.build(g.enemies);
  const w = { id: 'plasma', level: 1 }; combat.fire(g, w, { aim: true, angle: 0 });
  for (let i = 0; i < 50; i++) combat.projectiles(g, .01);
  assert.equal(e.maxHp - e.hp, 30); assert.equal(other.maxHp - other.hp, 22.5);
});
test('spitters produce projectiles, chargers telegraph and bosses telegraph before damage', () => {
  const g = isolated(); g.player.invulnerable = 0;
  const spitter = g.spawn('spitter', 350, 0); spitter.timer = 0; g.updateEnemies(.01); assert.ok(g.hostile.length > 0);
  const charger = g.spawn('charger', -300, 0); charger.timer = 0; g.updateEnemies(.01); assert.ok(charger.windup > 0); assert.equal(charger.chargeTime, 0);
  const queen = g.spawn('queen', 400, 100); queen.timer = 0; g.updateEnemies(.01); assert.ok(queen.windup > 1); assert.equal(queen.strikeX, g.player.x);
});
test('director never ends the run and reserves capacity for queen encounters', () => {
  const g = isolated(); g.time = 120; g.bossAt = 120;
  for (let i = 0; i < D.limits.enemies; i++) g.spawn('mite', i, 1000);
  g.updateDirector(.01); assert.equal(g.enemies.length, D.limits.enemies); assert.ok(g.enemies.some(e => e.boss));
  g.time = 3600; g.bossAt = 3600; g.updateDirector(.01); assert.equal(g.status, 'playing'); assert.equal(g.wave, 61);
});
test('save validation rejects corrupt values and handles unavailable storage', () => {
  assert.deepEqual(Store.load({ getItem() { return '{broken'; } }), Store.fresh());
  assert.equal(Store.save(null, Store.fresh()), false);
  const data = Store.sanitize({ version: 1, bestKills: Infinity, bestTime: -2, chassis: 'bad', sound: 'yes', history: [null, { kills: -2 }] });
  assert.equal(data.bestKills, 0); assert.equal(data.bestTime, 0); assert.equal(data.chassis, 'spectre'); assert.equal(data.sound, true); assert.equal(data.history[0].kills, 0);
  assert.equal(Store.sanitize({ version: 1, chassis: '__proto__', core: 'constructor' }).core, 'inferno');
});
test('results are credited once and a new deployment starts a fresh build', () => {
  const g = isolated(), data = Store.fresh(); g.status = 'dead'; g.kills = 42; g.time = 100;
  assert.equal(Store.record(data, g), true); assert.equal(Store.record(data, g), false); assert.equal(data.runs, 1); assert.equal(data.totalKills, 42);
  const newGame = game(); assert.equal(newGame.player.level, 1); assert.equal(newGame.player.weapons.length, 1); assert.deepEqual(newGame.player.passives, {});
});
test('ten-minute seeded simulations keep all entity pools bounded and finite', { timeout: 30000 }, () => {
  for (const chassis of Object.keys(D.chassis)) {
    const g = game({ chassis });
    // Invulnerability here isolates long-run scheduling and memory from player skill.
    for (let i = 0; i < 12000; i++) {
      g.player.invulnerable = 1; g.step(.05, { x: Math.sin(i / 180), y: Math.cos(i / 180), core: true, dash: i % 80 === 0 });
      while (g.status === 'upgrade') combat.choose(g, 0);
      assert.ok(g.enemies.length <= D.limits.enemies); assert.ok(g.bullets.length <= D.limits.bullets);
      assert.ok(g.effects.length <= D.limits.effects); assert.ok(g.drops.length <= D.limits.drops); assert.ok(g.hostile.length <= 140);
    }
    assert.ok(g.time > 599); assert.ok(g.kills > 100); assert.ok(g.player.level > 3); assert.equal(g.status, 'playing');
    for (const e of g.enemies) for (const key of ['x', 'y', 'hp']) assert.ok(Number.isFinite(e[key]));
  }
});
