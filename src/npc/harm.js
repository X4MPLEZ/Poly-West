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
/* how each wound bleeds (blood is 1 when whole; weak below 0.65, he cannot stay on his feet below 0.55, out below
   0.42, dead below 0.3): bleed = what it loses per second at first, clot = how many seconds it takes the blood to
   close it (a vein; 0: it does not), art = the chance a bullet tears the big artery there (artB: then it pumps out
   that much and does not stop by itself: a torn femoral artery kills in a minute and a half, with a hand pressed
   on it in a few). The bullet itself costs a little at once (spray). gut: a shot in the belly is agony and, left
   to itself, kills slowly (hours); lung: in the chest he coughs and fights for air. */
const ZONES = {
  head:     { name: 'Kopf', lethal: true },
  neck:     { name: 'Hals', dying: true, bleed: 0.02, art: 0.7, artB: 0.03, clot: 0, spray: 0.04 },
  chest:    { name: 'Brust', bleed: 0.0016, art: 0.15, artB: 0.004, clot: 600, down: 1, sev: 0.9, lung: true, spray: 0.03 },
  belly:    { name: 'Bauch', bleed: 0.0009, art: 0.1, artB: 0.003, clot: 500, down: 0.95, sev: 0.85, gut: true, spray: 0.02 },
  shoulder: { name: 'Schulter', bleed: 0.0009, art: 0.1, artB: 0.004, clot: 240, arm: 0, drop: true, sev: 0.6, spray: 0.015 },
  arm:      { name: 'Arm', bleed: 0.0005, art: 0.18, artB: 0.0045, clot: 150, arm: 0.35, drop: true, sev: 0.45, limb: true, spray: 0.01 },
  hand:     { name: 'Hand', bleed: 0.0003, clot: 90, arm: 0.2, drop: true, sev: 0.35, limb: true, spray: 0.006 },
  hip:      { name: 'Hüfte', bleed: 0.0012, art: 0.2, artB: 0.0065, clot: 300, leg: 0.8, down: 0.9, sev: 0.7, spray: 0.02 },
  thigh:    { name: 'Oberschenkel', bleed: 0.001, art: 0.32, artB: 0.008, clot: 200, leg: 0.55, down: 0.7, sev: 0.6, limb: true, spray: 0.015 },
  leg:      { name: 'Bein', bleed: 0.0008, art: 0.15, artB: 0.006, clot: 180, leg: 0.55, down: 0.5, sev: 0.55, limb: true, spray: 0.012 },   // (old saves)
  calf:     { name: 'Wade', bleed: 0.0004, art: 0.05, artB: 0.0022, clot: 140, leg: 0.4, down: 0.3, sev: 0.4, limb: true, spray: 0.008 },
  foot:     { name: 'Fuß', bleed: 0.00025, clot: 100, leg: 0.35, down: 0.12, sev: 0.35, limb: true, spray: 0.005 },
  hat:      { name: 'Hut' }
};
// the levels of blood (see above)
const BLOOD_WEAK = 0.65, BLOOD_FAINT = 0.55, BLOOD_OUT = 0.42, BLOOD_DEAD = 0.3;
// German words for a zone with its side: where it is (dative: "in der linken Schulter", "im rechten Bein") and where
// it went (accusative: "in die linke Schulter", "ins rechte Bein", "in den Bauch")
const ZONE_GEN = { Kopf: 'm', Hals: 'm', Brust: 'f', Bauch: 'm', Schulter: 'f', Arm: 'm', Hand: 'f', Hüfte: 'f', Oberschenkel: 'm', Bein: 'n', Wade: 'f', Fuß: 'm', Hut: 'm' };
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
  sitHold:   { pel: [0, 0.17, -0.22], pp: -0.25, sp: 0.5, hd: -0.35, ank: [[0.17, 0.085, 0.4], [-0.15, 0.085, 0.3]], arm: [[0.9, 0.2, 0.9], [0.8, 0.25, 1.0]] },
  // against something: slammed back into a wall, slid down it; thrown back over the bar; propped half up; into a wall face first
  wallHit:   { pel: [0, 0.86, -0.18], pp: -0.12, sp: -0.14, hd: 0.5, ank: [[0.15, 0.085, 0.18], [-0.13, 0.085, 0.1]], arm: [[-0.5, 0.75, 0.3], [-0.45, 0.8, 0.35]] },
  wallSit:   { pel: [0, 0.17, -0.18], pp: -0.4, sp: 0.46, hd: -0.55, hr: 0.35, ank: [[0.2, 0.085, 0.55], [-0.17, 0.085, 0.5]], arm: [[-0.15, 0.5, 0.3], [0.05, 0.45, 0.4]] },
  overBar:   { pel: [0, 0.9, -0.12], pp: -0.25, sp: -0.8, hd: 0.55, ank: [[0.16, 0.085, 0.32], [-0.14, 0.085, 0.26]], arm: [[-0.7, 1.35, 0.25], [-0.6, 1.25, 0.35]] },
  propped:   { pel: [0, 0.15, -0.3], pp: -0.95, sp: 0.1, hd: -0.35, hr: 0.4, ank: [[0.22, 0.085, 0.55], [-0.2, 0.085, 0.6]], arm: [[-0.3, 0.6, 0.3], [-0.2, 0.7, 0.4]] },
  wallFront: { pel: [0, 0.8, 0.1], pp: 0.3, sp: 0.22, hd: -0.1, hr: 0.5, ank: [[0.13, 0.085, -0.22], [-0.13, 0.085, -0.1]], fp: [0.3, 0], arm: [[1.55, 0.35, 0.35], [1.45, 0.4, 0.45]] },
  deadSit:   { pel: [0, 0.17, -0.18], pp: -0.4, sp: 0.42, hd: -0.95, hr: 0.6, ank: [[0.22, 0.085, 0.58], [-0.15, 0.085, 0.5]], fp: [-0.4, -0.5], arm: [[0.0, 0.3, 0.1], [0.05, 0.25, 0.1]] },
  // gut-shot: curled up on his side, knees drawn up, both arms round the belly
  curl:      { pel: [-0.28, 0.17, -0.02], pp: 0.55, pr: 1.38, sp: 0.5, sr: 0.1, hd: -0.45, hr: -0.35, ank: [[-0.12, 0.24, 0.16], [-0.3, 0.1, 0.24]], fp: [0.9, 0.9], arm: [[1.1, 0.05, 1.7], [1.0, 0.1, 1.7]] },
  // gut-shot on his back: knees drawn up, head and shoulders lifted off the floor, curled over the belly
  gutBack:   { pel: [0, 0.15, -0.34], pp: -1.2, sp: 0.55, hd: -0.5, ank: [[0.17, 0.085, 0.24], [-0.15, 0.085, 0.2]], fp: [0, 0], arm: [[1.0, 0.15, 1.6], [1.0, 0.15, 1.6]] },
  // sitting on the floor, the hurt leg out, bent over it
  sitLeg:    { pel: [0, 0.17, -0.2], pp: -0.2, sp: 0.62, hd: -0.45, ank: [[0.2, 0.085, 0.62], [-0.15, 0.13, 0.3]], fp: [-0.6, 0], arm: [[0.9, 0.2, 0.9], [0.8, 0.25, 1.0]] },
  // the knees go (faint): down in a heap
  buckle:    { pel: [0, 0.45, -0.05], pp: 0.35, sp: 0.45, hd: -0.6, hr: 0.2, ank: [[0.15, 0.085, 0.12], [-0.13, 0.085, 0.08]], arm: [[0.15, 0.2, 0.3], [0.1, 0.25, 0.3]] }
};
function hurtKey(name) { return HURT_KEYS[name] || FALL_KEYS[name]; }

