import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { STRUCTURE_FAMILIES, STRUCTURE_RECIPES, ASSEMBLIES, VARIATION_COUNT } from '../structure-catalog.mjs';
import { structurePlan, structureLinks, gridToWorld } from '../structure-space.mjs';
import { structureBody } from '../structure-body.mjs';
import { structureGeometry } from '../structure-geometry.mjs';
import { structureLayout, structureInfill, placementFits, flightCorridors, BODY_HALF, orientationFrame, transformCollider, boxesOverlap, assemblyFrame } from '../structure-layout.mjs';
import { structureEnvelope } from '../structure-envelope.mjs';
import { structurePalette } from '../structure-palette.mjs';
import { sphereBlocked, normalizeDrawDistance, newFlight, readFlight } from '../flight-model.mjs';
import { StructureStream, visibleCells } from '../structure-stream.mjs';
import { Geometry, geometryBounds, frustumPlanes, boundsVisible, perspective, lookAt, multiply } from '../engine.js';
import { indexGeometry } from '../mesh-data.mjs';

test('500 recipes produce distinct geometry, with bounded cost even for eight-part assemblies', () => {
  assert.equal(STRUCTURE_FAMILIES.length, 50); assert.equal(ASSEMBLIES.length, 10); assert.equal(VARIATION_COUNT, 500);
  const hashes = new Set();
  for (const recipe of STRUCTURE_RECIPES) {
    const mesh = structureGeometry({ ...structurePlan([20, 1, 2], 17), ...recipe }, 0);
    assert.ok(mesh.placements.length, recipe.id);
    assert.ok(mesh.geometry.data.length / 10 < 90000, recipe.id);
    assert.ok(mesh.colliders.length < 1900, recipe.id);
    assert.equal(mesh.assembly.connections.length, mesh.placements.length + mesh.infill.length);
    assert.ok(mesh.assembly.connections.every(c => c.routes.length >= 1), `${recipe.id} has an unsupported wing`);
    for (const connection of mesh.assembly.connections) for (const route of connection.routes) {
      assert.equal(route.start[1], route.target[1], 'gallery must stay on its deck');
      assert.ok(mesh.assembly.posts.some(p => p[0] === route.target[0] && p[2] === route.target[2]));
      assert.ok(Math.abs(route.target[1]) <= 110, 'gallery reaches the foundation/column system');
    }
    const bytes = new Float32Array(mesh.geometry.data);
    hashes.add(createHash('sha256').update(new Uint8Array(bytes.buffer)).digest('hex'));
  }
  assert.equal(hashes.size, 500);
});

test('all families fit the conservative source volume, including full ornaments', () => {
  for (const { id: type } of STRUCTURE_FAMILIES) for (const cell of [[0, 0, 0], [400, -20, 350]]) {
    const body = structureBody({ ...structurePlan(cell, 37), type }, 2);
    assert.ok(body.geometry.data.every((v, i) => i % 10 >= 3 || Math.abs(v) <= BODY_HALF[i % 10]), type);
  }
});

test('packing preserves free passages, avoids body intersections and supports every direction', () => {
  const directions = new Set();
  for (const cell of [[0, 0, 0], [-3, 3, -3], [20, 1, 2], [500, -200, 700]]) for (let seed = 0; seed < 6; seed++) for (let layout = 0; layout < 10; layout++) {
    const plan = { ...structurePlan(cell, seed), layout }, placements = structureLayout(plan), occupied = [], corridors = flightCorridors(plan);
    assert.equal(placements.length, ASSEMBLIES[layout].slots.length, `${cell}:${seed}:${layout} loses a body`);
    assert.ok(placements.every(p => p.scale === placements[0].scale), 'repeated bays share dimensions');
    for (const p of placements) {
      assert.ok(placementFits(p, occupied, corridors)); occupied.push(p);
      const up = p.axes[1];
      assert.deepEqual(up, assemblyFrame(plan)[1], 'all wings share structural up');
      directions.add(up.map(v => Math.round(v) || 0).join(','));
    }
  }
  assert.equal(directions.size, 6);
});

