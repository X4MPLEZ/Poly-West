/* ---------- interaction: one system for everything one can use ----------
   Every usable thing is an entry with a place, the room it belongs to, an occupant and a verb. The best entry
   near you and in front of you is in focus; E (pad: Y, touch: the context button) uses it.
   NPCs will later look up and use the same entries (seat.occ tells who sits where). */

// how one sits on each kind of seat (seat frame: z forward, y up from the floor under the seat)
//   top: seat height, back: hips behind the seat centre, foot/footY/footW: ankles ahead / height / apart,
//   lean: upper body (+ forward), stand: where one stands before sitting down (side: beside it instead, open: no backrest,
//   come from anywhere), wood: the seat creaks
const SIT_KINDS = {
  chair:  { top: 0.5,  back: -0.03, foot: 0.44, footY: 0.085, footW: 0.15, lean: 0.05, stand: 0.3, wood: true },
  bench:  { top: 0.47, back: -0.02, foot: 0.44, footY: 0.085, footW: 0.16, lean: 0.08, stand: 0.3, wood: true },
  pew:    { top: 0.47, back: -0.02, foot: 0.42, footY: 0.085, footW: 0.13, lean: 0.0, stand: 0.3, wood: true },
  sofa:   { top: 0.43, back: -0.05, foot: 0.52, footY: 0.085, footW: 0.18, lean: -0.1, stand: 0.42 },
  barber: { top: 0.6,  back: -0.04, foot: 0.43, footY: 0.33, footW: 0.12, lean: -0.08, stand: 0.38, arms: [0.31, 0.88, 0.1] },
  stool:  { top: 0.78, back: -0.02, foot: 0.19, footY: 0.36, footW: 0.17, lean: 0.14, stand: -0.02, side: 0.42, open: true, wood: true }
};

const INTERACT = {
  items: [], grid: new Map(), cell: 4, focus: null, label: '', _near: [],
  add(it) {
    it.id = this.items.length; this.items.push(it);
    const k = Math.floor(it.x / this.cell) + ',' + Math.floor(it.z / this.cell);
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(it);
    return it;
  },
  near(x, z, r) {
    const out = this._near, c = this.cell; out.length = 0;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) { const L = this.grid.get(i + ',' + j); if (L) for (const it of L) out.push(it); }
    return out;
  },
  init() {
    for (const S of SEATS) {
      const it = this.add(makeSeat(S));
      // where to stand: in front, clear of the seat's own collider (a bench); if a table or desk is in the way,
      // beside the seat instead, on whichever side is free (a chair tucked under a table is slid onto from the side)
      const y = it.y + 0.1, free = (x, z) => { const [cx, cz] = collide(x, z, y); return Math.hypot(cx - x, cz - z) < 0.1; };
      if (!it.k.side) {
        const [cx, cz] = collide(it.sx, it.sz, y);
        if (Math.hypot(cx - it.sx, cz - it.sz) < 0.05) continue;
        if (Math.hypot(cx - it.x, cz - it.z) > it.k.stand * 0.85 && Math.hypot(cx - it.sx, cz - it.sz) < 0.4) { it.sx = cx; it.sz = cz; continue; }
        const sides = [1, -1].filter((sd) => free(it.x + it.fz * 0.45 * sd, it.z - it.fx * 0.45 * sd));
        if (sides.length) { it.sides = sides; it.sideD = 0.45; it.sx = it.x - it.fx * 0.02; it.sz = it.z - it.fz * 0.02; }
      } else { it.sides = [1, -1]; it.sideD = it.k.side; }
    }
    this.el = document.getElementById('prompt'); this.txt = document.getElementById('promptTxt'); this.btn = document.getElementById('bUse');
    this.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.btn.classList.add('down'); this.use(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.btn.addEventListener(ev, () => this.btn.classList.remove('down'));
  },
  use() {
    if (SIT.state === 'sit') { SIT.stand(); return; }
    if (SIT.state === 'none' && this.focus) this.focus.use();
  },
  // a straight walk from a to b must not lead through furniture (tables between you and a chair, say)
  clear(ax, az, bx, bz, y) {
    const L = Math.hypot(bx - ax, bz - az);
    for (let s = 0.3; s < L - 0.45; s += 0.3) {
      const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L, [cx, cz] = collide(x, z, y);
      if (Math.hypot(cx - x, cz - z) > 0.22) return false;
    }
    return true;
  },
  update() {
    if (this.seated !== SIT.busy()) { this.seated = SIT.busy(); document.getElementById('app').classList.toggle('seated', this.seated); }
    let best = null, label = '';
    if (SIT.state === 'sit') { best = SIT.seat; label = 'Aufstehen'; }
    else if (SIT.state === 'none' && G.frameNo % 3 !== 0 && this.focus && this.focus.verb && !this.focus.occ) return;   // the search runs every third frame
    else if (SIT.state === 'none' && !GUN.aiming() && FIST.st === 'idle' && !(GUN.state === 'draw' || GUN.state === 'holstering')) {
      const p = PLAY.pos, room = ROOMSTATE.cur;
      let bs = 1e9;
      for (const it of this.near(p.x, p.z, 2.2)) {
        if (it.room !== room || it.occ || Math.abs(it.y - p.y) > 0.6) continue;
        const s = it.score(p);
        if (s < bs) { bs = s; best = it; }
      }
      if (best) label = best.label;
    }
    this.focus = best;
    if (label !== this.label) {
      this.label = label;
      this.el.hidden = !label; this.txt.textContent = label;
      this.btn.hidden = !label; this.btn.textContent = label;
    }
  }
};

