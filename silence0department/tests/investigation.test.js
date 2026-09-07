import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../src/app.js';
import { generateCase } from '../src/domain/generator.js';
import engine from '../src/domain/engine.js';

// Изолированное хранилище и минимальная оболочка: тестируем реальные модули без браузера.
function loadGame() {
  const nodes = new Map();
  const storage = new Map();
  globalThis.document = { querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', classList: { toggle() {}, add() {}, remove() {} } });
    return nodes.get(selector);
  }, querySelectorAll() { return []; } };
  globalThis.window = { addEventListener() {}, setTimeout() {}, clearInterval() {} };
  globalThis.localStorage = { getItem(key) { return storage.get(key) || null; }, setItem(key,value) { storage.set(key,value); } };
  const app = createApplication();
  return { ...app, app, generateCase, nodes, storage,
    use(data,saved) { app.caseData=data; app.state=saved || app.createInitialState(data); return app.state; },
    current() { return { caseData:app.caseData, state:app.state }; } };
}

function collectField(data, state, now = Date.now()) {
  for (const scene of data.scenes) for (const spot of scene.spots) {
    const result = engine.examine(data, state, scene.id, spot.id, spot.tool, now);
    assert.equal(result.ok, true, `${data.seed}/${scene.id}/${spot.id}: ${result.message}`);
  }
}

function reportForm(data, ids, overrides = {}) {
  const values = { suspect: data.culpritId, motive: data.motive, method: data.method,
    reasoning: "Оригинал выдачи связан с образцом и независимой непрерывной записью. Мотив проверен отдельно по переписке.", ...overrides };
  return { get: (key) => values[key] || "", getAll: () => ids };
}

test("2000 generated cases: determinism, coherent references, reachable field solution and valid dialogue", () => {
  const game = loadGame();
  const titles = new Set();
  const culpritPositions = new Set();
  for (const profile of engine.PROFILES) for (const difficulty of ["tutorial", "observer", "detective", "inspector"]) for (let i = 0; i < 50; i++) {
    const data = game.generateCase(`QA-${i}`, difficulty, profile.id);
    assert.equal(JSON.stringify(data), JSON.stringify(game.generateCase(`QA-${i}`, difficulty, profile.id)));
    const state = game.use(data);
    titles.add(data.title);
    culpritPositions.add(data.culpritId);
    assert.equal(data.suspects.filter((person) => person.isCulprit).length, 1);
    assert.ok(data.motiveOptions.includes(data.motive));
    assert.ok(data.methodOptions.includes(data.method));
    assert.equal(new Set(data.evidence.map((item) => item.id)).size, data.evidence.length);
    assert.equal(new Set(data.suspects.map((item) => item.name)).size, data.suspects.length);
    const cast = [data.victim, data.commissioner, ...data.suspects, ...data.supportStaff];
    assert.equal(new Set(cast.map((item) => item.name)).size, cast.length);
    for (const edge of data.relationships) {
      assert.equal(new Set(edge.people).size, 2);
      for (const personId of edge.people) {
        const person = data.suspects.find((item) => item.id === personId);
        const otherId = edge.people.find((id) => id !== personId);
        assert.ok(game.interviewQuestions(person).find((item) => item.id === `contact-${otherId}`).answer.includes(edge.reason));
        assert.ok(data.evidence.find((item) => item.id === `world-${personId}-links`).content.includes(edge.reason));
      }
    }
    for (const id of data.strongEvidenceIds) assert.ok(data.evidence.some((item) => item.id === id));
    assert.equal(game.isEvidenceUnlocked(data.evidence.find((item) => item.id === "field-identity")), false);
    for (const person of data.suspects) for (const question of game.interviewQuestions(person)) {
      assert.doesNotMatch(`${question.question} ${question.answer} ${question.observation || ""}`, /undefined|\[object Object\]|NaN/);
      assert.ok(question.answer);
    }
    collectField(data, state);
    for (const id of data.fieldStrongIds) assert.ok(game.availableEvidence().some((item) => item.id === id));
    assert.equal(game.evaluateReport(reportForm(data, [...data.fieldStrongIds, ...data.requiredEvidenceIds])).proven, true);
    assert.equal(state.outcome, null);
    assert.doesNotMatch(JSON.stringify(data), /undefined|\[object Object\]|NaN/);
  }
  assert.ok(titles.size >= 25);
  assert.equal(culpritPositions.size, 6);
});

test("wrong and fabricated evidence cannot close a case; no answer leaks from a rejected report", () => {
  const game = loadGame();
  const data = game.generateCase("FALSE-END", "detective", "mercenary");
  const state = game.use(data);
  assert.equal(game.evaluateReport(reportForm(data, [...data.fieldStrongIds, ...data.requiredEvidenceIds])).proven, false, "locked evidence must not count");
  collectField(data, state);
  assert.equal(game.evaluateReport(reportForm(data, ["field-trace", "field-identity", "field-decoy"])).proven, false);
  assert.equal(game.evaluateReport(reportForm(data, data.fieldStrongIds, { suspect: data.story.decoyId })).proven, false);
  assert.equal(game.evaluateReport(reportForm(data, data.fieldStrongIds, { motive: "чужой мотив" })).proven, false);
  state.report = game.evaluateReport(reportForm(data, data.fieldStrongIds, { suspect: data.story.decoyId }));
  game.renderCaseVerdict();
  const html = game.nodes.get("#workspace").innerHTML;
  assert.ok(!html.includes("Фактическая реконструкция"));
  assert.ok(!html.includes(data.routeReconstruction));
});

