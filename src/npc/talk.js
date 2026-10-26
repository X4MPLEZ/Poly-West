/* ---------- talking to people ----------
   Hold V (touch: the "Reden" button) near someone and speak: the browser's speech recognition (German) turns it
   into text — or type it into the talk panel. The line goes to Claude through the artifact's `sample` capability
   (on the viewer's own Claude account; the first time the viewer is asked to allow it), together with who the
   person is, what they know and what is going on right now. The answer comes back as JSON {say, action}.
   The person SAYS it (bubble, panel, a browser voice), but what HAPPENS is the game's decision: an action is one
   word from a short list, and the person's own code checks it (serving costs money, …).
   Without Claude (outside claude.ai, or not allowed, or offline) a small phrase book answers instead.
   A person who can talk has npc.persona = { rules, context(), offline(text), act(action) }. */
const TALK = {
  open: false, npc: null, ai: null, aiOff: false, busy: false, rec: null, listening: false, heard: '', micOff: false,
  ctl: null, voice: null, holdV: false,
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('talk'); this.log = $('talkLog'); this.inp = $('talkIn'); this.state = $('talkState'); this.mic = $('talkMic');
    this.hint = $('prompt3'); this.btn = $('bTalk');
    $('talkClose').addEventListener('click', () => this.close());
    $('talkSend').addEventListener('click', () => this.sendTyped());
    this.inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.sendTyped(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    this.mic.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.listening) this.stopListen(); else this.listen(); });
    // touch: hold "Reden" to speak, a short tap opens the panel to type
    this.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.btnT = performance.now(); this.start(true); });
    const up = () => { if (this.btnT && performance.now() - this.btnT > 450) this.stopListen(); this.btnT = 0; };
    this.btn.addEventListener('pointerup', up); this.btn.addEventListener('pointercancel', up);
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!this.SR) this.mic.hidden = true;
    // Claude, if this page may ask it
    try {
      if (window.claude && window.claude.use) window.claude.use('sample').then((s) => { this.ai = s || null; }).catch(() => { this.ai = null; });
    } catch (e) { this.ai = null; }
    try { if (window.speechSynthesis) { const pick = () => { this.voice = this.pickVoice(); }; pick(); speechSynthesis.onvoiceschanged = pick; } } catch (e) { /* no voices */ }
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
    if (this.open) {
      const n = this.npc; n.talking = true;
      // the camera comes round over his shoulder to the one he talks to; he turns to face them
      const dx = n.pos.x - PLAY.pos.x, dz = n.pos.z - PLAY.pos.z, face = Math.atan2(dx, dz);
      PLAY.camYaw += wrapA(Math.atan2(-dx, -dz) + 0.32 - PLAY.camYaw) * (1 - Math.exp(-dt * 2.2));
      PLAY.camPitch += (0.16 - PLAY.camPitch) * (1 - Math.exp(-dt * 2));
      if (!SIT.busy() && !FALL.busy()) PLAY.yaw += wrapA(face - PLAY.yaw) * (1 - Math.exp(-dt * 4));
    }
  },
  /* ---- the panel ---- */
  start(listen) {
    const n = this.open ? this.npc : this.target();
    if (!n) return;
    if (!this.open) {
      this.open = true; this.npc = n; INPUT.keys.clear(); FIST.up(); GUN.setAim(false);
      document.getElementById('talkName').textContent = n.name;
      this.el.hidden = false; this.renderLog(); document.getElementById('app').classList.add('talking');
      this.setState(this.aiOn() ? '' : 'ohne KI');
    }
    if (listen && this.SR && !this.micOff) this.listen();
    else setTimeout(() => this.inp.focus({ preventScroll: true }), 30);
  },
  close() {
    if (!this.open) return;
    this.stopListen(true);
    if (this.ctl) { this.ctl.abort(); this.ctl = null; }
    this.open = false; this.el.hidden = true; document.getElementById('app').classList.remove('talking');
    if (this.npc) this.npc.talking = false;
    this.npc = null; this.busy = false;
    try { this.inp.blur(); document.getElementById('gl').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  },
  // keys while the panel is open (the text field handles its own)
  key(e, k) {
    if (k === 'Escape') { this.close(); return true; }
    if (k === 'v' && !e.repeat) { this.listen(); this.holdV = true; return true; }
    if (k === 'Enter') { this.inp.focus(); return true; }
    if (k.length === 1) { this.inp.focus(); return false; }   // start typing: the letter goes into the field
    return true;   // nothing else reaches the game while talking
  },
  keyUp(k) { if (k === 'v' && this.holdV) { this.holdV = false; this.stopListen(); } },
  setState(s) { this.state.textContent = s; },
  aiOn() { return !!this.ai && !this.aiOff && SETTINGS.v.aiTalk; },
  renderLog() {
    const n = this.npc; this.log.textContent = '';
    for (const l of (n.talkLog || []).slice(-6)) {
      const p = document.createElement('p'); p.className = l.who === 'p' ? 'me' : 'them';
      const b = document.createElement('b'); b.textContent = l.who === 'p' ? 'Du' : n.name; p.appendChild(b);
      p.appendChild(document.createTextNode(l.text)); this.log.appendChild(p);
    }
    if (this.heard) { const p = document.createElement('p'); p.className = 'me live'; p.textContent = this.heard + ' …'; this.log.appendChild(p); }
    this.log.scrollTop = 1e6;
  },
  /* ---- the microphone ---- */
  listen() {
    if (!this.open) { this.start(true); return; }
    if (!this.SR || this.micOff || this.listening || this.busy) { if (!this.SR || this.micOff) this.inp.focus(); return; }
    try {
      const r = this.rec = new this.SR();
      r.lang = 'de-DE'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      this.heard = ''; this.final = '';
      r.onresult = (e) => {
        let fin = '', mid = '';
        for (let i = 0; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else mid += x[0].transcript; }
        this.final = fin; this.heard = (fin + ' ' + mid).trim(); this.renderLog();
      };
      r.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) {
          this.micOff = true; this.mic.hidden = true;
          TOAST.show('Kein Mikrofon hier erlaubt. Schreib stattdessen.', 'long'); this.inp.focus();
        }
      };
      r.onend = () => {
        this.listening = false; this.mic.setAttribute('aria-pressed', 'false'); this.setState('');
        const said = (this.final || this.heard || '').trim(); this.heard = '';
        if (said && !this.dropNext) this.send(said); else this.renderLog();
        this.dropNext = false;
      };
      r.start(); this.listening = true; this.mic.setAttribute('aria-pressed', 'true'); this.setState('hört zu …');
      if (window.speechSynthesis) speechSynthesis.cancel();
    } catch (e) { this.micOff = true; this.mic.hidden = true; this.inp.focus(); }
  },
  stopListen(drop) { if (this.rec && this.listening) { this.dropNext = !!drop; try { this.rec.stop(); } catch (e) { /* ignore */ } } },
  sendTyped() { const t = this.inp.value.trim(); if (!t) return; this.inp.value = ''; this.send(t); },
  /* ---- one exchange ---- */
  async send(text) {
    const n = this.npc;
    if (!n || this.busy) return;
    text = text.slice(0, 240);
    this.busy = true;
    n.talkLog = n.talkLog || [];
    n.talkLog.push({ who: 'p', text }); this.renderLog();
    worldEvent('talk', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'player', to: n.id, text });
    n.thinking = true; SAY.show(n, '…', 30);
    let out = null;
    if (this.aiOn()) {
      this.setState('überlegt …');
      out = await this.ask(n, text);
    }
    if (!out) out = n.persona.offline(text);
    if (this.npc !== n) { n.thinking = false; this.busy = false; return; }   // walked off meanwhile
    n.thinking = false; this.busy = false; this.setState(this.aiOn() ? '' : 'ohne KI');
    const say = String(out.say || '').replace(/\s+/g, ' ').trim().slice(0, 300) || '…';
    n.talkLog.push({ who: 'n', text: say });
    if (n.talkLog.length > 24) n.talkLog.splice(0, n.talkLog.length - 24);
    this.renderLog();
    SAY.show(n, say);
    this.speak(n, say);
    n.persona.act(String(out.action || 'none'));
  },
  async ask(n, text) {
    const P = n.persona, hist = (n.talkLog || []).slice(-13, -1).map((l) => (l.who === 'p' ? 'Fremder: ' : n.name + ': ') + l.text).join('\n');
    const prompt = P.rules + '\n\nWas gerade los ist:\n' + P.context() + (hist ? '\n\nBisheriges Gespräch:\n' + hist : '') +
      '\n\nDer Fremde sagt jetzt: "' + text.replace(/"/g, '”') + '"\n\nAntworte nur mit JSON in genau dieser Form: {"say": "deine Antwort", "action": "none"}';
    this.ctl = new AbortController();
    try {
      const r = await this.ai.json(prompt, { modelTier: 'quick', cache: false, signal: this.ctl.signal });
      this.ctl = null;
      if (r && typeof r === 'object' && typeof r.say === 'string') return r;
      return null;
    } catch (e) {
      this.ctl = null;
      const code = e && e.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        this.aiOff = true; TOAST.show('KI-Gespräche sind hier nicht erlaubt. ' + n.name + ' antwortet einfacher.', 'long');
      } else if (code === 'rate_limited') TOAST.show('Zu viele Fragen auf einmal. Gleich wieder.', 'long');
      return null;
    }
  },
  /* ---- the voice ---- */
  pickVoice() {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const de = vs.filter((v) => /^de/i.test(v.lang));
    return de.find((v) => /male|mann|conrad|markus|stefan|hans|yannick|killian/i.test(v.name) && !/female|frau/i.test(v.name)) || de[0] || null;
  },
  speak(n, text) {
    if (!SETTINGS.v.voice || !window.speechSynthesis || !SFX.on) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; if (this.voice) u.voice = this.voice;
      u.pitch = n.voicePitch || 0.8; u.rate = n.voiceRate || 1.0; u.volume = clamp((SETTINGS.v.volume || 30) / 60, 0.2, 1);
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
