/* ---------- gun sounds: recordings for the shot, the empty click and glass, the small mechanical noises synthesised ---------- */
const GSFX = {
  buf: {}, loading: false,
  ok() { if (SFX.ready() && !this.loading) this.load(); return SFX.ready(); },
  // decode the embedded recordings once audio is running, cutting the MP3's leading silence
  load() {
    this.loading = true;
    for (const k of Object.keys(SND_DATA)) {
      try {
        const b64 = SND_DATA[k].split(',')[1], bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const done = (ab) => {
          const d = ab.getChannelData(0); let s0 = 0;
          while (s0 < d.length && Math.abs(d[s0]) < 0.01) s0++;
          s0 = Math.max(0, s0 - 32);
          const out = SFX.ctx.createBuffer(1, d.length - s0, ab.sampleRate);
          out.getChannelData(0).set(d.subarray(s0));
          this.buf[k] = out;
        };
        const r = SFX.ctx.decodeAudioData(u.buffer, done, () => {});
        if (r && r.catch) r.catch(() => {});
      } catch (e) { /* the synthesised fallback stays */ }
    }
  },
  out(gain, pos) {
    const c = SFX.ctx, g = c.createGain();
    let k = 1, delay = 0;
    if (pos) { const d = Math.hypot(pos.x - PLAY.pos.x, pos.y - PLAY.pos.y, pos.z - PLAY.pos.z); k = 1 / (1 + d * 0.12); delay = d / 343; }
    g.gain.value = gain * k; g.connect(SFX.master);
    if (typeof AMB !== 'undefined' && AMB.stepIn) g.connect(AMB.stepIn);
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* ignore */ } }, 3000);
    return { g, t: c.currentTime + 0.004 + delay };
  },
  play(name, dest, t, rate, gain) {
    const b = this.buf[name]; if (!b) return null;
    const c = SFX.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; src.playbackRate.value = rate || 1; g.gain.value = gain;
    src.connect(g); g.connect(dest); src.start(t);
    return g;
  },
  run(fn) { if (!this.ok()) return; try { fn(); } catch (e) { /* never let audio stop the game */ } },
  shot(indoor) {
    this.run(() => {
      const { g, t } = this.out(0.95);
      const rate = 0.95 + Math.random() * 0.08;
      const rec = this.play('shot', g, t, rate, 1);
      if (rec && indoor) {
        // inside, the long outdoor echo of the recording is cut and the room's own reverb takes over
        rec.gain.setValueAtTime(1, t + 0.2); rec.gain.exponentialRampToValueAtTime(0.02, t + 0.45);
      }
      if (!rec) {
        SFX.noiseHit(t, g, { type: 'highpass', freq: 1400, q: 0.5, gain: 0.95, attack: 0.0008, decay: 0.05 });
        SFX.noiseHit(t, g, { type: 'lowpass', freq: 1200, q: 0.4, gain: 0.85, attack: 0.002, decay: 0.3 });
      }
      // a short low punch under the recording, felt more than heard
      SFX.thump(t, g, 95, 38, 0.55, 0.16);
    });
  },
  cock() { this.run(() => { const { g, t } = this.out(0.5); for (const dt of [0, 0.055]) SFX.noiseHit(t + dt, g, { type: 'highpass', freq: 3400, q: 0.7, gain: 0.3, attack: 0.0008, decay: 0.012 }); SFX.thump(t + 0.055, g, 900, 500, 0.05, 0.02); }); },
  dry() { this.run(() => { const { g, t } = this.out(0.6); if (!this.play('dry', g, t, 1, 1)) SFX.noiseHit(t, g, { freq: 2200, q: 3, gain: 0.35, attack: 0.0008, decay: 0.02 }); }); },
  gate() { this.run(() => { const { g, t } = this.out(0.45); SFX.noiseHit(t, g, { type: 'highpass', freq: 2600, q: 0.8, gain: 0.25, attack: 0.001, decay: 0.016 }); }); },
  round() {
    this.run(() => {
      const { g, t } = this.out(0.45);
      SFX.noiseHit(t, g, { freq: 3000, q: 6, gain: 0.2, attack: 0.001, decay: 0.04 });
      const o = SFX.ctx.createOscillator(), og = SFX.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 4100 + Math.random() * 400; o.connect(og); og.connect(g);
      SFX.env(og, t + 0.004, 0.035, 0.001, 0.06); o.start(t); o.stop(t + 0.1);
    });
  },
  // a sweep of noise through a moving band (leather sliding: high to low, dry, a little grain)
  sweep(g, t, f0, f1, dur, gain, q) {
    const c = SFX.ctx, src = c.createBufferSource(); src.buffer = SFX.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const a = c.createGain(); src.connect(f); f.connect(a); a.connect(g);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25); a.gain.exponentialRampToValueAtTime(gain * 0.6, t + dur * 0.7); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random() * 0.8, dur + 0.05);
  },
  // drawing: the grip leaves the leather (a quick rising rasp), the hammer comes back under the thumb
  draw() {
    this.run(() => { const { g, t } = this.out(0.55); this.sweep(g, t, 650, 1500, 0.11, 0.3, 1.4); SFX.noiseHit(t + 0.1, g, { type: 'highpass', freq: 3200, q: 0.8, gain: 0.14, attack: 0.001, decay: 0.01 }); });
  },
  // one turn of the twirl: air past the frame, the cylinder ticks
  spin(i) {
    this.run(() => { const { g, t } = this.out(0.35); this.sweep(g, t, 900 + i * 120, 1700, 0.09, 0.16, 2.2); SFX.noiseHit(t + 0.06, g, { freq: 4200, q: 8, gain: 0.07, attack: 0.0008, decay: 0.012 }); });
  },
  // into the holster: the barrel slides down the leather (falling rasp), the frame seats with a dull knock, a creak
  holster() {
    this.run(() => {
      const { g, t } = this.out(0.6);
      this.sweep(g, t, 1300, 520, 0.15, 0.32, 1.3);
      SFX.thump(t + 0.14, g, 170, 85, 0.22, 0.06);
      SFX.noiseHit(t + 0.145, g, { freq: 380, q: 6, gain: 0.12, attack: 0.004, decay: 0.07 });
      SFX.noiseHit(t + 0.15, g, { type: 'highpass', freq: 3600, q: 0.7, gain: 0.1, attack: 0.0008, decay: 0.01 });
    });
  },
  leather() { this.run(() => { const { g, t } = this.out(0.5); SFX.noiseHit(t, g, { freq: 760, q: 0.8, gain: 0.22, attack: 0.03, decay: 0.12 }); SFX.noiseHit(t + 0.12, g, { type: 'highpass', freq: 3000, q: 0.7, gain: 0.12, attack: 0.001, decay: 0.012 }); }); },
  box() { this.run(() => { const { g, t } = this.out(0.4); for (let i = 0; i < 4; i++) SFX.noiseHit(t + i * 0.05, g, { freq: 2600 + i * 300, q: 5, gain: 0.15, attack: 0.001, decay: 0.03 }); }); },
  glass(p, big) {
    this.run(() => {
      const { g, t } = this.out(big ? 0.7 : 0.35, p);
      if (!this.play('glass', g, t, big ? 0.95 + Math.random() * 0.15 : 1.4, 1)) SFX.noiseHit(t, g, { type: 'highpass', freq: 2800, q: 0.6, gain: 0.55, attack: 0.001, decay: 0.2 });
    });
  },
  ping(g, t, f, gain, decay) {
    const o = SFX.ctx.createOscillator(), og = SFX.ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(og); og.connect(g);
    SFX.env(og, t, gain, 0.001, decay); o.start(t); o.stop(t + decay + 0.05);
  },
  ricochet(g, t) {
    const o = SFX.ctx.createOscillator(), og = SFX.ctx.createGain(), f0 = 2600 + Math.random() * 1200;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.42);
    o.connect(og); og.connect(g); SFX.env(og, t, 0.06, 0.01, 0.42); o.start(t); o.stop(t + 0.5);
  },
  // what the bullet hit decides what you hear
  impact(p, kind) {
    this.run(() => {
      const { g, t } = this.out(0.6, p);
      switch (kind) {
        case 'wood': SFX.thump(t, g, 260, 110, 0.35, 0.07); SFX.noiseHit(t, g, { freq: 1000, q: 1.6, gain: 0.35, attack: 0.001, decay: 0.06 }); SFX.noiseHit(t + 0.004, g, { type: 'highpass', freq: 3200, q: 0.7, gain: 0.15, attack: 0.001, decay: 0.01 }); break;
        case 'plaster': case 'brick': case 'stone':
          SFX.noiseHit(t, g, { type: 'highpass', freq: 1900, q: 0.6, gain: 0.35, attack: 0.001, decay: 0.045 });
          SFX.noiseHit(t, g, { freq: 650, q: 1, gain: 0.3, attack: 0.001, decay: 0.05 });
          for (let i = 0; i < 4; i++) SFX.noiseHit(t + 0.02 + Math.random() * 0.12, g, { freq: 2500 + Math.random() * 3000, q: 1.5, gain: 0.06, attack: 0.001, decay: 0.01 });
          if (kind === 'stone' && Math.random() < 0.45) this.ricochet(g, t + 0.01);
          break;
        case 'metal': SFX.noiseHit(t, g, { type: 'highpass', freq: 2500, q: 0.7, gain: 0.3, attack: 0.0005, decay: 0.02 }); for (const f of [1750, 2930, 4120]) this.ping(g, t, f * (0.95 + Math.random() * 0.1), 0.05, 0.2 + Math.random() * 0.2); if (Math.random() < 0.6) this.ricochet(g, t + 0.01); break;
        case 'glass': this.glass(p, false); break;
        case 'cloth': SFX.noiseHit(t, g, { freq: 420, q: 0.8, gain: 0.25, attack: 0.001, decay: 0.04 }); break;
        default: SFX.noiseHit(t, g, { type: 'lowpass', freq: 700, q: 0.6, gain: 0.45, attack: 0.001, decay: 0.1 }); SFX.thump(t, g, 140, 60, 0.25, 0.07);
      }
    });
  }
};
