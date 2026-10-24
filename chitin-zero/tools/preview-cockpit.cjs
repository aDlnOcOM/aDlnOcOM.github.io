// Render the real canvas renderer without opening a browser or loading the page.
// Pass the absolute path of an already installed @napi-rs/canvas, then output PNG.
const fs = require('node:fs');
const { createCanvas, loadImage, GlobalFonts } = require(process.argv[2]);
const path = require('node:path');
if (fs.existsSync('C:/Windows/Fonts/consola.ttf')) GlobalFonts.registerFromPath('C:/Windows/Fonts/consola.ttf', 'monospace');
global.OffscreenCanvas = class { constructor(w, h) { return createCanvas(w, h); } };
const D = require('../data.js');
const { Game } = require('../core.js');
const Renderer = require('../render.js');
const width = Number(process.argv[4]) || 1440, height = Number(process.argv[5]) || 900;
const canvas = createCanvas(width, height), radar = createCanvas(160, 160);
canvas.clientWidth = width; canvas.clientHeight = height;
const game = new Game({ seed: 7 }); game.player.angle = 0; game.player.pitch = -.12; game.time = 52;
game.player.weapons = Object.keys(D.weapons).slice(0, Number(process.argv[6]) || 6).map((id, i) => ({ id, level: 2 + i % 4, flash: i === 0 ? .08 : 0 }));
for (let i = 0; i < 36; i++) { const e = game.spawn(['mite', 'runner', 'brute', 'spitter', 'charger'][i % 5], 160 + i * 34, Math.sin(i * 6.3) * (80 + i * 16)); e.angle = Math.atan2(-e.y, -e.x); }
game.spawn('queen', 950, -120); game.spawn('nest', 460, 270);
for (let i = 0; i < 14; i++) game.drop('xp', 70 + i * 15, (i % 5 - 2) * 22, 4);
async function main() {
  const ground = await loadImage(path.join(__dirname, '../assets/ground.png'));
  const renderer = new Renderer(canvas, radar, { ready: true, images: { ground } }); renderer.draw(game);
  fs.writeFileSync(process.argv[3], canvas.toBuffer('image/png'));
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
