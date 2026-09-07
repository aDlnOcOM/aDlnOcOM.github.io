/** Личный блокнот живёт отдельно от дела и не сбрасывается при новой генерации. */
import { STORAGE } from '../data/catalog.js';
import { escapeHtml } from '../core/utils.js';

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderChecklist(_app) {
  const { dom } = _app;
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(STORAGE.checklist)) || [];
  } catch {
    items = [];
  }
  dom.checklist.innerHTML = items.length
    ? items.map((item) => `<li class="${item.done ? "is-done" : ""}" data-check-id="${item.id}"><input type="checkbox" ${item.done ? "checked" : ""} aria-label="Выполнено"><span>${escapeHtml(item.text)}</span><button type="button" class="checklist-delete" aria-label="Удалить">×</button></li>`).join("")
    : "<li><span></span><span>Список пуст. Добавьте то, что нельзя забыть.</span></li>";
}


// Возвращает текущие данные без изменения хода расследования.
export function getChecklistItems(_app) {

  try {
    return JSON.parse(localStorage.getItem(STORAGE.checklist)) || [];
  } catch {
    return [];
  }
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function setChecklistItems(_app, items) {
  const { renderChecklist } = _app;
  localStorage.setItem(STORAGE.checklist, JSON.stringify(items));
  renderChecklist();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function saveNotesSoon(_app) {
  const { dom } = _app;
  let { noteSaveTimer } = _app;
  dom.noteSaveState.textContent = "сохранение…";
  window.clearTimeout(noteSaveTimer);
  _app.noteSaveTimer = noteSaveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE.notes, dom.notes.value);
    localStorage.setItem(STORAGE.quotes, dom.quotes.value);
    dom.noteSaveState.textContent = "сохранено";
  }, 280);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function initNotebook(_app) {
  const { dom } = _app;
  const { renderChecklist, getChecklistItems, setChecklistItems, saveNotesSoon } = _app;
  dom.notes.value = localStorage.getItem(STORAGE.notes) || "";
  dom.quotes.value = localStorage.getItem(STORAGE.quotes) || "";
  dom.notes.addEventListener("input", saveNotesSoon);
  dom.quotes.addEventListener("input", saveNotesSoon);
  document.querySelectorAll("[data-note-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-note-tab]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".notebook-page").forEach((page) => { page.hidden = true; });
      document.querySelector(`#${button.dataset.noteTab}-page`).hidden = false;
    });
  });
  dom.checklistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#checklist-input");
    const text = input.value.trim();
    if (!text) return;
    const items = getChecklistItems();
    items.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, done: false });
    setChecklistItems(items);
    input.value = "";
  });
  dom.checklist.addEventListener("change", (event) => {
    const row = event.target.closest("[data-check-id]");
    if (!row) return;
    const items = getChecklistItems();
    const item = items.find((entry) => entry.id === row.dataset.checkId);
    if (item) item.done = event.target.checked;
    setChecklistItems(items);
  });
  dom.checklist.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".checklist-delete");
    if (!deleteButton) return;
    const row = deleteButton.closest("[data-check-id]");
    setChecklistItems(getChecklistItems().filter((item) => item.id !== row.dataset.checkId));
  });
  renderChecklist();
}
