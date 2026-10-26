/* ---------- drunkenness ----------
   A sip puts alcohol in the stomach; from there it goes into the blood within some seconds and leaves it slowly.
   The level in the blood (0 sober, 0.25 tipsy, 0.5 drunk, 0.75 very drunk, 1 out cold) drives:
   - balance: the head wobbles off first, the upper body follows it, the hips lag behind and the feet have to step
     after them (a chain of springs; the feet move because the body really drifts, so the gait steps by itself)
   - walking: the course wanders, the pace surges and drags, the arms go out for balance; now and then a stumble,
     and when very drunk a stumble can end on the ground (FALL)
   - the view (camera sway and roll, double vision in POST), the aim, the fists, the hiccups
   Close to the top (0.95) the last stretch begins (edge): for half a minute he is as drunk as it gets, the picture
   swims more and more and darkens, then the lights go out: you wake up somewhere else in town, a little poorer. */
const DRUNK = {
  level: 0, stomach: 0, gut: 0, t: 0, hicT: 12, stumbleT: 4, out: null, leave: null, edge: null, bumpT: 0,
  lurch: new THREE.Vector2(),
  // the balance chain, angles in radians: x = to the side (+ = his right), y = forwards
  head: new THREE.Vector2(), headV: new THREE.Vector2(), body: new THREE.Vector2(), bodyV: new THREE.Vector2(),
  goal: new THREE.Vector2(), goalT: 0, drift: new THREE.Vector2(), sway: new THREE.Vector2(),
  drink(alc) {
    if (alc < 0) { this.level = Math.max(0, this.level + alc); return; }   // water helps a little
    this.stomach += alc;
  },
  blocked() { return !!this.out || FALL.busy() || !!this.leave; },
  update(dt) {
    this.t += dt;
    // stomach -> gut -> blood: a few seconds before you feel it, then it rises over about ten seconds;
    // blood -> gone (slowly, faster when it is a lot)
    const s2g = this.stomach * (1 - Math.exp(-dt / 3.5)), g2b = this.gut * (1 - Math.exp(-dt / 5));
    this.stomach -= s2g; this.gut += s2g - g2b; this.level += g2b;
    this.level = Math.max(0, this.level - dt * (0.0012 + this.level * 0.001));
    const L = Math.min(this.level, 1), t = this.t;
    // the camera's slow sway
    this.sway.set(Math.sin(t * 0.83) * 0.7 + Math.sin(t * 2.1 + 1) * 0.3, Math.sin(t * 0.61 + 2) * 0.6 + Math.sin(t * 1.7) * 0.4);
    this.balance(dt, L);
    if (L > 0.2 && !SIT.busy() && !MENU.open && !FALL.busy()) {
      this.hicT -= dt;
      if (this.hicT <= 0) { this.hicT = 4 + Math.random() * 10 / L; this.hiccup(); }
      // without a reason, only when really drunk; edges and steps trip you much earlier (see ground())
      if (PLAY.speed > 0.6 && L > 0.4 && PLAY.inYaw !== null) {
        this.stumbleT -= dt * (L - 0.35) * (PLAY.speed > 3 ? 1.6 : 0.8);
        if (this.stumbleT <= 0) { this.stumbleT = 2 + Math.random() * 3; this.stumble(); }
      }
    }
    // a drunk hand does not hold the revolver still
    if (L > 0.05 && GUN.camW > 0.3) {
      PLAY.camYaw += (Math.cos(t * 0.9) * 0.22 + Math.cos(t * 2.3) * 0.1) * L * dt;
      PLAY.aimPitch += Math.sin(t * 1.3) * L * 0.12 * dt;
    }
    this.bumpT = Math.max(0, this.bumpT - dt);
    // indoors and close to the end: he gets up and staggers out by himself, and goes down outside
    if (!this.out && !this.leave && this.level >= 0.9 && ROOMSTATE.cur && !ROOMSTATE.cur.parent && !FALL.busy()) this.startLeave();
    if (this.leave) this.updateLeave(dt);
    if (!this.out && !this.leave && !this.edge && this.level >= 0.95) this.startEdge();
    if (this.edge) this.updateEdge(dt);
    if (this.out) this.updateBlackout(dt);
  },
  /* the head chases a wandering goal, the body chases the head (later, heavier), the hips chase the body */
  balance(dt, L) {
    if (L < 0.01) { this.head.set(0, 0); this.body.set(0, 0); this.headV.set(0, 0); this.bodyV.set(0, 0); this.drift.set(0, 0); return; }
    this.goalT -= dt;
    if (this.goalT <= 0) {
      this.goalT = 0.5 + Math.random() * (1.6 - L);
      const a = Math.random() * TAU, m = (0.12 + Math.random() * 0.22) * L;
      this.goal.set(Math.cos(a) * m, Math.sin(a) * m * 0.7 + 0.03 * L);
    }
    // a lurch (a stumble, a wild swing) adds to the goal for a moment and dies away smoothly
    this.lurch.multiplyScalar(Math.exp(-dt * 2.2));
    const tgt = this._tg || (this._tg = new THREE.Vector2());
    tgt.copy(this.goal).add(this.lurch);
    const sp = (pos, vel, target, k, c) => {
      vel.x += ((target.x - pos.x) * k - vel.x * c) * dt; vel.y += ((target.y - pos.y) * k - vel.y * c) * dt;
      pos.x += vel.x * dt; pos.y += vel.y * dt;
    };
    sp(this.head, this.headV, tgt, 22, 5.5);             // quick and bouncy
    sp(this.body, this.bodyV, this.head, 7, 2.6);        // follows, overshoots
    // the leaning body pulls the feet after it: the root drifts the way the body leans
    const k = (SIT.busy() || FALL.busy()) ? 0 : L * 1.7;
    const cy = Math.cos(PLAY.yaw), sy = Math.sin(PLAY.yaw);
    // forwards (sin y, cos y), his right (-cos y, sin y)
    this.drift.set((sy * this.body.y - cy * this.body.x) * k, (cy * this.body.y + sy * this.body.x) * k);
  },
  // steering: the way you want to go, turned this way and that
  steer(mx, mz) {
    const L = Math.min(this.level, 1);
    if (L < 0.05) return [mx, mz];
    const a = (this.sway.x * 0.8 + this.body.x * 1.5) * L, c = Math.cos(a), s = Math.sin(a);
    return [mx * c + mz * s, -mx * s + mz * c];
  },
  // the pace surges and drags
  maxSpeed() { const L = Math.min(this.level, 1); return (1 - clamp(L - 0.25, 0, 0.6) * 0.5) * (1 + Math.sin(this.t * 1.9) * 0.22 * L); },
  /* a stumble is a lurch, not a stop: the body pitches the way you were going, the feet hurry after it, the arms
     fly up, and you keep walking. dir: which way it throws you (default: ahead, a little off to one side) */
  stumble(dir, big, fallChance, kind) {
    if (FALL.busy() || SIT.busy()) return;
    const L = Math.min(this.level, 1), moveDir = PLAY.speed > 0.3 ? Math.atan2(PLAY.vx, PLAY.vz) : PLAY.yaw;
    const a = dir !== undefined ? dir : moveDir + (Math.random() - 0.5) * 0.9;
    const f = (0.9 + L * 1.6) * (big ? 1.35 : 1);
    PLAY.vx += Math.sin(a) * f; PLAY.vz += Math.cos(a) * f;
    const rel = wrapA(a - PLAY.yaw);
    this.push(-Math.sin(rel) * 0.22 * f, Math.cos(rel) * 0.3 * f);
    this.flail = 0.6;
    FSFX.cloth(); this.scuff();
    // very drunk: sometimes it ends on the floor, forwards or over to the side the body leans to
    const p = this.leave ? 0 : fallChance !== undefined ? fallChance : (L > 0.6 ? (L - 0.55) * 0.6 : 0);
    if (Math.random() < p) this.fallLater(kind || (Math.random() < 0.55 ? 'side' : 'fwd'), 220);
  },
  fallLater(kind, ms) {
    const sd = this.body.x + this.lurch.x * 0.5 >= 0 ? 1 : -1;
    setTimeout(() => { if (!FALL.busy() && !SIT.busy() && !this.out) FALL.start(false, kind, sd); }, ms);
  },
  // push the balance: lean that way for a moment (x: to his right, y: forwards), smoothly through the springs
  push(x, y) { this.lurch.x = clamp(this.lurch.x + x, -0.5, 0.5); this.lurch.y = clamp(this.lurch.y + y, -0.5, 0.5); },
  // walked into something solid (the push-out from collide): drunk, he bounces off and reels back
  bump(dx, dz) {
    const L = Math.min(this.level, 1), n = Math.hypot(dx, dz);
    if (L < 0.2 || n < 0.004 || this.bumpT > 0 || FALL.busy() || SIT.busy()) return;
    const nx = dx / n, nz = dz / n, vn = PLAY.vx * nx + PLAY.vz * nz;   // vn < 0: moving into it
    if (vn > -0.7) return;
    this.bumpT = 0.8;
    const e = 0.5 + L * 0.6;
    PLAY.vx -= (1 + e) * vn * nx; PLAY.vz -= (1 + e) * vn * nz;
    const rel = wrapA(Math.atan2(nx, nz) - PLAY.yaw);
    this.push(-Math.sin(rel) * 0.35 * L, Math.cos(rel) * 0.4 * L - 0.15 * L);
    this.flail = 0.6;
    PLAY.camShake = Math.max(PLAY.camShake, 0.06);
    GSFX.run(() => { const { g, t } = GSFX.out(0.5, PLAY.pos); SFX.thump(t, g, 120, 60, 0.5, 0.1); SFX.noiseHit(t, g, { type: 'lowpass', freq: 700, q: 0.7, gain: 0.25, attack: 0.002, decay: 0.08 }); });
    FSFX.cloth();
    if (L > 0.7 && Math.random() < (L - 0.65) * 0.8 && !this.leave) this.fallLater('back', 300);
  },
  /* had enough indoors: stand up, stagger out of the door, go down in the street */
  startLeave() {
    const R = ROOMSTATE.cur, F = R.floorY;
    this.leave = { R, t: 0, i: 0, done: 0, way: [rwp(R, 0, F, R.doorZ - 1.2), rwp(R, 0, F, R.doorZ + 2.2), rwp(R, (Math.random() - 0.5) * 3, 0, R.doorZ + 5.5)] };
    DRINK.cancel(); SHOP.open && SHOP.close();
    if (SIT.state === 'sit') SIT.stand(); else if (SIT.busy()) SIT.cancel();
    TOAST.show('Genug für heute. Er will nur noch raus …', 'long');
  },
  autoDir() {
    const Lv = this.leave; if (!Lv || Lv.i >= Lv.way.length) return null;
    const w = Lv.way[Lv.i], dx = w.x - PLAY.pos.x, dz = w.z - PLAY.pos.z, d = Math.hypot(dx, dz);
    return d > 1e-3 ? [dx / d, dz / d] : null;
  },
  updateLeave(dt) {
    const Lv = this.leave;
    Lv.t += dt;
    this.level = Math.min(this.level, 0.97);   // not before he is out
    if (Lv.i < Lv.way.length) {
      const w = Lv.way[Lv.i];
      if (Math.hypot(w.x - PLAY.pos.x, w.z - PLAY.pos.z) < 0.7) Lv.i++;
    } else Lv.done += dt;
    if (Lv.done > 0.6 || Lv.t > 22) { this.leave = null; this.level = Math.max(this.level, 0.95); if (!this.edge) this.startEdge(); }
  },
  /* the last stretch: as drunk as it gets for a while (time to stagger about), the picture swims and darkens,
     then he goes down. More drink makes it shorter, water can pull him back from it. */
  startEdge() { this.edge = { t: 0, dur: 26 + Math.random() * 10 }; },
  edgeK() { return this.edge ? clamp(this.edge.t / this.edge.dur, 0, 1) : 0; },
  updateEdge(dt) {
    const E = this.edge;
    if (this.level < 0.85) { this.edge = null; return; }
    E.t += dt;
    const lv = 0.94 + 0.05 * this.edgeK();
    if (this.level > lv + 0.01) E.dur = Math.max(E.t + 3, E.dur - (this.level - lv) * 60);   // more drink: sooner
    this.level = lv;
    if (E.t >= E.dur && !this.leave && !FALL.busy()) { this.edge = null; this.level = 1; this.blackout(); }
  },
  // the ground under the feet changed height (a porch edge, a step): drunk feet catch on it
  ground(g, dt) {
    const L = Math.min(this.level, 1), dg = g - (this.lastG === undefined ? g : this.lastG);
    this.lastG = g; this.tripCool = Math.max(0, (this.tripCool || 0) - dt);
    if (L < 0.12 || Math.abs(dg) < 0.06 || PLAY.speed < 0.8 || this.tripCool > 0 || FALL.busy() || SIT.busy()) return;
    if (Math.random() < Math.min(0.95, L * 1.8)) {
      this.tripCool = 1.2;
      // the toes catch: he pitches forward (harder stepping up) and may land on his hands
      const moveDir = Math.atan2(PLAY.vx, PLAY.vz);
      this.stumble(moveDir + (Math.random() - 0.5) * 0.3, true, L > 0.35 ? (L - 0.3) * (dg > 0 ? 0.9 : 0.6) : 0, 'fwd');
      this.push(0, 0.25 * L);
    }
  },
  scuff() { GSFX.run(() => { const { g, t } = GSFX.out(0.4, PLAY.pos); SFX.noiseHit(t, g, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.25, attack: 0.01, decay: 0.12 }); SFX.noiseHit(t + 0.13, g, { type: 'bandpass', freq: 700, q: 0.8, gain: 0.18, attack: 0.01, decay: 0.08 }); }); },
  // the body: the chain of springs (called after the gait or the seat has posed it)
  pose(P) {
    const L = Math.min(this.level, 1);
    if (L < 0.01 || FALL.owns()) return;
    const seated = SIT.owns(), k = seated ? 0.6 : 1, H = this.head, B = this.body;
    // upper body follows the body spring; positive x leans to his right (roll about z tips +y towards -x)
    P.spRoll += B.x * 0.9 * k; P.spPitch += B.y * 0.8 * k + 0.04 * L;
    if (!seated) { P.pelRoll += B.x * 0.25; P.pel.x += B.x * 0.08; P.pel.z -= B.y * 0.06; P.pel.y -= Math.abs(B.x) * 0.04; }
    // the head leads: its own lean on top of the body's, heavy and loose
    P.hdRoll = (H.x - B.x) * 1.3 * k;
    P.hdPitch += (H.y - B.y) * 1.1 * k + 0.12 * L;
    P.hdYaw += (H.x - B.x) * 0.25 * k;
    // the arms come out to catch the balance
    if (!seated) for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1, a = P.arm[i], lean = Math.abs(B.x) + Math.abs(B.y) * 0.6;
      a.out += Math.min(0.6, lean * 2.2 + (s * B.x < 0 ? Math.abs(B.x) * 1.5 : 0)) * L;
      a.el += lean * 0.8 * L; a.sw += Math.sin(this.t * 2.3 + i * 2) * 0.15 * L;
    }
    // arms thrown up and forward in a stumble
    if (this.flail > 0 && !seated) {
      const f = Math.sin(Math.PI * (this.flail / 0.6)) * Math.min(1, L * 2);
      for (let i = 0; i < 2; i++) { const a = P.arm[i]; a.sw += f * (0.9 + i * 0.3); a.out += f * 0.5; a.el += f * 0.6; }
      this.flail = Math.max(0, this.flail - 1 / 60);
    }
    if (this.hicPose > 0) { P.hdPitch -= this.hicPose * 0.6; P.spPitch -= this.hicPose * 0.15; this.hicPose = Math.max(0, this.hicPose - 1 / 60); }
  },
  // the view: the horizon tilts, the camera drifts and lags
  camera(cam) {
    const L = Math.min(this.level, 1);
    if (L < 0.02) return;
    const k = L * 1.5;   // keeps growing with every drink
    cam.position.x += (this.sway.y * 0.25 + this.body.x * 0.6) * k; cam.position.y += this.sway.x * 0.12 * k;
    cam.rotateZ((this.sway.x * 0.1 + this.body.x * 0.25) * k);
    const fov = cam.fov * (1 + Math.sin(this.t * 0.7) * 0.04 * k);
    if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  },
  hiccup() {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.4, PLAY.pos);
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.06); o.frequency.exponentialRampToValueAtTime(380, t + 0.13);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.18, t + 0.015); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.18);
      SFX.noiseHit(t, g, { freq: 1400, q: 1.2, gain: 0.12, attack: 0.005, decay: 0.05 });
    });
    PLAY.camShake = Math.max(PLAY.camShake, 0.03);
    this.hicPose = 0.25; this.headV.y -= 1.2;
  },

  /* ---- out cold: fade to black, wake up somewhere ---- */
  blackout() {
    this.out = { t: 0, phase: 'fade', where: null };
    GUN.setAim(false); if (GUN.state !== 'holster') { GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    DRINK.cancel();
    if (!FALL.busy() && !SIT.busy()) { const r = Math.random(); FALL.start(true, r < 0.4 ? 'fwd' : r < 0.8 ? 'side' : 'back', this.body.x >= 0 ? 1 : -1); }
    worldEvent('passout', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player' });
  },
  updateBlackout(dt) {
    const O = this.out, el = document.getElementById('blackout');
    O.t += dt;
    el.hidden = true;   // POST does the darkness and the eyelids
    if (O.phase === 'fade') {
      PLAY.vx *= Math.exp(-dt * 3); PLAY.vz *= Math.exp(-dt * 3);
      if (O.t >= POST.FADE + 0.4) { O.phase = 'dark'; O.t = 0; this.wakeSomewhere(); }
    } else if (O.phase === 'dark') {
      // black for a good while; the place you wake up in is already there behind the eyelids
      if (O.t >= 3.2) { O.phase = 'wake'; O.t = 0; TOAST.show(O.text, 'long'); if (O.lost > 0) setTimeout(() => TOAST.show('Deine Taschen fühlen sich leichter an (−' + price(O.lost) + ').', 'long'), 2600); }
    } else {
      if (O.t >= POST.WAKE) { this.out = null; FALL.keep = false; }   // eyes open: now he gets up
    }
  },
  wakeSomewhere() {
    FALL.cancel();
    if (SIT.busy()) SIT.cancel();
    const R = (type) => ROOMS.find((r) => r.type === type);
    const spots = [
      { text: 'Du wachst in der Zelle des Sheriffs auf. Die Tür steht offen. Zum Glück.', go: () => { const r = R('sheriff'), p = rwp(r, 1.9, r.floorY, -6.9); return { p, yaw: r.ry }; } },
      { text: 'Du wachst im Heu des Mietstalls auf. Es riecht nach Pferd.', go: () => { const r = R('livery'), p = rwp(r, 0.2, r.floorY, -9.2); return { p, yaw: r.ry + Math.PI }; } },
      { text: 'Du wachst auf der Bank vor dem Saloon auf.', seat: () => INTERACT.items.find((s) => s.verb === 'sit' && !s.room && s.x < -18 && s.x > -26) },
      { text: 'Du wachst in einer Kirchenbank auf. Der Herr sieht alles.', seat: () => INTERACT.items.find((s) => s.kind === 'pew' && !s.occ) }
    ];
    const w = spots[Math.floor(Math.random() * spots.length)];
    if (w.seat && w.seat()) SIT.warp(w.seat());
    else { const g = (w.go || spots[0].go)(); PLAY.pos.copy(g.p); PLAY.yaw = g.yaw; PLAY.camYaw = g.yaw + Math.PI; PLAY.vx = PLAY.vz = 0; GAIT.init = false; G.lookAt = null; FALL.startLying(); }
    this.level = 0.3; this.stomach = 0; this.gut = 0;
    const lost = Math.round(INV.money * (0.2 + Math.random() * 0.4));
    INV.money -= lost;
    this.out.text = w.text; this.out.lost = lost;
  }
};
SAVE.part('drunk', () => ({ level: +DRUNK.level.toFixed(3), stomach: +DRUNK.stomach.toFixed(3), gut: +DRUNK.gut.toFixed(3) }), (d) => { DRUNK.level = clamp(+d.level || 0, 0, 0.85); DRUNK.stomach = clamp(+d.stomach || 0, 0, 1); DRUNK.gut = clamp(+d.gut || 0, 0, 1); });
