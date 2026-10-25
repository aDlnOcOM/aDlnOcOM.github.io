(function(root){
  'use strict';
  const D=root.TowerData||require('./tower-data.js');
  function polygon(c,x,y,r,n,angle=0){c.beginPath();for(let i=0;i<n;i++){const a=angle+i*Math.PI*2/n;i?c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r):c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}c.closePath();}
  class Renderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('Canvas 2D недоступен');this.resize();}
    resize(){const rect=this.canvas.getBoundingClientRect();this.width=rect.width||720;this.height=rect.height||720;this.dpr=Math.min(2,root.devicePixelRatio||1);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.scale=Math.min(this.width,this.height)/720;this.ox=(this.width-720*this.scale)/2;this.oy=(this.height-720*this.scale)/2;}
    visible(x,y,r=0){const rect=this.canvas.getBoundingClientRect(),px=rect.left+this.ox+(x+360)*this.scale,py=rect.top+this.oy+(y+360)*this.scale,vw=root.innerWidth??Infinity,vh=root.innerHeight??Infinity;return px+r*this.scale>=0&&py+r*this.scale>=0&&px-r*this.scale<=vw&&py-r*this.scale<=vh;}
    draw(game){const c=this.ctx,r=game.run,s=r?.active||(r?.phase==='prepare'?game.score():null),time=game.reduced?0:r?.time||0;
      c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#081314';c.fillRect(0,0,this.width,this.height);c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);c.save();c.beginPath();c.rect(0,0,720,720);c.clip();c.translate(360,360);
      c.strokeStyle='#193032';c.lineWidth=1;for(let x=-360;x<=360;x+=40){c.beginPath();c.moveTo(x,-360);c.lineTo(x,360);c.moveTo(-360,x);c.lineTo(360,x);c.stroke();}
      for(const radius of [90,180,270,330]){c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.strokeStyle=radius===330?'#42615a':'#2b4540';c.stroke();}
      c.setLineDash([3,8]);c.strokeStyle='#91e4bf55';c.beginPath();c.arc(0,0,s?.range||225,0,Math.PI*2);c.stroke();c.setLineDash([]);
      c.strokeStyle='#e4cf9240';c.lineWidth=2;c.beginPath();c.arc(0,0,305,time*.12,time*.12+Math.PI*.22);c.stroke();
      for(const e of r?.enemies||[]){if(!this.visible(e.x,e.y,30))continue;const def=D.enemies[e.type];c.fillStyle='#38202b';c.strokeStyle=def.color;c.lineWidth=e.type==='boss'?3:2;polygon(c,e.x,e.y,def.radius,def.sides,Math.atan2(e.y,e.x)+time*.1);c.fill();c.stroke();if(e.hp.ratio(e.maxHp)<.99){c.fillStyle='#512d38';c.fillRect(e.x-14,e.y-def.radius-10,28,3);c.fillStyle=def.color;c.fillRect(e.x-14,e.y-def.radius-10,28*e.hp.ratio(e.maxHp),3);}}
      for(const e of game.effects){if(!this.visible(e.x,e.y,40)&&!this.visible(e.toX||e.x,e.toY||e.y,40))continue;c.globalAlpha=Math.max(0,e.life/e.max);c.strokeStyle=e.color;c.lineWidth=2;if(e.kind==='beam'){c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.toX,e.toY);c.stroke();}else{c.beginPath();c.arc(e.x,e.y,e.radius*(1-e.life/e.max)+3,0,Math.PI*2);c.stroke();}}c.globalAlpha=1;
      c.fillStyle='#142d2c';c.strokeStyle='#91e4bf';c.lineWidth=2;polygon(c,0,0,35,6,Math.PI/6);c.fill();c.stroke();polygon(c,0,0,23,6,-time*.1);c.stroke();c.fillStyle='#f4d995';polygon(c,0,0,10,4,Math.PI/4);c.fill();
      const target=r?.enemies?.find(e=>Math.hypot(e.x,e.y)<(s?.range||225)),angle=target?Math.atan2(target.y,target.x):-.5;c.save();c.rotate(angle);c.fillStyle='#c7eee1';c.fillRect(18,-4,29,8);c.restore();
      c.strokeStyle='#f4d995';c.lineWidth=4;c.beginPath();c.arc(0,0,45,-Math.PI/2,-Math.PI/2+Math.PI*2*(r?.phase==='battle'?r.hp.ratio(r.maxHp):1));c.stroke();
      if(!r||r.phase!=='battle'||r.paused){c.fillStyle='#071514e8';c.fillRect(-215,90,430,57);c.fillStyle='#e5eee4';c.textAlign='center';c.font='18px monospace';const text=!r?'СОБЕРИТЕ СВОЙ СИГНАЛ':r.paused?'ПАУЗА':({prepare:'ВЫБЕРИТЕ РУКУ И ЗАПУСТИТЕ БЛАЙНД',shop:'МАГАЗИН ОТКРЫТ',victory:'АНТЕ 8 // ПОБЕДА',lost:'СИГНАЛ ПОТЕРЯН',retired:'ЗАБЕГ ЗАВЕРШЁН'})[r.phase];c.fillText(text,0,124);}
      c.restore();c.setTransform(this.dpr,0,0,this.dpr,0,0);
    }
  }
  const api={Renderer,polygon};root.TowerRender=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
