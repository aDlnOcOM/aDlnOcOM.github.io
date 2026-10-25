(function(root){
  'use strict';
  const C=root.TDCore||require('./td-core.js'),D=root.TDData||require('./td-data.js'),F=root.FieldData||require('./field-data.js'),N=root.TDNumber||require('./td-number.js');
  const key=(q,r)=>`${q},${r}`;
  function cell(value){if(typeof value!=='string'||!/^(-?\d+),(-?\d+)$/.test(value))return null;const [q,r]=value.split(',').map(Number);return Number.isSafeInteger(q)&&Number.isSafeInteger(r)&&Math.abs(q)<=F.maxCell&&Math.abs(r)<=F.maxCell&&key(q,r)===value?{q,r,x:q*F.cell,y:r*F.cell}:null;}
  const finiteLevel=n=>Number.isSafeInteger(n)&&n>0?n:1;
  function definition(t){return t.type==='core'?F.core:F.structures[t.type];}
  function cost(t,count=1){return N.from(definition(t).cost*.7).mul(N.power(1.16,t.level-1)).mul(N.power(1.16,count).sub(1)).div(.16);}
  // Sweep against expanded squares: fast enemies cannot tunnel through walls.
  function intersection(a,b,target,radius){let lo=0,hi=1;const half=definition(target).half+radius;for(const axis of ['x','y']){const delta=b[axis]-a[axis],min=target[axis]-half,max=target[axis]+half;if(Math.abs(delta)<1e-9){if(a[axis]<min||a[axis]>max)return null;}else{let x=(min-a[axis])/delta,y=(max-a[axis])/delta;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return null;}}return lo;}
  class Game extends C.Game{
    constructor(saved){
      super();this.foundations=new Set(['0,0','1,0']);this.buildings=new Map();this.nextBuilding=1;this.camera={x:0,y:0};this.selected='1,0';this.network={capacity:12,demand:4,used:4,links:[],disconnected:0,shed:0};this.powerDirty=true;
      this.core=this.create('0,0','core');this.buildings.set('0,0',this.core);const starter=this.create('1,0','pulse');this.buildings.set(starter.slot,starter);
      this.event='Ядро и стартовая турель готовы. Расширяй сеть пилонами, следи за мощностью.';this.viewport={x:-500,y:-320,width:1000,height:640};this.worldVersion=1;
      if(saved)this.restoreField(saved);this.rebuildPower();
    }
    create(slot,type){const p=cell(slot),def=type==='core'?F.core:F.structures[type];return{...p,slot,type,id:this.nextBuilding++,level:1,evolution:null,hp:N.from(def.hp),maxHp:N.from(def.hp),spent:N.from(def.cost),priority:1,connected:false,powered:false,status:'Нет связи',cooldown:0,angle:0,flash:0,parent:null};}
    allBuildings(){return[...this.buildings.values()];}
    allTowers(){return this.allBuildings().filter(t=>definition(t).kind==='tower');}
    tower(slot){return this.buildings.get(slot)||null;}
    validSlot(slot){return!!cell(slot);}
    terrainAt(slot){const p=cell(slot);if(!p)return null;const id=this.foundations.has(slot)||this.tower(slot)?'floor':F.terrain(p.q,p.r);return{id,...F.terrainTypes[id]};}
    buildCost(slot,type){return N.from((F.structures[type]?.cost||0)+(this.terrainAt(slot)?.foundation||0));}
    lineSlots(from,to,type){
      const a=cell(from),b=cell(to);if(!a||!b||!Object.hasOwn(F.structures,type))return[];
      const distance=Math.abs(b.q-a.q)+Math.abs(b.r-a.r);if(distance>=F.lineLimit)return[];
      const slots=[from];let q=a.q,r=a.r;while(q!==b.q){q+=Math.sign(b.q-q);slots.push(key(q,r));}while(r!==b.r){r+=Math.sign(b.r-r);slots.push(key(q,r));}
      // Relay chains use their full range, keeping corners and both endpoints.
      return type==='pylon'?slots.filter((s,i)=>i===0||i===slots.length-1||i===Math.abs(b.q-a.q)||i%3===0):slots;
    }
    lineQuote(from,to,type){
      const path=this.lineSlots(from,to,type);if(!path.length)return{slots:[],price:N.from(0),reason:`Линия должна занимать не более ${F.lineLimit} клеток.`};
      const slots=path.filter(s=>this.tower(s)?.type!==type);let price=N.from(0),reason='';
      for(const slot of slots){reason=reason||this.canBuild(slot,type);price=price.add(this.buildCost(slot,type));}
      if(!slots.length)reason='Эта линия уже построена.';return{slots,price,reason};
    }
    buildLine(from,to,type){const quote=this.lineQuote(from,to,type);if(quote.reason||!this.credits.gte(quote.price)){this.say(quote.reason||'Недостаточно очков для всей линии.');return false;}for(const slot of quote.slots)this.build(slot,type);this.say(`Построено блоков: ${quote.slots.length}. Потрачено ${quote.price.format()} очков.`);return true;}
    income(){return N.from(0);}
    offline(){this.lastReward=null;return N.from(0);}
    bounty(e){return N.from(F.growth.baseBounty*e.reward*(1+(e.mark||0))).mul(N.power(F.growth.bounty,(e.wave||this.wave)-1)).mul(N.power(1.25,this.research.income));}
    enemyDamage(e){return N.from(e.damage).mul(N.power(F.growth.damage,(e.wave||this.wave)-1));}
    damage(e,amount){if(e.dead)return;e.hp=e.hp.sub(N.from(amount));e.flash=.12;if(e.hp.log!==-Infinity)return;e.dead=true;this.kills++;this.credits=this.credits.add(this.bounty(e));this.effect({kind:'burst',x:e.x,y:e.y,radius:e.boss?42:16,color:e.color,life:.3});}
    neighbors(t){return this.allTowers().filter(o=>o!==t&&o.powered&&C.dist(t,o)<=D.linkRange);}
    links(){return super.links(false);}
    structureHp(t){return N.from(definition(t).hp).mul(N.power(1.14,t.level-1)).mul(1+this.research.hull*.15);}
    powerNeed(t){return definition(t).power?definition(t).power+Math.floor((t.level-1)/10):0;}
    supply(t){return definition(t).supply||0;}
    generatorSupply(t){return this.supply(t)*(1+(t.level-1)*.25);}
    nearby(p,radius){const found=[],reach=Math.ceil((radius+30)/F.cell);for(let q=p.q-reach;q<=p.q+reach;q++)for(let r=p.r-reach;r<=p.r+reach;r++){const t=this.tower(key(q,r));if(t&&C.dist(t,p)<=radius+30)found.push(t);}return found;}
    rebuildPower(){
      if(!this.powerDirty)return;this.powerDirty=false;const all=this.allBuildings(),links=[];
      for(const t of all){t.connected=false;t.powered=false;t.parent=null;t.status=t.type==='wall'?'Пассивная защита':'Нет связи';if(t.type==='wall')t.powered=true;}
      this.core.connected=this.core.powered=this.core.hp.log!==-Infinity;this.core.status='Источник';const queue=this.core.powered?[this.core]:[];
      for(let i=0;i<queue.length;i++){const a=queue[i];for(const b of this.nearby(a,F.relayRange)){if(b.type!=='pylon'||b.connected||C.dist(a,b)>F.relayRange)continue;b.connected=b.powered=true;b.status='Передача энергии';b.parent=a.slot;links.push({a,b});queue.push(b);}}
      let capacity=this.core.powered?this.generatorSupply(this.core):0,demand=0,used=0,disconnected=0,shed=0;
      for(const t of all){if(['core','pylon','wall'].includes(t.type))continue;
        const parent=this.nearby(t,F.serviceRange).filter(p=>(p.type==='core'||p.type==='pylon')&&p.connected&&C.dist(t,p)<=F.serviceRange).sort((a,b)=>C.dist(t,a)-C.dist(t,b)||a.id-b.id)[0];
        if(parent){t.connected=true;t.parent=parent.slot;links.push({a:parent,b:t});if(t.type==='generator'){capacity+=this.generatorSupply(t);t.powered=true;t.status='Генерация';}}
      }
      const consumers=all.filter(t=>this.powerNeed(t)>0).sort((a,b)=>b.priority-a.priority||a.id-b.id);
      for(const t of consumers){if(!t.connected){disconnected++;continue;}const need=this.powerNeed(t);demand+=need;if(used+need<=capacity){used+=need;t.powered=true;t.status='Работает';}else{shed++;t.status='Дефицит мощности';}}
      disconnected+=all.filter(t=>['pylon','generator'].includes(t.type)&&!t.connected).length;
      this.network={capacity,demand,used,links,disconnected,shed};
    }
    canBuild(slot,type){const p=cell(slot);if(!p||!Object.hasOwn(F.structures,type))return'Недопустимая клетка или чертёж.';if(this.tower(slot))return'Клетка занята.';if(this.enemies.some(e=>!e.dead&&Math.abs(e.x-p.x)<definition({type}).half+e.radius&&Math.abs(e.y-p.y)<definition({type}).half+e.radius))return'На клетке находится враг.';return'';}
    build(slot,type){const reason=this.canBuild(slot,type);if(reason){this.say(reason);return false;}const price=this.buildCost(slot,type);if(!this.credits.gte(price)){this.say('Недостаточно очков.');return false;}this.credits=this.credits.sub(price);const t=this.create(slot,type);t.maxHp=t.hp=this.structureHp(t);this.foundations.add(slot);this.buildings.set(slot,t);this.plans.delete(slot);this.powerDirty=true;this.rebuildPower();this.say(`${F.structures[type].name}: ${slot}. ${t.status}.`);return true;}
    plan(slot,type){if(!this.canAutomate('build')||this.canBuild(slot,type))return false;this.plans.set(slot,type);this.say(`В очередь: ${F.structures[type].name}, клетка ${slot}.`);return true;}
    upgradeCost(slot,count=1){const t=this.tower(slot);return t&&Number.isSafeInteger(count)&&count>0?cost(t,count):N.from(0);}
    affordableCount(slot){const t=this.tower(slot);if(!t||!this.credits.gte(cost(t)))return 0;let n=Math.min(Number.MAX_SAFE_INTEGER-t.level,Math.floor(this.credits.mul(.16).div(cost(t)).add(1).log/Math.log10(1.16)+1e-9));if(n>0&&!this.credits.gte(cost(t,n)))n--;return Math.max(0,n);}
    upgrade(slot,count=1){const t=this.tower(slot);if(!t||!Number.isSafeInteger(count)||count<1||!Number.isSafeInteger(t.level+count))return false;const price=cost(t,count);if(!this.credits.gte(price))return false;this.credits=this.credits.sub(price);t.spent=t.spent.add(price);const ratio=t.hp.ratio(t.maxHp);t.level+=count;t.maxHp=this.structureHp(t);t.hp=t.maxHp.mul(ratio);this.powerDirty=true;this.rebuildPower();this.say(`${definition(t).name}: уровень ${t.level}.`);return true;}
    sell(slot){const t=this.tower(slot);if(!t||t===this.core)return false;const refund=t.spent.mul(.7*t.hp.ratio(t.maxHp));this.credits=this.credits.add(refund);this.remove(t);this.say(`Демонтировано. Возвращено ${refund.format()} очков с учётом повреждений. Фундамент сохранён.`);return true;}
    remove(t){if(t===this.core)return;this.buildings.delete(t.slot);this.plans.delete(t.slot);this.powerDirty=true;this.rebuildPower();}
    setPriority(slot,n){const t=this.tower(slot);if(!t||![0,1,2].includes(n))return false;t.priority=n;this.powerDirty=true;this.rebuildPower();return true;}
    evolveOptions(slot){const t=this.tower(slot);return t&&definition(t).kind==='tower'?super.evolveOptions(slot):[];}
    attack(t){if(!t.powered||definition(t).kind!=='tower')return false;return super.attack(t);}
    buyResearch(id){if(!super.buyResearch(id))return false;if(id==='hull')for(const t of this.allBuildings()){const ratio=t.hp.ratio(t.maxHp);t.maxHp=this.structureHp(t);t.hp=t.maxHp.mul(ratio);}return true;}
    automate(){
      if(this.auto.build&&this.canAutomate('build'))for(const [slot,type]of this.plans){if(!this.canBuild(slot,type)){this.build(slot,type);return;}if(this.tower(slot))this.plans.delete(slot);}
      if(this.auto.evolve&&this.canAutomate('evolve')){const option=this.allTowers().flatMap(t=>this.evolveOptions(t.slot).filter(e=>e.ready).slice(0,1).map(e=>({...e,slot:t.slot}))).sort((a,b)=>a.cost.log-b.cost.log)[0];if(option){this.evolve(option.slot,option.id);return;}}
      if(this.auto.upgrade&&this.canAutomate('upgrade')){const t=this.allTowers().filter(t=>t.powered).sort((a,b)=>cost(a).log-cost(b).log)[0];if(t)this.upgrade(t.slot);}
    }
    start(){if(this.phase!=='ready')return false;this.started=true;this.phase='between';this.timer=2;this.say('Круговая оборона активирована.');return true;}
    spawn(){
      const e=super.spawn(),angle=(this.spawned-1)%8*Math.PI/4+this.wave*.31+Math.floor((this.spawned-1)/8)*.17;
      e.wave=this.wave;e.hp=e.maxHp=N.from(24*D.enemies[e.type].hp).mul(N.power(F.growth.health,this.wave-1));
      // Perimeter grows with the connected base, not with unpowered remote decoys.
      const reach=this.allBuildings().reduce((r,t)=>t.connected?Math.max(r,Math.hypot(t.x,t.y)):r,0),radius=Math.max(480,reach+300);
      e.x=Math.cos(angle)*radius;e.y=Math.sin(angle)*radius;e.angle=angle+Math.PI;e.progress=-Math.hypot(e.x,e.y);e.attackClock=0;e.think=0;e.target='0,0';return e;
    }
    target(e){return this.allBuildings().reduce((best,t)=>{const priority=t.type==='generator'?.85:t.type==='pylon'?.9:1;const score=C.dist(e,t)*priority;return score<best.score?{t,score}:best;},{t:this.core,score:Infinity}).t;}
    hurt(t,amount){if(t.hp.log===-Infinity)return;t.hp=t.hp.sub(amount);t.flash=.18;if(t.hp.log===-Infinity){this.effect({kind:'burst',x:t.x,y:t.y,radius:42,color:definition(t).color,life:.4});if(t!==this.core){this.say(`${definition(t).name} уничтожен в ${t.slot}.`);this.remove(t);}else{this.powerDirty=true;this.rebuildPower();}}}
    moveEnemy(e,dt){
      e.think-=dt;let target=this.tower(e.target);if(!target||e.think<=0){target=this.target(e);e.target=target.slot;e.think=.5;}
      const ground=this.terrainAt(key(Math.round(e.x/F.cell),Math.round(e.y/F.cell)));
      const dx=target.x-e.x,dy=target.y-e.y,length=Math.hypot(dx,dy)||1,speed=e.speed*Math.min(1.7,1+Math.log2(this.wave+1)*.03)*e.slowFactor*(ground?.speed||1);
      const next={x:e.x+dx/length*Math.min(length,speed*dt),y:e.y+dy/length*Math.min(length,speed*dt)};e.angle=Math.atan2(dy,dx);
      const p={q:Math.round(e.x/F.cell),r:Math.round(e.y/F.cell),x:e.x,y:e.y};let blocker=null,hit=1;
      for(const t of this.nearby(p,Math.max(80,speed*dt+40))){const at=intersection(e,next,t,e.radius+2);if(at!==null&&at<=hit){hit=at;blocker=t;}}
      e.x+=(next.x-e.x)*Math.max(0,hit-.001);e.y+=(next.y-e.y)*Math.max(0,hit-.001);e.progress=-Math.hypot(e.x,e.y);e.attackClock=Math.max(0,e.attackClock-dt);
      if(blocker&&e.attackClock<=0){this.hurt(blocker,this.enemyDamage(e));e.attackClock=e.boss?.8:1;this.effect({kind:'beam',x:e.x,y:e.y,toX:blocker.x,toY:blocker.y,color:e.color,life:.12});}
    }
    repairStructures(dt){
      // Simultaneous accumulated healing, with a per-target cap: stacking cannot grant invulnerability.
      const repairs=new Map();for(const t of this.allBuildings()){if(t.type!=='regen'||!t.powered)continue;
        const target=this.nearby(t,F.repairRange).filter(o=>o!==t&&o.hp.log!==-Infinity&&o.hp.ratio(o.maxHp)<.999999&&C.dist(t,o)<=F.repairRange).sort((a,b)=>a.hp.ratio(a.maxHp)-b.hp.ratio(b.maxHp)||a.id-b.id)[0];
        if(!target)continue;const amount=N.from(F.structures.regen.repair).mul(N.power(1.14,t.level-1)).mul(dt);repairs.set(target,(repairs.get(target)||N.from(0)).add(amount));
        t.cooldown-=dt;if(t.cooldown<=0){this.effect({kind:'beam',x:t.x,y:t.y,toX:target.x,toY:target.y,color:'#8ff0b2',life:.25});t.cooldown=.5;}
      }
      for(const [t,amount]of repairs){const cap=t.maxHp.mul(.04*dt),heal=amount.gte(cap)?cap:amount;t.hp=t.hp.add(heal);if(t.hp.gte(t.maxHp))t.hp=t.maxHp;}
    }
    complete(){
      this.best=Math.max(this.best,this.wave);this.cycleBest=Math.max(this.cycleBest,this.wave);
      if(this.wave%10===0){const reward=N.power(1.08,this.wave/10-1);this.cores=this.cores.add(reward);this.say(`Волна ${this.wave}: +${reward.format()} нейроядер.`);}else this.say(`Волна ${this.wave} отражена. Очки получены за уничтоженных врагов.`);
      this.wave++;this.phase='between';this.timer=3;this.core.hp=this.core.hp.add(this.core.maxHp.mul(.06));if(this.core.hp.gte(this.core.maxHp))this.core.hp=this.core.maxHp;
    }
    step(dt){
      if(!this.started||this.paused||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.1,dt);this.time+=dt;this.rebuildPower();
      this.autoClock-=dt;if(this.autoClock<=0){this.autoClock=.5;this.automate();}
      for(const t of this.allBuildings()){t.flash=Math.max(0,t.flash-dt);if(t.type!=='regen')t.cooldown=Math.max(0,t.cooldown-dt);}
      for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);
      if(this.phase==='repair'){this.timer-=dt;if(this.timer<=0){this.core.hp=this.core.maxHp;this.powerDirty=true;this.rebuildPower();this.started=false;this.phase='ready';if(!this.credits.gte(150))this.credits=N.from(150);this.say('Ядро восстановлено. Проверь сеть и запусти оборону. Уничтоженные постройки нужно построить заново.');}return;}
      this.repairStructures(dt);
      if(this.phase==='between'){this.timer-=dt;if(this.timer<=0){this.phase='wave';this.total=Math.min(80,8+Math.floor(this.wave*1.5));this.spawned=0;this.spawnClock=0;this.say(`Волна ${this.wave}: атака со всех сторон.`);}return;}
      this.spawnClock-=dt;while(this.spawnClock<=0&&this.spawned<this.total&&this.enemies.length<D.limits.enemies){this.spawn();this.spawnClock+=.65;}
      for(const e of this.enemies){if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);if(e.burnTime>0){this.damage(e,e.burnDamage.mul(Math.min(dt,e.burnTime)));e.burnTime=Math.max(0,e.burnTime-dt);}if(e.dead)continue;e.slowTime=Math.max(0,e.slowTime-dt);if(e.slowTime===0){e.slowFactor=1;e.vulnerable=0;}this.moveEnemy(e,dt);if(this.core.hp.log===-Infinity)break;}
      if(this.core.hp.log===-Infinity){this.defeats++;this.enemies=[];this.phase='repair';this.timer=8;this.wave=Math.max(1,Math.floor((this.wave-1)/10)*10+1);this.say('Ядро разрушено. Восстановление 8 с. Потерянные сооружения не возвращаются.');return;}
      for(const t of this.allTowers())if(t.cooldown<=0)this.attack(t);
      this.enemies=this.enemies.filter(e=>!e.dead);if(this.spawned>=this.total&&!this.enemies.length)this.complete();
    }
    prestige(){const reward=this.prestigeReward();if(reward.log===-Infinity)return false;const keep={cores:this.cores.add(reward),research:{...this.research},best:this.best,prestiges:this.prestiges+1,kills:this.kills,defeats:this.defeats,auto:{...this.auto},speed:this.speed,reducedMotion:this.reducedMotion};Object.assign(this,new Game(),keep);for(const t of this.allBuildings())t.hp=t.maxHp=this.structureHp(t);this.rebuildPower();this.say('Новый цикл: ядро и простая турель. Исследования сохранены.');return true;}
    serialize(){return{version:1,mode:'field',terrainVersion:1,foundations:[...this.foundations],credits:this.credits.toJSON(),cores:this.cores.toJSON(),research:{...this.research},buildings:this.allBuildings().map(t=>({slot:t.slot,type:t.type,level:t.level,evolution:t.evolution,hp:t.hp.toJSON(),spent:t.spent.toJSON(),priority:t.priority})),plans:[...this.plans],camera:{...this.camera},selected:this.selected,wave:this.wave,best:this.best,cycleBest:this.cycleBest,prestiges:this.prestiges,kills:this.kills,defeats:this.defeats,started:this.started,paused:this.paused,repair:this.phase==='repair',auto:{...this.auto},speed:this.speed,reducedMotion:this.reducedMotion};}
    restoreField(v){
      if(!v||v.mode!=='field'||v.version!==1)return;for(const id of Object.keys(D.research))this.research[id]=Math.min(D.research[id].max||Number.MAX_SAFE_INTEGER,Number.isSafeInteger(v.research?.[id])&&v.research[id]>=0?v.research[id]:0);
      if(Array.isArray(v.foundations))for(const slot of v.foundations)if(cell(slot))this.foundations.add(slot);
      if(v.credits===null||Number.isFinite(v.credits))this.credits=N.load(v.credits);if(v.cores===null||Number.isFinite(v.cores))this.cores=N.load(v.cores);
      if(Array.isArray(v.buildings)){this.buildings.clear();for(const saved of v.buildings){if(!saved||!cell(saved.slot)||saved.type==='core'&&saved.slot!=='0,0'||saved.slot==='0,0'&&saved.type!=='core'||saved.type!=='core'&&!Object.hasOwn(F.structures,saved.type)||this.buildings.has(saved.slot))continue;
          const t=this.create(saved.slot,saved.type);t.level=finiteLevel(saved.level);t.maxHp=this.structureHp(t);t.hp=saved.hp===null?N.from(0):Number.isFinite(saved.hp)?N.load(saved.hp):t.maxHp;if(t.hp.gte(t.maxHp))t.hp=t.maxHp;if(t.hp.log===-Infinity&&t.type!=='core')continue;
          t.spent=Number.isFinite(saved.spent)?N.load(saved.spent):N.from(definition(t).cost);t.priority=[0,1,2].includes(saved.priority)?saved.priority:1;t.evolution=D.evolutions[t.type]?.some(e=>e.id===saved.evolution)&&t.level>=10?saved.evolution:null;this.buildings.set(t.slot,t);
        }this.core=this.tower('0,0');if(!this.core){this.core=this.create('0,0','core');this.core.hp=this.core.maxHp=this.structureHp(this.core);this.buildings.set('0,0',this.core);}}
      for(const t of this.allBuildings())this.foundations.add(t.slot);
      for(const id of ['best','cycleBest','prestiges','kills','defeats'])this[id]=Number.isSafeInteger(v[id])&&v[id]>=0?v[id]:0;this.best=Math.max(this.best,this.cycleBest);this.wave=Math.min(finiteLevel(v.wave),this.best+1);
      this.started=v.started===true;this.paused=v.paused===true;this.phase=this.core.hp.log===-Infinity?'repair':this.started?'between':'ready';if(this.phase==='repair')this.started=true;this.timer=this.phase==='repair'?8:2;
      for(const id of Object.keys(this.auto))this.auto[id]=this.canAutomate(id)&&v.auto?.[id]===true;
      if(Array.isArray(v.plans)&&this.canAutomate('build'))for(const p of v.plans)if(Array.isArray(p)&&cell(p[0])&&!this.tower(p[0])&&Object.hasOwn(F.structures,p[1]))this.plans.set(p[0],p[1]);
      for(const axis of ['x','y'])this.camera[axis]=Number.isFinite(v.camera?.[axis])?C.clamp(v.camera[axis],-F.maxCell*60,F.maxCell*60):0;this.selected=cell(v.selected)?v.selected:'1,0';this.speed=[1,2,4].includes(v.speed)?v.speed:1;this.reducedMotion=typeof v.reducedMotion==='boolean'?v.reducedMotion:null;this.powerDirty=true;
    }
  }
  const api={Game,key,cell,cost,definition,intersection};root.FieldCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
