function updateCamera(dt) {
  const look = PLAY.pos.clone(); look.y += 1.35 - 0.32 * SIT.w - 0.95 * FALL.down;
  if (!G.lookAt) G.lookAt = look.clone();
  G.lookAt.lerp(look, 1 - Math.exp(-dt * 10));
  const cam = G.cam;
  const R = G.room;
  let pitch = R ? Math.min(PLAY.camPitch, 0.42) : PLAY.camPitch;
  const want = R ? Math.min(PLAY.camDist, 4.0) : PLAY.camDist;
  let ox = Math.sin(PLAY.camYaw) * Math.cos(pitch), oy = Math.sin(pitch), oz = Math.cos(PLAY.camYaw) * Math.cos(pitch);
  let lim = want;
  if (R) {
    // indoors: stay inside the room and under the ceiling; if a wall is close behind, look down from higher up
    const reach = (p, yw) => {
      const Y = yw === undefined ? PLAY.camYaw : yw;
      const ax = Math.sin(Y) * Math.cos(p), ay = Math.sin(p), az = Math.cos(Y) * Math.cos(p);
      for (let s = 0.3; s <= want; s += 0.1) {
        const x = G.lookAt.x + ax * s, y = G.lookAt.y + ay * s, z = G.lookAt.z + az * s;
        const [lx, lz] = rLocal(R, x, z);
        // a rect may carry its own ceiling (the stairwell reaches up to the next floor)
        let ok = R.rects.some((r) => lx > r[0] + 0.28 && lx < r[1] - 0.28 && lz > r[2] + 0.28 && lz < r[3] - 0.15 && y < (r[4] || R.ceilY) - 0.25);
        if (ok && R.doorKind === 'single' && R.door && R.door.angle > 0.3 && lx < -0.45 && lx > -1.05 && lz > R.z1 - 1.75) ok = false; // the open door leaf
        if (!ok) return Math.max(0.35, s - 0.1);
      }
      return want;
    };
    // a wall right behind you: swing the camera round to where the room is, unless you are steering it yourself
    // (never while you aim, or while you are turning the view yourself: it would pull the crosshair off the target)
    if (!INPUT.look && GUN.camW < 0.02 && !GUN.wantAim && G.time - (PLAY.userLookT || -99) > 2.5 && reach(pitch) < 2.4) {
      // prefer views that look into the room: camera on the far side from the room centre
      const r0 = R.rects[0], [px, pz] = rLocal(R, PLAY.pos.x, PLAY.pos.z);
      const cxl = (r0[0] + r0[1]) / 2 - px, czl = (r0[2] + r0[3]) / 2 - pz, cl = Math.hypot(cxl, czl) || 1;
      const score = (yw) => {
        const wx = -Math.sin(yw), wz = -Math.cos(yw);                 // looking direction, world
        const lvx = wx * R.c - wz * R.s, lvz = wx * R.s + wz * R.c;    // in room space
        return reach(pitch, yw) + 1.6 * (lvx * cxl + lvz * czl) / cl;
      };
      let bestY = PLAY.camYaw, bestR = score(PLAY.camYaw);
      for (let o = -1.8; o <= 1.81; o += 0.3) { const r = score(PLAY.camYaw + o); if (r > bestR + 0.4) { bestR = r; bestY = PLAY.camYaw + o; } }
      PLAY.camYaw += (bestY - PLAY.camYaw) * (1 - Math.exp(-dt * 2.2));
      ox = Math.sin(PLAY.camYaw) * Math.cos(pitch); oz = Math.cos(PLAY.camYaw) * Math.cos(pitch);
    }
    let best = pitch, bestL = reach(pitch);
    for (let p = pitch + 0.15; bestL < 2.4 && p < 0.95; p += 0.15) { const l = reach(p); if (l > bestL + 0.05) { best = p; bestL = l; } }
    PLAY.camPitchIn = PLAY.camPitchIn === undefined ? best : PLAY.camPitchIn + (best - PLAY.camPitchIn) * (1 - Math.exp(-dt * 5));
    pitch = PLAY.camPitchIn;
    ox = Math.sin(PLAY.camYaw) * Math.cos(pitch); oy = Math.sin(pitch); oz = Math.cos(PLAY.camYaw) * Math.cos(pitch);
    lim = reach(pitch);
  } else {
    PLAY.camPitchIn = undefined;
    // outdoors: pull the camera in front of walls
    for (let s = 0.6; s <= want; s += 0.35) {
      const x = G.lookAt.x + ox * s, y = G.lookAt.y + oy * s, z = G.lookAt.z + oz * s;
      let hit = false;
      for (const b of CAMBLOCK) { if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && y < b.y1 + 0.3 && y > b.y0) { hit = true; break; } }
      if (hit) { lim = Math.max(0.8, s - 0.4); break; }
    }
  }
  PLAY.camDistCur = lim < PLAY.camDistCur ? lim : PLAY.camDistCur + (lim - PLAY.camDistCur) * (1 - Math.exp(-dt * 3));
  const d = PLAY.camDistCur;
  cam.position.set(G.lookAt.x + ox * d, G.lookAt.y + oy * d, G.lookAt.z + oz * d);
  const gy = R ? R.floorY + 0.5 : surfaceHeight(cam.position.x, cam.position.z) + 0.45;
  if (cam.position.y < gy) cam.position.y = gy;
  let lookT = G.lookAt;
  const aw = GUN.camW;
  if (aw > 0.001) {
    const A = aimCamera(R, dt);
    cam.position.lerp(A.pos, aw);
    lookT = (PLAY._lt || (PLAY._lt = new THREE.Vector3())).copy(G.lookAt).lerp(A.look, aw);
  }
  if (PLAY.camShake > 0) {
    PLAY.camShake = Math.max(0, PLAY.camShake - dt * 0.4);
    const s = PLAY.camShake;
    cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
  }
  // a landed punch shoves the view along the blow for a moment
  if (PLAY.camPush.lengthSq() > 1e-6) {
    cam.position.add(PLAY.camPush); lookT = (PLAY._lt2 || (PLAY._lt2 = new THREE.Vector3())).copy(lookT).add(PLAY.camPush);
    PLAY.camPush.multiplyScalar(Math.exp(-dt * 11));
  }
  cam.lookAt(lookT);
  DRUNK.camera(cam);
  // the killing blow (combat/fist.js): the view closes in on him while it is slow, then lets go
  let kz = 0;
  if (G.killCam) { const K = G.killCam; K.t += dt; if (G.slowT <= 0 && K.rel === undefined) K.rel = K.t; kz = K.rel === undefined ? Math.min(1, K.t / 0.08) : Math.max(0, 1 - (K.t - K.rel) / 0.5); if (K.rel !== undefined && kz <= 0) G.killCam = null; }
  const fov = G.baseFov ? G.baseFov * (1 - 0.16 * aw) * (1 + 0.045 * GUN.fovPunch * GUN.fovPunch) * (1 - 0.22 * kz) : cam.fov;
  if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  W.ch.root.visible = cam.position.distanceTo(G.lookAt) > 0.75;
}

