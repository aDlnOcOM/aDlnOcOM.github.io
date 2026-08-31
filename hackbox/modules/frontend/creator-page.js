// Управляет отображением отдельной страницы конструктора учебных сценариев HackBox.

(() => {
const { findScenario, findScenarioVariant, getDefaultScenarioVariant, listScenarioIds } = window.HackboxDomain;
const { saveScenarioDraft } = window.HackboxRepository;

const scenarioIds = listScenarioIds();
let selectedId = scenarioIds[0] || "";
let selectedVariantId = getDefaultScenarioVariant(selectedId)?.id || "standard";
let selectedHybridIds = [];

/**
 * Возвращает DOM-элемент по его уникальному идентификатору.
 *
 * @param {string} id Идентификатор элемента.
 * @returns {HTMLElement} Найденный элемент страницы.
 */
function element(id) {
  return document.getElementById(id);
}

/**
 * Создаёт кнопку выбора одного класса учебного сценария.
 *
 * @param {string} id Идентификатор сценария.
 * @param {number} index Порядковый номер в каталоге.
 * @returns {HTMLButtonElement} Готовая интерактивная карточка.
 */
function createScenarioButton(id, index) {
  const scenario = findScenario(id);
  const button = document.createElement("button");
  const isSelected = id === selectedId;
  button.type = "button";
  button.className = `scenario-type ${isSelected ? "selected" : ""}`;
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(isSelected));
  button.innerHTML = `<small>${String(index + 1).padStart(2, "0")} / КЛАСС</small><strong>${scenario.name}</strong><em>${scenario.role}</em>`;
  button.addEventListener("click", () => {
    selectedId = id;
    selectedVariantId = getDefaultScenarioVariant(id)?.id || "standard";
    selectedHybridIds = selectedHybridIds.filter(hybridId => hybridId !== id);
    renderCatalog();
  });
  return button;
}

/**
 * Создаёт кнопку выбора безопасного балансного варианта текущего сценария.
 *
 * @param {object} variant Игровой вариант сценария.
 * @param {number} index Порядковый номер варианта.
 * @returns {HTMLButtonElement} Готовая интерактивная карточка варианта.
 */
function createVariantButton(variant, index) {
  const button = document.createElement("button");
  const isSelected = variant.id === selectedVariantId;
  button.type = "button";
  button.className = `scenario-variant ${isSelected ? "selected" : ""}`;
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(isSelected));
  button.innerHTML = `<small>ВАРИАНТ ${String(index + 1).padStart(2, "0")}</small><strong>${variant.name}</strong><em>${variant.effect}</em>`;
  button.addEventListener("click", () => {
    selectedVariantId = variant.id;
    renderCatalog();
  });
  return button;
}

/**
 * Создаёт карточку дополнительного класса для безопасного смешанного сценария.
 *
 * @param {string} id Идентификатор дополнительного класса.
 * @returns {HTMLButtonElement} Готовая интерактивная карточка смешения.
 */
function createHybridButton(id) {
  const scenario = findScenario(id);
  const isSelected = selectedHybridIds.includes(id);
  const limitReached = selectedHybridIds.length >= 2;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `scenario-hybrid ${isSelected ? "selected" : ""}`;
  button.setAttribute("aria-pressed", String(isSelected));
  button.disabled = !isSelected && limitReached;
  button.innerHTML = `<small>${isSelected ? "ДОБАВЛЕНО" : "ДОПОЛНИТЕЛЬНЫЙ КЛАСС"}</small><strong>${scenario.name}</strong><em>${scenario.role}</em>`;
  button.addEventListener("click", () => {
    selectedHybridIds = isSelected
      ? selectedHybridIds.filter(hybridId => hybridId !== id)
      : [...selectedHybridIds, id].slice(0, 2);
    renderCatalog();
  });
  return button;
}

