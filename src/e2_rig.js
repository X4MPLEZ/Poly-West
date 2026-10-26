/* ---------- the cowboy: 13 rigid parts on a procedural rig ----------
   Legs use two-bone IK towards feet that are planted in the world, so a foot on the ground never slides.
   Everything else (pelvis bob, sway, hip twist, counter-rotating shoulders, arms, head, hat) follows the feet. */
const RIG = {
  hipY: 0.945, hipX: 0.115, thigh: 0.44, shin: 0.42, ankleH: 0.085, toeF: 0.165, heelB: 0.07,
  waistY: 0.14, neckY: 0.47, shoulderX: 0.305, shoulderY: 0.41, upper: 0.29, headTop: 0.31
};

function buildCharacter(over) {
  const C = Object.assign({
    hat: rgb(0x5b3b26), band: rgb(0x2a1d15), skin: rgb(0xd99f78), skinD: rgb(0xc4876a), shirt: rgb(0xe3d3b3), vest: rgb(0x4a352a),
    jeans: rgb(0x3f5878), jeansD: rgb(0x34496a), belt: rgb(0x2a1d15), buckle: rgb(0xd9b04c), boot: rgb(0x6a4029), sole: rgb(0x2e1f17),
    bandana: rgb(0xc23a2c), dark: rgb(0x1e1612), stache: rgb(0x5a3a26)
  }, over || {});
  const root = new THREE.Group();
  const p = {};
  const add = (name, mb) => {
    const m = new THREE.Mesh(mb.build());
    m.matrixAutoUpdate = false; m.layers.enable(3); m.name = name; m.frustumCulled = false;
    root.add(m); p[name] = m; return m;
  };
  // pelvis: origin at the hip-joint centre
  let mb = new MB();
  mb.box(0, -0.1, 0, 0.44, 0.27, 0.26, C.jeans, 9, { bottom: true });
  mb.box(0, 0.1, 0, 0.47, 0.09, 0.28, C.belt, 0);
  mb.box(0, 0.11, 0.142, 0.1, 0.07, 0.02, C.buckle, 0);
  mb.box(-0.265, -0.22, 0.02, 0.08, 0.3, 0.15, C.belt, 0, { bottom: true });
  add('pelvis', mb);
  // torso: origin at the waist
  mb = new MB();
  mb.box(0, 0, 0, 0.48, 0.47, 0.26, C.shirt, 9, { bottom: true });
  for (const s of [-1, 1]) mb.box(s * 0.13, 0.03, 0.135, 0.18, 0.41, 0.03, C.vest, 9);
  mb.box(0, 0.03, -0.135, 0.46, 0.41, 0.03, C.vest, 9);
  mb.box(0, 0.47, 0, 0.36, 0.03, 0.22, C.shirt, 9);
  add('torso', mb);
  // head: origin at the base of the neck
  mb = new MB();
  mb.box(0, -0.03, 0, 0.13, 0.08, 0.13, C.skin, 0);
  mb.box(0, -0.06, 0, 0.29, 0.09, 0.29, C.bandana, 9, { bottom: true });
  mb.box(0, -0.15, 0.135, 0.16, 0.12, 0.03, C.bandana, 9, { bottom: true });
  mb.box(0, 0.035, 0, 0.26, 0.275, 0.26, C.skin, 0);
  for (const s of [-1, 1]) mb.box(s * 0.062, 0.17, 0.13, 0.045, 0.04, 0.014, C.dark, 0);
  mb.box(0, 0.11, 0.13, 0.05, 0.06, 0.05, C.skinD, 0);
  mb.box(0, 0.085, 0.132, 0.15, 0.035, 0.016, C.stache, 0);
  for (const s of [-1, 1]) mb.box(s * 0.135, 0.12, 0, 0.02, 0.07, 0.05, C.skinD, 0);
  add('head', mb);
  // hat: origin on top of the head
  mb = new MB();
  mb.cyl(0, -0.02, 0, 0.36, 0.36, 0.035, 14, C.hat, 0, { bottom: true });
  mb.cyl(0, 0.015, 0, 0.185, 0.165, 0.05, 12, C.band, 0, { noTop: true });
  mb.cyl(0, 0.065, 0, 0.175, 0.145, 0.12, 12, C.hat, 0);
  mb.box(0, 0.17, 0, 0.06, 0.03, 0.22, mulc(C.hat, 0.8), 0);
  add('hat', mb);
  // arms: upper arm from the shoulder, forearm + hand from the elbow, both hang along -y
  for (const side of ['L', 'R']) {
    mb = new MB();
    mb.box(0, -RIG.upper - 0.02, 0, 0.13, RIG.upper + 0.06, 0.14, C.shirt, 9, { bottom: true });
    add('uArm' + side, mb);
    mb = new MB();
    mb.box(0, -0.2, 0, 0.12, 0.22, 0.13, C.shirt, 9, { bottom: true });
    mb.box(0, -0.205, 0, 0.125, 0.04, 0.135, mulc(C.shirt, 0.88), 9);
    mb.box(0, -0.3, 0.005, 0.1, 0.1, 0.11, C.skin, 0, { bottom: true });
    add('fArm' + side, mb);
    // legs
    mb = new MB();
    mb.box(0, -RIG.thigh - 0.03, 0, 0.19, RIG.thigh + 0.07, 0.21, C.jeans, 9, { bottom: true });
    add('thigh' + side, mb);
    mb = new MB();
    mb.box(0, -0.2, 0, 0.18, 0.22, 0.19, C.jeansD, 9, { bottom: true });
    mb.box(0, -RIG.shin, 0, 0.2, 0.24, 0.215, C.boot, 0, { bottom: true });
    mb.box(0, -0.2, 0, 0.215, 0.035, 0.225, mulc(C.boot, 0.8), 0);
    add('shin' + side, mb);
    // boot: origin at the ankle, toe along +z, sole at -ankleH
    mb = new MB();
    mb.box(0, -RIG.ankleH + 0.02, (RIG.toeF - RIG.heelB) / 2 + 0.005, 0.2, 0.1, RIG.toeF + RIG.heelB + 0.01, C.boot, 0, { bottom: true });
    mb.box(0, -RIG.ankleH, 0.03, 0.2, 0.025, RIG.toeF * 2 - 0.05, C.sole, 0, { bottom: true });
    mb.box(0, -RIG.ankleH, -RIG.heelB + 0.025, 0.18, 0.045, 0.06, C.sole, 0, { bottom: true });
    add('foot' + side, mb);
  }
  add('gun', buildGunGeo());
  const ch = { root, p, parts: Object.values(p), pose: makePose() };
  applyPose(ch);
  return ch;
}

