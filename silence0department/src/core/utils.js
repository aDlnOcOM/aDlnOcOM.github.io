/** Детерминированная случайность, форматирование, экранирование и построение сообщений. */
import { PERSON_NAME_BANK, ROLE_FORMS, STREET_NAMES, MAILBOX_TEMPLATES } from '../data/catalog.js';

// Чистое преобразование данных: hashSeed. Не читает состояние приложения.
export function hashSeed(value) {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}


// Чистое преобразование данных: randomGenerator. Не читает состояние приложения.
export function randomGenerator(seed) {
  const seedHash = hashSeed(seed)();
  let value = seedHash;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}


// Чистое преобразование данных: choose. Не читает состояние приложения.
export function choose(rng, list) {
  return list[Math.floor(rng() * list.length)];
}


// Чистое преобразование данных: shuffled. Не читает состояние приложения.
export function shuffled(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}


// Чистое преобразование данных: uniquePeople. Не читает состояние приложения.
export function uniquePeople(rng, count) {
  const people = [];
  const used = new Set();
  while (people.length < count) {
    const gender = rng() < 0.5 ? "male" : "female";
    const bank = PERSON_NAME_BANK[gender];
    const firstName = choose(rng, bank.first);
    const lastName = choose(rng, bank.last);
    const name = `${firstName} ${lastName}`;
    if (!used.has(name)) {
      used.add(name);
      people.push({ name, firstName, lastName, gender });
    }
  }
  return people;
}


// Чистое преобразование данных: gendered. Не читает состояние приложения.
export function gendered(person, masculine, feminine) {
  return person.gender === "female" ? feminine : masculine;
}


// Чистое преобразование данных: roleForGender. Не читает состояние приложения.
export function roleForGender(role, gender) {
  if (gender === "female") return ROLE_FORMS[role] || role;
  const maleForm = Object.entries(ROLE_FORMS).find(([, femaleForm]) => femaleForm === role)?.[0];
  return maleForm || role;
}


// Чистое преобразование данных: pastTense. Не читает состояние приложения.
export function pastTense(person, masculine, feminine) {
  return gendered(person, masculine, feminine);
}


// Чистое преобразование данных: escapeHtml. Не читает состояние приложения.
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// Чистое преобразование данных: normalize. Не читает состояние приложения.
export function normalize(value) {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]/gi, "")
    .trim();
}


// Чистое преобразование данных: sentenceStart. Не читает состояние приложения.
export function sentenceStart(value) {
  const text = String(value).trim();
  return text ? text[0].toLocaleUpperCase("ru-RU") + text.slice(1) : text;
}


// Чистое преобразование данных: initials. Не читает состояние приложения.
export function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}


// Чистое преобразование данных: surname. Не читает состояние приложения.
export function surname(name) {
  return name.split(" ").at(-1);
}


// Чистое преобразование данных: formatClock. Не читает состояние приложения.
export function formatClock(totalMinutes) {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}


// Чистое преобразование данных: formatDuration. Не читает состояние приложения.
export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


// Чистое преобразование данных: pluralRu. Не читает состояние приложения.
export function pluralRu(number, one, few, many) {
  const absolute = Math.abs(number) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}


// Чистое преобразование данных: encodeCaesar. Не читает состояние приложения.
export function encodeCaesar(text, shift) {
  const alphabet = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
  return [...text]
    .map((letter) => {
      const index = alphabet.indexOf(letter);
      return index < 0 ? letter : alphabet[(index + shift) % alphabet.length];
    })
    .join("");
}


