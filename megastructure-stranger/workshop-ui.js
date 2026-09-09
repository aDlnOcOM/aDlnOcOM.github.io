(() => {
  'use strict';
  let dialog,tab='research',category='resource',query='',quality=0,page=0,api,timer;
  const names={research:'Исследования',craft:'Производство',items:'Предметы'};
  const stationNames={table:'Стол исследований',mill:'Фрезер ЧПУ',solder:'Паяльная станция',forming:'Металлоформовка ЧПУ'};
  const resourceName=id=>window.Resources.catalog.find(item=>item.id===id)?.name||id;
  const costs=cost=>Object.entries(cost||{}).map(([id,n])=>`${resourceName(id)} ×${n}`).join(' · ');
  function button(label,fn,disabled=false){const node=document.createElement('button');node.type='button';node.className='quiet-button';node.textContent=label;node.disabled=disabled;node.onclick=fn;return node;}
  function act(name,...args){const error=api.action(name,...args);render();dialog.querySelector('[data-feedback]').textContent=error||'Готово';}
  function render(){
    const p=api.get(),W=window.Workshop,A=window.Arsenal;
    dialog.replaceChildren();
    const header=document.createElement('header');header.className='panel-heading';const title=document.createElement('h2');title.textContent='Исследования и производство';header.append(title,button('Закрыть · Esc',()=>dialog.close()));dialog.appendChild(header);
    const feedback=document.createElement('p');feedback.dataset.feedback='';feedback.setAttribute('role','status');dialog.appendChild(feedback);
    const nav=document.createElement('nav');nav.className='workshop-nav';for(const [id,label]of Object.entries(names)){const b=button(label,()=>{tab=id;if(id==='items'&&category==='resource')category='ranged';page=0;render();});b.setAttribute('aria-pressed',String(tab===id));nav.appendChild(b);}dialog.appendChild(nav);
    const note=document.createElement('p');note.className='section-note';note.textContent='Качество и прочность влияют на характеристики. Износ происходит в бою, старение — после забега. Ремонт снижает предел прочности. Модули дерева сначала нужно изготовить; готовый модуль расходуется при установке.';dialog.appendChild(note);
    if(!p.workshop.table){const info=document.createElement('p');info.textContent='Исследовательский стол не построен. Одноразовый стартовый набор: '+costs(W.starter)+'. Постройка: '+costs(W.tableCost);dialog.append(info,button('Собрать исследовательский стол',()=>act('build'),!W.canPay(p,W.tableCost)));}
    else {
      const offer=W.tableQuote(p),info=document.createElement('p');
      info.textContent=`Стол ${p.workshop.table}/5 · ${W.tableTiers[p.workshop.table-1]} · Время исследований −${(p.workshop.table-1)*12}%`;
      dialog.appendChild(info);
      const detail=document.createElement('p');detail.textContent=offer.next?`Следующий уровень: ${W.tableTiers[offer.next-1]} · ${costs(offer.cost)} · ${offer.reason||'Доступно'}`:offer.reason;
      dialog.append(detail,button('Улучшить стол',()=>act('upgradeTable'),Boolean(offer.reason)));
    }
    const list=document.createElement('div');list.className='workshop-list';dialog.appendChild(list);
    function card(name,detail){const el=document.createElement('article'),title=document.createElement('h3'),text=document.createElement('p');title.textContent=name;text.textContent=detail;el.append(title,text);list.appendChild(el);return el;}
    if(tab==='research'){
      const job=p.workshop.job;if(job){const progress=document.createElement('p');progress.dataset.timer='';progress.textContent=`Исследуется ${resourceName(job.id)} · осталось ${Math.max(0,Math.ceil((job.ends-Date.now())/1000))} с`;dialog.insertBefore(progress,list);}
      for(const r of window.Resources.catalog){const offer=W.researchQuote(p,r.id),done=p.workshop.research[r.id];const el=card(r.name,`${done?'ИССЛЕДОВАНО':'Образцы: '+costs(offer.cost)+' · '+offer.seconds+' с'} · В наличии: ${r.id==='salvage'?p.salvage:p.resources?.[r.id]||0} · Стол ≥ ${offer.level} · Предшественники: ${offer.requires.map(resourceName).join(', ')||'нет'}${!done&&offer.reason?' · '+offer.reason:''}`);el.appendChild(button(done?'Изучено':'Пожертвовать образцы и исследовать',()=>act('research',r.id),done||Boolean(offer.reason)||Boolean(job)||!W.canPay(p,offer.cost)));}
      return;
    }
    const filters=document.createElement('div');filters.className='workshop-nav';dialog.insertBefore(filters,list);
    const search=document.createElement('input');search.type='search';search.placeholder='Поиск по названию';search.setAttribute('aria-label','Название предмета');search.value=query;search.onchange=()=>{query=search.value;page=0;render();};filters.appendChild(search);
    const select=document.createElement('select');select.setAttribute('aria-label','Категория');for(const [value,label]of Object.entries({resource:'Промежуточные материалы',ranged:'Дальнобойное оружие',melee:'Ближний бой',armor:'Одежда и плитоносцы',plate:'Бронеплиты',bag:'Сумки',module:'Модули дерева'})){const option=document.createElement('option');option.value=value;option.textContent=label;option.selected=value===category;select.appendChild(option);}select.onchange=()=>{category=select.value;page=0;render();};filters.appendChild(select);
    if(tab==='craft'){const grade=document.createElement('select');grade.setAttribute('aria-label','Качество изготовления');A.qualities.forEach((name,index)=>{const option=document.createElement('option');option.value=index;option.textContent=name;option.selected=index===quality;grade.appendChild(option);});grade.onchange=()=>{quality=Number(grade.value);render();};filters.appendChild(grade);}
    const entries=tab==='craft'?[...Object.keys(W.intermediate).map(W.recipe),...A.items,...Object.values(W.parts)]:p.workshop.items;
    const filtered=entries.filter(entry=>{const d=tab==='craft'?entry:W.definition(entry);return d.kind===category&&d.name.toLowerCase().includes(query.toLowerCase());});
    page=Math.min(page,Math.max(0,Math.ceil(filtered.length/24)-1));
    for(const entry of filtered.slice(page*24,page*24+24)){
      const def=tab==='craft'?entry:W.definition(entry);
      const art=document.createElement('img');art.alt='';art.width=72;art.height=72;art.loading='lazy';
      art.src='assets/'+(def.kind==='ranged'?'weapons/'+def.family:def.kind==='melee'?'weapons/'+def.id:def.kind==='armor'||def.kind==='plate'?'props/equipment':def.kind==='bag'?'props/storage':'props/research')+'.svg';
      let details=def.kind==='ranged'?`${def.family} · ${def.type} · ${def.caliber} · магазин ${def.magazine} · урон ${def.damage.toFixed(1)}`:def.kind==='melee'?`Урон ${def.damage} · радиус ${def.range} · пауза ${def.delay} с`:def.kind==='plate'?`Защита ${def.protection} · ${def.material}`:def.carrier?`НАЙТИ В ЗАБЕГЕ · ${def.plateSlots} слота · класс ≤ ${def.maxClass}`:def.kind==='bag'?`Перенос предметов: ${def.capacity} · удержание ${(def.retention*100).toFixed(0)}%`:def.kind==='armor'?`Броня ${def.armor.toFixed(1)}`:'';
      if(tab==='craft'){
        const offer=W.craftQuote(p,def.id,quality);const el=card(def.name,details+' · '+costs(offer.cost)+(def.station?' · '+stationNames[def.station]:'')+' · '+(offer.reason||'Доступно'));
        el.insertBefore(art,el.firstChild);el.appendChild(button(def.lootOnly?'Только добыча':'Изготовить',()=>act('craft',def.id,quality),Boolean(offer.reason)));
      }else{
        const isEquipped=Object.values(p.workshop.equipped).includes(entry.uid),mounted=p.workshop.items.some(item=>item.plates.includes(entry.uid));
        const el=card(def.name,details+` · ${A.qualities[entry.quality]} · Прочность ${entry.condition.toFixed(1)}/${entry.ceiling.toFixed(1)} · Возраст ${entry.age} забегов`+(isEquipped?' · НАДЕТО':'')+(mounted?' · В ЖИЛЕТЕ':''));
        el.insertBefore(art,el.firstChild);
        if(def.slot&&def.kind!=='module')el.appendChild(button('Надеть',()=>act('equip',entry.uid),isEquipped||entry.condition<=0));
        if(def.kind==='plate')el.appendChild(button(mounted?'Извлечь плиту':'Вставить в жилет',()=>act(mounted?'unmount':'mount',entry.uid)));
        if(def.carrier){const plates=document.createElement('p');plates.textContent='Установлено: '+(entry.plates.map(uid=>W.definition(p.workshop.items.find(item=>item.uid===uid))?.name).join(', ')||'нет плит');el.appendChild(plates);}
        el.appendChild(button('Ремонт · '+costs(W.repairQuote(entry)),()=>act('repair',entry.uid),entry.condition>=entry.ceiling||!p.workshop.table));
      }
    }
    if(!filtered.length)card('Нет предметов','Смените категорию или найдите предметы в забеге.');
    const pages=document.createElement('div');pages.className='workshop-nav';pages.append(button('←',()=>{page--;render();},page===0),document.createTextNode(`${page+1} / ${Math.max(1,Math.ceil(filtered.length/24))} · ${filtered.length} позиций`),button('→',()=>{page++;render();},(page+1)*24>=filtered.length));dialog.appendChild(pages);
  }
  function updateTimer(){const job=api.get().workshop.job;if(!job)return;const el=dialog.querySelector('[data-timer]');if(el)el.textContent=`Исследуется ${resourceName(job.id)} · осталось ${Math.max(0,Math.ceil((job.ends-Date.now())/1000))} с`;if(Date.now()>=job.ends){const error=api.action('settle');if(!error)render();}}
  function show(options){api=options;if(dialog?.open){render();return;}dialog=document.createElement('dialog');dialog.className='workshop-dialog';dialog.setAttribute('aria-label','Стол исследований и производство');const opener=document.activeElement;document.body.appendChild(dialog);render();dialog.showModal();timer=window.setInterval(updateTimer,500);dialog.addEventListener('close',()=>{window.clearInterval(timer);dialog.remove();if(opener?.isConnected)opener.focus();});}
  window.WorkshopUI={show};
})();