function makePose() {
  return {
    pel: new THREE.Vector3(0, RIG.hipY - 0.02, 0), pelYaw: 0, pelPitch: 0, pelRoll: 0,
    spYaw: 0, spPitch: 0, spRoll: 0, hdYaw: 0, hdPitch: 0, hatDy: 0, hatTilt: 0,
    ank: [new THREE.Vector3(0.12, RIG.ankleH, 0), new THREE.Vector3(-0.12, RIG.ankleH, 0)],
    ftYaw: [0, 0], ftPitch: [0, 0],
    arm: [{ sw: 0, out: 0.08, el: 0.15 }, { sw: 0, out: 0.08, el: 0.15 }]
  };
}

/* ---------- pose -> part matrices (all relative to the character root) ---------- */
const RM = {
  pel: new THREE.Matrix4(), tor: new THREE.Matrix4(), head: new THREE.Matrix4(), tmp: new THREE.Matrix4(), e: new THREE.Euler(),
  H: new THREE.Vector3(), K: new THREE.Vector3(), A: new THREE.Vector3(), d: new THREE.Vector3(), pole: new THREE.Vector3(),
  x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3()
};
function rotTo(m, x, y, z, rx, ry, rz, order) {
  RM.e.set(rx, ry, rz, order || 'YXZ');
  m.makeRotationFromEuler(RM.e);
  m.setPosition(x, y, z);
  return m;
}
function boneBasis(m, top, bottom, pole) {
  RM.y.subVectors(top, bottom).normalize();
  RM.z.copy(pole).addScaledVector(RM.y, -pole.dot(RM.y)).normalize();
  RM.x.crossVectors(RM.y, RM.z);
  m.makeBasis(RM.x, RM.y, RM.z);
  m.setPosition(top);
}
function applyPose(ch) {
  const P = ch.pose, p = ch.p;
  rotTo(RM.pel, P.pel.x, P.pel.y, P.pel.z, P.pelPitch, P.pelYaw, P.pelRoll);
  p.pelvis.matrix.copy(RM.pel);
  RM.tor.multiplyMatrices(RM.pel, rotTo(RM.tmp, 0, RIG.waistY, 0, P.spPitch, P.spYaw, P.spRoll));
  p.torso.matrix.copy(RM.tor);
  RM.head.multiplyMatrices(RM.tor, rotTo(RM.tmp, 0, RIG.neckY, 0, P.hdPitch, P.hdYaw, P.hdRoll || 0));
  p.head.matrix.copy(RM.head);
  p.hat.matrix.multiplyMatrices(RM.head, rotTo(RM.tmp, 0, RIG.headTop + P.hatDy, 0, P.hatTilt, 0, 0));
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1, a = P.arm[i], side = i === 0 ? 'L' : 'R';
    const ua = p['uArm' + side], fa = p['fArm' + side];
    // an arm can be taken over (gun, reloading): blend from the walking swing to the override
    let sw = a.sw, out = a.out, el = a.el, yw = 0;
    const o = P.armOv && P.armOv[i];
    if (o && o.w > 0.001) { sw += (o.sw - sw) * o.w; out += (o.out - out) * o.w; el += (o.el - el) * o.w; yw = o.yw * o.w; }
    ua.matrix.multiplyMatrices(RM.tor, rotTo(RM.tmp, s * RIG.shoulderX, RIG.shoulderY, 0, -sw, yw, s * out, 'ZYX'));
    fa.matrix.multiplyMatrices(ua.matrix, rotTo(RM.tmp, 0, -RIG.upper, 0, -el, 0, 0));
    // two-bone leg IK: hip -> knee -> ankle, knee pointing where the foot points
    const L1 = RIG.thigh, L2 = RIG.shin;
    RM.H.set(s * RIG.hipX, 0, 0).applyMatrix4(RM.pel);
    RM.d.subVectors(P.ank[i], RM.H);
    const dist = clamp(RM.d.length(), 0.08, L1 + L2 - 1e-4);
    RM.d.normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const fy = P.ftYaw[i];
    RM.pole.set(Math.sin(fy) + Math.sin(P.pelYaw) + s * 0.12, 0, Math.cos(fy) + Math.cos(P.pelYaw));
    RM.pole.addScaledVector(RM.d, -RM.pole.dot(RM.d)).normalize();
    RM.K.copy(RM.H).addScaledVector(RM.d, cosA * L1).addScaledVector(RM.pole, sinA * L1);
    RM.A.copy(RM.H).addScaledVector(RM.d, dist);
    boneBasis(p['thigh' + side].matrix, RM.H, RM.K, RM.pole);
    boneBasis(p['shin' + side].matrix, RM.K, RM.A, RM.pole);
    rotTo(p['foot' + side].matrix, RM.A.x, RM.A.y, RM.A.z, P.ftPitch[i], fy, 0);
  }
  if (p.gun) p.gun.matrix.multiplyMatrices(P.gunInHand ? p.fArmR.matrix : RM.pel, P.gunInHand ? GUNM.hand : GUNM.holster);
  for (const m of ch.parts) m.matrixWorldNeedsUpdate = true;
}

