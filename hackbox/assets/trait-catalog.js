// Формирует безопасную библиотеку игровых трейтов для сценариев HackBox.
(() => {
  const catalog = window.HACKBOX_SCENARIO_CATALOG || {};
  const TRAITS_PER_SCENARIO = 200;
  const HYBRID_TRAIT_SHARE = .15;
  const MIN_HYBRID_TRAITS_IN_DECK = 3;
  const BRANCHES = ["surface", "detection", "resilience", "impact", "response", "campaign"];

  const MODELS = [
    { name: "стабильная телеметрия", summary: "телеметрия — поток технических сигналов — меняется предсказуемо, поэтому риск проще оценить", tradeoff: "защитному контуру тоже проще заметить устойчивую картину" },
    { name: "адаптивная телеметрия", summary: "пересчитывает приоритет, когда меняется темп событий в симуляции", tradeoff: "делает результат менее ровным от цикла к циклу" },
    { name: "приоритет сегментации", summary: "сегментация — разделение среды на изолированные части — сильнее влияет на выбор региона", tradeoff: "сужает общий охват карты" },
    { name: "распределённая корреляция", summary: "корреляция сопоставляет сигналы из нескольких регионов, чтобы видеть общую картину", tradeoff: "увеличивает заметность кампании" },
    { name: "длинный жизненный цикл", summary: "раскрывает ценность после нескольких игровых циклов", tradeoff: "не даёт мгновенного результата" }
  ];

  const CONTEXTS = [
    { name: "низкий телеметрический шум", summary: "в среде меньше посторонних событий, поэтому важные изменения видно яснее" },
    { name: "разнородная инфраструктура", summary: "игровые регионы отличаются по условиям и реакции на сценарий" },
    { name: "высокая сетевая связность", summary: "регионы сильнее связаны, поэтому выбор маршрута на карте важнее" },
    { name: "зрелая защита", summary: "патчи, мониторинг и EDR быстрее повышают ответ защитного контура" },
    { name: "изменчивая политика защиты", summary: "после событий среды защитные приоритеты могут быстро меняться" }
  ];

  const LENSES = [
    { name: "граф зависимостей", summary: "показывает, какие игровые регионы сильнее связаны между собой", tradeoff: "требует от игрока точного выбора цели" },
    { name: "аномальная телеметрия", summary: "выделяет необычные сигналы, которые могут привлечь наблюдение", tradeoff: "оставляет больше заметных следов для защитной реакции" },
    { name: "устойчивость к сегментации", summary: "снижает игровую цену изоляции одной отмеченной территории", tradeoff: "не ускоряет карту напрямую" },
    { name: "оценка воздействия", summary: "измеряет условный эффект сценария на процессы и экономику", tradeoff: "отвлекает ресурс от расширения" },
    { name: "поведенческая аналитика", summary: "учитывает, как меняется реакция защиты на действия игрока", tradeoff: "не отменяет защитные контрмеры" },
    { name: "оперативный буфер", summary: "поддерживает выбор между директивами игрока в реальном времени", tradeoff: "работает только при активном решении" },
    { name: "профилирование кампании", summary: "делает долгую сессию более управляемой и объяснимой", tradeoff: "не даёт разового всплеска" },
    { name: "контекст бизнес-риска", summary: "связывает условную выгоду с текущим состоянием игрового мира", tradeoff: "может поднять внимание контура" }
  ];

  const TYPE_FOCUSES = {
    virus: { name: "Файловая целостность", focus: "устойчивость уже отмеченных элементов цифровой среды" },
    worm: { name: "Сетевая связность", focus: "темп расширения географической карты" },
    trojan: { name: "Контекст доверия", focus: "низкая заметность сценария для наблюдающих систем" },
    spyware: { name: "Контекст наблюдения", focus: "долгий условный результат при низком уровне шума" },
    keylogger: { name: "Риск пользовательского ввода", focus: "стабильный результат спокойной кампании" },
    ransomware: { name: "Доступность сервисов", focus: "заметный условный эффект на цифровые процессы" },
    rootkit: { name: "Уровень присутствия", focus: "устойчивость игрового профиля при изоляции" },
    backdoor: { name: "Повторный контур", focus: "сохранение отмеченных регионов на карте" },
    botnet: { name: "Распределённое управление", focus: "масштаб связанной карты" },
    adware: { name: "Навязчивое отображение", focus: "регулярный небольшой условный результат" },
    pup: { name: "Пограничное ПО", focus: "умеренный и устойчивый темп" },
    cryptojacker: { name: "Вычислительная нагрузка", focus: "накопление условной выгоды" },
    logicBomb: { name: "Условное состояние", focus: "отложенный сценарный эффект" },
    fileless: { name: "Эфемерные следы", focus: "снижение ранней заметности" },
    webSkimmer: { name: "Веб-интерфейс", focus: "долгая спокойная кампания" },
    mobile: { name: "Мобильная поверхность", focus: "равновесный темп и устойчивость" },
    macroVirus: { name: "Документная автоматизация", focus: "последовательное расширение карты" },
    bootVirus: { name: "Ранний запуск", focus: "заметное стартовое давление" },
    polymorphic: { name: "Изменчивость сигнатур", focus: "гибкость при реакции защиты" },
    networkExploit: { name: "Сетевая поверхность", focus: "быстрый, но рискованный темп" },
    clipper: { name: "Целостность пользовательского потока", focus: "стабильная условная выгода" },
    infostealer: { name: "Конфиденциальная информация", focus: "высокая ценность при росте заметности" },
    wiper: { name: "Целостность данных", focus: "максимальный условный эффект" }
  };

  /** Возвращает предсказуемое число для выбора игрового трейта без случайной пересборки сохранения. */
  function stableNumber(value) {
    return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
  }

  /** Приводит техническое пояснение к читаемому началу предложения. */
  function sentence(value) {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  /** Собирает ровно 200 безопасных игровых трейтов для одного класса сценария. */
  function buildScenarioTraits(scenarioId) {
    const theme = TYPE_FOCUSES[scenarioId] || { name: catalog[scenarioId]?.name || "Учебный профиль", focus: "баланс кампании" };
    const traits = [];
    MODELS.forEach((model, modelIndex) => {
      CONTEXTS.forEach((context, contextIndex) => {
        LENSES.forEach((lens, lensIndex) => {
          const ordinal = traits.length + 1;
          traits.push({
            id: `${scenarioId}-trait-${String(ordinal).padStart(3, "0")}`,
            scenarioId,
            ordinal,
            branch: BRANCHES[ordinal % BRANCHES.length],
            tier: Math.floor((ordinal - 1) / BRANCHES.length) % 3 + 1,
            name: `${theme.name}: ${lens.name} / ${model.name} / ${context.name}`,
            summary: `${sentence(theme.focus)}. ${sentence(lens.summary)}. ${sentence(model.summary)}. Контекст: ${context.summary}.`,
            tradeoff: `${sentence(lens.tradeoff)}; ${model.tradeoff}.`,
            tags: [modelIndex, contextIndex, lensIndex]
          });
        });
      });
    });
    if (traits.length !== TRAITS_PER_SCENARIO) throw new Error("Неполная библиотека игровых трейтов");
    return traits;
  }

  const traitsByScenario = Object.fromEntries(Object.keys(catalog).map(id => [id, buildScenarioTraits(id)]));

  /** Возвращает полную библиотеку трейтов выбранного сценария. */
  function listScenarioTraits(scenarioId) {
    return traitsByScenario[scenarioId] ? [...traitsByScenario[scenarioId]] : [];
  }

  /** Возвращает совместимый по ветви и уровню трейт для отображаемого слота дерева. */
  function traitForSlot(traits, branch, tier, seed) {
    const candidates = traits.filter(trait => trait.branch === branch && trait.tier === tier);
    return candidates[stableNumber(`${seed}:${branch}:${tier}`) % candidates.length];
  }

  /** Объединяет два трейта в безопасный игровой гибрид без описания реальных техник. */
  function combineTraits(primary, secondary) {
    return {
      ...primary,
      id: `${primary.id}--${secondary.id}`,
      name: `${primary.name} × ${secondary.name}`,
      summary: `Комбинированный игровой трейт: ${primary.summary} Дополняется профилем «${secondary.name}».`,
      tradeoff: `${primary.tradeoff} Совмещение повышает ценность кампании для защитного контура.`,
      sources: [primary.scenarioId, secondary.scenarioId],
      hybrid: true
    };
  }

  /** Создаёт колоду из 18 отображаемых трейтов; при гибриде минимум 15% колоды объединяется. */
  function buildTraitDeck(primaryId, hybridIds = []) {
    const primaryTraits = listScenarioTraits(primaryId);
    const validHybridIds = [...new Set(hybridIds)].filter(id => id !== primaryId && traitsByScenario[id]).slice(0, 2);
    const slots = BRANCHES.flatMap(branch => [1, 2, 3].map(tier => ({ branch, tier })));
    const traits = slots.map((slot, index) => ({ ...traitForSlot(primaryTraits, slot.branch, slot.tier, `${primaryId}:${index}`), slot }));
    const hybridTraitCount = validHybridIds.length ? Math.max(MIN_HYBRID_TRAITS_IN_DECK, Math.ceil(traits.length * HYBRID_TRAIT_SHARE)) : 0;
    const spacing = hybridTraitCount ? Math.floor(traits.length / hybridTraitCount) : 0;
    for (let index = 0; index < hybridTraitCount; index += 1) {
      const deckIndex = Math.min(traits.length - 1, index * spacing + 1);
      const baseTrait = traits[deckIndex];
      const hybridId = validHybridIds[index % validHybridIds.length];
      const hybridTrait = traitForSlot(listScenarioTraits(hybridId), baseTrait.slot.branch, baseTrait.slot.tier, `${primaryId}:${hybridId}:${deckIndex}`);
      traits[deckIndex] = { ...combineTraits(baseTrait, hybridTrait), slot: baseTrait.slot };
    }
    return {
      traits,
      librarySize: primaryTraits.length,
      hybridTraitCount,
      hybridShare: traits.length ? hybridTraitCount / traits.length : 0
    };
  }

  /** Возвращает метаданные библиотеки для интерфейса конструктора. */
  function traitCoverage(primaryId, hybridIds = []) {
    const deck = buildTraitDeck(primaryId, hybridIds);
    return {
      totalTraits: deck.librarySize,
      deckSize: deck.traits.length,
      hybridTraitCount: deck.hybridTraitCount,
      hybridShare: deck.hybridShare
    };
  }

  window.HACKBOX_TRAIT_CATALOG = {
    TRAITS_PER_SCENARIO,
    HYBRID_TRAIT_SHARE,
    MIN_HYBRID_TRAITS_IN_DECK,
    buildTraitDeck,
    listScenarioTraits,
    traitCoverage
  };
})();
