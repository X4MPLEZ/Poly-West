/* ---------- talking to people ----------
   One button: V (touch: "Reden") near someone. Where the page may use the microphone, the browser's speech
   recognition (German) listens and sends when you stop talking. In claude.ai the frame does not allow the
   microphone, so the strip opens with a text line instead and the system's own dictation fills it
   (Windows: Win+H, Mac: Fn twice, phones: the microphone on the keyboard); dictated text is sent by itself when
   you pause, typed text with Enter.
   The line goes to Claude through the artifact's `sample` capability (the viewer's own Claude account, fastest
   model tier), with who the person is, what they know and what is going on right now. The answer streams back
   as "[action] words": the words appear in the bubble as they come, and each finished sentence goes to the
   person's voice at once (audio/voice.js), so speaking starts before the answer is complete.
   The person SAYS it; what HAPPENS is the game's decision: the action is one word from a short list that the
   person's own code checks (persona.act). Without Claude a small phrase book answers (persona.offline).
   A person who can talk has npc.persona = { rules, context(), offline(text), act(action) } and npc.voiceProfile. */
const TALK = {
  open: false, npc: null, ai: null, aiOff: false, aiOk: false, busy: false, rec: null, listening: false, heard: '', final: '',
  micOff: false, micWhy: '', ctl: null, lastErr: '', seq: 0, model: '', dictT: 0, aiEver: false, remarking: false, remarkT: -99,
  // the moods the voice can speak in (a person's persona may allow fewer: persona.moods)
  MOODS: ['neutral', 'amused', 'angry', 'surprised', 'disgusted', 'sleepy', 'whisper'],
  ACTIONS: ['none', 'nod', 'laugh', 'shake_head', 'serve_whiskey', 'serve_beer', 'serve_water', 'serve_bottle', 'point_door'],
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('talk'); this.state = $('talkState'); this.heardEl = $('talkHeard'); this.mic = $('talkMic');
    this.typeRow = $('talkType'); this.inp = $('talkIn'); this.hint = $('prompt3'); this.btn = $('bTalk');
    $('talkClose').addEventListener('click', () => this.close());
    this.stopBtn = $('talkStop');
    this.stopBtn.addEventListener('click', () => this.abort());
    $('talkSend').addEventListener('click', () => this.sendTyped());
    $('talkMicWin').addEventListener('click', () => MICWIN.open());
    this.inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.sendTyped(); } else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    // dictation puts in whole words or phrases at once (or composes them); typing comes a letter at a time
    this.inp.addEventListener('input', (e) => {
      const it = e.inputType || '', d = e.data || '';
      if (e.isComposing || it === 'insertReplacementText' || it === 'insertFromDictation' || (it === 'insertText' && d.length > 2) || it === 'insertFromPaste') this.dictT = 1.4;
      else if (this.dictT > 0) this.dictT = 1.4;
    });
    this.inp.addEventListener('compositionupdate', () => { this.dictT = 1.4; });
    this.mic.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.toggleListen(); });
    this.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.start(); });
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!this.SR) this.noMic('');
    // Claude: with an own key (the game on its own page) straight from here, else through claude.ai if this page may ask it
    this.sample = null;
    const pick = () => {
      if (DIRECT.claudeOn()) { this.ai = (p, o) => DIRECT.claude(p, o); this.aiOk = true; this.aiOff = false; this.via = 'key'; }
      else { this.ai = this.sample; this.via = this.sample ? 'claude.ai' : ''; }
    };
    try {
      if (window.claude && window.claude.use) window.claude.use('sample').then((s) => { this.sample = s || null; pick(); }).catch(() => { this.sample = null; pick(); });
    } catch (e) { this.sample = null; }
    SETTINGS.on('claudeKey', () => { this.lastErr = ''; pick(); });
    SETTINGS.on('elevenKey', () => { DIRECT.elevenDead = false; VOICE.toldEleven = false; HEAR.dead = false; HEAR.terms = true; });
    SETTINGS.on('sttMode', () => { HEAR.dead = false; });
    SETTINGS.on('voiceModel', () => { DIRECT.v3Dead = false; });
    // the built-in voice is the stand-in for ElevenLabs once it is in the browser's storage (then loading it is quick)
    try { if (window.caches) caches.keys().then((k) => { if (k.some((n) => n.startsWith('poly-west-voice-'))) VOICE.backup = true; }).catch(() => {}); } catch (e) { /* none */ }
    try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch (e) { /* no voices */ }
  },
  // who could be talked to right now
  target() {
    // seated you can call him from further away (across the room)
    let best = null, bd = SIT.state === 'sit' ? 12 : 5;
    for (const n of NPCS.list) {
      if (!n.persona || !n.ch.root.visible || (n.room && n.room !== G.room)) continue;
      const d = Math.hypot(n.pos.x - PLAY.pos.x, n.pos.z - PLAY.pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  },
  can() { return !SIT.busy() || SIT.state === 'sit'; },
  update(dt) {
    VOICE.tick();
    const t = this.can() && !DRUNK.blocked() && !MENU.open ? this.target() : null;
    const show = !!t && !this.open;
    if (show !== this.shown) { this.shown = show; this.hint.hidden = !show; this.btn.hidden = !show; }
    // the voice loads early: a few seconds after the start, so it is there when someone speaks
    if (VOICE.st === 'off' && VOICE.wanted() && G.time > 0.5) VOICE.load();
    if (VOICE.st === 'failed' && !this.toldVoice && VOICE.wanted()) { this.toldVoice = true; TOAST.show('Echte Stimme geht hier nicht (' + VOICE.why + '). Es spricht die Browser-Stimme.', 'long'); }
    if (this.open && (!this.npc || Math.hypot(this.npc.pos.x - PLAY.pos.x, this.npc.pos.z - PLAY.pos.z) > 6 || DRUNK.blocked())) this.close();
    if (!this.open) return;
    const n = this.npc; n.talking = true;
    const talkingNow = this.busy || VOICE.speaking(n);
    if (talkingNow === this.stopBtn.hidden) this.stopBtn.hidden = !talkingNow;
    if (this.listening && performance.now() - this.listenAt > 15000) this.stopListen();
    // dictated text: send when the dictation pauses
    if (this.dictT > 0) { this.dictT -= dt; if (this.dictT <= 0 && this.inp.value.trim() && !this.busy) this.sendTyped(); }
    if (VOICE.st === 'loading' && !this.busy && !this.listening && this.el.dataset.st !== 'err' && !this.dictT) this.setState((this.micOff ? '' : 'V: reden \u00b7 ') + VOICE.label(), 'idle');
    // face to face: the camera comes round over his shoulder, he turns to the one he talks to
    const dx = n.pos.x - PLAY.pos.x, dz = n.pos.z - PLAY.pos.z, face = Math.atan2(dx, dz);
    if (this.listening || this.busy || n.talkT > 0 || this.dictT > 0) {
      PLAY.camYaw += wrapA(Math.atan2(-dx, -dz) + 0.32 - PLAY.camYaw) * (1 - Math.exp(-dt * 2.2));
      PLAY.camPitch += (0.16 - PLAY.camPitch) * (1 - Math.exp(-dt * 2));
      if (!SIT.busy() && !FALL.busy() && PLAY.speed < 0.3) PLAY.yaw += wrapA(face - PLAY.yaw) * (1 - Math.exp(-dt * 4));
    }
  },
  /* ---- the strip at the bottom ---- */
  start() {
    const n = this.open ? this.npc : this.target();
    if (!n) return;
    VOICE.load();
    if (!this.open) {
      this.open = true; this.npc = n; FIST.up(); GUN.setAim(false);
      document.getElementById('talkName').textContent = n.name;
      this.el.hidden = false; document.getElementById('app').classList.add('talking');
      this.heardEl.textContent = ''; this.setState('');
      // on the game's own page without a key he can only use his phrase book: say where the key goes
      if (!this.aiOn() && DIRECT.ownPage() && /^https?:/.test(location.protocol) && !this.toldKey) { this.toldKey = true; TOAST.show('Für echte KI-Gespräche: Menü → Einstellungen → Eigene Schlüssel', 'long'); }
    }
    // ElevenLabs listens (own page with a key): just talk, hands free while the strip is open
    if (HEAR.wanted()) { this.hearMode(); return; }
    // the microphone window is connected: just talk (hands free while the strip is open)
    if (MICWIN.connected()) { this.remoteMode(); return; }
    // typing, or a dictation app / keyboard (Wispr Flow, the phone's microphone key) that writes into the line
    if (this.micOff || SETTINGS.v.sttMode === 'type' || (SETTINGS.v.sttMode === 'eleven' && !HEAR.wanted() && !this.SR)) { this.typeMode(); return; }
    if (!this.busy) this.listen();
  },
  /* ElevenLabs listening: words appear while you speak, a pause sends them; nothing is taken while he speaks */
  hearMode() {
    this.typeRow.hidden = true; this.mic.hidden = false; this.mic.setAttribute('aria-pressed', 'true');
    if (!this.busy) this.setState('Mikrofon wird verbunden \u2026', 'think');
    const cb = this.hearCb || (this.hearCb = {
      partial: (t) => { if (this.open && !this.busy) this.heardEl.textContent = '\u201e' + t + ' \u2026\u201c'; },
      final: (t) => { if (!this.open || this.busy) return; this.heardEl.textContent = '\u201e' + t + '\u201c'; this.send(t); },
      state: (k, txt) => {
        if (!this.open) return;
        if (k === 'listen' && !this.busy) this.setState('Ich höre \u2026 sprich einfach \u00b7 ' + VOICE.label(), 'listen');
        else if (k === 'closed') setTimeout(() => { if (this.open && HEAR.wanted() && !HEAR.active()) HEAR.start(cb); }, 300);   // the service ended the session: on we go
        else if (k === 'err') {
          this.setState(txt, 'err'); this.mic.setAttribute('aria-pressed', 'false');
          if (HEAR.dead) { TOAST.show('Zuhören über ElevenLabs: ' + txt + '. Es hört wieder der Browser zu.', 'long'); setTimeout(() => { if (this.open) this.start(); }, 1500); }
        }
      },
      muted: () => { const n = this.npc; let synth = false; try { synth = !!(window.speechSynthesis && speechSynthesis.speaking); } catch (e) { /* ignore */ } return !n || this.busy || n.talkT > 0 || VOICE.speaking(n) || synth; }
    });
    HEAR.start(cb);
  },
  remoteMode() {
    this.typeRow.hidden = true; this.mic.hidden = false; this.mic.setAttribute('aria-pressed', 'true');
    if (!this.busy) this.setState('Ich höre \u2026 sprich einfach \u00b7 ' + VOICE.label(), 'listen');
  },
  micLinked() { if (this.open) this.start(); },
  // words from the microphone window: used while the strip is open, not while the other one speaks
  remoteHeard(text, final) {
    if (!this.open || this.busy || !text) return;
    const n = this.npc;
    if (n.talkT > 0 || VOICE.speaking(n) || (window.speechSynthesis && speechSynthesis.speaking)) return;
    this.heardEl.textContent = '\u201e' + text + (final ? '\u201c' : ' \u2026\u201c');
    if (final) this.send(text);
  },
  remoteError(err) { if (this.open) this.setState('Mikrofon-Fenster: ' + err, 'err'); },
  // no microphone for the page: a text line that the system's dictation can fill
  typeMode() {
    this.typeRow.hidden = false;
    // (on phones the extra window would be a background tab that cannot listen: there the keyboard's microphone does it)
    document.getElementById('talkMicWin').hidden = MICWIN.connected() || GUN.touch;
    if (!this.busy) this.setState(this.micWhy || (GUN.touch ? 'Tipp ins Feld, dann aufs Mikrofon der Tastatur' : 'Mikrofon: 🎤-Fenster \u00b7 oder Windows+H \u00b7 oder tippen'), 'idle');
    setTimeout(() => { try { this.inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  },
  /* "Stopp": he stops talking (the answer on its way is dropped), the conversation stays open */
  abort() {
    const n = this.npc;
    this.userAbort = true;
    if (this.ctl) { this.ctl.abort(); this.ctl = null; }
    this.seq++; this.busy = false;
    if (n) { n.thinking = false; VOICE.stop(n); SAY.hide && SAY.hide(n); n.aiAt = G.time; }
    if (this.open) this.setState('Abgebrochen \u00b7 ' + (this.micOff ? 'schreib weiter oder Ende' : 'V: weiterreden'), 'idle');
  },
  /* "Ende" / Esc / walking off: only the strip goes; an answer on its way still comes (talking is something you do
     on the side, not a mode). Only "Stopp" takes an answer back. */
  close() {
    if (!this.open) return;
    HEAR.stop();
    if (this.inp.value.trim() && !this.busy) this.sendTyped();   // what was typed (or dictated) still goes to him
    this.stopListen(true);
    this.open = false; this.el.hidden = true; this.typeRow.hidden = true; this.dictT = 0; document.getElementById('app').classList.remove('talking');
    if (this.npc) this.npc.talking = false;
    this.npc = null;
    try { this.inp.blur(); document.getElementById('gl').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  },
  // keys while talking (not while the text line has the focus): V = speak again, Esc = end; the rest plays on
  key(e, k) {
    if (k === 'Escape') { this.close(); return true; }
    if (k === 'v') { if (!e.repeat) { if (HEAR.wanted()) { if (!HEAR.active()) this.hearMode(); } else if (MICWIN.connected()) this.remoteMode(); else if (this.micOff) this.typeMode(); else this.toggleListen(); } return true; }
    return false;
  },
  setState(s, cls) { this.state.textContent = s; this.el.dataset.st = cls || ''; },
  aiOn() { return !!this.ai && !this.aiOff && SETTINGS.v.aiTalk; },
  noMic(why) { this.micOff = true; this.micWhy = why; if (this.mic) this.mic.hidden = true; },
  /* ---- the microphone (where it is allowed) ---- */
  toggleListen() {
    if (HEAR.active()) { HEAR.stop(); this.mic.setAttribute('aria-pressed', 'false'); this.setState('Pause \u00b7 Mikrofon antippen zum Weiterreden', 'idle'); return; }
    if (this.listening) this.stopListen(); else if (this.open) this.start();
  },
  listen() {
    if (this.listening || this.busy || this.micOff) return;
    try {
      const r = this.rec = new this.SR();
      r.lang = 'de-DE'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      this.heard = ''; this.final = ''; this.dropNext = false; this.micErr = '';
      r.onresult = (e) => {
        let fin = '', mid = '';
        for (let i = 0; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else mid += x[0].transcript; }
        this.final = fin; this.heard = (fin + ' ' + mid).trim(); this.heardEl.textContent = '„' + this.heard + ' …“';
      };
      r.onerror = (e) => {
        this.micErr = e.error || 'error';
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) { this.noMic(''); this.typeMode(); }
      };
      r.onend = () => {
        if (this.rec !== r) return;
        this.listening = false; this.mic.setAttribute('aria-pressed', 'false');
        const said = (this.final || this.heard || '').trim();
        if (said && !this.dropNext) { this.heardEl.textContent = '„' + said + '“'; this.send(said); }
        else if (!this.micOff) this.setState(this.micErr === 'no-speech' || !said ? 'Nichts gehört. Nochmal: V' : '', 'idle');
        this.dropNext = false;
      };
      VOICE.stop(this.npc);
      r.start(); this.listening = true; this.listenAt = performance.now();
      this.mic.setAttribute('aria-pressed', 'true'); this.setState('Ich höre … sprich jetzt', 'listen'); this.heardEl.textContent = '';
    } catch (e) { this.noMic(''); this.typeMode(); }
  },
  stopListen(drop) { if (this.rec && this.listening) { this.dropNext = !!drop; try { this.rec.stop(); } catch (e) { /* ignore */ } } },
  sendTyped() { try { if (SFX.ctx && SFX.ctx.state !== 'running') SFX.ctx.resume(); } catch (e) { /* ignore */ } const t = this.inp.value.trim(); this.dictT = 0; if (!t || this.busy) return; this.inp.value = ''; this.heardEl.textContent = '„' + t + '“'; this.send(t); },
  /* ---- one exchange ---- */
  // "[nod] Klar. Kommt sofort." -> { action, say }; while streaming the bracket may not be complete yet
  parse(raw) {
    const s = raw.replace(/^\s+/, '');
    const m = /^\[\s*([a-z_]+)\s*(?:[,;|/]\s*([a-z_]+)\s*)?\]\s*/i.exec(s);
    if (m) return { action: m[1].toLowerCase(), mood: (m[2] || 'neutral').toLowerCase(), say: s.slice(m[0].length) };
    if (s.startsWith('[')) return { action: 'none', mood: 'neutral', say: s.indexOf(']') < 0 ? '' : s.slice(s.indexOf(']') + 1) };
    return { action: 'none', mood: 'neutral', say: s };
  },
  async send(text) {
    const n = this.npc;
    if (!n || this.busy) return;
    text = text.slice(0, 240);
    this.busy = true; const seq = ++this.seq;
    n.talkLog = n.talkLog || [];
    n.talkLog.push({ who: 'p', text });
    worldEvent('talk', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', to: n.id, text });
    VOICE.stop(n); try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    n.thinking = true; SAY.show(n, '…', 60);
    this.setState(n.name + ' überlegt …', 'think');
    // the answer, as it comes: words into the bubble, finished sentences to the voice
    const F = this.stream(n, seq), feed = F.feed;
    let raw = null;
    if (this.aiOn()) raw = await this.ask(n, text, (t) => feed(t, false));
    if (seq !== this.seq) { n.thinking = false; return; }   // ended or walked off meanwhile
    let out;
    if (raw !== null) out = this.parse(raw);
    else if (this.aiOn() || this.lastErr) out = { action: 'none', say: this.lastErr ? 'Hm? Sag das nochmal.' : n.persona.offline(text).say };
    else out = n.persona.offline(text);
    n.thinking = false; this.busy = false;
    const say = String(out.say || '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'Hm.';
    n.talkLog.push({ who: 'n', text: say });
    if (n.talkLog.length > 24) n.talkLog.splice(0, n.talkLog.length - 24);
    SAY.show(n, say);
    this.felt(n, out.mood);
    if (VOICE.ready() && raw !== null && F.queued() > 0) feed(raw, true);   // the rest of what was already being spoken
    else if (SETTINGS.v.voice) { VOICE.stop(n); VOICE.line(n, say, out.mood || (out.action === 'laugh' ? 'amused' : out.action === 'shake_head' ? 'disgusted' : 'neutral')); }
    if (this.lastErr) this.setState(this.lastErr, 'err');
    else if (MICWIN.connected() || HEAR.active()) this.setState('Ich höre \u2026 sprich einfach \u00b7 ' + VOICE.label(), 'listen');
    else this.setState((this.micOff ? '' : 'V: weiterreden \u00b7 ') + VOICE.label(), 'idle');
    this.lastErr = '';
    const act = String(out.action || 'none');
    n.persona.act(this.ACTIONS.includes(act) ? act : 'none');
    if (this.micOff && this.open && !MICWIN.connected()) this.typeMode();
  },
  // ways a spontaneous remark can go (one is picked at random each time)
  ANGLES: ['knappe, trockene Feststellung', 'ruhige, aber deutliche Warnung', 'kurze Frage an ihn', 'Hinweis auf die Folgen (Sheriff, Rechnung, sein Ruf in der Stadt)',
    'Erinnerung an etwas, das du in deinen Jahren hinter der Theke erlebt hast', 'kühler Kommentar zu seinem Zustand', 'klare Anweisung, was er jetzt tun soll',
    'Bemerkung, die zeigt, dass du dir das merkst', 'gelassene Reaktion eines Mannes, den so etwas kaum noch beeindruckt'],
  // after his own words he stays in that mood a while (his ready-made lines take it on) and does not bark at once
  felt(n, mood) { n.aiAt = G.time; if (mood && this.MOODS.includes(mood)) n.feel = { mood, t: G.time }; },
  /* may a ready-made line be said now? Not over his own words: not while an answer is coming or being spoken, and
     not in the few seconds after one; during a conversation only the urgent ones */
  mayBark(n, urgent) {
    if (!n) return false;
    if (this.remarking || (this.busy && this.npc === n) || n.thinking) return false;
    if (VOICE.speaking(n)) return false;
    try { if (window.speechSynthesis && speechSynthesis.speaking && G.time - (n.aiAt || -99) < 15) return false; } catch (e) { /* ignore */ }
    if (G.time - (n.aiAt || -99) < (urgent ? 1.5 : 4)) return false;
    if (this.open && this.npc === n && !urgent) return false;
    return true;
  },
  // the mood a ready-made line is said in: an angry or disgusted man stays so for a while, even for a friendly line
  barkMood(n, mood) {
    const f = n.feel;
    if (f && G.time - f.t < 45 && (f.mood === 'angry' || f.mood === 'disgusted') && (mood === 'neutral' || mood === 'amused' || mood === 'surprised')) return f.mood;
    return mood;
  },
  /* a streamed answer for person n: words into the bubble as they come, each finished sentence to the voice.
     Stops by itself once another answer has started (seq). noWhisper: say it out loud whatever mood comes back */
  stream(n, seq, noWhisper) {
    let queued = 0, shown = '';
    const feed = (raw, done) => {
      if (seq !== this.seq) return;
      const pr = this.parse(raw), say = pr.say.replace(/\s+/g, ' ');
      if (noWhisper && pr.mood === 'whisper') pr.mood = 'neutral';
      if (say && say !== shown) { shown = say; n.thinking = false; SAY.show(n, say, 60); if (this.el.dataset.st === 'think') this.setState('', 'idle'); }
      if (VOICE.ready()) {
        const rest = say.slice(queued), re = /[^.!?…]*[.!?…]+["'“”)]*(\s+|$)/g; let m, used = 0;
        while ((m = re.exec(rest)) && m[0]) { if (!m[1] && !done) break; VOICE.push(n, m[0], pr.mood); used = re.lastIndex; }
        if (done && used < rest.length && rest.slice(used).trim()) { VOICE.push(n, rest.slice(used), pr.mood); used = rest.length; }
        queued += used;
      }
    };
    return { feed, queued: () => queued, shown: () => shown };
  },
  /* something a person says unasked, in his own words: `situation` tells what just happened. Only when Claude has
     answered here before (so no permission question pops up in the middle of a gunfight), not while a conversation
     is waiting for its answer, and at most every few seconds. Returns false when it does not ask (the caller then
     says a ready-made line); fallback() is said instead when the answer fails or is too slow. */
  remark(n, situation, fallback, mood, chance) {
    if (chance !== undefined && Math.random() >= chance) return false;
    if (!n || !n.persona || !this.aiOn() || !(this.aiOk || this.aiEver) || this.busy || this.remarking) return false;
    if (!n.canBeHeard()) return true;   // nobody there to hear it: say nothing at all
    if (VOICE.speaking(n) || G.time - (n.aiAt || -99) < 3) return false;
    if (G.time - (this.remarkT || -99) < 6) return false;
    this.remarking = true; this.remarkT = G.time;
    const P = n.persona, seq = this.seq, F = this.stream(n, seq, true);
    const hist = (n.talkLog || []).slice(-8).map((l) => (l.who === 'p' ? 'Fremder: ' : n.name + ': ') + l.text).join('\n');
    const mine = (n.talkLog || []).filter((l) => l.who === 'n').slice(-5).map((l) => '„' + l.text + '“').join(' ');
    const acts = ['none', 'nod', 'laugh', 'shake_head', 'point_door'];
    // a different angle each time, so he does not say the same kind of thing twice
    const ANG = this.ANGLES, ang = ANG[Math.floor(Math.random() * ANG.length)];
    const prompt = P.rules + '\n\nWas gerade los ist:\n' + P.context() + (hist ? '\n\nZuletzt geredet:\n' + hist : '') +
      '\n\nGerade eben, ohne dass er dich angesprochen hat: ' + situation +
      '\nSag spontan von dir aus etwas dazu, direkt zu ihm. Diesmal als ' + ang + '. Zahlen nur, wenn sie wirklich etwas sagen; meist geht es ohne.' +
      (mine ? ' Deine letzten Sätze waren: ' + mine + ' – wiederhole davon nichts, auch nicht sinngemäß.' : '') +
      ' Ein kurzer Satz, höchstens 14 Wörter, nicht flüstern.\n\n' +
      'Antworte genau so: zuerst in eckigen Klammern EINE Aktion (' + acts.join(', ') + ') und, durch Komma getrennt, EINE Stimmung (' + this.MOODS.filter((m) => m !== 'whisper').join(', ') + '), dann deine Worte. Kein JSON, nichts davor.';
    const ctl = new AbortController();
    let failed = false;
    const fail = () => { if (failed) return; failed = true; if (seq === this.seq && !F.shown()) fallback(); };
    const timer = setTimeout(() => { if (!F.shown()) { ctl.abort(); fail(); } }, 7000);
    this.ai(prompt, { modelTier: 'quick', cache: false, signal: ctl.signal, onText: ({ text: t }) => F.feed(t, false) }).then((r) => {
      const raw = r && r.text;
      if (!raw || !raw.trim() || seq !== this.seq) { fail(); return; }
      const out = this.parse(raw), say = String(out.say || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!say) { fail(); return; }
      if (out.mood === 'whisper') out.mood = 'neutral';
      this.felt(n, out.mood);
      n.talkLog = n.talkLog || []; n.talkLog.push({ who: 'n', text: say });
      if (n.talkLog.length > 24) n.talkLog.splice(0, n.talkLog.length - 24);
      SAY.show(n, say);
      if (VOICE.ready() && F.queued() > 0) F.feed(raw, true);
      else if (SETTINGS.v.voice) { VOICE.stop(n); VOICE.line(n, say, this.MOODS.includes(out.mood) ? out.mood : mood || 'neutral'); }
      if (acts.includes(out.action) && out.action !== 'none') n.persona.act(out.action);
    }).catch(() => fail()).finally(() => { clearTimeout(timer); this.remarking = false; });
    return true;
  },
  async ask(n, text, onText) {
    const P = n.persona, hist = (n.talkLog || []).slice(-13, -1).map((l) => (l.who === 'p' ? 'Fremder: ' : n.name + ': ') + l.text).join('\n');
    const prompt = P.rules + '\n\nWas gerade los ist:\n' + P.context() + (hist ? '\n\nBisheriges Gespräch:\n' + hist : '') +
      '\n\nDer Fremde sagt jetzt: "' + text.replace(/"/g, '”') + '"\n\n' +
      'Antworte genau so: zuerst in eckigen Klammern EINE Aktion (' + this.ACTIONS.join(', ') + ') und, durch Komma getrennt, EINE Stimmung, ' +
      'in der du das sagst (' + this.MOODS.join(', ') + '), dann deine Worte. Kein JSON, nichts davor. Beispiele: [nod, neutral] Kommt sofort. [shake_head, angry] Nicht in meinem Laden! [laugh, amused] Der war gut.';
    const once = async () => {
      const ctl = this.ctl = new AbortController(); this.userAbort = false;
      // no answer in time: give up (the first call may wait on the viewer's permission, so it gets longer)
      const timer = setTimeout(() => { this.lastErr = 'Keine Antwort (Zeit abgelaufen).'; ctl.abort(); }, this.aiOk ? 25000 : 120000);
      try {
        const r = await this.ai(prompt, { modelTier: 'quick', cache: false, signal: ctl.signal, onText: ({ text: t }) => onText(t) });
        this.aiOk = this.aiEver = true; this.model = (r.modelApplied || r.modelTierApplied || '') + ''; return r.text;
      } finally { clearTimeout(timer); if (this.ctl === ctl) this.ctl = null; }
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const t = await once(); if (t && t.trim()) return t; this.lastErr = 'Leere Antwort der KI.'; return null; }
      catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
          this.aiOff = true; this.lastErr = 'KI nicht erlaubt (' + code + '). ' + n.name + ' antwortet einfacher.'; return null;
        }
        if (code === 'rate_limited') { this.lastErr = 'Zu viele Fragen gerade (rate_limited).'; return null; }
        if (['bad_key', 'no_credit', 'bad_request'].includes(code) || (code === 'network' && attempt > 0)) { this.lastErr = 'KI: ' + (e.message || code) + '.'; return null; }
        if (this.userAbort || this.lastErr.startsWith('Keine Antwort')) return null;
        // cancelled without us, or a hiccup on the way: one more try, then tell
        if (attempt === 0 && (code === 'cancelled' || code === 'upstream_error' || code === 'network' || code === 'stream_error')) continue;
        this.lastErr = 'KI-Fehler: ' + code; return null;
      }
    }
    return null;
  }
};
/* the settings button "Erinnerungen zurücksetzen": every person who can talk forgets everything about you
   (conversations and what they remember), as if you had never met; asks once more before it does it */
TALK.resetMemories = function () {
  const now = performance.now();
  if (!this.resetAsk || now - this.resetAsk > 5000) { this.resetAsk = now; return 'Wirklich? Zum Bestätigen innerhalb von 5 Sekunden nochmal drücken.'; }
  this.resetAsk = 0;
  if (this.open) this.close();
  for (const n of NPCS.list) { n.talkLog = []; if (n.persona && n.persona.forget) n.persona.forget(); }
  SAVE.write();
  return 'Erledigt. Alle haben dich vergessen.';
};
SAVE.part('talk', () => {
  const o = {};
  for (const n of NPCS.list) if (n.talkLog && n.talkLog.length) o[n.id] = n.talkLog.slice(-10);
  if (TALK.aiEver) o._ai = 1;
  return o;
}, (d) => {
  TALK.aiEver = !!(d && d._ai);
  for (const n of NPCS.list) if (d && Array.isArray(d[n.id])) n.talkLog = d[n.id].filter((l) => l && typeof l.text === 'string').map((l) => ({ who: l.who === 'p' ? 'p' : 'n', text: String(l.text).slice(0, 300) }));
});
