(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES, reservedCellsForModule } = VS.ModuleSystem;
  const $ = (id) => document.getElementById(id);
  let modules = [{ type: "core", gx: 0, gy: 0, rotation: 0 }];
  let rotation = 0, erase = false, blueprintId = `custom-${Date.now()}`, images = {};
  let zoom = 1;
  let hover = null;
  let templates = [];
  const canvas = $("blueprint-canvas");
  const ctx = canvas.getContext("2d");
  function status(text, error = false) { $("editor-status").textContent = text; $("editor-status").classList.toggle("error", error); }
  function refreshList() {
    templates = [...VS.Content.ENEMIES, ...VS.Content.customEnemies(localStorage)];
    $("blueprint-list").replaceChildren(...templates.map((template, i) => { const option = document.createElement("option"); option.value = i; option.textContent = `${template.name} · ур. ${template.tier}`; return option; }));
  }
  function rawBlueprint() {
    return { id: blueprintId, name: $("enemy-name").value, behaviour: $("enemy-behaviour").value, tier: Number($("enemy-tier").value), reward: Number($("enemy-reward").value), modules };
  }
  function load(raw) {
    const blueprint = VS.Content.validateBlueprint(raw);
    modules = blueprint.modules;
    blueprintId = blueprint.id;
    $("enemy-name").value = blueprint.name;
    $("enemy-behaviour").value = blueprint.behaviour;
    $("enemy-tier").value = blueprint.tier;
    $("enemy-reward").value = blueprint.reward;
    render(); status("Чертёж открыт. Изменения стандартного врага сохранятся отдельной копией.");
  }
  function render() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = 680 * ratio; canvas.height = 680 * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#040b13"; ctx.fillRect(0, 0, 680, 680);
    ctx.translate(340, 340); ctx.scale(zoom, zoom); ctx.translate(-340, -340);
    ctx.strokeStyle = "#142939"; ctx.lineWidth = 1;
    for (let i = -24; i <= 25; i++) {
      const pos = 340 + i * 30 - 15;
      ctx.beginPath(); ctx.moveTo(pos, -395); ctx.lineTo(pos, 1075); ctx.moveTo(-395, pos); ctx.lineTo(1075, pos); ctx.stroke();
    }
    ctx.fillStyle = "#c886422d";
    for (const m of modules) for (const cell of reservedCellsForModule(m)) if (Math.abs(cell.gx) <= 24 && Math.abs(cell.gy) <= 24) ctx.fillRect(340 + cell.gx * 30 - 14, 340 + cell.gy * 30 - 14, 28, 28);
    if (modules.length) {
      const ship = new VS.Ship({ modules }); ship.modules = modules; ship.x = 0; ship.y = 0; ship.aimWorld = { x: 500, y: 0 };
      ship.engineering?.sync();
      let buildHover = null;
      if (hover && !erase && MODULES[$("module-type").value]) {
        buildHover = { type: $("module-type").value, ...hover, rotation };
        const cells = VS.ModuleSystem.assemblyCells(buildHover);
        buildHover.valid = modules.length + cells.length <= 256 && cells.every(c => Math.abs(c.gx) <= 24 && Math.abs(c.gy) <= 24 && !modules.some(m => c.gx === m.gx && c.gy === m.gy));
      }
      ship.draw(ctx, { x: 0, y: 0 }, { width: 680, height: 680 }, images, Boolean(buildHover), buildHover);
    }
    for (const m of modules) if (MODULES[m.type].thrust || MODULES[m.type].weapon) {
      ctx.save(); ctx.translate(340 + m.gx * 30, 340 + m.gy * 30); ctx.rotate(m.rotation * Math.PI / 2);
      ctx.strokeStyle = "#ffe5a2"; ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(11, 0); ctx.lineTo(6, 4); ctx.stroke(); ctx.restore();
    }
    const stats = VS.ModuleSystem.calculateStats(modules);
    $("blueprint-stats").textContent = `${modules.length}/256 клеток  ·  Корпус ${stats.maxHp}  ·  Энергия ${stats.energyUse}/${stats.energy}  ·  Тяга ${stats.thrust.toFixed(1)}`;
    try { VS.Content.validateBlueprint(rawBlueprint()); status("Чертёж корректен. Готов к экспорту и добавлению в игру."); }
    catch (error) { status(error.message, true); }
  }
  function rotate() { rotation = (rotation + 1) % 4; $("rotate").textContent = `ПОВОРОТ · ${rotation * 90}°`; render(); }
  canvas.addEventListener("pointermove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const gx = Math.round(((event.clientX - bounds.left) / bounds.width * 680 - 340) / (30 * zoom));
    const gy = Math.round(((event.clientY - bounds.top) / bounds.height * 680 - 340) / (30 * zoom));
    if (hover?.gx === gx && hover?.gy === gy) return;
    hover = { gx, gy }; render();
  });
  canvas.addEventListener("pointerleave", () => { hover = null; render(); });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const gx = Math.round(((event.clientX - bounds.left) / bounds.width * 680 - 340) / (30 * zoom));
    const gy = Math.round(((event.clientY - bounds.top) / bounds.height * 680 - 340) / (30 * zoom));
    if (Math.abs(gx) > 24 || Math.abs(gy) > 24) return;
    const index = modules.findIndex((m) => m.gx === gx && m.gy === gy);
    if (erase || event.button === 2) { if (index !== -1) { const chosen = modules[index]; modules = modules.filter((m) => chosen.assembly ? m.assembly !== chosen.assembly : m !== chosen); } }
    else if (index !== -1) { status("Клетка занята. Сначала удалите блок.", true); return; }
    else {
      if (!MODULES[$("module-type").value]) { status("Выберите модуль из каталога", true); return; }
      const cells = VS.ModuleSystem.assemblyCells({ type: $("module-type").value, gx, gy, rotation });
      if (modules.length + cells.length > 256 || cells.some((c) => Math.abs(c.gx) > 24 || Math.abs(c.gy) > 24 || modules.some((m) => c.gx === m.gx && c.gy === m.gy))) { status("Сборка выходит за границы или перекрывает блоки", true); return; }
      modules.push(...cells);
    }
    render();
  });
  $("module-type").replaceChildren(...Object.entries(MODULES).filter(([, d]) => !d.internal).map(([id, definition]) => { const option = document.createElement("option"); option.value = id; option.textContent = definition.name; return option; }));
  $("editor-zoom").addEventListener("click", () => { zoom = zoom === 1 ? 0.44 : 1; render(); });
  $("module-type").value = "hull";
  function previewModule() {
    const def = MODULES[$("module-type").value];
    if (!def) return;
    $("module-description").textContent = def.description;
    $("editor-module-preview").innerHTML = `<span class="module-sprite">${VS.Visuals.iconMarkup(def)}</span><div><b>${def.name}</b><small>${VS.Visuals.CATEGORIES[VS.Visuals.category(def.visualType)]} · ${def.assemblyHp || def.hp} прочности${def.footprint ? ` · ${def.footprint.width}×${def.footprint.height} кл.` : ""}</small></div>`;
  }
  $("module-type").addEventListener("change", () => { previewModule(); render(); });
  $("editor-module-search").addEventListener("input", () => {
    const chosen = $("module-type").value;
    const options = Object.entries(MODULES).filter(([type, def]) => !def.internal && VS.Visuals.matches(type, "all", $("editor-module-search").value));
    $("module-type").replaceChildren(...options.map(([id, def]) => { const option = document.createElement("option"); option.value = id; option.textContent = def.name; return option; }));
    if (options.some(([id]) => id === chosen)) $("module-type").value = chosen;
    if (!options.length) { $("editor-module-preview").textContent = "Модуль не найден"; $("module-description").textContent = "Измените поисковый запрос"; }
    else previewModule();
  });
  $("rotate").addEventListener("click", rotate);
  window.addEventListener("keydown", (event) => { if (event.code === "KeyR" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) rotate(); });
  $("erase").addEventListener("click", () => { erase = !erase; $("erase").setAttribute("aria-pressed", String(erase)); });
  $("load-blueprint").addEventListener("click", () => { try { load(templates[Number($("blueprint-list").value)]); } catch (error) { status(error.message, true); } });
  $("new-blueprint").addEventListener("click", () => {
    if (!window.confirm("Начать новый чертёж? Несохранённые изменения будут потеряны.")) return;
    modules = [{ type: "core", gx: 0, gy: 0, rotation: 0 }]; blueprintId = `custom-${Date.now()}`; $("enemy-name").value = "Мой противник"; render();
  });
  $("register").addEventListener("click", () => {
    try {
      const blueprint = VS.Content.validateBlueprint(rawBlueprint());
      if (VS.Content.ENEMIES.some((t) => t.id === blueprint.id)) blueprint.id = `custom-${Date.now()}`;
      const saved = VS.Content.customEnemies(localStorage).filter((t) => t.id !== blueprint.id);
      if (saved.length >= 24) throw new Error("Лимит: 24 локальных чертежа. Удалите ненужный.");
      saved.push(blueprint); localStorage.setItem("voidspace-enemies-v1", JSON.stringify(saved)); blueprintId = blueprint.id;
      refreshList(); status("Добавлено! Открытая игра подхватит чертёж автоматически; следующий подходящий патруль может использовать его.");
    } catch (error) { status(error.message, true); }
  });
  $("export").addEventListener("click", () => {
    try {
      const blueprint = VS.Content.validateBlueprint(rawBlueprint());
      const url = URL.createObjectURL(new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${blueprint.id}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); status("Чертёж экспортирован в JSON.");
    } catch (error) { status(error.message, true); }
  });
  $("import").addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 100000) throw new Error("Максимальный размер чертежа — 100 КБ");
      load(JSON.parse(await file.text()));
    } catch (error) { status(`Ошибка импорта: ${error.message}`, true); }
    event.target.value = "";
  });
  $("remove-blueprint").addEventListener("click", () => {
    const selected = templates[Number($("blueprint-list").value)];
    if (!selected || VS.Content.ENEMIES.some((t) => t.id === selected.id)) { status("Стандартные враги не удаляются.", true); return; }
    if (!window.confirm(`Удалить локальный чертёж «${selected.name}»? Для восстановления понадобится экспорт JSON.`)) return;
    try { localStorage.setItem("voidspace-enemies-v1", JSON.stringify(VS.Content.customEnemies(localStorage).filter((t) => t.id !== selected.id))); refreshList(); status("Локальный чертёж удалён. Экспортированные файлы не изменены."); }
    catch (error) { status(error.message, true); }
  });
  const manifest = { module_frame: "assets/modules/frame.png" };
  for (const [type, definition] of Object.entries(MODULES)) manifest[`module_${type}`] = definition.sprite;
  Object.assign(manifest, VS.Visuals.MANIFEST);
  VS.Utils.loadImages(manifest).then((loaded) => { images = VS.Visuals.prepare(loaded); refreshList(); render(); previewModule(); }).catch((error) => status(error.message, true));
})();
