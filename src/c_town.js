/* ---------- Dust Creek: buildings and street props ---------- */
const COL = {
  wood: rgb(0x8b5a3c), woodLight: rgb(0xb08055), woodDark: rgb(0x5a3a28), plank: rgb(0x9d7653),
  roof: rgb(0x4f403a), roofRed: rgb(0x7d3c2c), trim: rgb(0xeadfca), glass: rgb(0x262833), door: rgb(0x4a3123),
  white: rgb(0xe9e0cf), sign: rgb(0xeee2c6), iron: rgb(0x3b3532), canvas: rgb(0xebdfc6), hay: rgb(0xd9b45c),
  water: rgb(0x58798a), earth: rgb(0x8d6446), stone: rgb(0xa79c8c)
};
/* sign cells (atlas tile 32 + index). st: board (framed), plain (no frame), paint (lettering straight on the
   surface, the cell is neutral so the box takes the wall colour). ink: dark, cream or gold. */
const SIGNS = [
  { t: 'SALOON', s: 'WHISKEY & CARDS', st: 'paint', ink: 'cream' },
  { t: 'GENERAL STORE', s: 'DRY GOODS & FEED', st: 'board', ink: 'dark' },
  { t: 'BANK', s: '', st: 'plain', ink: 'gold', font: 'serif' },
  { t: 'ROOMS & BATHS', s: '', st: 'paint', ink: 'cream' },
  { t: 'SHERIFF', s: 'DUST CREEK', st: 'board', ink: 'cream' },
  { t: 'BARBER', s: 'SHAVE & HAIRCUT', st: 'paint', ink: 'gold', font: 'serif' },
  { t: 'STABLES', s: 'HORSES & FEED', st: 'paint', ink: 'cream' },
  { t: 'U.S. POST OFFICE', s: 'TELEGRAPH', st: 'board', ink: 'cream', font: 'sans' },
  { t: 'GUNSMITH', s: 'GUNS & AMMO', st: 'paint', ink: 'cream' },
  { t: 'APOTHECARY', s: 'DRUGS & MEDICINE', st: 'board', ink: 'gold', font: 'serif' },
  { t: 'DRY GOODS', s: 'FEED, SEED & TOOLS', st: 'paint', ink: 'cream' },
  { t: 'HOT BATHS', s: '25 CENTS', st: 'paint', ink: 'gold', font: 'serif' }
];
const GOLD = rgb(0xd6a943);
const NORTH_Z = -5.6, SOUTH_Z = 9.6;
/* crown: shape of the false front's top; porch: roof (posts + roof), awning, deck (boardwalk only), steps (stone) */
const BUILDINGS = [
  { side: 'n', x: -33, w: 10, d: 11, h: 5.0, front: 7.4, wall: 0x7f8f9b, win: 2, type: 'store' },
  { side: 'n', x: -19.5, w: 13, d: 13, h: 8.2, front: 9.8, wall: 0x9c5a3c, two: true, saloon: true, crown: 'arch', type: 'saloon', backWins: [2.6, 5.0, -5.7] },
  { side: 'n', x: -5.5, w: 9, d: 10, h: 5.8, flat: true, wall: 0xc39a6e, tile: 7, win: 1, bars: true, porch: 'steps', type: 'bank' },
  { side: 'n', x: 7.5, w: 11.5, d: 12, h: 7.8, front: 9.0, wall: 0x7c8a6a, two: true, shutters: true, type: 'hotel', backWins: [-4.2] },
  { side: 'n', x: 21, w: 8.5, d: 9, h: 4.6, flat: true, adobe: true, wall: 0xcfa577, tile: 4, win: 1, bars: true, type: 'sheriff' },
  { side: 's', x: -31, w: 12, d: 13, h: 5.6, wall: 0x9a3c2a, barn: true, type: 'livery' },
  { side: 's', x: -16.5, w: 8, d: 9, h: 4.8, front: 6.6, wall: 0xe4dac8, bigWin: true, crown: 'step', porch: 'awning', type: 'barber' },
  { side: 's', x: -5, w: 7, d: 10, h: 5.2, front: 7.6, wall: 0x5d4b42, win: 1, porch: 'deck', type: 'gunsmith' },
  { side: 's', x: 7, w: 10, d: 10, h: 5.4, pitch: 3.0, wall: 0xb08a5c, win: 2, type: 'post' },
  { side: 's', x: 21, w: 9, d: 9, h: 4.4, front: 6.2, flat: true, wall: 0xd1aa80, tile: 4, win: 1, crown: 'arch', type: 'apothecary' }
];
function frontWins(b) {
  if (b.bigWin) return [{ u: -2.55, y: 0.9, w: 2.0, h: 1.8 }, { u: 2.55, y: 0.9, w: 2.0, h: 1.8 }];
  const wn = b.win === undefined ? 1 : b.win, out = [];
  for (let k = 1; k <= wn; k++) {
    const off = 1.2 + (k * (b.w / 2 - 1.4)) / (wn + 0.4);
    out.push({ u: -off, y: 1.15, w: 1.2, h: 1.55 }, { u: off, y: 1.15, w: 1.2, h: 1.55 });
  }
  return out;
}
function crownTop(b) { return b.crown === 'arch' ? b.front + 1.15 : b.crown === 'step' ? b.front + 1.53 : b.front + 0.87; }
function porchHasPosts(b) { return b.two || !b.porch || b.porch === 'roof'; }

