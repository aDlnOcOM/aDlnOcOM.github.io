const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const flatten=n=>[n,...n.children.flatMap(flatten)];
 const node=tag=>({tag,children:[],attributes:{},listeners:{},append(...n){this.children.push(...n);},appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){this.listeners[k]=f;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},remove(){},focus(){}});
 const body=node('body'),s=vm.createContext({window:{},document:{body,createElement:node}});
 for(const f of ['resources','arsenal','workshop','gunsmith-ui'])vm.runInContext(fs.readFileSync(`${__dirname}/${f}.js`,'utf8'),s);
 const W=s.window.Workshop,p={resources:{},equipment:{},hideout:{},salvage:0};W.init(p);W.receive(p,[{defId:'attachment-optic-0',quality:2,condition:100}]);return {...s.window,p,body,flatten};
}
test('workbench previews compatible optics, saves installation and returns detached parts to stash',()=>{
 const {p,Workshop:W,GunsmithUI:U,body,flatten}=setup(),gun=W.equipped(p,'smg'),part=p.workshop.items.at(-1),before=U.build(p,gun);
 U.show({get:()=>p,action:(name,...args)=>W[name](p,...args)},gun.uid);const d=body.children[0];assert.equal(d.open,true);
 const select=flatten(d).find(n=>n.attributes['aria-label']==='Выбор: Прицел');select.value=part.uid;select.onchange();
 assert.ok(flatten(d).some(n=>String(n.textContent).includes('→')));
 const install=flatten(d).find(n=>n.tag==='button'&&n.textContent==='Установить'&&!n.disabled);assert.ok(install);install.onclick();
 assert.equal(gun.attachments.optic,part.uid);assert.ok(U.build(p,gun).spread<before.spread);
 flatten(d).find(n=>n.textContent==='Снять на склад').onclick();assert.equal(gun.attachments.optic,undefined);assert.ok(p.workshop.items.includes(part));
});
