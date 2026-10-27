/* ---------- people talking to each other ----------
   Two people who can talk (npc.persona), close together in the same room, both at ease and not busy with you, now
   and then have a short exchange: three or four lines, written in one go by the AI from who they are and what is
   going on (one call for the whole exchange), or ready-made small talk without it. Only where you can hear it, and
   rarely (each pair every few minutes at most), so it costs little: ElevenLabs is paid per spoken line. */
const CHAT = {
  t: 3, run: null, cool: new Map(),
  // small talk without the AI (A, B, A …): kept, so its sound is paid for once
  OFFLINE: [
    [['{b}. Alles ruhig heute?', 'neutral'], ['Zu ruhig, wenn du mich fragst.', 'neutral'], ['Wird schon wieder.', 'neutral']],
    [['Hast du gehört? Die Postkutsche kommt wieder zu spät.', 'neutral'], ['Wie jede Woche.', 'amused']],
    [['Heiß heute.', 'sleepy'], ['Wie jeden Tag, {a}.', 'amused'], ['Hm.', 'neutral']],
    [['Der Fremde da drüben… kennst du den?', 'whisper'], ['Nein. Aber ich behalt ihn im Auge.', 'whisper']]
  ],
  idle(n) { return n.persona && !n.hp.busy() && n.plight() === 0 && !n.talking && !n.thinking && !(n.fight && n.fight.on) && n.talkT <= 0 && !(TALK.npc === n && TALK.open); },
  update(dt) {
    if (this.run) { this.step(dt); return; }
    this.t -= dt; if (this.t > 0) return;
    this.t = 6;
    const L = NPCS.list;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if ((a.room || null) !== (b.room || null) || Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 3.5) continue;
      if (!this.idle(a) || !this.idle(b) || !(a.canBeHeard() || b.canBeHeard())) continue;
      const key = a.id + '|' + b.id;
      if (G.time - (this.cool.get(key) || -1e9) < 240 || Math.random() > 0.35) continue;
      this.cool.set(key, G.time); this.start(Math.random() < 0.5 ? a : b, Math.random() < 0.5 ? b : a === b ? b : a);
      return;
    }
  },
  start(a, b) {
    if (a === b) b = NPCS.list.find((n) => n !== a && (n.room || null) === (a.room || null)) || b;
    const R = this.run = { a, b, lines: null, i: 0, wait: 0.3, asked: false };
    const fill = (s) => s.replace('{a}', a.name).replace('{b}', b.name);
    const offline = () => { const S = this.OFFLINE[Math.floor(Math.random() * this.OFFLINE.length)]; R.lines = S.map((l, k) => ({ who: k % 2 ? b : a, text: fill(l[0]), mood: l[1], keep: true })); };
    if (!TALK.aiOn() || !(TALK.aiOk || TALK.aiEver)) { offline(); return; }
    R.asked = true;
    const ctx = (n) => { try { return n.persona.context().split('\n').slice(0, 4).join(' '); } catch (e) { return ''; } };
    const prompt = 'Schreibe ein kurzes, natürliches Gespräch zwischen zwei Leuten in Dust Creek, einem Städtchen im Wilden Westen (1885).\n' +
      a.name + ': ' + (a.role || a.name) + '. Was gerade los ist: ' + ctx(a) + '\n' + b.name + ': ' + (b.role || b.name) + '. Was gerade los ist: ' + ctx(b) + '\n' +
      'Sie stehen beieinander und reden kurz miteinander, nicht mit dem Fremden (der kann zuhören). Drei oder vier Zeilen, abwechselnd, ' + a.name + ' fängt an. ' +
      'Jede Zeile höchstens 12 Wörter, einfaches Deutsch, kein Markdown. Format je Zeile genau: Name: [stimmung] Text. Stimmungen: neutral, amused, angry, surprised, disgusted, sleepy, whisper.';
    TALK.callAI('Du schreibst kurze Dialoge für ein Western-Spiel.', prompt, { modelTier: 'quick', cache: false, maxTokens: 160 }).then((r) => {
      if (this.run !== R) return;
      const out = [];
      for (const line of String(r && r.text || '').split('\n')) {
        const m = line.match(/^\s*([^:]{2,20}):\s*(?:\[(\w+)\])?\s*(.+)$/); if (!m) continue;
        const who = m[1].trim().toLowerCase() === b.name.toLowerCase() ? b : m[1].trim().toLowerCase() === a.name.toLowerCase() ? a : null; if (!who) continue;
        out.push({ who, text: m[3].trim().slice(0, 140), mood: m[2] && VOICE.MOODS[m[2]] ? m[2] : 'neutral', keep: false });
      }
      if (out.length >= 2) R.lines = out.slice(0, 4); else offline();
    }).catch(() => { if (this.run === R) offline(); });
    setTimeout(() => { if (this.run === R && !R.lines) offline(); }, 8000);
  },
  step(dt) {
    const R = this.run, { a, b } = R;
    // it ends when one of them has something else to do
    if (!a.persona || !b.persona || a.hp.busy() || b.hp.busy() || a.plight() || b.plight() || (TALK.open && (TALK.npc === a || TALK.npc === b))) { this.run = null; return; }
    for (const [x, y] of [[a, b], [b, a]]) { x.lookAt(y.ch.p.head.getWorldPosition(x._ht), 1); x.faceYaw = Math.atan2(y.pos.x - x.pos.x, y.pos.z - x.pos.z); }
    if (!R.lines) return;
    if (R.i >= R.lines.length) { R.wait -= dt; if (R.wait <= -1.5) { a.faceYaw = b.faceYaw = null; this.run = null; } return; }
    const speaking = VOICE.speaking(a) || VOICE.speaking(b) || a.talkT > 0 || b.talkT > 0;
    if (speaking) { R.wait = 0.45; return; }
    R.wait -= dt; if (R.wait > 0) return;
    const L = R.lines[R.i++];
    L.who.speak(L.text, undefined, L.mood, L.keep);
    if (Math.random() < 0.35) L.who.gesture(['beat', 'nod', 'shrug', 'laugh'][Math.floor(Math.random() * 4)]);
    R.wait = 0.5;
  }
};
