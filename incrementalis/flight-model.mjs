export const FLIGHT_SAVE_KEY = 'incrementalis.flight.v1';
export const FLIGHT_START = [0, 0, 62];
export function normalizeDrawDistance(value) { return Number.isFinite(value) ? Math.max(480, Math.min(1440, Math.round(value / 240) * 240)) : 720; }

export function newFlight(seed = 731927) {
  return { version: 1, seed: seed >>> 0, position: [...FLIGHT_START], yaw: 0, pitch: .08, velocity: [0, 0, 0], drawDistance: 720 };
}

export function readFlight(raw) {
  if (!raw || raw.version !== 1 || !Number.isInteger(raw.seed) || raw.seed < 0 || raw.seed > 0xffffffff) throw new Error('Некорректное сохранение');
  if (!Array.isArray(raw.position) || raw.position.length !== 3 || raw.position.some(n => !Number.isFinite(n) || Math.abs(n) > 1e12)) throw new Error('Некорректная позиция');
  if (!Number.isFinite(raw.yaw) || !Number.isFinite(raw.pitch)) throw new Error('Некорректное направление');
  return { ...newFlight(raw.seed), position: [...raw.position], yaw: raw.yaw % (Math.PI * 2), pitch: Math.max(-1.52, Math.min(1.52, raw.pitch)), drawDistance: normalizeDrawDistance(raw.drawDistance) };
}

export function flightDirection(yaw, pitch) {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

/** Exact exponential response: short inertia, independent of frame frequency. */
export function advanceFlight(state, input, dt, move = (p, d) => p.map((v, i) => v + d[i])) {
  dt = Math.max(0, Math.min(.1, dt));
  const forward = flightDirection(state.yaw, state.pitch), right = [Math.cos(state.yaw), 0, -Math.sin(state.yaw)];
  const desired = forward.map((v, i) => v * input.forward + right[i] * input.right + (i === 1 ? input.up : 0));
  const length = Math.hypot(...desired), speed = input.fast ? 78 : 26, response = length ? 7 : 5.5, decay = Math.exp(-response * dt);
  const delta = desired.map((v, i) => {
    const target = length ? v / Math.max(1, length) * speed : 0, previous = state.velocity[i];
    state.velocity[i] = target + (previous - target) * decay;
    return target * dt + (previous - target) * (1 - decay) / response;
  });
  const next = move(state.position, delta);
  for (let i = 0; i < 3; i++) if (Math.abs(next[i] - state.position[i] - delta[i]) > .001) state.velocity[i] *= .15;
  state.position = next;
}

export function sphereBlocked(p, collider, radius = .85) {
  if (collider.type === 'obb') {
    const delta = p.map((v,i)=>v-collider.center[i]);
    let d=0;
    for(let i=0;i<3;i++){const local=delta.reduce((sum,v,k)=>sum+v*collider.axes[i][k],0);d+=Math.max(0,Math.abs(local)-collider.half[i])**2;}
    return d<radius*radius;
  }
  if (collider.type === 'box') {
    let d = 0;
    for (let i = 0; i < 3; i++) d += Math.max(0, Math.abs(p[i] - collider.center[i]) - collider.size[i] / 2) ** 2;
    return d < radius * radius;
  }
  const ab = collider.b.map((v, i) => v - collider.a[i]), ap = p.map((v, i) => v - collider.a[i]);
  const t = Math.max(0, Math.min(1, ap.reduce((n, v, i) => n + v * ab[i], 0) / (ab.reduce((n, v) => n + v * v, 0) || 1)));
  return Math.hypot(...p.map((v, i) => v - collider.a[i] - ab[i] * t)) < radius + collider.radius;
}

/** Small steps prevent tunnelling; independent axes slide along walls. */
export function slideFlight(position, delta, blocked) {
  const p = [...position], steps = Math.max(1, Math.ceil(Math.hypot(...delta) / .6));
  for (let s = 0; s < steps; s++) for (let axis = 0; axis < 3; axis++) {
    const next = [...p]; next[axis] += delta[axis] / steps;
    if (!blocked(next)) p[axis] = next[axis];
  }
  return p;
}
