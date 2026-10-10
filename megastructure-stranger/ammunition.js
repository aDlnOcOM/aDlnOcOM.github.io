(() => {
 'use strict';
 const variants={
   standard:{name:'Штатный',damage:1,penetration:0,velocity:1,heat:1,noise:1,tier:0,costs:{}},
   penetrator:{name:'Пробивной',damage:.82,penetration:.24,velocity:1.08,heat:1.18,noise:1.1,tier:3,costs:{alloySteel:3,conductor:2}},
   impact:{name:'Поражающий',damage:1.23,penetration:-.12,velocity:.88,heat:1.12,noise:1,tier:2,costs:{steel:3,acid:2}},
   quiet:{name:'Малошумный',damage:.88,penetration:-.06,velocity:.72,heat:.75,noise:.55,tier:2,costs:{plastic:3,conductor:2}}
 };
 const names={ballistic:['Оболочечный','Твёрдый сердечник','Экспансивный','Дозвуковой'],energy:['Импульс','Фокусированный импульс','Перегрузочный импульс','Маломощный импульс'],elemental:['Термокапсула','Направленная капсула','Насыщенная капсула','Холодная капсула'],mechanical:['Дротик','Игла-пенетратор','Осколочный дротик','Тихий дротик']};
 function get(type='energy',id='standard'){
   if(!variants[id])id='standard';
   return {...variants[id],id,type,name:(names[type]||names.energy)[Object.keys(variants).indexOf(id)]};
 }
 function shot(stats,stock){
   const ammo=stock?.cartridge||get(stock?.type);
   return {damage:stats.damage*ammo.damage,penetration:Math.max(0,Math.min(.95,(stats.weaponProfile?.penetration||0)+ammo.penetration)),velocity:stats.bulletSpeed*ammo.velocity,heat:ammo.heat,noise:ammo.noise};
 }
 window.Ammunition={variants,names,get,shot};
})();
