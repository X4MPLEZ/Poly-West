/* ---------- the cowboy: 13 rigid parts on a procedural rig ----------
   Legs use two-bone IK towards feet that are planted in the world, so a foot on the ground never slides.
   Everything else (pelvis bob, sway, hip twist, counter-rotating shoulders, arms, head, hat) follows the feet. */
const RIG = {
  hipY: 0.945, hipX: 0.115, thigh: 0.44, shin: 0.42, ankleH: 0.085, toeF: 0.165, heelB: 0.07,
  waistY: 0.14, neckY: 0.47, shoulderX: 0.305, shoulderY: 0.41, upper: 0.29, headTop: 0.31
};

/* over: colours. opt (for NPCs): hat 'cowboy' | 'none' (then hair), gun (default true), apron, bowtie, garter colours */
function buildCharacter(over, opt) {
  const O = Object.assign({ hat: 'cowboy', gun: true }, opt || {});
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
  if (O.gun) mb.box(-0.265, -0.22, 0.02, 0.08, 0.3, 0.15, C.belt, 0, { bottom: true });
  if (O.apron) { mb.box(0, -0.46, 0.142, 0.42, 0.6, 0.02, O.apron, 9); mb.box(0, 0.1, 0.152, 0.48, 0.05, 0.015, mulc(O.apron, 0.85), 0); }
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
  if (O.hat === 'none') {
    // hair, parted in the middle and slicked down
    const hc = O.hair || rgb(0x2e2018);
    for (const s of [-1, 1]) mb.box(s * 0.07, 0.3, -0.005, 0.135, 0.04, 0.275, hc, 0);
    mb.box(0, 0.12, -0.138, 0.275, 0.2, 0.02, hc, 0);
    for (const s of [-1, 1]) mb.box(s * 0.138, 0.2, -0.04, 0.02, 0.11, 0.18, hc, 0);
  }
  if (O.bowtie) { mb.box(0, -0.115, 0.152, 0.13, 0.05, 0.025, O.bowtie, 0); mb.box(0, -0.115, 0.16, 0.035, 0.035, 0.02, mulc(O.bowtie, 0.7), 0); }
  add('head', mb);
  // hat: origin on top of the head
  if (O.hat !== 'none') {
    mb = new MB();
    mb.cyl(0, -0.02, 0, 0.36, 0.36, 0.035, 14, C.hat, 0, { bottom: true });
    mb.cyl(0, 0.015, 0, 0.185, 0.165, 0.05, 12, C.band, 0, { noTop: true });
    mb.cyl(0, 0.065, 0, 0.175, 0.145, 0.12, 12, C.hat, 0);
    mb.box(0, 0.17, 0, 0.06, 0.03, 0.22, mulc(C.hat, 0.8), 0);
    add('hat', mb);
  }
  // arms: upper arm from the shoulder, forearm + hand from the elbow, both hang along -y
  for (const side of ['L', 'R']) {
    mb = new MB();
    mb.box(0, -RIG.upper - 0.02, 0, 0.13, RIG.upper + 0.06, 0.14, C.shirt, 9, { bottom: true });
    if (O.garter) mb.box(0, -0.13, 0, 0.14, 0.035, 0.15, O.garter, 0);
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
  if (O.gun) add('gun', buildGunGeo());
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
  if (p.hat) p.hat.matrix.multiplyMatrices(RM.head, rotTo(RM.tmp, 0, RIG.headTop + P.hatDy, 0, P.hatTilt, 0, 0));
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
