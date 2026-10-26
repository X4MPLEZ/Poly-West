/* ---------- enterable buildings ----------
   Every building is a shell of walls with a door opening. Each interior is its own mesh, drawn only when you are
   near or inside, with an indoor shader that is lit from the door and windows. Entering raises the exposure slowly
   (eyes adjusting to the dark), leaving lowers it quickly (squinting into the sun). */
const ROOMS = [];
const DOORS = [];
const DOOR_W = 1.5, DOOR_H = 2.75;

function roomFrame(type, bx, bz, ry) {
  const R = { type, bx, bz, ry, c: Math.cos(ry), s: Math.sin(ry), rects: [], wins: [], idx: ROOMS.length };
  ROOMS.push(R);
  return R;
}
function rwp(R, x, y, z) { return new THREE.Vector3(R.bx + x * R.c + z * R.s, y, R.bz - x * R.s + z * R.c); }
function rLocal(R, X, Z) { const dx = X - R.bx, dz = Z - R.bz; return [dx * R.c - dz * R.s, dx * R.s + dz * R.c]; }
function rColl(R, x0, x1, z0, z1, h) {
  if (x1 - x0 < 0.02 || z1 - z0 < 0.02) return;
  const r = worldRect(R.bx, R.bz, R.ry, x0, x1, z0, z1);
  COLL.push(Object.assign(r, { h: h || 3 }));
}
function rCircle(R, x, z, r) { const p = rwp(R, x, 0, z); addCircColl(p.x, p.z, r); }
function rPlat(R, x0, x1, z0, z1, y) {
  const r = worldRect(R.bx, R.bz, R.ry, x0, x1, z0, z1);
  addPlat(r.cx, r.cz, r.hx, r.hz, r.a, y);
}

/* front wall with a door opening (local frame of the building, front along +z) */
function frontWallWithDoor(mb, w, H, z0, z1, col, tile, holeW, holeH) {
  const hw = (holeW || DOOR_W) / 2, hh = holeH || DOOR_H, d = z1 - z0, zc = (z0 + z1) / 2;
  mb.box((-w / 2 - hw) / 2, 0, zc, w / 2 - hw, H, d, col, tile, { ao: 0.22 });
  mb.box((w / 2 + hw) / 2, 0, zc, w / 2 - hw, H, d, col, tile, { ao: 0.22 });
  if (H > hh) mb.box(0, hh, zc, hw * 2, H - hh, d, col, tile);
}
function doorFrame(mb, z, y0, col, holeW, holeH) {
  const hw = (holeW || DOOR_W) / 2, hh = holeH || DOOR_H;
  for (const s of [-1, 1]) mb.box(s * (hw + 0.08), y0, z, 0.16, hh - y0 + 0.1, 0.16, col, 0);
  mb.box(0, hh, z, hw * 2 + 0.32, 0.16, 0.16, col, 0);
}

/* storefront shell: back + sides + front with opening, threshold, floor, colliders, room rect */
function shellStorefront(mb, b, R, wall, tile) {
  const w = b.w, d = b.d, h = b.h, t = 0.2;
  const fz0 = b.front ? 0 : -0.2, fz1 = b.front ? 0.24 : 0;
  mb.box(0, 0, -d + t / 2, w, h, t, wall, tile, { ao: 0.22 });
  mb.box(-w / 2 + t / 2, 0, -d / 2, t, h, d, wall, tile, { ao: 0.22 });
  mb.box(w / 2 - t / 2, 0, -d / 2, t, h, d, wall, tile, { ao: 0.22 });
  frontWallWithDoor(mb, w, b.front || h, fz0, fz1, wall, tile);
  // plank floor at porch height, running through the doorway
  mb.box(0, 0, (fz0 + fz1) / 2 - 0.05, DOOR_W, 0.35, fz1 - fz0 + 0.1, rgb(0x8a6446), 2, { top: rgb(0x9a7050), tileTop: 2 });
  rColl(R, -w / 2, w / 2, -d, -d + t, h);
  rColl(R, -w / 2, -w / 2 + t, -d, fz1, h);
  rColl(R, w / 2 - t, w / 2, -d, fz1, h);
  rColl(R, -w / 2, -DOOR_W / 2, fz0, fz1, h);
  rColl(R, DOOR_W / 2, w / 2, fz0, fz1, h);
  rPlat(R, -w / 2 + t, w / 2 - t, -d + t, fz1, 0.35);
  Object.assign(R, { x0: -w / 2 + t, x1: w / 2 - t, z0: -d + t, z1: fz0, floorY: 0.35, ceilY: b.two ? 3.75 : (b.flat ? h - 0.25 : h - 0.06), doorZ: (fz0 + fz1) / 2, w, d });
  R.rects.push([R.x0, R.x1, R.z0, R.z1]);
  // windows as the street side shows them: front pair(s), two on the right wall, one on the left
  for (const wd of frontWins(b)) R.wins.push(Object.assign({ wall: 'f' }, wd));
  R.wins.push({ wall: 'r', u: -d / 4, y: 1.3, w: 1.0, h: 1.3 }, { wall: 'r', u: -3 * d / 4, y: 1.3, w: 1.0, h: 1.3 }, { wall: 'l', u: -d / 2, y: 1.3, w: 1.0, h: 1.3 });
}

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

/* ---------- lining: interior walls, ceiling, window panes ---------- */
function lining(mb, R, upper, lower, tileU, ceilCol) {
  const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
  const T = 0.04, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wain = F + 1.0;
  mb.box(cx, 0, cz, W, F, D, R.floorCol || rgb(0x8a6446), 2, { top: R.floorTop || rgb(0x9a7050), tileTop: R.floorTile === undefined ? 2 : R.floorTile });
  const walls = [ // [x, z, sx, sz]
    [cx, z0 + T / 2, W, T], [x0 + T / 2, cz, T, D], [x1 - T / 2, cz, T, D]
  ];
  for (const [x, z, sx, sz] of walls) {
    mb.box(x, wain, z, sx, C - wain, sz, upper, tileU);
    mb.box(x, F, z, sx + (sx > sz ? 0 : 0.03), 1.0, sz + (sz > sx ? 0 : 0.03), lower, 3);
    mb.box(x, wain, z, sx + (sx > sz ? 0 : 0.05), 0.06, sz + (sz > sx ? 0 : 0.05), mulc(lower, 0.8), 0);
  }
  // front wall from inside, with the door opening
  const hw = (R.holeW || DOOR_W) / 2, hh = R.holeH || DOOR_H, zf = z1 - T / 2;
  for (const s of [-1, 1]) {
    const a = s < 0 ? x0 : hw, b = s < 0 ? -hw : x1;
    mb.box((a + b) / 2, wain, zf, b - a, C - wain, T, upper, tileU);
    mb.box((a + b) / 2, F, zf, b - a, 1.0, T + 0.03, lower, 3);
    mb.box((a + b) / 2, wain, zf, b - a, 0.06, T + 0.05, mulc(lower, 0.8), 0);
  }
  if (C > hh) mb.box(0, hh, zf, hw * 2, C - hh, T, upper, tileU);
  for (const s of [-1, 1]) mb.box(s * (hw + 0.06), F, zf - 0.04, 0.12, hh - F + 0.06, 0.06, mulc(lower, 0.75), 0);
  mb.box(0, hh, zf - 0.04, hw * 2 + 0.24, 0.12, 0.06, mulc(lower, 0.75), 0);
  // ceiling with beams, leaving a hole where stairs go up
  const cc = ceilCol || rgb(0x6a4a34), h = R.ceilHole;
  const slab = (a, b, c, d) => { if (b - a > 0.01 && d - c > 0.01) mb.box((a + b) / 2, C, (c + d) / 2, b - a, 0.08, d - c, cc, 2, { bottom: true }); };
  if (h) {
    slab(x0, x1, z0, h[2]); slab(x0, x1, h[3], z1); slab(x0, h[0], h[2], h[3]); slab(h[1], x1, h[2], h[3]);
    // trim round the opening
    mb.box((h[0] + h[1]) / 2, C - 0.12, h[2], h[1] - h[0], 0.2, 0.1, mulc(cc, 0.7), 3, { bottom: true });
    mb.box((h[0] + h[1]) / 2, C - 0.12, h[3], h[1] - h[0], 0.2, 0.1, mulc(cc, 0.7), 3, { bottom: true });
  } else slab(x0, x1, z0, z1);
  for (let x = x0 + 1.2; x < x1 - 0.4; x += 1.6) {
    const beam = (a, b) => { if (b - a > 0.05) mb.box(x, C - 0.16, (a + b) / 2, 0.16, 0.16, b - a, mulc(cc, 0.75), 3, { bottom: true }); };
    if (h && x + 0.1 > h[0] && x - 0.1 < h[1]) { beam(z0, h[2]); beam(h[3], z1); } else beam(z0, z1);
  }
  // window panes seen from inside: bright daylight with a dark frame
  for (const wdef of R.wins) {
    const pane = (px, pz, alongX) => {
      const sx = alongX ? wdef.w : 0.03, sz = alongX ? 0.03 : wdef.w;
      mb.box(px, wdef.y, pz, sx, wdef.h, sz, IC.window, 30);
      const fx = alongX ? wdef.w + 0.16 : 0.05, fz = alongX ? 0.05 : wdef.w + 0.16;
      mb.box(px, wdef.y - 0.08, pz, fx, 0.08, fz, mulc(lower, 0.8), 0);
      mb.box(px, wdef.y + wdef.h, pz, fx, 0.08, fz, mulc(lower, 0.8), 0);
      mb.box(px, wdef.y + wdef.h * 0.5, pz, alongX ? wdef.w : 0.05, 0.05, alongX ? 0.05 : wdef.w, IC.walnut, 0);
      mb.box(px, wdef.y, pz, alongX ? 0.05 : 0.05, wdef.h, alongX ? 0.05 : 0.05, IC.walnut, 0);
    };
    if (wdef.wall === 'f') pane(wdef.u, z1 - T - 0.02, true);
    else if (wdef.wall === 'r') pane(x1 - T - 0.02, wdef.u, false);
    else pane(x0 + T + 0.02, wdef.u, false);
  }
}
function lightOpenings(R) {
  if (R.lights) {
    const l = R.lights.map((a) => rwp(R, a[0], a[1], a[2]).toArray().concat([a[3]]));
    while (l.length < 4) l.push([0, -100, 0, 0]);
    return l.slice(0, 4).map((a) => new THREE.Vector4(a[0], a[1], a[2], a[3]));
  }
  const list = [];
  const { x0, x1, z1, floorY: F } = R;
  list.push(rwp(R, 0, F + 1.5, z1 + 0.6).toArray().concat([R.doorLight || 1.9]));
  for (const wdef of R.wins) {
    if (list.length >= 4) break;
    const p = wdef.wall === 'f' ? rwp(R, wdef.u, wdef.y + wdef.h / 2, z1 + 0.5) : wdef.wall === 'r' ? rwp(R, x1 + 0.5, wdef.y + wdef.h / 2, wdef.u) : rwp(R, x0 - 0.5, wdef.y + wdef.h / 2, wdef.u);
    list.push(p.toArray().concat([1.0]));
  }
  while (list.length < 4) list.push([0, -100, 0, 0]);
  return list.map((a) => new THREE.Vector4(a[0], a[1], a[2], a[3]));
}

