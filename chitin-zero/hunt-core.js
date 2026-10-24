(function (root) {
  'use strict';
  const D = root.HuntData || require('./hunt-data.js');
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function random(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = (x, z) => { let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
  class Arena {
    constructor(kind = 'cemetery') {
      this.kind = Object.hasOwn(D.arenas, kind) ? kind : 'cemetery'; this.size = 37; this.cell = 3; this.cells = new Uint8Array(this.size ** 2); this.flow = new Int16Array(this.cells.length); this.center = 55.5;
      for (let z = 0; z < this.size; z++) for (let x = 0; x < this.size; x++) {
        let type = x === 0 || z === 0 || x === 36 || z === 36 ? 3 : 0;
        if (Math.abs(x - 18) > 2 && Math.abs(z - 18) > 2 && x > 3 && x < 33 && z > 3 && z < 33) {
          if (this.kind === 'foundry' && x % 9 < 3 && z % 10 < 4) type = 2;
          else if (this.kind === 'abbey' && (x % 10 === 4 && z % 9 < 6 || z % 10 === 4 && x % 9 < 6)) type = 2;
          else if (this.kind === 'cemetery' && (x % 8 < 2 && z % 9 < 3)) type = 2;
          else if (hash(x, z) < .055) type = 1;
        }
        this.cells[z * this.size + x] = type;
      }
      this.buildFlow(this.center, this.center);
    }
    at(x, z) { const ix = Math.floor(x / this.cell), iz = Math.floor(z / this.cell); return ix < 0 || iz < 0 || ix >= this.size || iz >= this.size ? 3 : this.cells[iz * this.size + ix]; }
    height(type) { return [0, 1.1, 3.8, 8][type] || 0; }
    blocked(x, z, radius = .3, foot = 0) {
      for (let ix = Math.floor((x - radius) / 3); ix <= Math.floor((x + radius) / 3); ix++) for (let iz = Math.floor((z - radius) / 3); iz <= Math.floor((z + radius) / 3); iz++) {
        const h = this.height(this.at(ix * 3 + 1, iz * 3 + 1)); if (h <= foot + .04) continue;
        const qx = clamp(x, ix * 3, ix * 3 + 3), qz = clamp(z, iz * 3, iz * 3 + 3);
        if (Math.hypot(x - qx, z - qz) < radius) return true;
      }
      return false;
    }
    move(body, dx, dz) {
      const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
      for (let i = 0; i < count; i++) {
        if (!this.blocked(body.x + dx / count, body.z, body.radius, body.y || 0)) body.x += dx / count;
        if (!this.blocked(body.x, body.z + dz / count, body.radius, body.y || 0)) body.z += dz / count;
      }
    }
    trace(a, b) {
      const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / .18));
      for (let i = 0; i <= count; i++) {
        const t = i / count, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        if (y <= 0 || this.height(this.at(x, z)) > y) return { x, y: Math.max(.02, y), z, t };
      }
      return null;
    }
    buildFlow(x, z) {
      this.flow.fill(-1); const start = Math.floor(z / 3) * this.size + Math.floor(x / 3), queue = new Int16Array(this.cells.length); let head = 0, tail = 0;
      if (start < 0 || start >= this.cells.length) return;
      this.flow[start] = 0; queue[tail++] = start;
      while (head < tail) { const i = queue[head++]; for (const n of [i - 1, i + 1, i - this.size, i + this.size]) {
        if (n < 0 || n >= this.cells.length || this.flow[n] >= 0 || this.cells[n] || Math.abs(n % this.size - i % this.size) > 1) continue;
        this.flow[n] = this.flow[i] + 1; queue[tail++] = n;
      } }
    }
    direction(e, player) {
      if (!this.trace({ x: e.x, z: e.z, y: .6 }, { x: player.x, z: player.z, y: .6 })) return { x: player.x - e.x, z: player.z - e.z };
      const i = Math.floor(e.z / 3) * this.size + Math.floor(e.x / 3); let best = i, score = this.flow[i] < 0 ? Infinity : this.flow[i];
      for (const n of [i - 1, i + 1, i - this.size, i + this.size]) if (n >= 0 && n < this.flow.length && this.flow[n] >= 0 && this.flow[n] < score) { best = n; score = this.flow[n]; }
      return { x: (best % this.size + .5) * 3 - e.x, z: (Math.floor(best / this.size) + .5) * 3 - e.z };
    }
  }
  function bodyHit(a, b, e, radius = .08) {
    const dx = b.x - a.x, dz = b.z - a.z, fx = a.x - e.x, fz = a.z - e.z, r = e.radius + radius;
    const aa = dx * dx + dz * dz, bb = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - r * r;
    let lo = 0, hi = 1;
    if (aa < 1e-10) { if (cc > 0) return null; }
    else { const disc = bb * bb - 4 * aa * cc; if (disc < 0) return null; lo = Math.max(lo, (-bb - Math.sqrt(disc)) / (2 * aa)); hi = Math.min(hi, (-bb + Math.sqrt(disc)) / (2 * aa)); }
    const dy = b.y - a.y, low = (e.y || 0) - radius, high = (e.y || 0) + e.height + radius;
    if (Math.abs(dy) < 1e-10) { if (a.y < low || a.y > high) return null; }
    else { const u = (low - a.y) / dy, v = (high - a.y) / dy; lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); }
    return lo <= hi && lo >= 0 && lo <= 1 ? lo : null;
  }
  function weaponStats(p, w) {
    const s = D.weapons[w.id], evolved = w.level >= 6;
    return { ...s, damage: s.damage * (1 + (w.level - 1) * .25) * p.damage, delay: s.delay * Math.pow(.93, w.level - 1) / p.rate / (p.rage > 0 ? 2 : 1),
      range: s.range * p.range, splash: (s.splash || 0) * p.range * (evolved ? 1.5 : 1), pellets: s.pellets + (evolved && !s.aura ? 2 : 0), pierce: s.pierce + (evolved ? 3 : 0) };
  }
  class Game {
    constructor({ hunter = 'mara', arena = 'cemetery', endless = true, seed = Date.now(), meta = {} } = {}) {
      hunter = Object.hasOwn(D.hunters, hunter) ? hunter : 'mara'; const h = D.hunters[hunter];
      this.rng = random(seed); this.map = new Arena(arena); this.hunter = hunter; this.endless = endless; this.status = 'playing'; this.time = 0; this.kills = 0; this.coins = 0; this.id = 0;
      this.player = { x: this.map.center, z: this.map.center, y: 0, vy: 0, radius: .32, height: 1.75, yaw: 0, pitch: -.02, hp: h.hp + (meta.vitality || 0) * 8, maxHp: h.hp + (meta.vitality || 0) * 8,
        speed: h.speed, damage: 1 + (meta.power || 0) * .04, rate: 1, range: 1, armor: h.armor, critical: .05, regen: 0, magnet: 2.6, experience: 1 + (meta.wisdom || 0) * .04,
        fortune: 1 + (meta.fortune || 0) * .05, xp: 0, level: 1, nextXp: 8, charge: 0, rage: 0, invulnerable: 1, dash: 0, dashCooldown: 0, hurt: 0, walk: 0, vx: 0, vz: 0,
        weapons: [{ id: h.weapon, level: 1, cooldown: .1, flash: 0 }], passives: {} };
      this.enemies = []; this.bullets = []; this.hostile = []; this.drops = []; this.effects = []; this.chests = []; this.pendingLevels = 0; this.offers = []; this.rerolls = 4; this.shots = 0;
      this.spawnClock = .5; this.flowClock = 0; this.bossAt = 180; this.chestAt = 45; this.finalSpawned = false; this.message = 'Двигайся. Наводи прицел. Собирай души.';
    }
    effect(x, y, z, color, size = .5, life = .3) { if (this.effects.length >= D.LIMITS.effects) this.effects.shift(); this.effects.push({ x, y, z, color, size, life, max: life }); }
    spawn(type, x, z) {
      if (!Object.hasOwn(D.enemies, type) || this.enemies.length >= D.LIMITS.enemies) return null;
      const s = D.enemies[type];
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        let found = false;
        for (let i = 0; i < 100; i++) { const a = this.rng() * TAU, r = 23 + this.rng() * 14; x = this.player.x + Math.sin(a) * r; z = this.player.z - Math.cos(a) * r;
          const ix = Math.floor(x / 3), iz = Math.floor(z / 3); if (!this.map.blocked(x, z, s.radius) && this.map.flow[iz * this.map.size + ix] >= 0) { found = true; break; } }
        if (!found) return null;
      }
      if (this.map.blocked(x, z, s.radius)) return null;
      const hp = s.hp * (1 + this.time / 500);
      const e = { ...s, type, id: ++this.id, x, z, y: s.flying ? 1.4 : 0, hp, maxHp: hp, yaw: 0, age: this.rng() * 8, flash: 0, attack: 0, windup: 0, burn: 0, slow: 0, timer: 1 + this.rng() * 2 };
      this.enemies.push(e); return e;
    }
    hurt(e, damage) {
      if (!e || e.dead) return;
      e.hp -= damage; e.flash = .09;
      if (e.hp > 0) return;
      e.dead = true; this.kills++; this.coins += e.boss ? 35 : 1; this.player.charge = Math.min(100, this.player.charge + (e.boss ? 30 : 3));
      if (this.drops.length >= D.LIMITS.drops) this.drops[0].value += e.xp; else this.drops.push({ x: e.x, z: e.z, y: .25, value: e.xp });
      this.effect(e.x, e.y + e.height * .5, e.z, '#d85365', e.radius * 1.5, .4);
      if (e.boss) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25); this.message = 'Хранитель пал. Охота продолжается.'; }
      if (e.final) { this.status = 'won'; this.message = 'Рассвет. Испытание пройдено.'; }
    }
    hurtPlayer(damage) {
      const p = this.player; if (this.status !== 'playing' || p.invulnerable > 0 || p.dash > 0) return;
      p.hp = Math.max(0, p.hp - damage * (1 - Math.min(.65, p.armor))); p.hurt = .3; p.invulnerable = .4;
      if (p.hp <= 0) this.status = 'dead';
    }
    area(x, y, z, radius, damage, skip, status) {
      for (const e of this.enemies) if (!e.dead && e !== skip && Math.hypot(e.x - x, e.z - z, e.y + e.height * .5 - y) < radius + e.radius && !this.map.trace({ x, y, z }, { x: e.x, y: e.y + e.height * .5, z: e.z })) {
        this.hurt(e, damage); if (status === 'frost') e.slow = 3;
      }
    }
    ability() {
      const p = this.player; if (this.status !== 'playing' || p.charge < 100) return false; p.charge = 0;
      if (this.hunter === 'grimm') p.rage = 8;
      else { const nearby = this.enemies.filter(e => !e.dead && distance(p, e) < 12 && !this.map.trace({ x: p.x, y: 1, z: p.z }, { x: e.x, y: e.y + e.height / 2, z: e.z })); this.area(p.x, 1, p.z, 12, 70 * p.damage, null, this.hunter === 'elias' ? 'frost' : null);
        if (this.hunter === 'mara') p.hp = Math.min(p.maxHp, p.hp + nearby.length * 3); }
      this.effect(p.x, 1, p.z, this.hunter === 'elias' ? '#99dfff' : '#edaf66', 8, .7); return true;
    }
    addXp(amount) { const p = this.player; p.xp += amount * p.experience; while (p.xp >= p.nextXp) { p.xp -= p.nextXp; p.level++; this.pendingLevels++; p.nextXp = Math.floor(8 + p.level * 4 + p.level ** 1.35); } }
    candidates() {
      const p = this.player, list = [];
      for (const [id, s] of Object.entries(D.weapons)) {
        const w = p.weapons.find(w => w.id === id);
        if (!w && p.weapons.length < D.MAX_WEAPONS || w && w.level < 5) list.push({ type: 'weapon', id, level: (w?.level || 0) + 1, title: s.name, text: `${s.kind} · ${w ? '+25% базового урона, быстрее огонь' : 'Новое оружие на экране'}`, rarity: w ? 'УСИЛЕНИЕ' : 'НОВОЕ ОРУЖИЕ' });
        else if (w?.level === 5 && (p.passives[s.passive] || 0) >= 2) list.push({ type: 'weapon', id, level: 6, title: s.evolution, text: 'Эволюция VI: +2 снаряда, +3 пробития, +50% взрыва.', rarity: 'ЭВОЛЮЦИЯ' });
      }
      for (const [id, s] of Object.entries(D.passives)) if ((p.passives[id] || 0) < s.max) list.push({ type: 'passive', id, level: (p.passives[id] || 0) + 1, title: s.name, text: s.text, rarity: 'РЕЛИКВИЯ' });
      list.push({ type: 'heal', title: 'Глоток жизни', text: 'Восстановить 40% здоровья.', rarity: 'ПРИПАСЫ' });
      if (list.length === 1) list.push({ type: 'power', title: 'За пределом смерти', text: '+5% урона. Без ограничения рангов.', rarity: 'БЕСКОНЕЧНОСТЬ' });
      return list;
    }
    offer() { const list = this.candidates(); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } this.offers = list.slice(0, 4); this.status = 'upgrade'; }
    choose(i) {
      if (this.status !== 'upgrade' || !Number.isInteger(i) || !this.offers[i]) return false;
      const c = this.offers[i], p = this.player;
      if (c.type === 'weapon') { const w = p.weapons.find(w => w.id === c.id); if (w) w.level = c.level; else if (p.weapons.length < D.MAX_WEAPONS) p.weapons.push({ id: c.id, level: 1, cooldown: .1, flash: 0 }); else return false; }
      else if (c.type === 'passive') { const s = D.passives[c.id]; p.passives[c.id] = c.level; if (c.id === 'health') { p.maxHp += s.value; p.hp = Math.min(p.maxHp, p.hp + s.value); } else if (c.id === 'speed') p.speed += D.hunters[this.hunter].speed * s.value; else p[c.id] += s.value; }
      else if (c.type === 'heal') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .4); else p.damage += .05;
      this.pendingLevels--; this.offers = []; this.status = 'playing'; if (this.pendingLevels) this.offer(); return true;
    }
    fire(w) {
      const p = this.player, s = weaponStats(p, w), origin = { x: p.x, y: p.y + 1.6, z: p.z };
      if (s.aura) { this.area(p.x, 1, p.z, s.range, s.damage); this.effect(p.x, .4, p.z, s.color, s.range, .4); }
      else for (let i = 0; i < s.pellets && this.bullets.length < D.LIMITS.bullets; i++) {
        const yaw = p.yaw + (this.rng() - .5) * s.spread, pitch = p.pitch + (this.rng() - .5) * s.spread * .6;
        this.bullets.push({ ...origin, vx: Math.sin(yaw) * Math.cos(pitch) * s.speed, vy: Math.sin(pitch) * s.speed, vz: -Math.cos(yaw) * Math.cos(pitch) * s.speed,
          ...s, life: s.range / s.speed, damage: s.damage * (this.rng() < p.critical ? 2 : 1), hit: new Set(), weapon: w.id });
      }
      w.flash = .18; w.cooldown = s.delay; this.shots++;
    }
    projectiles(dt) {
      for (const b of this.bullets) {
        if (b.homing) {
          const target = this.enemies.filter(e => !e.dead && distance(e, b) < 20 && !this.map.trace(b, { x: e.x, y: e.y + e.height / 2, z: e.z })).sort((a, c) => distance(a, b) - distance(c, b))[0];
          if (target) { const dx = target.x - b.x, dy = target.y + target.height / 2 - b.y, dz = target.z - b.z, len = Math.hypot(dx, dy, dz) || 1, f = Math.min(1, dt * 3);
            b.vx += (dx / len * b.speed - b.vx) * f; b.vy += (dy / len * b.speed - b.vy) * f; b.vz += (dz / len * b.speed - b.vz) * f; }
        }
        b.vy -= (b.gravity || 0) * dt; const elapsed = Math.min(dt, b.life), next = { x: b.x + b.vx * elapsed, y: b.y + b.vy * elapsed, z: b.z + b.vz * elapsed }, wall = this.map.trace(b, next), hits = [];
        for (const e of this.enemies) if (!e.dead && !b.hit.has(e.id)) { const t = bodyHit(b, next, e, b.weapon === 'saw' ? .25 : .09); if (t !== null && t < (wall?.t ?? 2)) hits.push({ e, t }); }
        hits.sort((a, c) => a.t - c.t);
        for (const { e, t } of hits) {
          if (e.dead) continue; const x = b.x + (next.x - b.x) * t, y = b.y + (next.y - b.y) * t, z = b.z + (next.z - b.z) * t;
          this.hurt(e, b.damage); b.hit.add(e.id); b.pierce--; e.burn = b.burn ? 2 : e.burn; e.burnDamage = Math.max(e.burnDamage || 0, b.burn || 0); if (b.slow) e.slow = 3;
          if (b.splash) this.area(x, y, z, b.splash, b.damage * .65, e, b.weapon);
          if (b.chain) { const near = this.enemies.filter(o => o !== e && !o.dead && distance(o, e) < 4 && !this.map.trace({ x: e.x, y, z: e.z }, { x: o.x, y, z: o.z })).slice(0, b.chain); for (const o of near) { this.hurt(o, b.damage * .6); this.effect(o.x, o.y + 1, o.z, b.color, .7, .2); } }
          this.effect(x, y, z, b.color, b.splash || .35, .25);
          if (b.pierce <= 0) { b.life = 0; break; }
        }
        if (wall && b.life > 0) { if (b.splash) this.area(wall.x, wall.y + .1, wall.z, b.splash, b.damage * .65, null, b.weapon); this.effect(wall.x, wall.y, wall.z, b.color, b.splash || .2, .25); b.life = 0; }
        Object.assign(b, next); b.life -= elapsed;
      }
      this.bullets = this.bullets.filter(b => b.life > 0);
    }
    step(dt, input = {}) {
      if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return; dt = Math.min(.05, dt); this.time += dt; const p = this.player;
      for (const key of ['invulnerable', 'dash', 'dashCooldown', 'hurt', 'rage']) p[key] = Math.max(0, p[key] - dt);
      if (Number.isFinite(input.yaw)) p.yaw = Math.atan2(Math.sin(input.yaw), Math.cos(input.yaw)); if (Number.isFinite(input.pitch)) p.pitch = clamp(input.pitch, -1.1, 1.1);
      let forward = clamp(input.forward || 0, -1, 1), side = clamp(input.side || 0, -1, 1), len = Math.max(1, Math.hypot(forward, side)); forward /= len; side /= len;
      const dx = Math.sin(p.yaw) * forward + Math.cos(p.yaw) * side, dz = -Math.cos(p.yaw) * forward + Math.sin(p.yaw) * side;
      if (input.jump && p.y <= .001) p.vy = 5.5;
      p.vy -= 15 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (!p.y) p.vy = 0;
      if (input.dash && p.dashCooldown <= 0) { p.dash = .18; p.dashCooldown = 2.7; p.dashX = dx || dz ? dx : Math.sin(p.yaw); p.dashZ = dx || dz ? dz : -Math.cos(p.yaw); }
      const blend = 1 - Math.exp(-18 * dt), speed = p.speed;
      p.vx += (dx * speed - p.vx) * blend; p.vz += (dz * speed - p.vz) * blend;
      const ox = p.x, oz = p.z; this.map.move(p, (p.dash > 0 ? p.dashX * speed * 3.3 : p.vx) * dt, (p.dash > 0 ? p.dashZ * speed * 3.3 : p.vz) * dt); p.walk += Math.hypot(p.x - ox, p.z - oz);
      p.hp = Math.min(p.maxHp, p.hp + p.regen * dt); if (input.ability) this.ability();
      this.flowClock -= dt; if (this.flowClock <= 0) { this.flowClock = .5; this.map.buildFlow(p.x, p.z); }
      this.spawnClock -= dt; if (this.spawnClock <= 0) { this.spawnClock = 1 / Math.min(8, 1.5 + this.time / 38); const types = this.time < 25 ? ['ghoul', 'skeleton'] : this.time < 65 ? ['ghoul', 'skeleton', 'bat'] : ['ghoul', 'skeleton', 'bat', 'cultist', 'brute', 'vampire']; this.spawn(types[Math.floor(this.rng() * types.length)]); }
      if (this.time >= this.bossAt || !this.endless && this.time >= D.TRIAL && !this.finalSpawned) {
        if (this.enemies.length >= D.LIMITS.enemies) this.enemies.splice(this.enemies.findIndex(e => !e.boss), 1);
        const e = this.spawn('boss'); if (e) { this.bossAt = this.time + 180; this.message = 'ХРАНИТЕЛЬ ПРИБЛИЖАЕТСЯ'; if (!this.endless && this.time >= D.TRIAL) { e.final = true; this.finalSpawned = true; } }
      }
      if (this.time >= this.chestAt) { this.chestAt += 55; for (let i = 0; i < 30 && this.chests.length < 5; i++) { const a = this.rng() * TAU, x = p.x + Math.cos(a) * 9, z = p.z + Math.sin(a) * 9; if (!this.map.blocked(x, z, .5)) { this.chests.push({ x, z, y: 0 }); break; } } }
      for (const e of this.enemies) {
        if (e.dead) continue; e.age += dt; e.flash = Math.max(0, e.flash - dt); e.attack = Math.max(0, e.attack - dt); e.timer -= dt; e.slow = Math.max(0, e.slow - dt);
        if (e.burn > 0) { this.hurt(e, (e.burnDamage || 13) * Math.min(dt, e.burn)); e.burn -= dt; if (e.dead) continue; }
        const dist = distance(e, p), dir = this.map.direction(e, p), length = Math.hypot(dir.x, dir.z) || 1; e.yaw = Math.atan2(dir.x, -dir.z);
        if (e.flying) e.y = 1.35 + Math.sin(e.age * 4) * .25;
        let speed = e.speed * Math.min(1.5, 1 + this.time / 1200) * (e.slow > 0 ? e.boss ? .8 : .45 : 1);
        if (e.ranged && dist < 13 && !this.map.trace({ x: e.x, y: 1.4, z: e.z }, { x: p.x, y: p.y + 1.4, z: p.z })) {
          speed = dist < 6 ? -speed : 0;
          if (e.timer <= 0 && this.hostile.length < 100) { e.timer = 2.5; const dy = p.y + 1.2 - (e.y + 1.4), dl = Math.hypot(p.x - e.x, p.z - e.z, dy); this.hostile.push({ x: e.x, y: e.y + 1.4, z: e.z, vx: (p.x - e.x) / dl * 8, vy: dy / dl * 8, vz: (p.z - e.z) / dl * 8, life: 5, damage: e.damage }); }
        }
        if (e.boss) {
          if (e.windup > 0) { speed = 0; e.windup -= dt; if (e.windup <= 0) { if (Math.hypot(p.x - e.strikeX, p.z - e.strikeZ) < 3.4 && p.y < 1) this.hurtPlayer(e.damage * 1.5); this.effect(e.strikeX, .1, e.strikeZ, '#ff5b5b', 3.4, .6); } }
          else if (e.timer <= 0 && dist < 22) { e.timer = 5; e.windup = 1.2; e.strikeX = p.x; e.strikeZ = p.z; }
        }
        if (dist > e.radius + p.radius) this.map.move(e, dir.x / length * speed * dt, dir.z / length * speed * dt);
        if (dist < e.radius + p.radius + .2 && p.y < e.y + e.height && p.y + p.height > e.y && e.attack <= 0) { this.hurtPlayer(e.damage); e.attack = .8; }
      }
      // Local separation prevents the horde collapsing into one overlapping model.
      const buckets = new Map();
      for (const e of this.enemies) if (!e.dead) { const key = `${Math.floor(e.x / 3)},${Math.floor(e.z / 3)}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(e); }
      for (const e of this.enemies) if (!e.dead) {
        let pushX = 0, pushZ = 0; const bx = Math.floor(e.x / 3), bz = Math.floor(e.z / 3);
        for (let x = bx - 1; x <= bx + 1; x++) for (let z = bz - 1; z <= bz + 1; z++) for (const other of buckets.get(`${x},${z}`) || []) {
          if (e === other || !!e.flying !== !!other.flying) continue;
          const dx = e.x - other.x, dz = e.z - other.z, dist = Math.hypot(dx, dz), radius = (e.radius + other.radius) * .85;
          if (dist < radius) { const force = (radius - dist) * 2.5; pushX += (dist > .001 ? dx / dist : e.id < other.id ? -1 : 1) * force; pushZ += (dist > .001 ? dz / dist : 0) * force; }
        }
        const length = Math.max(1, Math.hypot(pushX, pushZ) / 2); this.map.move(e, pushX / length * dt, pushZ / length * dt);
      }
      for (const b of this.hostile) { const next = { x: b.x + b.vx * dt, y: b.y + b.vy * dt, z: b.z + b.vz * dt }, wall = this.map.trace(b, next), hit = bodyHit(b, next, p, .16); if (hit !== null && hit < (wall?.t ?? 2)) { this.hurtPlayer(b.damage); b.life = 0; } if (wall) b.life = 0; Object.assign(b, next); b.life -= dt; }
      this.hostile = this.hostile.filter(b => b.life > 0);
      if (this.status === 'playing') {
        for (const w of p.weapons) { w.flash = Math.max(0, w.flash - dt); w.cooldown -= dt; if (w.cooldown <= 0 && input.fire !== false) this.fire(w); }
        this.projectiles(dt);
      }
      for (const d of this.drops) { const dist = distance(d, p); if (dist < p.magnet && !this.map.trace({ ...d, y: .4 }, { x: p.x, y: .4, z: p.z })) { const step = Math.min(dist, (5 + dist * 3) * dt); if (dist > 0) { d.x += (p.x - d.x) / dist * step; d.z += (p.z - d.z) / dist * step; } } if (distance(d, p) < .65) { this.addXp(d.value); d.dead = true; } }
      for (const chest of this.chests) if (input.interact && distance(chest, p) < 2.4 && !this.map.trace({ x: p.x, y: 1, z: p.z }, { x: chest.x, y: 1, z: chest.z })) { chest.dead = true; this.addXp(30 + p.level * 3); p.hp = Math.min(p.maxHp, p.hp + 20); this.coins += 12; this.message = 'Реликварий: души, лечение и 12 монет.'; }
      this.chests = this.chests.filter(c => !c.dead); this.drops = this.drops.filter(d => !d.dead); this.enemies = this.enemies.filter(e => !e.dead);
      for (const e of this.effects) e.life -= dt; this.effects = this.effects.filter(e => e.life > 0);
      if (this.pendingLevels && this.status === 'playing') this.offer();
    }
  }
  const api = { Game, Arena, weaponStats, bodyHit, random, hash, distance, clamp, TAU }; root.HuntCore = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
