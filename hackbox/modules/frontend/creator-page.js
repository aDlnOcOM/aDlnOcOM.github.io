// Управляет отображением отдельной страницы конструктора учебных сценариев HackBox.

(() => {
const { findScenario, findScenarioVariant, getDefaultScenarioVariant, listScenarioIds } = window.HackboxDomain;
const { saveScenarioDraft } = window.HackboxRepository;

const scenarioIds = listScenarioIds();
let selectedId = scenarioIds[0] || "";
let selectedVariantId = getDefaultScenarioVariant(selectedId)?.id || "standard";

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
  element("scenario-cycle-text").textContent = scenario.cycle;
  element("scenario-impact").textContent = String(scenario.economy.impact).padStart(2, "0");
  element("scenario-yield").textContent = String(scenario.economy.yield).padStart(2, "0");
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
  element("catalog-count").textContent = `${scenarioIds.length} ТИПА`;
  element("variant-count").textContent = `${selected?.variants.length || 0} ВАРИАНТА`;
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
  const saved = saveScenarioDraft({ scenarioId: selectedId, variantId: selectedVariantId, scenarioName });
  window.location.assign(saved ? "index.html?new=1" : "index.html");
}

element("start-scenario").addEventListener("click", startScenario);
renderCatalog();
})();
