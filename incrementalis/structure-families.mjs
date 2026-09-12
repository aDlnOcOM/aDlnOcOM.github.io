import { V } from './engine.js';

const TAU = Math.PI * 2;

/** Independent architectural grammars; each produces a different load-bearing form. */
export function drawExtraFamily(type, context) {
  const { g, box, beam, frameFloor, plan, detail, palette } = context;
  const { stone, pale, metal, light } = palette, rust = [.32, .13, .075], concrete = [.38, .39, .37];
  const n = detail > 1 ? 20 : detail ? 12 : 8;
  const ring = (center, radius, axis = 1, thick = 1.5, color = pale, count = n) => {
    const point = a => { const p = [...center], indices = [0, 1, 2].filter(i => i !== axis); p[indices[0]] += Math.cos(a) * radius; p[indices[1]] += Math.sin(a) * radius; return p; };
    for (let i = 0; i < count; i++) beam(point(i / count * TAU), point((i + 1) / count * TAU), thick, color);
  };
  const arch = (x, y, z, width, height, color = pale) => {
    const count = detail ? 12 : 6;
    let previous = [x + width, y, z];
    for (let i = 1; i <= count; i++) { const a = i / count * Math.PI, p = [x + Math.cos(a) * width, y + Math.sin(a) * height, z]; beam(previous, p, 2.7, color); previous = p; }
  };
  const cage = (size, center = [0, 0, 0], radius = 2, color = metal) => {
    const points = Array.from({ length: 8 }, (_, i) => center.map((v, k) => v + (i & 1 << k ? size[k] : -size[k])));
    for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) if (!(i & 1 << k)) beam(points[i], points[i | 1 << k], radius, color);
  };
  const cylinder = (x, z, r, bottom, top, color = concrete) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, b = (i + 1) / n * TAU;
      const p = [x + Math.cos(a) * r, bottom, z + Math.sin(a) * r], q = [x + Math.cos(b) * r, bottom, z + Math.sin(b) * r];
      g.quad(p, q, [q[0], top, q[2]], [p[0], top, p[2]], color);
      beam(p, [p[0], top, p[2]], 1.4, color);
    }
    ring([x, bottom, z], r, 1, 2.5, metal); ring([x, top, z], r, 1, 2.5, metal);
  };
  const portal = (x, y, z, w, h, thick = 6, color = concrete) => {
    box([x - w, y + h / 2, z], [thick, h, thick], color); box([x + w, y + h / 2, z], [thick, h, thick], color);
    box([x, y + h, z], [w * 2 + thick, thick, thick], color);
  };
  const decks = (ys, w = 65, d = 65) => { for (const y of ys) frameFloor(y, w, d, 23, 4); };
  const warning = (p, axis = 0) => {
    if (!detail) return;
    for (let i = -3; i <= 3; i++) { const at = [...p]; at[axis] += i * 2; box(at, axis === 0 ? [1, 1.1, .3] : [.3, 1.1, 1], i % 2 ? [.66, .43, .15] : metal, false); }
  };

  switch (type) {
    case 'aqueduct':
      for (const y of [-68, -12, 44]) { box([0, y - 4, 0], [180, 6, 26]); for (const x of [-60, 0, 60]) { for (const z of [-10, 10]) { arch(x, y, z, 28, 40); for (const side of [-1, 1]) box([x + side * 28, y + 16, z], [5, 32, 6]); } } } break;
    case 'obelisk':
      box([0, -66, 0], [65, 12, 65]);
      g.tube([[0, -60, 0], [0, 74, 0], [0, 100, 0]], [22, 12, 0], pale, 4);
      beam([0, -60, 0], [0, 80, 0], 13, stone);
      for (const x of [-52, 52]) for (const z of [-52, 52]) { box([x, -60, z], [20, 8, 20]); beam([x, -55, z], [x, -5, z], 7, stone); beam([x, -55, z], [0, -60, 0], 2, metal); } break;
    case 'hypostyle':
      box([0, -55, 0], [172, 5, 172]); box([0, 60, 0], [172, 8, 172]);
      for (const x of [-66, -22, 22, 66]) for (const z of [-66, -22, 22, 66]) { beam([x, -51, z], [x, 53, z], 5, pale); box([x, 51, z], [17, 13, 17]); } break;
    case 'ziggurat':
      for (let i = 0; i < 7; i++) { const w = 85 - i * 10; box([0, -64 + i * 19, 0], [w * 2, 18, w * 2]); }
      portal(0, 61, 0, 15, 30, 5, pale); break;
    case 'stupa':
      decks([-65, -56], 74, 74);
      for (let j = 0; j <= 7; j++) { const a = j / 8 * Math.PI / 2; ring([0, -48 + Math.sin(a) * 96, 0], Math.cos(a) * 68, 1, 4, stone); }
      for (let i = 0; i < n; i++) { const a = i / n * TAU; let prev = [Math.cos(a) * 68, -48, Math.sin(a) * 68]; for (let j = 1; j <= 8; j++) { const b = j / 8 * Math.PI / 2, p = [Math.cos(a) * Math.cos(b) * 68, -48 + Math.sin(b) * 96, Math.sin(a) * Math.cos(b) * 68]; beam(prev, p, 2.5, pale); prev = p; } }
      beam([0, 45, 0], [0, 100, 0], 3, metal); for (const y of [60, 72, 84]) ring([0, y, 0], (98 - y) / 2, 1, 2); break;
    case 'pailou':
      for (const z of [-42, 42]) { for (const x of [-66, -22, 22, 66]) { beam([x, -62, z], [x, 38, z], 3.7, rust); box([x, -58, z], [13, 10, 13]); } for (const x of [-44, 0, 44]) { box([x, 28, z], [49, 5, 10], rust); box([x, 40 + (x === 0 ? 13 : 0), z], [53, 5, 19], metal); } }
      for (const x of [-66, 66]) beam([x, -60, -42], [x, -60, 42], 3, stone); break;
    case 'stepwell':
      for (let i = 0; i < 10; i++) { const w = 28 + i * 6; frameFloor(-65 + i * 12, w, w, w - 6, 4); }
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) portal(side * 66, 18, -65 + i * 26, 7, 38, 3); break;
    case 'dolmen':
      for (const z of [-55, 0, 55]) { for (const x of [-34, 34]) box([x, -5, z], [16, 100, 22], stone); box([0, 50, z], [96, 17, 31], pale); }
      box([0, -60, 0], [100, 9, 165]); break;
    case 'cathedral':
      decks([-62], 67, 90);
      for (const z of [-78, -39, 0, 39, 78]) { for (const x of [-54, 54]) beam([x, -60, z], [x, 34, z], 4.5, stone); arch(0, 30, z, 54, 61); }
      for (const x of [-61, 61]) { box([x, 18, -79], [15, 158, 16]); g.tube([[x, 97, -79], [x, 108, -79]], [9, 0], metal, 4); } break;
    case 'cloister':
      decks([-44, 16, 75], 85, 85);
      for (const z of [-72, 72]) for (const x of [-54, -18, 18, 54]) { arch(x, -27, z, 16, 29); box([x - 16, -14, z], [4, 58, 5]); }
      for (const x of [-73, 73]) for (const z of [-50, 0, 50]) portal(x, 18, z, 10, 49, 4); break;
    case 'minaret':
      cylinder(0, 0, 22, -80, 92, stone);
      for (const y of [-40, 10, 60]) { ring([0, y, 0], 35, 1, 4, pale); for (let i = 0; i < n; i++) { const a = i / n * TAU; beam([22 * Math.cos(a), y - 15, 22 * Math.sin(a)], [35 * Math.cos(a), y, 35 * Math.sin(a)], 1.2); } }
      g.tube([[0, 90, 0], [0, 108, 0]], [22, 0], pale, n); break;
    case 'fortress':
      for (const x of [-58, 58]) for (const z of [-58, 58]) { box([x, 0, z], [36, 134, 36]); for (const dx of [-12, 12]) for (const dz of [-12, 12]) box([x + dx, 72, z + dz], [9, 13, 9], pale); }
      for (const z of [-60, 60]) { box([0, -17, z], [90, 90, 14]); for (const x of [-34, -17, 0, 17, 34]) box([x, 32, z], [8, 12, 16], pale); }
      for (const x of [-58, 58]) box([x, 32, 0], [18, 8, 94]); break;
    case 'buttress':
      box([0, 5, 0], [18, 164, 150]);
      for (const side of [-1, 1]) for (const z of [-60, -20, 20, 60]) { box([side * 76, -23, z], [10, 112, 13]); beam([side * 76, 26, z], [0, 76, z], 4.5, pale); beam([side * 76, -2, z], [0, 38, z], 3.7); } break;
    case 'gantry':
      cage([74, 79, 57], [0, 0, 0], 3.5); box([0, 78, 0], [160, 8, 130]);
      for (const x of [-68, 68]) for (const z of [-52, 52]) { beam([x, -77, z], [-x, 77, z], 1.5, rust); }
      box([15, 46, 0], [24, 44, 35]); beam([15, 25, 0], [15, -55, 0], .8); ring([15, -60, 0], 8, 2, 2, metal); break;
    case 'coolingStack':
      for (const x of [-38, 38]) { for (let i = 0; i < n; i++) { const a = i / n * TAU, p = t => [x + (22 + t * t * 11) * Math.cos(a), t * 82, (22 + t * t * 11) * Math.sin(a)]; let previous = p(-1); for (let j = 1; j <= 6; j++) { const q = p(-1 + j / 3); beam(previous, q, 2, concrete); previous = q; } } ring([x, 82, 0], 33, 1, 4); ring([x, -82, 0], 33, 1, 4); }
      box([0, -88, 0], [160, 8, 88]); break;
    case 'refinery':
      decks([-70, -15, 45], 80, 64);
      for (const [x, z, h] of [[-45, -32, 90], [30, 28, 67], [45, -36, 102], [-22, 36, 32]]) { cylinder(x, z, 12, -68, h, metal); beam([x, h - 7, z], [0, h - 7, z], 3, rust); beam([0, h - 7, z], [0, -66, z], 3, rust); } break;
    case 'turbine':
      cage([81, 76, 32], [0, 0, 0], 3); ring([0, 0, 0], 62, 2, 6, concrete); ring([0, 0, 0], 20, 2, 8, metal);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; beam([24 * Math.cos(a), 24 * Math.sin(a), -12], [58 * Math.cos(a + .3), 58 * Math.sin(a + .3), 12], 5, pale); }
      beam([0, 0, -60], [0, 0, 60], 8, rust); break;
    case 'suspension':
      for (const x of [-70, 70]) portal(x, -65, 0, 12, 150, 5); box([0, -22, 0], [188, 6, 30]);
      for (const z of [-15, 15]) for (let i = 0; i < 14; i++) { const x = -84 + i * 12, y = 12 + 65 * (x / 84) ** 2, nx = x + 12, ny = 12 + 65 * (nx / 84) ** 2; beam([x, y, z], [nx, ny, z], 1.4); beam([x, -20, z], [x, y, z], .5); } break;
    case 'brutalist':
      for (let i = 0; i < 5; i++) { const y = -70 + i * 35, sign = i % 2 ? -1 : 1; box([sign * 23, y, 0], [138, 20, 73], concrete); box([-sign * 47, y + 16, 0], [18, 38, 61], pale); warning([sign * 23, y + 11, 37]); } break;
    case 'atrium':
      decks([-70, -35, 0, 35, 70], 72, 88);
      for (const x of [-67, 67]) for (const z of [-80, 0, 80]) beam([x, -70, z], [x, 88, z], 2.3, pale);
      for (const z of [-80, -40, 0, 40, 80]) { beam([-68, 72, z], [0, 98, z], 1.4); beam([0, 98, z], [68, 72, z], 1.4); } break;
    case 'cantilever':
      box([-37, 0, 0], [23, 180, 48]);
      for (let i = 0; i < 6; i++) { const y = -70 + i * 31, width = 91 + i % 3 * 20; box([width / 2 - 48, y, 0], [width, 12, 82], pale); beam([-38, y - 24, -33], [width - 48, y - 6, -33], 2.4); } break;
    case 'diagrid':
      cage([47, 91, 47], [0, 0, 0], 3, concrete);
      for (let y = -85; y < 80; y += 34) for (const z of [-47, 47]) for (let x = -47; x < 45; x += 23.5) { beam([x, y, z], [x + 23.5, y + 34, z], 1.6, pale); beam([x + 23.5, y, z], [x, y + 34, z], 1.6, pale); }
      decks([-85, -17, 51, 85], 45, 45); break;
    case 'capsule':
      for (const x of [-40, 40]) { beam([x, -90, 0], [x, 90, 0], 5, metal); for (let i = 0; i < 5; i++) { const y = -66 + i * 32, z = i % 2 ? -35 : 35; box([x, y, z], [42, 25, 58], pale); box([x, y, z + Math.sign(z) * 30], [32, 15, .7], metal, false); beam([x, y, 0], [x, y, z], 3); } } break;
    case 'torus':
      for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU; for (let j = 0; j < 8; j++) { const c = j / 8 * TAU, d = (j + 1) / 8 * TAU, p = (u, v) => [(55 + Math.cos(v) * 20) * Math.cos(u), Math.sin(v) * 20, (55 + Math.cos(v) * 20) * Math.sin(u)]; beam(p(a, c), p(b, c), 1, pale); beam(p(a, c), p(a, d), .8); } } break;
    case 'mobius': {
      const point = (u, v) => [(53 + v * Math.cos(u / 2)) * Math.cos(u), v * Math.sin(u / 2), (53 + v * Math.cos(u / 2)) * Math.sin(u)];
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, b = (i + 1) / (n * 2) * TAU; g.quad(point(a, -22), point(b, -22), point(b, 22), point(a, 22), concrete); for (const side of [-22, 22]) beam(point(a, side), point(b, side), 1.2, pale); beam(point(a, -22), point(a, 22), .8); } break;
    }
    case 'helicoid':
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU * 2, b = (i + 1) / (n * 2) * TAU * 2, p = (r, u) => [r * Math.cos(u), -82 + u / (TAU * 2) * 164, r * Math.sin(u)]; g.quad(p(12, a), p(67, a), p(67, b), p(12, b), pale); beam(p(12, a), p(67, a), 1.2); beam(p(67, a), p(67, b), 1.4); }
      beam([0, -86, 0], [0, 88, 0], 7, concrete); break;
    case 'geodesic':
      for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI, b = (j + 1) / 7 * Math.PI; for (let i = 0; i < n; i++) { const u = i / n * TAU, v = (i + .5) / n * TAU, p = (lat, lon) => [Math.sin(lat) * Math.cos(lon) * 76, Math.cos(lat) * 76, Math.sin(lat) * Math.sin(lon) * 76]; beam(p(a, u), p(b, v), 1.2, pale); beam(p(a, u), p(b, v - TAU / n), 1.2, pale); if (j) beam(p(a, u), p(a, u + TAU / n), 1); } } break;
    case 'octahedron': {
      const points = [[85, 0, 0], [-85, 0, 0], [0, 92, 0], [0, -92, 0], [0, 0, 85], [0, 0, -85]];
      for (const scale of [1, .55]) for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (Math.floor(i / 2) !== Math.floor(j / 2)) beam(V.mul(points[i], scale), V.mul(points[j], scale), 2 * scale, pale);
      for (const p of points) beam(p, V.mul(p, .55), 1.3); break;
    }
    case 'sierpinski': {
      const tetra = (points, depth) => { if (!depth) { for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) beam(points[i], points[j], 1.2, pale); return; } for (const p of points) tetra(points.map(q => V.mix(p, q, .5)), depth - 1); };
      tetra([[0, 96, 0], [-80, -58, -46], [80, -58, -46], [0, -58, 92]], detail > 1 ? 2 : 1); break;
    }
    case 'gyroid': {
      const count = detail > 1 ? 10 : detail ? 8 : 5, step = 144 / count, field = (x, y, z) => Math.sin(x / 26) * Math.cos(y / 26) + Math.sin(y / 26) * Math.cos(z / 26) + Math.sin(z / 26) * Math.cos(x / 26);
      let previous = new Map();
      for (let j = 0; j <= count; j++) { const y = -72 + j * step, current = new Map();
        for (let x = 0; x < count; x++) for (let z = 0; z < count; z++) {
          const corners = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]].map(([a, b]) => [-72 + a * step, y, -72 + b * step]);
          const points = [];
          for (let k = 0; k < 4; k++) { const a = corners[k], b = corners[(k + 1) % 4], fa = field(...a), fb = field(...b); if ((fa < 0) !== (fb < 0)) points.push(V.mix(a, b, fa / (fa - fb))); }
          for (let k = 0; k + 1 < points.length; k += 2) beam(points[k], points[k + 1], .85, pale);
          if (points.length) { const key = `${x}:${z}`, p = points[0]; current.set(key, p); if (previous.has(key) && Math.hypot(...V.sub(p, previous.get(key))) < step * 1.7) beam(previous.get(key), p, .6, metal); }
        } previous = current;
      } break;
    }
    case 'silo':
      for (const x of [-34, 34]) for (const z of [-34, 34]) cylinder(x, z, 25, -88, 88, concrete);
      decks([-89, 6, 88], 68, 68); for (const y of [-54, -16, 24, 64]) { box([0, y, 73], [128, 3, 13], metal); warning([0, y + 2, 80]); } break;
    case 'serviceShaft':
      for (const x of [-67, 67]) box([x, 0, 0], [15, 190, 146], concrete);
      for (const z of [-65, 65]) for (const x of [-48, -26, 26, 48]) beam([x, -94, z], [x, 94, z], x % 3 ? 4 : 7, rust);
      for (let y = -75; y < 90; y += 33) { box([0, y, -58], [124, 4, 18], metal); box([43, y + 16, 0], [25, 4, 118], pale); warning([0, y + 3, -47]); } break;
    case 'megawall':
      for (const x of [-68, -23, 23, 68]) { box([x, 0, 0], [34, 196, 28], concrete); box([x, 0, -24], [12, 190, 22], pale); }
      for (const y of [-76, -28, 20, 68]) { box([0, y, 20], [178, 5, 28], metal); warning([0, y + 3, 35]); }
      for (const x of [-88, 88]) beam([x, -98, -50], [x, 98, -50], 5, rust); break;
    case 'coolingMonolith':
      for (const x of [-60, 0, 60]) { box([x, 0, 0], [32, 174, 88], concrete); for (let y = -72; y < 80; y += 18) box([x, y, 46], [29, 7, 5], metal); }
      box([0, -90, 0], [164, 12, 106]); box([0, 94, 0], [176, 9, 100], pale); break;
    case 'slabCity':
      for (let i = 0; i < 7; i++) { const y = -82 + i * 27, x = i % 2 ? -15 : 15; box([x, y, 0], [152, 9, 104], concrete); for (const z of [-42, 42]) for (const px of [-44, 44]) box([px, y + 13, z], [9, 19, 12], pale); }
      for (const x of [-56, 56]) box([x, 0, 0], [15, 194, 24], metal); break;
    case 'skyHabitat':
      for (const z of [-62, 62]) box([0, 0, z], [154, 106, 31], pale);
      for (const x of [-62, 0, 62]) for (const y of [-32, 32]) { box([x, y, 0], [20, 13, 106], concrete); if (detail) box([x, y + 7, 0], [17, .5, 96], light, false, .4); }
      for (const x of [-57, 57]) beam([x, -90, 0], [x, 64, 0], 6, metal); break;
    case 'elevatorBank':
      for (const x of [-54, -18, 18, 54]) { cage([13, 99, 26], [x, 0, 0], 1.7); const y = x * .7; box([x, y, 0], [24, 31, 43], concrete); beam([x, y + 16, 0], [x, 99, 0], .6, rust); }
      for (const y of [-98, -32, 34, 99]) box([0, y, 35], [152, 5, 19], metal); break;
    case 'invertedPiers':
      box([0, 83, 0], [180, 14, 154], concrete);
      for (const x of [-65, -20, 25, 70]) for (const z of [-52, 0, 52]) { const bottom = -75 + Math.abs(x + z) % 37; box([x, (bottom + 78) / 2, z], [14, 78 - bottom, 15], pale); box([x, bottom, z], [27, 8, 29], concrete); }
      box([0, 22, 0], [170, 5, 18], metal); break;
    case 'retainingMaze':
      for (let i = 0; i < 5; i++) { const x = -74 + i * 37, z = i % 2 ? 22 : -22; box([x, 0, z], [11, 141, 128], concrete); }
      box([0, -73, 0], [174, 6, 178], pale); for (const y of [-40, 16, 69]) box([0, y, 0], [174, 4, 14], rust); break;
    case 'antennaDeck':
      decks([-35, 22, 76], 85, 66);
      for (const x of [-65, -22, 22, 65]) { beam([x, -86, 0], [x, 104, 0], 2.5, metal); for (const y of [30, 54, 88]) { beam([x - 13, y, 0], [x + 13, y, 0], 1); box([x, y, 14], [16, 11, 8], concrete); } }
      for (const z of [-54, 54]) box([0, -8, z], [152, 55, 16], concrete); break;
    default: throw new Error(`Unknown structure family: ${type}`);
  }
}
