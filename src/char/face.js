/* ---------- faces: a few shapes, read from across the room ----------
   The head has seven shapes (char/rig.js: brows angry / sad / up, lids, mouth open, smile, frown). A feeling is a mix
   of them (PRESETS); the face eases towards it, blinks now and then, and the mouth follows the voice (the loudness of
   the sentence being played, audio/voice.js: npc.lip) or, without one, makes talking movements.
   FACE.update(ch, dt, { mood, k, talk, dead, sleep }) once a frame per figure; FACE.npcWant(npc) and
   FACE.playerWant() say what each one feels right now. */
const FACE = {
  KEYS: ['browAngry', 'browSad', 'browUp', 'lid', 'mouthOpen', 'smile', 'frown'],
  PRESETS: {
    neutral: {},
    amused: { smile: 1, browUp: 0.3, lid: 0.18 },
    happy: { smile: 1, browUp: 0.45 },
    angry: { browAngry: 1, frown: 0.6, lid: 0.25 },
    surprised: { browUp: 1, mouthOpen: 0.65 },
    disgusted: { browAngry: 0.55, frown: 0.85, lid: 0.35 },
    sleepy: { lid: 0.62, browSad: 0.2 },
    whisper: { browUp: 0.25, lid: 0.12 },
    drunk: { lid: 0.45, smile: 0.5, browUp: 0.2 },
    sad: { browSad: 1, frown: 0.7, lid: 0.25 },
    fear: { browSad: 0.75, browUp: 0.85, mouthOpen: 0.35, frown: 0.35 },
    pain: { browSad: 0.55, browAngry: 0.6, lid: 0.7, mouthOpen: 0.35, frown: 1 },
    dazed: { lid: 0.55, mouthOpen: 0.2, browSad: 0.35 },
    focus: { browAngry: 0.45, lid: 0.32 },
    dead: { lid: 0.78, mouthOpen: 0.28 },
    sleep: { lid: 1 }
  },
  _t: {},
  update(ch, dt, want) {
    const F = ch.face || (ch.face = { cur: {}, blinkT: 1 + Math.random() * 3, blink: 0 }), T = this._t;
    for (const k of this.KEYS) T[k] = 0;
    // the feeling, at its strength, with a second one on top (pain over anything)
    const add = (name, k) => { const p = this.PRESETS[name]; if (!p || k <= 0) return; for (const key in p) T[key] = Math.max(T[key], p[key] * k); };
    add(want.mood || 'neutral', want.k === undefined ? 1 : want.k);
    if (want.mood2) add(want.mood2, want.k2 === undefined ? 1 : want.k2);
    // the mouth: the voice opens it; smiling and frowning ease off while it talks
    const talk = clamp(want.talk || 0, 0, 1);
    if (talk > 0.02) { T.mouthOpen = Math.max(T.mouthOpen, talk * 0.85); T.smile *= 0.7; T.frown *= 0.7; }
    // blinking: every few seconds, quicker when hurt or tired; never when dead or asleep
    const asleep = want.dead || want.sleep;
    if (!asleep) {
      F.blinkT -= dt;
      if (F.blinkT <= 0) { F.blink = 0.001; F.blinkT = 1.8 + Math.random() * 3.6; if (Math.random() < 0.15) F.blinkT = 0.25; }
    }
    if (F.blink > 0) { F.blink += dt; if (F.blink > 0.16) F.blink = 0; }
    const bl = F.blink > 0 ? Math.sin(Math.PI * F.blink / 0.16) : 0;
    // ease towards it (the mouth fast, brows a little slower, the lids in between)
    const C = F.cur, I = ch.mesh.morphTargetInfluences, D = ch.mi;
    for (const k of this.KEYS) {
      const rate = k === 'mouthOpen' ? 28 : k === 'lid' ? 14 : 9;
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
  _w: { mood: 'neutral', k: 1, mood2: null, k2: 0, talk: 0, dead: false, sleep: false },
  // what a person shows: dead, down, in pain, afraid, fighting, what he last said, and how he feels about you
  npcWant(N) {
    const W = this._w, H = N.hp; W.mood = 'neutral'; W.k = 1; W.mood2 = null; W.k2 = 0; W.dead = false; W.sleep = false;
    W.talk = this.talkOf(N);
    if (H.dead) { W.mood = 'dead'; W.dead = true; W.talk = 0; return W; }
    if (H.anim) { W.mood = H.lowness > 0.5 ? 'dazed' : 'pain'; W.mood2 = 'pain'; W.k2 = clamp(H.pain, 0, 1); return W; }
    if (N.mood && G.time < (N.moodT || 0)) W.mood = N.mood;
    else if (N.fear && G.time < N.fear) W.mood = 'fear';
    else if (N.fight && N.fight.on) W.mood = 'angry';
    else if (N.feel && N.feel.mood && G.time - N.feel.t < 25) { W.mood = N.feel.mood; W.k = 0.6; }   // (how the talk left him: talk.js)
    else if (N.attitude) { const f = N.attitude(); W.mood = f > 0.35 ? 'amused' : f < -0.35 ? 'angry' : 'neutral'; W.k = Math.min(1, Math.abs(f)) * 0.5; }
    if (H.pain > 0.25) { W.mood2 = 'pain'; W.k2 = clamp(H.pain - 0.2, 0, 1); }
    if (H.daze > 0.5) { W.mood2 = 'dazed'; W.k2 = H.daze - 0.4; }
    return W;
  },
  playerWant() {
    const W = this._w; W.mood = 'neutral'; W.k = 1; W.mood2 = null; W.k2 = 0; W.dead = false; W.sleep = false; W.talk = 0;
    if (PHP.out) { W.mood = 'dead'; W.sleep = true; return W; }
    if (typeof SLEEP !== 'undefined' && SLEEP.busy && SLEEP.busy() && SLEEP.st === 'sleep') { W.mood = 'sleep'; W.sleep = true; return W; }
    if (G.time - PHP.lastHit < 0.7 || (FALL.busy() && FALL.down > 0.5)) W.mood = 'pain';
    else if (FIST.inFight() || FIST.st !== 'idle') W.mood = 'angry';
    else if (GUN.wantAim) W.mood = 'focus';
    else if (DRUNK.level > 0.25) { W.mood = 'drunk'; W.k = Math.min(1, DRUNK.level); }
    else if (PHP.hp < 0.5) { W.mood = 'pain'; W.k = (0.5 - PHP.hp) * 1.4; }
    if (DRUNK.level > 0.25 && W.mood !== 'drunk') { W.mood2 = 'drunk'; W.k2 = Math.min(0.7, DRUNK.level); }
    return W;
  }
};
