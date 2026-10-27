/* ---------- the cowboy: 13 rigid parts on a procedural rig ----------
   Legs use two-bone IK towards feet that are planted in the world, so a foot on the ground never slides.
   Everything else (pelvis bob, sway, hip twist, counter-rotating shoulders, arms, head, hat) follows the feet. */
const RIG = {
  hipY: 0.945, hipX: 0.115, thigh: 0.44, shin: 0.42, ankleH: 0.085, toeF: 0.165, heelB: 0.07,
  waistY: 0.14, neckY: 0.47, shoulderX: 0.305, shoulderY: 0.41, upper: 0.29, headTop: 0.31
};

/* ---------- the body, built from a description (char/look.js) ----------
   Every part is still built on its own, in its own frame (pelvis, torso, head, hat, upper arm, forearm, hand, thigh,
   shin, foot, gun), but all of them go into ONE skinned mesh: each vertex hangs rigidly on the bone of its part, so a
   figure costs one draw call. ch.p[name] is the bone (matrix, matrixWorld, children for bandages; .geometry: the
   part alone, for hit tests; .material: the figure's material; .visible = false folds the part away).
   The face and the hands have shapes (morph targets): brows, lids, mouth; fist, open hand, pointing finger. */
const MORPHS = ['browAngry', 'browSad', 'browUp', 'lid', 'mouthOpen', 'smile', 'frown', 'fistL', 'fistR', 'openL', 'openR', 'pointL', 'pointR'];
const FACE0 = { browAngry: 0, browSad: 0, browUp: 0, lid: 0, mouthOpen: 0, smile: 0, frown: 0 };

