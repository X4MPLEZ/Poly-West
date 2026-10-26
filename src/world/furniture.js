/* ---------- small helpers for furniture: everything built in room space, y = 0 at ground ---------- */
const IC = {
  dark: rgb(0x4a3020), mid: rgb(0x7a5234), light: rgb(0xa77a4f), oak: rgb(0x8f6239), walnut: rgb(0x5c3a24), iron: rgb(0x2f2c2b),
  brass: rgb(0xc9a043), glass: rgb(0xb8d0d0), cream: rgb(0xe9dfc8), red: rgb(0x8e2a24), green: rgb(0x355a40), canvas: rgb(0xd8c8a2),
  glow: rgb(0xffe2a6), window: rgb(0xfff1d6), paper: rgb(0xeee4cc), felt: rgb(0x2f6a3e), black: rgb(0x1a1716)
};
function at(mb, x, y, z, ry, fn) { mb.push(new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry || 0))); fn(); mb.pop(); }
/* ---------- seats: every chair, bench and stool tells the world where and how one sits on it ----------
   x, z in the current building matrix; facing = the matrix' +z. kind decides the pose (see SIT_KINDS). */
const SEATS = [];
const SEATCTX = { R: null };
function seatHere(mb, x, z, kind, opt) {
  const v = new THREE.Vector3(x, 0, z).applyMatrix4(mb.m), d = new THREE.Vector3(0, 0, 1).transformDirection(mb.m);
  const R = SEATCTX.R;
  let wx = v.x, wz = v.z, dx = d.x, dz = d.z;
  if (R) { const p = rwp(R, v.x, v.y, v.z); wx = p.x; wz = p.z; const ex = dx * R.c + dz * R.s, ez = -dx * R.s + dz * R.c; dx = ex; dz = ez; }
  SEATS.push(Object.assign({ x: wx, y: v.y, z: wz, yaw: Math.atan2(dx, dz), kind, room: R }, opt || {}));
}
function rot90(ry, hx, hz) { return Math.abs(Math.sin(ry)) > 0.5 ? [hz, hx] : [hx, hz]; }
function chair(mb, col) {
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) mb.box(sx, 0, sz, 0.05, 0.45, 0.05, col, 3);
  mb.box(0, 0.45, 0, 0.44, 0.05, 0.44, col, 2);
  for (const sx of [-0.18, 0.18]) mb.box(sx, 0.5, -0.19, 0.05, 0.5, 0.05, col, 3);
  mb.box(0, 0.78, -0.19, 0.4, 0.07, 0.04, col, 3); mb.box(0, 0.95, -0.19, 0.4, 0.07, 0.04, col, 3);
  seatHere(mb, 0, 0.02, 'chair');
}
// a saloon bar stool: round seat, four legs and a ring to put the boots on
function stool(mb, col, opt) {
  for (const [sx, sz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) mb.beam([sx, 0, sz], [sx * 0.6, 0.73, sz * 0.6], 0.045, col, 3);
  for (const [a, b] of [[[-0.12, 0.28, -0.12], [0.12, 0.28, -0.12]], [[0.12, 0.28, -0.12], [0.12, 0.28, 0.12]], [[0.12, 0.28, 0.12], [-0.12, 0.28, 0.12]], [[-0.12, 0.28, 0.12], [-0.12, 0.28, -0.12]]]) mb.beam(a, b, 0.035, IC.brass, 0);
  mb.cyl(0, 0.72, 0, 0.2, 0.2, 0.06, 9, mulc(col, 1.15), 2, { top: rgb(0x7a2a24) });
  seatHere(mb, 0, 0, 'stool', opt);
}
function roundTable(mb, r, col) {
  mb.cyl(0, 0, 0, 0.25, 0.25, 0.04, 8, col, 3);
  mb.cyl(0, 0.04, 0, 0.06, 0.06, 0.7, 6, col, 3);
  mb.cyl(0, 0.74, 0, r, r, 0.05, 12, col, 2);
}
function squareTable(mb, w, d, h, col) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.07, h - 0.05, 0.07, col, 3);
  mb.box(0, h - 0.05, 0, w, 0.05, d, col, 2);
}
function lantern(mb, x, z, ceil, len) {
  const y = ceil - (len || 0.7);
  mb.box(x, y + 0.3, z, 0.02, ceil - y - 0.3, 0.02, IC.iron, 0);
  mb.box(x, y + 0.27, z, 0.2, 0.04, 0.2, IC.iron, 0);
  mb.box(x, y, z, 0.16, 0.27, 0.16, IC.glow, 30);
  mb.box(x, y - 0.03, z, 0.2, 0.04, 0.2, IC.iron, 0);
}
function crate(mb, x, y, z, s, col) { mb.box(x, y, z, s, s, s, col || IC.light, 3, { ao: 0.15 }); mb.box(x, y + s * 0.45, z, s + 0.01, s * 0.1, s + 0.01, mulc(col || IC.light, 0.8), 3); }
function sack(mb, x, y, z, col) {
  const c = col || IC.canvas;
  mb.box(x, y, z, 0.45, 0.5, 0.32, c, 9, { ao: 0.12 });
  mb.box(x, y + 0.5, z, 0.3, 0.1, 0.2, mulc(c, 0.92), 9);
  mb.box(x, y + 0.55, z, 0.12, 0.08, 0.12, mulc(c, 0.75), 9);
}
function keg(mb, x, y, z, r, h, col) {
  mb.cyl(x, y, z, r, r, h, 9, col || rgb(0x8a5a38), 3, { top: rgb(0x6b4630) });
  mb.cyl(x, y + h * 0.18, z, r + 0.02, r + 0.02, 0.05, 9, IC.iron, 0, { noTop: true });
  mb.cyl(x, y + h * 0.76, z, r + 0.02, r + 0.02, 0.05, 9, IC.iron, 0, { noTop: true });
}
const GOODS = [0x9a3a2a, 0x2f5a7a, 0xc9a043, 0x5a7a3a, 0xd8c8a2, 0x7a4a8a, 0xb86a2a, 0xe0d8c0, 0x3a6a6a];
function shelfUnit(mb, len, ht, dep, levels, rnd, fill, col) {
  const c = col || IC.walnut;
  mb.box(0, 0, -dep / 2 + 0.02, len, ht, 0.04, mulc(c, 0.85), 3);
  for (const s of [-1, 1]) mb.box(s * (len / 2 - 0.03), 0, 0, 0.06, ht, dep, c, 3);
  for (let i = 0; i < levels; i++) {
    const y = 0.12 + (i * (ht - 0.25)) / (levels - 1);
    mb.box(0, y, 0, len - 0.06, 0.04, dep, c, 2);
    if (i === levels - 1) continue;
    let x = -len / 2 + 0.1;
    while (x < len / 2 - 0.15) {
      const kind = fill === 'bottles' ? (rnd() < 0.8 ? 1 : 0) : fill === 'jars' ? 2 : Math.floor(rnd() * 3);
      const col2 = rgb(GOODS[Math.floor(rnd() * GOODS.length)]);
      if (kind === 0) { const sw = 0.14 + rnd() * 0.14, sh = 0.12 + rnd() * 0.18; mb.box(x + sw / 2, y + 0.04, 0, sw, sh, dep * 0.7, col2, 9); x += sw + 0.03; }
      else if (kind === 1) { const r = 0.035 + rnd() * 0.02, h = 0.2 + rnd() * 0.12; mb.cyl(x + r, y + 0.04, 0, r, r, h, 6, col2, 0); mb.cyl(x + r, y + 0.04 + h, 0, r * 0.45, r * 0.45, 0.07, 5, col2, 0); x += 2 * r + 0.035; }
      else { const r = 0.06 + rnd() * 0.03, h = 0.12 + rnd() * 0.1; mb.cyl(x + r, y + 0.04, 0, r, r, h, 7, col2, 0, { top: IC.cream }); x += 2 * r + 0.04; }
      if (rnd() < 0.12) x += 0.15;
    }
  }
}
function counter(mb, len, dep, h, col, top) {
  mb.box(0, 0, 0, len, h - 0.05, dep, col || IC.oak, 3, { ao: 0.18 });
  mb.box(0, h - 0.05, 0, len + 0.08, 0.06, dep + 0.08, top || IC.walnut, 2);
}
function picture(mb, w, h, col) { mb.box(0, 0, 0, w + 0.08, h + 0.08, 0.03, IC.brass, 0); mb.box(0, 0.04, 0.01, w, h, 0.03, col, 9); }
function poster(mb, w, h) { mb.box(0, 0, 0, w, h, 0.01, IC.paper, 9); mb.box(0, h * 0.62, 0.006, w * 0.6, h * 0.25, 0.01, mulc(IC.paper, 0.55), 0); mb.box(0, h * 0.12, 0.006, w * 0.7, h * 0.05, 0.01, mulc(IC.paper, 0.6), 0); }
function rug(mb, x, y, z, w, d, col, border) { mb.box(x, y, z, w, 0.012, d, border, 9); mb.box(x, y + 0.004, z, w - 0.25, 0.012, d - 0.25, col, 9); }
function stove(mb, x, y, z, ceil) {
  for (const s of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) mb.box(x + s[0], y, z + s[1], 0.05, 0.18, 0.05, IC.iron, 0);
  mb.cyl(x, y + 0.18, z, 0.26, 0.32, 0.45, 10, IC.iron, 0);
  mb.cyl(x, y + 0.63, z, 0.32, 0.22, 0.3, 10, IC.iron, 0);
  mb.box(x, y + 0.3, z + 0.3, 0.16, 0.14, 0.03, rgb(0xff8a3a), 30);
  mb.cyl(x, y + 0.93, z, 0.08, 0.08, ceil - y - 0.93, 7, IC.iron, 0);
}
function bench(mb, len, col, kind) {
  for (const s of [-1, 1]) mb.box(s * (len / 2 - 0.1), 0, 0, 0.06, 0.42, 0.34, col, 3);
  mb.box(0, 0.42, 0, len, 0.05, 0.36, col, 2); mb.box(0, 0.5, -0.17, len, 0.4, 0.04, col, 3);
  const n = Math.max(1, Math.round(len / 0.66));
  for (let k = 0; k < n; k++) seatHere(mb, -len / 2 + ((k + 0.5) * len) / n, 0.02, kind || 'bench');
}
function bars(mb, len, h, y0) { const n = Math.round(len / 0.14); for (let i = 0; i <= n; i++) mb.box(-len / 2 + (len * i) / n, y0, 0, 0.03, h, 0.03, IC.iron, 0); mb.box(0, y0 + h - 0.04, 0, len, 0.05, 0.05, IC.iron, 0); mb.box(0, y0, 0, len, 0.05, 0.05, IC.iron, 0); }

