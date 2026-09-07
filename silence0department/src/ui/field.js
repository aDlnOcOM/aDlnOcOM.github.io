/** Полевой план, инструменты, решения и ложные линии. Правила делегированы доменному модулю. */
import { FIELD_TOOLS } from '../data/catalog.js';
import { escapeHtml } from '../core/utils.js';
import detective from '../domain/engine.js';

// Обновляет доступные места, точки и инструменты без изменения найденных фактов.
export function renderField(_app) {
  const { dom, caseData, state } = _app;
  const { getSuspect } = _app;
  const scene = caseData.scenes.find((item) => item.id === state.field.sceneId) || caseData.scenes[0];
  const spot = scene.spots.find((item) => item.id === state.field.spotId);
  const checked = spot && state.field.checked.includes(`${scene.id}:${spot.id}`);
  const closed = Boolean(state.outcome);
  const total = caseData.scenes.reduce((count, item) => count + item.spots.length, 0);
  const leadStatus = state.decisions.leads.anonymous;
  dom.workspace.innerHTML = `<div class="view field-view">
    <header class="view-header"><div><span class="eyebrow">Частное расследование · выезд ${String(caseData.scenes.indexOf(scene) + 1).padStart(2, "0")}</span><h2>В поле</h2><p>Не всё, что выглядит уликой, ею окажется. Изучите точку и выберите способ проверки.</p></div><span class="tag">${state.field.checked.length}/${total} точек обследовано</span></header>
    <div class="field-locations" aria-label="Места для обследования">${caseData.scenes.map((item, index) => {
      const locked = item.requires && !state.field.found.includes(item.requires);
      return `<button class="field-location ${scene.id === item.id ? "is-active" : ""}" data-scene-id="${item.id}" ${locked ? "disabled" : ""} aria-pressed="${scene.id === item.id}"><span>0${index + 1} ${locked ? "· нужен адрес" : ""}</span><b>${escapeHtml(item.name)}</b><small>${locked ? "Откроется по находке предыдущего выезда" : escapeHtml(item.subtitle)}</small></button>`;
    }).join("")}</div>
    <div class="field-layout"><section class="field-scene"><div class="scene-caption"><span class="eyebrow">${escapeHtml(scene.name)}</span><p>${escapeHtml(scene.atmosphere)}</p></div>
      <div class="scene-map" aria-label="План обследования">${scene.spots.map((item, index) => `<button class="scene-spot ${state.field.checked.includes(`${scene.id}:${item.id}`) ? "is-checked" : ""} ${spot?.id === item.id ? "is-active" : ""}" data-spot-id="${item.id}" aria-pressed="${spot?.id === item.id}"><i>${state.field.checked.includes(`${scene.id}:${item.id}`) ? "✓" : `0${index + 1}`}</i><span>${escapeHtml(item.label)}</span><small>${state.field.checked.includes(`${scene.id}:${item.id}`) ? "обследовано" : "изучить точку"}</small></button>`).join("")}<div class="map-door" aria-hidden="true">ВХОД ↑</div></div>
      <p class="fine-print">Доступ к месту согласован с владельцем. Находки сохраняются в архиве. ${caseData.profile.timed ? "Смена места: 40 с; проверка: 15 с; образец: 25 с и +1 заметность." : "Здесь нет ограничения по времени — можно спокойно исследовать каждую точку."}</p>
    </section><aside class="panel field-inspector"><span class="eyebrow">Полевой набор</span><h3>${spot ? escapeHtml(spot.label) : "С чего начнём?"}</h3><p>${spot ? escapeHtml(spot.description) : "Выберите отмеченную точку на плане. Описание подскажет, какой инструмент даст проверяемый результат."}</p>
      <div class="field-tools" role="group" aria-label="Инструмент">${Object.entries(FIELD_TOOLS).map(([key, label]) => `<button class="button button-ghost ${state.field.tool === key ? "is-active" : ""}" data-field-tool="${key}" aria-pressed="${state.field.tool === key}">${label}</button>`).join("")}</div>
      <button class="button button-primary" data-action="field-examine" ${!spot || checked || closed ? "disabled" : ""}>${checked ? "Точка обследована" : "Применить инструмент"}</button>
      <p class="field-feedback" role="status">${escapeHtml(state.lastFieldMessage)}</p>
      ${checked && spot?.evidenceId ? `<button class="button button-ghost" data-evidence-id="${spot.evidenceId}">Открыть материал</button>` : ""}
    </aside></div>
    <section class="panel field-decisions"><span class="eyebrow">Решения бюро</span><h3>Кому доверить следующий шаг</h3><div class="decision-grid">
      <div><b>Заказчик просит имена</b><p>${state.decisions.client ? (state.decisions.client === "withheld" ? "Передан только статус. Источники защищены от огласки." : "Промежуточная версия ушла заказчику. Он настаивает на закрытии.") : "Передать промежуточную версию или ограничиться статусом? Решение останется в деле."}</p>${!state.decisions.client ? `<button class="button button-ghost" data-decision="withhold" ${closed ? "disabled" : ""}>Сообщить только статус</button><button class="button button-ghost" data-decision="disclose" ${closed ? "disabled" : ""}>Передать имена${caseData.profile.timed ? " · 30 с / +14 риск" : ""}</button>` : ""}</div>
      ${caseData.story.secondary ? `<div><b>Источник под угрозой</b><p>${state.decisions.witness ? "Кира подтвердила: свидетель в безопасности." : "Предупреждение через доверенного человека сохранит контакт для дальнейшей проверки."}</p><button class="button button-ghost" data-decision="protect" ${state.decisions.witness || closed ? "disabled" : ""}>Защитить свидетеля${caseData.profile.timed ? " · 45 с" : ""}</button></div>` : ""}
      ${caseData.profile.timed ? `<div><b>Смена маршрута</b><p>+2 минуты, −18 заметности. Осталось ${Math.max(0, 2 - state.pressure.breaks)} из 2. Срок продолжает идти вне игры.</p><button class="button button-ghost" data-decision="cover" ${state.pressure.breaks >= 2 || closed ? "disabled" : ""}>Согласовать безопасную встречу</button></div>` : ""}
    </div></section>
    ${state.field.found.includes("field-decoy") ? `<section class="panel lead-panel"><span class="eyebrow">Рабочая линия · анонимный пакет</span><h3>${escapeHtml(getSuspect(caseData.story.decoyId).name)}</h3><p>${leadStatus === "excluded" ? "Линия проверена и исключена независимым источником." : leadStatus === "pursued" ? "Вы поставили эту версию в приоритет. Доступ к остальным направлениям сохранён; теперь проверьте её контрольной ведомостью." : "Реальная подпись и настоящий конфликт. Но относятся ли они к этому событию?"}</p><div class="view-actions"><button class="button button-ghost" data-action="pursue-lead" ${leadStatus || closed ? "disabled" : ""}>Проверить обвинение${caseData.profile.timed ? " · 60 с" : ""}</button><button class="button button-ghost" data-action="exclude-lead" ${!state.field.found.includes("field-exclusion") || leadStatus === "excluded" || closed ? "disabled" : ""}>Исключить по контрольной записи</button></div></section>` : ""}
    <section class="panel"><span class="eyebrow">Журнал выездов</span><div class="field-log">${state.field.log.length ? [...state.field.log].reverse().map((line) => `<p><b>${escapeHtml(caseData.scenes.find((item) => item.id === line.sceneId)?.name || "Бюро")}</b> ${escapeHtml(line.text)}</p>`).join("") : "Первый выезд ещё не оформлен."}</div></section>
  </div>`;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function handleDetectiveClick(_app, target) {
  const { caseData, state } = _app;
  const { getEvidence, saveCase, toast, sendAssistantMessage, renderInterviews, renderOutcome, renderCurrentView } = _app;
  if (!state || !caseData) return false;
  if (target.dataset.action === "open-new-case" || target.dataset.action?.startsWith("close-")) return false;
  if (detective.checkThreat(caseData, state)) { saveCase(); renderCurrentView(); return true; }
  if (state.outcome?.kind === "dead" && (target.closest("#workspace") || target.dataset.view)) { renderOutcome(); return true; }
  if (target.dataset.chatPrompt) { sendAssistantMessage(target.dataset.chatPrompt); return true; }
  if (target.dataset.approach) { state.approach = target.dataset.approach; saveCase(); renderInterviews(); return true; }
  if (target.dataset.sceneId) {
    const scene = caseData.scenes.find((item) => item.id === target.dataset.sceneId);
    if (!scene || (scene.requires && !state.field.found.includes(scene.requires))) return true;
    if (state.field.sceneId !== scene.id && !state.outcome) detective.spend(caseData, state, 40, 2);
    state.field.sceneId = scene.id;
    state.field.spotId = null;
    state.lastFieldMessage = "Выберите точку для обследования.";
  } else if (target.dataset.spotId) {
    state.field.spotId = target.dataset.spotId;
    state.lastFieldMessage = "Прочитайте описание и выберите подходящий инструмент.";
  } else if (target.dataset.fieldTool) state.field.tool = target.dataset.fieldTool;
  else if (target.dataset.action === "field-examine") {
    const result = detective.examine(caseData, state, state.field.sceneId, state.field.spotId, state.field.tool);
    state.lastFieldMessage = result.message;
    if (result.ok) _app.handleTutorialEvent("field-examine");
    if (result.evidenceId) state.chat.push({ role: "assistant", text: `Приняла материал «${getEvidence(result.evidenceId).title}». ${result.message}`, at: Date.now() });
  } else if (target.dataset.decision) {
    const message = detective.decide(caseData, state, target.dataset.decision);
    state.chat.push({ role: "assistant", text: message, at: Date.now() });
    toast(message);
  } else if (target.dataset.action === "pursue-lead") {
    if (state.outcome || state.decisions.leads.anonymous || !state.field.found.includes("field-decoy")) return true;
    state.decisions.leads.anonymous = "pursued";
    detective.spend(caseData, state, 60, 2);
    state.lastFieldMessage = "Проверка показала, что конфликт реален. Связь с событием всё ещё требует контроля времени.";
  } else if (target.dataset.action === "exclude-lead") {
    if (state.outcome || !state.field.found.includes("field-exclusion")) return true;
    state.decisions.leads.anonymous = "excluded";
    state.lastFieldMessage = "Анонимное обвинение опровергнуто независимым источником.";
  } else return false;
  saveCase();
  renderCurrentView();
  return true;
}
