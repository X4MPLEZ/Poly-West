/* ---------- people talking to each other ----------
   Two people who can talk (npc.persona), close together in the same room, both at ease and not busy with you, now
   and then have a short exchange: three or four lines, written in one go by the AI from who they are and what is
   going on (one call for the whole exchange), or ready-made small talk without it. Only where you can hear it, and
   rarely (each pair every few minutes at most), so it costs little: ElevenLabs is paid per spoken line.
   What they know about you goes with it (GOSSIP): when they talk, one tells the other; when you are not there to
   hear it, it is only passed on (nothing said, nothing paid). Things that happen bring their own talk (topic):
   the doctor asks his patient how it happened. */
const GOSSIP = {
  shared: new Set(),
  // a tells b what a knows about the stranger and b has not heard yet (newest first, at most n); returns it
  share(a, b, n) {
    if (!a.gossip || !b.gossip) return [];
    const out = [];
    for (const f of a.gossip.facts().slice(-6).reverse()) {
      const key = a.id + '>' + b.id + ':' + f; if (this.shared.has(key)) continue;
      this.shared.add(key); b.gossip.hear(a, f); out.push(f);
      if (out.length >= (n || 2)) break;
    }
    return out;
  },
  // what someone heard from another, for his memory (the other's own words, so nothing is twisted on the way)
  // (turned round to the one who tells it: "Er hat dir … geschossen" → "Hank sagt, der Fremde hat ihm … geschossen")
  told(from, f) {
    const t = f.replace(/ \(Tag \d+, \w+\)\.?$/, '').replace(/\.$/, '').replace(/^Er /, 'der Fremde ').replace(/^Der Fremde /, 'der Fremde ')
      .replace(/\bdir\b/g, 'ihm').replace(/\bdich\b/g, 'ihn').replace(/\bdu\b/g, 'er').replace(/\bdein(e|en|em|er|es)?\b/g, (m, e) => 'sein' + (e || ''));
    return from.name + ' hat dir erzählt, ' + t + ' (' + TIME.stamp() + ').';
  }
};
const CHAT = {
  t: 3, run: null, cool: new Map(),
  // small talk without the AI (A, B, A …): kept, so its sound is paid for once
  OFFLINE: [
    [['{b}. Alles ruhig heute?', 'neutral'], ['Zu ruhig, wenn du mich fragst.', 'neutral'], ['Wird schon wieder.', 'neutral']],
    [['Hast du gehört? Die Postkutsche kommt wieder zu spät.', 'neutral'], ['Wie jede Woche.', 'amused']],
    [['Heiß heute.', 'sleepy'], ['Wie jeden Tag, {a}.', 'amused'], ['Hm.', 'neutral']],
    [['Der Fremde da drüben… kennst du den?', 'whisper'], ['Nein. Aber ich behalt ihn im Auge.', 'whisper']]
  ],
  // when one of them has something to tell about you (what exactly, they only pass on: see GOSSIP)
  NEWS: [
    [['Hast du schon gehört, was der Fremde gemacht hat?', 'whisper'], ['Erzähl.', 'neutral'], ['Nicht hier. Später.', 'whisper'], ['Hm. Ich pass auf.', 'neutral']],
    [['Der Fremde… mit dem stimmt was nicht.', 'whisper'], ['Wieso? Was hat er getan?', 'surprised'], ['Frag ihn selbst. Ich sag nur: Vorsicht.', 'whisper']]
  ],
  // a conversation about something that just happened (the doctor and his patient …): prompt (for the AI) and
  // offline lines [[0|1, text, mood, keep], …] (0: a, 1: b); only where it can be heard
  topic(a, b, prompt, offline) {
    if (this.run || !(a.canBeHeard() || b.canBeHeard())) return false;
    this.start(a, b, { prompt, offline });
    return true;
  },
  idle(n) { return n.persona && !n.hp.busy() && n.plight() === 0 && !n.talking && !n.thinking && !(n.fight && n.fight.on) && n.talkT <= 0 && !(TALK.npc === n && TALK.open); },
  update(dt) {
    if (this.run) { this.step(dt); return; }
    this.t -= dt; if (this.t > 0) return;
    this.t = 6;
    const L = NPCS.list;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if ((a.room || null) !== (b.room || null) || Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 3.5) continue;
      if (!this.idle(a) || !this.idle(b)) continue;
      const key = a.id + '|' + b.id;
      // out of earshot: they still talk, only nobody hears it (what they know is passed on, that is all)
      if (!(a.canBeHeard() || b.canBeHeard())) { if (G.time - (this.cool.get(key) || -1e9) > 240) { this.cool.set(key, G.time); GOSSIP.share(a, b); GOSSIP.share(b, a); } continue; }
      if (G.time - (this.cool.get(key) || -1e9) < 240 || Math.random() > 0.35) continue;
      this.cool.set(key, G.time); this.start(Math.random() < 0.5 ? a : b, Math.random() < 0.5 ? b : a === b ? b : a);
      return;
    }
  },
  start(a, b, T) {
    if (a === b) b = NPCS.list.find((n) => n !== a && (n.room || null) === (a.room || null)) || b;
    const R = this.run = { a, b, lines: null, i: 0, wait: 0.3, asked: false, topic: !!T };
    const fill = (s) => s.replace('{a}', a.name).replace('{b}', b.name);
    // what one of them knows about the stranger and tells the other (they talk about you)
    const news = T ? [] : GOSSIP.share(a, b, 1);
    const offline = () => {
      if (T && T.offline) { R.lines = T.offline.map((l) => ({ who: l[0] ? b : a, text: fill(l[1]), mood: l[2], keep: l[3] !== false })); return; }
      const S = news.length ? this.NEWS[Math.floor(Math.random() * this.NEWS.length)] : this.OFFLINE[Math.floor(Math.random() * this.OFFLINE.length)];
      R.lines = S.map((l, k) => ({ who: k % 2 ? b : a, text: fill(l[0]), mood: l[1], keep: true }));
    };
    if (!TALK.aiOn() || !(TALK.aiOk || TALK.aiEver)) { offline(); return; }
    R.asked = true;
    const ctx = (n) => { try { return n.persona.context().split('\n').slice(0, 4).join(' '); } catch (e) { return ''; } };
    const prompt = 'Schreibe ein kurzes, natürliches Gespräch zwischen zwei Leuten in Dust Creek, einem Städtchen im Wilden Westen (1885).\n' +
      a.name + ': ' + (a.role || a.name) + '. Was gerade los ist: ' + ctx(a) + '\n' + b.name + ': ' + (b.role || b.name) + '. Was gerade los ist: ' + ctx(b) + '\n' +
      (T ? T.prompt + ' ' : news.length ? a.name + ' erzählt ' + b.name + ' etwas über den Fremden, das er erlebt hat: „' + news[0] + '“ ' + b.name + ' ist neugierig und fragt nach. ' : '') +
      'Sie reden kurz miteinander, nicht mit dem Fremden (der kann zuhören). Drei oder vier Zeilen, abwechselnd, ' + a.name + ' fängt an. ' +
      'Jede Zeile höchstens 12 Wörter, einfaches Deutsch, kein Markdown. Format je Zeile genau: Name: [stimmung] Text. Stimmungen: neutral, amused, angry, surprised, disgusted, sleepy, whisper.';
    TALK.callAI('Du schreibst kurze Dialoge für ein Western-Spiel.', prompt, { modelTier: 'default', cache: false, maxTokens: 160 }).then((r) => {
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
    // it ends when one of them has something else to do (a talk about what happened: only when one cannot speak)
    if (R.topic ? (a.hp.dead || b.hp.dead || a.hp.out || b.hp.out) : (!a.persona || !b.persona || a.hp.busy() || b.hp.busy() || a.plight() || b.plight() || (TALK.open && (TALK.npc === a || TALK.npc === b)))) { this.run = null; return; }
    for (const [x, y] of [[a, b], [b, a]]) { x.lookAt(y.ch.p.head.getWorldPosition(x._ht), 1); if (!R.topic) x.faceYaw = Math.atan2(y.pos.x - x.pos.x, y.pos.z - x.pos.z); }
    if (!R.lines) return;
    if (R.i >= R.lines.length) { R.wait -= dt; if (R.wait <= -1.5) { if (!R.topic) a.faceYaw = b.faceYaw = null; this.run = null; } return; }
    const speaking = VOICE.speaking(a) || VOICE.speaking(b) || a.talkT > 0 || b.talkT > 0;
    if (speaking) { R.wait = 0.45; return; }
    R.wait -= dt; if (R.wait > 0) return;
    const L = R.lines[R.i++];
    L.who.speak(L.text, undefined, L.mood, L.keep);
    if (Math.random() < 0.35 && !L.who.hp.busy()) L.who.gesture(['beat', 'nod', 'shrug', 'laugh'][Math.floor(Math.random() * 4)]);
    R.wait = 0.5;
  }
};
