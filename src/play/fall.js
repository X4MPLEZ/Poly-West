/* ---------- falling over (drunk) and getting back up ----------
   Short pieces of keyframed animation that own the pose while they run, like sitting does. Three ways down:
   - back: stagger backwards with the arms going round, drop onto the backside, fall back flat
   - fwd:  the toes catch (a step, an edge), he pitches forward and lands on hands and knees, kneels, gets a foot
           under him and pushes up
   - side: the legs cross, he tips over sideways onto the hip, props himself on one arm, sits up
   Keys are poses in character space (+x = his left); side keys are written for a fall to his right and mirrored.
   The feet start where the gait left them and are handed back to the gait at the end. stay = do not get up. */
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
  prone:    { pel: [0, 0.14, -0.2],    pp: 1.5,   sp: 0.04,  hd: 0.05, hr: 0.5, ank: [[0.16, 0.1, -0.98], [-0.2, 0.1, -0.95]], fp: [1.5, 1.5], arm: [[2.5, 0.45, 0.6], [0.25, 0.35, 0.25]] },
  // sideways (written for a fall to his right, -x)
  lean:     { pel: [-0.14, 0.86, 0.02], pp: 0.05, pr: 0.32, sp: 0.05, sr: 0.2,  hd: 0.1,  hr: -0.3,  ank: [[0.04, 0.085, 0.1], [-0.34, 0.085, -0.02]], arm: [[0.4, 1.25, 0.5], [0.25, 0.75, 0.3]] },
  hip:      { pel: [-0.3, 0.2, -0.05], pp: -0.1, pr: 0.9,  sp: 0.12, sr: -0.4, hd: 0.1,  hr: -0.25, ank: [[0.12, 0.085, 0.4], [-0.16, 0.085, 0.3]],  arm: [[0.75, 0.25, 0.95], [-0.1, 0.45, 0.1]] },
  sideFlat: { pel: [-0.3, 0.16, -0.05], pp: -0.05, pr: 1.38, sp: 0.06, sr: 0.08, hd: 0.05, hr: -0.45, ank: [[-0.05, 0.2, 0.32], [-0.26, 0.085, 0.36]], arm: [[0.8, 0.2, 0.7], [1.3, 0.25, 1.2]] }
};
const FALL_SEQ = {
  // [key, seconds, easing ('in' = accelerating like falling), thud strength]; 'lie' holds the previous key a while
  back:     [['reel', 0.4, 'out'], ['seat', 0.26, 'in', 0.7], ['flat', 0.34, 'in', 1], ['lie'], ['sitUp', 0.5, 'inout'], ['squat', 0.5, 'inout'], ['stand', 0.45, 'inout']],
  backStay: [['reel', 0.4, 'out'], ['seat', 0.26, 'in', 0.7], ['flat', 0.34, 'in', 1], ['lie']],
  fwd:      [['trip', 0.26, 'out'], ['hands', 0.28, 'in', 0.9], ['lie'], ['kneel', 0.55, 'inout'], ['lunge', 0.5, 'inout'], ['stand', 0.55, 'inout']],
  fwdStay:  [['trip', 0.26, 'out'], ['hands', 0.28, 'in', 0.9], ['prone', 0.7, 'in', 0.5], ['lie']],
  side:     [['lean', 0.38, 'out'], ['hip', 0.3, 'in', 0.9], ['lie'], ['sitUp', 0.55, 'inout'], ['squat', 0.5, 'inout'], ['stand', 0.45, 'inout']],
  sideStay: [['lean', 0.38, 'out'], ['hip', 0.3, 'in', 0.9], ['sideFlat', 0.7, 'inout', 0.35], ['lie']],
  // waking up after a blackout: already lying there, then slowly up
  wake:     [['flat', 0.05, 'out'], ['lie'], ['sitUp', 0.8, 'inout'], ['squat', 0.65, 'inout'], ['stand', 0.55, 'inout']]
};
const FALL = {
  st: null, i: 0, t: 0, from: null, down: 0, keep: false, kind: 'back', sd: 1, seq: null, lieKey: null, mir: {},
  feet: [new THREE.Vector3(), new THREE.Vector3()], _v: new THREE.Vector3(),
  busy() { return this.st !== null; },
  owns() { return this.st !== null; },
  // kind: 'back' | 'fwd' | 'side'; sd: for 'side', 1 = to his right, -1 = to his left
  start(stay, kind, sd) {
    if (this.st || SIT.busy()) return;
    DRINK.cancel(); FIST.st = 'idle'; FIST.clip = null; FIST.fight = 0; FIST.holding = false; FIST.queued = false;
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    this.keep = !!stay; this.kind = FALL_SEQ[kind] ? kind : 'back'; this.sd = sd < 0 ? -1 : 1;
    this.seq = FALL_SEQ[this.kind + (this.keep ? 'Stay' : '')];
    // the start pose: the standing pose with the feet where they are now
    const k0 = JSON.parse(JSON.stringify(FALL_KEYS.stand));
    for (let i = 0; i < 2; i++) { SIT.toChar(GAIT.feet[i].cur, this._v); k0.ank[i] = [this._v.x, this._v.y, this._v.z]; }
    this.from = k0; this.st = 'run'; this.i = 0; this.t = 0; this.lieKey = null;
    this.lieT = this.kind === 'fwd' ? 0.5 + Math.random() * 0.6 : 0.8 + Math.random() * 0.8;
    worldEvent('fall', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', kind: this.kind });
  },
  cancel() { this.st = null; this.down = 0; },
  // lying on the back where you woke up; gets up once keep is cleared
  startLying() {
    this.kind = 'back'; this.sd = 1; this.keep = true; this.seq = FALL_SEQ.wake;
    this.from = FALL_KEYS.flat; this.st = 'run'; this.i = 1; this.t = 0; this.lieT = 0.6;
  },
  step(i) { return this.seq[Math.min(i, this.seq.length - 1)]; },
  dur(s) { return s[0] === 'lie' ? this.lieT : s[1]; },
  // a key by name; side falls to his left are the mirror image
  key(name) {
    const k = FALL_KEYS[name];
    if (this.kind !== 'side' || this.sd > 0) return k;
    const m = this.mir[name];
    if (m) return m;
    const sw = (a) => [a[1], a[0]], nx = (v) => [-v[0], v[1], v[2]];
    return (this.mir[name] = {
      pel: nx(k.pel), pp: k.pp, pr: -(k.pr || 0), sp: k.sp, sr: -(k.sr || 0), hd: k.hd, hr: -(k.hr || 0),
      ank: sw(k.ank).map(nx), fp: k.fp ? sw(k.fp) : undefined, arm: sw(k.arm)
    });
  },
  target(s) { return s[0] === 'lie' ? this.from : this.key(s[0]); },
  update(dt) {
    if (!this.st) return;
    PLAY.vx *= Math.exp(-dt * 6); PLAY.vz *= Math.exp(-dt * 6);
    const s = this.step(this.i), dur = this.dur(s);
    this.t += dt;
    if (this.t >= dur) {
      if (s[0] === 'lie' && this.keep) { this.t = dur; return; }
      this.t -= dur;
      if (s[0] !== 'lie') this.from = this.key(s[0]);
      if (s[3]) { this.thud(s[3]); if (s[3] >= 0.9) PLAY.camShake = Math.max(PLAY.camShake, 0.1 * s[3]); }
      this.i++;
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
    this.st = null; this.down = 0;
  },
  thud(k) {
    GSFX.run(() => { const { g, t } = GSFX.out(0.6 * k, PLAY.pos); SFX.thump(t, g, 110, 40, 0.7 * k, 0.16); SFX.noiseHit(t, g, { type: 'lowpass', freq: 500, q: 0.7, gain: 0.35 * k, attack: 0.003, decay: 0.12 }); });
    FSFX.cloth();
  },
  pose(P, dt) {
    const s = this.step(this.i), name = s[0], dur = this.dur(s), ease = s[2] || 'out';
    const u = clamp(this.t / dur, 0, 1), e = ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
    const A = this.from, B = this.target(s), L = (a, b) => a + (b - a) * e, n = (v) => v || 0;
    // the arms going round: windmilling while going down backwards or sideways
    const wob = name === 'reel' || name === 'lean' ? Math.sin(this.t * 22) : 0;
    P.pel.set(L(A.pel[0], B.pel[0]), L(A.pel[1], B.pel[1]), L(A.pel[2], B.pel[2]));
    P.pelYaw = 0; P.pelRoll = L(n(A.pr), n(B.pr)); P.pelPitch = L(A.pp, B.pp);
    P.spYaw = 0; P.spRoll = L(n(A.sr), n(B.sr)); P.spPitch = L(A.sp, B.sp);
    // lying there: breathing, and the head rolls as if the world spins
    const lying = name === 'lie' || (this.i > 0 && this.step(this.i - 1)[0] === 'lie' && u < 0.2);
    P.hdPitch = L(A.hd, B.hd); P.hdRoll = L(n(A.hr), n(B.hr)); P.hdYaw = lying ? Math.sin(G.time * 0.8) * (this.kind === 'fwd' ? 0.3 : 0.4) : 0;
    if (lying) { P.spPitch += Math.sin(G.time * 1.8) * 0.02; if (this.kind === 'fwd' && !this.keep) P.hdPitch += Math.sin(G.time * 1.1) * 0.12; }
    P.hatDy = 0; P.hatTilt = 0;
    for (let i = 0; i < 2; i++) {
      P.ank[i].set(L(A.ank[i][0], B.ank[i][0]), L(A.ank[i][1], B.ank[i][1]), L(A.ank[i][2], B.ank[i][2]));
      // feet: given per key (toes down when kneeling), otherwise heels on the ground and toes up when sitting low
      const fa = A.fp ? A.fp[i] : (A.pel[1] < 0.4 ? -0.6 : 0), fb = B.fp ? B.fp[i] : (B.pel[1] < 0.4 ? -0.6 : 0);
      P.ftPitch[i] = L(fa, fb);
      P.ftYaw[i] = (i === 0 ? 1 : -1) * 0.25 * (P.pel.y < 0.6 && !B.fp ? 1 : 0);
      const a0 = A.arm[i], b0 = B.arm[i];
      P.armOv[i] = { w: 1, sw: L(a0[0], b0[0]) + wob * 0.5 * (i ? -1 : 1), yw: 0, out: L(a0[1], b0[1]) + Math.abs(wob) * 0.2, el: L(a0[2], b0[2]) };
    }
    P.gunInHand = false;
    this.down = clamp((0.925 - P.pel.y) / 0.75, 0, 1);
  }
};
