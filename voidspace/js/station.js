(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils } = VS;

  class Station {
    constructor(save = {}) {
      this.x = 0;
      this.y = 0;
      this.angle = 0;
      this.id = "home";
      this.safeRadius = 440;
      this.dockZone = { x: -275, y: 0, width: 300, height: 220 };
      this.modules = [];
      const add = (id, type, x, y, width, height = width, role = "hull") => {
        const maxHp = role === "command" ? 600 : type === "beam" ? 150 : type === "rtg" ? 260 : type === "cargo" ? 280 : 100;
        this.modules.push({ id, type, gx: x / 30, gy: y / 30, hitWidth: width, hitHeight: height, rotation: 0, role, maxHp, integrity: maxHp });
      };
      for (const [index, connector] of this.getConnectors().entries()) {
        add(`connector-${index}`, "beam", connector.x, connector.y, connector.rotation ? 22 : connector.length, connector.rotation ? connector.length : 22, "connector");
      }
      for (const [x, type, id] of [[0, "core", "command"], [165, "cargo", "service"]]) {
        add(id, type, x, 0, 70, 70, id);
        for (const dx of [-40, -20, 0, 20, 40]) for (const dy of [-45, 45]) add(`${id}:${dx}:${dy}`, "hull", x + dx, dy, 20);
        for (const dx of [-45, 45]) for (const dy of [-25, 0, 25]) add(`${id}:${dx}:${dy}`, "hull", x + dx, dy, 20);
      }
      for (const y of [-185, 185]) add(`rtg:${y}`, "rtg", 0, y, 74);
      for (let x = -425; x <= -125; x += 30) for (const y of [-125, 125]) add(`dock:${x}:${y}`, x === -425 || x === -125 ? "cargo" : "hull", x, y, 30, 30, "dock");
      for (let y = -95; y <= 115; y += 30) add(`dock:-125:${y}`, "hull", -125, y, 30, 30, "dock");
      this.template = this.modules.map((m) => ({ ...m }));
      this.restore(save);
    }

    restore(save = {}) {
      const health = save?.health;
      this.modules = this.template.map((m) => ({ ...m, integrity: Number.isFinite(health?.[m.id]) ? Utils.clamp(health[m.id], 0, m.maxHp) : m.maxHp })).filter((m) => m.integrity > 0);
      const connected = VS.ModuleSystem.connectedToCore(this.modules);
      this.modules = this.modules.filter((m) => connected.has(m));
    }

    localToWorld(x, y) { return { x: this.x + x, y: this.y + y }; }
    worldToLocal(x, y) { return { x: x - this.x, y: y - this.y }; }
    has(id) { return this.modules.some((m) => m.id === id); }
    get dead() { return !this.has("command"); }
    get hp() { return this.modules.reduce((sum, m) => sum + m.integrity, 0); }
    get powered() { return !this.dead && this.modules.some((m) => m.type === "rtg"); }
    get dockOnline() { return this.powered && this.has("service") && this.has("connector-0") && this.modules.some((m) => m.role === "dock"); }

    damage(module, amount, world, kind = "kinetic", penetration = 0) {
      if (!this.modules.includes(module) || !Number.isFinite(amount) || amount <= 0) return;
      const def = VS.ModuleSystem.MODULES[module.type];
      const strength = (def.strength || 0) * (1 - Utils.clamp(penetration, 0, 1)) * (kind === "energy" ? 0.35 : 1);
      module.integrity = Math.max(0, module.integrity - amount * 100 / (100 + strength * (def.density || 1)));
      if (module.integrity > 0) return;
      const previous = this.modules;
      const remaining = previous.filter((m) => m !== module);
      const connected = VS.ModuleSystem.connectedToCore(remaining);
      this.modules = remaining.filter((m) => connected.has(m));
      for (const part of previous) if (!connected.has(part)) world?.spawnModuleDebris?.(this, part);
      const point = this.localToWorld(module.gx * 30, module.gy * 30);
      world?.explode(point.x, point.y, "#ffa478", 12);
      world?.game.notify(this.dead ? "Командный узел станции уничтожен" : "Секция станции разрушена");
    }

    serialize() {
      return { health: Object.fromEntries(this.template.map((m) => [m.id, this.modules.find((part) => part.id === m.id)?.integrity || 0])) };
    }

    isDocked(ship) {
      if (!this.dockOnline) return false;
      const halfWidth = this.dockZone.width / 2;
      const halfHeight = this.dockZone.height / 2;
      return ship.x - this.x > this.dockZone.x - halfWidth && ship.x - this.x < this.dockZone.x + halfWidth && ship.y - this.y > -halfHeight && ship.y - this.y < halfHeight;
    }

    isSafe(ship) {
      return this.powered && Math.hypot(ship.x - this.x, ship.y - this.y) < this.safeRadius;
    }

    draw(ctx, camera, viewport, images, time) {
      if (this.dead) return;
      const screenOrigin = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      ctx.save();
      ctx.strokeStyle = this.powered ? "rgba(52, 180, 211, 0.18)" : "rgba(0,0,0,0)";
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(screenOrigin.x, screenOrigin.y, this.safeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(screenOrigin.x, screenOrigin.y);
      this.drawStructures(ctx);
      if (this.dockOnline) this.drawDock(ctx, images, time);
      for (const module of this.modules) {
        if (module.role === "connector") continue;
        const x = module.gx * 30, y = module.gy * 30;
        if (module.role === "command") { ctx.save(); ctx.translate(x, y); this.drawCommandCapsule(ctx, images); ctx.restore(); }
        else this.drawModule(ctx, images, module.type, x, y, module.hitWidth);
        if (module.integrity < module.maxHp) {
          ctx.fillStyle = `rgba(15,5,2,${0.2 + (1 - module.integrity / module.maxHp) * 0.5})`;
          ctx.fillRect(x - module.hitWidth / 2, y - module.hitHeight / 2, module.hitWidth, module.hitHeight);
          ctx.strokeStyle = "#c5845a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x + 2, y); ctx.lineTo(x - 3, y + 7); ctx.stroke();
        }
      }
      ctx.restore();
    }

    getConnectors() {
      // Endpoints meet the outside faces, not the centres of attached modules.
      return [
        { x: -82.5, y: 0, length: 55, rotation: 0 }, // Dock -110 → command -55.
        { x: 82.5, y: 0, length: 55, rotation: 0 },
        { x: 0, y: -101.5, length: 93, rotation: Math.PI / 2 },
        { x: 0, y: 101.5, length: 93, rotation: Math.PI / 2 },
      ];
    }

    drawStructures(ctx) {
      for (const [index, connector] of this.getConnectors().entries()) {
        if (!this.has(`connector-${index}`)) continue;
        ctx.save();
        ctx.translate(connector.x, connector.y);
        ctx.rotate(connector.rotation);
        const left = -connector.length / 2;
        ctx.fillStyle = "#09121e";
        ctx.fillRect(left, -10, connector.length, 20);
        // Resolution-independent rails and repeated braces replace stretched pixels.
        const bays = Math.ceil(connector.length / 18);
        const step = connector.length / bays;
        ctx.strokeStyle = "#566a80";
        ctx.lineWidth = 2;
        for (let i = 0; i < bays; i++) {
          const x = left + i * step;
          ctx.beginPath();
          ctx.moveTo(x, -7);
          ctx.lineTo(x + step, 7);
          ctx.moveTo(x, 7);
          ctx.lineTo(x + step, -7);
          ctx.stroke();
        }
        for (const y of [-11, 7]) {
          ctx.fillStyle = "#23364c";
          ctx.fillRect(left, y, connector.length, 4);
          ctx.fillStyle = "#8495a4";
          ctx.fillRect(left, y, connector.length, 1);
        }
        ctx.fillStyle = "#205069";
        ctx.fillRect(left, -1, connector.length, 2);
        for (const x of [left, -left - 4]) {
          ctx.fillStyle = "#52677b";
          ctx.fillRect(x, -11, 4, 22);
          ctx.fillStyle = "#6bd0e4";
          ctx.fillRect(x + 1, -3, 2, 6);
        }
        ctx.restore();
      }
    }

    drawModule(ctx, images, type, x, y, size = 30) {
      const definition = VS.ModuleSystem.MODULES[type];
      const image = images[`module_${type}`];
      Utils.drawImage(ctx, images.module_frame, x, y, size, size);
      if (!image) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((definition.spriteRotation || 0) * Math.PI / 2);
      const crop = definition.spriteCrop;
      if (crop) {
        ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, -size / 2, -size / 2, size, size);
      } else {
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }

    drawDock(ctx, images, time) {
      ctx.fillStyle = "rgba(12, 27, 40, 0.5)";
      ctx.fillRect(-425, -110, 300, 220);
      for (const y of [-125, 125]) {
        ctx.fillStyle = "#387b93";
        ctx.fillRect(-408, y > 0 ? 108 : -110, 264, 2);
      }
      ctx.strokeStyle = "rgba(104, 180, 208, 0.23)";
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 8]);
      for (const y of [-74, 74]) {
        ctx.beginPath();
        ctx.moveTo(-420, y);
        ctx.lineTo(-165, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const alpha = 0.25 + 0.55 * Math.pow((Math.sin(time * 2.5 - i * 0.7) + 1) / 2, 3);
        ctx.fillStyle = `rgba(112, 222, 250, ${alpha})`;
        for (const y of [-99, 97]) ctx.fillRect(-411 + i * 34, y, 12, 2);
      }
      ctx.strokeStyle = "#418caa";
      for (const x of [-395, -360, -325]) {
        ctx.beginPath();
        ctx.moveTo(x - 5, 32);
        ctx.lineTo(x + 2, 39);
        ctx.lineTo(x - 5, 46);
        ctx.stroke();
      }
    }

    drawCommandCapsule(ctx, images) {
      // Use the detailed 256px armour, not an enlarged 41×37 cockpit crop.
      this.drawModule(ctx, images, "cargo", 0, 0, 70);
      for (const [radius, colour] of [[26, "#080f19"], [24, "#7e90a0"], [22, "#253d54"], [19, "#101e31"], [16, "#468299"]]) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i + 0.5) * Math.PI / 4;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();
      }
      const glass = ctx.createRadialGradient(-4, -5, 1, 0, 0, 14);
      glass.addColorStop(0, "#d0faff");
      glass.addColorStop(0.35, "#61dcee");
      glass.addColorStop(1, "#096089");
      ctx.fillStyle = glass;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#91dae5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
      ctx.moveTo(0, -12); ctx.lineTo(0, 12);
      ctx.stroke();
      for (const x of [-29, 27]) {
        ctx.fillStyle = "#7bdfee";
        ctx.fillRect(x, -6, 2, 12);
      }
    }
  }

  VS.Station = Station;
})();
