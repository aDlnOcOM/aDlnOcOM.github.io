(function (root) {
  'use strict';
  // Atlas rectangles are normalized: generated source dimensions are not assumed.
  // Organic rows have different heights; explicit bounds prevent neighboring frames bleeding.
  const manifest = {
    mechs: { src: 'assets/mechs.png', columns: 4, rows: [0, .252, .501, .738, 1] },
    bugs: { src: 'assets/bugs.png', columns: 4, rows: [0, .205, .425, .652, 1] },
    props: { src: 'assets/props.png', columns: 4, rows: [0, .25, .5, .75, 1] },
    parts: { src: 'assets/parts.png', columns: 4, rows: [0, .275, .495, .735, 1] },
    ground: { src: 'assets/ground.png', columns: 1, rows: [0, 1] }
  };
  const WALK_FPS = 8;
  function walkFrame(p) { return !p.moving || p.dashTime > 0 ? 1 : Math.floor((p.walkTime + 1e-9) * WALK_FPS) % 4; }
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
    mech(ctx, p, x, y, size) {
      const row = { spectre: 0, bastion: 1, vector: 2 }[p.chassis], image = this.images.mechs;
      if (!image) return;
      const spec = manifest.mechs, sw = image.naturalWidth / 4, sy = image.naturalHeight * spec.rows[row];
      const sh = image.naturalHeight * (spec.rows[row + 1] - spec.rows[row]), h = size * sh / sw;
      const torsoAngle = p.angle - Math.PI / 2, legAngle = p.moveAngle - Math.PI / 2;
      const E = root.ChitinEconomy, installed = E ? E.visualParts(p.installedParts) : [];
      const part = (item, px, py, width) => this.draw(ctx, 'parts', Math.floor(item.visual / 4), item.visual % 4, px, py, width);
      // The pelvis is the common pivot. Only the central lower-body region walks;
      // hands and guns stay with the torso instead of being cut off with the legs.
      ctx.save(); ctx.translate(x, y); ctx.rotate(legAngle);
      const frame = walkFrame(p);
      ctx.drawImage(image, frame * sw + sw * .30, sy + sh * .56, sw * .40, sh * .44 - 1,
        -size * .20, -h * .04, size * .40, h * .44);
      const drive = installed.find(item => item.slot === 'drive');
      if (drive) {
        if (drive.id === 'hydraulics') { part(drive, -size * .13, h * .18, size * .22); part(drive, size * .13, h * .18, size * .22); }
        else part(drive, 0, h * .15, size * .46);
      }
      ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(torsoAngle);
      ctx.save(); ctx.beginPath();
      ctx.rect(-size / 2, -h * .6, size, h * .6);
      ctx.rect(-size / 2, 0, size * .30, h * .4);
      ctx.rect(size * .20, 0, size * .30, h * .4);
      ctx.clip();
      ctx.drawImage(image, sw + 1, sy + 1, sw - 2, sh - 2, -size / 2, -h * .6, size, h);
      ctx.restore();
      for (const item of installed) {
        if (item.slot === 'reactor') part(item, 0, -h * .38, size * .38);
        if (item.slot === 'armor') {
          if (item.id === 'ceramic') { part(item, -size * .26, -h * .27, size * .30); part(item, size * .26, -h * .27, size * .30); }
          else part(item, 0, -h * .13, size * .43);
        }
        if (item.slot === 'weapon') part(item, -size * .32, -h * .04, size * .53);
        if (item.slot === 'utility') part(item, size * .32, -h * .15, size * .34);
      }
      ctx.restore();
    }
    preview(canvas, chassis, time, reduced, installedParts = {}) {
      if (!this.ready) return;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.mech(ctx, { chassis, moving: !reduced, walkTime: time, dashTime: 0, angle: Math.PI / 2, moveAngle: Math.PI / 2, installedParts }, 335, 380, 500);
    }
  }
  root.ChitinSprites = { Sprites, manifest, WALK_FPS, walkFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Sprites, manifest, WALK_FPS, walkFrame };
})(typeof globalThis !== 'undefined' ? globalThis : this);
