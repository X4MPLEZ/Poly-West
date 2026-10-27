/* ---------- what comes of what you did to the barkeeper: revenge, death, the one who comes after ----------
   Revenge (grudge 0…1, grows with what you did, a gunshot wound keeps it from ever falling far):
     ≥ 0.5  no more drinks for you, cold words
     ≥ 0.55 when you come close and do not watch him, he goes for you with his fists ("Das ist für neulich!")
     ≥ 0.85 the shotgun from under the bar: "Raus. Sofort." Leave and he lets you go; come closer, draw, aim at him,
            or stay too long, and he fires (a warning into the ceiling first). A shotgun puts you down; you come to
            at the doctor's. Having paid you back, the grudge drops.
   Death is for good: the body lies where it fell until the undertaker comes (two hours later, unseen, or while you
   sleep); a fresh grave by the church. Then the next one of the crew (npc/crew.js) takes over; what he knows of it
   depends on what he saw (CREW.died / learnKiller). */
Object.assign(BARKEEP, {
  /* how a successor takes the stranger who killed the man before him (picked at random, weighted by the man):
     angry (no drink for you, cold words), afraid (serves you, shaking, wants you gone), fists, the shotgun, or
     friendly on the outside with poison in your next drink */
  TEMPERS: [
    { id: 'angry', w: 1, grudge: 0.52, att: -0.85, mem: 'Du bist wütend. Du schenkst dem Mörder nichts aus und sagst ihm, was du von ihm hältst; anfassen tust du ihn nicht.' },
    { id: 'afraid', w: 0.8, grudge: 0.15, att: -0.5, mem: 'Du hast Angst vor dem Mörder. Du bedienst ihn, damit er wieder geht, aber deine Hände zittern, und du sagst so wenig wie möglich.', need: (W) => 1.6 - W.fight.courage },
    { id: 'fists', w: 0.9, grudge: 0.62, att: -0.8, mem: 'Du willst es ihm mit den Fäusten heimzahlen, sobald er dir nahe kommt.', need: (W) => W.fight.courage + 0.2 },
    { id: 'shotgun', w: 0.7, grudge: 0.9, att: -0.95, mem: 'Unter der Theke liegt die Schrotflinte. Kommt der Mörder herein, jagst du ihn hinaus oder schießt.', need: (W) => W.fight.courage },
    { id: 'poison', w: 0.6, grudge: 0.3, att: 0.1, mem: 'Du hast beschlossen, dem Mörder heimlich Gift ins nächste Glas zu tun. Lass dir nichts anmerken: sei freundlich, fast herzlich, und biete ihm ruhig einen Drink an.' }
  ],
  // the lines of revenge
  REV_LINES: {
    revenge: [['Das ist für neulich!', 'angry'], ['Jetzt zahl ich’s dir heim!', 'angry'], ['Hast du gedacht, ich vergesse das?', 'angry']],
    gunUp: [['Raus. Sofort.', 'angry'], ['Keinen Schritt weiter. Raus hier.', 'angry'], ['Ich hab dir gesagt, du sollst nie wiederkommen.', 'angry']],
    gunWarn: [['Das war die letzte Warnung!', 'angry'], ['Die nächste geht nicht in die Decke!', 'angry']],
    gunDown: [['Und komm nie wieder.', 'disgusted'], ['Lass dich hier nie wieder blicken.', 'angry']],
    paid: [['Jetzt sind wir quitt.', 'disgusted'], ['Das hast du verdient.', 'angry']],
    successor: [['Du bist also der, der {n} umgebracht hat.', 'angry'], ['Ich weiß, wer du bist. Und was du getan hast.', 'angry'], ['{n} war mein {k}. Merk dir das.', 'angry']]
  },
  revPick(kind) {
    const L = this.REV_LINES[kind]; if (!L) return null;
    const x = L[Math.floor(Math.random() * L.length)], D = CREW.lastDead, n = D ? this.WHO[D.i].name : 'er';
    return { text: x[0].replace('{n}', n).replace('{k}', D ? CREW.kin(this.whoI, D.i) : 'Freund'), mood: x[1] };
  },
  revShout(kind) { const l = this.revPick(kind); if (!l || !this.npc.canBeHeard()) return; SAY.hide(this.npc); this.npc.speak(l.text, undefined, l.mood, true); },
  // the floor a grudge cannot fall under: what was done to his body
  grudgeFloor() { const N = this.npc; if (!N) return 0; return N.hp.wounds.some((w) => w.kind === 'shot') ? 0.55 : 0; },

  /* ---- revenge: called by update() while he is at his place, on his feet ---- */
  revenge(dt, inside, dP) {
    const N = this.npc;
    // grudges fade, a little each game day, never under the floor
    this.grudge = Math.max(this.grudgeFloor(), this.grudge - dt * TIME.RATE / 1440 * 0.15);
    if (!inside || N.hp.busy() || N.hp.blood < BLOOD_WEAK || PHP.out || FALL.busy()) return false;
    const W = this.who();
    // the shotgun: once you are in his saloon, after a few seconds' grace
    if (this.grudge >= 0.85 && this.st === 'idle' && W.fight.courage >= 0.5 && G.time - (this.gunDownT || -99) > 20) {
      this.inT = (this.inT || 0) + dt;
      if (this.inT > 1.5) { this.st = 'shotgun'; this.sg = { ph: 'draw', t: 0, shots: 0, warned: false }; this.abortServe(); return true; }
    } else this.inT = 0;
    // fists: you come close and do not have your gun on him
    if (this.grudge >= 0.55 && this.st === 'idle' && dP < 3 && GUN.state === 'holster' && G.time - (this.ambushT || -999) > 240 && W.fight.courage >= 0.4) {
      this.ambushT = G.time;
      this.abortServe(); this.st = 'brawl'; N.fight.start(); this.revShout('revenge');
      this.note('Du bist auf ihn losgegangen, aus Rache.');
      return true;
    }
    return false;
  },

  /* ---- the shotgun ---- */
  shotgunGeo() {
    const mb = new MB(), wood = rgb(0x6a4228), steel = rgb(0x3a3836);
    mb.box(0, -0.06, -0.32, 0.05, 0.1, 0.3, wood, 3);           // the stock
    mb.box(0, -0.03, -0.05, 0.05, 0.07, 0.22, wood, 3);         // the grip and forend
    for (const s of [-1, 1]) mb.push(new THREE.Matrix4().makeTranslation(s * 0.014, 0.0, 0.05).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))), mb.cyl(0, 0, 0, 0.015, 0.015, 0.62, 6, steel, 0), mb.pop();
    mb.box(0, -0.025, 0.2, 0.045, 0.03, 0.2, wood, 3);
    return mb.build();
  },
  updShotgun(dt, inside) {
    const N = this.npc, S = this.sg;
    S.t += dt;
    if (!this.props.shotgun) { const m = new THREE.Mesh(this.shotgunGeo(), G.litMat); m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false; this.scene0.add(m); this.props.shotgun = m; }
    for (const k of ['glass', 'bottle', 'rag']) this.props[k].visible = false;
    const P = PLAY.pos, dP = Math.hypot(P.x - N.pos.x, P.z - N.pos.z);
    N.stop(Math.atan2(P.x - N.pos.x, P.z - N.pos.z));
    N.lookAt(this._w.set(P.x, P.y + 1.5, P.z), 1);
    const lose = (why) => { this.props.shotgun.visible = false; this.st = 'idle'; this.sg = null; this.gunDownT = G.time; if (why) this.revShout(why); this.pickIdle(); };
    if (S.ph === 'draw') {
      // down under the counter and up with it
      const u = clamp(S.t / 0.9, 0, 1);
      N.crouchT = Math.sin(u * Math.PI) * 0.7;
      N.reach(1, -0.15, 1.0 - Math.sin(u * Math.PI) * 0.45, 0.3); N.reach(0, 0.1, 1.05 - Math.sin(u * Math.PI) * 0.45, 0.35);
      this.props.shotgun.visible = u > 0.5;
      if (S.t > 0.95) { S.ph = 'aim'; S.t = 0; this.revShout('gunUp'); worldEvent('npcGun', N.pos.x, N.pos.y + 1.4, N.pos.z, { by: N.id }); }
    } else if (S.ph === 'aim' || S.ph === 'fire') {
      N.crouchT = 0; N.leanT = 0.05;
      // both hands on it, pointed at you
      const l = N.toLocal(this._w.set(P.x, P.y + 1.25, P.z), this._v);
      const yawTo = Math.atan2(l.x, l.z), pitch = clamp(Math.atan2(l.y - 1.35, Math.hypot(l.x, l.z)), -0.6, 0.4);
      const fx = Math.sin(yawTo), fz = Math.cos(yawTo);
      N.reach(1, -0.1 + fx * 0.12, 1.33 + Math.sin(pitch) * 0.12, 0.18 + fz * 0.12);
      N.reach(0, -0.02 + fx * 0.55, 1.36 + Math.sin(pitch) * 0.5, 0.18 + fz * 0.55);
      // he lets you go if you leave
      if (!inside) { this.remember('Du hast ihn mit der Schrotflinte aus dem Saloon gejagt (' + TIME.stamp() + ').'); lose('gunDown'); return; }
      const threat = GUN.state !== 'holster' || this.aimedT > 0.1, close = dP < 2.4;
      if (S.ph === 'aim') {
        if (S.t > 6 && !S.warned) { S.warned = true; this.fireShotgun(true); this.revShout('gunWarn'); }
        if ((threat && S.t > 0.5) || (close && S.t > 0.8) || S.t > 12) { S.ph = 'fire'; S.t = 0; }
      } else if (S.t > 0.35) {
        this.fireShotgun(false);
        S.shots++;
        if (PHP.out || S.shots >= 2) {
          if (PHP.out) { this.grudge = Math.max(this.grudgeFloor(), this.grudge - 0.45); this.remember('Du hast ihn mit der Schrotflinte niedergeschossen. Jetzt seid ihr quitt (' + TIME.stamp() + ').'); setTimeout(() => this.revShout('paid'), 1200); }
          lose(null);
        } else { S.ph = 'aim'; S.t = 4; }
      }
    }
  },
  // both barrels: the flash, the roar, the hit (warning: into the ceiling)
  fireShotgun(warning) {
    const N = this.npc, m = this.props.shotgun; if (!m) return;
    m.updateMatrixWorld();
    const mz = new THREE.Vector3(0, 0, 0.68).applyMatrix4(m.matrixWorld), dir = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
    FX.muzzle(mz, dir, mz.clone().addScaledVector(dir, -0.4));
    GSFX.run(() => { const { g, t } = GSFX.out(1.2, mz); GSFX.play('shot', g, t, 0.72, 1.1); SFX.thump(t, g, 70, 28, 1.1, 0.35); });
    PLAY.camShake = Math.max(PLAY.camShake, 0.08);
    N.hp.flinchBy(dir.clone().negate(), 0.4, 'chest', '', true);
    worldEvent('npcShot2', mz.x, mz.y, mz.z, { by: N.id, warning });
    if (warning) {
      const up = new THREE.Vector3(0, 1, 0), ray = GUN.ray; ray.set(mz, up); ray.near = 0; ray.far = 6;
      const h = ray.intersectObjects([this.R.mesh], false)[0];
      if (h) { FX.impact(h, up); FX.impact(h, up); }
      return;
    }
    // a spread of pellets: at close range nearly all of it, further away less, moving targets get away with less
    const d = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z), moving = Math.hypot(PLAY.vx, PLAY.vz);
    const share = clamp(1.25 - d * 0.09 - moving * 0.08, 0.25, 1);
    if (Math.random() < 0.9) PHP.hit({ shot: true, power: share * 1.6, head: false, heavy: true, dir: { x: dir.x, z: dir.z }, by: N });
    else { const ray = GUN.ray; ray.set(mz, dir); ray.near = 0; ray.far = 30; const h = ray.intersectObjects(W.worldMeshes.concat([this.R.mesh]), false)[0]; if (h) FX.impact(h, dir); }
  },

  /* ---- death: the body, the grave; who takes over is up to the crew (npc/crew.js) ---- */
  removeBody() {
    const N = this.npc; if (!N || !N.hp.dead) return;
    const W = this.who(), m = CREW.m[this.whoI], known = !!(m && m.died && m.died.known);
    GRAVES.add(W.name, TIME.day());
    DOC.knows.push(W.name + ', der Barkeeper, ist tot (' + (N.hp.cause || 'erschossen') + ', ' + TIME.stamp(this.diedAt) + '). ' + (this.killedBy === 'player' ? (known ? 'Die ihn gesehen haben, sagen: Der Fremde war es.' : 'Wer es war, weiß keiner.') : ''));
    if (DOC.knows.length > 6) DOC.knows.shift();
    if (this.killedBy === 'player' && known) DOC.feel(-0.4);
    // whoever came down and stayed with him goes with the body
    for (const h of CREW.helpers.slice()) if (h.ph !== 'dead') CREW.gone(h);
    N.dispose();
    this.npc = null; this.st = 'closed'; this.goneAt = TIME.min;
    CREW.buried(this.whoI);
  },
  // developer tools: the one there dies off-screen and is buried, the next one alive takes over now
  devNext() {
    if (!CREW.living().some((m) => m.i !== this.whoI)) { TOAST.show(this.who().name + ' ist der Letzte.'); return; }
    const N = this.npc;
    if (N && !N.hp.dead) { N.hp.die('Entwickler', null, 'back'); this.killedBy = 'world'; this.cause = 'gestorben'; const m = CREW.m[this.whoI]; if (m.died) { m.died.by = 'world'; m.died.known = false; m.died.cause = 'gestorben'; } }
    if (this.npc) this.removeBody();
    const hold = CREW.hold; CREW.hold = true; CREW.update(0); CREW.hold = hold;
    if (this.npc) TOAST.show(this.who().name + ' steht jetzt hinter der Theke.');
  },
  // what his temper does from moment to moment
  temperUpdate(dt, inside, dP) {
    const N = this.npc; if (!N || !this.temper || !inside) return;
    if (this.temper === 'afraid' && dP < 5) N.fear = G.time + 0.5;
  },
  // called from update while dead: the body is taken away after a while, when nobody sees it
  fate(dt) {
    if (this.st === 'dead' && this.npc && TIME.min - (this.diedAt || TIME.min) > 120 && this.unseen()) this.removeBody();
  },
  // the next one's first look at you, when he knows what you did
  greetSuccessor() { if (this.temper && !this.metNew && CREW.lastDead && this.killedBy !== 'world') { this.metNew = true; this.revShout('successor'); return true; } return false; }
});

