(function(root){
  'use strict';
  const hands={
    high:{name:'Старшая карта',chips:5,mult:1,chipStep:10,multStep:1},
    pair:{name:'Пара',chips:10,mult:2,chipStep:15,multStep:1},
    twoPair:{name:'Две пары',chips:20,mult:2,chipStep:20,multStep:1},
    three:{name:'Тройка',chips:30,mult:3,chipStep:20,multStep:2},
    straight:{name:'Стрит',chips:30,mult:4,chipStep:30,multStep:3},
    flush:{name:'Флеш',chips:35,mult:4,chipStep:20,multStep:2},
    full:{name:'Фулл-хаус',chips:40,mult:4,chipStep:25,multStep:2},
    four:{name:'Каре',chips:60,mult:7,chipStep:30,multStep:3},
    straightFlush:{name:'Стрит-флеш',chips:100,mult:8,chipStep:40,multStep:4},
    five:{name:'Пять одинаковых',chips:120,mult:12,chipStep:35,multStep:3},
    flushFull:{name:'Флеш-хаус',chips:140,mult:14,chipStep:40,multStep:4},
    flushFive:{name:'Флеш-пятёрка',chips:160,mult:16,chipStep:50,multStep:5}
  };
  const suits=[{name:'Пики',glyph:'♠',color:'#a8dcff',role:'+6% критического шанса'}, {name:'Червы',glyph:'♥',color:'#ff8d9d',role:'+18% прочности и +0,4 ремонта/с'}, {name:'Трефы',glyph:'♣',color:'#91e4bf',role:'+8% темпа стрельбы'}, {name:'Бубны',glyph:'♦',color:'#ffcf87',role:'+$1 за блайнд (до $3)'}];
  const jokers={
    spark:{name:'Искровой шут',glyph:'✦',cost:4,text:'+4 к множителю.',kind:'mult',value:4},
    cache:{name:'Кэш-память',glyph:'▦',cost:4,text:'+40 фишек.',kind:'chips',value:40},
    echo:{name:'Эхо-каскад',glyph:'»',cost:7,text:'Множитель ×1,6. Порядок джокеров важен.',kind:'times',value:1.6},
    twins:{name:'Двойной агент',glyph:'Ⅱ',cost:5,text:'+10 к множителю, если в руке есть пара.',kind:'pair',value:10},
    spectrum:{name:'Чистый спектр',glyph:'◈',cost:8,text:'Множитель ×2 для флеш-комбинаций.',kind:'flush',value:2,unlock:'flush'},
    bank:{name:'Капитал',glyph:'$',cost:6,text:'+2 фишки за каждый доллар на момент запуска.',kind:'bank'},
    twinBarrel:{name:'Дуплекс',glyph:'⊕',cost:7,text:'Огонь по двум целям вместо одной.',kind:'targets'},
    chain:{name:'Разрядник',glyph:'ϟ',cost:7,text:'Два прыжка молнии, 60% урона на каждом.',kind:'chain'},
    blast:{name:'Красный карлик',glyph:'◎',cost:7,text:'Взрыв радиусом 48: 55% урона соседям.',kind:'splash'},
    shell:{name:'Бункер',glyph:'⬡',cost:5,text:'Максимальная прочность ×2.',kind:'hull'},
    medic:{name:'Нанохирург',glyph:'+',cost:5,text:'+2 ремонта/с во время боя.',kind:'regen'},
    thorns:{name:'Обратный импульс',glyph:'↯',cost:6,text:'При контакте отражает 25% максимального HP врага.',kind:'thorns',unlock:'kills'},
    scope:{name:'Дальний глаз',glyph:'⌖',cost:4,text:'+45 к радиусу огня.',kind:'range'},
    haste:{name:'Овердрайв',glyph:'≋',cost:6,text:'Интервал выстрела ×0,75.',kind:'speed'},
    growth:{name:'Обучающийся код',glyph:'↗',cost:7,text:'+1 к множителю за каждый пройденный блайнд забега.',kind:'growth',unlock:'boss'},
    reactor:{name:'Сингулярность',glyph:'◉',cost:9,text:'Множитель ×(1 + 0,1 за пройденный блайнд).',kind:'reactor',unlock:'ante'}
  };
  const decks={
    signal:{name:'Сигнал',color:'#82e7dd',text:'52 карты · 8 на руке · 3 сброса.',require:'Доступна сразу'},
    reserve:{name:'Резерв',color:'#ffcf87',text:'Старт $20 вместо $10; только 7 карт на руке.',require:'Уничтожить 100 врагов суммарно'},
    prism:{name:'Призма',color:'#bdabff',text:'Только пики и червы: проще собирать флеши.',require:'Победить первого босса'},
    citadel:{name:'Цитадель',color:'#91e4bf',text:'Прочность ×1,5; 4 слота джокеров вместо 5.',require:'Победить на анте 8'}
  };
  const stakes=[{name:'Белая',text:'Базовые правила.'},{name:'Красная',text:'HP врагов ×1,25. Малый блайнд не платит базовую награду.'},{name:'Чёрная',text:'HP ×1,6, урон ×1,2; на один сброс меньше.'},{name:'Золотая',text:'HP ×2, урон ×1,4; два сброса, товары дороже на $1.'}];
  const bosses=[{id:'armor',name:'Панцирь',text:'Все враги поглощают 35% урона.'},{id:'silence',name:'Глушитель',text:'Первый джокер отключён на этот блайнд.'},{id:'haste',name:'Натиск',text:'Враги движутся на 45% быстрее.'},{id:'veil',name:'Завеса',text:'Радиус башни уменьшен на 30%.'}];
  const vouchers={pocket:{name:'Широкая ладонь',text:'+1 карта на руке до конца забега.',cost:10},slot:{name:'Дополнительный разъём',text:'+1 слот джокера до конца забега.',cost:10},interest:{name:'Депозитный контур',text:'Предел процентов повышается с $5 до $10.',cost:10},discard:{name:'Вторая попытка',text:'+1 сброс перед каждым блайндом.',cost:8}};
  const tarots={foil:{name:'Гравёр',text:'Выбранная карта: +30 фишек при подсчёте.',cost:3},mult:{name:'Модулятор',text:'Выбранная карта: +4 к множителю.',cost:3},steel:{name:'Усилитель',text:'Выбранная карта: множитель ×1,5.',cost:5},clone:{name:'Двойник',text:'Добавить копию выбранной карты в колоду.',cost:4},remove:{name:'Стирание',text:'Удалить выбранную карту из колоды (минимум 10).',cost:3},heart:{name:'Перепайка',text:'Изменить масть выбранной карты на червы.',cost:3}};
  const enemies={drone:{name:'Дрон',hp:1,damage:6,speed:24,radius:8,color:'#ff8399',sides:4},runner:{name:'Спайк',hp:.65,damage:5,speed:42,radius:7,color:'#ffd18c',sides:3},tank:{name:'Бастион',hp:2.4,damage:12,speed:17,radius:13,color:'#bca8ff',sides:6},swarm:{name:'Осколок',hp:.45,damage:3,speed:32,radius:5,color:'#f3a7d1',sides:4},boss:{name:'Страж блайнда',hp:12,damage:24,speed:14,radius:23,color:'#ff677e',sides:8}};
  const api={hands,suits,jokers,decks,stakes,bosses,vouchers,tarots,enemies};root.TowerData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
