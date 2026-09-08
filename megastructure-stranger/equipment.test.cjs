const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// In-memory saves and DOM doubles: never reads or changes the player's save.
function game(saved = {}) {
  let stored = JSON.stringify(saved);
  const node = () => ({ width: 960, height: 600, getContext: () => ({}),
    addEventListener() {}, appendChild() {} });
  const scope = { window: {}, document: { getElementById: node, createElement: node },
    performance: { now: () => 0 }, localStorage: {
      getItem: () => stored, setItem: (_, value) => { stored = value; }
    } };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'equipment.js'), 'utf8'), scope);
  const source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('  function generateFloor(')) +
    'window.test = { trees: EQUIPMENT_TREES, progression, playerStats, createEquipmentProgress, purchaseTreeChoice, purchaseTreeTier }; })();', scope);
  return { ...scope.window.test, saved: () => JSON.parse(stored) };
}

test('all seven items have developed trees with unique, priced descendants', () => {
  const { trees } = game();
  assert.equal(Object.keys(trees).length, 7);
  for (const tree of Object.values(trees)) {
    assert.ok(tree.branches.length >= 3);
    assert.equal(new Set(tree.branches.map(branch => branch.id)).size, tree.branches.length);
    for (const branch of tree.branches) {
      assert.equal(branch.options.length, 2);
      assert.notEqual(branch.options[0].id, branch.options[1].id);
      for (const option of branch.options) {
        assert.ok(option.cost > 0 && option.tier.cost > 0);
        assert.ok(option.effect && option.tier.effect);
      }
    }
  }
});

test('old saves retain upgrades and receive empty new branches', () => {
  const state = game({ salvage: 83, equipment: { knife: { blade: { choice: 'serrated', tier: true } } } });
  assert.equal(state.progression.equipment.knife.blade.choice, 'serrated');
  assert.equal(state.progression.equipment.knife.blade.tier, true);
  assert.equal(state.progression.equipment.knife.balance.choice, null);
  assert.equal(state.playerStats().knifeDamage, 58);
  const invalid = state.createEquipmentProgress({ knife: { blade: { choice: 'unknown', tier: true } } });
  assert.equal(invalid.knife.blade.choice, null);
  assert.equal(invalid.knife.blade.tier, false);
});

test('every branch enforces its parent, exclusive choice, price and one-time tier', () => {
  for (const [gear, tree] of Object.entries(game().trees)) {
    for (const branch of tree.branches) {
      const state = game({ salvage: 1000 });
      const [option, rival] = branch.options;
      state.purchaseTreeTier(gear, branch, option);
      assert.equal(state.progression.salvage, 1000);
      state.purchaseTreeChoice(gear, branch, option);
      state.purchaseTreeChoice(gear, branch, rival);
      state.purchaseTreeChoice(gear, branch, option);
      assert.equal(state.progression.salvage, 1000 - option.cost);
      state.purchaseTreeTier(gear, branch, rival);
      state.purchaseTreeTier(gear, branch, option);
      state.purchaseTreeTier(gear, branch, option);
      assert.equal(state.progression.salvage, 1000 - option.cost - option.tier.cost);
      const reloaded = game(state.saved());
      assert.equal(reloaded.progression.equipment[gear][branch.id].tier, true);
      assert.deepEqual({ ...reloaded.playerStats() }, { ...state.playerStats() });
    }
  }
});

test('insufficient salvage cannot buy a choice or descendant', () => {
  const state = game();
  const branch = state.trees.knife.branches[1];
  state.purchaseTreeChoice('knife', branch, branch.options[0]);
  assert.equal(state.progression.equipment.knife.balance.choice, null);
  state.progression.salvage = branch.options[0].cost;
  state.purchaseTreeChoice('knife', branch, branch.options[0]);
  state.purchaseTreeTier('knife', branch, branch.options[0]);
  assert.equal(state.progression.equipment.knife.balance.tier, false);
  assert.equal(state.progression.salvage, 0);
});

test('each new module and its tier applies its declared gameplay bonus exactly once', () => {
  for (const [gear, tree] of Object.entries(game().trees)) {
    for (const branch of tree.branches) {
      for (const option of branch.options.filter(option => option.bonus)) {
        const state = game({ salvage: 1000 });
        const before = state.playerStats();
        state.purchaseTreeChoice(gear, branch, option);
        const middle = state.playerStats();
        state.purchaseTreeTier(gear, branch, option);
        const after = state.playerStats();
        for (const [stat, bonus] of Object.entries(option.bonus)) {
          assert.ok(Math.abs(middle[stat] - before[stat] - bonus) < 1e-9);
          assert.ok(Math.abs(after[stat] - middle[stat] - option.tier.bonus[stat]) < 1e-9);
        }
        assert.ok(Object.values(after).every(Number.isFinite));
      }
    }
  }
});
