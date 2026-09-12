import { Geometry, V } from './engine.js';
import { tesseractGraph } from './structure-space.mjs';
import { drawExtraFamily } from './structure-families.mjs';
import { structurePalette } from './structure-palette.mjs';

const TAU = Math.PI * 2;

/** Geometry stays near its cell origin; the renderer places it relative to the camera. */
export function structureBody(plan, detail = 2) {
  const g = new Geometry(), colliders = [];
  const {stone, pale, metal, dark, light} = structurePalette(plan);
  const ancient = plan.epoch < 2;
  const box = (p, size, c = stone, solid = true, emission = 0) => {
    g.box(p, size, c, 0, emission);
    if (solid) colliders.push({ type: 'box', center: p, size });
  };
  const beam = (a, b, r = .65, c = metal, solid = true, emission = 0) => {
    if (Math.hypot(...V.sub(a, b)) < .001) return;
    g.tube([a, b], [r, r], c, detail ? 6 : 4, emission);
    if (solid) colliders.push({ type: 'beam', a, b, radius: r });
  };
  const circle = (y, r, thickness = 1, c = pale, count = 32) => {
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU, b = (i + 1) / count * TAU;
      beam([r * Math.cos(a), y, r * Math.sin(a)], [r * Math.cos(b), y, r * Math.sin(b)], thickness, c);
    }
  };
  const frameFloor = (y, w, d, hole = 17, thickness = 3) => {
    for (const side of [-1, 1]) {
      box([side * (w + hole) / 2, y, 0], [w - hole, thickness, 2 * d], stone);
      box([0, y, side * (d + hole) / 2], [2 * hole, thickness, d - hole], stone);
    }
  };
  function hall(vault = false, classical = false) {
    frameFloor(-51, 56, 94, 18, 5); frameFloor(82, 56, 94, 19, 5);
    if (classical) for (const side of [-1, 1]) {
      for (const z of [-69, 69]) {
        const height = 12 + ((z + 70) * 7 % 19);
        box([side * 35, -47, z], [9, 4, 9], stone);
        beam([side * 35, -45, z], [side * 35 + .8, -45 + height, z], 2.7, pale);
      }
      beam([side * 36, -46, -48], [side * 40, -46, -28], 2.6, stone);
      box([side * 36, -47, 38], [7, 3, 6], pale);
    }
    for (const side of [-1, 1]) {
      for (let z = -84; z <= 84; z += 28) {
        if (classical) {
          beam([side * 49, -43, z], [side * 49, 72, z], 3.8, pale);
          if (detail > 1) for (let i = 0; i < 10; i++) {
            const a = i / 10 * TAU, x = side * 49 + Math.cos(a) * 3.8, zz = z + Math.sin(a) * 3.8;
            beam([x, -38, zz], [x, 67, zz], .22, stone, false);
          }
        } else box([side * 49, 14, z], [6, 132, 6], pale);
        box([side * 49, -39, z], [10, 13, 10], metal);
        box([side * 49, 72, z], [10, 9, 10], metal);
        if (detail) {
          if (!ancient) box([side * 45.8, 14, z], [.12, 104, .28], light, false, .65);
          beam([side * 49, 60, z], [side * 29, 79, z], 1.2, stone);
        }
      }
      for (const y of [-25, 30, 57]) {
        box([side * 51, y, 0], [13, 2, 188], metal);
        if (detail && !ancient) box([side * 44.3, y + .2, 0], [.2, .22, 185], light, false, .6);
      }
      // Facades leave a broad opening on each horizontal axis.
      for (const z of [-72, -43, 43, 72]) {
        box([side * 56, 9, z], [4, 122, 20]);
        if (detail > 1) for (let y = -39; y < 66; y += 13) {
          box([side * 53.7, y, z], [.6, 9, 14], y % 2 ? pale : metal, false);
          box([side * 53.3, y + 4.3, z], [.2, .22, 11], dark, false);
        }
      }
    }
    for (let z = -84; z <= 84; z += 28) {
      if (vault) {
        const number = detail ? 17 : 9;
        const points = Array.from({ length: number }, (_, i) => { const t = i / (number - 1) * Math.PI; return [Math.cos(t) * 49, 36 + Math.sin(t) * 43, z]; });
        for (let i = 1; i < points.length; i++) beam(points[i - 1], points[i], 1.7, pale);
      } else {
        beam([-49, 74, z], [49, 74, z], 2, pale);
        if (detail) for (let x = -42; x < 42; x += 14) {
          beam([x, 74, z], [x + 7, 65, z], .65); beam([x + 7, 65, z], [x + 14, 74, z], .65);
        }
      }
    }
  }

  function roof(y, width, depth) {
    const inner = [[-width * .7, y + 9, -depth * .7], [width * .7, y + 9, -depth * .7], [width * .7, y + 9, depth * .7], [-width * .7, y + 9, depth * .7]];
    const outer = [[-width, y + 3, -depth], [width, y + 3, -depth], [width, y + 3, depth], [-width, y + 3, depth]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4; g.quad(inner[i], outer[i], outer[j], inner[j], metal);
      beam(outer[i], outer[j], 1.4, metal);
      if (detail) for (let t = 0; t < 1; t += .1) beam(V.mix(inner[i], inner[j], t), V.mix(outer[i], outer[j], t), .26, stone, false);
    }
  }

  function torii() {
    const red = [.39, .15, .10];
    frameFloor(-18, 62, 94, 17, 4);
    for (const z of [-77, -38, 0, 38, 77]) {
      for (const side of [-1, 1]) {
        beam([side * 41, -16, z], [side * 36, 56, z], 3.2, red);
        box([side * 41, -12, z], [10, 10, 10], stone);
      }
      box([0, 43, z], [88, 4, 6], red);
      box([0, 55, z], [94, 5, 8], red);
      beam([-52, 61, z], [-29, 58, z], 2.5, metal); beam([-29, 58, z], [29, 58, z], 2.5, metal); beam([29, 58, z], [52, 61, z], 2.5, metal);
      box([0, 49, z], [4, 9, 4], metal);
    }
    if (detail) for (const side of [-1, 1]) for (const z of [-77, 77]) {
      box([side * 57, -2, z], [2, 30, 2], pale);
      box([side * 57, 14, z], [8, 5, 8], stone);
    }
  }

  function pyramid() {
    const sandstone = [.63, .49, .31];
    for (let level = 0; level < 8; level++) {
      const width = 86 - level * 8.5, gap = 18, y = -49 + level * 14;
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const p = [x * (width + gap) / 2, y, z * (width + gap) / 2];
        box(p, [width - gap, 13.8, width - gap], sandstone);
        if (detail > 1) for (let j = -1; j <= 1; j++) box([p[0] + j * (width - gap) / 3, y + 1, z * (width + .12)], [.25, 10, .18], metal, false);
      }
    }
    for (const x of [-16, 16]) for (const z of [-16, 16]) beam([x, -48, z], [x, 65, z], 2.1, pale);
  }

  function pagoda() {
    for (let level = 0; level < 5; level++) {
      const y = -57 + level * 32, width = 59 - level * 6;
      frameFloor(y, width - 7, width - 7, 15, 3); roof(y + 19, width, width);
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        box([x * (width - 13), y + 13, z * (width - 13)], [3.5, 26, 3.5], [.34, .17, .11]);
        if (detail) beam([x * (width - 13), y + 13, z * (width - 13)], [x * width, y + 22, z * width], 1, pale);
      }
    }
  }

  function terraces() {
    for (const x of [-26, 26]) for (const z of [-26, 26]) {
      box([x, 5, z], [9, 184, 9], pale);
      if (detail) beam([x + 5.3, -80, z], [x + 5.3, 105, z], .6, metal);
    }
    for (const [i, y] of [-78, -45, -10, 30, 72, 98].entries()) {
      const width = 45 + 18 * Math.sin(i * 1.8 + plan.angle);
      frameFloor(y, width, width, 18, 3);
      if (detail) for (const x of [-1, 1]) for (const z of [-1, 1]) {
        beam([x * 26, y - 16, z * 26], [x * width, y - 2, z * width], 1.2);
        box([x * (width - 5), y + 4, z * (width - 5)], [6, 6, 6], stone);
      }
    }
    if (detail > 1) for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU; beam([Math.cos(a) * 37, -78, Math.sin(a) * 37], [Math.cos(a) * 37, -102, Math.sin(a) * 37], .15, metal, false);
    }
  }

  function hyperboloid() {
    const number = detail > 1 ? 28 : detail ? 20 : 12, waist = 23 + plan.hash * 9, h = 76;
    for (let i = 0; i < number; i++) for (const sign of [-1, 1]) {
      const a = i / number * TAU + plan.angle;
      const point = t => [waist * (Math.cos(a) + sign * t * Math.sin(a)), h * t, waist * (Math.sin(a) - sign * t * Math.cos(a))];
      beam(point(-1.25), point(1.25), detail ? .85 : 1.1, sign < 0 ? pale : metal);
    }
    for (const t of [-1.25, -.7, 0, .7, 1.25]) circle(h * t, waist * Math.sqrt(1 + t * t), 1.5, pale, detail ? 40 : 16);
    frameFloor(-96, 55, 55, 20, 3); frameFloor(96, 55, 55, 20, 3);
  }

  function hypercube() {
    const graph = tesseractGraph(plan.angle, 31);
    for (const [a, b] of graph.edges) beam(graph.vertices[a], graph.vertices[b], 1.35, pale);
    for (const p of graph.vertices) box(p, [5, 5, 5], metal);
    if (detail) for (const [a, b] of graph.edges) {
      const p = graph.vertices[a], q = graph.vertices[b];
      beam(V.mul(p, .94), V.mul(q, .94), .16, light, false, .8);
    }
    if (detail > 1 && plan.order > 3) {
      const inner = tesseractGraph(plan.angle * 1.618, 16);
      for (const [a, b] of inner.edges) beam(inner.vertices[a], inner.vertices[b], .5, stone);
      for (let i = 0; i < 16; i += 2) beam(inner.vertices[i], graph.vertices[i], .45, metal);
    }
    for (let i = 0; i < 16; i += 4) beam(graph.vertices[i], [graph.vertices[i][0], -40, graph.vertices[i][2]], 1.5);
    frameFloor(-42, 66, 66, 18); frameFloor(85, 66, 66, 18);
    for (const x of [-64, 64]) for (const z of [-64, 64]) beam([x, -42, z], [x, 85, z], 2, stone);
  }

  function menger() {
    const depth = detail > 1 ? 2 : 1;
    const visit = (center, size, level) => {
      if (!level) { box(center, [size, size, size], stone); return; }
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        if (Number(x === 0) + Number(y === 0) + Number(z === 0) >= 2) continue;
        visit(V.add(center, [x * size / 3, y * size / 3, z * size / 3]), size / 3, level - 1);
      }
    };
    visit([0, 0, 0], 150, depth);
    if (detail) for (const side of [-1, 1]) for (const x of [-24, 24]) box([x, side * 25.1, 0], [.25, .12, 149], light, false, .55);
  }

  if (plan.type === 'hall' || plan.type === 'vault' || plan.type === 'colonnade') hall(plan.type === 'vault', plan.type === 'colonnade');
  else if (plan.type === 'torii') torii();
  else if (plan.type === 'pyramid') pyramid();
  else if (plan.type === 'pagoda') pagoda();
  else if (plan.type === 'terraces') terraces();
  else if (plan.type === 'hyperboloid') hyperboloid();
  else if (plan.type === 'hypercube') hypercube();
  else if (plan.type === 'menger') menger();
  else drawExtraFamily(plan.type, { g, box, beam, circle, frameFloor, plan, detail, palette: {stone,pale,metal,dark,light} });

  return { geometry: g, colliders };
}
