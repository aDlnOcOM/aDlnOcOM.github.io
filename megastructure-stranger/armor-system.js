(() => {
  'use strict';
  const coverage={head:['helmet'],thorax:['chest'],abdomen:['chest','pants'],arms:['chest'],legs:['pants','boots']};
  const quality=[.8,.9,1,1.12,1.25];
  function layers(p,zone='thorax',impact={},target={}) {
    const W=window.Workshop;if(!W)return [];
    const result=[];
    const carrier=W.equipped(p,'chest'),cd=W.definition(carrier);
    if((zone==='thorax'||zone==='abdomen')&&cd?.carrier&&carrier.condition>0){
      const plates=(carrier.plates||[]).map(uid=>p.workshop.items.find(i=>i.uid===uid)).filter(i=>W.definition(i)?.kind==='plate');
      // Two slots cover front and back, not two stacked full-strength plates.
      const angle=Math.atan2(-(impact.vy||0),-(impact.vx||1));
      const rear=Math.cos(angle-(target.angle||0))<0;
      const plate=plates[rear?1:0];const def=W.definition(plate);
      if(plate?.condition>0)result.push({id:plate.uid,material:def.material,protection:def.protection*5*quality[plate.quality],integrity:plate.condition,
        damage:n=>W.wearItem(plate,n)});
    }
    for(const slot of coverage[zone]||coverage.thorax){
      const item=W.equipped(p,slot),def=W.definition(item);
      if(!def||item.condition<=0)continue;
      const coverageFactor=zone==='arms'?.45:zone==='abdomen'?.65:slot==='boots'?.35:1;
      result.push({id:item.uid,material:def.armorMaterial||'soft',protection:def.armor*quality[item.quality]*coverageFactor*1.4,integrity:item.condition,
        damage:n=>W.wearItem(item,n)});
    }
    return result;
  }
  function summary(p){
    const W=window.Workshop;let current=0,max=0;
    for(const slot of ['chest','helmet','pants','boots']){
      const item=W?.equipped(p,slot);if(!item)continue;
      current+=item.condition;max+=100;
      if(slot==='chest')for(const uid of item.plates||[]){const plate=p.workshop.items.find(i=>i.uid===uid);if(plate){current+=plate.condition;max+=100;}}
    }
    return {current,max,percent:max?Math.round(current/max*100):0};
  }
  function burden(p){
    const W=window.Workshop;let mass=0;
    for(const slot of ['chest','helmet','pants','boots']){
      const item=W?.equipped(p,slot),def=W?.definition(item);if(!def)continue;
      mass+=(def.mass||def.armor*.18);
      for(const uid of item.plates||[]){const pd=W.definition(p.workshop.items.find(i=>i.uid===uid));if(pd)mass+=pd.weight*pd.protection*.8;}
    }
    return {mass,speed:Math.max(.72,1-mass*.012)};
  }
  window.ArmorSystem={coverage,layers,summary,burden};
})();
