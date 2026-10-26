/* ---------- real voices: Piper (a neural text-to-speech model) running in the browser ----------
   The files (tools/voices.py -> vendor/voice -> published next to the page as voice/…) are loaded once, in a
   worker so the game does not stutter: onnxruntime-web (wasm), piper_phonemize (espeak, German), and per voice a
   model that is put back together from a template + float16 weights. Then a line is spoken sentence by sentence:
   the next sentence is computed while the one before plays, so speech starts after the first sentence.
   Every person has a voice profile: npc.voiceProfile = { piper: 'thorsten', pitch, length, noise }. Pitch is a
   playback-rate shift; the model is asked for a matching tempo so the pace stays as set by `length`.
   Whatever a person says goes through VOICE.line(npc, text): the real voice when it is ready, otherwise (still
   loading, or not possible here) the browser's own voice at once, so nobody ever stays silent. */
function VOICE_WORKER() {
  let sess = null, phon = null, cfg = null, pending = null, readyRes = null;
  const ready = new Promise((r) => { readyRes = r; });
  const HALF = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) { const s = h >> 15, e = (h >> 10) & 31, m = h & 1023; HALF[h] = (s ? -1 : 1) * (e === 0 ? m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : Infinity) : Math.pow(2, e - 15) * (1 + m / 1024)); }
  async function get(url, part) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url.split('/').pop() + ': ' + r.status);
    const rd = r.body.getReader(), chunks = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); n += value.length; postMessage({ t: 'progress', part, n }); }
    const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  async function init(m) {
    const base = m.base;
    importScripts(base + 'ort.wasm.min.js', base + 'piper_phonemize.js');
    ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = base;
    cfg = JSON.parse(new TextDecoder().decode(await get(base + m.voice + '.voice.json', 'cfg')));
    const tmpl = await get(base + m.voice + '.tmpl.wasm', 'tmpl'), parts = [];
    for (const p of cfg.parts) parts.push(await get(base + p, p));
    let hl = 0; for (const p of parts) hl += p.length;
    const half = new Uint8Array(hl); { let o = 0; for (const p of parts) { half.set(p, o); o += p.length; } }
    // the model again: the template with the weights put back in as float32 (they are not 4-byte aligned in the file)
    const full = new Uint8Array(cfg.size), H = new Uint16Array(half.buffer);
    let t = 0, h = 0, last = 0, f = null;
    for (const [i, n] of cfg.segs) {
      full.set(tmpl.subarray(t, t + i - last), last); t += i - last;
      if (!f || f.length < n / 4) f = new Float32Array(n / 4);
      for (let k = 0; k < n / 4; k++) f[k] = HALF[H[h + k]];
      full.set(new Uint8Array(f.buffer, 0, n), i); h += n / 4; last = i + n;
    }
    full.set(tmpl.subarray(t), last);
    sess = await ort.InferenceSession.create(full, { executionProviders: ['wasm'] });
    phon = await createPiperPhonemize({ print: (l) => { if (pending) { const p = pending; pending = null; p(JSON.parse(l).phoneme_ids); } }, printErr: () => {}, locateFile: (x) => base + x + (x.endsWith('.data') ? '.wasm' : '') });   // (data files are served as .wasm)
    readyRes();
    postMessage({ t: 'ready', rate: cfg.voice.audio.sample_rate });
  }
  function ids(text) { return new Promise((res) => { pending = res; phon.callMain(['-l', cfg.voice.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']); }); }
  async function say(m) {
    await ready;
    const id = await ids(m.text), I = cfg.voice.inference;
    const r = await sess.run({
      input: new ort.Tensor('int64', BigInt64Array.from(id.map(BigInt)), [1, id.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(id.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([m.noise != null ? m.noise : I.noise_scale, m.length != null ? m.length : I.length_scale, m.noiseW != null ? m.noiseW : I.noise_w]), [3])
    });
    const pcm = new Float32Array(r.output.data);
    postMessage({ t: 'audio', id: m.id, pcm }, [pcm.buffer]);
  }
  let chain = Promise.resolve();
  onmessage = (e) => {
    const m = e.data;
    if (m.t === 'init') init(m).catch((err) => postMessage({ t: 'fail', msg: String((err && err.message) || err) }));
    else chain = chain.then(() => say(m)).catch((err) => postMessage({ t: 'error', id: m.id, msg: String((err && err.message) || err) }));
  };
}

const VOICE = {
  st: 'off', why: '', got: 0, worker: null, lastProg: 0, startAt: 0, rate: 16000, q: [], playing: null, nextId: 1, waits: {}, EXPECT: 46e6,
  wanted() { return SETTINGS.v.voice && SETTINGS.v.voiceHQ; },
  ready() { return this.st === 'ready'; },
  pct() { return Math.min(99, Math.round((this.got / this.EXPECT) * 100)); },
  // start loading (once); cheap to call often
  load() {
    if (this.st !== 'off' || !this.wanted()) return;
    this.st = 'loading'; this.got = 0; this.parts = {}; this.startAt = this.lastProg = performance.now();
    try {
      const base = new URL('voice/', location.href).href;
      if (!/^https?:/.test(base)) throw new Error('nur über http(s) möglich');
      if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') throw new Error('Worker/WebAssembly fehlen');
      const w = this.worker = new Worker(URL.createObjectURL(new Blob(['(' + VOICE_WORKER.toString() + ')()'], { type: 'text/javascript' })));
      w.onmessage = (e) => this.msg(e.data);
      w.onerror = (e) => { e.preventDefault && e.preventDefault(); this.fail('Worker: ' + (e.message || 'Fehler')); };
      w.postMessage({ t: 'init', base, voice: 'thorsten' });
    } catch (e) { this.fail(String((e && e.message) || e)); }
  },
  fail(why) {
    if (this.st === 'failed') return;
    this.st = 'failed'; this.why = why; console.warn('[voice]', why);
    try { if (this.worker) this.worker.terminate(); } catch (e) { /* ignore */ }
    this.worker = null;
    for (const k in this.waits) this.waits[k].rej(new Error(why));
    this.waits = {}; this.q = [];
  },
  msg(m) {
    if (m.t === 'progress') { this.lastProg = performance.now(); this.parts[m.part] = m.n; let s = 0; for (const k in this.parts) s += this.parts[k]; this.got = s; }
    else if (m.t === 'ready') { this.st = 'ready'; this.rate = m.rate; this.pump(); TOAST.show('Echte Stimme geladen.'); }
    else if (m.t === 'audio') { const w = this.waits[m.id]; delete this.waits[m.id]; if (w) w.res(m.pcm); }
    else if (m.t === 'error') { const w = this.waits[m.id]; delete this.waits[m.id]; if (w) w.rej(new Error(m.msg)); }
    else if (m.t === 'fail') this.fail(m.msg);
  },
  // called every frame: a load that stops moving is given up (and said why)
  tick() {
    const now = performance.now();
    // a sentence that never reports its end (the sound was taken away mid-way): go on with the next one
    if (this.playing && now > this.playing.end + 1500) { try { this.playing.src.onended = null; this.playing.src.stop(); } catch (e) { /* ignore */ } this.playing = null; this.pump(); }
    if (this.q.length && !this.playing) this.pump();
    if (this.st !== 'loading') return;
    if (now - this.lastProg > 25000) this.fail('Laden hängt bei ' + this.pct() + ' %');
    else if (now - this.startAt > 150000) this.fail('Laden dauert zu lange (' + this.pct() + ' %)');
  },
  // for the player: which voice is speaking
  label() {
    if (!this.wanted()) return SETTINGS.v.voice ? 'Browser-Stimme' : 'Stimme aus';
    if (this.st === 'ready') return 'echte Stimme';
    if (this.st === 'loading') return 'echte Stimme lädt ' + this.pct() + ' %';
    if (this.st === 'failed') return 'Browser-Stimme (' + this.why + ')';
    return 'Browser-Stimme';
  },
  // a person says something: every word is heard
  line(npc, text) {
    if (!SETTINGS.v.voice || !text || text === '\u2026') return;
    if (this.ready() || (this.st === 'loading' && this.IOS)) { for (const s of this.sentences(text)) this.push(npc, s); }   // (iPhone: wait for it, see IOS)
    else this.browser(npc, text);
  },
  // On iPhones the browser voice takes the sound away from the game's audio until the next tap, so there nothing
  // is said with it while the real voice is loading: those lines wait (a short while) for the real voice instead.
  IOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  sentences(text) { return (text.match(/[^.!?\u2026]+[.!?\u2026]*["'\u201c\u201d)]*\s*/g) || [text]).map((s) => s.trim()).filter(Boolean); },
  /* the browser's own voices: the best fitting German one of the device (preferred names, the right sex,
     natural/neural ones first); pitch and pace from the profile */
  MALE: /conrad|killian|florian|ralf|markus|stefan|hans|yannick|jonas|bernd|klaus|male|mann|männlich/i,
  FEMALE: /katja|hedda|amala|louisa|seraphina|marlene|vicki|anna|petra|helena|sandy|shelley|google deutsch|female|frau|weiblich/i,
  pickVoice(prof) {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [], de = vs.filter((v) => /^de/i.test(v.lang));
    if (!de.length) return null;
    const P = prof || { male: true };
    const score = (v) => {
      let s = 0;
      if (P.prefer && P.prefer.some((x) => v.name.toLowerCase().includes(x))) s += 10;
      const m = this.MALE.test(v.name), f = this.FEMALE.test(v.name);
      if (P.male !== false ? m && !f : f && !m) s += 5; else if (P.male !== false ? f : m) s -= 5;
      if (/natural|online|neural|premium|enhanced/i.test(v.name)) s += 3;
      if (/de-DE/i.test(v.lang)) s += 1;
      return s;
    };
    return de.slice().sort((a, b) => score(b) - score(a))[0];
  },
  browser(npc, text) {
    if (!window.speechSynthesis || !SFX.on) return;
    try {
      const u = new SpeechSynthesisUtterance(this.clean(text));
      const P = npc.voiceProfile || {}, v = this.pickVoice(P), wrongSex = v && (P.male !== false ? this.FEMALE.test(v.name) && !this.MALE.test(v.name) : this.MALE.test(v.name));
      u.lang = 'de-DE'; if (v) u.voice = v;
      // only a female voice for a man on this device: lower it further (and the other way round)
      u.pitch = clamp((P.browserPitch || 1) * (wrongSex ? (P.male !== false ? 0.75 : 1.3) : 1), 0.1, 2);
      u.rate = P.rate || 1; u.volume = clamp((SETTINGS.v.volume || 30) / 50, 0.3, 1);
      u.onstart = () => { npc.talkT = 30; };
      u.onend = () => { npc.talkT = 0; };
      u.onerror = (e) => { this.browserErr = (e && e.error) || 'Fehler'; npc.talkT = 0; };
      speechSynthesis.speak(u);
    } catch (e) { this.browserErr = String(e); }
  },
  synth(text, prof) {
    return new Promise((res, rej) => {
      if (!this.worker) { rej(new Error(this.why || 'keine Stimme')); return; }
      const id = this.nextId++, P = prof || {}, pitch = P.pitch || 1;
      this.waits[id] = { res, rej };
      // played back `pitch` times faster, so ask for that much slower speech: the pace stays at `length`
      this.worker.postMessage({ t: 'say', id, text, length: (P.length || 1) * pitch, noise: P.noise, noiseW: P.noiseW });
    });
  },
  // what the voice should not stumble over
  clean(text) { return text.replace(/[*_#~"„“”«»]/g, '').replace(/\$\s?(\d+)[.,](\d\d)/g, '$1 Dollar $2').replace(/\$/g, ' Dollar ').replace(/\s+/g, ' ').trim(); },
  // a sentence for npc to say: computed now (in order), played when its turn comes
  push(npc, sentence) {
    const text = this.clean(sentence);
    if (!text || !/[\p{L}\d]/u.test(text)) return;
    const job = { npc, text, pcm: null, err: false, at: performance.now() };
    this.synth(text, npc.voiceProfile).then((p) => { job.pcm = p; this.pump(); }, () => { job.err = true; this.pump(); });
    this.q.push(job); this.pump();
  },
  /* voices have their own channel: louder than the effects (which sit low under the master volume), with a
     limiter so nothing clips; the volume follows the sound switch, the game volume a little, and its own slider */
  output() {
    const c = SFX.ctx;
    if (!this.outG || this.outCtx !== c) {
      this.outCtx = c;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.outG = c.createGain(); this.outG.connect(comp); comp.connect(c.destination);
    }
    const vol = SETTINGS.v.volume == null ? 30 : SETTINGS.v.volume;
    this.outG.gain.value = SFX.on ? ((SETTINGS.v.voiceVol == null ? 100 : SETTINGS.v.voiceVol) / 100) * (0.55 + 0.45 * Math.min(1, vol / 40)) * (vol > 0 ? 1 : 0) : 0;
    return this.outG;
  },
  // the button in the settings: say a test sentence and tell which way it went
  test() {
    const n = (typeof BARKEEP !== 'undefined' && BARKEEP.npc) || { id: 'test', pos: PLAY.pos, voiceProfile: { male: true, pitch: 0.9, length: 1.06, noise: 0.6, browserPitch: 0.82, rate: 0.95 } };
    this.load();
    try { if (SFX.unlock) SFX.unlock(); } catch (e) { /* ignore */ }
    this.browserErr = '';
    this.line(n, 'Howdy, Fremder. So klinge ich.');
    return new Promise((res) => setTimeout(() => {
      const vs = (window.speechSynthesis && speechSynthesis.getVoices().filter((v) => /^de/i.test(v.lang)).length) || 0;
      res(this.label() + (this.ready() ? '' : ' · deutsche Browser-Stimmen: ' + vs) + (this.browserErr ? ' · Fehler: ' + this.browserErr : '') + (SFX.ctx ? ' · Audio: ' + SFX.ctx.state : ' · Audio aus'));
    }, 1500));
  },
  stop(npc) {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    this.q = this.q.filter((j) => j.npc !== npc);
    if (this.playing && this.playing.npc === npc) { try { this.playing.src.stop(); } catch (e) { /* ignore */ } }
  },
  speaking(npc) { return (this.playing && this.playing.npc === npc) || this.q.some((j) => j.npc === npc); },
  pump() {
    if (this.playing || !this.q.length) return;
    const job = this.q[0], now = performance.now();
    // a line that could not be made, or came too late to still fit (said while the voice was loading): skip it
    if (job.err || (job.pcm && now - job.at > 20000) || (!job.pcm && this.ready() && now - job.at > 25000)) { this.q.shift(); this.pump(); return; }
    if (!job.pcm || !SFX.ctx) return;
    this.q.shift();
    // the sound may have been taken away (phones: another app, the keyboard's dictation): ask for it back
    if (SFX.ctx.state !== 'running') { try { SFX.ctx.resume(); } catch (e) { /* ignore */ } }
    const c = SFX.ctx, P = job.npc.voiceProfile || {}, buf = c.createBuffer(1, job.pcm.length, this.rate);
    // the model speaks quietly (peaks around 0.3): bring every sentence up to a full, even level
    let peak = 1e-4; for (let i = 0; i < job.pcm.length; i++) { const a = Math.abs(job.pcm[i]); if (a > peak) peak = a; }
    const k = Math.min(8, 0.9 / peak); for (let i = 0; i < job.pcm.length; i++) job.pcm[i] *= k;
    buf.getChannelData(0).set(job.pcm);
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; src.playbackRate.value = P.pitch || 1;
    const d = Math.hypot(job.npc.pos.x - PLAY.pos.x, job.npc.pos.z - PLAY.pos.z);
    g.gain.value = 1 / (1 + Math.max(0, d - 2) * 0.12);
    src.connect(g); g.connect(this.output());
    const dur = buf.duration / (P.pitch || 1);
    job.npc.talkT = dur + 0.15;
    this.playing = { npc: job.npc, src, end: performance.now() + dur * 1000 };
    src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } this.playing = null; setTimeout(() => this.pump(), 90); };
    src.start();
  }
};
