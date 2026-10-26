/* Punches are paths of the fist through space, written for the right hand in the character's frame
   (x = his left, y = height above the ground, z = forward, the target straight ahead) and mirrored for the left.
   Each key also gives the way the elbow points (pole) and the body: torso turn ty (+ = right shoulder forward),
   lean tp, hips forward pz, dip dy, sideways roll. A two-bone IK turns fist + elbow into arm angles. */
const GUARD_T = { fist: [-0.2, 0.57, 0.38], pole: [-0.35, -1, 0.2] };   // high double guard in the torso's frame: fist at the cheekbone, in front of the face
const PUNCH = {
  straight: [
    { ph: 'windup', dur: 0.06, ease: 'out', fist: [-0.2, 1.5, 0.24], pole: [-0.3, -1, 0.1], ty: -0.25, tp: 0.04, pz: -0.03, dy: 0.05 },
    { ph: 'strike', dur: 0.075, ease: 'back', fist: [0.0, 1.5, 1.05], pole: [-0.35, -1, 0], ty: 0.6, tp: 0.18, pz: 0.13, dy: 0.07, hit: true },
    { ph: 'hold', dur: 0.05, ease: 'out', fist: [-0.02, 1.5, 0.82], pole: [-0.35, -1, 0], ty: 0.55, tp: 0.17, pz: 0.12, dy: 0.07 },
    { ph: 'recover', dur: 0.18, ease: 'inout', fist: null, ty: 0.1, tp: 0.06, pz: 0, dy: 0.05 }
  ],
  // the hook as a saloon brawler throws it: cocked far back, a wide loop round the side, swung right through
  hook: [
    { ph: 'windup', dur: 0.12, ease: 'out', fist: [-0.6, 1.5, -0.12], pole: [-1, 0.1, -0.5], ty: -0.7, tp: 0.0, pz: -0.07, dy: 0.08 },
    { ph: 'strike', dur: 0.1, ease: 'cubic', via: [-0.82, 1.54, 0.55], fist: [0.0, 1.48, 0.72], pole: [-1, 0.12, -0.05], ty: 1.0, tp: 0.15, pz: 0.12, dy: 0.1, hit: true },
    { ph: 'follow', dur: 0.11, ease: 'out', via: [0.22, 1.45, 0.66], fist: [0.3, 1.36, 0.46], pole: [-0.5, -0.45, 0.3], ty: 1.4, tp: 0.22, pz: 0.12, dy: 0.1 },
    { ph: 'recover', dur: 0.28, ease: 'inout', fist: null, ty: 0.1, tp: 0.06, pz: 0, dy: 0.05 }
  ],
  // the MMA overhand: a dip and a slip off the line, then a big loop with the elbow flared out and over,
  // landing like a cross from above while the body turns through and drops onto the front leg
  // the big one: wound up like a normal swing but further and longer, then thrown with everything
  overhand: [
    { ph: 'strike', dur: 0.12, ease: 'cubic', via: [-0.86, 1.68, 0.55], fist: [0.02, 1.52, 0.8], pole: [-0.9, 0.3, 0], ty: 1.15, tp: 0.3, pz: 0.2, dy: 0.14, roll: -0.12, hit: true },
    { ph: 'follow', dur: 0.12, ease: 'out', via: [0.24, 1.46, 0.7], fist: [0.34, 1.32, 0.44], pole: [-0.5, -0.4, 0.3], ty: 1.45, tp: 0.34, pz: 0.2, dy: 0.14, roll: -0.14 },
    { ph: 'recover', dur: 0.42, ease: 'inout', fist: null, ty: 0.1, tp: 0.06, pz: 0, dy: 0.05, roll: 0 }
  ]
};
const CHARGE_R = { fist: [-0.62, 1.55, -0.2], pole: [-1, 0.12, -0.5], ty: -0.85, tp: 0.05, pz: -0.08, dy: 0.1, roll: 0.05 };
const COMBO = [['straight', -1], ['straight', 1], ['hook', -1], ['hook', 1]];   // jab, cross, left hook, right hook
const EASE = {
  out: (t) => 1 - (1 - t) * (1 - t),
  cubic: (t) => 1 - Math.pow(1 - t, 3),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};

