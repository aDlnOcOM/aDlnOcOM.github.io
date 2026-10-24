(function (root) {
  'use strict';
  const D = root.ChitinData || require('./data.js');
  const slots = { weapon: 'Вооружение', armor: 'Бронекорпус', drive: 'Ходовая', reactor: 'Реактор', utility: 'Спецсистема' };
  const capacity = { spectre: 9, bastion: 12, vector: 11 };
  const parts = {
    breacher: { name: 'Разлом / штурмовой блок', slot: 'weapon', price: 240, power: 2, visual: 0, weapon: 'scatter', description: 'Заменяет стартовое оружие дробовиком «Разлом».', effects: {} },
    ion: { name: 'Кордон / ионная установка', slot: 'weapon', price: 360, power: 3, visual: 1, weapon: 'plasma', description: 'Начинай вылет с плазменной пушкой «Кордон».', effects: {} },
    lance: { name: 'Прокол / тяжёлый ускоритель', slot: 'weapon', price: 650, power: 4, visual: 2, weapon: 'rail', chassis: ['bastion', 'vector'], description: 'Рельсотрон вместо штатного оружия. Только тяжёлые и реакторные рамы.', effects: {} },
    hive: { name: 'Улей / ракетный пилон', slot: 'weapon', price: 720, power: 4, visual: 3, weapon: 'rocket', description: 'Самонаводящаяся ракетная батарея с первого уровня.', effects: {} },
    bulwark: { name: 'Цитадель / стальной панцирь', slot: 'armor', price: 220, power: 2, visual: 4, description: '+65 корпуса, −8% скорости. Массивная наружная броня.', effects: { hp: 65, speed: -.08 } },
    ceramic: { name: 'Керамит / реактивные панели', slot: 'armor', price: 420, power: 3, visual: 5, description: '−12% входящего урона, +20 корпуса.', effects: { armor: .12, hp: 20 } },
    composite: { name: 'Мираж / композитный корпус', slot: 'armor', price: 690, power: 2, visual: 6, description: '+30 корпуса, +7% скорости. Лёгкая серебристая обшивка.', effects: { hp: 30, speed: .07 } },
    nanoforge: { name: 'Кузня / ремонтный манипулятор', slot: 'utility', price: 460, power: 3, visual: 7, description: 'Постоянный ремонт 0,8 корпуса в секунду.', effects: { regen: .8 } },
    jet: { name: 'Кочевник / маршевые двигатели', slot: 'drive', price: 180, power: 2, visual: 8, description: '+12% скорости. Синие маршевые сопла.', effects: { speed: .12 } },
    hydraulics: { name: 'Атлас / силовая гидравлика', slot: 'drive', price: 300, power: 1, visual: 9, description: '+35 корпуса, +5% скорости. Усиленные поршни ног.', effects: { hp: 35, speed: .05 } },
    vectorjet: { name: 'Стриж / векторная тяга', slot: 'drive', price: 540, power: 3, visual: 10, description: '+8% скорости, перезарядка рывка быстрее на 18%.', effects: { speed: .08, dash: .18 } },
    collector: { name: 'Старатель / магнитный захват', slot: 'utility', price: 190, power: 1, visual: 11, description: '+85 к радиусу сбора опыта и припасов.', effects: { magnet: 85 } },
    furnace: { name: 'Гелиос / боевой реактор', slot: 'reactor', price: 390, power: 3, visual: 12, description: '+12% урона, +8% темпа стрельбы, −15 щита.', effects: { damage: .12, rate: .08, shield: -15 } },
    barrier: { name: 'Оберег / барьерная катушка', slot: 'reactor', price: 350, power: 3, visual: 13, description: '+45 щита. Бирюзовый барьерный генератор.', effects: { shield: 45 } },
    capacitor: { name: 'Пульсар / конденсатор ядра', slot: 'reactor', price: 580, power: 4, visual: 14, description: '+30% заряда ядра за убийства и +2 секунды его действия.', effects: { coreGain: .3, coreDuration: 2 } },
    hunter: { name: 'Оракул / сканер уязвимостей', slot: 'utility', price: 380, power: 2, visual: 15, description: '+10% шанса критического попадания.', effects: { critical: .1 } }
  };
  // 64 additional models, not quality duplicates. Existing IDs remain stable.
  const catalog = {
    weapon: [
      ['rotor', 'Шершень / роторная станция', 180, 1, 0, { rate: .04 }, 'needle'],
      ['pulse', 'Нимб / импульсный контур', 440, 3, 1, { shield: 10 }, 'arc'],
      ['thunder', 'Гром / осколочная станция', 520, 3, 0, {}, 'cannon'],
      ['ash', 'Пепел / термораспылитель', 330, 2, 1, {}, 'flame'],
      ['frost', 'Иней / криогенная станция', 470, 3, 1, {}, 'cryo'],
      ['siege', 'Осада / гранатный пилон', 690, 4, 3, {}, 'mortar'],
      ['spire', 'Шпиль / снайперская установка', 760, 4, 2, {}, 'gauss'],
      ['reaper', 'Жнец / дисковый блок', 430, 2, 0, {}, 'saw'],
      ['duelist', 'Дуэлянт / точный ротор', 390, 2, 0, { critical: .08, rate: -.05 }, 'needle'],
      ['broadside', 'Борт / тяжёлый дробовой блок', 590, 3, 0, { damage: .12, speed: -.04 }, 'scatter'],
      ['comet', 'Комета / облегчённый пилон', 620, 3, 3, { speed: .06, damage: -.08 }, 'rocket'],
      ['inductor', 'Индуктор / дальний импульс', 610, 4, 1, { radius: .18, shield: -10 }, 'arc']
    ],
    armor: [
      ['laminate', 'Слоистая броня', 240, 2, 4, { hp: 45, armor: .04 }],
      ['mesh', 'Сетка / противоосколочный корпус', 210, 1, 6, { hp: 25, speed: .03 }],
      ['ablative', 'Абляция / расходуемые экраны', 390, 3, 5, { armor: .15, shield: -10 }],
      ['titanium', 'Титан / несущая оболочка', 560, 2, 6, { hp: 55, speed: .04 }],
      ['citadel', 'Крепость / осадная броня', 730, 4, 4, { hp: 110, speed: -.14 }],
      ['faraday', 'Фарадей / экранированный корпус', 440, 3, 5, { shield: 40, hp: 15 }],
      ['honeycomb', 'Соты / ячеистый корпус', 350, 2, 6, { hp: 35, armor: .07 }],
      ['scarab', 'Скарабей / адаптивная броня', 620, 3, 4, { armor: .1, regen: .3 }],
      ['duplex', 'Дуплекс / двухслойная оболочка', 470, 3, 5, { hp: 35, shield: 25 }],
      ['racing', 'Игла / облегчённая оболочка', 410, 1, 6, { speed: .11, hp: -15 }],
      ['bunker', 'Бункер / монолитный корпус', 820, 4, 4, { armor: .2, speed: -.1 }],
      ['rescue', 'Спасатель / ремонтный каркас', 530, 3, 5, { hp: 40, regen: .4 }],
      ['screen', 'Завеса / барьерная оболочка', 680, 4, 6, { shield: 70, hp: -20 }]
    ],
    drive: [
      ['sprinter', 'Спринтер / быстрые сервоприводы', 250, 2, 8, { speed: .16, hp: -10 }],
      ['crawler', 'Краулер / опорная гидравлика', 260, 1, 9, { hp: 45, speed: -.04 }],
      ['impulse', 'Импульс / рывковые сопла', 440, 3, 10, { dash: .24 }],
      ['gyros', 'Гироскоп / стабилизаторы', 310, 2, 9, { speed: .05, critical: .05 }],
      ['longstride', 'Шаг / длинноходные опоры', 380, 2, 9, { speed: .1, magnet: 35 }],
      ['falcon', 'Сокол / лёгкая тяга', 620, 3, 10, { speed: .2, shield: -15 }],
      ['anchor', 'Якорь / осадные опоры', 340, 2, 9, { armor: .07, speed: -.03 }],
      ['spring', 'Пружина / рекуператор хода', 480, 3, 8, { dash: .12, coreGain: .12 }],
      ['outrider', 'Рейдер / дальний привод', 570, 3, 8, { speed: .13, hp: 20 }],
      ['recoil', 'Упор / боевые амортизаторы', 420, 2, 9, { damage: .09, speed: .03 }],
      ['redshift', 'Сдвиг / форсажные двигатели', 790, 4, 10, { speed: .24, dash: .08, hp: -25 }],
      ['stalker', 'Ловчий / бесшумные сервоприводы', 460, 2, 8, { speed: .09, critical: .04 }],
      ['tandem', 'Тандем / двойная гидравлика', 610, 3, 9, { hp: 60, dash: .1, speed: -.03 }]
    ],
    reactor: [
      ['dynamo', 'Динамо / сервисный генератор', 180, 1, 12, { shield: 20 }],
      ['fission', 'Деление / ударный реактор', 520, 3, 12, { damage: .2, shield: -20 }],
      ['flux', 'Поток / быстрая катушка', 430, 3, 13, { rate: .18, hp: -15 }],
      ['reservoir', 'Резерв / накопитель', 360, 2, 14, { coreDuration: 3 }],
      ['solar', 'Корона / зарядный контур', 460, 3, 12, { coreGain: .4 }],
      ['isotope', 'Изотоп / регенератор', 580, 3, 13, { regen: .65, shield: 15 }],
      ['bastille', 'Бастилия / защитный реактор', 660, 4, 13, { shield: 75, speed: -.06 }],
      ['overdrive', 'Овердрайв / боевой разгон', 810, 4, 12, { damage: .13, rate: .14, shield: -20 }],
      ['catalyst', 'Катализатор / резонатор ядра', 640, 3, 14, { coreGain: .2, coreDuration: 3 }],
      ['quartz', 'Кварц / фокусирующий реактор', 390, 2, 14, { radius: .16, shield: 10 }],
      ['coldcore', 'Холодное ядро / теплообменник', 500, 3, 13, { rate: .1, shield: 25 }],
      ['pulsecore', 'Тактовик / импульсный реактор', 450, 2, 12, { dash: .12, rate: .06 }],
      ['singular', 'Предел / сингулярный накопитель', 900, 4, 14, { coreDuration: 5, coreGain: .15, hp: -20 }]
    ],
    utility: [
      ['medic', 'Медик / полевой ремонтник', 290, 2, 7, { regen: .45, hp: 10 }],
      ['survey', 'Геодезист / дальний магнит', 320, 2, 11, { magnet: 140 }],
      ['analyst', 'Аналитик / биосканер', 370, 2, 15, { experience: .18 }],
      ['scope', 'Визир / оптический блок', 290, 1, 15, { radius: .12, critical: .03 }],
      ['harvester', 'Сборщик / трофейный захват', 460, 3, 11, { magnet: 80, experience: .15 }],
      ['surgeon', 'Хирург / прецизионный ремонт', 670, 4, 7, { regen: 1.1, speed: -.04 }],
      ['targeter', 'Метка / анализатор целей', 520, 3, 15, { critical: .14, radius: .04 }],
      ['cooler', 'Иней / оружейный охладитель', 360, 2, 7, { rate: .12 }],
      ['capacitorlink', 'Связь / распределитель заряда', 400, 2, 11, { coreGain: .22, shield: 10 }],
      ['bionics', 'Бионика / обучение пилота', 610, 3, 15, { experience: .26, magnet: 30 }],
      ['patcher', 'Латка / аварийный манипулятор', 470, 2, 7, { hp: 30, regen: .35 }],
      ['echo', 'Эхо / широкополосный сканер', 550, 3, 15, { radius: .2, magnet: 50 }],
      ['prospector', 'Разведчик / комплекс сбора', 720, 4, 11, { magnet: 160, experience: .1, speed: .04 }]
    ]
  };
  for (const [slot, entries] of Object.entries(catalog)) for (const [index, [id, name, price, power, visual, effects, weapon]] of entries.entries()) {
    parts[id] = { name, slot, price, power, visual, visualHue: (index + 1) * 19, visualScale: .88 + index % 5 * .06, effects, ...(weapon ? { weapon } : {}) };
  }
  const qualities = {
    salvaged: { name: 'Восстановленное', rank: 0, factor: .8, price: .65, color: '#9da8ad' },
    standard: { name: 'Стандартное', rank: 1, factor: 1, price: 1, color: '#dce8e7' },
    military: { name: 'Военное', rank: 2, factor: 1.2, price: 1.8, color: '#5ef5e0' },
    experimental: { name: 'Экспериментальное', rank: 3, factor: 1.4, price: 3.2, color: '#c697ff' },
    pristine: { name: 'Эталонное', rank: 4, factor: 1.65, price: 5.2, color: '#ffdf68' }
  };
  const qualityOf = (profile, id) => Object.hasOwn(qualities, profile.partQualities?.[id]) ? profile.partQualities[id] : 'standard';
  function resolvePart(id, quality = 'standard') {
    if (!Object.hasOwn(parts, id) || !Object.hasOwn(qualities, quality)) return null;
    const base = parts[id], q = qualities[quality];
    const effects = Object.fromEntries(Object.entries(base.effects).map(([stat, value]) => {
      const scaled = value >= 0 ? value * q.factor : value / q.factor;
      return [stat, ['hp', 'shield', 'magnet'].includes(stat) ? Math.round(scaled) : Math.round(scaled * 1000) / 1000];
    }));
    return { ...base, id, quality, effects, price: Math.ceil(base.price * q.price), weaponMultiplier: base.weapon ? q.factor : 1 };
  }
  function quote(profile, id, quality = 'standard') {
    const part = resolvePart(id, quality);
    if (!part) return { ok: false, message: 'Неизвестная деталь или качество.' };
    const owned = profile.ownedParts.includes(id), previous = qualityOf(profile, id);
    if (owned && qualities[quality].rank <= qualities[previous].rank) return { ok: false, message: 'Уже куплено такое же или более высокое качество.' };
    return { ok: true, cost: part.price - (owned ? resolvePart(id, previous).price : 0), upgrade: owned };
  }
  const statNames = { hp: 'корпус', shield: 'щит', magnet: 'радиус сбора', regen: 'ремонт/с', damage: 'урон', rate: 'темп огня', speed: 'скорость', armor: 'защита', critical: 'критический шанс', radius: 'дальность/область', dash: 'ускорение рывка', experience: 'опыт', coreGain: 'заряд ядра', coreDuration: 'длительность ядра, с' };
  function describe(part) {
    const flat = ['hp', 'shield', 'magnet', 'regen', 'coreDuration'];
    return [part.weapon ? `${D.weapons[part.weapon].name}: урон оружия ×${part.weaponMultiplier ?? 1}.` : '', ...Object.entries(part.effects).map(([stat, value]) => `${value > 0 ? '+' : ''}${Number((value * (flat.includes(stat) ? 1 : 100)).toFixed(1))}${flat.includes(stat) ? '' : '%'} ${statNames[stat]}`)].filter(Boolean).join(' · ');
  }
  const bounty = { mite: 2, runner: 3, brute: 8, spitter: 6, charger: 8, queen: 250, nest: 25 };
  const money = n => Number.isFinite(n) ? Math.floor(Math.max(0, Math.min(1e12, n))) : 0;
  const compatible = (id, chassis) => Object.hasOwn(parts, id) && Object.hasOwn(D.chassis, chassis) && (!parts[id].chassis || parts[id].chassis.includes(chassis));
  function reward(enemy) { return Object.hasOwn(bounty, enemy.type) ? bounty[enemy.type] * (enemy.elite ? 3 : 1) : 0; }
  function cleanLoadout(owned, chassis, raw = {}) {
    const result = {}; let used = 0;
    for (const slot of Object.keys(slots)) {
      const id = raw?.[slot];
      if (owned.includes(id) && compatible(id, chassis) && parts[id].slot === slot && used + parts[id].power <= capacity[chassis]) {
        result[slot] = id; used += parts[id].power;
      }
    }
    return result;
  }
  function normalize(raw = {}) {
    const owned = Array.isArray(raw.ownedParts) ? [...new Set(raw.ownedParts.filter(id => typeof id === 'string' && Object.hasOwn(parts, id)))] : [];
    return { credits: money(raw.credits), earnedCredits: money(raw.earnedCredits), ownedParts: owned, partQualities: Object.fromEntries(owned.map(id => [id, qualityOf(raw, id)])),
      loadouts: Object.fromEntries(Object.keys(D.chassis).map(id => [id, cleanLoadout(owned, id, raw.loadouts?.[id])])) };
  }
  function build(profile, chassis) {
    const loadout = cleanLoadout(profile.ownedParts || [], chassis, profile.loadouts?.[chassis]);
    const effects = {}, installedQualities = {}; let power = 0, weapon = D.chassis[chassis].weapon, weaponMultiplier = 1;
    for (const id of Object.values(loadout)) {
      const part = resolvePart(id, qualityOf(profile, id)); installedQualities[id] = part.quality;
      power += part.power; if (part.weapon) { weapon = part.weapon; weaponMultiplier = part.weaponMultiplier; }
      for (const [stat, value] of Object.entries(part.effects)) effects[stat] = (effects[stat] || 0) + value;
    }
    return { loadout, effects, weapon, weaponMultiplier, installedQualities, power, capacity: capacity[chassis] };
  }
  function purchase(profile, id, quality = 'standard') {
    const offer = quote(profile, id, quality);
    if (!offer.ok) return offer;
    if (profile.credits < offer.cost) return { ok: false, message: 'Недостаточно Астро-Кредитов.' };
    profile.credits -= offer.cost;
    if (!offer.upgrade) profile.ownedParts.push(id);
    profile.partQualities ||= {}; profile.partQualities[id] = quality;
    return { ok: true, cost: offer.cost, upgrade: offer.upgrade };
  }
  function equip(profile, chassis, slot, id) {
    if (!Object.hasOwn(D.chassis, chassis) || !Object.hasOwn(slots, slot)) return { ok: false, message: 'Неизвестное крепление.' };
    if (id !== null && (!profile.ownedParts.includes(id) || !compatible(id, chassis) || parts[id].slot !== slot)) return { ok: false, message: 'Деталь не куплена или несовместима с шасси.' };
    const next = { ...profile.loadouts[chassis] };
    if (id === null) delete next[slot]; else next[slot] = id;
    if (Object.values(next).reduce((sum, key) => sum + parts[key].power, 0) > capacity[chassis]) return { ok: false, message: 'Перегрузка энергосети. Сними другую деталь.' };
    profile.loadouts[chassis] = next; return { ok: true };
  }
  function apply(player, configuration) {
    player.installedParts = { ...configuration.loadout };
    player.installedQualities = { ...configuration.installedQualities };
    player.weapons = [{ id: configuration.weapon, level: 1, cooldown: .2, qualityMultiplier: configuration.weaponMultiplier }];
    for (const [stat, value] of Object.entries(configuration.effects)) {
      if (stat === 'hp') player.hp = player.maxHp = player.maxHp + value;
      else if (stat === 'shield') player.shield = player.maxShield = Math.max(0, player.maxShield + value);
      else if (Object.hasOwn(player.stats, stat)) player.stats[stat] += value;
    }
  }
  function visualParts(loadout = {}) {
    // Canonical layer order is shared by hangar, workshop and the battlefield.
    return ['drive', 'reactor', 'armor', 'weapon', 'utility'].filter(slot => Object.hasOwn(parts, loadout[slot]) && parts[loadout[slot]].slot === slot)
      .map(slot => ({ ...parts[loadout[slot]], id: loadout[slot] }));
  }
  const api = { slots, capacity, parts, qualities, qualityOf, resolvePart, quote, describe, bounty, money, reward, compatible, cleanLoadout, normalize, build, purchase, equip, apply, visualParts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChitinEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