/* walkable stairs: every step is a platform, and its collider only stops you when you are well below its top */
function walkStairs(mb, R, n, F, C, pos, sx, sz, col, top, tileTop) {
  const rise = (C - F) / n;
  for (let i = 0; i < n; i++) {
    const [cx, cz] = pos(i), y = F + (i + 1) * rise;
    mb.box(cx, F, cz, sx, y - F, sz, col, 2, { top, tileTop });
    rPlat(R, cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2, y);
    rColl(R, cx - sx / 2 + 0.02, cx + sx / 2 - 0.02, cz - sz / 2 + 0.02, cz + sz / 2 - 0.02, 4);
    COLL[COLL.length - 1].top = y - 0.6;
  }
}

/* the upper floor of a two-storey house: o.walk = floor rects, o.walls = [xa,za,xb,zb, collide, doorPositions],
   o.rails round the stairwell, o.wins = panes {x,z,alongX,w,y,h} */
function upperFloor(mb, U, o) {
  const F = U.floorY, C = U.ceilY, T = 0.08;
  for (const r of o.walk) {
    const cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2, w = r[1] - r[0], d = r[3] - r[2];
    mb.box(cx, F - 0.04, cz, w, 0.04, d, rgb(0x6a4630), 2, { top: o.floorTop || rgb(0x8f6644), tileTop: 2, bottom: true });
    rPlat(U, r[0], r[1], r[2], r[3], F);
    mb.box(cx, C, cz, w, 0.08, d, o.ceil || rgb(0x5a3e2c), 2, { bottom: true });
  }
  for (const w of o.walls) {
    const alongX = Math.abs(w[1] - w[3]) < 1e-3;
    const len = alongX ? Math.abs(w[2] - w[0]) : Math.abs(w[3] - w[1]);
    const mx = (w[0] + w[2]) / 2, mz = (w[1] + w[3]) / 2, sx = alongX ? len : T, sz = alongX ? T : len;
    mb.box(mx, F + 0.95, mz, sx, C - F - 0.95, sz, o.paper, 9);
    mb.box(mx, F - 0.18, mz, sx, 1.13, sz, o.wain, 3);
    mb.box(mx, F + 0.95, mz, sx + (alongX ? 0 : 0.05), 0.06, sz + (alongX ? 0.05 : 0), mulc(o.wain, 0.8), 0);
    if (w[4]) rColl(U, mx - sx / 2, mx + sx / 2, mz - sz / 2, mz + sz / 2, 4);
    (w[5] || []).forEach((d, k) => {
      const dx = alongX ? d : mx, dz = alongX ? mz : d, a = (q, b) => (alongX ? q : b);
      mb.box(dx, F, dz, a(1.15, T + 0.04), 2.28, a(T + 0.04, 1.15), mulc(o.wain, 1.15), 0);
      mb.box(dx, F, dz, a(0.95, T + 0.08), 2.15, a(T + 0.08, 0.95), o.door || IC.walnut, 3);
      for (const py of [0.3, 1.2]) mb.box(dx, F + py, dz, a(0.7, T + 0.1), 0.75, a(T + 0.1, 0.7), mulc(o.door || IC.walnut, 1.18), 3);
      mb.box(dx + a(0.33, 0), F + 1.0, dz + a(0, 0.33), a(0.07, T + 0.18), 0.07, a(T + 0.18, 0.07), IC.brass, 0);
      mb.box(dx, F + 2.0, dz, a(0.16, T + 0.12), 0.1, a(T + 0.12, 0.16), IC.brass, 0);
    });
  }
  for (const r of o.rails) {
    const len = Math.hypot(r[2] - r[0], r[3] - r[1]), n = Math.max(1, Math.round(len / 0.45));
    for (let i = 0; i <= n; i++) mb.box(r[0] + ((r[2] - r[0]) * i) / n, F, r[1] + ((r[3] - r[1]) * i) / n, i % n ? 0.05 : 0.1, 0.92, i % n ? 0.05 : 0.1, IC.walnut, 3);
    mb.beam([r[0], F + 0.92, r[1]], [r[2], F + 0.92, r[3]], 0.08, IC.walnut, 3);
    rColl(U, Math.min(r[0], r[2]) - 0.05, Math.max(r[0], r[2]) + 0.05, Math.min(r[1], r[3]) - 0.05, Math.max(r[1], r[3]) + 0.05, 1.2);
  }
  for (const wd of o.wins) {
    const sx = wd.alongX ? wd.w : 0.03, sz = wd.alongX ? 0.03 : wd.w;
    mb.box(wd.x, wd.y, wd.z, sx, wd.h, sz, IC.window, 30);
    const fx = wd.alongX ? wd.w + 0.16 : 0.06, fz = wd.alongX ? 0.06 : wd.w + 0.16;
    mb.box(wd.x, wd.y - 0.08, wd.z, fx, 0.08, fz, mulc(o.wain, 0.8), 0);
    mb.box(wd.x, wd.y + wd.h, wd.z, fx, 0.08, fz, mulc(o.wain, 0.8), 0);
    mb.box(wd.x, wd.y + wd.h * 0.5, wd.z, wd.alongX ? wd.w : 0.06, 0.05, wd.alongX ? 0.06 : wd.w, IC.walnut, 0);
    mb.box(wd.x, wd.y, wd.z, 0.06, wd.h, 0.06, IC.walnut, 0);
  }
}
function setupUpper(R, hole, walk) {
  const U = R.upper, C = R.ceilY, yU = C + 0.1;
  R.ceilHole = hole;
  R.lvMax = C - 0.6;
  R.rects.push([hole[0], hole[1], hole[2], hole[3], yU + 2.75]); // the camera may rise into the stairwell
  Object.assign(U, { floorY: yU, ceilY: yU + 2.85, lvMin: C - 0.6, x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1, expo: 2.6, amb: 0xffd6a0 });
  U.rects.push(...walk, hole.slice(0, 4));
  return U;
}

