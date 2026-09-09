// Disposable browser fixture: never reads or writes the player's save.
window.addEventListener('DOMContentLoaded', async () => {
  const VS = window.Voidspace;
  const manifest = { module_frame: 'assets/modules/frame.png', exhaust_thruster: 'assets/particles/exhaust_thruster.png', exhaust_booster: 'assets/particles/exhaust_booster.png', ui_arrow: 'assets/ui/arrow.png', star_small: 'assets/ui/star_small.png', star_bright: 'assets/ui/star_bright.png' };
  for (const [type, definition] of Object.entries(VS.ModuleSystem.MODULES)) manifest['module_' + type] = definition.sprite;
  for (const [type, definition] of Object.entries(VS.ORES)) manifest['ore_' + type] = definition.sprite;
  for (const type of ['iron', 'chondrite', 'troilite', 'carbon', 'pallasite']) manifest['meteor_' + type] = 'assets/ores/meteor_' + type + '.png';
  for (const type of ['spark', 'debris']) manifest['particle_' + type] = 'assets/particles/' + type + '.png';
  Object.assign(manifest, VS.Visuals.MANIFEST);
  const images = VS.Visuals.prepare(await VS.Utils.loadImages(manifest));
  VS.Entities.prepareAsteroidAssets(images);
  const game = new VS.Game(document.getElementById('game'), images, { ship: { credits: 4000 }, expedition: { seed: 12 } });
  const preview = document.getElementById('fleet-preview').getContext('2d'); preview.translate(260, 170); preview.rotate(-Math.PI / 5); preview.scale(3.2, 3.2);
  for (const module of VS.Content.CLASSES.miner.modules) VS.Visuals.drawCell(preview, images, module);
  game.save = () => {};
  let collisionOverlay = false;
  const originalRender = game.render.bind(game);
  game.render = function (time) {
    originalRender(time);
    if (!collisionOverlay) return;
    const ctx = this.ctx; ctx.save(); ctx.strokeStyle = '#9fffbc'; ctx.lineWidth = 0.7;
    ctx.translate(this.viewport.width / 2 - this.camera.x, this.viewport.height / 2 - this.camera.y);
    for (const body of [this.ship, ...this.expedition.friendlyStations(), ...this.asteroids, ...this.expedition.enemies.map(e => e.ship)]) {
      for (const shape of VS.Physics.shapes(body)) {
        ctx.beginPath();
        if (shape.points) { shape.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
        else ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  document.getElementById('loading').remove();
  document.getElementById('reset-button').disabled = true;
  function engineeringRig() {
    const cell = (type, gx, gy, rotation = 0) => ({ type, gx, gy, rotation });
    const modules = [cell('core', -1, 0), cell('nuclear_reactor', 0, 0), cell('heat_pipe', 1, 0), cell('turbine', 2, 0), cell('radiator', 2, 1), cell('heat_pipe', 2, 2), cell('turbine', 1, 2), cell('radiator', 0, 2), cell('radiator', 1, -1), cell('radiator', 2, -1), cell('coolant_pump', 0, 1), cell('battery', -1, 1), cell('rtg', -1, -1), cell('ammo_store', -2, 1), cell('cargo', -2, 0), cell('ammo_factory', -2, -1), cell('missile_factory', -3, 0), cell('nuclear_factory', -2, 2), cell('radiator', -3, 2), cell('thruster', -3, -1), cell('laser_turret', 3, 0), cell('heavy_cannon', 3, 1), cell('swarm_launcher', 3, 2), cell('heat_pipe', -1, 2), cell('heat_tank', -1, 3), ...VS.ModuleSystem.assemblyCells(cell('thermo_resonator', 0, 4)), ...VS.ModuleSystem.assemblyCells(cell('tesla_coil', -6, 1))];
    game.ship = new VS.Ship({ modules, credits: 20000, unlocked: Object.keys(VS.ModuleSystem.MODULES) });
    for (const id of Object.keys(VS.ORES)) game.ship.inventory.contents[id] = 2;
    game.ship.engineering.stock.heavy_ammo = 20; game.ship.engineering.stock.swarm_rocket = 36;
    game.ship.x = -175; game.ship.y = 0;
    game.renderBuildPalette();
  }
  const tools = document.createElement('div');
  tools.style.cssText = 'position:fixed;top:0;left:35%;z-index:9999;display:flex;flex-wrap:wrap;max-width:60%;gap:6px;background:#10303e;padding:6px;font-size:14px';
  const compact = document.createElement('button'); compact.textContent = 'Скрыть стенд';
  compact.onclick = () => { tools.hidden = !tools.hidden; tools.style.display = tools.hidden ? 'none' : 'flex'; compact.textContent = tools.hidden ? 'Показать стенд' : 'Скрыть стенд'; };
  compact.style.cssText = 'position:fixed;right:4px;top:4px;z-index:10000;font-size:14px'; document.body.append(compact);
  for (const [name, action] of [
    ['База', () => { game.ship.x = -175; game.ship.y = 0; }],
    ['Контуры коллизий', () => { collisionOverlay = !collisionOverlay; }],
    ['Удар о док', () => { game.input.clear(); game.ship = new VS.Ship({ x: -245, y: 0, modules: [{type:'core',gx:0,gy:0,rotation:0}] }); game.ship.vx = 140; game.paused = false; game.toggleBuild(false); }],
    ['Контакт бура', () => {
      game.input.clear(); game.input.add('KeyW'); game.mouse.down = false;
      game.ship = new VS.Ship({ x: 2200, y: 1700, modules: [{type:'core',gx:-1,gy:0,rotation:0},{type:'drill',gx:0,gy:0,rotation:0}] });
      game.ship.vx = 100; game.ship.inertiaDampingEnabled = false;
      const asteroid = new VS.Entities.Asteroid(2280,1700,'iron',2); asteroid.vx = asteroid.vy = asteroid.spin = asteroid.rotation = 0;
      game.asteroids = [asteroid]; game.expedition.enemies = []; game.expedition.spawnTimer = 999;
      game.paused = false; game.toggleBuild(false);
    }],
    ['Бой', () => { game.ship.x = 1900; game.ship.y = 800; game.ship.angle = 0; game.expedition.enemies = [new VS.Combat.Enemy(VS.Content.ENEMIES[0], 2150, 800, 1)]; }],
    ['Форпост', () => { const station = game.expedition.stations.find(s => s.hostile); game.ship.x = station.x - 400; game.ship.y = station.y; }],
    ['Инженерный стенд', engineeringRig],
    ['Терминал', () => game.openDock()],
    ['Строить', () => game.toggleBuild(!game.buildMode)],
    ['Граница биома', () => { game.ship.x = 1370; game.ship.y = 0; game.ship.vx = 35; game.ship.inertiaDampingEnabled = false; game.expedition.enemies = []; game.paused = false; }],
    ['Дальний биом', () => { game.ship.x = 4950; game.ship.y = 0; game.ship.vx = 20; game.ship.inertiaDampingEnabled = false; game.expedition.enemies = []; game.paused = false; }],
    ['Выхлоп и турели', () => {
      engineeringRig(); game.ship.x = 2100; game.ship.y = 1400; game.ship.angle = 0;
      game.ship.modules.push({type:'booster',gx:-3,gy:1,rotation:0}); game.ship.recalculateStats();
      game.input.add('KeyW'); game.expedition.enemies = []; game.paused = false;
    }],
    ['Стенд разрушения', () => {
      game.ship = new VS.Ship({ x: -250, modules: [{ type: 'core', gx: 0, gy: 0, rotation: 0 }, { type: 'beam', gx: 1, gy: 0, rotation: 0 }, { type: 'cargo', gx: 2, gy: 0, rotation: 0 }, { type: 'thruster', gx: 3, gy: 0, rotation: 2 }], credits: 4000 });
      game.station.restore(); game.renderBuildPalette();
    }],
    ['Отделить хвост', () => { const beam = game.ship.modules.find(m => m.type === 'beam'); if (beam) game.ship.engineering.damage(beam, 10000); }],
    ['Отделить док', () => { const beam = game.station.modules.find(m => m.id === 'connector-0'); if (beam) game.station.damage(beam, 10000, game.expedition); }],
  ]) { const button = document.createElement('button'); button.textContent = name; button.onclick = () => { action(); game.ship.hp = game.ship.stats.maxHp; game.camera.x = game.ship.x; game.camera.y = game.ship.y; game.updateHud(); }; tools.append(button); }
  document.body.append(tools);
});
