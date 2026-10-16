(() => {
 'use strict';
 function update(player,progression,stock){
   const C=window.CombatModel,body=player.body;if(!body)return;
   for(const [id,def] of Object.entries(C.zones)){
     const el=document.getElementById('body-'+id),p=body.parts[id];if(!el)continue;
     el.textContent=def.name+': '+Math.ceil(p.health)+' / '+Math.ceil(p.max);el.dataset.critical=String(p.health/p.max<.35);
   }
   const status=document.getElementById('body-status');if(status)status.textContent=C.statusLabel(body);
   const armor=window.ArmorSystem?.summary(progression);
   if(armor){document.getElementById('armor-label').textContent=armor.percent+'%';document.getElementById('armor-bar').style.width=armor.percent+'%';}
   const ammo=document.getElementById('cartridge-label');if(ammo)ammo.textContent=stock.cartridge?.name||'Штатный боезапас';
 }
 function medicalPanel(container,player,supplies,onTreat){
   const M=window.FieldMedicine,C=window.CombatModel;if(!M||!player.body)return;
   const section=document.createElement('section');section.className='medical-panel';const title=document.createElement('h3');title.textContent='Состояние и полевая медицина';section.appendChild(title);
   for(const [id,zone] of Object.entries(C.zones)){const line=document.createElement('p'),p=player.body.parts[id];line.textContent=zone.name+' · '+Math.ceil(p.health)+' / '+Math.ceil(p.max)+(p.health<=0?' · разрушено':'');section.appendChild(line);}
   const note=document.createElement('p');note.textContent=C.statusLabel(player.body)+' · Лечение продолжится после закрытия инвентаря. Попадание прерывает процедуру.';section.appendChild(note);
   const actions=document.createElement('div');actions.className='medical-actions';section.appendChild(actions);
   for(const [id,def] of Object.entries(M.catalog)){
     const b=document.createElement('button');b.type='button';b.className='quiet-button';b.textContent=def.name+' ×'+(supplies[id]||0)+' · '+def.seconds+' с';
     b.disabled=!(supplies[id]>0)||!M.target(player.body,id)||Boolean(player.reload||player.handling?.clearing||player.treatment);b.onclick=()=>onTreat(id);actions.appendChild(b);
   }container.appendChild(section);
 }
 window.CombatHUD={update,medicalPanel};
})();
