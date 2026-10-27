/* lettering: a framed board, or paint straight on a surface (the box takes the surface colour) */
function signBoard(mb, x, y, z, w, h, col, idx, frame) {
  if (frame) mb.box(x, y - 0.07, z - 0.05, w + 0.18, h + 0.14, 0.1, frame, 0);
  mb.box(x, y, z, w, h, 0.1, col, 0, { faceUV: 'pz', tilePz: 32 + idx });
}
function painted(mb, x, y, z, w, h, col, idx) { mb.box(x, y, z, w, h, 0.02, col, 0, { faceUV: 'pz', tilePz: 32 + idx }); }
function pistolSign(mb, x, f) {
  const iron = rgb(0x3a3634), steel = rgb(0x6a6662), wood = rgb(0x6b3f22);
  mb.box(x, 3.4, f + 1.05, 0.06, 0.06, 2.1, COL.iron, 0, { bottom: true });
  mb.beam([x, 2.9, f + 0.02], [x, 3.4, f + 0.6], 0.05, COL.iron, 0);
  for (const z of [f + 0.75, f + 1.85]) mb.box(x, 3.15, z, 0.025, 0.25, 0.025, COL.iron, 0);
  mb.box(x, 3.0, f + 1.45, 0.08, 0.15, 1.15, steel, 0, { bottom: true });      // barrel
  mb.box(x, 2.92, f + 1.25, 0.07, 0.07, 0.7, iron, 0, { bottom: true });       // ejector rod
  mb.box(x, 2.84, f + 0.78, 0.14, 0.36, 0.5, iron, 0, { bottom: true });       // frame and cylinder
  mb.box(x, 3.16, f + 0.56, 0.07, 0.13, 0.12, iron, 0, { bottom: true });      // hammer
  mb.box(x, 3.15, f + 2.0, 0.05, 0.05, 0.05, steel, 0);                        // sight
  mb.beam([x, 2.98, f + 0.62], [x, 2.38, f + 0.33], 0.22, wood, 0);           // grip
  mb.beam([x, 2.84, f + 0.98], [x, 2.7, f + 0.92], 0.04, iron, 0);            // trigger
  mb.beam([x, 2.84, f + 0.82], [x, 2.66, f + 0.95], 0.035, iron, 0);
  mb.beam([x, 2.66, f + 0.95], [x, 2.84, f + 1.1], 0.035, iron, 0);
}
function hotelSign(mb, x, f) {
  const red = rgb(0x6e1f1c), zc = f + 0.78;
  for (const y of [5.0, 7.9]) mb.box(x - 0.08, y, f + 0.25, 0.06, 0.06, 0.5, COL.iron, 0, { bottom: true });
  mb.box(x, 4.62, zc, 0.12, 3.75, 0.9, mulc(red, 0.75), 0, { bottom: true });
  for (let k = 0; k < 5; k++) mb.box(x, 7.62 - k * 0.7, zc, 0.18, 0.62, 0.72, red, 0, { faceUV: 'px nx', tilePx: 66 + k, tileNx: 66 + k, bottom: true });
  mb.box(x, 8.37, zc, 0.16, 0.08, 0.96, GOLD, 0);
}
function wallLantern(mb, x, y, z) {
  mb.box(x, y + 0.42, z - 0.12, 0.05, 0.05, 0.3, COL.iron, 0, { bottom: true });
  mb.box(x, y, z, 0.2, 0.32, 0.2, rgb(0xffcf7a), 0, { bottom: true });
  mb.box(x, y + 0.32, z, 0.26, 0.08, 0.26, COL.iron, 0);
  mb.box(x, y - 0.05, z, 0.24, 0.05, 0.24, COL.iron, 0, { bottom: true });
}

