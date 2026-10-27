function barn(mb, b, R) {
  const wall = rgb(b.wall), w = b.w, d = b.d, h = b.h, t = 0.2;
  mb.box(0, 0, -d + t / 2, w, h, t, wall, 3, { ao: 0.22 });
  mb.box(-w / 2 + t / 2, 0, -d / 2, t, h, d, wall, 3, { ao: 0.22 });
  mb.box(w / 2 - t / 2, 0, -d / 2, t, h, d, wall, 3, { ao: 0.22 });
  frontWallWithDoor(mb, w, h, -t, 0, wall, 3, 4.4, 3.6);
  rColl(R, -w / 2, w / 2, -d, -d + t, h); rColl(R, -w / 2, -w / 2 + t, -d, 0, h); rColl(R, w / 2 - t, w / 2, -d, 0, h);
  rColl(R, -w / 2, -2.2, -t, 0, h); rColl(R, 2.2, w / 2, -t, 0, h);
  Object.assign(R, { floorCol: rgb(0x7a5a3a), floorTop: rgb(0x9a7a4e), floorTile: 1, x0: -w / 2 + t, x1: w / 2 - t, z0: -d + t, z1: -t, floorY: 0.02, ceilY: h - 0.12, doorZ: -t / 2, holeW: 4.4, holeH: 3.6, doorLight: 5, expo: 2.2, w, d });
  R.rects.push([R.x0, R.x1, R.z0, R.z1]);
  mb.gable(0, b.h, -b.d / 2, b.w + 0.8, b.d + 0.6, 3.6, COL.roof, 5, wall);
  // the big doors stand wide open against the front, white X braces facing the street
  for (const s of [-1, 1]) {
    mb.push(new THREE.Matrix4().makeTranslation(s * 2.2, 0, 0.06).multiply(new THREE.Matrix4().makeRotationY(s * 1.72)));
    mb.box(-s * 1.1, 0.02, 0, 2.2, 3.56, 0.12, mulc(wall, 0.82), 3);
    mb.push(new THREE.Matrix4().makeTranslation(-s * 1.1, 1.8, s * 0.07 * 0 + 0.07));
    mb.box(0, -1.7, 0, 2.0, 0.16, 0.06, COL.trim, 0); mb.box(0, 1.55, 0, 2.0, 0.16, 0.06, COL.trim, 0);
    mb.push(new THREE.Matrix4().makeRotationZ(0.98)); mb.box(0, -0.08, 0, 3.9, 0.16, 0.06, COL.trim, 0); mb.pop();
    mb.push(new THREE.Matrix4().makeRotationZ(-0.98)); mb.box(0, -0.08, 0, 3.9, 0.16, 0.06, COL.trim, 0); mb.pop();
    mb.pop();
    mb.pop();
    rColl(R, s < 0 ? -2.35 : 2.05, s < 0 ? -2.05 : 2.35, 0, 2.3, 3.6);
  }
  mb.box(0, 3.6, 0.1, 4.6, 0.18, 0.1, COL.trim, 0);
  // hay loft door + beam
  mb.box(0, 4.0, 0.06, 1.6, 1.4, 0.12, rgb(0x2a1b14), 0);
  mb.box(0, 7.7, 0.9, 0.25, 0.25, 1.4, COL.woodDark, 3);
  painted(mb, 0, 5.95, 0.31, 5.2, 1.3, wall, 6); // painted on the gable
  mb.box(0, 0, 1.6, b.w + 0.4, 0.04, 3.2, COL.earth, 0);
}

