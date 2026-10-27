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
// the doors of the rooms on the upper floors (rooms one can rent and sleep in, see ui/sleep.js)
const ROOM_DOORS = [];
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
      ROOM_DOORS.push({ R: U, x: dx, z: dz, alongX, k });
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

/* ---------- build the interiors, doors and the indoor material ---------- */
function makeIndoorMat(R, forFigure) {
  // the lanterns of the room (the first four), lighting it at night
  const lamps = (R.lamps || []).slice(0, 4).map((l) => new THREE.Vector4(l.x, l.y, l.z, l.k));
  while (lamps.length < 4) lamps.push(new THREE.Vector4(0, -100, 0, 0));
  const u = Object.assign({}, U, { uOpen: { value: lightOpenings(R) }, uRoomAmb: { value: v3(R.amb || 0xffd9a8, 0.1) }, uRoomLamp: { value: lamps },
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
    R.mesh.visible = R === cur || dDoor < 18 || (!!cur && cur.parent === R);
  }
  // eyes: open up slowly in the dark, close down fast in the sun
  const target = cur ? (cur.expo || 2.5) : DAYNIGHT.expo;
  const rate = target > ROOMSTATE.expo ? 0.6 : 1.5;
  ROOMSTATE.expo += (target - ROOMSTATE.expo) * (1 - Math.exp(-dt * rate));
  U.uBright.value = ROOMSTATE.expo;
  // the cowboy takes on the light of the room he stands in
  const cm = cur ? cur.figMat : G.litMat;
  if (W.ch.parts[0].material !== cm) for (const part of W.ch.parts) part.material = cm;
  // doors: they open for the player and for anyone else walking through
  for (const D of DOORS) {
    const R = D.R;
    const m = R === cur ? R.figMat : G.litMat;
    if (D.meshes[0].material !== m) for (const dm of D.meshes) dm.material = m;
    let [lx, lz] = rLocal(R, p.x, p.z), py = p.y, vx = PLAY.vx, vz = PLAY.vz;
    // the closest person to this door, if nearer than the player
    let best = Math.hypot(lx, lz - D.z);
    for (const N of NPCS.list) {
      if (N.hp.down()) continue;
      const [nx, nz] = rLocal(R, N.pos.x, N.pos.z), dd = Math.hypot(nx, nz - D.z);
      if (dd < best && dd < 2.2) { best = dd; lx = nx; lz = nz; py = N.pos.y; vx = N.vx; vz = N.vz; }
    }
    const dz = lz - D.z;
    if (D.kind === 'saloon') {
      const inZone = Math.abs(lx) < 0.9 && Math.abs(dz) < 0.6;
      const vIn = -(vx * R.s + vz * R.c); // speed towards the inside
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
    if (dist < 1.9 && Math.abs(py - R.floorY) < 1.2) {
      // a closed door swings away from whoever comes: inwards from the street, outwards from inside
      if (D.target === 0 && Math.abs(D.angle) < 0.3) D.sgn = dz >= 0 ? 1 : -1;
      D.target = 1.62 * D.sgn; D.hold = 0.7;
    } else if (dist > 2.7 || Math.abs(py - R.floorY) >= 1.2) { D.hold -= dt; if (D.hold <= 0) D.target = 0; }
    if (D.target !== 0 && !D.wasOpen) { D.wasOpen = true; AMB.doorOpen(D.center); }
    const prev = D.angle;
    D.vel += (40 * (D.target - D.angle) - 11 * D.vel) * dt;
    D.angle = clamp(D.angle + D.vel * dt, -1.7, 1.7);
    if (D.target === 0 && D.wasOpen && Math.abs(D.angle) < 0.03 && Math.abs(prev) >= 0.03) { D.wasOpen = false; D.angle = 0; D.vel = 0; AMB.doorClose(D.center); }
    for (const L of D.leaves) L.pivot.rotation.y = R.ry + L.dir * D.angle;
  }
}
