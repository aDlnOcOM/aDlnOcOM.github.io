// Предоставляет доменную модель безопасных учебных сценариев для всех экранов HackBox.

(() => {
const catalog = window.HACKBOX_SCENARIO_CATALOG || {};
const traitCatalog = window.HACKBOX_TRAIT_CATALOG;

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

/**
 * Возвращает размер библиотеки трейтов и долю комбинированных трейтов в текущей колоде.
 *
 * @param {string} scenarioId Основной класс сценария.
 * @param {string[]} hybridIds Выбранные дополнительные классы.
 * @returns {{totalTraits: number, deckSize: number, hybridTraitCount: number, hybridShare: number}} Сводка библиотеки.
 */
function traitCoverage(scenarioId, hybridIds = []) {
  return traitCatalog?.traitCoverage(scenarioId, hybridIds) || { totalTraits: 0, deckSize: 0, hybridTraitCount: 0, hybridShare: 0 };
}

/**
 * Собирает отображаемую колоду трейтов для выбранного сценария и его гибридов.
 *
 * @param {string} scenarioId Основной класс сценария.
 * @param {string[]} hybridIds Выбранные дополнительные классы.
 * @returns {{traits: object[], librarySize: number, hybridTraitCount: number, hybridShare: number}} Колода трейтов.
 */
function getScenarioTraitDeck(scenarioId, hybridIds = []) {
  return traitCatalog?.buildTraitDeck(scenarioId, hybridIds) || { traits: [], librarySize: 0, hybridTraitCount: 0, hybridShare: 0 };
}

window.HackboxDomain = {
  findScenario,
  findScenarioVariant,
  getDefaultScenarioVariant,
  getScenarioTraitDeck,
  isKnownScenario,
  listScenarioIds,
  traitCoverage
};
})();