function church(mb, R) {
  const w = 9, d = 14, h = 6.4, white = COL.white, t = 0.2;
  mb.box(0, 0, -d + t / 2, w, h, t, white, 4, { ao: 0.2 });
  mb.box(-w / 2 + t / 2, 0, -d / 2, t, h, d, white, 4, { ao: 0.2 });
  mb.box(w / 2 - t / 2, 0, -d / 2, t, h, d, white, 4, { ao: 0.2 });
  frontWallWithDoor(mb, w, h, -t, 0, white, 4, 2.2, 3.2);
  // steeple base: a small entrance hall
  for (const s of [-1, 1]) mb.box(s * 1.6, 0, 1.3, 0.2, 3.3, 2.6, white, 4, { ao: 0.2 });
  frontWallWithDoor(mb, 3.4, 3.3, 2.4, 2.6, white, 4, 1.8, 3.2);
  mb.box(0, 0, 2.5, 1.8, 0.3, 0.2, rgb(0x8a6446), 2, { top: rgb(0x9a7050), tileTop: 2 });
  doorFrame(mb, 2.68, 0.3, COL.trim, 1.8, 3.2);
  rColl(R, -w / 2, w / 2, -d, -d + t, h); rColl(R, -w / 2, -w / 2 + t, -d, 0, h); rColl(R, w / 2 - t, w / 2, -d, 0, h);
  rColl(R, -w / 2, -1.1, -t, 0, h); rColl(R, 1.1, w / 2, -t, 0, h);
  rColl(R, -1.7, -1.5, 0, 2.6, 6); rColl(R, 1.5, 1.7, 0, 2.6, 6); rColl(R, -1.7, -0.9, 2.4, 2.6, 6); rColl(R, 0.9, 1.7, 2.4, 2.6, 6);
  rPlat(R, -w / 2 + t, w / 2 - t, -d + t, -t, 0.3); rPlat(R, -1.5, 1.5, -t, 2.6, 0.3);
  Object.assign(R, { x0: -4.3, x1: 4.3, z0: -13.8, z1: 2.4, floorY: 0.3, ceilY: 6.2, doorZ: 2.5, holeW: 1.8, doorH: 2.88, doorKind: 'double', doorLight: 3, expo: 2.2, amb: 0xfff0d8 });
  R.rects.push([-4.3, 4.3, -13.8, -0.2], [-1.5, 1.5, -0.2, 2.4]);
  R.wins.push({ wall: 'r', u: -3, y: 2.0, w: 0.9, h: 2.6 }, { wall: 'l', u: -7, y: 2.0, w: 0.9, h: 2.6 }, { wall: 'r', u: -11, y: 2.0, w: 0.9, h: 2.6 });
  mb.gable(0, h, -d / 2, w + 0.8, d + 0.6, 3.4, rgb(0x4b4c55), 5, white);
  // steeple
  mb.box(0, 3.3, 1.3, 3.4, h + 4.4 - 3.3, 2.6, white, 4, { ao: 0.2 });
  mb.box(0, h + 4.4, 0.9, 3.9, 0.35, 3.9, COL.trim, 0);
  mb.box(0, h + 4.75, 0.9, 2.6, 2.0, 2.6, white, 4);
  mb.box(0, h + 5.3, 0.9, 1.4, 1.2, 2.7, rgb(0x2b2a2e), 0);
  mb.box(0, h + 5.3, 0.9, 2.7, 1.2, 1.4, rgb(0x2b2a2e), 0);
  mb.cyl(0, h + 6.75, 0.9, 1.95, 0, 5.2, 4, rgb(0x4b4c55), 5, { rot: Math.PI / 4 });
  mb.box(0, h + 11.9, 0.9, 0.16, 1.5, 0.16, rgb(0x3b3532), 0);
  mb.box(0, h + 12.75, 0.9, 0.85, 0.16, 0.16, rgb(0x3b3532), 0);
  // door, round window
  mb.box(0, 4.2, 2.62, 1.1, 1.1, 0.1, COL.glass, 0, { faceUV: 'pz', tilePz: 12 });
  // steps
  mb.box(0, 0, 3.4, 3.4, 0.3, 1.2, COL.stone, 0);
  // side windows
  for (const s of [1, -1]) {
    mb.push(new THREE.Matrix4().makeTranslation(s * w / 2, 0, -d / 2).multiply(new THREE.Matrix4().makeRotationY(s * Math.PI / 2)));
    for (const o of [-4, 0, 4]) windowAt(mb, o, 2.0, 0.9, 2.6, COL.trim);
    mb.pop();
  }
}

