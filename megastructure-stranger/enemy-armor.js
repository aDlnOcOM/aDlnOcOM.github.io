(() => {
 'use strict';
 const profiles={watcher:['soft',3,.08],drone:['composite',2,.05],turret:['steel',9,.15],burstTurret:['steel',7,.25],enforcer:['composite',8,.24],marksman:['soft',4,.42],warden:['composite',10,.32],breaker:['steel',14,.45]};
 function init(enemy){
   if(!window.CombatModel)return;
   if(!enemy.body){enemy.body=window.CombatModel.createBody(enemy.maxHealth||enemy.health);enemy.body.robotic=true;}
   enemy.shell ??= 100;
 }
 function layers(enemy,zone){
   init(enemy);const [material,protection]=profiles[enemy.type]||['soft',0];
   const exposed=zone==='arms'||zone==='legs';
   return [{id:'chassis',material,protection:protection*(exposed?.4:1),integrity:enemy.shell,damage:n=>{enemy.shell=Math.max(0,enemy.shell-n*.6);}}];
 }
 function penetration(enemy){return profiles[enemy.type]?.[2]||0;}
 window.EnemyArmor={profiles,init,layers,penetration};
})();