// Чистое преобразование данных: textToHex. Не читает состояние приложения.
export function textToHex(text) {
  return [...new TextEncoder().encode(text)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join(" ");
}


// Чистое преобразование данных: hiddenBinary. Не читает состояние приложения.
export function hiddenBinary(text) {
  return [...text]
    .flatMap((letter) => letter.charCodeAt(0).toString(2).padStart(8, "0").split(""))
    .map((bit) => (bit === "0" ? "\u200b" : "\u200c"))
    .join("");
}


// Чистое преобразование данных: randomCaseCode. Не читает состояние приложения.
export function randomCaseCode() {
  const words = ["BLUE", "BRASS", "NIGHT", "ECHO", "VELVET", "SMOKE", "MUTE", "NOIR"];
  const word = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${number}`;
}


// Чистое преобразование данных: createAcrostic. Не читает состояние приложения.
export function createAcrostic(word) {
  const lines = {
    а: "Август оставляет на стёклах пыль.",
    б: "Блеклый свет задержался у двери.",
    в: "Вечер помнит шаги лучше людей.",
    г: "Город молчит, когда ему выгодно.",
    и: "Имена стираются, номера остаются.",
    л: "Лишняя пауза бывает признанием.",
    м: "Медная стрелка не врёт о времени.",
    н: "Никто не смотрит под собственные ноги.",
    о: "Окна напротив погасли слишком рано.",
    п: "Пепел легче бумаги, но помнит огонь.",
    р: "Ровно в полночь тишина становится громче.",
    с: "Старый ключ всё ещё знает замок.",
    т: "Третий звонок был короче первых двух.",
    ф: "Фонарь качнулся без ветра.",
    ц: "Цифры на полях написаны другой рукой.",
    х: "Холод пришёл со стороны лестницы.",
    ь: "Ь — знак невозможный; пропусти его.",
    я: "Ящик закрыт, но пыль вокруг нарушена.",
  };
  return [...word].map((letter) => lines[letter] || `${letter.toUpperCase()} — отметка на полях.`).join("\n");
}


// Чистое преобразование данных: generateAddress. Не читает состояние приложения.
export function generateAddress(rng) {
  return `${choose(rng, STREET_NAMES)}, ${4 + Math.floor(rng() * 116)}, кв. ${1 + Math.floor(rng() * 84)}`;
}


// Чистое преобразование данных: buildMailbox. Не читает состояние приложения.
export function buildMailbox(rng, context) {
  const { victim, culprit, route, incidentMinute, organization, scenario, pattern, supportStaff = [] } = context;
  const ordinary = shuffled(rng, MAILBOX_TEMPLATES).slice(0, 7 + Math.floor(rng() * 4)).map((template, index) => ({
    id: `mail-${index + 1}`,
    from: template.from.replace("work.local", organization.domain),
    subject: template.subject,
    time: formatClock(9 * 60 + Math.floor(rng() * 690)),
    body: template.body,
    important: index === 2 || (index === 5 && rng() > 0.45),
    folder: choose(rng, ["Входящие", "Входящие", "Архив", "Уведомления"]),
  }));

  const routeClues = {
    routine: {
      from: `calendar@${organization.domain}`,
      subject: "Исправление времени встречи",
      body: `В исходном приглашении стояло ${formatClock(incidentMinute - 34)}. После синхронизации — ${formatClock(incidentMinute - 18)}. Изменение сделал общий ресурс переговорной, а не участник встречи.`,
      finding: "Календарная поправка сдвигает окно, но не устанавливает автора изменения.",
    },
    financial: {
      from: `accounting@${organization.domain}`,
      subject: "Платёж вернулся без назначения",
      body: `Сумма разбита на ${2 + Math.floor(rng() * 3)} части. Один токен связан со старым адресом доставки, которым пользовались несколько сотрудников. Нужна сверка конечного получателя.`,
      finding: "Письмо подтверждает структуру платежа, но связь с человеком требует адресной истории.",
    },
    physical: {
      from: `maintenance@${organization.domain}`,
      subject: "Материал выдан без номера заказа",
      body: `Остаток из ремонтного комплекта передан на объект «${scenario.location}». В бумажном журнале подпись есть, в электронной заявке — нет.`,
      finding: `Выдача объясняет доступ к материалу, связанному со следом: ${pattern.trace}. Получателя ещё нужно установить.`,
    },
    network: {
      from: `backup@${organization.domain}`,
      subject: "Конфликт двух локальных снимков",
      body: `Узел ${context.alias} появился в двух копиях с разными владельцами профиля. Автоматическое объединение отменено; сохранены оба идентификатора устройства.`,
      finding: "Псевдоним принадлежит профилю, но устройство в критический момент могло быть передано.",
    },
    social: {
      from: `room@${organization.domain}`,
      subject: "Кто оставил третий стул?",
      body: `Переговорная была заказана на двоих, но после встречи нашли три чашки. Камера коридора не покрывает боковую лестницу.`,
      finding: "Встреча имела незаявленного третьего участника; письмо не раскрывает его личность.",
    },
    provenance: {
      from: `docs@${organization.domain}`,
      subject: "Версия файла не совпала",
      body: `Вложение создано раньше письма, но подпись добавлена позже с общего терминала. Не используйте поле «Автор» как идентификатор сотрудника.`,
      finding: "Цепь версий опровергает заявленное время документа, но общий терминал оставляет несколько возможных авторов.",
    },
  };
  const clue = routeClues[route.id];
  const clueMessage = {
    id: `mail-${ordinary.length + 1}`,
    from: clue.from,
    subject: clue.subject,
    time: formatClock(incidentMinute - 67 - Math.floor(rng() * 90)),
    body: clue.body,
    important: rng() > 0.5,
    folder: choose(rng, ["Входящие", "Архив", "Помеченные"]),
    unlock: "computer-mail",
  };
  const sentMessage = {
    id: `mail-${ordinary.length + 2}`,
    from: victim.name,
    subject: choose(rng, ["Re: завтра", "без темы", "проверю после смены", "список на потом"]),
    time: formatClock(incidentMinute - 180 - Math.floor(rng() * 240)),
    body: choose(rng, [
      "Не пересылай пока. Там два разных вопроса, и один из них вообще не относится к работе.",
      "Я видел несоответствие, но сначала хочу проверить первичный источник. Иначе обвиню не того человека.",
      "В календаре снова неверное время. Оставлю бумажную копию у себя.",
      "Если я опоздаю, начинайте без меня. Телефон может быть выключен из-за резервного копирования.",
    ]),
    important: true,
    folder: "Отправленные",
  };
  const staffMessages = supportStaff.slice(0, 2).map((person, index) => ({
    id: `mail-staff-${index + 1}`,
    from: `${person.firstName.toLocaleLowerCase("ru-RU")}.${person.lastName.toLocaleLowerCase("ru-RU").replaceAll("ё", "е")}@${organization.domain}`,
    subject: index === 0 ? "Нужен второй контрольный замер" : "Уточнение по цепочке хранения",
    time: formatClock(incidentMinute - 130 + index * 19),
    body: index === 0
      ? `${victim.name}, я отмечаю только наблюдение: ${pattern.trace}. До сравнения с контрольной серией это не указывает на человека. ${person.name}, ${person.role}.`
      : `Пожалуйста, не объединяйте поле автора, учётную запись и владельца носителя. По материалу «${scenario.location}» это три разные роли. ${person.name}, ${person.role}.`,
    important: index === 0 && rng() > 0.55,
    folder: choose(rng, ["Входящие", "Архив", "Черновики"]),
  }));
  return {
    messages: shuffled(rng, [...ordinary, clueMessage, sentMessage, ...staffMessages]),
    clue,
    clueSender: clueMessage.from,
    clueSubject: clueMessage.subject,
  };
}