/* ---------- gait parameters as a function of speed ---------- */
function gaitParams(s) {
  const k = smoothstep(3.0, 4.8, s);                       // 0 = walk, 1 = run
  const cycleLen = lerp(0.78 + 0.32 * s, 1.25 + 0.36 * s, k); // metres per full cycle (two steps)
  const duty = lerp(0.6, 0.31, k);                          // share of the cycle a foot is on the ground
  return { k, cycleLen, duty, freq: s / cycleLen };
}
// foot rolls over the toe (pitch > 0, heel up) or rocks on the heel (pitch < 0, toe up)
function ankleFrom(gp, yaw, pitch, lift, out) {
  let f, y;
  if (pitch >= 0) {
    const c = Math.cos(pitch), sn = Math.sin(pitch);
    f = RIG.toeF * (1 - c) + RIG.ankleH * sn; y = RIG.toeF * sn + RIG.ankleH * c;
  } else {
    const c = Math.cos(-pitch), sn = Math.sin(-pitch);
    f = -RIG.heelB + RIG.heelB * c - RIG.ankleH * sn; y = RIG.heelB * sn + RIG.ankleH * c;
  }
  return out.set(gp.x + Math.sin(yaw) * f, gp.y + y + lift, gp.z + Math.cos(yaw) * f);
}
function stancePitch(st, k) {
  const contact = lerp(-0.32, -0.05, k);
  let p = lerp(contact, 0, smoothstep(0, lerp(0.17, 0.08, k), st));
  const off = lerp(0.6, 0.42, k);
  if (st > off) p += Math.pow((st - off) / (1 - off), 1.4) * lerp(0.55, 0.8, k);
  return p;
}
const SW = { e: 0, lift: 0, pitch: 0, kick: 0 };
function swingShape(t, k, s, p0) {
  const eW = t * t * (3 - 2 * t);
  const eR = smoothstep(0.12, 0.96, t);
  SW.e = lerp(eW, eR, k);
  SW.kick = k * 0.16 * Math.sin(Math.PI * Math.min(1, t / 0.5)) * (1 - t);
  const amp = Math.min(1, s / 1.2);
  SW.lift = (0.085 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - k) + 0.36 * Math.sin(Math.PI * Math.pow(t, 0.62)) * k) * amp;
  const pMid = lerp(0.18, 0.95, k), pLand = lerp(-0.32, -0.05, k);
  SW.pitch = t < 0.35 ? lerp(p0, pMid, smoothstep(0, 0.35, t)) : lerp(pMid, pLand, smoothstep(0.35, 0.95, t));
  return SW;
}

