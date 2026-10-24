(function (root) {
  'use strict';
  const D = root.ChitinData || require('./data.js'), C = root.ChitinCore || require('./core.js'), V = root.ChitinView || require('./view.js');
  function polygon(ctx, points, fill, stroke) {
    if (points.length < 3) return;
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, V.TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(ctx, points, color, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  class Renderer {
    constructor(canvas, minimap, sprites) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.map = minimap; this.mapCtx = minimap.getContext('2d');
      this.sprites = sprites; this.reduced = false; this.resize();
    }
    resize() {
      this.width = this.canvas.clientWidth || root.innerWidth || 1280; this.height = this.canvas.clientHeight || root.innerHeight || 800;
      this.dpr = Math.min(2, root.devicePixelRatio || 1); this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
      this.map.width = this.map.height = Math.round(160 * this.dpr);
    }
    worldFace(points, fill, stroke) {
      polygon(this.ctx, V.face(this.camera, points).map(p => [p.x, p.y]), fill, stroke);
    }
    textureFloor() {
      // Low-resolution software floor casting preserves the source texture in perspective.
      // It is independent of the UI and uses no external renderer/dependency.
      if (this.textureDisabled || !this.sprites?.ready || !this.sprites.images?.ground) return false;
      const surface = (w, h) => {
        if (root.OffscreenCanvas) return new root.OffscreenCanvas(w, h);
        if (!root.document?.createElement) return null;
        const canvas = root.document.createElement('canvas'); canvas.width = w; canvas.height = h; return canvas;
      };
      if (!this.groundPixels) {
        const texture = surface(256, 256); if (!texture) return false;
        try { const ctx = texture.getContext('2d', { willReadFrequently: true }); ctx.drawImage(this.sprites.images.ground, 0, 0, 256, 256); this.groundPixels = ctx.getImageData(0, 0, 256, 256).data; }
        catch { this.textureDisabled = true; return false; } // File-origin readback can be denied; do not retry every frame.
      }
      const width = Math.ceil(this.width / 4), height = Math.ceil(this.height / 4);
      if (!this.floorCanvas || this.floorCanvas.width !== width || this.floorCanvas.height !== height) {
        this.floorCanvas = surface(width, height); if (!this.floorCanvas) return false;
        this.floorContext = this.floorCanvas.getContext('2d'); this.floorPixels = this.floorContext.createImageData(width, height);
      }
      const c = this.camera, pixels = this.floorPixels.data, texture = this.groundPixels;
      pixels.fill(0);
      for (let y = 0; y < height; y++) {
        const up = (this.height / 2 - (y + .5) * 4) / c.focal, vz = c.sp + up * c.cp;
        if (vz >= -.0001) continue;
        const t = -c.z / vz, forward = (c.cp - up * c.sp) * t;
        if (t > 4500) continue;
        const shade = .6 + .25 * Math.min(1, forward / 1400), fog = Math.min(.8, Math.max(0, (forward - 650) / 2500));
        for (let x = 0; x < width; x++) {
          const side = ((x + .5) * 4 - this.width / 2) / c.focal * t;
          const wx = c.x + c.cos * forward - c.sin * side, wy = c.y + c.sin * forward + c.cos * side;
          const sx = Math.floor(wx * .55) & 255, sy = Math.floor(wy * .55) & 255, src = (sy * 256 + sx) * 4, dst = (y * width + x) * 4;
          pixels[dst] = texture[src] * shade * (1 - fog) + 35 * fog;
          pixels[dst + 1] = texture[src + 1] * shade * (1 - fog) + 47 * fog;
          pixels[dst + 2] = texture[src + 2] * shade * (1 - fog) + 52 * fog; pixels[dst + 3] = 255;
        }
      }
      this.floorContext.putImageData(this.floorPixels, 0, 0);
      this.ctx.imageSmoothingEnabled = true; this.ctx.drawImage(this.floorCanvas, 0, 0, this.width, this.height); return true;
    }
    terrain() {
      const ctx = this.ctx, c = this.camera, w = this.width, h = this.height;
      const sector = Math.floor(c.x / 2400) + Math.floor(c.y / 2400), biome = D.biomes[(sector % 4 + 4) % 4]; this.biome = biome.name;
      const horizon = h / 2 + Math.tan(c.pitch) * c.focal;
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#070d18'); sky.addColorStop(.55, '#3a4b50'); sky.addColorStop(1, biome.ground);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const sunX = w / 2 + V.wrap(.4 - c.yaw) * c.focal;
      circle(ctx, sunX, horizon - h * .24, h * .072, '#a89b7955');
      circle(ctx, sunX + h * .025, horizon - h * .265, h * .068, '#26363d');
      for (let i = 0; i < 48; i++) {
        const a = i * V.TAU / 48, x = w / 2 + V.wrap(a - c.yaw) * c.focal, r = C.hash(i, 87);
        if (x < -200 || x > w + 200) continue;
        polygon(ctx, [[x - 110, horizon + 20], [x - 45, horizon - 40 - r * 110], [x, horizon - 20 - r * 50], [x + 100, horizon + 20]], '#1a282e');
        if (i % 7 === 0) { ctx.fillStyle = '#15242b'; ctx.fillRect(x, horizon - 160, 15, 180); ctx.fillStyle = '#ff775d'; ctx.fillRect(x + 4, horizon - 165, 6, 3); }
      }
      if (horizon < h) { ctx.fillStyle = biome.ground; ctx.fillRect(0, Math.max(0, horizon), w, h); }
      const size = 200, cx = Math.floor(c.x / size), cy = Math.floor(c.y / size), tiles = [];
      for (let ix = cx - 10; ix <= cx + 10; ix++) for (let iy = cy - 10; iy <= cy + 10; iy++) {
        const x = ix * size, y = iy * size, q = V.local(c, x + size / 2, y + size / 2, 0);
        if (q.depth < -220 || q.depth > V.FAR || Math.abs(q.side) > Math.max(0, q.depth) * w / c.focal + 300) continue;
        tiles.push({ x, y, depth: q.depth, r: C.hash(ix, iy), ix, iy });
      }
      tiles.sort((a, b) => b.depth - a.depth);
      for (const t of tiles) {
        const { x, y, r } = t;
        this.worldFace([[x, y, 0], [x + size, y, 0], [x + size, y + size, 0], [x, y + size, 0]], r > .5 ? biome.ground : biome.line);
        if (t.depth < 1200) {
          const rx = x + 35 + r * 120, ry = y + 35 + C.hash(t.iy, t.ix + 21) * 120;
          this.worldFace([[rx - 10, ry, .2], [rx, ry - 15, .2], [rx + 28, ry + 5, .2], [rx + 10, ry + 15, .2]], '#10191d');
          if (r > .7) this.worldFace([[x + 40, y + 40, .3], [x + 130, y + 55, .3], [x + 125, y + 60, .3], [x + 45, y + 46, .3]], biome.accent);
        }
      }
      this.textureFloor();
      // Flat survey markings: scenery never implies an invisible blocking wall.
      this.groundRing(0, 0, 130, '#61d7cc', 2);
      for (let k = -2; k <= 2; k++) this.worldFace([[-105, k * 16, .5], [-75, k * 16, .5], [-75, k * 16 + 4, .5], [-105, k * 16 + 4, .5]], '#7baca1');
    }
    groundRing(x, y, radius, color, width = 2) {
      for (let i = 0; i < 32; i++) {
        const a = i * V.TAU / 32, b = (i + 1) * V.TAU / 32;
        const p = V.project(this.camera, x + Math.cos(a) * radius, y + Math.sin(a) * radius, 1), q = V.project(this.camera, x + Math.cos(b) * radius, y + Math.sin(b) * radius, 1);
        if (p && q) line(this.ctx, [[p.x, p.y], [q.x, q.y]], color, width);
      }
    }
    enemy(e, q, time) {
      const ctx = this.ctx, radius = e.radius * q.scale, phase = this.reduced ? 0 : Math.floor(time * 8 + e.id) / 8;
      const color = e.flash > 0 ? '#e9ffe6' : e.slowTime > 0 ? '#9ce5ef' : e.color;
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(radius, radius); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = .035;
      ctx.fillStyle = '#030a0c66'; ctx.beginPath(); ctx.ellipse(0, 1, 1.6, .17, 0, 0, V.TAU); ctx.fill();
      if (e.type === 'nest') {
        for (let i = 0; i < 7; i++) { const x = (i - 3) * .32; polygon(ctx, [[x - .35, 1], [x - .22, -.2 - C.hash(i, 3) * 1.4], [x + .13, -.8], [x + .4, 1]], i % 2 ? '#624640' : '#342e32', '#ad8163'); }
        circle(ctx, 0, 0, .42 + Math.sin(phase * 3) * .03, '#d9ac66', '#ffe4a1');
      } else {
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const step = Math.sin(phase * 13 + i * 2.1 + side) * .16;
          const points = [[side * .4, -.1 + i * .22], [side * (1.25 + i * .08), -.35 + i * .35 + step], [side * (1.6 - i * .13), .92 - step]];
          line(ctx, points, '#0d161a', .19); line(ctx, points, color, .055); circle(ctx, points[1][0], points[1][1], .1, '#252f33', color);
        }
        const facing = Math.cos(e.angle - this.camera.yaw - Math.PI);
        const shell = ctx.createLinearGradient(-.8, -.4, .8, .8); shell.addColorStop(0, '#101a22'); shell.addColorStop(.4, e.boss ? '#965065' : e.type === 'brute' ? '#655a75' : '#617364'); shell.addColorStop(1, '#18232b');
        polygon(ctx, [[0, -1.02], [.62, -.7], [.83, .14], [.55, .66], [0, .82], [-.55, .66], [-.83, .14], [-.62, -.7]], shell, color);
        for (let i = 0; i < 4; i++) line(ctx, [[-.55, -.56 + i * .26], [0, -.41 + i * .26], [.55, -.56 + i * .26]], color, .035);
        polygon(ctx, [[-.47, .03], [0, -.12], [.47, .03], [.34, .56], [0, .7], [-.34, .56]], '#16272a', '#63746a');
        for (const s of [-1, 1]) {
          polygon(ctx, [[s * .34, .4], [s * .65, .74], [s * .17, 1.03], [s * .33, .66]], '#9b9b79', '#d6d3aa');
          circle(ctx, s * .26, .18, .075, facing > -.3 ? '#faff8b' : '#657261');
        }
        if (e.type === 'spitter') circle(ctx, 0, -.62, .3, '#8ebf48', '#d9fa84');
        if (e.type === 'charger' || e.boss) for (const s of [-1, 1]) polygon(ctx, [[s * .45, -.4], [s * .8, -1.7], [s * .15, -.8]], '#8c6c69', color);
        if (e.burnTime > 0) for (let i = 0; i < 3; i++) polygon(ctx, [[-.6 + i * .4, .3], [-.5 + i * .4, -1.1 - Math.sin(phase * 9 + i) * .2], [-.25 + i * .4, .3]], '#ff923e99');
      }
      ctx.restore();
      if ((e.elite || e.boss || e.type === 'nest') && q.depth < 1100) {
        ctx.fillStyle = '#071116'; ctx.fillRect(q.x - radius, q.y - radius * 1.9, radius * 2, 4);
        ctx.fillStyle = color; ctx.fillRect(q.x - radius, q.y - radius * 1.9, radius * 2 * e.hp / e.maxHp, 4);
      }
    }
    scene(game) {
      const ctx = this.ctx, c = this.camera, objects = [];
      const add = (kind, item, z) => { const q = V.project(c, item.x, item.y, z); if (q && q.x > -500 && q.x < this.width + 500) objects.push({ kind, item, q }); };
      for (const e of game.enemies) if (!e.dead) {
        add('enemy', e, e.radius);
        if (e.windup > 0) {
          if (e.boss) this.groundRing(e.strikeX, e.strikeY, 125, '#ff5573', 3);
          else this.groundRing(e.x + Math.cos(e.chargeAngle) * 120, e.y + Math.sin(e.chargeAngle) * 120, 35, '#ff9f60');
        }
      }
      for (const d of game.drops) add('drop', d, 7);
      for (const b of game.bullets) add('bullet', b, b.z ?? 22);
      for (const b of game.hostile) add('acid', b, b.z ?? 30);
      for (const fx of game.effects) if (!['ghost', 'muzzle'].includes(fx.kind)) add('effect', fx, 18);
      objects.sort((a, b) => b.q.depth - a.q.depth);
      for (const { kind, item: e, q } of objects) {
        ctx.globalAlpha = Math.min(1, (V.FAR - q.depth) / 450);
        if (kind === 'enemy') this.enemy(e, q, game.time);
        else if (kind === 'drop') {
          const r = Math.max(2, Math.min(30, q.scale * (e.kind === 'xp' ? 4 : 9)));
          polygon(ctx, [[q.x, q.y - r], [q.x + r * .7, q.y], [q.x, q.y + r], [q.x - r * .7, q.y]], e.kind === 'xp' ? '#59f5d5' : '#ffe298', '#dcffee');
          if (e.kind !== 'xp') { ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#07151c'; ctx.fillText(e.kind === 'repair' ? '+' : '◎', q.x - 5, q.y + 5); }
        } else if (kind === 'bullet' || kind === 'acid') {
          const r = Math.min(40, Math.max(1, e.radius * q.scale));
          if (e.weapon === 'saw') {
            const turn = this.reduced ? 0 : game.time * 15;
            polygon(ctx, Array.from({ length: 16 }, (_, i) => { const a = turn + i * V.TAU / 16, size = r * (i % 2 ? .7 : 1.4); return [q.x + Math.cos(a) * size, q.y + Math.sin(a) * size]; }), '#788b69', e.color);
          } else if (e.weapon === 'cryo') polygon(ctx, [[q.x, q.y - r * 1.6], [q.x + r, q.y], [q.x, q.y + r * 1.6], [q.x - r, q.y]], '#a1e9ff99', e.color);
          else circle(ctx, q.x, q.y, r * (e.weapon === 'flame' ? 2.3 : 1.4), kind === 'acid' ? '#b3d95e55' : e.color + '55');
          circle(ctx, q.x, q.y, r * .6, kind === 'acid' ? '#b6ed63' : e.color);
          if (kind === 'bullet') {
            const tail = V.project(c, e.x - e.vx * .025, e.y - e.vy * .025, (e.z ?? 22) - (e.vz || 0) * .025);
            if (tail) line(ctx, [[tail.x, tail.y], [q.x, q.y]], e.color, Math.min(5, r));
          }
        } else {
          const fraction = e.life / e.maxLife; ctx.globalAlpha *= fraction;
          if (e.kind === 'text') { ctx.font = 'bold 13px monospace'; ctx.fillStyle = e.color; ctx.fillText(e.text, q.x, q.y - (1 - fraction) * 20); }
          else circle(ctx, q.x, q.y, Math.min(180, e.radius * q.scale * (1 - fraction * .7)), null, e.color);
        }
      }
      ctx.globalAlpha = 1;
    }
    weapon(weapon, mount, game) {
      const ctx = this.ctx, spec = D.weapons[weapon.id], p = game.player, { side, size, tier } = mount;
      const recoil = (weapon.flash || 0) / .12, sway = this.reduced ? 0 : Math.sin(p.walk * .8 + tier * .3) * Math.min(3, Math.hypot(p.vx, p.vy) / 65);
      ctx.save(); ctx.translate(mount.x - side * recoil * size * .035, mount.y + recoil * size * .045 + sway); ctx.scale(-side * size / 240, size / 240); ctx.lineWidth = 1.5;
      const color = spec.color, energy = ['plasma', 'arc', 'rail', 'gauss', 'cryo'].includes(weapon.id), heavy = ['rocket', 'mortar', 'cannon'].includes(weapon.id);
      const metal = ctx.createLinearGradient(-80, 10, 20, 70); metal.addColorStop(0, '#22323c'); metal.addColorStop(.45, '#718389'); metal.addColorStop(.55, '#4b5b63'); metal.addColorStop(1, '#1a2934');
      polygon(ctx, [[-105, 50], [-38, 9], [30, 7], [61, 31], [20, 83], [-85, 90]], '#10191f', '#52616a');
      polygon(ctx, [[-105, 50], [-38, 9], [30, 7], [-21, 49]], metal, '#89918b');
      polygon(ctx, [[-21, 49], [30, 7], [61, 31], [20, 83]], '#293b43', '#657c7d');
      polygon(ctx, [[-32, 16], [55, -62], [81, -59], [11, 28]], energy ? '#294c56' : '#707773', '#a8b4ad');
      polygon(ctx, [[11, 28], [81, -59], [91, -40], [30, 49]], '#15252b', '#4d686d');
      polygon(ctx, [[55, -62], [81, -59], [91, -40], [67, -43]], '#0a1218', '#95a8a7');
      if (heavy) {
        polygon(ctx, [[-25, 5], [48, -65], [93, -59], [109, -21], [30, 52]], '#3c494c', '#9ba39b');
        const holes = weapon.id === 'rocket' ? 4 : 1;
        for (let i = 0; i < holes; i++) circle(ctx, 70 + i % 2 * 17, -48 + Math.floor(i / 2) * 15, holes === 1 ? 17 : 6, '#070c0e', '#a69b75');
      } else if (weapon.id === 'needle') {
        for (let i = 0; i < 3; i++) line(ctx, [[-15 + i * 10, 15], [59 + i * 10, -53]], '#c0c5ae', 5);
      } else if (weapon.id === 'scatter') {
        line(ctx, [[5, 26], [75, -47]], '#0b171d', 10); line(ctx, [[-8, 17], [62, -55]], '#0b171d', 10);
      } else if (weapon.id === 'saw') {
        ctx.save(); ctx.translate(55, -25); ctx.rotate(this.reduced ? 0 : game.time * 8);
        polygon(ctx, Array.from({ length: 24 }, (_, i) => { const a = i * V.TAU / 24, r = i % 2 ? 27 : 35; return [Math.cos(a) * r, Math.sin(a) * r]; }), '#8faaa3', color); circle(ctx, 0, 0, 12, '#172a2d', color); ctx.restore();
      } else if (energy) {
        for (let i = 0; i < 5; i++) line(ctx, [[-14 + i * 16, 14 - i * 15], [7 + i * 16, 22 - i * 15]], color, 5);
        if (weapon.id === 'arc') { circle(ctx, 67, -44, 21, '#102a36', color); circle(ctx, 67, -44, 12, color); }
        if (weapon.id === 'gauss') { ctx.fillStyle = '#111e29'; ctx.fillRect(-5, -10, 26, 14); ctx.fillStyle = color; ctx.fillRect(0, -7, 10, 6); }
      } else if (weapon.id === 'flame') { line(ctx, [[-65, 55], [-80, 4], [-20, -5], [30, -10]], '#aa6345', 10); circle(ctx, 72, -51, 7, '#ffbd64'); }
      ctx.fillStyle = '#101d25'; ctx.fillRect(-75, 45, 51, 22); ctx.fillStyle = color; ctx.fillRect(-71, 49, 3, 13);
      ctx.save(); ctx.scale(-side, 1); ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#dce5d9'; ctx.fillText(spec.name, side < 0 ? -64 : 25, 59); ctx.restore();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i < weapon.level ? color : '#34454b'; ctx.fillRect(-91 + i * 7, 72, 4, 5); }
      for (let i = 0; i < 5; i++) line(ctx, [[-52 + i * 8, 17 + i * 2], [-75 + i * 9, 33 + i * 2]], '#101b23', 3);
      for (const [x, y] of [[-91, 51], [-32, 19], [27, 30], [13, 72]]) { circle(ctx, x, y, 2.5, '#0a141b', '#94a1a1'); }
      if (recoil > .3) {
        ctx.globalAlpha = this.reduced ? .35 : recoil; polygon(ctx, [[58, -59], [85, -97], [91, -64], [116, -68], [91, -40], [80, -30]], color); circle(ctx, 82, -57, 9, '#fff4d5'); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    cockpit(game) {
      const ctx = this.ctx, w = this.width, h = this.height, p = game.player, color = D.chassis[p.chassis].color;
      const edge = p.chassis === 'bastion' ? .09 : .065;
      polygon(ctx, [[0, 0], [w, 0], [w, 20], [w * .75, 36], [w * .25, 36], [0, 20]], '#0a1016', '#52606a');
      for (const side of [-1, 1]) {
        ctx.save(); if (side > 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        polygon(ctx, [[0, 0], [w * .2, 0], [w * edge, h * .3], [w * .025, h * .78], [0, h]], '#0c151d', '#485d65');
        line(ctx, [[w * .19, 20], [w * (edge - .008), h * .31], [w * .018, h * .73]], color, 2);
        for (let i = 0; i < 7; i++) { ctx.fillStyle = '#405059'; ctx.fillRect(8 + i * 4, 42 + i * 14, 5, 8); }
        ctx.restore();
      }
      const layout = V.mounts(p.weapons.length, w, h);
      for (let i = layout.length - 1; i >= 0; i--) this.weapon(p.weapons[i], layout[i], game);
      polygon(ctx, [[0, h * .90], [w * .27, h * .86], [w * .38, h * .91], [w * .62, h * .91], [w * .73, h * .86], [w, h * .90], [w, h], [0, h]], '#09131b', '#52636a');
      line(ctx, [[w * .28, h * .875], [w * .38, h * .925], [w * .62, h * .925], [w * .72, h * .875]], color, 2);
      ctx.font = '10px monospace'; ctx.textAlign = 'center';
      for (let i = 0; i < 24; i++) {
        const offset = V.wrap(i * V.TAU / 24 - p.angle), x = w / 2 + offset * 140;
        if (Math.abs(offset) > .8) continue;
        line(ctx, [[x, 49], [x, 55]], '#83b6b9'); ctx.fillStyle = '#90aeb0'; ctx.fillText(i % 6 === 0 ? ['E', 'S', 'W', 'N'][i / 6] : String(i * 15), x, 68);
      }
      ctx.fillStyle = color; ctx.fillText('▼', w / 2, 46);
      const cx = w / 2, cy = h / 2;
      line(ctx, [[cx - 15, cy], [cx - 5, cy]], '#c1e7da'); line(ctx, [[cx + 5, cy], [cx + 15, cy]], '#c1e7da');
      line(ctx, [[cx, cy - 15], [cx, cy - 5]], '#c1e7da'); circle(ctx, cx, cy, 1.5, '#f2e3a5');
      ctx.fillStyle = '#b1ccca'; ctx.fillText(`${Math.round(Math.hypot(p.vx, p.vy) / 10)} М/С`, w / 2, h * .965);
      ctx.font = '9px monospace'; ctx.fillText(`${D.chassis[p.chassis].serial} / NEURAL LINK`, w / 2, h * .988); ctx.textAlign = 'start';
      const threat = game.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 260).sort((a, b) => C.distance(a, p) - C.distance(b, p))[0];
      if (threat) {
        const bearing = V.wrap(Math.atan2(threat.y - p.y, threat.x - p.x) - p.angle);
        if (Math.abs(bearing) > .8) { ctx.fillStyle = '#ff997c'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(bearing > 0 ? 'ОПАСНОСТЬ СПРАВА / СЗАДИ ›' : '‹ ОПАСНОСТЬ СЛЕВА / СЗАДИ', w / 2, h * .71); ctx.textAlign = 'start'; }
      }
      if (game.enemies.some(e => e.boss && e.windup > 0 && Math.hypot(e.strikeX - p.x, e.strikeY - p.y) < 125 + p.radius)) {
        ctx.fillStyle = '#ff6c73'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.fillText('ЗОНА УДАРА — РЫВОК!', w / 2, h * .32); ctx.textAlign = 'start';
      }
      if (p.hurt > 0 || p.coreTime > 0) { ctx.strokeStyle = p.hurt > 0 ? '#ff5977' : D.cores[p.core].color; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4); }
    }
    radar(game) {
      const ctx = this.mapCtx, p = game.player, scale = 65 / 1100;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, 160, 160);
      circle(ctx, 80, 80, 72, '#071219ef', '#3b575c'); circle(ctx, 80, 80, 37, null, '#263c42');
      polygon(ctx, [[80, 80], [34, 27], [126, 27]], '#5ef5e00c', '#5ef5e029');
      for (const e of game.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y;
        let x = (-dx * Math.sin(p.angle) + dy * Math.cos(p.angle)) * scale, y = -(dx * Math.cos(p.angle) + dy * Math.sin(p.angle)) * scale, dist = Math.hypot(x, y);
        if (dist > 69) { if (!e.boss) continue; x *= 69 / dist; y *= 69 / dist; }
        circle(ctx, 80 + x, 80 + y, e.boss ? 4 : e.type === 'nest' ? 3 : 1.7, e.boss ? '#ff5977' : e.type === 'nest' ? '#ffdf68' : '#c77a69');
      }
      polygon(ctx, [[80, 74], [76, 85], [80, 82], [84, 85]], '#5ef5e0');
    }
    draw(game) {
      this.camera = V.camera(game.player, this.width, this.height, this.reduced);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.terrain(); this.scene(game); this.cockpit(game); this.radar(game);
    }
  }
  root.ChitinRenderer = Renderer; if (typeof module !== 'undefined' && module.exports) module.exports = Renderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
