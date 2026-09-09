(() => {
  "use strict";
  const points = [
    {id:'generator',name:'Генератор',x:150,y:110}, {id:'battery',name:'Аккумуляторы',x:350,y:110},
    {id:'solder',name:'Паяльная станция',x:550,y:110}, {id:'mill',name:'Фрезер ЧПУ',x:750,y:110},
    {id:'forming',name:'Металлоформовка',x:750,y:390}, {id:'implants',name:'Нейротерминал',x:150,y:390},
    {id:'storage',name:'Склад',x:350,y:390}, {id:'equipment',name:'Экипировка',x:550,y:390},
    {id:'exit',name:'Выход в забег',x:880,y:250},
    {id:'research',name:'Стол исследований',x:80,y:250}
  ];
  function nearest(player) { return points.filter(point => Math.hypot(point.x-player.x,point.y-player.y)<96).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0]; }
  function unstick(player,levels) {
    for(const point of points)if(levels[point.id]>0&&Math.abs(player.x-point.x)<53&&Math.abs(player.y-point.y)<39)player.y=point.y+(point.y<250?55:-55);
  }
  function move(player, keys, delta, levels) {
    let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    let y=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
    const length=Math.hypot(x,y); if(!length)return;
    x=x/length*190*Math.min(delta,.05);y=y/length*190*Math.min(delta,.05);
    const blocked=(px,py)=>points.some(point=>(levels[point.id]>0||['implants','storage','equipment','exit'].includes(point.id))&&Math.abs(px-point.x)<53&&Math.abs(py-point.y)<39);
    const nx=Math.max(42,Math.min(918,player.x+x)),ny=Math.max(42,Math.min(458,player.y+y));
    if(!blocked(nx,player.y))player.x=nx;
    if(!blocked(player.x,ny))player.y=ny;
    player.angle=Math.atan2(y,x);player.step=(player.step||0)+delta*12;
  }
  const api={points,nearest,move,unstick};window.ShelterLocation=api;
  if(typeof document==='undefined')return;
  const get=id=>document.getElementById(id),canvas=get('shelter-canvas');if(!canvas)return;
  const context=canvas.getContext('2d'),keys=new Set(),player={x:470,y:250,angle:0,step:0};
  const dialog=get('shelter-console');let active=false,frameId=null,last=0,levels={},selected=null;
  function close() { if(dialog.open)dialog.close(); keys.clear(); if(active)canvas.focus(); }
  function filterCards() {
    for(const card of get('hideout-facilities').children)card.hidden=card.dataset.facility!==selected;
  }
  function interact() {
    if(!active||dialog.open)return;
    const point=nearest(player);if(!point)return;
    keys.clear();selected=point.id;
    if(point.id==='research'){window.openShelterWorkshop?.();return;}
    if(point.id==='exit'){get('start-run').click();return;}
    if(point.id==='storage'||point.id==='equipment'){window.HideoutShell?.openService(point.id);return;}
    get('shelter-implants').hidden=point.id!=='implants';
    get('shelter-facility-panel').hidden=point.id==='implants';
    get('shelter-console-title').textContent=point.name;
    get('hideout-upgrade-status').textContent='';filterCards();dialog.showModal();get('shelter-console-close').focus();
  }
  api.refresh=progression=>{levels={...window.HideoutUpgrades.normalize(progression.hideout),research:progression.workshop?.table||0};unstick(player,levels);if(dialog.open)filterCards();};
  api.setActive=value=>{
    active=value;keys.clear();last=0;
    if(!active){if(frameId!==null)window.cancelAnimationFrame(frameId);frameId=null;close();}
    else if(frameId===null)frameId=window.requestAnimationFrame(frame);
  };
  function draw(time) {
    context.fillStyle='#080f14';context.fillRect(0,0,960,500);
    const light=context.createRadialGradient(475,245,30,475,245,530);light.addColorStop(0,'#243638');light.addColorStop(1,'#10191e');context.fillStyle=light;context.fillRect(25,25,910,450);
    window.GameAssets?.surface(context,'shelter',25,25,910,450);
    context.strokeStyle='#344247';context.lineWidth=1;
    for(let x=25;x<940;x+=48){context.beginPath();context.moveTo(x,25);context.lineTo(x,475);context.stroke();}
    for(let y=25;y<480;y+=48){context.beginPath();context.moveTo(25,y);context.lineTo(935,y);context.stroke();}
    context.fillStyle='#080d11';context.fillRect(26,27,906,15);context.fillRect(26,458,906,15);
    for(let x=90;x<900;x+=200){context.fillStyle='#a1c4b1';context.fillRect(x,30,70,3);}
    context.font='12px Consolas,monospace';context.textAlign='center';
    context.fillStyle='#5b7476';context.fillText('41 / СЛЕПАЯ ЗОНА · УБЕЖИЩЕ',470,225);
    const near=nearest(player);
    for(const point of points){
      const facility=window.HideoutUpgrades.facilities.find(item=>item.id===point.id)||(point.id==='research'?{color:'#89b8d0'}:null),level=levels[point.id]||0;
      const built=!facility||level>0;
      context.save();context.translate(point.x,point.y);
      context.strokeStyle=near===point?'#d8eac5':facility?.color||'#7da3a6';context.lineWidth=near===point?2:1;
      if(!built){context.setLineDash([6,5]);context.strokeRect(-40,-26,80,52);context.setLineDash([]);context.fillStyle='#708081';context.fillText('+',0,5);}
      else if(!window.GameAssets?.sprite(context,point.id==='exit'?'door':'props/'+point.id,0,0,94,80)){
        context.fillStyle='#050b0f';context.fillRect(-43,-26,88,59);context.fillStyle=facility?'#34464a':'#263a3b';context.fillRect(-40,-26,80,52);context.strokeRect(-40,-26,80,52);
        context.fillStyle='#0a181c';context.fillRect(-30,-17,40,30);context.fillStyle=facility?.color||'#a6cdbb';
        context.globalAlpha=.7+Math.sin(time*2+point.x)*.15;context.fillRect(-26,-13,32,3);
        for(let i=0;i<Math.max(1,level);i++)context.fillRect(19,-18+i*8,12,4);
        if(point.id==='mill'||point.id==='forming'){context.strokeRect(-25,-5,26,15);}
      }
      context.globalAlpha=1;context.fillStyle='#b4c9c6';context.fillText(point.name,0,49);
      if(facility){context.fillStyle=level?'#91b9a3':'#708387';context.fillText(level?'УРОВЕНЬ '+level:'МЕСТО ПОД УСТАНОВКУ',0,65);}
      context.restore();
    }
    context.save();context.translate(player.x,player.y);context.rotate(player.angle);
    context.fillStyle='#080c0e';context.beginPath();context.ellipse(3,5,15,10,0,0,Math.PI*2);context.fill();
    if(!window.GameAssets?.sprite(context,'actors/player',0,0,42,42+Math.sin(player.step)*2)){
      context.fillStyle='#7d9998';context.fillRect(-7,-11+Math.sin(player.step)*2,7,7);context.fillRect(-7,4-Math.sin(player.step)*2,7,7);
      context.fillStyle='#b4d8cb';context.fillRect(-7,-8,15,16);context.fillStyle='#314c50';context.fillRect(4,-5,7,10);
    }context.restore();
    const message=near?'E · '+near.name+(levels[near.id]===0?' — строительство':''):'WASD / стрелки — движение · Подойдите к объекту';
    if(get('shelter-prompt').textContent!==message)get('shelter-prompt').textContent=message;
    get('shelter-interact').disabled=!near;
  }
  function frame(time){frameId=null;if(!active)return;const delta=last?(time-last)/1000:0;last=time;if(!dialog.open)move(player,keys,delta,levels);draw(time/1000);frameId=window.requestAnimationFrame(frame);}
  canvas.addEventListener('keydown',event=>{
    if(!active||dialog.open)return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE'].includes(event.code)){event.preventDefault();event.stopPropagation();keys.add(event.code);if(event.code==='KeyE'&&!event.repeat)interact();}
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));
  window.addEventListener('blur',()=>keys.clear());canvas.addEventListener('blur',()=>keys.clear());
  canvas.addEventListener('pointerdown',()=>canvas.focus());
  get('shelter-interact').addEventListener('click',interact);get('shelter-console-close').addEventListener('click',close);
  dialog.addEventListener('close',()=>{keys.clear();if(active)canvas.focus();});
})();