test('LOD keeps the same placement, full connector sockets and clear flight centreline', () => {
  for (const cell of [[0, 0, 0], [-3, 3, -3], [500, -200, 700]]) {
    const plan = structurePlan(cell, 19), full = structureGeometry(plan, 2);
    for (const lod of [-1, 0, 1]) {
      const mesh = structureGeometry(plan, lod);
      assert.deepEqual(mesh.placements, full.placements); assert.deepEqual(mesh.infill, full.infill);
      assert.deepEqual(mesh.assembly, full.assembly, 'foundations and galleries must not move with LOD');
    }
    for (const link of structureLinks(plan)) {
      const neighbor = structurePlan(link.neighbor, 19), other = structureGeometry(neighbor, 0);
      const expected = link.to.map((v, i) => v - plan.origin[i] + (i === link.axis ? -16 : 16) * neighbor.scale);
      assert.ok(full.colliders.some(c => c.type === 'beam' && c.b.every((v, i) => Math.abs(v - expected[i]) < 1e-7)), 'girder reaches the neighbour socket exactly');
      for (let i = 0; i <= 25; i++) {
        const p = link.from.map((v, axis) => v + (link.to[axis] - v) * i / 25);
        for (const mesh of [full, other]) assert.equal(mesh.colliders.some(c => sphereBlocked(p.map((v, axis) => v - mesh.origin[axis]), c)), false, `${cell}:${link.axis}:${i} obstructed`);
      }
    }
  }
});

test('dense infill uses free volumes and the enclosing walls leave all six routes open', () => {
  for (const cell of [[0, 0, 0], [-3, 3, -3], [20, 1, 2], [500, -200, 700]]) for (let layout = 0; layout < 10; layout++) {
    const plan = { ...structurePlan(cell, 31), layout }, primary = structureLayout(plan), infill = structureInfill(plan, primary), occupied = [...primary];
    assert.ok(infill.length >= 16 && infill.length <= 24, `${cell}:${layout} is too sparse`);
    for (const p of infill) { assert.ok(placementFits(p, occupied, flightCorridors(plan))); occupied.push(p); }
    for (const p of infill) {
      const floor = p.center.reduce((sum, v, i) => sum + v * assemblyFrame(plan)[1][i], 0) - p.half[1];
      assert.ok([-104, -36, 36].some(level => Math.abs(level - floor) < 1e-7), 'service sections align to shared decks');
    }
    const walls = [], geometry = new Geometry();
    structureEnvelope(plan, geometry, walls, () => {}, structurePalette(plan), 2);
    assert.ok(walls.length >= 36);
    for (const p of primary) assert.equal(walls.some(wall => boxesOverlap(p, wall)), false, 'wall intersects a primary body');
    for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) {
      const neighbor = [...cell]; neighbor[axis] += sign;
      const to = gridToWorld(neighbor);
      for (let step = 0; step <= 10; step++) {
        const p = to.map((v, i) => (v - plan.origin[i]) * step / 10 / plan.scale);
        assert.equal(walls.some(wall => sphereBlocked(p, wall)), false, `${cell}:${layout}:${axis}:${sign} wall blocks the route`);
      }
    }
  }
});

test('rotated solids collide in their own coordinates, leaving AABB empty corners free', () => {
  const collider = transformCollider({ type: 'box', center: [0, 0, 0], size: [60, 4, 4] }, { center: [5, 7, 9], axes: orientationFrame([0, 1, 0], Math.PI / 4), scale: 1 });
  assert.equal(sphereBlocked([5, 7, 9], collider), true);
  assert.equal(sphereBlocked([20, 7, 24], collider), true);
  assert.equal(sphereBlocked([20, 7, -6], collider), false);
});

test('era palette changes continuously across integer era boundaries', () => {
  for (let era = 1; era < 6; era++) {
    const a = structurePalette({ epoch: era - .001, hash: .4 }), b = structurePalette({ epoch: era + .001, hash: .4 });
    for (const key of Object.keys(a)) for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[key][i] - b[key][i]) < .001);
  }
});

