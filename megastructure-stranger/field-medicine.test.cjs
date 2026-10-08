const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const s=vm.createContext({window:{}});for(const f of ['combat-model.js','field-medicine.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${f}`,'utf8'),s);return s.window;}
test('cancelled treatment spends nothing and completed bandage cures bleeding once',()=>{
 const {CombatModel:C,FieldMedicine:M}=load(),p={body:C.createBody(100)},stock=M.stock();p.body.status.bleed=.5;
 assert.ok(M.start(p,stock,'bandage'));M.tick(p,stock,.1);M.cancel(p);assert.equal(stock.bandage,2);
 assert.ok(M.start(p,stock,'bandage'));for(let i=0;i<31;i++)M.tick(p,stock,.1);
 assert.equal(stock.bandage,1);assert.equal(p.body.status.bleed,0);assert.equal(M.start(p,stock,'bandage'),false);
});
test('medkits cannot resurrect dead bodies or destroyed limbs; surgery has a lasting cost',()=>{
 const {CombatModel:C,FieldMedicine:M}=load(),p={body:C.createBody(100)},stock={...M.stock(),surgery:1};p.body.parts.legs.health=0;
 assert.equal(M.start(p,stock,'medkit'),false);assert.ok(M.start(p,stock,'surgery'));
 for(let i=0;i<101;i++)M.tick(p,stock,.1);assert.equal(stock.surgery,0);assert.ok(p.body.parts.legs.max<12);assert.ok(p.body.parts.legs.health>0);
 C.receive(p.body,{amount:100,zone:'head'});assert.equal(M.start(p,stock,'medkit'),false);
});
