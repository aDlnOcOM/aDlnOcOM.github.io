/** Сообщения статуса, уведомления и модальные окна. */

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function setStatus(_app, message) {
  const { dom } = _app;
  dom.status.textContent = message;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function toast(_app, message, isError = false) {
  const { dom } = _app;
  const { toast } = _app;
  const element = document.createElement("div");
  element.className = `toast${isError ? " is-error" : ""}`;
  element.textContent = message;
  dom.toastRegion.append(element);
  window.setTimeout(() => element.remove(), 3600);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function showDialog(_app, dialog) {

  if (!dialog.open) dialog.showModal();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function closeDialog(_app, dialog) {

  if (dialog.open) dialog.close();
}
