(function (root) {
  'use strict';
  const towers = {
    pulse: { name:'ИМПУЛЬС', tag:'KINETIC', glyph:'Ⅰ', color:'#70efff', cost:35, damage:12, delay:.65, range:180, description:'Быстрый одиночный огонь. Надёжная основа сети.' },
    arc: { name:'ДУГА', tag:'CHAIN', glyph:'ϟ', color:'#b193ff', cost:60, damage:16, delay:1.15, range:170, chain:3, description:'Молния перескакивает между 3 целями.' },
    frost: { name:'КРИО', tag:'CONTROL', glyph:'❄', color:'#85baff', cost:50, damage:5, delay:1, range:165, slow:.55, description:'Замедляет цели на 45%. Подготавливает комбинации.' },
    plasma: { name:'ПЛАЗМА', tag:'AREA', glyph:'◈', color:'#ff7d9d', cost:75, damage:21, delay:1.45, range:165, splash:56, burn:.25, description:'Взрыв и горение. Разбирает плотные группы.' },
    rail: { name:'РЕЛЬС', tag:'PIERCE', glyph:'⋮', color:'#f5dc75', cost:90, damage:58, delay:2.5, range:260, pierce:3, description:'Пробивающий выстрел. Игнорирует половину брони.' },
    nano: { name:'НАНО', tag:'SUPPORT', glyph:'⬡', color:'#8ff0b2', cost:55, damage:6, delay:1, range:155, description:'Ускоряет соседние башни на 18%. Метит цель: +20% награды.' }
  };
  const evolutions = {
    pulse: [
      {id:'storm', name:'ШТОРМ', partner:'arc', text:'Тройной залп по разным целям. −15% урона за снаряд.', damage:.85, targets:3},
      {id:'execution', name:'ПАЛАЧ', partner:'rail', text:'Урон ×2,2. Добивает цели слабее 15% здоровья.', damage:2.2, execute:.15}
    ],
    arc: [
      {id:'cascade', name:'КАСКАД', partner:'frost', text:'До 7 целей в цепи. Цепь сохраняет полный урон.', chain:7, chainFalloff:1},
      {id:'tempest', name:'РАЗРЯД', partner:'plasma', text:'Урон ×2. Каждый прыжок поджигает цель.', damage:2, burn:.3}
    ],
    frost: [
      {id:'zero', name:'АБСОЛЮТ', partner:'arc', text:'Замедление 70%, ледяной взрыв радиусом 75.', slow:.3, splash:75},
      {id:'fracture', name:'РАСКОЛ', partner:'rail', text:'Урон ×5. Замороженные цели получают +35% урона.', damage:5, vulnerable:.35}
    ],
    plasma: [
      {id:'nova', name:'НОВА', partner:'frost', text:'Радиус взрыва ×1,7. Урон ×1,5.', splash:95, damage:1.5},
      {id:'sun', name:'СОЛНЦЕ', partner:'nano', text:'Горение наносит 100% урона в секунду. Урон ×1,4.', burn:1, damage:1.4}
    ],
    rail: [
      {id:'horizon', name:'ГОРИЗОНТ', partner:'pulse', text:'Пробивает до 8 целей. Дальность +60.', pierce:8, range:60},
      {id:'singularity', name:'СИНГУЛЯРНОСТЬ', partner:'arc', text:'Урон ×3,5. Замедляет и взрывает цель.', damage:3.5, splash:45, slow:.65}
    ],
    nano: [
      {id:'hive', name:'УЛЕЙ', partner:'pulse', text:'Ускорение соседей 40%. Три цели за выстрел.', aura:.4, targets:3},
      {id:'mint', name:'МОНЕТНЫЙ ДВОР', partner:'plasma', text:'Метка даёт +60% награды. Урон ×3.', bounty:.6, damage:3}
    ]
  };
  const combos = [
    {a:'frost',b:'arc',name:'СВЕРХПРОВОДНИК',text:'Дуга: +50% урона по замедленным целям.'},
    {a:'frost',b:'plasma',name:'ТЕРМОШОК',text:'Плазма: двойной урон по замедленным целям.'},
    {a:'pulse',b:'rail',name:'БАЛЛИСТИЧЕСКАЯ СЕТЬ',text:'Импульс и Рельс: +25% урона и ослабление брони.'},
    {a:'nano',b:'any',name:'РОЙ ПОДДЕРЖКИ',text:'Нано ускоряет соседей. Берётся сильнейший бонус.'}
  ];
  const research = {
    autoBuild:{name:'Автостройка',text:'Навсегда открывает строительство по выбранным тобой чертежам. Включается отдельно.',cost:1,max:1},
    autoUpgrade:{name:'Автоулучшения',text:'Навсегда открывает автоматическое улучшение самой дешёвой башни.',cost:2,max:1},
    autoEvolve:{name:'Автоэволюции',text:'Навсегда открывает автоматический выбор первой доступной эволюции.',cost:3,max:1},
    damage:{name:'Разгон частот',text:'+20% урона за уровень (множитель)',cost:3,factor:1.2},
    income:{name:'Серый протокол',text:'+25% производства и добычи за уровень',cost:3,factor:1.25},
    hull:{name:'Резервный контур',text:'+15 прочности ядра за уровень',cost:2},
    tempo:{name:'Квантовый такт',text:'+6% темпа огня за уровень',cost:4,factor:1.06}
  };
  const enemies = {
    drone:{name:'Дрон', hp:1,speed:40,damage:7,reward:1,radius:8,color:'#ff647e'},
    runner:{name:'Курьер',hp:.65,speed:68,damage:5,reward:.9,radius:6,color:'#ffbc66'},
    shield:{name:'Щитоносец',hp:2.1,speed:30,damage:12,reward:1.8,radius:11,armor:.45,color:'#bd94ff'},
    swarm:{name:'Рой',hp:.45,speed:47,damage:3,reward:.6,radius:5,color:'#f594cb'},
    titan:{name:'ОСАДНЫЙ ТИТАН',hp:14,speed:19,damage:45,reward:12,radius:19,armor:.25,boss:true,color:'#ff5064'}
  };
  const path=[[0,140],[230,140],[230,440],[500,440],[500,230],[760,230],[760,520],[1000,520]];
  const pads=[[125,235],[320,230],[130,365],[330,350],[420,535],[525,345],[615,135],[665,325],[850,140],[850,340],[655,540],[880,600]];
  const D={towers,evolutions,combos,research,enemies,path,pads,width:1000,height:640,linkRange:240,OFFLINE_CAP:8*3600,limits:{enemies:100,effects:100}};
  root.TDData=D;if(typeof module!=='undefined'&&module.exports)module.exports=D;
})(typeof globalThis!=='undefined'?globalThis:this);
