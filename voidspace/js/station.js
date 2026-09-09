(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils } = VS;

  class Station {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.safeRadius = 440;
      this.dockZone = { x: -275, y: 0, width: 300, height: 220 };
    }

    isDocked(ship) {
      const halfWidth = this.dockZone.width / 2;
      const halfHeight = this.dockZone.height / 2;
      return ship.x - this.x > this.dockZone.x - halfWidth && ship.x - this.x < this.dockZone.x + halfWidth && ship.y - this.y > -halfHeight && ship.y - this.y < halfHeight;
    }

    isSafe(ship) {
      return Math.hypot(ship.x - this.x, ship.y - this.y) < this.safeRadius;
    }

    draw(ctx, camera, viewport, images, time) {
      const screenOrigin = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      ctx.save();
      ctx.strokeStyle = "rgba(52, 180, 211, 0.18)";
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(screenOrigin.x, screenOrigin.y, this.safeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(screenOrigin.x, screenOrigin.y);
      this.drawStructures(ctx);
      this.drawDock(ctx, images, time);
      this.drawHub(ctx, images, 0, 0, "core");
      this.drawHub(ctx, images, 165, 0, "cargo");
      for (const y of [-185, 185]) {
        this.drawModule(ctx, images, "rtg", 0, y, 74);
        // Steady geometry: only status lights pulse, never the connecting hull.
        ctx.fillStyle = `rgba(115, 230, 255, ${0.65 + Math.sin(time * 2) * 0.2})`;
        ctx.fillRect(-17, y + Math.sign(y) * 42, 34, 2);
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
      for (const connector of this.getConnectors()) {
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

    drawHub(ctx, images, x, y, type) {
      ctx.save();
      ctx.translate(x, y);
      // The same armour cells and framed components as the player's ship.
      ctx.fillStyle = "#111d2e";
      ctx.fillRect(-55, -55, 110, 110);
      for (const dx of [-40, -20, 0, 20, 40]) {
        this.drawModule(ctx, images, "hull", dx, -45, 20);
        this.drawModule(ctx, images, "hull", dx, 45, 20);
      }
      for (const dy of [-25, 0, 25]) {
        this.drawModule(ctx, images, "hull", -45, dy, 20);
        this.drawModule(ctx, images, "hull", 45, dy, 20);
      }
      if (type === "core") this.drawCommandCapsule(ctx, images);
      else this.drawModule(ctx, images, type, 0, 0, 70);
      ctx.fillStyle = "#72dceb";
      for (const dx of [-1, 1]) {
        for (const dy of [-1, 1]) ctx.fillRect(dx * 44 - 5, dy * 44 - 1, 10, 2);
      }
      ctx.restore();
    }

    drawDock(ctx, images, time) {
      ctx.fillStyle = "rgba(12, 27, 40, 0.5)";
      ctx.fillRect(-425, -110, 300, 220);
      // Three-sided gantry leaves the entire western approach open.
      for (let x = -425; x <= -125; x += 30) {
        this.drawModule(ctx, images, "hull", x, -125);
        this.drawModule(ctx, images, "hull", x, 125);
      }
      for (let y = -95; y <= 115; y += 30) {
        this.drawModule(ctx, images, "hull", -125, y);
      }
      for (const y of [-125, 125]) {
        this.drawModule(ctx, images, "cargo", -425, y);
        this.drawModule(ctx, images, "cargo", -125, y);
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
