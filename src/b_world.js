/* ---------- terrain: a stretched grid (4 m cells near town, growing towards the horizon) ---------- */
const TOWN = { cx: -8, cz: 2, rx: 72, rz: 36 };
const GRID_N = 46;
const GX = [];
for (let k = -GRID_N; k <= GRID_N; k++) {
  const a = Math.abs(k), s = Math.sign(k);
  GX.push(a <= 30 ? k * 4 : s * (120 + (a - 30) * 4 + (a - 30) * (a - 30) * 1.6));
}
const GN = GX.length; // vertices per axis

function townMask(x, z) {
  const dx = (x - TOWN.cx) / TOWN.rx, dz = (z - TOWN.cz) / TOWN.rz;
  return 1 - smoothstep(0.82, 1.18, Math.sqrt(dx * dx + dz * dz));
}
function roadZ(x) { return x <= 40 ? 2 : 2 + (x - 40) * (x - 40) * 0.006; }
function roadSlope(x) { return x <= 40 ? 0 : (x - 40) * 0.012; }
function creekX(z) { return 70 + Math.sin(z * 0.045) * 7 + Math.sin(z * 0.11 + 1.3) * 2.5; }
function baseHeight(x, z) {
  let h = (fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) - 0.5) * 18;
  h += (fbm(x * 0.045 + 11.3, z * 0.045 + 2.2, 2) - 0.5) * 2.4;
  const r = Math.hypot(x, z);
  h += smoothstep(150, 420, r) * 16 * (0.4 + 0.6 * fbm(x * 0.006, z * 0.006, 2));
  return h;
}
function heightNoCreek(x, z) {
  let h = baseHeight(x, z);
  const tm = townMask(x, z);
  h = lerp(h, 0, tm);
  if (x > 28) {
    const rz = roadZ(x);
    const rm = (1 - smoothstep(4, 12, Math.abs(z - rz))) * (1 - tm);
    if (rm > 0) h = lerp(h, lerp(baseHeight(x, rz), 0, townMask(x, rz)), rm * 0.92);
  }
  return h;
}
function heightAt(x, z) {
  const dc = Math.abs(x - creekX(z));
  return heightNoCreek(x, z) - 2.6 * (1 - smoothstep(2.0, 6.5, dc));
}

const HGT = [];
for (let i = 0; i < GN; i++) { HGT.push(new Float32Array(GN)); for (let j = 0; j < GN; j++) HGT[i][j] = heightAt(GX[i], GX[j]); }