function makeSeat(S) {
  const k = SIT_KINDS[S.kind] || SIT_KINDS.chair;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  return Object.assign(S, {
    k, fx, fz, occ: null, verb: 'sit', label: 'Hinsetzen',
    sx: S.x + fx * k.stand, sz: S.z + fz * k.stand,   // where one stands before sitting down
    // that spot as seen from p: seats taken from the side (stools, tucked chairs) from the free side nearer to you
    spot(p) {
      if (!this.sides) return [this.sx, this.sz];
      let side = (p.x - this.x) * this.fz - (p.z - this.z) * this.fx >= 0 ? 1 : -1;   // + = the seat's left (+x)
      if (!this.sides.includes(side)) side = -side;
      return [this.sx + this.fz * this.sideD * side, this.sz - this.fx * this.sideD * side];
    },
    score(p) {
      const [sx, sz] = this.spot(p), dx = sx - p.x, dz = sz - p.z, d = Math.hypot(dx, dz);
      if (d > 1.55) return 1e9;
      // not from behind the backrest, and roughly where you look or walk
      if (!this.k.open && (p.x - this.x) * this.fx + (p.z - this.z) * this.fz < (this.sides ? -0.4 : -0.15)) return 1e9;
      const toward = Math.atan2(this.x - p.x, this.z - p.z), a = d < 0.45 ? 0 : Math.abs(wrapA(toward - PLAY.yaw));
      if (a > 1.9) return 1e9;
      if (!INTERACT.clear(p.x, p.z, sx, sz, p.y)) return 1e9;
      return d + a * 0.45;
    },
    use() { SIT.begin(this); }
  });
}

/* ---------- sitting down, sitting, standing up ----------
   approach: walk to the spot in front of the seat and turn round; down: hips back and down, upper body forward,
   feet shuffle to their places; sit: breathe and look about; up: the same backwards. The seat owns the pose meanwhile. */
