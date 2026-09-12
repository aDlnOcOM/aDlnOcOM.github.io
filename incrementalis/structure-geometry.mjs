import { Geometry, V } from './engine.js';
import { structureLinks, spaceScale } from './structure-space.mjs';
import { structureBody } from './structure-body.mjs';
import { structureLayout, structureInfill, placementPoint, rotateVector, transformCollider, assemblyFrame } from './structure-layout.mjs';
import { structurePalette } from './structure-palette.mjs';
import { structureEnvelope } from './structure-envelope.mjs';
import { drawStructureInfill } from './structure-infill.mjs';
import { structureFrame } from './structure-frame.mjs';

function silhouette(plan) {
  const g = new Geometry(), { stone, metal } = structurePalette(plan);
  const box = (p, s) => g.box(p, s, stone);
  const beam = (a, b, r = 3) => g.tube([a, b], [r, r], metal, 4);
  const ring = (y, r) => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, b = (i + 1) / 8 * Math.PI * 2; beam([Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos(b)*r,y,Math.sin(b)*r],4); } };
  if (['pyramid','ziggurat','stepwell'].includes(plan.type)) for (let i=0;i<5;i++) box([0,-65+i*31,0],[160-i*27,27,160-i*27]);
  else if (['torii','pailou','dolmen'].includes(plan.type)) for (const z of [-50,50]) { box([-36,0,z],[8,120,8]);box([36,0,z],[8,120,8]);box([0,60,z],[100,9,16]); }
  else if (['pagoda','stupa','minaret'].includes(plan.type)) { for(const y of [-65,0,65]) box([0,y,0],[125-y*.25,9,125-y*.25]);beam([0,-80,0],[0,95,0],12); }
  else if (['torus','hyperboloid','coolingStack','silo','turbine','geodesic','mobius','helicoid','gyroid'].includes(plan.type)) { for(const y of [-70,0,70])ring(y,plan.type==='hyperboloid'&&y===0?28:62);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;beam([Math.cos(a)*62,-70,Math.sin(a)*62],[Math.cos(a+.35)*62,70,Math.sin(a+.35)*62]);} }
  else if (['menger','hypercube','octahedron','sierpinski','diagrid'].includes(plan.type)) { const p=Array.from({length:8},(_,i)=>[i&1?67:-67,i&2?80:-80,i&4?67:-67]);for(let i=0;i<8;i++)for(let k=0;k<3;k++)if(!(i&1<<k))beam(p[i],p[i|1<<k]); }
  else { for(const x of [-60,60])for(const z of [-55,55])box([x,0,z],[12,168,12]);for(const y of [-75,0,75])box([0,y,0],[145,8,130]); }
  return {geometry:g,colliders:[]};
}

