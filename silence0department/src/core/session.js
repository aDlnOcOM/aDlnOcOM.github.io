/** Состояние и сохранение. Новый генератор хранится отдельно от старого слота v3. */
import { STORAGE, VIEW_ORDER, DIFFICULTIES } from '../data/catalog.js';
import detective from '../domain/engine.js';
import { generateCase } from '../domain/generator.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function createInitialState(_app, data) {

  const firstEvidence = data.difficultyKey === "tutorial" ? [] : ["ev-scene", "ev-victim", "ev-access", "ev-witness"];
  const boardIds = [...data.suspects.map((person) => person.id), ...firstEvidence];
  const boardPositions = {};
  boardIds.forEach((id, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    boardPositions[id] = { x: 35 + column * 190, y: 38 + row * 185 };
  });
  const timelinePuzzle = data.puzzles.find((puzzle) => puzzle.kind === "timeline");
  return {
    ...detective.initialState(data),
    view: "overview",
    startedAt: Date.now(),
    solvedPuzzles: [],
    hintsUsed: [],
    importantIds: [],
    boardIds,
    boardPositions,
    boardLinks: [],
    boardSelected: [],
    boardNotes: [],
    transcripts: {},
    askedQuestions: {},
    activeSuspect: data.suspects[0].id,
    tasks: {},
    timelineOrder: timelinePuzzle ? [...timelinePuzzle.initialOrder] : [],
    computer: {
      app: "mail",
      opened: "mail-1",
      finds: [],
      query: "",
      searchResults: [],
      toolOutput: "",
    },
    toolRuns: {},
    report: null,
    tutorial: data.difficultyKey === "tutorial" ? { step: 0, hidden: false, completed: false } : null,
    lastSavedAt: Date.now(),
  };
}


// Возвращает текущие данные без изменения хода расследования.
export function getEvidence(_app, id) {
  const { caseData } = _app;
  return caseData?.evidence.find((item) => item.id === id) || null;
}


// Возвращает текущие данные без изменения хода расследования.
export function getSuspect(_app, id) {
  const { caseData } = _app;
  return caseData?.suspects.find((person) => person.id === id) || null;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function isEvidenceUnlocked(_app, item) {
  const { state } = _app;
  if (!item.lockedBy) return true;
  if (item.lockedBy.startsWith("field-")) return state.field.found.includes(item.lockedBy);
  if (item.lockedBy.startsWith("task-")) return state.tasks[item.lockedBy]?.status === "done";
  if (item.lockedBy.startsWith("computer-")) return state.computer.finds.includes(item.lockedBy);
  return state.solvedPuzzles.includes(item.lockedBy);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function availableEvidence(_app) {
  const { caseData } = _app;
  const { isEvidenceUnlocked } = _app;
  return caseData ? caseData.evidence.filter(isEvidenceUnlocked) : [];
}


// Сохраняет код генерации и прогресс; абсолютный срок не сбрасывается.
export function saveCase(_app) {
  const { caseData, state } = _app;
  if (!caseData || !state) return;
  state.lastSavedAt = Date.now();
  localStorage.setItem(
    STORAGE.activeCase,
    JSON.stringify({ seed: caseData.seed, difficultyKey: caseData.difficultyKey, caseKind: caseData.requestedKind, state }),
  );
}


// Восстанавливает именно сохранённый профиль и проверяет истечение срока до первого действия.
export function loadCase(_app) {
  let { caseData, state } = _app;
  const { createInitialState, boardLink, updateCompletedTasks } = _app;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.activeCase));
    if (!saved?.seed || !DIFFICULTIES[saved.difficultyKey] || !saved.state) return false;
    _app.caseData = caseData = generateCase(saved.seed, saved.difficultyKey, saved.caseKind || "auto");
    _app.state = state = { ...createInitialState(caseData), ...saved.state };
    state.computer = { ...createInitialState(caseData).computer, ...(saved.state.computer || {}) };
    state.boardLinks = (state.boardLinks || []).map(boardLink).filter((link) => link.from && link.to);
    state.boardNotes ||= [];
    if (!VIEW_ORDER.includes(state.view)) state.view = "overview";
    detective.checkThreat(caseData, state);
    if (saved.difficultyKey === "tutorial") state.tutorial ||= { step: 0, hidden: false, completed: false };
    updateCompletedTasks(false);
    return true;
  } catch {
    return false;
  }
}
