const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  const scope = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(`${__dirname}/combat-model.js`, 'utf8'), scope);
  return scope.window.CombatModel;
}

test('zones are stable, complete and preserve the declared body total', () => {
  const C = load();
  assert.deepEqual(Object.keys(C.zones), ['head', 'thorax', 'abdomen', 'arms', 'legs']);
  const body = C.createBody(137);
  assert.equal(body.health, 137);
  assert.equal(Object.values(body.parts).reduce((sum, part) => sum + part.health, 0), 137);
  assert.equal(C.zoneFor(.01), 'head');
  assert.equal(C.zoneFor(.99), 'legs');
});

test('armour layers reduce damage according to material and penetration', () => {
  const C = load();
  let worn = 0;
  const protectedHit = C.applyLayers(20, 'ballistic', 0, [{ material: 'ceramic', protection: 18, integrity: 100, damage: value => { worn += value; } }]);
  const penetratedHit = C.applyLayers(20, 'ballistic', .9, [{ material: 'ceramic', protection: 18, integrity: 100 }]);
  assert.ok(protectedHit.remaining < penetratedHit.remaining);
  assert.ok(protectedHit.blocked > 0 && worn > 0);
});

test('critical hits, conditions and limb penalties are exposed to the combat loop', () => {
  const C = load();
  const body = C.createBody(100);
  const report = C.receive(body, { amount: 100, type: 'ballistic', zone: 'head' });
  assert.equal(report.critical, true);
  assert.ok(body.status.bleed > 0 && body.status.shock > 0);
  const fresh = C.createBody(100);
  C.receive(fresh, { amount: 28, type: 'mechanical', zone: 'legs' });
  assert.ok(C.movementMultiplier(fresh) < 1);
  assert.ok(C.aimMultiplier(fresh) >= 1);
  const before = fresh.health;
  fresh.status.bleed = .5;
  C.tick(fresh, 1);
  assert.ok(fresh.health < before);
});

test('fractional bodies conserve health and a destroyed limb cannot absorb infinite shots', () => {
  const C = load();
  for (const max of [1, 4.5, 137, 250.3]) {
    const b = C.createBody(max);
    assert.ok(Math.abs(Object.values(b.parts).reduce((s,p)=>s+p.health,0)-max)<1e-9);
  }
  const b = C.createBody(100);
  for(let i=0;i<30;i++) C.receive(b,{amount:20,type:'mechanical',zone:'legs'});
  assert.equal(b.dead,true);C.tick(b,.1);assert.equal(b.health,0);
});

test('stopped bullets do not cause bleeding and contact attacks default to torso', () => {
  const C=load(),b=C.createBody(100);
  assert.equal(C.chooseZone({},{x:10,y:20}),'thorax');
  C.receive(b,{amount:8,type:'ballistic',zone:'arms'},[{protection:100,material:'steel'}]);
  assert.equal(b.status.bleed,0);
  const robot=C.createBody(100);robot.robotic=true;
  C.receive(robot,{amount:12,type:'ballistic',zone:'head'});
  assert.equal(robot.status.bleed,0);assert.ok(robot.health>0);
});
