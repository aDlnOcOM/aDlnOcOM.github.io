/* Equipment catalogue and accessible workshop. Existing branch IDs stay stable. */
(() => {
  "use strict";
  const profiles = {
    smg: { color: "#64e4dc", code: "01 / BALLISTICS", subtitle: "Баллистика и управление огнём", mark: "⌖" },
    knife: { color: "#ff8e7e", code: "02 / CLOSE CONTACT", subtitle: "Кинетика ближнего контакта", mark: "╱" },
    bag: { color: "#dfc17c", code: "03 / RECOVERY", subtitle: "Сбор и сохранение ресурсов", mark: "▤" },
    chest: { color: "#97b9ff", code: "04 / SURVIVAL", subtitle: "Защитная оболочка", mark: "◇" },
    pants: { color: "#b7cf80", code: "05 / MOBILITY", subtitle: "Подвижность и выживание", mark: "⋈" },
    helmet: { color: "#c6a3f6", code: "06 / OPTICS", subtitle: "Оптика и нейрозащита", mark: "◎" },
    boots: { color: "#efa768", code: "07 / LOCOMOTION", subtitle: "Сцепление и темп движения", mark: "⇢" }
  };
  // Each tuple contains a stat that the combat engine actually consumes.
  const additions = {
    knife: [
      ["balance", "Баланс клинка", ["Противовес", "Точный противовес", "knifeDamage", 5, 7], ["Лёгкий хвостовик", "Полый хвостовик", "knifeDelay", -.025, -.025]],
      ["handle", "Основа рукояти", ["Амортизатор", "Мягкий контакт", "armor", 1, 1], ["Хват беглеца", "Контактный привод", "speed", 7, 9]]
    ],
    bag: [
      ["frame", "Каркас сумки", ["Складная рама", "Раздвижная рама", "salvageMultiplier", .05, .07], ["Ремень эвакуации", "Двойная страховка", "deathRetention", .03, .04]],
      ["harness", "Подвес сумки", ["Разгрузочная стропа", "Быстрый подвес", "speed", 6, 8], ["Защитная спинка", "Композитная спинка", "armor", 1, 1]]
    ],
    chest: [
      ["lining", "Внутренний слой", ["Термоподкладка", "Термобарьер", "maxHealth", 8, 12], ["Волоконный пакет", "Кевларовый пакет", "armor", 1, 2]],
      ["joints", "Шарнирный узел", ["Скользящий шарнир", "Сервошарнир", "speed", 6, 8], ["Демпфер удара", "Инерционный демпфер", "invulnerability", .02, .03]]
    ],
    pants: [
      ["weave", "Переплетение ткани", ["Арамидная нить", "Арамидная сетка", "armor", 1, 1], ["Эластичные вставки", "Активное волокно", "speed", 6, 8]],
      ["support", "Опорный пояс", ["Медицинский пояс", "Стабилизатор корпуса", "maxHealth", 7, 10], ["Мягкая опора", "Инерционная опора", "invulnerability", .02, .03]]
    ],
    helmet: [
      ["lens", "Оптический блок", ["Фокусирующая линза", "Дальнобойная линза", "flashlightRange", 24, 36], ["Матовый рассеиватель", "Призматический блок", "flashlightAngle", 2, 3]],
      ["shell", "Корпус шлема", ["Титановая вставка", "Титановый обод", "armor", 1, 1], ["Нейропрокладка", "Нейроизоляция", "maxHealth", 6, 10]]
    ],
    boots: [
      ["tread", "Протектор", ["Цепкая резина", "Когтевой протектор", "speed", 8, 10], ["Жёсткий носок", "Композитный носок", "armor", 1, 1]],
      ["ankle", "Голеностоп", ["Ортез", "Активный ортез", "maxHealth", 7, 10], ["Гаситель отдачи", "Гидрогаситель", "invulnerability", .02, .03]]
    ]
  };
  const labels = { maxHealth: "целостность", armor: "броня", speed: "скорость", knifeDamage: "урон ножа", knifeDelay: "задержка ножа, с", invulnerability: "неуязвимость, с", salvageMultiplier: "добыча лома", deathRetention: "сохранение лома", flashlightRange: "дальность фонаря", flashlightAngle: "угол фонаря, °" };
  function effect(stat, value) {
    const percent = stat === "salvageMultiplier" || stat === "deathRetention";
    const amount = Number((percent ? value * 100 : value).toFixed(3));
    return `${amount > 0 ? "+" : ""}${amount}${percent ? " п.п." : ""} · ${labels[stat]}`;
  }
  function extend(trees) {
    for (const [gear, branches] of Object.entries(additions)) {
      for (const [id, base, ...choices] of branches) {
        trees[gear].branches.push({ id, base, options: choices.map(([name, tierName, stat, value, tierValue], index) => ({
          id: `${id}-${index}`, name, cost: 32 + index * 5, effect: effect(stat, value), bonus: { [stat]: value },
          tier: { name: tierName, cost: 52 + index * 7, effect: effect(stat, tierValue), bonus: { [stat]: tierValue } }
        })) });
      }
    }
  }
  function applyBonuses(stats, equipment, trees) {
    for (const [gear, tree] of Object.entries(trees)) {
      for (const branch of tree.branches) {
        const progress = equipment[gear]?.[branch.id];
        const option = branch.options.find(item => item.id === progress?.choice);
        if (!option) continue;
        for (const bonus of [option.bonus, progress.tier ? option.tier.bonus : null]) {
          for (const [stat, value] of Object.entries(bonus || {})) stats[stat] += value;
        }
      }
    }
    stats.deathRetention = Math.min(.95, stats.deathRetention);
    stats.knifeDelay = Math.max(.1, stats.knifeDelay);
    return stats;
  }
  let dialog;
  let selection = null;
  let opener;
  let zoom = 1;
  function bindPan(viewport) {
    let pointer = null;
    let suppressClick = false;
    viewport.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.pointerType !== "mouse") return;
      const rect = viewport.getBoundingClientRect();
      // Leave native scrollbar dragging alone.
      if (event.clientX >= rect.left + viewport.clientWidth || event.clientY >= rect.top + viewport.clientHeight) return;
      suppressClick = false;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
        left: viewport.scrollLeft, top: viewport.scrollTop, dragging: false };
    });
    viewport.addEventListener("pointermove", event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (!(event.buttons & 1)) { finish(event); return; }
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.dragging && Math.hypot(dx, dy) < 5) return;
      if (!pointer.dragging) {
        pointer.dragging = true;
        suppressClick = true;
        viewport.setPointerCapture(pointer.id);
        viewport.classList.add("is-panning");
      }
      event.preventDefault();
      viewport.scrollLeft = pointer.left - dx;
      viewport.scrollTop = pointer.top - dy;
    });
    function finish(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      const id = pointer.id;
      pointer = null;
      viewport.classList.remove("is-panning");
      if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) viewport.addEventListener(type, finish);
    viewport.addEventListener("pointerleave", event => { if (!pointer?.dragging) finish(event); });
    viewport.addEventListener("click", event => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    viewport.addEventListener("dragstart", event => event.preventDefault());
  }
  function close() { dialog?.close(); }
  function show(api) {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "gear-window";
      dialog.setAttribute("aria-labelledby", "gear-window-title");
      document.body.appendChild(dialog);
    }
    const opening = !dialog.open;
    const sameGear = !opening && dialog.dataset.gear === api.selected;
    const oldViewport = dialog.querySelector(".gear-viewport");
    const scroll = sameGear && oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    dialog.onclose = () => { api.close(); document.body.classList.remove("gear-window-open"); if (opener?.isConnected) opener.focus(); else document.getElementById("open-equipment").focus(); };
    if (opening) { opener = document.activeElement; selection = null; zoom = 1; }
    const gearId = api.selected;
    const profile = profiles[gearId];
    const item = api.items.find(entry => entry.id === gearId);
    const tree = api.trees[gearId];
    dialog.style.setProperty("--gear-accent", profile.color);
    dialog.dataset.gear = gearId;
    dialog.innerHTML = `<header class="gear-header"><div><p class="eyebrow">УБЕЖИЩЕ 41 / НЕЗАВИСИМЫЙ АРСЕНАЛ</p><h2 id="gear-window-title">Экипировка</h2></div><div class="gear-wallet" aria-live="polite">ЛОМ <strong>${api.salvage}</strong></div><button class="quiet-button" data-close aria-label="Закрыть окно экипировки">Закрыть ×</button></header><div class="gear-layout"><nav class="gear-slots" aria-label="Слоты экипировки"></nav><section class="gear-main"><div class="gear-caption"><div><p class="eyebrow">${profile.code}</p><h3>${item.name}</h3><p>${profile.subtitle}</p></div><div class="gear-zoom"><button aria-label="Уменьшить дерево" data-zoom="-1">−</button><button aria-label="Сбросить масштаб" data-zoom="0">100%</button><button aria-label="Увеличить дерево" data-zoom="1">+</button></div></div><p class="gear-legend">● Установлено <span>◇ Доступно</span> <span>· Нужен предок</span> <span>× Другая специализация</span></p><div class="gear-viewport" tabindex="0" aria-label="Дерево улучшений: прокрутка по горизонтали и вертикали"><div class="gear-graph"><div class="gear-origin">${profile.mark}<strong>${item.slot}</strong><small>Базовая платформа</small></div><div class="gear-branches"></div></div></div></section><aside class="gear-details" aria-live="polite"></aside></div>`;
    dialog.querySelector("[data-close]").onclick = close;
    const nav = dialog.querySelector(".gear-slots");
    for (const slot of api.items) {
      const button = document.createElement("button");
      button.className = "gear-slot";
      button.setAttribute("aria-current", String(slot.id === gearId));
      button.innerHTML = `<span>${profiles[slot.id].mark}</span><div><small>${slot.slot}</small><strong>${slot.name}</strong></div>`;
      button.onclick = () => { selection = null; zoom = 1; api.select(slot.id); };
      nav.appendChild(button);
    }
    const branches = dialog.querySelector(".gear-branches");
    const allNodes = [];
    for (const branch of tree.branches) {
      const progress = api.progress[gearId][branch.id];
      const lane = document.createElement("section");
      lane.className = "gear-lane";
      lane.style.width = `${branch.options.length * 158}px`;
      lane.innerHTML = `<div class="gear-base">${branch.base}</div><div class="gear-paths"></div>`;
      lane.querySelector('.gear-paths').style.gridTemplateColumns = `repeat(${branch.options.length}, 1fr)`;
      for (const option of branch.options) {
        const path = document.createElement("div");
        path.className = "gear-path";
        const blocked = Boolean(progress.choice && progress.choice !== option.id);
        for (const tier of [false, true]) {
          const data = tier ? option.tier : option;
          const installed = progress.choice === option.id && (!tier || progress.tier);
          const needsParent = tier && progress.choice !== option.id;
          const status = installed ? "Установлено" : blocked ? "Другая специализация" : needsParent ? `Нужно: ${option.name}` : api.salvage < data.cost ? "Недостаточно лома" : "Доступно";
          const id = `${gearId}/${branch.id}/${option.id}/${tier}`;
          const node = { id, branch, option, tier, data, installed, blocked, needsParent, status };
          allNodes.push(node);
          const button = document.createElement("button");
          button.className = `gear-node ${installed ? "installed" : blocked ? "excluded" : needsParent ? "locked" : "available"}`;
          button.setAttribute("aria-label", `${data.name}. ${data.effect}. ${status}. ${data.cost} лома`);
          button.dataset.node = id;
          button.innerHTML = `<small>${installed ? "●" : blocked ? "×" : needsParent ? "·" : "◇"} ${tier ? "III" : "II"}</small><strong>${data.name}</strong><em>${data.effect}</em><small>${installed ? "УСТАНОВЛЕНО" : `${data.cost} ЛОМА`}</small>`;
          button.onclick = () => { selection = id; details(node); };
          path.appendChild(button);
        }
        lane.querySelector(".gear-paths").appendChild(path);
      }
      branches.appendChild(lane);
    }
    function details(node) {
      const panel = dialog.querySelector(".gear-details");
      dialog.querySelectorAll(".gear-node").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.node === node.id)));
      panel.innerHTML = `<p class="eyebrow">СХЕМА / ${node.tier ? "III" : "II"} СЛОЙ</p><h3>${node.data.name}</h3><p class="gear-effect">${node.data.effect}</p><dl><dt>Предшественник</dt><dd>${node.tier ? node.option.name : node.branch.base}</dd><dt>Состояние</dt><dd>${node.status}</dd><dt>Цена</dt><dd>${node.data.cost} лома</dd></dl><p class="gear-warning">${node.tier ? "Усиливает выбранную специализацию." : "Выбор необратим: соседняя специализация этой ветви будет закрыта."}</p><button class="primary-button" data-install>Установить модуль</button><p class="gear-feedback" role="status"></p>`;
      const install = panel.querySelector("[data-install]");
      install.disabled = node.installed || node.blocked || node.needsParent || api.salvage < node.data.cost;
      install.onclick = () => {
        api.buy(node.branch, node.option, node.tier);
        const installedButton = [...dialog.querySelectorAll(".gear-node")].find(button => button.dataset.node === node.id);
        installedButton?.focus();
      };
    }
    const chosen = allNodes.find(node => node.id === selection) || allNodes.find(node => !node.installed && !node.blocked && !node.needsParent) || allNodes[0];
    if (chosen) details(chosen);
    function resize() {
      dialog.querySelector(".gear-graph").style.zoom = zoom;
      dialog.querySelector('[data-zoom="0"]').textContent = `${Math.round(zoom * 100)}%`;
    }
    dialog.querySelectorAll("[data-zoom]").forEach(button => { button.onclick = () => { zoom = Number(button.dataset.zoom) === 0 ? 1 : Math.max(.5, Math.min(1.5, zoom + Number(button.dataset.zoom) * .1)); resize(); }; });
    resize();
    if (opening) { dialog.showModal(); document.body.classList.add("gear-window-open"); }
    const viewport = dialog.querySelector(".gear-viewport");
    bindPan(viewport);
    viewport.title = "Зажмите левую кнопку мыши и перемещайте дерево";
    viewport.scrollLeft = sameGear ? scroll[0] : Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = scroll[1];
    if (!opening && !sameGear) dialog.querySelector('.gear-slot[aria-current="true"]').focus();
  }
  window.EquipmentWorkbench = { extend, applyBonuses, show };
})();
