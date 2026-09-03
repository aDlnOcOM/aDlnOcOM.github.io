// Управляет убежищем, прокачкой, процедурными этажами и desktop bullet-hell забегом.
(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const SAVE_KEY = "megastructure-stranger-mvp-v1";
  const STARTER_LOADOUT = [
    { id: "bag", slot: "РЮКЗАК", name: "Офисная сумка", icon: "BAG" },
    { id: "smg", slot: "ОСНОВНОЕ", name: "ПП Охраны", icon: "SMG" },
    { id: "knife", slot: "ВТОРИЧНОЕ", name: "Нож охраны", icon: "KNF" },
    { id: "chest", slot: "НАГРУДНИК", name: "Потрёпанная кожанка", icon: "CHR" },
    { id: "pants", slot: "ШТАНЫ", name: "Старые карго", icon: "CRG" },
    { id: "helmet", slot: "ШЛЕМ", name: "Потрёпанная бейсболка", icon: "CAP" },
    { id: "boots", slot: "БОТИНКИ", name: "Берцы охранника этажа", icon: "BOT" }
  ];
  const IMPLANTS = [
    { id: "cortex", name: "Контур тишины", effect: "+15 к целостности", cost: 20, requires: [] },
    { id: "myofiber", name: "Миофибры ног", effect: "+12% к скорости", cost: 34, requires: ["cortex"] },
    { id: "ceramic", name: "Керамо-рёбра", effect: "+2 к броне", cost: 38, requires: ["cortex"] },
    { id: "ghost", name: "Слепой импульс", effect: "дольше неуязвимость", cost: 64, requires: ["myofiber", "ceramic"] }
  ];
  const EQUIPMENT_TREES = {
    smg: {
      label: "ОСНОВНОЕ ОРУЖИЕ / ПП ОХРАНЫ",
      branches: [
        { id: "muzzle", base: "Нет надульника", options: [
          { id: "compensator", name: "Компенсатор", effect: "−24% разброс", cost: 26, tier: { name: "Портовый контур", effect: "ещё −12% разброс", cost: 38 } },
          { id: "suppressor", name: "Глушитель", effect: "−25% шума", cost: 24, tier: { name: "Глушитель II", effect: "−45% шума", cost: 36 } }
        ] },
        { id: "ammo", base: "Простой патрон", options: [
          { id: "incendiary", name: "Зажигательный", effect: "+1 урон", cost: 25, tier: { name: "Термозаряд", effect: "+2 урон", cost: 42 } },
          { id: "armor-piercing", name: "Бронебойный", effect: "+2 урона", cost: 28, tier: { name: "Вольфрамовый", effect: "+3 урона", cost: 46 } }
        ] },
        { id: "magazine", base: "Обычный магазин", options: [
          { id: "extended", name: "Удлинённый", effect: "+12 патронов", cost: 30, tier: { name: "Барабан", effect: "+8 патронов", cost: 44 } },
          { id: "quick-feed", name: "Быстрая подача", effect: "−22% перезарядка", cost: 27, tier: { name: "Автоподача", effect: "ещё −18%", cost: 40 } }
        ] },
        { id: "optic", base: "Iron sights", options: [
          { id: "reflex", name: "Коллиматор", effect: "−20% разброс", cost: 22, tier: { name: "Точка 2x", effect: "ещё −10%", cost: 35 } },
          { id: "rangefinder", name: "Дальномер", effect: "+10% скорость пули", cost: 23, tier: { name: "Дальномер II", effect: "+15% скорость", cost: 37 } }
        ] },
        { id: "stock", base: "Нет приклада", options: [
          { id: "frame-stock", name: "Каркасный", effect: "−14% разброс", cost: 20, tier: { name: "Упор-фиксатор", effect: "ещё −10%", cost: 34 } },
          { id: "servo-stock", name: "Сервоприклад", effect: "−14% перезарядка", cost: 24, tier: { name: "Сервопривод II", effect: "ещё −12%", cost: 38 } }
        ] },
        { id: "underbarrel", base: "Нет подствольника", options: [
          { id: "scanner", name: "Сканер", effect: "контур врагов", cost: 18, tier: { name: "Сканер II", effect: "дальний контур", cost: 30 } },
          { id: "shock-module", name: "Шок-модуль", effect: "+1 урон", cost: 23, tier: { name: "Шок II", effect: "+2 урона", cost: 36 } }
        ] }
      ]
    },
    knife: {
      label: "ВТОРИЧНОЕ ОРУЖИЕ / НОЖ ОХРАНЫ",
      branches: [{ id: "blade", base: "Штатное лезвие", options: [
        { id: "serrated", name: "Зубчатая кромка", effect: "+10 урона ножом", cost: 20, tier: { name: "Кромка II", effect: "+14 урона", cost: 34 } },
        { id: "shock-grip", name: "Шок-рукоять", effect: "−18% задержка", cost: 18, tier: { name: "Шок II", effect: "−24% задержка", cost: 31 } }
      ] }]
    },
    bag: {
      label: "РЮКЗАК / ОФИСНАЯ СУМКА",
      branches: [{ id: "carry", base: "Обычная сумка", options: [
        { id: "molle", name: "MOLLE-панель", effect: "+15% лома", cost: 22, tier: { name: "MOLLE II", effect: "+15% ещё", cost: 38 } },
        { id: "sealed", name: "Герметичный вкладыш", effect: "+20% лома после смерти", cost: 20, tier: { name: "Герметик II", effect: "+20% ещё", cost: 34 } }
      ] }]
    },
    chest: {
      label: "НАГРУДНИК / ПОТРЁПАННАЯ КОЖАНКА",
      branches: [{ id: "chest-core", base: "Потрёпанная кожа", options: [
        { id: "partial-exo", name: "Частичный экзоскелет", effect: "+2 броня", cost: 30, tier: { name: "Усиленный каркас", effect: "+2 броня", cost: 47 } },
        { id: "full-exo", name: "Полный экзоскелет", effect: "+20 целостность", cost: 34, tier: { name: "Полный каркас II", effect: "+20 целостность", cost: 52 } }
      ] }]
    },
    pants: {
      label: "ШТАНЫ / СТАРЫЕ КАРГО",
      branches: [{ id: "pants-core", base: "Старые карго", options: [
        { id: "knee-pads", name: "Наколенники", effect: "+1 броня", cost: 17, tier: { name: "Наколенники II", effect: "+1 броня", cost: 28 } },
        { id: "quiet-lining", name: "Тихая подкладка", effect: "+8% скорость", cost: 19, tier: { name: "Подкладка II", effect: "+8% скорость", cost: 30 } }
      ] }]
    },
    helmet: {
      label: "ШЛЕМ / ПОТРЁПАННАЯ БЕЙСБОЛКА",
      branches: [{ id: "helmet-core", base: "Потрёпанная кепка", options: [
        { id: "lamp", name: "Налобный фонарь", effect: "дальняя видимость", cost: 16, tier: { name: "Фонарь II", effect: "широкий луч", cost: 27 } },
        { id: "signal-filter", name: "Фильтр сигнала", effect: "+8 целостность", cost: 21, tier: { name: "Фильтр II", effect: "+10 целостность", cost: 33 } }
      ] }]
    },
    boots: {
      label: "БОТИНКИ / БЕРЦЫ ОХРАННИКА",
      branches: [{ id: "boot-core", base: "Штатные берцы", options: [
        { id: "servo-laces", name: "Сервошнуровка", effect: "+10% скорость", cost: 22, tier: { name: "Серво II", effect: "+10% скорость", cost: 36 } },
        { id: "mag-soles", name: "Магнитные подошвы", effect: "+1 броня", cost: 21, tier: { name: "Подошвы II", effect: "+1 броня", cost: 35 } }
      ] }]
    }
  };
  const ROOM_NAMES = ["Служебный колодец", "Коридор с архивами", "Грузовая развязка", "Тепловой буфер", "Шлюз внешнего доступа", "Комната рекуперации"];
  const ENEMY_TYPES = {
    watcher: { name: "Наблюдатель", color: "#ff7d75", radius: 14, hp: 38, speed: 72, fire: 1.2, bulletSpeed: 205, damage: 7, reward: 6 },
    drone: { name: "Сборщик", color: "#feab68", radius: 12, hp: 26, speed: 115, fire: 0.78, bulletSpeed: 248, damage: 5, reward: 5 },
    turret: { name: "Стационар", color: "#d870e7", radius: 16, hp: 58, speed: 0, fire: 1.65, bulletSpeed: 188, damage: 8, reward: 8 },
    warden: { name: "Смотритель этажа", color: "#e8ed83", radius: 37, hp: 980, speed: 48, fire: 0.68, bulletSpeed: 230, damage: 9, reward: 70 }
  };

  const element = id => document.getElementById(id);
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
  const hasImplant = id => progression.implants.includes(id);

  function createEquipmentProgress(savedEquipment = {}) {
    const equipment = {};
    Object.entries(EQUIPMENT_TREES).forEach(([gearId, tree]) => {
      equipment[gearId] = {};
      tree.branches.forEach(branch => {
        const savedBranch = savedEquipment[gearId]?.[branch.id] || {};
        const choiceExists = branch.options.some(option => option.id === savedBranch.choice);
        equipment[gearId][branch.id] = { choice: choiceExists ? savedBranch.choice : null, tier: Boolean(choiceExists && savedBranch.tier) };
      });
    });
    return equipment;
  }

  function getBranchProgress(gearId, branchId) {
    return progression.equipment[gearId][branchId];
  }

  function hasUpgrade(gearId, branchId, choiceId) {
    return getBranchProgress(gearId, branchId).choice === choiceId;
  }

  function hasTier(gearId, branchId, choiceId) {
    const branch = getBranchProgress(gearId, branchId);
    return branch.choice === choiceId && branch.tier;
  }

  function loadProgression() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      const equipment = createEquipmentProgress(saved.equipment);
      const legacyMods = {
        underbarrel: ["underbarrel", "scanner"],
        muzzle: ["muzzle", "compensator"],
        magazine: ["magazine", "extended"],
        optic: ["optic", "reflex"],
        stock: ["stock", "frame-stock"],
        grip: ["stock", "servo-stock"]
      };
      (Array.isArray(saved.mods) ? saved.mods : []).forEach(mod => {
        const legacy = legacyMods[mod];
        if (legacy) equipment.smg[legacy[0]].choice = legacy[1];
      });
      return {
        salvage: Number.isFinite(saved.salvage) ? saved.salvage : 0,
        bestFloor: Number.isFinite(saved.bestFloor) ? saved.bestFloor : 0,
        implants: Array.isArray(saved.implants) ? saved.implants : [],
        equipment
      };
    } catch {
      return { salvage: 0, bestFloor: 0, implants: [], equipment: createEquipmentProgress() };
    }
  }

  let progression = loadProgression();
  const state = {
    active: false,
    runActive: false,
    floor: 1,
    roomIndex: 0,
    rooms: [],
    room: null,
    player: null,
    enemies: [],
    bullets: [],
    particles: [],
    obstacles: [],
    input: { keys: new Set(), mouseDown: false, mouseX: WIDTH / 2, mouseY: HEIGHT / 2 },
    runSalvage: 0,
    elapsed: 0,
    lastFrame: performance.now(),
    roomClearTimer: null,
    selectedGear: null
  };

  function saveProgression() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progression));
  }

  function playerStats() {
    const isChoice = (branchId, choiceId) => hasUpgrade("smg", branchId, choiceId);
    const isMaxed = (branchId, choiceId) => hasTier("smg", branchId, choiceId);
    return {
      maxHealth: 100 + (hasImplant("cortex") ? 15 : 0) + (hasUpgrade("chest", "chest-core", "full-exo") ? 20 : 0) + (hasTier("chest", "chest-core", "full-exo") ? 20 : 0) + (hasUpgrade("helmet", "helmet-core", "signal-filter") ? 8 : 0) + (hasTier("helmet", "helmet-core", "signal-filter") ? 10 : 0),
      armor: 4 + (hasImplant("ceramic") ? 2 : 0) + (hasUpgrade("chest", "chest-core", "partial-exo") ? 2 : 0) + (hasTier("chest", "chest-core", "partial-exo") ? 2 : 0) + (hasUpgrade("pants", "pants-core", "knee-pads") ? 1 : 0) + (hasTier("pants", "pants-core", "knee-pads") ? 1 : 0) + (hasUpgrade("boots", "boot-core", "mag-soles") ? 1 : 0) + (hasTier("boots", "boot-core", "mag-soles") ? 1 : 0),
      speed: 245 * (hasImplant("myofiber") ? 1.12 : 1) * (hasUpgrade("pants", "pants-core", "quiet-lining") ? (hasTier("pants", "pants-core", "quiet-lining") ? 1.16 : 1.08) : 1) * (hasUpgrade("boots", "boot-core", "servo-laces") ? (hasTier("boots", "boot-core", "servo-laces") ? 1.2 : 1.1) : 1),
      invulnerability: hasImplant("ghost") ? 0.62 : 0.34,
      magazine: 32 + (isChoice("magazine", "extended") ? 12 : 0) + (isMaxed("magazine", "extended") ? 8 : 0),
      damage: 9 + (isChoice("ammo", "incendiary") ? 1 : 0) + (isMaxed("ammo", "incendiary") ? 2 : 0) + (isChoice("ammo", "armor-piercing") ? 2 : 0) + (isMaxed("ammo", "armor-piercing") ? 3 : 0) + (isChoice("underbarrel", "shock-module") ? 1 : 0) + (isMaxed("underbarrel", "shock-module") ? 2 : 0),
      spread: 0.055 - (isChoice("muzzle", "compensator") ? (isMaxed("muzzle", "compensator") ? 0.018 : 0.013) : 0) - (isChoice("optic", "reflex") ? (isMaxed("optic", "reflex") ? 0.016 : 0.011) : 0) - (isChoice("stock", "frame-stock") ? (isMaxed("stock", "frame-stock") ? 0.012 : 0.008) : 0),
      reload: 1.22 * (isChoice("magazine", "quick-feed") ? (isMaxed("magazine", "quick-feed") ? 0.61 : 0.78) : 1) * (isChoice("stock", "servo-stock") ? (isMaxed("stock", "servo-stock") ? 0.74 : 0.86) : 1),
      bulletSpeed: 680 * (isChoice("optic", "rangefinder") ? (isMaxed("optic", "rangefinder") ? 1.25 : 1.1) : 1),
      knifeDamage: 34 + (hasUpgrade("knife", "blade", "serrated") ? 10 : 0) + (hasTier("knife", "blade", "serrated") ? 14 : 0),
      knifeDelay: .42 * (hasUpgrade("knife", "blade", "shock-grip") ? (hasTier("knife", "blade", "shock-grip") ? .58 : .82) : 1),
      salvageMultiplier: hasUpgrade("bag", "carry", "molle") ? (hasTier("bag", "carry", "molle") ? 1.3 : 1.15) : 1,
      deathRetention: hasUpgrade("bag", "carry", "sealed") ? (hasTier("bag", "carry", "sealed") ? .8 : .6) : .4
    };
  }

  function updateHome() {
    element("salvage-count").textContent = String(progression.salvage).padStart(4, "0");
    element("best-floor").textContent = String(progression.bestFloor).padStart(2, "0");
    renderLoadout();
    renderImplants();
    if (state.selectedGear) {
      renderEquipmentTree();
    } else {
      element("equipment-workbench").hidden = true;
    }
  }

  function renderLoadout() {
    const list = element("loadout-list");
    list.innerHTML = "";
    STARTER_LOADOUT.forEach(item => {
      const entry = document.createElement("button");
      entry.className = `loadout-item ${state.selectedGear === item.id ? "selected" : ""}`;
      entry.type = "button";
      entry.innerHTML = `<span class="loadout-icon">${item.icon}</span><span><small>${item.slot}</small><strong>${item.name}</strong></span>`;
      entry.addEventListener("click", () => {
        state.selectedGear = item.id;
        renderLoadout();
        renderEquipmentTree();
        element("equipment-workbench").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      list.appendChild(entry);
    });
  }

  function canBuy(item, collection) {
    const requirements = item.requires || [];
    return !progression[collection].includes(item.id) && progression.salvage >= item.cost && requirements.every(hasImplant);
  }

  function renderImplants() {
    const tree = element("implant-tree");
    tree.innerHTML = "";
    IMPLANTS.forEach(implant => {
      const unlocked = hasImplant(implant.id);
      const unavailableRequirement = !implant.requires.every(hasImplant);
      const button = document.createElement("button");
      button.className = `implant-node ${unlocked ? "active" : ""}`;
      button.type = "button";
      button.disabled = unlocked || unavailableRequirement || progression.salvage < implant.cost;
      button.innerHTML = `<small>${unlocked ? "ИМПЛАНТИРОВАН" : unavailableRequirement ? "НУЖНЫ ПРЕДПОСЫЛКИ" : `${implant.cost} ЛОМА`}</small><strong>${implant.name}</strong><em>${implant.effect}</em>`;
      button.addEventListener("click", () => purchaseImplant(implant));
      tree.appendChild(button);
    });
  }

  function purchaseImplant(implant) {
    if (!canBuy(implant, "implants")) return;
    progression.salvage -= implant.cost;
    progression.implants.push(implant.id);
    saveProgression();
    updateHome();
  }

  function renderEquipmentTree() {
    if (!state.selectedGear) {
      element("equipment-workbench").hidden = true;
      return;
    }
    const gear = EQUIPMENT_TREES[state.selectedGear];
    const selectedItem = STARTER_LOADOUT.find(item => item.id === state.selectedGear);
    const tree = element("equipment-tree");
    element("equipment-workbench").hidden = false;
    const branchCount = gear.branches.filter(branch => getBranchProgress(state.selectedGear, branch.id).choice).length;
    element("tree-eyebrow").textContent = gear.label;
    element("tree-state").textContent = branchCount ? `${branchCount} ВЕТВ. ВЫБРАНО` : "БАЗОВАЯ СХЕМА";
    element("tree-note").textContent = `${selectedItem.name}: каждая сота первого слоя ведёт в две взаимоисключающие специализации. Выбор нельзя отменить в текущем MVP.`;
    tree.innerHTML = "";
    gear.branches.forEach(branch => {
      const progress = getBranchProgress(state.selectedGear, branch.id);
      const group = document.createElement("article");
      group.className = "upgrade-branch";
      const root = document.createElement("div");
      root.className = "hex-node hex-root";
      root.innerHTML = `<small>1 СЛОЙ</small><strong>${branch.base}</strong><em>${branch.id.toUpperCase()}</em>`;
      group.appendChild(root);
      const stem = document.createElement("div");
      stem.className = "tree-stem";
      group.appendChild(stem);
      const choices = document.createElement("div");
      choices.className = "branch-choices";
      branch.options.forEach(option => {
        const selected = progress.choice === option.id;
        const blocked = Boolean(progress.choice && !selected);
        const choiceSlot = document.createElement("div");
        choiceSlot.className = "branch-choice-slot";
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = `hex-node hex-choice ${selected ? "active" : ""} ${blocked ? "blocked" : ""}`;
        choice.disabled = selected || blocked || progression.salvage < option.cost;
        choice.innerHTML = `<small>${selected ? "ВЫБРАНО" : `${option.cost} ЛОМА`}</small><strong>${option.name}</strong><em>${option.effect}</em>`;
        choice.addEventListener("click", () => purchaseTreeChoice(state.selectedGear, branch, option));
        choiceSlot.appendChild(choice);
        choices.appendChild(choiceSlot);
      });
      group.appendChild(choices);
      const tier = document.createElement("div");
      const activeOption = branch.options.find(option => option.id === progress.choice);
      const activeOptionIndex = branch.options.indexOf(activeOption);
      tier.className = `branch-tier ${activeOption ? activeOptionIndex === 0 ? "left" : "right" : "waiting"}`;
      if (!activeOption) {
        tier.innerHTML = "<span class=\"branch-locked\">выбери одну из двух дорог</span>";
      } else if (progress.tier) {
        tier.innerHTML = `<div class="hex-node hex-choice active"><small>3 СЛОЙ · УСТАНОВЛЕНО</small><strong>${activeOption.tier.name}</strong><em>${activeOption.tier.effect}</em></div>`;
      } else {
        const tierButton = document.createElement("button");
        tierButton.type = "button";
        tierButton.className = "hex-node hex-choice";
        tierButton.disabled = progression.salvage < activeOption.tier.cost;
        tierButton.innerHTML = `<small>3 СЛОЙ · ${activeOption.tier.cost} ЛОМА</small><strong>${activeOption.tier.name}</strong><em>${activeOption.tier.effect}</em>`;
        tierButton.addEventListener("click", () => purchaseTreeTier(state.selectedGear, branch, activeOption));
        tier.appendChild(tierButton);
      }
      group.appendChild(tier);
      tree.appendChild(group);
    });
  }

  function purchaseTreeChoice(gearId, branch, option) {
    const progress = getBranchProgress(gearId, branch.id);
    if (progress.choice || progression.salvage < option.cost) return;
    progression.salvage -= option.cost;
    progress.choice = option.id;
    saveProgression();
    updateHome();
  }

  function purchaseTreeTier(gearId, branch, option) {
    const progress = getBranchProgress(gearId, branch.id);
    if (progress.choice !== option.id || progress.tier || progression.salvage < option.tier.cost) return;
    progression.salvage -= option.tier.cost;
    progress.tier = true;
    saveProgression();
    updateHome();
  }

  function generateFloor(floor) {
    const combatCount = 3 + Math.floor(Math.random() * 3);
    const rooms = [{ type: "start", name: "Шлюз отшельника", state: "current" }];
    for (let index = 0; index < combatCount; index += 1) {
      rooms.push({ type: "combat", name: ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)], variant: Math.floor(Math.random() * 3), state: "locked" });
    }
    rooms.push({ type: "boss", name: "Контур смотрителя", state: "locked" });
    return rooms;
  }

  function beginRun() {
    state.floor = 1;
    state.runSalvage = 0;
    state.runActive = true;
    beginFloor();
    element("home-screen").hidden = true;
    element("run-screen").hidden = false;
  }

  function beginFloor() {
    state.rooms = generateFloor(state.floor);
    state.roomIndex = 0;
    state.room = state.rooms[0];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    resetPlayer();
    renderRoute();
    updateRunUi();
    showStartOverlay();
  }

  function resetPlayer() {
    const stats = playerStats();
    state.player = {
      x: WIDTH * 0.5,
      y: HEIGHT * 0.72,
      radius: 13,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      armor: stats.armor,
      maxArmor: stats.armor,
      speed: stats.speed,
      invulnerability: 0,
      weapon: "smg",
      ammo: stats.magazine,
      magazine: stats.magazine,
      fireCooldown: 0,
      reload: 0,
      knifeCooldown: 0,
      knifeFlash: 0
    };
  }

  function renderRoute() {
    const route = element("floor-route");
    route.innerHTML = "";
    state.rooms.forEach((room, index) => {
      const node = document.createElement("div");
      node.className = `route-node ${room.type === "boss" ? "boss" : ""} ${index === state.roomIndex ? "current" : ""} ${room.state === "cleared" ? "cleared" : ""}`;
      node.textContent = room.type === "start" ? "СТАРТ" : room.type === "boss" ? "БОСС" : `УЗЕЛ ${String(index).padStart(2, "0")}`;
      route.appendChild(node);
    });
  }

  function updateRunUi() {
    const player = state.player;
    if (!player) return;
    element("floor-number").textContent = String(state.floor).padStart(2, "0");
    element("health-label").textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
    element("health-bar").style.width = `${(player.health / player.maxHealth) * 100}%`;
    element("armor-label").textContent = String(Math.ceil(player.armor)).padStart(2, "0");
    element("armor-bar").style.width = `${(player.armor / player.maxArmor) * 100}%`;
    const knife = player.weapon === "knife";
    element("weapon-name").textContent = knife ? "НОЖ ОХРАНЫ" : "ПП ОХРАНЫ";
    element("ammo-label").innerHTML = knife ? "БЛИЖНИЙ <small>/ УДАР</small>" : `${player.ammo} <small>/ ${player.magazine}</small>`;
    element("weapon-hint").textContent = knife ? "Q — удар · 1 — ПП Охраны" : player.reload ? "ПЕРЕЗАРЯДКА…" : "ЛКМ — огонь · R — перезарядка · 1/2 — смена";
    element("run-salvage").textContent = String(state.runSalvage).padStart(3, "0");
    element("threat-label").textContent = state.enemies.length > 5 ? "КРИТИЧЕСКАЯ" : state.enemies.length ? "АКТИВНАЯ" : "НИЗКАЯ";
    element("abort-run").disabled = !state.room || state.room.type !== "boss" || state.room.state !== "cleared";
  }

  function showOverlay(content) {
    const overlay = element("room-overlay");
    overlay.innerHTML = content;
    overlay.classList.add("visible");
    state.active = false;
  }

  function hideOverlay() {
    element("room-overlay").classList.remove("visible");
  }

  function showStartOverlay() {
    element("signal-text").textContent = "Лифт заглушен. Первый шлюз не отмечен в маршруте наблюдателей.";
    showOverlay(`<div class="overlay-card"><p class="eyebrow">этаж ${String(state.floor).padStart(2, "0")} / безопасная точка</p><h2>Шлюз открыт.</h2><p>Собери достаточно лома, пока контур контроля не заметил тепловой след.</p><div class="overlay-actions"><button class="primary-button" type="button" data-action="advance">Войти в структуру <span>↘</span></button></div></div>`);
  }

  function advanceRoom() {
    if (state.room) state.room.state = "cleared";
    state.roomIndex += 1;
    state.room = state.rooms[state.roomIndex];
    if (!state.room) return;
    state.room.state = "current";
    renderRoute();
    if (state.room.type === "combat" || state.room.type === "boss") startCombat();
  }

  function startCombat() {
    state.bullets = [];
    state.particles = [];
    state.obstacles = generateObstacles(state.room.type === "boss" ? 2 : 4 + Math.floor(Math.random() * 3));
    state.enemies = spawnEnemies(state.room);
    state.active = true;
    hideOverlay();
    element("signal-text").textContent = state.room.type === "boss"
      ? "Смотритель этажа обнаружил нарушение. Внешний лифт заблокирован."
      : `${state.room.name}: шумовые датчики активны. Уничтожь контур охраны.`;
    updateRunUi();
  }

  function generateObstacles(count) {
    const obstacles = [];
    for (let index = 0; index < count; index += 1) {
      const width = randomBetween(62, 130);
      const height = randomBetween(36, 78);
      let x = randomBetween(76, WIDTH - width - 76);
      let y = randomBetween(95, HEIGHT - height - 80);
      if (Math.hypot(x + width / 2 - WIDTH / 2, y + height / 2 - HEIGHT * .72) < 150) y = 100 + index * 48;
      obstacles.push({ x, y, width, height });
    }
    return obstacles;
  }

  function spawnEnemies(room) {
    if (room.type === "boss") return [createEnemy("warden", WIDTH / 2, 135, true)];
    const amount = 4 + state.floor * 2 + Math.floor(Math.random() * 3);
    return Array.from({ length: amount }, (_, index) => {
      const selection = room.variant === 0 ? "watcher" : room.variant === 1 ? (index % 3 ? "drone" : "watcher") : (index % 3 ? "watcher" : "turret");
      const side = index % 2 ? 92 : WIDTH - 92;
      return createEnemy(selection, clamp(side + randomBetween(-46, 46), 45, WIDTH - 45), randomBetween(85, 270));
    });
  }

  function createEnemy(type, x, y, boss = false) {
    const template = ENEMY_TYPES[type];
    const floorMultiplier = 1 + (state.floor - 1) * .2;
    return {
      type,
      x,
      y,
      radius: template.radius,
      color: template.color,
      health: template.hp * floorMultiplier,
      maxHealth: template.hp * floorMultiplier,
      speed: template.speed * (boss ? 1 : floorMultiplier),
      fireTimer: randomBetween(.1, template.fire),
      fireRate: template.fire * (boss ? Math.max(.44, 1 - state.floor * .03) : 1),
      bulletSpeed: template.bulletSpeed,
      damage: template.damage + Math.floor((state.floor - 1) / 2),
      reward: template.reward + state.floor * 2,
      orbit: randomBetween(-1, 1),
      boss,
      hitFlash: 0
    };
  }

  function onOverlayClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "advance") advanceRoom();
    if (action === "next-floor") {
      state.floor += 1;
      beginFloor();
    }
    if (action === "return") finishRun(Number(event.target.closest("[data-multiplier]")?.dataset.multiplier || 1));
    if (action === "retry") beginRun();
  }

  function finishRun(multiplier) {
    const collected = Math.floor(state.runSalvage * multiplier);
    progression.salvage += collected;
    progression.bestFloor = Math.max(progression.bestFloor, state.floor);
    saveProgression();
    state.active = false;
    state.runActive = false;
    hideOverlay();
    element("run-screen").hidden = true;
    element("home-screen").hidden = false;
    updateHome();
  }

  function clearRoom() {
    state.active = false;
    state.room.state = "cleared";
    renderRoute();
    updateRunUi();
    if (state.room.type === "boss") {
      element("signal-text").textContent = "Контур смотрителя отключён. Открыт обратный лифт и технический спуск.";
      showOverlay(`<div class="overlay-card"><p class="eyebrow">контур уничтожен / +${state.runSalvage} лома в рюкзаке</p><h2>Этаж замолчал.</h2><p>Можно углубиться в мегаструктуру или вернуться в убежище и установить добытые модули.</p><div class="overlay-actions"><button class="primary-button" type="button" data-action="next-floor">Спуститься ниже <span>↘</span></button><button class="quiet-button" type="button" data-action="return">Вернуться</button></div></div>`);
    } else {
      showOverlay(`<div class="overlay-card"><p class="eyebrow">комната очищена / +лом добавлен в сумку</p><h2>Контур погашен.</h2><p>Следующий шлюз уже ждёт. Система пока считает, что это шум вентиляции.</p><div class="overlay-actions"><button class="primary-button" type="button" data-action="advance">Продолжить <span>↘</span></button></div></div>`);
    }
  }

  function update(delta) {
    if (!state.active || !state.player) return;
    state.elapsed += delta;
    updatePlayer(delta);
    updateEnemies(delta);
    updateBullets(delta);
    updateParticles(delta);
    if (!state.enemies.length && !state.roomClearTimer) {
      state.roomClearTimer = window.setTimeout(() => {
        state.roomClearTimer = null;
        if (state.active) clearRoom();
      }, 450);
    }
    updateRunUi();
  }

  function updatePlayer(delta) {
    const player = state.player;
    let horizontal = 0;
    let vertical = 0;
    if (state.input.keys.has("KeyA") || state.input.keys.has("ArrowLeft")) horizontal -= 1;
    if (state.input.keys.has("KeyD") || state.input.keys.has("ArrowRight")) horizontal += 1;
    if (state.input.keys.has("KeyW") || state.input.keys.has("ArrowUp")) vertical -= 1;
    if (state.input.keys.has("KeyS") || state.input.keys.has("ArrowDown")) vertical += 1;
    if (horizontal || vertical) {
      const length = Math.hypot(horizontal, vertical);
      moveCircle(player, horizontal / length * player.speed * delta, vertical / length * player.speed * delta);
    }
    player.invulnerability = Math.max(0, player.invulnerability - delta);
    player.fireCooldown = Math.max(0, player.fireCooldown - delta);
    player.knifeCooldown = Math.max(0, player.knifeCooldown - delta);
    player.knifeFlash = Math.max(0, player.knifeFlash - delta);
    if (player.reload > 0) {
      player.reload -= delta;
      if (player.reload <= 0) player.ammo = player.magazine;
      return;
    }
    if (player.weapon === "smg" && state.input.mouseDown && player.fireCooldown <= 0) fireSmg();
  }

  function moveCircle(entity, horizontal, vertical) {
    entity.x = clamp(entity.x + horizontal, entity.radius + 12, WIDTH - entity.radius - 12);
    resolveObstacleCollision(entity);
    entity.y = clamp(entity.y + vertical, entity.radius + 42, HEIGHT - entity.radius - 32);
    resolveObstacleCollision(entity);
  }

  function resolveObstacleCollision(entity) {
    state.obstacles.forEach(obstacle => {
      const closestX = clamp(entity.x, obstacle.x, obstacle.x + obstacle.width);
      const closestY = clamp(entity.y, obstacle.y, obstacle.y + obstacle.height);
      const differenceX = entity.x - closestX;
      const differenceY = entity.y - closestY;
      const gap = Math.hypot(differenceX, differenceY);
      if (gap >= entity.radius || gap === 0) return;
      entity.x += differenceX / gap * (entity.radius - gap);
      entity.y += differenceY / gap * (entity.radius - gap);
    });
  }

  function fireSmg() {
    const player = state.player;
    if (!player.ammo) {
      reloadSmg();
      return;
    }
    const stats = playerStats();
    const aim = Math.atan2(state.input.mouseY - player.y, state.input.mouseX - player.x) + randomBetween(-stats.spread, stats.spread);
    state.bullets.push({ owner: "player", x: player.x + Math.cos(aim) * 18, y: player.y + Math.sin(aim) * 18, vx: Math.cos(aim) * stats.bulletSpeed, vy: Math.sin(aim) * stats.bulletSpeed, radius: 3, damage: stats.damage, color: "#9ffdf3", lifetime: 1.25 });
    player.ammo -= 1;
    player.fireCooldown = .105;
    createParticles(player.x, player.y, "#8df8ee", 2, 22);
  }

  function reloadSmg() {
    const player = state.player;
    if (player.weapon !== "smg" || player.reload > 0 || player.ammo === player.magazine) return;
    player.reload = playerStats().reload;
  }

  function knifeAttack() {
    const player = state.player;
    if (!state.active || player.knifeCooldown > 0) return;
    player.knifeCooldown = playerStats().knifeDelay;
    player.knifeFlash = .16;
    const angle = Math.atan2(state.input.mouseY - player.y, state.input.mouseX - player.x);
    state.enemies.forEach(enemy => {
      const enemyAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const difference = Math.atan2(Math.sin(enemyAngle - angle), Math.cos(enemyAngle - angle));
      if (distance(player, enemy) < 83 && Math.abs(difference) < .92) damageEnemy(enemy, playerStats().knifeDamage);
    });
  }

  function updateEnemies(delta) {
    const player = state.player;
    state.enemies.forEach(enemy => {
      const toPlayerX = player.x - enemy.x;
      const toPlayerY = player.y - enemy.y;
      const playerDistance = Math.hypot(toPlayerX, toPlayerY) || 1;
      const unitX = toPlayerX / playerDistance;
      const unitY = toPlayerY / playerDistance;
      if (enemy.type === "drone") {
        moveCircle(enemy, (unitX + -unitY * enemy.orbit * .7) * enemy.speed * delta, (unitY + unitX * enemy.orbit * .7) * enemy.speed * delta);
      } else if (enemy.type === "watcher" && playerDistance > 250) {
        moveCircle(enemy, unitX * enemy.speed * delta, unitY * enemy.speed * delta);
      } else if (enemy.boss) {
        moveCircle(enemy, unitX * enemy.speed * delta, unitY * enemy.speed * delta);
      }
      enemy.fireTimer -= delta;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      if (enemy.fireTimer <= 0) {
        fireEnemy(enemy, unitX, unitY);
        enemy.fireTimer = enemy.fireRate;
      }
      if (playerDistance < enemy.radius + player.radius + 5) damagePlayer(enemy.damage * .55);
    });
  }

  function fireEnemy(enemy, unitX, unitY) {
    const baseAngle = Math.atan2(unitY, unitX);
    if (enemy.boss) {
      for (let index = 0; index < 12; index += 1) {
        const angle = state.elapsed * .8 + index * Math.PI * 2 / 12;
        createEnemyBullet(enemy, angle, enemy.bulletSpeed * .76, enemy.damage * .7, "#f4ef86");
      }
      [-.17, 0, .17].forEach(offset => createEnemyBullet(enemy, baseAngle + offset, enemy.bulletSpeed, enemy.damage, "#ff8078"));
      return;
    }
    if (enemy.type === "turret") {
      [-.18, 0, .18].forEach(offset => createEnemyBullet(enemy, baseAngle + offset, enemy.bulletSpeed, enemy.damage, "#d981ec"));
      return;
    }
    createEnemyBullet(enemy, baseAngle, enemy.bulletSpeed, enemy.damage, enemy.color);
  }

  function createEnemyBullet(enemy, angle, speed, damage, color) {
    state.bullets.push({ owner: "enemy", x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: enemy.boss ? 6 : 5, damage, color, lifetime: 4 });
  }

  function updateBullets(delta) {
    state.bullets = state.bullets.filter(bullet => {
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.lifetime -= delta;
      if (bullet.lifetime <= 0 || bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < -20 || bullet.y > HEIGHT + 20 || hitsObstacle(bullet)) return false;
      if (bullet.owner === "player") {
        const target = state.enemies.find(enemy => distance(bullet, enemy) < bullet.radius + enemy.radius);
        if (target) {
          damageEnemy(target, bullet.damage);
          return false;
        }
      } else if (distance(bullet, state.player) < bullet.radius + state.player.radius) {
        damagePlayer(bullet.damage);
        return false;
      }
      return true;
    });
  }

  function hitsObstacle(bullet) {
    return state.obstacles.some(obstacle => bullet.x >= obstacle.x && bullet.x <= obstacle.x + obstacle.width && bullet.y >= obstacle.y && bullet.y <= obstacle.y + obstacle.height);
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    enemy.hitFlash = .12;
    createParticles(enemy.x, enemy.y, enemy.color, 4, 48);
    if (enemy.health > 0) return;
    state.enemies = state.enemies.filter(candidate => candidate !== enemy);
    state.runSalvage += Math.ceil(enemy.reward * playerStats().salvageMultiplier);
    createParticles(enemy.x, enemy.y, "#d4ee70", enemy.boss ? 20 : 9, enemy.boss ? 100 : 58);
  }

  function damagePlayer(amount) {
    const player = state.player;
    if (player.invulnerability > 0) return;
    const armorAbsorb = Math.min(player.armor, Math.max(1, amount * .42));
    player.armor -= armorAbsorb;
    player.health = Math.max(0, player.health - Math.max(1, amount - armorAbsorb));
    player.invulnerability = playerStats().invulnerability;
    createParticles(player.x, player.y, "#ff6d68", 11, 80);
    if (player.health > 0) return;
    state.active = false;
    const recoveryRate = playerStats().deathRetention;
    const recovered = Math.floor(state.runSalvage * recoveryRate);
    showOverlay(`<div class="overlay-card"><p class="eyebrow">контур контроля обнаружил след</p><h2>Смена окончена.</h2><p>Автономный маршрут выбросил тебя к убежищу. Удалось сохранить ${recovered} ед. лома.</p><div class="overlay-actions"><button class="primary-button" type="button" data-action="return" data-multiplier="${recoveryRate}">В убежище <span>↖</span></button><button class="quiet-button" type="button" data-action="retry">Новый забег</button></div></div>`);
  }

  function createParticles(x, y, color, amount, speed) {
    for (let index = 0; index < amount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      state.particles.push({ x, y, vx: Math.cos(angle) * randomBetween(speed * .35, speed), vy: Math.sin(angle) * randomBetween(speed * .35, speed), color, lifetime: randomBetween(.16, .4) });
    }
  }

  function updateParticles(delta) {
    state.particles = state.particles.filter(particle => {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.lifetime -= delta;
      return particle.lifetime > 0;
    });
  }

  function draw() {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, "#102131");
    gradient.addColorStop(1, "#071019");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    drawGrid();
    drawObstacles();
    state.bullets.forEach(drawBullet);
    state.enemies.forEach(drawEnemy);
    state.particles.forEach(drawParticle);
    if (state.player) drawPlayer();
    drawRoomLabel();
  }

  function drawGrid() {
    context.strokeStyle = "rgba(99, 228, 221, 0.08)";
    context.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, HEIGHT);
      context.stroke();
    }
    for (let y = 0; y <= HEIGHT; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WIDTH, y);
      context.stroke();
    }
    context.fillStyle = "rgba(212, 238, 112, 0.1)";
    context.fillRect(0, 0, WIDTH, 4);
  }

  function drawObstacles() {
    state.obstacles.forEach(obstacle => {
      context.fillStyle = "#1a3443";
      context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.strokeStyle = "#487183";
      context.strokeRect(obstacle.x + .5, obstacle.y + .5, obstacle.width - 1, obstacle.height - 1);
      context.fillStyle = "rgba(99, 228, 221, 0.12)";
      context.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.width - 12, 3);
    });
  }

  function drawBullet(bullet) {
    context.fillStyle = bullet.color;
    context.shadowBlur = bullet.owner === "player" ? 12 : 8;
    context.shadowColor = bullet.color;
    context.beginPath();
    context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  function drawEnemy(enemy) {
    context.fillStyle = enemy.hitFlash ? "#ffffff" : enemy.color;
    context.shadowBlur = enemy.boss ? 20 : 8;
    context.shadowColor = enemy.color;
    context.beginPath();
    context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "#10202b";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(enemy.x - enemy.radius * .55, enemy.y);
    context.lineTo(enemy.x + enemy.radius * .55, enemy.y);
    context.stroke();
    const healthRatio = enemy.health / enemy.maxHealth;
    context.fillStyle = "rgba(0, 0, 0, .45)";
    context.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 3);
    context.fillStyle = enemy.boss ? "#e8ed83" : "#ff9a8d";
    context.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2 * healthRatio, 3);
  }

  function drawPlayer() {
    const player = state.player;
    const angle = Math.atan2(state.input.mouseY - player.y, state.input.mouseX - player.x);
    if (player.invulnerability > 0 && Math.floor(player.invulnerability * 22) % 2 === 0) return;
    context.save();
    context.translate(player.x, player.y);
    context.rotate(angle);
    context.fillStyle = "#8ff7ef";
    context.shadowBlur = 14;
    context.shadowColor = "#63e4dd";
    context.fillRect(-7, -10, 14, 20);
    context.fillStyle = "#d4ee70";
    context.fillRect(4, -3, 19, 6);
    context.restore();
    context.shadowBlur = 0;
    if (player.knifeFlash > 0) {
      context.strokeStyle = "#f4fbbe";
      context.lineWidth = 5;
      context.beginPath();
      context.arc(player.x, player.y, 64, angle - .9, angle + .9);
      context.stroke();
    }
    if (hasUpgrade("smg", "underbarrel", "scanner")) {
      context.strokeStyle = "rgba(99, 228, 221, .24)";
      context.beginPath();
      context.arc(player.x, player.y, 100, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawParticle(particle) {
    context.globalAlpha = clamp(particle.lifetime * 3, 0, 1);
    context.fillStyle = particle.color;
    context.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    context.globalAlpha = 1;
  }

  function drawRoomLabel() {
    if (!state.room) return;
    context.fillStyle = "rgba(220, 236, 244, .56)";
    context.font = "11px Consolas, monospace";
    context.fillText(`${state.room.type === "boss" ? "ОБНАРУЖЕН СМОТРИТЕЛЬ" : state.room.name.toUpperCase()} // ${state.enemies.length} СИГНАЛОВ`, 16, 26);
  }

  function frame(time) {
    const delta = Math.min(.035, (time - state.lastFrame) / 1000 || 0);
    state.lastFrame = time;
    update(delta);
    if (!element("run-screen").hidden) draw();
    window.requestAnimationFrame(frame);
  }

  function switchWeapon(weapon) {
    if (!state.player || !state.active) return;
    state.player.weapon = weapon;
    updateRunUi();
  }
  // Длинный этаж: скрытное исследование, единая тревога и шлюзовой босс.
  const LONG_FLOOR_CELL = 72;

  function randomInteger(minimum, maximum) {
    return Math.floor(randomBetween(minimum, maximum + 1));
  }

  function normalizedAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  function worldPositionFromPointer() {
    return {
      x: state.input.mouseX + state.cameraX,
      y: state.input.mouseY
    };
  }

  function playerAimAngle() {
    const pointer = worldPositionFromPointer();
    return Math.atan2(pointer.y - state.player.y, pointer.x - state.player.x);
  }

  function createGuard(type, x, y, patrolStart, patrolEnd, angle) {
    const template = ENEMY_TYPES[type];
    const multiplier = 1 + (state.floor - 1) * .18;
    return {
      type,
      x,
      y,
      radius: template.radius,
      color: template.color,
      health: Math.round(template.hp * multiplier),
      maxHealth: Math.round(template.hp * multiplier),
      speed: template.speed * (type === "turret" ? 1 : multiplier),
      fireRate: type === "turret" ? Math.max(.72, template.fire - state.floor * .035) : template.fire,
      fireTimer: randomBetween(.2, template.fire),
      bulletSpeed: template.bulletSpeed * (1 + (state.floor - 1) * .04),
      damage: template.damage + Math.floor((state.floor - 1) / 2),
      reward: template.reward + state.floor * 2,
      patrolStart,
      patrolEnd,
      patrolDirection: Math.random() > .5 ? 1 : -1,
      alertStart: Math.max(46, patrolStart - 180),
      alertEnd: patrolEnd + 180,
      homeAngle: angle,
      angle,
      phase: Math.random() * Math.PI * 2,
      sighting: 0,
      hitFlash: 0,
      boss: false
    };
  }

  function createLongFloor(floor) {
    const sectorCount = randomInteger(10, 12);
    const bodyLength = Math.round(sectorCount * WIDTH * Math.pow(1.2, floor - 1));
    const sectorWidth = bodyLength / sectorCount;
    const bossWidth = Math.round(WIDTH / 1.5);
    const worldWidth = bodyLength + bossWidth + 140;
    const walls = [
      { x: 0, y: 0, width: worldWidth, height: 28, outer: true },
      { x: 0, y: HEIGHT - 28, width: worldWidth, height: 28, outer: true },
      { x: 0, y: 0, width: 28, height: HEIGHT, outer: true },
      { x: worldWidth - 28, y: 0, width: 28, height: HEIGHT, outer: true }
    ];
    const guards = [];
    const sensors = [];

    for (let index = 0; index < sectorCount; index += 1) {
      const start = index * sectorWidth;
      const fromTop = index % 2 === 0;
      const verticalHeight = randomInteger(174, 286);
      const wallX = Math.round(start + sectorWidth * randomBetween(.28, .42));
      const wallY = fromTop ? 28 : HEIGHT - 28 - verticalHeight;
      walls.push({ x: wallX, y: wallY, width: 42, height: verticalHeight, anchor: true });

      const consoleWidth = randomInteger(126, 230);
      const consoleY = fromTop ? randomInteger(300, 410) : randomInteger(150, 258);
      const consoleX = Math.round(start + sectorWidth * randomBetween(.56, .7));
      walls.push({ x: consoleX, y: consoleY, width: consoleWidth, height: 38, console: true });

      const patrolY = fromTop ? HEIGHT - 126 : 126;
      const patrolStart = Math.round(start + sectorWidth * .1);
      const patrolEnd = Math.round(start + sectorWidth * .78);
      guards.push(createGuard("watcher", patrolStart + 34, patrolY, patrolStart, patrolEnd, 0));
      guards.push(createGuard("drone", patrolEnd - 48, HEIGHT - patrolY, patrolStart + 56, patrolEnd, Math.PI));

      if (index % 2 === 0 || index === sectorCount - 1) {
        const turretX = Math.round(start + sectorWidth * .83);
        const turretY = fromTop ? 92 : HEIGHT - 92;
        guards.push(createGuard("turret", turretX, turretY, turretX, turretX, fromTop ? Math.PI / 2 : -Math.PI / 2));
      }

      sensors.push({
        x: wallX + (fromTop ? 68 : -24),
        y: fromTop ? verticalHeight + 46 : HEIGHT - verticalHeight - 46,
        angle: fromTop ? Math.PI / 2 : -Math.PI / 2,
        homeAngle: fromTop ? Math.PI / 2 : -Math.PI / 2,
        phase: Math.random() * Math.PI * 2,
        range: 168,
        fov: .84,
        exposure: 0
      });
    }

    const entryGate = { x: bodyLength - 16, y: 28, width: 32, height: HEIGHT - 56 };
    const exitGate = { x: worldWidth - 122, y: 28, width: 32, height: HEIGHT - 56 };
    return {
      floor,
      sectorCount,
      sectorWidth,
      bodyLength,
      bossWidth,
      width: worldWidth,
      walls,
      guards,
      sensors,
      entryGate,
      exitGate,
      bossStarted: false,
      bossDefeated: false,
      exitOpen: false,
      explored: new Set(),
      lastRouteSector: -1
    };
  }

  function generateFloor(floor) {
    return createLongFloor(floor);
  }

  function beginRun() {
    state.floor = 1;
    state.runSalvage = 0;
    state.runActive = true;
    state.elapsed = 0;
    element("home-screen").hidden = true;
    element("run-screen").hidden = false;
    beginFloor();
  }

  function beginFloor() {
    state.floorMap = generateFloor(state.floor);
    state.enemies = state.floorMap.guards;
    state.sensors = state.floorMap.sensors;
    state.bullets = [];
    state.particles = [];
    state.alarm = false;
    state.alarmReason = "";
    state.flashlight = true;
    state.visionTimer = 0;
    resetPlayer();
    state.cameraX = 0;
    state.active = false;
    renderRoute();
    updateRunUi();
    showStartOverlay();
  }

  function resetPlayer() {
    const stats = playerStats();
    state.player = {
      x: 84,
      y: HEIGHT * .72,
      radius: 13,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      armor: stats.armor,
      maxArmor: stats.armor,
      speed: stats.speed,
      invulnerability: 0,
      weapon: "smg",
      ammo: stats.magazine,
      magazine: stats.magazine,
      fireCooldown: 0,
      reload: 0,
      knifeCooldown: 0,
      knifeFlash: 0
    };
  }

  function currentSector() {
    if (!state.floorMap || !state.player) return 0;
    return clamp(Math.floor(state.player.x / state.floorMap.sectorWidth), 0, state.floorMap.sectorCount - 1);
  }

  function renderRoute() {
    const route = element("floor-route");
    const map = state.floorMap;
    if (!map) return;
    route.innerHTML = "";
    const sector = currentSector();
    for (let index = 0; index < map.sectorCount; index += 1) {
      const node = document.createElement("div");
      node.className = "route-node" + (index === sector && !map.bossStarted ? " current" : "") + (index < sector ? " cleared" : "");
      node.textContent = "СЕКТОР " + String(index + 1).padStart(2, "0");
      route.appendChild(node);
    }
    const boss = document.createElement("div");
    boss.className = "route-node boss" + (map.bossStarted ? " current" : "") + (map.bossDefeated ? " cleared" : "");
    boss.textContent = map.bossDefeated ? "ШЛЮЗ ОТКРЫТ" : "ШЛЮЗ / БОСС";
    route.appendChild(boss);
    map.lastRouteSector = sector;
  }

  function updateRunUi() {
    const player = state.player;
    const map = state.floorMap;
    if (!player || !map) return;
    const sector = currentSector();
    if (map.lastRouteSector !== sector || map.bossStarted || map.bossDefeated) renderRoute();

    element("floor-number").textContent = String(state.floor).padStart(2, "0");
    element("health-label").textContent = Math.ceil(player.health) + " / " + player.maxHealth;
    element("health-bar").style.width = (player.health / player.maxHealth) * 100 + "%";
    element("armor-label").textContent = String(Math.ceil(player.armor)).padStart(2, "0");
    element("armor-bar").style.width = (player.armor / player.maxArmor) * 100 + "%";

    const knife = player.weapon === "knife";
    element("weapon-name").textContent = knife ? "НОЖ ОХРАНЫ" : "ПП ОХРАНЫ";
    element("ammo-label").innerHTML = knife ? "БЛИЖНИЙ <small>/ УДАР</small>" : player.ammo + " <small>/ " + player.magazine + "</small>";
    const lightStatus = state.alarm ? " · F — ФОНАРЬ " + (state.flashlight ? "ВКЛ" : "ВЫКЛ") : "";
    element("weapon-hint").textContent = knife ? "Q — удар · 1 — ПП Охраны" + lightStatus : player.reload ? "ПЕРЕЗАРЯДКА…" : "ЛКМ — огонь · R — перезарядка · E — шлюз" + lightStatus;
    element("run-salvage").textContent = String(state.runSalvage).padStart(3, "0");

    const threat = map.bossStarted && !map.bossDefeated ? "БОСС / ШЛЮЗ" : state.alarm ? "ТРЕВОГА" : "ТИШИНА";
    element("threat-label").textContent = threat;
    element("abort-run").disabled = map.bossStarted && !map.bossDefeated;
  }

  function showStartOverlay() {
    element("signal-text").textContent = "Тишина. Охрана идёт по штатным маршрутам, сенсоры не отмечают тепловой след.";
    const estimated = Math.round(state.floorMap.bodyLength / WIDTH);
    showOverlay("<div class=\"overlay-card\"><p class=\"eyebrow\">этаж " + String(state.floor).padStart(2, "0") + " / " + estimated + " секторов до шлюза</p><h2>Лифт ушёл.</h2><p>Пока на этаже нет тревоги, охрана не атакует. Не стреляй, обходи сенсоры и изучай только то, что попадает в поле зрения.</p><div class=\"overlay-actions\"><button class=\"primary-button\" type=\"button\" data-action=\"deploy\">Выйти в коридор <span>↘</span></button></div></div>");
  }

  function onOverlayClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "deploy") {
      hideOverlay();
      state.active = true;
      return;
    }
    if (action === "next-floor") {
      state.floor += 1;
      beginFloor();
      return;
    }
    if (action === "return") {
      finishRun(Number(event.target.closest("[data-multiplier]")?.dataset.multiplier || 1));
      return;
    }
    if (action === "retry") beginRun();
  }

  function finishRun(multiplier) {
    const collected = Math.floor(state.runSalvage * multiplier);
    progression.salvage += collected;
    progression.bestFloor = Math.max(progression.bestFloor, state.floor);
    saveProgression();
    state.active = false;
    state.runActive = false;
    state.floorMap = null;
    state.enemies = [];
    state.sensors = [];
    hideOverlay();
    element("run-screen").hidden = true;
    element("home-screen").hidden = false;
    updateHome();
  }


  element("start-run").addEventListener("click", beginRun);
  element("room-overlay").addEventListener("click", onOverlayClick);
  element("abort-run").addEventListener("click", () => finishRun(1));
  element("close-tree").addEventListener("click", () => {
    state.selectedGear = null;
    element("equipment-workbench").hidden = true;
    renderLoadout();
  });
  window.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    state.input.keys.add(event.code);
    if (event.code === "KeyR") reloadSmg();
    if (event.code === "KeyQ") knifeAttack();
    if (event.code === "Digit1") switchWeapon("smg");
    if (event.code === "Digit2") switchWeapon("knife");
  });
  window.addEventListener("keyup", event => state.input.keys.delete(event.code));
  canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();
    state.input.mouseX = (event.clientX - rect.left) / rect.width * WIDTH;
    state.input.mouseY = (event.clientY - rect.top) / rect.height * HEIGHT;
  });
  canvas.addEventListener("mousedown", event => {
    if (event.button === 0) state.input.mouseDown = true;
  });
  window.addEventListener("mouseup", event => {
    if (event.button === 0) state.input.mouseDown = false;
  });
  canvas.addEventListener("contextmenu", event => event.preventDefault());

  updateHome();
  window.requestAnimationFrame(frame);
})();
