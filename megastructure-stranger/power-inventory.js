/* Energy is conserved between loaded magazines, reserves and refill batteries. */
(() => {
  'use strict';
  const supplies = {
    energy: { magazine: 'Аккумуляторный магазин пониженного напряжения', box: 'Оружейный аккумулятор Мк I', capacity: 150, code: 'НН' },
    ballistic: { magazine: 'Магазин баллистического конвертера', box: 'Коробка баллистических патронов', capacity: 120, code: 'БЛ' },
    elemental: { magazine: 'Термокапсульный магазин', box: 'Контейнер элементальных капсул', capacity: 90, code: 'ЭЛ' },
    mechanical: { magazine: 'Кассета механических микродротиков', box: 'Коробка микродротиков', capacity: 60, code: 'МХ' }
  };
  function create(capacity, fastFeed = false, type = 'energy') {
    if (!supplies[type]) type = 'energy';
    const variant = capacity >= 52 ? 'барабанный' : capacity > 32 ? 'увеличенный' : fastFeed ? 'быстрой подачи' : 'штатный';
    return { type, loaded: 0, magazines: Array.from({ length: 3 }, (_, id) => ({ id, type, capacity, energy: capacity, variant })), battery: supplies[type].capacity };
  }
  function supplyFor(key) {
    if (key.includes(':') && window.Arsenal) {
      const [family, type] = key.split(':');
      const profile = window.Arsenal.families.find(item => item.id === family);
      if (profile) return { ...supplies[type], code: profile.caliber, box: 'Боезапас ' + profile.caliber + ' / ' + type };
    }
    return supplies[key] || supplies.energy;
  }
  function fire(stock) {
    const magazine = stock.magazines[stock.loaded];
    if (stock.ammoKey && magazine.ammoKey !== stock.ammoKey) return false;
    if ((magazine.type || 'energy') !== (stock.type || 'energy')) return false;
    if (magazine.energy < 1) return false;
    magazine.energy--; return true;
  }
  function startRefill(stock, id) {
    if (stock.refilling) return false;
    const magazine = stock.magazines.find(item => item.id === id);
    if (!magazine) return false;
    if (stock.ammoKey && magazine.ammoKey !== stock.ammoKey) return false;
    if ((magazine.type || 'energy') !== (stock.type || 'energy')) return false;
    const amount = Math.min(magazine.capacity - magazine.energy, stock.battery);
    if (amount <= 0) return false;
    stock.refilling = { id, amount, transferred: 0, elapsed: 0, duration: Math.max(10, amount / 3.2) };
    return true;
  }
  function tickRefill(stock, delta) {
    const job = stock.refilling;
    if (!job || !Number.isFinite(delta) || delta <= 0) return;
    job.elapsed = Math.min(job.duration, job.elapsed + delta);
    const magazine = stock.magazines.find(item => item.id === job.id);
    const due = Math.min(job.amount, Math.floor(job.elapsed / job.duration * job.amount + 1e-8));
    const amount = Math.min(due - job.transferred, stock.battery, magazine.capacity - magazine.energy);
    magazine.energy += amount; stock.battery -= amount; job.transferred += amount;
    if (job.elapsed >= job.duration || stock.battery <= 0 || magazine.energy >= magazine.capacity) stock.refilling = null;
  }
  function cancelRefill(stock) {
    stock.refilling = null;
  }
  function reload(stock) {
    const current = stock.magazines[stock.loaded];
    const next = stock.magazines.reduce((best, item) => (!stock.ammoKey || item.ammoKey === stock.ammoKey) && (item.type || 'energy') === (stock.type || 'energy') && item.energy > best.energy ? item : best, current);
    if (next.id !== current.id) stock.loaded = next.id;
    return stock.magazines[stock.loaded].energy;
  }
  function canReload(stock) {
    const current = stock.magazines[stock.loaded];
    return current.energy < current.capacity && (stock.battery > 0 || stock.magazines.some(item => (!stock.ammoKey || item.ammoKey === stock.ammoKey) && (item.type || 'energy') === (stock.type || 'energy') && item.energy > current.energy));
  }
  function render(container, stock, onRefill) {
    const info = stock.supply || supplies[stock.type] || supplies.energy;
    container.replaceChildren();
    container.classList.add('container-inventory');
    const details = document.createElement('section');
    details.className = 'item-inspector';
    details.setAttribute('aria-live', 'polite');
    details.textContent = 'Выберите предмет для осмотра.';
    function section(name, columns, rows) {
      const wrapper = document.createElement('section'); wrapper.className = 'inventory-container';
      const heading = document.createElement('h4'); heading.textContent = name;
      const grid = document.createElement('div'); grid.className = 'tactical-grid';
      grid.style.setProperty('--cols', columns); grid.style.setProperty('--rows', rows);
      wrapper.append(heading, grid); container.appendChild(wrapper);
      return grid;
    }
    const weapon = section('В ОРУЖИИ / ' + (stock.weaponName || 'ПП ОХРАНЫ'), 4, 2);
    const rig = section('МАГАЗИННЫЕ ПОДСУМКИ / БЫСТРЫЙ ДОСТУП', 6, 2);
    const pockets = section('КАРМАНЫ / 4 ЯЧЕЙКИ', 4, 1);
    const extras = Object.entries(stock.extraSupplies || {}).filter(([, amount]) => amount > 0);
    const backpack = section('СУМКА / ЗАПАСЫ', 6, extras.length > 2 ? 4 : 3);
    for (let i = 0; i < 4; i++) {
      const empty = document.createElement('span'); empty.className = 'pocket-empty'; empty.setAttribute('aria-hidden', 'true'); pockets.appendChild(empty);
    }
    function inspect(magazine) {
      const battery = !magazine;
      details.innerHTML = battery
        ? '<small>ЗАПАС БОЕПРИПАСОВ</small><h4>' + info.box + '</h4><p>Всего ' + stock.battery + ' ед. · Ёмкость упаковки ' + info.capacity + ' · Совместимость: ' + info.code + '</p>'
        : '<small>МАГАЗИН / ' + magazine.variant + '</small><h4>' + info.magazine + '</h4><p>' + magazine.energy + ' / ' + magazine.capacity + ' ед. · ' + (magazine.id === stock.loaded ? 'Установлен в оружии' : 'Запасной в подсумке') + '</p>';
      if (magazine && onRefill) {
        const button = document.createElement('button'); button.className = 'quiet-button'; button.textContent = 'Пополнить из Мк I';
        button.disabled = Boolean(stock.refilling) || !stock.battery || magazine.energy === magazine.capacity;
        button.textContent = 'Пополнить · ' + Math.max(10, Math.min(magazine.capacity - magazine.energy, stock.battery) / 3.2).toFixed(1) + ' с';
        button.onclick = () => onRefill(magazine.id);
        details.appendChild(button);
      }
    }
    stock.magazines.forEach(magazine => {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'tactical-item energy-mag';
      cell.style.gridColumn = magazine.id === stock.loaded ? '1 / span 1' : 'auto / span 1';
      cell.style.gridRow = '1 / span 2';
      cell.setAttribute('aria-label', info.magazine + ': ' + magazine.variant + ', ' + magazine.energy + ' из ' + magazine.capacity);
      cell.title = info.magazine + ' / ' + magazine.variant;
      cell.dataset.ammoType = stock.type || 'energy';
      cell.innerHTML = '<small>' + info.code + '-' + magazine.capacity + '</small><span class="mag-drawing" aria-hidden="true"></span><strong>' + magazine.energy + '/' + magazine.capacity + '</strong>';
      cell.onclick = () => { stock.inspectId = magazine.id; inspect(magazine); };
      (magazine.id === stock.loaded ? weapon : rig).appendChild(cell);
    });
    const battery = document.createElement('button'); battery.type = 'button'; battery.className = 'tactical-item energy-battery';
    battery.style.gridColumn = '1 / span 2'; battery.style.gridRow = '1 / span 2';
    battery.setAttribute('aria-label', info.box + ', всего ' + stock.battery);
    battery.dataset.ammoType = stock.type || 'energy';
    battery.title = info.box;
    battery.innerHTML = '<small>' + info.box + '</small><span class="battery-drawing" aria-hidden="true"></span><strong>' + stock.battery + ' ед.</strong>';
    battery.onclick = () => { stock.inspectId = null; inspect(null); }; backpack.appendChild(battery);
    for (const [type, amount] of extras) {
      const extraInfo = supplyFor(type);
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'tactical-item energy-battery';
      cell.dataset.ammoType = type; cell.style.gridColumn = 'auto / span 2'; cell.style.gridRow = 'auto / span 2';
      cell.innerHTML = '<small>' + extraInfo.code + ' / ЛУТ</small><span class="battery-drawing" aria-hidden="true"></span><strong>' + amount + ' ед.</strong>';
      cell.onclick = () => { details.innerHTML = '<h4>' + extraInfo.box + '</h4><p>' + amount + ' ед. Несовместимо с текущим оружием.</p>'; };
      backpack.appendChild(cell);
    }
    container.appendChild(details);
    if (stock.inspectId !== undefined) inspect(stock.magazines.find(item => item.id === stock.inspectId));
    if (stock.refilling) {
      const progress = document.createElement('p');
      progress.textContent = 'Пополнение: осталось ' + Math.max(0, stock.refilling.duration - stock.refilling.elapsed).toFixed(1) + ' с';
      const cancel = document.createElement('button'); cancel.className = 'quiet-button'; cancel.textContent = 'Прервать';
      cancel.onclick = () => { cancelRefill(stock); render(container, stock, onRefill); };
      details.append(progress, cancel);
    }
  }
  function show(stock, items, onRefill, onClose, resources) {
    const dialog = document.createElement('dialog'); dialog.className = 'field-inventory';
    dialog.setAttribute('aria-label', 'Экипировка и запасы энергии');
    const opener = document.activeElement;
    dialog.innerHTML = '<header><div><p class="eyebrow">ПОЛЕВОЙ КОМПЛЕКТ / ПАУЗА</p><h2>Экипировка и инвентарь</h2></div><button class="quiet-button" data-close>Закрыть ×</button></header><div class="inventory-layout"><section><h3>Экипировка</h3><div class="field-slots"></div></section><section><h3>Запасы энергии</h3><div class="supply-grid"></div><p class="section-note">R — сменить магазин; если более заряженных нет — пополнить из Мк I. 1 выстрел = 1 ед. энергии.</p></section></div>';
    const slots = dialog.querySelector('.field-slots');
    if(resources&&window.Resources){
      const section=document.createElement('section');section.className='field-resources';
      const title=document.createElement('h3');title.textContent='Материалы этого забега';section.appendChild(title);
      const found=Object.fromEntries(Object.entries(resources).filter(([,amount])=>amount>0));
      if(Object.keys(found).length)section.appendChild(window.Resources.costIcons(found));
      else{const empty=document.createElement('p');empty.textContent='Материалы пока не найдены.';section.appendChild(empty);}
      dialog.appendChild(section);
    }
    items.forEach(item => { const slot = document.createElement('div'); slot.className = 'field-slot'; slot.dataset.gear = item.id;
      slot.innerHTML = `<small>${item.slot}</small><strong>${item.name}</strong>`; slots.appendChild(slot); });
    const draw = () => render(dialog.querySelector('.supply-grid'), stock, id => { onRefill(id); draw(); });
    draw(); dialog.querySelector('[data-close]').onclick = () => dialog.close();
    const refreshTimer = window.setInterval(() => { if (stock.refilling || wasCharging) draw(); wasCharging = Boolean(stock.refilling); }, 250);
    let wasCharging = false;
    dialog.onclose = () => { window.clearInterval(refreshTimer); cancelRefill(stock); dialog.remove(); onClose(); if (opener?.isConnected) opener.focus(); };
    document.body.appendChild(dialog); dialog.showModal();
  }
  window.PowerInventory = { create, fire, startRefill, tickRefill, cancelRefill, reload, canReload, render, show };
})();