/* ---------- body: pelvis, spine, head, arms from the feet and the gait phase ---------- */
function poseBody(P, o) {
  // o: { s, k, duty, phase, amp, bank, acc, time, look, smooth }
  const k = o.k, amp = o.amp, mid = o.duty / 2;
  const c1 = Math.cos(TAU * (o.phase - mid)), c2 = Math.cos(2 * TAU * (o.phase - mid));
  const breath = Math.sin(o.time * 2.1);
  const idleY = RIG.hipY - 0.02 + breath * 0.004;
  const moveY = lerp(RIG.hipY - 0.05, RIG.hipY - 0.1, k) + lerp(0.022, -0.055, k) * c2;
  P.pel.set(lerp(0, lerp(0.032, 0.012, k) * c1, amp), lerp(idleY, moveY, amp), lerp(0, -0.03, k) * amp);
  const zL = P.ank[0].z, zR = P.ank[1].z, dz = zR - zL;
  P.pelYaw = clamp((zR - zL) * lerp(0.26, 0.15, k), -0.3, 0.3);
  P.pelPitch = lerp(0.02, 0.1, k) * amp;
  P.pelRoll = lerp(0.055, 0.03, k) * amp * c1 - o.bank * 0.5;
  P.spYaw = -P.pelYaw * 1.55;
  P.spPitch = lerp(0.03, 0.2, k) * amp + o.acc + breath * 0.012 * (1 - amp);
  P.spRoll = -P.pelRoll * 0.7 - o.bank * 0.6;
  P.hdYaw = -(P.pelYaw + P.spYaw) * 0.9 + o.look;
  P.hdPitch = -(P.pelPitch + P.spPitch) * 0.75 + 0.025 * c2 * amp * (1 - k);
  const tgt = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    const sw = clamp(dz * s * lerp(0.72, 0.62, k) + 0.12 * k * amp, -0.8, 1.05);
    const idleSw = 0.03 * breath;
    tgt.push({
      sw: lerp(idleSw, sw, amp),
      el: lerp(0.14, lerp(0.16 + 0.45 * Math.max(0, sw), 1.4 + 0.25 * Math.max(0, sw), k), amp),
      out: lerp(0.07, lerp(0.09, 0.15, k), amp)
    });
  }
  for (let i = 0; i < 2; i++) {
    const a = P.arm[i], t = tgt[i], f = o.smooth;
    a.sw += (t.sw - a.sw) * f; a.el += (t.el - a.el) * f; a.out += (t.out - a.out) * f;
  }
}

