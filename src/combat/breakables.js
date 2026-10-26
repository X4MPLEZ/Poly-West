/* ---------- glass one can shoot to pieces: bottles, glasses, jars and vases inside the buildings ----------
   They are part of their room's mesh (no extra draw calls). The furniture code registers the vertex range of each piece
   (glassHere in world/furniture.js); a hit collapses those vertices to one point, so the piece vanishes, and a burst of
   shards, a splash and the glass recording take its place. Some time after you have left the room it is put back. */
const BREAK = {
  items: GLASSWARE, byRoom: new Map(), broken: [], ray: null,
  KIND: { bottle: 'Flasche', glass: 'Glas', jar: 'Glas', vase: 'Vase', served: 'Glas' },
  init() {
    for (const g of this.items) {
      const a = g.R.mesh.geometry.attributes.position.array;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let i = g.v0 * 3; i < g.v1 * 3; i += 3) {
        x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); z0 = Math.min(z0, a[i + 2]); z1 = Math.max(z1, a[i + 2]);
      }
      g.lx = (x0 + x1) / 2; g.lz = (z0 + z1) / 2; g.y0 = y0; g.h = y1 - y0; g.r = Math.max(x1 - x0, z1 - z0) / 2;
      const w = rwp(g.R, g.lx, 0, g.lz); g.x = w.x; g.z = w.z;
      g.alive = true; g.back = 0; g.orig = null;
      if (!this.byRoom.has(g.R)) this.byRoom.set(g.R, []);
      this.byRoom.get(g.R).push(g);
    }
  },
  // the piece a triangle of room R belongs to (vertex index vi), or null; the lists are in build order
  at(R, vi) {
    const L = this.byRoom.get(R);
    if (!L) return null;
    let lo = 0, hi = L.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, g = L[m];
      if (vi < g.v0) hi = m - 1; else if (vi >= g.v1) lo = m + 1; else return g.alive ? g : null;
    }
    return null;
  },
  // ray against an upright cylinder (x, z, bottom y, height h, radius r) with a little slack; distance along the ray or -1
  hitCyl(o, d, x, y, z, h, r) {
    const ox = o.x - x, oz = o.z - z, dh = d.x * d.x + d.z * d.z;
    if (dh < 1e-6) return -1;
    const t = -(ox * d.x + oz * d.z) / dh;
    if (t <= 0) return -1;
    const px = ox + d.x * t, pz = oz + d.z * t, yy = o.y + d.y * t;
    if (px * px + pz * pz > r * r || yy < y - 0.015 || yy > y + h + 0.015) return -1;
    return t;
  },
  /* what a bullet from o along d hits first among the glass pieces: in front of the surface at distance wallT,
     or the piece whose triangle was hit (meshHit). Returns { t, glass } or null */
  trace(o, d, near, wallT, meshHit) {
    if (meshHit && meshHit.object) {
      for (const [R, L] of this.byRoom) if (R.mesh === meshHit.object) {
        const g = this.at(R, meshHit.faceIndex * 3);
        if (g) return { t: meshHit.distance, glass: g };
        break;
      }
    }
    let best = null;
    for (const [R, L] of this.byRoom) {
      if (!R.mesh.visible) continue;
      for (const g of L) {
        if (!g.alive) continue;
        const t = this.hitCyl(o, d, g.x, g.y0, g.z, g.h, g.r + 0.02);
        if (t > near && t < wallT + 0.04 && (!best || t < best.t)) best = { t, glass: g };
      }
    }
    // the drink Hank served, standing on the counter
    const S = GLASS.obj;
    if (S && !S.held && GLASS.mesh.visible) {
      const t = this.hitCyl(o, d, S.pos.x, S.pos.y, S.pos.z, 0.13, 0.06);
      if (t > near && t < wallT + 0.04 && (!best || t < best.t)) best = { t, glass: { served: true, kind: 'served', x: S.pos.x, y0: S.pos.y, z: S.pos.z, h: 0.12, r: 0.04, col: rgb(0xb8d0d0), R: S.room } };
    }
    return best;
  },
  // the closest piece near the view direction (touch aim assist); only in the room you are in
  near(cam, fwd, maxAng, maxDist, u) {
    let best = null;
    const R = G.room, L = R && this.byRoom.get(R);
    if (!L) return null;
    for (const g of L) {
      if (!g.alive) continue;
      u.set(g.x - cam.position.x, g.y0 + g.h * 0.5 - cam.position.y, g.z - cam.position.z);
      const dd = u.length(); if (dd > maxDist || dd < 0.5) continue;
      u.multiplyScalar(1 / dd);
      const ang = Math.acos(clamp(u.dot(fwd), -1, 1));
      if (ang < maxAng && (!best || ang < best.ang)) best = { g, ang, dist: dd, dir: u.clone() };
    }
    return best;
  },
  shatter(g, dir) {
    if (g.served) { GLASS.clear(); }
    else {
      g.alive = false; g.back = 45 + Math.random() * 30;
      const attr = g.R.mesh.geometry.attributes.position, a = attr.array;
      if (!g.orig) g.orig = a.slice(g.v0 * 3, g.v1 * 3);
      for (let i = g.v0 * 3; i < g.v1 * 3; i += 3) { a[i] = g.lx; a[i + 1] = g.y0; a[i + 2] = g.lz; }
      this.upload(attr, g);
      this.broken.push(g);
    }
    // shards: more and larger for bigger pieces; a splash of what was inside bottles and drinks
    const size = clamp(g.h * g.r * 40, 0.4, 2.2), n = Math.round(10 + 10 * size), y = g.y0 + g.h * 0.55;
    for (let k = 0; k < n; k++) {
      const an = Math.random() * TAU, v = 0.8 + Math.random() * 2.4;
      FX.debris.spawn({ x: g.x, y: g.y0 + Math.random() * g.h, z: g.z, vx: Math.cos(an) * v + dir.x * 2.2, vy: 0.8 + Math.random() * 2.4 + dir.y, vz: Math.sin(an) * v + dir.z * 2.2,
        life: 0.9 + Math.random() * 0.8, size: (0.012 + Math.random() * 0.024) * (0.7 + size * 0.3), grav: 9.8, drag: 0.4, bounce: true, sx: 1, sy: 0.35, sz: 1.4 }, mulc(g.col, 0.8 + Math.random() * 0.7));
    }
    if (g.kind === 'bottle' || g.kind === 'served') {
      const liq = g.kind === 'served' ? [0.75, 0.5, 0.18] : [0.55, 0.32, 0.12];
      for (let k = 0; k < 10; k++) {
        const an = Math.random() * TAU, v = 0.5 + Math.random() * 1.6;
        FX.debris.spawn({ x: g.x, y, z: g.z, vx: Math.cos(an) * v + dir.x * 1.5, vy: 0.5 + Math.random() * 1.8, vz: Math.sin(an) * v + dir.z * 1.5,
          life: 0.5 + Math.random() * 0.4, size: 0.01 + Math.random() * 0.012, grav: 9.8, drag: 0.6, bounce: false, sx: 1, sy: 1, sz: 1 }, liq);
      }
    }
    for (let k = 0; k < 3; k++) FX.smoke.spawn({ x: g.x, y, z: g.z, vx: (Math.random() - 0.5) * 0.6, vy: 0.3, vz: (Math.random() - 0.5) * 0.6, life: 0.5, size: 0.025, grow: 3, drag: 4, a0: 0.2 }, [0.85, 0.9, 0.88]);
    GSFX.glass(new THREE.Vector3(g.x, y, g.z), size > 0.9);
    worldEvent('glass', g.x, y, g.z, { by: 'player', kind: g.kind, room: g.R ? g.R.type : null });
  },
  upload(attr, g) {
    if (attr.addUpdateRange) { attr.addUpdateRange(g.v0 * 3, (g.v1 - g.v0) * 3); }
    attr.needsUpdate = true;
  },
  // put pieces back once their time is up and you are not in that building
  update(dt) {
    for (let i = this.broken.length - 1; i >= 0; i--) {
      const g = this.broken[i];
      if ((g.back -= dt) > 0) continue;
      const cur = G.room, R = g.R;
      if (cur && (cur === R || cur.parent === R || R.parent === cur || (cur.parent && cur.parent === R.parent))) continue;
      this.restore(g); this.broken.splice(i, 1);
    }
  },
  restore(g) {
    const attr = g.R.mesh.geometry.attributes.position;
    attr.array.set(g.orig, g.v0 * 3); this.upload(attr, g); g.alive = true;
  },
  restoreAll() { for (const g of this.broken) this.restore(g); this.broken.length = 0; },
  count() { let n = 0; for (const g of this.items) if (g.alive) n++; return n; }
};