/* two-bone arm IK in the torso's frame: shoulder -> elbow -> fist, elbow bent towards the pole */
const AIK = { pel: new THREE.Matrix4(), tor: new THREE.Matrix4(), tmp: new THREE.Matrix4(), inv: new THREE.Matrix4(), m: new THREE.Matrix4(), e: new THREE.Euler(),
  S: new THREE.Vector3(), F: new THREE.Vector3(), pole: new THREE.Vector3(), d: new THREE.Vector3(), pl: new THREE.Vector3(), E: new THREE.Vector3(), u: new THREE.Vector3(), f: new THREE.Vector3(), w: new THREE.Vector3(), ex: new THREE.Vector3(), ey: new THREE.Vector3() };
function torsoInverse(P) {
  rotTo(AIK.pel, P.pel.x, P.pel.y, P.pel.z, P.pelPitch, P.pelYaw, P.pelRoll);
  AIK.tor.multiplyMatrices(AIK.pel, rotTo(AIK.tmp, 0, RIG.waistY, 0, P.spPitch, P.spYaw, P.spRoll));
  AIK.inv.copy(AIK.tor).invert();
}
function armIK(i, fistRoot, poleRoot) {
  const A = AIK, s = i === 0 ? 1 : -1, L1 = RIG.upper, L2 = 0.3;
  A.S.set(s * RIG.shoulderX, RIG.shoulderY, 0);
  A.F.copy(fistRoot).applyMatrix4(A.inv);
  A.pole.copy(poleRoot).transformDirection(A.inv);
  A.d.subVectors(A.F, A.S);
  const dist = clamp(A.d.length(), 0.08, L1 + L2 - 0.003);
  A.d.normalize();
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  A.pl.copy(A.pole).addScaledVector(A.d, -A.pole.dot(A.d));
  if (A.pl.lengthSq() < 1e-6) A.pl.set(0, -1, 0).addScaledVector(A.d, A.d.y);
  A.pl.normalize();
  A.E.copy(A.S).addScaledVector(A.d, cosA * L1).addScaledVector(A.pl, sinA * L1);
  A.F.copy(A.S).addScaledVector(A.d, dist);
  A.u.subVectors(A.E, A.S).normalize(); A.f.subVectors(A.F, A.E).normalize();
  const el = Math.acos(clamp(A.u.dot(A.f), -1, 1));
  A.w.copy(A.f).addScaledVector(A.u, -Math.cos(el));
  if (A.w.lengthSq() < 1e-6) A.w.copy(A.pl).addScaledVector(A.u, -A.pl.dot(A.u));
  A.w.normalize();
  // the arm's rotation: its y axis points from the elbow back to the shoulder, z is where the forearm bends to
  A.ey.copy(A.u).negate(); A.ex.crossVectors(A.ey, A.w);
  A.m.makeBasis(A.ex, A.ey, A.w);
  A.e.setFromRotationMatrix(A.m, 'ZYX');
  return { sw: -A.e.x, yw: A.e.y, out: A.e.z * s, el };
}

