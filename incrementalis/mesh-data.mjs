/** Deduplicate complete vertex records; normals/material seams remain distinct. */
export function indexGeometry(source) {
  const input = source instanceof Float32Array ? source : new Float32Array(source);
  const count = input.length / 10, words = new Uint32Array(input.buffer, input.byteOffset, input.length);
  const output = new Float32Array(input.length), outputWords = new Uint32Array(output.buffer);
  const links = new Int32Array(count), indices = new Uint32Array(count), buckets = new Map();
  links.fill(-1); let unique = 0;
  for (let vertex = 0; vertex < count; vertex++) {
    const offset = vertex * 10; let hash = 2166136261;
    for (let k = 0; k < 10; k++) hash = Math.imul(hash ^ words[offset + k], 16777619);
    const first = buckets.get(hash) ?? -1; let found = first;
    while (found !== -1) {
      let same = true;
      for (let k = 0; k < 10; k++) if (words[offset + k] !== outputWords[found * 10 + k]) { same = false; break; }
      if (same) break;
      found = links[found];
    }
    if (found === -1) {
      found = unique++; output.set(input.subarray(offset, offset + 10), found * 10);
      links[found] = first; buckets.set(hash, found);
    }
    indices[vertex] = found;
  }
  return { data: output.slice(0, unique * 10), indices: unique <= 65536 ? new Uint16Array(indices) : indices };
}
