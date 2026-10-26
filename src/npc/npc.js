/* ---------- people ----------
   NPC: a body built from the same rig as the cowboy, with its own small locomotion (walks to a goal, faces a
   direction, steps with a simple cycle), a head that follows what it looks at, two hands that can be put
   anywhere with arm IK (to hold, pour, wipe), crouching and leaning. What the person DOES is decided by its
   behaviour (npc/barkeep.js …); the body only carries it out.
   SAY: speech bubbles over the head. NPCS.bodies: circles the player bumps into (see collide()). */
const NPCS = {
  list: [], bodies: [], _v: new THREE.Vector3(),
  init(scene) { this.scene = scene; SAY.init(); BARKEEP.init(scene); TALK.init(); },
  update(dt) {
    BARKEEP.update(dt);
    TALK.update(dt);
    for (const n of this.list) n.update(dt);
    SAY.update(dt);
  },
  // the player's position seen from a room: is he in it?
  playerIn(R) { return G.room === R; }
};

class NPC {
  constructor(o) {
    this.id = o.id; this.name = o.name; this.room = o.room || null;
    this.ch = buildCharacter(o.colors, o.look);
    this.ch.pose.armOv = [null, null];
    this.mat = null;
    o.scene.add(this.ch.root);
    this.pos = o.pos.clone(); this.yaw = o.yaw || 0;
    this.goal = null; this.faceYaw = null; this.vx = 0; this.vz = 0; this.speed = 0; this.ph = 0; this.stepN = 0;
    this.walkSpeed = o.walkSpeed || 1.15;
    this.look = new THREE.Vector3(); this.lookW = 0; this.lookTW = 0; this.hdYaw = 0; this.hdPitch = 0; this.spYawL = 0;
    // what the behaviour asks of the body this frame (it sets targets, the body eases towards them)
    this.hand = [0, 1].map((i) => ({ w: 0, tw: 0, p: new THREE.Vector3(), pole: new THREE.Vector3(i ? -0.8 : 0.8, -0.5, -0.4), ov: { w: 0, sw: 0, yw: 0, out: 0, el: 0 } }));
    this.lean = 0; this.leanT = 0; this.crouch = 0; this.crouchT = 0; this.talkT = 0; this.nod = 0;
    this.body = { cx: this.pos.x, cz: this.pos.z, r: 0.32, npc: this };
    NPCS.bodies.push(this.body);
    const self = this;
    ACTORS.add({ id: this.id, kind: 'npc', pos: this.pos, get yaw() { return self.yaw; }, get room() { return self.room; } });
    NPCS.list.push(this);
    this.update(0);
  }
  goTo(x, z, faceYaw) {
    this.faceYaw = faceYaw === undefined ? null : faceYaw;
    if (Math.hypot(x - this.pos.x, z - this.pos.z) < 0.05) { this.goal = null; return; }   // already there
    this.goal = (this.goal || new THREE.Vector3()).set(x, this.pos.y, z);
  }
  stop(faceYaw) { this.goal = null; if (faceYaw !== undefined) this.faceYaw = faceYaw; }
  arrived() { return !this.goal && this.speed < 0.15; }
  facing(tol) { return this.faceYaw === null || Math.abs(wrapA(this.faceYaw - this.yaw)) < (tol || 0.15); }
  lookAt(v, w) { this.look.copy(v); this.lookTW = w === undefined ? 1 : w; }
  // say something out loud: the bubble and the voice
  speak(text, dur) { SAY.show(this, text, dur); VOICE.line(this, text); }
  // a short gesture: 'nod' | 'laugh' | 'shake_head' | 'point_door' (the behaviour may use the last for the arm)
  gesture(name) { this.gest = name; this.gestT = 0; }
  // put hand i at p (character space: +x his left, +y up, +z ahead), weight w
  reach(i, x, y, z, w) { const h = this.hand[i]; h.p.set(x, y, z); h.tw = w === undefined ? 1 : w; }
  free(i) { this.hand[i].tw = 0; }
  // where hand i is in the world (the fist), into out
  handWorld(i, out) {
    out.set(0, -0.3, 0.01).applyMatrix4(this.ch.p[i ? 'fArmR' : 'fArmL'].matrix).applyMatrix4(this.ch.root.matrixWorld);
    return out;
  }
  // a point in the world, given in this body's character space
  toWorld(x, y, z, out) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(this.pos.x + x * c + z * s, this.pos.y + y, this.pos.z - x * s + z * c);
  }
  toLocal(v, out) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), dx = v.x - this.pos.x, dz = v.z - this.pos.z;
    return out.set(dx * c - dz * s, v.y - this.pos.y, dx * s + dz * c);
  }
  update(dt) {
    // walking: towards the goal, slowing down on arrival
    let tx = 0, tz = 0;
    if (this.goal) {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.04) this.goal = null;
      else { const v = Math.min(this.walkSpeed, d * 2.4 + 0.15); tx = (dx / d) * v; tz = (dz / d) * v; }
    }
    const a = 1 - Math.exp(-dt * 7);
    this.vx += (tx - this.vx) * a; this.vz += (tz - this.vz) * a;
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
    this.speed = Math.hypot(this.vx, this.vz);
    // facing: where it was told to face, else where it walks
    const fy = this.faceYaw !== null ? this.faceYaw : this.speed > 0.3 ? Math.atan2(this.vx, this.vz) : this.yaw;
    this.yaw += wrapA(fy - this.yaw) * (1 - Math.exp(-dt * 6));
    this.ph += (this.speed * dt * TAU) / 1.15;
    const n = Math.floor(this.ph / Math.PI);
    if (n !== this.stepN) { this.stepN = n; if (this.speed > 0.25) this.footstep(); }
    // the behaviour's wishes, eased
    const e = 1 - Math.exp(-dt * 6);
    this.lean += (this.leanT - this.lean) * e; this.crouch += (this.crouchT - this.crouch) * (1 - Math.exp(-dt * 9));
    this.lookW += (this.lookTW - this.lookW) * e;
    for (const h of this.hand) h.w += (h.tw - h.w) * (1 - Math.exp(-dt * 7));
    this.talkT = Math.max(0, this.talkT - dt);
    if (this.gest) { this.gestT += dt; if (this.gestT > (this.gest === 'point_door' ? 1.8 : 1.2)) this.gest = null; }
    this.body.cx = this.pos.x; this.body.cz = this.pos.z;
    this.pose(dt);
  }
  footstep() {
    if (Math.hypot(this.pos.x - PLAY.pos.x, this.pos.z - PLAY.pos.z) > 18) return;
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.28, this.pos), p = 0.9 + Math.random() * 0.2;
      SFX.thump(t, g, 170 * p, 95 * p, 0.4, 0.09);
      SFX.noiseHit(t, g, { freq: 430 * p, q: 4, gain: 0.3, decay: 0.1 });
      SFX.noiseHit(t, g, { type: 'highpass', freq: 2600 * p, q: 0.7, gain: 0.12, decay: 0.015 });
    });
  }
  pose(dt) {
    const P = this.ch.pose, t = G.time, m = Math.min(1, this.speed / 0.5);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    // the way it walks, in its own frame (+x left, +z ahead)
    const lx = this.speed > 0.05 ? (this.vx * c - this.vz * s) / this.speed : 0, lz = this.speed > 0.05 ? (this.vx * s + this.vz * c) / this.speed : 0;
    const cr = this.crouch, ln = this.lean;
    P.pel.set(0, RIG.hipY - 0.02 - 0.025 * Math.abs(Math.sin(this.ph)) * m - cr * 0.42, -cr * 0.12 - ln * 0.05);
    P.pelYaw = 0; P.pelPitch = cr * 0.25; P.pelRoll = Math.sin(this.ph) * 0.03 * m;
    P.spPitch = 0.02 + Math.sin(t * 1.7) * 0.012 + ln * 0.38 + cr * 0.35; P.spRoll = 0;
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1, ph = this.ph + i * Math.PI;
      P.ank[i].set(sd * (0.12 + cr * 0.06) + lx * 0.2 * Math.sin(ph) * m, RIG.ankleH + 0.07 * Math.max(0, Math.cos(ph)) * m, lz * 0.2 * Math.sin(ph) * m + (cr ? -cr * 0.05 * sd : 0));
      P.ftYaw[i] = 0; P.ftPitch[i] = 0;
      const a = P.arm[i]; a.sw = -Math.sin(ph) * 0.3 * m * lz; a.out = 0.08 + 0.05 * m; a.el = 0.15 + 0.15 * m;
    }
    // the head (and a little of the chest) turns to what it looks at
    let ty = 0, tp = 0;
    if (this.lookW > 0.01) {
      const hx = this.pos.x, hy = this.pos.y + 1.62 - cr * 0.42, hz = this.pos.z;
      const dx = this.look.x - hx, dy = this.look.y - hy, dz = this.look.z - hz;
      const qx = dx * c - dz * s, qz = dx * s + dz * c;
      ty = clamp(Math.atan2(qx, qz), -1.5, 1.5) * this.lookW; tp = clamp(-Math.atan2(dy, Math.hypot(qx, qz)), -0.5, 0.6) * this.lookW;
    }
    const k = 1 - Math.exp(-dt * 5);
    this.spYawL += (ty * 0.3 - this.spYawL) * k; this.hdYaw += (clamp(ty - ty * 0.3, -1, 1) - this.hdYaw) * k; this.hdPitch += (tp - this.hdPitch) * k;
    P.spYaw = this.spYawL;
    // talking: small nods
    const talk = this.talkT > 0 ? Math.sin(t * 8.5) * 0.05 + Math.sin(t * 3.1) * 0.03 : 0;
    P.hdYaw = this.hdYaw; P.hdPitch = this.hdPitch - ln * 0.25 + talk + this.nod; P.hdRoll = 0;
    if (this.gest) {
      const g = this.gestT, f = Math.sin(Math.PI * Math.min(1, g / 1.2));
      if (this.gest === 'nod') P.hdPitch += Math.max(0, Math.sin(g * 9)) * 0.22 * f;
      else if (this.gest === 'shake_head') P.hdYaw += Math.sin(g * 11) * 0.32 * f;
      else if (this.gest === 'laugh') { P.hdPitch -= 0.28 * f; P.spPitch -= 0.1 * f; P.pel.y += Math.abs(Math.sin(g * 15)) * 0.012 * f; }
    }
    P.hatDy = 0; P.hatTilt = 0; P.gunInHand = false;
    // hands put somewhere: arm IK on top of the swing
    let inv = false;
    for (let i = 0; i < 2; i++) {
      const h = this.hand[i];
      if (h.w < 0.002) { P.armOv[i] = null; continue; }
      if (!inv) { torsoInverse(P); inv = true; }
      const r = armIK(i, h.p, h.pole), o = h.ov;
      o.w = h.w; o.sw = r.sw; o.yw = r.yw; o.out = r.out; o.el = r.el; P.armOv[i] = o;
    }
    applyPose(this.ch);
    const root = this.ch.root;
    root.position.copy(this.pos); root.rotation.y = this.yaw;
    root.visible = !this.room || this.room.mesh.visible;
    const mat = this.room ? this.room.figMat : G.litMat;
    if (mat !== this.mat) { this.mat = mat; for (const p of this.ch.parts) p.material = mat; }
    root.updateMatrixWorld(true);
  }
}