/* over the right shoulder, looking along camYaw / aimPitch; pulled in if a wall is in the way */
function aimCamera(R, dt) {
  const c = PLAY.camYaw, p = PLAY.aimPitch + GUN.kickP;
  const v = new THREE.Vector3(-Math.sin(c) * Math.cos(p), -Math.sin(p), -Math.cos(c) * Math.cos(p));
  const right = new THREE.Vector3(Math.cos(c), 0, -Math.sin(c));
  const blocked = (x, y, z) => {
    if (R) {
      const [lx, lz] = rLocal(R, x, z);
      return !R.rects.some((r) => lx > r[0] + 0.15 && lx < r[1] - 0.15 && lz > r[2] + 0.15 && lz < r[3] - 0.1 && y < (r[4] || R.ceilY) - 0.15);
    }
    for (const b of CAMBLOCK) if (x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2 && y < b.y1 + 0.2 && y > b.y0) return true;
    return false;
  };
  const piv = new THREE.Vector3(PLAY.pos.x, PLAY.pos.y + 1.58, PLAY.pos.z);
  let off = 0.78;
  while (off > 0.1 && blocked(piv.x + right.x * off, piv.y, piv.z + right.z * off)) off -= 0.05;
  /* in a corner the room for the camera changes with every turn of the view: it moves in at once (never into the
     wall) but out again only slowly, so the view glides instead of jumping (the direction of the aim stays the same) */
  const k = 1 - Math.exp(-(dt || 0.016) * 3);
  PLAY.aimOff = PLAY.aimOff === undefined || off < PLAY.aimOff ? off : PLAY.aimOff + (off - PLAY.aimOff) * k;
  piv.addScaledVector(right, PLAY.aimOff);
  let dist = 2.7;
  for (let s = 0.3; s <= 2.7; s += 0.05) { if (blocked(piv.x - v.x * s, piv.y - v.y * s, piv.z - v.z * s)) { dist = Math.max(0.3, s - 0.15); break; } }
  PLAY.aimDistS = PLAY.aimDistS === undefined || dist < PLAY.aimDistS ? dist : PLAY.aimDistS + (dist - PLAY.aimDistS) * k;
  dist = PLAY.aimDistS;
  const pos = piv.clone().addScaledVector(v, -dist);
  const gy = R ? R.floorY + 0.4 : surfaceHeight(pos.x, pos.z) + 0.35;
  if (pos.y < gy) pos.y = gy;
  return { pos, look: piv.clone().addScaledVector(v, 20) };
}