/**
 * Возвращает смешанные условные показатели без описания реальных технических механизмов.
 *
 * @param {object} scenario Основной учебный сценарий.
 * @returns {{impact: number, yield: number}} Условные показатели итоговой модели.
 */
function mixedEconomy(scenario) {
  const hybrids = selectedHybridIds.map(id => findScenario(id)).filter(Boolean);
  const sources = [scenario, ...hybrids];
  const weights = sources.length === 3 ? [.62, .19, .19] : sources.length === 2 ? [.74, .26] : [1];
  return sources.reduce((total, item, index) => ({
    impact: total.impact + item.economy.impact * weights[index],
    yield: total.yield + item.economy.yield * weights[index]
  }), { impact: 0, yield: 0 });
}

/**
 * Формирует короткое безопасное описание выбранного смешения классов.
 *
 * @returns {string} Текст для карточки профиля.
 */
function hybridSummary() {
  const hybrids = selectedHybridIds.map(id => findScenario(id)).filter(Boolean);
  return hybrids.length ? `Базовый класс + ${hybrids.map(item => item.name).join(" + ")}` : "Только базовый класс";
}

/**
 * Обновляет карточку с игровыми параметрами выбранного сценария.
 *
 * @param {object} scenario Текущий учебный сценарий.
 * @param {object} variant Выбранная игроком балансная ветвь.
 * @returns {void}
 */
function renderScenarioProfile(scenario, variant) {
  const position = scenarioIds.indexOf(selectedId) + 1;
  element("scenario-profile-index").textContent = `${String(position).padStart(2, "0")} / УЧЕБНАЯ МОДЕЛЬ`;
  element("scenario-profile-name").textContent = scenario.name;
  element("scenario-profile-variant").textContent = variant.name.toUpperCase();
  element("scenario-profile-description").textContent = `${scenario.role} ${variant.effect}`;
  element("scenario-realtime-text").textContent = scenario.cycle;
  element("scenario-hybrid-text").textContent = hybridSummary();
  const economy = mixedEconomy(scenario);
  element("scenario-impact").textContent = String(Math.round(economy.impact)).padStart(2, "0");
  element("scenario-yield").textContent = String(Math.round(economy.yield)).padStart(2, "0");
}

/**
 * Отрисовывает каталог и выделяет выбранную игроком карточку.
 *
 * @returns {void}
 */
function renderCatalog() {
  const selected = findScenario(selectedId);
  const variant = findScenarioVariant(selectedId, selectedVariantId);
  const grid = element("scenario-type-grid");
  grid.innerHTML = "";
  scenarioIds.forEach((id, index) => grid.appendChild(createScenarioButton(id, index)));
  const variantGrid = element("scenario-variant-grid");
  variantGrid.innerHTML = "";
  selected?.variants.forEach((item, index) => variantGrid.appendChild(createVariantButton(item, index)));
  const hybridGrid = element("scenario-hybrid-grid");
  hybridGrid.innerHTML = "";
  scenarioIds.filter(id => id !== selectedId).forEach(id => hybridGrid.appendChild(createHybridButton(id)));
  element("catalog-count").textContent = `${scenarioIds.length} ТИПА`;
  element("variant-count").textContent = `${selected?.variants.length || 0} ВАРИАНТА`;
  element("hybrid-count").textContent = `${selectedHybridIds.length} / 2`;
  if (selected && variant) renderScenarioProfile(selected, variant);
}

/**
 * Сохраняет выбор игрока и открывает карту для нового сценария.
 *
 * @returns {void}
 */
function startScenario() {
  const input = element("scenario-name");
  const scenarioName = input.value.trim().toUpperCase() || "БЕЗЫМЯННЫЙ СЦЕНАРИЙ";
  const saved = saveScenarioDraft({ scenarioId: selectedId, variantId: selectedVariantId, hybridTypeIds: selectedHybridIds, scenarioName });
  window.location.assign(saved ? "index.html?new=1" : "index.html");
}

element("start-scenario").addEventListener("click", startScenario);
renderCatalog();
})();
