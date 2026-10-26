/* ---------- player, camera, input ---------- */
const PLAY = {
  pos: new THREE.Vector3(36, 0, 2.6), yaw: -Math.PI / 2, vx: 0, vz: 0, speed: 0, phase: 0, amp: 0, moving: false,
  camYaw: Math.PI / 2, camPitch: 0.3, camDist: 7.5, camDistCur: 7.5, started: false, aimPitch: 0.05, camShake: 0,
  inYaw: null, camPush: new THREE.Vector3()
};
const WALK = 1.7, RUN = 5.4;
const INPUT = { keys: new Set(), joy: null, look: null, stickX: 0, stickY: 0, padRun: false, padLookX: 0, padLookY: 0, padPrev: [] };

function initInput(app, canvas, onAction) {
  const joyEl = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  const R = 52;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    const rect = app.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const touchLike = e.pointerType !== 'mouse';
    if (touchLike && !app.classList.contains('touch')) { app.classList.add('touch'); GUN.touch = true; }
    if (touchLike && !INPUT.joy && x < rect.width * 0.5) {
      INPUT.joy = { id: e.pointerId, ox: x, oy: y };
      joyEl.hidden = false; joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; knob.style.transform = 'translate(0px, 0px)';
      onAction('move');
    } else if (!INPUT.look) {
      INPUT.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      onAction('look');
    } else return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (INPUT.joy && e.pointerId === INPUT.joy.id) {
      const rect = app.getBoundingClientRect();
      let dx = e.clientX - rect.left - INPUT.joy.ox, dy = e.clientY - rect.top - INPUT.joy.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      INPUT.stickX = dx / R; INPUT.stickY = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (INPUT.look && e.pointerId === INPUT.look.id) {
      const dx = e.clientX - INPUT.look.x, dy = e.clientY - INPUT.look.y;
      INPUT.look.x = e.clientX; INPUT.look.y = e.clientY;
      lookBy(dx, dy, e.pointerType !== 'mouse');
    }
  });
  const end = (e) => {
    if (INPUT.joy && e.pointerId === INPUT.joy.id) { INPUT.joy = null; INPUT.stickX = INPUT.stickY = 0; joyEl.hidden = true; }
    if (INPUT.look && e.pointerId === INPUT.look.id) INPUT.look = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  // mouse: right button aims (pointer lock if the page allows it), left button fires
  canvas.addEventListener('mousedown', (e) => {
    if (SIT.busy()) return;
    if (e.button === 2) {
      GUN.setAim(true); onAction('aim');
      try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed here */ }
    } else if (e.button === 0) { if (GUN.state === 'holster') FIST.down(true); else GUN.pressFire(); onAction('fire'); }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) FIST.up();
    if (e.button === 2) { GUN.setAim(false); try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (err) { /* ignore */ } }
  });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) lookBy(e.movementX, e.movementY, false); });
  canvas.addEventListener('wheel', (e) => { PLAY.camDist = clamp(PLAY.camDist * Math.exp(e.deltaY * 0.0012), 3.2, 16); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'm') { onAction('sound'); return; }
    if (k === 'h') { onAction('hud'); return; }
    if (k === 't') { onAction('slow'); return; }
    if (k === 'e' && !e.repeat) { INTERACT.use(); onAction('use'); return; }
    if (SIT.busy() && (k === 'q' || k === 'r' || k === 'f')) return;
    if (k === 'q' && !e.repeat) { GUN.toggleHolster(); onAction('gun'); return; }
    if (k === 'r' && !e.repeat) { GUN.pressReload(); onAction('gun'); return; }
    if (k === 'f' && !e.repeat) { if (GUN.state === 'holster') FIST.down(false); else GUN.pressFire(); onAction('fire'); return; }
    if (k === '+' || k === '=') PLAY.camDist = clamp(PLAY.camDist * 0.85, 3.2, 16);
    if (k === '-') PLAY.camDist = clamp(PLAY.camDist / 0.85, 3.2, 16);
    if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(k)) {
      INPUT.keys.add(k);
      if (k !== 'Shift') onAction('move');
      if (k.startsWith('Arrow')) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; INPUT.keys.delete(k); if (k === 'f') FIST.up(); if (k === 'Shift') INPUT.keys.delete('Shift'); });
  window.addEventListener('blur', () => { INPUT.keys.clear(); });
}

