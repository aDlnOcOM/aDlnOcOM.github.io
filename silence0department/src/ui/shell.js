/** Навигация, сводка и постоянные индикаторы. Рендер не меняет игровые правила. */
import { VIEW_ORDER } from '../data/catalog.js';
import { escapeHtml, formatClock, formatDuration } from '../core/utils.js';
import { nextStep, icon } from './experience.js';
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
    <span class="eyebrow">Ход расследования</span>
      <p><strong>${progress}%</strong> · полевых материалов ${state.field.found.length}; аналитика ${solved}/${caseData.puzzles.length}.</p>
    <div class="sidebar-progress"><i style="width:${progress}%"></i></div>
  `;
  dom.boardCount.textContent = String(state.boardIds.length);
  dom.archiveCount.textContent = String(availableEvidence().length);
  dom.puzzleCount.textContent = `${solved}/${caseData.puzzles.length}`;
  dom.taskIndicator.hidden = !activeTask;
  dom.computerIndicator.hidden = !unreadComputer;
  updateThreatChrome();
  const more = document.querySelector('#menu-button');
  more?.classList.toggle('is-active', !['overview', 'field', 'archive'].includes(state.view));
  document.querySelectorAll(".nav-item, .mobile-nav [data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
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
  dom.workspace.focus({ preventScroll: true });
  setStatus(`Открыт раздел: ${document.querySelector(`[data-view="${view}"] span:nth-child(2)`)?.textContent || view}`);
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderOverview(_app) {
  const { dom, caseData: data, state } = _app;
  const step = nextStep(data, state);
  const asked = Object.values(state.askedQuestions).flat().length;
  const shortcuts = [
    ['field', 'На месте', `${state.field.checked.length} точек обследовано`, 'Ищите следы и новые адреса'],
    ['interviews', 'Беседы', `${asked} вопросов задано`, 'Узнайте, что скрывают люди'],
    ['archive', 'Материалы', `${_app.availableEvidence().length} записей доступно`, 'Читайте, ищите, отмечайте'],
    ['analysis', 'Кира на связи', 'Ваш ассистент', 'Обсудите версию и поручите проверку'],
  ];
  dom.workspace.innerHTML = `<div class="view overview-view">
    <header class="view-header"><div><span class="eyebrow">Частное расследование / ${escapeHtml(data.number)}</span><h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.circumstance)}</p></div><span class="tag">${escapeHtml(data.sector)}</span></header>
    <section class="next-step" aria-label="Следующий шаг"><div class="next-step-icon">${icon(step.view)}</div><div><span class="eyebrow">${state.outcome ? 'Итог дела' : 'Можно продолжить здесь'}</span><h3>${step.title}</h3><p>${step.text}</p></div><button class="button button-primary" data-view="${step.view}">${step.action} <span aria-hidden="true">↗</span></button></section>
    <section class="case-brief panel"><div class="brief-story"><span class="eyebrow">Поручение клиента</span><blockquote>«${escapeHtml(data.mandateText)}»</blockquote><div class="client-sign"><span class="client-avatar">${escapeHtml(data.commissioner.name.charAt(0))}</span><span><b>${escapeHtml(data.commissioner.name)}</b><small>${escapeHtml(data.commissioner.role)} · ${escapeHtml(data.commissioner.organization)}</small></span></div></div><dl class="brief-facts"><div><dt>${escapeHtml(data.archetype.targetLabel)}</dt><dd>${escapeHtml(data.victim.name)}<small>${escapeHtml(data.victim.role)}</small></dd></div><div><dt>Место события</dt><dd>${escapeHtml(data.incidentAddress)}</dd></div><div><dt>Время события</dt><dd>${formatClock(data.incidentMinute - 8)}–${formatClock(data.incidentMinute + 9)}</dd></div><div><dt>Первое впечатление · требует проверки</dt><dd>${escapeHtml(data.apparentMethod)}</dd></div></dl></section>
    <div class="section-heading"><h3>Зацепка начинается с вопроса</h3><span>Вы выбираете порядок</span></div>
    <div class="shortcut-grid">${shortcuts.map(([view, title, count, text]) => `<button class="shortcut-card" data-view="${view}"><span class="shortcut-icon">${icon(view)}</span><strong>${title}<span aria-hidden="true">↗</span></strong><p>${text}</p><small>${count}</small></button>`).join('')}</div>
    <details class="panel context-details"><summary>Заказчик, ограничения и рабочая группа <span>Контекст дела</span></summary><div class="world-grid"><div><span>Интерес клиента</span><b>${escapeHtml(data.commissioner.interest)}</b></div><div><span>Возможное предубеждение</span><b>${escapeHtml(data.commissioner.bias)}</b></div><div><span>Ограничения</span><b>${escapeHtml(data.commissioner.constraint)}</b></div><div><span>Главный вопрос</span><b>${escapeHtml(data.archetype.objective)}</b></div>${data.supportStaff.map(person => `<div><span>${escapeHtml(person.role)}</span><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.specialty)}</small></div>`).join('')}</div></details>
    <p class="overview-foot">${data.profile.timed ? 'Встречная охота активна. Время идёт даже после закрытия страницы.' : 'В своём темпе. В этом деле нет ограничения по времени.'} Прогресс сохраняется автоматически. <span>Код дела: ${escapeHtml(data.seed)}</span></p>
  </div>`;
}