const FIST = {
  st: 'idle', clip: null, clipName: '', k: 0, t: 0, side: 1, combo: 0, lastPunch: -9, stamina: 1, rest: 0, fight: 0, gw: 0, heavy: false, weak: false,
  holding: false, downT: 0, moved: 0, mouse: false, queued: false, charge: 0, faceYaw: null, hitDone: false, landed: false,
  fists: null, from: null, body: { ty: 0, tp: 0, pz: 0, dy: 0, roll: 0 }, bodyFrom: null, trail: [], trailT: 0,
  active() { return this.st !== 'idle' || this.fight > 0; },
  /* ---- input ---- */
  down(mouse) { if (SIT.busy() || DRINK.busy() || DRUNK.out) return; this.holding = true; this.downT = G.time; this.moved = 0; this.mouse = !!mouse; },
  up() {
    if (!this.holding) return;
    this.holding = false;
    if (this.st === 'charge') { this.release(); return; }
    if (this.moved < 10) this.tryTap();
  },
  look(dx, dy) { if (this.holding && this.mouse) { this.moved += Math.abs(dx) + Math.abs(dy); if (this.moved >= 10 && this.st === 'charge') this.cancel(); } },
  tryTap() {
    if (GUN.state !== 'holster') return;
    if (this.st === 'idle') this.start(false); else this.queued = true;
  },
  cancel() { this.clip = PUNCH.straight; this.k = 3; this.t = 0; this.st = 'recover'; this.snapFrom(); },
  start(heavy) {
    this.heavy = heavy;
    const cost = heavy ? 0.3 : 0.12;
    this.weak = this.stamina < cost;
    this.stamina = Math.max(0, this.stamina - cost); this.rest = 0.8;
    this.fight = 3; this.hitDone = false; this.landed = false;
    this.faceYaw = this.aimYaw();
    if (heavy) { this.side = Math.random() < 0.5 ? 1 : -1; this.st = 'charge'; this.t = 0; this.clipName = 'overhand'; this.snapFrom(); FSFX.cloth(); return; }
    // each tap picks a punch at random: mostly the other hand, rarely the same punch twice in a row
    const fresh = G.time - this.lastPunch > 0.9;
    const wts = COMBO.map(([n, sd]) => (n === 'hook' ? 0.4 : 1) * (fresh ? 1 : (sd === this.side ? 0.25 : 1) * (n === this.clipName ? 0.5 : 1)));
    let r = Math.random() * wts.reduce((a, b) => a + b, 0), pick = 0;
    while (r > wts[pick] && pick < COMBO.length - 1) { r -= wts[pick]; pick++; }
    const [name, side] = COMBO[pick];
    this.combo++; this.lastPunch = G.time;
    this.clipName = name; this.side = side; this.clip = PUNCH[name]; this.k = 0; this.t = 0; this.st = this.clip[0].ph;
    this.snapFrom();
  },
  release() {
    this.charge = clamp(this.t, 0.15, 0.7);
    this.clip = PUNCH.overhand; this.k = 0; this.t = 0; this.st = this.clip[0].ph; this.snapFrom();
    this.faceYaw = this.aimYaw(); this.lastPunch = G.time; this.combo = 0;
  },
  snapFrom() {
    if (!this.fists) this.fists = [this.guardOf(0), this.guardOf(1)];
    this.from = this.fists.map((f) => ({ fist: f.fist.clone(), pole: f.pole.clone() }));
    this.bodyFrom = Object.assign({}, this.body);
  },
  // the guard rides on the upper body, so twisting and leaning never bring the face into the fists
  guardOf(i) {
    const m = i === 1 ? 1 : -1;
    const f = new THREE.Vector3(GUARD_T.fist[0] * m, GUARD_T.fist[1], GUARD_T.fist[2]), pl = new THREE.Vector3(GUARD_T.pole[0] * m, GUARD_T.pole[1], GUARD_T.pole[2]);
    if (AIK.ready) { f.applyMatrix4(AIK.tor); pl.transformDirection(AIK.tor); } else { f.y += 1.03; }
    return { fist: f, pole: pl };
  },
  /* where to punch: the way you are steering, or the way you face; then pulled onto anything hittable close by */
  aimYaw() {
    const base = PLAY.inYaw !== null && PLAY.inYaw !== undefined ? PLAY.inYaw : PLAY.yaw;
    let best = null, bestS = 1e9;
    for (const T of this.targets()) {
      const dx = T.x - PLAY.pos.x, dz = T.z - PLAY.pos.z, d = Math.hypot(dx, dz);
      const a = Math.abs(wrapA(Math.atan2(dx, dz) - base));
      if (d > 2.6 || a > 1.15) continue;
      const score = d + a * 1.2;
      if (score < bestS) { bestS = score; best = Math.atan2(dx, dz); }
    }
    return best === null ? base : best;
  },
  targets() {
    const out = [{ kind: 'dummy', x: DUMMY.x, z: DUMMY.z, y0: 0.8, y1: 2.0, r: 0.3 }];
    for (const b of BOTTLES) if (b.alive) out.push({ kind: 'bottle', b, x: b.x, z: b.z, y0: b.y, y1: b.y + 0.3, r: 0.06 });
    return out;
  },
  /* ---- per frame ---- */
  update(dt) {
    const slow = this.weak ? 1.45 : 1;
    this.t += dt / slow;
    if (this.holding && this.st === 'idle' && this.moved < 10 && G.time - this.downT > 0.24 && GUN.state === 'holster') this.start(true);
    if (this.st === 'charge') {
      if (this.t > 1.3 && !this.holding) this.release();
      if (this.t > 0.05) this.faceYaw = this.aimYaw();
    } else if (this.clip) {
      const K = this.clip[this.k];
      if (K.hit && !this.hitDone && this.t >= K.dur * 0.85) { this.hitDone = true; this.connect(); }
      const first = this.clip.find((c) => c.ph === 'strike' || c.ph === 'arc');
      if (K === first && this.t < dt * 1.5) { this.lunge(this.heavy ? 2.4 : this.clipName === 'hook' ? 1.5 : 1.3); FSFX.whoosh(this.heavy || this.clipName === 'hook'); this.trail.length = 0; this.trailT = this.heavy ? 0.3 : 0.22; }
      if (this.t >= K.dur) {
        this.k++; this.t = 0; this.snapFrom();
        if (this.k >= this.clip.length) { this.clip = null; this.st = 'idle'; }
        else this.st = this.clip[this.k].ph;
      } else if (this.queued && K.ph === 'recover' && this.t > K.dur * 0.3) { this.queued = false; this.clip = null; this.st = 'idle'; this.start(false); }
    }
    if (this.st === 'idle' && this.queued) { this.queued = false; this.start(false); }
    if (this.st === 'idle') this.faceYaw = null;   // the punch direction is forgotten once the punch is over
    this.rest -= dt;
    if (this.rest <= 0) this.stamina = Math.min(1, this.stamina + dt * 0.4);
    this.fight = Math.max(0, this.fight - dt);
    if (GUN.state !== 'holster') { this.fight = 0; this.st = 'idle'; this.clip = null; }
    this.gw += ((this.active() ? 1 : 0) - this.gw) * (1 - Math.exp(-dt * 10));
    DUMMY.update(dt);
    this.updateTrail(dt);
    const sb = HUD.$('stam');
    sb.style.opacity = this.gw > 0.05 && this.stamina < 0.995 ? '1' : '0';
    sb.firstElementChild.style.transform = `scaleX(${this.stamina.toFixed(3)})`;
    sb.classList.toggle('low', this.stamina < 0.2);
  },
  lunge(v) { PLAY.vx += Math.sin(this.faceYaw) * v; PLAY.vz += Math.cos(this.faceYaw) * v; },
  // the moment the fist arrives
  connect() {
    const kind = this.clipName, reach = kind === 'overhand' ? 1.2 : kind === 'hook' ? 0.92 : 1.02;
    const yaw = this.faceYaw !== null ? this.faceYaw : PLAY.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const fistY = PLAY.pos.y + (kind === 'overhand' ? 1.45 : 1.48);
    const power = (this.heavy ? 1 + this.charge * 1.4 : kind === 'hook' ? 1.35 : 1) * (this.weak ? 0.55 : 1);
    let hit = null, hd = 9;
    for (const T of this.targets()) {
      const dx = T.x - PLAY.pos.x, dz = T.z - PLAY.pos.z, d = Math.hypot(dx, dz);
      if (d > reach + T.r + 0.36 || fistY < T.y0 - 0.3 || fistY > T.y1 + 0.35) continue;
      if (Math.abs(wrapA(Math.atan2(dx, dz) - yaw)) > 0.95) continue;
      if (d < hd) { hd = d; hit = T; }
    }
    if (!hit) return;
    this.landed = true;
    const reachD = Math.min(hd - hit.r * 0.6, reach);
    const p = new THREE.Vector3(PLAY.pos.x + fx * reachD, fistY, PLAY.pos.z + fz * reachD);
    const big = this.heavy;
    G.hitStop = big ? 0.13 : kind === 'hook' ? 0.085 : 0.055;
    PLAY.camShake = big ? 0.09 : kind === 'hook' ? 0.055 : 0.035;
    PLAY.camPush.set(fx, big ? -0.25 : 0, fz).multiplyScalar(big ? 0.24 : 0.1);
    GUN.fovPunch = big ? 1 : 0.4;
    if (GUN.touch && navigator.vibrate) { try { navigator.vibrate(big ? 40 : 15); } catch (e) { /* ignore */ } }
    FX.impactStar(p, big ? 0.46 : 0.26);
    if (hit.kind === 'dummy') {
      // a hook turns the dummy, an overhand drives it back and down
      const twist = kind === 'hook' ? -this.side * 1.6 : big ? -this.side * 0.5 : -this.side * 0.25;
      DUMMY.hit(fx, fz, (big ? 3.8 : kind === 'hook' ? 2.2 : 2.0) * power, twist * 4 * power);
      DUMMY.straw(p, fx * 0.5, fz * 0.5, big ? 14 : 6, big);
      FSFX.bag(p, power, big || kind === 'hook');
    } else if (hit.kind === 'bottle') {
      shatterBottle(hit.b, new THREE.Vector3(fx, 0.3, fz));
    }
    worldEvent('punch', p.x, p.y, p.z, { by: 'player', target: hit.kind, kind, heavy: big });
  },
  // a short ribbon behind the fist while it travels: the eye reads speed from it
  updateTrail(dt) {
    this.trailT = Math.max(0, this.trailT - dt);
    const fa = W.ch.p[this.side === 1 ? 'fArmR' : 'fArmL'];
    if (this.trailT > 0 && (this.st === 'strike' || this.st === 'arc' || this.st === 'follow')) {
      const q = new THREE.Vector3(0, -0.3, 0).applyMatrix4(fa.matrix);
      const c = Math.cos(PLAY.yaw), s = Math.sin(PLAY.yaw);
      this.trail.push(new THREE.Vector3(PLAY.pos.x + q.x * c + q.z * s, PLAY.pos.y + q.y, PLAY.pos.z - q.x * s + q.z * c));
      if (this.trail.length > 8) this.trail.shift();
    } else if (this.trail.length && this.trailT <= 0.12) this.trail.shift();
    FX.drawTrail(this.trail, this.heavy ? 0.12 : 0.06, Math.min(1, this.trailT / 0.12));
  },
  /* ---- arms and body (after the gun has had its say) ---- */
  pose(P, dt) {
    const gw = this.gw;
    if (gw < 0.002 && this.st === 'idle') { this.fists = null; return; }
    if (!this.fists) this.snapFrom();
    const pi = this.side === 1 ? 1 : 0, m = this.side;                 // punching arm (index 1 = right) and mirror sign
    const V = (a, mm) => new THREE.Vector3(a[0] * mm, a[1], a[2]);
    let goal = null, e = 1, bodyGoal = { ty: 0.1, tp: 0.06, pz: 0, dy: 0.05, roll: 0 };
    if (this.st === 'charge') {
      e = EASE.out(clamp(this.t / 0.35, 0, 1));
      goal = { fist: V(CHARGE_R.fist, m), pole: V(CHARGE_R.pole, m) };
      const tremble = this.t > 0.4 ? Math.sin(G.time * 70) * 0.012 : 0;
      bodyGoal = { ty: (CHARGE_R.ty + tremble) * m, tp: CHARGE_R.tp, pz: CHARGE_R.pz, dy: CHARGE_R.dy, roll: CHARGE_R.roll * m };
    } else if (this.clip) {
      const K = this.clip[this.k];
      e = EASE[K.ease](clamp(this.t / K.dur, 0, 1));
      goal = K.fist ? { fist: V(K.fist, m), pole: V(K.pole, m), via: K.via ? V(K.via, m) : null } : this.guardOf(pi);
      bodyGoal = { ty: K.ty * m, tp: K.tp, pz: K.pz, dy: K.dy, roll: (K.roll || 0) * m };
      // a landed blow stops the fist and bounces it back a little
      if (this.landed && (K.ph === 'hold' || K.ph === 'follow')) goal.fist.z -= 0.08;
    }
    // body first, then both arms reach for their fists in the torso that results
    const B = this.body;
    if (goal) for (const k of ['ty', 'tp', 'pz', 'dy', 'roll']) B[k] = lerp(this.bodyFrom[k] || 0, bodyGoal[k], e);
    else { const k2 = 1 - Math.exp(-dt * 12); for (const k of ['ty', 'tp', 'pz', 'dy', 'roll']) B[k] += (bodyGoal[k] - B[k]) * k2; }
    P.spYaw += B.ty * gw; P.pelYaw += B.ty * 0.4 * gw; P.spRoll += B.roll * gw;
    P.spPitch += B.tp * gw; P.pel.z += B.pz * gw; P.pel.y -= B.dy * gw;
    P.hdYaw -= B.ty * 1.15 * gw; P.hdPitch += (0.12 - B.tp * 0.9) * gw; P.hdRoll = -B.roll * gw;   // chin tucked, eyes on the target
    // fists: the punching one follows its path, the other keeps its guard; all in the frame turned towards the target
    torsoInverse(P); AIK.ready = true;
    const busy = this.st !== 'idle';
    const rel = busy ? clamp(wrapA((this.faceYaw !== null ? this.faceYaw : PLAY.yaw) - PLAY.yaw), -0.9, 0.9) : 0, cr = Math.cos(rel), sr = Math.sin(rel);
    const k3 = 1 - Math.exp(-dt * 14);
    for (let i = 0; i < 2; i++) {
      let tgt = i === pi && goal ? goal : this.guardOf(i);
      const cur = this.fists[i];
      if (i === pi && goal) {
        if (tgt.via) {   // a curved path: quadratic Bezier through the 'via' point
          const a0 = this.from[i].fist, u = 1 - e;
          cur.fist.set(u * u * a0.x + 2 * u * e * tgt.via.x + e * e * tgt.fist.x, u * u * a0.y + 2 * u * e * tgt.via.y + e * e * tgt.fist.y, u * u * a0.z + 2 * u * e * tgt.via.z + e * e * tgt.fist.z);
        } else cur.fist.lerpVectors(this.from[i].fist, tgt.fist, e);
        cur.pole.lerpVectors(this.from[i].pole, tgt.pole, e);
      }
      else { cur.fist.lerp(tgt.fist, k3); cur.pole.lerp(tgt.pole, k3); }
    }
    const head = new THREE.Vector3(0, RIG.neckY + 0.16, 0.03).applyMatrix4(AIK.tor);
    for (let i = 0; i < 2; i++) {
      const f = this.fists[i].fist, pl = this.fists[i].pole, c2 = i === pi && goal ? cr : 1, s2 = i === pi && goal ? sr : 0;
      const fw = new THREE.Vector3(f.x * c2 + f.z * s2, f.y, -f.x * s2 + f.z * c2), pw = new THREE.Vector3(pl.x * c2 + pl.z * s2, pl.y, -pl.x * s2 + pl.z * c2);
      // never through the own head: push the fist out to the edge of a ball round it
      const off = fw.clone().sub(head), dd = off.length();
      if (dd < 0.25) { if (dd < 1e-3) off.set(0, 0, 1); fw.copy(head).addScaledVector(off.normalize(), 0.25); }
      let a = armIK(i, fw, pw);
      // and the forearm neither: if any part of it comes too close to the face, move the fist out and solve again
      const hT = AIK.ex.set(0, RIG.neckY + 0.16, 0.03), seg = AIK.u.subVectors(AIK.F, AIK.E), L = seg.lengthSq();
      const tt = L > 1e-6 ? clamp(AIK.ey.subVectors(hT, AIK.E).dot(seg) / L, 0, 1) : 0;
      const cp = AIK.E.clone().addScaledVector(seg, tt), away = cp.clone().sub(hT), dz = away.length();
      if (dz < 0.21) {
        if (dz < 1e-3) away.set(0, 0, 1);
        away.normalize().transformDirection(AIK.tor);
        fw.addScaledVector(away, 0.21 - dz + 0.01);
        a = armIK(i, fw, pw);
      }
      P.armOv[i] = { w: gw, sw: a.sw, yw: a.yw, out: a.out, el: a.el };
    }
  }
};

