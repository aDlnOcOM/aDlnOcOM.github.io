(function (root) {
  'use strict';
  const D = root.ChitinData || require('./data.js');
  const C = root.ChitinCore || require('./core.js');
  const evolutions = {
    needle: { passive: 'rate', name: 'ШТОРМ', text: 'Усиленная очередь пробивает дополнительную цель.' },
    scatter: { passive: 'armor', name: 'КАРТЕЧЬ', text: 'Ещё четыре поражающих элемента в каждом залпе.' },
    plasma: { passive: 'radius', name: 'СВЕРХНОВАЯ', text: 'Радиус плазменного взрыва увеличен в полтора раза.' },
    rail: { passive: 'critical', name: 'ГОРИЗОНТ', text: 'Каждый снаряд пробивает до четырнадцати целей.' },
    rocket: { passive: 'damage', name: 'РОЙ', text: 'Три самонаводящиеся ракеты за один залп.' },
    arc: { passive: 'shield', name: 'КАТАКЛИЗМ', text: 'Импульсы испускаются на 40% чаще.' }
  };
  function profile(game, weapon) {
    const spec = D.weapons[weapon.id], p = game.player, level = weapon.level;
    const evolved = level >= 6;
    return { ...spec, damage: spec.damage * (1 + .28 * (level - 1)) * p.stats.damage * (p.core === 'inferno' && p.coreTime > 0 ? 1.3 : 1),
      delay: spec.delay * Math.pow(.94, level - 1) / p.stats.rate / (p.core === 'inferno' && p.coreTime > 0 ? 1.8 : 1) * (evolved && weapon.id === 'arc' ? .6 : 1),
      range: spec.range * p.stats.radius, splash: (spec.splash || 0) * p.stats.radius * (1 + (level - 1) * .06) * (evolved && weapon.id === 'plasma' ? 1.5 : 1),
      pellets: weapon.id === 'scatter' ? spec.pellets + Math.floor(level / 2) + (evolved ? 4 : 0) : weapon.id === 'rocket' && evolved ? 3 : (spec.pellets || 1),
      pierce: weapon.id === 'rail' ? evolved ? 14 : 4 + level : weapon.id === 'needle' && evolved ? 2 : 1 };
  }
  function target(game, range, from = game.player) {
    let best = null, bestDist = range;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const dist = C.distance(from, e);
      if (dist < bestDist + e.radius) { bestDist = dist - e.radius; best = e; }
    }
    return best;
  }
  function fire(game, weapon, input) {
    const p = game.player, spec = profile(game, weapon), enemy = target(game, spec.range);
    if (!enemy && !input.aim) return false;
    let angle = input.aim ? input.angle : Math.atan2(enemy.y - p.y, enemy.x - p.x);
    if (!Number.isFinite(angle)) angle = p.angle;
    if (!input.aim && enemy) p.angle = angle;
    if (weapon.id === 'arc') {
      if (!enemy) return false;
      game.effect('ring', p.x, p.y, spec.color, spec.range, .4);
      for (const e of game.grid.near(p.x, p.y, spec.range + 80)) {
        if (!e.dead && C.distance(e, p) < spec.range + e.radius) game.hurtEnemy(e, spec.damage);
      }
    } else {
      for (let i = 0; i < spec.pellets; i++) {
        if (game.bullets.length >= D.limits.bullets) break;
        const spread = spec.pellets > 1 ? (i / (spec.pellets - 1) - .5) * spec.spread : (game.rng() - .5) * spec.spread;
        const a = angle + spread, critical = game.rng() < p.stats.critical;
        game.bullets.push({ x: p.x + Math.cos(angle) * 31, y: p.y + Math.sin(angle) * 31,
          vx: Math.cos(a) * spec.speed, vy: Math.sin(a) * spec.speed, speed: spec.speed,
          radius: spec.radius, color: spec.color, damage: spec.damage * (critical ? 2 : 1), critical,
          life: spec.range / spec.speed, splash: spec.splash, homing: spec.homing, pierce: spec.pierce, hit: new Set(), weapon: weapon.id });
      }
      game.effect('muzzle', p.x + Math.cos(angle) * 35, p.y + Math.sin(angle) * 35, spec.color, weapon.id === 'rail' ? 22 : 13, .07);
    }
    game.shotSerial = (game.shotSerial || 0) + 1; game.lastWeapon = weapon.id;
    return true;
  }
  function projectiles(game, dt) {
    for (const b of game.bullets) {
      if (b.homing) {
        const enemy = target(game, 600, b);
        if (enemy) {
          const desired = Math.atan2(enemy.y - b.y, enemy.x - b.x), current = Math.atan2(b.vy, b.vx);
          const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
          const angle = current + C.clamp(diff, -4 * dt, 4 * dt);
          b.vx = Math.cos(angle) * b.speed; b.vy = Math.sin(angle) * b.speed;
        }
      }
      const elapsed = Math.min(dt, b.life), nx = b.x + b.vx * elapsed, ny = b.y + b.vy * elapsed;
      const candidates = game.grid.near((b.x + nx) / 2, (b.y + ny) / 2, Math.hypot(nx - b.x, ny - b.y) / 2 + 85);
      const hits = [];
      for (const e of candidates) {
        if (e.dead || b.hit.has(e.id)) continue;
        const t = C.segmentHit(b.x, b.y, nx, ny, e.x, e.y, e.radius + b.radius);
        if (t !== null) hits.push({ e, t });
      }
      hits.sort((a, z) => a.t - z.t);
      for (const { e, t } of hits) {
        if (e.dead) continue;
        b.hit.add(e.id); game.hurtEnemy(e, b.damage, b.critical); b.pierce--;
        const ix = b.x + (nx - b.x) * t, iy = b.y + (ny - b.y) * t;
        game.effect('spark', ix, iy, b.color, b.radius * 2 + 7, .18);
        if (b.splash) {
          game.effect('burst', ix, iy, b.color, b.splash, .35);
          for (const other of game.grid.near(ix, iy, b.splash + 80)) {
            if (other !== e && !other.dead && Math.hypot(other.x - ix, other.y - iy) < b.splash + other.radius) game.hurtEnemy(other, b.damage * .75);
          }
        }
        if (b.pierce <= 0) { b.life = 0; break; }
      }
      b.x = nx; b.y = ny; b.life -= elapsed;
    }
    game.bullets = game.bullets.filter(b => b.life > 0);
  }
  function candidates(game) {
    const p = game.player, options = [];
    for (const [id, spec] of Object.entries(D.weapons)) {
      const owned = p.weapons.find(w => w.id === id), evolution = evolutions[id];
      if (!owned && p.weapons.length < 4 || owned && owned.level < 5) {
        options.push({ key: `weapon:${id}`, type: 'weapon', id, name: spec.name, label: owned ? 'МОДЕРНИЗАЦИЯ МОДУЛЯ' : 'НОВЫЙ МОДУЛЬ',
          level: (owned?.level || 0) + 1, description: spec.description, glyph: spec.glyph, color: spec.color });
      } else if (owned?.level === 5 && (p.passives[evolution.passive] || 0) >= 2) {
        options.push({ key: `evolution:${id}`, type: 'evolution', id, name: evolution.name, label: 'ЭВОЛЮЦИЯ / VI', level: 6,
          description: evolution.text, glyph: spec.glyph, color: '#ffdf68' });
      }
    }
    for (const [id, spec] of Object.entries(D.passives)) {
      const level = p.passives[id] || 0;
      if (level < spec.max) options.push({ key: `passive:${id}`, type: 'passive', id, name: spec.name, label: 'СИСТЕМНОЕ УЛУЧШЕНИЕ', level: level + 1, description: spec.description, glyph: spec.glyph, color: '#5ef5e0' });
    }
    if (p.level >= 4) for (const [id, core] of Object.entries(D.cores)) {
      if (id !== p.core || (p.coreLevel || 1) < 3) options.push({ key: `core:${id}`, type: 'core', id, name: core.name,
        label: id === p.core ? 'МОДЕРНИЗАЦИЯ ЯДРА' : 'ЗАМЕНА ЯДРА', level: id === p.core ? (p.coreLevel || 1) + 1 : 1,
        description: id === p.core ? '+2 секунды действия и +25% заряда. Максимум III.' : `${core.description} Заменяет текущее ядро; заряд сохраняется.`, glyph: core.glyph, color: core.color });
    }
    return options;
  }
  function offer(game) {
    if (!game.pendingLevels || game.status === 'dead') return false;
    const options = candidates(game);
    // Endless builds retain meaningful choices after every finite upgrade is capped.
    options.push({ key: 'supply:repair', type: 'supply', id: 'repair', name: 'ПОЛЕВОЙ СЕРВИС', label: 'ПРИПАСЫ', level: 1, description: 'Восстановить 40% корпуса и весь щит.', glyph: '+', color: '#5ef5e0' });
    if (options.length < 3) options.push({ key: 'supply:overclock', type: 'supply', id: 'overclock', name: 'БЕСКОНЕЧНЫЙ РАЗГОН', label: 'ПРЕДЕЛ СНЯТ', level: 1, description: '+5% к базовому урону. Доступно после полной сборки.', glyph: '↟', color: '#ffdf68' });
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(game.rng() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    game.offers = options.slice(0, 3); game.status = 'upgrade'; return true;
  }
  function choose(game, index) {
    if (game.status !== 'upgrade' || !Number.isInteger(index)) return false;
    const choice = game.offers[index], p = game.player;
    if (!choice) return false;
    if (choice.type === 'weapon' || choice.type === 'evolution') {
      const owned = p.weapons.find(w => w.id === choice.id);
      if (owned) owned.level = choice.level;
      else if (p.weapons.length < 4) p.weapons.push({ id: choice.id, level: 1, cooldown: .1 });
      else return false;
    } else if (choice.type === 'passive') {
      const spec = D.passives[choice.id]; p.passives[choice.id] = choice.level;
      if (spec.stat === 'hp') { p.maxHp += spec.value; p.hp = Math.min(p.maxHp, p.hp + spec.value); }
      else if (spec.stat === 'shield') { p.maxShield += spec.value; p.shield = Math.min(p.maxShield, p.shield + spec.value); }
      else p.stats[spec.stat] += spec.value;
    } else if (choice.type === 'core') {
      p.core = choice.id; p.coreLevel = choice.level; p.coreTime = 0; p.charge = Math.min(100, p.charge + (choice.level > 1 ? 25 : 0));
    } else if (choice.id === 'repair') { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .4); p.shield = p.maxShield; }
    else p.stats.damage += .05;
    game.pendingLevels--; game.offers = []; game.status = 'playing';
    game.effect('ring', p.x, p.y, choice.color, 80, .65);
    if (game.pendingLevels > 0) offer(game);
    return true;
  }
  function reroll(game) {
    if (game.status !== 'upgrade' || game.rerolls <= 0) return false;
    game.rerolls--; return offer(game);
  }
  function update(game, dt, input) {
    for (const weapon of game.player.weapons) {
      weapon.cooldown = Math.max(0, weapon.cooldown - dt);
      if (weapon.cooldown <= 0 && fire(game, weapon, input)) weapon.cooldown = profile(game, weapon).delay;
    }
    projectiles(game, dt);
  }
  const api = { profile, target, fire, projectiles, candidates, offer, choose, reroll, update, evolutions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChitinCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
