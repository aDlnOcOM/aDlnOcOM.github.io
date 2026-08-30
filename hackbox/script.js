// Управляет фронтендом карты, ходами кампании и адаптациями безопасной игровой симуляции HackBox.
(() => {
  const { findScenario, findScenarioVariant, isKnownScenario, listScenarioIds } = window.HackboxDomain;
  const { readCampaignSave, takeScenarioDraft, writeCampaignSave } = window.HackboxRepository;
  /** Возвращает элемент игрового интерфейса по его идентификатору. */
  const element = id => document.getElementById(id);
  /** Ограничивает числовой показатель минимальным и максимальным значениями. */
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  /** Выбирает случайный элемент из непустого массива для безопасного игрового события. */
  const randomItem = items => items[Math.floor(Math.random() * items.length)];

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
  /** Создаёт псевдослучайный, но повторяемый показатель для абстрактного игрового баланса. */
  const modeledScore = (index, baseline, salt) => clamp(Math.round(baseline + ((index * (11 + salt) + salt * 17) % 31) - 15 + Math.sin((index + salt) * 1.7) * 4), 5, 95);
  /** Нормализует положительный показатель по логарифмической шкале от 0 до 100. */
  const logarithmicScore = (value, minimum, maximum) => clamp((Math.log10(value) - Math.log10(minimum)) / (Math.log10(maximum) - Math.log10(minimum)) * 100, 0, 100);
  /** Строит скрытый балансный профиль страны из открытых статистических данных или регионального шаблона. */
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

  /** Возвращает стабильный ключ географического объекта по его порядковому номеру. */
  const geographyFeatureKey = index => `geography-${index}`;
  /** Извлекает поддерживаемый ISO-код из свойств объекта GeoJSON. */
  const featureCode = properties => properties.ISO_A3 && properties.ISO_A3 !== "-99" ? properties.ISO_A3 : properties.ADM0_A3 && properties.ADM0_A3 !== "-99" ? properties.ADM0_A3 : null;

  /** Формирует набор стран из встроенной географии или резервной таблицы координат. */
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

  /** Создаёт для карты разреженную сеть ближайших соседей между странами. */
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

  const UPGRADE_BRANCHES = [
    { id: "surface", code: "01 / ATTACK SURFACE", name: "Поверхность", hint: "география связей, охват среды и темп развития карты" },
    { id: "detection", code: "02 / DETECTION", name: "Наблюдаемость", hint: "вероятность обнаружения и качество защитного мониторинга" },
    { id: "resilience", code: "03 / RESILIENCE", name: "Устойчивость", hint: "надёжность модели при сегментации и изоляции узлов" },
    { id: "impact", code: "04 / IMPACT", name: "Воздействие", hint: "условный эффект инцидента и экономика учебного сценария" },
    { id: "response", code: "05 / DEFENCE RESPONSE", name: "Реакция защиты", hint: "патчи, расследования и изменения поведения среды" },
    { id: "campaign", code: "06 / CAMPAIGN", name: "Кампания", hint: "планирование целей и дисциплина долгого сценария" }
  ];

  const UPGRADES = [
    { id: "relayMap", branch: "surface", tier: 1, cost: 2, name: "Карта поверхности", effect: "+1 кандидат на развитие карты за цикл", tradeoff: "Широкая поверхность повышает объём наблюдаемой активности." },
    { id: "cascade", branch: "surface", tier: 2, cost: 4, alert: 2, requires: "relayMap", name: "Связность экосистемы", effect: "+8% к вероятности новой отметки", tradeoff: "Рост связности ускоряет реакцию защитных команд." },
    { id: "wideMap", branch: "surface", tier: 3, cost: 7, alert: 4, requires: "cascade", name: "Многоконтурный охват", effect: "ещё один кандидат на развитие карты", tradeoff: "Масштабирование увеличивает заметность кампании." },
    { id: "veil", branch: "detection", tier: 1, cost: 2, name: "Снижение наблюдаемости", effect: "меньше роста внимания за цикл", tradeoff: "Низкий профиль означает более осторожный темп." },
    { id: "quietCore", branch: "detection", tier: 2, cost: 4, requires: "veil", name: "Низкошумный профиль", effect: "+1 к скрытности модели", tradeoff: "Защитные команды всё равно адаптируются со временем." },
    { id: "shadowBalance", branch: "detection", tier: 3, cost: 7, requires: "quietCore", name: "Контроль аномалий", effect: "сдерживает всплески внимания при расширении", tradeoff: "Не исключает расследование при высокой активности." },
    { id: "anchor", branch: "resilience", tier: 1, cost: 3, name: "Целостность исполнения", effect: "+1 к устойчивости модели", tradeoff: "Устойчивость требует больше Compute Points." },
    { id: "lattice", branch: "resilience", tier: 2, cost: 5, requires: "anchor", name: "Резервирование состояния", effect: "изоляция узла причиняет меньше вреда кампании", tradeoff: "Резервные контуры могут вызвать дополнительное внимание." },
    { id: "recoveryLoop", branch: "resilience", tier: 3, cost: 8, alert: 1, requires: "lattice", name: "Контур восстановления", effect: "редко возвращает изолированный узел в модель", tradeoff: "Возвращение узла оставляет дополнительный след в журнале защиты." },
    { id: "chorus", branch: "impact", tier: 1, cost: 3, name: "Приоритизация телеметрии", effect: "+1 CP за цикл с новой отметкой", tradeoff: "Модель вознаграждает качество результата, а не скорость любой ценой." },
    { id: "resourceCache", branch: "impact", tier: 2, cost: 5, requires: "chorus", name: "Пул вычислений", effect: "+1 CP каждый третий цикл", tradeoff: "Накопление ресурса не снижает вероятность обнаружения." },
    { id: "compoundYield", branch: "impact", tier: 3, cost: 8, alert: 2, requires: "resourceCache", name: "Модель последствий", effect: "+1 CP за сильный экономический такт", tradeoff: "Сильное воздействие повышает приоритет расследования." },
    { id: "switchback", branch: "response", tier: 1, cost: 3, name: "Контекст среды", effect: "изменения среды учитываются чаще", tradeoff: "Часть событий работает в пользу защитного контура." },
    { id: "adaptiveRhythm", branch: "response", tier: 2, cost: 5, requires: "switchback", name: "Адаптивная модель", effect: "благоприятные события сильнее снижают внимание", tradeoff: "Региональные обновления и мониторинг всё ещё могут замедлять кампанию." },
    { id: "responseWindow", branch: "response", tier: 3, cost: 8, alert: 2, requires: "adaptiveRhythm", name: "Окно принятия решений", effect: "благоприятные события могут принести +1 CP", tradeoff: "Нельзя предсказать, каким будет следующее событие среды." },
    { id: "scenarioFocus", branch: "campaign", tier: 1, cost: 4, alert: 1, name: "Профилирование цели", effect: "+8% к профильному результату", tradeoff: "Фокус на результате увеличивает ценность кампании для защитного анализа." },
    { id: "scenarioMastery", branch: "campaign", tier: 2, cost: 8, alert: 3, requires: "scenarioFocus", name: "Операционное планирование", effect: "ещё +12% к профильному результату", tradeoff: "Планирование не отменяет глобальные защитные контрмеры." },
    { id: "campaignDiscipline", branch: "campaign", tier: 3, cost: 10, requires: "scenarioMastery", name: "Дисциплина кампании", effect: "−1 внимания в спокойный цикл", tradeoff: "Работает только без нового расширения карты в этом цикле." }
  ];

  const upgradesById = new Map(UPGRADES.map(upgrade => [upgrade.id, upgrade]));

  const countriesById = new Map(COUNTRIES.map(country => [country.id, country]));
  const countriesByFeatureKey = new Map(COUNTRIES.map(country => [country.id, country]));
  const countriesByCode = new Map(COUNTRIES.map(country => [country.code, country]));
  /** Создаёт исходное нейтральное состояние для всех стран на карте. */
  const countryStates = () => Object.fromEntries(COUNTRIES.map(country => [country.id, "open"]));
  const BASE_TICK_MS = 6000;
  const TIME_SCALES = new Set([0, 0.5, 1, 2, 4]);
  const state = {
    gameCreated: false,
    scenarioName: "СЕРАЯ ПЕТЛЯ",
    threatType: "virus",
    threatVariant: "standard",
    stealth: 3,
    speed: 3,
    resilience: 2,
    selectedCountry: null,
    inspectedCountry: null,
    countries: countryStates(),
    started: false,
    active: false,
    result: null,
    turn: 0,
    signal: 4,
    alert: 8,
    timeScale: 1,
    elapsedMilliseconds: 0,
    tickElapsed: 0,
    upgrades: [],
    economicDamage: 0,
    scenarioProfit: 0,
    log: ["Учебная среда готова. Выбери страну старта на мировой карте."]
  };
  let geographyLoading = false;
  let geographyReady = false;
  let previousFrameTime = performance.now();
  let previousClockPaint = 0;

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

  /** Рассчитывает итоговые параметры кампании с учётом сценария и приобретённых улучшений. */
  function effectiveStats() {
    const threat = threatModifiers();
    return {
      stealth: clamp(state.stealth + threat.stealth + (hasUpgrade("quietCore") ? 1 : 0), 1, 8),
      speed: clamp(state.speed + threat.speed, 1, 8),
      resilience: clamp(state.resilience + threat.resilience + (hasUpgrade("anchor") ? 1 : 0), 1, 8)
    };
  }

  /** Возвращает множитель профильного результата от ветки сценария. */
  function scenarioResultMultiplier() {
    return 1 + (hasUpgrade("scenarioFocus") ? .08 : 0) + (hasUpgrade("scenarioMastery") ? .12 : 0);
  }

  /** Добавляет заметку в журнал и сохраняет компактный размер истории. */
  function pushLog(message) {
    state.log.unshift(message);
    state.log = state.log.slice(0, 12);
  }

  /** Отражает в заголовке выбранный тип и вариант учебного сценария. */
  function renderScenarioIdentity() {
    const threat = activeThreatType();
    const variant = activeThreatVariant();
    element("scenario-title").textContent = state.scenarioName || threat.name.toUpperCase();
    element("scenario-context").textContent = `SCENARIO / ${threat.name.toUpperCase()} · ${variant.name.toUpperCase()}`;
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

  /** Преобразует прошедшее игровое время в компактную запись часов, минут и секунд. */
  function formatSimulationTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    return hours ? `T+${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `T+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  /** Обновляет таймер, индикатор тика и доступность кнопок скорости. */
  function renderRealtimeControls() {
    element("simulation-clock").textContent = formatSimulationTime(state.elapsedMilliseconds || 0);
    element("tick-progress").style.width = `${clamp((state.tickElapsed || 0) / BASE_TICK_MS * 100, 0, 100)}%`;
    element("realtime-state").textContent = !state.started ? "ОЖИДАНИЕ" : !state.active ? "ЗАВЕРШЕНО" : state.timeScale === 0 ? "ПАУЗА" : `${state.timeScale}× / LIVE`;
    document.querySelectorAll("[data-time-scale]").forEach(button => {
      const selected = Number(button.dataset.timeScale) === state.timeScale;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !state.active;
    });
  }

  /** Переключает скорость симуляции между паузой и разрешёнными множителями времени. */
  function setTimeScale(value) {
    const nextScale = Number(value);
    if (!state.active || !TIME_SCALES.has(nextScale)) return;
    state.timeScale = nextScale;
    previousFrameTime = performance.now();
    pushLog(nextScale === 0 ? "Ход учебной симуляции приостановлен." : `Скорость учебной симуляции изменена: ${nextScale}×.`);
    renderAll();
  }

  /** Продвигает реалтайм-таймер и автоматически запускает игровые тики. */
  function processRealtimeFrame(timestamp) {
    const frameDelta = Math.min(Math.max(timestamp - previousFrameTime, 0), 1000);
    previousFrameTime = timestamp;
    if (state.active && state.timeScale > 0) {
      const scaledDelta = frameDelta * state.timeScale;
      state.elapsedMilliseconds += scaledDelta;
      state.tickElapsed += scaledDelta;
      let processedTicks = 0;
      while (state.tickElapsed >= BASE_TICK_MS && state.active && processedTicks < 3) {
        state.tickElapsed -= BASE_TICK_MS;
        advanceCycle();
        processedTicks += 1;
      }
      if (timestamp - previousClockPaint >= 100) {
        previousClockPaint = timestamp;
        renderRealtimeControls();
      }
    }
    window.requestAnimationFrame(processRealtimeFrame);
  }

  /** Выбирает безопасную цель кампании по балансному профилю текущего сценария. */
  function activeScenarioObjective() {
    const economy = activeThreatType().economy;
    if (economy.impact >= 80) {
      return { name: "ПРЕДЕЛ УСТОЙЧИВОСТИ", description: "Накопи игровое экономическое давление до ответа защитного контура.", metric: "economicDamage", target: 900, unit: "ОЧКОВ" };
    }
    if (economy.yield >= 65) {
      return { name: "ДОЛГАЯ КАМПАНИЯ", description: "Сохраняй низкий профиль и накопи условный ресурс сценария.", metric: "scenarioProfit", target: 260, unit: "ЕДИНИЦ" };
    }
    return { name: "ГЛОБАЛЬНЫЙ ОХВАТ", description: "Расширь учебный сигнал до значительной части географической карты.", metric: "coverage", target: Math.ceil(COUNTRIES.length * .45), unit: "СТРАН" };
  }

  /** Рассчитывает текущее значение и процент выполнения активной цели. */
  function scenarioObjectiveProgress() {
    const objective = activeScenarioObjective();
    const value = objective.metric === "coverage" ? activeCountries().length : Number(state[objective.metric] || 0);
    return { ...objective, value, percent: clamp(value / objective.target * 100, 0, 100) };
  }

  /** Отображает название, пояснение и прогресс безопасной цели кампании. */
  function renderScenarioObjective() {
    const objective = scenarioObjectiveProgress();
    element("objective-name").textContent = objective.name;
    element("objective-text").textContent = state.result === "objective" ? "Учебная цель достигнута. Сценарий завершён успешно." : objective.description;
    element("objective-value").textContent = `${Math.round(objective.value)} / ${objective.target} ${objective.unit}`;
    element("objective-progress").style.width = `${objective.percent}%`;
  }

  /** Завершает кампанию, когда выбранная игровая цель достигнута. */
  function evaluateScenarioObjective() {
    const objective = scenarioObjectiveProgress();
    if (!state.active || objective.percent < 100) return false;
    state.active = false;
    state.result = "objective";
    pushLog(`Цель «${objective.name}» достигнута. Учебная симуляция завершена.`);
    return true;
  }

  /** Обновляет сводку кампании, метрики и элементы управления картой. */
  function renderCampaign() {
    const influenced = Object.values(state.countries).filter(value => value === "seed" || value === "infected").length;
    const country = countriesById.get(state.selectedCountry);
    const inspectedCountry = countriesById.get(state.inspectedCountry);
    const campaignLabel = state.active ? state.timeScale === 0 ? "ПАУЗА" : "СИГНАЛ В ПУТИ" : state.result === "objective" ? "ЦЕЛЬ ДОСТИГНУТА" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : "ОЖИДАНИЕ";
    element("global-turn-top").textContent = String(state.turn).padStart(2, "0");
    element("global-coverage").innerHTML = `${String(influenced).padStart(2, "0")}<span>/${COUNTRIES.length}</span>`;
    element("global-alert").textContent = `${Math.round(state.alert)}%`;
    element("economic-damage").textContent = String(Math.round(state.economicDamage || 0)).padStart(2, "0");
    element("scenario-profit").textContent = String(Math.round(state.scenarioProfit || 0)).padStart(2, "0");
    element("map-country-count").textContent = String(COUNTRIES.length);
    element("campaign-state").textContent = campaignLabel;
    element("mission-mode").textContent = state.active ? state.timeScale === 0 ? "СИМУЛЯЦИЯ НА ПАУЗЕ" : "ОПЕРАЦИЯ АКТИВНА" : state.result === "objective" ? "ЦЕЛЬ ДОСТИГНУТА" : state.started ? "СЦЕНАРИЙ ЗАВЕРШЁН" : country ? "СТАРТ ПОДТВЕРЖДЁН" : "ВЫБОР СТАРТА";
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
    renderRealtimeControls();
    renderScenarioObjective();
    renderCountryProfile();
    renderWorldMap();
  }

  /** Проверяет, выполнено ли требование предыдущего уровня адаптации. */
  function meetsUpgradeRequirement(upgrade) {
    return !upgrade.requires || hasUpgrade(upgrade.requires);
  }

  /** Возвращает короткое имя требуемой адаптации для подсказки. */
  function upgradeRequirementName(upgrade) {
    return upgrade.requires ? upgradesById.get(upgrade.requires)?.name || "предыдущий уровень" : "";
  }

  /** Отрисовывает ветвящееся дерево безопасных игровых адаптаций. */
  function renderUpgrades() {
    const grid = element("upgrade-grid");
    grid.innerHTML = "";
    UPGRADE_BRANCHES.forEach(branch => {
      const section = document.createElement("section");
      section.className = "evolution-branch";
      section.innerHTML = `<header><span>${branch.code}</span><b>${branch.name}</b><small>${branch.hint}</small></header>`;
      const stack = document.createElement("div");
      stack.className = "trait-stack";
      UPGRADES.filter(upgrade => upgrade.branch === branch.id).forEach(upgrade => {
        const unlocked = hasUpgrade(upgrade.id);
        const requirementMet = meetsUpgradeRequirement(upgrade);
        const affordable = state.signal >= upgrade.cost;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `upgrade-card trait-card tier-${upgrade.tier} ${unlocked ? "unlocked" : ""} ${!requirementMet ? "locked" : ""}`;
        button.disabled = unlocked || !state.started || !requirementMet || !affordable;
        const status = unlocked ? "УСТАНОВЛЕНО" : !requirementMet ? `НУЖНО: ${upgradeRequirementName(upgrade)}` : `${upgrade.cost} CP${upgrade.alert ? ` · +${upgrade.alert}% ВНИМАНИЯ` : ""}`;
        button.innerHTML = `<small>${upgrade.tier === 1 ? "БАЗОВЫЙ УРОВЕНЬ" : `УРОВЕНЬ ${upgrade.tier}`} · ${status}</small><strong>${upgrade.name}</strong><em>${upgrade.effect}</em><span class="trait-tradeoff">${upgrade.tradeoff}</span>`;
        button.addEventListener("click", () => buyUpgrade(upgrade));
        stack.appendChild(button);
      });
      section.appendChild(stack);
      grid.appendChild(section);
    });
    element("upgrade-note").textContent = state.started ? `${state.signal} CP ДОСТУПНО` : "ЗАПУСТИ СЦЕНАРИЙ";
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
    element("latest-event").textContent = state.log[0] || "В журнале пока нет событий.";
    element("log-status").textContent = state.active ? "СЦЕНАРИЙ АКТИВЕН" : state.started ? "КОНТУР ОСТАНОВЛЕН" : "СРЕДА ГОТОВА";
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
    element("save-hint").textContent = saved ? "Найдено локальное сохранение сценария. Продолжение восстановит карту, дерево развития и ход времени." : "Сохранения пока нет. Новая игра начнётся с выбора учебного сценария.";
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
      stealth: 3,
      speed: 3,
      resilience: 2,
      selectedCountry: null,
      inspectedCountry: null,
      countries: countryStates(),
      started: false,
      active: false,
      result: null,
      turn: 0,
      signal: 4,
      alert: 8,
      timeScale: 1,
      elapsedMilliseconds: 0,
      tickElapsed: 0,
      upgrades: [],
      economicDamage: 0,
      scenarioProfit: 0,
      log: [`Учебная модель «${scenario?.name || "Сценарий"}» подготовлена. Выбери страну старта на мировой карте.`]
    });
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
      timeScale: TIME_SCALES.has(Number(loaded.timeScale)) ? Number(loaded.timeScale) : 1,
      elapsedMilliseconds: Number.isFinite(loaded.elapsedMilliseconds) ? loaded.elapsedMilliseconds : 0,
      tickElapsed: Number.isFinite(loaded.tickElapsed) ? clamp(loaded.tickElapsed, 0, BASE_TICK_MS) : 0,
      result: typeof loaded.result === "string" ? loaded.result : null,
      economicDamage: Number.isFinite(loaded.economicDamage) ? loaded.economicDamage : 0,
      scenarioProfit: Number.isFinite(loaded.scenarioProfit) ? loaded.scenarioProfit : 0,
      log: Array.isArray(loaded.log) ? loaded.log.slice(0, 12) : ["Сценарий восстановлен из локального сохранения."]
    });
    previousFrameTime = performance.now();
    showScreen("game");
    renderAll();
  }

  /** Перерисовывает все игровые панели и сохраняет актуальное состояние. */
  function renderAll() {
    renderScenarioIdentity();
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
    pushLog(`Выбрана стартовая страна: ${country.name}. Контекст региона добавлен в учебную модель.`);
    renderAll();
  }

  /** Запускает подготовленную игровую кампанию из выбранной страны. */
  function launchSimulation() {
    if (!state.selectedCountry || state.started) return;
    state.started = true;
    state.active = true;
    state.countries[state.selectedCountry] = "seed";
    state.inspectedCountry = state.selectedCountry;
    previousFrameTime = performance.now();
    const country = countriesById.get(state.selectedCountry);
    state.alert = clamp(5 + country.defense * .13 - effectiveStats().stealth + threatModifiers().alert, 3, 25);
    pushLog(`Сценарий активирован в стране «${country.name}». Начальная отметка внесена в карту.`);
    renderAll();
  }

  /** Покупает доступную адаптацию и применяет её цену заметности. */
  function buyUpgrade(upgrade) {
    if (!state.started || hasUpgrade(upgrade.id) || !meetsUpgradeRequirement(upgrade) || state.signal < upgrade.cost) return;
    state.signal -= upgrade.cost;
    state.upgrades.push(upgrade.id);
    state.alert = clamp(state.alert + (upgrade.alert || 0), 0, 100);
    pushLog(`Адаптация «${upgrade.name}» установлена за ${upgrade.cost} CP${upgrade.alert ? `; внимание контура +${upgrade.alert}%` : ""}.`);
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

  /** Разыгрывает безопасное контекстное событие и возвращает его влияние на развитие карты. */
  function resolveBackgroundEvent() {
    const country = randomItem(activeCountries());
    const chance = .12 + country.noise * .0025 + (hasUpgrade("switchback") ? .12 : 0);
    if (Math.random() > chance) return 0;
    const events = [
      { message: `Пользовательская активность в ${country.name} изменила поведенческий профиль среды.`, spread: .17, alert: -4, positive: true },
      { message: `Региональный цикл обновлений в ${country.name} сузил доступную учебную поверхность.`, spread: -.07, alert: 3, positive: false },
      { message: `Защитный мониторинг в ${country.name} повысил качество наблюдения за аномалиями.`, spread: -.04, alert: 5, positive: false },
      { message: `Неоднородность цифровой среды в ${country.name} кратко ослабила точность защитного контура.`, spread: .08, alert: -2, positive: true }
    ];
    const event = randomItem(events);
    const adaptiveAlert = event.alert < 0 && hasUpgrade("adaptiveRhythm") ? -3 : 0;
    pushLog(event.message);
    state.alert = clamp(state.alert + event.alert + adaptiveAlert, 0, 100);
    if (event.positive && hasUpgrade("responseWindow")) {
      state.signal += 1;
      pushLog("Окно ответа преобразовало фоновое событие в 1 Compute Point.");
    }
    return event.spread;
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

  /** Иногда возвращает один изолированный узел в модель после развития устойчивости. */
  function recoverContainedNode() {
    if (!hasUpgrade("recoveryLoop") || state.turn % 4 !== 0 || Math.random() > .35) return;
    const candidates = COUNTRIES.filter(country => state.countries[country.id] === "contained");
    if (!candidates.length) return;
    const target = randomItem(candidates);
    state.countries[target.id] = "infected";
    state.alert = clamp(state.alert + 2, 0, 100);
    pushLog(`Контур восстановления вернул в модель узел «${target.name}», повысив внимание на 2%.`);
  }

  /** Продвигает кампанию на один игровой цикл и пересчитывает её абстрактные показатели. */
  function advanceCycle() {
    if (!state.active) return;
    state.turn += 1;
    const stats = effectiveStats();
    const targets = openNeighbors();
    const backgroundBonus = resolveBackgroundEvent();
    const attempts = Math.min(targets.length, 1 + Math.floor(stats.speed / 4) + (hasUpgrade("relayMap") ? 1 : 0) + (hasUpgrade("wideMap") ? 1 : 0));
    let newSignals = 0;
    const sourceActivity = activeCountries().reduce((total, country) => total + country.activity, 0) / Math.max(1, activeCountries().length);
    for (let index = 0; index < attempts; index += 1) {
      const candidates = openNeighbors();
      if (!candidates.length) break;
      const target = randomItem(candidates);
      const chance = .18 + stats.speed * .052 + sourceActivity * .0025 + backgroundBonus + (hasUpgrade("cascade") ? .08 : 0) - target.defense * .0027;
      if (Math.random() < chance) {
        state.countries[target.id] = "infected";
        newSignals += 1;
        pushLog(`Модель зафиксировала новую затронутую территорию: «${target.name}». Регион добавлен в карту кампании.`);
      }
    }
    if (!newSignals) pushLog("Новая отметка не появилась: условия среды и защитный контур удержали текущую границу кампании.");
    let computeGain = 1 + newSignals + (newSignals && hasUpgrade("chorus") ? 1 : 0);
    if (hasUpgrade("resourceCache") && state.turn % 3 === 0) computeGain += 1;
    const scenarioEconomy = activeThreatType().economy;
    const activeCount = activeCountries().length;
    const profileMultiplier = scenarioResultMultiplier();
    const pressureMultiplier = scenarioEconomy.impact >= scenarioEconomy.yield ? profileMultiplier : 1;
    const profitMultiplier = scenarioEconomy.yield > scenarioEconomy.impact ? profileMultiplier : 1;
    const pressureGain = (4 + activeCount * 3 + newSignals * 9) * scenarioEconomy.impact / 100 * pressureMultiplier;
    const profitGain = (1 + newSignals + Math.max(0, 35 - state.alert) / 35) * scenarioEconomy.yield / 100 * profitMultiplier;
    if (hasUpgrade("compoundYield") && Math.round(pressureGain) + Math.round(profitGain) >= 8) computeGain += 1;
    state.signal += computeGain;
    state.economicDamage += Math.round(pressureGain);
    state.scenarioProfit += Math.round(profitGain);
    const averageDefense = activeCountries().reduce((total, country) => total + country.defense, 0) / Math.max(1, activeCountries().length);
    const awarenessStep = 3 + averageDefense * .028 - stats.stealth * .52 - (hasUpgrade("veil") ? 1.1 : 0) - (hasUpgrade("shadowBalance") ? .7 : 0);
    const markAttention = newSignals * (hasUpgrade("shadowBalance") ? 1.5 : 2.2);
    state.alert = clamp(state.alert + awarenessStep + markAttention, 0, 100);
    if (hasUpgrade("campaignDiscipline") && !newSignals) state.alert = clamp(state.alert - 1, 0, 100);
    containSignal();
    recoverContainedNode();
    const influenced = activeCountries().length;
    if (evaluateScenarioObjective()) {
      // Завершение и запись в журнал выполняются внутри проверки цели.
    } else if (influenced === COUNTRIES.length) {
      state.active = false;
      state.result = "coverage";
      pushLog("Сценарий завершён: весь игровой мир отмечен сигналом до полной изоляции.");
    } else if (state.alert >= 100) {
      state.active = false;
      state.result = "contained";
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
    state.result = null;
    state.turn = 0;
    state.signal = 4;
    state.alert = 8;
    state.timeScale = 1;
    state.elapsedMilliseconds = 0;
    state.tickElapsed = 0;
    previousFrameTime = performance.now();
    state.upgrades = [];
    state.economicDamage = 0;
    state.scenarioProfit = 0;
    state.log = ["Учебная среда сброшена. Выбери новую страну старта на мировой карте."];
    renderAll();
  }

  element("continue-game").addEventListener("click", continueGame);
  element("launch-simulation").addEventListener("click", launchSimulation);
  element("advance-turn").addEventListener("click", advanceCycle);
  element("reset-simulation").addEventListener("click", resetSimulation);
  element("time-controls").addEventListener("click", event => {
    const button = event.target.closest("[data-time-scale]");
    if (button) setTimeScale(button.dataset.timeScale);
  });
  window.addEventListener("resize", renderWorldMap);
  window.addEventListener("pagehide", saveGame);
  document.addEventListener("visibilitychange", () => {
    previousFrameTime = performance.now();
  });

  renderStartScreen();
  if (!consumeScenarioDraft()) {
    renderAll();
    showScreen("start");
  }
  window.requestAnimationFrame(processRealtimeFrame);
})();
