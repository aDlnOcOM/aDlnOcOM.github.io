const test=require('node:test'),assert=require('node:assert/strict');
const {Game,evaluate}=require('./tower-core.js'),D=require('./tower-data.js'),N=require('./tower-number.js'),{Store,KEY}=require('./tower-storage.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ~= ${b}`),num=n=>n.log===-Infinity?0:10**n.log;
const cards=(ranks,suits=ranks.map((_,i)=>i%4))=>ranks.map((rank,i)=>({id:i+1,rank,suit:suits[i],enhance:'plain'}));
function game(seed=42){const g=new Game();g.newRun('signal',0,seed);return g;}
function snapshot(g){return JSON.parse(JSON.stringify(g.serialize()));}
function finish(g){g.run.spawned=g.run.total;g.run.enemies=[];return g.complete();}
function shop(g){if(g.run.phase==='prepare')g.launch();finish(g);g.run.cash=100;}
test('all twelve poker hands including wheel and modified-deck secret hands are recognized',()=>{
  const cases=[[[14,9,7,5,2],null,'high'],[[9,9,7,5,2],null,'pair'],[[9,9,7,7,2],null,'twoPair'],[[9,9,9,5,2],null,'three'],[[14,2,3,4,5],null,'straight'],[[14,12,7,5,2],[1,1,1,1,1],'flush'],[[9,9,9,5,5],null,'full'],[[9,9,9,9,2],null,'four'],[[10,11,12,13,14],[0,0,0,0,0],'straightFlush'],[[9,9,9,9,9],null,'five'],[[9,9,9,5,5],[1,1,1,1,1],'flushFull'],[[9,9,9,9,9],[0,0,0,0,0],'flushFive']];for(const [r,s,want]of cases)assert.equal(evaluate(cards(r,s||undefined)).id,want);assert.equal(evaluate(cards([2,3,4,5])).id,'high');assert.equal(evaluate(cards([2,3,4,5,5])).id,'pair');assert.equal(evaluate([]),null);
});
test('only scoring cards contribute rank chips, enhancements and suit bonuses',()=>{
  const g=game();g.run.cards=cards([2,2,14],[0,2,1]);g.run.cards[2].enhance='steel';g.run.selected=[1,2,3];const s=g.score();assert.equal(s.hand,'pair');near(num(s.chips),14);near(num(s.mult),2);near(s.regen,.3);near(s.crit,.11);assert.equal(s.scoring.length,2);
});
test('joker order changes additive versus multiplicative resolution',()=>{
  const g=game();g.run.selected=[g.run.hand[0]];g.run.jokers=['spark','echo'];const a=g.score();g.moveJoker(0,1);const b=g.score();assert.ok(a.damage.log>b.damage.log);near(num(a.mult),8);near(num(b.mult),5.6);
});
test('planet levels enhance the matching hand and steel cards multiply before jokers',()=>{
  const g=game();g.run.cards=cards([7,7],[0,1]);g.run.cards[0].enhance='steel';g.run.selected=[1,2];g.run.levels.pair=3;const s=g.score();near(num(s.chips),54);near(num(s.mult),6);assert.ok(num(s.maxHp)>120);
});
test('selection is limited to the current hand, five unique cards and preparation phase',()=>{
  const g=game();g.run.selected=[];for(const id of g.run.hand.slice(0,5))assert.ok(g.toggle(id));assert.equal(g.toggle(g.run.hand[5]),false);assert.equal(g.toggle(999),false);assert.equal(g.score([1,1]),null);g.launch();assert.equal(g.toggle(g.run.hand[0]),false);assert.equal(g.discard(),false);assert.equal(g.bestHand(),false);
});
test('discard consumes one charge, never redraws discarded cards and preserves deck size',()=>{
  const g=game();g.run.selected=g.run.hand.slice(0,3);const old=[...g.run.selected],before=g.run.pile.length;assert.ok(g.discard());assert.equal(g.run.discards,2);assert.ok(old.every(id=>!g.run.hand.includes(id)&&!g.run.pile.includes(id)));assert.equal(g.run.pile.length,before-3);assert.equal(g.run.cards.length,52);assert.equal(g.discard(),false);
});
test('identical seeds and decisions reproduce deals and shop offers',()=>{
  const a=game(91),b=game(91);assert.deepEqual(a.run.hand,b.run.hand);a.discard();b.discard();assert.deepEqual(a.run.hand,b.run.hand);shop(a);shop(b);assert.deepEqual(a.run.shop,b.run.shop);assert.notDeepEqual(a.run.hand,game(92).run.hand);
});
test('automatic central tower clears a first blind without clicking combat targets',()=>{
  const g=game();g.launch();for(let i=0;i<10000&&g.run.phase==='battle';i++)g.step(.1);assert.equal(g.run.phase,'shop');assert.equal(g.run.kills,g.run.total);assert.ok(g.run.shots>0);assert.equal(g.profile.kills,g.run.kills);assert.ok(g.run.receipt.total>0);
});
test('pause and invalid time steps freeze all simulation state',()=>{
  const g=game();g.launch();g.run.paused=true;const before=JSON.stringify(snapshot(g));for(const dt of [.1,Infinity,-1,NaN])g.step(dt);assert.equal(JSON.stringify(snapshot(g)),before);
});
test('kills pay once per five kills and repeated damage cannot duplicate money or meta',()=>{
  const g=game();g.launch();const before=g.run.cash;for(let i=0;i<5;i++){g.spawn();const e=g.run.enemies.at(-1);g.hurt(e,e.hp);g.hurt(e,N.pow(10,100));}assert.equal(g.run.cash,before+1);assert.equal(g.profile.kills,5);assert.equal(g.run.kills,5);
});
test('wave payout, interest cap and boss completion are idempotent',()=>{
  const g=game();g.run.cash=51;g.launch();const bonus=g.run.active.bonus;finish(g);assert.equal(g.run.cash,51+3+5+bonus);const before=JSON.stringify(snapshot(g));assert.equal(g.complete(),false);assert.equal(JSON.stringify(snapshot(g)),before);assert.equal(g.run.receipt.interest,5);
});
test('a live or unfinished blind cannot pay its completion reward',()=>{
  const g=game();g.launch();const before=g.run.cash;assert.equal(g.complete(),false);g.spawn();g.run.spawned=g.run.total;assert.equal(g.complete(),false);assert.equal(g.run.cash,before);assert.equal(g.run.phase,'battle');
});
test('stake restrictions are per deck and higher stakes change difficulty and economy',()=>{
  const g=new Game();assert.equal(g.newRun('signal',1,42),false);g.profile.deckWins.signal=2;assert.ok(g.newRun('signal',3,42));assert.equal(g.run.discards,2);assert.equal(g.item('joker','spark').cost,5);g.launch();g.spawn();const normal=game();normal.launch();normal.spawn();near(num(g.run.enemies[0].hp)/num(normal.run.enemies[0].hp),2);finish(g);assert.equal(g.run.receipt.base,0);
});
test('boss modifiers affect armor, first joker silence, speed rules and range',()=>{
  const g=game();g.run.jokers=['spark','echo'];g.run.round=6;const muted=g.score();g.run.jokers=['echo'];const expected=g.score();assert.ok(muted.mult.log>expected.mult.log);g.run.jokers=['spark','echo'];g.run.round=12;assert.equal(g.blind().boss.id,'veil');near(g.score().range,157.5);g.run.round=9;assert.equal(g.blind().boss.id,'haste');g.run.round=3;assert.equal(g.blind().boss.id,'armor');
});
test('range gates automatic fire and enemies damage a stationary tower on contact',()=>{
  const g=game();g.launch();g.spawn();const e=g.run.enemies[0];e.x=300;e.y=0;const hp=e.hp.log;g.fire();assert.equal(e.hp.log,hp);e.x=30;e.hp=e.maxHp=N.pow(10,50);g.run.fireClock=100;const before=g.run.hp.log;g.step(.1);assert.ok(g.run.hp.log<before);
});
test('all combat jokers produce their advertised tower stat effects',()=>{
  const g=game();const base=g.score();const checks={twinBarrel:s=>s.targets===2,chain:s=>s.chain===2,blast:s=>s.splash===48,shell:s=>s.maxHp.log>base.maxHp.log,medic:s=>s.regen>base.regen,thorns:s=>s.thorns===.25,scope:s=>s.range===270,haste:s=>s.delay<base.delay};for(const [id,check]of Object.entries(checks)){g.run.jokers=[id];assert.ok(check(g.score()),id);}
});
test('splash and chain hurt secondary enemies without paying dead enemies twice',()=>{
  for(const id of ['blast','chain']){const g=game();g.run.jokers=[id];g.launch();g.spawn();g.spawn();Object.assign(g.run.enemies[0],{x:100,y:0,hp:N.of(1e6),maxHp:N.of(1e6)});Object.assign(g.run.enemies[1],{x:110,y:10,hp:N.of(1e6),maxHp:N.of(1e6)});const before=g.run.enemies[1].hp.log;g.fire();assert.ok(g.run.enemies[1].hp.log<before);}
});
test('shop validates phase, price, duplicate purchases and joker capacity',()=>{
  const g=game();assert.equal(g.buy(0),false);shop(g);g.run.shop=[g.item('joker','spark')];g.run.cash=3;assert.equal(g.buy(0),false);g.run.cash=4;assert.ok(g.buy(0));assert.equal(g.run.cash,0);assert.equal(g.buy(0),false);assert.ok(g.profile.discovered.includes('spark'));g.run.shop=[g.item('joker','spark')];g.run.cash=100;assert.equal(g.buy(0),false);g.run.jokers=['spark','cache','echo','twins','bank'];g.run.shop=[g.item('joker','scope')];assert.equal(g.buy(0),false);
});
test('rerolls charge an increasing price and preserve voucher and booster slots',()=>{
  const g=game();shop(g);const fixed=JSON.stringify(g.run.shop.slice(4));assert.ok(g.reroll());assert.equal(g.run.cash,97);assert.equal(JSON.stringify(g.run.shop.slice(4)),fixed);assert.ok(g.reroll());assert.equal(g.run.cash,93);
});
test('booster requires one explicit choice, survives saves and blocks other shop actions',()=>{
  const g=game();shop(g);g.run.shop=[g.item('pack','joker')];assert.ok(g.buy(0));assert.equal(g.run.pack.length,3);assert.equal(g.next(),false);assert.equal(g.reroll(),false);const saved=new Game(snapshot(g));assert.deepEqual(saved.run.pack,g.run.pack);assert.ok(saved.choosePack(saved.run.pack[0]));assert.equal(saved.run.pack,null);assert.equal(saved.run.jokers.length,1);assert.equal(saved.choosePack('spark'),false);
});
test('all tarot actions modify the selected owned card and survive reload',()=>{
  for(const id of Object.keys(D.tarots)){const g=game();shop(g);g.run.shop=[g.item('tarot',id)];const target=g.run.hand[0],old=g.card(target);assert.equal(g.buy(0,999),false);assert.ok(g.buy(0,target),id);if(id==='clone'){assert.equal(g.run.cards.length,53);assert.equal(g.run.cards.at(-1).rank,old.rank);}else if(id==='remove')assert.equal(g.run.cards.length,51);else if(id==='heart')assert.equal(g.card(target).suit,1);else assert.equal(g.card(target).enhance,id);assert.ok(new Game(snapshot(g)).run,id);}
});
test('planet and vouchers change only this run; second run starts at level one',()=>{
  const g=game();shop(g);g.run.shop=[g.item('planet','pair'),g.item('voucher','pocket'),g.item('voucher','slot')];assert.ok(g.buy(0));assert.ok(g.buy(1));assert.ok(g.buy(2));assert.equal(g.run.levels.pair,2);assert.equal(g.handSize(),9);assert.equal(g.slots(),6);g.retire();g.newRun('signal',0,42);assert.equal(g.run.levels.pair,1);assert.equal(g.slots(),5);assert.equal(g.run.cash,10);
});
test('meta progression unlocks options and per-deck stakes, not permanent damage',()=>{
  const g=game(),before=g.score().damage.log;assert.equal(g.newRun('reserve',0,1),false);g.profile.kills=100;g.profile.bosses=1;assert.ok(g.unlockedDeck('reserve'));assert.ok(g.unlockedDeck('prism'));g.run.round=24;g.launch();finish(g);assert.equal(g.run.phase,'victory');assert.equal(g.profile.wins,1);assert.equal(g.maxStake('signal'),1);assert.equal(g.maxStake('prism'),0);assert.ok(g.unlockedDeck('citadel'));assert.ok(g.continueEndless());g.next();assert.equal(g.ante(),9);g.retire();g.newRun('signal',0,42);assert.equal(g.score().damage.log,before);
});
test('deck sidegrades alter starting cash, suits, hand size and joker slots',()=>{
  const g=new Game();g.profile.kills=100;g.profile.bosses=1;g.profile.wins=1;assert.ok(g.newRun('reserve',0,5));assert.equal(g.run.cash,20);assert.equal(g.run.hand.length,7);g.retire();g.newRun('prism',0,5);assert.equal(new Set(g.run.cards.map(c=>c.suit)).size,2);g.retire();g.newRun('citadel',0,5);assert.equal(g.slots(),4);assert.ok(num(g.score().maxHp)>=180);
});
test('lost run cannot restart in place or retain temporary upgrades',()=>{
  const g=game();g.run.jokers=['cache'];g.launch();g.spawn();g.run.hp=N.of(.01);g.run.fireClock=100;Object.assign(g.run.enemies[0],{x:20,y:0,hp:N.pow(10,20),maxHp:N.pow(10,20)});g.step(.1);assert.equal(g.run.phase,'lost');assert.equal(g.launch(),false);assert.ok(g.newRun('signal',0,1));assert.equal(g.run.jokers.length,0);assert.equal(g.profile.runs,2);
});
test('combat snapshot resumes identical health, RNG, enemies and rewards without replay',()=>{
  const a=game();a.launch();for(let i=0;i<50;i++)a.step(.1);const b=new Game(snapshot(a));assert.equal(b.run.paused,true);assert.equal(b.run.cash,a.run.cash);b.run.paused=false;for(let i=0;i<100;i++){a.step(.1);b.step(.1);}assert.deepEqual(snapshot(b),snapshot(a));
});
test('bank joker snapshot keeps its launch-time cash and scoring explanation on reload',()=>{
  const g=game();g.run.jokers=['bank','echo'];g.launch();const trace=[...g.run.active.trace],damage=g.run.active.damage.log;g.run.cash+=10;const restored=new Game(snapshot(g));assert.equal(restored.run.active.cash,10);assert.equal(restored.run.active.damage.log,damage);assert.deepEqual(restored.run.active.trace,trace);
});
test('corrupt saves reject invalid cards, enemy types and payload HTML',()=>{
  const g=game();g.launch();g.spawn();for(const mutate of [v=>v.run.cards[0].rank=Infinity,v=>v.run.cards[1].id=v.run.cards[0].id,v=>v.run.enemies[0]=null,v=>v.run.enemies[0].type='__proto__',v=>v.run.active.damage='oops']){const v=snapshot(g);mutate(v);assert.equal(new Game(v).run,null);}shop(g);const v=snapshot(g);v.run.receipt.base='<img onerror=alert(1)>';assert.equal(new Game(v).run.receipt.base,0);
});
test('independent storage preserves old keys and backs up bad snapshots before replacement',()=>{
  const m=new Map([['neon-bastion:field:v1','old'],[KEY,'{broken']]),s=new Store({getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)}),g=s.load();assert.ok(s.recovery);assert.ok(s.save(g));assert.equal(m.get(KEY+':recovery'),'{broken');assert.equal(m.get('neon-bastion:field:v1'),'old');assert.equal(new Store(null).save(g),false);
});
test('logarithmic values and enemy progression remain finite at extreme rounds',()=>{
  const g=game();g.run.round=1000000;g.launch();g.spawn();assert.ok(Number.isFinite(g.run.enemies[0].hp.log));assert.ok(g.run.enemies[0].hp.log>1000);assert.match(g.run.enemies[0].hp.format(),/e/);near(num(N.of(8).add(2).sub(4).mul(2)),12);
});
test('offscreen effects never change combat outcome and pools remain bounded',()=>{
  const a=game(),b=game();a.launch();b.launch();b.visible=false;for(let i=0;i<10000&&a.run.phase==='battle';i++){a.step(.1);b.step(.1);assert.ok(a.run.enemies.length<=80);assert.ok(a.effects.length<=100);}assert.deepEqual(snapshot(a),snapshot(b));assert.equal(b.effects.length,0);
});
test('multiple seeded runs keep finite coordinates, bounded pools and can reach ante eight victory',()=>{
  let wins=0;for(const seed of [1,7,42,91,205]){const g=game(seed);for(let i=0;i<12000;i++){const r=g.run;if(r.phase==='lost'||r.phase==='victory')break;if(r.phase==='prepare'){g.bestHand();g.launch();}else if(r.phase==='shop'){for(let n=0;n<r.shop.length;n++)if(['joker','planet'].includes(r.shop[n].kind))g.buy(n);g.next();}else g.step(.1);assert.ok(r.enemies.length<=80);assert.ok(g.effects.length<=100);assert.ok(Number.isFinite(r.cash));assert.ok(r.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.maxHp.log)));}assert.ok(['lost','victory'].includes(g.run.phase),seed);assert.ok(g.run.kills>0,seed);if(g.run.phase==='victory')wins++;}assert.ok(wins>0,'A legitimate simulated build must reach the campaign victory without forced completion.');
});
