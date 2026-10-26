/* ---------- drinking: ordering at a bar, the glass sliding along the counter, taking a sip ----------
   GLASS is the one drink served to the player (on the counter, or in the hand). DRINK animates the right arm:
   reach for the glass (or the bottle at the hip), lift it to the mouth, tip it, put it back, let go.
   Bars are COUNTERS registered by the interiors; SHOP is the little order list. */

/* vessels: built once, origin at the bottom centre; full and empty versions */
const VESSEL = {
  shot:   { h: 0.062, grip: 0.03, tilt: 1.9 },
  mug:    { h: 0.125, grip: 0.06, tilt: 1.25 },
  glass:  { h: 0.105, grip: 0.05, tilt: 1.15 },
  bottle: { h: 0.263, grip: 0.08, tilt: 1.75 },
  geo: {},
  build() {
    const G0 = rgb(0xc9dcdc), whisky = rgb(0xb8762a), beer = rgb(0xd99a2c), foam = rgb(0xf3ead6), water = rgb(0xa9cdd8);
    const make = (fn) => { const mb = new MB(); fn(mb); return mb.build(); };
    for (const full of [true, false]) {
      this.geo['shot' + full] = make((mb) => { mb.cyl(0, 0, 0, 0.026, 0.031, 0.062, 8, G0, 0, { bottom: true }); if (full) mb.cyl(0, 0.006, 0, 0.027, 0.029, 0.042, 8, whisky, 0); });
      this.geo['mug' + full] = make((mb) => {
        mb.cyl(0, 0, 0, 0.042, 0.044, 0.125, 9, G0, 0, { bottom: true });
        mb.box(0.052, 0.025, 0, 0.018, 0.075, 0.016, G0, 0); mb.box(0.042, 0.095, 0, 0.03, 0.014, 0.016, G0, 0); mb.box(0.042, 0.022, 0, 0.03, 0.014, 0.016, G0, 0);
        if (full) { mb.cyl(0, 0.008, 0, 0.043, 0.044, 0.095, 9, beer, 0); mb.cyl(0, 0.103, 0, 0.045, 0.046, 0.026, 9, foam, 0); }
      });
      this.geo['glass' + full] = make((mb) => { mb.cyl(0, 0, 0, 0.03, 0.035, 0.105, 8, G0, 0, { bottom: true }); if (full) mb.cyl(0, 0.006, 0, 0.031, 0.034, 0.075, 8, water, 0); });
      this.geo['bottle' + full] = make((mb) => {
        const glassC = rgb(0x5a3e1c);
        mb.cyl(0, 0, 0, 0.036, 0.036, 0.15, 8, glassC, 0, { bottom: true });
        mb.cyl(0, 0.15, 0, 0.036, 0.015, 0.045, 8, glassC, 0, { noTop: true });
        mb.cyl(0, 0.195, 0, 0.015, 0.015, 0.05, 6, glassC, 0);
        mb.cyl(0, 0.245, 0, 0.012, 0.012, 0.018, 6, rgb(0xb89a6a), 0);
        mb.box(0, 0.04, 0.03, 0.05, 0.07, 0.012, rgb(0xeee2c6), 0);
      });
    }
  }
};