/* ---------- live gait: feet planted in the world ---------- */
const GAIT = {
  init: false, phase: 0, moving: false, s: 0, k: 0, duty: 0.6, freq: 0, cycleLen: 1,
  yawPrev: null, yawRate: 0, vPrev: 0, acc: 0, idleT: 0, look: 0, lookTo: 0, lookNext: 3,
  hatY: 0, hatV: 0, pelYPrev: null, pelVPrev: 0, lastT: null,
  feet: [0, 1].map(() => ({ plant: new THREE.Vector3(), yaw: 0, swing: false, idle: false, from: new THREE.Vector3(), fromYaw: 0,
    to: new THREE.Vector3(), toYaw: 0, t: 0, pitch: 0, p0: 0, gp: new THREE.Vector3(), cur: new THREE.Vector3(), curYaw: 0 }))
};
const _gv = new THREE.Vector3();
function wrapA(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function restPoint(i, pos, yaw, out) {
  const s = i === 0 ? 1 : -1, w = 0.12;
  out.set(pos.x + Math.cos(yaw) * s * w, 0, pos.z - Math.sin(yaw) * s * w);
  out.y = groundAt(out.x, out.z, pos.y);
  return out;
}
function beginSwing(F, idle, pos, yaw) {
  F.swing = true; F.idle = idle; F.t = 0; F.p0 = F.pitch;
  F.from.copy(F.plant); F.fromYaw = F.yaw;
  const dx = F.plant.x - pos.x, dz = F.plant.z - pos.z, c = Math.cos(-yaw), s = Math.sin(-yaw);
  F.relX = dx * c + dz * s; F.relZ = -dx * s + dz * c;
  if (!idle) SFX.scuff(GAIT.s, GAIT.k);
  F.to.copy(F.plant); F.toYaw = F.yaw;
}
function landFoot(F, hard) {
  F.swing = false; F.idle = false; F.t = 0;
  F.plant.copy(F.to); F.yaw = F.toYaw;
  if (hard > 0) DUST.burst(F.plant, F.yaw, hard);
  SFX.step(GAIT.s, GAIT.k, F === GAIT.feet[0] ? 1 : -1, onPlanks(F.plant.x, F.plant.z, F.plant.y));
}

function updateGait() {
  const g = GAIT, ch = W.ch, P = ch.pose, pos = PLAY.pos, yaw = PLAY.yaw;
  const dt = g.lastT === null ? 0 : clamp(G.time - g.lastT, 0, 0.1);
  g.lastT = G.time; g.dt = dt;
  if (!g.init) {
    g.feet.forEach((F, i) => { restPoint(i, pos, yaw, F.plant); F.yaw = yaw; });
    g.init = true;
  }
  // sitting: the seat has the whole pose
  if (typeof SIT !== 'undefined' && SIT.owns()) { SIT.pose(P, dt); g.yawPrev = yaw; g.vPrev = 0; g.s = 0; applyPose(ch); return; }
  const sp = Math.hypot(PLAY.vx, PLAY.vz);
  g.s += (sp - g.s) * (1 - Math.exp(-dt * 12));
  const s = g.s;
  const gp = gaitParams(Math.max(s, 0.3));
  g.k = gp.k; g.duty = gp.duty; g.freq = s / gp.cycleLen; g.cycleLen = gp.cycleLen;
  const k = gp.k, duty = gp.duty, freq = g.freq;
  if (dt > 0) {
    const dy = wrapA(yaw - (g.yawPrev === null ? yaw : g.yawPrev));
    g.yawRate += (dy / dt - g.yawRate) * (1 - Math.exp(-dt * 8));
    g.acc += (clamp((sp - g.vPrev) / dt, -20, 20) - g.acc) * (1 - Math.exp(-dt * 5));
  }
  g.yawPrev = yaw; g.vPrev = sp;

  const wasMoving = g.moving;
  g.moving = s > (wasMoving ? 0.2 : 0.35);
  if (g.moving && !wasMoving) {
    // start the cycle on the foot that is already stepping, or on the back foot
    let i = g.feet[0].swing ? 0 : g.feet[1].swing ? 1 : -1, lc;
    if (i >= 0) { lc = duty + g.feet[i].t * (1 - duty); g.feet[i].idle = false; }
    else {
      const v0 = (g.feet[0].plant.x - pos.x) * PLAY.vx + (g.feet[0].plant.z - pos.z) * PLAY.vz;
      const v1 = (g.feet[1].plant.x - pos.x) * PLAY.vx + (g.feet[1].plant.z - pos.z) * PLAY.vz;
      i = v0 < v1 ? 0 : 1; lc = duty + 0.001;
    }
    g.phase = ((lc - i * 0.5) % 1 + 1) % 1;
  }
  if (g.moving) g.phase = (g.phase + freq * dt) % 1;

  const vl = Math.max(sp, 0.01);
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw), cY = Math.cos(yaw), sY = Math.sin(yaw);
  for (let i = 0; i < 2; i++) {
    const F = g.feet[i], sideS = i === 0 ? 1 : -1;
    const local = (g.phase + i * 0.5) % 1;
    let lift = 0, pitch;
    if (g.moving) {
      const inSwing = local >= duty;
      const rate = freq / (1 - duty);
      if (inSwing && !F.swing) beginSwing(F, false, pos, yaw);
      if (F.swing) {
        F.idle = false;
        if (inSwing) {
          const tP = (local - duty) / (1 - duty);
          F.t = Math.min(1, F.t + Math.max(rate * dt * 0.5, (tP - F.t) * (1 - Math.exp(-dt * 18))));
        } else {
          F.t = Math.min(1, F.t + rate * dt * 1.4);
        }
        // the swinging foot travels in body space: from where it left the ground to a spot just ahead of the hip
        const ahead = duty * gp.cycleLen * lerp(0.5, 0.4, k);
        const lat = lerp(0.12, 0.07, k) * sideS;
        const vdx = PLAY.vx / vl, vdz = PLAY.vz / vl;
        // steps sideways and backwards are shorter than steps forward
        const lvx = vdx * cy + vdz * sy, lvz = -vdx * sy + vdz * cy;
        let tlx = sp > 0.05 ? lat + lvx * ahead * 0.55 : lat;
        const tlz = sp > 0.05 ? lvz * ahead * (lvz < 0 ? 0.7 : 1) : 0;
        // never land beyond the other foot: side-stepping brings the trailing foot up to the leading one, not across it
        const O = P.ank[1 - i];
        if (Math.abs(tlz - O.z) < 0.42) tlx = sideS > 0 ? Math.max(tlx, O.x + 0.15) : Math.min(tlx, O.x - 0.15);
        const sh = swingShape(F.t, k, s, F.p0);
        let rx = lerp(F.relX, tlx, sh.e);
        const rz = lerp(F.relZ, tlz, sh.e) - sh.kick;
        // on the way past the standing foot, swing around it rather than through it
        if (Math.abs(rz - O.z) < 0.34) rx = sideS > 0 ? Math.max(rx, O.x + 0.13) : Math.min(rx, O.x - 0.13);
        const wx = pos.x + rx * cY + rz * sY, wz = pos.z - rx * sY + rz * cY;
        F.gp.set(wx, lerp(F.from.y, groundAt(wx, wz, pos.y + 0.4), sh.e), wz);
        F.toYaw = yaw;
        F.curYaw = F.fromYaw + wrapA(yaw - F.fromYaw) * sh.e;
        lift = sh.lift; pitch = sh.pitch;
        if (F.t >= 1 || (!inSwing && F.t > 0.85)) { F.to.copy(F.gp); landFoot(F, s > 0.8 ? lerp(1, 4, k) : 0); }
      } else {
        F.gp.copy(F.plant); F.curYaw = F.yaw;
        pitch = stancePitch(Math.min(local / duty, 1), k);
        // a planted foot slowly turns with the body if the gap gets large
        const dyaw = wrapA(yaw - F.yaw);
        if (Math.abs(dyaw) > 0.7) F.yaw += dyaw * (1 - Math.exp(-dt * 6));

      }
    } else {
      if (F.swing) {
        restPoint(i, pos, yaw, F.to); F.toYaw = yaw;
        F.t = Math.min(1, F.t + dt / (F.idle ? 0.24 : 0.16));
        if (F.t >= 1) landFoot(F, 0);
      }
      if (F.swing) {
        const e = F.t * F.t * (3 - 2 * F.t);
        F.gp.lerpVectors(F.from, F.to, e);
        F.curYaw = F.fromYaw + wrapA(F.toYaw - F.fromYaw) * e;
        lift = 0.06 * Math.sin(Math.PI * F.t);
        pitch = lerp(F.p0, 0, smoothstep(0, 0.6, F.t)) + 0.12 * Math.sin(Math.PI * F.t);
      } else {
        F.gp.copy(F.plant); F.curYaw = F.yaw;
        pitch = F.pitch * Math.exp(-dt * 10);
      }
    }
    F.pitch = pitch;
    ankleFrom(F.gp, F.curYaw, pitch, lift, F.cur);
  }
  // standing: re-plant one foot at a time when it drifts away from its rest spot (also turns on the spot)
  if (!g.moving && !g.feet[0].swing && !g.feet[1].swing) {
    g.idleT += dt;
    let worst = -1, err = 0;
    g.feet.forEach((F, i) => {
      restPoint(i, pos, yaw, _gv);
      const e = Math.hypot(F.plant.x - _gv.x, F.plant.z - _gv.z) + Math.abs(wrapA(yaw - F.yaw)) * 0.25;
      if (e > err) { err = e; worst = i; }
    });
    if (err > 0.13 && g.idleT > 0.05) { beginSwing(g.feet[worst], true, pos, yaw); g.idleT = 0.0; }
  } else if (g.moving) g.idleT = 0;

  // a planted foot left far behind (sharp turn, reversal, strafing) takes a quick catch-up step at once,
  // walking or standing, instead of the hips sinking towards the ground to reach it
  for (let i = 0; i < 2; i++) {
    const F = g.feet[i];
    if (F.swing) continue;
    const sideS = i === 0 ? 1 : -1, hx = pos.x + sideS * RIG.hipX * cY, hz = pos.z - sideS * RIG.hipX * sY;
    if (Math.hypot(F.plant.x - hx, F.plant.z - hz) > 0.6) { beginSwing(F, !g.moving, pos, yaw); g.idleT = 0; }
  }
  // feet into character space
  for (let i = 0; i < 2; i++) {
    const F = g.feet[i];
    const dx = F.cur.x - pos.x, dz2 = F.cur.z - pos.z;
    P.ank[i].set(dx * cy + dz2 * sy, F.cur.y - pos.y, -dx * sy + dz2 * cy);
    P.ftYaw[i] = wrapA(F.curYaw - yaw);
    P.ftPitch[i] = F.pitch;
  }
  // look around when standing, look into turns when moving
  if (!g.moving && g.idleT > 2.5) {
    g.lookNext -= dt;
    if (g.lookNext <= 0) { g.lookTo = (Math.random() - 0.5) * 1.1; g.lookNext = 2 + Math.random() * 3; }
  } else { g.lookTo = clamp(g.yawRate * 0.12, -0.35, 0.35); g.lookNext = 1.5; }
  g.look += (g.lookTo - g.look) * (1 - Math.exp(-dt * 3));
  const amp = clamp(s / 1.4, 0, 1);
  poseBody(P, {
    s, k, duty, phase: g.phase, amp, time: G.time, look: g.look,
    bank: clamp(g.yawRate * s * 0.05, -0.32, 0.32),
    acc: clamp(g.acc * 0.03, -0.16, 0.2),
    smooth: 1 - Math.exp(-dt * lerp(13, 20, k))
  });
  // keep stance legs within reach: lower the pelvis if needed (downhill, long strides)
  const R = RIG.thigh + RIG.shin - 0.012;
  for (let i = 0; i < 2; i++) {
    if (g.feet[i].swing && g.feet[i].t > 0.12 && g.feet[i].t < 0.88) continue;
    const s2 = i === 0 ? 1 : -1;
    const hx = P.pel.x + Math.cos(P.pelYaw) * s2 * RIG.hipX, hz = P.pel.z - Math.sin(P.pelYaw) * s2 * RIG.hipX;
    const a = P.ank[i], hd2 = (a.x - hx) ** 2 + (a.z - hz) ** 2;
    const maxY = a.y + Math.sqrt(Math.max(R * R - hd2, 0.0001));
    if (P.pel.y > maxY) P.pel.y = maxY;
  }
  // ...but never squat more than a little: a foot still out of reach is about to step anyway
  P.pel.y = Math.max(P.pel.y, RIG.hipY - 0.2);
  // hat: a small spring that lags behind the head's vertical motion
  if (dt > 0) {
    const vy = g.pelYPrev === null ? 0 : (P.pel.y - g.pelYPrev) / dt;
    const ay = (vy - g.pelVPrev) / dt;
    g.pelYPrev = P.pel.y; g.pelVPrev = vy;
    g.hatV += (-300 * g.hatY - 16 * g.hatV - clamp(ay, -60, 60) * 0.35) * dt;
    g.hatY = clamp(g.hatY + g.hatV * dt, -0.025, 0.025);
  }
  P.hatDy = g.hatY; P.hatTilt = -g.hatY * 3 - P.spPitch * 0.15;
  PLAY.phase = g.phase * TAU;
  if (typeof GUN !== 'undefined' && GUN.P) { GUN.pose(P, dt); FIST.pose(P, dt); }
  applyPose(ch);
}

