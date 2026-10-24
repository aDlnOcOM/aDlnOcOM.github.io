const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scripts = ['data.js', 'core.js', 'combat.js', 'storage.js', 'audio.js', 'sprites.js', 'render.js', 'app.js'];

async function harness({ failedImage = false, blockedStorage = false } = {}) {
  const nodes = new Map(), drawCalls = [], callbacks = [], documentListeners = {}, windowListeners = {};
  let document;
  class Element {
    constructor(id = '', tag = 'DIV') { this.id = id; this.tagName = tag; this.style = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this.listeners = {}; this.clientWidth = 1280; this.clientHeight = 800; this.width = 640; this.height = 640; this.value = ''; this.textContent = ''; this.html = ''; this.children = []; this.classList = { toggle() {} }; }
    set innerHTML(value) {
      this.html = value; this.children = [];
      for (const match of value.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const button = new Element('', 'BUTTON'); button.textContent = match[2].replace(/<[^>]*>/g, ''); button.disabled = /\bdisabled\b/.test(match[1]);
        for (const data of match[1].matchAll(/data-([\w-]+)="([^"]*)"/g)) button.dataset[data[1]] = data[2];
        this.children.push(button);
      }
    }
    get innerHTML() { return this.html; }
    focus() { document.activeElement = this; }
    closest(tag) { return tag === 'button' && this.tagName === 'BUTTON' ? this : null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    querySelectorAll() { return this.children.filter(e => !e.disabled); }
    querySelector(selector) { const [, key, value] = selector.match(/\[data-(\w+)="([^"]+)"\]/) || []; return this.children.find(e => e.dataset[key] === value); }
    setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 112, height: 112 }; }
    getContext() {
      return new Proxy({}, { get: (target, key) => {
        if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (key === 'drawImage') return (...args) => { assert.ok(args[0], 'drawable image'); if (args.length === 9) { for (let i = 1; i < 9; i++) assert.ok(Number.isFinite(args[i]), `finite crop ${i}`); assert.ok(args[1] >= 0 && args[2] >= 0); assert.ok(args[1] + args[3] <= args[0].naturalWidth + .01); assert.ok(args[2] + args[4] <= args[0].naturalHeight + .01); } drawCalls.push(args.length); };
        if (key === 'arc') return (x, y, radius) => { assert.ok(Number.isFinite(radius) && radius >= 0); };
        return target[key] || (() => {});
      }, set: (target, key, value) => { target[key] = value; return true; } });
    }
  }
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) { const node = new Element(match[2], match[1].toUpperCase()); node.hidden = /\bhidden\b/.test(match[0]); node.disabled = /\bdisabled\b/.test(match[0]); nodes.set(match[2], node); }
  document = { getElementById(id) { assert.ok(nodes.has(id), `known DOM id ${id}`); return nodes.get(id); }, activeElement: null, body: new Element('body'), hidden: false,
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); } };
  const memory = new Map();
  const context = vm.createContext({ document, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    localStorage: blockedStorage ? null : { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: cb => callbacks.push(cb), setTimeout: () => 1, clearTimeout() {},
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
    Image: class { constructor() { this.naturalWidth = this.naturalHeight = 1254; } set src(value) { this.source = value; queueMicrotask(() => failedImage ? this.onerror() : this.onload()); } async decode() {} }
  });
  context.window = context;
  for (const script of scripts) {
    if (script === 'app.js') {
      const Original = context.ChitinCore.Game;
      context.ChitinCore.Game = class extends Original { constructor(options) { super(options); context.testGame = this; } };
    }
    vm.runInContext(fs.readFileSync(path.join(__dirname, script), 'utf8'), context, { filename: script });
  }
  await new Promise(resolve => setImmediate(resolve));
  const emit = (target, type, event = {}) => { for (const callback of target[type] || []) callback({ preventDefault() {}, ...event }); };
  return { nodes, context, drawCalls, memory, document,
    frame(stamp) { const callback = callbacks.shift(); assert.ok(callback); callback(stamp); },
    click(id) { const node = nodes.get(id); node.onclick?.(); emit(documentListeners, 'click', { target: node }); },
    action(action, key = 'action') { const button = nodes.get('dialog-body').children.find(e => e.dataset[key] === String(action)); assert.ok(button, `button ${key}:${action}`); emit(documentListeners, 'click', { target: button }); },
    key(code, repeat = false) { emit(documentListeners, 'keydown', { code, repeat }); },
    blur() { emit(windowListeners, 'blur'); },
    chooseChassis(id) { const button = nodes.get('chassis-options').children.find(e => e.dataset.chassis === id); emit(documentListeners, 'click', { target: button }); }
  };
}

