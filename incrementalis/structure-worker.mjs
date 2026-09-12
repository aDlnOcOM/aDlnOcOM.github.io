import { structureGeometry } from './structure-geometry.mjs';
import { structurePlan } from './structure-space.mjs';
import { indexGeometry } from './mesh-data.mjs';

self.onmessage = ({ data }) => {
  const { cell, seed, detail, key } = data;
  const plan = structurePlan(cell, seed), mesh = structureGeometry(plan, detail);
  const { data: vertices, indices } = indexGeometry(mesh.geometry.data);
  self.postMessage({ key, detail, cell, plan, origin: mesh.origin, colliders: detail < 0 ? [] : mesh.colliders, vertices, indices }, [vertices.buffer, indices.buffer]);
};
