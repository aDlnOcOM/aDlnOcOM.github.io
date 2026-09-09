(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES } = VS.ModuleSystem;
  function block(id, base, extra) {
    MODULES[id] = { ...MODULES[base], shipClass: undefined, reservedZone: undefined, baseType: base, energy: 0, energyUse: 0, cargo: 0, shield: 0,
      heatCapacity: 4, conductivity: 0.04, density: 1, strength: 10, accent: "#7cdbd4", ...extra };
  }
  block("heat_pipe", "beam", { name: "Теплопровод", short: "PIPE", description: "Быстро передаёт тепло соседним блокам; часть теплоконтура", cost: 15, hp: 30, unlock: 0, heatCapacity: 3, conductivity: 8, loop: true, glyph: "pipe" });
  block("power_bus", "beam", { name: "Энергомагистраль", short: "BUS", description: "Соединяет энергосеть; буфер 15 единиц энергии", cost: 25, hp: 38, unlock: 0, battery: 15, glyph: "bus" });
  block("battery", "cargo", { name: "Аккумулятор", short: "BAT", description: "Запасает 180 энергии; разгон увеличивает ёмкость", cost: 90, hp: 65, unlock: 0, battery: 180, heatCapacity: 8, functional: true, glyph: "battery" });
  block("heat_tank", "cargo", { name: "Теплоаккумулятор", short: "HEAT", description: "Теплоёмкость 80; запасает тепло для крупного орудия", cost: 120, hp: 100, unlock: 80, heatCapacity: 80, conductivity: 8, loop: true, glyph: "tank" });
  block("radiator", "hull", { name: "Радиатор", short: "RAD", description: "Сбрасывает тепло через открытые стороны; не замуровывать", cost: 55, hp: 50, unlock: 0, heatCapacity: 8, conductivity: 8, loop: true, radiator: 0.45, glyph: "radiator" });
  block("coolant_pump", "shield", { name: "Насос охлаждения", short: "PUMP", description: "2 энергии/с. Нужен для запуска реакторного контура", cost: 85, hp: 65, unlock: 0, energyUse: 2, heatCapacity: 8, conductivity: 8, loop: true, functional: true, glyph: "pump" });
  block("plasma_transformer", "shield", { name: "Плазма-трансформатор", short: "PLASMA", description: "Прямо за лазером: добыча ×1,5; потребляет 2 энергии/с и выделяет тепло", cost: 120, hp: 70, unlock: 80, energyUse: 2, functional: true, conductivity: 2, glyph: "transformer" });
  block("drill_power", "rtg", { name: "Дополнительная энергоустановка", short: "AUX", description: "Прямо за буром: добыча ×1,5; потребляет 2 энергии/с", cost: 125, hp: 75, unlock: 80, energyUse: 2, functional: true, conductivity: 2, glyph: "transformer" });
  block("nuclear_reactor", "rtg", { name: "Ядерный реактор", short: "FISSION", description: "Замкнутый контур, насос, 2 турбины и 2 радиатора на реактор. Перегрев: взрыв", cost: 420, hp: 160, unlock: 250, heatCapacity: 35, conductivity: 10, loop: true, functional: true, reactor: true, glyph: "reactor", accent: "#ffb96a" });
  block("turbine", "thruster", { name: "Паровая турбина", short: "TURB", description: "До 24 энергии/с от тепла запущенного реактора в том же контуре", cost: 130, hp: 85, unlock: 0, thrust: 0, heatCapacity: 14, conductivity: 8, loop: true, functional: true, turbine: true, glyph: "turbine" });
  block("ceramic_armor", "hull", { name: "Керамическая броня", short: "CER", description: "Лёгкая, жаростойкая; плохо проводит тепло и не проводит электричество", cost: 65, hp: 100, unlock: 60, density: 0.65, strength: 40, melt: 950, powerBus: false, conductivity: 0.005, glyph: "armor" });
  block("tungsten_armor", "hull", { name: "Вольфрамовая броня", short: "W", description: "Очень тяжёлая и прочная; защищает от баллистики", cost: 140, hp: 220, unlock: 180, density: 2.8, strength: 80, melt: 1100, heatCapacity: 18, glyph: "armor" });
  block("ammo_store", "cargo", { name: "Погреб боеприпасов", short: "MAG", description: "+240 мест для патронов, ракет и компонентов", cost: 95, hp: 70, unlock: 0, ammoCapacity: 240, glyph: "magazine" });
  block("ammo_factory", "cargo", { name: "Завод боеприпасов", short: "AMMO", description: "Производит лёгкие, средние и тяжёлые патроны из руды", cost: 140, hp: 85, unlock: 100, energyUse: 4, functional: true, factory: "ammo", glyph: "factory" });
  block("missile_factory", "cargo", { name: "Ракетный сборщик", short: "FAB", description: "Собирает ракетные компоненты и обычные ракеты", cost: 200, hp: 100, unlock: 150, energyUse: 6, functional: true, factory: "missile", glyph: "factory" });
  block("nuclear_factory", "rtg", { name: "Ядерный сборочный модуль", short: "NUKE FAB", description: "Из платины и редкоземов создаёт боеголовки, затем ядерные ракеты", cost: 350, hp: 100, unlock: 300, energyUse: 12, functional: true, factory: "nuclear", heatCapacity: 14, glyph: "factory", accent: "#ffb36a" });
  block("assembly_section", "hull", { name: "Секция составного орудия", short: "SECTION", description: "Часть крупной сборки; отдельно не устанавливается", cost: 0, hp: 50, unlock: 0, internal: true, conductivity: 2, heatCapacity: 5, glyph: "section" });
  function gun(id, name, weapon, extra = {}) {
    block(id, "hull", { name, short: id.toUpperCase(), description: weapon.description, cost: 160, hp: 80, unlock: 100, energyUse: weapon.energy || 0, functional: true, heatCapacity: 8, conductivity: 2, weapon, glyph: "weapon", ...extra });
  }
  gun("mining_missile", "Добывающие ракеты", { kind: "missile", ammo: "mining_rocket", mining: true, damage: 110, radius: 65, cooldown: 1.5, speed: 300, range: 800, description: "Добывающая ракета · разрушает астероиды" });
  gun("swarm_launcher", "Ракеты «Рой»", { kind: "missile", ammo: "swarm_rocket", damage: 14, count: 6, homing: 2.8, radius: 18, cooldown: 2, speed: 360, range: 900, description: "6 самонаводящихся ракет за залп; расход 6 ракет «Рой»" });
  gun("ap_launcher", "Бронебойные самонаводящиеся", { kind: "missile", ammo: "ap_rocket", damage: 95, penetration: 0.8, homing: 1.8, cooldown: 2.2, speed: 390, range: 1000, description: "Бронебойная ракета; игнорирует 80% защиты материала" });
  gun("he_launcher", "Фугасные самонаводящиеся", { kind: "missile", ammo: "he_rocket", damage: 65, radius: 90, homing: 1.4, cooldown: 2.4, speed: 310, range: 950, description: "Фугасная ракета; урон по площади, включая свой корабль" });
  gun("emp_launcher", "ЭМИ-ракеты", { kind: "missile", ammo: "emp_rocket", damage: 8, radius: 100, emp: 6, homing: 1.6, cooldown: 3, speed: 320, range: 900, description: "ЭМИ-ракета; отключает электронные модули на 6 с" });
  gun("nuclear_launcher", "Ядерная ракетная установка", { kind: "missile", ammo: "nuclear_rocket", damage: 450, radius: 240, homing: 0.7, cooldown: 7, speed: 230, range: 1400, description: "Ядерная ракета из сборщика; опасна для всех кораблей в радиусе 240 м" }, { cost: 380, unlock: 350 });
  gun("laser_turret", "Лазерная турель", { kind: "beam", energy: 9, heat: 8, damage: 15, cooldown: 0.25, range: 650, arc: Math.PI * 2, description: "Энергия 9 за импульс · круговое наведение" });
  gun("turbolaser", "Турболазерная турель", { kind: "beam", energy: 35, heat: 45, damage: 100, cooldown: 1.6, range: 900, arc: Math.PI * 2, description: "Энергия 35 за выстрел · высокое тепловыделение" }, { cost: 280, unlock: 220 });
  gun("light_cannon", "Лёгкий баллистический автомат", { kind: "ballistic", ammo: "light_ammo", recoil: 15, damage: 14, cooldown: 0.16, speed: 700, range: 700, description: "1 лёгкий патрон за выстрел · сильная отдача" });
  gun("medium_cannon", "Средняя баллистическая пушка", { kind: "ballistic", ammo: "medium_ammo", recoil: 70, damage: 55, cooldown: 0.7, speed: 850, range: 1000, description: "1 средний патрон за выстрел · сильная отдача" }, { cost: 220 });
  gun("heavy_cannon", "Тяжёлая баллистическая пушка", { kind: "ballistic", ammo: "heavy_ammo", recoil: 240, damage: 160, penetration: 0.35, cooldown: 2, speed: 1100, range: 1400, description: "1 тяжёлый патрон · огромная отдача и момент вращения" }, { cost: 330, unlock: 220 });
  gun("tesla_coil", "Катушка Тесла · 3×3", { kind: "tesla", energy: 65, heat: 75, damage: 45, emp: 4, cooldown: 2.5, range: 420, arc: Math.PI * 2, description: "Энергия 65 · цепная дуга · особенно опасна энергетическим кораблям" }, { cost: 550, unlock: 400, footprint: { width: 3, height: 3 }, heatCapacity: 25, glyph: "tesla" });
  gun("thermo_resonator", "Терморезонансное орудие · 3×16", { kind: "thermal", heatCost: 12000, damage: 700, radius: 100, cooldown: 12, speed: 650, range: 1800, description: "Расход 12 000 ед. тепла из связанного контура; сектор 15°", arc: Math.PI / 12 }, { cost: 2200, unlock: 1200, footprint: { width: 16, height: 3 }, heatCapacity: 100, conductivity: 12, loop: true, glyph: "resonator", accent: "#ffa767" });
  for (const [id, def] of Object.entries(MODULES)) {
    def.heatCapacity ??= 4 + (def.hp || 0) / 30;
    def.conductivity ??= 0.04;
    def.density ??= 1;
    def.strength ??= id.includes("armor") ? 45 : 8;
    def.melt ??= def.reactor ? 650 : 650;
    def.functional ??= Boolean(def.weapon || def.thrust || def.energy || def.energyUse || def.battery || ["laser", "drill", "computer"].includes(id));
    def.overclockable = Boolean(def.weapon || def.thrust || def.energy || def.battery || def.reactor || def.turbine || def.factory || def.shield || ["laser", "drill", "coolant_pump", "plasma_transformer", "drill_power"].includes(id));
    def.researchCost = Math.round(80 + def.cost * 1.5);
    if (def.weapon && !def.weapon.kind) def.weapon = { ...def.weapon, kind: "plasma", energy: Math.max(2, def.energyUse * 3), heat: 4 };
  }
  const STOCK = {
    light_ammo: { name: "Лёгкие патроны", price: 1 }, medium_ammo: { name: "Средние патроны", price: 4 }, heavy_ammo: { name: "Тяжёлые патроны", price: 12 },
    casing: { name: "Ракетный корпус", price: 8 }, guidance: { name: "Блок наведения", price: 14 }, explosive: { name: "Фугасный наконечник", price: 8 }, emp_core: { name: "ЭМИ-наконечник", price: 22 }, nuclear_core: { name: "Ядерная боеголовка" },
    mining_rocket: { name: "Добывающая ракета", price: 14 }, swarm_rocket: { name: "Ракета «Рой»", price: 5 }, ap_rocket: { name: "Бронебойная ракета", price: 24 }, he_rocket: { name: "Фугасная ракета", price: 26 }, emp_rocket: { name: "ЭМИ-ракета", price: 38 }, nuclear_rocket: { name: "Ядерная ракета" },
  };
  const RECIPES = {
    light_ammo: { factory: "ammo", output: 20, time: 4, ore: { feNi: 1 } },
    medium_ammo: { factory: "ammo", output: 8, time: 5, ore: { feNi: 2, sulfur: 1 } },
    heavy_ammo: { factory: "ammo", output: 3, time: 7, ore: { feNi: 3, cobalt: 1 } },
    casing: { factory: "missile", output: 3, time: 4, ore: { feNi: 2 } },
    guidance: { factory: "missile", output: 2, time: 5, ore: { silicates: 2, cobalt: 1 } },
    explosive: { factory: "missile", output: 3, time: 4, ore: { sulfur: 2, carbon: 1 } },
    emp_core: { factory: "missile", output: 1, time: 6, ore: { cobalt: 2, rareEarths: 1 } },
    mining_rocket: { factory: "missile", output: 1, time: 4, stock: { casing: 1, explosive: 1 } },
    swarm_rocket: { factory: "missile", output: 6, time: 6, stock: { casing: 2, guidance: 1, explosive: 1 } },
    ap_rocket: { factory: "missile", output: 1, time: 5, ore: { cobalt: 1 }, stock: { casing: 1, guidance: 1 } },
    he_rocket: { factory: "missile", output: 1, time: 5, stock: { casing: 1, guidance: 1, explosive: 1 } },
    emp_rocket: { factory: "missile", output: 1, time: 6, stock: { casing: 1, guidance: 1, emp_core: 1 } },
    nuclear_core: { factory: "nuclear", output: 1, time: 16, ore: { platinum: 2, rareEarths: 2 } },
    nuclear_rocket: { factory: "nuclear", output: 1, time: 12, stock: { casing: 1, guidance: 1, nuclear_core: 1 } },
  };
  function consumption(def) {
    const w = def.weapon;
    if (!w) return def.energyUse ? `${def.energyUse} энергии/с` : def.energy ? `+${def.energy} энергии/с` : def.description;
    if (w.ammo) return `${STOCK[w.ammo].name} ×${w.count || 1} / залп`;
    if (w.heatCost) return `${w.heatCost.toLocaleString("ru-RU")} тепла / выстрел`;
    return `${w.energy || 0} энергии / выстрел`;
  }
  VS.EngineeringData = { STOCK, RECIPES, consumption };
})();
