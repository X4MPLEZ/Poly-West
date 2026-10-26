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
    const { x0, x1, z0, floorY: F } = R;
    lining(mb, R, rgb(0xcfc4a8), rgb(0x6a4a32), 3);
    place(mb, R, [
      ['table', -1.6, -3.6, 0, { w: 1.5, box: [-2.4, -0.8, -4.0, -3.2, 0.8] }],                 // the sheriff's desk
      ['chair', -1.6, -4.3, 0],
      ['bars', 1.9, -5.4, 0, { len: 3.9, box: [0, x1, -5.45, -5.35, 3] }],                      // jail cell
      ['bars', 0.15, -6.9, Math.PI / 2, { len: 3.0, box: [0.1, 0.2, z0, -5.4, 3] }],
      ...[0, 1, 2, 3].map((i) => ['poster', x0 + 0.05, -1.6 - i * 0.7, Math.PI / 2, { y: 1.5 + (i % 2) * 0.1 }]),
      ['stove', -2.9, -6.8, 0, { circle: 0.38 }],
      ['lantern', -1.6, -3.6, 0, { len: 0.8 }], ['lantern', 2.0, -7.0, 0, { len: 0.8 }]
    ], rnd);
    // one-offs: things on the desk, bunk and bucket in the cell, gun rack, coffee pot, filing cabinet
    at(mb, -1.6, F, -3.6, 0, () => { mb.box(0.3, 0.78, 0, 0.35, 0.02, 0.25, IC.paper, 0); mb.box(-0.3, 0.78, 0.1, 0.25, 0.12, 0.18, rgb(0x3a3a3a), 0); mb.cyl(-0.55, 0.78, -0.2, 0.05, 0.05, 0.1, 7, rgb(0x6a6a6a), 0); });
    mb.box(2.9, F + 0.4, -7.9, 1.8, 0.08, 0.7, IC.oak, 2); mb.box(2.9, F + 0.48, -7.9, 1.7, 0.1, 0.6, rgb(0x6a6a5a), 9);
    for (const s of [-1, 1]) mb.box(2.9 + s * 0.85, F, -7.9, 0.06, 0.4, 0.6, IC.oak, 3);
    rColl(R, 1.95, x1, -8.3, -7.5, 0.6);
    mb.cyl(0.8, F, -8.2, 0.15, 0.13, 0.28, 8, rgb(0x6a6a6a), 0);
    at(mb, x1 - 0.06, F + 1.0, -2.6, -Math.PI / 2, () => { mb.box(0, 0, 0, 1.4, 0.08, 0.15, IC.walnut, 3); mb.box(0, 1.1, 0, 1.4, 0.08, 0.15, IC.walnut, 3); for (let i = 0; i < 4; i++) { mb.box(-0.5 + i * 0.33, 0.05, 0.08, 0.06, 1.2, 0.04, IC.walnut, 3); mb.box(-0.5 + i * 0.33, 0.6, 0.08, 0.04, 0.65, 0.05, IC.iron, 0); } });
    mb.cyl(-2.9, F + 0.93, -6.65, 0.08, 0.06, 0.2, 7, rgb(0x5a6a7a), 0);
    at(mb, x0 + 0.35, F, -7.8, Math.PI / 2, () => { mb.box(0, 0, 0, 0.8, 1.3, 0.5, rgb(0x5a5a52), 0); for (let i = 0; i < 3; i++) mb.box(0, 0.2 + i * 0.4, 0.26, 0.6, 0.3, 0.02, rgb(0x6a6a62), 0); });
    rColl(R, x0, x0 + 0.65, -8.3, -7.3, 1.4);
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
    const { x0, x1, z0, floorY: F } = R;
    const wood = rgb(0x5e4030);
    lining(mb, R, rgb(0xb79a6e), wood, 3);
    place(mb, R, [
      ['counter', 0, -5.2, 0, { len: x1 - x0 - 2.2, col: wood, box: [x0 + 1.05, x1 - 1.05, -5.6, -4.8, 1.2] }],
      ...[0, 1, 2].map((i) => ['bars', -2.6 + i * 2.6, -5.2, 0, { len: 0.8, h: 0.6, y: 1.08 }]),   // teller grilles on the counter
    ], rnd);
    rColl(R, x1 - 1.15, x1, -5.25, -5.15, 1.1); mb.box(x1 - 0.6, F, -5.2, 1.0, 1.05, 0.06, wood, 3);
    // pigeonholes full of letters
    at(mb, 0, F + 0.9, z0 + 0.25, 0, () => {
      mb.box(0, 0, -0.18, 4.4, 2.0, 0.04, IC.walnut, 3);
      for (let i = 0; i <= 10; i++) mb.box(-2.2 + i * 0.44, 0, 0, 0.03, 2.0, 0.4, IC.oak, 3);
      for (let j = 0; j <= 5; j++) mb.box(0, j * 0.4, 0, 4.4, 0.03, 0.4, IC.oak, 3);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) if (rnd() < 0.55) mb.box(-1.98 + i * 0.44, j * 0.4 + 0.04, 0.05, 0.3, 0.06 + rnd() * 0.15, 0.25, IC.paper, 0);
    });
    rColl(R, -2.3, 2.3, z0, z0 + 0.5, 3);
    // telegraph desk (one-off), parcels, mail sacks, waiting bench, picture, lamps
    at(mb, x0 + 0.6, F, -7.6, Math.PI / 2, () => { squareTable(mb, 1.4, 0.7, 0.78, IC.oak); mb.box(0, 0.78, 0.05, 0.25, 0.06, 0.18, IC.brass, 0); mb.box(0.05, 0.84, 0.05, 0.14, 0.03, 0.03, IC.black, 0); mb.box(-0.4, 0.78, 0, 0.3, 0.2, 0.22, rgb(0x3a3a3a), 0); });
    rColl(R, x0, x0 + 1.0, -8.4, -6.8, 0.8);
    place(mb, R, [
      ...[0, 1, 2, 3, 4].map((i) => ['crate', x1 - 0.5 - (i % 3) * 0.45, -7.5 - (i % 2) * 0.1, 0, { s: 0.4, col: rgb(0xb89a6a), y: Math.floor(i / 3) * 0.4 }]),
      ['sack', x1 - 0.5, -3.0, 0, { col: rgb(0x8a8a6a) }], ['sack', x1 - 0.5, -3.6, 0, { col: rgb(0x8a8a6a) }],
      ['bench', -2.0, -2.2, 0, { len: 1.8, box: [-2.9, -1.1, -2.45, -2.0, 0.8] }],
      ['picture', x0 + 0.05, -3.0, Math.PI / 2, { w: 1.4, h: 1.0, col: rgb(0xd8c8a0), y: 1.5 }],
      ['lantern', -2.0, -3.4, 0, { len: 0.9 }], ['lantern', 2.0, -3.4, 0, { len: 0.9 }]
    ], rnd);
    rColl(R, x1 - 1.6, x1, -7.8, -7.2, 0.9);
    rColl(R, x1 - 0.8, x1, -3.9, -2.7, 0.7);
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
