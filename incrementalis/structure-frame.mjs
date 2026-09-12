import { Geometry, V } from './engine.js';
import { assemblyFrame, rotateVector, flightCorridors, boxesOverlap } from './structure-layout.mjs';
import { gridToWorld } from './structure-space.mjs';

/** A continuous foundation-column-roof system carries every architectural wing. */
export function structureFrame(plan, bounds, g, colliders, palette, addBeam) {
  const axes = assemblyFrame(plan), corridors = flightCorridors(plan), posts = [], connections = [];
  const box = (center, size, color) => {
    const part = new Geometry(); part.box(center, size, color);
    for (let i = 0; i < part.data.length; i += 10) g.vertex(rotateVector(part.data.slice(i, i + 3), axes), rotateVector(part.data.slice(i + 3, i + 6), axes), part.data.slice(i + 6, i + 9));
    const collider = { type: 'obb', center: rotateVector(center, axes), half: V.mul(size, .5), axes };
    colliders.push(collider); return collider;
  };
  for (const y of [-107, 107]) for (const sign of [-1, 1]) {
    box([sign * 72, y, 0], [68, 6, 212], palette.stone);
    box([0, y, sign * 72], [76, 6, 68], palette.stone);
  }
  for (const x of [-94, -40, 40, 94]) for (const z of [-94, -40, 40, 94]) {
    const post = [x, 0, z]; posts.push(post); box(post, [5, 208, 5], palette.pale);
  }
  for (const y of [-1, 1]) for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const start = rotateVector([x * 103, y * 107, z * 72], axes);
    const grid = V.add(plan.cell, rotateVector([x * .5, y * .46, z * .32], axes));
    const end = V.mul(V.sub(gridToWorld(grid), plan.origin), 1 / plan.scale);
    addBeam(start, end, 2.8, palette.pale);
  }
  const segment = (a, b) => {
    const center = V.mul(V.add(a, b), .5), size = a.map((v, i) => Math.abs(v - b[i]) + (i === 1 ? 2.4 : 3.2));
    return { center, size, volume: { center: rotateVector(center, axes), half: V.mul(size, .5), axes } };
  };
  for (const [index, bound] of bounds.entries()) {
    const y = bound.min[1] - 1.2, center = V.mul(V.add(bound.min, bound.max), .5);
    const base = [center[0], y, center[2]], size = [Math.max(2, bound.max[0] - bound.min[0]), 2.4, Math.max(2, bound.max[2] - bound.min[2])];
    box(base, size, palette.stone);
    const ordered = [...posts].sort((a, b) => Math.hypot(a[0] - center[0], a[2] - center[2]) - Math.hypot(b[0] - center[0], b[2] - center[2]));
    const routes = [];
    for (const post of ordered) {
      const target = [post[0], y, post[2]];
      const start = [Math.max(bound.min[0], Math.min(bound.max[0], post[0])), y, Math.max(bound.min[2], Math.min(bound.max[2], post[2]))];
      let route = null;
      for (const corner of [[target[0], y, start[2]], [start[0], y, target[2]]]) {
        const parts = [segment(start, corner), segment(corner, target)];
        if (parts.every(part => !corridors.some(c => boxesOverlap(part.volume, c)))) { route = { start, target, parts }; break; }
      }
      if (!route) continue;
      for (const part of route.parts) box(part.center, part.size, palette.metal);
      routes.push({ start: route.start, target: route.target });
      if (routes.length === 2) break;
    }
    connections.push({ index, base, routes });
  }
  return { axes, posts, connections };
}
