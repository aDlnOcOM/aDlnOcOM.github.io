/** Поиск и чтение справочника поверх рабочего экрана, без изменения состояния дела. */
import { GUIDE_ARTICLES, GUIDE_CATEGORIES, GUIDE_CONTEXT } from '../data/handbook.js';
import { escapeHtml } from '../core/utils.js';

// Поиск по словам учитывает ё/е, регистр и лишние пробелы, сохраняя порядок статей.
const searchText = value => String(value).toLocaleLowerCase('ru').replaceAll('ё', 'е');
export function searchGuide(query = '', category = 'all') {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  return GUIDE_ARTICLES.filter(article => {
    const text = searchText([article.title, article.summary, article.keywords,
      ...(article.paragraphs || []), ...(article.steps || []), article.tip || ''].join(' '));
    return (category === 'all' || article.category === category) && words.every(word => text.includes(word));
  });
}

// Все тексты экранируются; связанная тема ссылается только на существующую статью.
function articleMarkup(article, expanded) {
  return `<details class="guide-article" id="guide-article-${article.id}" ${expanded ? 'open' : ''}>
    <summary><span><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.summary)}</span></span><span class="guide-chevron" aria-hidden="true">+</span></summary>
    <div class="guide-body">
      ${(article.paragraphs || []).map(text => `<p>${escapeHtml(text)}</p>`).join('')}
      ${article.steps ? `<ol>${article.steps.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ol>` : ''}
      ${article.tip ? `<aside class="guide-tip"><strong>На практике</strong><p>${escapeHtml(article.tip)}</p></aside>` : ''}
      <div class="guide-related"><span>По теме</span>${article.related.map(id => {
        const related = GUIDE_ARTICLES.find(item => item.id === id);
        return related ? `<button type="button" data-guide-topic="${id}">${escapeHtml(related.title)}</button>` : '';
      }).join('')}</div>
    </div>
  </details>`;
}

// Меняется только список статей: фокус поиска и незавершённые игровые формы сохраняются.
function renderGuide(_app) {
  const { query, category, topic } = _app.handbook;
  const articles = searchGuide(query, category);
  if (!query.trim()) articles.sort((a, b) => Number(b.id === topic) - Number(a.id === topic));
  document.querySelector('#guide-results').innerHTML = articles.length
    ? articles.map(article => articleMarkup(article, article.id === topic || articles.length === 1)).join('')
    : '<div class="guide-empty"><h3>Подходящих тем пока нет</h3><p>Попробуйте «алиби», «улика», «таймер» или сбросьте поиск и фильтр.</p><button type="button" class="button button-ghost" data-guide-reset>Показать все темы</button></div>';
  document.querySelector('#guide-count').textContent = `Тем: ${articles.length} из ${GUIDE_ARTICLES.length}`;
  document.querySelectorAll('[data-guide-category]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.guideCategory === category));
  });
  document.querySelector('#guide-clear').hidden = !query;
  document.querySelector('#guide-results').scrollTop = 0;
}

// Открытие не вызывает навигацию, сохранение, штраф за подсказку или остановку таймера.
export function openHandbook(_app, requestedTopic) {
  const dialog = _app.dom.helpDialog;
  if (dialog.open) return;
  const context = GUIDE_CONTEXT[_app.state?.view] || 'start';
  const topic = GUIDE_ARTICLES.some(article => article.id === requestedTopic) ? requestedTopic : context;
  _app.handbook = { query: '', category: 'all', topic };
  document.querySelector('#guide-search').value = '';
  const article = GUIDE_ARTICLES.find(item => item.id === topic);
  document.querySelector('#guide-context').textContent = `Для текущего шага: ${article.title}`;
  document.querySelector('#guide-timed').hidden = !_app.caseData?.profile.timed || Boolean(_app.state?.outcome);
  renderGuide(_app);
  dialog.showModal();
}

// Один набор обработчиков обслуживает поиск, фильтры и ссылки даже в диалогах лаборатории.
export function initHandbook(_app) {
  const search = document.querySelector('#guide-search');
  document.querySelector('#guide-categories').innerHTML = GUIDE_CATEGORIES.map(([id, title]) =>
    `<button type="button" class="filter-button" data-guide-category="${id}" aria-pressed="${id === 'all'}">${escapeHtml(title)}</button>`).join('');
  search.addEventListener('input', () => {
    _app.handbook.query = search.value;
    renderGuide(_app);
  });
  _app.dom.helpDialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const state = _app.handbook;
    if (button.dataset.guideCategory) state.category = button.dataset.guideCategory;
    else if (button.dataset.guideTopic) {
      state.topic = button.dataset.guideTopic;
      state.category = 'all';
      state.query = '';
    } else if (button.hasAttribute('data-guide-reset')) {
      state.category = 'all';
      state.query = '';
    } else if (button.id === 'guide-clear') state.query = '';
    else return;
    search.value = state.query;
    renderGuide(_app);
    if (button.dataset.guideTopic) document.querySelector(`#guide-article-${state.topic} summary`)?.focus();
    else if (button.id === 'guide-clear' || button.hasAttribute('data-guide-reset')) search.focus();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-guide-open]');
    if (button) _app.openHandbook(button.dataset.guideOpen);
  });
}
