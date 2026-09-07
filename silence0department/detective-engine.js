/* Deterministic case stories and state transitions, shared by the game and tests. */
((root) => {
  "use strict";

  const PROFILES = [
    { id: "death", base: "death", label: "Сомнительная смерть", pitch: "Семья не верит официальному заключению. Кто-то очень хочет закрыть дело." },
    { id: "disappearance", base: "disappearance", label: "Пропавшие люди", pitch: "Последний маршрут, чужой телефон и человек, которому выгодно ваше опоздание." },
    { id: "theft", base: "theft", label: "Хищение и подмена", pitch: "Безупречные пломбы, ненадёжный заказчик и оригинал, которого никто не видел." },
    { id: "sabotage", base: "sabotage", label: "Корпоративный саботаж", pitch: "Реальная неисправность прикрывает намеренное вмешательство." },
    { id: "blackmail", base: "blackmail", label: "Шантаж и двойная игра", pitch: "Заказчик платит за правду, но какую её часть он согласен услышать?" },
    { id: "stalker", base: "blackmail", label: "Одержимый преследователь", pitch: "Кто-то знает распорядок жертвы лучше неё самой. Защитите свидетеля и найдите источник слежки.", motives: ["навязчивая потребность восстановить контроль", "месть за давнее предательство"] },
    { id: "serial", base: "death", label: "Серийный убийца", pitch: "Три смерти связаны непубличной деталью. Четвёртая история ещё не закончилась.", motives: ["навязчивая потребность восстановить контроль", "месть за давнее предательство", "устранение свидетеля старого преступления"] },
    { id: "copycat", base: "death", label: "Маньяк или подражатель", pitch: "Слишком знакомый почерк. Повторяется ли преступление — или только газетная версия?", motives: ["страх разоблачения", "сокрытие хищения", "месть за давнее предательство"] },
    { id: "contract", base: "death", label: "Заказное убийство", pitch: "Исполнитель оставил меньше следов, чем человек, который за него заплатил.", motives: ["принуждение к молчанию ради третьего лица", "устранение свидетеля старого преступления"] },
    { id: "mercenary", base: "death", label: "Профессиональный наёмник", pitch: "Встречное расследование: пока вы ищете исполнителя, он ищет вас. Реальный таймер и риск гибели.", timed: true, motives: ["устранение свидетеля старого преступления", "принуждение к молчанию ради третьего лица"] },
  ];
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  const shuffle = (rng, list) => {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  function selectProfile(rng, requested, difficulty) {
    if (difficulty === "tutorial") return PROFILES[0];
    return PROFILES.find((profile) => profile.id === requested) || pick(rng, PROFILES);
  }

  function enrich(data, profile, rng) {
    const culprit = data.suspects.find((person) => person.id === data.culpritId);
    const innocents = shuffle(rng, data.suspects.filter((person) => person.id !== data.culpritId));
    const decoy = innocents[0];
    const witness = innocents[innocents.length - 1];
    const token = `Р-${Math.floor(1000 + rng() * 9000)}`;
    const address = pick(rng, ["мастерская у трамвайного депо", "закрытая фотолаборатория", "склад реквизита на набережной", "пункт возврата служебного оборудования"]);
    const weather = pick(rng, ["Дождь шуршит по водостоку. Внутри пахнет пылью и остывшим кофе.", "Рассвет ещё не наступил. Лампа над входом включается через раз.", "После ночной грозы отключён лифт. Из двора доносится голос радиоприёмника."]);
    const twist = pick(rng, ["client", "frame", "witness"]);
    const signature = pick(rng, ["сложенная внутрь квитанция с оборванным нижним краем", "белая нить под непрозрачной пломбой", "двойной оттиск на внутренней стороне конверта"]);
    const titles = {
      stalker: ["Кто-то уже был дома", "Человек напротив", "Маршрут без свидетелей"],
      serial: ["Третья пустая комната", "Список тех, кто не вернулся", "Четвёртая фамилия"],
      copycat: ["Чужая подпись", "Слишком знакомая смерть", "Ошибка подражателя"],
      contract: ["Оплаченная тишина", "Последний посредник", "Счёт за отсутствие"],
      mercenary: ["Встречная охота", "Ваш адрес уже ищут", "Два расследования до рассвета"],
    };
    const hooks = {
      death: "На столе лежат два заключения об одном событии. Заказчик просит подтвердить самое удобное. В копии отсутствует последняя страница.",
      disappearance: "В бюро принесли голосовое сообщение: «Не ищите меня». Близкие узнают голос, но привычное обращение звучит неправильно. Неясно, кому предназначалась запись.",
      theft: "Владелец требует вернуть оригинал до открытия выставки. Страховщик утверждает, что оригинал никогда не поступал. Оба показывают подлинные документы.",
      sabotage: "Трое признаются в нарушениях, и каждый уверен, что именно его ошибка вызвала аварию. Но резервный журнал показывает ещё одно вмешательство.",
      blackmail: "Заказчик уже дважды платил. Третье требование содержит факт, который знали только участники закрытой встречи. Теперь кто-то подделывает их переписку.",
      stalker: "В конверте у двери лежат фотографии из разных дней и билет на завтрашнюю поездку. Адрес поездки никто не публиковал. Близкий человек просит не обращаться за помощью.",
      serial: `Две старые смерти сочли несвязанными. В новом материале повторяется непубличная деталь: ${signature}. Родственники жертв впервые встречаются в вашем бюро.`,
      copycat: `Газеты пишут о возвращении маньяка. Повторяется ${signature}, но журналисты когда-то напечатали её зеркальное изображение. Вам нужно добыть оригиналы старого дела.`,
      contract: "Перед смертью человек отменил встречу, о которой знал только посредник. На следующий день погашен чужой долг. Заказчик просит найти исполнителя и не трогать расчёты.",
      mercenary: "Клиент приходит без телефона. Его источник погиб, а в открытом доступе появилась фотография входа в ваше бюро. Исполнитель завершает контракт и устанавливает тех, кто копирует материалы.",
    };
    const turnText = {
      client: `Заказчик ${data.commissioner.name} удерживает приложение к договору. Там зафиксирован отдельный платёж, который объясняет интерес к быстрому закрытию дела.`,
      frame: `В анонимном пакете фигурирует ${decoy.name}. Бумага подлинная, но дата нанесена позже: кто-то соединяет старый проступок с новым событием.`,
      witness: `${witness.name} скрывает контакт из-за угроз близким. Источник страха реален, но признание в чужом проступке не заменяет проверку алиби.`,
    };
    data.caseKind = profile.id;
    data.profile = profile;
    data.title = titles[profile.id] ? pick(rng, titles[profile.id]) : data.title;
    data.archetype = { ...data.archetype, label: profile.label };
    data.circumstance = `${hooks[profile.id]}\n\n${data.circumstance}`;
    data.mandateText = `«${data.victim.name}» — центральное имя в моём поручении. Проверьте официальную версию и принесите подтверждения, которые можно независимо перепроверить. ${profile.pitch}`;
    data.story = { twist, decoyId: decoy.id, witnessId: witness.id, token, signature, weather,
      secondary: ["serial", "stalker", "mercenary"].includes(profile.id),
      deadlineMinutes: profile.timed ? ({ observer: 50, detective: 40, inspector: 30 }[data.difficultyKey] || 50) : 0,
      hook: hooks[profile.id], turn: turnText[twist] };

    const lives = shuffle(rng, [
      { need: "Через час нужно забирать ребёнка с репетиции. Я всё время смотрю на часы из-за этого.", memory: "Каждый вторник мы брали чай в одном киоске. Теперь я обхожу его стороной.", boundary: "Только не включайте имя моей семьи в копию для заказчика." },
      { need: "Дома ждёт больной отец. Я оставлю телефон включённым, если это не помешает.", memory: "Мне до сих пор приходит напоминание о нашей последней встрече. Не получается его удалить.", boundary: "Я отвечу, но не при работодателе." },
      { need: "После ночной смены слова путаются. Дайте минуту вспомнить по порядку.", memory: "Мы поспорили из-за пустяка. Я всё собираюсь написать извинение, потом вспоминаю, зачем вы пришли.", boundary: "Обещать ничего не надо. Просто записывайте мои слова точно." },
      { need: "В кармане билет в другой город. Выезд завтра, но сейчас я уже не знаю, поеду ли.", memory: "Мне вернули одолженную книгу. Между страницами остался наш старый чек.", boundary: "Я боюсь не ваших вопросов. Я боюсь того, кто узнает мои ответы." },
      { need: "Кофе остыл, пока я жду. Можно просто начать, без вступления?", memory: "На телефоне осталось голосовое сообщение. Я прослушиваю только первые три секунды.", boundary: "Если чего-то не помню, я так и скажу. Не дописывайте за меня." },
      { need: "На работе уже нашли замену на мою смену. Не знаю, пустят ли меня обратно.", memory: "Мне всё кажется, что сейчас скрипнет дверь и этот разговор окажется ненужным.", boundary: "Разговор добровольный. Давайте без угроз, и я останусь." },
    ]);
    data.suspects.forEach((person, index) => {
      person.life = lives[index % lives.length];
      person.contactId = data.suspects[(index + 1) % data.suspects.length].id;
      person.contactReason = pick(rng, ["совместная аренда кладовой", "обмен сменами", "заём на ремонт", "знакомство через семью"]);
    });

    const evidence = (id, title, content, lockedBy, extra = {}) => ({ id, code: `П-${String(data.evidence.length + 1).padStart(2, "0")}`, title, content,
      excerpt: content.split("\n")[0], type: "document", tags: ["поле", profile.label], relevant: true,
      reliability: "документированный источник; сопоставьте с независимыми материалами", status: "требует сопоставления", lockedBy, ...extra });
    const add = (...args) => { const item = evidence(...args); data.evidence.push(item); return item.id; };
    const traceId = add("field-trace", "Осмотр: след и контрольный образец", `Объект: ${data.incidentAddress}.\nНаблюдение: ${data.trace}.\nКонтрольный образец из неповреждённой зоны исключает бытовое происхождение. Эксперт сопоставил его с первичным осмотром: механизм — ${data.method}.\nВ журнале выдачи упаковки указан код ${token}; получателя нужно проверить по оригиналу. След ведёт в место «${address}».`, "field-trace", { type: "forensics" });
    const decoyId = add("field-decoy", "Анонимный пакет: убедительное обвинение", `«Проверьте ${decoy.name}. Конфликт скрывают, а в приложении есть подпись».\nСтарый документ действительно содержит это имя. Конверт не имеет обратного адреса; связь даты с основным событием пока не установлена.`, "field-decoy", { relevant: false, status: "непроверенное обвинение", reliability: "анонимный источник" });
    const identityId = add("field-identity", "Оригинал выдачи: кто получил предмет", `Код ${token} совпадает с упаковкой на месте события.\nПолучатель: ${culprit.name}. В книге выдачи сохранены подпись и контрольный кадр получения. Возврат зарегистрирован после критического окна.\nФакт получения ещё не доказывает использование предмета: нужна независимая отметка у места события.`, "field-identity");
    const motiveId = add("field-motive", "Приложение к договору и личная переписка", `${turnText[twist]}\nОригиналы получены с согласия владельца и сверены с копией другой стороны. В переписке участника «${culprit.name}» прямо описан интерес: ${data.motive}.\nЭто подтверждает мотив, но не механизм и не присутствие. Имя второго участника: ${data.commissioner.name}; его собственный интерес — ${data.commissioner.interest}.`, "field-motive");
    const corroborationId = add("field-corroboration", "Независимая запись у бокового входа", `Владелец соседнего помещения предоставил оригинал записи с независимыми часами.\n${culprit.name} находится у служебной двери в критическое окно с упаковкой ${token}; последовательность движения непрерывна.\nВместе с книгой выдачи и контрольным образцом это связывает человека, предмет и событие. Телефон и общий пропуск по отдельности такой связи не давали.`, "field-corroboration", { type: "digital" });
    const exclusionId = add("field-exclusion", "Проверка анонимного обвинения", `Оригинал контрольной ведомости и непрерывная запись удалённой проходной совпадают.\n${decoy.name} находится на другом объекте на протяжении всего критического окна. Подпись из анонимного пакета относится к старому конфликту.\n${turnText[twist]}\nВывод: эта линия объясняет личную ложь, но исключается как объяснение основного события.`, "field-exclusion");
    const series = ["serial", "copycat"].includes(profile.id);
    if (series) add("field-series", "Сопоставление трёх эпизодов", profile.id === "serial"
      ? `Эпизоды: за 41 день, за 19 дней и текущий. Во всех оригиналах — ${signature}. В газетах эта деталь отсутствовала. Все три места обслуживал один подрядчик; книга выдачи ${token} и запись бокового входа позволяют проверить нынешнего исполнителя.\nПоследний контакт ещё жив: ${witness.name}. Передайте предупреждение через безопасный канал.`
      : `В двух архивных оригиналах — ${signature}. В новом эпизоде деталь воспроизведена зеркально, как в ошибочной газетной фотографии. Другие материальные признаки не совпадают.\nЭто подражание, а не подтверждение общего исполнителя. Текущий эпизод нужно доказывать по его собственным следам.`, "field-series");
    else add("field-series", "Обратная сторона поручения", `${turnText[twist]}\n${profile.id === "contract" || profile.timed ? `В оригиналах расчётов назначение платежа скрыто, но код ${token} совпадает с выдачей. Получатель — ${culprit.name}; роль плательщика требует отдельного производства.` : `Сопоставьте личный интерес заказчика с его первоначальным поручением. Подтверждённый факт: ${data.incidental}.`}`, "field-series");

    const spot = (id, label, description, tool, evidenceId, finding) => ({ id, label, description, tool, evidenceId, finding });
    data.scenes = [
      { id: "scene", name: "Место события", subtitle: data.incidentAddress, atmosphere: weather, requires: null, spots: [
        spot("residue", "Повреждённая поверхность", "У края заметна чужеродная частица. Простого снимка для сравнения недостаточно.", "sample", traceId, "Образец и контрольная проба упакованы отдельно. Экспертная сверка и адрес выдачи добавлены в архив."),
        spot("envelope", "Конверт под дверью", "Клапан не запечатан. Внутри виден заголовок с фамилией.", "inspect", decoyId, "Анонимное обвинение зарегистрировано. Его происхождение пока неизвестно."),
        spot("window", "Окно во двор", "На стекле отражается камера соседнего помещения.", "photo", null, "На снимке читается номер соседнего помещения. Запись следует запросить у владельца, после привязки найденного предмета."),
        spot("cup", "Чашка на подоконнике", "Под дном сухое кольцо пыли; рядом свежая салфетка.", "inspect", null, "Чашка стояла здесь до события. Бытовой след не подтверждает присутствия подозреваемого."),
        spot("notice", "Лист у входа", "На листе видны две разные даты обслуживания.", "photo", null, "Даты относятся к разным приборам. Кажущееся противоречие имеет обычное объяснение."),
      ] },
      { id: "depot", name: "По следу предмета", subtitle: address, atmosphere: "Сотрудник открывает журнал на чистой странице. Следующая страница вырвана, но копия осталась у получателя.", requires: traceId, spots: [
        spot("ledger", "Книга выдачи", `В алфавитном указателе есть код ${token}. Нужно сравнить оригинал и контрольную копию.`, "compare", identityId, "Код упаковки привязан к получателю. Открылся адрес независимой записи."),
        spot("contract", "Приложение к договору", "Нумерация начинается со второй страницы. Отдельно лежит заверенная копия.", "compare", motiveId, "Приложение показывает интерес участника и скрытую часть поручения."),
        spot("oldfiles", series ? "Три архивные папки" : "Папка расчётов", "Нужна сверка первоисточников: копии расходятся в одной детали.", "compare", "field-series", series ? "Сравнение эпизодов готово. Вывод основан на оригиналах." : "Обнаружена обратная сторона поручения. Материал добавлен в архив."),
        spot("locker", "Общий шкафчик", "На полке несколько одинаковых упаковок без личных подписей.", "inspect", null, "Общий доступ не позволяет приписать содержимое одному человеку."),
        spot("receipt", "Кассовая лента", "Время печати и время операции указаны отдельными строками.", "photo", null, "Чек напечатан повторно. Поздняя печать сама по себе не доказывает подделку операции."),
      ] },
      { id: "witness", name: "Независимый источник", subtitle: "Соседнее помещение · с согласия владельца", atmosphere: "Владелец долго не открывает. Наконец из-за двери: «Мне обещали, что моё имя нигде не появится».", requires: identityId, spots: [
        spot("recorder", "Архив регистратора", "Время синхронизировано независимо. Сверьте непрерывную запись с книгой выдачи.", "compare", corroborationId, "Независимая запись связывает получателя с местом и временем события."),
        spot("gate", "Контроль удалённой проходной", "Свидетель сохранил заверенную выгрузку за всё критическое окно.", "compare", exclusionId, "Анонимное обвинение проверено. Ложная линия получила документальное опровержение."),
        spot("calendar", "Бумажный календарь", "Чужой адрес написан на обороте, без даты и подписи.", "inspect", null, "Адрес относится к старой доставке. Совпадение района не устанавливает причастность."),
        spot("intercom", "Панель домофона", "Краска вокруг кнопки стёрта сильнее остальных.", "photo", null, "Это общий вход для доставки. Частоту посещений нельзя превратить в идентификацию."),
        spot("fabric", "Кусочек ткани", "Волокна похожи на находку с места, но цвет немного отличается.", "sample", null, "Контрольная проба не совпала. Внешнее сходство материала оказалось ложной зацепкой."),
      ] },
    ].map((scene) => ({ ...scene, spots: shuffle(rng, scene.spots) }));
    data.fieldStrongIds = [traceId, identityId, corroborationId];
    // Archive relevance is not proof. These three independent sources form one complete route.
    data.strongEvidenceIds = [...new Set([...data.strongEvidenceIds, ...data.fieldStrongIds])];
    return data;
  }

  function initialState(data, now = Date.now()) {
    return { field: { sceneId: "scene", spotId: null, tool: "inspect", found: [], checked: [], attempts: [], log: [], moves: 0 },
      rapport: {}, approach: "calm", presented: {},
      chat: [{ role: "assistant", text: `Я на связи. ${data.story.hook} Начните с осмотра места. Буду проверять ваши версии по найденным материалам.`, at: now }],
      chatDraft: "", reportDraft: null, decisions: { witness: null, client: null, leads: {} },
      pressure: { deadlineAt: data.profile.timed ? now + data.story.deadlineMinutes * 60000 : null, noise: 0, spentMs: 0, breaks: 0, warned: [] },
      outcome: null, lastFieldMessage: "Выберите точку, прочитайте описание и подберите инструмент." };
  }

  function threat(data, state, now = Date.now()) {
    if (!data.profile.timed) return { active: false, remaining: Infinity, exposure: 0 };
    const remaining = Math.max(0, state.pressure.deadlineAt - now - state.pressure.spentMs);
    const elapsed = Math.max(0, 1 - remaining / (data.story.deadlineMinutes * 60000));
    return { active: true, remaining, exposure: Math.max(0, Math.min(100, Math.round(elapsed * 65 + state.pressure.noise))) };
  }

  function checkThreat(data, state, now = Date.now()) {
    if (state.outcome) return false;
    const info = threat(data, state, now);
    if (info.active && (info.remaining <= 0 || info.exposure >= 100)) {
      state.outcome = { kind: "dead", at: now, title: "Наёмник нашёл вас первым", text: "Связь с бюро оборвалась. Исполнитель установил ваше местонахождение и убил детектива. Расследование окончено." };
      return true;
    }
    return false;
  }

  function spend(data, state, seconds, noise = 0, now = Date.now()) {
    if (state.outcome) return;
    if (data.profile.timed) { state.pressure.spentMs += seconds * 1000; state.pressure.noise += noise; }
    checkThreat(data, state, now);
  }

  function examine(data, state, sceneId, spotId, tool, now = Date.now()) {
    if (state.outcome || checkThreat(data, state, now)) return { ok: false, message: "Расследование окончено." };
    const scene = data.scenes.find((item) => item.id === sceneId);
    if (!scene || (scene.requires && !state.field.found.includes(scene.requires))) return { ok: false, message: "Сначала установите адрес по предыдущей находке." };
    const spot = scene.spots.find((item) => item.id === spotId);
    if (!spot || !["inspect", "photo", "sample", "compare"].includes(tool)) return { ok: false, message: "Выберите точку и инструмент." };
    const key = `${sceneId}:${spotId}`;
    if (state.field.checked.includes(key)) return { ok: false, message: "Эта точка уже обследована. Материал сохранён." };
    const attempt = `${key}:${tool}`;
    if (state.field.attempts.includes(attempt)) return { ok: false, message: "Этот способ уже проверен. Подберите другой инструмент." };
    state.field.attempts.push(attempt);
    spend(data, state, tool === "sample" ? 25 : 15, tool === "sample" ? 1 : 0, now);
    if (state.outcome) return { ok: false, message: state.outcome.text };
    if (spot.tool !== tool) return { ok: false, message: ({ inspect: "Посмотрите на предмет и прочитайте доступную маркировку.", photo: "Нужно сохранить вид и положение — используйте фотографирование.", sample: "Нужны вещество и контрольная проба — используйте отбор образца.", compare: "Нужны два независимых источника — используйте сопоставление." })[spot.tool] };
    state.field.checked.push(key);
    if (spot.evidenceId && !state.field.found.includes(spot.evidenceId)) state.field.found.push(spot.evidenceId);
    state.field.log.push({ sceneId, spotId, text: spot.finding, at: now });
    return { ok: true, message: spot.finding, evidenceId: spot.evidenceId };
  }

  function decide(data, state, action, now = Date.now()) {
    if (state.outcome || checkThreat(data, state, now)) return "Расследование окончено.";
    if (action === "cover") {
      if (!data.profile.timed || state.pressure.breaks >= 2) return "Безопасных маршрутов больше нет.";
      state.pressure.breaks++;
      state.pressure.deadlineAt += 120000;
      state.pressure.noise -= 18;
      return "Адрес следующей встречи изменён. Вы выиграли две минуты и снизили заметность на 18 пунктов. Это сработает не более двух раз.";
    }
    if (action === "protect" && data.story.secondary && !state.decisions.witness) {
      state.decisions.witness = "protected";
      spend(data, state, 45, -5, now);
      return "Кира связалась со свидетелем через доверенного человека. Свидетель в безопасном месте; его показания останутся доступны.";
    }
    if (action === "disclose" && !state.decisions.client) {
      state.decisions.client = "disclosed";
      spend(data, state, 30, 14, now);
      return "Заказчик получил промежуточную версию. Он требует немедленного закрытия. Теперь содержание проверки известно ещё одному участнику.";
    }
    if (action === "withhold" && !state.decisions.client) {
      state.decisions.client = "withheld";
      return "Клиенту передан только статус работы. Имена и адреса источников остались внутри бюро.";
    }
    return "Это решение уже принято или сейчас недоступно.";
  }

  function assistantReply(data, state, text, available) {
    const query = text.toLocaleLowerCase("ru-RU");
    const found = new Set(state.field.found);
    if (/опас|тайм|врем|наём|наем|слеж|безопас/.test(query) && data.profile.timed) {
      const info = threat(data, state);
      return `До предельного срока примерно ${Math.ceil(info.remaining / 60000)} мин. Заметность ${info.exposure} из 100. Время идёт и при закрытой странице. Выезды, образцы и разглашение сокращают запас. Смена маршрута доступна ${Math.max(0, 2 - state.pressure.breaks)} раз.`;
    }
    const person = data.suspects.find((item) => query.includes(item.name.toLowerCase()) || query.includes(item.name.split(" ").at(-1).toLowerCase()));
    if (person) {
      const documents = available.filter((item) => item.content.includes(person.name));
      const alibiKnown = (state.askedQuestions[person.id] || []).includes("where");
      return `${person.name}: ${documents.length ? `имя встречается в материалах «${documents.slice(0, 3).map((item) => item.title).join("», «")}».` : "в доступных материалах пока нет независимой привязки."} ${alibiKnown ? "Алиби записано. Сравните его с оригиналом записи, а не с поведением на беседе." : "Начните с вопроса о вечере и уточните, кто может подтвердить маршрут."} ${found.has("field-exclusion") && person.id === data.story.decoyId ? "Контроль проходной исключает этого человека из критического окна. Старый конфликт реален, но ведёт в сторону." : "Я не буду объявлять человека виновным по одному совпадению."}`;
    }
    if (/лож|тупик|обман|верси|подстав|противореч/.test(query)) return found.has("field-exclusion")
      ? "Сопоставьте анонимный пакет с контролем удалённой проходной. Старую подпись перенесли в новое обвинение; независимая запись закрывает критическое окно. Отметьте ложную линию проверенной в разделе «В поле»."
      : "У обвинения должны быть источник, дата и связь с событием. Анонимный пакет выглядит убедительно, но без оригинала контрольной ведомости его нельзя ни принять, ни отвергнуть.";
    if (/серийн|манья|эпизод|почерк/.test(query)) return found.has("field-series")
      ? data.evidence.find((item) => item.id === "field-series").content
      : "Одного похожего почерка мало. Найдите оригиналы архивных эпизодов в месте выдачи предмета и сопоставьте их. Пересказ газеты может повторить чужую ошибку.";
    if (/привет|спасибо|устал|страш|один|поддерж/.test(query)) return pick(() => (state.chat.length % 3) / 3, ["Я здесь. Можно отвлечься от догадок: выберите один факт и проверьте его источник. Если дело на время, сначала смените маршрут.", "Кофе на столе уже холодный. Я сделаю новый, а вы не торопитесь соглашаться с самой красивой версией.", "Понимаю. Такие дела выматывают. Давайте держаться за то, что можно проверить, по одной записи за раз."]);
    if (/мотив|причин|заказчик|договор/.test(query)) return found.has("field-motive")
      ? "Приложение к договору уже в архиве. Там зафиксирован личный интерес участника. Соедините его с механизмом и независимой записью; мотив сам по себе ничего не доказывает."
      : "Мотив нельзя выбрать по впечатлению. Проверьте приложение к договору в месте выдачи предмета: копия другой стороны поможет отличить скрытый интерес от догадки.";
    if (!found.has("field-trace")) return "Начните с повреждённой поверхности на месте события. Снимок сохраняет внешний вид, но для сравнения вещества нужен образец и контрольная проба.";
    if (!found.has("field-identity")) return "В осмотре есть код упаковки и адрес. Следующий шаг — выезд по следу предмета и сопоставление книги выдачи с контрольной копией.";
    if (!found.has("field-corroboration")) return "Получатель установлен, но получение не равно использованию. Запросите архив регистратора у независимого источника и сопоставьте его с книгой выдачи.";
    if (!found.has("field-motive")) return "Человек, предмет и время связаны. Остаётся проверить мотив по приложению к договору и исключить анонимное обвинение.";
    return "Основная полевая цепь собрана. Перед сдачей проверьте ложную линию, задайте вопросы по найденным материалам и укажите в версии след, оригинал выдачи и независимую запись. Ответ я за вас не выберу.";
  }

  const api = { PROFILES, selectProfile, enrich, initialState, threat, checkThreat, spend, examine, decide, assistantReply };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DetectiveEngine = api;
})(globalThis);
