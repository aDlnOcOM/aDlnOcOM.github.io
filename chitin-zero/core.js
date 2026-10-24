(function (root) {
  'use strict';
  const D = root.ChitinData || require('./data.js');
  const E = root.ChitinEconomy || require('./economy.js');
  const V = root.ChitinView || require('./view.js');
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  function followAngle(from, to, dt, response) { return from + angleDelta(from, to) * (1 - Math.exp(-response * dt)); }
  function poseDirection(angle, previous) {
    const step = TAU / 8;
    if (Number.isInteger(previous) && Math.abs(angleDelta(Math.PI / 2 + previous * step, angle)) <= step / 2 + .07) return previous;
    return Math.round((((angle - Math.PI / 2) % TAU) + TAU) % TAU / step) % 8;
  }
  function random(seed) {
    let s = seed >>> 0;
    return () => { s += 0x6D2B79F5; let n = s; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function hash(x, y) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  }
  function segmentHit(ax, ay, bx, by, cx, cy, radius) {
    const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
    const a = dx * dx + dy * dy, c = fx * fx + fy * fy - radius * radius;
    if (c <= 0) return 0;
    if (a < 1e-9) return null;
    const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }
  class Grid {
    constructor(size = 100) { this.size = size; this.cells = new Map(); }
    build(items) {
      this.cells.clear();
      for (const item of items) {
        if (item.dead) continue;
        const key = `${Math.floor(item.x / this.size)},${Math.floor(item.y / this.size)}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(item);
      }
    }
    near(x, y, radius) {
      const result = [], s = this.size;
      for (let ix = Math.floor((x - radius) / s); ix <= Math.floor((x + radius) / s); ix++) {
        for (let iy = Math.floor((y - radius) / s); iy <= Math.floor((y + radius) / s); iy++) {
          const cell = this.cells.get(`${ix},${iy}`);
          if (cell) result.push(...cell);
        }
      }
      return result;
    }
  }
  class Game {
    constructor({ chassis = 'spectre', core = 'inferno', seed = Date.now(), combat = null, profile = null } = {}) {
      chassis = Object.hasOwn(D.chassis, chassis) ? chassis : 'spectre';
      core = Object.hasOwn(D.cores, core) ? core : 'inferno';
      const frame = D.chassis[chassis];
      this.rng = random(seed); this.seed = seed; this.combat = combat;
      this.status = 'playing'; this.time = 0; this.kills = 0; this.bossKills = 0; this.nests = 0;
      this.bountyTotal = 0; this.bountyPaid = 0; this.bountyKills = {};
      this.id = 0; this.spawnClock = .6; this.bossAt = 120; this.nestAt = 35; this.wave = 1;
      this.player = { x: 0, y: 0, angle: Math.PI / 2, moveAngle: Math.PI / 2, walk: 0, walkTime: 0, moving: false, radius: 19, chassis, hp: frame.hp, maxHp: frame.hp, shield: frame.shield, maxShield: frame.shield,
        speed: frame.speed, dashBase: frame.dash, dashCooldown: 0, dashTime: 0, dashX: 1, dashY: 0, invulnerable: 1.2, hurt: 0, shootTime: 0, sinceHit: 10,
        vx: 0, vy: 0, accelerationX: 0, accelerationY: 0, leanX: 0, leanY: 0, legFacing: Math.PI / 2, torsoFacing: Math.PI / 2, pitch: 0,
        level: 1, xp: 0, xpNext: 14, core, charge: 0, coreTime: 0, distance: 0,
        stats: { damage: 1, rate: 1, speed: 1, magnet: 110, critical: .05, regen: 0, radius: 1, dash: 0, experience: 1, armor: 0, coreGain: 1, coreDuration: 0 },
        weapons: [{ id: frame.weapon, level: 1, cooldown: .2 }], passives: {} };
      E.apply(this.player, E.build(E.normalize(profile || {}), chassis));
      this.enemies = []; this.bullets = []; this.hostile = []; this.drops = []; this.effects = [];
      this.grid = new Grid(); this.events = []; this.offers = []; this.pendingLevels = 0; this.rerolls = 3;
      this.damageDone = 0; this.bestCombo = 0; this.combo = 0; this.comboTime = 0; this.shake = 0;
      this.message('Связь установлена. Пилот, планета принадлежит рою. Пока.');
    }
    message(text) { this.events.push({ text, time: this.time }); if (this.events.length > 6) this.events.shift(); }
    effect(kind, x, y, color, radius = 18, life = .3, text = '') {
      if (this.effects.length >= D.limits.effects) this.effects.shift();
      this.effects.push({ kind, x, y, color, radius, life, maxLife: life, text });
    }
    spawn(type, x, y, elite = false) {
      if (this.enemies.filter(e => !e.dead).length >= D.limits.enemies) return null;
      if (!Object.hasOwn(D.enemies, type)) return null;
      const spec = D.enemies[type];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const angle = this.rng() * TAU, radius = 950 + this.rng() * 140;
        x = this.player.x + Math.cos(angle) * radius; y = this.player.y + Math.sin(angle) * radius;
      }
      const growth = 1 + this.time / 320 + Math.pow(this.wave - 1, 1.6) * .035;
      const hp = spec.hp * growth * (elite ? 2.7 : 1);
      const enemy = { ...spec, id: ++this.id, type, x, y, hp, maxHp: hp, speed: spec.speed * Math.min(1.55, 1 + this.time / 1800),
        damage: spec.damage * (1 + this.time / 700), elite, radius: spec.radius * (elite ? 1.2 : 1),
        xp: spec.xp * (elite ? 4 : 1), angle: 0, timer: 1 + this.rng() * 2, windup: 0, chargeTime: 0, flash: 0, dead: false };
      this.enemies.push(enemy); return enemy;
    }
    drop(kind, x, y, value = 1) {
      const item = { kind, x, y, value, phase: this.rng() * TAU };
      if (this.drops.length >= D.limits.drops) {
        if (kind === 'xp') {
          let nearest = null, best = Infinity;
          for (const d of this.drops) if (d.kind === 'xp' && distance(d, item) < best) { best = distance(d, item); nearest = d; }
          if (nearest) { nearest.value += value; return; }
          this.drops.shift();
          this.drops.push(item); return;
        }
        // Preserve experience when replacing a supply in the bounded pool.
        const index = this.drops.findIndex(d => d.kind !== 'xp');
        if (index >= 0) this.drops.splice(index, 1);
        else { this.drops[1].value += this.drops[0].value; this.drops.splice(0, 1); }
      }
      this.drops.push(item);
    }
    hurtEnemy(enemy, amount, critical = false) {
      if (!enemy || enemy.dead || amount <= 0) return;
      this.damageDone += Math.min(enemy.hp, amount); enemy.hp -= amount; enemy.flash = .09;
      if (critical) this.effect('text', enemy.x, enemy.y - enemy.radius, '#fff3a1', 0, .55, String(Math.round(amount)));
      if (enemy.hp > 0) return;
      enemy.dead = true; this.kills++; this.combo++; this.comboTime = 2.8; this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.bountyTotal += E.reward(enemy);
      this.bountyKills[enemy.type] = (this.bountyKills[enemy.type] || 0) + 1;
      const p = this.player;
      p.charge = Math.min(100, p.charge + (enemy.boss ? 35 : enemy.elite ? 8 : 1.5) * p.stats.coreGain);
      this.drop('xp', enemy.x, enemy.y, enemy.xp);
      this.effect('burst', enemy.x, enemy.y, enemy.color, enemy.radius * 2.3, .42);
      if (enemy.boss) {
        this.bossKills++; this.shake = 12; this.drop('repair', enemy.x + 24, enemy.y, 55); this.drop('magnet', enemy.x - 24, enemy.y);
        this.message('Матка уничтожена. Рой перестраивается — давление продолжит расти.');
      } else if (enemy.type === 'nest') {
        this.nests++; this.drop('repair', enemy.x, enemy.y + 22, 25); this.drop('magnet', enemy.x - 22, enemy.y);
        this.message('Гнездо выжжено. Ремкомплект и магнитный импульс на позиции.');
      } else if (this.rng() < .015) this.drop('repair', enemy.x, enemy.y, 18);
    }
    hurtPlayer(amount) {
      const p = this.player;
      if (this.status !== 'playing' || p.invulnerable > 0 || p.dashTime > 0 || amount <= 0) return false;
      amount *= 1 - clamp(p.stats.armor, 0, .75);
      if (p.core === 'aegis' && p.coreTime > 0) amount *= .2;
      const absorbed = Math.min(p.shield, amount); p.shield -= absorbed; p.hp = Math.max(0, p.hp - (amount - absorbed));
      p.sinceHit = 0; p.invulnerable = .28; p.hurt = .25; this.shake = 6;
      this.effect('ring', p.x, p.y, '#ff5977', 45, .28);
      if (p.hp <= 0) { this.status = 'dead'; this.message('Телеметрия потеряна. Конец операции.'); }
      return true;
    }
    dash(dx, dy) {
      const p = this.player;
      if (this.status !== 'playing' || p.dashCooldown > 0) return false;
      const len = Math.hypot(dx, dy);
      p.dashX = len ? dx / len : Math.cos(p.angle); p.dashY = len ? dy / len : Math.sin(p.angle);
      p.dashTime = .2; p.dashCooldown = p.dashBase * (1 - clamp(p.stats.dash, 0, .8));
      this.effect('ring', p.x, p.y, D.chassis[p.chassis].color, 35, .35); return true;
    }
    activateCore() {
      const p = this.player;
      if (this.status !== 'playing' || p.charge < 100 || p.coreTime > 0) return false;
      p.charge = 0; p.coreTime = D.cores[p.core].duration + ((p.coreLevel || 1) - 1) * 2 + p.stats.coreDuration;
      if (p.core === 'aegis') p.shield = p.maxShield;
      this.effect('ring', p.x, p.y, D.cores[p.core].color, 220, .7); this.shake = 6;
      this.message(`Ядро «${D.cores[p.core].name}» активно.`); return true;
    }
    addXp(value) {
      const p = this.player; p.xp += value * p.stats.experience;
      while (p.xp >= p.xpNext) {
        p.xp -= p.xpNext; p.level++; this.pendingLevels++;
        p.xpNext = Math.floor(14 + p.level * 6 + Math.pow(p.level, 1.6) * 1.6);
      }
    }
    pause() { if (this.status === 'playing') this.status = 'paused'; else if (this.status === 'paused') this.status = 'playing'; }
    updatePlayer(dt, input) {
      const p = this.player;
      for (const key of ['dashCooldown', 'dashTime', 'invulnerable', 'hurt', 'coreTime', 'shootTime']) p[key] = Math.max(0, (p[key] || 0) - dt);
      p.sinceHit += dt;
      if (p.sinceHit > 4) p.shield = Math.min(p.maxShield, p.shield + p.maxShield * .09 * dt);
      p.hp = Math.min(p.maxHp, p.hp + p.stats.regen * dt);
      let dx = clamp(input.x || 0, -1, 1), dy = clamp(input.y || 0, -1, 1), len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      if (input.aim && Number.isFinite(input.angle)) p.angle = input.angle;
      if (Number.isFinite(input.pitch)) p.pitch = clamp(input.pitch, -.85, .70);
      if (input.dash) this.dash(dx, dy);
      if (input.core) this.activateCore();
      const velocity = p.speed * p.stats.speed;
      const oldX = p.vx, oldY = p.vy;
      const response = { spectre: [.065, .045], bastion: [.105, .070], vector: [.080, .055] }[p.chassis];
      const tau = response[len > 0 ? 0 : 1], decay = Math.exp(-dt / tau);
      const tx = dx * velocity, ty = dy * velocity;
      let mx, my;
      if (p.dashTime > 0) {
        // Dash bypasses acceleration. Never feed its 4.3x velocity into coasting.
        p.vx = p.dashX * velocity; p.vy = p.dashY * velocity;
        mx = p.vx * 4.3 * dt; my = p.vy * 4.3 * dt;
      } else {
        p.vx = tx + (oldX - tx) * decay; p.vy = ty + (oldY - ty) * decay;
        // Exact integration of the first-order motor response, independent of FPS.
        mx = tx * dt + (oldX - tx) * tau * (1 - decay);
        my = ty * dt + (oldY - ty) * tau * (1 - decay);
        if (len === 0 && Math.hypot(p.vx, p.vy) < 2) { p.vx = p.vy = 0; mx = my = 0; }
      }
      p.accelerationX = clamp((p.vx - oldX) / Math.max(1, velocity * dt * 12), -1, 1);
      p.accelerationY = clamp((p.vy - oldY) / Math.max(1, velocity * dt * 12), -1, 1);
      p.x += mx; p.y += my; p.distance += Math.hypot(mx, my); p.walk += Math.hypot(mx, my) / 24;
      p.moving = Math.hypot(mx, my) > .001;
      if (p.moving) p.moveAngle = Math.atan2(my, mx);
      // Animation runs at 8 frames/second of walking, never at distance-dependent speed.
      if (p.moving && p.dashTime <= 0) p.walkTime += dt;
      else p.walkTime = 0;
      if (input.aim && Number.isFinite(input.angle)) p.angle = input.angle;
      else if (len > 0) p.angle = Math.atan2(dy, dx);
      if (p.dashTime > 0) this.effect('ghost', p.x, p.y, D.chassis[p.chassis].color, 22, .22);
    }
    updatePresentation(dt) {
      const p = this.player, blend = 1 - Math.exp(-14 * dt);
      p.leanX += (-p.accelerationX - p.leanX) * blend;
      p.leanY += (-p.accelerationY - p.leanY) * blend;
      p.legFacing = followAngle(p.legFacing, p.moveAngle, dt, p.dashTime > 0 ? 40 : 20);
      p.torsoFacing = followAngle(p.torsoFacing, p.angle, dt, 28);
      p.legDirection = poseDirection(p.legFacing, p.legDirection);
      p.torsoDirection = poseDirection(p.torsoFacing, p.torsoDirection);
    }
    updateDirector(dt) {
      const wave = 1 + Math.floor(this.time / 60);
      if (wave !== this.wave) { this.wave = wave; this.message(`Эскалация ${wave.toString().padStart(2, '0')}. Новые сигнатуры роя.`); }
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) {
        this.spawnClock = 1 / Math.min(12, 1.8 + this.time / 28);
        const roll = this.rng();
        const type = this.time > 100 && roll < .15 ? 'charger' : this.time > 55 && roll < .28 ? 'spitter' : this.time > 30 && roll < .4 ? 'brute' : roll < .64 ? 'runner' : 'mite';
        this.spawn(type, undefined, undefined, this.time > 90 && this.rng() < .07);
      }
      if (this.time >= this.bossAt) {
        this.bossAt += 120;
        if (this.enemies.filter(e => e.boss && !e.dead).length < 2) {
          // Reserve a population slot for a boss even under maximum swarm pressure.
          if (this.enemies.length >= D.limits.enemies) this.enemies.splice(this.enemies.findIndex(e => !e.boss), 1);
          this.spawn('queen'); this.message('ВНИМАНИЕ: матка разлома. Уходи из красной зоны перед ударом.');
        }
      }
      if (this.time >= this.nestAt) {
        this.nestAt += 45;
        if (this.enemies.filter(e => e.type === 'nest' && !e.dead).length < 3) {
          this.spawn('nest'); this.message('Обнаружено гнездо. Уничтожь его ради припасов.');
        }
      }
    }
    acid(enemy, angle, speed = 210) {
      if (this.hostile.length >= 140) return;
      const travel = Math.max(.1, distance(enemy, this.player) / speed);
      this.hostile.push({ x: enemy.x, y: enemy.y, z: enemy.radius, vz: (V.EYE - enemy.radius) / travel,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 4.2, damage: enemy.damage, radius: 7 });
    }
    updateEnemies(dt) {
      const p = this.player;
      for (const e of [...this.enemies]) {
        if (e.dead) continue;
        if (e.burnTime > 0) {
          const elapsed = Math.min(dt, e.burnTime); e.burnTime = Math.max(0, e.burnTime - dt);
          this.hurtEnemy(e, e.burnDamage * elapsed);
          if (e.dead) continue;
        }
        const slowFactor = e.slowTime > 0 ? 1 - (e.slow || 0) * (e.boss ? .35 : 1) * Math.min(1, e.slowTime / dt) : 1;
        e.slowTime = Math.max(0, (e.slowTime || 0) - dt);
        e.flash = Math.max(0, e.flash - dt); e.timer -= dt;
        let dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        if (dist > 1700 && !e.boss && e.type !== 'nest') {
          const a = this.rng() * TAU; e.x = p.x + Math.cos(a) * 1000; e.y = p.y + Math.sin(a) * 1000; continue;
        }
        if (dist > 2400 && e.type === 'nest') { e.dead = true; continue; }
        let speed = e.speed * slowFactor, direction = 1;
        if (e.type === 'nest') {
          if (e.timer <= 0 && dist < 1000) { e.timer = 4; this.spawn('mite', e.x + (this.rng() - .5) * 60, e.y + (this.rng() - .5) * 60); }
        } else if (e.type === 'spitter') {
          if (dist < 250) direction = -1; else if (dist < 390) speed = 0;
          if (e.timer <= 0 && dist < 650) { e.timer = 2.4; this.acid(e, e.angle); this.effect('ring', e.x, e.y, e.color, 26, .3); }
        } else if (e.type === 'charger') {
          if (e.chargeTime > 0) {
            e.chargeTime -= dt; e.x += Math.cos(e.chargeAngle) * 540 * slowFactor * dt; e.y += Math.sin(e.chargeAngle) * 540 * slowFactor * dt; speed = 0;
          } else if (e.windup > 0) {
            e.windup -= dt; speed = 0;
            if (e.windup <= 0) e.chargeTime = .55;
          } else if (e.timer <= 0 && dist < 500) { e.windup = .8; e.chargeAngle = e.angle; e.timer = 4.6; }
        } else if (e.boss) {
          if (e.windup > 0) {
            speed = 0; e.windup -= dt;
            if (e.windup <= 0) {
              this.effect('ring', e.strikeX, e.strikeY, '#ff5977', 125, .7);
              if (Math.hypot(p.x - e.strikeX, p.y - e.strikeY) < 125 + p.radius) this.hurtPlayer(e.damage * 1.5);
              for (let i = 0; i < 12; i++) this.acid(e, i * TAU / 12 + e.angle, 180);
              this.shake = 7;
            }
          } else if (e.timer <= 0 && dist < 850) { e.timer = 4.5; e.windup = 1.25; e.strikeX = p.x; e.strikeY = p.y; }
        }
        if (p.core === 'singularity' && p.coreTime > 0 && dist < 330) {
          e.x += dx / dist * (e.boss || e.type === 'nest' ? 0 : 165) * dt;
          e.y += dy / dist * (e.boss || e.type === 'nest' ? 0 : 165) * dt;
          this.hurtEnemy(e, 65 * p.stats.damage * dt);
        }
        if (e.dead) continue;
        e.x += dx / dist * speed * direction * dt; e.y += dy / dist * speed * direction * dt;
        // Local separation keeps a readable front instead of one overlapping swarm.
        if (e.type !== 'nest') for (const other of this.grid.near(e.x, e.y, e.radius + 34)) {
          if (other === e || other.dead) continue;
          const sx = e.x - other.x, sy = e.y - other.y, gap = Math.hypot(sx, sy), minimum = (e.radius + other.radius) * .75;
          if (gap > .01 && gap < minimum) { const force = Math.min(60 * dt, (minimum - gap) * .3); e.x += sx / gap * force; e.y += sy / gap * force; }
        }
        if (distance(e, p) < e.radius + p.radius) this.hurtPlayer(e.damage);
        if (this.status === 'dead') break;
      }
      for (const b of this.hostile) {
        const nextX = b.x + b.vx * dt, nextY = b.y + b.vy * dt, nextZ = (b.z ?? V.EYE) + (b.vz || 0) * dt;
        if (V.sphereHit({ x: b.x, y: b.y, z: b.z ?? V.EYE }, { x: nextX, y: nextY, z: nextZ }, { x: p.x, y: p.y, z: V.EYE }, p.radius + b.radius) !== null) { this.hurtPlayer(b.damage); b.life = 0; }
        b.x = nextX; b.y = nextY; b.z = nextZ; b.life -= dt;
      }
      this.hostile = this.hostile.filter(b => b.life > 0);
    }
    updateDrops(dt) {
      const p = this.player; let magnet = false;
      for (const d of this.drops) {
        const dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy);
        if (dist < p.stats.magnet || d.pulled) {
          d.pulled = true; const step = Math.min(dist, (400 + dist * 2) * dt);
          if (dist > 0) { d.x += dx / dist * step; d.y += dy / dist * step; }
        }
        if (distance(d, p) < 25) {
          if (d.kind === 'xp') this.addXp(d.value);
          else if (d.kind === 'repair') { p.hp = Math.min(p.maxHp, p.hp + d.value); this.effect('text', p.x, p.y - 40, '#5ef5e0', 0, .8, `+${d.value} КОРПУС`); }
          else if (d.kind === 'magnet') magnet = true;
          d.collected = true;
        }
      }
      this.drops = this.drops.filter(d => !d.collected);
      if (magnet) for (const d of this.drops) if (d.kind === 'xp') d.pulled = true;
    }
    step(dt, input = {}) {
      if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .05); this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 25); this.comboTime -= dt;
      if (this.comboTime <= 0) this.combo = 0;
      this.updatePlayer(dt, input); this.updateDirector(dt); this.grid.build(this.enemies);
      this.updateEnemies(dt);
      if (this.status !== 'dead') {
        this.grid.build(this.enemies); this.combat?.update(this, dt, input); this.updatePresentation(dt); this.updateDrops(dt);
        if (this.pendingLevels > 0) this.combat?.offer(this);
      }
      this.enemies = this.enemies.filter(e => !e.dead);
      for (const fx of this.effects) fx.life -= dt;
      this.effects = this.effects.filter(fx => fx.life > 0);
    }
  }
  const api = { Game, Grid, random, hash, clamp, distance, segmentHit, followAngle, poseDirection, TAU };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChitinCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
