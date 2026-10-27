/* ---------- gestures: what the hands (and head) say ----------
   Each gesture is a short movement of one or both hands in the character's frame (+x his left, +y up, +z ahead),
   written for the right hand (x < 0 is his right) and mirrored for the left (unless raw): arm(i, t, n) → { p: [x, y, z], pole, shape } or null (that
   arm is not used), head(t, P) for nods and shakes, dur (seconds; 0 = held until something else comes), face (a
   feeling for the face while it lasts). A gesture eases in and out (GESTURE.env); while it runs it overrides what
   the hands were doing (npc.js: hand targets are blended, never jump, and kept out of the body: GESTURE.safe).
   Used by the AI's actions ([aktion, …], npc/talk.js), by ready-made lines, by idle standing (IDLE) and as small
   beats while talking (beat). */
const GESTURES = {
  nod: { dur: 1.1, head: (t, P) => { P.hdPitch += Math.max(0, Math.sin(t * 9)) * 0.22 * Math.sin(Math.PI * Math.min(1, t / 1.1)); } },
  shake_head: { dur: 1.2, head: (t, P) => { P.hdYaw += Math.sin(t * 11) * 0.32 * Math.sin(Math.PI * Math.min(1, t / 1.2)); } },
  laugh: { dur: 1.4, face: 'happy',
    head: (t, P) => { const f = Math.sin(Math.PI * Math.min(1, t / 1.4)); P.hdPitch -= 0.28 * f; P.spPitch -= 0.1 * f; P.pel.y += Math.abs(Math.sin(t * 15)) * 0.012 * f; },
    arm: (i, t) => (i === 1 ? { p: [-0.05, 1.08 + Math.abs(Math.sin(t * 15)) * 0.015, 0.22], shape: { open: 0.6 } } : null) },
  // palms up, shoulders and brows up: "what do I know"
  shrug: { dur: 1.3, face: 'doubt',
    head: (t, P) => { const f = Math.sin(Math.PI * Math.min(1, t / 1.3)); P.hdRoll = (P.hdRoll || 0) + 0.15 * f; P.pel.y += 0.02 * f; },
    arm: (i) => ({ p: [-0.3, 1.06, 0.3], pole: [-1, -0.4, -0.4], shape: { open: 1 }, wrist: { x: -0.9, z: 0.3 } }) },
  wave: { dur: 1.5, face: 'amused',
    arm: (i, t) => (i === 1 ? { p: [-0.3 + Math.sin(t * 9) * 0.07, 1.78, 0.18], pole: [-1, 0, -0.2], shape: { open: 1 } } : null) },
  // come here: hand out, fingers curling in
  beckon: { dur: 1.6,
    arm: (i, t) => (i === 1 ? { p: [-0.15, 1.2, 0.45 - Math.max(0, Math.sin(t * 7)) * 0.08], shape: { open: 1 - Math.max(0, Math.sin(t * 7)), fist: Math.max(0, Math.sin(t * 7)) * 0.7 }, wrist: { x: -0.8, z: 0 } } : null) },
  // points: at the door, at you, or wherever n.gestTarget is
  point: { dur: 1.7, arm: (i, t, n) => (i === 1 ? { p: GESTURE.aimAt(n, 0.62), pole: [-1, -0.6, 0], shape: { point: 1 } } : null) },
  point_door: { dur: 1.8, arm: (i, t, n) => (i === 1 ? { p: GESTURE.aimAt(n, 0.62), pole: [-1, -0.6, 0], shape: { point: 1 } } : null) },
  point_you: { dur: 1.5, face: 'angry', arm: (i, t, n) => (i === 1 ? { p: GESTURE.aimAt(n, 0.58, true), pole: [-1, -0.6, 0], shape: { point: 1 } } : null) },
  fist_shake: { dur: 1.4, face: 'furious', arm: (i, t) => (i === 1 ? { p: [-0.24, 1.48 + Math.sin(t * 16) * 0.04, 0.34], pole: [-1, -0.5, -0.3], shape: { fist: 1 } } : null) },
  // easy now: both palms down, pressing the air
  calm_down: { dur: 1.8, arm: (i, t) => ({ p: [-0.2, 1.08 + Math.sin(t * 4) * 0.05, 0.42], pole: [-1, -0.6, -0.3], shape: { open: 1 }, wrist: { x: 0.9, z: 0 } }) },
  cross_arms: { dur: 0, raw: true, arm: (i) => (i === 0 ? { p: [-0.13, 1.22, 0.2], pole: [0.8, -0.8, 0.2], shape: { fist: 0.4 } } : { p: [0.12, 1.26, 0.23], pole: [-0.8, -0.8, 0.2], shape: { fist: 0.4 } }) },
  hands_hips: { dur: 0, arm: () => ({ p: [-0.27, 0.98, -0.02], pole: [-1, 0.1, -0.4], shape: { fist: 0.5 } }) },
  thumbs_belt: { dur: 0, arm: () => ({ p: [-0.12, 0.99, 0.17], pole: [-1, -0.7, -0.3], shape: { fist: 0.6 } }) },
  scratch_head: { dur: 1.9, face: 'doubt', arm: (i, t) => (i === 1 ? { p: [-0.1 + Math.sin(t * 14) * 0.02, 1.86, -0.02], pole: [-1, 0.4, 0.2], shape: { fist: 0.3 } } : null) },
  wipe_brow: { dur: 1.3, arm: (i, t) => (i === 1 ? { p: [lerp(-0.12, 0.08, clamp((t - 0.35) / 0.6, 0, 1)), 1.74, 0.2], pole: [-1, -0.2, 0], shape: { open: 0.8 }, wrist: { x: -0.5, z: 0 } } : null) },
  facepalm: { dur: 1.8, face: 'sad', head: (t, P) => { P.hdPitch += 0.3 * Math.sin(Math.PI * Math.min(1, t / 1.8)); },
    arm: (i) => (i === 1 ? { p: [0.0, 1.62, 0.24], pole: [-1, -0.5, 0], shape: { open: 1 }, wrist: { x: -0.6, z: 0 } } : null) },
  // a small hand movement on a word (talking)
  beat: { dur: 0.75, arm: (i, t, n) => (i === n.beatSide ? { p: [-0.17, 1.13 + Math.sin(Math.min(1, t / 0.4) * Math.PI) * 0.04, 0.34], pole: [-1, -0.7, -0.3], shape: { open: 0.8 }, wrist: { x: -0.4, z: 0 } } : null) }
};
const GESTURE = {
  // the actions the AI may choose (besides the trade's own: serve_…)
  AI: ['nod', 'laugh', 'shake_head', 'point_door', 'shrug', 'wave', 'beckon', 'point_you', 'fist_shake', 'calm_down', 'scratch_head', 'facepalm', 'cross_arms'],
  IDLE: ['cross_arms', 'hands_hips', 'thumbs_belt', 'cross_arms', 'scratch_head', 'wipe_brow'],
  IN: 0.28, OUT: 0.32,
  // how much of the gesture shows at time t (in and out)
  env(def, t, endT) {
    const a = clamp(t / this.IN, 0, 1), d = def.dur;
    if (endT !== null && endT !== undefined) return Math.min(a, 1 - clamp((t - endT) / this.OUT, 0, 1));
    if (!d) return a;
    return Math.min(a, clamp((d - t) / this.OUT, 0, 1));
  },
  // the right hand stretched out towards n.gestTarget (or you, or straight ahead), at length len
  _v: new THREE.Vector3(), _w: new THREE.Vector3(), _p: [0, 0, 0],
  aimAt(n, len, atPlayer) {
    let tgt = n.gestTarget;
    if (!tgt || atPlayer) tgt = this._w.set(PLAY.pos.x, PLAY.pos.y + 1.4, PLAY.pos.z);
    const l = n.toLocal(tgt, this._v), sh = this._p;
    l.y -= 1.45; l.x += 0.3; l.normalize();
    if (l.z < 0.2) { l.z = 0.2; l.normalize(); }
    sh[0] = -0.3 + l.x * len; sh[1] = 1.45 + l.y * len; sh[2] = l.z * len;
    return sh;
  },
  /* a hand target never inside the own body: pushed out of the torso, the belly and the head (in the torso's frame,
     after torsoInverse(P)); hands go round to the front or the side, not through */
  _t: new THREE.Vector3(),
  safe(p, w, belly) {
    const A = AIK, t = this._t.copy(p).applyMatrix4(A.inv), hx = 0.27 * (w || 1) + 0.05, hz = 0.15 + (belly || 0) * 0.08 + 0.05;
    // the trunk: from the hips (y -0.25) to the shoulders (0.5)
    if (t.y > -0.25 && t.y < 0.5 && Math.abs(t.x) < hx && t.z > -hz && t.z < hz) {
      const ox = hx - Math.abs(t.x), oz = hz - t.z;
      if (oz < ox || t.z > 0) t.z = hz; else t.x = Math.sign(t.x || 1) * hx;
    }
    // the head: a ball
    const hy = RIG.neckY + 0.17, dx = t.x, dy = t.y - hy, dz = t.z - 0.01, d = Math.hypot(dx, dy, dz);
    if (d < 0.2 && d > 1e-4) { const k = 0.2 / d; t.set(dx * k, hy + dy * k, 0.01 + dz * k); }
    return p.copy(t).applyMatrix4(A.tor);
  }
};
