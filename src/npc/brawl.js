/* ---------- people fight back: a brawler for any NPC ----------
   N.fight = new Brawler(N, { courage, power, skill }) and the behaviour calls start()/update() while a fight is on.
   He squares up with his guard high, keeps punching distance, circles a little and throws jabs, crosses and hooks.
   Each punch is telegraphed (the wind-up is slow enough to step back from) and only lands if you are still in
   reach when the fist arrives; then the player's body (PHP) takes it. Hit hard he is stunned for a moment (his
   punch is cut off), down he waits; when you are down he does not kick, he waits for you to get up — or the fight
   is over. With his guard up a light blow from the front can be caught on the arms (blocking()).
   Punch paths are the player's (combat/fist.js PUNCH), driven through the NPC's hand IK (npc.reach). */
const NPC_PUNCH = {
  jab:   { side: -1, wind: 0.24, strike: 0.09, hold: 0.06, back: 0.22, from: [-0.18, 1.48, 0.3], to: [0.02, 1.5, 0.98], tw: [-0.2, 0.45], lean: [0.02, 0.15], power: 0.75 },
  cross: { side: 1, wind: 0.3, strike: 0.1, hold: 0.06, back: 0.26, from: [-0.22, 1.5, 0.15], to: [0.0, 1.5, 1.02], tw: [-0.3, 0.6], lean: [0.0, 0.18], power: 1 },
  hook:  { side: 1, wind: 0.34, strike: 0.11, hold: 0.07, back: 0.3, from: [-0.62, 1.5, -0.1], via: [-0.8, 1.54, 0.55], to: [0.02, 1.48, 0.72], tw: [-0.7, 1.0], lean: [0.0, 0.16], power: 1.3 },
  body:  { side: -1, wind: 0.28, strike: 0.1, hold: 0.07, back: 0.26, from: [-0.3, 1.2, 0.2], to: [0.05, 1.1, 0.9], tw: [-0.3, 0.55], lean: [0.1, 0.35], power: 0.9, low: true }
};
class Brawler {
  constructor(npc, o) {
    this.npc = npc; Object.assign(this, { courage: 0.6, power: 1, skill: 0.5, reach: 1.02, toughness: 1 }, o || {});
    this.slipT = 0;
    this.on = false; this.st = 'guard'; this.t = 0; this.cool = 1; this.clip = null; this.circle = 0; this.since = 0; this.gw = 0;
    this._v = new THREE.Vector3(); this._f = new THREE.Vector3(); this._a = new THREE.Vector3();
  }
  start() { if (this.on) return; this.on = true; this.st = 'guard'; this.cool = 0.5 + Math.random() * 0.5; this.since = 0; this.lastHitBy = G.time; this.circleDir = Math.random() < 0.5 ? 1 : -1; this.hits = 0; this.landed = 0; }
  stop() { this.on = false; this.clip = null; this.st = 'guard'; const N = this.npc; N.tw = 0; N.leanF = 0; N.lunge = 0; N.hurry = 1; N.free(0); N.free(1); }
  // he has just slipped a punch (it goes past him)
  dodging() { return this.on && this.slipT > 0; }
  // a step out of the way: back out of reach (from a big wind-up), or back and to the side
  slip(face, back) {
    const N = this.npc, side = Math.random() < 0.5 ? 1 : -1, fx = Math.sin(face), fz = Math.cos(face);
    this.slipT = 0.38; this.slipSide = side;
    const b = back ? 3.2 : 1.6, sd = back ? 0.4 : 2.0;
    N.vx += -fx * b + fz * side * sd; N.vz += -fz * b - fx * side * sd;
    FSFX.cloth();
  }
  // his guard is up and he faces the way the blow comes from
  blocking(yawOfBlow) { if (!this.on || this.st !== 'guard' || this.npc.hp.stunT > 0) return false; const N = this.npc; return Math.abs(wrapA(N.yaw - (yawOfBlow + Math.PI))) < 0.7; }
  // hit: a punch on its way is cut off; often he answers at once (a counter), sometimes he needs a moment
  gotHit(blocked) {
    this.lastHitBy = G.time;
    if (blocked) { this.cool = Math.min(this.cool, 0.25); return; }   // caught it on the arms: straight back at you
    if (this.clip && this.st !== 'back') { this.st = 'back'; this.t = 0; }
    this.cool = Math.random() < 0.45 + this.skill * 0.3 ? Math.min(this.cool, 0.3) : Math.max(this.cool, 0.55);
  }
  // returns 'won' when the player is out, 'gave up', 'calm' when it is over, else null
  update(dt) {
    const N = this.npc, H = N.hp;
    if (!this.on) return null;
    this.since += dt;
    N.hurry = 1;
    // breathing room after a hit; nothing while on the ground
    if (H.busy()) { this.clip = null; this.st = 'guard'; N.tw = 0; N.leanF = 0; N.lunge = 0; return null; }
    const P = PLAY.pos, dx = P.x - N.pos.x, dz = P.z - N.pos.z, d = Math.hypot(dx, dz), face = Math.atan2(dx, dz);
    N.faceYaw = face; N.lookAt(this._v.set(P.x, P.y + 1.5 - (FALL.down || 0) * 0.9, P.z), 1);
    if (PHP.out) { this.stop(); return 'won'; }
    // hurt badly or scared: he has had enough
    if (H.blood < BLOOD_WEAK || (H.daze > 0.85 && Math.random() < dt * 0.6 * (1 - this.courage))) { this.stop(); return 'gave up'; }
    // the player walked away and stopped fighting
    if ((d > 7 && G.time - this.lastHitBy > 4) || (d > 3 && G.time - this.lastHitBy > 12) || G.room !== N.room) { this.stop(); return 'calm'; }
    // the player is down: wait over him
    if (FALL.busy()) { N.stop(); this.clip = null; this.guard(dt, 0.6); return null; }
    this.cool -= dt * (H.stunT > 0 ? 0.4 : 1);
    this.slipT = Math.max(0, this.slipT - dt);
    // he reads your fists: a big wind-up he steps away from (or punches into), a punch he sometimes slips
    if (!this.clip && H.stunT <= 0 && d < this.reach + 0.9) {
      if (FIST.st === 'charge' && !this.sawCharge) {
        this.sawCharge = true; const r = Math.random();
        if (r < 0.3 + this.skill * 0.3) this.slip(face, true);
        else if (r < 0.55 + this.skill * 0.25 && d < this.reach + 0.3) this.throwPunch('jab', 0.12);
      }
      if (FIST.st !== 'charge') this.sawCharge = false;
      if (FIST.lastPunch !== this.seenPunch && (FIST.st === 'windup' || FIST.st === 'strike')) { this.seenPunch = FIST.lastPunch; if (Math.random() < this.skill * 0.3) this.slip(face, false); }
    }
    if (this.slipT > 0) { N.leanF += (-0.14 - N.leanF) * (1 - Math.exp(-dt * 14)); N.tw += (this.slipSide * 0.35 - N.tw) * (1 - Math.exp(-dt * 14)); this.guard(dt, 1); return null; }
    if (!this.clip) {
      // keep punching distance, circle a little
      const want = 0.9;
      if (d > want + 0.25 || d < want - 0.3) {
        const k = (d - want) / Math.max(d, 0.01);
        N.hurry = d > 2.5 ? 1.9 : 1.25;
        // not in the same part of the room (behind the bar, say): round by the way
        this.areaT = (this.areaT || 0) - 1;
        if (this.areaT <= 0) { this.areaT = 15; this.apart = NAV.area(N.pos.x, N.pos.z, N.pos.y).key !== NAV.area(P.x, P.z, P.y).key; }
        // (in another part of the room he walks towards you yourself: a point short of you might lie behind the bar)
        // (on the way round, only the end point follows you: re-routing from halfway would send him back to the start of the route)
        if (this.apart) { if (N.walking() && N.legPass) N.dest = [P.x, P.z, face]; else if (!N.walking() || (this.walkT = (this.walkT || 0) + 1) % 45 === 0) N.walkTo(P.x, P.z, face); }
        else if (d > 2.5) { if (!N.walking() || (this.walkT = (this.walkT || 0) + 1) % 30 === 0) N.walkTo(N.pos.x + dx * k, N.pos.z + dz * k, face); }
        else N.goTo(N.pos.x + dx * k, N.pos.z + dz * k, face);
      } else {
        this.circle += dt; if (this.circle > 2 + Math.random()) { this.circle = 0; this.circleDir = -this.circleDir; }
        const s = this.circleDir * 0.25; N.goTo(N.pos.x - dz / d * s, N.pos.z + dx / d * s, face);
      }
      this.guard(dt, 1);
      if (this.cool <= 0 && d < this.reach + 0.35 && H.stunT <= 0) this.throwPunch();
    } else this.punch(dt, d, face);
    return null;
  }
  guard(dt, w) {
    const N = this.npc;
    N.tw += (0 - N.tw) * (1 - Math.exp(-dt * 8)); N.leanF += (0.08 - N.leanF) * (1 - Math.exp(-dt * 8)); N.lunge *= Math.exp(-dt * 8);
    const bob = Math.sin(G.time * 3.1) * 0.015;
    N.reach(0, 0.19, 1.52 + bob, 0.33, w); N.reach(1, -0.19, 1.5 + bob, 0.36, w);
    // knees a little bent, weight on the balls of the feet
    N.crouchT = Math.max(N.crouchT, 0.12);
  }
  throwPunch(force, wind) {
    const r = Math.random(), names = this.npc.hp.armUse[1] < 0.5 ? ['jab', 'body'] : this.npc.hp.armUse[0] < 0.5 ? ['cross', 'hook'] : ['jab', 'jab', 'cross', 'hook', 'body'];
    let name = force || this.nextName || names[Math.floor(r * names.length)];
    if ((name === 'cross' || name === 'hook') && this.npc.hp.armUse[1] < 0.5) name = 'jab';
    this.nextName = null;
    this.clip = NPC_PUNCH[name]; this.clipName = name; this.st = 'wind'; this.t = 0; this.done = false;
    this.windK = wind ? wind / this.clip.wind : 1;
    this.npc.stop();
  }
  punch(dt, d, face) {
    const N = this.npc, C = this.clip, i = C.side === 1 ? 1 : 0, m = C.side === 1 ? 1 : -1, o = 1 - i;
    this.t += dt;
    const V = (a) => this._a.set(a[0] * m, a[1], a[2]);
    let e;
    if (this.st === 'wind') {
      const W = C.wind * (this.windK || 1);
      e = smoothstep(0, 1, this.t / W);
      const f = V(C.from); N.reach(i, f.x, f.y, f.z);
      N.tw = lerp(0, C.tw[0] * m, e); N.leanF = lerp(0.08, C.lean[0], e);
      if (this.t >= W) { this.st = 'strike'; this.t = 0; N.vx += Math.sin(face) * 1.2; N.vz += Math.cos(face) * 1.2; FSFX.whoosh(this.clipName === 'hook'); if (Math.random() < 0.55) FOLEY.grunt(N.pos, 0.82, this.clipName === 'hook' ? 1.1 : 0.8); }
    } else if (this.st === 'strike') {
      e = 1 - Math.pow(1 - Math.min(1, this.t / C.strike), 3);
      const a = V(C.from).clone(), b = V(C.to).clone();
      let p;
      if (C.via) { const v = V(C.via), u = 1 - e; p = new THREE.Vector3(u * u * a.x + 2 * u * e * v.x + e * e * b.x, u * u * a.y + 2 * u * e * v.y + e * e * b.y, u * u * a.z + 2 * u * e * v.z + e * e * b.z); }
      else p = a.lerp(b, e);
      N.reach(i, p.x, p.y, p.z);
      N.tw = lerp(C.tw[0] * m, C.tw[1] * m, e); N.leanF = lerp(C.lean[0], C.lean[1], e); N.lunge = 0.12 * e;
      if (this.t >= C.strike * 0.85 && !this.done) { this.done = true; this.connect(d, face); }
      if (this.t >= C.strike) { this.st = 'hold'; this.t = 0; }
    } else if (this.st === 'hold') {
      const b = V(C.to); N.reach(i, b.x, b.y, b.z - (this.landedNow ? 0.1 : 0));
      if (this.t >= C.hold) { this.st = 'back'; this.t = 0; }
    } else {
      e = smoothstep(0, 1, this.t / C.back);
      N.tw = lerp(C.tw[1] * m, 0, e); N.leanF = lerp(C.lean[1], 0.08, e); N.lunge = 0.12 * (1 - e);
      N.reach(i, i ? -0.19 : 0.19, 1.5, 0.36);
      if (this.t >= C.back) {
        this.clip = null; this.st = 'guard';
        // a jab is often followed straight away by the other hand
        if (this.clipName === 'jab' && Math.random() < 0.35 + this.skill * 0.3) { this.nextName = Math.random() < 0.7 ? 'cross' : 'hook'; this.cool = 0.05; }
        else this.cool = (0.45 + Math.random() * 0.8) * (1.25 - this.skill * 0.5);
      }
    }
    // the other hand keeps its guard
    N.reach(o, o === 0 ? 0.19 : -0.19, 1.52, 0.33);
  }
  // the fist arrives: is the player still there?
  connect(d, face) {
    const N = this.npc, C = this.clip;
    this.landedNow = false;
    if (FALL.busy() || PHP.out) return;
    const fx = Math.sin(face), fz = Math.cos(face);
    const a = Math.abs(wrapA(Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z) - N.yaw));
    if (d > this.reach + 0.38 || a > 0.75) { worldEvent('npcMiss', N.pos.x, N.pos.y, N.pos.z, { by: N.id }); return; }
    const heavy = this.clipName === 'hook', head = !C.low;
    const p = new THREE.Vector3(PLAY.pos.x - fx * 0.25, PLAY.pos.y + (head ? 1.55 : 1.15), PLAY.pos.z - fz * 0.25);
    // your guard: caught on the arms if you face him (a hook still gets a little through); no stamina, no guard
    const facing = Math.abs(wrapA(Math.atan2(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z) - PLAY.yaw)) < 1.1;
    if (FIST.blocking && facing) {
      const cost = 0.13 * C.power * this.power * (heavy ? 1.5 : 1);
      if (FIST.stamina > cost) {
        FIST.stamina -= cost; FIST.rest = 0.5; FIST.counterT = G.time;
        FSFX.block(p); FX.impactStar(p, 0.16); HUD.cueFlash('block', 'Geblockt', 0.35); G.hitStop = 0.045; PLAY.camShake = Math.max(PLAY.camShake, 0.045);
        PHP.hit({ power: C.power * this.power * (heavy ? 0.3 : 0.1), head: false, chip: true, dir: { x: fx, z: fz }, by: N });
        N.hp.flinchBy(this._f.set(-fx, 0, -fz), 0.3, 'arm', '', true);
        this.cool += 0.15;
        worldEvent('playerBlock', p.x, p.y, p.z, { by: 'player', npc: N.id });
        return;
      }
      FIST.stamina = 0; FIST.blockWant = false; TOAST.show('Deckung durchbrochen!');
    }
    this.landedNow = true; this.landed++;
    FX.impactStar(p, heavy ? 0.4 : 0.24);
    FSFX.flesh(p, C.power * this.power, heavy, head);
    G.hitStop = heavy ? 0.12 : 0.07;
    const res = PHP.hit({ power: C.power * this.power * (N.hp.armUse[C.side === 1 ? 1 : 0] < 0.6 ? 0.5 : 1), head, heavy, dir: { x: fx, z: fz }, by: N });
    worldEvent('npcPunch', p.x, p.y, p.z, { by: N.id, kind: this.clipName, res });
    if (N.onHarm) N.onHarm({ type: 'landed', res, kind: this.clipName });
  }
}
