(() => {
  "use strict";
  const duration = .2;
  const cooldown = 1.4;
  const speed = 800;
  function start(player, keys, aim) {
    if (!player || player.health <= 0 || player.dash?.cooldown > 0) return false;
    let x = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    let y = Number(keys.has("KeyS") || keys.has("ArrowDown")) - Number(keys.has("KeyW") || keys.has("ArrowUp"));
    const length = Math.hypot(x, y);
    if (length) { x /= length; y /= length; }
    else { x = Math.cos(aim); y = Math.sin(aim); }
    player.dash = { x, y, remaining: duration, cooldown, trail: [] };
    return true;
  }
  function tick(player, delta, move) {
    const dash = player.dash;
    if (!dash) return false;
    dash.cooldown = Math.max(0, dash.cooldown - delta);
    dash.trail = dash.trail.filter(point => (point.life -= delta) > 0);
    if (dash.remaining <= 0) return false;
    const time = Math.min(delta, dash.remaining);
    dash.remaining = Math.max(0, dash.remaining - time);
    // Small swept steps reuse world collision, including crates and locked gates.
    const steps = Math.max(1, Math.ceil(speed * time / 4));
    for (let i = 0; i < steps; i++) {
      const before = { x: player.x, y: player.y };
      move(player, dash.x * speed * time / steps, dash.y * speed * time / steps);
      if (Math.hypot(player.x - before.x, player.y - before.y) < .1) { dash.remaining = 0; break; }
      if (i % 3 === 0) dash.trail.push({ x: player.x, y: player.y, life: .18 });
    }
    return true;
  }
  function draw(context, player, cameraX, visible) {
    const dash = player.dash;
    if (!dash) return;
    context.save();
    for (const point of dash.trail) {
      if (!visible(point)) continue;
      context.save();
      context.translate(point.x - cameraX, point.y);
      context.rotate(Math.atan2(dash.y, dash.x));
      context.globalAlpha = point.life / .18 * .28;
      context.fillStyle = "#8ff7ef";
      context.fillRect(-12, -8, 24, 16);
      context.restore();
    }
    context.restore();
  }
  window.PlayerDash = { start, tick, draw, duration, cooldown, speed };
})();
