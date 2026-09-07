/** Пошаговое обучение и привязка подсказок к доступным действиям. */
import { TUTORIAL_STEPS } from '../data/catalog.js';
import { escapeHtml } from '../core/utils.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function currentTutorialStep(_app) {
  const { state } = _app;
  if (!state?.tutorial || state.tutorial.completed) return null;
  return TUTORIAL_STEPS[state.tutorial.step] || null;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function clearTutorialUi(_app) {

  document.querySelectorAll("[data-tutorial-ui]").forEach((element) => element.remove());
  document.querySelectorAll(".tutorial-highlight").forEach((element) => element.classList.remove("tutorial-highlight"));
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderTutorialUi(_app) {
  const { dom, state } = _app;
  const { currentTutorialStep, clearTutorialUi } = _app;
  clearTutorialUi();
  if (!state?.tutorial || state.tutorial.completed) return;

  const step = currentTutorialStep();
  if (!step) return;
  if (state.tutorial.hidden) {
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "tutorial-resume";
    resume.dataset.action = "tutorial-resume";
    resume.dataset.tutorialUi = "true";
    resume.textContent = `Показать обучение · ${Math.min(state.tutorial.step + 1, TUTORIAL_STEPS.length)}/${TUTORIAL_STEPS.length}`;
    document.body.append(resume);
    return;
  }

  const target = document.querySelector(step.target);
  target?.classList.add("tutorial-highlight");
  const sticker = document.createElement("aside");
  sticker.className = "tutorial-sticker";
  sticker.dataset.tutorialUi = "true";
  sticker.setAttribute("aria-live", "polite");
  sticker.innerHTML = `
    <div class="tutorial-sticker-head"><span>ОБУЧЕНИЕ · ${state.tutorial.step + 1}/${TUTORIAL_STEPS.length}</span><button type="button" class="tutorial-close" data-action="tutorial-skip" aria-label="Закрыть этот шаг">×</button></div>
    <h2>${escapeHtml(step.title)}</h2>
    ${step.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    <div class="tutorial-sticker-actions">
      <button type="button" class="button button-ghost button-small" data-action="tutorial-hide">Скрыть</button>
      <button type="button" class="button button-primary button-small" data-action="tutorial-continue">${escapeHtml(step.action || "Пропустить шаг")}</button>
    </div>
  `;
  if (dom.detailDialog.open) {
    sticker.classList.add("is-in-dialog");
    dom.detailContent.append(sticker);
  } else {
    document.body.append(sticker);
  }
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function advanceTutorial(_app) {
  const { dom, state } = _app;
  const { saveCase, toast, closeDialog, navigate, currentTutorialStep, clearTutorialUi, renderTutorialUi } = _app;
  const tutorial = state?.tutorial;
  const step = currentTutorialStep();
  if (!tutorial || !step) return;
  if (step.final) {
    tutorial.completed = true;
    saveCase();
    clearTutorialUi();
    toast("Обучение завершено. Новый режим можно выбрать при создании дела.");
    return;
  }

  tutorial.step += 1;
  const next = currentTutorialStep();
  saveCase();
  if (!next) return;
  if (dom.detailDialog.open && !dom.detailContent.querySelector(next.target)) closeDialog(dom.detailDialog);
  if (next.view !== state.view) {
    navigate(next.view);
    return;
  }
  renderTutorialUi();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function handleTutorialEvent(_app, name) {
  const { currentTutorialStep, advanceTutorial } = _app;
  if (currentTutorialStep()?.trigger === name) advanceTutorial();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function shouldAdvanceTutorialForNavigation(_app, view) {
  const { state } = _app;
  const { currentTutorialStep } = _app;
  const step = currentTutorialStep();
  const next = step ? TUTORIAL_STEPS[state.tutorial.step + 1] : null;
  return Boolean(
    step?.action
    && next
    && step.view === state.view
    && next.view === view
    && view !== state.view,
  );
}
