(() => {
  'use strict';
  const A=window.Arsenal,R=window.Resources;
  const starter={wood:12,metal:12,conductor:6};
  const tableCost={wood:8,metal:8,conductor:4};
  const intermediate={fastener:{metal:2},spring:{steel:2},wire:{conductor:2,plastic:1},resin:{acid:1,plastic:2},polymerSheet:{polyethylene:3},armorMesh:{aramid:2,thread:2},plateBlank:{steel:3,ceramicPowder:1},barrelBlank:{alloySteel:2},weaponFrame:{metal:3,steel:2},triggerGroup:{spring:1,fastener:2},circuitModule:{pcbReady:1,wire:2},capacitor:{conductor:2,acid:1},opticalGlass:{ceramic:1,plastic:1},grip:{wood:2,plastic:1},buckle:{metal:1},ceramicPowder:{ceramic:1}};
  const parts={};
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function make(w,defId,quality=2){return {uid:`i${w.next++}`,defId,quality:clamp(Math.floor(quality),0,4),condition:100,ceiling:100,age:0,upgrades:{},plates:[]};}
  function init(p,trees){
    for(const [slot,tree] of Object.entries(trees||{}))for(const branch of tree.branches)for(const option of branch.options)for(const tier of [false,true]){
      const id=partKey(slot,branch.id,option.id,tier);
      parts[id]={id,name:(tier?option.tier:option).name,kind:'module',slot,tier:tier?3:1,station:slot==='smg'?'solder':'mill',costs:slot==='smg'?{pcbBlank:1,fastener:2,opticalGlass:branch.id==='optic'?2:1,...(branch.id==='magazine'?{spring:2,polymerSheet:2}:{wire:1})}:{fastener:2,grip:1}};
    }
    const saved=p.workshop;
    if(!saved||saved.version!==1){
      p.workshop={version:1,table:0,research:{},job:null,items:[],equipped:{},next:1};
      p.resources||={};R.add(p.resources,starter);
      for(const [slot,id] of Object.entries({smg:'smg-0',knife:'melee-0',bag:'bag-0',chest:'chest-0',helmet:'helmet-0',pants:'pants-0',boots:'boots-0'})){
        const item=make(p.workshop,id);item.upgrades=JSON.parse(JSON.stringify(p.equipment?.[slot]||{}));p.workshop.items.push(item);p.workshop.equipped[slot]=item.uid;
      }
    }else{
      const ids=new Set();saved.items=(Array.isArray(saved.items)?saved.items:[]).filter(item=>item&&typeof item.uid==='string'&&!ids.has(item.uid)&&(A.byId[item.defId]||parts[item.defId])&&ids.add(item.uid)).slice(0,1500);
      for(const item of saved.items){item.quality=clamp(Math.floor(finite(item.quality,2)),0,4);item.ceiling=clamp(finite(item.ceiling,100),40,100);item.condition=clamp(finite(item.condition,100),0,item.ceiling);item.age=Math.max(0,finite(item.age));item.upgrades=item.upgrades&&typeof item.upgrades==='object'?item.upgrades:{};item.plates=Array.isArray(item.plates)?item.plates.filter(id=>ids.has(id)):[];}
      saved.next=Math.max(1,finite(saved.next,1),...saved.items.map(item=>(Number(item.uid.slice(1))||0)+1));saved.table=saved.table?1:0;saved.equipped=saved.equipped&&typeof saved.equipped==='object'?saved.equipped:{};
      saved.research=Object.fromEntries(R.catalog.filter(item=>saved.research?.[item.id]===true).map(item=>[item.id,true]));
      if(!saved.job||!R.catalog.some(item=>item.id===saved.job.id)||!Number.isFinite(saved.job.ends))saved.job=null;
      for(const [slot,uid] of Object.entries(saved.equipped))if(!saved.items.some(item=>item.uid===uid&&A.byId[item.defId]?.slot===slot))delete saved.equipped[slot];
    }
    return p.workshop;
  }
  function definition(item){return A.byId[item?.defId]||parts[item?.defId];}
  function equipped(p,slot){return p.workshop?.items.find(item=>item.uid===p.workshop.equipped[slot]);}
  function balance(p,id){return id==='salvage'?p.salvage:(p.resources?.[id]||0);}
  function canPay(p,cost){return Object.entries(cost).every(([id,n])=>balance(p,id)>=n);}
  function pay(p,cost){if(!canPay(p,cost))return false;for(const [id,n]of Object.entries(cost)){if(id==='salvage')p.salvage-=n;else p.resources[id]-=n;}return true;}
  function build(p){if(p.workshop.table)return 'Стол уже построен';if(!pay(p,tableCost))return 'Недостаточно стартовых материалов';p.workshop.table=1;return '';}
  function settle(p,now=Date.now()){const job=p.workshop.job;if(job&&now>=job.ends){p.workshop.research[job.id]=true;p.workshop.job=null;return true;}return false;}
  function researchQuote(p,id){const resource=R.catalog.find(item=>item.id===id);if(!resource)return null;return {cost:{[id]:resource.weight<=3?3:5},seconds:resource.weight<=3?120:45};}
  function research(p,id,now=Date.now()){
    if(!p.workshop.table)return 'Постройте исследовательский стол';if(p.workshop.job)return 'Стол занят исследованием';if(p.workshop.research[id])return 'Уже исследовано';
    const offer=researchQuote(p,id);if(!offer||!pay(p,offer.cost))return 'Недостаточно образцов';p.workshop.job={id,ends:now+offer.seconds*1000};return '';
  }
  function recipe(id){if(intermediate[id])return {id,name:R.catalog.find(item=>item.id===id).name,kind:'resource',tier:1,station:'table',costs:intermediate[id]};return A.byId[id]||parts[id];}
  function craftQuote(p,id,quality=0){
    const def=recipe(id);if(!def||def.lootOnly)return {reason:'Этот предмет нужно найти'};
    const q=clamp(Math.floor(finite(quality)),0,4),level=def.kind==='resource'?1:Math.max(def.tier,q+1);
    const cost=Object.fromEntries(Object.entries(def.costs).map(([key,n])=>[key,Math.ceil(n*(1+q*.3))]));
    const missing=Object.keys(cost).filter(key=>!p.workshop.research[key]);
    let reason=!p.workshop.table?'Нужен стол исследований':missing.length?'Исследуйте: '+missing.map(id=>R.catalog.find(item=>item.id===id).name).join(', '):'';
    if(!reason&&(def.station==='table'?p.workshop.table:(p.hideout?.[def.station]||0))<level)reason=`Нужна установка «${({table:'Исследовательский стол',mill:'Фрезер ЧПУ',solder:'Паяльная станция',forming:'Металлоформовка ЧПУ'})[def.station]}» уровня ${level}`;
    if(!reason&&!canPay(p,cost))reason='Недостаточно материалов';
    if(!reason&&def.kind!=='resource'&&p.workshop.items.length>=1500)reason='Хранилище предметов заполнено';
    return {def,cost,quality:q,reason};
  }
  function craft(p,id,quality=0){const offer=craftQuote(p,id,quality);if(offer.reason)return offer.reason;pay(p,offer.cost);if(offer.def.kind==='resource')R.add(p.resources,{[id]:1});else p.workshop.items.push(make(p.workshop,id,offer.quality));return '';}
  function equip(p,uid){const item=p.workshop.items.find(item=>item.uid===uid),def=definition(item);if(!def?.slot||!['ranged','melee','armor','bag'].includes(def.kind))return 'Нельзя экипировать';if(item.condition<=0)return 'Сначала отремонтируйте';
    const old=equipped(p,def.slot);if(old)old.upgrades=JSON.parse(JSON.stringify(p.equipment[def.slot]||{}));
    p.workshop.equipped[def.slot]=uid;p.equipment[def.slot]=JSON.parse(JSON.stringify(item.upgrades));return '';
  }
  function repairQuote(item){return {metal:Math.max(1,Math.ceil((item.ceiling-item.condition)/12)),resin:1};}
  function repair(p,uid){const item=p.workshop.items.find(item=>item.uid===uid);if(!p.workshop.table)return 'Нужен стол';if(!item||item.condition>=item.ceiling)return 'Ремонт не требуется';if(!pay(p,repairQuote(item)))return 'Нужны металл и смола';item.ceiling=Math.max(40,item.ceiling-1);item.condition=item.ceiling;return '';}
  function wear(p,slot,amount){const item=equipped(p,slot);if(item)item.condition=Math.max(0,item.condition-amount/(.7+item.quality*.15));}
  function age(p){for(const item of p.workshop.items){item.age++;item.ceiling=Math.max(40,item.ceiling-.12);item.condition=Math.min(item.ceiling,Math.max(0,item.condition-.2));}}
  function mount(p,uid){const carrier=equipped(p,'chest'),def=definition(carrier),plate=p.workshop.items.find(item=>item.uid===uid),pd=definition(plate);
    if(!def?.carrier)return 'Сначала найдите и наденьте плитоносец';if(pd?.kind!=='plate'||plate.condition<=0)return 'Плита повреждена или отсутствует';if(pd.protection>def.maxClass)return 'Класс плиты выше допуска жилета';
    if(p.workshop.items.some(item=>item.plates.includes(uid)))return 'Плита уже установлена';if(carrier.plates.length>=def.plateSlots)return 'Нет свободных слотов';carrier.plates.push(uid);return '';
  }
  function unmount(p,uid){for(const item of p.workshop.items)item.plates=item.plates.filter(id=>id!==uid);return '';}
  function plateAbsorb(p,amount,type){const carrier=equipped(p,'chest');if(!carrier||carrier.condition<=0)return 0;let absorb=0;
    for(const uid of carrier.plates){const plate=p.workshop.items.find(item=>item.uid===uid),def=definition(plate);if(!def||plate.condition<=0)continue;
      const material={steel:{energy:.7,ballistic:1,elemental:.5,mechanical:1},ceramic:{energy:1.1,ballistic:1.1,elemental:.8,mechanical:.6},composite:{energy:1,ballistic:1,elemental:1,mechanical:1},polyethylene:{energy:.5,ballistic:1.2,elemental:.3,mechanical:.8}}[def.material];
      absorb+=def.protection*1.3*(material[type]||1)*(plate.condition/100)*[.8,.9,1,1.12,1.25][plate.quality];plate.condition=Math.max(0,plate.condition-amount*(def.material==='ceramic'?.65:.3));
    }return Math.min(amount*.8,absorb);
  }
  function partKey(slot,branch,option,tier){return `module:${slot}:${branch}:${option}:${tier?1:0}`;}
  function partAvailable(p,id){return p.workshop.items.some(item=>item.defId===id&&item.condition>0);}
  function consumePart(p,id){const index=p.workshop.items.findIndex(item=>item.defId===id&&item.condition>0);if(index<0)return false;p.workshop.items.splice(index,1);return true;}
  function stats(p,base){
    const gun=equipped(p,'smg'),gd=definition(gun),knife=equipped(p,'knife'),kd=definition(knife);
    const factor=item=>item&&item.condition>0?[.8,.9,1,1.12,1.25][item.quality]*(.65+.35*item.condition/100):0;
    if(gd){base.damage=(gd.damage+base.damage-9)*factor(gun);base.magazine=Math.max(1,gd.magazine+base.magazine-32);base.fireDelay=gd.delay;base.bulletSpeed=gd.velocity*base.bulletSpeed/680;base.spread=Math.max(.003,gd.spread+base.spread-.055);base.pellets=gd.pellets;base.projectileRange=gd.range;base.reload*=.75+gd.magazine/128;}
    if(kd){base.knifeDamage=(kd.damage+base.knifeDamage-34)*factor(knife);base.knifeDelay=Math.max(.15,kd.delay+base.knifeDelay-.42);base.meleeRange=kd.range;base.meleeArc=kd.arc;}
    let armor=0;for(const slot of ['chest','helmet','pants','boots']){const item=equipped(p,slot);armor+=(definition(item)?.armor||0)*factor(item);}
    base.armor=Math.max(0,base.armor-4+armor);const bag=equipped(p,'bag'),bd=definition(bag);if(bd){base.deathRetention=Math.min(.95,base.deathRetention+(bd.retention-.4)*factor(bag));base.salvageMultiplier+=(bd.capacity-4)*.01*factor(bag);}return base;
  }
  function loot(random,guaranteeCarrier=false){const pool=guaranteeCarrier?A.items.filter(item=>item.carrier):A.items;const def=pool[Math.floor(random()*pool.length)];return {defId:def.id,quality:Math.floor(random()*5),condition:45+Math.floor(random()*51)};}
  function receive(p,drops){for(const drop of drops||[]){if(!A.byId[drop.defId]||p.workshop.items.length>=1500)continue;const item=make(p.workshop,drop.defId,drop.quality);item.condition=clamp(finite(drop.condition,70),1,100);p.workshop.items.push(item);}}
  window.Workshop={init,starter,tableCost,parts,intermediate,definition,equipped,canPay,build,settle,researchQuote,research,recipe,craftQuote,craft,equip,repairQuote,repair,wear,age,mount,unmount,plateAbsorb,partKey,partAvailable,consumePart,stats,loot,receive};
})();
