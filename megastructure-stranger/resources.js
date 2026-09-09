(() => {
  "use strict";
  // Stable IDs are save-format keys. Salvage remains the existing shared currency.
  const catalog = [
    ['textolite','Текстолит',6,'industrial,robotics,archive','drone'],
    ['pcbBlank','Печатная плата (Пустая)',5,'industrial,robotics','drone'],
    ['pcbReady','Печатная плата (Готовая)',3,'robotics,archive','watcher,turret,burstTurret'],
    ['metal','Металл',10,'industrial,utilities,slums','watcher,drone'],
    ['salvage','Лом',12,'residential,industrial,slums,market,robotics,elite,medical,hydroponics,archive,utilities','watcher,drone,turret,burstTurret,enforcer,marksman,warden,breaker'],
    ['steel','Сталь',7,'industrial,utilities','turret,enforcer'],
    ['stainless','Нержавеющая сталь',4,'medical,hydroponics,industrial','turret'],
    ['alloySteel','Легированная сталь',3,'industrial,robotics','burstTurret,breaker'],
    ['premiumSteel','Высококлассная сталь',1,'elite,robotics','warden,breaker'],
    ['regen','Реген-состав',3,'medical,elite','enforcer'],
    ['powder','Порох',5,'industrial,slums','marksman,burstTurret'],
    ['acid','Кислота',5,'industrial,medical,utilities','drone'],
    ['fabric','Ткань',10,'residential,slums,market','enforcer'],
    ['armorPlates','Бронепластины',3,'robotics,industrial','enforcer,breaker'],
    ['thread','Нить',10,'residential,slums,market','enforcer'],
    ['aramid','Арамидное волокно',3,'industrial,elite','marksman'],
    ['ceramic','Керамический элемент',4,'industrial,medical','enforcer,turret'],
    ['kevlar','Кевлар',2,'elite,market','enforcer,marksman'],
    ['polyethylene','Полиэтилен',8,'residential,market,hydroponics','drone'],
    ['plastic','Пластмасса',10,'residential,slums,market','watcher,drone'],
    ['wood','Дерево',8,'residential,slums,hydroponics',''],
    ['composite','Композит',4,'industrial,robotics','turret,marksman'],
    ['superComposite','Сверхкомпозит',1,'elite,robotics','warden,breaker'],
    ['conductor','Проводник',7,'utilities,industrial,archive','watcher,drone,turret'],
    ['superconductor','Сверхпроводник',1,'robotics,archive','warden'],
    ['fastener','Крепёж',7,'industrial,utilities','drone'],
    ['spring','Пружина',6,'industrial,slums','watcher'],
    ['wire','Изолированный провод',7,'utilities,archive','drone'],
    ['resin','Связующая смола',5,'industrial,medical',''],
    ['polymerSheet','Полимерный лист',5,'industrial,market',''],
    ['armorMesh','Армирующая сетка',4,'industrial,robotics','enforcer'],
    ['plateBlank','Заготовка бронеплиты',3,'industrial','enforcer'],
    ['barrelBlank','Ствольная заготовка',3,'industrial','marksman'],
    ['weaponFrame','Оружейная рама',3,'industrial,robotics','marksman'],
    ['triggerGroup','Спусковой узел',3,'robotics','marksman'],
    ['circuitModule','Управляющий модуль',2,'robotics,archive','turret'],
    ['capacitor','Конденсатор',4,'robotics,utilities','watcher'],
    ['opticalGlass','Оптическое стекло',4,'medical,archive','marksman'],
    ['grip','Заготовка рукояти',5,'industrial,slums',''],
    ['buckle','Пряжка',6,'residential,slums','enforcer'],
    ['ceramicPowder','Керамический порошок',4,'industrial,medical','']
  ].map(([id,name,weight,sectors,enemies]) => Object.freeze({id,name,icon:'assets/resources/'+id+'.svg',weight,sectors: sectors.split(','),enemies: enemies.split(',').filter(Boolean)}));
  const districts = { residential:'Жилые', industrial:'Производственные', slums:'Трущобы', market:'Торговые', robotics:'Роботизированные', elite:'Элитные', medical:'Медицинские', hydroponics:'Гидропоника', archive:'Архив', utilities:'Коммунальные' };
  const enemies = { watcher:'наблюдатели', drone:'сборщики', turret:'турели', burstTurret:'очередные турели', enforcer:'штурмовики', marksman:'стрелки', warden:'Смотритель', breaker:'Таран' };
  function normalize(saved) {
    return Object.fromEntries(catalog.filter(item => item.id !== 'salvage').map(({id}) => [id, Number.isFinite(saved?.[id]) ? Math.min(999999, Math.max(0, Math.floor(saved[id]))) : 0]));
  }
  function roll(source, id, random, draws = 2) {
    const pool = catalog.filter(item => item.id !== 'salvage' && item[source]?.includes(id));
    const result = {};
    const total = pool.reduce((sum,item) => sum + item.weight, 0);
    for (let i = 0; i < draws && total; i++) {
      let value = random() * total;
      const item = pool.find(entry => (value -= entry.weight) < 0) || pool.at(-1);
      result[item.id] = (result[item.id] || 0) + (item.weight <= 3 ? 1 : 1 + Math.floor(random() * 3));
    }
    return result;
  }
  function add(target, loot, multiplier = 1) {
    const clean = normalize(loot);
    const current = normalize(target);
    const rate = Number.isFinite(multiplier) ? Math.max(0, Math.min(1, multiplier)) : 0;
    for (const [id, amount] of Object.entries(clean)) target[id] = Math.min(999999, current[id] + Math.floor(amount * rate));
    return target;
  }
  function summary(loot) { return catalog.filter(item => loot?.[item.id] > 0).map(item => `${item.name} +${loot[item.id]}`).join(', '); }
  function total(loot) { return Object.values(normalize(loot)).reduce((sum, count) => sum + count, 0); }
  function icon(id,size=64) {
    const resource=catalog.find(item=>item.id===id);if(!resource)return null;
    const image=document.createElement('img');image.className='resource-icon';
    image.src=resource.icon;image.alt='';image.width=size;image.height=size;
    image.decoding='async';image.onerror=()=>{image.hidden=true;};return image;
  }
  function costIcons(cost) {
    const list=document.createElement('div');list.className='resource-costs';
    for(const [id,amount] of Object.entries(cost||{})) {
      const resource=catalog.find(item=>item.id===id),chip=document.createElement('span');chip.className='resource-cost';
      const image=icon(id,28);if(image)chip.appendChild(image);
      const label=document.createElement('span');label.textContent=`${resource?.name||id} ×${amount}`;
      chip.appendChild(label);list.appendChild(chip);
    }
    return list;
  }
  function filter(container,query='',onlyOwned=false) {
    const term=query.trim().toLocaleLowerCase('ru');let shown=0;
    for(const card of container.children){
      const match=String(card.dataset?.resourceName||'').toLocaleLowerCase('ru').includes(term)
        &&(!onlyOwned||Number(card.dataset?.amount)>0);
      card.hidden=!match;if(match)shown++;
    }
    return {shown,total:container.children.length};
  }
  function render(container, saved, salvage) {
    if (!container) return;
    container.replaceChildren();
    const amounts = { ...normalize(saved), salvage };
    for (const item of catalog) {
      const card = document.createElement('article');
      card.className = 'resource-card';
      if(!card.dataset)card.dataset={};
      card.dataset.resourceName=item.name;card.dataset.amount=String(amounts[item.id]||0);
      const title = document.createElement('h4'); title.textContent = item.name;
      const count = document.createElement('strong'); count.textContent = String(amounts[item.id] || 0);
      const source = document.createElement('p');
      source.textContent = 'Ящики: ' + item.sectors.map(id => districts[id]).join(', ') + (item.enemies.length ? '. Разбор поверженных: ' + item.enemies.map(id => enemies[id]).join(', ') : '') + '.';
      const details=document.createElement('details'),hint=document.createElement('summary');hint.textContent='Где найти';details.append(hint,source);
      const rarity = document.createElement('small'); rarity.textContent = item.weight <= 1 ? 'ОЧЕНЬ РЕДКИЙ' : item.weight <= 3 ? 'РЕДКИЙ' : 'ОБЫЧНЫЙ';
      card.append(title, count, rarity, details, icon(item.id)); container.appendChild(card);
    }
    window.GameUI?.refreshStorage();
  }
  window.Resources = { catalog, normalize, roll, add, summary, total, render, icon, costIcons, filter };
})();
