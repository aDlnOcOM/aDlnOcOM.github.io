import { Renderer } from './engine.js';
import { StructureStream } from './structure-stream.mjs';
import { createGeometryWorker } from './structure-worker-client.mjs';
import { worldToGrid, gridToWorld, cellAt, spaceScale } from './structure-space.mjs';
import { FLIGHT_SAVE_KEY, newFlight, readFlight, flightDirection, advanceFlight, slideFlight } from './flight-model.mjs';

export function bootFlight() {
  const canvas = document.getElementById('world'), menu = document.getElementById('menu');
  const start = document.getElementById('start-button'), save = document.getElementById('save-button');
  const settings=document.getElementById('view-settings'),distanceInput=document.getElementById('draw-distance'),distanceValue=document.getElementById('draw-distance-value');
  let state, renderer, stream, paused = true, stopped = false, previous = 0, time = 0;
  let yawTarget = 0, pitchTarget = 0, touchForward = 0, touchUp = 0, started = false;
  const keys = new Set(), pointers = new Map();
  let shownDistance=720;
  try {
    const seed = new Uint32Array(1); crypto.getRandomValues(seed); state = newFlight(seed[0]);
    try { const raw = localStorage.getItem(FLIGHT_SAVE_KEY); if (raw) state = readFlight(JSON.parse(raw)); } catch { /* Old game data is neither read nor overwritten. */ }
    yawTarget = state.yaw; pitchTarget = state.pitch;
    shownDistance=state.drawDistance; distanceInput.value=String(state.drawDistance/240);refreshDistance();
    renderer = new Renderer(canvas, matchMedia('(max-width: 700px)').matches ? 'low' : 'high');
    renderer.atmosphere('structure', 0, true); renderer.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.fogVertical = 1; renderer.materialReveal = .7;
    stream = new StructureStream(renderer, state.seed, createGeometryWorker()); stream.update(state.position, 1,state.drawDistance);
  } catch (error) { fail(error); return; }

  function fail(error) {
    console.error('Structure renderer:', error); stopped = true; menu.hidden = false;
    start.disabled = false; start.textContent = 'Повторить'; start.onclick = () => location.reload();
    start.title = error.message; save.hidden = true; settings.hidden = true;
  }
  function pause() {
    paused = true; menu.hidden = false; save.hidden = !started; document.body.classList.remove('flying');
    settings.hidden=!started;
    keys.clear(); pointers.clear(); touchForward = touchUp = 0; state.velocity.fill(0);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    start.focus({ preventScroll: true });
  }
  function refreshDistance(){distanceValue.textContent=['Низкая','Средняя','Высокая','Очень высокая','Максимальная'][state.drawDistance/240-2];}
  distanceInput.oninput=()=>{state.drawDistance=Number(distanceInput.value)*240;refreshDistance();};
  function begin() {
    if (start.disabled) return;
    started = true; paused = false; menu.hidden = true; save.hidden = false; document.body.classList.add('flying');
    keys.clear(); state.velocity.fill(0); canvas.focus({ preventScroll: true }); previous = performance.now();
    if (!matchMedia('(pointer: coarse), (max-width: 700px)').matches) {
      try { canvas.requestPointerLock()?.catch(() => {}); } catch { /* Dragging remains available. */ }
    }
  }
  function persist() {
    try {
      localStorage.setItem(FLIGHT_SAVE_KEY, JSON.stringify({ version: 1, seed: state.seed, position: state.position, yaw: state.yaw, pitch: state.pitch, drawDistance:state.drawDistance }));
      save.dataset.saved = 'true'; save.textContent = 'Сохранить'; save.setAttribute('aria-label', 'Сохранено');
      setTimeout(() => { delete save.dataset.saved; save.setAttribute('aria-label', 'Сохранить'); }, 1500);
    } catch { save.textContent = 'Не удалось сохранить'; save.setAttribute('aria-label', 'Не удалось сохранить'); }
  }
  function turn(dx, dy, sensitivity = .0022) {
    yawTarget -= dx * sensitivity;
    pitchTarget = Math.max(-1.52, Math.min(1.52, pitchTarget - dy * sensitivity));
  }
  start.onclick = begin; save.onclick = persist;
  const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'KeyE', 'KeyQ', 'KeyC', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat && !paused) pause(); return; }
    if (paused || e.metaKey || e.altKey) return;
    if (movement.has(e.code)) { e.preventDefault(); keys.add(e.code); }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else renderer.dirty = true; previous = performance.now(); });
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && !paused) pause(); });
  document.addEventListener('mousemove', e => { if (!paused && document.pointerLockElement === canvas) turn(e.movementX, e.movementY); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (paused || document.pointerLockElement === canvas) return;
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startY: e.clientY });
    if (pointers.size > 2) { pause(); return; }
    touchForward = pointers.size === 2 ? 1 : 0;
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p || paused) return;
    if (pointers.size === 1) turn(e.clientX - p.x, e.clientY - p.y, .003);
    else touchUp = Math.max(-1, Math.min(1, (p.startY - e.clientY) / 100));
    p.x = e.clientX; p.y = e.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => {
    pointers.delete(e.pointerId); touchForward = pointers.size === 2 ? 1 : 0; touchUp = 0;
  });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause(); fail(new Error('WebGL context lost')); });
  window.addEventListener('resize', () => renderer.resize());
  const pressed = (...codes) => Number(codes.some(code => keys.has(code)));

  function frame(now) {
    if (stopped) return;
    requestAnimationFrame(frame);
    const dt = Math.min(.04, Math.max(0, (now - (previous || now)) / 1000)); previous = now;
    if (document.hidden) return;
    if (!paused) {
      const t = 1 - Math.exp(-dt * 16); state.yaw += (yawTarget - state.yaw) * t; state.pitch += (pitchTarget - state.pitch) * t;
      const input = {
        forward: pressed('KeyW', 'ArrowUp') - pressed('KeyS', 'ArrowDown') + touchForward,
        right: pressed('KeyD', 'ArrowRight') - pressed('KeyA', 'ArrowLeft'),
        up: pressed('Space', 'KeyE') - pressed('KeyQ', 'KeyC', 'ControlLeft', 'ControlRight') + touchUp,
        fast: !!pressed('ShiftLeft', 'ShiftRight'),
      };
      const blocked = stream.collisionQuery(state.position);
      advanceFlight(state, input, dt, (p, delta) => slideFlight(p, delta, blocked));
      time += dt;
    }
    stream.update(state.position, 1,state.drawDistance);
    const renderScale=spaceScale(Math.hypot(...worldToGrid(state.position)));
    const distanceTarget=state.drawDistance<shownDistance?state.drawDistance:Math.min(state.drawDistance,Math.max(shownDistance,stream.availableDistance()));
    shownDistance+=(distanceTarget-shownDistance)*(1-Math.exp(-dt*1.8));
    // A settled pause screen does not need to redraw the same WebGL scene.
    if (paused && !renderer.dirty && !renderer.hasTransitions && Math.abs(shownDistance-distanceTarget)<.05) return;
    renderer.origin = state.position.map(v => Math.floor(v / 512) * 512);
    const eye = state.position.map((v, i) => v - renderer.origin[i]), direction = flightDirection(state.yaw, state.pitch);
    renderer.farDistance = (shownDistance+580) * renderScale; renderer.fogDensity = 2.1 / (shownDistance*renderScale);
    renderer.camera(eye, eye.map((v, i) => v + direction[i])); renderer.render(time, [], 0, dt);
    if (start.disabled && stream.loaded.size >= 7) {
      // An older save may now sit inside a newly added wall. Preserve its region.
      if (stream.collisionQuery(state.position)(state.position)) state.position = gridToWorld(cellAt(state.position));
      start.disabled = false; start.removeAttribute('aria-busy');
    }
  }
  requestAnimationFrame(frame);
}
