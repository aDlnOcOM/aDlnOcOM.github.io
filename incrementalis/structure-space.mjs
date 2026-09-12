import { STRUCTURE_FAMILIES, ASSEMBLIES } from './structure-catalog.mjs';

export const CELL_SIZE = 240;
export const STRUCTURE_TYPES = STRUCTURE_FAMILIES.map(family => family.id);

export function hashCell(x, y, z, seed = 0) {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ seed) >>> 0;
  h = Math.imul(h ^ h >>> 16, 0x7feb352d); h = Math.imul(h ^ h >>> 15, 0x846ca68b);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}

export function spaceScale(radius) { return 1 + .22 * Math.log1p(Math.max(0, radius)); }
export function gridToWorld(grid) { const s = CELL_SIZE * spaceScale(Math.hypot(...grid)); return grid.map(v => v * s); }
export function worldToGrid(position) {
  const distance = Math.hypot(...position) / CELL_SIZE;
  if (!distance) return [0, 0, 0];
  let lo = 0, hi = distance;
  for (let i = 0; i < 44; i++) { const mid = (lo + hi) / 2; if (mid * spaceScale(mid) < distance) lo = mid; else hi = mid; }
  return position.map(v => v / CELL_SIZE * ((lo + hi) / 2) / distance);
}
export function cellAt(position) { return worldToGrid(position).map(v => Math.round(v) || 0); }

export function structurePlan(cell, seed) {
  const radius = Math.hypot(...cell), origin = gridToWorld(cell), scale = spaceScale(radius);
  const distance = Math.hypot(...origin), order = 1 + Math.log2(1 + distance / 550);
  const hash = hashCell(...cell, seed), epoch = Math.log2(1 + distance / 850);
  // Chronology changes continuously; the probabilistic boundary interleaves eras.
  const era = Math.min(5, Math.floor(epoch + hashCell(...cell, seed ^ 9517) * .3));
  const families = STRUCTURE_FAMILIES.filter(family => era >= family.firstEra && era <= family.lastEra);
  const type = radius < .1 ? 'colonnade' : families[Math.floor(hash * families.length)].id;
  const layout = radius < .1 ? 6 : Math.floor(hashCell(...cell, seed ^ 78233) * ASSEMBLIES.length);
  return { cell: [...cell], origin, scale, distance, order, epoch, era, type, layout, variantId: `${type}:${ASSEMBLIES[layout].id}`, seed, hash, angle: hash * Math.PI * 2 + Math.log1p(distance) * 2.399963229728653 };
}

/** One owner per edge, with shared endpoints; all six directions are connected. */
export function structureLinks(plan) {
  return [0, 1, 2].map(axis => {
    const neighbor = [...plan.cell]; neighbor[axis]++;
    return { axis, from: [...plan.origin], to: gridToWorld(neighbor), neighbor };
  });
}

/** Rotate a 4D tesseract, then use perspective projection into three dimensions. */
export function tesseractGraph(angle, size) {
  const vertices = Array.from({ length: 16 }, (_, mask) => {
    const p = [0, 1, 2, 3].map(i => mask & 1 << i ? 1 : -1);
    for (const [a, b, theta] of [[0, 3, angle], [1, 3, angle * .618], [0, 2, angle * .27]]) {
      const x = p[a], y = p[b]; p[a] = x * Math.cos(theta) - y * Math.sin(theta); p[b] = x * Math.sin(theta) + y * Math.cos(theta);
    }
    return p.slice(0, 3).map(v => v * size * 2.7 / (2.7 - p[3] * .65));
  });
  const edges = [];
  for (let i = 0; i < 16; i++) for (let axis = 0; axis < 4; axis++) if (!(i & 1 << axis)) edges.push([i, i | 1 << axis]);
  return { vertices, edges };
}
