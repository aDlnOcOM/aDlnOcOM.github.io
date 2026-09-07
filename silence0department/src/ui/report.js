/** Черновики и итог расследования. Неверная версия не раскрывает скрытую истину. */
import { escapeHtml } from '../core/utils.js';
import { assessReport } from '../domain/report.js';

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderOutcome(_app) {
  const { dom, state } = _app;
  dom.workspace.innerHTML = `<div class="view"><article class="result-card fatal-result"><span class="eyebrow">Встречная охота · завершено</span><div class="outcome-mark" aria-hidden="true">×</div><h2>${escapeHtml(state.outcome.title)}</h2><p>${escapeHtml(state.outcome.text)}</p><p>Собрано полевых материалов: ${state.field.found.length}. Переписка и записи сохранены. Чтобы попытаться снова, примите новое дело с тем же кодом, категорией и сложностью.</p><button class="button button-primary" data-action="open-new-case">Вернуться в приёмную</button></article></div>`;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderCaseVerdict(_app) {
  const { dom, caseData, state } = _app;
  const { getSuspect, renderOutcome, renderReport } = _app;
  if (state.outcome?.kind === "dead") { renderOutcome(); return; }
  const result = state.report;
  if (!result) { renderReport(); return; }
  const solved = result.proven;
  const excluded = state.decisions.leads.anonymous === "excluded";
  const protectedWitness = state.decisions.witness === "protected";
  const title = solved ? "Дело доказано" : result.suspect === caseData.story.decoyId ? "Удобная версия не выдержала проверки" : "В доказательствах остался разрыв";
  const text = solved ? "Независимые источники связывают человека, механизм и время. Материалы переданы для официального производства." : "Проверка вернула материалы в бюро. Самоуверенная версия могла закрепить чужое обвинение. Доступные источники позволяют продолжить расследование; правильный ответ остаётся закрыт.";
  dom.workspace.innerHTML = `<div class="view"><header class="view-header"><div><span class="eyebrow">Исход частного расследования</span><h2>${escapeHtml(caseData.title)}</h2></div></header><article class="result-card"><span class="eyebrow">${solved ? "Причинная цепь подтверждена" : "Промежуточный исход"}</span><h3>${title}</h3><p>${text}</p>
    ${solved ? `<div class="ending-grid"><div><b>${excluded ? "Ложное обвинение снято" : "Ложная линия осталась открытой"}</b><p>${excluded ? "Вы проверили алиби человека из анонимного пакета и не дали старому проступку стать новым обвинением." : "Основной эпизод доказан, но человек из анонимного пакета ещё ждёт отдельного опровержения."}</p></div><div><b>${caseData.story.secondary ? protectedWitness ? "Источник в безопасности" : "Контакт со свидетелем потерян" : "Поручение исполнено"}</b><p>${caseData.story.secondary ? protectedWitness ? "Предупреждение через Киру позволило сохранить человека и его дальнейшие показания." : "Вы доказали эпизод, но не организовали защиту. Свидетель перестал отвечать; его дальнейшая судьба неизвестна." : "Заказчик получил проверяемый отчёт и границы установленных фактов."}</p></div><div><b>${state.decisions.client === "disclosed" ? "Цена откровенности" : "Границы бюро сохранены"}</b><p>${state.decisions.client === "disclosed" ? "Клиент успел узнать имена источников до завершения проверки. Кира фиксирует это как риск для продолжения дела." : "Личные данные источников не попали к заинтересованной стороне до завершения работы."}</p></div></div><div class="document-sheet"><b>Фактическая реконструкция</b>\n\nИсполнитель: ${escapeHtml(getSuspect(caseData.culpritId).name)}.\nМотив: ${escapeHtml(caseData.motive)}.\nМеханизм: ${escapeHtml(caseData.method)}.\nМаскировка: ${escapeHtml(caseData.staging)}.\nСлучайное обстоятельство: ${escapeHtml(caseData.incidental)}.\n\n${escapeHtml(caseData.story.turn)}\n\n${escapeHtml(caseData.routeReconstruction)}</div>` : `<div class="document-sheet">Что проверить дальше:\n• Совпадение личного интереса с мотивом в первоисточнике.\n• Связь контрольного образца, оригинала выдачи и независимой записи.\n• Не заменяет ли анонимный пакет контроль времени.\n\n${caseData.profile.timed ? "Повторная проверка стоила 2 минуты и 6 пунктов заметности. Охота продолжается." : "Ошибку можно исправить. Вернитесь к источникам и уточните цепочку."}</div>`}
    <p class="fine-print">Проверяются выбранные факты и независимая цепь. Свободный текст сохранён как ваше объяснение; его смысл автоматически не оценивается.</p>
    <div class="view-actions">${!solved ? `<button class="button button-ghost" data-action="reopen-case">Продолжить расследование</button>` : ""}<button class="button button-primary" data-action="open-new-case">Новое дело</button></div></article></div>`;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function saveInvestigationDraft(_app, event) {
  const { state } = _app;
  const { saveCase } = _app;
  if (!state) return;
  if (event.target.id === "assistant-message") state.chatDraft = event.target.value;
  else if (event.target.closest("#report-form")) {
    const form = new FormData(document.querySelector("#report-form"));
    state.reportDraft = { suspect: form.get("suspect"), motive: form.get("motive"), method: form.get("method"), reasoning: form.get("reasoning"), evidence: form.getAll("evidence") };
  } else return;
  saveCase();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function restoreReportDraft(_app) {
  const { state } = _app;
  if (!state.reportDraft) return;
  const form = document.querySelector("#report-form");
  if (!form) return;
  for (const key of ["suspect", "motive", "method", "reasoning"]) form.elements[key].value = state.reportDraft[key] || "";
  form.querySelectorAll('[name="evidence"]').forEach((input) => { input.checked = state.reportDraft.evidence.includes(input.value); });
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function readinessScore(_app) {
  const { caseData, state } = _app;
  if (state.outcome?.kind === "solved") return 100;
  const fieldPart = Math.min(40, state.field.found.length / 7 * 40);
  const puzzlePart = (state.solvedPuzzles.length / caseData.puzzles.length) * 25;
  const asked = Object.values(state.askedQuestions).flat().length;
  const interviewPart = Math.min(15, asked * 2);
  const evidencePart = Math.min(20, state.importantIds.length * 3 + Object.values(state.tasks).filter((task) => task.status === "done").length * 4);
  return Math.round(Math.min(100, fieldPart + puzzlePart + interviewPart + evidencePart));
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderReport(_app) {
  const { dom, caseData, state } = _app;
  const { availableEvidence, renderOutcome, restoreReportDraft, readinessScore, renderReportResult } = _app;
  if (state.outcome?.kind === "dead") { renderOutcome(); return; }
  if (state.report) {
    renderReportResult();
    return;
  }
  const relevantEvidence = availableEvidence();
  const readiness = readinessScore();
  const asked = Object.values(state.askedQuestions).flat().length;
  dom.workspace.innerHTML = `
    <div class="view">
      <header class="view-header"><div><span class="eyebrow">Итоговый протокол</span><h2>Версия</h2><p>Версия оценивается по ответственному лицу, мотиву, механизму события и качеству выбранной доказательной цепочки.</p></div></header>
      <div class="report-layout">
        <form class="report-form" id="report-form">
          <section class="report-section"><h3>01 · Основная версия</h3>
            <label for="report-suspect">Ответственное лицо</label><select id="report-suspect" name="suspect" required><option value="">Выберите…</option>${caseData.suspects.map((person) => `<option value="${person.id}">${escapeHtml(person.name)} · ${escapeHtml(person.role)}</option>`).join("")}</select>
            <label for="report-motive">Мотив</label><select id="report-motive" name="motive" required><option value="">Выберите…</option>${caseData.motiveOptions.map((motive) => `<option value="${escapeHtml(motive)}">${escapeHtml(motive)}</option>`).join("")}</select>
            <label for="report-method">${escapeHtml(caseData.archetype.mechanismLabel)}</label><select id="report-method" name="method" required><option value="">Выберите…</option>${caseData.methodOptions.map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`).join("")}</select>
          </section>
          <section class="report-section"><h3>02 · Доказательная цепочка</h3><p class="micro-label">Выберите от 3 до 5 материалов: независимую цепь и источник мотива. В особых делах приложите также сопоставление эпизодов или обратную сторону поручения.</p><div class="evidence-checks">
            ${relevantEvidence.map((item) => `<label class="evidence-check"><input type="checkbox" name="evidence" value="${item.id}"><span>${escapeHtml(item.code)} · ${escapeHtml(item.title)}</span></label>`).join("")}
          </div></section>
          <section class="report-section"><h3>03 · Логика</h3><label for="report-reasoning">Объясните причинную цепь и границы вывода</label><textarea id="report-reasoning" name="reasoning" minlength="60" required placeholder="Что опровергает алиби? Как отделены причина, маскировка и случайное обстоятельство? Почему социальный конфликт не является достаточным доказательством?"></textarea></section>
          <button class="button button-primary" type="submit">Подписать и передать версию</button>
        </form>
        <aside class="panel case-readiness"><span class="eyebrow">Оценка готовности</span><h3>${readiness}% собрано</h3><div class="readiness-meter"><i style="width:${readiness}%"></i></div><ul class="readiness-list">
          <li><span>Задачи</span><strong>${state.solvedPuzzles.length}/${caseData.puzzles.length}</strong></li>
          <li><span>Беседы</span><strong>${asked}</strong></li>
          <li><span>Важные материалы</span><strong>${state.importantIds.length}</strong></li>
          <li><span>Подсказки</span><strong>${state.hintsUsed.length}</strong></li>
        </ul><p class="fine-print">Высокая готовность не гарантирует верную версию. Это мера полноты работы, а не истинности вывода.</p></aside>
      </div>
    </div>
  `;
  restoreReportDraft();
}


// Проверяет полноту независимой цепи, не принимая закрытые или вымышленные источники.
export function evaluateReport(_app, formData) {
  return assessReport(_app.caseData, {
    suspect: formData.get('suspect'), motive: formData.get('motive'), method: formData.get('method'),
    evidenceIds: formData.getAll('evidence'), reasoning: String(formData.get('reasoning') || ''),
  }, _app.availableEvidence().map((item) => item.id));
}

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderReportResult(_app) {
  const { renderCaseVerdict } = _app;
  renderCaseVerdict();
}