test("field tools, locks and repeat actions cannot bypass discovery or farm progress", () => {
  const game = loadGame();
  const data = game.generateCase("FIELD", "inspector", "mercenary");
  const state = game.use(data);
  const now = Date.now();
  assert.equal(engine.examine(data, state, "depot", "ledger", "compare", now).ok, false);
  assert.equal(engine.examine(data, state, "scene", "residue", "photo", now).ok, false);
  const spent = state.pressure.spentMs;
  engine.examine(data, state, "scene", "residue", "photo", now);
  assert.equal(state.pressure.spentMs, spent);
  assert.equal(engine.examine(data, state, "scene", "residue", "sample", now).ok, true);
  assert.equal(engine.examine(data, state, "scene", "residue", "sample", now).ok, false);
  assert.equal(state.field.found.filter((id) => id === "field-trace").length, 1);
});

test("deadline survives save/reload and offline time; death is terminal", () => {
  const game = loadGame();
  const data = game.generateCase("DEADLINE", "detective", "mercenary");
  const state = game.use(data);
  state.pressure.deadlineAt = Date.now() - 1;
  game.saveCase();
  assert.equal(game.loadCase(), true);
  const restored = game.current();
  assert.equal(restored.state.outcome.kind, "dead");
  const before = JSON.stringify(restored.state.pressure);
  engine.decide(restored.caseData, restored.state, "cover");
  assert.equal(JSON.stringify(restored.state.pressure), before);
  assert.equal(engine.examine(restored.caseData, restored.state, "scene", "residue", "sample").ok, false);
});

test("exposure can end the hunt before the deadline; precautions are finite", () => {
  const game = loadGame();
  const data = game.generateCase("EXPOSURE", "detective", "mercenary");
  const state = game.use(data);
  engine.decide(data, state, "cover");
  engine.decide(data, state, "cover");
  const deadline = state.pressure.deadlineAt;
  engine.decide(data, state, "cover");
  assert.equal(state.pressure.breaks, 2);
  assert.equal(state.pressure.deadlineAt, deadline);
  state.pressure.noise = 100;
  assert.equal(engine.checkThreat(data, state), true);
  assert.ok(engine.threat(data, state).remaining > 0);
  assert.equal(state.outcome.kind, "dead");
});

test("ordinary cases and finished investigations have no terminal timer", () => {
  const game = loadGame();
  const data = game.generateCase("CALM", "detective", "serial");
  const state = game.use(data);
  assert.equal(engine.checkThreat(data, state, Date.now() + 365 * 86400000), false);
  const timed = game.generateCase("DONE", "detective", "mercenary");
  const done = game.use(timed);
  done.outcome = { kind: "solved", at: Date.now() };
  assert.equal(engine.checkThreat(timed, done, Date.now() + 365 * 86400000), false);
  assert.equal(done.outcome.kind, "solved");
});

test("assistant uses discovered evidence, not the hidden answer; drafts persist", () => {
  const game = loadGame();
  const data = game.generateCase("CHAT", "detective", "serial");
  const state = game.use(data);
  const unknown = engine.assistantReply(data, state, "Кто серийный убийца?", game.availableEvidence());
  assert.ok(!unknown.includes(data.evidence.find((item) => item.id === "field-series").content));
  collectField(data, state);
  const known = engine.assistantReply(data, state, "Сравним серийные эпизоды", game.availableEvidence());
  assert.ok(known.includes("Эпизоды"));
  state.chatDraft = "Проверь эту версию";
  state.reportDraft = { suspect: "person-1", reasoning: "Черновик", evidence: ["field-trace"] };
  game.saveCase();
  assert.equal(game.loadCase(), true);
  assert.equal(game.current().state.chatDraft, "Проверь эту версию");
  assert.equal(game.current().state.reportDraft.reasoning, "Черновик");
});

// Регрессия: стартовый обработчик не должен читать старую ссылку на дело после loadCase().
test("application startup restores the current case before displaying its number", () => {
  const game = loadGame();
  const data = game.generateCase("BOOT", "detective", "theft");
  game.use(data);
  game.saveCase();
  game.app.caseData = null;
  game.app.state = null;
  document.addEventListener = () => {};
  const originalQuery = document.querySelector;
  document.querySelector = (selector) => {
    const node = originalQuery(selector);
    node.addEventListener = () => {};
    return node;
  };
  for (const node of game.nodes.values()) node.addEventListener = () => {};
  window.setInterval = () => 123;
  game.app.applySettings = () => {};
  game.app.initNotebook = () => {};
  game.app.renderCurrentView = () => {};
  game.app.tick = () => {};
  game.app.init();
  assert.equal(game.nodes.get("#status-message").textContent, `Восстановлено дело ${data.number}`);
  assert.equal(game.app.ticker, 123);
});

test("copycat category generates both a connected series and an imitation", () => {
  const game = loadGame();
  const outcomes = new Set();
  for (let index = 0; index < 30; index++) {
    const data = game.generateCase(`SERIES-${index}`, "detective", "copycat");
    outcomes.add(data.story.seriesLinked);
    assert.equal(new Set(data.story.episodes.map((item) => item.name)).size, 3);
    assert.ok(data.story.episodes[0].daysBefore > data.story.episodes[1].daysBefore);
    assert.ok(data.requiredEvidenceIds.includes("field-series"));
  }
  assert.equal(outcomes.size, 2);
});
