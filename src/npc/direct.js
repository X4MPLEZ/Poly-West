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
  ttsCache: new Map(), voiceIds: {}, err: '', badVoices: new Set(),
  // is this the game on its own page (not inside claude.ai)?
  ownPage() { return !(window.claude && window.claude.use); },
  // the AI key: which service it belongs to is told by how it starts (Anthropic sk-ant-…, Groq gsk_…, OpenAI sk-…)
  claudeOn() { return !!this.provider(); },
  provider() {
    const k = (SETTINGS.v.claudeKey || '').trim();
    if (!k) return null;
    if (/^sk-ant-/.test(k)) return this.PROVIDERS.claude;
    if (/^gsk_/.test(k)) return this.PROVIDERS.groq;
    if (/^sk-/.test(k)) return this.PROVIDERS.openai;
    return this.PROVIDERS.claude;
  },
  PROVIDERS: {
    claude: { name: 'Claude', model: 'claude-haiku-5-5', site: 'Anthropic' },
    groq: { name: 'Groq', model: 'llama-3.3-70b-versatile', url: 'https://api.groq.com/openai/v1/chat/completions', site: 'Groq' },
    openai: { name: 'OpenAI', model: 'gpt-4.1-mini', url: 'https://api.openai.com/v1/chat/completions', site: 'OpenAI' }
  },
  // the model: the one set in the settings, else the one found to work for this key, else the service's usual one
  modelFor(P) {
    const set = (SETTINGS.v.aiModel || '').trim();
    if (set) return set;
    let found = null; try { found = localStorage.getItem('polywest.aiModel.' + P.name); } catch (e) { /* none */ }
    return found || P.model;
  },
  // which models this key may use (OpenAI-style services list them); the best fitting one for talking, or null
  PREFER_MODELS: [/^llama-3\.3-70b/, /gpt-oss-120b/, /^moonshotai\/kimi/, /^qwen\//, /gpt-oss-20b/, /^meta-llama\/llama-4/, /^llama-3\.1-8b/, /^gpt-4\.1-mini/, /^gpt-4o-mini/, /^gpt-/],
  async pickModel(P, not) {
    try {
      const r = await fetch(P.url.replace('/chat/completions', '/models'), { headers: { authorization: 'Bearer ' + SETTINGS.v.claudeKey.trim() } });
      if (!r.ok) return null;
      const ids = ((await r.json()).data || []).map((m) => m.id).filter((id) => id && id !== not && !/whisper|tts|guard|safeguard|embed|orpheus|playai|distil|image|audio|realtime|transcribe/i.test(id));
      for (const re of this.PREFER_MODELS) { const m = ids.find((id) => re.test(id)); if (m) return m; }
      return ids[0] || null;
    } catch (e) { return null; }
  },
  elevenOn() { return !!(SETTINGS.v.elevenKey || '').trim() && !this.elevenDead; },
  fail(code, msg) { const e = new Error(msg || code); e.code = code; return e; },

  /* ---- the AI: Claude, or an OpenAI-style service (Groq, OpenAI) ---- */
  claude(prompt, opt) { return this.chat(prompt, opt); },
  chat(prompt, opt) {
    const P = this.provider();
    if (!P) return Promise.reject(this.fail('bad_key', 'kein KI-Schlüssel'));
    return P === this.PROVIDERS.claude ? this.anthropic(prompt, opt || {}) : this.openaiStyle(P, prompt, opt || {});
  },
  async anthropic(prompt, opt) {
    // (what people say goes to the stronger model unless one is set: better German, sentences that fit)
    const model = !(SETTINGS.v.aiModel || '').trim() && opt.modelTier && opt.modelTier !== 'quick' ? 'claude-sonnet-5-5' : this.modelFor(this.PROVIDERS.claude);
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: opt.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': SETTINGS.v.claudeKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(Object.assign({ model, max_tokens: opt.maxTokens || 160, stream: true, messages: [{ role: 'user', content: prompt }] },
          opt.system ? { system: [{ type: 'text', text: opt.system, cache_control: { type: 'ephemeral' } }] } : {}))
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
    return { text, modelApplied: model };
  },
  // Groq and OpenAI: /chat/completions, streamed; the text comes in choices[0].delta.content
  async openaiStyle(P, prompt, opt, retried) {
    const model = this.modelFor(P), body = { model, stream: true, temperature: 0.6, max_tokens: opt.maxTokens || 160,
      messages: (opt.system ? [{ role: 'system', content: opt.system }] : []).concat([{ role: 'user', content: prompt }]) };
    if (/gpt-oss/.test(model)) { body.reasoning_effort = 'low'; body.include_reasoning = false; body.max_tokens = 600; }   // (thinking models: think briefly, say it short)
    let r;
    try {
      r = await fetch(P.url, { method: 'POST', signal: opt.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + SETTINGS.v.claudeKey.trim() }, body: JSON.stringify(body) });
    } catch (e) {
      if (e && e.name === 'AbortError') throw this.fail('cancelled');
      throw this.fail('network', 'keine Verbindung zu ' + P.name);
    }
    if (!r.ok) {
      let msg = ''; try { const j = await r.json(); msg = (j.error && (j.error.message || j.error.code)) || ''; } catch (e) { /* no body */ }
      if (r.status === 401 || r.status === 403) throw this.fail('bad_key', P.name + '-Schlüssel abgelehnt');
      if (r.status === 429) throw this.fail(/quota|billing|credit/i.test(msg) ? 'no_credit' : 'rate_limited', /quota|billing|credit/i.test(msg) ? 'kein Guthaben bei ' + P.site : undefined);
      // the model is not there (any more) for this key: ask the service which ones are, take the best, try once more
      if ((r.status === 404 || /model/i.test(msg)) && !retried && !(SETTINGS.v.aiModel || '').trim()) {
        const m = await this.pickModel(P, model);
        if (m && m !== model) { try { localStorage.setItem('polywest.aiModel.' + P.name, m); } catch (e) { /* not kept */ } return this.openaiStyle(P, prompt, opt, true); }
      }
      if (r.status === 400 || r.status === 404) throw this.fail('bad_request', P.name + ' (' + model + '): ' + (msg || r.status).toString().slice(0, 110));
      throw this.fail('upstream_error', P.name + ' ' + r.status);
    }
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
          const d = line.slice(5).trim();
          if (d === '[DONE]') continue;
          let ev; try { ev = JSON.parse(d); } catch (e) { continue; }
          if (ev.error) throw this.fail('stream_error', ev.error.message || 'Fehler');
          const c = ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content;
          if (c) { text += c; if (opt.onText) opt.onText({ text }); }
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw this.fail('cancelled');
      throw e.code ? e : this.fail('network', 'Verbindung abgerissen');
    }
    return { text, modelApplied: model };
  },

  /* ---- ElevenLabs ---- */
  // the voice for a person: the one set in the settings (Hank), the one found before, or a fitting one from the account
  async voiceFor(npc) {
    if (npc && npc.voiceId) return npc.voiceId;   // (trying a voice out in the settings)
    const set = (SETTINGS.v.elevenVoice || '').trim();
    if (set && !this.badVoices.has(set) && (!npc || npc.id === 'barkeep')) return set;
    const key = (npc && npc.id) || 'any';
    if (this.voiceIds[key]) return this.voiceIds[key];
    let saved = null; try { saved = localStorage.getItem('polywest.elVoice.' + key); } catch (e) { /* none */ }
    if (saved && !this.badVoices.has(saved)) return (this.voiceIds[key] = saved);
    let id = this.FALLBACK_VOICE;
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': SETTINGS.v.elevenKey.trim() } });
      if (r.ok) {
        const vs = ((await r.json()).voices || []).filter((v) => v && v.voice_id && !this.badVoices.has(v.voice_id) && (v.category === 'premade' || !this.badVoices.size));
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
  // the most expressive model (v3) is told the mood with a tag in front of the sentence
  TAGS: { neutral: '', amused: '[amused] ', angry: '[angry] ', surprised: '[surprised] ', disgusted: '[annoyed] ', sleepy: '[tired] ', whisper: '[whispers] ', drunk: '[drunk] ' },
  v3() { return SETTINGS.v.voiceModel === 'v3' && !this.v3Dead; },
  /* one sentence -> Float32Array at RATE; throws with a code on failure. The free plan allows only a few requests at
     the same time: they wait in line (two at a time), and "too many" is tried again a moment later */
  busy: 0, line: [],
  async tts(npc, text, mood, keep) {
    // a ready-made line said before (any day): from the browser's storage, no request at all
    let key = null;
    if (keep) {
      key = (await this.voiceFor(npc)) + '|' + (this.v3() ? 'v3' : 'f') + '|' + mood + '|' + text;
      if (this.ttsCache.has(key)) return this.ttsCache.get(key);
      const got = await this.keptGet(key);
      if (got) { this.ttsCache.set(key, got); return got; }
    }
    const pcm = await this.ttsQueued(npc, text, mood);
    if (keep && pcm) this.keptPut(key, pcm);
    return pcm;
  },
  KEEP: 'poly-west-tts-1',
  keyUrl(k) { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0; return 'https://tts.poly-west.local/' + (h >>> 0).toString(36) + '/' + encodeURIComponent(k.slice(-80)); },
  async keptGet(k) {
    try { const c = await caches.open(this.KEEP), r = await c.match(this.keyUrl(k)); if (!r) return null;
      const i16 = new Int16Array(await r.arrayBuffer()), f = new Float32Array(i16.length); for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32768; return f;
    } catch (e) { return null; }
  },
  keptPut(k, pcm) {
    try {
      const i16 = new Int16Array(pcm.length); for (let i = 0; i < pcm.length; i++) i16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32768));
      caches.open(this.KEEP).then((c) => c.put(this.keyUrl(k), new Response(i16.buffer))).catch(() => {});
    } catch (e) { /* no storage here */ }
  },
  async ttsQueued(npc, text, mood) {
    if (this.busy >= 2) await new Promise((res) => this.line.push(res));
    this.busy++;
    try {
      for (let tries = 0; ; tries++) {
        try { return await this.tts1(npc, text, mood); }
        catch (e) { if (e.code !== 'rate_limited' || tries >= 3) throw e; await new Promise((res) => setTimeout(res, 400 + tries * 600)); }
      }
    } finally { this.busy--; const next = this.line.shift(); if (next) next(); }
  },
  async tts1(npc, text, mood) {
    const v3 = this.v3(), voice = await this.voiceFor(npc), k = voice + '|' + (v3 ? 'v3' : 'f') + '|' + mood + '|' + text;
    if (this.badVoices.has(voice) && !(npc && npc.voiceId)) throw this.fail('tts_error', 'keine nutzbare ElevenLabs-Stimme');
    if (this.ttsCache.has(k)) return this.ttsCache.get(k);
    const [stability, speed] = this.MOOD[mood] || this.MOOD.neutral;
    const body = v3 ? { text: (this.TAGS[mood] || '') + text, model_id: 'eleven_v3', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }
      : { text, model_id: this.TTS_MODEL, language_code: 'de', voice_settings: { stability, similarity_boost: 0.8, speed } };
    let r;
    try {
      r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice) + (v3 ? '' : '/stream') + '?output_format=pcm_24000', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': SETTINGS.v.elevenKey.trim() },
        body: JSON.stringify(body)
      });
    } catch (e) { throw this.fail('network', 'keine Verbindung zu ElevenLabs'); }
    // v3 not allowed or not there (plan, region): the fast model from now on, this sentence too
    if (v3 && !r.ok && r.status !== 401 && r.status !== 429) {
      this.v3Dead = true;
      try { TOAST.show('Ausdrucksstarke Stimme (v3) geht mit diesem Konto nicht – es spricht die schnelle.', 'long'); } catch (e) { /* ignore */ }
      return this.tts(npc, text, mood);
    }
    if (!r.ok) {
      let msg = ''; try { const j = await r.json(); msg = (j.detail && (j.detail.message || j.detail.status)) || ''; } catch (e) { /* no body */ }
      if (r.status === 401 || r.status === 403) throw this.fail('bad_key', 'ElevenLabs-Schlüssel abgelehnt' + (msg ? ' (' + msg.slice(0, 60) + ')' : ''));
      if (r.status === 404 || /voice/i.test(msg)) {   // the stored voice is gone: look for another next time
        try { localStorage.removeItem('polywest.elVoice.' + ((npc && npc.id) || 'any')); } catch (e) { /* ignore */ }
        delete this.voiceIds[(npc && npc.id) || 'any'];
      }
      if (/quota|credit/i.test(msg)) throw this.fail('no_credit', 'ElevenLabs-Guthaben aufgebraucht (' + msg.slice(0, 120) + ')');
      /* the voice itself may not be used this way (a library voice on the free plan, a voice not shared any more …):
         say why, once, and speak on with another voice (a preview just shows the reason) */
      if (r.status !== 429 && (r.status === 402 || /library|subscription|upgrade|free user|tier|plan|payment|voice/i.test(msg)) && !(npc && npc.voiceId)) {
        this.badVoices.add(voice); delete this.voiceIds[(npc && npc.id) || 'any'];
        const lib = /library|subscription|upgrade|free user|tier|plan|payment/i.test(msg) || r.status === 402;
        try { TOAST.show(lib ? 'ElevenLabs lässt diese Stimme im Gratis-Tarif nicht übers Spiel zu (Stimme aus der Bibliothek). Hank spricht mit einer Standardstimme weiter. Geht: Starter-Abo – oder eine eigene Stimme mit „Voice Design“ erstellen.'
          : 'Diese Stimme geht nicht (' + (msg || r.status) + '). Hank spricht mit einer anderen weiter.', 'long'); } catch (e) { /* ignore */ }
        return this.tts1(npc, text, mood);
      }
      if (r.status !== 429 && /library|subscription|upgrade|free user|tier|plan|payment/i.test(msg)) throw this.fail('tts_error', 'Diese Stimme geht im Gratis-Tarif nicht übers Spiel (Stimme aus der Bibliothek) – ElevenLabs: ' + msg.slice(0, 90));
      if (r.status === 429 || /concurren|too_many|rate/i.test(msg)) throw this.fail('rate_limited', 'ElevenLabs: zu viele Anfragen gleichzeitig');
      throw this.fail('tts_error', 'ElevenLabs ' + r.status + (msg ? ': ' + msg.slice(0, 60) : ''));
    }
    const b = new Uint8Array(await r.arrayBuffer()), n = b.length >> 1, out = new Float32Array(n), dv = new DataView(b.buffer, b.byteOffset, n * 2);
    for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 32768;
    if (this.ttsCache.size > 80) this.ttsCache.delete(this.ttsCache.keys().next().value);
    this.ttsCache.set(k, out);
    return out;
  },

  /* ---- choosing a voice in the settings: the voices of the account, to listen to and to take ---- */
  async listVoices() {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': SETTINGS.v.elevenKey.trim() } });
    if (r.status === 401 || r.status === 403) throw this.fail('bad_key', 'Schlüssel darf die Stimmen nicht lesen (Recht „Stimmen: Gelesen“)');
    if (!r.ok) throw this.fail('voices', 'ElevenLabs ' + r.status);
    const vs = ((await r.json()).voices || []).filter((v) => v && v.voice_id);
    // men first, own voices (cloned, designed, from the library) before ElevenLabs' standard ones
    const rank = (v) => (/female/i.test((v.labels && v.labels.gender) || '') ? 2 : 0) + (v.category === 'premade' ? 1 : 0);
    return vs.sort((a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || ''));
  },
  SAMPLE: 'Howdy, Fremder. Was darf’s sein, Whiskey oder Ärger?',
  // listen to a voice of the account with a sentence of Hank's (no stand-in voice if it fails: the reason is shown)
  tryVoice(id) {
    this.elevenDead = false;
    VOICE.stop(this.previewNpc);
    this.previewNpc = { id: 'preview', name: 'Hank', pos: PLAY.pos, voiceProfile: { male: true }, voiceId: id, noFallback: true };
    VOICE.line(this.previewNpc, this.SAMPLE, 'neutral');
  },
  /* German voices from ElevenLabs' library (spoken by German speakers, not English voices speaking German) */
  async germanVoices(gender) {
    const q = 'language=de&page_size=40&sort=usage_character_count_1y' + (gender ? '&gender=' + gender : '');
    const r = await fetch('https://api.elevenlabs.io/v1/shared-voices?' + q, { headers: { 'xi-api-key': SETTINGS.v.elevenKey.trim() } });
    if (r.status === 401 || r.status === 403) throw this.fail('bad_key', 'Schlüssel darf die Stimmen-Bibliothek nicht lesen (Recht „Stimmen: Gelesen“)');
    if (!r.ok) throw this.fail('voices', 'ElevenLabs ' + r.status);
    return ((await r.json()).voices || []).filter((v) => v && v.voice_id && v.public_owner_id);
  },
  // a library voice into the account, then it is Hank's
  async addVoice(v) {
    const r = await fetch('https://api.elevenlabs.io/v1/voices/add/' + encodeURIComponent(v.public_owner_id) + '/' + encodeURIComponent(v.voice_id), {
      method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': SETTINGS.v.elevenKey.trim() }, body: JSON.stringify({ new_name: v.name })
    });
    let j = {}; try { j = await r.json(); } catch (e) { /* no body */ }
    if (r.status === 401 || r.status === 403) throw this.fail('bad_key', 'Zum Hinzufügen braucht der Schlüssel „Stimmen: Schreiben“ – oder auf elevenlabs.io in der Voice Library auf „Add to my voices“ und dann hier „Meine Stimmen“');
    if (!r.ok) throw this.fail('voices', 'ElevenLabs ' + r.status + ((j.detail && j.detail.message) ? ': ' + j.detail.message.slice(0, 80) : ''));
    const id = j.voice_id || v.voice_id;
    this.takeVoice(id);
    return id;
  },
  takeVoice(id) {
    SETTINGS.set('elevenVoice', id);
    delete this.voiceIds.barkeep;
  },
  // the settings button: are the keys good?
  async test() {
    const out = [];
    if (this.claudeOn()) {
      const P = this.provider();
      try { const r = await this.chat('Sag nur: Howdy.', { maxTokens: 10 }); out.push(P.name + ': ok (' + this.modelFor(P) + ')'); }
      catch (e) { out.push(P.name + ': ' + (e.message || e.code)); }
    } else out.push('KI: kein Schlüssel');
    if ((SETTINGS.v.elevenKey || '').trim()) {
      this.elevenDead = false;
      const hank = { id: 'barkeep', name: 'Hank', pos: PLAY.pos, voiceProfile: {} };
      try { await this.tts(hank, 'Howdy, Fremder. So klinge ich jetzt.', 'neutral'); out.push('ElevenLabs: ok'); VOICE.line(hank, 'Howdy, Fremder. So klinge ich jetzt.'); }
      catch (e) { out.push('ElevenLabs: ' + (e.message || e.code)); }
    } else out.push('ElevenLabs: kein Schlüssel');
    if ((SETTINGS.v.deepgramKey || '').trim()) out.push('Deepgram: ' + await this.testDeepgram());
    return out.join(' · ');
  },
  // a short connection to Deepgram: does it open with this key?
  testDeepgram() {
    return new Promise((res) => {
      let ws, done = false; const end = (t) => { if (done) return; done = true; try { ws.close(); } catch (e) { /* ignore */ } res(t); };
      try { ws = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-3&language=de&encoding=linear16&sample_rate=16000', ['token', SETTINGS.v.deepgramKey.trim()]); }
      catch (e) { res('keine Verbindung'); return; }
      ws.onopen = () => end('ok');
      ws.onclose = (ev) => end(ev.code === 1008 || ev.code === 4001 ? 'Schlüssel abgelehnt' : 'Schlüssel abgelehnt oder keine Verbindung');
      setTimeout(() => end('keine Antwort'), 6000);
    });
  }
};
