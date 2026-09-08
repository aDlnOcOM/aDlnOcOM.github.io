const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function shell() {
  const elements = new Map();
  let focused;
  function node(id) {
    return { id, hidden: false, open: false, dataset: {}, attributes: {}, children: [], handlers: {},
      showModal() { this.open = true; },
      close() { this.open = false; this.handlers.close?.(); },
      addEventListener(type, fn) { this.handlers[type] = fn; },
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key]; },
      focus() { focused = id; },
      replaceChildren() { this.children = []; },
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); }
    };
  }
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    assert.ok(!elements.has(match[1]), `Duplicate id ${match[1]}`);
    const item = node(match[1]);
    item.hidden = /\bhidden\b/.test(match[0]);
    elements.set(item.id, item);
  }
  const body = { dataset: { screen: 'menu' } };
  const scope = { window: {}, document: { body, getElementById: id => {
    assert.ok(elements.has(id), `Missing HTML target ${id}`);
    return elements.get(id);
  }, createElement: () => node('generated') } };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'hideout.js'), 'utf8'), scope);
  return { get: id => elements.get(id), body, openService: scope.window.HideoutShell.openService, refresh: scope.window.HideoutShell.refresh,
    focus: () => focused, click: id => elements.get(id).handlers.click() };
}

test('shelter is the hub and equipment/storage are local dialogs without tabs', () => {
  const s = shell();
  assert.equal(s.get('main-menu').hidden, false);
  assert.equal(s.get('home-screen').hidden, true);
  s.click('enter-hideout');
  assert.equal(s.body.dataset.screen, 'hideout');
  assert.equal(s.get('main-menu').hidden, true);
  assert.equal(s.get('tab-equipment'), undefined);
  assert.equal(s.get('tab-storage'), undefined);
  assert.equal(s.get('menu-equipment'), undefined);
  for (const name of ['storage', 'equipment']) {
    s.openService(name);
    assert.equal(s.get(`panel-${name}`).open, true);
    assert.equal(s.get('home-screen').hidden, false);
    s.click(`close-${name}`);
    assert.equal(s.get(`panel-${name}`).open, false);
    assert.equal(s.focus(), 'shelter-canvas');
  }
  s.click('back-menu');
  assert.equal(s.get('home-screen').hidden, true);
  assert.equal(s.focus(), 'enter-hideout');
  s.openService('equipment');
  assert.equal(s.get('panel-equipment').open, false);
});

test('entering the base focuses its character controls and menu help remains accessible', () => {
  const s = shell();
  s.click('enter-hideout');
  assert.equal(s.focus(), 'shelter-canvas');
  s.click('menu-controls');
  assert.equal(s.get('menu-help').hidden, false);
  assert.equal(s.get('menu-controls').attributes['aria-expanded'], 'true');
  s.click('menu-controls');
  assert.equal(s.get('menu-help').hidden, true);
});

test('storage reflects real progression and run completion returns to shelter', () => {
  const s = shell();
  const progress = { salvage: 57, equipment: { knife: { blade: { choice: 'serrated', tier: true } } } };
  const items = [{ id: 'knife', name: 'Нож охраны', slot: 'ВТОРИЧНОЕ' }];
  s.refresh(progress, items);
  assert.equal(s.body.dataset.screen, 'menu');
  assert.equal(s.get('storage-salvage').textContent, '57');
  assert.equal(s.get('storage-items').children[0].children[2].textContent, 'В комплекте · модификаций: 2');
  s.click('enter-hideout');
  s.click('start-run');
  s.get('run-screen').hidden = false;
  s.refresh(progress, items);
  assert.equal(s.body.dataset.screen, 'run');
  s.get('run-screen').hidden = true;
  progress.salvage = 73;
  s.refresh(progress, items);
  assert.equal(s.body.dataset.screen, 'hideout');
  assert.equal(s.get('panel-shelter').hidden, false);
  assert.equal(s.get('storage-salvage').textContent, '73');
  assert.equal(s.get('storage-items').children.length, 1);
});
