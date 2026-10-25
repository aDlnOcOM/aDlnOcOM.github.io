(function(root){
  'use strict';
  const C=root.FieldCore||require('./field-core.js'),F=root.FieldData||require('./field-data.js'),Base=root.TDRender||require('./td-render.js'),TC=root.TDCore||require('./td-core.js');
  const polygon=Base.polygon;
  class Renderer extends Base.Renderer{
    constructor(canvas){super(canvas);this.camera={x:0,y:0};this.selected='1,0';this.blueprint='pulse';this.hover=null;this.showPower=true;}
    syncView(game){this.camera={...game.camera};this.selected=game.selected;}
    local(p){return{x:p.x-this.camera.x+500,y:p.y-this.camera.y+320};}
    position(clientX,clientY){const r=this.canvas.getBoundingClientRect();return{x:(clientX-r.left-this.offsetX)/this.scale+this.camera.x-500,y:(clientY-r.top-this.offsetY)/this.scale+this.camera.y-320};}
    pick(clientX,clientY){const p=this.position(clientX,clientY),q=Math.round(p.x/F.cell),r=Math.round(p.y/F.cell);return C.cell(C.key(q,r))?C.key(q,r):null;}
    viewport(){const rect=this.canvas.getBoundingClientRect(),vw=Number.isFinite(root.innerWidth)?root.innerWidth:Infinity,vh=Number.isFinite(root.innerHeight)?root.innerHeight:Infinity,left=Math.max(0,-rect.left-this.offsetX)/this.scale,top=Math.max(0,-rect.top-this.offsetY)/this.scale,right=Math.min(1000,(vw-rect.left-this.offsetX)/this.scale),bottom=Math.min(640,(vh-rect.top-this.offsetY)/this.scale);return{x:this.camera.x-500+left,y:this.camera.y-320+top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};}
    line(a,b,color,width=1){const c=this.ctx,p=this.local(a),q=this.local(b);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}
    circle(p,r,color,fill=false){const c=this.ctx,l=this.local(p);c.beginPath();c.arc(l.x,l.y,r,0,Math.PI*2);if(fill){c.fillStyle=color;c.fill();}else{c.strokeStyle=color;c.lineWidth=1;c.stroke();}}
    draw(game){
      this.syncView(game);const c=this.ctx,view=this.viewport(),full={x:this.camera.x-500,y:this.camera.y-320,width:1000,height:640};
      c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#080f18';c.fillRect(0,0,this.width,this.height);c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);c.save();c.beginPath();c.rect(0,0,1000,640);c.clip();
      this.background(game);
      if(this.showPower){for(const t of game.allBuildings())if((t.type==='core'||t.type==='pylon')&&t.connected&&TC.effectVisible({kind:'burst',...t,radius:F.serviceRange},full))this.circle(t,F.serviceRange,'#72dce80b',true);
        for(const link of game.network.links)if(TC.effectVisible({x:link.a.x,y:link.a.y,toX:link.b.x,toY:link.b.y},full)){c.setLineDash(link.b.powered?[]:[5,7]);this.line(link.a,link.b,link.b.powered?'#65cddd99':'#f2ad7080',link.b.type==='pylon'?2:1);c.setLineDash([]);}}
      const selection=C.cell(game.selected),t=game.tower(game.selected);
      if(selection){const l=this.local(selection);if(t){const def=C.definition(t),range=def.kind==='tower'?game.stats(t).range:t.type==='pylon'?F.relayRange:t.type==='regen'?F.repairRange:0;if(range)this.circle(t,range,'#e4f28a70');}
        else if(this.blueprint==='pylon'){this.circle(selection,F.relayRange,'#82e6f54a');this.circle(selection,F.serviceRange,'#82e6f530',true);}
        else if(this.blueprint==='regen')this.circle(selection,F.repairRange,'#8ff0b24a');
        c.strokeStyle=t||(!game.canBuild(game.selected,this.blueprint)&&game.credits.gte(game.buildCost(game.selected,this.blueprint)))?'#e4f28a':'#ff8ca5';c.lineWidth=2;c.strokeRect(l.x-29,l.y-29,58,58);}
      const quote=this.lineStart?game.lineQuote(this.lineStart,game.selected,this.blueprint):null,valid=quote&&!quote.reason&&game.credits.gte(quote.price);
      if(quote)for(const slot of quote.slots){const p=this.local(C.cell(slot));c.fillStyle=valid?'#8ff0b230':'#ff8ca530';c.fillRect(p.x-27,p.y-27,54,54);c.strokeStyle=valid?'#8ff0b2':'#ff8ca5';c.strokeRect(p.x-27,p.y-27,54,54);}
      for(const b of game.allBuildings())if(TC.effectVisible({kind:'burst',...b,radius:50},full))this.building(b,game.time);
      for(const e of game.enemies)if(TC.effectVisible({kind:'burst',...e,radius:e.radius+14},view))this.enemy(e);
      for(const e of game.effects)if(TC.effectVisible(e,view))this.effect(e);
      this.radar(game);c.fillStyle='#08121de8';c.fillRect(10,8,quote?880:260,quote?58:28);c.fillStyle='#d3e1eb';c.font='14px monospace';c.textAlign='left';c.fillText(`ПОЛЕ / ${Math.round(this.camera.x/60)}, ${Math.round(this.camera.y/60)}`,18,27);
      if(quote){c.fillStyle=valid?'#8ff0b2':'#ff8ca5';c.fillText(quote.reason||`ЛИНИЯ: ${quote.slots.length} блоков · ${quote.price.format()} очков · ${valid?'подтверди в панели':'недостаточно очков'}`,18,52);}
      if(game.phase==='ready'){c.fillStyle='#0a172be8';c.fillRect(240,570,520,48);c.fillStyle='#e4f28a';c.textAlign='center';c.font='16px monospace';c.fillText('ПОДГОТОВКА · строй сеть и запускай волну',500,600);}
      if(game.paused||game.phase==='repair'){c.fillStyle='#07101ac9';c.fillRect(0,265,1000,90);c.fillStyle='#edf3f8';c.font='bold 22px monospace';c.textAlign='center';c.fillText(game.paused?'ПАУЗА':`ВОССТАНОВЛЕНИЕ ЯДРА · ${Math.ceil(game.timer)} с`,500,316);}
      c.restore();c.setTransform(this.dpr,0,0,this.dpr,0,0);
    }
    background(game){const c=this.ctx;c.fillStyle='#0a1420';c.fillRect(0,0,1000,640);const q0=Math.floor((this.camera.x-500)/60),r0=Math.floor((this.camera.y-320)/60);
      // Cell borders now match block footprints; only visible terrain is sampled.
      for(let q=q0;q<=q0+18;q++)for(let r=r0;r<=r0+12;r++){const p=this.local({x:q*60,y:r*60}),t=game.terrainAt(C.key(q,r));if(!t)continue;c.fillStyle=t.color;c.fillRect(p.x-30,p.y-30,60,60);c.strokeStyle=t.detail;c.lineWidth=.6;c.strokeRect(p.x-30,p.y-30,60,60);c.lineWidth=1;
        if(t.id==='floor'){c.strokeRect(p.x-24,p.y-24,48,48);c.fillStyle=t.detail;for(const x of [-20,18])for(const y of [-20,18])c.fillRect(p.x+x,p.y+y,2,2);}
        else if(t.id==='slag'){for(let y=-16;y<=16;y+=16){c.beginPath();c.moveTo(p.x-20,p.y+y);c.lineTo(p.x+18,p.y+y+4);c.stroke();}}
        else if(t.id==='rubble'){polygon(c,p.x-10,p.y+5,12,5,F.hash(q,r));c.stroke();polygon(c,p.x+13,p.y-12,8,4);c.stroke();}
        else if(F.hash(q,r)<.35){c.beginPath();c.moveTo(p.x-18,p.y-8);c.lineTo(p.x+3,p.y+6);c.lineTo(p.x+15,p.y+4);c.stroke();}
      }
    }
    building(t,time){const c=this.ctx,p=this.local(t),def=C.definition(t),color=t.powered?def.color:'#82909c';c.save();c.translate(p.x,p.y);c.fillStyle='#0a1420';c.strokeStyle=color;c.lineWidth=1.8;
      if(t.type==='wall'){c.fillStyle='#253442';c.fillRect(-28,-28,56,56);c.strokeRect(-28,-28,56,56);for(let i=-18;i<22;i+=12){c.beginPath();c.moveTo(i,-22);c.lineTo(i,22);c.stroke();}}
      else if(t.type==='core'){polygon(c,0,0,30,6,Math.PI/6);c.fill();c.stroke();polygon(c,0,0,19,6,Math.PI/6);c.stroke();c.fillStyle=color;c.fillRect(-6,-10,12,20);}
      else if(t.type==='pylon'){polygon(c,0,0,17,4,Math.PI/4);c.fill();c.stroke();c.beginPath();c.moveTo(0,15);c.lineTo(0,-22);c.moveTo(-12,-8);c.lineTo(12,-8);c.stroke();c.fillStyle=color;c.fillRect(-3,-25,6,6);}
      else if(t.type==='generator'){c.fillStyle='#312b24';c.fillRect(-24,-22,48,44);c.strokeRect(-24,-22,48,44);polygon(c,0,0,13,6,this.reduced?0:(t.powered?time*1.25:0));c.stroke();c.fillStyle=color;for(let i=-16;i<=16;i+=8)c.fillRect(i,-28,3,5);}
      else if(t.type==='regen'){polygon(c,0,0,24,6);c.fill();c.stroke();c.fillStyle=color;c.fillRect(-3,-13,6,26);c.fillRect(-13,-3,26,6);}
      else{polygon(c,0,0,25,6,Math.PI/6);c.fill();c.stroke();Base.icon(c,t.type,0,0,20,color,t.angle);if(t.evolution){polygon(c,0,0,28,6,Math.PI/6);c.stroke();}}
      if(!t.powered&&t.type!=='wall'){c.strokeStyle='#ffb0bd';c.lineWidth=2;c.beginPath();c.moveTo(-13,-13);c.lineTo(13,13);c.moveTo(13,-13);c.lineTo(-13,13);c.stroke();}
      const ratio=t.hp.ratio(t.maxHp);c.fillStyle='#3a2933';c.fillRect(-24,32,48,4);c.fillStyle=ratio<.3?'#ffb0bd':color;c.fillRect(-24,32,48*ratio,4);if(t.level>1){c.fillStyle='#edf3f8';c.textAlign='center';c.font='11px monospace';c.fillText(`LV ${t.level}`,0,-34);}c.restore();
    }
    enemy(e){const c=this.ctx,p=this.local(e);c.save();c.translate(p.x,p.y);c.rotate(e.angle||0);c.fillStyle='#301a2b';c.strokeStyle=e.slowTime>0?'#a4d4ff':e.color;c.lineWidth=e.boss?3:1.5;polygon(c,0,0,e.radius,e.boss?8:e.type==='runner'?3:e.type==='shield'?6:4);c.fill();c.stroke();c.restore();if(e.hp.ratio(e.maxHp)<.99){c.fillStyle='#382632';c.fillRect(p.x-12,p.y-e.radius-8,24,3);c.fillStyle=e.color;c.fillRect(p.x-12,p.y-e.radius-8,24*e.hp.ratio(e.maxHp),3);}}
    effect(e){const p=this.local(e),q=e.toX===undefined?null:this.local({x:e.toX,y:e.toY});super.effect({...e,x:p.x,y:p.y,toX:q?.x,toY:q?.y});}
    radar(game){const c=this.ctx;for(let oct=0;oct<8;oct++){const enemies=game.enemies.filter(e=>((Math.round(Math.atan2(e.y-this.camera.y,e.x-this.camera.x)/(Math.PI/4))+8)%8)===oct);if(!enemies.length)continue;const a=oct*Math.PI/4,x=500+Math.cos(a)*465,y=320+Math.sin(a)*280;c.fillStyle='#ffb0bd';polygon(c,x,y,7,3,a);c.fill();c.font='12px monospace';c.textAlign='center';c.fillText(String(enemies.length),x-Math.cos(a)*17,y-Math.sin(a)*17+4);}}
  }
  const api={Renderer};root.FieldRender=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
