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
    ['superconductor','Сверхпроводник',1,'robotics,archive','warden']
  ].map(([id,name,weight,sectors,enemies]) => Object.freeze({id,name,weight,sectors: sectors.split(','),enemies: enemies.split(',').filter(Boolean)}));
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
  function render(container, saved, salvage) {
    if (!container) return;
    container.replaceChildren();
    const amounts = { ...normalize(saved), salvage };
    for (const item of catalog) {
      const card = document.createElement('article');
      card.className = 'resource-card';
      const title = document.createElement('h4'); title.textContent = item.name;
      const count = document.createElement('strong'); count.textContent = String(amounts[item.id] || 0);
      const source = document.createElement('p');
      source.textContent = 'Ящики: ' + item.sectors.map(id => districts[id]).join(', ') + (item.enemies.length ? '. Разбор поверженных: ' + item.enemies.map(id => enemies[id]).join(', ') : '') + '.';
      const rarity = document.createElement('small'); rarity.textContent = item.weight <= 1 ? 'ОЧЕНЬ РЕДКИЙ' : item.weight <= 3 ? 'РЕДКИЙ' : 'ОБЫЧНЫЙ';
      card.append(title, count, rarity, source); container.appendChild(card);
    }
  }
  window.Resources = { catalog, normalize, roll, add, summary, total, render };
})();
