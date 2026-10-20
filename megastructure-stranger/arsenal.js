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
  const handling={
    pistol:[82,.9,.18,['semi'],.15],smg:[72,2.3,.13,['auto','semi'],.12],
    carbine:[62,3.2,.23,['semi','auto'],.32],rifle:[43,4.6,.38,['semi'],.5],
    shotgun:[48,3.9,.46,['semi'],.08],lmg:[29,7.2,.24,['auto','semi'],.37],
    plasma:[45,4.5,.3,['semi'],.18],rail:[24,6.8,.65,['semi'],.7],
    arc:[55,3.7,.16,['semi','auto'],.22],dart:[76,1.8,.12,['semi'],.4]
  };
  const builds=[['Штатный',0,1,1],['Компактный',13,.8,1.18],['Длинноствольный',-9,1.15,.84],['Усиленный',-15,1.3,.72],['Облегчённый',8,.88,1.08]];
  const platformSlots={
    pistol:['optic','muzzle','barrel','grip','magazine','trigger','tactical'],
    smg:['optic','muzzle','barrel','stock','grip','magazine','handguard','tactical','trigger','converter'],
    carbine:['optic','muzzle','barrel','stock','grip','magazine','handguard','tactical','trigger'],
    rifle:['optic','muzzle','barrel','stock','grip','magazine','handguard','tactical','trigger'],
    shotgun:['optic','muzzle','barrel','stock','magazine','handguard','tactical','trigger'],
    lmg:['optic','muzzle','barrel','stock','grip','magazine','handguard','tactical','trigger'],
    plasma:['optic','muzzle','barrel','stock','grip','magazine','tactical','trigger','converter'],
    rail:['optic','barrel','stock','grip','magazine','tactical','trigger','converter'],
    arc:['optic','muzzle','barrel','stock','grip','magazine','tactical','trigger','converter'],
    dart:['optic','muzzle','barrel','stock','grip','magazine','tactical','trigger','converter']
  };
  const attachmentBlueprints=[
    ['optic','Коллиматор «Искра»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'],{spread:-.014,ergonomics:-2},1,'solder'],
    ['optic','Голограф «Порог»',['smg','carbine','rifle','lmg','plasma','rail','arc','dart'],{spread:-.021,ergonomics:-4},2,'solder'],
    ['optic','Призма «Дальний контур»',['carbine','rifle','lmg','rail','dart'],{spread:-.027,ergonomics:-9,aim:.1},3,'solder'],
    ['muzzle','Компенсатор «Каскад»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','arc','dart'],{recoil:-.13,ergonomics:-2},1,'mill'],
    ['muzzle','Глушитель «Тихий шов»',['pistol','smg','carbine','rifle','lmg','dart'],{noise:-.46,recoil:-.05,ergonomics:-5,mass:.28},2,'mill'],
    ['muzzle','Дульный тормоз «Разлом»',['smg','carbine','rifle','lmg','rail'],{recoil:-.2,ergonomics:-4,mass:.18},3,'mill'],
    ['barrel','Короткий ствол «Переход»',['pistol','smg','carbine','rifle','shotgun','plasma','arc','dart'],{mass:-.34,ergonomics:7,velocity:-.1,recoil:.08},1,'mill'],
    ['barrel','Точный ствол «Длинная ось»',['smg','carbine','rifle','lmg','rail','dart'],{mass:.46,ergonomics:-7,velocity:.16,spread:-.011,penetration:.05},3,'mill'],
    ['stock','Складной приклад «Крестовина»',['smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'],{recoil:-.1,ergonomics:3,mass:.14},1,'mill'],
    ['stock','Сервоприклад «Вектор»',['smg','carbine','rifle','lmg','plasma','rail','arc'],{recoil:-.18,ergonomics:8,mass:.33},3,'solder'],
    ['grip','Угловая рукоять «Хват»',['pistol','smg','carbine','rifle','lmg','plasma','rail','arc','dart'],{ergonomics:7,recoil:-.05},1,'mill'],
    ['grip','Моторизованная рукоять «Блок»',['smg','carbine','rifle','lmg','plasma','rail','arc'],{ergonomics:10,recoil:-.1,mass:.18},3,'solder'],
    ['magazine','Увеличенный магазин «Секция»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','arc','dart'],{magazine:12,reload:.15,mass:.21},1,'mill'],
    ['magazine','Быстрая подача «Канал»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','arc','dart'],{reload:-.18,reliability:.08},2,'solder'],
    ['magazine','Барабан «Контейнер»',['smg','carbine','rifle','lmg','plasma','arc'],{magazine:28,reload:.38,ergonomics:-9,mass:.62},4,'mill'],
    ['handguard','Цевьё «Ребро»',['smg','carbine','rifle','shotgun','lmg','dart'],{ergonomics:4,recoil:-.04,mass:.1},1,'mill'],
    ['handguard','Охлаждающее цевьё «Радиатор»',['smg','carbine','rifle','lmg','plasma','rail','arc'],{heat:-.22,mass:.26},3,'solder'],
    ['tactical','Лазер «Нить»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'],{hipSpread:-.018,ergonomics:-1},1,'solder'],
    ['tactical','Световой модуль «Грань»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'],{hipSpread:-.009,flashlight:42,mass:.13},2,'solder'],
    ['trigger','Спуск «Разряд»',['pistol','smg','carbine','rifle','shotgun','lmg','plasma','rail','arc','dart'],{delay:-.11,reliability:-.04},2,'mill'],
    ['trigger','Контроллер очереди «Такт»',['smg','carbine','lmg','arc'],{modes:['burst'],recoil:-.04,heat:.05},3,'solder'],
    ['converter','Баллистический конвертер',['smg','plasma','rail','arc','dart'],{ammoType:'ballistic',damage:2,penetration:.12},2,'solder'],
    ['converter','Термокапсульный конвертер',['smg','plasma','rail','arc','dart'],{ammoType:'elemental',damage:1,heat:.12},2,'solder'],
    ['converter','Микродротиковый ускоритель',['smg','plasma','rail','arc','dart'],{ammoType:'mechanical',damage:1,penetration:.08},2,'solder']
  ];
  const items=[];
  for(const family of families)for(let i=0;i<10;i++)items.push({
    id:`${family.id}-${i}`,name:family.id==='smg'&&i===0?'ПП Охраны':`${family.name} «${series[i]}-${i+1}»`,kind:'ranged',slot:'smg',family:family.id,type:family.type,
    damage:family.damage*(1+i*.065),magazine:family.magazine+(i%3)*2,delay:family.delay*(1+(i%4)*.04),velocity:family.velocity+i*18,pellets:family.pellets,
    spread:family.id==='shotgun'?.19:.035+(i%3)*.012,range:family.id==='shotgun'?430:family.velocity*1.4,
    tier:1+Math.floor(i/2),station:family.type==='ballistic'?'mill':'solder',caliber:family.caliber,box:family.box,
    costs:{steel:4+i,weaponFrame:1,barrelBlank:1,triggerGroup:1,...(family.type==='ballistic'?{spring:2}:{circuitModule:1,capacitor:2})}
  });
  attachmentBlueprints.forEach(([attachmentSlot,name,families,effects,tier,station],index)=>items.push({
    id:`attachment-${attachmentSlot}-${index}`,name,kind:'attachment',attachmentSlot,families,effects,tier,station,
    costs:station==='solder'?{circuitModule:1,wire:2,fastener:2,...(tier>=3?{capacitor:1}:{} )}:{steel:2,fastener:2,grip:1,...(tier>=3?{barrelBlank:1}:{})}
  }));
  const melee=[['Нож охраны',34,.42,83,.92],['Заточка',25,.25,62,.45],['Мачете',43,.55,98,1.1],['Топор',62,.85,90,.75],['Ломик',38,.6,93,.8],['Дубинка',30,.38,88,.95],['Копьё',48,.7,145,.3],['Катана',52,.58,115,1.2],['Кувалда',95,1.4,105,.7],['Кастет',22,.22,52,.5],['Серп',41,.48,80,1.35],['Цепь',35,.8,135,1.5],['Алебарда',72,1.05,150,1.05],['Шок-палка',46,.65,95,.8],['Резак',58,.5,75,.6]];
  melee.forEach(([name,damage,delay,range,arc],i)=>items.push({id:`melee-${i}`,name,kind:'melee',slot:'knife',damage,delay,range,arc,animation:i,type:i===13?'energy':i===14?'elemental':'mechanical',tier:Math.min(5,1+Math.floor(i/3)),station:'mill',costs:{steel:2+i,grip:1,fastener:2}}));
  const slots={chest:'Корпус',helmet:'Шлем',pants:'Брюки',boots:'Ботинки'};
  for(const [slot,label] of Object.entries(slots))for(let i=0;i<20;i++)items.push({id:`${slot}-${i}`,name:slot==='chest'&&i>=12?`Плитоносец «${series[i-12]}»`:`${label} «${series[i%10]}-${i+1}»`,kind:'armor',slot,tier:1+Math.floor(i/4),armor:slot==='chest'&&i>=12?1:1+i*.3,carrier:slot==='chest'&&i>=12,plateSlots:slot==='chest'&&i>=12?1+(i%2):0,maxClass:slot==='chest'&&i>=12?3+Math.floor((i-12)/2):0,lootOnly:slot==='chest'&&i>=12,station:'forming',costs:{fabric:4,aramid:2+Math.floor(i/4),armorMesh:1,fastener:2}});
  for(let i=0;i<10;i++)items.push({id:`bag-${i}`,name:i===0?'Офисная сумка':`Сумка «${series[i]}»`,kind:'bag',slot:'bag',tier:1+Math.floor(i/2),capacity:4+i*2,retention:.4+i*.025,station:'forming',costs:{fabric:4+i,thread:3,buckle:2,polymerSheet:1}});
  for(const [material,label,resource,weight] of [['steel','Стальная','steel',1],['ceramic','Керамическая','ceramic',.7],['composite','Композитная','composite',.5],['polyethylene','Полиэтиленовая','polyethylene',.35]])for(let level=1;level<=6;level++)items.push({id:`plate-${material}-${level}`,name:`${label} бронеплита · класс ${level}`,kind:'plate',material,protection:level,weight,tier:Math.min(5,level),station:'forming',costs:{[resource]:level*3,plateBlank:1,resin:level}});
  for(const [id,name,costs,tier] of [
    ['bandage','Гемостатическая повязка',{fabric:2,thread:1},1],
    ['coolant','Противоожоговый гель',{acid:1,regen:1},2],
    ['splint','Фиксатор конечности',{plastic:2,fabric:1},1],
    ['medkit','Реген-набор',{regen:2,fabric:2},3],
    ['surgery','Реконструктор ткани',{regen:4,pcbReady:1},4]
  ])items.push({id:'medical-'+id,name,kind:'medical',medicine:id,tier,station:'table',costs});
  const byId=Object.fromEntries(items.map(item=>[item.id,item]));
  for(const def of items.filter(item=>item.kind==='armor')){
    def.armorMaterial=def.carrier||def.tier===1?'soft':def.tier>=4?'composite':def.slot==='helmet'?'steel':'soft';
    def.mass=Number(((def.slot==='chest'?1.2:def.slot==='helmet'?.6:.4)+def.armor*.15).toFixed(2));
  }
  for(const def of items.filter(item=>item.kind==='ranged')){
    const index=Number(def.id.split('-').at(-1)),[ergo,mass,recoil,modes,penetration]=handling[def.family],build=builds[index%5];
    Object.assign(def,{build:build[0],ergonomics:Math.max(10,Math.min(95,ergo+build[1])),mass:Number((mass*build[2]).toFixed(2)),recoil:recoil*build[3],modes:[...modes],penetration});
  }
  function profile(item){return byId[item?.defId];}
  function slotsFor(def){return [...(platformSlots[def?.family]||[])];}
  function canAttach(gun,attachment){return Boolean(gun&&attachment&&attachment.kind==='attachment'&&slotsFor(gun).includes(attachment.attachmentSlot)&&attachment.families.includes(gun.family));}
  function modificationProfile(def,attachments=[]){
    const out={ergonomics:def.ergonomics,mass:def.mass,recoil:def.recoil,delay:def.delay,velocity:def.velocity,spread:def.spread,magazine:def.magazine,damage:def.damage,penetration:def.penetration,reload:1,heat:1,reliability:1,hipSpread:0,noise:1,flashlight:0,aim:0,modes:[...def.modes],ammoType:def.type};
    for(const entry of attachments){const part=entry?.effects?entry:entry?.def||entry;const effect=part?.effects||{};const condition=Math.max(0,Math.min(1,(entry?.condition??100)/100));
      for(const [key,value] of Object.entries(effect)){
        if(condition===0&&!['mass','magazine','ammoType'].includes(key))continue;
        if(key==='modes'){for(const mode of value)if(!out.modes.includes(mode))out.modes.push(mode);continue;}
        if(key==='ammoType'){out.ammoType=value;continue;}
        if(key==='delay'||key==='velocity'||key==='recoil'||key==='reload'||key==='heat'||key==='noise')out[key]*=1+value*condition;
        else out[key]=(out[key]||0)+value*condition;
      }
    }
    out.ergonomics=Math.round(Math.max(10,Math.min(99,out.ergonomics)));out.mass=Number(Math.max(.2,out.mass).toFixed(2));out.recoil=Math.max(.02,out.recoil);out.delay=Math.max(.06,out.delay);out.velocity=Math.max(90,out.velocity);out.spread=Math.max(.002,out.spread);out.magazine=Math.max(1,Math.round(out.magazine));out.damage=Math.max(1,out.damage);out.penetration=Math.max(0,Math.min(.95,out.penetration));out.reload=Math.max(.55,out.reload);out.heat=Math.max(.55,out.heat);out.reliability=Math.max(.5,Math.min(1.3,out.reliability));return out;
  }
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
  window.Arsenal={items,byId,qualities,families,profile,platformSlots,attachmentBlueprints,slotsFor,canAttach,modificationProfile,ammoInfo,drawMelee};
})();
