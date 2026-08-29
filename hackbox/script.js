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

  const COUNTRY_SEEDS = [
    ["can", "CAN", "Канада", "Северная Америка", -106, 56], ["usa", "USA", "США", "Северная Америка", -98, 39], ["mex", "MEX", "Мексика", "Северная Америка", -102, 23], ["gtm", "GTM", "Гватемала", "Северная Америка", -90, 15], ["cub", "CUB", "Куба", "Северная Америка", -79, 22], ["hti", "HTI", "Гаити", "Северная Америка", -72, 19], ["dom", "DOM", "Доминиканская Республика", "Северная Америка", -70, 19], ["jam", "JAM", "Ямайка", "Северная Америка", -77, 18], ["pan", "PAN", "Панама", "Северная Америка", -80, 9], ["cri", "CRI", "Коста-Рика", "Северная Америка", -84, 10], ["blz", "BLZ", "Белиз", "Северная Америка", -88, 17], ["nic", "NIC", "Никарагуа", "Северная Америка", -86, 13],
    ["col", "COL", "Колумбия", "Южная Америка", -74, 4], ["ven", "VEN", "Венесуэла", "Южная Америка", -66, 7], ["ecu", "ECU", "Эквадор", "Южная Америка", -78, -1], ["per", "PER", "Перу", "Южная Америка", -75, -10], ["bol", "BOL", "Боливия", "Южная Америка", -64, -17], ["bra", "BRA", "Бразилия", "Южная Америка", -52, -10], ["pry", "PRY", "Парагвай", "Южная Америка", -58, -23], ["ury", "URY", "Уругвай", "Южная Америка", -56, -33], ["arg", "ARG", "Аргентина", "Южная Америка", -65, -35], ["chl", "CHL", "Чили", "Южная Америка", -71, -30],
    ["isl", "ISL", "Исландия", "Европа", -19, 65], ["irl", "IRL", "Ирландия", "Европа", -8, 53], ["gbr", "GBR", "Великобритания", "Европа", -2, 54], ["prt", "PRT", "Португалия", "Европа", -8, 39], ["esp", "ESP", "Испания", "Европа", -4, 40], ["fra", "FRA", "Франция", "Европа", 2, 46], ["deu", "DEU", "Германия", "Европа", 10, 51], ["ita", "ITA", "Италия", "Европа", 12, 42], ["nor", "NOR", "Норвегия", "Европа", 10, 62], ["swe", "SWE", "Швеция", "Европа", 17, 61], ["pol", "POL", "Польша", "Европа", 19, 52], ["rou", "ROU", "Румыния", "Европа", 25, 46], ["grc", "GRC", "Греция", "Европа", 22, 39], ["tur", "TUR", "Турция", "Европа", 35, 39], ["ukr", "UKR", "Украина", "Европа", 32, 49], ["fin", "FIN", "Финляндия", "Европа", 26, 64], ["ltu", "LTU", "Литва", "Европа", 24, 55], ["nld", "NLD", "Нидерланды", "Европа", 5, 52],
    ["mar", "MAR", "Марокко", "Африка", -6, 32], ["dza", "DZA", "Алжир", "Африка", 2, 28], ["tun", "TUN", "Тунис", "Африка", 9, 34], ["egy", "EGY", "Египет", "Африка", 30, 27], ["nga", "NGA", "Нигерия", "Африка", 8, 9], ["gha", "GHA", "Гана", "Африка", -1, 7], ["sen", "SEN", "Сенегал", "Африка", -14, 14], ["eth", "ETH", "Эфиопия", "Африка", 40, 9], ["ken", "KEN", "Кения", "Африка", 37, 0], ["tza", "TZA", "Танзания", "Африка", 35, -6], ["zaf", "ZAF", "ЮАР", "Африка", 25, -29], ["cod", "COD", "ДР Конго", "Африка", 23, -2], ["ago", "AGO", "Ангола", "Африка", 17, -12], ["mdg", "MDG", "Мадагаскар", "Африка", 47, -20],
    ["rus", "RUS", "Россия", "Азия", 90, 60], ["kaz", "KAZ", "Казахстан", "Азия", 68, 48], ["sau", "SAU", "Саудовская Аравия", "Азия", 45, 24], ["irn", "IRN", "Иран", "Азия", 53, 32], ["ind", "IND", "Индия", "Азия", 79, 22], ["pak", "PAK", "Пакистан", "Азия", 70, 30], ["chn", "CHN", "Китай", "Азия", 104, 35], ["mng", "MNG", "Монголия", "Азия", 103, 46], ["jpn", "JPN", "Япония", "Азия", 138, 37], ["kor", "KOR", "Республика Корея", "Азия", 127, 37], ["vnm", "VNM", "Вьетнам", "Азия", 108, 16], ["tha", "THA", "Таиланд", "Азия", 101, 15], ["idn", "IDN", "Индонезия", "Азия", 118, -3], ["phl", "PHL", "Филиппины", "Азия", 122, 13],
    ["aus", "AUS", "Австралия", "Океания", 134, -25], ["nzl", "NZL", "Новая Зеландия", "Океания", 174, -41], ["png", "PNG", "Папуа — Новая Гвинея", "Океания", 144, -6], ["fji", "FJI", "Фиджи", "Океания", 178, -17]
  ];

  const COUNTRIES = COUNTRY_SEEDS.map(([id, code, name, region, longitude, latitude], index) => ({
    id, code, name, region, longitude, latitude,
    x: (longitude + 180) / 3.6,
    y: (90 - latitude) / 1.8,
    activity: 1 + (index * 7 + 2) % 5,
    noise: 1 + (index * 3 + 4) % 5,
    defense: 1 + (index * 4 + 1) % 5
  }));

  const createWorldLinks = () => {
    const links = new Set();
    COUNTRIES.forEach(country => {
      const nearby = COUNTRIES.filter(other => other.id !== country.id).sort((first, second) => {
        const latitudeScale = Math.cos(country.latitude * Math.PI / 180);
        const firstDistance = Math.hypot((country.longitude - first.longitude) * latitudeScale, (country.latitude - first.latitude) * 1.25);
        const secondDistance = Math.hypot((country.longitude - second.longitude) * latitudeScale, (country.latitude - second.latitude) * 1.25);
        return firstDistance - secondDistance;
      }).slice(0, 3);
      nearby.forEach(other => links.add([country.id, other.id].sort().join(":")));
    });
    return [...links].map(link => link.split(":"));
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
    inspectedCountry: null,
    countries: countryStates(),
    started: false,
    active: false,
    turn: 0,
    signal: 4,
    alert: 8,
    upgrades: [],
    log: ["Песочница готова. Выбери страну старта на мировой карте."]
  };
  let geographyLoading = false;
  let geographyReady = false;

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
    const country = countriesById.get(state.started ? state.inspectedCountry || state.selectedCountry : state.selectedCountry);
    if (!country) {
      profile.innerHTML = "<span>СТРАНА СТАРТА</span><b>ВЫБЕРИ УЗЕЛ НА КАРТЕ</b><p>Каждая страна меняет темп сигнала, шанс фонового события и силу защитного контура.</p>";
      element("country-status").textContent = "ВЫБОР СТАРТА";
      return;
    }
    const status = state.countries[country.id] === "seed" ? "СТАРТОВЫЙ СИГНАЛ" : state.countries[country.id] === "infected" ? "ОТМЕЧЕНА" : state.countries[country.id] === "contained" ? "ИЗОЛИРОВАНА" : state.started ? "НЕЙТРАЛЬНА" : "КАНДИДАТ НА СТАРТ";
    profile.innerHTML = `<span>${country.region.toUpperCase()} / ${country.code}</span><b>${country.name.toUpperCase()}</b><p>Игровой профиль. Числа служат только балансом симуляции и не являются оценкой реальных систем страны.</p><div class="country-metrics"><span>АКТИВНОСТЬ<b>${country.activity}/5</b></span><span>ФОН<b>${country.noise}/5</b></span><span>КОНТУР<b>${country.defense}/5</b></span></div>`;
    element("country-status").textContent = status;
  }

  function countryNeighbors(id) {
    return LINKS.flatMap(([first, second]) => first === id ? [second] : second === id ? [first] : []);
  }

  function projectCoordinate([longitude, latitude]) {
    return [((longitude + 180) / 360) * 1200, ((90 - latitude) / 180) * 560];
  }

  function ringToPath(ring) {
    return ring.map((coordinate, index) => {
      const [x, y] = projectCoordinate(coordinate);
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z";
  }

  function geometryToPath(geometry) {
    if (geometry.type === "Polygon") return geometry.coordinates.map(ringToPath).join(" ");
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap(polygon => polygon.map(ringToPath)).join(" ");
    return "";
  }

  function updateBoundaryStates() {
    const countriesByCode = new Map(COUNTRIES.map(country => [country.code, country]));
    document.querySelectorAll("#country-boundaries .country-boundary").forEach(path => {
      const country = countriesByCode.get(path.dataset.countryCode);
      path.classList.remove("featured", "seed", "infected", "contained", "inspected", "true", "false", "open");
      if (!country) return;
      path.classList.toggle("featured", state.countries[country.id] !== "open");
      path.classList.add(state.countries[country.id]);
      if (state.inspectedCountry === country.id || (!state.started && state.selectedCountry === country.id)) path.classList.add("inspected");
    });
  }

  function renderGeography() {
    if (geographyReady) {
      updateBoundaryStates();
      return;
    }
    if (geographyLoading) return;
    geographyLoading = true;
    fetch("assets/world-countries.geojson")
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Карта недоступна")))
      .then(data => {
        const svg = element("country-boundaries");
        svg.innerHTML = "";
        data.features.forEach(feature => {
          const pathData = geometryToPath(feature.geometry);
          if (!pathData) return;
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.classList.add("country-boundary");
          path.dataset.countryCode = feature.properties.ISO_A3 === "-99" ? feature.properties.ADM0_A3 : feature.properties.ISO_A3;
          path.setAttribute("d", pathData);
          path.setAttribute("fill-rule", "evenodd");
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = feature.properties.NAME_RU || feature.properties.NAME_EN || feature.properties.NAME;
          path.appendChild(title);
          svg.appendChild(path);
        });
        geographyReady = true;
        geographyLoading = false;
        updateBoundaryStates();
      })
      .catch(() => {
        geographyLoading = false;
        element("country-boundaries").setAttribute("aria-label", "Не удалось загрузить географические данные");
      });
  }

  function renderWorldMap() {
    const layer = element("country-layer");
    layer.innerHTML = "";
    COUNTRIES.forEach(country => {
      const node = document.createElement("button");
      const nodeState = state.countries[country.id];
      const selected = state.started ? state.inspectedCountry === country.id : state.selectedCountry === country.id;
      node.type = "button";
      node.className = `network-node ${nodeState} ${!state.started && selected ? "start-candidate" : ""} ${state.started && selected ? "inspected" : ""}`;
      node.style.left = `calc(${country.x}% - 10px)`;
      node.style.top = `calc(${country.y}% - 10px)`;
      node.setAttribute("aria-pressed", String(selected));
      node.setAttribute("aria-label", `${country.name}: активность ${country.activity} из 5, фон ${country.noise} из 5, контур ${country.defense} из 5`);
      node.title = `${country.name} · активность ${country.activity}/5 · фон ${country.noise}/5 · контур ${country.defense}/5`;
      node.innerHTML = `<small>${country.code}</small>`;
      node.addEventListener("click", () => selectStartCountry(country.id));
      layer.appendChild(node);
    });
    renderGeography();
  }

  function renderCampaign() {
    const influenced = Object.values(state.countries).filter(value => value === "seed" || value === "infected").length;
    const country = countriesById.get(state.selectedCountry);
    const campaignLabel = state.active ? "СИГНАЛ В ПУТИ" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : "ОЖИДАНИЕ";
    element("turn-count").textContent = String(state.turn).padStart(2, "0");
    element("global-turn-top").textContent = String(state.turn).padStart(2, "0");
    element("global-coverage").innerHTML = `${String(influenced).padStart(2, "0")}<span>/${COUNTRIES.length}</span>`;
    element("global-alert").textContent = `${Math.round(state.alert)}%`;
    element("campaign-state").textContent = campaignLabel;
    element("dock-state").textContent = campaignLabel;
    element("mission-mode").textContent = state.active ? "ОПЕРАЦИЯ АКТИВНА" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : country ? "СТАРТ ПОДТВЕРЖДЁН" : "ВЫБОР СТАРТА";
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
    if (state.started) {
      state.inspectedCountry = id;
      renderCampaign();
      return;
    }
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
    state.inspectedCountry = state.selectedCountry;
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
    state.inspectedCountry = null;
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

  function openDock(name) {
    document.querySelectorAll(".dock-tab").forEach(tab => {
      const active = tab.dataset.dock === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".dock-panel").forEach(panel => {
      const active = panel.id === `dock-${name}`;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
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
  document.querySelectorAll(".dock-tab").forEach(tab => tab.addEventListener("click", () => openDock(tab.dataset.dock)));
  window.addEventListener("resize", renderWorldMap);

  renderAll();
})();
