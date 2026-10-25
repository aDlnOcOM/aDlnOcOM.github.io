(function(root){
  'use strict';
  const D=root.TDData||require('./td-data.js');
  const health={pulse:160,arc:135,frost:180,plasma:145,rail:120,nano:150};
  const demand={pulse:4,arc:6,frost:4,plasma:7,rail:8,nano:5};
  const structures=Object.fromEntries(Object.entries(D.towers).map(([id,t])=>[id,{...t,kind:'tower',hp:health[id],power:demand[id],half:22}]));
  Object.assign(structures,{
    pylon:{name:'ПИЛОН',kind:'relay',glyph:'♜',color:'#86e5fa',cost:20,hp:90,power:0,half:17,description:'Передаёт сеть на 180 м. Питает постройки в радиусе 110 м. Разрыв отключает ветку.'},
    generator:{name:'ГЕНЕРАТОР',kind:'supply',glyph:'ϟ',color:'#f6cf7b',cost:100,hp:220,power:0,supply:24,half:24,description:'Даёт 24 МВт, только если подключён к сети ядра. Сам не передаёт энергию.'},
    wall:{name:'СТЕНА',kind:'wall',glyph:'▥',color:'#bac5d4',cost:12,hp:480,power:0,half:30,description:'Блокирует проход. Враги проламывают её, чтобы добраться до базы. Энергия не нужна.'},
    regen:{name:'РЕГЕН-МОДУЛЬ',kind:'repair',glyph:'+',color:'#8ff0b2',cost:85,hp:130,power:6,repair:9,range:105,half:21,description:'Восстанавливает 9 прочности/с ближайшей повреждённой постройке в радиусе 105 м. Не чинит себя.'}
  });
  const core={name:'ЯДРО',kind:'core',color:'#e4f28a',cost:160,hp:600,supply:12,power:0,half:30};
  const terrainTypes={
    basalt:{name:'Базальт',color:'#18242c',detail:'#2e4049',foundation:0,speed:1},
    ash:{name:'Пепельная равнина',color:'#272a29',detail:'#45483e',foundation:6,speed:.9},
    slag:{name:'Шлаковая низина',color:'#152f32',detail:'#285252',foundation:18,speed:.65},
    rubble:{name:'Обломки мегаструктуры',color:'#302a31',detail:'#574451',foundation:12,speed:.8},
    floor:{name:'Подготовленный фундамент',color:'#1a2934',detail:'#3b5262',foundation:0,speed:1}
  };
  // Stable, stateless terrain: visiting distant cells never allocates the intervening world.
  function hash(q,r){let n=Math.imul(q,374761393)^Math.imul(r,668265263)^0x41c64e6d;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
  function terrain(q,r){
    if(Math.max(Math.abs(q),Math.abs(r))<=8)return'basalt';
    const x=q/7,y=r/7,a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;
    const sx=u*u*(3-2*u),sy=v*v*(3-2*v),top=hash(a,b)*(1-sx)+hash(a+1,b)*sx,bottom=hash(a,b+1)*(1-sx)+hash(a+1,b+1)*sx,n=top*(1-sy)+bottom*sy;
    return n<.3?'slag':n<.48?'ash':n<.68?'basalt':'rubble';
  }
  const growth={health:1.16,damage:1.09,bounty:1.12,baseBounty:12};
  const api={structures,core,terrainTypes,terrain,hash,growth,lineLimit:64,cell:60,relayRange:180,serviceRange:110,repairRange:105,maxCell:1e9};
  root.FieldData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
