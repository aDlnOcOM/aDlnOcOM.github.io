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
    return { credits: money(raw.credits), earnedCredits: money(raw.earnedCredits), ownedParts: owned,
      loadouts: Object.fromEntries(Object.keys(D.chassis).map(id => [id, cleanLoadout(owned, id, raw.loadouts?.[id])])) };
  }
  function build(profile, chassis) {
    const loadout = cleanLoadout(profile.ownedParts || [], chassis, profile.loadouts?.[chassis]);
    const effects = {}; let power = 0, weapon = D.chassis[chassis].weapon;
    for (const id of Object.values(loadout)) {
      const part = parts[id]; power += part.power; if (part.weapon) weapon = part.weapon;
      for (const [stat, value] of Object.entries(part.effects)) effects[stat] = (effects[stat] || 0) + value;
    }
    return { loadout, effects, weapon, power, capacity: capacity[chassis] };
  }
  function purchase(profile, id) {
    if (!Object.hasOwn(parts, id)) return { ok: false, message: 'Неизвестная деталь.' };
    if (profile.ownedParts.includes(id)) return { ok: false, message: 'Деталь уже куплена.' };
    if (profile.credits < parts[id].price) return { ok: false, message: 'Недостаточно Астро-Кредитов.' };
    profile.credits -= parts[id].price; profile.ownedParts.push(id); return { ok: true };
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
    player.weapons = [{ id: configuration.weapon, level: 1, cooldown: .2 }];
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
  const api = { slots, capacity, parts, bounty, money, reward, compatible, cleanLoadout, normalize, build, purchase, equip, apply, visualParts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChitinEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
