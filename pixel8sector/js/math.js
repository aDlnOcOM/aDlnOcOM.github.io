/*
 * Module: math.js
 * Responsibility: deterministic random, vector, angle, interpolation, and grid helpers shared by the game.
 */
(() => {
  'use strict';

  function hash2(x, y, seed = 0) {
    let h = seed ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x119de1f3);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussianishRandom() {
    return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  }

  function normalizedVector(x, y) {
    const length = Math.hypot(x, y);
    if (length < 0.0001) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function floorDiv(value, divisor) {
    return Math.floor(value / divisor);
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  window.PixelSectorMath = Object.freeze({
    hash2,
    mulberry32,
    gaussianishRandom,
    normalizedVector,
    modulo,
    floorDiv,
    normalizeAngle,
    clamp,
    lerp
  });
})();