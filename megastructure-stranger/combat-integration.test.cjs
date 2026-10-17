const {test}=require('node:test'),assert=require('node:assert/strict'),game=require('./combat-harness.cjs');
test('floor transitions preserve wounds, treatment charges and heat',()=>{
 const {g,FieldMedicine:M,WeaponHandling:H}=game(),s=g.state;g.damagePlayer(5,'ballistic',0,{zone:'arms'});
 const health=s.player.health;H.init(s.player,g.playerStats()).heat=.7;M.start(s.player,s.medicine,'medkit');g.resetPlayer();
 assert.equal(s.player.health,health);assert.equal(s.player.handling.heat,.7);assert.equal(s.player.treatment,undefined);assert.equal(s.medicine.medkit,2);
});
test('live wounds wear only the struck armor; ongoing trauma can kill without a new projectile',()=>{
 const {g,Workshop:W}=game(),s=g.state,p=g.get(),helmet=W.equipped(p,'helmet'),chest=W.equipped(p,'chest');
 g.damagePlayer(3,'ballistic',0,{zone:'head'});assert.ok(helmet.condition<100);assert.equal(chest.condition,100);
 s.player.body.parts.thorax.health=.001;s.player.body.lastZone='thorax';s.player.body.status.bleed=1;g.updatePlayer(.1);
 assert.equal(s.active,false);assert.equal(s.player.health,0);g.updatePlayer(.1);assert.equal(s.player.health,0);
});
test('enemy robotic head damage degrades armor without biological instant death',()=>{
 const {g}=game(),enemy={type:'breaker',boss:true,x:500,y:300,health:1100,maxHealth:1100,reward:10};g.state.enemies=[enemy];
 g.damageEnemy(enemy,100,'ballistic',.5,{zone:'head'});assert.ok(enemy.health>0);assert.equal(enemy.body.status.bleed,0);assert.ok(enemy.shell<100);
});
test('repeated hits on the same destroyed robotic component eventually destroy the unit once',()=>{
 const {g}=game(),s=g.state,e={type:'turret',x:500,y:300,radius:16,health:100,maxHealth:100,reward:10};s.enemies=[e];
 for(let i=0;i<100;i++)g.damageEnemy(e,10,'mechanical',.5,{zone:'thorax'});
 assert.equal(s.enemies.length,0);assert.equal(s.runSalvage,10);assert.equal(e.health,0);
});
test('direct critical death is latched and cannot be healed on the next player tick',()=>{
 const {g}=game(),s=g.state;g.damagePlayer(100,'mechanical',.9,{zone:'head'});assert.equal(s.player.deathHandled,true);g.updatePlayer(.1);assert.equal(s.player.health,0);assert.equal(s.active,false);
});
