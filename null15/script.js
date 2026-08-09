"use strict";

/*
  NULL//15 — Infinite Roll
  Standalone vanilla JavaScript prototype.
  No dependencies, no build step, no external assets.
*/

const STORAGE_KEY = "null15-infinite-roll-save-v1";
const SETTINGS_KEY = "null15-infinite-roll-settings-v1";
const BUILD = "1.1.2";
const BOARD_ANIMATION_MS = 180;
const DICE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const PRIME_VALUES = new Set([2, 3, 5, 7, 11, 13]);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pct = (value, max) => `${clamp((value / Math.max(1, max)) * 100, 0, 100)}%`;
const deepClone = (value) => JSON.parse(JSON.stringify(value));

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hashSeed(seed) {
  const input = String(seed || "NULL").trim() || "NULL";
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
}

const PATTERNS = [
  { id: "LINE", name: "LINE", label: "Линия", desc: "Три или четыре плитки в строке либо столбце." },
  { id: "SEQUENCE", name: "SEQUENCE", label: "Последовательность", desc: "Три соседних числа идут по возрастанию или убыванию." },
  { id: "MIRROR", name: "MIRROR", label: "Зеркало", desc: "Соседние пары дают сумму 16." },
  { id: "QUAD", name: "QUAD", label: "Квадрат", desc: "Заполненный сектор 2×2." },
  { id: "CROSS", name: "CROSS", label: "Крест", desc: "Пять плиток образуют крест." },
  { id: "ORBIT", name: "ORBIT", label: "Орбита VOID", desc: "Пустота замкнула маршрут минимум из четырёх ходов." },
  { id: "EDGE", name: "EDGE", label: "Периметр", desc: "Три соседние плитки на внешней границе." },
  { id: "SOLVED", name: "SOLVED", label: "Порядок", desc: "Минимум три плитки стоят на правильных позициях." },
];

const EFFECTS = [
  { id: "CUT", name: "CUT", label: "Точный удар", category: "attack" },
  { id: "RAIL", name: "RAIL", label: "Пробитие пачки", category: "attack" },
  { id: "DRAIN", name: "DRAIN", label: "Похищение", category: "attack" },
  { id: "AEGIS", name: "AEGIS", label: "Щит", category: "defence" },
  { id: "RIPOSTE", name: "RIPOSTE", label: "Контратака", category: "defence" },
  { id: "JAM", name: "JAM", label: "Задержка", category: "utility" },
  { id: "PATCH", name: "PATCH", label: "Восстановление", category: "utility" },
  { id: "REWRITE", name: "REWRITE", label: "Перезапись поля", category: "utility" },
];

const PROTOCOLS = [
  { id: "MATCH", name: "MATCH", label: "Совпадение", desc: "Группа содержит обе выпавшие грани." },
  { id: "SUM", name: "SUM", label: "Сумма", desc: "Пара граней равна сумме двух костей." },
  { id: "GAP", name: "GAP", label: "Разница", desc: "Разница пары равна разнице костей." },
];

const COMBO_PREFIX = {
  LINE: "Needle",
  SEQUENCE: "Ascendant",
  MIRROR: "Twin",
  QUAD: "Checksum",
  CROSS: "EMP",
  ORBIT: "Black Orbit",
  EDGE: "Perimeter",
  SOLVED: "Zero State",
};

const COMBO_SUFFIX = {
  CUT: "Cut",
  RAIL: "Rail",
  DRAIN: "Leech",
  AEGIS: "Bastion",
  RIPOSTE: "Counter",
  JAM: "Silence",
  PATCH: "Restore",
  REWRITE: "Recompile",
};

const HEROES = [
  {
    id: "vanta",
    index: "01",
    glyph: "V",
    name: "VANTA//BLADE",
    role: "Линии · темп · критический урон",
    desc: "Ускоряет бой, собирая разные направления движения. Лучше всего раскрывается через LINE и SEQUENCE.",
    hp: 76,
    energy: 8,
    passive: {
      id: "v_momentum",
      name: "VECTOR MOMENTUM",
      desc: "Четыре разных направления за цикл усиливают следующую атаку на 50%.",
    },
    abilities: [
      { id: "v_cutline", name: "CUTLINE", desc: "Удар по цели; усиливается за собранные линии.", cost: 2, cooldown: 1 },
      { id: "v_rail", name: "RAIL CASCADE", desc: "Пробивающий урон всей вражеской пачке.", cost: 3, cooldown: 2 },
      { id: "v_blink", name: "BLINK CANCEL", desc: "Следующие два сдвига не двигают таймеры врагов.", cost: 2, cooldown: 3 },
      { id: "v_afterimage", name: "AFTERIMAGE", desc: "Следующая комбинация повторяется с меньшей силой.", cost: 3, cooldown: 3 },
      { id: "v_ult", name: "BLACK VECTOR", desc: "VOID наносит волновой урон за каждые четыре уникальные плитки пути.", cost: 6, cooldown: 5, ultimate: true },
    ],
  },
  {
    id: "bulwark",
    index: "02",
    glyph: "B",
    name: "BULWARK-0",
    role: "Броня · якоря · контратака",
    desc: "Конвертирует порядок поля в броню и отражает вражеские атаки. Надёжен против плотных пачек.",
    hp: 106,
    energy: 8,
    passive: {
      id: "b_stable",
      name: "STABLE STATE",
      desc: "В начале цикла получает броню за правильно расположенные плитки.",
    },
    abilities: [
      { id: "b_lock", name: "HARD LOCK", desc: "Защищает две правильные плитки и даёт броню.", cost: 2, cooldown: 2 },
      { id: "b_parry", name: "PARRY SQUARE", desc: "Получает щит и готовит контратаку.", cost: 2, cooldown: 2 },
      { id: "b_anchor", name: "ANCHOR PROTOCOL", desc: "Отменяет следующее заражение или блокировку поля.", cost: 2, cooldown: 3 },
      { id: "b_fortress", name: "FORTRESS LINE", desc: "Броня за правильные плитки и завершённые линии.", cost: 3, cooldown: 2 },
      { id: "b_ult", name: "CLOSED SYSTEM", desc: "Замораживает все вражеские таймеры на шесть сдвигов.", cost: 6, cooldown: 5, ultimate: true },
    ],
  },
  {
    id: "hex",
    index: "03",
    glyph: "H",
    name: "HEX-13",
    role: "Взлом · заражение · изменение правил",
    desc: "Переписывает грани плиток, распространяет цифровой урон и очищает вражеские вмешательства.",
    hp: 82,
    energy: 9,
    passive: {
      id: "h_exploit",
      name: "EXPLOIT",
      desc: "Первое снятое заражение каждого цикла возвращает 2 NULL ENERGY.",
    },
    abilities: [
      { id: "h_bitflip", name: "BITFLIP", desc: "На шесть сдвигов инвертирует значения граней плиток.", cost: 2, cooldown: 2 },
      { id: "h_fork", name: "FORK PROCESS", desc: "Следующая комбинация получает +2 силы.", cost: 2, cooldown: 2 },
      { id: "h_bomb", name: "SYNTAX BOMB", desc: "Накладывает сильный периодический урон на цель.", cost: 3, cooldown: 2 },
      { id: "h_purge", name: "ROOT PURGE", desc: "Очищает поле и наносит урон за снятые состояния.", cost: 3, cooldown: 3 },
      { id: "h_ult", name: "KERNEL PANIC", desc: "Инвертирует кости и немедленно запускает все заражения.", cost: 6, cooldown: 5, ultimate: true },
    ],
  },
  {
    id: "casino",
    index: "04",
    glyph: "6",
    name: "CASINO//SIX",
    role: "Кости · риск · двойные активации",
    desc: "Управляет бросками и ставит здоровье на мощные повторные комбинации.",
    hp: 80,
    energy: 9,
    passive: {
      id: "c_edge",
      name: "HOUSE EDGE",
      desc: "Цикл без ручного переброса даёт LUCK; три LUCK улучшают следующий бросок.",
    },
    abilities: [
      { id: "c_loaded", name: "LOADED FACE", desc: "Устанавливает белую кость по грани последней плитки.", cost: 1, cooldown: 1 },
      { id: "c_split", name: "SPLIT POT", desc: "До конца цикла протоколы допускают отклонение на единицу.", cost: 2, cooldown: 2 },
      { id: "c_double", name: "DOUBLE DOWN", desc: "Следующая комбинация срабатывает дважды; провал ранит героя.", cost: 2, cooldown: 2 },
      { id: "c_snake", name: "SNAKE EYES", desc: "Устанавливает 1+1 и оглушает всех врагов.", cost: 3, cooldown: 3 },
      { id: "c_ult", name: "ALL IN", desc: "Бросает три кости, оставляет лучшие две и наносит бонусный урон.", cost: 6, cooldown: 5, ultimate: true },
    ],
  },
  {
    id: "mora",
    index: "05",
    glyph: "M",
    name: "MORA//ARCHIVIST",
    role: "Лечение · история поля · восстановление",
    desc: "Сохраняет состояния матрицы, откатывает ошибки и превращает заражения в защиту.",
    hp: 90,
    energy: 8,
    passive: {
      id: "m_restore",
      name: "RESTORE POINT",
      desc: "Один раз за бой сохраняет поле и здоровье, когда HP впервые падает ниже 50%.",
    },
    abilities: [
      { id: "m_patch", name: "PATCH LOOP", desc: "Лечит; замкнутый путь VOID усиливает эффект.", cost: 2, cooldown: 1 },
      { id: "m_checksum", name: "CHECKSUM", desc: "Снимает два состояния с плиток и даёт броню.", cost: 2, cooldown: 2 },
      { id: "m_rollback", name: "ROLLBACK", desc: "Возвращает поле к состоянию четыре сдвига назад.", cost: 3, cooldown: 3 },
      { id: "m_defrag", name: "DEFRAGMENT", desc: "Удаляет все заражения и получает броню за каждое.", cost: 3, cooldown: 3 },
      { id: "m_ult", name: "SYSTEM RESTORE", desc: "Возвращает сохранённое поле и здоровье либо экстренно лечит.", cost: 6, cooldown: 5, ultimate: true },
    ],
  },
  {
    id: "nullwalker",
    index: "06",
    glyph: "Ø",
    name: "NULL//WALKER",
    role: "VOID · пространство · нестандартные ходы",
    desc: "Управляет пустотой, допускает диагональные сдвиги и превращает замкнутые маршруты в взрывы.",
    hp: 84,
    energy: 9,
    passive: {
      id: "n_blank",
      name: "LIVING BLANK",
      desc: "Четыре разные пересечённые плитки восстанавливают энергию и усиливают путь VOID.",
    },
    abilities: [
      { id: "n_voidstep", name: "VOIDSTEP", desc: "Выполняет до трёх полезных сдвигов без вражеских тиков.", cost: 2, cooldown: 2 },
      { id: "n_consume", name: "CONSUME ERROR", desc: "Очищает соседние с VOID плитки и возвращает энергию.", cost: 2, cooldown: 1 },
      { id: "n_horizon", name: "EVENT HORIZON", desc: "На шесть сдвигов увеличивает силу всех комбинаций.", cost: 2, cooldown: 2 },
      { id: "n_second", name: "SECOND ABSENCE", desc: "Четыре сдвига можно двигать плитки по диагонали.", cost: 3, cooldown: 3 },
      { id: "n_ult", name: "ZERO TRACE", desc: "Замкнутый след VOID взрывает всю вражескую пачку.", cost: 6, cooldown: 5, ultimate: true },
    ],
  },
];

const ROOM_DEFS = {
  combat: { name: "ОБЫЧНАЯ СТЫЧКА", symbol: "×", risk: "Стандартный риск", desc: "Тактический бой против процедурной пачки." },
  elite: { name: "ELITE//HUNT", symbol: "!", risk: "Высокий риск · редкая награда", desc: "Усиленные противники с дополнительными мутациями." },
  merchant: { name: "BLACK MARKET", symbol: "₡", risk: "Безопасная зона", desc: "Потратьте кредиты на ремонт, параметры и реликвии." },
  upgrade: { name: "NULL FORGE", symbol: "+", risk: "Безопасная зона", desc: "Улучшите одну способность или ядро персонажа." },
  boss: { name: "BOSS GATE", symbol: "Ω", risk: "Критический риск", desc: "Кардинально отличающийся хранитель акта." },
  treasure: { name: "FORGOTTEN CACHE", symbol: "◇", risk: "Неизвестный риск", desc: "Выберите безопасную добычу или проклятую редкость." },
  anomaly: { name: "GLITCH ANOMALY", symbol: "≈", risk: "Изменение правил", desc: "Примите нестабильный модификатор следующей битвы." },
  repair: { name: "REPAIR BAY", symbol: "✚", risk: "Безопасная зона", desc: "Восстановите корпус или сбросьте накопленный HEAT." },
  dice: { name: "DICE SHRINE", symbol: "⚄", risk: "Управляемая случайность", desc: "Перепрошейте кости или обменяйте здоровье на удачу." },
  memory: { name: "MEMORY ECHO", symbol: "⌁", risk: "Архивная зона", desc: "Усильте случайный фрагмент боевой памяти." },
  shortcut: { name: "VOID SHORTCUT", symbol: "↯", risk: "Пропуск · +HEAT", desc: "Пропустите часть этажа ценой нестабильности." },
};

const RELICS = [
  { id: "broken_d6", name: "BROKEN D6", desc: "Первая выпавшая единица каждого боя превращается в шестёрку." },
  { id: "void_compass", name: "VOID COMPASS", desc: "Подсвечивает сдвиг, увеличивающий число правильных плиток." },
  { id: "chrome_memory", name: "CHROME MEMORY", desc: "Первое заражение поля в каждом бою отменяется." },
  { id: "black_coin", name: "BLACK COIN", desc: "При HEAT 30+ награды кредитами увеличены на 50%." },
  { id: "recursive_lens", name: "RECURSIVE LENS", desc: "Каждая третья комбинация повторяется с 35% силы." },
  { id: "dead_clock", name: "DEAD CLOCK", desc: "Первые два сдвига боя не двигают вражеские таймеры." },
  { id: "prime_skull", name: "PRIME SKULL", desc: "Комбинации с простыми числами наносят на 20% больше урона." },
  { id: "null_crown", name: "NULL CROWN", desc: "Белая кость сохраняется между циклами." },
  { id: "overclock", name: "OVERCLOCK", desc: "Цикл содержит семь сдвигов, но в его конце добавляет 2 HEAT." },
  { id: "blood_cache", name: "BLOOD CACHE", desc: "Уничтожение противника восстанавливает 3 HP." },
  { id: "static_ward", name: "STATIC WARD", desc: "Каждый бой начинается с 10 ARMOR." },
  { id: "last_packet", name: "LAST PACKET", desc: "Один раз за забег предотвращает смерть и восстанавливает 25% HP." },
];

const ENEMY_DEFS = [
  { id: "needle9", name: "NEEDLE-9", archetype: "ДАЛЬНИК", hp: 30, damage: 8, countdown: 3, intent: "ТОЧЕЧНЫЙ ВЫСТРЕЛ" },
  { id: "railEye", name: "RAIL EYE", archetype: "ДАЛЬНИК", hp: 34, damage: 9, countdown: 4, intent: "ЛИНЕЙНЫЙ ЛУЧ" },
  { id: "splinterCloud", name: "SPLINTER CLOUD", archetype: "ДАЛЬНИК", hp: 27, damage: 6, countdown: 2, intent: "РОЕВОЙ ОГОНЬ" },
  { id: "nullHound", name: "NULL HOUND", archetype: "БЛИЖНИК", hp: 38, damage: 10, countdown: 3, intent: "ОХОТА НА VOID" },
  { id: "riotCutter", name: "RIOT CUTTER", archetype: "БЛИЖНИК", hp: 48, damage: 9, countdown: 4, intent: "ВЫБИТЬ ПЛИТКУ" },
  { id: "chainJack", name: "CHAIN JACK", archetype: "БЛИЖНИК", hp: 42, damage: 7, countdown: 3, intent: "ЦЕПНОЙ ЗАХВАТ" },
  { id: "glitchWitch", name: "GLITCH WITCH", archetype: "МАГ", hp: 35, damage: 6, countdown: 4, intent: "ИСКАЗИТЬ ЧИСЛА" },
  { id: "entropyMonk", name: "ENTROPY MONK", archetype: "МАГ", hp: 40, damage: 7, countdown: 3, intent: "ЭНТРОПИЙНЫЙ ЗНАК" },
  { id: "chronoLich", name: "CHRONO LICH", archetype: "МАГ", hp: 37, damage: 5, countdown: 4, intent: "УСКОРИТЬ ПРОТОКОЛ" },
  { id: "patchDrone", name: "PATCH DRONE", archetype: "САППОРТ", hp: 28, damage: 3, countdown: 3, intent: "РЕМОНТ СОЮЗНИКА" },
  { id: "aegisNode", name: "AEGIS NODE", archetype: "САППОРТ", hp: 34, damage: 3, countdown: 4, intent: "ОБЩИЙ ЩИТ" },
  { id: "protocolChoir", name: "PROTOCOL CHOIR", archetype: "САППОРТ", hp: 36, damage: 5, countdown: 3, intent: "ПЕРЕБРОС ПРОТОКОЛА" },
];

const BOSSES = [
  { id: "emptyKing", name: "THE EMPTY KING", archetype: "BOSS//VOID", hp: 180, damage: 12, countdown: 3, intent: "EMPTY THRONE" },
  { id: "oracleSix", name: "ORACLE OF SIX", archetype: "BOSS//DICE", hp: 220, damage: 11, countdown: 3, intent: "PREDICTED ROLL" },
  { id: "infinityEngine", name: "THE INFINITY ENGINE", archetype: "BOSS//RECURSION", hp: 260, damage: 13, countdown: 4, intent: "RECORD / REPEAT" },
];

const MUTATIONS = [
  { id: "chrome", name: "CHROME", desc: "+броня" },
  { id: "echo", name: "ECHO", desc: "повторяет первое действие" },
  { id: "nullborn", name: "NULLBORN", desc: "усиление рядом с VOID" },
  { id: "loaded", name: "LOADED", desc: "искажает кости" },
  { id: "feral", name: "FERAL", desc: "короткий таймер" },
  { id: "recursive", name: "RECURSIVE", desc: "одно возрождение" },
];


