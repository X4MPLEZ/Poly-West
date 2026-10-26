/* ---------- desert: cacti, bushes, rocks, mesas; moving bits ---------- */
const PLACED = [];
function freeSpot(x, z, r) {
  if (townMask(x, z) > 0.04) return false;
  if (x > 25 && Math.abs(z - roadZ(x)) < 7.5) return false;
  if (Math.abs(x - creekX(z)) < 6.5) return false;
  for (const p of PLACED) { const dx = p.x - x, dz = p.z - z, rr = p.r + r; if (dx * dx + dz * dz < rr * rr) return false; }
  return true;
}
function saguaro(mb, x, z, H, rnd) {
  const y = surfaceHeight(x, z) - 0.25;
  const g = mixc(rgb(0x598741), rgb(0x6e9a4b), rnd());
  mb.cyl(x, y, z, 0.42, 0.36, H, 8, g, 8, { ao: 0.28, noTop: true });
  mb.cyl(x, y + H, z, 0.36, 0.05, 0.45, 8, g, 8);
  const arms = 1 + Math.floor(rnd() * 2.7);
  let a = rnd() * TAU;
  for (let k = 0; k < arms; k++) {
    a += 2.2 + rnd() * 1.6;
    const ah = H * (0.4 + rnd() * 0.25), out = 0.78 + rnd() * 0.3, up = 0.7 + rnd() * 1.1;
    const dx = Math.sin(a), dz = Math.cos(a);
    mb.beam([x + dx * 0.25, y + ah, z + dz * 0.25], [x + dx * out, y + ah + 0.22, z + dz * out], 0.4, g, 8);
    mb.cyl(x + dx * out, y + ah + 0.02, z + dz * out, 0.25, 0.23, up + 0.2, 7, g, 8, { noTop: true });
    mb.cyl(x + dx * out, y + ah + up + 0.22, z + dz * out, 0.23, 0.04, 0.3, 7, g, 8);
  }
  PLACED.push({ x, z, r: 1.0 });
  addCircColl(x, z, 0.5);
}
function pricklyPear(mb, x, z, rnd) {
  const y = surfaceHeight(x, z);
  const g = mixc(rgb(0x6a984c), rgb(0x84ac5c), rnd());
  const ico = new THREE.IcosahedronGeometry(0.42, 0);
  const pts = [[0, 0.32, 0]];
  const pads = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < pads; i++) {
    const b = i === 0 ? [0, 0, 0] : pts[Math.floor(rnd() * pts.length)];
    const a = rnd() * TAU;
    const p = i === 0 ? [0, 0.32, 0] : [b[0] + Math.sin(a) * 0.32, b[1] + 0.32 + rnd() * 0.18, b[2] + Math.cos(a) * 0.32];
    pts.push(p);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + p[0], y + p[1], z + p[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.5, a, (rnd() - 0.5) * 0.9)), new THREE.Vector3(1, 1.15, 0.34));
    mb.push(m); mb.geo(ico, mulc(g, 0.92 + rnd() * 0.14), 8); mb.pop();
    if (rnd() < 0.45) mb.box(x + p[0], y + p[1] + 0.42, z + p[2], 0.12, 0.12, 0.12, rgb(0xc4405a), 0);
  }
  PLACED.push({ x, z, r: 0.9 });
  addCircColl(x, z, 0.5);
}
function barrelCactus(mb, x, z, rnd) {
  const y = surfaceHeight(x, z) - 0.05;
  const g = mixc(rgb(0x5f8e46), rgb(0x739f50), rnd());
  mb.cyl(x, y, z, 0.34, 0.3, 0.5, 9, g, 8, { noTop: true, ao: 0.2 });
  mb.cyl(x, y + 0.5, z, 0.3, 0.06, 0.18, 9, g, 8);
  const fc = rnd() < 0.5 ? rgb(0xe8b53e) : rgb(0xd8564a);
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + rnd(); mb.box(x + Math.sin(a) * 0.14, y + 0.6, z + Math.cos(a) * 0.14, 0.1, 0.1, 0.1, fc, 0); }
  PLACED.push({ x, z, r: 0.5 });
}
function bush(mb, x, z, s, rnd) {
  const y = surfaceHeight(x, z) - 0.1 * s;
  const c = [rgb(0x8b8250), rgb(0x9b8e5a), rgb(0x7c7846)][Math.floor(rnd() * 3)];
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.3 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * TAU, 0)), new THREE.Vector3(1.3 * s, 0.62 * s, 1.3 * s));
  mb.push(m); mb.geo(new THREE.IcosahedronGeometry(0.75, 0), () => mulc(c, 0.9 + rnd() * 0.2), 10, 0.3, rnd); mb.pop();
  PLACED.push({ x, z, r: 0.8 * s });
}
function rock(mb, x, z, s, rnd, coll) {
  const y = surfaceHeight(x, z) - 0.28 * s;
  const c = [rgb(0x9b6a52), rgb(0x8e7a68), rgb(0xa9805c), rgb(0x87604a)][Math.floor(rnd() * 4)];
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.4 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.4, rnd() * TAU, (rnd() - 0.5) * 0.4)),
    new THREE.Vector3(s * (1 + rnd() * 0.6), s * (0.55 + rnd() * 0.45), s * (1 + rnd() * 0.4)));
  mb.push(m); mb.geo(new THREE.IcosahedronGeometry(1, 0), () => mulc(c, 0.88 + rnd() * 0.22), 6, 0.35, rnd); mb.pop();
  PLACED.push({ x, z, r: 1.3 * s });
  if (coll && s > 0.45) addCircColl(x, z, 1.05 * s);
}
function mesa(mb, cx, cz, R, H, rnd) {
  const n = 11;
  const radii = [];
  for (let i = 0; i < n; i++) radii.push(R * (0.72 + rnd() * 0.42));
  const poly = (k, jit) => radii.map((r, i) => { const a = (i / n) * TAU; const rr = r * k * (1 + (jit ? (rnd() - 0.5) * jit : 0)); return [cx + Math.sin(a) * rr, cz + Math.cos(a) * rr]; });
  const g = surfaceHeight(cx, cz);
  const y0 = g - 6, y1 = g + H * 0.3;
  const talus = rgb(0xb97a4f), bands = [rgb(0xb45d3a), rgb(0xcc7d4f), rgb(0xa24f33), rgb(0xc06a43)], top = rgb(0xc4925f);
  const base = poly(1.5, 0.15), mid = poly(1.0, 0);
  mb.ring(base, y0, mid, y1, talus, 6);
  let prev = mid, py = y1;
  const nb = 3;
  for (let b = 0; b < nb; b++) {
    const ny = y1 + ((H - H * 0.3) * (b + 1)) / nb;
    const next = poly(1 - (b + 1) * 0.025, 0);
    mb.ring(prev, py, next, ny, bands[b % bands.length], 6);
    prev = next; py = ny;
  }
  mb.cap(prev, py, top, 6);
}
function buildNature() {
  const plants = new MB(), rocks = new MB();
  const rnd = mulberry32(20261025);
  // a few hand-placed cacti and rocks around the edges of town
  const hand = [[-46, -15, 4.6], [31, -15, 5.2], [-13, 24, 4.0], [42, 25, 5.6], [-70, -6, 5.0], [58, -8, 4.2], [-44, 30, 3.6]];
  for (const [x, z, h] of hand) saguaro(plants, x, z, h, rnd);
  for (const [x, z, s] of [[-47, 9, 1.0], [27, -12, 0.8], [-20, -24, 1.2], [45, 9, 0.9], [-71, 4, 1.4], [16, 22, 0.7]]) rock(rocks, x, z, s, rnd, true);
  const ring = (n, r0, r1, fn, rad) => {
    let made = 0, tries = 0;
    while (made < n && tries < n * 40) {
      tries++;
      const a = rnd() * TAU, r = r0 + Math.sqrt(rnd()) * (r1 - r0);
      const x = TOWN.cx + Math.sin(a) * r * 1.25, z = TOWN.cz + Math.cos(a) * r * 0.9;
      if (!freeSpot(x, z, rad)) continue;
      fn(x, z); made++;
    }
  };
  ring(48, 40, 150, (x, z) => saguaro(plants, x, z, 3.2 + rnd() * 3.2, rnd), 1.4);
  ring(40, 35, 130, (x, z) => pricklyPear(plants, x, z, rnd), 1.0);
  ring(46, 30, 120, (x, z) => barrelCactus(plants, x, z, rnd), 0.6);
  ring(80, 30, 160, (x, z) => bush(plants, x, z, 0.6 + rnd() * 0.7, rnd), 0.9);
  ring(70, 30, 170, (x, z) => rock(rocks, x, z, 0.4 + rnd() * rnd() * 2.6, rnd, true), 1.6);
  // creek bed pebbles and boulders
  for (let i = 0; i < 26; i++) {
    const z = -60 + rnd() * 120, x = creekX(z) + (rnd() - 0.5) * 6;
    if (Math.abs(z - roadZ(x)) < 5) continue;
    rock(rocks, x, z, 0.25 + rnd() * 0.5, rnd, false);
  }
  // far mesas and buttes
  const fixed = [[-265, -30, 46, 58], [-235, 70, 22, 76], [-300, 120, 38, 44], [255, 30, 40, 52], [180, -230, 52, 40],
    [30, -300, 44, 62], [-120, -260, 28, 70], [-70, 280, 50, 46], [110, 260, 30, 64], [300, -110, 34, 48], [-330, -170, 40, 50], [340, 170, 46, 40]];
  for (const [x, z, R, H] of fixed) mesa(rocks, x, z, R, H, rnd);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, d = 380 + rnd() * 140;
    mesa(rocks, Math.sin(a) * d, Math.cos(a) * d, 25 + rnd() * 35, 30 + rnd() * 50, rnd);
  }
  return { plants: plants.build(), rocks: rocks.build() };
}

