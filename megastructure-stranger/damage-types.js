(() => {
  'use strict';
  const types = {
    ballistic: { name: 'Баллистический', color: '#efd7a1', shape: 'streak', particles: 5 },
    energy: { name: 'Энергетический', color: '#75ede7', shape: 'orb', particles: 8 },
    elemental: { name: 'Элементальный', color: '#ff9467', shape: 'flame', particles: 11 },
    mechanical: { name: 'Механический', color: '#b8c4d1', shape: 'shard', particles: 4 }
  };
  // Multiplier order: ballistic, energy, elemental, mechanical. No immunities.
  const profiles = {
    watcher: [1, 1, 1.2, .85], drone: [.8, 1.25, .9, 1.15],
    turret: [.7, 1.2, .8, 1.3], burstTurret: [.8, .85, 1.25, 1.2],
    enforcer: [.7, 1.15, 1.25, .9], marksman: [1.2, .85, 1, 1.1],
    warden: [.85, 1, .75, 1.15], breaker: [.65, 1.2, 1.1, .8]
  };
  const attacks = { watcher: 'energy', drone: 'energy', turret: 'energy', burstTurret: 'ballistic',
    enforcer: 'mechanical', marksman: 'ballistic', warden: 'elemental', breaker: 'mechanical' };
  function get(type) { return types[type] || types.energy; }
  function multiplier(enemy, type) {
    const index = Object.keys(types).indexOf(type);
    return index < 0 ? 1 : (profiles[enemy]?.[index] ?? 1);
  }
  function resolve(amount, enemy, type) { return Math.max(0, amount) * multiplier(enemy, type); }
  window.DamageTypes = { types, profiles, attacks, get, multiplier, resolve };
})();
