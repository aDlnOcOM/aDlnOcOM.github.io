// Управляет отдельной страницей выбора безопасного учебного сценария перед началом игры HackBox.
(() => {
  const DRAFT_KEY = "hackbox-scenario-draft-v3";
  const element = id => document.getElementById(id);
  const catalog = window.HACKBOX_SCENARIO_CATALOG || {};
  const scenarioIds = Object.keys(catalog);
  let selectedId = scenarioIds[0];

  function renderCatalog() {
    const selected = catalog[selectedId];
    const grid = element("scenario-type-grid");
    grid.innerHTML = "";
    scenarioIds.forEach((id, index) => {
      const scenario = catalog[id];
      const button = document.createElement("button");
      const isSelected = id === selectedId;
      button.type = "button";
      button.className = `scenario-type ${isSelected ? "selected" : ""}`;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(isSelected));
      button.innerHTML = `<small>${String(index + 1).padStart(2, "0")} / КЛАСС</small><strong>${scenario.name}</strong><em>${scenario.role}</em>`;
      button.addEventListener("click", () => {
        selectedId = id;
        renderCatalog();
      });
      grid.appendChild(button);
    });
    element("catalog-count").textContent = `${scenarioIds.length} ТИПА`;
    element("scenario-profile-index").textContent = `${String(scenarioIds.indexOf(selectedId) + 1).padStart(2, "0")} / УЧЕБНАЯ МОДЕЛЬ`;
    element("scenario-profile-name").textContent = selected.name;
    element("scenario-profile-description").textContent = selected.role;
    element("scenario-cycle-text").textContent = selected.cycle;
    element("scenario-impact").textContent = String(selected.economy.impact).padStart(2, "0");
    element("scenario-yield").textContent = String(selected.economy.yield).padStart(2, "0");
  }

  function startScenario() {
    const name = element("scenario-name").value.trim().toUpperCase() || "БЕЗЫМЯННЫЙ СЦЕНАРИЙ";
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 3, scenarioId: selectedId, scenarioName: name }));
      window.location.assign("index.html?new=1");
    } catch {
      window.location.assign("index.html");
    }
  }

  element("start-scenario").addEventListener("click", startScenario);
  renderCatalog();
})();
