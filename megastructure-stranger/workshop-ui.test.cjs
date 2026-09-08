const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('terminal builds table and exposes populated inventory and paginated crafting',()=>{
  function node(tag){return {tag,children:[],dataset:{},attributes:{},style:{},open:false,append(...children){this.children.push(...children);},appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];},insertBefore(child,other){this.children.splice(this.children.indexOf(other),0,child);},setAttribute(key,value){this.attributes[key]=value;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},remove(){},focus(){},querySelector(selector){const key=selector.includes('timer')?'timer':'feedback';return flatten(this).find(el=>Object.hasOwn(el.dataset,key));}};}
  function flatten(root){return [root,...root.children.flatMap(flatten)];}
  const body=node('body');
  const scope=vm.createContext({window:{setInterval(){return 1;},clearInterval(){}},document:{body,createElement:node,createTextNode:text=>({...node('text'),textContent:text}),activeElement:null}});
  for(const file of ['resources.js','arsenal.js','workshop.js','workshop-ui.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),scope);
  const p={salvage:0,resources:{},equipment:{},hideout:{}};scope.window.Workshop.init(p);
  scope.window.WorkshopUI.show({get:()=>p,action:(name,...args)=>scope.window.Workshop[name](p,...args)});
  const dialog=body.children[0];assert.equal(dialog.open,true);
  const click=text=>{const button=flatten(dialog).find(el=>el.tag==='button'&&el.textContent===text);assert.ok(button,text);button.onclick();};
  click('Собрать исследовательский стол');assert.equal(p.workshop.table,1);
  click('Предметы');assert.ok(flatten(dialog).some(el=>el.textContent==='ПП Охраны'));
  click('Производство');assert.ok(flatten(dialog).filter(el=>el.tag==='article').length<=24);
  assert.ok(flatten(dialog).some(el=>String(el.textContent).includes('100 позиций')));
});
