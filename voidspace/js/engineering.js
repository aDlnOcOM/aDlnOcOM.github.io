(function () {
  "use strict";
  const VS = window.Voidspace;
  const { MODULES, moduleKey, moduleDirection } = VS.ModuleSystem;
  const { RECIPES, STOCK } = VS.EngineeringData;
  const clamp = VS.Utils.clamp;
  const key = (m) => moduleKey(m.gx, m.gy);
  const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  class Engineering {
    constructor(ship, save = {}) {
      this.ship = ship;
      this.nodes = new Map(); this.signature = ""; this.groups = []; this.thermalGroups = [];
      this.stock = Object.fromEntries(Object.keys(STOCK).map((id) => [id, clamp(Math.floor(number(save?.stock?.[id])), 0, 10000)]));
      this.savedNodes = save?.nodes && typeof save.nodes === "object" ? save.nodes : {};
      this.generation = 0; this.demand = 0; this.lastDemand = 0; this.warning = "";
      this.events = []; this.accumulator = 0;
      this.sync();
      if (!save?.nodes && this.ship.hp < this.ship.stats.maxHp) {
        const fraction = clamp(this.ship.hp / Math.max(1, this.ship.stats.maxHp), 0, 1);
        for (const node of this.nodes.values()) node.integrity *= fraction;
      }
      if (this.ship.hp <= 0) {
        const core = this.ship.modules.find((m) => m.type === "core");
        if (core) this.nodes.get(key(core)).integrity = 0;
      }
      this.updateHull();
    }
    boost(m) { return m.overclock && this.ship.research?.has(m.type) && MODULES[m.type].overclockable ? 1.6 : 1; }
    heatMultiplier(m) { return this.boost(m) > 1 ? 3.4 : 1; }
    maxIntegrity(m) { return MODULES[m.type].hp * (1 + (this.ship.upgradeLevel || 0) * 0.08); }
    capacity(m) { return MODULES[m.type].heatCapacity; }
    temperature(m) { return this.nodes.get(key(m))?.temperature ?? 20; }
    electricCapacity(m) { return ((MODULES[m.type].battery || 0) + (m.type === "core" ? 6 : 0) + (MODULES[m.type].energy ? 2 : 0)) * this.boost(m); }
    stockCapacity() { return 80 + this.ship.modules.reduce((sum, m) => sum + (MODULES[m.type].ammoCapacity || 0), 0); }
    stockUsed() { return Object.values(this.stock).reduce((sum, n) => sum + n, 0); }
    takeStock(id, amount) { if (!Object.hasOwn(STOCK, id) || this.stock[id] < amount) return false; this.stock[id] -= amount; return true; }
    sync() {
      const signature = this.ship.upgradeLevel + ":" + this.ship.modules.map((m) => `${key(m)}:${m.type}:${m.rotation || 0}`).join(";");
      if (signature === this.signature) return;
      this.signature = signature;
      this.byCell = new Map(this.ship.modules.map((m) => [key(m), m]));
      for (const m of this.ship.modules) {
        const existing = this.nodes.get(key(m));
        if (existing?.type === m.type) {
          const maximum = this.maxIntegrity(m);
          if (existing.integrity > 0) existing.integrity = Math.min(maximum, existing.integrity + Math.max(0, maximum - (existing.maxIntegrity || maximum)));
          existing.maxIntegrity = maximum;
          continue;
        }
        const saved = this.savedNodes[key(m)];
        const state = saved?.type === m.type ? saved : {};
        this.nodes.set(key(m), { type: m.type, maxIntegrity: this.maxIntegrity(m), temperature: clamp(number(state.temperature, 20), 20, 1500), charge: clamp(number(state.charge, m.type === "core" ? 6 : 0), 0, this.electricCapacity(m)), integrity: clamp(number(state.integrity, this.maxIntegrity(m)), 0, this.maxIntegrity(m)), emp: clamp(number(state.emp), 0, 15), running: Boolean(state.running), decay: clamp(number(state.decay), 0, 1), powered: false,
          recipe: RECIPES[state.recipe]?.factory === MODULES[m.type].factory ? state.recipe : Object.keys(RECIPES).find((id) => RECIPES[id].factory === MODULES[m.type].factory),
          job: state.job && RECIPES[state.job.recipe]?.factory === MODULES[m.type].factory ? { recipe: state.job.recipe, progress: clamp(number(state.job.progress), 0, RECIPES[state.job.recipe].time) } : null });
      }
      for (const id of this.nodes.keys()) if (!this.byCell.has(id)) this.nodes.delete(id);
      this.savedNodes = {};
      this.groups = this.components((m) => MODULES[m.type].powerBus !== false);
      this.thermalGroups = this.components((m) => Boolean(MODULES[m.type].loop));
      this.powerGroup = new Map(); this.heatGroup = new Map();
      for (const group of this.groups) for (const m of group) this.powerGroup.set(key(m), group);
      for (const group of this.thermalGroups) for (const m of group) this.heatGroup.set(key(m), group);
      this.edges = [];
      for (const m of this.ship.modules) for (const other of this.neighbours(m)) if (key(m) < key(other)) this.edges.push([m, other]);
    }
    neighbours(m) {
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => this.byCell.get(moduleKey(m.gx + dx, m.gy + dy))).filter(n => n && VS.ModuleSystem.modulesTouch(m, n));
    }
    components(accept) {
      const seen = new Set(), groups = [];
      for (const m of this.ship.modules) {
        if (seen.has(m) || !accept(m)) continue;
        const group = [], queue = [m]; seen.add(m);
        while (queue.length) {
          const current = queue.pop(); group.push(current);
          for (const next of this.neighbours(current)) if (!seen.has(next) && accept(next)) { seen.add(next); queue.push(next); }
        }
        groups.push(group);
      }
      return groups;
    }
    onCycle(m, group) {
      const members = new Set(group), neighbours = this.neighbours(m).filter((n) => members.has(n));
      if (neighbours.length < 2) return false;
      const seen = new Set([m, neighbours[0]]), queue = [neighbours[0]];
      while (queue.length) for (const next of this.neighbours(queue.pop())) if (members.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
      return neighbours.slice(1).some((next) => seen.has(next));
    }
    reactorStatus(m) {
      const group = this.heatGroup.get(key(m)) || [];
      const reactors = group.filter((n) => MODULES[n.type].reactor).length;
      if (!this.onCycle(m, group)) return "Нет замкнутого теплоконтура";
      if (group.filter((n) => MODULES[n.type].turbine).length < reactors * 2) return "Нужно 2 турбины на каждый реактор";
      if (group.filter((n) => MODULES[n.type].radiator && this.neighbours(n).length < 4).length < reactors * 2) return "Нужно 2 открытых радиатора на каждый реактор";
      if (!group.some((n) => n.type === "coolant_pump" && this.nodes.get(key(n)).powered)) return "Нет работающего насоса";
      return "Готов";
    }
    heatAvailable(m) {
      const group = this.heatGroup.get(key(m)) || [m];
      return group.reduce((sum, node) => sum + Math.max(0, this.temperature(node) - 20) * this.capacity(node), 0);
    }
    takeHeat(m, amount) {
      const total = this.heatAvailable(m);
      if (total + 1e-8 < amount) return false;
      const fraction = amount / Math.max(amount, total);
      for (const node of this.heatGroup.get(key(m)) || [m]) this.nodes.get(key(node)).temperature -= (this.temperature(node) - 20) * fraction;
      return true;
    }
    addHeat(m, amount) {
      const state = this.nodes.get(key(m));
      if (state) state.temperature = Math.max(20, state.temperature + amount / this.capacity(m));
    }
    available(m) {
      return (this.powerGroup.get(key(m)) || []).reduce((sum, node) => sum + this.nodes.get(key(node)).charge, 0);
    }
    online(m) {
      const state = this.nodes.get(key(m));
      const mechanical = ["ballistic", "missile", "thermal"].includes(MODULES[m.type]?.weapon?.kind);
      return Boolean(state && (state.emp <= 0 || mechanical) && state.temperature < 350 && state.integrity > 0);
    }
    request(m, units, allowPartial = false) {
      if (!this.online(m)) return 0;
      const cost = Math.max(0, units) * (this.boost(m) > 1 ? 1.3 : 1);
      if (cost === 0) return 1;
      this.lastDemand += cost;
      const total = this.available(m);
      if (!allowPartial && total + 1e-8 < cost) return 0;
      let rest = Math.min(cost, total);
      const ratio = rest / cost;
      for (const node of this.powerGroup.get(key(m)) || []) {
        const state = this.nodes.get(key(node));
        const taken = Math.min(rest, state.charge); state.charge -= taken; rest -= taken;
        if (MODULES[node.type].battery) this.addHeat(node, taken * 0.08 * this.heatMultiplier(node));
        if (rest <= 1e-9) break;
      }
      return ratio;
    }
    continuous(m, dt, basePower = MODULES[m.type].energyUse || 0) {
      const level = this.request(m, basePower * dt, true);
      this.addHeat(m, basePower * 2 * this.heatMultiplier(m) * level * dt);
      return level * this.boost(m);
    }
    miningFactor(m, dt) {
      let factor = this.continuous(m, dt);
      const [dx, dy] = moduleDirection(m);
      const behind = this.byCell.get(moduleKey(m.gx - dx, m.gy - dy));
      const required = m.type === "laser" ? "plasma_transformer" : "drill_power";
      if (behind?.type === required) factor *= 1 + 0.5 * this.continuous(behind, dt);
      return factor;
    }
    armorDamage(m, raw, kind = "kinetic", penetration = 0) {
      const def = MODULES[m.type];
      if (["heat", "meltdown"].includes(kind)) return raw;
      const strength = def.strength * (1 - clamp(penetration, 0, 1));
      const resistance = kind === "energy" ? strength * 0.35 : strength;
      return Math.max(raw * 0.12, raw * 100 / (100 + resistance * def.density));
    }
    shieldDamage(raw, kind) {
      if (["heat", "meltdown"].includes(kind)) return raw;
      const shield = this.ship.modules.reduce((sum, m) => sum + (this.online(m) && this.nodes.get(key(m)).powered ? (MODULES[m.type].shield || 0) * this.boost(m) : 0), 0);
      return raw * 100 / (100 + shield * 0.5);
    }
    damage(m, raw, kind = "kinetic", penetration = 0) {
      if (!this.ship.modules.includes(m)) return;
      if (this.nodes.get(key(m))?.integrity <= 0) return;
      const amount = this.armorDamage(m, this.shieldDamage(raw, kind), kind, penetration);
      if (this.onDamage) { this.onDamage(m, amount); return; }
      const state = this.nodes.get(key(m)); if (!state) return;
      state.integrity = Math.max(0, state.integrity - amount);
      if (state.integrity <= 0) this.destroy(m);
      else this.updateHull();
    }
    updateHull() {
      const core = this.ship.modules.find((m) => m.type === "core");
      this.ship.hp = core && this.nodes.get(key(core))?.integrity > 0
        ? Math.min(this.ship.stats.maxHp, this.ship.modules.reduce((sum, m) => sum + Math.max(0, this.nodes.get(key(m))?.integrity || 0), 0)) : 0;
    }
    destroy(m) {
      if (!this.ship.modules.includes(m)) return;
      const event = { x: m.gx * 30, y: m.gy * 30, type: m.type, rotation: m.rotation, nuclear: Boolean(MODULES[m.type].reactor) };
      this.events.push(event);
      if (m.type === "core") {
        for (const n of this.ship.modules) if (n !== m) this.events.push({ x: n.gx * 30, y: n.gy * 30, type: n.type, rotation: n.rotation, detached: true });
        this.ship.modules = [m]; // Invisible recovery anchor, not a surviving physical capsule.
        this.ship.stats = VS.ModuleSystem.calculateStats(this.ship.modules, this.ship.upgradeLevel);
        this.ship.hp = 0; this.nodes.get(key(m)).integrity = 0; this.sync(); return;
      }
      const remaining = this.ship.modules.filter((n) => m.assembly ? n.assembly !== m.assembly : n !== m);
      const connected = VS.ModuleSystem.connectedToCore(remaining);
      for (const n of this.ship.modules) if (n !== m && !connected.has(n)) this.events.push({ x: n.gx * 30, y: n.gy * 30, type: n.type, rotation: n.rotation, detached: true });
      this.ship.modules = remaining.filter((n) => connected.has(n));
      this.ship.stats = VS.ModuleSystem.calculateStats(this.ship.modules, this.ship.upgradeLevel);
      this.sync();
      this.updateHull();
    }
    applyEmp(seconds, energyOnly = false) {
      for (const m of this.ship.modules) {
        const def = MODULES[m.type];
        if (!def.functional || (energyOnly && !["plasma", "beam", "tesla"].includes(def.weapon?.kind) && !def.shield)) continue;
        this.nodes.get(key(m)).emp = Math.max(this.nodes.get(key(m)).emp, seconds);
      }
    }
    fabricate(m, dt) {
      const state = this.nodes.get(key(m));
      if (!this.online(m)) return;
      if (!state.job) {
        const recipe = RECIPES[state.recipe];
        if (!recipe || this.stockUsed() + recipe.output > this.stockCapacity()) return;
        if (Object.entries(recipe.ore || {}).some(([id, count]) => (this.ship.inventory.contents[id] || 0) < count) || Object.entries(recipe.stock || {}).some(([id, count]) => this.stock[id] < count)) return;
        for (const [id, count] of Object.entries(recipe.ore || {})) this.ship.inventory.contents[id] -= count;
        for (const [id, count] of Object.entries(recipe.stock || {})) this.stock[id] -= count;
        state.job = { recipe: state.recipe, progress: 0 };
      }
      const recipe = RECIPES[state.job.recipe];
      state.job.progress += dt * this.continuous(m, dt);
      if (state.job.progress >= recipe.time && this.stockUsed() + recipe.output <= this.stockCapacity()) { this.stock[state.job.recipe] += recipe.output; state.job = null; }
    }
    step(dt) {
      this.sync();
      this.accumulator += dt;
      while (this.accumulator >= 0.025) { this.tick(0.025); this.accumulator -= 0.025; }
    }
    tick(dt) {
      this.generation = 0; this.warning = "";
      this.demand = this.lastDemand / dt; this.lastDemand = 0;
      for (const m of this.ship.modules) { const node = this.nodes.get(key(m)); node.emp = Math.max(0, node.emp - dt); node.charge = Math.min(node.charge, this.electricCapacity(m)); }
      for (const group of this.groups) {
        let generated = 0;
        for (const m of group) if (MODULES[m.type].energy && this.online(m)) {
          const output = MODULES[m.type].energy * this.boost(m);
          generated += output * dt; this.generation += output;
          this.addHeat(m, output * 0.2 * this.heatMultiplier(m) * dt);
        }
        // Turbines are generators only while their own heat loop contains a running core.
        for (const m of group) if (MODULES[m.type].turbine && this.online(m)) {
          const loop = this.heatGroup.get(key(m)) || [];
          if (!loop.some((n) => MODULES[n.type].reactor && this.nodes.get(key(n)).running)) continue;
          const output = 24 * this.boost(m);
          if (this.heatAvailable(m) < output * dt) continue;
          this.takeHeat(m, output * dt); generated += output * dt; this.generation += output;
        }
        for (const m of group) {
          const node = this.nodes.get(key(m)); const fill = Math.max(0, Math.min(generated, this.electricCapacity(m) - node.charge)); node.charge += fill; generated -= fill;
          if (MODULES[m.type].battery) this.addHeat(m, fill * 0.04 * this.heatMultiplier(m));
        }
      }
      for (const m of this.ship.modules) {
        const def = MODULES[m.type], node = this.nodes.get(key(m));
        if (m.type === "coolant_pump" || m.type === "computer" || def.shield) node.powered = this.continuous(m, dt) / this.boost(m) > 0.95;
      }
      for (const m of this.ship.modules) if (MODULES[m.type].reactor) {
        const node = this.nodes.get(key(m)), status = this.reactorStatus(m);
        node.running = status === "Готов" && node.emp <= 0;
        if (node.running) node.decay = 1;
        else { node.decay = Math.max(0, node.decay - dt / 20); this.warning = status; }
        const neighbours = this.neighbours(m).filter((n) => MODULES[n.type].reactor && this.nodes.get(key(n)).decay > 0).length;
        this.addHeat(m, ((node.running ? 160 * this.boost(m) * this.heatMultiplier(m) : 90 * node.decay) + neighbours * 140) * dt);
      }
      const flows = new Map(this.thermalGroups.map((group) => [group, Math.max(1, ...group.filter((m) => m.type === "coolant_pump" && this.nodes.get(key(m)).powered).map((m) => this.boost(m)))]));
      for (const [a, b] of this.edges) {
        const na = this.nodes.get(key(a)), nb = this.nodes.get(key(b));
        const delta = na.temperature - nb.temperature;
        const flow = flows.get(this.heatGroup.get(key(a)) || this.heatGroup.get(key(b))) || 1;
        const conductance = (a.type === "heat_pipe" || b.type === "heat_pipe" ? 5 : Math.min(MODULES[a.type].conductivity, MODULES[b.type].conductivity)) * flow;
        const energy = Math.sign(delta) * Math.min(Math.abs(delta) * conductance * dt, Math.abs(delta) / (1 / this.capacity(a) + 1 / this.capacity(b)) * 0.2);
        this.addHeat(a, -energy); this.addHeat(b, energy);
      }
      for (const m of [...this.ship.modules]) {
        const def = MODULES[m.type], node = this.nodes.get(key(m));
        if (!node || node.integrity <= 0) continue;
        const exposed = 4 - this.neighbours(m).length;
        const cooling = (def.radiator ? def.radiator * exposed : 0.07) * Math.max(0, node.temperature - 20);
        this.addHeat(m, -Math.min((node.temperature - 20) * this.capacity(m), cooling * dt));
        if (def.factory) this.fabricate(m, dt);
        if (node.temperature >= def.melt) {
          if (this.onDamage) this.onDamage(m, 1e7);
          else this.destroy(m);
        } else if (node.temperature > 300) { this.warning = "ПОЖАР / ПЕРЕГРЕВ"; this.damage(m, (node.temperature - 300) * 0.015 * dt, "heat"); }
      }
    }
    missingIntegrity() { return this.ship.modules.reduce((sum, m) => sum + Math.max(0, this.maxIntegrity(m) - this.nodes.get(key(m)).integrity), 0); }
    repair(budget = Infinity) {
      const core = this.ship.modules.find((m) => m.type === "core");
      if (!core || this.nodes.get(key(core))?.integrity <= 0) return;
      for (const m of this.ship.modules) {
        const n = this.nodes.get(key(m)), amount = Math.min(budget, Math.max(0, this.maxIntegrity(m) - n.integrity));
        n.integrity += amount; budget -= amount;
      }
      this.updateHull();
    }
    drawModule(ctx, m, time, textured = false) {
      const def = MODULES[m.type], state = this.nodes.get(key(m));
      if (!state) return;
      const x = m.gx * 30, y = m.gy * 30;
      ctx.save();
      if (def.polygon) {
        const points = VS.ModuleSystem.localPolygon(m);
        ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip();
      }
      ctx.translate(x, y);
      if (!textured && def.glyph && def.glyph !== "weapon") {
        if (!["section", "armor"].includes(def.glyph)) { ctx.fillStyle = "#0b1925db"; ctx.fillRect(-10, -10, 20, 20); }
        ctx.strokeStyle = "#6f91a8"; ctx.lineWidth = 1.5;
        if (def.glyph === "pipe" || def.glyph === "bus") {
          for (const n of this.neighbours(m)) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((n.gx - m.gx) * 15, (n.gy - m.gy) * 15); ctx.stroke(); }
          ctx.fillStyle = "#6295a5"; ctx.fillRect(-3, -3, 6, 6);
        } else if (def.glyph === "radiator") {
          for (let i = -8; i <= 8; i += 4) { ctx.beginPath(); ctx.moveTo(i, -10); ctx.lineTo(i, 10); ctx.stroke(); }
        } else if (def.glyph === "battery" || def.glyph === "magazine" || def.glyph === "factory") {
          ctx.strokeRect(-8, -7, 16, 14); ctx.fillStyle = "#7ddbc4";
          const amount = def.battery ? state.charge / Math.max(1, this.electricCapacity(m)) : state.job ? state.job.progress / RECIPES[state.job.recipe].time : 0.5;
          ctx.fillRect(-6, 5 - 10 * amount, 12, 10 * amount);
        } else if (def.glyph === "armor" || def.glyph === "section") {
          ctx.strokeStyle = "#4b657a"; ctx.strokeRect(-9, -9, 18, 18);
          ctx.fillStyle = "#a1abb3";
          for (const sx of [-8, 7]) for (const sy of [-8, 7]) ctx.fillRect(sx, sy, 2, 2);
        } else if (def.glyph !== "weapon") {
          ctx.rotate(def.turbine || m.type === "coolant_pump" ? time * (state.powered || def.turbine ? 2 : 0) : 0);
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
        }
      }
      if (m.overclock) { ctx.fillStyle = "#ffc777"; ctx.fillRect(-12, -13, 7, 2); }
      if (state.emp > 0) { ctx.strokeStyle = "#aa90ff"; ctx.strokeRect(-13, -13, 26, 26); }
      const integrity = state.integrity / this.maxIntegrity(m);
      if (integrity < 0.95) {
        ctx.fillStyle = `rgba(17,6,3,${(1 - integrity) * 0.45})`; ctx.fillRect(-14, -14, 28, 28);
        ctx.strokeStyle = "#c57f56"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(2, 0); ctx.lineTo(-3, 8); ctx.stroke();
      }
      if (this.ship.heatView || state.temperature > 220) {
        ctx.fillStyle = state.temperature > 220 ? `rgba(255,78,36,${clamp((state.temperature - 180) / 650, 0.1, 0.65)})` : "rgba(65,170,235,0.18)";
        ctx.fillRect(-14, -14, 28, 28);
      }
      if (!textured && state.temperature > 300) {
        ctx.fillStyle = "#ffb548";
        ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(Math.sin(time * 15 + x) * 4, -15); ctx.lineTo(6, 8); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    drawAssemblies(ctx, time) {
      for (const m of this.ship.modules) {
        const def = MODULES[m.type]; if (!def.footprint || !def.weapon) continue;
        ctx.save(); ctx.translate(m.gx * 30, m.gy * 30); ctx.rotate((m.rotation || 0) * Math.PI / 2);
        ctx.strokeStyle = def.accent; ctx.fillStyle = "#142334"; ctx.lineWidth = 2;
        if (m.type === "tesla_coil") {
          const charge = Math.min(1, this.available(m) / def.weapon.energy);
          for (const [radius, colour] of [[35, "#111b29"], [32, "#7b8995"], [28, "#253d58"], [23, "#080f20"], [18, "#4b6f9a"], [13, "#101a30"]]) {
            ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(30, 0, radius, 0, Math.PI * 2); ctx.fill();
          }
          for (let i = 0; i < 4; i++) {
            ctx.save(); ctx.translate(30, 0); ctx.rotate(i * Math.PI / 2);
            ctx.fillStyle = "#091320"; ctx.fillRect(19, -7, 20, 14);
            ctx.fillStyle = "#6a7c8d"; ctx.fillRect(22, -5, 13, 10);
            ctx.fillStyle = "#abc0ce"; ctx.fillRect(24, -4, 8, 2);
            ctx.fillStyle = charge > 0.8 ? "#bdb0ff" : "#3e5369"; ctx.fillRect(26, -1, 5, 4); ctx.restore();
          }
          ctx.strokeStyle = `rgba(174,155,255,${0.2 + charge * 0.6})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(30, 0, 20 + Math.sin(time * 4) * charge, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = charge > 0.8 ? "#d4eaff" : "#69869e"; ctx.beginPath(); ctx.arc(30, 0, 7, 0, Math.PI * 2); ctx.fill();
        } else {
          const length = (def.footprint.width - 1) * 30;
          const charge = Math.min(1, this.heatAvailable(m) / def.weapon.heatCost);
          const metal = ctx.createLinearGradient(0, -13, 0, 13);
          metal.addColorStop(0, "#152436"); metal.addColorStop(0.2, "#83909a"); metal.addColorStop(0.4, "#3b5065"); metal.addColorStop(0.65, "#142a41"); metal.addColorStop(1, "#070e19");
          ctx.fillStyle = metal; ctx.fillRect(-8, -13, length + 23, 26);
          ctx.strokeStyle = "#0b1522"; ctx.lineWidth = 2; ctx.strokeRect(-8, -13, length + 23, 26);
          for (let x = 6; x < length; x += 30) {
            ctx.fillStyle = "#0b1321"; ctx.fillRect(x, -15, 10, 30);
            ctx.fillStyle = "#697d8e"; ctx.fillRect(x + 2, -13, 6, 26);
            ctx.fillStyle = "#c49b6d"; ctx.fillRect(x + 3, -10, 4, 20);
            ctx.fillStyle = x / length < charge ? "#ffc987" : "#29445b";
            ctx.fillRect(x + 12, -4, 10, 2); ctx.fillRect(x + 12, 3, 10, 2);
          }
          ctx.fillStyle = "#8b97a0"; ctx.fillRect(length + 4, -16, 10, 32);
          ctx.fillStyle = "#162437"; ctx.fillRect(length + 9, -12, 5, 24);
        }
        ctx.restore();
      }
    }
    summary() {
      return { temperature: Math.max(20, ...[...this.nodes.values()].map((n) => n.temperature)), stored: [...this.nodes.values()].reduce((sum, n) => sum + n.charge, 0), capacity: this.ship.modules.reduce((sum, m) => sum + this.electricCapacity(m), 0), generation: this.generation, grids: this.groups.length };
    }
    serialize() { return { stock: { ...this.stock }, nodes: Object.fromEntries([...this.nodes].map(([id, n]) => [id, { ...n }])) }; }
  }
  VS.Engineering = Engineering;
})();
