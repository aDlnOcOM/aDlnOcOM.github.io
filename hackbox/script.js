// Управляет конструктором вымышленного штамма, мировой картой, ходами кампании и адаптациями HackBox.
(() => {
  const element = id => document.getElementById(id);
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const randomItem = items => items[Math.floor(Math.random() * items.length)];

  const ARCHETYPES = {
    specter: { name: "Спектр", description: "Осторожная схема: копит импульс в затенённых узлах и медленнее поднимает тревогу.", stealth: 1, speed: 0, resilience: 0 },
    swarm: { name: "Улей", description: "Роевая схема: быстрее размыкает связи, но создаёт заметные всплески сигнала.", stealth: -1, speed: 1, resilience: 0 },
    prism: { name: "Призма", description: "Адаптивная схема: удерживает нестабильные маршруты и лучше переживает блокировки.", stealth: 0, speed: 0, resilience: 1 }
  };

  const APPLICATORS = {
    relay: { name: "Релейная петля", description: "Связывает близкие узлы в предсказуемую цепь.", speed: 0, resilience: 0 },
    archive: { name: "Архивный импульс", description: "Преобразует случайный фон сети в короткие возможности.", speed: 1, resilience: -1 },
    fabric: { name: "Ткань узлов", description: "Формирует более устойчивые, но медленные связи.", speed: -1, resilience: 1 }
  };

  const WORLD_REGIONS = [
    { id: "north", code: "N", name: "Северные хребты", x: 7, y: 12, names: ["Нордвейл", "Лидора", "Фростин", "Рунвар", "Астен", "Керн", "Элвар", "Мерос", "Талвик", "Ильмар", "Бранта", "Сивер"] },
    { id: "west", code: "W", name: "Западные проливы", x: 10, y: 52, names: ["Аркадия", "Мерида", "Сольмар", "Вента", "Карро", "Умбра", "Галея", "Риона", "Ферра", "Тревис", "Каден", "Лорка"] },
    { id: "central", code: "C", name: "Центральный пояс", x: 41, y: 20, names: ["Кассия", "Аурелия", "Сильва", "Калия", "Орбита", "Вестра", "Новация", "Терран", "Лиор", "Бриам", "Окса", "Дория"] },
    { id: "east", code: "E", name: "Восточная дуга", x: 71, y: 12, names: ["Солария", "Пелагея", "Руно", "Айма", "Сандор", "Истра", "Кайо", "Вирра", "Нерос", "Амара", "Сейна", "Талас"] },
    { id: "south", code: "S", name: "Южная платформа", x: 40, y: 63, names: ["Новара", "Эстель", "Корон", "Мирас", "Ярра", "Элора", "Тинта", "Хавен", "Марен", "Керис", "Лума", "Фиора"] },
    { id: "ocean", code: "O", name: "Океанические цепи", x: 71, y: 62, names: ["Астер", "Дельта", "Орио", "Лагуна", "Рифа", "Кобальт", "Пасса", "Тирея", "Иона", "Вектор", "Каори", "Селин"] }
  ];

  const COUNTRIES = WORLD_REGIONS.flatMap((region, regionIndex) => region.names.map((name, index) => {
    const row = Math.floor(index / 4);
    const column = index % 4;
    return {
      id: `${region.id}-${index + 1}`,
      code: `${region.code}${String(index + 1).padStart(2, "0")}`,
      name,
      region: region.name,
      x: region.x + column * 6 + (row === 1 ? 1.4 : 0),
      y: region.y + row * 8,
      activity: 1 + (index * 2 + regionIndex * 3) % 5,
      noise: 1 + (index * 3 + regionIndex) % 5,
      defense: 1 + (index * 4 + regionIndex * 2) % 5
    };
  }));

  const createWorldLinks = () => {
    const links = [];
    WORLD_REGIONS.forEach(region => {
      const localCountries = COUNTRIES.filter(country => country.id.startsWith(`${region.id}-`));
      localCountries.forEach((country, index) => {
        if (index % 4 !== 3) links.push([country.id, localCountries[index + 1].id]);
        if (index < 8) links.push([country.id, localCountries[index + 4].id]);
      });
    });
    [[0, 1], [0, 2], [1, 2], [1, 4], [2, 3], [2, 4], [3, 5], [4, 5], [2, 5]].forEach(([firstRegion, secondRegion], index) => {
      const first = COUNTRIES.filter(country => country.id.startsWith(`${WORLD_REGIONS[firstRegion].id}-`));
      const second = COUNTRIES.filter(country => country.id.startsWith(`${WORLD_REGIONS[secondRegion].id}-`));
      links.push([first[(index * 3 + 2) % first.length].id, second[(index * 5 + 4) % second.length].id]);
    });
    return links;
  };

  const LINKS = createWorldLinks();

  const UPGRADES = [
    { id: "veil", cost: 2, name: "Вуаль шума", effect: "−1 к вниманию контура за цикл", branch: "Скрытность" },
    { id: "cascade", cost: 3, name: "Каскадный резонанс", effect: "+11% к шансу эха", branch: "Темп" },
    { id: "anchor", cost: 3, name: "Якорь паттерна", effect: "сложнее закрыть отмеченный узел", branch: "Устойчивость" },
    { id: "relayMap", cost: 4, name: "Память маршрутов", effect: "дополнительный выбор связи", branch: "Навигация" },
    { id: "chorus", cost: 3, name: "Хор отражений", effect: "+1 сигнальный ресурс при новой отметке", branch: "Ресурс" },
    { id: "quietCore", cost: 5, name: "Тихое ядро", effect: "стартовые страны реже вызывают тревогу", branch: "Скрытность" },
    { id: "switchback", cost: 5, name: "Смена грани", effect: "фоновые события чаще помогают маршруту", branch: "Навигация" },
    { id: "lattice", cost: 6, name: "Решётка доверия", effect: "снижение эффекта закрытия связей", branch: "Устойчивость" }
  ];

  const countriesById = new Map(COUNTRIES.map(country => [country.id, country]));
  const countryStates = () => Object.fromEntries(COUNTRIES.map(country => [country.id, "open"]));
  const state = {
    archetype: "specter",
    applicator: "relay",
    stealth: 3,
    speed: 3,
    resilience: 2,
    selectedCountry: null,
    countries: countryStates(),
    started: false,
    active: false,
    turn: 0,
    signal: 4,
    alert: 8,
    upgrades: [],
    log: ["Песочница готова. Выбери страну старта на мировой карте."]
  };

  function hasUpgrade(id) {
    return state.upgrades.includes(id);
  }

  function effectiveStats() {
    const archetype = ARCHETYPES[state.archetype];
    const applicator = APPLICATORS[state.applicator];
    return {
      stealth: clamp(state.stealth + archetype.stealth - (hasUpgrade("quietCore") ? 1 : 0), 1, 8),
      speed: clamp(state.speed + archetype.speed + applicator.speed, 1, 8),
      resilience: clamp(state.resilience + archetype.resilience + applicator.resilience + (hasUpgrade("anchor") ? 1 : 0), 1, 8)
    };
  }

  function pushLog(message) {
    state.log.unshift(message);
    state.log = state.log.slice(0, 12);
  }

  function updatePreview() {
    const stats = effectiveStats();
    const name = element("strain-name").value.trim().toUpperCase() || "БЕЗЫМЯННАЯ СХЕМА";
    const archetype = ARCHETYPES[state.archetype];
    const applicator = APPLICATORS[state.applicator];
    element("preview-name").textContent = name;
    element("preview-stealth").textContent = String(stats.stealth).padStart(2, "0");
    element("preview-speed").textContent = String(stats.speed).padStart(2, "0");
    element("preview-resilience").textContent = String(stats.resilience).padStart(2, "0");
    element("preview-description").textContent = `${archetype.description} Аппликатор: ${applicator.name.toLowerCase()}.`;
    element("strain-id").textContent = `HB-${String(7 + stats.stealth * 3 + stats.speed).padStart(3, "0")}`;
    ["stealth", "speed", "resilience"].forEach(key => {
      element(`${key}-value`).textContent = String(state[key]).padStart(2, "0");
    });
  }

  function renderCountryProfile() {
    const profile = element("country-profile");
    const country = countriesById.get(state.selectedCountry);
    if (!country) {
      profile.innerHTML = "<span>СТРАНА СТАРТА</span><b>ВЫБЕРИ УЗЕЛ НА КАРТЕ</b><p>Каждая страна по-разному влияет на темп сигнала, непредсказуемые события и силу защитного контура.</p>";
      return;
    }
    profile.innerHTML = `<span>СТРАНА СТАРТА / ${country.code}</span><b>${country.name.toUpperCase()}</b><p>Игровой профиль страны. Числа не описывают реальные государства или их системы.</p><div class="country-metrics"><span>АКТИВНОСТЬ<b>${country.activity}/5</b></span><span>ФОН<b>${country.noise}/5</b></span><span>КОНТУР<b>${country.defense}/5</b></span></div>`;
  }

  function countryNeighbors(id) {
    return LINKS.flatMap(([first, second]) => first === id ? [second] : second === id ? [first] : []);
  }

  function renderWorldMap() {
    const map = element("network-map");
    map.innerHTML = "";
    const bounds = map.getBoundingClientRect();
    LINKS.forEach(([firstId, secondId]) => {
      const first = countriesById.get(firstId);
      const second = countriesById.get(secondId);
      const x1 = bounds.width * first.x / 100;
      const y1 = bounds.height * first.y / 100;
      const x2 = bounds.width * second.x / 100;
      const y2 = bounds.height * second.y / 100;
      const link = document.createElement("i");
      link.className = "world-link";
      link.style.left = `${x1}px`;
      link.style.top = `${y1}px`;
      link.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
      link.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
      map.appendChild(link);
    });
    COUNTRIES.forEach(country => {
      const node = document.createElement("button");
      const nodeState = state.countries[country.id];
      const selected = state.selectedCountry === country.id;
      node.type = "button";
      node.className = `network-node ${nodeState} ${!state.started && selected ? "start-candidate" : ""}`;
      node.style.left = `calc(${country.x}% - 15px)`;
      node.style.top = `calc(${country.y}% - 15px)`;
      node.disabled = state.started;
      node.setAttribute("aria-pressed", String(selected));
      node.setAttribute("aria-label", `${country.name}: активность ${country.activity} из 5, фон ${country.noise} из 5, контур ${country.defense} из 5`);
      node.title = `${country.name} · активность ${country.activity}/5 · фон ${country.noise}/5 · контур ${country.defense}/5`;
      node.innerHTML = `<small>${country.code}</small>`;
      node.addEventListener("click", () => selectStartCountry(country.id));
      map.appendChild(node);
    });
  }

  function renderCampaign() {
    const influenced = Object.values(state.countries).filter(value => value === "seed" || value === "infected").length;
    const country = countriesById.get(state.selectedCountry);
    element("turn-count").textContent = String(state.turn).padStart(2, "0");
    element("campaign-state").textContent = state.active ? "СИГНАЛ В ПУТИ" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : "ОЖИДАНИЕ";
    element("network-readout").textContent = state.started ? `${influenced} ИЗ ${COUNTRIES.length} ОТМЕЧЕНО` : country ? `СТАРТ: ${country.name.toUpperCase()}` : "ВЫБЕРИ СТРАНУ СТАРТА";
    element("signal-points").textContent = String(state.signal).padStart(2, "0");
    element("alert-value").textContent = `${Math.round(state.alert)}%`;
    element("alert-meter").style.width = `${state.alert}%`;
    element("alert-text").textContent = state.alert < 32 ? "Контур заметил слабый фон, но пока не понимает его рисунок." : state.alert < 67 ? "Защитный контур анализирует необычные связи. Тихий дрейф особенно важен." : "Контур готовит изоляцию маршрутов. Следующий цикл может закрыть часть сети.";
    element("advance-turn").disabled = !state.active;
    element("launch-simulation").disabled = state.started || !state.selectedCountry;
    element("launch-simulation").textContent = state.started ? "Сценарий запущен" : state.selectedCountry ? "Запустить симуляцию →" : "Выбери страну старта";
    renderCountryProfile();
    renderWorldMap();
  }

  function renderUpgrades() {
    const grid = element("upgrade-grid");
    grid.innerHTML = "";
    UPGRADES.forEach(upgrade => {
      const unlocked = hasUpgrade(upgrade.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `upgrade-card ${unlocked ? "unlocked" : ""}`;
      button.disabled = unlocked || !state.started || state.signal < upgrade.cost;
      button.innerHTML = `<small>${upgrade.branch.toUpperCase()} · ${unlocked ? "УСТАНОВЛЕНО" : `${upgrade.cost} СИГНАЛА`}</small><strong>${upgrade.name}</strong><em>${upgrade.effect}</em>`;
      button.addEventListener("click", () => buyUpgrade(upgrade));
      grid.appendChild(button);
    });
    element("upgrade-note").textContent = state.started ? `${state.signal} СИГНАЛА ДОСТУПНО` : "ЗАПУСТИ СЦЕНАРИЙ";
  }

  function renderLog() {
    const log = element("event-log");
    log.innerHTML = "";
    state.log.forEach((message, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<time>ЦИКЛ ${String(Math.max(0, state.turn - index)).padStart(2, "0")}</time>${message}`;
      log.appendChild(item);
    });
    element("log-status").textContent = state.active ? "СИГНАЛ ЖИВОЙ" : state.started ? "КОНТУР ОСТАНОВЛЕН" : "ПЕСКИ ГОТОВЫ";
  }

  function renderAll() {
    updatePreview();
    renderCampaign();
    renderUpgrades();
    renderLog();
  }

  function selectStartCountry(id) {
    if (state.started) return;
    state.selectedCountry = id;
    const country = countriesById.get(id);
    pushLog(`Стартовая точка выбрана: ${country.name}. Профиль загружен в песочницу.`);
    renderAll();
  }

  function launchSimulation() {
    if (!state.selectedCountry || state.started) return;
    state.started = true;
    state.active = true;
    state.countries[state.selectedCountry] = "seed";
    const country = countriesById.get(state.selectedCountry);
    state.alert = clamp(5 + country.defense * 2 - effectiveStats().stealth, 3, 25);
    pushLog(`Сценарий запущен в стране «${country.name}». Первый импульс стабилен.`);
    renderAll();
  }

  function buyUpgrade(upgrade) {
    if (!state.started || hasUpgrade(upgrade.id) || state.signal < upgrade.cost) return;
    state.signal -= upgrade.cost;
    state.upgrades.push(upgrade.id);
    pushLog(`Адаптация «${upgrade.name}» встроена в паттерн.`);
    renderAll();
  }

  function activeCountries() {
    return COUNTRIES.filter(country => ["seed", "infected"].includes(state.countries[country.id]));
  }

  function openNeighbors() {
    const targets = new Set();
    activeCountries().forEach(country => {
      countryNeighbors(country.id).forEach(neighborId => {
        if (state.countries[neighborId] === "open") targets.add(neighborId);
      });
    });
    return [...targets].map(id => countriesById.get(id));
  }

  function resolveBackgroundEvent() {
    const country = randomItem(activeCountries());
    const chance = .13 + country.noise * .055 + (hasUpgrade("switchback") ? .12 : 0);
    if (Math.random() > chance) return 0;
    const events = [
      `Фоновая активность в ${country.name} усилила один из маршрутов.`,
      `Обычные сигналы пользователей в ${country.name} создали короткое окно для эха.`,
      `Внутренний ритм сети ${country.name} изменился: контур ненадолго потерял точность.`
    ];
    pushLog(randomItem(events));
    state.alert = clamp(state.alert - 4, 0, 100);
    return .17;
  }

  function containSignal() {
    if (state.alert < 53) return;
    const candidates = activeCountries().filter(country => country.id !== state.selectedCountry);
    if (!candidates.length) return;
    const target = candidates.sort((first, second) => second.defense - first.defense)[0];
    const resistance = effectiveStats().resilience + (hasUpgrade("lattice") ? 2 : 0);
    const chance = .08 + target.defense * .035 - resistance * .025;
    if (Math.random() < chance) {
      state.countries[target.id] = "contained";
      pushLog(`Контур защиты страны «${target.name}» закрыл один отмеченный узел.`);
    }
  }

  function advanceCycle() {
    if (!state.active) return;
    state.turn += 1;
    const stats = effectiveStats();
    const targets = openNeighbors();
    const backgroundBonus = resolveBackgroundEvent();
    const attempts = Math.min(targets.length, 1 + Math.floor(stats.speed / 4) + (hasUpgrade("relayMap") ? 1 : 0));
    let newSignals = 0;
    const sourceActivity = activeCountries().reduce((total, country) => total + country.activity, 0) / Math.max(1, activeCountries().length);
    for (let index = 0; index < attempts; index += 1) {
      const candidates = openNeighbors();
      if (!candidates.length) break;
      const target = randomItem(candidates);
      const chance = .18 + stats.speed * .052 + sourceActivity * .025 + backgroundBonus + (hasUpgrade("cascade") ? .11 : 0) - target.defense * .035;
      if (Math.random() < chance) {
        state.countries[target.id] = "infected";
        newSignals += 1;
        pushLog(`Эхо достигло страны «${target.name}». Её игровой профиль добавлен к карте.`);
      }
    }
    if (!newSignals) pushLog("Связи дрожат, но контур не пропускает новый устойчивый импульс в этом цикле.");
    state.signal += 1 + newSignals + (newSignals && hasUpgrade("chorus") ? 1 : 0);
    const averageDefense = activeCountries().reduce((total, country) => total + country.defense, 0) / Math.max(1, activeCountries().length);
    const awarenessStep = 3 + averageDefense * .56 - stats.stealth * .52 - (hasUpgrade("veil") ? 1.1 : 0);
    state.alert = clamp(state.alert + awarenessStep + newSignals * 2.2, 0, 100);
    containSignal();
    const influenced = activeCountries().length;
    if (influenced === COUNTRIES.length) {
      state.active = false;
      pushLog("Сценарий завершён: весь игровой мир отмечен сигналом до полной изоляции.");
    } else if (state.alert >= 100) {
      state.active = false;
      pushLog("Контур достиг максимальной готовности и закрыл сценарий. Попробуй другой старт или адаптацию.");
    }
    renderAll();
  }

  function resetSimulation() {
    state.selectedCountry = null;
    state.countries = countryStates();
    state.started = false;
    state.active = false;
    state.turn = 0;
    state.signal = 4;
    state.alert = 8;
    state.upgrades = [];
    state.log = ["Песочница сброшена. Выбери новую страну старта на мировой карте."];
    renderAll();
  }

  element("strain-name").addEventListener("input", updatePreview);
  ["stealth", "speed", "resilience"].forEach(key => {
    element(`${key}-input`).addEventListener("input", event => {
      state[key] = Number(event.target.value);
      updatePreview();
    });
  });
  element("archetype-options").addEventListener("click", event => {
    const button = event.target.closest("[data-archetype]");
    if (!button || state.started) return;
    state.archetype = button.dataset.archetype;
    document.querySelectorAll("[data-archetype]").forEach(option => {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    updatePreview();
  });
  element("applicator-options").addEventListener("click", event => {
    const button = event.target.closest("[data-applicator]");
    if (!button || state.started) return;
    state.applicator = button.dataset.applicator;
    document.querySelectorAll("[data-applicator]").forEach(option => {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    updatePreview();
  });
  element("launch-simulation").addEventListener("click", launchSimulation);
  element("advance-turn").addEventListener("click", advanceCycle);
  element("reset-simulation").addEventListener("click", resetSimulation);
  window.addEventListener("resize", renderWorldMap);

  renderAll();
})();