function shatterBottle(b, dir) {
  b.alive = false; b.mesh.visible = false; b.back = 20 + Math.random() * 10;
  for (let k = 0; k < 18; k++) {
    const an = Math.random() * TAU, v = 1 + Math.random() * 2.8;
    FX.debris.spawn({ x: b.x, y: b.y + 0.1 + Math.random() * 0.16, z: b.z, vx: Math.cos(an) * v + dir.x * 2, vy: 1 + Math.random() * 2.6 + dir.y, vz: Math.sin(an) * v + dir.z * 2,
      life: 1 + Math.random() * 0.8, size: 0.018 + Math.random() * 0.028, grav: 9.8, drag: 0.4, bounce: true, sx: 1, sy: 0.35, sz: 1.4 }, mulc(b.col, 0.8 + Math.random() * 0.6));
  }
  for (let k = 0; k < 4; k++) FX.smoke.spawn({ x: b.x, y: b.y + 0.12, z: b.z, vx: (Math.random() - 0.5) * 0.8, vy: 0.4, vz: (Math.random() - 0.5) * 0.8, life: 0.6, size: 0.03, grow: 3, drag: 4, a0: 0.25 }, [0.85, 0.9, 0.88]);
  GSFX.glass(new THREE.Vector3(b.x, b.y, b.z), 1);
  worldEvent('bottle', b.x, b.y, b.z, { by: 'player' });
}

