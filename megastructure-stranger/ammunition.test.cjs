const {test}=require('node:test'),assert=require('node:assert/strict'),game=require('./combat-harness.cjs');
test('advanced round programs trade damage for penetration and require funded research',()=>{
 const {g,Workshop:W,Ammunition:A,Resources:R}=game(),p=g.get(),gun=W.equipped(p,'smg');
 W.selectAmmo(p,gun.uid,'penetrator');assert.ok(W.ammoQuote(p).reason);
 p.workshop.table=5;p.resources=Object.fromEntries(R.catalog.map(r=>[r.id,100]));p.workshop.research=Object.fromEntries(R.catalog.map(r=>[r.id,true]));
 assert.equal(W.ammoQuote(p).reason,'');const stats=g.playerStats(),shot=A.shot(stats,{cartridge:A.get('energy','penetrator')});
 assert.ok(shot.damage<stats.damage);assert.ok(shot.penetration>stats.weaponProfile.penetration);
 assert.equal(W.selectAmmo(p,gun.uid,'invalid'),'Неизвестная программа');
});
test('live selected cartridge controls projectile velocity and terminal damage',()=>{
 const {g,Workshop:W}=game(),s=g.state;W.equipped(g.get(),'smg').roundVariant='quiet';s.powerInventory=g.createPowerStock();g.resetPlayer();
 const stats=g.playerStats();g.fireSmg();const bullet=s.bullets[0];assert.ok(bullet);assert.ok(Math.abs(Math.hypot(bullet.vx,bullet.vy)-stats.bulletSpeed*.72)<1e-6);assert.ok(bullet.damage<stats.damage);
});
