/* a window; about two in three have a lamp lit behind them at night: the flag is a slightly greener pane colour
   (picked by a counter, not by rnd(), so the town's random numbers stay the same), read by the outdoor shader */
let WIN_N = 0;
function windowAt(mb, x, y, w, h, frame) {
  mb.box(x, y - 0.12, 0.05, w + 0.3, h + 0.24, 0.1, frame, 0);
  const lit = ((WIN_N++ * 2654435761) >>> 0) % 100 < 64;
  mb.box(x, y, 0.1, w, h, 0.08, lit ? [COL.glass[0], COL.glass[1] + 0.012, COL.glass[2]] : COL.glass, 0, { faceUV: 'pz', tilePz: 12 });
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
