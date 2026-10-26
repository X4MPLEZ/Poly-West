/* ---------- footstep sounds, synthesised with Web Audio (no sound files) ----------
   Each footfall = heel thump + sand crunch (a few tiny grain clicks) + a soft spur jingle.
   Porches and the bridge sound hollow instead. Everything is varied slightly so no two steps match. */
const SFX = {
  ctx: null, on: true, master: null, noise: null, lastStep: 0, vol: 30,
  init() {
    try {
      if (localStorage.getItem('dustcreek-sound') === '0') this.on = false;
      const v = parseInt(localStorage.getItem('dustcreek-volume'), 10); if (v >= 0 && v <= 100) this.vol = v;
    } catch (e) { /* ignore */ }
    // Browsers only allow sound inside certain user gestures. On phones a finger going *down* does not count,
    // lifting it does, so listen to every candidate and keep trying until the audio really runs.
    const unlock = () => this.unlock();
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, true));
  },
  unlock() {
    if (this.ctx && this.ctx.state === 'running') return;
    // iPhone: switch the audio session to "playback" so the silent switch does not mute the game (iOS 17+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.gainValue();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
      this.master.connect(comp); comp.connect(c.destination);
      const len = c.sampleRate; // one second of white noise, reused for every step
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      c.onstatechange = () => { if (typeof HUD !== 'undefined' && HUD.audioState) HUD.audioState(); };
    }
    const c = this.ctx;
    try { const r = c.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
    // older iPhones only wake Web Audio once a sound has been started inside the gesture
    try { const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); } catch (e) { /* ignore */ }
    // older iPhones also ignore the silent switch only while an <audio> element plays: loop a silent one
    if (!this.silentEl && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
      try {
        const el = document.createElement('audio');
        el.src = this.silentWav(); el.loop = true; el.setAttribute('playsinline', ''); el.volume = 0.01;
        const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
        this.silentEl = el;
      } catch (e) { /* ignore */ }
    }
  },
  silentWav() {
    const n = 2205, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 22050, true); v.setUint32(28, 44100, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  },
  // audible confirmation when the player turns sound on
  test() {
    const go = () => { if (this.ready()) this.step(1.7, 0, 1, false); };
    if (this.ready()) go(); else setTimeout(go, 120);
  },
  setOn(on) {
    this.on = on;
    try { localStorage.setItem('dustcreek-sound', on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (on) { this.unlock(); this.test(); }
    if (this.master) this.master.gain.setTargetAtTime(this.gainValue(), this.ctx.currentTime, 0.02);
  },
  gainValue() { return this.on ? Math.pow(this.vol / 100, 1.6) * 0.75 : 0; },
  setVolume(v) {
    this.vol = v;
    try { localStorage.setItem('dustcreek-volume', String(v)); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(this.gainValue(), this.ctx.currentTime, 0.03);
  },
  ready() { return this.ctx && this.on && this.ctx.state === 'running'; },

  // building blocks
  env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  },
  noiseHit(t, dest, o) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq; f.Q.value = o.q || 0.8;
    const g = c.createGain();
    src.connect(f); f.connect(g); g.connect(dest);
    const at = o.attack || 0.003;
    this.env(g, t, o.gain, at, o.decay);
    src.start(t, Math.random() * 0.8, at + o.decay + 0.05);
  },
  thump(t, dest, f0, f1, gain, decay) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    o.connect(g); g.connect(dest);
    this.env(g, t, gain, 0.004, decay);
    o.start(t); o.stop(t + decay + 0.05);
  },
  jingle(t, dest, gain) {
    const c = this.ctx;
    const base = [3150, 4420, 5870, 7300];
    for (let hit = 0; hit < 2; hit++) {
      const th = t + 0.012 + hit * (0.035 + Math.random() * 0.03);
      const gh = gain * (hit ? 0.55 : 1);
      for (const f of base) {
        if (Math.random() < 0.3) continue;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f * (0.97 + Math.random() * 0.06) * this.pitch;
        o.connect(g); g.connect(dest);
        this.env(g, th, gh * (0.5 + Math.random() * 0.5), 0.0015, 0.12 + Math.random() * 0.12);
        o.start(th); o.stop(th + 0.3);
      }
    }
  },

  /* one footfall. speed in m/s, k = 0 walk .. 1 run, side = +1 left / -1 right, wood = on planks */
  step(speed, k, side, wood) {
    if (!this.ready()) return;
    try { this.playStep(speed, k, side, wood); } catch (e) { /* never let audio stop the game */ }
  },
  playStep(speed, k, side, wood) {
    const c = this.ctx, now = c.currentTime;
    if (now - this.lastStep < 0.06) return;
    this.lastStep = now;
    this.pitch = G.slow ? 0.6 : 1;
    const slowStretch = G.slow ? 1.8 : 1;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    const out = c.createGain(); out.gain.value = 1;
    if (pan) { pan.pan.value = side * 0.12; out.connect(pan); pan.connect(this.master); } else out.connect(this.master);
    if (typeof AMB !== 'undefined' && AMB.stepIn) out.connect(AMB.stepIn);
    const loud = clamp(0.35 + speed * 0.09 + k * 0.25, 0.3, 1.0) * (0.85 + Math.random() * 0.3);
    const p = this.pitch * (0.92 + Math.random() * 0.16);
    const t = now + 0.005;
    if (wood) {
      // hollow plank knock + heel click
      this.thump(t, out, 165 * p, 95 * p, 0.55 * loud, 0.11 * slowStretch);
      this.noiseHit(t, out, { freq: 420 * p, q: 4, gain: 0.5 * loud, decay: 0.13 * slowStretch });
      this.noiseHit(t, out, { type: 'highpass', freq: 2600 * p, q: 0.7, gain: 0.22 * loud, decay: 0.018 });
      if (Math.random() < 0.35) this.noiseHit(t + 0.05, out, { freq: 260 * p, q: 9, gain: 0.12 * loud, decay: 0.2 }); // board creak
    } else {
      // packed dirt: soft heel thump, then a gritty crunch of sand grains
      this.thump(t, out, 105 * p, 52 * p, 0.6 * loud, 0.075 * slowStretch);
      this.noiseHit(t, out, { freq: lerp(900, 1300, k) * p, q: 0.7, gain: 0.42 * loud, attack: 0.004, decay: lerp(0.11, 0.08, k) * slowStretch });
      const grains = 3 + Math.round(k * 4 + Math.random() * 2);
      for (let i = 0; i < grains; i++) {
        const tg = t + (0.008 + Math.random() * lerp(0.07, 0.05, k)) * slowStretch;
        this.noiseHit(tg, out, { freq: (2200 + Math.random() * 2800) * p, q: 1.5, gain: (0.08 + Math.random() * 0.12) * loud, attack: 0.001, decay: 0.006 + Math.random() * 0.01 });
      }
    }
    this.jingle(t, out, lerp(0.0012, 0.002, k) * loud);
    // clean up the per-step nodes after the sound has finished
    setTimeout(() => { try { out.disconnect(); if (pan) pan.disconnect(); } catch (e) { /* ignore */ } }, 800);
  },
  // toe-off scuff when running: kicked-up grit
  scuff(speed, k) {
    if (!this.ready() || k < 0.3) return;
    const c = this.ctx, t = c.currentTime + 0.003;
    try { this.noiseHit(t, this.master, { type: 'highpass', freq: 3200 * (G.slow ? 0.6 : 1), q: 0.6, gain: 0.05 * k, attack: 0.01, decay: 0.07 }); } catch (e) { /* ignore */ }
  }
};
function onPlanks(x, z, y) {
  for (const p of PLATS) {
    if (Math.abs(y - p.y) > 0.3) continue;
    const dx = x - p.cx, dz = z - p.cz, ca = Math.cos(p.a), sa = Math.sin(p.a);
    if (Math.abs(dx * ca - dz * sa) <= p.hx && Math.abs(dx * sa + dz * ca) <= p.hz) return true;
  }
  return false;
}
