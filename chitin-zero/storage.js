(function (root) {
  'use strict';
  const D = root.ChitinData || require('./data.js');
  const KEY = 'chitin-zero:v1';
  const fresh = () => ({ version: 1, bestKills: 0, bestTime: 0, runs: 0, totalKills: 0, chassis: 'spectre', core: 'inferno', sound: true, reducedEffects: false, history: [] });
  const number = value => Number.isFinite(value) ? Math.min(1e12, Math.max(0, value)) : 0;
  function sanitize(raw) {
    const safe = fresh();
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return safe;
    for (const key of ['bestKills', 'bestTime', 'runs', 'totalKills']) safe[key] = number(raw[key]);
    if (Object.hasOwn(D.chassis, raw.chassis)) safe.chassis = raw.chassis;
    if (Object.hasOwn(D.cores, raw.core)) safe.core = raw.core;
    if (typeof raw.sound === 'boolean') safe.sound = raw.sound;
    if (typeof raw.reducedEffects === 'boolean') safe.reducedEffects = raw.reducedEffects;
    if (Array.isArray(raw.history)) safe.history = raw.history.slice(0, 8).filter(r => r && typeof r === 'object').map(r => ({
      kills: number(r.kills), time: number(r.time), level: number(r.level), bosses: number(r.bosses),
      chassis: Object.hasOwn(D.chassis, r.chassis) ? r.chassis : 'spectre'
    }));
    return safe;
  }
  function load(storage) { try { return sanitize(JSON.parse(storage.getItem(KEY))); } catch { return fresh(); } }
  function save(storage, data) { try { storage.setItem(KEY, JSON.stringify(sanitize(data))); return true; } catch { return false; } }
  function record(data, game) {
    // A run may be rendered many times, but it must be credited only once.
    if (game.recorded || game.status !== 'dead') return false;
    game.recorded = true; data.runs++; data.totalKills += game.kills;
    data.bestKills = Math.max(data.bestKills, game.kills); data.bestTime = Math.max(data.bestTime, game.time);
    data.history.unshift({ kills: game.kills, time: game.time, level: game.player.level, bosses: game.bossKills, chassis: game.player.chassis });
    data.history = data.history.slice(0, 8); return true;
  }
  const api = { KEY, fresh, sanitize, load, save, record };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChitinStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
