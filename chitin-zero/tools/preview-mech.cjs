// Offline visual QA of the real sprite compositor, not a browser or game-page loader.
// Uses an already available @napi-rs/canvas installation passed explicitly; no install.
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, loadImage } = require(process.argv[2]);
require('../economy.js');
const { Game } = require('../core.js');
const { Sprites, manifest, frameRect } = require('../sprites.js');
async function main() {
  const sprites = new Sprites();
  for (const [id, entry] of Object.entries(manifest)) sprites.images[id] = await loadImage(path.join(__dirname, '..', entry.src));
  if (process.argv[5] === 'motion') {
    const sharp = require(process.argv[6]), width = 960, height = 420, frames = 32;
    const scene = createCanvas(width, height), paint = scene.getContext('2d'), pixels = [];
    const games = ['spectre', 'bastion', 'vector'].map(chassis => {
      const game = new Game({ chassis }); game.spawnClock = game.bossAt = game.nestAt = 1e9; return game;
    });
    for (let f=0;f<frames;f++) {
      const t=f/10, input=t<.9?{x:1}:t<1.5?{x:-1}:t<2?{}:t<2.5?{y:-1}:{};
      for (const g of games) for(let step=0;step<6;step++) g.step(1/60,{...input,aim:true,angle:0});
      paint.fillStyle='#15212b';paint.fillRect(0,0,width,height);
      for(const [col,g] of games.entries()) {
        const x=col*320+155+g.player.x*.25,y=190+g.player.y*.25;
        paint.fillStyle='#b5c8cc';paint.font='15px sans-serif';paint.fillText(g.player.chassis,col*320+18,25);
        paint.fillText(`v = ${Math.round(Math.hypot(g.player.vx,g.player.vy))}`,col*320+18,390);
        sprites.mech(paint,g.player,x,y,245);
      }
      pixels.push(Buffer.from(paint.getImageData(0,0,width,height).data));
    }
    await sharp(Buffer.concat(pixels),{raw:{width,height:height*frames,channels:4,pageHeight:height}}).webp({loop:0,delay:100}).toFile(process.argv[3]);
    return;
  }
  const canvas = createCanvas(1920, 900), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15212b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (process.argv[5] === 'joints') {
    for (const [col, id] of ['spectre', 'bastion', 'vector'].entries()) for (const [line, row] of [0, 4].entries()) {
      const cell = frameRect(id, row, 2), x = col*640+20, y = line*450+20, scale = 2;
      ctx.drawImage(sprites.images[id],cell.x,cell.y,cell.width,cell.height,x,y,cell.width*scale,cell.height*scale);
      const px=x+cell.pivotX*scale,py=y+cell.pivotY*scale;
      ctx.strokeStyle='#ff5977';ctx.beginPath();ctx.moveTo(px-10,py);ctx.lineTo(px+10,py);ctx.moveTo(px,py-10);ctx.lineTo(px,py+10);ctx.stroke();
    }
    fs.writeFileSync(process.argv[3],canvas.toBuffer('image/png'));return;
  }
  for (const [row, chassis] of ['spectre', 'bastion', 'vector'].entries()) for (let direction = 0; direction < 8; direction++) {
    const x = direction * 240 + 120, y = row * 300 + 145, bearing = Math.PI / 2 + direction * Math.PI / 4;
    const phase = Number(process.argv[4] || 0);
    sprites.mech(ctx, { chassis, moving: true, walkTime: phase, angle: bearing + (process.argv[5] === 'strafe' ? Math.PI : 0), moveAngle: bearing }, x, y, 220);
    ctx.fillStyle = '#b5c8cc'; ctx.font = '14px sans-serif'; ctx.fillText(`${chassis} / ${direction}`, direction * 240 + 12, row * 300 + 24);
  }
  fs.writeFileSync(process.argv[3], canvas.toBuffer('image/png'));
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
