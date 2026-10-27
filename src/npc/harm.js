/* ---------- what a body can suffer: hit zones, wounds, reactions, healing, death ----------
   For every person (NPC) the same rules. The game knows exactly where a bullet went: the ray is tested against the
   13 rigid parts of the body (their boxes in the part's own frame) and the point on the part gives the zone:
     head    -> dead on the spot                 neck     -> sinks down, dead within seconds
     chest   -> goes down, bleeds; two are fatal belly    -> doubles over, to the knees, bleeds
     shoulder-> that arm hangs, drops what it held arm     -> arm hangs (less)
     hand    -> drops what it held, holds the hand leg/hip/foot -> a knee goes, he limps from then on
     hat     -> the hat flies off, nothing else  an item  -> shot out of the hand (glass, bottle …)
   Fists (FIST, combat/fist.js) give blows: daze builds up, a big one or too many put him down; a man on the ground
   can be hit further (trauma), and that can kill as well.
   Every wound is kept (zone, side, kind, how bad, when, how far healed, bandaged), heals with game time (faster when
   bandaged by the doctor), and is what the person remembers and tells the AI. The behaviour of the person (Hank:
   BARKEEP) is told through npc.onHarm(info) and decides what he does about it; the body part (falling, limping,
   a hanging arm, a hand on the wound) is done here. */
const ZONES = {
  head:     { name: 'Kopf', lethal: true },
  neck:     { name: 'Hals', dying: true, blood: 0.3, bleed: 0.03 },
  chest:    { name: 'Brust', blood: 0.3, bleed: 0.0045, down: 1, sev: 0.9 },
  belly:    { name: 'Bauch', blood: 0.2, bleed: 0.0035, down: 0.8, sev: 0.8 },
  shoulder: { name: 'Schulter', blood: 0.08, bleed: 0.0015, arm: 0, drop: true, sev: 0.6 },
  arm:      { name: 'Arm', blood: 0.05, bleed: 0.001, arm: 0.35, drop: true, sev: 0.45 },
  hand:     { name: 'Hand', blood: 0.03, bleed: 0.0006, arm: 0.2, drop: true, sev: 0.35 },
  hip:      { name: 'Hüfte', blood: 0.14, bleed: 0.002, leg: 0.8, down: 0.9, sev: 0.7 },
  leg:      { name: 'Bein', blood: 0.08, bleed: 0.0015, leg: 0.6, down: 0.5, sev: 0.55 },
  foot:     { name: 'Fuß', blood: 0.03, bleed: 0.0005, leg: 0.4, sev: 0.35 },
  hat:      { name: 'Hut' }
};
// German words for a zone with its side: where it is (dative: "in der linken Schulter", "im rechten Bein") and where
// it went (accusative: "in die linke Schulter", "ins rechte Bein", "in den Bauch")
const ZONE_GEN = { Kopf: 'm', Hals: 'm', Brust: 'f', Bauch: 'm', Schulter: 'f', Arm: 'm', Hand: 'f', Hüfte: 'f', Bein: 'n', Fuß: 'm', Hut: 'm' };
function zoneIn(zone, side) {
  const n = ZONES[zone].name, g = ZONE_GEN[n], adj = side ? (side === 'L' ? 'linken ' : 'rechten ') : '';
  return (g === 'f' ? 'in der ' : 'im ') + adj + n;
}
function zoneInto(zone, side) {
  const n = ZONES[zone].name, g = ZONE_GEN[n], a = side ? (side === 'L' ? 'link' : 'recht') : '';
  if (g === 'f') return 'in die ' + (a ? a + 'e ' : '') + n;
  if (g === 'n') return 'ins ' + (a ? a + 'e ' : '') + n;
  return 'in den ' + (a ? a + 'en ' : '') + n;
}

/* ---- key poses for people (character space, like FALL_KEYS, which are used as well) ---- */
const HURT_KEYS = {
  clutch:    { pel: [0, 0.86, -0.05], pp: 0.22, sp: 0.4, hd: -0.25, ank: [[0.13, 0.085, 0.05], [-0.13, 0.085, -0.04]], arm: [[0.7, 0.15, 1.5], [0.7, 0.15, 1.5]] },
  kneelHurt: { pel: [0, 0.56, -0.04], pp: 0.12, sp: 0.35, hd: -0.25, ank: [[0.14, 0.085, 0.36], [-0.13, 0.13, -0.47]], fp: [0, 1.45], arm: [[0.6, 0.18, 1.3], [0.35, 0.3, 0.5]] },
  deadBack:  { pel: [0, 0.13, -0.32], pp: -1.52, sp: 0.03, hd: 0.05, hr: 0.75, ank: [[0.3, 0.085, 0.6], [-0.2, 0.085, 0.68]], arm: [[0.4, 1.55, 0.15], [-0.25, 1.25, 0.45]] },
  deadFace:  { pel: [0, 0.13, -0.2], pp: 1.52, sp: 0.03, hd: 0.0, hr: 1.1, ank: [[0.2, 0.1, -0.98], [-0.16, 0.1, -0.95]], fp: [1.5, 1.5], arm: [[2.3, 0.6, 0.4], [0.2, 0.4, 0.2]] },
  slump:     { pel: [0, 0.17, -0.25], pp: -0.55, sp: 0.55, hd: -0.7, hr: 0.4, ank: [[0.2, 0.085, 0.5], [-0.17, 0.085, 0.55]], arm: [[0.1, 0.35, 0.3], [0.0, 0.4, 0.4]] },
  sitHold:   { pel: [0, 0.17, -0.22], pp: -0.25, sp: 0.5, hd: -0.35, ank: [[0.17, 0.085, 0.4], [-0.15, 0.085, 0.3]], arm: [[0.9, 0.2, 0.9], [0.8, 0.25, 1.0]] }
};
function hurtKey(name) { return HURT_KEYS[name] || FALL_KEYS[name]; }