/* ---------- interiors by trade ---------- */
const FURNISH = {
  store(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0xb38a5e), IC.mid, 3);
    at(mb, 0.6, F, z0 + 0.32, 0, () => shelfUnit(mb, x1 - x0 - 0.4, 2.6, 0.5, 5, rnd, 'mixed'));
    at(mb, x0 + 0.3, F, -5.4, Math.PI / 2, () => shelfUnit(mb, 5.4, 2.4, 0.45, 5, rnd, 'mixed'));
    rColl(R, x0, x1, z0, z0 + 0.6, 3); rColl(R, x0, x0 + 0.55, -8.1, -2.7, 3);
    at(mb, 1.6, F, -6.6, 0, () => counter(mb, 4.6, 0.75, 1.0));
    rColl(R, -0.7, 3.9, -7.0, -6.2, 1.1);
    at(mb, 2.9, F + 1.0, -6.6, 0, () => { mb.box(0, 0, 0, 0.45, 0.32, 0.36, IC.brass, 0); mb.box(0, 0.32, -0.05, 0.42, 0.18, 0.12, mulc(IC.brass, 0.85), 0); });
    at(mb, 0.4, F + 1.0, -6.6, 0, () => { mb.box(0, 0, 0, 0.5, 0.04, 0.3, IC.iron, 0); mb.box(0.1, 0.04, 0, 0.04, 0.3, 0.04, IC.iron, 0); mb.box(0.1, 0.32, 0, 0.6, 0.03, 0.03, IC.brass, 0); });
    for (let i = 0; i < 4; i++) sack(mb, x1 - 0.5 - (i % 2) * 0.5, F + Math.floor(i / 2) * 0.5, -2.3 - (i % 2) * 0.1, i % 3 ? IC.canvas : rgb(0xc8b48c));
    rColl(R, x1 - 1.1, x1, -2.7, -1.9, 1.2);
    keg(mb, x1 - 0.55, F, -3.6, 0.35, 0.85); rCircle(R, x1 - 0.55, -3.6, 0.4);
    crate(mb, x0 + 0.6, F, -1.4, 0.6); crate(mb, x0 + 0.6, F + 0.6, -1.4, 0.45, IC.mid); crate(mb, x0 + 1.25, F, -1.3, 0.5);
    rColl(R, x0, x0 + 1.55, -1.75, -0.95, 1.1);
    // cracker barrel with a checkers game and two chairs
    keg(mb, -1.6, F, -4.0, 0.33, 0.8, rgb(0x9a6a40));
    mb.box(-1.6, F + 0.81, -4.0, 0.42, 0.02, 0.42, IC.cream, 0);
    for (let i = 0; i < 8; i++) mb.box(-1.6 + ((i % 4) - 1.5) * 0.08, F + 0.83, -4.0 + (Math.floor(i / 4) - 0.5) * 0.12, 0.05, 0.02, 0.05, i < 4 ? IC.red : IC.black, 0);
    at(mb, -1.6, F, -3.2, Math.PI, () => chair(mb, IC.walnut)); at(mb, -1.6, F, -4.8, 0, () => chair(mb, IC.walnut));
    rCircle(R, -1.6, -4.0, 0.42);
    stove(mb, -3.2, F, -6.2, C); rCircle(R, -3.2, -6.2, 0.38);
    at(mb, x1 - 0.03, F + 1.4, -6.0, -Math.PI / 2, () => { for (let i = 0; i < 3; i++) mb.cyl(-0.6 + i * 0.6, 0, 0.1, 0.22, 0.22, 0.12, 10, rgb(0xb59a62), 0); });
    lantern(mb, -1.6, -3.0, C, 0.9); lantern(mb, 1.8, -7.6, C, 0.9);
  },
  saloon(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    setupUpper(R, [-5.06, -0.42, z0, z0 + 1.2], [[x0, x1, z0 + 1.2, z0 + 2.8], [x0, -5.06, z0, z0 + 1.2], [-0.42, x1, z0, z0 + 1.2]]);
    lining(mb, R, rgb(0x7a2c26), rgb(0x5a3422), 9, rgb(0x4a3022));
    // bar along the right wall with a back bar and mirror
    at(mb, 3.6, F, -6.5, Math.PI / 2, () => {
      counter(mb, 7.4, 0.85, 1.12, rgb(0x6a3e24), rgb(0x3e2416));
      mb.box(0, 0.12, -0.5, 7.4, 0.05, 0.05, IC.brass, 0);
      for (let i = 0; i < 6; i++) mb.box(-3.3 + i * 1.32, 0, -0.5, 0.04, 0.14, 0.04, IC.brass, 0);
      mb.box(0, 1.07, -0.5, 7.48, 0.06, 0.16, rgb(0x3e2416), 2);
    });
    rColl(R, 3.15, 4.05, -10.2, -2.8, 1.2);
    for (let i = 0; i < 7; i++) at(mb, 2.66, F, -3.45 - i * 0.92, Math.PI / 2, () => stool(mb, rgb(0x5a3422), { bar: { z: 0.44, y: 1.13 } }));
    for (let i = 0; i < 3; i++) mb.cyl(2.95, F, -3.91 - i * 1.84 * 1.5, 0.13, 0.1, 0.22, 8, IC.brass, 0);
    at(mb, x1 - 0.3, F, -6.5, -Math.PI / 2, () => {
      mb.box(0, 0, 0, 6.6, 1.0, 0.5, rgb(0x5a3422), 3);
      mb.box(0, 1.5, -0.18, 4.2, 1.2, 0.04, rgb(0x9fb2b6), 30);
      mb.box(0, 1.45, -0.16, 4.4, 1.3, 0.03, IC.brass, 0);
      at(mb, -2.6, 1.05, 0, 0, () => shelfUnit(mb, 1.3, 1.6, 0.35, 4, rnd, 'bottles', rgb(0x5a3422)));
      at(mb, 2.6, 1.05, 0, 0, () => shelfUnit(mb, 1.3, 1.6, 0.35, 4, rnd, 'bottles', rgb(0x5a3422)));
    });
    rColl(R, x1 - 0.6, x1, -9.9, -3.1, 2);
    for (let i = 0; i < 9; i++) mb.cyl(3.4 + (rnd() - 0.5) * 0.4, F + 1.12, -3.3 - i * 0.8, 0.035, 0.035, 0.24, 6, rgb(GOODS[i % GOODS.length]), 0);
    // tables
    const tables = [[-3.6, -2.6], [-1.0, -4.6], [-3.9, -6.9], [0.6, -8.4]];
    tables.forEach(([tx, tz], i) => {
      at(mb, tx, F, tz, 0, () => roundTable(mb, 0.55, IC.walnut));
      const n = i === 2 ? 4 : 3;
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + i; at(mb, tx + Math.sin(a) * 1.0, F, tz + Math.cos(a) * 1.0, a + Math.PI, () => chair(mb, IC.mid)); }
      rCircle(R, tx, tz, 0.62);
      if (i === 2) { // poker game left behind
        mb.box(tx, F + 0.79, tz, 0.9, 0.01, 0.9, IC.felt, 9);
        for (let c = 0; c < 6; c++) mb.box(tx + (rnd() - 0.5) * 0.6, F + 0.8, tz + (rnd() - 0.5) * 0.6, 0.07, 0.006, 0.1, IC.cream, 0);
        for (let c = 0; c < 5; c++) mb.cyl(tx + 0.25, F + 0.8 + c * 0.012, tz - 0.25, 0.03, 0.03, 0.012, 8, c % 2 ? IC.red : IC.cream, 0);
      } else {
        mb.cyl(tx + 0.12, F + 0.79, tz, 0.035, 0.035, 0.24, 6, rgb(0x3a5a2a), 0);
        mb.cyl(tx - 0.15, F + 0.79, tz + 0.1, 0.04, 0.035, 0.1, 6, IC.glass, 0);
      }
    });
    // self-playing piano against the left wall
    at(mb, x0 + 0.38, F, -9.2, Math.PI / 2, () => {
      mb.box(0, 0, 0, 1.55, 1.32, 0.62, rgb(0x2e1c14), 3);
      mb.box(0, 0.72, 0.36, 1.45, 0.06, 0.24, rgb(0x2e1c14), 3);
      mb.box(0, 0.78, 0.38, 1.35, 0.02, 0.18, IC.cream, 0);
      for (let k = 0; k < 18; k++) if (k % 7 !== 2 && k % 7 !== 6) mb.box(-0.62 + k * 0.075, 0.8, 0.33, 0.035, 0.025, 0.1, IC.black, 0);
      mb.box(0, 0.95, 0.32, 0.7, 0.3, 0.02, IC.paper, 0);
      mb.box(0, 1.32, 0, 1.6, 0.05, 0.66, rgb(0x3a2418), 3);
      mb.box(0.5, 1.37, 0.05, 0.12, 0.2, 0.08, IC.brass, 0);
    });
    rColl(R, x0, x0 + 0.75, -10.0, -8.4, 1.4);
    // stairs up along the back wall, into an opening in the ceiling
    walkStairs(mb, R, 14, F, C, (i) => [-0.6 - i * 0.33, z0 + 0.6], 0.34, 1.1, rgb(0x6a4630), rgb(0x8a6040), 2);
    for (let i = 0; i < 7; i++) mb.box(-0.6 - i * 0.66, F + (i * 2 + 1) * ((C - F) / 14), z0 + 1.15, 0.05, 0.95, 0.05, IC.walnut, 3);
    mb.beam([-0.6, F + 1.1, z0 + 1.15], [-5.2, C + 0.9, z0 + 1.15], 0.07, IC.walnut, 3);
    // deer head and paintings
    at(mb, x0 + 0.05, F + 2.2, -4.2, Math.PI / 2, () => { mb.box(0, 0, 0, 0.3, 0.35, 0.05, IC.walnut, 0); mb.box(0, 0.02, 0.12, 0.18, 0.22, 0.3, rgb(0x7a5a3a), 9); for (const s of [-1, 1]) mb.beam([s * 0.06, 0.24, 0.12], [s * 0.32, 0.6, 0.08], 0.03, IC.cream, 0); });
    at(mb, -2.0, F + 1.9, z0 + 0.05, 0, () => picture(mb, 1.6, 0.9, rgb(0xc9a27a)));
    for (const [lx, lz] of [[-2.4, -3.8], [-1.4, -7.6], [2.2, -5.6]]) lantern(mb, lx, lz, C, 0.6);
    mb.box(1.6, F, -2.0, 0.24, 0.24, 0.24, IC.brass, 0);
  },
  saloonUp(mb, U, rnd) {
    const { x0, x1, z0, floorY: F, ceilY: C } = U, P = U.parent;
    const zc = z0 + 2.8;
    upperFloor(mb, U, {
      walk: U.rects.slice(0, 3), paper: rgb(0x6a2a2a), wain: rgb(0x4e2e1e), door: rgb(0x5a3020),
      walls: [[x0, z0 + 0.04, x1, z0 + 0.04], [x0 + 0.04, z0, x0 + 0.04, zc], [x1 - 0.04, z0, x1 - 0.04, zc], [x0, zc, x1, zc, true, [-4.0, 0.0, 4.0]]],
      rails: [[-5.06, z0 + 1.2, -0.42, z0 + 1.2], [-0.42, z0, -0.42, z0 + 1.2]],
      wins: [2.6, 5.0, -5.7].map((x) => ({ x, z: z0 + 0.09, alongX: true, w: 0.9, y: F + 0.9, h: 1.3 }))
    });
    U.lights = [[2.6, F + 1.5, z0 - 0.6, 1.0], [-5.7, F + 1.5, z0 - 0.6, 0.9], [5.0, F + 1.5, z0 - 0.6, 0.8], [-2.7, P.ceilY - 0.4, z0 + 0.6, 0.5]];
    rug(mb, 0.4, F, z0 + 2.0, 10.6, 0.85, rgb(0x6a2424), rgb(0x3a1a14));
    at(mb, x1 - 0.45, F, z0 + 0.5, 0, () => { squareTable(mb, 0.6, 0.5, 0.75, IC.walnut); mb.cyl(0, 0.75, 0, 0.08, 0.06, 0.25, 7, rgb(0x2f5a6a), 0); });
    rColl(U, x1 - 0.8, x1, z0, z0 + 0.8, 1);
    at(mb, 3.8, F, z0 + 0.45, 0, () => chair(mb, IC.walnut)); rCircle(U, 3.8, z0 + 0.45, 0.3);
    for (const x of [-2.0, 2.0]) at(mb, x, F + 1.45, zc - 0.06, 0, () => picture(mb, 0.8, 0.6, x < 0 ? rgb(0xb08a6a) : rgb(0x7a8a6a)));
    lantern(mb, -3.0, z0 + 2.0, C, 0.5); lantern(mb, 2.4, z0 + 2.0, C, 0.5); lantern(mb, 4.6, z0 + 0.6, C, 0.5);
  },
  hotelUp(mb, U, rnd) {
    const { x0, z0, z1, floorY: F, ceilY: C } = U, P = U.parent;
    const xp = x0 + 2.7;
    upperFloor(mb, U, {
      walk: U.rects.slice(0, 3), paper: rgb(0x5a6a4e), wain: rgb(0x4e3424), door: rgb(0x6a4a30), floorTop: rgb(0x7a2a2a),
      walls: [[x0, z0 + 0.04, xp, z0 + 0.04], [x0 + 0.04, z0, x0 + 0.04, z1], [x0, z1 - 0.04, xp, z1 - 0.04], [xp, z0, xp, z1, true, [-1.1, -4.3, -7.9, -10.6]]],
      rails: [[x0 + 1.25, -6.86, x0 + 1.25, -2.2], [x0, -2.2, x0 + 1.25, -2.2]],
      wins: [{ x: -3.83, z: z1 - 0.09, alongX: true, w: 1.0, y: 4.75, h: 1.55 }, { x: -4.2, z: z0 + 0.09, alongX: true, w: 0.9, y: F + 0.9, h: 1.3 }]
    });
    U.lights = [[-3.83, 5.5, z1 + 0.6, 1.0], [-4.2, F + 1.5, z0 - 0.6, 0.9], [x0 + 0.6, P.ceilY - 0.4, -4.5, 0.5]];
    rug(mb, x0 + 1.95, F, -4.5, 0.75, 4.2, rgb(0x2f4a5a), rgb(0x1e2e3a));
    at(mb, x0 + 0.5, F, z0 + 1.4, Math.PI / 2, () => bench(mb, 1.4, IC.walnut)); rColl(U, x0, x0 + 0.85, z0 + 0.6, z0 + 2.2, 0.8);
    at(mb, x0 + 0.45, F, -0.6, 0, () => { squareTable(mb, 0.6, 0.5, 0.75, IC.walnut); mb.cyl(0, 0.75, 0, 0.08, 0.05, 0.3, 7, rgb(0x8a3a3a), 0); });
    rColl(U, x0, x0 + 0.8, -1.0, -0.2, 1);
    at(mb, x0 + 0.07, F + 1.45, -9.0, Math.PI / 2, () => picture(mb, 0.9, 0.65, rgb(0x8a9a7a)));
    lantern(mb, x0 + 1.95, -4.5, C, 0.5); lantern(mb, x0 + 1.4, -9.4, C, 0.5); lantern(mb, x0 + 1.4, -1.0, C, 0.5);
  },
  bank(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0x46604e), rgb(0x5a3a26), 9, rgb(0xd8ccb0));
    // teller counter with a brass cage, gate on the right
    at(mb, -1.0, F, -5.0, 0, () => { counter(mb, 6.6, 0.7, 1.05, rgb(0x5a3a26)); at(mb, 0, 1.08, 0, 0, () => bars(mb, 6.4, 0.9, 0)); for (const x of [-1.6, 1.6]) mb.box(x, 1.08, 0.36, 0.6, 0.02, 0.2, IC.brass, 0); });
    rColl(R, x0, 2.35, -5.4, -4.6, 2.2);
    at(mb, 3.25, F, -5.0, 0, () => { mb.box(0, 0, 0, 1.6, 1.05, 0.06, rgb(0x5a3a26), 3); });
    rColl(R, 2.45, x1, -5.05, -4.95, 1.1);
    // vault
    at(mb, 2.6, F, z0 + 0.6, 0, () => {
      mb.box(0, 0, 0, 2.2, 2.4, 1.1, rgb(0x3a3b40), 0);
      mb.box(0, 0.25, 0.56, 1.6, 1.9, 0.05, rgb(0x2a2b30), 0);
      at(mb, 0, 1.2, 0.6, 0, () => { mb.push(new THREE.Matrix4().makeRotationX(Math.PI / 2)); mb.cyl(0, 0, 0, 0.3, 0.3, 0.06, 12, IC.brass, 0); mb.cyl(0, 0.06, 0, 0.08, 0.08, 0.06, 8, IC.iron, 0); mb.pop(); });
      for (let i = 0; i < 4; i++) mb.box(-0.6 + i * 0.4, 1.95, 0.6, 0.25, 0.08, 0.02, IC.brass, 0);
    });
    rColl(R, 1.45, 3.75, z0, z0 + 1.2, 2.5);
    // banker's desk
    at(mb, -2.2, F, -7.6, 0, () => { squareTable(mb, 1.6, 0.8, 0.78, IC.walnut); mb.box(0.4, 0.78, 0, 0.4, 0.05, 0.3, IC.paper, 0); mb.box(-0.5, 0.78, 0.1, 0.12, 0.3, 0.12, IC.green, 0); });
    at(mb, -2.2, F, -8.4, 0, () => chair(mb, IC.walnut));
    rColl(R, -3.0, -1.4, -8.0, -7.2, 0.8);
    at(mb, -3.2, F, -1.2, Math.PI / 2, () => bench(mb, 1.8, IC.walnut)); rColl(R, x0, -2.9, -2.1, -0.3, 0.8);
    at(mb, 0, F + 2.3, -5.3, Math.PI, () => { mb.cyl(0, 0, 0, 0.22, 0.22, 0.04, 12, IC.brass, 0); });
    at(mb, x0 + 0.05, F + 1.8, -7.0, Math.PI / 2, () => picture(mb, 0.9, 1.1, rgb(0x8a7a6a)));
    lantern(mb, -1.0, -2.6, C, 0.9); lantern(mb, 0, -7.4, C, 0.9);
  },
  hotel(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    setupUpper(R, [x0, x0 + 1.25, -6.86, -2.2], [[x0 + 1.25, x0 + 2.7, -6.86, -2.2], [x0, x0 + 2.7, z0, -6.86], [x0, x0 + 2.7, -2.2, z1]]);
    lining(mb, R, rgb(0x8a6a4a), rgb(0x4e3424), 9, rgb(0x6a4a34));
    at(mb, 2.8, F, -6.5, 0, () => { counter(mb, 3.2, 0.7, 1.05, rgb(0x5a3a26)); mb.box(0.9, 1.05, 0, 0.5, 0.03, 0.35, IC.paper, 0); mb.cyl(-0.8, 1.05, 0.1, 0.06, 0.02, 0.06, 8, IC.brass, 0); });
    rColl(R, 1.1, 4.5, -6.9, -6.1, 1.1);
    at(mb, 2.8, F + 1.5, z0 + 0.04, 0, () => { mb.box(0, 0, 0, 1.4, 0.9, 0.04, IC.walnut, 3); for (let i = 0; i < 12; i++) { mb.box(-0.55 + (i % 6) * 0.22, 0.2 + Math.floor(i / 6) * 0.4, 0.04, 0.02, 0.02, 0.06, IC.brass, 0); if (rnd() < 0.7) mb.box(-0.55 + (i % 6) * 0.22, 0.07 + Math.floor(i / 6) * 0.4, 0.07, 0.03, 0.12, 0.02, IC.brass, 0); } });
    // lobby: rug, sofa, armchairs, plant, tall clock
    rug(mb, -2.4, F, -3.6, 3.4, 2.6, rgb(0x7a2a2a), rgb(0x3a2a4a));
    at(mb, -2.4, F, -5.0, 0, () => { mb.box(0, 0, 0, 2.0, 0.42, 0.8, rgb(0x5a2a3a), 9); mb.box(0, 0.42, -0.3, 2.0, 0.5, 0.2, rgb(0x5a2a3a), 9); for (const s of [-1, 1]) mb.box(s * 0.95, 0.42, 0, 0.12, 0.25, 0.8, rgb(0x5a2a3a), 9); for (const s of [-1, 1]) seatHere(mb, s * 0.45, 0.02, 'sofa'); });
    rColl(R, -3.5, -1.3, -5.45, -4.55, 0.9);
    for (const [ax, ry] of [[-3.75, Math.PI / 2], [-0.6, -Math.PI / 2]]) at(mb, ax, F, -3.4, ry, () => { mb.box(0, 0, 0, 0.8, 0.42, 0.8, rgb(0x2f4a5a), 9); mb.box(0, 0.42, -0.32, 0.8, 0.55, 0.16, rgb(0x2f4a5a), 9); seatHere(mb, 0, 0.04, 'sofa'); });
    rCircle(R, -3.75, -3.4, 0.45); rCircle(R, -0.6, -3.4, 0.45);
    at(mb, -2.4, F, -3.4, 0, () => squareTable(mb, 0.8, 0.5, 0.45, IC.walnut));
    keg(mb, x1 - 0.45, F, -0.7, 0.22, 0.4, rgb(0x8a5a3a));
    for (let i = 0; i < 7; i++) mb.beam([x1 - 0.45, F + 0.4, -0.7], [x1 - 0.45 + Math.sin(i) * 0.35, F + 1.0 + rnd() * 0.4, -0.7 + Math.cos(i) * 0.35], 0.06, rgb(0x4a7a3a), 8);
    rCircle(R, x1 - 0.45, -0.7, 0.3);
    at(mb, x1 - 0.35, F, -2.0, -Math.PI / 2, () => { mb.box(0, 0, 0, 0.5, 2.1, 0.35, IC.walnut, 3); mb.cyl(0, 1.6, 0.18, 0.16, 0.16, 0.02, 12, IC.cream, 0); });
    rColl(R, x1 - 0.55, x1, -2.3, -1.7, 2);
    // stairs to the rooms upstairs
    walkStairs(mb, R, 14, F, C, (i) => [x0 + 0.65, -2.4 - i * 0.33], 1.1, 0.34, rgb(0x5e3e2a), rgb(0x7a2a2a), 9);
    for (let i = 0; i < 8; i++) mb.box(x0 + 1.2, F + 0.24 * (1 + i * 1.75), -2.4 - i * 0.62, 0.05, 0.95, 0.05, IC.walnut, 3);
    mb.beam([x0 + 1.2, F + 1.15, -2.3], [x0 + 1.2, C + 0.95, -6.85], 0.07, IC.walnut, 3);
    for (const [lx, lz] of [[-2.0, -3.4], [2.6, -7.6]]) lantern(mb, lx, lz, C, 0.6);
    at(mb, -0.5, F + 1.7, z0 + 0.05, 0, () => picture(mb, 1.1, 0.75, rgb(0x6a8aa0)));
  },
  sheriff(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0xcfc4a8), rgb(0x6a4a32), 3);
    at(mb, -1.6, F, -3.6, 0, () => { squareTable(mb, 1.5, 0.8, 0.78, IC.oak); mb.box(0.3, 0.78, 0, 0.35, 0.02, 0.25, IC.paper, 0); mb.box(-0.3, 0.78, 0.1, 0.25, 0.12, 0.18, rgb(0x3a3a3a), 0); mb.cyl(-0.55, 0.78, -0.2, 0.05, 0.05, 0.1, 7, rgb(0x6a6a6a), 0); });
    at(mb, -1.6, F, -4.3, 0, () => chair(mb, IC.walnut));
    rColl(R, -2.4, -0.8, -4.0, -3.2, 0.8);
    // jail cell with bunk and bucket
    at(mb, 1.9, F, -5.4, 0, () => bars(mb, 3.9, 2.4, 0)); rColl(R, 0, x1, -5.45, -5.35, 3);
    at(mb, 0.15, F, -6.9, Math.PI / 2, () => bars(mb, 3.0, 2.4, 0)); rColl(R, 0.1, 0.2, z0, -5.4, 3);
    mb.box(2.9, F + 0.4, -7.9, 1.8, 0.08, 0.7, IC.oak, 2); mb.box(2.9, F + 0.48, -7.9, 1.7, 0.1, 0.6, rgb(0x6a6a5a), 9);
    for (const s of [-1, 1]) mb.box(2.9 + s * 0.85, F, -7.9, 0.06, 0.4, 0.6, IC.oak, 3);
    rColl(R, 1.95, x1, -8.3, -7.5, 0.6);
    mb.cyl(0.8, F, -8.2, 0.15, 0.13, 0.28, 8, rgb(0x6a6a6a), 0);
    // gun rack and wanted posters
    at(mb, x1 - 0.06, F + 1.0, -2.6, -Math.PI / 2, () => { mb.box(0, 0, 0, 1.4, 0.08, 0.15, IC.walnut, 3); mb.box(0, 1.1, 0, 1.4, 0.08, 0.15, IC.walnut, 3); for (let i = 0; i < 4; i++) { mb.box(-0.5 + i * 0.33, 0.05, 0.08, 0.06, 1.2, 0.04, IC.walnut, 3); mb.box(-0.5 + i * 0.33, 0.6, 0.08, 0.04, 0.65, 0.05, IC.iron, 0); } });
    for (let i = 0; i < 4; i++) at(mb, x0 + 0.05, F + 1.5 + (i % 2) * 0.1, -1.6 - i * 0.7, Math.PI / 2, () => poster(mb, 0.45, 0.6));
    stove(mb, -2.9, F, -6.8, C); rCircle(R, -2.9, -6.8, 0.38);
    mb.cyl(-2.9, F + 0.93, -6.65, 0.08, 0.06, 0.2, 7, rgb(0x5a6a7a), 0);
    at(mb, x0 + 0.35, F, -7.8, Math.PI / 2, () => { mb.box(0, 0, 0, 0.8, 1.3, 0.5, rgb(0x5a5a52), 0); for (let i = 0; i < 3; i++) mb.box(0, 0.2 + i * 0.4, 0.26, 0.6, 0.3, 0.02, rgb(0x6a6a62), 0); });
    rColl(R, x0, x0 + 0.65, -8.3, -7.3, 1.4);
    lantern(mb, -1.6, -3.6, C, 0.8); lantern(mb, 2.0, -7.0, C, 0.8);
  },
  barber(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0x9fb4b8), rgb(0xe6dccb), 4, rgb(0xd8d0c0));
    // mirror and counter on the right wall, two barber chairs facing it
    at(mb, x1 - 0.3, F, -4.6, -Math.PI / 2, () => {
      counter(mb, 3.4, 0.5, 0.9, rgb(0xe6dccb), rgb(0x6a4a32));
      mb.box(0, 1.3, -0.22, 3.0, 1.2, 0.03, rgb(0xa8bcc0), 30);
      mb.box(0, 1.25, -0.24, 3.2, 1.3, 0.02, IC.walnut, 0);
      for (let i = 0; i < 8; i++) mb.cyl(-1.3 + i * 0.36, 0.9, 0.05, 0.04, 0.04, 0.18 + rnd() * 0.08, 6, rgb(GOODS[(i * 3) % GOODS.length]), 0);
      mb.cyl(0.6, 0.9, 0.1, 0.18, 0.12, 0.12, 10, IC.cream, 0);
    });
    rColl(R, x1 - 0.6, x1, -6.3, -2.9, 1);
    for (const cz of [-3.6, -5.6]) {
      at(mb, x1 - 1.6, F, cz, Math.PI / 2, () => {
        mb.cyl(0, 0, 0, 0.3, 0.3, 0.06, 10, rgb(0xd8d8d8), 0); mb.cyl(0, 0.06, 0, 0.08, 0.08, 0.4, 8, rgb(0xd8d8d8), 0);
        mb.box(0, 0.46, 0, 0.6, 0.14, 0.6, IC.red, 9); mb.box(0, 0.6, -0.28, 0.6, 0.75, 0.14, IC.red, 9);
        for (const s of [-1, 1]) mb.box(s * 0.32, 0.6, 0, 0.08, 0.25, 0.55, IC.red, 9);
        mb.box(0, 1.35, -0.3, 0.32, 0.18, 0.1, IC.red, 9); mb.box(0, 0.2, 0.42, 0.4, 0.05, 0.25, rgb(0xd8d8d8), 0);
        seatHere(mb, 0, 0.02, 'barber');
      });
      rCircle(R, x1 - 1.6, cz, 0.45);
    }
    at(mb, x0 + 0.3, F, -3.5, Math.PI / 2, () => bench(mb, 2.4, IC.walnut)); rColl(R, x0, x0 + 0.5, -4.8, -2.2, 0.8);
    mb.box(x0 + 0.3, F + 0.48, -3.0, 0.3, 0.03, 0.4, IC.paper, 0);
    // bath in the back corner behind a curtain
    at(mb, -2.2, F, z0 + 0.8, 0, () => { mb.box(0, 0.1, 0, 1.6, 0.55, 0.75, rgb(0xb0b4b4), 0); mb.box(0, 0.6, 0, 1.4, 0.04, 0.55, rgb(0x6a8a96), 0); for (const s of [-1, 1]) mb.box(s * 0.7, 0, 0, 0.08, 0.12, 0.6, IC.iron, 0); });
    rColl(R, -3.1, -1.3, z0, z0 + 1.3, 0.8);
    mb.box(-0.4, F, z0 + 0.9, 0.05, 2.2, 1.6, rgb(0xd8ccb0), 9);
    at(mb, -0.9, F, -1.4, 0, () => { mb.cyl(0, 0, 0, 0.2, 0.2, 0.04, 8, IC.walnut, 0); mb.cyl(0, 0.04, 0, 0.03, 0.03, 1.75, 6, IC.walnut, 0); for (let i = 0; i < 3; i++) mb.beam([0, 1.65, 0], [Math.sin(i * 2.1) * 0.25, 1.8, Math.cos(i * 2.1) * 0.25], 0.03, IC.walnut, 0); mb.cyl(0.2, 1.72, 0.1, 0.17, 0.17, 0.04, 10, rgb(0x3a2a20), 0); mb.cyl(0.2, 1.76, 0.1, 0.1, 0.09, 0.1, 10, rgb(0x3a2a20), 0); });
    rCircle(R, -0.9, -1.4, 0.25);
    lantern(mb, 1.2, -4.6, C, 0.8);
  },
  gunsmith(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0x5e4532), rgb(0x3e2a1c), 3, rgb(0x4e3828));
    // glass display counter with revolvers
    at(mb, -0.2, F, -5.6, 0, () => {
      mb.box(0, 0, 0, 4.4, 0.75, 0.75, rgb(0x4e3020), 3);
      mb.box(0, 0.75, 0, 4.4, 0.3, 0.75, rgb(0xa8c4c4), 0);
      mb.box(0, 1.05, 0, 4.5, 0.04, 0.8, rgb(0x4e3020), 2);
      for (let i = 0; i < 6; i++) { const x = -1.8 + i * 0.7; mb.box(x, 0.78, 0, 0.28, 0.05, 0.1, IC.iron, 0); mb.box(x - 0.1, 0.78, 0.03, 0.08, 0.05, 0.16, rgb(0x6a4a2a), 0); }
    });
    rColl(R, -2.45, 2.05, -6.0, -5.2, 1.1);
    // rifle racks along both side walls
    for (const [wx, ry] of [[x0 + 0.08, Math.PI / 2], [x1 - 0.08, -Math.PI / 2]]) {
      at(mb, wx, F + 0.6, -3.0, ry, () => {
        mb.box(0, 0, 0, 3.6, 0.06, 0.2, IC.walnut, 3); mb.box(0, 1.25, 0, 3.6, 0.06, 0.12, IC.walnut, 3);
        for (let i = 0; i < 9; i++) { const x = -1.6 + i * 0.4; mb.box(x, 0.06, 0.06, 0.07, 0.4, 0.05, rgb(0x6a4026), 0); mb.box(x, 0.46, 0.06, 0.035, 0.95, 0.04, IC.iron, 0); }
      });
    }
    rColl(R, x0, x0 + 0.3, -4.9, -1.1, 2); rColl(R, x1 - 0.3, x1, -4.9, -1.1, 2);
    // workbench with a vise, target on the back wall, ammunition crates
    at(mb, 0, F, z0 + 0.45, 0, () => { squareTable(mb, 3.0, 0.8, 0.9, IC.oak); mb.box(0.9, 0.9, 0.2, 0.2, 0.18, 0.25, IC.iron, 0); for (let i = 0; i < 5; i++) mb.box(-1.2 + i * 0.25, 1.2, -0.38, 0.04, 0.4, 0.02, IC.iron, 0); mb.box(0, 1.15, -0.39, 1.6, 0.6, 0.02, rgb(0x7a5a3a), 3); });
    rColl(R, -1.5, 1.5, z0, z0 + 0.9, 1);
    at(mb, x1 - 0.6, F, -7.6, 0, () => { crate(mb, 0, 0, 0, 0.55, rgb(0x6a7a4a)); crate(mb, 0.05, 0.55, 0, 0.45, rgb(0x6a7a4a)); });
    rColl(R, x1 - 0.9, x1, -7.9, -7.3, 1);
    at(mb, -1.5, F + 1.8, z0 + 0.03, 0, () => { mb.push(new THREE.Matrix4().makeRotationX(Math.PI / 2)); for (let i = 0; i < 4; i++) mb.cyl(0, 0.01 * i, 0, 0.4 - i * 0.1, 0.4 - i * 0.1, 0.01, 14, i % 2 ? IC.cream : IC.red, 0); mb.pop(); });
    at(mb, 0.4, F + 2.6, z0 + 0.05, 0, () => { mb.box(0, 0, 0, 0.3, 0.3, 0.06, IC.walnut, 0); for (const s of [-1, 1]) { mb.beam([s * 0.05, 0.2, 0.05], [s * 0.45, 0.55, 0.05], 0.04, IC.cream, 0); mb.beam([s * 0.3, 0.4, 0.05], [s * 0.35, 0.7, 0.05], 0.03, IC.cream, 0); } });
    lantern(mb, -0.2, -3.4, C, 0.9); lantern(mb, 0, -7.0, C, 0.9);
  },
  post(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0xb79a6e), rgb(0x5e4030), 3);
    at(mb, 0, F, -5.2, 0, () => { counter(mb, x1 - x0 - 2.2, 0.7, 1.05, rgb(0x5e4030)); for (let i = 0; i < 3; i++) at(mb, -2.6 + i * 2.6, 1.08, 0, 0, () => bars(mb, 0.8, 0.6, 0)); });
    rColl(R, x0 + 1.1 - 0.05, x1 - 1.1 + 0.05, -5.6, -4.8, 1.2);
    rColl(R, x1 - 1.15, x1, -5.25, -5.15, 1.1); mb.box(x1 - 0.6, F, -5.2, 1.0, 1.05, 0.06, rgb(0x5e4030), 3);
    // pigeonholes full of letters
    at(mb, 0, F + 0.9, z0 + 0.25, 0, () => {
      mb.box(0, 0, -0.18, 4.4, 2.0, 0.04, IC.walnut, 3);
      for (let i = 0; i <= 10; i++) mb.box(-2.2 + i * 0.44, 0, 0, 0.03, 2.0, 0.4, IC.oak, 3);
      for (let j = 0; j <= 5; j++) mb.box(0, j * 0.4, 0, 4.4, 0.03, 0.4, IC.oak, 3);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) if (rnd() < 0.55) mb.box(-1.98 + i * 0.44, j * 0.4 + 0.04, 0.05, 0.3, 0.06 + rnd() * 0.15, 0.25, IC.paper, 0);
    });
    rColl(R, -2.3, 2.3, z0, z0 + 0.5, 3);
    // telegraph desk, parcels, mail sacks, scale
    at(mb, x0 + 0.6, F, -7.6, Math.PI / 2, () => { squareTable(mb, 1.4, 0.7, 0.78, IC.oak); mb.box(0, 0.78, 0.05, 0.25, 0.06, 0.18, IC.brass, 0); mb.box(0.05, 0.84, 0.05, 0.14, 0.03, 0.03, IC.black, 0); mb.box(-0.4, 0.78, 0, 0.3, 0.2, 0.22, rgb(0x3a3a3a), 0); });
    rColl(R, x0, x0 + 1.0, -8.4, -6.8, 0.8);
    for (let i = 0; i < 5; i++) crate(mb, x1 - 0.5 - (i % 3) * 0.45, F + Math.floor(i / 3) * 0.4, -7.5 - (i % 2) * 0.1, 0.4, rgb(0xb89a6a));
    rColl(R, x1 - 1.6, x1, -7.8, -7.2, 0.9);
    for (let i = 0; i < 2; i++) sack(mb, x1 - 0.5, F, -3.0 - i * 0.6, rgb(0x8a8a6a));
    rColl(R, x1 - 0.8, x1, -3.9, -2.7, 0.7);
    at(mb, -2.0, F, -2.2, 0, () => bench(mb, 1.8, IC.walnut)); rColl(R, -2.9, -1.1, -2.45, -2.0, 0.8);
    at(mb, x0 + 0.05, F + 1.5, -3.0, Math.PI / 2, () => picture(mb, 1.4, 1.0, rgb(0xd8c8a0)));
    lantern(mb, -2.0, -3.4, C, 0.9); lantern(mb, 2.0, -3.4, C, 0.9);
  },
  apothecary(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    lining(mb, R, rgb(0x8fa08a), rgb(0x4a3424), 4, rgb(0xd8d2c0));
    // floor-to-ceiling bottle shelves on both side walls
    for (const [wx, ry] of [[x0 + 0.3, Math.PI / 2], [x1 - 0.3, -Math.PI / 2]]) at(mb, wx, F, -4.6, ry, () => shelfUnit(mb, 6.0, C - F - 0.2, 0.42, 7, rnd, 'bottles', IC.walnut));
    rColl(R, x0, x0 + 0.55, -7.7, -1.5, 3); rColl(R, x1 - 0.55, x1, -7.7, -1.5, 3);
    // the drawer cabinet behind the counter
    at(mb, 0, F, z0 + 0.3, 0, () => {
      mb.box(0, 0, 0, 3.6, 2.5, 0.5, IC.walnut, 3);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) { mb.box(-1.57 + i * 0.45, 0.15 + j * 0.33, 0.26, 0.4, 0.28, 0.02, rgb(0x6a4a30), 3); mb.box(-1.57 + i * 0.45, 0.28 + j * 0.33, 0.28, 0.06, 0.03, 0.03, IC.brass, 0); }
    });
    rColl(R, -1.85, 1.85, z0, z0 + 0.6, 3);
    at(mb, 0, F, -5.6, 0, () => {
      counter(mb, 3.2, 0.7, 1.0, rgb(0x4a3424));
      mb.cyl(-0.9, 1.0, 0, 0.12, 0.08, 0.14, 10, rgb(0xd8d2c0), 0); mb.beam([-0.9, 1.08, 0], [-0.82, 1.3, 0.05], 0.03, rgb(0xd8d2c0), 0);
      mb.box(0.8, 1.0, 0, 0.35, 0.04, 0.2, IC.brass, 0); mb.box(0.8, 1.04, 0, 0.04, 0.3, 0.04, IC.brass, 0); mb.box(0.8, 1.34, 0, 0.42, 0.03, 0.03, IC.brass, 0);
      for (const s of [-1, 1]) mb.cyl(0.8 + s * 0.2, 1.2, 0, 0.08, 0.08, 0.02, 8, IC.brass, 0);
      for (let i = 0; i < 4; i++) mb.cyl(0 + i * 0.16, 1.0, 0.15, 0.06, 0.06, 0.22, 8, IC.glass, 0, { top: IC.cream });
    });
    rColl(R, -1.7, 1.7, -6.0, -5.2, 1.1);
    // show globes in the front windows, the sign of a druggist
    for (const [gx, gc] of [[-2.25, rgb(0xc8302a)], [2.25, rgb(0x2a8a4a)]]) {
      mb.box(gx, C - 0.6, z1 - 0.5, 0.02, 0.6, 0.02, IC.iron, 0);
      at(mb, gx, C - 1.15, z1 - 0.5, 0, () => mb.geo(new THREE.IcosahedronGeometry(0.22, 1), gc, 30));
    }
    // drying herbs
    for (let i = 0; i < 6; i++) mb.beam([-1.5 + i * 0.6, C - 0.1, -3.0], [-1.5 + i * 0.6 + 0.04, C - 0.6 - rnd() * 0.2, -3.0], 0.14, rgb([0x6a8a4a, 0x8a7a4a, 0x5a6a3a][i % 3]), 10);
    mb.box(0, C - 0.1, -3.0, 4.0, 0.04, 0.04, IC.walnut, 0);
    lantern(mb, 0, -3.6, C, 0.6); lantern(mb, 0, -6.8, C, 0.6);
  },
  livery(mb, R, rnd) {
    const { x0, x1, z0, z1, floorY: F, ceilY: C } = R;
    const plank = rgb(0x8a5a3a), dark = rgb(0x5a3a26);
    // walls from inside are bare boards, ceiling of rafters, a hay loft over the back
    lining(mb, R, rgb(0x7a4a32), rgb(0x6a4030), 3, rgb(0x5a3a26));
    for (let i = 0; i < 18; i++) mb.box((rnd() - 0.5) * 10, F, -0.6 - rnd() * 11.5, 0.6 + rnd() * 1.2, 0.02, 0.5 + rnd() * 1.0, rgb(0xc9a256), 23);
    // three stalls each side
    for (const s of [-1, 1]) {
      const wx = s < 0 ? x0 : x1;
      for (let i = 0; i <= 3; i++) {
        const z = -1.5 - i * 2.6;
        mb.box(wx - s * 1.4, F, z, 2.8, 1.35, 0.08, plank, 3);
        mb.box(wx - s * 2.75, F, z, 0.14, 1.6, 0.14, dark, 3);
        rColl(R, s < 0 ? x0 : x1 - 2.85, s < 0 ? x0 + 2.85 : x1, z - 0.06, z + 0.06, 1.4);
      }
      for (let i = 0; i < 3; i++) {
        const z = -2.8 - i * 2.6;
        mb.box(wx - s * 2.75, F + 0.6, z, 0.08, 0.1, 2.5, plank, 3);
        mb.box(wx - s * 2.75, F + 1.2, z, 0.08, 0.1, 2.5, plank, 3);
        rColl(R, wx - s * 2.75 - 0.06, wx - s * 2.75 + 0.06, z - 1.25, z + 1.25, 1.3);
        mb.box(wx - s * 0.35, F + 0.5, z, 0.5, 0.35, 0.9, plank, 3, { top: rgb(0xc9a256), tileTop: 23 });
        for (let k = 0; k < 6; k++) mb.box(wx - s * (0.8 + rnd() * 1.6), F, z + (rnd() - 0.5) * 2.0, 0.5 + rnd() * 0.4, 0.06, 0.4 + rnd() * 0.5, rgb(0xd1aa5c), 23);
      }
    }
    // hay loft with a ladder, bales below and up top
    const loftZ = -9.2, loftY = 3.0;
    mb.box(0, loftY, (z0 + loftZ) / 2, x1 - x0, 0.12, loftZ - z0, plank, 2, { bottom: true });
    for (const x of [-2.6, 2.6]) mb.box(x, F, loftZ + 0.1, 0.2, loftY - F, 0.2, dark, 3);
    rCircle(R, -2.6, loftZ + 0.1, 0.18); rCircle(R, 2.6, loftZ + 0.1, 0.18);
    for (let i = 0; i < 7; i++) mb.box(-3.2 + i * 1.05, loftY + 0.12, -11.0 + (i % 2) * 0.4, 1.0, 0.55, 0.7, rgb(0xd9b45c), 23, { ao: 0.12 });
    for (let i = 0; i < 3; i++) mb.box(-1.0 + (i % 2) * 1.05, F + Math.floor(i / 2) * 0.55, -10.4, 1.0, 0.55, 0.7, rgb(0xd9b45c), 23, { ao: 0.12 });
    rColl(R, -1.55, 1.1, -10.8, -10.0, 1.2);
    for (const s of [-1, 1]) mb.box(1.6 + s * 0.22, F, loftZ + 0.25, 0.06, loftY + 0.9 - F, 0.06, plank, 3);
    for (let i = 0; i < 10; i++) mb.box(1.6, F + 0.3 + i * 0.32, loftZ + 0.25, 0.44, 0.04, 0.05, plank, 3);
    // saddles on a rail, trough, pitchfork, lanterns
    at(mb, 0, F, -1.6, 0, () => { mb.box(0, 1.0, 0, 2.4, 0.08, 0.08, dark, 3); for (const s of [-1, 1]) mb.box(s * 1.15, 0, 0, 0.08, 1.05, 0.08, dark, 3); for (const sx of [-0.6, 0.5]) { mb.box(sx, 1.05, 0, 0.45, 0.14, 0.55, rgb(0x6a3a22), 0); mb.box(sx, 1.18, 0.18, 0.1, 0.12, 0.08, rgb(0x5a3020), 0); } });
    rColl(R, -1.25, 1.25, -1.7, -1.5, 1.1);
    mb.box(0, F, -6.4, 2.4, 0.6, 0.7, plank, 2, { top: rgb(0x58798a), tileTop: 0 }); rColl(R, -1.25, 1.25, -6.8, -6.0, 0.6);
    mb.beam([-1.6, F, -4.0], [-1.45, F + 1.6, -4.1], 0.04, rgb(0x9a7a4a), 0);
    for (const [lx, lz] of [[0, -3.4], [0, -7.6]]) lantern(mb, lx, lz, C, 1.6);
  },
  church(mb, R, rnd) {
    const { floorY: F } = R;
    const C = R.ceilY, x0 = -4.3, x1 = 4.3, z0 = -13.8, z1 = -0.2;
    // nave lining (side and back walls), vestibule lining
    const white = rgb(0xe9e2d2), wood = rgb(0x6a4a32);
    mb.box(0, 0, (z0 + z1) / 2, x1 - x0, F, z1 - z0, rgb(0x8a6446), 2, { top: rgb(0x9a7050), tileTop: 2 });
    mb.box(0, 0, 1.1, 3.0, F, 2.6, rgb(0x8a6446), 2, { top: rgb(0x9a7050), tileTop: 2 });
    mb.box(0, F, z0 + 0.02, x1 - x0, C - F, 0.04, white, 4);
    for (const s of [-1, 1]) mb.box(s * (x1 - 0.02), F, (z0 + z1) / 2, 0.04, C - F, z1 - z0, white, 4);
    for (const s of [-1, 1]) mb.box(s * 2.7, F, z1 - 0.02, 3.2, C - F, 0.04, white, 4);
    mb.box(0, 3.2, z1 - 0.02, 2.2, C - 3.2, 0.04, white, 4);
    for (const s of [-1, 1]) mb.box(s * 1.48, F, 1.2, 0.04, 3.0, 2.8, white, 4);
    mb.box(0, 3.25, 1.2, 3.0, 0.08, 2.8, wood, 2);
    mb.box(0, C, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, rgb(0xd8d0c0), 4);
    for (let z = z0 + 1; z < z1; z += 2.2) mb.box(0, C - 0.2, z, x1 - x0, 0.2, 0.2, wood, 3);
    // tall windows
    for (const s of [-1, 1]) for (const z of [-3, -7, -11]) {
      mb.box(s * (x1 - 0.05), F + 1.7, z, 0.03, 2.6, 0.9, IC.window, 30);
      mb.box(s * (x1 - 0.06), F + 1.62, z, 0.04, 0.08, 1.06, wood, 0);
      mb.box(s * (x1 - 0.06), F + 3.0, z, 0.05, 0.05, 0.9, wood, 0);
    }
    // pews either side of the aisle, aisle runner
    rug(mb, 0, F, -6.8, 1.3, 12.6, rgb(0x8a2a24), rgb(0x5a1a18));
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const z = -2.6 - i * 1.45;
      at(mb, s * 2.3, F, z, Math.PI, () => { bench(mb, 2.7, rgb(0x6a4228), 'pew'); mb.box(0, 0, -0.42, 2.7, 0.95, 0.06, rgb(0x6a4228), 3); });
      rColl(R, s < 0 ? -3.7 : 0.9, s < 0 ? -0.9 : 3.7, z - 0.2, z + 0.5, 1);
    }
    // altar on a raised platform, cross, pulpit, candles
    mb.box(0, F, -12.7, 8.4, 0.25, 2.1, wood, 2, { top: rgb(0x8a6040), tileTop: 2 });
    rPlat(R, -4.2, 4.2, -13.75, -11.65, F + 0.25);
    at(mb, 0, F + 0.25, -12.9, 0, () => { mb.box(0, 0, 0, 1.8, 0.95, 0.7, rgb(0x5a3a26), 3); mb.box(0, 0.95, 0, 1.9, 0.04, 0.75, IC.cream, 9); for (const s of [-1, 1]) { mb.cyl(s * 0.65, 0.99, 0, 0.06, 0.06, 0.04, 8, IC.brass, 0); mb.cyl(s * 0.65, 1.03, 0, 0.025, 0.025, 0.28, 6, IC.cream, 0); mb.box(s * 0.65, 1.31, 0, 0.03, 0.05, 0.03, rgb(0xffd27a), 30); } });
    rColl(R, -0.95, 0.95, -13.3, -12.5, 1.3);
    mb.box(0, F + 2.0, z0 + 0.08, 0.2, 1.8, 0.1, wood, 3); mb.box(0, F + 3.1, z0 + 0.08, 1.0, 0.2, 0.1, wood, 3);
    at(mb, 3.0, F + 0.25, -11.9, -Math.PI / 4, () => { mb.box(0, 0, 0, 0.8, 1.15, 0.8, wood, 3); mb.box(0, 1.15, 0.1, 0.7, 0.05, 0.5, wood, 2); });
    rCircle(R, 3.0, -11.9, 0.5);
    for (const [lx, lz] of [[0, -3.5], [0, -7.5], [0, -11]]) lantern(mb, lx, lz, C, 1.4);
  }
};

