(() => {
  'use strict';
  function generate(sectors, walls, seed, randomFactory, clear, route) {
    const random = randomFactory(seed ^ 0x51a7c0de), containers = [];
    for (const sector of sectors) {
      for (let slot = 0; slot < 2; slot++) {
        let point;
        for (let attempt = 0; attempt < 20; attempt++) {
          const candidate = { x: sector.x + 150 + random() * (sector.width - 300),
            y: sector.lane + (slot ? 1 : -1) * (90 + random() * 100) };
          if (clear(candidate, candidate, walls, 30) && route({ x: candidate.x, y: sector.lane }, candidate, walls, 18).length) { point = candidate; break; }
        }
        // Wide boundary vestibules provide reachable fallback alcoves.
        point ||= { x: sector.x + 64, y: sector.lane + (slot ? 195 : -195) };
        const ammoType = ['energy', 'ballistic', 'elemental', 'mechanical'][Math.floor(random() * 4)];
        const kind = random() < .45 ? 'salvage' : 'supply';
        containers.push({ id: `${sector.index}-${slot}`, ...point, radius: 15, kind,
          salvage: 5 + Math.floor(random() * 9), ammoType,
          ammo: kind === 'supply' ? 18 + Math.floor(random() * 25) : 0, opened: false });
      }
    }
    return containers;
  }
  function collect(container, stock) {
    if (container.opened) return null;
    container.opened = true;
    if (container.ammo > 0) {
      if (container.ammoType === (stock.type || 'energy')) stock.battery += container.ammo;
      else {
        stock.extraSupplies ||= {};
        stock.extraSupplies[container.ammoType] = (stock.extraSupplies[container.ammoType] || 0) + container.ammo;
      }
    }
    return { salvage: container.salvage, ammo: container.ammo, ammoType: container.ammoType };
  }
  window.LootContainers = { generate, collect };
})();
