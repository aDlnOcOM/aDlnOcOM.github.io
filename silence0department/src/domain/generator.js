/** Создаёт воспроизводимое дело: истинную причину, независимые источники и ложные цепочки. */
import { DIFFICULTIES, PERSONALITIES, SCENARIOS, MOTIVES, CONFLICT_PATTERNS, CASE_ARCHETYPES, ARCHETYPE_TITLES, DISCOVERY_ROUTES, ORGANIZATION_NAMES, STREET_NAMES, COMMISSIONER_PROFILES, LEGACY_SHA1, NOISE_TITLES, NOISE_LINES } from '../data/catalog.js';
import { randomGenerator, choose, shuffled, uniquePeople, gendered, roleForGender, pastTense, normalize, surname, formatClock, pluralRu, encodeCaesar, textToHex, hiddenBinary, createAcrostic, generateAddress, buildMailbox } from '../core/utils.js';
import detective from '../domain/engine.js';

export function generateCase(seed, difficultyKey, caseKind = "auto") {
  // Независимые потоки случайности для фактов и сюжетных деталей.
  const rng = randomGenerator(`${seed}:${difficultyKey}`);
  const storyRng = randomGenerator(`${seed}:${difficultyKey}:${caseKind}:field-v1`);
  const profile = detective.selectProfile(storyRng, caseKind, difficultyKey);
  const difficulty = DIFFICULTIES[difficultyKey];
  const scenario = choose(rng, SCENARIOS);
  const archetype = CASE_ARCHETYPES.find((item) => item.id === profile.base);
  const discoveryRoute = choose(rng, DISCOVERY_ROUTES);
  const people = uniquePeople(rng, difficulty.suspects + 4);
  const victimPerson = people.shift();
  const staffIdentities = people.splice(-3);
  const victimName = victimPerson.name;
  const victimRole = roleForGender(choose(rng, scenario.victimRoles), victimPerson.gender);
  const roles = shuffled(rng, scenario.roles).slice(0, difficulty.suspects);
  const culpritIndex = Math.floor(rng() * difficulty.suspects);
  const incidentMinute = 21 * 60 + 35 + Math.floor(rng() * 105);
  const motive = choose(rng, profile.motives || MOTIVES.filter((item) => !["отсутствие рационального мотива", "паническая реакция без первоначального намерения убить"].includes(item)));
  const crimePattern = choose(rng, profile.timed || profile.id === "contract" || profile.id === "serial" ? archetype.patterns.filter((item) => !item.method.includes("незапланированной")) : archetype.patterns);
  const method = crimePattern.method;
  const apparentMotive = choose(rng, MOTIVES.filter((item) => item !== motive));
  const cacheWord = choose(rng, scenario.cacheWords);
  const alias = `${choose(rng, ["blue", "north", "mute", "grey", "last"])}_${Math.floor(10 + rng() * 89)}`;
  const accessGroup = choose(rng, ["ночной персонал", "техническое обслуживание", "архивный допуск", "внешний осмотр", "резервная смена"]);
  const passwordOptions = ["bluevelvet", "mayak7042", "midnight17", "oldrecord", "northwind"];
  const password = choose(rng, passwordOptions);
  const safeLocations = ["в круглосуточном кафе", "у себя дома", "на другом конце города", "на вокзале", "в мастерской"];
  const relationships = ["острый деловой конфликт", "давнее знакомство", "скрытая взаимная зависимость", "непрозрачная финансовая связь", "личная обида", "контакт через посредника"];
  const privateStakes = [
    { male: "скрывал подработку, нарушающую договор", female: "скрывала подработку, нарушающую договор" },
    { male: "защищал семейную тайну другого участника", female: "защищала семейную тайну другого участника" },
    { male: "лгал о знакомстве из страха потерять должность", female: "лгала о знакомстве из страха потерять должность" },
    { male: "помогал центральному участнику обходить внутренние правила", female: "помогала центральному участнику обходить внутренние правила" },
    { male: "имел неподтверждённый долг перед третьим лицом", female: "имела неподтверждённый долг перед третьим лицом" },
    { male: "боялся огласки старой профессиональной ошибки", female: "боялась огласки старой профессиональной ошибки" },
  ];
  // Идентичности создаются до улик: все ссылки ниже используют этих людей.
  const organizations = shuffled(rng, ORGANIZATION_NAMES).slice(0, 4).map((name, index) => ({
    id: `org-${index + 1}`,
    name,
    domain: `org${Math.floor(rng() * 90 + 10)}-${index + 1}.local`,
    address: generateAddress(rng),
  }));
  const primaryOrganization = organizations[0];
  const commissionerProfile = choose(rng, COMMISSIONER_PROFILES);
  const assignedNames = new Set([victimPerson, ...people, ...staffIdentities].map((person) => person.name));
  let commissionerIdentity;
  do { commissionerIdentity = uniquePeople(rng, 1)[0]; } while (assignedNames.has(commissionerIdentity.name));
  const commissioner = {
    name: commissionerIdentity.name,
    gender: commissionerIdentity.gender,
    role: commissionerProfile.role,
    organization: organizations[1].name,
    interest: commissionerProfile.interest,
    bias: commissionerProfile.bias,
    constraint: commissionerProfile.constraint,
  };
  const laboratoryRoles = [
    "эксперт по трасологии", "аналитик цифровых образов", "специалист по цепочке хранения",
    "химик-эксперт", "координатор полевых проверок", "архивист оперативного фонда",
  ];
  const supportStaff = staffIdentities.map((identity, index) => ({
    id: `staff-${index + 1}`,
    ...identity,
    role: roleForGender(laboratoryRoles[index], identity.gender),
    organization: organizations[(index + 1) % organizations.length].name,
    specialty: ["микроследы и контрольные образцы", "метаданные и локальные журналы", "маркировка, пломбы и версии документов"][index],
  }));

  const personalities = shuffled(rng, PERSONALITIES);
  const suspects = people.map((identity, index) => {
    const isCulprit = index === culpritIndex;
    const personality = personalities[index % personalities.length];
    const claimedLocation = choose(rng, safeLocations);
    const arrivalDelta = -18 - Math.floor(rng() * 38);
    const alibi = isCulprit
      ? `${pastTense(identity, "Находился", "Находилась")} ${claimedLocation} с ${formatClock(incidentMinute - 55)} до ${formatClock(incidentMinute + 20)}.`
      : `${pastTense(identity, "Был", "Была")} ${claimedLocation}; часть интервала подтверждается независимой записью, но остаётся разрыв в ${9 + index * 2} минут.`;
    return {
      id: `person-${index + 1}`,
      ...identity,
      role: roleForGender(roles[index], identity.gender),
      employer: organizations[index % organizations.length].name,
      workAddress: organizations[index % organizations.length].address,
      homeAddress: generateAddress(rng),
      routine: choose(rng, [
        `обычно приходит за ${12 + index * 3} минут до смены`,
        `по четвергам уходит через боковой выход в ${formatClock(incidentMinute - 84)}`,
        "не носит служебный телефон домой",
        "пользуется общим шкафчиком и регулярно меняется пропуском с коллегой",
        "после смены делает одну и ту же пересадку у площади Депо",
        "ведёт бумажный календарь и редко подтверждает цифровые приглашения",
      ]),
      habit: choose(rng, ["платит наличными за мелкие покупки", "сохраняет все транспортные чеки", "отвечает на письма только с рабочего терминала", "выключает геолокацию после смены", "часто одалживает рабочие инструменты", "использует два разных написания фамилии в старых базах"]),
      relationship: relationships[index % relationships.length],
      personalityId: personality.id,
      personality: gendered(identity, personality.male, personality.female),
      behavior: personality.signal,
      cadence: personality.cadence,
      tell: personality.tell,
      opening: personality.opening,
      privateStake: gendered(identity, privateStakes[index % privateStakes.length].male, privateStakes[index % privateStakes.length].female),
      alibi,
      isCulprit,
      arrivalDelta,
      detail: choose(rng, [
        "запах мокрой шерсти в коридоре",
        "дважды погасший индикатор камеры",
        "несовпадение цвета папки и точно названного номера кабинета",
        "песня, которой не было в программе вечера",
        "короткий металлический удар за служебной стеной",
        "фигура без верхней одежды у служебного входа",
      ]),
    };
  });

  // Ложные связи получают собственное объяснение и контрольную границу.
  const culprit = suspects[culpritIndex];
  const culpritSurname = surname(culprit.name);
  const innocentSuspects = shuffled(rng, suspects.filter((person) => !person.isCulprit));
  const cipherDirect = ["social", "provenance"].includes(discoveryRoute.id);
  const cipherContact = cipherDirect ? culprit : innocentSuspects[0];
  const cipherSurname = surname(cipherContact.name);
  const osintDirect = ["network", "routine"].includes(discoveryRoute.id);
  const osintContact = osintDirect ? culprit : innocentSuspects[1 % innocentSuspects.length];
  const calendarDirect = ["financial", "provenance"].includes(discoveryRoute.id);
  const calendarContact = calendarDirect ? culprit : innocentSuspects[2 % innocentSuspects.length];
  const digitalDirect = discoveryRoute.id === "network";
  const digitalContact = digitalDirect ? culprit : innocentSuspects[0];
  const digitalOther = suspects.find((person) => person.id !== digitalContact.id);
  const routineDirect = discoveryRoute.id === "routine";
  const routineContact = routineDirect ? culprit : innocentSuspects[0];
  const financialDirect = discoveryRoute.id === "financial";
  const financialContact = financialDirect ? culprit : innocentSuspects[1 % innocentSuspects.length];
  const socialDirect = discoveryRoute.id === "social";
  const socialContact = socialDirect ? culprit : innocentSuspects[1 % innocentSuspects.length];
  const socialOther = suspects.find((person) => person.id !== socialContact.id);
  const provenanceDirect = discoveryRoute.id === "provenance";
  const provenanceContact = provenanceDirect ? culprit : innocentSuspects[2 % innocentSuspects.length];
  const cellDirect = ["routine", "network"].includes(discoveryRoute.id);
  const cellContact = cellDirect ? culprit : innocentSuspects[2 % innocentSuspects.length];
  const conflictChains = Array.from({ length: difficulty.deadEnds }, (_, index) => {
    const pattern = CONFLICT_PATTERNS[index % CONFLICT_PATTERNS.length];
    const first = innocentSuspects[index % innocentSuspects.length];
    const second = innocentSuspects[(index + 1) % innocentSuspects.length];
    return {
      id: `conflict-${index + 1}`,
      title: pattern.title,
      actorIds: [first.id, second.id],
      actorNames: [first.name, second.name],
      hook: `${first.name} и ${second.name}: ${pattern.hook}.`,
      turn: pattern.turn,
      closure: pattern.closure,
      apparentMotive: choose(rng, MOTIVES.filter((item) => item !== motive)),
      excludedBy: formatClock(incidentMinute - 6 - index * 3),
    };
  });
  const incidentAddress = `${scenario.location}, ${generateAddress(rng).replace(/, кв\..*$/, "")}`;
  const caseTitle = choose(rng, [...ARCHETYPE_TITLES[archetype.id], ...scenario.titles]);
  // Сводка следует выбранному механизму; признаки разных ветвей не смешиваются.
  const incidentSummary = `Центральный участник: ${victimName}. Объект: ${scenario.location}. Расследуется ${archetype.outcomeLabel}. Предварительная версия — «${crimePattern.apparent}». Её предстоит проверить по независимым источникам.`;
  const mandateText = choose(rng, [
    `Нужно проверить, где версия «${crimePattern.apparent}» перестаёт объяснять факты. ${commissioner.constraint}.`,
    `Не ищите человека с самым громким конфликтом. Сначала установите путь возможности: ${discoveryRoute.primary}.`,
    `У нас есть несколько настоящих нарушений и только одно основное событие. ${commissioner.interest}.`,
    `Предварительная комиссия уже выбрала удобную причину. Ваша задача — показать, какой независимый источник её выдерживает или разрушает.`,
    `Срок — до следующей смены. Отдельно пометьте факты, ложь ради другого проступка и выводы, зависящие от допущений.`,
  ]);
  const sceneObservation = `${crimePattern.trace}. Независимая проверка должна отделить этот признак от обстоятельства: ${crimePattern.incidental}`;
  const victimProfiles = {
    routine: [
      `${pastTense(victimPerson, "стал", "стала")} выходить на одну остановку раньше и дважды опоздал${victimPerson.gender === "female" ? "а" : ""} на привычную пересадку`,
      `${pastTense(victimPerson, "обменял", "обменяла")} дежурство, но сохранил${victimPerson.gender === "female" ? "а" : ""} прежний заказ такси`,
    ],
    financial: [
      `${pastTense(victimPerson, "разделил", "разделила")} один возврат на три счёта и запросил${victimPerson.gender === "female" ? "а" : ""} копию старого залога`,
      `${pastTense(victimPerson, "отказался", "отказалась")} от наличного расчёта, а через день оплатил${victimPerson.gender === "female" ? "а" : ""} чужую камеру хранения`,
    ],
    physical: [
      `${pastTense(victimPerson, "запросил", "запросила")} образец редкого материала и вернул${victimPerson.gender === "female" ? "а" : ""} упаковку с другим серийным номером`,
      `${pastTense(victimPerson, "интересовался", "интересовалась")} графиком калибровки и забрал${victimPerson.gender === "female" ? "а" : ""} списанный инструмент`,
    ],
    network: [
      `${pastTense(victimPerson, "отключил", "отключила")} синхронизацию телефона, но оставил${victimPerson.gender === "female" ? "а" : ""} активным домашний планшет`,
      `${pastTense(victimPerson, "сменил", "сменила")} пароль локальной копии и передал${victimPerson.gender === "female" ? "а" : ""} резервный ключ не тому отделу`,
    ],
    social: [
      `${pastTense(victimPerson, "отменил", "отменила")} общий ужин, а затем встретил${victimPerson.gender === "female" ? "а" : ""} двух его участников по отдельности`,
      `${pastTense(victimPerson, "скрыл", "скрыла")} родство с посредником и публично поддержал${victimPerson.gender === "female" ? "а" : ""} его оппонента`,
    ],
    provenance: [
      `${pastTense(victimPerson, "попросил", "попросила")} бумажный оригинал и одновременно удалил${victimPerson.gender === "female" ? "а" : ""} собственную цифровую правку`,
      `${pastTense(victimPerson, "оспорил", "оспорила")} подпись на акте, хотя ранее ссылал${victimPerson.gender === "female" ? "ась" : "ся"} на его содержание`,
    ],
  };
  const victimRecentAction = choose(rng, victimProfiles[discoveryRoute.id]);
  const witness = choose(rng, [
    { title: "Показания диспетчера", excerpt: "Свидетель помнит порядок действий, но сверял время по отстающим часам.", quote: `«Сначала погас индикатор, затем появился человек с папкой. На часах было ${formatClock(incidentMinute - 16)}, но позже выяснилось, что они отстают»`, reliability: "высокая для последовательности; низкая для точного времени" },
    { title: "Показания ночной курьерки", excerpt: "Курьерка различила сумку и маршрут, но не лицо человека.", quote: `«У служебной двери стояла знакомая сумка с белой стяжкой. Человек ушёл в сторону ${choose(rng, STREET_NAMES)}, лица я не видела»`, reliability: "средняя; маршрут подтверждён заказом, личность не установлена" },
    { title: "Показания уборщика", excerpt: "Свидетель слышал разговор, но мог соединить две разные сцены.", quote: `«Голос сказал: “не здесь”. Через несколько минут хлопнула дверь. Я решил, что это те же люди, но коридор поворачивает»`, reliability: "средняя; акустика коридора создаёт ошибку источника" },
    { title: "Показания соседки объекта", excerpt: "Свидетельница узнала привычку, а не внешность.", quote: `«Кто-то дважды проверил ручку и вернулся за перчатками. Так делает один из работников, но сегодня куртка была другой»`, reliability: "средняя; узнавание поведения не равно идентификации" },
    { title: "Запись дежурного мастера", excerpt: "Мастер видел предмет до события, однако его журнал заполнен позже.", quote: `«Я уверен, что пломба уже была перекошена. Строку внёс утром по памяти, потому что терминал ночью не работал»`, reliability: "высокая для неисправности терминала; средняя для наблюдения" },
  ]);
  const strongEvidenceByRoute = {
    routine: ["ev-routine-gap", "ev-timeline", "ev-partner-cell"],
    financial: ["ev-ledger-chain", "ev-password", "ev-partner-money"],
    physical: ["ev-computer-meta", "ev-timeline", "ev-access"],
    network: ["ev-digital", "ev-osint", "ev-partner-cell"],
    social: ["ev-contact-graph", "ev-cipher", "ev-witness"],
    provenance: ["ev-document-provenance", "ev-cipher", "ev-computer-meta"],
  };
  const routeReconstruction = {
    routine: `Сопоставление регулярного маршрута, независимой отметки времени и отклонения в привычке оставляет проверяемое окно возможности. Профиль распорядка: ${culprit.name}; в заявленном алиби этого окна нет.`,
    financial: `Токен возврата, история владения адресом и разделённый платёж сходятся на одном учётном профиле. Имя профиля: ${culprit.name}; одинаковая сумма без этой цепи была бы лишь совпадением.`,
    physical: `Происхождение материала, доступ к инструменту и время обслуживания сходятся на одном рабочем контуре. Связанный профиль: ${culprit.name}. Один лабораторный след личности не устанавливал.`,
    network: `Узел ${alias}, локальный снимок и привычка использования устройства образуют непрерывную техническую цепь до личного профиля. Имя профиля: ${culprit.name}. Геопозиция сама по себе оставалась недостаточной.`,
    social: `Посредник, скрытый контакт и несовместимые легенды выводят на один профиль. Имя: ${culprit.name}. Самый громкий конфликт при этом оказался отдельной, хотя и реальной, историей.`,
    provenance: `Порядок версий, подпись служебного редактора и исходные метаданные показывают, что документ прошёл через личный контур до заявленного времени создания. Связанный профиль: ${culprit.name}.`,
  }[discoveryRoute.id];
  const eventSpecs = [
    { id: "event-arrival", minute: incidentMinute - 72, text: `${victimName} отмечается у главного входа.` },
    { id: "event-call", minute: incidentMinute - 46, text: "Служебный телефон принимает короткий звонок без номера." },
    { id: "event-badge", minute: incidentMinute - 24, text: `Резервный пропуск группы «${accessGroup}» открывает служебную дверь.` },
    { id: "event-network", minute: incidentMinute - 11, text: `Узел ${alias} подключается к локальной сети.` },
    { id: "event-incident", minute: incidentMinute, text: `Экспертное окно: ${archetype.outcomeLabel}.` },
  ];
  const timelineOrder = eventSpecs.map((event) => event.id);
  const shuffledTimeline = shuffled(rng, eventSpecs.map((event) => event.id));
  const signatureDelay = 17 + Math.floor(rng() * 40);

  // Аналитика проверяет источник, не назначая виновного.
  const puzzlePool = [
    {
      id: "cipher-caesar",
      kind: "cipher",
      title: "Сдвиг на полях",
      summary: "Классический шифр в личной записной книжке центрального участника.",
      prompt: "Расшифруйте строку и укажите фамилию человека, назначившего встречу.",
      body: encodeCaesar(`ВСТРЕЧА ${cipherSurname.toUpperCase()} В ${formatClock(incidentMinute - 30)}`, 3),
      answer: normalize(cipherSurname),
      accepted: [normalize(cipherSurname)],
      hint: "Это шифр Цезаря: каждая буква сдвинута на три позиции вперёд по русскому алфавиту без «Ё».",
      reveal: `Запись подтверждает встречу. Второй участник: ${cipherContact.name}. ${cipherDirect ? "Это звено основного маршрута, но содержание встречи ещё не установлено." : "Контакт реален, однако относится к отдельной конфликтной цепочке."}`,
      evidenceId: "ev-cipher",
    },
    {
      id: "stego-acrostic",
      kind: "stego",
      title: "Письмо без адресата",
      summary: "Физическая стеганография в безобидном тексте.",
      prompt: "Где спрятан носитель? Введите одно слово.",
      body: createAcrostic(cacheWord),
      answer: normalize(cacheWord),
      accepted: [normalize(cacheWord)],
      hint: "Посмотрите на первые буквы каждой строки, а не на смысл текста.",
      reveal: `Акростих указывает на место «${cacheWord}». Там найден резервный носитель.`,
      evidenceId: "ev-stego",
    },
    {
      id: "timeline-order",
      kind: "timeline",
      title: "Одиннадцать минут",
      summary: "Сведение независимых часов в единую хронологию.",
      prompt: "Расставьте события от самого раннего к самому позднему.",
      body: "Сервер входа спешит на 4 минуты; телефонная станция отстаёт на 3. Показанное ниже время уже нормализовано экспертом.",
      answer: timelineOrder.join("|"),
      initialOrder: shuffledTimeline,
      hint: "Опирайтесь на нормализованные отметки времени, а не на порядок документов в архиве.",
      reveal: `Между входом резервного пропуска и подключением узла ${alias} проходит 13 минут.`,
      evidenceId: "ev-timeline",
    },
    {
      id: "osint-profile",
      kind: "choice",
      title: "Легенда в открытой сети",
      summary: "OSINT-проверка цифровой легенды одного из участников.",
      prompt: "Какая деталь действительно опровергает заявленное алиби?",
      body: "Профиль изучен через открытые источники. Совпадение имени или манеры письма само по себе недостаточно.",
      choices: [
        "Два аккаунта используют одинаковые эмодзи и пунктуацию.",
        `Старый профиль подписан на страницу места «${scenario.location}».`,
        `Фото опубликовано в ${formatClock(incidentMinute - 16)}; исходный EXIF содержит координаты соседнего здания.`,
        "Никнейм состоит из английского слова и двух цифр.",
      ],
      answer: "2",
      accepted: ["2"],
      hint: "Ищите независимую временную и географическую метку, а не сходство стиля.",
      reveal: `Метаданные публикации помещают устройство рядом с местом события. Имя связанного профиля: ${osintContact.name}. ${osintDirect ? "Личность ещё требует подтверждения владения устройством." : "Полный маршрут показывает, что это отдельное бытовое пересечение."}`,
      evidenceId: "ev-osint",
    },
    {
      id: "weak-password",
      kind: "password",
      title: "Словарь вместо ключа",
      summary: "Атака на слабую защиту старого контейнера.",
      prompt: "Какой пароль открывает контейнер? Можно вывести его из цифровой легенды или запустить короткую словарную проверку.",
      body: `SHA-1 (устаревший): ${LEGACY_SHA1[password]}\nПодсказки владельца: любимая пластинка, старая частота, памятная полночь.`,
      answer: normalize(password),
      accepted: [normalize(password)],
      hint: `Кандидаты из утечки: ${shuffled(rng, passwordOptions).join(", ")}.`,
      reveal: `Контейнер открыт. В календаре есть закрытая встреча; второй участник — ${calendarContact.name}. ${calendarDirect ? "Запись относится к основному маршруту проверки." : "Встреча относится к параллельному нарушению."}`,
      evidenceId: "ev-password",
    },
    {
      id: "digital-stego",
      kind: "digital",
      title: "Пустая строка",
      summary: "Нулевые символы скрывают второй слой сообщения.",
      prompt: "Извлеките скрытые биты, декодируйте Base64 и введите английское слово.",
      body: `Проверено. Ничего важного.${hiddenBinary("QVJDSElWRQ==")}`,
      visibleBody: "Проверено. Ничего важного.",
      answer: "archive",
      accepted: ["archive", "архив"],
      hint: "Невидимые символы кодируют нули и единицы. Инструмент извлечения покажет промежуточную Base64-строку.",
      reveal: `Скрытый слой указывает на ARCHIVE. В архивной копии найден сетевой псевдоним ${alias}. ${digitalDirect ? "Его нужно связать с сеансом пользователя." : "Псевдоним принадлежит общему терминалу и создаёт тупиковую атрибуцию."}`,
      evidenceId: "ev-digital",
    },
    {
      id: "routine-gap",
      kind: "logic",
      title: "Окно в распорядке",
      summary: "Четыре бытовых отметки выглядят как алиби, но относятся к человеку и устройствам по-разному.",
      prompt: "Какая последовательность действительно оставляет проверяемое окно возможности?",
      body: `${routineContact.name}: ${routineContact.routine}; ${routineContact.habit}.\n${formatClock(incidentMinute - 41)} — транспортный терминал; ${formatClock(incidentMinute - 24)} — групповой пропуск; ${formatClock(incidentMinute - 11)} — локальное устройство; ${formatClock(incidentMinute + 14)} — личная покупка.`,
      choices: [
        "Считать все четыре отметки непосредственным наблюдением одного человека.",
        "Отбросить бытовые данные как заведомо не относящиеся к делу.",
        "Разделить носителя пропуска, владельца устройства и подтверждённое личное действие; проверить промежуток между ними.",
        "Выбрать самую близкую ко времени события отметку независимо от типа источника.",
      ],
      answer: "2", accepted: ["2"],
      hint: "Терминал, пропуск и устройство фиксируют разные сущности. Только часть событий можно надёжно привязать к человеку.",
      reveal: `Проверяемое окно возникает между групповым доступом и личной отметкой. Профиль отметки: ${routineContact.name}. Оно не видно при склейке всех устройств в одну линию.`,
      evidenceId: "ev-routine-gap",
    },
    {
      id: "ledger-chain",
      kind: "logic",
      title: "Сумма без получателя",
      summary: "Раздробленный платёж проходит через залог, возврат и общий адрес доставки.",
      prompt: "Какое звено нужно установить, прежде чем связывать платёж с мотивом?",
      body: `Платёж A → одноразовый токен → возврат залога → адрес ${financialContact.homeAddress}.\nТот же адрес встречается у ${1 + Math.floor(rng() * 3)} старых заказов организации.`,
      choices: ["Самую крупную сумму", "Конечного распорядителя токена и основание возврата", "Любого человека, когда-либо использовавшего адрес", "Авторство первого письма в цепочке"],
      answer: "1", accepted: ["1"],
      hint: "Адрес — связь, но не владение. Нужен контроль над токеном в момент операции.",
      reveal: `История токена связывает операцию с рабочим профилем. Имя профиля: ${financialContact.name}. Финансовый контакт всё равно не становится самостоятельным доказательством основного события.`,
      evidenceId: "ev-ledger-chain",
    },
    {
      id: "contact-graph",
      kind: "logic",
      title: "Третий участник",
      summary: "Два человека отрицают знакомство, но их связывает посредник и общее помещение.",
      prompt: "Какая проверка отличит прямую координацию от совпадения через посредника?",
      body: `${innocentSuspects[0].name} ↔ общий посредник ↔ ${socialContact.name}.\nОбщая геозона: ${scenario.district}. Прямых сообщений между крайними узлами нет.`,
      choices: ["Сходство словаря в любых сообщениях", "Наличие одного общего знакомого", "Независимая отметка одновременного присутствия и общий предмет обмена", "Сам факт отрицания знакомства"],
      answer: "2", accepted: ["2"],
      hint: "Социальный граф показывает возможность передачи, но не доказывает, что передача состоялась.",
      reveal: "Граф контактов сузился только после совмещения помещения, времени и предмета обмена; один общий знакомый давал ложноположительную связь.",
      evidenceId: "ev-contact-graph",
    },
    {
      id: "document-provenance",
      kind: "logic",
      title: "Автор, терминал, редактор",
      summary: "Документ имеет три разных признака авторства и две временные версии.",
      prompt: "Какой вывод допустим из метаданных общего терминала?",
      body: `Поле Author: ${provenanceContact.name}\nПрофиль редактора: ${alias}\nТерминал: общий / ${primaryOrganization.name}\nПодпись: добавлена после создания на ${signatureDelay} ${pluralRu(signatureDelay, "минуту", "минуты", "минут")}.`,
      choices: ["Поле Author окончательно устанавливает личность", "Псевдоним всегда равен владельцу устройства", "Документ прошёл через общий терминал; личность требует журнала сеанса или независимого действия", "Поздняя подпись делает весь документ поддельным"],
      answer: "2", accepted: ["2"],
      hint: "Метаданные описывают путь файла, а не обязательно человека за клавиатурой.",
      reveal: `Цепь хранения установлена до общего терминала ${primaryOrganization.name}; авторство подтверждается только пересечением с отдельным журналом сеанса. ${provenanceDirect ? "Это часть основного маршрута проверки." : "В этом деле документ относится к отдельной линии и не устанавливает основного исполнителя."}`,
      evidenceId: "ev-document-provenance",
    },
    {
      id: "spectral-control",
      kind: "lab",
      title: "Контрольный спектр",
      summary: "Три образца похожи по составу, но только один был взят из независимой контрольной серии.",
      prompt: "Какой вывод допустим после сравнения спектров?",
      body: `S-01: след с объекта / пик ${Math.floor(17 + rng() * 6)}.4\nS-02: контрольная серия / пик ${Math.floor(17 + rng() * 6)}.4\nS-03: образец из личного инструмента / пик ${Math.floor(17 + rng() * 6)}.1\n\nСовпадение пика может объяснять происхождение материала, но не владельца предмета.`,
      choices: [
        "Совпадение спектра окончательно устанавливает человека, державшего образец.",
        "Нужно сопоставить образец с контрольной серией и журналом выдачи, а личность устанавливать отдельным источником.",
        "Любое различие между сериями означает, что все материалы поддельны.",
        "Достаточно выбрать образец с самым редким пиком без проверки происхождения.",
      ],
      answer: "1",
      accepted: ["1"],
      hint: "Спектр отвечает на вопрос о материале и партии, а не о личности человека.",
      reveal: `Контрольная серия подтверждает путь материала, связанный с ${supportStaff[0].name}. Его заключение ограничено происхождением образца и не атрибутирует действие конкретному человеку.`,
      evidenceId: "ev-lab-spectrum",
    },
    {
      id: "custody-seal",
      kind: "lab",
      title: "Три смены хранения",
      summary: "Контейнер менял руки трижды; одна подпись внесена после смены, но пломба не повреждена.",
      prompt: "Как правильно описать разрыв в цепочке хранения?",
      body: `19:42 — приём: ${supportStaff[2].name}\n20:06 — передача в холодильный шкаф: сервисный сканер\n21:18 — подпись в журнале: внесена вручную\nПломба: цела; номер соответствует исходному фото.`,
      choices: [
        "Поздняя подпись автоматически делает образец недопустимым и бесполезным.",
        "Целая пломба делает ручную запись неважной; журнал можно игнорировать.",
        "Нужно сохранить оба факта: физическая целостность подтверждена, а время и автор ручной записи требуют отдельной проверки.",
        "Если у контейнера есть номер, никакие журналы больше не нужны.",
      ],
      answer: "2",
      accepted: ["2"],
      hint: "Цепь хранения состоит из нескольких независимых полей. Не заменяйте один источник другим.",
      reveal: "Контейнер не исключён: пломба и фотография подтверждают его целостность, но ручная отметка остаётся ограниченным источником времени.",
      evidenceId: "ev-lab-custody",
    },
    {
      id: "mail-header",
      kind: "lab",
      title: "Письмо, маршрут и автор",
      summary: "В заголовке сохранены отправляющий сервер, локальная переадресация и поле имени автора.",
      prompt: "Что можно установить из такого заголовка без дополнительной проверки?",
      body: `From: archive@${primaryOrganization.domain}\nReceived: shared-terminal / ${formatClock(incidentMinute - 33)}\nX-Forwarded-For: 10.4.7.${20 + culpritIndex}\nDisplay-Name: ${provenanceContact.name}\n\nПрофиль общего терминала меняется между сменами.`,
      choices: [
        "Отображаемое имя доказывает, кто отправил письмо.",
        "Письмо прошло через общий терминал в указанное время; автора нужно проверять по сеансу и независимому действию.",
        "IP-адрес сам по себе устанавливает физическое присутствие человека.",
        "Локальная переадресация делает весь текст выдуманным.",
      ],
      answer: "1",
      accepted: ["1"],
      hint: "Заголовок фиксирует путь сообщения, но общий терминал не равен одному пользователю.",
      reveal: `Маршрут письма подтверждён, а имя ${provenanceContact.name} остаётся версией до сопоставления с журналом сеансов.`,
      evidenceId: "ev-mail-header",
    },
    {
      id: "signal-triangulation",
      kind: "lab",
      title: "Шум на трёх антеннах",
      summary: "Три приёмника зафиксировали один сигнал с разной задержкой и разной точностью часов.",
      prompt: "Какой способ позволяет корректно сузить источник передачи?",
      body: `A-1: ${formatClock(incidentMinute - 28)}:14.220 / часы +4 с\nA-2: ${formatClock(incidentMinute - 28)}:08.220 / часы −2 с\nA-3: ${formatClock(incidentMinute - 28)}:11.220 / часы синхронизированы\n\nКаждая антенна даёт сектор, а не точку.`,
      choices: [
        "Выбрать самую громкую запись и считать её координатами источника.",
        "Нормализовать часы, пересечь направления трёх антенн и проверить, не отражён ли сигнал от металлоконструкций.",
        "Использовать только антенну с синхронизированными часами.",
        "Приписать сигнал человеку, чей позывной похож на строку лога.",
      ],
      answer: "1",
      accepted: ["1"],
      hint: "Одна антенна показывает направление. Место получается только после коррекции часов и пересечения независимых линий.",
      reveal: `Три сектора сходятся у ${scenario.district}, но отражение от инфраструктуры сохраняет полосу неопределённости. Это место проверки, не идентификация человека.`,
      evidenceId: "ev-lab-signal",
    },
  ];

  const firstConflict = conflictChains[0];
  const logicTrapPuzzle = firstConflict ? {
    id: "logic-dead-end",
    kind: "logic",
    title: "Доказательство или объяснение лжи",
    summary: `Цепочка «${firstConflict.title}» даёт мотив, ложь и скрытый контакт — но может быть замкнутым тупиком.`,
    prompt: "Какой вывод логически допустим после проверки всей цепочки?",
    body: `${firstConflict.hook}\n\nПоворот: ${firstConflict.turn}.\n\nКонтрольная граница: ${firstConflict.closure}.`,
    choices: [
      `Ложь автоматически доказывает причастность к событию «${archetype.outcomeLabel}».`,
      `Совпадение мотива и скрытого контакта достаточно, даже без связи со способом основного события.`,
      "Цепочка объясняет самостоятельный конфликт и ложь, но замыкается вне механизма и критического окна основного события.",
      "Любая цепочка с финансовым или личным конфликтом должна считаться основной.",
    ],
    answer: "2",
    accepted: ["2"],
    hint: "Проверьте четыре звена: возможность, средство, критическое время и независимое подтверждение личности.",
    reveal: `Конфликт реален. Участники: ${firstConflict.actorNames.join(" / ")}. Однако его цепочка не продолжается до события «${archetype.outcomeLabel}».`,
    evidenceId: "ev-dead-end-resolution",
  } : null;
  const causalPuzzle = {
    id: "causal-method",
    kind: "logic",
    title: "Причина, маскировка и случайность",
    summary: `В материалах одновременно присутствуют признаки версии «${crimePattern.apparent}», сознательная инсценировка и случайное обстоятельство.`,
    prompt: `Какое наблюдение отделяет реальный механизм «${archetype.mechanismLabel}» от маскировки и фонового совпадения?`,
    body: `Предварительная версия: ${crimePattern.apparent}.\nИнсценировка: ${crimePattern.staging}.\nСлучайное условие: ${crimePattern.incidental}.`,
    choices: [
      "Сам факт последующего сокрытия — он всегда точно указывает способ преступления.",
      `Совпадение с внешней версией «${crimePattern.apparent}» без проверки достаточности условий.`,
      crimePattern.trace,
      "Наиболее драматичный конфликт между участниками независимо от материальных следов.",
    ],
    answer: "2",
    accepted: ["2"],
    hint: "Нужен след, который физически несовместим с кажущейся причиной, а не просто подозрительное поведение после события.",
    reveal: `Отделены три слоя: реальный механизм — ${method}; маскировка — ${crimePattern.staging}; случайность — ${crimePattern.incidental}.`,
    evidenceId: "ev-causal-method",
  };

  const routePuzzles = discoveryRoute.puzzleIds.map((id) => puzzlePool.find((puzzle) => puzzle.id === id)).filter(Boolean);
  const scenarioPuzzles = (scenario.labPuzzleIds || []).map((id) => puzzlePool.find((puzzle) => puzzle.id === id)).filter(Boolean);
  const supplementary = shuffled(rng, puzzlePool.filter((puzzle) => !routePuzzles.includes(puzzle) && !scenarioPuzzles.includes(puzzle)));
  const uniquePuzzles = (items, limit) => [...new Map(items.filter(Boolean).map((puzzle) => [puzzle.id, puzzle])).values()].slice(0, limit);
  let selectedPuzzles = uniquePuzzles([...routePuzzles, ...scenarioPuzzles, ...supplementary], 3);
  if (difficultyKey === "tutorial") {
    const timelinePuzzle = puzzlePool.find((puzzle) => puzzle.kind === "timeline");
    const digitalPuzzle = puzzlePool.find((puzzle) => puzzle.kind === "digital");
    selectedPuzzles = uniquePuzzles([timelinePuzzle, digitalPuzzle, ...scenarioPuzzles, ...routePuzzles, ...supplementary], 3);
  }
  if (difficultyKey === "detective") selectedPuzzles = uniquePuzzles([...scenarioPuzzles, ...routePuzzles, logicTrapPuzzle, ...supplementary], 5);
  if (difficultyKey === "inspector") selectedPuzzles = uniquePuzzles([...scenarioPuzzles, ...routePuzzles, logicTrapPuzzle, causalPuzzle, ...supplementary], 6);
  const mailbox = buildMailbox(rng, {
    victim: { ...victimPerson, role: victimRole }, culprit, route: discoveryRoute, incidentMinute,
    organization: primaryOrganization, scenario, pattern: crimePattern, alias, supportStaff,
  });
  // Архив: наблюдения, надёжность и условия открытия материалов.
  const evidence = [
    {
      id: "ev-scene",
      code: "M-01",
      title: "Первичный осмотр места",
      type: "forensics",
      excerpt: `Контур доступа не показывает грубого вторжения. Картина допускает версию «${crimePattern.apparent}», но не доказывает её.`,
      content: `Место: ${incidentAddress}.\nОкно события: ${formatClock(incidentMinute - 8)}–${formatClock(incidentMinute + 9)}.\n\nЗафиксированное наблюдение: ${sceneObservation}\nДополнительный след: ${crimePattern.trace}.\nПредварительная версия: ${crimePattern.apparent}.\nУсловие, способное исказить время и картину: ${crimePattern.incidental}.\n\nВывод ограничен: осмотр не позволяет сам по себе разделить механизм, маскировку и случайное обстоятельство.`,
      tags: ["осмотр", "форензика", "условный вывод"],
      reliability: "высокая для наблюдений; средняя для интерпретации",
      status: "версия не подтверждена",
      relevant: true,
    },
    {
      id: "ev-victim",
      code: "D-02",
      title: `Досье: ${victimName}`,
      type: "document",
      excerpt: `Профессия: ${victimRole}. За последние две недели ${victimRecentAction}.`,
      content: `${victimName}, ${38 + Math.floor(rng() * 24)} лет. Профессия: ${victimRole}. Место работы: ${primaryOrganization.name}.\n\nЗа двенадцать дней до события ${victimRecentAction}. ${pastTense(victimPerson, "Объяснил", "Объяснила")} это бытовой необходимостью, однако коллеги приводят две несовместимые причины. В тот же период ${pastTense(victimPerson, "запросил", "запросила")} доступ к источнику «${discoveryRoute.secondary}», не связанному напрямую с обычными обязанностями.\n\nОграничение вывода: изменение поведения устанавливает контекст и направление проверки, но не мотив и не причастность другого человека.`,
      tags: ["личность", "фон"],
      reliability: "смешанная: банковские операции точны, объяснения со слов коллег",
      status: "фон, требует связи",
      relevant: true,
    },
    {
      id: "ev-access",
      code: "L-07",
      title: "Журнал служебного входа",
      type: "log",
      excerpt: `Групповой пропуск использован в ${formatClock(incidentMinute - 24)}. В группе доступа — ${culprit.name} и ${innocentSuspects[0].name}.`,
      content: `${formatClock(incidentMinute - 72)}  MAIN-01  персональный пропуск центрального участника\n${formatClock(incidentMinute - 24)}  SRV-02   групповой пропуск / ${accessGroup}\n${formatClock(incidentMinute - 11)}  NET-04   новое устройство / ${alias}\n${formatClock(incidentMinute + 8)}  SRV-02   механическое открытие изнутри\n\nГруппа SRV-02: ${culprit.name}; ${innocentSuspects[0].name}; дежурный подрядчик. Журнал фиксирует право доступа, но не личность носителя карты.`,
      tags: ["время", "доступ"],
      reliability: "высокая для события доступа; личность носителя не установлена",
      status: "возможность доступа без атрибуции",
      relevant: true,
    },
    {
      id: "ev-witness",
      code: "W-03",
      title: witness.title,
      type: "interview",
      excerpt: witness.excerpt,
      content: `${witness.quote}.\n\nНадёжность: ${witness.reliability}. Показание нельзя использовать как самостоятельную идентификацию.`,
      tags: ["свидетель", "граница наблюдения"],
      reliability: witness.reliability,
      status: "наблюдение без надёжной атрибуции",
      relevant: true,
    },
    {
      id: "ev-cipher",
      code: "C-11",
      title: "Расшифрованная запись о встрече",
      type: "cipher",
      excerpt: `Фамилия ${cipherSurname} и время ${formatClock(incidentMinute - 30)}. Контакт не равен причастности.`,
      content: `После сдвига на три позиции получено:\n«ВСТРЕЧА ${cipherSurname.toUpperCase()} В ${formatClock(incidentMinute - 30)}».\n\nЗапись сделана рукой центрального участника; экспертиза чернил подтверждает дату. ${cipherDirect ? "Время пересекается с основным маршрутом проверки." : "Встреча объясняется отдельным конфликтом и не связана с установленным способом."}`,
      tags: ["крипто", "встреча"],
      relevant: cipherDirect,
      lockedBy: "cipher-caesar",
    },
    {
      id: "ev-stego",
      code: "S-14",
      title: "Носитель из тайника",
      type: "stego",
      excerpt: `Акростих указал на «${cacheWord}». Носитель был скрыт физически.`,
      content: `В месте «${cacheWord}» найден тонкий накопитель без маркировки. Корпус очищен, но в углублении осталась частица лака того же типа, что на месте события.\n\nСодержимое зашифровано отдельным слабым паролем.`,
      tags: ["стего", "носитель"],
      relevant: true,
      lockedBy: "stego-acrostic",
    },
    {
      id: "ev-timeline",
      code: "T-18",
      title: "Нормализованная хронология",
      type: "timeline",
      excerpt: "Пять независимых источников сведены к единому времени.",
      content: eventSpecs.map((event) => `${formatClock(event.minute)} — ${event.text}`).join("\n"),
      tags: ["время", "связь"],
      relevant: true,
      lockedBy: "timeline-order",
    },
    {
      id: "ev-osint",
      code: "O-21",
      title: "EXIF открытой публикации",
      type: "osint",
      excerpt: `Устройство было рядом с местом события; имя связанного профиля — ${osintContact.name}. Нахождение человека устанавливается отдельно.`,
      content: `Исходный файл получен из CDN до удаления публикации.\nCreated: ${formatClock(incidentMinute - 16)}\nGPS: соседнее здание, погрешность 19 м\nDevice fingerprint: совпадает с двумя ранними публикациями. Связанный профиль: ${osintContact.name}.\n\n${osintDirect ? "Устройство пересекается с другим независимым действием владельца." : "Поздняя транспортная отметка закрывает маршрут этого человека вне основного события."}`,
      tags: ["OSINT", "метаданные"],
      relevant: osintDirect,
      lockedBy: "osint-profile",
    },
    {
      id: "ev-password",
      code: "K-24",
      title: "Содержимое слабого контейнера",
      type: "crypto",
      excerpt: `Календарь показывает двух участников; второй указан как ${calendarContact.name}. Цель встречи не указана.`,
      content: `Контейнер защищён паролем «${password}», найденным словарным перебором.\nЗакрытая запись: «${formatClock(incidentMinute - 30)} — ${surname(calendarContact.name)}, документы и оригинал записи».\n\nСтойкость защиты признана недостаточной; целостность образа подтверждена контрольной суммой. ${calendarDirect ? "Время совпадает с другим независимым звеном." : "Переписка показывает отдельный предмет встречи."}`,
      tags: ["крипто", "календарь"],
      relevant: calendarDirect,
      lockedBy: "weak-password",
    },
    {
      id: "ev-digital",
      code: "S-29",
      title: "Скрытый слой сообщения",
      type: "stego",
      excerpt: `Нулевые символы привели к архивной копии с псевдонимом ${alias}.`,
      content: `Из последовательности U+200B / U+200C извлечено двоичное сообщение. После Base64-декодирования: ARCHIVE.\nАрхивная копия содержит строку авторизации узла ${alias}. Поле подписи повреждено; общий терминал использовали ${digitalContact.name} и ${digitalOther.name}.`,
      tags: ["цифровое стего", "сеть"],
      relevant: digitalDirect,
      lockedBy: "digital-stego",
    },
    {
      id: "ev-partner-cell",
      code: "A-31",
      title: "Сверка базовых станций",
      type: "forensics",
      excerpt: `Устройство из личного профиля было в секторе; имя профиля — ${cellContact.name}. Передача устройства не исключена.`,
      content: `За интервал ${formatClock(incidentMinute - 40)}–${formatClock(incidentMinute + 10)} устройство прошло handover между двумя станциями, покрывающими ${scenario.district}.\nВероятность нахождения устройства в заявленном месте алиби — менее 4%. Личная операция владельца возникает только после критического окна.`,
      tags: ["сотовая сеть", "алиби"],
      relevant: cellDirect,
      lockedBy: "task-cell",
    },
    {
      id: "ev-partner-money",
      code: "A-34",
      title: "Цепочка микроплатежей",
      type: "finance",
      excerpt: `Серия переводов связывает общий токен с личным адресом; имя адресного профиля — ${financialContact.name}. Распорядитель устанавливается отдельно.`,
      content: `Три платежа были раздроблены и проведены через одноразовые карты. Конечный получатель связан с адресом, который ${financialContact.name} ${pastTense(financialContact, "указывал", "указывала")} при старой доставке.\nНазначение не доказывает мотив автоматически, но опровергает заявление об отсутствии финансовых контактов.`,
      tags: ["финансы", "скрытая связь"],
      relevant: financialDirect,
      lockedBy: "task-money",
    },
    {
      id: "ev-partner-lab",
      code: "A-37",
      title: "Сверка контрольной серии",
      type: "lab",
      excerpt: `Контрольный образец подтверждает происхождение материала; ведущий специалист — ${supportStaff[0].name}. Личность исполнителя не устанавливается.`,
      content: `Серия: ${scenario.location}.\nСравнены след с объекта, контрольная партия и материал из общего комплекта. ${crimePattern.trace}.\n\nЗаключение: совпадение описывает путь материала и время его появления, но не доказывает, кто физически выполнил действие. Для атрибуции нужна отдельная связка доступа и времени.`,
      tags: ["лаборатория", "контрольная серия", "граница вывода"],
      reliability: "высокая для происхождения материала; нулевая для личности без второго источника",
      status: "материальная линия подготовлена",
      relevant: ["physical", "provenance"].includes(discoveryRoute.id),
      lockedBy: "task-lab",
    },
    {
      id: "ev-lab-spectrum",
      code: "LAB-12",
      title: "Спектральное сравнение контрольной серии",
      type: "lab",
      excerpt: "Прибор подтверждает происхождение материала, но не владельца предмета.",
      content: `Эксперт: ${supportStaff[0].name}.\nСлед на объекте сопоставлен с контрольной серией и журналом выдачи. Результат совместим с одним производственным контуром; предмет мог пройти через общий комплект.\n\nЭкспертный предел: совпадение состава не атрибутирует действие человеку.`,
      tags: ["спектр", "материал", "экспертиза"],
      reliability: "высокая для состава; не устанавливает человека",
      status: "происхождение материала уточнено",
      relevant: true,
      lockedBy: "spectral-control",
    },
    {
      id: "ev-lab-custody",
      code: "LAB-15",
      title: "Проверка пломбы и ручной отметки",
      type: "lab",
      excerpt: "Целостность контейнера подтверждена; ручная отметка времени остаётся ограниченным источником.",
      content: `Специалист: ${supportStaff[2].name}.\nНомер пломбы совпал с исходной фотографией. Ручная подпись появилась позже автоматической передачи, поэтому она не может без проверки заменить журнал сканера.\n\nВывод: физическая цепь сохранена; временная цепь требует дополнительного источника.`,
      tags: ["цепь хранения", "пломба", "время"],
      reliability: "высокая для целостности; средняя для времени ручной записи",
      status: "частичный разрыв описан",
      relevant: true,
      lockedBy: "custody-seal",
    },
    {
      id: "ev-mail-header",
      code: "LAB-18",
      title: "Разбор маршрута письма",
      type: "lab",
      excerpt: "Заголовок фиксирует общий терминал и время, но не автора сообщения.",
      content: `Аналитик: ${supportStaff[1].name}.\nПисьмо прошло через ${primaryOrganization.name} в критический период. Display-Name и сетевой адрес не идентифицируют человека без журнала сеанса и отдельного действия.\n\nВывод: маршрут подтверждён, авторство открыто для проверки.`,
      tags: ["почта", "метаданные", "атрибуция"],
      reliability: "высокая для маршрута; низкая для личности",
      status: "нужна корреляция с сеансом",
      relevant: true,
      lockedBy: "mail-header",
    },
    {
      id: "ev-lab-signal",
      code: "LAB-23",
      title: "Триангуляция архивного сигнала",
      type: "lab",
      excerpt: "Пересечение направлений сужает зону поиска, а не указывает на оператора передатчика.",
      content: `Коррекция часов трёх антенн оставляет сектор в районе «${scenario.district}». Отражения от металлоконструкций расширяют допустимую полосу.\n\nВывод: есть место для проверки, но не доказательство присутствия или личности.`,
      tags: ["сигнал", "триангуляция", "место"],
      reliability: "средняя; зависит от отражений",
      status: "сектор поиска установлен",
      relevant: true,
      lockedBy: "signal-triangulation",
    },
    {
      id: "ev-computer-mail",
      code: "PC-04",
      title: `Контекст письма: ${mailbox.clueSubject}`,
      type: "digital",
      excerpt: mailbox.clue.finding,
      content: `Отправитель: ${mailbox.clueSender}\nТема: ${mailbox.clueSubject}\n\n${mailbox.clue.finding}\n\nПредел вывода: одно письмо фиксирует административный или бытовой контекст. Оно не устанавливает личность причастного без второго источника из канала «${discoveryRoute.secondary}».`,
      tags: ["почта", "контекст", "косвенный источник"],
      reliability: "высокая для текста локальной копии; авторство и смысл требуют проверки",
      status: "косвенное звено, не обвинение",
      relevant: true,
      lockedBy: "computer-mail",
    },
    {
      id: "ev-computer-meta",
      code: "PC-09",
      title: "Метаданные резервной фотографии",
      type: "digital",
      excerpt: "Время редактирования не совпадает с легендой о выключенном устройстве.",
      content: `Артефакт канала ${discoveryRoute.id}\nCreated: ${formatClock(incidentMinute - 19)}\nModified: ${formatClock(incidentMinute - 14)}\nEditor account: ${alias}\nLocation cache: ${scenario.district}\n\nФайл был переименован, но блок метаданных сохранился. Профиль редактора использовался на общем терминале.`,
      tags: ["компьютер", "метаданные"],
      relevant: ["network", "provenance", "physical"].includes(discoveryRoute.id),
      lockedBy: "computer-meta",
    },
    {
      id: "ev-dead-end-resolution",
      code: "R-36",
      title: "Развилка: конфликт без причинного продолжения",
      type: "logic",
      excerpt: firstConflict ? `Цепочка «${firstConflict.title}» объясняет ложь двух участников, но замыкается вне преступления.` : "Логическая развилка не требуется на этом уровне.",
      content: firstConflict ? `Участники: ${firstConflict.actorNames.join(" / ")}.\n\nИсходная зацепка: ${firstConflict.hook}\nПоворот: ${firstConflict.turn}.\nЗамыкание: ${firstConflict.closure}.\n\nПредел вывода: конфликт и взаимная ложь подтверждены, однако нет звена, связывающего их со способом «${method}» и критическим окном. Исключить цепочку позволяет контрольная отметка ${firstConflict.excludedBy}.` : "Нет данных.",
      tags: ["логический тупик", "конфликт", "исключено"],
      reliability: "высокая после замыкания всей цепочки",
      status: `реальный конфликт; не причина события «${archetype.outcomeLabel}»`,
      relevant: false,
      lockedBy: "logic-dead-end",
    },
    {
      id: "ev-causal-method",
      code: "F-38",
      title: "Разделение причины, маскировки и случайности",
      type: "forensics",
      excerpt: `Физический след отделяет реальный механизм от версии «${crimePattern.apparent}».`,
      content: `Установленный механизм: ${method}.\nНаблюдение, которое его подтверждает: ${crimePattern.trace}.\n\nСознательная маскировка: ${crimePattern.staging}.\nСлучайное обстоятельство: ${crimePattern.incidental}.\nКажущаяся причина: ${crimePattern.apparent}.\n\nЭкспертный предел: вывод о механизме не устанавливает личность исполнителя; для атрибуции нужны доступ, время и независимый цифровой либо материальный след.`,
      tags: ["причинность", "маскировка", "экспертиза"],
      reliability: "высокая для механизма; личность не установлена",
      status: "причина установлена условно",
      relevant: true,
      lockedBy: "causal-method",
    },
    {
      id: "ev-routine-gap", code: "R-41", title: "Разделённая линия распорядка", type: "timeline",
      excerpt: `Пропуск, устройство и личная покупка больше не считаются одним непрерывным алиби. Профиль линии: ${routineContact.name}.`,
      content: `Дом: ${routineContact.homeAddress}.\nРабота: ${routineContact.workAddress}.\nОбычный распорядок: ${routineContact.routine}.\nБытовая привычка: ${routineContact.habit}.\n\nПосле разделения источников осталось окно, в котором групповая отметка не подтверждает личность пользователя. Контрольная личная операция произошла только в ${formatClock(incidentMinute + 14)}.`,
      tags: ["распорядок", "окно возможности", "условный вывод"], reliability: "высокая для отметок, средняя для атрибуции", status: "окно установлено; личность требует второго источника", relevant: routineDirect, lockedBy: "routine-gap",
    },
    {
      id: "ev-ledger-chain", code: "F-43", title: "Владение платёжным токеном", type: "finance",
      excerpt: "Общий адрес отделён от контроля над одноразовым токеном.",
      content: `Токен активирован на терминале ${primaryOrganization.name}.\nАдрес назначения: ${financialContact.homeAddress}.\nОснование: возврат залога по закрытому заказу.\n\nАдрес ранее использовался организацией, поэтому сам по себе не устанавливает получателя. Журнал сеанса связывает операцию с отдельным учётным окном. Имя профиля: ${financialContact.name}. Назначение платежа всё ещё допускает законное объяснение.`,
      tags: ["финансы", "владение", "граница вывода"], reliability: "высокая для токена; мотив не установлен", status: "финансовая связь подтверждена условно", relevant: financialDirect, lockedBy: "ledger-chain",
    },
    {
      id: "ev-contact-graph", code: "G-46", title: "Граф контактов после очистки", type: "social",
      excerpt: "Удалены случайные общие знакомые; осталась одна совместная точка во времени и месте.",
      content: `Крайние узлы: ${socialOther.name} / ${socialContact.name}.\nОрганизация-посредник: ${primaryOrganization.name}.\nСовместная точка: ${scenario.district}, ${formatClock(incidentMinute - 31)}.\nПредмет обмена: контейнер с инвентарным номером, упомянутый в двух независимых источниках.\n\nОграничение: граф доказывает возможность прямого контакта, но содержание контакта восстанавливается отдельно.`,
      tags: ["социальный граф", "посредник", "контакт"], reliability: "средняя до материального подтверждения", status: "прямой контакт вероятен", relevant: socialDirect, lockedBy: "contact-graph",
    },
    {
      id: "ev-document-provenance", code: "P-49", title: "Цепь происхождения документа", type: "document",
      excerpt: "Поля автора, редактора и владельца сеанса разделены.",
      content: `Организация: ${primaryOrganization.name}.\nТерминал: общий, ${primaryOrganization.address}.\nПоле Author: ${provenanceContact.name}.\nПрофиль редактора: ${alias}.\nПодпись добавлена позже исходного сохранения.\n\nВывод: файл проходил через общий терминал. Личность редактора устанавливается не полем Author, а пересечением времени сеанса, физического доступа и независимого действия.`,
      tags: ["происхождение", "документ", "метаданные"], reliability: "высокая для цепи файла", status: "авторство требует корреляции", relevant: provenanceDirect, lockedBy: "document-provenance",
    },
  ];

  const conflictEvidence = conflictChains.flatMap((chain, index) => [
    {
      id: `${chain.id}-hook`, code: `CF-${index + 1}A`, title: `${chain.title}: исходная зацепка`, type: "conflict",
      excerpt: chain.hook,
      content: `${chain.hook}\n\nПредполагаемый мотив: ${chain.apparentMotive}. Оба участника сначала отрицали прямой контакт. Совпадают дата, место вторичного события и общий посредник. Это сильная связь между людьми, но пока не связь с механизмом «${archetype.mechanismLabel}».`,
      tags: ["конфликт", "скрытая связь", "неполная цепь"], reliability: "средняя", status: "подозрительное совпадение", relevant: false,
    },
    {
      id: `${chain.id}-turn`, code: `CF-${index + 1}B`, title: `${chain.title}: сложный поворот`, type: "conflict",
      excerpt: chain.turn,
      content: `${chain.turn}.\n\nОба участника продолжают лгать о причине встречи, потому что правдивое объяснение создаёт для них отдельные профессиональные и личные последствия. Ложь поэтому реальна, согласована и не обязательно относится к событию «${archetype.outcomeLabel}».`,
      tags: ["поворот", "ложь", "альтернативное объяснение"], reliability: "средняя; мотив лжи подтверждён частично", status: "конфликт переоценён", relevant: false,
    },
    {
      id: `${chain.id}-close`, code: `CF-${index + 1}C`, title: `${chain.title}: контрольная граница`, type: "conflict",
      excerpt: chain.closure,
      content: `${chain.closure}.\n\nКонтрольная отметка: ${chain.excludedBy}. Она получена из независимого источника и помещает ключевое действие цепочки вне критического окна. Цепочка объясняет социальные недоговорки, но не образует непрерывного пути «мотив → возможность → средство → результат».`,
      tags: ["проверка", "граница вывода", "тупик"], reliability: "высокая", status: "цепочка замкнута", relevant: false,
    },
  ]);

  const worldEvidence = suspects.flatMap((person, index) => [
    {
      id: `world-${person.id}-profile`, code: `CITY-${String(index + 1).padStart(2, "0")}A`, title: `Городская карточка: ${person.name}`, type: "document",
      excerpt: `${person.role}; ${person.employer}. Адреса и официальный распорядок без следственной интерпретации.`,
      content: `${person.name}\nПрофессия: ${person.role}\nОрганизация: ${person.employer}\nРабочий адрес: ${person.workAddress}\nДомашний адрес: ${person.homeAddress}\nОбычный распорядок: ${person.routine}\nБытовая особенность: ${person.habit}\n\nИсточники: кадровая карточка, городская адресная база, четыре недели обезличенных отметок. Данные описывают привычку, но не гарантируют поведение в день события.`,
      tags: ["городская база", "адрес", "распорядок"], reliability: "высокая для официальных полей, вероятностная для привычек", status: "контекст мира", relevant: false,
    },
    {
      id: `world-${person.id}-links`, code: `CITY-${String(index + 1).padStart(2, "0")}B`, title: `Связи и общие места: ${person.name}`, type: "social",
      excerpt: `${person.relationship}; известны общие адреса с другими участниками, но часть объясняется работой.`,
      content: `Рабочая связь: ${person.employer}.\nОбщее место: ${scenario.district}.\nСвязь с центральным участником: ${person.relationship}.\nЛичная причина скрытности: ${person.privateStake}.\n\nПримечание: совместное место или знакомый создают ребро графа, но не указывают направление влияния и содержание контакта.`,
      tags: ["социальный граф", "общее место", "легенда"], reliability: "средняя; собрана из разных периодов", status: "неинтерпретированная связь", relevant: false,
    },
  ]);

  const staffEvidence = supportStaff.map((person, index) => ({
    id: `staff-${person.id}-memo`,
    code: `LAB-M${index + 1}`,
    title: `Рабочая карточка: ${person.name}`,
    type: "lab",
    excerpt: `${person.role} · ${person.organization}. Профиль: ${person.specialty}.`,
    content: `${person.name}\nРоль: ${person.role}\nОрганизация: ${person.organization}\nСпециализация: ${person.specialty}.\n\nСлужебная запись: сотрудник подключён к проверке как независимый эксперт. Его вывод описывает только границы собственного метода и не подменяет решение по делу.`,
    tags: ["рабочая группа", "эксперт", "контекст"],
    reliability: "официальная кадровая карточка; не является доказательством по существу дела",
    status: "контакт рабочей группы",
    relevant: false,
  }));

  evidence.forEach((item) => {
    item.reliability ||= "требует сопоставления с независимым источником";
    item.status ||= item.relevant ? "проверяемое звено" : "контекст, не доказательство";
  });

  const noiseEvidence = Array.from({ length: difficulty.noise }, (_, index) => {
    const title = `${choose(rng, NOISE_TITLES)} №${String(index + 1).padStart(2, "0")}`;
    const line = choose(rng, NOISE_LINES);
    return {
      id: `noise-${index + 1}`,
      code: `X-${String(40 + index).padStart(2, "0")}`,
      title,
      type: choose(rng, ["document", "log", "finance", "interview"]),
      excerpt: line,
      content: `${title}\n\n${line}\nДата регистрации: ${String(2 + (index % 25)).padStart(2, "0")}.0${1 + (index % 8)}.2026\nОтветственный отдел: ${choose(rng, ["хозяйственный", "транспортный", "архивный", "технический"])}.`,
      tags: [choose(rng, ["проверено", "фон", "совпадение", "иной период"])],
      reliability: "формально достоверно, причинная связь не установлена",
      status: "совпадение не интерпретировано",
      relevant: false,
    };
  });

  const routeTask = {
    routine: ["Свести транспортные терминалы и личные покупки", "Отделить человека от перемещения его устройств"],
    financial: ["Развернуть историю одноразовых токенов", "Сверить возвраты, залоги и общие адреса"],
    physical: ["Сопоставить партии материала и журналы выдачи", "Проверить инструменты подрядчиков по микроследам"],
    network: ["Развести владельца профиля и носителя устройства", "Сверить локальные снимки и ключи авторизации"],
    social: ["Очистить граф контактов от случайных пересечений", "Найти одновременное присутствие крайних узлов"],
    provenance: ["Построить цепь версий документов", "Сопоставить сеансы общего терминала и подписи"],
  }[discoveryRoute.id];
  // Фоновые поручения возвращают отдельные заключения.
  const tasks = [
    {
      id: "task-cell",
      title: routeTask[0],
      description: `${18 + Math.floor(rng() * 34)} тысяч строк и событий. Напарник нормализует источники, но не будет интерпретировать мотив.`,
      duration: difficulty.taskSeconds,
      evidenceId: "ev-partner-cell",
    },
    {
      id: "task-money",
      title: routeTask[1],
      description: `Рутинная обработка канала «${discoveryRoute.secondary}». Результат покажет границы вывода и альтернативные объяснения.`,
      duration: difficulty.taskSeconds + 12,
      evidenceId: "ev-partner-money",
    },
    {
      id: "task-lab",
      title: choose(rng, ["Проверить контрольную серию и микрослед", "Сверить пломбы с исходными фотографиями", "Нормализовать журналы приборов и ручные отметки"]),
      description: `${supportStaff[0].name}, ${supportStaff[0].role}, отделяет путь материала от личности исполнителя. Результат дополняет, но не заменяет вашу версию.`,
      duration: difficulty.taskSeconds + 24,
      evidenceId: "ev-partner-lab",
    },
  ];

  const routeFile = {
    routine: { name: "calendar_merge.ics", kind: "ICS", body: `Два часовых пояса, общий ресурс и личное приглашение. Последняя правка: ${formatClock(incidentMinute - 18)}.` },
    financial: { name: "token_returns.csv", kind: "CSV", body: `token,status,address_ref\nA17,returned,ADDR-${Math.floor(rng() * 80 + 10)}\nB04,closed,WORK-${primaryOrganization.id}\n\nПолный адрес вынесен в отдельный журнал владения.` },
    physical: { name: "material_issue.pdf", kind: "PDF", body: `Партия: ${Math.floor(rng() * 8000 + 1000)}-Q\nПолучатель: общий комплект\nСлед: ${crimePattern.trace}` },
    network: { name: "local_snapshot.db", kind: "DB", body: `profile=${alias}\ndevice_owner=conflict\nlast_sync=${formatClock(incidentMinute - 11)}\nsource=local-only` },
    social: { name: "room_booking.ics", kind: "ICS", body: `participants=2\ncups=3\nside_entrance=true\ntime=${formatClock(incidentMinute - 31)}` },
    provenance: { name: "version_manifest.json", kind: "JSON", body: `{ "author": "service_account", "editor": "${alias}", "terminal": "shared", "signedLater": true }` },
  }[discoveryRoute.id];
  // Файлы согласованы с теми же людьми и временным окном.
  const computer = {
    mail: mailbox.messages,
    files: [
      { id: "file-1", name: "intake_context.txt", size: "6 KB", kind: "TXT", body: `${archetype.label}\n${incidentAddress}\nОкно: ${formatClock(incidentMinute - 8)}–${formatClock(incidentMinute + 9)}\nМаршрут проверки: ${discoveryRoute.label}` },
      { id: "file-2", name: choose(rng, ["access_export.csv", "door_events.tsv", "shift_badges.log"]), size: `${12 + Math.floor(rng() * 40)} KB`, kind: "CSV", body: evidence.find((item) => item.id === "ev-access").content },
      { id: "file-3", name: routeFile.name, size: `${2 + Math.floor(rng() * 12)}.${Math.floor(rng() * 9)} MB`, kind: routeFile.kind, body: `${routeFile.body}\n\nВизуальный просмотр неполон. Метаданные сохранены.`, unlock: "computer-meta", metadata: `Created=${formatClock(incidentMinute - 19)}\nModified=${formatClock(incidentMinute - 14)}\nEditor=${alias}\nSource=${primaryOrganization.name}\nLocation-cache=${scenario.district}` },
      { id: "file-4", name: choose(rng, ["voice_fragment.wav", "corridor_audio.flac", "meeting_note.ogg"]), size: `${400 + Math.floor(rng() * 900)} KB`, kind: "AUDIO", body: `[00:03] фоновый шум\n[00:07] сигнал оборудования\n[00:11] неразборчивая фраза о боковом входе\n[00:14] запись обрывается. Голос не атрибутирован.` },
      { id: "file-5", name: choose(rng, [".cache_note", ".session_tail", "recover.part"]), size: "1 KB", kind: "SYS", body: `UTF-8 HEX:\n${textToHex(`node=${alias}; terminal=shared; role_group=multi_user`)}` },
      { id: "file-6", name: choose(rng, ["canteen_receipts.pdf", "weekly_roster.ods", "parking_notes.txt"]), size: `${8 + Math.floor(rng() * 80)} KB`, kind: "MISC", body: "Фоновый бытовой массив. Несколько временных отметок относятся к устройствам, а не к людям." },
      { id: "file-7", name: choose(rng, ["control_series.lab", "seal_photo_index.pdf", "receiver_alignment.csv"]), size: `${3 + Math.floor(rng() * 9)} MB`, kind: "LAB", body: `Рабочая группа: ${supportStaff.map((person) => person.name).join(" / ")}\nМетод: ${supportStaff[0].specialty}.\n\nМатериал готов к ручной проверке в лаборатории. Совпадение образцов, времени или маршрута не атрибутирует действие личности без независимого звена.` },
      { id: "file-8", name: choose(rng, ["archive_transfer_note.md", "field_call_sheet.txt", "review_questions.rtf"]), size: `${4 + Math.floor(rng() * 16)} KB`, kind: "NOTE", body: `Вопросы к следующей проверке:\n1. Кто контролировал носитель в критическое окно?\n2. Что подтверждает время независимо от ручной записи?\n3. Какая версия объясняет след «${crimePattern.trace}» без подмены личности совпадением?` },
    ],
    network: [
      `${formatClock(incidentMinute - 38)} AUTH  backup-service  OK`,
      `${formatClock(incidentMinute - 17)} DHCP  ${alias}  10.4.7.${20 + culpritIndex}`,
      `${formatClock(incidentMinute - 11)} ${choose(rng, ["SMB", "CALDAV", "SFTP", "SYNC"])}   ${alias}  /shared/${discoveryRoute.id}`,
      `${formatClock(incidentMinute - 9)}  AUTH  guest-tablet  FAIL`,
      `${formatClock(incidentMinute + 3)}  NET   camera-02  LINK_DOWN`,
    ],
  };

  // Поле расширяет основное дело, сохраняя единственную скрытую истину.
  return detective.enrich({
    seed,
    requestedKind: caseKind,
    difficultyKey,
    difficulty,
    scenario,
    archetype,
    discoveryRoute,
    title: caseTitle,
    number: `ТО-${String(Math.floor(rng() * 999)).padStart(3, "0")}/${String(26 + Math.floor(rng() * 3))}`,
    victim: { ...victimPerson, role: victimRole },
    client: `${commissioner.name}, ${commissioner.role}`,
    commissioner,
    organizations,
    primaryOrganization,
    incidentAddress,
    mandateText,
    routeReconstruction,
    strongEvidenceIds: strongEvidenceByRoute[discoveryRoute.id],
    sector: choose(rng, scenario.sectors),
    circumstance: incidentSummary,
    incidentMinute,
    culpritId: culprit.id,
    motive,
    apparentMotive,
    method,
    apparentMethod: crimePattern.apparent,
    staging: crimePattern.staging,
    incidental: crimePattern.incidental,
    trace: crimePattern.trace,
    alias,
    suspects,
    supportStaff,
    conflictChains,
    events: eventSpecs,
    puzzles: selectedPuzzles,
    evidence: [...evidence, ...staffEvidence, ...worldEvidence, ...conflictEvidence, ...noiseEvidence],
    tasks,
    computer,
    motiveOptions: shuffled(rng, MOTIVES),
    methodOptions: shuffled(rng, [method, ...shuffled(rng, [...new Set(CASE_ARCHETYPES.flatMap((item) => item.patterns.map((pattern) => pattern.method)))].filter((item) => item !== method)).slice(0, 7)]),
  }, profile, storyRng);
}