/* flat star / badge: pts in the x-y plane (CCW), extruded from z0 to z1 */
function prism(mb, pts, cx, cy, z0, z1, col) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    mb.tri([cx, cy, z1], [cx + a[0], cy + a[1], z1], [cx + b[0], cy + b[1], z1], col, 0);
    mb.tri([cx, cy, z0], [cx + b[0], cy + b[1], z0], [cx + a[0], cy + a[1], z0], mulc(col, 0.8), 0);
    mb.quad([cx + a[0], cy + a[1], z1], [cx + a[0], cy + a[1], z0], [cx + b[0], cy + b[1], z0], [cx + b[0], cy + b[1], z1], mulc(col, 0.88), 0);
  }
}
function sheriffStar(mb, x, y, z, R) {
  const pts = [];
  for (let i = 0; i < 12; i++) { const a = Math.PI / 2 + (i * Math.PI) / 6, r = i % 2 ? R * 0.55 : R; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  prism(mb, pts, x, y, z - 0.06, z + 0.06, GOLD);
  for (let i = 0; i < 12; i += 2) mb.box(x + pts[i][0] * 1.04, y + pts[i][1] * 1.04 - 0.07, z, 0.14, 0.14, 0.15, GOLD, 0, { bottom: true });
  const ring = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ring.push([Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3]); }
  prism(mb, ring, x, y, z + 0.06, z + 0.1, mulc(GOLD, 0.82));
}
function horseshoe(mb, x, y, z, r) {
  const col = rgb(0x9c968e), pts = [];
  for (let i = 0; i <= 9; i++) { const a = (125 + (i / 9) * 290) * DEG; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z]); }
  for (let i = 0; i < 9; i++) mb.beam(pts[i], pts[i + 1], r * 0.32, col, 0);
}
function rifle(mb, y, z) {
  const wood = rgb(0x6b3f22), iron = rgb(0x34302e), brass = rgb(0xc59a3e);
  mb.box(-1.55, y - 0.2, z, 0.62, 0.34, 0.1, wood, 0, { bottom: true });       // butt
  mb.beam([-1.25, y - 0.02, z], [-0.72, y + 0.06, z], 0.13, wood, 0);           // wrist
  mb.box(-0.48, y - 0.06, z, 0.5, 0.24, 0.12, brass, 0, { bottom: true });      // receiver
  mb.box(0.55, y + 0.1, z, 2.1, 0.08, 0.08, iron, 0, { bottom: true });        // barrel
  mb.box(0.3, y - 0.01, z, 1.55, 0.08, 0.08, iron, 0, { bottom: true });       // magazine tube
  mb.box(0.05, y - 0.04, z + 0.01, 0.75, 0.13, 0.11, wood, 0, { bottom: true }); // fore-end
  mb.box(1.56, y + 0.18, z, 0.05, 0.07, 0.05, iron, 0);                         // front sight
  for (const [a, b] of [[[-0.6, y - 0.07], [-0.66, y - 0.3]], [[-0.66, y - 0.3], [-0.38, y - 0.33]], [[-0.38, y - 0.33], [-0.32, y - 0.08]]]) mb.beam([a[0], a[1], z], [b[0], b[1], z], 0.04, iron, 0);
  for (const bx of [-0.9, 0.9]) mb.box(bx, y - 0.32, z - 0.08, 0.1, 0.5, 0.1, COL.woodDark, 0, { bottom: true });
}
function envelope(mb, y, z) {
  const paper = rgb(0xf0e6cf), ink = rgb(0x5a4a3c);
  mb.box(0, y - 0.47, z - 0.03, 1.54, 0.94, 0.06, COL.woodDark, 0);
  mb.box(0, y - 0.42, z, 1.44, 0.84, 0.06, paper, 0);
  mb.beam([-0.68, y + 0.38, z + 0.04], [0, y - 0.1, z + 0.04], 0.035, ink, 0);
  mb.beam([0.68, y + 0.38, z + 0.04], [0, y - 0.1, z + 0.04], 0.035, ink, 0);
  mb.push(new THREE.Matrix4().makeTranslation(0, y - 0.1, z + 0.02).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
  mb.cyl(0, 0, 0, 0.13, 0.13, 0.06, 8, rgb(0xa3271f), 0);
  mb.pop();
}
function mortar(mb, y, z) {
  const stone = rgb(0xe2dbcc);
  mb.cyl(0, y, z, 0.42, 0.42, 0.08, 10, mulc(stone, 0.85), 0);
  mb.cyl(0, y + 0.08, z, 0.3, 0.55, 0.5, 10, stone, 0, { top: rgb(0x6d5a48) });
  mb.cyl(0, y + 0.55, z, 0.58, 0.58, 0.06, 10, mulc(stone, 0.92), 0, { top: rgb(0x6d5a48) });
  mb.beam([-0.1, y + 0.4, z], [0.42, y + 1.15, z], 0.13, rgb(0xb9a58a), 0);
  mb.cyl(0.42, y + 1.08, z, 0.1, 0.1, 0.16, 8, rgb(0xb9a58a), 0);
}
function showGlobe(mb, x, z, col) {
  mb.box(x, 2.62, z, 0.03, 0.62, 0.03, COL.iron, 0);
  mb.box(x, 2.55, z, 0.12, 0.08, 0.12, COL.iron, 0);
  mb.push(new THREE.Matrix4().makeTranslation(x, 2.28, z));
  mb.geo(new THREE.IcosahedronGeometry(0.28, 1), col, 0);
  mb.pop();
  mb.cyl(x, 1.95, z, 0.06, 0.1, 0.1, 6, GOLD, 0);
}
function porchCrate(mb, x, y, z, s, coll) {
  mb.box(x, y, z, s, s, s, COL.woodLight, 3, { ao: 0.15 });
  mb.box(x, y + s * 0.45, z + s / 2, s, 0.08, 0.02, COL.woodDark, 0);
  if (coll) coll(x, z, s * 0.62);
}
function porchSack(mb, x, y, z, ry) {
  mb.push(new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry)));
  mb.box(0, 0, 0, 0.55, 0.42, 0.38, rgb(0xcdb68a), 9, { ao: 0.12 });
  mb.box(0, 0.42, 0, 0.4, 0.12, 0.28, rgb(0xbfa778), 9);
  mb.pop();
}
function porchBarrel(mb, x, y, z, coll) {
  mb.cyl(x, y, z, 0.36, 0.36, 0.9, 9, rgb(0x8a5a38), 3, { top: rgb(0x6b4630), ao: 0.15 });
  for (const h of [0.15, 0.68]) mb.cyl(x, y + h, z, 0.39, 0.39, 0.07, 9, COL.iron, 0, { noTop: true });
  if (coll) coll(x, z, 0.42);
}
function barberPoleGeo() {
  const mb = new MB(), R = 0.11, rings = 12, seg = 8, H = 0.11;
  const cols = [rgb(0xc2271f), rgb(0xf1ece2), rgb(0x23458f), rgb(0xf1ece2)];
  for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU, y0 = 0.14 + k * H, y1 = y0 + H;
    mb.quad([Math.cos(a0) * R, y0, -Math.sin(a0) * R], [Math.cos(a1) * R, y0, -Math.sin(a1) * R], [Math.cos(a1) * R, y1, -Math.sin(a1) * R], [Math.cos(a0) * R, y1, -Math.sin(a0) * R], cols[(i + k) % 4], 0);
  }
  mb.cyl(0, 0, 0, 0.14, 0.14, 0.14, 8, GOLD, 0, { bottom: true });
  mb.cyl(0, 0.14 + rings * H, 0, 0.14, 0.14, 0.1, 8, GOLD, 0);
  mb.cyl(0, 0.24 + rings * H, 0, 0.12, 0.02, 0.2, 8, rgb(0xf1ece2), 0);
  return mb.build();
}

