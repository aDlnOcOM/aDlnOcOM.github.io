/** Общие взаимодействия: навигация, выдвижные панели и следующий шаг без спойлеров. */
import { TUTORIAL_STEPS } from '../data/catalog.js';

const ICONS = {
  overview: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  field: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  interviews: '<path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z"/><path d="M7 10h9M7 14h5"/>',
  archive: '<path d="M3 7V4h6l3 3h9v13H3Z"/><path d="M3 10h18"/>',
  board: '<rect x="2" y="3" width="7" height="6" rx="1"/><rect x="15" y="15" width="7" height="6" rx="1"/><path d="M9 6h9v9M5 9v9h10"/>',
  computer: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M6 8l3 2-3 2M12 12h5"/>',
  lab: '<path d="M9 3h6M10 3v7L4 20h16l-6-10V3M7 15h10"/>',
  analysis: '<path d="M4 15V9a8 8 0 0 1 16 0v6M20 15v3a3 3 0 0 1-3 3h-4"/><rect x="2" y="9" width="4" height="7" rx="2"/><rect x="18" y="9" width="4" height="7" rx="2"/>',
  report: '<path d="M14 3H4v18h16V9M14 3v6h6M8 15l3 3 6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

// SVG используются только из фиксированного набора, пользовательский ввод сюда не попадает.
export function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.overview}</svg>`;
}

// Рекомендация учитывает лишь уже открытые источники и не оценивает правильность версии.
export function nextStep(data, state) {
  if (state.outcome?.kind === 'solved') return { view: 'report', title: 'Расследование завершено', text: 'Посмотрите итог и судьбы тех, чью историю вы восстановили.', action: 'Открыть итог' };
  if (state.tutorial && !state.tutorial.completed) {
    const step = TUTORIAL_STEPS[state.tutorial.step];
    return { view: step?.view || 'archive', title: 'Освойтесь в первом деле', text: 'Пошаговые подсказки познакомят с материалами, беседами и проверкой улик. Обучение можно свернуть в любой момент.', action: 'Продолжить знакомство' };
  }
  const found = state.field.found;
  if (!found.includes('field-trace')) return { view: 'field', title: 'Начните с места происшествия', text: 'Выберите точку на плане. Осмотр, снимок или образец помогут найти первый проверяемый след.', action: 'Выехать на место' };
  if (!found.includes('field-identity')) return { view: 'field', title: 'Проверьте новый адрес', text: 'Первый след открыл ещё одно место. Сопоставьте найденное с оригинальными записями.', action: 'Продолжить обследование' };
  if (Object.values(state.askedQuestions).flat().length < 3) return { view: 'interviews', title: 'Выслушайте участников', text: 'У вас уже есть материалы для беседы. Начните спокойно, затем уточните время и обстоятельства.', action: 'Начать беседу' };
  if (!found.includes('field-corroboration') || data.requiredEvidenceIds.some(id => !found.includes(id))) return { view: 'field', title: 'Найдите независимое подтверждение', text: 'Проверьте доступные места: кто получил образец, что записал другой источник и кому было выгодно событие.', action: 'Проверить источники' };
  return { view: 'report', title: 'Соберите свою версию', text: 'Сопоставьте человека, мотив и механизм. Приложите 3–5 материалов; совпадение само по себе ещё не доказательство.', action: 'Сформулировать версию' };
}

// Нативный dialog обеспечивает фокус, Escape и изоляцию фоновых элементов на всех экранах.
export function toggleNotebook(_app) {
  const dialog = document.querySelector('#notebook-dialog');
  if (dialog.open) dialog.close();
  else if (!document.querySelector('dialog[open]')) dialog.showModal();
}

export function initExperience(_app) {
  _app.initHandbook();
  document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
  const menu = document.querySelector('#mobile-menu');
  menu.innerHTML = document.querySelector('#case-nav').innerHTML.replaceAll(/ id="[^"]+"/g, '');
  document.querySelector('#menu-help-button').addEventListener('click', () => {
    document.querySelector('#menu-dialog').close();
    _app.openHandbook();
  });
  document.querySelector('#notebook-button').addEventListener('click', _app.toggleNotebook);
  document.querySelector('#menu-button').addEventListener('click', () => document.querySelector('#menu-dialog').showModal());
  for (const id of ['menu-dialog', 'notebook-dialog']) {
    const dialog = document.getElementById(id);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-close-drawer]')) dialog.close();
    });
  }
  menu.addEventListener('click', event => {
    if (event.target.closest('[data-view]')) document.querySelector('#menu-dialog').close();
  });
  // Прочитанный документ исчезает из фильтра после закрытия, не прерывая чтение.
  _app.dom.detailDialog.addEventListener('close', () => {
    if (_app.state?.view === 'archive' && _app.archiveFilter === 'unread') {
      _app.renderArchive();
      document.querySelector('#archive-search')?.focus({ preventScroll: true });
    }
  });
}
