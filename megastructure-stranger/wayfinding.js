(() => {
  'use strict';
  function objective(map,player){
    if(map.bossStarted&&!map.bossDefeated)return {label:'ШЛЮЗ ЗАПЕРТ · ПОБЕДИТЕ БОССА',angle:0,locked:true};
    const exit=Boolean(map.bossDefeated),target=exit?map.exitGate:map.entryGate;
    const dx=target.x-player.x;
    return {label:(exit?'ЛИФТ':'ШЛЮЗ / БОСС')+' '+(dx>=0?'→':'←'),angle:dx>=0?0:Math.PI,locked:false};
  }
  function bearing(angle){const names=['→ ВПРАВО','↘ ВНИЗ-ВПРАВО','↓ ВНИЗ','↙ ВНИЗ-ВЛЕВО','← ВЛЕВО','↖ ВВЕРХ-ВЛЕВО','↑ ВВЕРХ','↗ ВВЕРХ-ВПРАВО'];return names[(Math.round(angle/(Math.PI/4))+8)%8];}
  function draw(ctx,player,angle,cameraX,aiming=false){
    ctx.save();ctx.translate(player.x-cameraX,player.y);ctx.rotate(angle);
    ctx.strokeStyle=aiming?'#e4dab0':'#c9e1ba';ctx.lineWidth=2;ctx.globalAlpha=.85;
    ctx.beginPath();ctx.moveTo(23,-6);ctx.lineTo(31,0);ctx.lineTo(23,6);ctx.stroke();ctx.restore();
  }
  function reticle(ctx,x,y,spread,aiming,blocked){
    const radius=Math.min(24,Math.max(4,spread*160));
    ctx.save();ctx.translate(x,y);ctx.strokeStyle=blocked?'#edab85':aiming?'#dce4b4':'#b6cabe';ctx.lineWidth=1.5;
    for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(radius,0);ctx.lineTo(radius+5,0);ctx.stroke();}
    ctx.restore();
  }
  window.Wayfinding={objective,bearing,draw,reticle};
})();
