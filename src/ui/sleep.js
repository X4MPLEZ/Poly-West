/* ---------- going to sleep: the wagon wheel ----------
   Where: the room doors upstairs in the hotel (50 ¢) and above the saloon (30 ¢); a rented room is yours until noon
   of the next day. In any chair or on any bench one can doze off (at most two hours).
   The wheel is a wagon wheel on a 24-hour dial (noon at the top, midnight at the bottom, the night painted dark).
   You turn the wheel; its brass spoke points to the hour you want to wake up. A band runs from now to then; past
   what the body allows (REST.maxMinutes) the dial is barred and the wheel stops there with a thunk.
   Keys: ←/→ or A/D a quarter hour, ↑/↓ an hour, mouse wheel; E/Enter sleep, Esc back. Pad: stick, A, B.
   Then the eyes close, the wheel runs the hours forward, TIME.skip() tells the world, and you wake up. */
const SLEEP = {
  open: false, st: null, ctx: null, mins: 480, max: 720, fx: null, rent: null, places: [],
  PRICE: { hotel: 50, saloon: 30 }, NAME: { hotel: 'Hotel', saloon: 'Saloon' },
  busy() { return this.open || !!this.st; },
  frozen() { return this.open; },
  init() {
    // the doors of the rooms one can rent
    for (const D of ROOM_DOORS) {
      const U = D.R, P = U.parent, where = P && P.type;
      if (!this.PRICE[where]) continue;
      // which side of the door is the corridor: the one that is walkable
      const side = [1, -1].find((s) => { const lx = D.x + (D.alongX ? 0 : -s * 0.7), lz = D.z + (D.alongX ? -s * 0.7 : 0); return U.rects.some((r) => lx > r[0] && lx < r[1] && lz > r[2] && lz < r[3]); }) || 1;
      const sx = D.x + (D.alongX ? 0 : -side * 0.75), sz = D.z + (D.alongX ? -side * 0.75 : 0);
      const w = rwp(U, sx, U.floorY, sz), dw = rwp(U, D.x, U.floorY, D.z);
      const it = { x: dw.x, y: U.floorY, z: dw.z, sx: w.x, sz: w.z, fx: 0, fz: 0, room: U, occ: null, verb: 'sleep', where, door: D, kind: 'door', faceYaw: Math.atan2(dw.x - w.x, dw.z - w.z) };
      it.score = (p) => {
        const d = Math.hypot(it.sx - p.x, it.sz - p.z); if (d > 1.4) return 1e9;
        const a = Math.abs(wrapA(Math.atan2(it.x - p.x, it.z - p.z) - PLAY.yaw)); if (a > 1.3) return 1e9;
        return d + a * 0.4;
      };
      it.actions = () => [{ label: this.rented(where) ? 'Schlafen (dein Zimmer)' : 'Zimmer mieten und schlafen (' + this.PRICE[where] + ' ¢)', run: () => this.show({ kind: 'bed', where, place: it }) }];
      it.fx = Math.sin(it.faceYaw); it.fz = Math.cos(it.faceYaw);
      INTERACT.add(it); this.places.push(it);
    }
    this.build();
  },
  rented(where) { return this.rent && this.rent.where === where && TIME.min < this.rent.until; },

  /* ---- the wheel ---- */
  NS: 'http://www.w3.org/2000/svg',
  svg(tag, attrs, parent) { const e = document.createElementNS(this.NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; },
  // the dial angle of an hour in degrees, clockwise from the top (noon at the top)
  ang(h) { return ((h - 12) / 24) * 360; },
  pt(deg, r) { const a = (deg - 90) * DEG; return [Math.cos(a) * r, Math.sin(a) * r]; },
  arc(a0, a1, r0, r1) {
    // a ring segment from angle a0 to a1 (clockwise), radii r0 (inner) and r1 (outer)
    if (a1 - a0 >= 359.9) a1 = a0 + 359.9;
    const big = a1 - a0 > 180 ? 1 : 0, [x0, y0] = this.pt(a0, r1), [x1, y1] = this.pt(a1, r1), [x2, y2] = this.pt(a1, r0), [x3, y3] = this.pt(a0, r0);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${big} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
  },
  // the colour of the sky at an hour, for the dial
  skyCol(h) {
    const K = [[0, '#121a33'], [4.5, '#141d3a'], [5.75, '#7a4a5e'], [6.5, '#d98a52'], [8, '#e8c48e'], [12, '#efd9a8'], [17, '#e8c48e'], [19.25, '#d9823f'], [20.2, '#6a3f5a'], [21.2, '#18213f'], [24, '#121a33']];
    let i = 0; while (i < K.length - 2 && h > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], t = (h - a[0]) / (b[0] - a[0]);
    const ca = parseInt(a[1].slice(1), 16), cb = parseInt(b[1].slice(1), 16), m = mixc(rgb(ca), rgb(cb), clamp(t, 0, 1));
    return 'rgb(' + m.map((v) => Math.round(v * 255)).join(',') + ')';
  },
  build() {
    const root = this.el = document.getElementById('sleep');
    const svg = this.svgEl = this.svg('svg', { viewBox: '-170 -170 340 340', class: 'swSvg', role: 'img', 'aria-label': 'Rad zum Einstellen der Weckzeit' }, document.getElementById('sleepDial'));
    const defs = this.svg('defs', {}, svg);
    const grad = this.svg('radialGradient', { id: 'swWood', cx: '0', cy: '0', r: '1' }, defs);
    this.svg('stop', { offset: '0.82', 'stop-color': '#7a4d2c' }, grad); this.svg('stop', { offset: '1', 'stop-color': '#4a2c18' }, grad);
    // the dial: the sky through the day, hour ticks, numbers every three hours, sun at noon and moon at midnight
    const dial = this.svg('g', {}, svg);
    for (let i = 0; i < 48; i++) this.svg('path', { d: this.arc(this.ang(i / 2), this.ang(i / 2 + 0.5) + 0.3, 128, 162), fill: this.skyCol(i / 2 + 0.25) }, dial);
    // the band from now to the wake time, and the barred part the body will not sleep through
    this.bandBar = this.svg('path', { fill: 'rgba(40,14,8,0.62)', stroke: '#6e2a1c', 'stroke-width': 1.5 }, svg);
    this.band = this.svg('path', { fill: 'rgba(231,166,64,0.42)', stroke: '#e7a640', 'stroke-width': 1.5 }, svg);
    // ticks and numbers over the bands
    const top = this.svg('g', {}, svg);
    this.svg('circle', { r: 162, fill: 'none', stroke: '#1b120b', 'stroke-width': 2.5 }, top);
    for (let h = 0; h < 24; h++) {
      const big = h % 3 === 0, [x0, y0] = this.pt(this.ang(h), 128), [x1, y1] = this.pt(this.ang(h), big ? 140 : 134);
      this.svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: h >= 6 && h < 19 ? '#3a2416' : '#c9b48e', 'stroke-width': big ? 2.2 : 1.2 }, top);
      if (big) {
        const [tx, ty] = this.pt(this.ang(h), 151), t = this.svg('text', { x: tx.toFixed(1), y: (ty + 5).toFixed(1), class: 'swNum', fill: h >= 6 && h < 19 ? '#2a180e' : '#efe2c6' }, top);
        t.textContent = String(h);
      }
    }
    this.nowMark = this.svg('g', { class: 'swNow' }, svg);
    this.svg('circle', { r: 9, fill: '#1b120b', stroke: '#efe2c6', 'stroke-width': 1.5 }, this.nowMark);
    this.nowIcon = this.svg('text', { y: 4.5, class: 'swIcon' }, this.nowMark);
    // the wagon wheel: rim, twelve spokes, the hub; one spoke is shod in brass and points at the wake time
    const wheel = this.wheelG = this.svg('g', {}, svg);
    this.svg('circle', { r: 118, fill: 'none', stroke: 'url(#swWood)', 'stroke-width': 17 }, wheel);
    this.svg('circle', { r: 126, fill: 'none', stroke: '#2b2622', 'stroke-width': 3.5 }, wheel);   // the iron tyre
    for (let i = 0; i < 12; i++) {
      const a = i * 30, main = i === 0;
      const g = this.svg('g', { transform: `rotate(${a})` }, wheel);
      this.svg('path', { d: 'M-4.5 -30 L-3 -110 L3 -110 L4.5 -30 Z', fill: main ? '#e7a640' : '#8a5a34', stroke: '#3a2416', 'stroke-width': 1 }, g);
      if (main) this.svg('path', { d: 'M0 -132 L-7 -118 L7 -118 Z', fill: '#e7a640', stroke: '#3a2416', 'stroke-width': 1 }, g);
    }
    for (let i = 0; i < 24; i++) { const [x, y] = this.pt(i * 15 + 7.5, 118); this.svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.6, fill: '#2b2622' }, wheel); }   // the bolts of the felloes
    this.svg('circle', { r: 38, fill: '#6b4226', stroke: '#2b2622', 'stroke-width': 5 }, wheel);
    this.svg('circle', { r: 30, fill: 'rgba(27,18,11,0.92)' }, svg);
    // the middle: wake time and how long (does not turn)
    const mid = this.svg('g', { class: 'swMid' }, svg);
    this.tWake = this.svg('text', { y: 2, class: 'swWake' }, mid);
    this.tDur = this.svg('text', { y: 16, class: 'swDur' }, mid);
    // turning it: drag round the middle (mouse or finger)
    let last = null;
    const angOf = (e) => { const r = svg.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) / DEG; };
    svg.addEventListener('pointerdown', (e) => { if (this.st) return; e.preventDefault(); last = angOf(e); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    svg.addEventListener('pointermove', (e) => { if (last === null || this.st) return; const a = angOf(e), d = wrapA((a - last) * DEG) / DEG; last = a; this.turnBy(d / 360 * 1440, true); });
    const up = () => { last = null; this.snap(); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.st) this.step(e.deltaY > 0 ? 15 : -15); }, { passive: false });
    document.getElementById('sleepGo').addEventListener('click', () => this.go());
    document.getElementById('sleepBack').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (!this.open || this.st) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const by = { ArrowRight: 15, d: 15, ArrowLeft: -15, a: -15, ArrowUp: 60, w: 60, ArrowDown: -60, s: -60 }[k];
      if (by) { this.step(by); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (k === 'Enter' || k === 'e' || k === ' ') { this.go(); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (k === 'Escape') { this.close(); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    void root;
  },
  /* ---- open, turn, close ---- */
  show(ctx) {
    if (this.busy() || MENU.open) return;
    if (ctx.kind === 'bed' && !this.rented(ctx.where) && INV.money < this.PRICE[ctx.where]) { TOAST.show('Ein Zimmer kostet ' + this.PRICE[ctx.where] + ' ¢. So viel hast du nicht.'); return; }
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    INPUT.keys.clear();
    this.ctx = ctx; this.open = true;
    this.max = Math.max(15, REST.maxMinutes(ctx.kind));
    // a guess at what one wants: in the evening until seven in the morning, by day as long as the body allows
    const h = TIME.hour(), toMorning = TIME.until(7);
    this.mins = ctx.kind === 'nap' ? Math.min(60, this.max) : (h >= 19 || h < 5) ? Math.min(toMorning, this.max) : Math.min(120, this.max);
    this.mins = Math.max(15, Math.round(this.mins / 15) * 15);
    this.pos = this.mins;
    const where = ctx.kind === 'nap' ? 'Dösen im Sitzen' : (this.rented(ctx.where) ? 'Dein Zimmer im ' : 'Ein Zimmer im ') + this.NAME[ctx.where] + (this.rented(ctx.where) ? '' : ' · ' + this.PRICE[ctx.where] + ' ¢');
    document.getElementById('sleepWhere').textContent = where;
    document.getElementById('sleepBody').textContent = 'Du bist ' + REST.word() + ' · höchstens ' + this.dur(this.max);
    this.el.hidden = false; this.el.classList.remove('going', 'gone');
    document.getElementById('app').classList.add('sleeping');
    this.draw();
    worldEvent('sleepWheel', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player' });
  },
  close() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true; document.getElementById('app').classList.remove('sleeping');
  },
  dur(m) { const h = Math.floor(m / 60), mm = m % 60; return (h ? h + ' Std.' : '') + (h && mm ? ' ' : '') + (mm ? mm + ' Min.' : ''); },
  // turning by some minutes; free while dragging (pos), the time snaps to quarter hours with a click each
  turnBy(dm, drag) {
    const before = this.mins;
    this.pos = clamp((this.pos === undefined ? this.mins : this.pos) + dm, 15, this.max);
    const m = clamp(Math.round(this.pos / 15) * 15, 15, this.max);
    if (m !== before) { this.mins = m; this.click(m === this.max || m === 15); }
    else if ((this.pos >= this.max && dm > 0) || (this.pos <= 15 && dm < 0)) this.stuck();
    if (!drag) this.pos = this.mins;
    this.draw();
  },
  step(dm) { this.pos = this.mins; this.turnBy(dm, false); },
  snap() { this.pos = this.mins; this.draw(); },
  pad(x) {
    if (!this.open || this.st) return;
    this.padT = (this.padT || 0) - 1 / 60;
    if (Math.abs(x) < 0.4) { this.padT = 0; return; }
    if (this.padT <= 0) { this.step(x > 0 ? 15 : -15); this.padT = Math.abs(x) > 0.9 ? 0.06 : 0.15; }
  },
  draw() {
    const now = TIME.hour(), aNow = this.ang(now);
    // the brass spoke points at the wake time; while asleep a marker runs from now towards it
    const aWake = aNow + (this.st ? this.mins : this.pos) / 4, aMark = aNow + (this.st ? this.shown : 0) / 4;
    this.wheelG.setAttribute('transform', `rotate(${aWake.toFixed(2)})`);
    this.band.setAttribute('d', aWake - aMark > 0.5 ? this.arc(aMark, aWake, 128, 162) : '');
    this.bandBar.setAttribute('d', this.st ? '' : this.arc(aNow + this.max / 4, aNow + 360, 128, 162));
    const [nx, ny] = this.pt(aMark, 145);
    this.nowMark.setAttribute('transform', `translate(${nx.toFixed(1)} ${ny.toFixed(1)})`);
    const hMark = (TIME.min + (this.st ? this.shown : 0)) / 60 % 24;
    this.nowIcon.textContent = hMark >= 6 && hMark < 19.5 ? '☀' : '☾';
    this.tWake.textContent = TIME.str(TIME.min + (this.st ? this.shown : this.mins));
    this.tDur.textContent = this.st ? 'schläft …' : this.dur(this.mins);
    document.getElementById('sleepGo').textContent = this.ctx && this.ctx.kind === 'nap' ? 'Dösen' : 'Schlafen';
  },
  click(hard) {
    GSFX.run(() => { const { g, t } = GSFX.out(0.4); SFX.noiseHit(t, g, { type: 'bandpass', freq: hard ? 900 : 2300 + Math.random() * 300, q: 6, gain: hard ? 0.35 : 0.22, attack: 0.0008, decay: hard ? 0.05 : 0.018 }); });
  },
  stuck() {
    if (G.time - (this.stuckT || 0) < 0.25 && !G.manual) return;
    this.stuckT = G.time;
    GSFX.run(() => { const { g, t } = GSFX.out(0.4); SFX.thump(t, g, 140, 60, 0.4, 0.08); SFX.noiseHit(t, g, { type: 'lowpass', freq: 600, q: 1, gain: 0.25, attack: 0.001, decay: 0.06 }); });
    this.el.classList.remove('stuck'); void this.el.offsetWidth; this.el.classList.add('stuck');
  },

  /* ---- sleeping: eyes shut, the hours run on the wheel, wake up ---- */
  go() {
    if (!this.open || this.st) return;
    const C = this.ctx;
    if (C.kind === 'bed' && !this.rented(C.where)) {
      const p = this.PRICE[C.where];
      if (INV.money < p) { TOAST.show('Dafür reicht dein Geld nicht.'); return; }
      INV.money -= p; TOAST.show('Zimmer gemietet (−' + p + ' ¢), bis morgen Mittag.', 'money');
      const noon = Math.floor((TIME.min + this.mins) / 1440) * 1440 + 12 * 60;
      this.rent = { where: C.where, until: Math.max(noon, TIME.min + this.mins + 60) };
    }
    if (C.kind === 'bed' && C.place) AMB.doorOpen(new THREE.Vector3(C.place.x, C.place.y + 1, C.place.z));
    this.open = false; this.st = 'close'; this.t = 0; this.shown = 0; this.fx = { dark: 0, lid: 0 };
    this.el.classList.add('going');
  },
  update(rdt) {
    if (this.open && !this.st) { if (INPUT.padX) this.pad(INPUT.padX); return; }
    if (!this.st) return;
    const F = this.fx; this.t += rdt;
    if (this.st === 'close') {
      F.dark = smoothstep(0, 1.3, this.t);
      if (this.t > 1.4) { this.st = 'run'; this.t = 0; }
    } else if (this.st === 'run') {
      // the hours fly by on the wheel: about two and a half seconds, a click every quarter hour
      const T = clamp(1.2 + this.mins / 600, 1.4, 2.6), u = smoothstep(0, 1, Math.min(1, this.t / T)), m = Math.round(u * this.mins / 15) * 15;
      if (m !== this.shown) { this.shown = m; this.click(false); }
      this.draw();
      if (this.t > T + 0.5) this.wake();
    } else if (this.st === 'wake') {
      // the eyes open: a slow blink or two (shorter than after a binge)
      const K = [[0, 1], [0.9, 0.55], [1.3, 0.62], [1.7, 0.9], [2.0, 0.85], [3.0, 0]];
      let i = 0; while (i < K.length - 2 && this.t > K[i + 1][0]) i++;
      F.lid = K[i][1] + (K[i + 1][1] - K[i][1]) * smoothstep(K[i][0], K[i + 1][0], this.t);
      F.dark = 0;
      if (this.t > 0.4) this.el.classList.add('gone');
      if (this.t > 3.1) { this.st = null; this.fx = null; this.el.hidden = true; document.getElementById('app').classList.remove('sleeping'); }
    }
  },
  wake() {
    const C = this.ctx, m = this.mins;
    REST.slept(m);
    TIME.skip(m);
    DAYNIGHT.update(0, true);
    // in a room you come out of the door again, facing the corridor; dozing, you are still in your chair
    if (C.kind === 'bed' && C.place) {
      const P = C.place;
      PLAY.pos.set(P.sx, P.y, P.sz); PLAY.yaw = P.faceYaw + Math.PI; PLAY.camYaw = P.faceYaw; PLAY.vx = PLAY.vz = 0; GAIT.init = false; G.lookAt = null;
      AMB.doorClose(new THREE.Vector3(P.x, P.y + 1, P.z));
    }
    this.st = 'wake'; this.t = 0; this.fx.dark = 0; this.fx.lid = 1;
    const h = TIME.hour(), when = h < 11 ? 'Guten Morgen' : h < 18 ? 'Ausgeruht' : 'Guten Abend';
    TOAST.show(C.kind === 'nap' ? 'Du hast ' + this.dur(m) + ' gedöst. Es ist ' + TIME.str() + '.' : when + '. Es ist ' + TIME.str() + ' Uhr, du hast ' + this.dur(m) + ' geschlafen.', 'long');
    worldEvent('slept', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', minutes: m, kind: C.kind });
    SAVE.write();
  }
};
SAVE.part('sleep', () => ({ rent: SLEEP.rent }), (d) => { SLEEP.rent = d && d.rent && typeof d.rent.where === 'string' && isFinite(+d.rent.until) ? { where: d.rent.where, until: +d.rent.until } : null; });
