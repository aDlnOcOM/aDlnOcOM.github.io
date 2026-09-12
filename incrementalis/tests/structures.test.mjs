import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STRUCTURE_TYPES, gridToWorld, worldToGrid, cellAt, structurePlan, structureLinks, tesseractGraph } from '../structure-space.mjs';
import { structureGeometry } from '../structure-geometry.mjs';
import { visibleCells, StructureStream } from '../structure-stream.mjs';
import { FLIGHT_START, sphereBlocked } from '../flight-model.mjs';

test('radial coordinates invert across negative axes and distant regions', () => {
  for (const p of [[0, 0, 0], [1, -2, 3], [-.5, .49, 0], [20000, -12000, 6000], [1e8, -1e8, 2e8]]) {
    const back = worldToGrid(gridToWorld(p));
    back.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < Math.max(1e-7, Math.abs(p[i]) * 1e-10)));
    assert.deepEqual(cellAt(gridToWorld(p.map(Math.round))), p.map(v => Math.round(v) || 0));
  }
});
test('seeded architecture is reproducible and antiquity includes multiple cultures', () => {
  const types = new Set();
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    const p = structurePlan([x, 0, z], 711);
    assert.deepEqual(p, structurePlan([x, 0, z], 711));
    if (p.era === 0) types.add(p.type);
  }
  for (const type of ['colonnade', 'torii', 'pagoda', 'pyramid']) assert.ok(types.has(type), type);
  const positions = [0, 3, 10, 40, 200, 20000].map(x => structurePlan([x, 0, 0], 711));
  for (let i = 1; i < positions.length; i++) for (const key of ['distance', 'scale', 'epoch', 'order']) assert.ok(positions[i][key] > positions[i - 1][key]);
});
test('every node has shared six-way connections with exactly one owner per edge', () => {
  for (const cell of [[0, 0, 0], [-3, 2, -8], [500, -30, 700]]) {
    const plan = structurePlan(cell, 1), links = structureLinks(plan);
    assert.equal(links.length, 3);
    links.forEach(link => assert.deepEqual(link.to, structurePlan(link.neighbor, 1).origin));
    for (let axis = 0; axis < 3; axis++) {
      const previous = [...cell]; previous[axis]--;
      assert.deepEqual(structureLinks(structurePlan(previous, 1))[axis].to, plan.origin);
    }
  }
});
test('projected hypercubes retain the full 16-vertex, 32-edge tesseract graph', () => {
  for (const angle of [0, 1.4, 10, 400]) {
    const graph = tesseractGraph(angle, 45), degree = Array(16).fill(0);
    assert.equal(graph.vertices.length, 16); assert.equal(graph.edges.length, 32);
    assert.ok(graph.vertices.flat().every(Number.isFinite));
    for (const [a, b] of graph.edges) { degree[a]++; degree[b]++; }
    assert.ok(degree.every(n => n === 4));
  }
});
test('all architectural families produce finite bounded geometry at every LOD', () => {
  for (const type of STRUCTURE_TYPES) for (const detail of [-1, 0, 1, 2]) {
    const mesh = structureGeometry({ ...structurePlan([8, 1, -2], 10), type }, detail);
    assert.ok(mesh.geometry.data.length > 1000);
    assert.ok(mesh.geometry.data.length / 10 < 90000, `${type} exceeds vertex budget`);
    assert.ok(mesh.geometry.data.every(Number.isFinite));
    assert.ok(mesh.colliders.length < 1900, `${type} exceeds collision budget`);
  }
  const far = structureGeometry(structurePlan([1000000, 0, 0], 10));
  assert.ok(far.geometry.data.every(Number.isFinite));
  assert.ok(far.geometry.data.every((v, i) => i % 10 >= 3 || Math.abs(v) < 20000), 'GPU coordinates remain local');
});
test('the initial flight corridor is open, and vertical shafts connect through floors', () => {
  const mesh = structureGeometry(structurePlan([0, 0, 0], 33));
  for (const p of [FLIGHT_START, [0, 0, 0], [0, 0, -80], [0, 0, 110], [10, 30, 10], [10, 115, 10]]) {
    assert.equal(mesh.colliders.some(c => sphereBlocked(p, c)), false, `${p} must be open`);
  }
});
test('streaming bounds both memory and queue while following arbitrary 3D flight', () => {
  const meshes = new Map(), renderer = { setMesh: name => meshes.set(name, true), meshOrigin() {}, removeMesh: name => meshes.delete(name) };
  const stream = new StructureStream(renderer, 77);
  for (const cell of [[0, 0, 0], [1, 0, 0], [2, 1, -1], [-20, 40, -80]]) {
    const p = gridToWorld(cell); stream.update(p, 3);
    assert.ok(stream.loaded.size <= 123); assert.ok(stream.pending.length <= 123); assert.equal(visibleCells(p).length, 123);
    assert.equal(meshes.size, stream.loaded.size);
  }
  const position = gridToWorld([-20, 40, -80]), blocked = stream.collisionQuery(position);
  for (const offset of [[0, 0, 0], [1, 2, 3], [4, -2, 1]]) {
    const p = position.map((v, i) => v + offset[i]);
    const bruteForce = [...stream.loaded.values()].some(item => item.colliders.some(c => sphereBlocked(p.map((v, i) => v - item.origin[i]), c)));
    assert.equal(blocked(p), bruteForce);
  }
});
test('the public interface contains only Start and Save and no gameplay modules', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal([...html.matchAll(/<button\b/g)].length, 2);
  assert.doesNotMatch(html, /кристалл|аномали|пробужд|Fluctlight|Древо|бонсай|ресурс/i);
  const bundle = await readFile(new URL('../game.bundle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(bundle, /home-game\.mjs|progression\.mjs|awakening\.mjs|garden-editor\.mjs/);
});