test('draw distance is validated, saved, and compatible with previous flight saves', () => {
  assert.equal(normalizeDrawDistance(undefined), 720); assert.equal(normalizeDrawDistance(NaN), 720);
  assert.equal(normalizeDrawDistance(-12), 480); assert.equal(normalizeDrawDistance(1e9), 1440);
  assert.equal(normalizeDrawDistance(999), 960);
  const save = { ...newFlight(17), drawDistance: 1200 }; assert.equal(readFlight(save).drawDistance, 1200);
  delete save.drawDistance; assert.equal(readFlight(save).drawDistance, 720);
  assert.deepEqual([2, 3, 4, 5, 6].map(r => visibleCells([0, 0, 0], r).length), [33, 123, 257, 515, 925]);
});

test('worker streaming discards stale results, bounds queues, evicts on range reduction and recovers after errors', () => {
  const meshes = new Map(), renderer = { setMesh: (key, g) => meshes.set(key, g.data.length), meshOrigin() {}, removeMesh: key => meshes.delete(key) };
  let job, terminated = false;
  const worker = { postMessage: data => { job = data; }, terminate: () => { terminated = true; } };
  const stream = new StructureStream(renderer, 77, worker);
  const complete = () => worker.onmessage({ data: { ...job, plan: structurePlan(job.cell, 77), origin: gridToWorld(job.cell), colliders: [], vertices: new Float32Array(30) } });
  stream.update([0, 0, 0], 1, 1440); assert.equal(stream.pending.length, 924);
  const position = gridToWorld([50, 20, -70]); stream.update(position, 1, 1440);
  complete(); stream.update(position, 1, 1440); assert.equal(stream.loaded.size, 0, 'stale result is not uploaded');
  while (stream.inFlight) { complete(); stream.update(position, 1, 1440); }
  assert.equal(stream.loaded.size, 925); assert.equal(meshes.size, 925); assert.equal(stream.availableDistance(), 1440);
  assert.ok([...stream.loaded.values()].every(item => !('vertices' in item)));
  stream.update(position, 1, 480); assert.equal(stream.loaded.size, 33); assert.equal(meshes.size, 33);
  const next = gridToWorld([51, 20, -70]); stream.update(next, 1, 720); worker.onerror({ preventDefault() {} });
  assert.equal(terminated, true); assert.equal(stream.worker, null); assert.ok(stream.pending.length <= 123);
  stream.update(next); assert.ok(stream.loaded.size > 0);
});

test('frustum culling keeps crossing structures visible and is invariant under origin rebasing', () => {
  const g = new Geometry(); g.box([0, 0, 0], [10, 10, 10], [.5, .5, .5]); const bounds = geometryBounds(g.data);
  assert.deepEqual(bounds, { center: [0, 0, 0], half: [5, 5, 5] });
  const planes = frustumPlanes(multiply(perspective(1.12, 1, .1, 100), lookAt([0, 0, 0], [0, 0, -1])));
  assert.equal(boundsVisible(bounds, [0, 0, -30], planes), true);
  assert.equal(boundsVisible(bounds, [0, 0, 30], planes), false);
  assert.equal(boundsVisible(bounds, [80, 0, -30], planes), false);
  assert.equal(boundsVisible(bounds, [0, 0, -150], planes), false);
  assert.equal(boundsVisible(bounds, [0, 0, -103], planes), true);
  const shift = 512, rebased = frustumPlanes(multiply(perspective(1.12, 1, .1, 100), lookAt([-shift, 0, 0], [-shift, 0, -1])));
  for (const p of [[0, 0, -30], [80, 0, -30], [0, 0, 30], [0, 0, -103]]) assert.equal(boundsVisible(bounds, p, planes), boundsVisible(bounds, [p[0] - shift, p[1], p[2]], rebased));
});

test('indexed meshes reproduce every attribute exactly while reducing GPU storage', () => {
  const g = new Geometry();
  g.box([0, 0, 0], [10, 10, 10], [.4, .5, .6]);
  g.box([0, 0, 0], [10, 10, 10], [.7, .5, .6]);
  const packed = indexGeometry(g.data);
  assert.ok(packed.data.byteLength + packed.indices.byteLength < g.data.length * 4);
  for (let i = 0; i < g.data.length; i++) assert.equal(packed.data[packed.indices[Math.floor(i / 10)] * 10 + i % 10], Math.fround(g.data[i]));
  assert.equal(packed.indices.length, g.data.length / 10);
  const empty = indexGeometry([]); assert.equal(empty.data.length, 0); assert.equal(empty.indices.length, 0);
});
