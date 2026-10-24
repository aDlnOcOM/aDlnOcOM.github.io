(function(){
  'use strict';
  const D=TDData,C=TDCore,N=TDNumber,$=id=>document.getElementById(id);
  let storage;try{storage=localStorage;}catch{storage=null;}
  const store=new TDStorage.Store(storage),game=store.load();
  let renderer,selected=game.viewSegment*12,blueprint='pulse',tab='node',bulk=1,panelSignature='',padSignature='',checkpointSignature='',dialogOpen=false,opener=null,wasPaused=false,hiddenAt=0,last=null,accumulator=0,uiClock=0,renderError='',lastSaveAttempt=Date.now();
  const actionButton=(action,label,disabled=false,primary=false)=>`<button data-action="${action}"${disabled?' disabled':''}${primary?' class="primary panel-primary"':''}>${label}</button>`;
  const formatTime=seconds=>seconds>=3600?`${Math.floor(seconds/3600)} ч ${Math.floor(seconds%3600/60)} мин`:`${Math.max(1,Math.floor(seconds/60))} мин`;
  function save(){lastSaveAttempt=Date.now();const ok=store.save(game);$('save-state').textContent=ok?'● СОХРАНЕНО НА ЭТОМ УСТРОЙСТВЕ':store.error;$('save-state').classList.toggle('error',!ok);return ok;}
  function catalog(){
    $('catalog').innerHTML=Object.entries(D.towers).map(([id,t])=>`<button class="tower-card" data-blueprint="${id}" style="--tower:${t.color}" aria-pressed="${blueprint===id}" title="${t.description}"><span class="tower-glyph" aria-hidden="true">${t.glyph}</span><b>${t.name}</b><span class="price">${t.cost} кредитов</span><small>${t.description}</small></button>`).join('');
  }
  function select(slot){if(!game.validSlot(slot))return;selected=slot;game.setView(Math.floor(slot/12));if(renderer){renderer.selected=slot;renderer.syncView(game);}tab='node';panelSignature='';update();}
  function navigate(index){if(!game.setView(index))return;select(index*12);game.say(`Обзор: сегмент ${index+1} из ${game.segmentCount}. Бой продолжается на всей трассе.`);update();save();}
  function navigation(){
    $('segment-label').textContent=`Сегмент ${game.viewSegment+1} из ${game.segmentCount}`;
    $('segment-prev').disabled=game.viewSegment===0;$('segment-next').disabled=game.viewSegment===game.segmentCount-1;
    const total=Math.floor(game.segmentCount/5),start=Math.max(1,Math.min(total-4,Math.floor((game.viewSegment+1)/5)-2)),key=`${total}:${start}:${game.viewSegment}`;
    $('checkpoint-number').max=total;$('checkpoint-go').disabled=total===0;
    $('checkpoint-hint').textContent=total?`Доступно ${total} КП. Номер КП × 5 = номер сегмента. Переход меняет только обзор.`:'Первая контрольная точка откроется на сегменте 5.';
    if(key!==checkpointSignature){const focus=document.activeElement?.dataset?.checkpoint;checkpointSignature=key;$('checkpoints').innerHTML=Array.from({length:Math.min(5,total)},(_,i)=>{const n=start+i;return `<button data-checkpoint="${n}" aria-pressed="${game.viewSegment===n*5-1}">КП ${n} · сегмент ${n*5}</button>`;}).join('');if(focus){const next=$('checkpoints').querySelector(`[data-checkpoint="${focus}"]`);(next||$('checkpoints')).focus();}}
  }
  function showNode(){
    const t=game.tower(selected),type=t?.type||blueprint,s=D.towers[type],stats=t?game.stats(t):s,e=t?C.evolution(t):null;
    let out=`<p class="panel-kicker">УЗЕЛ ${String(selected+1).padStart(2,'0')} / ${t?'ПОДКЛЮЧЁН':'СВОБОДЕН'}</p><div class="node-hero" style="--tower:${s.color}"><span aria-hidden="true">${s.glyph}</span><small>${s.tag} / ${t?'ACTIVE':'BLUEPRINT'}</small></div><div class="node-heading"><h2>${e?.name||s.name}</h2><span class="level-pill">${t?`LV ${t.level}`:'ЧЕРТЁЖ'}</span></div><p class="node-description">${e?.text||s.description}</p>`;
    out+=`<div class="stats-grid"><div><small>УРОН / ЗАЛП</small><b>${N.from(stats.damage).format()}</b></div><div><small>ИНТЕРВАЛ</small><b>${stats.delay.toFixed(2)} с</b></div><div><small>ДАЛЬНОСТЬ</small><b>${stats.range}</b></div><div><small>СВЯЗЕЙ</small><b>${t?game.links(true).filter(l=>l.a===t||l.b===t).length:0}</b></div></div>`;
    if(!t)return out+actionButton('build',`Установить · ${s.cost} кредитов`,!game.credits.gte(s.cost),true)+(!game.credits.gte(s.cost)?'<p>Недостаточно кредитов. Дождись дохода или выбери другую башню.</p>':'')+(game.canAutomate('build')?actionButton('plan','Запланировать автостройку')+(game.plans.has(selected)?`<p>В очереди: ${D.towers[game.plans.get(selected)].name}</p>`+actionButton('unplan','Убрать из очереди'):''):'')+'<p class="milestone">1. Выбери чертёж в арсенале.<br>2. Установи его в выбранный узел.<br>3. Запусти оборону. Соседи в радиусе 240 создают комбинации.</p>';
    const count=bulk==='max'?game.affordableCount(selected):bulk,price=C.cost(t,Math.max(1,count));
    out+=`<div class="upgrade-row">${[1,10,'max'].map(n=>`<button data-bulk="${n}" aria-pressed="${bulk===n}">${n==='max'?'MAX':`+${n}`}</button>`).join('')}</div>`;
    out+=actionButton('upgrade',`УЛУЧШИТЬ +${count||0} <span>${price.format()} ¤</span>`,count<1||!game.credits.gte(price),true);
    if(count<1||!game.credits.gte(price))out+='<p>Недостаточно кредитов для выбранного улучшения.</p>';
    out+=`<p class="milestone">Каждый уровень: ×1,16 урона.<br>Каждые 25 уровней: дополнительный ×2.<br>Следующий разгон: LV ${(Math.floor(t.level/25)+1)*25}. Лимита уровней нет.</p>`;
    if(e)out+=`<div class="evolved-label">◆ ЭВОЛЮЦИЯ ЗАВЕРШЕНА / ${e.name}<br>Эффект сохраняется при дальнейших улучшениях.</div>`;
    else {out+='<h3 class="panel-subtitle">ВЕТКИ ЭВОЛЮЦИИ / ВЫБЕРИ ОДНУ</h3>';out+=game.evolveOptions(selected).map(e=>`<div class="evo-card${e.ready?' ready':''}"><h3>${e.name}</h3><p>${e.text}</p><small>${e.ready?'✓ Условия выполнены':`Нужен LV 10 и сосед ${D.towers[e.partner].name} LV 5 в радиусе 240`}</small><button data-evolve="${e.id}"${e.ready&&game.credits.gte(e.cost)?'':' disabled'}>СИНТЕЗ · ${e.cost.format()} ¤</button></div>`).join('');}
    return out+`<button class="sell-button" data-action="sell">Демонтировать · вернуть ${t.spent.mul(.7).format()} ¤</button>`;
  }
  function showResearch(){
    return `<h2>Постоянные исследования</h2><p>Нейроядра: ${game.cores.format()}. Получай их за каждую 10-ю волну и перезагрузку сети. Автоматика открывается навсегда, затем включается вручную. Остальные исследования не имеют предела уровней.</p>`+Object.entries(D.research).map(([id,s])=>{const price=C.researchCost(id,game.research[id]),done=game.research[id]>=(s.max||Infinity);return `<article class="research-card"><header><h3>${s.name}</h3><span>${done?'Изучено':`LV ${game.research[id]}`}</span></header><p>${s.text}</p><button data-research="${id}"${!done&&game.cores.gte(price)?'':' disabled'}>${done?'Изучено навсегда':`Исследовать · ${price.format()} нейроядер`}</button>${!done&&!game.cores.gte(price)?'<small>Недостаточно нейроядер</small>':''}</article>`;}).join('');
  }
  function showCombos(){
    const links=game.links(true);return '<h2>Комбинации сегмента</h2><p class="panel-kicker">СОСЕДСТВО → КОМБИНАЦИЯ → ЭВОЛЮЦИЯ</p><p class="node-description">Пунктир соединяет совместимые узлы в радиусе 240. Для обычных комбинаций уровни не нужны. Эволюции доступны на вкладке узла.</p>'+D.combos.map(c=>{const active=links.filter(l=>l.combo.name===c.name).length;return `<article class="combo-card${active?' active':''}"><div class="combo-icons"><span style="color:${D.towers[c.a].color}">${D.towers[c.a].glyph}</span><i>+</i><span style="color:${D.towers[c.b]?.color||'#b9c9d1'}">${D.towers[c.b]?.glyph||'∗'}</span></div><h3>${c.name}</h3><p>${D.towers[c.a].name} + ${D.towers[c.b]?.name||'любая башня'}</p><p>${c.text}</p><small>${active?`${active} связей: ${links.filter(l=>l.combo.name===c.name).map(l=>`узлы ${l.a.slot+1} и ${l.b.slot+1}`).join('; ')}`:'НЕТ АКТИВНЫХ СВЯЗЕЙ'}</small></article>`;}).join('')+'<p class="milestone">Бонусы одинаковых связей не складываются. Усиленная Нано заменяет обычное ускорение, а не дублирует его.</p>';
  }
  function update(){
    $('credits').textContent=game.credits.format();$('cores').textContent=game.cores.format();$('income').textContent=`+${game.income().format()} / игр. с`;
    $('wave').textContent=String(game.wave).padStart(3,'0');$('health').textContent=`${Math.ceil(game.hp)} / ${game.maxHp}`;$('hp').value=game.hp/game.maxHp;
    $('phase').textContent=game.paused?'ПАУЗА':game.phase==='wave'?(game.wave%10===0?'ОСАДНЫЙ ТИТАН':'ВРАЖЕСКИЙ ТРАФИК'):game.phase==='between'?`НОВАЯ ВОЛНА / ${Math.ceil(game.timer)} С`:game.phase==='repair'?'РЕМОНТ ЯДРА':'СЕТЬ ГОТОВА';
    $('threat').textContent=game.phase==='wave'?`${game.enemies.length} ЦЕЛЕЙ / ${game.spawned} ИЗ ${game.total} ВОШЛИ`:'ВХОДЯЩИЙ ТРАФИК / ОЖИДАНИЕ';
    $('record').textContent=game.best;$('kills').textContent=game.kills.toLocaleString('ru-RU');$('prestiges').textContent=game.prestiges;
    $('link-count').textContent=`${game.links(true).length} связей в сегменте`;const message=renderError||game.event;if($('event').textContent!==message)$('event').textContent=message;
    const nearest=game.enemies.reduce((a,b)=>!a||b.progress>a.progress?b:a,null);$('combat-summary').textContent=`На всей трассе: ${game.enemies.length} врагов. ${nearest?`Ближайший к ядру: ${D.enemies[nearest.type].name}, сегмент ${Math.floor(nearest.progress/C.pathLength)+1}. До ядра ${Math.ceil(game.totalPathLength-nearest.progress)} м.`:'Трасса свободна.'}`;
    $('hp').setAttribute('aria-valuetext',`${Math.ceil(game.hp)} из ${game.maxHp}`);navigation();
    $('run-toggle').innerHTML=!game.started?'ЗАПУСТИТЬ ОБОРОНУ <span>▶</span>':game.paused?'ПРОДОЛЖИТЬ <span>▶</span>':'ПАУЗА <span>Ⅱ</span>';
    $('prestige-hint').textContent=game.cycleBest>=20?`+${game.prestigeReward().format()} ◇ / волна цикла ${game.cycleBest}`:`Доступно после 20 волн цикла · ${game.cycleBest}/20`;
    for(const id of ['build','upgrade','evolve']){const enabled=game.canAutomate(id);$('auto-'+id).checked=enabled&&game.auto[id];$('auto-'+id).disabled=!enabled;$('lock-'+id).textContent=enabled?'Изучено · можно включить':`Нужно исследование «${D.research[C.autoResearch[id]].name}»`;}
    for(const b of document.querySelectorAll('[data-speed]'))b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===game.speed));
    for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));
    const pads=game.visibleTowers().map(t=>t?`${t.type}:${t.level}`:'-').join()+selected;
    if(padSignature!==pads){const focus=document.activeElement?.dataset?.slot;padSignature=pads;$('pad-strip').innerHTML=game.visibleTowers().map((t,i)=>{const slot=game.viewSegment*12+i;return `<button data-slot="${slot}" aria-pressed="${selected===slot}"><b>${selected===slot?'Выбран · ':''}Узел ${slot+1}</b><span>${t?`${D.towers[t.type].name} · ур. ${t.level}`:'Свободен'}</span></button>`;}).join('');if(focus!==undefined){const next=$('pad-strip').querySelector(`[data-slot="${focus}"]`);(next||$('pad-strip')).focus();}}
    const t=game.tower(selected),count=t?(bulk==='max'?game.affordableCount(selected):bulk):0;
    const signature=[tab,selected,blueprint,bulk,count,game.plans.get(selected),game.visibleTowers().map(t=>t?`${t.type}:${t.level}:${t.evolution}`:'-').join(),Object.values(game.research).join(),...Object.keys(D.towers).map(id=>game.credits.gte(D.towers[id].cost)),t&&game.credits.gte(C.cost(t,Math.max(1,count))),t&&game.evolveOptions(selected).map(e=>game.credits.gte(e.cost)),...Object.keys(D.research).map(id=>game.cores.gte(C.researchCost(id,game.research[id]))),tab==='research'?game.cores.format():''].join('|');
    if(signature!==panelSignature){
      const focus=document.activeElement,focusData=focus?.dataset?Object.entries(focus.dataset).find(([k])=>['action','research','evolve','bulk'].includes(k)):null;
      panelSignature=signature;$('panel').innerHTML=tab==='research'?showResearch():tab==='combos'?showCombos():showNode();
      if(focusData){const next=$('panel').querySelector(`[data-${focusData[0]}="${focusData[1]}"]`);if(next&&!next.disabled)next.focus();else $('panel').focus();}
    }
  }
  function modal(label,title,body,actions){
    if(!dialogOpen){wasPaused=game.paused;opener=document.activeElement;}dialogOpen=true;game.paused=true;accumulator=0;$('app').inert=true;
    $('dialog-label').textContent=label;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('dialog-actions').innerHTML=actions;$('dialog').hidden=false;
    update();$('dialog-actions').querySelector('button')?.focus();
  }
  function closeModal(){dialogOpen=false;$('dialog').hidden=true;$('app').inert=false;game.paused=wasPaused;last=null;accumulator=0;update();save();if(opener?.isConnected&&!opener.disabled)opener.focus();else $('field').focus();}
  function help(){modal('КРАТКИЙ ИНСТРУКТАЖ / 01','Собери сеть, которая не спит.',
    '<ul><li>Выбери свободный узел на карте и чертёж в арсенале. Нажми <strong>«Установить»</strong>.</li><li>Соседние Крио + Дуга, Крио + Плазма, Импульс + Рельс образуют комбинации. Нано ускоряет соседей.</li><li>Доведи башню до <strong>LV 10</strong>, подходящего соседа — до <strong>LV 5</strong>. Выбери одну из двух эволюций.</li><li>Улучшения без ограничения уровней. Каждые 25 уровней башня получает дополнительный ×2 урона.</li><li>Автостройка и автоулучшения сначала закрыты. Изучи их за нейроядра и включи нужный переключатель. Автостройка исполняет только твои задания «Запланировать автостройку». Автоэволюции также требуют исследования и выбирают первую доступную ветку.</li><li>Каждая новая отражённая волна открывает справа сегмент. Контрольные точки на сегментах 5, 10, 15… меняют только обзор карты. Каждая 10-я волна — босс и нейроядра. После 20 волн цикла доступна перезагрузка ради постоянных исследований.</li><li>При пробое ядра: 8 секунд ремонта, затем возврат к началу десятка волн. Башни и валюта остаются.</li><li>Вне игры работает только производство: до 8 часов, на базовой скорости 1×. Бой не симулируется.</li></ul><p><strong>Только при фокусе на карте:</strong> Page Up/Down — сегмент; Space — пауза; ← → — узел; B — построить; U — улучшить; 1/2/4 — скорость. Прогресс сохраняется каждые 5 секунд.</p>',actionButton('close','ПОНЯТНО',false,true));}
  function perform(action){
    if(action==='close'){closeModal();return;}
    if(action==='prestige-confirm'){if(game.prestige()){selected=0;if(renderer){renderer.selected=0;renderer.syncView(game);}wasPaused=false;panelSignature='';closeModal();}return;}
    if(action==='sell-confirm'){game.sell(selected);closeModal();panelSignature='';save();return;}
    if(dialogOpen)return;
    if(action==='build')game.build(selected,blueprint);
    else if(action==='plan')game.plan(selected,blueprint);
    else if(action==='unplan'){game.plans.delete(selected);game.say('Чертёж убран из очереди.');}
    else if(action==='upgrade'){const count=bulk==='max'?game.affordableCount(selected):bulk;game.upgrade(selected,count);}
    else if(action==='sell'){const t=game.tower(selected);if(t)modal('ДЕМОНТАЖ УЗЛА','Отключить башню?',`<p>Вернётся <strong>${t.spent.mul(.7).format()} кредитов</strong>. Уровни и эволюция потеряются. Без нового чертежа автостройка не восстановит башню.</p>`,actionButton('sell-confirm','ДЕМОНТИРОВАТЬ')+actionButton('close','ОСТАВИТЬ',false,true));return;}
    update();save();
  }
  function toggle(){if(dialogOpen||!renderer)return;if(!game.started)game.start();else game.paused=!game.paused;accumulator=0;last=null;update();save();}
  function changeSpeed(value){if(![1,2,4].includes(value))return;game.speed=value;update();save();}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.action){perform(b.dataset.action);return;}if(dialogOpen)return;
    if(b.dataset.blueprint){blueprint=b.dataset.blueprint;catalog();$('catalog').querySelector(`[data-blueprint="${blueprint}"]`)?.focus();if(game.tower(selected)){const free=game.visibleTowers().findIndex(t=>!t);if(free>=0)selected=game.viewSegment*12+free;}select(selected);}
    else if(b.dataset.checkpoint)navigate(Number(b.dataset.checkpoint)*5-1);
    else if(b.id==='segment-prev')navigate(game.viewSegment-1);
    else if(b.id==='segment-next')navigate(game.viewSegment+1);
    else if(b.id==='segment-first')navigate(0);
    else if(b.id==='segment-last')navigate(game.segmentCount-1);
    else if(b.id==='follow-threat'){const e=game.enemies.reduce((a,b)=>!a||b.progress>a.progress?b:a,null);if(e)navigate(Math.min(game.segmentCount-1,Math.floor(e.progress/C.pathLength)));else game.say('На трассе нет врагов.');update();}
    else if(b.dataset.slot!==undefined)select(Number(b.dataset.slot));
    else if(b.dataset.tab){tab=b.dataset.tab;panelSignature='';update();}
    else if(b.dataset.speed)changeSpeed(Number(b.dataset.speed));
    else if(b.dataset.bulk){bulk=b.dataset.bulk==='max'?'max':Number(b.dataset.bulk);panelSignature='';update();}
    else if(b.dataset.evolve){game.evolve(selected,b.dataset.evolve);update();save();}
    else if(b.dataset.research){game.buyResearch(b.dataset.research);update();save();}
    else if(b.id==='run-toggle')toggle();else if(b.id==='help'||b.id==='help-mobile')help();else if(b.id==='save')save();
    else if(b.id==='motion'&&renderer){renderer.reduced=!renderer.reduced;game.reducedMotion=renderer.reduced;b.setAttribute('aria-pressed',String(renderer.reduced));save();}
    else if(b.id==='prestige'){
      if(game.cycleBest<20)modal('ДОЛГОВРЕМЕННЫЙ ПРОГРЕСС','Нужны 20 волн в этом цикле.',`<p>Отражено <strong>${game.cycleBest} / 20</strong>. Перезагрузка вернёт бой на первую волну и даст нейроядра для постоянных исследований.</p>`,actionButton('close','ПРОДОЛЖИТЬ',false,true));
      else modal('ПЕРЕЗАГРУЗКА СЕТИ','Начать новый цикл?',`<p>Награда: <strong>+${game.prestigeReward().format()} нейроядер</strong>.</p><p>Башни, их уровни, эволюции, расширения пути, задания стройки и кредиты сбросятся. Первую башню снова выбираешь сам. Нейроядра, исследования, общий рекорд и статистика сохранятся.</p>`,actionButton('prestige-confirm','ПЕРЕЗАГРУЗИТЬ',false,true)+actionButton('close','ОСТАТЬСЯ'));
    }
  });
  for(const id of ['build','upgrade','evolve'])$('auto-'+id).addEventListener('change',()=>{game.auto[id]=game.canAutomate(id)&&$('auto-'+id).checked;update();save();});
  $('checkpoint-form').addEventListener('submit',event=>{event.preventDefault();if(dialogOpen)return;const n=Number($('checkpoint-number').value),total=Math.floor(game.segmentCount/5),valid=Number.isSafeInteger(n)&&n>=1&&n<=total;$('checkpoint-number').setAttribute('aria-invalid',String(!valid));$('checkpoint-error').textContent=valid?'':total?`Введи номер КП от 1 до ${total}.`:'Пока нет доступных контрольных точек.';if(valid)navigate(n*5-1);});
  $('field').addEventListener('click',event=>{if(dialogOpen||!renderer)return;const slot=renderer.pick(event.clientX,event.clientY);if(slot>=0)select(slot);});
  $('field').addEventListener('pointermove',event=>{if(renderer)renderer.hover=renderer.pick(event.clientX,event.clientY);});
  $('field').addEventListener('pointerleave',()=>{if(renderer)renderer.hover=-1;});
  document.addEventListener('keydown',event=>{
    if(dialogOpen){if(event.code==='Escape'){event.preventDefault();closeModal();}else if(event.code==='Tab'){const buttons=[...$('dialog-actions').querySelectorAll('button:not([disabled])')],index=buttons.indexOf(document.activeElement);if(buttons.length){event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}}return;}
    if(document.activeElement!==$('field'))return;
    if(event.repeat)return;
    if(event.code==='Space'){event.preventDefault();toggle();}
    else if(event.code==='ArrowRight'||event.code==='ArrowLeft'){event.preventDefault();select(game.viewSegment*12+(selected%12+(event.code==='ArrowRight'?1:11))%12);}
    else if(event.code==='PageDown'||event.code==='PageUp'){event.preventDefault();navigate(game.viewSegment+(event.code==='PageDown'?1:-1));}
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
    if(renderer){renderer.syncView(game);game.setViewport(document.hidden||dialogOpen?{x:0,y:0,width:0,height:0}:renderer.viewport());}
    if(renderer&&!document.hidden&&!dialogOpen&&!game.paused){accumulator+=elapsed*game.speed;let steps=0;while(accumulator>=1/30&&steps++<12){game.step(1/30);accumulator-=1/30;}}
    else accumulator=0;
    if(renderer&&!document.hidden){try{renderer.draw(game);}catch(error){renderError=`Ошибка отрисовки: ${error.message}`;renderer=null;game.paused=true;$('run-toggle').disabled=true;update();}}
    uiClock+=elapsed;if(uiClock>=.2){uiClock=0;update();}
    if(!document.hidden&&Date.now()-lastSaveAttempt>=5000)save();requestAnimationFrame(frame);
  }
  try{renderer=new TDRender.Renderer($('field'));renderer.selected=selected;renderer.syncView(game);renderer.reduced=game.reducedMotion??(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);$('motion').setAttribute('aria-pressed',String(renderer.reduced));}
  catch(error){$('run-toggle').disabled=true;renderError=`Не удалось запустить графику: ${error.message}`;}
  catalog();update();save();if(game.lastReward?.seconds>=60)showOffline();requestAnimationFrame(frame);
})();
