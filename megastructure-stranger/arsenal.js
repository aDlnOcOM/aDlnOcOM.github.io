(() => {
  'use strict';
  const qualities = ['Самодельное','Кустарное','Промышленное','Заводское','Идеальное'];
  const families = [
    ['pistol','Пистолет','ballistic',12,18,.3,720,1,'9×19',120],
    ['smg','ПП','energy',32,9,.105,680,1,'НН',150],
    ['carbine','Карабин','ballistic',24,22,.22,880,1,'5.56',120],
    ['rifle','Винтовка','ballistic',20,34,.4,1100,1,'7.62',80],
    ['shotgun','Дробовик','ballistic',6,10,.9,600,7,'12/70',40],
    ['lmg','Пулемёт','ballistic',60,17,.12,800,1,'6.8',180],
    ['plasma','Плазмомёт','elemental',16,32,.38,460,1,'ПЛ',90],
    ['rail','Рельсотрон','mechanical',5,90,1.2,1500,1,'РЛ',30],
    ['arc','Дуговой излучатель','energy',20,30,.3,530,1,'ВН',100],
    ['dart','Дротикомёт','mechanical',18,25,.26,790,1,'ДР',60]
  ].map(([id,name,type,magazine,damage,delay,velocity,pellets,caliber,box])=>({id,name,type,magazine,damage,delay,velocity,pellets,caliber,box}));
  const series=['Сектор','Заслон','Контур','Рубеж','Призрак','Каскад','Вектор','Предел','Спектр','Монолит'];
  const items=[];
  for(const family of families)for(let i=0;i<10;i++)items.push({
    id:`${family.id}-${i}`,name:family.id==='smg'&&i===0?'ПП Охраны':`${family.name} «${series[i]}-${i+1}»`,kind:'ranged',slot:'smg',family:family.id,type:family.type,
    damage:family.damage*(1+i*.065),magazine:family.magazine+(i%3)*2,delay:family.delay*(1+(i%4)*.04),velocity:family.velocity+i*18,pellets:family.pellets,
    spread:family.id==='shotgun'?.19:.035+(i%3)*.012,range:family.id==='shotgun'?430:family.velocity*1.4,
    tier:1+Math.floor(i/2),station:family.type==='ballistic'?'mill':'solder',caliber:family.caliber,box:family.box,
    costs:{steel:4+i,weaponFrame:1,barrelBlank:1,triggerGroup:1,...(family.type==='ballistic'?{spring:2}:{circuitModule:1,capacitor:2})}
  });
  const melee=[['Нож охраны',34,.42,83,.92],['Заточка',25,.25,62,.45],['Мачете',43,.55,98,1.1],['Топор',62,.85,90,.75],['Ломик',38,.6,93,.8],['Дубинка',30,.38,88,.95],['Копьё',48,.7,145,.3],['Катана',52,.58,115,1.2],['Кувалда',95,1.4,105,.7],['Кастет',22,.22,52,.5],['Серп',41,.48,80,1.35],['Цепь',35,.8,135,1.5],['Алебарда',72,1.05,150,1.05],['Шок-палка',46,.65,95,.8],['Резак',58,.5,75,.6]];
  melee.forEach(([name,damage,delay,range,arc],i)=>items.push({id:`melee-${i}`,name,kind:'melee',slot:'knife',damage,delay,range,arc,animation:i,type:i===13?'energy':i===14?'elemental':'mechanical',tier:Math.min(5,1+Math.floor(i/3)),station:'mill',costs:{steel:2+i,grip:1,fastener:2}}));
  const slots={chest:'Корпус',helmet:'Шлем',pants:'Брюки',boots:'Ботинки'};
  for(const [slot,label] of Object.entries(slots))for(let i=0;i<20;i++)items.push({id:`${slot}-${i}`,name:slot==='chest'&&i>=12?`Плитоносец «${series[i-12]}»`:`${label} «${series[i%10]}-${i+1}»`,kind:'armor',slot,tier:1+Math.floor(i/4),armor:slot==='chest'&&i>=12?1:1+i*.3,carrier:slot==='chest'&&i>=12,plateSlots:slot==='chest'&&i>=12?1+(i%2):0,maxClass:slot==='chest'&&i>=12?3+Math.floor((i-12)/2):0,lootOnly:slot==='chest'&&i>=12,station:'forming',costs:{fabric:4,aramid:2+Math.floor(i/4),armorMesh:1,fastener:2}});
  for(let i=0;i<10;i++)items.push({id:`bag-${i}`,name:i===0?'Офисная сумка':`Сумка «${series[i]}»`,kind:'bag',slot:'bag',tier:1+Math.floor(i/2),capacity:4+i*2,retention:.4+i*.025,station:'forming',costs:{fabric:4+i,thread:3,buckle:2,polymerSheet:1}});
  for(const [material,label,resource,weight] of [['steel','Стальная','steel',1],['ceramic','Керамическая','ceramic',.7],['composite','Композитная','composite',.5],['polyethylene','Полиэтиленовая','polyethylene',.35]])for(let level=1;level<=6;level++)items.push({id:`plate-${material}-${level}`,name:`${label} бронеплита · класс ${level}`,kind:'plate',material,protection:level,weight,tier:Math.min(5,level),station:'forming',costs:{[resource]:level*3,plateBlank:1,resin:level}});
  const byId=Object.fromEntries(items.map(item=>[item.id,item]));
  function profile(item){return byId[item?.defId];}
  function ammoInfo(def,type=def.type){return {key:`${def.family}:${type}`,type,magazine:`Магазин ${def.caliber} / ${type}`,box:`Боезапас ${def.caliber} / ${type}`,capacity:def.box,code:def.caliber};}
  function drawMelee(ctx,player,angle,definition){
    const def=definition||byId['melee-0'];const progress=1-Math.max(0,player.knifeFlash)/.25;
    const i=def.animation;ctx.save();ctx.translate(player.x,player.y);ctx.rotate(angle);
    ctx.strokeStyle=['#d6e3b0','#b8cbd8','#ecb082','#9cebe8'][i%4];ctx.lineWidth=2+i%5;ctx.globalAlpha=Math.max(.1,1-progress*.7);
    ctx.beginPath();
    if([1,6,9,14].includes(i)){const reach=def.range*Math.sin(Math.max(0,progress)*Math.PI);ctx.moveTo(14,-(i%3));ctx.lineTo(reach,0);ctx.lineTo(reach-12,5+i%5);}
    else{const sweep=-def.arc+progress*def.arc*2;ctx.arc(0,0,def.range*.78,-def.arc,sweep);ctx.moveTo(0,0);ctx.lineTo(Math.cos(sweep)*def.range*.85,Math.sin(sweep)*def.range*.85);if([3,8,12].includes(i))ctx.strokeRect(Math.cos(sweep)*def.range*.8-7,Math.sin(sweep)*def.range*.8-7,14,14);}
    if(i===4){ctx.moveTo(def.range*.6,-12);ctx.lineTo(def.range*.85,-12);ctx.lineTo(def.range*.9,0);}
    if(i===5){ctx.moveTo(12,15);ctx.lineTo(def.range*.65*Math.sin(progress*Math.PI),-24);}
    if(i===7){ctx.arc(0,0,def.range*.6,-1.2,progress*2-1.2);}
    if(i===8){ctx.arc(def.range*.6,0,Math.max(1,progress*24),0,Math.PI*2);}
    if(i===9){ctx.strokeRect(def.range*Math.sin(progress*Math.PI)-12,-7,12,14);}
    if(i===10){ctx.arc(def.range*.55,0,18,-Math.PI/2,Math.PI*.8);}
    if(i===11){for(let n=1;n<8;n++){ctx.moveTo(n*15,Math.sin(n+progress*8)*12);ctx.lineTo(n*15+10,Math.sin(n+1+progress*8)*12);}}
    if(i===13){ctx.moveTo(18,0);for(let n=1;n<=6;n++)ctx.lineTo(18+n*11,(n%2?1:-1)*7*Math.sin(progress*Math.PI));}
    if(i===14){ctx.arc(def.range*.7,0,12,progress*12,progress*12+Math.PI*1.6);}
    ctx.stroke();ctx.restore();
  }
  window.Arsenal={items,byId,qualities,families,profile,ammoInfo,drawMelee};
})();
