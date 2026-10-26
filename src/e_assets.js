/* ---------- texture atlas: 8x4 grey detail tiles (32 px) + 8 shop signs (128x32) ---------- */
function buildAtlas(signFont) {
  const S = 512;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const D = img.data;
  const set = (x, y, v) => { const i = (y * S + x) * 4; v = clamp(Math.round(v), 0, 255); D[i] = D[i + 1] = D[i + 2] = v; D[i + 3] = 255; };
  const r = mulberry32(77);
  const tile = (id, fn) => { const ox = (id % 8) * 32, oy = Math.floor(id / 8) * 32; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) set(ox + x, oy + y, fn(x, y)); };
  for (let id = 0; id < 32; id++) tile(id, () => 191);
  tile(1, (x, y) => { let v = 186 + (r() - 0.5) * 30; if (r() < 0.05) v -= 45; if (r() < 0.04) v += 30; return v; });
  const plankRows = [r(), r(), r(), r()];
  tile(2, (x, y) => {
    const row = Math.floor(y / 8), ly = y % 8;
    let v = 172 + plankRows[row] * 40 + Math.sin((x + row * 13) * 0.9 + vnoise(x * 0.3, y * 2.1 + row) * 5) * 7 + (r() - 0.5) * 10;
    if (ly === 7) v = 102; if (ly === 0) v += 12;
    if ((x === 2 || x === 29) && ly === 3) v = 90;
    return v;
  });
  const boardCols = [r(), r(), r(), r()];
  tile(3, (x, y) => {
    const col = Math.floor(x / 8), lx = x % 8;
    let v = 170 + boardCols[col] * 42 + Math.sin((y + col * 11) * 0.8 + vnoise(x * 2.1 + col, y * 0.3) * 5) * 7 + (r() - 0.5) * 10;
    if (lx === 7) v = 100; if (lx === 0) v += 12;
    if (lx === 3 && (y === 4 || y === 27)) v = 92;
    return v;
  });
  tile(4, (x, y) => { let v = 188 + (vnoise(x * 0.18, y * 0.18) - 0.5) * 34 + (r() - 0.5) * 12; if (Math.abs(y - 18 - Math.sin(x * 0.5) * 3) < 0.6 && x > 6 && x < 22) v -= 50; return v; });
  tile(5, (x, y) => {
    const row = Math.floor(y / 8), ly = y % 8, sx = (x + (row % 2) * 4) % 8;
    let v = 176 + (hash2(Math.floor((x + (row % 2) * 4) / 8), row) - 0.5) * 50 + (r() - 0.5) * 10;
    if (ly >= 6) v -= 55; if (sx === 0) v -= 40;
    return v;
  });
  tile(6, (x, y) => 180 + Math.sin(y * 0.75 + vnoise(x * 0.2, y * 0.2) * 3) * 24 + (r() - 0.5) * 18 + (r() < 0.04 ? -40 : 0));
  tile(7, (x, y) => {
    const row = Math.floor(y / 6), ly = y % 6, bx = (x + (row % 2) * 6) % 12;
    if (ly === 5 || bx === 0) return 228;
    return 150 + hash2(Math.floor((x + (row % 2) * 6) / 12), row) * 44 + (r() - 0.5) * 14;
  });
  tile(8, (x, y) => { const lx = x % 5; let v = lx === 0 ? 132 : lx === 2 ? 224 : 188; if (lx === 2 && y % 6 === 0) v = 250; return v + (r() - 0.5) * 8; });
  tile(9, (x, y) => 182 + ((x + y) % 2) * 16 + ((x - y + 64) % 4 === 0 ? -12 : 0) + (r() - 0.5) * 10);
  tile(10, (x, y) => 178 + (vnoise(x * 0.9, y * 0.25) - 0.5) * 70 + (r() - 0.5) * 20);
  tile(11, (x, y) => { let v = 180 + (vnoise(x * 0.25, y * 0.25) - 0.5) * 30 + (r() - 0.5) * 22; if (r() < 0.04) v -= 50; return v; });
  tile(12, (x, y) => {
    if (x < 3 || x > 28 || y < 3 || y > 28) return 236;
    if (x === 15 || x === 16 || y === 15 || y === 16) return 225;
    let v = 66 + (y < 15 ? 18 : 0);
    if (Math.abs(x - y - 4) < 2 && x < 15) v = 140;
    return v;
  });
  tile(13, (x, y) => {
    if (x < 2 || x > 29 || y < 2) return 222;
    const lx = (x - 2) % 7; let v = 160 + hash2(Math.floor((x - 2) / 7), 3) * 40 + (r() - 0.5) * 10;
    if (lx === 6) v = 110; if (y === 12 || y === 13) v = 120; if (x === 24 && (y === 17 || y === 18)) v = 245;
    return v;
  });
  tile(23, (x, y) => 186 + Math.sin(x * 1.7 + vnoise(x * 0.5, y * 0.5) * 6) * 26 + (r() - 0.5) * 20);
  // signs (256x64). Red = board shading, blue = ink mask, green = ink colour (dark / cream / gold); the shader
  // mixes ink over the vertex colour, so one cell works on any board or wall colour
  const setc = (x, y, rr, g, bb) => { const i = (y * S + x) * 4; D[i] = clamp(Math.round(rr), 0, 255); D[i + 1] = g; D[i + 2] = bb; D[i + 3] = 255; };
  const INK = { dark: 30, cream: 128, gold: 230 };
  const FONTS = { serif: ['bold', 'Georgia, "DejaVu Serif", "Times New Roman", serif'], sans: ['600', '"Barlow Semi Condensed", "Arial Narrow", sans-serif'] };
  const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 64;
  const tc = tmp.getContext('2d', { willReadFrequently: true });
  const fit = (txt, size, maxW, fam) => { const [wt, ff] = fam; tc.font = `${wt} ${size}px ${ff}`; while (tc.measureText(txt).width > maxW && size > 8) { size--; tc.font = `${wt} ${size}px ${ff}`; } return size; };
  for (let k = 0; k < SIGNS.length; k++) {
    const sg = SIGNS[k], fam = FONTS[sg.font] || ['', signFont];
    const ox = (k % 2) * 256, oy = 128 + Math.floor(k / 2) * 64;
    tc.clearRect(0, 0, 256, 64);
    tc.fillStyle = '#fff'; tc.textAlign = 'center'; tc.textBaseline = 'middle';
    const framed = sg.st === 'board', pad = framed ? 16 : 6;
    if (sg.s) {
      fit(sg.t, 40, 256 - pad * 2, fam); tc.fillText(sg.t, 128, 25);
      fit(sg.s, 12, 170, fam); tc.fillText(sg.s, 128, 51);
      const sw = tc.measureText(sg.s).width, lw = Math.max(0, 108 - pad - sw / 2);
      tc.fillRect(pad + 4, 50, lw, 2); tc.fillRect(252 - pad - lw, 50, lw, 2);
    } else {
      fit(sg.t, 46, 256 - pad * 2, fam); tc.fillText(sg.t, 128, 33);
    }
    if (framed) { tc.fillRect(5, 5, 246, 2); tc.fillRect(5, 57, 246, 2); tc.fillRect(5, 5, 2, 54); tc.fillRect(249, 5, 2, 54); }
    const a = tc.getImageData(0, 0, 256, 64).data;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) {
      let v = sg.st === 'paint' ? 190 + (r() - 0.5) * 6 : 210 + (r() - 0.5) * 12;
      if (sg.st !== 'paint' && (x < 2 || x > 253 || y < 2 || y > 61)) v = 140;
      const ink = a[(y * 256 + x) * 4 + 3] > 120 ? 255 : 0;
      setc(ox + x, oy + y, v, INK[sg.ink], ink);
    }
  }
  // pictures (64x64, tile 64+i): two wanted posters, then the letters of the hotel's tall sign
  const ic = document.createElement('canvas'); ic.width = 64; ic.height = 64;
  const icx = ic.getContext('2d', { willReadFrequently: true });
  const cell = (i, draw, base, inkG) => {
    icx.clearRect(0, 0, 64, 64); icx.fillStyle = '#fff'; icx.textAlign = 'center'; icx.textBaseline = 'middle';
    draw();
    const a = icx.getImageData(0, 0, 64, 64).data, ox = 256 + (i % 4) * 64, oy = Math.floor(i / 4) * 64;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const m = a[(y * 64 + x) * 4 + 3] > 120;
      if (inkG === undefined) { let v = 220 + (r() - 0.5) * 16 - (y > 46 && x > 40 ? 18 : 0); if (x < 2 || x > 61 || y < 2 || y > 61) v = 170; if (m) v = 60; setc(ox + x, oy + y, v, v, v); }
      else setc(ox + x, oy + y, base + (r() - 0.5) * 8, inkG, m ? 255 : 0);
    }
  };
  [['WANTED', '$500'], ['REWARD', '$1000']].forEach(([top, bottom], i) => cell(i, () => {
    icx.font = `12px ${signFont}`; icx.fillText(top, 32, 10);
    icx.beginPath(); icx.arc(32, 27, 7, 0, Math.PI * 2); icx.fill();
    icx.beginPath(); icx.ellipse(32, 44, 14, 9, 0, Math.PI, 0); icx.fill();
    icx.fillRect(18, 17, 28, 3);
    icx.font = `11px ${signFont}`; icx.fillText(bottom, 32, 54);
  }));
  'HOTEL'.split('').forEach((ch, i) => cell(2 + i, () => { icx.font = `50px ${signFont}`; icx.fillText(ch, 32, 36); icx.fillRect(4, 4, 56, 2); icx.fillRect(4, 58, 56, 2); }, 205, 230));
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  return tex;
}