/* ---------- build the interiors, doors and the indoor material ---------- */
function makeIndoorMat(R, forFigure) {
  const u = Object.assign({}, U, { uOpen: { value: lightOpenings(R) }, uRoomAmb: { value: v3(R.amb || 0xffd9a8, 0.1) },
    uTex: { value: forFigure ? 0 : 0.85 }, uK: { value: forFigure ? 0.4 : 0.5 } });
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: SH.litV, fragmentShader: SH.inF, vertexColors: true });
}
function doorLeafMesh(len, h, kind, dir) {
  const mb = new MB(), sx = dir;
  if (kind === 'saloon') {
    // batwing doors: a short leaf from the knee to the chest, the doorway above stays open
    const y0 = 0.5, lh = 1.1;
    mb.box(sx * len / 2, y0, 0, len - 0.04, lh - 0.1, 0.05, IC.light, 3);
    for (let i = 0; i < 5; i++) mb.box(sx * (0.12 + i * (len - 0.24) / 4), y0 + 0.15, 0.03, 0.05, lh - 0.4, 0.03, mulc(IC.light, 0.8), 0);
    const top = (i) => y0 + lh - 0.1 - Math.sin((i / 8) * Math.PI) * 0.16;   // scalloped top, low in the middle
    for (let i = 0; i < 8; i++) mb.box(sx * (len * (i + 0.5) / 8), top(i), 0, len / 8 + 0.01, 0.1, 0.06, IC.light, 3);
    mb.box(sx * 0.04, y0 + 0.1, 0, 0.08, lh - 0.2, 0.08, mulc(IC.light, 0.7), 0);   // the hinge stile
  } else {
    mb.box(sx * len / 2, 0, 0, len - 0.02, h, 0.07, rgb(0x5a3a26), 13, { faceUV: 'pz', tilePz: 13 });
    for (const y of [0.3, h - 0.4]) mb.box(sx * len / 2, y, 0.045, len - 0.1, 0.1, 0.03, mulc(rgb(0x5a3a26), 0.8), 0);
    mb.box(sx * (len - 0.13), h * 0.45, 0.06, 0.05, 0.05, 0.06, IC.brass, 0);
    mb.box(sx * (len - 0.13), h * 0.45, -0.06, 0.05, 0.05, 0.06, IC.brass, 0);
  }
  return new THREE.Mesh(mb.build(), G.litMat);
}
function addDoor(scene, R, kind, z, y0, width, height) {
  const half = kind === 'single' ? [[-width / 2, width, 1]] : [[-width / 2, width / 2, 1], [width / 2, width / 2, -1]];
  const D = { R, kind, leaves: [], z, center: rwp(R, 0, y0 + 1.2, z), angle: 0, vel: 0, target: 0, hold: 0, sgn: 1, wasOpen: false, inZone: false, meshes: [] };
  R.door = D;
  for (const [hx, len, dir] of half) {
    const pivot = new THREE.Group();
    pivot.position.copy(rwp(R, hx, y0, z));
    pivot.rotation.y = R.ry;
    const lm = doorLeafMesh(len, height, kind, dir); pivot.add(lm); D.meshes.push(lm);
    scene.add(pivot);
    D.leaves.push({ pivot, dir, angle: 0, vel: 0 });
  }
  DOORS.push(D);
  return D;
}

