const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const s=vm.createContext({window:{}});for(const f of ['resources.js','arsenal.js','workshop.js','combat-model.js','armor-system.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${f}`,'utf8'),s);const p={resources:{},equipment:{},hideout:{},salvage:0};s.window.Workshop.init(p);return {...s.window,p};}
test('head impacts wear only the helmet and penetration bypasses more protection',()=>{
 const {p,Workshop:W,ArmorSystem:A,CombatModel:C}=load(),helmet=W.equipped(p,'helmet'),chest=W.equipped(p,'chest');
 const layers=A.layers(p,'head');assert.equal(layers.length,1);const blocked=C.applyLayers(20,'ballistic',0,layers).blocked;
 assert.ok(helmet.condition<100);assert.equal(chest.condition,100);
 helmet.condition=100;assert.ok(C.applyLayers(20,'ballistic',.9,A.layers(p,'head')).blocked<blocked);
});
test('one front plate cannot protect the rear or uncovered limbs',()=>{
 const {p,Workshop:W,ArmorSystem:A}=load();W.receive(p,[{defId:'chest-13',quality:2,condition:100},{defId:'plate-steel-3',quality:2,condition:100}]);
 const [carrier,plate]=p.workshop.items.slice(-2);W.equip(p,carrier.uid);W.mount(p,plate.uid);
 assert.ok(A.layers(p,'thorax',{vx:-1,vy:0},{angle:0}).some(l=>l.id===plate.uid));
 assert.ok(!A.layers(p,'thorax',{vx:1,vy:0},{angle:0}).some(l=>l.id===plate.uid));
 assert.ok(!A.layers(p,'head').some(l=>l.id===plate.uid));assert.ok(A.burden(p).mass>0);
});
