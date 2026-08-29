// Управляет убежищем, прокачкой, процедурными этажами и desktop bullet-hell забегом.
(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const SAVE_KEY = "megastructure-stranger-mvp-v1";
  const STARTER_LOADOUT = [
    ["РЮКЗАК", "Офисная сумка", "BAG"],
    ["ОСНОВНОЕ", "ПП Охраны", "SMG"],
    ["ВТОРИЧНОЕ", "Нож охраны", "KNF"],
    ["НАГРУДНИК", "Потрёпанная кожанка", "CHR"],
    ["ШТАНЫ", "Старые карго", "CRG"],
    ["ШЛЕМ", "Потрёпанная бейсболка", "CAP"],
    ["БОТИНКИ", "Берцы охранника этажа", "BOT"],
    ["МОДУЛИ", "MOLLE / экзоскелет / фонарь", "---"]
  ];
  const IMPLANTS = [
    { id: "cortex", name: "Контур тишины", effect: "+15 к целостности", cost: 20, requires: [] },
    { id: "myofiber", name: "Миофибры ног", effect: "+12% к скорости", cost: 34, requires: ["cortex"] },
    { id: "ceramic", name: "Керамо-рёбра", effect: "+2 к броне", cost: 38, requires: ["cortex"] },
    { id: "ghost", name: "Слепой импульс", effect: "дольше неуязвимость", cost: 64, requires: ["myofiber", "ceramic"] }
  ];
  const WEAPON_MODS = [
    { id: "underbarrel", slot: "ПОДСТВОЛЬНИК", name: "Сканер ближней зоны", effect: "контур врагов", cost: 18 },
    { id: "muzzle", slot: "НАДУЛЬНИК", name: "Компенсатор", effect: "+2 урона", cost: 26 },
    { id: "magazine", slot: "МАГАЗИН", name: "Удлинённый", effect: "+12 патронов", cost: 30 },
    { id: "optic", slot: "ПРИЦЕЛ", name: "Пинхол", effect: "меньше разброс", cost: 22 },
    { id: "stock", slot: "ПРИКЛАД", name: "Складной каркас", effect: "-18% перезарядка", cost: 24 },
    { id: "grip", slot: "РУКОЯТЬ", name: "Полимерная", effect: "ровнее очередь", cost: 20 }
  ];
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
  const hasMod = id => progression.mods.includes(id);
  const hasImplant = id => progression.implants.includes(id);

  function loadProgression() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return {
        salvage: Number.isFinite(saved.salvage) ? saved.salvage : 0,
        bestFloor: Number.isFinite(saved.bestFloor) ? saved.bestFloor : 0,
        implants: Array.isArray(saved.implants) ? saved.implants : [],
        mods: Array.isArray(saved.mods) ? saved.mods : []
      };
    } catch {
      return { salvage: 0, bestFloor: 0, implants: [], mods: [] };
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
    roomClearTimer: null
  };

  function saveProgression() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progression));
  }

  function playerStats() {
    return {
      maxHealth: 100 + (hasImplant("cortex") ? 15 : 0),
      armor: 4 + (hasImplant("ceramic") ? 2 : 0),
      speed: 245 * (hasImplant("myofiber") ? 1.12 : 1),
      invulnerability: hasImplant("ghost") ? 0.62 : 0.34,
      magazine: 32 + (hasMod("magazine") ? 12 : 0),
      damage: 9 + (hasMod("muzzle") ? 2 : 0),
      spread: 0.055 - (hasMod("optic") ? 0.022 : 0) - (hasMod("grip") ? 0.012 : 0),
      reload: 1.22 * (hasMod("stock") ? 0.82 : 1)
    };
  }

  function updateHome() {
    element("salvage-count").textContent = String(progression.salvage).padStart(4, "0");
    element("best-floor").textContent = String(progression.bestFloor).padStart(2, "0");
    element("smg-level").textContent = progression.mods.length ? `${progression.mods.length} МОД. УСТАНОВЛЕНО` : "БАЗОВАЯ КОНФИГУРАЦИЯ";
    renderLoadout();
    renderImplants();
    renderWeaponMods();
  }

  function renderLoadout() {
    const list = element("loadout-list");
    list.innerHTML = "";
    STARTER_LOADOUT.forEach(([slot, item, icon]) => {
      const entry = document.createElement("div");
      entry.className = "loadout-item";
      entry.innerHTML = `<span class="loadout-icon">${icon}</span><span><small>${slot}</small><strong>${item}</strong></span>`;
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

  function renderWeaponMods() {
    const grid = element("weapon-mods");
    grid.innerHTML = "";
    WEAPON_MODS.forEach(mod => {
      const unlocked = hasMod(mod.id);
      const button = document.createElement("button");
      button.className = `mod-card ${unlocked ? "active" : ""}`;
      button.type = "button";
      button.disabled = unlocked || progression.salvage < mod.cost;
      button.innerHTML = `<small>${mod.slot} · ${unlocked ? "УСТАНОВЛЕНО" : `${mod.cost} ЛОМА`}</small><strong>${mod.name}</strong><em>${mod.effect}</em>`;
      button.addEventListener("click", () => purchaseMod(mod));
      grid.appendChild(button);
    });
  }

  function purchaseImplant(implant) {
    if (!canBuy(implant, "implants")) return;
    progression.salvage -= implant.cost;
    progression.implants.push(implant.id);
    saveProgression();
    updateHome();
  }

  function purchaseMod(mod) {
    if (!canBuy(mod, "mods")) return;
    progression.salvage -= mod.cost;
    progression.mods.push(mod.id);
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
    state.bullets.push({ owner: "player", x: player.x + Math.cos(aim) * 18, y: player.y + Math.sin(aim) * 18, vx: Math.cos(aim) * 680, vy: Math.sin(aim) * 680, radius: 3, damage: stats.damage, color: "#9ffdf3", lifetime: 1.25 });
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
    player.knifeCooldown = .42;
    player.knifeFlash = .16;
    const angle = Math.atan2(state.input.mouseY - player.y, state.input.mouseX - player.x);
    state.enemies.forEach(enemy => {
      const enemyAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const difference = Math.atan2(Math.sin(enemyAngle - angle), Math.cos(enemyAngle - angle));
      if (distance(player, enemy) < 83 && Math.abs(difference) < .92) damageEnemy(enemy, 34);
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
    state.runSalvage += enemy.reward;
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
    const recovered = Math.floor(state.runSalvage * .4);
    showOverlay(`<div class="overlay-card"><p class="eyebrow">контур контроля обнаружил след</p><h2>Смена окончена.</h2><p>Автономный маршрут выбросил тебя к убежищу. Удалось сохранить ${recovered} ед. лома.</p><div class="overlay-actions"><button class="primary-button" type="button" data-action="return" data-multiplier="0.4">В убежище <span>↖</span></button><button class="quiet-button" type="button" data-action="retry">Новый забег</button></div></div>`);
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
    if (hasMod("underbarrel")) {
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

  element("start-run").addEventListener("click", beginRun);
  element("room-overlay").addEventListener("click", onOverlayClick);
  element("abort-run").addEventListener("click", () => finishRun(1));
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
