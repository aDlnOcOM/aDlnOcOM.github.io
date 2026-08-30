import { findScenario, findScenarioVariant, isKnownScenario, listScenarioIds } from "./modules/domain/scenario-catalog.js";
import { readCampaignSave, takeScenarioDraft, writeCampaignSave } from "./modules/backend/scenario-repository.js";

// Управляет фронтендом карты, ходами кампании и адаптациями безопасной игровой симуляции HackBox.
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

  // Получает единый набор сценариев из доменного слоя вместо данных интерфейса.
  const THREAT_TYPES = Object.fromEntries(listScenarioIds().map(id => [id, findScenario(id)]));

  const COUNTRY_SEEDS = [
    ["can", "CAN", "Канада", "Северная Америка", -106, 56], ["usa", "USA", "США", "Северная Америка", -98, 39], ["mex", "MEX", "Мексика", "Северная Америка", -102, 23], ["gtm", "GTM", "Гватемала", "Северная Америка", -90, 15], ["cub", "CUB", "Куба", "Северная Америка", -79, 22], ["hti", "HTI", "Гаити", "Северная Америка", -72, 19], ["dom", "DOM", "Доминиканская Республика", "Северная Америка", -70, 19], ["jam", "JAM", "Ямайка", "Северная Америка", -77, 18], ["pan", "PAN", "Панама", "Северная Америка", -80, 9], ["cri", "CRI", "Коста-Рика", "Северная Америка", -84, 10], ["blz", "BLZ", "Белиз", "Северная Америка", -88, 17], ["nic", "NIC", "Никарагуа", "Северная Америка", -86, 13],
    ["col", "COL", "Колумбия", "Южная Америка", -74, 4], ["ven", "VEN", "Венесуэла", "Южная Америка", -66, 7], ["ecu", "ECU", "Эквадор", "Южная Америка", -78, -1], ["per", "PER", "Перу", "Южная Америка", -75, -10], ["bol", "BOL", "Боливия", "Южная Америка", -64, -17], ["bra", "BRA", "Бразилия", "Южная Америка", -52, -10], ["pry", "PRY", "Парагвай", "Южная Америка", -58, -23], ["ury", "URY", "Уругвай", "Южная Америка", -56, -33], ["arg", "ARG", "Аргентина", "Южная Америка", -65, -35], ["chl", "CHL", "Чили", "Южная Америка", -71, -30],
    ["isl", "ISL", "Исландия", "Европа", -19, 65], ["irl", "IRL", "Ирландия", "Европа", -8, 53], ["gbr", "GBR", "Великобритания", "Европа", -2, 54], ["prt", "PRT", "Португалия", "Европа", -8, 39], ["esp", "ESP", "Испания", "Европа", -4, 40], ["fra", "FRA", "Франция", "Европа", 2, 46], ["deu", "DEU", "Германия", "Европа", 10, 51], ["ita", "ITA", "Италия", "Европа", 12, 42], ["nor", "NOR", "Норвегия", "Европа", 10, 62], ["swe", "SWE", "Швеция", "Европа", 17, 61], ["pol", "POL", "Польша", "Европа", 19, 52], ["rou", "ROU", "Румыния", "Европа", 25, 46], ["grc", "GRC", "Греция", "Европа", 22, 39], ["tur", "TUR", "Турция", "Европа", 35, 39], ["ukr", "UKR", "Украина", "Европа", 32, 49], ["fin", "FIN", "Финляндия", "Европа", 26, 64], ["ltu", "LTU", "Литва", "Европа", 24, 55], ["nld", "NLD", "Нидерланды", "Европа", 5, 52],
    ["mar", "MAR", "Марокко", "Африка", -6, 32], ["dza", "DZA", "Алжир", "Африка", 2, 28], ["tun", "TUN", "Тунис", "Африка", 9, 34], ["egy", "EGY", "Египет", "Африка", 30, 27], ["nga", "NGA", "Нигерия", "Африка", 8, 9], ["gha", "GHA", "Гана", "Африка", -1, 7], ["sen", "SEN", "Сенегал", "Африка", -14, 14], ["eth", "ETH", "Эфиопия", "Африка", 40, 9], ["ken", "KEN", "Кения", "Африка", 37, 0], ["tza", "TZA", "Танзания", "Африка", 35, -6], ["zaf", "ZAF", "ЮАР", "Африка", 25, -29], ["cod", "COD", "ДР Конго", "Африка", 23, -2], ["ago", "AGO", "Ангола", "Африка", 17, -12], ["mdg", "MDG", "Мадагаскар", "Африка", 47, -20],
    ["rus", "RUS", "Россия", "Азия", 90, 60], ["kaz", "KAZ", "Казахстан", "Азия", 68, 48], ["sau", "SAU", "Саудовская Аравия", "Азия", 45, 24], ["irn", "IRN", "Иран", "Азия", 53, 32], ["ind", "IND", "Индия", "Азия", 79, 22], ["pak", "PAK", "Пакистан", "Азия", 70, 30], ["chn", "CHN", "Китай", "Азия", 104, 35], ["mng", "MNG", "Монголия", "Азия", 103, 46], ["jpn", "JPN", "Япония", "Азия", 138, 37], ["kor", "KOR", "Республика Корея", "Азия", 127, 37], ["vnm", "VNM", "Вьетнам", "Азия", 108, 16], ["tha", "THA", "Таиланд", "Азия", 101, 15], ["idn", "IDN", "Индонезия", "Азия", 118, -3], ["phl", "PHL", "Филиппины", "Азия", 122, 13],
    ["aus", "AUS", "Австралия", "Океания", 134, -25], ["nzl", "NZL", "Новая Зеландия", "Океания", 174, -41], ["png", "PNG", "Папуа — Новая Гвинея", "Океания", 144, -6], ["fji", "FJI", "Фиджи", "Океания", 178, -17]
  ];

  const CONTINENT_NAMES = {
    Africa: "Африка",
    Antarctica: "Антарктика",
    Asia: "Азия",
    Europe: "Европа",
    Oceania: "Океания",
    "North America": "Северная Америка",
    "South America": "Южная Америка",
    "Seven seas (open ocean)": "Открытое море"
  };

  // Создаёт скрытые игровые коэффициенты 0–100: это баланс симуляции, а не реальные рейтинги стран.
  const REGION_BALANCE = {
    "Африка": [38, 55, 37],
    "Антарктика": [6, 9, 8],
    "Азия": [61, 51, 58],
    "Европа": [68, 39, 72],
    "Океания": [52, 36, 60],
    "Северная Америка": [66, 44, 70],
    "Южная Америка": [51, 53, 48],
    "Открытое море": [8, 14, 10],
    "Мир": [50, 50, 50]
  };

  const COUNTRY_MODEL_DATA = window.HACKBOX_COUNTRY_MODEL_DATA?.countries || {};
  const modeledScore = (index, baseline, salt) => clamp(Math.round(baseline + ((index * (11 + salt) + salt * 17) % 31) - 15 + Math.sin((index + salt) * 1.7) * 4), 5, 95);
  const logarithmicScore = (value, minimum, maximum) => clamp((Math.log10(value) - Math.log10(minimum)) / (Math.log10(maximum) - Math.log10(minimum)) * 100, 0, 100);
  const countrySimulationProfile = (region, index, code) => {
    const [activity, noise, defense] = REGION_BALANCE[region] || REGION_BALANCE["Мир"];
    const fallback = {
      activity: modeledScore(index, activity, 2),
      noise: modeledScore(index, noise, 5),
      defense: modeledScore(index, defense, 8)
    };
    const data = COUNTRY_MODEL_DATA[code];
    if (!data?.population || !data?.gdpPerCapita || !Number.isFinite(data.internetUse)) return fallback;
    const populationScale = logarithmicScore(data.population, 100000, 1500000000);
    const incomeScale = logarithmicScore(data.gdpPerCapita, 500, 150000);
    const connectivityScale = clamp(data.internetUse, 0, 100);
    return {
      activity: clamp(Math.round(populationScale * .35 + incomeScale * .25 + connectivityScale * .4), 5, 95),
      noise: clamp(Math.round(15 + populationScale * .25 + connectivityScale * .35 + (100 - incomeScale) * .15), 5, 95),
      defense: clamp(Math.round(incomeScale * .6 + connectivityScale * .4), 5, 95)
    };
  };

  const geographyFeatureKey = index => `geography-${index}`;
  const featureCode = properties => properties.ISO_A3 && properties.ISO_A3 !== "-99" ? properties.ISO_A3 : properties.ADM0_A3 && properties.ADM0_A3 !== "-99" ? properties.ADM0_A3 : null;

  const COUNTRIES = (() => {
    const geography = window.HACKBOX_WORLD_GEOJSON;
    if (!geography?.features?.length) {
      return COUNTRY_SEEDS.map(([id, code, name, region, longitude, latitude], index) => ({
        id, code, name, region, longitude, latitude,
        x: (longitude + 180) / 3.6,
        y: (90 - latitude) / 1.8,
        ...countrySimulationProfile(region, index, code)
      }));
    }

    const usedCodes = new Map();
    return geography.features.map((feature, index) => {
      const properties = feature.properties;
      const baseCode = featureCode(properties) || `GEO-${index + 1}`;
      const sameCodeCount = usedCodes.get(baseCode) || 0;
      usedCodes.set(baseCode, sameCodeCount + 1);
      const code = sameCodeCount ? `${baseCode}-${sameCodeCount + 1}` : baseCode;
      const [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude] = feature.bbox || [-180, -90, 180, 90];
      const longitude = Number.isFinite(properties.LABEL_X) ? properties.LABEL_X : (minimumLongitude + maximumLongitude) / 2;
      const latitude = Number.isFinite(properties.LABEL_Y) ? properties.LABEL_Y : (minimumLatitude + maximumLatitude) / 2;
      const region = CONTINENT_NAMES[properties.CONTINENT] || properties.CONTINENT || "Мир";
      return {
        id: geographyFeatureKey(index),
        code,
        name: properties.NAME_RU || properties.NAME_EN || properties.NAME || `Территория ${index + 1}`,
        region,
        longitude,
        latitude,
        x: (longitude + 180) / 3.6,
        y: (90 - latitude) / 1.8,
        ...countrySimulationProfile(region, index, baseCode)
      };
    });
  })();

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
  const countriesByFeatureKey = new Map(COUNTRIES.map(country => [country.id, country]));
  const countriesByCode = new Map(COUNTRIES.map(country => [country.code, country]));
  const countryStates = () => Object.fromEntries(COUNTRIES.map(country => [country.id, "open"]));
  const state = {
    gameCreated: false,
    scenarioName: "СЕРАЯ ПЕТЛЯ",
    threatType: "virus",
    threatVariant: "standard",
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
    economicDamage: 0,
    scenarioProfit: 0,
    log: ["Песочница готова. Выбери страну старта на мировой карте."]
  };
  let geographyLoading = false;
  let geographyReady = false;

  /** Возвращает выбранный учебный сценарий с безопасным резервным вариантом. */
  function activeThreatType() {
    return THREAT_TYPES[state.threatType] || findScenario(listScenarioIds()[0]);
  }

  /** Возвращает игровой вариант активного сценария. */
  function activeThreatVariant() {
    return activeThreatType().variants.find(variant => variant.id === state.threatVariant) || activeThreatType().variants[0];
  }

  /** Складывает балансные модификаторы сценария и его варианта. */
  function threatModifiers() {
    const type = activeThreatType();
    const variant = activeThreatVariant();
    return [type.modifiers, variant.modifiers].reduce((total, modifier) => ({
      stealth: total.stealth + (modifier.stealth || 0),
      speed: total.speed + (modifier.speed || 0),
      resilience: total.resilience + (modifier.resilience || 0),
      alert: total.alert + (modifier.alert || 0)
    }), { stealth: 0, speed: 0, resilience: 0, alert: 0 });
  }

  /** Проверяет, приобретена ли конкретная игровая адаптация. */
  function hasUpgrade(id) {
    return state.upgrades.includes(id);
  }

  /** Рассчитывает итоговые игровые параметры с учётом выбранной конфигурации. */
  function effectiveStats() {
    const archetype = ARCHETYPES[state.archetype];
    const applicator = APPLICATORS[state.applicator];
    const threat = threatModifiers();
    return {
      stealth: clamp(state.stealth + archetype.stealth + threat.stealth - (hasUpgrade("quietCore") ? 1 : 0), 1, 8),
      speed: clamp(state.speed + archetype.speed + applicator.speed + threat.speed, 1, 8),
      resilience: clamp(state.resilience + archetype.resilience + applicator.resilience + threat.resilience + (hasUpgrade("anchor") ? 1 : 0), 1, 8)
    };
  }

  /** Добавляет заметку в журнал и сохраняет компактный размер истории. */
  function pushLog(message) {
    state.log.unshift(message);
    state.log = state.log.slice(0, 12);
  }

  /** Обновляет визуальную сводку параметров в панели конструктора карты. */
  function updatePreview() {
    const stats = effectiveStats();
    const name = element("strain-name").value.trim().toUpperCase() || "БЕЗЫМЯННАЯ СХЕМА";
    const archetype = ARCHETYPES[state.archetype];
    const applicator = APPLICATORS[state.applicator];
    const threat = activeThreatType();
    const variant = activeThreatVariant();
    element("preview-name").textContent = name;
    element("preview-stealth").textContent = String(stats.stealth).padStart(2, "0");
    element("preview-speed").textContent = String(stats.speed).padStart(2, "0");
    element("preview-resilience").textContent = String(stats.resilience).padStart(2, "0");
    element("preview-description").textContent = `${threat.name} / ${variant.name}: ${threat.role} Архитектура: ${archetype.name.toLowerCase()}; аппликатор: ${applicator.name.toLowerCase()}.`;
    element("strain-id").textContent = `HB-${String(7 + stats.stealth * 3 + stats.speed).padStart(3, "0")}`;
    ["stealth", "speed", "resilience"].forEach(key => {
      element(`${key}-value`).textContent = String(state[key]).padStart(2, "0");
    });
  }

  /** Рендерит краткий профиль выбранной или просматриваемой страны. */
  function renderCountryProfile() {
    const profile = element("country-profile");
    const country = countriesById.get(state.started ? state.inspectedCountry || state.selectedCountry : state.selectedCountry);
    if (!country) {
      profile.innerHTML = "<span>СТРАНА СТАРТА</span><b>НАЖМИ НА СТРАНУ НА КАРТЕ</b><p>Каждая страна скрыто влияет на ход симуляции. Внутренние параметры недоступны игроку.</p>";
      element("country-status").textContent = "ВЫБОР СТАРТА";
      return;
    }
    const status = state.countries[country.id] === "seed" ? "СТАРТОВЫЙ СИГНАЛ" : state.countries[country.id] === "infected" ? "ОТМЕЧЕНА" : state.countries[country.id] === "contained" ? "ИЗОЛИРОВАНА" : state.started ? "НЕЙТРАЛЬНА" : "КАНДИДАТ НА СТАРТ";
    profile.innerHTML = `<span>${country.region.toUpperCase()} / ${country.code}</span><b>${country.name.toUpperCase()}</b><p>Имитатор учитывает локальные условия скрыто. Параметры страны не раскрываются игроку.</p>`;
    element("country-status").textContent = status;
  }

  /** Возвращает страны, связанные с указанной страной на игровой карте. */
  function countryNeighbors(id) {
    return LINKS.flatMap(([first, second]) => first === id ? [second] : second === id ? [first] : []);
  }

  /** Переводит географические координаты в координаты SVG-карты. */
  function projectCoordinate([longitude, latitude]) {
    return [((longitude + 180) / 360) * 1200, ((90 - latitude) / 180) * 560];
  }

  /** Преобразует замкнутую географическую линию в SVG-путь. */
  function ringToPath(ring) {
    return ring.map((coordinate, index) => {
      const [x, y] = projectCoordinate(coordinate);
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z";
  }

  /** Преобразует Polygon или MultiPolygon из GeoJSON в строку SVG-пути. */
  function geometryToPath(geometry) {
    if (geometry.type === "Polygon") return geometry.coordinates.map(ringToPath).join(" ");
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap(polygon => polygon.map(ringToPath)).join(" ");
    return "";
  }

  /** Синхронизирует классы контуров стран с текущим состоянием кампании. */
  function updateBoundaryStates() {
    document.querySelectorAll("#country-boundaries .country-boundary").forEach(path => {
      const country = countriesById.get(path.dataset.countryId);
      path.classList.remove("featured", "seed", "infected", "contained", "inspected", "true", "false", "open");
      if (!country) return;
      path.classList.toggle("featured", state.countries[country.id] !== "open");
      path.classList.add(state.countries[country.id]);
      if (state.inspectedCountry === country.id || (!state.started && state.selectedCountry === country.id)) path.classList.add("inspected");
    });
  }

  /** Создаёт интерактивные SVG-контуры по загруженным географическим данным. */
  function paintGeography(data, source) {
    const svg = element("country-boundaries");
    svg.innerHTML = "";
    svg.dataset.source = source;
    data.features.forEach((feature, index) => {
      const pathData = geometryToPath(feature.geometry);
      if (!pathData) return;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const country = countriesByFeatureKey.get(geographyFeatureKey(index)) || countriesByCode.get(featureCode(feature.properties));
      path.classList.add("country-boundary");
      path.setAttribute("d", pathData);
      path.setAttribute("fill-rule", "evenodd");
      if (country) {
        path.dataset.countryId = country.id;
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", `Выбрать ${country.name}`);
        path.addEventListener("click", () => selectStartCountry(country.id));
        path.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectStartCountry(country.id);
          }
        });
      } else {
        path.setAttribute("tabindex", "-1");
      }
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = country ? country.name : feature.properties.NAME_RU || feature.properties.NAME_EN || feature.properties.NAME;
      path.appendChild(title);
      svg.appendChild(path);
    });
    geographyReady = true;
    geographyLoading = false;
    updateBoundaryStates();
  }

  /** Обеспечивает однократную отрисовку встроенной или загружаемой географической карты. */
  function renderGeography() {
    if (geographyReady) {
      updateBoundaryStates();
      return;
    }
    if (window.HACKBOX_WORLD_GEOJSON) {
      paintGeography(window.HACKBOX_WORLD_GEOJSON, "embedded");
      return;
    }
    if (geographyLoading) return;
    geographyLoading = true;
    fetch("assets/world-countries.geojson")
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Карта недоступна")))
      .then(data => paintGeography(data, "request"))
      .catch(() => {
        geographyLoading = false;
        const svg = element("country-boundaries");
        svg.setAttribute("aria-label", "Не удалось загрузить географические данные");
        svg.innerHTML = '<text x="600" y="285" text-anchor="middle">КАРТА НЕДОСТУПНА</text>';
      });
  }

  /** Обновляет географическую часть главного экрана. */
  function renderWorldMap() {
    renderGeography();
  }

  /** Обновляет сводку кампании, метрики и элементы управления картой. */
  function renderCampaign() {
    const influenced = Object.values(state.countries).filter(value => value === "seed" || value === "infected").length;
    const country = countriesById.get(state.selectedCountry);
    const inspectedCountry = countriesById.get(state.inspectedCountry);
    const campaignLabel = state.active ? "СИГНАЛ В ПУТИ" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : "ОЖИДАНИЕ";
    element("turn-count").textContent = String(state.turn).padStart(2, "0");
    element("global-turn-top").textContent = String(state.turn).padStart(2, "0");
    element("global-coverage").innerHTML = `${String(influenced).padStart(2, "0")}<span>/${COUNTRIES.length}</span>`;
    element("global-alert").textContent = `${Math.round(state.alert)}%`;
    element("economic-damage").textContent = String(Math.round(state.economicDamage || 0)).padStart(2, "0");
    element("scenario-profit").textContent = String(Math.round(state.scenarioProfit || 0)).padStart(2, "0");
    element("map-country-count").textContent = String(COUNTRIES.length);
    element("campaign-state").textContent = campaignLabel;
    element("dock-state").textContent = campaignLabel;
    element("mission-mode").textContent = state.active ? "ОПЕРАЦИЯ АКТИВНА" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : country ? "СТАРТ ПОДТВЕРЖДЁН" : "ВЫБОР СТАРТА";
    element("network-readout").textContent = state.started ? `${influenced} ИЗ ${COUNTRIES.length} ОТМЕЧЕНО` : country ? `СТАРТ: ${country.name.toUpperCase()}` : "ВЫБЕРИ СТРАНУ СТАРТА";
    element("signal-points").textContent = String(state.signal).padStart(2, "0");
    element("alert-value").textContent = `${Math.round(state.alert)}%`;
    element("alert-meter").style.width = `${state.alert}%`;
    element("alert-text").textContent = state.alert < 32 ? "Контур заметил слабый фон, но пока не понимает его рисунок." : state.alert < 67 ? "Защитный контур анализирует необычные связи. Тихий дрейф особенно важен." : "Контур готовит изоляцию маршрутов. Следующий цикл может закрыть часть сети.";
    element("advance-turn").disabled = !state.active;
    element("map-selection-name").textContent = state.started ? `СТАРТ: ${country.name.toUpperCase()}` : country ? country.name.toUpperCase() : "НЕ ВЫБРАНА";
    element("launch-simulation").disabled = state.started || !state.selectedCountry;
    element("launch-simulation").textContent = state.started ? "СТРАНА СТАРТА ПОДТВЕРЖДЕНА" : state.selectedCountry ? `ПОДТВЕРДИТЬ: ${country.name.toUpperCase()} →` : "СНАЧАЛА ВЫБЕРИ СТРАНУ";
    element("launch-simulation").setAttribute("aria-label", state.started ? "Страна старта подтверждена" : country ? `Подтвердить страну старта: ${country.name}` : "Сначала выбери страну старта");
    if (state.started && inspectedCountry) element("network-readout").textContent = `ПРОСМОТР: ${inspectedCountry.name.toUpperCase()}`;
    renderCountryProfile();
    renderWorldMap();
  }

  /** Отрисовывает доступные игровые адаптации и их состояние. */
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

  /** Выводит последние события учебной симуляции. */
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

  /** Перенаправляет чтение сохранения в отдельный модуль локальных данных. */
  function readSavedGame() {
    return readCampaignSave();
  }

  /** Сохраняет кампанию через изолированный модуль, когда игра уже создана. */
  function saveGame() {
    if (state.gameCreated) writeCampaignSave(state);
  }

  /** Показывает либо стартовую страницу, либо основной экран кампании. */
  function showScreen(name) {
    element("start-screen").hidden = name !== "start";
    element("game-shell").hidden = name !== "game";
  }

  /** Отражает наличие локального сохранения на стартовом экране. */
  function renderStartScreen() {
    const saved = readSavedGame();
    element("continue-game").disabled = !saved;
    element("save-hint").textContent = saved ? "Найдено локальное сохранение сценария. Продолжение восстановит карту и выбранную модель." : "Сохранения пока нет. Новая игра начнётся с конструктора модели.";
  }

  /** Открывает самостоятельную страницу конструктора для создания новой кампании. */
  function openCreator() {
    window.location.assign("create.html");
  }

  /**
   * Инициализирует игровое состояние по безопасному черновику из конструктора.
   *
   * @param {{scenarioId: string, variantId: string, scenarioName: string}} draft Данные выбранного игрового сценария.
   * @returns {void}
   */
  function startNewScenario(draft) {
    const scenarioId = isKnownScenario(draft.scenarioId) ? draft.scenarioId : listScenarioIds()[0];
    const scenario = findScenario(scenarioId);
    const variant = findScenarioVariant(scenarioId, draft.variantId);
    Object.assign(state, {
      gameCreated: true,
      scenarioName: draft.scenarioName || "БЕЗЫМЯННЫЙ СЦЕНАРИЙ",
      threatType: scenarioId,
      threatVariant: variant?.id || "standard",
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
      economicDamage: 0,
      scenarioProfit: 0,
      log: [`Учебная модель «${scenario?.name || "Сценарий"}» подготовлена. Выбери страну старта на мировой карте.`]
    });
    element("strain-name").value = state.scenarioName;
    showScreen("game");
    renderAll();
  }

  /** Принимает одноразовый черновик конструктора и открывает на его основе новую кампанию. */
  function consumeScenarioDraft() {
    const draft = takeScenarioDraft();
    if (!draft) return false;
    startNewScenario(draft);
    window.history.replaceState({}, document.title, "index.html");
    return true;
  }

  /** Восстанавливает проверенное локальное сохранение в основной экран кампании. */
  function continueGame() {
    const saved = readSavedGame();
    if (!saved) return;
    const loaded = saved.state;
    if (!isKnownScenario(loaded.threatType)) return;
    Object.assign(state, loaded, {
      threatVariant: THREAT_TYPES[loaded.threatType].variants.some(variant => variant.id === loaded.threatVariant) ? loaded.threatVariant : THREAT_TYPES[loaded.threatType].variants[0].id,
      countries: { ...countryStates(), ...(loaded.countries || {}) },
      upgrades: Array.isArray(loaded.upgrades) ? loaded.upgrades.filter(id => UPGRADES.some(upgrade => upgrade.id === id)) : [],
      economicDamage: Number.isFinite(loaded.economicDamage) ? loaded.economicDamage : 0,
      scenarioProfit: Number.isFinite(loaded.scenarioProfit) ? loaded.scenarioProfit : 0,
      log: Array.isArray(loaded.log) ? loaded.log.slice(0, 12) : ["Сценарий восстановлен из локального сохранения."]
    });
    const name = state.scenarioName || "СЕРАЯ ПЕТЛЯ";
    element("strain-name").value = name;
    showScreen("game");
    renderAll();
  }

  /** Перерисовывает все игровые панели и сохраняет актуальное состояние. */
  function renderAll() {
    updatePreview();
    renderCampaign();
    renderUpgrades();
    renderLog();
    saveGame();
  }

  /** Выбирает стартовую страну до запуска или открывает профиль страны после запуска. */
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

  /** Запускает подготовленную игровую кампанию из выбранной страны. */
  function launchSimulation() {
    if (!state.selectedCountry || state.started) return;
    state.started = true;
    state.active = true;
    state.countries[state.selectedCountry] = "seed";
    state.inspectedCountry = state.selectedCountry;
    const country = countriesById.get(state.selectedCountry);
    state.alert = clamp(5 + country.defense * .13 - effectiveStats().stealth + threatModifiers().alert, 3, 25);
    pushLog(`Сценарий запущен в стране «${country.name}». Первый импульс стабилен.`);
    renderAll();
  }

  /** Покупает адаптацию, если у игрока достаточно сигнального ресурса. */
  function buyUpgrade(upgrade) {
    if (!state.started || hasUpgrade(upgrade.id) || state.signal < upgrade.cost) return;
    state.signal -= upgrade.cost;
    state.upgrades.push(upgrade.id);
    pushLog(`Адаптация «${upgrade.name}» встроена в паттерн.`);
    renderAll();
  }

  /** Возвращает страны, которые пока остаются активными в игровом сценарии. */
  function activeCountries() {
    return COUNTRIES.filter(country => ["seed", "infected"].includes(state.countries[country.id]));
  }

  /** Собирает открытые соседние страны, доступные для следующего абстрактного шага. */
  function openNeighbors() {
    const targets = new Set();
    activeCountries().forEach(country => {
      countryNeighbors(country.id).forEach(neighborId => {
        if (state.countries[neighborId] === "open") targets.add(neighborId);
      });
    });
    return [...targets].map(id => countriesById.get(id));
  }

  /** Разыгрывает безопасное фоновое событие и возвращает его балансный бонус. */
  function resolveBackgroundEvent() {
    const country = randomItem(activeCountries());
    const chance = .12 + country.noise * .0025 + (hasUpgrade("switchback") ? .12 : 0);
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

  /** Моделирует игровую ответную реакцию контура при высокой тревоге. */
  function containSignal() {
    if (state.alert < 53) return;
    const candidates = activeCountries().filter(country => country.id !== state.selectedCountry);
    if (!candidates.length) return;
    const target = candidates.sort((first, second) => second.defense - first.defense)[0];
    const resistance = effectiveStats().resilience + (hasUpgrade("lattice") ? 2 : 0);
    const chance = .07 + target.defense * .002 - resistance * .025;
    if (Math.random() < chance) {
      state.countries[target.id] = "contained";
      pushLog(`Контур защиты страны «${target.name}» закрыл один отмеченный узел.`);
    }
  }

  /** Продвигает кампанию на один игровой цикл и пересчитывает её абстрактные показатели. */
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
      const chance = .18 + stats.speed * .052 + sourceActivity * .0025 + backgroundBonus + (hasUpgrade("cascade") ? .11 : 0) - target.defense * .0027;
      if (Math.random() < chance) {
        state.countries[target.id] = "infected";
        newSignals += 1;
        pushLog(`Эхо достигло страны «${target.name}». Её игровой профиль добавлен к карте.`);
      }
    }
    if (!newSignals) pushLog("Связи дрожат, но контур не пропускает новый устойчивый импульс в этом цикле.");
    state.signal += 1 + newSignals + (newSignals && hasUpgrade("chorus") ? 1 : 0);
    const scenarioEconomy = activeThreatType().economy;
    const activeCount = activeCountries().length;
    const pressureGain = (4 + activeCount * 3 + newSignals * 9) * scenarioEconomy.impact / 100;
    const profitGain = (1 + newSignals + Math.max(0, 35 - state.alert) / 35) * scenarioEconomy.yield / 100;
    state.economicDamage += Math.round(pressureGain);
    state.scenarioProfit += Math.round(profitGain);
    const averageDefense = activeCountries().reduce((total, country) => total + country.defense, 0) / Math.max(1, activeCountries().length);
    const awarenessStep = 3 + averageDefense * .028 - stats.stealth * .52 - (hasUpgrade("veil") ? 1.1 : 0);
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

  /** Сбрасывает только текущую кампанию, сохраняя выбранный игроком сценарий. */
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
    state.economicDamage = 0;
    state.scenarioProfit = 0;
    state.log = ["Песочница сброшена. Выбери новую страну старта на мировой карте."];
    renderAll();
  }

  /** Открывает одну из нижних информационных панелей и скрывает остальные. */
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

  element("strain-name").addEventListener("input", event => {
    state.scenarioName = event.target.value.trim().toUpperCase() || "СЕРАЯ ПЕТЛЯ";
    updatePreview();
    saveGame();
  });
  ["stealth", "speed", "resilience"].forEach(key => {
    element(`${key}-input`).addEventListener("input", event => {
      state[key] = Number(event.target.value);
      updatePreview();
      saveGame();
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
    saveGame();
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
    saveGame();
  });
  element("new-game").addEventListener("click", openCreator);
  element("continue-game").addEventListener("click", continueGame);
  element("launch-simulation").addEventListener("click", launchSimulation);
  element("advance-turn").addEventListener("click", advanceCycle);
  element("reset-simulation").addEventListener("click", resetSimulation);
  document.querySelectorAll(".dock-tab").forEach(tab => tab.addEventListener("click", () => openDock(tab.dataset.dock)));
  window.addEventListener("resize", renderWorldMap);

  renderStartScreen();
  if (!consumeScenarioDraft()) {
    renderAll();
    showScreen("start");
  }
})();
