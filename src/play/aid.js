/* ---------- first aid: you kneel by someone who bleeds and do what you can ----------
   Close to a person with an open gunshot (lying, sitting on the floor, or standing still and letting you), two things:
     "Wunde abdrücken": both hands on the wound that bleeds most, as long as you stay (E again or walking off lets go).
        It nearly stops the bleeding while you press; a vein closes for good after a few seconds of it.
     "Verbinden": with Verbandszeug from your bag (the doctor sells it) a field dressing: two turns of cloth and a
        knot; a torn artery in an arm or leg is tied off above it. It stops most of the bleeding, but it heals no
        faster: the bullet is still in there, and he still needs the doctor (and goes to him).
   The person feels it (npc.onHarm({type: 'aid'})) and remembers it, whoever shot him. Your hands are bloody after. */
const AID = {
  st: null, npc: null, w: null, mode: null, t: 0, wrapT: 0, pressT: 0, spot: new THREE.Vector3(), from: new THREE.Vector3(), yaw: 0,
  WRAP: 6, _v: new THREE.Vector3(), _w: new THREE.Vector3(), _q: new THREE.Vector3(), _h: [new THREE.Vector3(), new THREE.Vector3()],
  owns() { return !!this.st; },
  busy() { return !!this.st; },
  init() {
    const it = this.entry = { x: 0, y: 0, z: 0, room: null, occ: null, verb: 'aid', kind: 'aid', id: 'aid', fx: 0, fz: 1, sx: 0, sz: 0 };
    it.score = (p) => {
      const N = this.patient(p); if (!N) return 1e9;
      it.npc = N; it.room = N.room || null; it.x = N.pos.x; it.y = N.pos.y; it.z = N.pos.z; it.sx = N.pos.x; it.sz = N.pos.z;
      return Math.hypot(N.pos.x - p.x, N.pos.z - p.z) + 0.2;
    };
    it.actions = () => {
      const N = it.npc, out = [{ label: 'Wunde abdrücken', run: () => this.begin(N, 'press') }];
      if (INV.has('bandage')) out.push({ label: 'Verbinden (Verbandszeug)', run: () => this.begin(N, 'wrap') });
      return out;
    };
    INTERACT.wide.push(it);
  },
  // who near p needs help with a wound and lets you: alive, an open gunshot, not fighting; on his feet only when still
  patient(p) {
    if (GUN.state !== 'holster' || FALL.busy() || SIT.busy() || PHP.out) return null;
    let best = null, bd = 1.7;
    for (const N of NPCS.list) {
      const H = N.hp;
      if (H.dead || (N.fight && N.fight.on) || (N.room || null) !== (ROOMSTATE.cur || null)) continue;
      if (!H.wounds.some((w) => w.kind === 'shot' && !w.bandaged && !w.field && w.heal < 0.5 && w.part)) continue;
      if (!H.anim && (N.speed > 0.2 || (N.attitude && N.attitude() < -0.6))) continue;
      const d = Math.hypot(N.pos.x - p.x, N.pos.z - p.z);
      if (d < bd) { bd = d; best = N; }
    }
    return best;
  },
  // the wound to see to: the one that bleeds most (else any open gunshot)
  woundOf(N, field) {
    const H = N.hp, open = H.wounds.filter((w) => w.kind === 'shot' && !w.bandaged && w.heal < 0.5 && w.part && w.lp && !(field && w.field));
    open.sort((a, b) => (b.b || 0) * H.bleedFactor(b) + (b.art ? 0.01 : 0) - ((a.b || 0) * H.bleedFactor(a) + (a.art ? 0.01 : 0)));
    return open[0] || null;
  },
  begin(N, mode) {
    const w = this.woundOf(N, mode === 'wrap');
    if (!w) { TOAST.show('Da gibt es nichts mehr zu verbinden.'); return; }
    if (this.st && this.npc === N) { this.mode = mode; this.w = w; this.wrapT = 0; if (mode === 'wrap') FOLEY.cloth(PLAY.pos, 1.2); return; }
    this.npc = N; this.w = w; this.mode = mode; this.st = 'go'; this.t = 0; this.wrapT = 0; this.pressT = 0;
    this.from.copy(PLAY.pos); this.yaw0 = PLAY.yaw;
    // where to kneel: a spot by the wound that is clear of his body (all his parts) and of walls, the nearest to you
    const p = N.hp.woundPoint(w, this._v) || this._v.copy(N.pos), body = [];
    for (const k of ['torso', 'head', 'pelvis', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']) if (N.ch.p[k]) body.push(N.ch.p[k].getWorldPosition(new THREE.Vector3()));
    let best = null, bs = -1e9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, x = p.x + Math.sin(a) * 0.72, z = p.z + Math.cos(a) * 0.72;
      if (HARM.blockedAt(x, z, N.pos.y, 0.2)) continue;
      let clear = 9; body.forEach((b, j) => { clear = Math.min(clear, Math.hypot(x - b.x, z - b.z) - (j === 1 ? 0.25 : 0)); });   // (his head most of all)
      const sc = Math.min(clear, 0.6) * 4 - Math.hypot(x - PLAY.pos.x, z - PLAY.pos.z) * 0.3;
      if (sc > bs) { bs = sc; best = [x, z]; }
    }
    this.spot.set(best ? best[0] : PLAY.pos.x, PLAY.pos.y, best ? best[1] : PLAY.pos.z);
    this.lying = !!N.hp.anim;
    if (!this.lying) N.stop(Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z));
    FOLEY.cloth(PLAY.pos, 1);
    if (N.onHarm) N.onHarm({ type: 'aid', mode, by: 'player', zone: w.zone });
  },
  end() {
    if (!this.st || this.st === 'up') return;
    this.st = 'up'; this.t = 0;
    if (this.touched) this.bloodyHands();
  },
  // the keys on offer while you are at it
  acts() {
    if (this.st === 'up' || this.st === 'go') return [];
    const out = [{ label: this.mode === 'wrap' ? 'Aufhören' : 'Loslassen', run: () => this.end() }];
    if (this.mode === 'press' && INV.has('bandage') && this.woundOf(this.npc, true)) out.push({ label: 'Verbinden (Verbandszeug)', run: () => this.begin(this.npc, 'wrap') });
    return out;
  },
  /* ---- per frame, from updatePlayer: the body of the player goes to the spot, down, and stays; true while it owns
     the player's movement ---- */
  drive(dt, mag) {
    if (!this.st) return false;
    const N = this.npc, p = PLAY.pos;
    this.t += dt;
    if (!N || N.hp.dead || !NPCS.list.includes(N) || (this.lying && !N.hp.anim) || (!this.lying && N.speed > 0.6)) { if (this.st !== 'up') this.end(); }
    if (this.st !== 'up' && this.st !== 'go' && mag > 0.35 && this.t > 0.6) this.end();
    const tgt = N && N.hp.woundPoint(this.w, this._v);
    if (tgt) this.yaw = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    if (this.st === 'go') {
      const u = Math.min(1, this.t / 0.45), e = u * u * (3 - 2 * u);
      p.x = lerp(this.from.x, this.spot.x, e); p.z = lerp(this.from.z, this.spot.z, e);
      PLAY.yaw = this.yaw0 + wrapA(this.yaw - this.yaw0) * e;
      if (u >= 1) { this.st = 'down'; this.t = 0; }
    } else if (this.st === 'down') { PLAY.yaw += wrapA(this.yaw - PLAY.yaw) * (1 - Math.exp(-dt * 8)); if (this.t > 0.45) { this.st = 'work'; this.t = 0; } }
    else if (this.st === 'work') {
      PLAY.yaw += wrapA(this.yaw - PLAY.yaw) * (1 - Math.exp(-dt * 6));
      this.work(dt);
    } else if (this.st === 'up') { if (this.t > 0.5) { this.st = null; this.npc = null; this.w = null; } }
    p.y += (groundAt(p.x, p.z, p.y + 0.3) - p.y) * (1 - Math.exp(-dt * 18));
    PLAY.vx = PLAY.vz = 0; PLAY.speed = 0; PLAY.moving = false; PLAY.inYaw = null;
    W.ch.root.position.copy(p); W.ch.root.rotation.y = PLAY.yaw;
    return true;
  },
  work(dt) {
    const N = this.npc, H = N.hp, w = this.w;
    this.touched = true;
    if (!N.hp.anim) { N.stop(Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z)); N.lookAt(this._q.set(PLAY.pos.x, PLAY.pos.y + 1.0, PLAY.pos.z), 0.8); }
    // pressing: the bleeding all but stops while you hold; a vein closes after a while of it
    H.press(w, G.time + 0.25);
    this.pressT += dt;
    if (this.pressT > 8 && !w.art && !w.pressed) { w.pressed = true; w.b *= 0.35; }
    if ((this.groanT = (this.groanT || 1.5) - dt) <= 0) { this.groanT = 2.5 + Math.random() * 3; if (!H.out) FOLEY.grunt(N.pos, 1, 0.6); }
    if (this.mode === 'wrap') {
      this.wrapT += dt;
      if ((this.clothT = (this.clothT || 0) - dt) <= 0) { this.clothT = 0.7 + Math.random() * 0.4; FOLEY.cloth(PLAY.pos, 1.1); }
      if (this.wrapT >= this.WRAP) {
        if (!INV.remove('bandage')) { TOAST.show('Kein Verbandszeug mehr.'); this.mode = 'press'; return; }
        H.fieldDress(w); N.aidBy = 'player';
        TOAST.show(w.art && ZONES[w.zone].limb ? 'Abgebunden und verbunden. Er muss trotzdem zum Doc.' : 'Notdürftig verbunden. Er muss trotzdem zum Doc.', 'long');
        worldEvent('aid', N.pos.x, N.pos.y, N.pos.z, { by: 'player', npc: N.id, zone: w.zone, done: true });
        if (N.onHarm) N.onHarm({ type: 'aid', mode: 'done', by: 'player', zone: w.zone });
        // another open wound: on to it (pressing), else up
        const next = this.woundOf(N, true);
        if (next) { this.w = next; this.mode = 'press'; this.pressT = 0; } else this.end();
      }
    }
  },
  // where your hands go: onto the wound (pressing: down onto it in a slow rhythm; wrapping: round the part)
  handTargets() {
    const N = this.npc, w = this.w, H = N && N.hp, p = H && H.woundPoint(w, this._v, this._w);
    if (!p) return null;
    const n = this._w, t = this.wrapT * 5, k = this.mode === 'wrap' && this.st === 'work';
    const push = this.mode === 'press' ? Math.sin(this.t * 2.2) * 0.008 : 0;
    const right = this._q.set(Math.cos(PLAY.yaw), 0, -Math.sin(PLAY.yaw));
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1, h = this._h[i];
      h.copy(p).addScaledVector(n, 0.05 + push).addScaledVector(right, sd * (k ? 0.045 + Math.cos(t + i * Math.PI) * 0.06 : 0.03));
      if (k) h.y += Math.sin(t + i * Math.PI) * 0.05;
    }
    return this._h;
  },
  /* ---- the player's pose (char/gait.js hands it over while this owns the body): on one knee by a man on the floor,
     bent over one standing, both hands on the wound ---- */
  pose(P, dt) {
    const u = this.st === 'go' ? Math.min(1, this.t / 0.45) * 0.3 : this.st === 'down' ? 0.3 + Math.min(1, this.t / 0.45) * 0.7 : this.st === 'up' ? 1 - Math.min(1, this.t / 0.5) : 1;
    const e = u * u * (3 - 2 * u), low = this.lying ? 1 : 0.25;
    const K = FALL_KEYS.lunge, S = FALL_KEYS.stand, L = (a, b) => a + (b - a) * e * low;
    P.pel.set(L(S.pel[0], K.pel[0]), L(S.pel[1], K.pel[1]), L(S.pel[2], K.pel[2]));
    P.pelYaw = 0; P.pelRoll = 0; P.pelPitch = L(0, K.pp * 0.6); P.spYaw = 0; P.spRoll = 0;
    P.spPitch = 0.02 + e * (this.lying ? 0.38 : 0.3); P.hdPitch = e * 0.35; P.hdYaw = 0; P.hdRoll = 0;
    for (let i = 0; i < 2; i++) { P.ank[i].set(L(S.ank[i][0], K.ank[i][0]), L(S.ank[i][1], K.ank[i][1]), L(S.ank[i][2], K.ank[i][2])); P.ftPitch[i] = K.fp ? K.fp[i] * e * low : 0; P.ftYaw[i] = 0; }
    P.gunInHand = false;
    const T = this.st === 'work' || this.st === 'down' ? this.handTargets() : null;
    torsoInverse(P);
    for (let i = 0; i < 2; i++) {
      if (!T) { P.armOv[i] = null; continue; }
      // the hand target from the world into the character's frame
      const c = Math.cos(PLAY.yaw), s = Math.sin(PLAY.yaw), dx = T[i].x - PLAY.pos.x, dz = T[i].z - PLAY.pos.z;
      const loc = this._q.set(dx * c - dz * s, T[i].y - PLAY.pos.y, dx * s + dz * c);
      const r = armIK(i, loc, this._w.set(i === 0 ? 0.8 : -0.8, -0.6, -0.2));
      const wv = this.st === 'down' ? Math.min(1, this.t / 0.45) : 1;
      P.armOv[i] = { w: wv, sw: r.sw, yw: r.yw, out: r.out, el: r.el };
      P.hand[i].open = 0.85; P.hand[i].fist = 0;
    }
  },
  // red hands after it (gone after a while or once you wash: later)
  bloodyHands() {
    const ch = W.ch, mat = ch.mesh.material;
    for (const nm of ['handL', 'handR']) {
      const part = ch.p[nm]; if (!part || part.userData.blood) continue;
      const g = part.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const B = g.boundingBox, mb = new MB();
      mb.box((B.min.x + B.max.x) / 2, B.min.y - 0.002, (B.min.z + B.max.z) / 2, B.max.x - B.min.x + 0.006, (B.max.y - B.min.y) * 0.7 + 0.004, B.max.z - B.min.z + 0.006, rgb(0x5a0c08), 0);
      const m = new THREE.Mesh(mb.build(), mat); m.frustumCulled = false; part.add(m); part.userData.blood = { m, until: TIME.min + 90 };
    }
  },
  update() {
    const ch = W.ch; if (!ch) return;
    for (const nm of ['handL', 'handR']) {
      const part = ch.p[nm], b = part && part.userData.blood; if (!b) continue;
      if (b.m.material !== ch.mesh.material) b.m.material = ch.mesh.material;
      if (TIME.min > b.until) { part.remove(b.m); part.userData.blood = null; }
    }
  }
};