function windowAt(mb, x, y, w, h, frame) {
  mb.box(x, y - 0.12, 0.05, w + 0.3, h + 0.24, 0.1, frame, 0);
  mb.box(x, y, 0.1, w, h, 0.08, COL.glass, 0, { faceUV: 'pz', tilePz: 12 });
}
function porch(mb, b, roofCol, postCol) {
  const w = b.w, st = b.two ? 'roof' : b.porch || 'roof';
  if (st === 'steps') {
    const stone = rgb(0xc9bda8);
    mb.box(0, 0, 1.35, w + 0.4, 0.12, 2.7, mulc(stone, 0.9), 0, { ao: 0.2 });
    mb.box(0, 0.12, 1.15, w + 0.1, 0.12, 2.3, stone, 0);
    mb.box(0, 0.24, 0.95, w - 0.2, 0.11, 1.9, mulc(stone, 1.05), 0);
    return;
  }
  mb.box(0, 0, 1.35, w + 0.4, 0.35, 2.7, COL.wood, 2, { top: COL.plank, tileTop: 2, ao: 0.2 });
  if (st === 'awning') {
    const n = Math.round(w / 0.5), red = rgb(0xb3362c), cream = rgb(0xece2cc);
    for (let i = 0; i < n; i++) {
      const xa = -w / 2 + (w * i) / n, xb = -w / 2 + (w * (i + 1)) / n, c = i % 2 ? cream : red;
      mb.quad([xa, 2.72, 2.1], [xb, 2.72, 2.1], [xb, 3.3, 0.05], [xa, 3.3, 0.05], c, 0);
      mb.quad([xa, 3.3, 0.05], [xb, 3.3, 0.05], [xb, 2.72, 2.1], [xa, 2.72, 2.1], mulc(c, 0.72), 0);
      mb.box((xa + xb) / 2, 2.46, 2.1, xb - xa, 0.27, 0.03, c, 0, { bottom: true });
      mb.tri([xa, 2.46, 2.12], [xb, 2.46, 2.12], [(xa + xb) / 2, 2.3, 2.12], c, 0);
    }
    for (const s of [-1, 1]) mb.beam([s * (w / 2 - 0.15), 2.2, 0.05], [s * (w / 2 - 0.15), 2.72, 2.05], 0.05, COL.iron, 0);
    return;
  }
  if (st === 'deck') return;
  const n = Math.max(2, Math.round(w / 4.2));
  for (let i = 0; i <= n; i++) {
    const px = -w / 2 + (w * i) / n;
    if (Math.abs(px) < 1.2) continue; // keep the way to the door clear
    mb.box(px, 0.35, 2.5, 0.22, b.two ? 3.0 : 2.95, 0.22, postCol, 3);
  }
  if (!b.two) {
    mb.push(new THREE.Matrix4().makeTranslation(0, 3.3, 0).multiply(new THREE.Matrix4().makeRotationX(0.1)));
    mb.box(0, 0, 1.45, w + 0.7, 0.16, 3.1, roofCol, 5);
    mb.pop();
  }
}
function balcony(mb, w, col) {
  mb.box(0, 3.35, 1.35, w + 0.4, 0.25, 2.7, col, 2, { top: COL.plank, tileTop: 2 });
  const n = Math.round(w / 0.9);
  for (let i = 0; i <= n; i++) mb.box(-w / 2 + (w * i) / n, 3.6, 2.6, 0.09, 0.9, 0.09, COL.trim, 0);
  mb.box(0, 4.45, 2.6, w + 0.2, 0.12, 0.14, COL.trim, 0);
  mb.box(-w / 2 - 0.05, 3.6, 1.35, 0.12, 0.97, 2.6, COL.trim, 0);
  mb.box(w / 2 + 0.05, 3.6, 1.35, 0.12, 0.97, 2.6, COL.trim, 0);
}
/* the top edge of a false front: plain cornice, stepped, or a round arch */
function crown(mb, b, wall, tile, trim) {
  const F = b.front, w = b.w;
  if (b.crown === 'step') {
    mb.box(0, F, 0.12, w + 0.3, 0.2, 0.4, trim, 0);
    mb.box(0, F + 0.2, 0.12, w * 0.62, 0.55, 0.24, wall, tile);
    mb.box(0, F + 0.75, 0.12, w * 0.62 + 0.2, 0.14, 0.34, trim, 0);
    mb.box(0, F + 0.89, 0.12, w * 0.3, 0.5, 0.24, wall, tile);
    mb.box(0, F + 1.39, 0.12, w * 0.3 + 0.2, 0.14, 0.34, trim, 0);
  } else if (b.crown === 'arch') {
    mb.box(0, F, 0.12, w + 0.3, 0.2, 0.4, trim, 0);
    const A = w * 0.72, n = 14, top = [];
    for (let i = 0; i <= n; i++) { const x = -A / 2 + (A * i) / n, k = (2 * x) / A; top.push([x, F + 0.2 + 0.95 * Math.sqrt(Math.max(0, 1 - k * k))]); }
    for (let i = 0; i < n; i++) {
      const x = (top[i][0] + top[i + 1][0]) / 2, y = Math.max(top[i][1], top[i + 1][1]);
      mb.box(x, F + 0.2, 0.12, A / n + 0.01, y - F - 0.2, 0.24, wall, tile);
    }
    for (let i = 0; i < n; i++) mb.beam([top[i][0], top[i][1], 0.12], [top[i + 1][0], top[i + 1][1], 0.12], 0.14, trim, 0);
  } else {
    mb.box(0, F, 0.15, w + 0.5, 0.32, 0.55, trim, 0);
    mb.box(0, F + 0.32, 0.15, w * 0.36, 0.55, 0.3, trim, 0);
  }
}