/* ---------- dust kicked up by footfalls: one dynamic mesh, no transparency ---------- */
const DUST = {
  N: 48, items: [],
  init(scene) {
    const tpl = new THREE.OctahedronGeometry(1, 0);
    this.tpl = tpl.attributes.position.array;
    tpl.computeVertexNormals();
    const nv = this.tpl.length / 3;
    this.nv = nv;
    const P = new Float32Array(this.N * nv * 3), N = new Float32Array(this.N * nv * 3), C = new Float32Array(this.N * nv * 3), T = new Float32Array(this.N * nv), UV = new Float32Array(this.N * nv * 2);
    const tn = tpl.attributes.normal.array;
    const rnd = mulberry32(5);
    for (let i = 0; i < this.N; i++) {
      const c = mixc(rgb(0xd9b88c), rgb(0xc49a6c), rnd());
      for (let v = 0; v < nv; v++) {
        N.set([tn[v * 3], tn[v * 3 + 1], tn[v * 3 + 2]], (i * nv + v) * 3);
        C.set(c, (i * nv + v) * 3);
      }
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 0.1 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    g.setAttribute('tile', new THREE.BufferAttribute(T, 1));
    g.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.next = 0;
    return this.mesh;
  },
  burst(at, yaw, n) {
    const count = Math.round(n);
    for (let j = 0; j < count; j++) {
      const it = this.items[this.next]; this.next = (this.next + 1) % this.N;
      const a = yaw + Math.PI + (Math.random() - 0.5) * 2.2, sp = 0.4 + Math.random() * 0.9;
      Object.assign(it, { alive: true, x: at.x + (Math.random() - 0.5) * 0.15, y: at.y + 0.03, z: at.z + (Math.random() - 0.5) * 0.15,
        vx: Math.sin(a) * sp, vy: 0.35 + Math.random() * 0.5, vz: Math.cos(a) * sp, age: 0, life: 0.45 + Math.random() * 0.35, size: 0.045 + Math.random() * 0.05 });
    }
  },
  update(dt) {
    const P = this.mesh.geometry.attributes.position.array, tpl = this.tpl, nv = this.nv;
    for (let i = 0; i < this.N; i++) {
      const it = this.items[i];
      let r = 0;
      if (it.alive) {
        it.age += dt;
        if (it.age >= it.life) it.alive = false;
        else {
          const damp = Math.exp(-dt * 4);
          it.vx *= damp; it.vz *= damp; it.vy = it.vy * damp - 0.4 * dt;
          it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
          const u = it.age / it.life;
          r = it.size * Math.min(1, u * 8) * Math.pow(1 - u, 0.8) * (1 + u * 1.5);
        }
      }
      for (let v = 0; v < nv; v++) {
        const o = (i * nv + v) * 3;
        P[o] = it.x + tpl[v * 3] * r; P[o + 1] = it.y + tpl[v * 3 + 1] * r; P[o + 2] = it.z + tpl[v * 3 + 2] * r;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
};
