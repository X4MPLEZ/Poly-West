/* ---------- real voices: Piper (a neural text-to-speech model) running in the browser ----------
   The files (tools/voices.py -> vendor/voice -> published next to the page as voice/…) are loaded once, in a
   worker so the game does not stutter: onnxruntime-web (wasm), piper_phonemize (espeak, German), and per voice a
   model that is put back together from a template + float16 weights. Then a line is spoken sentence by sentence:
   the next sentence is computed while the one before plays, so speech starts after the first sentence.
   Every person has a voice profile: npc.voiceProfile = { piper: 'thorsten', pitch, length, noise }. Pitch is a
   playback-rate shift; the model is asked for a matching tempo so the pace stays as set by `length`.
   If this cannot run here (no workers, no wasm, files missing), the browser's own voices are used (TALK.speakBrowser). */
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
    const tmpl = await get(base + m.voice + '.tmpl', 'tmpl'), parts = [];
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
    phon = await createPiperPhonemize({ print: (l) => { if (pending) { const p = pending; pending = null; p(JSON.parse(l).phoneme_ids); } }, printErr: () => {}, locateFile: (x) => base + x });
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
  st: 'off', why: '', got: 0, worker: null, rate: 16000, q: [], playing: null, nextId: 1, waits: {}, EXPECT: 46e6,
  wanted() { return SETTINGS.v.voice && SETTINGS.v.voiceHQ; },
  ready() { return this.st === 'ready'; },
  pct() { return Math.min(99, Math.round((this.got / this.EXPECT) * 100)); },
  // start loading (once); cheap to call often
  load() {
    if (this.st !== 'off' || !this.wanted()) return;
    this.st = 'loading'; this.got = 0; this.parts = {};
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
    if (m.t === 'progress') { this.parts[m.part] = m.n; let s = 0; for (const k in this.parts) s += this.parts[k]; this.got = s; }
    else if (m.t === 'ready') { this.st = 'ready'; this.rate = m.rate; this.pump(); }
    else if (m.t === 'audio') { const w = this.waits[m.id]; delete this.waits[m.id]; if (w) w.res(m.pcm); }
    else if (m.t === 'error') { const w = this.waits[m.id]; delete this.waits[m.id]; if (w) w.rej(new Error(m.msg)); }
    else if (m.t === 'fail') this.fail(m.msg);
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
    const job = { npc, text, pcm: null, err: false };
    this.synth(text, npc.voiceProfile).then((p) => { job.pcm = p; this.pump(); }, () => { job.err = true; this.pump(); });
    this.q.push(job); this.pump();
  },
  stop(npc) {
    this.q = this.q.filter((j) => j.npc !== npc);
    if (this.playing && this.playing.npc === npc) { try { this.playing.src.stop(); } catch (e) { /* ignore */ } }
  },
  speaking(npc) { return (this.playing && this.playing.npc === npc) || this.q.some((j) => j.npc === npc); },
  pump() {
    if (this.playing || !this.q.length) return;
    const job = this.q[0];
    if (job.err) { this.q.shift(); this.pump(); return; }
    if (!job.pcm || !SFX.ctx) return;
    this.q.shift();
    const c = SFX.ctx, P = job.npc.voiceProfile || {}, buf = c.createBuffer(1, job.pcm.length, this.rate);
    buf.getChannelData(0).set(job.pcm);
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; src.playbackRate.value = P.pitch || 1;
    const d = Math.hypot(job.npc.pos.x - PLAY.pos.x, job.npc.pos.z - PLAY.pos.z);
    g.gain.value = 1.6 / (1 + d * 0.12);
    src.connect(g); g.connect(SFX.master);
    const dur = buf.duration / (P.pitch || 1);
    job.npc.talkT = dur + 0.15;
    this.playing = { npc: job.npc, src };
    src.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } this.playing = null; setTimeout(() => this.pump(), 90); };
    src.start();
  }
};
