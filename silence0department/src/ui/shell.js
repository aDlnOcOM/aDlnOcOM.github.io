/** Навигация, сводка и постоянные индикаторы. Рендер не меняет игровые правила. */
import { VIEW_ORDER } from '../data/catalog.js';
import { escapeHtml, formatClock, formatDuration } from '../core/utils.js';
import detective from '../domain/engine.js';

// Синхронизирует связанный блок интерфейса с сохранённым прогрессом.
export function updateThreatChrome(_app) {
  const { caseData, state } = _app;
  const element = document.querySelector("#threat-status");
  if (!element || !caseData) return;
  const info = detective.threat(caseData, state, state.outcome?.at || Date.now());
  element.hidden = !info.active;
  if (!info.active) return;
  element.classList.toggle("is-critical", info.exposure >= 70 || info.remaining < 300000);
  const label = state.outcome ? (state.outcome.kind === "solved" ? "Охота остановлена" : "Связь потеряна") : "Встречная охота";
  element.innerHTML = `<span class="eyebrow">${label}</span><strong>${state.outcome ? "Дело окончено" : formatDuration(info.remaining)}</strong><span>Заметность ${info.exposure}/100</span><meter min="0" max="100" value="${info.exposure}" aria-label="Заметность"></meter><small>Срок и заметность — два отдельных риска.</small>`;
}


