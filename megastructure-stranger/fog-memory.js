/* World-aligned pixel masks retain actual seen shapes, not revealed grid cells. */
(() => {
  'use strict';
  const CHUNK = 512;
  function rememberAndDraw(map, vision, fog, cameraX, width, height, opacity, createCanvas) {
    map.fogMemory ||= new Map();
    const first = Math.max(0, Math.floor(cameraX / CHUNK));
    const last = Math.min(Math.ceil(map.width / CHUNK) - 1, Math.floor((cameraX + width - .001) / CHUNK));
    fog.save();
    fog.globalCompositeOperation = 'destination-out';
    fog.globalAlpha = opacity;
    for (let index = first; index <= last; index++) {
      let canvas = map.fogMemory.get(index);
      if (!canvas) {
        canvas = createCanvas(); canvas.width = CHUNK; canvas.height = height;
        map.fogMemory.set(index, canvas);
      }
      const memory = canvas.getContext('2d');
      // Clip to a fixed world chunk; never round the scrolling camera position.
      memory.drawImage(vision, cameraX - index * CHUNK, 0);
      fog.drawImage(canvas, index * CHUNK - cameraX, 0);
    }
    fog.restore();
  }
  window.FogMemory = { rememberAndDraw };
})();
