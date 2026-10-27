/* ---------- the player's own body: blows taken, going down, out cold ----------
   hp 0…1 comes back slowly by itself (and fully at the doctor or after a night's sleep). Blows (an NPC's fist,
   later bullets) take some, rock the head and the view and push the body back; a hard one, or too many, put you
   down (FALL), and at the end you are out cold: the screen goes black and you wake up somewhere else an hour
   later (thrown out onto the street, or at the doctor's). A red rim on the screen shows how bad it is. */
const PHP = {
  hp: 1, daze: 0, fx: null, out: null, flash: 0, lastHit: -99,
  init() {
    this.el = document.getElementById('hurtFx');
    TIME.onSkip((m) => { this.hp = Math.min(1, this.hp + m / 60 * 0.25); this.daze = 0; });
  },
  /* o: { power, head, dir: {x, z} (the way the blow travels), by: npc, heavy, shot } */
  hit(o) {
    if (this.out) return;
    const p = o.power || 1;
    this.lastHit = G.time;
    this.hp = Math.max(0, this.hp - (o.shot ? 0.45 : (o.head ? 0.13 : 0.09)) * p * (o.heavy ? 1.5 : 1));
    this.daze += (o.head ? 0.32 : 0.15) * p * (o.heavy ? 1.6 : 1);
    this.flash = 1;
    // the body jerks away from the blow (PHP.pose)
    const c = Math.cos(PLAY.yaw), sn = Math.sin(PLAY.yaw), lx = o.dir.x * c - o.dir.z * sn, lz = o.dir.x * sn + o.dir.z * c;
    this.jerk = { yaw: clamp(-lx * 1.2, -0.9, 0.9), pitch: o.head ? -0.45 * lz : 0.35, roll: clamp(lx * 0.6, -0.5, 0.5), head: o.head ? 1 : 0.4, k: o.heavy ? 1.3 : 0.9 };
    // the head snaps, the view jumps, the body is pushed the way the blow went
    PLAY.camShake = Math.max(PLAY.camShake, o.heavy ? 0.12 : 0.07);
    PLAY.camPush.set(o.dir.x, o.head ? 0.15 : -0.1, o.dir.z).multiplyScalar(o.heavy ? 0.35 : 0.2);
    PLAY.vx += o.dir.x * (o.heavy ? 2.6 : 1.4); PLAY.vz += o.dir.z * (o.heavy ? 2.6 : 1.4);
    if (GUN.touch && navigator.vibrate) { try { navigator.vibrate(o.heavy ? 60 : 30); } catch (e) { /* ignore */ } }
    FIST.st = FIST.clip ? FIST.st : 'idle'; FIST.queued = false;
    DRINK.cancel();
    if (this.hp <= 0) { this.knockout(o); return 'out'; }
    if ((this.daze >= 1 || (o.heavy && this.daze > 0.6)) && !FALL.busy() && !SIT.busy()) {
      FALL.start(false, 'back', Math.atan2(o.dir.x, o.dir.z));
      this.daze = 0.4;
      return 'down';
    }
    return 'hit';
  },
  knockout(o) {
    if (this.out) return;
    if (SIT.busy()) SIT.cancel();
    if (!FALL.busy()) FALL.start(true, 'back', Math.atan2(o.dir.x, o.dir.z)); else FALL.keep = true;
    this.out = { t: 0, by: o.by || null, shot: !!o.shot };
    GUN.setAim(false); if (GUN.state !== 'holster') { GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; }
    worldEvent('playerOut', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: o.by ? o.by.id : 'world', shot: !!o.shot });
  },
  busy() { return !!this.out; },
  // the jerk of a blow taken, laid over whatever the body is doing
  pose(P, dt) {
    const J = this.jerk; if (!J || J.k < 0.01) return;
    J.k *= Math.exp(-dt * 7);
    P.spYaw += J.yaw * J.k * 0.6; P.spPitch += J.pitch * J.k * 0.5; P.spRoll += J.roll * J.k * 0.5;
    P.hdYaw += J.yaw * J.k * 0.5 * J.head; P.hdPitch += J.pitch * J.k * J.head; P.hdRoll = (P.hdRoll || 0) + J.roll * J.k * J.head;
  },
  update(dt) {
    this.daze = Math.max(0, this.daze - dt * 0.12);
    if (!this.out && G.time - this.lastHit > 6) this.hp = Math.min(1, this.hp + dt * 0.012);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    // the red rim: how hurt, plus a flash on each blow
    const k = clamp((1 - this.hp) * 0.75 + this.flash * 0.5, 0, 0.95);
    if (this.el && Math.abs(k - (this.shownK || 0)) > 0.01) { this.shownK = k; this.el.style.opacity = k.toFixed(2); }
    const O = this.out;
    if (!O) { this.fx = null; return; }
    O.t += dt;
    if (!this.fx) this.fx = { dark: 0, lid: 0 };
    if (O.t < 3.5) this.fx.dark = smoothstep(1.2, 3.4, O.t);
    else if (!O.woke) { O.woke = true; this.wake(); }
    else {
      const t = O.t - 3.5;
      // eyes open slowly
      this.fx.dark = 0; this.fx.lid = t < 0.6 ? 1 : 1 - smoothstep(0.6, 3.5, t) + Math.max(0, Math.sin(t * 3)) * 0.2 * (1 - smoothstep(1, 3.5, t));
      if (t > 3.6) { this.out = null; this.fx = null; FALL.keep = false; }
    }
  },
  // where you come to: thrown out of the saloon onto the street, or (shot) at the doctor's
  wake() {
    const O = this.out;
    FALL.cancel();
    TIME.skip(60); DAYNIGHT.update(0, true);
    this.hp = O.shot ? 0.5 : 0.35; this.daze = 0;
    let text;
    const doc = typeof DOC !== 'undefined' && DOC.wakeSpot ? DOC.wakeSpot() : null;
    if (O.shot && doc) { PLAY.pos.copy(doc.p); PLAY.yaw = doc.yaw; text = 'Du kommst beim Doktor zu dir. Verbunden, aber am Leben.'; if (DOC.patientFee) DOC.patientFee(); }
    else {
      const R = ROOMS.find((r) => r.type === 'saloon'), inSaloon = O.by && O.by.room === R;
      const p = inSaloon ? rwp(R, 1.5, 0, R.z1 + 3.2) : PLAY.pos.clone();
      PLAY.pos.set(p.x, groundAt(p.x, p.z, 1), p.z);
      text = inSaloon ? 'Du wachst im Staub vor dem Saloon auf. Hank hat dich rausgeworfen.' : 'Du kommst wieder zu dir. Dir dröhnt der Schädel.';
    }
    PLAY.vx = PLAY.vz = 0; GAIT.init = false; G.lookAt = null; PLAY.camYaw = PLAY.yaw + Math.PI;
    FALL.startLying();
    setTimeout(() => TOAST.show(text + ' Es ist ' + TIME.str() + ' Uhr.', 'long'), 600);
  }
};
SAVE.part('health', () => ({ hp: +PHP.hp.toFixed(3) }), (d) => { if (d && isFinite(+d.hp)) PHP.hp = clamp(+d.hp, 0.2, 1); });
