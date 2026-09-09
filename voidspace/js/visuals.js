(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES } = VS.ModuleSystem;
  const { clamp, angleDelta } = VS.Utils;
  const MANIFEST = {
    atlas_modules: "assets/visuals/modules.png?v=20260909-04",
    atlas_turrets: "assets/visuals/turrets.png?v=20260909-04",
    atlas_exhaust: "assets/visuals/exhaust.png?v=20260909-04",
    atlas_effects: "assets/visuals/effects.png?v=20260909-04",
  };
  const BODY_TYPES = [
    "core", "computer", "hull", "beam", "cargo", "rtg",
    "laser", "drill", "thruster", "booster", "shield", "miner_hold",
    "scout_drive", "scout_array", "hauler_hold", "hauler_reactor", "corvette_armor", "corvette_shield",
    "heat_pipe", "power_bus", "battery", "heat_tank", "radiator", "coolant_pump",
    "plasma_transformer", "drill_power", "nuclear_reactor", "turbine", "ceramic_armor", "tungsten_armor",
    "ammo_store", "ammo_factory", "missile_factory", "nuclear_factory", "assembly_section", "weapon_mount",
  ];
  const TURRET_TYPES = [
    "laser", "pulse", "scout_gun", "hauler_gun", "corvette_cannon",
    "light_cannon", "medium_cannon", "heavy_cannon", "laser_turret", "turbolaser",
    "mining_missile", "swarm_launcher", "ap_launcher", "he_launcher", "emp_launcher",
    "nuclear_launcher", "tesla_coil", "thermal_rear", "thermal_rail", "thermo_resonator",
  ];
  const EFFECT_TYPES = ["spark", "ion", "plasma", "debris", "explosion", "ion_explosion", "emp", "smoke", "tracer", "bolt", "arc", "thermal"];
  const EXHAUST = {
    thruster: { offsets: [0], attachment: -14.5, height: 12, family: 0 },
    scout_drive: { offsets: [0], attachment: -14.5, height: 10, family: 0 },
    booster: { offsets: [-7.5, 7], attachment: -14.5, height: 10.5, family: 1 },
  };
  const CATEGORIES = { all: "Все модули", structure: "Корпус", flight: "Полёт", mining: "Добыча", power: "Энергия", heat: "Тепло", weapons: "Оружие", industry: "Производство" };
  const icons = new Map();
  let prepared = null;
  for (const [type, definition] of Object.entries(MODULES)) definition.visualType = type;

  function category(type) {
    const def = MODULES[type];
    if (def.weapon) return "weapons";
    if (["laser", "drill", "plasma_transformer", "drill_power", "miner_hold"].includes(type)) return "mining";
    if (def.factory || def.ammoCapacity) return "industry";
    if (def.loop || type === "radiator") return def.reactor || def.turbine ? "power" : "heat";
    if (def.thrust || ["core", "computer", "scout_array"].includes(type)) return "flight";
    if (def.energy || def.battery || type === "power_bus" || def.shield) return "power";
    return "structure";
  }
  function matches(type, filter = "all", query = "") {
    return (filter === "all" || category(type) === filter) && `${MODULES[type].name} ${MODULES[type].description}`.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"));
  }
  function surface(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }
  // The supplied raster sheets use a chroma key, decoded once during loading.
  // No per-frame pixel reads and no modification of the source assets on disk.
  function decodeKey(image) {
    const canvas = surface(image.width, image.height), ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const pixels = data.data, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const key = Math.min(r, b) - g;
      if (key > 100 && r > 130 && b > 130) pixels[i + 3] = 0;
      else if (key > 45 && r > 85 && b > 85) {
        const alpha = 1 - clamp((key - 45) / 55, 0, 1);
        pixels[i + 3] *= alpha;
        pixels[i] = Math.min(r, g + 45); pixels[i + 2] = Math.min(b, g + 65);
      }
    }
    ctx.putImageData(data, 0, 0); return canvas;
  }
  function crop(image, x, y, width, height) {
    const canvas = surface(width, height);
    canvas.getContext("2d").drawImage(image, Math.round(x), Math.round(y), Math.round(width), Math.round(height), 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  function decodeAdditive(image) {
    const canvas = surface(image.width, image.height), ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height), pixels = data.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const intensity = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (intensity <= 4) { pixels[i + 3] = 0; continue; }
      // Preserve emitted RGB energy while making the black matte truly transparent.
      pixels[i + 3] *= intensity / 255;
      pixels[i] *= 255 / intensity; pixels[i + 1] *= 255 / intensity; pixels[i + 2] *= 255 / intensity;
    }
    ctx.putImageData(data, 0, 0); return canvas;
  }
  function trim(image, luminous = false) {
    const ctx = image.getContext("2d"), { data } = ctx.getImageData(0, 0, image.width, image.height);
    let left = image.width, right = -1, top = image.height, bottom = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (data[i + 3] < (luminous ? 8 : 100)) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error("Пустая ячейка визуального атласа");
    return { image: crop(image, left, top, right - left + 1, bottom - top + 1), left, top };
  }
  function gridCell(image, index, columns, rows) {
    const x = Math.round(index % columns * image.width / columns), y = Math.round(Math.floor(index / columns) * image.height / rows);
    return crop(image, x, y, Math.round((index % columns + 1) * image.width / columns) - x, Math.round((Math.floor(index / columns) + 1) * image.height / rows) - y);
  }
  function prepare(images) {
    for (const key of Object.keys(MANIFEST)) if (!images[key]) throw new Error(`Не удалось загрузить ${MANIFEST[key]}`);
    const bodies = decodeKey(images.atlas_modules), turrets = decodeKey(images.atlas_turrets);
    images.visualBodies = {}; images.visualTurrets = {}; images.visualEffects = {}; images.visualExhaust = [[], []];
    BODY_TYPES.forEach((type, index) => { images.visualBodies[type] = trim(gridCell(bodies, index, 6, 6)).image; });
    images.visualRotors = {};
    for (const type of ["turbine", "coolant_pump"]) {
      const body = images.visualBodies[type], rotor = surface(128, 128), ctx = rotor.getContext("2d");
      ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(body, body.width * 0.21, body.height * 0.21, body.width * 0.58, body.height * 0.58, 0, 0, 128, 128);
      images.visualRotors[type] = rotor;
    }
    // Measured sprite regions and mechanical bearing centres, not an assumed uniform grid.
    const columns = [0, 307, 573, 834, 1094, 1402], rows = [0, 304, 555, 810, 1122];
    const pivotsX = [121, 390, 657, 922, 1190], pivotsY = [183, 434, 695, 953];
    TURRET_TYPES.forEach((type, index) => {
      const col = index % 5, row = Math.floor(index / 5), sx = turrets.width / 1402, sy = turrets.height / 1122;
      const part = trim(crop(turrets, columns[col] * sx, rows[row] * sy, (columns[col + 1] - columns[col]) * sx, (rows[row + 1] - rows[row]) * sy));
      images.visualTurrets[type] = { image: part.image, pivotX: (pivotsX[col] - columns[col]) * sx - part.left, pivotY: pivotsY[row] * sy - rows[row] * sy - part.top };
      if (type === "tesla_coil") { images.visualTurrets[type].pivotX = part.image.width / 2; images.visualTurrets[type].pivotY = part.image.height / 2; }
    });
    const effects = decodeAdditive(images.atlas_effects), exhaust = decodeAdditive(images.atlas_exhaust);
    EFFECT_TYPES.forEach((type, index) => { images.visualEffects[type] = gridCell(effects, index, 4, 3); });
    for (let i = 0; i < 16; i++) images.visualExhaust[Math.floor(i / 8)].push(trim(gridCell(exhaust, i, 4, 4), true).image);
    images.visualDrill = images.module_drill;
    for (const [type, def] of Object.entries(MODULES)) {
      images[`module_${type}`] = images.visualBodies[type] || images.visualBodies[def.footprint ? "assembly_section" : "weapon_mount"];
    }
    prepared = images; icons.clear();
    return images;
  }
  function aimAngle(module, aim) {
    const def = MODULES[module.type], forward = (module.rotation || 0) * Math.PI / 2;
    if (!aim || Math.hypot(aim.x - module.gx * 30, aim.y - module.gy * 30) <= 1) return forward;
    const angle = aim ? Math.atan2(aim.y - module.gy * 30, aim.x - module.gx * 30) : forward;
    const arc = module.type === "laser" ? def.attackArc : def.weapon?.arc || Math.PI / 2;
    return forward + clamp(angleDelta(forward, angle), -arc / 2, arc / 2);
  }
  function turret(ctx, images, type, x, y, angle = 0, recoil = 0) {
    const art = images.visualTurrets?.[type]; if (!art) return false;
    const scale = 23 / Math.max(1, art.image.width - art.pivotX);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.drawImage(art.image, -art.pivotX * scale - recoil, -art.pivotY * scale, art.image.width * scale, art.image.height * scale);
    ctx.restore(); return true;
  }
  function effect(ctx, images, type, x, y, size, alpha = 1, rotation = 0, height = size) {
    const image = images.visualEffects?.[type]; if (!image || alpha <= 0) return false;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha *= clamp(alpha, 0, 1);
    ctx.translate(x, y); ctx.rotate(rotation); ctx.drawImage(image, -size / 2, -height / 2, size, height); ctx.restore(); return true;
  }
  function drawCell(ctx, images, module, time = 0, aim = null, alpha = 1, ship = null) {
    if (!images.visualBodies) return false;
    const def = MODULES[module.type], body = images[`module_${module.type}`];
    const x = module.gx * 30, y = module.gy * 30, angle = (module.rotation || 0) * Math.PI / 2;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(angle);
    ctx.drawImage(body, -15, -15, 30, 30); ctx.restore();
    const state = ship?.engineering?.nodes.get(`${module.gx},${module.gy}`);
    if (images.visualRotors[module.type] && (state?.powered || (def.turbine && state?.temperature > 60))) {
      ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(time * (def.turbine ? 2.5 : -1.7));
      ctx.drawImage(images.visualRotors[module.type], -8.7, -8.7, 17.4, 17.4); ctx.restore();
    }
    if (state && (def.battery || state.job)) {
      const amount = def.battery ? state.charge / Math.max(1, ship.engineering.electricCapacity(module)) : state.job.progress / VS.EngineeringData.RECIPES[state.job.recipe].time;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = "#08121a"; ctx.fillRect(-9, 11, 18, 2);
      ctx.fillStyle = def.battery ? "#a5ddb0" : "#ebbe80"; ctx.fillRect(-9, 11, 18 * clamp(amount, 0, 1), 2); ctx.restore();
    }
    if (module.type === "drill" && images.visualDrill) {
      ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(angle);
      // Preserve the existing 15×10 conical head; project axial rotation as moving helical flutes.
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(images.visualDrill, 21, 48, 21, 14, -7.5, 9, 15, 10);
      if (ship?.activeDrills.has(`${module.gx},${module.gy}`)) {
        ctx.beginPath(); ctx.moveTo(-7.5, 9); ctx.lineTo(7.5, 9); ctx.lineTo(1, 19); ctx.lineTo(-1, 19); ctx.closePath(); ctx.clip();
        const phase = Math.floor(time * 32) / 32 * 23;
        ctx.lineWidth = 0.9;
        for (let i = -2; i < 5; i++) {
          const y0 = 8 + i * 3.5 + phase % 3.5;
          ctx.strokeStyle = "#b2c6cd"; ctx.beginPath(); ctx.moveTo(-8, y0 - 1); ctx.quadraticCurveTo(0, y0 + 3, 8, y0 - 1); ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (module.type === "laser" || (def.weapon && !def.footprint)) {
      const shot = ship?.weaponAnimation?.get(`${module.gx},${module.gy}`), age = shot ? time - shot.time : Infinity;
      const recoil = def.weapon?.recoil ? Math.max(0, 1 - age / 0.18) * Math.min(3, 0.6 + def.weapon.recoil / 100) : 0;
      const direction = aimAngle(module, aim);
      ctx.save(); ctx.globalAlpha *= alpha; turret(ctx, images, module.type, x, y, direction, recoil);
      if (age >= 0 && age < 0.12 && def.weapon?.kind !== "missile") effect(ctx, images, def.weapon.kind === "ballistic" ? "spark" : "ion", x + Math.cos(direction) * 23, y + Math.sin(direction) * 23, 12, (1 - age / 0.12) * 0.8);
      ctx.restore();
    }
    if (state?.temperature > 300) effect(ctx, images, "explosion", x, y - 3, 26 + Math.sin(time * 11 + x) * 3, 0.3);
    return true;
  }
  function drawAssemblies(ctx, images, engineering, time) {
    if (!images?.visualTurrets || !engineering) return false;
    for (const module of engineering.ship.modules) {
      const def = MODULES[module.type]; if (!def.footprint) continue;
      ctx.save(); ctx.translate(module.gx * 30, module.gy * 30); ctx.rotate((module.rotation || 0) * Math.PI / 2);
      if (module.type === "tesla_coil") {
        const art = images.visualTurrets.tesla_coil.image;
        ctx.drawImage(art, -10, -40, 80, 80);
        const charge = clamp(engineering.available(module) / def.weapon.energy, 0, 1);
        effect(ctx, images, "emp", 30, 0, 62 + Math.sin(time * 2) * 2, charge * 0.3);
      } else {
        const charge = clamp(engineering.heatAvailable(module) / def.weapon.heatCost, 0, 1);
        for (let i = 0; i < def.footprint.width; i++) {
          const id = i === 0 ? "thermal_rear" : i === def.footprint.width - 1 ? "thermo_resonator" : "thermal_rail";
          const art = images.visualTurrets[id].image;
          ctx.drawImage(art, i * 30 - 15, -29, i === def.footprint.width - 1 ? 38 : 30, 58);
          if (charge > 0) effect(ctx, images, "thermal", i * 30, 0, 33, charge * (0.22 + Math.sin(time * 4 - i * 0.4) * 0.08), 0, 17);
        }
      }
      ctx.restore();
    }
    return true;
  }
  function exhaustLength(power, activation) {
    const strength = clamp(power / MODULES.booster.thrust, 0, 1);
    return 30 * ((0.55 + strength * 0.25) + ((1.55 + strength * 0.45) - (0.55 + strength * 0.25)) * Math.pow(clamp(activation, 0, 1), 0.72));
  }
  function frameAt(time, phase = 0) { return ((Math.floor(time * 16) + phase) % 8 + 8) % 8; }
  function drawExhaust(ctx, images, ship, time) {
    if (!images.visualExhaust) return false;
    if (!ship.thrusting) return true;
    for (const module of ship.modules) {
      const config = EXHAUST[module.type]; if (!config) continue;
      const state = ship.engineStates.get(`${module.gx},${module.gy}`);
      if (!state || state.throttle <= 0 || state.activation <= 0) continue;
      const activation = clamp(state.activation, 0, 1), length = exhaustLength(MODULES[module.type].thrust, activation);
      ctx.save(); ctx.translate(module.gx * 30, module.gy * 30); ctx.rotate((module.rotation || 0) * Math.PI / 2);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha *= 0.3 + activation * 0.7;
      config.offsets.forEach((offset, i) => {
        const frame = images.visualExhaust[config.family][frameAt(time, Math.abs(module.gx * 3 + module.gy * 5) + i * 3)];
        ctx.save(); ctx.translate(config.attachment, offset); ctx.rotate(state.gimbal || 0);
        const height = config.height * (0.6 + activation * 0.4);
        ctx.drawImage(frame, -length, -height / 2, length, height); ctx.restore();
      }); ctx.restore();
    }
    return true;
  }
  function iconMarkup(definition) {
    if (!prepared) return "";
    const type = definition.visualType;
    if (!icons.has(type)) {
      const canvas = surface(96, 96), ctx = canvas.getContext("2d");
      let left = -15, right = type === "drill" ? 19 : 15, top = -15, bottom = 15;
      const head = prepared.visualTurrets[type];
      if (head) {
        const scale = 23 / Math.max(1, head.image.width - head.pivotX);
        left = Math.min(left, -head.pivotX * scale); right = Math.max(right, 23);
        top = Math.min(top, -head.pivotY * scale); bottom = Math.max(bottom, (head.image.height - head.pivotY) * scale);
      }
      const scale = Math.min(84 / (right - left), 84 / (bottom - top));
      ctx.translate(48, 48); ctx.scale(scale, scale); ctx.translate(-(left + right) / 2, -(top + bottom) / 2);
      drawCell(ctx, prepared, { type, gx: 0, gy: 0, rotation: 0 });
      if (definition.footprint) turret(ctx, prepared, type, 0, 0);
      icons.set(type, canvas.toDataURL());
    }
    return `<span class="module-art"><img src="${icons.get(type)}" alt="" decoding="async"></span>`;
  }
  VS.Visuals = { MANIFEST, BODY_TYPES, TURRET_TYPES, EFFECT_TYPES, EXHAUST, CATEGORIES, category, matches, prepare, aimAngle, drawCell, drawAssemblies, drawExhaust, exhaustLength, frameAt, effect, iconMarkup };
})();
