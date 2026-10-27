/* ---------- a gun in the hands of anyone (the crew, a wary barkeeper, the sheriff) ----------
   new Gunman(npc, { kind: 'shotgun' | 'revolver', skill 0…1, courage 0…1, onWord(kind) })
   draw() / holster(); update(dt) every frame while it is out: the stance (low and ready, or aimed at you), the
   decision and the shot. He fires when you have fired in his sight a moment ago, when you shot him or someone near
   him, or when you keep your gun on him (after a warning); with your gun put away and nothing done he only watches
   you. A miss hits what is behind you; a hit is a bullet (PHP.hit). held(): the gun can be shot out of his hands. */
const GUNMAN = {
  lastShot: -99, lastShotAt: new THREE.Vector3(), lastKill: -99,
  init() {
    onWorldEvent((e) => {
      if (e.by !== 'player') return;
      if (e.type === 'shot') { this.lastShot = G.time; this.lastShotAt.set(e.x, e.y, e.z); }
      if (e.type === 'npcDead' || e.type === 'npcShot') this.lastKill = G.time;
    });
  },
  // the meshes, made once
  geo: {},
  mesh(kind) {
    const g = this.geo[kind] || (this.geo[kind] = kind === 'shotgun' ? BARKEEP.shotgunGeo() : buildGunGeo().build());
    const m = new THREE.Mesh(g, G.litMat); m.matrixAutoUpdate = false; m.frustumCulled = false; m.visible = false; G.scene.add(m);
    return m;
  }
};

