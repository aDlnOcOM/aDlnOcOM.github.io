const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('game and editor HTML reference existing local resources', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['index.html', 'enemy-editor.html']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const resource = match[1].split('?')[0];
      if (resource.includes('://') || resource.startsWith('#')) continue;
      assert.ok(fs.existsSync(path.join(root, resource)), `${file}: missing ${resource}`);
    }
  }
});
