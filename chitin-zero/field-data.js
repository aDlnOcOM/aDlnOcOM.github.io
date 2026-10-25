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
  const api={structures,core,cell:60,relayRange:180,serviceRange:110,repairRange:105,maxCell:1e9};
  root.FieldData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
