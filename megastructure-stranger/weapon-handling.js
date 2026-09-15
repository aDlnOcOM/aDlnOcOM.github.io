(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fallback={ergonomics:72,mass:2.3,recoil:.13,modes:['auto','semi'],condition:100,penetration:.12};
  function profile(stats){return stats?.weaponProfile||fallback;}
  function init(player,stats){
    const p=profile(stats);
    return player.handling||= {ads:0,recoil:0,heat:0,overheated:false,trigger:false,mode:p.modes[0],moving:0,spread:stats?.spread||.055,aiming:false};
  }
  function tick(player,stats,delta,input={}){
    const p=profile(stats),h=init(player,stats),dt=clamp(Number.isFinite(delta)?delta:0,0,.1);
    h.aiming=Boolean(input.aim&&player.weapon!=='knife'&&!player.reload&&!input.refilling&&!(player.dash?.remaining>0));
    const adsTime=.16+(100-p.ergonomics)*.006;
    h.ads=clamp(h.ads+(h.aiming?1:-1)*dt/adsTime,0,1);
    h.recoil=Math.max(0,h.recoil-dt*(.3+p.ergonomics*.008));
    h.heat=Math.max(0,h.heat-dt*.18);
    if(h.overheated&&h.heat<.4)h.overheated=false;
    h.moving=clamp(input.moving||0,0,1);
    h.spread=Math.max(.002,(stats.spread||.035)*(1-h.ads*.65)*(1+h.moving*.9)+h.recoil*.085+(100-clamp(p.condition,0,100))*.0003);
    if(!input.fire)h.trigger=false;
    return h;
  }
  function canFire(player,stats){const h=init(player,stats);return !h.overheated&&!(player.dash?.remaining>0)&&(h.mode!=='semi'||!h.trigger);}
  function fired(player,stats){
    const p=profile(stats),h=init(player,stats);h.trigger=true;
    h.recoil=clamp(h.recoil+p.recoil*(1-h.ads*.35),0,1.5);
    h.heat=clamp(h.heat+.038*(1+(100-p.condition)/100),0,1);
    if(h.heat>=1)h.overheated=true;
  }
  function cycle(player,stats){
    const h=init(player,stats),modes=profile(stats).modes;
    h.mode=modes[(modes.indexOf(h.mode)+1)%modes.length];h.trigger=true;return h.mode;
  }
  function speed(player){return 1-(player.handling?.ads||0)*.38;}
  function label(player){const h=player.handling;return !h?'':h.overheated?'ПЕРЕГРЕВ · ОХЛАЖДЕНИЕ':(h.mode==='semi'?'ОДИНОЧНЫЙ':'АВТО')+' · '+(h.ads>.7?'ПРИЦЕЛ':'ОТ БЕДРА');}
  window.WeaponHandling={profile,init,tick,canFire,fired,cycle,speed,label};
})();
