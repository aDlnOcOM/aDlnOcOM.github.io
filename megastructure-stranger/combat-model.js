/* Shared combat model: hit zones, layered protection and temporary trauma. */
(() => {
  'use strict';

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const zones = {
    head: { name: 'Голова', share: .12, multiplier: 1.9, critical: true },
    thorax: { name: 'Торс', share: .42, multiplier: 1, critical: true },
    abdomen: { name: 'Живот', share: .2, multiplier: .82, critical: false },
    arms: { name: 'Руки', share: .14, multiplier: .54, critical: false },
    legs: { name: 'Ноги', share: .12, multiplier: .48, critical: false }
  };
  const order = Object.keys(zones);
  const material = {
    soft: { ballistic: .55, energy: .22, elemental: .18, mechanical: .38, blunt: .28 },
    steel: { ballistic: .72, energy: .35, elemental: .32, mechanical: .58, blunt: .64 },
    ceramic: { ballistic: .84, energy: .52, elemental: .3, mechanical: .38, blunt: .48 },
    composite: { ballistic: .68, energy: .58, elemental: .48, mechanical: .55, blunt: .51 },
    polyethylene: { ballistic: .78, energy: .18, elemental: .14, mechanical: .46, blunt: .38 }
  };
  const defaultStatus = () => ({ bleed: 0, burn: 0, shock: 0, fracture: 0, suppression: 0 });

  function createBody(maxHealth = 100) {
    const max = Math.max(1, finite(maxHealth, 100));
    const parts = {};
    for (const [id, zone] of Object.entries(zones)) {
      const value = Math.max(1, Math.round(max * zone.share));
      parts[id] = { max: value, health: value };
    }
    return { max, health: max, parts, status: defaultStatus(), lastZone: 'thorax' };
  }

  function zoneFor(seed = 0) {
    const value = ((finite(seed) % 1) + 1) % 1;
    let cursor = 0;
    for (const id of order) {
      cursor += zones[id].share;
      if (value < cursor) return id;
    }
    return 'legs';
  }

  function chooseZone(impact = {}, target = {}) {
    if (zones[impact.zone]) return impact.zone;
    const sx = finite(impact.x, 0) * .017 + finite(impact.vx, 0) * .0013;
    const sy = finite(impact.y, 0) * .023 + finite(impact.vy, 0) * .0009;
    const tx = finite(target.x, 0) * .007 + finite(target.y, 0) * .011;
    return zoneFor(Math.abs(Math.sin(sx + sy + tx) * 43758.5453));
  }

  function penetrationRatio(penetration) {
    return clamp(finite(penetration), 0, .95);
  }

  function layerReduction(layer, type, penetration) {
    const integrity = clamp(finite(layer?.integrity, 100), 0, 100) / 100;
    const protection = Math.max(0, finite(layer?.protection, 0));
    const resistance = material[layer?.material] || material.soft;
    const typed = resistance[type] ?? resistance.blunt;
    return protection * typed * integrity * (1 - penetrationRatio(penetration) * .72);
  }

  function applyLayers(amount, type, penetration, layers = []) {
    let remaining = Math.max(0, finite(amount));
    let blocked = 0;
    let blunt = 0;
    const damaged = [];
    for (const layer of layers) {
      if (remaining <= 0 || !layer || layer.coverage === false) continue;
      const reduction = Math.min(remaining, layerReduction(layer, type, penetration));
      if (reduction <= 0) continue;
      remaining -= reduction;
      blocked += reduction;
      blunt += reduction * (layer.material === 'ceramic' ? .1 : .18);
      const wear = reduction * (layer.material === 'ceramic' ? .95 : .42) * (1 + penetrationRatio(penetration));
      if (typeof layer.damage === 'function') layer.damage(wear);
      damaged.push({ id: layer.id || layer.material || 'layer', wear });
    }
    return { remaining, blocked, blunt, damaged };
  }

  function sumHealth(body) {
    return Math.max(0, Object.values(body.parts).reduce((sum, part) => sum + Math.max(0, part.health), 0));
  }

  function applyStatus(body, zone, raw, unblocked, type) {
    const status = body.status ||= defaultStatus();
    const ratio = raw / Math.max(1, body.max);
    if (type === 'elemental') status.burn = clamp(status.burn + ratio * 18, 0, 1);
    if (type === 'ballistic' && unblocked > 3) status.bleed = clamp(status.bleed + ratio * 15, 0, 1);
    if (zone === 'legs' && unblocked > 8) status.fracture = clamp(status.fracture + ratio * 9, 0, 1);
    if (raw > body.max * .1 || zone === 'head') status.shock = clamp(status.shock + ratio * 12, 0, 1);
    status.suppression = clamp(status.suppression + ratio * 8, 0, 1);
  }

  function receive(body, impact, layers = []) {
    const target = body || createBody();
    const type = impact?.type || 'mechanical';
    const zone = chooseZone(impact, impact?.target);
    const raw = Math.max(0, finite(impact?.amount));
    const layered = applyLayers(raw, type, impact?.penetration, layers);
    const zoneData = zones[zone];
    const wound = Math.max(0, layered.remaining * zoneData.multiplier + layered.blunt);
    const part = target.parts[zone] || target.parts.thorax;
    part.health = Math.max(0, part.health - wound);
    target.lastZone = zone;
    applyStatus(target, zone, raw, layered.remaining, type);
    target.health = Math.min(target.max, sumHealth(target));
    const critical = zoneData.critical && part.health <= 0;
    return { zone, raw, wound, critical, killed: target.health <= 0 || critical, ...layered, health: target.health };
  }

  function tick(body, delta) {
    if (!body?.status) return body;
    const dt = clamp(finite(delta), 0, .2);
    const status = body.status;
    const bleed = status.bleed * dt * Math.max(1, body.max * .012);
    const burn = status.burn * dt * Math.max(1, body.max * .009);
    if (bleed + burn > 0) {
      const part = body.parts[body.lastZone] || body.parts.thorax;
      part.health = Math.max(0, part.health - bleed - burn);
      body.health = Math.max(0, sumHealth(body));
    }
    status.suppression = Math.max(0, status.suppression - dt * .42);
    status.shock = Math.max(0, status.shock - dt * .06);
    status.burn = Math.max(0, status.burn - dt * .012);
    return body;
  }

  function movementMultiplier(body) {
    const status = body?.status || defaultStatus();
    const legs = body?.parts?.legs;
    const legRatio = legs ? legs.health / Math.max(1, legs.max) : 1;
    return clamp(1 - status.fracture * .34 - status.shock * .13 - (1 - legRatio) * .18, .35, 1);
  }

  function aimMultiplier(body) {
    const status = body?.status || defaultStatus();
    const arms = body?.parts?.arms;
    const armRatio = arms ? arms.health / Math.max(1, arms.max) : 1;
    return clamp(1 + status.suppression * .9 + status.shock * .55 + (1 - armRatio) * .45, 1, 2.4);
  }

  function statusLabel(body) {
    const status = body?.status || defaultStatus();
    const active = [];
    if (status.bleed > .03) active.push('КРОВОТЕЧЕНИЕ');
    if (status.burn > .03) active.push('ОЖОГ');
    if (status.fracture > .03) active.push('ТРАВМА НОГ');
    if (status.shock > .12) active.push('ШОК');
    return active.join(' · ') || 'СТАБИЛЕН';
  }

  window.CombatModel = { zones, material, createBody, zoneFor, chooseZone, applyLayers, receive, tick, movementMultiplier, aimMultiplier, statusLabel };
})();