/* ---------- prefabs: furniture by name, so a room can be written as a list ----------
   place(mb, R, [[name, x, z, ry, opts], ...]) puts each piece on the room floor (opts.y lifts it) and adds its collider:
   opts.box = [x0, x1, z0, z1, h] (room coordinates), opts.circle = radius around (x, z).
   New rooms should be lists like this; one-off pieces (a piano, a vault) stay as code next to the list. */
const PREFAB = {
  chair: (mb, o) => chair(mb, o.col || IC.walnut),
  stool: (mb, o) => stool(mb, o.col || rgb(0x5a3422), o.bar ? { bar: o.bar } : undefined),
  bench: (mb, o) => bench(mb, o.len || 1.6, o.col || IC.walnut, o.kind),
  roundTable: (mb, o) => roundTable(mb, o.r || 0.55, o.col || IC.walnut),
  table: (mb, o) => squareTable(mb, o.w || 1.2, o.d || 0.8, o.h || 0.78, o.col || IC.oak),
  counter: (mb, o) => counter(mb, o.len, o.dep || 0.7, o.h || 1.05, o.col, o.top),
  shelf: (mb, o, R, rnd) => shelfUnit(mb, o.len, o.h || 2.4, o.dep || 0.45, o.levels || 5, rnd, o.fill || 'mixed', o.col),
  crate: (mb, o) => crate(mb, 0, 0, 0, o.s || 0.5, o.col),
  sack: (mb, o) => sack(mb, 0, 0, 0, o.col),
  keg: (mb, o) => keg(mb, 0, 0, 0, o.r || 0.35, o.h || 0.85, o.col),
  stove: (mb, o, R) => stove(mb, 0, 0, 0, R.ceilY - R.floorY - (o.y || 0)),
  bars: (mb, o) => bars(mb, o.len, o.h || 2.4, 0),
  picture: (mb, o) => picture(mb, o.w || 1.0, o.h || 0.7, o.col || rgb(0x8a7a6a)),
  poster: (mb, o) => poster(mb, o.w || 0.45, o.h || 0.6),
  rug: (mb, o) => rug(mb, 0, 0, 0, o.w, o.d, o.col, o.border),
  // hangs from the ceiling: its height comes from the room, not the floor
  lantern: (mb, o, R) => lantern(mb, 0, 0, R.ceilY, o.len || 0.8)
};
function place(mb, R, list, rnd) {
  for (const [name, x, z, ry, o0] of list) {
    const o = o0 || {}, fn = PREFAB[name];
    if (!fn) throw new Error('unknown prefab ' + name);
    at(mb, x, name === 'lantern' ? 0 : R.floorY + (o.y || 0), z, ry || 0, () => fn(mb, o, R, rnd));
    if (o.box) rColl(R, o.box[0], o.box[1], o.box[2], o.box[3], o.box[4]);
    if (o.circle) rCircle(R, x, z, o.circle);
  }
}
