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
  const LASER_MUZZLE_OFFSET = 23;
  const LASER_MUZZLE_WIDTH = 10;
  const LASER_MUZZLE_LENGTH = 6;
  const BASE_MAX_SPEED = 145;
  const ENGINE_FORCE = 260;
  const CORE_MANEUVER_POWER_DIVISOR = 3;
  const CORE_RCS_FORCE =
    (ENGINE_FORCE * MODULES.thruster.thrust * MODULES.core.rcsPower) /
    CORE_MANEUVER_POWER_DIVISOR;
  const CORE_GYRO_TORQUE =
    (ENGINE_FORCE * MODULE_SIZE * MODULES.thruster.thrust * MODULES.core.gyroPower) /
    CORE_MANEUVER_POWER_DIVISOR;
  const ENGINE_GIMBAL = Math.PI / 10;
  const TURNING_THROTTLE = 0.72;
  const TORQUE_RESPONSE = 4;
  const MAX_ANGULAR_SPEED = 2.4;
  const CORE_RCS_MAX_SPEED = BASE_MAX_SPEED * MODULES.core.rcsPower;
  const CORE_GYRO_MAX_ANGULAR_SPEED = MAX_ANGULAR_SPEED * MODULES.core.gyroPower;
  const LINEAR_VELOCITY_RETENTION = 0.985;
  const ANGULAR_VELOCITY_RETENTION_IDLE = 0.58;
  const ANGULAR_VELOCITY_RETENTION_ACTIVE = 0.82;
  const MODULE_COLLISION_HALF = MODULE_SIZE / 2;
  const DRILL_TIP_OFFSET = MODULE_SIZE / 2 + 4;
  const DRILL_CONTACT_RADIUS = 5;
  const DRILL_HEAD_WIDTH = 15;
  const DRILL_HEAD_HEIGHT = 10;
  const DRILL_HEAD_TOP = 9;
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
    return Boolean(MODULES[module.type]?.thrust);
  }

  function engineKey(module) {
    return `${module.gx},${module.gy}`;
  }

  function laserAimAngle(module, aimLocal) {
    const [forwardX, forwardY] = moduleDirection(module);
    const forwardAngle = Math.atan2(forwardY, forwardX);
    const targetX = aimLocal?.x - module.gx * MODULE_SIZE;
    const targetY = aimLocal?.y - module.gy * MODULE_SIZE;
    if (!(Math.hypot(targetX, targetY) > 1)) return forwardAngle;
    const aimDelta = Utils.angleDelta(forwardAngle, Math.atan2(targetY, targetX));
    const halfArc = MODULES.laser.attackArc / 2;
    return forwardAngle + Utils.clamp(aimDelta, -halfArc, halfArc);
  }

  function drawLaserMuzzle(ctx) {
    const halfWidth = LASER_MUZZLE_WIDTH / 2;
    const front = -LASER_MUZZLE_OFFSET;
    const rear = front + LASER_MUZZLE_LENGTH;
    ctx.fillStyle = "#0b1420";
    ctx.beginPath();
    ctx.moveTo(-halfWidth + 1, front);
    ctx.lineTo(halfWidth - 1, front);
    ctx.lineTo(halfWidth, front + 1);
    ctx.lineTo(halfWidth, rear - 1);
    ctx.lineTo(halfWidth - 1, rear);
    ctx.lineTo(-halfWidth + 1, rear);
    ctx.lineTo(-halfWidth, rear - 1);
    ctx.lineTo(-halfWidth, front + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#788897";
    ctx.fillRect(-halfWidth + 1, front + 1, LASER_MUZZLE_WIDTH - 2, LASER_MUZZLE_LENGTH - 2);
    ctx.fillStyle = "#c0c9ce";
    ctx.fillRect(-halfWidth + 1, front + 1, 2, LASER_MUZZLE_LENGTH - 2);
    ctx.fillStyle = "#354553";
    ctx.fillRect(halfWidth - 3, front + 1, 2, LASER_MUZZLE_LENGTH - 2);
    ctx.fillStyle = "#050b11";
    ctx.fillRect(-2, front, 4, 2);
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
        tool: createSpriteLayer(image, { x: 24, y: 2, width: 16, height: 29 }, "muted"),
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

  function drawAnimatedModule(ctx, image, module, definition, time, aimLocal = null, alpha = 1, toolActive = true) {
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
      const turretRotation = laserAimAngle(module, aimLocal) + Math.PI / 2;
      ctx.rotate(turretRotation);
      ctx.drawImage(layers.tool, -4, -21, 8, 24);
      drawLaserMuzzle(ctx);
    } else {
      ctx.rotate(baseRotation);
      ctx.drawImage(
        layers.tool,
        -DRILL_HEAD_WIDTH / 2,
        DRILL_HEAD_TOP,
        DRILL_HEAD_WIDTH,
        DRILL_HEAD_HEIGHT,
      );
      if (!toolActive) {
        ctx.restore();
        return true;
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-DRILL_HEAD_WIDTH / 2, DRILL_HEAD_TOP);
      ctx.lineTo(DRILL_HEAD_WIDTH / 2, DRILL_HEAD_TOP);
      ctx.lineTo(1.2, DRILL_HEAD_TOP + DRILL_HEAD_HEIGHT);
      ctx.lineTo(-1.2, DRILL_HEAD_TOP + DRILL_HEAD_HEIGHT);
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const grooveOffset = (time * 18) % 4;
      for (
        let grooveY = DRILL_HEAD_TOP - 4 + grooveOffset;
        grooveY < DRILL_HEAD_TOP + DRILL_HEAD_HEIGHT;
        grooveY += 4
      ) {
        ctx.beginPath();
        ctx.moveTo(-DRILL_HEAD_WIDTH / 2, grooveY - 2);
        ctx.lineTo(DRILL_HEAD_WIDTH / 2, grooveY + 2);
        ctx.strokeStyle = "rgba(98, 226, 255, 0.72)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-DRILL_HEAD_WIDTH / 2, grooveY + 0.4);
        ctx.lineTo(DRILL_HEAD_WIDTH / 2, grooveY + 4.4);
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
      save = save && typeof save === "object" ? save : {};
      const savedModules = Array.isArray(save.modules) ? save.modules.filter((module) => module && Object.hasOwn(MODULES, module.type) && Number.isInteger(module.gx) && Number.isInteger(module.gy) && Math.abs(module.gx) <= 10 && Math.abs(module.gy) <= 10).slice(0, 64).map((module) => ({ type: module.type, gx: module.gx, gy: module.gy, rotation: Number.isFinite(module.rotation) ? ((Math.round(module.rotation) % 4) + 4) % 4 : 0 })) : [];
      const validLayout = savedModules.filter((m) => m.type === "core").length === 1 && new Set(savedModules.map((m) => `${m.gx},${m.gy}`)).size === savedModules.length;
      this.x = Number.isFinite(save.x) ? save.x : -175;
      this.y = Number.isFinite(save.y) ? save.y : 0;
      this.vx = 0;
      this.vy = 0;
      this.angle = Number.isFinite(save.angle) ? save.angle : 0;
      this.modules = validLayout
        ? savedModules
        : [
            { type: "core", gx: 0, gy: 0, rotation: 0 },
            { type: "laser", gx: 1, gy: 0, rotation: 0 },
            { type: "thruster", gx: -1, gy: 0, rotation: 0 },
          ];
      this.credits = Number.isFinite(save.credits) ? Math.max(0, save.credits) : 120;
      this.inventory = new Inventory(save.inventory || {});
      this.unlocked = new Set(Array.isArray(save.unlocked) ? save.unlocked : ["core", "laser", "thruster", "hull", "cargo"]);
      this.unlocked.add("computer");
      this.unlocked.add("pulse");
      this.shipClass = VS.Content && Object.hasOwn(VS.Content.CLASSES, save.shipClass) ? save.shipClass : "miner";
      this.inertiaDampingEnabled = save.inertiaDampingEnabled !== false;
      this.upgradeLevel = Number.isFinite(save.upgradeLevel) ? Math.max(0, Math.min(100, Math.floor(save.upgradeLevel))) : 0;
      this.stats = calculateStats(this.modules, this.upgradeLevel);
      this.hp = Number.isFinite(save.hp) ? Math.min(save.hp, this.stats.maxHp) : this.stats.maxHp;
      this.lastLaserAt = 0;
      this.collisionCooldown = 0;
      this.thrusting = false;
      this.angularVelocity = 0;
      this.engineStates = new Map();
      this.activeDrills = new Set();
      this.aimWorld = { x: this.x + MODULE_SIZE * 4, y: this.y };
    }

    recalculateStats() {
      const previousMax = this.stats.maxHp;
      this.stats = calculateStats(this.modules, this.upgradeLevel);
      if (this.stats.maxHp > previousMax) this.hp += this.stats.maxHp - previousMax;
      this.hp = Math.min(this.hp, this.stats.maxHp);
    }

    getMaxSpeed() {
      return BASE_MAX_SPEED + this.stats.thrust * 28;
    }

    canStabilize() {
      return this.modules.some((module) => module.type === "computer") && this.stats.energyUse <= this.stats.energy;
    }

    stabilizationForces(massProperties, engines) {
      const cosine = Math.cos(this.angle);
      const sine = Math.sin(this.angle);
      const target = [
        -2 * (this.vx * cosine + this.vy * sine),
        -2 * (-this.vx * sine + this.vy * cosine),
        -3 * this.angularVelocity * MODULE_SIZE,
      ];
      const actuators = engines.map((engine) => {
        const [dx, dy] = moduleDirection(engine);
        const force = MODULES[engine.type].thrust * ENGINE_FORCE;
        const torque = ((engine.gx * MODULE_SIZE - massProperties.centerX) * dy -
          (engine.gy * MODULE_SIZE - massProperties.centerY) * dx) * force;
        return { key: engineKey(engine), fx: dx * force, fy: dy * force, torque };
      });
      if (this.modules.some((module) => module.type === "core")) {
        for (const sign of [-1, 1]) {
          actuators.push({ fx: sign * CORE_RCS_FORCE, fy: 0, torque: 0 });
          actuators.push({ fx: 0, fy: sign * CORE_RCS_FORCE, torque: 0 });
          actuators.push({ fx: 0, fy: 0, torque: sign * CORE_GYRO_TORQUE });
        }
      }
      // Bounded thrust allocation accounts for each engine's direction and lever arm.
      // No velocity reset or artificial brake: only available actuators produce force.
      for (const actuator of actuators) {
        actuator.level = 0;
        actuator.vector = [actuator.fx / massProperties.mass, actuator.fy / massProperties.mass,
          actuator.torque / massProperties.inertia * TORQUE_RESPONSE * MODULE_SIZE];
      }
      const residual = [...target];
      for (let iteration = 0; iteration < 24; iteration++) {
        for (const actuator of actuators) {
          const v = actuator.vector;
          const norm = v.reduce((sum, value) => sum + value * value, 0);
          if (norm === 0) continue;
          const correction = v.reduce((sum, value, axis) => sum + value * residual[axis], 0) / norm;
          const level = Utils.clamp(actuator.level + correction, 0, 1);
          for (let axis = 0; axis < 3; axis++) residual[axis] -= v[axis] * (level - actuator.level);
          actuator.level = level;
        }
      }
      const result = { engines: new Map(), fx: 0, fy: 0, torque: 0 };
      for (const actuator of actuators) {
        if (actuator.key !== undefined) result.engines.set(actuator.key, actuator.level);
        else {
          result.fx += actuator.fx * actuator.level;
          result.fy += actuator.fy * actuator.level;
          result.torque += actuator.torque * actuator.level;
        }
      }
      return result;
    }

    update(dt, input, mouseWorld) {
      this.aimWorld = { x: mouseWorld.x, y: mouseWorld.y };
      this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);

      const turnInput =
        (input.has("KeyD") || input.has("ArrowRight") ? 1 : 0) -
        (input.has("KeyA") || input.has("ArrowLeft") ? 1 : 0);
      const longitudinalInput =
        (input.has("KeyW") || input.has("ArrowUp") ? 1 : 0) -
        (input.has("KeyS") || input.has("ArrowDown") ? 1 : 0);
      const lateralInput =
        (input.has("KeyE") ? 1 : 0) -
        (input.has("KeyQ") ? 1 : 0);
      const massProperties = calculateMassProperties(this.modules);
      const engines = this.modules.filter(isEngine);
      const manualControl = ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some((key) => input.has(key));
      const stabilization = this.inertiaDampingEnabled && this.canStabilize() && !manualControl
        ? this.stabilizationForces(massProperties, engines) : null;
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
        const translationAlignment =
          baseDirectionX * longitudinalInput + baseDirectionY * lateralInput;
        let throttle = translationAlignment > 0.5 ? Math.min(1, translationAlignment) : 0;
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
          else if (throttle > 0) throttle *= 0.28;
        }

        const exhaustConfig = EXHAUST_TEXTURES[MODULES[engine.type].baseType || engine.type];
        if (stabilization) {
          throttle = stabilization.engines.get(key) || 0;
          gimbal = 0;
          state.activation = throttle;
        } else if (throttle <= 0) {
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

      if (this.modules.some((module) => module.type === "core")) {
        const cosine = Math.cos(this.angle);
        const sine = Math.sin(this.angle);
        const localVelocityX = this.vx * cosine + this.vy * sine;
        const localVelocityY = -this.vx * sine + this.vy * cosine;
        const longitudinalHeadroom = Utils.clamp(
          1 - (localVelocityX * longitudinalInput) / CORE_RCS_MAX_SPEED,
          0,
          1,
        );
        const lateralHeadroom = Utils.clamp(
          1 - (localVelocityY * lateralInput) / CORE_RCS_MAX_SPEED,
          0,
          1,
        );
        const gyroHeadroom = Utils.clamp(
          1 - (this.angularVelocity * turnInput) / CORE_GYRO_MAX_ANGULAR_SPEED,
          0,
          1,
        );
        localForceX += longitudinalInput * CORE_RCS_FORCE * longitudinalHeadroom;
        localForceY += lateralInput * CORE_RCS_FORCE * lateralHeadroom;
        localTorque += turnInput * CORE_GYRO_TORQUE * gyroHeadroom;
      }

      if (stabilization) {
        localForceX += stabilization.fx;
        localForceY += stabilization.fy;
        localTorque += stabilization.torque;
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

      const maxSpeed = this.getMaxSpeed();
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }
      const driftDamping = Math.pow(LINEAR_VELOCITY_RETENTION, dt);
      this.vx *= driftDamping;
      this.vy *= driftDamping;
      const angularRetention = turnInput === 0 ? ANGULAR_VELOCITY_RETENTION_IDLE : ANGULAR_VELOCITY_RETENTION_ACTIVE;
      this.angularVelocity *= Math.pow(angularRetention, dt);
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

    getNearestCargoIntake(worldX, worldY) {
      const cargoModules = this.modules.filter((module) => MODULES[module.type]?.cargo && module.type !== "core");
      const intakeModules = cargoModules.length > 0
        ? cargoModules
        : this.modules.filter((module) => module.type === "core");
      let nearest = null;

      for (const module of intakeModules) {
        const point = this.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
        const distance = Math.hypot(worldX - point.x, worldY - point.y);
        if (nearest && nearest.distance <= distance) continue;
        const radiusX = point.x - this.x;
        const radiusY = point.y - this.y;
        nearest = {
          x: point.x,
          y: point.y,
          vx: this.vx - this.angularVelocity * radiusY,
          vy: this.vy + this.angularVelocity * radiusX,
          distance,
        };
      }
      return nearest;
    }

    getDrillTips() {
      const cosine = Math.cos(this.angle);
      const sine = Math.sin(this.angle);
      return this.modules
        .filter((module) => module.type === "drill")
        .map((module) => {
          const [localDirectionX, localDirectionY] = moduleDirection(module);
          const directionX = localDirectionX * cosine - localDirectionY * sine;
          const directionY = localDirectionX * sine + localDirectionY * cosine;
          const center = this.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
          return {
            key: engineKey(module),
            module,
            x: center.x + directionX * DRILL_TIP_OFFSET,
            y: center.y + directionY * DRILL_TIP_OFFSET,
            directionX,
            directionY,
            radius: DRILL_CONTACT_RADIUS,
          };
        });
    }

    getCircleCollision(worldX, worldY, radius) {
      const local = this.worldToLocal(worldX, worldY);
      const radiusSquared = radius * radius;
      let deepest = null;
      const cosine = Math.cos(this.angle);
      const sine = Math.sin(this.angle);
      const considerCollision = (module, normalLocalX, normalLocalY, penetration, contactLocalX, contactLocalY, kind) => {
        if (deepest && deepest.penetration >= penetration) return;
        const contact = this.localToWorld(contactLocalX, contactLocalY);
        deepest = {
          module,
          kind,
          normalX: normalLocalX * cosine - normalLocalY * sine,
          normalY: normalLocalX * sine + normalLocalY * cosine,
          penetration,
          contactX: contact.x,
          contactY: contact.y,
        };
      };

      for (const module of this.modules) {
        const centerX = module.gx * MODULE_SIZE;
        const centerY = module.gy * MODULE_SIZE;
        const minX = centerX - MODULE_COLLISION_HALF;
        const maxX = centerX + MODULE_COLLISION_HALF;
        const minY = centerY - MODULE_COLLISION_HALF;
        const maxY = centerY + MODULE_COLLISION_HALF;
        const closestX = Utils.clamp(local.x, minX, maxX);
        const closestY = Utils.clamp(local.y, minY, maxY);
        const offsetX = local.x - closestX;
        const offsetY = local.y - closestY;
        const distanceSquared = offsetX * offsetX + offsetY * offsetY;
        if (distanceSquared < radiusSquared) {
          if (distanceSquared > 0.0001) {
            const distance = Math.sqrt(distanceSquared);
            considerCollision(
              module,
              -offsetX / distance,
              -offsetY / distance,
              radius - distance,
              closestX,
              closestY,
              "module",
            );
          } else {
            const edges = [
              { distance: local.x - minX, normalX: 1, normalY: 0, x: minX, y: local.y },
              { distance: maxX - local.x, normalX: -1, normalY: 0, x: maxX, y: local.y },
              { distance: local.y - minY, normalX: 0, normalY: 1, x: local.x, y: minY },
              { distance: maxY - local.y, normalX: 0, normalY: -1, x: local.x, y: maxY },
            ];
            const nearestEdge = edges.reduce((nearest, edge) => edge.distance < nearest.distance ? edge : nearest);
            considerCollision(
              module,
              nearestEdge.normalX,
              nearestEdge.normalY,
              radius + nearestEdge.distance,
              nearestEdge.x,
              nearestEdge.y,
              "module",
            );
          }
        }

        if (module.type !== "drill") continue;
        const [directionX, directionY] = moduleDirection(module);
        const tipX = centerX + directionX * DRILL_TIP_OFFSET;
        const tipY = centerY + directionY * DRILL_TIP_OFFSET;
        const tipOffsetX = tipX - local.x;
        const tipOffsetY = tipY - local.y;
        const tipDistance = Math.hypot(tipOffsetX, tipOffsetY);
        const drillContactDistance = radius + DRILL_CONTACT_RADIUS;
        if (tipDistance >= drillContactDistance) continue;
        const normalLocalX = tipDistance > 0.0001 ? tipOffsetX / tipDistance : -directionX;
        const normalLocalY = tipDistance > 0.0001 ? tipOffsetY / tipDistance : -directionY;
        considerCollision(
          module,
          normalLocalX,
          normalLocalY,
          drillContactDistance - tipDistance,
          tipX,
          tipY,
          "drillTip",
        );
      }
      return deepest;
    }

    getLaserMounts(target = this.aimWorld) {
      const aimLocal = this.worldToLocal(target.x, target.y);
      return this.modules
        .filter((module) => module.type === "laser")
        .map((module) => {
          const center = this.localToWorld(module.gx * MODULE_SIZE, module.gy * MODULE_SIZE);
          const angle = this.angle + laserAimAngle(module, aimLocal);
          return {
            module,
            origin: {
              x: center.x + Math.cos(angle) * LASER_MUZZLE_OFFSET,
              y: center.y + Math.sin(angle) * LASER_MUZZLE_OFFSET,
            },
            angle,
          };
        });
    }

    addModule(type, gx, gy, rotation) {
      if (!MODULES[type] || !this.unlocked.has(type)) return { ok: false, reason: "Чертёж модуля ещё не разблокирован" };
      if (MODULES[type].shipClass && MODULES[type].shipClass !== this.shipClass) return { ok: false, reason: "Модуль предназначен для другого класса корабля" };
      if (this.modules.length >= 64 || !Number.isInteger(gx) || !Number.isInteger(gy) || Math.abs(gx) > 10 || Math.abs(gy) > 10) return { ok: false, reason: "Предел конструкции: 64 модуля, сетка 21×21" };
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
      if (this.inventory.used > stats.cargo) return { ok: false, reason: "Сначала разгрузите трюм" };
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
        if (!isEngine(module)) continue;
        const state = this.engineStates.get(engineKey(module));
        if (!state || state.throttle <= 0) continue;
        const engineType = MODULES[module.type].baseType || module.type;
        const effect = getExhaustEffect(images[`exhaust_${engineType}`]);
        if (!effect?.coreFrames.length || !effect.haloFrames.length) continue;
        const config = EXHAUST_TEXTURES[engineType];
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
        const toolActive = module.type !== "drill" || this.activeDrills.has(engineKey(module));
        const animated = drawAnimatedModule(ctx, image, module, definition, time, aimLocal, 1, toolActive);
        if (!animated) drawModuleSprite(ctx, image, definition, module.gx * MODULE_SIZE, module.gy * MODULE_SIZE, spriteRotation * (Math.PI / 2));
        if (definition.accent) {
          ctx.fillStyle = definition.accent;
          ctx.fillRect(module.gx * MODULE_SIZE - 9, module.gy * MODULE_SIZE + 11, 18, 2);
        }
        if (definition.weapon) {
          const centerX = module.gx * MODULE_SIZE;
          const centerY = module.gy * MODULE_SIZE;
          const forward = (module.rotation || 0) * Math.PI / 2;
          const arc = definition.weapon.arc || Math.PI / 2;
          const aim = forward + Utils.clamp(Utils.angleDelta(forward, Math.atan2(aimLocal.y - centerY, aimLocal.x - centerX)), -arc / 2, arc / 2);
          ctx.save();
          ctx.translate(centerX, centerY); ctx.rotate(aim);
          ctx.fillStyle = "#070f1a"; ctx.fillRect(-7, -6, 20, 12);
          ctx.fillStyle = "#667e93"; ctx.fillRect(2, -3, 17, 6);
          ctx.fillStyle = definition.accent || "#8eeaff"; ctx.fillRect(17, -3, 2, 6);
          ctx.restore();
        }
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
        const animated = drawAnimatedModule(ctx, image, buildHover, definition, time, aimLocal, 0.52, false);
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
        inertiaDampingEnabled: this.inertiaDampingEnabled,
        shipClass: this.shipClass,
      };
    }
  }

  VS.Ship = Ship;
})();
