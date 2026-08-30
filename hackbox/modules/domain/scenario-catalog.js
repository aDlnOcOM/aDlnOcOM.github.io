// Предоставляет доменную модель безопасных учебных сценариев для всех экранов HackBox.

const catalog = window.HACKBOX_SCENARIO_CATALOG || {};

/**
 * Возвращает идентификаторы сценариев в порядке, заданном каталогом.
 *
 * @returns {string[]} Идентификаторы доступных сценариев.
 */
export function listScenarioIds() {
  return Object.keys(catalog);
}

/**
 * Находит описание сценария и безопасно возвращает первый вариант при неизвестном идентификаторе.
 *
 * @param {string} id Идентификатор сценария.
 * @returns {object | null} Описание сценария или null, если каталог пуст.
 */
export function findScenario(id) {
  return catalog[id] || catalog[listScenarioIds()[0]] || null;
}

/**
 * Возвращает первый доступный вариант сценария для совместимости с картой кампании.
 *
 * @param {string} id Идентификатор сценария.
 * @returns {object | null} Вариант сценария или null, если сценарий не найден.
 */
export function getDefaultScenarioVariant(id) {
  return findScenario(id)?.variants?.[0] || null;
}

/**
 * Проверяет, существует ли сценарий с указанным идентификатором.
 *
 * @param {string} id Идентификатор сценария.
 * @returns {boolean} True, когда сценарий можно выбрать.
 */
export function isKnownScenario(id) {
  return Boolean(catalog[id]);
}
