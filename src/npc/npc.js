/* ---------- people ----------
   NPC: a body built from the same rig as the cowboy, with its own small locomotion (walks to a goal, faces a
   direction, steps with a simple cycle), a head that follows what it looks at, two hands that can be put
   anywhere with arm IK (to hold, pour, wipe), crouching and leaning. What the person DOES is decided by its
   behaviour (npc/barkeep.js …); the body only carries it out.
   SAY: speech bubbles over the head. NPCS.bodies: circles the player bumps into (see collide()). */
// what people say when you walk into them (ready-made: the sound is kept)
const BUMP = {
  LINES: {
    first: ['Pass doch auf.', 'He, langsam.', 'Vorsicht, Mister.', 'Augen auf, Fremder.', 'Na, na.'],
    second: ['Hast du keine Augen im Kopf?', 'Schon wieder? Was soll das?', 'Noch einmal, und es knallt.'],
    shove: ['Weg da!', 'Jetzt reicht’s!', 'Pfoten weg!'],
    fall: ['Bist du verrückt?!', 'Verdammt, was soll das?!', 'Pass doch auf, du Ochse!'],
    excuse: ['Lässt du mich mal durch?', 'Platz da, Fremder.', 'Darf ich mal?', 'Du stehst im Weg.']
  },
  last: {},
  pick(kind) { const L = this.LINES[kind]; let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === this.last[kind]) i = (i + 1) % L.length; this.last[kind] = i; return L[i]; }
};
const NPCS = {
  list: [], bodies: [], _v: new THREE.Vector3(),
  init(scene) { this.scene = scene; SAY.init(); BARKEEP.init(scene); DOC.init(scene); TALK.init(); onWorldEvent((e) => this.heard(e)); },
  update(dt) {
    BARKEEP.update(dt);
    DOC.update(dt);
    TALK.update(dt);
    CHAT.update(dt);
    for (const n of this.list) n.update(dt);
    HARM.update(dt);
    SAY.update(dt);
  },
  // the player's position seen from a room: is he in it?
  playerIn(R) { return G.room === R; },
  /* what everybody hears and sees: a bang makes them start (after the sound has reached them), a body hitting
     the floor or the bar draws the eyes. How loud: a shot carries across the town, glass breaking through the room */
  heard(e) {
    const loud = { shot: 1, npcShot2: 1, npcShot: 0.7, impact: 0.45, glass: 0.45, npcSlam: 0.6, npcDown: 0.5, npcDead: 0.5, punch: 0.25, npcPunch: 0.25, bump: 0.2 }[e.type];
    if (!loud) return;
    const R = e.room !== undefined && typeof e.room === 'string' ? ROOMS.find((r) => r.type === e.room) : roomAt(e.x, e.z, 0.05, e.y + 0.1);
    for (const n of this.list) {
      if (n.hp.dead || n.hp.out || n.id === e.npc || n.id === e.by) continue;
      const d = Math.hypot(n.pos.x - e.x, n.pos.z - e.z), same = (n.room || null) === (R || null);
      let k = loud * (same ? (d < 12 ? 1 : 0.7) : !n.room && !R ? clamp(1 - d / 70, 0, 1) : clamp(0.65 - d / 40, 0, 0.6));
      if (loud < 0.5 && (!same || d > 9)) k = 0;
      if (k < 0.08) continue;
      n.startle(e.x, e.y + 1, e.z, k, d / 340 + 0.08 + Math.random() * 0.14, e);
    }
  }
};

