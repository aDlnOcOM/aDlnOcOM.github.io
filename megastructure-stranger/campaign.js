(() => {
  'use strict';
  const floors=24;
  const route=['residential','industrial','slums','residential','industrial','market','residential','robotics','industrial','medical','slums','industrial','archive','elite','hydroponics','residential','industrial','robotics','utilities','industrial','medical','archive','elite','robotics'];
  function normalize(saved){return {cleared:Math.max(0,Math.min(floors,Math.floor(Number(saved?.cleared)||0))),completed:Boolean(saved?.completed),seconds:Math.max(0,Number(saved?.seconds)||0)};}
  function start(p){const c=normalize(p.campaign);return c.completed?1:Math.min(floors,1+Math.floor(c.cleared/3)*3);}
  function record(p,floor){p.campaign=normalize(p.campaign);p.campaign.cleared=Math.max(p.campaign.cleared,Math.min(floors,floor));}
  function length(floor){return 1+.035*(Math.min(floors,Math.max(1,floor))-1);}
  function difficulty(floor){return {health:1+.065*(floor-1),speed:Math.min(1.3,1+.013*(floor-1)),damage:Math.floor((floor-1)/4)};}
  function estimate({sectorMinutes=1.3,bossMinutes=2.5,hubMinutes=3,retryRate=.25}={}){return floors*(11*sectorMinutes+bossMinutes+hubMinutes)*(1+retryRate)/60;}
  window.Campaign={floors,route,normalize,start,record,length,difficulty,estimate};
})();
