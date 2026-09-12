(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});
  const { Utils, ModuleSystem, Entities, ORES } = VS;
  const { MODULES, MODULE_SIZE, getPlacementConflict, isAdjacentToShip } = ModuleSystem;
  const { METEOR_TYPES, Asteroid } = Entities;
  const LASER_MINING_POWER = VS.Physics?.LASER_MINING_POWER || 33;
  const DRILL_MINING_POWER = VS.Physics?.DRILL_MINING_POWER || LASER_MINING_POWER * 1.6;

  function moduleArtMarkup(definition) {
    const visual = VS.Visuals?.iconMarkup(definition);
    if (visual) return visual;
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
      this.laserBeams = [];
      this.target = null;
      this.time = Number(save.time) || 0;
      this.asteroidsMined = Number(save.asteroidsMined) || 0;
      this.totalSold = Number(save.totalSold) || 0;
      this.record = Math.max(Number(save.record) || 0, this.totalSold);
      this.expedition = new VS.Expedition(this, save.expedition || {});
      this.lastFrame = performance.now();
      this.saveTimer = 0;
      this.toastTimer = null;
      this.activeDockTab = "sell";
      this.engineeringTab = "supply";
      this.catalogState = { category: "all", query: "" };
      this.dom = this.captureDom();
      this.bindEvents();
      this.seedAsteroids();
      this.renderBuildPalette();
      this.updateHud();
      this.syncInterface();
      requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    captureDom() {
      const ids = [
        "hp-fill", "hp-value", "cargo-fill", "cargo-value", "credits", "distance", "target-card",
        "target-name", "target-fill", "target-yield", "dock-prompt", "toast", "mission", "mission-title",
        "mission-copy", "dock-panel", "dock-content", "inventory-panel", "inventory-content", "build-panel",
        "build-modules", "build-hint", "pause-panel", "death-panel", "start-screen", "inertia-toggle", "sector-status", "engineering-status",
        "energy-fill", "energy-value", "speed-value", "temperature-value", "generation-value",
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
      // Keep square modules square on ultrawide and non-16:9 displays.
      this.viewport.height = 540 / (this.buildMode ? this.buildZoom || 1 : 1);
      this.viewport.width = this.viewport.height * width / height;
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
      document.getElementById("hud-build")?.addEventListener("click", () => { if (this.started && !this.paused) this.toggleBuild(!this.buildMode); });
      document.getElementById("hud-inventory")?.addEventListener("click", () => { if (this.started && !this.buildMode) this.toggleInventory(); });
      document.getElementById("hud-pause")?.addEventListener("click", () => { if (this.started) { if (this.buildMode) this.toggleBuild(false); this.togglePause(true); } });
      this.dom["dock-prompt"].addEventListener("click", () => { if (!this.paused && !this.buildMode) this.openDock(); });
      const category = document.getElementById("build-category");
      if (category && VS.Visuals) {
        category.innerHTML = Object.entries(VS.Visuals.CATEGORIES).map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
        category.addEventListener("change", () => this.renderBuildPalette());
        document.getElementById("build-search").addEventListener("input", () => this.renderBuildPalette());
      }
      const categories = document.getElementById("build-categories");
      if (categories && VS.Builder) {
        categories.innerHTML = Object.entries(VS.Visuals.CATEGORIES).map(([id, name]) => `<button data-category="${id}" aria-pressed="${id === 'all'}"><span>${VS.Builder.symbols[id]}</span>${id === "industry" ? "Заводы" : id === "all" ? "Все" : name}</button>`).join('');
        categories.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { category.value = button.dataset.category; this.renderBuildPalette(); }));
      }
      document.getElementById('build-available')?.addEventListener('change', () => this.renderBuildPalette());
      document.getElementById('build-undo')?.addEventListener('click', () => this.travelBuildHistory());
      document.getElementById('build-redo')?.addEventListener('click', () => this.travelBuildHistory(true));
      document.getElementById('build-copy')?.addEventListener('click', () => { this.buildPicking = !this.buildPicking; this.updateBuildTools(); });
      document.getElementById('build-fit')?.addEventListener('click', () => this.fitBuild());
      document.getElementById('build-zoom-in')?.addEventListener('click', () => this.zoomBuild(1.25));
      document.getElementById('build-zoom-out')?.addEventListener('click', () => this.zoomBuild(0.8));
      window.addEventListener("storage", (event) => { if (event.key === "voidspace-enemies-v1") this.expedition.reloadTemplates(); });
      this.dom["inertia-toggle"].addEventListener("click", () => {
        if (!this.ship.canStabilize()) return;
        this.ship.inertiaDampingEnabled = !this.ship.inertiaDampingEnabled;
        this.updateHud();
        this.save();
      });
      window.addEventListener("keydown", (event) => this.onKeyDown(event));
      window.addEventListener("keyup", (event) => this.input.delete(event.code));
      window.addEventListener("blur", () => {
        this.input.clear();
        this.mouse.down = false;
        if (this.started && !this.paused && !this.buildMode) this.togglePause(true);
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) { this.input.clear(); this.mouse.down = false; if (this.started && !this.paused) this.togglePause(true); this.save(); }
      });
      window.addEventListener("pagehide", () => this.save());
      window.addEventListener("resize", () => this.resizeCanvas());
      this.canvas.addEventListener("pointermove", (event) => this.updatePointer(event));
      this.canvas.addEventListener("pointerdown", (event) => {
        this.updatePointer(event);
        if (this.buildMode && event.button === 1) { event.preventDefault(); return; }
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
        this.syncInterface();
        if (this.ship.hp <= 0) { this.onDeath(); return; }
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
      document.getElementById("overclock-module")?.addEventListener("click", () => this.toggleModuleOverclock());
      document.getElementById("heat-view")?.addEventListener("click", () => { this.ship.heatView = !this.ship.heatView; document.getElementById("heat-view").setAttribute("aria-pressed", String(this.ship.heatView)); });
      document.getElementById("mission-toggle").addEventListener("click", (event) => {
        const collapsed = this.dom.mission.classList.toggle("collapsed");
        event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
        event.currentTarget.setAttribute("aria-label", collapsed ? "Развернуть задачу" : "Свернуть задачу");
        event.currentTarget.textContent = collapsed ? "+" : "−";
      });

      document.querySelectorAll(".close-panel").forEach((button) => {
        button.addEventListener("click", () => this.closePanel(button.dataset.close));
      });
      document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => {
          document.querySelectorAll(".tab").forEach((tab) => { tab.classList.remove("active"); tab.removeAttribute("aria-current"); });
          button.classList.add("active");
          button.setAttribute("aria-current", "page");
          this.activeDockTab = button.dataset.tab;
          this.renderDockContent();
        });
      });
    }

    updatePointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      const previous = { x: this.mouse.x, y: this.mouse.y };
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * this.viewport.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * this.viewport.height;
      if (this.buildMode && event.type === "pointermove" && (event.buttons & 4)) {
        this.camera.x -= this.mouse.x - previous.x; this.camera.y -= this.mouse.y - previous.y;
      }
      if (this.buildMode) this.updateBuildHover();
    }

    onKeyDown(event) {
      if (event.code === "Tab") {
        const modal = document.querySelector('.panel-overlay:not(.hidden), #start-screen:not(.hidden)');
        if (modal) {
          const controls = [...modal.querySelectorAll('button:not(:disabled), a[href], input, select')].filter((element) => element.getClientRects().length);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        }
        return;
      }
      if (event.code !== "Escape" && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;
      if (this.buildMode && (event.ctrlKey || event.metaKey) && ['KeyZ', 'KeyY'].includes(event.code)) { event.preventDefault(); this.travelBuildHistory(event.code === 'KeyY' || event.shiftKey); return; }
      if (this.buildMode && !event.repeat && event.code === 'KeyC') { this.pickBuildModule(); return; }
      if (this.buildMode && ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract', 'Home'].includes(event.code)) {
        event.preventDefault(); if (event.code === 'Home') this.fitBuild(); else this.zoomBuild(['Equal', 'NumpadAdd'].includes(event.code) ? 1.25 : 0.8); return;
      }
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.repeat && ["KeyB", "KeyI", "KeyF", "Escape", "KeyR", "KeyX", "KeyO"].includes(event.code)) return;
      if (this.buildMode && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        this.camera.x += event.code === "ArrowRight" ? 30 : event.code === "ArrowLeft" ? -30 : 0;
        this.camera.y += event.code === "ArrowDown" ? 30 : event.code === "ArrowUp" ? -30 : 0;
        this.updateBuildHover(); return;
      }
      this.input.add(event.code);

      if (!this.started || event.code === "Space" || this.ship.hp <= 0) return;
      if (event.code === "Escape") {
        if (this.buildMode) this.toggleBuild(false);
        else if (!this.dom["dock-panel"].classList.contains("hidden")) this.closePanel("dock-panel");
        else if (!this.dom["inventory-panel"].classList.contains("hidden")) this.closePanel("inventory-panel");
        else this.togglePause(!this.paused);
      }
      if (event.code === "KeyB" && !this.paused) this.toggleBuild(!this.buildMode);
      if (event.code === "KeyI" && !this.buildMode) this.toggleInventory();
      if (event.code === "KeyF" && this.expedition.dockAt(this.ship) && !this.buildMode && !this.paused) this.openDock();
      if (event.code === "KeyR" && this.buildMode) this.rotateBuildModule();
      if (event.code === "KeyX" && this.buildMode) this.toggleDeleteMode();
      if (event.code === "KeyO" && this.buildMode) this.toggleModuleOverclock();
    }

    loop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
      this.lastFrame = timestamp;
      if (this.started && !this.paused && !this.buildMode && this.ship.hp > 0) this.update(dt);
      this.render(timestamp / 1000);
      requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
    }

    update(dt) {
      const mouseWorld = Utils.screenToWorld(this.mouse, this.camera, this.viewport.width, this.viewport.height);
      // Small bounded motion steps include the speed of a rotating ship's outer modules.
      const steps = VS.Physics.stepCount(this.expedition, dt), step = dt / steps;
      for (let i = 0; i < steps && this.ship.hp > 0; i++) {
        this.time += step;
        this.ship.update(step, this.input, mouseWorld);
        this.stationSafety(step);
        this.target = null;
        this.laserBeams = [];
        if (this.mouse.down || this.input.has("Space")) this.fireMiningLaser(step, mouseWorld);
        for (const asteroid of this.asteroids) asteroid.update(step, this.expedition.friendlyStations());
        this.mineWithDrills(step);
        this.expedition.update(step, mouseWorld);
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
      if (this.ship.hp <= 0) return;
      if (!this.expedition.safeAt(this.ship)) return;
      if (this.ship.hp < this.ship.stats.maxHp) this.ship.hp = Math.min(this.ship.stats.maxHp, this.ship.hp + dt * 1.5);
      this.ship.engineering?.repair(dt * 1.5);
    }

    fireMiningLaser(dt, mouseWorld) {
      if (!this.ship.engineering && this.ship.stats.energyUse > this.ship.stats.energy) return;
      for (const mount of this.ship.getLaserMounts(mouseWorld)) {
        const miningPower = LASER_MINING_POWER * (this.ship.engineering ? this.ship.engineering.miningFactor(mount.module, dt) : 1);
        if (miningPower <= 0) continue;
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
          if (asteroid.dead) continue;
          const hitDistance = VS.Physics.rayAsteroid(origin, direction, nearest, asteroid);
          if (hitDistance === null) continue;
          target = asteroid;
          nearest = hitDistance;
        }
        const structureHit = this.expedition && !this.expedition.safeAt(this.ship)
          ? (VS.WeaponSystem ? VS.WeaponSystem.hit(this.expedition, origin, direction, nearest, "player") : this.expedition.traceEnemy(origin, direction, nearest)) : null;
        const enemyHit = structureHit?.module ? structureHit : null;
        if (enemyHit) {
          const end = { x: origin.x + direction.x * enemyHit.distance, y: origin.y + direction.y * enemyHit.distance };
          this.laserBeams.push({ origin, end });
          (enemyHit.station || enemyHit.enemy).damage(enemyHit.module, miningPower * dt, this.expedition, "energy");
          continue;
        }
        const beamEnd = target
          ? { x: origin.x + direction.x * nearest, y: origin.y + direction.y * nearest }
          : endpoint;
        this.laserBeams.push({ origin, end: beamEnd });
        if (!target) continue;
        target.damage(miningPower * dt, beamEnd.x, beamEnd.y, this);
        if (!target.dead && !this.target) this.target = target;
      }
    }

    mineWithDrills(dt) {
      this.ship.activeDrills.clear();
      if (!this.ship.engineering && this.ship.stats.energyUse > this.ship.stats.energy) return;
      for (const drill of this.ship.getDrillTips()) {
        let target = null;
        let nearestDistance = Infinity;
        for (const asteroid of this.asteroids) {
          if (asteroid.dead) continue;
          const distance = Math.hypot(asteroid.x - drill.x, asteroid.y - drill.y);
          if (!VS.Physics.drillContact(this.ship, drill.module, asteroid) || distance >= nearestDistance) continue;
          target = asteroid;
          nearestDistance = distance;
        }
        if (!target) continue;
        const miningPower = DRILL_MINING_POWER * (this.ship.engineering ? this.ship.engineering.miningFactor(drill.module, dt) : 1);
        if (miningPower <= 0) continue;
        this.ship.activeDrills.add(drill.key);
        target.damage(miningPower * dt, drill.x, drill.y, this);
        if (!target.dead && !this.target) this.target = target;
      }
    }

    seedAsteroids() {
      for (let index = 0; index < 34; index += 1) this.spawnAsteroid(520, 1200);
    }

    maintainAsteroids() {
      const difficulty = this.expedition.difficulty();
      const desired = Math.min(64, this.expedition.biome().density + difficulty * 2);
      for (let index = this.asteroids.length; index < Math.min(desired, this.asteroids.length + 3); index += 1) this.spawnAsteroid(620, 1350, difficulty);
    }

    spawnAsteroid(minRadius, maxRadius, difficulty = 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Utils.randomRange(minRadius, maxRadius);
      const x = this.ship.x + Math.cos(angle) * distance;
      const y = this.ship.y + Math.sin(angle) * distance;
      if (this.expedition.friendlyStations().some((station) => Math.hypot(x - station.x, y - station.y) < station.safeRadius + 120)) return;
      const biome = this.expedition.biome({ x, y });
      const type = Utils.weightedChoice([
        { value: biome.ore, weight: 65 },
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
      this.expedition.drawBackground(ctx, time);
      this.station.draw(ctx, this.camera, this.viewport, this.images, time);
      this.ship.drawExhaust(ctx, this.camera, this.viewport, this.images, this.time);
      for (const pickup of this.pickups) pickup.draw(ctx, this.camera, this.viewport, this.images);
      for (const asteroid of this.asteroids) asteroid.draw(ctx, this.camera, this.viewport, this.images);
      this.drawLaser(time);
      for (const particle of this.particles) particle.draw(ctx, this.camera, this.viewport, this.images);
      this.ship.draw(ctx, this.camera, this.viewport, this.images, this.buildMode, this.buildHover, this.time);
      this.expedition.draw(ctx, time);
      if (!this.expedition.safeAt(this.ship)) this.drawStationIndicator();
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
      for (let index = 0; index < this.laserBeams.length; index += 1) {
        const beam = this.laserBeams[index];
        const start = Utils.worldToScreen(beam.origin, this.camera, this.viewport.width, this.viewport.height);
        const end = Utils.worldToScreen(beam.end, this.camera, this.viewport.width, this.viewport.height);
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (length < 1) continue;

        const shimmer = 0.5 + Math.sin(time * 11 + index * 1.7) * 0.5;
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
    }

    drawStationIndicator() {
      const operational = this.expedition.friendlyStations().filter((s) => s.dockOnline);
      if (!operational.length) return;
      const station = operational.reduce((best, next) => Utils.distance(next, this.ship) < Utils.distance(best, this.ship) ? next : best);
      const angle = Math.atan2(station.y - this.ship.y, station.x - this.ship.x);
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
      if (this.dom["speed-value"]) return;
      this.ctx.save();
      this.ctx.fillStyle = "rgba(83, 132, 151, 0.55)";
      this.ctx.font = "14px 'Segoe UI', Arial, sans-serif";
      this.ctx.textAlign = "right";
      this.ctx.fillText(`X ${Math.round(this.ship.x)} // Y ${Math.round(this.ship.y)}`, this.viewport.width - 14, this.viewport.height - 14);
      this.ctx.restore();
    }

    toggleBuild(force) {
      if (!this.started || this.ship.hp <= 0) return;
      if (force && this.expedition.enemies.some((enemy) => !enemy.dead && Utils.distance(enemy.ship, this.ship) < 900) && !this.expedition.safeAt(this.ship)) { this.notify("Строительство недоступно во время боя", true); return; }
      const entering = force && !this.buildMode;
      this.buildMode = force;
      if (entering && VS.Builder) this.buildHistory = new VS.Builder.History();
      this.buildPicking = false;
      this.resizeCanvas();
      document.getElementById('build-inspector')?.classList.toggle('hidden', !force);
      document.getElementById("game-shell")?.classList.toggle("building", force);
      document.getElementById("hud-build")?.setAttribute("aria-pressed", String(force));
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
        this.fitBuild();
        this.updateBuildHover();
        this.notify("Режим строительства: симуляция приостановлена");
      } else {
        this.buildHover = null;
        this.save();
      }
      this.updateHud();
    }

    updateBuildHover() {
      if (!this.buildMode) return;
      const world = Utils.screenToWorld(this.mouse, this.camera, this.viewport.width, this.viewport.height);
      const local = this.ship.worldToLocal(world.x, world.y);
      const gx = Math.round(local.x / MODULE_SIZE);
      const gy = Math.round(local.y / MODULE_SIZE);
      const candidate = { type: this.buildSelected, gx, gy, rotation: this.buildRotation };
      const cells = ModuleSystem.assemblyCells(candidate);
      const occupied = cells.some((cell) => this.ship.modules.some((module) => module.gx === cell.gx && module.gy === cell.gy));
      const conflict = cells.some((cell) => getPlacementConflict(this.ship.modules, cell)) || VS.Physics.placementBlocked(this.ship, cells, this.expedition);
      const valid = this.deleteMode ? occupied : this.ship.unlocked.has(this.buildSelected) && this.ship.credits >= MODULES[this.buildSelected].cost && !occupied && this.ship.modules.length + cells.length <= 256 && cells.some((cell) => isAdjacentToShip(this.ship.modules, cell.gx, cell.gy, cell)) && !conflict && cells.every((cell) => Math.abs(cell.gx) <= 24 && Math.abs(cell.gy) <= 24);
      this.buildHover = { type: this.buildSelected, gx, gy, rotation: this.buildRotation, valid };
      this.inspectedModule = this.ship.modules.find((m) => m.gx === gx && m.gy === gy) || null;
      if (this.inspectedModule?.assembly) this.inspectedModule = this.ship.modules.find((m) => m.assembly === this.inspectedModule.assembly && MODULES[m.type].footprint) || this.inspectedModule;
      if (this.inspectedModule && this.ship.engineering) {
        const m = this.inspectedModule, node = this.ship.engineering.nodes.get(`${m.gx},${m.gy}`), def = MODULES[m.type];
        this.dom["build-hint"].textContent = `${def.name} · ${Math.round(node?.temperature || 20)}° · плотность ${def.density}, прочность ${def.strength}${def.weapon ? " · " + VS.EngineeringData.consumption(def) : ""} · O: разгон ${m.overclock ? "ВКЛ" : "ВЫКЛ"}${def.reactor ? " · " + this.ship.engineering.reactorStatus(m) : ""}`;
      }
    }

    handleBuildClick(forceDelete) {
      if (!this.buildHover) return;
      if (this.buildPicking && !forceDelete) { this.pickBuildModule(); return; }
      const deleting = forceDelete || this.deleteMode;
      const candidate = { type: this.buildSelected, gx: this.buildHover.gx, gy: this.buildHover.gy, rotation: this.buildRotation };
      if (!deleting && VS.Physics.placementBlocked(this.ship, ModuleSystem.assemblyCells(candidate), this.expedition)) {
        this.notify("Модуль пересекает станцию, астероид или другой корабль", true); return;
      }
      const before = this.captureBuild();
      const result = deleting
        ? this.ship.removeModule(this.buildHover.gx, this.buildHover.gy)
        : this.ship.addModule(this.buildSelected, this.buildHover.gx, this.buildHover.gy, this.buildRotation);
      this.notify(result.reason, !result.ok);
      this.updateBuildHover();
      this.renderBuildPalette();
      this.updateHud();
      if (result.ok) { this.buildHistory?.record(before); this.updateBuildTools(); this.save(); }
    }

    rotateBuildModule() {
      this.buildRotation = (this.buildRotation + 1) % 4;
      this.updateBuildHover();
      this.updateBuildTools();
    }

    toggleModuleOverclock() {
      const module = this.inspectedModule;
      if (!module || !this.ship.modules.includes(module) || !MODULES[module.type].overclockable) { this.notify("Наведите указатель на модуль с поддержкой разгона", true); return; }
      if (!this.ship.research.has(module.type)) { this.notify("Сначала исследуйте разгон этого типа на станции", true); return; }
      this.buildHistory?.record(this.captureBuild());
      module.overclock = !module.overclock;
      this.updateBuildTools();
      this.notify(`Разгон ${MODULES[module.type].name}: ${module.overclock ? "включён" : "выключен"}`);
      this.save();
    }

    toggleDeleteMode() {
      this.buildPicking = false;
      this.deleteMode = !this.deleteMode;
      this.updateBuildTools();
      document.getElementById("delete-module").classList.toggle("active", this.deleteMode);
      this.dom["build-hint"].textContent = this.deleteMode
        ? "Выберите модуль для демонтажа. Возвращается 50% стоимости."
        : "Перед инструментами свободна 1 клетка; позади двигателей — 5 клеток выхлопа.";
      this.updateBuildHover();
    }

    captureBuild() {
      return { ship: this.ship.serialize(), motion: { vx: this.ship.vx, vy: this.ship.vy, angularVelocity: this.ship.angularVelocity } };
    }

    travelBuildHistory(redo = false) {
      if (!this.buildMode || !this.buildHistory) return;
      const snapshot = this.buildHistory.travel(this.captureBuild(), redo);
      if (!snapshot) return;
      const heatView = this.ship.heatView;
      this.ship = new VS.Ship(snapshot.ship); Object.assign(this.ship, snapshot.motion, { heatView });
      this.renderBuildPalette(); this.updateBuildHover(); this.updateHud(); this.save();
      this.notify(redo ? "Действие повторено" : "Действие отменено");
    }

    pickBuildModule() {
      const target = this.inspectedModule;
      if (!target || target.type === 'core') { this.notify("Наведите указатель на установленный блок"); return; }
      this.buildSelected = target.type; this.buildRotation = target.rotation || 0;
      this.buildPicking = false; this.deleteMode = false;
      document.getElementById('delete-module')?.classList.remove('active');
      this.renderBuildPalette(); this.updateBuildHover();
      this.notify("Выбран " + MODULES[target.type].name);
    }

    zoomBuild(factor) {
      if (!this.buildMode) return;
      this.buildZoom = Utils.clamp((this.buildZoom || 1) * factor, 0.3, 2.5);
      this.resizeCanvas(); this.updateBuildHover(); this.updateBuildTools();
    }

    fitBuild() {
      if (!this.buildMode) return;
      const bounds = this.canvas.getBoundingClientRect();
      const points = VS.Physics.shapes(this.ship).flatMap(shape => shape.points || []);
      if (!points.length) return;
      const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x));
      const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y));
      const panel = this.dom['build-panel'].getBoundingClientRect();
      const occupied = Math.min(bounds.width * 0.5, Math.max(0, panel.right - bounds.left) + 20);
      const inspector = document.getElementById('build-inspector')?.getBoundingClientRect();
      const rightInset = bounds.width > 850 && inspector ? bounds.right - inspector.left + 20 : 0;
      this.buildZoom = Utils.clamp(Math.min((bounds.width - occupied - rightInset - 50) / (right - left + 90), (bounds.height - 190) / (bottom - top + 90)) * 540 / bounds.height, 0.3, 1.4);
      this.resizeCanvas();
      this.camera.x = (left + right) / 2 - (occupied - rightInset) / 2 * this.viewport.width / bounds.width;
      this.camera.y = (top + bottom) / 2;
      this.updateBuildHover(); this.updateBuildTools();
    }

    updateBuildTools() {
      const undo = document.getElementById('build-undo'), redo = document.getElementById('build-redo');
      if (undo) undo.disabled = !this.buildHistory?.undoStack.length;
      if (redo) redo.disabled = !this.buildHistory?.redoStack.length;
      document.getElementById('build-copy')?.setAttribute('aria-pressed', String(Boolean(this.buildPicking)));
      const scale = document.getElementById('build-scale'); if (scale) scale.textContent = Math.round((this.buildZoom || 1) * 100) + '%';
      const summary = document.getElementById('build-summary');
      if (summary) summary.textContent = this.ship.modules.length + '/256 клеток · корпус ' + Math.round(this.ship.hp) + ' · R ' + this.buildRotation * 90 + '°';
    }

    renderBuildPalette() {
      if (!VS.Builder) return;
      const category = document.getElementById("build-category")?.value || "all";
      const options = { category, query: document.getElementById("build-search")?.value || "", shipClass: this.ship.shipClass,
        unlocked: this.ship.unlocked, availableOnly: document.getElementById('build-available')?.checked, selected: this.buildSelected };
      const list = this.dom['build-modules'], scroll = list.scrollTop;
      list.innerHTML = VS.Builder.cards(options); list.scrollTop = scroll;
      const detail = document.getElementById('build-details');
      if (detail) detail.innerHTML = VS.Builder.detail(this.buildSelected, options);
      document.querySelectorAll('#build-categories button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
      for (const container of [list, detail].filter(Boolean)) container.querySelectorAll('[data-module]').forEach(button => {
        button.addEventListener('click', () => {
          this.buildSelected = button.dataset.module; this.deleteMode = false; this.buildPicking = false;
          document.getElementById('delete-module').classList.remove('active');
          this.renderBuildPalette(); this.updateBuildHover();
        });
      });
      this.updateBuildTools();
    }
    openDock() {
      if (!this.expedition.dockAt(this.ship)) return;
      this.paused = true;
      this.dom["dock-panel"].classList.remove("hidden");
      this.renderDockContent();
      this.syncInterface("dock-panel");
    }

    renderDockContent() {
      const container = this.dom["dock-content"];
      if (this.activeDockTab === "sell") this.renderSellTab(container);
      if (this.activeDockTab === "shop") this.renderShopTab(container);
      if (this.activeDockTab === "service") this.renderServiceTab(container);
      if (this.activeDockTab === "hangar") this.renderHangarTab(container);
      if (this.activeDockTab === "engineering") this.renderEngineeringTab(container);
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
        <div class="shop-grid">${Object.entries(MODULES).filter(([type, definition]) => !definition.internal && !definition.shipClass && !["core", "laser", "thruster", "hull", "cargo"].includes(type)).map(([type, definition]) => {
          const unlocked = this.ship.unlocked.has(type);
          return `<div class="shop-card" data-catalog-module="${type}"><span class="module-sprite">${moduleArtMarkup(definition)}</span><div><b>${definition.name}</b><small>${definition.description}</small></div><button class="action-button" data-unlock="${type}" ${unlocked || this.ship.credits < definition.unlock ? "disabled" : ""}>${unlocked ? "ОТКРЫТО" : `${definition.unlock} ¤`}</button></div>`;
        }).join("")}</div>`;
      container.querySelectorAll("[data-unlock]").forEach((button) => {
        button.addEventListener("click", () => this.unlockModule(button.dataset.unlock));
      });
      if (VS.Visuals) {
        const toolbar = document.createElement("div"); toolbar.className = "catalog-toolbar";
        toolbar.innerHTML = `<label class="search-field"><span>⌕</span><input type="search" aria-label="Поиск чертежа" placeholder="Поиск чертежа…"></label><select aria-label="Категория чертежей">${Object.entries(VS.Visuals.CATEGORIES).map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select>`;
        container.querySelector(".shop-grid").before(toolbar);
        const search = toolbar.querySelector("input"), category = toolbar.querySelector("select");
        search.value = this.catalogState.query; category.value = this.catalogState.category;
        const empty = document.createElement("div"); empty.className = "empty-state hidden"; empty.textContent = "Ничего не найдено. Измените запрос или категорию."; container.append(empty);
        const filter = () => {
          this.catalogState = { query: search.value, category: category.value };
          let count = 0;
          container.querySelectorAll("[data-catalog-module]").forEach((card) => { const visible = VS.Visuals.matches(card.dataset.catalogModule, category.value, search.value); card.classList.toggle("hidden", !visible); if (visible) count++; });
          empty.classList.toggle("hidden", count > 0);
        };
        search.addEventListener("input", filter); category.addEventListener("change", filter); filter();
      }
    }

    renderServiceTab(container) {
      const missing = Math.ceil(Math.max(this.ship.stats.maxHp - this.ship.hp, this.ship.engineering?.missingIntegrity() || 0));
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
        this.ship.engineering?.repair();
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

    renderHangarTab(container) {
      const world = this.expedition;
      container.innerHTML = `<div class="terminal-summary"><p>Лицензии постоянные. Каждый корабль хранится отдельно.<br>Перед сменой корабля продайте груз.</p><strong>${Utils.formatNumber(this.ship.credits)} ¤</strong></div>
        <div class="service-card"><div><b>КОНТРАКТ № ${world.contracts + 1}</b><p>${world.contractText()}</p></div><button id="claim-contract" ${world.contractProgress() < world.contract.target ? "disabled" : ""}>ПОЛУЧИТЬ</button></div>
        <div class="fleet-grid">${Object.entries(VS.Content.CLASSES).map(([id, type]) => `<article class="fleet-card" style="--fleet-colour:${type.colour}"><span class="eyebrow">${id.toUpperCase()}</span><h3>${type.name}</h3><p>${type.description}</p><button data-license="${id}" ${this.ship.shipClass === id || (!world.licenses.has(id) && this.ship.credits < type.price) || (world.licenses.has(id) && this.ship.inventory.used > 0) ? "disabled" : ""}>${this.ship.shipClass === id ? "АКТИВНЫЙ КОРАБЛЬ" : world.licenses.has(id) ? "ВЫБРАТЬ" : `ЛИЦЕНЗИЯ · ${type.price} ¤`}</button></article>`).join("")}</div>`;
      container.querySelector("#claim-contract").addEventListener("click", () => { if (world.claimContract()) this.notify("Контракт выполнен. Доступен следующий."); this.renderHangarTab(container); this.updateHud(); });
      container.querySelectorAll("[data-license]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.license;
        const changed = world.licenses.has(id) ? world.switchClass(id) : world.buyLicense(id);
        if (changed) this.notify("Ангар обновлён");
        this.renderHangarTab(container); this.renderBuildPalette(); this.updateHud();
      }));
    }

    renderEngineeringTab(container) {
      const engineering = this.ship.engineering;
      if (!engineering) return;
      const { STOCK, RECIPES } = VS.EngineeringData;
      const stats = engineering.summary();
      container.innerHTML = `<div class="terminal-summary"><p>Температура ${Math.round(stats.temperature)}° · генерация ${stats.generation.toFixed(1)}/с<br>Заряд ${Math.floor(stats.stored)}/${Math.floor(stats.capacity)} · сети ${stats.grids}<br>Боеприпасы и компоненты ${engineering.stockUsed()}/${engineering.stockCapacity()}</p><strong>${Utils.formatNumber(this.ship.credits)} ¤</strong></div>
        <h3>СНАБЖЕНИЕ / БОЕПРИПАСЫ</h3><div class="supply-grid">${Object.entries(STOCK).map(([id, item]) => `<div class="supply-item"><b>${item.name}</b><span>${engineering.stock[id]} шт.</span>${item.price ? `<button class="action-button" data-supply="${id}" ${this.ship.credits < item.price * 5 || engineering.stockUsed() + 5 > engineering.stockCapacity() ? "disabled" : ""}>+5 · ${item.price * 5} ¤</button>` : "<small>Только сборка</small>"}</div>`).join("")}</div>
        <h3>ПРОИЗВОДСТВО</h3><p>Сырьё из трюма списывается при запуске партии. Активная партия завершится по прежнему рецепту.</p>
        ${this.ship.modules.filter((m) => MODULES[m.type].factory).map((m) => { const node = engineering.nodes.get(`${m.gx},${m.gy}`); return `<label class="factory-row">${MODULES[m.type].name} [${m.gx}, ${m.gy}] <select data-factory="${m.gx},${m.gy}">${Object.entries(RECIPES).filter(([, r]) => r.factory === MODULES[m.type].factory).map(([id, recipe]) => `<option value="${id}" ${node.recipe === id ? "selected" : ""}>${STOCK[id].name} ×${recipe.output} · ${recipe.time} с · ${Object.entries(recipe.ore || {}).map(([ore, count]) => `${ORES[ore].name} ×${count}`).concat(Object.entries(recipe.stock || {}).map(([part, count]) => `${STOCK[part].name} ×${count}`)).join(", ")}</option>`).join("")}</select><small>${node.job ? `В работе: ${STOCK[node.job.recipe].name} · ${Math.floor(node.job.progress)} с` : "Ожидание сырья, энергии или места"}</small></label>`; }).join("") || "<p>Установите завод боеприпасов, ракетный или ядерный сборщик.</p>"}
        <h3>ИССЛЕДОВАНИЯ РАЗГОНА</h3><p>Каждый тип исследуется отдельно. После исследования: B, наведите на модуль, O. Тяга, добыча, генерация или скорость производства ×1,6; для батарей — ёмкость, для насоса — теплопередача. Оружие: урон и темп ×1,6. Расход энергии ×1,3; тепловыделение ×3,4. Нужен отвод тепла!</p>
        <div class="research-grid">${Object.entries(MODULES).filter(([type, def]) => def.overclockable && !def.internal && this.ship.unlocked.has(type)).map(([type, def]) => `<div class="service-card"><div><b>${def.name}</b><small>${def.description}</small></div><button class="action-button" data-research="${type}" ${this.ship.research.has(type) || this.ship.credits < def.researchCost ? "disabled" : ""}>${this.ship.research.has(type) ? "ИЗУЧЕНО" : def.researchCost + " ¤"}</button></div>`).join("")}</div>`;
      container.querySelectorAll("[data-supply]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.supply, price = STOCK[id].price * 5;
        if (this.ship.credits < price || engineering.stockUsed() + 5 > engineering.stockCapacity()) return;
        this.ship.credits -= price; engineering.stock[id] += 5; this.renderEngineeringTab(container); this.updateHud(); this.save();
      }));
      container.querySelectorAll("[data-research]").forEach((button) => button.addEventListener("click", () => {
        const type = button.dataset.research, def = MODULES[type];
        if (this.ship.research.has(type) || this.ship.credits < def.researchCost) return;
        this.ship.credits -= def.researchCost; this.ship.research.add(type); this.renderEngineeringTab(container); this.updateHud(); this.save();
      }));
      container.querySelectorAll("[data-factory]").forEach((select) => select.addEventListener("change", () => { engineering.nodes.get(select.dataset.factory).recipe = select.value; this.save(); }));
      const sections = ["supply", "factory", "research"];
      [...container.querySelectorAll("h3")].forEach((heading, i) => {
        const section = document.createElement("section"); section.className = "engineering-section"; section.dataset.engineeringSection = sections[i]; heading.before(section);
        let element = heading;
        while (element) { const next = element.nextElementSibling; section.append(element); if (next?.tagName === "H3") break; element = next; }
      });
      const navigation = document.createElement("nav"); navigation.className = "engineering-nav"; navigation.setAttribute("aria-label", "Разделы инженерии");
      navigation.innerHTML = sections.map((id, i) => `<button data-engineering-tab="${id}" aria-pressed="false">${["Снабжение", "Производство", "Исследования"][i]}</button>`).join("");
      container.querySelector(".terminal-summary").after(navigation);
      const switchSection = (id) => {
        this.engineeringTab = id;
        container.querySelectorAll("[data-engineering-section]").forEach((section) => section.classList.toggle("hidden", section.dataset.engineeringSection !== id));
        navigation.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.engineeringTab === id)));
      };
      navigation.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.engineeringTab)));
      switchSection(this.engineeringTab);
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
        this.syncInterface("inventory-panel");
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
      this.syncInterface();
    }

    syncInterface(focusPanel = null) {
      const modal = document.querySelector('.panel-overlay:not(.hidden), #start-screen:not(.hidden)');
      for (const selector of ["#hud", "#mission", ".control-strip", "#build-panel", "#build-inspector"]) {
        const element = document.querySelector(selector); if (element) element.inert = Boolean(modal);
      }
      if (modal) { this.input.clear(); this.mouse.down = false; }
      if (focusPanel) this.dom[focusPanel]?.querySelector("button:not(:disabled)")?.focus();
    }

    togglePause(force) {
      if (this.ship.hp <= 0) return;
      this.paused = force;
      this.dom["pause-panel"].classList.toggle("hidden", !force);
      this.syncInterface(force ? "pause-panel" : null);
      if (force) this.save();
    }

    onDeath() {
      this.paused = true;
      this.dom["death-panel"].classList.remove("hidden");
      this.syncInterface("death-panel");
      this.save();
    }

    respawn() {
      const rescue = this.expedition.friendlyStations().filter((s) => s.dockOnline).sort((a, b) => Utils.distance(a, this.ship) - Utils.distance(b, this.ship))[0];
      this.ship.x = rescue ? rescue.x - 175 : -175;
      this.ship.y = rescue ? rescue.y : 0;
      this.ship.vx = 0;
      this.ship.vy = 0;
      this.ship.angularVelocity = 0;
      this.expedition.bullets = [];
      this.ship.hp = this.ship.stats.maxHp;
      if (VS.Engineering) this.ship.engineering = new VS.Engineering(this.ship, { stock: this.ship.engineering?.stock });
      this.ship.inventory.clear();
      this.camera.x = this.ship.x;
      this.camera.y = this.ship.y;
      this.paused = false;
      this.dom["death-panel"].classList.add("hidden");
      this.syncInterface();
      this.notify("Резервная капсула развёрнута");
      this.save();
    }

    updateHud() {
      if (this.ship.engineering && this.dom["engineering-status"]) {
        const stats = this.ship.engineering.summary();
        this.dom["engineering-status"].textContent = this.expedition.weaponWarning || this.ship.engineering.warning || "";
        if (this.dom["energy-fill"]) {
          this.dom["energy-fill"].style.width = `${Utils.clamp(stats.stored / Math.max(1, stats.capacity), 0, 1) * 100}%`;
          this.dom["energy-value"].textContent = `${Math.floor(stats.stored)}/${Math.floor(stats.capacity)}`;
          this.dom["temperature-value"].textContent = `${Math.round(stats.temperature)}°`;
          this.dom["temperature-value"].style.color = stats.temperature > 220 ? "var(--red)" : "var(--text)";
          this.dom["generation-value"].textContent = `+${stats.generation.toFixed(0)}/с`;
          this.dom["speed-value"].textContent = `${Math.hypot(this.ship.vx, this.ship.vy).toFixed(0)} м/с`;
        }
      }
      const stabilizationButton = this.dom["inertia-toggle"];
      this.dom["sector-status"].textContent = `${this.expedition.biome().name} / Угроза ${this.expedition.biome().danger ? this.expedition.difficulty() : 0} из 8`;
      this.dom["sector-status"].title = VS.Content.CLASSES[this.ship.shipClass].name;
      const available = this.ship.canStabilize();
      const enabled = available && this.ship.inertiaDampingEnabled;
      stabilizationButton.disabled = !available;
      stabilizationButton.setAttribute("aria-pressed", String(enabled));
      stabilizationButton.textContent = `Инерция · ${available ? (enabled ? "гашение ВКЛ" : "свободный ход") :
        this.ship.modules.some((module) => module.type === "computer") ? "нет энергии" : "нужен компьютер"}`;
      stabilizationButton.title = "После отпускания W/S, A/D и Q/E компьютер гасит движение доступными двигателями, РСМ и гиродином";
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
      this.dom["dock-prompt"].classList.toggle("hidden", !this.expedition.dockAt(this.ship) || this.paused || this.buildMode);
      this.dom["target-card"].classList.toggle("hidden", !this.target);
      if (this.target) {
        const definition = METEOR_TYPES[this.target.type];
        this.dom["target-name"].textContent = definition.name.toUpperCase();
        this.dom["target-yield"].textContent = definition.scan;
        this.dom["target-fill"].style.width = `${Utils.clamp(this.target.hp / this.target.maxHp, 0, 1) * 100}%`;
      }
    }

    updateMission() {
      if (this.asteroidsMined > 0 || this.expedition.farthest > 1400 || this.ship.shipClass !== "miner") {
        this.dom["mission-title"].textContent = `КОНТРАКТ ${this.expedition.contracts + 1}`;
        this.dom["mission-copy"].textContent = this.expedition.contractText() + (this.expedition.contractProgress() >= this.expedition.contract.target ? " · Заберите награду в ангаре станции." : "");
        return;
      }
      if (this.totalSold > 0) {
        this.dom["mission-title"].textContent = "РАСШИРЬТЕ КОРАБЛЬ";
        this.dom["mission-copy"].textContent = "Нажмите B и установите грузовой отсек, двигатель или структурный модуль.";
      } else if (this.ship.inventory.used > 0) {
        this.dom["mission-title"].textContent = "ВЕРНИТЕСЬ В ДОК";
        this.dom["mission-copy"].textContent = "Следуйте за указателем станции. В зоне дока нажмите F и продайте руду.";
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
          version: 2,
          expedition: this.expedition.serialize(),
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