// the head: origin at the base of the neck, face to +z (front at z = 0.13). e: the face's shape (FACE0 keys, 0..1)
function buildHead(mb, L, e) {
  const O = L.outfit, skin = LOOK.skinCol(L), skinD = mulc(skin, 0.88), hair = L.hair.color, beard = L.beard.color;
  const dark = rgb(0x1e1612), white = rgb(0xeee6d8), lip = rgb(0x5a2620), mouthC = rgb(0x2a1210);
  const M = (x, y, z, rz) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(rz || 0));
  // neck, scarf, the head itself, ears
  mb.box(0, -0.03, 0, 0.13, 0.08, 0.13, skin, 0);
  if (O.bandana) { mb.box(0, -0.06, 0, 0.29, 0.09, 0.29, O.bandana, 9, { bottom: true }); mb.box(0, -0.15, 0.135, 0.16, 0.12, 0.03, O.bandana, 9, { bottom: true }); }
  else mb.box(0, -0.06, 0, 0.2, 0.07, 0.2, O.shirt.color, 9, { bottom: true });   // the collar
  mb.box(0, 0.035, 0, 0.26, 0.275, 0.26, skin, 0);
  for (const s of [-1, 1]) mb.box(s * 0.135, 0.12, 0, 0.02, 0.07, 0.05, skinD, 0);
  // eyes: white, a dark pupil, the upper lid coming down over them (lid 1 = shut)
  for (const s of [-1, 1]) {
    mb.box(s * 0.06, 0.163, 0.132, 0.058, 0.046, 0.012, white, 0);
    mb.box(s * 0.056, 0.168, 0.139, 0.026, 0.034, 0.006, dark, 0);
    const lh = 0.006 + 0.044 * e.lid;
    mb.box(s * 0.06, 0.212 - lh, 0.142, 0.066, lh, 0.008, skinD, 0);
  }
  // brows: up, frowned down at the inner end (angry), raised at the inner end (sad)
  const bw = 0.078, bh = 0.02 * (L.face.brows || 1);
  for (const s of [-1, 1]) {
    const y = 0.226 + e.browUp * 0.024 - e.browAngry * 0.012 + e.browSad * 0.006, a = s * (e.browAngry * 0.5 - e.browSad * 0.42);
    mb.push(M(s * 0.062, y, 0.143, a)); mb.box(0, -bh / 2, 0, bw, bh, 0.016, hair, 0); mb.pop();
  }
  // nose
  const nz = L.face.nose === 'big' ? [0.064, 0.074, 0.064] : L.face.nose === 'small' ? [0.042, 0.05, 0.04] : [0.05, 0.062, 0.05];
  mb.box(0, 0.105, 0.13, nz[0], nz[1], nz[2], skinD, 0);
  // mouth: a dark slot that opens downwards, teeth showing at the top, lip corners that go up (smile) or down
  const open = e.mouthOpen, sm = e.smile, fr = e.frown;
  mb.box(0, 0.058 - open * 0.03, 0.13, 0.082 + sm * 0.016, 0.014 + open * 0.03, 0.012, mouthC, 0);
  mb.box(0, 0.068 - open * 0.004, 0.126 + Math.min(1, open * 3) * 0.011, 0.06 + sm * 0.01, 0.002 + open * 0.009, 0.003, white, 0);   // (inside the head while shut)
  for (const s of [-1, 1]) {
    mb.push(M(s * (0.05 + sm * 0.012), 0.064 + sm * 0.016 - fr * 0.018 - open * 0.008, 0.137, s * (sm - fr) * 0.65));
    mb.box(0, -0.007, 0, 0.032, 0.014, 0.01, lip, 0); mb.pop();
  }
  // beard
  const st = L.beard.style;
  if (st === 'stubble' || st === 'full' || st === 'chops') mb.box(0, -0.0, 0.1295, 0.255, 0.105, 0.004, mixc(skin, beard, 0.45), 0);
  if (st === 'stache' || st === 'handlebar' || st === 'full' || st === 'stubble') mb.box(0, 0.077, 0.136, st === 'stubble' ? 0.11 : 0.14, st === 'stubble' ? 0.016 : 0.026, 0.016, st === 'stubble' ? mixc(skin, beard, 0.6) : beard, 0);
  if (st === 'handlebar') for (const s of [-1, 1]) { mb.push(M(s * 0.08, 0.085, 0.138, s * 0.9)); mb.box(0, 0, 0, 0.04, 0.016, 0.014, beard, 0); mb.pop(); }
  if (st === 'goatee') { mb.box(0, -0.005, 0.132, 0.06, 0.052, 0.03, beard, 0); mb.box(0, 0.077, 0.136, 0.1, 0.02, 0.014, beard, 0); }
  if (st === 'full') { mb.box(0, -0.035, 0.12, 0.25, 0.075, 0.05, beard, 0); for (const s of [-1, 1]) mb.box(s * 0.122, -0.01, 0.04, 0.03, 0.16, 0.17, beard, 0); }
  if (st === 'chops') for (const s of [-1, 1]) mb.box(s * 0.128, 0.03, 0.05, 0.022, 0.15, 0.13, beard, 0);
  // hair (under a hat only the sides and the back show)
  const hs = L.hair.style;
  if (hs === 'slick') {
    for (const s of [-1, 1]) mb.box(s * 0.07, 0.3, -0.005, 0.135, 0.04, 0.275, hair, 0);
    mb.box(0, 0.12, -0.138, 0.275, 0.2, 0.02, hair, 0);
    for (const s of [-1, 1]) mb.box(s * 0.138, 0.2, -0.04, 0.02, 0.11, 0.18, hair, 0);
  } else if (hs !== 'bald') {
    if (hs !== 'balding') { mb.box(0, 0.3, -0.005, 0.275, 0.04, 0.275, hair, 0); mb.box(0, 0.268, 0.134, 0.275, 0.05, 0.014, hair, 0); }
    mb.box(0, hs === 'long' ? -0.04 : 0.1, -0.139, 0.278, hs === 'long' ? 0.35 : 0.21, 0.022, hair, 0);
    for (const s of [-1, 1]) mb.box(s * 0.139, hs === 'long' ? 0.02 : 0.18, -0.03, 0.022, hs === 'long' ? 0.27 : 0.13, 0.2, hair, 0);
  }
  if (O.glasses) {
    const g = rgb(0x2a2420);
    for (const s of [-1, 1]) { mb.box(s * 0.06, 0.212, 0.148, 0.074, 0.008, 0.006, g, 0); mb.box(s * 0.06, 0.156, 0.148, 0.074, 0.008, 0.006, g, 0); for (const t of [-1, 1]) mb.box(s * 0.06 + t * 0.035, 0.156, 0.148, 0.007, 0.064, 0.006, g, 0); mb.box(s * 0.132, 0.19, 0.06, 0.008, 0.008, 0.16, g, 0); }
    mb.box(0, 0.19, 0.148, 0.03, 0.007, 0.006, g, 0);
  }
  if (O.bowtie) { mb.box(0, -0.115, 0.152, 0.13, 0.05, 0.025, O.bowtie, 0); mb.box(0, -0.115, 0.16, 0.035, 0.035, 0.02, mulc(O.bowtie, 0.7), 0); }
}
// a hand: origin at the wrist, hanging along -y, palm to the body, thumb to the front (+z). s: +1 left, -1 right.
// h: { fist, open, point } 0..1 (all 0: loosely curled)
function buildHand(mb, L, s, h) {
  const skin = LOOK.skinCol(L), skinD = mulc(skin, 0.9);
  const f = h.fist, o = h.open, pt = h.point;
  const mix = (r, F, Op) => r + f * (F - r) + o * (Op - r);
  mb.box(0, -0.075, 0, 0.088, 0.077, 0.1, skin, 0);                                   // palm and back of the hand
  // the four fingers (the index one on its own, so it can point)
  const fy = mix(-0.112, -0.098, -0.152), fh = mix(0.04, 0.03, 0.08), fz = mix(0.012, 0.024, -0.004), fd = mix(0.075, 0.058, 0.03);
  mb.box(-s * 0.012, fy, fz, 0.062, fh, fd, skinD, 0);
  const iy = lerp(fy, -0.165, pt), ih = lerp(fh, 0.08, pt), iz = lerp(fz, 0.03, pt), id = lerp(fd, 0.024, pt);
  mb.box(s * 0.031, iy, iz, 0.022, ih, id, skinD, 0);
  // the thumb: along the front; out to the side when open, across the fingers in a fist
  const ty = mix(-0.072, -0.095, -0.07), tz = mix(0.055, 0.06, 0.068), tx = mix(s * 0.012, -s * 0.005, s * 0.03);
  mb.box(tx, ty, tz, 0.026, mix(0.045, 0.026, 0.05), mix(0.028, 0.024, 0.024), skin, 0);
}

