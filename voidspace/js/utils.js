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
      return { x: Math.round(point.x - camera.x + width / 2), y: Math.round(point.y - camera.y + height / 2) };
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

    prepareAtlas(image) {
      if (!image) return null;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        const visited = new Uint8Array(canvas.width * canvas.height);
        const queue = new Int32Array(canvas.width * canvas.height);
        let head = 0;
        let tail = 0;

        const isBackdrop = (index) => {
          const offset = index * 4;
          const red = data[offset];
          const green = data[offset + 1];
          const blue = data[offset + 2];
          const low = Math.min(red, green, blue);
          const high = Math.max(red, green, blue);
          return low > 205 && high - low < 18;
        };

        const enqueue = (index) => {
          if (visited[index] || !isBackdrop(index)) return;
          visited[index] = 1;
          queue[tail] = index;
          tail += 1;
        };

        for (let x = 0; x < canvas.width; x += 1) {
          enqueue(x);
          enqueue((canvas.height - 1) * canvas.width + x);
        }
        for (let y = 0; y < canvas.height; y += 1) {
          enqueue(y * canvas.width);
          enqueue(y * canvas.width + canvas.width - 1);
        }

        while (head < tail) {
          const index = queue[head];
          head += 1;
          const x = index % canvas.width;
          const y = Math.floor(index / canvas.width);
          data[index * 4 + 3] = 0;
          if (x > 0) enqueue(index - 1);
          if (x + 1 < canvas.width) enqueue(index + 1);
          if (y > 0) enqueue(index - canvas.width);
          if (y + 1 < canvas.height) enqueue(index + canvas.width);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
      } catch (_error) {
        return null;
      }

      return canvas;
    },

    extractAtlasSprite(atlas, columns, rows, column, row, width, height, padding = 2) {
      if (!atlas) return null;
      const sourceX = Math.floor((column * atlas.width) / columns);
      const sourceY = Math.floor((row * atlas.height) / rows);
      const sourceRight = Math.floor(((column + 1) * atlas.width) / columns);
      const sourceBottom = Math.floor(((row + 1) * atlas.height) / rows);
      const cellWidth = sourceRight - sourceX;
      const cellHeight = sourceBottom - sourceY;
      const ctx = atlas.getContext("2d", { willReadFrequently: true });
      const data = ctx.getImageData(sourceX, sourceY, cellWidth, cellHeight).data;
      let left = cellWidth;
      let top = cellHeight;
      let right = -1;
      let bottom = -1;

      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < cellWidth; x += 1) {
          if (data[(y * cellWidth + x) * 4 + 3] === 0) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) return null;

      const cropWidth = right - left + 1;
      const cropHeight = bottom - top + 1;
      const output = document.createElement("canvas");
      output.width = width;
      output.height = height;
      const outputCtx = output.getContext("2d");
      outputCtx.imageSmoothingEnabled = false;
      const scale = Math.min((width - padding * 2) / cropWidth, (height - padding * 2) / cropHeight);
      const drawWidth = Math.max(1, Math.floor(cropWidth * scale));
      const drawHeight = Math.max(1, Math.floor(cropHeight * scale));
      const drawX = Math.floor((width - drawWidth) / 2);
      const drawY = Math.floor((height - drawHeight) / 2);
      outputCtx.drawImage(atlas, sourceX + left, sourceY + top, cropWidth, cropHeight, drawX, drawY, drawWidth, drawHeight);
      return output;
    },

    drawImage(ctx, image, x, y, width, height, rotation = 0, alpha = 1) {
      if (!image) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(rotation);
      ctx.drawImage(image, Math.round(-width / 2), Math.round(-height / 2), Math.round(width), Math.round(height));
      ctx.restore();
    },
  };

  VS.Utils = Utils;
})();