class NPC {
  constructor(o) {
    this.id = o.id; this.name = o.name; this.room = o.room || null;
    this.ch = buildCharacter(o.desc || o.colors, o.look);
    this.ch.pose.armOv = [null, null];
    this.mat = null;
    o.scene.add(this.ch.root);
    this.pos = o.pos.clone(); this.yaw = o.yaw || 0;
    this.goal = null; this.faceYaw = null; this.vx = 0; this.vz = 0; this.speed = 0; this.ph = 0; this.stepN = 0;
    // walking a little slower than you, running (hurry ≥ 2) nearly as fast as you (RUN, play/player.js)
    this.walkSpeed = o.walkSpeed || 1.4; this.runSpeed = o.runSpeed || RUN * 0.88;
    this.gait = makeGait(); this._lp = new THREE.Vector3();
    this.look = new THREE.Vector3(); this.lookW = 0; this.lookTW = 0; this.hdYaw = 0; this.hdPitch = 0; this.spYawL = 0;
    // what the behaviour asks of the body this frame (it sets targets, the body eases towards them)
    this.hand = [0, 1].map((i) => ({ w: 0, tw: 0, p: new THREE.Vector3(), pole: new THREE.Vector3(i ? -0.8 : 0.8, -0.5, -0.4), ov: { w: 0, sw: 0, yw: 0, out: 0, el: 0 }, cp: new THREE.Vector3(), cpOk: false }));
    this.gest = null; this.gestT = 0; this.gestEnd = null; this.gestTarget = null; this.gW = [0, 0]; this.gS = [null, null];
    this._ht = new THREE.Vector3(); this._hp = new THREE.Vector3(); this._gp = new THREE.Vector3(); this._gq = new THREE.Vector3(); this._hs = new THREE.Vector3();
    this.tw = 0; this.leanF = 0; this.lunge = 0; this.hurry = 1;
    this.handShape = [null, null];   // { fist, open, point } the behaviour wants for a hand (null: by what it holds)
    this.mood = 'neutral'; this.moodT = 0; this.fear = 0; this.attitude = o.attitude || null;
    this.lean = 0; this.leanT = 0; this.crouch = 0; this.crouchT = 0; this.talkT = 0; this.nod = 0;
    this.body = { cx: this.pos.x, cz: this.pos.z, r: 0.32, npc: this };
    NPCS.bodies.push(this.body);
    // the state of the body: wounds, falls, death (npc/harm.js)
    this.hp = new Vitals(this);
    const self = this;
    ACTORS.add({ id: this.id, kind: 'npc', pos: this.pos, get yaw() { return self.yaw; }, get room() { return self.room; } });
    NPCS.list.push(this);
    this.update(0);
  }
  // gone for good (a body taken away): out of the scene and out of every list
  dispose() {
    if (this.ch.root.parent) this.ch.root.parent.remove(this.ch.root);
    try { this.ch.mesh.geometry.dispose(); this.ch.mesh.skeleton.dispose(); } catch (e) { /* ignore */ }
    const i = NPCS.list.indexOf(this); if (i >= 0) NPCS.list.splice(i, 1);
    const j = NPCS.bodies.indexOf(this.body); if (j >= 0) NPCS.bodies.splice(j, 1);
    const a = ACTORS.list.findIndex((x) => x.id === this.id && x.kind === 'npc'); if (a >= 0) ACTORS.list.splice(a, 1);
    if (ACTORS.byId.get(this.id) && ACTORS.byId.get(this.id).kind === 'npc') ACTORS.byId.delete(this.id);
    if (this.sayEl && this.sayEl.parentNode) this.sayEl.parentNode.removeChild(this.sayEl);
    if (TALK.npc === this) TALK.close();
  }
  goTo(x, z, faceYaw, leg) {
    this.faceYaw = faceYaw === undefined ? null : faceYaw;
    if (!leg) { this.path = null; this.dest = null; this.legPass = false; }
    if (Math.hypot(x - this.pos.x, z - this.pos.z) < 0.05) { this.goal = null; return; }   // already there
    this.goal = (this.goal || new THREE.Vector3()).set(x, this.pos.y, z);
  }
  stop(faceYaw) { this.goal = null; this.path = null; this.dest = null; if (faceYaw !== undefined) this.faceYaw = faceYaw; }
  // walk anywhere: through the doors and round the bar (npc/nav.js), then to the spot, facing faceYaw at the end
  walkTo(x, z, faceYaw) {
    this.path = NAV.route(this.pos.x, this.pos.z, this.pos.y, x, z, groundAt(x, z, this.pos.y + 0.5));
    this.dest = [x, z, faceYaw === undefined ? null : faceYaw];
    this.nextLeg();
  }
  nextLeg() {
    if (this.path && this.path.length) { const p = this.path.shift(); this.legPass = true; this.goTo(p[0], p[1], undefined, true); }
    else if (this.dest) { const d = this.dest; this.dest = null; this.legPass = false; this.goTo(d[0], d[1], d[2] === null ? undefined : d[2], true); }
  }
  /* how bad it is for him (the survival instinct): 0 fine, 1 hurt (an open gunshot, lost blood), 2 down and bleeding,
     3 dying, 4 dead. From 2 on, nothing else matters to him: what he says and what the AI makes him say is about
     staying alive (npc/talk.js plightText, BARKEEP.say) */
  plight() {
    const H = this.hp;
    if (H.dead) return 4;
    if (H.dying > 0 || H.out || H.blood < BLOOD_FAINT || H.wounds.some((w) => w.art && !w.field && !w.bandaged && w.b && !H.dead && (w.aidT || 0) < G.time)) return 3;
    if (H.anim && (H.bleed > 0.0004 || H.blood < BLOOD_WEAK || H.wounds.some((w) => w.gut && !w.bandaged))) return 2;
    if (H.blood < 0.8 || H.needsDoc()) return 1;
    return 0;
  }
  walking() { return !!(this.goal || (this.path && this.path.length) || this.dest); }
  // how fast he goes: walking (hurry: a brisker walk), running from hurry 2 on; slower when hurt
  topSpeed() { const h = this.hurry || 1; return (h >= 2 ? this.runSpeed : this.walkSpeed * h) * this.hp.speedK(); }
  /* time lived without being watched (npc/sim.js): s seconds of walking along the way, no collisions, no steps,
     no pose; where he ends up, he is */
  ff(s) {
    const H = this.hp;
    if (H.canWalk() && !(this.waitFor && this.waitFor.t > G.time)) {
      let left = this.topSpeed() * s;
      for (let k = 0; k < 24 && left > 1e-4; k++) {
        if (!this.goal) { if ((this.path && this.path.length) || this.dest) this.nextLeg(); if (!this.goal) break; }
        const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d > 1e-4) this.yaw = Math.atan2(dx, dz);
        if (d <= left) { this.pos.x = this.goal.x; this.pos.z = this.goal.z; left -= d; this.goal = null; if (this.legPass) this.nextLeg(); }
        else { this.pos.x += dx / d * left; this.pos.z += dz / d * left; left = 0; }
      }
      if (!this.walking() && this.faceYaw !== null) this.yaw = this.faceYaw;
    }
    this.vx = this.vz = 0; this.speed = 0;
    this.pos.y = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.room = roomAt(this.pos.x, this.pos.z, 0.05, this.pos.y + 0.1); this.roomT = 0.2;
    this.body.cx = this.pos.x; this.body.cz = this.pos.z;
    H.lowness = H.anim ? H.anim.pose(this.ch.pose) : 0;
  }
  arrived() { return !this.goal && this.speed < 0.15; }
  facing(tol) { return this.faceYaw === null || Math.abs(wrapA(this.faceYaw - this.yaw)) < (tol || 0.15); }
  lookAt(v, w) { this.look.copy(v); this.lookTW = w === undefined ? 1 : w; }
  // say something out loud: the bubble and the voice
  // he speaks only where you can hear him: in his room (or near him outdoors)
  canBeHeard() { if (G.abstract || (this.hp && (this.hp.dead || this.hp.out))) return false; return this.room ? G.room === this.room : !G.room && Math.hypot(PLAY.pos.x - this.pos.x, PLAY.pos.z - this.pos.z) < 20; }
  // keep: a ready-made line (its sound is kept in the browser, so ElevenLabs is paid for it once)
  speak(text, dur, mood, keep) { this.mood = mood || 'neutral'; this.moodT = G.time + (dur || clamp(1 + text.length * 0.06, 2, 8)) + 2.5; if (!this.canBeHeard()) return false; SAY.show(this, text, dur); VOICE.line(this, text, mood, keep); return true; }
  /* a gesture (char/gesture.js GESTURES): name, what it points at (a world point, or null), held: until endGesture()
     (else as long as the gesture lasts). Not while fighting or down. */
  gesture(name, target, held) {
    if (!GESTURES[name] || (this.fight && this.fight.on) || this.hp.busy()) return;
    this.gest = name; this.gestT = 0; this.gestEnd = null; this.gestTarget = target || null; this.gestHeld = !!held;
  }
  endGesture() { if (this.gest && this.gestEnd === null) this.gestEnd = this.gestT; }
  /* he starts: a bang (k: how hard), after a moment (delay: the sound on its way, the nerves); the body jerks, the
     hands jump up, and for a few seconds the head stays turned to where it came from */
  startle(x, y, z, k, delay, e) {
    this.startleQ = { t: G.time + (delay || 0), x, y, z, k, e };
  }
  doStartle(S) {
    const H = this.hp;
    this.alertP = (this.alertP || new THREE.Vector3()).set(S.x, S.y, S.z); this.alertT = G.time + 2 + S.k * 3;
    this.fear = Math.max(this.fear || 0, G.time + 0.8 + S.k * 1.5);
    if (H.busy()) { if (H.anim && !H.dead) { H.flinch.k = Math.max(H.flinch.k, 0.4 * S.k); } return; }
    if (this.fight && this.fight.on) return;
    const close = Math.hypot(S.x - this.pos.x, S.z - this.pos.z) < 4.5;
    if (S.k > 0.35 && !this.talking) this.gesture(close && S.k > 0.8 ? 'cower' : 'flinch');
    // a jerk away from it, a half step back when it was close
    const dx = this.pos.x - S.x, dz = this.pos.z - S.z, d = Math.hypot(dx, dz) || 1;
    H.flinch.yaw = clamp(-((dx / d) * Math.cos(this.yaw) - (dz / d) * Math.sin(this.yaw)) * 0.6, -0.6, 0.6) * S.k; H.flinch.pitch = -0.25 * S.k; H.flinch.roll = 0; H.flinch.head = 1; H.flinch.k = Math.max(H.flinch.k, S.k); H.flinch.punch = true;
    if (close && !this.goal) { this.vx += dx / d * 0.9 * S.k; this.vz += dz / d * 0.9 * S.k; }
    if (S.k > 0.5) FOLEY.grunt(this.pos, 1.15, 0.35 * S.k);
    if (this.onStartle) this.onStartle(S);
  }
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
    const H = this.hp;
    H.update(dt);
    const can = H.canWalk();
    // waiting for someone who comes to him (the doctor): standing, facing him, the way kept for later
    const hold = this.waitFor && this.waitFor.t > G.time && !this.waitFor.by.hp.dead;
    if (hold) { const B = this.waitFor.by; this.faceHold = Math.atan2(B.pos.x - this.pos.x, B.pos.z - this.pos.z); }
    // walking: towards the goal, slowing down on arrival (slower when hurt; not at all while down)
    let tx = 0, tz = 0;
    if (!this.goal && can && !hold && ((this.path && this.path.length) || this.dest)) this.nextLeg();
    if (this.goal && can && !hold) {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < (this.legPass ? 0.35 : 0.04)) { this.goal = null; if (this.legPass) this.nextLeg(); }
      else { const top = this.topSpeed(), v = this.legPass ? top : Math.min(top, d * 2.4 + 0.15); tx = (dx / d) * v; tz = (dz / d) * v; }
    }
    const a = 1 - Math.exp(-dt * (can ? 7 : 3.5));
    this.vx += (tx - this.vx) * a; this.vz += (tz - this.vz) * a;
    let nx = this.pos.x + this.vx * dt, nz = this.pos.z + this.vz * dt;
    // walls, furniture and the player stop him like they stop the player
    if (this.solid !== false) {
      [nx, nz] = collide(nx, nz, this.pos.y + 0.1, this.body, 0.28);
      const px = nx - PLAY.pos.x, pz = nz - PLAY.pos.z, pd = Math.hypot(px, pz);
      if (pd < 0.6 && pd > 1e-4 && !H.down() && Math.abs(PLAY.pos.y - this.pos.y) < 1) {
        nx = PLAY.pos.x + (px / pd) * 0.6; nz = PLAY.pos.z + (pz / pd) * 0.6;
        // you walked into him: how hard (your speed towards him)
        const toward = (PLAY.vx * px + PLAY.vz * pz) / pd;
        if (toward > 0.8 && G.time - (this.bumpT || -9) > 1.0 && !H.busy() && !FALL.busy() && !SIT.busy()) this.bumped(toward, px / pd, pz / pd);
      }
      // he walks into you (you stand in his way): a moment, then he asks you to move and steps round you
      if (this.goal && pd < 0.85 && !H.busy()) {
        const gx = this.goal.x - this.pos.x, gz = this.goal.z - this.pos.z, gl = Math.hypot(gx, gz) || 1;
        if ((-px * gx - pz * gz) / (pd * gl) > 0.5) {
          this.blockT = (this.blockT || 0) + dt;
          if (this.blockT > 1.0) {
            const sd = (gx * pz - gz * px) > 0 ? 1 : -1; this.vx += (-gz / gl) * sd * 1.6; this.vz += (gx / gl) * sd * 1.6;
            if (G.time - (this.excuseT || -99) > 20) { this.excuseT = G.time; this.lookAt(this._hs.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1); if (this.onBump) this.onBump({ excuse: true }); else this.speak(BUMP.pick('excuse'), undefined, 'neutral', true); }
            this.blockT = 0.4;
          }
        } else this.blockT = 0;
      } else this.blockT = 0;
    }
    if (dt > 0) { this.vx = (nx - this.pos.x) / dt * 0.5 + this.vx * 0.5; this.vz = (nz - this.pos.z) / dt * 0.5 + this.vz * 0.5; }
    this.pos.x = nx; this.pos.z = nz;
    // on the ground: the street, the porch, a floor (people who stay in their room keep its floor)
    const gy = groundAt(nx, nz, this.pos.y + 0.5);
    this.pos.y += (gy - this.pos.y) * (1 - Math.exp(-dt * 14));
    // which room he is in (he may walk out into the street and back)
    this.roomT = (this.roomT || 0) - dt;
    if (this.roomT <= 0) { this.roomT = 0.2; this.room = roomAt(this.pos.x, this.pos.z, 0.05, this.pos.y + 0.1); }
    this.speed = can ? Math.hypot(this.vx, this.vz) : 0;
    // facing: where it was told to face, else where it walks
    if (can) {
      const fy = hold ? this.faceHold : this.faceYaw !== null ? this.faceYaw : this.speed > 0.3 ? Math.atan2(this.vx, this.vz) : this.yaw;
      this.yaw += wrapA(fy - this.yaw) * (1 - Math.exp(-dt * 6));
    }
    // the behaviour's wishes, eased
    const e = 1 - Math.exp(-dt * 6);
    this.lean += (this.leanT - this.lean) * e; this.crouch += (this.crouchT - this.crouch) * (1 - Math.exp(-dt * 9));
    this.lookW += (this.lookTW - this.lookW) * e;
    for (const h of this.hand) h.w += (h.tw - h.w) * (1 - Math.exp(-dt * 7));
    this.talkT = Math.max(0, this.talkT - dt);
    if (this.startleQ && G.time >= this.startleQ.t) { const S = this.startleQ; this.startleQ = null; this.doStartle(S); }
    // others close by: a glance now and then (a hurt one: a longer look, and it shows on the face)
    if ((this.glanceT = (this.glanceT || 2 + Math.random() * 3) - dt) <= 0) {
      this.glanceT = 3 + Math.random() * 4;
      const o = NPCS.list.find((n) => n !== this && !n.hp.dead && (n.room || null) === (this.room || null) && Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z) < 5);
      if (o && !this.hp.busy() && this.lookTW < 0.6 && !this.talking) { this.glanceAt = o; this.glanceUntil = G.time + (o.plight() ? 3.5 : 1.4); if (o.plight() && !(this.fear > G.time) && G.time > (this.moodT || 0)) { this.mood = 'sad'; this.moodT = G.time + 3; } }
    }
    if (this.glanceAt && G.time < this.glanceUntil && this.lookTW < 0.6) { this.look.copy(this.glanceAt.ch.p.head.getWorldPosition(this._gq)); this.lookTW = 0.8; }
    // after a start: the eyes stay on where it came from (over whatever the behaviour wanted him to look at)
    if (this.alertT > G.time && !this.hp.busy()) { const u = clamp((this.alertT - G.time) / 1.2, 0, 1); this.look.lerp(this.alertP, u); this.lookTW = Math.max(this.lookTW, u); }
    this.updGesture(dt);
    if (this.shoveAt && G.time > this.shoveAt) this.shoveHit();
    this.body.cx = this.pos.x; this.body.cz = this.pos.z;
    // not to be seen (in a room you are not looking into, or far out): no pose, no face; only how low he is
    const seen = this.room ? !!this.room.mesh.visible : !G.cam || Math.hypot(this.pos.x - G.cam.position.x, this.pos.z - G.cam.position.z) < 90;
    if (!seen && !G.camHook) { this.ch.root.visible = false; this.hp.lowness = this.hp.anim ? this.hp.anim.pose(this.ch.pose) : 0; this.unseen = true; return; }
    this.unseen = false;
    this.pose(dt);
  }
  // gestures run out; standing about he finds something to do with his hands; talking, his hands go with the words
  updGesture(dt) {
    const def = this.gest && GESTURES[this.gest];
    if (def) {
      this.gestT += dt;
      if ((def.dur && this.gestT > def.dur) || (this.gestEnd !== null && this.gestT > this.gestEnd + GESTURE.OUT)) { this.gest = null; this.idleG = false; }
      else if ((this.fight && this.fight.on) || this.hp.busy()) this.gest = null;
      // an idle pose gives way to anything else the hands are asked to do, and to walking
      else if (this.idleG && (this.hand[0].tw > 0 || this.hand[1].tw > 0 || this.speed > 0.15 || this.talkT > 0 || G.time > this.idleUntil)) this.endGesture();
    }
    const busyHands = this.hand[0].tw > 0.05 || this.hand[1].tw > 0.05;
    this.stillT = this.speed < 0.08 && !busyHands && !this.talkT && !(this.fight && this.fight.on) ? (this.stillT || 0) + dt : 0;
    if (!this.gest && this.stillT > 4 && Math.random() < dt * 0.25 && !this.hp.busy()) {
      const pick = GESTURE.IDLE[Math.floor(Math.random() * GESTURE.IDLE.length)];
      this.gesture(pick, null, !GESTURES[pick].dur); this.idleG = true; this.idleUntil = G.time + 4 + Math.random() * 6; this.stillT = 0;
    }
    // beats on the loud words (not when the hands hold or do something)
    const talk = this.talkT > 0 ? FACE.talkOf(this) : 0;
    if (talk > 0.55 && talk - (this.talkPrev || 0) > 0.12 && !this.gest && !busyHands && G.time - (this.beatT || -9) > 1.1 && Math.random() < 0.6) {
      this.beatSide = Math.random() < 0.5 ? 0 : 1; this.beatT = G.time; this.gesture('beat');
    }
    this.talkPrev = talk;
  }
  /* bumped into: the body gives (a jolt, a step back, maybe a stumble or a fall when you came running), the head
     turns to you, and he says something; again and again and he gets rough (the behaviour decides via onBump) */
  bumped(v, dx, dz) {
    const H = this.hp;
    this.bumpN = G.time - (this.bumpT || -99) < 40 ? (this.bumpN || 0) + 1 : 1; this.bumpT = G.time;
    const dir = this._hs.set(dx, 0, dz);
    H.flinchBy(dir, 0.3 + v * 0.15, 'chest', '', true);
    this.vx += dx * v * 0.7; this.vz += dz * v * 0.7;
    // thrown off balance: a stagger, the arms go out to catch it (the harder, the more)
    this.stagT = G.time + 0.35 + Math.min(0.5, v * 0.1); this.stagK = clamp(v / 4, 0.25, 1); this.stagDir = [dx, dz];
    PLAY.vx *= 0.25; PLAY.vz *= 0.25; PHP.bump(dir, Math.min(1, v / 4));
    FOLEY.cloth(this.pos, 1.2); FOLEY.grunt(this.pos, 0.85, 0.5);
    this.lookAt(this._ht.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1);
    const fell = v > 4.2 && Math.random() < 0.55;
    if (fell) H.fall(Math.random() < 0.5 ? 'side' : 'back', dir, Math.random() < 0.5 ? 'L' : 'R', 1.2 + Math.random());
    worldEvent('bump', this.pos.x, this.pos.y, this.pos.z, { by: 'player', npc: this.id, v, fell, n: this.bumpN });
    const info = { n: this.bumpN, v, fell };
    if (this.onBump) this.onBump(info);
    else this.speak(BUMP.pick(fell ? 'fall' : this.bumpN >= 3 ? 'shove' : this.bumpN === 2 ? 'second' : 'first'), undefined, fell || this.bumpN > 1 ? 'angry' : 'neutral', true);
    if (!fell && this.bumpN >= 3) this.shove();
  }
  // a shove back: both hands at your chest, you stagger
  shove() {
    if (this.hp.busy()) return;
    this.gesture('shove'); this.shoveAt = G.time + 0.26;
  }
  shoveHit() {
    this.shoveAt = 0;
    if (this.hp.busy()) return;
    const dx = PLAY.pos.x - this.pos.x, dz = PLAY.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    if (d > 1.3) return;
    PLAY.vx += dx / d * 3.6; PLAY.vz += dz / d * 3.6; PHP.bump(this._hs.set(dx / d, 0, dz / d), 1);
    FOLEY.cloth(PLAY.pos, 1.4); FOLEY.grunt(this.pos, 0.8, 1);
    if (DRUNK.level > 0.3 && Math.random() < DRUNK.level) DRUNK.stumble(Math.atan2(dx, dz), true, 0.4);
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
  // his feet: the step sound and a little dust when he runs (only where you are)
  feet() {
    return this._feet || (this._feet = {
      noIdleLook: true,   // (he looks where his behaviour wants him to)
      land: (F, hard) => { if (this.gait.s > 0.25) this.footstep(); if (hard > 1.5 && !this.room && Math.hypot(this.pos.x - PLAY.pos.x, this.pos.z - PLAY.pos.z) < 25) DUST.burst(F.plant, F.yaw, hard * 0.6); },
      // a limp: the step over the bad leg comes quicker, the good one lingers
      rate: (g) => { const H = this.hp; if (H.limp <= 0.02) return 1; const bad = H.limpSide === 'L' ? 0 : 1, onBad = ((g.phase + bad * 0.5) % 1) < g.duty; return onBad ? 1 + H.limp * 0.9 : 1 - H.limp * 0.4; }
    });
  }
  pose(dt) {
    const P = this.ch.pose, t = G.time, g = this.gait;
    // the same gait as yours (char/gait.js): feet planted in the world, the body over them, walking or running.
    // Moved far in one go (put somewhere, got up from the floor): the feet start again where he stands
    if (this.hp.anim || this._lp.distanceToSquared(this.pos) > 1) g.init = false;
    this._lp.copy(this.pos);
    gaitStep(g, P, this.pos, this.yaw, this.speed > 0.02 ? this.vx : 0, this.speed > 0.02 ? this.vz : 0, dt, t, this.feet());
    // (the phase as an angle, for the limp and the hanging arm: 0 when the left foot is in the middle of its step)
    this.ph = TAU * (g.phase - g.duty / 2) + Math.PI;
    const cr = this.crouch, ln = this.lean;
    P.pel.y -= cr * 0.42; P.pel.z -= cr * 0.12 + ln * 0.05; P.pelPitch += cr * 0.25;
    P.spPitch += ln * 0.38 + cr * 0.35;
    if (cr) for (let i = 0; i < 2; i++) { const sd = i === 0 ? 1 : -1; P.ank[i].x += sd * cr * 0.06; P.ank[i].z -= cr * 0.05 * sd; }
    // the head (and a little of the chest) turns to what it looks at
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    let ty = 0, tp = 0;
    if (this.lookW > 0.01) {
      const hx = this.pos.x, hy = this.pos.y + 1.62 - cr * 0.42, hz = this.pos.z;
      const dx = this.look.x - hx, dy = this.look.y - hy, dz = this.look.z - hz;
      const qx = dx * c - dz * s, qz = dx * s + dz * c;
      ty = clamp(Math.atan2(qx, qz), -1.5, 1.5) * this.lookW; tp = clamp(-Math.atan2(dy, Math.hypot(qx, qz)), -0.5, 0.6) * this.lookW;
    }
    const k = 1 - Math.exp(-dt * 5);
    this.spYawL += (ty * 0.3 - this.spYawL) * k; this.hdYaw += (clamp(ty - ty * 0.3, -1, 1) - this.hdYaw) * k; this.hdPitch += (tp - this.hdPitch) * k;
    P.spYaw += this.spYawL;
    // a fighter's body: twisted into a punch, leaning in, the hips forward (npc/brawl.js)
    if (this.tw || this.leanF || this.lunge) { P.spYaw += this.tw || 0; P.pelYaw += (this.tw || 0) * 0.4; P.spPitch += this.leanF || 0; P.pel.z += this.lunge || 0; }
    // talking: small nods
    const talk = this.talkT > 0 ? Math.sin(t * 8.5) * 0.05 + Math.sin(t * 3.1) * 0.03 : 0;
    P.hdYaw += this.hdYaw; P.hdPitch += this.hdPitch - ln * 0.25 + talk + this.nod; P.hdRoll = 0;
    const gdef = this.gest && GESTURES[this.gest], genv = gdef ? GESTURE.env(gdef, this.gestT, this.gestEnd) : 0;
    if (gdef && gdef.head) gdef.head(this.gestT, P);
    P.hatDy = 0; P.hatTilt = 0; P.gunInHand = false;
    /* the arms, in layers: the walking swing; the hands put somewhere by the behaviour (reach); a gesture over that;
       wounds, falls and death last (hp.pose). Hands move to their targets (never jump) and stay out of the body. */
    let inv = false;
    const L = this.ch.look;
    for (let i = 0; i < 2; i++) {
      const h = this.hand[i], g = gdef && gdef.arm && genv > 0.001 ? gdef.arm(i, this.gestT, this) : null;
      const gw = g ? genv : 0, Wt = Math.max(h.w, gw);
      this.gW[i] = gw; this.gS[i] = g ? g.shape : null;
      P.wrist[i].x = g && g.wrist ? g.wrist.x * gw : 0; P.wrist[i].z = g && g.wrist ? g.wrist.z * gw : 0;
      if (Wt < 0.002) { P.armOv[i] = null; h.cpOk = false; continue; }
      if (!inv) { torsoInverse(P); inv = true; }
      const m = g && !gdef.raw && i === 0 ? -1 : 1, tgt = this._ht, pole = this._hp;
      if (g) { this._gp.set(g.p[0] * m, g.p[1], g.p[2]); if (g.pole) this._gq.set(g.pole[0] * m, g.pole[1], g.pole[2]); else this._gq.copy(h.pole); }
      if (h.w > 0.002) { tgt.copy(h.p); pole.copy(h.pole); if (g) { tgt.lerp(this._gp, gw); pole.lerp(this._gq, gw); } }
      else { tgt.copy(this._gp); pole.copy(this._gq); }
      if (!h.cpOk) { h.cp.copy(tgt); h.cpOk = true; } else h.cp.lerp(tgt, 1 - Math.exp(-dt * 12));
      const at = GESTURE.safe(this._hs.copy(h.cp), L.build.width, L.build.belly);
      const r = GESTURE.solveArm(i, at, pole, L.build.width, L.build.belly), o = h.ov;
      o.w = Wt; o.sw = r.sw; o.yw = r.yw; o.out = r.out; o.el = r.el; P.armOv[i] = o;
    }
    // the hands: holding something closes them, fighting makes fists; a gesture shapes them; a shape the behaviour asked for wins
    for (let i = 0; i < 2; i++) {
      const hs = P.hand[i], w = this.hand[i].w, want = this.handShape[i], gs = this.gS[i], gw = this.gW[i];
      hs.fist = 0.55 * w; hs.open = 0; hs.point = 0;
      if (this.fight && this.fight.on) hs.fist = 1;
      if (gs) { hs.fist = lerp(hs.fist, gs.fist || 0, gw); hs.open = lerp(hs.open, gs.open || 0, gw); hs.point = lerp(hs.point, gs.point || 0, gw); }
      if (want) { hs.fist = want.fist || 0; hs.open = want.open || 0; hs.point = want.point || 0; }
    }
    // staggering after a bump: arms out for balance, the body leaning back against it
    if (this.stagT > t && !this.hp.busy()) {
      const f = clamp((this.stagT - t) / 0.4, 0, 1) * this.stagK, sw = Math.sin(t * 13) * 0.25 * f;
      P.spPitch -= 0.12 * f; P.hdPitch -= 0.1 * f;
      for (let i = 0; i < 2; i++) { const o = P.armOv[i]; if (o && o.w > 0.5) continue; const a = P.arm[i]; a.out += 0.7 * f + (i ? sw : -sw); a.sw -= 0.25 * f; a.el += 0.3 * f; }
    }
    // wounds, falls and death have the last word over the body
    this.hp.pose(P, dt);
    if (this.hp.anim) for (const hs of P.hand) { hs.fist = 0; hs.point = 0; hs.open = this.hp.dead ? 0.7 : 0.4; }
    if (this.hp.pleadW > 0.01) P.hand[1].open = Math.max(P.hand[1].open, this.hp.pleadW);
    applyPose(this.ch);
    FACE.update(this.ch, dt, FACE.npcWant(this));
    const root = this.ch.root;
    root.position.copy(this.pos); root.rotation.y = this.yaw;
    root.visible = !this.room || !!this.room.mesh.visible;
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
  hide(npc) { if (npc.sayEl) npc.sayEl.hidden = true; npc.sayT = 0; },
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