/* over: colours (older callers) or a full look description; opt: the older options (hat, gun, apron …) */
function buildCharacter(over, opt) {
  const L = over && over.outfit ? LOOK.make(over) : LOOK.from(over, opt);
  const O = L.outfit, skin = LOOK.skinCol(L), shirt = O.shirt.color, pants = O.pants.color, pantsD = mulc(pants, 0.84);
  const W = clamp(L.build.width || 1, 0.85, 1.2), belly = clamp(L.build.belly || 0, 0, 1);
  const parts = [];   // { name, mb, shape: fn(mb, params) | null }
  const add = (name, build, shape) => { const mb = new MB(); build(mb); parts.push({ name, mb, shape }); };
  // pelvis: origin at the hip-joint centre
  add('pelvis', (mb) => {
    mb.box(0, -0.1, 0, 0.44 * W, 0.27, 0.26 + belly * 0.04, pants, 9, { bottom: true });
    mb.box(0, 0.1, belly * 0.02, 0.47 * W, 0.09, 0.28 + belly * 0.05, O.belt, 0);
    mb.box(0, 0.11, 0.142 + belly * 0.045, 0.1, 0.07, 0.02, O.buckle, 0);
    if (O.gun) mb.box(-0.265 * W, -0.22, 0.02, 0.08, 0.3, 0.15, O.belt, 0, { bottom: true });
    if (O.apron) { mb.box(0, -0.46, 0.142 + belly * 0.04, 0.42, 0.6, 0.02, O.apron, 9); mb.box(0, 0.1, 0.152 + belly * 0.05, 0.48, 0.05, 0.015, mulc(O.apron, 0.85), 0); }
  });
  // torso: origin at the waist
  add('torso', (mb) => {
    mb.box(0, 0, 0, 0.48 * W, 0.47, 0.26, shirt, 9, { bottom: true });
    if (belly > 0.01) mb.box(0, 0.0, 0.125, 0.42 * W, 0.3, belly * 0.08, shirt, 9, { bottom: true });
    if (O.vest) {
      for (const s of [-1, 1]) mb.box(s * 0.13 * W, 0.03, 0.135 + belly * 0.07, 0.18 * W, 0.41, 0.03, O.vest, 9);
      mb.box(0, 0.03, -0.135, 0.46 * W, 0.41, 0.03, O.vest, 9);
    }
    if (O.apron) mb.box(0, 0.0, 0.14 + belly * 0.08, 0.3, 0.32, 0.015, O.apron, 9);
    mb.box(0, 0.47, 0, 0.36 * W, 0.03, 0.22, shirt, 9);
  });
  add('head', (mb) => buildHead(mb, L, FACE0), (mb, e) => buildHead(mb, L, Object.assign({}, FACE0, e)));
  // hat: origin on top of the head
  if (O.hat) add('hat', (mb) => {
    const H = O.hat;
    mb.cyl(0, -0.02, 0, 0.36, 0.36, 0.035, 14, H.color, 0, { bottom: true });
    mb.cyl(0, 0.015, 0, 0.185, 0.165, 0.05, 12, H.band, 0, { noTop: true });
    mb.cyl(0, 0.065, 0, 0.175, 0.145, 0.12, 12, H.color, 0);
    mb.box(0, 0.17, 0, 0.06, 0.03, 0.22, mulc(H.color, 0.8), 0);
  });
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    // arms: upper arm from the shoulder, forearm from the elbow (rolled sleeves show the skin), the hand at the wrist
    add('uArm' + side, (mb) => {
      mb.box(0, -RIG.upper - 0.02, 0, 0.13, RIG.upper + 0.06, 0.14, shirt, 9, { bottom: true });
      if (O.garter) mb.box(0, -0.13, 0, 0.14, 0.035, 0.15, O.garter, 0);
    });
    add('fArm' + side, (mb) => {
      if (O.shirt.rolled) { mb.box(0, -0.06, 0, 0.125, 0.08, 0.135, mulc(shirt, 0.92), 9, { bottom: true }); mb.box(0, -0.2, 0.005, 0.105, 0.15, 0.11, skin, 0, { bottom: true }); }
      else { mb.box(0, -0.2, 0, 0.12, 0.22, 0.13, shirt, 9, { bottom: true }); mb.box(0, -0.205, 0, 0.125, 0.04, 0.135, mulc(shirt, 0.88), 9); }
    });
    const h0 = { fist: 0, open: 0, point: 0 };
    add('hand' + side, (mb) => buildHand(mb, L, s, h0), (mb, e) => buildHand(mb, L, s, Object.assign({}, h0, e)));
    // legs
    add('thigh' + side, (mb) => mb.box(0, -RIG.thigh - 0.03, 0, 0.19, RIG.thigh + 0.07, 0.21, pants, 9, { bottom: true }));
    add('shin' + side, (mb) => {
      mb.box(0, -0.2, 0, 0.18, 0.22, 0.19, pantsD, 9, { bottom: true });
      mb.box(0, -RIG.shin, 0, 0.2, 0.24, 0.215, O.boots, 0, { bottom: true });
      mb.box(0, -0.2, 0, 0.215, 0.035, 0.225, mulc(O.boots, 0.8), 0);
    });
    // boot: origin at the ankle, toe along +z, sole at -ankleH
    add('foot' + side, (mb) => {
      const sole = rgb(0x2e1f17);
      mb.box(0, -RIG.ankleH + 0.02, (RIG.toeF - RIG.heelB) / 2 + 0.005, 0.2, 0.1, RIG.toeF + RIG.heelB + 0.01, O.boots, 0, { bottom: true });
      mb.box(0, -RIG.ankleH, 0.03, 0.2, 0.025, RIG.toeF * 2 - 0.05, sole, 0, { bottom: true });
      mb.box(0, -RIG.ankleH, -RIG.heelB + 0.025, 0.18, 0.045, 0.06, sole, 0, { bottom: true });
    });
  }
  if (O.gun) parts.push({ name: 'gun', mb: buildGunGeo() });
  return skinFigure(parts, L);
}

