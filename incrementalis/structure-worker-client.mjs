/** The classic build embeds the worker so direct file launch needs no fetch. */
export function createGeometryWorker() {
  if (typeof Worker === 'undefined') return null;
  try {
    const source = globalThis.incrementalisWorkerSource;
    if (source) {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      try { return new Worker(url); } finally { URL.revokeObjectURL(url); }
    }
    return new Worker(new URL('structure-worker.mjs', document.baseURI.replace(/tests\/[^/]*$/, '')), { type: 'module' });
  } catch { return null; }
}
