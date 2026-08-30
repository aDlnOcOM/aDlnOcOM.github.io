// Предоставляет доменную модель безопасных учебных сценариев для всех экранов HackBox.

(() => {
const catalog = window.HACKBOX_SCENARIO_CATALOG || {};

/**
 * Возвращает идентификаторы сценариев в порядке, заданном каталогом.
 *
 * @returns {string[]} Идентификаторы доступных сценариев.
 */
function listScenarioIds() {
  return Object.keys(catalog);
}

/**
 * Находит описание сценария и безопасно возвращает первый вариант при неизвестном идентификаторе.
 *
 * @param {string} id Идентификатор сценария.
 * @returns {object | null} Описание сценария или null, если каталог пуст.
 */
function findScenario(id) {
  return catalog[id] || catalog[listScenarioIds()[0]] || null;
}

/**
 * Возвращает первый доступный вариант сценария для совместимости с картой кампании.
 *
 * @param {string} id Идентификатор сценария.
 * @returns {object | null} Вариант сценария или null, если сценарий не найден.
 */
function getDefaultScenarioVariant(id) {
  return findScenario(id)?.variants?.[0] || null;
}

/**
 * Находит безопасный игровой вариант в пределах указанного сценария.
 *
 * @param {string} scenarioId Идентификатор сценария.
 * @param {string} variantId Идентификатор варианта.
 * @returns {object | null} Найденный вариант или базовый вариант сценария.
 */
function findScenarioVariant(scenarioId, variantId) {
  const scenario = findScenario(scenarioId);
  return scenario?.variants?.find(variant => variant.id === variantId) || getDefaultScenarioVariant(scenarioId);
}

/**
 * Проверяет, существует ли сценарий с указанным идентификатором.
 *
 * @param {string} id Идентификатор сценария.
 * @returns {boolean} True, когда сценарий можно выбрать.
 */
function isKnownScenario(id) {
  return Boolean(catalog[id]);
}

window.HackboxDomain = {
  findScenario,
  findScenarioVariant,
  getDefaultScenarioVariant,
  isKnownScenario,
  listScenarioIds
};
})();
