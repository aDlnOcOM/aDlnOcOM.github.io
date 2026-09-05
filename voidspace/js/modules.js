(function () {
  "use strict";

  const VS = (window.Voidspace = window.Voidspace || {});

  const MODULE_SIZE = 30;
  const MODULES = {
    core: {
      name: "Командная капсула",
      short: "CORE",
      description: "Управление, базовый трюм и энергия",
      cost: 0,
      hp: 100,
      energyUse: 0,
      energy: 6,
      cargo: 8,
      sprite: "assets/modules/core.png",
      spriteCrop: { x: 21, y: 24, width: 41, height: 37 },
      spriteRotation: 1,
      unlock: 0,
    },
    laser: {
      name: "Шахтёрский лазер",
      short: "LASER",
      description: "Режущий луч дальностью 290 м",
      cost: 70,
      hp: 42,
      energyUse: 3,
      mining: 1,
      range: 290,
      sprite: "assets/modules/laser.png",
      spriteRotation: 1,
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
      description: "+60% мощности добычи",
      cost: 105,
      hp: 55,
      energyUse: 3,
      mining: 0.6,
      sprite: "assets/modules/drill.png",
      spriteRotation: 3,
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

  function isAdjacentToShip(modules, gx, gy) {
    return modules.some((module) => Math.abs(module.gx - gx) + Math.abs(module.gy - gy) === 1);
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
      mining: 0,
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
      stats.mining += definition.mining || 0;
      stats.shield += definition.shield || 0;
    }
    stats.maxHp = Math.round(stats.maxHp * (1 + upgradeLevel * 0.08));
    return stats;
  }

  VS.ModuleSystem = { MODULE_SIZE, MODULES, moduleKey, isAdjacentToShip, isConnected, calculateStats };
})();
