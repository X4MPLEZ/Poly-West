/* ---------- listening with ElevenLabs (own page with an ElevenLabs key) ----------
   Speech to text with "Scribe v2 Realtime": the microphone goes as 16 kHz PCM over a WebSocket, the words come back
   while you speak (partial_transcript), and when you pause the service ends the sentence itself (commit by voice
   activity) -> committed_transcript -> sent to the person you talk to. Much better German than the browser's own
   recognition, and the names of the West are given as key terms. The browser opens the connection with a
   single-use token it gets with the key (the key itself never goes into the WebSocket address).
   While the person speaks, nothing is sent (his voice from the speaker must not be heard as yours). */
const HEAR = {
  st: 'off', ws: null, stream: null, ctx: null, proc: null, sink: null, why: '', dead: false, terms: true,
  TERMS: ['Hank', 'Whiskey', 'Saloon', 'Dust Creek', 'Sheriff', 'Howdy', 'Cowboy', 'Revolver', 'Bourbon'],
  // which way you speak: ElevenLabs when chosen (or "automatic" with an ElevenLabs key), else null (the old ways)
  wanted() {
    const m = SETTINGS.v.sttMode || 'auto';
    if (m !== 'auto' && m !== 'eleven') return false;
    return !this.dead && !!(SETTINGS.v.elevenKey || '').trim() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof WebSocket !== 'undefined';
  },
  active() { return this.st === 'open' || this.st === 'connecting'; },
  // cb: { partial(text), final(text), state(kind, text), muted() }
  async start(cb) {
    if (this.active()) { this.cb = cb; return; }
    this.cb = cb; this.st = 'connecting'; this.why = '';
    this.session('play-and-record');
    try {
      if (!this.stream) this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) { this.fail('Mikrofon nicht erlaubt', true); return; }
    let token;
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', { method: 'POST', headers: { 'xi-api-key': SETTINGS.v.elevenKey.trim() } });
      if (r.status === 401 || r.status === 403) { this.fail('Schlüssel darf nicht zuhören (Recht „Sprache zu Text“ fehlt?)', true); return; }
      if (!r.ok) { this.fail('ElevenLabs ' + r.status, false); return; }
      token = (await r.json()).token;
    } catch (e) { this.fail('keine Verbindung zu ElevenLabs', false); return; }
    if (this.st !== 'connecting') return;   // stopped meanwhile
    const q = ['model_id=scribe_v2_realtime', 'token=' + encodeURIComponent(token), 'audio_format=pcm_16000', 'language_code=de',
      'commit_strategy=vad', 'vad_silence_threshold_secs=0.8', 'min_speech_duration_ms=250'];
    if (this.terms) for (const t of this.TERMS) q.push('keyterms=' + encodeURIComponent(t));
    const ws = this.ws = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?' + q.join('&'));
    let started = false;
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      const t = m.message_type;
      if (t === 'session_started') { started = true; this.st = 'open'; this.audio(); this.cb.state('listen', ''); }
      else if (t === 'partial_transcript') { if (m.text) this.cb.partial(m.text); }
      else if (t === 'committed_transcript' || t === 'committed_transcript_with_timestamps') { const s = (m.text || '').trim(); if (s.length > 1) this.cb.final(s); }
      else if (m.error || /error|exceeded|throttled|limited|terms|invalid/.test(t || '')) {
        // the key terms are the newest part of the request: if the service does not take them, once more without
        if (!started && this.terms && /invalid|input/.test(t)) { this.terms = false; this.stop(true); this.start(this.cb); return; }
        const hard = t === 'auth_error' || t === 'quota_exceeded' || t === 'unaccepted_terms';
        this.fail(t === 'quota_exceeded' ? 'ElevenLabs-Guthaben aufgebraucht' : t === 'auth_error' ? 'Schlüssel darf nicht zuhören' : 'ElevenLabs: ' + (m.error || t), hard);
      }
    };
    ws.onclose = () => { if (this.ws === ws && this.st !== 'off' && this.st !== 'failed') { this.st = 'closed'; this.cb.state('closed', ''); } };
    ws.onerror = () => { if (this.ws === ws && !started) this.fail('Verbindung zum Zuhören fehlgeschlagen', false); };
  },
  // the microphone, made 16 kHz 16-bit and sent in pieces of about a tenth of a second
  audio() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext, ctx = this.ctx = new C();
    const src = ctx.createMediaStreamSource(this.stream), proc = this.proc = ctx.createScriptProcessor(2048, 1, 1), sink = this.sink = ctx.createGain();
    sink.gain.value = 0;
    const ratio = ctx.sampleRate / 16000;
    proc.onaudioprocess = (e) => {
      if (this.st !== 'open' || !this.ws || this.ws.readyState !== 1) return;
      if (this.cb && this.cb.muted && this.cb.muted()) return;
      const inp = e.inputBuffer.getChannelData(0), n = Math.floor(inp.length / ratio), out = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        // average over the stretch that becomes one sample (a simple low-pass before thinning out)
        const a = Math.floor(i * ratio), b = Math.min(inp.length, Math.floor((i + 1) * ratio)); let s = 0;
        for (let k = a; k < b; k++) s += inp[k];
        out[i] = Math.max(-32768, Math.min(32767, (s / Math.max(1, b - a)) * 32767));
      }
      const by = new Uint8Array(out.buffer); let bin = '';
      for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000));
      try { this.ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: btoa(bin), commit: false, sample_rate: 16000 })); } catch (err) { /* closed */ }
    };
    src.connect(proc); proc.connect(sink); sink.connect(ctx.destination);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  },
  fail(why, hard) {
    this.why = why; if (hard) this.dead = true;
    this.stop(true); this.st = 'failed';
    if (this.cb) this.cb.state('err', why);
  },
  // keep: leave the microphone open (a quick reconnect); otherwise everything is let go
  stop(keep) {
    const ws = this.ws; this.ws = null;
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* ignore */ } }
    if (this.proc) { try { this.proc.disconnect(); this.proc.onaudioprocess = null; } catch (e) { /* ignore */ } this.proc = null; }
    if (this.ctx) { try { this.ctx.close(); } catch (e) { /* ignore */ } this.ctx = null; }
    if (!keep && this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; this.backToSpeaker(); }
    this.st = 'off';
  },
  /* iPhones: while a page records, all its sound goes to the small ear speaker. Safari lets a page say what it does
     (navigator.audioSession); when the microphone is let go, it is told "playback" again and the game's sound is
     started anew, so it comes out of the loud speaker */
  session(type) { try { if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch (e) { /* not here */ } },
  backToSpeaker() {
    this.session('playback');
    try { const c = SFX.ctx; if (c && c.state === 'running') c.suspend().then(() => c.resume()).catch(() => {}); } catch (e) { /* ignore */ }
  }
};
