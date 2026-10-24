const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./economy.js');
const Store = require('./storage.js');
const { Game } = require('./core.js');
const combat = require('./combat.js');
const funded = () => ({ ...Store.fresh(), credits: 100000 });
function isolated(profile) { const g = new Game({ seed: 123, combat, profile }); g.spawnClock = g.bossAt = g.nestAt = 1e9; return g; }

test('catalog has 80 distinct models, 16 per slot and market access to all twelve weapons', () => {
  assert.equal(Object.keys(E.parts).length, 80);
  assert.equal(new Set(Object.values(E.parts).map(p => p.name)).size, 80);
  for (const slot of Object.keys(E.slots)) assert.equal(Object.values(E.parts).filter(p => p.slot === slot).length, 16);
  assert.equal(Object.keys(D.weapons).length, 12);
  assert.deepEqual([...new Set(Object.values(E.parts).map(p => p.weapon).filter(Boolean))].sort(), Object.keys(D.weapons).sort());
  assert.deepEqual(Object.keys(combat.evolutions).sort(), Object.keys(D.weapons).sort());
});

test('all 400 offers scale benefits, soften penalties and preserve power and compatibility', () => {
  for (const [id, base] of Object.entries(E.parts)) {
    let previous;
    for (const quality of Object.keys(E.qualities)) {
      const part = E.resolvePart(id, quality);
      assert.equal(part.power, base.power); assert.deepEqual(part.chassis, base.chassis);
      assert.ok(Number.isSafeInteger(part.price) && part.price > 0);
      assert.ok(E.describe(part).length > 0);
      if (quality === 'standard') assert.deepEqual(part.effects, base.effects);
      if (previous) {
        assert.ok(part.price > previous.price);
        for (const stat of Object.keys(base.effects)) assert.ok(part.effects[stat] >= previous.effects[stat], `${id}/${quality}/${stat}`);
      }
      previous = part;
    }
  }
  assert.equal(E.resolvePart('__proto__'), null); assert.equal(E.resolvePart('jet', '__proto__'), null);
});

test('quality upgrades charge only the price difference and cannot duplicate or downgrade ownership', () => {
  const profile = funded(), initial = profile.credits;
  for (const quality of Object.keys(E.qualities)) {
    assert.equal(E.purchase(profile, 'jet', quality).ok, true);
    assert.equal(initial - profile.credits, E.resolvePart('jet', quality).price);
    assert.deepEqual(profile.ownedParts, ['jet']);
  }
  const before = JSON.stringify(profile);
  assert.equal(E.purchase(profile, 'jet', 'standard').ok, false);
  assert.equal(E.purchase(profile, 'jet', 'pristine').ok, false);
  assert.equal(E.purchase(profile, 'jet', '__proto__').ok, false);
  assert.equal(JSON.stringify(profile), before);
});

test('quality upgrades are atomic on save failure and leave equipped models unchanged', () => {
  const profile = funded(); E.purchase(profile, 'jet'); E.equip(profile, 'spectre', 'drive', 'jet');
  const before = JSON.stringify(profile);
  assert.equal(Store.transact(null, profile, p => E.purchase(p, 'jet', 'pristine')).ok, false);
  assert.equal(JSON.stringify(profile), before);
  const storage = { setItem(key, value) { this.raw = value; }, getItem() { return this.raw; } };
  assert.equal(Store.transact(storage, profile, p => E.purchase(p, 'jet', 'pristine')).ok, true);
  assert.equal(Store.load(storage).partQualities.jet, 'pristine');
  assert.equal(profile.loadouts.spectre.drive, 'jet');
});

test('legacy purchases retain standard stats and unowned or invalid quality claims are discarded', () => {
  const old = Store.sanitize({ version: 1, credits: 25, ownedParts: ['jet', 'bulwark'], loadouts: { spectre: { drive: 'jet', armor: 'bulwark' } } });
  assert.deepEqual(old.partQualities, { jet: 'standard', bulwark: 'standard' });
  assert.equal(E.build(old, 'spectre').effects.hp, 65);
  const raw = Store.sanitize({ ...old, partQualities: { jet: 'unknown', bulwark: 'military', spire: 'pristine' } });
  assert.deepEqual(raw.partQualities, { jet: 'standard', bulwark: 'military' });
  assert.equal(raw.credits, 25);
});

test('weapon quality only scales its own damage and survives in-run weapon evolution', () => {
  const profile = funded(); E.purchase(profile, 'frost', 'pristine'); E.equip(profile, 'spectre', 'weapon', 'frost');
  const g = isolated(profile), base = isolated();
  const weapon = g.player.weapons[0]; assert.equal(weapon.id, 'cryo'); assert.equal(weapon.qualityMultiplier, 1.65);
  assert.equal(combat.profile(g, weapon).damage, D.weapons.cryo.damage * 1.65);
  assert.equal(combat.profile(g, { id: 'needle', level: 1 }).damage, combat.profile(base, { id: 'needle', level: 1 }).damage);
  weapon.level = 5; g.player.passives.radius = 2; g.offers = [combat.candidates(g).find(o => o.type === 'evolution')]; g.pendingLevels = 1; g.status = 'upgrade'; combat.choose(g, 0);
  assert.equal(weapon.qualityMultiplier, 1.65); assert.equal(combat.profile(g, weapon).slow, .65);
  profile.partQualities.frost = 'salvaged'; assert.equal(weapon.qualityMultiplier, 1.65);
});