// which leg kicks out while writhing (they take turns)
function i0(t) { return Math.floor(t / 5) % 2; }
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
    if (this.fit && this.fit[name]) this.fit[name](k);
    return (this.jit[name] = k);
  }
  // steps: { k, d, e ('in' | 'out' | 'inout'), thud, lie: hold (stays on the last lie until next() is called) }
  update(dt, onThud) {
    if (this.done) return;
    const s = this.seq[this.i];
    this.t += dt; if (this.settle) this.settle.t += dt;
    if (this.t >= s.d) {
      if (s.hold) { this.t = s.d; return; }
      this.t -= s.d;
      if (s.thud || s.slam) this.settle = { t: 0, k: Math.min(1, s.thud || 0.8) };
      if ((s.thud || s.slam) && onThud) onThud(s.thud || 0, s);
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
    settlePose(P, this.settle, 'key');
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
  // a torn artery in a leg that nobody has tied off: he does not get up on it, he lies there pressing
  legArtery() { return this.wounds.some((w) => w.art && w.b && !w.field && !w.bandaged && ZONES[w.zone].leg !== undefined); }
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
    this.lastHit = G.time; N.hitFrom = { x: PLAY.pos.x, z: PLAY.pos.z, until: G.time + 1.1 }; N.shotBy = TIME.min;
    if (info.zone === 'hat') { this.hatOff = true; HARM.knockHat(N, dir); this.flinchBy(dir, 0.5, 'head'); this.pain += 0.1; return { zone: 'hat' }; }
    if ((info.hatToo || info.zone === 'head') && !this.hatOff) { this.hatOff = true; HARM.knockHat(N, dir); }   // (a bullet in the head takes the hat with it)
    HARM.bloodFx(info.point, dir, info.zone === 'head' ? 1.6 : 1, N);
    const w = { zone: info.zone, side: info.side || '', kind: 'shot', sev: Z.sev || 1, at: Math.round(TIME.min), heal: 0, bandaged: false, part: info.part, lp: info.local ? [+info.local.x.toFixed(3), +info.local.y.toFixed(3), +info.local.z.toFixed(3)] : null };
    // how it bleeds: a vein (closes by itself in time) or the artery (does not); only the upper arm has the big one
    w.art = !!Z.art && (info.zone !== 'arm' || /^uArm/.test(info.part || '')) && Math.random() < Z.art;
    w.b = w.art ? Z.artB : (Z.bleed || 0) * (0.75 + Math.random() * 0.5); w.lost = 0;
    if (Z.gut) w.gut = true;
    if (info.zone !== 'head') this.wounds.push(w);
    if (info.local) this.stain(info.part, info.local, info.zone === 'head' || info.zone === 'neck' || info.zone === 'chest' ? 1.4 : 1, w);
    this.blood = Math.max(0, this.blood - (Z.spray || 0));
    this.pain = Math.min(1.5, this.pain + (Z.gut ? 1.2 : 0.8));
    this.recalcBleed();
    // where a bullet came from decides the way he goes down: from the front he falls back, from behind forward
    const f = this.forwardDot(dir);   // > 0: the bullet travels the way he faces (shot from behind)
    if (Z.lethal) { this.die('Kopfschuss', dir, f > 0.2 ? 'fwd' : Math.random() < 0.6 ? 'back' : 'crumple'); return w; }
    if (Z.dying) { this.dying = 4 + Math.random() * 4; this.fall('dying', dir); return w; }
    // a second bullet in the body or too much blood lost: he does not get up again
    const bodyShots = this.wounds.filter((x) => x.kind === 'shot' && (x.zone === 'chest' || x.zone === 'belly') && x.heal < 1).length;
    if ((info.zone === 'chest' && bodyShots >= 2) || this.blood < BLOOD_OUT) { this.dying = 3 + Math.random() * 5; this.fall('dying', dir); return w; }
    if (Z.arm !== undefined) this.armUse[info.side === 'L' ? 0 : 1] = Math.min(this.armUse[info.side === 'L' ? 0 : 1], Z.arm);
    if (Z.leg !== undefined) this.recalc();
    // how he goes down: the chest throws him back, the belly folds him up, a thigh or hip puts him on the floor
    // holding it, the calf or foot only drops him to a knee (the artery torn: down for sure)
    const down = Z.down && (w.art || Math.random() < Z.down);
    if (down) this.fall(info.zone === 'chest' ? 'back' : info.zone === 'belly' ? 'belly' : info.zone === 'hip' || info.zone === 'thigh' || info.zone === 'leg' ? 'legSit' : 'leg', dir, info.side);
    else this.flinchBy(dir, 1.2, info.zone, info.side);
    if (Z.arm !== undefined || Z.drop) this.clutch = { part: info.part, lp: w.lp, t: 10 + Math.random() * 8, side: info.side, w };
    else if (info.zone === 'foot' || info.part === 'shinL' || info.part === 'shinR') this.clutch = null;
    else this.clutch = { part: info.part, lp: w.lp, t: 6 + Math.random() * 6, side: '', w };
    this.stunT = 1.2;
    return w;
  }
  /* ---- a blow of the fist: { head (bool), power, dir (x,z of the punch), heavy, ground } ---- */
  blow(o) {
    if (this.dead) return null;
    const N = this.npc;
    this.lastHit = G.time; N.hitFrom = { x: PLAY.pos.x, z: PLAY.pos.z, until: G.time + (o.heavy ? 0.9 : 0.55) }; N.beatenBy = TIME.min;
    const head = o.head, p = o.power || 1, tough = (N.fight && N.fight.toughness) || 1;
    /* a beating knocks a man out long before it kills him: blows daze him, enough of them put him out cold (ko,
       lying there with his eyes shut); only a long, long beating of a man who is already out kills (trauma) */
    if (o.ground) this.trauma += (this.ko > 0 ? 0.05 : 0.03) * p / tough; else this.trauma += (head ? 0.022 : 0.012) * p / tough;
    this.daze += (o.ground ? 0.35 : head ? 0.3 : 0.12) * p * (o.heavy ? 1.6 : 1) / tough;
    this.pain = Math.min(1.5, this.pain + (head ? 0.25 : 0.18) * p);
    // bruises: one per zone, growing
    const zone = head ? 'head' : 'chest', ex = this.wounds.find((w) => w.kind === 'blow' && w.zone === zone && w.heal < 0.6);
    if (ex) { ex.sev = Math.min(0.5, ex.sev + 0.04 * p); ex.heal = 0; ex.n = (ex.n || 1) + 1; ex.at = Math.round(TIME.min); }
    else this.wounds.push({ zone, side: '', kind: 'blow', sev: 0.12 * p, at: Math.round(TIME.min), heal: 0, bandaged: false, n: 1 });
    const dir = this._w.set(o.dir.x, 0, o.dir.z);
    if (this.trauma >= 1) { this.die(o.ground ? 'totgeschlagen' : 'erschlagen', dir, 'back'); return 'dead'; }
    if (this.anim) {
      if (this.lowness > 0.5) {
        this.downFor += 1.2 * p; this.anim.jit = {};
        // still awake down there: enough and he is out cold
        if (!this.ko && this.daze >= 1.5) this.knockOut();
        else if (this.ko > 0) this.ko = Math.max(this.ko, 15);
        // the body on the ground jolts with it and is shoved a little
        const c = Math.cos(N.yaw), sn = Math.sin(N.yaw);
        this.jolt = { x: o.dir.x * c - o.dir.z * sn, z: o.dir.x * sn + o.dir.z * c, k: Math.min(1.5, p), head: head };
        if (!this.pinned) { N.vx += o.dir.x * 0.5 * p; N.vz += o.dir.z * 0.5 * p; }
        this.pain = Math.min(1.5, this.pain + 0.2);
      }
      return 'ground';
    }
    if (this.daze >= 1 || (o.heavy && head && this.daze > 0.6)) {
      this.knocked = true;
      // the second time down in a short while, or a hard one on a dazed head: out cold
      this.kdN = G.time - (this.kdT || -99) < 90 ? (this.kdN || 0) + 1 : 1; this.kdT = G.time;
      this.fall(o.heavy || Math.random() < 0.5 ? 'back' : 'side', dir, Math.random() < 0.5 ? 'L' : 'R', 2.5 + this.daze * 2.2);
      if (this.kdN >= 2 || this.daze >= 1.6) this.knockOut();
      return 'down';
    }
    this.flinchBy(dir, (o.heavy ? 1.8 : 1.05) * (head ? 1 : 0.75) * Math.min(1.3, p), head ? 'head' : 'chest', '', true);
    // knocked back a step (more by a big one)
    const kb = (o.heavy || o.shove ? 3.4 : 1.7) * Math.min(1.4, p);
    N.vx += o.dir.x * kb; N.vz += o.dir.z * kb;
    this.stunT = o.heavy ? 0.8 : head ? 0.3 : 0.2;
    return 'hit';
  }
  // out cold: lies there, eyes shut, does not hear or speak, for half a minute or more
  knockOut() {
    this.ko = 25 + Math.random() * 25; this.knocked = true; this.downFor = Math.max(this.downFor, this.downT + this.ko + 4);
    if (this.npc.onHarm) this.npc.onHarm({ type: 'ko' });
    worldEvent('npcKo', this.npc.pos.x, this.npc.pos.y, this.npc.pos.z, { by: 'player', npc: this.npc.id });
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
    const lw = this.wounds.find((w) => w.kind === 'shot' && ZONES[w.zone].leg !== undefined && w.heal < 1) || {};
    this.limpSide = lw.side || 'R'; this.limpZone = lw.zone || null;
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
    // the leg gives way, he sits down hard and holds it (and stays down a while: a bleeding thigh keeps him there)
    else if (kind === 'legSit') { seq = [S('kneelHurt', 0.26, 'in', 0.5), S('sitLeg', 0.4, 'in', 0.7), { lie: 1, d: 0.8, hold: true }, S('kneelHurt', 0.6, 'inout'), S('lunge', 0.55, 'inout'), S('stand', 0.5, 'inout')]; this.downFor = downFor || 6 + Math.random() * 6; }
    // gut-shot: folds over, to his knees, onto his side and curls up; long minutes before he gets up again
    // gut-shot: folds over, to his knees, sits down hard and goes onto his back, curled up over the belly; long
    // minutes before he gets up again
    else if (kind === 'belly') { seq = [S('clutch', 0.22, 'out'), S('kneelHurt', 0.32, 'in', 0.5), S('sitHold', 0.45, 'inout', 0.7), S('gutBack', 0.7, 'inout', 0.3), { lie: 1, d: 0.8, hold: true }, S('sitHold', 0.9, 'inout'), S('squat', 0.8, 'inout'), S('clutch', 0.6, 'inout'), S('stand', 0.6, 'inout')]; this.downFor = downFor || 35 + Math.random() * 30; }
    // too much blood gone: the knees go and he sinks down (he does not get up again unless it is stopped)
    else if (kind === 'faint') { seq = [S('buckle', 0.45, 'in', 0.5), S('seat', 0.35, 'in', 0.7), S('flat', 0.6, 'in', 0.8), { lie: 1, d: 1, hold: true }, S('sitUp', 0.8, 'inout'), S('squat', 0.7, 'inout'), S('stand', 0.6, 'inout')]; this.downFor = downFor || 20; }
    else if (kind === 'side') { dk = 'side'; seq = [S('lean', 0.22, 'out'), S('hip', 0.24, 'in', 0.9), S('sideFlat', 0.5, 'inout', 0.35), { lie: 1, d: 0.8, hold: true }, S('sitUp', 0.6, 'inout'), S('squat', 0.5, 'inout'), S('stand', 0.5, 'inout')]; this.downFor = downFor || 3; }
    else if (kind === 'dying') { seq = Math.random() < 0.5 ? [S('clutch', 0.3, 'out'), S('kneelHurt', 0.45, 'in', 0.5), S('sitHold', 0.6, 'inout', 0.6), S('slump', 1.4, 'inout'), { lie: 1, d: 1, hold: true }]
      : [S('reel', 0.3, 'out'), S('seat', 0.3, 'in', 0.7), S('flat', 0.6, 'in', 1), { lie: 1, d: 1, hold: true }]; this.downFor = 1e9; }
    else { dk = f > 0.2 ? 'fwd' : 'back'; seq = dk === 'fwd' ? [S('trip', 0.2, 'out'), S('hands', 0.22, 'in', 0.7), S('face', 0.3, 'in', 0.9), S('prone', 0.4, 'inout'), { lie: 1, d: 0.8, hold: true }, S('hands', 0.5, 'inout'), S('kneel', 0.45, 'inout'), S('lunge', 0.4, 'inout'), S('stand', 0.45, 'inout')]
      : [S('reel', 0.28, 'out'), S('seat', 0.26, 'in', 0.8), S('flat', 0.34, 'in', 1), { lie: 1, d: 0.8, hold: true }, S('sitUp', 0.55, 'inout'), S('squat', 0.5, 'inout'), S('stand', 0.5, 'inout')]; this.downFor = downFor || 4 + Math.random() * 3; }
    const lay = kind === 'side' ? 'side' : kind === 'faint' || kind === 'belly' ? 'back' : dk === 'fwd' && (kind === 'back' || kind === 'side') ? 'fwd' : kind === 'back' ? 'back' : kind === 'dying' && seq.some((x) => x.k === 'flat') ? 'back' : null;
    const fit = lay ? this.fitFall(lay, sd, dir, false) : null;
    if (fit && fit.seq) seq = fit.seq;
    this.anim = new KeyAnim(seq, dk, sd, this.currentKey());
    if (fit) { this.anim.fit = fit.keys || null; this.spin = fit.off ? { to: N.yaw + fit.off, t: 0 } : null; this.contact = fit.contact || null; this.pinned = !!fit.seq; }
    else this.pinned = false;
    this.downT = 0; this.fallKind = kind;
    // the body turns into the fall a little (it stays put when it falls against something: the keys carry it there)
    N.goal = null;
    if (this.pinned) { N.vx = N.vz = 0; } else { N.vx += dir.x * 1.2; N.vz += dir.z * 1.2; }
    worldEvent('npcDown', N.pos.x, N.pos.y, N.pos.z, { by: 'player', npc: N.id, kind });
  }
  /* ---- will the body fit where it falls? A body that goes down needs about its length of floor. The way it falls is
     tried first, then turned a little to either side (the body twists into the free space as it goes); with no
     room anywhere it falls against what is there: back into a wall and slides down it, back over the bar, propped
     up against something, or face first into a wall. lay: 'back' | 'fwd' | 'side'; returns { off } (turn by off) or
     { seq, keys, contact } (another way down; keys: per-key changes so it touches what it hit) ---- */
  fitFall(lay, sd, dir, dead) {
    const N = this.npc, ax = lay === 'side' ? -sd : 0, az = lay === 'back' ? -1 : lay === 'fwd' ? 1 : 0;
    const len = lay === 'fwd' ? 1.4 : lay === 'side' ? 1.35 : 1.55;
    const ox = N.pos.x, oz = N.pos.z;
    const probe = (off) => {
      const yaw = N.yaw + off, c = Math.cos(yaw), s = Math.sin(yaw), wx = ax * c + az * s, wz = -ax * s + az * c;
      for (let d = 0.3; d <= len + 0.01; d += 0.12) { const h = HARM.blockedAt(ox + wx * d, oz + wz * d, N.pos.y, 0.16); if (h) return { free: d, h, x: ox + wx * d, z: oz + wz * d, wx, wz }; }
      return null;
    };
    const p0 = probe(0);
    if (!p0) return { off: 0 };
    const offs = Math.random() < 0.5 ? [0.35, -0.35, 0.7, -0.7, 1.0, -1.0] : [-0.35, 0.35, -0.7, 0.7, -1.0, 1.0];
    for (const o of offs) if (!probe(o)) return { off: o };
    // no room: against it
    const S = (k, d, e, thud, slam) => ({ k, d, e, thud, slam });
    const free = p0.free, contact = { x: p0.x, z: p0.z, top: N.pos.y + Math.min(p0.h, 1.3), wx: p0.wx, wz: p0.wz, h: p0.h };
    const shift = (dz) => (k) => { k.pel[2] += dz; for (const a of k.ank) a[2] += dz; };
    const end = dead ? [] : null;
    if (lay === 'fwd') {
      const dz = Math.max(0, free - 0.45);
      if (free < 0.95) return { contact, keys: { wallFront: shift(dz), kneelHurt: shift(dz * 0.7) }, seq: dead
        ? [S('trip', 0.16, 'out'), S('wallFront', 0.14, 'in', 0, 1), S('kneelHurt', 0.4, 'in', 0.6), S('deadSit', 0.6, 'inout', 0.5)]
        : [S('trip', 0.16, 'out'), S('wallFront', 0.14, 'in', 0, 1), S('kneelHurt', 0.45, 'in', 0.6), { lie: 1, d: 0.8, hold: true }, S('lunge', 0.45, 'inout'), S('stand', 0.45, 'inout')] };
      return { contact: null, seq: dead ? [S('trip', 0.2, 'out'), S('hands', 0.22, 'in', 0.7), S('kneelHurt', 0.5, 'inout', 0.5), S('deadSit', 0.6, 'inout', 0.4)]
        : [S('trip', 0.2, 'out'), S('hands', 0.22, 'in', 0.7), { lie: 1, d: 0.8, hold: true }, S('kneel', 0.45, 'inout'), S('lunge', 0.4, 'inout'), S('stand', 0.45, 'inout')] };
    }
    if (lay === 'side') {
      return { contact: free < 0.8 ? contact : null, seq: dead ? [S('lean', 0.2, 'out'), S('hip', 0.24, 'in', 0.9, free < 0.8 ? 0.6 : 0), S('deadSit', 0.6, 'inout', 0.4)]
        : [S('lean', 0.22, 'out'), S('hip', 0.24, 'in', 0.9, free < 0.8 ? 0.6 : 0), S('sitHold', 0.5, 'inout'), { lie: 1, d: 0.8, hold: true }, S('squat', 0.5, 'inout'), S('stand', 0.5, 'inout')] };
    }
    // backwards
    const sit = dead ? 'deadSit' : 'wallSit', up = dead ? [] : [{ lie: 1, d: 0.8, hold: true }, S('squat', 0.55, 'inout'), S('stand', 0.5, 'inout')];
    if (free < 1.05 && p0.h > 0.65 && p0.h < 1.35) {
      // thrown back over the bar (or a table), then down in front of it
      const dz = -Math.max(0, free - 0.24);
      return { contact, keys: { overBar: shift(dz), [sit]: shift(-Math.max(0, free - 0.38)) }, seq: [S('reel', 0.15, 'out'), S('overBar', 0.17, 'in', 0, 1), S('overBar', 0.35, 'out'), S(sit, 0.45, 'in', 0.7)].concat(up) };
    }
    if (free < 1.05) {
      const dz = -Math.max(0, free - 0.3);
      return { contact, keys: { wallHit: shift(dz), [sit]: shift(-Math.max(0, free - 0.38)) }, seq: [S('reel', 0.15, 'out'), S('wallHit', 0.13, 'in', 0, 1), S(sit, 0.42, 'in', 0.7)].concat(up) };
    }
    // a little short of room: down, and propped up against it with the shoulders
    const dz = -Math.max(0, free - 0.95);
    return { contact, keys: { propped: shift(dz) }, seq: [S('reel', 0.2, 'out'), S('seat', 0.26, 'in', 0.8), S('propped', 0.36, 'in', 0.8, 0.5)].concat(dead ? [] : [{ lie: 1, d: 0.8, hold: true }, S('sitUp', 0.5, 'inout'), S('squat', 0.5, 'inout'), S('stand', 0.5, 'inout')]) };
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
    if (this.dying > 0 || this.blood < BLOOD_FAINT) { const N0 = this.npc; if ((N0.room || null) === (G.room || null) && Math.hypot(N0.pos.x - PLAY.pos.x, N0.pos.z - PLAY.pos.z) < 14) FOLEY.moan(N0.pos, N0.voiceProfile && N0.voiceProfile.pitch, 'last', 1); }
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
    let fit = null;
    if (!(this.anim && this.lowness > 0.5)) { fit = this.fitFall(how === 'fwd' ? 'fwd' : 'back', 1, dir || this._w.set(0, 0, 0), true); if (fit.seq) seq = fit.seq; }
    this.anim = new KeyAnim(seq.concat([{ lie: 1, d: 1, hold: true }]), 'fwd', Math.random() < 0.5 ? 1 : -1, from);
    if (fit) { this.anim.fit = fit.keys || null; this.spin = fit.off ? { to: N.yaw + fit.off, t: 0 } : null; this.contact = fit.contact || null; this.pinned = !!fit.seq; }
    N.goal = null; if (this.pinned) { N.vx = N.vz = 0; } else if (dir) { N.vx += dir.x * 1.5; N.vz += dir.z * 1.5; }
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
      this.anim.update(dt, (k, step) => HARM.thud(N, k, step, this.contact));
      // the body twists into the free space while it goes down
      if (this.spin) { const S = this.spin; S.t += dt; N.yaw += wrapA(S.to - N.yaw) * (1 - Math.exp(-dt * 7)); if (S.t > 0.9) this.spin = null; }
      if (this.anim.holding()) {
        this.downT += dt;
        if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) this.die('verblutet'); }
        // up again once he can: enough blood, awake, and (gut-shot) the worst of it over
        else if (!this.dead && this.downT > this.downFor && this.blood > BLOOD_FAINT + 0.03 && !this.out && !this.legArtery()) { this.anim.release(); this.knocked = false; this.fainted = false; worldEvent('npcUp', N.pos.x, N.pos.y, N.pos.z, { by: 'world', npc: N.id }); if (N.onHarm) N.onHarm({ type: 'up' }); }
      }
      if (this.anim.done && !this.dead && !this.dying) { this.anim = null; N.body.r = 0.32; this.daze = Math.min(this.daze, 0.5); }
    }
    this.bleedStep(dt);
    if (this.dead) return;
    // too little blood: the knees go; less still and he is out (eyes shut, no word); then dead
    if (this.blood < BLOOD_FAINT && !this.anim) { this.fainted = true; this.fall('faint', this._w.set(-Math.sin(N.yaw) * 0.2, 0, -Math.cos(N.yaw) * 0.2)); }
    if (this.ko > 0) { this.ko -= dt; if (this.ko <= 0) { this.ko = 0; this.daze = Math.min(this.daze, 0.9); } }
    this.out = this.blood < BLOOD_OUT || this.ko > 0;
    // gut-shot: it does not let go of him (the pain keeps coming back, he moans and writhes)
    const gut = this.wounds.find((w) => w.gut && !w.bandaged && w.heal < 0.5);
    if (gut) this.pain = Math.max(this.pain, 0.75 + 0.25 * Math.sin(G.time * 0.7 + Math.sin(G.time * 0.23) * 3));
    /* suffering on the floor (shot, bleeding, dying; not out cold): moans, whimpers and heavy breathing, heard only
       close by and in the same room; each moan also goes through the body (pose: moanK) */
    const suffer = !this.out && this.anim && this.anim.holding() && (this.dying > 0 || this.bleed > 0.0004 || this.blood < BLOOD_WEAK || this.wounds.some((w) => w.gut && !w.bandaged && w.heal < 0.5));
    this.moanK = Math.max(0, (this.moanK || 0) - dt * 0.9);
    if (suffer && !G.abstract) {
      const near = (N.room || null) === (G.room || null) && Math.hypot(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z) < 14, pit = N.voiceProfile && N.voiceProfile.pitch;
      if ((this.moanT = (this.moanT === undefined ? 1.5 : this.moanT) - dt) <= 0) {
        const dyingNow = this.dying > 0 || this.blood < BLOOD_FAINT;
        this.moanT = dyingNow ? 2.2 + Math.random() * 2.5 : 3.5 + Math.random() * 4.5;
        if (near && !(N.talking || VOICE.speaking(N))) { FOLEY.moan(N.pos, pit, dyingNow && Math.random() < 0.5 ? 'whimper' : 'moan', dyingNow ? 0.8 : 1); this.moanK = 1; }
      }
      if ((this.breathT = (this.breathT || 0) - dt) <= 0) { this.breathT = 3.2 + Math.random(); if (near) FOLEY.breathe(N.pos, pit, this.dying > 0 ? 1.2 : 0.8); }
    }
    // the lungs: a cough now and then, blood on the lips
    const lung = this.wounds.find((w) => w.zone === 'chest' && w.kind === 'shot' && !w.bandaged && w.heal < 0.4);
    if (lung && !this.out && (this.coughT = (this.coughT === undefined ? 3 : this.coughT) - dt) <= 0) { this.coughT = 4 + Math.random() * 7; HARM.cough(N); }
    this.daze = Math.max(0, this.daze - dt * (N.fight && N.fight.on ? 0.11 : 0.09));
    this.pain = Math.max(0, this.pain - dt * 0.05);
    this.stunT = Math.max(0, this.stunT - dt);
    const F = this.flinch; F.k *= Math.exp(-dt * (F.punch ? 7 : 4.5));
    if (this.clutch) { this.clutch.t -= dt; if (this.clutch.t <= 0) { this.clutch = null; this.clutchRest = 3 + Math.random() * 5; } }
    // an open gunshot on the body or an arm: the hand goes back to it now and then
    else if (!this.dead && !this.anim && (this.clutchRest = (this.clutchRest || 0) - dt) <= 0) {
      const w = this.worstBleed(false);
      if (w) this.clutch = { part: w.part, lp: w.lp, t: (w.b > 0.0006 || w.gut ? 14 : 5) + Math.random() * 6, side: ZONES[w.zone].arm !== undefined ? w.side : '', w };
      else this.clutchRest = 4;
    }
    N.body.r = this.down() ? 0 : 0.32;
  }
  /* ---- the pose: after the behaviour and the walk have set theirs, before the parts are placed ---- */
  pose(P, dt) {
    const N = this.npc;
    if (this.anim) { this.lowness = this.anim.pose(P);
      const J = this.jolt;
      if (J && J.k > 0.01) {
        J.k *= Math.exp(-dt * 9);
        P.pel.x += J.x * 0.09 * J.k; P.pel.z += J.z * 0.09 * J.k; P.pel.y += 0.04 * J.k;
        P.pelRoll += J.x * 0.25 * J.k; P.spPitch += (J.head ? -0.1 : 0.35) * J.k; P.hdPitch += (J.head ? 0.5 : -0.2) * J.k; P.hdRoll = (P.hdRoll || 0) + J.x * 0.4 * J.k;
        for (let i = 0; i < 2; i++) if (P.armOv[i]) { P.armOv[i].sw += 0.35 * J.k; P.armOv[i].el += 0.4 * J.k; }
      }
      // pleading from the ground: one hand up towards the gun, open
      if (!this.dead && this.plead && G.time < this.plead) {
        this.pleadW = Math.min(1, (this.pleadW || 0) + dt * 4);
      } else this.pleadW = Math.max(0, (this.pleadW || 0) - dt * 3);
      if (this.pleadW > 0.01) {
        const o = P.armOv[1], w = this.pleadW * (this.lowness > 0.5 ? 1 : 0.6);
        if (o) { o.sw += (1.75 - o.sw) * w; o.out += (0.25 - o.out) * w; o.el += (0.35 - o.el) * w; o.yw += (0.3 - o.yw) * w; }
        P.hdPitch += 0.25 * w;
      }
      if (this.dead) { P.hdYaw = 0; }
      else if (this.anim.holding()) {
        if (this.out) { P.hdYaw = 0.2; P.hdPitch += 0.15; P.spPitch += Math.sin(G.time * 1.6) * 0.01; }   // out cold: only the breath
        else {
          // breath: short and heavy when he is bleeding out, quicker still when he is dying; a tremor in the last minutes
          const dyingNow = this.dying > 0 || this.blood < BLOOD_FAINT, rate = dyingNow ? 4.6 : this.bleed > 0.0004 ? 3.2 : 2.2;
          P.spPitch += Math.sin(G.time * rate) * (dyingNow ? 0.05 : 0.035) * (1 - this.lowness * 0.5); P.hdYaw = Math.sin(G.time * 0.6) * 0.3;
          if (dyingNow) { const tr = 0.02 * Math.sin(G.time * 23) * Math.sin(G.time * 1.7); P.hdRoll = (P.hdRoll || 0) + tr; for (let i = 0; i < 2; i++) if (P.armOv[i]) P.armOv[i].el += tr * 2; }
          // a moan goes through him: the head back, the back arches, the knees come up a little, a hand clenches
          const mk = this.moanK || 0;
          if (mk > 0.01) { const e = Math.sin(Math.min(1, (1 - mk) * 1.6) * Math.PI) ; P.hdPitch -= 0.28 * e; P.spPitch -= 0.1 * e; P.pelRoll += 0.08 * e * (this.seedT ? Math.sign(Math.sin(this.seedT)) : 1); for (let i = 0; i < 2; i++) { P.ank[i].z += 0.06 * e; } if (P.hand) for (let i = 0; i < 2; i++) if (P.hand[i]) P.hand[i].fist = Math.max(P.hand[i].fist || 0, 0.7 * e); }
          // gut-shot: he writhes. Waves of pain: he rolls from one side to the other, the knees fall over together,
          // one leg pushes out and drags back, the head goes back and forth, at the worst he curls up tight
          if (this.wounds.some((w) => w.gut && !w.bandaged && w.heal < 0.5)) {
            const t = G.time + (this.seedT || (this.seedT = Math.random() * 50)), wave = 0.5 + 0.5 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1);
            const roll = Math.sin(t * 0.8) * (0.25 + 0.3 * wave), kick = Math.max(0, Math.sin(t * 1.25)) * wave;
            P.pelRoll += roll; P.spRoll += roll * 0.6; P.hdRoll = (P.hdRoll || 0) + Math.sin(t * 0.8 + 0.6) * 0.35;
            P.spPitch += 0.12 * wave + 0.04 * Math.sin(t * 3.1); P.hdPitch -= 0.15 * wave;
            for (let i = 0; i < 2; i++) { P.ank[i].x += roll * 0.25; }
            P.ank[i0(t)].z += kick * 0.28; P.ank[i0(t)].y += kick * 0.04;
          }
          this.clutchPose(P, dt, true);
        }
      }
      this.dressBandages(); return; }
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
    /* limping: the bad leg is put down briefly and carefully, the good one takes the weight for longer (npc.js runs
       the step faster over the bad leg); while the bad leg carries, the body sinks and drops onto it and the head
       nods, the shoulders lean over the good side; the bad leg swings stiff and wide, the foot dragged low.
       Standing still, the bad foot rests on its toes, the weight on the good leg. */
    if (this.limp > 0.02) {
      const L = this.limp, bad = this.limpSide === 'L' ? 0 : 1, sb = bad === 0 ? 1 : -1, m = Math.min(1, N.speed / 0.4), ph = N.ph + bad * Math.PI;
      const onBad = Math.max(0, -Math.cos(ph)), swingBad = Math.max(0, Math.cos(ph));
      P.pel.y -= L * (0.085 * onBad * m + 0.025);
      P.pelRoll += L * 0.16 * (onBad - 0.4) * m * sb;
      P.spRoll -= L * 0.2 * (onBad - 0.3) * m * sb;
      P.spPitch += L * (0.12 * onBad * m + 0.06);
      P.hdPitch += L * 0.12 * onBad * m;
      P.pel.x -= sb * L * 0.05 * (1 - onBad * m);   // the weight over the good leg
      const a = P.ank[bad];
      a.y = RIG.ankleH + (a.y - RIG.ankleH) * (1 - 0.6 * L);              // barely lifted
      a.x += sb * L * 0.06 * swingBad * m;                                // swung out wide
      P.ftPitch[bad] += L * (0.25 * swingBad * m + 0.35 * (1 - m));       // the toe drags, at rest it is on its toes
      if (m < 0.3) { a.z += L * 0.08 * (1 - m); a.y += L * 0.025 * (1 - m); }
      // a foot: he walks on its toes, the heel never comes down; a thigh or hip: the leg swung stiff from the hip
      if (this.limpZone === 'foot') { P.ftPitch[bad] += 0.4 * L; a.y += 0.025 * L; }
      else if (this.limpZone === 'thigh' || this.limpZone === 'hip' || this.limpZone === 'leg') { a.z += 0.05 * L * swingBad * m; P.pelYaw += 0.08 * L * swingBad * m * sb; }
    }
    const busy = this.clutchPose(P, dt, false);
    // gut-shot on his feet: bent over it, short steps, the other hand on it too
    const gut = this.wounds.find((w) => w.gut && !w.bandaged && w.heal < 0.5);
    if (gut) { P.spPitch += 0.32; P.pel.y -= 0.04; P.hdPitch += 0.12; P.pel.z -= 0.03; }
    // chest: the breath comes short and heavy (the shoulders go with it)
    if (this.bleed > 0.0004 || this.blood < BLOOD_WEAK) { const br = Math.sin(G.time * (this.blood < BLOOD_WEAK ? 5.5 : 4)) * 0.025; P.spPitch -= br; P.hdPitch += br * 0.6; }
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
  /* ---- a hand on the wound: pressed onto it from outside (the point on the part, out along the part's surface), the
     hand on that side (the other one for an arm); a wound on the back is held from the side. Lying or sitting on the
     floor the hand stays on what bleeds most. A hand pressed on it slows the bleeding (handT). ---- */
  clutchPose(P, dt, lying) {
    const N = this.npc, busy = this._busy || (this._busy = [false, false]); busy[0] = busy[1] = false;
    if (lying) {
      const w = this.worstBleed(true);
      if (w && (!this.clutch || this.clutch.w !== w)) this.clutch = { part: w.part, lp: w.lp, t: 1e9, side: ZONES[w.zone].arm !== undefined ? w.side : '', w, lying: true };
      if (!w && this.clutch && this.clutch.lying) this.clutch = null;
    } else if (this.clutch && this.clutch.lying) this.clutch = null;
    const c = this.clutch; if (!c || !c.lp) return busy;
    const part = N.ch.p[c.part]; if (!part || !part.geometry) return busy;
    const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const B = g.boundingBox, lp = c.lp;
    // the nearest side of the part's box (not its ends): that is where the hand goes, a little outside
    const d = [lp[0] - B.min.x, B.max.x - lp[0], lp[2] - B.min.z, B.max.z - lp[2]], k = d.indexOf(Math.min.apply(null, d));
    const nl = this._w.set(k === 0 ? -1 : k === 1 ? 1 : 0, 0, k === 2 ? -1 : k === 3 ? 1 : 0);
    const tgt = this._v.set(lp[0], lp[1], lp[2]).applyMatrix4(part.matrix);
    const n = nl.transformDirection(part.matrix);
    tgt.addScaledVector(n, 0.055);
    const armW = /Arm|hand/.test(c.part);
    torsoInverse(P);
    // which hand: the one on that side of the body (in the torso's frame, so it holds lying down as well)
    const tl = (this._tl || (this._tl = new THREE.Vector3())).copy(tgt).applyMatrix4(AIK.inv);
    let i = armW ? (c.side === 'L' ? 1 : 0) : tl.x > 0.03 ? 0 : tl.x < -0.03 ? 1 : (this.armUse[1] > 0.5 ? 1 : 0);
    if (!armW && this.armUse[i] <= 0.15) i = 1 - i;
    if (this.armUse[i] <= 0.15) return busy;
    const nt = (this._nt || (this._nt = new THREE.Vector3())).copy(n).transformDirection(AIK.inv);
    if (nt.z < -0.55 && !armW) { tl.x = (i === 0 ? 1 : -1) * 0.31; tl.z = Math.max(tl.z, -0.02); tgt.copy(tl).applyMatrix4(AIK.tor); }   // (the back: held at the side)
    if (!armW) GESTURE.safe(tgt, N.ch.look.build.width, N.ch.look.build.belly);
    const s = i === 0 ? 1 : -1, q = this._q || (this._q = new THREE.Vector3());
    // (the pole in the torso's frame: a wound on the front, the elbow out to the side; on the side, back)
    if (nt.z > 0.45) q.set(s * 1, -0.55, 0.1); else q.set(s * 0.6, -0.35, -0.85);
    q.transformDirection(AIK.tor);
    const r = GESTURE.solveArm(i, tgt, q, N.ch.look.build.width, N.ch.look.build.belly);
    const base = P.armOv[i], wgt = Math.min(1, c.t * 2, (c.on = Math.min(1, (c.on || 0) + dt * (lying ? 1.5 : 3))));
    const o = base && base.hurt ? base : { w: 1, sw: 0, yw: 0, out: 0, el: 0, hurt: true };
    if (base && base.key) { o.w = 1; o.sw = lerp(base.sw, r.sw, wgt); o.yw = lerp(base.yw, r.yw, wgt); o.out = lerp(base.out, r.out, wgt); o.el = lerp(base.el, r.el, wgt); }
    else { o.w = wgt; o.sw = r.sw; o.yw = r.yw; o.out = r.out; o.el = r.el; }
    P.armOv[i] = o; busy[i] = true;
    P.hand[i].open = Math.max(P.hand[i].open, 0.7 * wgt); P.hand[i].fist = 0;
    // the belly: both hands on it, one over the other
    const j = 1 - i;
    if (c.w && c.w.gut && this.armUse[j] > 0.15) {
      const t2 = (this._t2 || (this._t2 = new THREE.Vector3())).copy(tgt).applyMatrix4(AIK.inv); t2.x += (i === 0 ? -1 : 1) * 0.085; t2.y -= 0.03; t2.applyMatrix4(AIK.tor);
      GESTURE.safe(t2, N.ch.look.build.width, N.ch.look.build.belly);
      const q2 = (this._q2 || (this._q2 = new THREE.Vector3())).set(-(i === 0 ? 1 : -1), -0.55, 0.1).transformDirection(AIK.tor);
      const r2 = GESTURE.solveArm(j, t2, q2, N.ch.look.build.width, N.ch.look.build.belly), b2 = P.armOv[j];
      const o2 = b2 && b2.hurt ? b2 : { w: 1, sw: 0, yw: 0, out: 0, el: 0, hurt: true };
      if (b2 && b2.key) { o2.w = 1; o2.sw = lerp(b2.sw, r2.sw, wgt); o2.yw = lerp(b2.yw, r2.yw, wgt); o2.out = lerp(b2.out, r2.out, wgt); o2.el = lerp(b2.el, r2.el, wgt); }
      else { o2.w = wgt; o2.sw = r2.sw; o2.yw = r2.yw; o2.out = r2.out; o2.el = r2.el; }
      P.armOv[j] = o2; busy[j] = true; P.hand[j].open = Math.max(P.hand[j].open, 0.7 * wgt); P.hand[j].fist = 0;
    }
    if (c.w && wgt > 0.5) c.w.handT = G.time + 0.3;
    return busy;
  }
  // the wound that bleeds most (that a hand can get to; lying: also a gut-shot, which he holds anyway)
  worstBleed(lying) {
    let best = null, bs = 0;
    for (const w of this.wounds) {
      if (w.kind !== 'shot' || w.bandaged || !w.part || !w.lp || w.heal >= 0.5) continue;
      if (!/torso|pelvis|thigh|Arm|hand/.test(w.part) && !(lying && /shin/.test(w.part) && this.fallKind === 'legSit')) continue;
      const sc = (w.b || 0) * (w.field ? 0.2 : 1) + (w.gut ? 0.002 : 0) + 1e-6;
      if (sc > bs) { bs = sc; best = w; }
    }
    return best;
  }
  /* ---- bleeding: each wound by itself. What stops it: a hand pressed on it (his own: some; somebody kneeling by
     him: most), a field dressing (a vein: most of it; a torn artery in an arm or leg: tied off), the doctor (all).
     A vein closes in time (faster under pressure, slower when he walks about); the artery does not. ---- */
  bleedFactor(w) {
    if (w.bandaged) return 0;
    const Z = ZONES[w.zone] || {};
    let f = w.field ? (w.art && Z.limb ? 0.03 : 0.12) : 1;
    if ((w.aidT || 0) > G.time) f = Math.min(f, 0.12);
    else if ((w.handT || 0) > G.time || (G.abstract && !this.out)) f = Math.min(f, w.art ? 0.5 : 0.4);
    return f;
  }
  recalcBleed() { let t = 0; for (const w of this.wounds) if (w.b) t += w.b * this.bleedFactor(w); this.bleed = t; }
  bleedStep(dt) {
    const N = this.npc;
    if (this.dead) { this.bleed = 0; return; }
    let tot = 0, lost = 0, spurt = null, sf = 0;
    const moving = N.speed > 0.4;
    for (const w of this.wounds) {
      if (!w.b) continue;
      const Z = ZONES[w.zone] || {}, f = this.bleedFactor(w), r = w.b * f;
      let l;
      if (!w.art && Z.clot) {
        // (exact for any dt: what a closing vein loses until it closes)
        const tau = Z.clot * (moving ? 1.6 : 1) * (f < 0.5 ? 0.5 : 1), k = Math.exp(-dt / tau);
        l = r * tau * (1 - k); w.b *= k; if (w.b < 2e-5) w.b = 0;
      } else l = r * dt;
      w.lost = (w.lost || 0) + l; lost += l; tot += r;
      if (w.art && f > 0.3 && r > sf) { sf = r; spurt = w; }
    }
    this.bleed = tot;
    if (lost <= 0) return;
    this.blood -= lost;
    if (this.blood < BLOOD_DEAD) { this.die('verblutet'); return; }
    // what it leaves: drops where he walks, a pool where he lies, the artery pumping in spurts
    const vis = N.ch.root.visible && !G.abstract;
    if (this.anim && this.lowness > 0.5) { this.poolAcc = (this.poolAcc || 0) + lost; if (this.poolAcc > 0.002) { if (vis) BLOOD.pool(N, this.poolAcc); this.poolAcc = 0; } }
    else { this.dripAcc = (this.dripAcc || 0) + lost; if (this.dripAcc > 0.0022) { this.dripAcc = 0; if (vis) BLOOD.drip(N, this.dripPoint(this._v)); } }
    if (spurt && vis) { this.spurtT = (this.spurtT || 0) - dt; if (this.spurtT <= 0) { this.spurtT = 0.68 + Math.random() * 0.12; const p = this.woundPoint(spurt, this._v, this._w); if (p) BLOOD.spurt(p, this._w, sf / 0.008, N); } }
  }
  // where a wound is in the world (and its outward normal into nOut)
  woundPoint(w, out, nOut) {
    const part = w && this.npc.ch.p[w.part]; if (!part || !w.lp) return null;
    part.updateMatrixWorld();
    out.set(w.lp[0], w.lp[1], w.lp[2]).applyMatrix4(part.matrixWorld);
    if (nOut) {
      const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const B = g.boundingBox, lp = w.lp, d = [lp[0] - B.min.x, B.max.x - lp[0], lp[2] - B.min.z, B.max.z - lp[2]], k = d.indexOf(Math.min.apply(null, d));
      nOut.set(k === 0 ? -1 : k === 1 ? 1 : 0, 0, k === 2 ? -1 : k === 3 ? 1 : 0).transformDirection(part.matrixWorld);
    }
    return out;
  }
  // drops fall from the lowest bleeding wound, or the hand pressed on it
  dripPoint(out) {
    const w = this.wounds.filter((x) => x.b && x.lp).sort((a, b) => b.b - a.b)[0];
    if (!w || !this.woundPoint(w, out)) out.set(this.npc.pos.x, this.npc.pos.y + 0.9, this.npc.pos.z);
    return out;
  }
  /* ---- blood on the clothes: a dark red patch where the bullet went in, riding on the part, growing a little ---- */
  /* ---- blood on the clothes: soaked into the cloth around the hole, flat on the part's face (an uneven patch,
     dark at the hole, lighter at its edge), spreading with what the wound loses, mostly downwards, with runs where
     it drips; when it reaches the side of the part it goes on round the edge. Rebuilt as it grows. ---- */
  stain(partName, lp, k, wound) {
    const N = this.npc, part = N.ch.p[partName]; if (!part) return;
    const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const B = g.boundingBox;
    // the face of the part's box the point lies on
    const d = [[0, -1, lp.x - B.min.x], [0, 1, B.max.x - lp.x], [1, -1, lp.y - B.min.y], [1, 1, B.max.y - lp.y], [2, -1, lp.z - B.min.z], [2, 1, B.max.z - lp.z]];
    d.sort((a, b) => a[2] - b[2]);
    const S = { part, ax: d[0][0], sg: d[0][1], lp: [lp.x, lp.y, lp.z], k, w: wound || null, seed: Array.from({ length: 12 }, () => 0.75 + Math.random() * 0.5), r: 0, m: null };
    (this.stains || (this.stains = [])).push(S);
    if (this.stains.length > 8) { const o = this.stains.shift(); if (o.m && o.m.parent) o.m.parent.remove(o.m); }
    this.stainBuild(S, 0.028 * k);
  }
  stainBuild(S, r) {
    const N = this.npc, part = S.part, B = part.geometry.boundingBox, mb = new MB();
    S.r = r;
    // the face's frame: n (out of the part), u and v across it (v up where there is an up)
    const ax = S.ax, ua = ax === 0 ? 2 : 0, va = ax === 1 ? 2 : 1, lo = [B.min.x, B.min.y, B.min.z], hi = [B.max.x, B.max.y, B.max.z];
    const face = S.sg > 0 ? hi[ax] : lo[ax], lift = 0.004, P = (u, v, l) => { const q = [0, 0, 0]; q[ax] = face + S.sg * (lift + (l || 0)); q[ua] = clamp(u, lo[ua] - 0.002, hi[ua] + 0.002); q[va] = clamp(v, lo[va] - 0.002, hi[va] + 0.002); return q; };
    const cu = S.lp[ua], cv = S.lp[va], down = va === 1 ? 1 : 0;
    // keep every triangle facing out of the part
    const tri = (a, b, c, col) => {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]][ax] * S.sg;
      if (nx < 0) mb.tri(a, c, b, [col[0], col[2], col[1]], 0); else mb.tri(a, b, c, col, 0);
    };
    const dark = [0.2, 0.015, 0.012], mid = [0.36, 0.035, 0.03], edge = [0.44, 0.06, 0.045], hole = [0.07, 0.01, 0.01];
    const n = S.seed.length, ring = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, ca = Math.cos(a), sa = Math.sin(a), rr = r * S.seed[i];
      // (it spreads down the cloth further than up)
      ring.push([cu + ca * rr, cv + sa * rr * (sa < 0 ? 1 + 0.9 * down : 0.75)]);
    }
    const C = P(cu, cv, 0.0005);
    for (let i = 0; i < n; i++) { const p0 = ring[i], p1 = ring[(i + 1) % n]; tri(C, P(p0[0], p0[1]), P(p1[0], p1[1]), [mid, edge, edge]); }
    // the soaked middle and the hole
    const ri = r * 0.45;
    for (let i = 0; i < 6; i++) { const a0 = (i / 6) * TAU, a1 = ((i + 1) / 6) * TAU; tri(P(cu, cv, 0.001), P(cu + Math.cos(a0) * ri, cv + Math.sin(a0) * ri, 0.001), P(cu + Math.cos(a1) * ri, cv + Math.sin(a1) * ri, 0.001), [dark, mid, mid]); }
    const rh = 0.007;
    for (let i = 0; i < 5; i++) { const a0 = (i / 5) * TAU, a1 = ((i + 1) / 5) * TAU; tri(P(cu, cv, 0.0015), P(cu + Math.cos(a0) * rh, cv + Math.sin(a0) * rh, 0.0015), P(cu + Math.cos(a1) * rh, cv + Math.sin(a1) * rh, 0.0015), [hole, hole, hole]); }
    // runs down from its lower edge once it has soaked through
    if (down && r > 0.045) for (let j = 0; j < Math.min(3, Math.floor((r - 0.03) / 0.025)); j++) {
      const x = cu + (S.seed[j] - 1) * r * 1.6, y0 = cv - r * (1.2 + down * 0.5) * 0.85, L = r * (0.6 + S.seed[j + 3] * 0.8), w = 0.006 + 0.004 * S.seed[j + 6];
      tri(P(x - w, y0), P(x + w, y0), P(x + w * 0.5, y0 - L), [mid, mid, mid]); tri(P(x - w, y0), P(x + w * 0.5, y0 - L), P(x - w * 0.5, y0 - L), [mid, mid, mid]);
      tri(P(x - w * 0.9, y0 - L), P(x + w * 0.9, y0 - L), P(x, y0 - L - w * 1.6), [mid, mid, mid]);
    }
    // round the edge: where the patch runs off the face to one side, it goes on along the side of the part
    for (const sd of [-1, 1]) {
      const lim = sd > 0 ? hi[ua] : lo[ua], over = (cu + sd * r * 1.05) - lim;
      if (sd * over <= 0) continue;
      const depth = Math.min(Math.abs(over) * 1.4, hi[ax] - lo[ax]);
      const q = (t, v) => { const o = [0, 0, 0]; o[ua] = lim + sd * lift; o[ax] = face - S.sg * t; o[va] = clamp(v, lo[va], hi[va]); return o; };
      const vh = r * 0.7;
      const pa = q(0, cv - vh * 1.3), pb = q(0, cv + vh * 0.8), pc = q(depth, cv + vh * 0.3), pd = q(depth, cv - vh);
      // (facing out of that side)
      const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
      const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]][ua] * sd;
      if (nn > 0) { mb.tri(pa, pb, pc, [mid, edge, edge], 0); mb.tri(pa, pc, pd, [mid, edge, edge], 0); } else { mb.tri(pa, pc, pb, [mid, edge, edge], 0); mb.tri(pa, pd, pc, [mid, edge, edge], 0); }
    }
    const geo = mb.build();
    if (S.m) { S.m.geometry.dispose(); S.m.geometry = geo; }
    else { S.m = new THREE.Mesh(geo, N.mat || G.litMat); S.m.frustumCulled = false; part.add(S.m); }
  }
  /* ---- bandages, riding on the part, fitted to it: the cross-section of the part at the wound (from its own
     corners) gives the size of every turn, so a band sits on a thigh as on an arm or the chest.
     The doctor's: three turns of clean linen, a little crooked, a pad over the wound with the blood come through,
     a knot with two ends. Yours (play/aid.js, a field dressing): a strip of
     cloth, two turns, a fat knot, the blood soaking through; on an arm or leg with the artery torn, tied off above
     the wound with a stick through the knot. ---- */
  dressBandages() {
    const N = this.npc;
    for (const w of this.wounds) {
      if (w.heal >= 1 || !w.part) continue;
      if (w.bandaged && !w.bandMesh) this.makeBand(w, false);
      else if (w.field && !w.bandaged && !w.fieldMesh) this.makeBand(w, true);
    }
    for (const m of this.bandages) if (m.material !== (N.mat || G.litMat)) m.material = N.mat || G.litMat;
    // (the patch soaks further with what the wound has lost; rebuilt now and then while it grows)
    if (this.stains) for (const S of this.stains) {
      if (S.m && S.m.material !== (N.mat || G.litMat)) S.m.material = N.mat || G.litMat;
      const want = Math.min(0.13, 0.028 * S.k + Math.sqrt(S.w && S.w.lost || 0) * 0.32);
      if (want > S.r * 1.08 + 0.002 && G.time > (S.t || 0)) { S.t = G.time + 0.4; this.stainBuild(S, Math.min(want, S.r + 0.015)); }
    }
  }
  // the part's cross-section at height y (part frame): centre and half sizes, from the corners near that height
  section(part, y) {
    const g = part.geometry, P = g.attributes.position.array, C = g._sect || (g._sect = new Map()), key = Math.round(y * 100);
    if (C.has(key)) return C.get(key);
    let r = null;
    for (const band of [0.025, 0.05, 0.1]) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
      for (let i = 0; i < P.length; i += 3) { if (Math.abs(P[i + 1] - y) > band) continue; n++; x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
      if (n >= 4) { r = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 }; break; }
    }
    if (!r) { if (!g.boundingBox) g.computeBoundingBox(); const B = g.boundingBox; r = { cx: (B.max.x + B.min.x) / 2, cz: (B.max.z + B.min.z) / 2, rx: (B.max.x - B.min.x) / 2, rz: (B.max.z - B.min.z) / 2 }; }
    C.set(key, r);
    return r;
  }
  makeBand(w, field) {
    const N = this.npc, part = N.ch.p[w.part]; if (!part || !part.geometry) return;
    const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const B = g.boundingBox, mb = new MB(), trunk = /torso|pelvis/.test(w.part), Z = ZONES[w.zone] || {};
    const lin = field ? [rgb(0xb9a98c), rgb(0xa8977a), rgb(0xc2b496)] : [rgb(0xf0e9da), rgb(0xe2d8c4), rgb(0xeae2d0)];
    const blood = rgb(field ? 0x7a1612 : 0x8a2a22);
    const hb = trunk ? 0.05 : 0.034, n = field ? 2 : 3, step = trunk ? 0.042 : 0.027;
    const yw = clamp(w.lp ? w.lp[1] : (B.max.y + B.min.y) / 2, B.min.y + hb * 1.6, B.max.y - hb * 1.6);
    // the wound's direction round the part (where the pad and the stain go): from the section's centre
    const S0 = this.section(part, yw), wa = w.lp ? Math.atan2(w.lp[0] - S0.cx, w.lp[2] - S0.cz) : 0;
    // one turn: an eight-sided band round the section at y, a little crooked
    const turn = (y, h, tilt, col, gap) => {
      // (a rounded band: from the skin out to its full thickness and back, so it hugs the part without a gap)
      // (the parts are boxes: the turn is the box's outline pushed out by gap, a little puffed at the middle of each side)
      const S = this.section(part, y), rx = S.rx + gap, rz = S.rz + gap, M = [], I = [];
      const outline = (ax, az, puff) => [[0, az + puff], [ax, az], [ax + puff, 0], [ax, -az], [0, -az - puff], [-ax, -az], [-ax - puff, 0], [-ax, az]].map((q) => [S.cx + q[0], S.cz + q[1]]);
      M.push(...outline(rx, rz, gap * (trunk ? 0.3 : 0.6))); I.push(...outline(S.rx + 0.003, S.rz + 0.003, 0));
      mb.push(new THREE.Matrix4().makeTranslation(S.cx, y, S.cz).multiply(new THREE.Matrix4().makeRotationX(tilt * 0.6)).multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(new THREE.Matrix4().makeTranslation(-S.cx, -y, -S.cz)));
      mb.ring(I, y - h / 2, M, y - h * 0.18, mulc(col, 0.88), 9); mb.ring(M, y - h * 0.18, M, y + h * 0.18, col, 9); mb.ring(M, y + h * 0.18, I, y + h / 2, mulc(col, 0.95), 9);
      mb.pop();
      return { S, rx, rz };
    };
    let outer = null;
    for (let i = 0; i < n; i++) {
      const y = yw + (i - (n - 1) / 2) * step, gap = (trunk ? 0.008 : 0.01) + i * 0.003;
      outer = turn(y, hb * (field ? 1.15 : 1), (i - (n - 1) / 2) * (trunk ? 0.05 : 0.13) * (field ? 1.4 : 1), lin[i % 3], gap);
    }
    // on the wound: the pad underneath shows as a bulge, and the blood comes through it
    const ox = Math.sin(wa), oz = Math.cos(wa), r = Math.hypot(ox * (outer.rx + 0.006), oz * (outer.rz + 0.006));
    const px = outer.S.cx + ox * r, pz = outer.S.cz + oz * r, along = Math.abs(ox) > Math.abs(oz);
    mb.box(px, yw - 0.038, pz, along ? 0.012 : 0.07, 0.076, along ? 0.07 : 0.012, lin[0], 0);
    const bs = (field ? 0.05 : 0.034) * (0.8 + Math.min(1, (w.lost || 0) * 10));
    mb.box(px + ox * 0.004, yw - bs / 2 - 0.005, pz + oz * 0.004, along ? 0.008 : bs, bs * 1.15, along ? bs : 0.008, mixc(blood, lin[0], field ? 0.1 : 0.3), 0);
    if (field) mb.box(px + ox * 0.005, yw - bs * 0.9, pz + oz * 0.005, along ? 0.007 : bs * 0.45, bs * 0.7, along ? bs * 0.45 : 0.007, mulc(blood, 0.8), 0);   // (run down)
    // the knot, on the outside opposite the wound (an arm: out to the side), with its two ends hanging down
    const ka = trunk ? wa + Math.PI * 0.6 : /L$/.test(w.part) ? Math.PI / 2 : -Math.PI / 2, kx = Math.sin(ka), kz = Math.cos(ka);
    const kr = Math.hypot(kx * (outer.rx + 0.012), kz * (outer.rz + 0.012)), kpx = outer.S.cx + kx * kr, kpz = outer.S.cz + kz * kr;
    const ks = field ? 0.03 : 0.022;
    mb.box(kpx, yw - ks / 2, kpz, ks, ks * 1.1, ks, lin[0], 0);
    const tl = field ? 0.08 : 0.04;
    mb.push(new THREE.Matrix4().makeTranslation(kpx, yw - ks / 2, kpz).multiply(new THREE.Matrix4().makeRotationY(ka)));
    mb.push(new THREE.Matrix4().makeRotationZ(0.35)); mb.box(-0.006, -tl, 0.006, 0.014, tl, 0.005, lin[2], 0); mb.pop();
    mb.push(new THREE.Matrix4().makeRotationZ(-0.25)); mb.box(0.006, -tl * 0.85, 0.008, 0.012, tl * 0.85, 0.005, lin[1], 0); mb.pop();
    mb.pop();
    // tied off (a field dressing on a torn artery in an arm or leg): a tight band above, a stick twisted in it
    if (field && w.art && Z.limb) {
      const yt = clamp(yw + 0.09, B.min.y + 0.03, B.max.y - 0.03);
      const T = turn(yt, 0.022, 0, rgb(0x6a2a20), 0.004);
      mb.push(new THREE.Matrix4().makeTranslation(T.S.cx + kx * (T.rx + 0.012), yt, T.S.cz + kz * (T.rz + 0.012)).multiply(new THREE.Matrix4().makeRotationY(ka)).multiply(new THREE.Matrix4().makeRotationZ(0.5)));
      mb.box(0, -0.065, 0, 0.012, 0.13, 0.012, rgb(0x7a5a3a), 3); mb.pop();
    }
    const m = new THREE.Mesh(mb.build(), N.mat || G.litMat);
    m.frustumCulled = false;
    part.add(m); this.bandages.push(m);
    if (field) w.fieldMesh = m; else w.bandMesh = m;
  }
  /* ---- time passes (game minutes): wounds heal, blood comes back ---- */
  heal(mins) {
    if (this.dead) return;
    const h = mins / 60;
    // the blood comes back slowly (faster at rest); a long while: the daze and the worst pain are gone
    this.blood = Math.min(1, this.blood + h * (this.anim ? 0.07 : 0.05));
    if (mins > 30) { this.daze = 0; this.pain = Math.min(this.pain, 0.3); }
    for (const w of this.wounds) {
      const days = w.kind === 'blow' ? 0.4 + w.sev * 3 : 1 + w.sev * 9;   // a bruise: hours to a day; a gunshot: days
      w.heal = Math.min(1, w.heal + h / (days * 24) * (w.bandaged ? 1.8 : w.field ? 1.2 : 1));
      // a gut-shot nobody has seen to goes bad: fever, and in the end it kills him (half a day or so)
      if (w.gut && !w.bandaged && w.heal < 0.5) { w.sep = (w.sep || 0) + h / (10 + w.sev * 4); if (w.sep >= 1) { this.die('Bauchschuss'); return; } }
    }
    // healed wounds go (what happened stays in the memory of the person)
    for (const w of this.wounds) if (w.heal >= 1) for (const k of ['bandMesh', 'fieldMesh']) if (w[k]) { if (w[k].parent) w[k].parent.remove(w[k]); this.bandages = this.bandages.filter((m) => m !== w[k]); w[k] = null; }
    this.wounds = this.wounds.filter((w) => w.heal < 1);
    // clean clothes once the gunshots have healed a good way
    if (this.stains && this.stains.length && !this.wounds.some((w) => w.kind === 'shot' && w.heal < 0.5)) { for (const S of this.stains) if (S.m && S.m.parent) S.m.parent.remove(S.m); this.stains = []; }
    this.trauma = Math.max(0, this.trauma - h * 0.05);
    this.recalc();
  }
  // the doctor's work: every open wound bandaged, bleeding stopped
  bandageAll() {
    let n = 0;
    for (const w of this.wounds) if (!w.bandaged && w.kind === 'shot') {
      w.bandaged = true; w.b = 0; n++;
      // (a field dressing comes off and the proper one goes on)
      if (w.field) { w.field = false; if (w.fieldMesh) { w.fieldMesh.parent && w.fieldMesh.parent.remove(w.fieldMesh); this.bandages = this.bandages.filter((m) => m !== w.fieldMesh); w.fieldMesh = null; } }
    }
    this.bleed = 0; this.dying = 0; this.recalc();
    return n;
  }
  /* first aid (the player, play/aid.js): pressing on a wound (until: G.time), a field dressing on it (stops a vein
     mostly and ties off an artery in an arm or leg; heals no faster, the doctor is still needed) */
  press(w, until) { if (w) w.aidT = until; this.recalcBleed(); }
  fieldDress(w) {
    if (!w || w.bandaged || w.field) return false;
    w.field = true; w.fieldAt = Math.round(TIME.min);
    if (!w.art && w.b) w.b *= 0.5;
    if (this.dying > 0 && w.zone !== 'neck') this.dying = 0;
    this.recalcBleed();
    return true;
  }
  // what still needs the doctor: a gunshot not bandaged by him
  needsDoc() { return this.wounds.some((w) => w.kind === 'shot' && !w.bandaged && w.heal < 0.5); }
  // in words, for the AI and the developer panel
  describe() {
    if (this.dead) return 'tot (' + this.cause + ')';
    const out = [];
    for (const w of this.wounds) {
      const how = w.kind === 'shot' ? (w.gut ? 'Bauchschuss' : 'Schusswunde ' + zoneIn(w.zone, w.side)) : (w.zone === 'head' ? 'Prellungen im Gesicht' : 'Prellungen am Körper');
      const bl = w.kind === 'shot' && !w.bandaged && w.b ? (w.art && !w.field ? ', die Schlagader ist getroffen, das Blut pumpt heraus' : w.b * this.bleedFactor(w) > 0.0007 ? ', blutet stark' : ', blutet') : '';
      out.push(how + bl + (w.bandaged ? ', vom Doc verbunden' : w.field ? ', notdürftig verbunden' + (w.art && ZONES[w.zone].limb ? ' und abgebunden' : '') : '') + (w.heal > 0.6 ? ', fast verheilt' : w.heal > 0.25 ? ', heilt' : ', frisch') + (w.sep > 0.4 ? ', Fieber, die Wunde entzündet sich' : ''));
    }
    if (this.wounds.some((w) => w.gut && !w.bandaged && w.heal < 0.5)) out.push('höllische Schmerzen im Bauch, du krümmst dich');
    if (this.out) out.push('bewusstlos');
    else if (this.blood < BLOOD_FAINT) out.push('so viel Blut verloren, dass du dich nicht mehr auf den Beinen halten kannst');
    else if (this.blood < BLOOD_WEAK) out.push('viel Blut verloren, schwach und schwindlig');
    else if (this.blood < 0.82) out.push('etwas Blut verloren, blass');
    if (this.limp > 0.15) out.push('humpelt');
    if (this.armUse[0] < 0.6 || this.armUse[1] < 0.6) out.push('kann einen Arm kaum bewegen');
    return out.join('; ');
  }
  // kept between sessions
  save() { return { blood: +this.blood.toFixed(3), dead: this.dead, cause: this.cause, deadAt: this.deadAt, hatOff: this.hatOff, wounds: this.wounds.map((w) => ({ zone: w.zone, side: w.side, kind: w.kind, sev: w.sev, at: w.at, heal: +w.heal.toFixed(3), bandaged: w.bandaged, part: w.part, lp: w.lp, n: w.n, b: w.b ? +w.b.toFixed(5) : 0, art: !!w.art, field: !!w.field, gut: !!w.gut, sep: w.sep ? +w.sep.toFixed(3) : 0, lost: w.lost ? +w.lost.toFixed(3) : 0 })) }; }
  load(d) {
    if (!d) return;
    this.blood = clamp(+d.blood || 1, BLOOD_FAINT + 0.05, 1);
    this.wounds = Array.isArray(d.wounds) ? d.wounds.filter((w) => w && ZONES[w.zone]).map((w) => Object.assign({}, w, { heal: clamp(+w.heal || 0, 0, 0.999), b: clamp(+w.b || 0, 0, 0.05) })) : [];
    this.recalcBleed();
    this.recalc();
    if (d.dead) { this.deadAt = d.deadAt; this.dead = false; this.die(d.cause || 'tot'); this.anim.i = this.anim.seq.length - 1; this.anim.t = 1; this.anim.done = false; }
  }
}