function buildTumbleweed(seed) {
  const mb = new MB();
  const rnd = mulberry32(seed);
  mb.geo(new THREE.IcosahedronGeometry(0.62, 1), () => mixc(rgb(0x9c7f50), rgb(0xc2a26c), rnd()), 10, 0.42, rnd);
  return mb.build();
}
function buildVulture() {
  const mb = new MB();
  const c = rgb(0x2b2320), w = rgb(0x3a2f2a);
  mb.box(0, -0.12, 0, 0.32, 0.24, 1.1, c, 0, { bottom: true });
  mb.box(0, -0.05, 0.62, 0.16, 0.16, 0.3, rgb(0x9a5a4a), 0, { bottom: true });
  for (const s of [1, -1]) {
    const tip = [s * 2.0, 0.42, -0.25], root0 = [s * 0.15, 0, 0.3], root1 = [s * 0.15, 0, -0.35], mid = [s * 1.1, 0.24, 0.15];
    if (s > 0) { mb.tri(root0, root1, mid, w, 0); mb.tri(mid, root1, tip, w, 0); mb.tri(root1, root0, mid, w, 0); mb.tri(root1, mid, tip, w, 0); }
    else { mb.tri(root1, root0, mid, w, 0); mb.tri(root1, mid, tip, w, 0); mb.tri(root0, root1, mid, w, 0); mb.tri(mid, root1, tip, w, 0); }
  }
  mb.tri([0, 0, -0.5], [0.3, 0, -0.95], [-0.3, 0, -0.95], c, 0);
  mb.tri([0, 0, -0.5], [-0.3, 0, -0.95], [0.3, 0, -0.95], c, 0);
  return mb.build();
}
