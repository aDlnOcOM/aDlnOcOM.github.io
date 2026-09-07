/** Ручные аналитические задачи и открытие результатов при верном решении. */
import { escapeHtml, normalize, formatClock } from '../core/utils.js';

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderLab(_app) {
  const { dom, caseData, state } = _app;
  const solved = state.solvedPuzzles.length;
  dom.workspace.innerHTML = `
    <div class="view">
      <header class="view-header">
        <div><span class="eyebrow">Ручная аналитика</span><h2>Лаборатория</h2><p>Разные слои дела требуют разных способов чтения. Ответы не чувствительны к регистру и пробелам.</p></div>
        <div class="lab-progress"><div class="progress-ring">${solved}/${caseData.puzzles.length}</div><span class="micro-label">решено<br>${caseData.difficulty.hint}</span></div>
      </header>
      <div class="puzzle-grid">
        ${caseData.puzzles.map((puzzle, index) => {
          const isSolved = state.solvedPuzzles.includes(puzzle.id);
          return `<article class="puzzle-card${isSolved ? " is-solved" : ""}">
            <span class="puzzle-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="tag ${isSolved ? "tag-success" : "tag-accent"}">${escapeHtml(puzzle.kind)}</span>
            <h3>${escapeHtml(puzzle.title)}</h3>
            <p>${escapeHtml(isSolved ? puzzle.reveal : puzzle.summary)}</p>
            <div class="puzzle-footer">
              ${isSolved ? '<span class="solved-mark"><i>✓</i> вывод зафиксирован</span>' : `<span class="micro-label">улика закрыта</span><button class="button button-ghost button-small" type="button" data-puzzle-id="${puzzle.id}" data-puzzle-kind="${puzzle.kind}">Открыть</button>`}
            </div>
          </article>`;
        }).join("")}
      </div>
      <p class="lab-note">Подсказка отмечается в журнале и немного снижает итоговый рейтинг, но не блокирует идеальное логическое решение.</p>
    </div>
  `;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderPuzzleDetail(_app, puzzle) {
  const { dom, caseData, state } = _app;
  const { showDialog } = _app;
  const hintUsed = state.hintsUsed.includes(puzzle.id);
  const toolOutput = state.toolRuns[puzzle.id] || "";
  let interaction = "";
  if (puzzle.kind === "timeline") {
    interaction = `
      <div class="timeline-sort">
        ${state.timelineOrder.map((eventId, index) => {
          const event = caseData.events.find((item) => item.id === eventId);
          return `<div class="timeline-item"><span>${formatClock(event.minute)}</span><span>${escapeHtml(event.text)}</span><div class="sort-controls"><button type="button" data-timeline-move="up" data-event-id="${eventId}" ${index === 0 ? "disabled" : ""} aria-label="Выше">↑</button><button type="button" data-timeline-move="down" data-event-id="${eventId}" ${index === state.timelineOrder.length - 1 ? "disabled" : ""} aria-label="Ниже">↓</button></div></div>`;
        }).join("")}
      </div>
      <button class="button button-primary" type="button" data-action="check-timeline" data-puzzle="${puzzle.id}">Проверить порядок</button>`;
  } else if (puzzle.choices) {
    interaction = `
      <form class="puzzle-choice-form" data-puzzle-form="${puzzle.id}">
        <div class="choice-list">${puzzle.choices.map((choice, index) => `<label><input type="radio" name="puzzle-answer" value="${index}"><span>${escapeHtml(choice)}</span></label>`).join("")}</div>
        <button class="button button-primary" type="submit">Зафиксировать вывод</button>
      </form>`;
  } else {
    const toolButton = puzzle.kind === "password"
      ? `<button class="button button-ghost button-small" type="button" data-action="run-dictionary" data-puzzle="${puzzle.id}">Словарная проверка</button>`
      : puzzle.kind === "digital"
        ? `<button class="button button-ghost button-small" type="button" data-action="extract-zero" data-puzzle="${puzzle.id}">Извлечь нулевые символы</button>`
        : "";
    interaction = `
      ${toolButton}
      ${toolOutput ? `<div class="tool-output">${escapeHtml(toolOutput).replaceAll("\n", "<br>")}</div>` : ""}
      <form class="answer-form" data-puzzle-form="${puzzle.id}">
        <label class="sr-only" for="answer-${puzzle.id}">Ответ</label>
        <input class="answer-input" id="answer-${puzzle.id}" name="puzzle-answer" autocomplete="off" placeholder="Ваш ответ">
        <button class="button button-primary" type="submit">Проверить</button>
      </form>`;
  }
  const displayBody = puzzle.visibleBody || puzzle.body;
  dom.detailContent.innerHTML = `
    <button class="modal-close" type="button" data-action="close-detail" aria-label="Закрыть">×</button>
    <div class="modal-kicker">${escapeHtml(puzzle.kind)} / аналитическая задача</div>
    <h2>${escapeHtml(puzzle.title)}</h2>
    <div class="document-sheet${["cipher", "password", "digital"].includes(puzzle.kind) ? " is-code" : ""}">${escapeHtml(displayBody)}</div>
    <div class="puzzle-prompt">${escapeHtml(puzzle.prompt)}</div>
    ${interaction}
    <div class="modal-actions">
      ${hintUsed ? "" : `<button class="button button-ghost" type="button" data-action="show-hint" data-puzzle="${puzzle.id}">Взять подсказку</button>`}
      <button class="button button-ghost" type="button" data-action="close-detail">Закрыть</button>
    </div>
    ${hintUsed ? `<div class="hint-box"><b>Подсказка:</b> ${escapeHtml(puzzle.hint)}</div>` : ""}
  `;
  showDialog(dom.detailDialog);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function solvePuzzle(_app, puzzleId, answer) {
  const { dom, caseData, state } = _app;
  const { saveCase, setStatus, toast, closeDialog, renderCurrentView } = _app;
  const puzzle = caseData.puzzles.find((item) => item.id === puzzleId);
  if (!puzzle || state.solvedPuzzles.includes(puzzleId)) return;
  const normalizedAnswer = normalize(answer);
  const isCorrect = (puzzle.accepted || [puzzle.answer]).some((value) => normalize(value) === normalizedAnswer);
  if (!isCorrect) {
    toast("Ответ не сходится с данными. Проверьте метод и попробуйте снова.", true);
    setStatus("Аналитическая гипотеза отклонена");
    return;
  }
  state.solvedPuzzles.push(puzzleId);
  if (!state.importantIds.includes(puzzle.evidenceId)) state.importantIds.push(puzzle.evidenceId);
  saveCase();
  closeDialog(dom.detailDialog);
  toast(`Вывод зафиксирован: ${puzzle.reveal}`);
  setStatus("Новая улика разблокирована в архиве");
  renderCurrentView();
}
