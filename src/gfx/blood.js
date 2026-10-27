/* ---------- blood: spatter, runs, pools, drops, the artery pumping ----------
   Marks on surfaces, written in place into a few pooled meshes (per room and one outdoors, like the bullet holes
   of combat/fx.js), so blood costs no new objects and at most two draw calls per room:
     big  : spatter (a blob or three and droplets flung the way the bullet went, long and thin the flatter it hit, with
            runs that creep down a wall), pools (they spread while a man lies bleeding, a few tongues run out
            over the boards) — up to 100 triangles a mark
     small: drops (round with a crown when they fall straight, drawn out when he walks) — 12 triangles a mark
   Fresh blood is bright and wet, over a few game hours it turns dark brown (the colours are rewritten now and
   then, only for marks that are still changing). How much there is follows the setting "Blut". */
const BLOOD = {
  VB: 300, VS: 36, CAP: { big: [40, 56], small: [140, 180] },   // [in a room, outdoors]
  sets: new Map(), all: [], runs: [], pools: [], _a: new THREE.Vector3(), _b: new THREE.Vector3(), _c: new THREE.Vector3(), _n: new THREE.Vector3(),
  FRESH: [0.42, 0.025, 0.02], DRY: [0.16, 0.045, 0.03],
  k() { const v = SETTINGS.v.blood; return v === 'off' ? 0 : v === 'more' ? 1.6 : 1; },
  // the mesh for a room ('out': the street), big or small marks
  set(R, kind) {
    let E = this.sets.get(R || 'out');
    if (!E) this.sets.set(R || 'out', E = {});
    let S = E[kind];
    if (S) return S;
    const cap = this.CAP[kind][R ? 0 : 1], vpd = kind === 'big' ? this.VB : this.VS, n = cap * vpd, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('tile', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({ uniforms: R ? R.mat.uniforms : U, vertexShader: SH.litV, fragmentShader: R ? SH.inF : SH.litF, vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: kind === 'big' ? -5 : -4 });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1;
    G.scene.add(mesh);
    S = { mesh, R, kind, cap, vpd, next: 0, shade: new Float32Array(n), born: new Float32Array(cap).fill(-1e9), age: new Float32Array(cap) };
    E[kind] = S; this.all.push(S);
    return S;
  },
  // a slot for a new mark (the oldest goes); returns a writer
  slot(R, kind) {
    const S = this.set(R, kind), i = S.next; S.next = (S.next + 1) % S.cap;
    this.runs = this.runs.filter((r) => !(r.S === S && r.i === i)); this.pools = this.pools.filter((p) => !(p.S === S && p.i === i));
    S.born[i] = TIME.min; S.age[i] = -1;
    return { S, i, v: 0 };
  },
  // a frame on a surface: point, normal, u (in the surface, the way it was flung), v = n × u
  frame(pt, n, dir) {
    const u = new THREE.Vector3(), w = new THREE.Vector3();
    if (dir) u.copy(dir).addScaledVector(n, -dir.dot(n));
    if (!dir || u.lengthSq() < 1e-4) {
      u.crossVectors(Math.abs(n.y) > 0.9 ? this._c.set(1, 0, 0) : this._c.set(0, 1, 0), n).normalize(); w.crossVectors(n, u);
      const a = Math.random() * TAU; u.multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a));
    }
    u.normalize(); w.crossVectors(n, u).normalize();
    return { p: pt.clone(), n: n.clone(), u, w };
  },
  // write one corner (frame F, lift off the surface, u/v coordinates, shade)
  put(W, F, lift, x, y, sh) {
    const S = W.S, o = W.i * S.vpd + W.v, g = S.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array;
    if (W.v >= S.vpd) return;
    P[o * 3] = F.p.x + F.n.x * lift + F.u.x * x + F.w.x * y; P[o * 3 + 1] = F.p.y + F.n.y * lift + F.u.y * x + F.w.y * y; P[o * 3 + 2] = F.p.z + F.n.z * lift + F.u.z * x + F.w.z * y;
    N[o * 3] = F.n.x; N[o * 3 + 1] = F.n.y; N[o * 3 + 2] = F.n.z; S.shade[o] = sh; W.v++;
  },
  // (counter-clockwise seen from the surface, whatever order the corners come in: the material shows one side only)
  tri(W, F, lift, a, b, c, sh) {
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) { const t = b; b = c; c = t; }
    this.put(W, F, lift, a[0], a[1], sh); this.put(W, F, lift, b[0], b[1], sh); this.put(W, F, lift, c[0], c[1], sh);
  },
  // an irregular blob: k corners round (cx, cy), radii rx/ry, jitter
  blob(W, F, lift, cx, cy, rx, ry, k, jit, sh, shEdge) {
    const pts = [];
    for (let i = 0; i < k; i++) { const a = (i / k) * TAU, j = 1 + (Math.random() - 0.5) * jit; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
    for (let i = 0; i < k; i++) { this.put(W, F, lift, cx, cy, sh); this.put(W, F, lift, pts[i][0], pts[i][1], shEdge); this.put(W, F, lift, pts[(i + 1) % k][0], pts[(i + 1) % k][1], shEdge); }
  },
  // a droplet: a drawn-out diamond, its tail pointing away (dx, dy: unit, s: size, e: how drawn out)
  droplet(W, F, lift, x, y, dx, dy, s, e, sh) {
    const px = -dy * s, py = dx * s, f = [x + dx * s * e, y + dy * s * e], b = [x - dx * s * 0.8, y - dy * s * 0.8];
    this.tri(W, F, lift, b, [x + px, y + py], f, sh); this.tri(W, F, lift, b, f, [x - px, y - py], sh);
  },
  close(W) {
    const S = W.S, P = S.mesh.geometry.attributes.position.array;
    for (; W.v < S.vpd; W.v++) { const o = (W.i * S.vpd + W.v) * 3; P[o] = P[o + 1] = P[o + 2] = 0; }
    this.colour(S, W.i, 0);
    const g = S.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  },
  // the colours of a mark for its age (0 fresh … 1 dried)
  colour(S, i, a) {
    const C = S.mesh.geometry.attributes.color.array, F = this.FRESH, D = this.DRY;
    const r = F[0] + (D[0] - F[0]) * a, g = F[1] + (D[1] - F[1]) * a, b = F[2] + (D[2] - F[2]) * a;
    for (let v = 0; v < S.vpd; v++) { const o = i * S.vpd + v, sh = S.shade[o]; C[o * 3] = r * sh; C[o * 3 + 1] = g * sh; C[o * 3 + 2] = b * sh; }
    S.mesh.geometry.attributes.color.needsUpdate = true; S.age[i] = a;
  },
  /* ---- spatter: a bullet came out of someone (or went in), the blood flung onto a wall or the floor. dir: the way
     it flew; k: how much (a head: more). On a wall a few runs start to creep down. ---- */
  splat(R, pt, n, dir, k) {
    const K = this.k(); if (!K) return;
    k = (k || 1) * K;
    const W = this.slot(R, 'big'), F = this.frame(pt, n, dir), perp = dir ? Math.abs(dir.dot(n)) : 1;
    const r0 = (0.045 + Math.random() * 0.03) * Math.sqrt(k), along = 1 + (1 - perp) * 0.8;
    // the blob, a little ahead of where it hit (longer the flatter it came), and a few smaller ones beside it
    this.blob(W, F, 0.006, r0 * 0.25, 0, r0 * along, r0, 12, 0.6, 1.05, 0.8);
    for (let j = 0; j < 3; j++) { const a = (Math.random() - 0.5) * (0.6 + perp * 5), d = r0 * (0.7 + Math.random() * 0.6), rr = r0 * (0.3 + Math.random() * 0.3); this.blob(W, F, 0.0065, Math.cos(a) * d, Math.sin(a) * d, rr * along, rr, 6, 0.5, 1, 0.82); }
    // droplets: in a fan the way it flew (all round when it hit straight on), further = smaller and longer
    const nd = Math.round(14 + 5 * Math.min(2, k)), spread = 0.5 + perp * 2.6;
    for (let j = 0; j < nd; j++) {
      const a = (Math.random() + Math.random() - 1) * spread, d = r0 * 0.8 + Math.pow(Math.random(), 2.2) * 0.42 * Math.sqrt(k);
      const dx = Math.cos(a), dy = Math.sin(a), s = Math.max(0.003, (0.007 + Math.random() * 0.012) * (1 - d / 0.7)) * Math.sqrt(k);
      this.droplet(W, F, 0.006, dx * d, dy * d, dx, dy, s, 1.2 + (1 - perp) * 2.5 + d * 6, 0.75 + Math.random() * 0.35);
    }
    // on a wall: runs from the blob and the big drops, down the wall (they are drawn while they creep)
    if (Math.abs(n.y) < 0.35) {
      const down = this._c.set(0, -1, 0), du = down.dot(F.u), dw = down.dot(F.w), dl = Math.hypot(du, dw) || 1;
      const nr = Math.min(3, 1 + Math.floor(Math.random() * 2 * Math.min(1.5, k)));
      for (let j = 0; j < nr; j++) {
        const base = W.v; for (let q = 0; q < 12; q++) this.put(W, F, 0.007, 0, 0, 0.8);
        const x0 = (Math.random() - 0.5) * r0 * 0.9 + (du / dl) * r0 * 0.5, y0 = (Math.random() - 0.5) * r0 * 0.9 + (dw / dl) * r0 * 0.5;
        this.runs.push({ S: W.S, i: W.i, base, F, x0, y0, du: du / dl, dw: dw / dl, wid: 0.005 + Math.random() * 0.006, len: 0, to: 0.1 + Math.random() * 0.35 * Math.min(1.4, k), tau: 2.5 + Math.random() * 5, t: 0 });
      }
    }
    this.close(W);
  },
  /* ---- a pool where a man lies bleeding: it spreads with what he loses (vol: blood fraction lost), tongues
     run out over the floor ---- */
  pool(N, vol) {
    const K = this.k(); if (!K) return;
    const H = N.hp, at = H.dripPoint(this._a), R = N.room || null;
    const gy = groundAt(at.x, at.z, N.pos.y + 0.3);
    let P = H.poolMark;
    if (!P || P.R !== R || Math.hypot(P.x - at.x, P.z - at.z) > 0.45 || !this.pools.includes(P)) {
      const W = this.slot(R, 'big'), F = this.frame(new THREE.Vector3(at.x, gy + 0.004, at.z), this._n.set(0, 1, 0), null);
      P = H.poolMark = { S: W.S, i: W.i, F, x: at.x, z: at.z, vol: 0, r: 0.02, lobes: [0, 1, 2].map(() => ({ a: Math.random() * TAU, k: 0.4 + Math.random() * 0.9, w: 0.2 + Math.random() * 0.25 })), noise: Array.from({ length: 16 }, () => Math.random() - 0.5), R, t: 0 };
      this.pools.push(P);
    }
    P.vol += vol * K;
  },
  writePool(P) {
    const S = P.S, W = { S, i: P.i, v: 0 }, F = P.F, k = 16, pts = [], rim = [];
    const lobeGrow = clamp((P.r - 0.12) / 0.5, 0, 1);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU;
      let f = 1 + P.noise[i] * 0.22;
      for (const L of P.lobes) { const d = wrapA(a - L.a); f += L.k * lobeGrow * Math.exp(-(d * d) / (2 * L.w * L.w)); }
      const r = P.r * f;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]); rim.push([Math.cos(a) * (r + 0.012), Math.sin(a) * (r + 0.012)]);
    }
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      this.tri(W, F, 0.005, [0, 0], pts[i], pts[j], 0.9);
      this.tri(W, F, 0.004, pts[i], rim[i], rim[j], 0.62); this.tri(W, F, 0.004, pts[i], rim[j], pts[j], 0.62);
    }
    this.close(W); this.colour(S, P.i, Math.max(0, S.age[P.i]));
  },
  /* ---- a drop on the floor under a bleeding man (from where the blood runs off him) ---- */
  drip(N, from) {
    const K = this.k(); if (!K) return;
    const R = N.room || null, x = from.x + (Math.random() - 0.5) * 0.08, z = from.z + (Math.random() - 0.5) * 0.08, gy = groundAt(x, z, N.pos.y + 0.3);
    const h = Math.max(0.1, from.y - gy), mv = N.speed;
    const dir = mv > 0.2 ? this._c.set(N.vx, 0, N.vz).normalize() : null;
    this.drop(R, x, gy, z, dir, (0.009 + Math.random() * 0.008) * Math.sqrt(K), h, mv);
  },
  drop(R, x, gy, z, dir, s, h, mv) {
    const W = this.slot(R, 'small'), F = this.frame(new THREE.Vector3(x, gy + 0.003, z), this._n.set(0, 1, 0), dir);
    const e = 1 + Math.min(1.5, (mv || 0) * 0.6);
    this.blob(W, F, 0.003, 0, 0, s * e, s, 6, 0.35, 1, 0.85);
    // the crown of a drop that fell from high up: little satellites round it (or flung ahead when he walks)
    const ns = h > 0.5 ? 3 : 1;
    for (let j = 0; j < ns; j++) { const a = dir ? (Math.random() - 0.5) * 0.8 : Math.random() * TAU, d = s * (1.6 + Math.random() * 1.6) * e; this.droplet(W, F, 0.003, Math.cos(a) * d, Math.sin(a) * d, Math.cos(a), Math.sin(a), s * 0.28, 1.8, 0.85); }
    this.close(W);
  },
  /* ---- a torn artery pumps: a spurt with each beat, out of the wound, landing as drops ---- */
  spurt(p, n, k, N) {
    const K = this.k(); if (!K) return;
    k = clamp(k, 0.3, 1.5);
    const vx = n.x * 1.6 * k, vy = 0.6 + Math.max(0, n.y) * 1.2 * k, vz = n.z * 1.6 * k;
    for (let j = 0; j < Math.round(7 * k); j++) {
      const f = 0.6 + Math.random() * 0.6;
      FX.debris.spawn({ x: p.x, y: p.y, z: p.z, vx: vx * f + (Math.random() - 0.5) * 0.3, vy: vy * f + (Math.random() - 0.5) * 0.3, vz: vz * f + (Math.random() - 0.5) * 0.3, life: 0.5, size: 0.008 + Math.random() * 0.008, grav: 9.8, drag: 0.4, bounce: false }, [0.5, 0.03, 0.03]);
    }
    // where it lands (the arc down to the floor)
    const gy = groundAt(p.x, p.z, p.y + 0.2), dy = p.y - gy, t = (vy + Math.sqrt(vy * vy + 2 * 9.8 * Math.max(0, dy))) / 9.8;
    for (let j = 0; j < 2; j++) { const f = 0.7 + Math.random() * 0.5; this.drop(N.room || null, p.x + vx * t * f, gy, p.z + vz * t * f, this._c.set(vx, 0, vz).normalize(), 0.01 + Math.random() * 0.008, 1, 1.5); }
  },
  /* ---- per frame: runs creep, pools spread, old marks darken ---- */
  update(dt) {
    for (let j = this.runs.length - 1; j >= 0; j--) {
      const r = this.runs[j]; r.t += dt;
      const L = r.to * (1 - Math.exp(-r.t / r.tau)), W = { S: r.S, i: r.i, v: r.base }, x1 = r.x0 + r.du * L, y1 = r.y0 + r.dw * L, px = -r.dw * r.wid, py = r.du * r.wid;
      // the streak, thinning towards its end, and a fat drop at the end of it
      this.tri(W, r.F, 0.007, [r.x0 + px, r.y0 + py], [x1 + px * 0.6, y1 + py * 0.6], [x1 - px * 0.6, y1 - py * 0.6], 0.8);
      this.tri(W, r.F, 0.007, [r.x0 + px, r.y0 + py], [x1 - px * 0.6, y1 - py * 0.6], [r.x0 - px, r.y0 - py], 0.8);
      const b = r.wid * 1.5;
      this.tri(W, r.F, 0.007, [x1 - px * 1.4, y1 - py * 1.4], [x1 + px * 1.4, y1 + py * 1.4], [x1 + r.du * b, y1 + r.dw * b], 0.7);
      this.tri(W, r.F, 0.007, [x1 - px * 1.4, y1 - py * 1.4], [x1 + px * 1.4, y1 + py * 1.4], [x1 - r.du * b * 0.4, y1 - r.dw * b * 0.4], 0.8);
      r.S.mesh.geometry.attributes.position.needsUpdate = true;
      this.colour(r.S, r.i, Math.max(0, r.S.age[r.i]));
      if (r.t > r.tau * 4) this.runs.splice(j, 1);
    }
    for (const P of this.pools) {
      // it spreads towards what has run out (≈ 1.5 litres: about a metre across), slower as it gets bigger
      const want = clamp(Math.sqrt(P.vol) * 1.25, 0.03, 1.1);
      if (want > P.r + 0.002) { P.r += (want - P.r) * (1 - Math.exp(-dt * 0.35)) + dt * 0.003; P.t -= dt; if (P.t <= 0) { P.t = 0.12; this.writePool(P); } }
    }
    // darkening (now and then; only marks younger than five game hours change)
    this.ageT = (this.ageT || 0) - dt;
    if (this.ageT <= 0) {
      this.ageT = 2;
      for (const S of this.all) for (let i = 0; i < S.cap; i++) {
        if (S.born[i] < -1e8) continue;
        const a = clamp((TIME.min - S.born[i]) / 300, 0, 1);
        if (a - S.age[i] > 0.02) this.colour(S, i, a);
      }
    }
    for (const S of this.all) S.mesh.visible = !S.R || !!S.R.mesh.visible;
  }
};
