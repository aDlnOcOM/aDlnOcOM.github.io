/* Energy is conserved between loaded magazines, reserves and refill batteries. */
(() => {
  'use strict';
  function create(capacity, fastFeed = false) {
    const variant = capacity >= 52 ? 'барабанный' : capacity > 32 ? 'увеличенный' : fastFeed ? 'быстрой подачи' : 'штатный';
    return { loaded: 0, magazines: Array.from({ length: 3 }, (_, id) => ({ id, capacity, energy: capacity, variant })), battery: 150 };
  }
  function fire(stock) {
    const magazine = stock.magazines[stock.loaded];
    if (magazine.energy < 1) return false;
    magazine.energy--; return true;
  }
  function refill(stock, id) {
    const magazine = stock.magazines.find(item => item.id === id);
    if (!magazine) return 0;
    const amount = Math.min(magazine.capacity - magazine.energy, stock.battery);
    magazine.energy += amount; stock.battery -= amount; return amount;
  }
  function reload(stock) {
    const current = stock.magazines[stock.loaded];
    const next = stock.magazines.reduce((best, item) => item.energy > best.energy ? item : best, current);
    if (next.id !== current.id) stock.loaded = next.id;
    else refill(stock, current.id);
    return stock.magazines[stock.loaded].energy;
  }
  function canReload(stock) {
    const current = stock.magazines[stock.loaded];
    return current.energy < current.capacity && (stock.battery > 0 || stock.magazines.some(item => item.energy > current.energy));
  }
  function render(container, stock, onRefill) {
    container.replaceChildren();
    stock.magazines.forEach(magazine => {
      const cell = document.createElement('article');
      cell.className = 'supply-cell magazine-cell';
      cell.innerHTML = `<span class="supply-icon" aria-hidden="true">▥</span><small>${magazine.id === stock.loaded ? 'В ОРУЖИИ' : 'РЕЗЕРВ'} / ${magazine.variant}</small><h4>Аккумуляторный магазин пониженного напряжения</h4><strong>${magazine.energy} <span>/ ${magazine.capacity} ед.</span></strong><meter min="0" max="${magazine.capacity}" value="${magazine.energy}">${magazine.energy}</meter>`;
      if (onRefill) {
        const button = document.createElement('button');
        button.className = 'quiet-button'; button.textContent = 'Пополнить из Мк I';
        button.disabled = !stock.battery || magazine.energy === magazine.capacity;
        button.onclick = () => onRefill(magazine.id);
        cell.appendChild(button);
      }
      container.appendChild(cell);
    });
    const battery = document.createElement('article'); battery.className = 'supply-cell battery-cell';
    battery.innerHTML = `<span class="supply-icon" aria-hidden="true">▰</span><small>ИСТОЧНИК ЭНЕРГИИ / Мк I</small><h4>Оружейный аккумулятор Мк I</h4><strong>${stock.battery} <span>/ 150 ед.</span></strong><p>Пополняет магазины пониженного напряжения.</p>`;
    container.appendChild(battery);
    for (let i = 0; i < 4; i++) {
      const empty = document.createElement('div'); empty.className = 'supply-empty';
      empty.setAttribute('aria-hidden', 'true'); empty.textContent = '+'; container.appendChild(empty);
    }
  }
  function show(stock, items, onRefill, onClose) {
    const dialog = document.createElement('dialog'); dialog.className = 'field-inventory';
    dialog.setAttribute('aria-label', 'Экипировка и запасы энергии');
    const opener = document.activeElement;
    dialog.innerHTML = '<header><div><p class="eyebrow">ПОЛЕВОЙ КОМПЛЕКТ / ПАУЗА</p><h2>Экипировка и инвентарь</h2></div><button class="quiet-button" data-close>Закрыть ×</button></header><div class="inventory-layout"><section><h3>Экипировка</h3><div class="field-slots"></div></section><section><h3>Запасы энергии</h3><div class="supply-grid"></div><p class="section-note">R — сменить магазин; если более заряженных нет — пополнить из Мк I. 1 выстрел = 1 ед. энергии.</p></section></div>';
    const slots = dialog.querySelector('.field-slots');
    items.forEach(item => { const slot = document.createElement('div'); slot.className = 'field-slot'; slot.dataset.gear = item.id;
      slot.innerHTML = `<small>${item.slot}</small><strong>${item.name}</strong>`; slots.appendChild(slot); });
    const draw = () => render(dialog.querySelector('.supply-grid'), stock, id => { onRefill(id); draw(); });
    draw(); dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.onclose = () => { dialog.remove(); onClose(); if (opener?.isConnected) opener.focus(); };
    document.body.appendChild(dialog); dialog.showModal();
  }
  window.PowerInventory = { create, fire, refill, reload, canReload, render, show };
})();
