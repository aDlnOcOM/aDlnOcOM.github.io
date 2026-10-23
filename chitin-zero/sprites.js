(function (root) {
  'use strict';
  // Atlas rectangles are normalized: generated source dimensions are not assumed.
  // Organic rows have different heights; explicit bounds prevent neighboring frames bleeding.
  const manifest = {
    mechs: { src: 'assets/mechs.png', columns: 4, rows: [0, .252, .501, .738, 1] },
    bugs: { src: 'assets/bugs.png', columns: 4, rows: [0, .205, .425, .652, 1] },
    props: { src: 'assets/props.png', columns: 4, rows: [0, .25, .5, .75, 1] },
    ground: { src: 'assets/ground.png', columns: 1, rows: [0, 1] }
  };
  class Sprites {
    constructor() { this.images = {}; this.ready = false; }
    async load(progress = () => {}) {
      let done = 0;
      await Promise.all(Object.entries(manifest).map(([key, entry]) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = async () => {
          try { if (image.decode) await image.decode(); } catch { /* Some file browsers do not expose decode. */ }
          if (!image.naturalWidth) { reject(new Error(entry.src)); return; }
          this.images[key] = image; progress(++done, Object.keys(manifest).length); resolve();
        };
        image.onerror = () => reject(new Error(entry.src)); image.src = entry.src;
      })));
      this.ready = true; return this;
    }
    draw(ctx, atlas, row, frame, x, y, size, angle = 0) {
      const image = this.images[atlas], spec = manifest[atlas];
      if (!image || row < 0 || row >= spec.rows.length - 1) return;
      frame = ((frame % spec.columns) + spec.columns) % spec.columns;
      const sw = image.naturalWidth / spec.columns, sy = image.naturalHeight * spec.rows[row];
      const sh = image.naturalHeight * (spec.rows[row + 1] - spec.rows[row]);
      const height = size * sh / sw;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.drawImage(image, frame * sw + 1, sy + 1, sw - 2, sh - 2, -size / 2, -height / 2, size, height); ctx.restore();
    }
    preview(canvas, chassis, time, reduced) {
      if (!this.ready) return;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const row = { spectre: 0, bastion: 1, vector: 2 }[chassis];
      this.draw(ctx, 'mechs', row, reduced ? 1 : Math.floor(time * 5) % 4, 335, 325, 500);
    }
  }
  root.ChitinSprites = { Sprites, manifest };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Sprites, manifest };
})(typeof globalThis !== 'undefined' ? globalThis : this);
