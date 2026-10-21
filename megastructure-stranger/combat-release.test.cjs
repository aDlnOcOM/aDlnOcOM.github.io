const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),game=require('./combat-harness.cjs');
test('every local startup script parses and every declared stylesheet is present',()=>{
 const html=fs.readFileSync(`${__dirname}/index.html`,'utf8'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(scripts).size,scripts.length);
 for(const file of scripts){assert.ok(!path.isAbsolute(file)&&!file.includes('..'));new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'),{filename:file});}
 for(const [,file] of html.matchAll(/href="([^"]+\.css)"/g))assert.ok(fs.statSync(path.join(__dirname,file)).size>0);
 for(const module of ['combat-model','field-medicine','ammunition','projectile-physics','armor-system','enemy-armor','combat-hud','gunsmith-ui'])assert.ok(scripts.indexOf(module+'.js')<scripts.indexOf('script.js'));
});
test('all weapon families accept useful bounded builds and every physical component has a compatible host',()=>{
 const {Arsenal:A}=game(),guns=A.items.filter(d=>d.kind==='ranged'),parts=A.items.filter(d=>d.kind==='attachment');
 assert.equal(guns.length,100);assert.equal(parts.length,24);
 for(const part of parts)assert.ok(guns.some(g=>A.canAttach(g,part)),part.id);
 for(const gun of guns){const selected=A.slotsFor(gun).map(slot=>parts.find(p=>p.attachmentSlot===slot&&A.canAttach(gun,p))).filter(Boolean),stats=A.modificationProfile(gun,selected);
   for(const key of ['damage','mass','velocity','magazine','recoil','delay','spread'])assert.ok(Number.isFinite(stats[key])&&stats[key]>0,gun.id+':'+key);
   assert.ok(stats.penetration>=0&&stats.penetration<=.95);assert.ok(stats.ergonomics>=10&&stats.ergonomics<=99);
 }
});
test('starter rounds can destroy each boss within one initial combat stock when hits connect',()=>{
 for(const [type,hp] of [['warden',980],['breaker',1100]]){
   const {g}=game(),enemy={type,boss:true,x:500,y:300,radius:30,health:hp,maxHealth:hp,reward:1};g.state.enemies=[enemy];let shots=0;
   while(enemy.health>0&&shots<246){g.damageEnemy(enemy,9,'energy',.12,{zone:'thorax'});shots++;}
   assert.equal(enemy.health,0,type);assert.ok(shots<200,type);
 }
});
