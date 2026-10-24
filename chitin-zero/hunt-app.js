(function () {
  'use strict';
  const D = HuntData, C = HuntCore, R = HuntRender, S = HuntStorage, $ = id => document.getElementById(id);
  let local; try { local = localStorage; } catch { local = null; }
  const store = new S.Store(local), audio = new ChitinAudio(), sprites = new R.Sprites();
  let profile = store.profile, renderer, game, demo, ready = false, loading = false, runId = '', settled = true;
  let screen = 'menu', dialog = '', autoFire = true, last = 0, accumulator = 0, hudClock = 0, noticeTime = 0, oldMessage = '', oldShots = 0, oldHp = 0;
  let yaw = 0, pitch = 0, looking = null, stickId = null, touchForward = 0, touchSide = 0;
  const keys = new Set(), once = {}, world = $('world');
  const timeText = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const button = (action, text, primary = false, disabled = false) => `<button data-action="${action}"${primary ? ' class="primary"' : ''}${disabled ? ' disabled' : ''}>${text}</button>`;
  const roman = n => ['','I','II','III','IV','V','VI'][n] || n;
  function clearInput() { keys.clear(); for (const id of Object.keys(once)) delete once[id]; looking = null; stickId = null; touchForward = touchSide = 0; accumulator = 0; }
  function release() { clearInput(); if (document.pointerLockElement) document.exitPointerLock(); }
  function lock() {
    if (screen !== 'run' || game?.status !== 'playing') return;
    audio.unlock();
    try { const promise = world.requestPointerLock?.(); promise?.catch(() => { $('lock').textContent = 'Обзор: зажми мышь и тяни или используй стрелки'; }); }
    catch { $('lock').textContent = 'Обзор: зажми мышь и тяни или используй стрелки'; }
  }
  function savePreferences() {
    if (!store.save({ ...store.profile, hunter: profile.hunter, arena: profile.arena, endless: profile.endless, sound: profile.sound, reduced: profile.reduced })) $('load-status').textContent = store.error;
    else profile = store.profile;
  }
  function menu() {
    screen = 'menu'; closeModal(); $('menu').hidden = false; $('hud').hidden = true; release();
    $('bank').textContent = `${store.profile.coins} ◈`;
    $('hunters').innerHTML = Object.entries(D.hunters).map(([id,h],i) => `<button class="hunter-card" data-hunter="${id}" aria-pressed="${id === profile.hunter}"><span class="sigil">${['✦','♜','☽'][i]}</span><b>${h.name}</b><small>${h.title} · ${h.hp} здоровья</small><p>${h.description}</p></button>`).join('');
    $('arenas').innerHTML = Object.entries(D.arenas).map(([id,a],i) => `<button class="arena-card" data-arena="${id}" aria-pressed="${id === profile.arena}" title="${a.description}"><em>${['†','♜','◇'][i]}</em>${a.name}</button>`).join('');
    $('mode').value = profile.endless ? 'endless' : 'trial'; $('sound').checked = profile.sound; $('reduced').checked = profile.reduced;
    audio.enabled = profile.sound; if (renderer) renderer.reduced = profile.reduced;
    demo = new C.Game({ hunter: profile.hunter, arena: profile.arena, seed: 1897 }); demo.player.x = 61.5; demo.player.z = 70.5; demo.player.yaw = -.2;
    for (let i=0;i<6;i++) demo.spawn(['ghoul','skeleton','cultist'][i%3], 52+i*2, 50-i);
  }
  function showModal(kind, kicker, title, body, actions) {
    dialog = kind; $('dialog-kicker').textContent = kicker; $('dialog-title').textContent = title;
    $('dialog-body').innerHTML = body; $('dialog-actions').innerHTML = actions; $('dialog-error').textContent = '';
    $('modal').hidden = false; release(); $('dialog-body').querySelector('button')?.focus();
    if (!$('dialog-body').querySelector('button')) $('dialog-actions').querySelector('button')?.focus();
  }
  function closeModal() { dialog = ''; $('modal').hidden = true; }
  function start() {
    if (!ready || !settled || screen !== 'menu' || dialog) return;
    savePreferences(); game = new C.Game({ hunter: profile.hunter, arena: profile.arena, endless: profile.endless, meta: store.profile.meta });
    runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`; settled = false; screen = 'run'; autoFire = true;
    yaw = game.player.yaw; pitch = game.player.pitch; oldShots = 0; oldHp = game.player.hp; oldMessage = ''; noticeTime = 0;
    $('menu').hidden = true; $('hud').hidden = false; $('place').textContent = D.arenas[game.map.kind].name;
    $('run-mode').textContent = game.endless ? 'БЕСКОНЕЧНАЯ ОХОТА' : 'ДО РАССВЕТА · 12 МИНУТ + ХРАНИТЕЛЬ';
    $('hunter-name').textContent = D.hunters[game.hunter].name; $('ability-name').textContent = D.hunters[game.hunter].ability;
    clearInput(); audio.unlock(); audio.tone('select'); updateHud(); lock();
  }
  function pause() {
    if (screen !== 'run' || game.status !== 'playing') return;
    game.status = 'paused';
    showModal('pause', 'НОЧЬ ПОДОЖДЁТ', 'Охота приостановлена', '<p>Время, враги, снаряды и анимация оружия остановлены. При выходе заработанные монеты сохранятся, но сам забег завершится.</p>', button('resume','ПРОДОЛЖИТЬ',true)+button('help','УПРАВЛЕНИЕ')+button('retire','ЗАВЕРШИТЬ ОХОТУ'));
  }
  function resume() { if (!game || game.status !== 'paused') return; if (!ready) { $('dialog-error').textContent = 'Дождись восстановления графического контекста или заверши охоту.'; return; } closeModal(); clearInput(); game.status = 'playing'; lock(); }
  function upgrades() {
    const cards = game.offers.map((c,i) => {
      const w = c.type === 'weapon' ? D.weapons[c.id] : null;
      const detail = w && c.level === 5 ? `<p>Для эволюции: «${D.passives[w.passive].name}» II.</p>` : '';
      return `<button data-choice="${i}" class="choice${c.level===6?' evolved':''}"><small>${i+1} / ${c.rarity}</small><span class="choice-icon">${w?'✦':D.passives[c.id]?.icon||'✚'} ${roman(c.level||0)}</span><b>${c.title}</b><p>${c.text}</p>${detail}</button>`;
    }).join('');
    showModal('upgrade', `УРОВЕНЬ ${game.player.level} · ДУШИ ПРИНЯЛИ ТВОЙ ДАР`, 'Выбери силу', `<div class="choices">${cards}</div>`, button('reroll',`ДРУГИЕ ДАРЫ · ${game.rerolls} ОСТАЛОСЬ`,false,game.rerolls<=0));
  }
  function choose(i) { if (dialog !== 'upgrade' || !game.choose(i)) return; audio.tone('upgrade'); clearInput(); if (game.status === 'upgrade') upgrades(); else { closeModal(); updateHud(); lock(); } }
  function finish() {
    if (!game || !['dead','won','abandoned'].includes(game.status)) return;
    settled = store.reward(runId,game); const reward = Math.floor(game.coins * game.player.fortune);
    showModal('result', game.status === 'won' ? 'ПЕРВЫЙ СВЕТ' : 'АРХИВ ПОПОЛНЕН', game.status === 'dead' ? 'Ночь забрала своё' : game.status === 'won' ? 'Ты встретил рассвет' : 'Охота завершена',
      `<div class="results"><div><b>${timeText(game.time)}</b><span>ВРЕМЯ</span></div><div><b>${game.kills}</b><span>УНИЧТОЖЕНО</span></div><div><b>${game.player.level}</b><span>УРОВЕНЬ</span></div><div><b>+${reward} ◈</b><span>${settled?'СОХРАНЕНО':'ОЖИДАЕТ СОХРАНЕНИЯ'}</span></div></div><p>Наследие усиливает следующего охотника. Оружие и реликвии собираются заново в каждой охоте.</p>`,
      settled ? button('menu','ВЕРНУТЬСЯ В ОБЩЕСТВО',true) : button('retry-save','ПОВТОРИТЬ СОХРАНЕНИЕ',true)+button('forfeit','ВЫЙТИ БЕЗ НАГРАДЫ'));
    if (!settled) $('dialog-error').textContent = store.error; else profile = store.profile;
  }
  function archive() {
    const p = store.profile;
    const cards = Object.entries(D.meta).map(([id,s]) => `<div class="meta-card"><h3>${s.name}</h3><p>${s.text} · ${p.meta[id]} / ${s.max}</p><button data-buy="${id}"${p.meta[id]>=s.max||p.coins<S.cost(p.meta[id])?' disabled':''}>${p.meta[id]>=s.max?'ЗАВЕРШЕНО':`ПРИНЕСТИ ${S.cost(p.meta[id])} ◈`}</button></div>`).join('');
    showModal('archive', `${p.coins} ◈ · ${p.runs} ОХОТ · РЕКОРД ${timeText(p.best)}`, 'Наследие охотника', `<div class="meta-grid">${cards}</div>`,button('close','НАЗАД',true));
  }
  function help() {
    showModal('help','ПАМЯТКА ОХОТНИКУ','Двигайся. Стреляй. Выживай.', '<div class="controls-table"><b>W A S D</b><span>Движение относительно направления взгляда</span><b>Мышь / стрелки</b><span>Обзор. Без захвата курсора — зажми мышь и тяни.</span><b>Space</b><span>Прыжок</span><b>Shift / Ctrl</b><span>Рывок с короткой неуязвимостью</span><b>F / ЛКМ</b><span>Переключить автоогонь / стрелять вручную</span><b>Q</b><span>Способность. Заряжается за уничтожение врагов.</span><b>E</b><span>Открыть ближайший реликварий</span><b>1–4</b><span>Выбрать дар при повышении уровня</span><b>Esc / P</b><span>Пауза</span></div><p>Все стволы стреляют одновременно по направлению прицела. Собирай светящиеся души для новых оружий и реликвий. Оружие V + связанная реликвия II открывают эволюцию VI. На сенсорном экране: левый стик — движение, правая область — обзор.</p>',button('close','ПОНЯТНО',true));
  }
  function updateHud() {
    const p = game.player; $('timer').textContent=timeText(game.time); $('kills').textContent=game.kills; $('run-coins').textContent=`${Math.floor(game.coins*p.fortune)} ◈`;
    $('health').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`; $('hp').value=p.hp/p.maxHp; $('xp-fill').style.width=`${p.xp/p.nextXp*100}%`; $('level').textContent=`УРОВЕНЬ ${p.level}`;
    $('ability').value=p.charge; $('ability-value').textContent=`${Math.floor(p.charge)}%`; $('dash').textContent=p.dashCooldown>0?`РЫВОК · ${p.dashCooldown.toFixed(1)} с`:'SHIFT / CTRL · РЫВОК ГОТОВ';
    $('fire-state').textContent=`F · АВТООГОНЬ ${autoFire?'ВКЛ':'ВЫКЛ · ЛКМ'}`; $('arsenal-count').textContent=`АРСЕНАЛ ${p.weapons.length} / 14`;
    const signature=p.weapons.map(w=>w.id+w.level).join();
    if($('weapon-list').dataset.signature!==signature){$('weapon-list').dataset.signature=signature;$('weapon-list').innerHTML=p.weapons.map(w=>`<span title="${D.weapons[w.id].name} · ${roman(w.level)}">${D.weapons[w.id].sprite+1}<sup>${roman(w.level)}</sup></span>`).join('');}
    const boss=game.enemies.find(e=>e.boss&&!e.dead);$('boss').hidden=!boss;if(boss)$('boss-hp').value=boss.hp/boss.maxHp;
    $('interaction').hidden=!game.chests.some(c=>C.distance(c,p)<2.4&&!game.map.trace({x:p.x,y:1,z:p.z},{x:c.x,y:1,z:c.z}));
    $('lock').hidden=!!document.pointerLockElement||game.status!=='playing';
    if(oldMessage!==game.message){oldMessage=game.message;noticeTime=game.time+5;$('notice').textContent=game.message;}$('notice').hidden=game.time>noticeTime;
  }
  function action(name) {
    if(name==='resume')resume();
    else if(name==='retire')showModal('retire','ЗАВЕРШЕНИЕ ЗАБЕГА','Покинуть охоту?','<p>Этот забег нельзя будет продолжить. Заработанные монеты перейдут в наследие.</p>',button('retire-confirm','ЗАВЕРШИТЬ',true)+button('resume','ОСТАТЬСЯ'));
    else if(name==='retire-confirm'){game.status='abandoned';finish();}
    else if(name==='menu'&&settled)menu();
    else if(name==='retry-save')finish();
    else if(name==='forfeit')showModal('forfeit','НАГРАДА НЕ СОХРАНЕНА','Выйти без награды?','<p>Монеты этого забега будут потеряны. Ранее сохранённое наследие останется.</p>',button('forfeit-confirm','ВЫЙТИ БЕЗ НАГРАДЫ')+button('retry-save','ПОВТОРИТЬ СОХРАНЕНИЕ',true));
    else if(name==='forfeit-confirm'){settled=true;menu();}
    else if(name==='reroll'&&dialog==='upgrade'&&game.rerolls>0){game.rerolls--;game.offer();upgrades();}
    else if(name==='help')help();
    else if(name==='close'){closeModal();if(screen==='run'&&game?.status==='paused'){game.status='playing';pause();}else {menu();$('start').focus();}}
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.hunter&&screen==='menu'&&!dialog){profile.hunter=b.dataset.hunter;menu();savePreferences();}
    else if(b.dataset.arena&&screen==='menu'&&!dialog){profile.arena=b.dataset.arena;menu();savePreferences();}
    else if(b.dataset.choice!==undefined)choose(Number(b.dataset.choice));
    else if(b.dataset.buy&&dialog==='archive'){const ok=store.purchase(b.dataset.buy);profile=store.profile;archive();if(!ok)$('dialog-error').textContent=store.error;}
    else if(b.dataset.action)action(b.dataset.action);
    else if(b.id==='start')start();else if(b.id==='pause')pause();else if(b.id==='archive')archive();else if(b.id==='help')help();else if(b.id==='lock')lock();else if(b.id==='retry-assets')load();
  });
  $('mode').addEventListener('change',()=>{profile.endless=$('mode').value==='endless';savePreferences();});
  $('sound').addEventListener('change',()=>{profile.sound=$('sound').checked;audio.enabled=profile.sound;audio.unlock();savePreferences();});
  $('reduced').addEventListener('change',()=>{profile.reduced=$('reduced').checked;if(renderer)renderer.reduced=profile.reduced;savePreferences();});
  document.addEventListener('keydown',event=>{
    if(event.code==='Tab'&&dialog){const buttons=[...$('modal').querySelectorAll('button:not([disabled])')];if(buttons.length){const i=buttons.indexOf(document.activeElement),next=event.shiftKey?(i<=0?buttons.length-1:i-1):(i+1)%buttons.length;event.preventDefault();buttons[next].focus();}return;}
    if(event.code==='Escape'||event.code==='KeyP'){if(!event.repeat){if(dialog==='pause')resume();else if(game?.status==='playing'&&screen==='run')pause();else if(['help','archive'].includes(dialog))action('close');}event.preventDefault();return;}
    if(dialog==='upgrade'&&/^Digit[1-4]$/.test(event.code)){event.preventDefault();if(!event.repeat)choose(Number(event.code.slice(-1))-1);return;}
    if(screen!=='run'||game?.status!=='playing'||dialog)return;
    if(['Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyF'].includes(event.code))event.preventDefault();
    keys.add(event.code);if(!event.repeat){if(event.code==='Space')once.jump=true;if(event.code.startsWith('Shift')||event.code.startsWith('Control'))once.dash=true;if(event.code==='KeyQ')once.ability=true;if(event.code==='KeyE')once.interact=true;if(event.code==='KeyF')autoFire=!autoFire;}
  });
  document.addEventListener('keyup',event=>keys.delete(event.code));
  world.addEventListener('pointerdown',event=>{if(screen!=='run'||game.status!=='playing')return;if(event.button>0)return;audio.unlock();looking={id:event.pointerId,x:event.clientX,y:event.clientY};world.setPointerCapture?.(event.pointerId);if(event.pointerType!=='touch'){keys.add('Fire');lock();}});
  document.addEventListener('pointermove',event=>{
    if(screen!=='run'||game?.status!=='playing')return;
    let dx=0,dy=0;if(document.pointerLockElement===world){dx=event.movementX||0;dy=event.movementY||0;}
    else if(looking?.id===event.pointerId){dx=event.clientX-looking.x;dy=event.clientY-looking.y;looking.x=event.clientX;looking.y=event.clientY;}
    yaw+=C.clamp(dx,-180,180)*.0025;pitch=C.clamp(pitch-C.clamp(dy,-180,180)*.0025,-1.1,1.1);
  });
  const pointerEnd=event=>{if(looking?.id===event.pointerId){looking=null;keys.delete('Fire');}if(stickId===event.pointerId){stickId=null;touchForward=touchSide=0;}};
  document.addEventListener('pointerup',pointerEnd);document.addEventListener('pointercancel',pointerEnd);
  document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&screen==='run'&&game?.status==='playing')pause();else if(game)updateHud();});
  $('stick').addEventListener('pointerdown',event=>{if(screen!=='run'||game.status!=='playing')return;stickId=event.pointerId;$('stick').setPointerCapture?.(event.pointerId);event.preventDefault();});
  $('stick').addEventListener('pointermove',event=>{if(stickId!==event.pointerId)return;const r=$('stick').getBoundingClientRect();touchSide=C.clamp((event.clientX-r.left-r.width/2)/40,-1,1);touchForward=C.clamp(-(event.clientY-r.top-r.height/2)/40,-1,1);});
  $('touch-controls').addEventListener('pointerdown',event=>{const b=event.target.closest('button');if(b?.dataset.input&&screen==='run'&&game.status==='playing'){event.preventDefault();once[b.dataset.input]=true;}});
  addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
  addEventListener('resize',()=>renderer?.resize());
  world.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;pause();$('start').disabled=true;$('load-status').textContent='Графический контекст потерян. Перезагрузи страницу для восстановления.';if(dialog)$('dialog-error').textContent='Графический контекст потерян. Можно завершить охоту и сохранить награду.';});
  world.addEventListener('webglcontextrestored',()=>{try{renderer=new R.Renderer(world,$('weapons'),sprites);renderer.reduced=profile.reduced;ready=sprites.ready;$('start').disabled=!ready;$('load-status').textContent='Арсенал готов';}catch(error){$('load-status').textContent=error.message;}});
  async function load(){
    if(loading)return;loading=true;ready=false;$('start').disabled=true;$('retry-assets').hidden=true;
    try{await sprites.load((n,total)=>{$('load-status').textContent=`Загрузка арсенала · ${Math.round(n/total*100)}%`;});renderer=renderer||new R.Renderer(world,$('weapons'),sprites);renderer.reduced=profile.reduced;ready=true;$('start').disabled=false;$('start').textContent='НАЧАТЬ ОХОТУ →';$('load-status').textContent=store.error||'14 оружий · 3 охотника · 3 места охоты';}
    catch(error){$('load-status').textContent=`Ошибка загрузки: ${error.message}`;$('retry-assets').hidden=false;}
    finally{loading=false;}
  }
  function frame(stamp){
    const elapsed=last?Math.min(.1,Math.max(0,(stamp-last)/1000)):0;last=stamp;
    if(ready&&screen==='run'&&game.status==='playing'){
      accumulator+=elapsed;
      while(accumulator>=1/60&&game.status==='playing'){
        yaw+=((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*1.8/60;pitch=C.clamp(pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*1.4/60,-1.1,1.1);
        game.step(1/60,{forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)+touchForward,side:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchSide,yaw,pitch,fire:autoFire||keys.has('Fire'),...once});
        for(const id of Object.keys(once))delete once[id];accumulator-=1/60;
      }
      if(game.shots!==oldShots){audio.tone('shot');oldShots=game.shots;}if(game.player.hp<oldHp)audio.tone('hit');oldHp=game.player.hp;
      if(game.status==='upgrade')upgrades();else if(['dead','won'].includes(game.status)){audio.tone(game.status==='dead'?'death':'upgrade');finish();}
      hudClock+=elapsed;if(hudClock>.08||game.status!=='playing'){hudClock=0;updateHud();}
    }
    if(ready&&renderer){if(screen==='menu'&&demo){if(!profile.reduced)demo.player.yaw+=elapsed*.035;renderer.draw(demo);renderer.ctx.clearRect(0,0,renderer.width,renderer.height);}else if(game)renderer.draw(game);}
    requestAnimationFrame(frame);
  }
  if(!profile.reduced&&typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)profile.reduced=true;
  menu();load();requestAnimationFrame(frame);
})();
