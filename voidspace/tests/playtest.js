// Disposable browser fixture: never reads or writes the player's save.
window.addEventListener('DOMContentLoaded', async () => {
  const VS = window.Voidspace;
  const manifest = { module_frame: 'assets/modules/frame.png', exhaust_thruster: 'assets/particles/exhaust_thruster.png', exhaust_booster: 'assets/particles/exhaust_booster.png', ui_arrow: 'assets/ui/arrow.png', star_small: 'assets/ui/star_small.png', star_bright: 'assets/ui/star_bright.png' };
  for (const [type, definition] of Object.entries(VS.ModuleSystem.MODULES)) manifest['module_' + type] = definition.sprite;
  for (const [type, definition] of Object.entries(VS.ORES)) manifest['ore_' + type] = definition.sprite;
  for (const type of ['iron', 'chondrite', 'troilite', 'carbon', 'pallasite']) manifest['meteor_' + type] = 'assets/ores/meteor_' + type + '.png';
  for (const type of ['spark', 'debris']) manifest['particle_' + type] = 'assets/particles/' + type + '.png';
  const images = await VS.Utils.loadImages(manifest);
  const game = new VS.Game(document.getElementById('game'), images, { ship: { credits: 4000 }, expedition: { seed: 12 } });
  game.save = () => {};
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
  for (const [name, action] of [
    ['База', () => { game.ship.x = -175; game.ship.y = 0; }],
    ['Бой', () => { game.ship.x = 1900; game.ship.y = 800; game.ship.angle = 0; game.expedition.enemies = [new VS.Combat.Enemy(VS.Content.ENEMIES[0], 2150, 800, 1)]; }],
    ['Форпост', () => { const station = game.expedition.stations.find(s => s.hostile); game.ship.x = station.x - 400; game.ship.y = station.y; }],
    ['Инженерный стенд', engineeringRig],
    ['Терминал', () => game.openDock()],
    ['Строить', () => game.toggleBuild(!game.buildMode)],
    ['Стенд разрушения', () => {
      game.ship = new VS.Ship({ x: -250, modules: [{ type: 'core', gx: 0, gy: 0, rotation: 0 }, { type: 'beam', gx: 1, gy: 0, rotation: 0 }, { type: 'cargo', gx: 2, gy: 0, rotation: 0 }, { type: 'thruster', gx: 3, gy: 0, rotation: 2 }], credits: 4000 });
      game.station.restore(); game.renderBuildPalette();
    }],
    ['Отделить хвост', () => { const beam = game.ship.modules.find(m => m.type === 'beam'); if (beam) game.ship.engineering.damage(beam, 10000); }],
    ['Отделить док', () => { const beam = game.station.modules.find(m => m.id === 'connector-0'); if (beam) game.station.damage(beam, 10000, game.expedition); }],
  ]) { const button = document.createElement('button'); button.textContent = name; button.onclick = () => { action(); game.ship.hp = game.ship.stats.maxHp; game.camera.x = game.ship.x; game.camera.y = game.ship.y; game.updateHud(); }; tools.append(button); }
  document.body.append(tools);
});