const SIT = {
  state: 'none', seat: null, t: 0, w: 0, look: 0, lookTo: 0, lookNext: 2,
  from: new THREE.Vector3(), yaw0: 0, feetFrom: [new THREE.Vector3(), new THREE.Vector3()], feetTo: [new THREE.Vector3(), new THREE.Vector3()],
  _v: new THREE.Vector3(), _h: new THREE.Vector3(), _k: new THREE.Vector3(), _p: new THREE.Vector3(),
  busy() { return this.state !== 'none'; },
  owns() { return this.state === 'down' || this.state === 'sit' || this.state === 'up'; },
  begin(seat) {
    if (this.state !== 'none' || seat.occ) return;
    if (GUN.state === 'drawn' || GUN.state === 'reload') GUN.toggleHolster();
    GUN.setAim(false); GUN.hipT = 0;
    FIST.fight = 0; FIST.queued = false; FIST.holding = false;
    this.seat = seat; seat.occ = 'player'; this.state = 'approach'; this.t = 0;
    [this.sx, this.sz] = seat.spot(PLAY.pos);
  },
  cancel() { if (this.seat) this.seat.occ = null; this.seat = null; this.state = 'none'; this.w = 0; },
  stand() {
    if (this.state === 'approach') { this.cancel(); return; }
    if (this.state !== 'sit') return;
    const S = this.seat;
    this.state = 'up'; this.t = 0;
    for (let i = 0; i < 2; i++) { this.feetFrom[i].copy(this.feetTo[i]); restPoint(i, this._v.set(this.sx, S.y, this.sz), S.yaw, this.feetTo[i]); this.feetTo[i].y += RIG.ankleH; }
    this.sound(false);
  },
  // the seat point in world space from seat-frame coordinates
  seatW(lx, ly, lz, out) { const S = this.seat; return out.set(S.x + lx * Math.cos(S.yaw) + lz * S.fx, S.y + ly, S.z - lx * Math.sin(S.yaw) + lz * S.fz); },
  // world -> character space (root at PLAY.pos, turned by PLAY.yaw)
  toChar(w, out) {
    const dx = w.x - PLAY.pos.x, dz = w.z - PLAY.pos.z, c = Math.cos(-PLAY.yaw), s = Math.sin(-PLAY.yaw);
    return out.set(dx * c + dz * s, w.y - PLAY.pos.y, -dx * s + dz * c);
  },
  sound(down) {
    const S = this.seat, wood = S && S.k.wood;
    FSFX.cloth();
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.5, PLAY.pos);
      if (down) SFX.thump(t + 0.5, g, 120, 55, 0.22, 0.09);
      if (wood) SFX.noiseHit(t + (down ? 0.52 : 0.08), g, { freq: 230 + Math.random() * 90, q: 11, gain: 0.07, attack: 0.04, decay: 0.24 });
    });
  },

  /* called by updatePlayer: true while the seat moves the player */
  drive(dt, mag) {
    if (this.state === 'none') return false;
    const S = this.seat, p = PLAY.pos;
    if (this.state === 'approach') {
      this.t += dt;
      if (mag > 0.3 && this.t > 0.2) { this.cancel(); return false; }
      const dx = this.sx - p.x, dz = this.sz - p.z, d = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (d > 0.03) { const sp = Math.min(WALK, 0.2 + d * 3.0); vx = (dx / d) * sp; vz = (dz / d) * sp; }
      const a = 1 - Math.exp(-dt * 10);
      PLAY.vx += (vx - PLAY.vx) * a; PLAY.vz += (vz - PLAY.vz) * a;
      // face the way you walk while still a step away, then turn round to the seat
      const ty = d > 0.3 ? Math.atan2(dx, dz) : S.yaw;
      PLAY.yaw += wrapA(ty - PLAY.yaw) * (1 - Math.exp(-dt * (d > 0.3 ? 12 : 8)));
      p.x += PLAY.vx * dt; p.z += PLAY.vz * dt;
      p.y += (groundAt(p.x, p.z, p.y) - p.y) * (1 - Math.exp(-dt * 18));
      const ready = GUN.state === 'holster' && d < 0.06 && Math.abs(wrapA(S.yaw - PLAY.yaw)) < 0.22 && !GAIT.feet[0].swing && !GAIT.feet[1].swing;
      if (ready || this.t > 3.5) this.startDown();
    } else {
      PLAY.vx = PLAY.vz = 0;
      if (this.state === 'down') {
        this.t = Math.min(1, this.t + dt / 0.8);
        if (this.t >= 1) { this.state = 'sit'; this.t = 0; worldEvent('sit', S.x, S.y, S.z, { by: 'player', seat: S.id, room: S.room ? S.room.type : null }); }
      } else if (this.state === 'sit') {
        this.t += dt;
        if (mag > 0.35 && this.t > 0.25) this.stand();
      }
      if (this.state === 'up') {
        this.t = Math.min(1, this.t + dt / 0.7);
        if (this.t >= 1) { this.finishUp(); return false; }
      }
      // the root slides between the standing spot and the seat
      const u = this.state === 'down' ? this.t : this.state === 'up' ? 1 - this.t : 1;
      const eh = smoothstep(0, 0.85, u);
      if (this.state === 'down') { p.x = lerp(this.from.x, S.x, eh); p.z = lerp(this.from.z, S.z, eh); PLAY.yaw = this.yaw0 + wrapA(S.yaw - this.yaw0) * smoothstep(0, 0.5, u); }
      else { p.x = lerp(this.sx, S.x, eh); p.z = lerp(this.sz, S.z, eh); PLAY.yaw = S.yaw; }
      p.y += (S.y - p.y) * (1 - Math.exp(-dt * 20));
      this.w = u;
    }
    PLAY.speed = Math.hypot(PLAY.vx, PLAY.vz); PLAY.moving = PLAY.speed > 0.35; PLAY.inYaw = null;
    W.ch.root.position.copy(p); W.ch.root.rotation.y = PLAY.yaw;
    return true;
  },
  startDown() {
    const S = this.seat, k = S.k;
    this.state = 'down'; this.t = 0;
    this.from.copy(PLAY.pos); this.yaw0 = PLAY.yaw;
    PLAY.vx = PLAY.vz = 0;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      this.feetFrom[i].copy(GAIT.feet[i].cur);
      this.seatW(s * k.footW, k.footY, k.foot, this.feetTo[i]);
    }
    this.sound(true);
  },
  finishUp() {
    const S = this.seat;
    for (let i = 0; i < 2; i++) {
      const F = GAIT.feet[i], a = this.feetTo[i];
      F.plant.set(a.x, a.y - RIG.ankleH, a.z); F.gp.copy(F.plant); F.to.copy(F.plant); F.cur.copy(a);
      F.yaw = F.curYaw = F.toYaw = S.yaw; F.swing = false; F.idle = false; F.t = 0; F.pitch = 0;
    }
    GAIT.s = 0; GAIT.moving = false; GAIT.idleT = 0; GAIT.yawPrev = PLAY.yaw; GAIT.yawRate = 0; GAIT.pelYPrev = null;
    PLAY.pos.set(this.sx, S.y, this.sz); PLAY.softColl = 0.45;
    S.occ = null; this.seat = null; this.state = 'none'; this.w = 0;
  },

  /* the whole pose while the seat has it (instead of the gait) */
  pose(P, dt) {
    const S = this.seat, k = S.k, st = this.state;
    const u = st === 'down' ? this.t : st === 'up' ? 1 - this.t : 1;     // 0 standing .. 1 seated
    const eh = smoothstep(0, 0.85, u), ey = smoothstep(0.12, 1, u), bump = Math.sin(Math.PI * smoothstep(0.05, 0.95, u)) * (st === 'sit' ? 0 : 1);
    const breath = Math.sin(G.time * 1.9);
    // hips: from standing over the root to on the seat, relative to the (moving) root
    this.seatW(0, k.top + 0.1, k.back, this._v); this.toChar(this._v, this._h);
    P.pel.set(this._h.x * ey, lerp(RIG.hipY - 0.02, this._h.y, ey), lerp(0, this._h.z, ey) - 0.06 * bump);
    P.pelYaw = 0; P.pelRoll = 0;
    P.pelPitch = 0.28 * bump;
    P.spYaw = 0; P.spRoll = 0;
    P.spPitch = lerp(0.03, k.lean, u) + 0.42 * bump + breath * 0.012;
    // look about now and then, mostly ahead
    if (st === 'sit') {
      this.lookNext -= dt;
      if (this.lookNext <= 0) { this.lookTo = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.3; this.lookNext = 2 + Math.random() * 4; }
    } else this.lookTo = 0;
    this.look += (this.lookTo - this.look) * (1 - Math.exp(-dt * 2.5));
    P.hdYaw = this.look; P.hdRoll = 0;
    P.hdPitch = -(P.pelPitch + P.spPitch) * 0.8 + 0.06 * u;
    P.hatDy = 0; P.hatTilt = -P.spPitch * 0.15;
    // feet: one after the other to where they rest, lifted a little on the way
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const fu = st === 'sit' ? 1 : smoothstep(i === 0 ? 0.05 : 0.2, i === 0 ? 0.6 : 0.75, this.t);
      const A = this.feetFrom[i], B = this.feetTo[i], d = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
      this._p.lerpVectors(A, B, fu); this._p.y += Math.min(0.08, d * 0.5) * Math.sin(Math.PI * fu);
      this.toChar(this._p, P.ank[i]);
      P.ftYaw[i] = s * 0.13 * u; P.ftPitch[i] = 0;
    }
    // arms: the idle hang, taken over by hands on the thighs / the bar / the arm rests
    for (let i = 0; i < 2; i++) { const a = P.arm[i]; a.sw = 0.03 * breath; a.el = 0.14; a.out = 0.07; }
    torsoInverse(P); AIK.ready = true;
    const wa = smoothstep(0.2, 0.9, u);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1, tgt = this._p, pole = this._v;
      if (S.bar) {
        this.seatW(s * 0.13, S.bar.y + 0.05, S.bar.z, tgt); this.toChar(tgt, tgt);
        pole.set(s * 1, -0.7, -0.3);
      } else if (k.arms) {
        this.seatW(s * k.arms[0], k.arms[1], k.arms[2], tgt); this.toChar(tgt, tgt);
        pole.set(s * 0.3, -1, -0.6);
      } else {
        // on top of the thigh, two thirds of the way to the knee
        const H = this._h.set(s * RIG.hipX + P.pel.x, P.pel.y, P.pel.z), A = P.ank[i];
        const K = legKnee(H, A, this._k);
        tgt.lerpVectors(H, K, 0.64); tgt.y += 0.115; tgt.x -= s * 0.03;
        pole.set(s * 0.45, -0.15, -1);
      }
      const r = armIK(i, tgt, pole);
      P.armOv[i] = { w: wa, sw: r.sw, yw: r.yw, out: r.out, el: r.el };
    }
    P.gunInHand = false;
  }
};
// where the knee of a leg from hip H to ankle A ends up (knee forward, as the rig's leg IK does it)
const _lk = new THREE.Vector3(), _lp = new THREE.Vector3();
function legKnee(H, A, out) {
  const L1 = RIG.thigh, L2 = RIG.shin;
  _lk.subVectors(A, H);
  const dist = clamp(_lk.length(), 0.08, L1 + L2 - 1e-4); _lk.normalize();
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _lp.set(0, 0, 1).addScaledVector(_lk, -_lk.z).normalize();
  return out.copy(H).addScaledVector(_lk, cosA * L1).addScaledVector(_lp, sinA * L1);
}