const TUTORIAL_STEPS = [
  {
    id: "map_welcome",
    screen: "map",
    target: ".floor-track",
    title: "Этаж — это цепочка решений",
    body: "Первый этаж содержит <strong>шесть узлов</strong> и служит обучающим маршрутом. Завершённые комнаты отмечаются слева направо. Начиная со второго этажа маршруты снова генерируются процедурно и предлагают несколько вариантов пути.",
    next: "map_inventory",
    button: "Продолжить",
  },
  {
    id: "map_inventory",
    screen: "map",
    target: "#inventoryButton",
    title: "Инвентарь и состояние забега",
    body: "Инвентарь хранит реликвии, улучшения способностей и все ресурсы текущего забега. Он доступен в любой момент через кнопку <strong>▣</strong> в верхней панели.",
    hint: "Откройте инвентарь кнопкой ▣.",
    completeOn: { name: "inventory_opened" },
    next: "inventory_details",
  },
  {
    id: "inventory_details",
    screen: "map",
    target: "#inventoryModal .inventory-identity",
    title: "Что сохраняется между комнатами",
    body: "<strong>HP, NULL ENERGY, кредиты, HEAT, реликвии и уровни навыков</strong> переходят в следующую комнату. ARMOR держится, пока не поглотит урон. Реликвии меняют правила забега, а улучшенные способности получают +20% к числовым эффектам за уровень.",
    next: "map_room",
    button: "Закрыть инвентарь",
    onNext: "closeInventory",
  },
  {
    id: "map_room",
    screen: "map",
    target: '.room-card[data-room-type="combat"]',
    title: "Обычная стычка",
    body: "В боевых узлах противники действуют по таймерам. На первом этаже встречаются простые пачки; выше появятся дальники, ближники, маги, саппорты и их совместные меты.",
    hint: "Войдите в ОБЫЧНУЮ СТЫЧКУ.",
    completeOn: { name: "room_entered", type: "combat", stage: 0 },
    next: "combat_character",
  },
  {
    id: "combat_character",
    screen: "combat",
    target: ".player-panel",
    title: "Ваш персонаж",
    body: "Слева показаны HP, броня, энергия и <strong>уникальная пассивная способность</strong> выбранного героя. Каждый из шести персонажей по-разному использует поле: через линии, защиту, заражения, кости, историю ходов или саму VOID.",
    next: "combat_enemy",
    button: "Далее",
  },
  {
    id: "combat_enemy",
    screen: "combat",
    target: ".enemies-panel",
    title: "Намерения противников",
    body: "Каждая карточка показывает здоровье, броню, состояния и намерение. Число справа — сколько обычных сдвигов осталось до действия врага. Клик по карточке выбирает цель для точечных атак.",
    next: "combat_cycle",
    button: "Далее",
  },
  {
    id: "combat_cycle",
    screen: "combat",
    target: ".combat-status-line",
    title: "Кости и цикл из шести сдвигов",
    body: "Две кости задают протоколы комбинаций. После шести обычных сдвигов начинается новый цикл: кости перебрасываются, кулдауны уменьшаются, а периодические эффекты срабатывают. Ручной REROLL стоит 1 NULL и повышает HEAT.",
    next: "combat_move",
    button: "Перейти к полю",
  },
  {
    id: "combat_move",
    screen: "combat",
    target: ".puzzle-grid",
    title: "Основное действие — сдвиг плитки",
    body: "Двигать можно только подсвеченную плитку рядом с VOID. Каждый сдвиг даёт NULL ENERGY и обычно уменьшает таймеры врагов. Правильно поставленная плитка также повышает ORDER.",
    hint: "Сдвиньте любую доступную плитку кликом, WASD или стрелками.",
    completeOn: { name: "tile_moved" },
    next: "combat_after_move",
  },
  {
    id: "combat_after_move",
    screen: "combat",
    target: ".move-counter",
    title: "Один ход изменил весь бой",
    body: "Счётчик цикла увеличился, а таймер противника уменьшился. Поэтому бессмысленные движения опасны. Полностью собранные пятнашки запускают <strong>ZERO STATE</strong>: массовый урон, лечение, очищение и новое решаемое поле.",
    next: "combat_ability",
    button: "Изучить способности",
  },
  {
    id: "combat_ability",
    screen: "combat",
    target: ".ability-stack",
    title: "Способности героя",
    body: "Способности тратят NULL ENERGY, но сами по себе не продвигают вражеские таймеры. После использования они уходят на кулдаун в циклах. Ультимейт — пятая способность — дорогой инструмент для перелома боя.",
    hint: "Активируйте любую доступную способность кнопкой или клавишей 1–5.",
    completeOn: { name: "ability_used" },
    next: "combat_combo_intro",
  },
  {
    id: "combat_combo_intro",
    screen: "combat",
    target: ".combo-panel",
    title: "192 боевые комбинации",
    body: "Комбинация состоит из трёх модулей: <strong>шаблон поля × эффект × протокол костей</strong>. 8 шаблонов, 8 эффектов и 3 протокола образуют 192 варианта атак, защиты, лечения и контроля. Для примера система уже подобрала готовую атакующую комбинацию.",
    next: "combat_combo_activate",
    button: "Активировать пример",
    onEnter: "prepareCombo",
  },
  {
    id: "combat_combo_activate",
    screen: "combat",
    target: "#activateComboButton",
    title: "Готовая комбинация",
    body: "Строка результата сообщает название, силу и использованные плитки. Активация стоит 2 NULL. Одна и та же комбинация может сработать только один раз за цикл, но после переброса цикла снова станет доступной.",
    hint: "Нажмите ACTIVATE −2 или клавишу Space.",
    completeOn: { name: "combo_activated" },
    next: "combat_log",
  },
  {
    id: "combat_log",
    screen: "combat",
    target: ".log-panel",
    title: "Журнал фиксирует причинно-следственные связи",
    body: "Здесь отображаются урон, броня, очистка, срабатывания пассивов и действия врагов. Когда сборка станет сложнее, журнал поможет понять, почему комбинация усилилась или была заблокирована.",
    next: "combat_finish",
    button: "Завершить бой",
  },
  {
    id: "combat_finish",
    screen: "combat",
    target: ".combat-grid",
    title: "Закончите первую стычку",
    body: "Теперь объединяйте сдвиги, способности и комбинации самостоятельно. Следите за таймером врага и поддерживайте броню. Учебная цель ослаблена, чтобы вы могли безопасно закрепить механику.",
    hint: "Уничтожьте противника.",
    completeOn: { name: "combat_completed", roomType: "combat", stage: 0 },
    next: "reward_first",
    onEnter: "softenEnemy",
    freePlay: true,
    wide: true,
  },
  {
    id: "reward_first",
    screen: "reward",
    target: ".reward-grid",
    title: "Награда формирует сборку",
    body: "После боя кредиты начисляются автоматически, а из трёх дополнительных наград можно выбрать одну. Ядро, лечение, броня, реликвия или улучшение способности сохраняются в инвентаре до конца забега.",
    hint: "Выберите одну награду.",
    completeOn: { name: "reward_chosen", stage: 0 },
    next: "map_upgrade",
  },
  {
    id: "map_upgrade",
    screen: "map",
    target: '.room-card[data-room-type="upgrade"]',
    title: "Небоевые узлы",
    body: "Не каждая локация является стычкой. Торговцы, кузницы, сокровища, аномалии, ремонтные станции, святилища костей, эхо памяти и короткие пути меняют сборку и уровень риска.",
    hint: "Войдите в NULL FORGE.",
    completeOn: { name: "room_entered", type: "upgrade", stage: 1 },
    next: "upgrade_choice",
  },
  {
    id: "upgrade_choice",
    screen: "event",
    target: ".choice-grid",
    title: "Улучшение способности",
    body: "Кузница повышает уровень одного навыка. Каждый уровень усиливает числовые параметры способности примерно на 20%. Уровни видны в инвентаре и сохраняются до завершения забега.",
    hint: "Выберите любую способность для улучшения.",
    completeOn: { name: "event_action", actionPrefix: "upgrade:" },
    next: "map_second_combat",
  },
  {
    id: "map_second_combat",
    screen: "map",
    target: '.room-card[data-room-type="combat"]',
    title: "Практическая стычка",
    body: "Во второй стычке подсказки не будут останавливать вас после каждого действия. Попробуйте самостоятельно выбрать цель, оценить таймер, собрать комбинацию и использовать улучшенную способность.",
    hint: "Войдите во вторую ОБЫЧНУЮ СТЫЧКУ.",
    completeOn: { name: "room_entered", type: "combat", stage: 2 },
    next: "combat_practice",
  },
  {
    id: "combat_practice",
    screen: "combat",
    target: ".combat-grid",
    title: "Свободная практика",
    body: "Помните: сдвиг двигает время, способности — нет, а комбинации зависят от геометрии поля и костей. При необходимости REROLL изменит кости за энергию и HEAT.",
    hint: "Победите вторую пачку любым способом. Доступны поле, способности, комбинации, REROLL и выбор цели.",
    completeOn: { name: "combat_completed", roomType: "combat", stage: 2 },
    next: "reward_second",
    onEnter: "practiceAid",
    freePlay: true,
  },
  {
    id: "reward_second",
    screen: "reward",
    target: ".reward-grid",
    title: "Сравнивайте награду со сборкой",
    body: "Не существует универсально лучшей награды. Атакующий герой может предпочесть энергию, защитный — максимальное HP, а сборка вокруг комбинаций — реликвию или усиление конкретной способности.",
    hint: "Выберите награду и продолжите маршрут.",
    completeOn: { name: "reward_chosen", stage: 2 },
    next: "map_merchant",
  },
  {
    id: "map_merchant",
    screen: "map",
    target: '.room-card[data-room-type="merchant"]',
    title: "BLACK MARKET",
    body: "Кредиты не дают силу сами по себе — их нужно превратить в лечение, ёмкость энергии или реликвии. Ассортимент торговца меняется от забега к забегу.",
    hint: "Войдите к торговцу.",
    completeOn: { name: "room_entered", type: "merchant", stage: 3 },
    next: "merchant_intro",
  },
  {
    id: "merchant_intro",
    screen: "event",
    target: ".shop-grid",
    title: "Покупки попадают в инвентарь",
    body: "Стоимость указана в кредитах. Купленные реликвии и ядра действуют сразу; лечение восстанавливает текущий HP. В обучении сначала совершите одну доступную покупку.",
    hint: "Купите FIELD PATCH или другой доступный предмет.",
    completeOn: { name: "event_action", actionPrefix: "buy:" },
    next: "merchant_leave",
  },
  {
    id: "merchant_leave",
    screen: "event",
    target: '[data-event-action="leave"]',
    title: "Узел можно покинуть",
    body: "У торговца разрешено несколько покупок, пока хватает кредитов. Когда подготовка завершена, выход фиксирует комнату и возвращает вас на карту.",
    hint: "Покиньте рынок.",
    completeOn: { name: "event_action", action: "leave" },
    next: "map_treasure",
  },
  {
    id: "map_treasure",
    screen: "map",
    target: '.room-card[data-room-type="treasure"]',
    title: "Рискованные события",
    body: "События предлагают обмен: безопасность против силы. HEAT повышает сложность будущих пачек, но некоторые реликвии и награды становятся выгоднее при высоком HEAT.",
    hint: "Откройте FORGOTTEN CACHE.",
    completeOn: { name: "room_entered", type: "treasure", stage: 4 },
    next: "treasure_choice",
  },
  {
    id: "treasure_choice",
    screen: "event",
    target: ".choice-grid",
    title: "Выбор без идеального ответа",
    body: "Белый контейнер безопасен, чёрный выдаёт реликвию ценой HEAT, а VOID расширяет запас энергии ценой HP. Такие решения определяют характер текущего забега.",
    hint: "Выберите любой контейнер.",
    completeOn: { name: "event_action", actionPrefix: "treasure:" },
    next: "map_elite",
  },
  {
    id: "map_elite",
    screen: "map",
    target: '.room-card[data-room-type="elite"]',
    title: "Финал этажа — элитная стычка",
    body: "Элитные пачки содержат больше противников, дополнительную броню и мутации. Награды за них лучше, но ошибки в управлении таймерами наказываются сильнее.",
    hint: "Войдите в ELITE//HUNT.",
    completeOn: { name: "room_entered", type: "elite", stage: 5 },
    next: "elite_intro",
  },
  {
    id: "elite_intro",
    screen: "combat",
    target: ".enemies-panel",
    title: "Пачки и мутации",
    body: "У элиты могут появиться CHROME, ECHO, NULLBORN, LOADED, FERAL или RECURSIVE. Сначала определите приоритетную цель: саппортов и магов часто выгодно уничтожать раньше фронтовиков.",
    next: "elite_finish",
    button: "Начать элитный бой",
  },
  {
    id: "elite_finish",
    screen: "combat",
    target: ".combat-grid",
    title: "Финальная проверка",
    body: "Используйте всё изученное: выбор цели, броню, способности, кости и комбо-конструктор. После этой победы первый этаж и обучение будут завершены.",
    hint: "Победите элитную пачку.",
    completeOn: { name: "combat_completed", roomType: "elite", stage: 5 },
    next: "reward_elite",
    onEnter: "eliteAid",
    freePlay: true,
    wide: true,
  },
  {
    id: "reward_elite",
    screen: "reward",
    target: ".reward-grid",
    title: "Последняя награда обучения",
    body: "Элитные награды чаще содержат реликвии. Выбранный предмет останется в инвентаре и поможет на следующем, уже процедурном этаже.",
    hint: "Выберите финальную награду.",
    completeOn: { name: "reward_chosen", stage: 5 },
    next: "floor_complete",
  },
  {
    id: "floor_complete",
    screen: "floorComplete",
    target: "#nextFloorButton",
    title: "Обучение завершено",
    body: "Вы прошли полный цикл: карта → бой → награда → развитие сборки. Со второго этажа появятся развилки и более сложные пачки. Каждый третий этаж заканчивается уникальным боссом.",
    hint: "Нажмите «Следующий этаж», чтобы перейти к обычному roguelike-забегу.",
    completeOn: { name: "next_floor" },
    next: null,
    completeBadge: true,
  },
];

const TUTORIAL_BY_ID = Object.fromEntries(TUTORIAL_STEPS.map((step) => [step.id, step]));

const Game = {
  state: {
    screen: "title",
    selectedHero: HEROES[0].id,
    seedDraft: "",
    rngState: hashSeed("NULL"),
    run: null,
    combat: null,
    currentRoom: null,
    rewards: null,
    settings: {
      sound: true,
    },
  },

  init() {
    this.loadSettings();
    this.cacheDom();
    this.bindGlobalEvents();
    this.state.seedDraft = this.makeSeed();
    $("#buildLabel").textContent = `BUILD ${BUILD} // VANILLA`;
    this.render();
  },

  cacheDom() {
    this.screenEl = $("#screen");
    this.modalRoot = $("#modalRoot");
    this.toastRoot = $("#toastRoot");
    this.runHud = $("#runHud");
    this.menuButton = $("#menuButton");
    this.soundButton = $("#soundButton");
    this.inventoryButton = $("#inventoryButton");
    this.tutorialRoot = $("#tutorialRoot");
  },

  bindGlobalEvents() {
    $("#brandButton").addEventListener("click", () => this.handleBrandClick());
    $("#helpButton").addEventListener("click", () => this.openCodex());
    this.soundButton.addEventListener("click", () => this.toggleSound());
    this.inventoryButton.addEventListener("click", () => this.openInventory());
    this.menuButton.addEventListener("click", () => this.openPauseMenu());
    document.addEventListener("keydown", (event) => this.handleKeydown(event));
    window.addEventListener("resize", () => this.scheduleTutorial());
    window.addEventListener("scroll", () => this.scheduleTutorial(), true);
    this.tutorialObserver = new MutationObserver(() => this.scheduleTutorial());
    this.tutorialObserver.observe(this.screenEl, { childList: true, subtree: true });
    this.tutorialObserver.observe(this.modalRoot, { childList: true, subtree: true });
  },

  handleBrandClick() {
    if (!this.state.run) {
      this.goToTitle();
      return;
    }
    this.openPauseMenu();
  },

  makeSeed() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    const stamp = Date.now() ^ Math.floor(performance.now() * 1000);
    let value = stamp >>> 0;
    for (let index = 0; index < 8; index += 1) {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      result += alphabet[Math.abs(value) % alphabet.length];
    }
    return result;
  },

  random() {
    let value = this.state.rngState >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state.rngState = value >>> 0 || 0x9e3779b9;
    return (this.state.rngState >>> 0) / 4294967296;
  },

  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  },

  pick(items) {
    if (!items.length) return undefined;
    return items[Math.floor(this.random() * items.length)];
  },

  shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(this.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  },

  weightedPick(weightMap) {
    const entries = Object.entries(weightMap).filter(([, weight]) => weight > 0);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.random() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries.at(-1)?.[0];
  },

  hero() {
    return HEROES.find((hero) => hero.id === this.state.run?.heroId) || HEROES[0];
  },

  hasRelic(id) {
    return Boolean(this.state.run?.relics?.includes(id));
  },

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved && typeof saved.sound === "boolean") this.state.settings.sound = saved.sound;
    } catch {
      this.state.settings.sound = true;
    }
  },

  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.state.settings));
    } catch {
      // Settings are optional in privacy-restricted or sandboxed browser contexts.
    }
  },

  toggleSound() {
    this.state.settings.sound = !this.state.settings.sound;
    this.saveSettings();
    this.updateSoundButton();
    if (this.state.settings.sound) this.beep(520, 0.04, "sine", 0.025);
  },

  updateSoundButton() {
    this.soundButton.textContent = this.state.settings.sound ? "◉" : "○";
    this.soundButton.title = this.state.settings.sound ? "Выключить звук" : "Включить звук";
  },

  beep(frequency = 440, duration = 0.05, type = "sine", volume = 0.02) {
    if (!this.state.settings.sound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext ||= new AudioContextClass();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch {
      // Sound is optional; browsers may block AudioContext until direct interaction.
    }
  },

  saveGame() {
    if (!this.state.run) return;
    const payload = {
      version: BUILD,
      savedAt: Date.now(),
      screen: this.state.screen,
      rngState: this.state.rngState,
      run: this.state.run,
      combat: this.state.combat,
      currentRoom: this.state.currentRoom,
      rewards: this.state.rewards,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      this.toast("Не удалось записать сохранение.", "error");
    }
  },

  hasSave() {
    try {
      const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Boolean(payload?.run?.heroId);
    } catch {
      return false;
    }
  },

  loadGame() {
    try {
      const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!payload?.run?.heroId) throw new Error("Пустое сохранение");
      this.state.run = payload.run;
      this.state.combat = payload.combat || null;
      this.state.currentRoom = payload.currentRoom || null;
      this.state.rewards = payload.rewards || null;
      this.state.rngState = payload.rngState || hashSeed(payload.run.seed);
      this.state.screen = payload.screen || "map";
      if (this.state.screen === "title" || this.state.screen === "select") this.state.screen = "map";
      this.ensureLoadedState();
      this.closeModal();
      this.render();
      this.toast("Забег восстановлен.", "success");
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      this.toast("Сохранение повреждено и было удалено.", "error");
      this.goToTitle();
    }
  },

  ensureLoadedState() {
    const run = this.state.run;
    run.relics ||= [];
    run.abilityLevels ||= {};
    run.path ||= [];
    run.stages ||= this.generateFloorStages(run.floor, run.roomCount || 6);
    run.nextCombatMods ||= [];
    run.luck ||= 0;
    run.score ||= 0;
    run.kills ||= 0;
    run.bossesDefeated ||= 0;
    run.comboCount ||= 0;
    run.totalMoves ||= 0;
    run.maxEnergy ||= this.hero().energy;
    run.energy = clamp(run.energy ?? Math.ceil(run.maxEnergy / 2), 0, run.maxEnergy);
    run.armor ||= 0;
    run.order ||= 0;
    run.heat ||= 0;
    run.credits ||= 0;
    run.tutorial ||= {
      enabled: run.floor === 1,
      completed: run.floor > 1,
      step: run.floor === 1 ? "map_welcome" : null,
      enteredStep: null,
      recoveries: 0,
    };
    run.tutorial.recoveries ||= 0;
    if (run.floor > 1 && run.tutorial.enabled) {
      run.tutorial.enabled = false;
      run.tutorial.completed = true;
      run.tutorial.step = null;
    }
  },

  clearSave() {
    localStorage.removeItem(STORAGE_KEY);
  },

  goToTitle() {
    this.closeModal();
    this.state.screen = "title";
    this.state.combat = null;
    this.state.currentRoom = null;
    this.state.rewards = null;
    this.state.run = null;
    this.render();
  },

  render() {
    this.updateSoundButton();
    this.updateChrome();
    const renderers = {
      title: () => this.renderTitle(),
      select: () => this.renderCharacterSelect(),
      map: () => this.renderMap(),
      combat: () => this.renderCombat(),
      event: () => this.renderEvent(),
      reward: () => this.renderReward(),
      floorComplete: () => this.renderFloorComplete(),
      gameover: () => this.renderGameOver(),
      victory: () => this.renderVictory(),
    };
    (renderers[this.state.screen] || renderers.title)();
    requestAnimationFrame(() => this.screenEl.focus({ preventScroll: true }));
  },

  updateChrome() {
    const hasRun = Boolean(this.state.run);
    this.menuButton.classList.toggle("is-hidden", !hasRun);
    this.inventoryButton.classList.toggle("is-hidden", !hasRun);
    this.runHud.classList.toggle("is-hidden", !hasRun);
    if (!hasRun) {
      this.runHud.innerHTML = "";
      return;
    }
    const run = this.state.run;
    this.runHud.innerHTML = `
      <span class="hud-item"><span class="hud-label">Этаж</span><span class="hud-value">${run.floor}</span></span>
      <span class="hud-item"><span class="hud-label">HP</span><span class="hud-value ${run.hp <= run.maxHp * 0.3 ? "danger" : ""}">${Math.ceil(run.hp)}/${run.maxHp}</span></span>
      <span class="hud-item"><span class="hud-label">NULL</span><span class="hud-value energy">${Math.floor(run.energy)}/${run.maxEnergy}</span></span>
      <span class="hud-item"><span class="hud-label">₡</span><span class="hud-value credit">${run.credits}</span></span>
      <span class="hud-item"><span class="hud-label">HEAT</span><span class="hud-value ${run.heat >= 60 ? "danger" : ""}">${run.heat}</span></span>
    `;
  },

  renderTitle() {
    const canContinue = this.hasSave();
    const matrix = [1, 2, 3, 4, 5, 7, 8, 12, 9, 6, 11, 15, 13, 10, 14, 0];
    this.screenEl.innerHTML = `
      <section class="title-screen">
        <div class="title-copy">
          <p class="eyebrow">DARK CYBERPUNK PUZZLE ROGUELIKE</p>
          <h1><span>NULL//15</span><span class="thin">INFINITE ROLL</span></h1>
          <p class="title-lede">Каждый сдвиг плитки двигает таймеры врагов. Собирайте боевые шаблоны, управляйте костями и доберитесь до ядра бесконечной башни.</p>
          <div class="title-actions">
            <button id="newRunButton" class="primary-button" type="button">Начать новый забег</button>
            <button id="continueButton" class="secondary-button" type="button" ${canContinue ? "" : "disabled"}>Продолжить</button>
            <button id="titleCodexButton" class="ghost-button" type="button">Открыть кодекс</button>
          </div>
          <div class="seed-control">
            <input id="seedInput" class="input" type="text" maxlength="24" value="${escapeHTML(this.state.seedDraft)}" aria-label="Seed забега">
            <button id="randomSeedButton" class="secondary-button" type="button">Новый seed</button>
          </div>
          <div class="title-stats" aria-label="Объём прототипа">
            <div class="title-stat"><strong>6</strong><span>персонажей</span></div>
            <div class="title-stat"><strong>36</strong><span>способностей</span></div>
            <div class="title-stat"><strong>192</strong><span>комбинации</span></div>
          </div>
        </div>
        <div class="title-matrix" aria-hidden="true">
          ${matrix.map((value) => value ? `<div class="title-tile">${value}</div>` : `<div class="title-tile void">Ø</div>`).join("")}
        </div>
      </section>
    `;

    $("#newRunButton", this.screenEl).addEventListener("click", () => {
      const seed = $("#seedInput", this.screenEl).value.trim() || this.makeSeed();
      this.state.seedDraft = seed.toUpperCase();
      this.state.selectedHero = HEROES[0].id;
      this.state.screen = "select";
      this.render();
      this.beep(420, 0.055, "square", 0.018);
    });
    $("#continueButton", this.screenEl).addEventListener("click", () => this.loadGame());
    $("#titleCodexButton", this.screenEl).addEventListener("click", () => this.openCodex());
    $("#randomSeedButton", this.screenEl).addEventListener("click", () => {
      this.state.seedDraft = this.makeSeed();
      $("#seedInput", this.screenEl).value = this.state.seedDraft;
      this.beep(680, 0.04, "sine", 0.018);
    });
    $("#seedInput", this.screenEl).addEventListener("input", (event) => {
      this.state.seedDraft = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      event.target.value = this.state.seedDraft;
    });
  },

  renderCharacterSelect() {
    const selected = HEROES.find((hero) => hero.id === this.state.selectedHero) || HEROES[0];
    this.screenEl.innerHTML = `
      <section class="select-screen">
        <div class="section-heading">
          <div>
            <p class="eyebrow">BOOT SEQUENCE // SELECT SHELL</p>
            <h2>Выберите носителя NULL</h2>
          </div>
          <p>У каждого героя шесть отличающихся способностей: одна пассивная, четыре боевых протокола и ультимейт. Умения улучшаются в ходе забега.</p>
        </div>
        <div class="character-grid">
          ${HEROES.map((hero) => this.characterCardHTML(hero, hero.id === selected.id)).join("")}
        </div>
        <div class="select-footer">
          <div>
            <span class="terminal-code">SEED ${escapeHTML(this.state.seedDraft)}</span>
            <strong id="selectedHeroLabel" style="display:block;margin-top:4px">${selected.name}</strong>
          </div>
          <div class="button-row">
            <button id="backToTitleButton" class="ghost-button" type="button">Назад</button>
            <button id="startRunButton" class="primary-button" type="button">Запустить забег</button>
          </div>
        </div>
      </section>
    `;

    $$(".character-card", this.screenEl).forEach((card) => {
      card.addEventListener("click", () => {
        this.state.selectedHero = card.dataset.heroId;
        this.renderCharacterSelect();
        this.beep(520, 0.035, "triangle", 0.015);
      });
    });
    $("#backToTitleButton", this.screenEl).addEventListener("click", () => {
      this.state.screen = "title";
      this.render();
    });
    $("#startRunButton", this.screenEl).addEventListener("click", () => this.startRun(this.state.selectedHero, this.state.seedDraft));
  },

  characterCardHTML(hero, selected) {
    const abilities = [hero.passive, ...hero.abilities];
    return `
      <button class="character-card ${selected ? "selected" : ""}" data-hero-id="${hero.id}" type="button" aria-pressed="${selected}">
        <span class="character-index">SHELL_${hero.index}</span>
        <span>
          <span class="character-name">${hero.name}</span>
          <span class="character-role">${hero.role}</span>
        </span>
        <span>
          <span class="character-desc">${hero.desc}</span>
          <ul class="ability-mini-list">
            ${abilities.map((ability, index) => `<li><strong>${index === 0 ? "P" : index}.</strong> ${ability.name}</li>`).join("")}
          </ul>
        </span>
        <span class="character-stats"><span>HP <strong>${hero.hp}</strong></span><span>NULL <strong>${hero.energy}</strong></span></span>
      </button>
    `;
  },

  startRun(heroId, seed) {
    const hero = HEROES.find((entry) => entry.id === heroId) || HEROES[0];
    const normalizedSeed = String(seed || this.makeSeed()).trim().toUpperCase();
    this.state.rngState = hashSeed(normalizedSeed);
    const roomCount = 6;
    this.state.run = {
      heroId: hero.id,
      seed: normalizedSeed,
      floor: 1,
      stage: 0,
      roomCount,
      stages: [],
      path: [],
      hp: hero.hp,
      maxHp: hero.hp,
      armor: 0,
      energy: Math.ceil(hero.energy / 2),
      maxEnergy: hero.energy,
      order: 0,
      heat: 0,
      credits: 35,
      luck: 0,
      relics: [],
      abilityLevels: {},
      nextCombatMods: [],
      score: 0,
      kills: 0,
      bossesDefeated: 0,
      comboCount: 0,
      totalMoves: 0,
      revived: false,
      infiniteUnlocked: false,
      tutorial: {
        enabled: true,
        completed: false,
        step: "map_welcome",
        enteredStep: null,
        recoveries: 0,
      },
    };
    this.state.run.stages = this.generateFloorStages(1, roomCount);
    this.state.currentRoom = null;
    this.state.combat = null;
    this.state.rewards = null;
    this.state.screen = "map";
    this.saveGame();
    this.render();
    this.toast(`${hero.name} подключён к башне.`, "success");
    this.beep(300, 0.08, "sawtooth", 0.015);
  },

  generateFloorStages(floor, roomCount) {
    if (floor === 1 && this.state.run?.tutorial?.enabled) {
      return [
        { options: ["combat"] },
        { options: ["upgrade"] },
        { options: ["combat"] },
        { options: ["merchant"] },
        { options: ["treasure"] },
        { options: ["elite"] },
      ];
    }
    const stages = [];
    for (let index = 0; index < roomCount; index += 1) {
      const isLast = index === roomCount - 1;
      if (isLast && floor % 3 === 0) {
        stages.push({ options: ["boss"] });
        continue;
      }
      const options = [];
      const optionCount = isLast ? 2 : 3;
      const weights = {
        combat: 38,
        elite: floor >= 2 ? 11 + floor : 3,
        merchant: 8,
        upgrade: 9,
        treasure: 8,
        anomaly: floor >= 2 ? 7 : 3,
        repair: 8,
        dice: 6,
        memory: floor >= 2 ? 5 : 2,
        shortcut: index < roomCount - 2 && floor >= 2 ? 4 : 0,
      };
      if (index === 0) {
        weights.combat += 15;
        weights.shortcut = 0;
      }
      if (isLast) {
        weights.combat += 20;
        weights.elite += 12;
        weights.merchant = 0;
        weights.repair = 0;
        weights.shortcut = 0;
      }
      let guard = 0;
      while (options.length < optionCount && guard < 60) {
        const type = this.weightedPick(weights);
        guard += 1;
        if (!type || options.includes(type)) continue;
        if (index === 0 && ["merchant", "repair", "shortcut"].includes(type)) continue;
        options.push(type);
      }
      if (!options.includes("combat") && this.random() < 0.45) options[options.length - 1] = "combat";
      stages.push({ options });
    }
    return stages;
  },

  renderMap() {
    const run = this.state.run;
    if (!run) return this.goToTitle();
    if (run.stage >= run.roomCount) {
      this.state.screen = "floorComplete";
      this.renderFloorComplete();
      return;
    }
    const stage = run.stages[run.stage] || { options: ["combat"] };
    const hero = this.hero();
    this.screenEl.innerHTML = `
      <section class="map-screen">
        <div class="section-heading">
          <div>
            <p class="eyebrow">FLOOR ${String(run.floor).padStart(2, "0")} // ${this.floorBiome(run.floor)}</p>
            <h2>Выберите следующую локацию</h2>
          </div>
          <p>Этаж становится длиннее каждые два уровня. На каждом третьем этаже путь заканчивается уникальным боссом.</p>
        </div>
        <div class="map-layout">
          <div class="panel">
            <div class="floor-track" data-tutorial-target="floor-track" aria-label="Прогресс этажа">
              ${this.floorTrackHTML(run)}
            </div>
            <div class="room-choices">
              ${stage.options.map((type) => this.roomCardHTML(type, run.floor)).join("")}
            </div>
          </div>
          <aside class="map-side">
            <div class="panel-flat hero-summary" data-tutorial-target="inventory-summary">
              <div class="hero-summary-head">
                <div>
                  <span class="character-role">${hero.role}</span>
                  <h3>${hero.name}</h3>
                </div>
                <div class="hero-glyph">${hero.glyph}</div>
              </div>
              <div class="stat-row"><span>HP</span><strong>${Math.ceil(run.hp)} / ${run.maxHp}</strong></div>
              <div class="stat-bar hp"><span style="--value:${pct(run.hp, run.maxHp)}"></span></div>
              <div class="stat-row"><span>NULL ENERGY</span><strong>${Math.floor(run.energy)} / ${run.maxEnergy}</strong></div>
              <div class="stat-bar energy"><span style="--value:${pct(run.energy, run.maxEnergy)}"></span></div>
              <div class="relic-tags">
                ${run.relics.length ? run.relics.map((id) => `<span class="tag">${RELICS.find((relic) => relic.id === id)?.name || id}</span>`).join("") : `<span class="tag">NO RELICS</span>`}
              </div>
            </div>
            <div class="run-list">
              <div class="run-list-item"><span>Пройдено комнат</span><strong>${run.path.length}</strong></div>
              <div class="run-list-item"><span>Уничтожено целей</span><strong>${run.kills}</strong></div>
              <div class="run-list-item"><span>Активировано комбо</span><strong>${run.comboCount}</strong></div>
              <div class="run-list-item"><span>Боссов побеждено</span><strong>${run.bossesDefeated}</strong></div>
              <div class="run-list-item"><span>Счёт</span><strong>${Math.floor(run.score)}</strong></div>
              <div class="run-list-item"><span>Seed</span><strong>${escapeHTML(run.seed)}</strong></div>
            </div>
            <button id="mapCodexButton" class="secondary-button" type="button">Комбо-кодекс: 192</button>
          </aside>
        </div>
      </section>
    `;

    $$(".room-card", this.screenEl).forEach((card) => {
      card.addEventListener("click", () => this.enterRoom(card.dataset.roomType));
    });
    $("#mapCodexButton", this.screenEl).addEventListener("click", () => this.openCodex("combos"));
  },

  floorBiome(floor) {
    if (floor <= 3) return "NEON OSSUARY";
    if (floor <= 6) return "BLACK CASINO";
    if (floor <= 9) return "NULL CATHEDRAL";
    if (floor <= 12) return "INFINITE SERVER";
    return "INFINITY LOOP";
  },

  floorTrackHTML(run) {
    const pieces = [];
    for (let index = 0; index < run.roomCount; index += 1) {
      const stateClass = index < run.stage ? "completed" : index === run.stage ? "current" : "";
      const pathType = run.path[index];
      const symbol = pathType ? ROOM_DEFS[pathType]?.symbol || "·" : index === run.roomCount - 1 && run.floor % 3 === 0 ? "Ω" : String(index + 1);
      pieces.push(`<span class="track-node ${stateClass}">${symbol}</span>`);
      if (index < run.roomCount - 1) pieces.push(`<span class="track-line ${index < run.stage ? "completed" : ""}"></span>`);
    }
    return pieces.join("");
  },

  roomCardHTML(type, floor) {
    const room = ROOM_DEFS[type] || ROOM_DEFS.combat;
    let detail = room.risk;
    if (type === "combat") detail = `${Math.min(4, 1 + Math.floor(floor / 3))}–${Math.min(5, 2 + Math.floor(floor / 3))} цели`;
    if (type === "elite") detail = `${Math.min(5, 2 + Math.floor(floor / 3))} усиленные цели`;
    if (type === "boss") detail = BOSSES[(Math.floor((floor - 1) / 3)) % BOSSES.length].name;
    return `
      <button class="room-card ${type}" data-room-type="${type}" data-symbol="${room.symbol}" type="button">
        <span class="room-symbol">${room.symbol}</span>
        <span><strong>${room.name}</strong><span class="room-risk" style="display:block;margin-top:4px">${detail}</span></span>
        <p>${room.desc}</p>
        <span class="terminal-code">ENTER NODE</span>
      </button>
    `;
  },
};

