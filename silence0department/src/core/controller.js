/** Диспетчер действий и жизненный цикл: запуск, формы, клавиатура и таймер. */
import { VIEW_ORDER, DEFAULT_SETTINGS } from '../data/catalog.js';
import { normalize, formatDuration, randomCaseCode } from '../core/utils.js';
import detective from '../domain/engine.js';
import { generateCase } from '../domain/generator.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function startNewCase(_app, seed, difficultyKey, caseKind = "auto") {
  const { dom } = _app;
  let { caseData, state, archiveQuery, archiveFilter } = _app;
  const { createInitialState, saveCase, setStatus, toast, closeDialog, renderCurrentView } = _app;
  _app.caseData = caseData = generateCase(seed.toUpperCase(), difficultyKey, caseKind);
  _app.state = state = createInitialState(caseData);
  _app.archiveQuery = archiveQuery = "";
  _app.archiveFilter = archiveFilter = "all";
  saveCase();
  closeDialog(dom.newCaseDialog);
  renderCurrentView();
  toast(`Дело ${caseData.number} принято. Материалы загружены.`);
  setStatus(`Открыто дело ${caseData.number}`);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function openNewCaseDialog(_app) {
  const { dom } = _app;
  const { showDialog } = _app;
  document.querySelector("#case-seed").value = randomCaseCode();
  _app.updateCasePreview();
  showDialog(dom.newCaseDialog);
}

// До принятия дела показываем реальную ставку выбранного режима и сложности.
export function updateCasePreview(_app) {
  const kind = document.querySelector("#case-kind").value || "auto";
  const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || "detective";
  const profile = detective.PROFILES.find((item) => item.id === kind);
  const minutes = { observer: 50, detective: 40, inspector: 30 }[difficulty];
  const note = document.querySelector("#case-mode-note");
  if (difficulty === "tutorial") note.textContent = "Обучение всегда создаёт обычное дело без таймера: два подозреваемых, подсказки и знакомство с полевой работой.";
  else if (!profile || profile.timed) note.textContent = `${profile ? profile.pitch : "Случайная категория может включать дело о наёмнике."} Срок охоты: ${minutes} минут реального времени, включая закрытую страницу. Действия сокращают запас; заметность 100 или истечение срока означают гибель детектива. Для расследования без таймера выберите другую категорию.`;
  else note.textContent = `${profile.pitch} Без ограничения по времени. Люди, улики, связи и ложные линии зависят от кода дела.`;
}


