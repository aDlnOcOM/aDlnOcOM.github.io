(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils } = VS;
  const CARGO_PULL_RADIUS = 110;
  const CARGO_COLLECTION_RADIUS = 18;
  const ASTEROID_TEXTURE_SIZE = 256;
  const ASTEROID_CONTENT_SCALE = 0.84;
  const ASTEROID_TEXTURE_CACHE = new WeakMap();

  function isBackdropPixel(pixels, offset) {
    if (pixels[offset + 3] <= 8) return true;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    return Math.min(red, green, blue) >= 205 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 24;
  }

  function prepareAsteroidTexture(image) {
    if (!image) return null;
    const cached = ASTEROID_TEXTURE_CACHE.get(image);
    if (cached) return cached;

    const source = document.createElement("canvas");
    source.width = ASTEROID_TEXTURE_SIZE;
    source.height = ASTEROID_TEXTURE_SIZE;
    const sourceContext = source.getContext("2d");
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = "high";
    sourceContext.drawImage(image, 0, 0, ASTEROID_TEXTURE_SIZE, ASTEROID_TEXTURE_SIZE);
    const imageData = sourceContext.getImageData(0, 0, ASTEROID_TEXTURE_SIZE, ASTEROID_TEXTURE_SIZE);
    const pixels = imageData.data;
    const visited = new Uint8Array(ASTEROID_TEXTURE_SIZE * ASTEROID_TEXTURE_SIZE);
    const queue = new Int32Array(visited.length);
    let queueStart = 0;
    let queueEnd = 0;

    const enqueueBackdrop = (x, y) => {
      const index = y * ASTEROID_TEXTURE_SIZE + x;
      if (visited[index] || !isBackdropPixel(pixels, index * 4)) return;
      visited[index] = 1;
      queue[queueEnd] = index;
      queueEnd += 1;
    };

    for (let position = 0; position < ASTEROID_TEXTURE_SIZE; position += 1) {
      enqueueBackdrop(position, 0);
      enqueueBackdrop(position, ASTEROID_TEXTURE_SIZE - 1);
      enqueueBackdrop(0, position);
      enqueueBackdrop(ASTEROID_TEXTURE_SIZE - 1, position);
    }

    while (queueStart < queueEnd) {
      const index = queue[queueStart];
      queueStart += 1;
      pixels[index * 4 + 3] = 0;
      const x = index % ASTEROID_TEXTURE_SIZE;
      const y = Math.floor(index / ASTEROID_TEXTURE_SIZE);
      if (x > 0) enqueueBackdrop(x - 1, y);
      if (x < ASTEROID_TEXTURE_SIZE - 1) enqueueBackdrop(x + 1, y);
      if (y > 0) enqueueBackdrop(x, y - 1);
      if (y < ASTEROID_TEXTURE_SIZE - 1) enqueueBackdrop(x, y + 1);
    }
    sourceContext.putImageData(imageData, 0, 0);

    let minX = ASTEROID_TEXTURE_SIZE;
    let minY = ASTEROID_TEXTURE_SIZE;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < ASTEROID_TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < ASTEROID_TEXTURE_SIZE; x += 1) {
        if (pixels[(y * ASTEROID_TEXTURE_SIZE + x) * 4 + 3] <= 8) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) {
      ASTEROID_TEXTURE_CACHE.set(image, source);
      return source;
    }

    const output = document.createElement("canvas");
    output.width = ASTEROID_TEXTURE_SIZE;
    output.height = ASTEROID_TEXTURE_SIZE;
    const outputContext = output.getContext("2d");
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";
    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const targetSize = ASTEROID_TEXTURE_SIZE * ASTEROID_CONTENT_SCALE;
    const scale = Math.min(targetSize / cropWidth, targetSize / cropHeight);
    const drawWidth = cropWidth * scale;
    const drawHeight = cropHeight * scale;
    outputContext.drawImage(
      source,
      minX,
      minY,
      cropWidth,
      cropHeight,
      (ASTEROID_TEXTURE_SIZE - drawWidth) / 2,
      (ASTEROID_TEXTURE_SIZE - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    ASTEROID_TEXTURE_CACHE.set(image, output);
    return output;
  }

  const METEOR_TYPES = {
    iron: {
      name: "Железо-никелевый",
      scan: "Fe–Ni · Кобальт",
      hp: 145,
      sprite: "meteor_iron",
      yields: [{ ore: "feNi", weight: 8 }, { ore: "cobalt", weight: 2 }],
    },
    chondrite: {
      name: "Обычный хондрит",
      scan: "Силикаты · Оливин · Fe",
      hp: 92,
      sprite: "meteor_chondrite",
      yields: [{ ore: "silicates", weight: 6 }, { ore: "olivine", weight: 2 }, { ore: "feNi", weight: 2 }],
    },
    troilite: {
      name: "Троилитовый",
      scan: "Сера · FeS",
      hp: 112,
      sprite: "meteor_troilite",
      yields: [{ ore: "sulfur", weight: 6 }, { ore: "feNi", weight: 4 }],
    },
    carbonaceous: {
      name: "Углеродистый CI/CM",
      scan: "Углерод · Лёд · Органика",
      hp: 65,
      sprite: "meteor_carbon",
      yields: [{ ore: "carbon", weight: 5 }, { ore: "ice", weight: 4 }, { ore: "organics", weight: 1 }],
    },
    pallasite: {
      name: "Редкий палласит",
      scan: "Платиновая группа · Редкоземы",
      hp: 205,
      sprite: "meteor_pallasite",
      yields: [{ ore: "platinum", weight: 3 }, { ore: "rareEarths", weight: 4 }, { ore: "olivine", weight: 3 }],
    },
  };

  class Particle {
    constructor(x, y, vx, vy, life, kind = "spark", size = 7) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.life = life;
      this.maxLife = life;
      this.kind = kind;
      this.size = size;
      this.rotation = Math.random() * Math.PI * 2;
    }

    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.15, dt);
      this.vy *= Math.pow(0.15, dt);
      this.rotation += dt * 4;
    }

    draw(ctx, camera, viewport, images) {
      const screen = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      const alpha = Utils.clamp(this.life / this.maxLife, 0, 1);
      const progress = 1 - alpha;
      const size = this.size * (this.kind === "debris" ? 1 + progress * 0.2 : 1.5 + progress * 1.8);
      if (VS.Visuals?.effect(ctx, images, this.kind === "debris" ? "debris" : "spark", screen.x, screen.y, size, alpha * alpha, this.rotation)) return;
      const image = images[this.kind === "debris" ? "particle_debris" : "particle_spark"];
      Utils.drawImage(ctx, image, screen.x, screen.y, this.size, this.size, this.rotation, alpha);
    }
  }

  class OrePickup {
    constructor(x, y, ore, amount = 1) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.randomRange(18, 62);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.ore = ore;
      this.amount = amount;
      this.rotation = Math.random() * Math.PI * 2;
      this.dead = false;
      this.age = 0;
    }

    update(dt, ship) {
      this.age += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.28, dt);
      this.vy *= Math.pow(0.28, dt);
      this.rotation += dt * 1.8;
      const intake = ship.getNearestCargoIntake(this.x, this.y);
      if (!intake) return;
      const distance = intake.distance;
      if (distance < CARGO_PULL_RADIUS && ship.inventory.used < ship.stats.cargo) {
        const proximity = 1 - distance / CARGO_PULL_RADIUS;
        const pull = proximity * 720;
        this.vx += ((intake.x - this.x) / Math.max(1, distance)) * pull * dt;
        this.vy += ((intake.y - this.y) / Math.max(1, distance)) * pull * dt;
        const velocityMatch = proximity * 2.4 * dt;
        this.vx += (intake.vx - this.vx) * velocityMatch;
        this.vy += (intake.vy - this.vy) * velocityMatch;
      }
      if (distance < CARGO_COLLECTION_RADIUS) {
        const accepted = ship.inventory.add(this.ore, this.amount, ship.stats.cargo);
        if (accepted > 0) this.dead = true;
      }
      if (this.age > 70) this.dead = true;
    }

    draw(ctx, camera, viewport, images) {
      const screen = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      const image = images[`ore_${this.ore}`];
      Utils.drawImage(ctx, image, screen.x, screen.y, 14, 14, this.rotation);
    }
  }

  class Asteroid {
    constructor(x, y, type, size = 1) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.size = size;
      this.radius = Math.round(21 + size * 15);
      this.rotation = Math.random() * Math.PI * 2;
      this.spin = Utils.randomRange(-0.16, 0.16);
      this.vx = Utils.randomRange(-6, 6);
      this.vy = Utils.randomRange(-6, 6);
      this.maxHp = Math.round(METEOR_TYPES[type].hp * (0.65 + size * 0.65));
      this.hp = this.maxHp;
      this.dead = false;
      this.hitFlash = 0;
      this.ramCooldown = 0;
    }

    update(dt, station) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.spin * dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
      this.ramCooldown = Math.max(0, this.ramCooldown - dt);
      const distanceFromStation = Math.hypot(this.x, this.y);
      if (distanceFromStation < station.safeRadius + this.radius) {
        const angle = Math.atan2(this.y, this.x);
        this.vx += Math.cos(angle) * 18 * dt;
        this.vy += Math.sin(angle) * 18 * dt;
      }
    }

    damage(amount, hitX, hitY, game) {
      if (this.dead || amount <= 0) return;
      this.hp -= amount;
      this.hitFlash = 1;
      for (let index = 0; index < 2; index += 1) {
        game.particles.push(new Particle(hitX, hitY, Utils.randomRange(-45, 45), Utils.randomRange(-45, 45), 0.25, "spark", 6));
      }
      if (this.hp <= 0) this.breakApart(game);
    }

    breakApart(game) {
      if (this.dead) return;
      this.dead = true;
      const definition = METEOR_TYPES[this.type];
      const count = Math.round(2 + this.size * 4);
      for (let index = 0; index < count; index += 1) {
        const ore = Utils.weightedChoice(definition.yields.map((entry) => ({ value: entry.ore, weight: entry.weight })));
        game.pickups.push(new OrePickup(this.x + Utils.randomRange(-10, 10), this.y + Utils.randomRange(-10, 10), ore));
        game.particles.push(new Particle(this.x, this.y, Utils.randomRange(-95, 95), Utils.randomRange(-95, 95), Utils.randomRange(0.4, 0.8), "debris", Utils.randomRange(8, 15)));
      }
      game.asteroidsMined += 1;
      game.notify(`${definition.name}: руда высвобождена`);
    }

    draw(ctx, camera, viewport, images) {
      const screen = Utils.worldToScreen(this, camera, viewport.width, viewport.height);
      const image = prepareAsteroidTexture(images[METEOR_TYPES[this.type].sprite]);
      Utils.drawImage(ctx, image, screen.x, screen.y, this.radius * 2, this.radius * 2, this.rotation);
      if (this.hitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = this.hitFlash * 0.35;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, this.radius * ASTEROID_CONTENT_SCALE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  VS.Entities = { METEOR_TYPES, Particle, OrePickup, Asteroid };
})();