test('all script and asset references are local files and PNGs have expected metadata', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.deepEqual([...html.matchAll(/<script defer src="([^"]+)"/g)].map(m => m[1]), scripts);
  for (const script of scripts) assert.ok(fs.existsSync(path.join(__dirname, script)));
  const { manifest } = require('./sprites.js');
  for (const [name, asset] of Object.entries(manifest)) {
    const png = fs.readFileSync(path.join(__dirname, asset.src)); assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1254); assert.equal(png.readUInt32BE(20), 1254);
    if (name !== 'ground') assert.equal(png[25], 6, `${name} retains alpha`);
    assert.equal(asset.rows[0], 0); assert.equal(asset.rows.at(-1), 1);
    for (let i = 1; i < asset.rows.length; i++) assert.ok(asset.rows[i] > asset.rows[i - 1]);
  }
});
test('browser entrypoint preloads atlases, selects all frames and deploys without DOM errors', async () => {
  const h = await harness(); assert.equal(h.nodes.get('deploy').disabled, false);
  for (const id of ['spectre', 'bastion', 'vector']) { h.chooseChassis(id); h.frame(100); }
  h.click('deploy'); h.frame(200); assert.equal(h.context.testGame.player.chassis, 'vector'); assert.equal(h.nodes.get('hangar').hidden, true);
  for (let i = 0; i < 30; i++) h.frame(250 + i * 16.7);
  assert.ok(h.drawCalls.length > 20); assert.equal(h.context.testGame.status, 'playing');
});
test('UI upgrade selection, pause, abandon, records and restart complete the run loop', async () => {
  const h = await harness(); h.click('deploy'); h.frame(16); const g = h.context.testGame;
  g.addXp(20); h.frame(50); assert.equal(g.status, 'upgrade'); assert.match(h.nodes.get('dialog-title').textContent, /ПЕРЕПИШИ/);
  h.action(0, 'choice'); assert.equal(g.status, 'playing'); assert.equal(h.nodes.get('modal').hidden, true);
  h.key('Escape'); h.frame(70); assert.equal(g.status, 'paused'); assert.equal(h.nodes.get('modal').hidden, false);
  const time = g.time; h.frame(250); assert.equal(g.time, time);
  h.action('resume'); h.frame(270); assert.equal(g.status, 'playing');
  h.blur(); h.frame(300); assert.equal(g.status, 'paused');
  h.action('abandon'); h.action('confirm-abandon'); h.frame(320); assert.equal(g.status, 'dead'); assert.equal(g.recorded, true);
  assert.equal(JSON.parse([...h.memory.values()][0]).runs, 1); h.frame(350); assert.equal(JSON.parse([...h.memory.values()][0]).runs, 1);
  h.action('restart'); h.frame(400); assert.notEqual(h.context.testGame, g); assert.equal(h.context.testGame.player.level, 1);
});
test('missing atlas blocks deployment with an explicit loading failure', async () => {
  const h = await harness({ failedImage: true }); assert.equal(h.nodes.get('deploy').disabled, true);
  assert.match(h.nodes.get('asset-status').textContent, /Не удалось загрузить/); h.click('deploy'); assert.equal(h.context.testGame, undefined);
});
test('unavailable storage does not block playable deployment or results', async () => {
  const h = await harness({ blockedStorage: true }); h.click('deploy'); h.frame(16); h.context.testGame.status = 'dead'; h.frame(32);
  assert.equal(h.nodes.get('notice').hidden, false); assert.match(h.nodes.get('notice').textContent, /Хранилище недоступно/);
});
