(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const MODULE_SIZE = 30;
  const MODULES = {
    core: {
      name: "Командная капсула",
      short: "CORE",
      description: "Управление, гиродин, РСМ, базовый трюм и энергия",
      cost: 0,
      hp: 100,
      energyUse: 0,
      energy: 6,
      cargo: 8,
      rcsPower: 0.25,
      gyroPower: 0.25,
      sprite: "assets/modules/core.png",
      spriteCrop: { x: 21, y: 24, width: 41, height: 37 },
      spriteRotation: 1,
      unlock: 0,
    },
    computer: {
      name: "Модуль компьютерного вычисления",
      short: "CPU",
      description: "Автостабилизация после отпускания управления: двигатели, РСМ и гиродин",
      cost: 80,
      hp: 40,
      energyUse: 1,
      sprite: "assets/modules/shield.png",
      unlock: 0,
    },
    laser: {
      name: "Шахтёрский лазер",
      short: "LASER",
      description: "Режущий луч: дальность 290 м, сектор 90° вперёд",
      cost: 70,
      hp: 42,
      energyUse: 3,
      range: 290,
      attackArc: Math.PI / 2,
      sprite: "assets/modules/laser.png",
      spriteRotation: 1,
      reservedZone: { direction: "front", length: 1, kind: "tool" },
      unlock: 0,
    },
    thruster: {
      name: "Импульсный двигатель",
      short: "THRUST",
      description: "Тяга и манёвренность корабля",
      cost: 45,
      hp: 50,
      energyUse: 2,
      thrust: 1,
      sprite: "assets/modules/thruster.png",
      spriteRotation: 1,
      reservedZone: { direction: "rear", length: 5, kind: "exhaust" },
      unlock: 0,
    },
    booster: {
      name: "Маршевый двигатель",
      short: "BOOST",
      description: "Усиленная тяга для тяжёлых кораблей",
      cost: 95,
      hp: 62,
      energyUse: 4,
      thrust: 2.25,
      sprite: "assets/modules/booster.png",
      spriteRotation: 1,
      reservedZone: { direction: "rear", length: 5, kind: "exhaust" },
      unlock: 125,
    },
    hull: {
      name: "Секционный корпус",
      short: "HULL",
      description: "Прочная точка крепления",
      cost: 24,
      hp: 85,
      energyUse: 0,
      sprite: "assets/modules/hull.png",
      spriteCrop: { x: 8, y: 0, width: 47, height: 47 },
      unlock: 0,
    },
    beam: {
      name: "Структурная балка",
      short: "BEAM",
      description: "Лёгкая дешёвая конструкция",
      cost: 12,
      hp: 38,
      energyUse: 0,
      sprite: "assets/modules/beam.png",
      spriteCrop: { x: 10, y: 2, width: 44, height: 44 },
      unlock: 35,
    },
    cargo: {
      name: "Грузовой модуль",
      short: "CARGO",
      description: "+18 единиц вместимости",
      cost: 58,
      hp: 58,
      energyUse: 1,
      cargo: 18,
      sprite: "assets/modules/cargo.png",
      unlock: 0,
    },
    drill: {
      name: "Буровой модуль",
      short: "DRILL",
      description: "Контактная добыча: 1,6× мощности лазера; усиленный таран",
      cost: 105,
      hp: 55,
      energyUse: 3,
      sprite: "assets/modules/drill.png",
      spriteRotation: 3,
      reservedZone: { direction: "front", length: 1, kind: "tool" },
      unlock: 140,
    },
    rtg: {
      name: "РИТЕГ",
      short: "RTG",
      description: "+12 единиц энергии",
      cost: 92,
      hp: 48,
      energyUse: 0,
      energy: 12,
      sprite: "assets/modules/rtg.png",
      unlock: 110,
    },
    shield: {
      name: "Генератор щита",
      short: "SHIELD",
      description: "+45 к прочности, требует энергию",
      cost: 135,
      hp: 45,
      energyUse: 5,
      shield: 45,
      sprite: "assets/modules/shield.png",
      unlock: 180,
    },
  };

  function moduleKey(gx, gy) {
    return `${gx},${gy}`;
  }

  function connectedToCore(modules) {
    const connected = new Set();
    const queue = modules.filter((m) => m.type === "core");
    const touches = (a, b) => {
      const overlapX = ((a.hitWidth || MODULE_SIZE) + (b.hitWidth || MODULE_SIZE)) / 2 - Math.abs(a.gx - b.gx) * MODULE_SIZE;
      const overlapY = ((a.hitHeight || MODULE_SIZE) + (b.hitHeight || MODULE_SIZE)) / 2 - Math.abs(a.gy - b.gy) * MODULE_SIZE;
      return (overlapX > 0.01 && overlapY >= -0.01) || (overlapY > 0.01 && overlapX >= -0.01);
    };
    while (queue.length) {
      const current = queue.pop();
      if (connected.has(current)) continue;
      connected.add(current);
      queue.push(...modules.filter((m) => !connected.has(m) && touches(current, m)));
    }
    return connected;
  }

  function assemblyCells(module) {
    const footprint = MODULES[module.type]?.footprint;
    if (!footprint) return [{ ...module }];
    const [dx, dy] = moduleDirection(module);
    const group = moduleKey(module.gx, module.gy);
    const cells = [];
    for (let x = 0; x < footprint.width; x++) for (let y = -Math.floor(footprint.height / 2); y <= Math.floor(footprint.height / 2); y++) {
      cells.push({ type: x === 0 && y === 0 ? module.type : "assembly_section", gx: module.gx + dx * x - dy * y, gy: module.gy + dy * x + dx * y, rotation: module.rotation, assembly: group });
    }
    return cells;
  }

  function isAdjacentToShip(modules, gx, gy) {
    return modules.some((module) => Math.abs(module.gx - gx) + Math.abs(module.gy - gy) === 1);
  }

  function moduleDirection(module) {
    const rotation = ((Number(module.rotation) || 0) % 4 + 4) % 4;
    return [[1, 0], [0, 1], [-1, 0], [0, -1]][rotation];
  }

  function reservedCellsForModule(module) {
    const reservation = MODULES[module.type]?.reservedZone;
    if (!reservation) return [];
    const [forwardX, forwardY] = moduleDirection(module);
    const sign = reservation.direction === "rear" ? -1 : 1;
    return Array.from({ length: reservation.length }, (_, index) => ({
      gx: module.gx + forwardX * sign * (index + 1),
      gy: module.gy + forwardY * sign * (index + 1),
      kind: reservation.kind,
    }));
  }

  function getPlacementConflict(modules, candidate) {
    for (const module of modules) {
      const blocked = reservedCellsForModule(module).find((cell) => cell.gx === candidate.gx && cell.gy === candidate.gy);
      if (blocked) return { kind: blocked.kind, mode: "target" };
    }

    const occupied = new Set(modules.map((module) => moduleKey(module.gx, module.gy)));
    const blocked = reservedCellsForModule(candidate).find((cell) => occupied.has(moduleKey(cell.gx, cell.gy)));
    return blocked ? { kind: blocked.kind, mode: "clearance" } : null;
  }

  function placementConflictReason(conflict) {
    if (!conflict) return "";
    if (conflict.kind === "exhaust") {
      return conflict.mode === "target"
        ? "Клетка занята выхлопом двигателя"
        : "Позади двигателя нужны 5 свободных клеток для выхлопа";
    }
    return conflict.mode === "target"
      ? "Клетка перед добывающим модулем должна оставаться свободной"
      : "Перед добывающим модулем нужна свободная клетка";
  }

  function isConnected(modules) {
    if (modules.length === 0) return false;
    const byKey = new Map(modules.map((module) => [moduleKey(module.gx, module.gy), module]));
    const seen = new Set();
    const queue = [modules.find((module) => module.type === "core") || modules[0]];
    while (queue.length > 0) {
      const current = queue.shift();
      const key = moduleKey(current.gx, current.gy);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = byKey.get(moduleKey(current.gx + dx, current.gy + dy));
        if (next && !seen.has(moduleKey(next.gx, next.gy))) queue.push(next);
      }
    }
    return seen.size === modules.length;
  }

  function calculateStats(modules, upgradeLevel = 0) {
    const stats = {
      maxHp: 0,
      cargo: 0,
      energy: 0,
      energyUse: 0,
      thrust: 0,
      shield: 0,
    };
    for (const module of modules) {
      const definition = MODULES[module.type];
      if (!definition) continue;
      stats.maxHp += definition.hp;
      stats.cargo += definition.cargo || 0;
      stats.energy += definition.energy || 0;
      stats.energyUse += definition.energyUse || 0;
      stats.thrust += definition.thrust || 0;
      stats.shield += definition.shield || 0;
    }
    stats.maxHp = Math.round(stats.maxHp * (1 + upgradeLevel * 0.08));
    return stats;
  }

  VS.ModuleSystem = {
    MODULE_SIZE,
    MODULES,
    connectedToCore,
    assemblyCells,
    moduleKey,
    moduleDirection,
    reservedCellsForModule,
    getPlacementConflict,
    placementConflictReason,
    isAdjacentToShip,
    isConnected,
    calculateStats,
  };
})();
