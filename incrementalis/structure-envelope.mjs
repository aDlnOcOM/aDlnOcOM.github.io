import { V } from './engine.js';
import { gridToWorld, hashCell, spaceScale } from './structure-space.mjs';

/** Shared cell faces form dense, stacked halls around the flight network. */
export function structureEnvelope(plan, g, colliders, addBeam, palette, detail) {
  const { stone, pale, metal } = palette;
  const point = grid => V.mul(V.sub(gridToWorld(grid), plan.origin), 1 / plan.scale);
  const panel = (corners, thickness, color) => {
    const along = V.norm(V.sub(corners[1], corners[0]));
    const normal = V.norm(V.cross(along, V.sub(corners[3], corners[0]))), up = V.cross(normal, along);
    const axes = [along, up, normal], centre = corners.reduce((sum, p) => V.add(sum, V.mul(p, .25)), [0, 0, 0]);
    const front = corners.map(p => V.add(p, V.mul(normal, thickness / 2))), back = corners.map(p => V.sub(p, V.mul(normal, thickness / 2)));
    g.quad(...front, color); g.quad(back[3], back[2], back[1], back[0], metal);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; g.quad(front[i], back[i], back[j], front[j], pale); }
    const half = axes.map((axis, i) => Math.max(...corners.map(p => Math.abs(V.dot(V.sub(p, centre), axis)))) + (i === 2 ? thickness / 2 + .2 : .15));
    colliders.push({ type: 'obb', center: centre, half, axes });
  };

  for (let axis = 0; axis < 3; axis++) {
    const random = hashCell(...plan.cell, plan.seed ^ (axis + 1) * 8317);
    // Open galleries interrupt the dense walls; their position never depends on LOD.
    const gallery = axis !== 1 && random < .22;
    const cross = [0, 1, 2].filter(i => i !== axis), hole = .17 + random * .055;
    const at = (u, v) => {
      const grid = [...plan.cell]; grid[axis] += .5; grid[cross[0]] += u; grid[cross[1]] += v;
      return point(grid);
    };
    const rectangles = [[-.5, -.5, -.5 + .11, .5], [.5 - .11, -.5, .5, .5], [-.39, -.5, .39, -hole], [-.39, hole, .39, .5]];
    // Deep returns around each aperture make the surfaces read as massive walls.
    if (!gallery) rectangles.push([-.39, -hole, -hole, hole], [hole, -hole, .39, hole]);
    for (const [u0, v0, u1, v1] of rectangles) {
      const parts = detail < 0 ? 1 : 3;
      for (let i = 0; i < parts; i++) {
        const a = u0 + (u1 - u0) * i / parts, b = u0 + (u1 - u0) * (i + 1) / parts;
        panel([at(a, v0), at(b, v0), at(b, v1), at(a, v1)], axis === 1 ? 7 : 5, stone);
      }
    }
    for (const sign of [-1, 1]) {
      addBeam(at(sign * hole, -hole), at(sign * hole, hole), 2.4, pale);
      addBeam(at(-hole, sign * hole), at(hole, sign * hole), 2.4, pale);
    }
    // The transit galleries are borne by the aperture, not suspended in its void.
    const neighbor = [...plan.cell]; neighbor[axis]++;
    const ratio = spaceScale(Math.hypot(...neighbor)) / plan.scale;
    const start = [0, 0, 0], end = V.mul(V.sub(gridToWorld(neighbor), plan.origin), 1 / plan.scale);
    start[axis] = 16; end[axis] -= 16 * ratio;
    const middle = V.mix(start, end, .5), width = 8 * (1 + ratio);
    for (const u of [-1, 1]) for (const v of [-1, 1]) {
      const rail = [...middle]; rail[cross[0]] += u * width; rail[cross[1]] += v * width;
      addBeam(rail, at(u * hole, v * hole), 1.6, metal);
    }
    if (detail >= 0) for (let i = -2; i <= 2; i++) {
      const u = i * .19;
      for (const sign of [-1, 1]) addBeam(at(u, sign * (hole + .015)), at(u, sign * .49), 1.1, metal);
    }
  }
}
