import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { structureGeometry } from '../structure-geometry.mjs';
import { structurePlan } from '../structure-space.mjs';
import { buildAssets } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function references(text, extension) {
  const result = [];
  if (extension === '.html') for (const m of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) result.push(m[1]);
  if (extension === '.css') for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"\s)]+))\s*\)/g)) result.push(m[1] ?? m[2] ?? m[3]);
  if (['.js', '.mjs', '.html'].includes(extension)) for (const m of text.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) result.push(m[1]);
  return result.filter(value => value !== './' && !value.startsWith('#') && !value.startsWith('data:'));
}

test('the entire startup asset graph is local, present, and valid under /incrementalis/', async () => {
  const pending = [resolve(root, 'index.html')], checked = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (checked.has(file)) continue;
    checked.add(file);
    assert.ok((await stat(file)).isFile(), `${file} must exist`);
    const extension = extname(file);
    if (!['.html', '.css', '.js', '.mjs'].includes(extension)) continue;
    const source = await readFile(file, 'utf8');
    for (const ref of references(source, extension)) {
      assert.ok(!/^(?:https?:|\/\/)/.test(ref), `${ref} must not require an external service`);
      assert.ok(ref.startsWith('./') || ref.startsWith('../'), `${ref} must be relative to its source`);
      const target = resolve(dirname(file), ref);
      assert.ok(!relative(root, target).startsWith('..' + sep), 'assets must remain within the game directory');
      pending.push(target);
    }
  }
  assert.ok(checked.has(resolve(root, 'game.bundle.js')));
  assert.ok(checked.has(resolve(root, 'assets/fonts/fonts.bundle.css')));
});

test('direct-file startup uses classic scripts and embedded fonts without module or font requests', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const [, attributes, inline] of scripts) {
    assert.doesNotMatch(attributes, /\btype\s*=\s*["']module["']/);
    const src = /\bsrc=["']([^"']+)["']/.exec(attributes)?.[1];
    const code = src ? await readFile(resolve(root, src), 'utf8') : inline;
    assert.doesNotMatch(code, /\bimport\s*\(/, 'startup must not request ES modules');
    assert.doesNotThrow(() => new Script(code), `${src || 'inline script'} must parse as a classic script`);
  }
  assert.doesNotMatch(html, /as=["']font["']/, 'do not preload file:// font URLs');
  const fonts = await readFile(resolve(root, 'assets/fonts/fonts.bundle.css'), 'utf8');
  const sources = [...fonts.matchAll(/url\('data:font\/woff2;base64,([^']+)'\)/g)];
  assert.equal(sources.length, 6);
  assert.deepEqual(references(fonts, '.css'), [], 'fonts must not make separate file requests');
  for (const [, encoded] of sources) {
    const data = Buffer.from(encoded, 'base64');
    assert.equal(data.toString('ascii', 0, 4), 'wOF2');
    assert.equal(data.readUInt32BE(8), data.length);
  }
});

test('published bundles match the current game modules and font sources', async () => {
  for (const [name, expected] of await buildAssets()) {
    const actual = await readFile(resolve(root, name), 'utf8');
    // Keep failures readable; font bundles contain long base64 strings.
    assert.ok(actual.replace(/\r\n/g, '\n') === expected, `${name} is stale: run node scripts/build.mjs`);
  }
});

test('embedded classic worker builds the same geometry without network or module loading', async () => {
  const bundle = await readFile(resolve(root, 'game.bundle.js'), 'utf8');
  const source = JSON.parse(/globalThis\.incrementalisWorkerSource = (.+);\n/.exec(bundle)[1]);
  let answer, transfer;
  const self = { postMessage: (value, buffers) => { answer = value; transfer = buffers; } };
  new Script(source).runInNewContext({ self });
  const request = { cell: [8, -2, 4], seed: 93, detail: 1, key: '8:-2:4' };
  self.onmessage({ data: request });
  const expected = structureGeometry(structurePlan(request.cell, request.seed), request.detail);
  assert.equal(answer.key, request.key); assert.equal(answer.indices.length * 10, expected.geometry.data.length);
  assert.ok(expected.geometry.data.every((v, i) => Math.fround(v) === answer.vertices[answer.indices[Math.floor(i / 10)] * 10 + i % 10]));
  assert.equal(transfer[0], answer.vertices.buffer); assert.equal(transfer[1], answer.indices.buffer);
  assert.equal(answer.colliders.length, expected.colliders.length);
});

test('font assets contain complete WOFF2 data and the upstream redistribution licenses', async () => {
  const directory = resolve(root, 'assets/fonts');
  for (const name of await readdir(directory)) if (name.endsWith('.woff2')) {
    const data = await readFile(resolve(directory, name));
    assert.equal(data.toString('ascii', 0, 4), 'wOF2', name);
    assert.equal(data.readUInt32BE(8), data.length, `${name} must not be truncated`);
  }
  for (const name of ['CormorantGaramond-OFL.txt', 'Manrope-OFL.txt']) {
    assert.match(await readFile(resolve(directory, name), 'utf8'), /SIL OPEN FONT LICENSE/);
  }
});
