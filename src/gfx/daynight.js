/* ---------- day and night ----------
   The sun runs its arc from 5:45 to 19:45 (east -> south -> west), the moon takes over in the night. Light, sky,
   fog and shadows are blended from a few keys chosen by the sun's height: night, blue hour, sunset, golden hour,
   day and noon (the day key is the game's old fixed light). At night the windows of the town glow (some rooms
   lit, some dark), light falls out of the open buildings onto the street, and inside the lanterns take over from
   the daylight that came through doors and windows. The static shadow map is drawn again whenever the light has
   moved a little (see updateShadow). */
const DAYNIGHT = {
  KEYS: [
    { el: -16, sun: [0xa8bce8, 0.34], sky: [0x4a5c94, 0.44], gnd: [0x2e2c40, 0.34], fog: 0x1a2038, glow: 0x2c3858, fogDen: 0.0058, shadow: 0.62,
      zen: 0x060a18, hor: 0x1c2644, dgnd: 0x12141e, dsun: 0xe6ecff, dglow: 0.24, size: 0.99965, stars: 1, night: 1, expo: 1.32 },
    { el: -6, sun: [0x7c88c0, 0.06], sky: [0x5868a4, 0.42], gnd: [0x45384a, 0.32], fog: 0x3c3c5e, glow: 0xb06a50, fogDen: 0.0052, shadow: 0.2,
      zen: 0x141e44, hor: 0x9a6458, dgnd: 0x2e2836, dsun: 0xffb48a, dglow: 0.55, size: 0.9994, stars: 0.45, night: 0.9, expo: 1.22 },
    { el: 1, sun: [0xff8648, 0.62], sky: [0x8678b0, 0.44], gnd: [0xa0604a, 0.36], fog: 0xe09a6e, glow: 0xff8a4a, fogDen: 0.0048, shadow: 0.55,
      zen: 0x34488a, hor: 0xf49a5e, dgnd: 0xb07c5c, dsun: 0xffcc96, dglow: 0.85, size: 0.9993, stars: 0, night: 0.45, expo: 1.05 },
    { el: 10, sun: [0xffb878, 0.92], sky: [0x94a4d2, 0.5], gnd: [0xbe825e, 0.4], fog: 0xf0c296, glow: 0xffbc78, fogDen: 0.0045, shadow: 0.78,
      zen: 0x4674bc, hor: 0xf6c89c, dgnd: 0xd6ac84, dsun: 0xffe6c4, dglow: 0.62, size: 0.9994, stars: 0, night: 0, expo: 1 },
    { el: 30, sun: [0xffe1b4, 1.0], sky: [0x9cb4d8, 0.52], gnd: [0xc69466, 0.4], fog: 0xead2b2, glow: 0xffe2b4, fogDen: 0.0042, shadow: 0.82,
      zen: 0x4e7fc4, hor: 0xf3dab8, dgnd: 0xdcb98e, dsun: 0xfff5de, dglow: 0.45, size: 0.9994, stars: 0, night: 0, expo: 1 },
    { el: 52, sun: [0xfff0da, 1.04], sky: [0xa2bae0, 0.52], gnd: [0xc89c70, 0.42], fog: 0xecd8bc, glow: 0xfff0d0, fogDen: 0.0042, shadow: 0.84,
      zen: 0x4276c6, hor: 0xf0dcc0, dgnd: 0xdcbc94, dsun: 0xfff8e8, dglow: 0.4, size: 0.9994, stars: 0, night: 0, expo: 1 }
  ],
  COLS: ['fog', 'glow', 'zen', 'hor', 'dgnd', 'dsun'], NUMS: ['fogDen', 'shadow', 'dglow', 'size', 'stars', 'night', 'expo'],
  cur: {}, sunAz: 0, sunEl: 0, lightAz: 0, lightEl: 0, moon: false, shAz: -999, shEl: -999, shMoon: null, expo: 1, night: 0,
  // buildings whose light falls out onto the street at night (and how much)
  OPEN: { saloon: 1.7, hotel: 1.15, sheriff: 0.85, livery: 0.45, doctor: 0.8 },
  init() {
    for (const k of this.KEYS) for (const c of this.COLS.concat(['sun', 'sky', 'gnd'])) {
      const v = k[c]; k['_' + c] = Array.isArray(v) ? mulc(rgb(v[0]), v[1]) : rgb(v);
    }
    // the light pools in front of the open buildings
    this.pools = [];
    for (const R of ROOMS) {
      const k = R.parent ? 0 : this.OPEN[R.type] || 0;
      if (!k) continue;
      const p = rwp(R, 0, R.floorY + 2.1, R.z1 + 1.1);
      this.pools.push(new THREE.Vector4(p.x, p.y, p.z, k));
    }
    while (this.pools.length < 6) this.pools.push(new THREE.Vector4(0, -100, 0, 0));
    this.pools.length = 6;
    U.uLamp.value = this.pools.map((p) => p.clone());
    this.update(0, true);
  },
  // the sun's place at hour h (degrees): azimuth (0 = south, 90 = east) and elevation
  sunAt(h) {
    const rise = 5.75, len = 14, top = 52;
    let u = (h - rise) / len;
    if (u >= 0 && u <= 1) return [90 - 180 * u, top * Math.sin(Math.PI * u)];
    let v = ((h - rise - len) % 24 + 24) % 24 / (24 - len);
    return [-90 - 180 * v, -38 * Math.sin(Math.PI * v)];
  },
  // the light blended from the two keys around the sun's height
  blend(el) {
    const K = this.KEYS, o = this.cur;
    let i = 0;
    while (i < K.length - 2 && el > K[i + 1].el) i++;
    const a = K[i], b = K[i + 1], t = smoothstep(0, 1, clamp((el - a.el) / (b.el - a.el), 0, 1));
    for (const c of this.COLS.concat(['sun', 'sky', 'gnd'])) o[c] = mixc(a['_' + c], b['_' + c], t);
    for (const n of this.NUMS) o[n] = lerp(a[n], b[n], t);
    return o;
  },
  update(dt, force) {
    const h = TIME.hour();
    const [az, el] = this.sunAt(h);
    this.sunAz = az; this.sunEl = el;
    const o = this.blend(el);
    // the light: the sun down to the blue hour (from just above the horizon), then the moon opposite it
    const moon = el < -6;
    this.moon = moon;
    this.lightAz = moon ? az + 180 : az; this.lightEl = moon ? Math.max(-el, 9) : Math.max(el, 2);
    U.uSunDir.value.copy(dirFromAzEl(this.lightAz, this.lightEl));
    U.uSunCol.value.set(o.sun[0], o.sun[1], o.sun[2]);
    U.uSkyAmb.value.set(o.sky[0], o.sky[1], o.sky[2]);
    U.uGndAmb.value.set(o.gnd[0], o.gnd[1], o.gnd[2]);
    U.uFogCol.value.set(o.fog[0], o.fog[1], o.fog[2]);
    U.uGlowCol.value.set(o.glow[0], o.glow[1], o.glow[2]);
    U.uFogDen.value = o.fogDen; U.uShadowAmt.value = o.shadow;
    const S = G.skyU;
    S.uZen.value.set(o.zen[0], o.zen[1], o.zen[2]); S.uHor.value.set(o.hor[0], o.hor[1], o.hor[2]); S.uGnd.value.set(o.dgnd[0], o.dgnd[1], o.dgnd[2]);
    S.uSunCol.value.set(o.dsun[0], o.dsun[1], o.dsun[2]); S.uGlow.value = o.dglow; S.uSunSize.value = o.size; S.uStars.value = o.stars;
    // the disc on the sky: the real sun until it is well down, then the moon; the glow stays with the sun
    S.uDiscDir.value.copy(dirFromAzEl(moon ? az + 180 : az, moon ? -el : el));
    S.uGlowDir.value.copy(dirFromAzEl(az, el));
    S.uMoon.value = moon ? 1 : 0;
    this.night = o.night; this.expo = o.expo;
    U.uNight.value = o.night;
    U.uDayK.value = 1 - 0.9 * smoothstep(0.1, 0.9, o.night);
    U.uLampK.value = smoothstep(0.25, 0.85, o.night);
    this.clock();
    // shadows again once the light has moved about a degree (or jumped from sun to moon)
    const moved = Math.abs(wrapA((this.lightAz - this.shAz) * DEG)) / DEG + Math.abs(this.lightEl - this.shEl);
    if (force || moon !== this.shMoon || moved > 0.9) {
      this.shAz = this.lightAz; this.shEl = this.lightEl; this.shMoon = moon;
      updateShadow({ az: +this.lightAz.toFixed(2), el: +this.lightEl.toFixed(2) });
    }
  },
  // for the HUD: a sun or a moon and the time, written when the minute changes
  icon() { return this.sunEl > -4 ? '☀' : '☾'; },
  clock() {
    const s = this.icon() + ' ' + TIME.str();
    if (s === this.lastClock) return;
    this.lastClock = s;
    const el = this.clockEl || (this.clockEl = document.getElementById('clock'));
    if (el) el.textContent = s;
  }
};
