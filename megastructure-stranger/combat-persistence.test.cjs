const {test}=require('node:test'),assert=require('node:assert/strict'),game=require('./combat-harness.cjs');
test('old and malformed attachment references normalize without item duplication or grants',()=>{
 const {g,Workshop:W}=game(),p=g.get(),gun=W.equipped(p,'smg');W.receive(p,[{defId:'attachment-optic-0',quality:2,condition:90},{defId:'pistol-0',quality:2,condition:100}]);
 const [part,other]=p.workshop.items.slice(-2);gun.attachments={optic:part.uid,barrel:'missing'};other.attachments={optic:part.uid};gun.fouling=Infinity;gun.roundVariant='unknown';
 const count=p.workshop.items.length,metal=p.resources.metal;W.init(p);assert.equal(p.workshop.items.length,count);assert.equal(p.resources.metal,metal);assert.equal(gun.fouling,0);assert.equal(gun.roundVariant,'standard');
 assert.equal(gun.attachments.optic,part.uid);assert.equal(other.attachments.optic,undefined);assert.equal(gun.attachments.barrel,undefined);
});
test('failed deployment save preserves supplies and resources exactly',()=>{
 const {g,Workshop:W,Resources:R,storage}=game(),p=g.get();p.workshop.table=5;p.resources=Object.fromEntries(R.catalog.map(r=>[r.id,100]));p.workshop.research=Object.fromEntries(R.catalog.map(r=>[r.id,true]));
 W.equipped(p,'smg').roundVariant='penetrator';W.receive(p,[{defId:'medical-medkit',quality:2,condition:100}]);
 const before=JSON.stringify(p);storage.setItem=()=>{throw Error('quota');};g.beginRun();assert.equal(JSON.stringify(g.get()),before);
});
test('automatic medical packing is bounded and preserves excess warehouse stock',()=>{
 const {g,Workshop:W,FieldMedicine:M}=game(),p=g.get();W.receive(p,Array.from({length:5},()=>({defId:'medical-medkit',quality:2,condition:100})));
 const stock=M.stock();W.packMedicine(p,stock);assert.equal(stock.medkit,4);assert.equal(p.workshop.items.filter(i=>i.defId==='medical-medkit').length,3);
});
