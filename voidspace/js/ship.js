(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils, ModuleSystem, Inventory } = VS;
  const {
    MODULES,
    MODULE_SIZE,
    calculateStats,
    getPlacementConflict,
    placementConflictReason,
    isAdjacentToShip,
    isConnected,
  } = ModuleSystem;
  const MODULE_FRAME_SIZE = MODULE_SIZE + 1;
  const EXHAUST_LENGTH = MODULE_SIZE * 6;
  const LASER_SWAY = Math.PI / 24;
  const LASER_SWAY_SPEED = 1.8;
  const LASER_MUZZLE_OFFSET = 21;
  const MODULE_LAYER_CACHE = new WeakMap();
  const EXHAUST_TEXTURE_CACHE = new WeakMap();
  const EXHAUST_TEXTURES = {
    thruster: { crop: { x: 112, y: 392, width: 1320, height: 244 }, width: 512, height: 96, drawHeight: 18 },
    booster: { crop: { x: 16, y: 256, width: 1520, height: 512 }, width: 512, height: 160, drawHeight: 30 },
  };

  function createSpriteLayer(image, crop, warmTone = null) {
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    if (!warmTone) return canvas;

    const imageData = context.getImageData(0, 0, crop.width, crop.height);
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      const isWarm = alpha > 0 && red > 110 && green > 45 && red > green * 1.05 && red > blue * 1.45;
      if (!isWarm) continue;
      const intensity = Math.max(red, green);
      if (warmTone === "bright") {
        pixels[index] = Math.round(intensity * 0.18);
        pixels[index + 1] = Math.min(255, Math.round(intensity * 0.86 + 38));
        pixels[index + 2] = 255;
      } else {
        pixels[index] = Math.round(intensity * 0.1);
        pixels[index + 1] = Math.round(intensity * 0.28);
        pixels[index + 2] = Math.round(intensity * 0.43);
      }
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  function getAnimatedModuleLayers(type, image) {
    const cached = MODULE_LAYER_CACHE.get(image);
    if (cached) return cached;
    let layers = null;
    if (type === "laser") {
      layers = {
        body: createSpriteLayer(image, { x: 7, y: 18, width: 49, height: 44 }, "muted"),
        tool: createSpriteLayer(image, { x: 24, y: 2, width: 16, height: 29 }, "bright"),
      };
    }
    if (type === "drill") {
      layers = {
        body: createSpriteLayer(image, { x: 10, y: 13, width: 43, height: 35 }),
        tool: createSpriteLayer(image, { x: 21, y: 48, width: 21, height: 14 }),
      };
    }
    if (layers) MODULE_LAYER_CACHE.set(image, layers);
    return layers;
  }

  function laserSway(time) {
    return Math.sin(time * LASER_SWAY_SPEED) * LASER_SWAY;
  }

  function getExhaustTexture(type, image) {
    if (!image || !EXHAUST_TEXTURES[type]) return null;
    const cached = EXHAUST_TEXTURE_CACHE.get(image);
    if (cached) return cached;
    const config = EXHAUST_TEXTURES[type];
    const canvas = document.createElement("canvas");
    canvas.width = config.width;
    canvas.height = config.height;
    const context = canvas.getContext("2d");
    const crop = config.crop;
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, config.width, config.height);

    const imageData = context.getImageData(0, 0, config.width, config.height);
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const signal = Math.max(blue - red, green - red, 0);
      pixels[index + 3] = signal <= 2 ? 0 : Math.min(255, Math.round((signal - 2) * 18 + 35));
    }
    context.putImageData(imageData, 0, 0);
    EXHAUST_TEXTURE_CACHE.set(image, canvas);
    return canvas;
  }

  function drawModuleSprite(ctx, image, definition, x, y, rotation, alpha = 1) {
    if (!image) return;
    const crop = definition?.spriteCrop;
    if (!crop) {
      Utils.drawImage(ctx, image, x, y, MODULE_SIZE, MODULE_SIZE, rotation, alpha);
      return;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -MODULE_SIZE / 2,
      -MODULE_SIZE / 2,
      MODULE_SIZE,
      MODULE_SIZE,
    );
    ctx.restore();
  }

  function drawAnimatedModule(ctx, image, module, definition, time, alpha = 1) {
    if (!image || !definition) return false;
    const layers = getAnimatedModuleLayers(module.type, image);
    if (!layers) return false;
    const x = module.gx * MODULE_SIZE;
    const y = module.gy * MODULE_SIZE;
    const baseRotation = (module.rotation + (definition.spriteRotation || 0)) * (Math.PI / 2);
    Utils.drawImage(ctx, layers.body, x, y, MODULE_SIZE, MODULE_SIZE, baseRotation, alpha);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (module.type === "laser") {
      ctx.rotate(baseRotation + laserSway(time));
      ctx.drawImage(layers.tool, -4, -21, 8, 24);
    } else {
      const cycle = time * 13;
      const extension = Math.sin(cycle) * 1.2;
      const vibration = Math.sin(cycle * 0.73) * (Math.PI / 90);
      ctx.rotate(baseRotation + vibration);
      ctx.drawImage(layers.tool, -5, -3, 10, 22 + extension);
    }
    ctx.restore();
    return true;
  }

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

    getLaserMount(time = 0) {
      const laser = this.modules.find((module) => module.type === "laser");
      if (!laser) return { origin: this.localToWorld(MODULE_SIZE, 0), angle: this.angle };
      const center = this.localToWorld(laser.gx * MODULE_SIZE, laser.gy * MODULE_SIZE);
      const angle = this.angle + (Number(laser.rotation) || 0) * (Math.PI / 2) + laserSway(time);
      return {
        origin: {
          x: center.x + Math.cos(angle) * LASER_MUZZLE_OFFSET,
          y: center.y + Math.sin(angle) * LASER_MUZZLE_OFFSET,
        },
        angle,
      };
    }

    addModule(type, gx, gy, rotation) {
      if (!MODULES[type] || !this.unlocked.has(type)) return { ok: false, reason: "Чертёж модуля ещё не разблокирован" };
      if (this.modules.some((module) => module.gx === gx && module.gy === gy)) return { ok: false, reason: "Ячейка уже занята" };
      if (!isAdjacentToShip(this.modules, gx, gy)) return { ok: false, reason: "Нужна соседняя точка крепления" };
      const conflict = getPlacementConflict(this.modules, { type, gx, gy, rotation });
      if (conflict) return { ok: false, reason: placementConflictReason(conflict) };
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

    drawEngineExhaust(ctx, images, time, buildMode) {
      for (const module of this.modules) {
        if (module.type !== "thruster" && module.type !== "booster") continue;
        const texture = getExhaustTexture(module.type, images[`exhaust_${module.type}`]);
        if (!texture) continue;
        const config = EXHAUST_TEXTURES[module.type];
        const flicker = 0.88 + Math.sin(time * 15 + module.gx * 1.7 + module.gy * 2.3) * 0.12;
        const alpha = this.thrusting ? 0.5 + flicker * 0.32 : buildMode ? 0.42 : 0.13;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
        ctx.rotate((Number(module.rotation) || 0) * (Math.PI / 2));
        ctx.drawImage(
          texture,
          -MODULE_SIZE / 2 - EXHAUST_LENGTH,
          -(config.drawHeight * flicker) / 2,
          EXHAUST_LENGTH,
          config.drawHeight * flicker,
        );
        ctx.restore();
      }
    }

    drawExhaust(ctx, camera, viewport, images, time = 0, buildMode = false) {
      const center = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(this.angle);
      this.drawEngineExhaust(ctx, images, time, buildMode);
      ctx.restore();
    }

    draw(ctx, camera, viewport, images, buildMode = false, buildHover = null, time = 0) {
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
        Utils.drawImage(ctx, images.module_frame, module.gx * MODULE_SIZE, module.gy * MODULE_SIZE, MODULE_FRAME_SIZE, MODULE_FRAME_SIZE);
        const animated = drawAnimatedModule(ctx, image, module, definition, time);
        if (!animated) drawModuleSprite(ctx, image, definition, module.gx * MODULE_SIZE, module.gy * MODULE_SIZE, spriteRotation * (Math.PI / 2));
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
        Utils.drawImage(ctx, images.module_frame, buildHover.gx * MODULE_SIZE, buildHover.gy * MODULE_SIZE, MODULE_FRAME_SIZE, MODULE_FRAME_SIZE, 0, 0.52);
        const animated = drawAnimatedModule(ctx, image, buildHover, definition, time, 0.52);
        if (!animated) drawModuleSprite(ctx, image, definition, buildHover.gx * MODULE_SIZE, buildHover.gy * MODULE_SIZE, spriteRotation * (Math.PI / 2), 0.52);
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
