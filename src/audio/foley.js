/* ---------- foley: the small sounds of handling things and of bodies ----------
   Bottles and glasses on wood, pouring, a rag on the counter, a glass being polished, coins, clothes, breaths of
   effort, a body hitting the floor or slamming into the bar. Recorded where it matters (pour, fill, body fall,
   kicks, wood slams: audio/samples.js), the rest synthesised. Every call takes the world position it comes from. */
const FOLEY = {
  // a glass ring: k loudness, vessel 'glass' | 'shot' | 'mug' | 'bottle'
  clink(pos, k, vessel) { GSFX.run(() => { const c = SFX.ctx, { g, t } = GSFX.out(0.5 * k, pos); GLASS.ring(c, g, t, k, vessel || 'glass'); }); },
  // a bottle taken off the shelf: the neighbours knock together, glass scrapes on wood
  bottleOut(pos) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.45, pos);
      SFX.noiseHit(t, g, { type: 'bandpass', freq: 2400, q: 1.5, gain: 0.08, attack: 0.02, decay: 0.12 });
      GLASS.ring(c, g, t + 0.05, 0.6, 'bottle'); GLASS.ring(c, g, t + 0.12 + Math.random() * 0.05, 0.25, 'bottle');
    });
  },
  // set down on wood: a knock (bottle heavier, glass brighter)
  setDown(pos, k, vessel) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.55 * k, pos), heavy = vessel === 'bottle' || vessel === 'mug';
      SFX.thump(t, g, heavy ? 180 : 260, heavy ? 90 : 140, 0.35 * k, 0.05);
      SFX.noiseHit(t, g, { type: 'lowpass', freq: heavy ? 800 : 1300, q: 0.9, gain: 0.3 * k, attack: 0.001, decay: 0.04 });
      GLASS.ring(c, g, t + 0.002, 0.45 * k, vessel || 'glass');
    });
  },
  // the cork out (a soft pop), then the stream; the glass fills, the note rises
  pour(pos, dur) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.6, pos);
      SFX.thump(t, g, 420, 900, 0.12, 0.03);
      SFX.noiseHit(t, g, { type: 'highpass', freq: 2200, q: 0.7, gain: 0.06, attack: 0.001, decay: 0.02 });
      const t1 = t + 0.12;
      if (!GSFX.play('pour', g, t1, 0.95 + Math.random() * 0.1, 0.8)) BARKEEP.pourSound(dur);
      GSFX.play('fill', g, t1 + Math.max(0.15, dur - 0.45), 1.05 + Math.random() * 0.1, 0.45);
    });
  },
  // a rag on the counter: long soft strokes
  wipe(pos, k) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.3 * k, pos);
      SFX.noiseHit(t, g, { type: 'bandpass', freq: 1400 + Math.random() * 500, q: 0.9, gain: 0.07, attack: 0.12, decay: 0.28 });
      SFX.noiseHit(t + 0.05, g, { type: 'lowpass', freq: 500, q: 0.6, gain: 0.04, attack: 0.1, decay: 0.25 });
    });
  },
  // polishing a glass: dry cloth on glass squeaks now and then
  polish(pos) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.25, pos);
      SFX.noiseHit(t, g, { type: 'bandpass', freq: 3000, q: 1.2, gain: 0.03, attack: 0.05, decay: 0.15 });
      if (Math.random() < 0.6) {
        const o = c.createOscillator(), og = c.createGain(), f = 2300 + Math.random() * 900, d = 0.06 + Math.random() * 0.08;
        o.type = 'triangle'; o.frequency.setValueAtTime(f, t + 0.04); o.frequency.linearRampToValueAtTime(f * (1.08 + Math.random() * 0.1), t + 0.04 + d);
        og.gain.setValueAtTime(0.0001, t + 0.04); og.gain.linearRampToValueAtTime(0.025, t + 0.05); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + d);
        o.connect(og); og.connect(g); o.start(t + 0.04); o.stop(t + 0.06 + d);
      }
    });
  },
  // coins on the counter
  coins(pos, n) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.4, pos);
      for (let i = 0; i < (n || 3); i++) {
        const tt = t + i * (0.05 + Math.random() * 0.06);
        for (const f of [3900, 5600, 7400]) {
          const o = c.createOscillator(), og = c.createGain(), d = 0.08 + Math.random() * 0.12;
          o.frequency.value = f * (0.94 + Math.random() * 0.12);
          og.gain.setValueAtTime(0.0001, tt); og.gain.linearRampToValueAtTime(0.03, tt + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, tt + d);
          o.connect(og); og.connect(g); o.start(tt); o.stop(tt + d + 0.02);
        }
        SFX.noiseHit(tt, g, { type: 'highpass', freq: 4000, q: 0.7, gain: 0.05, attack: 0.001, decay: 0.012 });
      }
    });
  },
  // clothes moving fast (a dodge, a turn, getting up)
  cloth(pos, k) { GSFX.run(() => { const { g, t } = GSFX.out(0.35 * (k || 1), pos); SFX.noiseHit(t, g, { type: 'bandpass', freq: 900 + Math.random() * 600, q: 0.7, gain: 0.16, attack: 0.04, decay: 0.14 }); }); },
  // a breath of effort: air through the teeth ('pitch' per person, k loudness)
  grunt(pos, pitch, k) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.3 * (k || 1), pos), p = (pitch || 1) * (0.92 + Math.random() * 0.16);
      SFX.noiseHit(t, g, { type: 'bandpass', freq: 620 * p, q: 4, gain: 0.12, attack: 0.015, decay: 0.11 });
      SFX.noiseHit(t, g, { type: 'bandpass', freq: 1150 * p, q: 5, gain: 0.08, attack: 0.015, decay: 0.09 });
      SFX.noiseHit(t, g, { type: 'highpass', freq: 3200, q: 0.7, gain: 0.04, attack: 0.01, decay: 0.08 });
      SFX.thump(t + 0.005, g, 150 * p, 110 * p, 0.05 * (k || 1), 0.08);
    });
  },
  // a body hits the floor (k: how hard); dust where it lands
  bodyFall(pos, k, wood) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.85 * k, pos);
      GSFX.play('bodyfall', g, t, 0.85 + Math.random() * 0.15, 0.9);
      SFX.thump(t, g, 95, 34, 0.9 * k, 0.22);
      if (wood) SFX.noiseHit(t + 0.01, g, { type: 'bandpass', freq: 240, q: 6, gain: 0.12 * k, attack: 0.004, decay: 0.2 });
      SFX.noiseHit(t + 0.04, g, { type: 'bandpass', freq: 1200, q: 0.7, gain: 0.06 * k, attack: 0.03, decay: 0.2 });
    });
  },
  // a body slammed into wood (the bar, a wall, a table): the planks boom, what stands on it rattles
  slam(pos, k) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.9 * k, pos);
      GSFX.play(Math.random() < 0.5 ? 'slam1' : 'slam2', g, t, 0.8 + Math.random() * 0.15, 1);
      GSFX.play('chop', g, t + 0.004, 0.7, 0.5 * k);
      SFX.thump(t, g, 80, 36, 1.0 * k, 0.3);
      for (let i = 0; i < 3; i++) GLASS.ring(c, g, t + 0.05 + Math.random() * 0.25, 0.25 * k, Math.random() < 0.5 ? 'bottle' : 'glass');
    });
  },
  // a boot into a body
  kick(pos, heavy) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.9, pos);
      GSFX.play(Math.random() < 0.5 ? 'kick1' : 'kick2', g, t, (heavy ? 0.82 : 0.95) + Math.random() * 0.1, heavy ? 1.1 : 0.85);
      SFX.thump(t, g, 110, 40, heavy ? 1 : 0.7, heavy ? 0.22 : 0.14);
      SFX.noiseHit(t, g, { type: 'lowpass', freq: 420, q: 0.8, gain: heavy ? 0.6 : 0.4, attack: 0.002, decay: 0.09 });
    });
  },
  /* bones breaking (k: how bad): a dry crack made of a few hard snaps close together, the dull blow under it and a
     short crunching grind; slow: the killing blow in slow motion, everything lower and drawn out */
  crack(pos, k, slow) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(1.0 * (k || 1), pos), sl = slow ? 0.6 : 1;
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const dt = (i * 0.011 + Math.random() * 0.008) / sl;
        SFX.noiseHit(t + dt, g, { type: 'bandpass', freq: (2600 + Math.random() * 2600) * sl, q: 3.5, gain: 0.5 - i * 0.06, attack: 0.0006, decay: 0.012 / sl });
        SFX.noiseHit(t + dt, g, { type: 'highpass', freq: 5200 * sl, q: 0.7, gain: 0.18, attack: 0.0005, decay: 0.006 / sl });
      }
      SFX.thump(t, g, 120 * sl, 42 * sl, 0.9, 0.16 / sl);
      for (let i = 0; i < 6; i++) SFX.noiseHit(t + (0.035 + i * 0.016 + Math.random() * 0.01) / sl, g, { type: 'bandpass', freq: (1100 + Math.random() * 900) * sl, q: 2.5, gain: 0.14 * (1 - i / 7), attack: 0.002, decay: 0.018 / sl });
      if (slow) { GSFX.play('punchH', g, t, 0.62, 1.0); SFX.thump(t + 0.02, g, 55, 24, 1.0, 0.6); }
    });
  },
  // the doctor: pen on paper, a cabinet, water in the basin
  scribble(pos) { GSFX.run(() => { const { g, t } = GSFX.out(0.25, pos); for (let i = 0; i < 5; i++) SFX.noiseHit(t + i * 0.09 + Math.random() * 0.04, g, { type: 'bandpass', freq: 3800 + Math.random() * 1500, q: 2, gain: 0.04, attack: 0.02, decay: 0.05 }); }); },
  cabinet(pos) { GSFX.run(() => { const { g, t } = GSFX.out(0.4, pos); SFX.noiseHit(t, g, { type: 'bandpass', freq: 520, q: 9, gain: 0.05, attack: 0.06, decay: 0.25 }); SFX.thump(t + 0.3, g, 200, 110, 0.25, 0.06); SFX.noiseHit(t + 0.3, g, { type: 'lowpass', freq: 900, q: 0.8, gain: 0.2, attack: 0.001, decay: 0.05 }); }); },
  splash(pos) { GSFX.run(() => { const { g, t } = GSFX.out(0.4, pos); for (let i = 0; i < 6; i++) SFX.noiseHit(t + i * 0.07 + Math.random() * 0.05, g, { type: 'bandpass', freq: 900 + Math.random() * 1800, q: 3, gain: 0.07, attack: 0.005, decay: 0.07 }); GSFX.play('fill', g, t + 0.05, 0.8, 0.25); }); }
};
