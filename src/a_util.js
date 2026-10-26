'use strict';
if (typeof THREE === 'undefined') { document.getElementById('bootMsg').textContent = 'Three.js konnte nicht geladen werden'; throw new Error('THREE missing'); }
/* ---------- small helpers ---------- */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z, oct) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < (oct || 4); i++) { s += amp * vnoise(x * f, z * f); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
function rgb(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function mulc(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
function v3(hex, k) { const c = rgb(hex); return new THREE.Vector3(c[0] * (k || 1), c[1] * (k || 1), c[2] * (k || 1)); }
function dirFromAzEl(azDeg, elDeg) {
  // azimuth: 0 = +z (south), 90 = +x (east), 180 = -z (north), 270 = -x (west)
  const a = azDeg * DEG, e = elDeg * DEG;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize();
}

/* ---------- mesh builder: flat-shaded, vertex-coloured, non-indexed ----------
   attributes: position, normal (face), color, uv (planar or face), tile (atlas tile id) */
class MB {
  constructor() {
    this.P = []; this.N = []; this.C = []; this.U = []; this.T = [];
    this.m = new THREE.Matrix4(); this.stack = [];
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
    this._e1 = new THREE.Vector3(); this._e2 = new THREE.Vector3(); this._n = new THREE.Vector3();
  }
  push(mat) { this.stack.push(this.m.clone()); this.m.multiply(mat); return this; }
  pop() { this.m = this.stack.pop(); return this; }
  at(x, y, z, ry) { // push translate + rotateY
    const t = new THREE.Matrix4().makeTranslation(x, y, z);
    if (ry) t.multiply(new THREE.Matrix4().makeRotationY(ry));
    return this.push(t);
  }
  get count() { return this.P.length / 3; }
  // one triangle; a,b,c local [x,y,z]; col = [r,g,b] or array of three; uv = null (planar) or [[u,v]x3]
  tri(a, b, c, col, tile, uv) {
    const A = this._a.set(a[0], a[1], a[2]).applyMatrix4(this.m);
    const B = this._b.set(b[0], b[1], b[2]).applyMatrix4(this.m);
    const Cc = this._c.set(c[0], c[1], c[2]).applyMatrix4(this.m);
    const n = this._n.crossVectors(this._e1.subVectors(B, A), this._e2.subVectors(Cc, A));
    const len = n.length();
    if (len < 1e-10) return;
    n.multiplyScalar(1 / len);
    const pts = [A, B, Cc];
    const multi = Array.isArray(col[0]);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      this.P.push(p.x, p.y, p.z);
      this.N.push(n.x, n.y, n.z);
      const cc = multi ? col[i] : col;
      this.C.push(cc[0], cc[1], cc[2]);
      if (uv) this.U.push(uv[i][0], uv[i][1]);
      else if (ay >= ax && ay >= az) this.U.push(p.x * 0.5, p.z * 0.5);
      else if (ax >= az) this.U.push(p.z * 0.5, p.y * 0.5);
      else this.U.push(p.x * 0.5, p.y * 0.5);
      this.T.push(tile || 0);
    }
  }
  // quad in CCW order (bl, br, tr, tl as seen from the front)
  quad(a, b, c, d, col, tile, faceUV) {
    const multi = Array.isArray(col[0]);
    const ca = multi ? col[0] : col, cb = multi ? col[1] : col, cc = multi ? col[2] : col, cd = multi ? col[3] : col;
    if (faceUV) {
      this.tri(a, b, c, [ca, cb, cc], tile, [[0, 0], [1, 0], [1, 1]]);
      this.tri(a, c, d, [ca, cc, cd], tile, [[0, 0], [1, 1], [0, 1]]);
    } else {
      this.tri(a, b, c, [ca, cb, cc], tile);
      this.tri(a, c, d, [ca, cc, cd], tile);
    }
  }
  /* axis-aligned box; (x,z) centre, y = bottom. opt: top (colour), tileTop, ao (0..1 darkening at the base),
     bottom (bool, default false), faces: {px,nx,pz,nz} booleans to skip, faceUV: 'pz' face gets 0..1 UV */
  box(x, y, z, sx, sy, sz, col, tile, opt) {
    opt = opt || {};
    const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y, y1 = y + sy, z0 = z - sz / 2, z1 = z + sz / 2;
    const ao = opt.ao || 0;
    const lo = ao ? mulc(col, 1 - ao) : col;
    const side = [lo, lo, col, col];
    const top = opt.top || col;
    const tt = opt.tileTop !== undefined ? opt.tileTop : tile;
    const skip = opt.skip || {};
    const fu = opt.faceUV || '', has = (f) => fu.indexOf(f) >= 0, ft = (k) => (opt[k] !== undefined ? opt[k] : tile);
    if (!skip.pz) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side, ft('tilePz'), has('pz'));
    if (!skip.nz) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, ft('tileNz'), has('nz'));
    if (!skip.px) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, ft('tilePx'), has('px'));
    if (!skip.nx) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, ft('tileNx'), has('nx'));
    if (!skip.py) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, tt);
    if (opt.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], lo, tile);
    return this;
  }
  // box spanning two points (a beam), square cross-section w
  beam(p0, p1, w, col, tile) {
    const a = new THREE.Vector3(p0[0], p0[1], p0[2]), b = new THREE.Vector3(p1[0], p1[1], p1[2]);
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    this.push(m); this.box(0, -len / 2, 0, w, len, w, col, tile, { bottom: true }); this.pop();
    return this;
  }
  // cylinder / cone frustum along +y. rb bottom radius, rt top radius
  cyl(x, y, z, rb, rt, h, seg, col, tile, opt) {
    opt = opt || {};
    const top = opt.top || col;
    const off = opt.rot || 0;
    for (let i = 0; i < seg; i++) {
      const a0 = off + (i / seg) * TAU, a1 = off + ((i + 1) / seg) * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const b0 = [x + s0 * rb, y, z + c0 * rb], b1 = [x + s1 * rb, y, z + c1 * rb];
      const t0 = [x + s0 * rt, y + h, z + c0 * rt], t1 = [x + s1 * rt, y + h, z + c1 * rt];
      const cs = opt.ao ? [mulc(col, 1 - opt.ao), mulc(col, 1 - opt.ao), col, col] : col;
      if (rt > 1e-4) this.quad(b0, b1, t1, t0, cs, tile);
      else this.tri(b0, b1, [x, y + h, z], opt.ao ? [cs[0], cs[1], col] : col, tile);
      if (rt > 1e-4 && !opt.noTop) this.tri([x, y + h, z], t0, t1, top, opt.tileTop !== undefined ? opt.tileTop : tile);
      if (opt.bottom) this.tri([x, y, z], b1, b0, col, tile);
    }
    return this;
  }
  // gable roof prism: ridge along local z, base rectangle sx * sz at height y, ridge height rh
  gable(x, y, z, sx, sz, rh, col, tile, endCol) {
    const x0 = x - sx / 2, x1 = x + sx / 2, z0 = z - sz / 2, z1 = z + sz / 2, yt = y + rh;
    this.quad([x1, y, z1], [x1, y, z0], [x, yt, z0], [x, yt, z1], col, tile);      // east slope
    this.quad([x0, y, z0], [x0, y, z1], [x, yt, z1], [x, yt, z0], col, tile);      // west slope
    const ec = endCol || col;
    this.tri([x0, y, z1], [x1, y, z1], [x, yt, z1], ec, tile);                      // front gable
    this.tri([x1, y, z0], [x0, y, z0], [x, yt, z0], ec, tile);                      // back gable
    return this;
  }
  // convex ring extrusion between two polygons (same vertex count), points [[x,z],...] CCW seen from above
  ring(ptsA, yA, ptsB, yB, col, tile) {
    const n = ptsA.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // points generated as (sin a, cos a) with rising a run CCW seen from above -> (i, j) is left-to-right from outside
      this.quad([ptsA[i][0], yA, ptsA[i][1]], [ptsA[j][0], yA, ptsA[j][1]], [ptsB[j][0], yB, ptsB[j][1]], [ptsB[i][0], yB, ptsB[i][1]], col, tile);
    }
    return this;
  }
  cap(pts, y, col, tile) {
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[1]; }
    cx /= pts.length; cz /= pts.length;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.tri([cx, y, cz], [pts[i][0], y, pts[i][1]], [pts[j][0], y, pts[j][1]], col, tile);
    }
    return this;
  }
  // add an existing THREE geometry (triangles) with a colour function
  geo(g, col, tile, jitter, rnd) {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.attributes.position.array;
    const key = (x, y, z) => Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000);
    const jit = new Map();
    const get = (i) => {
      let x = p[i], y = p[i + 1], z = p[i + 2];
      if (jitter) {
        const k = key(x, y, z);
        if (!jit.has(k)) jit.set(k, [(rnd() - 0.5) * jitter, (rnd() - 0.5) * jitter, (rnd() - 0.5) * jitter]);
        const d = jit.get(k); x += d[0]; y += d[1]; z += d[2];
      }
      return [x, y, z];
    };
    for (let i = 0; i < p.length; i += 9) {
      const a = get(i), b = get(i + 3), c = get(i + 6);
      const cc = typeof col === 'function' ? col(a, b, c) : col;
      this.tri(a, b, c, cc, tile);
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('tile', new THREE.Float32BufferAttribute(this.T, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
