/* ---------- ambience: everything synthesised, everything placed in the world ----------
   Beds:      desert wind (gusting, stronger outside town).
   Places:    saloon (a self-playing honky-tonk piano), windmill squeak, doors.
   Unseen:    horses, chickens and a blacksmith at a ranch out of town, someone snoring upstairs in the hotel,
              a hawk circling overhead, coyotes far out in the desert.
   The listener is the camera, so sounds pan and fade as you walk around. */
const AMB = {
  started: false, voices: [], piano: null,
  ctx() { return SFX.ctx; },
  ok() { return this.started && SFX.ready(); },
  start() {
    const c = SFX.ctx;
    this.bus = c.createGain(); this.bus.gain.value = SETTINGS.v.ambient / 100; this.bus.connect(SFX.master);
    SETTINGS.on('ambient', (v) => this.bus.gain.setTargetAtTime(v / 100, c.currentTime, 0.05));
    // a short, warm room for the saloon
    const len = Math.floor(c.sampleRate * 1.1), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.5; }
    this.room = c.createConvolver(); this.room.buffer = ir;
    this.saloonPos = new THREE.Vector3(-19.5, 1.6, -4.9);
    this.saloonOut = this.panner(this.saloonPos, 5, null);
    const wall = c.createBiquadFilter(); wall.type = 'lowpass'; wall.frequency.value = 2300; wall.Q.value = 0.5;
    this.saloonIn = c.createGain();
    this.saloonIn.connect(wall);
    const wet = c.createGain(); wet.gain.value = 0.32; wall.connect(this.room); this.room.connect(wet); wet.connect(this.saloonOut);
    wall.connect(this.saloonOut);
    this.saloonWall = wall;
    this.saloonGate = c.createGain(); this.saloonGate.gain.value = 0;
    this.saloonGate.connect(this.saloonIn);
    this.startWind();
    // a small room for footsteps indoors
    const len2 = Math.floor(c.sampleRate * 0.45), ir2 = c.createBuffer(2, len2, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir2.getChannelData(ch); for (let i = 0; i < len2; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len2, 4) * 0.6; }
    const conv = c.createConvolver(); conv.buffer = ir2;
    this.stepIn = c.createGain(); this.stepIn.gain.value = 0;
    this.stepIn.connect(conv); conv.connect(SFX.master);
    this.piano = { next: 0, step: 0, bar: 0, loop: 0 };
    this.timers = { hawk: 8 + Math.random() * 10, coyote: 25 + Math.random() * 25, laugh: 6, clink: 4,
      snort: 4, stomp: 7, whinny: 20 + Math.random() * 20, hen: 3, smith: 2, snore: 0 };
    this.P = {
      stable: new THREE.Vector3(-36, 1.5, 44),        // a ranch north-west of town, out of sight
      smithy: new THREE.Vector3(-42, 1.0, 40),
      hens: new THREE.Vector3(-30, 0.4, 46),
      sleeper: new THREE.Vector3(9.5, 4.6, -11.5)      // an open window upstairs in the hotel
    };
    this.smithWork = true; this.smithLeft = 25;
    this.windmillPrev = W.rotor.rotation.z;
    this.started = true;
  },

  /* ---------- helpers ---------- */
  panner(pos, ref, dest) {
    const c = SFX.ctx, p = c.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1; p.maxDistance = 10000;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(dest || this.bus);
    return p;
  },
  oneShot(pos, ref, life, muffle) { // a temporary panner for a sound at a spot, cleaned up afterwards
    const p = this.panner(pos, ref);
    let inp = p;
    if (muffle) { inp = SFX.ctx.createBiquadFilter(); inp.type = 'lowpass'; inp.frequency.value = muffle; inp.Q.value = 0.5; inp.connect(p); }
    setTimeout(() => { try { p.disconnect(); if (inp !== p) inp.disconnect(); } catch (e) { /* ignore */ } }, (life || 3) * 1000);
    return inp;
  },
  near(pos, max) { return G.cam.position.distanceTo(pos) < max; },
  osc(t, dest, type, f, g) { // f, g: [[time, value], ...] ramps (exponential for pitch, linear for level)
    const c = SFX.ctx, o = c.createOscillator(), gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f[0][1], t + f[0][0]);
    for (let i = 1; i < f.length; i++) o.frequency.exponentialRampToValueAtTime(f[i][1], t + f[i][0]);
    gn.gain.setValueAtTime(0, t);
    for (const [tt, v] of g) gn.gain.linearRampToValueAtTime(v, t + tt);
    o.connect(gn); gn.connect(dest);
    const end = Math.max(f[f.length - 1][0], g[g.length - 1][0]);
    o.start(t); o.stop(t + end + 0.05);
    return o;
  },
  vibrato(o, t, rate, depth, dur) {
    const c = SFX.ctx, l = c.createOscillator(), d = c.createGain();
    l.frequency.value = rate; d.gain.value = depth; l.connect(d); d.connect(o.frequency);
    l.start(t); l.stop(t + dur);
  },
  formants(dest, list) { // parallel band-pass filters = a vowel
    const c = SFX.ctx, inp = c.createGain();
    for (const [f, q, gain] of list) {
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      inp.connect(b); b.connect(g); g.connect(dest);
    }
    return inp;
  },
  noise(t, dest, type, freq, q, g) { // g: ramps like osc
    const c = SFX.ctx, src = c.createBufferSource(); src.buffer = SFX.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gn = c.createGain(); gn.gain.setValueAtTime(0, t);
    for (const [tt, v] of g) gn.gain.linearRampToValueAtTime(v, t + tt);
    src.connect(f); f.connect(gn); gn.connect(dest);
    const end = g[g.length - 1][0];
    src.start(t, Math.random() * 0.5, end + 0.05);
    return f;
  },

  /* ---------- wind ---------- */
  startWind() {
    const c = SFX.ctx, src = c.createBufferSource();
    src.buffer = SFX.noise; src.loop = true;
    this.windLo = c.createBiquadFilter(); this.windLo.type = 'bandpass'; this.windLo.frequency.value = 420; this.windLo.Q.value = 0.7;
    this.windHi = c.createBiquadFilter(); this.windHi.type = 'bandpass'; this.windHi.frequency.value = 1700; this.windHi.Q.value = 7;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    this.windWhistle = c.createGain(); this.windWhistle.gain.value = 0;
    src.connect(this.windLo); this.windLo.connect(this.windG); this.windG.connect(this.bus);
    src.connect(this.windHi); this.windHi.connect(this.windWhistle); this.windWhistle.connect(this.bus);
    src.start();
  },
  updateWind(time) {
    const c = SFX.ctx, now = c.currentTime;
    const gust = clamp(0.5 + 0.28 * Math.sin(time * 0.21) + 0.18 * Math.sin(time * 0.53 + 1.3) + 0.12 * Math.sin(time * 1.37 + 0.4), 0, 1);
    const outside = 1 - townMask(G.cam.position.x, G.cam.position.z) * 0.45;
    const indoor = G.room ? 0.28 : 1;
    this.windG.gain.setTargetAtTime((0.022 + 0.055 * gust) * outside * indoor, now, 0.4);
    this.windLo.frequency.setTargetAtTime(330 + 380 * gust, now, 0.5);
    this.windWhistle.gain.setTargetAtTime(Math.max(0, gust - 0.62) * 0.035 * outside * indoor, now, 0.6);
    this.windHi.frequency.setTargetAtTime(1500 + 500 * gust, now, 0.8);
  },

  /* ---------- saloon: honky-tonk piano ---------- */
  pianoNote(t, midi, vel) {
    const c = SFX.ctx, f = 440 * Math.pow(2, (midi - 69) / 12);
    const dur = clamp(1.9 - (midi - 40) * 0.022, 0.45, 1.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(Math.min(f * 9, 9000), t); lp.frequency.exponentialRampToValueAtTime(Math.min(f * 2.2, 5000), t + dur * 0.5);
    lp.connect(g); g.connect(this.saloonGate);
    for (const cents of [-11, 9]) { // two slightly out-of-tune strings: the honky-tonk sound
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  CHORDS: {
    C: { root: 36, fifth: 43, voice: [60, 64, 67], tones: [72, 76, 79, 84, 74, 77] },
    A7: { root: 45, fifth: 40, voice: [61, 64, 67], tones: [73, 76, 79, 81, 74] },
    Dm: { root: 38, fifth: 45, voice: [62, 65, 69], tones: [74, 77, 81, 72, 76] },
    G7: { root: 43, fifth: 38, voice: [59, 62, 65], tones: [71, 74, 77, 79, 72] },
    F: { root: 41, fifth: 36, voice: [60, 65, 69], tones: [72, 77, 81, 76, 74] }
  },
  PROG: ['C', 'A7', 'Dm', 'G7', 'C', 'F', 'G7', 'C'],
  RHYTHMS: [[1, 0, 1, 1, 0, 1, 1, 0], [1, 1, 0, 1, 0, 1, 0, 1], [0, 1, 1, 0, 1, 1, 0, 1], [1, 0, 0, 1, 0, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 1]],
  schedulePiano(now) {
    const P = this.piano, beat = 60 / 112, eighth = beat / 2;
    if (P.next < now + 0.02) P.next = now + 0.05;
    while (P.next < now + 0.3) {
      const bar = P.bar % 8, step = P.step;
      const ch = this.CHORDS[this.PROG[bar]];
      const swing = step % 2 === 1 ? eighth * 0.24 : 0;
      const t = Math.max(now + 0.01, P.next + swing + (Math.random() - 0.5) * 0.012);
      // left hand: stride bass and chords
      if (step === 0) this.pianoNote(t, ch.root, 0.13);
      if (step === 4) this.pianoNote(t, ch.fifth, 0.11);
      if (step === 2 || step === 6) for (const m of ch.voice) this.pianoNote(t, m, 0.045);
      // right hand: a ragtime-ish melody from chord tones, repeating every 8 bars with small changes
      const rnd = mulberry32(bar * 97 + (P.loop % 2) * 13 + 5);
      const rh = bar === 7 ? [1, 0, 0, 0, 0, 0, 0, 0] : this.RHYTHMS[Math.floor(rnd() * this.RHYTHMS.length)];
      if (rh[step]) {
        for (let i = 0; i < step; i++) rnd();
        const note = bar === 7 ? 72 : ch.tones[Math.floor(rnd() * ch.tones.length)];
        this.pianoNote(t, note, 0.07 + Math.random() * 0.025);
        if (bar === 7 || rnd() < 0.25) this.pianoNote(t, note - 12, 0.035);
      }
      P.next += eighth;
      P.step++;
      if (P.step === 8) { P.step = 0; P.bar++; if (P.bar % 8 === 0) P.loop++; }
    }
  },

  /* ---------- saloon: murmuring guests ---------- */
  VOWELS: [[750, 1150], [480, 1900], [320, 2200], [520, 900], [360, 780], [620, 1500]],
  startCrowd() {
    const c = SFX.ctx;
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      const base = i === 3 ? 205 : 105 + i * 18;
      o.frequency.value = base;
      const amp = c.createGain(); amp.gain.value = 0;
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6; f1.frequency.value = 600;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8; f2.frequency.value = 1400;
      const g2 = c.createGain(); g2.gain.value = 0.55;
      o.connect(f1); o.connect(f2); f1.connect(amp); f2.connect(g2); g2.connect(amp);
      amp.connect(this.saloonGate);
      o.start();
      this.voices.push({ o, amp, f1, f2, base, next: Math.random() * 2, talking: Math.random() < 0.5, phraseEnd: 1 + Math.random() * 3 });
    }
  },
  updateCrowd(now) {
    for (const v of this.voices) {
      if (now < v.next) continue;
      if (now > v.phraseEnd) {
        v.talking = !v.talking;
        v.phraseEnd = now + (v.talking ? 1.5 + Math.random() * 3.5 : 0.6 + Math.random() * 2.5);
      }
      const syl = 0.09 + Math.random() * 0.16;
      if (v.talking) {
        const vw = this.VOWELS[Math.floor(Math.random() * this.VOWELS.length)];
        v.f1.frequency.setTargetAtTime(vw[0], now, 0.02); v.f2.frequency.setTargetAtTime(vw[1], now, 0.02);
        v.o.frequency.setTargetAtTime(v.base * (0.88 + Math.random() * 0.3), now, 0.04);
        const a = 0.05 + Math.random() * 0.05;
        v.amp.gain.setTargetAtTime(a, now, 0.015);
        v.amp.gain.setTargetAtTime(a * 0.25, now + syl * 0.7, 0.03);
      } else v.amp.gain.setTargetAtTime(0, now, 0.05);
      v.next = now + syl;
    }
  },
  laugh(t) {
    const c = SFX.ctx, out = this.formants(this.saloonGate, [[760, 5, 1], [1250, 7, 0.6]]);
    const n = 4 + Math.floor(Math.random() * 3), f0 = 170 + Math.random() * 80;
    const g = [];
    for (let i = 0; i < n; i++) { const s = i * 0.17; g.push([s, 0], [s + 0.03, 0.14 * (1 - i / (n + 1))], [s + 0.11, 0]); }
    this.osc(t, out, 'sawtooth', [[0, f0 * 1.15], [n * 0.17, f0 * 0.82]], g);
    for (let i = 0; i < n; i++) this.noise(t + i * 0.17, this.saloonGate, 'bandpass', 1400, 1, [[0.02, 0.02], [0.1, 0]]);
  },
  clink(t) {
    const c = SFX.ctx;
    for (const [f, d, a] of [[2750, 0.35, 0.05], [4120, 0.22, 0.035], [5900, 0.14, 0.02]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * (0.97 + Math.random() * 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.saloonGate); o.start(t); o.stop(t + d + 0.05);
    }
  },

  /* ---------- horses ---------- */
  horseSnort(pos, voice) {
    if (!this.ok() || !this.near(pos, 60)) return;
    const c = SFX.ctx, t = c.currentTime + 0.02, out = this.oneShot(pos, 4, 3, 2200);
    // a fluttering blow through the nostrils
    const am = c.createGain(); am.gain.value = 0.5; am.connect(out);
    const l = c.createOscillator(), d = c.createGain(); l.frequency.value = 26 + Math.random() * 8; d.gain.value = 0.45; l.connect(d); d.connect(am.gain); l.start(t); l.stop(t + 0.8);
    const f = this.noise(t, am, 'bandpass', 950 * voice, 1.3, [[0.04, 0.5], [0.25, 0.35], [0.62, 0]]);
    f.frequency.setValueAtTime(1100 * voice, t); f.frequency.exponentialRampToValueAtTime(420 * voice, t + 0.6);
    this.noise(t + 0.02, out, 'lowpass', 350, 0.7, [[0.05, 0.25], [0.5, 0]]);
  },
  horseWhinny(pos, voice) {
    if (!this.ok() || !this.near(pos, 90)) return;
    const c = SFX.ctx, t = c.currentTime + 0.02, out = this.oneShot(pos, 6, 3, 2600);
    const tract = this.formants(out, [[900 * voice, 3, 1], [2100 * voice, 5, 0.5], [3200, 6, 0.2]]);
    const f = 640 * voice;
    const o = this.osc(t, tract, 'sawtooth', [[0, f * 0.9], [0.18, f * 1.45], [0.32, f * 1.4], [1.0, f * 0.85], [1.45, f * 0.55]],
      [[0.04, 0.16], [0.3, 0.2], [1.1, 0.14], [1.5, 0]]);
    this.vibrato(o, t + 0.25, 9.5, f * 0.12, 1.3);
    this.noise(t, tract, 'bandpass', 1500, 0.8, [[0.05, 0.05], [1.2, 0.04], [1.5, 0]]);
  },
  hoof(pos) {
    if (!this.ok() || !this.near(pos, 40)) return;
    const c = SFX.ctx, t = c.currentTime + 0.005, out = this.oneShot(pos, 3, 1.5, 1800);
    SFX.thump(t, out, 90, 48, 0.32, 0.1);
    this.noise(t, out, 'bandpass', 1300, 1.2, [[0.004, 0.15], [0.09, 0]]);
    for (let i = 0; i < 4; i++) this.noise(t + 0.01 + Math.random() * 0.06, out, 'bandpass', 2500 + Math.random() * 2500, 1.5, [[0.002, 0.035], [0.012, 0]]);
  },

  /* ---------- chickens ---------- */
  chicken(pos, voice, panic) {
    if (!this.ok() || !this.near(pos, 35)) return;
    const c = SFX.ctx, out = this.oneShot(pos, 3, 3, 3500);
    const tract = this.formants(out, [[1050, 4, 1], [2500, 6, 0.6]]);
    let t = c.currentTime + 0.02;
    const n = panic ? 4 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = (330 + Math.random() * 60) * voice * (panic ? 1.25 : 1);
      this.osc(t, tract, 'sawtooth', [[0, f * 1.15], [0.07, f * 0.85]], [[0.006, panic ? 0.19 : 0.14], [0.07, 0]]);
      t += (panic ? 0.11 : 0.17) + Math.random() * 0.12;
    }
    if (panic || Math.random() < 0.3) { // ba-GAWK
      const f = 380 * voice;
      this.osc(t, tract, 'sawtooth', [[0, f], [0.06, f * 0.9]], [[0.006, 0.14], [0.06, 0]]);
      this.osc(t + 0.09, tract, 'sawtooth', [[0, f * 1.9], [0.1, f * 2.05], [0.32, f * 1.4]], [[0.02, 0.2], [0.22, 0.15], [0.34, 0]]);
    }
  },

  /* ---------- blacksmith ---------- */
  anvil(pos, blow, at) {
    if (!this.ok() || !this.near(pos, 90)) return;
    const c = SFX.ctx, t = at || c.currentTime + 0.004, out = this.oneShot(pos, 5, 3 + (t - c.currentTime), 4500);
    const base = 905 * (1 + blow * 0.012) * (0.99 + Math.random() * 0.02);
    for (const [r, d, a] of [[1, 1.3, 0.08], [2.31, 0.9, 0.05], [3.73, 0.55, 0.035], [5.12, 0.35, 0.025], [6.94, 0.2, 0.018]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = base * r;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    }
    this.noise(t, out, 'highpass', 3000, 0.7, [[0.001, 0.06], [0.015, 0]]);
    SFX.thump(t, out, 160, 90, 0.09, 0.05);
  },

  /* ---------- napping man ---------- */
  snore(pos) {
    if (!this.ok() || !this.near(pos, 30)) return;
    const c = SFX.ctx, t = c.currentTime + 0.02, out = this.oneShot(pos, 3, 5, 1600);
    // inhale: a rattling throat
    const am = c.createGain(); am.gain.value = 0.4; am.connect(out);
    const l = c.createOscillator(), d = c.createGain(); l.type = 'square'; l.frequency.value = 27 + Math.random() * 6; d.gain.value = 0.38; l.connect(d); d.connect(am.gain); l.start(t); l.stop(t + 1.6);
    this.noise(t, am, 'lowpass', 520, 1.5, [[0.5, 0.32], [1.2, 0.36], [1.5, 0]]);
    // exhale: a soft puff
    this.noise(t + 1.6, out, 'bandpass', 1100, 0.7, [[0.15, 0.06], [0.85, 0]]);
  },
  creak(pos, side) {
    if (!this.ok() || !this.near(pos, 25)) return;
    const c = SFX.ctx, t = c.currentTime + 0.01, out = this.oneShot(pos.clone().setY(0.5), 2.5, 2);
    const tract = this.formants(out, [[side > 0 ? 1350 : 1100, 7, 1]]);
    const f = side > 0 ? 310 : 260;
    const o = this.osc(t, tract, 'sawtooth', [[0, f], [0.28, f * 0.88]], [[0.04, 0.045], [0.22, 0.035], [0.32, 0]]);
    this.vibrato(o, t, 31, f * 0.06, 0.35);
  },

  /* ---------- windmill, hawk, coyotes ---------- */
  windmillSqueak() {
    const pos = W.rotor.position;
    if (!this.ok() || !this.near(pos, 70)) return;
    const c = SFX.ctx, t = c.currentTime + 0.01, out = this.oneShot(pos, 6, 2);
    const tract = this.formants(out, [[1250, 5, 1], [2600, 8, 0.4]]);
    const o = this.osc(t, tract, 'sawtooth', [[0, 540], [0.42, 470]], [[0.06, 0.14], [0.3, 0.12], [0.45, 0]]);
    this.vibrato(o, t, 19, 14, 0.5);
  },
  hawk() {
    if (!W.birds.length) return;
    const b = W.birds[Math.floor(Math.random() * W.birds.length)];
    const c = SFX.ctx, t = c.currentTime + 0.02, out = this.oneShot(b.position, 25, 3);
    const tract = this.formants(out, [[2700, 2.5, 1], [4200, 4, 0.35]]);
    const o = this.osc(t, tract, 'sawtooth', [[0, 2400], [0.12, 3050], [0.5, 2950], [1.7, 2050]], [[0.06, 0.1], [0.5, 0.105], [1.4, 0.07], [1.75, 0]]);
    this.vibrato(o, t, 63, 90, 1.8);
    this.noise(t, tract, 'bandpass', 3200, 2, [[0.1, 0.04], [1.5, 0.025], [1.75, 0]]);
  },
  coyote() {
    const c = SFX.ctx, t = c.currentTime + 0.02;
    const a = Math.random() * TAU, d = 160 + Math.random() * 60;
    const pos = new THREE.Vector3(G.cam.position.x + Math.sin(a) * d, 8, G.cam.position.z + Math.cos(a) * d);
    const out = this.oneShot(pos, 90, 8);
    // canyon echo
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(out);
    const dl = c.createDelay(1); dl.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.32;
    lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(out);
    const tract = this.formants(lp, [[900, 3, 1], [1500, 5, 0.4]]);
    let s = 0;
    const yips = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < yips; i++) { this.osc(t + s, tract, 'triangle', [[0, 650], [0.08, 1050], [0.14, 800]], [[0.02, 0.045], [0.14, 0]]); s += 0.22 + Math.random() * 0.1; }
    const o = this.osc(t + s + 0.1, tract, 'triangle', [[0, 480], [0.45, 930], [1.4, 880], [2.4, 560]], [[0.15, 0.05], [1.6, 0.045], [2.4, 0]]);
    this.vibrato(o, t + s + 0.6, 5.5, 22, 1.9);
  },

  /* ---------- doors ---------- */
  doorOpen(pos) {
    if (!this.ok()) return;
    const c = SFX.ctx, t = c.currentTime + 0.01, out = this.oneShot(pos, 3, 2);
    this.noise(t, out, 'highpass', 2600, 0.8, [[0.002, 0.12], [0.02, 0]]);
    SFX.thump(t, out, 140, 90, 0.08, 0.05);
    const tract = this.formants(out, [[950, 6, 1], [2100, 8, 0.35]]);
    const o = this.osc(t + 0.08, tract, 'sawtooth', [[0, 175], [0.25, 235], [0.6, 205]], [[0.05, 0.05], [0.4, 0.045], [0.62, 0]]);
    this.vibrato(o, t + 0.08, 23, 9, 0.65);
  },
  doorClose(pos) {
    if (!this.ok()) return;
    const c = SFX.ctx, t = c.currentTime + 0.005, out = this.oneShot(pos, 3, 2);
    SFX.thump(t, out, 115, 55, 0.45, 0.13);
    this.noise(t, out, 'lowpass', 900, 0.7, [[0.004, 0.18], [0.08, 0]]);
    this.noise(t + 0.03, out, 'highpass', 2800, 0.8, [[0.002, 0.1], [0.018, 0]]);
  },
  saloonPush(pos) {
    if (!this.ok()) return;
    const c = SFX.ctx, t = c.currentTime + 0.01, out = this.oneShot(pos, 3, 2);
    const tract = this.formants(out, [[1200, 6, 1]]);
    const o = this.osc(t, tract, 'sawtooth', [[0, 290], [0.3, 250]], [[0.04, 0.035], [0.32, 0]]);
    this.vibrato(o, t, 28, 8, 0.35);
    this.noise(t, out, 'bandpass', 2200, 0.8, [[0.03, 0.03], [0.2, 0]]);
  },
  saloonClack(pos, k) {
    if (!this.ok()) return;
    const c = SFX.ctx, t = c.currentTime + 0.003, out = this.oneShot(pos, 3, 1);
    SFX.thump(t, out, 260, 170, 0.22 * k, 0.05);
    this.noise(t, out, 'bandpass', 1600, 2, [[0.002, 0.16 * k], [0.035, 0]]);
  },

  /* ---------- per frame ---------- */
  update(dt) {
    if (!SFX.ready()) return;
    try { this.tick(dt); } catch (e) { /* ambience must never stop the game */ }
  },
  tick(dt) {
    if (!this.started) this.start();
    const c = SFX.ctx, now = c.currentTime, L = c.listener, cam = G.cam;
    const fw = new THREE.Vector3(); cam.getWorldDirection(fw);
    if (L.positionX) {
      L.positionX.setTargetAtTime(cam.position.x, now, 0.02); L.positionY.setTargetAtTime(cam.position.y, now, 0.02); L.positionZ.setTargetAtTime(cam.position.z, now, 0.02);
      L.forwardX.setTargetAtTime(fw.x, now, 0.02); L.forwardY.setTargetAtTime(fw.y, now, 0.02); L.forwardZ.setTargetAtTime(fw.z, now, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(cam.position.x, cam.position.y, cam.position.z); L.setOrientation(fw.x, fw.y, fw.z, 0, 1, 0); }
    this.updateWind(G.time);
    // the saloon only plays while you are within earshot
    const dS = cam.position.distanceTo(this.saloonPos);
    const inRange = dS < 75;
    this.saloonGate.gain.setTargetAtTime(inRange ? 0.42 : 0, now, 0.3);
    if (inRange) this.schedulePiano(now);
    const inSaloon = G.room && (G.room.type === 'saloon' || G.room.type === 'saloonUp');
    this.saloonWall.frequency.setTargetAtTime(inSaloon ? 9000 : 2300, now, 0.15);
    this.stepIn.gain.setTargetAtTime(G.room ? (G.room.type === 'church' ? 0.55 : 0.3) : 0, now, 0.1);
    // windmill squeaks once per turn
    const rz = W.rotor.rotation.z;
    if (Math.floor(rz / TAU) !== Math.floor(this.windmillPrev / TAU)) this.windmillSqueak();
    this.windmillPrev = rz;
    // the livery stable: horses snort, stamp and whinny; the smith works in bursts
    const T = this.timers, Pp = this.P;
    for (const k of ['snort', 'stomp', 'whinny', 'hen', 'smith', 'snore']) T[k] -= dt;
    if (T.snort <= 0) { this.horseSnort(Pp.stable.clone().setX(Pp.stable.x + (Math.random() - 0.5) * 6), 0.85 + Math.random() * 0.25); T.snort = 6 + Math.random() * 10; }
    if (T.stomp <= 0) { this.hoof(Pp.stable.clone().setY(0.2).setX(Pp.stable.x + (Math.random() - 0.5) * 6)); if (Math.random() < 0.4) setTimeout(() => this.hoof(Pp.stable.clone().setY(0.2)), 380); T.stomp = 5 + Math.random() * 9; }
    if (T.whinny <= 0) { this.horseWhinny(Pp.stable, 0.85 + Math.random() * 0.25); T.whinny = 40 + Math.random() * 50; }
    if (T.hen <= 0) { this.chicken(Pp.hens.clone().setX(Pp.hens.x + (Math.random() - 0.5) * 10), 0.9 + Math.random() * 0.25, Math.random() < 0.08); T.hen = 3 + Math.random() * 7; }
    this.smithLeft -= dt;
    if (this.smithLeft <= 0) { this.smithWork = !this.smithWork; this.smithLeft = this.smithWork ? 20 + Math.random() * 25 : 15 + Math.random() * 25; }
    if (this.smithWork && T.smith <= 0) { // three blows, then a pause to turn the work piece
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.anvil(Pp.smithy, i, now + 0.05 + i * 0.68);
      T.smith = n * 0.68 + 1.2 + Math.random() * 1.4;
    }
    if (T.snore <= 0) { this.snore(Pp.sleeper); T.snore = 4.4 + Math.random() * 0.6; }
    this.timers.hawk -= dt; this.timers.coyote -= dt;
    if (this.timers.hawk <= 0) { this.hawk(); this.timers.hawk = 14 + Math.random() * 22; }
    if (this.timers.coyote <= 0) { this.coyote(); this.timers.coyote = 50 + Math.random() * 60; }
  }
};
