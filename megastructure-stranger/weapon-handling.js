(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fallback={ergonomics:72,mass:2.3,recoil:.13,modes:['auto','semi'],condition:100,penetration:.12};
  function profile(stats){return {...fallback,...stats?.weaponProfile};}
  function init(player,stats){
    const p=profile(stats);
    return player.handling||= {ads:0,recoil:0,heat:0,overheated:false,trigger:false,mode:p.modes[0],moving:0,spread:stats?.spread||.055,aiming:false,burstCount:0,jammed:false,clearing:0,feedStress:0};
  }
  function tick(player,stats,delta,input={}){
    const p=profile(stats),h=init(player,stats),dt=clamp(Number.isFinite(delta)?delta:0,0,.1);
    h.visual=p;
    if(h.clearing>0){if(player.dash?.remaining>0)h.clearing=0;else{h.clearing=Math.max(0,h.clearing-dt);if(!h.clearing){h.jammed=false;h.feedStress=0;h.trigger=true;}}}
    if(!p.modes.includes(h.mode)){h.mode=p.modes[0];h.burstCount=0;h.trigger=true;}
    h.aiming=Boolean(input.aim&&player.weapon!=='knife'&&!player.reload&&!input.refilling&&!player.treatment&&!(player.dash?.remaining>0));
    const adsTime=.16+(100-p.ergonomics)*.006+(p.aim||0);
    h.ads=clamp(h.ads+(h.aiming?1:-1)*dt/adsTime,0,1);
    h.recoil=Math.max(0,h.recoil-dt*(.3+p.ergonomics*.008));
    h.heat=Math.max(0,h.heat-dt*.18);
    if(h.overheated&&h.heat<.4)h.overheated=false;
    h.moving=clamp(input.moving||0,0,1);
    h.spread=Math.max(.002,(stats.spread||.035)*(1-h.ads*.65)*(1+h.moving*.9)+h.recoil*.085+(100-clamp(p.condition,0,100))*.0003+(p.hipSpread||0)*(1-h.ads));
    if(!input.fire){h.trigger=false;h.burstCount=0;}
    return h;
  }
  function canFire(player,stats){const h=init(player,stats);return !profile(stats).brokenPart&&!h.jammed&&!h.clearing&&!h.overheated&&!player.treatment&&!(player.dash?.remaining>0)&&(h.mode!=='semi'||!h.trigger)&&(h.mode!=='burst'||h.burstCount<3);}
  function fired(player,stats,heat=1){
    const p=profile(stats),h=init(player,stats);h.trigger=true;if(h.mode==='burst')h.burstCount++;
    h.recoil=clamp(h.recoil+p.recoil*(1-h.ads*.35),0,1.5);
    h.heat=clamp(h.heat+.038*(1+(100-p.condition)/100)*(p.heat||1)*heat,0,1);
    if(h.heat>=1)h.overheated=true;
    const stress=Math.max(0,(60-p.condition)/60)*.09+Math.max(0,(p.fouling||0)-35)*.001+Math.max(0,h.heat-.75)*.12;
    h.feedStress+=stress/Math.max(.5,p.reliability||1);
    if(h.feedStress>=1)h.jammed=true;
  }
  function cycle(player,stats){
    const h=init(player,stats),modes=profile(stats).modes;
    h.mode=modes[(modes.indexOf(h.mode)+1)%modes.length];h.trigger=true;h.burstCount=3;return h.mode;
  }
  function clear(player,stats){const h=init(player,stats);if(!h.jammed||h.clearing||player.reload||player.treatment||player.dash?.remaining>0)return false;h.clearing=1.8+(100-profile(stats).ergonomics)*.012;h.ads=0;return true;}
  function speed(player){return 1-(player.handling?.ads||0)*.38;}
  function label(player){const h=player.handling;return !h?'':h.visual?.brokenPart?'ДЕТАЛЬ СЛОМАНА · НУЖЕН РЕМОНТ':h.clearing?'УСТРАНЕНИЕ · '+h.clearing.toFixed(1)+' с':h.jammed?'ЗАДЕРЖКА ПОДАЧИ · J':h.overheated?'ПЕРЕГРЕВ · ОХЛАЖДЕНИЕ':(h.mode==='semi'?'ОДИНОЧНЫЙ':h.mode==='burst'?'ОТСЕЧКА 3':'АВТО')+' · '+(h.ads>.7?'ПРИЦЕЛ':'ОТ БЕДРА');}
  window.WeaponHandling={profile,init,tick,canFire,fired,cycle,clear,speed,label};
})();
