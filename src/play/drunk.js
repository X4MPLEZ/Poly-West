/* ---------- drunkenness ----------
   A sip puts alcohol in the stomach; from there it goes into the blood over half a minute and leaves it slowly
   (one whiskey takes a couple of minutes). The level in the blood (0 sober, 0.3 tipsy, 0.6 drunk, 1 out cold)
   sways the body, the view and the aim, lets the feet wander and stumble, and brings the hiccups.
   At 1 the lights go out: you wake up somewhere else in town, a little poorer. */
const DRUNK = {
  level: 0, stomach: 0, t: 0, hicT: 12, stumbleT: 4, out: null, sway: new THREE.Vector2(),
  drink(alc) {
    if (alc < 0) { this.level = Math.max(0, this.level + alc); return; }   // water helps a little
    this.stomach += alc;
  },
  update(dt) {
    this.t += dt;
    // stomach -> blood (half of it within ~20 s), blood -> gone (slowly, faster when it is a lot)
    const absorb = this.stomach * (1 - Math.exp(-dt / 28));
    this.stomach -= absorb; this.level += absorb;
    this.level = Math.max(0, this.level - dt * (0.0011 + this.level * 0.0009));
    const L = this.level, t = this.t;
    // a slow wandering sway the body and camera share
    this.sway.set(Math.sin(t * 0.83) * 0.7 + Math.sin(t * 2.1 + 1) * 0.3, Math.sin(t * 0.61 + 2) * 0.6 + Math.sin(t * 1.7) * 0.4);
    if (L > 0.25 && !SIT.busy() && !MENU.open) {
      // hiccups
      this.hicT -= dt;
      if (this.hicT <= 0) { this.hicT = 5 + Math.random() * 14 / L; this.hiccup(); }
      // now and then the legs do not quite do what they should
      if (PLAY.speed > 0.6 && L > 0.4) {
        this.stumbleT -= dt * (L - 0.3);
        if (this.stumbleT <= 0) {
          this.stumbleT = 1.5 + Math.random() * 3;
          const a = PLAY.yaw + (Math.random() < 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.8), f = 1.2 + L * 1.6;
          PLAY.vx += Math.sin(a) * f; PLAY.vz += Math.cos(a) * f;
          FSFX.cloth();
        }
      }
    }
    // a drunk hand does not hold the revolver still
    if (L > 0.05 && GUN.camW > 0.3) {
      PLAY.camYaw += Math.cos(t * 0.9) * L * 0.18 * dt + Math.cos(t * 2.3) * L * 0.08 * dt;
      PLAY.aimPitch += Math.sin(t * 1.3) * L * 0.1 * dt;
    }
    const v = document.getElementById('drunkFx');
    if (v) { const o = clamp((L - 0.15) * 0.9, 0, 0.6); if (Math.abs(o - (this.fxO || 0)) > 0.01) { this.fxO = o; v.style.opacity = o.toFixed(2); } }
    if (L >= 1 && !this.out) this.blackout();
    if (this.out) this.updateBlackout(dt);
  },
  // steering: the way you want to go, turned a little this way and that
  steer(mx, mz) {
    const L = this.level;
    if (L < 0.05) return [mx, mz];
    const a = this.sway.x * L * 0.55, c = Math.cos(a), s = Math.sin(a);
    return [mx * c + mz * s, -mx * s + mz * c];
  },
  maxSpeed() { return 1 - clamp(this.level - 0.3, 0, 0.6) * 0.45; },
  // the body: sway, a heavy head, loose shoulders (called after the gait or the seat has posed it)
  pose(P) {
    const L = Math.min(this.level, 1);
    if (L < 0.02) return;
    const sx = this.sway.x, sy = this.sway.y, seated = SIT.owns();
    P.spRoll += sx * 0.09 * L * (seated ? 0.7 : 1);
    P.pelRoll += sx * 0.03 * L * (seated ? 0 : 1);
    if (!seated) P.pel.x += sx * 0.035 * L;
    P.spPitch += (0.04 + sy * 0.03) * L;
    P.hdPitch += (0.12 + Math.sin(this.t * 0.4) * 0.06) * L;
    P.hdRoll = (P.hdRoll || 0) - sx * 0.14 * L;
    P.hdYaw += sy * 0.12 * L;
  },
  // the view: the horizon tilts and the camera lags and drifts
  camera(cam) {
    const L = Math.min(this.level, 1);
    if (L < 0.02) return;
    cam.position.x += this.sway.y * 0.12 * L; cam.position.y += this.sway.x * 0.06 * L;
    cam.rotateZ(this.sway.x * 0.07 * L);
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
    this.hicPose = 0.25;
  },

  /* ---- out cold: fade to black, wake up somewhere ---- */
  blackout() {
    this.out = { t: 0, phase: 'fade', where: null };
    GUN.setAim(false); if (GUN.state !== 'holster') { GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    DRINK.cancel();
    worldEvent('passout', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player' });
  },
  updateBlackout(dt) {
    const O = this.out, el = document.getElementById('blackout');
    O.t += dt;
    if (O.phase === 'fade') {
      el.hidden = false; el.style.opacity = clamp(O.t / 1.6, 0, 1).toFixed(2);
      PLAY.vx *= Math.exp(-dt * 3); PLAY.vz *= Math.exp(-dt * 3);
      if (O.t >= 2.2) { O.phase = 'dark'; O.t = 0; this.wakeSomewhere(); }
    } else if (O.phase === 'dark') {
      if (O.t >= 1.4) { O.phase = 'wake'; O.t = 0; }
    } else {
      el.style.opacity = clamp(1 - O.t / 2.5, 0, 1).toFixed(2);
      if (O.t >= 2.5) { el.hidden = true; this.out = null; }
    }
  },
  wakeSomewhere() {
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
    else { const g = (w.go || spots[0].go)(); PLAY.pos.copy(g.p); PLAY.yaw = g.yaw; PLAY.camYaw = g.yaw + Math.PI; PLAY.vx = PLAY.vz = 0; GAIT.init = false; G.lookAt = null; }
    this.level = 0.3; this.stomach = 0;
    const lost = Math.round(INV.money * (0.2 + Math.random() * 0.4));
    INV.money -= lost;
    TOAST.show(w.text, 'long');
    if (lost > 0) setTimeout(() => TOAST.show('Deine Taschen fühlen sich leichter an (−' + price(lost) + ').', 'long'), 1800);
  }
};
SAVE.part('drunk', () => ({ level: +DRUNK.level.toFixed(3), stomach: +DRUNK.stomach.toFixed(3) }), (d) => { DRUNK.level = clamp(+d.level || 0, 0, 0.95); DRUNK.stomach = clamp(+d.stomach || 0, 0, 1); });
