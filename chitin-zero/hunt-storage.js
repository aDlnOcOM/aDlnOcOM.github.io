(function (root) {
  'use strict';
  const D = root.HuntData || require('./hunt-data.js');
  const KEY = 'nightfall-hunt:v1';
  const integer = (n, max = 1e9) => Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
  function sanitize(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    return { version: 1, coins: integer(value.coins), kills: integer(value.kills), runs: integer(value.runs), best: integer(value.best),
      meta: Object.fromEntries(Object.entries(D.meta).map(([id, s]) => [id, integer(value.meta?.[id], s.max)])),
      hunter: Object.hasOwn(D.hunters, value.hunter) ? value.hunter : 'mara',
      arena: Object.hasOwn(D.arenas, value.arena) ? value.arena : 'cemetery', endless: value.endless !== false,
      sound: value.sound !== false, reduced: value.reduced === true,
      receipts: Array.isArray(value.receipts) ? value.receipts.filter(v => typeof v === 'string' && v.length < 100).slice(-100) : [] };
  }
  function cost(rank) { return 50 + rank * 75; }
  class Store {
    constructor(storage) {
      this.storage = storage; this.error = ''; this.profile = sanitize();
      try { const raw = storage?.getItem(KEY); if (raw) this.profile = sanitize(JSON.parse(raw)); if (!storage) this.error = 'Сохранения недоступны'; }
      catch { this.error = 'Сохранение не прочитано. Старые данные не изменены.'; }
    }
    save(next) {
      const clean = sanitize(next);
      try { if (!this.storage) throw Error(); this.storage.setItem(KEY, JSON.stringify(clean)); this.profile = clean; this.error = ''; return true; }
      catch { this.error = 'Не удалось сохранить. Разреши хранилище сайта и повтори.'; return false; }
    }
    purchase(id) {
      const p = this.profile, spec = D.meta[id]; if (!Object.hasOwn(D.meta, id) || !spec || p.meta[id] >= spec.max || p.coins < cost(p.meta[id])) return false;
      return this.save({ ...p, coins: p.coins - cost(p.meta[id]), meta: { ...p.meta, [id]: p.meta[id] + 1 } });
    }
    reward(id, game) {
      if (this.profile.receipts.includes(id)) return true;
      if (!['dead', 'won', 'abandoned'].includes(game.status)) return false;
      const p = this.profile, reward = integer(Math.floor(game.coins * game.player.fortune));
      return this.save({ ...p, coins: p.coins + reward, runs: p.runs + 1, kills: p.kills + game.kills,
        best: Math.max(p.best, Math.floor(game.time)), receipts: [...p.receipts, id] });
    }
  }
  const api = { Store, sanitize, cost, KEY }; root.HuntStorage = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
