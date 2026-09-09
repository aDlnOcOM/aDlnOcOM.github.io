(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES, MODULE_SIZE, moduleDirection } = VS.ModuleSystem;
  const EPSILON = 0.00001;
  const SEPARATION = 0.015;
  // Only the rebound is reduced, not the impulse that stops interpenetration.
  const RESTITUTION = 0.08 / 3;
  const LASER_MINING_POWER = 33;
  const DRILL_MINING_POWER = LASER_MINING_POWER * 1.6;
  const STATIC_GEOMETRY = new WeakMap();
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  function polygon(points, module = null, kind = "module") {
    return { points, module, kind, minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) };
  }
  function circle(x, y, radius) { return { x, y, radius, kind: "asteroid", minX: x - radius, maxX: x + radius, minY: y - radius, maxY: y + radius }; }
  function liveModule(body, module) {
    return module.integrity !== 0 && !(module.combatHp <= 0) && !(body.engineering?.nodes.get(`${module.gx},${module.gy}`)?.integrity <= 0);
  }
  function drillShape(body, module) {
    const [dx, dy] = moduleDirection(module);
    return polygon([[9, -7.5], [19, -1], [19, 1], [9, 7.5]].map(([x, y]) => body.localToWorld(module.gx * 30 + x * dx - y * dy, module.gy * 30 + x * dy + y * dx)), module, "drillTip");
  }
  function shapes(body, modules = body.modules) {
    if (!modules) {
      if (body.collisionHull?.length) {
        const c = Math.cos(body.rotation || 0), s = Math.sin(body.rotation || 0);
        return [polygon(body.collisionHull.map(p => ({ x: body.x + (p.x * c - p.y * s) * body.radius, y: body.y + (p.x * s + p.y * c) * body.radius })), null, "asteroid")];
      }
      return [circle(body.x, body.y, body.collisionRadius ?? body.radius)];
    }
    const result = [];
    for (const module of modules) {
      if (!liveModule(body, module)) continue;
      result.push(polygon(VS.ModuleSystem.localPolygon(module).map(p => body.localToWorld(p.x, p.y)), module));
      if (module.type === "drill") result.push(drillShape(body, module));
    }
    return result;
  }
  function overlaps(a, b, margin = 0) {
    return a.maxX + margin >= b.minX && b.maxX + margin >= a.minX && a.maxY + margin >= b.minY && b.maxY + margin >= a.minY;
  }
  function bounds(parts) {
    return { minX: Math.min(...parts.map(p => p.minX)), maxX: Math.max(...parts.map(p => p.maxX)), minY: Math.min(...parts.map(p => p.minY)), maxY: Math.max(...parts.map(p => p.maxY)) };
  }
  function intersection(a, b) {
    let points = a.slice();
    for (let i = 0; i < b.length && points.length; i++) {
      const start = b[i], edge = subtract(b[(i + 1) % b.length], start), input = points;
      points = [];
      for (let j = 0; j < input.length; j++) {
        const p = input[j], q = input[(j + 1) % input.length];
        const dp = cross(edge, subtract(p, start)), dq = cross(edge, subtract(q, start));
        if (dp >= -EPSILON) points.push(p);
        if ((dp > 0) !== (dq > 0) && Math.abs(dp - dq) > EPSILON) {
          const t = dp / (dp - dq); points.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        }
      }
    }
    return points;
  }
  function polygonContact(a, b, margin) {
    let depth = Infinity, normal = null;
    for (const points of [a.points, b.points]) for (let i = 0; i < points.length; i++) {
      const edge = subtract(points[(i + 1) % points.length], points[i]), length = Math.hypot(edge.x, edge.y);
      if (length < EPSILON) continue;
      const axis = { x: -edge.y / length, y: edge.x / length };
      const pa = a.points.map(p => dot(p, axis)), pb = b.points.map(p => dot(p, axis));
      const positive = Math.max(...pb) - Math.min(...pa), negative = Math.max(...pa) - Math.min(...pb);
      if (positive < -margin || negative < -margin) return null;
      const penetration = Math.min(positive, negative);
      if (penetration < depth) { depth = penetration; const sign = positive < negative ? 1 : -1; normal = { x: axis.x * sign, y: axis.y * sign }; }
    }
    if (!normal) return null;
    const clipped = intersection(a.points, b.points);
    const point = clipped.length ? { x: clipped.reduce((sum, p) => sum + p.x, 0) / clipped.length, y: clipped.reduce((sum, p) => sum + p.y, 0) / clipped.length }
      : { x: (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2, y: (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2 };
    return { normalX: normal.x, normalY: normal.y, penetration: depth, contactX: point.x, contactY: point.y };
  }
  function polygonCircle(a, b, margin) {
    let closest = null, distanceSquared = Infinity, inside = true;
    for (let i = 0; i < a.points.length; i++) {
      const p = a.points[i], edge = subtract(a.points[(i + 1) % a.points.length], p), offset = subtract(b, p);
      if (cross(edge, offset) < 0) inside = false;
      const t = VS.Utils.clamp(dot(offset, edge) / Math.max(EPSILON, dot(edge, edge)), 0, 1);
      const q = { x: p.x + edge.x * t, y: p.y + edge.y * t }, distance = (q.x - b.x) ** 2 + (q.y - b.y) ** 2;
      if (distance < distanceSquared) { distanceSquared = distance; closest = q; }
    }
    const distance = Math.sqrt(distanceSquared);
    if (!inside && distance > b.radius + margin) return null;
    let nx = closest.x - b.x, ny = closest.y - b.y;
    if (distance < EPSILON) {
      const center = { x: (a.minX + a.maxX) / 2, y: (a.minY + a.maxY) / 2 };
      nx = center.x - b.x; ny = center.y - b.y;
      const length = Math.hypot(nx, ny); nx = length > EPSILON ? nx / length : 1; ny = length > EPSILON ? ny / length : 0;
    } else { const sign = inside ? -1 : 1; nx *= sign / distance; ny *= sign / distance; }
    return { normalX: nx, normalY: ny, penetration: inside ? b.radius + distance : b.radius - distance, contactX: closest.x, contactY: closest.y };
  }
  function shapeContact(a, b, margin = 0) {
    if (!overlaps(a, b, margin)) return null;
    let contact;
    if (a.points && b.points) contact = polygonContact(a, b, margin);
    else if (a.points) contact = polygonCircle(a, b, margin);
    else if (b.points) { contact = polygonCircle(b, a, margin); if (contact) { contact.normalX *= -1; contact.normalY *= -1; } }
    if (!contact || contact.penetration < -margin) return null;
    return { ...contact, module: a.module, otherModule: b.module, kind: a.kind, otherKind: b.kind };
  }
  function findContact(a, b, margin = 0) {
    if (!overlaps(bounds(a), bounds(b), margin)) return null;
    let deepest = null;
    for (const first of a) for (const second of b) {
      const contact = shapeContact(first, second, margin);
      if (contact && (!deepest || contact.penetration > deepest.penetration)) deepest = contact;
    }
    return deepest;
  }
  function translationInterval(a, b, direction) {
    let enter = -Infinity, exit = Infinity;
    for (const points of [a.points, b.points]) for (let i = 0; i < points.length; i++) {
      const edge = subtract(points[(i + 1) % points.length], points[i]), axis = { x: -edge.y, y: edge.x };
      const pa = a.points.map(p => dot(p, axis)), pb = b.points.map(p => dot(p, axis)), speed = dot(direction, axis);
      const lo = Math.min(...pb) - Math.max(...pa), hi = Math.max(...pb) - Math.min(...pa);
      if (Math.abs(speed) < EPSILON) { if (lo > 0 || hi < 0) return null; }
      else { enter = Math.max(enter, Math.min(lo / speed, hi / speed)); exit = Math.min(exit, Math.max(lo / speed, hi / speed)); }
      if (enter > exit) return null;
    }
    return { enter, exit };
  }
  function recoverOverlap(a, b, contact) {
    // Old saves could place an entire assembly through several station modules.
    // Union swept overlap intervals instead of oscillating between their internal faces.
    if (!a.every(p => p.points) || !b.every(p => p.points)) return contact;
    const { normalX: nx, normalY: ny } = contact;
    let best = null;
    for (const direction of [{ x: nx, y: ny }, { x: -nx, y: -ny }, { x: -ny, y: nx }, { x: ny, y: -nx }]) {
      const intervals = [];
      for (const first of a) for (const second of b) {
        const interval = translationInterval(first, second, direction);
        if (interval && interval.exit >= 0) intervals.push(interval);
      }
      intervals.sort((p, q) => p.enter - q.enter);
      let distance = 0;
      for (const interval of intervals) {
        if (interval.enter > distance + SEPARATION) break;
        distance = Math.max(distance, interval.exit + SEPARATION);
      }
      if (Number.isFinite(distance) && distance > 0 && (!best || distance < best.distance)) best = { distance, ...direction };
    }
    return best ? { ...contact, normalX: best.x, normalY: best.y, penetration: best.distance } : contact;
  }
  function circleCollision(body, x, y, radius) { return findContact(shapes(body), [circle(x, y, radius)]); }
  function drillContact(body, module, asteroid) { return findContact([drillShape(body, module)], shapes(asteroid), 0.35); }
  function rayAsteroid(origin, direction, length, asteroid) {
    const shape = shapes(asteroid)[0];
    if (!shape.points) {
      const offset = subtract(shape, origin), along = dot(offset, direction), perpendicular = dot(offset, offset) - along * along;
      if (perpendicular > shape.radius ** 2 || along + shape.radius < 0) return null;
      const distance = Math.max(0, along - Math.sqrt(Math.max(0, shape.radius ** 2 - perpendicular)));
      return distance <= length ? distance : null;
    }
    let enter = 0, exit = length;
    for (let i = 0; i < shape.points.length; i++) {
      const start = shape.points[i], edge = subtract(shape.points[(i + 1) % shape.points.length], start);
      const position = cross(edge, subtract(origin, start)), speed = cross(edge, direction);
      if (Math.abs(speed) < EPSILON) { if (position < 0) return null; }
      else if (speed > 0) enter = Math.max(enter, -position / speed);
      else exit = Math.min(exit, -position / speed);
      if (enter > exit) return null;
    }
    return enter;
  }

  function actor(body, owner = null, fixed = false) {
    if (fixed) return { body, owner, fixed, inverseMass: 0, inverseInertia: 0 };
    let mass = 0, inertia = 0;
    if (body.modules) for (const module of body.modules) {
      const def = MODULES[module.type];
      const weight = ((def.materialArea ?? 1) + def.hp / 100 + (def.cargo || 0) / 40 + (def.energy || 0) / 50) * (def.density || 1) / 3;
      mass += weight; inertia += weight * ((module.gx * 30) ** 2 + (module.gy * 30) ** 2 + 150);
    }
    else mass = Math.max(4, (body.collisionRadius ?? body.radius) ** 2 / 90);
    return { body, owner, fixed, inverseMass: fixed ? 0 : 1 / Math.max(1, mass), inverseInertia: fixed || !body.modules ? 0 : 1 / Math.max(300, inertia) };
  }
  function actors(world) {
    const result = [];
    if (world.game.ship.hp > 0) result.push(actor(world.game.ship));
    for (const enemy of world.enemies) if (!enemy.dead && enemy.ship.hp > 0) result.push(actor(enemy.ship, enemy, Boolean(enemy.stationId)));
    for (const station of world.friendlyStations()) result.push(actor(station, station, true));
    for (const asteroid of world.game.asteroids) if (!asteroid.dead) result.push(actor(asteroid));
    return result;
  }
  function pointVelocity(a, x, y) {
    if (a.fixed) return { x: 0, y: 0 };
    const w = a.body.angularVelocity || 0;
    return { x: (a.body.vx || 0) - w * (y - a.body.y), y: (a.body.vy || 0) + w * (x - a.body.x) };
  }
  function resolvePair(a, b, contact) {
    const { normalX: nx, normalY: ny, contactX: x, contactY: y } = contact;
    const va = pointVelocity(a, x, y), vb = pointVelocity(b, x, y);
    const velocity = (va.x - vb.x) * nx + (va.y - vb.y) * ny;
    const armA = (x - a.body.x) * ny - (y - a.body.y) * nx, armB = (x - b.body.x) * ny - (y - b.body.y) * nx;
    const inverseMass = a.inverseMass + b.inverseMass;
    if (!inverseMass) return 0;
    if (velocity < -EPSILON) {
      const impulse = -(1 + RESTITUTION) * velocity / (inverseMass + armA ** 2 * a.inverseInertia + armB ** 2 * b.inverseInertia);
      for (const [item, sign, arm] of [[a, 1, armA], [b, -1, armB]]) if (!item.fixed) {
        item.body.vx = (item.body.vx || 0) + nx * impulse * sign * item.inverseMass;
        item.body.vy = (item.body.vy || 0) + ny * impulse * sign * item.inverseMass;
        if (item.inverseInertia) item.body.angularVelocity = (item.body.angularVelocity || 0) + arm * impulse * sign * item.inverseInertia;
      }
    }
    const correction = Math.max(0, contact.penetration + SEPARATION) / inverseMass;
    for (const [item, sign] of [[a, 1], [b, -1]]) if (!item.fixed) { item.body.x += nx * correction * sign * item.inverseMass; item.body.y += ny * correction * sign * item.inverseMass; }
    return Math.max(0, -velocity);
  }
  function damageImpact(world, a, b, contact, speed) {
    if (speed < 8) return;
    world.collisionCooldowns ||= new WeakMap();
    let cooldowns = world.collisionCooldowns.get(a.body);
    if (!cooldowns) { cooldowns = new WeakMap(); world.collisionCooldowns.set(a.body, cooldowns); }
    const time = world.collisionTime || 0;
    if ((cooldowns.get(b.body) ?? -Infinity) > time) return;
    cooldowns.set(b.body, time + 0.45);
    for (const [self, other, module, kind] of [[a, b, contact.module, contact.otherKind], [b, a, contact.otherModule, contact.kind]]) {
      if (!self.body.modules) {
        const maximum = kind === "drillTip" ? DRILL_MINING_POWER * 4 : LASER_MINING_POWER;
        self.body.damage(maximum * VS.Utils.clamp(speed / (other.body.getMaxSpeed?.() || 173), 0, 1), contact.contactX, contact.contactY, world.game);
      } else if (module && (self.fixed || !world.safeAt(self.body))) {
        const amount = (other.body.modules ? 14 : 8 + other.body.size * 5) * VS.Utils.clamp(speed / 60, 0, 2);
        if (self.owner) self.owner.damage(module, amount, world, "kinetic");
        else if (self.body.engineering) self.body.engineering.damage(module, amount, "kinetic");
        else self.body.takeDamage(amount);
      }
    }
    world.explode(contact.contactX, contact.contactY, "#ffad76", 3);
  }
  function solve(world, dt) {
    world.collisionTime = (world.collisionTime || 0) + dt;
    for (let iteration = 0; iteration < 8; iteration++) {
      const bodies = actors(world), cache = new Map();
      const parts = a => {
        if (!cache.has(a)) {
          const saved = a.fixed && STATIC_GEOMETRY.get(a.body);
          let data;
          if (saved && saved.modules === a.body.modules && saved.x === a.body.x && saved.y === a.body.y && saved.angle === a.body.angle) data = saved;
          else { const geometry = shapes(a.body); data = { modules: a.body.modules, x: a.body.x, y: a.body.y, angle: a.body.angle, geometry, bounds: bounds(geometry) }; if (a.fixed) STATIC_GEOMETRY.set(a.body, data); }
          a.bounds = data.bounds; cache.set(a, data.geometry);
        }
        return cache.get(a);
      };
      let changed = false;
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        if ((a.fixed && b.fixed) || (!a.body.modules && !b.body.modules) || a.body.dead || b.body.dead || a.owner?.dead || b.owner?.dead) continue;
        const first = parts(a), second = parts(b);
        if (!overlaps(a.bounds, b.bounds)) continue;
        let contact = findContact(first, second);
        if (!contact || contact.penetration <= EPSILON) continue;
        if (contact.penetration > 8 && (a.fixed || b.fixed) && a.body.modules && b.body.modules) contact = recoverOverlap(parts(a), parts(b), contact);
        const speed = resolvePair(a, b, contact);
        damageImpact(world, a, b, contact, speed);
        cache.delete(a); cache.delete(b); changed = true;
      }
      if (!changed) break;
    }
  }
  function stepCount(world, dt) {
    let maximum = 0;
    for (const item of actors(world)) {
      if (item.fixed) continue;
      let radius = item.body.radius || 0;
      for (const module of item.body.modules || []) radius = Math.max(radius, Math.hypot(module.gx * 30, module.gy * 30) + 24);
      maximum = Math.max(maximum, Math.hypot(item.body.vx || 0, item.body.vy || 0) + Math.abs(item.body.angularVelocity || 0) * radius);
    }
    return Math.max(1, Math.min(128, Math.ceil(dt * Math.max(120, maximum / 3))));
  }
  function placementBlocked(ship, cells, world) {
    const candidate = shapes(ship, cells);
    return actors(world).some(a => a.body !== ship && findContact(candidate, shapes(a.body))?.penetration > EPSILON);
  }
  VS.Physics = { LASER_MINING_POWER, DRILL_MINING_POWER, shapes, shapeContact, findContact, circleCollision, drillContact, rayAsteroid, actor, resolvePair, solve, stepCount, placementBlocked };
})();
