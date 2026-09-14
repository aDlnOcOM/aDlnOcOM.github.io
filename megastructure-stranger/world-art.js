(() => {
  'use strict';
  const palettes={residential:'#b8b094',industrial:'#d1af73',slums:'#aa9277',market:'#b29a8d',robotics:'#84b8b4',elite:'#cabd9a',medical:'#a9c1b3',hydroponics:'#91b28a',archive:'#a2a8c3',utilities:'#bfa579'};
  function arrow(ctx,x,y,size=12){ctx.beginPath();ctx.moveTo(x-size,y-size*.5);ctx.lineTo(x,y);ctx.lineTo(x-size,y+size*.5);ctx.stroke();}
  function floor(ctx,map,cameraX,width,alarm){
    ctx.save();ctx.lineWidth=2;
    for(const sector of map.sectors||[]){
      if(sector.x+sector.width<cameraX||sector.x>cameraX+width)continue;
      ctx.save();ctx.beginPath();ctx.rect(sector.x,30,sector.width,540);ctx.clip();
      const color=alarm?'#db9a79':palettes[sector.id]||'#9cafa5';
      const start=sector.x+Math.max(0,Math.floor((cameraX-sector.x)/160))*160;
      for(let x=start;x<Math.min(sector.x+sector.width,cameraX+width+160);x+=160){
        // Fixed coordinate hash: redraws never consume generation randomness.
        const k=Math.abs(Math.sin(x*.031+sector.index*13));
        ctx.fillStyle='#050b0b';ctx.globalAlpha=.08+k*.06;
        ctx.fillRect(x+20,80+k*360,26+k*36,3);ctx.fillRect(x+28,88+k*360,18,2);
        ctx.globalAlpha=.4;ctx.fillStyle='#0a1416';ctx.fillRect(x+30,sector.lane-58,54,9);
        ctx.strokeStyle='#6b7d76';ctx.globalAlpha=.17;
        for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x+35+i*9,sector.lane-57);ctx.lineTo(x+35+i*9,sector.lane-50);ctx.stroke();}
        ctx.strokeStyle=color;ctx.globalAlpha=alarm?.36:.28;
        arrow(ctx,x+56,sector.lane,13);arrow(ctx,x+76,sector.lane,13);
      }
      ctx.globalAlpha=.55;ctx.fillStyle=color;ctx.fillRect(sector.x+15,sector.lane-70,5,140);
      ctx.font='bold 12px Consolas,monospace';ctx.fillText('→ ШЛЮЗ',sector.x+35,sector.lane+26);
      ctx.restore();
    }
    ctx.restore();
  }
  function shadow(ctx,wall){
    ctx.save();ctx.fillStyle='#020608';ctx.globalAlpha=.28;ctx.fillRect(wall.x+5,wall.y+6,wall.width+3,wall.height+2);
    ctx.globalAlpha=.12;ctx.fillRect(wall.x+7,wall.y+8,wall.width+5,wall.height+4);ctx.restore();
  }
  function edge(ctx,wall,alarm){
    if(wall.width<12||wall.height<12)return;
    ctx.save();ctx.strokeStyle=alarm?'#855951':'#849187';ctx.globalAlpha=.28;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(wall.x+2,wall.y+wall.height-2);ctx.lineTo(wall.x+2,wall.y+2);ctx.lineTo(wall.x+wall.width-2,wall.y+2);ctx.stroke();
    ctx.fillStyle='#d0c7a3';ctx.globalAlpha=.45;
    for(const x of [wall.x+5,wall.x+wall.width-7])for(const y of [wall.y+5,wall.y+wall.height-7])ctx.fillRect(x,y,2,2);
    ctx.restore();
  }
  window.WorldArt={palettes,floor,shadow,edge,arrow};
})();
