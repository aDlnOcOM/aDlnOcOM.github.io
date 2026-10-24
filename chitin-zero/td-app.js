(function(){
  'use strict';
  const D=TDData,C=TDCore,N=TDNumber,$=id=>document.getElementById(id);
  let storage;try{storage=localStorage;}catch{storage=null;}
  const store=new TDStorage.Store(storage),game=store.load();
  let renderer,selected=0,blueprint='pulse',tab='node',bulk=1,panelSignature='',padSignature='',dialogOpen=false,wasPaused=false,hiddenAt=0,last=null,accumulator=0,uiClock=0,renderError='',lastSaveAttempt=Date.now();
  const actionButton=(action,label,disabled=false,primary=false)=>`<button data-action="${action}"${disabled?' disabled':''}${primary?' class="primary panel-primary"':''}>${label}</button>`;
  const formatTime=seconds=>seconds>=3600?`${Math.floor(seconds/3600)} ч ${Math.floor(seconds%3600/60)} мин`:`${Math.max(1,Math.floor(seconds/60))} мин`;
  function save(){lastSaveAttempt=Date.now();const ok=store.save(game);$('save-state').textContent=ok?'● СОХРАНЕНО НА ЭТОМ УСТРОЙСТВЕ':store.error;$('save-state').classList.toggle('error',!ok);return ok;}
  function catalog(){
    $('catalog').innerHTML=Object.entries(D.towers).map(([id,t])=>`<button class="tower-card" data-blueprint="${id}" style="--tower:${t.color}" aria-pressed="${blueprint===id}" title="${t.description}"><span class="tower-glyph" aria-hidden="true">${t.glyph}</span><b>${t.name}</b><small>${t.tag}</small><span class="price">${t.cost} ¤</span></button>`).join('');
  }
  function select(slot){if(!Number.isInteger(slot)||slot<0||slot>=D.pads.length)return;selected=slot;if(renderer)renderer.selected=slot;tab='node';panelSignature='';update();}
  function showNode(){
    const t=game.towers[selected],type=t?.type||blueprint,s=D.towers[type],stats=t?game.stats(t):s,e=t?C.evolution(t):null;
    let out=`<p class="panel-kicker">УЗЕЛ ${String(selected+1).padStart(2,'0')} / ${t?'ПОДКЛЮЧЁН':'СВОБОДЕН'}</p><div class="node-hero" style="--tower:${s.color}"><span aria-hidden="true">${s.glyph}</span><small>${s.tag} / ${t?'ACTIVE':'BLUEPRINT'}</small></div><div class="node-heading"><h2>${e?.name||s.name}</h2><span class="level-pill">${t?`LV ${t.level}`:'ЧЕРТЁЖ'}</span></div><p class="node-description">${e?.text||s.description}</p>`;
    out+=`<div class="stats-grid"><div><small>УРОН / ЗАЛП</small><b>${N.from(stats.damage).format()}</b></div><div><small>ИНТЕРВАЛ</small><b>${stats.delay.toFixed(2)} с</b></div><div><small>ДАЛЬНОСТЬ</small><b>${stats.range}</b></div><div><small>СВЯЗЕЙ</small><b>${t?game.links().filter(l=>l.a===t||l.b===t).length:0}</b></div></div>`;
    if(!t)return out+actionButton('build',`УСТАНОВИТЬ <span>${s.cost} ¤</span>`,!game.credits.gte(s.cost),true)+'<p class="milestone">Выбери другой чертёж в арсенале. Соседи на расстоянии до 240 создают комбинации.</p>';
    const count=bulk==='max'?game.affordableCount(selected):bulk,price=C.cost(t,Math.max(1,count));
    out+=`<div class="upgrade-row">${[1,10,'max'].map(n=>`<button data-bulk="${n}" aria-pressed="${bulk===n}">${n==='max'?'MAX':`+${n}`}</button>`).join('')}</div>`;
    out+=actionButton('upgrade',`УЛУЧШИТЬ +${count||0} <span>${price.format()} ¤</span>`,count<1||!game.credits.gte(price),true);
    out+=`<p class="milestone">Каждый уровень: ×1,16 урона.<br>Каждые 25 уровней: дополнительный ×2.<br>Следующий разгон: LV ${(Math.floor(t.level/25)+1)*25}. Лимита уровней нет.</p>`;
    if(e)out+=`<div class="evolved-label">◆ ЭВОЛЮЦИЯ ЗАВЕРШЕНА / ${e.name}<br>Эффект сохраняется при дальнейших улучшениях.</div>`;
    else {out+='<h3 class="panel-subtitle">ВЕТКИ ЭВОЛЮЦИИ / ВЫБЕРИ ОДНУ</h3>';out+=game.evolveOptions(selected).map(e=>`<div class="evo-card${e.ready?' ready':''}"><h3>${e.name}</h3><p>${e.text}</p><small>${e.ready?'✓ Условия выполнены':`Нужен LV 10 и сосед ${D.towers[e.partner].name} LV 5 в радиусе 240`}</small><button data-evolve="${e.id}"${e.ready&&game.credits.gte(e.cost)?'':' disabled'}>СИНТЕЗ · ${e.cost.format()} ¤</button></div>`).join('');}
    return out+`<button class="sell-button" data-action="sell">Демонтировать · вернуть ${t.spent.mul(.7).format()} ¤</button>`;
  }
  function showResearch(){
    return `<p class="panel-kicker">НЕЙРОЯДРА / ${game.cores.format()} ◇</p><p class="node-description">Постоянные улучшения без предела уровней. Ядра — за каждого десятого босса и перезагрузку сети. Исследования не теряются.</p>`+Object.entries(D.research).map(([id,s])=>{const price=C.researchCost(id,game.research[id]);return `<article class="research-card"><header><h3>${s.name}</h3><span>LV ${game.research[id]}</span></header><p>${s.text}</p><button data-research="${id}"${game.cores.gte(price)?'':' disabled'}>ИССЛЕДОВАТЬ · ${price.format()} ◇</button></article>`;}).join('');
  }
  function showCombos(){
    const links=game.links();return '<p class="panel-kicker">СОСЕДСТВО → КОМБИНАЦИЯ → ЭВОЛЮЦИЯ</p><p class="node-description">Пунктир соединяет совместимые узлы в радиусе 240. Для обычных комбинаций уровни не нужны. Эволюции доступны на вкладке узла.</p>'+D.combos.map(c=>{const active=links.filter(l=>l.combo.name===c.name).length;return `<article class="combo-card${active?' active':''}"><div class="combo-icons"><span style="color:${D.towers[c.a].color}">${D.towers[c.a].glyph}</span><i>+</i><span style="color:${D.towers[c.b]?.color||'#b9c9d1'}">${D.towers[c.b]?.glyph||'∗'}</span></div><h3>${c.name}</h3><p>${c.text}</p><small>${active?`${active} АКТИВНЫХ СВЯЗЕЙ`:'НЕТ АКТИВНЫХ СВЯЗЕЙ'}</small></article>`;}).join('')+'<p class="milestone">Бонусы одинаковых связей не складываются. Усиленная Нано заменяет обычное ускорение, а не дублирует его.</p>';
  }
  function update(){
    $('credits').textContent=game.credits.format();$('cores').textContent=game.cores.format();$('income').textContent=`+${game.income().format()} / игр. с`;
    $('wave').textContent=String(game.wave).padStart(3,'0');$('health').textContent=`${Math.ceil(game.hp)} / ${game.maxHp}`;$('hp').value=game.hp/game.maxHp;
    $('phase').textContent=game.paused?'ПАУЗА':game.phase==='wave'?(game.wave%10===0?'ОСАДНЫЙ ТИТАН':'ВРАЖЕСКИЙ ТРАФИК'):game.phase==='between'?`НОВАЯ ВОЛНА / ${Math.ceil(game.timer)} С`:game.phase==='repair'?'РЕМОНТ ЯДРА':'СЕТЬ ГОТОВА';
    $('threat').textContent=game.phase==='wave'?`${game.enemies.length} ЦЕЛЕЙ / ${game.spawned} ИЗ ${game.total} ВОШЛИ`:'ВХОДЯЩИЙ ТРАФИК / ОЖИДАНИЕ';
    $('record').textContent=game.best;$('kills').textContent=game.kills.toLocaleString('ru-RU');$('prestiges').textContent=game.prestiges;
    $('link-count').textContent=`${game.links().length} СВЯЗЕЙ`;$('event').textContent=renderError||game.event;
    $('run-toggle').innerHTML=!game.started?'ЗАПУСТИТЬ ОБОРОНУ <span>▶</span>':game.paused?'ПРОДОЛЖИТЬ <span>▶</span>':'ПАУЗА <span>Ⅱ</span>';
    $('prestige-hint').textContent=game.cycleBest>=20?`+${game.prestigeReward().format()} ◇ / волна цикла ${game.cycleBest}`:`Доступно после 20 волн цикла · ${game.cycleBest}/20`;
    for(const id of ['build','upgrade','evolve'])$('auto-'+id).checked=game.auto[id];
    for(const b of document.querySelectorAll('[data-speed]'))b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===game.speed));
    for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));
    const pads=game.towers.map(t=>t?.type||'-').join()+selected;
    if(padSignature!==pads){padSignature=pads;$('pad-strip').innerHTML=D.pads.map((_,i)=>`<button data-slot="${i}" aria-pressed="${selected===i}" aria-label="Узел ${i+1}: ${game.towers[i]?D.towers[game.towers[i].type].name:'свободен'}"${game.towers[i]?` class="occupied" style="--tower:${D.towers[game.towers[i].type].color}"`:''}>${String(i+1).padStart(2,'0')}</button>`).join('');}
    const t=game.towers[selected],count=t?(bulk==='max'?game.affordableCount(selected):bulk):0;
    const signature=[tab,selected,blueprint,bulk,count,game.towers.map(t=>t?`${t.type}:${t.level}:${t.evolution}`:'-').join(),Object.values(game.research).join(),...Object.keys(D.towers).map(id=>game.credits.gte(D.towers[id].cost)),t&&game.credits.gte(C.cost(t,Math.max(1,count))),t&&game.evolveOptions(selected).map(e=>game.credits.gte(e.cost)),...Object.keys(D.research).map(id=>game.cores.gte(C.researchCost(id,game.research[id]))),tab==='research'?game.cores.format():''].join('|');
    if(signature!==panelSignature){
      const focus=document.activeElement,focusData=focus?.dataset?Object.entries(focus.dataset).find(([k])=>['action','research','evolve','bulk'].includes(k)):null;
      panelSignature=signature;$('panel').innerHTML=tab==='research'?showResearch():tab==='combos'?showCombos():showNode();
      if(focusData)$('panel').querySelector(`[data-${focusData[0]}="${focusData[1]}"]`)?.focus();
    }
  }
  function modal(label,title,body,actions){
    if(!dialogOpen)wasPaused=game.paused;dialogOpen=true;game.paused=true;accumulator=0;
    $('dialog-label').textContent=label;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('dialog-actions').innerHTML=actions;$('dialog').hidden=false;
    $('dialog-actions').querySelector('button')?.focus();update();
  }
  function closeModal(){dialogOpen=false;$('dialog').hidden=true;game.paused=wasPaused;last=null;accumulator=0;update();save();$('run-toggle').focus();}
  function help(){modal('КРАТКИЙ ИНСТРУКТАЖ / 01','Собери сеть, которая не спит.',
    '<ul><li>Выбери свободный узел на карте и чертёж в арсенале. Нажми <strong>«Установить»</strong>.</li><li>Соседние Крио + Дуга, Крио + Плазма, Импульс + Рельс образуют комбинации. Нано ускоряет соседей.</li><li>Доведи башню до <strong>LV 10</strong>, подходящего соседа — до <strong>LV 5</strong>. Выбери одну из двух эволюций.</li><li>Улучшения без ограничения уровней. Каждые 25 уровней башня получает дополнительный ×2 урона.</li><li>Автоматика строит готовую сеть и улучшает самый дешёвый узел. Автоэволюции выбирают первую доступную ветку.</li><li>Каждая 10-я волна — босс и нейроядра. После 20 волн цикла доступна перезагрузка ради постоянных исследований.</li><li>При пробое ядра: 8 секунд ремонта, затем возврат к началу десятка волн. Башни и валюта остаются.</li><li>Вне игры работает только производство: до 8 часов, на базовой скорости 1×. Бой не симулируется.</li></ul><p><strong>Клавиши:</strong> Space — пауза; ← → — узел; B — построить; U — улучшить; 1/2/4 — скорость. Прогресс сохраняется каждые 5 секунд.</p>',actionButton('close','ПОНЯТНО',false,true));}
  function perform(action){
    if(action==='close'){closeModal();return;}
    if(action==='prestige-confirm'){if(game.prestige()){wasPaused=false;closeModal();panelSignature='';save();}return;}
    if(action==='sell-confirm'){game.sell(selected);closeModal();panelSignature='';save();return;}
    if(dialogOpen)return;
    if(action==='build')game.build(selected,blueprint);
    else if(action==='upgrade'){const count=bulk==='max'?game.affordableCount(selected):bulk;game.upgrade(selected,count);}
    else if(action==='sell'){const t=game.towers[selected];if(t)modal('ДЕМОНТАЖ УЗЛА','Отключить башню?',`<p>Вернётся <strong>${t.spent.mul(.7).format()} кредитов</strong>. Уровни и эволюция этого узла будут потеряны. Если автостройка включена, она снова заполнит свободное место.</p>`,actionButton('sell-confirm','ДЕМОНТИРОВАТЬ')+actionButton('close','ОСТАВИТЬ',false,true));return;}
    update();save();
  }
  function toggle(){if(dialogOpen||!renderer)return;if(!game.started)game.start();else game.paused=!game.paused;accumulator=0;last=null;update();save();}
  function changeSpeed(value){if(![1,2,4].includes(value))return;game.speed=value;update();save();}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.action){perform(b.dataset.action);return;}if(dialogOpen)return;
    if(b.dataset.blueprint){blueprint=b.dataset.blueprint;catalog();if(game.towers[selected]){const free=game.towers.findIndex(t=>!t);if(free>=0)select(free);}panelSignature='';update();}
    else if(b.dataset.slot!==undefined)select(Number(b.dataset.slot));
    else if(b.dataset.tab){tab=b.dataset.tab;panelSignature='';update();}
    else if(b.dataset.speed)changeSpeed(Number(b.dataset.speed));
    else if(b.dataset.bulk){bulk=b.dataset.bulk==='max'?'max':Number(b.dataset.bulk);panelSignature='';update();}
    else if(b.dataset.evolve){game.evolve(selected,b.dataset.evolve);update();save();}
    else if(b.dataset.research){game.buyResearch(b.dataset.research);update();save();}
    else if(b.id==='run-toggle')toggle();else if(b.id==='help'||b.id==='help-mobile')help();else if(b.id==='save')save();
    else if(b.id==='motion'&&renderer){renderer.reduced=!renderer.reduced;b.setAttribute('aria-pressed',String(renderer.reduced));}
    else if(b.id==='prestige'){
      if(game.cycleBest<20)modal('ДОЛГОВРЕМЕННЫЙ ПРОГРЕСС','Нужны 20 волн в этом цикле.',`<p>Отражено <strong>${game.cycleBest} / 20</strong>. Перезагрузка вернёт бой на первую волну и даст нейроядра для постоянных исследований.</p>`,actionButton('close','ПРОДОЛЖИТЬ',false,true));
      else modal('ПЕРЕЗАГРУЗКА СЕТИ','Начать новый цикл?',`<p>Награда: <strong>+${game.prestigeReward().format()} нейроядер</strong>.</p><p>Башни, их уровни, эволюции и кредиты сбросятся. Нейроядра, исследования, общий рекорд и статистика сохранятся.</p>`,actionButton('prestige-confirm','ПЕРЕЗАГРУЗИТЬ',false,true)+actionButton('close','ОСТАТЬСЯ'));
    }
  });
  for(const id of ['build','upgrade','evolve'])$('auto-'+id).addEventListener('change',()=>{game.auto[id]=$('auto-'+id).checked;save();});
  $('field').addEventListener('click',event=>{if(dialogOpen||!renderer)return;const slot=renderer.pick(event.clientX,event.clientY);if(slot>=0)select(slot);});
  $('field').addEventListener('pointermove',event=>{if(renderer)renderer.hover=renderer.pick(event.clientX,event.clientY);});
  $('field').addEventListener('pointerleave',()=>{if(renderer)renderer.hover=-1;});
  document.addEventListener('keydown',event=>{
    if(dialogOpen){if(event.code==='Escape'){event.preventDefault();closeModal();}else if(event.code==='Tab'){const buttons=[...$('dialog-actions').querySelectorAll('button:not([disabled])')],index=buttons.indexOf(document.activeElement);if(buttons.length){event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}}return;}
    if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)&&document.activeElement?.id!=='field')return;
    if(event.repeat)return;
    if(event.code==='Space'){event.preventDefault();toggle();}
    else if(event.code==='ArrowRight'||event.code==='ArrowLeft'){event.preventDefault();select((selected+(event.code==='ArrowRight'?1:11))%12);}
    else if(event.code==='KeyB')perform('build');else if(event.code==='KeyU')perform('upgrade');else if(['Digit1','Digit2','Digit4'].includes(event.code))changeSpeed(Number(event.code.slice(-1)));
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();save();accumulator=0;}
    else if(hiddenAt){const seconds=Math.max(0,(Date.now()-hiddenAt)/1000);hiddenAt=0;game.offline(seconds);last=null;accumulator=0;save();update();if(seconds>=60)showOffline();}
  });
  addEventListener('pagehide',save);addEventListener('resize',()=>renderer?.resize());
  function showOffline(){const reward=game.lastReward;if(!reward||reward.amount.log===-Infinity)return;modal('ПРОИЗВОДСТВО БЫЛО АКТИВНО','С возвращением, оператор.',`<p>Сеть произвела за <strong>${formatTime(reward.seconds)}</strong>:</p><strong class="offline-sum">+${reward.amount.format()} ¤</strong><p>Начислено только производство. Волны не проходили без тебя. Максимум учитывается 8 часов.</p>`,actionButton('close','ПРИНЯТЬ',false,true));game.lastReward=null;}
  function frame(stamp){
    const elapsed=last===null?0:Math.min(.1,Math.max(0,(stamp-last)/1000));last=stamp;
    if(renderer&&!document.hidden&&!dialogOpen&&!game.paused){accumulator+=elapsed*game.speed;let steps=0;while(accumulator>=1/30&&steps++<12){game.step(1/30);accumulator-=1/30;}}
    else accumulator=0;
    if(renderer&&!document.hidden){try{renderer.draw(game);}catch(error){renderError=`Ошибка отрисовки: ${error.message}`;renderer=null;game.paused=true;$('run-toggle').disabled=true;update();}}
    uiClock+=elapsed;if(uiClock>=.2){uiClock=0;update();}
    if(!document.hidden&&Date.now()-lastSaveAttempt>=5000)save();requestAnimationFrame(frame);
  }
  try{renderer=new TDRender.Renderer($('field'));renderer.reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;$('motion').setAttribute('aria-pressed',String(renderer.reduced));}
  catch(error){$('run-toggle').disabled=true;renderError=`Не удалось запустить графику: ${error.message}`;}
  catalog();update();save();if(game.lastReward?.seconds>=60)showOffline();requestAnimationFrame(frame);
})();
