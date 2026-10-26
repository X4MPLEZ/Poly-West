/* ---------- own keys: Claude and ElevenLabs straight from the browser (for the game on its own page) ----------
   In claude.ai the game talks to Claude through the artifact's `sample` capability. On its own page (GitHub Pages)
   the player enters an Anthropic API key and an ElevenLabs key in the settings; they stay in this browser
   (localStorage), never in the code or the repository, and the browser calls both services itself:
   - Claude: POST /v1/messages, streamed (server-sent events), with the header Anthropic provides for direct
     browser access. Same shape as `sample`: claude(prompt, { signal, onText }) -> { text }.
   - ElevenLabs: POST /v1/text-to-speech/{voice}/stream as raw 16-bit PCM at 24 kHz (every plan), one sentence per
     request, the mood as voice settings. Lines said before are kept in memory, so a ready-made line costs once.
   Without keys nothing here is used. */
const DIRECT = {
  MODEL: 'claude-haiku-5-5', TTS_MODEL: 'eleven_flash_v2_5', RATE: 24000,
  // a voice that every account has (ElevenLabs' default "George"); used when no better one is found
  FALLBACK_VOICE: 'JBFqnCBsd6RMkjVDRZzb',
  PREFER: /clyde|bill|george|brian|callum|daniel|arnold|adam/i,
  ttsCache: new Map(), voiceIds: {}, err: '',
  // is this the game on its own page (not inside claude.ai)?
  ownPage() { return !(window.claude && window.claude.use); },
  claudeOn() { return !!(SETTINGS.v.claudeKey || '').trim(); },
  elevenOn() { return !!(SETTINGS.v.elevenKey || '').trim() && !this.elevenDead; },
  fail(code, msg) { const e = new Error(msg || code); e.code = code; return e; },

  /* ---- Claude ---- */
  async claude(prompt, opt) {
    opt = opt || {};
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: opt.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': SETTINGS.v.claudeKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: this.MODEL, max_tokens: opt.maxTokens || 220, stream: true, messages: [{ role: 'user', content: prompt }] })
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw this.fail('cancelled');
      throw this.fail('network', 'keine Verbindung zu Claude');
    }
    if (!r.ok) {
      let msg = ''; try { const j = await r.json(); msg = (j.error && j.error.message) || ''; } catch (e) { /* no body */ }
      if (r.status === 401 || r.status === 403) throw this.fail('bad_key', 'Claude-Schlüssel abgelehnt');
      if (r.status === 429) throw this.fail('rate_limited');
      if (r.status === 400 && /credit/i.test(msg)) throw this.fail('no_credit', 'kein Guthaben bei Anthropic');
      if (r.status === 400) throw this.fail('bad_request', msg.slice(0, 80));
      throw this.fail('upstream_error', 'Claude ' + r.status);
    }
    // server-sent events: "data: {...}" lines; the text comes in content_block_delta events
    const rd = r.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '';
    try {
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { text += ev.delta.text; if (opt.onText) opt.onText({ text }); }
          else if (ev.type === 'error') throw this.fail(ev.error && ev.error.type === 'overloaded_error' ? 'upstream_error' : 'stream_error', (ev.error && ev.error.message) || 'Fehler');
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw this.fail('cancelled');
      throw e.code ? e : this.fail('network', 'Verbindung abgerissen');
    }
    return { text, modelApplied: this.MODEL };
  },

  /* ---- ElevenLabs ---- */
  // the voice for a person: the one set in the settings (Hank), the one found before, or a fitting one from the account
  async voiceFor(npc) {
    const set = (SETTINGS.v.elevenVoice || '').trim();
    if (set && (!npc || npc.id === 'barkeep')) return set;
    const key = (npc && npc.id) || 'any';
    if (this.voiceIds[key]) return this.voiceIds[key];
    let saved = null; try { saved = localStorage.getItem('polywest.elVoice.' + key); } catch (e) { /* none */ }
    if (saved) return (this.voiceIds[key] = saved);
    let id = this.FALLBACK_VOICE;
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': SETTINGS.v.elevenKey.trim() } });
      if (r.ok) {
        const vs = ((await r.json()).voices || []).filter((v) => v && v.voice_id);
        const male = (v) => /male/i.test((v.labels && v.labels.gender) || '') && !/female/i.test((v.labels && v.labels.gender) || '');
        const older = (v) => /old|middle/i.test((v.labels && v.labels.age) || '');
        const best = vs.find((v) => this.PREFER.test(v.name || '') && male(v)) || vs.find((v) => male(v) && older(v)) || vs.find(male);
        if (best) id = best.voice_id;
      }
    } catch (e) { /* keep the default */ }
    try { localStorage.setItem('polywest.elVoice.' + key, id); } catch (e) { /* not kept */ }
    return (this.voiceIds[key] = id);
  },
  // how a mood sounds: less stable = more expression; a little faster when angry, slower when tired
  MOOD: { neutral: [0.5, 1], amused: [0.4, 1.03], angry: [0.28, 1.08], surprised: [0.35, 1.05], disgusted: [0.42, 0.98], sleepy: [0.6, 0.88], whisper: [0.55, 0.92], drunk: [0.3, 0.9] },
  // one sentence -> Float32Array at RATE; throws with a code on failure
  async tts(npc, text, mood) {
    const k = (npc && npc.id) + '|' + mood + '|' + text;
    if (this.ttsCache.has(k)) return this.ttsCache.get(k);
    const voice = await this.voiceFor(npc), [stability, speed] = this.MOOD[mood] || this.MOOD.neutral;
    let r;
    try {
      r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice) + '/stream?output_format=pcm_24000', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': SETTINGS.v.elevenKey.trim() },
        body: JSON.stringify({ text, model_id: this.TTS_MODEL, language_code: 'de', voice_settings: { stability, similarity_boost: 0.8, speed } })
      });
    } catch (e) { throw this.fail('network', 'keine Verbindung zu ElevenLabs'); }
    if (!r.ok) {
      let msg = ''; try { const j = await r.json(); msg = (j.detail && (j.detail.message || j.detail.status)) || ''; } catch (e) { /* no body */ }
      if (r.status === 401 || r.status === 403) throw this.fail('bad_key', 'ElevenLabs-Schlüssel abgelehnt' + (msg ? ' (' + msg.slice(0, 60) + ')' : ''));
      if (r.status === 404 || /voice/i.test(msg)) {   // the stored voice is gone: look for another next time
        try { localStorage.removeItem('polywest.elVoice.' + ((npc && npc.id) || 'any')); } catch (e) { /* ignore */ }
        delete this.voiceIds[(npc && npc.id) || 'any'];
      }
      if (/quota|credit/i.test(msg)) throw this.fail('no_credit', 'ElevenLabs-Guthaben aufgebraucht');
      throw this.fail('tts_error', 'ElevenLabs ' + r.status + (msg ? ': ' + msg.slice(0, 60) : ''));
    }
    const b = new Uint8Array(await r.arrayBuffer()), n = b.length >> 1, out = new Float32Array(n), dv = new DataView(b.buffer, b.byteOffset, n * 2);
    for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 32768;
    if (this.ttsCache.size > 80) this.ttsCache.delete(this.ttsCache.keys().next().value);
    this.ttsCache.set(k, out);
    return out;
  },

  // the settings button: are the keys good?
  async test() {
    const out = [];
    if (this.claudeOn()) {
      try { const r = await this.claude('Sag nur: Howdy.', { maxTokens: 10 }); out.push('Claude: ok (' + (r.text || '').trim().slice(0, 20) + ')'); }
      catch (e) { out.push('Claude: ' + (e.message || e.code)); }
    } else out.push('Claude: kein Schlüssel');
    if ((SETTINGS.v.elevenKey || '').trim()) {
      this.elevenDead = false;
      const hank = { id: 'barkeep', name: 'Hank', pos: PLAY.pos, voiceProfile: {} };
      try { await this.tts(hank, 'Howdy, Fremder. So klinge ich jetzt.', 'neutral'); out.push('ElevenLabs: ok'); VOICE.line(hank, 'Howdy, Fremder. So klinge ich jetzt.'); }
      catch (e) { out.push('ElevenLabs: ' + (e.message || e.code)); }
    } else out.push('ElevenLabs: kein Schlüssel');
    return out.join(' · ');
  }
};