/* ---- graves by the church (fresh earth, a wooden cross); kept in the save ---- */
const GRAVES = {
  list: [], meshes: [], SPOTS: [[-60.2, 18.6], [-62.9, 18.8], [-65.6, 18.5], [-60.6, 22.0], [-63.4, 22.2], [-66.1, 21.9]],
  add(name, day) { if (this.list.length >= this.SPOTS.length) return; this.list.push({ name, day }); this.build(this.list.length - 1); },
  build(i) {
    if (!G.scene || this.meshes[i]) return;
    const [x, z] = this.SPOTS[i], y = surfaceHeight(x, z), mb = new MB(), wood = rgb(0x8a6a4a);
    mb.box(x, y - 0.1, z + 0.9, 0.95, 0.38, 1.75, rgb(0x6a4a32), 1);
    mb.box(x, y, z, 0.14, 1.3, 0.12, wood, 3); mb.box(x, y + 0.82, z, 0.7, 0.12, 0.12, wood, 3);
    // a few wild flowers on it
    for (let k = 0; k < 3; k++) mb.box(x - 0.2 + k * 0.2, y + 0.27, z + 0.6 + k * 0.25, 0.06, 0.08, 0.06, [0.85, 0.75 - k * 0.2, 0.3], 0);
    const m = new THREE.Mesh(mb.build(), G.litMat); m.layers.enable(2); G.scene.add(m); this.meshes[i] = m;
  },
  rebuild() { for (let i = 0; i < this.list.length; i++) this.build(i); }
};
SAVE.part('graves', () => GRAVES.list.slice(), (d) => { GRAVES.list = Array.isArray(d) ? d.filter((g) => g && typeof g.name === 'string').slice(0, 6) : []; GRAVES.rebuild(); });
