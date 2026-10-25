(function(root){
  'use strict';
  const C=root.FieldCore||require('./field-core.js');
  const KEY='neon-bastion:field:v1';
  class Store{
    constructor(storage,now=()=>Date.now()){this.storage=storage;this.now=now;this.error='';this.stamp=0;this.recovery=null;}
    load(){
      let saved,raw;
      try{raw=this.storage?.getItem(KEY);saved=raw?JSON.parse(raw):null;if(raw&&(saved?.game?.version!==1||saved?.game?.mode!=='field')){this.recovery=raw;saved=null;this.error='Неизвестный формат: исходные данные будут сохранены в резервной копии.';}if(!this.storage)this.error='Хранилище недоступно: прогресс только в памяти.';}
      catch{this.recovery=raw||null;this.error='Сохранение не прочитано. Исходные данные будут сохранены в резервной копии.';}
      const game=new C.Game(saved?.game),stamp=Number.isFinite(saved?.savedAt)?saved.savedAt:this.now();
      game.offline(Math.max(0,(this.now()-stamp)/1000));this.stamp=this.now();return game;
    }
    save(game){
      try{if(!this.storage)throw Error();if(this.recovery){this.storage.setItem(`${KEY}:recovery`,this.recovery);this.recovery=null;}const stamp=this.now();this.storage.setItem(KEY,JSON.stringify({savedAt:stamp,game:game.serialize()}));this.stamp=stamp;this.error='';return true;}
      catch{this.error='Не удалось сохранить. Прогресс сейчас только в памяти; не закрывай вкладку.';return false;}
    }
  }
  const api={Store,KEY};root.FieldStorage=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