// the parts into one skinned mesh: bones with identity bind (vertices stay in their part's frame), morphs as deltas
function skinFigure(parts, L) {
  const root = new THREE.Group(), p = {}, bones = [];
  const geos = parts.map((q) => q.geo || q.mb.build());
  let nv = 0; for (const g of geos) nv += g.attributes.position.count;
  const A = { position: new Float32Array(nv * 3), normal: new Float32Array(nv * 3), color: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), tile: new Float32Array(nv) };
  const SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
  const morph = MORPHS.map(() => new Float32Array(nv * 3));
  let o = 0;
  parts.forEach((q, bi) => {
    const g = geos[bi], n = g.attributes.position.count;
    for (const k in A) { const src = g.attributes[k]; if (src) A[k].set(src.array, o * src.itemSize); }
    for (let i = 0; i < n; i++) { SI[(o + i) * 4] = bi; SW[(o + i) * 4] = 1; }
    // shapes: each morph is the part built with that one shape at full, minus the plain part
    if (q.shape) for (let mi = 0; mi < MORPHS.length; mi++) {
      const name = MORPHS[mi], side = /[LR]$/.test(name) ? name.slice(-1) : '', key = side ? name.slice(0, -1) : name;
      if ((q.name === 'head') !== (name in FACE0) || (side && q.name !== 'hand' + side)) continue;
      const mb = new MB(); q.shape(mb, { [key]: 1 });
      const P2 = mb.P, P0 = g.attributes.position.array;
      if (P2.length !== P0.length) continue;   // (a shape that changed the number of triangles is left out)
      const D = morph[mi];
      for (let j = 0; j < P0.length; j++) D[o * 3 + j] = P2[j] - P0[j];
    }
    const b = new THREE.Bone(); b.name = q.name; b.matrixAutoUpdate = false; b.geometry = g;
    root.add(b); bones.push(b); p[q.name] = b;
    o += n;
  });
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(A.position, 3));
  G.setAttribute('normal', new THREE.BufferAttribute(A.normal, 3));
  G.setAttribute('color', new THREE.BufferAttribute(A.color, 3));
  G.setAttribute('uv', new THREE.BufferAttribute(A.uv, 2));
  G.setAttribute('tile', new THREE.BufferAttribute(A.tile, 1));
  G.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  G.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  G.morphAttributes.position = morph.map((a, i) => { const at = new THREE.BufferAttribute(a, 3); at.name = MORPHS[i]; return at; });
  G.morphTargetsRelative = true;
  G.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.6);
  const mesh = new THREE.SkinnedMesh(G, G_LIT_PLACEHOLDER());
  mesh.frustumCulled = false; mesh.layers.enable(3); mesh.name = 'figure';
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
  mesh.updateMorphTargets();
  // the bones answer for the figure's material (code that sets a part's material sets the figure's)
  for (const b of bones) Object.defineProperty(b, 'material', { get: () => mesh.material, set: (m) => { if (m) mesh.material = m; } });
  const ch = { root, p, parts: bones, mesh, look: L, pose: makePose(), mi: mesh.morphTargetDictionary, face: null };
  applyPose(ch);
  return ch;
}
// (the figure's first material: the outdoor one once it exists)
function G_LIT_PLACEHOLDER() { return (typeof G !== 'undefined' && G.litMat) || new THREE.MeshBasicMaterial({ vertexColors: true }); }

