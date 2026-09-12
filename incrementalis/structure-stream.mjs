import { cellAt, structurePlan } from './structure-space.mjs';
import { structureGeometry } from './structure-geometry.mjs';
import { sphereBlocked, normalizeDrawDistance } from './flight-model.mjs';

export const STREAM_RADIUS = 3;

export function visibleCells(position, radius = STREAM_RADIUS) {
  radius = Math.max(2, Math.min(6, Math.round(radius)));
  const center = cellAt(position), result = [];
  for (let x = -radius; x <= radius; x++) for (let y = -radius; y <= radius; y++) for (let z = -radius; z <= radius; z++) {
    const d = Math.hypot(x, y, z);
    if (d > radius) continue;
    const cell = center.map((v, i) => v + [x, y, z][i]);
    result.push({ cell, key: cell.join(':'), detail: d <= 1 ? 2 : d <= 2 ? 1 : d <= 3 ? 0 : -1, distance: d });
  }
  return result.sort((a, b) => a.distance - b.distance);
}

export class StructureStream {
  constructor(renderer, seed, worker = null) {
    this.renderer = renderer; this.seed = seed; this.loaded = new Map(); this.pending = []; this.center = ''; this.distance = 720;
    this.wanted = new Map(); this.worker = worker; this.inFlight = null; this.ready = null;
    if (worker) {
      worker.onmessage = ({ data }) => { this.ready = data; };
      worker.onerror = event => {
        event.preventDefault?.(); worker.terminate(); this.worker = null; this.inFlight = this.ready = null;
        this.pending = [...this.wanted.values()].filter(item => this.loaded.get(item.key)?.detail !== item.detail);
      };
    }
  }
  update(position, budget = 1, distance = this.distance) {
    this.distance=normalizeDrawDistance(distance);
    const radius=this.distance/240,center = `${cellAt(position).join(':')}:${radius}`;
    if (center !== this.center) {
      this.center = center;
      const wanted = visibleCells(position,radius), keys = new Set(wanted.map(item => item.key));
      this.wanted = new Map(wanted.map(item => [item.key, item]));
      for (const [key] of this.loaded) if (!keys.has(key)) { this.renderer.removeMesh(`structure:${key}`, true); this.loaded.delete(key); }
      this.pending = wanted.filter(item => this.loaded.get(item.key)?.detail !== item.detail && !(this.inFlight?.key === item.key && this.inFlight.detail === item.detail));
    }
    if (this.ready && budget > 0) {
      const item = this.ready; this.ready = this.inFlight = null;
      if (this.wanted.get(item.key)?.detail === item.detail) {
        this.upload(item, { geometry: { data: item.vertices, indices: item.indices }, origin: item.origin, colliders: item.colliders }, item.plan); budget--;
      }
    }
    if (this.worker) {
      if (!this.inFlight && this.pending.length) {
        this.inFlight = this.pending.shift();
        this.worker.postMessage({ ...this.inFlight, seed: this.seed });
      }
      return;
    }
    for (let i = 0; i < budget && this.pending.length; i++) {
      const item = this.pending.shift(), plan = structurePlan(item.cell, this.seed), mesh = structureGeometry(plan, item.detail);
      this.upload(item, mesh, plan);
    }
  }
  upload(item, mesh, plan) {
    const name = `structure:${item.key}`;
    this.renderer.setMesh(name, mesh.geometry, false, false, true); this.renderer.meshOrigin(name, mesh.origin);
    // Do not retain transferred CPU vertices in the streaming cache.
    this.loaded.set(item.key, { key: item.key, cell: item.cell, detail: item.detail, plan, origin: mesh.origin, colliders: item.detail < 0 ? [] : mesh.colliders });
  }
  availableDistance() {
    if (!this.pending.length && !this.inFlight) return this.distance;
    for (const item of this.wanted.values()) if (!this.loaded.has(item.key)) return Math.max(480, item.distance * 240);
    return this.distance;
  }
  collisionQuery(position) {
    const cell = cellAt(position), nearby = [...this.loaded.values()].filter(item => item.cell.every((v, i) => Math.abs(v - cell[i]) <= 1));
    const candidates = nearby.map(item => {
      const p = position.map((v, i) => v - item.origin[i]);
      const colliders = item.colliders.filter(c => [0, 1, 2].every(i => c.type === 'obb'
        ? Math.abs(p[i] - c.center[i]) <= c.extent[i] + 12
        : c.type === 'box' ? Math.abs(p[i]-c.center[i])<=c.size[i]/2+12 : p[i] >= Math.min(c.a[i], c.b[i]) - c.radius - 12 && p[i] <= Math.max(c.a[i], c.b[i]) + c.radius + 12));
      return { origin: item.origin, colliders };
    }).filter(item => item.colliders.length);
    return point => candidates.some(item => {
      const p = point.map((v, i) => v - item.origin[i]);
      return item.colliders.some(c => sphereBlocked(p, c));
    });
  }
}