const GLASS = {
  obj: null, mesh: null, bottle: null, m: new THREE.Matrix4(), bm: new THREE.Matrix4(), q: new THREE.Matrix4(), farT: 0,
  init(scene) {
    VESSEL.build();
    const mk = (geo) => { const m = new THREE.Mesh(geo, G.litMat); m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false; m.layers.enable(2); scene.add(m); return m; };
    this.mesh = mk(VESSEL.geo.shottrue);       // the served drink
    this.bottle = mk(VESSEL.geo.bottletrue);   // a bottle from the bag, only while drinking from it
  },
  // a fresh drink slides along the counter from its far end to `to`
  serve(id, counter, to) {
    const it = ITEMS[id], ax = counter.ax, az = counter.az, bx = counter.bx, bz = counter.bz;
    const da = Math.hypot(to.x - ax, to.z - az), db = Math.hypot(to.x - bx, to.z - bz);
    const [sx, sz] = da > db ? [ax, az] : [bx, bz], L = Math.max(da, db) || 1;
    const fx = Math.sin(counter.yaw), fz = Math.cos(counter.yaw);
    const from = new THREE.Vector3(sx + ((to.x - sx) / L) * 0.3 + fx * 0.1, to.y, sz + ((to.z - sz) / L) * 0.3 + fz * 0.1);
    this.obj = { id, it, left: it.sips, from, pos: from.clone(), to: to.clone(), slideT: 0, slideDur: 0.4 + from.distanceTo(to) / 3.2, held: false, tilt: 0, yaw: counter.yaw + Math.PI, room: counter.room };
    this.mesh.geometry = VESSEL.geo[it.vessel + 'true'];
    this.mesh.visible = true; this.farT = 0;
    this.slideSound(this.obj.slideDur);
  },
  ready() { const o = this.obj; return o && !o.held && o.slideT >= o.slideDur && o.left > 0; },
  clear() { if (DRINK.src === 'glass' && DRINK.st !== 'idle') DRINK.cancel(); this.obj = null; this.mesh.visible = false; },
  update(dt) {
    const o = this.obj;
    if (!o) return;
    if (o.slideT < o.slideDur) {
      o.slideT = Math.min(o.slideDur, o.slideT + dt);
      const u = 1 - Math.pow(1 - o.slideT / o.slideDur, 2.2);
      o.pos.lerpVectors(o.from, o.to, u);
      if (o.slideT >= o.slideDur) this.clink(0.6);
    }
    // left behind: gone after a while (taken away)
    const d = Math.hypot(PLAY.pos.x - o.to.x, PLAY.pos.z - o.to.z);
    this.farT = d > 5 ? this.farT + dt : 0;
    if (this.farT > 6) { this.clear(); return; }
    if (!o.held) { this.m.makeRotationY(o.yaw); this.m.setPosition(o.pos); }
    this.mesh.matrix.copy(this.m); this.mesh.matrixWorldNeedsUpdate = true;
    this.mesh.material = W.ch.parts[0].material;
    this.mesh.visible = !o.room || o.room.mesh.visible;
  },
  slideSound(dur) {
    GSFX.run(() => { const { g, t } = GSFX.out(0.35, this.obj.from); SFX.noiseHit(t, g, { type: 'bandpass', freq: 900, q: 0.6, gain: 0.05, attack: 0.05, decay: dur * 0.8 }); });
  },
  clink(k) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.35 * k, this.obj ? this.obj.pos : PLAY.pos);
      for (const f of [2350, 3720]) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * (0.97 + Math.random() * 0.06); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.06, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.2); }
      SFX.noiseHit(t, g, { type: 'highpass', freq: 3000, q: 0.7, gain: 0.04, attack: 0.001, decay: 0.02 });
    });
  }
};

