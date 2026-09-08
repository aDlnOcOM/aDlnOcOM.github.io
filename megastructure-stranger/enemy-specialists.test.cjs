const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load() {
  const scope = { window: {} }; vm.createContext(scope);
  for (const file of ['enemy-specialists.js', 'perception.js', 'security-ai.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), scope);
  return { special: scope.window.EnemySpecialists, ai: scope.window.SecurityAI };
}
test('burst turret spaces its remaining rounds and cancels on lost sight', () => {
  const { special } = load();
  for (const remaining of [2, 3]) {
    const turret = { burstLeft: remaining, burstDelay: .14 }; let shots = 1;
    special.burst(turret, .1, () => true, () => shots++); assert.equal(shots, 1);
    for (let n = 0; n < remaining; n++) special.burst(turret, .14, () => true, () => shots++);
    assert.equal(shots, remaining + 1); assert.equal(turret.burstLeft, 0);
  }
  const turret = { burstLeft: 3, burstDelay: 0 };
  special.burst(turret, .2, () => false, () => assert.fail('shot through cover'));
  assert.equal(turret.burstLeft, 0);
});
test('breaker telegraphs, locks charge direction, hits once and recovers', () => {
  const { special } = load();
  const boss = { x: 0, y: 0, angle: 0, radius: 34, speed: 76, damage: 24 };
  const player = { x: 100, y: 0, radius: 13 }; let hits = 0;
  const move = (g, x, y) => { g.x += x; g.y += y; };
  const step = dt => special.breaker(boss, dt, player, () => true, move, () => hits++);
  step(.1); assert.equal(boss.attackPhase, 'windup'); assert.equal(boss.x, 0);
  player.y = 50; step(.85); assert.equal(boss.attackPhase, 'charge'); assert.equal(boss.angle, 0);
  player.y = 0; step(.15); step(.01); assert.equal(hits, 1);
  step(.5); assert.equal(boss.attackPhase, 'recover');
  const x = boss.x; step(.5); assert.equal(boss.x, x);
});
test('specialists keep distinct engagement distances without melee ranged attacks', () => {
  const { ai } = load();
  const make = type => ({ type, x: 0, y: 0, angle: 0, radius: 15, health: 50, speed: 100, fireTimer: 0, fireRate: 1, phase: 0 });
  const melee = make('enforcer'), ranged = make('marksman');
  const player = { x: 300, y: 0, radius: 13 }; const shots = [];
  const env = { now: 1, player, alarm: false, walls: [], los: () => true, report() {},
    fire: g => shots.push(g.type), move: (g, x, y) => { g.x += x; g.y += y; } };
  for (let n = 0; n < 10; n++) { ai.tick(melee, .1, env); ai.tick(ranged, .1, env); }
  assert.ok(melee.x > 0); assert.equal(ranged.x, 0);
  assert.equal(shots.includes('enforcer'), false); assert.ok(shots.includes('marksman'));
  const turret = make('burstTurret'); turret.homeAngle = 0;
  ai.tick(turret, .5, env); assert.equal(turret.x, 0);
});