function buildInteriors(scene) {
  for (const R of ROOMS) {
    const mb = new MB(), rnd = mulberry32(1000 + R.idx * 77), nc = COLL.length;
    SEATCTX.R = R;
    FURNISH[R.type](mb, R, rnd);
    SEATCTX.R = null;
    if (R.upper) for (let i = nc; i < COLL.length; i++) if (COLL[i].top === undefined && COLL[i].y0 === undefined) COLL[i].top = R.ceilY - 0.2;
    if (R.parent) for (let i = nc; i < COLL.length; i++) if (COLL[i].y0 === undefined) COLL[i].y0 = R.floorY - 0.5;
    R.mat = makeIndoorMat(R);
    R.figMat = makeIndoorMat(R, true);
    R.mesh = new THREE.Mesh(mb.build(), R.mat);
    R.mesh.position.set(R.bx, 0, R.bz); R.mesh.rotation.y = R.ry;
    R.mesh.updateMatrix(); R.mesh.matrixAutoUpdate = false;
    R.mesh.visible = false;
    scene.add(R.mesh);
    if (R.doorKind) addDoor(scene, R, R.doorKind, R.doorZ, R.floorY, R.holeW || DOOR_W, R.doorH || (DOOR_H - R.floorY - 0.02));
  }
}

