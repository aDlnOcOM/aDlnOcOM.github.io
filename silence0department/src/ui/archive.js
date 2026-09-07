/** Поиск и открытие доступных материалов. Важность отмечает игрок. */
import { escapeHtml, normalize } from '../core/utils.js';

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderArchive(_app) {
  const { dom, state, archiveFilter } = _app;
  let { archiveQuery } = _app;
  const { availableEvidence, renderArchive } = _app;
  const unlocked = availableEvidence();
  const query = normalize(archiveQuery);
  const filtered = unlocked.filter((item) => {
    const matchesQuery = !query || normalize(`${item.title} ${item.excerpt} ${item.content} ${item.tags.join(" ")} ${item.code}`).includes(query);
    const matchesFilter = archiveFilter === "all"
      || (archiveFilter === "important" && state.importantIds.includes(item.id))
      || (archiveFilter === "relevant" && item.relevant)
      || item.type === archiveFilter;
    return matchesQuery && matchesFilter;
  });
  dom.workspace.innerHTML = `
    <div class="view">
      <header class="view-header">
        <div><span class="eyebrow">Материалы дела</span><h2>Архив</h2><p>Поиск работает по содержимому, меткам и фрагментам. Большая часть совпадений может не иметь отношения к делу.</p></div>
      </header>
      <div class="archive-tools">
        <label class="search-field"><span class="sr-only">Поиск по архиву</span><input id="archive-search" type="search" autocomplete="off" placeholder="Имя, время, номер, фраза…" value="${escapeHtml(archiveQuery)}"></label>
        <div class="filter-group" role="group" aria-label="Фильтр архива">
          ${[
            ["all", "Все"], ["important", "Важное"], ["conflict", "Конфликты"], ["document", "Документы"], ["log", "Логи"], ["forensics", "Форензика"], ["lab", "Лаборатория"],
          ].map(([value, label]) => `<button class="filter-button${archiveFilter === value ? " is-active" : ""}" type="button" data-archive-filter="${value}">${label}</button>`).join("")}
        </div>
      </div>
      <div class="archive-meta"><span>Найдено: ${filtered.length}</span><span>Шум не помечается системой</span></div>
      <div class="archive-grid">
        ${filtered.length ? filtered.map((item) => `
            <article class="archive-card${state.importantIds.includes(item.id) ? " is-important" : ""}" role="button" tabindex="0" data-evidence-id="${item.id}">
            <div class="archive-card-head"><span class="file-code">${escapeHtml(item.code)} / ${escapeHtml(item.type)}</span>${state.importantIds.includes(item.id) ? '<span class="important-star" title="Отмечено важным">★</span>' : ""}</div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.excerpt)}</p>
            ${item.status ? `<small class="evidence-status">Статус: ${escapeHtml(item.status)}</small>` : ""}
            <div class="tag-row">${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          </article>`).join("") : '<div class="empty-results">Ничего не найдено. Попробуйте менее точный запрос.</div>'}
      </div>
    </div>
  `;
  const search = document.querySelector("#archive-search");
  search?.addEventListener("input", (event) => {
    _app.archiveQuery = archiveQuery = event.target.value;
    const selection = event.target.selectionStart;
    renderArchive();
    const next = document.querySelector("#archive-search");
    next?.focus();
    next?.setSelectionRange(selection, selection);
  });
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function openEvidence(_app, id) {
  const { dom, state } = _app;
  const { getEvidence, isEvidenceUnlocked, showDialog } = _app;
  const item = getEvidence(id);
  if (!item || !isEvidenceUnlocked(item)) return;
  const isImportant = state.importantIds.includes(item.id);
  const onBoard = state.boardIds.includes(item.id);
  dom.detailContent.innerHTML = `
    <button class="modal-close" type="button" data-action="close-detail" aria-label="Закрыть">×</button>
    <div class="modal-kicker">${escapeHtml(item.code)} / ${escapeHtml(item.type)}</div>
    <h2>${escapeHtml(item.title)}</h2>
    <div class="detail-meta">${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    ${(item.status || item.reliability) ? `<div class="evidence-provenance"><div><span>Статус вывода</span><b>${escapeHtml(item.status || "не классифицирован")}</b></div><div><span>Надёжность</span><b>${escapeHtml(item.reliability || "зависит от источника")}</b></div></div>` : ""}
    <div class="document-sheet${["log", "digital", "crypto"].includes(item.type) ? " is-code" : ""}">${escapeHtml(item.content)}</div>
    <div class="modal-actions">
      <button class="button button-ghost" type="button" data-action="toggle-important" data-evidence="${item.id}">${isImportant ? "Снять отметку" : "Отметить важным"}</button>
      <button class="button button-primary" type="button" data-action="add-to-board" data-evidence="${item.id}" ${onBoard ? "disabled" : ""}>${onBoard ? "На доске" : "На доску"}</button>
    </div>
  `;
  showDialog(dom.detailDialog);
}
