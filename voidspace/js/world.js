(function () {
  "use strict";
  const VS = window.Voidspace;
  const { Utils, Content, ModuleSystem, Ship, Station } = VS;
  const { MODULES, MODULE_SIZE } = ModuleSystem;
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function rayCircle(origin, direction, length, object) {
    const dx = object.x - origin.x, dy = object.y - origin.y;
    const along = dx * direction.x + dy * direction.y;
    const perpendicular = dx * dx + dy * dy - along * along;
    const radius = object.radius || 15;
    if (perpendicular > radius * radius || along + radius < 0) return null;
    const hit = Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - perpendicular)));
    return hit <= length ? hit : null;
  }
  function rayModules(ship, origin, direction, length) {
    const local = ship.worldToLocal(origin.x, origin.y);
    const cosine = Math.cos(ship.angle), sine = Math.sin(ship.angle);
    const vector = { x: direction.x * cosine + direction.y * sine, y: -direction.x * sine + direction.y * cosine };
    let nearest = null;
    for (const module of ship.modules) {
      let entry = 0, exit = length;
      for (const [axis, centre] of [["x", module.gx * MODULE_SIZE], ["y", module.gy * MODULE_SIZE]]) {
        if (Math.abs(vector[axis]) < 1e-8) {
          if (local[axis] < centre - 15 || local[axis] > centre + 15) { exit = -1; break; }
        } else {
          const a = (centre - 15 - local[axis]) / vector[axis];
          const b = (centre + 15 - local[axis]) / vector[axis];
          entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        }
      }
      if (entry <= exit && (!nearest || entry < nearest.distance)) nearest = { module, distance: entry };
    }
    return nearest;
  }
  class Enemy {
    constructor(blueprint, x, y, difficulty = 1, stationId = null) {
      this.blueprint = blueprint;
      this.ship = new Ship({ x, y, modules: copy(blueprint.modules), inertiaDampingEnabled: false });
      this.ship.x = x; this.ship.y = y;
      this.ship.angle = Math.atan2(-y, -x);
      this.scale = 1 + Math.min(7, difficulty - 1) * 0.12;
      this.ship.modules.forEach((m) => { m.combatHp = MODULES[m.type].hp * this.scale; });
      this.cooldowns = new Map();
      this.dead = false; this.flash = 0; this.contactCooldown = 0;
      this.stationId = stationId;
      this.maxHp = this.ship.modules.reduce((sum, m) => sum + m.combatHp, 0);
    }
    damage(module, amount, world) {
      if (this.dead || !this.ship.modules.includes(module)) return;
      module.combatHp -= amount; this.flash = 0.12;
      if (module.combatHp > 0) return;
      const point = this.ship.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
      world.explode(point.x, point.y, "#ff986c", 12);
      this.ship.modules = this.ship.modules.filter((m) => m !== module);
      if (module.type === "core") { this.destroy(world); return; }
      // Destroying a bridge detaches the modules it supported, including weapons.
      const connected = new Set();
      const queue = this.ship.modules.filter((m) => m.type === "core");
      while (queue.length) {
        const current = queue.pop();
        if (connected.has(current)) continue;
        connected.add(current);
        queue.push(...this.ship.modules.filter((m) => !connected.has(m) && Math.abs(m.gx - current.gx) + Math.abs(m.gy - current.gy) === 1));
      }
      this.ship.modules = this.ship.modules.filter((m) => connected.has(m));
      this.ship.stats = ModuleSystem.calculateStats(this.ship.modules);
    }
    destroy(world) {
      if (this.dead) return;
      this.dead = true;
      const reward = Math.round(this.blueprint.reward * this.scale);
      world.game.ship.credits += reward; world.kills++;
      if (this.stationId) world.defeated.add(this.stationId);
      world.explode(this.ship.x, this.ship.y, "#ffad76", 30);
      world.game.notify(`${this.blueprint.name}: +${reward} ¤`);
    }
    update(dt, world) {
      this.flash = Math.max(0, this.flash - dt);
      this.contactCooldown = Math.max(0, this.contactCooldown - dt);
      const target = world.game.ship;
      const distance = Utils.distance(this.ship, target);
      const protectedTarget = world.safeAt(target);
      let aim = Math.atan2(target.y - this.ship.y, target.x - this.ship.x);
      const controls = new Set();
      if (!this.stationId) {
        if (protectedTarget) aim += Math.PI;
        for (const rock of world.game.asteroids) {
          const gap = Utils.distance(rock, this.ship);
          if (gap < rock.radius + 120 && Math.abs(Utils.angleDelta(aim, Math.atan2(rock.y - this.ship.y, rock.x - this.ship.x))) < 0.6) { aim += 0.9; break; }
        }
        const delta = Utils.angleDelta(this.ship.angle, aim);
        if (Math.abs(delta) > 0.08) controls.add(delta > 0 ? "KeyD" : "KeyA");
        const preferredRange = this.blueprint.behaviour === "artillery" ? 470 : 230;
        if (Math.abs(delta) < 0.5 && (distance > preferredRange || protectedTarget)) controls.add("KeyW");
        else if (distance < preferredRange * 0.7) controls.add("KeyS");
        this.ship.update(dt, controls, target);
        // Patrols never enter a friendly safety field.
        for (const station of world.friendlyStations()) {
          const d = Utils.distance(this.ship, station);
          if (d < station.safeRadius + 90) {
            const a = Math.atan2(this.ship.y - station.y, this.ship.x - station.x);
            this.ship.x = station.x + Math.cos(a) * (station.safeRadius + 90);
            this.ship.y = station.y + Math.sin(a) * (station.safeRadius + 90);
            this.ship.vx *= 0.5; this.ship.vy *= 0.5;
          }
        }
      } else this.ship.aimWorld = { x: target.x, y: target.y };
      if (!protectedTarget && distance < 950) world.fireWeapons(this.ship, target, this.cooldowns, "enemy", dt, this.scale);
      else world.tickCooldowns(this.cooldowns, dt);
      if (distance < 250 && !protectedTarget && this.contactCooldown <= 0) {
        for (const module of this.ship.modules) {
          const center = this.ship.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
          const contact = target.getCircleCollision(center.x, center.y, 14);
          if (!contact) continue;
          target.x += contact.normalX * contact.penetration;
          target.y += contact.normalY * contact.penetration;
          target.vx += contact.normalX * 14; target.vy += contact.normalY * 14;
          target.takeDamage(10); this.damage(module, 12, world);
          this.contactCooldown = 0.6; break;
        }
      }
    }
  }
  class Expedition {
    constructor(game, save = {}) {
      this.game = game;
      this.seed = Math.max(1, Math.floor(finite(save.seed, Math.random() * 100000)));
      this.kills = Math.max(0, finite(save.kills));
      this.contracts = Math.max(0, finite(save.contracts));
      this.farthest = Math.max(0, finite(save.farthest));
      this.licenses = new Set(["miner", ...(Array.isArray(save.licenses) ? save.licenses.filter((id) => Object.hasOwn(Content.CLASSES, id)) : [])]);
      this.hangar = {};
      for (const id of Object.keys(Content.CLASSES)) if (save.hangar && Object.hasOwn(save.hangar, id) && save.hangar[id]?.modules) this.hangar[id] = new Ship(save.hangar[id]).serialize();
      this.defeated = new Set(Array.isArray(save.defeated) ? save.defeated.filter((id) => typeof id === "string") : []);
      this.enemies = []; this.bullets = []; this.effects = []; this.cooldowns = new Map();
      this.spawnTimer = 8;
      this.reloadTemplates();
      this.stations = [];
      for (let i = 0; i < 5; i++) {
        const hostile = i % 2 === 1;
        const radius = [2100, 3300, 4200, 5700, 6500][i];
        const angle = this.seed * 0.17 + i * 2.4;
        const station = new Station();
        station.x = Math.round(Math.cos(angle) * radius); station.y = Math.round(Math.sin(angle) * radius);
        station.id = `station-${i}`; station.hostile = hostile;
        station.name = hostile ? `Форпост ${i + 1}` : `Перевалочная ${i + 1}`;
        this.stations.push(station);
      }
      this.contract = save.contract && ["mine", "hunt", "travel"].includes(save.contract.kind) && Number.isFinite(save.contract.target) && Number.isFinite(save.contract.start)
        ? { kind: save.contract.kind, target: Math.max(1, Math.min(20000, save.contract.target)), start: Math.max(0, save.contract.start), reward: Math.max(50, Math.min(1000, finite(save.contract.reward, 100))) }
        : this.nextContract();
      for (const [type, definition] of Object.entries(MODULES)) if (definition.shipClass && this.licenses.has(definition.shipClass)) game.ship.unlocked.add(type);
    }
    friendlyStations() { return [this.game.station, ...this.stations.filter((s) => !s.hostile)]; }
    reloadTemplates() {
      let custom = [];
      try { custom = Content.customEnemies(window.localStorage); } catch { /* Storage may be blocked. */ }
      this.templates = [...Content.ENEMIES, ...(Content.PACKAGED_ENEMIES || []), ...custom];
    }
    safeAt(point) { return this.friendlyStations().some((station) => station.isSafe(point)); }
    dockAt(point) { return this.friendlyStations().find((station) => station.isDocked(point)); }
    biome(point = this.game.ship) { return Content.biomeAt(point.x, point.y, this.seed); }
    difficulty() { return Math.min(8, 1 + this.biome().danger + Math.floor(this.kills / 12) + Math.floor(this.contracts / 4)); }
    nextContract() {
      const kind = ["mine", "travel", "hunt"][(this.contracts + this.seed % 3) % 3];
      const count = kind === "mine" ? 5 + this.contracts * 2 : kind === "hunt" ? 2 + Math.floor(this.contracts / 3) : Math.min(10000, 1700 + this.contracts * 500);
      return { kind, target: count, start: kind === "mine" ? this.game.asteroidsMined : kind === "hunt" ? this.kills : 0, reward: 140 + Math.min(600, this.contracts * 45) };
    }
    contractProgress() {
      const current = this.contract.kind === "mine" ? this.game.asteroidsMined : this.contract.kind === "hunt" ? this.kills : this.farthest;
      return Math.max(0, Math.min(this.contract.target, current - this.contract.start));
    }
    contractText() {
      const verbs = { mine: "Разобрать астероиды", hunt: "Уничтожить противников", travel: "Удалиться от базы, м" };
      return `${verbs[this.contract.kind]}: ${Math.floor(this.contractProgress())}/${this.contract.target} · ${this.contract.reward} ¤`;
    }
    claimContract() {
      if (!this.dockAt(this.game.ship) || this.contractProgress() < this.contract.target) return false;
      this.game.ship.credits += this.contract.reward; this.contracts++;
      this.contract = this.nextContract(); this.game.save(); return true;
    }
    buyLicense(id) {
      if (!Object.hasOwn(Content.CLASSES, id)) return false;
      const definition = Content.CLASSES[id];
      if (!definition || this.licenses.has(id) || !this.dockAt(this.game.ship) || this.game.ship.credits < definition.price) return false;
      this.game.ship.credits -= definition.price; this.licenses.add(id);
      for (const [type, module] of Object.entries(MODULES)) if (module.shipClass === id) this.game.ship.unlocked.add(type);
      this.game.save(); return true;
    }
    switchClass(id) {
      if (!Object.hasOwn(Content.CLASSES, id)) return false;
      const old = this.game.ship;
      if (!this.licenses.has(id) || old.shipClass === id || !this.dockAt(old) || old.inventory.used > 0) return false;
      this.hangar[old.shipClass] = old.serialize();
      const stored = this.hangar[id];
      const ship = new Ship({ ...(stored || {}), modules: copy(stored?.modules || Content.CLASSES[id].modules), shipClass: id,
        credits: old.credits, unlocked: [...old.unlocked], x: old.x, y: old.y, inventory: {}, inertiaDampingEnabled: old.inertiaDampingEnabled });
      ship.x = old.x; ship.y = old.y;
      for (const module of ship.modules) ship.unlocked.add(module.type);
      this.game.ship = ship; this.cooldowns.clear();
      this.game.save(); return true;
    }
    tickCooldowns(cooldowns, dt) { for (const [key, value] of cooldowns) cooldowns.set(key, Math.max(0, value - dt)); }
    fireWeapons(ship, target, cooldowns, faction, dt, damageScale = 1) {
      this.tickCooldowns(cooldowns, dt);
      if (ship.stats.energyUse > ship.stats.energy || this.bullets.length >= 160) return;
      for (const module of ship.modules) {
        const weapon = MODULES[module.type].weapon;
        if (!weapon) continue;
        const key = `${module.gx},${module.gy}`;
        if (cooldowns.get(key) > 0) continue;
        const center = ship.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
        const aim = Math.atan2(target.y - center.y, target.x - center.x);
        const forward = ship.angle + (module.rotation || 0) * Math.PI / 2;
        if (Math.abs(Utils.angleDelta(forward, aim)) > (weapon.arc || Math.PI / 2) / 2 || Utils.distance(center, target) > weapon.range) continue;
        const dx = Math.cos(aim), dy = Math.sin(aim);
        this.bullets.push({ x: center.x + dx * 23, y: center.y + dy * 23, vx: dx * weapon.speed, vy: dy * weapon.speed,
          remaining: weapon.range, damage: weapon.damage * damageScale, faction, colour: faction === "enemy" ? "#ff876a" : MODULES[module.type].accent || "#73e8ff" });
        cooldowns.set(key, weapon.cooldown);
        this.effects.push({ x: center.x + dx * 23, y: center.y + dy * 23, vx: 0, vy: 0, life: 0.1, maxLife: 0.1, colour: "#e5faff", size: 7 });
      }
    }
    traceEnemy(origin, direction, length) {
      let nearest = null;
      for (const enemy of this.enemies) {
        if (enemy.dead || Utils.distance(origin, enemy.ship) > length + 450) continue;
        const hit = rayModules(enemy.ship, origin, direction, length);
        if (hit && (!nearest || hit.distance < nearest.distance)) nearest = { ...hit, enemy };
      }
      return nearest;
    }
    explode(x, y, colour, count) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 15 + Math.random() * 100;
        this.effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.5, maxLife: 0.75, size: 2 + Math.random() * 4, colour });
      }
      if (this.effects.length > 350) this.effects.splice(0, this.effects.length - 350);
    }
    spawnOutpost(station) {
      const modules = [];
      for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) modules.push({ type: x === 0 && y === 0 ? "core" : Math.abs(x) === 2 && Math.abs(y) === 2 ? "hauler_gun" : x === 0 ? "rtg" : "corvette_armor", gx: x, gy: y, rotation: 0 });
      return new Enemy({ name: station.name, behaviour: "artillery", reward: 400, modules }, station.x, station.y, 3, station.id);
    }
    update(dt, aim) {
      const ship = this.game.ship;
      this.farthest = Math.max(this.farthest, Math.hypot(ship.x, ship.y));
      if ((this.game.mouse.down || this.game.input.has("Space")) && !this.safeAt(ship)) this.fireWeapons(ship, aim, this.cooldowns, "player", dt);
      else this.tickCooldowns(this.cooldowns, dt);
      this.spawnTimer -= dt;
      const difficulty = this.difficulty();
      if (this.biome().danger > 0 && !this.safeAt(ship) && this.spawnTimer <= 0 && this.enemies.filter((e) => !e.stationId).length < Math.min(7, 1 + Math.ceil(difficulty / 2))) {
        const available = this.templates.filter((t) => t.tier <= difficulty);
        const template = available[Math.floor(Math.random() * available.length)];
        const angle = Math.random() * Math.PI * 2;
        const point = { x: ship.x + Math.cos(angle) * 850, y: ship.y + Math.sin(angle) * 850 };
        if (template && !this.safeAt(point) && this.biome(point).danger > 0) {
          this.enemies.push(new Enemy(template, point.x, point.y, difficulty));
          this.spawnTimer = Math.max(6, 18 - difficulty);
        }
      }
      for (const station of this.stations) if (station.hostile && !this.defeated.has(station.id) && Utils.distance(ship, station) < 1500 && !this.enemies.some((e) => e.stationId === station.id)) this.enemies.push(this.spawnOutpost(station));
      for (const enemy of this.enemies) if (!enemy.dead) enemy.update(dt, this);
      for (const bullet of this.bullets) {
        const speed = Math.hypot(bullet.vx, bullet.vy);
        const length = Math.min(bullet.remaining, speed * dt);
        const direction = { x: bullet.vx / speed, y: bullet.vy / speed };
        let hit = bullet.faction === "player" ? this.traceEnemy(bullet, direction, length) : this.safeAt(ship) ? null : rayModules(ship, bullet, direction, length);
        for (const asteroid of this.game.asteroids) {
          if (asteroid.dead) continue;
          const distance = rayCircle(bullet, direction, length, asteroid);
          if (distance !== null && (!hit || distance < hit.distance)) hit = { distance, asteroid };
        }
        if (hit) {
          bullet.x += direction.x * hit.distance; bullet.y += direction.y * hit.distance;
          if (hit.enemy) hit.enemy.damage(hit.module, bullet.damage, this);
          else if (!hit.asteroid && bullet.faction === "enemy") {
            ship.hp = Math.max(0, ship.hp - Math.max(1, bullet.damage - ship.stats.shield * 0.035));
          }
          this.explode(bullet.x, bullet.y, bullet.colour, 4); bullet.remaining = 0;
        } else {
          bullet.x += direction.x * length; bullet.y += direction.y * length; bullet.remaining -= length;
        }
      }
      this.bullets = this.bullets.filter((bullet) => bullet.remaining > 0);
      this.enemies = this.enemies.filter((enemy) => !enemy.dead && (enemy.stationId || Utils.distance(enemy.ship, ship) < 2200));
      for (const effect of this.effects) { effect.life -= dt; effect.x += effect.vx * dt; effect.y += effect.vy * dt; }
      this.effects = this.effects.filter((e) => e.life > 0);
    }
    drawBackground(ctx, time) {
      const { camera, viewport } = this.game;
      const biome = this.biome(camera);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 3; i++) {
        const x = viewport.width * (0.2 + i * 0.32) + Math.sin(time * 0.04 + i) * 40;
        const y = viewport.height * (0.3 + i * 0.13);
        const haze = ctx.createRadialGradient(x, y, 5, x, y, 340);
        haze.addColorStop(0, biome.colour + "65"); haze.addColorStop(1, biome.colour + "00");
        ctx.fillStyle = haze; ctx.fillRect(0, 0, viewport.width, viewport.height);
      }
      ctx.restore();
    }
    draw(ctx, time) {
      const { camera, viewport, images, ship } = this.game;
      for (const station of this.stations) {
        if (Utils.distance(camera, station) > 1100) continue;
        if (!station.hostile) station.draw(ctx, camera, viewport, images, time);
        else if (this.defeated.has(station.id)) {
          const p = Utils.worldToScreen(station, camera, viewport.width, viewport.height);
          ctx.save(); ctx.strokeStyle = "#514455"; ctx.setLineDash([6, 9]); ctx.beginPath(); ctx.arc(p.x, p.y, 85, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      for (const enemy of this.enemies) {
        if (Utils.distance(camera, enemy.ship) > 1150) continue;
        enemy.ship.drawExhaust(ctx, camera, viewport, images, this.game.time);
        enemy.ship.draw(ctx, camera, viewport, images, false, null, this.game.time);
        const p = Utils.worldToScreen(enemy.ship, camera, viewport.width, viewport.height);
        ctx.save(); ctx.strokeStyle = enemy.flash > 0 ? "#fff2cb" : "#f17665";
        ctx.lineWidth = 1;
        const width = Math.max(55, ...enemy.ship.modules.map((m) => Math.abs(m.gx) * 30 + 30));
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(p.x + dx * (width - 12), p.y + dy * width);
          ctx.lineTo(p.x + dx * width, p.y + dy * width); ctx.lineTo(p.x + dx * width, p.y + dy * (width - 12)); ctx.stroke();
        }
        ctx.fillStyle = "#371e29"; ctx.fillRect(p.x - 30, p.y - width - 9, 60, 3);
        ctx.fillStyle = "#f17665"; ctx.fillRect(p.x - 30, p.y - width - 9, 60 * enemy.ship.modules.reduce((sum, m) => sum + Math.max(0, m.combatHp), 0) / enemy.maxHp, 3);
        ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const bullet of this.bullets) {
        const p = Utils.worldToScreen(bullet, camera, viewport.width, viewport.height);
        ctx.strokeStyle = bullet.colour; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - bullet.vx * 0.025, p.y - bullet.vy * 0.025); ctx.stroke();
      }
      for (const effect of this.effects) {
        const p = Utils.worldToScreen(effect, camera, viewport.width, viewport.height);
        ctx.globalAlpha = Utils.clamp(effect.life / effect.maxLife, 0, 1);
        ctx.fillStyle = effect.colour; ctx.beginPath(); ctx.arc(p.x, p.y, effect.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      this.drawRadar(ctx, ship);
    }
    drawRadar(ctx, ship) {
      const { viewport } = this.game;
      const x = viewport.width - 92, y = viewport.height - 145, radius = 65;
      const range = 2500 + ship.modules.reduce((sum, m) => sum + (MODULES[m.type].radar || 0), 0);
      ctx.save(); ctx.fillStyle = "rgba(5,14,24,0.85)"; ctx.strokeStyle = "#31576b";
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - radius, y); ctx.lineTo(x + radius, y); ctx.moveTo(x, y - radius); ctx.lineTo(x, y + radius); ctx.stroke();
      for (const object of [...this.friendlyStations().map((s) => ({ ...s, friendly: true })), ...this.stations.filter((s) => s.hostile && !this.defeated.has(s.id)), ...this.enemies.filter((e) => !e.stationId).map((e) => e.ship)]) {
        const dx = object.x - ship.x, dy = object.y - ship.y;
        const distance = Math.hypot(dx, dy), scale = Math.min(radius - 6, distance / range * radius) / Math.max(1, distance);
        ctx.fillStyle = object.friendly ? "#70e6dc" : "#ff806d";
        ctx.fillRect(x + dx * scale - 2, y + dy * scale - 2, 4, 4);
      }
      ctx.fillStyle = "#e1f4ff"; ctx.beginPath(); ctx.moveTo(x + Math.cos(ship.angle) * 6, y + Math.sin(ship.angle) * 6); ctx.lineTo(x + Math.cos(ship.angle + 2.5) * 5, y + Math.sin(ship.angle + 2.5) * 5); ctx.lineTo(x + Math.cos(ship.angle - 2.5) * 5, y + Math.sin(ship.angle - 2.5) * 5); ctx.closePath(); ctx.fill();
      ctx.font = "14px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#89a9bb"; ctx.fillText(`${Math.round(range / 100) / 10} км`, x, y + radius + 18);
      ctx.restore();
    }
    serialize() {
      return { seed: this.seed, kills: this.kills, contracts: this.contracts, farthest: this.farthest, licenses: [...this.licenses], hangar: this.hangar, defeated: [...this.defeated], contract: this.contract };
    }
  }
  VS.Expedition = Expedition;
  VS.Combat = { Enemy, rayModules, rayCircle };
})();