Object.assign(Game, {
  enterRoom(type) {
    if (!this.state.run || !ROOM_DEFS[type]) return;
    this.tutorialEvent("room_entered", { type, stage: this.state.run.stage });
    this.state.currentRoom = {
      type,
      stage: this.state.run.stage,
      data: {},
    };
    if (["combat", "elite", "boss"].includes(type)) {
      this.startCombat(type);
      return;
    }
    this.prepareEvent(type);
    this.state.screen = "event";
    this.saveGame();
    this.render();
    this.beep(360, 0.05, "triangle", 0.018);
  },

  prepareEvent(type) {
    const data = this.state.currentRoom.data;
    if (type === "merchant") {
      const relic = this.randomAvailableRelic();
      data.items = [
        { id: "heal", name: "FIELD PATCH", desc: "Восстановить 30% максимального HP.", cost: 25, purchased: false },
        { id: "core", name: "NULL CAPACITOR", desc: "+1 к максимуму NULL ENERGY и полная зарядка.", cost: 48, purchased: false },
        { id: "relic", name: relic?.name || "DATA CACHE", desc: relic?.desc || "Получить 45 кредитов.", cost: 72, relicId: relic?.id || null, purchased: false },
      ];
    }
    if (type === "upgrade") {
      data.abilities = this.shuffle(this.hero().abilities).slice(0, 3).map((ability) => ability.id);
    }
    if (type === "memory") {
      data.abilityId = this.pick(this.hero().abilities)?.id;
    }
  },

  randomAvailableRelic() {
    const available = RELICS.filter((relic) => !this.state.run.relics.includes(relic.id));
    return this.pick(available) || null;
  },

  renderEvent() {
    const room = this.state.currentRoom;
    if (!room) {
      this.state.screen = "map";
      this.render();
      return;
    }
    const def = ROOM_DEFS[room.type];
    const body = this.eventBodyHTML(room.type, room.data);
    this.screenEl.innerHTML = `
      <section class="event-screen">
        <div class="panel event-box">
          <div class="event-icon">${def.symbol}</div>
          <p class="eyebrow">${def.name}</p>
          <h2>${this.eventTitle(room.type)}</h2>
          <p class="event-copy">${this.eventDescription(room.type)}</p>
          ${body}
        </div>
      </section>
    `;
    $$('[data-event-action]', this.screenEl).forEach((button) => {
      button.addEventListener("click", () => this.handleEventAction(button.dataset.eventAction));
    });
  },

  eventTitle(type) {
    const titles = {
      merchant: "Рынок не задаёт вопросов",
      upgrade: "Кузница принимает фрагмент памяти",
      treasure: "Три контейнера всё ещё под напряжением",
      anomaly: "Матрица ведёт себя неправильно",
      repair: "Станция ремонта сохранила питание",
      dice: "Шесть граней смотрят в ответ",
      memory: "Архив воспроизводит ваш прошлый бой",
      shortcut: "Разрыв ведёт глубже, чем должен",
    };
    return titles[type] || "Неизвестный узел";
  },

  eventDescription(type) {
    const descriptions = {
      merchant: "Торговый демон принимает кредиты. Можно совершить несколько покупок, после чего покинуть узел.",
      upgrade: "Выберите один протокол. Его числовые эффекты увеличатся на 20% за каждый уровень.",
      treasure: "Белый контейнер безопасен. Чёрный содержит реликвию и нестабильность. VOID-контейнер меняет ядро героя.",
      anomaly: "Любое вмешательство даст преимущество, но башня запомнит изменение и ответит повышением HEAT.",
      repair: "Ремонтный модуль может восстановить корпус, охладить след или выполнить полную реконструкцию за кредиты.",
      dice: "Святилище позволяет купить контроль вероятности телом, теплом или ограниченной прошивкой граней.",
      memory: "Эхо предлагает усилить случайную способность, восстановить энергию или продать запись коллекционеру.",
      shortcut: "Переход пропустит одну комнату. Чем короче путь, тем заметнее вы становитесь для башни.",
    };
    return descriptions[type] || ROOM_DEFS[type]?.desc || "";
  },

  eventBodyHTML(type, data) {
    const run = this.state.run;
    if (type === "merchant") {
      return `
        <div class="shop-grid">
          ${data.items.map((item) => `
            <button class="shop-card" data-event-action="buy:${item.id}" type="button" ${item.purchased || run.credits < item.cost ? "disabled" : ""}>
              <span><span class="reward-rarity">BLACK MARKET</span><h3>${item.name}</h3></span>
              <p>${item.desc}</p>
              <span class="choice-cost">${item.purchased ? "КУПЛЕНО" : `${item.cost} ₡`}</span>
            </button>
          `).join("")}
        </div>
        <div class="button-row" style="margin-top:16px"><button class="secondary-button" data-event-action="leave" type="button" ${this.tutorialStepIs("merchant_intro") ? "disabled" : ""}>Покинуть рынок</button></div>
      `;
    }

    if (type === "upgrade") {
      return `<div class="choice-grid">${data.abilities.map((id) => {
        const ability = this.hero().abilities.find((entry) => entry.id === id);
        const level = run.abilityLevels[id] || 0;
        return `
          <button class="choice-card" data-event-action="upgrade:${id}" type="button">
            <span><span class="reward-rarity">LEVEL ${level} → ${level + 1}</span><h3>${ability.name}</h3></span>
            <p>${ability.desc}</p>
            <span class="choice-cost">Бесплатно</span>
          </button>
        `;
      }).join("")}</div>`;
    }

    if (type === "treasure") {
      return `
        <div class="choice-grid">
          <button class="choice-card" data-event-action="treasure:safe" type="button"><span><span class="reward-rarity">WHITE CACHE</span><h3>Стабильные кредиты</h3></span><p>Получить 38–55 кредитов без побочного эффекта.</p><span class="choice-cost">Безопасно</span></button>
          <button class="choice-card" data-event-action="treasure:cursed" type="button"><span><span class="reward-rarity">BLACK CACHE</span><h3>Проклятая реликвия</h3></span><p>Получить случайную реликвию и добавить 14 HEAT.</p><span class="choice-cost">+14 HEAT</span></button>
          <button class="choice-card" data-event-action="treasure:void" type="button"><span><span class="reward-rarity">VOID CACHE</span><h3>Расширить ядро</h3></span><p>Максимум энергии +1, но герой теряет 12 текущего HP.</p><span class="choice-cost">−12 HP</span></button>
        </div>
      `;
    }

    if (type === "anomaly") {
      return `
        <div class="choice-grid">
          <button class="choice-card" data-event-action="anomaly:overcharge" type="button"><span><span class="reward-rarity">OVERCHARGE</span><h3>Полная энергия</h3></span><p>Следующий бой начинается с полной энергией и 14 ARMOR.</p><span class="choice-cost">+8 HEAT</span></button>
          <button class="choice-card" data-event-action="anomaly:corrupt" type="button"><span><span class="reward-rarity">GLITCH PAYOUT</span><h3>Продать стабильность</h3></span><p>Получить 60 кредитов; три плитки следующего поля будут заражены.</p><span class="choice-cost">Искажённое поле</span></button>
          <button class="choice-card" data-event-action="anomaly:mirror" type="button"><span><span class="reward-rarity">MIRROR LUCK</span><h3>Скопировать шанс</h3></span><p>Получить 2 LUCK и снизить максимальный HP на 4.</p><span class="choice-cost">−4 MAX HP</span></button>
        </div>
      `;
    }

    if (type === "repair") {
      const fullCost = 34;
      return `
        <div class="choice-grid">
          <button class="choice-card" data-event-action="repair:heal" type="button"><span><span class="reward-rarity">PATCH</span><h3>Локальный ремонт</h3></span><p>Восстановить 30% максимального HP.</p><span class="choice-cost">Бесплатно</span></button>
          <button class="choice-card" data-event-action="repair:cool" type="button"><span><span class="reward-rarity">COOLANT</span><h3>Сбросить след</h3></span><p>Уменьшить HEAT на 18 и получить 6 ARMOR.</p><span class="choice-cost">Бесплатно</span></button>
          <button class="choice-card" data-event-action="repair:full" type="button" ${run.credits < fullCost ? "disabled" : ""}><span><span class="reward-rarity">RECONSTRUCT</span><h3>Полная реконструкция</h3></span><p>Полностью восстановить HP и NULL ENERGY.</p><span class="choice-cost">${fullCost} ₡</span></button>
        </div>
      `;
    }

    if (type === "dice") {
      return `
        <div class="choice-grid">
          <button class="choice-card" data-event-action="dice:luck" type="button"><span><span class="reward-rarity">BLOOD BET</span><h3>Купить удачу</h3></span><p>Получить 2 LUCK. Герой теряет 9 текущего HP.</p><span class="choice-cost">−9 HP</span></button>
          <button class="choice-card" data-event-action="dice:energy" type="button"><span><span class="reward-rarity">CAPACITOR ROLL</span><h3>Седьмая грань</h3></span><p>Максимум NULL ENERGY +1 и 8 HEAT.</p><span class="choice-cost">+8 HEAT</span></button>
          <button class="choice-card" data-event-action="dice:bias" type="button"><span><span class="reward-rarity">FACE PATCH</span><h3>Сдвиг граней</h3></span><p>Все грани плиток циклически смещаются на единицу до конца забега.</p><span class="choice-cost">Постоянно</span></button>
        </div>
      `;
    }

    if (type === "memory") {
      const ability = this.hero().abilities.find((entry) => entry.id === data.abilityId);
      return `
        <div class="choice-grid">
          <button class="choice-card" data-event-action="memory:upgrade" type="button"><span><span class="reward-rarity">COMBAT ECHO</span><h3>${ability?.name || "UNKNOWN"}</h3></span><p>Улучшить выбранную архивом способность на один уровень.</p><span class="choice-cost">Записать</span></button>
          <button class="choice-card" data-event-action="memory:energy" type="button"><span><span class="reward-rarity">CLEAN SNAPSHOT</span><h3>Восстановить состояние</h3></span><p>Полностью восстановить энергию и 15% HP.</p><span class="choice-cost">Применить</span></button>
          <button class="choice-card" data-event-action="memory:sell" type="button"><span><span class="reward-rarity">DATA BROKER</span><h3>Продать запись</h3></span><p>Получить 48 кредитов и 100 очков.</p><span class="choice-cost">Стереть</span></button>
        </div>
      `;
    }

    if (type === "shortcut") {
      return `
        <div class="choice-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <button class="choice-card" data-event-action="shortcut:take" type="button"><span><span class="reward-rarity">VOID ROUTE</span><h3>Войти в разрыв</h3></span><p>Пропустить следующую локацию, получить 25 кредитов и 15 HEAT.</p><span class="choice-cost">Пропуск +1</span></button>
          <button class="choice-card" data-event-action="shortcut:leave" type="button"><span><span class="reward-rarity">SAFE ROUTE</span><h3>Закрыть разрыв</h3></span><p>Получить 8 ARMOR и продолжить обычным путём.</p><span class="choice-cost">Без пропуска</span></button>
        </div>
      `;
    }

    return `<button class="primary-button" data-event-action="leave" type="button">Продолжить</button>`;
  },

  handleEventAction(action) {
    const [group, option] = action.split(":");
    this.tutorialEvent("event_action", { action, group, option, roomType: this.state.currentRoom?.type, stage: this.state.run?.stage });
    const run = this.state.run;
    const room = this.state.currentRoom;

    if (group === "buy") {
      const item = room.data.items.find((entry) => entry.id === option);
      if (!item || item.purchased || run.credits < item.cost) return;
      run.credits -= item.cost;
      item.purchased = true;
      if (option === "heal") this.healPlayer(Math.ceil(run.maxHp * 0.3), false);
      if (option === "core") {
        run.maxEnergy += 1;
        run.energy = run.maxEnergy;
      }
      if (option === "relic") {
        if (item.relicId) this.addRelic(item.relicId);
        else run.credits += 45;
      }
      this.toast(`${item.name}: покупка завершена.`, "success");
      this.beep(760, 0.05, "sine", 0.02);
      this.saveGame();
      this.renderEvent();
      return;
    }

    if (group === "leave") {
      this.finishRoom();
      return;
    }

    if (group === "upgrade") {
      run.abilityLevels[option] = (run.abilityLevels[option] || 0) + 1;
      const ability = this.hero().abilities.find((entry) => entry.id === option);
      this.toast(`${ability?.name || "Протокол"} улучшен.`, "success");
      this.finishRoom();
      return;
    }

    if (group === "treasure") {
      if (option === "safe") run.credits += this.randomInt(38, 55);
      if (option === "cursed") {
        const relic = this.randomAvailableRelic();
        if (relic) this.addRelic(relic.id);
        else run.credits += 70;
        run.heat += 14;
      }
      if (option === "void") {
        run.maxEnergy += 1;
        run.energy = Math.min(run.maxEnergy, run.energy + 1);
        this.damagePlayer(12, "VOID CACHE", null, { bypassArmor: true, allowDeath: false });
      }
      this.finishRoom();
      return;
    }

    if (group === "anomaly") {
      if (option === "overcharge") {
        run.nextCombatMods.push("overcharge");
        run.heat += 8;
      }
      if (option === "corrupt") {
        run.nextCombatMods.push("corruptedBoard");
        run.credits += 60;
      }
      if (option === "mirror") {
        run.luck += 2;
        run.maxHp = Math.max(30, run.maxHp - 4);
        run.hp = Math.min(run.hp, run.maxHp);
      }
      this.finishRoom();
      return;
    }

    if (group === "repair") {
      if (option === "heal") this.healPlayer(Math.ceil(run.maxHp * 0.3), false);
      if (option === "cool") {
        run.heat = Math.max(0, run.heat - 18);
        run.armor += 6;
      }
      if (option === "full" && run.credits >= 34) {
        run.credits -= 34;
        run.hp = run.maxHp;
        run.energy = run.maxEnergy;
      }
      this.finishRoom();
      return;
    }

    if (group === "dice") {
      if (option === "luck") {
        run.luck += 2;
        this.damagePlayer(9, "BLOOD BET", null, { bypassArmor: true, allowDeath: false });
      }
      if (option === "energy") {
        run.maxEnergy += 1;
        run.energy += 1;
        run.heat += 8;
      }
      if (option === "bias") run.diceBias = ((run.diceBias || 0) + 1) % 6;
      this.finishRoom();
      return;
    }

    if (group === "memory") {
      if (option === "upgrade") {
        const id = room.data.abilityId;
        run.abilityLevels[id] = (run.abilityLevels[id] || 0) + 1;
      }
      if (option === "energy") {
        run.energy = run.maxEnergy;
        this.healPlayer(Math.ceil(run.maxHp * 0.15), false);
      }
      if (option === "sell") {
        run.credits += 48;
        run.score += 100;
      }
      this.finishRoom();
      return;
    }

    if (group === "shortcut") {
      if (option === "take") {
        run.credits += 25;
        run.heat += 15;
        this.finishRoom(1);
      } else {
        run.armor += 8;
        this.finishRoom();
      }
    }
  },

  addRelic(id) {
    if (!id || this.state.run.relics.includes(id)) return false;
    this.state.run.relics.push(id);
    const relic = RELICS.find((entry) => entry.id === id);
    this.toast(`Реликвия: ${relic?.name || id}`, "success");
    return true;
  },

  finishRoom(skip = 0) {
    const run = this.state.run;
    const type = this.state.currentRoom?.type || "combat";
    const start = run.stage;
    run.path[start] = type;
    for (let offset = 1; offset <= skip; offset += 1) run.path[start + offset] = "shortcut";
    run.stage = Math.min(run.roomCount, run.stage + 1 + skip);
    run.score += 30 + run.floor * 8 + (type === "elite" ? 70 : type === "boss" ? 250 : 0);
    this.state.currentRoom = null;
    this.state.combat = null;
    this.state.rewards = null;
    this.state.screen = run.stage >= run.roomCount ? "floorComplete" : "map";
    this.saveGame();
    this.render();
  },

  renderFloorComplete() {
    const run = this.state.run;
    const actComplete = run.floor === 9 && run.bossesDefeated >= 3 && !run.infiniteUnlocked;
    this.screenEl.innerHTML = `
      <section class="event-screen">
        <div class="panel event-box floor-complete">
          <div class="event-icon">${actComplete ? "∞" : "↑"}</div>
          <p class="eyebrow">${actComplete ? "THE LOOP IS OPEN" : `FLOOR ${String(run.floor).padStart(2, "0")} CLEARED`}</p>
          <h2>${actComplete ? "Три ядра уничтожены" : "Лифт уходит глубже"}</h2>
          <p class="event-copy" style="margin-inline:auto">${actComplete ? "Основной цикл прототипа завершён. Теперь боссы будут повторяться с повышенной силой, двойными мутациями и более длинными этажами." : "Часть повреждений устранена, энергия стабилизирована, а HEAT немного снижен. Следующий этаж длиннее и опаснее."}</p>
          <div class="run-list" style="max-width:520px;margin:0 auto 20px;text-align:left">
            <div class="run-list-item"><span>Счёт</span><strong>${Math.floor(run.score)}</strong></div>
            <div class="run-list-item"><span>Уничтожено целей</span><strong>${run.kills}</strong></div>
            <div class="run-list-item"><span>Комбинации</span><strong>${run.comboCount}</strong></div>
            <div class="run-list-item"><span>HEAT</span><strong>${run.heat}</strong></div>
          </div>
          <div class="button-row" style="justify-content:center">
            ${actComplete ? `<button id="victoryButton" class="secondary-button" type="button">Зафиксировать победу</button>` : ""}
            <button id="nextFloorButton" class="primary-button" type="button">${actComplete ? "Продолжить в бесконечность" : "Следующий этаж"}</button>
          </div>
        </div>
      </section>
    `;
    $("#nextFloorButton", this.screenEl).addEventListener("click", () => {
      if (actComplete) run.infiniteUnlocked = true;
      this.nextFloor();
    });
    $("#victoryButton", this.screenEl)?.addEventListener("click", () => {
      this.state.screen = "victory";
      this.saveGame();
      this.render();
    });
  },

  nextFloor() {
    const run = this.state.run;
    this.tutorialEvent("next_floor", { floor: run.floor });
    run.floor += 1;
    run.stage = 0;
    run.roomCount = Math.min(13, 6 + Math.floor((run.floor - 1) / 2));
    run.stages = this.generateFloorStages(run.floor, run.roomCount);
    run.path = [];
    run.armor = 0;
    run.heat = Math.max(0, run.heat - 5);
    run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * 0.12));
    run.energy = Math.max(run.energy, Math.ceil(run.maxEnergy * 0.5));
    this.state.screen = "map";
    this.saveGame();
    this.render();
    this.beep(250, 0.08, "sawtooth", 0.015);
  },

  renderVictory() {
    const run = this.state.run;
    this.screenEl.innerHTML = `
      <section class="end-screen">
        <div class="panel end-box floor-complete">
          <div class="event-icon">∞</div>
          <p class="eyebrow">RUN COMPLETE // ${escapeHTML(run.seed)}</p>
          <h2>NULL не равен нулю</h2>
          <p class="event-copy" style="margin-inline:auto">Вы победили THE EMPTY KING, ORACLE OF SIX и THE INFINITY ENGINE. Сохранение остаётся доступным: забег можно продолжить в бесконечном режиме.</p>
          <div class="run-list" style="max-width:520px;margin:0 auto 20px;text-align:left">
            <div class="run-list-item"><span>Итоговый счёт</span><strong>${Math.floor(run.score)}</strong></div>
            <div class="run-list-item"><span>Ходы плиток</span><strong>${run.totalMoves}</strong></div>
            <div class="run-list-item"><span>Побеждено врагов</span><strong>${run.kills}</strong></div>
            <div class="run-list-item"><span>Реликвии</span><strong>${run.relics.length}</strong></div>
          </div>
          <div class="button-row" style="justify-content:center">
            <button id="continueInfiniteButton" class="primary-button" type="button">Продолжить забег</button>
            <button id="victoryTitleButton" class="secondary-button" type="button">В главное меню</button>
          </div>
        </div>
      </section>
    `;
    $("#continueInfiniteButton", this.screenEl).addEventListener("click", () => {
      run.infiniteUnlocked = true;
      this.state.screen = "floorComplete";
      this.saveGame();
      this.render();
    });
    $("#victoryTitleButton", this.screenEl).addEventListener("click", () => {
      this.state.screen = "title";
      this.state.run = null;
      this.render();
    });
  },

  renderGameOver() {
    const run = this.state.run;
    this.screenEl.innerHTML = `
      <section class="end-screen">
        <div class="panel end-box floor-complete">
          <div class="event-icon" style="border-color:var(--red);color:var(--red);background:rgba(255,82,106,.08)">Ø</div>
          <p class="eyebrow danger-text">CONNECTION LOST</p>
          <h2>Забег завершён</h2>
          <p class="event-copy" style="margin-inline:auto">Башня вернула носителя в NULL. Seed можно повторить с другим персонажем или начать новую последовательность.</p>
          <div class="run-list" style="max-width:520px;margin:0 auto 20px;text-align:left">
            <div class="run-list-item"><span>Этаж</span><strong>${run.floor}</strong></div>
            <div class="run-list-item"><span>Счёт</span><strong>${Math.floor(run.score)}</strong></div>
            <div class="run-list-item"><span>Врагов уничтожено</span><strong>${run.kills}</strong></div>
            <div class="run-list-item"><span>Seed</span><strong>${escapeHTML(run.seed)}</strong></div>
          </div>
          <div class="button-row" style="justify-content:center">
            <button id="retrySeedButton" class="primary-button" type="button">Повторить seed</button>
            <button id="gameOverTitleButton" class="secondary-button" type="button">Главное меню</button>
          </div>
        </div>
      </section>
    `;
    $("#retrySeedButton", this.screenEl).addEventListener("click", () => {
      const seed = run.seed;
      const heroId = run.heroId;
      this.startRun(heroId, seed);
    });
    $("#gameOverTitleButton", this.screenEl).addEventListener("click", () => {
      this.clearSave();
      this.goToTitle();
    });
  },
});

