(() => {
  'use strict';
  const get=id=>document.getElementById(id),overlay=get('asset-loading');
  const api={ready:false};window.AssetBoot=api;
  if(!overlay)return;
  const shell=get('game-shell'),retry=get('loading-retry'),skip=get('loading-continue');
  let busy=false,lastAnnounced=-1;
  function finish(){
    api.ready=true;overlay.hidden=true;overlay.setAttribute('aria-busy','false');
    shell.inert=false;shell.removeAttribute('aria-hidden');
    document.body.classList.remove('assets-loading');get('enter-hideout').focus();
  }
  function render(result){
    const percent=Math.floor(result.loaded/result.total*100);
    get('loading-progress').value=percent;
    get('loading-count').textContent=`${percent}% · Готово ${result.loaded} / ${result.total}`;
    // Announce milestones, not every image, for screen-reader users.
    const milestone=Math.floor(percent/10);
    if(milestone!==lastAnnounced){get('loading-status').textContent=`Подготовка ассетов: ${percent}%`;lastAnnounced=milestone;}
  }
  async function start(retrying=false){
    if(busy||api.ready)return;
    busy=true;retry.hidden=true;skip.hidden=true;get('loading-errors').hidden=true;
    overlay.setAttribute('aria-busy','true');lastAnnounced=-1;
    try{
      const result=await window.GameAssets.preload({onProgress:render,retry:retrying});
      if(result.loaded===result.total){finish();return;}
      get('loading-status').textContent=`Не удалось подготовить ${result.failed} из ${result.total} ассетов. Повторите загрузку или используйте упрощённую графику.`;
      const list=get('loading-error-list');list.replaceChildren();
      for(const path of result.failures){const item=document.createElement('li');item.textContent=path;list.appendChild(item);}
      get('loading-errors').hidden=false;skip.hidden=false;
    }catch{
      get('loading-status').textContent='Загрузчик недоступен. Обновите страницу и проверьте файлы игры.';
    }finally{
      busy=false;overlay.setAttribute('aria-busy','false');
      if(!api.ready){retry.hidden=false;retry.focus();}
    }
  }
  retry.addEventListener('click',()=>start(true));
  skip.addEventListener('click',()=>{if(!busy&&!skip.hidden)finish();});
  start();
})();