/** Body orientation never changes the shared, world-aligned interface sockets. */
export function structureGeometry(plan, detail = 2) {
  const g = new Geometry(), colliders = [], placements = structureLayout(plan), {stone,pale,metal} = structurePalette(plan), s = plan.scale;
  // Small repeated bodies use the structural mesh, without sub-pixel ornament.
  let bodyDetail = placements.length <= 2 ? Math.max(0, detail) : 0;
  let body = detail < 0 ? silhouette(plan) : structureBody(plan, bodyDetail);
  while (bodyDetail > 0 && body.geometry.data.length / 10 * placements.length > 60000) body = structureBody(plan, --bodyDetail);
  const structuralBody = detail >= 0 && bodyDetail === 0 ? body : structureBody(plan, 0);
  const sourceBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < structuralBody.geometry.data.length; i += 10) for (let axis = 0; axis < 3; axis++) {
    const v = structuralBody.geometry.data[i + axis]; sourceBounds.min[axis] = Math.min(sourceBounds.min[axis], v); sourceBounds.max[axis] = Math.max(sourceBounds.max[axis], v);
  }
  const addBeam = (a,b,r=1,color=metal,solid=true) => { g.tube([a,b],[r,r],color,detail > 0?6:4);if(solid)colliders.push({type:'beam',a,b,radius:r}); };
  const core = Array.from({length:8},(_,i)=>[i&1?16:-16,i&2?16:-16,i&4?16:-16]);
  const frame = assemblyFrame(plan), bounds = [];
  for(let i=0;i<8;i++)for(let axis=0;axis<3;axis++)if(!(i&1<<axis))addBeam(core[i],core[i|1<<axis],1.2,pale);

  for (const placement of placements) {
    const data = body.geometry.data;
    const bound = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (let i=0;i<data.length;i+=10) {
      const p = placementPoint(data.slice(i,i+3),placement), normal = rotateVector(data.slice(i+3,i+6),placement.axes);
      g.vertex(p,normal,data.slice(i+6,i+9),data[i+9]);
    }
    for (let corner = 0; corner < 8; corner++) {
      const p = placementPoint([0, 1, 2].map(axis => (corner & 1 << axis ? sourceBounds.max : sourceBounds.min)[axis]), placement);
      frame.forEach((axis, j) => { const v = V.dot(p, axis); bound.min[j] = Math.min(bound.min[j], v); bound.max[j] = Math.max(bound.max[j], v); });
    }
    for(const c of body.colliders)colliders.push(transformCollider(c,placement));
    bounds.push(bound);
  }

  for (const link of structureLinks(plan)) {
    const end=V.mul(V.sub(link.to,link.from),1/s), ratio=spaceScale(Math.hypot(...link.neighbor))/s;
    const from=[0,0,0],to=[...end];from[link.axis]=16;to[link.axis]-=16*ratio;
    const across=[0,1,2].filter(axis=>axis!==link.axis);
    const point=(t,u,v)=>{const p=V.mix(from,to,t),width=16*(1+(ratio-1)*t);p[across[0]]+=u*width;p[across[1]]+=v*width;return p;};
    for(const u of [-1,1])for(const v of [-1,1])addBeam(point(0,u,v),point(1,u,v),1.15,metal);
    const count=detail>1?10:detail>0?6:2;
    for(let i=0;i<=count;i++){
      const t=i/count;for(const sign of [-1,1]){addBeam(point(t,sign,-1),point(t,sign,1),.8,pale);addBeam(point(t,-1,sign),point(t,1,sign),.8,pale);}
    }
    if(link.axis!==1){
      const yIndex=across.indexOf(1),corners=yIndex===0?[[ -1,-1],[-1,1]]:[[-1,-1],[1,-1]];
      const a=point(0,...corners[0]),b=point(0,...corners[1]),c=point(1,...corners[1]),d=point(1,...corners[0]);
      g.quad(a,b,c,d,stone);g.quad(V.add(d,[0,-2,0]),V.add(c,[0,-2,0]),V.add(b,[0,-2,0]),V.add(a,[0,-2,0]),metal);
      const p=V.mix(a,b,.5),q=V.mix(c,d,.5),length=Math.hypot(...V.sub(q,p)),along=V.norm(V.sub(q,p)),side=V.norm(V.cross(along,[0,1,0])),up=V.cross(side,along);
      const pieces=Math.ceil(length/8);
      for(let i=0;i<pieces;i++){const t=(i+.5)/pieces;colliders.push({type:'obb',center:V.sub(V.mix(p,q,t),up),half:[length/pieces/2+.1,1.05,16*(1+(ratio-1)*t)],axes:[along,up,side]});}
    }
  }

  const infill = structureInfill(plan, placements);
  bounds.push(...drawStructureInfill(plan, infill, g, colliders, addBeam, {stone,pale,metal}, detail));
  const assembly = structureFrame(plan, bounds, g, colliders, {stone,pale,metal}, addBeam);
  structureEnvelope(plan, g, colliders, addBeam, {stone,pale,metal}, detail);

  for(let i=0;i<g.data.length;i+=10)for(let axis=0;axis<3;axis++)g.data[i+axis]*=s;
  for(const c of colliders){
    if(c.type==='obb'){c.center=V.mul(c.center,s);c.half=V.mul(c.half,s);c.extent=[0,1,2].map(axis=>c.half.reduce((n,h,i)=>n+h*Math.abs(c.axes[i][axis]),0));}
    else{c.a=V.mul(c.a,s);c.b=V.mul(c.b,s);c.radius*=s;}
  }
  return {geometry:g,colliders,origin:plan.origin,placements,infill,assembly};
}
