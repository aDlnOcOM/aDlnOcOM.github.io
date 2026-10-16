const {test}=require('node:test'),assert=require('node:assert/strict'),game=require('./combat-harness.cjs');
test('fast projectile hits thin cover before the target even when its endpoint passes both',()=>{
 const {ProjectilePhysics:P}=game(),b={x:0,y:50,radius:2},end={x:200,y:50},enemy={x:130,y:50,radius:10,health:10};
 assert.equal(P.trace(b,end,[{x:80,y:0,width:2,height:100}],[enemy]).kind,'wall');
 assert.equal(P.trace(b,end,[],[enemy]).kind,'target');
 assert.equal(P.trace(b,{x:200,y:100},[],[{...enemy,y:200}]),null);
});
test('live rail-speed bullets cannot cross a thin wall or miss a small actor between frames',()=>{
 const {g}=game(),s=g.state,enemy={type:'drone',x:130,y:50,radius:8,health:100,maxHealth:100};s.enemies=[enemy];
 const shot=()=>({owner:'player',x:50,y:50,vx:3000,vy:0,radius:2,damage:10,damageType:'energy',lifetime:1});
 s.floorMap.walls=[{x:100,y:20,width:2,height:60}];s.bullets=[shot()];g.updateBullets(.05);assert.equal(enemy.health,100);assert.equal(s.bullets.length,0);
 s.floorMap.walls=[];s.bullets=[shot()];g.updateBullets(.05);assert.ok(enemy.health<100);assert.equal(s.bullets.length,0);
});
test('falloff is bounded and stopped bullets cannot suppress through cover',()=>{
 const {g,ProjectilePhysics:P}=game(),s=g.state;assert.equal(P.falloff(0),1);assert.equal(P.falloff(99999),.65);
 s.player.x=160;s.player.y=50;s.floorMap.walls=[{x:100,y:0,width:5,height:100}];
 s.bullets=[{owner:'enemy',x:50,y:50,vx:3000,vy:0,radius:2,damage:10,lifetime:1}];g.updateBullets(.05);assert.equal(s.player.body.status.suppression,0);
});
