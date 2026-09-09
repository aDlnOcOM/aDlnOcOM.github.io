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
  const tools = document.createElement('div');
  tools.style.cssText = 'position:fixed;top:0;left:40%;z-index:9999;display:flex;gap:6px;background:#10303e;padding:6px;font-size:14px';
  for (const [name, action] of [
    ['База', () => { game.ship.x = -175; game.ship.y = 0; }],
    ['Бой', () => { game.ship.x = 1900; game.ship.y = 800; game.ship.angle = 0; game.expedition.enemies = [new VS.Combat.Enemy(VS.Content.ENEMIES[0], 2150, 800, 1)]; }],
    ['Форпост', () => { const station = game.expedition.stations.find(s => s.hostile); game.ship.x = station.x - 400; game.ship.y = station.y; }],
  ]) { const button = document.createElement('button'); button.textContent = name; button.onclick = () => { action(); game.ship.hp = game.ship.stats.maxHp; game.camera.x = game.ship.x; game.camera.y = game.ship.y; game.updateHud(); }; tools.append(button); }
  document.body.append(tools);
});
