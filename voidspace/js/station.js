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
      this.parts = [
        { sprite: "station_dock", x: -275, y: 0, width: 300, height: 220 },
        { sprite: "station_command", x: 0, y: 0, width: 105, height: 105 },
        { sprite: "station_service", x: 165, y: 0, width: 135, height: 115 },
        { sprite: "station_rtg", x: 0, y: -185, width: 74, height: 74 },
        { sprite: "station_rtg", x: 0, y: 185, width: 74, height: 74 },
      ];
    }

    isDocked(ship) {
      const halfWidth = this.dockZone.width / 2;
      const halfHeight = this.dockZone.height / 2;
      return ship.x > this.dockZone.x - halfWidth && ship.x < this.dockZone.x + halfWidth && ship.y > -halfHeight && ship.y < halfHeight;
    }

    isSafe(ship) {
      return Math.hypot(ship.x, ship.y) < this.safeRadius;
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

      this.drawStructures(ctx, screenOrigin, images);
      for (const part of this.parts) {
        const pulse = part.sprite === "station_rtg" ? 1 + Math.sin(time * 3 + part.y) * 0.02 : 1;
        Utils.drawImage(ctx, images[part.sprite], screenOrigin.x + part.x, screenOrigin.y + part.y, part.width * pulse, part.height * pulse);
      }

      this.drawLabel(ctx, screenOrigin.x - 275, screenOrigin.y + 3, "ДОК СТАНЦИИ", "SAFE BERTH");
      this.drawLabel(ctx, screenOrigin.x, screenOrigin.y + 3, "КОМАНДНЫЙ", "CONTROL");
      this.drawLabel(ctx, screenOrigin.x + 165, screenOrigin.y + 3, "СЕРВИС", "MODULE BAY");

      const beacon = 0.5 + Math.sin(time * 4) * 0.5;
      ctx.fillStyle = `rgba(92, 232, 255, ${0.35 + beacon * 0.45})`;
      ctx.fillRect(Math.round(screenOrigin.x - 3), Math.round(screenOrigin.y - 230), 6, 6);
      ctx.fillRect(Math.round(screenOrigin.x - 3), Math.round(screenOrigin.y + 224), 6, 6);
    }

    drawStructures(ctx, origin, images) {
      const horizontal = [
        [-89, 0], [-60, 0], [62, 0], [92, 0], [110, 0],
      ];
      const vertical = [
        [0, -137], [0, -108], [0, -78], [0, 78], [0, 108], [0, 137],
      ];
      for (const [x, y] of horizontal) Utils.drawImage(ctx, images.station_beam, origin.x + x, origin.y + y, 34, 28);
      for (const [x, y] of vertical) Utils.drawImage(ctx, images.station_beam, origin.x + x, origin.y + y, 34, 28, Math.PI / 2);
    }

    drawLabel(ctx, x, y, title, subtitle) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#d9f7ff";
      ctx.font = "bold 9px 'Courier New'";
      ctx.fillText(title, Math.round(x), Math.round(y));
      ctx.fillStyle = "#4c8296";
      ctx.font = "6px 'Courier New'";
      ctx.fillText(subtitle, Math.round(x), Math.round(y + 11));
      ctx.restore();
    }
  }

  VS.Station = Station;
})();