// Направляет действие пользователя в соответствующий раздел.
export function handleClick(_app, event) {
  const { dom, caseData, state, suppressBoardClickUntil } = _app;
  let { archiveFilter } = _app;
  const { saveCase, toast, closeDialog, handleDetectiveClick, renderInterviews, askQuestion, renderReport, updateChrome, navigate, renderTutorialUi, advanceTutorial, handleTutorialEvent, isBoardNote, boardLink, renderBoard, updateBoardSelectionUi, openBoardNoteDialog, renderArchive, openEvidence, renderComputer, fixComputerFind, runComputerTool, renderPuzzleDetail, solvePuzzle, renderAnalysis, openNewCaseDialog } = _app;
  const target = event.target.closest("button, [data-evidence-id]");
  if (!target) return;
  if (handleDetectiveClick(target)) return;

  if (target.dataset.action === "tutorial-continue" || target.dataset.action === "tutorial-skip") {
    advanceTutorial();
    return;
  }
  if (target.dataset.action === "tutorial-hide") {
    state.tutorial.hidden = true;
    saveCase();
    renderTutorialUi();
    return;
  }
  if (target.dataset.action === "tutorial-resume") {
    state.tutorial.hidden = false;
    saveCase();
    renderTutorialUi();
    return;
  }

  if (target.dataset.view) navigate(target.dataset.view);
  if (target.dataset.action === "open-new-case") openNewCaseDialog();
  if (target.dataset.action === "close-new-case") closeDialog(dom.newCaseDialog);
  if (target.dataset.action === "close-detail") {
    closeDialog(dom.detailDialog);
    renderTutorialUi();
  }
  if (target.dataset.action === "close-help") closeDialog(dom.helpDialog);
  if (target.dataset.action === "close-settings") closeDialog(dom.settingsDialog);

  if (target.dataset.evidenceId) {
    openEvidence(target.dataset.evidenceId);
    handleTutorialEvent("evidence-open");
  }
  if (target.dataset.puzzleId) {
    const puzzle = caseData.puzzles.find((item) => item.id === target.dataset.puzzleId);
    if (puzzle) {
      renderPuzzleDetail(puzzle);
      if (puzzle.kind === "digital") handleTutorialEvent("digital-open");
    }
  }
  if (target.dataset.suspectId) {
    state.activeSuspect = target.dataset.suspectId;
    renderInterviews();
  }
  if (target.dataset.questionId) {
    askQuestion(target.dataset.questionId);
    handleTutorialEvent("interview-question");
  }
  if (target.dataset.archiveFilter) {
    _app.archiveFilter = archiveFilter = target.dataset.archiveFilter;
    renderArchive();
  }
  if (target.dataset.taskId) {
    const running = Object.values(state.tasks).some((task) => task.status === "running");
    const task = caseData.tasks.find((item) => item.id === target.dataset.taskId);
    if (task && !running) {
      state.tasks[task.id] = { status: "running", startedAt: Date.now(), finishAt: Date.now() + task.duration * 1000 };
      saveCase();
      renderAnalysis();
      toast(`Кира начала задачу. Результат будет через ${task.duration} секунд.`);
    }
  }

  if (target.dataset.computerApp) {
    state.computer.app = target.dataset.computerApp;
    state.computer.opened = target.dataset.computerApp === "mail" ? "mail-1" : null;
    state.computer.toolOutput = "";
    saveCase();
    renderComputer();
    if (target.dataset.computerApp === "tools") handleTutorialEvent("computer-tools");
  }
  if (target.dataset.mailId) {
    state.computer.opened = target.dataset.mailId;
    saveCase();
    renderComputer();
  }
  if (target.dataset.fileId) {
    state.computer.opened = target.dataset.fileId;
    state.computer.toolOutput = "";
    saveCase();
    renderComputer();
  }
  if (target.dataset.computerTool) {
    runComputerTool(target.dataset.computerTool);
    if (target.dataset.computerTool === "strings") handleTutorialEvent("computer-strings");
  }
  if (target.dataset.action === "fix-computer-find") fixComputerFind(target.dataset.find);
  if (target.dataset.action === "inspect-file-meta") {
    const file = caseData.computer.files.find((item) => item.id === target.dataset.file);
    state.computer.toolOutput = file?.metadata || "Метаданные не найдены.";
    saveCase();
    renderComputer();
  }

  if (target.dataset.action === "toggle-important") {
    const id = target.dataset.evidence;
    state.importantIds = state.importantIds.includes(id) ? state.importantIds.filter((item) => item !== id) : [...state.importantIds, id];
    saveCase();
    openEvidence(id);
    updateChrome();
  }
  if (target.dataset.action === "add-to-board") {
    const id = target.dataset.evidence;
    if (!state.boardIds.includes(id)) {
      state.boardIds.push(id);
      const index = state.boardIds.length - 1;
      state.boardPositions[id] = { x: 35 + (index % 4) * 190, y: 38 + Math.floor(index / 4) * 150 };
      saveCase();
      toast("Материал добавлен на доску.");
    }
    openEvidence(id);
    updateChrome();
    handleTutorialEvent("board-add");
  }
  if (target.dataset.action === "open-board-note") openBoardNoteDialog();
  if (target.dataset.action === "delete-board-note" && state.boardSelected.length === 1) {
    const id = state.boardSelected[0];
    if (isBoardNote(id)) {
      state.boardNotes = state.boardNotes.filter((item) => item.id !== id);
      state.boardIds = state.boardIds.filter((item) => item !== id);
      state.boardLinks = state.boardLinks.filter((savedLink) => {
        const link = boardLink(savedLink);
        return link.from !== id && link.to !== id;
      });
      delete state.boardPositions[id];
      state.boardSelected = [];
      saveCase();
      renderBoard();
      toast("Рабочая версия убрана с доски.");
    }
  }
  if (target.dataset.boardId && performance.now() >= suppressBoardClickUntil) {
    const id = target.dataset.boardId;
    if (state.boardSelected.includes(id)) state.boardSelected = state.boardSelected.filter((item) => item !== id);
    else if (state.boardSelected.length < 2) state.boardSelected.push(id);
    else state.boardSelected = [id];
    updateBoardSelectionUi();
  }
  if (target.dataset.action === "connect-board" && state.boardSelected.length === 2) {
    const [from, to] = state.boardSelected;
    const kind = document.querySelector("#board-link-kind")?.value || "связь";
    const note = String(document.querySelector("#board-link-note")?.value || "").trim();
    const index = state.boardLinks.findIndex((savedLink) => {
      const link = boardLink(savedLink);
      return (link.from === from && link.to === to) || (link.from === to && link.to === from);
    });
    if (index >= 0) state.boardLinks[index] = { from, to, kind, note };
    else state.boardLinks.push({ from, to, kind, note });
    state.boardSelected = [];
    saveCase();
    renderBoard();
    handleTutorialEvent("board-link");
  }
  if (target.dataset.action === "clear-board-links") {
    state.boardLinks = [];
    state.boardSelected = [];
    saveCase();
    renderBoard();
  }

  if (target.dataset.action === "show-hint") {
    if (!state.hintsUsed.includes(target.dataset.puzzle)) state.hintsUsed.push(target.dataset.puzzle);
    saveCase();
    const puzzle = caseData.puzzles.find((item) => item.id === target.dataset.puzzle);
    renderPuzzleDetail(puzzle);
  }
  if (target.dataset.timelineMove) {
    const index = state.timelineOrder.indexOf(target.dataset.eventId);
    const nextIndex = target.dataset.timelineMove === "up" ? index - 1 : index + 1;
    if (index >= 0 && nextIndex >= 0 && nextIndex < state.timelineOrder.length) {
      [state.timelineOrder[index], state.timelineOrder[nextIndex]] = [state.timelineOrder[nextIndex], state.timelineOrder[index]];
      saveCase();
      const puzzle = caseData.puzzles.find((item) => item.kind === "timeline");
      renderPuzzleDetail(puzzle);
    }
  }
  if (target.dataset.action === "check-timeline") solvePuzzle(target.dataset.puzzle, state.timelineOrder.join("|"));
  if (target.dataset.action === "run-dictionary") {
    const puzzle = caseData.puzzles.find((item) => item.id === target.dataset.puzzle);
    state.toolRuns[puzzle.id] = `dictionary.small … 5 кандидатов\nMATCH: ${puzzle.answer}\nВремя: 0.8 с · защита признана слабой`;
    saveCase();
    renderPuzzleDetail(puzzle);
  }
  if (target.dataset.action === "extract-zero") {
    const puzzle = caseData.puzzles.find((item) => item.id === target.dataset.puzzle);
    state.toolRuns[puzzle.id] = "U+200B/U+200C → binary → ASCII\nИзвлечено: QVJDSElWRQ==";
    saveCase();
    renderPuzzleDetail(puzzle);
    handleTutorialEvent("digital-decode");
  }
  if (target.dataset.action === "reopen-case") {
    if (state.outcome) return;
    state.report = null;
    saveCase();
    renderReport();
  }
}