/* what each shop puts out front so it reads from the street, each in its own way; f = z of the facade, local frame */
// a bench against the front wall, to sit and watch the street
function porchBench(mb, b, x, f, len, coll) {
  if (frontWins(b).some((w) => Math.abs(w.u - x) < (w.w + 0.3) / 2 + len / 2 && w.y - 0.12 < 1.3)) return;
  mb.at(x, 0.35, f + 0.25, 0); bench(mb, len, COL.woodDark); mb.pop();
  coll.rect(x - len / 2, x + len / 2, f + 0.05, f + 0.45, 0.9);
}
function decorate(mb, b, f, coll, poles) {
  const wz = f + 0.02, wall = rgb(b.wall);
  // only on stretches of wall without a window or poster: the backrest would reach into the frame
  const benchAt = { saloon: [[-3.2, 1.6], [3.2, 1.6]], hotel: [[-2.25, 1.6]], post: [[-1.45, 0.95]] }[b.type];
  if (benchAt) for (const [x, len] of benchAt) porchBench(mb, b, x, f, len, coll);
  switch (b.type) {
    case 'saloon': {
      painted(mb, 0, 6.65, f + 0.01, 10.0, 2.5, wall, 0);                           // big lettering on the front
      for (const s of [-1, 1]) wallLantern(mb, s * 1.3, 2.0, f + 0.2);
      break;
    }
    case 'store': {
      const sy = 5.5, sw = 7.4;
      signBoard(mb, 0, sy, f + 0.1, sw, 1.75, COL.sign, 1, COL.woodDark);
      // an advert painted on the west wall, for everyone riding in
      mb.box(-b.w / 2 - 0.015, 2.95, -b.d / 2, 0.03, 1.8, 7.6, wall, 0, { faceUV: 'nx', tileNx: 32 + 10 });
      const x = b.w / 2 - 0.7, y = 0.35;
      porchBarrel(mb, -x, y, f + 0.6, coll); porchBarrel(mb, -x + 0.82, y, f + 0.55, coll);
      porchSack(mb, -x + 0.3, y, f + 1.4, 0.3); porchSack(mb, -x + 0.95, y, f + 1.35, -0.2); porchSack(mb, -x + 0.6, y + 0.5, f + 1.38, 0.1);
      coll(-x + 0.6, f + 1.4, 0.5);
      porchCrate(mb, x, y, f + 0.6, 0.75, coll); porchCrate(mb, x - 0.85, y, f + 0.58, 0.65, coll); porchCrate(mb, x - 0.1, y + 0.75, f + 0.6, 0.55);
      mb.beam([x - 0.4, y, f + 1.5], [x - 0.15, y + 1.45, f + 0.45], 0.05, rgb(0xb8945e), 0);
      mb.box(x - 0.42, y, f + 1.52, 0.3, 0.32, 0.08, rgb(0xd9b45c), 23);
      break;
    }
    case 'bank': {
      // a little stone portico with columns and a pediment, the name on the frieze
      const stone = rgb(0xd8ccb6);
      for (const s of [-1, 1]) {
        mb.box(s * 1.35, 0.35, 1.75, 0.5, 0.18, 0.5, stone, 0);
        mb.cyl(s * 1.35, 0.53, 1.75, 0.19, 0.16, 2.6, 8, mulc(stone, 1.04), 0);
        mb.box(s * 1.35, 3.13, 1.75, 0.5, 0.17, 0.5, stone, 0);
        coll(s * 1.35, 1.75, 0.26);
      }
      mb.box(0, 3.3, 1.0, 3.6, 0.55, 2.1, stone, 0, { bottom: true });
      signBoard(mb, 0, 3.36, 2.06, 2.0, 0.44, rgb(0x1f3b2c), 2);
      prism(mb, [[-1.9, 0], [1.9, 0], [0, 0.8]], 0, 3.85, -0.02, 2.06, stone);
      mb.box(0, 3.85, 1.02, 3.9, 0.08, 2.15, mulc(stone, 0.9), 0);
      break;
    }
    case 'hotel': {
      painted(mb, 0, 6.85, f + 0.01, 6.0, 1.5, wall, 3);
      hotelSign(mb, b.w / 2 + 0.12, f);
      break;
    }
    case 'sheriff': {
      signBoard(mb, 0, 3.62, f + 0.1, 2.8, 0.7, rgb(0x4a2e1e), 4, rgb(0x2a1a12));
      sheriffStar(mb, 0, b.h + 0.95 + 0.62, -0.17, 0.62);
      mb.box(-1.62, 1.25, wz, 0.56, 0.74, 0.02, rgb(0xe8dcbe), 0, { faceUV: 'pz', tilePz: 64 });
      mb.box(1.62, 1.3, wz, 0.56, 0.74, 0.02, rgb(0xe8dcbe), 0, { faceUV: 'pz', tilePz: 65 });
      break;
    }
    case 'barber': {
      // gold lettering on the shop windows
      for (const [u, idx] of [[-2.55, 5], [2.55, 11]]) mb.box(u, 1.95, f + 0.19, 1.9, 0.48, 0.01, COL.glass, 0, { faceUV: 'pz', tilePz: 32 + idx });
      for (const s of [-1, 1]) {
        const x = s * 1.3, z = f + 0.3;
        for (const yy of [1.02, 2.62]) mb.box(x, yy, f + 0.15, 0.07, 0.07, 0.3, COL.iron, 0, { bottom: true });
        poles.push([x, 0.96, z]);
      }
      break;
    }
    case 'gunsmith': {
      painted(mb, 0, 5.85, f + 0.01, 5.6, 1.4, wall, 8);
      mb.box(0, 4.05, f + 0.04, 4.9, 1.25, 0.08, COL.woodDark, 0);
      mb.box(0, 4.12, f + 0.08, 4.7, 1.11, 0.06, rgb(0xd9c7a2), 2);
      mb.push(new THREE.Matrix4().makeTranslation(0, 4.68, f + 0.2).multiply(new THREE.Matrix4().makeScale(1.42, 1.42, 1)));
      rifle(mb, 0, 0);
      mb.pop();
      // a small shed roof over the door instead of a porch, and a revolver hanging out over the boardwalk
      mb.push(new THREE.Matrix4().makeTranslation(0, 3.2, f).multiply(new THREE.Matrix4().makeRotationX(0.32)));
      mb.box(0, 0, 0.5, 2.3, 0.08, 1.0, COL.roof, 5, { bottom: true });
      mb.pop();
      for (const s of [-1, 1]) mb.beam([s * 1.0, 2.75, f], [s * 1.0, 3.12, f + 0.85], 0.05, COL.woodDark, 0);
      pistolSign(mb, b.w / 2 - 0.25, f);
      break;
    }
    case 'post': {
      envelope(mb, 4.45, f + 0.08);
      // the name hangs on chains under the porch roof
      for (const s of [-1, 1]) mb.box(s * 1.1, 2.95, f + 2.45, 0.025, 0.12, 0.025, COL.iron, 0);
      mb.box(0, 2.3, f + 2.45, 2.6, 0.65, 0.06, rgb(0x2b3a55), 0, { faceUV: 'pz nz', tilePz: 32 + 7, tileNz: 32 + 7, bottom: true });
      const x = -(b.w / 2 + 0.7), z = f + 2.2;
      mb.box(x, 0, z, 0.26, 7.2, 0.26, rgb(0x6d5038), 3, { ao: 0.2 });
      mb.box(x, 6.6, z, 0.16, 0.16, 1.9, rgb(0x6d5038), 3, { bottom: true });
      for (const oz of [-0.75, -0.25, 0.25, 0.75]) mb.cyl(x, 6.76, z + oz, 0.05, 0.04, 0.14, 6, rgb(0x6fa3a8), 0);
      coll(x, z, 0.2);
      break;
    }
    case 'apothecary': {
      signBoard(mb, 0, 4.3, f + 0.1, 6.4, 1.6, rgb(0x1f3b2c), 9, GOLD);
      mortar(mb, crownTop(b) - 0.08, 0.12);
      showGlobe(mb, -b.w / 2 + 1.0, f + 2.35, rgb(0x2f9a5a));
      showGlobe(mb, b.w / 2 - 1.0, f + 2.35, rgb(0xc0352c));
      break;
    }
    case 'doctor': {
      // a red cross on the white false front, and a shingle with the name hanging out over the boardwalk
      const red = rgb(0xa8231c);
      mb.box(0, 5.25, f + 0.03, 0.42, 1.3, 0.04, red, 0); mb.box(0, 5.69, f + 0.03, 1.3, 0.42, 0.04, red, 0);
      const x = b.w / 2 - 0.3;
      mb.box(x, 2.9, f + 0.08, 0.06, 0.06, 1.3, COL.iron, 0);
      mb.box(x, 2.55, f + 0.9, 0.04, 0.32, 0.04, COL.iron, 0);
      mb.box(x, 1.95, f + 0.9, 0.06, 0.62, 0.62, COL.white, 0, { faceUV: 'px nx', tilePx: 71, tileNx: 71 });
      break;
    }
    case 'livery': {
      horseshoe(mb, -2.1, 4.75, 0.12, 0.42); horseshoe(mb, 2.1, 4.75, 0.12, 0.42);
      for (const s of [-1, 1]) {
        const x = s * (b.w / 2 - 1.3);
        mb.box(x, 0, 1.1, 1.25, 0.82, 0.85, COL.hay, 23, { ao: 0.12 });
        mb.box(x - s * 0.2, 0.82, 1.15, 1.25, 0.82, 0.85, COL.hay, 23, { ao: 0.08 });
        coll(x, 1.1, 0.75);
      }
      break;
    }
  }
}
