/* Shared angular falloff and solid occlusion for eyes, optics and light. */
(() => {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const angle = x => Math.atan2(Math.sin(x), Math.cos(x));
  function strength(observer, target, range, fov, los) {
    const distance = Math.hypot(target.x - observer.x, target.y - observer.y);
    if (distance > range || !los(observer.x, observer.y, target.x, target.y)) return 0;
    const offset = Math.abs(angle(Math.atan2(target.y - observer.y, target.x - observer.x) - observer.angle));
    if (fov < Math.PI * 2 && offset >= fov / 2) return 0;
    const angular = fov >= Math.PI * 2 ? 1 : smooth((fov / 2 - offset) / (fov * .12));
    const radial = Number.isFinite(range) ? smooth((range - distance) / (range * .3)) : 1;
    return angular * radial;
  }
  function cast(x, y, heading, range, walls) {
    let nearest = range;
    const dx = Math.cos(heading), dy = Math.sin(heading);
    for (const wall of walls) {
      let near = 0, far = nearest;
      for (const [origin, direction, low, high] of [[x, dx, wall.x, wall.x + wall.width], [y, dy, wall.y, wall.y + wall.height]]) {
        if (Math.abs(direction) < 1e-9) {
          if (origin < low || origin > high) { near = Infinity; break; }
        } else {
          const a = (low - origin) / direction, b = (high - origin) / direction;
          near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        }
      }
      if (near <= far) nearest = Math.min(nearest, near);
    }
    return nearest;
  }
  function lineOfSight(x, y, tx, ty, walls) {
    const range = Math.hypot(tx - x, ty - y);
    return cast(x, y, Math.atan2(ty - y, tx - x), range, walls) >= range - .001;
  }
  function playerLayers(alarm, flashlight, stats) {
    const layers = [{ fov: Math.PI * 2, range: 22, opacity: .35 }];
    layers.push({ fov: 68 * Math.PI / 180, range: alarm ? 78 : Infinity, opacity: alarm ? .42 : 1 });
    if (flashlight) layers.push({ fov: Math.min(55, stats.flashlightAngle) * Math.PI / 180, range: stats.flashlightRange, opacity: 1 });
    return layers;
  }
  function playerStrength(observer, point, layers, los) {
    return clamp(layers.reduce((sum, layer) => sum + layer.opacity * strength(observer, point, layer.range, layer.fov, los), 0));
  }
  function drawLayer(ctx, observer, layer, walls, cameraX, maxRange) {
    const range = Math.min(layer.range, maxRange), half = layer.fov / 2;
    walls = walls.filter(wall => wall.x <= observer.x + range && wall.x + wall.width >= observer.x - range
      && wall.y <= observer.y + range && wall.y + wall.height >= observer.y - range);
    const rays = [];
    const steps = Math.max(48, Math.ceil(layer.fov * 80));
    for (let i = 0; i <= steps; i++) rays.push(-half + layer.fov * i / steps);
    // Corner rays prevent narrow obstacles disappearing between regular rays.
    for (const wall of walls) for (const x of [wall.x, wall.x + wall.width]) for (const y of [wall.y, wall.y + wall.height]) {
      if (Math.hypot(x - observer.x, y - observer.y) > range) continue;
      const offset = angle(Math.atan2(y - observer.y, x - observer.x) - observer.angle);
      for (const nudge of [-.0001, 0, .0001]) if (offset + nudge > -half && offset + nudge < half) rays.push(offset + nudge);
    }
    rays.sort((a, b) => a - b);
    const ox = observer.x - cameraX, oy = observer.y;
    const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, range);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(.7, '#ffffff');
    gradient.addColorStop(.85, Number.isFinite(layer.range) ? '#ffffff80' : '#ffffff');
    gradient.addColorStop(1, Number.isFinite(layer.range) ? '#ffffff00' : '#ffffff');
    ctx.save(); ctx.fillStyle = gradient;
    // Add antialiased shared triangle edges instead of leaving dark radial seams.
    ctx.globalCompositeOperation = 'lighter';
    let previous;
    for (const offset of rays) {
      const direction = observer.angle + offset;
      const length = cast(observer.x, observer.y, direction, range, walls);
      const point = { x: ox + Math.cos(direction) * length, y: oy + Math.sin(direction) * length, offset };
      if (previous) {
        const middle = (previous.offset + offset) / 2;
        ctx.globalAlpha = layer.opacity * (layer.fov >= Math.PI * 2 ? 1 : smooth((half - Math.abs(middle)) / (layer.fov * .12)));
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.closePath(); ctx.fill();
      }
      previous = point;
    }
    ctx.restore();
  }
  window.Perception = { strength, cast, lineOfSight, playerLayers, playerStrength, drawLayer };
})();