// Синхронизирует связанный блок интерфейса с сохранённым прогрессом.
export function updateChrome(_app) {
  const { dom, caseData, state } = _app;
  const { availableEvidence, updateThreatChrome, readinessScore } = _app;
  if (!caseData || !state) return;
  const solved = state.solvedPuzzles.length;
  const asked = Object.values(state.askedQuestions).flat().length;
  const activeTask = Object.values(state.tasks).some((task) => task.status === "running");
  const unreadComputer = ["computer-mail", "computer-meta"].some((find) => !state.computer.finds.includes(find));
  const progress = readinessScore();

  dom.caseHeading.innerHTML = `
    <span class="eyebrow">${escapeHtml(caseData.number)} · ${escapeHtml(caseData.difficulty.label)}</span>
    <h1>${escapeHtml(caseData.title)}</h1>
  `;
  dom.sidebarBrief.innerHTML = `
    <span class="eyebrow">Готовность версии</span>
      <p><strong>${progress}%</strong> · полевых материалов ${state.field.found.length}; аналитика ${solved}/${caseData.puzzles.length}.</p>
    <div class="sidebar-progress"><i style="width:${progress}%"></i></div>
  `;
  dom.boardCount.textContent = String(state.boardIds.length);
  dom.archiveCount.textContent = String(availableEvidence().length);
  dom.puzzleCount.textContent = `${solved}/${caseData.puzzles.length}`;
  dom.taskIndicator.hidden = !activeTask;
  dom.computerIndicator.hidden = !unreadComputer;
  updateThreatChrome();
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderCurrentView(_app) {
  const { caseData, state } = _app;
  const { saveCase, renderField, renderInterviews, renderOutcome, renderReport, updateChrome, renderOverview, renderTutorialUi, renderBoard, renderArchive, renderComputer, renderLab, renderAnalysis } = _app;
  if (!caseData || !state) return;
  const renderers = {
    overview: renderOverview,
    board: renderBoard,
    archive: renderArchive,
    computer: renderComputer,
    interviews: renderInterviews,
    lab: renderLab,
    analysis: renderAnalysis,
    report: renderReport,
    field: renderField,
  };
  updateChrome();
  if (state.outcome?.kind === "dead") renderOutcome();
  else renderers[state.view]?.();
  saveCase();
  renderTutorialUi();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function navigate(_app, view) {
  const { dom, caseData, state } = _app;
  const { setStatus, renderCurrentView, advanceTutorial, shouldAdvanceTutorialForNavigation } = _app;
  if (!caseData || !VIEW_ORDER.includes(view)) return;
  if (shouldAdvanceTutorialForNavigation(view)) {
    advanceTutorial();
    return;
  }
  state.view = view;
  state.boardSelected = [];
  renderCurrentView();
  dom.workspace.scrollTop = 0;
  setStatus(`Открыт раздел: ${document.querySelector(`[data-view="${view}"] span:nth-child(2)`)?.textContent || view}`);
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderOverview(_app) {
  const { dom, caseData, state } = _app;
  const { availableEvidence } = _app;
  const solved = state.solvedPuzzles.length;
  const asked = Object.values(state.askedQuestions).flat().length;
  const tasksDone = Object.values(state.tasks).filter((task) => task.status === "done").length;
  const objectives = [
    { done: solved >= 1, text: "Получить первую проверяемую связь" },
    { done: asked >= 3, text: "Собрать показания для независимой проверки" },
    { done: tasksDone >= 1, text: "Делегировать массив рутинных данных" },
  ];
  dom.workspace.innerHTML = `
    <div class="view">
      <header class="view-header">
        <div>
          <span class="eyebrow">Оперативная сводка</span>
          <h2>${escapeHtml(caseData.title)}</h2>
          <p>${escapeHtml(caseData.circumstance)}</p>
        </div>
        <div class="tag-row">
          <span class="tag tag-accent">${escapeHtml(caseData.sector)}</span>
          <span class="tag">код ${escapeHtml(caseData.seed)}</span>
        </div>
      </header>

      <section class="field-entry"><div><span class="eyebrow">Следующий шаг · частное расследование</span><h3>Выйдите из-за стола</h3><p>${state.field.found.length ? `Полевых материалов: ${state.field.found.length}. Продолжайте проверку источников.` : "На месте остались детали, которых нет в первичном протоколе."}</p></div><button class="button button-primary" data-view="field">Выехать на место</button></section>
      <div class="case-lead">
        <article class="briefing-card">
          <span class="briefing-number">${escapeHtml(caseData.archetype.label)} / ${escapeHtml(caseData.number)}</span>
          <blockquote>«${escapeHtml(caseData.mandateText)}»</blockquote>
          <span class="briefing-sign">Поручение ${caseData.commissioner.gender === "female" ? "передала" : "передал"}: ${escapeHtml(caseData.commissioner.name)}, ${escapeHtml(caseData.commissioner.role)} · ${escapeHtml(caseData.commissioner.organization)}</span>
        </article>
        <div class="briefing-facts">
          <div class="fact-row"><span>${escapeHtml(caseData.archetype.targetLabel)}</span><strong>${escapeHtml(caseData.victim.name)}<br>${escapeHtml(caseData.victim.role)}</strong></div>
          <div class="fact-row"><span>Адрес</span><strong>${escapeHtml(caseData.incidentAddress)}</strong></div>
          <div class="fact-row"><span>Окно</span><strong>${formatClock(caseData.incidentMinute - 8)}–${formatClock(caseData.incidentMinute + 9)}</strong></div>
          <div class="fact-row"><span>Видимость</span><strong>${escapeHtml(caseData.apparentMethod)}</strong></div>
          <div class="fact-row"><span>Маршрут</span><strong>${escapeHtml(caseData.discoveryRoute.label)}</strong></div>
        </div>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><span>Подозреваемые</span><strong>${caseData.suspects.length}</strong><small>легенды сформированы</small></article>
        <article class="stat-card"><span>Архив</span><strong>${availableEvidence().length}</strong><small>из ${caseData.evidence.length} записей доступно</small></article>
        <article class="stat-card"><span>Аналитика</span><strong>${solved}/${caseData.puzzles.length}</strong><small>задач решено</small></article>
        <article class="stat-card"><span>Допросы</span><strong>${asked}</strong><small>вопросов задано</small></article>
      </div>

      <section class="panel objective-panel">
        <span class="micro-label">Ближайшие ориентиры</span>
        <div class="objective-list">
          ${objectives.map((item, index) => `
            <div class="objective${item.done ? " is-done" : ""}">
              <i>${item.done ? "✓" : index + 1}</i><span>${escapeHtml(item.text)}</span>
            </div>`).join("")}
        </div>
      </section>
      <section class="panel world-panel">
        <span class="micro-label">Контекст поручения</span>
        <div class="world-grid">
          <div><span>Практический интерес</span><b>${escapeHtml(caseData.commissioner.interest)}</b></div>
          <div><span>Вероятное предубеждение</span><b>${escapeHtml(caseData.commissioner.bias)}</b></div>
          <div><span>Ограничение</span><b>${escapeHtml(caseData.commissioner.constraint)}</b></div>
          <div><span>Основной вопрос</span><b>${escapeHtml(caseData.archetype.objective)}</b></div>
        </div>
      </section>
      <section class="panel world-panel">
        <span class="micro-label">Рабочая группа и лаборатории</span>
        <div class="world-grid">
          ${caseData.supportStaff.map((person) => `<div><span>${escapeHtml(person.role)}</span><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.specialty)}</small></div>`).join("")}
        </div>
        <p class="fine-print">Эксперты расширяют архив и выполняют отдельные проверки. Их заключения описывают метод и границы данных, но не назначают виновного.</p>
      </section>
      ${caseData.conflictChains.length ? `<section class="panel condition-panel">
        <span class="micro-label">Особые развилки этого дела</span>
        <div class="condition-grid">
          <div><b>${caseData.conflictChains.length}</b><span>${caseData.conflictChains.length === 1 ? "реальная конфликтная цепочка может" : "реальные конфликтные цепочки могут"} объяснить ложь, не объясняя основное событие</span></div>
          <div><b>3</b><span>слоя нужно разделить: причина, сознательная маскировка и случайное обстоятельство</span></div>
          <div><b>1</b><span>кажущийся мотив «${escapeHtml(caseData.apparentMotive)}» конкурирует с фактическим</span></div>
        </div>
      </section>` : ""}
    </div>
  `;
}
