(() => {
  'use strict';
  function generate(sectors, walls, seed, randomFactory, clear, route, floor = 1) {
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
        const ammoFamilies = window.Arsenal?.families.filter(family => family.type === ammoType);
        const ammoKey = ammoFamilies ? ammoFamilies[Math.floor(random() * ammoFamilies.length)].id + ':' + ammoType : undefined;
        const kind = random() < .45 ? 'salvage' : 'supply';
        containers.push({ id: `${sector.index}-${slot}`, ...point, radius: 15, kind,
          salvage: 5 + Math.floor(random() * 9), ammoType, ammoKey,
          ammo: kind === 'supply' ? 18 + Math.floor(random() * 25) : 0, opened: false,
          resources: window.Resources?.roll('sectors', sector.id, random, 3) || {},
          items: window.Workshop && ((sector.index === 0 && slot === 0) || random() < .3) ? [window.Workshop.loot(random, sector.index === 0 && slot === 0, floor)] : [] });
      }
    }
    return containers;
  }
  function collect(container, stock) {
    if (container.opened) return null;
    container.opened = true;
    if (container.ammo > 0) {
      if (container.ammoType === (stock.type || 'energy') && (!stock.ammoKey || stock.ammoKey === (container.ammoKey || 'smg:energy'))) stock.battery += container.ammo;
      else {
        stock.extraSupplies ||= {};
        const key = container.ammoKey || container.ammoType;
        stock.extraSupplies[key] = (stock.extraSupplies[key] || 0) + container.ammo;
      }
    }
    return { salvage: container.salvage, ammo: container.ammo, ammoType: container.ammoType, resources: container.resources || {}, items: container.items || [] };
  }
  window.LootContainers = { generate, collect };
})();
