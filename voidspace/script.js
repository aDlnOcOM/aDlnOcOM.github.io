(() => {
  "use strict";

  const TILE = 16;
  const PIX = TILE / 8;
  const P = (value) => Math.max(1, Math.round(value * PIX));
  const GRID_W = 56;
  const GRID_H = 36;
  const CANVAS_W = GRID_W * TILE;
  const CANVAS_H = GRID_H * TILE;
  const SAVE_KEY = "voidspace-save-v1";
  const SAVE_VERSION = 1;
  const TAU = Math.PI * 2;
  const CATEGORY_ORDER = [
    "Каркасы", "Командование", "Экипаж", "Энергия", "Логистика", "Захват",
    "Термальные", "Обработка I", "Обработка II", "Обработка III", "Сборка",
    "Ядерные", "Вооружение", "Эндгейм"
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (array) => array[Math.floor(Math.random() * array.length)];
  const format = (value) => Math.floor(value).toLocaleString("ru-RU");
  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (() => { let id = 1; return () => id++; })();

  function hash2(x, y, seed = 1) {
    let h = Math.imul(x ^ seed, 374761393) + Math.imul(y ^ (seed * 31), 668265263);
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function rotatePoint(x, y, w, h, rotation) {
    const r = ((rotation % 4) + 4) % 4;
    if (r === 0) return { x, y };
    if (r === 1) return { x: h - 1 - y, y: x };
    if (r === 2) return { x: w - 1 - x, y: h - 1 - y };
    return { x: y, y: w - 1 - x };
  }

  function rotatedSize(w, h, rotation) {
    return rotation % 2 === 0 ? { w, h } : { w: h, h: w };
  }

  function getModuleSupportProfile(module, station = getStation()) {
    const def = MODULES[module.type];
    if (!def || !station) return { mass: 0, heatCapacity: 0, baseHp: 0, names: [] };
    const size = rotatedSize(def.w, def.h, module.rotation || 0);
    const names = new Set();
    let mass = 0, heatCapacity = 0, baseHp = 0;
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        const foundation = station.foundation[module.y + dy]?.[module.x + dx];
        const support = foundation ? STRUCTURES[foundation.type] : null;
        if (!support) continue;
        names.add(support.name);
        mass += support.mass;
        heatCapacity += support.heatCapacity;
        baseHp += support.baseHp;
      }
    }
    return { mass, heatCapacity, baseHp, names: [...names] };
  }

  function resource(name, short, color, category, description) {
    return { name, short, color, category, description };
  }

  const RESOURCES = {
    kamacite: resource("Руда камасита", "Ka", "#b7b9bd", "Сырьё", "Железо-никелевый метеоритный сплав. Основа ранней металлургии."),
    taenite: resource("Руда тэнита", "Ta", "#dad3bb", "Сырьё", "Никельсодержащая фаза метеоритного железа для прочных сплавов."),
    troilite: resource("Руда троилита", "Tr", "#9b7355", "Сырьё", "Сульфидное сырьё для железа и сернистых катализаторов."),
    ilmenite: resource("Руда ильменита", "Il", "#7a717e", "Сырьё", "Титансодержащее сырьё для лёгких и тяжёлых конструкций."),
    scheelite: resource("Руда шеелита", "W", "#e5c66a", "Сырьё", "Главный источник вольфрама и бронебойных сердечников."),
    bornite: resource("Руда борнита", "Cu", "#ba5f55", "Сырьё", "Медно-сульфидное сырьё для проводки и кабельных жил."),
    olivine: resource("Минерал оливин", "Ol", "#829a54", "Сырьё", "Силикатное сырьё для керамики, кремния и синтетических алмазов."),
    pyroxene: resource("Минерал пироксен", "Px", "#687b58", "Сырьё", "Плотный силикат для стекла, керамики и углеродных матриц."),
    nasturan: resource("Руда настурана", "U", "#85b34e", "Сырьё", "Радиоактивное сырьё. Требует защищённой технологической линии."),
    chondriteGas: resource("Летучие хондритов", "Ch", "#8dc7dc", "Сырьё", "Смесь воды, углерода и лёгких летучих компонентов, извлечённых из хондритов."),
    regolithGas: resource("Летучие реголита", "Rg", "#b09ab7", "Сырьё", "Разреженная смесь газов и углеродистых включений из реголита."),
    magnetite: resource("Руда магнетита", "Fe", "#55616d", "Сырьё", "Дополнительное реалистичное железное сырьё из дифференцированных астероидов."),
    chromite: resource("Руда хромита", "Cr", "#4e5a5d", "Сырьё", "Реалистичное хромовое сырьё для жаропрочных и сверхпрочных сплавов."),
    zircon: resource("Минерал циркон", "Zr", "#88a8b7", "Сырьё", "Реалистичный источник циркония для керамики и оболочек топливных ячеек."),

    crushedFerrous: resource("Дроблёная железо-никелевая руда", "Fe+", "#8f989e", "Полуфабрикаты", "Смесь после грубого дробления камасита, тэнита или магнетита."),
    crushedTroilite: resource("Дроблёная руда троилита", "Tr+", "#8b6249", "Полуфабрикаты", "Подготовленный сульфидный материал."),
    crushedIlmenite: resource("Дроблёная руда ильменита", "Il+", "#675f6b", "Полуфабрикаты", "Подготовленное титановое сырьё."),
    crushedScheelite: resource("Дроблёная руда шеелита", "W+", "#c9a94d", "Полуфабрикаты", "Первая ступень вольфрамовой цепочки."),
    crushedBornite: resource("Дроблёная руда борнита", "Cu+", "#9d4c45", "Полуфабрикаты", "Медный концентрат до химического разделения."),
    crushedSilicate: resource("Измельчённые силикаты", "Si+", "#779070", "Полуфабрикаты", "Оливин, пироксен и кварцевые включения после измельчения."),
    crushedNasturan: resource("Дроблёная руда настурана", "U+", "#6f9a3d", "Полуфабрикаты", "Радиоактивная руда после закрытого дробления."),
    crushedChromite: resource("Дроблёная руда хромита", "Cr+", "#485256", "Полуфабрикаты", "Материал для хромового концентрата."),
    crushedZircon: resource("Измельчённый циркон", "Zr+", "#7895a1", "Полуфабрикаты", "Сырьё для циркониевой керамики."),
    ferrousConcentrate: resource("Железо-никелевый концентрат", "FeC", "#a7aeb2", "Полуфабрикаты", "Очищенная смесь для выплавки стали."),
    titaniumConcentrate: resource("Титановый концентрат", "TiC", "#867c8b", "Полуфабрикаты", "Очищенная титановая фракция."),
    tungstenSuspension: resource("Взвесь вольфрама", "WS", "#d1b05a", "Полуфабрикаты", "Тонкая вольфрамовая фракция для термической экстракции."),
    copperConcentrate: resource("Медный концентрат", "CuC", "#c67058", "Полуфабрикаты", "Очищенная медная фракция."),
    chromiumConcentrate: resource("Хромовый концентрат", "CrC", "#667276", "Полуфабрикаты", "Компонент жаропрочных сплавов."),
    uraniumConcentrate: resource("Урановый концентрат", "UC", "#8dae50", "Ядерные", "Условный концентрат для игровой изотопной линии."),
    thoriumIsotopes: resource("Ториевые изотопы", "Th", "#9ab083", "Ядерные", "Редкий изотопный материал для долговечных топливных ячеек."),
    americiumIsotopes: resource("Америциевые изотопы", "Am", "#d0dd76", "Ядерные", "Высокоэнергетический радиоизотопный материал для РИТЭГов."),
    plutoniumIsotopes: resource("Плутониевые изотопы", "Pu", "#8dcc6b", "Ядерные", "Поздний делящийся материал, представленный в абстрактном игровом виде."),
    uraniumIsotopes: resource("Разделённые изотопы урана", "U-i", "#a7cf4f", "Ядерные", "Результат абстрактного изотопного разделения."),
    depletedUranium: resource("Обеднённый уран", "DU", "#62794b", "Ядерные", "Плотный побочный продукт для экранирования и сердечников."),
    decayProducts: resource("Продукты распада", "Dcy", "#736c82", "Ядерные", "Смесь долгоживущих изотопов для камеры ускорения распада."),

    steelIngots: resource("Стальные слитки", "St", "#a9b4bc", "Металлы", "Базовый конструкционный металл."),
    steelFrames: resource("Стальные каркасы", "StF", "#93a3ad", "Конструкции", "Несущие каркасы стартовой станции."),
    heavySteel: resource("Тяжёлые стальные конструкции", "HSt", "#7c8992", "Конструкции", "Усиленные силовые элементы."),
    sulfurCatalyst: resource("Сульфидные катализаторы", "SC", "#b99949", "Химия", "Катализаторы химических и ядерных линий."),
    titaniumIngots: resource("Титановые слитки", "Ti", "#a9a3b5", "Металлы", "Лёгкий жаропрочный металл."),
    titaniumPlates: resource("Титановые пластины", "TiP", "#bbb5c7", "Конструкции", "Пластины для брони и машин."),
    titaniumLight: resource("Титановые облегчённые конструкции", "TiL", "#c1becd", "Конструкции", "Прочные элементы с низкой массой."),
    titaniumHeavy: resource("Титановые тяжёлые конструкции", "TiH", "#8e889c", "Конструкции", "Массивные силовые элементы."),
    titaniumComposite: resource("Титановые композиты", "TiC", "#9c90ac", "Конструкции", "Титан, связанный углеродным волокном."),
    titaniumArmor: resource("Титановые бронепластины", "TiA", "#7d778d", "Трофеи", "Усиленная броня, часто добываемая из тяжёлых врагов."),
    tungstenDust: resource("Вольфрамовая пыль", "Wd", "#bda45e", "Металлы", "Тонкий вольфрамовый порошок."),
    tungstenRebar: resource("Вольфрамовая арматура", "Wr", "#c7ae68", "Конструкции", "Усиление для тяжёлых каркасов."),
    tungstenPanels: resource("Вольфрамовые панели", "Wp", "#ad9657", "Конструкции", "Теплостойкие и радиационно-защитные панели."),
    apCores: resource("Бронебойные сердечники", "AP", "#dfc25e", "Боеприпасы", "Плотные сердечники для кинетического вооружения."),
    superalloy: resource("Сверхпрочные сплавы", "SA", "#d0c7b2", "Металлы", "Хромо-титано-вольфрамовая конструкционная система."),
    copperIngots: resource("Медные слитки", "Cu", "#d1785d", "Металлы", "Базовый проводящий металл."),
    copperWire: resource("Медная проводка", "CW", "#dc8c6c", "Электроника", "Проводка ранних энергетических сетей."),
    cableCores: resource("Кабельные жилы", "CC", "#f09a72", "Электроника", "Многожильные проводники для мощных модулей."),
    purifiedSilicon: resource("Очищенный кремний", "Si", "#b4bac8", "Электроника", "Полупроводниковый материал."),
    siliconPlates: resource("Кремниевые пластины", "SiP", "#b7c1d1", "Электроника", "Электронные пластины и частый трофей с врагов."),
    quartzGlass: resource("Кварцевое стекло", "QG", "#9fd8dc", "Оптика", "Жаростойкое стекло для оптики и реакторов."),
    superconductors: resource("Сверхпроводники", "SCp", "#70d6e4", "Электроника", "Проводники поздней энергетики и квантовых систем."),
    ceramicInsulators: resource("Керамические изоляторы", "Cer", "#d7c9ad", "Конструкции", "Тепло- и электроизоляция."),
    zirconiumCeramic: resource("Циркониевая керамика", "ZrC", "#aac8d0", "Конструкции", "Радиационно-стойкая керамика для топливных ячеек."),
    carbonBlack: resource("Технический углерод", "Cb", "#4e5761", "Химия", "Углеродный наполнитель и сырьё волокон."),
    carbonFiber: resource("Углеродные волокна", "Cf", "#5f6971", "Конструкции", "Лёгкое армирующее волокно."),
    compositeStructures: resource("Композитные конструкции", "Cmp", "#7b8790", "Конструкции", "Лёгкие многослойные элементы, также встречаются в трофеях."),
    incendiaryCores: resource("Зажигательные сердечники", "Inc", "#ef7d42", "Боеприпасы", "Термальные боеприпасы."),
    purifiedWater: resource("Очищенная вода", "H₂O", "#69bde0", "Жидкости", "Жизнеобеспечение и охлаждение."),
    coolantCapsules: resource("Капсулы охладителя", "Cry", "#5fe1ff", "Жидкости", "Плотные контейнеры хладагента."),
    polymerMatrix: resource("Полимерные матрицы", "Pol", "#d66bc5", "Химия", "Связующее композитов и ракетных систем."),
    diamonds: resource("Технические алмазы", "Dia", "#d6fbff", "Оптика", "Синтетические кристаллы из сжатых силикатов для мазеров, лазеров и квантовой оптики."),
    enrichedUranium: resource("Обогащённый уран", "U*", "#b6e55d", "Ядерные", "Абстрактный игровой делящийся материал."),
    fuelRods: resource("Топливные стержни", "FR", "#c9df73", "Ядерные", "Промежуточный ядерный компонент."),
    uraniumCell: resource("Урановая топливная ячейка", "U-Cell", "#b4d45b", "Ядерные", "Высокая мощность и высокая тепловая нагрузка."),
    thoriumCell: resource("Ториевая топливная ячейка", "Th-Cell", "#a8bf93", "Ядерные", "Долгая работа при умеренной мощности."),
    americiumCell: resource("Америциевая РИТЭГ-ячейка", "Am-Cell", "#d8e786", "Ядерные", "Малая, но очень стабильная мощность."),
    radioactiveCapsules: resource("Радиоактивные капсулы", "Rad", "#a8d755", "Ядерные", "Экранированные радиоизотопные источники."),
    nuclearCharges: resource("Ядерные заряды", "N", "#d9ed77", "Боеприпасы", "Условные игровые заряды различной мощности."),
    antimatterCapsules: resource("Капсулы антиматерии", "AM", "#ff61d5", "Эндгейм", "Крайне дорогой источник энергии и боеприпасов."),
    zeroPointCells: resource("Ячейки нулевой точки", "ZP", "#9d8cff", "Эндгейм", "Квантовый тепловой резерв и источник для оружия нулевой точки.")
  };

  const DEFAULT_INVENTORY = {
    kamacite: 90, taenite: 45, troilite: 35, ilmenite: 34, scheelite: 24, bornite: 58,
    olivine: 42, pyroxene: 42, nasturan: 10, chondriteGas: 45, regolithGas: 35,
    magnetite: 50, chromite: 18, zircon: 16,
    steelIngots: 150, steelFrames: 260, heavySteel: 22, sulfurCatalyst: 14,
    titaniumIngots: 30, titaniumPlates: 28, titaniumLight: 12, titaniumHeavy: 8,
    titaniumComposite: 5, tungstenDust: 12, tungstenRebar: 5, tungstenPanels: 3,
    apCores: 10, superalloy: 4, copperIngots: 110, copperWire: 180, cableCores: 55,
    purifiedSilicon: 45, siliconPlates: 35, quartzGlass: 24, superconductors: 12,
    ceramicInsulators: 30, carbonBlack: 28, carbonFiber: 14, compositeStructures: 18,
    incendiaryCores: 8, purifiedWater: 80, coolantCapsules: 45, polymerMatrix: 30,
    enrichedUranium: 0, fuelRods: 0, radioactiveCapsules: 2, nuclearCharges: 0,
    diamonds: 0, uraniumCell: 0, thoriumCell: 0, americiumCell: 1,
    antimatterCapsules: 0, zeroPointCells: 0
  };

  function structureDef(name, symbol, color, baseHp, mass, heatCapacity, cost, tech, description) {
    return { kind: "structure", category: "Каркасы", name, symbol, color, baseHp, mass, heatCapacity, cost, tech, description, w: 1, h: 1 };
  }

  const STRUCTURES = {
    steelStructure: structureDef("Стальная конструкция", "S", "#637482", 120, 8, 18, { steelFrames: 2 }, null,
      "Стартовый несущий тайл. Модуль получает его базовую прочность, массу и теплоёмкость."),
    titaniumStructure: structureDef("Титановая конструкция", "T", "#8d879b", 230, 5, 24, { titaniumLight: 2, titaniumPlates: 1 }, "reinforcedFrames",
      "Прочнее и легче стали; передаёт модулю больший запас здоровья."),
    compositeStructure: structureDef("Композитная конструкция", "C", "#60727d", 320, 3, 28, { compositeStructures: 2, titaniumComposite: 1 }, "compositeArchitecture",
      "Лёгкий многослойный каркас с высокой теплоёмкостью."),
    tungstenStructure: structureDef("Сверхпрочная конструкция", "W", "#9f8954", 460, 13, 34, { superalloy: 2, tungstenRebar: 2, tungstenPanels: 1 }, "compositeArchitecture",
      "Тяжёлый эндгейм-каркас для реакторов, рельсотронов и критических отсеков.")
  };

  function moduleDef(name, category, w, h, symbol, cost, options = {}) {
    return {
      kind: options.kind || "utility",
      name, category, w, h, symbol, cost,
      hp: options.hp ?? 100,
      mass: options.mass ?? w * h * 4,
      energyUse: options.energyUse ?? 0,
      energyOutput: options.energyOutput ?? 0,
      heatGen: options.heatGen ?? 0,
      cooling: options.cooling ?? 0,
      crew: options.crew ?? 0,
      beds: options.beds ?? 0,
      lifeSupport: options.lifeSupport ?? 0,
      storage: options.storage ?? 0,
      tech: options.tech ?? null,
      protected: options.protected ?? false,
      edgeRequired: options.edgeRequired ?? false,
      processorStages: options.processorStages || [],
      logistics: options.logistics ?? false,
      collector: options.collector || null,
      weapon: options.weapon || null,
      fuel: options.fuel || null,
      radiation: options.radiation ?? 0,
      shielding: options.shielding ?? 0,
      powerStorage: options.powerStorage ?? 0,
      thermalStorage: options.thermalStorage ?? 0,
      unique: options.unique ?? false,
      description: options.description || ""
    };
  }

  const MODULES = {
    fusionReactor: moduleDef("Термоядерный реактор", "Командование", 3, 3, "◎",
      { heavySteel: 220, titaniumHeavy: 120, superconductors: 80, diamonds: 40, superalloy: 60 },
      { kind: "generator", hp: 900, mass: 160, energyOutput: 480, heatGen: 34, crew: 3, tech: "orbitalFabrication", unique: true,
        description: "Сердце станции. Его разрушение означает гибель станции. Новые реакторы печатаются только в эндгейме." }),
    bridge: moduleDef("Мостик", "Командование", 2, 2, "⌂", { steelFrames: 18, siliconPlates: 8, copperWire: 16 },
      { kind: "core", hp: 260, energyUse: 8, heatGen: 2, crew: 3, unique: true, description: "Управление станцией, наведением и распределением рабочих смен." }),
    crewBunk: moduleDef("Каюты экипажа", "Экипаж", 2, 2, "▥", { steelFrames: 12, purifiedWater: 6, polymerMatrix: 4 },
      { kind: "crew", hp: 150, energyUse: 3, crew: 0, beds: 6, description: "Шесть спальных мест. Разрушение жилого отсека может привести к потерям экипажа." }),
    crewCommons: moduleDef("Кают-компания", "Экипаж", 2, 2, "☕", { steelFrames: 14, polymerMatrix: 8, purifiedWater: 8 },
      { kind: "crew", hp: 150, energyUse: 5, crew: 1, tech: "crewExpansion", description: "Снижает усталость и повышает эффективность экипажа." }),
    lifeSupport: moduleDef("Отсек жизнеобеспечения", "Экипаж", 2, 2, "O₂", { steelFrames: 16, copperWire: 10, purifiedWater: 12, ceramicInsulators: 4 },
      { kind: "crew", hp: 170, energyUse: 12, heatGen: 2, crew: 1, lifeSupport: 12, description: "Поддерживает атмосферу и воду для двенадцати членов экипажа." }),
    rescueDock: moduleDef("Аварийный шлюз", "Экипаж", 2, 1, "⇥", { steelFrames: 12, titaniumPlates: 4, copperWire: 8 },
      { kind: "crew", hp: 180, energyUse: 4, crew: 1, edgeRequired: true, tech: "crewExpansion", description: "Безопасно принимает спасательные капсулы и аварийные корабли." }),

    rtg: moduleDef("РИТЭГ", "Энергия", 1, 1, "R", { steelFrames: 6, tungstenPanels: 1, ceramicInsulators: 3, americiumCell: 1 },
      { kind: "generator", hp: 135, energyOutput: 42, heatGen: 5, radiation: 0.4, fuel: { key: "americiumCell", duration: 420 }, tech: "nuclearPhysics", description: "Малая стабильная мощность от радиоизотопной ячейки." }),
    powerNode: moduleDef("Энергетический узел", "Энергия", 1, 1, "◇", { steelFrames: 3, copperWire: 8, ceramicInsulators: 2 },
      { kind: "power", hp: 105, energyUse: 1, tech: "energyDiversification", description: "Увеличивает пропускную способность энергосети и снижает потери." }),
    solarConcentrator: moduleDef("Солнечный концентратор", "Энергия", 2, 2, "☼", { steelFrames: 14, quartzGlass: 12, copperWire: 18 },
      { kind: "generator", hp: 150, energyOutput: 84, heatGen: 5, crew: 1, edgeRequired: true, tech: "energyDiversification", description: "Собирает излучение аккреционного диска чёрной дыры." }),
    mhdGenerator: moduleDef("МГД-генератор", "Энергия", 2, 2, "M", { titaniumPlates: 12, copperWire: 20, ceramicInsulators: 8 },
      { kind: "generator", hp: 185, energyOutput: 118, heatGen: 14, crew: 1, tech: "energyDiversification", description: "Извлекает энергию из движущейся ионизированной рабочей среды." }),
    tidalInductor: moduleDef("Приливный индуктор", "Энергия", 3, 2, "∿", { heavySteel: 18, cableCores: 18, superconductors: 6 },
      { kind: "generator", hp: 260, energyOutput: 155, heatGen: 12, crew: 2, tech: "superconductingGrid", description: "Использует градиент гравитации на орбите для индукции энергии." }),
    neutrinoHarvester: moduleDef("Нейтринный сборщик", "Энергия", 2, 2, "ν", { titaniumLight: 12, siliconPlates: 16, diamonds: 4 },
      { kind: "generator", hp: 150, energyOutput: 96, heatGen: 4, crew: 1, tech: "diamondCompression", description: "Стабильный слабый источник энергии, почти не зависящий от ориентации станции." }),
    flywheel: moduleDef("Сверхпроводящий маховик", "Энергия", 2, 2, "↻", { titaniumHeavy: 12, superconductors: 14, ceramicInsulators: 8 },
      { kind: "battery", hp: 220, energyUse: 2, powerStorage: 340, heatGen: 1, crew: 1, tech: "superconductingGrid", description: "Буферизует импульсные нагрузки турелей и производственных линий." }),
    casimirConverter: moduleDef("Конвертер вакуума Казимира", "Энергия", 2, 2, "∅", { superalloy: 16, diamonds: 12, superconductors: 24, zeroPointCells: 2 },
      { kind: "generator", hp: 240, energyOutput: 250, heatGen: -3, crew: 2, tech: "zeroPoint", description: "Поздний источник энергии и отрицательной тепловой нагрузки." }),
    fissionReactor: moduleDef("Ядерный реактор", "Ядерные", 3, 2, "☢", { titaniumHeavy: 24, tungstenPanels: 14, zirconiumCeramic: 16, superconductors: 10 },
      { kind: "generator", hp: 440, energyOutput: 290, heatGen: 32, crew: 3, radiation: 2.8, fuel: { key: "uraniumCell", duration: 210 }, tech: "isotopeEngineering", description: "Мощный реактор на сменных ядерных ячейках. Требует охлаждения и экранирования." }),
    antimatterReactor: moduleDef("Реактор на антиматерии", "Эндгейм", 3, 3, "A", { superalloy: 60, superconductors: 70, diamonds: 35, tungstenPanels: 30, antimatterCapsules: 2 },
      { kind: "generator", hp: 700, energyOutput: 980, heatGen: 58, crew: 4, radiation: 1, fuel: { key: "antimatterCapsules", duration: 300 }, tech: "antimatter", description: "Почти эндгейм-источник колоссальной мощности." }),

    conveyorMechanical: moduleDef("Механический конвейер", "Логистика", 1, 1, "→", { steelFrames: 1 },
      { kind: "logistics", hp: 70, logistics: true, description: "Не требует энергии, но добавляет механическую нагрузку и малую пропускную способность." }),
    conveyorElectric: moduleDef("Электрический конвейер", "Логистика", 1, 1, "⇒", { steelFrames: 1, copperWire: 2 },
      { kind: "logistics", hp: 75, energyUse: 1, logistics: true, tech: "energyDiversification", description: "Быстрый конвейер общего назначения." }),
    vacuumTube: moduleDef("Вакуумная труба", "Логистика", 1, 1, "○", { titaniumLight: 1, quartzGlass: 1, polymerMatrix: 1 },
      { kind: "logistics", hp: 90, energyUse: 2, logistics: true, tech: "magneticLogistics", description: "Герметичная транспортировка жидкостей, газов и сыпучих материалов." }),
    magneticConveyor: moduleDef("Магнитный конвейер", "Логистика", 1, 1, "⇉", { titaniumLight: 1, superconductors: 1 },
      { kind: "logistics", hp: 95, energyUse: 3, logistics: true, tech: "magneticLogistics", description: "Высокая пропускная способность для металлов и контейнеров." }),
    router: moduleDef("Маршрутизатор", "Логистика", 1, 1, "Y", { steelFrames: 2, copperWire: 3, siliconPlates: 1 },
      { kind: "logistics", hp: 85, energyUse: 1, logistics: true, tech: "energyDiversification", description: "Принимает поток с одной стороны и по очереди раздаёт налево, направо и прямо." }),
    sorter: moduleDef("Сортировщик", "Логистика", 1, 1, "S", { steelFrames: 2, copperWire: 4, siliconPlates: 2 },
      { kind: "logistics", hp: 90, energyUse: 2, crew: 1, logistics: true, tech: "chemicalSeparation", description: "Фильтрует ресурсы в логистической сети." }),
    cargo2: moduleDef("Грузовой модуль 2×2", "Логистика", 2, 2, "□", { steelFrames: 16, titaniumPlates: 4 },
      { kind: "storage", hp: 190, storage: 100, logistics: true, description: "Хранит условно 100 элементов." }),
    cargo3: moduleDef("Грузовой модуль 3×3", "Логистика", 3, 3, "▣", { steelFrames: 34, titaniumPlates: 14, compositeStructures: 5 },
      { kind: "storage", hp: 330, storage: 275, logistics: true, tech: "magneticLogistics", description: "Хранит условно 275 элементов и эффективнее использует площадь." }),

    manipulatorMechanical: moduleDef("Механический манипулятор", "Захват", 1, 1, "⌁", { steelFrames: 3, copperWire: 1 },
      { kind: "collector", hp: 95, crew: 1, edgeRequired: true, collector: { range: 52, speed: 26 }, logistics: true, description: "Втягивает близкие обломки. Требует оператора и имеет малую скорость." }),
    manipulatorElectric: moduleDef("Электрический манипулятор", "Захват", 1, 1, "⌁", { steelFrames: 3, copperWire: 5, siliconPlates: 1 },
      { kind: "collector", hp: 100, energyUse: 3, crew: 1, edgeRequired: true, collector: { range: 64, speed: 38 }, logistics: true, tech: "energyDiversification", description: "Ускоренный захват обломков." }),
    manipulatorVacuum: moduleDef("Вакуумный манипулятор", "Захват", 2, 1, "V", { titaniumLight: 6, polymerMatrix: 4, quartzGlass: 3 },
      { kind: "collector", hp: 145, energyUse: 6, crew: 1, edgeRequired: true, collector: { range: 78, speed: 52 }, logistics: true, tech: "chemicalSeparation", description: "Создаёт направленный поток для мелких фрагментов и газовых контейнеров." }),
    manipulatorElectromagnetic: moduleDef("Электромагнитный манипулятор", "Захват", 2, 1, "E", { titaniumLight: 7, superconductors: 5, cableCores: 6 },
      { kind: "collector", hp: 165, energyUse: 12, heatGen: 3, crew: 1, edgeRequired: true, collector: { range: 96, speed: 70 }, logistics: true, tech: "superconductingGrid", description: "Дальнобойный захват металлических обломков." }),
    plasmaAttractor: moduleDef("Плазменный аттрактор", "Захват", 2, 2, "P", { superalloy: 8, superconductors: 12, diamonds: 5, coolantCapsules: 8 },
      { kind: "collector", hp: 210, energyUse: 28, heatGen: 12, crew: 2, edgeRequired: true, collector: { range: 132, speed: 105 }, logistics: true, tech: "highEnergyWeapons", description: "Эндгейм-захват тяжёлых и горячих фрагментов." }),

    heatPipe: moduleDef("Термопровод", "Термальные", 1, 1, "≈", { steelFrames: 1, copperIngots: 2 },
      { kind: "thermal", hp: 95, thermalStorage: 25, description: "Ускоряет локальное распределение теплоты между соседними модулями." }),
    radiator: moduleDef("Радиатор", "Термальные", 1, 2, "Ψ", { steelFrames: 5, copperIngots: 6 },
      { kind: "thermal", hp: 115, cooling: 16, edgeRequired: true, description: "Отводит тепло в космос. Эффективен только на краю станции." }),
    directionalRadiator: moduleDef("Направленный радиатор", "Термальные", 1, 3, "⇧", { titaniumLight: 9, copperIngots: 10, ceramicInsulators: 5 },
      { kind: "thermal", hp: 160, cooling: 34, energyUse: 2, edgeRequired: true, tech: "thermalDistribution", description: "Мощный радиатор с управляемым направлением излучения." }),
    thermalBattery: moduleDef("Термическая батарея", "Термальные", 2, 2, "▧", { heavySteel: 10, ceramicInsulators: 10, carbonFiber: 6 },
      { kind: "thermal", hp: 240, thermalStorage: 320, tech: "thermalDistribution", description: "Накапливает теплоту для сглаживания пиков и питания термального оружия." }),
    quantumHeatSink: moduleDef("Поглотитель нулевой точки", "Эндгейм", 2, 2, "∇", { superalloy: 12, diamonds: 10, superconductors: 18, zeroPointCells: 2 },
      { kind: "thermal", hp: 240, cooling: 75, energyUse: 18, heatGen: -8, tech: "zeroPoint", description: "Переводит часть теплоты в квантовый резерв нулевой точки." }),

    crusher1: moduleDef("Дробилка I", "Обработка I", 2, 2, "C1", { steelFrames: 12, copperWire: 6 },
      { kind: "processor", hp: 170, energyUse: 10, heatGen: 4, crew: 2, processorStages: [1], description: "Грубое дробление астероидной руды." }),
    crusher2: moduleDef("Дробилка II", "Обработка I", 2, 2, "C2", { titaniumPlates: 12, steelFrames: 10, cableCores: 8 },
      { kind: "processor", hp: 220, energyUse: 18, heatGen: 7, crew: 2, processorStages: [1], tech: "improvedCrushing", description: "Быстрее и экономичнее перерабатывает крупные фрагменты." }),
    crusher3: moduleDef("Дробилка III", "Обработка I", 3, 2, "C3", { titaniumHeavy: 14, tungstenRebar: 8, superconductors: 5 },
      { kind: "processor", hp: 330, energyUse: 32, heatGen: 12, crew: 3, processorStages: [1], tech: "advancedFurnaces", description: "Тяжёлая промышленная дробилка поздней игры." }),
    separator1: moduleDef("Сепаратор I", "Обработка I", 2, 2, "S1", { steelFrames: 10, copperWire: 8, siliconPlates: 2 },
      { kind: "processor", hp: 150, energyUse: 12, heatGen: 3, crew: 2, processorStages: [2], tech: "improvedCrushing", description: "Базовое разделение дроблёных фракций." }),
    separator2: moduleDef("Сепаратор II", "Обработка I", 2, 2, "S2", { titaniumPlates: 10, cableCores: 10, siliconPlates: 6 },
      { kind: "processor", hp: 195, energyUse: 21, heatGen: 5, crew: 2, processorStages: [2], tech: "chemicalSeparation", description: "Точная магнитная и плотностная сепарация." }),
    separator3: moduleDef("Сепаратор III", "Обработка I", 3, 2, "S3", { titaniumHeavy: 12, superconductors: 8, diamonds: 2 },
      { kind: "processor", hp: 285, energyUse: 35, heatGen: 9, crew: 3, processorStages: [2], tech: "superconductingGrid", description: "Квантово-магнитное разделение редких фракций." }),
    grinder: moduleDef("Измельчитель", "Обработка II", 2, 2, "G", { steelFrames: 10, copperWire: 8, ceramicInsulators: 2 },
      { kind: "processor", hp: 155, energyUse: 12, heatGen: 5, crew: 2, processorStages: [1, 2], description: "Тонкое измельчение силикатов и рудных концентратов." }),
    electrolyzer: moduleDef("Электролизёр", "Обработка II", 2, 2, "E", { steelFrames: 12, copperWire: 12, ceramicInsulators: 7 },
      { kind: "processor", hp: 165, energyUse: 20, heatGen: 5, crew: 2, processorStages: [2, 3], tech: "chemicalSeparation", description: "Разделяет воду и растворы на полезные компоненты." }),
    thermalExtractor: moduleDef("Термический экстрактор", "Обработка II", 2, 2, "T", { titaniumPlates: 10, ceramicInsulators: 8, copperWire: 8 },
      { kind: "processor", hp: 190, energyUse: 24, heatGen: 14, crew: 2, processorStages: [2, 3], tech: "chemicalSeparation", description: "Выделяет металлы из тонких взвесей высокой температурой." }),
    chemicalReactor: moduleDef("Химический реактор", "Обработка II", 2, 2, "H", { titaniumPlates: 10, quartzGlass: 8, polymerMatrix: 6, cableCores: 6 },
      { kind: "processor", hp: 185, energyUse: 22, heatGen: 8, crew: 2, processorStages: [2, 3], tech: "chemicalSeparation", description: "Катализ, очистка воды, полимеры и химическое разделение." }),
    salvageRecycler: moduleDef("Переработчик трофеев", "Обработка II", 2, 2, "♲", { titaniumPlates: 10, steelFrames: 10, siliconPlates: 5 },
      { kind: "processor", hp: 185, energyUse: 18, heatGen: 6, crew: 2, processorStages: [5], tech: "deepRecycling", description: "Разбирает вражеские компоненты на базовые материалы. Также повышает возврат разборки до 70%." }),

    electromagneticFurnace: moduleDef("Электромагнитная печь", "Обработка III", 2, 2, "F", { steelFrames: 14, copperWire: 16, ceramicInsulators: 8 },
      { kind: "processor", hp: 190, energyUse: 26, heatGen: 18, crew: 2, processorStages: [3], description: "Стартовая выплавка металлов без атмосферы." }),
    blastFurnace: moduleDef("Доменная печь", "Обработка III", 3, 2, "BF", { heavySteel: 18, ceramicInsulators: 12, carbonBlack: 10 },
      { kind: "processor", hp: 320, energyUse: 30, heatGen: 28, crew: 3, processorStages: [3], tech: "advancedFurnaces", description: "Массовая выплавка стали и тяжёлых сплавов." }),
    arcFurnace: moduleDef("Дуговая печь", "Обработка III", 2, 2, "AF", { titaniumHeavy: 12, cableCores: 14, ceramicInsulators: 10 },
      { kind: "processor", hp: 260, energyUse: 42, heatGen: 24, crew: 2, processorStages: [3], tech: "advancedFurnaces", description: "Высокотемпературная выплавка титана и вольфрама." }),
    vacuumFurnace: moduleDef("Вакуумная печь", "Обработка III", 2, 2, "VF", { titaniumHeavy: 12, quartzGlass: 12, superconductors: 6 },
      { kind: "processor", hp: 240, energyUse: 38, heatGen: 17, crew: 2, processorStages: [2, 3, 4], tech: "advancedFurnaces", description: "Чистые сплавы, кварцевое стекло и кристаллические материалы." }),
    polymerSynth: moduleDef("Полимерный синтезатор", "Обработка III", 2, 2, "PS", { titaniumPlates: 8, quartzGlass: 6, siliconPlates: 6 },
      { kind: "processor", hp: 160, energyUse: 18, heatGen: 6, crew: 2, processorStages: [3], tech: "chemicalSeparation", description: "Создаёт полимерные матрицы из углеродистых летучих." }),
    organicSynth: moduleDef("Органический синтезатор", "Обработка III", 2, 2, "OS", { titaniumPlates: 8, purifiedWater: 10, siliconPlates: 7 },
      { kind: "processor", hp: 165, energyUse: 19, heatGen: 5, crew: 2, processorStages: [3], tech: "crewExpansion", description: "Производит расходники жизнеобеспечения и органические связующие." }),
    metalFormer: moduleDef("Металлоформовочная машина", "Обработка III", 2, 2, "MF", { steelFrames: 14, copperWire: 10, titaniumPlates: 5 },
      { kind: "processor", hp: 200, energyUse: 20, heatGen: 7, crew: 2, processorStages: [4], tech: "advancedFurnaces", description: "Формует каркасы, арматуру, сердечники и детали." }),
    rollingMill: moduleDef("Металлопрокатная машина", "Обработка III", 3, 2, "RM", { heavySteel: 14, titaniumPlates: 8, cableCores: 8 },
      { kind: "processor", hp: 290, energyUse: 28, heatGen: 10, crew: 3, processorStages: [4], tech: "advancedFurnaces", description: "Прокатывает пластины, панели и кабельные заготовки." }),
    diamondPress: moduleDef("Компрессор силикатов", "Обработка III", 2, 2, "◆", { superalloy: 8, tungstenPanels: 8, superconductors: 10 },
      { kind: "processor", hp: 270, energyUse: 52, heatGen: 22, crew: 3, processorStages: [6], tech: "diamondCompression", description: "Высокобарическая игровая установка синтеза технических алмазов из очищенных силикатов." }),

    printer1: moduleDef("3D-принтер I", "Сборка", 2, 2, "3D", { steelFrames: 14, copperWire: 12, siliconPlates: 6 },
      { kind: "processor", hp: 175, energyUse: 18, heatGen: 4, crew: 2, processorStages: [4], description: "Печатает ранние компоненты и конструкции." }),
    printer2: moduleDef("3D-принтер II", "Сборка", 2, 2, "3+", { titaniumPlates: 12, superconductors: 5, siliconPlates: 10 },
      { kind: "processor", hp: 220, energyUse: 30, heatGen: 7, crew: 2, processorStages: [4], tech: "advancedFurnaces", description: "Точная печать титановых и композитных деталей." }),
    printer3: moduleDef("3D-принтер III", "Сборка", 3, 2, "3Q", { titaniumComposite: 12, diamonds: 6, superconductors: 12 },
      { kind: "processor", hp: 300, energyUse: 46, heatGen: 9, crew: 3, processorStages: [4,8], tech: "diamondCompression", description: "Квантово-контролируемая печать поздних компонентов и эндгейм-контейнеров." }),
    assembler: moduleDef("Сборочный автомат", "Сборка", 2, 2, "A", { steelFrames: 12, copperWire: 10, siliconPlates: 5 },
      { kind: "processor", hp: 180, energyUse: 16, heatGen: 4, crew: 2, processorStages: [4], description: "Финальная сборка конструкций, электроники и боеприпасов." }),

    radiationHood: moduleDef("Радиационный колпак", "Ядерные", 2, 2, "⌇", { tungstenPanels: 10, heavySteel: 8, quartzGlass: 6 },
      { kind: "nuclear", hp: 290, energyUse: 5, crew: 1, shielding: 9, tech: "nuclearPhysics", description: "Защищённая горячая камера. Поглощает радиацию соседней ядерной линии." }),
    isotopeCentrifuge: moduleDef("Изотопная центрифуга", "Ядерные", 2, 2, "⊙", { titaniumHeavy: 14, superconductors: 10, tungstenPanels: 8 },
      { kind: "processor", hp: 300, energyUse: 45, heatGen: 13, crew: 3, radiation: 3.5, processorStages: [7], tech: "isotopeEngineering", description: "Абстрактно разделяет игровые изотопные партии. Требует экранирования." }),
    depletedCorePress: moduleDef("Пресс обеднённых сердечников", "Ядерные", 2, 2, "DU", { heavySteel: 12, tungstenRebar: 8, titaniumPlates: 6 },
      { kind: "processor", hp: 260, energyUse: 28, heatGen: 8, crew: 2, radiation: 1.4, processorStages: [4, 8], tech: "isotopeEngineering", description: "Формует защитные панели и игровые боеприпасы из обеднённого материала." }),
    decayAccelerator: moduleDef("Камера ускорения распада", "Ядерные", 3, 2, "λ", { superalloy: 18, tungstenPanels: 15, superconductors: 16, diamonds: 5 },
      { kind: "processor", hp: 390, energyUse: 72, heatGen: 28, crew: 4, radiation: 6, processorStages: [7,8], tech: "isotopeEngineering", description: "Игровая камера трансмутации долгоживущих изотопов и синтеза эндгейм-контейнеров." }),
    fuelCellAssembler: moduleDef("Сборщик топливных ячеек", "Ядерные", 2, 2, "FC", { titaniumHeavy: 12, zirconiumCeramic: 10, siliconPlates: 8 },
      { kind: "processor", hp: 260, energyUse: 28, heatGen: 8, crew: 3, radiation: 1.2, processorStages: [8], tech: "isotopeEngineering", description: "Герметизирует урановые, ториевые и америциевые ячейки." }),

    gradTurret: moduleDef("Автопушка «Град»", "Вооружение", 1, 1, "G", { steelFrames: 6, copperWire: 4, apCores: 2 },
      { kind: "weapon", hp: 130, energyUse: 4, heatGen: 3, crew: 1, edgeRequired: true, weapon: { type: "bullet", range: 92, damage: 18, rate: 0.34, speed: 150 }, description: "Скорострельная кинетическая защита от астероидов и лёгких целей." }),
    shotTurret: moduleDef("Шрапнельная установка «Дробь»", "Вооружение", 1, 1, "D", { steelFrames: 8, copperWire: 5, apCores: 4 },
      { kind: "weapon", hp: 145, energyUse: 5, heatGen: 5, crew: 1, edgeRequired: true, weapon: { type: "shrapnel", range: 70, damage: 9, rate: 0.75, speed: 135 }, tech: "kineticDoctrine", description: "Веер осколков против плотных групп и мелких метеоров." }),
    shardPD: moduleDef("Защитное орудие «Осколок»", "Вооружение", 1, 1, "O", { steelFrames: 7, siliconPlates: 4, copperWire: 7 },
      { kind: "weapon", hp: 125, energyUse: 7, heatGen: 3, crew: 1, edgeRequired: true, weapon: { type: "pointDefense", range: 82, damage: 10, rate: 0.18, speed: 190 }, tech: "kineticDoctrine", description: "Сбивает ракеты и медленные малоэнергетические снаряды." }),
    railgun: moduleDef("Кинетический рельсотрон", "Вооружение", 2, 1, "R", { titaniumHeavy: 12, superconductors: 8, apCores: 8 },
      { kind: "weapon", hp: 230, energyUse: 28, heatGen: 12, crew: 2, edgeRequired: true, weapon: { type: "rail", range: 175, damage: 92, rate: 2.5, speed: 290 }, tech: "kineticDoctrine", description: "Дальнобойное орудие, использующее разные кинетические сердечники." }),
    tesla: moduleDef("Энергетическая установка «Тесла»", "Вооружение", 1, 1, "T", { titaniumPlates: 6, superconductors: 7, ceramicInsulators: 4 },
      { kind: "weapon", hp: 135, energyUse: 22, heatGen: 9, crew: 1, edgeRequired: true, weapon: { type: "tesla", range: 86, damage: 30, rate: 1.1 }, tech: "energyWeapons", description: "Цепной разряд по нескольким близким целям." }),
    plasmaCutter: moduleDef("Плазменный резак", "Вооружение", 1, 1, "P", { titaniumPlates: 7, cableCores: 8, coolantCapsules: 3 },
      { kind: "weapon", hp: 145, energyUse: 25, heatGen: 13, crew: 1, edgeRequired: true, weapon: { type: "plasma", range: 64, damage: 48, rate: 0.75 }, tech: "energyWeapons", description: "Короткий мощный поток плазмы." }),
    directedPlasma: moduleDef("Направленный плазменный резак", "Вооружение", 2, 1, "≫", { titaniumHeavy: 10, superconductors: 10, diamonds: 3, coolantCapsules: 5 },
      { kind: "weapon", hp: 220, energyUse: 38, heatGen: 18, crew: 2, edgeRequired: true, weapon: { type: "plasmaBeam", range: 125, damage: 62, rate: 1.2 }, tech: "highEnergyWeapons", description: "Фокусированный плазменный поток средней дальности." }),
    phaseLaser: moduleDef("Фазовый лазер", "Вооружение", 2, 1, "L", { titaniumComposite: 7, superconductors: 12, diamonds: 8, quartzGlass: 5 },
      { kind: "weapon", hp: 210, energyUse: 44, heatGen: 16, crew: 2, edgeRequired: true, weapon: { type: "laser", range: 170, damage: 72, rate: 1.45 }, tech: "diamondCompression", description: "Высокоэнергетический лазер с техническими алмазами в оптическом тракте." }),
    maser: moduleDef("Когерентный мазер", "Вооружение", 2, 1, "M", { superalloy: 8, superconductors: 16, diamonds: 10 },
      { kind: "weapon", hp: 225, energyUse: 52, heatGen: 18, crew: 2, edgeRequired: true, weapon: { type: "maser", range: 190, damage: 82, rate: 1.55 }, tech: "highEnergyWeapons", description: "Мазерная система с алмазными теплоотводами и сверхпроводящим резонатором." }),
    swarmMissile: moduleDef("Ракетная шахта «Рой»", "Вооружение", 2, 2, "W", { titaniumLight: 10, siliconPlates: 12, polymerMatrix: 10, incendiaryCores: 4 },
      { kind: "weapon", hp: 230, energyUse: 16, heatGen: 6, crew: 2, weapon: { type: "swarm", range: 180, damage: 26, rate: 2.6, speed: 78 }, tech: "smartWeapons", description: "Пакет малых самонаводящихся ракет." }),
    solidMissile: moduleDef("Ракетная шахта «Солид»", "Вооружение", 2, 2, "S", { titaniumHeavy: 12, siliconPlates: 10, polymerMatrix: 8, apCores: 6 },
      { kind: "weapon", hp: 260, energyUse: 18, heatGen: 8, crew: 2, weapon: { type: "missile", range: 210, damage: 125, rate: 4.2, speed: 72 }, tech: "smartWeapons", description: "Тяжёлая ракета против крупных астероидов и боссов." }),
    empPulsar: moduleDef("ЭМИ-пульсар", "Вооружение", 2, 2, "EMP", { titaniumComposite: 8, superconductors: 16, siliconPlates: 12 },
      { kind: "weapon", hp: 245, energyUse: 56, heatGen: 16, crew: 2, weapon: { type: "emp", range: 115, damage: 18, rate: 5.5 }, tech: "smartWeapons", description: "Замедляет и временно отключает электронные системы врагов." }),
    thermalMissile: moduleDef("Термальная ракетная установка", "Вооружение", 2, 2, "TH", { titaniumHeavy: 10, polymerMatrix: 8, incendiaryCores: 8, coolantCapsules: 4 },
      { kind: "weapon", hp: 250, energyUse: 19, heatGen: 10, crew: 2, weapon: { type: "thermalMissile", range: 195, damage: 85, rate: 3.4, speed: 74 }, tech: "thermalWeapons", description: "Передаёт цели большой тепловой импульс." }),
    plasmaLance: moduleDef("Установка «Плазменное копьё»", "Вооружение", 2, 2, "Λ", { superalloy: 12, superconductors: 16, diamonds: 6, coolantCapsules: 10 },
      { kind: "weapon", hp: 280, energyUse: 34, heatGen: -1, crew: 3, edgeRequired: true, weapon: { type: "plasmaLance", range: 165, damage: 135, rate: 4.8 }, tech: "thermalWeapons", description: "Забирает накопленную теплоту станции и массовым лучом передаёт её противнику." }),
    gravityRepulsor: moduleDef("Гравитационный репульсор", "Эндгейм", 2, 2, "G", { superalloy: 16, superconductors: 22, diamonds: 12, zeroPointCells: 2 },
      { kind: "weapon", hp: 300, energyUse: 72, heatGen: 20, crew: 3, weapon: { type: "repulsor", range: 135, damage: 38, rate: 2.8 }, tech: "gravityEngineering", description: "Отталкивает тяжёлые объекты и нарушает траектории противника." }),
    antimatterEmitter: moduleDef("Излучатель антиматерии", "Эндгейм", 2, 2, "Ā", { superalloy: 20, superconductors: 25, diamonds: 14, antimatterCapsules: 1 },
      { kind: "weapon", hp: 310, energyUse: 85, heatGen: 30, crew: 3, weapon: { type: "antimatter", range: 175, damage: 210, rate: 6.2 }, tech: "antimatter", description: "Редкие аннигиляционные импульсы с уроном по площади." }),
    quantumCannon: moduleDef("Квантовая пушка", "Эндгейм", 2, 2, "Q", { superalloy: 18, superconductors: 26, diamonds: 18, zeroPointCells: 1 },
      { kind: "weapon", hp: 300, energyUse: 78, heatGen: 22, crew: 3, weapon: { type: "quantum", range: 220, damage: 180, rate: 4.4 }, tech: "quantumWeapons", description: "Игнорирует часть брони и наносит точный дальний удар." }),
    magnetoQuantumLance: moduleDef("Магнито-квантовое копьё", "Эндгейм", 3, 1, "MQ", { superalloy: 24, superconductors: 32, diamonds: 20, tungstenPanels: 10 },
      { kind: "weapon", hp: 360, energyUse: 96, heatGen: 30, crew: 4, edgeRequired: true, weapon: { type: "quantumRail", range: 260, damage: 260, rate: 6.6 }, tech: "quantumWeapons", description: "Сочетает рельсовое ускорение и квантовую коррекцию траектории." }),
    zeroPointDisruptor: moduleDef("Дестабилизатор нулевой точки", "Эндгейм", 2, 2, "Z", { superalloy: 22, superconductors: 30, diamonds: 22, zeroPointCells: 3 },
      { kind: "weapon", hp: 325, energyUse: 110, heatGen: -4, crew: 4, weapon: { type: "zeroPoint", range: 155, damage: 155, rate: 5.8 }, tech: "zeroPoint", description: "Квантовое оружие, одновременно охлаждающее собственный контур." }),

    orbitalPrinter: moduleDef("Орбитальный принтер", "Эндгейм", 4, 4, "Ω", { heavySteel: 180, titaniumHeavy: 120, titaniumComposite: 90, superconductors: 65, diamonds: 35, superalloy: 55 },
      { kind: "endgame", hp: 980, energyUse: 160, heatGen: 40, crew: 8, tech: "orbitalFabrication", unique: true, description: "Печатает новый термоядерный реактор и создаёт ещё одну станцию, между которыми можно переключаться." }),
    gravityWell: moduleDef("Гравитационный колодец", "Эндгейм", 4, 3, "ϟ", { heavySteel: 175, titaniumHeavy: 105, superconductors: 70, diamonds: 35, superalloy: 50, coolantCapsules: 80 },
      { kind: "endgame", hp: 900, energyUse: 90, heatGen: 24, crew: 6, tech: "gravityEngineering", unique: true, description: "Почти реакторная по цене система управления временем волн. Перезарядка 120 секунд; огромный расход энергии, хладагента и тепловой выброс." })
  };

  const TECHNOLOGIES = {
    reinforcedFrames: { name: "Титановые несущие системы", tier: 1, points: 28, cost: { steelFrames: 18, ilmenite: 12 }, prereq: [], description: "Титановые конструкции и более прочные опорные тайлы." },
    energyDiversification: { name: "Распределённая энергетика", tier: 1, points: 24, cost: { copperWire: 20, steelFrames: 12 }, prereq: [], description: "Энергетические узлы, электрические конвейеры, МГД и солнечная генерация." },
    thermalDistribution: { name: "Термораспределение", tier: 1, points: 24, cost: { copperWire: 16, steelFrames: 10 }, prereq: [], description: "Направленные радиаторы, термические батареи и улучшенная диффузия теплоты." },
    improvedCrushing: { name: "Глубокое дробление", tier: 1, points: 22, cost: { steelFrames: 15, copperWire: 12 }, prereq: [], description: "Дробилки и сепараторы второго уровня." },
    crewExpansion: { name: "Автономия экипажа", tier: 1, points: 20, cost: { purifiedWater: 18, polymerMatrix: 8 }, prereq: [], description: "Кают-компании, аварийные шлюзы и органический синтез." },
    kineticDoctrine: { name: "Кинетическая доктрина", tier: 1, points: 26, cost: { steelFrames: 12, copperWire: 10, scheelite: 8 }, prereq: [], description: "Шрапнель, точечная оборона и рельсотрон." },

    chemicalSeparation: { name: "Химия и разделение", tier: 2, points: 48, cost: { crushedTroilite: 10, crushedBornite: 10, crushedSilicate: 8 }, prereq: ["improvedCrushing"], description: "Электролиз, экстракция, химические реакторы и вакуумная логистика." },
    deepRecycling: { name: "Глубокая переработка", tier: 2, points: 52, cost: { titaniumPlates: 12, siliconPlates: 10 }, prereq: ["chemicalSeparation", "advancedFurnaces"], description: "Переплавка трофеев и повышение возврата при разборке с 50% до 70%." },
    magneticLogistics: { name: "Магнитная логистика", tier: 2, points: 46, cost: { cableCores: 14, titaniumLight: 8 }, prereq: ["energyDiversification", "advancedFurnaces"], description: "Магнитные конвейеры, трубы и грузовые модули 3×3." },
    advancedFurnaces: { name: "Синтез и сплавы", tier: 2, points: 58, cost: { titaniumConcentrate: 10, tungstenSuspension: 8, steelIngots: 16 }, prereq: ["chemicalSeparation"], description: "Дуговые, доменные и вакуумные печи; металлоформование и прокат." },
    nuclearPhysics: { name: "Радиоизотопная энергетика", tier: 2, points: 62, cost: { nasturan: 12, tungstenDust: 8, ceramicInsulators: 10 }, prereq: ["thermalDistribution", "advancedFurnaces"], description: "РИТЭГи, радиационные колпаки и безопасная работа с радиоактивными партиями." },
    energyWeapons: { name: "Энергетическое вооружение", tier: 2, points: 54, cost: { cableCores: 12, siliconPlates: 10, coolantCapsules: 8 }, prereq: ["energyDiversification", "kineticDoctrine", "chemicalSeparation"], description: "Тесла-системы и плазменные резаки." },

    isotopeEngineering: { name: "Изотопная инженерия", tier: 3, points: 96, cost: { uraniumConcentrate: 10, tungstenPanels: 12, superconductors: 12 }, prereq: ["nuclearPhysics", "advancedFurnaces"], description: "Центрифуги, камеры распада, ядерные реакторы и разные топливные ячейки." },
    diamondCompression: { name: "Компрессия силикатов", tier: 3, points: 88, cost: { purifiedSilicon: 24, tungstenPanels: 8, superalloy: 4 }, prereq: ["advancedFurnaces"], description: "Синтетические алмазы для лазеров, мазеров и высокоэнергетических систем." },
    superconductingGrid: { name: "Сверхпроводящая сеть", tier: 3, points: 92, cost: { superconductors: 20, ceramicInsulators: 15, titaniumComposite: 6 }, prereq: ["magneticLogistics", "energyWeapons"], description: "Маховики, приливные индукторы, мощные манипуляторы и снижение энергопотерь." },
    thermalWeapons: { name: "Термальное вооружение", tier: 3, points: 82, cost: { incendiaryCores: 14, coolantCapsules: 14, titaniumHeavy: 8 }, prereq: ["thermalDistribution", "energyWeapons"], description: "Термальные ракеты и плазменное копьё, использующее накопленную теплоту." },
    smartWeapons: { name: "Умные боевые системы", tier: 3, points: 78, cost: { siliconPlates: 18, polymerMatrix: 14, superconductors: 8 }, prereq: ["kineticDoctrine", "energyWeapons"], description: "Ракетные шахты «Рой» и «Солид», ЭМИ-пульсар." },
    compositeArchitecture: { name: "Композитная архитектура", tier: 3, points: 86, cost: { titaniumComposite: 14, compositeStructures: 18, superalloy: 6 }, prereq: ["reinforcedFrames", "deepRecycling"], description: "Композитные и сверхпрочные конструкции для критических модулей." },
    highEnergyWeapons: { name: "Высокоэнергетические контуры", tier: 3, points: 104, cost: { diamonds: 8, superconductors: 18, coolantCapsules: 16 }, prereq: ["diamondCompression", "superconductingGrid"], description: "Фазовые лазеры, мазеры, направленная плазма и плазменные аттракторы." },

    antimatter: { name: "Антиматериальная инженерия", tier: 4, points: 180, cost: { superalloy: 24, diamonds: 16, superconductors: 28, enrichedUranium: 12 }, prereq: ["isotopeEngineering", "highEnergyWeapons"], description: "Реактор на антиматерии, капсулы и аннигиляционное оружие." },
    quantumWeapons: { name: "Квантовая баллистика", tier: 4, points: 170, cost: { diamonds: 22, superconductors: 30, superalloy: 18 }, prereq: ["highEnergyWeapons", "smartWeapons"], description: "Квантовая пушка и магнито-квантовое копьё." },
    zeroPoint: { name: "Теплота нулевой точки", tier: 4, points: 190, cost: { diamonds: 26, superconductors: 34, radioactiveCapsules: 12 }, prereq: ["quantumWeapons", "isotopeEngineering"], description: "Квантовые теплоотводы, ячейки нулевой точки и дестабилизаторы." },
    orbitalFabrication: { name: "Орбитальная фабрикация", tier: 4, points: 230, cost: { heavySteel: 60, titaniumHeavy: 50, titaniumComposite: 35, diamonds: 24, superconductors: 35 }, prereq: ["compositeArchitecture", "diamondCompression", "isotopeEngineering"], description: "Орбитальный принтер и печать нового термоядерного реактора — основа флота станций." },
    gravityEngineering: { name: "Управление гравитационной задержкой", tier: 4, points: 260, cost: { superalloy: 40, diamonds: 30, superconductors: 45, zeroPointCells: 2 }, prereq: ["orbitalFabrication", "zeroPoint"], minWave: 12, description: "Гравитационный колодец — почти реакторная по цене система управления временем волн." }
  };

  function recipe(id, name, stage, machines, inputs, outputs, time, tech = null, description = "") {
    return { id, name, stage, machines, inputs, outputs, time, tech, description };
  }

  const RECIPES = [
    recipe("crush-kamacite", "Дробление камасита", 1, ["crusher1","crusher2","crusher3","grinder"], { kamacite: 3 }, { crushedFerrous: 5 }, 4),
    recipe("crush-taenite", "Дробление тэнита", 1, ["crusher1","crusher2","crusher3","grinder"], { taenite: 3 }, { crushedFerrous: 5 }, 4),
    recipe("crush-magnetite", "Дробление магнетита", 1, ["crusher1","crusher2","crusher3","grinder"], { magnetite: 3 }, { crushedFerrous: 5 }, 4),
    recipe("crush-troilite", "Дробление троилита", 1, ["crusher1","crusher2","crusher3","grinder"], { troilite: 3 }, { crushedTroilite: 5 }, 4),
    recipe("crush-ilmenite", "Дробление ильменита", 1, ["crusher1","crusher2","crusher3","grinder"], { ilmenite: 3 }, { crushedIlmenite: 5 }, 4),
    recipe("crush-scheelite", "Дробление шеелита", 1, ["crusher1","crusher2","crusher3","grinder"], { scheelite: 3 }, { crushedScheelite: 5 }, 4),
    recipe("crush-bornite", "Дробление борнита", 1, ["crusher1","crusher2","crusher3","grinder"], { bornite: 3 }, { crushedBornite: 5 }, 4),
    recipe("fallback-raw-silicates", "Аварийное измельчение силикатов", 1, ["grinder"], { olivine: 4, pyroxene: 4 }, { crushedSilicate: 5 }, 28, null, "Очень медленная базовая цепочка, предотвращающая потерю доступа к кремнию и керамике."),
    recipe("fallback-raw-steel", "Аварийная прямая плавка камасита", 3, ["electromagneticFurnace"], { kamacite: 10, regolithGas: 2 }, { steelIngots: 2 }, 34, null, "Низкоэффективная выплавка стали прямо из метеоритного сырья."),
    recipe("fallback-raw-copper", "Аварийная прямая плавка борнита", 3, ["electromagneticFurnace"], { bornite: 10 }, { copperIngots: 2, sulfurCatalyst: 1 }, 36, null, "Медленное восстановление меди и сульфидного катализатора без сепаратора."),
    recipe("grind-silicates", "Измельчение силикатов", 1, ["grinder","crusher2","crusher3"], { olivine: 2, pyroxene: 2 }, { crushedSilicate: 7 }, 5, "improvedCrushing"),
    recipe("fallback-ap-cores", "Длительная сборка бронебойных сердечников", 4, ["assembler"], { scheelite: 5, steelIngots: 2 }, { apCores: 2 }, 30, null, "Аварийная малопроизводительная цепочка для восстановления кинетических боеприпасов."),
    recipe("fallback-water", "Медленная конденсация воды", 3, ["electromagneticFurnace"], { chondriteGas: 8 }, { purifiedWater: 3 }, 26, null, "Низкоэффективное восстановление воды без химической линии."),
    recipe("fallback-carbon", "Пиролиз реголитных летучих", 3, ["electromagneticFurnace"], { regolithGas: 8 }, { carbonBlack: 2 }, 22, null, "Медленный аварийный источник технического углерода."),
    recipe("fallback-silicon", "Грубая очистка силикатов", 2, ["grinder"], { crushedSilicate: 8 }, { purifiedSilicon: 2, quartzGlass: 1 }, 24, null, "Долгая ранняя цепочка для восстановления электроники и стекла."),
    recipe("fallback-sulfur", "Механическое выделение сульфидов", 2, ["grinder"], { crushedTroilite: 8 }, { sulfurCatalyst: 2, ferrousConcentrate: 1 }, 24, "improvedCrushing", "Медленный способ получить катализатор до полноценной химии."),
    recipe("fallback-steel", "Прямая восстановительная плавка", 3, ["electromagneticFurnace"], { crushedFerrous: 8, carbonBlack: 1 }, { steelIngots: 3 }, 24, "improvedCrushing", "Аварийная плавка с большим расходом сырья."),
    recipe("fallback-copper", "Прямая плавка борнита", 3, ["electromagneticFurnace"], { crushedBornite: 8 }, { copperIngots: 2, sulfurCatalyst: 1 }, 26, "improvedCrushing", "Медленная ранняя выплавка меди."),
    recipe("fallback-ceramics", "Обжиг грубой керамики", 3, ["electromagneticFurnace"], { crushedSilicate: 6, quartzGlass: 1 }, { ceramicInsulators: 2 }, 30, null, "Резервная линия керамических изоляторов."),
    recipe("crush-nasturan", "Закрытое дробление настурана", 1, ["crusher3","grinder"], { nasturan: 2 }, { crushedNasturan: 3 }, 7, "nuclearPhysics"),
    recipe("crush-chromite", "Дробление хромита", 1, ["crusher2","crusher3","grinder"], { chromite: 3 }, { crushedChromite: 5 }, 5, "improvedCrushing"),
    recipe("grind-zircon", "Измельчение циркона", 1, ["grinder","crusher2","crusher3"], { zircon: 3 }, { crushedZircon: 5 }, 5, "improvedCrushing"),

    recipe("separate-ferrous", "Сепарация железо-никелевой смеси", 2, ["separator1","separator2","separator3"], { crushedFerrous: 5 }, { ferrousConcentrate: 4 }, 5, "improvedCrushing"),
    recipe("separate-troilite", "Сульфидное разделение", 2, ["separator1","separator2","chemicalReactor"], { crushedTroilite: 5 }, { sulfurCatalyst: 3, ferrousConcentrate: 1 }, 6, "chemicalSeparation"),
    recipe("separate-ilmenite", "Разделение ильменита", 2, ["separator2","separator3","thermalExtractor"], { crushedIlmenite: 5 }, { titaniumConcentrate: 4 }, 6, "chemicalSeparation"),
    recipe("scheelite-slurry", "Вольфрамовая взвесь", 2, ["thermalExtractor","chemicalReactor","separator3"], { crushedScheelite: 5, purifiedWater: 1 }, { tungstenSuspension: 4 }, 7, "chemicalSeparation"),
    recipe("separate-bornite", "Медная фракция", 2, ["separator1","separator2","chemicalReactor"], { crushedBornite: 5 }, { copperConcentrate: 4, sulfurCatalyst: 1 }, 6, "chemicalSeparation"),
    recipe("silicate-refining", "Очистка силикатов", 2, ["separator2","chemicalReactor","grinder"], { crushedSilicate: 6 }, { purifiedSilicon: 3, quartzGlass: 2 }, 7, "chemicalSeparation"),
    recipe("volatile-water", "Конденсация хондритных летучих", 2, ["chemicalReactor","electrolyzer"], { chondriteGas: 4 }, { purifiedWater: 5, carbonBlack: 1 }, 6, "chemicalSeparation"),
    recipe("regolith-carbon", "Разделение реголитных летучих", 2, ["chemicalReactor","separator2"], { regolithGas: 4 }, { carbonBlack: 4 }, 5, "chemicalSeparation"),
    recipe("uranium-concentrate", "Урановый концентрат", 2, ["chemicalReactor","thermalExtractor"], { crushedNasturan: 4, sulfurCatalyst: 1 }, { uraniumConcentrate: 3, decayProducts: 1 }, 10, "nuclearPhysics"),
    recipe("chromium-concentrate", "Хромовый концентрат", 2, ["separator2","separator3"], { crushedChromite: 5 }, { chromiumConcentrate: 4 }, 7, "chemicalSeparation"),
    recipe("zircon-ceramic", "Циркониевая керамика", 2, ["thermalExtractor","vacuumFurnace"], { crushedZircon: 5, carbonBlack: 1 }, { zirconiumCeramic: 3 }, 8, "advancedFurnaces"),

    recipe("smelt-steel", "Выплавка стали", 3, ["electromagneticFurnace","blastFurnace","arcFurnace"], { ferrousConcentrate: 4, carbonBlack: 1 }, { steelIngots: 5 }, 7),
    recipe("smelt-titanium", "Выплавка титана", 3, ["arcFurnace","vacuumFurnace"], { titaniumConcentrate: 4 }, { titaniumIngots: 4 }, 9, "advancedFurnaces"),
    recipe("extract-tungsten", "Экстракция вольфрама", 3, ["arcFurnace","vacuumFurnace","thermalExtractor"], { tungstenSuspension: 4 }, { tungstenDust: 4 }, 10, "advancedFurnaces"),
    recipe("fallback-titanium", "Длительная титановая плавка", 3, ["electromagneticFurnace"], { crushedIlmenite: 8 }, { titaniumIngots: 2 }, 34, "chemicalSeparation", "Низкопроизводительная линия до дуговых печей."),
    recipe("fallback-tungsten", "Длительное восстановление вольфрама", 3, ["electromagneticFurnace"], { crushedScheelite: 8, purifiedWater: 2 }, { tungstenDust: 2 }, 38, "chemicalSeparation", "Аварийная линия с высоким расходом шеелита."),
    recipe("fallback-polymer", "Медленный полимерный синтез", 4, ["assembler"], { regolithGas: 6, carbonBlack: 2 }, { polymerMatrix: 2 }, 32, null, "Резервная сборочная цепочка полимерных матриц."),
    recipe("fallback-coolant", "Ручная упаковка хладагента", 4, ["assembler"], { purifiedWater: 6, polymerMatrix: 1 }, { coolantCapsules: 2 }, 32, "chemicalSeparation", "Медленное восстановление запаса охлаждения."),
    recipe("fallback-titanium-plates", "Медленное формование титана", 4, ["assembler"], { titaniumIngots: 3 }, { titaniumPlates: 3 }, 30, "chemicalSeparation", "Резервная линия пластин до металлопроката."),
    recipe("smelt-copper", "Выплавка меди", 3, ["electromagneticFurnace","arcFurnace"], { copperConcentrate: 4 }, { copperIngots: 5 }, 6),
    recipe("fallback-silicon-plates", "Ручная сборка кремниевых пластин", 4, ["assembler"], { purifiedSilicon: 5, copperWire: 1, quartzGlass: 1 }, { siliconPlates: 2 }, 34, null, "Крайне медленная резервная линия электроники."),
    recipe("silicon-wafers", "Кремниевые пластины", 3, ["vacuumFurnace","chemicalReactor"], { purifiedSilicon: 3 }, { siliconPlates: 3 }, 8, "advancedFurnaces"),
    recipe("carbon-fiber", "Углеродные волокна", 3, ["polymerSynth","vacuumFurnace"], { carbonBlack: 4, polymerMatrix: 1 }, { carbonFiber: 3 }, 8, "chemicalSeparation"),
    recipe("polymer-matrix", "Полимерные матрицы", 3, ["polymerSynth","organicSynth","chemicalReactor"], { regolithGas: 3, carbonBlack: 1 }, { polymerMatrix: 3 }, 7, "chemicalSeparation"),
    recipe("coolant", "Капсулы охладителя", 3, ["chemicalReactor","electrolyzer","organicSynth"], { purifiedWater: 5, polymerMatrix: 1 }, { coolantCapsules: 4 }, 7, "chemicalSeparation"),
    recipe("superalloy", "Сверхпрочный сплав", 3, ["arcFurnace","vacuumFurnace"], { titaniumIngots: 2, tungstenDust: 2, chromiumConcentrate: 2 }, { superalloy: 3 }, 12, "advancedFurnaces"),

    recipe("steel-frames", "Стальные каркасы", 4, ["assembler","printer1","printer2","printer3","metalFormer"], { steelIngots: 3 }, { steelFrames: 3 }, 5),
    recipe("heavy-steel", "Тяжёлые стальные конструкции", 4, ["assembler","printer2","printer3","metalFormer","rollingMill"], { steelFrames: 4, steelIngots: 2 }, { heavySteel: 3 }, 8, "advancedFurnaces"),
    recipe("titanium-plates", "Титановые пластины", 4, ["rollingMill","metalFormer","printer2","printer3"], { titaniumIngots: 3 }, { titaniumPlates: 4 }, 7, "advancedFurnaces"),
    recipe("titanium-light", "Облегчённые титановые конструкции", 4, ["printer2","printer3","metalFormer"], { titaniumPlates: 3 }, { titaniumLight: 3 }, 7, "advancedFurnaces"),
    recipe("titanium-heavy", "Тяжёлые титановые конструкции", 4, ["printer2","printer3","metalFormer"], { titaniumPlates: 4, tungstenDust: 1 }, { titaniumHeavy: 3 }, 9, "advancedFurnaces"),
    recipe("fallback-titanium-composite", "Экспериментальный титановый ламинат", 4, ["assembler","printer2"], { titaniumPlates: 4, carbonFiber: 3, polymerMatrix: 2 }, { titaniumComposite: 1 }, 42, "advancedFurnaces", "Медленная предварительная линия для выхода к композитной архитектуре."),
    recipe("titanium-composite", "Титановый композит", 4, ["printer2","printer3","assembler"], { titaniumPlates: 2, carbonFiber: 2, polymerMatrix: 1 }, { titaniumComposite: 3 }, 10, "compositeArchitecture"),
    recipe("titanium-armor", "Титановые бронепластины", 4, ["rollingMill","metalFormer","printer3"], { titaniumHeavy: 3, superalloy: 1 }, { titaniumArmor: 3 }, 10, "compositeArchitecture"),
    recipe("tungsten-rebar", "Вольфрамовая арматура", 4, ["metalFormer","printer2","printer3"], { tungstenDust: 3, steelIngots: 1 }, { tungstenRebar: 3 }, 8, "advancedFurnaces"),
    recipe("tungsten-panels", "Вольфрамовые панели", 4, ["rollingMill","printer3"], { tungstenDust: 4, titaniumPlates: 1 }, { tungstenPanels: 3 }, 9, "advancedFurnaces"),
    recipe("ap-cores", "Бронебойные сердечники", 4, ["metalFormer","assembler","depletedCorePress"], { tungstenDust: 2, steelIngots: 1 }, { apCores: 4 }, 6, "kineticDoctrine"),
    recipe("copper-wire", "Медная проводка", 4, ["rollingMill","assembler","printer1","printer2","printer3"], { copperIngots: 2 }, { copperWire: 5 }, 4),
    recipe("cable-cores", "Кабельные жилы", 4, ["rollingMill","assembler","printer2","printer3"], { copperWire: 4, polymerMatrix: 1 }, { cableCores: 4 }, 6, "energyDiversification"),
    recipe("fallback-superconductors", "Лабораторные сверхпроводники", 4, ["assembler","vacuumFurnace"], { cableCores: 6, purifiedSilicon: 4, ceramicInsulators: 3, coolantCapsules: 2 }, { superconductors: 2 }, 46, "advancedFurnaces", "Дорогая мидгейм-линия, исключающая зависимость исследования от случайного трофея."),
    recipe("superconductors", "Сверхпроводники", 4, ["vacuumFurnace","printer3","assembler"], { cableCores: 3, purifiedSilicon: 2, ceramicInsulators: 1 }, { superconductors: 3 }, 10, "energyWeapons"),
    recipe("ceramics", "Керамические изоляторы", 4, ["vacuumFurnace","printer2","printer3"], { crushedSilicate: 3, quartzGlass: 1 }, { ceramicInsulators: 4 }, 7, "advancedFurnaces"),
    recipe("fallback-composite-structures", "Ручная укладка композитных конструкций", 4, ["assembler","printer2"], { carbonFiber: 4, polymerMatrix: 3, titaniumLight: 2 }, { compositeStructures: 1 }, 44, "deepRecycling", "Резервная линия перед полноценной композитной архитектурой."),
    recipe("composite-structures", "Композитные конструкции", 4, ["printer2","printer3","assembler"], { carbonFiber: 2, polymerMatrix: 2, titaniumLight: 1 }, { compositeStructures: 3 }, 9, "compositeArchitecture"),
    recipe("fallback-incendiary-cores", "Ручная сборка зажигательных сердечников", 4, ["assembler"], { steelIngots: 2, polymerMatrix: 2, sulfurCatalyst: 2 }, { incendiaryCores: 2 }, 34, "chemicalSeparation", "Медленная предварительная линия для открытия термального вооружения."),
    recipe("incendiary-cores", "Зажигательные сердечники", 4, ["assembler","printer2","printer3"], { steelIngots: 1, polymerMatrix: 1, sulfurCatalyst: 1 }, { incendiaryCores: 4 }, 6, "thermalWeapons"),

    recipe("recycle-silicon", "Разбор кремниевых пластин", 5, ["salvageRecycler"], { siliconPlates: 5 }, { purifiedSilicon: 3 }, 6, "deepRecycling"),
    recipe("recycle-titanium", "Разбор титановых композитов", 5, ["salvageRecycler"], { titaniumComposite: 4 }, { titaniumPlates: 2, carbonFiber: 1 }, 8, "deepRecycling"),
    recipe("recycle-superconductors", "Разбор сверхпроводников", 5, ["salvageRecycler"], { superconductors: 4 }, { cableCores: 2, purifiedSilicon: 1 }, 8, "deepRecycling"),
    recipe("recycle-armor", "Переплавка бронепластин", 5, ["salvageRecycler"], { titaniumArmor: 3 }, { titaniumHeavy: 2 }, 8, "deepRecycling"),
    recipe("recycle-composite", "Разбор композитных конструкций", 5, ["salvageRecycler"], { compositeStructures: 4 }, { carbonFiber: 2, polymerMatrix: 1 }, 7, "deepRecycling"),

    recipe("diamonds", "Компрессия технических алмазов", 6, ["diamondPress"], { purifiedSilicon: 8, crushedSilicate: 8, tungstenPanels: 1 }, { diamonds: 2 }, 18, "diamondCompression"),

    recipe("separate-uranium", "Изотопное разделение урана", 7, ["isotopeCentrifuge"], { uraniumConcentrate: 6, sulfurCatalyst: 1 }, { uraniumIsotopes: 3, depletedUranium: 3 }, 20, "isotopeEngineering"),
    recipe("enrich-uranium", "Подготовка делящегося урана", 7, ["isotopeCentrifuge"], { uraniumIsotopes: 4 }, { enrichedUranium: 2, decayProducts: 1 }, 24, "isotopeEngineering"),
    recipe("accelerate-decay", "Ускоренная изотопная трансмутация", 7, ["decayAccelerator"], { decayProducts: 5, thoriumIsotopes: 1 }, { americiumIsotopes: 2, plutoniumIsotopes: 1 }, 32, "isotopeEngineering"),
    recipe("thorium-recovery", "Извлечение ториевой фракции", 7, ["isotopeCentrifuge","decayAccelerator"], { uraniumConcentrate: 5, crushedZircon: 2 }, { thoriumIsotopes: 2, decayProducts: 1 }, 24, "isotopeEngineering"),

    recipe("fuel-rods", "Топливные стержни", 8, ["fuelCellAssembler","printer3"], { enrichedUranium: 2, zirconiumCeramic: 2, tungstenPanels: 1 }, { fuelRods: 3 }, 14, "isotopeEngineering"),
    recipe("uranium-cell", "Урановая топливная ячейка", 8, ["fuelCellAssembler"], { fuelRods: 3, ceramicInsulators: 2 }, { uraniumCell: 1 }, 18, "isotopeEngineering"),
    recipe("thorium-cell", "Ториевая топливная ячейка", 8, ["fuelCellAssembler"], { thoriumIsotopes: 3, zirconiumCeramic: 2, ceramicInsulators: 1 }, { thoriumCell: 1 }, 20, "isotopeEngineering"),
    recipe("americium-cell", "Америциевая РИТЭГ-ячейка", 8, ["fuelCellAssembler"], { americiumIsotopes: 2, tungstenPanels: 1, ceramicInsulators: 2 }, { americiumCell: 1 }, 22, "isotopeEngineering"),
    recipe("radioactive-capsule", "Радиоактивная капсула", 8, ["fuelCellAssembler","depletedCorePress"], { decayProducts: 2, tungstenPanels: 1, zirconiumCeramic: 1 }, { radioactiveCapsules: 2 }, 14, "isotopeEngineering"),
    recipe("depleted-cores", "Обеднённые сердечники", 8, ["depletedCorePress"], { depletedUranium: 3, steelIngots: 1 }, { apCores: 6 }, 10, "isotopeEngineering"),
    recipe("nuclear-charge", "Ядерный заряд", 8, ["fuelCellAssembler","printer3"], { enrichedUranium: 4, heavySteel: 4, siliconPlates: 3 }, { nuclearCharges: 1 }, 30, "isotopeEngineering"),
    recipe("zero-point-cell", "Ячейка нулевой точки", 8, ["decayAccelerator","printer3"], { radioactiveCapsules: 3, diamonds: 2, superconductors: 4 }, { zeroPointCells: 1 }, 28, "zeroPoint"),
    recipe("antimatter-capsule", "Капсула антиматерии", 8, ["decayAccelerator","printer3"], { enrichedUranium: 4, diamonds: 3, zeroPointCells: 1 }, { antimatterCapsules: 1 }, 38, "antimatter")
  ];

  const ENEMIES = {
    fighter: { name: "Истребитель", hp: 72, speed: 26, damage: 8, rate: 2.2, range: 75, reward: 8, color: "#ff5e85", size: 3, armor: 0 },
    interceptor: { name: "Перехватчик", hp: 55, speed: 38, damage: 6, rate: 1.5, range: 62, reward: 9, color: "#ff8361", size: 3, armor: 0 },
    attacker: { name: "Штурмовик", hp: 115, speed: 22, damage: 13, rate: 2.4, range: 66, reward: 13, color: "#ff4c66", size: 4, armor: 2 },
    heavyFighter: { name: "Тяжёлый истребитель", hp: 180, speed: 20, damage: 17, rate: 2.1, range: 82, reward: 20, color: "#dc4b8e", size: 5, armor: 5 },
    heavyInterceptor: { name: "Тяжёлый перехватчик", hp: 145, speed: 30, damage: 13, rate: 1.4, range: 72, reward: 21, color: "#e87857", size: 5, armor: 4 },
    heavyAttacker: { name: "Тяжёлый штурмовик", hp: 270, speed: 17, damage: 24, rate: 2.6, range: 78, reward: 30, color: "#d93d5f", size: 6, armor: 8 },
    bomber: { name: "Бомбардировщик", hp: 230, speed: 15, damage: 38, rate: 4.4, range: 130, reward: 34, color: "#c64fb2", size: 6, armor: 6, rail: true },
    heavyBomber: { name: "Тяжёлый бомбардировщик", hp: 430, speed: 11, damage: 58, rate: 4.8, range: 150, reward: 52, color: "#a63fca", size: 8, armor: 12, rail: true },
    leviathan: { name: "Левиафан", hp: 3600, speed: 6, damage: 90, rate: 2.8, range: 165, reward: 600, color: "#ff2b7b", size: 18, armor: 20, boss: true },
    strikeStation: { name: "Вражеская ударная станция", hp: 7200, speed: 3.2, damage: 150, rate: 2.1, range: 210, reward: 1400, color: "#db31ff", size: 25, armor: 34, boss: true }
  };

  const RAW_ASTEROID_KEYS = ["kamacite","taenite","troilite","ilmenite","scheelite","bornite","olivine","pyroxene","nasturan","chondriteGas","regolithGas","magnetite","chromite","zircon"];
  const ENEMY_LOOT_EARLY = ["steelFrames","copperWire","siliconPlates","titaniumLight"];
  const ENEMY_LOOT_MID = ["titaniumArmor","titaniumHeavy","compositeStructures"];
  const ENEMY_LOOT_LATE = ["titaniumComposite","superconductors"];
  const ENEMY_LOOT_KEYS = [...ENEMY_LOOT_EARLY, ...ENEMY_LOOT_MID, ...ENEMY_LOOT_LATE];
  const RARE_ENEMY_LOOT_EARLY = ["apCores","quartzGlass","ceramicInsulators","polymerMatrix","coolantCapsules","siliconPlates"];
  const RARE_ENEMY_LOOT_MID = ["tungstenDust","tungstenPanels","titaniumComposite","superconductors","superalloy","compositeStructures"];
  const RARE_ENEMY_LOOT_LATE = ["diamonds","uraniumConcentrate","radioactiveCapsules","zeroPointCells"];
  const ASTEROID_DROUGHT_LIMITS = { bornite: 12, chondriteGas: 13, regolithGas: 13, scheelite: 15, ilmenite: 15, olivine: 14, pyroxene: 14, chromite: 18, zircon: 18, nasturan: 18 };

  const TUTORIAL_STEPS = [
    {
      title: "Капитанский протокол",
      text: "Станция держится на едином связанном каркасе. Волновой таймер будет остановлен до завершения инструктажа, а учебные модули не расходуют ваши стартовые запасы.",
      requirement: "Нажмите «Продолжить», чтобы включить режим строительства.", action: "continue"
    },
    {
      title: "Расширьте несущий каркас",
      text: "Нельзя ставить модуль прямо в пустоту. Добавьте 12 стальных конструкций, соединённых с существующей станцией. Они дадут будущим модулям базовую прочность и теплоёмкость.",
      requirement: "Построено стальных конструкций: {count}/12", expected: "steelStructure", count: 12, auto: true
    },
    {
      title: "Захватите первый ресурс",
      text: "Поставьте механический манипулятор на краю каркаса. Он будет втягивать обломки уничтоженных астероидов и спасательные капсулы.",
      requirement: "Механический манипулятор: {count}/1", expected: "manipulatorMechanical", count: 1, auto: true
    },
    {
      title: "Проведите логистическую линию",
      text: "Зажмите левую кнопку мыши и протяните линию из четырёх механических конвейеров между зоной захвата и производственными модулями. Направление линии задаётся движением курсора, одиночный поворот — клавишей R.",
      requirement: "Механические конвейеры: {count}/4", expected: "conveyorMechanical", count: 4, auto: true
    },
    {
      title: "Грубая переработка",
      text: "Постройте дробилку I рядом с логистической сетью. Она превратит астероидное сырьё в дроблёные фракции.",
      requirement: "Дробилка I: {count}/1", expected: "crusher1", count: 1, auto: true
    },
    {
      title: "Тонкое измельчение",
      text: "Постройте измельчитель. Через инспектор модуля можно выбирать рецепт; производство использует доступные ресурсы из грузовой сети.",
      requirement: "Измельчитель: {count}/1", expected: "grinder", count: 1, auto: true
    },
    {
      title: "Первая плавка",
      text: "Поставьте электромагнитную печь. Следите за энергией и температурой: перегрев снижает эффективность и повреждает модули.",
      requirement: "Электромагнитная печь: {count}/1", expected: "electromagneticFurnace", count: 1, auto: true
    },
    {
      title: "Финальная сборка",
      text: "Поставьте сборочный автомат. Он замыкает стартовую цепочку от руды до каркасов, проводки и боеприпасов.",
      requirement: "Сборочный автомат: {count}/1", expected: "assembler", count: 1, auto: true
    },
    {
      title: "Оборона станции",
      text: "Поставьте автопушку «Град» на внешний край. После этого начнётся двухминутный отсчёт до первой регулярной вражеской волны.",
      requirement: "Автопушка «Град»: {count}/1", expected: "gradTurret", count: 1, auto: true
    },
    {
      title: "Станция готова",
      text: "Базовая линия запущена. Астероиды идут постоянно, враги — волнами каждые 2 минуты. Добыча и оборона образуют единый цикл: уничтожение → захват → переработка → расширение.",
      requirement: "Нажмите «Запустить орбитальный цикл».", action: "finish"
    }
  ];

  const DOM = {
    bootScreen: $("#bootScreen"), gameShell: $("#gameShell"), newGameBtn: $("#newGameBtn"), continueBtn: $("#continueBtn"),
    canvas: $("#gameCanvas"), frame: $("#canvasFrame"), ctx: $("#gameCanvas").getContext("2d", { alpha: false }),
    stationSelect: $("#stationSelect"), waveNumber: $("#waveNumber"), waveTimer: $("#waveTimer"), waveProgress: $("#waveProgress"),
    scoreValue: $("#scoreValue"), researchValue: $("#researchValue"), pauseBtn: $("#pauseBtn"), thermalToggle: $("#thermalToggle"),
    hullMetric: $("#hullMetric"), hullBar: $("#hullBar"), powerMetric: $("#powerMetric"), powerBar: $("#powerBar"),
    crewMetric: $("#crewMetric"), crewBar: $("#crewBar"), tempMetric: $("#tempMetric"), tempBar: $("#tempBar"),
    radiationMetric: $("#radiationMetric"), radiationBar: $("#radiationBar"), storageMetric: $("#storageMetric"), storageBar: $("#storageBar"),
    resourceList: $("#resourceList"), resourceModeBtn: $("#resourceModeBtn"), compactStats: $("#compactStats"),
    tutorialPanel: $("#tutorialPanel"), tutorialCounter: $("#tutorialCounter"), tutorialTitle: $("#tutorialTitle"), tutorialText: $("#tutorialText"),
    tutorialRequirement: $("#tutorialRequirement"), tutorialActionBtn: $("#tutorialActionBtn"), tutorialAutoBtn: $("#tutorialAutoBtn"),
    buildModeBtn: $("#buildModeBtn"), inspectModeBtn: $("#inspectModeBtn"), demolishModeBtn: $("#demolishModeBtn"), rotateBtn: $("#rotateBtn"),
    researchBtn: $("#researchBtn"), codexBtn: $("#codexBtn"), saveBtn: $("#saveBtn"), eventLog: $("#eventLog"),
    buildPanel: $("#buildPanel"), inspectPanel: $("#inspectPanel"), closeInspectBtn: $("#closeInspectBtn"), inspectContent: $("#inspectContent"),
    buildSearch: $("#buildSearch"), categoryTabs: $("#categoryTabs"), buildList: $("#buildList"), rotationIndicator: $("#rotationIndicator"),
    hoverTooltip: $("#hoverTooltip"), combatBanner: $("#combatBanner"), toastStack: $("#toastStack"),
    researchOverlay: $("#researchOverlay"), researchCapText: $("#researchCapText"), researchOverlayPoints: $("#researchOverlayPoints"), researchTree: $("#researchTree"),
    codexOverlay: $("#codexOverlay"), codexTabs: $("#codexTabs"), codexContent: $("#codexContent"),
    modalOverlay: $("#modalOverlay"), modalEyebrow: $("#modalEyebrow"), modalTitle: $("#modalTitle"), modalBody: $("#modalBody"), modalActions: $("#modalActions")
  };

  DOM.canvas.width = CANVAS_W;
  DOM.canvas.height = CANVAS_H;
  DOM.ctx.imageSmoothingEnabled = false;

  let state = null;
  const runtime = {
    started: false,
    lastFrame: 0,
    saveTimer: 0,
    uiTimer: 0,
    asteroidTimer: 0,
    entityId: 1,
    entities: [],
    projectiles: [],
    loot: [],
    effects: [],
    stars: [],
    dust: [],
    mouse: { sx: -1, sy: -1, x: -1, y: -1, gx: -1, gy: -1, inside: false },
    camera: { x: CANVAS_W / 2, y: CANVAS_H / 2, zoom: 1, minZoom: 0.65, maxZoom: 3.25, dragging: false, moved: false, dragStartX: 0, dragStartY: 0, dragCameraX: CANVAS_W / 2, dragCameraY: CANVAS_H / 2 },
    buildStroke: { active: false, moved: false, startGX: -1, startGY: -1, lastGX: -1, lastGY: -1, axis: null, placed: 0, attempted: new Set(), type: null, startRotation: 0, lastReason: "", suppressClick: false },
    uiCache: { stationSignature: "", resourceSignature: "", inspectorKey: "", inspectorRevision: 0 },
    selectedModuleId: null,
    selectedEntityId: null,
    currentStats: null,
    bannerTimer: 0,
    lastToastAt: 0
  };

  function makeGrid(fill = null) {
    return Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => fill));
  }

  function createStation(name = "Ковчег-01") {
    const station = {
      id: `station-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      name,
      foundation: makeGrid(null),
      moduleAt: makeGrid(null),
      modules: {},
      crew: 12,
      radiation: 0,
      zeroPointReserve: 0,
      powerBuffer: 0,
      printedCores: 0,
      totalHeatDumped: 0,
      integrityLoss: 0
    };

    for (let y = 12; y <= 25; y++) {
      for (let x = 20; x <= 35; x++) {
        const cornerCut = (x < 22 || x > 33) && (y < 14 || y > 23);
        if (!cornerCut) {
          const def = STRUCTURES.steelStructure;
          station.foundation[y][x] = { type: "steelStructure", hp: def.baseHp, maxHp: def.baseHp };
        }
      }
    }

    placeInitialModule(station, "fusionReactor", 26, 17, 0, true);
    placeInitialModule(station, "bridge", 22, 17, 0, true);
    placeInitialModule(station, "cargo2", 31, 17, 0, true);
    placeInitialModule(station, "crewBunk", 22, 21, 0, true);
    placeInitialModule(station, "lifeSupport", 31, 21, 0, true);
    placeInitialModule(station, "radiator", 20, 17, 0, true);
    return station;
  }

  function placeInitialModule(station, type, x, y, rotation = 0, protectedInstance = false) {
    const def = MODULES[type];
    if (!def) return null;
    const size = rotatedSize(def.w, def.h, rotation);
    let bonus = 0;
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        const f = station.foundation[y + dy]?.[x + dx];
        if (!f) return null;
        bonus += STRUCTURES[f.type].baseHp * 0.62;
      }
    }
    const id = `m${uid()}`;
    const maxHp = Math.round(def.hp + bonus / (size.w * size.h));
    const compatibleRecipes = getCompatibleRecipes(type, new Set(Object.keys(TECHNOLOGIES)));
    station.modules[id] = {
      id, type, x, y, rotation, hp: maxHp, maxHp, heat: 295, progress: 0,
      recipeId: compatibleRecipes[0]?.id || null, cooldown: 0, fuelRemaining: def.fuel ? def.fuel.duration * 0.7 : 0,
      status: "Готов", protected: protectedInstance, printProgress: 0, printPaid: false, gravityCooldown: 0
    };
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) station.moduleAt[y + dy][x + dx] = id;
    }
    return station.modules[id];
  }

  function createNewState() {
    const seed = Math.floor(Math.random() * 9999999) + 1;
    return {
      version: SAVE_VERSION,
      seed,
      inventory: { ...DEFAULT_INVENTORY },
      researchPoints: 10,
      researched: [],
      wave: 0,
      waveTimer: 120,
      score: 0,
      kills: 0,
      asteroidsDestroyed: 0,
      resourcesCollected: 0,
      stations: [createStation("Ковчег-01")],
      currentStation: 0,
      speed: 1,
      paused: false,
      thermalView: false,
      mode: "build",
      selectedBuild: "steelStructure",
      rotation: 0,
      category: "Каркасы",
      resourceViewAll: false,
      tutorial: { active: true, step: 0, progress: 0 },
      playTime: 0,
      waveStarted: false,
      gameOver: false,
      balance: { rareLootPity: 0, asteroidDrought: {}, recoveryWave: -99 },
      logs: ["Системы станции подняты. Запущен протокол выживания."],
      lastSaved: Date.now()
    };
  }

  function getStation() {
    return state?.stations?.[state.currentStation] || null;
  }

  function getBuildDef(id) {
    return STRUCTURES[id] || MODULES[id] || null;
  }

  function getTechSet() {
    return new Set(state?.researched || []);
  }

  function getWaveTierCap() {
    if (!state) return 1;
    if (state.wave >= 10) return 4;
    if (state.wave >= 6) return 3;
    if (state.wave >= 3) return 2;
    return 1;
  }

  function isTechAvailable(techId) {
    const tech = TECHNOLOGIES[techId];
    if (!tech || !state) return false;
    if (state.researched.includes(techId)) return false;
    if (tech.tier > getWaveTierCap()) return false;
    if (tech.minWave && state.wave < tech.minWave) return false;
    return tech.prereq.every((id) => state.researched.includes(id));
  }

  function isBuildUnlocked(id) {
    const def = getBuildDef(id);
    if (!def) return false;
    if (!def.tech) return true;
    return state.researched.includes(def.tech);
  }

  function normalizeCost(cost = {}) {
    return Object.fromEntries(Object.entries(cost).filter(([key, amount]) => RESOURCES[key] && amount > 0));
  }

  function canAfford(cost = {}) {
    return Object.entries(normalizeCost(cost)).every(([key, amount]) => (state.inventory[key] || 0) >= amount);
  }

  function payCost(cost = {}) {
    for (const [key, amount] of Object.entries(normalizeCost(cost))) {
      state.inventory[key] = Math.max(0, (state.inventory[key] || 0) - amount);
    }
  }

  function refundCost(cost = {}, rate = 0.5) {
    for (const [key, amount] of Object.entries(normalizeCost(cost))) {
      const returned = Math.floor(amount * rate);
      if (returned > 0) state.inventory[key] = (state.inventory[key] || 0) + returned;
    }
  }

  function getRefundRate() {
    return state.researched.includes("deepRecycling") ? 0.7 : 0.5;
  }

  function getCompatibleRecipes(moduleType, techSet = getTechSet()) {
    const def = MODULES[moduleType];
    if (!def || !def.processorStages.length) return [];
    return RECIPES.filter((recipeItem) =>
      def.processorStages.includes(recipeItem.stage) &&
      recipeItem.machines.includes(moduleType) &&
      (!recipeItem.tech || techSet.has(recipeItem.tech))
    );
  }

  function hasSavedGame() {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY));
    } catch (error) {
      console.warn("Локальное хранилище недоступно:", error);
      return false;
    }
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      console.warn("Не удалось очистить локальное сохранение:", error);
    }
  }

  function saveGame(silent = false) {
    if (!state || state.gameOver) return;
    state.lastSaved = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      if (!silent) toast("Состояние станции сохранено.");
      DOM.continueBtn.disabled = false;
    } catch (error) {
      console.error(error);
      if (!silent) toast("Не удалось сохранить игру в браузере.", "danger");
    }
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const loaded = JSON.parse(raw);
      if (!loaded || loaded.version !== SAVE_VERSION || !Array.isArray(loaded.stations)) return null;
      loaded.inventory = { ...Object.fromEntries(Object.keys(RESOURCES).map((key) => [key, 0])), ...DEFAULT_INVENTORY, ...loaded.inventory };
      loaded.researched ||= [];
      loaded.logs ||= [];
      loaded.tutorial ||= { active: false, step: TUTORIAL_STEPS.length - 1, progress: 0 };
      loaded.speed ||= 1;
      loaded.mode ||= "build";
      loaded.category ||= "Каркасы";
      loaded.selectedBuild ||= "steelStructure";
      loaded.rotation ||= 0;
      loaded.currentStation = clamp(loaded.currentStation || 0, 0, loaded.stations.length - 1);
      loaded.balance ||= { rareLootPity: 0, asteroidDrought: {}, recoveryWave: -99 };
      loaded.balance.rareLootPity ??= 0;
      loaded.balance.asteroidDrought ||= {};
      loaded.balance.recoveryWave ??= -99;
      loaded.stations.forEach(repairLoadedStation);
      return loaded;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function repairLoadedStation(station) {
    station.id ||= `station-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    station.foundation ||= makeGrid(null);
    station.moduleAt ||= makeGrid(null);
    station.modules ||= {};
    station.crew ??= 12;
    station.radiation ??= 0;
    station.zeroPointReserve ??= 0;
    station.powerBuffer ??= 0;
    station.printedCores ??= 0;
    for (let y = 0; y < station.foundation.length; y++) {
      for (let x = 0; x < (station.foundation[y]?.length || 0); x++) {
        if (station.foundation[y][x]) station.foundation[y][x].freeBuild ??= false;
      }
    }
    for (const module of Object.values(station.modules)) {
      module.freeBuild ??= false;
      module.heat ??= 295;
      module.progress ??= 0;
      module.cooldown ??= 0;
      module.gravityCooldown ??= 0;
      module.printProgress ??= 0;
      module.printPaid ??= false;
      module.status ||= "Готов";
    }
  }

  function resetRuntime() {
    runtime.entities.length = 0;
    runtime.projectiles.length = 0;
    runtime.loot.length = 0;
    runtime.effects.length = 0;
    runtime.asteroidTimer = 0;
    runtime.selectedModuleId = null;
    runtime.selectedEntityId = null;
    runtime.lastFrame = performance.now();
    runtime.saveTimer = 0;
    runtime.uiTimer = 0;
    runtime.bannerTimer = 0;
    runtime.mouse = { sx: -1, sy: -1, x: -1, y: -1, gx: -1, gy: -1, inside: false };
    runtime.camera.dragging = false;
    runtime.camera.moved = false;
    runtime.buildStroke.active = false;
    runtime.buildStroke.moved = false;
    runtime.buildStroke.startGX = -1;
    runtime.buildStroke.startGY = -1;
    runtime.buildStroke.lastGX = -1;
    runtime.buildStroke.lastGY = -1;
    runtime.buildStroke.axis = null;
    runtime.buildStroke.placed = 0;
    runtime.buildStroke.attempted = new Set();
    runtime.buildStroke.type = null;
    runtime.buildStroke.lastReason = "";
    runtime.buildStroke.suppressClick = false;
    runtime.buildStroke.firstModuleId = null;
    runtime.uiCache.stationSignature = "";
    runtime.uiCache.resourceSignature = "";
    runtime.uiCache.inspectorKey = "";
    runtime.uiCache.inspectorRevision = 0;
  }

  function startNewGame() {
    state = createNewState();
    resetRuntime();
    initSpriteBackground(state.seed);
    centerCameraOnStation(true);
    enterGame();
    renderAllUI(true);
    updateTutorialUI();
  }

  function continueGame() {
    const loaded = loadSavedState();
    if (!loaded) {
      startNewGame();
      return;
    }
    state = loaded;
    state.paused = false;
    resetRuntime();
    initSpriteBackground(state.seed);
    centerCameraOnStation(true);
    enterGame();
    logEvent("Сохранение восстановлено. Орбитальный цикл продолжен.");
    renderAllUI(true);
    updateTutorialUI();
  }

  function enterGame() {
    DOM.bootScreen.classList.remove("is-visible");
    DOM.gameShell.classList.add("is-visible");
    DOM.gameShell.setAttribute("aria-hidden", "false");
    document.body.classList.toggle("is-paused", state.paused);
    if (!runtime.started) {
      runtime.started = true;
      requestAnimationFrame(gameLoop);
    }
  }

  function logEvent(message) {
    if (!state) return;
    state.logs.unshift(message);
    state.logs = state.logs.slice(0, 30);
    DOM.eventLog.innerHTML = `<b>${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</b> // ${escapeHtml(message)}`;
  }

  function toast(message, type = "normal") {
    const item = document.createElement("div");
    item.className = `toast ${type === "normal" ? "" : type}`.trim();
    item.textContent = message;
    DOM.toastStack.appendChild(item);
    while (DOM.toastStack.children.length > 4) DOM.toastStack.firstChild.remove();
    setTimeout(() => item.remove(), 3600);
  }

  function showBanner(message, duration = 3.5) {
    DOM.combatBanner.textContent = message;
    DOM.combatBanner.hidden = false;
    runtime.bannerTimer = duration;
  }

  function showModal({ eyebrow = "SYSTEM", title, body, actions = [] }) {
    DOM.modalEyebrow.textContent = eyebrow;
    DOM.modalTitle.textContent = title;
    DOM.modalBody.innerHTML = body;
    DOM.modalActions.innerHTML = "";
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.className = `btn ${action.primary ? "btn--primary" : ""}`.trim();
      button.textContent = action.label;
      button.addEventListener("click", () => {
        if (action.close !== false) DOM.modalOverlay.hidden = true;
        action.onClick?.();
      });
      DOM.modalActions.appendChild(button);
    });
    DOM.modalOverlay.hidden = false;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function costText(cost, check = false) {
    return Object.entries(normalizeCost(cost)).map(([key, amount]) => {
      const missing = check && (state.inventory[key] || 0) < amount;
      return `<span class="${missing ? "missing" : ""}" title="${escapeHtml(RESOURCES[key].name)}">${RESOURCES[key].short} ${amount}</span>`;
    }).join("");
  }

  function setMode(mode) {
    if (runtime.buildStroke.active) finishBuildStroke();
    state.mode = mode;
    DOM.buildModeBtn.classList.toggle("is-active", mode === "build");
    DOM.inspectModeBtn.classList.toggle("is-active", mode === "inspect");
    DOM.demolishModeBtn.classList.toggle("is-active", mode === "demolish");
    DOM.buildPanel.classList.toggle("is-visible", mode === "build");
    DOM.inspectPanel.classList.toggle("is-visible", mode !== "build");
    if (mode === "build") {
      runtime.selectedModuleId = null;
      runtime.selectedEntityId = null;
      DOM.inspectContent.dataset.inspectKey = "";
    }
    updateInspector(true);
  }

  function selectBuild(id) {
    if (!getBuildDef(id)) return;
    if (state.tutorial.active) {
      const step = TUTORIAL_STEPS[state.tutorial.step];
      if (step.expected && id !== step.expected) return;
    }
    state.selectedBuild = id;
    const def = getBuildDef(id);
    state.category = def.category;
    setMode("build");
    renderCategoryTabs();
    renderBuildList();
  }

  function rotateSelection() {
    state.rotation = (state.rotation + 1) % 4;
    DOM.rotationIndicator.textContent = `R ${state.rotation * 90}°`;
    if (runtime.selectedModuleId) rotatePlacedModule(runtime.selectedModuleId);
  }

  function rotatePlacedModule(moduleId) {
    const station = getStation();
    const module = station.modules[moduleId];
    if (!module) return;
    const def = MODULES[module.type];
    if (def.w === def.h && !def.weapon && !def.logistics) return;
    const newRotation = (module.rotation + 1) % 4;
    const oldSize = rotatedSize(def.w, def.h, module.rotation);
    const newSize = rotatedSize(def.w, def.h, newRotation);
    for (let dy = 0; dy < oldSize.h; dy++) for (let dx = 0; dx < oldSize.w; dx++) station.moduleAt[module.y + dy][module.x + dx] = null;
    let valid = true;
    for (let dy = 0; dy < newSize.h; dy++) {
      for (let dx = 0; dx < newSize.w; dx++) {
        const x = module.x + dx, y = module.y + dy;
        if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H || !station.foundation[y][x] || station.moduleAt[y][x]) valid = false;
      }
    }
    if (valid && (!def.edgeRequired || footprintTouchesVoid(module.x, module.y, newSize.w, newSize.h, station))) {
      module.rotation = newRotation;
      for (let dy = 0; dy < newSize.h; dy++) for (let dx = 0; dx < newSize.w; dx++) station.moduleAt[module.y + dy][module.x + dx] = module.id;
      toast("Модуль повёрнут.");
    } else {
      for (let dy = 0; dy < oldSize.h; dy++) for (let dx = 0; dx < oldSize.w; dx++) station.moduleAt[module.y + dy][module.x + dx] = module.id;
      toast("Недостаточно места для поворота.", "warn");
    }
    updateInspector();
  }

  function footprintTouchesVoid(x, y, w, h, station = getStation()) {
    const cells = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([x + dx, y + dy]);
    return cells.some(([cx, cy]) => [[1,0],[-1,0],[0,1],[0,-1]].some(([ox, oy]) => {
      const nx = cx + ox, ny = cy + oy;
      return nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H || !station.foundation[ny][nx];
    }));
  }

  function isFoundationConnectedCandidate(x, y, station = getStation()) {
    if (!station) return false;
    return [[1,0],[-1,0],[0,1],[0,-1]].some(([ox, oy]) => {
      const nx = x + ox, ny = y + oy;
      return nx >= 0 && ny >= 0 && nx < GRID_W && ny < GRID_H && station.foundation[ny][nx];
    });
  }

  function canPlaceFoundation(type, x, y) {
    const station = getStation();
    if (!STRUCTURES[type] || !station || x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return { ok: false, reason: "За границей сектора" };
    if (station.foundation[y][x]) return { ok: false, reason: "Конструкция уже существует" };
    if (!isFoundationConnectedCandidate(x, y, station)) return { ok: false, reason: "Каркас должен быть связан со станцией" };
    if (!isBuildUnlocked(type)) return { ok: false, reason: "Технология не изучена" };
    return { ok: true };
  }

  function canPlaceModule(type, x, y, rotation = 0) {
    const station = getStation();
    const def = MODULES[type];
    if (!def || !station) return { ok: false, reason: "Неизвестный модуль" };
    if (!isBuildUnlocked(type)) return { ok: false, reason: "Технология не изучена" };
    if (def.unique && Object.values(station.modules).some((module) => module.type === type)) return { ok: false, reason: "На станции уже есть такой уникальный модуль" };
    const size = rotatedSize(def.w, def.h, rotation);
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return { ok: false, reason: "Модуль выходит за границу сектора" };
        if (!station.foundation[cy][cx]) return { ok: false, reason: "Сначала постройте несущую конструкцию" };
        if (station.moduleAt[cy][cx]) return { ok: false, reason: "Тайл занят другим модулем" };
      }
    }
    if (def.edgeRequired && !footprintTouchesVoid(x, y, size.w, size.h, station)) return { ok: false, reason: "Модуль должен стоять на внешнем краю" };
    return { ok: true };
  }

  function placeBuildAt(type, x, y, options = {}) {
    const def = getBuildDef(type);
    if (!def || !state || state.gameOver) return false;
    const silent = Boolean(options.silent);
    const batch = Boolean(options.batch);
    const placementRotation = Number.isInteger(options.rotation) ? options.rotation : state.rotation;
    const free = options.free || (state.tutorial.active && TUTORIAL_STEPS[state.tutorial.step]?.expected === type);
    if (state.tutorial.active) {
      const step = TUTORIAL_STEPS[state.tutorial.step];
      if (step.expected && type !== step.expected) {
        if (!silent) toast("В учебном режиме доступен только текущий обязательный модуль.", "warn");
        if (options.reasonTarget) options.reasonTarget.lastReason = "Учебный этап уже изменился";
        return false;
      }
    }
    const validation = def.kind === "structure" ? canPlaceFoundation(type, x, y) : canPlaceModule(type, x, y, placementRotation);
    if (!validation.ok) {
      if (!silent) toast(validation.reason, "warn");
      if (options.reasonTarget) options.reasonTarget.lastReason = validation.reason;
      return false;
    }
    if (!free && !canAfford(def.cost)) {
      const reason = "Недостаточно ресурсов для строительства";
      if (!silent) toast(`${reason}.`, "danger");
      if (options.reasonTarget) options.reasonTarget.lastReason = reason;
      return false;
    }
    if (!free) payCost(def.cost);

    if (def.kind === "structure") {
      const station = getStation();
      station.foundation[y][x] = { type, hp: def.baseHp, maxHp: def.baseHp, freeBuild: free };
      if (!batch) logEvent(`Построена опора: ${def.name}.`);
    } else {
      const station = getStation();
      const size = rotatedSize(def.w, def.h, placementRotation);
      let bonus = 0;
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) bonus += STRUCTURES[station.foundation[y + dy][x + dx].type].baseHp * 0.62;
      }
      const id = `m${uid()}`;
      const maxHp = Math.round(def.hp + bonus / (size.w * size.h));
      const recipes = getCompatibleRecipes(type);
      station.modules[id] = {
        id, type, x, y, rotation: placementRotation, hp: maxHp, maxHp, heat: 295,
        progress: 0, recipeId: recipes[0]?.id || null, cooldown: 0,
        fuelRemaining: 0, status: "Готов", protected: false, freeBuild: free, printProgress: 0, printPaid: false, gravityCooldown: 0
      };
      for (let dy = 0; dy < size.h; dy++) for (let dx = 0; dx < size.w; dx++) station.moduleAt[y + dy][x + dx] = id;
      runtime.selectedModuleId = id;
      if (options.resultTarget) options.resultTarget.moduleId = id;
      if (!batch) logEvent(`Установлен модуль: ${def.name}.`);
    }

    state.score += def.kind === "structure" ? 1 : Math.max(5, def.w * def.h * 4);
    handleTutorialPlacement(type, silent || batch);
    if (!batch) renderAllUI(true);
    return true;
  }

  function handleTutorialPlacement(type, quiet = false) {
    if (!state.tutorial.active) return;
    const step = TUTORIAL_STEPS[state.tutorial.step];
    if (!step?.expected || step.expected !== type) return;
    state.tutorial.progress += 1;
    if (state.tutorial.progress >= step.count) {
      state.tutorial.step += 1;
      state.tutorial.progress = 0;
      const next = TUTORIAL_STEPS[state.tutorial.step];
      if (next?.expected) selectBuild(next.expected);
      updateTutorialUI();
      if (!quiet) toast("Этап протокола выполнен.");
    } else {
      updateTutorialUI();
    }
  }

  function updateTutorialUI() {
    if (!state) return;
    const tutorial = state.tutorial;
    DOM.tutorialPanel.hidden = !tutorial.active;
    if (!tutorial.active) return;
    const step = TUTORIAL_STEPS[tutorial.step];
    if (!step) return;
    DOM.tutorialCounter.textContent = `${String(tutorial.step + 1).padStart(2, "0")}/${String(TUTORIAL_STEPS.length).padStart(2, "0")}`;
    DOM.tutorialTitle.textContent = step.title;
    DOM.tutorialText.textContent = step.text;
    DOM.tutorialRequirement.textContent = step.requirement.replace("{count}", tutorial.progress);
    DOM.tutorialActionBtn.hidden = !step.action;
    DOM.tutorialActionBtn.textContent = step.action === "finish" ? "Запустить орбитальный цикл" : "Продолжить";
    DOM.tutorialAutoBtn.hidden = !step.auto;
    if (step.expected) {
      state.selectedBuild = step.expected;
      const def = getBuildDef(step.expected);
      if (def) state.category = def.category;
    }
    renderCategoryTabs();
    renderBuildList();
  }

  function tutorialPrimaryAction() {
    if (!state.tutorial.active) return;
    const step = TUTORIAL_STEPS[state.tutorial.step];
    if (step.action === "continue") {
      state.tutorial.step += 1;
      state.tutorial.progress = 0;
      selectBuild(TUTORIAL_STEPS[state.tutorial.step].expected);
      updateTutorialUI();
    } else if (step.action === "finish") {
      state.tutorial.active = false;
      state.waveTimer = 120;
      state.waveStarted = true;
      DOM.tutorialPanel.hidden = true;
      showBanner("ОРБИТАЛЬНЫЙ ЦИКЛ ЗАПУЩЕН // ВОЛНА ЧЕРЕЗ 02:00", 4);
      logEvent("Инструктаж завершён. Запущен двухминутный волновой цикл.");
      toast("Стартовые ресурсы сохранены. Первая волна через 2 минуты.");
      renderAllUI(true);
    }
  }

  const TUTORIAL_AUTO_POSITIONS = {
    steelStructure: [[36,16],[37,16],[38,16],[39,16],[36,17],[37,17],[38,17],[39,17],[36,18],[37,18],[38,18],[39,18]],
    manipulatorMechanical: [[39,17]],
    conveyorMechanical: [[35,17],[36,17],[37,17],[38,17]],
    crusher1: [[33,15]],
    grinder: [[33,19]],
    electromagneticFurnace: [[29,13]],
    assembler: [[29,22]],
    gradTurret: [[39,16]]
  };

  function autoBuildTutorialStep() {
    if (!state.tutorial.active) return;
    const step = TUTORIAL_STEPS[state.tutorial.step];
    if (!step?.expected) return;
    const desired = step.count - state.tutorial.progress;
    const positions = TUTORIAL_AUTO_POSITIONS[step.expected] || [];
    let built = 0;
    for (const [x, y] of positions) {
      if (built >= desired) break;
      if (placeBuildAt(step.expected, x, y, { free: true })) built++;
    }
    while (built < desired) {
      const spot = findBuildSpot(step.expected);
      if (!spot || !placeBuildAt(step.expected, spot.x, spot.y, { free: true })) break;
      built++;
    }
    if (!built) toast("Автопостройка не нашла свободного места. Разберите мешающие модули или расширьте каркас.", "warn");
  }

  function findBuildSpot(type) {
    const def = getBuildDef(type);
    const centerX = 36, centerY = 18;
    const candidates = [];
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) candidates.push({ x, y, d: Math.abs(x - centerX) + Math.abs(y - centerY) });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const spot of candidates) {
      const check = def.kind === "structure" ? canPlaceFoundation(type, spot.x, spot.y) : canPlaceModule(type, spot.x, spot.y, state.rotation);
      if (check.ok) return spot;
    }
    return null;
  }

  function clampCamera() {
    const cam = runtime.camera;
    const halfWorldW = CANVAS_W / (2 * cam.zoom);
    const halfWorldH = CANVAS_H / (2 * cam.zoom);
    if (halfWorldW >= CANVAS_W / 2) cam.x = CANVAS_W / 2;
    else cam.x = clamp(cam.x, halfWorldW, CANVAS_W - halfWorldW);
    if (halfWorldH >= CANVAS_H / 2) cam.y = CANVAS_H / 2;
    else cam.y = clamp(cam.y, halfWorldH, CANVAS_H - halfWorldH);
  }

  function worldToScreen(x, y) {
    const cam = runtime.camera;
    return { x: (x - cam.x) * cam.zoom + CANVAS_W / 2, y: (y - cam.y) * cam.zoom + CANVAS_H / 2 };
  }

  function screenToWorld(x, y) {
    const cam = runtime.camera;
    return { x: (x - CANVAS_W / 2) / cam.zoom + cam.x, y: (y - CANVAS_H / 2) / cam.zoom + cam.y };
  }

  function centerCameraOnStation(instant = false) {
    const core = getStationCorePoint();
    runtime.camera.x = core.x;
    runtime.camera.y = core.y;
    if (instant) runtime.camera.zoom = clamp(runtime.camera.zoom || 1, runtime.camera.minZoom, runtime.camera.maxZoom);
    clampCamera();
  }

  function applyWorldTransform(ctx) {
    const cam = runtime.camera;
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, CANVAS_W / 2 - cam.x * cam.zoom, CANVAS_H / 2 - cam.y * cam.zoom);
  }

  function getCanvasContentRect() {
    const box = DOM.canvas.getBoundingClientRect();
    const scale = Math.min(box.width / CANVAS_W, box.height / CANVAS_H);
    const width = CANVAS_W * scale;
    const height = CANVAS_H * scale;
    return {
      left: box.left + (box.width - width) / 2,
      top: box.top + (box.height - height) / 2,
      right: box.left + (box.width + width) / 2,
      bottom: box.top + (box.height + height) / 2,
      width,
      height
    };
  }

  function getCanvasPoint(event) {
    const rect = getCanvasContentRect();
    const sx = (event.clientX - rect.left) * (CANVAS_W / rect.width);
    const sy = (event.clientY - rect.top) * (CANVAS_H / rect.height);
    const world = screenToWorld(sx, sy);
    return {
      sx, sy, x: world.x, y: world.y,
      gx: Math.floor(world.x / TILE), gy: Math.floor(world.y / TILE),
      insideCanvas: event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    };
  }

  function beginCanvasPan(event) {
    if (!state || event.button !== 2) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point.insideCanvas) return;
    runtime.mouse = { ...point, inside: true };
    runtime.camera.dragging = true;
    runtime.camera.moved = false;
    runtime.camera.dragStartX = event.clientX;
    runtime.camera.dragStartY = event.clientY;
    runtime.camera.dragCameraX = runtime.camera.x;
    runtime.camera.dragCameraY = runtime.camera.y;
    DOM.frame.classList.add('is-panning');
    DOM.hoverTooltip.hidden = true;
  }

  function updateCanvasPan(event) {
    const point = getCanvasPoint(event);
    runtime.mouse = { ...point, inside: point.insideCanvas };
    if (!runtime.camera.dragging) return false;
    const dx = event.clientX - runtime.camera.dragStartX;
    const dy = event.clientY - runtime.camera.dragStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) runtime.camera.moved = true;
    runtime.camera.x = runtime.camera.dragCameraX - dx / runtime.camera.zoom;
    runtime.camera.y = runtime.camera.dragCameraY - dy / runtime.camera.zoom;
    clampCamera();
    return true;
  }

  function endCanvasPan() {
    runtime.camera.dragging = false;
    DOM.frame.classList.remove('is-panning');
  }

  function zoomCanvas(event) {
    if (!state) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point.insideCanvas) return;
    const factor = event.deltaY < 0 ? 1.13 : 1 / 1.13;
    const nextZoom = clamp(runtime.camera.zoom * factor, runtime.camera.minZoom, runtime.camera.maxZoom);
    if (Math.abs(nextZoom - runtime.camera.zoom) < 0.001) return;
    runtime.camera.zoom = nextZoom;
    runtime.camera.x = point.x - (point.sx - CANVAS_W / 2) / runtime.camera.zoom;
    runtime.camera.y = point.y - (point.sy - CANVAS_H / 2) / runtime.camera.zoom;
    clampCamera();
    updateHoverTooltip(event);
  }

  function gridLine(x0, y0, x1, y1) {
    const cells = [];
    let x = x0, y = y0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      cells.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * error;
      if (e2 >= dy) { error += dy; x += sx; }
      if (e2 <= dx) { error += dx; y += sy; }
    }
    return cells;
  }

  function getLineRotation(fromX, fromY, toX, toY, fallback) {
    const dx = toX - fromX, dy = toY - fromY;
    if (!dx && !dy) return fallback;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 1 : 3;
  }

  function shouldAutoRotateLine(type) {
    const def = getBuildDef(type);
    return Boolean(def && def.kind !== "structure" && (def.logistics || type === "heatPipe"));
  }

  function beginBuildStroke(event) {
    if (!state || event.button !== 0 || state.mode !== "build" || state.paused || state.gameOver || runtime.camera.dragging) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point.insideCanvas || point.gx < 0 || point.gy < 0 || point.gx >= GRID_W || point.gy >= GRID_H) return;
    const stroke = runtime.buildStroke;
    stroke.active = true;
    stroke.moved = false;
    stroke.startGX = point.gx;
    stroke.startGY = point.gy;
    stroke.lastGX = point.gx;
    stroke.lastGY = point.gy;
    stroke.axis = null;
    stroke.placed = 0;
    stroke.attempted = new Set();
    stroke.type = state.selectedBuild;
    stroke.startRotation = state.rotation;
    stroke.lastReason = "";
    stroke.suppressClick = true;
    stroke.firstModuleId = null;
    DOM.frame.classList.add("is-building");
    const result = {};
    if (placeBuildAt(stroke.type, point.gx, point.gy, { batch: true, silent: true, reasonTarget: stroke, resultTarget: result, rotation: stroke.startRotation })) {
      stroke.placed = 1;
      stroke.attempted.add(`${point.gx},${point.gy}`);
      stroke.firstModuleId = result.moduleId || null;
    }
    runtime.mouse = { ...point, inside: true };
  }

  function updateBuildStroke(event) {
    const stroke = runtime.buildStroke;
    if (!stroke.active || !state || state.mode !== "build") return false;
    if (!(event.buttons & 1)) { finishBuildStroke(); return false; }
    const rect = getCanvasContentRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return true;
    const point = getCanvasPoint(event);
    runtime.mouse = { ...point, inside: point.insideCanvas };
    const totalDX = point.gx - stroke.startGX;
    const totalDY = point.gy - stroke.startGY;
    if (!stroke.axis && (totalDX || totalDY)) stroke.axis = Math.abs(totalDX) >= Math.abs(totalDY) ? "x" : "y";
    if (!stroke.axis) return true;
    stroke.moved = true;

    const targetGX = stroke.axis === "x" ? point.gx : stroke.startGX;
    const targetGY = stroke.axis === "y" ? point.gy : stroke.startGY;
    const def = getBuildDef(stroke.type);
    if (!def) return false;
    const lineRotation = shouldAutoRotateLine(stroke.type)
      ? getLineRotation(stroke.startGX, stroke.startGY, targetGX, targetGY, stroke.startRotation)
      : stroke.startRotation;
    if (shouldAutoRotateLine(stroke.type)) {
      state.rotation = lineRotation;
      stroke.startRotation = lineRotation;
      DOM.rotationIndicator.textContent = `R ${state.rotation * 90}°`;
      if (stroke.firstModuleId) {
        const first = getStation().modules[stroke.firstModuleId];
        if (first && MODULES[first.type]?.w === 1 && MODULES[first.type]?.h === 1) first.rotation = lineRotation;
        stroke.firstModuleId = null;
      }
    }

    const size = def.kind === "structure" ? { w: 1, h: 1 } : rotatedSize(def.w, def.h, lineRotation);
    const step = stroke.axis === "x" ? Math.max(1, size.w) : Math.max(1, size.h);
    const delta = stroke.axis === "x" ? targetGX - stroke.startGX : targetGY - stroke.startGY;
    const direction = delta < 0 ? -1 : 1;
    const anchors = [];
    for (let offset = 0; offset <= Math.abs(delta); offset += step) {
      anchors.push({
        x: stroke.startGX + (stroke.axis === "x" ? direction * offset : 0),
        y: stroke.startGY + (stroke.axis === "y" ? direction * offset : 0)
      });
    }

    let progress = true;
    let pass = 0;
    while (progress && pass++ <= anchors.length) {
      progress = false;
      for (const cell of anchors) {
        if (!stroke.active || state.mode !== "build" || state.selectedBuild !== stroke.type) break;
        if (cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) continue;
        const key = `${cell.x},${cell.y}`;
        if (stroke.attempted.has(key)) continue;
        if (!canAfford(def.cost) && !state.tutorial.active) {
          stroke.lastReason = "Недостаточно ресурсов для продолжения линии";
          progress = false;
          break;
        }
        if (placeBuildAt(stroke.type, cell.x, cell.y, { batch: true, silent: true, reasonTarget: stroke, rotation: lineRotation })) {
          stroke.attempted.add(key);
          stroke.placed += 1;
          stroke.lastReason = "";
          progress = true;
        }
      }
    }
    stroke.lastGX = targetGX;
    stroke.lastGY = targetGY;
    return true;
  }

  function finishBuildStroke() {
    const stroke = runtime.buildStroke;
    if (!stroke.active) return;
    stroke.active = false;
    const def = getBuildDef(stroke.type);
    if (stroke.placed > 0 && def) {
      logEvent(`${stroke.placed > 1 ? "Проложена линия" : "Построен модуль"}: ${def.name} ×${stroke.placed}.`);
      if (stroke.placed > 1) toast(`Построено по линии: ${def.name} ×${stroke.placed}.`);
      renderAllUI(true);
    } else if (stroke.lastReason) {
      toast(stroke.lastReason, "warn");
    }
    DOM.frame.classList.remove("is-building");
    stroke.type = null;
    stroke.axis = null;
    stroke.firstModuleId = null;
    stroke.attempted = new Set();
    setTimeout(() => { stroke.suppressClick = false; }, 0);
  }

  function onCanvasClick(event) {
    if (!state || state.paused || state.gameOver) return;
    const point = getCanvasPoint(event);
    if (point.gx < 0 || point.gy < 0 || point.gx >= GRID_W || point.gy >= GRID_H) return;
    const station = getStation();
    const moduleId = station.moduleAt[point.gy][point.gx];

    if (state.mode === "build") {
      return;
    } else if (state.mode === "inspect") {
      if (moduleId) {
        runtime.selectedModuleId = moduleId;
        runtime.selectedEntityId = null;
        updateInspector(true);
      } else {
        const entity = findEntityAt(point.x, point.y);
        runtime.selectedEntityId = entity?.id || null;
        runtime.selectedModuleId = null;
        updateInspector(true);
      }
    } else if (state.mode === "demolish") {
      if (moduleId) dismantleModule(moduleId);
      else if (station.foundation[point.gy][point.gx]) dismantleFoundation(point.gx, point.gy);
    }
  }

  function dismantleModule(moduleId) {
    const station = getStation();
    const module = station.modules[moduleId];
    if (!module) return;
    if (module.protected || module.type === "fusionReactor") {
      toast("Критический модуль нельзя разобрать на активной станции.", "danger");
      return;
    }
    const def = MODULES[module.type];
    const rate = module.freeBuild ? 0 : getRefundRate();
    if (rate > 0) refundCost(def.cost, rate);
    removeModule(moduleId, false);
    logEvent(`Разобран модуль «${def.name}». Возврат: ${Math.round(rate * 100)}%.`);
    toast(`Возвращено ${Math.round(rate * 100)}% стоимости модуля.`);
    runtime.selectedModuleId = null;
    renderAllUI(true);
  }

  function dismantleFoundation(x, y) {
    const station = getStation();
    const foundation = station.foundation[y]?.[x];
    if (!foundation) return;
    if (station.moduleAt[y][x]) {
      toast("Сначала разберите установленный модуль.", "warn");
      return;
    }
    station.foundation[y][x] = null;
    if (findDisconnectedFoundationCells(station).length) {
      station.foundation[y][x] = foundation;
      toast("Удаление разорвёт связность станции. Снимайте каркас с внешнего края.", "danger");
      return;
    }
    const rate = foundation.freeBuild ? 0 : getRefundRate();
    if (rate > 0) refundCost(STRUCTURES[foundation.type].cost, rate);
    logEvent(`Разобрана несущая конструкция: ${STRUCTURES[foundation.type].name}. Возврат: ${Math.round(rate * 100)}%.`);
    renderAllUI(true);
  }

  function removeModule(moduleId, destroyed = true) {
    const station = getStation();
    const module = station.modules[moduleId];
    if (!module) return;
    const def = MODULES[module.type];
    const size = rotatedSize(def.w, def.h, module.rotation);
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        if (station.moduleAt[module.y + dy]?.[module.x + dx] === moduleId) station.moduleAt[module.y + dy][module.x + dx] = null;
        if (destroyed) {
          const f = station.foundation[module.y + dy]?.[module.x + dx];
          if (f) f.hp = Math.max(1, f.hp - f.maxHp * 0.25);
        }
      }
    }
    if (destroyed && (module.type === "crewBunk" || module.type === "lifeSupport")) {
      const losses = Math.min(station.crew, Math.ceil(Math.random() * 2));
      station.crew -= losses;
      if (losses) logEvent(`Потери экипажа при разрушении отсека: ${losses}.`);
    }
    delete station.modules[moduleId];
    if (module.type === "fusionReactor" && destroyed) triggerGameOver("Термоядерный реактор уничтожен");
  }

  function findDisconnectedFoundationCells(station = getStation()) {
    const core = Object.values(station.modules).find((module) => module.type === "fusionReactor");
    if (!core) return [];
    const start = { x: core.x, y: core.y };
    if (!station.foundation[start.y]?.[start.x]) return [];
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = current.x + ox, ny = current.y + oy, key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H || seen.has(key) || !station.foundation[ny][nx]) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    const disconnected = [];
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (station.foundation[y][x] && !seen.has(`${x},${y}`)) disconnected.push({ x, y });
    return disconnected;
  }

  function collapseDisconnectedFoundation() {
    const station = getStation();
    const disconnected = findDisconnectedFoundationCells(station);
    if (!disconnected.length) return;
    const moduleIds = new Set();
    disconnected.forEach(({ x, y }) => {
      if (station.moduleAt[y][x]) moduleIds.add(station.moduleAt[y][x]);
      station.foundation[y][x] = null;
    });
    moduleIds.forEach((id) => removeModule(id, true));
    logEvent(`От станции оторвано ${disconnected.length} тайлов каркаса.`);
    toast("Несвязанный фрагмент станции потерян!", "danger");
  }

  function findEntityAt(x, y) {
    let best = null, bestDistance = Infinity;
    for (const entity of runtime.entities) {
      const distance = Math.hypot(entity.x - x, entity.y - y);
      if (distance <= (entity.radius || 5) + 4 && distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }
    return best;
  }

  function renderAllUI(forceBuild = false) {
    if (!state) return;
    runtime.currentStats = calculateStationStats();
    renderTopbar();
    renderStationSelect();
    renderStatus(runtime.currentStats);
    renderResources();
    renderCompactStats(runtime.currentStats);
    if (forceBuild) {
      renderCategoryTabs();
      renderBuildList();
    }
    if (state.mode !== "build") updateInspector(false);
  }

  function renderTopbar() {
    DOM.waveNumber.textContent = state.wave;
    DOM.scoreValue.textContent = format(state.score);
    DOM.researchValue.textContent = format(state.researchPoints);
    DOM.pauseBtn.textContent = state.paused ? "▶" : "Ⅱ";
    DOM.thermalToggle.classList.toggle("is-active", state.thermalView);
    DOM.rotationIndicator.textContent = `R ${state.rotation * 90}°`;
    $$(".speed-btn").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.speed) === state.speed));
    document.body.classList.toggle("is-paused", state.paused);

    if (state.tutorial.active) {
      DOM.waveTimer.textContent = "ОБУЧЕНИЕ";
      DOM.waveProgress.style.width = "0%";
    } else {
      DOM.waveTimer.textContent = formatTime(state.waveTimer);
      const maximum = Math.max(120, state.waveTimer);
      DOM.waveProgress.style.width = `${clamp((1 - state.waveTimer / maximum) * 100, 0, 100)}%`;
    }
  }

  function renderStationSelect() {
    const signature = state.stations.map((station, index) => `${index}:${station.id || station.name}:${station.name}`).join("|");
    if (DOM.stationSelect.dataset.signature !== signature) {
      const focused = document.activeElement === DOM.stationSelect;
      const previous = DOM.stationSelect.value;
      DOM.stationSelect.innerHTML = "";
      state.stations.forEach((station, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${index + 1}. ${station.name}`;
        DOM.stationSelect.appendChild(option);
      });
      DOM.stationSelect.dataset.signature = signature;
      if (focused && previous && Number(previous) < state.stations.length) DOM.stationSelect.value = previous;
    }
    const current = String(state.currentStation);
    if (DOM.stationSelect.value !== current && document.activeElement !== DOM.stationSelect) DOM.stationSelect.value = current;
  }

  function setMetric(element, bar, value, max, text, warningAt = 0.75, dangerAt = 0.92, invert = false) {
    const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
    element.textContent = text;
    bar.style.width = `${ratio * 100}%`;
    const metric = element.closest(".metric");
    const dangerous = invert ? ratio < (1 - dangerAt) : ratio > dangerAt;
    const warning = invert ? ratio < (1 - warningAt) : ratio > warningAt;
    metric.classList.toggle("is-danger", dangerous);
    metric.classList.toggle("is-warning", !dangerous && warning);
  }

  function renderStatus(stats) {
    const hullRatio = stats.hullMax > 0 ? stats.hullHp / stats.hullMax : 0;
    setMetric(DOM.hullMetric, DOM.hullBar, stats.hullHp, stats.hullMax, `${Math.round(hullRatio * 100)}%`, 0.75, 0.9, true);
    setMetric(DOM.powerMetric, DOM.powerBar, stats.powerDemand, Math.max(1, stats.powerOutput), `${format(stats.powerDemand)} / ${format(stats.powerOutput)}`, 0.8, 1.0);
    setMetric(DOM.crewMetric, DOM.crewBar, stats.jobs, Math.max(1, stats.availableCrew), `${stats.availableCrew} / ${stats.beds} · мест ${stats.jobs}`, 0.8, 1.0);
    setMetric(DOM.tempMetric, DOM.tempBar, stats.maxTemp, 1100, `${Math.round(stats.averageTemp)} K · max ${Math.round(stats.maxTemp)}`, 0.65, 0.82);
    setMetric(DOM.radiationMetric, DOM.radiationBar, stats.radiation, 20, `${stats.radiation.toFixed(1)} мЗв`, 0.5, 0.8);
    setMetric(DOM.storageMetric, DOM.storageBar, stats.storageUsed, Math.max(1, stats.storageCapacity), `${format(stats.storageUsed)} / ${format(stats.storageCapacity)}`, 0.78, 0.95);
  }

  function renderResources() {
    const entries = Object.entries(RESOURCES).filter(([key]) => state.resourceViewAll || (state.inventory[key] || 0) > 0);
    entries.sort((a, b) => a[1].category.localeCompare(b[1].category, "ru") || a[1].name.localeCompare(b[1].name, "ru"));
    const visible = state.resourceViewAll ? entries : entries.slice(0, 25);
    const keys = visible.map(([key]) => key);
    const signature = keys.join("|");
    const scrollTop = DOM.resourceList.scrollTop;
    if (DOM.resourceList.dataset.signature !== signature) {
      DOM.resourceList.innerHTML = visible.map(([key, def]) => {
        const amount = state.inventory[key] || 0;
        return `<div class="resource-row ${amount <= 0 ? "is-zero" : ""}" data-resource-key="${key}" title="${escapeHtml(def.description)}">
          <img class="resource-icon" src="${spriteUrl("resource", key)}" alt="" draggable="false">
          <span class="resource-name">${escapeHtml(def.name)}</span>
          <b class="resource-amount">${format(amount)}</b>
        </div>`;
      }).join("") || `<div class="empty-state">Грузовой реестр пуст.</div>`;
      DOM.resourceList.dataset.signature = signature;
      DOM.resourceList.scrollTop = scrollTop;
    } else {
      for (const key of keys) {
        const row = DOM.resourceList.querySelector(`[data-resource-key="${key}"]`);
        if (!row) continue;
        const amount = state.inventory[key] || 0;
        row.classList.toggle("is-zero", amount <= 0);
        const amountNode = row.querySelector(".resource-amount");
        const text = format(amount);
        if (amountNode && amountNode.textContent !== text) amountNode.textContent = text;
      }
    }
    DOM.resourceModeBtn.textContent = state.resourceViewAll ? "ВАЖНЫЕ" : "ВСЕ";
  }

  function renderCompactStats(stats) {
    DOM.compactStats.innerHTML = `
      <span>Эффективность</span><b>${Math.round(stats.efficiency * 100)}%</b>
      <span>Масса станции</span><b>${format(stats.mass)} т</b>
      <span>Логистика</span><b>${Math.round(stats.logisticsEfficiency * 100)}%</b>
      <span>Охлаждение</span><b>${format(stats.cooling)} МВт</b>
      <span>Теплота</span><b>${format(stats.totalHeat)} МДж</b>
      <span>Нулевая точка</span><b>${format(getStation().zeroPointReserve || 0)}</b>
      <span>Возврат разборки</span><b>${Math.round(getRefundRate() * 100)}%</b>
      <span>Уничтожено целей</span><b>${format(state.kills + state.asteroidsDestroyed)}</b>`;
  }

  function getAllBuildables() {
    return { ...STRUCTURES, ...MODULES };
  }

  function renderCategoryTabs() {
    const all = getAllBuildables();
    const categories = CATEGORY_ORDER.filter((category) => Object.values(all).some((def) => def.category === category));
    DOM.categoryTabs.innerHTML = categories.map((category) => `<button class="${state.category === category ? "is-active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
    $$("button", DOM.categoryTabs).forEach((button) => button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderCategoryTabs();
      renderBuildList();
    }));
  }

  function renderBuildList() {
    const scrollTop = DOM.buildList.scrollTop;
    const all = getAllBuildables();
    const query = DOM.buildSearch.value.trim().toLowerCase();
    const tutorialExpected = state.tutorial.active ? TUTORIAL_STEPS[state.tutorial.step]?.expected : null;
    const entries = Object.entries(all)
      .filter(([id, def]) => def.category === state.category)
      .filter(([id]) => id !== "fusionReactor")
      .filter(([id, def]) => !query || `${def.name} ${def.description}`.toLowerCase().includes(query))
      .sort((a, b) => a[1].name.localeCompare(b[1].name, "ru"));

    DOM.buildList.innerHTML = entries.map(([id, def]) => {
      const unlocked = isBuildUnlocked(id);
      const tutorialLocked = tutorialExpected && id !== tutorialExpected;
      const techName = def.tech ? TECHNOLOGIES[def.tech]?.name : "";
      const size = def.kind === "structure" ? "1×1" : `${def.w}×${def.h}`;
      return `<button class="build-card ${state.selectedBuild === id ? "is-selected" : ""} ${!unlocked ? "is-locked" : ""} ${tutorialLocked ? "is-tutorial-locked" : ""}" data-build="${id}" ${!unlocked || tutorialLocked ? "disabled" : ""} title="${!unlocked ? `Требуется: ${escapeHtml(techName)}` : escapeHtml(def.description)}">
        <span class="build-icon"><img src="${spriteUrl(def.kind === "structure" ? "structure" : "module", id)}" alt="" draggable="false"></span>
        <span class="build-copy"><strong>${escapeHtml(def.name)}</strong><p>${size} · ${escapeHtml(def.description)}</p></span>
        <span class="cost-line">${state.tutorial.active && tutorialExpected === id ? `<span class="cost-chip">УЧЕБНЫЙ КОМПЛЕКТ</span>` : Object.entries(normalizeCost(def.cost)).map(([key, amount]) => `<span class="cost-chip ${(state.inventory[key] || 0) < amount ? "missing" : ""}">${RESOURCES[key].short} ${amount}</span>`).join("")}</span>
      </button>`;
    }).join("") || `<div class="empty-state">В этой категории пока нет доступных модулей.</div>`;

    $$(".build-card", DOM.buildList).forEach((card) => card.addEventListener("click", () => selectBuild(card.dataset.build)));
    DOM.buildList.scrollTop = scrollTop;
  }

  function updateInspector(force = false) {
    if (!state || state.mode === "build") return;
    const station = getStation();
    const module = runtime.selectedModuleId ? station.modules[runtime.selectedModuleId] : null;
    const entity = runtime.selectedEntityId ? runtime.entities.find((item) => item.id === runtime.selectedEntityId) : null;

    if (module) {
      const def = MODULES[module.type];
      const recipes = getCompatibleRecipes(module.type);
      const recipeSignature = recipes.map((item) => item.id).join("|");
      const inspectKey = `module:${station.id || state.currentStation}:${module.id}`;
      const sameInspector = DOM.inspectContent.dataset.inspectKey === inspectKey;
      const activeRecipeSelect = sameInspector && document.activeElement === $("#recipeSelect", DOM.inspectContent);
      const canPatch = (!force && sameInspector && DOM.inspectContent.dataset.recipeSignature === recipeSignature) || activeRecipeSelect;
      if (canPatch) {
        patchModuleInspector(module);
        return;
      }

      const sameSelection = DOM.inspectContent.dataset.inspectKey === inspectKey;
      const scrollTop = sameSelection ? DOM.inspectContent.scrollTop : 0;
      const supportProfile = getModuleSupportProfile(module, station);
      const recipe = RECIPES.find((item) => item.id === module.recipeId);
      const repairCost = getRepairCost(module);
      let special = "";

      if (recipes.length) {
        special += `<div class="inspect-section"><h4>ПРОИЗВОДСТВЕННЫЙ РЕЦЕПТ</h4>
          <select id="recipeSelect" class="recipe-select" aria-label="Производственный рецепт">${recipes.map((item) => `<option value="${item.id}" ${item.id === module.recipeId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>
          <div class="module-progress"><i data-inspect-progress style="width:${clamp(module.progress * 100, 0, 100)}%"></i></div>
          <p class="recipe-line" data-inspect-recipe>${recipe ? `${formatRecipeSide(recipe.inputs)} → ${formatRecipeSide(recipe.outputs)} · ${recipe.time} сек.` : "Выберите рецепт."}</p></div>`;
      }

      if (def.fuel) {
        special += `<div class="inspect-section"><h4>ТОПЛИВО</h4><div class="inspect-grid"><span>Ячейка</span><b>${RESOURCES[def.fuel.key].name}</b><span>Остаток цикла</span><b data-inspect-fuel>${Math.ceil(module.fuelRemaining || 0)} сек.</b></div></div>`;
      }

      if (module.type === "gravityWell") special += renderGravityWellInspector(module);
      if (module.type === "orbitalPrinter") special += renderOrbitalPrinterInspector(module);

      DOM.inspectContent.className = "inspect-content";
      DOM.inspectContent.dataset.inspectKey = inspectKey;
      DOM.inspectContent.dataset.recipeSignature = recipeSignature;
      DOM.inspectContent.innerHTML = `
        <div class="inspect-hero"><img class="inspect-symbol inspect-sprite" src="${spriteUrl("module", module.type)}" alt="" draggable="false"><h3>${escapeHtml(def.name)}</h3><p>${escapeHtml(def.description)}</p></div>
        <div class="inspect-grid">
          <span>Состояние</span><b data-inspect-status>${escapeHtml(module.status || "Готов")}</b>
          <span>Прочность</span><b data-inspect-hp>${Math.ceil(module.hp)} / ${module.maxHp}</b>
          <span>Температура</span><b data-inspect-temp>${Math.round(module.heat)} K</b>
          <span>Опорный каркас</span><b>${escapeHtml(supportProfile.names.join(", "))}</b>
          <span>Теплоёмкость опоры</span><b>${supportProfile.heatCapacity}</b>
          <span>Энергия</span><b>${def.energyOutput ? `+${def.energyOutput}` : `−${def.energyUse}`} МВт</b>
          <span>Рабочие места</span><b>${def.crew}</b>
          <span>Масса модуль + опора</span><b>${def.mass} + ${supportProfile.mass} т</b>
          <span>Поворот</span><b data-inspect-rotation>${module.rotation * 90}°</b>
        </div>
        ${special}
        <div class="inspect-actions">
          <button id="inspectRotate">Повернуть [R]</button>
          <button id="inspectRepair" data-inspect-repair>Ремонт ${Object.entries(repairCost).filter(([, amount]) => amount > 0).map(([key, amount]) => `${RESOURCES[key].short} ${amount}`).join(" ")}</button>
          <button id="inspectDismantle" class="danger" ${module.protected || module.type === "fusionReactor" ? "disabled" : ""}>Разобрать (<span data-inspect-refund>${Math.round((module.freeBuild ? 0 : getRefundRate()) * 100)}</span>%)</button>
          <button id="inspectCenter">Центрировать</button>
        </div>`;

      const recipeSelect = $("#recipeSelect", DOM.inspectContent);
      recipeSelect?.addEventListener("change", (event) => {
        module.recipeId = event.target.value;
        module.progress = 0;
        patchModuleInspector(module);
      });
      $("#inspectRotate", DOM.inspectContent)?.addEventListener("click", () => rotatePlacedModule(module.id));
      $("#inspectRepair", DOM.inspectContent)?.addEventListener("click", () => repairModule(module.id));
      $("#inspectDismantle", DOM.inspectContent)?.addEventListener("click", () => dismantleModule(module.id));
      $("#inspectCenter", DOM.inspectContent)?.addEventListener("click", () => {
        const center = getModuleCenter(module);
        runtime.camera.x = center.x;
        runtime.camera.y = center.y;
        clampCamera();
      });
      bindGravityWellButtons(module);
      bindOrbitalPrinterButtons(module);
      patchModuleInspector(module);
      DOM.inspectContent.scrollTop = scrollTop;
      return;
    }

    if (entity) {
      const inspectKey = `entity:${entity.id}`;
      if (!force && DOM.inspectContent.dataset.inspectKey === inspectKey) {
        const hp = DOM.inspectContent.querySelector("[data-inspect-entity-hp]");
        if (hp) hp.textContent = `${Math.ceil(entity.hp)} / ${entity.maxHp}`;
        return;
      }
      const name = entity.kind === "asteroid" ? `Астероид: ${RESOURCES[entity.resourceKey]?.name || "неизвестный состав"}` : ENEMIES[entity.enemyType]?.name || "Объект";
      DOM.inspectContent.className = "inspect-content";
      DOM.inspectContent.dataset.inspectKey = inspectKey;
      DOM.inspectContent.dataset.recipeSignature = "";
      DOM.inspectContent.innerHTML = `<div class="inspect-hero"><img class="inspect-symbol inspect-sprite" src="${spriteUrl(entity.kind === "asteroid" ? "asteroid" : "enemy", entity.kind === "asteroid" ? entity.resourceKey : entity.enemyType)}" alt="" draggable="false"><h3>${escapeHtml(name)}</h3><p>${entity.kind === "asteroid" ? "Может быть разрушен и собран манипуляторами." : "Враждебный объект волновой группы."}</p></div>
        <div class="inspect-grid"><span>Прочность</span><b data-inspect-entity-hp>${Math.ceil(entity.hp)} / ${entity.maxHp}</b><span>Скорость</span><b>${entity.speed?.toFixed(1) || "—"}</b><span>Броня</span><b>${entity.armor || 0}</b><span>Награда</span><b>${entity.reward || entity.amount || 0}</b></div>`;
      return;
    }

    if (DOM.inspectContent.dataset.inspectKey !== "empty") {
      DOM.inspectContent.className = "inspect-content empty-state";
      DOM.inspectContent.dataset.inspectKey = "empty";
      DOM.inspectContent.dataset.recipeSignature = "";
      DOM.inspectContent.textContent = "Выберите модуль или объект на поле.";
    }
  }

  function patchModuleInspector(module) {
    if (!module || DOM.inspectContent.dataset.inspectKey?.split(":").pop() !== module.id) return;
    const def = MODULES[module.type];
    const setText = (selector, value) => {
      const node = DOM.inspectContent.querySelector(selector);
      if (node && node.textContent !== String(value)) node.textContent = String(value);
    };
    setText("[data-inspect-status]", module.status || "Готов");
    setText("[data-inspect-hp]", `${Math.ceil(module.hp)} / ${module.maxHp}`);
    setText("[data-inspect-temp]", `${Math.round(module.heat)} K`);
    setText("[data-inspect-rotation]", `${module.rotation * 90}°`);
    if (def.fuel) setText("[data-inspect-fuel]", `${Math.ceil(module.fuelRemaining || 0)} сек.`);

    const recipes = getCompatibleRecipes(module.type);
    const recipe = RECIPES.find((item) => item.id === module.recipeId);
    const select = $("#recipeSelect", DOM.inspectContent);
    if (select && module.recipeId && select.value !== module.recipeId && document.activeElement !== select) select.value = module.recipeId;
    const progress = DOM.inspectContent.querySelector("[data-inspect-progress]");
    if (progress) progress.style.width = `${clamp(module.progress * 100, 0, 100)}%`;
    const recipeLine = DOM.inspectContent.querySelector("[data-inspect-recipe]");
    if (recipeLine) recipeLine.textContent = recipe ? `${formatRecipeSide(recipe.inputs)} → ${formatRecipeSide(recipe.outputs)} · ${recipe.time} сек.` : recipes.length ? "Выберите рецепт." : "";

    const repairCost = getRepairCost(module);
    const repairButton = $("#inspectRepair", DOM.inspectContent);
    if (repairButton) {
      const canRepair = module.hp < module.maxHp && canAfford(repairCost);
      repairButton.disabled = !canRepair;
      repairButton.textContent = `Ремонт ${Object.entries(repairCost).filter(([, amount]) => amount > 0).map(([key, amount]) => `${RESOURCES[key].short} ${amount}`).join(" ")}`.trim();
    }
    const rotateButton = $("#inspectRotate", DOM.inspectContent);
    if (rotateButton) rotateButton.disabled = def.w === def.h && !def.weapon && !def.logistics;
    setText("[data-inspect-refund]", Math.round((module.freeBuild ? 0 : getRefundRate()) * 100));

    if (module.type === "gravityWell") {
      const ready = module.gravityCooldown <= 0;
      setText("[data-gravity-status]", ready ? "ГОТОВ" : `${Math.ceil(module.gravityCooldown)} сек.`);
      $$('[data-gravity]', DOM.inspectContent).forEach((button) => { button.disabled = !ready; });
    }
    if (module.type === "orbitalPrinter") {
      const bar = DOM.inspectContent.querySelector("[data-orbital-progress]");
      if (bar) bar.style.width = `${clamp(module.printProgress || 0, 0, 100)}%`;
      const button = $("#startOrbitalPrint", DOM.inspectContent);
      if (button) {
        button.disabled = module.printPaid || !canAfford(NEW_REACTOR_PRINT_COST);
        button.textContent = module.printPaid ? "ПЕЧАТЬ ИДЁТ" : "ЗАГРУЗИТЬ МАТЕРИАЛЫ";
      }
      setText("[data-orbital-copy]", module.printPaid ? "Материалы загружены. Принтер работает только при достаточной энергии и экипаже." : "Проект создаст новую станцию с термоядерным реактором. Текущая станция останется доступна в переключателе.");
    }
  }

  function getRepairCost(module) {
    const missingRatio = 1 - module.hp / module.maxHp;
    if (missingRatio <= 0) return {};
    const def = MODULES[module.type];
    const base = Math.max(1, Math.ceil(missingRatio * def.w * def.h * 5));
    return { steelFrames: base, copperWire: Math.max(0, Math.floor(base / 3)) };
  }

  function repairModule(moduleId) {
    const module = getStation().modules[moduleId];
    if (!module) return;
    const cost = getRepairCost(module);
    if (!canAfford(cost)) {
      toast("Недостаточно материалов для ремонта.", "warn");
      return;
    }
    payCost(cost);
    module.hp = module.maxHp;
    module.status = "Отремонтирован";
    logEvent(`Отремонтирован модуль «${MODULES[module.type].name}».`);
    updateInspector();
    renderAllUI(true);
  }

  function formatRecipeSide(side) {
    return Object.entries(side).map(([key, amount]) => `${RESOURCES[key]?.short || key}×${amount}`).join(" + ");
  }

  function renderGravityWellInspector(module) {
    const ready = module.gravityCooldown <= 0;
    return `<div class="inspect-section"><h4>УПРАВЛЕНИЕ ВОЛНОЙ // КД 120 СЕК.</h4>
      <p class="recipe-line">Статус: <b data-gravity-status>${ready ? "ГОТОВ" : `${Math.ceil(module.gravityCooldown)} сек.`}</b>. Каждый импульс расходует хладагент, энергию и создаёт огромный тепловой выброс.</p>
      <div class="gravity-grid">
        <button data-gravity="delay30" ${!ready ? "disabled" : ""}>+30 сек.<br>12 Cry / 420 МВт</button>
        <button data-gravity="delay60" ${!ready ? "disabled" : ""}>+60 сек.<br>20 Cry / 620 МВт</button>
        <button data-gravity="advance45" ${!ready ? "disabled" : ""}>−45 сек.<br>10 Cry / 360 МВт</button>
        <button data-gravity="now" ${!ready ? "disabled" : ""}>ВОЛНА СЕЙЧАС<br>16 Cry / 520 МВт</button>
      </div></div>`;
  }

  function bindGravityWellButtons(module) {
    $$('[data-gravity]', DOM.inspectContent).forEach((button) => button.addEventListener("click", () => useGravityWell(module.id, button.dataset.gravity)));
  }

  const GRAVITY_ACTIONS = {
    delay30: { delta: 30, coolant: 12, power: 420, heat: 340, label: "Волна отсрочена на 30 секунд" },
    delay60: { delta: 60, coolant: 20, power: 620, heat: 520, label: "Волна отсрочена на 60 секунд" },
    advance45: { delta: -45, coolant: 10, power: 360, heat: 300, label: "Волна приближена на 45 секунд" },
    now: { delta: -9999, coolant: 16, power: 520, heat: 430, label: "Гравитационный импульс вызвал волну немедленно" }
  };

  function useGravityWell(moduleId, actionId) {
    const station = getStation();
    const module = station.modules[moduleId];
    const action = GRAVITY_ACTIONS[actionId];
    const stats = calculateStationStats();
    if (!module || module.type !== "gravityWell" || !action || module.gravityCooldown > 0) return;
    if (state.tutorial.active) {
      toast("Волновой цикл ещё не запущен.", "warn");
      return;
    }
    if ((state.inventory.coolantCapsules || 0) < action.coolant) {
      toast("Недостаточно капсул охладителя.", "danger");
      return;
    }
    const pulseCapacity = (station.powerBuffer || 0) + Math.max(0, stats.powerOutput - stats.powerDemand) * 10;
    if (pulseCapacity < action.power) {
      toast(`Для импульса требуется ${action.power} МВт доступной энергии или накопленного буфера.`, "danger");
      return;
    }
    state.inventory.coolantCapsules -= action.coolant;
    const fromBuffer = Math.min(station.powerBuffer || 0, action.power);
    station.powerBuffer = Math.max(0, (station.powerBuffer || 0) - fromBuffer);
    station.energyDebt = (station.energyDebt || 0) + Math.max(0, action.power - fromBuffer);
    module.heat += action.heat;
    module.gravityCooldown = 120;
    if (actionId === "now") {
      state.waveTimer = 0;
      triggerWave();
    } else {
      state.waveTimer = Math.max(0, state.waveTimer + action.delta);
      if (state.waveTimer <= 0) triggerWave();
    }
    state.score += actionId.startsWith("delay") ? 25 : 50;
    showBanner(action.label.toUpperCase(), 3);
    logEvent(`${action.label}. Расход: ${action.coolant} капсул охладителя.`);
    updateInspector();
    renderAllUI(true);
  }

  const NEW_REACTOR_PRINT_COST = {
    heavySteel: 260, titaniumHeavy: 170, titaniumComposite: 120,
    superconductors: 95, diamonds: 55, superalloy: 75, coolantCapsules: 90
  };

  function renderOrbitalPrinterInspector(module) {
    const paid = module.printPaid;
    return `<div class="inspect-section"><h4>ПЕЧАТЬ НОВОГО РЕАКТОРА</h4>
      <p class="recipe-line" data-orbital-copy>${paid ? "Материалы загружены. Принтер работает только при достаточной энергии и экипаже." : "Проект создаст новую станцию с термоядерным реактором. Текущая станция останется доступна в переключателе."}</p>
      <div class="module-progress"><i data-orbital-progress style="width:${clamp(module.printProgress || 0, 0, 100)}%"></i></div>
      <div class="tech-costs" style="margin-top:7px">${costText(NEW_REACTOR_PRINT_COST, true)}</div>
      <div class="inspect-actions"><button id="startOrbitalPrint" ${paid || !canAfford(NEW_REACTOR_PRINT_COST) ? "disabled" : ""}>${paid ? "ПЕЧАТЬ ИДЁТ" : "ЗАГРУЗИТЬ МАТЕРИАЛЫ"}</button></div>
    </div>`;
  }

  function bindOrbitalPrinterButtons(module) {
    $("#startOrbitalPrint")?.addEventListener("click", () => {
      if (module.printPaid || !canAfford(NEW_REACTOR_PRINT_COST)) return;
      payCost(NEW_REACTOR_PRINT_COST);
      module.printPaid = true;
      module.printProgress = 0;
      logEvent("Орбитальный принтер начал фабрикацию нового термоядерного реактора.");
      showBanner("ОРБИТАЛЬНАЯ ФАБРИКАЦИЯ НАЧАТА", 3.5);
      updateInspector();
      renderAllUI(true);
    });
  }

  function completeOrbitalPrint(module) {
    module.printPaid = false;
    module.printProgress = 0;
    const index = state.stations.length + 1;
    const newStation = createStation(`Ковчег-${String(index).padStart(2, "0")}`);
    newStation.crew = 6;
    state.stations.push(newStation);
    state.score += 5000;
    getStation().printedCores += 1;
    logEvent(`Напечатан новый реактор. Создана станция «${newStation.name}».`);
    showModal({
      eyebrow: "ORBITAL PRINTER // SUCCESS",
      title: "Новая станция создана",
      body: `<p>Термоядерный реактор и стартовый каркас станции <strong>${escapeHtml(newStation.name)}</strong> готовы. Исследования и общий грузовой реестр принадлежат всему флоту.</p>`,
      actions: [
        { label: "Остаться здесь", close: true },
        { label: "Перейти на новую станцию", primary: true, onClick: () => switchStation(state.stations.length - 1) }
      ]
    });
    renderAllUI(true);
  }

  function switchStation(index) {
    const target = Number(index);
    if (!Number.isInteger(target) || target < 0 || target >= state.stations.length) return;
    state.currentStation = target;
    runtime.entities.length = 0;
    runtime.projectiles.length = 0;
    runtime.loot.length = 0;
    runtime.effects.length = 0;
    runtime.selectedModuleId = null;
    runtime.selectedEntityId = null;
    DOM.inspectContent.dataset.inspectKey = "";
    centerCameraOnStation(true);
    logEvent(`Управление переключено на станцию «${getStation().name}».`);
    renderAllUI(true);
    updateInspector();
  }

  function renderResearchTree() {
    const scrollLeft = DOM.researchTree.scrollLeft;
    const scrollTop = DOM.researchTree.scrollTop;
    const cap = getWaveTierCap();
    DOM.researchOverlayPoints.textContent = format(state.researchPoints);
    DOM.researchCapText.textContent = `Текущий предел: уровень ${cap}. Уровень II открывается после волны 3, III — после 6, IV — после 10; гравитационная инженерия требует волну 12.`;
    DOM.researchTree.innerHTML = [1,2,3,4].map((tier) => {
      const cards = Object.entries(TECHNOLOGIES).filter(([, tech]) => tech.tier === tier).map(([id, tech]) => {
        const researched = state.researched.includes(id);
        const available = isTechAvailable(id);
        const locked = !researched && !available;
        const reasons = [];
        if (tech.tier > cap) reasons.push(`достигните волны ${tier === 2 ? 3 : tier === 3 ? 6 : 10}`);
        if (tech.minWave && state.wave < tech.minWave) reasons.push(`требуется волна ${tech.minWave}`);
        const missingPrereq = tech.prereq.filter((pre) => !state.researched.includes(pre));
        if (missingPrereq.length) reasons.push(`нужны: ${missingPrereq.map((pre) => TECHNOLOGIES[pre].name).join(", ")}`);
        const pointMissing = state.researchPoints < tech.points;
        return `<article class="tech-card ${researched ? "is-researched" : ""} ${locked ? "is-locked" : ""}" data-tech="${id}" title="${locked ? escapeHtml(reasons.join("; ")) : ""}">
          <h4>${escapeHtml(tech.name)}</h4><p>${escapeHtml(tech.description)}</p>
          <div class="tech-costs"><span class="${pointMissing && !researched ? "missing" : ""}">◈ ${tech.points}</span>${Object.entries(normalizeCost(tech.cost)).map(([key, amount]) => `<span class="${(state.inventory[key] || 0) < amount && !researched ? "missing" : ""}">${RESOURCES[key].short} ${amount}</span>`).join("")}</div>
        </article>`;
      }).join("");
      return `<section class="tech-column"><h3>УРОВЕНЬ ${tier}${tier > cap ? " // ЗАКРЫТ" : ""}</h3>${cards}</section>`;
    }).join("");
    $$(".tech-card", DOM.researchTree).forEach((card) => card.addEventListener("click", () => researchTechnology(card.dataset.tech)));
    DOM.researchTree.scrollLeft = scrollLeft;
    DOM.researchTree.scrollTop = scrollTop;
  }

  function researchTechnology(id) {
    const tech = TECHNOLOGIES[id];
    if (!tech || state.researched.includes(id)) return;
    if (!isTechAvailable(id)) {
      toast("Технология пока закрыта пределом раундов или зависимостями.", "warn");
      return;
    }
    if (state.researchPoints < tech.points || !canAfford(tech.cost)) {
      toast("Недостаточно очков исследования или ресурсов.", "danger");
      return;
    }
    state.researchPoints -= tech.points;
    payCost(tech.cost);
    state.researched.push(id);
    state.score += tech.points * 4;
    logEvent(`Исследована технология: ${tech.name}.`);
    showBanner(`ИССЛЕДОВАНИЕ ЗАВЕРШЕНО // ${tech.name.toUpperCase()}`, 3);
    toast(id === "deepRecycling" ? "Возврат при разборке повышен до 70%." : `Открыто: ${tech.name}.`);
    renderResearchTree();
    renderAllUI(true);
  }

  let codexMode = "resources";
  function renderCodex(mode = codexMode) {
    codexMode = mode;
    $$('[data-codex]', DOM.codexTabs).forEach((button) => button.classList.toggle("is-active", button.dataset.codex === mode));
    if (mode === "resources") {
      DOM.codexContent.innerHTML = `<div class="codex-grid">${Object.entries(RESOURCES).map(([key, item]) => `<article class="codex-card"><img class="codex-sprite" src="${spriteUrl("resource", key)}" alt="" draggable="false"><h3>${escapeHtml(item.name)} <small>${escapeHtml(item.short)}</small></h3><p>${escapeHtml(item.category)} · ${escapeHtml(item.description)}</p></article>`).join("")}</div>`;
    } else if (mode === "recipes") {
      DOM.codexContent.innerHTML = `<div class="codex-grid">${RECIPES.map((item) => `<article class="codex-card"><h3>${escapeHtml(item.name)}</h3><p class="recipe-line"><b>${formatRecipeSide(item.inputs)}</b> → <b>${formatRecipeSide(item.outputs)}</b></p><p>Этап ${item.stage} · ${item.time} сек. ${item.tech ? `· ${TECHNOLOGIES[item.tech].name}` : ""}</p></article>`).join("")}</div>`;
    } else if (mode === "enemies") {
      DOM.codexContent.innerHTML = `<div class="codex-grid">${Object.entries(ENEMIES).map(([key, enemy]) => `<article class="codex-card"><img class="codex-sprite" src="${spriteUrl("enemy", key)}" alt="" draggable="false"><h3>${escapeHtml(enemy.name)}${enemy.boss ? " // БОСС" : ""}</h3><p>Прочность ${enemy.hp}, броня ${enemy.armor}, скорость ${enemy.speed}, урон ${enemy.damage}. Тяжёлые классы чаще несут титановые и сверхпроводящие трофеи.</p></article>`).join("")}</div>`;
    } else {
      DOM.codexContent.innerHTML = `<div class="codex-grid">
        <article class="codex-card"><h3>Несущая архитектура</h3><p>Модули нельзя ставить в пустоту. Каждый тайл требует связанной конструкции. Материал каркаса передаёт модулю базовую прочность, массу и теплоёмкость.</p></article>
        <article class="codex-card"><h3>Массовое строительство</h3><p>Зажмите ЛКМ и проведите по полю, чтобы проложить прямую линию модулей. Конвейеры, трубы и термопроводы автоматически поворачиваются вдоль линии; стоимость списывается только за успешно установленные объекты.</p></article>
        <article class="codex-card"><h3>Аварийное восстановление</h3><p>Критические материалы имеют медленные резервные рецепты. Редкий трофей гарантируется серией неудач, а генератор астероидов предотвращает бесконечную ресурсную засуху. Мостик выдаёт штрафной аварийный комплект только при полном провале добычи и обороны.</p></article>
        <article class="codex-card"><h3>Волновой цикл</h3><p>Астероиды прибывают постоянно. Вражеская волна запускается каждые 120 секунд игрового времени. На волнах 5, 10 и 15 появляются особые боссы.</p></article>
        <article class="codex-card"><h3>Экипаж</h3><p>Турели и заводы создают рабочие места. Каюты дают койки, жизнеобеспечение ограничивает реальную численность. Дефицит экипажа снижает общую эффективность.</p></article>
        <article class="codex-card"><h3>Теплота и температура</h3><p>Активные модули производят теплоту, каркас её накапливает, термопроводы распределяют, радиаторы отводят. Перегрев повреждает оборудование. Плазменное копьё использует тепло как боевой ресурс.</p></article>
        <article class="codex-card"><h3>Ядерная безопасность</h3><p>Изотопные линии создают радиацию. Радиационный колпак обеспечивает экранирование; превышение допустимого фона снижает эффективность экипажа.</p></article>
        <article class="codex-card"><h3>Разборка</h3><p>По умолчанию возвращается 50% округлённой вниз стоимости. Мидгейм-исследование «Глубокая переработка» повышает возврат до 70% и открывает разбор трофеев.</p></article>
        <article class="codex-card"><h3>Гравитационный колодец</h3><p>Поздний эндгейм-модуль почти реакторной стоимости. Может отсрочить волну на 30/60 секунд, приблизить на 45 секунд или вызвать сразу; перезарядка — 120 секунд.</p></article>
        <article class="codex-card"><h3>Орбитальный принтер</h3><p>Печатает новый термоядерный реактор и формирует дополнительную станцию. Исследования и ресурсы общие, активную станцию можно переключать в верхней панели.</p></article>
      </div>`;
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function setPaused(value = !state.paused) {
    if (!state || state.gameOver) return;
    state.paused = value;
    document.body.classList.toggle("is-paused", state.paused);
    renderTopbar();
  }

  function updateHoverTooltip(event) {
    if (!state) return;
    const point = getCanvasPoint(event);
    runtime.mouse = { ...point, inside: point.insideCanvas };
    if (!point.insideCanvas) {
      DOM.hoverTooltip.hidden = true;
      return;
    }
    const station = getStation();
    let html = "";
    if (point.gx >= 0 && point.gy >= 0 && point.gx < GRID_W && point.gy < GRID_H) {
      const moduleId = station.moduleAt[point.gy][point.gx];
      if (state.mode === "build") {
        const def = getBuildDef(state.selectedBuild);
        if (def) {
          const validation = def.kind === "structure" ? canPlaceFoundation(state.selectedBuild, point.gx, point.gy) : canPlaceModule(state.selectedBuild, point.gx, point.gy, state.rotation);
          html = `<b>${escapeHtml(def.name)}</b><br>Тайл [${point.gx}, ${point.gy}]<br>${validation.ok ? "ЛКМ / удержание — строить линию" : escapeHtml(validation.reason)}${!state.tutorial.active ? `<br>Стоимость: ${Object.entries(normalizeCost(def.cost)).map(([key, amount]) => `${RESOURCES[key].short} ${amount}`).join(", ")}` : "<br>Учебный комплект: бесплатно"}`;
        }
      } else if (moduleId) {
        const module = station.modules[moduleId], def = MODULES[module.type];
        html = `<b>${escapeHtml(def.name)}</b><br>Тайл [${point.gx}, ${point.gy}]<br>HP ${Math.ceil(module.hp)}/${module.maxHp} · ${Math.round(module.heat)} K<br>${escapeHtml(module.status || "Готов")}`;
      } else if (station.foundation[point.gy][point.gx]) {
        const foundation = station.foundation[point.gy][point.gx], def = STRUCTURES[foundation.type];
        html = `<b>${escapeHtml(def.name)}</b><br>Тайл [${point.gx}, ${point.gy}]<br>HP ${Math.ceil(foundation.hp)}/${foundation.maxHp}`;
      }
    }
    if (html) {
      DOM.hoverTooltip.innerHTML = html;
      DOM.hoverTooltip.hidden = false;
      DOM.hoverTooltip.style.left = `${Math.min(window.innerWidth - 280, event.clientX + 14)}px`;
      DOM.hoverTooltip.style.top = `${Math.min(window.innerHeight - 110, event.clientY + 14)}px`;
    } else {
      DOM.hoverTooltip.hidden = true;
    }
  }

  function initEvents() {
    DOM.newGameBtn.addEventListener("click", () => {
      if (hasSavedGame()) {
        showModal({ eyebrow: "NEW GAME", title: "Начать новую станцию?", body: "<p>Текущее локальное сохранение будет заменено после первого автосохранения.</p>", actions: [
          { label: "Отмена" }, { label: "Начать", primary: true, onClick: startNewGame }
        ]});
      } else startNewGame();
    });
    DOM.continueBtn.addEventListener("click", continueGame);
    DOM.canvas.addEventListener("click", (event) => {
      if (runtime.buildStroke.suppressClick) { runtime.buildStroke.suppressClick = false; return; }
      if (!runtime.camera.moved) onCanvasClick(event);
      runtime.camera.moved = false;
    });
    DOM.canvas.addEventListener("mousedown", (event) => { beginCanvasPan(event); beginBuildStroke(event); });
    window.addEventListener("mousemove", (event) => {
      const rect = getCanvasContentRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (runtime.camera.dragging) {
        updateCanvasPan(event);
        DOM.hoverTooltip.hidden = true;
        return;
      }
      if (runtime.buildStroke.active) updateBuildStroke(event);
      if (inside) updateHoverTooltip(event);
      else { runtime.mouse.inside = false; DOM.hoverTooltip.hidden = true; }
    });
    window.addEventListener("mouseup", (event) => {
      if (event.button === 2) endCanvasPan();
      if (event.button === 0) finishBuildStroke();
    });
    window.addEventListener("blur", () => { endCanvasPan(); finishBuildStroke(); });
    DOM.canvas.addEventListener("mouseleave", () => { if (!runtime.camera.dragging) { runtime.mouse.inside = false; DOM.hoverTooltip.hidden = true; } });
    DOM.canvas.addEventListener("wheel", zoomCanvas, { passive: false });
    DOM.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    DOM.buildModeBtn.addEventListener("click", () => setMode("build"));
    DOM.inspectModeBtn.addEventListener("click", () => setMode("inspect"));
    DOM.demolishModeBtn.addEventListener("click", () => setMode("demolish"));
    DOM.rotateBtn.addEventListener("click", rotateSelection);
    DOM.closeInspectBtn.addEventListener("click", () => setMode("build"));
    DOM.pauseBtn.addEventListener("click", () => setPaused());
    DOM.thermalToggle.addEventListener("click", () => { state.thermalView = !state.thermalView; renderTopbar(); });
    DOM.resourceModeBtn.addEventListener("click", () => { state.resourceViewAll = !state.resourceViewAll; renderResources(); });
    DOM.buildSearch.addEventListener("input", renderBuildList);
    DOM.tutorialActionBtn.addEventListener("click", tutorialPrimaryAction);
    DOM.tutorialAutoBtn.addEventListener("click", autoBuildTutorialStep);
    DOM.saveBtn.addEventListener("click", () => saveGame(false));
    DOM.stationSelect.addEventListener("change", (event) => switchStation(event.target.value));
    $$(".speed-btn").forEach((button) => button.addEventListener("click", () => {
      state.speed = Number(button.dataset.speed);
      renderTopbar();
    }));
    DOM.researchBtn.addEventListener("click", () => { renderResearchTree(); DOM.researchOverlay.hidden = false; });
    DOM.codexBtn.addEventListener("click", () => { renderCodex(); DOM.codexOverlay.hidden = false; });
    $$(".close-overlay").forEach((button) => button.addEventListener("click", () => { $("#" + button.dataset.close).hidden = true; }));
    DOM.codexTabs.addEventListener("click", (event) => { const button = event.target.closest("[data-codex]"); if (button) renderCodex(button.dataset.codex); });
    [DOM.researchOverlay, DOM.codexOverlay].forEach((overlay) => overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.hidden = true; }));

    window.addEventListener("keydown", (event) => {
      if (!state || event.target.matches("input, select, textarea")) return;
      if (event.code === "Space") { event.preventDefault(); setPaused(); }
      else if (event.key.toLowerCase() === "r") rotateSelection();
      else if (event.key.toLowerCase() === "h") { state.thermalView = !state.thermalView; renderTopbar(); }
      else if (event.key === "1") setMode("build");
      else if (event.key === "2") setMode("inspect");
      else if (event.key === "3") setMode("demolish");
      else if (event.key === "Escape") {
        DOM.researchOverlay.hidden = true;
        DOM.codexOverlay.hidden = true;
        DOM.modalOverlay.hidden = true;
        setMode("build");
      }
    });

    window.addEventListener("beforeunload", () => saveGame(true));
  }

  MODULES.nuclearSilo = moduleDef("Ядерная шахта «Тактик»", "Ядерные", 2, 2, "N1", { titaniumHeavy: 14, tungstenPanels: 10, siliconPlates: 12, nuclearCharges: 1 },
    { kind: "weapon", hp: 310, energyUse: 35, heatGen: 10, crew: 3, radiation: 0.8, weapon: { type: "nuclear", range: 235, damage: 420, rate: 12 }, tech: "isotopeEngineering", description: "Тактическая система: расходует один ядерный заряд и поражает компактную область." });
  MODULES.heavyNuclearSilo = moduleDef("Тяжёлая ядерная шахта «Гелиос»", "Ядерные", 3, 3, "N3", { superalloy: 18, titaniumArmor: 12, superconductors: 16, nuclearCharges: 3 },
    { kind: "weapon", hp: 490, energyUse: 58, heatGen: 18, crew: 5, radiation: 1.5, weapon: { type: "nuclearHeavy", range: 280, damage: 980, rate: 22 }, tech: "antimatter", description: "Стратегическая игровая система: расходует три заряда и создаёт большой импульс урона и теплоты." });

  function getModuleCenter(module) {
    const def = MODULES[module.type];
    const size = rotatedSize(def.w, def.h, module.rotation);
    return { x: (module.x + size.w / 2) * TILE, y: (module.y + size.h / 2) * TILE };
  }

  function getStationCorePoint(station = getStation()) {
    const reactor = Object.values(station.modules).find((module) => module.type === "fusionReactor");
    return reactor ? getModuleCenter(reactor) : { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  }

  function getGeneratorProfile(module) {
    const def = MODULES[module.type];
    if (!def || !def.energyOutput) return { output: 0, heat: def?.heatGen || 0, active: true };
    if (!def.fuel) return { output: def.energyOutput, heat: def.heatGen, active: true };
    if ((module.fuelRemaining || 0) <= 0) return { output: 0, heat: 0, active: false };
    if (module.type === "fissionReactor" && module.activeFuelKey === "thoriumCell") return { output: 225, heat: 21, active: true };
    if (module.type === "fissionReactor" && module.activeFuelKey === "uraniumCell") return { output: 290, heat: 32, active: true };
    return { output: def.energyOutput, heat: def.heatGen, active: true };
  }

  function updateGeneratorFuel(dt) {
    const station = getStation();
    for (const module of Object.values(station.modules)) {
      const def = MODULES[module.type];
      if (!def?.fuel) continue;
      if ((module.fuelRemaining || 0) > 0) {
        module.fuelRemaining = Math.max(0, module.fuelRemaining - dt);
        if (module.fuelRemaining === 0 && ["fissionReactor", "rtg"].includes(module.type)) {
          state.inventory.decayProducts = (state.inventory.decayProducts || 0) + 1;
        }
        continue;
      }
      let fuelKey = def.fuel.key;
      let duration = def.fuel.duration;
      if (module.type === "fissionReactor") {
        if ((state.inventory.uraniumCell || 0) > 0) {
          fuelKey = "uraniumCell";
          duration = 210;
        } else if ((state.inventory.thoriumCell || 0) > 0) {
          fuelKey = "thoriumCell";
          duration = 360;
        }
      }
      if ((state.inventory[fuelKey] || 0) > 0) {
        state.inventory[fuelKey] -= 1;
        module.fuelRemaining = duration;
        module.activeFuelKey = fuelKey;
        module.status = `Топливо: ${RESOURCES[fuelKey].name}`;
        logEvent(`${MODULES[module.type].name} загрузил ${RESOURCES[fuelKey].name}.`);
      } else {
        module.status = `Нет топлива: ${RESOURCES[fuelKey].name}`;
      }
    }
  }

  function buildLogisticsIndex(station = getStation()) {
    const cells = [];
    const sourceCells = [];
    for (const module of Object.values(station.modules)) {
      const def = MODULES[module.type];
      if (!def?.logistics) continue;
      const size = rotatedSize(def.w, def.h, module.rotation);
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) {
          const cell = { x: module.x + dx, y: module.y + dy, moduleId: module.id };
          cells.push(cell);
          if (def.kind === "storage" || def.kind === "collector") sourceCells.push(cell);
        }
      }
    }
    return { cells, sourceCells };
  }

  function isModuleLogisticsConnected(module, index = buildLogisticsIndex()) {
    const def = MODULES[module.type];
    if (!def?.processorStages?.length && def.kind !== "nuclear") return true;
    if (!index.cells.length) return false;
    const size = rotatedSize(def.w, def.h, module.rotation);
    let closest = Infinity;
    for (const cell of index.cells) {
      const dx = Math.max(module.x - cell.x, 0, cell.x - (module.x + size.w - 1));
      const dy = Math.max(module.y - cell.y, 0, cell.y - (module.y + size.h - 1));
      closest = Math.min(closest, dx + dy);
    }
    return closest <= 4;
  }

  function calculateStationStats() {
    const station = getStation();
    if (!station) return {
      hullHp: 0, hullMax: 1, powerDemand: 0, powerOutput: 0, beds: 0, jobs: 0, availableCrew: 0,
      averageTemp: 0, maxTemp: 0, radiation: 0, storageUsed: 0, storageCapacity: 1, efficiency: 0,
      logisticsEfficiency: 0, cooling: 0, totalHeat: 0, mass: 0, powerStorage: 0
    };

    let hullHp = 0, hullMax = 0, mass = 0, foundationHeatCapacity = 0;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const foundation = station.foundation[y][x];
        if (!foundation) continue;
        const def = STRUCTURES[foundation.type];
        hullHp += foundation.hp;
        hullMax += foundation.maxHp;
        mass += def.mass;
        foundationHeatCapacity += def.heatCapacity;
      }
    }

    let powerDemand = 0, powerOutput = 0, jobs = 0, beds = 8, lifeSupportCapacity = 8;
    let cooling = 0, storageCapacity = 2500, radiationGeneration = 0, shielding = 0;
    let totalTemp = 0, maxTemp = 0, totalHeat = 0, moduleCount = 0, powerStorage = 120, commons = 0;
    let powerNodes = 0, logisticsModules = 0, connectedProcessors = 0, processors = 0;
    const logisticsIndex = buildLogisticsIndex(station);

    for (const module of Object.values(station.modules)) {
      const def = MODULES[module.type];
      if (!def) continue;
      hullHp += Math.max(0, module.hp);
      hullMax += module.maxHp;
      mass += def.mass;
      jobs += def.crew;
      beds += def.beds;
      lifeSupportCapacity += def.lifeSupport;
      powerDemand += def.energyUse;
      const generator = getGeneratorProfile(module);
      powerOutput += generator.output;
      cooling += def.cooling;
      storageCapacity += def.storage;
      radiationGeneration += def.radiation * (def.processorStages.length && module.progress <= 0 ? 0.35 : 1);
      shielding += def.shielding;
      powerStorage += def.powerStorage;
      totalTemp += module.heat;
      maxTemp = Math.max(maxTemp, module.heat);
      totalHeat += Math.max(0, module.heat - 45) * (def.w * def.h * 4 + def.mass * 0.35);
      moduleCount++;
      if (module.type === "crewCommons") commons++;
      if (module.type === "powerNode") powerNodes++;
      if (def.logistics) logisticsModules++;
      if (def.processorStages.length) {
        processors++;
        if (isModuleLogisticsConnected(module, logisticsIndex)) connectedProcessors++;
      }
    }

    powerOutput *= 1 + Math.min(0.18, powerNodes * 0.025);
    const availableCrew = Math.max(0, Math.min(station.crew, beds, lifeSupportCapacity));
    const crewEfficiency = jobs > 0 ? clamp(availableCrew / jobs, 0.12, 1) : 1;
    const powerEfficiency = powerDemand > 0 ? clamp(powerOutput / powerDemand, 0.08, 1) : 1;
    const averageTemp = moduleCount ? totalTemp / moduleCount : 45;
    const thermalEfficiency = maxTemp <= 760 ? 1 : clamp(1 - (maxTemp - 760) / 600, 0.2, 1);
    const radiation = Math.max(0, station.radiation || radiationGeneration - shielding);
    const radiationEfficiency = radiation <= 7 ? 1 : clamp(1 - (radiation - 7) / 28, 0.35, 1);
    const moraleBonus = Math.min(0.12, commons * 0.04);
    const logisticsEfficiency = processors ? clamp(connectedProcessors / processors, 0.18, 1) : 1;
    const debtFactor = (station.energyDebt || 0) > 0 ? 0.82 : 1;
    const efficiency = clamp(Math.min(crewEfficiency, powerEfficiency, thermalEfficiency, radiationEfficiency) * (1 + moraleBonus) * debtFactor, 0.05, 1.12);
    const storageUsed = Object.values(state.inventory).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);

    return {
      hullHp, hullMax, mass: Math.round(mass / 10), foundationHeatCapacity,
      powerDemand: Math.round(powerDemand), powerOutput: Math.round(powerOutput), powerStorage,
      jobs, beds, lifeSupportCapacity, availableCrew,
      cooling, storageCapacity, storageUsed,
      averageTemp, maxTemp, totalHeat, radiation,
      crewEfficiency, powerEfficiency, thermalEfficiency, radiationEfficiency,
      logisticsEfficiency, logisticsModules, processors, connectedProcessors, efficiency
    };
  }

  function machineSpeed(type) {
    if (/3$/.test(type) || type === "printer3") return 2.1;
    if (/2$/.test(type) || type === "printer2") return 1.45;
    if (["blastFurnace","arcFurnace","vacuumFurnace","diamondPress","isotopeCentrifuge","decayAccelerator"].includes(type)) return 1.2;
    return 1;
  }

  function hasInputs(inputs) {
    return Object.entries(inputs).every(([key, amount]) => (state.inventory[key] || 0) >= amount);
  }

  function hasStorageFor(outputs, stats) {
    const needed = Object.values(outputs).reduce((sum, amount) => sum + amount, 0);
    return stats.storageUsed + needed <= stats.storageCapacity;
  }

  function addResource(key, amount, stats = runtime.currentStats || calculateStationStats()) {
    if (!RESOURCES[key] || amount <= 0) return 0;
    const space = Math.max(0, stats.storageCapacity - stats.storageUsed);
    const added = Math.min(amount, Math.floor(space));
    if (added > 0) {
      state.inventory[key] = (state.inventory[key] || 0) + added;
      stats.storageUsed += added;
    }
    return added;
  }

  function updateProduction(dt, stats) {
    const station = getStation();
    const logisticsIndex = buildLogisticsIndex(station);
    for (const module of Object.values(station.modules)) {
      const def = MODULES[module.type];
      if (!def?.processorStages.length) continue;
      const recipes = getCompatibleRecipes(module.type);
      if (!recipes.length) {
        module.status = "Нет доступных рецептов";
        module.progress = 0;
        continue;
      }
      let activeRecipe = RECIPES.find((item) => item.id === module.recipeId && recipes.some((recipeItem) => recipeItem.id === item.id));
      if (!activeRecipe) {
        activeRecipe = recipes[0];
        module.recipeId = activeRecipe.id;
      }
      if (!isModuleLogisticsConnected(module, logisticsIndex)) {
        module.status = "Нет связи с логистикой";
        continue;
      }
      if (module.heat > 1080) {
        module.status = "Аварийный перегрев";
        continue;
      }
      if (!hasInputs(activeRecipe.inputs)) {
        module.status = "Ожидание сырья";
        module.progress = Math.max(0, module.progress - dt * 0.02);
        continue;
      }
      if (!hasStorageFor(activeRecipe.outputs, stats)) {
        module.status = "Грузовой реестр переполнен";
        continue;
      }
      const speed = machineSpeed(module.type) * stats.efficiency * stats.logisticsEfficiency;
      module.progress += dt * speed / activeRecipe.time;
      module.status = `Производство: ${activeRecipe.name}`;
      if (module.progress >= 1) {
        for (const [key, amount] of Object.entries(activeRecipe.inputs)) state.inventory[key] = Math.max(0, (state.inventory[key] || 0) - amount);
        for (const [key, amount] of Object.entries(activeRecipe.outputs)) addResource(key, amount, stats);
        module.progress %= 1;
        module.heat += 2 + activeRecipe.stage * 0.7;
        state.score += activeRecipe.stage;
      }
    }
  }

  function updateRadiation(dt) {
    const station = getStation();
    let generation = 0, shielding = 0;
    for (const module of Object.values(station.modules)) {
      const def = MODULES[module.type];
      generation += (def.radiation || 0) * (def.processorStages.length && module.progress <= 0 ? 0.25 : 1);
      shielding += def.shielding || 0;
    }
    const target = Math.max(0, generation - shielding * 0.85);
    station.radiation = lerp(station.radiation || 0, target, clamp(dt * 0.12, 0, 1));
  }

  function updateHeat(dt, stats) {
    const station = getStation();
    const modules = Object.values(station.modules);
    if (!modules.length) return;
    const coolingShare = stats.cooling / Math.max(1, modules.length);
    const heatPipeCount = modules.filter((module) => module.type === "heatPipe").length;

    for (const module of modules) {
      const def = MODULES[module.type];
      const generator = getGeneratorProfile(module);
      let heatGen = def.energyOutput ? generator.heat : def.heatGen;
      if (def.processorStages.length && module.progress <= 0) heatGen *= 0.25;
      if (def.weapon && module.cooldown <= 0) heatGen *= 0.35;
      const supportProfile = getModuleSupportProfile(module, station);
      const capacity = 35 + def.mass * 0.55 + def.w * def.h * 16 + def.thermalStorage * 0.25 + supportProfile.heatCapacity * 0.55;
      module.heat += heatGen * dt * 6 / capacity;
      module.heat -= coolingShare * dt * 4.5 / capacity;
      module.heat -= Math.max(0, module.heat - 55) * 0.0016 * dt;
      if (def.cooling) module.heat -= def.cooling * dt * 0.04;
      module.heat = Math.max(35, module.heat);
      if (module.heat > 980) {
        const damage = (module.heat - 980) * 0.007 * dt;
        damageModule(module.id, damage, "перегрев");
      }
    }

    const diffusion = 0.035 + heatPipeCount * 0.002;
    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const a = modules[i], b = modules[j];
        const pa = getModuleCenter(a), pb = getModuleCenter(b);
        if (Math.abs(pa.x - pb.x) > TILE * 4 || Math.abs(pa.y - pb.y) > TILE * 4) continue;
        const delta = (a.heat - b.heat) * diffusion * dt;
        a.heat -= delta;
        b.heat += delta;
      }
    }

    if (state.researched.includes("zeroPoint")) {
      const sinks = modules.filter((module) => module.type === "quantumHeatSink" || module.type === "casimirConverter");
      if (sinks.length) {
        const extracted = Math.min(10 * sinks.length * dt, modules.reduce((sum, module) => sum + Math.max(0, module.heat - 120), 0));
        station.zeroPointReserve = Math.min(500, (station.zeroPointReserve || 0) + extracted * 0.1);
      }
    }
  }

  function updatePowerBuffer(dt, stats) {
    const station = getStation();
    const capacity = stats.powerStorage;
    const surplus = stats.powerOutput - stats.powerDemand;
    station.powerBuffer = clamp((station.powerBuffer || 0) + Math.max(0, surplus) * dt * 0.55, 0, capacity);
    if ((station.energyDebt || 0) > 0) {
      const recovery = Math.max(5, Math.max(0, surplus)) * dt;
      station.energyDebt = Math.max(0, station.energyDebt - recovery);
    }
  }

  function getBalanceState() {
    state.balance ||= { rareLootPity: 0, asteroidDrought: {}, recoveryWave: -99 };
    state.balance.rareLootPity ??= 0;
    state.balance.asteroidDrought ||= {};
    state.balance.recoveryWave ??= -99;
    return state.balance;
  }

  function chooseNeededResource(keys) {
    const weighted = [];
    for (const key of keys) {
      const stock = Math.max(0, state.inventory[key] || 0);
      const weight = clamp(Math.ceil(8 / Math.sqrt(stock + 1)), 1, 8);
      for (let i = 0; i < weight; i++) weighted.push(key);
    }
    return pick(weighted.length ? weighted : keys);
  }

  function chooseAsteroidResource() {
    const balance = getBalanceState();
    const drought = balance.asteroidDrought;
    const forced = Object.entries(ASTEROID_DROUGHT_LIMITS)
      .filter(([key, limit]) => (drought[key] || 0) >= limit && (state.inventory[key] || 0) < (key === "nasturan" ? 16 : 24))
      .sort((a, b) => (drought[b[0]] || 0) - (drought[a[0]] || 0));
    let resourceKey = forced[0]?.[0] || pick(RAW_ASTEROID_KEYS);
    if (!forced.length && ["nasturan","chromite","zircon"].includes(resourceKey) && Math.random() < 0.58) {
      resourceKey = pick(["kamacite","taenite","bornite","olivine","magnetite"]);
    }
    for (const key of Object.keys(ASTEROID_DROUGHT_LIMITS)) drought[key] = (drought[key] || 0) + 1;
    drought[resourceKey] = 0;
    return resourceKey;
  }

  function getCommonEnemyLootPool() {
    const pool = [...ENEMY_LOOT_EARLY];
    if (state.wave >= 6 || state.researched.includes("advancedFurnaces")) pool.push(...ENEMY_LOOT_MID);
    if (state.wave >= 10 || state.researched.includes("superconductingGrid")) pool.push(...ENEMY_LOOT_LATE);
    return pool;
  }

  function getRareEnemyLootPool() {
    const pool = [...RARE_ENEMY_LOOT_EARLY];
    if (state.wave >= 6 || state.researched.includes("advancedFurnaces")) pool.push(...RARE_ENEMY_LOOT_MID);
    if (state.wave >= 11 || state.researched.includes("isotopeEngineering")) pool.push(...RARE_ENEMY_LOOT_LATE);
    return pool;
  }

  function dropEnemySalvage(entity) {
    const def = ENEMIES[entity.enemyType];
    const balance = getBalanceState();
    const commonKey = chooseNeededResource(getCommonEnemyLootPool());
    const commonAmount = Math.max(1, Math.ceil(entity.reward / 20));
    dropLoot(entity.x, entity.y, commonKey, commonAmount);

    balance.rareLootPity += 1;
    const heavy = entity.enemyType.startsWith("heavy") || entity.enemyType === "bomber" || entity.enemyType === "heavyBomber";
    const rareChance = 0.08 + Math.min(0.12, state.wave * 0.006) + (heavy ? 0.1 : 0);
    const guaranteed = balance.rareLootPity >= 10 || def?.boss;
    if (guaranteed || Math.random() < rareChance) {
      const drops = def?.boss ? 3 : 1;
      const pool = getRareEnemyLootPool();
      for (let i = 0; i < drops; i++) {
        const key = chooseNeededResource(pool);
        const amount = key === "zeroPointCells" || key === "diamonds" ? 1 : Math.max(1, Math.ceil(entity.reward / (def?.boss ? 180 : 75)));
        dropLoot(entity.x + (Math.random() - 0.5) * 8, entity.y + (Math.random() - 0.5) * 8, key, amount);
      }
      balance.rareLootPity = 0;
    }
  }

  function applyEmergencyRecoveryProtocol() {
    const balance = getBalanceState();
    if (state.wave - balance.recoveryWave < 3) return false;
    const station = getStation();
    const modules = Object.values(station.modules);
    const hasCollector = modules.some((module) => module.hp > 0 && MODULES[module.type]?.collector);
    const hasOffense = modules.some((module) => module.hp > 0 && MODULES[module.type]?.weapon && MODULES[module.type].weapon.type !== "pointDefense");
    const criticallyLow = (state.inventory.steelFrames || 0) < 8 || (state.inventory.copperWire || 0) < 8;
    if ((!hasCollector || !hasOffense) && criticallyLow) {
      state.inventory.steelFrames = (state.inventory.steelFrames || 0) + 12;
      state.inventory.copperWire = (state.inventory.copperWire || 0) + 12;
      state.inventory.apCores = (state.inventory.apCores || 0) + 2;
      state.score = Math.max(0, state.score - 250);
      balance.recoveryWave = state.wave;
      logEvent("Мостик активировал аварийный комплект восстановления. Штраф к счёту: 250.");
      toast("Аварийный комплект: +12 каркасов, +12 проводки, +2 сердечника. −250 счёта.", "warn");
      return true;
    }
    return false;
  }

  function spawnAsteroid(burst = false) {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = -10; y = Math.random() * CANVAS_H; }
    else if (edge === 1) { x = CANVAS_W + 10; y = Math.random() * CANVAS_H; }
    else if (edge === 2) { x = Math.random() * CANVAS_W; y = -10; }
    else { x = Math.random() * CANVAS_W; y = CANVAS_H + 10; }
    const core = getStationCorePoint();
    const angle = Math.atan2(core.y - y, core.x - x) + (Math.random() - 0.5) * 0.18;
    const roll = Math.random();
    const size = roll < 0.63 ? 1 : roll < 0.9 ? 2 : 3;
    const speed = (burst ? 13 : 8.5) + state.wave * 0.42 + Math.random() * 3;
    const resourceKey = chooseAsteroidResource();
    const hp = Math.round((42 + size * 43) * (1 + state.wave * 0.17));
    runtime.entities.push({
      id: runtime.entityId++, kind: "asteroid", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      speed, hp, maxHp: hp, radius: 2 + size * 2.1, size, damage: Math.round((18 + size * 17) * (1 + state.wave * 0.1)),
      resourceKey, reward: Math.max(1, Math.round(size * (1 + state.wave * 0.18))), seed: Math.floor(Math.random() * 99999), dead: false
    });
  }

  function spawnEnemy(type) {
    const def = ENEMIES[type];
    if (!def) return;
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = -18; y = Math.random() * CANVAS_H; }
    else if (edge === 1) { x = CANVAS_W + 18; y = Math.random() * CANVAS_H; }
    else if (edge === 2) { x = Math.random() * CANVAS_W; y = -18; }
    else { x = Math.random() * CANVAS_W; y = CANVAS_H + 18; }
    const scale = def.boss ? 1 + Math.max(0, state.wave - 10) * 0.06 : 1 + state.wave * 0.085;
    const hp = Math.round(def.hp * scale);
    runtime.entities.push({
      id: runtime.entityId++, kind: "enemy", enemyType: type, x, y, vx: 0, vy: 0,
      speed: def.speed * (1 + state.wave * 0.012), hp, maxHp: hp, radius: def.size,
      damage: Math.round(def.damage * (1 + state.wave * 0.055)), reward: Math.round(def.reward * scale),
      armor: Math.round(def.armor * (1 + state.wave * 0.035)), fireCooldown: Math.random() * def.rate,
      targetModuleId: null, empTime: 0, dead: false
    });
  }

  function spawnRescueCapsule() {
    const edge = Math.floor(Math.random() * 4);
    let x = edge % 2 ? CANVAS_W + 8 : -8;
    let y = Math.random() * CANVAS_H;
    if (edge >= 2) { x = Math.random() * CANVAS_W; y = edge === 2 ? -8 : CANVAS_H + 8; }
    const core = getStationCorePoint();
    const angle = Math.atan2(core.y - y, core.x - x);
    runtime.loot.push({
      id: runtime.entityId++, kind: "crew", x, y, vx: Math.cos(angle) * 2.5, vy: Math.sin(angle) * 2.5,
      amount: 2 + Math.floor(Math.random() * 4), ttl: 120, radius: 3, color: "#7dff9b"
    });
    logEvent("Обнаружена спасательная капсула. Манипуляторы могут втянуть её к станции.");
    toast("Спасательная капсула в секторе!", "warn");
  }

  function getWaveEnemyPool(wave) {
    const pool = [];
    const add = (type, weight) => { for (let i = 0; i < weight; i++) pool.push(type); };
    if (wave <= 2) {
      add("fighter", 5); add("interceptor", 4);
    } else if (wave <= 4) {
      add("fighter", 4); add("interceptor", 4); add("attacker", 2);
    } else if (wave <= 6) {
      add("fighter", 3); add("interceptor", 3); add("attacker", 4);
    } else if (wave <= 9) {
      add("fighter", 2); add("interceptor", 2); add("attacker", 5); add("bomber", 1);
    } else if (wave <= 11) {
      add("fighter", 2); add("interceptor", 2); add("attacker", 4); add("bomber", 2); add("heavyFighter", 2); add("heavyInterceptor", 1);
    } else if (wave <= 13) {
      add("attacker", 4); add("bomber", 2); add("heavyFighter", 2); add("heavyInterceptor", 2); add("heavyAttacker", 1);
    } else if (wave <= 15) {
      add("attacker", 3); add("bomber", 3); add("heavyFighter", 2); add("heavyInterceptor", 2); add("heavyAttacker", 2); add("heavyBomber", 1);
    } else {
      add("attacker", 2); add("bomber", 3); add("heavyFighter", 2); add("heavyInterceptor", 2); add("heavyAttacker", 3); add("heavyBomber", 2);
    }
    return pool;
  }

  function getWaveEnemyCount(wave) {
    return 2 + Math.floor(wave * 0.9) + Math.floor(wave / 2);
  }

  function triggerWave() {
    if (!state || state.tutorial.active || state.gameOver) return;
    state.wave += 1;
    state.waveTimer = 120;
    const science = 18 + state.wave * 7;
    state.researchPoints += science;
    const resourceBonus = 4 + state.wave * 2;
    state.inventory.steelFrames = (state.inventory.steelFrames || 0) + resourceBonus;
    state.inventory.copperWire = (state.inventory.copperWire || 0) + Math.ceil(resourceBonus * 0.7);
    state.score += 100 + state.wave * 40;

    const pool = getWaveEnemyPool(state.wave);
    let count = getWaveEnemyCount(state.wave);
    let banner = `ВОЛНА ${state.wave} // ВРАЖЕСКИЙ КОНТАКТ`;

    if (state.wave === 5) {
      count += 8;
      banner = "БОСС I // ВРАЖЕСКИЙ ФЛОТ";
    } else if (state.wave === 10) {
      spawnEnemy("leviathan");
      count += 5;
      banner = "БОСС II // ЛЕВИАФАН";
    } else if (state.wave === 15) {
      spawnEnemy("strikeStation");
      count += 7;
      banner = "БОСС III // ВРАЖЕСКАЯ УДАРНАЯ СТАНЦИЯ";
    } else if (state.wave > 15 && state.wave % 5 === 0) {
      spawnEnemy(state.wave % 10 === 0 ? "strikeStation" : "leviathan");
      count += 7;
      banner = "ЭСКАЛАЦИЯ // БОССОВАЯ ГРУППА";
    }

    for (let i = 0; i < count; i++) setTimeout(() => {
      if (state && !state.gameOver) spawnEnemy(pick(pool));
    }, Math.min(5000, i * 130));
    for (let i = 0; i < 6 + state.wave; i++) setTimeout(() => {
      if (state && !state.gameOver) spawnAsteroid(true);
    }, Math.min(4000, i * 90));

    if (state.wave % 3 === 0 && Math.random() < 0.82) spawnRescueCapsule();
    applyEmergencyRecoveryProtocol();
    const cap = getWaveTierCap();
    if ([3,6,10].includes(state.wave)) toast(`Предел исследований повышен до уровня ${cap}.`);
    showBanner(banner, 4.5);
    logEvent(`Началась волна ${state.wave}. Получено ${science} очков исследования и аварийный комплект ресурсов.`);
    renderAllUI(true);
  }

  function chooseEnemyTarget() {
    const station = getStation();
    const modules = Object.values(station.modules);
    if (!modules.length) return null;
    const weighted = modules.flatMap((module) => {
      const weight = module.type === "fusionReactor" ? 4 : module.type === "bridge" ? 3 : MODULES[module.type].weapon ? 2 : 1;
      return Array.from({ length: weight }, () => module);
    });
    return pick(weighted);
  }

  function updateEntities(dt) {
    const station = getStation();
    for (const entity of runtime.entities) {
      if (entity.dead) continue;
      if (entity.kind === "asteroid") {
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
        if (hitStationAt(entity.x, entity.y)) {
          damageStationAt(entity.x, entity.y, entity.damage, "столкновение с астероидом");
          entity.dead = true;
          runtime.effects.push({ type: "explosion", x: entity.x, y: entity.y, life: 0.45, maxLife: 0.45, radius: entity.radius * 2, color: "#e5a65b" });
        }
      } else if (entity.kind === "enemy") {
        const enemyDef = ENEMIES[entity.enemyType];
        entity.empTime = Math.max(0, (entity.empTime || 0) - dt);
        let target = entity.targetModuleId ? station.modules[entity.targetModuleId] : null;
        if (!target || Math.random() < 0.002) {
          target = chooseEnemyTarget();
          entity.targetModuleId = target?.id || null;
        }
        if (!target) continue;
        const targetPoint = getModuleCenter(target);
        const dx = targetPoint.x - entity.x, dy = targetPoint.y - entity.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const slow = entity.empTime > 0 ? 0.32 : 1;
        if (distance > enemyDef.range) {
          entity.vx = dx / distance * entity.speed * slow;
          entity.vy = dy / distance * entity.speed * slow;
          entity.x += entity.vx * dt;
          entity.y += entity.vy * dt;
        } else {
          entity.vx *= 0.9;
          entity.vy *= 0.9;
          entity.fireCooldown -= dt * slow;
          if (entity.fireCooldown <= 0) {
            fireEnemyProjectile(entity, targetPoint);
            entity.fireCooldown = enemyDef.rate;
          }
        }
      }
    }
    runtime.entities = runtime.entities.filter((entity) => !entity.dead && entity.x > -80 && entity.y > -80 && entity.x < CANVAS_W + 80 && entity.y < CANVAS_H + 80);
  }

  function fireEnemyProjectile(entity, targetPoint) {
    const enemyDef = ENEMIES[entity.enemyType];
    const angle = Math.atan2(targetPoint.y - entity.y, targetPoint.x - entity.x);
    const speed = enemyDef.rail ? 125 : 70;
    runtime.projectiles.push({
      id: runtime.entityId++, team: "enemy", type: enemyDef.rail ? "rail" : "enemyBolt",
      x: entity.x, y: entity.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage: entity.damage, life: 5, radius: enemyDef.rail ? 2 : 1.5, dead: false, color: enemyDef.color
    });
    runtime.effects.push({ type: "flash", x: entity.x, y: entity.y, life: 0.14, maxLife: 0.14, radius: 4, color: enemyDef.color });
  }

  function hitStationAt(x, y) {
    const gx = Math.floor(x / TILE), gy = Math.floor(y / TILE);
    return gx >= 0 && gy >= 0 && gx < GRID_W && gy < GRID_H && Boolean(getStation().foundation[gy][gx]);
  }

  function damageStationAt(x, y, damage, source = "атака") {
    const station = getStation();
    let gx = Math.floor(x / TILE), gy = Math.floor(y / TILE);
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H || !station.foundation[gy][gx]) {
      let best = null, bestDistance = Infinity;
      for (let radius = 1; radius <= 3 && !best; radius++) {
        for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
          const nx = gx + ox, ny = gy + oy;
          if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H || !station.foundation[ny][nx]) continue;
          const d = Math.hypot(ox, oy);
          if (d < bestDistance) { best = { x: nx, y: ny }; bestDistance = d; }
        }
      }
      if (!best) return;
      gx = best.x; gy = best.y;
    }
    const moduleId = station.moduleAt[gy][gx];
    if (moduleId) damageModule(moduleId, damage, source);
    else damageFoundation(gx, gy, damage, source);
  }

  function damageModule(moduleId, damage, source = "атака") {
    const station = getStation();
    const module = station.modules[moduleId];
    if (!module || damage <= 0) return;
    const def = MODULES[module.type];
    const size = rotatedSize(def.w, def.h, module.rotation);
    let armor = 0;
    for (let dy = 0; dy < size.h; dy++) for (let dx = 0; dx < size.w; dx++) {
      const foundation = station.foundation[module.y + dy]?.[module.x + dx];
      if (foundation) armor += STRUCTURES[foundation.type].baseHp / 115;
    }
    armor /= Math.max(1, size.w * size.h);
    const actual = Math.max(1, damage - armor);
    module.hp -= actual;
    module.status = `Повреждён: ${source}`;
    const center = getModuleCenter(module);
    runtime.effects.push({ type: "spark", x: center.x + (Math.random() - 0.5) * def.w * TILE, y: center.y + (Math.random() - 0.5) * def.h * TILE, life: 0.3, maxLife: 0.3, radius: 3, color: "#ffb34f" });
    if (module.hp <= 0) {
      logEvent(`Уничтожен модуль «${def.name}»: ${source}.`);
      runtime.effects.push({ type: "explosion", x: center.x, y: center.y, life: 0.8, maxLife: 0.8, radius: Math.max(def.w, def.h) * TILE, color: "#ff4b5f" });
      removeModule(module.id, true);
    }
  }

  function damageFoundation(x, y, damage, source = "атака") {
    const station = getStation();
    const foundation = station.foundation[y]?.[x];
    if (!foundation) return;
    foundation.hp -= Math.max(1, damage);
    if (foundation.hp <= 0) {
      const moduleId = station.moduleAt[y][x];
      if (moduleId) removeModule(moduleId, true);
      station.foundation[y][x] = null;
      station.integrityLoss += 1;
      runtime.effects.push({ type: "explosion", x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, life: 0.4, maxLife: 0.4, radius: 6, color: "#ff784e" });
      logEvent(`Разрушена несущая конструкция: ${source}.`);
      collapseDisconnectedFoundation();
    }
  }

  function getPriorityTarget(origin, range) {
    const core = getStationCorePoint();
    const candidates = runtime.entities.filter((entity) => !entity.dead && (entity.kind === "enemy" || entity.kind === "asteroid"));
    let best = null, bestScore = Infinity;
    for (const entity of candidates) {
      const distance = Math.hypot(entity.x - origin.x, entity.y - origin.y);
      if (distance > range) continue;
      const threatDistance = Math.hypot(entity.x - core.x, entity.y - core.y);
      const bossBias = entity.kind === "enemy" && ENEMIES[entity.enemyType]?.boss ? -100 : 0;
      const score = threatDistance + distance * 0.15 + bossBias;
      if (score < bestScore) { best = entity; bestScore = score; }
    }
    return best;
  }

  function weaponNeedsAmmo(type) {
    if (type === "rail") return { key: "apCores", amount: 1 };
    if (type === "thermalMissile") return { key: "incendiaryCores", amount: 1 };
    if (type === "nuclear") return { key: "nuclearCharges", amount: 1 };
    if (type === "nuclearHeavy") return { key: "nuclearCharges", amount: 3 };
    if (type === "antimatter") return { key: "antimatterCapsules", amount: 1 };
    return null;
  }

  function updateWeapons(dt, stats) {
    const station = getStation();
    for (const module of Object.values(station.modules)) {
      const def = MODULES[module.type];
      if (!def?.weapon) continue;
      module.cooldown = Math.max(0, (module.cooldown || 0) - dt);
      if (module.cooldown > 0 || stats.efficiency < 0.08 || module.heat > 1120) continue;
      const center = getModuleCenter(module);
      if (def.weapon.type === "pointDefense") {
        const projectile = runtime.projectiles.find((item) => item.team === "enemy" && !item.dead && Math.hypot(item.x - center.x, item.y - center.y) <= def.weapon.range);
        if (projectile) {
          projectile.dead = true;
          runtime.effects.push({ type: "line", x: center.x, y: center.y, x2: projectile.x, y2: projectile.y, life: 0.1, maxLife: 0.1, color: "#ffd68a" });
          module.cooldown = def.weapon.rate / Math.max(0.2, stats.efficiency);
          module.heat += 0.8;
        }
        continue;
      }
      const target = getPriorityTarget(center, def.weapon.range);
      if (!target) {
        module.status = "Поиск цели";
        continue;
      }
      const ammo = weaponNeedsAmmo(def.weapon.type);
      if (ammo && (state.inventory[ammo.key] || 0) < ammo.amount) {
        module.status = `Нет боеприпаса: ${RESOURCES[ammo.key].name}`;
        continue;
      }
      if (ammo) state.inventory[ammo.key] -= ammo.amount;
      if (!firePlayerWeapon(module, target, stats)) continue;
      module.cooldown = def.weapon.rate / Math.max(0.25, stats.efficiency);
      module.status = `Огонь: ${target.kind === "enemy" ? ENEMIES[target.enemyType].name : RESOURCES[target.resourceKey].name}`;
    }
  }

  function firePlayerWeapon(module, target, stats) {
    const def = MODULES[module.type];
    const weapon = def.weapon;
    const origin = getModuleCenter(module);
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    module.heat += Math.max(1, def.heatGen * 0.24);

    if (weapon.type === "shrapnel") {
      for (let i = -2; i <= 2; i++) {
        const spread = angle + i * 0.09;
        runtime.projectiles.push(makePlayerProjectile(origin, spread, weapon.speed, weapon.damage, "bullet", target.id, 1.2));
      }
    } else if (["bullet","rail"].includes(weapon.type)) {
      runtime.projectiles.push(makePlayerProjectile(origin, angle, weapon.speed, weapon.damage, weapon.type, target.id, weapon.type === "rail" ? 2 : 1.2));
    } else if (["missile","swarm","thermalMissile"].includes(weapon.type)) {
      const count = weapon.type === "swarm" ? 4 : 1;
      for (let i = 0; i < count; i++) {
        const projectile = makePlayerProjectile(origin, angle + (i - (count - 1) / 2) * 0.12, weapon.speed, weapon.damage, weapon.type, target.id, 2);
        projectile.homing = true;
        projectile.heatDamage = weapon.type === "thermalMissile" ? 80 : 0;
        runtime.projectiles.push(projectile);
      }
    } else if (weapon.type === "tesla") {
      const chain = [target];
      const others = runtime.entities.filter((item) => !item.dead && item.id !== target.id && Math.hypot(item.x - target.x, item.y - target.y) < 35).slice(0, 2);
      chain.push(...others);
      let from = origin;
      chain.forEach((item, index) => {
        damageEntity(item, weapon.damage * (1 - index * 0.24), 4);
        runtime.effects.push({ type: "line", x: from.x, y: from.y, x2: item.x, y2: item.y, life: 0.16, maxLife: 0.16, color: "#57f1ff", jagged: true });
        from = item;
      });
    } else if (["plasma","plasmaBeam","laser","maser","quantum","quantumRail","zeroPoint"].includes(weapon.type)) {
      const penetration = ["quantum","quantumRail","zeroPoint"].includes(weapon.type) ? 30 : weapon.type === "laser" || weapon.type === "maser" ? 12 : 8;
      damageEntity(target, weapon.damage, penetration);
      const color = weapon.type === "laser" ? "#ff3cb4" : weapon.type === "maser" ? "#b784ff" : weapon.type.includes("quantum") || weapon.type === "zeroPoint" ? "#a99cff" : "#5fffd8";
      runtime.effects.push({ type: "line", x: origin.x, y: origin.y, x2: target.x, y2: target.y, life: 0.14, maxLife: 0.14, color, width: weapon.type === "quantumRail" ? 3 : 2 });
      if (weapon.type === "zeroPoint") {
        module.heat = Math.max(50, module.heat - 35);
        getStation().zeroPointReserve = Math.max(0, (getStation().zeroPointReserve || 0) - 1);
      }
    } else if (weapon.type === "emp") {
      const targets = runtime.entities.filter((item) => item.kind === "enemy" && !item.dead && Math.hypot(item.x - target.x, item.y - target.y) <= 42);
      targets.forEach((item) => { item.empTime = Math.max(item.empTime || 0, 5); damageEntity(item, weapon.damage, 0); });
      runtime.effects.push({ type: "ring", x: target.x, y: target.y, life: 0.5, maxLife: 0.5, radius: 42, color: "#6cecff" });
    } else if (weapon.type === "plasmaLance") {
      const station = getStation();
      const heatAvailable = Object.values(station.modules).reduce((sum, item) => sum + Math.max(0, item.heat - 320), 0);
      if (heatAvailable < 90) {
        module.status = "Недостаточно накопленной теплоты";
        return false;
      }
      let remaining = 95;
      for (const item of Object.values(station.modules).sort((a, b) => b.heat - a.heat)) {
        const take = Math.min(remaining, Math.max(0, item.heat - 280));
        item.heat -= take;
        remaining -= take;
        if (remaining <= 0) break;
      }
      damageEntity(target, weapon.damage + Math.min(180, heatAvailable * 0.35), 18);
      runtime.effects.push({ type: "line", x: origin.x, y: origin.y, x2: target.x, y2: target.y, life: 0.32, maxLife: 0.32, color: "#ff8a47", width: 4 });
    } else if (weapon.type === "repulsor") {
      const dx = target.x - origin.x, dy = target.y - origin.y, d = Math.max(1, Math.hypot(dx, dy));
      target.vx += dx / d * 65;
      target.vy += dy / d * 65;
      damageEntity(target, weapon.damage, 8);
      runtime.effects.push({ type: "ring", x: target.x, y: target.y, life: 0.35, maxLife: 0.35, radius: 28, color: "#c279ff" });
    } else if (["antimatter","nuclear","nuclearHeavy"].includes(weapon.type)) {
      const radius = weapon.type === "nuclearHeavy" ? 85 : weapon.type === "nuclear" ? 52 : 46;
      const targets = runtime.entities.filter((item) => !item.dead && Math.hypot(item.x - target.x, item.y - target.y) <= radius);
      targets.forEach((item) => damageEntity(item, weapon.damage * (1 - Math.min(0.7, Math.hypot(item.x - target.x, item.y - target.y) / radius * 0.65)), weapon.type === "antimatter" ? 40 : 20));
      runtime.effects.push({ type: "explosion", x: target.x, y: target.y, life: 0.9, maxLife: 0.9, radius, color: weapon.type === "antimatter" ? "#ff3cb4" : "#d9ed77" });
      module.heat += weapon.type === "nuclearHeavy" ? 75 : 35;
    }
    runtime.effects.push({ type: "flash", x: origin.x, y: origin.y, life: 0.12, maxLife: 0.12, radius: 4, color: "#ffffff" });
    return true;
  }

  function makePlayerProjectile(origin, angle, speed, damage, type, targetId, radius) {
    return {
      id: runtime.entityId++, team: "player", type, x: origin.x, y: origin.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      speed, damage, life: type === "rail" ? 1.8 : 4.5, radius, targetId, dead: false,
      color: type === "rail" ? "#fff2b0" : type.includes("missile") || type === "swarm" ? "#ff9c61" : "#d8edf5"
    };
  }

  function updateProjectiles(dt) {
    for (const projectile of runtime.projectiles) {
      if (projectile.dead) continue;
      projectile.life -= dt;
      if (projectile.life <= 0) { projectile.dead = true; continue; }
      if (projectile.homing && projectile.targetId) {
        const target = runtime.entities.find((entity) => entity.id === projectile.targetId && !entity.dead);
        if (target) {
          const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
          const current = Math.atan2(projectile.vy, projectile.vx);
          let diff = ((desired - current + Math.PI * 3) % TAU) - Math.PI;
          const angle = current + clamp(diff, -2.8 * dt, 2.8 * dt);
          projectile.vx = Math.cos(angle) * projectile.speed;
          projectile.vy = Math.sin(angle) * projectile.speed;
        }
      }
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;

      if (projectile.team === "player") {
        const target = runtime.entities.find((entity) => !entity.dead && Math.hypot(entity.x - projectile.x, entity.y - projectile.y) <= entity.radius + projectile.radius);
        if (target) {
          damageEntity(target, projectile.damage, projectile.type === "rail" ? 18 : 2);
          if (projectile.heatDamage) target.heat = (target.heat || 0) + projectile.heatDamage;
          projectile.dead = true;
          runtime.effects.push({ type: "spark", x: projectile.x, y: projectile.y, life: 0.22, maxLife: 0.22, radius: 3, color: projectile.color });
        }
      } else if (hitStationAt(projectile.x, projectile.y)) {
        damageStationAt(projectile.x, projectile.y, projectile.damage, projectile.type === "rail" ? "вражеский рельсотрон" : "вражеский огонь");
        projectile.dead = true;
        runtime.effects.push({ type: "spark", x: projectile.x, y: projectile.y, life: 0.25, maxLife: 0.25, radius: 4, color: projectile.color });
      }
      if (projectile.x < -40 || projectile.y < -40 || projectile.x > CANVAS_W + 40 || projectile.y > CANVAS_H + 40) projectile.dead = true;
    }
    runtime.projectiles = runtime.projectiles.filter((projectile) => !projectile.dead);
  }

  function damageEntity(entity, damage, armorPen = 0) {
    if (!entity || entity.dead) return;
    const armor = Math.max(0, (entity.armor || 0) - armorPen);
    entity.hp -= Math.max(1, damage - armor);
    if (entity.hp <= 0) destroyEntity(entity);
  }

  function destroyEntity(entity) {
    if (entity.dead) return;
    entity.dead = true;
    runtime.effects.push({ type: "explosion", x: entity.x, y: entity.y, life: entity.kind === "enemy" ? 0.65 : 0.38, maxLife: entity.kind === "enemy" ? 0.65 : 0.38, radius: entity.radius * 2.2, color: entity.kind === "enemy" ? "#ff4b7d" : "#d9a55b" });
    if (entity.kind === "asteroid") {
      state.asteroidsDestroyed += 1;
      state.score += 4 + entity.size * 3;
      const pieces = Math.min(4, 1 + entity.size);
      for (let i = 0; i < pieces; i++) dropLoot(entity.x, entity.y, entity.resourceKey, Math.max(1, Math.ceil(entity.reward / pieces)));
    } else if (entity.kind === "enemy") {
      state.kills += 1;
      state.researchPoints += Math.max(1, Math.floor(entity.reward * 0.08));
      state.score += entity.reward * 3;
      dropEnemySalvage(entity);
      if (ENEMIES[entity.enemyType]?.boss) {
        state.researchPoints += Math.floor(entity.reward * 0.4);
        showBanner(`${ENEMIES[entity.enemyType].name.toUpperCase()} УНИЧТОЖЕН`, 4);
        logEvent(`Босс «${ENEMIES[entity.enemyType].name}» уничтожен. Получены редкие трофеи и данные.`);
      }
    }
  }

  function dropLoot(x, y, key, amount) {
    runtime.loot.push({
      id: runtime.entityId++, kind: "resource", resourceKey: key, amount, x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, ttl: 70, radius: 2, color: RESOURCES[key]?.color || "#fff"
    });
  }

  function updateCollectors(dt, stats) {
    const station = getStation();
    const collectors = Object.values(station.modules).filter((module) => MODULES[module.type]?.collector);
    for (const loot of runtime.loot) {
      loot.ttl -= dt;
      loot.x += loot.vx * dt;
      loot.y += loot.vy * dt;
      loot.vx *= Math.pow(0.94, dt * 10);
      loot.vy *= Math.pow(0.94, dt * 10);
      let best = null, bestDistance = Infinity;
      for (const module of collectors) {
        const def = MODULES[module.type];
        const center = getModuleCenter(module);
        const distance = Math.hypot(center.x - loot.x, center.y - loot.y);
        if (distance < def.collector.range && distance < bestDistance) {
          best = { module, center, def };
          bestDistance = distance;
        }
      }
      if (!best) continue;
      const speed = best.def.collector.speed * stats.efficiency;
      const dx = best.center.x - loot.x, dy = best.center.y - loot.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      loot.vx += dx / distance * speed * dt * 2.3;
      loot.vy += dy / distance * speed * dt * 2.3;
      if (distance < 5) collectLoot(loot, stats);
    }
    runtime.loot = runtime.loot.filter((loot) => loot.ttl > 0 && !loot.collected);
  }

  function collectLoot(loot, stats) {
    const station = getStation();
    if (loot.kind === "crew") {
      const capacity = Math.min(stats.beds, stats.lifeSupportCapacity);
      const room = Math.max(0, capacity - station.crew);
      if (room <= 0) {
        loot.vx *= -0.4;
        loot.vy *= -0.4;
        loot.ttl = Math.max(loot.ttl, 20);
        if (performance.now() - runtime.lastToastAt > 4000) {
          toast("Для спасённых нужны свободные койки и жизнеобеспечение.", "warn");
          runtime.lastToastAt = performance.now();
        }
        return;
      }
      const rescued = Math.min(room, loot.amount);
      station.crew += rescued;
      loot.collected = true;
      state.score += rescued * 80;
      logEvent(`Спасено членов экипажа: ${rescued}.`);
      toast(`Экипаж пополнен: +${rescued}.`);
      return;
    }
    const added = addResource(loot.resourceKey, loot.amount, stats);
    if (added <= 0) return;
    loot.collected = true;
    state.resourcesCollected += added;
    state.score += added;
  }

  function updateEndgameModules(dt, stats) {
    const station = getStation();
    for (const module of Object.values(station.modules)) {
      module.gravityCooldown = Math.max(0, (module.gravityCooldown || 0) - dt);
      if (module.type === "orbitalPrinter" && module.printPaid) {
        if (stats.powerEfficiency < 0.7 || stats.crewEfficiency < 0.7 || module.heat > 1050) {
          module.status = "Фабрикация приостановлена";
          continue;
        }
        module.printProgress += dt * stats.efficiency / 3.2;
        module.status = `Печать реактора: ${Math.floor(module.printProgress)}%`;
        if (module.printProgress >= 100) completeOrbitalPrint(module);
      }
    }
  }

  function updateEffects(dt) {
    for (const effect of runtime.effects) effect.life -= dt;
    runtime.effects = runtime.effects.filter((effect) => effect.life > 0);
    if (runtime.bannerTimer > 0) {
      runtime.bannerTimer -= dt;
      if (runtime.bannerTimer <= 0) DOM.combatBanner.hidden = true;
    }
  }

  function updateSimulation(dt) {
    if (!state || state.paused || state.gameOver) return;
    state.playTime += dt;
    runtime.saveTimer += dt;
    runtime.uiTimer += dt;

    updateGeneratorFuel(dt);
    let stats = calculateStationStats();
    runtime.currentStats = stats;
    updatePowerBuffer(dt, stats);
    updateProduction(dt, stats);
    updateHeat(dt, stats);
    updateRadiation(dt);
    stats = calculateStationStats();
    runtime.currentStats = stats;
    updateEndgameModules(dt, stats);

    if (!state.tutorial.active) {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) triggerWave();
      runtime.asteroidTimer += dt;
      const asteroidInterval = Math.max(0.9, 4.6 - state.wave * 0.13);
      if (runtime.asteroidTimer >= asteroidInterval) {
        runtime.asteroidTimer %= asteroidInterval;
        spawnAsteroid(false);
      }
      updateWeapons(dt, stats);
      updateEntities(dt);
      updateProjectiles(dt);
      updateCollectors(dt, stats);
    }
    updateEffects(dt);

    if (runtime.uiTimer >= 0.2) {
      runtime.uiTimer = 0;
      renderAllUI(false);
    }
    if (runtime.saveTimer >= 15) {
      runtime.saveTimer = 0;
      saveGame(true);
    }
  }

  function triggerGameOver(reason) {
    if (!state || state.gameOver) return;
    state.gameOver = true;
    state.paused = true;
    DOM.combatBanner.hidden = true;
    logEvent(`СТАНЦИЯ ПОТЕРЯНА: ${reason}.`);
    const finalScore = state.score;
    showModal({
      eyebrow: "VOIDSPACE // SIGNAL LOST",
      title: "Станция погибла",
      body: `<p><strong>${escapeHtml(reason)}</strong></p><p>Пройдено волн: <strong>${state.wave}</strong><br>Уничтожено астероидов: <strong>${state.asteroidsDestroyed}</strong><br>Уничтожено врагов: <strong>${state.kills}</strong><br>Итоговый счёт: <strong>${format(finalScore)}</strong></p>`,
      actions: [
        { label: "В главное меню", onClick: returnToMenu },
        { label: "Новая станция", primary: true, onClick: () => { clearSavedGame(); startNewGame(); } }
      ]
    });
  }

  function returnToMenu() {
    state = null;
    resetRuntime();
    DOM.gameShell.classList.remove("is-visible");
    DOM.gameShell.setAttribute("aria-hidden", "true");
    DOM.bootScreen.classList.add("is-visible");
    DOM.continueBtn.disabled = !loadSavedState();
  }

  function gameLoop(timestamp) {
    const rawDt = Math.min(0.05, Math.max(0, (timestamp - runtime.lastFrame) / 1000 || 0));
    runtime.lastFrame = timestamp;
    if (state && !state.paused && !state.gameOver) updateSimulation(rawDt * state.speed);
    renderFrame(timestamp / 1000);
    requestAnimationFrame(gameLoop);
  }

  function renderFrame(time) {
    const ctx = DOM.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    drawSpaceBackground(ctx, time);
    if (state) {
      ctx.save();
      applyWorldTransform(ctx);
      drawFoundation(ctx, time);
      drawModules(ctx, time);
      drawTutorialHints(ctx, time);
      drawLoot(ctx, time);
      drawEntities(ctx, time);
      drawProjectiles(ctx, time);
      drawEffects(ctx, time);
      drawBuildGhost(ctx, time);
      drawHoveredTile(ctx, time);
      drawSelection(ctx, time);
      ctx.restore();
      drawCanvasTelemetry(ctx, time);
    }
    ctx.restore();
  }

  function drawModules(ctx, time) {
    const station = getStation();
    const modules = Object.values(station.modules).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const module of modules) drawModule(ctx, module, time);
  }

  function drawEntities(ctx, time) {
    for (const entity of runtime.entities) {
      if (entity.dead) continue;
      if (entity.kind === "asteroid") drawAsteroid(ctx, entity, time);
      else if (entity.kind === "enemy") drawEnemy(ctx, entity, time);
    }
  }

  function drawEntityHealth(ctx, entity) {
    if (entity.hp >= entity.maxHp) return;
    const width = Math.max(6, entity.radius * 2);
    ctx.fillStyle = "rgba(0,0,0,.7)";
    ctx.fillRect(Math.floor(entity.x - width / 2), Math.floor(entity.y - entity.radius - 5), width, 2);
    ctx.fillStyle = entity.kind === "enemy" ? "#ff4b7d" : "#ffc857";
    ctx.fillRect(Math.floor(entity.x - width / 2), Math.floor(entity.y - entity.radius - 5), Math.ceil(width * clamp(entity.hp / entity.maxHp, 0, 1)), 1);
  }

  function drawTutorialHints(ctx, time) {
    if (!state?.tutorial?.active) return;
    const step = TUTORIAL_STEPS[state.tutorial.step];
    if (!step?.expected) return;
    const positions = TUTORIAL_AUTO_POSITIONS[step.expected] || [];
    const remaining = Math.max(0, (step.count || 0) - state.tutorial.progress);
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 4) * 0.12;
    ctx.strokeStyle = "#57f1ff";
    ctx.setLineDash([2, 2]);
    for (const [x, y] of positions.slice(0, remaining || positions.length)) {
      const def = getBuildDef(step.expected);
      const size = def?.kind === "structure" ? { w: 1, h: 1 } : rotatedSize(def.w, def.h, state.rotation);
      ctx.strokeRect(x * TILE + .5, y * TILE + .5, size.w * TILE - 1, size.h * TILE - 1);
    }
    ctx.restore();
  }

  function drawHoveredTile(ctx, time) {
    if (!runtime.mouse.inside || runtime.mouse.gx < 0 || runtime.mouse.gy < 0 || runtime.mouse.gx >= GRID_W || runtime.mouse.gy >= GRID_H) return;
    const x = runtime.mouse.gx * TILE, y = runtime.mouse.gy * TILE;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = state.mode === "build" ? "#57f1ff" : "#ffd88a";
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    ctx.globalAlpha = 0.35 + Math.sin(time * 5) * 0.1;
    ctx.fillStyle = state.mode === "build" ? "#57f1ff" : "#ffc857";
    ctx.fillRect(x + P(1), y + P(1), TILE - P(2), TILE - P(2));
    ctx.restore();
  }

  function drawSelection(ctx, time) {
    const station = getStation();
    const module = runtime.selectedModuleId ? station.modules[runtime.selectedModuleId] : null;
    if (!module) return;
    const def = MODULES[module.type];
    const size = rotatedSize(def.w, def.h, module.rotation);
    const px = module.x * TILE, py = module.y * TILE, width = size.w * TILE, height = size.h * TILE;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.65 + Math.sin(time * 5) * .25;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(px - 1.5, py - 1.5, width + 3, height + 3);
    ctx.restore();
    if (def.collector) {
      const center = getModuleCenter(module);
      ctx.save();
      ctx.globalAlpha = .15;
      ctx.strokeStyle = "#57f1ff";
      ctx.beginPath(); ctx.arc(center.x, center.y, def.collector.range, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (def.weapon) {
      const center = getModuleCenter(module);
      ctx.save();
      ctx.globalAlpha = .12;
      ctx.strokeStyle = "#ff668e";
      ctx.beginPath(); ctx.arc(center.x, center.y, def.weapon.range, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  function drawBossStatus(ctx) {
    const boss = runtime.entities.find((entity) => entity.kind === "enemy" && ENEMIES[entity.enemyType]?.boss);
    if (!boss) return;
    const def = ENEMIES[boss.enemyType];
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(110, 8, CANVAS_W - 220, 10);
    ctx.fillStyle = def.color;
    ctx.fillRect(111, 9, (CANVAS_W - 222) * clamp(boss.hp / boss.maxHp, 0, 1), 8);
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(def.name.toUpperCase(), CANVAS_W / 2, 21);
  }

  function drawCanvasTelemetry(ctx, time) {
    const stats = runtime.currentStats || calculateStationStats();
    const pointer = runtime.mouse.inside && runtime.mouse.gx >= 0 && runtime.mouse.gy >= 0 && runtime.mouse.gx < GRID_W && runtime.mouse.gy < GRID_H ? ` // CURSOR ${runtime.mouse.gx},${runtime.mouse.gy}` : "";
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(123,190,211,.72)";
    ctx.fillText(`ORB ${getStation().name} // MASS ${stats.mass}t // EFF ${Math.round(stats.efficiency * 100)}%${pointer}`, 8, CANVAS_H - 18);
    ctx.fillStyle = "rgba(123,190,211,.58)";
    ctx.fillText(`ZOOM ${runtime.camera.zoom.toFixed(2)}x`, 8, CANVAS_H - 8);
    drawBossStatus(ctx);
    if (state.thermalView) {
      ctx.fillStyle = "rgba(3,7,11,.75)";
      ctx.fillRect(CANVAS_W - 80, 5, 75, 18);
      ctx.fillStyle = "#57f1ff";
      ctx.fillText("THERMAL OVERLAY", CANVAS_W - 76, 8);
      const gradient = ctx.createLinearGradient(CANVAS_W - 76, 0, CANVAS_W - 10, 0);
      gradient.addColorStop(0, "#214cff"); gradient.addColorStop(.45, "#57f1ff"); gradient.addColorStop(.7, "#ffc857"); gradient.addColorStop(1, "#ff3c5f");
      ctx.fillStyle = gradient;
      ctx.fillRect(CANVAS_W - 76, 16, 66, 3);
    }
    const incoming = runtime.entities.filter((entity) => entity.kind === "enemy").length;
    if (incoming) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,90,124,.8)";
      ctx.fillText(`HOSTILES ${incoming}`, CANVAS_W - 5, CANVAS_H - 12);
    }
  }

  function temperatureColor(temp) {
    const t = clamp((temp - 120) / 1000, 0, 1);
    if (t < .25) return mixHex("#1738a8", "#43d8ff", t / .25);
    if (t < .55) return mixHex("#43d8ff", "#ffd45d", (t - .25) / .3);
    return mixHex("#ffd45d", "#ff355d", (t - .55) / .45);
  }

  function shadeColor(hex, amount) {
    const color = hex.replace("#", "");
    const num = parseInt(color.length === 3 ? color.split("").map((c) => c + c).join("") : color, 16);
    const r = clamp((num >> 16) + amount, 0, 255);
    const g = clamp(((num >> 8) & 0xff) + amount, 0, 255);
    const b = clamp((num & 0xff) + amount, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function mixHex(a, b, t) {
    const parse = (hex) => {
      const value = parseInt(hex.replace("#", ""), 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    };
    const ca = parse(a), cb = parse(b);
    return `rgb(${Math.round(lerp(ca[0], cb[0], t))},${Math.round(lerp(ca[1], cb[1], t))},${Math.round(lerp(ca[2], cb[2], t))})`;
  }


  // ---------------------------------------------------------------------------
  // 16×16 SPRITE RENDERER
  // All world textures are local PNG files from ./sprites. Every source sprite
  // is horizontally and vertically symmetric; rotation is used only to orient
  // rectangular modules, lanes, barrels, ships, asteroids and projectiles.
  // ---------------------------------------------------------------------------

  const SPRITES = new Map();
  const SPRITE_BACKGROUND_TILE_COUNT = 12;
  const SPRITE_PROJECTILES = ["bullet", "rail", "enemyBolt", "missile", "swarm", "thermalMissile"];
  const SPRITE_EFFECTS = ["explosion", "spark", "flash", "ring"];
  const SPRITE_OVERLAYS = ["damage", "barrel", "glowCyan", "glowAmber", "glowGreen", "glowMagenta", "glowPurple", "glowOrange"];

  function spriteUrl(group, key) {
    return `sprites/${group}_${key}.png`;
  }

  function spriteMapKey(group, key) {
    return `${group}:${key}`;
  }

  function buildSpriteManifest() {
    const manifest = [];
    Object.keys(STRUCTURES).forEach((key) => manifest.push(["structure", key]));
    Object.keys(MODULES).forEach((key) => manifest.push(["module", key]));
    Object.keys(RESOURCES).forEach((key) => {
      manifest.push(["resource", key]);
      manifest.push(["asteroid", key]);
    });
    Object.keys(ENEMIES).forEach((key) => manifest.push(["enemy", key]));
    SPRITE_PROJECTILES.forEach((key) => manifest.push(["projectile", key]));
    SPRITE_EFFECTS.forEach((key) => manifest.push(["effect", key]));
    SPRITE_OVERLAYS.forEach((key) => manifest.push(["overlay", key]));
    for (let index = 0; index < SPRITE_BACKGROUND_TILE_COUNT; index++) manifest.push(["background", `space${index}`]);
    manifest.push(["background", "blackHole"], ["loot", "crew"]);
    return manifest;
  }

  function loadSprite(group, key, onProgress) {
    return new Promise((resolve, reject) => {
      const image = new Image(16, 16);
      image.decoding = "async";
      image.onload = () => {
        SPRITES.set(spriteMapKey(group, key), image);
        onProgress?.();
        resolve(image);
      };
      image.onerror = () => reject(new Error(`Не удалось загрузить ${spriteUrl(group, key)}`));
      image.src = spriteUrl(group, key);
    });
  }

  async function initSpriteAssets() {
    const status = document.getElementById("assetStatus");
    const manifest = buildSpriteManifest();
    let loaded = 0;
    const updateStatus = () => {
      loaded += 1;
      if (status && (loaded === manifest.length || loaded % 24 === 0)) {
        status.textContent = `Загрузка PNG-спрайтов 16×16: ${loaded} / ${manifest.length}`;
      }
    };
    await Promise.all(manifest.map(([group, key]) => loadSprite(group, key, updateStatus)));
    if (status) status.textContent = `Готово: загружено ${manifest.length} локальных симметричных спрайтов 16×16. Прогресс сохраняется в браузере.`;
    return manifest.length;
  }

  function getSprite(group, key) {
    return SPRITES.get(spriteMapKey(group, key)) || null;
  }

  function drawSpriteRect(ctx, group, key, x, y, width, height, alpha = 1) {
    const image = getSprite(group, key);
    if (!image) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha *= alpha;
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    ctx.restore();
    return true;
  }

  function drawSpriteRotated(ctx, group, key, centerX, centerY, width, height, angle = 0, alpha = 1) {
    const image = getSprite(group, key);
    if (!image) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha *= alpha;
    ctx.translate(Math.round(centerX), Math.round(centerY));
    ctx.rotate(angle);
    ctx.drawImage(image, Math.round(-width / 2), Math.round(-height / 2), Math.round(width), Math.round(height));
    ctx.restore();
    return true;
  }

  function initSpriteBackground(seed) {
    runtime.stars = [];
    runtime.dust = [];
    const layer = document.createElement("canvas");
    layer.width = CANVAS_W;
    layer.height = CANVAS_H;
    const layerCtx = layer.getContext("2d", { alpha: false });
    layerCtx.imageSmoothingEnabled = false;
    layerCtx.fillStyle = "#010207";
    layerCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const seedOffset = Math.abs(Number(seed) || 0) % SPRITE_BACKGROUND_TILE_COUNT;
    for (let tileY = 0; tileY < GRID_H; tileY++) {
      for (let tileX = 0; tileX < GRID_W; tileX++) {
        const scatter = hash2(tileX, tileY, seedOffset + 173);
        const variant = scatter > 0.925
          ? 1 + Math.floor(hash2(tileX, tileY, seedOffset + 619) * (SPRITE_BACKGROUND_TILE_COUNT - 1))
          : 0;
        const image = getSprite("background", `space${variant}`);
        if (image) layerCtx.drawImage(image, tileX * TILE, tileY * TILE, TILE, TILE);
      }
    }

    const blackHole = getSprite("background", "blackHole");
    if (blackHole) layerCtx.drawImage(blackHole, 10, 4, 112, 112);
    runtime.spaceLayer = layer;
  }

  function drawSpaceBackground(ctx) {
    ctx.fillStyle = "#010207";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (runtime.spaceLayer) ctx.drawImage(runtime.spaceLayer, 0, 0);

    // The grid is a navigation overlay, not a generated texture.
    ctx.strokeStyle = "rgba(71,105,126,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_W; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(CANVAS_W, y + 0.5);
      ctx.stroke();
    }
  }

  function drawFoundation(ctx) {
    const station = getStation();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const foundation = station.foundation[y][x];
        if (!foundation) continue;
        const px = x * TILE;
        const py = y * TILE;
        drawSpriteRect(ctx, "structure", foundation.type, px, py, TILE, TILE);
        const health = clamp(foundation.hp / Math.max(1, foundation.maxHp), 0, 1);
        if (health < 0.62) drawSpriteRect(ctx, "overlay", "damage", px, py, TILE, TILE, 0.45 + (1 - health) * 0.45);
        if (state.thermalView && !station.moduleAt[y][x]) {
          const temp = 220 + (1 - health) * 350;
          ctx.save();
          ctx.globalAlpha = 0.34;
          ctx.fillStyle = temperatureColor(temp);
          ctx.fillRect(px, py, TILE, TILE);
          ctx.restore();
        }
      }
    }
  }

  function getModuleGlow(def, module) {
    if (def.kind === "weapon") return "glowMagenta";
    if (def.kind === "nuclear") return "glowGreen";
    if (def.kind === "thermal") return "glowOrange";
    if (def.kind === "endgame") return "glowPurple";
    if (def.kind === "logistics" || def.kind === "storage") return "glowAmber";
    if (def.kind === "crew") return "glowGreen";
    if (def.kind === "generator" || def.kind === "battery" || def.kind === "power") return "glowCyan";
    if (def.kind === "processor" && module.progress > 0) return "glowCyan";
    return null;
  }

  function drawModule(ctx, module, time) {
    const def = MODULES[module.type];
    if (!def) return;
    const size = rotatedSize(def.w, def.h, module.rotation);
    const px = module.x * TILE;
    const py = module.y * TILE;
    const width = size.w * TILE;
    const height = size.h * TILE;
    const centerX = px + width / 2;
    const centerY = py + height / 2;
    const sourceWidth = def.w * TILE;
    const sourceHeight = def.h * TILE;
    const rotation = module.rotation * Math.PI / 2;
    const glow = getModuleGlow(def, module);

    if (glow) {
      const pulse = 0.24 + Math.sin(time * 3.6 + module.x * 0.31 + module.y * 0.17) * 0.08;
      const glowSize = Math.max(12, Math.min(width, height) * 0.9);
      drawSpriteRect(ctx, "overlay", glow, centerX - glowSize / 2, centerY - glowSize / 2, glowSize, glowSize, pulse);
    }

    drawSpriteRotated(ctx, "module", module.type, centerX, centerY, sourceWidth, sourceHeight, rotation);

    if (def.weapon) {
      const target = getPriorityTarget({ x: centerX, y: centerY }, def.weapon.range);
      const angle = target ? Math.atan2(target.y - centerY, target.x - centerX) : rotation;
      const barrelWidth = Math.max(11, Math.min(28, Math.max(width, height) * 0.58));
      const barrelHeight = Math.max(6, Math.min(12, Math.min(width, height) * 0.42));
      drawSpriteRotated(ctx, "overlay", "barrel", centerX, centerY, barrelWidth, barrelHeight, angle, 0.9);
    }

    const health = clamp(module.hp / Math.max(1, module.maxHp), 0, 1);
    if (health < 0.58) drawSpriteRect(ctx, "overlay", "damage", px, py, width, height, 0.4 + (1 - health) * 0.55);

    if (def.processorStages.length && module.progress > 0) {
      ctx.fillStyle = "rgba(2,6,9,.82)";
      ctx.fillRect(px + 2, py + height - 3, Math.max(1, width - 4), 2);
      ctx.fillStyle = "#8cecff";
      ctx.fillRect(px + 2, py + height - 3, Math.max(1, Math.floor((width - 4) * clamp(module.progress, 0, 1))), 1);
    }

    if (state.thermalView) {
      ctx.save();
      ctx.globalAlpha = 0.46;
      ctx.fillStyle = temperatureColor(module.heat);
      ctx.fillRect(px, py, width, height);
      ctx.restore();
    }

    if (module.hp < module.maxHp || module.heat > 850) {
      ctx.fillStyle = "rgba(0,0,0,.8)";
      ctx.fillRect(px, py - 2, width, 2);
      ctx.fillStyle = health > 0.55 ? "#7dff9b" : health > 0.25 ? "#ffc857" : "#ff4b5f";
      ctx.fillRect(px, py - 2, Math.max(1, Math.floor(width * health)), 1);
    }
  }

  function drawLoot(ctx, time) {
    for (const loot of runtime.loot) {
      const size = loot.kind === "crew" ? 11 : 8;
      const angle = time * (loot.kind === "crew" ? 0.25 : 0.7) + loot.id * 0.13;
      const group = loot.kind === "crew" ? "loot" : "resource";
      const key = loot.kind === "crew" ? "crew" : loot.resourceKey;
      drawSpriteRotated(ctx, group, key, loot.x, loot.y, size, size, angle, 0.96);
    }
  }

  function drawAsteroid(ctx, asteroid, time) {
    const size = Math.max(9, asteroid.radius * 2.45);
    const direction = asteroid.id % 2 ? 1 : -1;
    drawSpriteRotated(ctx, "asteroid", asteroid.resourceKey, asteroid.x, asteroid.y, size, size, time * 0.22 * direction + asteroid.seed, 1);
    drawEntityHealth(ctx, asteroid);
  }

  function drawEnemy(ctx, enemy, time) {
    const def = ENEMIES[enemy.enemyType];
    if (!def) return;
    const core = getStationCorePoint();
    const angle = Math.atan2(core.y - enemy.y, core.x - enemy.x);
    const size = Math.max(10, def.size * (def.boss ? 2.4 : 2.55));
    const glowKey = enemy.empTime > 0 ? "glowCyan" : enemy.enemyType === "strikeStation" ? "glowPurple" : "glowMagenta";
    const glowSize = size * (def.boss ? 1.45 : 1.2);
    drawSpriteRect(ctx, "overlay", glowKey, enemy.x - glowSize / 2, enemy.y - glowSize / 2, glowSize, glowSize, 0.2 + Math.sin(time * 4 + enemy.id) * 0.05);
    drawSpriteRotated(ctx, "enemy", enemy.enemyType, enemy.x, enemy.y, size, size, angle, 1);
    drawEntityHealth(ctx, enemy);
  }

  function drawProjectiles(ctx) {
    for (const projectile of runtime.projectiles) {
      const speed = Math.max(0.001, Math.hypot(projectile.vx, projectile.vy));
      const angle = Math.atan2(projectile.vy, projectile.vx);
      let width = Math.max(4, projectile.radius * 2.8);
      let height = width;
      if (projectile.type === "rail") {
        width = 11;
        height = 3;
      } else if (["missile", "swarm", "thermalMissile"].includes(projectile.type)) {
        width = 8;
        height = 5;
      } else if (projectile.type === "bullet") {
        width = 5;
        height = 3;
      }
      const key = SPRITE_PROJECTILES.includes(projectile.type) ? projectile.type : projectile.team === "enemy" ? "enemyBolt" : "bullet";
      drawSpriteRotated(ctx, "projectile", key, projectile.x, projectile.y, width, height, angle, clamp(0.7 + speed / 400, 0.7, 1));
    }
  }

  function drawEffects(ctx, time) {
    for (const effect of runtime.effects) {
      const t = clamp(1 - effect.life / effect.maxLife, 0, 1);
      if (effect.type === "line") {
        ctx.save();
        ctx.globalAlpha = clamp(1 - t, 0, 1);
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = effect.width || 1;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        if (effect.jagged) {
          const dx = effect.x2 - effect.x;
          const dy = effect.y2 - effect.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const wobble = Math.sin(time * 28 + effect.x * 0.11 + effect.y * 0.17) * 4;
          ctx.lineTo((effect.x + effect.x2) / 2 - dy / length * wobble, (effect.y + effect.y2) / 2 + dx / length * wobble);
        }
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const key = SPRITE_EFFECTS.includes(effect.type) ? effect.type : "spark";
      let size = Math.max(4, (effect.radius || 3) * 2);
      if (effect.type === "explosion") size *= 0.55 + t * 1.05;
      if (effect.type === "ring") size *= Math.max(0.2, t);
      if (effect.type === "flash") size *= 0.8 + t * 0.25;
      drawSpriteRotated(ctx, "effect", key, effect.x, effect.y, size, size, time * 0.5, clamp(1 - t, 0, 1));
    }
  }

  function drawBuildGhost(ctx, time) {
    if (!state || state.mode !== "build" || !runtime.mouse.inside) return;
    const def = getBuildDef(state.selectedBuild);
    if (!def) return;
    const x = runtime.mouse.gx;
    const y = runtime.mouse.gy;
    const size = def.kind === "structure" ? { w: 1, h: 1 } : rotatedSize(def.w, def.h, state.rotation);
    const validation = def.kind === "structure"
      ? canPlaceFoundation(state.selectedBuild, x, y)
      : canPlaceModule(state.selectedBuild, x, y, state.rotation);
    const px = x * TILE;
    const py = y * TILE;
    const width = size.w * TILE;
    const height = size.h * TILE;
    const pulse = 0.42 + Math.sin(time * 5) * 0.07;

    if (def.kind === "structure") {
      drawSpriteRect(ctx, "structure", state.selectedBuild, px, py, TILE, TILE, pulse);
    } else {
      drawSpriteRotated(
        ctx,
        "module",
        state.selectedBuild,
        px + width / 2,
        py + height / 2,
        def.w * TILE,
        def.h * TILE,
        state.rotation * Math.PI / 2,
        pulse
      );
    }
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = validation.ok ? "#57f1ff" : "#ff4b5f";
    ctx.fillRect(px, py, width, height);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = validation.ok ? "#c8fbff" : "#ffd0d6";
    ctx.strokeRect(px + 0.5, py + 0.5, width - 1, height - 1);
    ctx.restore();
  }

  initEvents();
  DOM.newGameBtn.disabled = true;
  DOM.continueBtn.disabled = true;
  renderCodex("systems");
  initSpriteAssets()
    .then(() => {
      DOM.newGameBtn.disabled = false;
      DOM.continueBtn.disabled = !hasSavedGame() || !loadSavedState();
      document.body.classList.add("sprites-ready");
    })
    .catch((error) => {
      console.error(error);
      const status = document.getElementById("assetStatus");
      if (status) status.textContent = `Ошибка загрузки спрайтов: ${error.message}`;
    });
})();
