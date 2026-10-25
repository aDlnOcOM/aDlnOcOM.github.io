(function(root){
  'use strict';
  const C=root.TowerCore||require('./tower-core.js'),KEY='neon-ante:v1';
  class Store{
    constructor(storage){this.storage=storage;this.error='';this.recovery=null;}
    load(){let raw;try{raw=this.storage?.getItem(KEY);if(!raw)return new C.Game();const v=JSON.parse(raw);if(v.version!==1)throw Error('version');const game=new C.Game(v);if(v.run&&!game.run){this.recovery=raw;this.error='Повреждённый забег: коллекция сохранена, исходник будет зарезервирован.';}return game;}catch{this.recovery=raw||null;this.error='Сохранение не прочитано. Исходник будет зарезервирован.';return new C.Game();}}
    save(game){try{if(!this.storage)throw Error('storage');if(this.recovery){this.storage.setItem(KEY+':recovery',this.recovery);this.recovery=null;}this.storage.setItem(KEY,JSON.stringify(game.serialize()));this.error='';return true;}catch{this.error='Не удалось сохранить: прогресс только в памяти. Не закрывайте вкладку.';return false;}}
  }
  const api={Store,KEY};root.TowerStorage=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
