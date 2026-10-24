(function (root) {
  'use strict';
  const TAU = Math.PI * 2, EYE = 56, NEAR = 3, FAR = 1900, MAX_WEAPONS = 12;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function look(view, dx, dy, sensitivity = .0023) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    view.yaw = wrap(view.yaw + dx * sensitivity);
    view.pitch = clamp(view.pitch - dy * sensitivity, -.85, .70);
  }
  function movement(yaw, right, forward) {
    const length = Math.max(1, Math.hypot(right, forward)); right /= length; forward /= length;
    return { x: Math.cos(yaw) * forward - Math.sin(yaw) * right, y: Math.sin(yaw) * forward + Math.cos(yaw) * right };
  }
  function camera(player, width, height, reduced = false) {
    const yaw = player.angle, pitch = player.pitch || 0;
    return { x: player.x, y: player.y, z: EYE + (reduced ? 0 : Math.sin(player.walk * 1.5) * Math.min(1.3, Math.hypot(player.vx, player.vy) / 160)),
      yaw, pitch, cos: Math.cos(yaw), sin: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), width, height,
      focal: Math.max(width * .5 / Math.tan(Math.PI * 50 / 180), height * .62) };
  }
  function local(c, x, y, z = 0) {
    const dx = x - c.x, dy = y - c.y, forward = dx * c.cos + dy * c.sin, vertical = z - c.z;
    return { side: -dx * c.sin + dy * c.cos, up: vertical * c.cp - forward * c.sp, depth: forward * c.cp + vertical * c.sp };
  }
  function screen(c, q) { const scale = c.focal / q.depth; return { x: c.width / 2 + q.side * scale, y: c.height / 2 - q.up * scale, depth: q.depth, scale }; }
  function project(c, x, y, z = 0) { const q = local(c, x, y, z); return q.depth < NEAR || q.depth > FAR ? null : screen(c, q); }
  function face(c, points) {
    const input = points.map(p => local(c, ...p)), clipped = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length];
      if (a.depth >= NEAR) clipped.push(a);
      if ((a.depth >= NEAR) !== (b.depth >= NEAR)) {
        const t = (NEAR - a.depth) / (b.depth - a.depth);
        clipped.push({ side: a.side + (b.side - a.side) * t, up: a.up + (b.up - a.up) * t, depth: NEAR });
      }
    }
    return clipped.map(q => screen(c, q));
  }
  function sphereHit(a, b, center, radius) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const fx = a.x - center.x, fy = a.y - center.y, fz = a.z - center.z;
    const aa = dx * dx + dy * dy + dz * dz, cc = fx * fx + fy * fy + fz * fz - radius * radius;
    if (cc <= 0) return 0; if (aa < 1e-9) return null;
    const bb = 2 * (fx * dx + fy * dy + fz * dz), disc = bb * bb - 4 * aa * cc;
    if (disc < 0) return null;
    const t = (-bb - Math.sqrt(disc)) / (2 * aa); return t >= 0 && t <= 1 ? t : null;
  }
  function mounts(count, width, height) {
    const size = Math.min(width * .23, height * .36);
    return Array.from({ length: Math.min(MAX_WEAPONS, count) }, (_, i) => {
      const side = i % 2 ? 1 : -1, tier = Math.floor(i / 2);
      return { side, x: width * (side < 0 ? .15 : .85), y: height * (.84 - tier * .085), size: size * (1 - tier * .065), tier };
    });
  }
  const api = { TAU, EYE, NEAR, FAR, MAX_WEAPONS, clamp, wrap, look, movement, camera, local, screen, project, face, sphereHit, mounts };
  root.ChitinView = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
