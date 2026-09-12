// Fifty geometric families × ten assemblies. Orientation and seed add variation
// independently and are deliberately not counted toward these 500 recipes.
export const STRUCTURE_FAMILIES = [
  ['colonnade', 0, 1], ['torii', 0, 0], ['pyramid', 0, 0], ['pagoda', 0, 1],
  ['hall', 2, 5], ['terraces', 1, 4], ['hyperboloid', 2, 5], ['hypercube', 4, 5], ['menger', 3, 5], ['vault', 1, 5],
  ['aqueduct', 0, 2], ['obelisk', 0, 0], ['hypostyle', 0, 1], ['ziggurat', 0, 0],
  ['stupa', 0, 1], ['pailou', 0, 1], ['stepwell', 0, 0], ['dolmen', 0, 0],
  ['cathedral', 1, 1], ['cloister', 1, 1], ['minaret', 1, 2], ['fortress', 1, 2], ['buttress', 1, 2],
  ['gantry', 2, 3], ['coolingStack', 2, 4], ['refinery', 2, 3], ['turbine', 2, 4], ['suspension', 2, 4],
  ['brutalist', 3, 4], ['atrium', 3, 4], ['cantilever', 3, 5], ['diagrid', 3, 5], ['capsule', 3, 5],
  ['torus', 4, 5], ['mobius', 4, 5], ['helicoid', 4, 5], ['geodesic', 2, 5], ['octahedron', 4, 5], ['sierpinski', 4, 5], ['gyroid', 4, 5],
  ['silo', 2, 4], ['serviceShaft', 2, 5], ['megawall', 3, 5], ['coolingMonolith', 2, 4], ['slabCity', 3, 5],
  ['skyHabitat', 3, 5], ['elevatorBank', 2, 5], ['invertedPiers', 3, 5], ['retainingMaze', 3, 4], ['antennaDeck', 3, 5],
].map(([id, firstEra, lastEra]) => ({ id, firstEra, lastEra }));

export const ASSEMBLIES = [
  { id: 'monument', slots: [[56, 56, 56]], size: 76 },
  { id: 'opposition', slots: [[-54, 48, 54], [54, -48, -54]], size: 63 },
  { id: 'cascade', slots: [[52, -64, 52], [52, 0, 52], [52, 64, 52]], size: 38 },
  { id: 'arcade', slots: [[-52, -40, 54], [52, -40, 54], [-52, 40, 54], [52, 40, 54]], size: 43 },
  { id: 'crown', slots: Array.from({ length: 5 }, (_, i) => [Math.cos(i * Math.PI * .4) * 70, 45, Math.sin(i * Math.PI * .4) * 70]), size: 38 },
  { id: 'zigzag', slots: [[-72, -56, 58], [-24, 44, 58], [24, -44, 58], [72, 56, 58]], size: 32 },
  { id: 'courtyard', slots: [[-52, 0, -52], [52, 0, -52], [-52, 0, 52], [52, 0, 52]], size: 54 },
  { id: 'octants', slots: Array.from({ length: 8 }, (_, i) => [i & 1 ? 54 : -54, i & 2 ? 54 : -54, i & 4 ? 54 : -54]), size: 46 },
  { id: 'tripod', slots: Array.from({ length: 3 }, (_, i) => [Math.cos(i * Math.PI * 2 / 3) * 65, 45, Math.sin(i * Math.PI * 2 / 3) * 65]), size: 50 },
  { id: 'fold', slots: [[58, -50, 0], [58, 0, 50], [0, 58, 50], [-50, 58, 0]], size: 46 },
];

export const VARIATION_COUNT = STRUCTURE_FAMILIES.length * ASSEMBLIES.length;
export const STRUCTURE_RECIPES = STRUCTURE_FAMILIES.flatMap(family => ASSEMBLIES.map((assembly, layout) => ({ id: `${family.id}:${assembly.id}`, type: family.id, layout })));
