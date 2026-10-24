(function () {
  'use strict';
  const D = ChitinData, C = ChitinCore, combat = ChitinCombat, Store = ChitinStorage, E = ChitinEconomy;
  const $ = id => document.getElementById(id), number = n => Math.floor(n).toLocaleString('ru-RU');
  const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  let storage = null; try { storage = window.localStorage; } catch { /* Private browsing may block access. */ }
  const settings = Store.load(storage), audio = new ChitinAudio(), sprites = new ChitinSprites.Sprites();
  const renderer = new ChitinRenderer($('world'), $('radar'), sprites);
  const keys = new Set(), pointer = { x: 0, y: 0, held: false, id: null }, touch = { x: 0, y: 0, id: null };
  let game = null, lastStatus = '', lastFrame = 0, accumulated = 0, hudClock = 0, moduleKey = '', dialogMode = '', savedFocus = null;
  let dashPressed = false, corePressed = false, noticeTimer = null, previewTime = 0, shotSerial = 0, lastHp = 0;
  let marketFilter = 'all', bankingClock = 0, bankWarning = false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) settings.reducedEffects = true;
  function notify(message) { $('notice').textContent = message; $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6000); }
  function save() { if (!Store.save(storage, settings)) notify('Хранилище недоступно. Рекорд останется только до закрытия страницы.'); }
  function bank() {
    if (!game) return true;
    const result = Store.bankBounty(storage, settings, game);
    if (!result.ok && !bankWarning) { notify('Bounty пока не сохранён. Проверь доступ к хранилищу; начисление будет повторено.'); bankWarning = true; }
    if (result.ok) bankWarning = false;
    return result.ok;
  }
  function resetInput() { keys.clear(); pointer.held = false; pointer.id = null; touch.x = touch.y = 0; touch.id = null; dashPressed = corePressed = false; $('stick').style.transform = ''; }
  function closeDialog() {
    $('modal').hidden = true; dialogMode = ''; $('hangar').inert = false; $('battle').inert = false;
    if (game) $('world').focus({ preventScroll: true }); else savedFocus?.focus({ preventScroll: true });
  }
  function dialog(mode, title, kicker, content) {
    if ($('modal').hidden) savedFocus = document.activeElement;
    dialogMode = mode; resetInput(); $('dialog-title').textContent = title; $('dialog-kicker').textContent = kicker;
    $('dialog-body').innerHTML = content; $('modal').hidden = false; $('hangar').inert = true; $('battle').inert = true;
    $('dialog-title').focus({ preventScroll: true });
  }
  function options() {
    $('chassis-options').innerHTML = Object.entries(D.chassis).map(([id, s]) => `<button class="chassis-card" data-chassis="${id}" aria-pressed="${id === settings.chassis}"><small>${s.serial}</small><strong>${s.name}</strong><span>КОРПУС ${s.hp} / ЩИТ ${s.shield}</span></button>`).join('');
    $('core-options').innerHTML = Object.entries(D.cores).map(([id, s]) => `<button class="core-choice" style="--accent:${s.color}" data-core="${id}" aria-pressed="${id === settings.core}"><span>${s.glyph}</span>${s.name}</button>`).join('');
    const frame = D.chassis[settings.chassis];
    $('frame-name').textContent = frame.name; $('frame-serial').textContent = frame.serial; $('frame-role').textContent = frame.role;
    $('frame-description').textContent = frame.description; $('core-description').textContent = D.cores[settings.core].description;
    $('best-kills').textContent = String(settings.bestKills).padStart(4, '0'); $('best-time').textContent = clock(settings.bestTime); $('run-count').textContent = String(settings.runs).padStart(2, '0');
    const configuration = E.build(settings, settings.chassis);
    $('wallet').textContent = `${number(settings.credits)} AC`;
    $('loadout-summary').textContent = Object.values(configuration.loadout).map(id => E.parts[id].name.split(' / ')[0]).join(' · ') || 'Штатная конфигурация';
    $('power-summary').textContent = `ЭНЕРГОСЕТЬ ${configuration.power}/${configuration.capacity} · ДЕТАЛЕЙ ${settings.ownedParts.length}/16`;
    $('sound-setting').textContent = `ЗВУК: ${settings.sound ? 'ВКЛ' : 'ВЫКЛ'}`;
    $('effects-setting').textContent = `ЭФФЕКТЫ: ${settings.reducedEffects ? 'МЯГКИЕ' : 'ПОЛНЫЕ'}`;
    audio.enabled = settings.sound; renderer.reduced = settings.reducedEffects; document.body.classList.toggle('reduced', settings.reducedEffects);
  }
  function deploy() {
    if (!sprites.ready) return;
    if (game && !bank()) { notify('Не удалось сохранить bounty. Вылет не перезапущен — награда пока остаётся в текущем результате.'); return; }
    audio.unlock(); audio.tone('select'); resetInput(); closeDialog();
    game = new C.Game({ chassis: settings.chassis, core: settings.core, combat, profile: settings });
    bankingClock = 0;
    lastStatus = ''; shotSerial = 0; lastHp = game.player.hp + game.player.shield; moduleKey = ''; accumulated = 0;
    $('hangar').hidden = true; $('battle').hidden = false; renderer.resize(); updateHud(); $('world').focus({ preventScroll: true });
  }
  function returnHangar() { if (!bank()) { notify('Сначала нужно сохранить bounty. Результат оставлен открытым для повторной попытки.'); return; } resetInput(); game = null; lastStatus = ''; closeDialog(); $('battle').hidden = true; $('hangar').hidden = false; options(); $('deploy').focus(); }
  function partIcon(part) {
    const rows = ChitinSprites.manifest.parts.rows, row = Math.floor(part.visual / 4);
    return `<svg class="part-icon" viewBox="${part.visual % 4 * 250} ${rows[row] * 1000} 250 ${(rows[row + 1] - rows[row]) * 1000}" aria-hidden="true"><image href="assets/parts.png" width="1000" height="1000"/></svg>`;
  }
  function workshop() {
    if (game) return;
    const chassis = settings.chassis, frame = D.chassis[chassis], build = E.build(settings, chassis), s = build.effects;
    dialog('workshop', `${frame.name} / СБОРКА`, `МАСТЕРСКАЯ · ${number(settings.credits)} АСТРО-КРЕДИТОВ`,
      `<p class="dialog-lead">Пять креплений, одна деталь в каждом. Установка и снятие бесплатны. Купленные детали сохраняются после гибели. Каждая деталь меняет спрайт меха.</p><div class="assembly-layout"><div class="assembly-preview"><canvas id="assembly-preview" width="640" height="640" aria-label="Внешний вид установленной сборки"></canvas><strong>ЭНЕРГОСЕТЬ ${build.power} / ${build.capacity}</strong><p>КОРПУС ${frame.hp} → ${frame.hp + (s.hp || 0)}<br>ЩИТ ${frame.shield} → ${frame.shield + (s.shield || 0)}<br>СКОРОСТЬ ${frame.speed} → ${Math.round(frame.speed * (1 + (s.speed || 0)))}<br>ОРУЖИЕ: ${D.weapons[build.weapon].name}</p></div><div class="assembly-slots">${Object.entries(E.slots).map(([slot, name]) => {
        const installed = build.loadout[slot], owned = settings.ownedParts.filter(id => E.parts[id].slot === slot);
        return `<section class="assembly-slot"><div class="slot-heading"><strong>${name}</strong><span>${installed ? E.parts[installed].name : 'Штатная система'}</span></div>${installed ? `<button class="quiet" data-remove="${slot}">СНЯТЬ / ВЕРНУТЬ ШТАТНУЮ</button>` : ''}<div class="owned-parts">${owned.map(id => {
          const part = E.parts[id], compatible = E.compatible(id, chassis), power = build.power - (installed ? E.parts[installed].power : 0) + part.power;
          return `<button class="owned-part" data-equip="${id}" data-slot="${slot}" aria-pressed="${id === installed}" ${!compatible || power > build.capacity || id === installed ? 'disabled' : ''}>${partIcon(part)}<span><b>${part.name}</b><small>${part.description}</small><em>${!compatible ? 'НЕСОВМЕСТИМО С ШАССИ' : power > build.capacity ? 'НЕДОСТАТОЧНО ЭНЕРГИИ' : id === installed ? 'УСТАНОВЛЕНО' : `УСТАНОВИТЬ / ${part.power} ЭНЕРГИИ`}</em></span></button>`;
        }).join('') || '<p class="empty-slot">Купи детали для этого крепления на чёрном рынке.</p>'}</div></section>`;
      }).join('')}</div></div><div class="dialog-actions"><button class="primary" data-action="market">ЧЁРНЫЙ РЫНОК</button><button class="secondary" data-action="close-garage">В АНГАР</button></div>`);
  }
  function market() {
    if (game) return;
    const cards = Object.entries(E.parts).filter(([, part]) => marketFilter === 'all' || part.slot === marketFilter);
    dialog('market', 'ЧЁРНЫЙ РЫНОК.', `СВОБОДНАЯ ОРБИТА / БАЛАНС ${number(settings.credits)} AC`,
      `<p class="dialog-lead">Только игровые Астро-Кредиты. Покупка открывает деталь навсегда; установка — в мастерской. Одна покупка доступна всем совместимым шасси.</p><div class="market-tabs">${[['all', 'Все детали'], ...Object.entries(E.slots)].map(([id, name]) => `<button class="secondary" data-filter="${id}" aria-pressed="${marketFilter === id}">${name}</button>`).join('')}</div><div class="market-grid">${cards.map(([id, part]) => {
        const owned = settings.ownedParts.includes(id), allowed = E.compatible(id, settings.chassis);
        return `<article class="market-card">${partIcon(part)}<small>${E.slots[part.slot]} / ${part.power} ЭНЕРГИИ</small><h3>${part.name}</h3><p>${part.description}</p><span class="compatibility">${part.chassis ? part.chassis.map(c => D.chassis[c].name).join(' / ') : 'ВСЕ ШАССИ'}${!allowed ? ' · выбрано другое шасси' : ''}</span><button class="${owned ? 'secondary' : 'primary'}" ${owned ? 'data-action="workshop"' : `data-buy="${id}"`} ${!owned && settings.credits < part.price ? 'disabled' : ''}>${owned ? 'КУПЛЕНО → УСТАНОВИТЬ' : `КУПИТЬ / ${part.price} AC`}</button></article>`;
      }).join('')}</div><details class="bounty-rates"><summary>BOUNTY / ТАРИФЫ ЗА УНИЧТОЖЕНИЕ</summary><p>${Object.entries(E.bounty).map(([id, value]) => `${D.enemies[id].name}: ${value} AC`).join(' · ')}<br>Элита: ×3. Начисление автоматическое, в том числе при гибели и прерывании вылета.</p></details><div class="dialog-actions"><button class="secondary" data-action="workshop">МАСТЕРСКАЯ</button><button class="secondary" data-action="close-garage">В АНГАР</button></div>`);
  }
  function garageTransaction(operation, success, page) {
    if (game) return;
    const result = Store.transact(storage, settings, operation);
    if (!result.ok) { notify(result.message); return; }
    options(); page(); audio.tone('select'); notify(success);
  }
  function upgradeDialog() {
    const p = game.player;
    dialog('upgrade', 'ПЕРЕПИШИ ПРАВИЛА БОЯ.', `СИНХРОНИЗАЦИЯ ${p.level} / ВЫБЕРИ ОДНО УЛУЧШЕНИЕ`,
      `<p class="dialog-lead">Время остановлено. Выбранная система устанавливается сразу.</p><div class="upgrade-cards">${game.offers.map((o, i) => `<button class="upgrade-card" data-choice="${i}" style="--accent:${o.color}"><kbd>${i + 1}</kbd><span class="glyph">${o.glyph}</span><small>${o.label}</small><strong>${o.name}</strong><p>${o.description}</p><em>УРОВЕНЬ ${o.level.toString().padStart(2, '0')} → УСТАНОВИТЬ</em></button>`).join('')}</div><div class="dialog-actions"><button class="secondary" data-action="reroll" ${game.rerolls ? '' : 'disabled'}>НОВЫЙ НАБОР / ${game.rerolls}</button></div><p class="draft-footer">Модули ${p.weapons.length}/4 · Ядро ${D.cores[p.core].name} · Выбор: клавиши 1–3 или мышь</p>`);
  }
  function pauseDialog() {
    dialog('pause', 'СИГНАЛ ПРИОСТАНОВЛЕН.', 'ТАКТИЧЕСКАЯ ПАУЗА',
      `<p class="dialog-lead">Время, враги и перезарядка способностей остановлены.</p>${buildSummary()}<div class="dialog-actions"><button class="primary" data-action="resume">ВЕРНУТЬСЯ В БОЙ</button><button class="secondary" data-action="help">УПРАВЛЕНИЕ И СБОРКИ</button><button class="secondary" data-action="sound">ЗВУК: ${settings.sound ? 'ВКЛ' : 'ВЫКЛ'}</button><button class="secondary danger" data-action="abandon">ПРЕРВАТЬ ОПЕРАЦИЮ</button></div>`);
  }
  function buildSummary() {
    if (!game) return '';
    return `<div class="build-summary">${game.player.weapons.map(w => `${D.weapons[w.id].name} ${w.level >= 6 ? '/ ЭВОЛЮЦИЯ' : `УРОВЕНЬ ${w.level}`}`).join(' · ')}<br>${Object.entries(game.player.passives).map(([id, level]) => `${D.passives[id].name} ${level}`).join(' · ') || 'Пассивные системы ещё не установлены.'}</div>`;
  }
  function help() {
    dialog('help', 'ПАМЯТКА ПИЛОТА.', 'ИНСТРУКТАЖ / KHEPRI–4',
      `<p class="dialog-lead">Бесконечный режим. Каждую минуту рой усиливается; каждые две минуты приходит матка. Собирай бирюзовый опыт, выбирай улучшения и побей рекорд уничтожений.</p><dl class="controls-list"><dt>WASD / стрелки</dt><dd>Движение. На сенсорном экране — левый джойстик.</dd><dt>Автоогонь</dt><dd>Модули сами выбирают ближайшую цель в радиусе.</dd><dt>Зажать ЛКМ</dt><dd>Все направленные модули стреляют к указателю.</dd><dt>Shift / Пробел</dt><dd>Рывок по направлению движения; без движения — вперёд. Во время рывка мех не получает урон.</dd><dt>Q / кнопка ядра</dt><dd>Активная способность. Заряд накапливается за убийства.</dd><dt>Esc / P</dt><dd>Пауза. При переключении вкладки бой также приостанавливается.</dd><dt>Щит / ремонт</dt><dd>Щит восстанавливается после 4 секунд без урона. Корпус — ремкомплектами и нанитами. Гнёзда дают ремонт и сбор опыта.</dd><dt>Модули / эволюции</dt><dd>Не больше 4 оружий. Модуль V + связанное улучшение II открывают эволюцию VI.</dd></dl><p class="build-summary">${Object.entries(combat.evolutions).map(([id, e]) => `${D.weapons[id].name} + ${D.passives[e.passive].name} II → ${e.name}`).join('<br>')}</p><div class="dialog-actions"><button class="primary" data-action="close-help">ПОНЯТНО</button></div>`);
  }
  function deathDialog() {
    const previous = settings.bestKills;
    bank();
    if (Store.record(settings, game)) save();
    audio.tone('death');
    dialog('dead', 'МЕХ ПОТЕРЯН. ТЫ — НЕТ.', game.kills > previous ? 'НОВЫЙ РЕКОРД ЗАЧИСТКИ' : 'ОПЕРАЦИЯ ЗАВЕРШЕНА',
      `<p class="dialog-lead">${game.abandoned ? 'Операция прервана пилотом.' : 'Критическое разрушение корпуса.'} Улучшения забега потеряны. Купленные детали и Астро-Кредиты сохранены при доступном хранилище.</p><div class="results-grid"><div><small>УНИЧТОЖЕНО</small><strong>${number(game.kills)}</strong></div><div><small>ВРЕМЯ</small><strong>${clock(game.time)}</strong></div><div><small>МАТКИ</small><strong>${game.bossKills}</strong></div><div><small>BOUNTY</small><strong>${number(game.bountyTotal)} AC</strong></div></div><p class="dialog-lead" id="bounty-result">${game.bountyPaid === game.bountyTotal ? 'Награда зачислена.' : 'Награда ожидает сохранения. Не закрывай страницу.'} Баланс: ${number(settings.credits)} AC.</p><p class="dialog-lead">Уровень: ${game.player.level} · Гнёзда: ${game.nests} · Лучшая цепочка: ${game.bestCombo} · Урон: ${number(game.damageDone)}</p>${buildSummary()}<div class="dialog-actions"><button class="primary" data-action="restart">ЕЩЁ ОДИН ВЫЛЕТ ↗</button><button class="secondary" data-action="hangar">АНГАР / МОДИФИКАЦИЯ</button></div>`);
    if (game.bountyTotal > game.bountyPaid) $('dialog-body').innerHTML += '<div class="dialog-actions"><button class="secondary danger" data-action="bounty-loss">ХРАНИЛИЩЕ НЕДОСТУПНО / ВЫЙТИ БЕЗ НАГРАДЫ</button></div>';
  }
  function pick(index) {
    if (!game || !combat.choose(game, index)) return;
    audio.unlock(); audio.tone('upgrade'); moduleKey = '';
    if (game.status === 'upgrade') upgradeDialog(); else closeDialog();
    lastStatus = game.status; updateHud();
  }
  function updateHud() {
    if (!game) return;
    const p = game.player;
    $('hud-chassis').textContent = D.chassis[p.chassis].name; $('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('shield-text').textContent = `${Math.ceil(p.shield)} / ${p.maxShield}`;
    $('hp-fill').style.width = `${p.hp / p.maxHp * 100}%`; $('shield-fill').style.width = `${p.shield / p.maxShield * 100}%`;
    $('timer').textContent = clock(game.time); $('kills').textContent = number(game.kills); $('wave').textContent = `ЭСКАЛАЦИЯ ${String(game.wave).padStart(2, '0')}`;
    $('bounty-hud').textContent = `${number(game.bountyTotal)} AC`;
    $('bounty-pending').textContent = game.bountyTotal > game.bountyPaid ? `+${number(game.bountyTotal - game.bountyPaid)} к зачислению` : 'ЗАЧИСЛЕНО';
    if (dialogMode === 'dead') $('bounty-result').textContent = `${game.bountyPaid === game.bountyTotal ? 'Награда зачислена.' : 'Награда ожидает сохранения. Не закрывай страницу.'} Баланс: ${number(settings.credits)} AC.`;
    $('xp-fill').style.width = `${p.xp / p.xpNext * 100}%`; $('level').textContent = `СИНХРОНИЗАЦИЯ / ${String(p.level).padStart(2, '0')}`;
    $('dash-state').textContent = p.dashCooldown <= 0 ? 'ГОТОВ' : `${p.dashCooldown.toFixed(1)} С`;
    $('dash-button').classList.toggle('ready', p.dashCooldown <= 0);
    $('core-label').textContent = D.cores[p.core].name; $('core-state').textContent = p.coreTime > 0 ? `${p.coreTime.toFixed(1)} С` : p.charge >= 100 ? 'АКТИВИРОВАТЬ' : `${Math.floor(p.charge)}%`;
    $('core-fill').style.width = `${p.charge}%`; $('core-button').classList.toggle('ready', p.charge >= 100 || p.coreTime > 0);
    $('aim-mode').textContent = pointer.held ? 'РУЧНОЕ НАВЕДЕНИЕ' : 'АВТОЗАХВАТ'; $('biome').textContent = renderer.biome || D.biomes[0].name;
    const event = game.events.at(-1); $('radio-message').textContent = event?.text || ''; $('radio-message').style.opacity = event && game.time - event.time < 8 ? '1' : '.35';
    const boss = game.enemies.find(e => e.boss && !e.dead); $('boss-hud').hidden = !boss;
    if (boss) { $('boss-fill').style.width = `${boss.hp / boss.maxHp * 100}%`; $('boss-name').textContent = `${boss.name} / ${Math.ceil(boss.hp)}`; }
    const signature = p.weapons.map(w => `${w.id}:${w.level}`).join(',');
    if (signature !== moduleKey) {
      moduleKey = signature;
      $('modules').innerHTML = p.weapons.map(w => { const s = D.weapons[w.id]; return `<div class="module-slot" style="--module-color:${s.color}" title="${s.label} · уровень ${w.level}"><span>${s.glyph}</span><b>${w.level >= 6 ? 'VI' : w.level}</b><small>${w.level >= 6 ? combat.evolutions[w.id].name : s.name}</small></div>`; }).join('') + '<div class="module-slot empty"><span>+</span></div>'.repeat(4 - p.weapons.length);
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.chassis) { settings.chassis = button.dataset.chassis; options(); save(); $('chassis-options').querySelector(`[data-chassis="${settings.chassis}"]`).focus(); }
    if (button.dataset.core) { settings.core = button.dataset.core; options(); save(); $('core-options').querySelector(`[data-core="${settings.core}"]`).focus(); }
    if (button.dataset.choice !== undefined) pick(Number(button.dataset.choice));
    if (button.dataset.buy) garageTransaction(next => E.purchase(next, button.dataset.buy), 'Деталь куплена. Установи её в мастерской.', market);
    if (button.dataset.equip) garageTransaction(next => E.equip(next, settings.chassis, button.dataset.slot, button.dataset.equip), 'Деталь установлена. Внешний вид и характеристики обновлены.', workshop);
    if (button.dataset.remove) garageTransaction(next => E.equip(next, settings.chassis, button.dataset.remove, null), 'Возвращена штатная система. Купленная деталь осталась на складе.', workshop);
    if (button.dataset.filter) { marketFilter = button.dataset.filter; market(); }
    const action = button.dataset.action;
    if (action === 'market') market();
    if (action === 'workshop') workshop();
    if (action === 'close-garage') closeDialog();
    if (action === 'bounty-loss') dialog('bounty-loss', 'ВЫЙТИ БЕЗ СОХРАНЕНИЯ?', 'НАГРАДА МОЖЕТ БЫТЬ ПОТЕРЯНА', `<p class="dialog-lead">Не сохранено: ${number(game.bountyTotal - game.bountyPaid)} AC. Можно остаться и дождаться восстановления хранилища либо отказаться только от этой суммы. Уже зачисленные кредиты и покупки не удаляются.</p><div class="dialog-actions"><button class="primary" data-action="keep-bounty">ОСТАТЬСЯ</button><button class="secondary danger" data-action="forfeit-bounty">ОТКАЗАТЬСЯ И ВЫЙТИ</button></div>`);
    if (action === 'keep-bounty') deathDialog();
    if (action === 'forfeit-bounty') { game.bountyPaid = game.bountyTotal; returnHangar(); }
    if (action === 'reroll' && combat.reroll(game)) upgradeDialog();
    if (action === 'resume') { game.pause(); closeDialog(); lastStatus = game.status; }
    if (action === 'help') help();
    if (action === 'close-help') { if (game?.status === 'paused') pauseDialog(); else closeDialog(); }
    if (action === 'sound') { settings.sound = !settings.sound; options(); save(); audio.unlock(); pauseDialog(); }
    if (action === 'abandon') dialog('confirm', 'ПРЕРВАТЬ ОПЕРАЦИЮ?', 'УЛУЧШЕНИЯ ЗАБЕГА БУДУТ ПОТЕРЯНЫ', '<p class="dialog-lead">Результат и bounty будут записаны. Купленные детали останутся. Продолжить этот вылет уже нельзя.</p><div class="dialog-actions"><button class="secondary" data-action="cancel-abandon">ОСТАТЬСЯ</button><button class="secondary danger" data-action="confirm-abandon">ПРЕРВАТЬ</button></div>');
    if (action === 'cancel-abandon') pauseDialog();
    if (action === 'confirm-abandon') { game.abandoned = true; game.status = 'dead'; }
    if (action === 'restart') deploy();
    if (action === 'hangar') returnHangar();
  });
  $('deploy').onclick = deploy; $('help').onclick = help;
  $('workshop').onclick = workshop; $('market').onclick = market;
  $('sound-setting').onclick = () => { settings.sound = !settings.sound; options(); save(); audio.unlock(); };
  $('effects-setting').onclick = () => { settings.reducedEffects = !settings.reducedEffects; options(); save(); };
  $('pause').onclick = () => { if (game?.status === 'playing') { resetInput(); game.pause(); } };
  $('dash-button').onclick = () => { dashPressed = true; };
  $('core-button').onclick = () => { corePressed = true; };
  document.addEventListener('keydown', event => {
    if (!$('modal').hidden && event.code === 'Tab') {
      const controls = [...$('dialog-body').querySelectorAll('button:not(:disabled),a')];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('dialog-title'))) { last.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
      return;
    }
    if (event.repeat) return;
    if (game?.status === 'upgrade' && /^Digit[123]$/.test(event.code)) { pick(Number(event.code.at(-1)) - 1); return; }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (['workshop', 'market'].includes(dialogMode)) closeDialog();
      else if (dialogMode === 'help') { if (game?.status === 'paused') pauseDialog(); else closeDialog(); }
      else if (dialogMode === 'confirm') pauseDialog();
      else if (dialogMode === 'bounty-loss') deathDialog();
      else if (game && ['playing', 'paused'].includes(game.status)) { game.pause(); resetInput(); if (game.status === 'playing') closeDialog(); }
      event.preventDefault(); return;
    }
    if (!game || game.status !== 'playing') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (['ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) dashPressed = true;
    if (event.code === 'KeyQ') corePressed = true;
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  $('world').addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
  $('world').addEventListener('pointerdown', e => { if (e.button !== 0 || game?.status !== 'playing') return; pointer.x = e.clientX; pointer.y = e.clientY; pointer.held = true; pointer.id = e.pointerId; $('world').setPointerCapture(e.pointerId); });
  const release = e => { if (e.pointerId === pointer.id) { pointer.held = false; pointer.id = null; } if (e.pointerId === touch.id) { touch.x = touch.y = 0; touch.id = null; $('stick').style.transform = ''; } };
  window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
  function stickMove(e) { if (touch.id !== e.pointerId) return; const rect = $('joystick').getBoundingClientRect(); let dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2; const length = Math.hypot(dx, dy); if (length > 38) { dx *= 38 / length; dy *= 38 / length; } touch.x = dx / 38; touch.y = dy / 38; $('stick').style.transform = `translate(${dx}px,${dy}px)`; }
  $('joystick').addEventListener('pointerdown', e => { if (game?.status !== 'playing') return; touch.id = e.pointerId; $('joystick').setPointerCapture(e.pointerId); stickMove(e); });
  $('joystick').addEventListener('pointermove', stickMove);
  function backgroundPause() { resetInput(); if (game?.status === 'playing') game.pause(); bank(); accumulated = 0; }
  window.addEventListener('pagehide', bank);
  window.addEventListener('blur', backgroundPause); document.addEventListener('visibilitychange', () => { if (document.hidden) backgroundPause(); });
  window.addEventListener('resize', () => renderer.resize());
  function frame(stamp) {
    const delta = Math.min(.15, Math.max(0, (stamp - lastFrame) / 1000)); lastFrame = stamp;
    if (game) {
      bankingClock += delta; if (bankingClock >= 1) { bank(); bankingClock = 0; }
      accumulated += delta;
      while (accumulated >= 1 / 60) {
        const p = game.player, aim = renderer.screenToWorld(pointer.x, pointer.y), beforeDash = p.dashCooldown, beforeCore = p.coreTime;
        game.step(1 / 60, { x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touch.x,
          y: (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + touch.y,
          dash: dashPressed, core: corePressed, aim: pointer.held, angle: Math.atan2(aim.y - p.y, aim.x - p.x) });
        if (p.dashCooldown > beforeDash) audio.tone('dash'); if (p.coreTime > beforeCore) audio.tone('core');
        dashPressed = corePressed = false; accumulated -= 1 / 60;
      }
      if ((game.shotSerial || 0) !== shotSerial) { shotSerial = game.shotSerial || 0; audio.tone('shot'); }
      if (game.player.hp + game.player.shield < lastHp) audio.tone('hit'); lastHp = game.player.hp + game.player.shield;
      if (lastStatus !== game.status) {
        lastStatus = game.status;
        if (game.status === 'upgrade') { audio.tone('upgrade'); upgradeDialog(); }
        else if (game.status === 'paused') pauseDialog(); else if (game.status === 'dead') deathDialog();
      }
      renderer.draw(game); hudClock += delta; if (hudClock > .1) { updateHud(); hudClock = 0; }
    } else {
      previewTime += delta;
      if (!document.hidden) {
        const loadout = E.build(settings, settings.chassis).loadout;
        sprites.preview($('mech-preview'), settings.chassis, previewTime, settings.reducedEffects, loadout);
        if (dialogMode === 'workshop') sprites.preview($('assembly-preview'), settings.chassis, previewTime, settings.reducedEffects, loadout);
      }
    }
    requestAnimationFrame(frame);
  }
  options(); requestAnimationFrame(frame);
  sprites.load((done, total) => { $('asset-status').textContent = `Спрайты загружены: ${done} / ${total}`; }).then(() => {
    $('deploy').disabled = false; $('deploy').innerHTML = 'НАЧАТЬ ВЫСАДКУ <span>↗</span>'; $('asset-status').textContent = 'Системы готовы. Возвращение не гарантируется.';
  }).catch(error => { $('asset-status').textContent = `Не удалось загрузить ${error.message}. Перезагрузи страницу.`; $('deploy').textContent = 'ГРАФИКА НЕДОСТУПНА'; });
})();