function storefront(mb, b, R) {
  const wall = rgb(b.wall), tile = b.tile || 3;
  const trim = b.wall === 0xe4dac8 ? rgb(0x8a6a50) : COL.trim;
  shellStorefront(mb, b, R, wall, tile);
  if (b.flat && b.adobe) {
    // adobe: thick parapet, a raised middle, log ends (vigas) poking out under the roof line
    mb.box(0, b.h, -b.d / 2, b.w + 0.1, 0.5, b.d + 0.1, wall, tile);
    mb.box(0, b.h + 0.5, -0.17, b.w * 0.34, 0.45, 0.34, wall, tile);
    mb.box(0, b.h + 0.3, -b.d / 2, b.w - 0.4, 0.1, b.d - 0.4, mulc(wall, 0.75), 0);
    for (let x = -b.w / 2 + 0.55; x < b.w / 2 - 0.3; x += 0.9) {
      mb.push(new THREE.Matrix4().makeTranslation(x, b.h - 0.32, -0.05).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      mb.cyl(0, 0, 0, 0.11, 0.11, 0.6, 6, rgb(0x6b4a30), 0);
      mb.pop();
    }
  } else if (b.flat) {
    mb.box(0, b.h, -b.d / 2, b.w + 0.5, 0.4, b.d + 0.5, trim, 0);
    mb.box(0, b.h + 0.4, -b.d / 2, b.w + 0.2, 0.25, b.d + 0.2, mulc(wall, 0.9), tile);
  } else {
    mb.gable(0, b.h, -b.d / 2 - 0.1, b.w + 0.6, b.d + 0.4, b.pitch || (b.two ? 1.4 : 1.8), COL.roof, 5, wall);
  }
  if (b.front) crown(mb, b, wall, tile, trim);
  const fz = b.front ? 0.24 : 0;
  mb.push(new THREE.Matrix4().makeTranslation(0, 0, fz));
  doorFrame(mb, 0.09, 0.35, trim);
  for (const wd of frontWins(b)) {
    windowAt(mb, wd.u, wd.y, wd.w, wd.h, trim);
    if (b.bars) for (let i = 0; i < 5; i++) mb.box(wd.u - 0.5 + i * 0.25, wd.y - 0.1, 0.2, 0.05, wd.h + 0.17, 0.05, COL.iron, 0);
  }
  if (b.two) {
    const n = 3;
    for (let k = 0; k < n; k++) {
      const x = -b.w / 2 + (b.w * (k + 0.5)) / n;
      windowAt(mb, x, 4.75, 1.0, 1.55, trim);
      if (b.shutters) for (const s of [-1, 1]) {
        mb.box(x + s * 0.88, 4.62, 0.12, 0.48, 1.8, 0.06, rgb(0x2f4a3a), 3);
        for (const yy of [5.0, 5.9]) mb.box(x + s * 0.88, yy, 0.16, 0.36, 0.04, 0.02, rgb(0x3e5a48), 0);
      }
    }
  }
  mb.pop();
  mb.push(new THREE.Matrix4().makeTranslation(0, 0, fz));
  porch(mb, b, COL.roof, COL.woodDark);
  if (b.two) balcony(mb, b.w, COL.wood);
  mb.pop();
  // side windows
  mb.push(new THREE.Matrix4().makeTranslation(b.w / 2, 0, -b.d / 2).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
  windowAt(mb, -b.d / 4, 1.3, 1.0, 1.3, trim); windowAt(mb, b.d / 4, 1.3, 1.0, 1.3, trim);
  mb.pop();
  mb.push(new THREE.Matrix4().makeTranslation(-b.w / 2, 0, -b.d / 2).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)));
  windowAt(mb, 0, 1.3, 1.0, 1.3, trim);
  mb.pop();
  if (b.backWins) {
    mb.push(new THREE.Matrix4().makeTranslation(0, 0, -b.d).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
    for (const x of b.backWins) windowAt(mb, -x, 4.75, 0.9, 1.3, trim);
    mb.pop();
  }
  return fz;
}

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
  for (const b of BUILDINGS) {
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
  }
  // church at the west end of the street, facing east
  const CR = roomFrame('church', -51, 2, Math.PI / 2);
  mb.at(-51, 0, 2, Math.PI / 2); church(mb, CR); mb.pop();
  CR.doorW = rwp(CR, 0, 0, CR.doorZ);
  addPlat(-47.8, 2, 0.7, 1.75, 0, 0.3);
  CAMBLOCK.push({ x0: -65, x1: -51, z0: -2.5, z1: 6.5, y0: -5, y1: 9.8, room: CR.idx });
  CAMBLOCK.push({ x0: -51, x1: -48.4, z0: 0.3, z1: 3.7, y0: -5, y1: 17, room: CR.idx });

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
