(function(root){
  'use strict';
  const D=root.TDData||require('./td-data.js'),C=root.TDCore||require('./td-core.js');
  function polygon(ctx,x,y,r,sides,rotation=0){ctx.beginPath();for(let i=0;i<sides;i++){const a=rotation+i*Math.PI*2/sides;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
  function line(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();}
  function icon(ctx,type,x,y,size,color,angle=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;
    if(type==='pulse'){ctx.strokeRect(-size*.45,-size*.38,size*.9,size*.76);ctx.fillRect(0,-size*.12,size*.9,size*.24);}
    else if(type==='arc'){line(ctx,[[-size*.5,0],[-size*.1,-size*.45],[0,-size*.12],[size*.5,-size*.35],[size*.1,size*.5],[0,size*.1],[-size*.5,size*.3]]);}
    else if(type==='frost'){for(let i=0;i<3;i++){ctx.rotate(Math.PI/3);line(ctx,[[-size*.65,0],[size*.65,0]]);}polygon(ctx,0,0,size*.3,6);ctx.stroke();}
    else if(type==='plasma'){polygon(ctx,0,0,size*.65,4,Math.PI/4);ctx.stroke();ctx.beginPath();ctx.arc(0,0,size*.25,0,Math.PI*2);ctx.fill();}
    else if(type==='rail'){ctx.fillRect(-size*.35,-size*.29,size*1.25,size*.14);ctx.fillRect(-size*.35,size*.15,size*1.25,size*.14);ctx.strokeRect(-size*.65,-size*.35,size*.35,size*.7);}
    else{polygon(ctx,0,0,size*.65,6,Math.PI/6);ctx.stroke();ctx.beginPath();ctx.arc(0,0,size*.2,0,Math.PI*2);ctx.fill();for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ctx.fillRect(Math.cos(a)*size*.85-1.5,Math.sin(a)*size*.85-1.5,3,3);}}
    ctx.restore();
  }
  class Renderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('Canvas 2D недоступен');this.selected=0;this.hover=-1;this.segment=0;this.segmentCount=1;this.reduced=false;this.resize();}
    resize(){const rect=this.canvas.getBoundingClientRect();this.width=rect.width||1000;this.height=rect.height||640;this.dpr=Math.min(2,root.devicePixelRatio||1);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.scale=Math.min(this.width/1000,this.height/640);this.offsetX=(this.width-1000*this.scale)/2;this.offsetY=(this.height-640*this.scale)/2;}
    position(clientX,clientY){const r=this.canvas.getBoundingClientRect();return{x:(clientX-r.left-this.offsetX)/this.scale+this.segment*D.width,y:(clientY-r.top-this.offsetY)/this.scale};}
    pick(clientX,clientY){const p=this.position(clientX,clientY);if(p.x<this.segment*D.width||p.x>(this.segment+1)*D.width||p.y<0||p.y>D.height)return-1;for(let i=0;i<D.pads.length;i++){const slot=this.segment*D.pads.length+i;if(C.dist(p,C.pointPad(slot))<34)return slot;}return-1;}
    syncView(game){this.segment=game.viewSegment;this.segmentCount=game.segmentCount;}
    // Intersect the canvas clip with the browser viewport, including page scroll / zoom.
    viewport(){const rect=this.canvas.getBoundingClientRect(),vw=Number.isFinite(root.innerWidth)?root.innerWidth:Infinity,vh=Number.isFinite(root.innerHeight)?root.innerHeight:Infinity;
      const left=Math.max(0,-rect.left-this.offsetX)/this.scale,top=Math.max(0,-rect.top-this.offsetY)/this.scale,right=Math.min(D.width,(vw-rect.left-this.offsetX)/this.scale),bottom=Math.min(D.height,(vh-rect.top-this.offsetY)/this.scale);
      return{x:this.segment*D.width+left,y:top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};}
    draw(game){
      this.syncView(game);const view=this.viewport();
      const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#070e16';ctx.fillRect(0,0,this.width,this.height);ctx.translate(this.offsetX,this.offsetY);ctx.scale(this.scale,this.scale);
      ctx.save();ctx.beginPath();ctx.rect(0,0,1000,640);ctx.clip();this.background(game);ctx.save();this.connections(game);
      const selected=game.tower(this.selected);
      if(selected){const s=game.stats(selected);ctx.fillStyle=`${s.color}08`;ctx.strokeStyle=`${s.color}42`;ctx.lineWidth=1;ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(selected.x-this.segment*D.width,selected.y,s.range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);}
      for(let i=0;i<D.pads.length;i++)this.pad(game,this.segment*D.pads.length+i);
      if(this.segment===game.segmentCount-1)this.base(game);
      for(const enemy of game.enemies)if(C.effectVisible({...enemy,kind:'burst',radius:enemy.radius+15},view))this.enemy(enemy,game.time);
      for(const effect of game.effects)if(view.width>0&&view.height>0&&C.effectVisible(effect,view))this.effect(effect);
      ctx.restore();ctx.textAlign='left';ctx.fillStyle='#c4d3df';ctx.font='15px monospace';ctx.fillText(`СЕГМЕНТ ${this.segment+1} / ${game.segmentCount}`,25,30);
      if((this.segment+1)%5===0){ctx.fillStyle='#e3ed8c';ctx.fillText(`КОНТРОЛЬНАЯ ТОЧКА ${(this.segment+1)/5}`,25,52);}
      ctx.textAlign='right';ctx.fillStyle='#c4d3df';ctx.fillText(`УЗЛЫ ${game.visibleTowers().filter(Boolean).length} / 12`,973,30);
      if(game.phase==='ready'||game.phase==='repair'){
        ctx.textAlign='center';ctx.fillStyle='#07121ce8';ctx.fillRect(315,275,370,85);ctx.strokeStyle=game.phase==='repair'?'#ff667e':'#d6ec65';ctx.lineWidth=1;ctx.strokeRect(315,275,370,85);
        ctx.font='bold 17px monospace';ctx.fillStyle=game.phase==='repair'?'#ff8f9e':'#d6ec65';ctx.fillText(game.phase==='repair'?`ВОССТАНОВЛЕНИЕ ${Math.ceil(game.timer)} С`:'ОЖИДАНИЕ ПРОТОКОЛА',500,310);
        ctx.font='14px monospace';ctx.fillStyle='#c4d3df';ctx.fillText(game.phase==='repair'?'Башни и накопления сохранены':'Выбери башню → установи → запусти',500,335);
      }
      if(game.paused){ctx.fillStyle='#060b1380';ctx.fillRect(0,0,1000,640);ctx.textAlign='center';ctx.font='bold 28px monospace';ctx.fillStyle='#e9f4d7';ctx.fillText('ПАУЗА',500,310);}
      ctx.restore();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    }
    background(game){
      const ctx=this.ctx;ctx.fillStyle='#09141f';ctx.fillRect(0,0,1000,640);ctx.lineWidth=.65;ctx.strokeStyle='#132330';
      ctx.beginPath();for(let x=0;x<=1000;x+=40){ctx.moveTo(x,0);ctx.lineTo(x,640);}for(let y=0;y<=640;y+=40){ctx.moveTo(0,y);ctx.lineTo(1000,y);}ctx.stroke();
      // Architectural footprints are vector-only, with no external raster assets.
      const buildings=[[45,48,125,47],[290,45,170,65],[510,55,50,120],[700,45,245,40],[45,500,175,83],[295,510,50,95],[585,390,84,54],[825,405,120,56],[365,250,75,40],[32,270,40,55]];
      for(const [x,y,w,h]of buildings){ctx.fillStyle='#0c1c28';ctx.fillRect(x+5,y+6,w,h);ctx.strokeStyle='#1c3544';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);ctx.fillStyle='#102432';ctx.fillRect(x+6,y+6,w-12,h-12);ctx.fillStyle='#24424e';for(let wx=x+12;wx<x+w-8;wx+=14)ctx.fillRect(wx,y+12,5,2);ctx.strokeStyle='#17313e';line(ctx,[[x+6,y+h-10],[x+w-6,y+h-10]]);}
      ctx.save();if(this.segment%2){ctx.translate(0,660);ctx.scale(1,-1);}
      ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#1e3341';ctx.lineWidth=45;line(ctx,D.path);ctx.strokeStyle='#101e2a';ctx.lineWidth=40;line(ctx,D.path);
      ctx.strokeStyle='#45605d';ctx.lineWidth=1.5;ctx.setLineDash([4,10]);line(ctx,D.path);ctx.setLineDash([]);
      const shift=this.reduced?0:game.time*22%140;
      for(let p=50+shift;p<C.pathLength;p+=140){const a=C.pointAt(p),b=C.pointAt(p+2),angle=Math.atan2(b.y-a.y,b.x-a.x);ctx.save();ctx.translate(a.x,a.y);ctx.rotate(angle);ctx.strokeStyle='#84a75d77';ctx.lineWidth=1.5;line(ctx,[[-4,-4],[0,0],[-4,4]]);ctx.restore();}
      ctx.restore();ctx.lineCap='butt';ctx.textAlign='left';ctx.font='14px monospace';ctx.fillStyle='#ff9eb5';ctx.fillText(this.segment?'← ПРЕДЫДУЩИЙ':'ВХОД ВРАГОВ →',12,this.segment%2?486:106);ctx.fillStyle='#d3edaa';ctx.fillText(this.segment===game.segmentCount-1?'ЯДРО →':'ПУТЬ ДАЛЬШЕ →',825,this.segment%2?110:490);
    }
    connections(game){
      const ctx=this.ctx;for(const link of game.links(true)){const selected=link.a.slot===this.selected||link.b.slot===this.selected;ctx.strokeStyle=selected?'#cbe76995':'#82b88735';ctx.lineWidth=selected?1.5:1;ctx.setLineDash([4,6]);line(ctx,[[link.a.x-this.segment*D.width,link.a.y],[link.b.x-this.segment*D.width,link.b.y]]);ctx.setLineDash([]);const x=(link.a.x+link.b.x)/2-this.segment*D.width,y=(link.a.y+link.b.y)/2;polygon(ctx,x,y,4,4);ctx.fillStyle=selected?'#cbe769':'#537b67';ctx.fill();}
    }
    pad(game,i){
      const ctx=this.ctx,point=C.pointPad(i),x=point.x-this.segment*D.width,y=point.y,t=game.tower(i),selected=this.selected===i,hover=this.hover===i;
      ctx.fillStyle='#07111c';polygon(ctx,x,y,27,6,Math.PI/6);ctx.fill();ctx.lineWidth=selected?2:1;ctx.strokeStyle=selected?'#ddf46d':hover?'#8daec1':t?D.towers[t.type].color+'75':'#2c4858';ctx.stroke();
      if(!t){ctx.strokeStyle=hover?'#dfedc4':'#456376';ctx.lineWidth=1;line(ctx,[[x-6,y],[x+6,y]]);line(ctx,[[x,y-6],[x,y+6]]);ctx.fillStyle='#b8c9d9';ctx.font='14px monospace';ctx.textAlign='center';ctx.fillText(`${i+1}`.padStart(2,'0'),x,y>570?y-38:y+40);return;}
      const s=D.towers[t.type];ctx.shadowBlur=this.reduced?0:8;ctx.shadowColor=s.color;icon(ctx,t.type,x,y,23,s.color,t.type==='pulse'||t.type==='rail'?t.angle:0);ctx.shadowBlur=0;
      if(t.evolution){ctx.strokeStyle=s.color;ctx.lineWidth=1;polygon(ctx,x,y,31,6,Math.PI/6);ctx.stroke();for(let k=0;k<3;k++){polygon(ctx,x-8+k*8,y-37,2.5,4);ctx.fillStyle=s.color;ctx.fill();}}
      if(t.flash>0&&!this.reduced){ctx.strokeStyle=s.color+'70';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,28+(1-t.flash/.16)*10,0,Math.PI*2);ctx.stroke();}
      const labelY=y>570?y-44:y+44;ctx.fillStyle='#07111de8';ctx.fillRect(x-32,labelY-14,64,20);ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillStyle=selected?'#ecf8bf':'#aac4ce';ctx.fillText(`LV ${t.level}`,x,labelY);
    }
    base(game){
      const ctx=this.ctx,point=C.pointAt(game.totalPathLength-31,game.segmentCount),x=point.x-this.segment*D.width,y=point.y;ctx.fillStyle='#112e32';polygon(ctx,x,y,30,6,Math.PI/6);ctx.fill();ctx.strokeStyle=game.hp/game.maxHp<.3?'#ff6886':'#d6ed6e';ctx.lineWidth=2;ctx.stroke();polygon(ctx,x,y,18,6,Math.PI/6);ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(x-5,y-9,10,18);ctx.strokeStyle='#365249';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,38,-Math.PI/2,Math.PI*1.5);ctx.stroke();ctx.strokeStyle=game.hp/game.maxHp<.3?'#ff6886':'#c6e96e';ctx.beginPath();ctx.arc(x,y,38,-Math.PI/2,-Math.PI/2+Math.PI*2*game.hp/game.maxHp);ctx.stroke();
    }
    enemy(e,time){
      const ctx=this.ctx,x=e.x-this.segment*D.width;ctx.save();ctx.translate(x,e.y);const next=C.pointAt(e.progress+2,this.segmentCount);ctx.rotate(Math.atan2(next.y-e.y,next.x-e.x));ctx.fillStyle=e.flash>0?'#ffe7ec':'#231525';ctx.strokeStyle=e.slowTime>0?'#9dcfff':e.color;ctx.lineWidth=e.boss?2:1.5;
      polygon(ctx,0,0,e.radius,e.type==='runner'?3:e.type==='shield'?6:e.boss?8:4,e.type==='runner'?0:Math.PI/4);ctx.fill();ctx.stroke();
      if(e.type==='shield'||e.boss){polygon(ctx,0,0,e.radius+4,e.boss?8:6);ctx.strokeStyle=e.color+'70';ctx.stroke();}
      ctx.fillStyle=e.color;ctx.fillRect(-2,-2,4,4);if(e.burnTime>0){ctx.strokeStyle='#ffaf66';ctx.beginPath();ctx.arc(0,0,e.radius+5,time*3,time*3+4.5);ctx.stroke();}ctx.restore();
      if(e.hp.ratio(e.maxHp)<.99||e.boss){const width=e.boss?48:20;ctx.fillStyle='#10222b';ctx.fillRect(x-width/2,e.y-e.radius-12,width,3);ctx.fillStyle=e.color;ctx.fillRect(x-width/2,e.y-e.radius-12,width*e.hp.ratio(e.maxHp),3);}
    }
    effect(source){
      const offset=this.segment*D.width,e={...source,x:source.x-offset,toX:source.toX===undefined?undefined:source.toX-offset};
      const ctx=this.ctx;if(this.reduced&&e.kind==='burst')return;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.strokeStyle=e.color;ctx.lineWidth=e.kind==='rail'?3:1.5;
      if(e.kind==='burst'){polygon(ctx,e.x,e.y,e.radius*(1-e.life/e.max*.7),8,Math.PI/8);ctx.stroke();}
      else if(e.kind==='arc'){const dx=e.toX-e.x,dy=e.toY-e.y,length=Math.hypot(dx,dy)||1;const points=[[e.x,e.y]];for(let i=1;i<5;i++){const zig=(i%2?1:-1)*6;points.push([e.x+dx*i/5-dy/length*zig,e.y+dy*i/5+dx/length*zig]);}points.push([e.toX,e.toY]);line(ctx,points);}
      else line(ctx,[[e.x,e.y],[e.toX,e.toY]]);ctx.globalAlpha=1;
    }
  }
  const api={Renderer,icon,polygon};root.TDRender=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
