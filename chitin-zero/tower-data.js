(function(root){
  'use strict';
  const hands={
    high:{name:'Импульс',rule:'Один старший ранг',chips:5,mult:1,chipStep:10,multStep:1},
    pair:{name:'Дубль',rule:'2 одинаковых ранга',chips:10,mult:2,chipStep:15,multStep:1},
    twoPair:{name:'Двойной контур',rule:'Две пары рангов',chips:20,mult:2,chipStep:20,multStep:1},
    three:{name:'Триада',rule:'3 одинаковых ранга',chips:30,mult:3,chipStep:20,multStep:2},
    straight:{name:'Каскад',rule:'5 рангов подряд; также 14–02–03–04–05',chips:30,mult:4,chipStep:30,multStep:3},
    flush:{name:'Синхронизация',rule:'5 модулей одной системы',chips:35,mult:4,chipStep:20,multStep:2},
    full:{name:'Связка 3+2',rule:'Триада и дубль',chips:40,mult:4,chipStep:25,multStep:2},
    four:{name:'Квадроканал',rule:'4 одинаковых ранга',chips:60,mult:7,chipStep:30,multStep:3},
    straightFlush:{name:'Синхрокаскад',rule:'Каскад одной системы',chips:100,mult:8,chipStep:40,multStep:4},
    five:{name:'Пентаядро',rule:'5 одинаковых рангов',chips:120,mult:12,chipStep:35,multStep:3},
    flushFull:{name:'Синхросвязка',rule:'Связка 3+2 одной системы',chips:140,mult:14,chipStep:40,multStep:4},
    flushFive:{name:'Синхропента',rule:'5 одинаковых рангов одной системы',chips:160,mult:16,chipStep:50,multStep:5}
  };
  // Numeric suit/rank IDs remain stable so existing runs keep their exact rules.
  const suits=[
    {name:'Наведение',code:'AIM',glyph:'⌖',color:'#90d7fa',role:'+6% критического шанса',path:'M24 3v9m0 24v9M3 24h9m24 0h9M15 15h18v18H15zM21 24h6m-3-3v6'},
    {name:'Ремонт',code:'FIX',glyph:'⬡',color:'#f5a5bd',role:'+18% прочности и +0,4 ремонта/с',path:'M24 5 39 12v14L24 43 9 26V12zM24 15v18m-9-9h18'},
    {name:'Разгон',code:'CLK',glyph:'ϟ',color:'#9ee2b5',role:'+8% темпа стрельбы',path:'M27 4 12 26h12l-3 18 15-24H24zM5 14h7M36 34h7'},
    {name:'Сеть',code:'NET',glyph:'▦',color:'#f4d28c',role:'+$1 за блайнд (до $3)',path:'M17 17h14v14H17zM4 4h8v8H4zM36 4h8v8h-8zM4 36h8v8H4zM36 36h8v8h-8zM12 12l5 5m14 0 5-5M12 36l5-5m14 0 5 5'}
  ];
  const jokers={
    spark:{name:'Искровой чип',glyph:'✦',cost:4,text:'+4 к множителю.',kind:'mult',value:4},
    cache:{name:'Кэш-память',glyph:'▦',cost:4,text:'+40 мощности.',kind:'chips',value:40},
    echo:{name:'Эхо-каскад',glyph:'»',cost:7,text:'Множитель ×1,6. Порядок имплантов важен.',kind:'times',value:1.6},
    twins:{name:'Двойной агент',glyph:'Ⅱ',cost:5,text:'+10 к множителю, если в руке есть пара.',kind:'pair',value:10},
    spectrum:{name:'Чистый спектр',glyph:'◈',cost:8,text:'Множитель ×2 для комбинаций одной системы (5 модулей).',kind:'flush',value:2,unlock:'flush'},
    bank:{name:'Капитал',glyph:'$',cost:6,text:'+2 мощности за каждый кредит на момент запуска.',kind:'bank'},
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
    prism:{name:'Призма',color:'#bdabff',text:'Только Наведение и Ремонт: проще синхронизация.',require:'Победить первого босса'},
    citadel:{name:'Цитадель',color:'#91e4bf',text:'Прочность ×1,5; 4 слота имплантов вместо 5.',require:'Победить на анте 8'}
  };
  const stakes=[{name:'Белая',text:'Базовые правила.'},{name:'Красная',text:'HP врагов ×1,25. Малый блайнд не платит базовую награду.'},{name:'Чёрная',text:'HP ×1,6, урон ×1,2; на один сброс меньше.'},{name:'Золотая',text:'HP ×2, урон ×1,4; два сброса, товары дороже на $1.'}];
  const bosses=[{id:'armor',name:'Панцирь',text:'Все враги поглощают 35% урона.'},{id:'silence',name:'Глушитель',text:'Первый имплант отключён на этот блайнд.'},{id:'haste',name:'Натиск',text:'Враги движутся на 45% быстрее.'},{id:'veil',name:'Завеса',text:'Радиус башни уменьшен на 30%.'}];
  const vouchers={pocket:{name:'Буфер данных',text:'+1 карта на руке до конца забега.',cost:10},slot:{name:'Дополнительный разъём',text:'+1 слот импланта до конца забега.',cost:10},interest:{name:'Депозитный контур',text:'Предел процентов повышается с $5 до $10.',cost:10},discard:{name:'Вторая попытка',text:'+1 сброс перед каждым блайндом.',cost:8}};
  const tarots={foil:{name:'Гравёр',text:'Выбранный модуль: +30 мощности при подсчёте.',cost:3},mult:{name:'Модулятор',text:'Выбранный модуль: +4 к множителю.',cost:3},steel:{name:'Усилитель',text:'Выбранный модуль: множитель ×1,5.',cost:5},clone:{name:'Двойник',text:'Добавить копию выбранного модуля в набор.',cost:4},remove:{name:'Стирание',text:'Удалить выбранный модуль из набора (минимум 10).',cost:3},heart:{name:'Перепайка',text:'Перевести выбранный модуль в систему Ремонт.',cost:3}};
  const enemies={drone:{name:'Дрон',hp:1,damage:6,speed:24,radius:8,color:'#ff8399',sides:4},runner:{name:'Спайк',hp:.65,damage:5,speed:42,radius:7,color:'#ffd18c',sides:3},tank:{name:'Бастион',hp:2.4,damage:12,speed:17,radius:13,color:'#bca8ff',sides:6},swarm:{name:'Осколок',hp:.45,damage:3,speed:32,radius:5,color:'#f3a7d1',sides:4},boss:{name:'Страж блайнда',hp:12,damage:24,speed:14,radius:23,color:'#ff677e',sides:8}};
  const api={hands,suits,jokers,decks,stakes,bosses,vouchers,tarots,enemies};root.TowerData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