function waterTower(mb, x, z) {
  const y = 0, H = 7;
  mb.at(x, y, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.beam([sx * 2.0, 0, sz * 2.0], [sx * 1.6, H, sz * 1.6], 0.32, COL.woodDark, 3);
  for (const lv of [2.2, 4.8]) {
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
      const k = 2.0 - (lv / H) * 0.4;
      mb.beam([a[0] * k, lv, a[1] * k], [b[0] * k, lv + 1.2, b[1] * k], 0.14, COL.wood, 3);
    }
  }
  mb.box(0, H, 0, 5.2, 0.28, 5.2, COL.wood, 2);
  mb.cyl(0, H + 0.28, 0, 2.45, 2.45, 3.6, 14, rgb(0x9a6b45), 3, { top: COL.roof });
  for (const by of [0.5, 1.8, 3.1]) mb.cyl(0, H + 0.28 + by, 0, 2.5, 2.5, 0.14, 14, COL.iron, 0, { noTop: true });
  mb.cyl(0, H + 3.88, 0, 2.75, 0.05, 1.5, 14, COL.roof, 5);
  mb.beam([2.4, H + 1.2, 0], [3.2, H - 1.4, 0], 0.22, COL.iron, 0);
  mb.pop();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addCircColl(x + sx * 1.95, z + sz * 1.95, 0.32);
  CAMBLOCK.push({ x0: x - 2.8, x1: x + 2.8, z0: z - 2.8, z1: z + 2.8, y0: H, y1: H + 5.5 });
}

function windmillTower(mb, x, y, z) {
  const H = 10;
  mb.at(x, y, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.beam([sx * 1.7, -0.3, sz * 1.7], [sx * 0.32, H, sz * 0.32], 0.2, COL.woodDark, 3);
  for (const lv of [2.5, 5.2, 7.6]) {
    const k = 1.7 - (lv / H) * 1.38;
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
      mb.beam([a[0] * k, lv, a[1] * k], [b[0] * k, lv, b[1] * k], 0.12, COL.wood, 3);
    }
  }
  mb.box(0, H, 0, 1.3, 0.2, 1.3, COL.wood, 2);
  mb.box(0, H + 0.2, -0.2, 0.42, 0.42, 1.3, COL.iron, 0);
  mb.box(0, H + 0.1, -2.0, 0.12, 1.0, 2.2, rgb(0xd8cbb2), 0);
  mb.pop();
  addCircColl(x, z, 1.5);
}

function buildRotor() {
  const mb = new MB();
  const blades = 16;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU;
    mb.push(new THREE.Matrix4().makeRotationZ(a).multiply(new THREE.Matrix4().makeRotationY(0.35)));
    mb.box(0, 0.45, 0, 0.36, 1.85, 0.04, rgb(0xd9ccb2), 0, { bottom: true });
    mb.pop();
  }
  mb.push(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  mb.cyl(0, -0.15, 0, 0.28, 0.28, 0.42, 8, COL.iron, 0, { bottom: true });
  mb.pop();
  return mb.build();
}

function wagon(mb, x, z, ry) {
  mb.at(x, 0, z, ry);
  mb.box(0, 0.75, 0, 4.0, 0.55, 1.7, COL.wood, 2, { bottom: true });
  mb.box(0, 1.3, 0.8, 4.0, 0.35, 0.1, COL.woodLight, 2); mb.box(0, 1.3, -0.8, 4.0, 0.35, 0.1, COL.woodLight, 2);
  // canvas cover (half barrel)
  const R = 1.0, seg = 7, L = 3.4;
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI, a1 = ((k + 1) / seg) * Math.PI;
    const p = (a, xx) => [xx, 1.55 + Math.sin(a) * R, Math.cos(a) * R];
    mb.quad(p(a0, -L / 2), p(a0, L / 2), p(a1, L / 2), p(a1, -L / 2), COL.canvas, 9);
  }
  // end hoops darker
  mb.push(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  for (const [wx, r] of [[-1.35, 0.78], [1.45, 0.62]]) {
    for (const s of [1, -1]) {
      mb.push(new THREE.Matrix4().makeTranslation(wx, s * 0.95, -r));
      mb.cyl(0, -0.06, 0, r, r, 0.12, 10, COL.woodDark, 0, { bottom: true });
      mb.pop();
    }
  }
  mb.pop();
  mb.beam([2.0, 0.85, 0], [4.2, 0.4, 0], 0.12, COL.woodDark, 0);
  mb.pop();
  const c = Math.cos(ry), s = Math.sin(ry);
  addBoxColl(x, z, 2.4 * Math.abs(c) + 1.1 * Math.abs(s), 2.4 * Math.abs(s) + 1.1 * Math.abs(c), 0, 2.6);
}

