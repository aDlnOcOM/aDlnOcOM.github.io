/** Регрессии рекомендаций: интерфейс использует прогресс, а не скрытый ответ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCase } from '../src/domain/generator.js';
import { createInitialState } from '../src/core/session.js';
import { nextStep } from '../src/ui/experience.js';
import { TUTORIAL_STEPS } from '../src/data/catalog.js';
import { filterEvidence } from '../src/ui/archive.js';

test('next action follows discoveries and never reads the culprit or hidden reconstruction', () => {
  for (const kind of ['death', 'serial', 'copycat', 'mercenary']) {
    const data = generateCase('UX-STEPS', 'detective', kind);
    const state = createInitialState({}, data);
    const publicData = new Proxy(data, {
      get(target, key) {
        assert.ok(!['culpritId', 'motive', 'method', 'story', 'routeReconstruction'].includes(key), `Hidden data: ${String(key)}`);
        return target[key];
      },
    });
    assert.equal(nextStep(publicData, state).view, 'field');
    state.field.found.push('field-trace', 'field-identity');
    assert.equal(nextStep(publicData, state).view, 'interviews');
    state.askedQuestions[data.suspects[0].id] = ['personal', 'where', 'memory'];
    assert.equal(nextStep(publicData, state).view, 'field');
    state.field.found.push('field-corroboration', ...data.requiredEvidenceIds);
    assert.equal(nextStep(publicData, state).view, 'report');
    state.outcome = { kind: 'solved', at: Date.now() };
    assert.equal(nextStep(publicData, state).action, 'Открыть итог');
  }
});

test('first-case guidance follows the current tutorial rather than forcing field work', () => {
  const data = generateCase('UX-LEARN', 'tutorial', 'auto');
  const state = createInitialState({}, data);
  for (let step = 0; step < TUTORIAL_STEPS.length; step++) {
    state.tutorial.step = step;
    assert.equal(nextStep(data, state).view, TUTORIAL_STEPS[step].view);
  }
});

test('archive filters combine search, player marks and read history without classifying truth', () => {
  const data = generateCase('UX-ARCHIVE', 'detective', 'serial');
  const state = createInitialState({}, data);
  state.field.found = ['field-trace'];
  const items = data.evidence.filter(item => !item.lockedBy || item.id === 'field-trace');
  assert.equal(filterEvidence(items, state, '', 'field').length, 1);
  assert.equal(filterEvidence(items, state, 'несуществующий-запрос', 'field').length, 0);
  assert.equal(filterEvidence(items, state, '', 'field')[0].id, 'field-trace');
  state.readEvidenceIds = ['field-trace'];
  assert.ok(!filterEvidence(items, state, '', 'unread').some(item => item.id === 'field-trace'));
  state.importantIds = ['field-trace'];
  assert.equal(filterEvidence(items, state, '', 'important')[0].id, 'field-trace');
});