// Проверяет формы и завершает расследование только после доказанной цепи.
export function handleSubmit(_app, event) {
  const { dom, caseData, state } = _app;
  const { availableEvidence, saveCase, toast, closeDialog, sendAssistantMessage, presentEvidence, renderOutcome, evaluateReport, renderReportResult, updateChrome, renderCurrentView, handleTutorialEvent, renderBoard, renderComputer, solvePuzzle, startNewCase } = _app;
  if (event.target.id === "assistant-form") {
    event.preventDefault();
    sendAssistantMessage(String(new FormData(event.target).get("message") || ""));
    return;
  }
  if (event.target.id === "present-evidence-form") {
    event.preventDefault();
    presentEvidence(String(new FormData(event.target).get("evidence") || ""));
    return;
  }
  if (event.target === dom.newCaseForm) {
    event.preventDefault();
    const formData = new FormData(dom.newCaseForm);
    const seed = String(formData.get("seed") || "").trim() || randomCaseCode();
    const difficultyKey = String(formData.get("difficulty") || "detective");
    startNewCase(seed, difficultyKey, String(formData.get("caseKind") || "auto"));
    return;
  }

  if (event.target.matches("[data-puzzle-form]")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    solvePuzzle(event.target.dataset.puzzleForm, String(formData.get("puzzle-answer") || ""));
    return;
  }

  if (event.target.id === "computer-search-form") {
    event.preventDefault();
    const query = String(new FormData(event.target).get("query") || document.querySelector("#computer-query")?.value || "").trim();
    state.computer.query = query;
    const normalizedQuery = normalize(query);
    state.computer.searchResults = normalizedQuery
      ? availableEvidence().filter((item) => normalize(`${item.code} ${item.title} ${item.excerpt} ${item.content} ${item.tags.join(" ")}`).includes(normalizedQuery)).slice(0, 14)
      : [];
    saveCase();
    renderComputer();
    return;
  }

  if (event.target.id === "board-note-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    if (!title || !body) return;
    const id = `note-${Date.now().toString(36)}`;
    state.boardNotes.push({ id, title, body });
    state.boardIds.push(id);
    const index = state.boardIds.length - 1;
    state.boardPositions[id] = { x: 35 + (index % 4) * 190, y: 38 + Math.floor(index / 4) * 150 };
    saveCase();
    closeDialog(dom.detailDialog);
    renderBoard();
    toast("Рабочая версия добавлена на доску.");
    return;
  }

  if (event.target.id === "report-form") {
    event.preventDefault();
    if (state.outcome || detective.checkThreat(caseData, state)) { renderCurrentView(); return; }
    const formData = new FormData(event.target);
    const evidenceCount = formData.getAll("evidence").length;
    if (evidenceCount < 3 || evidenceCount > 5) {
      toast("Выберите от трёх до пяти материалов для доказательной цепочки.", true);
      return;
    }
    state.report = evaluateReport(formData);
    if (state.report.proven) state.outcome = { kind: "solved", at: Date.now() };
    else detective.spend(caseData, state, 120, 6);
    saveCase();
    if (state.outcome?.kind === "dead") renderOutcome();
    else renderReportResult();
    updateChrome();
    dom.workspace.scrollTop = 0;
    handleTutorialEvent("report-submit");
    return;
  }
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function handleKeyboard(_app, event) {
  const { dom, caseData } = _app;
  const { showDialog, navigate } = _app;
  const tag = event.target.tagName;
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target.isContentEditable;
  // Карточки архива открываются клавиатурой так же, как обычные кнопки.
  if (!typing && ["Enter", " "].includes(event.key) && event.target.dataset.evidenceId) {
    event.preventDefault();
    _app.openEvidence(event.target.dataset.evidenceId);
    return;
  }
  if (!typing && /^[1-9]$/.test(event.key) && caseData && !document.querySelector("dialog[open]")) {
    navigate(VIEW_ORDER[Number(event.key) - 1]);
  }
  if (!typing && event.key.toLowerCase() === "n") {
    document.querySelector(".notebook")?.classList.toggle("is-open");
    if (document.querySelector(".notebook")?.classList.contains("is-open")) dom.notes.focus();
  }
  if (!typing && event.key === "?") showDialog(dom.helpDialog);
  if (event.key === "Escape") document.querySelector(".notebook")?.classList.remove("is-open");
}


// Обновляет реальные сроки, поручения и индикаторы без перезаписи черновиков.
export function tick(_app) {
  const { dom, caseData, state } = _app;
  const { saveCase, closeDialog, updateThreatChrome, updateChrome, renderCurrentView, renderAnalysis, updateAnalysisProgress, updateCompletedTasks } = _app;
  if (!caseData || !state) return;
  if (detective.checkThreat(caseData, state)) { saveCase(); closeDialog(dom.detailDialog); renderCurrentView(); }
  updateThreatChrome();
  if (state.outcome?.kind === "dead") return;
  // Предупреждение приходит один раз при пересечении порога, а не каждую секунду.
  if (caseData.profile.timed && !state.outcome) {
    const threat = detective.threat(caseData, state);
    for (const [key, reached, message] of [
      ["watched", threat.exposure >= 40, "Кира: вокруг ваших запросов появилась посторонняя активность. Проверьте безопасный маршрут в разделе «В поле»."],
      ["identified", threat.exposure >= 70, "Кира: исполнитель близок к вашему адресу. Заметность критическая; не раскрывайте новые имена заказчику."],
      ["deadline", threat.remaining <= 300000, "Кира: осталось меньше пяти минут. Завершайте доказательную цепь или используйте оставшуюся смену маршрута."],
    ]) {
      if (reached && !state.pressure.warned.includes(key)) {
        state.pressure.warned.push(key);
        state.chat.push({ role: "assistant", text: message, at: Date.now() });
        _app.toast(message, true);
        saveCase();
      }
    }
  }
  dom.timer.textContent = formatDuration(Date.now() - state.startedAt);
  const completed = updateCompletedTasks(true);
  const activeTask = Object.values(state.tasks).some((task) => task.status === "running");
  dom.taskIndicator.hidden = !activeTask;
  if (state.view === "analysis" && !dom.detailDialog.open) {
    if (completed) {
      // Поручение может закончиться во время ввода: сохраняем фокус и позицию курсора.
      const input = document.querySelector("#assistant-message");
      const focused = input && document.activeElement === input;
      const selection = input?.selectionStart;
      renderAnalysis();
      if (focused) {
        const restored = document.querySelector("#assistant-message");
        restored?.focus();
        restored?.setSelectionRange(selection, selection);
      }
    }
    else if (activeTask) updateAnalysisProgress();
  }
  const clock = document.querySelector("#computer-clock");
  if (clock) clock.textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (completed) updateChrome();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function init(_app) {
  const { dom } = _app;
  let { ticker } = _app;
  const { loadCase, setStatus, showDialog, closeDialog, saveInvestigationDraft, renderCurrentView, initNotebook, applySettings, saveSettings, handleInterfaceSound, openNewCaseDialog, handleClick, handleSubmit, handleKeyboard, tick } = _app;
  applySettings();
  initNotebook();
  document.addEventListener("click", handleClick);
  document.addEventListener("pointerdown", handleInterfaceSound, { passive: true });
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleKeyboard);
  document.addEventListener("input", saveInvestigationDraft);
  document.addEventListener("change", saveInvestigationDraft);
  dom.newCaseForm.addEventListener("change", _app.updateCasePreview);
  _app.updateCasePreview();
  document.querySelector("#new-case-button").addEventListener("click", openNewCaseDialog);
  document.querySelector("#help-button").addEventListener("click", () => showDialog(dom.helpDialog));
  dom.settingsButton.addEventListener("click", () => showDialog(dom.settingsDialog));
  document.querySelector("#random-seed").addEventListener("click", () => {
    document.querySelector("#case-seed").value = randomCaseCode();
  });
  const saveSettingsFromForm = () => {
    const formData = new FormData(dom.settingsForm);
    saveSettings({
      theme: String(formData.get("theme") || DEFAULT_SETTINGS.theme),
      clickSounds: formData.get("clickSounds") === "on",
      effectsVolume: Number(formData.get("effectsVolume") || DEFAULT_SETTINGS.effectsVolume),
      holdDuration: Number(formData.get("holdDuration") || DEFAULT_SETTINGS.holdDuration),
    });
  };
  dom.settingsForm.addEventListener("input", (event) => {
    if (!event.target.matches("input[type='range']")) return;
    saveSettingsFromForm();
  });
  dom.settingsForm.addEventListener("change", saveSettingsFromForm);

  [dom.newCaseDialog, dom.detailDialog, dom.helpDialog, dom.settingsDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  if (loadCase()) {
    renderCurrentView();
    setStatus(`Восстановлено дело ${_app.caseData.number}`);
  } else {
    document.querySelector("#case-seed").value = randomCaseCode();
    showDialog(dom.newCaseDialog);
  }
  _app.ticker = ticker = window.setInterval(tick, 1000);
  tick();
}
