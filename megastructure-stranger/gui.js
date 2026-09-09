(() => {
  'use strict';
  const get=id=>document.getElementById(id);
  function refreshStorage(){
    const container=get('storage-materials'),search=get('storage-search'),owned=get('storage-owned');
    if(!container||!search||!owned||!window.Resources)return;
    const result=window.Resources.filter(container,search.value,owned.checked);
    get('storage-result-count').textContent=`${result.shown} / ${result.total} материалов`;
    get('storage-empty').hidden=result.shown>0;
  }
  window.GameUI={refreshStorage};
  get('storage-search')?.addEventListener('input',refreshStorage);
  get('storage-owned')?.addEventListener('change',refreshStorage);
  refreshStorage();
})();
