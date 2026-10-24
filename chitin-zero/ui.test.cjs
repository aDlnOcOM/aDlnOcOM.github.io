const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scripts = ['data.js', 'economy.js', 'view.js', 'core.js', 'combat.js', 'storage.js', 'audio.js', 'sprites.js', 'render.js', 'app.js'];

async function harness({ failedImage = false, wrongImageSize = false, blockedStorage = false, savedProfile = null } = {}) {
  const nodes = new Map(), drawCalls = [], callbacks = [], documentListeners = {}, windowListeners = {};
  let document;
  class Element {
    constructor(id = '', tag = 'DIV') { this.id = id; this.tagName = tag; this.style = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this.listeners = {}; this.clientWidth = 1280; this.clientHeight = 800; this.width = 640; this.height = 640; this.value = ''; this.textContent = ''; this.html = ''; this.children = []; this.classList = { toggle() {} }; }
    set innerHTML(value) {
      this.html = value; this.children = [];
      for (const match of value.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) nodes.set(match[2], new Element(match[2], match[1].toUpperCase()));
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
    requestPointerLock() { document.pointerLockElement = this; for (const fn of documentListeners.pointerlockchange || []) fn(); return Promise.resolve(); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 112, height: 112 }; }
    getContext() {
      return new Proxy({}, { get: (target, key) => {
        if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (key === 'drawImage') return (...args) => { assert.ok(args[0], 'drawable image'); if (args.length === 9) { for (let i = 1; i < 9; i++) assert.ok(Number.isFinite(args[i]), `finite crop ${i}`); assert.ok(args[1] >= 0 && args[2] >= 0); assert.ok(args[1] + args[3] <= args[0].naturalWidth + .01); assert.ok(args[2] + args[4] <= args[0].naturalHeight + .01); } drawCalls.push(args.length); };
        if (key === 'arc') return (x, y, radius) => { assert.ok(Number.isFinite(radius) && radius >= 0); };
        return target[key] || (() => {});
      }, set: (target, key, value) => { target[key] = value; return true; } });
    }
  }
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) { const node = new Element(match[2], match[1].toUpperCase()); node.hidden = /\bhidden\b/.test(match[0]); node.disabled = /\bdisabled\b/.test(match[0]); nodes.set(match[2], node); }
  document = { getElementById(id) { assert.ok(nodes.has(id), `known DOM id ${id}`); return nodes.get(id); }, activeElement: null, body: new Element('body'), hidden: false,
    pointerLockElement: null, exitPointerLock() { this.pointerLockElement = null; for (const fn of documentListeners.pointerlockchange || []) fn(); },
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); } };
  const memory = new Map();
  if (savedProfile) memory.set('chitin-zero:v1', JSON.stringify(savedProfile));
  const context = vm.createContext({ document, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    localStorage: blockedStorage ? null : { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: cb => callbacks.push(cb), setTimeout: () => 1, clearTimeout() {},
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
    Image: class { set src(value) {
      this.source = value; const buffer = fs.readFileSync(path.join(__dirname, value));
      const svg = value.endsWith('.svg') ? buffer.toString('utf8') : null;
      this.naturalWidth = wrongImageSize && value.includes('directions') ? 100 : svg ? Number(svg.match(/\bwidth="(\d+)"/)[1]) : buffer.readUInt32BE(16);
      this.naturalHeight = svg ? Number(svg.match(/\bheight="(\d+)"/)[1]) : buffer.readUInt32BE(20);
      queueMicrotask(() => failedImage ? this.onerror() : this.onload());
    } async decode() {} }
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
    keyUp(code) { emit(documentListeners, 'keyup', { code }); },
    pointer(type, event) { emit(nodes.get('world').listeners, type, event); },
    elementEvent(id, type, event) { emit(nodes.get(id).listeners, type, event); },
    documentEvent(type, event) { emit(documentListeners, type, event); },
    windowEvent(type, event) { emit(windowListeners, type, event); },
    blur() { emit(windowListeners, 'blur'); },
    chooseChassis(id) { const button = nodes.get('chassis-options').children.find(e => e.dataset.chassis === id); emit(documentListeners, 'click', { target: button }); }
  };
}

test('all script and asset references are local files with expected metadata', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.deepEqual([...html.matchAll(/<script defer src="([^"]+)"/g)].map(m => m[1]), scripts);
  for (const script of scripts) assert.ok(fs.existsSync(path.join(__dirname, script)));
  const { manifest } = require('./sprites.js');
  for (const [name, asset] of Object.entries(manifest)) {
    const png = fs.readFileSync(path.join(__dirname, asset.src));
    if (asset.src.endsWith('.svg')) { const source = png.toString('utf8'); assert.match(source, new RegExp(`width="${asset.width}"`)); assert.match(source, new RegExp(`height="${asset.height}"`)); continue; }
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), asset.width || 1254); assert.equal(png.readUInt32BE(20), asset.height || 1254);
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
  assert.ok(h.drawCalls.length > 0); assert.equal(h.context.testGame.status, 'playing');
  assert.equal(h.context.testGame.player.pitch, -.08); assert.ok(h.context.testGame.bullets.every(b => Number.isFinite(b.z)));
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

test('wrong directional atlas dimensions block deployment instead of sampling out of bounds', async () => {
  const h = await harness({ wrongImageSize: true });
  assert.equal(h.nodes.get('deploy').disabled, true);
  assert.match(h.nodes.get('asset-status').textContent, /Не удалось загрузить/);
  h.click('deploy'); assert.equal(h.context.testGame, undefined);
});

test('market pagination reaches all 80 models and slot filters keep all sixteen choices', async () => {
  const h = await harness({ savedProfile: { version: 1, credits: 100000 } }); h.click('market');
  const ids = new Set();
  for (let page = 0; page < 7; page++) {
    for (const button of h.nodes.get('dialog-body').children) if (button.dataset.buy) ids.add(button.dataset.buy);
    if (page < 6) h.action(page + 1, 'page');
  }
  assert.equal(ids.size, 80); assert.match(h.nodes.get('dialog-body').innerHTML, /СТРАНИЦА 7\/7/);
  h.action('weapon', 'filter'); assert.match(h.nodes.get('dialog-body').innerHTML, /МОДЕЛЕЙ: 16/);
  h.action(1, 'page'); assert.match(h.nodes.get('dialog-body').innerHTML, /СТРАНИЦА 2\/2/);
  h.action('armor', 'filter'); assert.match(h.nodes.get('dialog-body').innerHTML, /СТРАНИЦА 1\/2/);
});

test('quality purchase and upgrade persist through workshop installation and deployment', async () => {
  const h = await harness({ savedProfile: { version: 1, credits: 10000 } }); h.click('market');
  h.action('salvaged', 'quality'); h.action('jet', 'buy');
  let saved = JSON.parse([...h.memory.values()][0]); assert.equal(saved.partQualities.jet, 'salvaged');
  h.action('pristine', 'quality'); assert.match(h.nodes.get('dialog-body').innerHTML, /ПОВЫСИТЬ КАЧЕСТВО/); h.action('jet', 'buy');
  saved = JSON.parse([...h.memory.values()][0]); assert.equal(saved.credits, 10000 - h.context.ChitinEconomy.resolvePart('jet', 'pristine').price);
  assert.equal(saved.ownedParts.length, 1); assert.equal(saved.partQualities.jet, 'pristine');
  h.action('workshop'); assert.match(h.nodes.get('dialog-body').innerHTML, /Эталонное/); h.action('jet', 'equip');
  h.action('close-garage'); h.click('deploy');
  assert.equal(h.context.testGame.player.installedQualities.jet, 'pristine');
  assert.ok(Math.abs(h.context.testGame.player.stats.speed - 1.198) < 1e-9);
});
test('unavailable storage does not block playable deployment or results', async () => {
  const h = await harness({ blockedStorage: true }); h.click('deploy'); h.frame(16); h.context.testGame.status = 'dead'; h.frame(32);
  assert.equal(h.nodes.get('notice').hidden, false); assert.match(h.nodes.get('notice').textContent, /Хранилище недоступно/);
});

test('black market purchase, visual assembly, deployment and persisted bounty work end to end', async () => {
  const h = await harness({ savedProfile: { version: 1, credits: 1000 } });
  h.click('market'); assert.match(h.nodes.get('dialog-title').textContent, /ЧЁРНЫЙ РЫНОК/);
  h.action('jet', 'buy'); assert.equal(JSON.parse([...h.memory.values()][0]).credits, 820);
  h.action('workshop'); h.action('jet', 'equip'); h.frame(20);
  assert.match(h.nodes.get('loadout-summary').textContent, /Кочевник/);
  h.action('close-garage'); h.click('deploy'); h.frame(40);
  const g = h.context.testGame; assert.equal(g.player.installedParts.drive, 'jet'); assert.equal(g.player.stats.speed, 1.12);
  const enemy = g.spawn('mite', 500, 0); g.hurtEnemy(enemy, 999); g.status = 'dead'; h.frame(60);
  assert.equal(JSON.parse([...h.memory.values()][0]).credits, 822); assert.equal(g.bountyPaid, 2);
  h.action('hangar'); h.click('workshop'); h.action('drive', 'remove'); h.action('close-garage');
  const saved = JSON.parse([...h.memory.values()][0]); assert.equal(saved.credits, 822); assert.ok(saved.ownedParts.includes('jet'));
  assert.deepEqual(saved.loadouts.spectre, {});
  const reloaded = await harness({ savedProfile: saved }); assert.equal(reloaded.nodes.get('wallet').textContent, '822 AC');
});

test('save failure leaves the market balance and pending end-of-run bounty intact', async () => {
  const h = await harness({ savedProfile: { version: 1, credits: 500 } });
  const setter = h.context.localStorage.setItem;
  h.context.localStorage.setItem = () => { throw new Error('quota'); };
  h.click('market'); h.action('jet', 'buy'); assert.match(h.nodes.get('notice').textContent, /Баланс не изменён/);
  assert.equal(h.nodes.get('wallet').textContent, '500 AC');
  h.action('close-garage'); h.click('deploy'); h.frame(20); const g = h.context.testGame;
  g.hurtEnemy(g.spawn('mite', 500, 0), 999); g.status = 'dead'; h.frame(40);
  h.action('restart'); assert.equal(h.context.testGame, g); assert.equal(h.nodes.get('modal').hidden, false); assert.equal(g.bountyPaid, 0);
  h.context.localStorage.setItem = setter; h.action('restart'); assert.notEqual(h.context.testGame, g);
  assert.equal(JSON.parse([...h.memory.values()][0]).credits, 502);
});
test('a player can explicitly forfeit only unsaved bounty when storage stays unavailable', async () => {
  const h = await harness({ blockedStorage: true }); h.click('deploy'); h.frame(20);
  const g = h.context.testGame; g.hurtEnemy(g.spawn('mite', 500, 0), 999); g.status = 'dead'; h.frame(40);
  h.action('bounty-loss'); assert.match(h.nodes.get('dialog-title').textContent, /БЕЗ СОХРАНЕНИЯ/);
  h.action('keep-bounty'); assert.equal(g.bountyPaid, 0);
  h.action('bounty-loss'); h.action('forfeit-bounty'); assert.equal(h.nodes.get('hangar').hidden, false);
  h.click('deploy'); assert.notEqual(h.context.testGame, g);
});

test('FPS pointer lock turns view, releases on upgrade and pauses on unexpected loss', async () => {
  const h = await harness(); h.click('deploy'); h.frame(20); const g = h.context.testGame;
  assert.equal(h.document.pointerLockElement, h.nodes.get('world'));
  h.documentEvent('mousemove', { movementX: 100, movementY: 30 }); h.frame(40);
  assert.ok(g.player.angle > Math.PI / 2); assert.ok(g.player.pitch < -.08);
  h.document.exitPointerLock(); assert.equal(g.status, 'paused');
  const p = JSON.stringify(g.player); h.frame(60); assert.equal(JSON.stringify(g.player), p);
  h.action('resume'); assert.equal(h.document.pointerLockElement, h.nodes.get('world'));
  g.addXp(20); h.frame(90); assert.equal(g.status, 'upgrade'); assert.equal(h.document.pointerLockElement, null);
  h.action(0, 'choice'); assert.equal(g.status, 'playing'); assert.equal(h.document.pointerLockElement, h.nodes.get('world'));
});

test('FPS W is forward, A/D strafe, arrow keys turn and F gates continuous fire', async () => {
  const h = await harness(); h.click('deploy'); h.frame(20); const g = h.context.testGame;
  g.spawnClock = 1e9; const startY = g.player.y;
  h.key('KeyW'); h.frame(150); h.keyUp('KeyW'); assert.ok(g.player.y > startY); assert.ok(Math.abs(g.player.x) < .001);
  h.key('ArrowRight'); h.frame(280); h.keyUp('ArrowRight'); assert.ok(g.player.angle > Math.PI / 2);
  h.key('KeyF'); h.keyUp('KeyF'); h.frame(410); const serial = g.shotSerial;
  h.frame(540); h.frame(670); assert.equal(g.shotSerial, serial);
  h.pointer('pointerdown', { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100 });
  h.frame(800); assert.ok(g.shotSerial > serial);
  h.windowEvent('pointerup', { pointerId: 1 });
});

test('fallback drag and simultaneous touch move/look work without pointer lock and ignore paused motion', async () => {
  const h = await harness(); h.nodes.get('world').requestPointerLock = undefined; h.click('deploy'); h.frame(20); const g = h.context.testGame;
  h.pointer('pointerdown', { button: 0, pointerId: 9, pointerType: 'touch', clientX: 200, clientY: 150 });
  h.pointer('pointermove', { pointerId: 9, pointerType: 'touch', clientX: 240, clientY: 120 });
  h.elementEvent('joystick', 'pointerdown', { pointerId: 8, clientX: 56, clientY: 18 });
  h.frame(100); h.windowEvent('pointerup', { pointerId: 8 }); assert.ok(g.player.angle > Math.PI / 2); assert.ok(g.player.pitch > -.08); assert.ok(g.player.y > 0);
  h.windowEvent('pointercancel', { pointerId: 9 }); const angle = g.player.angle;
  h.pointer('pointermove', { pointerId: 9, pointerType: 'touch', clientX: 400, clientY: 300 }); h.frame(130); assert.equal(g.player.angle, angle);
  h.key('KeyP'); h.frame(150); const state = JSON.stringify(g.player);
  h.pointer('pointermove', { pointerId: 9, pointerType: 'touch', clientX: 100, clientY: 100 }); h.frame(250); assert.equal(JSON.stringify(g.player), state);
});