/* camera / aim from a drag or mouse movement in pixels */
function lookBy(dx, dy, touch) {
  if (!touch) FIST.look(dx, dy);
  if (GUN.camW > 0.3) {
    const k = touch ? 0.0042 : 0.0026;
    PLAY.camYaw -= dx * k;
    PLAY.aimPitch = clamp(PLAY.aimPitch + dy * k * 0.8, -0.75, 0.9);
  } else {
    PLAY.camYaw -= dx * 0.0065;
    PLAY.camPitch = clamp(PLAY.camPitch + dy * 0.0045, 0.04, 1.15);
  }
}

function pollGamepad(onAction) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && Array.from(pads).find((g) => g && g.connected);
  INPUT.padX = INPUT.padY = 0; INPUT.padRun = false; INPUT.padLookX = INPUT.padLookY = 0;
  if (!p) return;
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
  INPUT.padX = dz(p.axes[0] || 0); INPUT.padY = dz(p.axes[1] || 0);
  INPUT.padLookX = dz(p.axes[2] || 0); INPUT.padLookY = dz(p.axes[3] || 0);
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
  INPUT.padRun = b(0) || b(10);
  const prev = INPUT.padPrev;
  if (b(5) && !prev[5]) onAction('slow');
  if (b(8) && !prev[8]) onAction('sound');
  if (b(3) && !prev[3]) INTERACT.use();
  if (SIT.busy()) { INPUT.padPrev = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(b); if (INPUT.padX || INPUT.padY) onAction('move'); return; }
  if (b(6) !== !!prev[6]) GUN.setAim(b(6));
  if (b(7) && !prev[7]) { if (GUN.state === 'holster') FIST.down(false); else GUN.pressFire(); }
  if (!b(7) && prev[7]) FIST.up();
  if (b(2) && !prev[2]) GUN.pressReload();
  if (b(4) && !prev[4]) GUN.toggleHolster();
  INPUT.padPrev = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(b);
  if (GUN.camW > 0.3) { PLAY.camYaw -= INPUT.padLookX * 0.05; PLAY.aimPitch = clamp(PLAY.aimPitch + INPUT.padLookY * 0.03, -0.75, 0.9); INPUT.padLookX = INPUT.padLookY = 0; }
  if (INPUT.padX || INPUT.padY) onAction('move');
}

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

function updateCamera(dt) {
  const look = PLAY.pos.clone(); look.y += 1.35 - 0.32 * SIT.w;
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
    if (!INPUT.look && reach(pitch) < 2.4) {
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
    const A = aimCamera(R);
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
  const fov = G.baseFov ? G.baseFov * (1 - 0.16 * aw) * (1 + 0.045 * GUN.fovPunch * GUN.fovPunch) : cam.fov;
  if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  W.ch.root.visible = cam.position.distanceTo(G.lookAt) > 0.75;
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

/* over the right shoulder, looking along camYaw / aimPitch; pulled in if a wall is in the way */
function aimCamera(R) {
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
  while (off > 0.1 && blocked(piv.x + right.x * off, piv.y, piv.z + right.z * off)) off -= 0.15;
  piv.addScaledVector(right, off);
  let dist = 2.7;
  for (let s = 0.3; s <= 2.7; s += 0.1) { if (blocked(piv.x - v.x * s, piv.y - v.y * s, piv.z - v.z * s)) { dist = Math.max(0.3, s - 0.15); break; } }
  const pos = piv.clone().addScaledVector(v, -dist);
  const gy = R ? R.floorY + 0.4 : surfaceHeight(pos.x, pos.z) + 0.35;
  if (pos.y < gy) pos.y = gy;
  return { pos, look: piv.clone().addScaledVector(v, 20) };
}

function updateCharacterVisual() {
  updateGait();
  DUST.update(GAIT.dt || 0);
  const g = groundAt(PLAY.pos.x, PLAY.pos.z, PLAY.pos.y);
  W.blob.position.set(PLAY.pos.x, g + 0.04, PLAY.pos.z);
  W.blob.scale.set(1.1, 1, 0.9);
}