/* ---- speech bubbles ---- */
const SAY = {
  el: null, _v: new THREE.Vector3(),
  init() { this.el = document.getElementById('says'); },
  // npc says text; the bubble stays a time that fits its length
  show(npc, text, dur) {
    if (!npc.sayEl) { npc.sayEl = document.createElement('div'); npc.sayEl.className = 'say'; npc.sayEl.innerHTML = '<b></b><span></span>'; this.el.appendChild(npc.sayEl); }
    npc.sayEl.querySelector('b').textContent = npc.name;
    npc.sayEl.querySelector('span').textContent = text;
    npc.sayT = dur || clamp(1.8 + text.length * 0.055, 2.2, 9);
    npc.talkT = clamp(0.6 + text.length * 0.035, 0.6, 5);
    npc.sayEl.classList.remove('out'); npc.sayEl.hidden = false;
    npc.said = text;
  },
  update(dt) {
    const cam = G.cam, W0 = G.renderer.domElement.clientWidth, H0 = G.renderer.domElement.clientHeight;
    for (const n of NPCS.list) {
      if (!n.sayEl || n.sayEl.hidden) continue;
      n.sayT -= dt;
      if (n.sayT <= 0) { n.sayEl.hidden = true; continue; }
      const v = this._v.set(n.pos.x, n.pos.y + 2.1 - n.crouch * 0.45, n.pos.z).project(cam);
      const far = Math.hypot(n.pos.x - PLAY.pos.x, n.pos.z - PLAY.pos.z) > 16;
      const seen = v.z < 1 && Math.abs(v.x) < 1.1 && v.y < 1.1 && !far && n.ch.root.visible;
      n.sayEl.style.visibility = seen ? 'visible' : 'hidden';
      n.sayEl.style.transform = `translate(${((v.x + 1) / 2 * W0).toFixed(1)}px, ${((1 - v.y) / 2 * H0).toFixed(1)}px) translate(-50%, -100%)`;
      n.sayEl.classList.toggle('out', n.sayT < 0.4);
    }
  }
};