/* ---- the drinking arm ---- */
const DRINK = {
  st: 'idle', t: 0, src: null, it: null, w: 0, from: new THREE.Vector3(), hand: new THREE.Vector3(), tip: 0, queued: null,
  _a: new THREE.Vector3(), _b: new THREE.Vector3(), _p: new THREE.Vector3(), _q: new THREE.Vector3(),
  PH: { reach: 0.42, lift: 0.45, lower: 0.42, back: 0.35 },
  busy() { return this.st !== 'idle' || !!this.queued; },
  // src: 'glass' (the served one) or 'bottle' (from the bag)
  start(src) {
    if (this.busy() || DRUNK.blocked()) return false;
    if (src === 'glass' && !GLASS.ready()) return false;
    if (src === 'bottle' && !INV.has('bottle')) return false;
    FIST.fight = 0; FIST.queued = false;
    if (GUN.state !== 'holster') { if (GUN.state === 'drawn' || GUN.state === 'reload') GUN.toggleHolster(); this.queued = src; return true; }
    this.src = src; this.it = src === 'glass' ? GLASS.obj.it : ITEMS.bottle;
    this.st = 'reach'; this.t = 0; this.tip = 0; this.fromSet = false;
    return true;
  },
  cancel() { if (this.src === 'glass' && GLASS.obj) { GLASS.obj.held = false; } this.st = 'idle'; this.queued = null; this.w = 0; this.bottleOut = false; },
  update(dt) {
    if (this.queued && GUN.state === 'holster') { const s = this.queued; this.queued = null; this.start(s); }
    if (this.st === 'idle') return;
    if (this.src === 'glass' && !GLASS.obj) { this.cancel(); return; }
    this.t += dt;
    const dur = this.st === 'sip' ? this.it.sipT : this.PH[this.st];
    if (this.t < dur) return;
    this.t -= dur;
    if (this.st === 'reach') { this.st = 'lift'; if (this.src === 'glass') GLASS.obj.held = true; else this.bottleOut = true; }
    else if (this.st === 'lift') { this.st = 'sip'; this.gulp(); }
    else if (this.st === 'sip') {
      this.st = 'lower';
      DRUNK.drink(this.it.alc);
      worldEvent('drink', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', what: this.src === 'glass' ? GLASS.obj.id : 'bottle' });
      if (this.src === 'glass') { GLASS.obj.left--; if (GLASS.obj.left <= 0) GLASS.mesh.geometry = VESSEL.geo[GLASS.obj.it.vessel + 'false']; }
      else INV.sipFrom('bottle');
      if (this.it.alc > 0.1) this.exhale();
    } else if (this.st === 'lower') { this.st = 'back'; if (this.src === 'glass') { GLASS.obj.held = false; GLASS.clink(1); } else this.bottleOut = false; }
    else { this.st = 'idle'; this.w = 0; }
  },
  // where things are, in character space
  restSpot(out) {
    if (this.src === 'glass') return SIT.toChar(this._p.copy(GLASS.obj.pos).setY(GLASS.obj.pos.y + VESSEL[GLASS.obj.it.vessel].grip), out);
    return out.set(-0.24, W.ch.pose.pel.y - 0.04, 0.12);   // the bottle comes from the right hip
  },
  // the hand, so that the rim of the tipped vessel touches the lips
  mouth(out, V) {
    out.set(0, RIG.neckY + 0.085, 0.16).applyMatrix4(AIK.tor);
    const up = V.h - V.grip;
    return out.set(out.x, out.y - up * Math.cos(this.tip), out.z + up * Math.sin(this.tip));
  },
  /* called after the body is posed: the right hand follows the drink */
  pose(P, dt) {
    if (this.st === 'idle') return;
    if (this.src === 'glass' && !GLASS.obj) { this.cancel(); return; }
    if (!this.fromSet) { this.from.set(0, -0.3, 0.02).applyMatrix4(W.ch.p.fArmR.matrix); this.fromSet = true; }
    torsoInverse(P); AIK.ready = true;
    const e = (x) => x * x * (3 - 2 * x), u = e(clamp(this.t / (this.st === 'sip' ? this.it.sipT : this.PH[this.st]), 0, 1));
    const V = VESSEL[this.it.vessel], rest = this.restSpot(this._a), mouth = this.mouth(this._b, V);
    let w = 1, tipGoal = 0, headBack = 0;
    if (this.st === 'reach') { this.hand.lerpVectors(this.from, rest, u); w = u; }
    else if (this.st === 'lift') { this.hand.lerpVectors(rest, mouth, u); tipGoal = 0.25 * u; }
    else if (this.st === 'sip') { this.hand.copy(mouth); this.hand.y += 0.02 * Math.sin(Math.PI * u); tipGoal = 0.25 + (V.tilt - 0.25) * Math.sin(Math.PI * Math.min(1, u * 1.15)); headBack = Math.sin(Math.PI * u); }
    else if (this.st === 'lower') { this.hand.lerpVectors(mouth, rest, u); tipGoal = 0.25 * (1 - u); }
    else { this.hand.lerpVectors(rest, this.from, u); w = 1 - u; }
    this.tip += (tipGoal - this.tip) * (1 - Math.exp(-dt * 14));
    this.w = w;
    P.hdPitch -= headBack * (V.tilt > 1.6 ? 0.42 : 0.28);
    P.spPitch -= headBack * 0.07;
    torsoInverse(P);
    const up = this.st === 'sip' || this.st === 'lift';
    // the elbow hangs down and a little out; with the hand at the mouth "out" alone would point it forwards
    const pole = this._q.set(up ? -0.45 : -0.8, -1, up ? -0.15 : -0.25);
    const r = armIK(1, this.hand, pole);
    const base = P.armOv[1];
    // blend from whatever the arm was doing (sitting at the bar, hanging) to the drinking arm
    if (base && base.w > 0.001) P.armOv[1] = { w: lerp(base.w, 1, w), sw: lerp(base.sw, r.sw, w), yw: lerp(base.yw, r.yw, w), out: lerp(base.out, r.out, w), el: lerp(base.el, r.el, w) };
    else P.armOv[1] = { w, sw: r.sw, yw: r.yw, out: r.out, el: r.el };
  },
  // after the pose is applied: put the vessel in the hand
  late() {
    const bottle = this.src === 'bottle' && this.bottleOut && this.st !== 'idle';
    GLASS.bottle.visible = bottle;
    const held = bottle || (this.st !== 'idle' && this.src === 'glass' && GLASS.obj && GLASS.obj.held);
    if (!held) return;
    const V = VESSEL[this.it.vessel], ch = W.ch, mesh = bottle ? GLASS.bottle : GLASS.mesh, M = bottle ? GLASS.bm : GLASS.m;
    ch.root.updateMatrixWorld();
    // the grip point of the vessel sits in the fist; the vessel turns with the body and tips towards the mouth
    const h = this._p.set(0, -0.31, 0.045).applyMatrix4(ch.p.fArmR.matrix).applyMatrix4(ch.root.matrixWorld);
    M.makeRotationY(PLAY.yaw).multiply(GLASS.q.makeRotationX(-this.tip));
    const off = this._a.set(0, -V.grip, 0).transformDirection(M).multiplyScalar(V.grip);
    M.setPosition(h.x + off.x, h.y + off.y, h.z + off.z);
    mesh.matrix.copy(M); mesh.matrixWorldNeedsUpdate = true;
    mesh.material = ch.parts[0].material;
  },
  // the recording (gulps), once for a shot, a few times for a long drink; the synthesised gulp only if it is missing
  gulp() {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.55, PLAY.pos), n = Math.max(1, Math.round(this.it.sipT / 0.42));
      for (let i = 0; i < n; i++) {
        const t0 = t + 0.08 + i * 0.36;
        if (GSFX.play('drink', g, t0, 0.92 + Math.random() * 0.14, 0.9)) continue;
        const o = c.createOscillator(), og = c.createGain();
        o.frequency.setValueAtTime(170, t0); o.frequency.exponentialRampToValueAtTime(85, t0 + 0.09);
        og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(0.16, t0 + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + 0.14);
      }
    });
  },
  exhale() { GSFX.run(() => { const { g, t } = GSFX.out(0.35, PLAY.pos); SFX.noiseHit(t + 0.15, g, { type: 'lowpass', freq: 700, q: 0.6, gain: 0.07, attack: 0.08, decay: 0.45 }); }); }
};

