(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES } = VS.ModuleSystem;
  const key = (m) => `${m.gx},${m.gy}`;
  function targets(world, faction) { return faction === "player" ? world.enemies.filter((e) => !e.dead).map((enemy) => ({ ship: enemy.ship, enemy })) : [{ ship: world.game.ship }]; }
  function hit(world, origin, direction, length, faction) {
    let nearest = null;
    for (const target of targets(world, faction)) {
      if (faction === "enemy" && world.safeAt(target.ship)) continue;
      const contact = VS.Combat.rayModules(target.ship, origin, direction, length);
      if (contact && (!nearest || contact.distance < nearest.distance)) nearest = { ...contact, ...target };
    }
    for (const asteroid of world.game.asteroids) {
      if (asteroid.dead) continue;
      const distance = VS.Combat.rayCircle(origin, direction, length, asteroid);
      if (distance !== null && (!nearest || distance < nearest.distance)) nearest = { distance, asteroid };
    }
    return nearest;
  }
  function damageTarget(world, target, amount, weapon) {
    const kind = ["beam", "plasma", "tesla"].includes(weapon.kind) ? "energy" : "kinetic";
    if (target.enemy) target.enemy.damage(target.module, amount, world, kind, weapon.penetration || 0);
    else target.ship.engineering ? target.ship.engineering.damage(target.module, amount, kind, weapon.penetration || 0) : target.ship.takeDamage(amount);
    if (weapon.emp) target.ship.engineering?.applyEmp(weapon.emp, weapon.kind === "tesla");
  }
  function detonate(world, bullet, impact) {
    const weapon = bullet.weapon || { kind: "plasma" };
    if (weapon.radius) {
      // Explosions include the shooter's ship. Friendly fields protect ships inside them.
      for (const target of [{ ship: world.game.ship }, ...world.enemies.filter((e) => !e.dead).map((enemy) => ({ ship: enemy.ship, enemy }))]) {
        if (world.safeAt(target.ship)) continue;
        for (const module of [...target.ship.modules]) {
          const position = target.ship.localToWorld(module.gx * 30, module.gy * 30);
          const distance = VS.Utils.distance(bullet, position);
          if (distance > weapon.radius) continue;
          damageTarget(world, { ...target, module }, bullet.damage * (1 - distance / weapon.radius) * (weapon.mining ? 0.2 : 1), weapon);
        }
      }
      if (weapon.mining) for (const asteroid of world.game.asteroids) if (!asteroid.dead && VS.Utils.distance(bullet, asteroid) < weapon.radius + asteroid.radius) asteroid.damage(bullet.damage, bullet.x, bullet.y, world.game);
      world.weaponBeams ||= [];
      world.weaponBeams.push({ ring: true, origin: { x: bullet.x, y: bullet.y }, radius: weapon.radius, life: 0.4, colour: bullet.colour });
    } else if (impact?.module) damageTarget(world, impact, bullet.damage, weapon);
    else if (impact?.asteroid && weapon.mining) impact.asteroid.damage(bullet.damage, bullet.x, bullet.y, world.game);
    world.explode(bullet.x, bullet.y, bullet.colour, weapon.radius ? 18 : 4);
  }
  function fire(world, ship, target, cooldowns, faction, dt, damageScale) {
    world.tickCooldowns(cooldowns, dt);
    const engineering = ship.engineering;
    for (const m of [...ship.modules]) {
      const def = MODULES[m.type], weapon = def.weapon;
      if (!weapon || cooldowns.get(key(m)) > 0 || world.bullets.length >= 160 || (engineering && !engineering.online(m))) continue;
      const center = ship.localToWorld(m.gx * 30, m.gy * 30);
      const forward = ship.angle + (m.rotation || 0) * Math.PI / 2;
      const offset = weapon.kind === "tesla" ? (def.footprint.width - 1) * 15 : def.footprint ? (def.footprint.width - 1) * 30 + 23 : 23;
      const muzzle = { x: center.x + Math.cos(forward) * offset, y: center.y + Math.sin(forward) * offset };
      const aim = Math.atan2(target.y - muzzle.y, target.x - muzzle.x);
      if (Math.abs(VS.Utils.angleDelta(forward, aim)) > (weapon.arc || Math.PI / 2) / 2 || VS.Utils.distance(muzzle, target) > weapon.range) continue;
      const count = weapon.count || 1;
      if (!["beam", "tesla"].includes(weapon.kind) && world.bullets.length + count > 160) continue;
      const power = engineering?.boost(m) || 1;
      const failure = weapon.ammo && (!engineering || engineering.stock[weapon.ammo] < count) ? `Нет: ${VS.EngineeringData.STOCK[weapon.ammo].name}`
        : weapon.heatCost && (!engineering || engineering.heatAvailable(m) < weapon.heatCost) ? `Нужно ${weapon.heatCost} ед. тепла`
          : engineering && engineering.available(m) < (weapon.energy || 0) * (power > 1 ? 1.3 : 1) ? "Недостаточно энергии" : "";
      if (failure) { if (faction === "player") world.weaponWarning = failure; continue; }
      if (engineering && !engineering.request(m, weapon.energy || 0)) continue;
      if (weapon.ammo) engineering.takeStock(weapon.ammo, count);
      if (weapon.heatCost) engineering.takeHeat(m, weapon.heatCost);
      engineering?.addHeat(m, (weapon.heat || 2) * engineering.heatMultiplier(m));
      const dx = Math.cos(aim), dy = Math.sin(aim);
      const origin = def.footprint ? muzzle : { x: center.x + dx * 23, y: center.y + dy * 23 };
      const damage = weapon.damage * damageScale * power;
      if (weapon.kind === "beam" || weapon.kind === "tesla") {
        world.weaponBeams ||= [];
        if (weapon.kind === "beam") {
          const contact = hit(world, origin, { x: dx, y: dy }, weapon.range, faction);
          const length = contact?.distance ?? Math.min(weapon.range, VS.Utils.distance(origin, target));
          if (contact?.module) damageTarget(world, contact, damage, weapon);
          world.weaponBeams.push({ origin, end: { x: origin.x + dx * length, y: origin.y + dy * length }, life: 0.16, colour: "#86eeff" });
        } else {
          const candidates = targets(world, faction).filter((t) => !world.safeAt(t.ship) && VS.Utils.distance(origin, t.ship) < weapon.range).sort((a, b) => VS.Utils.distance(a.ship, origin) - VS.Utils.distance(b.ship, origin)).slice(0, 3);
          let start = origin;
          for (const candidate of candidates) {
            const electronic = candidate.ship.modules.filter((n) => ["beam", "plasma", "tesla"].includes(MODULES[n.type].weapon?.kind));
            const armed = candidate.ship.modules.filter((n) => MODULES[n.type].weapon).length;
            const vulnerable = electronic.length / Math.max(1, armed);
            const module = electronic[0] || candidate.ship.modules.find((n) => n.type === "core");
            if (!module) continue;
            damageTarget(world, { ...candidate, module }, damage * (1 + vulnerable * 2), weapon);
            const end = candidate.ship.localToWorld(module.gx * 30, module.gy * 30);
            world.weaponBeams.push({ origin: { ...start }, end, life: 0.22, colour: "#c4b0ff", tesla: true }); start = end;
          }
        }
      } else {
        const possible = targets(world, faction).filter((t) => !world.safeAt(t.ship) && VS.Utils.distance(t.ship, target) < 250).sort((a, b) => VS.Utils.distance(a.ship, target) - VS.Utils.distance(b.ship, target));
        for (let i = 0; i < count; i++) {
          const angle = aim + (i - (count - 1) / 2) * 0.07;
          world.bullets.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed, remaining: weapon.range, damage, faction, weapon, target: possible[0], colour: faction === "enemy" ? "#ff8566" : weapon.kind === "thermal" ? "#ffd093" : def.accent || "#83ebff" });
        }
      }
      if (weapon.recoil) {
        const mass = ship.modules.reduce((sum, n) => sum + MODULES[n.type].density, 0) || 1;
        ship.vx -= dx * weapon.recoil / mass; ship.vy -= dy * weapon.recoil / mass;
        const rx = center.x - ship.x, ry = center.y - ship.y;
        ship.angularVelocity += (rx * -dy - ry * -dx) * weapon.recoil / (mass * 1800);
      }
      cooldowns.set(key(m), weapon.cooldown / power);
    }
  }
  function update(world, dt) {
    for (const bullet of world.bullets) {
      const weapon = bullet.weapon || { kind: "plasma" };
      if (weapon.homing && bullet.target && !bullet.target.enemy?.dead && bullet.target.ship.hp > 0) {
        const current = Math.atan2(bullet.vy, bullet.vx);
        const desired = Math.atan2(bullet.target.ship.y - bullet.y, bullet.target.ship.x - bullet.x);
        const angle = current + VS.Utils.clamp(VS.Utils.angleDelta(current, desired), -weapon.homing * dt, weapon.homing * dt);
        const speed = Math.hypot(bullet.vx, bullet.vy);
        bullet.vx = Math.cos(angle) * speed; bullet.vy = Math.sin(angle) * speed;
      }
      const speed = Math.hypot(bullet.vx, bullet.vy), length = Math.min(bullet.remaining, speed * dt);
      const direction = { x: bullet.vx / speed, y: bullet.vy / speed };
      const contact = hit(world, bullet, direction, length, bullet.faction);
      const distance = contact?.distance ?? length;
      bullet.x += direction.x * distance; bullet.y += direction.y * distance; bullet.remaining -= distance;
      if (contact || bullet.remaining <= 0) { detonate(world, bullet, contact); bullet.remaining = 0; }
    }
    world.bullets = world.bullets.filter((b) => b.remaining > 0);
    for (const ship of [world.game.ship, ...world.enemies.map((e) => e.ship)]) {
      const engineering = ship.engineering;
      if (!engineering) continue;
      for (const event of engineering.events.splice(0)) {
        const point = ship.localToWorld(event.x, event.y);
        if (event.nuclear) detonate(world, { ...point, damage: 300, faction: "player", colour: "#ffb86d", weapon: { kind: "thermal", radius: 160 } });
        else world.explode(point.x, point.y, "#ffab67", 12);
      }
    }
    world.weaponBeams = (world.weaponBeams || []).filter((beam) => { beam.life -= dt; return beam.life > 0; });
  }
  function draw(world, ctx) {
    const { camera, viewport } = world.game;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const beam of world.weaponBeams || []) {
      const start = VS.Utils.worldToScreen(beam.origin, camera, viewport.width, viewport.height);
      ctx.strokeStyle = beam.colour; ctx.globalAlpha = Math.min(1, beam.life * 5); ctx.lineWidth = beam.ring ? 3 : 2;
      ctx.beginPath();
      if (beam.ring) ctx.arc(start.x, start.y, beam.radius * (1 - beam.life / 0.45), 0, Math.PI * 2);
      else {
        const end = VS.Utils.worldToScreen(beam.end, camera, viewport.width, viewport.height);
        ctx.moveTo(start.x, start.y);
        if (beam.tesla) for (let i = 1; i < 10; i++) ctx.lineTo(start.x + (end.x - start.x) * i / 10, start.y + (end.y - start.y) * i / 10 + Math.sin(i * 7 + beam.life * 60) * 9);
        ctx.lineTo(end.x, end.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  VS.WeaponSystem = { fire, update, draw, detonate };
})();
