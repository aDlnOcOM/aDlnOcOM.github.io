/* Original game content. No external assets or runtime dependencies. */
(function (root) {
  'use strict';
  const chassis = {
    spectre: { name: 'СПЕКТР', serial: 'MR–07', role: 'Мобильный охотник', hp: 115, shield: 45, speed: 230, dash: 2.6, weapon: 'needle', color: '#5ef5e0', description: 'Лёгкая рама. Быстрый рывок и высокая скорость. Для пилота, который не останавливается.' },
    bastion: { name: 'БАСТИОН', serial: 'HV–12', role: 'Тяжёлый прорыв', hp: 210, shield: 65, speed: 165, dash: 4.2, weapon: 'scatter', color: '#ffce54', description: 'Бронированный корпус и дробовой модуль. Подпускай рой близко — но оставляй путь для отхода.' },
    vector: { name: 'ВЕКТОР', serial: 'EX–03', role: 'Реакторный эксперимент', hp: 135, shield: 85, speed: 195, dash: 3.4, weapon: 'plasma', color: '#c697ff', description: 'Усиленный щит и плазменная пушка. Стабильный урон по плотным группам жуков.' }
  };
  const weapons = {
    needle: { name: 'ИГЛА', label: 'Роторный пулемёт', glyph: '≋', color: '#ffdf68', damage: 13, delay: .16, speed: 880, range: 680, pellets: 1, spread: .045, radius: 3, description: 'Быстрая очередь. Каждый уровень повышает урон и темп стрельбы.' },
    scatter: { name: 'РАЗЛОМ', label: 'Штурмовой дробовик', glyph: '⋔', color: '#ff9b5e', damage: 12, delay: .85, speed: 690, range: 340, pellets: 6, spread: .42, radius: 4, description: 'Веер снарядов. Уровни добавляют дробь и урон вблизи.' },
    plasma: { name: 'КОРДОН', label: 'Плазменная пушка', glyph: '◈', color: '#5ef5e0', damage: 30, delay: .9, speed: 470, range: 610, pellets: 1, spread: 0, radius: 8, splash: 65, description: 'Плазменный заряд взрывается при попадании. Уровни увеличивают область взрыва.' },
    rail: { name: 'ПРОКОЛ', label: 'Рельсовый ускоритель', glyph: '↗', color: '#bca0ff', damage: 55, delay: 1.4, speed: 1550, range: 950, pellets: 1, spread: 0, radius: 4, pierce: 4, description: 'Пробивает несколько целей. Уровни увеличивают урон и глубину пробития.' },
    rocket: { name: 'УЛЕЙ', label: 'Ракетная батарея', glyph: '⌁', color: '#ff5977', damage: 45, delay: 1.8, speed: 340, range: 760, pellets: 1, spread: .1, radius: 7, splash: 105, homing: true, description: 'Самонаводящиеся ракеты с большим радиусом поражения.' },
    arc: { name: 'НИМБ', label: 'Импульсная катушка', glyph: '◎', color: '#77c4ff', damage: 21, delay: 1.6, range: 180, radius: 180, description: 'Электрический импульс вокруг меха. Поражает всех жуков в радиусе.' }
  };
  const cores = {
    inferno: { name: 'ИНФЕРНО', glyph: '△', color: '#ff775d', description: '8 секунд: темп стрельбы ×1,8 и урон ×1,3. Заряд за убийства.', duration: 8 },
    aegis: { name: 'ЭГИДА', glyph: '⬡', color: '#5ef5e0', description: '8 секунд: входящий урон −80%. При активации полностью восстанавливает щит.', duration: 8 },
    singularity: { name: 'СИНГУЛЯРНОСТЬ', glyph: '◉', color: '#c697ff', description: '6 секунд: притягивает и повреждает жуков рядом с мехом. Боссы сопротивляются притяжению.', duration: 6 }
  };
  const passives = {
    damage: { name: 'Вольфрамовый сердечник', glyph: '↟', max: 6, description: '+15% урона всего вооружения.', stat: 'damage', value: .15 },
    rate: { name: 'Боевой планировщик', glyph: '≡', max: 5, description: '+10% к темпу стрельбы.', stat: 'rate', value: .1 },
    speed: { name: 'Сервоприводы', glyph: '»', max: 5, description: '+8% скорости передвижения.', stat: 'speed', value: .08 },
    hull: { name: 'Карбоновая броня', glyph: '⬢', max: 6, description: '+25 корпуса и восстановление 25 единиц корпуса.', stat: 'hp', value: 25 },
    shield: { name: 'Барьерный контур', glyph: '⬡', max: 5, description: '+20 щита и мгновенное восстановление 20 единиц щита.', stat: 'shield', value: 20 },
    magnet: { name: 'Магнитный захват', glyph: '⌖', max: 4, description: '+45 к радиусу сбора опыта и припасов.', stat: 'magnet', value: 45 },
    critical: { name: 'Анализатор хитина', glyph: '✧', max: 5, description: '+8% вероятности двойного урона.', stat: 'critical', value: .08 },
    regen: { name: 'Ремонтные наниты', glyph: '+', max: 4, description: 'Восстанавливают 0,6 корпуса в секунду.', stat: 'regen', value: .6 },
    radius: { name: 'Фокусирующие линзы', glyph: '◌', max: 4, description: '+12% дальности и площади действия модулей.', stat: 'radius', value: .12 },
    dash: { name: 'Векторная тяга', glyph: '↯', max: 4, description: 'Перезарядка рывка быстрее на 12%.', stat: 'dash', value: .12 },
    experience: { name: 'Ксенобиологический сканер', glyph: '◇', max: 4, description: '+15% получаемого опыта.', stat: 'experience', value: .15 },
    armor: { name: 'Реактивные пластины', glyph: '▰', max: 4, description: 'Входящий урон уменьшается на 8% (до 32%).', stat: 'armor', value: .08 }
  };
  const enemies = {
    mite: { name: 'Сколопендра', hp: 24, speed: 90, radius: 13, damage: 8, xp: 2, color: '#b5cb6a' },
    runner: { name: 'Резчик', hp: 20, speed: 155, radius: 10, damage: 6, xp: 3, color: '#f4ba6e' },
    brute: { name: 'Панцирник', hp: 140, speed: 57, radius: 24, damage: 18, xp: 9, color: '#b28cce' },
    spitter: { name: 'Кислотник', hp: 55, speed: 74, radius: 16, damage: 11, xp: 6, color: '#99dc70' },
    charger: { name: 'Таран', hp: 85, speed: 95, radius: 19, damage: 16, xp: 7, color: '#f87963' },
    queen: { name: 'МАТКА РАЗЛОМА', hp: 2200, speed: 53, radius: 57, damage: 28, xp: 180, color: '#ff5977', boss: true },
    nest: { name: 'Гнездо', hp: 360, speed: 0, radius: 35, damage: 12, xp: 35, color: '#cfa26f' }
  };
  const biomes = [
    { name: 'ПЕПЕЛЬНЫЕ РАВНИНЫ', ground: '#161e24', line: '#29343a', accent: '#79665c' },
    { name: 'ЗОНА ТЕРРАФОРМИНГА', ground: '#172623', line: '#2a3b35', accent: '#78845d' },
    { name: 'РЖАВЫЕ ПУСТОШИ', ground: '#29201e', line: '#46332e', accent: '#ad7156' },
    { name: 'КВАРЦЕВЫЙ РАЗЛОМ', ground: '#211f2c', line: '#383348', accent: '#947cb6' }
  ];
  const data = { chassis, weapons, cores, passives, enemies, biomes, limits: { enemies: 240, bullets: 420, drops: 200, effects: 140 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  root.ChitinData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