/* ---------- per frame: where are you, doors, exposure ---------- */
const ROOMSTATE = { cur: null, expo: 1 };
function roomAt(x, z, pad, y) {
  for (const R of ROOMS) {
    if (y !== undefined && (y < (R.lvMin === undefined ? -1e9 : R.lvMin) || y >= (R.lvMax === undefined ? 1e9 : R.lvMax))) continue;
    const [lx, lz] = rLocal(R, x, z);
    for (const r of R.rects) if (lx > r[0] - pad && lx < r[1] + pad && lz > r[2] - pad && lz < r[3] + pad) return R;
  }
  return null;
}
function updateRooms(dt) {
  const p = PLAY.pos;
  const cur = roomAt(p.x, p.z, 0, p.y);
  ROOMSTATE.cur = cur;
  G.room = cur;
  // interiors are drawn only where they can be seen; the two floors of a house see each other through the stairwell
  for (const R of ROOMS) {
    if (R.parent) { R.mesh.visible = cur === R || cur === R.parent; continue; }
    const dDoor = Math.hypot(p.x - R.doorW.x, p.z - R.doorW.z);
    R.mesh.visible = R === cur || dDoor < 18 || (cur && cur.parent === R);
  }
  // eyes: open up slowly in the dark, close down fast in the sun
  const target = cur ? (cur.expo || 2.5) : 1;
  const rate = target > ROOMSTATE.expo ? 0.6 : 1.5;
  ROOMSTATE.expo += (target - ROOMSTATE.expo) * (1 - Math.exp(-dt * rate));
  U.uBright.value = ROOMSTATE.expo;
  // the cowboy takes on the light of the room he stands in
  const cm = cur ? cur.figMat : G.litMat;
  if (W.ch.parts[0].material !== cm) for (const part of W.ch.parts) part.material = cm;
  // doors
  for (const D of DOORS) {
    const R = D.R;
    const m = R === cur ? R.figMat : G.litMat;
    if (D.meshes[0].material !== m) for (const dm of D.meshes) dm.material = m;
    const [lx, lz] = rLocal(R, p.x, p.z);
    const dz = lz - D.z;
    if (D.kind === 'saloon') {
      const inZone = Math.abs(lx) < 0.9 && Math.abs(dz) < 0.6;
      const vIn = -(PLAY.vx * R.s + PLAY.vz * R.c); // speed towards the inside
      for (const L of D.leaves) {
        if (inZone) {
          const push = Math.abs(vIn) > 0.2 ? Math.sign(vIn) : (dz > 0 ? 1 : -1);
          const tgt = push * 1.3 * (1 - Math.min(1, Math.abs(dz) / 0.6) * 0.4);
          const prev = L.angle;
          L.angle += (tgt - L.angle) * (1 - Math.exp(-dt * 16));
          L.vel = dt > 0 ? (L.angle - prev) / dt : 0;
        } else {
          L.vel += (-55 * L.angle - 2.4 * L.vel) * dt;
          const prev = L.angle;
          L.angle += L.vel * dt;
          if (Math.sign(prev) !== Math.sign(L.angle) && Math.abs(L.vel) > 1.2 && L === D.leaves[0]) AMB.saloonClack(D.center, Math.min(1, Math.abs(L.vel) / 6));
        }
        L.pivot.rotation.y = R.ry + L.dir * L.angle;
      }
      if (inZone && !D.inZone) AMB.saloonPush(D.center);
      D.inZone = inZone;
      continue;
    }
    const dist = Math.hypot(lx, dz);
    if (dist < 1.9 && Math.abs(p.y - R.floorY) < 1.2) {
      // a closed door swings away from whoever comes: inwards from the street, outwards from inside
      if (D.target === 0 && Math.abs(D.angle) < 0.3) D.sgn = dz >= 0 ? 1 : -1;
      D.target = 1.62 * D.sgn; D.hold = 0.7;
    } else if (dist > 2.7 || Math.abs(p.y - R.floorY) >= 1.2) { D.hold -= dt; if (D.hold <= 0) D.target = 0; }
    if (D.target !== 0 && !D.wasOpen) { D.wasOpen = true; AMB.doorOpen(D.center); }
    const prev = D.angle;
    D.vel += (40 * (D.target - D.angle) - 11 * D.vel) * dt;
    D.angle = clamp(D.angle + D.vel * dt, -1.7, 1.7);
    if (D.target === 0 && D.wasOpen && Math.abs(D.angle) < 0.03 && Math.abs(prev) >= 0.03) { D.wasOpen = false; D.angle = 0; D.vel = 0; AMB.doorClose(D.center); }
    for (const L of D.leaves) L.pivot.rotation.y = R.ry + L.dir * D.angle;
  }
}
