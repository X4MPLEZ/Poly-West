/* ---------- player, camera, input ---------- */
const PLAY = {
  pos: new THREE.Vector3(36, 0, 2.6), yaw: -Math.PI / 2, vx: 0, vz: 0, speed: 0, phase: 0, amp: 0, moving: false,
  camYaw: Math.PI / 2, camPitch: 0.3, camDist: 7.5, camDistCur: 7.5, started: false, aimPitch: 0.05, camShake: 0,
  inYaw: null, camPush: new THREE.Vector3()
};
const WALK = 1.7, RUN = 5.4;
ACTORS.add({ id: 'player', kind: 'player', pos: PLAY.pos, get yaw() { return PLAY.yaw; }, get room() { return G.room || null; }, get seat() { return SIT.seat; } });

function collide(px, pz, py) {
  const r = 0.36;
  for (let it = 0; it < 2; it++) {
    for (const c of COLL) {
      if (c.y0 !== undefined && py < c.y0) continue;
      if (c.top !== undefined && py > c.top) continue;
      if (c.r !== undefined) {
        const dx = px - c.cx, dz = pz - c.cz, rr = c.r + r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1e-4;
          px = c.cx + (dx / d) * rr; pz = c.cz + (dz / d) * rr;
        }
        continue;
      }
      const dx = px - c.cx, dz = pz - c.cz;
      if (Math.abs(dx) > c.hx + c.hz + r + 1 || Math.abs(dz) > c.hx + c.hz + r + 1) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      let lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz);
      const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        lx = qx + (ex / d) * r; lz = qz + (ez / d) * r;
      } else {
        const penX = c.hx - Math.abs(lx), penZ = c.hz - Math.abs(lz);
        if (penX < penZ) lx = (lx >= 0 ? 1 : -1) * (c.hx + r); else lz = (lz >= 0 ? 1 : -1) * (c.hz + r);
      }
      px = c.cx + lx * ca + lz * sa; pz = c.cz - lx * sa + lz * ca;
    }
  }
  const d = Math.hypot(px - TOWN.cx, pz - TOWN.cz);
  if (d > 150) { px = TOWN.cx + ((px - TOWN.cx) * 150) / d; pz = TOWN.cz + ((pz - TOWN.cz) * 150) / d; }
  return [px, pz];
}
function groundAt(px, pz, py) {
  let g = surfaceHeight(px, pz);
  for (const p of PLATS) {
    if (py < p.y - 0.8) continue;
    const dx = px - p.cx, dz = pz - p.cz, ca = Math.cos(p.a), sa = Math.sin(p.a);
    const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
    if (Math.abs(lx) <= p.hx && Math.abs(lz) <= p.hz) g = Math.max(g, p.y);
  }
  return g;
}

