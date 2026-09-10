/** Поиск и открытие доступных материалов. Важность отмечает игрок. */
import { escapeHtml, normalize } from '../core/utils.js';
import { materialLabel } from './labels.js';

// Единый фильтр исключает закрытые материалы ещё до отображения; важность задаёт игрок.
export function filterEvidence(items, state, query, filter) {
  const text = normalize(query);
  return items.filter(item => {
    const matchesText = !text || normalize(`${item.title} ${item.excerpt} ${item.content} ${item.tags.join(' ')} ${item.code}`).includes(text);
    const matchesFilter = filter === 'all'
      || (filter === 'important' && state.importantIds.includes(item.id))
      || (filter === 'unread' && !(state.readEvidenceIds || []).includes(item.id))
      || (filter === 'field' && state.field.found.includes(item.id))
      || item.type === filter;
    return matchesText && matchesFilter;
  });
}

// Разметка карточек используется и при открытии раздела, и при изменении поискового запроса.
function evidenceCards(items, state) {
  return items.length ? items.map(item => `<article class="archive-card${state.importantIds.includes(item.id) ? ' is-important' : ''}" role="button" tabindex="0" data-evidence-id="${item.id}">
    <div class="archive-card-head"><span class="file-code">${escapeHtml(item.code)} / ${escapeHtml(materialLabel(item.type))}</span>${state.importantIds.includes(item.id) ? '<span class="important-star" title="Отмечено важным">★</span>' : ''}</div>
    ${!(state.readEvidenceIds || []).includes(item.id) ? '<span class="unread-mark">Не прочитано</span>' : ''}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt)}</p>
    ${item.status ? `<small class="evidence-status">Статус: ${escapeHtml(item.status)}</small>` : ''}<div class="tag-row">${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
  </article>`).join('') : '<div class="empty-results">Ничего не найдено. Попробуйте другой запрос или фильтр.</div>';
}

// Поиск обновляет только результаты: курсор, очистка поля и экранная клавиатура остаются на месте.
export function renderArchive(_app) {
  const { dom, state, archiveQuery, archiveFilter } = _app;
  const items = _app.availableEvidence();
  const filtered = filterEvidence(items, state, archiveQuery, archiveFilter);
  const filters = [['all', 'Все'], ['unread', 'Не прочитано'], ['important', 'Важное'], ['field', 'С выездов'], ['conflict', 'Конфликты'], ['document', 'Документы'], ['log', 'Журналы'], ['forensics', 'Экспертизы'], ['lab', 'Лаборатория']];
  dom.workspace.innerHTML = `<div class="view"><header class="view-header"><div><span class="eyebrow">Источники и свидетельства</span><h2>Материалы дела</h2><p>Ищите по имени, времени или фразе. Откройте документ, отметьте важное и добавьте его на доску связей.</p></div></header>
    <div class="archive-tools"><label class="search-field"><span class="sr-only">Поиск по архиву</span><input id="archive-search" type="search" autocomplete="off" placeholder="Имя, время, номер, фраза…" value="${escapeHtml(archiveQuery)}"></label><div class="filter-group" role="group" aria-label="Фильтр архива">${filters.map(([value, label]) => `<button class="filter-button${archiveFilter === value ? ' is-active' : ''}" type="button" data-archive-filter="${value}" aria-pressed="${archiveFilter === value}">${label}</button>`).join('')}</div></div>
    <div class="archive-meta"><span id="archive-result-count" role="status">Найдено: ${filtered.length}</span><span>Отметка «важно» — ваш выбор</span></div><div class="archive-grid">${evidenceCards(filtered, state)}</div></div>`;
  document.querySelector('#archive-search').addEventListener('input', event => {
    _app.archiveQuery = event.target.value;
    const results = filterEvidence(items, state, _app.archiveQuery, _app.archiveFilter);
    document.querySelector('.archive-grid').innerHTML = evidenceCards(results, state);
    document.querySelector('#archive-result-count').textContent = `Найдено: ${results.length}`;
  });
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function openEvidence(_app, id) {
  const { dom, state } = _app;
  const { getEvidence, isEvidenceUnlocked, showDialog } = _app;
  const item = getEvidence(id);
  if (!item || !isEvidenceUnlocked(item)) return;
  state.readEvidenceIds ||= [];
  if (!state.readEvidenceIds.includes(id)) state.readEvidenceIds.push(id);
  _app.saveCase();
  document.querySelector(`[data-evidence-id="${id}"] .unread-mark`)?.remove();
  const isImportant = state.importantIds.includes(item.id);
  const onBoard = state.boardIds.includes(item.id);
  dom.detailContent.innerHTML = `
    <button class="modal-close" type="button" data-action="close-detail" aria-label="Закрыть">×</button>
    <div class="modal-kicker">${escapeHtml(item.code)} / ${escapeHtml(materialLabel(item.type))}</div>
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
