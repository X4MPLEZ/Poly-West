/* ---------- shot effects: muzzle flash and its light, smoke, debris, sparks, bullet holes ----------
   Everything lives in a handful of pooled meshes that are written in place, so a shot costs no new objects
   and the draw-call count stays flat no matter how much you shoot. */

/* a particle pool: one mesh, N small icosahedra; behaviour per particle (gravity, drag, growth, fade) */
function makePool(N, material, detail, withAlpha) {
  const tpl = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
  tpl.computeVertexNormals();
  const tp = tpl.attributes.position.array, tn = tpl.attributes.normal.array, nv = tp.length / 3, n = N * nv;
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), C = new Float32Array(n * 3);
  for (let i = 0; i < N; i++) Nn.set(tn, i * nv * 3);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('tile', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (withAlpha) g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  const items = [];
  for (let i = 0; i < N; i++) items.push({ alive: false });
  return {
    mesh, items, nv, tp, next: 0, live: 0,
    spawn(o, col) {
      const i = this.next; this.next = (this.next + 1) % N;
      const it = this.items[i];
      Object.assign(it, { alive: true, age: 0, grav: 0, drag: 0, grow: 0, wind: 0, a0: 1, sx: 1, sy: 1, sz: 1, bounce: false, rot: Math.random() * TAU, col0: col, col1: null }, o);
      this.setCol(i, col);
      this.live++;
      return it;
    },
    setCol(i, col) {
      const C = this.mesh.geometry.attributes.color;
      for (let v = 0; v < nv; v++) C.array.set(col, (i * nv + v) * 3);
      C.needsUpdate = true;
    },
    update(dt) {
      if (!this.live) return;
      const geo = this.mesh.geometry, P = geo.attributes.position.array, A = withAlpha ? geo.attributes.alpha.array : null;
      let live = 0;
      for (let i = 0; i < N; i++) {
        const it = this.items[i];
        if (!it.alive) continue;
        it.age += dt;
        let r = 0, a = 0;
        if (it.age >= it.life) { it.alive = false; }
        else {
          live++;
          const damp = Math.exp(-dt * it.drag);
          it.vx = it.vx * damp + it.wind * dt; it.vz *= damp; it.vy = it.vy * damp - it.grav * dt;
          it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
          if (it.bounce) {
            const gy = groundAt(it.x, it.z, it.y + 0.3);
            if (it.y < gy + 0.01) { it.y = gy + 0.01; it.vy = Math.abs(it.vy) * 0.3; it.vx *= 0.55; it.vz *= 0.55; }
          }
          const u = it.age / it.life;
          if (it.grow) { r = it.size * (1 + it.grow * (1 - Math.exp(-it.age * 4))); a = it.a0 * Math.min(1, it.age * 30) * Math.pow(1 - u, 1.6); }
          else { r = it.size * Math.min(1, (1 - u) * 3); a = 1; }
          if (it.col1 && it.age > 0.05) { this.setCol(i, it.col1); it.col1 = null; }
        }
        const c = Math.cos(it.rot), s = Math.sin(it.rot);
        for (let v = 0; v < this.nv; v++) {
          const o = (i * this.nv + v) * 3, tx = this.tp[v * 3] * it.sx, tz = this.tp[v * 3 + 2] * it.sz;
          P[o] = it.x + (tx * c - tz * s) * r; P[o + 1] = it.y + this.tp[v * 3 + 1] * it.sy * r; P[o + 2] = it.z + (tx * s + tz * c) * r;
          if (A) A[i * this.nv + v] = a;
        }
      }
      this.live = live;
      geo.attributes.position.needsUpdate = true;
      if (A) geo.attributes.alpha.needsUpdate = true;
    }
  };
}

/* bullet holes: per surface kind a dark core, a chipped ring in a lighter tone, cracks on glass.
   One pool for outdoors, one per room (lit by that room's light), oldest hole recycled first. */
