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
    moduleDirection,
  } = ModuleSystem;
  const MODULE_FRAME_SIZE = MODULE_SIZE + 1;
  const EXHAUST_FPS = 16;
  const EXHAUST_FRAME_COUNT = 16;
  const EXHAUST_FRAME_WIDTH = 768;
  const EXHAUST_FRAME_HEIGHT = 64;
  const LASER_MUZZLE_OFFSET = 21;
  const ENGINE_FORCE = 260;
  const ENGINE_GIMBAL = Math.PI / 10;
  const TURNING_THROTTLE = 0.72;
  const TORQUE_RESPONSE = 4;
  const MAX_ANGULAR_SPEED = 2.4;
  const MODULE_LAYER_CACHE = new WeakMap();
  const EXHAUST_TEXTURE_CACHE = new WeakMap();
  const EXHAUST_TEXTURES = {
    thruster: {
      nozzleOffsets: [0],
      attachmentX: -12.5,
      drawHeight: 12,
      rampUp: 0.65,
      rampDown: 0.24,
      particleCount: 4,
    },
    booster: {
      nozzleOffsets: [-8.2, 7.6],
      attachmentX: -12.5,
      drawHeight: 10.5,
      rampUp: 1.1,
      rampDown: 0.32,
      particleCount: 5,
    },
  };

  function isEngine(module) {
    return module.type === "thruster" || module.type === "booster";
  }

  function engineKey(module) {
    return `${module.gx},${module.gy}`;
  }

  function moduleMass(module) {
    const definition = MODULES[module.type];
    return 1 + (definition?.hp || 0) / 100 + (definition?.cargo || 0) / 40 + (definition?.energy || 0) / 50;
  }

  function calculateMassProperties(modules) {
    const weightedModules = modules.map((module) => ({
      module,
      mass: moduleMass(module),
      x: module.gx * MODULE_SIZE,
      y: module.gy * MODULE_SIZE,
    }));
    const totalMass = weightedModules.reduce((sum, item) => sum + item.mass, 0) || 1;
    const centerX = weightedModules.reduce((sum, item) => sum + item.x * item.mass, 0) / totalMass;
    const centerY = weightedModules.reduce((sum, item) => sum + item.y * item.mass, 0) / totalMass;
    const cellInertia = (MODULE_SIZE * MODULE_SIZE) / 6;
    const inertia = weightedModules.reduce((sum, item) => {
      const dx = item.x - centerX;
      const dy = item.y - centerY;
      return sum + item.mass * (dx * dx + dy * dy + cellInertia);
    }, 0);
    return {
      centerX,
      centerY,
      mass: Math.max(1, totalMass / 3),
      inertia: Math.max(MODULE_SIZE * MODULE_SIZE, inertia),
    };
  }

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

  function normalizeExhaustLayer(source, bounds) {
    const base = document.createElement("canvas");
    base.width = EXHAUST_FRAME_WIDTH;
    base.height = EXHAUST_FRAME_HEIGHT;
    const context = base.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      source,
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX + 1,
      bounds.maxY - bounds.minY + 1,
      0,
      0,
      EXHAUST_FRAME_WIDTH,
      EXHAUST_FRAME_HEIGHT,
    );
    return base;
  }

  function animateExhaustLayer(base, layer) {
    const isCore = layer === "core";
    return Array.from({ length: EXHAUST_FRAME_COUNT }, (_, frameIndex) => {
      const frame = document.createElement("canvas");
      frame.width = EXHAUST_FRAME_WIDTH;
      frame.height = EXHAUST_FRAME_HEIGHT;
      const context = frame.getContext("2d");
      const phase = (frameIndex / EXHAUST_FRAME_COUNT) * Math.PI * 2;
      const sliceWidth = isCore ? 8 : 6;

      for (let x = 0; x < EXHAUST_FRAME_WIDTH; x += sliceWidth) {
        const width = Math.min(sliceWidth, EXHAUST_FRAME_WIDTH - x);
        const tailInfluence = 1 - x / EXHAUST_FRAME_WIDTH;
        const wave = Math.sin(x * (isCore ? 0.041 : 0.052) + phase);
        const turbulence = Math.sin(x * 0.117 - phase * 1.7);
        const yOffset = (wave * (isCore ? 0.5 : 1.65) + turbulence * (isCore ? 0.22 : 0.68)) * tailInfluence;
        const xOffset = Math.sin(x * 0.031 - phase) * (isCore ? 0.45 : 1.15) * tailInfluence;
        context.drawImage(base, x, 0, width, EXHAUST_FRAME_HEIGHT, x + xOffset, yOffset, width + 0.5, EXHAUST_FRAME_HEIGHT);
      }

      const pulseX = EXHAUST_FRAME_WIDTH - ((frameIndex + 1) / EXHAUST_FRAME_COUNT) * EXHAUST_FRAME_WIDTH;
      context.save();
      context.beginPath();
      context.rect(pulseX - 64, 0, 128, EXHAUST_FRAME_HEIGHT);
      context.clip();
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = isCore ? 0.28 : 0.12;
      context.drawImage(base, 0, 0);
      context.restore();
      return frame;
    });
  }

  function createExhaustEffect(image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const source = document.createElement("canvas");
    const coreSource = document.createElement("canvas");
    source.width = sourceWidth;
    source.height = sourceHeight;
    coreSource.width = sourceWidth;
    coreSource.height = sourceHeight;
    const sourceContext = source.getContext("2d");
    const coreContext = coreSource.getContext("2d");
    sourceContext.drawImage(image, 0, 0);

    const imageData = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);
    const pixels = imageData.data;
    const coreData = coreContext.createImageData(sourceWidth, sourceHeight);
    const corePixels = coreData.data;
    let minX = sourceWidth;
    let minY = sourceHeight;
    let maxX = 0;
    let maxY = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const coolLead = Math.max(blue, green) - red;
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      const alpha = coolLead <= 3 || saturation <= 4 ? 0 : Math.min(255, Math.round((coolLead - 3) * 12 + saturation * 0.7));
      pixels[index + 3] = alpha;
      const brightness = Math.max(red, green, blue);
      const coreStrength = Utils.clamp((brightness - 84) / 150, 0, 1) * Utils.clamp((coolLead + 12) / 78, 0, 1);
      corePixels[index] = Math.min(255, Math.round(red * 0.35));
      corePixels[index + 1] = Math.min(255, Math.round(green * 0.78 + 48 * coreStrength));
      corePixels[index + 2] = 255;
      corePixels[index + 3] = Math.round(alpha * coreStrength);
      if (alpha <= 8) continue;
      const pixelIndex = index / 4;
      const x = pixelIndex % sourceWidth;
      const y = Math.floor(pixelIndex / sourceWidth);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    sourceContext.putImageData(imageData, 0, 0);
    coreContext.putImageData(coreData, 0, 0);

    if (minX > maxX || minY > maxY) return { coreFrames: [], haloFrames: [] };
    const padding = 4;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(sourceWidth - 1, maxX + padding);
    maxY = Math.min(sourceHeight - 1, maxY + padding);

    const bounds = { minX, minY, maxX, maxY };
    const haloBase = normalizeExhaustLayer(source, bounds);
    const coreBase = normalizeExhaustLayer(coreSource, bounds);
    return {
      coreFrames: animateExhaustLayer(coreBase, "core"),
      haloFrames: animateExhaustLayer(haloBase, "halo"),
    };
  }

  function getExhaustEffect(image) {
    if (!image) return null;
    const cached = EXHAUST_TEXTURE_CACHE.get(image);
    if (cached) return cached;
    const effect = createExhaustEffect(image);
    EXHAUST_TEXTURE_CACHE.set(image, effect);
    return effect;
  }

  function drawExhaustParticles(ctx, length, height, activation, animationTick, count, seed) {
    ctx.save();
    ctx.fillStyle = "#7beeff";
    for (let index = 0; index < count; index += 1) {
      const step = (animationTick * (3 + (index % 2)) + index * 11 + seed * 7) % 47;
      const progress = step / 47;
      const x = -length * (0.12 + progress * 0.82);
      const wave = Math.sin(progress * Math.PI * 5 + index * 2.17 + seed);
      const y = wave * height * 0.34 * progress;
      const radius = (0.55 + ((index * 13 + seed) % 5) * 0.18) * (1 - progress * 0.42);
      ctx.globalAlpha = activation * (0.16 + (1 - progress) * 0.34);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

  function drawAnimatedModule(ctx, image, module, definition, time, aimLocal = null, alpha = 1) {
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
      const targetX = aimLocal?.x - x;
      const targetY = aimLocal?.y - y;
      const turretRotation = Math.hypot(targetX, targetY) > 1 ? Math.atan2(targetY, targetX) + Math.PI / 2 : baseRotation;
      ctx.rotate(turretRotation);
      ctx.drawImage(layers.tool, -4, -21, 8, 24);
    } else {
      ctx.rotate(baseRotation);
      ctx.drawImage(layers.tool, -5, -3, 10, 22);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.lineTo(5, -3);
      ctx.lineTo(1.2, 19);
      ctx.lineTo(-1.2, 19);
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const grooveOffset = (time * 18) % 6;
      for (let grooveY = -9 + grooveOffset; grooveY < 24; grooveY += 6) {
        ctx.beginPath();
        ctx.moveTo(-6, grooveY - 2);
        ctx.lineTo(6, grooveY + 2);
        ctx.strokeStyle = "rgba(98, 226, 255, 0.72)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6, grooveY + 0.4);
        ctx.lineTo(6, grooveY + 4.4);
        ctx.strokeStyle = "rgba(18, 67, 116, 0.58)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
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
      this.braking = false;
      this.angularVelocity = 0;
      this.engineStates = new Map();
      this.aimWorld = { x: this.x + MODULE_SIZE * 4, y: this.y };
    }

    recalculateStats() {
      const previousMax = this.stats.maxHp;
      this.stats = calculateStats(this.modules, this.upgradeLevel);
      if (this.stats.maxHp > previousMax) this.hp += this.stats.maxHp - previousMax;
      this.hp = Math.min(this.hp, this.stats.maxHp);
    }

    update(dt, input, mouseWorld) {
      this.aimWorld = { x: mouseWorld.x, y: mouseWorld.y };
      this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);

      const turnInput =
        (input.has("KeyD") || input.has("ArrowRight") ? 1 : 0) -
        (input.has("KeyA") || input.has("ArrowLeft") ? 1 : 0);
      this.braking = input.has("KeyS") || input.has("ArrowDown");
      const throttleRequested = (input.has("KeyW") || input.has("ArrowUp")) && !this.braking;
      const massProperties = calculateMassProperties(this.modules);
      const engines = this.modules.filter(isEngine);
      const activeEngineKeys = new Set(engines.map(engineKey));
      let localForceX = 0;
      let localForceY = 0;
      let localTorque = 0;

      for (const engine of engines) {
        const key = engineKey(engine);
        const state = this.engineStates.get(key) || { throttle: 0, activation: 0, gimbal: 0 };
        const [baseDirectionX, baseDirectionY] = moduleDirection(engine);
        const baseAngle = Math.atan2(baseDirectionY, baseDirectionX);
        const radiusX = engine.gx * MODULE_SIZE - massProperties.centerX;
        const radiusY = engine.gy * MODULE_SIZE - massProperties.centerY;
        let throttle = throttleRequested ? 1 : 0;
        let gimbal = 0;

        if (turnInput !== 0) {
          let bestScore = -Infinity;
          for (const candidate of [-ENGINE_GIMBAL, ENGINE_GIMBAL]) {
            const directionX = Math.cos(baseAngle + candidate);
            const directionY = Math.sin(baseAngle + candidate);
            const torque = radiusX * directionY - radiusY * directionX;
            const score = torque * turnInput;
            if (score <= bestScore) continue;
            bestScore = score;
            gimbal = candidate;
          }
          if (bestScore > 0.1) throttle = Math.max(throttle, TURNING_THROTTLE);
          else if (throttleRequested) throttle *= 0.28;
        }

        const exhaustConfig = EXHAUST_TEXTURES[engine.type];
        if (throttle <= 0) {
          state.activation = 0;
        } else {
          const rampTime = throttle > state.activation ? exhaustConfig.rampUp : exhaustConfig.rampDown;
          const activationStep = dt / Math.max(0.01, rampTime);
          state.activation += Utils.clamp(throttle - state.activation, -activationStep, activationStep);
        }
        state.throttle = throttle;
        state.gimbal = throttle > 0 ? gimbal : 0;
        this.engineStates.set(key, state);
        if (state.activation <= 0) continue;

        const forceAngle = baseAngle + state.gimbal;
        const forceMagnitude = MODULES[engine.type].thrust * ENGINE_FORCE * state.activation;
        const forceX = Math.cos(forceAngle) * forceMagnitude;
        const forceY = Math.sin(forceAngle) * forceMagnitude;
        localForceX += forceX;
        localForceY += forceY;
        localTorque += radiusX * forceY - radiusY * forceX;
      }

      for (const key of this.engineStates.keys()) {
        if (!activeEngineKeys.has(key)) this.engineStates.delete(key);
      }

      this.thrusting = [...this.engineStates.values()].some((state) => state.throttle > 0);
      const cosine = Math.cos(this.angle);
      const sine = Math.sin(this.angle);
      const worldForceX = localForceX * cosine - localForceY * sine;
      const worldForceY = localForceX * sine + localForceY * cosine;
      this.vx += (worldForceX / massProperties.mass) * dt;
      this.vy += (worldForceY / massProperties.mass) * dt;
      this.angularVelocity += (localTorque / massProperties.inertia) * TORQUE_RESPONSE * dt;

      if (this.braking) {
        const brakeDamping = Math.pow(0.025, dt);
        this.vx *= brakeDamping;
        this.vy *= brakeDamping;
        this.angularVelocity *= Math.pow(0.02, dt);
      }

      const maxSpeed = 145 + this.stats.thrust * 28;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }
      const driftDamping = Math.pow(0.94, dt);
      this.vx *= driftDamping;
      this.vy *= driftDamping;
      this.angularVelocity *= Math.pow(turnInput === 0 ? 0.28 : 0.62, dt);
      this.angularVelocity = Utils.clamp(this.angularVelocity, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED);
      this.angle += this.angularVelocity * dt;
      if (Math.abs(this.angle) > Math.PI * 4) this.angle %= Math.PI * 2;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
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

    getLaserMount(target = this.aimWorld) {
      const laser = this.modules.find((module) => module.type === "laser");
      if (!laser) return { origin: this.localToWorld(MODULE_SIZE, 0), angle: this.angle };
      const center = this.localToWorld(laser.gx * MODULE_SIZE, laser.gy * MODULE_SIZE);
      const angle = Math.atan2(target.y - center.y, target.x - center.x);
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

    drawEngineExhaust(ctx, images, time) {
      if (!this.thrusting) return;
      for (const module of this.modules) {
        if (module.type !== "thruster" && module.type !== "booster") continue;
        const state = this.engineStates.get(engineKey(module));
        if (!state || state.throttle <= 0) continue;
        const effect = getExhaustEffect(images[`exhaust_${module.type}`]);
        if (!effect?.coreFrames.length || !effect.haloFrames.length) continue;
        const config = EXHAUST_TEXTURES[module.type];
        const enginePower = Utils.clamp(MODULES[module.type].thrust / MODULES.booster.thrust, 0, 1);
        const activation = Utils.clamp(state.activation ?? state.throttle, 0, 1);
        const minimumLength = MODULE_SIZE * (0.55 + enginePower * 0.25);
        const maximumLength = MODULE_SIZE * (1.55 + enginePower * 0.45);
        const exhaustLength = Utils.lerp(minimumLength, maximumLength, Math.pow(activation, 0.72));
        const modulePhase = Math.abs(module.gx * 3 + module.gy * 5);
        const animationTick = Math.floor(time * EXHAUST_FPS) + modulePhase;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
        ctx.rotate((Number(module.rotation) || 0) * (Math.PI / 2));
        for (let index = 0; index < config.nozzleOffsets.length; index += 1) {
          const frameIndex = (animationTick + index * 4) % EXHAUST_FRAME_COUNT;
          const haloFrame = effect.haloFrames[frameIndex];
          const coreFrame = effect.coreFrames[(frameIndex + 2) % EXHAUST_FRAME_COUNT];
          const particleSeed = modulePhase + index * 5;
          ctx.save();
          ctx.translate(config.attachmentX, config.nozzleOffsets[index]);
          ctx.rotate(state.gimbal);
          ctx.globalAlpha = activation * (0.34 + activation * 0.5);
          ctx.drawImage(
            haloFrame,
            -exhaustLength,
            -config.drawHeight / 2,
            exhaustLength,
            config.drawHeight,
          );
          drawExhaustParticles(
            ctx,
            exhaustLength,
            config.drawHeight,
            activation,
            animationTick,
            config.particleCount,
            particleSeed,
          );
          const coreLength = exhaustLength * (0.8 + activation * 0.12);
          const coreHeight = config.drawHeight * (0.32 + activation * 0.12);
          ctx.globalAlpha = activation * (0.65 + activation * 0.35);
          ctx.drawImage(coreFrame, -coreLength, -coreHeight / 2, coreLength, coreHeight);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    drawExhaust(ctx, camera, viewport, images, time = 0) {
      const center = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(this.angle);
      this.drawEngineExhaust(ctx, images, time);
      ctx.restore();
    }

    draw(ctx, camera, viewport, images, buildMode = false, buildHover = null, time = 0) {
      const center = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      const aimLocal = this.worldToLocal(this.aimWorld.x, this.aimWorld.y);
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
        const animated = drawAnimatedModule(ctx, image, module, definition, time, aimLocal);
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
        const animated = drawAnimatedModule(ctx, image, buildHover, definition, time, aimLocal, 0.52);
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