function makePose() {
  return {
    pel: new THREE.Vector3(0, RIG.hipY - 0.02, 0), pelYaw: 0, pelPitch: 0, pelRoll: 0,
    spYaw: 0, spPitch: 0, spRoll: 0, hdYaw: 0, hdPitch: 0, hatDy: 0, hatTilt: 0,
    ank: [new THREE.Vector3(0.12, RIG.ankleH, 0), new THREE.Vector3(-0.12, RIG.ankleH, 0)],
    ftYaw: [0, 0], ftPitch: [0, 0],
    arm: [{ sw: 0, out: 0.08, el: 0.15 }, { sw: 0, out: 0.08, el: 0.15 }],
    // the hands' shapes (0..1) and the wrists' bend (rad: x forward/back, z sideways); reset with the gait every frame
    hand: [{ fist: 0, open: 0, point: 0 }, { fist: 0, open: 0, point: 0 }], wrist: [{ x: 0, z: 0 }, { x: 0, z: 0 }]
  };
}

/* ---------- pose -> part matrices (all relative to the character root) ---------- */
const RM = {
  pel: new THREE.Matrix4(), tor: new THREE.Matrix4(), head: new THREE.Matrix4(), tmp: new THREE.Matrix4(), e: new THREE.Euler(),
  H: new THREE.Vector3(), K: new THREE.Vector3(), A: new THREE.Vector3(), d: new THREE.Vector3(), pole: new THREE.Vector3(),
  x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), zero: new THREE.Vector3(1e-4, 1e-4, 1e-4)
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
    const hb = p['hand' + side], wr = P.wrist ? P.wrist[i] : null;
    if (hb) hb.matrix.multiplyMatrices(fa.matrix, rotTo(RM.tmp, 0, -0.2, 0, wr ? -wr.x : 0, 0, wr ? s * wr.z : 0));
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
  // the hands' shapes; a part that is not there (a hat knocked off, later a lost arm) is folded into its joint
  if (ch.mesh && P.hand) {
    const I = ch.mesh.morphTargetInfluences, D = ch.mi;
    for (let i = 0; i < 2; i++) { const h = P.hand[i], sd = i === 0 ? 'L' : 'R'; I[D['fist' + sd]] = h.fist; I[D['open' + sd]] = h.open; I[D['point' + sd]] = h.point; }
  }
  for (const m of ch.parts) { if (m.visible === false) m.matrix.scale(RM.zero); m.matrixWorldNeedsUpdate = true; }
}
