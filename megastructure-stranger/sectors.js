/* Weighted districts with repeatable layouts and an unobstructed service route. */
(() => {
  'use strict';
  const types = [
    { id: 'residential', name: 'Жилой блок', weight: 28, color: '#a89875', floor: '#303331', detail: 'КАПСУЛЬНОЕ ЖИЛЬЁ', style: 'rooms', security: 1 },
    { id: 'industrial', name: 'Производственный цех', weight: 26, color: '#b89254', floor: '#333330', detail: 'АВТОМАТИЧЕСКАЯ ЛИНИЯ', style: 'machines', security: 2 },
    { id: 'slums', name: 'Трущобы', weight: 16, color: '#919465', floor: '#30352f', detail: 'НЕУЧТЁННЫЕ ПОСЕЛЕНИЯ', style: 'scrap', security: 0 },
    { id: 'market', name: 'Торговая галерея', weight: 9, color: '#b97d9d', floor: '#34303a', detail: 'ОБМЕН / ПАЙКИ / ДОЛГИ', style: 'stalls', security: 1 },
    { id: 'robotics', name: 'Роботизированный узел', weight: 7, color: '#75aaa9', floor: '#29363a', detail: 'ПРИСУТСТВИЕ ЛЮДЕЙ ЗАПРЕЩЕНО', style: 'pods', security: 3 },
    { id: 'elite', name: 'Элитный ярус', weight: 4, color: '#c5b687', floor: '#323538', detail: 'ДОПУСК ВЫСШЕЙ КАТЕГОРИИ', style: 'suites', security: 3 },
    { id: 'medical', name: 'Медицинский комплекс', weight: 3, color: '#86b3a5', floor: '#303a39', detail: 'СТАБИЛИЗАЦИЯ / КАРАНТИН', style: 'beds', security: 2 },
    { id: 'hydroponics', name: 'Гидропонные сады', weight: 3, color: '#89a46b', floor: '#29382f', detail: 'ЦИКЛ ПИТАНИЯ / ВЛАЖНОСТЬ 94%', style: 'beds', security: 1 },
    { id: 'archive', name: 'Архив памяти', weight: 2, color: '#8897ba', floor: '#2c303b', detail: 'ХРАНИЛИЩЕ ЛИЧНЫХ СЛЕДОВ', style: 'racks', security: 2 },
    { id: 'utilities', name: 'Коммунальный коллектор', weight: 2, color: '#b18b68', floor: '#34302c', detail: 'ТЕПЛО / СТОК / РЕЦИРКУЛЯЦИЯ', style: 'pipes', security: 1 }
  ];
  function seeded(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
      n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }
  function pick(random) {
    let roll = random() * types.reduce((sum, type) => sum + type.weight, 0);
    for (const type of types) { roll -= type.weight; if (roll < 0) return type; }
    return types[types.length - 1];
  }
  function generate(count, width, height, seed) {
    const random = seeded(seed), sectors = [], walls = [];
    const type = pick(random);
    for (let index = 0; index < count; index++) {
      const x = index * width;
      const lane = height / 2 + (Math.floor(random() * 3) - 1) * 36;
      const sector = { ...type, x, width, lane, index, props: [], lights: [] };
      // The boundary vestibules connect differing corridor heights safely.
      const add = (bx, by, bw, bh, material = type.style) => {
        if (bw <= 0 || bh <= 0) return;
        walls.push({ x: bx, y: by, width: bw, height: bh, material, district: type.id, tint: type.color, sector: index });
      };
      // Tie partitions into the outer shell: perimeter alleys cannot bypass
      // the patrol corridor. Keep the same 132-unit navigable opening.
      sector.checkpoints = [x + 100, x + width - 112];
      for (const checkpoint of sector.checkpoints) {
        add(checkpoint, 28, 24, lane - 66 - 28, 'bulkhead');
        add(checkpoint, lane + 66, 24, height - 28 - lane - 66, 'bulkhead');
        sector.props.push({ x: checkpoint, y: lane - 62, w: 24, h: 124, kind: 'hazard' });
      }
      const modules = Math.max(2, Math.floor((width - 240) / 260));
      const cell = (width - 240) / modules;
      for (let m = 0; m < modules; m++) {
        const bx = x + 140 + m * cell, bw = cell - 36;
        for (const bottom of [false, true]) {
          const low = bottom ? lane + 66 : 48;
          const high = bottom ? height - 48 : lane - 66;
          const available = high - low;
          const y = low + 12, h = available - 24;
          if (type.style === 'rooms' || type.style === 'suites') {
            add(bx, y, 16, h);
            add(bx, bottom ? y + h - 16 : y, bw, 16);
            add(bx + bw - 16, y, 16, h * .56);
            add(bx + 32, y + 32, bw * .38, Math.max(20, h * .22), 'furniture');
            sector.props.push({ x: bx + 30, y: y + 32, w: bw - 64, h: Math.max(20, h - 64), kind: 'rug' });
          } else if (type.style === 'scrap') {
            add(bx + random() * 25, y + random() * 20, bw * .55, h * .45);
            add(bx + bw * .67, y + h * .5, bw * .25, h * .38);
          } else if (type.style === 'stalls') {
            add(bx, bottom ? y : y + h - 36, bw, 36);
            add(bx, y, 18, h);
            sector.props.push({ x: bx + 25, y: bottom ? y + 48 : y + 10, w: bw - 35, h: 24, kind: 'awning' });
          } else if (type.style === 'racks') {
            for (let r = 0; r < 3; r++) add(bx + r * bw / 3, y, 26, h);
          } else if (type.style === 'pipes') {
            add(bx, y + h * .25, bw, 32);
            add(bx + bw * .6, y + h * .55, 40, h * .4);
          } else if (type.style === 'beds') {
            for (let r = 0; r < 2; r++) add(bx + r * bw / 2, y + 16, bw * .34, h - 32);
          } else {
            add(bx + 16, y + 12, bw - 32, h - 24);
            sector.props.push({ x: bx + 4, y: bottom ? low - 8 : high + 2, w: bw - 8, h: 8, kind: 'hazard' });
          }
          sector.lights.push({ x: bx + bw / 2, y: bottom ? height - 36 : 36, phase: random() * 6 });
        }
        sector.props.push({ x: bx, y: lane - 38, w: bw, h: 76, kind: 'lane' });
      }
      sectors.push(sector);
    }
    return { sectors, walls };
  }
  function draw(context, map, cameraX, screenWidth, height, alarm) {
    for (const sector of map.sectors || []) {
      if (sector.x + sector.width < cameraX || sector.x > cameraX + screenWidth) continue;
      context.fillStyle = alarm ? '#302426' : sector.floor;
      context.fillRect(sector.x, 28, sector.width, height - 56);
      context.strokeStyle = alarm ? '#77403b' : sector.color;
      context.globalAlpha = .13;
      const tile = sector.style === 'suites' ? 96 : sector.style === 'scrap' ? 48 : 64;
      for (let x = Math.max(sector.x, sector.x + Math.floor((cameraX - sector.x) / tile) * tile); x < Math.min(sector.x + sector.width, cameraX + screenWidth); x += tile) {
        context.beginPath(); context.moveTo(x, 28); context.lineTo(x, height - 28); context.stroke();
      }
      for (let y = 28; y < height - 28; y += tile) {
        context.beginPath(); context.moveTo(sector.x, y); context.lineTo(sector.x + sector.width, y); context.stroke();
      }
      context.globalAlpha = 1;
      for (const prop of sector.props) {
        if (prop.x + prop.w < cameraX || prop.x > cameraX + screenWidth) continue;
        context.fillStyle = sector.color;
        context.globalAlpha = prop.kind === 'awning' ? .3 : .12;
        if (prop.kind === 'lane') {
          context.fillRect(prop.x, prop.y, prop.w, 2);
          context.fillRect(prop.x, prop.y + prop.h, prop.w, 2);
          context.font = '18px Consolas, monospace'; context.fillText('› ›', prop.x + 20, prop.y + 45);
        } else if (prop.kind === 'hazard') {
          for (let x = prop.x; x < prop.x + prop.w - 8; x += 16) context.fillRect(x, prop.y, 8, prop.h);
        } else { context.fillRect(prop.x, prop.y, prop.w, prop.h); }
      }
      context.globalAlpha = .55;
      context.fillStyle = sector.color; context.font = 'bold 15px Consolas, monospace';
      context.fillText(String(sector.index + 1).padStart(2, '0') + ' / ' + sector.name.toUpperCase(), sector.x + 32, sector.lane - 48);
      context.font = '9px Consolas, monospace'; context.fillText(sector.detail, sector.x + 32, sector.lane + 60);
      context.globalAlpha = 1;
      for (const light of sector.lights) {
        if (light.x < cameraX - 80 || light.x > cameraX + screenWidth + 80) continue;
        const glow = context.createRadialGradient(light.x, light.y, 2, light.x, light.y, 65);
        glow.addColorStop(0, alarm ? '#db554326' : sector.color + '26'); glow.addColorStop(1, '#00000000');
        context.fillStyle = glow; context.fillRect(light.x - 65, light.y - 65, 130, 130);
        context.fillStyle = alarm ? '#cb6b5b' : sector.color; context.fillRect(light.x - 12, light.y - 2, 24, 4);
      }
    }
  }
  window.SectorGenerator = { types, seeded, pick, generate, draw };
})();
