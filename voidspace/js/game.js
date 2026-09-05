(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils, ModuleSystem, Entities, ORES } = VS;
  const { MODULES, MODULE_SIZE, getPlacementConflict, isAdjacentToShip } = ModuleSystem;
  const { METEOR_TYPES, Asteroid } = Entities;

  function moduleArtMarkup(definition) {
    const rotation = (definition.spriteRotation || 0) * 90;
    const crop = definition.spriteCrop;
    if (!crop) {
      return `<span class="module-art" style="transform: rotate(${rotation}deg)"><img src="${definition.sprite}" alt=""></span>`;
    }

    const sourceWidth = definition.spriteSourceWidth || 64;
    const sourceHeight = definition.spriteSourceHeight || 64;
    const imageStyle = [
      `left: ${(-crop.x / crop.width) * 100}%`,
      `top: ${(-crop.y / crop.height) * 100}%`,
      `width: ${(sourceWidth / crop.width) * 100}%`,
      `height: ${(sourceHeight / crop.height) * 100}%`,
    ].join("; ");
    return `<span class="module-art" style="transform: rotate(${rotation}deg)"><img src="${definition.sprite}" alt="" style="${imageStyle}"></span>`;
  }

  class Game {
    constructor(canvas, images, save = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.images = images;
      this.viewport = { width: canvas.width, height: canvas.height };
      this.renderScale = { x: 1, y: 1 };
      this.resizeCanvas();
      this.station = new VS.Station();
      this.ship = new VS.Ship(save.ship || {});
      this.camera = { x: this.ship.x, y: this.ship.y };
      this.input = new Set();
      this.mouse = { x: this.viewport.width * 0.7, y: this.viewport.height * 0.5, down: false };
      this.asteroids = [];
      this.pickups = [];
      this.particles = [];
      this.started = false;
      this.paused = false;
      this.buildMode = false;
      this.buildSelected = "hull";
      this.buildRotation = 0;
      this.deleteMode = false;
      this.buildHover = null;
      this.laserBeam = null;
      this.target = null;
      this.time = Number(save.time) || 0;
      this.asteroidsMined = Number(save.asteroidsMined) || 0;
      this.totalSold = Number(save.totalSold) || 0;
      this.record = Math.max(Number(save.record) || 0, this.totalSold);
      this.lastFrame = performance.now();
      this.saveTimer = 0;
      this.toastTimer = null;
      this.activeDockTab = "sell";
      this.dom = this.captureDom();
      this.bindEvents();
      this.seedAsteroids();
      this.renderBuildPalette();
      this.updateHud();
      requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    captureDom() {
      const ids = [
        "hp-fill", "hp-value", "cargo-fill", "cargo-value", "credits", "distance", "target-card",
        "target-name", "target-fill", "target-yield", "dock-prompt", "toast", "mission", "mission-title",
        "mission-copy", "dock-panel", "dock-content", "inventory-panel", "inventory-content", "build-panel",
        "build-modules", "build-hint", "pause-panel", "death-panel", "start-screen",
      ];
      return Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
    }

    resizeCanvas() {
      const bounds = this.canvas.getBoundingClientRect();
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      this.renderScale.x = width / this.viewport.width;
      this.renderScale.y = height / this.viewport.height;
      this.configureRenderer();
    }

    configureRenderer() {
      this.ctx.setTransform(this.renderScale.x, 0, 0, this.renderScale.y, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
    }

    bindEvents() {
      window.addEventListener("keydown", (event) => this.onKeyDown(event));
      window.addEventListener("keyup", (event) => this.input.delete(event.code));
      window.addEventListener("blur", () => {
        this.input.clear();
        this.mouse.down = false;
      });
      window.addEventListener("resize", () => this.resizeCanvas());
      this.canvas.addEventListener("pointermove", (event) => this.updatePointer(event));
      this.canvas.addEventListener("pointerdown", (event) => {
        this.updatePointer(event);
        if (event.button === 0) this.mouse.down = true;
        if (this.buildMode) this.handleBuildClick(event.button === 2);
      });
      window.addEventListener("pointerup", (event) => {
        if (event.button === 0) this.mouse.down = false;
      });
      this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

      document.getElementById("start-button").addEventListener("click", () => {
        this.started = true;
        this.dom["start-screen"].classList.add("hidden");
        this.notify("Протокол добычи активирован");
      });
      document.getElementById("resume-button").addEventListener("click", () => this.togglePause(false));
      document.getElementById("respawn-button").addEventListener("click", () => this.respawn());
      document.getElementById("reset-button").addEventListener("click", () => {
        if (window.confirm("Сбросить кредиты, корабль и рекорд экспедиции?")) {
          localStorage.removeItem("voidspace-save-v1");
          window.location.reload();
        }
      });
      document.getElementById("exit-build").addEventListener("click", () => this.toggleBuild(false));
      document.getElementById("rotate-module").addEventListener("click", () => this.rotateBuildModule());
      document.getElementById("delete-module").addEventListener("click", () => this.toggleDeleteMode());
      document.getElementById("mission-toggle").addEventListener("click", () => this.dom.mission.classList.toggle("collapsed"));

      document.querySelectorAll(".close-panel").forEach((button) => {
        button.addEventListener("click", () => this.closePanel(button.dataset.close));
      });
      document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => {
          document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
          button.classList.add("active");
          this.activeDockTab = button.dataset.tab;
          this.renderDockContent();
        });
      });
    }

    updatePointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * this.viewport.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * this.viewport.height;
      if (this.buildMode) this.updateBuildHover();
    }

    onKeyDown(event) {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.repeat && ["KeyB", "KeyI", "KeyE", "KeyF", "Escape", "KeyR", "KeyX"].includes(event.code)) return;
      this.input.add(event.code);

      if (!this.started || event.code === "Space") return;
      if (event.code === "Escape") {
        if (this.buildMode) this.toggleBuild(false);
        else if (!this.dom["dock-panel"].classList.contains("hidden")) this.closePanel("dock-panel");
        else if (!this.dom["inventory-panel"].classList.contains("hidden")) this.closePanel("inventory-panel");
        else this.togglePause(!this.paused);
      }
      if (event.code === "KeyB" && !this.paused) this.toggleBuild(!this.buildMode);
      if (event.code === "KeyI" && !this.buildMode) this.toggleInventory();
      if ((event.code === "KeyE" || event.code === "KeyF") && this.station.isDocked(this.ship) && !this.buildMode) this.openDock();
      if (event.code === "KeyR" && this.buildMode) this.rotateBuildModule();
      if (event.code === "KeyX" && this.buildMode) this.toggleDeleteMode();
    }

    loop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
      this.lastFrame = timestamp;
      if (this.started && !this.paused && !this.buildMode && this.ship.hp > 0) this.update(dt);
      this.render(timestamp / 1000);
      requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
    }

    update(dt) {
      this.time += dt;
      const mouseWorld = Utils.screenToWorld(this.mouse, this.camera, this.viewport.width, this.viewport.height);
      this.ship.update(dt, this.input, mouseWorld, this);
      this.stationSafety(dt);

      this.target = null;
      this.laserBeam = null;
      if (this.mouse.down || this.input.has("Space")) this.fireMiningLaser(dt, mouseWorld);

      for (const asteroid of this.asteroids) {
        asteroid.update(dt, this.station);
        this.checkShipCollision(asteroid);
      }
      for (const pickup of this.pickups) pickup.update(dt, this.ship);
      for (const particle of this.particles) particle.update(dt);
      this.asteroids = this.asteroids.filter((asteroid) => !asteroid.dead && Utils.distance(asteroid, this.ship) < 1900);
      this.pickups = this.pickups.filter((pickup) => !pickup.dead && Utils.distance(pickup, this.ship) < 1700);
      this.particles = this.particles.filter((particle) => particle.life > 0);
      this.maintainAsteroids();

      const cameraAmount = 1 - Math.pow(0.002, dt);
      this.camera.x = Utils.lerp(this.camera.x, this.ship.x + this.ship.vx * 0.22, cameraAmount);
      this.camera.y = Utils.lerp(this.camera.y, this.ship.y + this.ship.vy * 0.22, cameraAmount);

      this.saveTimer += dt;
      if (this.saveTimer > 4) {
        this.saveTimer = 0;
        this.save();
      }
      this.updateMission();
      this.updateHud();
      if (this.ship.hp <= 0) this.onDeath();
    }

    stationSafety(dt) {
      if (!this.station.isSafe(this.ship)) return;
      if (this.ship.hp < this.ship.stats.maxHp) this.ship.hp = Math.min(this.ship.stats.maxHp, this.ship.hp + dt * 1.5);
    }

    fireMiningLaser(dt, mouseWorld) {
      if (!this.ship.modules.some((module) => module.type === "laser") || this.ship.stats.energyUse > this.ship.stats.energy) return;
      const mount = this.ship.getLaserMount(this.time);
      const { origin, angle: aimAngle } = mount;
      const maxDistance = MODULES.laser.range;
      const requestedDistance = Math.min(maxDistance, Math.hypot(mouseWorld.x - origin.x, mouseWorld.y - origin.y));
      const direction = { x: Math.cos(aimAngle), y: Math.sin(aimAngle) };
      const endpoint = {
        x: origin.x + direction.x * requestedDistance,
        y: origin.y + direction.y * requestedDistance,
      };
      let target = null;
      let nearest = requestedDistance;
      for (const asteroid of this.asteroids) {
        const offsetX = asteroid.x - origin.x;
        const offsetY = asteroid.y - origin.y;
        const projection = offsetX * direction.x + offsetY * direction.y;
        if (projection < 0 || projection - asteroid.radius > nearest) continue;
        const perpendicularSquared = offsetX * offsetX + offsetY * offsetY - projection * projection;
        const radiusSquared = asteroid.radius * asteroid.radius;
        if (perpendicularSquared > radiusSquared) continue;
        const hitDistance = Math.max(0, projection - Math.sqrt(Math.max(0, radiusSquared - perpendicularSquared)));
        if (hitDistance > nearest) continue;
        target = asteroid;
        nearest = hitDistance;
      }
      const beamEnd = target ? { x: origin.x + direction.x * nearest, y: origin.y + direction.y * nearest } : endpoint;
      this.laserBeam = { origin, end: beamEnd };
      this.target = target;
      if (target) target.damage(33 * Math.max(1, this.ship.stats.mining) * dt, beamEnd.x, beamEnd.y, this);
    }

    checkShipCollision(asteroid) {
      if (this.station.isSafe(this.ship)) return;
      const distance = Utils.distance(asteroid, this.ship);
      const contact = asteroid.radius + 20;
      if (distance >= contact || distance === 0) return;
      const nx = (this.ship.x - asteroid.x) / distance;
      const ny = (this.ship.y - asteroid.y) / distance;
      this.ship.x = asteroid.x + nx * contact;
      this.ship.y = asteroid.y + ny * contact;
      this.ship.vx += nx * 90;
      this.ship.vy += ny * 90;
      asteroid.vx -= nx * 12;
      asteroid.vy -= ny * 12;
      this.ship.takeDamage(8 + asteroid.size * 5);
      for (let index = 0; index < 5; index += 1) {
        this.particles.push(new Entities.Particle(this.ship.x, this.ship.y, Utils.randomRange(-70, 70), Utils.randomRange(-70, 70), 0.4, "spark", 7));
      }
    }

    seedAsteroids() {
      for (let index = 0; index < 34; index += 1) this.spawnAsteroid(520, 1200);
    }

    maintainAsteroids() {
      const difficulty = 1 + this.time / 150 + Math.hypot(this.ship.x, this.ship.y) / 1800;
      const desired = Math.min(68, Math.floor(36 + difficulty * 5));
      for (let index = this.asteroids.length; index < Math.min(desired, this.asteroids.length + 3); index += 1) this.spawnAsteroid(620, 1350, difficulty);
    }

    spawnAsteroid(minRadius, maxRadius, difficulty = 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Utils.randomRange(minRadius, maxRadius);
      const x = this.ship.x + Math.cos(angle) * distance;
      const y = this.ship.y + Math.sin(angle) * distance;
      if (Math.hypot(x, y) < this.station.safeRadius + 120) return;
      const type = Utils.weightedChoice([
        { value: "chondrite", weight: 46 },
        { value: "iron", weight: 27 },
        { value: "troilite", weight: 16 },
        { value: "carbonaceous", weight: 7 + difficulty * 2 },
        { value: "pallasite", weight: Math.max(1, difficulty * 1.6) },
      ]);
      const size = Utils.randomRange(0.58, Math.min(2.25, 1.05 + difficulty * 0.28));
      this.asteroids.push(new Asteroid(x, y, type, size));
    }

    render(time) {
      const ctx = this.ctx;
      this.configureRenderer();
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      this.drawBackground(time);
      this.station.draw(ctx, this.camera, this.viewport, this.images, time);
      this.ship.drawExhaust(ctx, this.camera, this.viewport, this.images, this.time, this.buildMode);
      for (const pickup of this.pickups) pickup.draw(ctx, this.camera, this.viewport, this.images);
      for (const asteroid of this.asteroids) asteroid.draw(ctx, this.camera, this.viewport, this.images);
      this.drawLaser(time);
      for (const particle of this.particles) particle.draw(ctx, this.camera, this.viewport, this.images);
      this.ship.draw(ctx, this.camera, this.viewport, this.images, this.buildMode, this.buildHover, this.time);
      if (!this.station.isSafe(this.ship)) this.drawStationIndicator();
      this.drawCoordinates();
    }

    drawBackground(time) {
      const ctx = this.ctx;
      ctx.fillStyle = "#03050a";
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
      const spacing = 72;
      const firstX = Math.floor((this.camera.x - this.viewport.width / 2) / spacing) - 1;
      const firstY = Math.floor((this.camera.y - this.viewport.height / 2) / spacing) - 1;
      const columns = Math.ceil(this.viewport.width / spacing) + 3;
      const rows = Math.ceil(this.viewport.height / spacing) + 3;
      for (let gridX = firstX; gridX < firstX + columns; gridX += 1) {
        for (let gridY = firstY; gridY < firstY + rows; gridY += 1) {
          const noise = Utils.hashNoise(gridX, gridY);
          if (noise < 0.42) continue;
          const world = { x: gridX * spacing + noise * 41, y: gridY * spacing + Utils.hashNoise(gridY, gridX) * 41 };
          const screen = Utils.worldToScreen(world, this.camera, this.viewport.width, this.viewport.height);
          const bright = noise > 0.92;
          const alpha = bright ? 0.65 + Math.sin(time * 2 + gridX) * 0.15 : 0.35;
          Utils.drawImage(ctx, this.images[bright ? "star_bright" : "star_small"], screen.x, screen.y, bright ? 5 : 3, bright ? 5 : 3, 0, alpha);
        }
      }

      const gridSize = 120;
      const offsetX = Math.round((-this.camera.x + this.viewport.width / 2) % gridSize);
      const offsetY = Math.round((-this.camera.y + this.viewport.height / 2) % gridSize);
      ctx.strokeStyle = "rgba(45, 102, 124, 0.035)";
      ctx.lineWidth = 1;
      for (let x = offsetX; x < this.viewport.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.viewport.height); ctx.stroke();
      }
      for (let y = offsetY; y < this.viewport.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.viewport.width, y); ctx.stroke();
      }
    }

    drawLaser(time) {
      if (!this.laserBeam) return;
      const start = Utils.worldToScreen(this.laserBeam.origin, this.camera, this.viewport.width, this.viewport.height);
      const end = Utils.worldToScreen(this.laserBeam.end, this.camera, this.viewport.width, this.viewport.height);
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length < 1) return;

      const shimmer = 0.5 + Math.sin(time * 11) * 0.5;
      const gradient = this.ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, "#6ef4ff");
      gradient.addColorStop(0.24 + shimmer * 0.42, "#35bfff");
      gradient.addColorStop(1, "#285cff");

      this.ctx.save();
      this.ctx.globalCompositeOperation = "lighter";
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.strokeStyle = gradient;
      this.ctx.globalAlpha = 0.22 + shimmer * 0.08;
      this.ctx.lineWidth = 7;
      this.ctx.shadowColor = "#35cfff";
      this.ctx.shadowBlur = 12;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.globalAlpha = 0.9;
      this.ctx.lineWidth = 2.4;
      this.ctx.shadowBlur = 5;
      this.ctx.stroke();
      this.ctx.restore();
    }

    drawStationIndicator() {
      const angle = Math.atan2(-this.ship.y, -this.ship.x);
      const x = this.viewport.width / 2 + Math.cos(angle) * Math.min(this.viewport.width * 0.39, 360);
      const y = this.viewport.height / 2 + Math.sin(angle) * Math.min(this.viewport.height * 0.36, 190);
      Utils.drawImage(this.ctx, this.images.ui_arrow, x, y, 22, 22, angle);
      this.ctx.save();
      this.ctx.textAlign = "center";
      this.ctx.font = "700 14px 'CyberPunk', 'Bahnschrift SemiCondensed', 'Arial Black', sans-serif";
      this.ctx.fillStyle = "#5ce8ff";
      this.ctx.fillText("СТАНЦИЯ", Math.round(x), Math.round(y + 20));
      this.ctx.restore();
    }

    drawCoordinates() {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(83, 132, 151, 0.55)";
      this.ctx.font = "14px 'Segoe UI', Arial, sans-serif";
      this.ctx.textAlign = "right";
      this.ctx.fillText(`X ${Math.round(this.ship.x)} // Y ${Math.round(this.ship.y)}`, this.viewport.width - 14, this.viewport.height - 14);
      this.ctx.restore();
    }

    toggleBuild(force) {
      if (!this.started || this.ship.hp <= 0) return;
      this.buildMode = force;
      this.deleteMode = false;
      this.dom["build-panel"].classList.toggle("hidden", !force);
      document.getElementById("delete-module").classList.remove("active");
      if (force) {
        this.paused = false;
        this.closePanel("dock-panel", true);
        this.closePanel("inventory-panel", true);
        this.camera.x = this.ship.x;
        this.camera.y = this.ship.y;
        this.renderBuildPalette();
        this.updateBuildHover();
        this.notify("Режим строительства: симуляция приостановлена");
      } else {
        this.buildHover = null;
        this.save();
      }
    }

    updateBuildHover() {
      if (!this.buildMode) return;
      const world = Utils.screenToWorld(this.mouse, this.camera, this.viewport.width, this.viewport.height);
      const local = this.ship.worldToLocal(world.x, world.y);
      const gx = Math.round(local.x / MODULE_SIZE);
      const gy = Math.round(local.y / MODULE_SIZE);
      const occupied = this.ship.modules.some((module) => module.gx === gx && module.gy === gy);
      const candidate = { type: this.buildSelected, gx, gy, rotation: this.buildRotation };
      const conflict = getPlacementConflict(this.ship.modules, candidate);
      const valid = this.deleteMode ? occupied : !occupied && isAdjacentToShip(this.ship.modules, gx, gy) && !conflict;
      this.buildHover = { type: this.buildSelected, gx, gy, rotation: this.buildRotation, valid };
    }

    handleBuildClick(forceDelete) {
      if (!this.buildHover) return;
      const deleting = forceDelete || this.deleteMode;
      const result = deleting
        ? this.ship.removeModule(this.buildHover.gx, this.buildHover.gy)
        : this.ship.addModule(this.buildSelected, this.buildHover.gx, this.buildHover.gy, this.buildRotation);
      this.notify(result.reason, !result.ok);
      this.updateBuildHover();
      this.renderBuildPalette();
      this.updateHud();
      if (result.ok) this.save();
    }

    rotateBuildModule() {
      this.buildRotation = (this.buildRotation + 1) % 4;
      this.updateBuildHover();
    }

    toggleDeleteMode() {
      this.deleteMode = !this.deleteMode;
      document.getElementById("delete-module").classList.toggle("active", this.deleteMode);
      this.dom["build-hint"].textContent = this.deleteMode
        ? "Выберите модуль для демонтажа. Возвращается 50% стоимости."
        : "Перед инструментами свободна 1 клетка; позади двигателей — 6 клеток выхлопа.";
      this.updateBuildHover();
    }

    renderBuildPalette() {
      this.dom["build-modules"].innerHTML = Object.entries(MODULES)
        .filter(([type]) => type !== "core")
        .map(([type, definition]) => {
          const unlocked = this.ship.unlocked.has(type);
          return `<button class="module-option ${type === this.buildSelected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-module="${type}" ${unlocked ? "" : "disabled"}>
            <span class="module-sprite"><img src="assets/modules/frame.png" alt="">${moduleArtMarkup(definition)}</span>
            <span><b>${definition.name}</b><small>${definition.energyUse ? `−${definition.energyUse} энергии` : definition.energy ? `+${definition.energy} энергии` : definition.description}</small></span>
            <strong>${definition.cost} ¤</strong>
          </button>`;
        }).join("");
      this.dom["build-modules"].querySelectorAll("[data-module]").forEach((button) => {
        button.addEventListener("click", () => {
          this.buildSelected = button.dataset.module;
          this.deleteMode = false;
          document.getElementById("delete-module").classList.remove("active");
          this.renderBuildPalette();
          this.updateBuildHover();
        });
      });
    }

    openDock() {
      if (!this.station.isDocked(this.ship)) return;
      this.paused = true;
      this.dom["dock-panel"].classList.remove("hidden");
      this.renderDockContent();
    }

    renderDockContent() {
      const container = this.dom["dock-content"];
      if (this.activeDockTab === "sell") this.renderSellTab(container);
      if (this.activeDockTab === "shop") this.renderShopTab(container);
      if (this.activeDockTab === "service") this.renderServiceTab(container);
    }

    renderSellTab(container) {
      const rows = this.ship.inventory.rows();
      const total = this.ship.inventory.saleValue();
      container.innerHTML = `
        <div class="terminal-summary"><p>Станция принимает весь добытый материал.<br>Курс фиксирован для этого сектора.</p><button id="sell-all" class="primary-button" ${total ? "" : "disabled"}>ПРОДАТЬ ВСЁ · ${total} ¤</button></div>
        ${rows.length ? `<div class="manifest-grid">${rows.map(([ore, amount]) => `<div class="ore-line"><img src="${ORES[ore].sprite}" alt=""><div><b>${ORES[ore].name}</b><small>${ORES[ore].value} ¤ за единицу</small></div><strong>${amount}</strong></div>`).join("")}</div>` : '<div class="empty-state">ТРЮМ ПУСТ<br><br>Отправляйтесь за пределы безопасной зоны и добудьте руду.</div>'}`;
      const button = container.querySelector("#sell-all");
      if (button) button.addEventListener("click", () => this.sellAll());
    }

    renderShopTab(container) {
      container.innerHTML = `<div class="terminal-summary"><p>Покупка чертежа открывает модуль навсегда.<br>Установка выполняется в режиме строительства.</p><strong>${Utils.formatNumber(this.ship.credits)} ¤</strong></div>
        <div class="shop-grid">${Object.entries(MODULES).filter(([type]) => !["core", "laser", "thruster", "hull", "cargo"].includes(type)).map(([type, definition]) => {
          const unlocked = this.ship.unlocked.has(type);
          return `<div class="shop-card"><span class="module-sprite"><img src="assets/modules/frame.png" alt="">${moduleArtMarkup(definition)}</span><div><b>${definition.name}</b><small>${definition.description}</small></div><button class="action-button" data-unlock="${type}" ${unlocked || this.ship.credits < definition.unlock ? "disabled" : ""}>${unlocked ? "ОТКРЫТО" : `${definition.unlock} ¤`}</button></div>`;
        }).join("")}</div>`;
      container.querySelectorAll("[data-unlock]").forEach((button) => {
        button.addEventListener("click", () => this.unlockModule(button.dataset.unlock));
      });
    }

    renderServiceTab(container) {
      const missing = Math.ceil(this.ship.stats.maxHp - this.ship.hp);
      const repairCost = Math.ceil(missing * 0.25);
      const upgradeCost = 90 + this.ship.upgradeLevel * 65;
      container.innerHTML = `<div class="terminal-summary"><p>Сервисный модуль станции готов к работе.</p><strong>${Utils.formatNumber(this.ship.credits)} ¤</strong></div>
        <div class="service-card"><div><b>РЕМОНТ КОРПУСА</b><p>Восстановить ${missing} ед. прочности</p></div><button id="repair-ship" class="action-button" ${missing === 0 || this.ship.credits < repairCost ? "disabled" : ""}>${missing === 0 ? "ИСПРАВЕН" : `${repairCost} ¤`}</button></div>
        <div class="service-card"><div><b>УСИЛЕНИЕ КАРКАСА · УР. ${this.ship.upgradeLevel + 1}</b><p>+8% прочности всех модулей</p></div><button id="upgrade-ship" class="action-button" ${this.ship.credits < upgradeCost ? "disabled" : ""}>${upgradeCost} ¤</button></div>`;
      const repair = container.querySelector("#repair-ship");
      const upgrade = container.querySelector("#upgrade-ship");
      if (repair) repair.addEventListener("click", () => {
        if (this.ship.credits < repairCost) return;
        this.ship.credits -= repairCost;
        this.ship.hp = this.ship.stats.maxHp;
        this.notify("Ремонт завершён");
        this.renderServiceTab(container);
        this.updateHud();
        this.save();
      });
      if (upgrade) upgrade.addEventListener("click", () => {
        if (this.ship.credits < upgradeCost) return;
        this.ship.credits -= upgradeCost;
        this.ship.upgradeLevel += 1;
        this.ship.recalculateStats();
        this.notify(`Каркас улучшен до уровня ${this.ship.upgradeLevel}`);
        this.renderServiceTab(container);
        this.updateHud();
        this.save();
      });
    }

    sellAll() {
      const total = this.ship.inventory.saleValue();
      if (total <= 0) return;
      this.ship.credits += total;
      this.totalSold += total;
      this.record = Math.max(this.record, this.totalSold);
      this.ship.inventory.clear();
      this.notify(`Груз продан: +${total} кредитов`);
      this.renderSellTab(this.dom["dock-content"]);
      this.updateHud();
      this.updateMission();
      this.save();
    }

    unlockModule(type) {
      const definition = MODULES[type];
      if (!definition || this.ship.unlocked.has(type) || this.ship.credits < definition.unlock) return;
      this.ship.credits -= definition.unlock;
      this.ship.unlocked.add(type);
      this.notify(`Чертёж открыт: ${definition.name}`);
      this.renderShopTab(this.dom["dock-content"]);
      this.renderBuildPalette();
      this.updateHud();
      this.save();
    }

    toggleInventory() {
      const panel = this.dom["inventory-panel"];
      if (panel.classList.contains("hidden")) {
        this.paused = true;
        this.renderInventory();
        panel.classList.remove("hidden");
      } else this.closePanel("inventory-panel");
    }

    renderInventory() {
      const rows = this.ship.inventory.rows();
      this.dom["inventory-content"].innerHTML = `<div class="terminal-summary"><p>Использовано ${this.ship.inventory.used} из ${this.ship.stats.cargo} ячеек.<br>Оценка груза на станции:</p><strong>${this.ship.inventory.saleValue()} ¤</strong></div>
        ${rows.length ? `<div class="manifest-grid">${rows.map(([ore, amount]) => `<div class="ore-line"><img src="${ORES[ore].sprite}" alt=""><div><b>${ORES[ore].name}</b><small>Оценка: ${amount * ORES[ore].value} ¤</small></div><strong>${amount}</strong></div>`).join("")}</div>` : '<div class="empty-state">ГРУЗОВОЙ ОТСЕК ПУСТ</div>'}`;
    }

    closePanel(id, silent = false) {
      const panel = this.dom[id];
      if (panel) panel.classList.add("hidden");
      if (!silent && this.dom["dock-panel"].classList.contains("hidden") && this.dom["inventory-panel"].classList.contains("hidden") && this.dom["pause-panel"].classList.contains("hidden")) this.paused = false;
    }

    togglePause(force) {
      if (this.ship.hp <= 0) return;
      this.paused = force;
      this.dom["pause-panel"].classList.toggle("hidden", !force);
    }

    onDeath() {
      this.paused = true;
      this.dom["death-panel"].classList.remove("hidden");
      this.save();
    }

    respawn() {
      this.ship.x = -175;
      this.ship.y = 0;
      this.ship.vx = 0;
      this.ship.vy = 0;
      this.ship.hp = this.ship.stats.maxHp;
      this.ship.inventory.clear();
      this.camera.x = this.ship.x;
      this.camera.y = this.ship.y;
      this.paused = false;
      this.dom["death-panel"].classList.add("hidden");
      this.notify("Резервная капсула развёрнута");
      this.save();
    }

    updateHud() {
      const hpRatio = Utils.clamp(this.ship.hp / this.ship.stats.maxHp, 0, 1);
      const cargoRatio = Utils.clamp(this.ship.inventory.used / Math.max(1, this.ship.stats.cargo), 0, 1);
      this.dom["hp-fill"].style.width = `${hpRatio * 100}%`;
      this.dom["hp-fill"].style.background = hpRatio < 0.28 ? "#ff4f63" : "#5ce8ff";
      this.dom["hp-value"].textContent = `${Math.ceil(this.ship.hp)}/${this.ship.stats.maxHp}`;
      this.dom["cargo-fill"].style.width = `${cargoRatio * 100}%`;
      this.dom["cargo-value"].textContent = `${this.ship.inventory.used}/${this.ship.stats.cargo}`;
      this.dom.credits.textContent = Utils.formatNumber(this.ship.credits);
      const distance = Math.max(0, Math.round(Math.hypot(this.ship.x, this.ship.y) - this.station.safeRadius));
      this.dom.distance.textContent = distance === 0 ? "СТАНЦИЯ · БЕЗОПАСНАЯ ЗОНА" : `СТАНЦИЯ · ${distance} м`;
      this.dom["dock-prompt"].classList.toggle("hidden", !this.station.isDocked(this.ship) || this.paused || this.buildMode);
      this.dom["target-card"].classList.toggle("hidden", !this.target);
      if (this.target) {
        const definition = METEOR_TYPES[this.target.type];
        this.dom["target-name"].textContent = definition.name.toUpperCase();
        this.dom["target-yield"].textContent = definition.scan;
        this.dom["target-fill"].style.width = `${Utils.clamp(this.target.hp / this.target.maxHp, 0, 1) * 100}%`;
      }
    }

    updateMission() {
      if (this.totalSold > 0) {
        this.dom["mission-title"].textContent = "РАСШИРЬТЕ КОРАБЛЬ";
        this.dom["mission-copy"].textContent = "Нажмите B и установите грузовой отсек, двигатель или структурный модуль.";
      } else if (this.ship.inventory.used > 0) {
        this.dom["mission-title"].textContent = "ВЕРНИТЕСЬ В ДОК";
        this.dom["mission-copy"].textContent = "Следуйте за указателем станции. В зоне дока нажмите E и продайте руду.";
      } else {
        this.dom["mission-title"].textContent = "ДОБУДЬТЕ РУДУ";
        this.dom["mission-copy"].textContent = "Покиньте безопасную зону, наведите лазер и удерживайте ЛКМ или Space.";
      }
    }

    notify(message, error = false) {
      window.clearTimeout(this.toastTimer);
      this.dom.toast.textContent = message;
      this.dom.toast.classList.toggle("error", error);
      this.dom.toast.classList.add("show");
      this.toastTimer = window.setTimeout(() => this.dom.toast.classList.remove("show"), 2300);
    }

    save() {
      try {
        const payload = {
          ship: this.ship.serialize(),
          time: this.time,
          asteroidsMined: this.asteroidsMined,
          totalSold: this.totalSold,
          record: this.record,
        };
        localStorage.setItem("voidspace-save-v1", JSON.stringify(payload));
      } catch (_error) {
        // Игра остаётся доступной, даже если хранилище браузера отключено.
      }
    }
  }

  VS.Game = Game;
})();
