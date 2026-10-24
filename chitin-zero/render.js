(function (root) {
  'use strict';
  const D = root.ChitinData, C = root.ChitinCore;
  const polygon = (ctx, points, fill, stroke) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  function circle(ctx, x, y, radius, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, C.TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  class Renderer {
    constructor(canvas, minimap, sprites) {
      this.sprites = sprites;
      this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
      this.map = minimap; this.mapCtx = minimap.getContext('2d');
      this.camera = { x: 0, y: 0 }; this.width = 0; this.height = 0; this.zoom = 1; this.dpr = 1;
      this.reduced = false; this.resize();
    }
    resize() {
      this.width = this.canvas.clientWidth || innerWidth; this.height = this.canvas.clientHeight || innerHeight;
      this.dpr = Math.min(2, devicePixelRatio || 1);
      this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
      this.zoom = Math.max(this.width / 1500, this.height / 900);
      this.map.width = 160 * this.dpr; this.map.height = 160 * this.dpr;
    }
    screenToWorld(x, y) { return { x: (x - this.width / 2) / this.zoom + this.camera.x, y: (y - this.height / 2) / this.zoom + this.camera.y }; }
    terrain(game) {
      const ctx = this.ctx, { x, y } = this.camera, w = this.width / this.zoom, h = this.height / this.zoom;
      const sectorX = Math.floor(x / 2400), sectorY = Math.floor(y / 2400);
      const biome = D.biomes[((sectorX + sectorY) % 4 + 4) % 4];
      this.biome = biome.name; ctx.fillStyle = biome.ground; ctx.fillRect(x - w / 2 - 20, y - h / 2 - 20, w + 40, h + 40);
      if (this.sprites?.ready) {
        const tile = 620; ctx.globalAlpha = .6;
        for (let tx = Math.floor((x - w / 2) / tile); tx <= Math.ceil((x + w / 2) / tile); tx++) {
          for (let ty = Math.floor((y - h / 2) / tile); ty <= Math.ceil((y + h / 2) / tile); ty++) {
            ctx.drawImage(this.sprites.images.ground, tx * tile, ty * tile, tile + 1, tile + 1);
          }
        }
        ctx.globalAlpha = 1;
      }
      const size = 160;
      for (let gx = Math.floor((x - w / 2) / size) - 1; gx <= Math.ceil((x + w / 2) / size); gx++) {
        for (let gy = Math.floor((y - h / 2) / size) - 1; gy <= Math.ceil((y + h / 2) / size); gy++) {
          const r = C.hash(gx, gy), px = gx * size, py = gy * size;
          ctx.strokeStyle = biome.line; ctx.lineWidth = 1; ctx.globalAlpha = .35;
          ctx.beginPath(); ctx.moveTo(px + 4, py); ctx.lineTo(px + 17, py); ctx.moveTo(px, py + 4); ctx.lineTo(px, py + 17); ctx.stroke();
          if (r > .68) {
            if (this.sprites?.ready) {
              const index = r > .94 ? 4 + Math.floor(C.hash(gy + 13, gx) * 12) : Math.floor(C.hash(gx, gy + 17) * 4);
              ctx.globalAlpha = .78;
              this.sprites.draw(ctx, 'props', Math.floor(index / 4), index % 4, px + r * 100, py + C.hash(gy, gx + 1) * 110, index < 4 ? 55 + r * 22 : 115);
              ctx.globalAlpha = 1;
            } else {
            ctx.save(); ctx.translate(px + r * 110, py + C.hash(gy, gx + 1) * 120); ctx.rotate(r * 6);
            ctx.globalAlpha = .8; ctx.fillStyle = '#080d11'; ctx.beginPath(); ctx.ellipse(5, 9, 28 * r, 16 * r, 0, 0, C.TAU); ctx.fill();
            polygon(ctx, [[-22 * r, 0], [-13 * r, -17 * r], [10 * r, -20 * r], [23 * r, -5], [13 * r, 13 * r], [-12 * r, 16 * r]], biome.line, '#10181d');
            ctx.globalAlpha = .6; ctx.strokeStyle = biome.accent; ctx.beginPath(); ctx.moveTo(-12 * r, -15 * r); ctx.lineTo(9 * r, -18 * r); ctx.stroke(); ctx.restore();
            }
          }
          ctx.globalAlpha = .45; ctx.fillStyle = biome.accent;
          for (let i = 0; i < 3; i++) { const a = C.hash(gx * 7 + i, gy * 5); ctx.fillRect(px + a * 156, py + C.hash(gy + i, gx) * 156, 2, 2); }
          // Survey markings and abandoned panels are scenery, never invisible colliders.
          if (r < .025) {
            ctx.globalAlpha = .65; ctx.fillStyle = '#0d151b'; ctx.fillRect(px + 20, py + 25, 83, 46);
            ctx.strokeStyle = '#55616a'; ctx.strokeRect(px + 20, py + 25, 83, 46); ctx.fillStyle = '#a09553';
            for (let i = 0; i < 5; i++) ctx.fillRect(px + 24 + i * 16, py + 29, 8, 3);
            ctx.fillStyle = '#3e4e58'; ctx.font = '9px monospace'; ctx.fillText('TERRA // 09', px + 26, py + 60);
          }
          ctx.globalAlpha = 1;
        }
      }
      // Visible landing beacon gives the empty planet a human point of reference.
      if (Math.abs(x) < w && Math.abs(y) < h) {
        ctx.save(); ctx.globalAlpha = .45; ctx.setLineDash([18, 12]); ctx.lineWidth = 3;
        circle(ctx, 0, 0, 125, null, '#5ef5e0'); ctx.setLineDash([]);
        ctx.font = '11px monospace'; ctx.fillStyle = '#5ef5e0'; ctx.fillText('LZ—07 / ПОСАДОЧНАЯ ЗОНА', -98, 150); ctx.restore();
      }
    }
    bug(e, time) {
      if (this.sprites?.ready) { this.spriteBug(e, time); return; }
      const ctx = this.ctx, r = e.radius;
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.fillStyle = '#05080b88'; ctx.beginPath(); ctx.ellipse(5, 10, r * 1.35, r * .8, 0, 0, C.TAU); ctx.fill();
      if (e.type === 'nest') {
        ctx.rotate(time * .05); circle(ctx, 0, 0, r * 1.3, '#34292c', '#785446');
        for (let i = 0; i < 7; i++) {
          ctx.rotate(C.TAU / 7); polygon(ctx, [[r * .2, -7], [r * .9, -12], [r * 1.45, 0], [r * .8, 10]], '#664c44', '#997a5e');
        }
        circle(ctx, 0, 0, r * (.45 + Math.sin(time * 3) * .04), '#b57a4a', '#e9b77b');
        circle(ctx, -4, -4, r * .2, '#ffcc7d');
      } else {
        ctx.rotate(e.angle + Math.PI / 2);
        ctx.lineWidth = e.boss ? 5 : 2;
        for (let side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const wiggle = Math.sin(time * (e.boss ? 7 : 13) + e.id + i * 1.7) * r * .2;
          ctx.strokeStyle = '#0a1015'; ctx.lineWidth = e.boss ? 9 : 4;
          const legs = () => { ctx.beginPath(); ctx.moveTo(side * r * .5, (i - 1) * r * .6); ctx.lineTo(side * r * 1.25, (i - 1) * r * .8 + wiggle); ctx.lineTo(side * r * 1.55, (i - 1) * r * .95 + r * .45 + wiggle); ctx.stroke(); };
          legs(); ctx.strokeStyle = e.flash ? '#fff8d9' : e.color; ctx.lineWidth = e.boss ? 4 : 1.7; legs();
        }
        const fill = e.flash ? '#fff3cd' : e.type === 'brute' ? '#514158' : e.boss ? '#693143' : '#38453c';
        polygon(ctx, [[0, -r * 1.15], [r * .64, -r * .55], [r * .82, r * .35], [r * .4, r], [0, r * 1.2], [-r * .4, r], [-r * .82, r * .35], [-r * .64, -r * .55]], fill, e.color);
        ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 1.08); ctx.stroke();
        for (let i = 0; i < (e.boss ? 5 : 3); i++) {
          ctx.beginPath(); ctx.moveTo(-r * .55, -r * .3 + i * r * .25); ctx.lineTo(0, -r * .1 + i * r * .25); ctx.lineTo(r * .55, -r * .3 + i * r * .25); ctx.stroke();
        }
        for (const side of [-1, 1]) {
          polygon(ctx, [[side * r * .25, -r * .75], [side * r * .65, -r * 1.4], [side * r * .12, -r * 1.2]], e.color);
          circle(ctx, side * r * .27, -r * .62, Math.max(2, r * .08), e.boss ? '#ffe583' : '#f2ff97');
        }
        if (e.type === 'spitter') circle(ctx, 0, r * .45, r * .38, '#b0e95a', '#e1ff8c');
        if (e.elite) { ctx.setLineDash([4, 4]); circle(ctx, 0, 0, r * 1.7, null, '#ffce54'); ctx.setLineDash([]); }
      }
      ctx.restore();
      if (e.hp < e.maxHp && (e.boss || e.elite || e.type === 'nest' || e.type === 'brute')) {
        ctx.fillStyle = '#05090d'; ctx.fillRect(e.x - r, e.y - r - 15, r * 2, 4);
        ctx.fillStyle = e.boss ? '#ff5977' : e.color; ctx.fillRect(e.x - r, e.y - r - 15, r * 2 * e.hp / e.maxHp, 4);
      }
    }
    mech(p, time) {
      if (this.sprites?.ready) { this.spriteMech(p, time); return; }
      const ctx = this.ctx, color = D.chassis[p.chassis].color, heavy = p.chassis === 'bastion' ? 1.16 : 1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = '#03090bad'; ctx.beginPath(); ctx.ellipse(6, 15, 32, 19, 0, 0, C.TAU); ctx.fill();
      if (p.coreTime > 0) {
        ctx.save(); ctx.rotate(time * 1.7); ctx.setLineDash([22, 12]); ctx.lineWidth = 2;
        circle(ctx, 0, 0, p.core === 'singularity' ? 150 + Math.sin(time * 3) * 30 : 42, null, D.cores[p.core].color); ctx.restore();
      }
      if (p.shield > 0) { ctx.globalAlpha = .1 + (p.hurt > 0 ? .5 : 0); circle(ctx, 0, 0, 37, '#5ef5e0', '#93fff1'); ctx.globalAlpha = 1; }
      ctx.rotate(p.angle + Math.PI / 2); ctx.scale(heavy, heavy);
      if (p.dashTime > 0) for (const s of [-1, 1]) {
        polygon(ctx, [[s * 17 - 5, 13], [s * 17, 50 + Math.sin(time * 90) * 12], [s * 17 + 5, 13]], '#5ef5e0');
        polygon(ctx, [[s * 17 - 3, 13], [s * 17, 34], [s * 17 + 3, 13]], '#edfff4');
      }
      for (const side of [-1, 1]) {
        const gait = Math.sin(p.walk + (side > 0 ? Math.PI : 0)) * 6;
        ctx.fillStyle = '#0c151c'; ctx.fillRect(side * 12 - 6, 5 + gait, 12, 21);
        ctx.fillStyle = '#73838b'; ctx.fillRect(side * 12 - 6, 8 + gait, 12, 9);
        polygon(ctx, [[side * 12 - 7, 24 + gait], [side * 12 + 7, 24 + gait], [side * 12 + 8, 32 + gait], [side * 12 - 8, 32 + gait]], '#283a44', '#889295');
        ctx.fillStyle = '#1c2b35'; ctx.fillRect(side * 25 - 6, -22, 12, 26);
        ctx.fillStyle = '#738087'; ctx.fillRect(side * 25 - 4, -30, 8, 27);
        ctx.fillStyle = '#111b23'; ctx.fillRect(side * 25 - 3, -35 - (Math.sin(time * 40) > .6 ? 2 : 0), 6, 17);
      }
      polygon(ctx, [[-21, -19], [-12, -28], [12, -28], [21, -19], [19, 11], [9, 19], [-9, 19], [-19, 11]], p.hurt > 0 ? '#ac7a73' : '#8a9ba2', '#0b161e');
      polygon(ctx, [[-17, -17], [-10, -24], [10, -24], [17, -17], [11, 5], [-11, 5]], '#293d49', '#b1c4c7');
      polygon(ctx, [[-9, -17], [9, -17], [6, -7], [-6, -7]], color);
      ctx.fillStyle = '#0b1820'; ctx.fillRect(-12, 8, 24, 5);
      for (let i = -8; i <= 8; i += 4) { ctx.fillStyle = '#53676f'; ctx.fillRect(i, 8, 2, 5); }
      ctx.fillStyle = color; ctx.fillRect(-23, -17, 4, 10); ctx.fillRect(19, -17, 4, 10);
      if (p.weapons.length > 1) { ctx.fillStyle = '#14232e'; ctx.fillRect(-24, 1, 8, 12); ctx.fillRect(16, 1, 8, 12); }
      ctx.restore();
      // Nose marker and heading line stay unmistakable amidst dense effects.
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.globalAlpha = .7; polygon(ctx, [[46, -5], [55, 0], [46, 5]], color);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 8]); ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(100, 0); ctx.stroke(); ctx.restore();
    }
    spriteBug(e, time) {
      const ctx = this.ctx, frame = Math.floor(time * (e.boss ? 5 : e.type === 'nest' ? 3 : 9) + e.id) % 4;
      ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = '#00000060'; ctx.beginPath(); ctx.ellipse(4, 7, e.radius * 1.35, e.radius * .85, 0, 0, C.TAU); ctx.fill(); ctx.restore();
      const row = { mite: 0, runner: 0, spitter: 1, brute: 2, charger: 2, queen: 3 }[e.type];
      ctx.save();
      if (e.flash > 0) ctx.filter = 'brightness(1.8)';
      else if (e.type === 'runner') ctx.filter = 'sepia(.4) saturate(1.5)';
      else if (e.type === 'charger') ctx.filter = 'saturate(1.7)';
      this.sprites.draw(ctx, e.type === 'nest' ? 'mechs' : 'bugs', e.type === 'nest' ? 3 : row, frame, e.x, e.y,
        e.radius * (e.boss ? 2.9 : e.type === 'nest' ? 2.8 : 3.5), e.type === 'nest' ? 0 : e.angle - Math.PI / 2);
      ctx.restore();
      if (e.elite) { ctx.save(); ctx.setLineDash([4, 6]); circle(ctx, e.x, e.y, e.radius * 1.7, null, '#ffce54'); ctx.restore(); }
      if (e.hp < e.maxHp && (e.boss || e.elite || e.type === 'nest' || e.type === 'brute')) {
        ctx.fillStyle = '#05090d'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 22, e.radius * 2, 4);
        ctx.fillStyle = e.color; ctx.fillRect(e.x - e.radius, e.y - e.radius - 22, e.radius * 2 * e.hp / e.maxHp, 4);
      }
    }
    spriteMech(p, time) {
      const ctx = this.ctx, color = D.chassis[p.chassis].color;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = '#03090b90'; ctx.beginPath(); ctx.ellipse(5, 15, 30, 22, 0, 0, C.TAU); ctx.fill();
      if (p.coreTime > 0) {
        ctx.save(); ctx.rotate(time); ctx.setLineDash([20, 12]); ctx.lineWidth = 2;
        circle(ctx, 0, 0, p.core === 'singularity' ? 150 + Math.sin(time * 3) * 30 : 48, null, D.cores[p.core].color); ctx.restore();
      }
      if (p.shield > 0) { ctx.globalAlpha = p.hurt > 0 ? .5 : .1; circle(ctx, 0, 0, 41, '#5ef5e0', '#93fff1'); ctx.globalAlpha = 1; }
      ctx.save(); ctx.rotate(p.moveAngle - Math.PI / 2);
      if (p.dashTime > 0) for (const x of [-18, 18]) {
        polygon(ctx, [[x - 5, -12], [x, -65 - Math.sin(time * 90) * 12], [x + 5, -12]], '#5ef5e0');
        polygon(ctx, [[x - 2, -12], [x, -43], [x + 2, -12]], '#edfff4');
      }
      ctx.restore();
      if (p.hurt > 0) ctx.filter = 'brightness(1.5) sepia(.3)';
      this.sprites.mech(ctx, p, 0, 0, p.chassis === 'bastion' ? 95 : 83);
      ctx.restore();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.globalAlpha = .8;
      polygon(ctx, [[50, -5], [60, 0], [50, 5]], color);
      ctx.strokeStyle = color; ctx.setLineDash([3, 8]); ctx.beginPath(); ctx.moveTo(66, 0); ctx.lineTo(112, 0); ctx.stroke(); ctx.restore();
    }
    telegraphs(game) {
      const ctx = this.ctx;
      for (const e of game.enemies) {
        if (e.windup <= 0) continue;
        if (e.boss) {
          ctx.globalAlpha = .12 + .12 * (1 - e.windup / 1.25); circle(ctx, e.strikeX, e.strikeY, 125, '#ff3f5d'); ctx.globalAlpha = 1;
          ctx.lineWidth = 2; circle(ctx, e.strikeX, e.strikeY, 125, null, '#ff5977');
          circle(ctx, e.strikeX, e.strikeY, 125 * (1 - e.windup / 1.25), null, '#ff9d79');
          ctx.fillStyle = '#ffb1bc'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('ЗОНА УДАРА', e.strikeX, e.strikeY - 5); ctx.textAlign = 'start';
        } else {
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.chargeAngle); ctx.globalAlpha = .22; ctx.fillStyle = '#ff775d'; ctx.fillRect(0, -e.radius, 300, e.radius * 2);
          ctx.globalAlpha = .85; ctx.strokeStyle = '#ff775d'; ctx.setLineDash([12, 9]); ctx.strokeRect(0, -e.radius, 300, e.radius * 2); ctx.restore();
        }
      }
    }
    radar(game) {
      const ctx = this.mapCtx, p = game.player, scale = 65 / 1100;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, 160, 160);
      circle(ctx, 80, 80, 72, '#09171cd9', '#3b575c'); circle(ctx, 80, 80, 37, null, '#263c42');
      ctx.strokeStyle = '#263c42'; ctx.beginPath(); ctx.moveTo(8, 80); ctx.lineTo(152, 80); ctx.moveTo(80, 8); ctx.lineTo(80, 152); ctx.stroke();
      for (const e of game.enemies) {
        let dx = (e.x - p.x) * scale, dy = (e.y - p.y) * scale, dist = Math.hypot(dx, dy);
        if (dist > 69) { if (!e.boss) continue; dx *= 69 / dist; dy *= 69 / dist; }
        circle(ctx, 80 + dx, 80 + dy, e.boss ? 5 : e.type === 'nest' ? 4 : 1.7, e.boss ? '#ff5977' : e.type === 'nest' ? '#ffdf68' : '#c77a69');
      }
      ctx.save(); ctx.translate(80, 80); ctx.rotate(p.angle); polygon(ctx, [[6, 0], [-4, -4], [-2, 0], [-4, 4]], '#5ef5e0'); ctx.restore();
    }
    draw(game) {
      const ctx = this.ctx, p = game.player;
      this.camera.x = p.x; this.camera.y = p.y;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = '#0b1119'; ctx.fillRect(0, 0, this.width, this.height);
      ctx.save(); const shake = this.reduced ? 0 : game.shake;
      ctx.translate(this.width / 2 + Math.sin(game.time * 84) * shake, this.height / 2 + Math.cos(game.time * 71) * shake * .7);
      ctx.scale(this.zoom, this.zoom); ctx.translate(-this.camera.x, -this.camera.y);
      this.terrain(game); this.telegraphs(game);
      for (const d of game.drops) {
        const bob = this.reduced ? 0 : Math.sin(game.time * 3 + d.phase) * 2;
        ctx.save(); ctx.translate(d.x, d.y + bob);
        if (d.kind === 'xp') {
          const r = d.value > 20 ? 8 : 5; polygon(ctx, [[0, -r], [r * .65, 0], [0, r], [-r * .65, 0]], d.value > 20 ? '#ffcf68' : '#5ef5e0', '#baffee');
        } else {
          ctx.fillStyle = '#103d3b'; ctx.fillRect(-10, -10, 20, 20); ctx.strokeStyle = '#5ef5e0'; ctx.strokeRect(-10, -10, 20, 20);
          ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#9affdf'; ctx.fillText(d.kind === 'repair' ? '+' : '◎', 0, 5);
        }
        ctx.restore();
      }
      for (const e of [...game.enemies].sort((a, b) => a.y - b.y)) if (Math.abs(e.x - p.x) < 850 && Math.abs(e.y - p.y) < 600) {
        if (e.burnTime > 0) circle(ctx, e.x, e.y, e.radius + 5, '#ff713e33', '#ff713e');
        if (e.slowTime > 0) circle(ctx, e.x, e.y, e.radius + 8, null, '#a1e9ff');
        this.bug(e, game.time);
      }
      for (const b of game.bullets) {
        if (b.weapon === 'flame') { circle(ctx, b.x, b.y, b.radius * 1.6, '#ff713e44'); circle(ctx, b.x, b.y, b.radius, '#ffb454aa'); continue; }
        if (b.weapon === 'saw') {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(this.reduced ? 0 : game.time * 18);
          polygon(ctx, Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, r = b.radius * (i % 2 ? .65 : 1.25); return [Math.cos(a) * r, Math.sin(a) * r]; }), '#778b48', b.color);
          circle(ctx, 0, 0, 3, '#f2fff2'); ctx.restore(); continue;
        }
        if (b.weapon === 'cryo') { polygon(ctx, [[b.x, b.y - 10], [b.x + 6, b.y], [b.x, b.y + 10], [b.x - 6, b.y]], '#a1e9ff77', b.color); continue; }
        ctx.strokeStyle = b.color; ctx.lineWidth = b.radius * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x - b.vx * .012, b.y - b.vy * .012); ctx.lineTo(b.x, b.y); ctx.stroke();
        circle(ctx, b.x, b.y, b.radius * .55, '#f2fff2');
      }
      ctx.lineCap = 'butt';
      for (const b of game.hostile) { circle(ctx, b.x, b.y, b.radius + 3, '#b9ec4935'); circle(ctx, b.x, b.y, b.radius, '#a9d85b', '#e2fa9e'); }
      this.mech(p, game.time);
      for (const fx of game.effects) {
        if (this.reduced && ['ghost', 'spark'].includes(fx.kind)) continue;
        const fraction = fx.life / fx.maxLife, growth = 1 - fraction;
        ctx.globalAlpha = fraction;
        if (fx.kind === 'text') { ctx.font = 'bold 13px monospace'; ctx.fillStyle = fx.color; ctx.textAlign = 'center'; ctx.fillText(fx.text, fx.x, fx.y - growth * 28); ctx.textAlign = 'start'; }
        else if (fx.kind === 'ring') { ctx.lineWidth = 2 + fraction * 3; circle(ctx, fx.x, fx.y, fx.radius * (.3 + growth * .7), null, fx.color); }
        else if (fx.kind === 'ghost') circle(ctx, fx.x, fx.y, fx.radius * fraction, null, fx.color);
        else if (fx.kind === 'burst') {
          ctx.lineWidth = 2; circle(ctx, fx.x, fx.y, fx.radius * growth, null, fx.color);
          for (let i = 0; i < 8; i++) { const a = i * C.TAU / 8; circle(ctx, fx.x + Math.cos(a) * fx.radius * growth, fx.y + Math.sin(a) * fx.radius * growth, 3 * fraction, fx.color); }
        } else circle(ctx, fx.x, fx.y, fx.radius * fraction, fx.color);
      }
      ctx.globalAlpha = 1; ctx.restore(); this.radar(game);
      const vignette = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * .2, this.width / 2, this.height / 2, this.width * .75);
      vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#03071199'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, this.width, this.height);
    }
  }
  root.ChitinRenderer = Renderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