const HOLE = {
  wood:    { core: 0x1e140c, ring: 0xd6ad7c, mix: 0.6, r1: 0.02, r2: 0.05, stretch: 1.9 },
  plaster: { core: 0x3a3028, ring: 0xf4eee2, mix: 0.6, r1: 0.018, r2: 0.075, stretch: 1.1 },
  brick:   { core: 0x2a2420, ring: 0xd6c6b2, mix: 0.45, r1: 0.02, r2: 0.06, stretch: 1.2 },
  stone:   { core: 0x2a2622, ring: 0xd2cabe, mix: 0.45, r1: 0.016, r2: 0.05, stretch: 1.2 },
  dirt:    { core: null, ring: null, dark: 0.45, ringDark: 0.78, r1: 0.032, r2: 0.075, stretch: 1.5 },
  metal:   { core: 0x1c1c1e, ring: 0xb8b6b2, mix: 0.7, r1: 0.012, r2: 0.028, stretch: 1.0 },
  glass:   { core: 0x14181c, ring: 0xe6eef0, mix: 0.8, r1: 0.012, r2: 0, cracks: true },
  cloth:   { core: 0x18120e, ring: null, ringDark: 0.75, r1: 0.014, r2: 0.026, stretch: 1.1 },
  cactus:  { core: 0x24321a, ring: 0xa8b878, mix: 0.6, r1: 0.02, r2: 0.04, stretch: 1.3 }
};
const DECALS = {
  N: 90, VPD: 84, pools: new Map(),
  pool(R) {
    const key = R || 'out';
    let p = this.pools.get(key);
    if (p) return p;
    const n = (R ? 40 : this.N) * this.VPD, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('tile', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({ uniforms: R ? R.mat.uniforms : U, vertexShader: SH.litV, fragmentShader: R ? SH.inF : SH.litF, vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    G.scene.add(mesh);
    p = { mesh, R, cap: R ? 40 : this.N, next: 0 };
    this.pools.set(key, p);
    return p;
  },
  add(R, pt, n, kind, surf) {
    const H = HOLE[kind]; if (!H) return;
    const p = this.pool(R), g = p.mesh.geometry, slot = p.next; p.next = (p.next + 1) % p.cap;
    const P = g.attributes.position.array, Nn = g.attributes.normal.array, C = g.attributes.color.array;
    const base = slot * this.VPD;
    let vi = 0;
    // tangent frame on the surface, randomly turned
    const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t = new THREE.Vector3().crossVectors(up, n).normalize(), b = new THREE.Vector3().crossVectors(n, t);
    const rot = Math.random() * TAU, cr = Math.cos(rot), sr = Math.sin(rot);
    const T = t.clone().multiplyScalar(cr).addScaledVector(b, sr), B = new THREE.Vector3().crossVectors(n, T);
    const at = (lift, x, y) => [pt.x + n.x * lift + T.x * x + B.x * y, pt.y + n.y * lift + T.y * x + B.y * y, pt.z + n.z * lift + T.z * x + B.z * y];
    const put = (v, col) => { const o = (base + vi) * 3; P[o] = v[0]; P[o + 1] = v[1]; P[o + 2] = v[2]; Nn[o] = n.x; Nn[o + 1] = n.y; Nn[o + 2] = n.z; C[o] = col[0]; C[o + 1] = col[1]; C[o + 2] = col[2]; vi++; };
    const fan = (lift, k, rx, ry, jit, col) => {
      const c = at(lift, 0, 0), pts = [];
      for (let i = 0; i < k; i++) { const a = (i / k) * TAU, j = 1 + (Math.random() - 0.5) * jit; pts.push(at(lift, Math.cos(a) * rx * j, Math.sin(a) * ry * j)); }
      for (let i = 0; i < k; i++) { put(c, col); put(pts[i], col); put(pts[(i + 1) % k], col); }
    };
    const ringCol = H.ring !== null && H.ring !== undefined ? mixc(surf, rgb(H.ring), H.mix) : mulc(surf, H.ringDark || 0.8);
    const coreCol = H.core !== null && H.core !== undefined ? rgb(H.core) : mulc(surf, H.dark || 0.4);
    const s = 1.1 + Math.random() * 0.4;
    if (H.r2 > 0) fan(0.004, 9, H.r2 * s * (H.stretch || 1), H.r2 * s, 0.55, ringCol);
    fan(0.006, 6, H.r1 * s, H.r1 * s, 0.3, coreCol);
    if (H.cracks) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.random() * 0.6, L = 0.05 + Math.random() * 0.12, w = 0.0035;
        const ca = Math.cos(a), sa = Math.sin(a), q = [[-sa * w, ca * w], [sa * w, -ca * w]];
        const p0 = at(0.005, q[0][0], q[0][1]), p1 = at(0.005, q[1][0], q[1][1]), p2 = at(0.005, ca * L + q[1][0] * 0.3, sa * L + q[1][1] * 0.3), p3 = at(0.005, ca * L + q[0][0] * 0.3, sa * L + q[0][1] * 0.3);
        put(p0, ringCol); put(p1, ringCol); put(p2, ringCol); put(p0, ringCol); put(p2, ringCol); put(p3, ringCol);
      }
    }
    for (; vi < this.VPD;) put([0, 0, 0], [0, 0, 0]);   // unused corners collapse to nothing
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.color.needsUpdate = true;
  },
  sync() { for (const p of this.pools.values()) p.mesh.visible = !p.R || p.R.mesh.visible; }
};

/* what was hit: from the mesh, the texture tile and the colour of the face */
function surfaceOf(hit) {
  const obj = hit.object, g = obj.geometry, i = hit.face.a;
  const col = g.attributes.color ? [g.attributes.color.getX(i), g.attributes.color.getY(i), g.attributes.color.getZ(i)] : [0.6, 0.5, 0.4];
  const tile = g.attributes.tile ? Math.round(g.attributes.tile.getX(i)) : 0;
  if (obj === W.terrain || obj === W.road) return { kind: 'dirt', col };
  if (obj === W.rocks) return { kind: 'stone', col };
  if (obj === W.plants) return { kind: col[1] > col[0] * 1.05 ? 'cactus' : null, col };
  if (DOORS.some((D) => D.meshes.includes(obj))) return { kind: null, col, splinter: true };
  if (tile >= 32) return { kind: col[0] + col[1] + col[2] < 0.6 ? 'glass' : 'wood', col };  // lettering on a shop window is glass
  if ([2, 3, 5, 13].includes(tile)) return { kind: 'wood', col };
  if (tile === 4) return { kind: 'plaster', col };
  if (tile === 7) return { kind: 'brick', col };
  if (tile === 12) return { kind: 'glass', col };
  if (tile === 9 || tile === 23 || tile === 30) return { kind: tile === 30 ? 'glass' : 'cloth', col };
  if (tile === 1 || tile === 11) return { kind: 'dirt', col };
  if (tile === 6 || tile === 10) return { kind: 'stone', col };
  const mx = Math.max(col[0], col[1], col[2]), mn = Math.min(col[0], col[1], col[2]), lum = col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11;
  if (mx - mn < 0.07 && lum < 0.38) return { kind: 'metal', col };
  if (mx - mn < 0.08 && lum > 0.6) return { kind: 'stone', col };
  return { kind: 'wood', col };
}

const FX = {
  init(scene) {
    // lit debris (shards, splinters, chips)
    this.debris = makePool(90, G.litMat, 0, false);
    scene.add(this.debris.mesh);
    // soft smoke and dust: lit, see-through, no depth writes
    this.smokeU = Object.assign({}, U, { uIndoor: { value: 0 } });
    const smokeMat = new THREE.ShaderMaterial({ uniforms: this.smokeU, vertexShader: SH.smokeV, fragmentShader: SH.smokeF, vertexColors: true, transparent: true, depthWrite: false });
    this.smoke = makePool(70, smokeMat, 1, true);
    this.smoke.mesh.renderOrder = 2;
    scene.add(this.smoke.mesh);
    // glowing sparks: unlit, added on top
    const sparkMat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.sparks = makePool(48, sparkMat, 0, false);
    this.sparks.mesh.renderOrder = 3;
    scene.add(this.sparks.mesh);
    // muzzle flash: three crossed petals plus a small burst out of the cylinder gap
    const flashMat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    const petal = this.petalGeo();
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(petal, flashMat); m.rotation.z = (k * Math.PI) / 3; this.flash.add(m); }
    this.gap = new THREE.Group();
    for (const s of [-1, 1]) { const m = new THREE.Mesh(petal, flashMat); m.rotation.y = s * Math.PI / 2; m.scale.set(0.5, 0.5, 0.35); this.gap.add(m); }
    this.flash.add(this.gap);
    this.flash.visible = false; this.flash.renderOrder = 4;
    this.flash.traverse((o) => { o.frustumCulled = false; });
    scene.add(this.flash);
    this.flashT = 0; this.light = 0; this.wisp = 0; this.wispT = 0;
    // impact star for punches: four petals in the screen plane, a flick of white
    this.star = new THREE.Group();
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(petal, flashMat); m.rotation.set(-Math.PI / 2, 0, 0); const h = new THREE.Group(); h.rotation.z = (k * Math.PI) / 2 + 0.3; h.add(m); this.star.add(h); }
    this.star.visible = false; this.star.renderOrder = 4; this.star.traverse((o) => { o.frustumCulled = false; });
    scene.add(this.star); this.starT = 0;
    // motion trail behind a fist: a ribbon that fades towards its tail
    const n = 8, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n * 2), 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.trail = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: SH.trailV, fragmentShader: SH.trailF, uniforms: { uCol: { value: new THREE.Vector3(1, 0.96, 0.88) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false; this.trail.visible = false; this.trail.renderOrder = 3;
    scene.add(this.trail);
    U.uFlash.value.set(0, -100, 0, 0);
  },
  petalGeo() {
    // a pointed diamond along +z: white-hot at the root, orange at the tips
    const hot = [1, 0.95, 0.75], mid = [1, 0.62, 0.2], tip = [0.6, 0.18, 0.02];
    const v = [[0, 0, 0, hot], [0.22, 0, 0.28, mid], [0, 0, 1, tip], [-0.22, 0, 0.28, mid], [0.12, 0, 0.62, tip], [-0.12, 0, 0.62, tip]];
    const tris = [[0, 1, 2], [0, 2, 3], [1, 4, 2], [3, 2, 5]];
    const P = [], C = [];
    for (const t of tris) for (const k of t) { P.push(v[k][0], v[k][1], v[k][2]); C.push(...v[k][3]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    return g;
  },
  // the shot itself: flash, light, smoke from the muzzle and the cylinder gap
  muzzle(mz, dir, gapPos) {
    const f = this.flash, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    f.position.copy(mz); f.quaternion.copy(q);
    f.rotateZ(Math.random() * TAU);
    const s = 0.27 + Math.random() * 0.12;
    f.scale.set(s, s, s * (1.3 + Math.random() * 0.7));
    this.gap.position.set(0, 0, -0.27 / s);
    f.visible = true; this.flashT = 0.045;
    this.light = 1;
    U.uFlash.value.set(mz.x + dir.x * 0.3, mz.y + dir.y * 0.3, mz.z + dir.z * 0.3, 0);
    const indoor = !!G.room;
    this.smokeU.uIndoor.value = indoor ? 1 : 0;
    // a plume: puffs shot out at very different speeds, so they string out along the line of fire, then rise and drift
    for (let k = 0; k < 11; k++) {
      const sp = 2 + Math.pow(Math.random(), 0.7) * 11, spr = 0.1 + Math.random() * 0.1;
      const vx = dir.x + (Math.random() - 0.5) * spr, vy = dir.y + (Math.random() - 0.5) * spr, vz = dir.z + (Math.random() - 0.5) * spr;
      const grey = mixc(rgb(0xe8e2d6), rgb(0xb4aca0), Math.random());
      this.smoke.spawn({ x: mz.x, y: mz.y, z: mz.z, vx: vx * sp, vy: vy * sp + 0.1, vz: vz * sp, life: 1.2 + Math.random() * 1.4, size: 0.022 + Math.random() * 0.026,
        grow: 2 + Math.random() * 2.5, drag: 3 + Math.random() * 1.6, grav: -0.2 - Math.random() * 0.2, wind: 0.14, a0: 0.26 + Math.random() * 0.2, col1: grey }, rgb(0xffd9a0));
    }
    // and a soft billow hanging right at the muzzle
    for (let k = 0; k < 3; k++) {
      const sp = 0.6 + Math.random() * 1.2;
      this.smoke.spawn({ x: mz.x, y: mz.y, z: mz.z, vx: dir.x * sp + (Math.random() - 0.5) * 0.4, vy: dir.y * sp + 0.15, vz: dir.z * sp + (Math.random() - 0.5) * 0.4, life: 1.6 + Math.random(), size: 0.03,
        grow: 3, drag: 2.5, grav: -0.3, wind: 0.12, a0: 0.3, col1: rgb(0xd6d0c4) }, rgb(0xffd090));
    }
    // a little puff out of each side of the cylinder gap
    for (const s2 of [-1, 1]) {
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q).multiplyScalar(s2);
      for (let k = 0; k < 2; k++) this.smoke.spawn({ x: gapPos.x, y: gapPos.y, z: gapPos.z, vx: side.x * 2.2, vy: side.y * 2.2 + 0.3, vz: side.z * 2.2, life: 0.9 + Math.random() * 0.6,
        size: 0.025, grow: 3, drag: 6, grav: -0.3, wind: 0.12, a0: 0.35, col1: rgb(0xd8d2c6) }, rgb(0xffd090));
    }
    // a few hot sparks of burning powder
    for (let k = 0; k < 6; k++) {
      const sp = 4 + Math.random() * 6;
      this.sparks.spawn({ x: mz.x, y: mz.y, z: mz.z, vx: (dir.x + (Math.random() - 0.5) * 0.35) * sp, vy: (dir.y + (Math.random() - 0.5) * 0.35) * sp, vz: (dir.z + (Math.random() - 0.5) * 0.35) * sp,
        life: 0.12 + Math.random() * 0.18, size: 0.012, drag: 3, grav: 2, sx: 0.6, sy: 0.6, sz: 2.2 }, [1, 0.7, 0.3]);
    }
    this.wisp = 0.9; this.wispT = 0;
  },
  impactStar(p, size) {
    this.star.position.copy(p); this.star.quaternion.copy(G.cam.quaternion); this.star.rotateZ(Math.random() * TAU);
    this.starSize = size; this.starT = 0.09; this.star.visible = true; this.star.scale.setScalar(size * 0.5);
  },
  drawTrail(pts, width, alpha) {
    const m = this.trail;
    if (pts.length < 2 || alpha <= 0) { m.visible = false; return; }
    const P = m.geometry.attributes.position.array, A = m.geometry.attributes.alpha.array, n = 8;
    const view = new THREE.Vector3(); G.cam.getWorldDirection(view);
    const side = new THREE.Vector3(), seg = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const j = Math.min(i, pts.length - 1), q = pts[j];
      seg.subVectors(pts[Math.min(j + 1, pts.length - 1)], pts[Math.max(j - 1, 0)]);
      side.crossVectors(seg, view).normalize();
      const u = pts.length > 1 ? j / (pts.length - 1) : 1, w = width * (0.25 + 0.75 * u) / 2;
      P.set([q.x + side.x * w, q.y + side.y * w, q.z + side.z * w, q.x - side.x * w, q.y - side.y * w, q.z - side.z * w], i * 6);
      A[i * 2] = A[i * 2 + 1] = alpha * 0.38 * u * u;
    }
    m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.alpha.needsUpdate = true;
    m.visible = true;
  },
  // what a bullet does to a surface
  impact(hit, dir) {
    const S = surfaceOf(hit);
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.dot(dir) > 0) n.negate();
    const p = hit.point, R = ROOMS.find((r) => r.mesh === hit.object) || null;
    const kind = S.kind;
    if (kind && !DOORS.some((D) => D.meshes.includes(hit.object))) DECALS.add(R, p, n, kind, S.col);
    const out = (sp, spread) => ({ vx: (n.x + (Math.random() - 0.5) * spread) * sp, vy: (n.y + (Math.random() - 0.5) * spread) * sp + 0.6, vz: (n.z + (Math.random() - 0.5) * spread) * sp });
    const debris = (count, col, size, grav) => { for (let k = 0; k < count; k++) this.debris.spawn(Object.assign({ x: p.x + n.x * 0.02, y: p.y + n.y * 0.02, z: p.z + n.z * 0.02, life: 0.6 + Math.random() * 0.7, size: size * (0.6 + Math.random() * 0.8), grav: grav || 9.8, drag: 0.6, bounce: true }, out(1.5 + Math.random() * 2.5, 1.4)), mulc(col, 0.85 + Math.random() * 0.3)); };
    const dust = (count, col, a0) => { for (let k = 0; k < count; k++) this.smoke.spawn(Object.assign({ x: p.x + n.x * 0.03, y: p.y + n.y * 0.03, z: p.z + n.z * 0.03, life: 0.7 + Math.random() * 0.8, size: 0.03, grow: 4 + Math.random() * 2, drag: 4, grav: -0.15, wind: 0.1, a0: a0 || 0.45 }, out(1 + Math.random() * 1.5, 1.2)), mixc(col, [0.9, 0.86, 0.8], 0.4)); };
    const sparks = (count) => { for (let k = 0; k < count; k++) this.sparks.spawn(Object.assign({ x: p.x, y: p.y, z: p.z, life: 0.15 + Math.random() * 0.25, size: 0.008, drag: 1.5, grav: 6, sx: 0.6, sy: 0.6, sz: 1.8, rot: Math.random() * TAU }, out(3 + Math.random() * 4, 1.6)), [1, 0.75 + Math.random() * 0.2, 0.35]); };
    switch (kind) {
      case 'wood': debris(7, mixc(S.col, rgb(0xd6ad7c), 0.5), 0.022); dust(2, S.col, 0.3); break;
      case 'plaster': debris(5, mixc(S.col, [0.95, 0.93, 0.88], 0.6), 0.02); dust(5, [0.95, 0.93, 0.88], 0.55); break;
      case 'brick': case 'stone': debris(6, mixc(S.col, [0.8, 0.76, 0.7], 0.3), 0.02); dust(4, S.col, 0.45); if (Math.random() < 0.5) sparks(3); break;
      case 'dirt': debris(6, mulc(S.col, 0.8), 0.022); dust(6, S.col, 0.55); DUST.burst(p, Math.atan2(dir.x, dir.z), 3); break;
      case 'metal': sparks(10); debris(2, [0.4, 0.4, 0.4], 0.012); break;
      case 'glass': debris(8, [0.75, 0.85, 0.85], 0.016); break;
      case 'cloth': dust(3, S.col, 0.35); break;
      case 'cactus': debris(6, S.col, 0.02); break;
      default: if (S.splinter) debris(6, mixc(S.col, rgb(0xd6ad7c), 0.5), 0.02); else dust(3, S.col, 0.35);
    }
    return S;
  },
  update(dt, muzzleNow) {
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    // the light: a bright flick that falls off within a few frames
    if (this.light > 0) {
      this.light = Math.max(0, this.light - dt / 0.085);
      U.uFlash.value.w = 8 * this.light * this.light;
    }
    // thin smoke still curling out of the barrel
    if (this.wisp > 0 && muzzleNow) {
      this.wisp -= dt; this.wispT -= dt;
      if (this.wispT <= 0) {
        this.wispT = 0.07;
        this.smoke.spawn({ x: muzzleNow.x, y: muzzleNow.y, z: muzzleNow.z, vx: (Math.random() - 0.5) * 0.05, vy: 0.25 + Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.05,
          life: 1.2, size: 0.012, grow: 2.5, drag: 1, grav: -0.15, wind: 0.08, a0: 0.3 * Math.min(1, this.wisp) }, rgb(0xcfc9be));
      }
    }
    if (this.starT > 0) {
      this.starT -= dt;
      const u = 1 - Math.max(0, this.starT) / 0.09;
      this.star.scale.setScalar(this.starSize * (u < 0.3 ? 0.5 + u * 2 : 1.1 * (1 - (u - 0.3) / 0.7) + 0.05));
      this.star.quaternion.copy(G.cam.quaternion);
      if (this.starT <= 0) this.star.visible = false;
    }
    this.debris.update(dt); this.smoke.update(dt); this.sparks.update(dt);
    DECALS.sync();
  }
};
