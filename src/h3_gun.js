/* ---------- the revolver: holster, draw, aim, fire, reload; bottles to shoot at ----------
   States: holster -> draw -> drawn (lowered or aimed) -> holstering, and reload from drawn.
   The right arm is solved every frame so the barrel points where the crosshair points.
   Every shot is also written to WORLD_EVENTS so that townsfolk can react to it later. */
const WORLD_EVENTS = [];
function worldEvent(type, x, y, z, extra) {
  WORLD_EVENTS.push(Object.assign({ type, x, y, z, t: G.time }, extra || {}));
  if (WORLD_EVENTS.length > 60) WORLD_EVENTS.shift();
}

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
    DUMMY.build(scene);
    this.P = W.ch.pose;
    W.ch.pose.armOv = [null, null];
    this.ray = new THREE.Raycaster();
  },

  /* ---- requests from input ---- */
  toggleHolster() {
    if (SIT.owns()) return;
    if (this.state === 'holster') this.startDraw();
    else if (this.state === 'drawn' || this.state === 'reload') { this.state = 'holstering'; this.t = 0; this.reload = null; this.wantAim = false; }
  },
  startDraw() { if (this.state === 'holster') { this.state = 'draw'; this.t = 0; } },
  setAim(on) {
    if (on && SIT.busy()) return;
    this.wantAim = on;
    if (on) {
      if (this.state === 'holster') this.startDraw();
      if (this.reload && this.ammo > 0) this.reload.stop = true;
      if (this.camW < 0.05) PLAY.aimPitch = clamp(PLAY.camPitch - 0.25, -0.3, 0.55);
    }
  },
  pressFire() {
    if (SIT.busy()) return;
    if (this.state === 'holster') { this.startDraw(); return; }
    if (this.state === 'holstering') return;
    if (this.reload) { if (this.ammo > 0) this.reload.stop = true; else return; }
    this.fireQ = true;
    if (this.aimW < 0.6) { this.hipT = 0.9; if (this.camW < 0.05) PLAY.aimPitch = clamp(PLAY.camPitch - 0.25, -0.3, 0.55); }
  },
  pressReload() {
    if (SIT.busy()) return;
    if (this.state !== 'drawn' || this.reload || this.ammo >= 6 || this.reserve <= 0) return;
    this.state = 'reload'; this.reload = { t: 0, phase: 'open', n: 0, stop: false };
    GSFX.gate();
  },
  aiming() { return this.aimW > 0.05 || this.hipT > 0; },

  /* ---- per frame, before the player moves ---- */
  update(dt) {
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
    this.hipT = Math.max(0, this.hipT - dt);
    if (this.state === 'draw') {
      if (!this.inHand && this.t > 0.17) { this.inHand = true; GSFX.leather(); }
      if (this.t > 0.42) this.state = 'drawn';
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
    } else if (R.phase === 'close' && R.t > 0.26) { GSFX.gate(); this.reload = null; this.state = 'drawn'; }
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
    // touch: aim assist pulls the crosshair gently onto a bottle
    if (this.touch && this.camW > 0.6) {
      const b = this.bestBottle(0.1, 35);
      if (b) {
        const u = b.dir;
        const ty = Math.atan2(-u.x, -u.z), tp = -Math.asin(clamp(u.y, -1, 1));
        const k = 1 - Math.exp(-dt * 3.5 * (1 - b.ang / 0.1));
        PLAY.camYaw += wrapA(ty - PLAY.camYaw) * k; PLAY.aimPitch += (tp - PLAY.aimPitch) * k;
      }
    }
    // spread: wide from the hip or on the move; holding a steady aim tightens it further over a second
    const moveS = Math.hypot(PLAY.vx, PLAY.vz);
    if (this.camW > 0.8 && moveS < 0.3 && this.wantAim) this.steady = Math.min(1, this.steady + dt * 1.1);
    else this.steady = Math.max(0, this.steady - dt * 3);
    const base = lerp(0.035, lerp(0.006, 0.0012, smoothstep(0, 1, this.steady)), this.aimW) + moveS * 0.012;
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
    return best;
  },
  fire() {
    if (this.ammo <= 0) { GSFX.dry(); this.cool = 0.3; return; }
    this.ammo--; this.cool = 0.42;
    const cam = G.cam, dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    if (this.touch) { const b = this.bestBottle(this.camW > 0.9 ? 0.07 : 0.3, 35); if (b) dir.copy(b.dir); }
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
    this.steady *= 0.35;
    if (this.touch && navigator.vibrate) { try { navigator.vibrate(22); } catch (e) { /* ignore */ } }
    GSFX.shot(!!G.room);
    setTimeout(() => GSFX.cock(), 260);
    worldEvent('shot', mz.x, mz.y, mz.z, { by: 'player', room: G.room ? G.room.type : null });
    if (!hit) return;
    if (hit.bottle) {
      shatterBottle(hit.bottle, dir);
    } else if (hit.dummy) {
      DUMMY.shot(hit.point, dir);
    } else {
      const S = FX.impact(hit.hit, dir);
      GSFX.impact(hit.point, S.kind || (S.splinter ? 'wood' : 'dirt'));
      worldEvent('impact', hit.point.x, hit.point.y, hit.point.z, { by: 'player', surface: S.kind });
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
    const objs = W.worldMeshes.slice();
    for (const R of ROOMS) if (R.mesh && R.mesh.visible) objs.push(R.mesh);
    for (const D of DOORS) for (const m of D.meshes) objs.push(m);
    this.ray.set(o, d); this.ray.near = near; this.ray.far = best ? best.t : far;
    const hits = this.ray.intersectObjects(objs, false);
    if (hits.length && !(best && best.t <= hits[0].distance)) return { t: hits[0].distance, point: hits[0].point.clone(), bottle: null, hit: hits[0] };
    return best;
  },
  hud() {
    const xh = HUD.$('xhair');
    const show = this.camW > 0.5 ? 1 : this.state === 'drawn' && !this.reload ? 0 : 0;
    xh.style.opacity = String(clamp((this.camW - 0.3) / 0.5, 0, 1) * show);
    xh.style.setProperty('--gap', (2.5 + this.spread * 190).toFixed(1) + 'px');
    xh.classList.toggle('steady', this.steady > 0.85);
    const key = this.ammo + '/' + this.reserve + '/' + (this.state === 'holster') + '/' + !!this.reload;
    if (key !== this.lastHudKey) {
      this.lastHudKey = key;
      const cs = HUD.$('cyl').querySelectorAll('circle.ch');
      cs.forEach((c, i) => c.classList.toggle('full', i < this.ammo));
      HUD.$('reserve').textContent = String(this.reserve);
      HUD.$('ammo').classList.toggle('dim', this.state === 'holster');
      HUD.$('ammo').classList.toggle('loading', !!this.reload);
      HUD.$('bReload').disabled = this.ammo >= 6 || this.reserve <= 0;
      HUD.$('bHolster').textContent = this.state === 'holster' ? 'Ziehen' : 'Holster';
      HUD.$('bFire').textContent = this.state === 'holster' ? 'Schlag' : 'Feuer';
    }
    HUD.$('bAim').setAttribute('aria-pressed', this.wantAim ? 'true' : 'false');
  }
};

