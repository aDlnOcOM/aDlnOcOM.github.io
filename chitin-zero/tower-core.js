(function(root){
  'use strict';
  const D=root.TowerData||require('./tower-data.js'),N=root.TowerNumber||require('./tower-number.js');
  const own=(obj,key)=>Object.hasOwn(obj,key),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const integer=(n,a,b,fallback=a)=>Number.isSafeInteger(n)?clamp(n,a,b):fallback;
  const freshProfile=()=>({runs:0,wins:0,kills:0,bosses:0,bestAnte:0,flushes:0,discovered:[],deckWins:{}});
  function profile(v){const p=freshProfile();for(const k of ['runs','wins','kills','bosses','bestAnte','flushes'])p[k]=integer(v?.[k],0,1e9);p.discovered=Array.isArray(v?.discovered)?[...new Set(v.discovered.filter(k=>own(D.jokers,k)))]:[];for(const k of Object.keys(D.decks))if(Number.isInteger(v?.deckWins?.[k]))p.deckWins[k]=integer(v.deckWins[k],0,3);return p;}
  function evaluate(cards){
    if(!Array.isArray(cards)||!cards.length||cards.length>5)return null;
    const sorted=[...cards].sort((a,b)=>b.rank-a.rank),groups=[];
    for(const c of sorted){let group=groups.find(g=>g[0].rank===c.rank);if(!group){group=[];groups.push(group);}group.push(c);}
    groups.sort((a,b)=>b.length-a.length||b[0].rank-a[0].rank);
    const flush=cards.length===5&&cards.every(c=>c.suit===cards[0].suit),ranks=[...new Set(sorted.map(c=>c.rank))];
    const straight=ranks.length===5&&(ranks[0]-ranks[4]===4||ranks.join(',')==='14,5,4,3,2');
    let id='high',scoring=[sorted[0]];
    if(groups[0].length===5){id=flush?'flushFive':'five';scoring=sorted;}
    else if(groups[0].length===3&&groups[1]?.length===2){id=flush?'flushFull':'full';scoring=sorted;}
    else if(straight&&flush){id='straightFlush';scoring=sorted;}
    else if(groups[0].length===4){id='four';scoring=groups[0];}
    else if(flush){id='flush';scoring=sorted;}
    else if(straight){id='straight';scoring=sorted;}
    else if(groups[0].length===3){id='three';scoring=groups[0];}
    else if(groups[0].length===2&&groups[1]?.length===2){id='twoPair';scoring=groups[0].concat(groups[1]);}
    else if(groups[0].length===2){id='pair';scoring=groups[0];}
    return{id,scoring,hasPair:groups.some(g=>g.length>=2),flush};
  }
  class Game{
    constructor(saved){this.profile=profile(saved?.profile);this.run=null;this.speed=1;this.reduced=false;this.effects=[];this.visible=true;this.event='Выберите колоду. Башня ведёт огонь сама; комбинацию собираете вы.';if(saved)this.restore(saved);}
    unlockedDeck(id){return id==='signal'||id==='reserve'&&this.profile.kills>=100||id==='prism'&&this.profile.bosses>0||id==='citadel'&&this.profile.wins>0;}
    unlockedJoker(id){if(!own(D.jokers,id))return false;const u=D.jokers[id].unlock;return !u||u==='flush'&&this.profile.flushes>0||u==='kills'&&this.profile.kills>=100||u==='boss'&&this.profile.bosses>0||u==='ante'&&this.profile.bestAnte>=4;}
    maxStake(deck){return Math.min(3,(this.profile.deckWins[deck]??-1)+1);}
    random(){let x=this.run.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;this.run.rng=x>>>0;return this.run.rng/4294967296;}
    pick(array){return array[Math.floor(this.random()*array.length)];}
    shuffle(array){const out=[...array];for(let i=out.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
    newRun(deck='signal',stake=0,seed=Date.now()>>>0){
      if(!own(D.decks,deck)||!this.unlockedDeck(deck)||!Number.isInteger(stake)||stake<0||stake>this.maxStake(deck))return false;
      if(this.run&&!['lost','retired'].includes(this.run.phase))return false;
      const cards=[];for(let suit=0;suit<4;suit++)for(let rank=2;rank<=14;rank++)cards.push({id:cards.length+1,rank,suit:deck==='prism'?suit%2:suit,enhance:'plain'});
      this.run={seed:integer(seed,1,4294967295,1),rng:integer(seed,1,4294967295,1),deck,stake,cards,nextId:53,round:1,cleared:0,cash:deck==='reserve'?20:10,levels:Object.fromEntries(Object.keys(D.hands).map(k=>[k,1])),jokers:[],vouchers:[],phase:'prepare',hand:[],pile:[],selected:[],discards:3,shop:[],pack:null,rerolls:0,active:null,enemies:[],spawned:0,total:0,spawnClock:0,fireClock:0,time:0,kills:0,shots:0,hp:N.of(120),maxHp:N.of(120),paused:false,won:false,receipt:null};
      this.profile.runs++;this.effects=[];this.prepare();this.event='Выберите 1–5 карт. Комбинация и её масти работают весь блайнд.';return true;
    }
    ante(){return this.run?Math.floor((this.run.round-1)/3)+1:1;}
    blind(){const r=this.run,stage=r?(r.round-1)%3:0;return{stage,name:['Малый блайнд','Большой блайнд','Босс-блайнд'][stage],boss:stage===2?D.bosses[(this.ante()-1)%D.bosses.length]:null};}
    handSize(){return(this.run.deck==='reserve'?7:8)+(this.run.vouchers.includes('pocket')?1:0);}
    slots(){return(this.run.deck==='citadel'?4:5)+(this.run.vouchers.includes('slot')?1:0);}
    card(id){return this.run.cards.find(c=>c.id===id);}
    prepare(){const r=this.run;r.phase='prepare';r.pile=this.shuffle(r.cards.map(c=>c.id));r.hand=r.pile.splice(0,this.handSize());r.selected=[];r.discards=3-(r.stake>=2?1:0)+(r.vouchers.includes('discard')?1:0);r.enemies=[];r.active=null;r.shop=[];r.pack=null;this.bestHand();}
    toggle(id){const r=this.run;if(!r||r.phase!=='prepare'||!r.hand.includes(id))return false;if(r.selected.includes(id))r.selected=r.selected.filter(x=>x!==id);else if(r.selected.length<5)r.selected.push(id);else return false;return true;}
    discard(){const r=this.run;if(!r||r.phase!=='prepare'||!r.selected.length||r.discards<=0||r.pile.length<r.selected.length)return false;const ids=new Set(r.selected);r.hand=r.hand.map(id=>ids.has(id)?r.pile.shift():id);r.selected=[];r.discards--;this.event='Карты заменены без возврата в колоду этого блайнда.';return true;}
    score(ids=this.run?.selected,cash=this.run?.cash){
      const r=this.run;if(!r||!ids?.length||ids.length>5||new Set(ids).size!==ids.length)return null;const cards=ids.map(id=>this.card(id));if(cards.some(c=>!c))return null;const hand=evaluate(cards),def=D.hands[hand.id],level=r.levels[hand.id];
      let chips=N.of(def.chips+def.chipStep*(level-1)),mult=N.of(def.mult+def.multStep*(level-1));const counts=[0,0,0,0],trace=[];
      for(const c of hand.scoring){counts[c.suit]++;chips=chips.add(c.rank===14?11:Math.min(10,c.rank));if(c.enhance==='foil')chips=chips.add(30);if(c.enhance==='mult')mult=mult.add(4);if(c.enhance==='steel')mult=mult.mul(1.5);}
      const stats={range:225,delay:.65/(1+counts[2]*.08),targets:1,chain:0,splash:0,crit:Math.min(.6,.05+counts[0]*.06),regen:.3+counts[1]*.4,thorns:0,hull:(1+counts[1]*.18+(level-1)*.15)*(r.deck==='citadel'?1.5:1),bonus:Math.min(3,counts[3])};
      for(let i=0;i<r.jokers.length;i++){const j=D.jokers[r.jokers[i]];if(i===0&&this.blind().boss?.id==='silence'){trace.push(`${j.name}: отключён`);continue;}
        switch(j.kind){case'mult':mult=mult.add(j.value);break;case'chips':chips=chips.add(j.value);break;case'times':mult=mult.mul(j.value);break;case'pair':if(hand.hasPair)mult=mult.add(j.value);break;case'flush':if(hand.flush)mult=mult.mul(j.value);break;case'bank':chips=chips.add(cash*2);break;case'growth':mult=mult.add(r.cleared);break;case'reactor':mult=mult.mul(1+r.cleared*.1);break;case'targets':stats.targets++;break;case'chain':stats.chain=2;break;case'splash':stats.splash=48;break;case'hull':stats.hull*=2;break;case'regen':stats.regen+=2;break;case'thorns':stats.thorns=.25;break;case'range':stats.range+=45;break;case'speed':stats.delay*=.75;break;}
        trace.push(`${j.name} → ${chips.format()} × ${mult.format()}`);
      }
      if(this.blind().boss?.id==='veil')stats.range*=.7;
      return{...stats,cash,hand:hand.id,scoring:hand.scoring.map(c=>c.id),chips,mult,damage:chips.mul(mult).mul(.65),maxHp:N.of(120*stats.hull),trace};
    }
    bestHand(){const r=this.run;if(!r||r.phase!=='prepare')return false;let best=[],power=-Infinity;const ids=r.hand;
      for(let mask=1;mask<(1<<ids.length);mask++){const selection=ids.filter((_,i)=>mask&(1<<i));if(selection.length>5)continue;const score=this.score(selection);if(score.damage.log>power){power=score.damage.log;best=selection;}}
      r.selected=best;return true;
    }
    launch(){const r=this.run;if(!r||r.phase!=='prepare'||r.selected.some(id=>!r.hand.includes(id)))return false;const score=this.score();if(!score)return false;r.active=score;r.hp=r.maxHp=score.maxHp;r.phase='battle';r.paused=false;r.total=Math.min(64,12+this.ante()*2+this.blind().stage*3);r.spawned=0;r.spawnClock=0;r.fireClock=0;r.shots=0;this.effects=[];if(score.hand.toLowerCase().includes('flush'))this.profile.flushes++;this.event=`${D.hands[score.hand].name}: ${score.chips.format()} × ${score.mult.format()}. Башня ведёт огонь автоматически.`;return true;}
    spawn(){const r=this.run;let type='drone';if(this.blind().stage===2&&r.spawned===r.total-1)type='boss';else if(r.round>=4&&r.spawned%5===2)type='tank';else if(r.round>=2&&r.spawned%4===1)type='runner';else if(r.round>=6&&r.spawned%5===3)type='swarm';const d=D.enemies[type],angle=this.random()*Math.PI*2;
      const hp=N.of(20*d.hp*[1,1.25,1.6,2][r.stake]).mul(N.pow(1.18,r.round-1));r.enemies.push({id:++r.spawned,type,x:Math.cos(angle)*330,y:Math.sin(angle)*330,hp,maxHp:hp,attack:0});
    }
    effect(e){if(!this.visible)return;if(this.effects.length>=100)this.effects.shift();this.effects.push({...e,life:e.life||.22,max:e.life||.22});}
    hurt(e,damage){const r=this.run;if(e.hp.log===-Infinity)return;e.hp=e.hp.sub(damage);if(e.hp.log!==-Infinity)return;r.kills++;this.profile.kills++;if(r.kills%5===0)r.cash=Math.min(1e9,r.cash+1);this.effect({x:e.x,y:e.y,color:D.enemies[e.type].color,kind:'burst',radius:20,life:.3});}
    fire(){const r=this.run,s=r.active,targets=r.enemies.filter(e=>e.hp.log!==-Infinity&&Math.hypot(e.x,e.y)<=s.range).sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)).slice(0,s.targets);if(!targets.length)return;
      const armor=this.blind().boss?.id==='armor'?.65:1;r.fireClock=s.delay;r.shots++;
      for(const e of targets){const damage=s.damage.mul(armor*(this.random()<s.crit?2:1));this.hurt(e,damage);this.effect({kind:'beam',x:0,y:0,toX:e.x,toY:e.y,color:'#8cf0e3'});
        if(s.splash)for(const other of r.enemies)if(other!==e&&Math.hypot(other.x-e.x,other.y-e.y)<=s.splash)this.hurt(other,damage.mul(.55));
        if(s.chain){let previous=e;const hit=new Set([e]);for(let i=0;i<s.chain;i++){const next=r.enemies.filter(o=>!hit.has(o)&&o.hp.log!==-Infinity&&Math.hypot(o.x-previous.x,o.y-previous.y)<130).sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y))[0];if(!next)break;this.hurt(next,damage.mul(.6));this.effect({kind:'beam',x:previous.x,y:previous.y,toX:next.x,toY:next.y,color:'#c4acff'});hit.add(next);previous=next;}}
      }
    }
    step(dt){const r=this.run;if(!r||r.phase!=='battle'||r.paused||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);r.time+=dt;for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);r.spawnClock-=dt;
      if(r.spawned<r.total&&r.enemies.length<80&&r.spawnClock<=0){this.spawn();r.spawnClock=.65;}r.fireClock=Math.max(0,r.fireClock-dt);if(r.fireClock<=0)this.fire();
      for(const e of r.enemies){if(e.hp.log===-Infinity)continue;const d=D.enemies[e.type],distance=Math.hypot(e.x,e.y),speed=d.speed*(this.blind().boss?.id==='haste'?1.45:1);if(distance>27+d.radius){const move=Math.min(speed*dt,distance-27-d.radius);e.x-=e.x/distance*move;e.y-=e.y/distance*move;}else{e.attack-=dt;if(e.attack<=0){e.attack=1;r.hp=r.hp.sub(N.of(d.damage*(r.stake>=2?1+(r.stake-1)*.2:1)).mul(N.pow(1.09,r.round-1)));if(r.active.thorns)this.hurt(e,e.maxHp.mul(r.active.thorns));this.effect({kind:'burst',x:0,y:0,color:'#ff879b',radius:32,life:.18});}}
        if(r.hp.log===-Infinity){r.phase='lost';r.paused=false;this.event='Башня разрушена. Коллекция и открытия сохранены; сборка забега потеряна.';return;}
      }
      r.hp=r.hp.add(r.active.regen*dt);if(r.hp.log>r.maxHp.log)r.hp=r.maxHp;r.enemies=r.enemies.filter(e=>e.hp.log!==-Infinity);if(r.spawned>=r.total&&!r.enemies.length)this.complete();
    }
    complete(){const r=this.run;if(!r||r.phase!=='battle'||r.spawned<r.total||r.enemies.some(e=>e.hp.log!==-Infinity))return false;const blind=this.blind(),interest=Math.min(r.vouchers.includes('interest')?10:5,Math.floor(r.cash/5)),base=blind.stage===0&&r.stake>0?0:[3,4,5][blind.stage],bonus=r.active.bonus;
      r.receipt={base,interest,bonus,total:base+interest+bonus};r.cash=Math.min(1e9,r.cash+r.receipt.total);r.active=null;this.effects=[];r.cleared++;this.profile.bestAnte=Math.max(this.profile.bestAnte,this.ante());if(blind.stage===2)this.profile.bosses++;
      if(r.round===24&&!r.won){r.won=true;this.profile.wins++;this.profile.deckWins[r.deck]=Math.max(this.profile.deckWins[r.deck]??-1,r.stake);r.phase='victory';this.event='Анте 8 пройдено! Новая ставка открыта. Можно продолжить бесконечный забег.';}else{r.phase='shop';this.makeShop();this.event=`Блайнд пройден: +$${r.receipt.total}. Выберите покупки или сохраните деньги для процентов.`;}return true;
    }
    continueEndless(){const r=this.run;if(!r||r.phase!=='victory')return false;r.phase='shop';this.makeShop();return true;}
    next(){const r=this.run;if(!r||r.phase!=='shop'||r.pack)return false;r.round++;this.prepare();this.event='Новый блайнд: соберите руку и проверьте условие босса.';return true;}
    retire(){const r=this.run;if(!r||r.phase==='retired')return false;r.phase='retired';r.paused=false;this.effects=[];this.event='Забег завершён. Постоянные открытия сохранены.';return true;}
    item(kind,id){const r=this.run,base=kind==='joker'?D.jokers[id].cost:kind==='planet'?3:kind==='tarot'?D.tarots[id].cost:kind==='voucher'?D.vouchers[id].cost:4;return{kind,id,cost:base+(r.stake===3?1:0),sold:false};}
    makeShop(reroll=false){const r=this.run,pool=Object.keys(D.jokers).filter(id=>this.unlockedJoker(id)&&!r.jokers.includes(id)),first=pool.length?this.item('joker',this.pick(pool)):this.item('planet',this.pick(Object.keys(D.hands))),secondPool=pool.filter(id=>id!==first.id);
      const offers=[first,secondPool.length?this.item('joker',this.pick(secondPool)):this.item('planet',this.pick(Object.keys(D.hands))),this.item('planet',this.pick(Object.keys(D.hands))),this.item('tarot',this.pick(Object.keys(D.tarots)))];
      if(reroll){r.shop.splice(0,4,...offers);return;}r.rerolls=0;const vouchers=Object.keys(D.vouchers).filter(id=>!r.vouchers.includes(id));r.shop=offers;if(vouchers.length)r.shop.push(this.item('voucher',this.pick(vouchers)));r.shop.push(this.item('pack','joker'));
    }
    reroll(){const r=this.run,cost=3+(r?.rerolls||0);if(!r||r.phase!=='shop'||r.pack||r.cash<cost)return false;r.cash-=cost;r.rerolls++;this.makeShop(true);return true;}
    buy(index,targetId){const r=this.run;if(!r||r.phase!=='shop'||r.pack||!Number.isInteger(index))return false;const offer=r.shop[index];if(!offer||offer.sold||r.cash<offer.cost)return false;
      if(offer.kind==='joker'){if(r.jokers.length>=this.slots()||r.jokers.includes(offer.id))return false;r.jokers.push(offer.id);this.discover(offer.id);}
      else if(offer.kind==='planet')r.levels[offer.id]++;
      else if(offer.kind==='voucher'){if(r.vouchers.includes(offer.id))return false;r.vouchers.push(offer.id);}
      else if(offer.kind==='tarot'){const c=this.card(targetId);if(!c)return false;if(offer.id==='clone'){if(r.cards.length>=80)return false;r.cards.push({...c,id:r.nextId++});}else if(offer.id==='remove'){if(r.cards.length<=10)return false;r.cards=r.cards.filter(x=>x.id!==targetId);for(const k of ['hand','pile','selected'])r[k]=r[k].filter(id=>id!==targetId);}else if(offer.id==='heart')c.suit=1;else c.enhance=offer.id;}
      else if(offer.kind==='pack'){const pool=Object.keys(D.jokers).filter(id=>this.unlockedJoker(id)&&!r.jokers.includes(id));if(!pool.length||r.jokers.length>=this.slots())return false;r.pack=this.shuffle(pool).slice(0,3);}
      else return false;r.cash-=offer.cost;offer.sold=true;this.event=offer.kind==='pack'?'Выберите один джокер из набора. Остальные будут потеряны.':'Покупка применена к текущему забегу.';return true;
    }
    discover(id){if(!this.profile.discovered.includes(id))this.profile.discovered.push(id);}
    choosePack(id){const r=this.run;if(!r||r.phase!=='shop'||!r.pack?.includes(id)||r.jokers.length>=this.slots())return false;r.jokers.push(id);this.discover(id);r.pack=null;return true;}
    skipPack(){if(!this.run?.pack)return false;this.run.pack=null;return true;}
    moveJoker(index,delta){const r=this.run;if(!r||!['prepare','shop'].includes(r.phase)||!Number.isInteger(index)||![-1,1].includes(delta)||index<0||index>=r.jokers.length||index+delta<0||index+delta>=r.jokers.length)return false;[r.jokers[index],r.jokers[index+delta]]=[r.jokers[index+delta],r.jokers[index]];return true;}
    sellJoker(index){const r=this.run;if(!r||r.phase!=='shop'||r.pack||!Number.isInteger(index)||!r.jokers[index])return false;r.cash=Math.min(1e9,r.cash+Math.floor(D.jokers[r.jokers[index]].cost/2));r.jokers.splice(index,1);return true;}
    serialize(){return{version:1,profile:this.profile,run:this.run,speed:this.speed,reduced:this.reduced};}
    restore(saved){
      if(saved?.version!==1)return;this.speed=[1,2,4].includes(saved.speed)?saved.speed:1;this.reduced=saved.reduced===true;const v=saved.run;if(!v)return;
      // Reject inconsistent snapshots as a unit: never resurrect a partial battle or pay it twice.
      if(!own(D.decks,v.deck)||!['prepare','battle','shop','victory','lost','retired'].includes(v.phase)||!Array.isArray(v.cards)||v.cards.length<10||v.cards.length>80)return;
      const ids=new Set();for(const c of v.cards){if(!c||!Number.isSafeInteger(c.id)||c.id<1||c.id>1e9||ids.has(c.id)||!Number.isInteger(c.rank)||c.rank<2||c.rank>14||!Number.isInteger(c.suit)||c.suit<0||c.suit>3||!['plain','foil','mult','steel'].includes(c.enhance))return;ids.add(c.id);}
      if(!Array.isArray(v.jokers)||v.jokers.some(id=>!own(D.jokers,id))||new Set(v.jokers).size!==v.jokers.length||v.jokers.length>6||!Array.isArray(v.vouchers)||v.vouchers.some(id=>!own(D.vouchers,id)))return;
      for(const name of ['hand','pile','selected'])if(!Array.isArray(v[name])||v[name].some(id=>!ids.has(id))||new Set(v[name]).size!==v[name].length)return;
      if(v.hand.length>9||v.selected.length>5||v.selected.some(id=>!v.hand.includes(id))||v.pile.some(id=>v.hand.includes(id)))return;
      const validValue=n=>n===null||Number.isFinite(n)&&n>=-100&&n<=1e15;
      if(!validValue(v.hp)||!validValue(v.maxHp)||!Array.isArray(v.enemies)||v.enemies.length>80||!Array.isArray(v.shop)||v.shop.length>6)return;
      if(v.enemies.some(e=>!e||!own(D.enemies,e.type)||!validValue(e.hp)||!validValue(e.maxHp)||!Number.isFinite(e.x)||!Number.isFinite(e.y)||Math.abs(e.x)>400||Math.abs(e.y)>400))return;
      const definitions={joker:D.jokers,planet:D.hands,tarot:D.tarots,voucher:D.vouchers};
      if(v.shop.some(o=>!o||!(o.kind==='pack'&&o.id==='joker'||definitions[o.kind]&&own(definitions[o.kind],o.id))||!Number.isInteger(o.cost)||o.cost<1||o.cost>30))return;
      if(v.pack!==null&&(!Array.isArray(v.pack)||v.pack.length>3||v.pack.some(id=>!own(D.jokers,id))))return;
      if(v.phase==='battle'&&(!v.active||!own(D.hands,v.active.hand)||!['damage','chips','mult'].every(k=>validValue(v.active[k])&&v.active[k]!==null)||v.hp===null||!Number.isInteger(v.total)||v.total<1||v.total>64||!Number.isInteger(v.spawned)||v.spawned<0||v.spawned>v.total||v.enemies.length>v.spawned))return;
      this.run=JSON.parse(JSON.stringify(v));const r=this.run;r.round=integer(r.round,1,1e9,1);r.cleared=integer(r.cleared,0,r.round);r.stake=integer(r.stake,0,3);r.cash=integer(r.cash,0,1e9);r.rng=integer(r.rng,1,4294967295,1);r.seed=integer(r.seed,1,4294967295,1);r.nextId=Math.max(...ids)+1;r.levels=Object.fromEntries(Object.keys(D.hands).map(k=>[k,integer(v.levels?.[k],1,1e9,1)]));r.discards=integer(r.discards,0,4);r.kills=integer(r.kills,0,1e9);r.rerolls=integer(r.rerolls,0,1e6);r.total=integer(r.total,0,64);r.spawned=integer(r.spawned,0,r.total);r.time=Number.isFinite(r.time)?clamp(r.time,0,1e12):0;r.fireClock=Number.isFinite(r.fireClock)?clamp(r.fireClock,0,3):0;r.spawnClock=Number.isFinite(r.spawnClock)?clamp(r.spawnClock,0,1):0;r.shots=integer(r.shots,0,1e12);r.won=r.won===true;r.paused=r.phase==='battle';r.hp=new N(v.hp);r.maxHp=new N(v.maxHp);if(r.hp.log>r.maxHp.log)r.hp=r.maxHp;
      r.receipt=v.receipt?{base:integer(v.receipt.base,0,5),interest:integer(v.receipt.interest,0,10),bonus:integer(v.receipt.bonus,0,3),total:integer(v.receipt.total,0,18)}:null;
      for(const e of r.enemies){e.hp=new N(e.hp);e.maxHp=new N(e.maxHp);if(e.hp.log>e.maxHp.log)e.hp=e.maxHp;e.attack=Number.isFinite(e.attack)?clamp(e.attack,0,1):0;}
      if(r.active){const current=this.score(r.selected,integer(v.active.cash,0,1e9,r.cash));if(!current){this.run=null;return;}r.active={...current,damage:new N(v.active.damage),chips:new N(v.active.chips),mult:new N(v.active.mult),maxHp:r.maxHp};}
      this.event=r.phase==='battle'?'Бой восстановлен на паузе без офлайн-начислений.':'Забег восстановлен.';
    }
  }
  const api={Game,evaluate,profile};root.TowerCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
