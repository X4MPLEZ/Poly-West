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
  // put the player straight onto a seat, already sitting (waking up there, loading a game)
  warp(seat) {
    if (this.seat) this.seat.occ = null;
    this.seat = seat; seat.occ = 'player'; [this.sx, this.sz] = seat.spot(PLAY.pos);
    PLAY.pos.set(seat.x, seat.y, seat.z); PLAY.yaw = seat.yaw; PLAY.camYaw = seat.yaw + Math.PI; PLAY.vx = PLAY.vz = 0; G.lookAt = null;
    const k = seat.k;
    for (let i = 0; i < 2; i++) { const s = i === 0 ? 1 : -1; this.seatW(s * k.footW, k.footY, k.foot, this.feetTo[i]); this.feetFrom[i].copy(this.feetTo[i]); }
    this.state = 'sit'; this.t = 0; this.w = 1;
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
