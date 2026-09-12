import { Geometry, V } from './engine.js';
import { placementPoint, rotateVector, transformCollider, assemblyFrame } from './structure-layout.mjs';

export function drawStructureInfill(plan, placements, g, colliders, addBeam, palette, detail) {
  const bounds = [], frame = assemblyFrame(plan);
  for (const placement of placements) {
    const [w, h, d] = placement.half, body = new Geometry(), solids = [];
    const box = (center, size, color) => { body.box(center, size, color); solids.push({ type: 'box', center, size }); };
    if (detail < 0) box([0, 0, 0], [w * 2, h * 2, d * 2], palette.stone);
    else {
      const levels = Math.max(2, Math.round(h / 11));
      for (let i = 0; i <= levels; i++) box([0, -h + 2 + (h * 2 - 4) * i / levels, 0], [w * 2, 4, d * 2], i % 2 ? palette.pale : palette.stone);
      box([-w + 3, 0, 0], [6, h * 2, d * 2], palette.stone);
      for (const z of [-d + 2, d - 2]) box([w - 2, 0, z], [4, h * 2, 4], palette.metal);
      if (plan.era >= 2) box([0, 0, -d + 2], [w * 2, h * 2, 4], palette.stone);
    }
    for (let i = 0; i < body.data.length; i += 10) g.vertex(placementPoint(body.data.slice(i, i + 3), placement), rotateVector(body.data.slice(i + 3, i + 6), placement.axes), body.data.slice(i + 6, i + 9), body.data[i + 9]);
    for (const solid of solids) colliders.push(transformCollider(solid, placement));

    const center = frame.map(axis => V.dot(placement.center, axis));
    bounds.push({ min: V.sub(center, placement.half), max: V.add(center, placement.half) });
  }
  return bounds;
}