Object.assign(Game, {
  startCombat(roomType) {
    const run = this.state.run;
    const tutorialOpening = run.floor === 1 && run.stage === 0 && run.tutorial?.enabled;
    const board = this.createSolvableBoard(tutorialOpening ? 18 : 46 + run.floor * 4 + (roomType === "elite" ? 12 : 0));
    const enemies = this.createEncounter(roomType);
    if (tutorialOpening && enemies[0]) {
      enemies[0].name = `${enemies[0].name} // TRAINING`;
      enemies[0].maxHp = Math.max(84, enemies[0].maxHp);
      enemies[0].hp = enemies[0].maxHp;
      enemies[0].baseDamage = Math.min(5, enemies[0].baseDamage);
      enemies[0].countdown = Math.max(4, enemies[0].countdown);
      enemies[0].baseCountdown = enemies[0].countdown;
    }
    const maxMoves = this.hasRelic("overclock") ? 7 : 6;
    this.state.combat = {
      roomType,
      board,
      boardHistory: [],
      tileStatus: {},
      enemies,
      targetId: enemies[0]?.uid || null,
      dice: [1, 1],
      cycle: 1,
      movesInCycle: 0,
      maxMoves,
      totalMoves: 0,
      usedCombos: [],
      comboSelection: { pattern: "LINE", effect: "CUT", protocol: "MATCH" },
      cooldowns: {},
      logs: [],
      blankPath: [board.indexOf(0)],
      pathTiles: [],
      directionSet: [],
      lastDirections: [],
      lastDirection: null,
      sameDirectionStreak: 0,
      lastMovedValue: null,
      freeMoves: 0,
      frozenIntents: 0,
      counterDamage: 0,
      corruptionShield: 0,
      duplicateNextCombo: 0,
      forkBonus: 0,
      bitflipMoves: 0,
      protocolFlex: 0,
      doubleDown: false,
      doubleDownResolved: false,
      eventHorizonMoves: 0,
      phaseMoves: 0,
      blackVectorMoves: 0,
      blackVectorTiles: [],
      zeroTraceMoves: 0,
      rerolledThisCycle: false,
      exploitUsed: false,
      brokenD6Used: false,
      comboActivations: 0,
      restorePoint: null,
      restorePointUsed: false,
      flashMessage: "",
      flashUntil: 0,
      bossState: {},
      pendingEnd: false,
    };

    if (this.hasRelic("static_ward")) run.armor += 10;
    if (this.hasRelic("dead_clock")) this.state.combat.freeMoves += 2;
    if (this.hasRelic("chrome_memory")) this.state.combat.corruptionShield += 1;

    for (const modifier of run.nextCombatMods || []) {
      if (modifier === "overcharge") {
        run.energy = run.maxEnergy;
        run.armor += 14;
      }
      if (modifier === "corruptedBoard") {
        const values = this.shuffle(board.filter(Boolean)).slice(0, 3);
        values.forEach((value) => {
          this.tileState(value).corrupted = 8;
        });
      }
    }
    run.nextCombatMods = [];

    this.rollDice(true);
    this.applyCycleStartPassive(true);
    this.log(`Контакт: ${enemies.map((enemy) => enemy.name).join(" / ")}.`, "system");
    this.log("Сдвиг плитки уменьшает таймеры намерений. Цикл: шесть ходов.");
    this.state.screen = "combat";
    this.saveGame();
    this.render();
    this.beep(roomType === "boss" ? 115 : 190, roomType === "boss" ? 0.18 : 0.08, "sawtooth", 0.022);
  },

  createEncounter(roomType) {
    const run = this.state.run;
    if (roomType === "boss") {
      const bossIndex = Math.floor((run.floor - 1) / 3) % BOSSES.length;
      return [this.spawnEnemy(BOSSES[bossIndex], { boss: true, elite: true })];
    }

    const elite = roomType === "elite";
    const baseCount = 1 + Math.floor((run.floor + 1) / 3);
    const count = clamp(baseCount + (elite ? 1 : 0), 1, 5);
    const selected = [];
    const meleeOrRanged = ENEMY_DEFS.filter((enemy) => ["БЛИЖНИК", "ДАЛЬНИК"].includes(enemy.archetype));
    selected.push(this.pick(meleeOrRanged));

    while (selected.length < count) {
      let pool = ENEMY_DEFS;
      if (run.floor <= 2) pool = ENEMY_DEFS.filter((enemy) => enemy.archetype !== "САППОРТ");
      if (run.floor >= 4 && selected.length === count - 1 && !selected.some((enemy) => enemy.archetype === "САППОРТ")) {
        pool = ENEMY_DEFS.filter((enemy) => enemy.archetype === "САППОРТ");
      }
      const candidate = this.pick(pool);
      if (!candidate) break;
      const duplicateCount = selected.filter((enemy) => enemy.id === candidate.id).length;
      if (duplicateCount >= 2) continue;
      selected.push(candidate);
    }

    return selected.map((definition) => this.spawnEnemy(definition, { elite }));
  },

  spawnEnemy(definition, options = {}) {
    const run = this.state.run;
    const isBoss = Boolean(options.boss);
    const loopScale = Math.max(0, run.floor - 9);
    const scale = 1 + (run.floor - 1) * (isBoss ? 0.09 : 0.13) + run.heat * 0.0025 + loopScale * 0.025;
    const maxHp = Math.round(definition.hp * scale * (options.elite && !isBoss ? 1.38 : 1));
    const mutations = [];
    if (!isBoss) {
      let mutationCount = 0;
      if (options.elite) mutationCount += 1;
      if (run.floor >= 5 && this.random() < 0.45) mutationCount += 1;
      if (run.floor >= 10 && (options.elite || this.random() < 0.32)) mutationCount += 1;
      const pool = this.shuffle(MUTATIONS);
      for (let index = 0; index < Math.min(2, mutationCount); index += 1) mutations.push(pool[index].id);
    }
    const countdown = Math.max(1, definition.countdown - (mutations.includes("feral") ? 1 : 0));
    const armor = mutations.includes("chrome") ? Math.ceil(maxHp * 0.22) : options.elite && !isBoss ? 8 + run.floor * 2 : 0;
    return {
      uid: `${definition.id}-${Math.floor(this.random() * 1e9).toString(36)}`,
      id: definition.id,
      name: definition.name,
      archetype: definition.archetype,
      hp: maxHp,
      maxHp,
      armor,
      baseDamage: Math.round(definition.damage * (1 + (run.floor - 1) * 0.08 + run.heat * 0.002)),
      countdown,
      baseCountdown: countdown,
      intent: definition.intent,
      mutations,
      elite: Boolean(options.elite),
      boss: isBoss,
      phase: 1,
      stunned: 0,
      poison: 0,
      poisonTurns: 0,
      weakened: 0,
      actionCount: 0,
      revived: false,
      echoUsed: false,
      telegraphRow: null,
      doomDie: null,
    };
  },

  createSolvableBoard(steps = 60) {
    const board = Array.from({ length: 15 }, (_, index) => index + 1).concat(0);
    let previousBlank = -1;
    for (let step = 0; step < steps; step += 1) {
      const blank = board.indexOf(0);
      let choices = this.orthogonalNeighbors(blank).filter((index) => index !== previousBlank);
      if (!choices.length) choices = this.orthogonalNeighbors(blank);
      const target = this.pick(choices);
      previousBlank = blank;
      [board[blank], board[target]] = [board[target], board[blank]];
    }
    if (this.isSolved(board)) return this.createSolvableBoard(steps + 7);
    return board;
  },

  orthogonalNeighbors(index) {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const result = [];
    if (row > 0) result.push(index - 4);
    if (row < 3) result.push(index + 4);
    if (col > 0) result.push(index - 1);
    if (col < 3) result.push(index + 1);
    return result;
  },

  phaseNeighbors(index) {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const result = [];
    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
      for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
        if (!rowDelta && !colDelta) continue;
        const targetRow = row + rowDelta;
        const targetCol = col + colDelta;
        if (targetRow >= 0 && targetRow < 4 && targetCol >= 0 && targetCol < 4) result.push(targetRow * 4 + targetCol);
      }
    }
    return result;
  },

  tileState(value) {
    if (!this.state.combat.tileStatus[value]) {
      this.state.combat.tileStatus[value] = { locked: 0, corrupted: 0, protected: 0, marked: 0, entropy: 0 };
    }
    return this.state.combat.tileStatus[value];
  },

  faceForValue(value) {
    if (!value) return 0;
    const combat = this.state.combat;
    let logicalValue = combat?.bitflipMoves > 0 ? 16 - value : value;
    let face = ((logicalValue - 1 + (this.state.run?.diceBias || 0)) % 6) + 1;
    const status = combat?.tileStatus?.[value];
    if (status?.corrupted > 0) face = 7 - face;
    return face;
  },

  correctCount(board = this.state.combat?.board) {
    if (!board) return 0;
    return board.reduce((count, value, index) => count + (value !== 0 && value === index + 1 ? 1 : 0), 0);
  },

  completedLines(board = this.state.combat?.board) {
    if (!board) return 0;
    let count = 0;
    for (let row = 0; row < 4; row += 1) {
      const indices = [0, 1, 2, 3].map((col) => row * 4 + col);
      if (indices.every((index) => board[index] !== 0 && board[index] === index + 1)) count += 1;
    }
    for (let col = 0; col < 4; col += 1) {
      const indices = [0, 1, 2, 3].map((row) => row * 4 + col);
      if (indices.every((index) => board[index] !== 0 && board[index] === index + 1)) count += 1;
    }
    return count;
  },

  boardDistance(board = this.state.combat?.board) {
    if (!board) return 0;
    let distance = 0;
    board.forEach((value, index) => {
      if (!value) return;
      const target = value - 1;
      distance += Math.abs(Math.floor(index / 4) - Math.floor(target / 4)) + Math.abs((index % 4) - (target % 4));
    });
    return distance;
  },

  isSolved(board = this.state.combat?.board) {
    return Boolean(board) && board.every((value, index) => value === (index + 1) % 16);
  },

  canMoveTile(index) {
    const combat = this.state.combat;
    if (!combat || combat.pendingEnd) return false;
    const value = combat.board[index];
    if (!value) return false;
    const status = this.tileState(value);
    if (status.locked > 0) return false;
    const blank = combat.board.indexOf(0);
    const valid = combat.phaseMoves > 0 ? this.phaseNeighbors(blank) : this.orthogonalNeighbors(blank);
    return valid.includes(index);
  },

  findSolverHintIndex() {
    const combat = this.state.combat;
    if (!combat) return -1;
    const blank = combat.board.indexOf(0);
    const candidates = this.orthogonalNeighbors(blank).filter((index) => this.tileState(combat.board[index]).locked <= 0);
    if (!candidates.length) return -1;
    const currentDistance = this.boardDistance(combat.board);
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const index of candidates) {
      const copy = [...combat.board];
      [copy[blank], copy[index]] = [copy[index], copy[blank]];
      const score = (this.correctCount(copy) - this.correctCount(combat.board)) * 9 + (currentDistance - this.boardDistance(copy));
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    }
    return best;
  },

  rollDice(initial = false, manual = false) {
    const combat = this.state.combat;
    if (!combat) return;
    let white = !initial && this.hasRelic("null_crown") ? combat.dice[0] : this.randomInt(1, 6);
    let black = this.randomInt(1, 6);

    if (this.state.run.luck >= 3) {
      this.state.run.luck -= 3;
      black = 6;
      this.log("HOUSE EDGE фиксирует чёрную кость на шестёрке.", "success");
    }
    if (this.hasRelic("broken_d6") && !combat.brokenD6Used) {
      if (white === 1) {
        white = 6;
        combat.brokenD6Used = true;
      } else if (black === 1) {
        black = 6;
        combat.brokenD6Used = true;
      }
    }
    combat.dice = [white, black];
    if (manual) combat.rerolledThisCycle = true;
  },

  manualReroll() {
    if (this.tileAnimationLocked) return;
    if (this.tutorialActionBlocked("reroll")) return;
    const run = this.state.run;
    const combat = this.state.combat;
    if (!combat || run.energy < 1) return;
    run.energy -= 1;
    run.heat += 1;
    this.rollDice(false, true);
    this.log(`Ручной переброс: ${DICE[combat.dice[0]]} + ${DICE[combat.dice[1]]}.`, "system");
    this.beep(640, 0.04, "square", 0.014);
    this.saveGame();
    this.renderCombat();
  },

  renderCombat(animationSnapshot = null) {
    this.cancelBoardAnimation();
    const combat = this.state.combat;
    const run = this.state.run;
    if (!combat || !run) {
      this.state.screen = "map";
      this.render();
      return;
    }
    const hero = this.hero();
    const evaluation = this.evaluateSelectedCombo();
    const hintIndex = this.hasRelic("void_compass") ? this.findSolverHintIndex() : -1;
    this.screenEl.innerHTML = `
      <section class="combat-screen">
        <div class="combat-grid">
          <div class="combat-column player-column">
            <section class="panel player-panel" data-tutorial-target="player">
              <div class="panel-header"><p class="panel-title">Носитель</p><span class="terminal-code">CYCLE ${combat.cycle}</span></div>
              <div class="player-body">
                <div class="player-name-row"><div class="hero-glyph">${hero.glyph}</div><div><span class="character-role">${hero.role}</span><h3>${hero.name}</h3></div></div>
                <div class="stat-row"><span>HP</span><strong>${Math.ceil(run.hp)} / ${run.maxHp}</strong></div>
                <div class="stat-bar hp"><span style="--value:${pct(run.hp, run.maxHp)}"></span></div>
                <div class="stat-row"><span>ARMOR</span><strong>${Math.ceil(run.armor)}</strong></div>
                <div class="stat-row"><span>NULL ENERGY</span><strong>${Math.floor(run.energy)} / ${run.maxEnergy}</strong></div>
                <div class="stat-bar energy"><span style="--value:${pct(run.energy, run.maxEnergy)}"></span></div>
                <div class="player-passive"><strong>${hero.passive.name}</strong>${hero.passive.desc}</div>
              </div>
            </section>
            <section class="panel-flat" style="padding:12px">
              <div class="panel-header" style="padding:0 0 10px;border:0"><p class="panel-title">Способности</p><span class="muted" style="font-size:11px">КЛАВИШИ 1–5</span></div>
              <div class="ability-stack" data-tutorial-target="abilities">${hero.abilities.map((ability, index) => this.abilityButtonHTML(ability, index)).join("")}</div>
            </section>
          </div>

          <div class="combat-column board-column">
            <section class="panel board-panel">
              <div class="combat-status-line" data-tutorial-target="cycle">
                <div class="dice-cluster">
                  <span class="die" title="Белая кость">${DICE[combat.dice[0]]}</span>
                  <span class="die black" title="Чёрная кость">${DICE[combat.dice[1]]}</span>
                  <button id="rerollButton" class="ghost-button" type="button" ${run.energy < 1 ? "disabled" : ""}>REROLL −1</button>
                </div>
                <div class="move-counter"><span>Сдвиги</span><span class="move-pips">${Array.from({ length: combat.maxMoves }, (_, index) => `<i class="move-pip ${index < combat.movesInCycle ? "used" : ""}"></i>`).join("")}</span><strong>${combat.movesInCycle}/${combat.maxMoves}</strong></div>
              </div>
              <div class="puzzle-wrap">
                <div class="puzzle-grid" data-tutorial-target="board" role="grid" aria-label="Боевая матрица пятнашек">
                  ${combat.board.map((value, index) => this.boardTileHTML(value, index, hintIndex)).join("")}
                </div>
                ${combat.flashMessage && Date.now() < combat.flashUntil ? `<div class="board-message"><span>${escapeHTML(combat.flashMessage)}</span></div>` : ""}
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:10px;color:var(--muted);font-size:11px">
                <span>ORDER ${this.correctCount()} / 15</span><span>VOID PATH ${combat.pathTiles.length}</span><span>TOTAL MOVES ${combat.totalMoves}</span>
              </div>
            </section>

            <section class="panel-flat combo-panel" data-tutorial-target="combo">
              <div class="panel-header" style="padding:0 0 10px;border:0"><p class="panel-title">Комбо-конструктор // 8 × 8 × 3 = 192</p><span class="muted" style="font-size:11px">SPACE</span></div>
              <div class="combo-builder">
                ${this.comboSelectHTML("pattern", PATTERNS, combat.comboSelection.pattern, "Шаблон поля")}
                ${this.comboSelectHTML("effect", EFFECTS, combat.comboSelection.effect, "Боевой эффект")}
                ${this.comboSelectHTML("protocol", PROTOCOLS, combat.comboSelection.protocol, "Протокол костей")}
              </div>
              <div class="combo-result ${evaluation.ready ? "ready" : ""}">
                <span><span class="combo-name">${this.comboName(combat.comboSelection)}</span><span class="combo-hint">${evaluation.ready ? `ГОТОВО · сила ${evaluation.strength} · группа [${evaluation.group.join(", ")}]` : evaluation.reason}</span></span>
                <button id="activateComboButton" class="primary-button combo-activate" type="button" ${evaluation.ready && run.energy >= 2 && !combat.usedCombos.includes(this.comboKey()) ? "" : "disabled"}>ACTIVATE −2</button>
              </div>
            </section>
          </div>

          <div class="combat-column enemies-column">
            <section class="panel enemies-panel" data-tutorial-target="enemies">
              <div class="panel-header"><p class="panel-title">Противники</p><span class="terminal-code">${combat.enemies.filter((enemy) => enemy.hp > 0).length} ACTIVE</span></div>
              <div class="enemy-list">${combat.enemies.map((enemy) => this.enemyCardHTML(enemy)).join("")}</div>
            </section>
            <section class="panel log-panel" data-tutorial-target="log">
              <div class="panel-header"><p class="panel-title">Журнал боя</p><span class="muted" style="font-size:11px">WASD / ARROWS</span></div>
              <div class="combat-log">${[...combat.logs].reverse().map((entry) => `<div class="log-line ${entry.type || ""}">${entry.message}</div>`).join("")}</div>
            </section>
          </div>
        </div>
      </section>
    `;

    $$('[data-tile-index]', this.screenEl).forEach((tile) => {
      tile.addEventListener("click", () => this.moveTile(Number(tile.dataset.tileIndex)));
    });
    $$('[data-ability-id]', this.screenEl).forEach((button) => {
      button.addEventListener("click", () => this.useAbility(button.dataset.abilityId));
    });
    $$('[data-enemy-id]', this.screenEl).forEach((card) => {
      card.addEventListener("click", () => {
        if (this.tileAnimationLocked || card.classList.contains("dead")) return;
        combat.targetId = card.dataset.enemyId;
        this.renderCombat();
      });
    });
    $$(".combo-select", this.screenEl).forEach((select) => {
      select.addEventListener("change", () => {
        if (this.tileAnimationLocked) {
          select.value = combat.comboSelection[select.dataset.comboPart];
          return;
        }
        combat.comboSelection[select.dataset.comboPart] = select.value;
        this.renderCombat();
      });
    });
    $("#activateComboButton", this.screenEl).addEventListener("click", () => this.activateCombo());
    $("#rerollButton", this.screenEl).addEventListener("click", () => this.manualReroll());
    if (animationSnapshot) this.animateBoardTransition(animationSnapshot);
    this.scheduleTutorial();
  },

  boardTileHTML(value, index, hintIndex) {
    if (!value) return `<button class="tile blank" data-tile-index="${index}" data-tile-value="0" type="button" disabled aria-label="Пустая клетка"></button>`;
    const combat = this.state.combat;
    const status = this.tileState(value);
    const movable = this.canMoveTile(index);
    const blank = combat.board.indexOf(0);
    const orthogonal = this.orthogonalNeighbors(blank).includes(index);
    const correct = value === index + 1;
    const classes = [
      "tile",
      movable ? "movable" : "",
      movable && !orthogonal ? "phase-movable" : "",
      correct ? "correct" : "",
      status.locked > 0 ? "locked" : "",
      status.corrupted > 0 ? "corrupted" : "",
      status.marked > 0 ? "marked" : "",
    ].filter(Boolean).join(" ");
    const stateIcon = status.locked > 0 ? `LOCK ${status.locked}` : status.corrupted > 0 ? `ERR ${status.corrupted}` : status.protected > 0 ? `ANCHOR` : index === hintIndex ? "PATH" : "";
    return `
      <button class="${classes}" data-tile-index="${index}" data-tile-value="${value}" type="button" ${movable ? "" : "disabled"} aria-label="Плитка ${value}, грань ${this.faceForValue(value)}">
        <span class="tile-state">${stateIcon}</span>
        <span class="tile-number">${value}</span>
        <span class="tile-face">${DICE[this.faceForValue(value)]}</span>
      </button>
    `;
  },

  abilityButtonHTML(ability, index) {
    const run = this.state.run;
    const combat = this.state.combat;
    const cooldown = combat.cooldowns[ability.id] || 0;
    const level = run.abilityLevels[ability.id] || 0;
    const disabled = run.energy < ability.cost || cooldown > 0 || combat.pendingEnd;
    return `
      <button class="ability-button ${ability.ultimate ? "ultimate" : ""}" data-ability-id="${ability.id}" type="button" ${disabled ? "disabled" : ""}>
        <span><span class="ability-name">${index + 1}. ${ability.name}${level ? ` +${level}` : ""}</span><span class="ability-desc">${ability.desc}</span></span>
        <span class="ability-meta"><span>−${ability.cost}</span>${cooldown ? `<span class="ability-cooldown">CD ${cooldown}</span>` : ""}</span>
      </button>
    `;
  },

  enemyCardHTML(enemy) {
    const dead = enemy.hp <= 0;
    const targeted = this.state.combat.targetId === enemy.uid;
    const statuses = [];
    if (enemy.armor > 0) statuses.push(`<span class="status-chip positive">ARMOR ${Math.ceil(enemy.armor)}</span>`);
    if (enemy.poison > 0) statuses.push(`<span class="status-chip negative">DOT ${enemy.poison}×${enemy.poisonTurns}</span>`);
    if (enemy.stunned > 0) statuses.push(`<span class="status-chip negative">JAM ${enemy.stunned}</span>`);
    if (enemy.weakened > 0) statuses.push(`<span class="status-chip negative">WEAK ${enemy.weakened}</span>`);
    for (const mutation of enemy.mutations) statuses.push(`<span class="status-chip positive">${mutation.toUpperCase()}</span>`);
    if (enemy.boss) statuses.push(`<span class="status-chip positive">PHASE ${enemy.phase}</span>`);
    return `
      <article class="enemy-card ${targeted ? "targeted" : ""} ${dead ? "dead" : ""}" data-enemy-id="${enemy.uid}" tabindex="0">
        <div class="enemy-head">
          <div><p class="enemy-name">${dead ? "[NULL] " : ""}${enemy.name}</p><span class="enemy-type">${enemy.archetype}</span></div>
          <div class="enemy-intent">${dead ? "TERMINATED" : `${this.enemyIntentLabel(enemy)} · ${enemy.countdown}`}</div>
        </div>
        <div class="enemy-bars"><div class="stat-bar hp"><span style="--value:${pct(enemy.hp, enemy.maxHp)}"></span></div><span class="enemy-hp-text">${Math.ceil(Math.max(0, enemy.hp))}/${enemy.maxHp}</span></div>
        <div class="enemy-statuses">${statuses.join("")}</div>
      </article>
    `;
  },

  enemyIntentLabel(enemy) {
    if (enemy.stunned > 0) return "JAMMED";
    if (enemy.id === "railEye" && enemy.telegraphRow !== null) return `ROW ${enemy.telegraphRow + 1}`;
    if (enemy.id === "oracleSix" && enemy.doomDie) return `${DICE[enemy.doomDie]} PREDICT`;
    if (enemy.boss) {
      const phaseLabels = {
        emptyKing: ["EMPTY THRONE", "TWO ABSENCES", "PERFECT NOTHING"],
        oracleSix: ["PREDICTION", "LOADED FUTURE", "ALL BETS VOID"],
        infinityEngine: ["RECORD", "RECURSION", "INFINITE RETURN"],
      };
      return phaseLabels[enemy.id]?.[enemy.phase - 1] || enemy.intent;
    }
    return enemy.intent;
  },

  comboSelectHTML(part, options, selected, label) {
    return `
      <div class="combo-field"><label>${label}</label><select class="select combo-select" data-combo-part="${part}">
        ${options.map((option) => `<option value="${option.id}" ${option.id === selected ? "selected" : ""}>${option.name}</option>`).join("")}
      </select></div>
    `;
  },

  comboName(selection = this.state.combat.comboSelection) {
    return `${COMBO_PREFIX[selection.pattern]} ${COMBO_SUFFIX[selection.effect]} // ${selection.protocol}`;
  },

  comboKey(selection = this.state.combat.comboSelection) {
    return `${selection.pattern}:${selection.effect}:${selection.protocol}`;
  },

  log(message, type = "") {
    const combat = this.state.combat;
    if (!combat) return;
    combat.logs.push({ message, type });
    if (combat.logs.length > 45) combat.logs.shift();
  },
});

