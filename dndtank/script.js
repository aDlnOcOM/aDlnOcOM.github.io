// Управляет прогрессией, гаражом, боем на Canvas и поведением танков-ботов.
(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const arena = { width: canvas.width, height: canvas.height };
  const storageKey = "dndtank-save-v1";
  const tileSize = 48;

  const tankCatalog = [
    { id: "starter", name: "Стартовый", price: 0, hp: 100, speed: 156, reload: 5000, damage: 30, range: 410, barrels: 1, bullet: "plasma", bulletSpeed: 310, color: "#57f5ff", body: "light", description: "Простая машина. Один точный выстрел раз в 5 секунд." },
    { id: "twin", name: "Двойной импульс", price: 10, hp: 120, speed: 148, reload: 2750, damage: 21, range: 450, barrels: 2, bullet: "plasma", bulletSpeed: 330, color: "#ff68c4", body: "twin", description: "Две пушки дают плотный неоновый залп." },
    { id: "heavy", name: "Тяжёлый калибр", price: 100, hp: 230, speed: 94, reload: 3500, damage: 82, range: 530, barrels: 1, bullet: "shell", bulletSpeed: 255, color: "#ffb85c", body: "heavy", description: "Медленный бронекорпус с разрушительным снарядом." },
    { id: "heavyTwin", name: "Двойная броня", price: 100, hp: 210, speed: 88, reload: 3150, damage: 43, range: 510, barrels: 2, bullet: "shell", bulletSpeed: 265, color: "#a886ff", body: "heavy", description: "Две тяжёлые пушки и крепкая лобовая броня." },
    { id: "flame", name: "Пирон-9", price: 50, hp: 130, speed: 138, reload: 620, damage: 10, range: 205, barrels: 1, bullet: "flame", bulletSpeed: 230, color: "#ff6a47", body: "flame", description: "Огнемётный танк: короткие, но частые языки пламени." },
    { id: "sturmtiger", name: "Штурмтигер", price: 200, hp: 270, speed: 75, reload: 4600, damage: 142, range: 420, barrels: 1, bullet: "rocket", bulletSpeed: 225, color: "#ffdb65", body: "sturmtiger", description: "Ракетная мортира: взрыв ровно в радиусе одного тайла." },
    { id: "object295", name: "Объект 295", price: 500, hp: 315, speed: 84, reload: 2250, damage: 58, range: 580, barrels: 2, bullet: "ion", bulletSpeed: 340, color: "#6fffd0", body: "object", description: "Экспериментальная плазма и максимальная живучесть." },
    { id: "rail", name: "Рельсотрон", price: 1000, hp: 135, speed: 128, reload: 3050, damage: 176, range: 820, barrels: 1, bullet: "rail", bulletSpeed: 690, color: "#f2eaff", body: "rail", description: "Сверхбыстрый рельсовый разряд почти без времени полёта." },
    { id: "super", name: "Супертанк", price: 5000, hp: 470, speed: 74, reload: 1650, damage: 68, range: 460, barrels: 3, bullet: "nova", bulletSpeed: 320, color: "#ff52df", body: "super", description: "Три башни, крепчайшая броня и штурмовой темп." },
  ];

  const difficulties = {
    easy: { label: "Лёгкий", enemy: "Кадет-соперник", reward: 1, hp: 70, speed: 64, reload: 3100, damage: 10, range: 340, color: "#a883ff", body: "light" },
    medium: { label: "Средний", enemy: "Неоновый охотник", reward: 10, hp: 135, speed: 96, reload: 1950, damage: 17, range: 420, color: "#ff70bd", body: "twin" },
    hard: { label: "Сложный", enemy: "Синт-танк «Волна»", reward: 75, hp: 225, speed: 120, reload: 1280, damage: 28, range: 510, color: "#ffb85c", body: "heavy" },
    extreme: { label: "Экстремальный", enemy: "Архонт арены", reward: 200, hp: 360, speed: 137, reload: 830, damage: 40, range: 570, color: "#6fffd0", body: "object" },
    alex: { label: "Алекс", enemy: "АЛЕКС // НЕУМОЛИМЫЙ", reward: 1000, hp: 570, speed: 150, reload: 560, damage: 57, range: 820, color: "#ff376d", body: "super", alex: true },
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

  function createAlexBuild() {
    const topTanks = tankCatalog.slice(-4);
    const base = topTanks[Math.floor(Math.random() * topTanks.length)];
    const tactics = {
      sturmtiger: { tactic: "siege", tacticName: "осадный маршрут", rangeBonus: 65 },
      object295: { tactic: "flank", tacticName: "фланговый маршрут", rangeBonus: 90 },
      rail: { tactic: "sniper", tacticName: "снайперский маршрут", rangeBonus: 120 },
      super: { tactic: "assault", tacticName: "штурмовой маршрут", rangeBonus: 50 },
    };
    const tacticalProfile = tactics[base.id];
    return {
      ...base,
      ...tacticalProfile,
      alex: true,
      enemyName: `АЛЕКС // ${base.name.toUpperCase()}`,
      hp: Math.round(base.hp * 1.65),
      speed: Math.max(140, Math.round(base.speed * 1.25)),
      reload: Math.max(420, Math.round(base.reload * .33)),
      damage: Math.round(base.damage * 1.3),
      range: Math.min(880, base.range + tacticalProfile.rangeBonus),
      color: "#ff376d",
    };
  }

  function updateMenu() {
    const tank = getTank();
    ui.coins.textContent = save.coins.toLocaleString("ru-RU");
    ui.chosenTank.innerHTML = `<span>Выбранный корпус</span><strong>${tank.name}</strong><span>${tank.hp} HP · дальность ${tank.range} · ${formatReload(tank.reload)}</span>`;
    ui.playerName.textContent = tank.name;
    const difficulty = difficulties[ui.difficulty.value];
    ui.enemyName.textContent = difficulty.enemy;
  }

  function formatReload(milliseconds) {
    return `${(milliseconds / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
  }

  function tankGlyph(tank) {
    const color = tank.color;
    const glyphs = {
      light: `<rect x="18" y="47" width="76" height="15" rx="6" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M31 47h49l8 9H24z" fill="${color}" opacity=".8"/><rect x="50" y="35" width="23" height="17" rx="5" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="70" y="40" width="30" height="6" rx="2" fill="${color}"/>`,
      twin: `<rect x="15" y="47" width="84" height="16" rx="6" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M27 47h57l9 10H21z" fill="${color}" opacity=".78"/><rect x="48" y="33" width="28" height="20" rx="6" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="72" y="37" width="30" height="5" rx="2" fill="${color}"/><rect x="72" y="45" width="30" height="5" rx="2" fill="${color}"/>`,
      heavy: `<rect x="10" y="43" width="100" height="22" rx="7" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M23 43h69l12 11H16z" fill="${color}" opacity=".78"/><path d="M43 29h38l9 20H35z" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="77" y="36" width="34" height="8" rx="2" fill="${color}"/>`,
      flame: `<rect x="16" y="48" width="80" height="14" rx="6" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M31 47h49l10 9H25z" fill="${color}" opacity=".78"/><circle cx="59" cy="42" r="15" fill="#351061" stroke="${color}" stroke-width="2"/><path d="M71 38h31l7 4-7 4H71z" fill="${color}"/><path d="M102 37l12 5-12 5z" fill="#ffe86f"/>`,
      sturmtiger: `<rect x="8" y="42" width="104" height="23" rx="7" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M18 42h80l9 12H12z" fill="${color}" opacity=".8"/><rect x="33" y="26" width="48" height="25" rx="4" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="76" y="32" width="27" height="13" rx="3" fill="${color}"/><circle cx="94" cy="38" r="4" fill="#ffe86f"/>`,
      object: `<rect x="10" y="46" width="100" height="18" rx="7" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M20 46h73l12 10H15z" fill="${color}" opacity=".78"/><path d="M38 45l11-18h29l12 18z" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="73" y="32" width="33" height="5" rx="2" fill="${color}"/><rect x="73" y="40" width="33" height="5" rx="2" fill="${color}"/>`,
      rail: `<rect x="18" y="48" width="78" height="14" rx="6" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M32 47h47l10 9H26z" fill="${color}" opacity=".78"/><rect x="48" y="35" width="26" height="17" rx="5" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="69" y="40" width="46" height="5" rx="1" fill="${color}"/><rect x="98" y="36" width="17" height="13" rx="2" fill="#eafaff"/>`,
      super: `<rect x="6" y="42" width="108" height="23" rx="8" fill="#120321" stroke="${color}" stroke-width="2"/><path d="M17 42h83l10 12H10z" fill="${color}" opacity=".8"/><path d="M36 45l8-22h38l10 22z" fill="#351061" stroke="${color}" stroke-width="2"/><rect x="77" y="29" width="32" height="4" rx="2" fill="${color}"/><rect x="77" y="37" width="32" height="4" rx="2" fill="${color}"/><rect x="77" y="45" width="32" height="4" rx="2" fill="${color}"/>`,
    };
    return `<svg class="tank-silhouette" viewBox="0 0 120 72" aria-hidden="true">${glyphs[tank.body] || glyphs.light}</svg>`;
  }

  function renderGarage() {
    ui.tankGrid.innerHTML = tankCatalog.map((tank) => {
      const owned = save.unlocked.includes(tank.id);
      const selected = tank.id === save.selected;
      const action = owned ? (selected ? "Выбран" : "Выбрать") : `Купить · ${tank.price} ◈`;
      return `<article class="tank-card ${owned ? "" : "locked"} ${selected ? "selected" : ""}" data-tank="${tank.id}">
        <span class="tank-price">${tank.price === 0 ? "Бесплатно" : `${tank.price} ◈`}</span>
        <h3>${tank.name}</h3><p>${tank.description}</p>
        <p class="tank-stat">${tank.hp} HP · дальность ${tank.range} · ${formatReload(tank.reload)}</p>
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

  const grid = { columns: 20, rows: 12, size: tileSize, top: 22 };
  const spawnCells = { player: { column: 1, row: 10 }, enemy: { column: 18, row: 1 } };
  const wallTypes = {
    monolith: { label: "Монолит", hitPoints: Infinity, color: "#5f6c9c", edge: "#b8d5ff" },
    fortified: { label: "Крепкая стена", hitPoints: 4, color: "#9664bc", edge: "#f0adff" },
    regular: { label: "Обычная стена", hitPoints: 2, color: "#bc557f", edge: "#ff9ec4" },
  };
  let arenaBlocks = [];
  let blockLookup = new Map();

  function cellKey(column, row) {
    return `${column}:${row}`;
  }

  function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function cellCenter(cell) {
    return { x: cell.column * grid.size + grid.size / 2, y: grid.top + cell.row * grid.size + grid.size / 2 };
  }

  function blockRect(block) {
    return { x: block.column * grid.size, y: grid.top + block.row * grid.size, width: grid.size, height: grid.size };
  }

  function clearRouteSegment(start, end, clearCells) {
    const columnStep = Math.sign(end.column - start.column);
    const rowStep = Math.sign(end.row - start.row);
    const distance = Math.max(Math.abs(end.column - start.column), Math.abs(end.row - start.row));
    for (let index = 0; index <= distance; index += 1) {
      clearCells.add(cellKey(start.column + columnStep * index, start.row + rowStep * index));
    }
  }

  function clearRoute(route, clearCells) {
    for (let index = 0; index < route.length - 1; index += 1) clearRouteSegment(route[index], route[index + 1], clearCells);
  }

  function generateGuaranteedRoutes() {
    const player = spawnCells.player;
    const enemy = spawnCells.enemy;
    const firstBend = randomInteger(7, 8);
    const secondBend = randomInteger(3, 4);
    const middleColumn = randomInteger(8, 9);
    const lowerBend = randomInteger(4, 5);
    const sideColumn = randomInteger(5, 6);
    const thirdColumn = randomInteger(11, 12);
    const finalColumn = randomInteger(15, 16);
    return [
      [player, { column: 1, row: firstBend }, { column: 4, row: firstBend }, { column: 4, row: secondBend }, { column: middleColumn, row: secondBend }, { column: middleColumn, row: 1 }, enemy],
      [player, { column: 1, row: lowerBend }, { column: sideColumn, row: lowerBend }, { column: sideColumn, row: 2 }, { column: thirdColumn, row: 2 }, { column: thirdColumn, row: 1 }, enemy],
      [player, { column: 3, row: 10 }, { column: 3, row: 9 }, { column: 8, row: 9 }, { column: 8, row: 6 }, { column: finalColumn, row: 6 }, { column: finalColumn, row: 1 }, enemy],
    ];
  }

  function generateArena() {
    const routes = generateGuaranteedRoutes();
    const clearCells = new Set();
    routes.forEach((route) => clearRoute(route, clearCells));
    [...clearCells].forEach((key) => {
      const [column, row] = key.split(":").map(Number);
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          const nearbyColumn = column + columnOffset;
          const nearbyRow = row + rowOffset;
          if (nearbyColumn >= 0 && nearbyColumn < grid.columns && nearbyRow >= 0 && nearbyRow < grid.rows) clearCells.add(cellKey(nearbyColumn, nearbyRow));
        }
      }
    });
    [spawnCells.player, spawnCells.enemy].forEach((spawn) => {
      for (let column = spawn.column - 1; column <= spawn.column + 1; column += 1) {
        for (let row = spawn.row - 1; row <= spawn.row + 1; row += 1) clearCells.add(cellKey(column, row));
      }
    });
    arenaBlocks = [];
    blockLookup = new Map();
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        if (clearCells.has(cellKey(column, row)) || Math.random() > .31) continue;
        const roll = Math.random();
        const type = roll < .16 ? "monolith" : roll < .47 ? "fortified" : "regular";
        const definition = wallTypes[type];
        const block = { column, row, type, hitPoints: definition.hitPoints, maxHitPoints: definition.hitPoints };
        arenaBlocks.push(block);
        blockLookup.set(cellKey(column, row), block);
      }
    }
    game.routes = routes;
  }

  function getBlockAtPosition(x, y) {
    const column = Math.floor(x / grid.size);
    const row = Math.floor((y - grid.top) / grid.size);
    return blockLookup.get(cellKey(column, row)) || null;
  }

  function getCellFromPosition(x, y) {
    return {
      column: clamp(Math.floor(x / grid.size), 0, grid.columns - 1),
      row: clamp(Math.floor((y - grid.top) / grid.size), 0, grid.rows - 1),
    };
  }

  function findOpenPath(from, to) {
    const start = getCellFromPosition(from.x, from.y);
    const target = getCellFromPosition(to.x, to.y);
    const startKey = cellKey(start.column, start.row);
    const targetKey = cellKey(target.column, target.row);
    const queue = [start];
    const previous = new Map([[startKey, null]]);
    const offsets = [{ column: 0, row: -1 }, { column: 1, row: 0 }, { column: 0, row: 1 }, { column: -1, row: 0 }];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      const currentKey = cellKey(current.column, current.row);
      if (currentKey === targetKey) break;
      offsets.forEach((offset) => {
        const column = current.column + offset.column;
        const row = current.row + offset.row;
        const key = cellKey(column, row);
        if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows || previous.has(key) || blockLookup.has(key)) return;
        previous.set(key, currentKey);
        queue.push({ column, row });
      });
    }
    if (!previous.has(targetKey)) return [];
    const path = [];
    let cursor = targetKey;
    while (cursor && cursor !== startKey) {
      const [column, row] = cursor.split(":").map(Number);
      path.unshift({ column, row });
      cursor = previous.get(cursor);
    }
    return path;
  }

  function nextBotWaypoint(enemy, target, delta) {
    enemy.aiPathTimer = (enemy.aiPathTimer || 0) - delta;
    if (enemy.aiPathTimer <= 0 || !Array.isArray(enemy.aiPath) || enemy.aiPath.length === 0) {
      enemy.aiPath = findOpenPath(enemy, target);
      enemy.aiPathTimer = enemy.alex ? .24 : .52;
    }
    while (enemy.aiPath.length > 0) {
      const waypoint = cellCenter(enemy.aiPath[0]);
      if (Math.hypot(enemy.x - waypoint.x, enemy.y - waypoint.y) > 10) return waypoint;
      enemy.aiPath.shift();
    }
    return target;
  }
  const directions = {
    up: { x: 0, y: -1, angle: -Math.PI / 2, key: "KeyW" },
    right: { x: 1, y: 0, angle: 0, key: "KeyD" },
    down: { x: 0, y: 1, angle: Math.PI / 2, key: "KeyS" },
    left: { x: -1, y: 0, angle: Math.PI, key: "KeyA" },
  };
  const game = {
    active: false, ended: false, player: null, enemy: null, projectiles: [], particles: [], explosions: [],
    keys: new Set(), keyOrder: [], lastTime: 0,
    round: 0, animationFrame: 0, shake: 0,
  };

  function createTank(spec, x, y, enemy = false) {
    const source = enemy ? {
      ...spec,
      barrels: spec.barrels ?? (spec.alex ? 3 : spec.body === "twin" ? 2 : 1),
      bullet: spec.bullet ?? (spec.alex ? "nova" : "plasma"),
      bulletSpeed: spec.bulletSpeed ?? (spec.alex ? 390 : 315),
    } : spec;
    return {
      ...source, x, y, enemy, maxHp: source.hp, hp: source.hp, angle: enemy ? Math.PI : 0,
      bodyAngle: enemy ? Math.PI : 0, direction: enemy ? "left" : "right",
      radius: ["heavy", "super", "sturmtiger"].includes(source.body) ? 29 : 24,
      cooldown: 0, hurt: 0, lastShot: 0, aiTurnTimer: 0, aiRouteIndex: 0, aiTacticTimer: 0,
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

  function drawBlock(block) {
    const rectangle = blockRect(block);
    const definition = wallTypes[block.type];
    ctx.save();
    ctx.shadowColor = definition.edge;
    ctx.shadowBlur = block.type === "monolith" ? 9 : 14;
    ctx.fillStyle = "#17062e";
    ctx.fillRect(rectangle.x + 2, rectangle.y + 2, rectangle.width - 4, rectangle.height - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = definition.color;
    ctx.globalAlpha = block.type === "monolith" ? .76 : .68;
    ctx.fillRect(rectangle.x + 6, rectangle.y + 6, rectangle.width - 12, rectangle.height - 12);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = definition.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(rectangle.x + 3, rectangle.y + 3, rectangle.width - 6, rectangle.height - 6);
    if (block.type === "monolith") {
      ctx.strokeStyle = "rgba(218,235,255,.45)";
      ctx.beginPath(); ctx.moveTo(rectangle.x + 10, rectangle.y + 10); ctx.lineTo(rectangle.x + 38, rectangle.y + 38); ctx.moveTo(rectangle.x + 38, rectangle.y + 10); ctx.lineTo(rectangle.x + 10, rectangle.y + 38); ctx.stroke();
    } else {
      const segments = block.maxHitPoints;
      for (let segment = 0; segment < segments; segment += 1) {
        ctx.fillStyle = segment < Math.ceil(block.hitPoints) ? definition.edge : "rgba(0,0,0,.38)";
        ctx.fillRect(rectangle.x + 8 + segment * 8, rectangle.y + rectangle.height - 11, 5, 4);
      }
    }
    ctx.restore();
  }

  function tankProfile(body) {
    const profiles = {
      light: { width: 43, length: 49, turret: 22, barrel: 38 },
      twin: { width: 46, length: 53, turret: 24, barrel: 38 },
      heavy: { width: 53, length: 61, turret: 27, barrel: 40 },
      flame: { width: 42, length: 51, turret: 21, barrel: 42 },
      sturmtiger: { width: 55, length: 65, turret: 29, barrel: 31 },
      object: { width: 50, length: 60, turret: 27, barrel: 44 },
      rail: { width: 39, length: 62, turret: 20, barrel: 66 },
      super: { width: 55, length: 64, turret: 31, barrel: 42 },
    };
    return profiles[body] || profiles.light;
  }

  function drawTank(tank, alpha = 1) {
    const color = tank.color || "#ff64bd";
    const profile = tankProfile(tank.body);
    const { width, length, turret, barrel: barrelLength } = profile;
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
    if (tank.body === "object") {
      ctx.beginPath(); ctx.moveTo(-length / 2 + 4, -width / 2 + 5); ctx.lineTo(length / 2 - 4, -width / 2 + 11); ctx.lineTo(length / 2 - 4, width / 2 - 7); ctx.lineTo(-length / 2 + 4, width / 2 - 5); ctx.closePath(); ctx.fill();
    } else if (tank.body === "sturmtiger") {
      ctx.fillRect(-length / 2 + 3, -width / 2 + 5, length - 6, width - 10);
    } else {
      ctx.fillRect(-length / 2 + 5, -width / 2 + 6, length - 10, width - 12);
    }
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
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#25064d";
    if (tank.body === "sturmtiger") ctx.fillRect(-turret, -turret + 5, turret * 2, turret * 2 - 10);
    else if (tank.body === "object") { ctx.beginPath(); ctx.moveTo(-turret, turret - 2); ctx.lineTo(-turret + 10, -turret); ctx.lineTo(turret - 7, -turret); ctx.lineTo(turret, turret - 2); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 0, turret, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;
    const gap = tank.body === "super" ? 10 : 8;
    for (let barrel = 0; barrel < tank.barrels; barrel += 1) {
      const offset = (barrel - (tank.barrels - 1) / 2) * gap;
      ctx.fillStyle = color;
      ctx.fillRect(turret - 4, offset - (tank.body === "sturmtiger" ? 6 : 3), barrelLength, tank.body === "sturmtiger" ? 12 : 6);
      ctx.fillStyle = "#ffe8ff";
      ctx.fillRect(turret + barrelLength - 8, offset - 1.5, tank.body === "rail" ? 16 : 8, 3);
    }
    if (tank.body === "flame") { ctx.fillStyle = "#ffe86f"; ctx.beginPath(); ctx.moveTo(turret + barrelLength + 6, 0); ctx.lineTo(turret + barrelLength - 5, -8); ctx.lineTo(turret + barrelLength - 5, 8); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = tank.enemy ? "#ffdee9" : "#d9fbff";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawShowcase() {
    const player = createTank(getTank(), cellCenter(spawnCells.player).x, cellCenter(spawnCells.player).y);
    const enemy = createTank(difficulties[ui.difficulty.value], cellCenter(spawnCells.enemy).x, cellCenter(spawnCells.enemy).y, true);
    setTankDirection(enemy, "left");
    drawTank(player, .92);
    drawTank(enemy, .92);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function collidesAt(tank, x, y) {
    if (x < tank.radius + 15 || x > arena.width - tank.radius - 15 || y < tank.radius + 15 || y > arena.height - tank.radius - 15) return true;
    return arenaBlocks.some((block) => {
      const rectangle = blockRect(block);
      const nearX = clamp(x, rectangle.x, rectangle.x + rectangle.width);
      const nearY = clamp(y, rectangle.y, rectangle.y + rectangle.height);
      return Math.hypot(x - nearX, y - nearY) < tank.radius + 3;
    });
  }

  function moveTank(tank, dx, dy) {
    if (!collidesAt(tank, tank.x + dx, tank.y)) tank.x += dx;
    if (!collidesAt(tank, tank.x, tank.y + dy)) tank.y += dy;
  }

  function setTankDirection(tank, direction) {
    const vector = directions[direction];
    if (!vector) return;
    tank.direction = direction;
    tank.angle = vector.angle;
    tank.bodyAngle = vector.angle;
  }

  function canMoveInDirection(tank, direction, distance = 16) {
    const vector = directions[direction];
    return Boolean(vector) && !collidesAt(tank, tank.x + vector.x * distance, tank.y + vector.y * distance);
  }

  function moveTankInDirection(tank, direction, distance) {
    const vector = directions[direction];
    if (!vector || !canMoveInDirection(tank, direction, Math.max(4, distance))) return false;
    moveTank(tank, vector.x * distance, vector.y * distance);
    return true;
  }

  function directionToward(from, target) {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "down" : "up");
  }

  function playerInputDirection() {
    for (let index = game.keyOrder.length - 1; index >= 0; index -= 1) {
      const key = game.keyOrder[index];
      if (!game.keys.has(key)) continue;
      return Object.keys(directions).find((direction) => directions[direction].key === key);
    }
    return null;
  }

  function updatePlayer(delta) {
    const player = game.player;
    if (!player) return;
    const direction = playerInputDirection();
    if (direction) {
      const vector = directions[direction];
      setTankDirection(player, direction);
      const moved = moveTankInDirection(player, direction, player.speed * delta);
      player.vx = moved ? vector.x * player.speed : 0;
      player.vy = moved ? vector.y * player.speed : 0;
    } else {
      player.vx = 0;
      player.vy = 0;
    }
    player.cooldown = Math.max(0, player.cooldown - delta * 1000);
    player.hurt = Math.max(0, player.hurt - delta);
  }

  function axisLineOfSight(from, to, direction) {
    const vector = directions[direction];
    const perpendicular = vector.x ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
    if (perpendicular > Math.max(16, to.radius * .8)) return false;
    const distance = vector.x ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y);
    const samples = Math.max(2, Math.ceil(distance / 12));
    for (let step = 1; step < samples; step += 1) {
      const fraction = step / samples;
      if (pointInsideObstacle(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction)) return false;
    }
    return true;
  }

  function chooseBotDirection(tank, target) {
    const dx = target.x - tank.x;
    const dy = target.y - tank.y;
    const horizontal = dx >= 0 ? "right" : "left";
    const vertical = dy >= 0 ? "down" : "up";
    const primary = Math.abs(dx) >= Math.abs(dy) ? [horizontal, vertical] : [vertical, horizontal];
    const fallback = [tank.direction, "up", "right", "down", "left"];
    const options = [...new Set([...primary, ...fallback])];
    return options.find((direction) => canMoveInDirection(tank, direction)) || tank.direction;
  }

  function alexTacticalTarget(enemy, player, delta) {
    const lanes = {
      siege: [{ x: 892, y: 78 }, { x: 892, y: 548 }, { x: 610, y: 548 }, { x: 610, y: 78 }],
      flank: [{ x: 870, y: 178 }, { x: 870, y: 540 }, { x: 555, y: 540 }, { x: 555, y: 178 }],
      sniper: [{ x: 870, y: 78 }, { x: 870, y: 548 }, { x: 90, y: 548 }, { x: 90, y: 78 }],
      assault: [{ x: player.x, y: clamp(player.y - 135, 72, 548) }, { x: clamp(player.x + 165, 72, 888), y: player.y }, { x: player.x, y: clamp(player.y + 135, 72, 548) }, { x: clamp(player.x - 165, 72, 888), y: player.y }],
    };
    const route = lanes[enemy.tactic] || lanes.assault;
    enemy.aiTacticTimer -= delta;
    const current = route[enemy.aiRouteIndex % route.length];
    if (enemy.aiTacticTimer <= 0 || Math.hypot(enemy.x - current.x, enemy.y - current.y) < 30) {
      enemy.aiRouteIndex = (enemy.aiRouteIndex + 1) % route.length;
      enemy.aiTacticTimer = enemy.tactic === "assault" ? .7 : 1.35;
    }
    return route[enemy.aiRouteIndex % route.length];
  }

  function updateEnemy(delta) {
    const enemy = game.enemy;
    const player = game.player;
    if (!enemy || !player || player.destroyed) return;
    enemy.cooldown = Math.max(0, enemy.cooldown - delta * 1000);
    enemy.hurt = Math.max(0, enemy.hurt - delta);
    const playerDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y) || 1;
    const desiredRange = Math.min(enemy.range * .7, enemy.tactic === "siege" ? 410 : enemy.tactic === "sniper" ? 560 : 330);
    let routeTarget = enemy.alex ? alexTacticalTarget(enemy, player, delta) : player;
    if (!enemy.alex && playerDistance < desiredRange) {
      routeTarget = { x: enemy.x - Math.sign(player.x - enemy.x || 1) * 130, y: enemy.y - Math.sign(player.y - enemy.y || 1) * 130 };
    }
    const waypoint = nextBotWaypoint(enemy, routeTarget, delta);
    enemy.aiTurnTimer -= delta;
    if (enemy.aiTurnTimer <= 0 || !canMoveInDirection(enemy, enemy.direction)) {
      setTankDirection(enemy, chooseBotDirection(enemy, waypoint));
      enemy.aiTurnTimer = enemy.alex ? .18 : .42;
    }
    const mustKeepMoving = enemy.alex || playerDistance > desiredRange || !axisLineOfSight(enemy, player, directionToward(enemy, player));
    if (mustKeepMoving) {
      const moved = moveTankInDirection(enemy, enemy.direction, enemy.speed * delta);
      if (!moved) enemy.aiTurnTimer = 0;
    }
    const fireDirection = directionToward(enemy, player);
    const canFire = playerDistance <= enemy.range && axisLineOfSight(enemy, player, fireDirection);
    if (canFire) {
      setTankDirection(enemy, fireDirection);
      fireTank(enemy);
    }
  }

  function startBattle() {
    const selectedTank = getTank();
    const difficulty = difficulties[ui.difficulty.value];
    const enemyBuild = difficulty.alex ? createAlexBuild() : difficulty;
    game.active = true;
    game.ended = false;
    game.round += 1;
    game.projectiles = [];
    game.particles = [];
    game.explosions = [];
    generateArena();
    const playerSpawn = cellCenter(spawnCells.player);
    const enemySpawn = cellCenter(spawnCells.enemy);
    game.player = createTank(selectedTank, playerSpawn.x, playerSpawn.y);
    game.enemy = createTank(enemyBuild, enemySpawn.x, enemySpawn.y, true);
    ui.stageOverlay.classList.add("hidden");
    ui.playerName.textContent = selectedTank.name;
    ui.enemyName.textContent = enemyBuild.enemyName || difficulty.enemy;
    ui.enemyHealthText.textContent = `${enemyBuild.hp} / ${enemyBuild.hp}`;
    ui.playerHealthText.textContent = `${selectedTank.hp} / ${selectedTank.hp}`;
    ui.playerHealth.style.width = "100%";
    ui.enemyHealth.style.width = "100%";
    ui.reloadMeter.style.width = "0%";
    flashStatus(enemyBuild.tacticName ? `АЛЕКС // ${enemyBuild.tacticName.toUpperCase()}` : `${difficulty.label.toUpperCase()} // НАЧАЛО`);
  }

  function pointInsideObstacle(x, y) {
    return Boolean(getBlockAtPosition(x, y));
  }

  function spawnParticles(x, y, color, amount = 8, speed = 90) {
    for (let index = 0; index < amount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (.35 + Math.random());
      game.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, color, life: .28 + Math.random() * .35, maxLife: .65, size: 2 + Math.random() * 4 });
    }
  }

  function fireTank(tank) {
    if (tank.cooldown > 0) return false;
    const count = tank.bullet === "flame" ? 4 : tank.barrels;
    const projectileSize = tank.bullet === "rocket" || tank.bullet === "shell" ? 8 : tank.bullet === "nova" ? 6 : 4;
    const muzzle = tank.radius + (tank.body === "rail" ? 43 : 26);
    const direction = directions[tank.direction];
    const lateral = { x: -direction.y, y: direction.x };
    tank.cooldown = tank.reload;
    tank.lastShot = performance.now();
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * (tank.bullet === "flame" ? 8 : 9);
      const speed = tank.bulletSpeed;
      game.projectiles.push({
        owner: tank.enemy ? "enemy" : "player", x: tank.x + direction.x * muzzle + lateral.x * offset, y: tank.y + direction.y * muzzle + lateral.y * offset,
        vx: direction.x * speed, vy: direction.y * speed, angle: tank.angle, damage: tank.damage * (count > 1 && tank.bullet !== "flame" ? .92 : 1),
        radius: projectileSize, type: tank.bullet, color: tank.color, life: tank.range / speed, wallPower: Math.max(.35, tank.damage / tankCatalog[0].damage),
        explosion: tank.bullet === "rocket" ? tileSize : tank.bullet === "shell" ? 37 : tank.bullet === "nova" ? 28 : 0,
      });
    }
    spawnParticles(tank.x + direction.x * muzzle, tank.y + direction.y * muzzle, tank.color, tank.bullet === "rail" ? 14 : 6, 75);
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

  function removeBlock(block) {
    blockLookup.delete(cellKey(block.column, block.row));
    arenaBlocks = arenaBlocks.filter((candidate) => candidate !== block);
  }

  function damageBlock(block, projectile, multiplier = 1) {
    if (!block || block.type === "monolith") return;
    block.hitPoints -= projectile.wallPower * multiplier;
    const rectangle = blockRect(block);
    spawnParticles(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2, wallTypes[block.type].edge, 5, 58);
    if (block.hitPoints <= 0) {
      spawnParticles(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2, projectile.color, 16, 130);
      removeBlock(block);
    }
  }

  function damageBlocksInBlast(projectile, ignoredBlock) {
    if (!projectile.explosion) return;
    arenaBlocks.slice().forEach((block) => {
      if (block === ignoredBlock || block.type === "monolith") return;
      const center = cellCenter(block);
      const distance = Math.hypot(center.x - projectile.x, center.y - projectile.y);
      if (distance <= projectile.explosion + grid.size * .7) damageBlock(block, projectile, Math.max(.3, 1 - distance / (projectile.explosion + grid.size)));
    });
  }

  function explodeProjectile(projectile, directTarget, directBlock = null) {
    spawnParticles(projectile.x, projectile.y, projectile.color, projectile.explosion ? 18 : 5, projectile.explosion ? 150 : 60);
    if (!projectile.explosion) return;
    game.explosions.push({ x: projectile.x, y: projectile.y, radius: projectile.explosion, color: projectile.color, life: .42, maxLife: .42 });
    damageBlocksInBlast(projectile, directBlock);
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
      const hitBlock = !hitTank ? getBlockAtPosition(projectile.x, projectile.y) : null;
      if (hitBlock) damageBlock(hitBlock, projectile);
      const expired = projectile.life <= 0 || projectile.x < 0 || projectile.x > arena.width || projectile.y < 0 || projectile.y > arena.height;
      if (hitTank || hitBlock || expired) {
        explodeProjectile(projectile, hitTank ? target : null, hitBlock);
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
    for (let index = game.explosions.length - 1; index >= 0; index -= 1) {
      game.explosions[index].life -= delta;
      if (game.explosions[index].life <= 0) game.explosions.splice(index, 1);
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

  function drawExplosions() {
    game.explosions.forEach((explosion) => {
      const progress = 1 - explosion.life / explosion.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = explosion.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = explosion.color;
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(explosion.x, explosion.y, explosion.radius * (.3 + progress * .7), 0, Math.PI * 2); ctx.stroke();
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
    arenaBlocks.forEach(drawBlock);
    if (game.active) {
      drawTank(game.player);
      drawTank(game.enemy);
      game.projectiles.forEach(drawProjectile);
      drawExplosions();
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
      game.keyOrder = game.keyOrder.filter((key) => key !== event.code);
      game.keyOrder.push(event.code);
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (game.active && !game.ended) fireTank(game.player);
    }
  });
  window.addEventListener("keyup", (event) => {
    game.keys.delete(event.code);
    game.keyOrder = game.keyOrder.filter((key) => key !== event.code);
  });
  canvas.addEventListener("pointerdown", () => {
    if (game.active && !game.ended) fireTank(game.player);
  });
  canvas.addEventListener("click", () => {
    if (game.active && !game.ended) fireTank(game.player);
  });
  document.querySelector("#playButton").addEventListener("click", startBattle);
  ui.resultButton.addEventListener("click", returnToHangar);

  generateArena();
  updateMenu();
  renderGarage();
  game.animationFrame = requestAnimationFrame(animationLoop);
})();
