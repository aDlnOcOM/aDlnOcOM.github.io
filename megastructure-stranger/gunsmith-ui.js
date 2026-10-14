(() => {
 'use strict';
 const slots={optic:'Прицел',muzzle:'Дульное устройство',barrel:'Ствол',stock:'Приклад',grip:'Рукоять',magazine:'Магазин',handguard:'Цевьё',tactical:'Тактический блок',trigger:'Спуск',converter:'Конвертер'};
 const stats={damage:['Урон',1],magazine:['Ёмкость',0],ergonomics:['Эргономика',0],mass:['Масса, кг',2],recoil:['Отдача',3],spread:['Разброс, рад',3],velocity:['Скорость',0],penetration:['Пробитие',2],heat:['Нагрев',2],noise:['Шум',2]};
 function build(p,gun,replacement){
   const W=window.Workshop,A=window.Arsenal;
   let parts=W.attachments(p,gun).map(i=>({...W.definition(i),condition:i.condition}));
   if(replacement){const d=W.definition(replacement);parts=parts.filter(p=>p.attachmentSlot!==d.attachmentSlot);parts.push({...d,condition:replacement.condition});}
   return A.modificationProfile(W.definition(gun),parts);
 }
 function show(api,uid,onClose=()=>{}){
   const d=document.createElement('dialog');d.className='gunsmith-dialog';d.setAttribute('aria-label','Оружейный верстак');
   const opener=document.activeElement;document.body.appendChild(d);let feedback='';
   const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
   function action(name,...args){feedback=api.action(name,...args)||'Сборка сохранена';render();}
   function button(text,fn,disabled=false){const b=el('button',text,'quiet-button');b.type='button';b.onclick=fn;b.disabled=disabled;return b;}
   function render(){
     const p=api.get(),W=window.Workshop,A=window.Arsenal,gun=p.workshop.items.find(i=>i.uid===uid),def=W.definition(gun);d.replaceChildren();
     const header=el('header',undefined,'panel-heading');header.append(el('h2','Оружейный верстак'),button('Закрыть · Esc',()=>d.close()));d.appendChild(header);
     if(!gun||def.kind!=='ranged'){d.appendChild(el('p','Оружие отсутствует'));return;}
     const status=el('p',feedback,'gunsmith-feedback');status.setAttribute('role','status');d.appendChild(status);
     const layout=el('div',undefined,'gunsmith-layout'),summary=el('section',undefined,'gunsmith-summary'),grid=el('section',undefined,'gunsmith-sockets');d.appendChild(layout);layout.append(summary,grid);
     const art=el('img');art.src='assets/weapons/'+def.family+'.svg';art.alt=def.name;summary.append(el('h3',def.name),art,el('p',def.caliber+' · '+def.build+' · прочность '+Math.round(gun.condition)+'%'));
     summary.appendChild(el('p','Сравнение показывает платформу и физические детали. Качество оружия, износ и дерево развития дополнительно учитываются в бою.','section-note'));
     const current=build(p,gun),readout=el('dl',undefined,'gunsmith-stats');summary.appendChild(readout);
     function compare(preview=current){readout.replaceChildren();for(const [key,[name,places]] of Object.entries(stats)){const delta=preview[key]-current[key];readout.append(el('dt',name),el('dd',current[key].toFixed(places)+(Math.abs(delta)>.0001?' → '+preview[key].toFixed(places):'')));}}
     compare();
     for(const slot of A.slotsFor(def)){
       const panel=el('article',undefined,'gunsmith-socket'),installed=p.workshop.items.find(i=>i.uid===gun.attachments?.[slot]);grid.appendChild(panel);panel.append(el('h3',slots[slot]),el('p',installed?W.definition(installed).name+' · '+Math.round(installed.condition)+'%':'Штатная деталь'));
       if(installed)panel.appendChild(button('Снять на склад',()=>action('detach',uid,slot)));
       const candidates=p.workshop.items.filter(i=>W.definition(i)?.attachmentSlot===slot&&A.canAttach(def,W.definition(i))&&!W.attachedTo(p,i.uid));
       const select=el('select');select.setAttribute('aria-label','Выбор: '+slots[slot]);
       select.appendChild(Object.assign(el('option','Выберите деталь со склада'),{value:''}));
       for(const part of candidates){const option=el('option',W.definition(part).name+' · '+Math.round(part.condition)+'%');option.value=part.uid;select.appendChild(option);}
       const install=button(installed?'Сначала снимите установленную деталь':'Установить',()=>action('attach',uid,select.value),true);
       select.onchange=()=>{const candidate=candidates.find(i=>i.uid===select.value);compare(candidate?build(p,gun,candidate):current);install.disabled=!candidate||candidate.condition<=0||Boolean(installed);};
       panel.append(select,install);if(!candidates.length)panel.appendChild(el('small','Совместимую деталь можно изготовить или найти.'));
     }
   }
   d.addEventListener('close',()=>{d.remove();onClose();if(opener?.isConnected)opener.focus();});render();d.showModal();
 }
 window.GunsmithUI={slots,stats,build,show};
})();
