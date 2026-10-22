(function (root) {
  'use strict';
  class AudioEngine {
    constructor() { this.context = null; this.enabled = true; this.last = {}; }
    async unlock() {
      if (!this.enabled) return;
      try {
        if (!this.context) { const Context = root.AudioContext || root.webkitAudioContext; if (Context) this.context = new Context(); }
        if (this.context?.state === 'suspended') await this.context.resume();
      } catch { /* Audio is optional; rejected autoplay never blocks deployment. */ }
    }
    tone(kind) {
      const ctx = this.context;
      if (!this.enabled || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (t - (this.last[kind] ?? -10) < (kind === 'shot' ? .075 : .12)) return;
      this.last[kind] = t;
      const sound = {
        shot: [145, 52, .065, 'sawtooth', .025], hit: [80, 32, .12, 'square', .022],
        upgrade: [420, 960, .22, 'sine', .05], core: [80, 620, .5, 'sawtooth', .025],
        dash: [300, 65, .16, 'triangle', .045], death: [180, 28, .7, 'sawtooth', .035],
        select: [560, 780, .06, 'sine', .035]
      }[kind];
      if (!sound) return;
      const [start, end, duration, type, volume] = sound;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(start, t); oscillator.frequency.exponentialRampToValueAtTime(end, t + duration);
      gain.gain.setValueAtTime(.001, t); gain.gain.linearRampToValueAtTime(volume, t + .009); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(t); oscillator.stop(t + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  root.ChitinAudio = AudioEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