/* ---- bars: an entry per counter for the interaction system ---- */
function makeCounter(C) {
  const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), ux = C.bx - C.ax, uz = C.bz - C.az, L = Math.hypot(ux, uz);
  return Object.assign(C, {
    fx, fz, L, verb: 'bar', wide: true, x: (C.ax + C.bx) / 2, z: (C.az + C.bz) / 2,
    // the nearest point on the front edge, and how far p is from it (on the customers' side only)
    near(p) {
      const t = clamp(((p.x - C.ax) * ux + (p.z - C.az) * uz) / (L * L), 0.05, 0.95);
      const qx = C.ax + ux * t, qz = C.az + uz * t, side = (qx - p.x) * fx + (qz - p.z) * fz;
      return { qx, qz, d: Math.hypot(p.x - qx, p.z - qz), side };
    },
    score(p) {
      const n = this.near(p);
      if (n.side < 0 || n.d > 1.25) return 1e9;
      const a = Math.abs(wrapA(C.yaw - PLAY.yaw));
      if (a > 1.7) return 1e9;
      // a drink waiting in front of you makes the bar the first thing on offer
      const waiting = GLASS.ready() && Math.hypot(GLASS.obj.pos.x - p.x, GLASS.obj.pos.z - p.z) < 1.1;
      return n.d + a * 0.4 - (waiting ? 1 : 0);
    },
    // where a drink goes for someone standing at p
    // (a little to the right, where the right hand reaches it)
    spot(p) { const n = this.near(p), rx = -Math.cos(C.yaw), rz = Math.sin(C.yaw); return new THREE.Vector3(n.qx + fx * 0.14 + rx * 0.15, C.y + C.top, n.qz + fz * 0.14 + rz * 0.15); },
    actions() { return barActions(this, null); }
  });
}
function barActions(counter, seat) {
  const out = [];
  if (GLASS.ready() && Math.hypot(GLASS.obj.pos.x - PLAY.pos.x, GLASS.obj.pos.z - PLAY.pos.z) < 1.1) out.push({ label: 'Trinken (' + GLASS.obj.it.name + ')', run: () => DRINK.start('glass') });
  out.push({ label: 'Bestellen', run: () => SHOP.show(counter, seat) });
  return out;
}