Object.assign(Game, {
  moveTile(index) {
    const combat = this.state.combat;
    if (this.tileAnimationLocked || this.tutorialActionBlocked("tile")) return;
    if (!combat || !this.canMoveTile(index) || combat.pendingEnd) return;
    const animationSnapshot = this.captureBoardAnimation();
    const board = combat.board;
    const blank = board.indexOf(0);
    const value = board[index];
    const beforeCorrect = value === index + 1;
    const direction = this.directionFromIndices(blank, index);

    combat.boardHistory.push([...board]);
    if (combat.boardHistory.length > 14) combat.boardHistory.shift();
    [board[blank], board[index]] = [board[index], board[blank]];

    combat.lastMovedValue = value;
    combat.blankPath.push(index);
    combat.pathTiles.push(value);
    if (combat.blankPath.length > 18) combat.blankPath.shift();
    if (combat.pathTiles.length > 18) combat.pathTiles.shift();
    combat.lastDirections.push(direction);
    if (combat.lastDirections.length > 8) combat.lastDirections.shift();
    if (!combat.directionSet.includes(direction)) combat.directionSet.push(direction);
    if (combat.lastDirection === direction) combat.sameDirectionStreak += 1;
    else combat.sameDirectionStreak = 1;
    combat.lastDirection = direction;

    const afterIndex = board.indexOf(value);
    const afterCorrect = value === afterIndex + 1;
    if (afterCorrect && !beforeCorrect) {
      this.state.run.order += 1;
      this.gainEnergy(1, false);
      this.log(`Плитка ${value} возвращена в порядок.`, "success");
    } else {
      this.gainEnergy(1, false);
    }

    const tileStatus = this.tileState(value);
    if (tileStatus.marked > 0) {
      tileStatus.marked = 0;
      this.damagePlayer(6 + this.state.run.floor, `Метка на плитке ${value}`, null);
    }

    this.applyMovePassives(value, direction);
    this.applyPathAbilities(value);

    combat.totalMoves += 1;
    this.state.run.totalMoves += 1;
    this.tutorialEvent("tile_moved", { value, index, stage: this.state.run.stage });

    if (this.isSolved()) this.triggerZeroState();
    if (combat.pendingEnd) return;

    const isFree = combat.freeMoves > 0;
    if (isFree) {
      combat.freeMoves -= 1;
      this.log("BLINK: вражеские таймеры не изменились.", "success");
      this.tickMoveDurations(false);
    } else {
      this.processCombatTick();
    }

    if (combat.pendingEnd) return;
    this.saveGame();
    this.renderCombat(animationSnapshot);
    this.beep(210 + value * 10, 0.025, "square", 0.008);
  },

  directionFromIndices(blank, target) {
    const delta = target - blank;
    if (delta === -4) return "U";
    if (delta === 4) return "D";
    if (delta === -1) return "L";
    if (delta === 1) return "R";
    const blankRow = Math.floor(blank / 4);
    const blankCol = blank % 4;
    const targetRow = Math.floor(target / 4);
    const targetCol = target % 4;
    return `${targetRow < blankRow ? "U" : "D"}${targetCol < blankCol ? "L" : "R"}`;
  },

  applyMovePassives(value, direction) {
    const combat = this.state.combat;
    const hero = this.hero();
    if (hero.id === "vanta" && combat.directionSet.length >= 4 && !combat.momentumReady) {
      combat.momentumReady = true;
      this.log("VECTOR MOMENTUM заряжен: следующая атака усилена.", "success");
    }
    if (hero.id === "nullwalker") {
      combat.nullUnique ||= [];
      if (!combat.nullUnique.includes(value)) combat.nullUnique.push(value);
      if (combat.nullUnique.length >= 4) {
        combat.nullUnique = [];
        this.gainEnergy(2, false);
        combat.eventHorizonMoves = Math.max(combat.eventHorizonMoves, 1);
        this.log("LIVING BLANK поглощает четыре уникальные плитки: +2 NULL.", "success");
      }
    }
    if (hero.id === "casino" && direction.length > 1) {
      this.state.run.luck += 1;
    }
  },

  applyPathAbilities(value) {
    const combat = this.state.combat;
    if (combat.blackVectorMoves > 0) {
      if (!combat.blackVectorTiles.includes(value)) combat.blackVectorTiles.push(value);
      if (combat.blackVectorTiles.length >= 4) {
        const amount = this.scaleAbility(10, "v_ult");
        this.damageAllEnemies(amount, { source: "BLACK VECTOR", pierce: 0.35 });
        combat.blackVectorTiles = [];
        combat.flashMessage = "BLACK VECTOR";
        combat.flashUntil = Date.now() + 900;
      }
    }
    if (combat.zeroTraceMoves > 0 && this.hasClosedVoidLoop()) {
      const amount = this.scaleAbility(24, "n_ult");
      this.damageAllEnemies(amount, { source: "ZERO TRACE", pierce: 0.5 });
      combat.zeroTraceMoves = 0;
      combat.blankPath = [combat.board.indexOf(0)];
      combat.pathTiles = [];
      combat.flashMessage = "ZERO TRACE";
      combat.flashUntil = Date.now() + 900;
    }
  },

  hasClosedVoidLoop() {
    const path = this.state.combat?.blankPath || [];
    if (path.length < 5) return false;
    const current = path.at(-1);
    return path.slice(0, -3).includes(current);
  },

  triggerZeroState() {
    const combat = this.state.combat;
    const run = this.state.run;
    const damage = 34 + run.floor * 4;
    combat.flashMessage = "ZERO STATE";
    combat.flashUntil = Date.now() + 1000;
    this.log(`<strong>ZERO STATE</strong>: идеальный порядок наносит ${damage} урона всей пачке.`, "system");
    this.damageAllEnemies(damage, { source: "ZERO STATE", pierce: 1 });
    this.cleanseTileStates(3, false);
    this.healPlayer(8 + run.floor, false);
    run.score += 180 + run.floor * 20;
    this.beep(880, 0.13, "sawtooth", 0.025);
    if (!this.state.combat.enemies.some((enemy) => enemy.hp > 0)) {
      this.checkCombatEnd();
      return;
    }
    this.scrambleCurrentBoard(18 + run.floor, false);
    combat.boardHistory = [];
    combat.blankPath = [combat.board.indexOf(0)];
    combat.pathTiles = [];
  },

  processCombatTick() {
    const combat = this.state.combat;
    if (!combat || combat.pendingEnd) return;
    combat.movesInCycle += 1;

    if (combat.frozenIntents > 0) {
      combat.frozenIntents -= 1;
      this.log("CLOSED SYSTEM удерживает намерения противников.", "success");
    } else {
      const acting = [];
      for (const enemy of combat.enemies) {
        if (enemy.hp <= 0) continue;
        enemy.countdown -= 1;
        if (enemy.countdown <= 0) acting.push(enemy);
      }
      for (const enemy of acting) {
        if (this.state.run.hp <= 0 || combat.pendingEnd) break;
        this.enemyAct(enemy);
        enemy.countdown = Math.max(1, enemy.baseCountdown);
      }
    }

    this.tickTileStatuses();
    this.tickMoveDurations(true);
    if (combat.pendingEnd || this.state.run.hp <= 0) return;
    if (combat.movesInCycle >= combat.maxMoves) this.endCycle();
  },

  tickMoveDurations(withWorldTick = true) {
    const combat = this.state.combat;
    const keys = ["bitflipMoves", "eventHorizonMoves", "phaseMoves", "blackVectorMoves", "zeroTraceMoves"];
    for (const key of keys) {
      if (combat[key] > 0) combat[key] -= 1;
    }
    if (!withWorldTick) return;
    if (combat.protocolFlex > 0) combat.protocolFlex -= 1;
  },

  tickTileStatuses() {
    const combat = this.state.combat;
    Object.values(combat.tileStatus).forEach((status) => {
      for (const key of ["locked", "corrupted", "protected", "marked"]) {
        if (status[key] > 0) status[key] -= 1;
      }
    });
  },

  endCycle() {
    const combat = this.state.combat;
    const run = this.state.run;
    if (combat.doubleDown && !combat.doubleDownResolved) {
      this.damagePlayer(10 + run.floor, "DOUBLE DOWN: провал", null, { bypassArmor: true });
      if (run.hp <= 0 || combat.pendingEnd) return;
      this.log("DOUBLE DOWN не реализован до конца цикла.", "damage");
    }

    for (const enemy of combat.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.poison > 0 && enemy.poisonTurns > 0) {
        this.damageEnemy(enemy, enemy.poison, { source: "SYNTAX BOMB", pierce: 0.2 });
        enemy.poisonTurns -= 1;
        if (enemy.poisonTurns <= 0) enemy.poison = 0;
      }
      if (enemy.weakened > 0) enemy.weakened -= 1;
    }
    if (combat.pendingEnd) return;

    Object.keys(combat.cooldowns).forEach((id) => {
      combat.cooldowns[id] = Math.max(0, combat.cooldowns[id] - 1);
    });

    if (this.hero().id === "casino" && !combat.rerolledThisCycle) {
      run.luck += 1;
      this.log(`HOUSE EDGE: LUCK ${run.luck}.`, "success");
    }
    if (this.hasRelic("overclock")) run.heat += 2;

    combat.cycle += 1;
    combat.movesInCycle = 0;
    combat.usedCombos = [];
    combat.directionSet = [];
    combat.lastDirection = null;
    combat.sameDirectionStreak = 0;
    combat.blankPath = [combat.board.indexOf(0)];
    combat.pathTiles = [];
    combat.rerolledThisCycle = false;
    combat.exploitUsed = false;
    combat.doubleDown = false;
    combat.doubleDownResolved = false;
    combat.protocolFlex = 0;
    combat.momentumReady = false;
    combat.nullUnique = [];
    this.rollDice(false, false);
    this.gainEnergy(1, false);
    this.applyCycleStartPassive(false);
    this.applyBossCycleEffects();
    this.log(`Цикл ${combat.cycle}: кости ${DICE[combat.dice[0]]} + ${DICE[combat.dice[1]]}.`, "system");
  },

  applyCycleStartPassive(initial = false) {
    const hero = this.hero();
    const combat = this.state.combat;
    if (hero.id === "bulwark") {
      const armor = Math.max(2, Math.floor(this.correctCount() / 2));
      this.gainArmor(armor, false);
      if (!initial) this.log(`STABLE STATE: +${armor} ARMOR.`, "success");
    }
    if (hero.id === "mora" && !combat.restorePointUsed && !combat.restorePoint && this.state.run.hp <= this.state.run.maxHp * 0.5) {
      this.createRestorePoint();
    }
  },

  applyBossCycleEffects() {
    const boss = this.state.combat.enemies.find((enemy) => enemy.boss && enemy.hp > 0);
    if (!boss) return;
    if (boss.id === "oracleSix") {
      boss.doomDie = this.randomInt(1, 6);
      this.log(`ORACLE объявляет пророчество грани ${DICE[boss.doomDie]}.`, "damage");
    }
    if (boss.id === "emptyKing") {
      const corners = [0, 3, 12, 15];
      this.state.combat.bossState.kingCorner = this.pick(corners);
      this.log(`EMPTY KING метит угол ${corners.indexOf(this.state.combat.bossState.kingCorner) + 1}.`, "damage");
    }
  },

  enemyAct(enemy, options = {}) {
    if (enemy.hp <= 0) return;
    if (enemy.stunned > 0) {
      enemy.stunned -= 1;
      this.log(`${enemy.name}: действие отменено JAM-протоколом.`, "success");
      return;
    }
    enemy.actionCount += 1;

    if (enemy.mutations.includes("loaded")) {
      this.rollDice(false, false);
      this.log(`${enemy.name} [LOADED] меняет кости.`, "damage");
    }

    if (enemy.boss) this.bossAct(enemy);
    else this.standardEnemyAct(enemy);

    if (this.state.run.hp <= 0 || this.state.combat.pendingEnd) return;
    if (enemy.mutations.includes("echo") && !enemy.echoUsed && !options.echo) {
      enemy.echoUsed = true;
      this.log(`${enemy.name} [ECHO] повторяет действие с половинной силой.`, "damage");
      this.standardEnemyAct(enemy, 0.5);
    }
  },

  enemyDamageMultiplier(enemy) {
    let multiplier = 1;
    if (enemy.elite && !enemy.boss) multiplier *= 1.12;
    if (enemy.weakened > 0) multiplier *= 0.72;
    if (enemy.mutations.includes("nullborn")) {
      const blank = this.state.combat.board.indexOf(0);
      if ([0, 3, 12, 15].includes(blank)) multiplier *= 1.3;
    }
    return multiplier;
  },

  standardEnemyAct(enemy, echoScale = 1) {
    const damage = Math.max(1, Math.round(enemy.baseDamage * this.enemyDamageMultiplier(enemy) * echoScale));
    const combat = this.state.combat;

    switch (enemy.id) {
      case "needle9": {
        this.damagePlayer(damage, enemy.name, enemy);
        const value = this.pickMovableValue();
        if (value) this.applyTileDebuff(value, "marked", 5, enemy.name);
        break;
      }
      case "railEye": {
        if (enemy.telegraphRow === null) {
          enemy.telegraphRow = this.randomInt(0, 3);
          enemy.countdown = 2;
          this.log(`${enemy.name} наводится на строку ${enemy.telegraphRow + 1}.`, "damage");
        } else {
          const blankRow = Math.floor(combat.board.indexOf(0) / 4);
          const shot = blankRow === enemy.telegraphRow ? Math.round(damage * 1.65) : Math.round(damage * 0.55);
          this.damagePlayer(shot, `${enemy.name}: ROW ${enemy.telegraphRow + 1}`, enemy, { pierceArmor: blankRow === enemy.telegraphRow ? 0.4 : 0 });
          enemy.telegraphRow = this.randomInt(0, 3);
        }
        break;
      }
      case "splinterCloud": {
        const multiplier = 1 + Math.max(0, combat.sameDirectionStreak - 1) * 0.22;
        this.damagePlayer(Math.round(damage * multiplier), enemy.name, enemy);
        break;
      }
      case "nullHound": {
        const blank = combat.board.indexOf(0);
        const row = Math.floor(blank / 4);
        const col = blank % 4;
        const nearCenter = [1, 2].includes(row) && [1, 2].includes(col);
        this.damagePlayer(Math.round(damage * (nearCenter ? 1.45 : 0.8)), enemy.name, enemy);
        break;
      }
      case "riotCutter": {
        this.damagePlayer(damage, enemy.name, enemy);
        this.disruptCorrectTile();
        break;
      }
      case "chainJack": {
        this.damagePlayer(Math.round(damage * 0.75), enemy.name, enemy);
        const value = this.pickMovableValue();
        if (value) this.applyTileDebuff(value, "locked", 5, enemy.name);
        break;
      }
      case "glitchWitch": {
        const values = this.shuffle(combat.board.filter(Boolean)).slice(0, 2);
        values.forEach((value) => this.applyTileDebuff(value, "corrupted", 7, enemy.name));
        this.damagePlayer(Math.round(damage * 0.45), enemy.name, enemy);
        break;
      }
      case "entropyMonk": {
        const value = combat.lastMovedValue || this.pickMovableValue();
        if (value) {
          const state = this.tileState(value);
          state.entropy = (state.entropy || 0) + 1;
          this.applyTileDebuff(value, "corrupted", 6, enemy.name);
          if (state.entropy >= 3) {
            this.damagePlayer(damage * 2, `${enemy.name}: ENTROPY BURST`, enemy, { bypassArmor: true });
            state.entropy = 0;
          } else {
            this.damagePlayer(Math.round(damage * 0.45), enemy.name, enemy);
          }
        }
        break;
      }
      case "chronoLich": {
        combat.enemies.filter((target) => target.hp > 0 && target.uid !== enemy.uid).forEach((target) => {
          target.countdown = Math.max(1, target.countdown - 1);
        });
        const activeCooldowns = Object.keys(combat.cooldowns).filter((id) => combat.cooldowns[id] > 0);
        if (activeCooldowns.length) {
          const id = this.pick(activeCooldowns);
          combat.cooldowns[id] += 1;
        }
        this.damagePlayer(Math.round(damage * 0.45), enemy.name, enemy);
        this.log(`${enemy.name} ускоряет союзные таймеры.`, "damage");
        break;
      }
      case "patchDrone": {
        const target = combat.enemies.filter((entry) => entry.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const heal = Math.max(8, Math.round(target.maxHp * 0.18));
        target.hp = Math.min(target.maxHp, target.hp + heal);
        target.weakened = 0;
        this.log(`${enemy.name} восстанавливает ${target.name}: +${heal} HP.`, "damage");
        break;
      }
      case "aegisNode": {
        combat.enemies.filter((target) => target.hp > 0).forEach((target) => {
          target.armor += 8 + this.state.run.floor * 2;
        });
        this.log(`${enemy.name} разворачивает общий AEGIS.`, "damage");
        break;
      }
      case "protocolChoir": {
        this.rollDice(false, false);
        const archetypes = ["ДАЛЬНИК", "БЛИЖНИК", "МАГ", "САППОРТ"];
        const buff = this.pick(archetypes);
        combat.enemies.filter((target) => target.hp > 0 && target.archetype === buff).forEach((target) => {
          target.countdown = Math.max(1, target.countdown - 1);
          target.armor += 5;
        });
        this.damagePlayer(Math.round(damage * 0.4), enemy.name, enemy);
        this.log(`${enemy.name} усиливает архетип ${buff}.`, "damage");
        break;
      }
      default:
        this.damagePlayer(damage, enemy.name, enemy);
    }
  },

  bossAct(enemy) {
    const combat = this.state.combat;
    const multiplier = this.enemyDamageMultiplier(enemy);
    const damage = Math.round(enemy.baseDamage * multiplier);
    this.updateBossPhase(enemy);

    if (enemy.id === "emptyKing") {
      const corners = [0, 3, 12, 15];
      const marked = combat.bossState.kingCorner ?? this.pick(corners);
      const blank = combat.board.indexOf(0);
      const hit = blank === marked ? Math.round(damage * 2) : Math.round(damage * 0.65);
      this.damagePlayer(hit, `${enemy.name}: ${this.enemyIntentLabel(enemy)}`, enemy, { pierceArmor: enemy.phase >= 3 ? 0.5 : 0 });
      combat.bossState.kingCorner = this.pick(corners.filter((corner) => corner !== marked));
      if (enemy.phase >= 2) {
        const value = this.pickMovableValue();
        if (value) this.applyTileDebuff(value, enemy.phase >= 3 ? "locked" : "corrupted", 5, enemy.name);
      }
      if (enemy.phase >= 3) this.disruptCorrectTile();
      this.log(`${enemy.name} переносит трон в новый угол.`, "damage");
      return;
    }

    if (enemy.id === "oracleSix") {
      const doom = enemy.doomDie || this.randomInt(1, 6);
      const matched = combat.dice.includes(doom);
      const hit = Math.round(damage * (matched ? 0.65 : 1.4));
      this.damagePlayer(hit, `${enemy.name}: ${DICE[doom]}`, enemy, { bypassArmor: enemy.phase >= 3 && !matched });
      if (!matched) this.state.run.energy = Math.max(0, this.state.run.energy - 1);
      if (enemy.phase >= 2) {
        combat.board.filter(Boolean).filter((value) => this.faceForValue(value) === doom).slice(0, enemy.phase).forEach((value) => this.applyTileDebuff(value, "locked", 3, enemy.name));
      }
      this.rollDice(false, false);
      enemy.doomDie = this.randomInt(1, 6);
      if (enemy.phase >= 3) {
        const secondDoom = this.randomInt(1, 6);
        if (!combat.dice.includes(secondDoom)) this.damagePlayer(Math.round(damage * 0.65), `${enemy.name}: SECOND BET`, enemy);
      }
      return;
    }

    if (enemy.id === "infinityEngine") {
      const replayCount = enemy.phase === 1 ? 2 : enemy.phase === 2 ? 3 : 4;
      const directions = combat.lastDirections.slice(-replayCount).reverse().map((direction) => this.inverseDirection(direction));
      let shifts = 0;
      for (const direction of directions) {
        if (this.forceBlankMove(direction)) shifts += 1;
      }
      this.damagePlayer(damage + shifts * 2, `${enemy.name}: ECHO ×${shifts}`, enemy, { pierceArmor: enemy.phase >= 3 ? 0.35 : 0 });
      if (enemy.phase >= 2) {
        const values = this.shuffle(combat.board.filter(Boolean)).slice(0, enemy.phase - 1);
        values.forEach((value) => this.applyTileDebuff(value, "corrupted", 5, enemy.name));
      }
      if (enemy.phase >= 3) enemy.baseCountdown = 2;
      this.log(`${enemy.name} повторяет ваши последние направления.`, "damage");
    }
  },

  updateBossPhase(enemy) {
    if (!enemy.boss || enemy.hp <= 0) return;
    const ratio = enemy.hp / enemy.maxHp;
    const nextPhase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    if (nextPhase <= enemy.phase) return;
    enemy.phase = nextPhase;
    enemy.baseCountdown = Math.max(2, enemy.baseCountdown - 1);
    enemy.countdown = Math.min(enemy.countdown, enemy.baseCountdown);
    enemy.armor += Math.round(enemy.maxHp * 0.06);
    this.state.combat.flashMessage = `PHASE ${nextPhase}`;
    this.state.combat.flashUntil = Date.now() + 1000;
    this.log(`<strong>${enemy.name}</strong> переходит в фазу ${nextPhase}.`, "system");
    this.beep(130 + nextPhase * 35, 0.14, "sawtooth", 0.025);
  },

  inverseDirection(direction) {
    const map = { U: "D", D: "U", L: "R", R: "L", UL: "DR", UR: "DL", DL: "UR", DR: "UL" };
    return map[direction] || direction;
  },

  forceBlankMove(direction) {
    const combat = this.state.combat;
    const blank = combat.board.indexOf(0);
    const deltas = { U: -4, D: 4, L: -1, R: 1, UL: -5, UR: -3, DL: 3, DR: 5 };
    const target = blank + (deltas[direction] || 0);
    if (target < 0 || target >= 16) return false;
    const blankRow = Math.floor(blank / 4);
    const blankCol = blank % 4;
    const targetRow = Math.floor(target / 4);
    const targetCol = target % 4;
    if (Math.abs(blankRow - targetRow) > 1 || Math.abs(blankCol - targetCol) > 1) return false;
    [combat.board[blank], combat.board[target]] = [combat.board[target], combat.board[blank]];
    return true;
  },

  disruptCorrectTile() {
    const combat = this.state.combat;
    const blank = combat.board.indexOf(0);
    let candidates = this.orthogonalNeighbors(blank).filter((index) => combat.board[index] === index + 1 && this.tileState(combat.board[index]).protected <= 0);
    if (!candidates.length) candidates = this.orthogonalNeighbors(blank).filter((index) => this.tileState(combat.board[index]).protected <= 0);
    const target = this.pick(candidates);
    if (target === undefined) return;
    const value = combat.board[target];
    [combat.board[blank], combat.board[target]] = [combat.board[target], combat.board[blank]];
    this.log(`RIOT-протокол выбивает плитку ${value}.`, "damage");
  },

  pickMovableValue() {
    const combat = this.state.combat;
    const values = combat.board.filter((value) => value && this.tileState(value).protected <= 0);
    return this.pick(values);
  },

  applyTileDebuff(value, key, duration, source = "") {
    const combat = this.state.combat;
    const status = this.tileState(value);
    if (status.protected > 0) {
      this.log(`ANCHOR на плитке ${value} блокирует ${key.toUpperCase()}.`, "success");
      return false;
    }
    if (combat.corruptionShield > 0 && ["corrupted", "locked"].includes(key)) {
      combat.corruptionShield -= 1;
      this.log(`CHROME MEMORY отменяет вмешательство ${source}.`, "success");
      return false;
    }
    status[key] = Math.max(status[key] || 0, duration);
    this.log(`${source || "Противник"}: плитка ${value} получает ${key.toUpperCase()} (${duration}).`, "damage");
    return true;
  },

  damageEnemy(enemy, amount, options = {}) {
    if (!enemy || enemy.hp <= 0 || amount <= 0) return 0;
    let raw = Math.max(0, Math.round(amount));
    const pierce = clamp(options.pierce || 0, 0, 1);
    const armorEligible = Math.round(raw * (1 - pierce));
    const piercingPart = raw - armorEligible;
    const absorbed = options.bypassArmor ? 0 : Math.min(enemy.armor, armorEligible);
    enemy.armor = Math.max(0, enemy.armor - absorbed);
    const dealt = Math.max(0, armorEligible - absorbed + piercingPart);
    enemy.hp -= dealt;
    if (!options.silent) this.log(`${options.source || "Атака"} → ${enemy.name}: <strong>${dealt}</strong> урона${absorbed ? `, ${absorbed} поглощено` : ""}.`, "success");
    this.updateBossPhase(enemy);

    if (enemy.hp <= 0) {
      if (enemy.mutations.includes("recursive") && !enemy.revived) {
        enemy.revived = true;
        enemy.hp = Math.max(1, Math.round(enemy.maxHp * 0.35));
        enemy.armor = Math.round(enemy.maxHp * 0.08);
        this.log(`${enemy.name} [RECURSIVE] возвращается из NULL.`, "damage");
      } else {
        enemy.hp = 0;
        this.state.run.kills += 1;
        this.state.run.score += 45 + this.state.run.floor * 12 + (enemy.elite ? 40 : 0) + (enemy.boss ? 220 : 0);
        if (this.hasRelic("blood_cache")) this.healPlayer(3, false);
        this.log(`${enemy.name} уничтожен.`, "system");
        if (this.state.combat.targetId === enemy.uid) {
          this.state.combat.targetId = this.state.combat.enemies.find((entry) => entry.hp > 0)?.uid || null;
        }
      }
    }
    this.checkCombatEnd();
    return dealt;
  },

  damageAllEnemies(amount, options = {}) {
    const alive = this.state.combat.enemies.filter((enemy) => enemy.hp > 0);
    for (const enemy of alive) {
      if (this.state.combat.pendingEnd) break;
      this.damageEnemy(enemy, amount, { ...options, silent: options.silent });
    }
  },

  damagePlayer(amount, source = "Урон", attacker = null, options = {}) {
    const run = this.state.run;
    if (!run || amount <= 0) return 0;
    let raw = Math.max(0, Math.round(amount));
    const pierce = clamp(options.pierceArmor || 0, 0, 1);
    const armorEligible = Math.round(raw * (1 - pierce));
    const piercingPart = raw - armorEligible;
    const absorbed = options.bypassArmor ? 0 : Math.min(run.armor, armorEligible);
    run.armor = Math.max(0, run.armor - absorbed);
    const dealt = Math.max(0, armorEligible - absorbed + piercingPart);
    const previousHp = run.hp;
    run.hp -= dealt;
    if (options.allowDeath === false) run.hp = Math.max(1, run.hp);
    if (this.state.combat) this.log(`${source} → носитель: <strong>${dealt}</strong> урона${absorbed ? `, ${absorbed} блокировано` : ""}.`, "damage");

    if (this.hero().id === "mora" && this.state.combat && !this.state.combat.restorePointUsed && !this.state.combat.restorePoint && previousHp > run.maxHp * 0.5 && run.hp <= run.maxHp * 0.5) {
      this.createRestorePoint();
    }

    if (this.state.combat?.counterDamage > 0 && attacker?.hp > 0) {
      const counter = this.state.combat.counterDamage;
      this.state.combat.counterDamage = 0;
      this.damageEnemy(attacker, counter, { source: "RIPOSTE", pierce: 0.4 });
    }

    if (run.hp <= 0 && options.allowDeath !== false) {
      if (run.floor === 1 && run.tutorial?.enabled) {
        run.tutorial.recoveries = (run.tutorial.recoveries || 0) + 1;
        run.hp = Math.max(1, Math.ceil(run.maxHp * 0.38));
        run.armor = Math.max(run.armor, 12);
        this.state.combat?.enemies?.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
          enemy.countdown = Math.max(enemy.countdown, 3);
        });
        this.log("TRAINING RESTORE возвращает носителя в бой: 38% HP и 12 ARMOR.", "system");
        this.toast("TRAINING RESTORE: обучение продолжается.", "success");
      } else if (this.hasRelic("last_packet") && !run.revived) {
        run.revived = true;
        run.hp = Math.max(1, Math.round(run.maxHp * 0.25));
        run.armor = 10;
        this.log("LAST PACKET предотвращает разрыв соединения.", "system");
        this.toast("LAST PACKET: аварийное восстановление.", "success");
      } else {
        run.hp = 0;
        if (this.state.combat) this.state.combat.pendingEnd = true;
        this.state.screen = "gameover";
        this.clearSave();
        this.render();
      }
    }
    return dealt;
  },

  healPlayer(amount, writeLog = true) {
    const run = this.state.run;
    if (!run || amount <= 0) return 0;
    const previous = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + Math.round(amount));
    const healed = run.hp - previous;
    if (writeLog && healed > 0 && this.state.combat) this.log(`PATCH: восстановлено <strong>${healed}</strong> HP.`, "success");
    return healed;
  },

  gainArmor(amount, writeLog = true) {
    const value = Math.max(0, Math.round(amount));
    this.state.run.armor += value;
    if (writeLog && value > 0 && this.state.combat) this.log(`AEGIS: +${value} ARMOR.`, "success");
    return value;
  },

  gainEnergy(amount, writeLog = true) {
    const run = this.state.run;
    const previous = run.energy;
    run.energy = Math.min(run.maxEnergy, run.energy + amount);
    const gained = run.energy - previous;
    if (writeLog && gained > 0 && this.state.combat) this.log(`NULL ENERGY +${Math.floor(gained)}.`, "success");
    return gained;
  },

  cleanseTileStates(limit = Infinity, writeLog = true) {
    const combat = this.state.combat;
    if (!combat) return 0;
    let removed = 0;
    for (const value of Object.keys(combat.tileStatus)) {
      const status = combat.tileStatus[value];
      for (const key of ["locked", "corrupted", "marked", "entropy"]) {
        if (status[key] > 0 && removed < limit) {
          status[key] = 0;
          removed += 1;
        }
      }
      if (removed >= limit) break;
    }
    if (removed > 0 && this.hero().id === "hex" && !combat.exploitUsed) {
      combat.exploitUsed = true;
      this.gainEnergy(2, false);
      if (writeLog) this.log("EXPLOIT: первое очищение возвращает 2 NULL.", "success");
    }
    if (writeLog && removed > 0) this.log(`Очищено состояний поля: ${removed}.`, "success");
    return removed;
  },

  createRestorePoint() {
    const combat = this.state.combat;
    if (!combat || combat.restorePointUsed || combat.restorePoint) return;
    combat.restorePoint = {
      board: [...combat.board],
      hp: this.state.run.hp,
      energy: this.state.run.energy,
      armor: this.state.run.armor,
      tileStatus: deepClone(combat.tileStatus),
    };
    this.log("RESTORE POINT сохранён при критическом уровне HP.", "system");
  },

  forceUsefulMoves(count = 1) {
    const combat = this.state.combat;
    let moved = 0;
    for (let step = 0; step < count; step += 1) {
      const blank = combat.board.indexOf(0);
      const candidates = this.orthogonalNeighbors(blank).filter((index) => this.tileState(combat.board[index]).locked <= 0);
      if (!candidates.length) break;
      const currentDistance = this.boardDistance(combat.board);
      let best = candidates[0];
      let bestScore = -Infinity;
      for (const index of candidates) {
        const copy = [...combat.board];
        [copy[blank], copy[index]] = [copy[index], copy[blank]];
        const score = (this.correctCount(copy) - this.correctCount(combat.board)) * 8 + (currentDistance - this.boardDistance(copy)) + this.random() * 0.2;
        if (score > bestScore) {
          bestScore = score;
          best = index;
        }
      }
      [combat.board[blank], combat.board[best]] = [combat.board[best], combat.board[blank]];
      moved += 1;
    }
    combat.blankPath = [combat.board.indexOf(0)];
    combat.pathTiles = [];
    return moved;
  },

  scrambleCurrentBoard(steps = 18, preserveStatuses = true) {
    const combat = this.state.combat;
    let previousBlank = -1;
    for (let step = 0; step < steps; step += 1) {
      const blank = combat.board.indexOf(0);
      let choices = this.orthogonalNeighbors(blank).filter((index) => index !== previousBlank);
      if (!choices.length) choices = this.orthogonalNeighbors(blank);
      const target = this.pick(choices);
      previousBlank = blank;
      [combat.board[blank], combat.board[target]] = [combat.board[target], combat.board[blank]];
    }
    if (!preserveStatuses) combat.tileStatus = {};
  },

  checkCombatEnd() {
    const combat = this.state.combat;
    if (!combat || combat.pendingEnd) return false;
    if (combat.enemies.some((enemy) => enemy.hp > 0)) return false;
    combat.pendingEnd = true;
    this.completeCombat();
    return true;
  },

  completeCombat() {
    const combat = this.state.combat;
    const run = this.state.run;
    this.tutorialEvent("combat_completed", { roomType: combat.roomType, stage: run.stage, floor: run.floor });
    const isBoss = combat.roomType === "boss";
    if (isBoss) run.bossesDefeated += 1;
    const baseCredits = this.randomInt(12, 22) + run.floor * 3 + (combat.roomType === "elite" ? 18 : isBoss ? 35 : 0);
    const creditMultiplier = this.hasRelic("black_coin") && run.heat >= 30 ? 1.5 : 1;
    run.credits += Math.round(baseCredits * creditMultiplier);
    run.score += Math.max(0, 80 + run.floor * 25 - combat.totalMoves * 0.7);
    run.energy = Math.min(run.maxEnergy, run.energy + 2);
    this.state.rewards = this.generateRewards(combat.roomType);
    this.state.screen = "reward";
    this.saveGame();
    this.render();
    this.beep(isBoss ? 920 : 720, isBoss ? 0.16 : 0.08, "triangle", 0.025);
  },
});