/* ---------- gun sounds: recordings for the shot, the empty click and glass, the small mechanical noises synthesised ---------- */
const GSFX = {
  buf: {}, loading: false,
  ok() { if (SFX.ready() && !this.loading) this.load(); return SFX.ready(); },
  // decode the embedded recordings once audio is running, cutting the MP3's leading silence
  load() {
    this.loading = true;
    for (const k of Object.keys(SND_DATA)) {
      try {
        const b64 = SND_DATA[k].split(',')[1], bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const done = (ab) => {
          const d = ab.getChannelData(0); let s0 = 0;
          while (s0 < d.length && Math.abs(d[s0]) < 0.01) s0++;
          s0 = Math.max(0, s0 - 32);
          const out = SFX.ctx.createBuffer(1, d.length - s0, ab.sampleRate);
          out.getChannelData(0).set(d.subarray(s0));
          this.buf[k] = out;
        };
        const r = SFX.ctx.decodeAudioData(u.buffer, done, () => {});
        if (r && r.catch) r.catch(() => {});
      } catch (e) { /* the synthesised fallback stays */ }
    }
  },
  out(gain, pos) {
    const c = SFX.ctx, g = c.createGain();
    let k = 1, delay = 0;
    if (pos) { const d = Math.hypot(pos.x - PLAY.pos.x, pos.y - PLAY.pos.y, pos.z - PLAY.pos.z); k = 1 / (1 + d * 0.12); delay = d / 343; }
    g.gain.value = gain * k; g.connect(SFX.master);
    if (typeof AMB !== 'undefined' && AMB.stepIn) g.connect(AMB.stepIn);
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* ignore */ } }, 3000);
    return { g, t: c.currentTime + 0.004 + delay };
  },
  play(name, dest, t, rate, gain) {
    const b = this.buf[name]; if (!b) return null;
    const c = SFX.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; src.playbackRate.value = rate || 1; g.gain.value = gain;
    src.connect(g); g.connect(dest); src.start(t);
    return g;
  },
  run(fn) { if (!this.ok()) return; try { fn(); } catch (e) { /* never let audio stop the game */ } },
  shot(indoor) {
    this.run(() => {
      const { g, t } = this.out(0.95);
      const rate = 0.95 + Math.random() * 0.08;
      const rec = this.play('shot', g, t, rate, 1);
      if (rec && indoor) {
        // inside, the long outdoor echo of the recording is cut and the room's own reverb takes over
        rec.gain.setValueAtTime(1, t + 0.2); rec.gain.exponentialRampToValueAtTime(0.02, t + 0.45);
      }
      if (!rec) {
        SFX.noiseHit(t, g, { type: 'highpass', freq: 1400, q: 0.5, gain: 0.95, attack: 0.0008, decay: 0.05 });
        SFX.noiseHit(t, g, { type: 'lowpass', freq: 1200, q: 0.4, gain: 0.85, attack: 0.002, decay: 0.3 });
      }
      // a short low punch under the recording, felt more than heard
      SFX.thump(t, g, 95, 38, 0.55, 0.16);
    });
  },
  cock() { this.run(() => { const { g, t } = this.out(0.5); for (const dt of [0, 0.055]) SFX.noiseHit(t + dt, g, { type: 'highpass', freq: 3400, q: 0.7, gain: 0.3, attack: 0.0008, decay: 0.012 }); SFX.thump(t + 0.055, g, 900, 500, 0.05, 0.02); }); },
  dry() { this.run(() => { const { g, t } = this.out(0.6); if (!this.play('dry', g, t, 1, 1)) SFX.noiseHit(t, g, { freq: 2200, q: 3, gain: 0.35, attack: 0.0008, decay: 0.02 }); }); },
  gate() { this.run(() => { const { g, t } = this.out(0.45); SFX.noiseHit(t, g, { type: 'highpass', freq: 2600, q: 0.8, gain: 0.25, attack: 0.001, decay: 0.016 }); }); },
  round() {
    this.run(() => {
      const { g, t } = this.out(0.45);
      SFX.noiseHit(t, g, { freq: 3000, q: 6, gain: 0.2, attack: 0.001, decay: 0.04 });
      const o = SFX.ctx.createOscillator(), og = SFX.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 4100 + Math.random() * 400; o.connect(og); og.connect(g);
      SFX.env(og, t + 0.004, 0.035, 0.001, 0.06); o.start(t); o.stop(t + 0.1);
    });
  },
  leather() { this.run(() => { const { g, t } = this.out(0.5); SFX.noiseHit(t, g, { freq: 760, q: 0.8, gain: 0.22, attack: 0.03, decay: 0.12 }); SFX.noiseHit(t + 0.12, g, { type: 'highpass', freq: 3000, q: 0.7, gain: 0.12, attack: 0.001, decay: 0.012 }); }); },
  box() { this.run(() => { const { g, t } = this.out(0.4); for (let i = 0; i < 4; i++) SFX.noiseHit(t + i * 0.05, g, { freq: 2600 + i * 300, q: 5, gain: 0.15, attack: 0.001, decay: 0.03 }); }); },
  glass(p, big) {
    this.run(() => {
      const { g, t } = this.out(big ? 0.7 : 0.35, p);
      if (!this.play('glass', g, t, big ? 0.95 + Math.random() * 0.15 : 1.4, 1)) SFX.noiseHit(t, g, { type: 'highpass', freq: 2800, q: 0.6, gain: 0.55, attack: 0.001, decay: 0.2 });
    });
  },
  ping(g, t, f, gain, decay) {
    const o = SFX.ctx.createOscillator(), og = SFX.ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(og); og.connect(g);
    SFX.env(og, t, gain, 0.001, decay); o.start(t); o.stop(t + decay + 0.05);
  },
  ricochet(g, t) {
    const o = SFX.ctx.createOscillator(), og = SFX.ctx.createGain(), f0 = 2600 + Math.random() * 1200;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.42);
    o.connect(og); og.connect(g); SFX.env(og, t, 0.06, 0.01, 0.42); o.start(t); o.stop(t + 0.5);
  },
  // what the bullet hit decides what you hear
  impact(p, kind) {
    this.run(() => {
      const { g, t } = this.out(0.6, p);
      switch (kind) {
        case 'wood': SFX.thump(t, g, 260, 110, 0.35, 0.07); SFX.noiseHit(t, g, { freq: 1000, q: 1.6, gain: 0.35, attack: 0.001, decay: 0.06 }); SFX.noiseHit(t + 0.004, g, { type: 'highpass', freq: 3200, q: 0.7, gain: 0.15, attack: 0.001, decay: 0.01 }); break;
        case 'plaster': case 'brick': case 'stone':
          SFX.noiseHit(t, g, { type: 'highpass', freq: 1900, q: 0.6, gain: 0.35, attack: 0.001, decay: 0.045 });
          SFX.noiseHit(t, g, { freq: 650, q: 1, gain: 0.3, attack: 0.001, decay: 0.05 });
          for (let i = 0; i < 4; i++) SFX.noiseHit(t + 0.02 + Math.random() * 0.12, g, { freq: 2500 + Math.random() * 3000, q: 1.5, gain: 0.06, attack: 0.001, decay: 0.01 });
          if (kind === 'stone' && Math.random() < 0.45) this.ricochet(g, t + 0.01);
          break;
        case 'metal': SFX.noiseHit(t, g, { type: 'highpass', freq: 2500, q: 0.7, gain: 0.3, attack: 0.0005, decay: 0.02 }); for (const f of [1750, 2930, 4120]) this.ping(g, t, f * (0.95 + Math.random() * 0.1), 0.05, 0.2 + Math.random() * 0.2); if (Math.random() < 0.6) this.ricochet(g, t + 0.01); break;
        case 'glass': this.glass(p, false); break;
        case 'cloth': SFX.noiseHit(t, g, { freq: 420, q: 0.8, gain: 0.25, attack: 0.001, decay: 0.04 }); break;
        default: SFX.noiseHit(t, g, { type: 'lowpass', freq: 700, q: 0.6, gain: 0.45, attack: 0.001, decay: 0.1 }); SFX.thump(t, g, 140, 60, 0.25, 0.07);
      }
    });
  }
};
