/* ---------- faces: small shapes, read from across the room ----------
   The head has seventeen shapes (char/rig.js FACE0): brows angry / sad / up / one up, upper lid, lower lid (squint),
   wide eyes, pupil size, where the pupils look (lookX, lookY), mouth open / round O, smile, frown, sneer, bared
   teeth, cheeks. A feeling is a mix of them (PRESETS) and has its own speed (surprise is there at once, sadness
   comes slowly). On top: blinking, the pupils (small in the sun, wide in the dark and in fear), the eyes on what
   he looks at with small jumps in between, the mouth following the voice (the loudness of the sentence being
   played, audio/voice.js: npc.lip) with the brows going up on the loud syllables, breathing through pain.
   FACE.update(ch, dt, want) once a frame per figure; FACE.npcWant(npc) and FACE.playerWant() say what each one
   feels right now: { mood, k, mood2, k2, talk, dead, sleep, light (0 bright .. 1 dark), look: {x, y} | null } */
const FACE = {
  KEYS: Object.keys(FACE0),
  PRESETS: {
    neutral: {},
    amused: { smile: 0.9, cheek: 0.8, squint: 0.45, browUp: 0.2 },
    happy: { smile: 1, cheek: 1, squint: 0.35, mouthOpen: 0.3, browUp: 0.35 },
    angry: { browAngry: 1, squint: 0.55, teeth: 0.55, frown: 0.35, lid: 0.12 },
    furious: { browAngry: 1, squint: 0.3, teeth: 1, mouthOpen: 0.35, eyeWide: 0.3, frown: 0.5 },
    surprised: { browUp: 1, eyeWide: 1, mouthO: 0.8, mouthOpen: 0.25 },
    disgusted: { browAngry: 0.5, sneer: 1, squint: 0.55, frown: 0.45 },
    doubt: { browOne: 1, browAngry: 0.25, sneer: 0.35, squint: 0.3 },
    sleepy: { lid: 0.62, browSad: 0.25, mouthOpen: 0.05 },
    whisper: { browUp: 0.3, lid: 0.12, mouthO: 0.15 },
    drunk: { lid: 0.48, smile: 0.45, cheek: 0.3, browUp: 0.25, mouthOpen: 0.1 },
    sad: { browSad: 1, frown: 0.85, lid: 0.3 },
    fear: { browSad: 0.75, browUp: 0.85, eyeWide: 0.9, mouthOpen: 0.25, teeth: 0.35, frown: 0.35 },
    pain: { browSad: 0.55, browAngry: 0.65, lid: 0.35, squint: 1, teeth: 0.85, mouthOpen: 0.15, frown: 0.5, cheek: 0.4 },
    scream: { browSad: 0.8, eyeWide: 0.6, mouthO: 0.5, mouthOpen: 1, browUp: 0.4 },
    dazed: { lid: 0.55, mouthOpen: 0.25, browSad: 0.35 },
    focus: { browAngry: 0.45, squint: 0.6 },
    dead: { lid: 0.78, mouthOpen: 0.35 },
    sleep: { lid: 1, mouthOpen: 0.08 }
  },
  // how quickly a feeling takes over the face (per second); the mouth always follows fast
  SPEED: { surprised: 22, fear: 18, scream: 20, pain: 16, furious: 14, angry: 10, sad: 3, sleepy: 3, dead: 6 },
  _t: {},
  update(ch, dt, want) {
    const F = ch.face || (ch.face = { cur: {}, blinkT: 1 + Math.random() * 3, blink: 0, sac: { x: 0, y: 0, t: 0 }, talkPrev: 0, beat: 0 }), T = this._t;
    for (const k of this.KEYS) T[k] = 0;
    const add = (name, k) => { const p = this.PRESETS[name]; if (!p || k <= 0) return; for (const key in p) T[key] = Math.max(T[key], p[key] * Math.min(1, k)); };
    add(want.mood || 'neutral', want.k === undefined ? 1 : want.k);
    if (want.mood2) add(want.mood2, want.k2 === undefined ? 1 : want.k2);
    const asleep = want.dead || want.sleep, t = G.time;
    // pain comes in waves with the breath
    if (T.squint > 0.6 && T.teeth > 0.5) { const w = 0.5 + 0.5 * Math.sin(t * 2.3); T.squint *= 0.8 + w * 0.2; T.teeth *= 0.7 + w * 0.3; }
    // the voice: the mouth opens with the loudness, rounds a little on the vowels, the brows lift on the loud bits;
    // a smile or a frown eases off while the mouth is busy
    const talk = clamp(want.talk || 0, 0, 1);
    if (talk > 0.02 || F.beat > 0.01) {
      T.mouthOpen = Math.max(T.mouthOpen, talk * 0.8); T.mouthO = Math.max(T.mouthO, talk * 0.3 * (0.5 + 0.5 * Math.sin(t * 9.3)));
      T.smile *= 0.75; T.frown *= 0.75; T.teeth *= 0.6;
      if (talk > 0.55 && talk - F.talkPrev > 0.15) F.beat = 1;
      T.browUp = Math.max(T.browUp, F.beat * 0.35);
    }
    F.talkPrev = talk; F.beat = Math.max(0, F.beat - dt * 3);
    // blinking: every few seconds, sometimes twice; never when dead or asleep
    if (!asleep) {
      F.blinkT -= dt;
      if (F.blinkT <= 0) { F.blink = 0.001; F.blinkT = 1.8 + Math.random() * 3.6; if (Math.random() < 0.15) F.blinkT = 0.25; }
    }
    if (F.blink > 0) { F.blink += dt; if (F.blink > 0.15) F.blink = 0; }
    const bl = F.blink > 0 ? Math.sin(Math.PI * F.blink / 0.15) : 0;
    // the eyes: on what he looks at, with small jumps now and then; dazed and dead, they drift and stare
    const S = F.sac; S.t -= dt;
    if (S.t <= 0) { S.t = want.mood === 'dazed' ? 1.5 : 0.6 + Math.random() * 2.2; S.x = (Math.random() - 0.5) * (want.look ? 0.3 : 0.9); S.y = (Math.random() - 0.5) * 0.5; }
    const L = want.look;
    T.lookX = clamp((L ? L.x : 0) + S.x * (want.dead ? 0 : 1), -1, 1); T.lookY = clamp((L ? L.y : 0) + S.y * (want.dead ? 0 : 1), -1, 1);
    if (want.dead) { T.lookX = 0.35; T.lookY = -0.3; }
    // the pupils: small in the sun, wide in the dark; fear and drink open them further
    T.pupil = lerp(-0.6, 0.9, clamp(want.light === undefined ? 0.3 : want.light, 0, 1)) + (want.mood === 'fear' || want.mood === 'surprised' ? 0.35 : 0) + (want.mood === 'drunk' ? 0.3 : 0);
    // ease towards it
    const C = F.cur, I = ch.mesh.morphTargetInfluences, D = ch.mi, sp = this.SPEED[want.mood] || 9;
    for (const k of this.KEYS) {
      const rate = k === 'mouthOpen' || k === 'mouthO' ? 28 : k === 'lookX' || k === 'lookY' ? 26 : k === 'pupil' ? 1.5 : k === 'lid' ? Math.max(12, sp) : sp;
      const c = C[k] || 0; C[k] = c + (T[k] - c) * (1 - Math.exp(-dt * rate));
      I[D[k]] = k === 'lid' ? Math.max(C[k], bl) : C[k];
    }
  },
  // the mouth from a played sentence (loudness per few ms), or talking movements while a voice without one speaks
  talkOf(npc) {
    const L = npc.lip, now = performance.now();
    if (L && now >= L.t0 && now < L.t0 + L.env.length * L.step) { const i = Math.floor((now - L.t0) / L.step); return clamp(L.env[i] * 1.15, 0, 1); }
    if (npc.talkT > 0 && !(L && now < L.t0 + L.env.length * L.step + 300)) { const t = G.time; return 0.15 + 0.45 * Math.abs(Math.sin(t * 13)) * (0.5 + 0.5 * Math.abs(Math.sin(t * 4.7))); }
    return 0;
  },
  // how dark it is around someone (0 bright sun .. 1 dark)
  dark(room) {
    const day = clamp((DAYNIGHT.sunEl + 4) / 20, 0, 1);
    return room ? lerp(0.95, 0.6, day) : 1 - day;
  },
  // where a point is for the eyes of a figure (pupil offsets -1..1), from its head bone
  _m: new THREE.Matrix4(), _v: new THREE.Vector3(), _look: { x: 0, y: 0 },
  lookOf(ch, p) {
    const v = this._v.copy(p).applyMatrix4(this._m.copy(ch.p.head.matrixWorld).invert());
    v.y -= 0.19; if (v.z < 0.05) return null;
    const L = this._look; L.x = clamp(Math.atan2(v.x, v.z) * 2.2, -1, 1); L.y = clamp(Math.atan2(v.y, v.z) * 2.5, -1, 1);
    return L;
  },
  _w: { mood: 'neutral', k: 1, mood2: null, k2: 0, talk: 0, dead: false, sleep: false, light: 0.3, look: null },
  // what a person shows: dead, down, in pain, afraid, fighting, what he last said, and how he feels about you
  npcWant(N) {
    const W = this._w, H = N.hp; W.mood = 'neutral'; W.k = 1; W.mood2 = null; W.k2 = 0; W.dead = false; W.sleep = false; W.look = null;
    W.light = this.dark(N.room);
    W.talk = this.talkOf(N);
    if (H.dead) { W.mood = 'dead'; W.dead = true; W.talk = 0; return W; }
    if (N.lookW > 0.2) W.look = this.lookOf(N.ch, N.look);
    if (H.anim) {
      // on the ground: dazed from blows; shot and bleeding: pain, and terror when a gun is on him
      W.mood = H.knocked && H.blood > 0.8 ? 'dazed' : 'pain'; W.mood2 = N.fear && G.time < N.fear ? 'fear' : 'pain'; W.k2 = clamp(H.pain, 0.3, 1);
      if (H.dying > 0) { W.mood = 'pain'; W.mood2 = 'sad'; W.k2 = 0.8; }
      return W;
    }
    if (N.mood && G.time < (N.moodT || 0)) W.mood = N.mood;
    else if (N.fear && G.time < N.fear) W.mood = 'fear';
    else if (N.fight && N.fight.on) W.mood = H.daze > 0.4 ? 'pain' : 'angry';
    else if (N.feel && N.feel.mood && G.time - N.feel.t < 25) { W.mood = N.feel.mood; W.k = 0.6; }   // (how the talk left him: talk.js)
    else if (N.attitude) { const f = N.attitude(); W.mood = f > 0.35 ? 'amused' : f < -0.35 ? 'angry' : 'neutral'; W.k = Math.min(1, Math.abs(f)) * 0.5; }
    if (H.pain > 0.25) { W.mood2 = 'pain'; W.k2 = clamp(H.pain - 0.2, 0, 1); }
    if (H.daze > 0.5) { W.mood2 = 'dazed'; W.k2 = H.daze - 0.4; }
    return W;
  },
  playerWant() {
    const Q = this._w; Q.mood = 'neutral'; Q.k = 1; Q.mood2 = null; Q.k2 = 0; Q.dead = false; Q.sleep = false; Q.talk = 0; Q.look = null;
    Q.light = this.dark(G.room);
    if (PHP.out) { Q.mood = 'dead'; Q.sleep = true; return Q; }
    if (typeof SLEEP !== 'undefined' && SLEEP.busy && SLEEP.busy() && SLEEP.st === 'run') { Q.mood = 'sleep'; Q.sleep = true; return Q; }
    if (G.time - PHP.lastHit < 0.7 || (FALL.busy() && FALL.down > 0.5)) Q.mood = 'pain';
    else if (FIST.st === 'charge' || (FIST.st !== 'idle' && FIST.heavy)) Q.mood = 'furious';
    else if (FIST.inFight() || FIST.st !== 'idle') Q.mood = 'angry';
    else if (GUN.wantAim) Q.mood = 'focus';
    else if (DRUNK.level > 0.25) { Q.mood = 'drunk'; Q.k = Math.min(1, DRUNK.level); }
    else if (PHP.hp < 0.5) { Q.mood = 'pain'; Q.k = (0.5 - PHP.hp) * 1.4; }
    if (DRUNK.level > 0.25 && Q.mood !== 'drunk') { Q.mood2 = 'drunk'; Q.k2 = Math.min(0.7, DRUNK.level); }
    // the eyes: on whoever is talking to you or close by
    for (const N of NPCS.list) if (!N.hp.dead && Math.hypot(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z) < 4 && (N.room || null) === (G.room || null)) { Q.look = this.lookOf(W.ch, this._v2.set(N.pos.x, N.pos.y + 1.6, N.pos.z)); break; }
    return Q;
  },
  _v2: new THREE.Vector3()
};
