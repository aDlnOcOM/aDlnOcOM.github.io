(async () => {
  const VS = window.Voidspace;
  const manifest = Object.fromEntries(Object.entries(VS.Visuals.MANIFEST).map(([key, source]) => [key, `../${source}`]));
  manifest.module_drill = '../assets/modules/drill.png';
  const images = VS.Visuals.prepare(await VS.Utils.loadImages(manifest));
  const cards = [];
  for (const [type, definition] of Object.entries(VS.ModuleSystem.MODULES)) {
    const card = document.createElement('article'); card.className = 'asset-card';
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 180;
    const label = document.createElement('b'); label.textContent = definition.name;
    card.append(canvas, label); document.getElementById('gallery').append(card); cards.push({ type, canvas });
  }
  let enabled = true;
  document.getElementById('toggle-effects').onclick = (event) => { enabled = !enabled; event.currentTarget.setAttribute('aria-pressed', String(enabled)); };
  const effects = document.getElementById('effects').getContext('2d');
  const engines = ['thruster', 'booster', 'scout_drive'].map((type) => ({ thrusting: true, modules: [{ type, gx: 0, gy: 0, rotation: 0 }], engineStates: new Map([['0,0', { throttle: 1, activation: 1, gimbal: 0 }]]) }));
  function frame(timestamp) {
    const time = timestamp / 1000;
    cards.forEach(({ type, canvas }) => {
      const ctx = canvas.getContext('2d'), footprint = VS.ModuleSystem.MODULES[type].footprint;
      const module = { type, gx: 0, gy: 0, rotation: 0 }, modules = VS.ModuleSystem.assemblyCells(module);
      ctx.clearRect(0, 0, 300, 180); ctx.save(); ctx.translate(135, 90);
      const scale = footprint ? Math.min(250 / (footprint.width * 30 + 10), 145 / (footprint.height * 30)) : 3;
      ctx.scale(scale, scale);
      if (footprint) ctx.translate(-(footprint.width - 1) * 15, 0);
      for (const cell of modules) VS.Visuals.drawCell(ctx, images, cell, time, { x: Math.cos(time * 0.6) * 300, y: Math.sin(time * 0.6) * 300 });
      if (footprint) VS.Visuals.drawAssemblies(ctx, images, { ship: { modules }, available: () => 30, heatAvailable: () => 9000 }, time);
      ctx.restore();
    });
    effects.clearRect(0, 0, 1100, 220);
    engines.forEach((ship, i) => {
      ship.thrusting = enabled;
      effects.save(); effects.translate(245 + i * 310, 76); effects.scale(2.5, 2.5);
      VS.Visuals.drawExhaust(effects, images, ship, time); VS.Visuals.drawCell(effects, images, ship.modules[0]); effects.restore();
    });
    VS.Visuals.EFFECT_TYPES.forEach((kind, i) => VS.Visuals.effect(effects, images, kind, 45 + i * 89, 172, 72, 0.8, 0));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
