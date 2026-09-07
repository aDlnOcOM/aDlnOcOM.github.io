/** Переписка с ассистентом. Ответы строятся только по открытым источникам. */
import { escapeHtml } from '../core/utils.js';
import detective from '../domain/engine.js';

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderAssistantChat(_app) {
  const { state } = _app;
  return `<section class="assistant-chat" aria-label="Чат с Кирой"><div class="chat-heading"><i class="chat-presence"></i><b>Кира Руднева</b><span>внутренняя линия бюро</span></div><div class="chat-messages" id="chat-messages" role="log" aria-live="polite">${state.chat.map((message) => `<article class="chat-bubble ${message.role === "user" ? "is-user" : ""}"><b>${message.role === "user" ? "Вы" : "Кира"}</b><p>${escapeHtml(message.text)}</p><time>${new Date(message.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></article>`).join("")}</div><div class="chat-prompts">${["Что проверить дальше?", "Проверим ложную версию", "Где искать мотив?", "Мне нужна поддержка"].map((prompt) => `<button class="button button-ghost button-small" data-chat-prompt="${escapeHtml(prompt)}" ${state.outcome ? "disabled" : ""}>${prompt}</button>`).join("")}</div><form id="assistant-form" class="chat-compose"><label class="sr-only" for="assistant-message">Сообщение Кире</label><input id="assistant-message" name="message" maxlength="700" autocomplete="off" placeholder="Имя, улика или вопрос по делу…" value="${escapeHtml(state.chatDraft)}" required ${state.outcome ? "disabled" : ""}><button class="button button-primary" type="submit" ${state.outcome ? "disabled" : ""}>Отправить</button></form><p class="fine-print">Кира работает с материалами этого дела: называет источники и предлагает проверки. История переписки сохраняется.</p></section>`;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function sendAssistantMessage(_app, text) {
  const { caseData, state } = _app;
  const { availableEvidence, saveCase, renderCurrentView, renderAnalysis } = _app;
  text = text.trim().slice(0, 700);
  if (!text || state.outcome || detective.checkThreat(caseData, state)) { renderCurrentView(); return; }
  state.chat.push({ role: "user", text, at: Date.now() });
  const reply = detective.assistantReply(caseData, state, text, availableEvidence());
  state.chat.push({ role: "assistant", text: reply, at: Date.now() });
  state.chatDraft = "";
  saveCase();
  renderAnalysis();
  const log = document.querySelector("#chat-messages");
  if (log) log.scrollTop = log.scrollHeight;
  document.querySelector("#assistant-message")?.focus();
}