function barrel(mb, x, z, y) {
  mb.cyl(x, y || 0, z, 0.4, 0.4, 1.0, 9, rgb(0x8a5a38), 3, { top: rgb(0x6b4630), ao: 0.15 });
  mb.cyl(x, (y || 0) + 0.18, z, 0.43, 0.43, 0.08, 9, COL.iron, 0, { noTop: true });
  mb.cyl(x, (y || 0) + 0.74, z, 0.43, 0.43, 0.08, 9, COL.iron, 0, { noTop: true });
  addCircColl(x, z, 0.45);
}

function fenceLine(mb, x0, z0, x1, z1, gap) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2.4));
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    const px = x0 + ux * t, pz = z0 + uz * t;
    if (gap && t > gap[0] - 0.1 && t < gap[1] + 0.1 && i !== 0 && i !== n) continue;
    mb.box(px, surfaceHeight(px, pz) - 0.2, pz, 0.2, 1.6, 0.2, COL.woodDark, 3);
  }
  const segs = gap ? [[0, gap[0]], [gap[1], len]] : [[0, len]];
  for (const [a, b] of segs) {
    if (b - a < 0.5) continue;
    for (const hy of [0.65, 1.15]) {
      const pa = [x0 + ux * a, 0, z0 + uz * a], pb = [x0 + ux * b, 0, z0 + uz * b];
      pa[1] = surfaceHeight(pa[0], pa[2]) + hy; pb[1] = surfaceHeight(pb[0], pb[2]) + hy;
      mb.beam(pa, pb, 0.1, COL.wood, 3);
    }
    const cx = x0 + ux * (a + b) / 2, cz = z0 + uz * (a + b) / 2;
    COLL.push({ cx, cz, hx: (b - a) / 2, hz: 0.12, a: -Math.atan2(uz, ux), h: 1.3 });
  }
}

