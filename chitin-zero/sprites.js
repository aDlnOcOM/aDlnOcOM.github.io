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
    spectre: { columns: [0, 202, 384, 588, 791, 1005] },
    bastion: { columns: [0, 212, 400, 601, 792, 1000], rowColumns: { 4: [0, 190, 400, 601, 792, 1000] } },
    vector: { columns: [0, 233, 440, 616, 809, 1024] }
  };
  // Source-space mechanical couplers, calibrated per view AND per gait pose.
  // Bounding-box centers are not joints (especially with a gun extending sideways).
  const joints = {
    spectre: [
      [[104, 154], [302, 150], [506, 153], [685, 147], [895, 155]],
      [[105, 219], [292, 219], [495, 219], [679, 219], [891, 220]],
      [[106, 406], [292, 408], [497, 409], [678, 409], [892, 409]],
      [[112, 598], [297, 603], [500, 602], [683, 603], [893, 601]],
      [[105, 804], [295, 804], [494, 802], [685, 803], [893, 803]]
    ],
    bastion: [
      [[119, 144], [305, 143], [506, 134], [687, 145], [894, 147]],
      [[109, 201], [300, 202], [504, 202], [697, 200], [888, 202]],
      [[112, 395], [299, 395], [501, 396], [694, 394], [891, 395]],
      [[109, 590], [306, 589], [510, 590], [700, 589], [891, 590]],
      [[110, 788], [301, 789], [512, 790], [705, 789], [887, 790]]
    ],
    vector: [
      [[129, 163], [330, 159], [536, 148], [708, 151], [904, 158]],
      [[136, 215], [331, 216], [534, 218], [701, 217], [905, 216]],
      [[135, 405], [339, 406], [536, 408], [697, 407], [905, 407]],
      [[135, 599], [344, 600], [535, 601], [700, 601], [905, 601]],
      [[131, 798], [330, 798], [537, 797], [699, 798], [910, 800]]
    ]
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
    return { state, row: spec.frame_sequence[frame], legs: p.legDirection ?? directionIndex(p.moveAngle), torso: p.torsoDirection ?? directionIndex(p.angle), recoil: Math.min(1, Math.max(0, p.shootTime || 0) / .12) };
  }
  function frameRect(chassis, row, direction) {
    const spec = Object.hasOwn(mechDefinitions, chassis) ? mechDefinitions[chassis] : null, atlas = manifest[chassis];
    if (!spec || !Number.isInteger(row) || row < 0 || row > 4 || !Number.isInteger(direction) || direction < 0 || direction > 7) return null;
    // Three right-hand views reuse mirrored left-hand views. This keeps the
    // silhouette consistent where generated right-hand poses were inaccurate.
    const column = direction > 4 ? 8 - direction : direction;
    const columns = spec.rowColumns?.[row] || spec.columns;
    const x = columns[column], y = Math.round(atlas.rows[row] * atlas.height);
    return { x, y, width: columns[column + 1] - x, height: Math.round(atlas.rows[row + 1] * atlas.height) - y,
      pivotX: joints[chassis][row][column][0] - x, pivotY: joints[chassis][row][column][1] - y, flip: direction > 4 };
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
      const upperX = x, upperY = y;
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
      // Lean and recoil deform the upper body ABOUT the pelvis, never translate
      // the coupler away from the legs. Attachments share this exact transform.
      ctx.save(); ctx.translate(x, y);
      ctx.transform(1, 0, (p.leanX || 0) * .035 + Math.cos(angle) * pose.recoil * .012, 1 + (p.leanY || 0) * .018 - pose.recoil * .012, 0, 0);
      ctx.translate(-x, -y);
      for (const a of attachments.filter(a => a.behind)) part(a.item, a.mount, a.width, angle);
      this.mechLayer(ctx, p.chassis, 0, pose.torso, upperX, upperY, size);
      for (const a of attachments.filter(a => !a.behind)) part(a.item, a.mount, a.width, angle);
      ctx.restore();
    }
    preview(canvas, chassis, time, reduced, installedParts = {}) {
      if (!this.ready) return;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const angle = reduced ? Math.PI / 2 : Math.PI / 2 + time * Math.PI / 4 / 2;
      this.mech(ctx, { chassis, moving: !reduced, walkTime: time, dashTime: 0, angle, moveAngle: angle, installedParts }, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * .75);
    }
  }
  root.ChitinSprites = { Sprites, manifest, WALK_FPS, walkFrame, mechDefinitions, joints, animations, directionIndex, animationPose, frameRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ChitinSprites;
})(typeof globalThis !== 'undefined' ? globalThis : this);