/* punch sounds, layered like film fights: a recorded swish on the way, and on contact a recorded slap,
   a sub thump you feel, a dull body thud and the straw rustling in the sack */
const FSFX = {
  whoosh(heavy) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(heavy ? 0.55 : 0.4);
      const n = ['swing1', 'swing2', 'swing3'][Math.floor(Math.random() * 3)];
      if (heavy) { GSFX.play(n, g, t, 0.72, 1); GSFX.play('swing1', g, t + 0.03, 0.62, 0.7); }
      else if (!GSFX.play(n, g, t, 0.95 + Math.random() * 0.15, 1)) SFX.noiseHit(t, g, { freq: 1500, q: 1.2, gain: 0.3, attack: 0.03, decay: 0.08 });
    });
  },
  cloth() { GSFX.run(() => { const { g, t } = GSFX.out(0.3); SFX.noiseHit(t, g, { freq: 1100, q: 0.7, gain: 0.18, attack: 0.05, decay: 0.15 }); }); },
  bag(p, power, heavy) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.9, p);
      const pick = heavy ? 'punchH' : ['punch1', 'punch2', 'punch3', 'punch4'][Math.floor(Math.random() * 4)];
      const lv = clamp(0.5 + power * 0.3, 0.4, 1.1);
      // the slap: the recording, crisp
      if (!GSFX.play(pick, g, t, 0.92 + Math.random() * 0.12, lv * 0.85)) SFX.noiseHit(t, g, { freq: 1800, q: 0.8, gain: 0.4, attack: 0.001, decay: 0.05 });
      if (heavy) GSFX.play('punch1', g, t + 0.006, 0.78, lv * 0.5);
      // weight: a sub thump and a dull thud of the sack
      SFX.thump(t, g, heavy ? 95 : 120, heavy ? 36 : 45, heavy ? 0.95 : 0.6, heavy ? 0.2 : 0.11);
      SFX.noiseHit(t, g, { type: 'lowpass', freq: heavy ? 320 : 420, q: 0.7, gain: heavy ? 0.7 : 0.45, attack: 0.002, decay: heavy ? 0.12 : 0.07 });
      // straw shifting inside, a beat after the blow
      SFX.noiseHit(t + 0.012, g, { freq: 3800, q: 0.9, gain: heavy ? 0.16 : 0.09, attack: 0.012, decay: heavy ? 0.26 : 0.14 });
      for (let i = 0; i < (heavy ? 6 : 3); i++) SFX.noiseHit(t + 0.02 + Math.random() * 0.18, g, { freq: 4500 + Math.random() * 3000, q: 2, gain: 0.03, attack: 0.001, decay: 0.012 });
      // a big one makes the post creak and the street answer
      if (heavy) {
        SFX.noiseHit(t + 0.09, g, { freq: 240, q: 10, gain: 0.12, attack: 0.03, decay: 0.3 });
        if (!G.room) SFX.noiseHit(t + 0.14, g, { type: 'lowpass', freq: 900, q: 0.4, gain: 0.08, attack: 0.01, decay: 0.25 });
      }
    });
  }
};
