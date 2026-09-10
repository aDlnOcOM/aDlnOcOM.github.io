/** Проверки целостности справочника и поиска без привязки к скрытым данным дела. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_ARTICLES, GUIDE_CATEGORIES, GUIDE_CONTEXT } from '../src/data/handbook.js';
import { searchGuide, openHandbook } from '../src/ui/handbook.js';

test('all handbook categories, related links and view suggestions resolve', () => {
  const ids = new Set(GUIDE_ARTICLES.map(article => article.id));
  const categories = new Set(GUIDE_CATEGORIES.map(([id]) => id));
  assert.equal(ids.size, GUIDE_ARTICLES.length);
  assert.equal(Object.keys(GUIDE_CONTEXT).length, 9);
  for (const article of GUIDE_ARTICLES) {
    assert.ok(categories.has(article.category));
    assert.ok(article.title && article.summary && article.keywords);
    assert.ok(article.steps?.length || article.paragraphs?.length);
    for (const related of article.related) assert.ok(ids.has(related), related);
  }
  for (const topic of Object.values(GUIDE_CONTEXT)) assert.ok(ids.has(topic), topic);
});

test('search combines words and category, handles Russian text and empty results', () => {
  assert.deepEqual(searchGuide().map(a => a.id), GUIDE_ARTICLES.map(a => a.id));
  assert.deepEqual(searchGuide('  НАЕМНИК   ЗАМЕТНОСТЬ ').map(a => a.id), searchGuide('наёмник заметность').map(a => a.id));
  assert.ok(searchGuide('наемник заметность').some(a => a.id === 'hunt'));
  assert.ok(searchGuide('стеганография', 'tools').some(a => a.id === 'digital'));
  assert.ok(searchGuide('доверие').some(a => a.id === 'interviews'));
  assert.ok(searchGuide('', 'tools').every(a => a.category === 'tools'));
  assert.equal(searchGuide('несуществующий-запрос').length, 0);
  assert.equal(searchGuide('таймер', 'start').length, 0);
});

test('opening help uses only current view and timed flag, preserving case and forms', () => {
  const previousDocument = globalThis.document;
  const nodes = new Map();
  globalThis.document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {});
      return nodes.get(selector);
    },
    querySelectorAll() { return []; },
  };
  let shown = 0;
  const app = {
    state: Object.freeze({ view: 'lab', outcome: null }),
    caseData: new Proxy({ profile: Object.freeze({ timed: true }) }, {
      get(target, key) { assert.equal(key, 'profile'); return target[key]; },
    }),
    dom: { helpDialog: { open: false, showModal() { this.open = true; shown += 1; } } },
  };
  try {
    openHandbook(app);
    assert.equal(app.handbook.topic, 'laboratory');
    assert.equal(nodes.get('#guide-timed').hidden, false);
    assert.match(nodes.get('#guide-results').innerHTML, /guide-article-laboratory" open/);
    openHandbook(app, 'hunt');
    assert.equal(shown, 1);
    assert.equal(app.handbook.topic, 'laboratory');
    assert.ok(!nodes.has('#workspace'));
  } finally {
    globalThis.document = previousDocument;
  }
});