Object.assign(Game, {
  patternGroups(patternId) {
    const board = this.state.combat?.board || [];
    const groups = [];
    const add = (indices) => {
      const values = indices.map((index) => board[index]);
      if (values.every(Boolean)) groups.push(values);
    };

    if (patternId === "LINE" || patternId === "SEQUENCE") {
      const lines = [];
      for (let row = 0; row < 4; row += 1) lines.push([0, 1, 2, 3].map((col) => row * 4 + col));
      for (let col = 0; col < 4; col += 1) lines.push([0, 1, 2, 3].map((row) => row * 4 + col));
      for (const line of lines) {
        const windows = [line.slice(0, 3), line.slice(1, 4), line];
        for (const indices of windows) {
          const values = indices.map((index) => board[index]);
          if (!values.every(Boolean)) continue;
          if (patternId === "LINE") groups.push(values);
          else {
            const deltas = values.slice(1).map((value, index) => value - values[index]);
            if (deltas.every((delta) => delta === 1) || deltas.every((delta) => delta === -1)) groups.push(values);
          }
        }
      }
    }

    if (patternId === "MIRROR") {
      for (let index = 0; index < 16; index += 1) {
        for (const neighbor of this.orthogonalNeighbors(index)) {
          if (neighbor <= index) continue;
          const values = [board[index], board[neighbor]];
          if (values.every(Boolean) && values[0] + values[1] === 16) groups.push(values);
        }
      }
    }

    if (patternId === "QUAD") {
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) add([row * 4 + col, row * 4 + col + 1, (row + 1) * 4 + col, (row + 1) * 4 + col + 1]);
      }
    }

    if (patternId === "CROSS") {
      for (let row = 1; row < 3; row += 1) {
        for (let col = 1; col < 3; col += 1) {
          const center = row * 4 + col;
          add([center, center - 4, center + 4, center - 1, center + 1]);
        }
      }
    }

    if (patternId === "ORBIT" && this.hasClosedVoidLoop()) {
      const unique = [...new Set(this.state.combat.pathTiles.filter(Boolean))];
      if (unique.length >= 3) groups.push(unique);
    }

    if (patternId === "EDGE") {
      const perimeter = [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4];
      for (let start = 0; start < perimeter.length; start += 1) {
        const indices = [0, 1, 2].map((offset) => perimeter[(start + offset) % perimeter.length]);
        add(indices);
      }
    }

    if (patternId === "SOLVED") {
      const correctValues = board.filter((value, index) => value && value === index + 1);
      if (correctValues.length >= 3) groups.push(correctValues);
      for (let row = 0; row < 4; row += 1) {
        const indices = [0, 1, 2, 3].map((col) => row * 4 + col);
        if (indices.every((index) => board[index] && board[index] === index + 1)) add(indices);
      }
    }
    return groups;
  },

  protocolMatches(group, protocolId) {
    const faces = group.map((value) => this.faceForValue(value));
    const [white, black] = this.state.combat.dice;
    const flex = this.state.combat.protocolFlex > 0 ? 1 : 0;
    const close = (value, target) => Math.abs(value - target) <= flex;

    if (protocolId === "MATCH") {
      if (white === black) return faces.filter((face) => close(face, white)).length >= 2;
      return faces.some((face) => close(face, white)) && faces.some((face) => close(face, black));
    }

    for (let first = 0; first < faces.length; first += 1) {
      for (let second = first + 1; second < faces.length; second += 1) {
        if (protocolId === "SUM" && close(faces[first] + faces[second], white + black)) return true;
        if (protocolId === "GAP" && close(Math.abs(faces[first] - faces[second]), Math.abs(white - black))) return true;
      }
    }
    return false;
  },

  evaluateSelectedCombo() {
    const combat = this.state.combat;
    if (!combat) return { ready: false, reason: "Бой не активен", strength: 0, group: [] };
    const selection = combat.comboSelection;
    const groups = this.patternGroups(selection.pattern);
    if (!groups.length) {
      const pattern = PATTERNS.find((entry) => entry.id === selection.pattern);
      return { ready: false, reason: `Нет шаблона ${pattern?.label || selection.pattern}.`, strength: 0, group: [] };
    }
    const matching = groups.filter((group) => this.protocolMatches(group, selection.protocol));
    if (!matching.length) {
      const protocol = PROTOCOLS.find((entry) => entry.id === selection.protocol);
      return { ready: false, reason: `Шаблон есть, но не выполнен протокол «${protocol?.label || selection.protocol}».`, strength: 0, group: [] };
    }
    const group = matching.sort((a, b) => b.length - a.length)[0];
    let strength = clamp(1 + Math.floor((group.length - 2) / 2), 1, 4);
    if (selection.pattern === "SOLVED") strength += Math.min(2, Math.floor(this.correctCount() / 5));
    if (selection.pattern === "ORBIT") strength += 1;
    if (combat.eventHorizonMoves > 0) strength += 1;
    if (combat.forkBonus > 0) strength += combat.forkBonus;
    strength = clamp(strength, 1, 7);
    return { ready: true, reason: "Готово", strength, group };
  },

  activateCombo() {
    const combat = this.state.combat;
    const run = this.state.run;
    if (this.tileAnimationLocked) return;
    if (this.tutorialActionBlocked("combo")) return;
    if (!combat || combat.pendingEnd) return;
    const animationSnapshot = this.captureBoardAnimation();
    const key = this.comboKey();
    const evaluation = this.evaluateSelectedCombo();
    if (!evaluation.ready || run.energy < 2 || combat.usedCombos.includes(key)) return;

    run.energy -= 2;
    combat.usedCombos.push(key);
    run.comboCount += 1;
    combat.comboActivations += 1;
    let strength = evaluation.strength;
    combat.forkBonus = 0;
    let multiplier = 1;
    const effect = combat.comboSelection.effect;
    const attacking = ["CUT", "RAIL", "DRAIN"].includes(effect);

    if (attacking && combat.momentumReady) {
      multiplier *= 1.5;
      combat.momentumReady = false;
      this.log("VECTOR MOMENTUM усиливает комбинацию на 50%.", "success");
    }
    if (attacking && this.hasRelic("prime_skull") && evaluation.group.some((value) => PRIME_VALUES.has(value))) multiplier *= 1.2;

    const basePotency = 5 + strength * 4 + Math.floor(this.state.run.floor * 0.6);
    const comboName = this.comboName();
    this.log(`<strong>${comboName}</strong> активирован.`, "system");
    this.applyComboEffect(effect, basePotency * multiplier, evaluation, 1, comboName);
    this.tutorialEvent("combo_activated", { key, effect, stage: run.stage });
    if (combat.pendingEnd) return;

    if (combat.duplicateNextCombo > 0) {
      combat.duplicateNextCombo -= 1;
      this.log("AFTERIMAGE повторяет результат с 65% силы.", "success");
      this.applyComboEffect(effect, basePotency * multiplier, evaluation, 0.65, "AFTERIMAGE");
    }
    if (combat.pendingEnd) return;

    if (combat.doubleDown) {
      combat.doubleDownResolved = true;
      combat.doubleDown = false;
      this.log("DOUBLE DOWN удваивает комбинацию.", "success");
      this.applyComboEffect(effect, basePotency * multiplier, evaluation, 0.9, "DOUBLE DOWN");
    }
    if (combat.pendingEnd) return;

    if (this.hasRelic("recursive_lens") && combat.comboActivations % 3 === 0) {
      this.log("RECURSIVE LENS создаёт слабое эхо.", "success");
      this.applyComboEffect(effect, basePotency * multiplier, evaluation, 0.35, "RECURSIVE LENS");
    }

    combat.flashMessage = comboName;
    combat.flashUntil = Date.now() + 850;
    this.beep(520 + strength * 60, 0.07, "triangle", 0.02);
    if (!combat.pendingEnd) {
      this.saveGame();
      this.renderCombat(animationSnapshot);
    }
  },

  applyComboEffect(effect, potency, evaluation, scale = 1, source = "COMBO") {
    const amount = Math.max(1, Math.round(potency * scale));
    const target = this.targetEnemy();
    switch (effect) {
      case "CUT":
        if (target) this.damageEnemy(target, Math.round(amount * 1.25), { source, pierce: 0.25 });
        break;
      case "RAIL":
        this.damageAllEnemies(Math.round(amount * 0.72), { source, pierce: 0.38 });
        break;
      case "DRAIN":
        if (target) {
          const dealt = this.damageEnemy(target, amount, { source, pierce: 0.15 });
          this.healPlayer(Math.round(dealt * 0.45), true);
        }
        break;
      case "AEGIS":
        this.gainArmor(Math.round(amount * 1.2));
        break;
      case "RIPOSTE":
        this.gainArmor(Math.round(amount * 0.62));
        this.state.combat.counterDamage = Math.max(this.state.combat.counterDamage, Math.round(amount * 1.15));
        this.log(`RIPOSTE готов: ответный урон ${this.state.combat.counterDamage}.`, "success");
        break;
      case "JAM":
        this.state.combat.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
          enemy.countdown += 1 + Math.floor(evaluation.strength / 2);
          enemy.weakened = Math.max(enemy.weakened, 1);
        });
        if (target && evaluation.strength >= 3) target.stunned += 1;
        this.log("Вражеские таймеры задержаны.", "success");
        break;
      case "PATCH":
        this.healPlayer(amount, true);
        this.cleanseTileStates(Math.max(1, Math.ceil(evaluation.strength / 2)), true);
        break;
      case "REWRITE": {
        const moved = this.forceUsefulMoves(Math.max(1, Math.ceil(evaluation.strength / 2)));
        this.rollDice(false, false);
        this.log(`REWRITE выполняет ${moved} безопасных сдвига и обновляет кости.`, "success");
        break;
      }
      default:
        break;
    }
  },

  targetEnemy() {
    const combat = this.state.combat;
    let target = combat.enemies.find((enemy) => enemy.uid === combat.targetId && enemy.hp > 0);
    if (!target) {
      target = combat.enemies.find((enemy) => enemy.hp > 0) || null;
      combat.targetId = target?.uid || null;
    }
    return target;
  },

  scaleAbility(base, abilityId) {
    const level = this.state.run.abilityLevels[abilityId] || 0;
    return Math.round(base * (1 + level * 0.2));
  },

  useAbility(abilityId) {
    const combat = this.state.combat;
    const run = this.state.run;
    if (this.tileAnimationLocked) return;
    if (this.tutorialActionBlocked("ability")) return;
    if (!combat || combat.pendingEnd) return;
    const animationSnapshot = this.captureBoardAnimation();
    const ability = this.hero().abilities.find((entry) => entry.id === abilityId);
    if (!ability || run.energy < ability.cost || (combat.cooldowns[abilityId] || 0) > 0) return;

    run.energy -= ability.cost;
    combat.cooldowns[abilityId] = ability.cooldown;
    const success = this.executeAbility(abilityId);
    if (success === false) {
      run.energy += ability.cost;
      combat.cooldowns[abilityId] = 0;
      this.renderCombat();
      return;
    }
    this.log(`<strong>${ability.name}</strong> активирован.`, "system");
    this.tutorialEvent("ability_used", { abilityId, stage: run.stage });
    this.beep(410 + ability.cost * 55, 0.06, ability.ultimate ? "sawtooth" : "triangle", ability.ultimate ? 0.025 : 0.016);
    if (!combat.pendingEnd) {
      this.saveGame();
      this.renderCombat(animationSnapshot);
    }
  },

  executeAbility(id) {
    const combat = this.state.combat;
    const run = this.state.run;
    const target = this.targetEnemy();

    switch (id) {
      case "v_cutline": {
        const lineStrength = Math.max(1, this.patternGroups("LINE").length + this.patternGroups("SEQUENCE").length);
        this.damageEnemy(target, this.scaleAbility(12 + Math.min(6, lineStrength) * 3, id), { source: "CUTLINE", pierce: 0.32 });
        break;
      }
      case "v_rail": {
        const amount = this.scaleAbility(9 + this.completedLines() * 5 + Math.floor(this.correctCount() / 3), id);
        this.damageAllEnemies(amount, { source: "RAIL CASCADE", pierce: 0.48 });
        break;
      }
      case "v_blink":
        combat.freeMoves += this.scaleAbility(2, id);
        break;
      case "v_afterimage":
        combat.duplicateNextCombo += 1;
        break;
      case "v_ult":
        combat.blackVectorMoves = this.scaleAbility(8, id);
        combat.blackVectorTiles = [];
        break;

      case "b_lock": {
        let values = combat.board.filter((value, index) => value && value === index + 1);
        if (values.length < 2) values = combat.board.filter(Boolean);
        this.shuffle(values).slice(0, 2).forEach((value) => {
          this.tileState(value).protected = this.scaleAbility(6, id);
        });
        this.gainArmor(this.scaleAbility(14, id));
        break;
      }
      case "b_parry":
        this.gainArmor(this.scaleAbility(12, id));
        combat.counterDamage = Math.max(combat.counterDamage, this.scaleAbility(16, id));
        break;
      case "b_anchor":
        combat.corruptionShield += 1 + Math.floor((run.abilityLevels[id] || 0) / 2);
        if (combat.lastMovedValue) this.tileState(combat.lastMovedValue).protected = 6;
        break;
      case "b_fortress":
        this.gainArmor(this.scaleAbility(8 + this.correctCount() + this.completedLines() * 8, id));
        break;
      case "b_ult":
        combat.frozenIntents += this.scaleAbility(6, id);
        this.gainArmor(this.scaleAbility(18, id));
        break;

      case "h_bitflip":
        combat.bitflipMoves = this.scaleAbility(6, id);
        this.rollDice(false, false);
        break;
      case "h_fork":
        combat.forkBonus = Math.max(combat.forkBonus, this.scaleAbility(2, id));
        break;
      case "h_bomb":
        if (!target) return false;
        target.poison = Math.max(target.poison, this.scaleAbility(7, id));
        target.poisonTurns = Math.max(target.poisonTurns, 3);
        break;
      case "h_purge": {
        const removed = this.cleanseTileStates(Infinity, true);
        if (target) this.damageEnemy(target, this.scaleAbility(6 + removed * 5, id), { source: "ROOT PURGE", pierce: 0.25 });
        break;
      }
      case "h_ult":
        combat.dice = combat.dice.map((value) => 7 - value);
        combat.eventHorizonMoves = Math.max(combat.eventHorizonMoves, this.scaleAbility(6, id));
        for (const enemy of combat.enemies.filter((entry) => entry.hp > 0 && entry.poison > 0)) {
          this.damageEnemy(enemy, enemy.poison * 2, { source: "KERNEL PANIC", pierce: 0.5 });
          if (combat.pendingEnd) break;
        }
        break;

      case "c_loaded":
        combat.dice[0] = this.faceForValue(combat.lastMovedValue || 6);
        break;
      case "c_split":
        combat.protocolFlex = Math.max(combat.protocolFlex, this.scaleAbility(7, id));
        break;
      case "c_double":
        combat.doubleDown = true;
        combat.doubleDownResolved = false;
        break;
      case "c_snake":
        combat.dice = [1, 1];
        combat.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => { enemy.stunned += 1; });
        break;
      case "c_ult": {
        const rolls = [this.randomInt(1, 6), this.randomInt(1, 6), this.randomInt(1, 6)].sort((a, b) => b - a);
        combat.dice = rolls.slice(0, 2);
        const bonus = this.scaleAbility(rolls[2] * 3, id);
        this.damageAllEnemies(bonus, { source: "ALL IN", pierce: 0.25 });
        run.luck += 1;
        break;
      }

      case "m_patch": {
        const amount = this.hasClosedVoidLoop() ? this.scaleAbility(24, id) : this.scaleAbility(11, id);
        this.healPlayer(amount, true);
        this.cleanseTileStates(1, true);
        break;
      }
      case "m_checksum": {
        const removed = this.cleanseTileStates(2 + (run.abilityLevels[id] || 0), true);
        this.gainArmor(this.scaleAbility(8 + removed * 4, id));
        break;
      }
      case "m_rollback": {
        if (!combat.boardHistory.length) {
          this.toast("ROLLBACK: история поля пока пуста.", "error");
          return false;
        }
        const index = Math.max(0, combat.boardHistory.length - 4);
        combat.board = [...combat.boardHistory[index]];
        combat.boardHistory = combat.boardHistory.slice(0, index);
        combat.blankPath = [combat.board.indexOf(0)];
        combat.pathTiles = [];
        break;
      }
      case "m_defrag": {
        let removed = 0;
        Object.values(combat.tileStatus).forEach((status) => {
          if (status.corrupted > 0) {
            status.corrupted = 0;
            removed += 1;
          }
        });
        this.gainArmor(this.scaleAbility(8 + removed * 5, id));
        break;
      }
      case "m_ult":
        if (combat.restorePoint) {
          combat.board = [...combat.restorePoint.board];
          combat.tileStatus = deepClone(combat.restorePoint.tileStatus);
          run.hp = Math.max(run.hp, combat.restorePoint.hp);
          run.energy = Math.max(run.energy, combat.restorePoint.energy);
          run.armor += combat.restorePoint.armor;
          combat.restorePoint = null;
          combat.restorePointUsed = true;
          combat.blankPath = [combat.board.indexOf(0)];
          combat.pathTiles = [];
        } else {
          this.healPlayer(this.scaleAbility(Math.ceil(run.maxHp * 0.45), id), true);
          this.forceUsefulMoves(2);
          combat.restorePointUsed = true;
        }
        break;

      case "n_voidstep": {
        const moved = this.forceUsefulMoves(this.scaleAbility(3, id));
        if (!moved) return false;
        break;
      }
      case "n_consume": {
        const blank = combat.board.indexOf(0);
        const values = this.phaseNeighbors(blank).map((index) => combat.board[index]).filter(Boolean);
        let removed = 0;
        values.forEach((value) => {
          const status = this.tileState(value);
          for (const key of ["locked", "corrupted", "marked", "entropy"]) {
            if (status[key] > 0) {
              status[key] = 0;
              removed += 1;
            }
          }
        });
        this.gainEnergy(Math.min(4, removed + 1), true);
        break;
      }
      case "n_horizon":
        combat.eventHorizonMoves = Math.max(combat.eventHorizonMoves, this.scaleAbility(6, id));
        break;
      case "n_second":
        combat.phaseMoves = Math.max(combat.phaseMoves, this.scaleAbility(4, id));
        break;
      case "n_ult":
        combat.zeroTraceMoves = this.scaleAbility(10, id);
        combat.blankPath = [combat.board.indexOf(0)];
        combat.pathTiles = [];
        break;
      default:
        return false;
    }
    return true;
  },
});

