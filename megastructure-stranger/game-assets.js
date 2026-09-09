(() => {
  'use strict';
  const actors=['player','watcher','drone','turret','burstTurret','enforcer','marksman','warden','breaker'];
  const props=['generator','battery','solder','mill','forming','research','storage','equipment','implants','bed','plants','server'];
  const districts=['residential','industrial','slums','market','robotics','elite','medical','hydroponics','archive','utilities'];
  const weapons=['pistol','smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'];
  const resources=(window.Resources?.catalog||[]).map(item=>'resources/'+item.id);
  const paths=[...actors.map(id=>'actors/'+id),...props.map(id=>'props/'+id),'props/sensor',...districts.map(id=>'floors/'+id),...weapons.map(id=>'weapons/'+id),...Array.from({length:15},(_,i)=>'weapons/melee-'+i),'wall','door',...resources];
  const images=new Map(),failures=[],records=new Map(),listeners=new Set();
  function progress(){
    const entries=[...records.values()];
    return {total:paths.length+1,loaded:entries.filter(r=>r.status==='ready').length,
      failed:entries.filter(r=>r.status==='error').length,failures:[...failures]};
  }
  function notify(){
    for(const listener of listeners){
      try{listener(progress());}catch{listeners.delete(listener);}
    }
  }
  function load(id,path){
    const img=new Image(),record={status:'pending',path,promise:null};
    images.set(id,img);records.set(id,record);
    const failedIndex=failures.indexOf(path);if(failedIndex>=0)failures.splice(failedIndex,1);
    record.promise=new Promise(resolve=>{
      let settled=false,timer;
      const finish=ok=>{
        if(settled)return;settled=true;
        if(timer!==undefined)clearTimeout(timer);
        record.status=ok?'ready':'error';
        if(!ok&&!failures.includes(path))failures.push(path);
        img.onload=null;img.onerror=null;notify();resolve();
      };
      img.onload=()=>{
        if(!img.naturalWidth){finish(false);return;}
        // Wait for decoding too, so the first game frame does not pay that cost.
        if(typeof img.decode==='function'){
          try{Promise.resolve(img.decode()).then(()=>finish(true),()=>finish(false));}
          catch{finish(false);}
        }else finish(true);
      };
      img.onerror=()=>finish(false);
      if(typeof setTimeout==='function')timer=setTimeout(()=>finish(false),20000);
      try{img.src='assets/'+path;}catch{finish(false);}
    });
  }
  if(typeof Image!=='undefined'){paths.forEach(id=>load(id,id+'.svg'));load('maintenance','maintenance-floor.png');}
  async function preload({onProgress,retry=false}={}){
    if(typeof Image==='undefined')throw new Error('Image loading is unavailable');
    if(retry)for(const [id,record] of records)if(record.status==='error')load(id,record.path);
    if(onProgress)listeners.add(onProgress);
    try{
      onProgress?.(progress());
      await Promise.all([...records.values()].map(record=>record.promise));
      return progress();
    }finally{if(onProgress)listeners.delete(onProgress);}
  }
  function ready(id){const img=images.get(id);return records.get(id)?.status!=='error'&&img?.complete&&img.naturalWidth>0?img:null;}
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
  window.GameAssets={paths,failures,sprite,surface,wall,preload,progress};
})();
