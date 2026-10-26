/* ---------- chunks: the static world cut into square cells ----------
   Everything that never moves (ground, road, buildings, plants, rocks) is merged per cell into one mesh: a cell
   costs one draw call and cells out of view are skipped by the renderer. Ground far beyond the cells stays one
   horizon mesh. For a bigger world this is the place where far cells are dropped and near ones built on demand.
   Each cell remembers which triangles came from which source (terrain, town, ...) for bullet impacts. */
const CHUNKS = { size: 96, reach: 192, cells: new Map() };

// parts: [{ geo, kind }] (non-indexed). Returns [{ geo, kinds, key }] cells and one 'far' geometry for the rest.
function chunkStatic(parts, cx, cz) {
  const S = CHUNKS.size, cells = new Map(), far = { tris: [] };
  parts.forEach((part, pi) => {
    const P = part.geo.attributes.position.array, n = P.length / 9;
    for (let t = 0; t < n; t++) {
      const x = (P[t * 9] + P[t * 9 + 3] + P[t * 9 + 6]) / 3, z = (P[t * 9 + 2] + P[t * 9 + 5] + P[t * 9 + 8]) / 3;
      let bucket = far;
      if (Math.abs(x - cx) < CHUNKS.reach && Math.abs(z - cz) < CHUNKS.reach) {
        const key = Math.floor((x - cx) / S) + ',' + Math.floor((z - cz) / S);
        bucket = cells.get(key) || (cells.set(key, { key, tris: [] }), cells.get(key));
      }
      bucket.tris.push(pi, t);
    }
  });
  const build = (tris) => {
    const g = new THREE.BufferGeometry(), kinds = [];
    for (const name of Object.keys(parts[0].geo.attributes)) {
      const sz = parts[0].geo.attributes[name].itemSize, dst = new Float32Array((tris.length / 2) * 3 * sz);
      for (let i = 0, j = 0; i < tris.length; i += 2, j++) {
        const src = parts[tris[i]].geo.attributes[name].array, t = tris[i + 1];
        dst.set(src.subarray(t * 3 * sz, (t + 1) * 3 * sz), j * 3 * sz);
      }
      g.setAttribute(name, new THREE.BufferAttribute(dst, sz));
    }
    // runs of triangles from the same source: [first triangle, kind]
    for (let i = 0, j = 0; i < tris.length; i += 2, j++) if (!kinds.length || kinds[kinds.length - 1][1] !== parts[tris[i]].kind) kinds.push([j, parts[tris[i]].kind]);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return { geo: g, kinds };
  };
  const out = [];
  for (const c of cells.values()) out.push(Object.assign(build(c.tris), { key: c.key }));
  if (far.tris.length) out.push(Object.assign(build(far.tris), { key: 'far' }));
  return out;
}
// which source a triangle of a chunk mesh came from
function chunkKind(obj, tri) {
  const K = obj.userData.kinds;
  if (!K) return obj.name;
  let lo = 0, hi = K.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (K[m][0] <= tri) lo = m; else hi = m - 1; }
  return K[lo][1];
}