/* a sequence of key poses that owns a person's body while it runs (falls, getting up, dying) */
class KeyAnim {
  constructor(seq, kind, sd, from) {
    this.seq = seq; this.kind = kind || 'fwd'; this.sd = sd || 1; this.i = 0; this.t = 0; this.jit = {}; this.done = false;
    this.snap = KeyAnim.copy(from || FALL_KEYS.stand); this.from = KeyAnim.copy(this.snap);
  }
  static copy(k) {
    return { pel: k.pel.slice(), pp: k.pp || 0, pr: k.pr || 0, sp: k.sp || 0, sr: k.sr || 0, hd: k.hd || 0, hr: k.hr || 0,
      ank: k.ank.map((a) => a.slice()), fp: k.fp ? k.fp.slice() : null, arm: k.arm.map((a) => a.slice()) };
  }
  key(name) {
    if (this.jit[name]) return this.jit[name];
    const k = KeyAnim.copy(hurtKey(name));
    if (this.sd < 0) {   // mirrored: a fall to his left
      const sw = (a) => [a[1], a[0]];
      k.pel[0] = -k.pel[0]; k.pr = -k.pr; k.sr = -k.sr; k.hr = -k.hr;
      k.ank = sw(k.ank).map((v) => [-v[0], v[1], v[2]]); if (k.fp) k.fp = sw(k.fp); k.arm = sw(k.arm);
    }
    if (name !== 'stand') {
      const r = (a) => (Math.random() - 0.5) * 2 * a;
      k.pel[0] += r(0.03); k.pp += r(0.06); k.sp += r(0.08); k.sr += r(0.08); k.hd += r(0.12); k.hr += r(0.15);
      for (const a of k.arm) { a[0] += r(0.25); a[1] += r(0.15); a[2] += r(0.2); }
    }
    return (this.jit[name] = k);
  }
  // steps: { k, d, e ('in' | 'out' | 'inout'), thud, lie: hold (stays on the last lie until next() is called) }
  update(dt, onThud) {
    if (this.done) return;
    const s = this.seq[this.i];
    this.t += dt;
    if (this.t >= s.d) {
      if (s.hold) { this.t = s.d; return; }
      this.t -= s.d;
      if (s.thud && onThud) onThud(s.thud);
      this.from = KeyAnim.copy(this.snap);
      this.i++;
      if (this.i >= this.seq.length) { this.i = this.seq.length - 1; this.done = true; }
    }
  }
  // the step that holds is let go (get up now)
  release() { const s = this.seq[this.i]; if (s && s.hold) { s.hold = false; this.t = s.d; } }
  holding() { const s = this.seq[this.i]; return !!(s && s.hold && this.t >= s.d); }
  pose(P) {
    const s = this.seq[this.i], u = clamp(this.t / s.d, 0, 1), ease = s.e || 'out';
    const e = this.done ? 1 : ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
    const B = s.lie ? this.from : this.key(s.k), A = this.from, S = this.snap, L = (a, b) => a + (b - a) * e;
    for (let j = 0; j < 3; j++) S.pel[j] = L(A.pel[j], B.pel[j]);
    S.pp = L(A.pp, B.pp); S.pr = L(A.pr, B.pr); S.sp = L(A.sp, B.sp); S.sr = L(A.sr, B.sr); S.hd = L(A.hd, B.hd); S.hr = L(A.hr, B.hr);
    if (!S.fp) S.fp = [0, 0];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) { S.ank[i][j] = L(A.ank[i][j], B.ank[i][j]); S.arm[i][j] = L(A.arm[i][j], B.arm[i][j]); }
      const fa = A.fp ? A.fp[i] : (A.pel[1] < 0.4 ? -0.6 : 0), fb = B.fp ? B.fp[i] : (B.pel[1] < 0.4 ? -0.6 : 0);
      S.fp[i] = L(fa, fb);
    }
    P.pel.set(S.pel[0], S.pel[1], S.pel[2]);
    P.pelYaw = 0; P.pelRoll = S.pr; P.pelPitch = S.pp; P.spYaw = 0; P.spRoll = S.sr; P.spPitch = S.sp;
    P.hdPitch = S.hd; P.hdRoll = S.hr; P.hdYaw = 0;
    for (let i = 0; i < 2; i++) {
      P.ank[i].set(S.ank[i][0], S.ank[i][1], S.ank[i][2]); P.ftPitch[i] = S.fp[i]; P.ftYaw[i] = (i === 0 ? 1 : -1) * 0.25 * (P.pel.y < 0.6 && S.fp[i] < 0.5 ? 1 : 0);
      const o = P.armOv[i] && P.armOv[i].key ? P.armOv[i] : (P.armOv[i] = { w: 1, sw: 0, yw: 0, out: 0, el: 0, key: true });
      o.w = 1; o.yw = 0; o.sw = S.arm[i][0]; o.out = S.arm[i][1]; o.el = S.arm[i][2];
    }
    P.gunInHand = false;
    return clamp((0.925 - P.pel.y) / 0.75, 0, 1);   // how far down
  }
}

/* ---- the body state of one person ---- */
class Vitals {
  constructor(npc) {
    this.npc = npc;
    this.blood = 1; this.bleed = 0; this.wounds = []; this.dead = false; this.cause = null; this.deadAt = null;
    this.daze = 0; this.trauma = 0; this.pain = 0; this.anim = null; this.downT = 0; this.downFor = 0; this.lowness = 0; this.knocked = false;
    this.flinch = { yaw: 0, pitch: 0, roll: 0, side: 0, k: 0 }; this.limp = 0; this.armUse = [1, 1]; this.stunT = 0;
    this.clutch = null; this.lastHit = -99; this.bandages = []; this.hatOff = false;
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
  }
  alive() { return !this.dead; }
  // the body is busy with itself: falling, lying, dying, dead (the behaviour waits)
  busy() { return this.dead || !!this.anim; }
  down() { return this.dead || (!!this.anim && this.lowness > 0.5); }
  canFight() { return !this.busy() && this.blood > 0.45 && this.stunT <= 0; }
  canWalk() { return !this.busy(); }
  speedK() { return clamp(1 - this.limp * 0.55, 0.3, 1) * (this.blood < 0.5 ? 0.8 : 1); }
  pain01() { return clamp(this.pain, 0, 1); }
  open() { return this.wounds.filter((w) => w.heal < 1); }

