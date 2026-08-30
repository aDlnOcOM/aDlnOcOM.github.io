// Изолирует работу HackBox с локальными черновиками и сохранениями браузера.

const DRAFT_KEY = "hackbox-scenario-draft-v3";
const SAVE_KEY = "hackbox-scenario-save-v3";

/**
 * Читает JSON из указанного браузерного хранилища, не прерывая игру при повреждённых данных.
 *
 * @param {Storage} storage Браузерное хранилище, из которого нужно прочитать данные.
 * @param {string} key Ключ записи.
 * @returns {object | null} Распознанное значение или null.
 */
function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}

/**
 * Сохраняет сериализуемое значение и возвращает статус операции вместо ошибки интерфейсу.
 *
 * @param {Storage} storage Браузерное хранилище для записи.
 * @param {string} key Ключ записи.
 * @param {object} value Значение, которое требуется сохранить.
 * @returns {boolean} True, если данные удалось записать.
 */
function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Сохраняет выбор со страницы конструктора до перенаправления на карту мира.
 *
 * @param {{scenarioId: string, scenarioName: string}} draft Выбранный игроком сценарий.
 * @returns {boolean} True, если черновик сохранён.
 */
export function saveScenarioDraft(draft) {
  return writeJson(sessionStorage, DRAFT_KEY, { version: 3, ...draft });
}

/**
 * Однократно возвращает черновик сценария и очищает его, чтобы обновление страницы не перезапускало игру.
 *
 * @returns {{scenarioId: string, scenarioName: string} | null} Валидный черновик или null.
 */
export function takeScenarioDraft() {
  const draft = readJson(sessionStorage, DRAFT_KEY);
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Черновик всё равно будет проигнорирован, если хранилище недоступно.
  }
  return draft?.version === 3 && typeof draft.scenarioId === "string" ? draft : null;
}

/**
 * Возвращает последнюю локально сохранённую кампанию, если она совместима с текущей версией.
 *
 * @returns {{state: object} | null} Снимок кампании или null.
 */
export function readCampaignSave() {
  const saved = readJson(localStorage, SAVE_KEY);
  return saved?.version === 3 && saved.state?.gameCreated ? saved : null;
}

/**
 * Сохраняет состояние кампании на устройстве пользователя.
 *
 * @param {object} state Состояние игровой кампании.
 * @returns {boolean} True, если сохранение создано.
 */
export function writeCampaignSave(state) {
  return writeJson(localStorage, SAVE_KEY, { version: 3, savedAt: Date.now(), state });
}
