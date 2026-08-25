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

  updateMenu();
  renderGarage();
})();
