(() => {
 'use strict';
 const catalog={bandage:{name:'Гемостатическая повязка',seconds:3,status:'bleed',costs:{fabric:2,thread:1}},coolant:{name:'Противоожоговый гель',seconds:4,status:'burn',costs:{acid:1,regen:1}},splint:{name:'Фиксатор конечности',seconds:5,status:'fracture',costs:{plastic:2,fabric:1}},medkit:{name:'Реген-набор',seconds:6,heal:28,costs:{regen:2,fabric:2}},surgery:{name:'Реконструктор ткани',seconds:10,restore:true,costs:{regen:4,pcbReady:1}}};
 function stock(){return {bandage:2,coolant:1,splint:1,medkit:2,surgery:0};}
 function target(body,id){
   const def=catalog[id];if(!def||!body||body.dead)return null;
   if(def.status)return body.status[def.status]>.01?def.status:null;
   const parts=Object.entries(body.parts).filter(([zone,p])=>def.restore?!['head','thorax'].includes(zone)&&p.health<=0:p.health>0&&p.health<p.max);
   parts.sort((a,b)=>a[1].health/a[1].max-b[1].health/b[1].max);
   return parts[0]?.[0]||null;
 }
 function choose(player,supplies){return Object.keys(catalog).find(id=>supplies?.[id]>0&&target(player.body,id));}
 function start(player,supplies,id=choose(player,supplies)){
   if(player.treatment||player.reload||player.dash?.remaining>0||!supplies?.[id]||!target(player.body,id))return false;
   player.treatment={id,remaining:catalog[id].seconds,target:target(player.body,id)};return true;
 }
 function cancel(player){player.treatment=null;}
 function tick(player,supplies,delta){
   const job=player.treatment;if(!job||!Number.isFinite(delta)||delta<=0)return false;
   if(player.body?.dead){cancel(player);return false;}
   job.remaining=Math.max(0,job.remaining-Math.min(delta,.2));if(job.remaining>1e-8)return false;
   const def=catalog[job.id];
   if(supplies[job.id]>0&&target(player.body,job.id)){
     if(def.status)player.body.status[def.status]=0;
     else {const p=player.body.parts[job.target];if(def.restore){p.max*=.8;p.health=p.max*.35;}else p.health=Math.min(p.max,p.health+def.heal);}
     supplies[job.id]--;player.body.status.shock=Math.max(0,player.body.status.shock-.3);
     player.body.health=Object.values(player.body.parts).reduce((sum,p)=>sum+p.health,0);player.health=player.body.health;
   }
   cancel(player);return true;
 }
 window.FieldMedicine={catalog,stock,target,choose,start,cancel,tick};
})();
