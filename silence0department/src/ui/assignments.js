/** Фоновые поручения Кире. Завершение вычисляется по сохранённому абсолютному времени. */
import { escapeHtml, formatDuration } from '../core/utils.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function taskStatus(_app, task) {
  const { state } = _app;
  const saved = state.tasks[task.id];
  if (!saved) return { status: "idle", remaining: task.duration * 1000, percent: 0 };
  if (saved.status === "done" || saved.finishAt <= Date.now()) return { status: "done", remaining: 0, percent: 100 };
  const duration = task.duration * 1000;
  const remaining = saved.finishAt - Date.now();
  return { status: "running", remaining, percent: Math.max(0, Math.min(100, 100 - (remaining / duration) * 100)) };
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderAnalysis(_app) {
  const { dom, caseData } = _app;
  const { renderAssistantChat, taskStatus } = _app;
  const anyRunning = caseData.tasks.some((task) => taskStatus(task).status === "running");
  const doneCount = caseData.tasks.filter((task) => taskStatus(task).status === "done").length;
  dom.workspace.innerHTML = `
    <div class="view">
      <header class="view-header"><div><span class="eyebrow">На связи с бюро</span><h2>Кира · ваш ассистент</h2><p>Обсуждайте людей, улики и следующие шаги. Кира отвечает по доступным материалам дела.</p></div></header>
      <div class="assistant-layout">${renderAssistantChat()}<aside class="assistant-jobs"><h3>Поручения Кире</h3><p>Одна проверка за раз. Работайте дальше — результат появится в материалах.</p>
      <div class="task-list">
        ${caseData.tasks.map((task, index) => {
          const info = taskStatus(task);
          let statusContent = `<button class="button button-primary button-small" type="button" data-task-id="${task.id}" ${anyRunning ? "disabled" : ""}>Передать · ${task.duration} с</button>`;
          if (info.status === "running") statusContent = `<span class="task-countdown" data-task-countdown="${task.id}">${formatDuration(info.remaining)}</span><small class="micro-label">обработка</small><div class="task-progress"><i data-task-progress="${task.id}" style="width:${info.percent}%"></i></div>`;
          if (info.status === "done") statusContent = `<span class="solved-mark"><i>✓</i> готово</span><br><button class="button button-ghost button-small" type="button" data-evidence-id="${task.evidenceId}">Открыть вывод</button>`;
          return `<article class="task-card"><i class="task-icon">${String(index + 1).padStart(2, "0")}</i><div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p></div><div class="task-status">${statusContent}</div></article>`;
        }).join("")}
      </div>
      ${doneCount ? `<blockquote class="partner-quote">«Готовые выборки уже в архиве. Помните: геопозиция устройства подтверждает маршрут устройства, не человека. Нужна вторая независимая связь».</blockquote>` : ""}
      </aside></div>
    </div>
  `;
}


// Синхронизирует связанный блок интерфейса с сохранённым прогрессом.
export function updateAnalysisProgress(_app) {
  const { caseData } = _app;
  const { taskStatus } = _app;
  caseData.tasks.forEach((task) => {
    const info = taskStatus(task);
    if (info.status !== "running") return;
    const countdown = document.querySelector(`[data-task-countdown="${task.id}"]`);
    const progress = document.querySelector(`[data-task-progress="${task.id}"]`);
    if (countdown) countdown.textContent = formatDuration(info.remaining);
    if (progress) progress.style.width = `${info.percent}%`;
  });
}


// Синхронизирует связанный блок интерфейса с сохранённым прогрессом.
export function updateCompletedTasks(_app, notify = true) {
  const { caseData, state } = _app;
  const { saveCase, toast } = _app;
  if (!caseData || !state) return false;
  let changed = false;
  caseData.tasks.forEach((task) => {
    const saved = state.tasks[task.id];
    if (saved?.status === "running" && saved.finishAt <= Date.now()) {
      saved.status = "done";
      changed = true;
      if (!state.importantIds.includes(task.evidenceId)) state.importantIds.push(task.evidenceId);
      if (notify) toast(`Кира закончила: «${task.title}». Вывод добавлен в архив.`);
    }
  });
  if (changed) saveCase();
  return changed;
}
