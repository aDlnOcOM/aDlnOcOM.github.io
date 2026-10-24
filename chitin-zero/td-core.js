(function(root){
  'use strict';
  const D=root.TDData||require('./td-data.js'),N=root.TDNumber||require('./td-number.js');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const segments=D.path.slice(1).map((p,i)=>({a:D.path[i],b:p,length:Math.hypot(p[0]-D.path[i][0],p[1]-D.path[i][1])}));
  const pathLength=segments.reduce((sum,s)=>sum+s.length,0);
  function pointAt(progress){let left=clamp(progress,0,pathLength);for(const s of segments){if(left<=s.length)return{x:s.a[0]+(s.b[0]-s.a[0])*left/s.length,y:s.a[1]+(s.b[1]-s.a[1])*left/s.length};left-=s.length;}return{x:1000,y:520};}
  function safeInt(v,fallback=0){return Number.isSafeInteger(v)&&v>=0?v:fallback;}
  function cost(t,count=1){return N.from(D.towers[t.type].cost*.7).mul(N.power(1.16,t.level-1)).mul(N.power(1.16,count).sub(1)).div(.16);}
  function researchCost(id,level){return N.from(D.research[id].cost).mul(N.power(1.55,level));}
  function evolution(t){return D.evolutions[t.type].find(e=>e.id===t.evolution)||null;}
  function createTower(slot,type){return{slot,type,level:1,evolution:null,cooldown:0,angle:0,flash:0,spent:N.from(D.towers[type].cost),...pointPad(slot)};}
  function pointPad(slot){return{x:D.pads[slot][0],y:D.pads[slot][1]};}
  class Game{
    constructor(saved){
      this.credits=N.from(150);this.cores=N.from(0);this.research=Object.fromEntries(Object.keys(D.research).map(id=>[id,0]));
      this.towers=Array(D.pads.length).fill(null);this.towers[0]=createTower(0,'pulse');this.wave=1;this.best=0;this.cycleBest=0;this.prestiges=0;this.kills=0;this.defeats=0;
      this.started=false;this.paused=false;this.phase='ready';this.timer=0;this.hp=100;this.auto={build:true,upgrade:true,evolve:false};this.speed=1;
      this.enemies=[];this.effects=[];this.time=0;this.spawnClock=0;this.spawned=0;this.total=0;this.autoClock=0;this.id=0;this.lastReward=null;this.event='Сеть готова. Запусти оборону.';this.events=0;this.version=1;
      if(saved)this.restore(saved);
    }
    get maxHp(){return 100+this.research.hull*15;}
    income(){return N.from(1.5).mul(N.power(1.12,Math.max(0,this.best-1))).mul(N.power(1.25,this.research.income));}
    neighbors(t){return this.towers.filter(o=>o&&o!==t&&dist(t,o)<=D.linkRange);}
    has(t,type){return this.neighbors(t).some(o=>o.type===type);}
    links(){const links=[];for(let i=0;i<this.towers.length;i++)for(let j=i+1;j<this.towers.length;j++){const a=this.towers[i],b=this.towers[j];if(!a||!b||dist(a,b)>D.linkRange)continue;const combo=D.combos.find(c=>c.b==='any'?(a.type===c.a||b.type===c.a):(a.type===c.a&&b.type===c.b||b.type===c.a&&a.type===c.b));if(combo)links.push({a,b,combo});}return links;}
    stats(t){
      const s=D.towers[t.type],e=evolution(t)||{},neighbors=this.neighbors(t);
      const aura=Math.max(0,...neighbors.filter(o=>o.type==='nano').map(o=>evolution(o)?.aura||.18));
      const rate=N.power(1.06,this.research.tempo).mul(1+aura).mul(1+Math.log2(t.level)*.025);
      const delay=Math.max(.12,s.delay/Math.min(1e5,rate.number()));
      let damage=N.from(s.damage).mul(N.power(1.16,t.level-1)).mul(N.power(2,Math.floor(t.level/25))).mul(N.power(1.2,this.research.damage)).mul(e.damage||1).mul(rate.mul(delay/s.delay));
      const ballistic=(t.type==='pulse'&&neighbors.some(o=>o.type==='rail'))||(t.type==='rail'&&neighbors.some(o=>o.type==='pulse'));if(ballistic)damage=damage.mul(1.25);
      return{...s,...e,damage,delay,range:s.range+(e.range||0)+Math.min(50,Math.floor(t.level/10)*3),aura,ballistic,targets:e.targets||1,chain:e.chain||s.chain||0,chainFalloff:e.chainFalloff||.8,bounty:e.bounty||.2};
    }
    upgradeCost(slot,count=1){const t=this.towers[slot];return t&&Number.isSafeInteger(count)&&count>0?cost(t,count):N.from(0);}
    affordableCount(slot){const t=this.towers[slot];if(!t)return 0;const first=cost(t);if(!this.credits.gte(first))return 0;const raw=this.credits.mul(.16).div(first).add(1).log/Math.log10(1.16);let count=Math.min(Number.MAX_SAFE_INTEGER-t.level,Math.floor(raw+1e-9));if(count>0&&!this.credits.gte(cost(t,count)))count--;return Math.max(0,count);}
    build(slot,type){
      if(!Number.isInteger(slot)||slot<0||slot>=this.towers.length||this.towers[slot]||!Object.hasOwn(D.towers,type))return false;
      const price=N.from(D.towers[type].cost);if(!this.credits.gte(price))return false;
      this.credits=this.credits.sub(price);this.towers[slot]=createTower(slot,type);this.say(`${D.towers[type].name}: узел ${slot+1} подключён`);return true;
    }
    upgrade(slot,count=1){
      const t=this.towers[slot];if(!t||!Number.isSafeInteger(count)||count<1||!Number.isSafeInteger(t.level+count))return false;
      const price=cost(t,count);if(!this.credits.gte(price))return false;this.credits=this.credits.sub(price);t.spent=t.spent.add(price);t.level+=count;return true;
    }
    sell(slot){const t=this.towers[slot];if(!t)return false;this.credits=this.credits.add(t.spent.mul(.7));this.towers[slot]=null;this.say('Узел демонтирован. Возвращено 70% затрат.');return true;}
    evolveOptions(slot){const t=this.towers[slot];if(!t||t.evolution)return[];return D.evolutions[t.type].map(e=>({...e,ready:t.level>=10&&this.neighbors(t).some(o=>o.type===e.partner&&o.level>=5),cost:cost(t).mul(6)}));}
    evolve(slot,id){const t=this.towers[slot],e=this.evolveOptions(slot).find(e=>e.id===id);if(!t||!e?.ready||!this.credits.gte(e.cost))return false;this.credits=this.credits.sub(e.cost);t.spent=t.spent.add(e.cost);t.evolution=id;this.say(`ЭВОЛЮЦИЯ // ${e.name}`);this.effect({kind:'burst',x:t.x,y:t.y,radius:70,color:D.towers[t.type].color,life:.8});return true;}
    buyResearch(id){if(!Object.hasOwn(D.research,id)||!Number.isSafeInteger(this.research[id]+1))return false;const price=researchCost(id,this.research[id]);if(!this.cores.gte(price))return false;this.cores=this.cores.sub(price);this.research[id]++;if(id==='hull')this.hp+=15;this.say(`${D.research[id].name}: уровень ${this.research[id]}`);return true;}
    prestigeReward(){return this.cycleBest>=20?N.from(Math.floor((this.cycleBest/10)**1.35)):N.from(0);}
    prestige(){
      const reward=this.prestigeReward();if(reward.log===-Infinity)return false;
      const keep={cores:this.cores.add(reward),research:{...this.research},best:this.best,prestiges:this.prestiges+1,kills:this.kills,defeats:this.defeats,auto:{...this.auto},speed:this.speed};
      Object.assign(this,new Game(),keep);this.hp=this.maxHp;this.started=true;this.phase='between';this.timer=3;this.say(`Перезагрузка сети. Получено ${reward.format()} нейроядер.`);return true;
    }
    say(text){this.event=text;this.events++;}
    start(){if(this.phase==='ready'){this.started=true;this.phase='between';this.timer=1;this.say('Протокол обороны активирован.');}}
    spawn(){
      let type='drone';const index=this.spawned;
      if(this.wave%10===0&&index===this.total-1)type='titan';else if(this.wave>=6&&index%5===2)type='shield';else if(this.wave>=4&&index%4===1)type='swarm';else if(this.wave>=2&&index%3===1)type='runner';
      const s=D.enemies[type],hp=N.from(24*s.hp).mul(N.power(1.16,this.wave-1));
      const e={...s,type,id:++this.id,hp,maxHp:hp,progress:0,...pointAt(0),slowTime:0,slowFactor:1,burnTime:0,burnDamage:N.from(0),vulnerable:0,mark:0,dead:false,flash:0};
      this.enemies.push(e);this.spawned++;return e;
    }
    effect(e){if(this.effects.length>=D.limits.effects)this.effects.shift();this.effects.push({...e,max:e.life});}
    damage(e,amount){
      if(e.dead)return;const hit=N.from(amount);e.hp=e.hp.sub(hit);e.flash=.12;if(e.hp.log!==-Infinity)return;
      e.dead=true;this.kills++;const reward=N.from(3*e.reward*(1+e.mark)).mul(N.power(1.12,this.wave-1)).mul(N.power(1.25,this.research.income));this.credits=this.credits.add(reward);
      this.effect({kind:'burst',x:e.x,y:e.y,radius:e.boss?42:16,color:e.color,life:.3});
    }
    hit(t,e,s,scale=1){
      if(e.dead)return;let amount=s.damage.mul(scale);let armor=e.armor||0;if(t.type==='rail')armor*=.5;if(s.ballistic)armor*=.5;
      amount=amount.mul(1-armor).mul(1+e.vulnerable);
      if(e.slowTime>0&&t.type==='arc'&&this.has(t,'frost'))amount=amount.mul(1.5);
      if(e.slowTime>0&&t.type==='plasma'&&this.has(t,'frost')){amount=amount.mul(2);this.effect({kind:'burst',x:e.x,y:e.y,radius:24,color:'#ffffff',life:.2});}
      // Mark before damage, so a lethal nano hit also awards the advertised bounty.
      if(t.type==='nano')e.mark=Math.max(e.mark,s.bounty);
      if(s.slow){e.slowTime=2;e.slowFactor=Math.min(e.slowFactor,s.slow+(e.boss?(1-s.slow)*.5:0));}
      if(s.vulnerable)e.vulnerable=Math.max(e.vulnerable,s.vulnerable);
      if(s.burn){e.burnTime=3;const burn=s.damage.mul(s.burn);if(burn.gte(e.burnDamage))e.burnDamage=burn;}
      this.damage(e,amount);if(s.execute&&!e.dead&&e.hp.ratio(e.maxHp)<s.execute)this.damage(e,e.hp);
    }
    attack(t){
      const s=this.stats(t),targets=this.enemies.filter(e=>!e.dead&&dist(t,e)<=s.range).sort((a,b)=>b.progress-a.progress);if(!targets.length)return false;
      t.cooldown=s.delay;t.flash=.16;t.angle=Math.atan2(targets[0].y-t.y,targets[0].x-t.x);
      const used=new Set();
      for(const primary of targets.slice(0,s.targets)){
        if(primary.dead)continue;let victims=[primary];
        if(s.chain){let from=primary;for(let i=1;i<s.chain;i++){const next=this.enemies.filter(e=>!e.dead&&!victims.includes(e)&&dist(e,from)<120).sort((a,b)=>dist(a,from)-dist(b,from))[0];if(!next)break;victims.push(next);from=next;}}
        else if(s.splash)victims=this.enemies.filter(e=>!e.dead&&dist(e,primary)<=s.splash+e.radius);
        else if(s.pierce){const dx=primary.x-t.x,dy=primary.y-t.y,len=Math.hypot(dx,dy)||1;victims=this.enemies.filter(e=>{const along=((e.x-t.x)*dx+(e.y-t.y)*dy)/len,side=Math.abs((e.x-t.x)*dy-(e.y-t.y)*dx)/len;return!e.dead&&along>0&&along<=s.range&&side<e.radius+5;}).sort((a,b)=>dist(a,t)-dist(b,t)).slice(0,s.pierce);}
        let from=t;for(let i=0;i<victims.length;i++){const e=victims[i];if(used.has(e.id))continue;used.add(e.id);this.hit(t,e,s,s.chain?s.chainFalloff**i:e===primary?1:.8);
          if(s.chain){this.effect({kind:'arc',x:from.x,y:from.y,toX:e.x,toY:e.y,color:s.color,life:.2});from=e;}}
        if(!s.chain)this.effect({kind:t.type==='rail'?'rail':'beam',x:t.x,y:t.y,toX:primary.x,toY:primary.y,color:s.color,life:.16});
        if(s.splash)this.effect({kind:'burst',x:primary.x,y:primary.y,radius:s.splash,color:s.color,life:.35});
      }
      return true;
    }
    automate(){
      // Reserve the next build/evolution budget instead of starving it with cheap upgrades.
      if(this.auto.build){const slot=this.towers.findIndex(t=>!t);if(slot>=0){this.build(slot,D.autoPlan[slot]);return;}}
      if(this.auto.evolve){const options=this.towers.filter(Boolean).flatMap(t=>this.evolveOptions(t.slot).filter(e=>e.ready).slice(0,1).map(e=>({slot:t.slot,...e}))).sort((a,b)=>a.cost.log-b.cost.log);if(options.length){this.evolve(options[0].slot,options[0].id);return;}}
      if(this.auto.upgrade){const t=this.towers.filter(Boolean).sort((a,b)=>cost(a).log-cost(b).log)[0];if(t)this.upgrade(t.slot);}
    }
    complete(){
      this.best=Math.max(this.best,this.wave);this.cycleBest=Math.max(this.cycleBest,this.wave);this.credits=this.credits.add(N.from(15).mul(N.power(1.12,this.wave-1)).mul(N.power(1.25,this.research.income)));
      if(this.wave%10===0){const reward=N.power(1.08,this.wave/10-1);this.cores=this.cores.add(reward);this.say(`Титан уничтожен. +${reward.format()} нейроядер.`);}else this.say(`Волна ${this.wave} отражена. Сеть восстанавливается.`);
      this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.12);this.wave++;this.phase='between';this.timer=3;
    }
    step(dt){
      if(this.paused||!this.started||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.time+=dt;this.credits=this.credits.add(this.income().mul(dt));
      this.autoClock-=dt;if(this.autoClock<=0){this.autoClock=.5;this.automate();}
      for(const t of this.towers)if(t){t.flash=Math.max(0,t.flash-dt);t.cooldown=Math.max(0,t.cooldown-dt);}
      for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);
      if(this.phase==='between'||this.phase==='repair'){
        this.timer-=dt;if(this.timer<=0){if(this.phase==='repair')this.hp=this.maxHp;this.phase='wave';this.total=Math.min(80,10+Math.floor(this.wave*1.5));this.spawned=0;this.spawnClock=0;this.say(`ВОЛНА ${this.wave}${this.wave%10===0?' // ОСАДНЫЙ ТИТАН':''}`);}return;
      }
      this.spawnClock-=dt;while(this.spawnClock<=0&&this.spawned<this.total&&this.enemies.length<D.limits.enemies){this.spawn();this.spawnClock+=Math.max(.14,.65/(1+this.wave/90));}
      for(const e of this.enemies){
        if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);if(e.burnTime>0){this.damage(e,e.burnDamage.mul(Math.min(dt,e.burnTime)));e.burnTime=Math.max(0,e.burnTime-dt);}if(e.dead)continue;
        e.slowTime=Math.max(0,e.slowTime-dt);if(e.slowTime===0){e.slowFactor=1;e.vulnerable=0;}
        e.progress+=e.speed*Math.min(1.8,1+Math.log2(this.wave+1)*.035)*e.slowFactor*dt;Object.assign(e,pointAt(e.progress));
        if(e.progress>=pathLength){e.dead=true;this.hp=Math.max(0,this.hp-e.damage);this.effect({kind:'burst',x:970,y:520,radius:55,color:'#ff466c',life:.4});}
      }
      this.enemies=this.enemies.filter(e=>!e.dead);
      if(this.hp<=0){this.defeats++;this.enemies=[];this.phase='repair';this.timer=8;this.wave=Math.max(1,Math.floor((this.wave-1)/10)*10+1);this.say('ПРОБОЙ ЯДРА // восстановление 8 с. Башни и кредиты сохранены.');return;}
      for(const t of this.towers)if(t&&t.cooldown<=0)this.attack(t);
      this.enemies=this.enemies.filter(e=>!e.dead);if(this.spawned>=this.total&&this.enemies.length===0)this.complete();
    }
    offline(seconds){const elapsed=clamp(Number.isFinite(seconds)?seconds:0,0,D.OFFLINE_CAP);if(!this.started||elapsed<=0)return N.from(0);const reward=this.income().mul(elapsed);this.credits=this.credits.add(reward);this.lastReward={seconds:elapsed,amount:reward};return reward;}
    serialize(){return{version:1,credits:this.credits.toJSON(),cores:this.cores.toJSON(),research:{...this.research},towers:this.towers.map(t=>t?{type:t.type,level:t.level,evolution:t.evolution,spent:t.spent.toJSON()}:null),wave:this.wave,best:this.best,cycleBest:this.cycleBest,prestiges:this.prestiges,kills:this.kills,defeats:this.defeats,hp:this.hp,started:this.started,paused:this.paused,auto:{...this.auto},speed:this.speed};}
    restore(value){
      if(!value||typeof value!=='object'||value.version!==1)return;
      if(value.credits===null||typeof value.credits==='number')this.credits=N.load(value.credits);if(value.cores===null||typeof value.cores==='number')this.cores=N.load(value.cores);
      for(const id of Object.keys(D.research))this.research[id]=safeInt(value.research?.[id]);
      if(Array.isArray(value.towers))this.towers=this.towers.map((_,slot)=>{const t=value.towers[slot];if(!t||!Object.hasOwn(D.towers,t.type))return null;const out=createTower(slot,t.type);out.level=Math.max(1,safeInt(t.level,1));out.evolution=D.evolutions[t.type].some(e=>e.id===t.evolution)&&out.level>=10?t.evolution:null;out.spent=typeof t.spent==='number'&&Number.isFinite(t.spent)?N.load(t.spent):N.from(D.towers[t.type].cost);return out;});
      for(const id of ['best','cycleBest','prestiges','kills','defeats'])this[id]=safeInt(value[id]);this.wave=Math.max(1,safeInt(value.wave,1));this.best=Math.max(this.best,this.cycleBest);this.wave=Math.min(this.wave,this.best+1);
      this.hp=Number.isFinite(value.hp)?clamp(value.hp,1,this.maxHp):this.maxHp;this.started=value.started===true;this.paused=value.paused===true;this.phase=this.started?'between':'ready';this.timer=3;
      for(const id of Object.keys(this.auto))if(typeof value.auto?.[id]==='boolean')this.auto[id]=value.auto[id];this.speed=[1,2,4].includes(value.speed)?value.speed:1;
    }
  }
  const api={Game,pointAt,pathLength,cost,researchCost,evolution,dist,clamp};root.TDCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
