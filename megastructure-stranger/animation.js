(() => {
  'use strict';
  // Presentation state is deliberately separate from position, AI and save data.
  const states = new WeakMap();
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function state(entity) {
    if (!states.has(entity)) states.set(entity, {x:entity.x, y:entity.y, time:0, gait:0, moving:0, fire:0, melee:0, reload:0, reloadDuration:0});
    return states.get(entity);
  }
  function tick(entity, delta) {
    const a = state(entity), dt = clamp(Number.isFinite(delta) ? delta : 0, 0, .1);
    const travel = Math.hypot(entity.x-a.x, entity.y-a.y);
    a.x=entity.x; a.y=entity.y; a.time+=dt;
    // Teleports and collision-blocked input must not generate footsteps.
    const walking = dt>0 && travel>.01 && travel<100 && !(entity.dash?.remaining>0);
    if (walking) a.gait=(a.gait+travel*.15)%(Math.PI*2);
    a.moving+=(Number(walking)-a.moving)*Math.min(1,dt*18);
    for (const key of ['fire','melee','reload']) a[key]=Math.max(0,a[key]-dt);
    if (!(entity.reload>0)) a.reload=0;
    return a;
  }
  function trigger(entity, action, duration) {
    const a=state(entity);
    if (action==='fire') a.fire=.13;
    if (action==='melee') a.melee=duration||.25;
    if (action==='reload') a.reload=a.reloadDuration=Math.max(.01,duration||1);
  }
  function pose(entity, kind='player') {
    const a=state(entity), stationary=kind==='turret'||kind==='burstTurret';
    const stride=stationary?0:Math.sin(a.gait)*a.moving;
    const recoil=a.fire/.13;
    const swing=a.melee>0?Math.sin(clamp(1-a.melee/.25,0,1)*Math.PI):0;
    const reload=a.reload>0?Math.sin((1-a.reload/a.reloadDuration)*Math.PI):0;
    let lean=stride*.035-swing*.22, squash=1, offset=0;
    if(kind==='breaker') {
      if(entity.attackPhase==='windup'){offset=-3*(1-clamp(entity.phaseTime/.85,0,1));lean+=Math.sin(a.time*32)*.018;}
      if(entity.attackPhase==='charge'){squash=.89;offset=3;}
      if(entity.attackPhase==='recover'){squash=.96;offset=-2;}
    }
    return {time:a.time, stride, recoil, swing, reload, lean, squash, offset,
      breathe:stationary?0:Math.sin(a.time*2.4)*.008,
      flash:a.fire>.085, hit:entity.hitFlash>0};
  }
  // Rectangles are in the source SVG's 128×128 coordinate system.
  // Cut movable components out of the base before drawing them at their joints.
  function rig(ctx,id,width,height,parts=[]) {
    const assets=window.GameAssets;
    if (!assets) return false;
    ctx.save();ctx.scale(width/128,height/128);
    ctx.save();ctx.beginPath();ctx.rect(-64,-64,128,128);
    for(const p of parts)ctx.rect(p.x-64,p.y-64,p.w,p.h);
    ctx.clip('evenodd');const ready=assets.sprite(ctx,id,0,0,128,128);ctx.restore();
    if(ready)for(const p of parts){
      if(p.hidden)continue;
      ctx.save();ctx.translate(p.dx||0,p.dy||0);
      if(p.angle){ctx.translate(p.x+p.w/2-64,p.y+p.h/2-64);ctx.rotate(p.angle);ctx.translate(64-p.x-p.w/2,64-p.y-p.h/2);}
      ctx.beginPath();ctx.rect(p.x-64,p.y-64,p.w,p.h);ctx.clip();assets.sprite(ctx,id,0,0,128,128);ctx.restore();
    }
    ctx.restore();return ready;
  }
  function actor(ctx,entity,kind,size=42) {
    const p=pose(entity,kind), turret=kind==='turret'||kind==='burstTurret';
    const parts=[];
    if(turret) parts.push({x:88,y:40,w:40,h:48,dx:-p.recoil*9});
    else if(kind==='drone') {
      parts.push({x:0,y:0,w:128,h:22,dx:p.stride*6},{x:0,y:107,w:128,h:21,dx:-p.stride*6});
    } else {
      parts.push({x:20,y:15,w:48,h:16,dx:p.stride*7},{x:20,y:98,w:48,h:20,dx:-p.stride*7});
      if(kind==='player')parts.push({x:96,y:57,w:32,h:14,hidden:true});
    }
    ctx.save();ctx.translate(p.offset-p.recoil*(turret?0:1.3),0);ctx.rotate(p.lean);
    ctx.scale(1+p.breathe,p.squash-p.breathe);
    if(p.hit)ctx.filter='brightness(1.65)';
    const drawn=rig(ctx,'actors/'+kind,size,size,parts);
    ctx.filter='none';
    if(drawn && kind==='warden') {
      ctx.strokeStyle=p.flash?'#fff3a7':'#afad70';ctx.lineWidth=2;
      ctx.save();ctx.rotate(p.time*.7);ctx.beginPath();
      for(let i=0;i<4;i++){const angle=i*Math.PI/2;ctx.moveTo(Math.cos(angle)*size*.36,Math.sin(angle)*size*.36);ctx.arc(0,0,size*.36,angle,angle+.4);}
      ctx.stroke();ctx.restore();
    }
    if(drawn && kind==='enforcer' && p.swing>0) {
      ctx.save();ctx.rotate(-.8+p.swing*1.7);ctx.fillStyle='#c3a184';ctx.fillRect(5,-size*.32,size*.48,4);ctx.restore();
    }
    if(drawn && p.flash && kind!=='player') muzzle(ctx,size*.44,entity.color||'#ffc99a',p.recoil);
    ctx.restore();return drawn;
  }
  function muzzle(ctx,x,color,strength) {
    ctx.save();ctx.globalAlpha=clamp(strength,0,1);ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(x,-2);ctx.lineTo(x+5,-4);ctx.lineTo(x+13,0);ctx.lineTo(x+5,4);ctx.lineTo(x,2);ctx.fill();ctx.restore();
  }
  function weapon(ctx,entity,family,meleeId=0,color='#b3fff0') {
    const p=pose(entity);
    const kick={pistol:3,smg:3,carbine:4,rifle:5,shotgun:7,lmg:5,plasma:4,rail:8,arc:2,dart:2}[family]||4;
    ctx.save();ctx.translate(17-p.recoil*kick,p.reload*7);ctx.rotate(-p.recoil*kick*.018+p.reload*.8);
    if(entity.weapon==='knife'||entity.knifeFlash>0) {
      ctx.rotate(-.45+p.swing*1.7);
      window.GameAssets?.sprite(ctx,'weapons/melee-'+meleeId,7,-4,30,25);
    } else {
      window.GameAssets?.sprite(ctx,'weapons/'+family,0,0,32,22);
      if(p.reload>.1){ctx.fillStyle='#6e8a80';ctx.fillRect(-6,5+p.reload*5,6,9);}
      if(p.flash)muzzle(ctx,15,color,p.recoil);
    }
    ctx.restore();
  }
  function facilityPose(id,time,level,working=false) {
    const enabled=level>0, cycle=enabled?time*(1+level*.12):0;
    return {enabled, cycle, working:enabled&&working,
      scan:enabled&&working?(Math.sin(cycle*2)+1)*.5:0,
      pulse:enabled?.65+Math.sin(cycle*2)*.2:0};
  }
  function facility(ctx,id,time,level,working=false) {
    const p=facilityPose(id,time,level,working), parts=[];
    if(!p.enabled)return false;
    // Idle machines run a slow calibration loop, not an invented crafting job.
    if(id==='mill')parts.push({x:40,y:42,w:41,h:34,dx:Math.sin(p.cycle*.7)*7});
    if(id==='forming')parts.push({x:43,y:44,w:42,h:40,dy:(Math.sin(p.cycle*.65)+1)*3});
    const drawn=rig(ctx,'props/'+id,94,80,parts);
    if(!drawn)return false;
    ctx.save();ctx.scale(94/128,80/128);ctx.translate(-64,-64);
    ctx.fillStyle='#a6cdbb';ctx.globalAlpha=p.pulse;
    if(id==='generator') {
      ctx.save();ctx.translate(43,65);ctx.rotate(p.cycle*3);ctx.strokeStyle='#697f79';ctx.lineWidth=4;
      for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(18,5);ctx.stroke();}ctx.restore();
    } else if(id==='research') {
      ctx.fillStyle=p.working?'#bcf2de':'#6e9d96';ctx.fillRect(25,38,26,2);
      if(p.working){ctx.globalAlpha=.6;ctx.fillRect(24,79+p.scan*19,29,2);ctx.beginPath();ctx.arc(91,31,6+p.scan*4,0,Math.PI*2);ctx.strokeStyle='#b1ebd8';ctx.stroke();}
    } else if(id==='battery') {
      for(let i=0;i<4;i++){ctx.globalAlpha=.3+.5*((Math.sin(p.cycle-i*.7)+1)/2);ctx.fillRect(24+i*21,49,5,11);}
    } else if(id==='solder') {
      ctx.fillStyle='#e7bb7d';ctx.fillRect(40,43,4,3);
    } else {
      ctx.fillRect(96,47,4,3);ctx.fillRect(96,54,4,3);
    }
    ctx.restore();return true;
  }
  window.GameAnimation={state,tick,trigger,pose,rig,actor,weapon,facilityPose,facility};
})();
