(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES, reservedCellsForModule } = VS.ModuleSystem;
  const $ = (id) => document.getElementById(id);
  let modules = [{ type: "core", gx: 0, gy: 0, rotation: 0 }];
  let rotation = 0, erase = false, blueprintId = `custom-${Date.now()}`, images = {};
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
    ctx.strokeStyle = "#142939"; ctx.lineWidth = 1;
    for (let i = -10; i <= 11; i++) {
      const pos = 340 + i * 30 - 15;
      ctx.beginPath(); ctx.moveTo(pos, 25); ctx.lineTo(pos, 655); ctx.moveTo(25, pos); ctx.lineTo(655, pos); ctx.stroke();
    }
    ctx.fillStyle = "#c886422d";
    for (const m of modules) for (const cell of reservedCellsForModule(m)) if (Math.abs(cell.gx) <= 10 && Math.abs(cell.gy) <= 10) ctx.fillRect(340 + cell.gx * 30 - 14, 340 + cell.gy * 30 - 14, 28, 28);
    if (modules.length) {
      const ship = new VS.Ship({ modules }); ship.modules = modules; ship.x = 0; ship.y = 0; ship.aimWorld = { x: 500, y: 0 };
      ship.draw(ctx, { x: 0, y: 0 }, { width: 680, height: 680 }, images);
    }
    for (const m of modules) if (MODULES[m.type].thrust || MODULES[m.type].weapon) {
      ctx.save(); ctx.translate(340 + m.gx * 30, 340 + m.gy * 30); ctx.rotate(m.rotation * Math.PI / 2);
      ctx.strokeStyle = "#ffe5a2"; ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(11, 0); ctx.lineTo(6, 4); ctx.stroke(); ctx.restore();
    }
    const stats = VS.ModuleSystem.calculateStats(modules);
    $("blueprint-stats").textContent = `${modules.length}/64 блоков  ·  Корпус ${stats.maxHp}  ·  Энергия ${stats.energyUse}/${stats.energy}  ·  Тяга ${stats.thrust.toFixed(1)}`;
    try { VS.Content.validateBlueprint(rawBlueprint()); status("Чертёж корректен. Готов к экспорту и добавлению в игру."); }
    catch (error) { status(error.message, true); }
  }
  function rotate() { rotation = (rotation + 1) % 4; $("rotate").textContent = `ПОВОРОТ · ${rotation * 90}°`; }
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const gx = Math.round(((event.clientX - bounds.left) / bounds.width * 680 - 340) / 30);
    const gy = Math.round(((event.clientY - bounds.top) / bounds.height * 680 - 340) / 30);
    if (Math.abs(gx) > 10 || Math.abs(gy) > 10) return;
    const index = modules.findIndex((m) => m.gx === gx && m.gy === gy);
    if (erase || event.button === 2) { if (index !== -1) modules.splice(index, 1); }
    else if (index !== -1) { status("Клетка занята. Сначала удалите блок.", true); return; }
    else if (modules.length < 64) modules.push({ type: $("module-type").value, gx, gy, rotation });
    render();
  });
  $("module-type").replaceChildren(...Object.entries(MODULES).map(([id, definition]) => { const option = document.createElement("option"); option.value = id; option.textContent = definition.name; return option; }));
  $("module-type").value = "hull";
  $("module-type").addEventListener("change", () => { $("module-description").textContent = MODULES[$("module-type").value].description; });
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
  VS.Utils.loadImages(manifest).then((loaded) => { images = loaded; refreshList(); render(); });
})();
