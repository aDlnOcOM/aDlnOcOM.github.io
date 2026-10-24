(function (root) {
  'use strict';
  const weapons = {
    revolver: { name: 'ПОСЛЕДНЕЕ СЛОВО', kind: 'Револьвер', damage: 27, delay: .48, speed: 46, range: 48, pellets: 1, spread: .012, pierce: 1, color: '#ffc974', sprite: 0, evolution: 'Приговор', passive: 'critical' },
    shotgun: { name: 'ПОГРЕБАЛЬНЫЙ ЗАЛП', kind: 'Двустволка', damage: 12, delay: 1.0, speed: 39, range: 20, pellets: 7, spread: .25, pierce: 1, color: '#ffad68', sprite: 1, evolution: 'Последний обряд', passive: 'armor' },
    gatling: { name: 'МОГИЛЬЩИК', kind: 'Картечница', damage: 9, delay: .10, speed: 48, range: 38, pellets: 1, spread: .06, pierce: 1, color: '#ffd181', sprite: 2, evolution: 'Литания свинца', passive: 'rate' },
    stake: { name: 'ОСИНОВЫЙ ЗАКОН', kind: 'Кольемёт', damage: 56, delay: 1.15, speed: 38, range: 48, pellets: 1, spread: 0, pierce: 4, color: '#e9c59a', sprite: 3, evolution: 'Корень зла', passive: 'damage' },
    tesla: { name: 'СИНЯЯ МОЛИТВА', kind: 'Катушка Теслы', damage: 20, delay: .65, speed: 35, range: 28, pellets: 1, spread: .01, pierce: 1, chain: 3, color: '#7ccfff', sprite: 4, evolution: 'Глас грозы', passive: 'range' },
    flame: { name: 'КРЕМАТОРИЙ', kind: 'Огнемёт', damage: 5, delay: .16, speed: 17, range: 9, pellets: 3, spread: .22, pierce: 3, burn: 13, color: '#ff8041', sprite: 5, evolution: 'Пепельный собор', passive: 'damage' },
    orb: { name: 'ЧЁРНОЕ СОЛНЦЕ', kind: 'Алхимическая пушка', damage: 35, delay: 1.2, speed: 20, range: 35, pellets: 1, spread: 0, pierce: 1, splash: 3.5, color: '#b58cff', sprite: 6, evolution: 'Схлопывание', passive: 'range' },
    crossbow: { name: 'СЕРЕБРЯНЫЙ ОБЕТ', kind: 'Арбалет', damage: 35, delay: .9, speed: 34, range: 50, pellets: 2, spread: .10, pierce: 3, color: '#d6e9eb', sprite: 7, evolution: 'Крылья обета', passive: 'rate' },
    grenade: { name: 'ПРАХ', kind: 'Гранатомёт', damage: 58, delay: 1.6, speed: 18, range: 33, pellets: 1, spread: .02, pierce: 1, splash: 4.2, gravity: 5, color: '#ffb55e', sprite: 8, evolution: 'Прах к праху', passive: 'armor' },
    rocket: { name: 'ВЕСТНИК', kind: 'Ракетница', damage: 65, delay: 2, speed: 14, range: 52, pellets: 1, spread: .04, pierce: 1, splash: 4, homing: true, color: '#ff7958', sprite: 9, evolution: 'Семь печатей', passive: 'damage' },
    frost: { name: 'ЗИМНИЙ ПСАЛОМ', kind: 'Криомант', damage: 18, delay: .7, speed: 24, range: 30, pellets: 1, spread: .03, pierce: 2, slow: .5, splash: 2, color: '#a7eaff', sprite: 10, evolution: 'Вечная ночь', passive: 'range' },
    saw: { name: 'МЯСНИК', kind: 'Дискомёт', damage: 24, delay: .8, speed: 20, range: 25, pellets: 1, spread: 0, pierce: 5, color: '#c3d59a', sprite: 11, evolution: 'Жатва', passive: 'speed' },
    bell: { name: 'ПОМИНАЛЬНЫЙ ЗВОН', kind: 'Резонатор', damage: 25, delay: 1.7, speed: 20, range: 6, pellets: 1, spread: 0, pierce: 1, aura: true, color: '#9ae6a8', sprite: 12, evolution: 'Реквием', passive: 'magnet' },
    sun: { name: 'РАССВЕТ', kind: 'Световой луч', damage: 76, delay: 1.7, speed: 90, range: 60, pellets: 1, spread: 0, pierce: 8, color: '#fff0ac', sprite: 13, evolution: 'Судный день', passive: 'critical' }
  };
  const hunters = {
    mara: { name: 'МАРА ВЕЙЛ', title: 'Охотница за долгами', hp: 110, armor: 0, speed: 6.1, weapon: 'revolver', color: '#e9b874', ability: 'Кровавый круг', description: 'Быстрый шаг. Способность наносит урон вокруг и восстанавливает здоровье за поражённых врагов.' },
    grimm: { name: 'ГРИММ', title: 'Последний могильщик', hp: 165, armor: .15, speed: 5, weapon: 'shotgun', color: '#caa18c', ability: 'Гнев могильщика', description: 'Больше здоровья и брони. Способность на 8 секунд удваивает темп огня.' },
    elias: { name: 'ЭЛИАС КРОУ', title: 'Изгнанный алхимик', hp: 95, armor: .05, speed: 5.7, weapon: 'tesla', color: '#9ac9cf', ability: 'Зимняя печать', description: 'Начинает с цепной молнии. Способность замораживает ближайшую нежить и наносит урон.' }
  };
  const passives = {
    damage: { name: 'Кровавый договор', text: '+15% урона', value: .15, max: 5, icon: '✦' },
    rate: { name: 'Спусковой ритуал', text: '+12% темпа огня', value: .12, max: 5, icon: '≋' },
    speed: { name: 'Шаг сквозь тень', text: '+8% скорости', value: .08, max: 5, icon: '»' },
    armor: { name: 'Железная вера', text: '−6% входящего урона', value: .06, max: 5, icon: '⬡' },
    health: { name: 'Вторая кровь', text: '+20 максимального здоровья и лечение', value: 20, max: 5, icon: '✚' },
    magnet: { name: 'Ловец душ', text: '+0,8 м к радиусу сбора опыта', value: .8, max: 5, icon: '◇' },
    range: { name: 'Дальнее знамение', text: '+12% дальности и области поражения', value: .12, max: 5, icon: '◎' },
    critical: { name: 'Глаз палача', text: '+6% шанса двойного урона', value: .06, max: 5, icon: '⌖' },
    regen: { name: 'Тихое причастие', text: '+0,35 здоровья в секунду', value: .35, max: 5, icon: '+' },
    experience: { name: 'Запретный архив', text: '+12% опыта', value: .12, max: 5, icon: '▤' }
  };
  const enemies = {
    ghoul: { name: 'Упырь', hp: 30, speed: 2.1, radius: .38, height: 1.7, damage: 9, xp: 3, color: [ .32, .42, .35 ] },
    skeleton: { name: 'Костяной страж', hp: 47, speed: 1.8, radius: .35, height: 1.85, damage: 12, xp: 4, color: [ .68, .64, .51 ] },
    bat: { name: 'Кровокрыл', hp: 18, speed: 3.7, radius: .48, height: .7, flying: true, damage: 7, xp: 3, color: [ .37, .17, .25 ] },
    cultist: { name: 'Заклинатель', hp: 65, speed: 1.5, radius: .4, height: 1.9, damage: 12, xp: 7, ranged: true, color: [ .35, .20, .43 ] },
    brute: { name: 'Палач', hp: 230, speed: 1.25, radius: .7, height: 2.65, damage: 23, xp: 15, color: [ .43, .25, .23 ] },
    vampire: { name: 'Ночной дворянин', hp: 105, speed: 3.0, radius: .4, height: 1.95, damage: 16, xp: 9, color: [ .31, .12, .16 ] },
    boss: { name: 'СМОТРИТЕЛЬ ПОЛУНОЧИ', hp: 2400, speed: 1.4, radius: 1.15, height: 4.1, damage: 32, xp: 160, boss: true, color: [ .40, .15, .20 ] }
  };
  const arenas = {
    cemetery: { name: 'КЛАДБИЩЕ МЕХАНИЗМОВ', description: 'Надгробия, склепы и открытые аллеи. Вечный закат.', floor: [.17, .17, .16], wall: [.37, .32, .28], sky: [.22, .14, .12], accent: [.95, .48, .20] },
    foundry: { name: 'ПОГАСШАЯ ЛИТЕЙНАЯ', description: 'Трубы, котлы и промышленные дворы. Огонь в тумане.', floor: [.15, .17, .18], wall: [.25, .30, .31], sky: [.11, .15, .18], accent: [.90, .33, .12] },
    abbey: { name: 'АББАТСТВО ПУСТОТЫ', description: 'Каменные аркады, дворы и лунный свет.', floor: [.19, .20, .23], wall: [.40, .41, .47], sky: [.10, .12, .22], accent: [.44, .63, .95] }
  };
  const meta = {
    vitality: { name: 'Несломленная кровь', text: '+8 здоровья за ранг', max: 5 },
    power: { name: 'Посвящение оружейника', text: '+4% урона за ранг', max: 5 },
    wisdom: { name: 'Архив охотника', text: '+4% опыта за ранг', max: 5 },
    fortune: { name: 'Монета на удачу', text: '+5% награды за ранг', max: 5 }
  };
  const D = { weapons, hunters, passives, enemies, arenas, meta, MAX_WEAPONS: 14, LIMITS: { enemies: 180, bullets: 420, effects: 120, drops: 180 }, TRIAL: 720 };
  root.HuntData = D; if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof globalThis !== 'undefined' ? globalThis : this);
