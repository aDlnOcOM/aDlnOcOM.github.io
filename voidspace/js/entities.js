(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils } = VS;

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
      const image = images[this.kind === "exhaust" ? "particle_exhaust" : this.kind === "debris" ? "particle_debris" : "particle_spark"];
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
      const distance = Utils.distance(this, ship);
      if (distance < 95 && ship.inventory.used < ship.stats.cargo) {
        const pull = (1 - distance / 95) * 680;
        this.vx += ((ship.x - this.x) / Math.max(1, distance)) * pull * dt;
        this.vy += ((ship.y - this.y) / Math.max(1, distance)) * pull * dt;
      }
      if (distance < 25) {
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
    }

    update(dt, station) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.spin * dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
      const distanceFromStation = Math.hypot(this.x, this.y);
      if (distanceFromStation < station.safeRadius + this.radius) {
        const angle = Math.atan2(this.y, this.x);
        this.vx += Math.cos(angle) * 18 * dt;
        this.vy += Math.sin(angle) * 18 * dt;
      }
    }

    damage(amount, hitX, hitY, game) {
      this.hp -= amount;
      this.hitFlash = 1;
      for (let index = 0; index < 2; index += 1) {
        game.particles.push(new Particle(hitX, hitY, Utils.randomRange(-45, 45), Utils.randomRange(-45, 45), 0.25, "spark", 6));
      }
      if (this.hp <= 0) this.breakApart(game);
    }

    breakApart(game) {
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
      const image = images[METEOR_TYPES[this.type].sprite];
      Utils.drawImage(ctx, image, screen.x, screen.y, this.radius * 2, this.radius * 2, this.rotation);
      if (this.hitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = this.hitFlash * 0.35;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(Math.round(screen.x - this.radius), Math.round(screen.y - this.radius), this.radius * 2, this.radius * 2);
        ctx.restore();
      }
    }
  }

  VS.Entities = { METEOR_TYPES, Particle, OrePickup, Asteroid };
})();
