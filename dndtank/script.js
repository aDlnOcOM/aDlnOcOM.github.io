// Управляет прогрессией, гаражом, боем на Canvas и поведением танков-ботов.
(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const arena = { width: canvas.width, height: canvas.height };
  const storageKey = "dndtank-save-v1";

  const tankCatalog = [
    { id: "starter", name: "Стартовый", price: 0, hp: 100, speed: 156, reload: 5000, damage: 30, barrels: 1, bullet: "plasma", bulletSpeed: 310, color: "#57f5ff", body: "light", description: "Простая машина. Один точный выстрел раз в 5 секунд." },
    { id: "twin", name: "Двойной импульс", price: 10, hp: 120, speed: 148, reload: 2750, damage: 21, barrels: 2, bullet: "plasma", bulletSpeed: 330, color: "#ff68c4", body: "twin", description: "Две пушки дают плотный неоновый залп." },
    { id: "heavy", name: "Тяжёлый калибр", price: 100, hp: 230, speed: 94, reload: 3500, damage: 82, barrels: 1, bullet: "shell", bulletSpeed: 255, color: "#ffb85c", body: "heavy", description: "Медленный бронекорпус с разрушительным снарядом." },
    { id: "heavyTwin", name: "Двойная броня", price: 100, hp: 210, speed: 88, reload: 3150, damage: 43, barrels: 2, bullet: "shell", bulletSpeed: 265, color: "#a886ff", body: "heavy", description: "Две тяжёлые пушки и крепкая лобовая броня." },
    { id: "flame", name: "Пирон-9", price: 50, hp: 130, speed: 138, reload: 620, damage: 10, barrels: 1, bullet: "flame", bulletSpeed: 230, color: "#ff6a47", body: "flame", description: "Огнемётный танк: короткие, но частые языки пламени." },
    { id: "sturmtiger", name: "Штурмтигер", price: 200, hp: 270, speed: 75, reload: 4600, damage: 142, barrels: 1, bullet: "rocket", bulletSpeed: 225, color: "#ffdb65", body: "sturmtiger", description: "Ракетная мортира. Один залп меняет карту." },
    { id: "object295", name: "Объект 295", price: 500, hp: 315, speed: 84, reload: 2250, damage: 58, barrels: 2, bullet: "ion", bulletSpeed: 340, color: "#6fffd0", body: "object", description: "Экспериментальная плазма и максимальная живучесть." },
    { id: "rail", name: "Рельсотрон", price: 1000, hp: 135, speed: 128, reload: 3050, damage: 176, barrels: 1, bullet: "rail", bulletSpeed: 690, color: "#f2eaff", body: "rail", description: "Сверхбыстрый рельсовый разряд почти без времени полёта." },
    { id: "super", name: "Супертанк", price: 5000, hp: 470, speed: 74, reload: 1650, damage: 68, barrels: 3, bullet: "nova", bulletSpeed: 320, color: "#ff52df", body: "super", description: "Три башни, крепчайшая броня и штурмовой темп." },
  ];

  const difficulties = {
    easy: { label: "Лёгкий", enemy: "Кадет-соперник", reward: 1, hp: 70, speed: 64, reload: 3100, damage: 10, aim: .52, fireRange: 440, color: "#a883ff", body: "light" },
    medium: { label: "Средний", enemy: "Неоновый охотник", reward: 10, hp: 135, speed: 96, reload: 1950, damage: 17, aim: .28, fireRange: 560, color: "#ff70bd", body: "twin" },
    hard: { label: "Сложный", enemy: "Синт-танк «Волна»", reward: 75, hp: 225, speed: 120, reload: 1280, damage: 28, aim: .13, fireRange: 680, color: "#ffb85c", body: "heavy" },
    extreme: { label: "Экстремальный", enemy: "Архонт арены", reward: 200, hp: 360, speed: 137, reload: 830, damage: 40, aim: .06, fireRange: 760, color: "#6fffd0", body: "object" },
    alex: { label: "Алекс", enemy: "АЛЕКС // НЕУМОЛИМЫЙ", reward: 1000, hp: 570, speed: 150, reload: 560, damage: 57, aim: .018, fireRange: 900, color: "#ff376d", body: "super", alex: true },
  };

  const ui = {
    coins: document.querySelector("#coins"),
    difficulty: document.querySelector("#difficulty"),
    chosenTank: document.querySelector("#chosenTank"),
    garage: document.querySelector("#garageDialog"),
    tankGrid: document.querySelector("#tankGrid"),
    stageOverlay: document.querySelector("#stageOverlay"),
    battleStatus: document.querySelector("#battleStatus"),
    playerHealth: document.querySelector("#playerHealth"),
    playerHealthText: document.querySelector("#playerHealthText"),
    enemyHealth: document.querySelector("#enemyHealth"),
    enemyHealthText: document.querySelector("#enemyHealthText"),
    reloadMeter: document.querySelector("#reloadMeter"),
    playerName: document.querySelector("#playerName"),
    enemyName: document.querySelector("#enemyName"),
    result: document.querySelector("#resultDialog"),
    resultEyebrow: document.querySelector("#resultEyebrow"),
    resultTitle: document.querySelector("#resultTitle"),
    resultText: document.querySelector("#resultText"),
    resultButton: document.querySelector("#resultButton"),
  };

  const defaultSave = { coins: 0, selected: "starter", unlocked: ["starter"], victories: 0 };
  let save = loadSave();

  function loadSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || !Array.isArray(saved.unlocked)) return { ...defaultSave, unlocked: [...defaultSave.unlocked] };
      return { ...defaultSave, ...saved, unlocked: [...new Set(["starter", ...saved.unlocked])] };
    } catch {
      return { ...defaultSave, unlocked: [...defaultSave.unlocked] };
    }
  }

  function persistSave() {
    localStorage.setItem(storageKey, JSON.stringify(save));
  }

  function getTank(id = save.selected) {
    return tankCatalog.find((tank) => tank.id === id) || tankCatalog[0];
  }

  function updateMenu() {
    const tank = getTank();
    ui.coins.textContent = save.coins.toLocaleString("ru-RU");
    ui.chosenTank.innerHTML = `<span>Выбранный корпус</span><strong>${tank.name}</strong><span>${tank.hp} HP · ${tank.barrels} ${tank.barrels === 1 ? "ствол" : "ствола"} · ${formatReload(tank.reload)}</span>`;
    ui.playerName.textContent = tank.name;
    const difficulty = difficulties[ui.difficulty.value];
    ui.enemyName.textContent = difficulty.enemy;
  }

  function formatReload(milliseconds) {
    return `${(milliseconds / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
  }

  function tankGlyph(tank) {
    const barrels = Array.from({ length: tank.barrels }, (_, index) => `<rect x="${52 + index * 9 - (tank.barrels - 1) * 4.5}" y="21" width="7" height="31" rx="2" fill="${tank.color}" />`).join("");
    return `<svg class="tank-silhouette" viewBox="0 0 120 72" aria-hidden="true"><rect x="16" y="44" width="88" height="19" rx="7" fill="#21113e" stroke="${tank.color}" stroke-width="2"/><rect x="29" y="32" width="62" height="24" rx="7" fill="${tank.color}" opacity=".75"/><rect x="43" y="24" width="34" height="25" rx="9" fill="#391467" stroke="${tank.color}" stroke-width="2"/>${barrels}<circle cx="34" cy="63" r="7" fill="#0c041e" stroke="${tank.color}"/><circle cx="86" cy="63" r="7" fill="#0c041e" stroke="${tank.color}"/></svg>`;
  }

  function renderGarage() {
    ui.tankGrid.innerHTML = tankCatalog.map((tank) => {
      const owned = save.unlocked.includes(tank.id);
      const selected = tank.id === save.selected;
      const action = owned ? (selected ? "Выбран" : "Выбрать") : `Купить · ${tank.price} ◈`;
      return `<article class="tank-card ${owned ? "" : "locked"} ${selected ? "selected" : ""}" data-tank="${tank.id}">
        <span class="tank-price">${tank.price === 0 ? "Бесплатно" : `${tank.price} ◈`}</span>
        <h3>${tank.name}</h3><p>${tank.description}</p>
        <p class="tank-stat">${tank.hp} HP · ${tank.speed} скорость · ${formatReload(tank.reload)}</p>
        ${tankGlyph(tank)}<button class="tank-action" type="button">${action}</button>
      </article>`;
    }).join("");
  }

  function chooseOrBuy(tankId) {
    const tank = getTank(tankId);
    if (!save.unlocked.includes(tankId)) {
      if (save.coins < tank.price) {
        flashStatus(`Нужно ещё ${tank.price - save.coins} ◈`);
        return;
      }
      save.coins -= tank.price;
      save.unlocked.push(tankId);
    }
    save.selected = tankId;
    persistSave();
    updateMenu();
    renderGarage();
  }

  function flashStatus(text) {
    ui.battleStatus.textContent = text;
    ui.battleStatus.classList.add("show");
    window.clearTimeout(flashStatus.timeout);
    flashStatus.timeout = window.setTimeout(() => ui.battleStatus.classList.remove("show"), 1700);
  }

  document.querySelector("#garageButton").addEventListener("click", () => {
    renderGarage();
    ui.garage.showModal();
  });
  document.querySelector("#closeGarage").addEventListener("click", () => ui.garage.close());
  ui.tankGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-tank]");
    if (card) chooseOrBuy(card.dataset.tank);
  });
  ui.difficulty.addEventListener("change", updateMenu);

  const obstacles = [
    { x: 160, y: 120, width: 142, height: 46 }, { x: 626, y: 112, width: 115, height: 58 },
    { x: 388, y: 238, width: 86, height: 108 }, { x: 106, y: 438, width: 135, height: 42 },
    { x: 676, y: 424, width: 165, height: 45 }, { x: 760, y: 265, width: 64, height: 105 },
  ];
  const game = {
    active: false, ended: false, player: null, enemy: null, projectiles: [], particles: [],
    keys: new Set(), aim: { x: arena.width * .5, y: arena.height * .5 }, lastTime: 0,
    round: 0, animationFrame: 0, shake: 0,
  };

  function createTank(spec, x, y, enemy = false) {
    const source = enemy ? { ...spec, barrels: spec.alex ? 3 : spec.body === "twin" ? 2 : 1, bullet: spec.alex ? "nova" : "plasma", bulletSpeed: spec.alex ? 390 : 315 } : spec;
    return {
      ...source, x, y, enemy, maxHp: source.hp, hp: source.hp, angle: enemy ? Math.PI : 0,
      bodyAngle: enemy ? Math.PI : 0, radius: source.body === "heavy" || source.body === "super" ? 29 : 24,
      cooldown: 0, hurt: 0, lastShot: 0, strafeSign: Math.random() > .5 ? 1 : -1,
    };
  }

  function drawArenaBackground() {
    const horizon = 184;
    const gradient = ctx.createLinearGradient(0, 0, 0, arena.height);
    gradient.addColorStop(0, "#17034b");
    gradient.addColorStop(.46, "#381074");
    gradient.addColorStop(.465, "#1b073e");
    gradient.addColorStop(1, "#070015");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, arena.width, arena.height);

    ctx.save();
    ctx.translate(arena.width * .5, 94);
    const sun = ctx.createLinearGradient(0, -72, 0, 72);
    sun.addColorStop(0, "#ffd86d");
    sun.addColorStop(.5, "#ff69bd");
    sun.addColorStop(1, "#b234e6");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(0, 0, 77, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(41, 7, 84, .5)";
    ctx.lineWidth = 4;
    for (let y = -29; y < 74; y += 14) {
      ctx.beginPath();
      ctx.moveTo(-76, y); ctx.lineTo(76, y); ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "#160331";
    ctx.beginPath();
    ctx.moveTo(0, horizon); ctx.lineTo(128, 88); ctx.lineTo(242, horizon); ctx.lineTo(382, 106); ctx.lineTo(511, horizon); ctx.lineTo(679, 78); ctx.lineTo(839, horizon); ctx.lineTo(960, 111); ctx.lineTo(960, horizon + 20); ctx.lineTo(0, horizon + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(72,246,255,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(arena.width, horizon); ctx.stroke();

    ctx.save();
    ctx.beginPath(); ctx.rect(0, horizon, arena.width, arena.height - horizon); ctx.clip();
    ctx.strokeStyle = "rgba(255,84,184,.28)";
    ctx.lineWidth = 1;
    for (let y = horizon + 14; y < arena.height + 90; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(arena.width, y); ctx.stroke();
    }
    for (let x = -300; x < arena.width + 310; x += 66) {
      ctx.beginPath(); ctx.moveTo(arena.width * .5, horizon); ctx.lineTo(x, arena.height); ctx.stroke();
    }
    ctx.restore();
  }

  function drawObstacle(obstacle) {
    ctx.save();
    ctx.shadowColor = "#a657ff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#21064b";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(112,248,255,.75)";
    ctx.lineWidth = 2;
    ctx.strokeRect(obstacle.x + 1, obstacle.y + 1, obstacle.width - 2, obstacle.height - 2);
    ctx.fillStyle = "rgba(255,84,184,.33)";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 8, obstacle.width - 16, 5);
    ctx.restore();
  }

  function drawTank(tank, alpha = 1) {
    const color = tank.color || "#ff64bd";
    const width = tank.body === "heavy" || tank.body === "super" || tank.body === "sturmtiger" ? 51 : 43;
    const length = tank.body === "rail" ? 62 : tank.body === "super" ? 54 : 49;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.bodyAngle || tank.angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = tank.hurt > 0 ? 28 : 13;
    ctx.fillStyle = "#100323";
    ctx.fillRect(-length / 2, -width / 2 - 5, length, 10);
    ctx.fillRect(-length / 2, width / 2 - 5, length, 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * .78;
    ctx.fillRect(-length / 2 + 5, -width / 2 + 6, length - 10, width - 12);
    ctx.fillStyle = "#2b0b58";
    ctx.fillRect(-length / 2 + 10, -width / 2 + 11, length - 20, width - 22);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-length / 2 + 6, -width / 2 + 7, length - 12, width - 14);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);
    const turret = tank.body === "super" ? 29 : tank.body === "heavy" ? 26 : 22;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#25064d";
    ctx.beginPath(); ctx.arc(0, 0, turret, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;
    const gap = 8;
    for (let barrel = 0; barrel < tank.barrels; barrel += 1) {
      const offset = (barrel - (tank.barrels - 1) / 2) * gap;
      ctx.fillStyle = color;
      ctx.fillRect(turret - 4, offset - 3, tank.body === "rail" ? 57 : tank.body === "sturmtiger" ? 37 : 38, 6);
      ctx.fillStyle = "#ffe8ff";
      ctx.fillRect(turret + 22, offset - 1.5, tank.body === "rail" ? 34 : 12, 3);
    }
    ctx.fillStyle = tank.enemy ? "#ffdee9" : "#d9fbff";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawShowcase() {
    const player = createTank(getTank(), 268, 365);
    const enemy = createTank(difficulties[ui.difficulty.value], 708, 305, true);
    enemy.angle = Math.PI * .82;
    drawTank(player, .92);
    drawTank(enemy, .92);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function collidesAt(tank, x, y) {
    if (x < tank.radius + 15 || x > arena.width - tank.radius - 15 || y < tank.radius + 15 || y > arena.height - tank.radius - 15) return true;
    return obstacles.some((obstacle) => {
      const nearX = clamp(x, obstacle.x, obstacle.x + obstacle.width);
      const nearY = clamp(y, obstacle.y, obstacle.y + obstacle.height);
      return Math.hypot(x - nearX, y - nearY) < tank.radius + 3;
    });
  }

  function moveTank(tank, dx, dy) {
    if (!collidesAt(tank, tank.x + dx, tank.y)) tank.x += dx;
    if (!collidesAt(tank, tank.x, tank.y + dy)) tank.y += dy;
  }

  function updatePlayer(delta) {
    const player = game.player;
    if (!player) return;
    let dx = (game.keys.has("KeyD") ? 1 : 0) - (game.keys.has("KeyA") ? 1 : 0);
    let dy = (game.keys.has("KeyS") ? 1 : 0) - (game.keys.has("KeyW") ? 1 : 0);
    if (dx || dy) {
      const magnitude = Math.hypot(dx, dy);
      dx = (dx / magnitude) * player.speed * delta;
      dy = (dy / magnitude) * player.speed * delta;
      moveTank(player, dx, dy);
      player.bodyAngle = Math.atan2(dy, dx);
      player.vx = dx / delta;
      player.vy = dy / delta;
    } else {
      player.vx = 0;
      player.vy = 0;
    }
    player.angle = Math.atan2(game.aim.y - player.y, game.aim.x - player.x);
    player.cooldown = Math.max(0, player.cooldown - delta * 1000);
    player.hurt = Math.max(0, player.hurt - delta);
  }

  function angleDifference(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  function lineOfSight(from, to) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const samples = Math.max(2, Math.ceil(distance / 24));
    for (let step = 1; step < samples; step += 1) {
      const factor = step / samples;
      if (pointInsideObstacle(from.x + (to.x - from.x) * factor, from.y + (to.y - from.y) * factor)) return false;
    }
    return true;
  }

  function updateEnemy(delta) {
    const enemy = game.enemy;
    const player = game.player;
    if (!enemy || !player || player.destroyed) return;
    const difficulty = difficulties[ui.difficulty.value];
    enemy.cooldown = Math.max(0, enemy.cooldown - delta * 1000);
    enemy.hurt = Math.max(0, enemy.hurt - delta);
    const hasSight = lineOfSight(enemy, player);
    const routeTarget = hasSight ? player : {
      x: enemy.x > arena.width / 2 ? arena.width - 62 : 62,
      y: enemy.y < arena.height / 2 ? arena.height - 62 : 62,
    };
    const dx = routeTarget.x - enemy.x;
    const dy = routeTarget.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const playerDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y) || 1;
    const vectorX = dx / distance;
    const vectorY = dy / distance;
    const preferredRange = difficulty.alex ? 310 : difficulty.label === "Экстремальный" ? 345 : difficulty.label === "Сложный" ? 300 : 250;
    const motionBias = difficulty.alex ? .92 : difficulty.label === "Экстремальный" ? .77 : difficulty.label === "Сложный" ? .54 : .26;
    let forward = hasSight ? (playerDistance > preferredRange + 48 ? 1 : playerDistance < preferredRange - 56 ? -1 : 0) : 1;
    if (hasSight && difficulty.alex && player.cooldown > player.reload * .62) forward = 1;
    const strafe = (difficulty.alex ? .7 : difficulty.label === "Экстремальный" ? .55 : difficulty.label === "Сложный" ? .34 : .14) * enemy.strafeSign;
    let moveX = (vectorX * forward - vectorY * strafe) * enemy.speed * delta * (1 + motionBias * .17);
    let moveY = (vectorY * forward + vectorX * strafe) * enemy.speed * delta * (1 + motionBias * .17);
    const beforeX = enemy.x;
    const beforeY = enemy.y;
    moveTank(enemy, moveX, moveY);
    if (Math.hypot(enemy.x - beforeX, enemy.y - beforeY) < 1) {
      enemy.strafeSign *= -1;
      moveTank(enemy, -moveY, moveX);
    }
    if (Math.random() < delta * (difficulty.alex ? .95 : .31)) enemy.strafeSign *= -1;
    const lead = difficulty.alex ? .48 : difficulty.label === "Экстремальный" ? .27 : difficulty.label === "Сложный" ? .16 : 0;
    const targetX = player.x + (player.vx || 0) * lead;
    const targetY = player.y + (player.vy || 0) * lead;
    const rawAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    const wobble = Math.sin(performance.now() / (difficulty.alex ? 170 : 370)) * difficulty.aim;
    enemy.angle = rawAngle + wobble + (Math.random() - .5) * difficulty.aim;
    enemy.bodyAngle += angleDifference(enemy.bodyAngle, rawAngle) * Math.min(1, delta * (difficulty.alex ? 6 : 3));
    const canFire = playerDistance < difficulty.fireRange && hasSight;
    if (canFire) fireTank(enemy, enemy.angle);
  }

  function setAim(event) {
    const bounds = canvas.getBoundingClientRect();
    game.aim.x = (event.clientX - bounds.left) * (arena.width / bounds.width);
    game.aim.y = (event.clientY - bounds.top) * (arena.height / bounds.height);
  }

  function startBattle() {
    const selectedTank = getTank();
    const difficulty = difficulties[ui.difficulty.value];
    game.active = true;
    game.ended = false;
    game.round += 1;
    game.projectiles = [];
    game.particles = [];
    game.player = createTank(selectedTank, 110, arena.height - 104);
    game.enemy = createTank(difficulty, arena.width - 112, 94, true);
    game.aim = { x: arena.width * .62, y: arena.height * .42 };
    ui.stageOverlay.classList.add("hidden");
    ui.playerName.textContent = selectedTank.name;
    ui.enemyName.textContent = difficulty.enemy;
    ui.enemyHealthText.textContent = `${difficulty.hp} / ${difficulty.hp}`;
    ui.playerHealthText.textContent = `${selectedTank.hp} / ${selectedTank.hp}`;
    ui.playerHealth.style.width = "100%";
    ui.enemyHealth.style.width = "100%";
    ui.reloadMeter.style.width = "0%";
    flashStatus(`${difficulty.label.toUpperCase()} // НАЧАЛО`);
  }

  function pointInsideObstacle(x, y) {
    return obstacles.some((obstacle) => x > obstacle.x && x < obstacle.x + obstacle.width && y > obstacle.y && y < obstacle.y + obstacle.height);
  }

  function spawnParticles(x, y, color, amount = 8, speed = 90) {
    for (let index = 0; index < amount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (.35 + Math.random());
      game.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, color, life: .28 + Math.random() * .35, maxLife: .65, size: 2 + Math.random() * 4 });
    }
  }

  function fireTank(tank, forcedAngle = tank.angle) {
    if (tank.cooldown > 0) return false;
    const spread = tank.bullet === "flame" ? .21 : tank.bullet === "nova" ? .075 : .028;
    const count = tank.bullet === "flame" ? 5 : tank.barrels;
    const range = tank.bullet === "flame" ? .64 : tank.bullet === "rail" ? .78 : 1;
    const projectileSize = tank.bullet === "rocket" || tank.bullet === "shell" ? 8 : tank.bullet === "nova" ? 6 : 4;
    const muzzle = tank.radius + (tank.body === "rail" ? 43 : 26);
    tank.cooldown = tank.reload;
    tank.lastShot = performance.now();
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * (tank.bullet === "flame" ? .09 : spread);
      const angle = forcedAngle + offset + (Math.random() - .5) * spread;
      const speed = tank.bulletSpeed * (.88 + Math.random() * .12);
      game.projectiles.push({
        owner: tank.enemy ? "enemy" : "player", x: tank.x + Math.cos(angle) * muzzle, y: tank.y + Math.sin(angle) * muzzle,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, damage: tank.damage * (count > 1 && tank.bullet !== "flame" ? .92 : 1),
        radius: projectileSize, type: tank.bullet, color: tank.color, life: (tank.bullet === "rail" ? 1.2 : 2.4) * range,
        explosion: tank.bullet === "rocket" ? 58 : tank.bullet === "shell" ? 37 : tank.bullet === "nova" ? 28 : 0,
      });
    }
    spawnParticles(tank.x + Math.cos(forcedAngle) * muzzle, tank.y + Math.sin(forcedAngle) * muzzle, tank.color, tank.bullet === "rail" ? 14 : 6, 75);
    return true;
  }

  function damageTank(tank, amount, projectile) {
    tank.hp = Math.max(0, tank.hp - amount);
    tank.hurt = .16;
    game.shake = Math.max(game.shake, projectile.explosion ? 10 : 3);
    spawnParticles(tank.x, tank.y, projectile.color, projectile.explosion ? 18 : 8, projectile.explosion ? 160 : 70);
    if (tank.hp <= 0) {
      tank.destroyed = true;
      spawnParticles(tank.x, tank.y, "#ffe47c", 30, 230);
    }
  }

  function explodeProjectile(projectile, directTarget) {
    spawnParticles(projectile.x, projectile.y, projectile.color, projectile.explosion ? 18 : 5, projectile.explosion ? 150 : 60);
    if (!projectile.explosion) return;
    const target = projectile.owner === "player" ? game.enemy : game.player;
    if (!target || target === directTarget || target.destroyed) return;
    const distance = Math.hypot(target.x - projectile.x, target.y - projectile.y);
    if (distance < projectile.explosion + target.radius) damageTank(target, projectile.damage * Math.max(.25, 1 - distance / (projectile.explosion + target.radius)), projectile);
  }

  function updateProjectiles(delta) {
    for (let index = game.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = game.projectiles[index];
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      projectile.life -= delta;
      const target = projectile.owner === "player" ? game.enemy : game.player;
      const hitTank = target && !target.destroyed && Math.hypot(projectile.x - target.x, projectile.y - target.y) < target.radius + projectile.radius;
      if (hitTank) damageTank(target, projectile.damage, projectile);
      const expired = projectile.life <= 0 || projectile.x < 0 || projectile.x > arena.width || projectile.y < 0 || projectile.y > arena.height || pointInsideObstacle(projectile.x, projectile.y);
      if (hitTank || expired) {
        explodeProjectile(projectile, hitTank ? target : null);
        game.projectiles.splice(index, 1);
      }
    }
    for (let index = game.particles.length - 1; index >= 0; index -= 1) {
      const particle = game.particles[index];
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= .94; particle.vy *= .94; particle.life -= delta;
      if (particle.life <= 0) game.particles.splice(index, 1);
    }
  }

  function drawProjectile(projectile) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.angle);
    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = projectile.type === "rail" ? 22 : 12;
    ctx.fillStyle = projectile.color;
    if (projectile.type === "rail") ctx.fillRect(-15, -2, 30, 4);
    else if (projectile.type === "flame") { ctx.rotate(Math.random() * .2); ctx.fillRect(-7, -3, 14, 6); }
    else { ctx.beginPath(); ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawParticles() {
    game.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, particle.life / .24);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      ctx.restore();
    });
  }

  function updateBattleHud() {
    if (!game.player || !game.enemy) return;
    const playerPercent = game.player.hp / game.player.maxHp * 100;
    const enemyPercent = game.enemy.hp / game.enemy.maxHp * 100;
    ui.playerHealth.style.width = `${playerPercent}%`;
    ui.enemyHealth.style.width = `${enemyPercent}%`;
    ui.playerHealthText.textContent = `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;
    ui.enemyHealthText.textContent = `${Math.ceil(game.enemy.hp)} / ${game.enemy.maxHp}`;
    ui.reloadMeter.style.width = `${100 - game.player.cooldown / game.player.reload * 100}%`;
  }

  function finishBattle(victory) {
    if (game.ended) return;
    game.ended = true;
    game.projectiles = [];
    const difficulty = difficulties[ui.difficulty.value];
    if (victory) {
      save.coins += difficulty.reward;
      save.victories += 1;
      persistSave();
      updateMenu();
      flashStatus(`ПОБЕДА +${difficulty.reward} ◈`);
    } else {
      flashStatus("КОРПУС УНИЧТОЖЕН");
    }
    window.setTimeout(() => {
      ui.resultEyebrow.textContent = victory ? `${difficulty.label.toUpperCase()} ПРОЙДЕН` : "ПОРАЖЕНИЕ";
      ui.resultTitle.textContent = victory ? "ПОБЕДА" : "РЕМОНТ";
      ui.resultText.textContent = victory
        ? `Противник уничтожен. В банк зачислено ${difficulty.reward} ◈. Всего побед: ${save.victories}.`
        : "Ваша машина разбита. Подберите другой корпус, используйте укрытия и попробуйте снова.";
      ui.resultButton.textContent = victory ? "Забрать награду" : "Вернуться в ангар";
      ui.result.showModal();
    }, 620);
  }

  function returnToHangar() {
    ui.result.close();
    game.active = false;
    game.ended = false;
    game.player = null;
    game.enemy = null;
    ui.stageOverlay.classList.remove("hidden");
    ui.stageOverlay.innerHTML = "<p class=\"eyebrow\">ГАРАЖ // ГОТОВ</p><h2>АРЕНА<br /><span>ЖДЁТ</span></h2><p>Выберите уровень и снова<br />заберите неоновую награду.</p>";
  }

  function render() {
    drawArenaBackground();
    obstacles.forEach(drawObstacle);
    if (game.active) {
      drawTank(game.player);
      drawTank(game.enemy);
      game.projectiles.forEach(drawProjectile);
      drawParticles();
    } else {
      drawShowcase();
    }
  }

  function animationLoop(timestamp) {
    game.lastTime = game.lastTime || timestamp;
    const delta = Math.min(.034, (timestamp - game.lastTime) / 1000);
    game.lastTime = timestamp;
    if (game.active && !game.ended) {
      updatePlayer(delta);
      updateEnemy(delta);
      updateProjectiles(delta);
      updateBattleHud();
      if (game.enemy.destroyed || game.player.destroyed) finishBattle(Boolean(game.enemy.destroyed && !game.player.destroyed));
    }
    render();
    game.animationFrame = requestAnimationFrame(animationLoop);
  }

  window.addEventListener("keydown", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      event.preventDefault();
      game.keys.add(event.code);
    }
  });
  window.addEventListener("keyup", (event) => game.keys.delete(event.code));
  canvas.addEventListener("pointermove", setAim);
  canvas.addEventListener("pointerdown", (event) => {
    setAim(event);
    if (game.active && !game.ended) fireTank(game.player);
  });
  canvas.addEventListener("click", (event) => {
    setAim(event);
    if (game.active && !game.ended) fireTank(game.player);
  });
  document.querySelector("#playButton").addEventListener("click", startBattle);
  ui.resultButton.addEventListener("click", returnToHangar);

  updateMenu();
  renderGarage();
  game.animationFrame = requestAnimationFrame(animationLoop);
})();