Object.assign(Game, {
  generateRewards(roomType) {
    const pool = ["credits", "heal", "maxhp", "energy", "cool", "armor", "upgrade", "relic"];
    const rewards = [];
    if (roomType === "boss") rewards.push(this.makeReward("relic"));
    if (roomType === "elite" && this.random() < 0.65) rewards.push(this.makeReward("relic"));
    while (rewards.length < 3) {
      const type = this.pick(pool);
      if (rewards.some((reward) => reward.type === type) && !["credits", "heal"].includes(type)) continue;
      rewards.push(this.makeReward(type));
    }
    return rewards.slice(0, 3);
  },

  makeReward(type) {
    const run = this.state.run;
    if (type === "credits") {
      const amount = this.randomInt(24, 42) + run.floor * 2;
      return { type, title: `${amount} CREDITS`, desc: "Добавить кредиты для BLACK MARKET.", value: amount, rarity: "RESOURCE" };
    }
    if (type === "heal") {
      const amount = Math.ceil(run.maxHp * 0.24);
      return { type, title: `PATCH +${amount}`, desc: "Восстановить часть корпуса прямо сейчас.", value: amount, rarity: "RECOVERY" };
    }
    if (type === "maxhp") return { type, title: "CHROME FRAME", desc: "+7 к максимальному HP и немедленное лечение на 7.", value: 7, rarity: "CORE UPGRADE" };
    if (type === "energy") return { type, title: "NULL CAPACITOR", desc: "+1 к максимуму энергии и заполнение нового слота.", value: 1, rarity: "CORE UPGRADE" };
    if (type === "cool") return { type, title: "COLD TRACE", desc: "Снизить HEAT на 12 и получить 40 очков.", value: 12, rarity: "UTILITY" };
    if (type === "armor") return { type, title: "STATIC WARD", desc: "Получить 16 ARMOR, сохраняемых до получения урона.", value: 16, rarity: "DEFENCE" };
    if (type === "upgrade") {
      const ability = this.pick(this.hero().abilities);
      return { type, title: ability.name, desc: `Улучшить способность: ${ability.desc}`, abilityId: ability.id, rarity: "PROTOCOL" };
    }
    if (type === "relic") {
      const relic = this.randomAvailableRelic();
      if (!relic) return this.makeReward("credits");
      return { type, title: relic.name, desc: relic.desc, relicId: relic.id, rarity: "RELIC" };
    }
    return this.makeReward("credits");
  },

  renderReward() {
    const rewards = this.state.rewards;
    const roomType = this.state.currentRoom?.type || "combat";
    if (!rewards?.length) {
      this.state.rewards = this.generateRewards(roomType);
      return this.renderReward();
    }
    const roomName = ROOM_DEFS[roomType]?.name || "COMBAT";
    this.screenEl.innerHTML = `
      <section class="reward-screen">
        <div class="panel event-box">
          <div class="event-icon">✓</div>
          <p class="eyebrow">${roomName} // CLEARED</p>
          <h2>Выберите один фрагмент</h2>
          <p class="event-copy">Кредиты за бой уже добавлены. Из трёх дополнительных наград можно забрать только одну.</p>
          <div class="reward-grid">
            ${rewards.map((reward, index) => `
              <button class="reward-card" data-reward-index="${index}" type="button">
                <span><span class="reward-rarity">${reward.rarity}</span><h3>${reward.title}</h3></span>
                <p>${reward.desc}</p>
                <span class="terminal-code">ACQUIRE</span>
              </button>
            `).join("")}
          </div>
        </div>
      </section>
    `;
    $$('[data-reward-index]', this.screenEl).forEach((button) => {
      button.addEventListener("click", () => this.chooseReward(Number(button.dataset.rewardIndex)));
    });
  },

  chooseReward(index) {
    const reward = this.state.rewards?.[index];
    if (!reward) return;
    const run = this.state.run;
    this.tutorialEvent("reward_chosen", { index, rewardType: reward.type, stage: run.stage, roomType: this.state.currentRoom?.type });
    switch (reward.type) {
      case "credits":
        run.credits += reward.value;
        break;
      case "heal":
        this.healPlayer(reward.value, false);
        break;
      case "maxhp":
        run.maxHp += reward.value;
        run.hp = Math.min(run.maxHp, run.hp + reward.value);
        break;
      case "energy":
        run.maxEnergy += reward.value;
        run.energy = Math.min(run.maxEnergy, run.energy + reward.value);
        break;
      case "cool":
        run.heat = Math.max(0, run.heat - reward.value);
        run.score += 40;
        break;
      case "armor":
        run.armor += reward.value;
        break;
      case "upgrade":
        run.abilityLevels[reward.abilityId] = (run.abilityLevels[reward.abilityId] || 0) + 1;
        break;
      case "relic":
        this.addRelic(reward.relicId);
        break;
      default:
        break;
    }
    this.toast(`${reward.title} получено.`, "success");
    this.finishRoom();
  },

  openCodex(section = "overview") {
    const heroesHTML = HEROES.map((hero) => `
      <div class="codex-section">
        <h3>${hero.name}</h3>
        <p><strong>${hero.passive.name}:</strong> ${hero.passive.desc}</p>
        <ul>${hero.abilities.map((ability) => `<li><strong>${ability.name}</strong> — ${ability.desc}</li>`).join("")}</ul>
      </div>
    `).join("");
    const patterns = PATTERNS.map((entry) => `<li><strong>${entry.name}</strong> — ${entry.desc}</li>`).join("");
    const effects = EFFECTS.map((entry) => `<li><strong>${entry.name}</strong> — ${entry.label}</li>`).join("");
    const protocols = PROTOCOLS.map((entry) => `<li><strong>${entry.name}</strong> — ${entry.desc}</li>`).join("");
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="codexTitle">
          <div class="modal-header"><h2 id="codexTitle">NULL//CODEX</h2><button class="icon-button" data-close-modal type="button">×</button></div>
          <div class="modal-body">
            <div class="codex-grid">
              <div class="codex-section">
                <h3>Основной цикл</h3>
                <p>Переместите соседнюю с VOID плитку. Каждый обычный сдвиг уменьшает таймеры намерений. После ${this.state.combat?.maxMoves || 6} сдвигов начинается новый цикл и перебрасываются кости.</p>
                <p>Полностью собранное поле запускает ZERO STATE: массовый урон, лечение и новая решаемая перестановка.</p>
              </div>
              <div class="codex-section">
                <h3>Управление</h3>
                <ul>
                  <li>WASD / стрелки — двигать VOID.</li>
                  <li>Клик по подсвеченной плитке — сдвиг.</li>
                  <li>1–5 — способности героя.</li>
                  <li>Space — выбранная комбинация.</li>
                  <li>R — ручной переброс за 1 NULL.</li>
                  <li>I — открыть инвентарь забега.</li>
                  <li>Esc — пауза или закрытие окна.</li>
                </ul>
              </div>
              <div class="codex-section">
                <h3>192 комбинации</h3>
                <p><strong>8 шаблонов × 8 эффектов × 3 протокола = 192.</strong> Выберите по одному модулю в боевом конструкторе.</p>
                <ul>${patterns}</ul>
              </div>
              <div class="codex-section">
                <h3>Эффекты и кости</h3>
                <ul>${effects}</ul>
                <ul>${protocols}</ul>
              </div>
              <div class="codex-section">
                <h3>Противники</h3>
                <p>В игре 12 базовых противников: по три дальника, ближника, мага и саппорта. На высоких этажах они получают CHROME, ECHO, NULLBORN, LOADED, FERAL и RECURSIVE.</p>
                <ul>${ENEMY_DEFS.map((enemy) => `<li><strong>${enemy.name}</strong> [${enemy.archetype}] — ${enemy.intent}</li>`).join("")}</ul>
              </div>
              <div class="codex-section">
                <h3>Три босса</h3>
                <ul>
                  <li><strong>THE EMPTY KING</strong> — метит углы и вмешивается в VOID.</li>
                  <li><strong>ORACLE OF SIX</strong> — объявляет грань-пророчество и переписывает броски.</li>
                  <li><strong>THE INFINITY ENGINE</strong> — повторяет последние направления ваших ходов.</li>
                </ul>
              </div>
            </div>
            <h3 style="margin-top:22px">36 способностей персонажей</h3>
            <div class="codex-grid">${heroesHTML}</div>
          </div>
        </section>
      </div>
    `;
    this.bindModalClose();
    requestAnimationFrame(() => $("[data-close-modal]", this.modalRoot)?.focus());
  },

  openPauseMenu() {
    if (!this.state.run) return;
    const run = this.state.run;
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" style="width:min(520px,100%)" role="dialog" aria-modal="true" aria-labelledby="pauseTitle">
          <div class="modal-header"><h2 id="pauseTitle">SYSTEM MENU</h2><button class="icon-button" data-close-modal type="button">×</button></div>
          <div class="modal-body">
            <div class="run-list" style="margin-bottom:14px">
              <div class="run-list-item"><span>Seed</span><strong>${escapeHTML(run.seed)}</strong></div>
              <div class="run-list-item"><span>Этаж / узел</span><strong>${run.floor} / ${run.stage + 1}</strong></div>
              <div class="run-list-item"><span>Счёт</span><strong>${Math.floor(run.score)}</strong></div>
            </div>
            <div class="pause-actions">
              <button class="primary-button" data-close-modal type="button">Вернуться в игру</button>
              <button id="saveAndTitleButton" class="secondary-button" type="button">Сохранить и выйти в меню</button>
              <button id="pauseCodexButton" class="secondary-button" type="button">Открыть кодекс</button>
              <button id="abandonRunButton" class="danger-button" type="button">Завершить забег</button>
            </div>
          </div>
        </section>
      </div>
    `;
    this.bindModalClose();
    $("#saveAndTitleButton", this.modalRoot).addEventListener("click", () => {
      this.saveGame();
      this.closeModal();
      this.state.screen = "title";
      this.state.run = null;
      this.state.combat = null;
      this.state.currentRoom = null;
      this.state.rewards = null;
      this.render();
      this.toast("Забег сохранён.", "success");
    });
    $("#pauseCodexButton", this.modalRoot).addEventListener("click", () => this.openCodex());
    $("#abandonRunButton", this.modalRoot).addEventListener("click", () => {
      const confirmed = window.confirm("Завершить текущий забег и удалить сохранение?");
      if (!confirmed) return;
      this.clearSave();
      this.goToTitle();
    });
  },

  bindModalClose() {
    $$('[data-close-modal]', this.modalRoot).forEach((button) => button.addEventListener("click", () => this.closeModal()));
    $(".modal-backdrop", this.modalRoot)?.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-backdrop")) this.closeModal();
    });
  },

  closeModal() {
    this.modalRoot.innerHTML = "";
  },

  handleKeydown(event) {
    if (this.modalRoot.innerHTML) {
      if (event.key === "Escape") this.closeModal();
      return;
    }
    const tag = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;

    if (event.key === "Escape") {
      if (this.state.run) this.openPauseMenu();
      return;
    }
    if ((event.key === "i" || event.key === "I") && this.state.run) {
      event.preventDefault();
      this.openInventory();
      return;
    }
    if (this.state.screen !== "combat" || !this.state.combat || this.state.combat.pendingEnd) return;

    const directionKeys = {
      ArrowUp: -4,
      w: -4,
      W: -4,
      ArrowDown: 4,
      s: 4,
      S: 4,
      ArrowLeft: -1,
      a: -1,
      A: -1,
      ArrowRight: 1,
      d: 1,
      D: 1,
    };
    if (Object.hasOwn(directionKeys, event.key)) {
      event.preventDefault();
      const blank = this.state.combat.board.indexOf(0);
      const target = blank + directionKeys[event.key];
      if (target >= 0 && target < 16) {
        const blankRow = Math.floor(blank / 4);
        const targetRow = Math.floor(target / 4);
        if (Math.abs(blankRow - targetRow) <= 1) this.moveTile(target);
      }
      return;
    }
    if (/^[1-5]$/.test(event.key)) {
      const ability = this.hero().abilities[Number(event.key) - 1];
      if (ability) this.useAbility(ability.id);
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      this.activateCombo();
      return;
    }
    if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      this.manualReroll();
    }
  },

  toast(message, type = "") {
    const element = document.createElement("div");
    element.className = `toast ${type}`;
    element.textContent = message;
    this.toastRoot.append(element);
    window.setTimeout(() => element.remove(), 2800);
  },
});


