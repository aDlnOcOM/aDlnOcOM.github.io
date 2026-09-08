/* Perception and navigation use observations, never a hidden live target. */
(() => {
  'use strict';
  const angle = value => Math.atan2(Math.sin(value), Math.cos(value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function visible(observer, target, range, fov, lineOfSight) {
    return distance(observer, target) <= range
      && Math.abs(angle(Math.atan2(target.y - observer.y, target.x - observer.x) - observer.angle)) <= fov / 2
      && lineOfSight(observer.x, observer.y, target.x, target.y);
  }
  function init(guard) {
    if (guard.ai) return guard.ai;
    return guard.ai = { mode: 'patrol', home: { x: guard.x, y: guard.y }, exposure: 0,
      target: null, expires: 0, reportAt: 0, searchUntil: 0, path: [], replanAt: 0 };
  }
  function report(guards, source, point, now, confirmed) {
    for (const guard of guards) {
      if (guard.boss || guard.health <= 0) continue;
      const ai = init(guard);
      // The alarm is floor-wide; only nearby units respond to this sector.
      if (guard !== source && (distance(guard, point) > 1100 || ai.mode === 'engage')) continue;
      if (!confirmed && ai.target && ai.expires > now) continue;
      const changed = !ai.target || distance(ai.target, point) > 48;
      ai.target = { x: point.x, y: point.y };
      ai.expires = now + (confirmed ? 12 : 6);
      if (changed) { ai.path = []; ai.replanAt = 0; }
      if (ai.mode !== 'engage') ai.mode = 'investigate';
    }
  }
  // Segment against expanded boxes: routes account for the unit's body width.
  function clear(a, b, walls, radius = 0) {
    for (const wall of walls) {
      let near = 0, far = 1;
      for (const [origin, delta, low, high] of [
        [a.x, b.x - a.x, wall.x - radius, wall.x + wall.width + radius],
        [a.y, b.y - a.y, wall.y - radius, wall.y + wall.height + radius]
      ]) {
        if (Math.abs(delta) < 1e-8) {
          if (origin < low || origin > high) { near = 2; break; }
        } else {
          const first = (low - origin) / delta, second = (high - origin) / delta;
          near = Math.max(near, Math.min(first, second));
          far = Math.min(far, Math.max(first, second));
        }
      }
      if (near <= far) return false;
    }
    return true;
  }
  function route(start, end, walls, radius) {
    if (clear(start, end, walls, radius)) return [{ ...end }];
    const margin = radius + 3;
    const nodes = [{ x: start.x, y: start.y }, { ...end }];
    for (const wall of walls) {
      if (wall.outer) continue;
      for (const x of [wall.x - margin, wall.x + wall.width + margin]) {
        for (const y of [wall.y - margin, wall.y + wall.height + margin]) {
          const point = { x, y };
          if (x < Math.min(start.x, end.x) - 350 || x > Math.max(start.x, end.x) + 350) continue;
          if (clear(point, point, walls, radius)) nodes.push(point);
        }
      }
    }
    const costs = nodes.map(() => Infinity), previous = [], visited = new Set();
    costs[0] = 0;
    while (visited.size < nodes.length) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
      if (current < 0 || !Number.isFinite(costs[current])) break;
      if (current === 1) {
        const path = [];
        for (let i = 1; i !== 0; i = previous[i]) path.unshift(nodes[i]);
        return path;
      }
      visited.add(current);
      for (let i = 0; i < nodes.length; i++) {
        const next = costs[current] + distance(nodes[current], nodes[i]);
        if (!visited.has(i) && next < costs[i] && clear(nodes[current], nodes[i], walls, radius)) {
          costs[i] = next; previous[i] = current;
        }
      }
    }
    return [];
  }
  function turn(guard, target, delta) {
    const diff = angle(target - guard.angle);
    guard.angle += Math.max(-delta * 3, Math.min(delta * 3, diff));
  }
  function travel(guard, target, delta, env, speed = 1) {
    const ai = init(guard);
    if (env.now >= ai.replanAt) {
      ai.path = route(guard, target, env.walls, guard.radius + 1);
      ai.replanAt = env.now + .9;
    }
    while (ai.path.length && distance(guard, ai.path[0]) < 6) ai.path.shift();
    const next = ai.path[0];
    if (!next) return;
    const heading = Math.atan2(next.y - guard.y, next.x - guard.x);
    turn(guard, heading, delta);
    const step = Math.min(distance(guard, next), guard.speed * speed * delta);
    env.move(guard, Math.cos(heading) * step, Math.sin(heading) * step);
  }
  function tick(guard, delta, env) {
    const ai = init(guard);
    const turret = guard.type === 'turret';
    const sees = visible(guard, env.player, turret ? 440 : 360, turret ? 1.05 : 1.3, env.los);
    ai.exposure = Math.max(0, Math.min(.4, ai.exposure + (sees ? delta : -delta * 1.5)));
    guard.sighting = ai.exposure;
    guard.fireTimer = Math.max(0, guard.fireTimer - delta);
    if (sees && ai.exposure >= .4) {
      ai.mode = 'engage';
      ai.target = { x: env.player.x, y: env.player.y };
      ai.expires = env.now + 12;
      if (env.now >= ai.reportAt) {
        env.report(guard, ai.target, true);
        ai.reportAt = env.now + .8;
      }
      const heading = Math.atan2(ai.target.y - guard.y, ai.target.x - guard.x);
      turn(guard, heading, delta);
      if (!turret && distance(guard, ai.target) > 235) travel(guard, ai.target, delta, env, 1.2);
      if (guard.fireTimer <= 0 && Math.abs(angle(heading - guard.angle)) < .22) {
        env.fire(guard, Math.cos(heading), Math.sin(heading));
        guard.fireTimer = guard.fireRate;
      }
      return;
    }
    if (ai.mode === 'engage') ai.mode = 'investigate';
    if (ai.target && env.now > ai.expires) {
      ai.target = null; ai.path = []; ai.replanAt = 0; ai.mode = 'return';
    }
    if (sees) {
      ai.mode = 'suspicious';
      turn(guard, Math.atan2(env.player.y - guard.y, env.player.x - guard.x), delta);
      return;
    }
    if (ai.target) {
      if (turret || distance(guard, ai.target) < 32) {
        if (ai.mode !== 'search') { ai.mode = 'search'; ai.searchUntil = env.now + 4; }
        const heading = Math.atan2(ai.target.y - guard.y, ai.target.x - guard.x);
        turn(guard, heading + Math.sin(env.now * 1.7 + guard.phase) * 1.15, delta);
        if (env.now > ai.searchUntil) { ai.target = null; ai.mode = 'return'; ai.replanAt = 0; }
      } else { ai.mode = 'investigate'; travel(guard, ai.target, delta, env, 1.25); }
      return;
    }
    if (turret) {
      ai.mode = 'patrol';
      turn(guard, guard.homeAngle + Math.sin(env.now * (env.alarm ? 1.3 : .4) + guard.phase) * (env.alarm ? 1.35 : .4), delta);
      return;
    }
    if (ai.mode === 'return' && distance(guard, ai.home) > 20) {
      travel(guard, ai.home, delta, env); return;
    }
    ai.mode = 'patrol';
    const left = env.alarm ? guard.alertStart : guard.patrolStart;
    const right = env.alarm ? guard.alertEnd : guard.patrolEnd;
    const target = { x: guard.patrolDirection > 0 ? right : left, y: ai.home.y };
    if (distance(guard, target) < 20) { guard.patrolDirection *= -1; ai.replanAt = 0; }
    travel(guard, target, delta, env, env.alarm ? 1.2 : .75);
  }
  window.SecurityAI = { visible, init, report, clear, route, tick };
})();
