import { V } from './engine.js';
import { ASSEMBLIES } from './structure-catalog.mjs';
import { gridToWorld } from './structure-space.mjs';

export const CELL_INTERIOR = 106;
export const BODY_HALF = [100, 110, 100];
export const IDENTITY_FRAME = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const FLIGHT_CORRIDORS = [0, 1, 2].map(axis => ({ center: [0, 0, 0], half: [0, 1, 2].map(i => i === axis ? 124 : 18), axes: IDENTITY_FRAME }));

export function flightCorridors(plan) {
  return [0, 1, 2].flatMap(axis => [-1, 1].map(sign => {
    const neighbor = [...plan.cell]; neighbor[axis] += sign;
    const end = V.mul(V.sub(gridToWorld(neighbor), plan.origin), 1 / plan.scale);
    const along = V.norm(end), reference = axis === 1 ? [1, 0, 0] : [0, 1, 0];
    const side = V.norm(V.cross(along, reference)), up = V.cross(side, along);
    return { center: V.mul(end, .5), half: [Math.hypot(...end) / 2, 22, 22], axes: [along, up, side] };
  }));
}

function noise(seed, index) { let h = Math.imul(seed ^ index, 0x45d9f3b); h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
export function rotateVector(p, axes) { return [0, 1, 2].map(i => axes[0][i] * p[0] + axes[1][i] * p[1] + axes[2][i] * p[2]); }
export function placementPoint(p, placement) { return V.add(placement.center, V.mul(rotateVector(p, placement.axes), placement.scale)); }

export function orientationFrame(up, roll = 0) {
  const y = V.norm(up), reference = Math.abs(y[2]) > .92 ? [0, 1, 0] : [0, 0, 1];
  const x = V.norm(V.cross(y, reference)), z = V.cross(x, y);
  return [V.add(V.mul(x, Math.cos(roll)), V.mul(z, Math.sin(roll))), y, V.add(V.mul(z, Math.cos(roll)), V.mul(x, -Math.sin(roll)))];
}

/** One structural up direction for the entire complex, including its galleries. */
export function assemblyFrame(plan) {
  const directions = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const seed = plan.seed ^ Math.floor(plan.hash * 1e9);
  const direction = plan.era === 0 && noise(seed, 301) < .65 ? 0 : Math.floor(noise(seed, 901) * 6);
  return orientationFrame(directions[direction], Math.floor(noise(seed, 117) * 4) * Math.PI / 2);
}

/** Full separating-axis test, including all nine edge cross products. */
export function boxesOverlap(a, b, gap = 0) {
  const delta = V.sub(b.center, a.center), axes = [...a.axes, ...b.axes];
  for (const x of a.axes) for (const y of b.axes) { const cross = V.cross(x, y); if (Math.hypot(...cross) > 1e-7) axes.push(V.norm(cross)); }
  for (const axis of axes) {
    const radius = box => box.half.reduce((sum, half, i) => sum + half * Math.abs(V.dot(box.axes[i], axis)), 0);
    if (Math.abs(V.dot(delta, axis)) >= radius(a) + radius(b) + gap) return false;
  }
  return true;
}

export function placementFits(candidate, occupied = [], corridors = FLIGHT_CORRIDORS) {
  if ([0, 1, 2].some(axis => Math.abs(candidate.center[axis]) + candidate.half.reduce((sum, half, i) => sum + Math.abs(candidate.axes[i][axis]) * half, 0) > CELL_INTERIOR)) return false;
  if (corridors.some(corridor => boxesOverlap(candidate, corridor, 1.5))) return false;
  return !occupied.some(other => boxesOverlap(candidate, other, 3));
}

/** Reserved cell volumes make layout independent of load order and mesh LOD. */
export function structureLayout(plan) {
  const layout = ASSEMBLIES[plan.layout ?? 0], placements = [], corridors = flightCorridors(plan), frame = assemblyFrame(plan);
  for (let index = 0; index < layout.slots.length; index++) {
    const slot = layout.slots[index], center = rotateVector(slot, frame);
    // Facades face the central court; their floors share the complex's gravity.
    const yaw = Math.round(Math.atan2(-slot[0], -slot[2]) / (Math.PI / 2)) * Math.PI / 2;
    const axes = orientationFrame([0, 1, 0], yaw).map(axis => rotateVector(axis, frame));
    for (let shrink = 0; shrink < 12; shrink++) {
      const scale = layout.size / 110 * .87 ** shrink;
      const candidate = { center, half: BODY_HALF.map(v => v * scale), axes, scale, index };
      if (placementFits(candidate, placements, corridors)) { placements.push(candidate); break; }
    }
  }
  // Repeated wings share bay dimensions and floor heights within one complex.
  const sharedScale = Math.min(...placements.map(p => p.scale));
  for (const p of placements) { p.half = p.half.map(v => v * sharedScale / p.scale); p.scale = sharedScale; }
  return placements;
}

export function transformCollider(c, placement, worldScale = 1) {
  const point = p => V.mul(placementPoint(p, placement), worldScale);
  if (c.type === 'box') return { type: 'obb', center: point(c.center), half: c.size.map(v => v * placement.scale * worldScale / 2), axes: placement.axes };
  return { type: 'beam', a: point(c.a), b: point(c.b), radius: c.radius * placement.scale * worldScale };
}

/** Fill free peripheral volumes without narrowing the reserved passages. */
export function structureInfill(plan, primary = structureLayout(plan)) {
  const corridors = flightCorridors(plan), occupied = [...primary], result = [], frame = assemblyFrame(plan);
  const coordinates = [-82, -46, 0, 46, 82], candidates = [];
  for (const y of [-104, -36, 36]) for (const x of coordinates) for (const z of coordinates) {
    if (Math.max(Math.abs(x), Math.abs(z)) < 46) continue;
    const key = (x + 100) * 7127 + (y + 100) * 277 + z + 100;
    candidates.push({ x, z, order: Math.max(Math.abs(x), Math.abs(z)), key, y });
  }
  // Complete perimeter rows from the foundation upwards, rather than scattering.
  candidates.sort((a, b) => a.y - b.y || b.order - a.order || a.key - b.key);
  for (const candidate of candidates) {
    for (const half of [[17, 32, 17], [14, 20, 14], [12, 12, 12]]) {
      const center = rotateVector([candidate.x, candidate.y + half[1], candidate.z], frame);
      const volume = { center, axes: frame, half, scale: 1, index: candidate.key };
      if (placementFits(volume, occupied, corridors)) { occupied.push(volume); result.push(volume); break; }
    }
    if (result.length === 24) break;
  }
  return result;
}