test('new weapon evolutions have actual distinct effects', () => {
  const g = isolated(); const spec = id => combat.profile(g, { id, level: 6 });
  assert.equal(spec('cannon').pellets, 2); assert.equal(spec('saw').pellets, 3); assert.equal(spec('saw').pierce, 6);
  assert.equal(spec('gauss').pierce, 8); assert.equal(spec('cryo').slowTime, 3);
  assert.equal(spec('flame').burn, 14 * (1 + .28 * 5) * 2);
  assert.ok(spec('mortar').splash > D.weapons.mortar.splash * 1.6);
});

test('burn refreshes without additive stacking, expires precisely and credits a kill once', () => {
  const g = isolated(), enemy = g.spawn('brute', 600, 0); g.grid.build(g.enemies);
  const payload = { damage: 1, burn: 14, burnTime: 2 };
  combat.impact(g, enemy, payload); combat.impact(g, enemy, payload);
  assert.equal(enemy.burnDamage, 14); const hp = enemy.hp;
  g.updateEnemies(.5); assert.equal(enemy.hp, hp - 7);
  combat.impact(g, enemy, { damage: 1, burn: 3, burnTime: 2 }); assert.equal(enemy.burnDamage, 14);
  g.updateEnemies(3); assert.equal(enemy.burnTime, 0);
  const expiredHp = enemy.hp; g.updateEnemies(.1); assert.equal(enemy.hp, expiredHp);
  enemy.hp = 1; combat.impact(g, enemy, { damage: .1, burn: 3, burnTime: 2 });
  g.updateEnemies(.5); const bounty = g.bountyTotal; g.updateEnemies(.5);
  assert.equal(g.kills, 1); assert.equal(bounty, E.bounty.brute); assert.equal(g.bountyTotal, bounty);
});

test('cryo slows normal movement and charges, bosses resist, and the effect expires', () => {
  const g = isolated(), enemy = g.spawn('brute', 600, 0); combat.impact(g, enemy, { damage: 1, slow: .4, slowTime: 2 });
  const x = enemy.x; g.updateEnemies(.1); assert.ok(Math.abs(x - enemy.x - enemy.speed * .6 * .1) < 1e-8);
  const boss = g.spawn('queen', -600, 0); combat.impact(g, boss, { damage: 1, slow: .4, slowTime: 2 });
  const bx = boss.x; g.updateEnemies(.1); assert.ok(Math.abs(boss.x - bx - boss.speed * .86 * .1) < 1e-8);
  const charger = g.spawn('charger', 0, 600); charger.chargeTime = .5; charger.chargeAngle = 0; combat.impact(g, charger, { damage: 1, slow: .4, slowTime: 2 });
  g.updateEnemies(.1); assert.ok(Math.abs(charger.x - 32.4) < 1e-8);
  enemy.slowTime = .05; const ex = enemy.x; g.updateEnemies(.1);
  assert.ok(Math.abs(ex - enemy.x - enemy.speed * .8 * .1) < 1e-8); assert.equal(enemy.slowTime, 0);
});

test('status clocks freeze during pause and level selection; defense and dash retain safe caps', () => {
  const g = isolated(), enemy = g.spawn('brute', 600, 0);
  combat.impact(g, enemy, { damage: 1, burn: 14, burnTime: 2, slow: .4, slowTime: 2 });
  g.pause(); g.step(.05); assert.equal(enemy.burnTime, 2); assert.equal(enemy.slowTime, 2);
  g.status = 'upgrade'; g.step(.05); assert.equal(enemy.burnTime, 2);
  g.status = 'playing'; g.player.stats.armor = 2; g.player.stats.dash = 2; g.player.invulnerable = 0; g.player.shield = 0;
  const hp = g.player.hp; g.hurtPlayer(40); assert.equal(g.player.hp, hp - 10);
  g.dash(1, 0); assert.ok(g.player.dashCooldown > 0); assert.ok(Math.abs(g.player.dashCooldown - g.player.dashBase * .2) < 1e-8);
});

test('cryo projectiles apply slow through splash and flame projectiles apply burn on impact', () => {
  for (const id of ['cryo', 'flame']) {
    const g = isolated(), target = g.spawn('brute', 120, 0), neighbor = g.spawn('brute', 125, 40);
    g.grid.build(g.enemies); combat.fire(g, { id, level: 1 }, { aim: true, angle: 0 });
    for (let i = 0; i < 30; i++) combat.projectiles(g, .01);
    if (id === 'cryo') { assert.equal(target.slowTime, 2); assert.equal(neighbor.slowTime, 2); }
    else { assert.equal(target.burnTime, 2); assert.ok(target.burnDamage > 0); }
  }
});
