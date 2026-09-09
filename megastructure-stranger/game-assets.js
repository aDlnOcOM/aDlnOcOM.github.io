(() => {
  'use strict';
  const actors=['player','watcher','drone','turret','burstTurret','enforcer','marksman','warden','breaker'];
  const props=['generator','battery','solder','mill','forming','research','storage','equipment','implants','bed','plants','server'];
  const districts=['residential','industrial','slums','market','robotics','elite','medical','hydroponics','archive','utilities'];
  const weapons=['pistol','smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'];
  const paths=[...actors.map(id=>'actors/'+id),...props.map(id=>'props/'+id),'props/sensor',...districts.map(id=>'floors/'+id),...weapons.map(id=>'weapons/'+id),...Array.from({length:15},(_,i)=>'weapons/melee-'+i),'wall','door'];
  const images=new Map(),failures=[];
  function load(id,path){const img=new Image();images.set(id,img);img.onerror=()=>failures.push(path);img.src='assets/'+path;}
  if(typeof Image!=='undefined'){paths.forEach(id=>load(id,id+'.svg'));load('maintenance','maintenance-floor.png');}
  function ready(id){const img=images.get(id);return img?.complete&&img.naturalWidth>0?img:null;}
  function sprite(ctx,id,x,y,width,height,angle=0){
    const img=ready(id);if(!img)return false;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(img,-width/2,-height/2,width,height);ctx.restore();return true;
  }
  function surface(ctx,id,x,y,width,height,cameraX=0,viewport=960){
    const img=ready('floors/'+id)||ready('maintenance');if(!img)return false;
    ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
    const start=x+Math.max(0,Math.floor((cameraX-x)/128))*128;
    for(let tx=start;tx<Math.min(x+width,cameraX+viewport+128);tx+=128)for(let ty=y;ty<y+height;ty+=128)ctx.drawImage(img,tx,ty,128,128);
    ctx.restore();return true;
  }
  function wall(ctx,wall){
    const prop=wall.district==='hydroponics'?'plants':wall.district==='medical'&&wall.width>25?'bed':wall.material==='racks'?'server':wall.material==='machines'?'mill':wall.material==='pods'?'battery':wall.material==='furniture'?'bed':wall.material==='stalls'?'storage':null;
    return sprite(ctx,prop?'props/'+prop:'wall',wall.x+wall.width/2,wall.y+wall.height/2,wall.width,wall.height);
  }
  window.GameAssets={paths,failures,sprite,surface,wall};
})();
