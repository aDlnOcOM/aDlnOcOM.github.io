(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const Utils = {
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    lerp(start, end, amount) {
      return start + (end - start) * amount;
    },

    distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    },

    randomRange(min, max) {
      return min + Math.random() * (max - min);
    },

    weightedChoice(items) {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * total;
      for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item.value;
      }
      return items[items.length - 1].value;
    },

    angleDelta(from, to) {
      let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
      if (delta < -Math.PI) delta += Math.PI * 2;
      return delta;
    },

    pointSegmentDistance(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared === 0) return Utils.distance(point, start);
      const t = Utils.clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
      return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
    },

    worldToScreen(point, camera, width, height) {
      return { x: point.x - camera.x + width / 2, y: point.y - camera.y + height / 2 };
    },

    screenToWorld(point, camera, width, height) {
      return { x: point.x + camera.x - width / 2, y: point.y + camera.y - height / 2 };
    },

    formatNumber(value) {
      return Math.floor(value).toLocaleString("ru-RU");
    },

    hashNoise(x, y) {
      const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return value - Math.floor(value);
    },

    loadImages(manifest) {
      const entries = Object.entries(manifest);
      return Promise.all(
        entries.map(
          ([key, source]) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () => resolve([key, image]);
              image.onerror = () => resolve([key, null]);
              image.src = source;
            }),
        ),
      ).then((loaded) => Object.fromEntries(loaded));
    },

    drawImage(ctx, image, x, y, width, height, rotation = 0, alpha = 1) {
      if (!image) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    },
  };

  VS.Utils = Utils;
})();
