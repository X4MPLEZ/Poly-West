/* ---------- talking to people ----------
   Press V (touch: the "Reden" button) near someone and speak: the browser's speech recognition (German) turns it
   into text when you stop talking. (Typing is only the fallback where no microphone is allowed.) The line goes to Claude through the artifact's `sample` capability
   (on the viewer's own Claude account; the first time the viewer is asked to allow it), together with who the
   person is, what they know and what is going on right now. The answer comes back as JSON {say, action}.
   The person SAYS it (bubble, panel, a browser voice), but what HAPPENS is the game's decision: an action is one
   word from a short list, and the person's own code checks it (serving costs money, …).
   Without Claude (outside claude.ai, or not allowed, or offline) a small phrase book answers instead.
   A person who can talk has npc.persona = { rules, context(), offline(text), act(action) }. */
const TALK = {
  open: false, npc: null, ai: null, aiOff: false, aiOk: false, busy: false, rec: null, listening: false, heard: '', final: '',
  micOff: false, micWhy: '', ctl: null, voice: null, lastErr: '', seq: 0,
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('talk'); this.state = $('talkState'); this.heardEl = $('talkHeard'); this.mic = $('talkMic');
    this.typeRow = $('talkType'); this.inp = $('talkIn'); this.hint = $('prompt3'); this.btn = $('bTalk');
    $('talkClose').addEventListener('click', () => this.close());
    $('talkSend').addEventListener('click', () => this.sendTyped());
    this.inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.sendTyped(); } else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    // one tap: listen (it stops by itself when you stop talking); a tap while listening: done
    this.mic.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.toggleListen(); });
    this.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.start(); });
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!this.SR) this.noMic('Dieser Browser kann keine Sprache erkennen (Chrome oder Edge können es).');
    // Claude, if this page may ask it
    try {
      if (window.claude && window.claude.use) window.claude.use('sample').then((s) => { this.ai = s || null; }).catch(() => { this.ai = null; });
    } catch (e) { this.ai = null; }
    try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch (e) { /* no voices */ }
  },
  // who could be talked to right now
  target() {
    let best = null, bd = 4.2;
    for (const n of NPCS.list) {
      if (!n.persona || !n.ch.root.visible || (n.room && n.room !== G.room)) continue;
      const d = Math.hypot(n.pos.x - PLAY.pos.x, n.pos.z - PLAY.pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  },
  can() { return !SIT.busy() || SIT.state === 'sit'; },
  update(dt) {
    const t = this.can() && !DRUNK.blocked() && !MENU.open ? this.target() : null;
    const show = !!t && !this.open;
    if (show !== this.shown) { this.shown = show; this.hint.hidden = !show; this.btn.hidden = !show; }
    if (this.open && (!this.npc || Math.hypot(this.npc.pos.x - PLAY.pos.x, this.npc.pos.z - PLAY.pos.z) > 6 || DRUNK.blocked())) this.close();
    if (!this.open) return;
    const n = this.npc; n.talking = true;
    // listening that never ends (some browsers): give up after a while
    if (this.listening && performance.now() - this.listenAt > 15000) this.stopListen();
    // while talking face to face: the camera comes round over his shoulder, he turns to the other one
    if (this.listening || this.busy || n.talkT > 0) {
      const dx = n.pos.x - PLAY.pos.x, dz = n.pos.z - PLAY.pos.z, face = Math.atan2(dx, dz);
      PLAY.camYaw += wrapA(Math.atan2(-dx, -dz) + 0.32 - PLAY.camYaw) * (1 - Math.exp(-dt * 2.2));
      PLAY.camPitch += (0.16 - PLAY.camPitch) * (1 - Math.exp(-dt * 2));
      if (!SIT.busy() && !FALL.busy() && PLAY.speed < 0.3) PLAY.yaw += wrapA(face - PLAY.yaw) * (1 - Math.exp(-dt * 4));
    }
  },
  /* ---- the strip at the bottom: who, what he hears, what is going on ---- */
  start() {
    const n = this.open ? this.npc : this.target();
    if (!n) return;
    if (!this.open) {
      this.open = true; this.npc = n; FIST.up(); GUN.setAim(false);
      document.getElementById('talkName').textContent = n.name;
      this.el.hidden = false; document.getElementById('app').classList.add('talking');
      this.heardEl.textContent = ''; this.setState('');
    }
    if (this.micOff) { this.typeRow.hidden = false; this.setState(this.micWhy); setTimeout(() => this.inp.focus({ preventScroll: true }), 30); return; }
    if (!this.busy) this.listen();
  },
  close() {
    if (!this.open) return;
    this.stopListen(true);
    if (this.ctl) { this.ctl.abort(); this.ctl = null; }
    this.open = false; this.el.hidden = true; document.getElementById('app').classList.remove('talking');
    if (this.npc) { this.npc.talking = false; this.npc.thinking = false; }
    this.npc = null; this.busy = false; this.seq++;
    try { this.inp.blur(); document.getElementById('gl').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  },
  // keys while talking: V = speak again (or stop), Esc = end; everything else plays on
  key(e, k) {
    if (k === 'Escape') { this.close(); return true; }
    if (k === 'v') { if (!e.repeat) this.toggleListen(); return true; }
    return false;
  },
  setState(s, cls) { this.state.textContent = s; this.el.dataset.st = cls || ''; },
  aiOn() { return !!this.ai && !this.aiOff && SETTINGS.v.aiTalk; },
  noMic(why) { this.micOff = true; this.micWhy = why; if (this.mic) this.mic.hidden = true; },
  /* ---- the microphone ---- */
  toggleListen() { if (this.listening) this.stopListen(); else if (this.open) this.start(); },
  listen() {
    if (this.listening || this.busy || this.micOff) return;
    try {
      const r = this.rec = new this.SR();
      r.lang = 'de-DE'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      this.heard = ''; this.final = ''; this.dropNext = false; this.micErr = '';
      r.onresult = (e) => {
        let fin = '', mid = '';
        for (let i = 0; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else mid += x[0].transcript; }
        this.final = fin; this.heard = (fin + ' ' + mid).trim(); this.heardEl.textContent = '\u201e' + this.heard + ' \u2026\u201c';
      };
      r.onerror = (e) => {
        this.micErr = e.error || 'error';
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) {
          this.noMic(e.error === 'audio-capture' ? 'Kein Mikrofon gefunden. Schreib stattdessen.' : 'Das Mikrofon ist hier nicht erlaubt (' + e.error + '). Schreib stattdessen.');
          this.typeRow.hidden = false; setTimeout(() => this.inp.focus({ preventScroll: true }), 30);
        }
      };
      r.onend = () => {
        if (this.rec !== r) return;
        this.listening = false; this.mic.setAttribute('aria-pressed', 'false');
        const said = (this.final || this.heard || '').trim();
        if (said && !this.dropNext) { this.heardEl.textContent = '\u201e' + said + '\u201c'; this.send(said); }
        else if (!this.micOff) this.setState(this.micErr === 'no-speech' || !said ? 'Nichts gehört. Nochmal: V oder Mikrofon.' : '', 'idle');
        this.dropNext = false;
      };
      if (window.speechSynthesis) speechSynthesis.cancel();
      r.start(); this.listening = true; this.listenAt = performance.now();
      this.mic.setAttribute('aria-pressed', 'true'); this.setState('Ich höre … sprich jetzt', 'listen'); this.heardEl.textContent = '';
    } catch (e) { this.noMic('Spracherkennung startet hier nicht. Schreib stattdessen.'); this.typeRow.hidden = false; this.setState(this.micWhy); }
  },
  stopListen(drop) { if (this.rec && this.listening) { this.dropNext = !!drop; try { this.rec.stop(); } catch (e) { /* ignore */ } } },
  sendTyped() { const t = this.inp.value.trim(); if (!t) return; this.inp.value = ''; this.heardEl.textContent = '\u201e' + t + '\u201c'; this.send(t); },
  /* ---- one exchange ---- */
  async send(text) {
    const n = this.npc;
    if (!n || this.busy) return;
    text = text.slice(0, 240);
    this.busy = true; const seq = ++this.seq;
    n.talkLog = n.talkLog || [];
    n.talkLog.push({ who: 'p', text });
    worldEvent('talk', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', to: n.id, text });
    n.thinking = true; SAY.show(n, '\u2026', 60);
    this.setState(n.name + ' überlegt …', 'think');
    let out = null;
    if (this.aiOn()) out = await this.ask(n, text);
    if (seq !== this.seq) { n.thinking = false; return; }   // ended or walked off meanwhile
    if (!out) out = n.persona.offline(text);
    n.thinking = false; this.busy = false;
    const say = String(out.say || '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'Hm.';
    n.talkLog.push({ who: 'n', text: say });
    if (n.talkLog.length > 24) n.talkLog.splice(0, n.talkLog.length - 24);
    SAY.show(n, say);
    this.speak(n, say);
    this.setState(this.lastErr ? this.lastErr : this.aiOn() ? 'V oder Mikrofon: weiterreden' : 'ohne KI \u00b7 V: weiterreden', this.lastErr ? 'err' : 'idle');
    this.lastErr = '';
    n.persona.act(String(out.action || 'none'));
  },
  async ask(n, text) {
    const P = n.persona, hist = (n.talkLog || []).slice(-13, -1).map((l) => (l.who === 'p' ? 'Fremder: ' : n.name + ': ') + l.text).join('\n');
    const prompt = P.rules + '\n\nWas gerade los ist:\n' + P.context() + (hist ? '\n\nBisheriges Gespräch:\n' + hist : '') +
      '\n\nDer Fremde sagt jetzt: "' + text.replace(/"/g, '\u201d') + '"\n\nAntworte nur mit JSON in genau dieser Form: {"say": "deine Antwort", "action": "none"}';
    const ctl = this.ctl = new AbortController();
    // no answer in time: give up (the first call may wait on the viewer's permission, so it gets longer)
    const timer = setTimeout(() => { this.lastErr = 'Keine Antwort (Zeit abgelaufen).'; ctl.abort(); }, this.aiOk ? 25000 : 120000);
    try {
      const r = await this.ai.json(prompt, { modelTier: 'quick', cache: false, signal: ctl.signal });
      if (r && typeof r === 'object' && !Array.isArray(r) && typeof r.say === 'string' && r.say.trim()) { this.aiOk = true; return r; }
      this.lastErr = 'Unverständliche Antwort der KI.';
      return null;
    } catch (e) {
      const code = (e && e.code) || 'upstream_error';
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        this.aiOff = true; this.lastErr = 'KI nicht erlaubt (' + code + '). ' + n.name + ' antwortet einfacher.';
      } else if (code === 'rate_limited') this.lastErr = 'Zu viele Fragen gerade (rate_limited).';
      else if (code !== 'cancelled' || !this.lastErr) this.lastErr = 'KI-Fehler: ' + code;
      return null;
    } finally { clearTimeout(timer); if (this.ctl === ctl) this.ctl = null; }
  },
  /* ---- the voice ---- */
  /* every person has a voice profile: npc.voiceProfile = { male, pitch, rate, prefer: [name parts] }. From the
     German voices this device has, the best fitting one is taken: the preferred names first, then the right sex,
     the natural (neural) ones before the robotic ones. Pitch and pace make the rest of the difference. */
  MALE: /conrad|killian|florian|ralf|markus|stefan|hans|yannick|jonas|bernd|klaus|male|mann|männlich/i,
  FEMALE: /katja|hedda|amala|louisa|seraphina|marlene|vicki|anna|petra|helena|sandy|shelley|google deutsch|female|frau|weiblich/i,
  pickVoice(prof) {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [], de = vs.filter((v) => /^de/i.test(v.lang));
    if (!de.length) return null;
    const P = prof || { male: true };
    const score = (v) => {
      let s = 0;
      if (P.prefer && P.prefer.some((n) => v.name.toLowerCase().includes(n))) s += 10;
      const m = this.MALE.test(v.name), f = this.FEMALE.test(v.name);
      if (P.male ? m && !f : f && !m) s += 5; else if (P.male ? f : m) s -= 5;
      if (/natural|online|neural|premium|enhanced/i.test(v.name)) s += 3;
      if (/de-DE/i.test(v.lang)) s += 1;
      return s;
    };
    return de.slice().sort((a, b) => score(b) - score(a))[0];
  },
  voiceFor(n) {
    if (!n._voice || n._voiceN !== speechSynthesis.getVoices().length) { n._voice = this.pickVoice(n.voiceProfile); n._voiceN = speechSynthesis.getVoices().length; }
    return n._voice;
  },
  speak(n, text) {
    if (!SETTINGS.v.voice || !window.speechSynthesis || !SFX.on) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const P = n.voiceProfile || {}, v = this.voiceFor(n), wrongSex = v && (P.male !== false ? this.FEMALE.test(v.name) && !this.MALE.test(v.name) : this.MALE.test(v.name));
      u.lang = 'de-DE'; if (v) u.voice = v;
      // only a female voice for a man on this device: lower it further (and the other way round)
      u.pitch = clamp((P.pitch || 1) * (wrongSex ? (P.male !== false ? 0.75 : 1.3) : 1), 0.1, 2);
      u.rate = (P.rate || 1) * (DRUNK.level > 0.6 && n.id === 'player' ? 0.85 : 1); u.volume = clamp((SETTINGS.v.volume || 30) / 60, 0.2, 1);
      u.onstart = () => { n.talkT = 30; };
      u.onend = () => { n.talkT = 0; };
      speechSynthesis.speak(u);
    } catch (e) { /* no voice */ }
  }
};
SAVE.part('talk', () => {
  const o = {};
  for (const n of NPCS.list) if (n.talkLog && n.talkLog.length) o[n.id] = n.talkLog.slice(-10);
  return o;
}, (d) => {
  for (const n of NPCS.list) if (d && Array.isArray(d[n.id])) n.talkLog = d[n.id].filter((l) => l && typeof l.text === 'string').map((l) => ({ who: l.who === 'p' ? 'p' : 'n', text: String(l.text).slice(0, 300) }));
});
