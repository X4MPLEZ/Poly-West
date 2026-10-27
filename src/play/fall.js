/* ---------- falling over (drunk), crawling, and getting back up ----------
   Keyframed poses that own the body while they run, like sitting does. Which way he goes down follows where the
   body was leaning and where he was going (start(stay, kind, worldDir)):
   - fwd:  the toes catch, he pitches forward onto his hands; sometimes all the way onto his face, then he pushes up,
           crawls on a bit, kneels, gets a foot under him and stands
   - side: the legs cross, he tips over sideways onto the hip, props himself on one arm, sits up, stands
   - back: (passing out only) staggers backwards, sits down hard, falls flat
   - edge: the last stretch of a binge: down on all fours, and the player crawls him about until the lights go out
   Every fall is a little different: the whole body turns into the fall, keeps some of its momentum, and every key
   is shaken a little. Keys are poses in character space (+x = his left); side keys are written for a fall to his
   right and mirrored. The feet start where the gait left them and are handed back to the gait at the end. */
const FALL_KEYS = {
  //        pelvis [x,y,z]      pelvis pitch/roll, spine pitch/roll, head pitch/roll, ankles (L, R), foot pitch      arms: [sw, out, el] L, R
  stand:    { pel: [0, 0.925, 0],      pp: 0,     sp: 0.02,  hd: 0,     ank: [[0.12, 0.085, 0], [-0.12, 0.085, 0]],      arm: [[0, 0.1, 0.15], [0, 0.1, 0.15]] },
  // backwards
  reel:     { pel: [0, 0.88, -0.12],   pp: -0.18, sp: -0.25, hd: 0.25,  ank: [[0.14, 0.085, 0.12], [-0.12, 0.085, -0.05]], arm: [[0.9, 0.9, 0.5], [-0.3, 1.1, 0.7]] },
  seat:     { pel: [0, 0.17, -0.25],   pp: -0.35, sp: 0.1,   hd: 0.15,  ank: [[0.17, 0.085, 0.45], [-0.15, 0.085, 0.5]],  arm: [[-0.7, 0.35, 0.15], [-0.6, 0.4, 0.2]] },
  flat:     { pel: [0, 0.14, -0.3],    pp: -1.42, sp: 0.06,  hd: 0.1,   ank: [[0.22, 0.085, 0.55], [-0.2, 0.085, 0.62]],  arm: [[0.1, 1.25, 0.35], [-0.1, 1.15, 0.5]] },
  sitUp:    { pel: [0, 0.17, -0.22],   pp: -0.25, sp: 0.45,  hd: -0.2,  ank: [[0.17, 0.085, 0.35], [-0.15, 0.085, 0.32]], arm: [[0.4, 0.2, 0.5], [0.5, 0.25, 0.6]] },
  squat:    { pel: [0, 0.52, -0.05],   pp: 0.55,  sp: 0.35,  hd: -0.55, ank: [[0.17, 0.085, 0.12], [-0.15, 0.085, 0.1]],  arm: [[0.55, 0.15, 0.7], [0.6, 0.15, 0.7]] },
  // forwards
  trip:     { pel: [0, 0.83, 0.2],     pp: 0.5,   sp: 0.3,   hd: -0.35, ank: [[0.12, 0.16, -0.32], [-0.13, 0.085, 0.45]], fp: [0.7, 0],     arm: [[1.4, 0.35, 0.3], [1.25, 0.4, 0.45]] },
  hands:    { pel: [0, 0.5, -0.02],    pp: 1.25,  sp: 0.12,  hd: -0.9,  ank: [[0.13, 0.13, -0.52], [-0.13, 0.13, -0.5]],  fp: [1.45, 1.45], arm: [[1.3, 0.18, 0.12], [1.3, 0.18, 0.12]] },
  kneel:    { pel: [0, 0.6, -0.06],    pp: 0.12,  sp: 0.08,  hd: 0.25,  ank: [[0.13, 0.13, -0.5], [-0.13, 0.13, -0.48]],  fp: [1.45, 1.45], arm: [[0.55, 0.15, 0.8], [0.5, 0.18, 0.75]] },
  lunge:    { pel: [0, 0.6, -0.04],    pp: 0.5,   sp: 0.25,  hd: -0.35, ank: [[0.14, 0.085, 0.36], [-0.13, 0.13, -0.47]], fp: [0, 1.45],    arm: [[0.75, 0.12, 0.95], [0.55, 0.2, 0.6]] },
  face:     { pel: [0, 0.3, -0.12],   pp: 1.42,  sp: 0.1,   hd: 0.3, hr: 0.6, ank: [[0.13, 0.12, -0.64], [-0.13, 0.12, -0.62]], fp: [1.45, 1.45], arm: [[1.95, 0.55, 1.35], [1.75, 0.6, 1.45]] },
  prone:    { pel: [0, 0.14, -0.2],    pp: 1.5,   sp: 0.04,  hd: 0.05, hr: 0.5, ank: [[0.16, 0.1, -0.98], [-0.2, 0.1, -0.95]], fp: [1.5, 1.5], arm: [[2.5, 0.45, 0.6], [0.25, 0.35, 0.25]] },
  // sideways (written for a fall to his right, -x)
  lean:     { pel: [-0.14, 0.86, 0.02], pp: 0.05, pr: 0.32, sp: 0.05, sr: 0.2,  hd: 0.1,  hr: -0.3,  ank: [[0.04, 0.085, 0.1], [-0.34, 0.085, -0.02]], arm: [[0.4, 1.25, 0.5], [0.25, 0.75, 0.3]] },
  hip:      { pel: [-0.3, 0.2, -0.05], pp: -0.1, pr: 0.9,  sp: 0.12, sr: -0.4, hd: 0.1,  hr: -0.25, ank: [[0.12, 0.085, 0.4], [-0.16, 0.085, 0.3]],  arm: [[0.75, 0.25, 0.95], [-0.1, 0.45, 0.1]] },
  sideFlat: { pel: [-0.3, 0.16, -0.05], pp: -0.05, pr: 1.38, sp: 0.06, sr: 0.08, hd: 0.05, hr: -0.45, ank: [[-0.05, 0.2, 0.32], [-0.26, 0.085, 0.36]], arm: [[0.8, 0.2, 0.7], [1.3, 0.25, 1.2]] }
};
const FALL = {
  st: null, i: 0, t: 0, from: null, down: 0, keep: false, kind: 'fwd', sd: 1, seq: null, jit: {}, yawTo: null, crawlPh: 0,
  _v: new THREE.Vector3(),
  // the pose of the last frame, so any step can start from wherever the body is
  snap: { pel: [0, 0.925, 0], pp: 0, pr: 0, sp: 0, sr: 0, hd: 0, hr: 0, ank: [[0.12, 0.085, 0], [-0.12, 0.085, 0]], fp: [0, 0], arm: [[0, 0.1, 0.15], [0, 0.1, 0.15]] },
  busy() { return this.st !== null; },
  owns() { return this.st !== null; },
  // 'auto' while crawling on by himself, 'ctl' while the player crawls him about, else null
  crawling() { if (!this.st) return null; const s = this.seq[this.i]; return s && s.crawl ? s.crawl : null; },
  /* the steps: { k: key, d: seconds, e: easing ('in' = accelerating like falling), thud, lie: hold the pose, crawl } */
  makeSeq(kind, stay) {
    const R = Math.random, S = (k, d, e, thud) => ({ k, d, e, thud });
    if (kind === 'back') return stay
      ? [S('reel', 0.4, 'out'), S('seat', 0.26, 'in', 0.7), S('flat', 0.34, 'in', 1), { lie: 1, d: 1 }]
      : [S('reel', 0.4, 'out'), S('seat', 0.26, 'in', 0.7), S('flat', 0.34, 'in', 1), { lie: 1, d: 0.5 }, S('sitUp', 0.4, 'inout'), S('squat', 0.35, 'inout'), S('stand', 0.35, 'inout')];
    if (kind === 'side') return stay
      ? [S('lean', 0.32, 'out'), S('hip', 0.26, 'in', 0.9), S('sideFlat', 0.6, 'inout', 0.35), { lie: 1, d: 1 }]
      : [S('lean', 0.28 + R() * 0.12, 'out'), S('hip', 0.26, 'in', 0.9), { lie: 1, d: 0.25 + R() * 0.3 }, S('sitUp', 0.38, 'inout'), S('squat', 0.32, 'inout'), S('stand', 0.35, 'inout')];
    const down = [S('trip', 0.2 + R() * 0.08, 'out'), S('hands', 0.22, 'in', 0.7)];
    if (kind === 'edge') return down.concat([{ crawl: 'ctl', d: 1e9 }]);
    if (stay) return down.concat([S('face', 0.3, 'in', 0.8), S('prone', 0.5, 'inout'), { lie: 1, d: 1 }]);
    const up = [S('kneel', 0.32, 'inout'), S('lunge', 0.32, 'inout'), S('stand', 0.38, 'inout')];
    if (R() < 0.55) return down.concat([S('face', 0.22, 'in', 0.9), { lie: 1, d: 0.3 + R() * 0.35 }, S('hands', 0.4, 'inout'), { crawl: 'auto', d: 0.9 + R() * 0.9 }], up);
    return down.concat(R() < 0.5 ? [{ crawl: 'auto', d: 0.5 + R() * 0.7 }] : [{ lie: 1, d: 0.2 }], up);
  },
  /* stay: do not get up (passing out). kind: 'auto' | 'fwd' | 'side' | 'back' | 'edge'.
     worldDir: the way the fall goes (world angle like yaw); default straight ahead */
  start(stay, kind, worldDir) {
    if (this.st || SIT.busy()) return;
    DRINK.cancel(); FIST.st = 'idle'; FIST.clip = null; FIST.fight = 0; FIST.holding = false; FIST.queued = false;
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    const dir = worldDir === undefined ? PLAY.yaw : worldDir, rel = wrapA(dir - PLAY.yaw);
    if (!kind || kind === 'auto') kind = Math.abs(rel) < 0.75 ? 'fwd' : 'side';
    this.kind = kind; this.keep = !!stay; this.sd = rel < 0 ? 1 : -1;   // rel < 0: the fall goes to his right
    // the body turns into the fall: face it (forwards), or put the shoulder into it (sideways), plus a little twist
    const tw = (Math.random() - 0.5) * 0.4;
    this.yawTo = kind === 'side' ? PLAY.yaw + clamp(rel + this.sd * Math.PI / 2, -0.9, 0.9) + tw : kind === 'back' ? null : dir + tw * 0.5;
    this.seq = this.makeSeq(kind, this.keep); this.jit = {};
    if (kind === 'fwd' || kind === 'edge') { PLAY.vx += Math.sin(dir) * 0.8; PLAY.vz += Math.cos(dir) * 0.8; }
    // the start pose: as the body stands now, with the feet where they are
    const k0 = this.copyKey(FALL_KEYS.stand);
    for (let i = 0; i < 2; i++) { SIT.toChar(GAIT.feet[i].cur, this._v); k0.ank[i] = [this._v.x, this._v.y, this._v.z]; }
    this.from = k0; this.st = 'run'; this.i = 0; this.t = 0;
    worldEvent('fall', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', kind });
  },
  cancel() { this.st = null; this.down = 0; this.yawTo = null; },
  // crawling about at the very end: down on the face, out cold
  collapse() {
    this.keep = true; this.seq = [{ k: 'face', d: 0.45, e: 'in', thud: 0.8 }, { k: 'prone', d: 0.6, e: 'inout' }, { lie: 1, d: 1 }];
    this.from = this.copyKey(this.snap); this.i = 0; this.t = 0;
  },
  // lying on the back where you woke up; gets up once keep is cleared
  startLying() {
    this.kind = 'back'; this.sd = 1; this.keep = true; this.jit = {}; this.yawTo = null;
    this.seq = [{ lie: 1, d: 0.6 }, { k: 'sitUp', d: 0.8, e: 'inout' }, { k: 'squat', d: 0.65, e: 'inout' }, { k: 'stand', d: 0.55, e: 'inout' }];
    this.from = this.copyKey(FALL_KEYS.flat); this.st = 'run'; this.i = 0; this.t = 0;
  },
  copyKey(k) {
    return { pel: k.pel.slice(), pp: k.pp, pr: k.pr || 0, sp: k.sp, sr: k.sr || 0, hd: k.hd, hr: k.hr || 0,
      ank: k.ank.map((a) => a.slice()), fp: k.fp ? k.fp.slice() : null, arm: k.arm.map((a) => a.slice()) };
  },
  // a key by name: mirrored for side falls to his left, and shaken a little for this fall
  key(name) {
    if (this.jit[name]) return this.jit[name];
    const k = this.copyKey(FALL_KEYS[name]);
    if (this.kind === 'side' && this.sd < 0) {
      const sw = (a) => [a[1], a[0]];
      k.pel[0] = -k.pel[0]; k.pr = -k.pr; k.sr = -k.sr; k.hr = -k.hr;
      k.ank = sw(k.ank).map((v) => [-v[0], v[1], v[2]]); if (k.fp) k.fp = sw(k.fp); k.arm = sw(k.arm);
    }
    if (name !== 'stand') {
      const r = (a) => (Math.random() - 0.5) * 2 * a;
      k.pel[0] += r(0.04); k.pel[2] += r(0.05); k.pp += r(0.08); k.sp += r(0.1); k.sr += r(0.1); k.hd += r(0.15); k.hr += r(0.2);
      for (const a of k.arm) { a[0] += r(0.3); a[1] += r(0.2); a[2] += r(0.25); }
      for (const a of k.ank) { a[2] += r(0.05); }
    }
    return (this.jit[name] = k);
  },
  update(dt) {
    if (!this.st) return;
    const s = this.seq[this.i], crawl = !!s.crawl;
    // the first moments of a fall keep some momentum; lying there stops it
    if (!crawl) { const k = this.i < 2 ? 2.2 : 8; PLAY.vx *= Math.exp(-dt * k); PLAY.vz *= Math.exp(-dt * k); }
    else this.crawlPh += PLAY.speed * dt * 9;
    if (this.yawTo !== null && this.i < 2) PLAY.yaw += wrapA(this.yawTo - PLAY.yaw) * (1 - Math.exp(-dt * 7));
    this.t += dt;
    if (this.t >= s.d) {
      if (s.lie && this.keep && this.i === this.seq.length - 1) { this.t = s.d; return; }
      this.t -= s.d;
      if (s.thud) { this.thud(s.thud); if (s.thud >= 0.9) PLAY.camShake = Math.max(PLAY.camShake, 0.1 * s.thud); }
      this.from = this.copyKey(this.snap);
      this.i++; if (this.i < this.seq.length && this.seq[this.i].crawl) this.crawlPh = 0;
      if (this.i >= this.seq.length) this.finish();
    }
  },
  finish() {
    // the feet go back to the gait, planted where the last key put them
    const c = Math.cos(PLAY.yaw), s = Math.sin(PLAY.yaw);
    for (let i = 0; i < 2; i++) {
      const a = FALL_KEYS.stand.ank[i], F = GAIT.feet[i];
      const wx = PLAY.pos.x + a[0] * c + a[2] * s, wz = PLAY.pos.z - a[0] * s + a[2] * c, gy = groundAt(wx, wz, PLAY.pos.y);
      F.plant.set(wx, gy, wz); F.gp.copy(F.plant); F.to.copy(F.plant); F.cur.set(wx, gy + RIG.ankleH, wz);
      F.yaw = F.curYaw = F.toYaw = PLAY.yaw; F.swing = false; F.idle = false; F.t = 0; F.pitch = 0;
    }
    GAIT.s = 0; GAIT.moving = false; GAIT.idleT = 0; GAIT.yawPrev = PLAY.yaw; GAIT.pelYPrev = null;
    DRUNK.body.set(0, 0); DRUNK.head.set(0, 0); DRUNK.bodyV.set(0, 0); DRUNK.headV.set(0, 0); DRUNK.lurch.set(0, 0);
    this.st = null; this.down = 0; this.yawTo = null;
  },
  thud(k) {
    GSFX.run(() => { const { g, t } = GSFX.out(0.6 * k, PLAY.pos); SFX.thump(t, g, 110, 40, 0.7 * k, 0.16); SFX.noiseHit(t, g, { type: 'lowpass', freq: 500, q: 0.7, gain: 0.35 * k, attack: 0.003, decay: 0.12 }); });
    FSFX.cloth();
  },
  // on all fours, crawling: arms and knees go in pairs across (left hand with right knee)
  crawlKey(ph, out) {
    const H = this.key('hands'), mv = Math.min(1, PLAY.speed / 0.3);
    out.pel[0] = H.pel[0]; out.pel[1] = H.pel[1] + 0.02 * Math.sin(ph * 2) * mv; out.pel[2] = H.pel[2] + 0.04 * Math.sin(ph * 2) * mv;
    out.pp = H.pp; out.pr = 0.08 * Math.sin(ph) * mv; out.sp = H.sp; out.sr = -0.07 * Math.sin(ph) * mv;
    out.hd = H.hd + 0.08 * Math.sin(ph * 2) * mv + Math.sin(G.time * 0.9) * 0.08; out.hr = Math.sin(G.time * 0.7) * 0.2;
    for (let i = 0; i < 2; i++) {
      const a = ph + i * Math.PI, b = ph + (1 - i) * Math.PI;
      out.arm[i][0] = H.arm[i][0] + 0.38 * Math.sin(a) * mv; out.arm[i][1] = H.arm[i][1]; out.arm[i][2] = H.arm[i][2] + 0.35 * Math.max(0, Math.cos(a)) * mv;
      out.ank[i][0] = H.ank[i][0]; out.ank[i][1] = H.ank[i][1] + 0.05 * Math.max(0, Math.cos(b)) * mv; out.ank[i][2] = H.ank[i][2] + 0.13 * Math.sin(b) * mv;
      out.fp[i] = H.fp ? H.fp[i] : 1.45;
    }
    return out;
  },
  pose(P, dt) {
    const s = this.seq[Math.min(this.i, this.seq.length - 1)], name = s.k;
    const u = clamp(this.t / s.d, 0, 1), ease = s.e || 'out';
    let e = ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
    let B;
    if (s.crawl) { B = this.crawlKey(this.crawlPh, this._ck || (this._ck = this.copyKey(FALL_KEYS.hands))); e = smoothstep(0, 0.25, this.t); }
    else B = s.lie ? this.from : this.key(name);
    const A = this.from, L = (a, b) => a + (b - a) * e, S = this.snap;
    // the arms going round while tipping over sideways or backwards
    const wob = name === 'reel' || name === 'lean' ? Math.sin(this.t * 22) : 0;
    for (let j = 0; j < 3; j++) S.pel[j] = L(A.pel[j], B.pel[j]);
    S.pp = L(A.pp, B.pp); S.pr = L(A.pr, B.pr); S.sp = L(A.sp, B.sp); S.sr = L(A.sr, B.sr); S.hd = L(A.hd, B.hd); S.hr = L(A.hr, B.hr);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) { S.ank[i][j] = L(A.ank[i][j], B.ank[i][j]); S.arm[i][j] = L(A.arm[i][j], B.arm[i][j]); }
      // feet: given per key (toes down when kneeling), otherwise heels on the ground and toes up when sitting low
      const fa = A.fp ? A.fp[i] : (A.pel[1] < 0.4 ? -0.6 : 0), fb = B.fp ? B.fp[i] : (B.pel[1] < 0.4 ? -0.6 : 0);
      S.fp[i] = L(fa, fb);
    }
    P.pel.set(S.pel[0], S.pel[1], S.pel[2]);
    P.pelYaw = 0; P.pelRoll = S.pr; P.pelPitch = S.pp;
    P.spYaw = 0; P.spRoll = S.sr; P.spPitch = S.sp;
    // lying there: breathing, and the head rolls as if the world spins
    P.hdPitch = S.hd; P.hdRoll = S.hr; P.hdYaw = s.lie ? Math.sin(G.time * 0.8) * 0.35 : 0;
    if (s.lie) P.spPitch += Math.sin(G.time * 1.8) * 0.02;
    P.hatDy = 0; P.hatTilt = 0;
    for (let i = 0; i < 2; i++) {
      P.ank[i].set(S.ank[i][0], S.ank[i][1], S.ank[i][2]);
      P.ftPitch[i] = S.fp[i];
      P.ftYaw[i] = (i === 0 ? 1 : -1) * 0.25 * (P.pel.y < 0.6 && S.fp[i] < 0.5 ? 1 : 0);
      const o = P.armOv[i] && P.armOv[i].fall ? P.armOv[i] : (P.armOv[i] = { w: 1, sw: 0, yw: 0, out: 0, el: 0, fall: true });
      o.w = 1; o.yw = 0; o.sw = S.arm[i][0] + wob * 0.5 * (i ? -1 : 1); o.out = S.arm[i][1] + Math.abs(wob) * 0.2; o.el = S.arm[i][2];
    }
    P.gunInHand = false;
    if (P.hand) for (const h of P.hand) h.open = 0.55;
    this.down = clamp((0.925 - P.pel.y) / 0.75, 0, 1);
  }
};
