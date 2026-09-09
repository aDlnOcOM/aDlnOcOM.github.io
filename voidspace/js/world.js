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
      if (ship.engineering?.nodes.get(`${module.gx},${module.gy}`)?.integrity <= 0) continue;
      let entry = 0, exit = length;
      for (const [axis, centre] of [["x", module.gx * MODULE_SIZE], ["y", module.gy * MODULE_SIZE]]) {
        const half = (axis === "x" ? module.hitWidth || 30 : module.hitHeight || 30) / 2;
        if (Math.abs(vector[axis]) < 1e-8) {
          if (local[axis] < centre - half || local[axis] > centre + half) { exit = -1; break; }
        } else {
          const a = (centre - half - local[axis]) / vector[axis];
          const b = (centre + half - local[axis]) / vector[axis];
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
      if (this.ship.engineering) {
        // Patrols leave their base with finite conventional ammunition, never free nuclear rounds.
        const ammo = [...new Set(this.ship.modules.map((m) => MODULES[m.type].weapon?.ammo).filter((id) => id && id !== "nuclear_rocket"))];
        const allowance = Math.floor(this.ship.engineering.stockCapacity() / Math.max(1, ammo.length));
        for (const id of ammo) this.ship.engineering.stock[id] = Math.min(allowance, id === "swarm_rocket" ? 36 : 24);
        this.ship.research = new Set(this.ship.modules.filter((m) => m.overclock).map((m) => m.type));
        if (this.ship.modules.some((m) => m.type === "nuclear_launcher") && this.ship.modules.some((m) => m.type === "nuclear_factory")) {
          this.ship.inventory.contents.platinum = 2; this.ship.inventory.contents.rareEarths = 2;
          this.ship.engineering.stock.casing = 1; this.ship.engineering.stock.guidance = 1;
        }
      }
      this.cooldowns = new Map();
      this.dead = false; this.flash = 0; this.contactCooldown = 0;
      this.stationId = stationId;
      this.maxHp = this.ship.modules.reduce((sum, m) => sum + m.combatHp, 0);
    }
    damage(module, amount, world, kind = "kinetic", penetration = 0) {
      if (this.dead || !this.ship.modules.includes(module)) return;
      if (this.ship.engineering && kind !== "processed") amount = this.ship.engineering.armorDamage(module, this.ship.engineering.shieldDamage(amount, kind), kind, penetration);
      module.combatHp -= amount; this.flash = 0.12;
      const node = this.ship.engineering?.nodes.get(`${module.gx},${module.gy}`);
      if (node) node.integrity = Math.max(0, module.combatHp / this.scale);
      if (module.combatHp > 0) return;
      const point = this.ship.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
      world.explode(point.x, point.y, "#ff986c", 12);
      if (MODULES[module.type].reactor) this.ship.engineering?.events.push({ x: module.gx * 30, y: module.gy * 30, nuclear: true });
      const previous = this.ship.modules;
      this.ship.modules = previous.filter((m) => module.assembly ? m.assembly !== module.assembly : m !== module);
      if (module.type === "core") { for (const part of previous) world.spawnModuleDebris?.(this.ship, part); this.destroy(world); return; }
      // Destroying a bridge detaches the modules it supported, including weapons.
      const connected = ModuleSystem.connectedToCore(this.ship.modules);
      for (const m of previous) if (!connected.has(m)) world.spawnModuleDebris?.(this.ship, m);
      this.ship.modules = this.ship.modules.filter((m) => connected.has(m));
      this.ship.stats = ModuleSystem.calculateStats(this.ship.modules);
      this.ship.engineering?.sync();
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
      if (this.ship.engineering) this.ship.engineering.onDamage = (module, amount) => this.damage(module, amount, world, "processed");
      if (this.ship.engineering?.stock.nuclear_core > 0) for (const m of this.ship.modules) if (m.type === "nuclear_factory") this.ship.engineering.nodes.get(`${m.gx},${m.gy}`).recipe = "nuclear_rocket";
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
          if (!station.powered) continue;
          const d = Utils.distance(this.ship, station);
          if (d < station.safeRadius + 90) {
            const a = Math.atan2(this.ship.y - station.y, this.ship.x - station.x);
            this.ship.x = station.x + Math.cos(a) * (station.safeRadius + 90);
            this.ship.y = station.y + Math.sin(a) * (station.safeRadius + 90);
            this.ship.vx *= 0.5; this.ship.vy *= 0.5;
          }
        }
      } else { this.ship.aimWorld = { x: target.x, y: target.y }; this.ship.engineering?.step(dt); }
      const weaponRange = Math.max(950, ...this.ship.modules.map((m) => MODULES[m.type].weapon?.range || 0));
      if (!protectedTarget && distance < weaponRange) world.fireWeapons(this.ship, target, this.cooldowns, "enemy", dt, this.scale);
      else world.tickCooldowns(this.cooldowns, dt);
      if (distance < 250 && !protectedTarget && this.contactCooldown <= 0) {
        for (const module of this.ship.modules) {
          const center = this.ship.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
          const contact = target.getCircleCollision(center.x, center.y, 14);
          if (!contact) continue;
          target.x += contact.normalX * contact.penetration;
          target.y += contact.normalY * contact.penetration;
          target.vx += contact.normalX * 14; target.vy += contact.normalY * 14;
          if (target.engineering) target.engineering.damage(contact.module, 10);
          else target.takeDamage(10);
          this.damage(module, 12, world);
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
      this.debris = [];
      this.outpostStates = save.outposts && typeof save.outposts === "object" ? save.outposts : {};
      game.station.restore?.(save.stationDamage?.home);
      this.spawnTimer = 8;
      this.reloadTemplates();
      this.stations = [];
      for (let i = 0; i < 5; i++) {
        const hostile = i % 2 === 1;
        const radius = [2100, 3300, 4200, 5700, 6500][i];
        const angle = this.seed * 0.17 + i * 2.4;
        const station = new Station(save.stationDamage?.[`station-${i}`]);
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
    friendlyStations() { return [this.game.station, ...this.stations.filter((s) => !s.hostile)].filter((s) => !s.dead); }
    stationTargets() { return this.friendlyStations().map((station) => ({ ship: station, station })); }
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
        credits: old.credits, unlocked: [...old.unlocked], research: [...old.research], x: old.x, y: old.y, inventory: {}, inertiaDampingEnabled: old.inertiaDampingEnabled });
      ship.x = old.x; ship.y = old.y;
      for (const module of ship.modules) ship.unlocked.add(module.type);
      this.game.ship = ship; this.cooldowns.clear();
      this.game.save(); return true;
    }
    tickCooldowns(cooldowns, dt) { for (const [key, value] of cooldowns) cooldowns.set(key, Math.max(0, value - dt)); }
    fireWeapons(ship, target, cooldowns, faction, dt, damageScale = 1) {
      if (VS.WeaponSystem) return VS.WeaponSystem.fire(this, ship, target, cooldowns, faction, dt, damageScale);
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
    spawnModuleDebris(ship, module) {
      const point = ship.localToWorld(module.gx * 30, module.gy * 30);
      const direction = Math.atan2(point.y - ship.y, point.x - ship.x) + (Math.random() - 0.5);
      this.debris.push({ ...point, type: module.type, width: module.hitWidth || 30, height: module.hitHeight || 30,
        vx: (ship.vx || 0) + Math.cos(direction) * 28, vy: (ship.vy || 0) + Math.sin(direction) * 28,
        angle: (ship.angle || 0) + (module.rotation || 0) * Math.PI / 2, spin: Math.random() - 0.5, life: 4.5 });
      if (this.debris.length > 160) this.debris.shift();
    }
    spawnOutpost(station) {
      const modules = [];
      for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) modules.push({ type: x === 0 && y === 0 ? "core" : Math.abs(x) === 2 && Math.abs(y) === 2 ? "hauler_gun" : x === 0 ? "rtg" : "corvette_armor", gx: x, gy: y, rotation: 0 });
      const saved = this.outpostStates[station.id];
      const enemy = new Enemy({ name: station.name, behaviour: "artillery", reward: 400, modules: saved?.ship?.modules || modules }, station.x, station.y, 3, station.id);
      if (saved?.ship) {
        enemy.ship = new Ship({ ...saved.ship, x: station.x, y: station.y });
        for (const m of enemy.ship.modules) m.combatHp = Utils.clamp(finite(saved.health?.[`${m.gx},${m.gy}`], MODULES[m.type].hp * enemy.scale), 0.01, MODULES[m.type].hp * enemy.scale);
        enemy.maxHp = enemy.ship.modules.reduce((sum, m) => sum + MODULES[m.type].hp * enemy.scale, 0);
      }
      return enemy;
    }
    update(dt, aim) {
      this.weaponWarning = "";
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
      if (VS.WeaponSystem) VS.WeaponSystem.update(this, dt);
      else for (const bullet of this.bullets) {
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
      for (const piece of this.debris) { piece.life -= dt; piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.angle += piece.spin * dt; }
      this.debris = this.debris.filter((piece) => piece.life > 0);
    }
    drawBackground(ctx, time) {
      const { camera, viewport } = this.game;
      const layers = Content.biomeBlend(camera.x, camera.y, this.seed);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const [index, biome] of layers.entries()) {
        if (biome.weight < 0.001) continue;
        ctx.globalAlpha = biome.weight;
        for (let i = 0; i < 3; i++) {
          const drift = index * 1.7 + i * 2.3;
          const x = viewport.width * (0.12 + i * 0.38) + Math.sin(time * 0.025 + camera.x / 3400 + drift) * 140;
          const y = viewport.height * (0.35 + Math.sin(drift + camera.y / 2800) * 0.22);
          const radius = 230 + index * 35 + i * 30;
          const haze = ctx.createRadialGradient(x, y, 0, x, y, radius);
          haze.addColorStop(0, biome.colour + "b0"); haze.addColorStop(0.45, biome.colour + "55"); haze.addColorStop(1, biome.colour + "00");
          ctx.fillStyle = haze; ctx.fillRect(0, 0, viewport.width, viewport.height);
        }
        // Anchored world-space dust: no teleporting particles at biome boundaries.
        const spacing = 165, ox = Math.floor(camera.x / spacing), oy = Math.floor(camera.y / spacing);
        for (let gx = ox - 4; gx <= ox + 4; gx++) for (let gy = oy - 3; gy <= oy + 3; gy++) {
          const noise = Utils.hashNoise(gx + index * 70, gy);
          if (noise > 0.18 + index * 0.11) continue;
          const p = Utils.worldToScreen({ x: gx * spacing + noise * 110, y: gy * spacing + Utils.hashNoise(gy, gx) * 130 }, camera, viewport.width, viewport.height);
          ctx.fillStyle = ["#77bace", "#cba675", "#b2eaff", "#b89aee", "#e6a1b6"][index];
          ctx.globalAlpha = biome.weight * (0.08 + noise * 0.35);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, index === 2 ? 1.3 : 0.7, index === 2 ? 2.6 : 0.7, noise * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
    draw(ctx, time) {
      const { camera, viewport, images, ship } = this.game;
      for (const piece of this.debris) {
        const p = Utils.worldToScreen(piece, camera, viewport.width, viewport.height);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(piece.angle); ctx.scale(1, piece.height / piece.width);
        ctx.globalAlpha = Math.min(0.85, piece.life / 1.5);
        this.game.station.drawModule(ctx, images, piece.type, 0, 0, piece.width);
        ctx.fillStyle = "rgba(13,8,4,0.35)"; ctx.fillRect(-piece.width / 2, -piece.width / 2, piece.width, piece.width); ctx.restore();
      }
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
        const kind = bullet.weapon?.kind;
        const angle = Math.atan2(bullet.vy, bullet.vx), length = kind === "thermal" ? 52 : kind === "missile" ? 20 : 28;
        if (VS.Visuals?.effect(ctx, images, kind === "ballistic" ? "tracer" : kind === "thermal" ? "thermal" : "bolt", p.x - Math.cos(angle) * length * 0.35, p.y - Math.sin(angle) * length * 0.35, length, 0.85, angle, kind === "thermal" ? 25 : 12)) continue;
        ctx.strokeStyle = bullet.colour; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - bullet.vx * 0.025, p.y - bullet.vy * 0.025); ctx.stroke();
      }
      for (const effect of this.effects) {
        const p = Utils.worldToScreen(effect, camera, viewport.width, viewport.height);
        const life = Utils.clamp(effect.life / effect.maxLife, 0, 1);
        if (VS.Visuals?.effect(ctx, images, effect.colour?.startsWith("#ff") ? "explosion" : "ion_explosion", p.x, p.y, effect.size * (3 + (1 - life) * 5), life * life * 0.65, effect.vx)) continue;
        ctx.globalAlpha = Utils.clamp(effect.life / effect.maxLife, 0, 1);
        ctx.fillStyle = effect.colour; ctx.beginPath(); ctx.arc(p.x, p.y, effect.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      VS.WeaponSystem?.draw(this, ctx);
      this.drawRadar(ctx, ship);
    }
    drawRadar(ctx, ship) {
      const { viewport } = this.game;
      if (viewport.width < 590) return;
      const x = viewport.width - 92, y = viewport.height - 145, radius = 65;
      const range = 2500 + ship.modules.reduce((sum, m) => sum + (MODULES[m.type].radar || 0), 0);
      ctx.save(); ctx.fillStyle = "rgba(5,14,24,0.85)"; ctx.strokeStyle = "#31576b";
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.strokeStyle = "#36595680"; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(x, y, radius / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const sweep = (this.game.time || 0) * 0.45;
      ctx.strokeStyle = "#9ce7dc45"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(sweep) * radius, y + Math.sin(sweep) * radius); ctx.stroke();
      ctx.strokeStyle = "#29414e";
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
      const outposts = { ...this.outpostStates };
      for (const enemy of this.enemies) if (enemy.stationId && !enemy.dead) outposts[enemy.stationId] = { ship: enemy.ship.serialize(), health: Object.fromEntries(enemy.ship.modules.map((m) => [`${m.gx},${m.gy}`, m.combatHp])) };
      return { seed: this.seed, kills: this.kills, contracts: this.contracts, farthest: this.farthest, licenses: [...this.licenses], hangar: this.hangar, defeated: [...this.defeated], contract: this.contract,
        stationDamage: Object.fromEntries([this.game.station, ...this.stations.filter((s) => !s.hostile)].map((s) => [s.id, s.serialize()])), outposts };
    }
  }
  VS.Expedition = Expedition;
  VS.Combat = { Enemy, rayModules, rayCircle };
})();