/* ---- the shared part: finding the zone a ray hits, blood, sounds ---- */
const HARM = {
  THIN: /^(uArm|fArm|hand|thigh|shin|foot|hat)/, SLACK: 0.06,
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
      // the exact boxes first; if the bullet missed the whole body only just, the thin parts (arms, hands, legs,
      // feet, the hat) count a few centimetres wider, so a shot at an arm is not lost by a hair
      const before = best;
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 1 && best !== before) break;
        for (const name in N.ch.p) {
          if (pass === 1 && !this.THIN.test(name)) continue;
          const part = N.ch.p[name];
          if (part.visible === false) continue;
          const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
          const B = g.boundingBox, m = pass === 1 ? this.SLACK : 0;
          this._inv.copy(part.matrixWorld).invert();
          const lo = this._o.copy(o).applyMatrix4(this._inv), ld = this._d.copy(d).transformDirection(this._inv);
          let t0 = near, t1 = best ? best.t + (pass === 0 ? 0.1 : 0) : far, ok = true;
          for (const ax of ['x', 'y', 'z']) {
            const inv = 1 / (ld[ax] || 1e-9), sl = ax === 'y' ? m * 0.5 : m;
            let ta = (B.min[ax] - sl - lo[ax]) * inv, tb = (B.max[ax] + sl - lo[ax]) * inv;
            if (ta > tb) { const s = ta; ta = tb; tb = s; }
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
            if (t0 > t1) { ok = false; break; }
          }
          if (!ok) continue;
          // the exact pass: the bullet against the part's own triangles (the boxes overlap: the pelvis box takes in
          // the tops of the thighs, the chest box the upper arms), so it hits what you see where you aimed
          if (pass === 0) { const te = this.triHit(g, lo, ld, near, t1); if (te === null) continue; t0 = te; }
          const local = new THREE.Vector3(lo.x + ld.x * t0, lo.y + ld.y * t0, lo.z + ld.z * t0);
          // the point onto the part itself (for the zone, the wound and the stain)
          local.x = clamp(local.x, B.min.x, B.max.x); local.y = clamp(local.y, B.min.y, B.max.y); local.z = clamp(local.z, B.min.z, B.max.z);
          const h = { t: t0, npc: N, part: name, local, point: new THREE.Vector3(o.x + d.x * t0, o.y + d.y * t0, o.z + d.z * t0), near: pass === 1 };
          /* what hangs over a limb (an apron or a coat over the thigh, a vest over the upper arm) does not stop the
             bullet: a limb right behind such a layer (≤ 8 cm) is what it hits */
          const cover = (x) => x.part === 'pelvis' || x.part === 'torso', limb = (x) => this.THIN.test(x.part) && x.part !== 'hat';
          if (!best || (t0 < best.t && !(cover(h) && limb(best) && best.t - t0 < 0.08)) || (limb(h) && cover(best) && t0 - best.t < 0.08)) best = h;
        }
      }
    }
    // (what he holds counts only when it is in front of what the bullet would hit on him: a shotgun at his cheek does not catch a shot at his head)
    if (bestItem && (!best || bestItem.t < best.t - 0.005)) return bestItem;
    // through the hat into the head: the head counts (the hat goes as well)
    if (best && best.part === 'hat') {
      const N = best.npc, part = N.ch.p.head; this._inv.copy(part.matrixWorld).invert();
      const lo = this._o.copy(o).applyMatrix4(this._inv), ld = this._d.copy(d).transformDirection(this._inv);
      const te = this.triHit(part.geometry, lo, ld, best.t, best.t + 0.4);
      if (te !== null) best = { t: te, npc: N, part: 'head', local: new THREE.Vector3(lo.x + ld.x * te, lo.y + ld.y * te, lo.z + ld.z * te), point: new THREE.Vector3(o.x + d.x * te, o.y + d.y * te, o.z + d.z * te), hatToo: true };
    }
    if (best && best.part) Object.assign(best, this.zoneOf(best.part, best.local));
    return best;
  },
  // the nearest triangle of a geometry a ray (local frame) goes through between t0 and t1, or null
  triHit(g, o, d, t0, t1) {
    const P = g.attributes.position.array, I = g.index ? g.index.array : null, n = I ? I.length : P.length / 3;
    const ray = this._ray || (this._ray = new THREE.Ray()), A = this._ta || (this._ta = new THREE.Vector3()), Bv = this._tb || (this._tb = new THREE.Vector3()), C = this._tc || (this._tc = new THREE.Vector3()), X = this._tx || (this._tx = new THREE.Vector3());
    ray.origin.copy(o); ray.direction.copy(d).normalize();
    const sc = d.length() || 1;   // (local and world lengths: the part frames are not scaled, but be safe)
    let best = null;
    for (let k = 0; k < n; k += 3) {
      const a = I ? I[k] : k, b = I ? I[k + 1] : k + 1, c = I ? I[k + 2] : k + 2;
      A.fromArray(P, a * 3); Bv.fromArray(P, b * 3); C.fromArray(P, c * 3);
      if (!ray.intersectTriangle(A, Bv, C, false, X)) continue;
      const t = X.distanceTo(ray.origin) / sc;
      if (t >= t0 && t <= t1 && (best === null || t < best)) best = t;
    }
    return best;
  },
  // the zone of a point on a part (part frame: +x his left, +y up, +z ahead)
  zoneOf(part, p) {
    const side = /L$/.test(part) ? 'L' : /R$/.test(part) ? 'R' : '';
    if (part === 'head') return { zone: p.y > -0.06 ? 'head' : 'neck', side: '' };   // (the jaw and the chin are the head; the neck is the bit below)
    if (part === 'hat') return { zone: 'hat', side: '' };
    if (part === 'torso') {
      if (p.y > 0.3 && Math.abs(p.x) > 0.1) return { zone: 'shoulder', side: p.x > 0 ? 'L' : 'R' };
      return { zone: p.y > 0.17 ? 'chest' : 'belly', side: '' };
    }
    if (part === 'pelvis' || part === 'gun') return p.y > 0.02 ? { zone: 'belly', side: '' } : { zone: 'hip', side: p.x > 0 ? 'L' : 'R' };
    if (/^uArm/.test(part)) return { zone: 'arm', side };
    if (/^fArm/.test(part)) return { zone: p.y < -0.25 ? 'hand' : 'arm', side };
    if (/^hand/.test(part)) return { zone: 'hand', side };
    if (/^thigh/.test(part)) return { zone: 'thigh', side };
    if (/^shin/.test(part)) return { zone: 'calf', side };
    if (/^foot/.test(part)) return { zone: 'foot', side };
    return { zone: 'chest', side: '' };
  },
  /* a bullet in a person: the body reacts, the behaviour is told */
  shot(hit, dir) {
    const N = hit.npc;
    if (hit.item) { this.itemShot(N, hit.item, dir, hit.point); return; }
    const w = N.hp.shot({ zone: hit.zone, side: hit.side, part: hit.part, local: hit.local, dir, point: hit.point, hatToo: hit.hatToo });
    if (hit.zone !== 'hat') {
      this.fleshSound(hit.point, hit.zone === 'head');
      // the bullet comes out the other side and marks the wall behind (not every time)
      if (hit.zone !== 'hand' && hit.zone !== 'foot' && Math.random() < 0.85) this.exitSplash(hit.point, dir, N);
      // dropping what was in the hand of a hit arm
      const Z = ZONES[hit.zone];
      if (Z.drop || Z.lethal || Z.dying || Z.down) this.dropHand(N, hit.side === 'L' ? 0 : hit.side === 'R' ? 1 : -1, dir);
    } else GSFX.impact(hit.point, 'cloth');
    worldEvent('npcShot', hit.point.x, hit.point.y, hit.point.z, { by: 'player', npc: N.id, zone: hit.zone, side: hit.side, dead: N.hp.dead, room: N.room ? N.room.type : null });
    if (!N.hp.dead && hit.zone !== 'hat') setTimeout(() => { if (!N.hp.dead && !N.hp.out) FOLEY.pain(N.pos, N.voiceProfile && N.voiceProfile.pitch, 1.1); }, 60 + Math.random() * 90);
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
    // on the floor ahead of him (flung the way the bullet went)
    const gy = groundAt(p.x + dir.x * 0.4, p.z + dir.z * 0.4, p.y);
    BLOOD.splat(N && N.room ? N.room : null, this._p.set(p.x + dir.x * (0.35 + Math.random() * 0.3), gy + 0.002, p.z + dir.z * (0.35 + Math.random() * 0.3)), this._q.set(0, 1, 0), dir, 0.5 * k);
  },
  // a cough from shot lungs: a grunt and a fine spray from the mouth
  cough(N) {
    if (!N.ch.root.visible) return;
    const h = N.ch.p.head; h.updateMatrixWorld();
    const p = this._p.set(0, 0.04, 0.12).applyMatrix4(h.matrixWorld), f = this._q.set(Math.sin(N.yaw), 0, Math.cos(N.yaw));
    FOLEY.grunt(p, 1.2, 0.7);
    for (let i = 0; i < 6; i++) FX.debris.spawn({ x: p.x, y: p.y, z: p.z, vx: f.x * (0.8 + Math.random()) + (Math.random() - 0.5) * 0.5, vy: Math.random() * 0.6, vz: f.z * (0.8 + Math.random()) + (Math.random() - 0.5) * 0.5, life: 0.5, size: 0.005 + Math.random() * 0.006, grav: 9.8, drag: 1, bounce: false }, [0.5, 0.04, 0.03]);
    if (Math.random() < 0.6) BLOOD.drop(N.room || null, p.x + f.x * 0.35, groundAt(p.x, p.z, N.pos.y + 0.3), p.z + f.z * 0.35, f, 0.008, 1, 0);
    N.hp.flinchBy(this._q.set(-f.x, 0, -f.z), 0.35, 'chest', '', true);
  },
  // the bullet out of the back: a splash on what is behind (wall or floor), if close
  exitSplash(p, dir, N) {
    const o = this._p.copy(p).addScaledVector(dir, 0.35);
    const ray = GUN.ray; ray.set(o, dir); ray.near = 0; ray.far = 2.5;
    const objs = W.worldMeshes.slice(); if (N.room && N.room.mesh) objs.push(N.room.mesh);
    const hits = ray.intersectObjects(objs, false);
    if (!hits.length) return;
    const h = hits[0], n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.dot(dir) > 0) n.negate();
    // the farther the wall, the more it spreads (and the less arrives)
    BLOOD.splat(ROOMS.find((r) => r.mesh === h.object) || (N.room && h.object === N.room.mesh ? N.room : null), h.point, n, dir, (N.hp.dead && N.hp.cause === 'Kopfschuss' ? 2 : 1.2) * (1.2 - h.distance * 0.25));
  },
  // (drops and pools: gfx/blood.js, from Vitals.bleedStep)
  fleshSound(p, head) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.8, p);
      /* the bullet going in: the wet crack of the recording (the head: a harder one), a deep thud under it that you
         feel, and a short bright tick of the cloth tearing; each a little different */
      const rec = GSFX.play(head ? 'fleshH' : 'flesh' + (1 + Math.floor(Math.random() * 3)), g, t, (head ? 1.05 : 0.9) + Math.random() * 0.12, head ? 0.95 : 0.8);
      SFX.thump(t, g, head ? 150 : 110, 50, rec ? 0.35 : 0.6, 0.07);
      if (rec) { SFX.noiseHit(t + 0.002, g, { type: 'bandpass', freq: 3200, q: 1.5, gain: 0.06, attack: 0.0006, decay: 0.012 }); return; }
      SFX.noiseHit(t, g, { type: 'lowpass', freq: 900, q: 0.8, gain: 0.45, attack: 0.001, decay: 0.05 });
      SFX.noiseHit(t + 0.004, g, { type: 'bandpass', freq: 2400, q: 2, gain: 0.12, attack: 0.001, decay: 0.03 });
    });
  },
  // a body lands (k: how hard) or slams into something (step.slam): sound, dust, the view shakes when close,
  // glasses on the bar it hit jump and break
  thud(N, k, step, contact) {
    const close = Math.hypot(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z) < 6 && (N.room || null) === (G.room || null);
    if (step && step.slam && contact) {
      const p = this._tp.set(contact.x, contact.top - 0.25, contact.z);
      FOLEY.slam(p, step.slam);
      if (close) PLAY.camShake = Math.max(PLAY.camShake, 0.06 * step.slam);
      for (let i = 0; i < 5; i++) FX.smoke.spawn({ x: p.x, y: p.y - Math.random() * 0.5, z: p.z, vx: -contact.wx * 0.6 + (Math.random() - 0.5) * 0.8, vy: 0.3, vz: -contact.wz * 0.6 + (Math.random() - 0.5) * 0.8, life: 0.7, size: 0.06, grow: 4, drag: 3, a0: 0.25 }, [0.62, 0.55, 0.47]);
      const L = N.room && BREAK.byRoom.get(N.room);
      if (L) for (const g of L) if (g.alive && Math.hypot(g.x - contact.x, g.z - contact.z) < 0.75 && g.y0 > contact.top - 0.3 && g.y0 < contact.top + 0.5 && Math.random() < 0.7) BREAK.shatter(g, this._td.set(contact.wx, 0.6, contact.wz));
      worldEvent('npcSlam', p.x, p.y, p.z, { by: 'world', npc: N.id });
    }
    if (!k) return;
    FOLEY.bodyFall(N.pos, k, !!N.room);
    if (k >= 0.7) { DUST.burst && DUST.burst(N.pos, N.yaw, 6); if (close) PLAY.camShake = Math.max(PLAY.camShake, 0.035 * k); }
  },
  _tp: new THREE.Vector3(), _td: new THREE.Vector3(),
  // is a point taken by a wall or furniture of at least knee height? returns its height (0: free)
  blockedAt(x, z, y, r) {
    for (const c of COLL) {
      if (c.y0 !== undefined && y + 1 < c.y0) continue;
      if (c.top !== undefined && y > c.top) continue;
      if (c.r !== undefined) { const h = c.h || 0.8; if (h < 0.45) continue; const dx = x - c.cx, dz = z - c.cz, rr = c.r + r; if (dx * dx + dz * dz < rr * rr) return h; continue; }
      if ((c.h || 3) < 0.45) continue;
      const dx = x - c.cx, dz = z - c.cz;
      if (Math.abs(dx) > c.hx + c.hz + r + 0.5 || Math.abs(dz) > c.hx + c.hz + r + 0.5) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a), lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return c.h || 3;
    }
    return 0;
  },
  // the hat flies off and lies on the ground (a loose piece, until picked up again — later)
  // (blow: knocked off by a fist; he gets it back once you have left the room or after a while)
  knockHat(N, dir, blow) {
    const hat = N.ch.p.hat; if (!hat || !hat.visible) return;
    hat.visible = false;
    const m = new THREE.Mesh(hat.geometry, hat.material); m.matrixAutoUpdate = true; m.frustumCulled = false;
    hat.updateMatrixWorld(); m.matrix.copy(hat.matrixWorld); m.matrix.decompose(m.position, m.quaternion, m.scale);
    G.scene.add(m);
    this.loose.push({ m, vx: dir.x * 3, vy: 2.2, vz: dir.z * 3, spin: (Math.random() - 0.5) * 14, t: 0, rest: false, R: N.room, npc: blow ? N : null });
  },
  // the hat comes back on (a blow's hat, or everything when he is put back on his feet)
  hatBack(N) {
    const hat = N.ch.p.hat; if (hat) hat.visible = true;
    this.loose = this.loose.filter((L) => { if (L.npc !== N) return true; G.scene.remove(L.m); return false; });
  },
  // what flies off a face that is hit: sweat and spit, and a puff of dust off the clothes on the body
  blowFx(N, p, dir, head, k, ground) {
    const n = Math.round((head ? 9 : 5) * Math.min(2, k));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 0.4 + Math.random() * 1.2;
      FX.debris.spawn({ x: p.x, y: p.y, z: p.z, vx: dir.x * (1.8 + Math.random() * 2.2) + Math.cos(a) * v * 0.6, vy: 0.5 + Math.random() * 1.5, vz: dir.z * (1.8 + Math.random() * 2.2) + Math.sin(a) * v * 0.6,
        life: 0.35 + Math.random() * 0.35, size: 0.007 + Math.random() * 0.01, grav: 9.8, drag: 1, bounce: false }, head ? [0.86, 0.88, 0.86] : [0.7, 0.62, 0.52]);
    }
    const dn = ground ? 6 : head ? 2 : 4;
    for (let i = 0; i < dn; i++) FX.smoke.spawn({ x: p.x, y: ground ? N.pos.y + 0.1 : p.y, z: p.z, vx: dir.x * 0.9 + (Math.random() - 0.5) * 0.9, vy: ground ? 0.25 : 0.1, vz: dir.z * 0.9 + (Math.random() - 0.5) * 0.9, life: 0.5, size: 0.05, grow: 4, drag: 4, a0: ground ? 0.35 : 0.2 }, N.room ? [0.62, 0.55, 0.47] : [0.78, 0.66, 0.5]);
  },
  loose: [],
  update(dt) {
    BLOOD.update(dt);
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const L = this.loose[i];
      if (L.npc && L.rest && (L.t > 120 || (G.room || null) !== (L.R || null)) && !L.npc.hp.dead) { this.hatBack(L.npc); i = Math.min(i, this.loose.length); continue; }
      if (L.rest) { L.t += dt; continue; }
      L.t += dt; L.vy -= 9.8 * dt;
      L.m.position.x += L.vx * dt; L.m.position.y += L.vy * dt; L.m.position.z += L.vz * dt;
      L.m.rotation.x += L.spin * dt; L.m.rotation.z += L.spin * 0.6 * dt;
      const gy = groundAt(L.m.position.x, L.m.position.z, L.m.position.y + 0.3) + 0.03;
      if (L.m.position.y < gy) { L.m.position.y = gy; if (Math.abs(L.vy) < 1.2) { L.rest = true; L.m.rotation.set(0, L.m.rotation.y, 0); } L.vy = -L.vy * 0.3; L.vx *= 0.5; L.vz *= 0.5; }
    }
  },
  init() {
    // everyone heals while time passes (a jump in time: npc/sim.js)
    let acc = 0;
    TIME.onTick((dt) => { acc += dt * TIME.RATE; if (acc >= 5) { for (const N of NPCS.list) if (N.hp) N.hp.heal(acc); acc = 0; } });
  }
};
// blood marks on surfaces (the bullet hole pool of combat/fx.js draws them)
Object.assign(HOLE, {
  blood: { core: 0x4a0b08, ring: 0x5e0f0b, mix: 0.9, r1: 0.035, r2: 0.08, stretch: 1.5 },
  drop:  { core: 0x3e0907, ring: null, ringDark: 0.5, r1: 0.025, r2: 0, stretch: 1 },
  pool:  { core: 0x380806, ring: 0x4e0d0a, mix: 0.92, r1: 0.22, r2: 0.36, stretch: 1.35 }
});
