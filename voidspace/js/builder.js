(function () {
  "use strict";
  const VS = window.Voidspace, { MODULES, assemblyCells, calculateStats } = VS.ModuleSystem;
  const families = [
    { name: "Угловая броня", types: ["corner_armor_1x1", "corner_armor_2x1", "corner_armor_1x2", "corner_armor_3x1", "corner_armor_1x3"] },
    { name: "Баллистика", types: ["light_cannon", "medium_cannon", "heavy_cannon"] },
    { name: "Ракетные установки", types: ["swarm_launcher", "ap_launcher", "he_launcher", "emp_launcher", "nuclear_launcher"] },
    { name: "Лазерные турели", types: ["laser_turret", "turbolaser"] },
    { name: "Двигатели", types: ["thruster", "booster", "scout_drive"] },
    { name: "Бронеплиты", types: ["ceramic_armor", "tungsten_armor", "corvette_armor"] },
  ];
  const symbols = { all: "◈", structure: "⬡", flight: "➤", mining: "◇", power: "ϟ", heat: "≋", weapons: "⌖", industry: "▥" };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function family(type) { return families.find(f => f.types.includes(type)) || { name: MODULES[type].name, types: [type] }; }
  function metrics(type) {
    const def = MODULES[type], cells = assemblyCells({ type, gx: 0, gy: 0, rotation: 0 });
    return { ...calculateStats(cells), cells: cells.length, width: def.footprint?.width || 1, height: def.footprint?.height || 1,
      heatCapacity: cells.reduce((sum, c) => sum + MODULES[c.type].heatCapacity, 0) };
  }
  function groups({ category = "all", query = "", shipClass = null, unlocked = null, availableOnly = false, includeCore = false, selected = "hull" } = {}) {
    const types = Object.keys(MODULES).filter(type => !MODULES[type].internal && (includeCore || type !== "core") && (!shipClass || !MODULES[type].shipClass || MODULES[type].shipClass === shipClass)
      && (!availableOnly || !unlocked || unlocked.has(type)) && VS.Visuals.matches(type, category, query));
    const grouped = new Map();
    for (const type of types) { const f = family(type); if (!grouped.has(f.name)) grouped.set(f.name, { name: f.name, types: [] }); grouped.get(f.name).types.push(type); }
    return [...grouped.values()].map(group => ({ ...group, type: group.types.includes(selected) ? selected : group.types.find(type => !unlocked || unlocked.has(type)) || group.types[0] }));
  }
  function cards(options) {
    return groups(options).map(group => {
      const type = group.type, def = MODULES[type], size = metrics(type), locked = options.unlocked && !options.unlocked.has(type);
      return `<button class="part-tile ${group.types.includes(options.selected) ? 'selected' : ''} ${locked ? 'locked' : ''}" data-module="${type}" aria-pressed="${group.types.includes(options.selected)}" title="${escape(def.name)}${locked ? ' · Чертёж не открыт' : ''}">
        <span class="part-top"><span>${size.width}×${size.height}</span><span>${locked ? 'ЗАКРЫТО' : def.cost + ' ¤'}</span></span>
        <span class="module-sprite">${VS.Visuals.iconMarkup(def)}</span><b>${escape(group.name)}</b><span class="part-variants">${group.types.length > 1 ? group.types.length + (group.types.length < 5 ? ' варианта ›' : ' вариантов ›') : escape(VS.Visuals.CATEGORIES[VS.Visuals.category(type)])}</span></button>`;
    }).join('') || '<p class="empty-state">Ничего не найдено. Измените поиск или фильтр.</p>';
  }
  function detail(type, { shipClass = null, unlocked = null } = {}) {
    const def = MODULES[type]; if (!def) return '';
    const size = metrics(type), variants = family(type).types.filter(id => !shipClass || !MODULES[id].shipClass || MODULES[id].shipClass === shipClass);
    const locked = unlocked && !unlocked.has(type);
    const dependency = type === 'laser' ? 'Усиление: плазма-трансформатор прямо сзади.' : type === 'drill' ? 'Усиление: дополнительная энергоустановка прямо сзади.' : def.reactor ? 'Для запуска: замкнутый контур, насос, 2 турбины и 2 открытых радиатора.' : '';
    return `<div class="part-detail-head"><span class="module-sprite">${VS.Visuals.iconMarkup(def)}</span><div><span class="eyebrow">${escape(VS.Visuals.CATEGORIES[VS.Visuals.category(type)])}</span><h3>${escape(def.name)}</h3></div></div>
      ${variants.length > 1 ? `<div class="part-variant-list" aria-label="Варианты блока">${variants.map(id => `<button data-module="${id}" aria-pressed="${id === type}" title="${escape(MODULES[id].name)}">${VS.Visuals.iconMarkup(MODULES[id])}<span>${id.startsWith('corner_armor') ? MODULES[id].footprint.width + '×' + MODULES[id].footprint.height : escape(MODULES[id].name)}</span></button>`).join('')}</div>` : ''}
      <div class="part-metrics"><span>Размер<b>${size.width}×${size.height}</b></span><span>Корпус<b>${size.maxHp}</b></span><span>Цена<b>${def.cost} ¤</b></span></div>
      <p>${escape(def.description)}</p>${VS.EngineeringData.consumption(def) !== def.description ? `<div class="part-resource">${escape(VS.EngineeringData.consumption(def))}</div>` : ''}
      ${dependency ? `<p class="part-advice">${dependency}</p>` : ''}
      ${def.reservedZone ? `<p class="part-advice">↔ ${def.reservedZone.length} свободных кл. ${def.reservedZone.direction === 'rear' ? 'позади: выхлоп' : 'впереди: рабочая зона'}</p>` : ''}
      ${locked ? `<p class="part-locked">Откройте чертёж на станции · ${def.unlock} ¤</p>` : '<span class="part-ready">● Готов к установке</span>'}`;
  }
  class History {
    constructor(limit = 30) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
    record(value) { this.undoStack.push(JSON.stringify(value)); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = []; }
    travel(value, redo = false) {
      const from = redo ? this.redoStack : this.undoStack, to = redo ? this.undoStack : this.redoStack;
      if (!from.length) return null;
      to.push(JSON.stringify(value)); return JSON.parse(from.pop());
    }
  }
  VS.Builder = { family, metrics, groups, cards, detail, symbols, History };
})();
