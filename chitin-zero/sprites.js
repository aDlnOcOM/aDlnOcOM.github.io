(function (root) {
  'use strict';
  // Atlas rectangles are normalized: generated source dimensions are not assumed.
  // Organic rows have different heights; explicit bounds prevent neighboring frames bleeding.
  const manifest = {
    mechs: { src: 'assets/mechs.png', columns: 4, rows: [0, .252, .501, .738, 1] },
    bugs: { src: 'assets/bugs.png', columns: 4, rows: [0, .205, .425, .652, 1] },
    props: { src: 'assets/props.png', columns: 4, rows: [0, .25, .5, .75, 1] },
    parts: { src: 'assets/parts.png', columns: 4, rows: [0, .275, .495, .735, 1] },
    spectre: { src: 'assets/mech-spectre-directions.png', columns: 8, rows: [0, 180 / 992, 380 / 992, 578 / 992, 780 / 992, 1], width: 1586, height: 992 },
    bastion: { src: 'assets/mech-bastion-directions.png', columns: 8, rows: [0, 182 / 992, 373 / 992, 570 / 992, 772 / 992, 1], width: 1586, height: 992 },
    vector: { src: 'assets/mech-vector-directions.png', columns: 8, rows: [0, 197 / 992, 385 / 992, 578 / 992, 777 / 992, 1], width: 1586, height: 992 },
    ground: { src: 'assets/ground.png', columns: 1, rows: [0, 1] }
  };
  const WALK_FPS = 8;
  function walkFrame(p) { return !p.moving || p.dashTime > 0 ? 1 : Math.floor((p.walkTime + 1e-9) * WALK_FPS) % 4; }
  // Factorio-inspired definitions, not a Lua/API compatibility layer. Our sheets
  // store directions in columns and phases in rows. Explicit cuts and pivots
  // compensate for the generated artwork's non-uniform packing without slicing limbs.
  const mechDefinitions = {
    spectre: { columns: [0, 202, 384, 588, 791, 1005], centers: [107, 301, 502, 686, 892], torsoY: 148, hipsY: [0, 220, 409, 603, 805] },
    bastion: { columns: [0, 212, 400, 601, 792, 1000], rowColumns: { 4: [0, 190, 400, 601, 792, 1000] }, centers: [111, 304, 502, 692, 892], torsoY: 144, hipsY: [0, 201, 397, 591, 792] },
    vector: { columns: [0, 233, 440, 616, 809, 1024], centers: [134, 334, 532, 711, 904], torsoY: 160, hipsY: [0, 217, 410, 603, 803] }
  };
  const animations = {
    idle: { frame_count: 1, frame_sequence: [1], animation_speed: 0 },
    idle_with_gun: { frame_count: 1, frame_sequence: [1], animation_speed: 0 },
    running: { frame_count: 4, frame_sequence: [2, 3, 4, 1], animation_speed: WALK_FPS / 60 },
    running_with_gun: { frame_count: 4, frame_sequence: [2, 3, 4, 1], animation_speed: WALK_FPS / 60 },
    dashing: { frame_count: 1, frame_sequence: [1], animation_speed: 0 }
  };
  function directionIndex(angle) {
    const turn = Math.PI * 2;
    return Math.round((((Number.isFinite(angle) ? angle : Math.PI / 2) - Math.PI / 2) % turn + turn) % turn / (turn / 8)) % 8;
  }
  function animationPose(p) {
    const armed = p.shootTime > 0;
    const state = p.dashTime > 0 ? 'dashing' : p.moving ? (armed ? 'running_with_gun' : 'running') : (armed ? 'idle_with_gun' : 'idle');
    const spec = animations[state];
    const frame = Math.floor((Math.max(0, p.walkTime || 0) + 1e-9) * spec.animation_speed * 60) % spec.frame_count;
    return { state, row: spec.frame_sequence[frame], legs: directionIndex(p.moveAngle), torso: directionIndex(p.angle), recoil: Math.min(1, Math.max(0, p.shootTime || 0) / .12) };
  }
  function frameRect(chassis, row, direction) {
    const spec = mechDefinitions[chassis], atlas = manifest[chassis];
    if (!spec || !Number.isInteger(row) || row < 0 || row > 4 || !Number.isInteger(direction) || direction < 0 || direction > 7) return null;
    // Three right-hand views reuse mirrored left-hand views. This keeps the
    // silhouette consistent where generated right-hand poses were inaccurate.
    const column = direction > 4 ? 8 - direction : direction;
    const columns = spec.rowColumns?.[row] || spec.columns;
    const x = columns[column], y = Math.round(atlas.rows[row] * atlas.height);
    return { x, y, width: columns[column + 1] - x, height: Math.round(atlas.rows[row + 1] * atlas.height) - y,
      pivotX: spec.centers[column] - x, pivotY: (row === 0 ? spec.torsoY : spec.hipsY[row]) - y, flip: direction > 4 };
  }
  class Sprites {
    constructor() { this.images = {}; this.ready = false; }
    async load(progress = () => {}) {
      let done = 0;
      await Promise.all(Object.entries(manifest).map(([key, entry]) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = async () => {
          try { if (image.decode) await image.decode(); } catch { /* Some file browsers do not expose decode. */ }
          if (!image.naturalWidth || (entry.width && (image.naturalWidth !== entry.width || image.naturalHeight !== entry.height))) { reject(new Error(entry.src)); return; }
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
    mechLayer(ctx, chassis, row, direction, x, y, size) {
      const image = this.images[chassis], cell = frameRect(chassis, row, direction);
      if (!image || !cell) return;
      const scale = size / 300;
      ctx.save(); ctx.translate(x, y); ctx.scale(cell.flip ? -1 : 1, 1);
      ctx.drawImage(image, cell.x, cell.y, cell.width, cell.height,
        -cell.pivotX * scale, -cell.pivotY * scale, cell.width * scale, cell.height * scale);
      ctx.restore();
    }
    mech(ctx, p, x, y, size) {
      if (!this.images[p.chassis]) return;
      const pose = animationPose(p), E = root.ChitinEconomy;
      const installed = E ? E.visualParts(p.installedParts) : [];
      const angle = Math.PI / 2 + pose.torso * Math.PI / 4;
      const legAngle = Math.PI / 2 + pose.legs * Math.PI / 4;
      const recoil = pose.recoil * size * .018;
      const upperX = x - Math.cos(angle) * recoil, upperY = y - Math.sin(angle) * recoil * .65;
      // Project hardpoints in the fixed camera, not by rotating the entire body.
      const socket = (bearing, side, forward, height, ox = x, oy = y) => ({
        x: ox + (Math.cos(bearing) * forward - Math.sin(bearing) * side) * size,
        y: oy + (Math.sin(bearing) * forward + Math.cos(bearing) * side) * size * .65 - height * size
      });
      const part = (item, mount, width, bearing) => {
        ctx.save();
        if (item.visualHue) ctx.filter = `${typeof ctx.filter === 'string' && ctx.filter !== 'none' ? ctx.filter : ''} hue-rotate(${item.visualHue}deg)`;
        this.draw(ctx, 'parts', Math.floor(item.visual / 4), item.visual % 4, mount.x, mount.y, width * size * (item.visualScale || 1), bearing - Math.PI / 2);
        ctx.restore();
      };
      this.mechLayer(ctx, p.chassis, pose.row, pose.legs, x, y, size);
      const drive = installed.find(item => item.slot === 'drive');
      if (drive) {
        if (drive.id === 'hydraulics') {
          for (const side of [-.12, .12]) part(drive, socket(legAngle, side, 0, -.13), .16, legAngle);
        } else part(drive, socket(legAngle, 0, -.06, -.07), .30, legAngle);
      }
      const attachments = [];
      const add = (item, side, forward, height, width) => attachments.push({ item, mount: socket(angle, side, forward, height, upperX, upperY), width,
        behind: Math.sin(angle) * forward + Math.cos(angle) * side < -.025 });
      for (const item of installed) {
        if (item.slot === 'reactor') add(item, 0, -.16, .20, .28);
        if (item.slot === 'armor') {
          if (item.id === 'ceramic') { add(item, -.20, 0, .22, .20); add(item, .20, 0, .22, .20); }
          else add(item, 0, .12, .19, .29);
        }
        if (item.slot === 'weapon') add(item, .24, .05, .12, .36);
        if (item.slot === 'utility') add(item, -.23, 0, .19, .23);
      }
      for (const a of attachments.filter(a => a.behind)) part(a.item, a.mount, a.width, angle);
      this.mechLayer(ctx, p.chassis, 0, pose.torso, upperX, upperY, size);
      for (const a of attachments.filter(a => !a.behind)) part(a.item, a.mount, a.width, angle);
    }
    preview(canvas, chassis, time, reduced, installedParts = {}) {
      if (!this.ready) return;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const angle = reduced ? Math.PI / 2 : Math.PI / 2 + Math.floor(time / 2) * Math.PI / 4;
      this.mech(ctx, { chassis, moving: !reduced, walkTime: time, dashTime: 0, angle, moveAngle: angle, installedParts }, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * .75);
    }
  }
  root.ChitinSprites = { Sprites, manifest, WALK_FPS, walkFrame, mechDefinitions, animations, directionIndex, animationPose, frameRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ChitinSprites;
})(typeof globalThis !== 'undefined' ? globalThis : this);
