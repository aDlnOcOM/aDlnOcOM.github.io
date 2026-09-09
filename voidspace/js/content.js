(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES, isConnected, getPlacementConflict } = VS.ModuleSystem;
  const cell = (type, gx, gy, rotation = 0) => ({ type, gx, gy, rotation });
  const variant = (base, extra) => ({ ...MODULES[base], baseType: base, art: base, ...extra });
  MODULES.pulse = variant("hull", { name: "Импульсная пушка", short: "PULSE", description: "Боевая пушка · сектор 90° · 18 урона", cost: 65, hp: 45, energyUse: 1, unlock: 0, weapon: { damage: 18, cooldown: 0.55, speed: 480, range: 650 }, accent: "#74e6ff" });
  Object.assign(MODULES, {
    miner_hold: variant("cargo", { name: "Рудный бункер", short: "ORE", description: "Шахтёр · 30 единиц руды", cost: 90, hp: 75, cargo: 30, shipClass: "miner", accent: "#76dfff" }),
    scout_drive: variant("thruster", { name: "Ионный двигатель", short: "ION", description: "Лёгкая тяга разведчика · 1,7×", cost: 100, hp: 42, energyUse: 2, thrust: 1.7, shipClass: "scout", accent: "#65f0ce" }),
    scout_array: variant("shield", { name: "Сенсорная решётка", short: "SCAN", description: "Разведчик · радар +700 м, питание +4", cost: 90, hp: 38, energyUse: 0, energy: 4, shield: 0, radar: 700, shipClass: "scout", accent: "#65f0ce" }),
    scout_gun: variant("pulse", { name: "Скорострельный излучатель", short: "RAPID", description: "Разведчик · 10 урона каждые 0,22 с", cost: 115, weapon: { damage: 10, cooldown: 0.22, speed: 620, range: 600 }, shipClass: "scout", accent: "#65f0ce" }),
    hauler_hold: variant("cargo", { name: "Контейнерный трюм", short: "HOLD", description: "Грузовик · 48 единиц груза", cost: 100, hp: 90, cargo: 48, shipClass: "hauler", accent: "#efc572" }),
    hauler_reactor: variant("rtg", { name: "Промышленный реактор", short: "REACT", description: "Грузовик · +28 энергии", cost: 160, hp: 110, energy: 28, shipClass: "hauler", accent: "#efc572" }),
    hauler_gun: variant("pulse", { name: "Оборонительная пушка", short: "GUARD", description: "Грузовик · круговой сектор · 24 урона", cost: 145, weapon: { damage: 24, cooldown: 0.8, speed: 420, range: 600, arc: Math.PI * 2 }, shipClass: "hauler", accent: "#efc572" }),
    corvette_armor: variant("hull", { name: "Композитная броня", short: "ARMOR", description: "Корвет · 190 прочности", cost: 120, hp: 190, shipClass: "corvette", accent: "#bb9bff" }),
    corvette_cannon: variant("pulse", { name: "Рельсовая пушка", short: "RAIL", description: "Корвет · 65 урона · дальность 900 м", cost: 210, energyUse: 3, weapon: { damage: 65, cooldown: 1.1, speed: 900, range: 900 }, shipClass: "corvette", accent: "#bb9bff" }),
    corvette_shield: variant("shield", { name: "Боевой экран", short: "AEGIS", description: "Корвет · 120 щита, +6 энергии", cost: 190, hp: 100, energyUse: 0, energy: 6, shield: 120, shipClass: "corvette", accent: "#bb9bff" }),
  });
  MODULES.laser.shipClass = "miner";
  MODULES.drill.shipClass = "miner";
  // Variants are registered after their bases; weapon variants share the hull art.
  for (const definition of Object.values(MODULES)) {
    if (definition.baseType === "pulse") {
      definition.art = "hull";
      definition.baseType = "hull";
      definition.sprite = MODULES.hull.sprite;
      definition.spriteCrop = MODULES.hull.spriteCrop;
    }
  }
  const common = [cell("core", 0, 0), cell("computer", 0, -1), cell("rtg", 0, 1)];
  const CLASSES = {
    miner: { name: "Шахтёр «Крот»", price: 0, colour: "#76dfff", description: "Шахтёрский лазер, бур и рудный бункер. Ваш стартовый корабль.", modules: [...common, cell("laser", 1, 0), cell("thruster", -1, 0), cell("miner_hold", 0, 2)] },
    scout: { name: "Разведчик «Стриж»", price: 450, colour: "#65f0ce", description: "Ионная тяга, дальний радар и скорострельный излучатель.", modules: [...common, cell("scout_gun", 1, 0), cell("scout_drive", -1, 0), cell("scout_array", 0, 2)] },
    hauler: { name: "Грузовик «Атлас»", price: 800, colour: "#efc572", description: "Большой трюм, промышленная энергетика и круговая оборона.", modules: [...common, cell("hauler_gun", 1, 0), cell("booster", -1, 0), cell("hauler_hold", 0, 2), cell("hauler_reactor", 1, 1)] },
    corvette: { name: "Корвет «Спектр»", price: 1300, colour: "#bb9bff", description: "Рельсовое орудие, композитная броня и боевой экран.", modules: [...common, cell("corvette_cannon", 1, 0), cell("booster", -1, 0), cell("corvette_armor", 0, 2), cell("corvette_shield", 1, 1)] },
  };
  const ENEMIES = [
    { id: "raider", name: "Налётчик", behaviour: "raider", tier: 1, reward: 65, modules: [cell("core", 0, 0), cell("pulse", 1, 0), cell("thruster", -1, 0), cell("rtg", 0, 1)] },
    { id: "sentinel", name: "Страж", behaviour: "artillery", tier: 2, reward: 140, modules: [cell("core", 0, 0), cell("corvette_cannon", 1, 0), cell("booster", -1, 0), cell("rtg", 0, 1), cell("corvette_armor", 1, 1), cell("hull", 0, -1), cell("pulse", 1, -1)] },
  ];
  function validateBlueprint(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.modules)) throw new Error("Нужен JSON-чертёж с массивом modules");
    if (raw.modules.length < 3 || raw.modules.length > 256) throw new Error("Чертёж должен содержать от 3 до 256 клеток");
    const modules = raw.modules.map((m) => {
      if (!m || !Object.hasOwn(MODULES, m.type) || !Number.isInteger(m.gx) || !Number.isInteger(m.gy) || Math.abs(m.gx) > 24 || Math.abs(m.gy) > 24 || !Number.isInteger(m.rotation) || m.rotation < 0 || m.rotation > 3) throw new Error("Неверный тип, координаты или поворот модуля");
      return { ...cell(m.type, m.gx, m.gy, m.rotation), ...(typeof m.assembly === "string" && /^-?\d+,-?\d+$/.test(m.assembly) ? { assembly: m.assembly } : {}), ...(m.overclock ? { overclock: true } : {}) };
    });
    if (modules.filter((m) => m.type === "core").length !== 1) throw new Error("Нужна ровно одна командная капсула");
    if (new Set(modules.map((m) => `${m.gx},${m.gy}`)).size !== modules.length) throw new Error("Модули перекрываются");
    for (const module of modules) {
      if (MODULES[module.type].footprint) {
        const expected = VS.ModuleSystem.assemblyCells(module);
        if (expected.some((cell) => !modules.some((m) => m.type === cell.type && m.gx === cell.gx && m.gy === cell.gy && m.rotation === cell.rotation && m.assembly === cell.assembly))) throw new Error("Составной модуль должен содержать все секции");
      }
      if (MODULES[module.type].internal && !modules.some((m) => m.assembly === module.assembly && MODULES[m.type].footprint)) throw new Error("Секция не принадлежит составному модулю");
      if (module.assembly) {
        const root = modules.find((m) => m.assembly === module.assembly && MODULES[m.type].footprint);
        if (!root || !VS.ModuleSystem.assemblyCells(root).some((m) => m.gx === module.gx && m.gy === module.gy && m.type === module.type && m.rotation === module.rotation)) throw new Error("Лишняя секция за пределами составного модуля");
      }
    }
    if (!isConnected(modules)) throw new Error("Все модули должны быть соединены");
    if (modules.some((m) => getPlacementConflict(modules.filter((other) => other !== m), m))) throw new Error("Перекрыт выхлоп двигателя или рабочая зона инструмента");
    if (!modules.some((m) => MODULES[m.type].thrust)) throw new Error("Нужен хотя бы один двигатель");
    if (!modules.some((m) => MODULES[m.type].weapon)) throw new Error("Нужно хотя бы одно боевое орудие");
    const stats = VS.ModuleSystem.calculateStats(modules);
    if (!VS.Engineering && stats.energyUse > stats.energy) throw new Error("Недостаточно энергии");
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "Новый противник";
    const id = typeof raw.id === "string" && /^[a-z0-9_-]{1,48}$/.test(raw.id) ? raw.id : `custom-${Date.now()}`;
    return { version: 1, id, name: name || "Новый противник", behaviour: raw.behaviour === "artillery" ? "artillery" : "raider", tier: Math.max(1, Math.min(8, Math.round(Number(raw.tier) || 1))), reward: Math.max(10, Math.min(500, Math.round(Number(raw.reward) || 80))), modules };
  }
  function customEnemies(storage) {
    try {
      const data = JSON.parse(storage.getItem("voidspace-enemies-v1") || "[]");
      if (!Array.isArray(data)) return [];
      return data.slice(0, 24).flatMap((raw) => { try { return [validateBlueprint(raw)]; } catch { return []; } });
    } catch { return []; }
  }
  const BIOMES = [
    { id: "haven", name: "Тихая гавань", colour: "#122f43", danger: 0, ore: "chondrite", density: 30 },
    { id: "belt", name: "Железный пояс", colour: "#423422", danger: 1, ore: "iron", density: 46 },
    { id: "ice", name: "Ледяная периферия", colour: "#184555", danger: 2, ore: "carbonaceous", density: 36 },
    { id: "nebula", name: "Ионная туманность", colour: "#402357", danger: 3, ore: "troilite", density: 30 },
    { id: "rift", name: "Платиновый разлом", colour: "#4c2034", danger: 4, ore: "pallasite", density: 42 },
  ];
  function biomeAt(x, y, seed = 1) {
    const distance = Math.hypot(x, y);
    if (distance < 1400) return BIOMES[0];
    if (distance < 2700) return BIOMES[1];
    if (distance < 5000) return BIOMES[2 + (Math.sin(Math.atan2(y, x) * 2 + seed) > 0 ? 1 : 0)];
    return BIOMES[4];
  }
  function smoothstep(from, to, value) {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }
  // Continuous spatial atmosphere; gameplay thresholds and ore distribution stay unchanged.
  function biomeBlend(x, y, seed = 1) {
    const radius = Math.hypot(x, y);
    const belt = smoothstep(1080, 1720, radius);
    const outer = smoothstep(2320, 3080, radius);
    const rift = smoothstep(4500, 5500, radius);
    const ion = smoothstep(-0.24, 0.24, Math.sin(Math.atan2(y, x) * 2 + seed));
    const weights = [(1 - belt), belt * (1 - outer), belt * outer * (1 - rift) * (1 - ion), belt * outer * (1 - rift) * ion, belt * outer * rift];
    return BIOMES.map((biome, i) => ({ ...biome, weight: weights[i] }));
  }
  VS.Content = { CLASSES, ENEMIES, BIOMES, biomeAt, biomeBlend, validateBlueprint, customEnemies };
})();
