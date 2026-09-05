(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils, ModuleSystem, Inventory } = VS;
  const { MODULES, MODULE_SIZE, calculateStats, isAdjacentToShip, isConnected } = ModuleSystem;

  class Ship {
    constructor(save = {}) {
      this.x = Number(save.x) || -175;
      this.y = Number(save.y) || 0;
      this.vx = 0;
      this.vy = 0;
      this.angle = Number(save.angle) || 0;
      this.modules = Array.isArray(save.modules) && save.modules.length > 0
        ? save.modules.map((module) => ({ ...module }))
        : [
            { type: "core", gx: 0, gy: 0, rotation: 0 },
            { type: "laser", gx: 1, gy: 0, rotation: 0 },
            { type: "thruster", gx: -1, gy: 0, rotation: 0 },
          ];
      this.credits = Number.isFinite(save.credits) ? save.credits : 120;
      this.inventory = new Inventory(save.inventory || {});
      this.unlocked = new Set(Array.isArray(save.unlocked) ? save.unlocked : ["core", "laser", "thruster", "hull", "cargo"]);
      this.upgradeLevel = Number(save.upgradeLevel) || 0;
      this.stats = calculateStats(this.modules, this.upgradeLevel);
      this.hp = Number.isFinite(save.hp) ? Math.min(save.hp, this.stats.maxHp) : this.stats.maxHp;
      this.lastLaserAt = 0;
      this.collisionCooldown = 0;
      this.thrusting = false;
    }

    recalculateStats() {
      const previousMax = this.stats.maxHp;
      this.stats = calculateStats(this.modules, this.upgradeLevel);
      if (this.stats.maxHp > previousMax) this.hp += this.stats.maxHp - previousMax;
      this.hp = Math.min(this.hp, this.stats.maxHp);
    }

    update(dt, input, mouseWorld, game) {
      const targetAngle = Math.atan2(mouseWorld.y - this.y, mouseWorld.x - this.x);
      this.angle += Utils.angleDelta(this.angle, targetAngle) * Math.min(1, dt * 12);
      this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);

      let inputX = 0;
      let inputY = 0;
      if (input.has("KeyA") || input.has("ArrowLeft")) inputX -= 1;
      if (input.has("KeyD") || input.has("ArrowRight")) inputX += 1;
      if (input.has("KeyW") || input.has("ArrowUp")) inputY -= 1;
      if (input.has("KeyS") || input.has("ArrowDown")) inputY += 1;
      const magnitude = Math.hypot(inputX, inputY) || 1;
      const power = 150 + this.stats.thrust * 58;
      this.thrusting = inputX !== 0 || inputY !== 0;
      this.vx += (inputX / magnitude) * power * dt;
      this.vy += (inputY / magnitude) * power * dt;
      const maxSpeed = 145 + this.stats.thrust * 28;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }
      this.vx *= Math.pow(0.38, dt);
      this.vy *= Math.pow(0.38, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (this.thrusting && Math.random() < dt * 24) {
        const rear = this.localToWorld(-46, 0);
        game.particles.push(new VS.Entities.Particle(rear.x, rear.y, -this.vx * 0.18 + Utils.randomRange(-15, 15), -this.vy * 0.18 + Utils.randomRange(-15, 15), 0.45, "exhaust", 10));
      }
    }

    localToWorld(localX, localY) {
      const cosine = Math.cos(this.angle);
      const sine = Math.sin(this.angle);
      return {
        x: this.x + localX * cosine - localY * sine,
        y: this.y + localX * sine + localY * cosine,
      };
    }

    worldToLocal(worldX, worldY) {
      const dx = worldX - this.x;
      const dy = worldY - this.y;
      const cosine = Math.cos(-this.angle);
      const sine = Math.sin(-this.angle);
      return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine };
    }

    getLaserOrigin() {
      const laser = this.modules.find((module) => module.type === "laser");
      if (!laser) return this.localToWorld(MODULE_SIZE, 0);
      const center = this.localToWorld(laser.gx * MODULE_SIZE, laser.gy * MODULE_SIZE);
      return {
        x: center.x + Math.cos(this.angle) * 20,
        y: center.y + Math.sin(this.angle) * 20,
      };
    }

    addModule(type, gx, gy, rotation) {
      if (!MODULES[type] || !this.unlocked.has(type)) return { ok: false, reason: "Чертёж модуля ещё не разблокирован" };
      if (this.modules.some((module) => module.gx === gx && module.gy === gy)) return { ok: false, reason: "Ячейка уже занята" };
      if (!isAdjacentToShip(this.modules, gx, gy)) return { ok: false, reason: "Нужна соседняя точка крепления" };
      if (this.credits < MODULES[type].cost) return { ok: false, reason: "Недостаточно кредитов" };
      const candidate = [...this.modules, { type, gx, gy, rotation }];
      const stats = calculateStats(candidate, this.upgradeLevel);
      if (stats.energyUse > stats.energy) return { ok: false, reason: "Недостаточно энергии — установите РИТЕГ" };
      this.modules = candidate;
      this.credits -= MODULES[type].cost;
      this.recalculateStats();
      return { ok: true, reason: `${MODULES[type].name} установлен` };
    }

    removeModule(gx, gy) {
      const target = this.modules.find((module) => module.gx === gx && module.gy === gy);
      if (!target) return { ok: false, reason: "В этой ячейке нет модуля" };
      if (target.type === "core") return { ok: false, reason: "Командную капсулу нельзя демонтировать" };
      const candidate = this.modules.filter((module) => module !== target);
      if (!isConnected(candidate)) return { ok: false, reason: "Демонтаж разорвёт конструкцию" };
      const stats = calculateStats(candidate, this.upgradeLevel);
      if (stats.energyUse > stats.energy) return { ok: false, reason: "После демонтажа не хватит энергии" };
      this.modules = candidate;
      this.credits += Math.floor(MODULES[target.type].cost * 0.5);
      this.recalculateStats();
      return { ok: true, reason: `${MODULES[target.type].name} демонтирован` };
    }

    takeDamage(amount) {
      if (this.collisionCooldown > 0) return;
      this.hp = Math.max(0, this.hp - Math.max(1, amount - this.stats.shield * 0.08));
      this.collisionCooldown = 0.45;
    }

    draw(ctx, camera, viewport, images, buildMode = false, buildHover = null) {
      const center = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(this.angle);

      if (buildMode) {
        ctx.save();
        ctx.strokeStyle = "rgba(92, 232, 255, 0.16)";
        ctx.setLineDash([2, 3]);
        for (let x = -7; x <= 7; x += 1) {
          for (let y = -6; y <= 6; y += 1) {
            ctx.strokeRect(x * MODULE_SIZE - MODULE_SIZE / 2, y * MODULE_SIZE - MODULE_SIZE / 2, MODULE_SIZE, MODULE_SIZE);
          }
        }
        ctx.restore();
      }

      for (const module of this.modules) {
        const definition = MODULES[module.type];
        const image = images[`module_${module.type}`];
        const spriteRotation = module.rotation + (definition?.spriteRotation || 0);
        Utils.drawImage(ctx, image, module.gx * MODULE_SIZE, module.gy * MODULE_SIZE, MODULE_SIZE, MODULE_SIZE, spriteRotation * (Math.PI / 2));
        if (module.type === "shield") {
          ctx.strokeStyle = "rgba(92, 232, 255, 0.3)";
          ctx.strokeRect(module.gx * MODULE_SIZE - 17, module.gy * MODULE_SIZE - 17, 34, 34);
        }
        if (!definition) continue;
      }

      if (buildMode && buildHover) {
        const definition = MODULES[buildHover.type];
        const image = images[`module_${buildHover.type}`];
        const spriteRotation = buildHover.rotation + (definition.spriteRotation || 0);
        Utils.drawImage(ctx, image, buildHover.gx * MODULE_SIZE, buildHover.gy * MODULE_SIZE, MODULE_SIZE, MODULE_SIZE, spriteRotation * (Math.PI / 2), 0.52);
        ctx.strokeStyle = buildHover.valid ? "#5ce8ff" : "#ff4f63";
        ctx.lineWidth = 1;
        ctx.strokeRect(buildHover.gx * MODULE_SIZE - MODULE_SIZE / 2, buildHover.gy * MODULE_SIZE - MODULE_SIZE / 2, MODULE_SIZE, MODULE_SIZE);
      }

      ctx.restore();
    }

    serialize() {
      return {
        x: this.x,
        y: this.y,
        angle: this.angle,
        modules: this.modules,
        credits: this.credits,
        inventory: this.inventory.serialize(),
        unlocked: [...this.unlocked],
        upgradeLevel: this.upgradeLevel,
        hp: this.hp,
      };
    }
  }

  VS.Ship = Ship;
})();
