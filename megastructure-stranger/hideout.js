/* Screen navigation is separate from combat and persistent progression. */
(() => {
  "use strict";
  const get = id => document.getElementById(id);
  function closePanels() {
    for (const id of ['panel-equipment','panel-storage']) {
      const panel=get(id);
      if(panel.open)panel.close();
    }
  }
  function enter() {
    closePanels();
    get('main-menu').hidden=true;
    get('home-screen').hidden=false;
    document.body.dataset.screen='hideout';
    window.ShelterLocation?.setActive(true);
    get('shelter-canvas').focus();
  }
  function openService(name) {
    if(get('home-screen').hidden || !['equipment','storage'].includes(name))return;
    const panel=get('panel-'+name);
    if(!panel.open)panel.showModal();
  }
  for(const name of ['equipment','storage']) {
    get('close-'+name).addEventListener('click',()=>get('panel-'+name).close());
    get('panel-'+name).addEventListener('close',()=>{
      if(!get('home-screen').hidden)get('shelter-canvas').focus();
    });
  }
  get('enter-hideout').addEventListener('click',enter);
  get('back-menu').addEventListener('click',()=>{
    closePanels();
    window.ShelterLocation?.setActive(false);
    get('home-screen').hidden=true;
    get('main-menu').hidden=false;
    document.body.dataset.screen='menu';
    get('enter-hideout').focus();
  });
  get('menu-controls').addEventListener('click',()=>{
    get('menu-help').hidden=!get('menu-help').hidden;
    get('menu-controls').setAttribute('aria-expanded',String(!get('menu-help').hidden));
  });
  get('start-run').addEventListener('click',()=>{
    closePanels();
    window.ShelterLocation?.setActive(false);
    document.body.dataset.screen='run';
    get('main-menu').hidden=true;
  });
  function refresh(progression, items) {
    get('storage-salvage').textContent = String(progression.salvage);
    const list = get('storage-items');
    list.replaceChildren();
    for (const item of items) {
      const upgrades = Object.values(progression.equipment[item.id]);
      const count = upgrades.reduce((sum, branch) => sum + (branch.choice ? 1 : 0) + (branch.tier ? 1 : 0), 0);
      const card = document.createElement('article');
      const label = document.createElement('small');
      label.textContent = item.slot;
      const title = document.createElement('h4');
      title.textContent = item.name;
      const detail = document.createElement('p');
      detail.textContent = `В комплекте · модификаций: ${count}`;
      card.append(label, title, detail);
      list.appendChild(card);
    }
    if (document.body.dataset.screen === 'run' && get('run-screen').hidden) enter();
  }
  window.HideoutShell = { refresh, openService, enter };
})();