function cellIndex(v) {
  if (v <= GX[0]) return 0;
  let lo = 0, hi = GN - 2;
  if (v >= GX[hi + 1]) return hi;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (GX[mid] <= v) lo = mid; else hi = mid - 1; }
  return lo;
}
// exact height of the rendered terrain triangles
function surfaceHeight(x, z) {
  const i = cellIndex(x), j = cellIndex(z);
  const x0 = GX[i], x1 = GX[i + 1], z0 = GX[j], z1 = GX[j + 1];
  const u = clamp((x - x0) / (x1 - x0), 0, 1), v = clamp((z - z0) / (z1 - z0), 0, 1);
  const h00 = HGT[i][j], h10 = HGT[i + 1][j], h01 = HGT[i][j + 1], h11 = HGT[i + 1][j + 1];
  if (((i + j) & 1) === 0) {
    if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
    return h00 + (h11 - h01) * u + (h01 - h00) * v;
  }
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

const GC = {
  sand: rgb(0xd6a56a), dirt: rgb(0xc27f4c), grass: rgb(0xa39a58), pale: rgb(0xe2cda0),
  red: rgb(0xa9643c), creek: rgb(0xdcc79b), trod: rgb(0xc9a172)
};
function groundColor(x, z, ny) {
  let c = GC.sand;
  c = mixc(c, GC.dirt, smoothstep(0.46, 0.7, fbm(x * 0.025 + 5, z * 0.025 - 3, 3)) * 0.8);
  const tm = townMask(x, z);
  c = mixc(c, GC.grass, smoothstep(0.57, 0.71, fbm(x * 0.07 - 9, z * 0.07 + 4, 2)) * 0.75 * (1 - tm * 0.7));
  c = mixc(c, GC.red, smoothstep(0.93, 0.72, ny) * 0.65);
  c = mixc(c, GC.creek, (1 - smoothstep(2, 5.5, Math.abs(x - creekX(z)))) * 0.85);
  c = mixc(c, GC.trod, tm * 0.4);
  c = mixc(c, GC.pale, smoothstep(0.62, 0.8, fbm(x * 0.012 - 20, z * 0.012 + 7, 2)) * 0.35);
  return mulc(c, 0.94 + hash2(Math.floor(x * 7.3), Math.floor(z * 5.1)) * 0.1);
}

function buildTerrain() {
  const mb = new MB();
  const P = (i, j) => [GX[i], HGT[i][j], GX[j]];
  for (let i = 0; i < GN - 1; i++) {
    for (let j = 0; j < GN - 1; j++) {
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      const tris = ((i + j) & 1) === 0 ? [[p00, p01, p11], [p00, p11, p10]] : [[p00, p01, p10], [p10, p01, p11]];
      for (const t of tris) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cz = (t[0][2] + t[1][2] + t[2][2]) / 3;
        // face normal y for colouring
        const ax = t[1][0] - t[0][0], ay = t[1][1] - t[0][1], az = t[1][2] - t[0][2];
        const bx = t[2][0] - t[0][0], by = t[2][1] - t[0][1], bz = t[2][2] - t[0][2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nyn = ny / Math.hypot(nx, ny, nz);
        mb.tri(t[0], t[1], t[2], groundColor(cx, cz, nyn), 1);
      }
    }
  }
  return mb.build();
}

/* ---------- collision & walkable platforms ---------- */
const COLL = [];      // {cx,cz,hx,hz,a,h} oriented boxes, or {cx,cz,r,h} circles
const PLATS = [];     // {cx,cz,hx,hz,a,y}
const CAMBLOCK = [];  // boxes that stop the camera {x0,x1,z0,z1,y1}
function addBoxColl(cx, cz, hx, hz, a, h) { COLL.push({ cx, cz, hx, hz, a: a || 0, h: h || 3 }); }
function addCircColl(cx, cz, r) { COLL.push({ cx, cz, r }); }
function addPlat(cx, cz, hx, hz, a, y) { PLATS.push({ cx, cz, hx, hz, a: a || 0, y }); }
// local rectangle (x0..x1, z0..z1 in the frame of a building at (bx,bz) rotated by ry) -> world OBB
function worldRect(bx, bz, ry, x0, x1, z0, z1) {
  const lx = (x0 + x1) / 2, lz = (z0 + z1) / 2;
  const c = Math.cos(ry), s = Math.sin(ry);
  // rotationY: x' = x cos + z sin ; z' = -x sin + z cos
  return { cx: bx + lx * c + lz * s, cz: bz - lx * s + lz * c, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, a: ry };
}

/* ---------- road strip (separate mesh so it can sit on top of the terrain) ---------- */
function buildRoad() {
  const mb = new MB();
  const lanes = [
    [-1.0, -0.82, rgb(0xb5845a)], [-0.82, -0.3, rgb(0x9f7149)], [-0.3, 0.3, rgb(0xbf9466)],
    [0.3, 0.82, rgb(0x9f7149)], [0.82, 1.0, rgb(0xb5845a)]
  ];
  const step = 2;
  for (let x = -50; x < 190; x += step) {
    const xa = x, xb = x + step;
    if (Math.abs(xa - creekX(roadZ(xa))) < 9 || Math.abs(xb - creekX(roadZ(xb))) < 9) continue;
    const half = (xx) => (xx < 42 ? 4.6 : lerp(4.6, 3.3, smoothstep(42, 62, xx)));
    const frame = (xx) => {
      const sl = roadSlope(xx), l = Math.hypot(1, sl);
      return { cx: xx, cz: roadZ(xx), px: -sl / l, pz: 1 / l };
    };
    const fa = frame(xa), fb = frame(xb);
    const ha = half(xa), hb = half(xb);
    for (const [o0, o1, col] of lanes) {
      const pt = (f, h, o) => {
        const px = f.cx + f.px * h * o, pz = f.cz + f.pz * h * o;
        const lift = townMask(px, pz) > 0.98 ? 0.03 : 0.07;
        return [px, surfaceHeight(px, pz) + lift, pz];
      };
      const a0 = pt(fa, ha, o0), a1 = pt(fa, ha, o1), b0 = pt(fb, hb, o0), b1 = pt(fb, hb, o1);
      const j = 0.95 + hash2(Math.floor(x * 3.1), Math.floor(o0 * 10)) * 0.08;
      // CCW from above: (a1 -> a0 -> b0 -> b1) has +y normal for +x travel with +z lateral
      mb.quad(a1, b1, b0, a0, mulc(col, j), 11);
    }
  }
  return mb.build();
}
