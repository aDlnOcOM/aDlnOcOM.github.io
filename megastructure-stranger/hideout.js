/* Screen navigation is separate from combat and persistent progression. */
(() => {
  "use strict";
  const get = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[data-tab]')];
  function selectTab(name, focus = false) {
    for (const tab of tabs) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      get(tab.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) tab.focus();
    }
  }
  function enter(name = 'shelter') {
    get('main-menu').hidden = true;
    get('home-screen').hidden = false;
    document.body.dataset.screen = 'hideout';
    selectTab(name, true);
  }
  get('enter-hideout').addEventListener('click', () => enter());
  get('menu-equipment').addEventListener('click', () => enter('equipment'));
  get('back-menu').addEventListener('click', () => {
    get('home-screen').hidden = true;
    get('main-menu').hidden = false;
    document.body.dataset.screen = 'menu';
    get('enter-hideout').focus();
  });
  get('menu-controls').addEventListener('click', () => {
    get('menu-help').hidden = !get('menu-help').hidden;
    get('menu-controls').setAttribute('aria-expanded', String(!get('menu-help').hidden));
  });
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      selectTab(tabs[next].dataset.tab, true);
    });
  });
  get('start-run').addEventListener('click', () => {
    document.body.dataset.screen = 'run';
    get('main-menu').hidden = true;
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
  window.HideoutShell = { refresh };
})();