  /* ---- being shot ---- info: { zone, side, part, local (Vector3 on the part), dir (bullet), point } */
  shot(info) {
    const N = this.npc, Z = ZONES[info.zone], dir = info.dir;
    if (this.dead) { this.blood = Math.max(0, this.blood - 0.05); HARM.bloodFx(info.point, dir, 0.6, N); return { zone: info.zone, onBody: true }; }
    this.lastHit = G.time;
    if (info.zone === 'hat') { this.hatOff = true; HARM.knockHat(N, dir); this.flinchBy(dir, 0.5, 'head'); this.pain += 0.1; return { zone: 'hat' }; }
    HARM.bloodFx(info.point, dir, info.zone === 'head' ? 1.6 : 1, N);
    const w = { zone: info.zone, side: info.side || '', kind: 'shot', sev: Z.sev || 1, at: Math.round(TIME.min), heal: 0, bandaged: false, part: info.part, lp: info.local ? [+info.local.x.toFixed(3), +info.local.y.toFixed(3), +info.local.z.toFixed(3)] : null };
    if (info.zone !== 'head') this.wounds.push(w);
    if (info.local) this.stain(info.part, info.local, info.zone === 'head' || info.zone === 'neck' || info.zone === 'chest' ? 1.4 : 1);
    this.blood = Math.max(0, this.blood - (Z.blood || 0));
    this.bleed += Z.bleed || 0;
    this.pain = Math.min(1.5, this.pain + 0.8);
    // where a bullet came from decides the way he goes down: from the front he falls back, from behind forward
    const f = this.forwardDot(dir);   // > 0: the bullet travels the way he faces (shot from behind)
    if (Z.lethal) { this.die('Kopfschuss', dir, f > 0.2 ? 'fwd' : Math.random() < 0.6 ? 'back' : 'crumple'); return w; }
    if (Z.dying) { this.dying = 4 + Math.random() * 4; this.fall('dying', dir); return w; }
    // a second bullet in the body or too much blood lost: he does not get up again
    const bodyShots = this.wounds.filter((x) => x.kind === 'shot' && (x.zone === 'chest' || x.zone === 'belly') && x.heal < 1).length;
    if ((info.zone === 'chest' && bodyShots >= 2) || this.blood < 0.15) { this.dying = 3 + Math.random() * 5; this.fall('dying', dir); return w; }
    if (Z.arm !== undefined) this.armUse[info.side === 'L' ? 0 : 1] = Math.min(this.armUse[info.side === 'L' ? 0 : 1], Z.arm);
    if (Z.leg !== undefined) this.recalc();
    if (Z.down && Math.random() < Z.down) this.fall(info.zone === 'chest' ? 'back' : info.zone === 'belly' ? 'belly' : info.zone === 'hip' ? 'leg' : 'leg', dir, info.side);
    else this.flinchBy(dir, 1.2, info.zone, info.side);
    if (Z.arm !== undefined || Z.drop) this.clutch = { part: info.part, lp: w.lp, t: 10 + Math.random() * 8, side: info.side };
    else if (info.zone === 'leg' || info.zone === 'foot' || info.zone === 'hip') this.clutch = null;
    else this.clutch = { part: info.part, lp: w.lp, t: 6 + Math.random() * 6, side: '' };
    this.stunT = 1.2;
    return w;
  }
  /* ---- a blow of the fist: { head (bool), power, dir (x,z of the punch), heavy, ground } ---- */
  blow(o) {
    if (this.dead) return null;
    const N = this.npc;
    this.lastHit = G.time;
    const head = o.head, p = o.power || 1;
    if (o.ground) this.trauma += 0.11 * p; else this.trauma += (head ? 0.035 : 0.02) * p;
    this.daze += (o.ground ? 0.35 : head ? 0.3 : 0.12) * p * (o.heavy ? 1.6 : 1);
    this.pain = Math.min(1.5, this.pain + (head ? 0.25 : 0.18) * p);
    // bruises: one per zone, growing
    const zone = head ? 'head' : 'chest', ex = this.wounds.find((w) => w.kind === 'blow' && w.zone === zone && w.heal < 0.6);
    if (ex) { ex.sev = Math.min(0.5, ex.sev + 0.04 * p); ex.heal = 0; ex.n = (ex.n || 1) + 1; ex.at = Math.round(TIME.min); }
    else this.wounds.push({ zone, side: '', kind: 'blow', sev: 0.12 * p, at: Math.round(TIME.min), heal: 0, bandaged: false, n: 1 });
    const dir = this._w.set(o.dir.x, 0, o.dir.z);
    if (this.trauma >= 1) { this.die(o.ground ? 'totgeschlagen' : 'erschlagen', dir, 'back'); return 'dead'; }
    if (this.anim) { if (this.lowness > 0.5) { this.downFor += 1.2 * p; this.anim.jit = {}; } return 'ground'; }
    if (this.daze >= 1 || (o.heavy && head && this.daze > 0.6)) {
      this.knocked = true;
      this.fall(o.heavy || Math.random() < 0.5 ? 'back' : 'side', dir, Math.random() < 0.5 ? 'L' : 'R', 2.5 + this.daze * 2.2);
      return 'down';
    }
    this.flinchBy(dir, (o.heavy ? 1.4 : 0.75) * (head ? 1 : 0.7), head ? 'head' : 'chest', '', true);
    N.vx += o.dir.x * (o.heavy ? 2.4 : 1.1); N.vz += o.dir.z * (o.heavy ? 2.4 : 1.1);
    this.stunT = o.heavy ? 0.8 : head ? 0.3 : 0.2;
    return 'hit';
  }
  forwardDot(dir) { const N = this.npc; return dir.x * Math.sin(N.yaw) + dir.z * Math.cos(N.yaw); }
  // an impulse that the pose turns into a jerk of the body away from the hit
  flinchBy(dir, k, zone, side, punch) {
    const N = this.npc, c = Math.cos(N.yaw), s = Math.sin(N.yaw);
    const lx = dir.x * c - dir.z * s, lz = dir.x * s + dir.z * c;   // the push in his frame (+x his left, +z ahead)
    const F = this.flinch, up = zone === 'head' || zone === 'neck';
    F.yaw = clamp(-lx * 0.9 + (side === 'L' ? 0.5 : side === 'R' ? -0.5 : 0), -1, 1) * k;
    F.pitch = (up ? -0.55 : 0.35) * lz * k + (zone === 'belly' || zone === 'chest' ? 0.25 * k : 0);
    F.roll = clamp(lx * 0.5, -0.5, 0.5) * k; F.head = up ? 1 : 0.4; F.k = 1; F.punch = !!punch;
    if (!punch) { N.vx += dir.x * 0.7 * k; N.vz += dir.z * 0.7 * k; }
  }
  recalc() {
    let limp = 0;
    for (const w of this.wounds) { const Z = ZONES[w.zone]; if (Z && Z.leg !== undefined && w.kind === 'shot') limp = Math.max(limp, (1 - Z.leg * 0.6) * (1 - w.heal * 0.85)); }
    this.limp = clamp(limp, 0, 1);
    this.limpSide = (this.wounds.find((w) => w.kind === 'shot' && ZONES[w.zone].leg !== undefined && w.heal < 1) || {}).side || 'R';
    const arm = [1, 1];
    for (const w of this.wounds) { const Z = ZONES[w.zone]; if (Z && Z.arm !== undefined && w.kind === 'shot') { const i = w.side === 'L' ? 0 : 1; arm[i] = Math.min(arm[i], Z.arm + (1 - Z.arm) * w.heal * (w.bandaged ? 1 : 0.8)); } }
    this.armUse = arm;
  }
  /* ---- going down ---- kind: back | side | belly | leg | dying; dir: where the hit came from; side: L/R */
  fall(kind, dir, side, downFor) {
    const N = this.npc, f = this.forwardDot(dir);
    let seq, sd = side === 'L' ? -1 : 1, dk = 'fwd';
    const S = (k, d, e, thud) => ({ k, d, e, thud });
    if (kind === 'leg') { seq = [S('kneelHurt', 0.28, 'in', 0.45), { lie: 1, d: 0.6, hold: true }, S('lunge', 0.45, 'inout'), S('stand', 0.45, 'inout')]; this.downFor = downFor || 1.2 + Math.random(); }
    else if (kind === 'belly') { seq = [S('clutch', 0.22, 'out'), S('kneelHurt', 0.32, 'in', 0.5), S('sitHold', 0.5, 'inout', 0.6), { lie: 1, d: 0.8, hold: true }, S('squat', 0.7, 'inout'), S('stand', 0.6, 'inout')]; this.downFor = downFor || 6 + Math.random() * 5; }
    else if (kind === 'side') { dk = 'side'; seq = [S('lean', 0.22, 'out'), S('hip', 0.24, 'in', 0.9), S('sideFlat', 0.5, 'inout', 0.35), { lie: 1, d: 0.8, hold: true }, S('sitUp', 0.6, 'inout'), S('squat', 0.5, 'inout'), S('stand', 0.5, 'inout')]; this.downFor = downFor || 3; }
    else if (kind === 'dying') { seq = Math.random() < 0.5 ? [S('clutch', 0.3, 'out'), S('kneelHurt', 0.45, 'in', 0.5), S('sitHold', 0.6, 'inout', 0.6), S('slump', 1.4, 'inout'), { lie: 1, d: 1, hold: true }]
      : [S('reel', 0.3, 'out'), S('seat', 0.3, 'in', 0.7), S('flat', 0.6, 'in', 1), { lie: 1, d: 1, hold: true }]; this.downFor = 1e9; }
    else { dk = f > 0.2 ? 'fwd' : 'back'; seq = dk === 'fwd' ? [S('trip', 0.2, 'out'), S('hands', 0.22, 'in', 0.7), S('face', 0.3, 'in', 0.9), S('prone', 0.4, 'inout'), { lie: 1, d: 0.8, hold: true }, S('hands', 0.5, 'inout'), S('kneel', 0.45, 'inout'), S('lunge', 0.4, 'inout'), S('stand', 0.45, 'inout')]
      : [S('reel', 0.28, 'out'), S('seat', 0.26, 'in', 0.8), S('flat', 0.34, 'in', 1), { lie: 1, d: 0.8, hold: true }, S('sitUp', 0.55, 'inout'), S('squat', 0.5, 'inout'), S('stand', 0.5, 'inout')]; this.downFor = downFor || 4 + Math.random() * 3; }
    this.anim = new KeyAnim(seq, dk, sd, this.currentKey());
    this.downT = 0; this.fallKind = kind;
    // the body turns into the fall a little
    N.goal = null; N.vx += dir.x * 1.2; N.vz += dir.z * 1.2;
    worldEvent('npcDown', N.pos.x, N.pos.y, N.pos.z, { by: 'player', npc: N.id, kind });
  }
  // how the body stands right now, as a key (so a fall starts from wherever it is)
  currentKey() {
    const P = this.npc.ch.pose, k = KeyAnim.copy(FALL_KEYS.stand);
    if (this.anim) return KeyAnim.copy(this.anim.snap);
    k.pel = [P.pel.x, P.pel.y, P.pel.z]; k.pp = P.pelPitch; k.pr = P.pelRoll; k.sp = P.spPitch; k.sr = P.spRoll; k.hd = P.hdPitch;
    k.ank = [[P.ank[0].x, P.ank[0].y, P.ank[0].z], [P.ank[1].x, P.ank[1].y, P.ank[1].z]];
    return k;
  }
  die(cause, dir, how) {
    if (this.dead) return;
    const N = this.npc;
    this.dead = true; this.cause = cause; this.deadAt = Math.round(TIME.min); this.bleed = 0; this.dying = 0;
    const S = (k, d, e, thud) => ({ k, d, e, thud });
    const from = this.currentKey();
    let seq;
    if (this.anim && this.lowness > 0.5) seq = [S(this.lowness > 0.85 ? (this.anim.snap.pp > 0.8 ? 'deadFace' : 'deadBack') : 'slump', 0.8, 'inout')];
    else if (how === 'fwd') seq = [S('squat', 0.18, 'in'), S('face', 0.28, 'in', 1), S('deadFace', 0.4, 'inout')];
    else if (how === 'crumple') seq = [S('squat', 0.2, 'in'), S('seat', 0.22, 'in', 0.8), S('slump', 0.3, 'in'), S('deadBack', 0.5, 'in', 0.9)];
    else seq = [S('reel', 0.14, 'out'), S('seat', 0.24, 'in', 0.8), S('deadBack', 0.32, 'in', 1)];
    this.anim = new KeyAnim(seq.concat([{ lie: 1, d: 1, hold: true }]), 'fwd', Math.random() < 0.5 ? 1 : -1, from);
    N.goal = null; if (dir) { N.vx += dir.x * 1.5; N.vz += dir.z * 1.5; }
    N.body.r = 0;
    if (N.sayEl) SAY.hide(N);
    HARM.dropAll(N);
    worldEvent('npcDead', N.pos.x, N.pos.y, N.pos.z, { by: 'player', npc: N.id, cause });
    if (N.onHarm) N.onHarm({ type: 'dead', cause });
  }
  /* ---- per frame (real game seconds) ---- */
  update(dt) {
    const N = this.npc;
    if (this.anim) {
      this.anim.update(dt, (k) => HARM.thud(N, k));
      if (this.anim.holding()) {
        this.downT += dt;
        if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) this.die('verblutet'); }
        else if (!this.dead && this.downT > this.downFor && this.blood > 0.2) { this.anim.release(); this.knocked = false; worldEvent('npcUp', N.pos.x, N.pos.y, N.pos.z, { by: 'world', npc: N.id }); if (N.onHarm) N.onHarm({ type: 'up' }); }
      }
      if (this.anim.done && !this.dead && !this.dying) { this.anim = null; N.body.r = 0.32; this.daze = Math.min(this.daze, 0.5); }
    }
    // bleeding: the blood runs out until the wound closes (or a bandage stops it)
    if (!this.dead && this.bleed > 0) {
      this.blood -= this.bleed * dt;
      this.bleed *= Math.exp(-dt / 150);
      if (this.bleed < 1e-5) this.bleed = 0;
      if (this.blood < 0.1) this.die('verblutet');
      // drops on the ground now and then
      this.dropT = (this.dropT || 0) - dt;
      if (this.dropT <= 0 && this.bleed > 0.0008) { this.dropT = 0.6 + Math.random() * 1.5 / (this.bleed * 600); HARM.drop(N); }
    }
    this.daze = Math.max(0, this.daze - dt * 0.09);
    this.pain = Math.max(0, this.pain - dt * 0.05);
    this.stunT = Math.max(0, this.stunT - dt);
    const F = this.flinch; F.k *= Math.exp(-dt * (F.punch ? 7 : 4.5));
    if (this.clutch) { this.clutch.t -= dt; if (this.clutch.t <= 0) { this.clutch = null; this.clutchRest = 3 + Math.random() * 5; } }
    // an open gunshot on the body or an arm: the hand goes back to it now and then
    else if (!this.dead && !this.anim && (this.clutchRest = (this.clutchRest || 0) - dt) <= 0) {
      const w = this.wounds.find((x) => x.kind === 'shot' && !x.bandaged && x.heal < 0.4 && x.lp && x.part && /torso|pelvis|Arm/.test(x.part));
      if (w) this.clutch = { part: w.part, lp: w.lp, t: 5 + Math.random() * 6, side: ZONES[w.zone].arm !== undefined ? w.side : '' };
      else this.clutchRest = 4;
    }
    N.body.r = this.down() ? 0 : 0.32;
  }
  /* ---- the pose: after the behaviour and the walk have set theirs, before the parts are placed ---- */
  pose(P, dt) {
    const N = this.npc;
    if (this.anim) { this.lowness = this.anim.pose(P); if (this.dead) { P.hdYaw = 0; } else if (this.anim.holding()) { P.spPitch += Math.sin(G.time * 2.2) * 0.03 * (1 - this.lowness * 0.5); P.hdYaw = Math.sin(G.time * 0.6) * 0.3; } this.dressBandages(); return; }
    this.lowness = 0;
    // the jerk of a hit
    const F = this.flinch, k = F.k;
    if (k > 0.01) {
      P.spYaw += F.yaw * k * 0.7; P.pelYaw += F.yaw * k * 0.25; P.spPitch += F.pitch * k; P.spRoll += F.roll * k;
      P.hdYaw += F.yaw * k * 0.6 * F.head; P.hdPitch += F.pitch * k * 0.8 * F.head; P.hdRoll = (P.hdRoll || 0) + F.roll * k * F.head;
      P.pel.y -= 0.05 * k;
    }
    // pain bends him a little; a big loss of blood makes him sway
    const pn = this.pain01();
    P.spPitch += pn * 0.12; P.hdPitch += pn * 0.08;
    if (this.blood < 0.6) { const w = (0.6 - this.blood) * 0.3; P.spRoll += Math.sin(G.time * 1.3) * w; P.pelRoll += Math.sin(G.time * 1.3 + 0.5) * w * 0.4; }
    // limping: the bad leg takes little weight, the body drops over it and hurries off it
    if (this.limp > 0.02) {
      const bad = this.limpSide === 'L' ? 0 : 1, m = Math.min(1, N.speed / 0.4), ph = N.ph + bad * Math.PI;
      const onBad = Math.max(0, Math.sin(ph));
      P.pel.y -= this.limp * (0.07 * onBad * m + 0.02);
      P.pelRoll += this.limp * 0.12 * Math.sin(ph) * m * (bad ? 1 : -1);
      P.spRoll -= this.limp * 0.1 * Math.sin(ph) * m * (bad ? 1 : -1);
      P.pel.x += (bad ? 1 : -1) * this.limp * 0.04;
      P.ank[bad].y += this.limp * 0.02 * (1 - m); P.ank[bad].z += this.limp * 0.06 * (1 - m);
      P.ftPitch[bad] += this.limp * 0.3 * (1 - m);
    }
    // a hand on the wound (the other hand, if the wound is on an arm)
    let busy = [false, false];
    if (this.clutch && this.clutch.lp) {
      const c = this.clutch, part = N.ch.p[c.part];
      if (part) {
        const i = c.side === 'L' ? 1 : c.side === 'R' ? 0 : (this.armUse[1] > 0.5 ? 1 : 0);
        if (this.armUse[i] > 0.15) {
          const tgt = this._v.set(c.lp[0], c.lp[1], c.lp[2]).applyMatrix4(part.matrix);
          tgt.z += 0.06;
          torsoInverse(P);
          const r = armIK(i, tgt, this._w.set(i ? -0.8 : 0.8, -0.6, -0.3));
          const o = P.armOv[i] && P.armOv[i].hurt ? P.armOv[i] : (P.armOv[i] = { w: 1, sw: 0, yw: 0, out: 0, el: 0, hurt: true });
          const wgt = Math.min(1, c.t * 2);
          o.w = wgt; o.sw = r.sw; o.yw = r.yw; o.out = r.out; o.el = r.el; busy[i] = true;
        }
      }
    }
    // an arm that cannot be used hangs (and swings a little when walking)
    for (let i = 0; i < 2; i++) {
      const use = this.armUse[i];
      if (use >= 0.98 || busy[i]) continue;
      const hang = 1 - use, sw = Math.sin(N.ph + i * Math.PI) * 0.12 * Math.min(1, N.speed / 0.5);
      const o = P.armOv[i];
      const tgt = { sw: 0.05 + sw, yw: 0, out: 0.04, el: 0.12 };
      if (!o) P.armOv[i] = { w: hang, sw: tgt.sw, yw: 0, out: tgt.out, el: tgt.el, hurt: true };
      else { o.sw += (tgt.sw - o.sw) * hang; o.out += (tgt.out - o.out) * hang; o.el += (tgt.el - o.el) * hang; o.yw *= 1 - hang; o.w = Math.max(o.w, hang); }
    }
    this.dressBandages();
  }
  /* ---- blood on the clothes: a dark red patch where the bullet went in, riding on the part, growing a little ---- */
  stain(partName, lp, k) {
    const N = this.npc, part = N.ch.p[partName]; if (!part) return;
    const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const B = g.boundingBox;
    // the face of the part's box the point lies on: the patch is thin across it
    const d = [['x', lp.x - B.min.x], ['x', B.max.x - lp.x], ['y', lp.y - B.min.y], ['y', B.max.y - lp.y], ['z', lp.z - B.min.z], ['z', B.max.z - lp.z]];
    d.sort((a, b) => a[1] - b[1]);
    const ax = d[0][0], s = 0.075 * k, mb = new MB();
    mb.box(0, -(ax === 'y' ? 0.008 : s / 2), 0, ax === 'x' ? 0.016 : s, ax === 'y' ? 0.016 : s, ax === 'z' ? 0.016 : s, rgb(0x5a0c08), 0);
    const m = new THREE.Mesh(mb.build(), N.mat || G.litMat); m.position.copy(lp); m.frustumCulled = false; m.scale.setScalar(0.5);
    part.add(m); (this.stains || (this.stains = [])).push({ m, grow: 1 + Math.random() * 0.4 });
    if (this.stains.length > 8) { const o = this.stains.shift(); o.m.parent.remove(o.m); }
  }
  /* ---- bandages: a white band on each bandaged wound, riding on its part ---- */
  dressBandages() {
    const N = this.npc;
    for (const w of this.wounds) {
      if (!w.bandaged || w.heal >= 1 || !w.part || w.bandMesh) continue;
      const part = N.ch.p[w.part]; if (!part) continue;
      const box = part.geometry.boundingBox || (part.geometry.computeBoundingBox(), part.geometry.boundingBox);
      const mb = new MB(), sx = box.max.x - box.min.x + 0.03, sz = box.max.z - box.min.z + 0.03, h = w.zone === 'chest' || w.zone === 'belly' ? 0.12 : 0.07;
      mb.box(0, -h / 2, 0, sx, h, sz, rgb(0xeee6d6), 9);
      if (w.zone === 'shoulder') mb.box(0, -0.02, 0, 0.12, 0.06, sz, rgb(0xeee6d6), 9);
      const m = new THREE.Mesh(mb.build(), N.mat || G.litMat);
      const lx = w.zone === 'chest' || w.zone === 'belly' || w.zone === 'hip' ? 0 : (box.max.x + box.min.x) / 2, lz = (box.max.z + box.min.z) / 2;
      m.position.set(lx, w.lp ? w.lp[1] : -0.15, lz); m.frustumCulled = false;
      part.add(m); w.bandMesh = m; this.bandages.push(m);
    }
    for (const m of this.bandages) if (m.material !== (N.mat || G.litMat)) m.material = N.mat || G.litMat;
    if (this.stains) for (const S of this.stains) { if (S.m.material !== (N.mat || G.litMat)) S.m.material = N.mat || G.litMat; const sc = S.m.scale.x; if (sc < S.grow) S.m.scale.setScalar(Math.min(S.grow, sc + 0.004)); }
  }
  /* ---- time passes (game minutes): wounds heal, blood comes back ---- */
  heal(mins) {
    if (this.dead) return;
    const h = mins / 60;
    this.blood = Math.min(1, this.blood + h * 0.03);
    if (mins > 30) { this.bleed = 0; this.daze = 0; this.pain = Math.min(this.pain, 0.3); }
    for (const w of this.wounds) {
      const days = w.kind === 'blow' ? 0.4 + w.sev * 3 : 1 + w.sev * 9;   // a bruise: hours to a day; a gunshot: days
      w.heal = Math.min(1, w.heal + h / (days * 24) * (w.bandaged ? 1.8 : 1));
    }
    // healed wounds go (what happened stays in the memory of the person)
    for (const w of this.wounds) if (w.heal >= 1 && w.bandMesh) { w.bandMesh.parent.remove(w.bandMesh); this.bandages = this.bandages.filter((m) => m !== w.bandMesh); w.bandMesh = null; }
    this.wounds = this.wounds.filter((w) => w.heal < 1);
    // clean clothes once the gunshots have healed a good way
    if (this.stains && this.stains.length && !this.wounds.some((w) => w.kind === 'shot' && w.heal < 0.5)) { for (const S of this.stains) if (S.m.parent) S.m.parent.remove(S.m); this.stains = []; }
    this.trauma = Math.max(0, this.trauma - h * 0.05);
    this.recalc();
  }
  // the doctor's work: every open wound bandaged, bleeding stopped
  bandageAll() {
    let n = 0;
    for (const w of this.wounds) if (!w.bandaged && w.kind === 'shot') { w.bandaged = true; n++; }
    this.bleed = 0; this.recalc();
    return n;
  }
  // in words, for the AI and the developer panel
  describe() {
    if (this.dead) return 'tot (' + this.cause + ')';
    const out = [];
    for (const w of this.wounds) {
      const how = w.kind === 'shot' ? 'Schusswunde ' + zoneIn(w.zone, w.side) : (w.zone === 'head' ? 'Prellungen im Gesicht' : 'Prellungen am Körper');
      out.push(how + (w.bandaged ? ', verbunden' : '') + (w.heal > 0.6 ? ', fast verheilt' : w.heal > 0.25 ? ', heilt' : ', frisch'));
    }
    if (this.blood < 0.6) out.push('viel Blut verloren, schwach');
    if (this.limp > 0.15) out.push('humpelt');
    if (this.armUse[0] < 0.6 || this.armUse[1] < 0.6) out.push('kann einen Arm kaum bewegen');
    return out.join('; ');
  }
  // kept between sessions
  save() { return { blood: +this.blood.toFixed(3), dead: this.dead, cause: this.cause, deadAt: this.deadAt, hatOff: this.hatOff, wounds: this.wounds.map((w) => ({ zone: w.zone, side: w.side, kind: w.kind, sev: w.sev, at: w.at, heal: +w.heal.toFixed(3), bandaged: w.bandaged, part: w.part, lp: w.lp, n: w.n })) }; }
  load(d) {
    if (!d) return;
    this.blood = clamp(+d.blood || 1, 0.2, 1);
    this.wounds = Array.isArray(d.wounds) ? d.wounds.filter((w) => w && ZONES[w.zone]).map((w) => Object.assign({}, w, { heal: clamp(+w.heal || 0, 0, 0.999) })) : [];
    this.recalc();
    if (d.dead) { this.deadAt = d.deadAt; this.dead = false; this.die(d.cause || 'tot'); this.anim.i = this.anim.seq.length - 1; this.anim.t = 1; this.anim.done = false; }
  }
}