function buildTown() {
  const mb = new MB(), poles = [];
  const place = (b) => {
    const ry = b.side === 'n' ? 0 : Math.PI;
    const fz = b.side === 'n' ? NORTH_Z : SOUTH_Z;
    const R = roomFrame(b.type, b.x, fz, ry);
    if (b.two) { R.upper = roomFrame(b.type + 'Up', b.x, fz, ry); R.upper.parent = R; }
    mb.at(b.x, 0, fz, ry);
    let front = 0;
    if (b.barn) barn(mb, b, R); else { front = storefront(mb, b, R); R.doorKind = b.saloon ? 'saloon' : 'single'; R.doorH = DOOR_H - 0.37; }
    const coll = (lx, lz, r) => { const p = worldRect(b.x, fz, ry, lx, lx, lz, lz); addCircColl(p.cx, p.cz, r); };
    coll.rect = (x0, x1, z0, z1, h) => COLL.push(Object.assign(worldRect(b.x, fz, ry, x0, x1, z0, z1), { h: h || 1 }));
    const pl = [];
    decorate(mb, b, front, coll, pl);
    for (const [lx, ly, lz] of pl) { const p = worldRect(b.x, fz, ry, lx, lx, lz, lz); poles.push(new THREE.Vector3(p.cx, ly, p.cz)); }
    mb.pop();
    R.doorW = rwp(R, 0, 0, R.doorZ);
    if (R.upper) R.upper.doorW = R.doorW;
    const body = worldRect(b.x, fz, ry, -b.w / 2, b.w / 2, -b.d, front);
    const top = Math.max(b.h + (b.flat ? 1.2 : b.pitch || 1.8), b.front ? crownTop(b) : 0);
    CAMBLOCK.push({ x0: body.cx - body.hx, x1: body.cx + body.hx, z0: body.cz - body.hz, z1: body.cz + body.hz, y0: -5, y1: top, room: R.idx });
    if (!b.barn) {
      const pr = worldRect(b.x, fz, ry, -b.w / 2 - 0.2, b.w / 2 + 0.2, front, front + 2.7);
      // porch roofs, balconies and awnings keep the camera out from under them
      if (b.two || b.porch === 'awning' || porchHasPosts(b)) {
        const rr = worldRect(b.x, fz, ry, -b.w / 2 - 0.3, b.w / 2 + 0.3, front, front + 3.0);
        CAMBLOCK.push({ x0: rr.cx - (ry ? rr.hx : rr.hx), x1: rr.cx + rr.hx, z0: rr.cz - rr.hz, z1: rr.cz + rr.hz, y0: 2.3, y1: b.two ? 4.6 : 3.4 });
      }
      addPlat(pr.cx, pr.cz, pr.hx, pr.hz, 0, 0.35);
      // porch posts
      const n = Math.max(2, Math.round(b.w / 4.2));
      for (let i = 0; i <= (porchHasPosts(b) ? n : -1); i++) {
        if (Math.abs(-b.w / 2 + (b.w * i) / n) < 1.2) continue;
        const p = worldRect(b.x, fz, ry, -b.w / 2 + (b.w * i) / n, -b.w / 2 + (b.w * i) / n, front + 2.5, front + 2.5);
        addCircColl(p.cx, p.cz, 0.16);
      }
    }
  };
  for (const b of BUILDINGS) if (!b.late) place(b);
  // church at the west end of the street, facing east
  const CR = roomFrame('church', -51, 2, Math.PI / 2);
  mb.at(-51, 0, 2, Math.PI / 2); church(mb, CR); mb.pop();
  CR.doorW = rwp(CR, 0, 0, CR.doorZ);
  addPlat(-47.8, 2, 0.7, 1.75, 0, 0.3);
  CAMBLOCK.push({ x0: -65, x1: -51, z0: -2.5, z1: 6.5, y0: -5, y1: 9.8, room: CR.idx });
  CAMBLOCK.push({ x0: -51, x1: -48.4, z0: 0.3, z1: 3.7, y0: -5, y1: 17, room: CR.idx });
  for (const b of BUILDINGS) if (b.late) place(b);

  waterTower(mb, 34, 16);
  const wmx = 47, wmz = -27, wmy = surfaceHeight(wmx, wmz);
  windmillTower(mb, wmx, wmy, wmz);
  wagon(mb, 29.5, 3.4, 0.08);
  // barrels & crates
  barrel(mb, -38.8, -2.3); barrel(mb, -38.0, -1.7); barrel(mb, -27.2, -2.4);
  barrel(mb, -24.8, -4.7, 0.35); barrel(mb, 14.5, 7.4); barrel(mb, 15.3, 6.9);
  for (const [cx, cz, s] of [[2.6, 6.7, 0.9], [3.5, 6.85, 0.75], [2.9, 6.6, 0.6]]) {
    const y = cx === 2.9 ? 0.9 : 0;
    mb.box(cx, y, cz, s, s, s, COL.woodLight, 3, { ao: 0.15 });
    if (!y) addCircColl(cx, cz, s * 0.6);
  }
  // hitching rails
  for (const [x0, x1, z] of [[-24.5, -18.5, -1.7], [3.5, 9.5, -1.7], [-14, -9, 5.8]]) {
    mb.box(x0, 0, z, 0.2, 1.15, 0.2, COL.woodDark, 3); mb.box(x1, 0, z, 0.2, 1.15, 0.2, COL.woodDark, 3);
    mb.beam([x0, 1.05, z], [x1, 1.05, z], 0.12, COL.wood, 3);
    addBoxColl((x0 + x1) / 2, z, (x1 - x0) / 2 + 0.1, 0.12, 0, 1.1);
  }
  // water troughs
  for (const [tx, tz] of [[-27.5, 6.0], [-12.0, -2.0]]) {
    mb.box(tx, 0, tz, 2.4, 0.7, 0.85, COL.wood, 2, { top: COL.water, tileTop: 0, ao: 0.15 });
    addBoxColl(tx, tz, 1.25, 0.45, 0, 0.7);
  }
  // corral behind the livery
  fenceLine(mb, -38, 17, -22, 17, [7, 10.5]);
  fenceLine(mb, -22, 17, -22, 29);
  fenceLine(mb, -22, 29, -38, 29);
  fenceLine(mb, -38, 29, -38, 17);
  for (const [hx, hz] of [[-35, 26.5], [-33.6, 26.6], [-34.3, 26.5]]) {
    const hy = hx === -34.3 ? 0.8 : 0;
    mb.box(hx, surfaceHeight(hx, hz) + hy - 0.05, hz, 1.25, 0.82, 0.85, COL.hay, 23, { ao: 0.12 });
  }
  addBoxColl(-34.3, 26.5, 1.4, 0.5, 0, 1.6);
  mb.box(-25, surfaceHeight(-25, 20), 20, 2.2, 0.65, 0.8, COL.wood, 2, { top: COL.water, tileTop: 0 });
  addBoxColl(-25, 20, 1.15, 0.45, 0, 0.7);
  // graveyard beside the church
  const graves = [[-60, 11.5], [-62.5, 12.2], [-65, 11.4], [-60.5, 15], [-63.3, 15.3], [-66, 14.8]];
  for (const [gx, gz] of graves) {
    const gy = surfaceHeight(gx, gz);
    mb.box(gx, gy - 0.1, gz + 0.9, 0.9, 0.28, 1.7, COL.earth, 1);
    mb.box(gx, gy, gz, 0.14, 1.35, 0.14, rgb(0x6e5440), 3);
    mb.box(gx, gy + 0.85, gz, 0.72, 0.13, 0.13, rgb(0x6e5440), 3);
  }
  fenceLine(mb, -68, 9.5, -57, 9.5, [4.5, 6.5]);
  // bridge over the dry creek
  let bx = 74;
  for (let k = 0; k < 6; k++) bx = creekX(roadZ(bx));
  const bz = roadZ(bx), ang = Math.atan(roadSlope(bx));
  const deckY = (heightNoCreek(bx - 8, roadZ(bx - 8)) + heightNoCreek(bx + 8, roadZ(bx + 8))) / 2 + 0.25;
  mb.push(new THREE.Matrix4().makeTranslation(bx, deckY, bz).multiply(new THREE.Matrix4().makeRotationY(-ang)));
  mb.box(0, -0.35, 0, 18, 0.35, 5.6, COL.wood, 2, { top: COL.plank, tileTop: 2, bottom: true });
  for (let i = -4; i <= 4; i++) {
    for (const s of [-1, 1]) mb.box(i * 2.2, 0, s * 2.65, 0.18, 1.2, 0.18, COL.woodDark, 3);
  }
  for (const s of [-1, 1]) {
    mb.box(0, 1.05, s * 2.65, 18, 0.14, 0.16, COL.wood, 3);
    mb.box(0, 0.55, s * 2.65, 18, 0.1, 0.12, COL.wood, 3);
  }
  for (const sx of [-5.5, 0, 5.5]) for (const s of [-1, 1]) mb.box(sx, -4.5, s * 2.2, 0.3, 4.2, 0.3, COL.woodDark, 3);
  mb.pop();
  addPlat(bx, bz, 9.2, 2.9, -ang, deckY);
  for (const s of [-1, 1]) {
    const ox = -Math.sin(-ang) * 0 + s * 2.75 * Math.sin(ang) * -1, oz = s * 2.75 * Math.cos(ang);
    COLL.push({ cx: bx + ox, cz: bz + oz, hx: 9, hz: 0.15, a: -ang, h: 1.2, y0: deckY - 0.5 });
  }
  return { geo: mb.build(), poles, rotorPos: new THREE.Vector3(wmx, wmy + 10.4, wmz + 0.52), bridge: { x: bx, z: bz, y: deckY } };
}