/* ---- the order list ---- */
const SHOP = {
  open: false, counter: null, seat: null,
  init() {
    this.el = document.getElementById('shop'); this.list = document.getElementById('shopList');
    document.getElementById('shopClose').addEventListener('click', () => this.close());
  },
  show(counter, seat) {
    this.counter = counter; this.seat = seat; this.open = true;
    INPUT.keys.clear();
    document.getElementById('shopMoney').textContent = money(INV.money);
    this.list.textContent = '';
    MENU_BAR.forEach((id, i) => {
      const it = ITEMS[id], b = document.createElement('button'); b.type = 'button';
      const can = INV.money >= it.price;
      b.innerHTML = `<kbd>${i + 1}</kbd><span></span><em></em>`;
      b.querySelector('span').textContent = it.name; b.querySelector('em').textContent = price(it.price);
      b.disabled = !can; if (!can) b.title = 'Nicht genug Geld';
      b.addEventListener('click', () => this.buy(id));
      this.list.appendChild(b);
    });
    this.el.hidden = false;
    const first = this.list.querySelector('button:not([disabled])'); if (first) first.focus({ preventScroll: true });
  },
  close() { this.open = false; this.el.hidden = true; document.getElementById('gl').focus({ preventScroll: true }); },
  key(k) {
    if (k === 'Escape' || k === 'e') { this.close(); return true; }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= MENU_BAR.length) { this.buy(MENU_BAR[n - 1]); return true; }
    return false;
  },
  buy(id) {
    const it = ITEMS[id];
    if (!INV.pay(it.price)) { TOAST.show('Nicht genug Geld.'); return; }
    this.close();
    worldEvent('buy', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', what: id, price: it.price });
    if (it.kind === 'carry') { INV.add(id); TOAST.show(it.name + ' gekauft. Trinken mit T oder im Menü unter „Tasche“.', 'long'); return; }
    const C = this.counter, to = this.seat ? this.seatSpot(this.seat) : C.spot(PLAY.pos);
    GLASS.serve(id, C, to);
  },
  // the glass for someone on a bar stool: a hand's width right of the middle, on the counter
  seatSpot(seat) { const v = new THREE.Vector3(); SIT.seatW(-0.17, seat.bar.y, seat.bar.z + 0.02, v); return v; }
};
