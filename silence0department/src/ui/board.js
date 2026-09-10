/** Доска гипотез: карточки, перемещение, связи и личные заметки. */
import { BOARD_LINK_TYPES } from '../data/catalog.js';
import { escapeHtml, pluralRu } from '../core/utils.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function boardEntity(_app, id) {
  const { state } = _app;
  const { getEvidence, getSuspect } = _app;
  const person = getSuspect(id);
  if (person) {
    return {
      id: person.id,
      title: person.name,
      subtitle: `${person.role} · ${person.relationship}`,
      readingText: `${person.role} · ${person.relationship}`,
      type: "подозреваемый",
      person: true,
    };
  }
  const note = state.boardNotes.find((item) => item.id === id);
  if (note) {
    return {
      id: note.id,
      title: note.title,
      subtitle: note.body,
      readingText: note.body,
      type: "рабочая версия",
      person: false,
      note: true,
    };
  }
  const evidence = getEvidence(id);
  if (!evidence) return null;
  return {
    id: evidence.id,
    title: evidence.title,
    subtitle: evidence.excerpt,
    readingText: evidence.content,
    type: evidence.tags[0] || evidence.type,
    important: state.importantIds.includes(evidence.id),
    person: false,
  };
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function isBoardNote(_app, id) {
  const { state } = _app;
  return state.boardNotes.some((item) => item.id === id);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function boardLink(_app, link) {

  if (Array.isArray(link)) return { from: link[0], to: link[1], kind: "связь", note: "" };
  return {
    from: link?.from || "",
    to: link?.to || "",
    kind: link?.kind || "связь",
    note: link?.note || "",
  };
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderBoard(_app) {
  const { dom, state, appSettings } = _app;
  const { boardEntity, isBoardNote, scheduleBoardLines, enableBoardDragging } = _app;
  const entities = state.boardIds.map(boardEntity).filter(Boolean);
  const canDeleteSelectedNote = state.boardSelected.length === 1 && isBoardNote(state.boardSelected[0]);
  const selectionText = state.boardSelected.length === 0
    ? "Выберите две карточки, чтобы провести связь"
    : state.boardSelected.length === 1
      ? "Выберите вторую карточку"
      : "Связь готова к фиксации";
  dom.workspace.innerHTML = `
    <div class="view view-wide">
      <header class="view-header">
        <div><span class="eyebrow">Рабочие гипотезы</span><h2>Доска связей</h2><p>Выберите карточку и нажмите «Прочитать». Выберите две, чтобы провести связь. Карточки можно перетаскивать; удержание ${appSettings.holdDuration / 1000} с открывает быстрый просмотр.</p></div>
        <div class="view-actions">
          <button class="button button-ghost button-small" type="button" data-action="open-board-card" ${state.boardSelected.length === 1 ? "" : "disabled"}>Прочитать</button>
          <button class="button button-ghost button-small" type="button" data-action="open-board-note">Добавить мысль</button>
          <button class="button button-ghost button-small" type="button" data-action="delete-board-note" ${canDeleteSelectedNote ? "" : "disabled"}>Убрать мысль</button>
          <button class="button button-ghost button-small" type="button" data-action="clear-board-links" ${state.boardLinks.length ? "" : "disabled"}>Очистить связи</button>
          <button class="button button-primary button-small" type="button" data-action="connect-board" ${state.boardSelected.length === 2 ? "" : "disabled"}>Связать</button>
        </div>
      </header>
      <div class="board-toolbar">
        <p class="board-selection">${escapeHtml(selectionText)}</p>
        <div class="board-logic-controls">
          <label for="board-link-kind">Связь<select id="board-link-kind">${BOARD_LINK_TYPES.map((kind) => `<option value="${escapeHtml(kind)}">${escapeHtml(kind)}</option>`).join("")}</select></label>
          <label for="board-link-note">Проверка<input id="board-link-note" maxlength="80" placeholder="Почему вы так считаете?" autocomplete="off" /></label>
        </div>
        <p>${entities.length} ${pluralRu(entities.length, "карточка", "карточки", "карточек")} · ${state.boardLinks.length} ${pluralRu(state.boardLinks.length, "связь", "связи", "связей")}</p>
      </div>
      <div class="board-scroll" tabindex="0" role="region" aria-label="Доска связей · прокрутка по горизонтали"><div class="board" id="case-board">
        <svg class="board-lines" id="board-lines" aria-hidden="true"></svg>
        ${entities.map((entity) => {
          const position = state.boardPositions[entity.id] || { x: 30, y: 30 };
          const classes = ["board-node", entity.person ? "is-person" : "", entity.important ? "is-important" : "", entity.note ? "is-note" : "", state.boardSelected.includes(entity.id) ? "is-selected" : ""].filter(Boolean).join(" ");
          return `<button class="${classes}" type="button" data-board-id="${escapeHtml(entity.id)}" style="left:${position.x}px;top:${position.y}px">
            <span class="node-type">${escapeHtml(entity.type)}</span>
            <strong>${escapeHtml(entity.title)}</strong>
            <small>${escapeHtml(entity.subtitle)}</small>
            <span class="board-reading-body">${escapeHtml(entity.readingText)}</span>
          </button>`;
        }).join("")}
        ${entities.length ? "" : '<div class="empty-board-hint">Добавляйте материалы из архива</div>'}
      </div></div>
    </div>
  `;
  scheduleBoardLines();
  enableBoardDragging();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function scheduleBoardLines(_app) {
  let { boardLineFrame } = _app;
  const { drawBoardLines } = _app;
  if (boardLineFrame) return;
  _app.boardLineFrame = boardLineFrame = window.requestAnimationFrame(() => {
    _app.boardLineFrame = boardLineFrame = 0;
    drawBoardLines();
  });
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function drawBoardLines(_app) {
  const { state } = _app;
  const { boardLink } = _app;
  const board = document.querySelector("#case-board");
  const svg = document.querySelector("#board-lines");
  if (!board || !svg) return;
  const boardRect = board.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${board.clientWidth} ${board.clientHeight}`);
  svg.innerHTML = state.boardLinks.map((savedLink) => {
    const link = boardLink(savedLink);
    const fromNode = board.querySelector(`[data-board-id="${CSS.escape(link.from)}"]`);
    const toNode = board.querySelector(`[data-board-id="${CSS.escape(link.to)}"]`);
    if (!fromNode || !toNode) return "";
    const first = fromNode.getBoundingClientRect();
    const second = toNode.getBoundingClientRect();
    const x1 = first.left - boardRect.left + first.width / 2;
    const y1 = first.top - boardRect.top + first.height / 2;
    const x2 = second.left - boardRect.left + second.width / 2;
    const y2 = second.top - boardRect.top + second.height / 2;
    const labelX = (x1 + x2) / 2;
    const labelY = (y1 + y2) / 2 - 5;
    const title = link.note ? `${link.kind}: ${link.note}` : link.kind;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line><circle cx="${x1}" cy="${y1}" r="2.2"></circle><circle cx="${x2}" cy="${y2}" r="2.2"></circle><text x="${labelX}" y="${labelY}"><title>${escapeHtml(title)}</title>${escapeHtml(link.kind)}</text>`;
  }).join("");
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function enableBoardDragging(_app) {
  const { state, appSettings } = _app;
  let { suppressBoardClickUntil } = _app;
  const { saveCase, scheduleBoardLines } = _app;
  const board = document.querySelector("#case-board");
  if (!board) return;
  board.querySelectorAll(".board-node").forEach((node) => {
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const boardRect = board.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const offsetX = event.clientX - nodeRect.left;
      const offsetY = event.clientY - nodeRect.top;
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let dragging = false;
      let reading = false;
      node.setPointerCapture(event.pointerId);
      node.classList.add("is-reading-pending");

      const openForReading = () => {
        if (dragging || moved) return;
        const startRect = node.getBoundingClientRect();
        reading = true;
        node.classList.remove("is-reading-pending");
        node.classList.add("is-reading");
        board.classList.add("is-reading");
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.requestAnimationFrame(() => {
            const endRect = node.getBoundingClientRect();
            const shiftX = startRect.left - endRect.left;
            const shiftY = startRect.top - endRect.top;
            const scaleX = startRect.width / endRect.width;
            const scaleY = startRect.height / endRect.height;
            node.animate(
              [
                { transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px)) scale(${scaleX}, ${scaleY})`, opacity: 0.72 },
                { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
              ],
              { duration: 460, easing: "cubic-bezier(0.22, 0.85, 0.26, 1)", fill: "none" },
            );
          });
        }
        _app.suppressBoardClickUntil = suppressBoardClickUntil = performance.now() + 260;
      };
      const holdTimer = window.setTimeout(openForReading, appSettings.holdDuration);

      const cancelReadingHold = () => {
        window.clearTimeout(holdTimer);
        node.classList.remove("is-reading-pending");
      };

      const move = (moveEvent) => {
        if (reading) return;
        const movedFromStart = Math.abs(moveEvent.clientX - startX) > 6 || Math.abs(moveEvent.clientY - startY) > 6;
        if (!dragging && !movedFromStart) return;
        if (!dragging) {
          dragging = true;
          cancelReadingHold();
          node.classList.add("is-dragging");
        }
        const nextX = Math.max(5, Math.min(board.clientWidth - node.offsetWidth - 5, moveEvent.clientX - boardRect.left - offsetX));
        const nextY = Math.max(5, Math.min(board.clientHeight - node.offsetHeight - 5, moveEvent.clientY - boardRect.top - offsetY));
        moved ||= Math.abs(nextX - parseFloat(node.style.left)) > 2 || Math.abs(nextY - parseFloat(node.style.top)) > 2;
        node.style.left = `${nextX}px`;
        node.style.top = `${nextY}px`;
        state.boardPositions[node.dataset.boardId] = { x: Math.round(nextX), y: Math.round(nextY) };
        scheduleBoardLines();
      };

      const finish = () => {
        cancelReadingHold();
        if (reading) {
          node.classList.remove("is-reading");
          board.classList.remove("is-reading");
          _app.suppressBoardClickUntil = suppressBoardClickUntil = performance.now() + 260;
        }
        node.classList.remove("is-dragging");
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", finish);
        node.removeEventListener("pointercancel", finish);
        if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
        if (moved) _app.suppressBoardClickUntil = suppressBoardClickUntil = performance.now() + 180;
        if (moved) {
          scheduleBoardLines();
          saveCase();
        }
      };

      node.addEventListener("pointermove", move);
      node.addEventListener("pointerup", finish);
      node.addEventListener("pointercancel", finish);
    });
  });
}


// Синхронизирует связанный блок интерфейса с сохранённым прогрессом.
export function updateBoardSelectionUi(_app) {
  const { state } = _app;
  const { saveCase, isBoardNote } = _app;
  const board = document.querySelector("#case-board");
  if (!board) return;
  board.querySelectorAll("[data-board-id]").forEach((node) => {
    node.classList.toggle("is-selected", state.boardSelected.includes(node.dataset.boardId));
  });
  const message = document.querySelector(".board-selection");
  if (message) {
    message.textContent = state.boardSelected.length === 0
      ? "Выберите две карточки, чтобы провести связь"
      : state.boardSelected.length === 1
        ? "Выберите вторую карточку"
        : "Связь готова к фиксации";
  }
  const read = document.querySelector('[data-action="open-board-card"]');
  if (read) read.disabled = state.boardSelected.length !== 1;
  const connect = document.querySelector('[data-action="connect-board"]');
  if (connect) connect.disabled = state.boardSelected.length !== 2;
  const deleteNote = document.querySelector('[data-action="delete-board-note"]');
  if (deleteNote) deleteNote.disabled = state.boardSelected.length !== 1 || !isBoardNote(state.boardSelected[0]);
  saveCase();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function openBoardNoteDialog(_app) {
  const { dom } = _app;
  const { showDialog } = _app;
  dom.detailContent.innerHTML = `
    <button class="modal-close" type="button" data-action="close-detail" aria-label="Закрыть">×</button>
    <div class="modal-kicker">Ручная заметка</div>
    <h2>Рабочая версия</h2>
    <p>Это не доказательство и не готовый вывод. Сформулируйте проверяемую мысль, а затем свяжите её с материалами на доске.</p>
    <form id="board-note-form" class="board-note-form">
      <label class="field-label" for="board-note-title">Короткий заголовок</label>
      <input class="field-input" id="board-note-title" name="title" maxlength="70" required placeholder="Например, доступ не равен присутствию" autocomplete="off" />
      <label class="field-label" for="board-note-body">Основание для проверки</label>
      <textarea id="board-note-body" name="body" maxlength="600" required placeholder="Какие факты поддерживают версию, а что ещё нужно проверить?"></textarea>
      <div class="modal-actions"><button class="button button-primary" type="submit">Поместить на доску</button></div>
    </form>
  `;
  showDialog(dom.detailDialog);
}

// Доступное открытие карточки без удержания мыши или пальца.
export function openBoardCard(_app) {
  const id = _app.state.boardSelected.length === 1 ? _app.state.boardSelected[0] : null;
  if (!id) return;
  if (_app.getEvidence(id)) { _app.openEvidence(id); return; }
  const entity = _app.boardEntity(id);
  if (!entity) return;
  _app.dom.detailContent.innerHTML = `<button class="modal-close" data-action="close-detail" aria-label="Закрыть">×</button><span class="eyebrow">Карточка на доске</span><h2>${escapeHtml(entity.title)}</h2><p>${escapeHtml(entity.subtitle)}</p><div class="document-sheet">${escapeHtml(entity.readingText)}</div>`;
  _app.showDialog(_app.dom.detailDialog);
}