/* ---- the shared part: finding the zone a ray hits, blood, sounds ---- */
const HARM = {
  _inv: new THREE.Matrix4(), _o: new THREE.Vector3(), _d: new THREE.Vector3(), _p: new THREE.Vector3(), _q: new THREE.Vector3(),
  // the first hit of a ray (o, unit d) on any person or anything a person holds: { t, npc, zone, side, part, local, point, item }
  trace(o, d, near, far) {
    let best = null, bestItem = null;
    for (const N of NPCS.list) {
      if (!N.ch.root.visible) continue;
      // a quick test against a ball round the whole body first
      const cx = N.pos.x - o.x, cy = N.pos.y + 0.9 - o.y, cz = N.pos.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z;
      if (tc < near - 1.5 || tc > far + 1.5 || cx * cx + cy * cy + cz * cz - tc * tc > 1.6 * 1.6) continue;
      // what he holds: small balls round each visible prop (the hand is inside the glass: a bullet takes the glass first)
      for (const it of (N.held ? N.held() : [])) {
        const p = it.mesh.matrixWorld.elements, px = p[12], py = p[13] + (it.dy || 0), pz = p[14];
        const ex = px - o.x, ey = py - o.y, ez = pz - o.z, tc2 = ex * d.x + ey * d.y + ez * d.z, r = it.r || 0.06;
        const d2 = ex * ex + ey * ey + ez * ez - tc2 * tc2;
        if (d2 >= r * r) continue;
        const t = tc2 - Math.sqrt(r * r - d2);
        if (t < near || t > far) continue;
        if (!bestItem || t < bestItem.t) bestItem = { t, npc: N, item: it, point: new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t) };
      }
      for (const name in N.ch.p) {
        const part = N.ch.p[name];
        const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
        const B = g.boundingBox;
        this._inv.copy(part.matrixWorld).invert();
        const lo = this._o.copy(o).applyMatrix4(this._inv), ld = this._d.copy(d).transformDirection(this._inv);
        let t0 = near, t1 = best ? best.t : far, ok = true;
        for (const ax of ['x', 'y', 'z']) {
          const inv = 1 / (ld[ax] || 1e-9);
          let ta = (B.min[ax] - lo[ax]) * inv, tb = (B.max[ax] - lo[ax]) * inv;
          if (ta > tb) { const s = ta; ta = tb; tb = s; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) { ok = false; break; }
        }
        if (!ok) continue;
        const local = new THREE.Vector3(lo.x + ld.x * t0, lo.y + ld.y * t0, lo.z + ld.z * t0);
        best = { t: t0, npc: N, part: name, local, point: new THREE.Vector3(o.x + d.x * t0, o.y + d.y * t0, o.z + d.z * t0) };
      }
    }
    if (bestItem && (!best || bestItem.t < best.t + 0.06)) return bestItem;
    if (best && best.part) Object.assign(best, this.zoneOf(best.part, best.local));
    return best;
  },
  // the zone of a point on a part (part frame: +x his left, +y up, +z ahead)
  zoneOf(part, p) {
    const side = /L$/.test(part) ? 'L' : /R$/.test(part) ? 'R' : '';
    if (part === 'head') return { zone: p.y > -0.02 ? 'head' : 'neck', side: '' };
    if (part === 'hat') return { zone: 'hat', side: '' };
    if (part === 'torso') {
      if (p.y > 0.3 && Math.abs(p.x) > 0.1) return { zone: 'shoulder', side: p.x > 0 ? 'L' : 'R' };
      return { zone: p.y > 0.17 ? 'chest' : 'belly', side: '' };
    }
    if (part === 'pelvis' || part === 'gun') return p.y > 0.02 ? { zone: 'belly', side: '' } : { zone: 'hip', side: p.x > 0 ? 'L' : 'R' };
    if (/^uArm/.test(part)) return { zone: 'arm', side };
    if (/^fArm/.test(part)) return { zone: p.y < -0.25 ? 'hand' : 'arm', side };
    if (/^(thigh|shin)/.test(part)) return { zone: 'leg', side };
    if (/^foot/.test(part)) return { zone: 'foot', side };
    return { zone: 'chest', side: '' };
  },
  /* a bullet in a person: the body reacts, the behaviour is told */
  shot(hit, dir) {
    const N = hit.npc;
    if (hit.item) { this.itemShot(N, hit.item, dir, hit.point); return; }
    const w = N.hp.shot({ zone: hit.zone, side: hit.side, part: hit.part, local: hit.local, dir, point: hit.point });
    if (hit.zone !== 'hat') {
      this.fleshSound(hit.point, hit.zone === 'head');
      // the bullet comes out the other side and marks the wall behind (not every time)
      if (hit.zone !== 'hand' && hit.zone !== 'foot' && Math.random() < 0.7) this.exitSplash(hit.point, dir, N);
      // dropping what was in the hand of a hit arm
      const Z = ZONES[hit.zone];
      if (Z.drop || Z.lethal || Z.dying || Z.down) this.dropHand(N, hit.side === 'L' ? 0 : hit.side === 'R' ? 1 : -1, dir);
    } else GSFX.impact(hit.point, 'cloth');
    worldEvent('npcShot', hit.point.x, hit.point.y, hit.point.z, { by: 'player', npc: N.id, zone: hit.zone, side: hit.side, dead: N.hp.dead, room: N.room ? N.room.type : null });
    if (N.onHarm && !N.hp.dead) N.onHarm({ type: 'shot', zone: hit.zone, side: hit.side, wound: w });
  },
  // shot out of his hand: the thing breaks or flies, he jerks the hand back (a sting, no wound)
  itemShot(N, it, dir, p) {
    if (it.kind === 'glass' || it.kind === 'bottle') {
      const g = { x: p.x, y0: p.y - 0.08, z: p.z, h: it.kind === 'bottle' ? 0.28 : 0.12, r: 0.045, kind: it.kind === 'bottle' ? 'bottle' : 'glass', col: it.kind === 'bottle' ? rgb(0x5a3a1a) : rgb(0xb8d0d0), served: true, R: N.room };
      BREAK.shatter(g, dir);
    } else { GSFX.impact(p, 'cloth'); for (let k = 0; k < 6; k++) FX.debris.spawn({ x: p.x, y: p.y, z: p.z, vx: dir.x * 2 + (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: dir.z * 2 + (Math.random() - 0.5) * 2, life: 0.8, size: 0.02, grav: 9.8, drag: 0.6, bounce: true }, [0.85, 0.8, 0.7]); }
    if (it.lose) it.lose();
    N.hp.flinchBy(dir, 0.6, 'arm', it.hand === 0 ? 'L' : 'R');
    N.hp.clutch = { part: it.hand === 0 ? 'fArmL' : 'fArmR', lp: [0, -0.3, 0.02], t: 3, side: it.hand === 0 ? 'L' : 'R' };
    N.hp.pain += 0.2; N.hp.lastHit = G.time;
    worldEvent('npcItemShot', p.x, p.y, p.z, { by: 'player', npc: N.id, item: it.kind, room: N.room ? N.room.type : null });
    if (N.onHarm) N.onHarm({ type: 'item', item: it.kind, hand: it.hand });
  },
  dropHand(N, i, dir) { for (const it of (N.held ? N.held() : [])) if ((i < 0 || it.hand === i) && it.lose) { it.lose(true); if (it.kind === 'glass' || it.kind === 'bottle') { const p = it.mesh.matrixWorld.elements; GSFX.glass(new THREE.Vector3(p[12], p[13], p[14]), false); } } void dir; },
  dropAll(N) { this.dropHand(N, -1); },
  /* blood: a spray where it went in, drops falling, a mark on the floor (and on the wall behind) */
  bloodFx(p, dir, k, N) {
    const n = Math.round(10 * k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 0.6 + Math.random() * 1.8;
      FX.debris.spawn({ x: p.x, y: p.y, z: p.z, vx: dir.x * (1.5 + Math.random() * 2) + Math.cos(a) * v * 0.5, vy: 0.4 + Math.random() * 1.6, vz: dir.z * (1.5 + Math.random() * 2) + Math.sin(a) * v * 0.5,
        life: 0.5 + Math.random() * 0.5, size: 0.012 + Math.random() * 0.016, grav: 9.8, drag: 0.8, bounce: false }, mulc([0.45, 0.05, 0.04], 0.7 + Math.random() * 0.5));
    }
    for (let i = 0; i < Math.ceil(2 * k); i++) FX.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: dir.x * 0.8 + (Math.random() - 0.5) * 0.4, vy: 0.1, vz: dir.z * 0.8 + (Math.random() - 0.5) * 0.4, life: 0.35, size: 0.03, grow: 3, drag: 5, a0: 0.4 }, [0.5, 0.08, 0.06]);
    // on the floor below
    const gy = groundAt(p.x + dir.x * 0.4, p.z + dir.z * 0.4, p.y);
    DECALS.add(N && N.room ? N.room : null, new THREE.Vector3(p.x + dir.x * 0.4, gy + 0.005, p.z + dir.z * 0.4), new THREE.Vector3(0, 1, 0), 'blood', [0.4, 0.06, 0.05]);
  },
  // the bullet out of the back: a splash on what is behind (wall or floor), if close
  exitSplash(p, dir, N) {
    const o = this._p.copy(p).addScaledVector(dir, 0.35);
    const ray = GUN.ray; ray.set(o, dir); ray.near = 0; ray.far = 2.5;
    const objs = W.worldMeshes.slice(); if (N.room && N.room.mesh) objs.push(N.room.mesh);
    const hits = ray.intersectObjects(objs, false);
    if (!hits.length) return;
    const h = hits[0], n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.dot(dir) > 0) n.negate();
    DECALS.add(ROOMS.find((r) => r.mesh === h.object) || null, h.point, n, 'blood', [0.4, 0.06, 0.05]);
  },
  drop(N) {
    const p = N.pos, a = Math.random() * TAU, r = Math.random() * 0.25;
    DECALS.add(N.room || null, new THREE.Vector3(p.x + Math.cos(a) * r, groundAt(p.x, p.z, p.y + 0.3) + 0.004, p.z + Math.sin(a) * r), new THREE.Vector3(0, 1, 0), 'drop', [0.35, 0.05, 0.04]);
  },
  // a man on the ground bleeding: a pool under him
  pool(N) {
    const p = N.pos;
    DECALS.add(N.room || null, new THREE.Vector3(p.x, groundAt(p.x, p.z, p.y + 0.3) + 0.003, p.z), new THREE.Vector3(0, 1, 0), 'pool', [0.3, 0.04, 0.03]);
  },
  fleshSound(p, head) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.8, p);
      SFX.thump(t, g, head ? 150 : 110, 50, head ? 0.6 : 0.5, 0.07);
      SFX.noiseHit(t, g, { type: 'lowpass', freq: 900, q: 0.8, gain: 0.45, attack: 0.001, decay: 0.05 });
      SFX.noiseHit(t + 0.004, g, { type: 'bandpass', freq: 2400, q: 2, gain: 0.12, attack: 0.001, decay: 0.03 });
    });
  },
  thud(N, k) {
    GSFX.run(() => { const { g, t } = GSFX.out(0.6 * k, N.pos); SFX.thump(t, g, 105, 38, 0.7 * k, 0.16); SFX.noiseHit(t, g, { type: 'lowpass', freq: 480, q: 0.7, gain: 0.35 * k, attack: 0.003, decay: 0.12 }); });
  },
  // the hat flies off and lies on the ground (a loose piece, until picked up again — later)
  knockHat(N, dir) {
    const hat = N.ch.p.hat; if (!hat || !hat.visible) return;
    hat.visible = false;
    const m = new THREE.Mesh(hat.geometry, hat.material); m.matrixAutoUpdate = true; m.frustumCulled = false;
    hat.updateMatrixWorld(); m.matrix.copy(hat.matrixWorld); m.matrix.decompose(m.position, m.quaternion, m.scale);
    G.scene.add(m);
    this.loose.push({ m, vx: dir.x * 3, vy: 2.2, vz: dir.z * 3, spin: (Math.random() - 0.5) * 14, t: 0, rest: false, R: N.room });
  },
  loose: [],
  update(dt) {
    for (const L of this.loose) {
      if (L.rest) continue;
      L.t += dt; L.vy -= 9.8 * dt;
      L.m.position.x += L.vx * dt; L.m.position.y += L.vy * dt; L.m.position.z += L.vz * dt;
      L.m.rotation.x += L.spin * dt; L.m.rotation.z += L.spin * 0.6 * dt;
      const gy = groundAt(L.m.position.x, L.m.position.z, L.m.position.y + 0.3) + 0.03;
      if (L.m.position.y < gy) { L.m.position.y = gy; if (Math.abs(L.vy) < 1.2) { L.rest = true; L.m.rotation.set(0, L.m.rotation.y, 0); } L.vy = -L.vy * 0.3; L.vx *= 0.5; L.vz *= 0.5; }
    }
  },
  init() {
    // everyone heals while time passes (awake slowly, asleep the hours at once)
    TIME.onSkip((m) => { for (const N of NPCS.list) if (N.hp) N.hp.heal(m); });
    let acc = 0;
    TIME.onTick((dt) => { acc += dt * TIME.RATE * (TIME.speed || 1); if (acc >= 5) { for (const N of NPCS.list) if (N.hp) N.hp.heal(acc); acc = 0; } });
  }
};
// blood marks on surfaces (the bullet hole pool of combat/fx.js draws them)
Object.assign(HOLE, {
  blood: { core: 0x4a0b08, ring: 0x5e0f0b, mix: 0.9, r1: 0.035, r2: 0.08, stretch: 1.5 },
  drop:  { core: 0x3e0907, ring: null, ringDark: 0.5, r1: 0.025, r2: 0, stretch: 1 },
  pool:  { core: 0x380806, ring: 0x4e0d0a, mix: 0.92, r1: 0.22, r2: 0.36, stretch: 1.35 }
});
