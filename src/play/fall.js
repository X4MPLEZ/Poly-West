/* ---------- falling over (drunk) and getting back up ----------
   A short piece of keyframed animation that owns the pose while it runs, like sitting does:
   stagger backwards with the arms going round, drop onto the backside, fall back flat, lie there a moment,
   sit up, get the feet under you, stand. Keys are poses in character space; the feet start where the gait left
   them and are handed back to the gait at the end. */
const FALL_KEYS = {
  //        pelvis [x,y,z]      pelvis pitch, spine pitch, head pitch, ankles (L, R)                         arms: [sw, out, el] L, R
  stand:  { pel: [0, 0.925, 0],    pp: 0,     sp: 0.02,  hd: 0,     ank: [[0.12, 0.085, 0], [-0.12, 0.085, 0]],      arm: [[0, 0.1, 0.15], [0, 0.1, 0.15]] },
  reel:   { pel: [0, 0.88, -0.12], pp: -0.18, sp: -0.25, hd: 0.25,  ank: [[0.14, 0.085, 0.12], [-0.12, 0.085, -0.05]], arm: [[0.9, 0.9, 0.5], [-0.3, 1.1, 0.7]] },
  seat:   { pel: [0, 0.17, -0.25], pp: -0.35, sp: 0.1,   hd: 0.15,  ank: [[0.17, 0.085, 0.45], [-0.15, 0.085, 0.5]],  arm: [[-0.7, 0.35, 0.15], [-0.6, 0.4, 0.2]] },
  flat:   { pel: [0, 0.14, -0.3],  pp: -1.42, sp: 0.06,  hd: 0.1,   ank: [[0.22, 0.085, 0.55], [-0.2, 0.085, 0.62]],  arm: [[0.1, 1.25, 0.35], [-0.1, 1.15, 0.5]] },
  sitUp:  { pel: [0, 0.17, -0.22], pp: -0.25, sp: 0.45,  hd: -0.2,  ank: [[0.17, 0.085, 0.35], [-0.15, 0.085, 0.32]], arm: [[0.4, 0.2, 0.5], [0.5, 0.25, 0.6]] },
  squat:  { pel: [0, 0.52, -0.05], pp: 0.55,  sp: 0.35,  hd: -0.55, ank: [[0.17, 0.085, 0.12], [-0.15, 0.085, 0.1]],  arm: [[0.55, 0.15, 0.7], [0.6, 0.15, 0.7]] }
};
const FALL_STEPS = [
  // key to blend towards, seconds, easing ('in' = accelerating like falling)
  ['reel', 0.45, 'out'], ['seat', 0.28, 'in'], ['flat', 0.38, 'in'], ['lie', 1.8, 'out'], ['sitUp', 0.7, 'inout'], ['squat', 0.65, 'inout'], ['stand', 0.6, 'inout']
];
const FALL = {
  st: null, i: 0, t: 0, from: null, cur: null, down: 0, keep: false, feet: [new THREE.Vector3(), new THREE.Vector3()], _v: new THREE.Vector3(),
  busy() { return this.st !== null; },
  owns() { return this.st !== null; },
  // stay: do not get up (passing out)
  start(stay) {
    if (this.st || SIT.busy()) return;
    DRINK.cancel(); FIST.st = 'idle'; FIST.clip = null; FIST.fight = 0; FIST.holding = false; FIST.queued = false;
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    this.keep = !!stay;
    // the start pose: the standing pose with the feet where they are now
    const k0 = JSON.parse(JSON.stringify(FALL_KEYS.stand));
    for (let i = 0; i < 2; i++) { SIT.toChar(GAIT.feet[i].cur, this._v); k0.ank[i] = [this._v.x, this._v.y, this._v.z]; }
    this.cur = k0; this.from = k0; this.st = 'run'; this.i = 0; this.t = 0;
    this.lieT = 1.4 + Math.random() * 1.2;
    worldEvent('fall', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player' });
  },
  cancel() { this.st = null; this.down = 0; },
  update(dt) {
    if (!this.st) return;
    PLAY.vx *= Math.exp(-dt * 6); PLAY.vz *= Math.exp(-dt * 6);
    const [name, dur0] = FALL_STEPS[this.i], dur = name === 'lie' ? this.lieT : dur0;
    this.t += dt;
    if (this.t >= dur) {
      if (name === 'lie' && this.keep) { this.t = dur; return; }
      this.t -= dur;
      if (name !== 'lie') this.from = this.target(name);
      if (name === 'seat') this.thud(0.7);
      if (name === 'flat') { this.thud(1); PLAY.camShake = Math.max(PLAY.camShake, 0.12); }
      this.i++;
      if (this.i >= FALL_STEPS.length) this.finish();
    }
  },
  target(name) { return name === 'lie' ? FALL_KEYS.flat : FALL_KEYS[name]; },
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
    DRUNK.body.set(0, 0); DRUNK.head.set(0, 0); DRUNK.bodyV.set(0, 0); DRUNK.headV.set(0, 0);
    this.st = null; this.down = 0;
  },
  thud(k) {
    GSFX.run(() => { const { g, t } = GSFX.out(0.6 * k, PLAY.pos); SFX.thump(t, g, 110, 40, 0.7 * k, 0.16); SFX.noiseHit(t, g, { type: 'lowpass', freq: 500, q: 0.7, gain: 0.35 * k, attack: 0.003, decay: 0.12 }); });
    FSFX.cloth();
  },
  pose(P, dt) {
    const [name, dur0, ease] = FALL_STEPS[Math.min(this.i, FALL_STEPS.length - 1)], dur = name === 'lie' ? this.lieT : dur0;
    const u = clamp(this.t / dur, 0, 1), e = ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
    const A = this.from, B = this.target(name), L = (a, b) => a + (b - a) * e;
    const wob = name === 'reel' ? Math.sin(this.t * 22) : 0;   // the arms going round
    P.pel.set(L(A.pel[0], B.pel[0]), L(A.pel[1], B.pel[1]), L(A.pel[2], B.pel[2]));
    P.pelYaw = 0; P.pelRoll = 0; P.pelPitch = L(A.pp, B.pp);
    P.spYaw = 0; P.spRoll = 0; P.spPitch = L(A.sp, B.sp);
    // lying: breathing, and the head turns as if the world spins
    const lying = name === 'lie' || (name === 'sitUp' && u < 0.2);
    P.hdPitch = L(A.hd, B.hd); P.hdYaw = lying ? Math.sin(G.time * 0.8) * 0.4 : 0; P.hdRoll = 0;
    if (lying) P.spPitch += Math.sin(G.time * 1.8) * 0.02;
    P.hatDy = 0; P.hatTilt = 0;
    for (let i = 0; i < 2; i++) {
      P.ank[i].set(L(A.ank[i][0], B.ank[i][0]), L(A.ank[i][1], B.ank[i][1]), L(A.ank[i][2], B.ank[i][2]));
      P.ftYaw[i] = (i === 0 ? 1 : -1) * 0.25 * (P.pel.y < 0.6 ? 1 : 0); P.ftPitch[i] = P.pel.y < 0.4 ? -0.6 : 0;   // heels on the ground, toes up
      const a0 = A.arm[i], b0 = B.arm[i];
      P.armOv[i] = { w: 1, sw: L(a0[0], b0[0]) + wob * 0.5 * (i ? -1 : 1), yw: 0, out: L(a0[1], b0[1]) + Math.abs(wob) * 0.2, el: L(a0[2], b0[2]) };
    }
    P.gunInHand = false;
    this.down = clamp((0.925 - P.pel.y) / 0.75, 0, 1);
  }
};