class Gunman {
  constructor(npc, o) {
    this.npc = npc; this.kind = (o && o.kind) || 'shotgun'; this.skill = o && o.skill !== undefined ? o.skill : 0.5; this.courage = o && o.courage !== undefined ? o.courage : 0.6;
    this.onWord = (o && o.onWord) || null; this.st = 'off'; this.t = 0; this.cool = 0; this.rounds = this.kind === 'shotgun' ? 2 : 6; this.aimK = 0; this.aimedT = 0; this.warnN = 0;
    this.m = null; this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._q = new THREE.Matrix4(); this._m = new THREE.Matrix4(); this._up = new THREE.Vector3(0, 1, 0);
  }
  get on() { return this.st !== 'off'; }
  draw() { if (this.st === 'off' || this.st === 'holster') { this.st = 'draw'; this.t = 0; if (!this.m) this.m = GUNMAN.mesh(this.kind); worldEvent('npcGun', this.npc.pos.x, this.npc.pos.y + 1.3, this.npc.pos.z, { by: this.npc.id }); } }
  holster() { if (this.st !== 'off') { this.st = 'holster'; this.t = 0; } }
  drop() { if (this.m) this.m.visible = false; this.st = 'off'; this.npc.free(0); this.npc.free(1); this.lost = G.time; }
  dispose() { if (this.m && this.m.parent) this.m.parent.remove(this.m); this.m = null; this.st = 'off'; }
  // for HARM.trace: the gun is a thing in his hands a bullet can take
  held() { return this.m && this.m.visible ? [this._held || (this._held = { mesh: this.m, kind: this.kind, hand: 1, r: this.kind === 'shotgun' ? 0.09 : 0.06, dy: 0, lose: () => this.drop() })] : []; }
  // can he see you (eyes to your chest, nothing solid between)
  sees() {
    const N = this.npc, R = N.room || null;
    if ((R || null) !== (G.room || null) && (R || G.room)) return false;
    const o = this._v.set(N.pos.x, N.pos.y + 1.6, N.pos.z), p = this._w.set(PLAY.pos.x, PLAY.pos.y + 1.3, PLAY.pos.z), d = p.clone().sub(o), L = d.length(); if (L > 40) return false;
    const ray = GUN.ray; ray.set(o, d.divideScalar(L)); ray.near = 0.3; ray.far = L - 0.3;
    const objs = W.worldMeshes.concat(R && R.mesh ? [R.mesh] : []);
    return ray.intersectObjects(objs, false).length === 0;
  }
  aimedAtMe() {
    if (!(GUN.camW > 0.5)) return false;
    const N = this.npc, cam = G.cam, d = this._v.set(N.pos.x, N.pos.y + 1.4, N.pos.z).sub(cam.position), L = d.length(); if (L > 25) return false;
    d.divideScalar(L); return cam.getWorldDirection(this._w).dot(d) > Math.cos(0.12 + 0.5 / L);
  }
  /* every frame while out. Returns true while he is busy with it (the behaviour leaves the body to him) */
  update(dt) {
    const N = this.npc;
    if (this.st === 'off') return false;
    if (N.hp.dead || N.hp.busy()) { if (this.m) this.m.visible = false; this.st = N.hp.dead ? 'off' : this.st; return false; }
    this.t += dt; this.cool -= dt;
    const P = PLAY.pos, dP = Math.hypot(P.x - N.pos.x, P.z - N.pos.z), see = this.sees();
    if (this.st === 'draw') { this.m.visible = this.t > 0.25; this.pose(0.3 + this.t); if (this.t > 0.6) { this.st = 'low'; this.t = 0; } this.place(); return true; }
    if (this.st === 'holster') { this.pose(Math.max(0, 0.6 - this.t)); if (this.t > 0.5) { this.m.visible = false; this.st = 'off'; N.free(0); N.free(1); } else this.place(); return true; }
    // what you do decides it: fired in his sight just now, shot someone, or your gun on him
    const fired = G.time - GUNMAN.lastShot < 2.5 && see, killed = G.time - GUNMAN.lastKill < 3 && see;
    const aimed = see && this.aimedAtMe();
    this.aimedT = aimed ? this.aimedT + dt : Math.max(0, this.aimedT - dt * 0.5);
    const shotMe = N.hp.lastHit && G.time - N.hp.lastHit < 3 && N.shotBy && TIME.min - N.shotBy < 2;
    const drawn = GUN.state !== 'holster' && !GUN.reloadThenHolster;
    const hostile = fired || killed || shotMe || (this.aimedT > 1.6 && this.warnN > 0) || (this.provoked && G.time - this.provoked < 8);
    if (fired || killed || shotMe) this.provoked = G.time;
    const aimAt = see && (drawn || hostile || dP < 2.5);
    this.aimK += ((aimAt ? 1 : 0) - this.aimK) * (1 - Math.exp(-dt * 7));
    if (see) N.stop(Math.atan2(P.x - N.pos.x, P.z - N.pos.z));
    if (see) N.lookAt(this._w.set(P.x, P.y + 1.5, P.z), 1);
    this.pose(1);
    // a word first: put it down, get out (not when he is already shooting)
    if (aimAt && !hostile && this.warnN < 2 && G.time - (this.warnT || -99) > 5) { this.warnT = G.time; this.warnN++; if (this.onWord) this.onWord(this.warnN === 1 ? 'warn' : 'warn2'); }
    if (hostile && see && this.aimK > 0.85 && this.cool <= 0 && !PHP.out && this.courage > 0.25) this.fire(dP);
    if (!see && G.time - (this.provoked || -99) > 12) this.aimedT = 0;
    this.place();
    return true;
  }
  // the hands: low and ready (blend 0) or up and aimed at your chest (1); u < 1 while drawing it
  pose(u) {
    const N = this.npc, P = PLAY.pos, a = this.aimK * Math.min(1, u);
    const l = N.toLocal(this._w.set(P.x, P.y + 1.25, P.z), this._v), yawTo = Math.atan2(l.x, l.z), pitch = clamp(Math.atan2(l.y - 1.35, Math.hypot(l.x, l.z)), -0.6, 0.4);
    const fx = Math.sin(yawTo) * a, fz = Math.cos(yawTo);
    if (this.kind === 'shotgun') {
      N.reach(1, -0.12 + fx * 0.12, lerp(1.0, 1.33 + Math.sin(pitch) * 0.12, a), lerp(0.2, 0.18 + fz * 0.12, a));
      N.reach(0, lerp(0.06, -0.02 + fx * 0.55, a), lerp(0.88, 1.36 + Math.sin(pitch) * 0.5, a), lerp(0.48, 0.18 + fz * 0.55, a));
      N.leanT = 0.05 * a;
    } else {
      N.reach(1, lerp(-0.24, -0.08 + fx * 0.5, a), lerp(0.95, 1.38 + Math.sin(pitch) * 0.45, a), lerp(0.12, 0.2 + fz * 0.45, a));
      N.free(0);
    }
    N.handShape[1] = { fist: 0.85 }; if (this.kind === 'shotgun') N.handShape[0] = { fist: 0.6 };
  }
  // the gun follows the hands: a shotgun from the right hand to the left, a revolver in the right hand along the aim
  place() {
    const N = this.npc, m = this.m; if (!m) return;
    N.handWorld(1, this._v);
    if (this.kind === 'shotgun') { N.handWorld(0, this._w); this._m.copy(this._q.lookAt(this._w, this._v, this._up)); this._m.setPosition(this._v); }
    else {
      const P = PLAY.pos, tgt = this._w.set(P.x, P.y + 1.25, P.z), down = this._w.clone().set(N.pos.x + Math.sin(N.yaw) * 0.6, this._v.y - 0.6, N.pos.z + Math.cos(N.yaw) * 0.6);
      tgt.lerp(down, 1 - this.aimK);
      this._m.copy(this._q.lookAt(tgt, this._v, this._up)); this._m.setPosition(this._v);
    }
    m.matrix.copy(this._m); m.matrixWorldNeedsUpdate = true;
  }
  // a shot at you: from the muzzle, a little off by how good he is, how far, how fast you move
  fire(dist) {
    const N = this.npc, m = this.m, sg = this.kind === 'shotgun';
    m.updateMatrixWorld();
    const mz = new THREE.Vector3(0, 0, sg ? 0.68 : 0.32).applyMatrix4(m.matrixWorld);
    const tgt = new THREE.Vector3(PLAY.pos.x, PLAY.pos.y + 1.15 + (Math.random() - 0.5) * 0.4, PLAY.pos.z), dir = tgt.clone().sub(mz).normalize();
    const moving = Math.hypot(PLAY.vx, PLAY.vz), low = FALL.down > 0.5 || SIT.busy();
    const pHit = clamp(this.skill * (sg ? 1.05 : 0.95) - dist * (sg ? 0.045 : 0.028) - moving * 0.1 - (low ? 0.15 : 0), 0.08, 0.92);
    const hit = Math.random() < pHit;
    if (!hit) { const s = 0.06 + (1 - this.skill) * 0.05; dir.x += (Math.random() - 0.5) * s; dir.y += (Math.random() - 0.4) * s; dir.z += (Math.random() - 0.5) * s; dir.normalize(); }
    FX.muzzle(mz, dir, mz.clone().addScaledVector(dir, -0.3));
    GSFX.run(() => { const { g, t } = GSFX.out(sg ? 1.2 : 0.95, mz); GSFX.play('shot', g, t, sg ? 0.72 : 0.92 + Math.random() * 0.08, sg ? 1.1 : 0.95); SFX.thump(t, g, sg ? 70 : 90, sg ? 28 : 36, sg ? 1.1 : 0.6, sg ? 0.35 : 0.2); });
    N.hp.flinchBy(dir.clone().negate(), sg ? 0.4 : 0.2, 'chest', '', true);
    worldEvent('npcShot2', mz.x, mz.y, mz.z, { by: N.id, weapon: this.kind });
    this.rounds--; this.cool = this.rounds > 0 ? (sg ? 0.9 : 0.55 + (1 - this.skill) * 0.5) : (sg ? 3.2 : 4.5);
    if (this.rounds <= 0) this.rounds = sg ? 2 : 6;
    if (hit) {
      const share = sg ? clamp(1.25 - dist * 0.09, 0.3, 1) : 1;
      PHP.hit({ shot: true, power: sg ? share * 1.5 : 0.85, head: Math.random() < 0.08, heavy: sg && share > 0.6, dir: { x: dir.x, z: dir.z }, by: N });
      return;
    }
    // a miss goes into whatever is behind you
    const ray = GUN.ray; ray.set(mz, dir); ray.near = 0.2; ray.far = 40;
    const h = ray.intersectObjects(W.worldMeshes.concat(G.room && G.room.mesh ? [G.room.mesh] : []), false)[0];
    if (h) { FX.impact(h, dir); GSFX.impact(h.point, 'wood'); }
  }
}