Object.assign(Game, {
  openInventory() {
    const run = this.state.run;
    if (!run) return;
    const hero = this.hero();
    const relicSlots = Array.from({ length: Math.max(3, run.relics.length) }, (_, index) => {
      const relic = RELICS.find((entry) => entry.id === run.relics[index]);
      if (!relic) return `<div class="inventory-slot"><strong>EMPTY SLOT</strong><p>Реликвию можно получить после боя, в сокровищнице или у торговца.</p></div>`;
      return `<div class="inventory-slot filled"><strong>${relic.name}</strong><p>${relic.desc}</p></div>`;
    }).join("");
    const abilityRows = hero.abilities.map((ability, index) => {
      const level = run.abilityLevels[ability.id] || 0;
      return `
        <div class="inventory-ability">
          <div><strong>${index + 1}. ${ability.name}</strong><p>${ability.desc}</p></div>
          <span class="inventory-level">LVL ${level}${level ? ` · +${level * 20}%` : ""}</span>
        </div>
      `;
    }).join("");
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section id="inventoryModal" class="modal inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventoryTitle">
          <div class="modal-header"><h2 id="inventoryTitle">RUN//INVENTORY</h2><button class="icon-button" data-close-modal type="button">×</button></div>
          <div class="modal-body">
            <div class="inventory-overview">
              <section class="inventory-identity">
                <div class="inventory-identity-head"><div class="hero-glyph">${hero.glyph}</div><div><span class="character-role">${hero.role}</span><h3 style="margin:2px 0 0">${hero.name}</h3></div></div>
                <p class="inventory-note"><strong style="color:var(--cyan)">${hero.passive.name}</strong><br>${hero.passive.desc}</p>
                <div class="inventory-resources">
                  <div class="inventory-resource"><span>HP</span><strong>${Math.ceil(run.hp)}/${run.maxHp}</strong></div>
                  <div class="inventory-resource"><span>ARMOR</span><strong>${Math.ceil(run.armor)}</strong></div>
                  <div class="inventory-resource"><span>NULL</span><strong>${Math.floor(run.energy)}/${run.maxEnergy}</strong></div>
                  <div class="inventory-resource"><span>CREDITS</span><strong>${run.credits} ₡</strong></div>
                  <div class="inventory-resource"><span>HEAT</span><strong>${run.heat}</strong></div>
                  <div class="inventory-resource"><span>LUCK</span><strong>${run.luck}</strong></div>
                  <div class="inventory-resource"><span>ORDER</span><strong>${run.order}</strong></div>
                  <div class="inventory-resource"><span>SCORE</span><strong>${Math.floor(run.score)}</strong></div>
                </div>
                <p class="inventory-note">Клавиша <strong>I</strong> открывает инвентарь. Ресурсы, реликвии и улучшения сохраняются между комнатами текущего забега.</p>
              </section>
              <div class="inventory-content">
                <section class="inventory-section"><h3>Relic slots</h3><div class="inventory-slot-grid">${relicSlots}</div></section>
                <section class="inventory-section"><h3>Ability firmware</h3><div class="inventory-ability-list">${abilityRows}</div></section>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
    this.bindModalClose();
    this.tutorialEvent("inventory_opened", { screen: this.state.screen });
    requestAnimationFrame(() => this.scheduleTutorial());
  },

  tutorialState() {
    return this.state.run?.tutorial || null;
  },

  tutorialStep() {
    const tutorial = this.tutorialState();
    return tutorial?.enabled && tutorial.step ? TUTORIAL_BY_ID[tutorial.step] || null : null;
  },

  tutorialStepIs(id) {
    return this.tutorialStep()?.id === id;
  },

  tutorialActive() {
    const tutorial = this.tutorialState();
    return Boolean(tutorial?.enabled && !tutorial.completed && tutorial.step);
  },

  setTutorialStep(id) {
    const tutorial = this.tutorialState();
    if (!tutorial?.enabled) return;
    if (!id) {
      tutorial.enabled = false;
      tutorial.completed = true;
      tutorial.step = null;
      tutorial.enteredStep = null;
      this.state.settings.tutorialCompleted = true;
      this.saveSettings();
      this.tutorialRoot.innerHTML = "";
      this.saveGame();
      return;
    }
    tutorial.step = id;
    if (tutorial.enteredStep !== id) {
      tutorial.enteredStep = id;
      this.setupTutorialStep(TUTORIAL_BY_ID[id]);
    }
    this.saveGame();
    this.scheduleTutorial();
  },

  setupTutorialStep(step) {
    if (!step) return;
    if (step.onEnter === "prepareCombo") this.prepareTutorialCombo();
    if (step.onEnter === "softenEnemy") this.softenTutorialEnemy();
    if (step.onEnter === "practiceAid" && this.state.run) {
      this.state.run.energy = Math.max(this.state.run.energy, Math.min(this.state.run.maxEnergy, 4));
      this.state.run.armor += 4;
      this.toast("Учебный протокол: способности заряжены.", "success");
    }
    if (step.onEnter === "eliteAid" && this.state.run) {
      this.state.run.armor += 10;
      this.state.run.energy = Math.max(this.state.run.energy, Math.min(this.state.run.maxEnergy, 4));
      this.toast("Учебный протокол: +10 ARMOR.", "success");
    }
  },

  advanceTutorial() {
    const step = this.tutorialStep();
    if (!step || step.completeOn) return;
    if (step.onNext === "closeInventory") {
      this.suppressTutorialModalReset = true;
      this.closeModal();
      this.suppressTutorialModalReset = false;
    }
    const nextStep = TUTORIAL_BY_ID[step.next];
    this.setTutorialStep(step.next);
    if (nextStep?.onEnter && this.state.screen === "combat" && this.state.combat) this.renderCombat();
  },

  tutorialEvent(name, payload = {}) {
    const tutorial = this.tutorialState();
    if (!tutorial?.enabled || tutorial.completed) return;
    const step = this.tutorialStep();
    if (!step) return;

    const fallback = this.tutorialFallbackStep(name, payload);
    if (fallback) {
      this.setTutorialStep(fallback);
      return;
    }

    if (!this.matchesTutorialEvent(step.completeOn, name, payload)) return;
    this.setTutorialStep(step.next);
  },

  matchesTutorialEvent(rule, name, payload) {
    if (!rule || rule.name !== name) return false;
    for (const [key, expected] of Object.entries(rule)) {
      if (key === "name") continue;
      if (key === "actionPrefix") {
        if (!String(payload.action || "").startsWith(expected)) return false;
        continue;
      }
      if (payload[key] !== expected) return false;
    }
    return true;
  },

  tutorialFallbackStep(name, payload) {
    const tutorial = this.tutorialState();
    const currentIndex = TUTORIAL_STEPS.findIndex((entry) => entry.id === tutorial.step);
    const targetIndex = (id) => TUTORIAL_STEPS.findIndex((entry) => entry.id === id);
    const before = (id) => currentIndex >= 0 && currentIndex < targetIndex(id);

    if (name === "combat_completed" && payload.stage === 0 && before("reward_first")) return "reward_first";
    if (name === "reward_chosen" && payload.stage === 0 && before("map_upgrade")) return "map_upgrade";
    if (name === "event_action" && payload.group === "upgrade" && before("map_second_combat")) return "map_second_combat";
    if (name === "combat_completed" && payload.stage === 2 && before("reward_second")) return "reward_second";
    if (name === "reward_chosen" && payload.stage === 2 && before("map_merchant")) return "map_merchant";
    if (name === "event_action" && payload.action === "leave" && payload.roomType === "merchant" && before("map_treasure")) return "map_treasure";
    if (name === "event_action" && payload.group === "treasure" && before("map_elite")) return "map_elite";
    if (name === "combat_completed" && payload.stage === 5 && before("reward_elite")) return "reward_elite";
    if (name === "reward_chosen" && payload.stage === 5 && before("floor_complete")) return "floor_complete";
    return null;
  },

  tutorialActionBlocked(action) {
    if (this.tutorialStep()?.freePlay) return false;
    if (!this.tutorialActive() || this.state.run?.floor !== 1 || this.state.run?.stage !== 0 || this.state.screen !== "combat") return false;
    const id = this.tutorialStep()?.id;
    const allow = {
      tile: ["combat_move", "combat_finish"],
      ability: ["combat_ability", "combat_finish"],
      combo: ["combat_combo_activate", "combat_finish"],
      reroll: ["combat_finish"],
    };
    if (allow[action]?.includes(id)) return false;
    this.toast("Сначала выполните текущий шаг обучения.", "error");
    return true;
  },

  prepareTutorialCombo() {
    const combat = this.state.combat;
    const run = this.state.run;
    if (!combat || !run) return;
    run.energy = Math.max(run.energy, 2);
    const original = { ...combat.comboSelection };
    for (const pattern of PATTERNS) {
      for (const protocol of PROTOCOLS) {
        combat.comboSelection = { pattern: pattern.id, effect: "CUT", protocol: protocol.id };
        if (this.evaluateSelectedCombo().ready) return;
      }
    }
    const candidates = ["LINE", "QUAD", "EDGE"].flatMap((pattern) => this.patternGroups(pattern).map((group) => ({ pattern, group })));
    const candidate = candidates.find((entry) => entry.group.length >= 2);
    if (candidate) {
      combat.dice = [this.faceForValue(candidate.group[0]), this.faceForValue(candidate.group[1])];
      combat.comboSelection = { pattern: candidate.pattern, effect: "CUT", protocol: "MATCH" };
      return;
    }
    combat.comboSelection = original;
  },

  softenTutorialEnemy() {
    const combat = this.state.combat;
    if (!combat) return;
    const active = combat.enemies.filter((enemy) => enemy.hp > 0);
    active.forEach((enemy, index) => {
      enemy.hp = Math.min(enemy.hp, index === 0 ? 28 : 18);
      enemy.baseDamage = Math.min(enemy.baseDamage, 5);
      enemy.countdown = Math.max(enemy.countdown, 2);
    });
    if (this.state.run) {
      this.state.run.energy = Math.max(this.state.run.energy, Math.min(this.state.run.maxEnergy, 3));
      this.state.run.armor += 6;
    }
  },

  skipTutorial() {
    const tutorial = this.tutorialState();
    if (!tutorial) return;
    tutorial.enabled = false;
    tutorial.completed = true;
    tutorial.step = null;
    tutorial.enteredStep = null;
    this.tutorialRoot.innerHTML = "";
    this.saveGame();
    this.toast("Обучение пропущено. Кодекс доступен по кнопке ?.", "success");
  },

  scheduleTutorial() {
    if (!this.tutorialRoot) return;
    cancelAnimationFrame(this.tutorialFrame || 0);
    this.tutorialFrame = requestAnimationFrame(() => this.renderTutorial());
  },

  renderTutorial() {
    const step = this.tutorialStep();
    if (!step || !this.state.run || this.state.run.floor !== 1) {
      this.tutorialRoot.innerHTML = "";
      return;
    }
    if (this.modalRoot.innerHTML && step.id !== "inventory_details") {
      this.tutorialRoot.innerHTML = "";
      return;
    }
    const allowedScreens = Array.isArray(step.screen) ? step.screen : [step.screen];
    if (step.screen && !allowedScreens.includes(this.state.screen)) {
      this.tutorialRoot.innerHTML = "";
      return;
    }
    const target = step.target ? document.querySelector(step.target) : null;
    const rect = target?.getBoundingClientRect();
    const visible = Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight);
    const freePlay = Boolean(step.freePlay);
    const index = TUTORIAL_STEPS.findIndex((entry) => entry.id === step.id) + 1;
    const waiting = Boolean(step.completeOn);
    this.tutorialRoot.innerHTML = `
      ${freePlay ? "" : `
        <div class="tutorial-mask tutorial-mask-top"></div>
        <div class="tutorial-mask tutorial-mask-left"></div>
        <div class="tutorial-mask tutorial-mask-right"></div>
        <div class="tutorial-mask tutorial-mask-bottom"></div>
      `}
      <div class="tutorial-focus ${visible ? "" : "is-hidden"}"></div>
      <aside class="tutorial-card ${waiting ? "is-waiting" : ""} ${freePlay ? "free-play" : ""} ${visible || freePlay ? "" : "centered no-focus"}" role="${freePlay ? "status" : "dialog"}" aria-label="Шаг обучения ${index}">
        <div class="tutorial-card-head"><span class="tutorial-progress">TUTORIAL ${String(index).padStart(2, "0")} / ${TUTORIAL_STEPS.length}</span><button class="tutorial-skip" data-tutorial-skip type="button">Пропустить обучение</button></div>
        <div class="tutorial-card-body">
          ${step.completeBadge ? '<span class="tutorial-complete-badge">FIRST FLOOR COMPLETE</span>' : ""}
          <h3>${step.title}</h3>
          <p>${step.body}</p>
          ${step.hint ? `<div class="tutorial-action-hint">${step.hint}</div>` : ""}
        </div>
        <div class="tutorial-card-actions">${waiting ? "" : `<button class="primary-button tutorial-next" data-tutorial-next type="button">${step.button || "Далее"}</button>`}</div>
      </aside>
    `;
    $("[data-tutorial-skip]", this.tutorialRoot)?.addEventListener("click", () => this.skipTutorial());
    $("[data-tutorial-next]", this.tutorialRoot)?.addEventListener("click", () => this.advanceTutorial());
    if (visible) this.positionTutorial(rect, step);
  },

  positionTutorial(rect, step) {
    const padding = 9;
    const left = Math.max(6, rect.left - padding);
    const top = Math.max(6, rect.top - padding);
    const right = Math.min(window.innerWidth - 6, rect.right + padding);
    const bottom = Math.min(window.innerHeight - 6, rect.bottom + padding);
    const focus = $(".tutorial-focus", this.tutorialRoot);
    const topMask = $(".tutorial-mask-top", this.tutorialRoot);
    const leftMask = $(".tutorial-mask-left", this.tutorialRoot);
    const rightMask = $(".tutorial-mask-right", this.tutorialRoot);
    const bottomMask = $(".tutorial-mask-bottom", this.tutorialRoot);
    const card = $(".tutorial-card", this.tutorialRoot);
    if (!focus || !card) return;

    Object.assign(focus.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    if (step.freePlay) return;
    if (!topMask || !leftMask || !rightMask || !bottomMask) return;
    Object.assign(topMask.style, { left: "0", top: "0", width: "100vw", height: `${top}px` });
    Object.assign(bottomMask.style, { left: "0", top: `${bottom}px`, width: "100vw", height: `${Math.max(0, window.innerHeight - bottom)}px` });
    Object.assign(leftMask.style, { left: "0", top: `${top}px`, width: `${left}px`, height: `${bottom - top}px` });
    Object.assign(rightMask.style, { left: `${right}px`, top: `${top}px`, width: `${Math.max(0, window.innerWidth - right)}px`, height: `${bottom - top}px` });

    if (window.innerWidth <= 760) return;
    const cardWidth = Math.min(390, window.innerWidth - 24);
    const estimatedHeight = Math.max(190, card.getBoundingClientRect().height || (step.wide ? 210 : 245));
    let cardLeft = clamp(left, 12, window.innerWidth - cardWidth - 12);
    let cardTop;
    if (window.innerWidth - right >= cardWidth + 24) {
      cardLeft = right + 14;
      cardTop = clamp(top, 12, window.innerHeight - estimatedHeight - 12);
    } else if (left >= cardWidth + 24) {
      cardLeft = left - cardWidth - 14;
      cardTop = clamp(top, 12, window.innerHeight - estimatedHeight - 12);
    } else if (window.innerHeight - bottom >= estimatedHeight + 20) {
      cardTop = bottom + 13;
    } else {
      cardTop = Math.max(12, top - estimatedHeight - 13);
    }
    Object.assign(card.style, { left: `${cardLeft}px`, top: `${cardTop}px` });
  },

  captureBoardAnimation() {
    if (this.state.screen !== "combat" || !this.state.combat) return null;
    return { board: [...this.state.combat.board] };
  },

  cancelBoardAnimation() {
    this.boardAnimationToken = (this.boardAnimationToken || 0) + 1;
    for (const animation of this.activeBoardAnimations || []) {
      try {
        animation.cancel();
      } catch {
        // Detached elements may already have discarded their animations.
      }
    }
    this.activeBoardAnimations = [];
    this.tileAnimationLocked = false;
    $(".puzzle-grid.animating", this.screenEl)?.classList.remove("animating");
  },

  animateBoardTransition(snapshot) {
    if (!snapshot?.board || !this.state.combat) return;
    const grid = $(".puzzle-grid", this.screenEl);
    if (!grid) return;

    const previousBoard = snapshot.board;
    const currentBoard = this.state.combat.board;
    if (!Array.isArray(previousBoard) || previousBoard.length !== currentBoard.length) return;

    const movedValues = currentBoard
      .filter(Boolean)
      .filter((value) => previousBoard.indexOf(value) !== currentBoard.indexOf(value));
    if (!movedValues.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (movedValues.length !== 1) {
      grid.classList.remove("board-refresh");
      void grid.offsetWidth;
      grid.classList.add("board-refresh");
      window.setTimeout(() => grid.classList.remove("board-refresh"), BOARD_ANIMATION_MS + 40);
      return;
    }

    const referenceTile = $(".tile:not(.blank)", grid);
    if (!referenceTile) return;
    const tileRect = referenceTile.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const columnGap = Number.parseFloat(gridStyle.columnGap || gridStyle.gap) || 0;
    const rowGap = Number.parseFloat(gridStyle.rowGap || gridStyle.gap) || 0;
    const pitchX = tileRect.width + columnGap;
    const pitchY = tileRect.height + rowGap;
    const duration = BOARD_ANIMATION_MS;
    const token = (this.boardAnimationToken || 0) + 1;
    this.boardAnimationToken = token;

    const entries = [];
    for (const value of movedValues) {
      const fromIndex = previousBoard.indexOf(value);
      const toIndex = currentBoard.indexOf(value);
      if (fromIndex < 0 || toIndex < 0) continue;
      const dx = ((fromIndex % 4) - (toIndex % 4)) * pitchX;
      const dy = (Math.floor(fromIndex / 4) - Math.floor(toIndex / 4)) * pitchY;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const tile = $(`[data-tile-value="${value}"]`, grid);
      if (!tile) continue;
      tile.classList.add("tile-sliding");
      const animation = tile.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0)`, opacity: 0.94 },
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
        ],
        { duration, easing: "cubic-bezier(0.22, 0.78, 0.24, 1)", fill: "both" },
      );
      entries.push({ animation, tile });
    }

    if (!entries.length) return;
    this.tileAnimationLocked = true;
    grid.classList.add("animating");

    this.activeBoardAnimations = entries.map((entry) => entry.animation);
    let finalized = false;
    const finalize = () => {
      if (finalized || this.boardAnimationToken !== token) return;
      finalized = true;
      for (const { animation, tile } of entries) {
        try {
          animation.cancel();
        } catch {
          // No action needed when the element was replaced.
        }
        tile.classList.remove("tile-sliding");
      }
      this.activeBoardAnimations = [];
      this.tileAnimationLocked = false;
      if (grid.isConnected) grid.classList.remove("animating");
    };

    Promise.allSettled(entries.map(({ animation }) => animation.finished)).then(finalize);
    window.setTimeout(finalize, duration + 80);
  },
});

window.addEventListener("beforeunload", () => {
  if (Game.state.run) Game.saveGame();
});

document.addEventListener("DOMContentLoaded", () => {
  window.NULL15 = Game;
  Game.init();
});
