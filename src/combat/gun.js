/* ---------- the revolver: holster, draw, aim, fire, reload; bottles to shoot at ----------
   States: holster -> draw -> drawn (lowered or aimed) -> holstering, and reload from drawn.
   The right arm is solved every frame so the barrel points where the crosshair points.
   Every shot is also a world event (core/world.js) so that townsfolk can react to it later. */

// gun space: origin at the top of the grip (inside the hand), barrel along +z, top along +y
const GUNM = {
  hand: new THREE.Matrix4().makeTranslation(0, -0.31, 0.055).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
  holster: new THREE.Matrix4().makeTranslation(-0.268, 0.1, 0.0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.12)),
  muzzle: new THREE.Vector3(0, 0.046, 0.31)
};
function buildGunGeo() {
  const mb = new MB(), steel = rgb(0x55514d), dark = rgb(0x2b2826), wood = rgb(0x7a4a2a), brass = rgb(0xb8913e);
  mb.box(0, 0.0, 0.03, 0.034, 0.058, 0.13, steel, 0, { bottom: true });            // frame
  mb.push(new THREE.Matrix4().makeTranslation(0, 0.03, 0.06).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
  mb.cyl(0, -0.036, 0, 0.031, 0.031, 0.072, 8, dark, 0, { bottom: true });          // cylinder
  mb.pop();
  mb.box(0, 0.035, 0.2, 0.022, 0.022, 0.21, steel, 0, { bottom: true });           // barrel
  mb.box(0, 0.016, 0.16, 0.012, 0.014, 0.12, dark, 0, { bottom: true });           // ejector rod
  mb.box(0, 0.057, 0.296, 0.006, 0.012, 0.012, steel, 0);                          // front sight
  mb.box(0, 0.05, -0.028, 0.012, 0.032, 0.02, dark, 0);                            // hammer
  mb.push(new THREE.Matrix4().makeTranslation(0, 0.008, -0.022).multiply(new THREE.Matrix4().makeRotationX(-0.38)));
  mb.box(0, -0.125, -0.012, 0.032, 0.13, 0.046, wood, 0, { bottom: true });       // grip
  mb.pop();
  mb.box(0, -0.034, 0.028, 0.008, 0.008, 0.055, brass, 0, { bottom: true });       // trigger guard
  mb.box(0, -0.03, 0.056, 0.008, 0.03, 0.008, brass, 0, { bottom: true });
  mb.box(0, -0.022, 0.03, 0.004, 0.024, 0.006, dark, 0, { bottom: true });         // trigger
  return mb;
}

/* bottles standing on rails, barrels and crates */
const BOTTLE_SPOTS = [
  [-13.4, 1.11, 5.8], [-12.5, 1.11, 5.8], [-11.6, 1.11, 5.8], [-10.6, 1.11, 5.8], [-9.6, 1.11, 5.8],
  [-38.8, 1.0, -2.3], [-38.0, 1.0, -1.7], [-27.2, 1.0, -2.4], [3.5, 0.75, 6.85], [2.9, 1.5, 6.6]
];
const BOTTLES = [];
function buildBottles(scene) {
  const cols = [[0x3f7a4a, 0xd8c79a], [0x7a4a22, 0xe0d2b0], [0x9fb8b0, 0xc94a3a]];
  const geos = cols.map(([body, label]) => {
    const mb = new MB(), c = rgb(body);
    mb.cyl(0, 0, 0, 0.042, 0.042, 0.15, 8, c, 0, { bottom: true });
    mb.cyl(0, 0.05, 0, 0.0436, 0.0436, 0.06, 8, rgb(label), 0, { noTop: true });
    mb.cyl(0, 0.15, 0, 0.042, 0.017, 0.045, 8, c, 0, { noTop: true });
    mb.cyl(0, 0.195, 0, 0.017, 0.017, 0.06, 6, c, 0);
    return mb.build();
  });
  BOTTLE_SPOTS.forEach(([x, y, z], i) => {
    const m = new THREE.Mesh(geos[i % 3], G.litMat);
    m.position.set(x, y, z); m.rotation.y = i * 1.3; m.scale.setScalar(1.4);
    scene.add(m);
    BOTTLES.push({ mesh: m, x, y, z, col: rgb(cols[i % 3][0]), alive: true, back: 0 });
  });
}

const GUN = {
  state: 'holster', t: 0, inHand: false, ammo: 6, reserve: 24, MAX: 48,
  aimW: 0, camW: 0, wantAim: false, hipT: 0, fireQ: false, cool: 0, recoil: 0, recoilV: 0, kick: 0,
  ov: { sw: 0, yw: 0, out: 0.08, el: 0.15 }, ovW: 0, ovL: { sw: 0, yw: 0, out: 0.08, el: 0.15 }, ovLW: 0,
  reload: null, spread: 0, aimDist: 25, touch: false, lastHudKey: '', steady: 0, kickP: 0, kickV: 0, fovPunch: 0,
  init(scene) {
    FX.init(scene);
    buildBottles(scene);
    BREAK.init();
    DUMMY.build(scene);
    this.P = W.ch.pose;
    W.ch.pose.armOv = [null, null];
    this.ray = new THREE.Raycaster();
  },

  /* ---- requests from input ---- */
  toggleHolster() {
    if (SIT.owns()) return;
    if (this.state !== 'holster') this.reloadThenHolster = false;
    if (this.state === 'holster') this.startDraw();
    else if (this.state === 'drawn' || this.state === 'reload') { this.state = 'holstering'; this.t = 0; this.reload = null; this.wantAim = false; }
  },
  startDraw() { if (this.state === 'holster') { this.state = 'draw'; this.t = 0; } },
  /* the attack button (left mouse, F, RT, the touch button): aiming, it fires; otherwise it is a punch. The revolver
     is only out while you aim: let go of the aim and it goes back in the holster */
  attack(mouse) {
    if (this.wantAim && this.state !== 'holster' && this.state !== 'holstering') this.pressFire();
    else if (this.state === 'holster') FIST.down(mouse);
  },
  // touch aim button: first press draws and aims, the second puts the revolver straight away
  aimButton() {
    if (!this.wantAim) { this.setAim(true); return; }
    this.wantAim = false; this.hipT = 0;
    if (this.state === 'draw') { if (this.t < 0.17) { this.state = 'holster'; this.inHand = false; } else this.holsterQ = true; }
    else if (this.state === 'drawn' || this.state === 'reload') this.toggleHolster();
  },
  setAim(on) {
    if (on && (SIT.busy() || DRINK.busy() || DRUNK.blocked())) return;
    this.wantAim = on;
    if (on) this.holsterQ = false;
    if (on) {
      if (this.state === 'holster') this.startDraw();
      if (this.reload && this.ammo > 0) this.reload.stop = true;
      if (this.camW < 0.05) PLAY.aimPitch = clamp(PLAY.camPitch - 0.25, -0.3, 0.55);
    }
  },
  pressFire() {
    if (SIT.busy() || DRINK.busy() || DRUNK.blocked()) return;
    if (this.state === 'holster' || this.state === 'holstering') return;
    if (this.reload) { if (this.ammo > 0) this.reload.stop = true; else return; }
    this.fireQ = true;
    if (this.aimW < 0.6) { this.hipT = 0.9; if (this.camW < 0.05) PLAY.aimPitch = clamp(PLAY.camPitch - 0.25, -0.3, 0.55); }
  },
  pressReload() {
    if (SIT.busy() || DRINK.busy() || DRUNK.blocked()) return;
    if (this.ammo >= 6 || this.reserve <= 0) return;
    // holstered: draw, reload, put it away again
    if (this.state === 'holster') { this.startDraw(); this.reloadThenHolster = true; return; }
    if (this.state !== 'drawn' || this.reload) return;
    this.state = 'reload'; this.reload = { t: 0, phase: 'open', n: 0, stop: false };
    GSFX.gate();
  },
  aiming() { return this.aimW > 0.05 || this.hipT > 0; },

  /* ---- per frame, before the player moves ---- */
  update(dt) {
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
    this.hipT = Math.max(0, this.hipT - dt);
    // the revolver is out only while you aim (or reload): the aim let go, it goes back into the holster at once
    if (this.state === 'drawn' && !this.wantAim && !this.fireQ && !this.reload && !this.reloadThenHolster) { this.idleT = (this.idleT || 0) + dt; if (this.idleT > 0.18) { this.idleT = 0; this.toggleHolster(); } }
    else this.idleT = 0;
    if (this.state === 'draw') {
      if (!this.inHand && this.t > 0.17) { this.inHand = true; GSFX.leather(); }
      if (this.t > 0.42) { this.state = 'drawn'; if (this.holsterQ) { this.holsterQ = false; this.toggleHolster(); } else if (this.reloadThenHolster) { this.pressReload(); if (!this.reload) this.reloadThenHolster = false; } }
    } else if (this.state === 'holstering') {
      if (this.inHand && this.t > 0.26) { this.inHand = false; GSFX.leather(); }
      if (this.t > 0.45) this.state = 'holster';
    } else if (this.state === 'reload') this.updateReload(dt);
    const canAim = (this.state === 'drawn' || (this.state === 'draw' && this.t > 0.2)) && !this.reload;
    const want = canAim && (this.wantAim || this.hipT > 0);
    this.aimW += ((want ? 1 : 0) - this.aimW) * (1 - Math.exp(-dt * (want ? 14 : 8)));
    this.camW += ((want ? 1 : 0) - this.camW) * (1 - Math.exp(-dt * (want ? 11 : 6)));
    // recoil: a spring kicked by each shot
    this.recoilV += (-260 * this.recoil - 22 * this.recoilV) * dt;
    this.recoil += this.recoilV * dt;
    // the gunsmith tops up your cartridges
    if (G.room && G.room.type === 'gunsmith' && this.reserve < this.MAX) { this.reserve = this.MAX; GSFX.box(); HUD.hint('Munition aufgefüllt'); HUD.hintTimer = setTimeout(() => HUD.hideHint(), 1800); }
    BREAK.update(dt);
    for (const b of BOTTLES) if (!b.alive && (b.back -= dt) <= 0) { const d = Math.hypot(PLAY.pos.x - b.x, PLAY.pos.z - b.z); if (d > 4) { b.alive = true; b.mesh.visible = true; } }
  },
  updateReload(dt) {
    const R = this.reload;
    R.t += dt;
    if (R.phase === 'open' && R.t > 0.32) { R.phase = 'load'; R.t = 0; }
    else if (R.phase === 'load' && R.t > 0.36) {
      R.t = 0;
      if (this.ammo < 6 && this.reserve > 0) { this.ammo++; this.reserve--; R.n++; GSFX.round(); }
      if (this.ammo >= 6 || this.reserve <= 0 || R.stop) { R.phase = 'close'; }
    } else if (R.phase === 'close' && R.t > 0.26) {
      GSFX.gate(); this.reload = null; this.state = 'drawn';
      if (this.reloadThenHolster) { this.reloadThenHolster = false; if (!this.wantAim) this.toggleHolster(); }
    }
  },

  /* ---- character pose (called by the gait just before the pose is applied) ---- */
  pose(P, dt) {
    const w = this.aimW, f = 1 - Math.exp(-dt * 18);
    // aim direction and a point to point the arm at
    const cam = G.cam, fwd = this._f || (this._f = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    const tgt = this._t || (this._t = new THREE.Vector3());
    tgt.copy(cam.position).addScaledVector(fwd, this.aimDist);
    const elev = Math.asin(clamp(fwd.y, -1, 1));
    if (w > 0.001) {
      P.spPitch = lerp(P.spPitch, -elev * 0.3, w);
      P.spYaw = lerp(P.spYaw, -0.12, w);
      P.hdPitch = lerp(P.hdPitch, -elev * 0.55, w);
      P.hdYaw = lerp(P.hdYaw, -0.24, w);
    }
    // the right arm: where it should be in this state
    let goal = null;
    const REACH = { sw: -0.1, yw: 0.05, out: 0.24, el: 0.6 }, LOW = { sw: 0.42, yw: -0.12, out: 0.1, el: 0.6 }, RELOAD = { sw: 0.62, yw: 0.6, out: 0.04, el: 1.2 };
    if (this.state === 'draw') goal = this.t < 0.17 ? REACH : null;
    else if (this.state === 'holstering') goal = this.t < 0.3 ? REACH : { sw: 0, yw: 0, out: 0.08, el: 0.15 };
    else if (this.state === 'reload') goal = RELOAD;
    else if (this.state === 'holster') goal = null;
    if (goal === null && this.state !== 'holster') goal = this.solveAim(P, tgt, LOW, w);
    const wantW = this.state === 'holster' ? 0 : this.state === 'holstering' && this.t > 0.36 ? 0 : 1;
    this.ovW += (wantW - this.ovW) * (1 - Math.exp(-dt * 14));
    if (goal) for (const k of ['sw', 'yw', 'out', 'el']) this.ov[k] += (goal[k] - this.ov[k]) * f;
    const rc = Math.max(0, this.recoil);
    P.armOv[1] = { w: this.ovW, sw: this.ov.sw + rc * 0.55, yw: this.ov.yw, out: this.ov.out, el: this.ov.el + rc * 0.35 };
    P.spPitch -= rc * 0.05;
    // the left hand feeds cartridges while reloading
    const R = this.reload, lw = R ? 1 : 0;
    this.ovLW += (lw - this.ovLW) * (1 - Math.exp(-dt * 10));
    if (this.ovLW > 0.001) {
      const bob = R && R.phase === 'load' ? Math.sin(Math.min(1, R.t / 0.36) * Math.PI) : 0;
      const g2 = { sw: 0.66 - bob * 0.15, yw: -0.55, out: 0.02, el: 1.45 + bob * 0.25 };
      for (const k of ['sw', 'yw', 'out', 'el']) this.ovL[k] += (g2[k] - this.ovL[k]) * f;
      P.armOv[0] = { w: this.ovLW, sw: this.ovL.sw, yw: this.ovL.yw, out: this.ovL.out, el: this.ovL.el };
    } else P.armOv[0] = null;
    P.gunInHand = this.inHand;
    if (this.inHand) P.hand[1].fist = Math.max(P.hand[1].fist, 0.8 * this.ovW);
    if (this.ovLW > 0.01) P.hand[0].fist = Math.max(P.hand[0].fist, 0.5 * this.ovLW);
  },
  // arm angles that point the right hand at a world point (out = 0: sw/yw give the direction exactly)
  solveAim(P, tgt, low, w) {
    const m = this._m || (this._m = { pel: new THREE.Matrix4(), tor: new THREE.Matrix4(), tmp: new THREE.Matrix4(), inv: new THREE.Matrix4(), v: new THREE.Vector3() });
    rotTo(m.pel, P.pel.x, P.pel.y, P.pel.z, P.pelPitch, P.pelYaw, P.pelRoll);
    m.tor.multiplyMatrices(m.pel, rotTo(m.tmp, 0, RIG.waistY, 0, P.spPitch, P.spYaw, P.spRoll));
    m.inv.copy(m.tor).invert();
    // world -> character root -> torso
    const dx = tgt.x - PLAY.pos.x, dy = tgt.y - PLAY.pos.y, dz = tgt.z - PLAY.pos.z, c = Math.cos(PLAY.yaw), s = Math.sin(PLAY.yaw);
    m.v.set(dx * c - dz * s, dy, dx * s + dz * c).applyMatrix4(m.inv);
    m.v.x -= -RIG.shoulderX; m.v.y -= RIG.shoulderY;
    m.v.normalize();
    const aim = { sw: Math.acos(clamp(-m.v.y, -1, 1)), yw: Math.atan2(m.v.x, m.v.z), out: 0, el: 0.06 };
    if (w >= 0.999) return aim;
    return { sw: lerp(low.sw, aim.sw, w), yw: lerp(low.yw, aim.yw, w), out: lerp(low.out, aim.out, w), el: lerp(low.el, aim.el, w) };
  },

  /* ---- after the pose: fire, effects, particles, HUD ---- */
  late(dt) {
    if (this.fireQ) {
      const ready = this.state === 'drawn' && !this.reload && this.aimW > 0.7 && this.camW > 0.6 && this.cool <= 0;
      if (ready) { this.fireQ = false; this.fire(); }
      else if (this.state === 'holster' || this.state === 'holstering') this.fireQ = false;
    }
    // camera kick: a spring that throws the view up and lets it settle back
    this.kickV += (-170 * this.kickP - 17 * this.kickV) * dt;
    this.kickP += this.kickV * dt;
    this.fovPunch = Math.max(0, this.fovPunch - dt * 7);
    // touch: aim assist pulls the crosshair gently onto what is right next to it (a person first, then glass);
    // only what can be seen from here, and only when it is already almost on it
    if (this.touch && this.camW > 0.6 && SETTINGS.v.aimAssist !== 'off') {
      const b = this.assist(0.055, 35, true);
      if (b) {
        const u = b.dir;
        const ty = Math.atan2(-u.x, -u.z), tp = -Math.asin(clamp(u.y, -1, 1));
        const k = 1 - Math.exp(-dt * 2.2 * (1 - b.ang / 0.055));
        PLAY.camYaw += wrapA(ty - PLAY.camYaw) * k; PLAY.aimPitch += (tp - PLAY.aimPitch) * k;
      }
    }
    // spread: wide from the hip or on the move; holding a steady aim tightens it further over a second
    const moveS = Math.hypot(PLAY.vx, PLAY.vz);
    if (this.camW > 0.8 && moveS < 0.3 && this.wantAim) this.steady = Math.min(1, this.steady + dt * 1.1);
    else this.steady = Math.max(0, this.steady - dt * 3);
    // (aimed and standing still the bullet goes where the crosshair is: a hair's breadth, a little more at once after a shot)
    const base = lerp(0.035, lerp(0.0022, 0.0004, smoothstep(0, 1, this.steady)), this.aimW) + moveS * 0.012 + DRUNK.level * 0.03;
    this.spread += (base - this.spread) * (1 - Math.exp(-dt * 7));
    const b = this.bestBottle(0.03, 60); this.aimDist = b ? b.dist : 25;
    let mz = null;
    if (this.inHand && FX.wisp > 0) { mz = this._mzNow || (this._mzNow = new THREE.Vector3()); this.muzzleWorld(mz); }
    FX.update(dt, mz);
    this.hud();
  },
  muzzleWorld(out) {
    const m = this._mw || (this._mw = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion());
    q.setFromAxisAngle(this._up || (this._up = new THREE.Vector3(0, 1, 0)), PLAY.yaw);
    m.compose(PLAY.pos, q, this._one || (this._one = new THREE.Vector3(1, 1, 1)));
    m.multiply(W.ch.p.gun.matrix);
    out.copy(GUNM.muzzle).applyMatrix4(m);
    return m;
  },
  /* what the aim assist may take: a person (the chest or the head, whichever is nearer the crosshair) before any
     glass, inside maxAng of where the camera looks, and only if nothing stands between (a wall, the bar, the
     corner you stand in) */
  assist(maxAng, maxDist, sticky) {
    const cam = G.cam, fwd = this._af || (this._af = new THREE.Vector3()), u = this._au || (this._au = new THREE.Vector3()), p = this._ap || (this._ap = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    let best = null;
    /* it keeps to the one it has (no hopping between head and chest, or between two people, which made the
       crosshair jump), and lets go only when you have clearly moved off him */
    const L = sticky && this.lock && G.time - this.lock.t < 0.5 ? this.lock : null;
    for (const N of NPCS.list) {
      if (N.hp.dead || !N.ch.root.visible) continue;
      for (const part of ['torso', 'head']) {
        N.ch.p[part].getWorldPosition(p); if (part === 'torso') p.y += 0.15;
        u.subVectors(p, cam.position); const d = u.length(); if (d > maxDist || d < 0.8) continue;
        u.multiplyScalar(1 / d);
        let ang = Math.acos(clamp(u.dot(fwd), -1, 1));
        const mine = L && L.npc === N && L.part === part;
        if (L && !mine) continue;
        if (ang < (mine ? maxAng * 1.6 : maxAng) && (!best || ang < best.ang) && this.seen(cam.position, u, d)) best = { npc: N, part, ang, dist: d, dir: u.clone() };
      }
    }
    if (sticky) this.lock = best ? { npc: best.npc, part: best.part, t: G.time } : null;
    if (best) return best;
    const b = this.bestBottle(maxAng, maxDist);
    return b && this.seen(cam.position, b.dir, b.dist) ? b : null;
  },
  // nothing solid between the camera and a point d away along u (glass at the end of it is part of the room)
  seen(o, u, d) {
    const ray = this.ray; ray.set(o, u); ray.near = 0.05; ray.far = Math.max(0.1, d - 0.3);
    const objs = this._seenObjs || (this._seenObjs = []); objs.length = 0;
    for (const m of W.worldMeshes) objs.push(m); if (G.room && G.room.mesh) objs.push(G.room.mesh);
    return ray.intersectObjects(objs, false).length === 0;
  },
  bestBottle(maxAng, maxDist) {
    const cam = G.cam, fwd = this._bf || (this._bf = new THREE.Vector3()), u = this._bu || (this._bu = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    let best = null;
    for (const b of BOTTLES) {
      if (!b.alive) continue;
      u.set(b.x - cam.position.x, b.y + 0.16 - cam.position.y, b.z - cam.position.z);
      const d = u.length(); if (d > maxDist || d < 0.5) continue;
      u.multiplyScalar(1 / d);
      const ang = Math.acos(clamp(u.dot(fwd), -1, 1));
      if (ang < maxAng && (!best || ang < best.ang)) best = { b, ang, dist: d, dir: u.clone() };
    }
    const g = BREAK.near(cam, fwd, best ? best.ang : maxAng, maxDist, u);
    return g || best;
  },
  fire() {
    if (this.ammo <= 0) { GSFX.dry(); this.cool = 0.3; return; }
    this.ammo--; this.cool = 0.42;
    const cam = G.cam, dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    if (this.touch && SETTINGS.v.aimAssist !== 'off') { const b = this.assist(this.camW > 0.9 ? 0.035 : 0.06, 35, true); if (b) dir.copy(b.dir); }
    const sp = this.spread * Math.sqrt(Math.random()), a = Math.random() * TAU;
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(side, dir);
    dir.addScaledVector(side, Math.cos(a) * sp).addScaledVector(up, Math.sin(a) * sp).normalize();
    const head = new THREE.Vector3(PLAY.pos.x, PLAY.pos.y + 1.5, PLAY.pos.z);
    const near = Math.max(0, cam.position.distanceTo(head) - 0.3);
    const hit = this.trace(cam.position, dir, near, 160);
    // flash, light and smoke at the muzzle
    const mz = new THREE.Vector3(), gm = this.muzzleWorld(mz);
    const bd = new THREE.Vector3(0, 0, 1).transformDirection(gm);
    const gap = new THREE.Vector3(0, 0.03, 0.1).applyMatrix4(gm);
    FX.muzzle(mz, bd, gap);
    // kick: arm flips, view jumps and settles, a short shake and a punch of the field of view
    this.recoilV += 12;
    this.kickV -= 3.2;
    PLAY.aimPitch = clamp(PLAY.aimPitch - 0.012, -0.75, 0.9);
    PLAY.camShake = 0.045;
    this.fovPunch = 1;
    this.steady *= 0.6;
    if (this.touch && navigator.vibrate) { try { navigator.vibrate(22); } catch (e) { /* ignore */ } }
    GSFX.shot(!!G.room);
    setTimeout(() => GSFX.cock(), 260);
    worldEvent('shot', mz.x, mz.y, mz.z, { by: 'player', room: G.room ? G.room.type : null });
    if (!hit) return;
    this.hitResult(hit, dir, 0);
  },
  // what the bullet does where it lands; glass does not stop it, it flies on to whatever is behind
  hitResult(hit, dir, depth) {
    if (hit.glass) {
      BREAK.shatter(hit.glass, dir);
      if (depth < 3) { const o = hit.point.clone().addScaledVector(dir, 0.02), nx = this.trace(o, dir, 0, 40); if (nx) this.hitResult(nx, dir, depth + 1); }
    } else if (hit.bottle) {
      shatterBottle(hit.bottle, dir);
    } else if (hit.dummy) {
      DUMMY.shot(hit.point, dir);
    } else if (hit.npc) {
      HARM.shot(hit, dir);
    } else {
      const S = FX.impact(hit.hit, dir);
      GSFX.impact(hit.point, S.kind || (S.splinter ? 'wood' : 'dirt'));
      const ny = hit.hit.face ? hit.hit.face.normal.y : 0;
      worldEvent('impact', hit.point.x, hit.point.y, hit.point.z, { by: 'player', surface: S.kind, part: ny < -0.7 ? 'ceiling' : ny > 0.7 ? 'floor' : 'wall', room: G.room ? G.room.type : null });
    }
  },
  trace(o, d, near, far) {
    let best = null;
    for (const b of BOTTLES) {
      if (!b.alive) continue;
      const cx = b.x - o.x, cy = b.y + 0.14 - o.y, cz = b.z - o.z;
      const t = cx * d.x + cy * d.y + cz * d.z;
      if (t < near || t > far) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t;
      if (d2 < 0.115 * 0.115 && (!best || t < best.t)) best = { t, bottle: b, point: new THREE.Vector3().copy(o).addScaledVector(d, t) };
    }
    // the dummy: sack and head as two spheres
    for (const [y, r] of [[DUMMY.torsoY, DUMMY.torsoR], [DUMMY.headY, DUMMY.headR]]) {
      const c = DUMMY.part(y), cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z, t = cx * d.x + cy * d.y + cz * d.z;
      if (t < near || t > far) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t;
      if (d2 < r * r) { const tt = t - Math.sqrt(r * r - d2); if (!best || tt < best.t) best = { t: tt, dummy: true, point: new THREE.Vector3().copy(o).addScaledVector(d, tt) }; }
    }
    // people: the exact part and zone (npc/harm.js)
    const ph = HARM.trace(o, d, near, best ? best.t : far);
    if (ph && (!best || ph.t < best.t)) best = ph;
    const objs = W.worldMeshes.slice();
    for (const R of ROOMS) if (R.mesh && R.mesh.visible) objs.push(R.mesh);
    for (const D of DOORS) for (const m of D.meshes) objs.push(m);
    this.ray.set(o, d); this.ray.near = near; this.ray.far = best ? best.t : far;
    const hits = this.ray.intersectObjects(objs, false);
    const gl = BREAK.trace(o, d, near, hits.length ? hits[0].distance : this.ray.far, hits[0]);
    if (gl && !(best && best.t <= gl.t)) return { t: gl.t, point: new THREE.Vector3().copy(o).addScaledVector(d, gl.t), glass: gl.glass };
    if (hits.length && !(best && best.t <= hits[0].distance)) return { t: hits[0].distance, point: hits[0].point.clone(), bottle: null, hit: hits[0] };
    return best;
  },
  hud() {
    const xh = HUD.$('xhair');
    const show = this.camW > 0.5 ? 1 : this.state === 'drawn' && !this.reload ? 0 : 0;
    xh.style.opacity = String(clamp((this.camW - 0.3) / 0.5, 0, 1) * show);
    xh.style.setProperty('--gap', (2.5 + this.spread * 190).toFixed(1) + 'px');
    xh.classList.toggle('steady', this.steady > 0.85);
    // over a person the cross turns red (checked a few times a second, from the camera like the bullet)
    if (this.camW > 0.5 && G.frameNo % 4 === 0) {
      const cam = G.cam, d = cam.getWorldDirection(this._xd || (this._xd = new THREE.Vector3())), h = HARM.trace(cam.position, d, 0.5, 60);
      const on = !!(h && h.npc && !h.npc.hp.dead && (h.npc.room || null) === (G.room || null));
      if (on !== this.onBody) { this.onBody = on; xh.classList.toggle('onBody', on); }
    } else if (this.camW <= 0.5 && this.onBody) { this.onBody = false; xh.classList.remove('onBody'); }
    const key = this.ammo + '/' + this.reserve + '/' + (this.state === 'holster') + '/' + !!this.reload;
    if (key !== this.lastHudKey) {
      this.lastHudKey = key;
      const cs = HUD.$('cyl').querySelectorAll('circle.ch');
      cs.forEach((c, i) => c.classList.toggle('full', i < this.ammo));
      HUD.$('reserve').textContent = String(this.reserve);
      HUD.$('ammo').classList.toggle('dim', this.state === 'holster');
      HUD.$('ammo').classList.toggle('loading', !!this.reload);
      HUD.$('bReload').disabled = this.ammo >= 6 || this.reserve <= 0;
      HUD.$('bFire').textContent = this.state === 'holster' ? 'Schlag' : 'Feuer';
    }
    const ba = HUD.$('bAim');
    if (this.lastAimHud !== this.wantAim) { this.lastAimHud = this.wantAim; ba.setAttribute('aria-pressed', this.wantAim ? 'true' : 'false'); }   // the label: HUD.buttons
  }
};