function updatePlayer(dt) {
  const k = INPUT.keys;
  let ix = 0, iy = 0;
  if (k.has('w') || k.has('ArrowUp')) iy += 1;
  if (k.has('s') || k.has('ArrowDown')) iy -= 1;
  if (k.has('a') || k.has('ArrowLeft')) ix -= 1;
  if (k.has('d') || k.has('ArrowRight')) ix += 1;
  const keyLen = Math.hypot(ix, iy);
  if (keyLen > 0) { ix /= keyLen; iy /= keyLen; }
  ix += INPUT.stickX + (INPUT.padX || 0); iy += -INPUT.stickY - (INPUT.padY || 0);
  let mag = Math.min(1, Math.hypot(ix, iy));
  PLAY.camYaw -= (INPUT.padLookX || 0) * dt * 2.4;
  PLAY.camPitch = clamp(PLAY.camPitch + (INPUT.padLookY || 0) * dt * 1.5, 0.04, 1.15);
  if (SIT.drive(dt, mag)) return;   // walking to a seat, sitting, getting up
  const touchRun = INPUT.joy && Math.hypot(INPUT.stickX, INPUT.stickY) > 0.93;
  const aiming = GUN.aiming();
  const run = !aiming && (k.has('Shift') || INPUT.padRun || touchRun);
  const yaw = PLAY.camYaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = rx * ix + fx * iy, mz = rz * ix + fz * iy;
  const ml = Math.hypot(mx, mz);
  if (ml > 1e-4) { mx /= ml; mz /= ml; }
  PLAY.inYaw = mag > 0.08 && ml > 1e-4 ? Math.atan2(mx, mz) : null;   // where the player is steering
  let target = 0;
  if (mag > 0.08) target = run ? RUN : (INPUT.joy ? WALK * clamp(mag / 0.85, 0.35, 1) : WALK);
  if (aiming) target = Math.min(target, WALK * 0.8);
  const punching = FIST.st !== 'idle';
  if (punching) target = Math.min(target, WALK * 0.5);
  const a = 1 - Math.exp(-dt * (target > PLAY.speed ? 6.5 : 9));
  PLAY.vx += (mx * target - PLAY.vx) * a;
  PLAY.vz += (mz * target - PLAY.vz) * a;
  PLAY.speed = Math.hypot(PLAY.vx, PLAY.vz);
  PLAY.moving = PLAY.speed > 0.35;
  if (punching && FIST.faceYaw !== null) {
    let d = FIST.faceYaw - PLAY.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    PLAY.yaw += d * (1 - Math.exp(-dt * 22));
  } else if (aiming) {
    // aiming: the body turns side-on to the target, right shoulder forward
    const ty = PLAY.camYaw + Math.PI + 0.35;
    let d = ty - PLAY.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    PLAY.yaw += d * (1 - Math.exp(-dt * 16));
  } else if (PLAY.speed > 0.25) {
    const ty = Math.atan2(PLAY.vx, PLAY.vz);
    let d = ty - PLAY.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    PLAY.yaw += d * (1 - Math.exp(-dt * 14));
  }
  let px = PLAY.pos.x + PLAY.vx * dt, pz = PLAY.pos.z + PLAY.vz * dt;
  const [cx, cz] = collide(px, pz, PLAY.pos.y);
  // just up from a seat that stands close to furniture: ease out of it instead of popping
  if (PLAY.softColl > 0) { PLAY.softColl -= dt; const f = 1 - Math.exp(-dt * 9); px += (cx - px) * f; pz += (cz - pz) * f; } else { px = cx; pz = cz; }
  const g = groundAt(px, pz, PLAY.pos.y);
  PLAY.pos.x = px; PLAY.pos.z = pz;
  PLAY.pos.y += (g - PLAY.pos.y) * (1 - Math.exp(-dt * (g > PLAY.pos.y ? 22 : 14)));
  const stride = PLAY.speed > 4 ? 2.5 : 1.6;
  PLAY.phase += (PLAY.speed * dt * TAU) / stride;
  const tAmp = PLAY.moving ? clamp(PLAY.speed / RUN, 0.25, 1) : 0;
  PLAY.amp += (tAmp - PLAY.amp) * (1 - Math.exp(-dt * 10));
  W.ch.root.position.copy(PLAY.pos);
  W.ch.root.rotation.y = PLAY.yaw;
}

function updateWorld(dt, t) {
  W.rotor.rotation.z += dt * 2.4;
  for (const m of W.poles) m.rotation.y -= dt * 1.6; // barber poles turn, stripes seem to climb
  for (const m of W.weeds) {
    const u = m.userData, len = Math.abs(u.x1 - u.x0);
    u.t += (dt * u.speed) / len;
    const f = u.t % 1;
    const x = u.x0 + (u.x1 - u.x0) * f;
    const z = u.z + Math.sin(x * 0.07 + u.x0) * u.wob;
    const hop = Math.abs(Math.sin(t * 2.6 + u.x0)) * 0.7;
    m.position.set(x, surfaceHeight(x, z) + 0.58 + hop, z);
    m.rotation.z += (dt * u.speed) / 0.6;
    m.visible = f > 0.02 && f < 0.98;
  }
  for (const b of W.birds) {
    const u = b.userData, a = t * u.sp + u.ph;
    b.position.set(-6 + Math.cos(a) * u.r, u.h + Math.sin(t * 0.3 + u.ph) * 2, 2 + Math.sin(a) * u.r);
    b.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)), 0.32);
  }
}

function updateCharacterVisual() {
  updateGait();
  DUST.update(GAIT.dt || 0);
  const g = groundAt(PLAY.pos.x, PLAY.pos.z, PLAY.pos.y);
  W.blob.position.set(PLAY.pos.x, g + 0.04, PLAY.pos.z);
  W.blob.scale.set(1.1, 1, 0.9);
}
