/* ---------- the saloon's crew: Hank, Walt and Jeb, in shifts; who saw what ----------
   All three live. Whose shift it is stands behind the bar (BARKEEP runs him); the others are upstairs in their
   rooms, awake or asleep. Three of them: Hank 10–18, Walt 18–2, Jeb 2–10; two: twelve hours each; one alone works
   10–2 and the saloon is empty at night. The change over waits until the one there is free; when you are in the
   saloon you see it (one comes down the stairs, the other goes up, a word between them), otherwise it just happens.
   Each keeps his own memory of you (BARKEEP's per-person fields are swapped in and out: KEYS).
   A shot in the saloon (or right outside), a fight, glass: whoever upstairs hears it comes down (awake: a few
   seconds; asleep: only shots or a long racket wake him, later). Down there he sees what is going on: the one at
   the bar hurt → presses the wound or runs for the doctor; a fight → Walt (and Hank) join in, Jeb shouts; a body →
   on his knees by it, then he stays with it. He goes back up once it is over.
   Witnesses: only who saw it (in the room) or came down while you were still there knows you did it; everybody
   else knows someone is dead, not who did it (until gossip tells them). A death: the next one alive takes over once
   the body is taken away; when all three are dead the saloon is closed, and three days later a new owner from
   out of town (cautious, armed) opens it again. */
// what one sees of a man at a glance (for what the one coming down says)
function C2(N, name) { return N.hp.dead ? name + ' liegt tot am Boden.' : N.hp.busy() ? name + ' liegt am Boden' + (N.hp.wounds.some((w) => w.kind === 'shot' && !w.bandaged) ? ' und blutet.' : '.') : N.hp.needsDoc() ? name + ' ist angeschossen.' : name + ' steht hinter der Theke.'; }
const CREW = {
  m: [], helpers: [], told: new Set(), closedAt: null, lastDead: null, hold: false, _v: new THREE.Vector3(), _w: new THREE.Vector3(),
  KEYS: ['mem', 'att', 'grudge', 'temper', 'served', 'damage', 'recent', 'poisonNext', 'cool', 'bags', 'lastLine', 'shotAt', 'metNew', 'seenAt'],
  OWNER: 3,
  // what one was to another (for "{n} war mein {k}")
  KIN: { hank: { walt: 'Bruder', jeb: 'alter Freund' }, walt: { hank: 'Bruder', jeb: 'Freund' }, jeb: { hank: 'alter Freund', walt: 'Freund' } },
  LINES: {
    down: [['Was ist hier los?', 'surprised'], ['Was war das?', 'surprised'], ['Ich hab Schüsse gehört!', 'surprised']],
    help: [['Halt still, ich drück drauf.', 'neutral'], ['Ganz ruhig. Ich bin da.', 'neutral'], ['Nicht bewegen. Das wird wieder.', 'neutral']],
    fetch: [['Ich hol den Doc!', 'surprised'], ['Halt durch, ich lauf zum Doc!', 'surprised']],
    docCall: [['Doc! Schnell, in den Saloon! Einer ist angeschossen!', 'surprised'], ['Doc, komm mit! Im Saloon verblutet einer!', 'surprised']],
    join: [['Lass ihn in Ruhe!', 'angry'], ['Jetzt bin ich dran!', 'angry'], ['Du legst dich mit uns beiden an?', 'angry']],
    stop: [['Hört auf! Hört sofort auf!', 'angry'], ['Schluss jetzt!', 'angry']],
    grief: [['Nein… nein, nein.', 'sad'], ['Gott im Himmel…', 'sad'], ['Wer hat das getan?', 'sad']],
    griefSeen: [['Nein… nein, nein.', 'sad'], ['Gott im Himmel…', 'sad']],
    caught: [['Du warst das.', 'angry'], ['Du Schwein. Du hast ihn umgebracht.', 'angry']],
    chase: [['Bleib stehen, du Hund!', 'angry'], ['Du kommst nicht weg!', 'angry'], ['Halt! Mörder!', 'angry']],
    out: [['Verschwinde. Sofort.', 'angry'], ['Raus hier. Lass uns allein.', 'sad']],
    quiet: [['Na gut. Ich geh wieder hoch.', 'neutral'], ['Ruft, wenn was ist.', 'neutral']],
    hands: [['Nicht schießen!', 'surprised'], ['Ganz ruhig, Mister…', 'neutral']],
    sheriff: [['Sheriff! Im Saloon liegt einer tot!', 'surprised'], ['Sheriff, schnell, in den Saloon! Da ist einer umgebracht worden!', 'surprised']],
    gunWarn: [['Waffe runter! Sofort!', 'angry'], ['Steck das Ding weg, oder ich schieße.', 'angry'], ['Keine Bewegung!', 'angry']],
    gunWarn2: [['Letzte Warnung!', 'angry'], ['Ich zähl nicht bis drei.', 'angry']],
    takeOver: [['Ich übernehme, {o}. Leg dich hin.', 'neutral'], ['Alles ruhig, {o}? Ich mach weiter.', 'neutral'], ['Geh schlafen, {o}. Ich hab’s.', 'neutral']],
    handOver: [['Ruhiger Tag. Bis morgen.', 'sleepy'], ['Pass auf den da auf.', 'whisper'], ['Die Theke gehört dir.', 'sleepy']]
  },
  bags: {},
  line(kind, o) {
    const L = this.LINES[kind], B = this.bags[kind] || (this.bags[kind] = []);
    if (!B.length) for (let i = 0; i < L.length; i++) B.splice(Math.floor(Math.random() * (B.length + 1)), 0, i);
    const x = L[B.pop()]; return { text: x[0].replace('{o}', o || ''), mood: x[1] };
  },
  // his own words about what he sees (the AI, if it has answered before and he has some left), else his line
  react(h, kind, situation, o) { const N = h.npc; if (!TALK.remark(N, situation, () => this.say(N, kind, o), this.line(kind, o).mood, 1)) this.say(N, kind, o); },
  /* the one who came down can be talked to: a short character (the system part, kept the same so it is cached),
     what he is doing and what he knows as the context, a few gestures and "go back up" as actions */
  persona(h) {
    const C = this, W = this.W(h.i), m = this.m[h.i];
    const DOING = { down: 'Du kommst gerade die Treppe herunter.', look: 'Du schaust nach, was im Saloon los ist.', fetch: 'Du rennst zum Doc, um ihn zu holen.', back: 'Du kommst vom Doc zurück.',
      brawl: 'Du prügelst dich gerade mit dem Fremden.', hurt: 'Du bist verletzt und willst zum Doc.', up: 'Du gehst wieder hinauf in dein Zimmer.' };
    return {
      actions: ['none', 'nod', 'shake_head', 'point_door', 'point_you', 'fist_shake', 'calm_down', 'cross_arms', 'shrug', 'go_up'],
      rules: ['Du bist ' + W.name + ' aus dem Saloon von Dust Creek (Arizona-Territorium, 1885): ' + W.age + '. ' + W.more + ' ' + (W.mind || '') + ' Du duzt jeden.',
        C.context(h.i) + ' Du hast gerade keinen Dienst und bist von oben heruntergekommen.',
        'Kerniges, einfaches Deutsch, höchstens zwei kurze Sätze unter 25 Wörtern, es wird laut vorgelesen. Kein Markdown, keine Sternchen. Von der modernen Welt weißt du nichts.',
        'Aktion go_up, wenn du wieder hinaufgehst; sonst eine passende Geste oder none.'].join('\n'),
      context() {
        const B = BARKEEP, BN = B.npc, out = ['Es ist ' + TIME.words() + ', ' + TIME.str() + ' Uhr.', DOING[h.ph] || ''];
        if (BN) out.push(C.W(B.whoI).name + ' (hinter der Theke): ' + (BN.hp.dead ? 'liegt tot am Boden' : BN.hp.describe() || 'unverletzt') + '.');
        else out.push('Hinter der Theke steht gerade niemand.');
        if (h.knelt && BN && BN.hp.dead) out.push('Du hast neben ihm gekniet, er ist tot.');
        if (GUN.state !== 'holster' && !GUN.reloadThenHolster) out.push(C.aimedAt(h.npc) ? 'Der Fremde zielt mit dem Revolver auf dich!' : 'Der Fremde hat den Revolver in der Hand.');
        const a = m.d.att; out.push('Deine Haltung zum Fremden: ' + (a < -0.6 ? 'du hasst ihn' : a < -0.2 ? 'misstrauisch' : a < 0.2 ? 'neutral' : 'freundlich') + '.');
        const body = h.npc.hp.describe(); if (body) out.push('Dein Körper: ' + body + '.');
        if (m.d.mem.length) out.push('Was du weißt: ' + m.d.mem.slice(-5).join(' '));
        return out.join('\n');
      },
      offline(text) { const t = text.toLowerCase(); return /doc|arzt|hilfe/.test(t) ? { say: 'Ich hol ihn ja schon.', action: 'nod' } : /raus|geh|verschwind/.test(t) ? { say: 'Ich geh, wann ich will.', action: 'cross_arms' } : { say: ['Hm.', 'Lass mich.', 'Nicht jetzt.'][Math.floor(Math.random() * 3)], action: 'none' }; },
      act(action) { if (action === 'go_up') { h.ph = 'up'; C.toStairs(h); return; } if (GESTURE.AI.includes(action)) h.npc.gesture(action, action === 'point_door' ? BARKEEP.doorPoint() : null); },
      forget() { m.d.mem = []; m.d.att = 0; },
      memory() { return { events: m.d.mem.slice(), inPrompt: 5, facts: [['Haltung zu dir', (m.d.att || 0).toFixed(2)]] }; },
      forgetEvent(i) { m.d.mem.splice(i, 1); }
    };
  },
  say(N, kind, o) { if (!N || N.hp.dead || N.hp.out) return false; const l = this.line(kind, o); SAY.hide(N); return N.speak(l.text, undefined, l.mood, true); },
  blank() { return { mem: [], att: 0, grudge: 0, temper: null, served: 0, damage: { holes: 0, glass: 0 }, recent: [], poisonNext: false, cool: {}, bags: {}, lastLine: {}, shotAt: null, metNew: true, seenAt: null, talkLog: [], asked: [], body: null, bodyAt: null }; },
  init() {
    this.m = BARKEEP.WHO.map((W, i) => ({ i, id: W.id, alive: true, away: i >= this.OWNER, d: i === BARKEEP.whoI ? null : this.blank(), noise: 0, comeT: 0, died: null }));
    onWorldEvent((e) => this.heard(e));
    WORLDSIM.before((m, soft) => this.beforeSkip(m, soft));
  },
  // back to the start (tests, "Erinnerungen zurücksetzen" does only the memories)
  reset() {
    const B = BARKEEP;
    for (const h of this.helpers) { if (h.gun) h.gun.dispose(); h.npc.dispose(); }
    this.helpers.length = 0; this.closedAt = null; this.shotsAt = this.noiseAt = undefined; this.sheriffCalled = null; this.lastDead = null; this.told.clear();
    if (B.npc) B.npc.dispose();
    this.m.forEach((m) => { m.alive = true; m.away = m.i >= this.OWNER; m.d = this.blank(); m.noise = 0; m.comeT = 0; m.died = null; });
    B.whoI = 0; this.m[0].d = null; B.makeNpc(B.scene0); B.st = 'idle'; B.pickIdle();
    B.temper = null; B.grudge = 0; B.poisonNext = false; B.killedBy = null; B.diedAt = null; B.cause = null; B.metNew = true; B.known = false; B.forget();
  },
  forget() { for (const m of this.m) if (m.d) { const b = m.d.body, at = m.d.bodyAt; m.d = this.blank(); m.d.body = b; m.d.bodyAt = at; } this.told.clear(); },
  W(i) { return BARKEEP.WHO[i]; },
  living() { return this.m.filter((m) => m.alive && !m.away); },
  // the shifts of those who are left: [index, from hour, to hour]
  shifts() {
    const L = this.living().map((m) => m.i);
    if (L.length >= 3) return [[L[0], 10, 18], [L[1], 18, 2], [L[2], 2, 10]];
    if (L.length === 2) return [[L[0], 10, 22], [L[1], 22, 10]];
    return L.length ? [[L[0], 10, 2]] : [];
  },
  span(h, a, b) { return a < b ? h >= a && h < b : h >= a || h < b; },
  dutyAt(h) { if (this.hold) { const L = this.living(); return L.length ? (L.some((m) => m.i === BARKEEP.whoI) && BARKEEP.st !== 'closed' ? BARKEEP.whoI : L[0].i) : -1; } for (const [i, a, b] of this.shifts()) if (this.span(h, a, b)) return i; return -1; },
  // asleep upstairs: eight hours, in the middle of the time off
  asleep(i, h) {
    const s = this.shifts().find((x) => x[0] === i); if (!s) return true;
    const len = ((s[2] - s[1]) + 24) % 24 || 24, st = (s[2] + (24 - len - 8) / 2 + 24) % 24;
    return this.span(h, st, (st + 8) % 24);
  },
  shiftWords() {
    const S = this.shifts(), w = (a) => a + ' Uhr';
    if (!S.length) return 'Der Saloon ist geschlossen.';
    return 'Ihr arbeitet in Schichten: ' + S.map(([i, a, b]) => this.W(i).name + ' von ' + w(a) + ' bis ' + w(b)).join(', ') + '. Wer frei hat, ist oben in seinem Zimmer und schläft oder ruht sich aus.';
  },
  // for the one behind the bar (his AI part): who else is there, who is dead
  context(i) {
    const out = [], dead = this.m.filter((m) => m.died && m.i !== i);
    if (i === this.OWNER) out.push('Du hast den Saloon gekauft, nachdem alle drei Barkeeper davor gestorben sind: ' + dead.map((m) => this.W(m.i).name).join(', ') + '. Du kennst sie nur aus Erzählungen.');
    else {
      const alive = this.living().filter((m) => m.i !== i).map((m) => this.W(m.i).name);
      out.push(this.shiftWords());
      if (alive.length) out.push(alive.join(' und ') + (alive.length > 1 ? ' leben' : ' lebt') + ' mit dir oben über dem Saloon.');
      for (const m of dead) out.push(this.W(m.i).name + ' ist tot (' + (m.died.cause || 'gestorben') + ', ' + TIME.stamp(m.died.at) + '). ' + (m.died.by !== 'player' ? '' : m.died.known ? 'Der Fremde war es.' : 'Wer es war, weiß niemand.'));
    }
    return out.join(' ');
  },
  kin(i, j) { const a = this.W(i), b = this.W(j); return (this.KIN[a.id] && this.KIN[a.id][b.id]) || 'Vorgänger'; },

  /* ---- the one behind the bar: his own memory in and out of BARKEEP ---- */
  stash(i) {
    const B = BARKEEP, d = this.blank();
    for (const k of this.KEYS) d[k] = B[k];
    if (B.npc) { d.talkLog = B.npc.talkLog || []; d.asked = B.npc.asked ? [...B.npc.asked] : []; d.body = B.npc.hp.save(); d.bodyAt = TIME.min; }
    this.m[i].d = d;
  },
  unstash(i) {
    const B = BARKEEP, d = this.m[i].d || this.blank();
    for (const k of this.KEYS) B[k] = d[k] !== undefined ? d[k] : this.blank()[k];
    if (!B.damage) B.damage = { holes: 0, glass: 0 };
    B.pending = null; B.standoff = null; B.sc = null; B.fightLog = null; B.orders.length = 0; B.cur = null; B.wasInside = G.room === B.R;
    this.m[i].d = null;
    return d;
  },
  // he takes his place behind the bar: a body with his memory and his wounds (healed a little since)
  onDuty(i, d, where) {
    const B = BARKEEP;
    B.whoI = i; const N = B.makeNpc(B.scene0);
    N.talkLog = d.talkLog || []; N.asked = new Set(d.asked || []);
    if (d.body) { N.hp.load(d.body); if (d.bodyAt !== null && N.hp.heal) N.hp.heal(Math.max(0, TIME.min - d.bodyAt)); }
    if (where) { N.pos.copy(where); N.room = roomAt(N.pos.x, N.pos.z, 0.05, N.pos.y + 0.1); N.yaw = B.yawFor(-1) + Math.PI / 2; N.faceYaw = null; }
    B.st = where ? 'return' : 'idle'; B.returnT = 0.3; B.pickIdle();
    return N;
  },
  // the newest things the one going off tells the one coming on (only what is about you)
  handTale(from, toD, toI) {
    const facts = (from.d ? from.d.mem : BARKEEP.mem).filter((m) => !/hat dir erzählt/.test(m) && /\bEr\b|Fremde/.test(m)).slice(-3);
    for (const f of facts) { const k = from.i + '>' + toI + ':' + f; if (this.told.has(k)) continue; this.told.add(k); toD.mem.push(GOSSIP.told(this.W(from.i), f)); if (toD.mem.length > 10) toD.mem.shift(); }
  },
  // where the stairs are (room frame of the saloon): the foot, and a point up in the opening
  stair(i, out) { const R = BARKEEP.R, h = (R.ceilY - R.floorY) / 14, x = i < 0 ? 0.25 : -0.6 - i * 0.33; const p = rwp(R, x, R.floorY + (i < 0 ? 0 : (i + 1) * h), R.z0 + 0.6); return out.set(p.x, groundAt(p.x, p.z, p.y + 0.4), p.z); },
  /* the way between their rooms upstairs and the saloon floor (room frame of the saloon): the room door on the
     upstairs corridor, along it to the landing, the stairs down to their foot. Each one has his own door. */
  DOORS: [4.0, 0.0, -4.0, 4.0],
  stairWay(i, down) {
    const R = BARKEEP.R, z0 = R.z0, dx = this.DOORS[i] || 0;
    const pts = [[dx, z0 + 2.45], [-5.6, z0 + 2.0], [-5.6, z0 + 0.6], [-4.9, z0 + 0.6], [-2.6, z0 + 0.6], [-0.6, z0 + 0.6], [0.4, z0 + 0.6]];
    const w = pts.map(([x, z]) => { const p = rwp(R, x, 0, z); return [p.x, p.z]; });
    return down ? w : w.reverse();
  },
  upstairs(i, out) { const R = BARKEEP.R, U = R.upper, p = rwp(R, this.DOORS[i] || 0, 0, R.z0 + 2.45), y = (U ? U.floorY : R.ceilY + 0.1); return out.set(p.x, y, p.z); },
  // walk a fixed way (the stairs are not in NAV): legs passed through, the last one the end
  follow(N, way) { const w = way.slice(), last = w.pop(); N.stop(); N.path = w; N.dest = [last[0], last[1], null]; N.nextLeg(); },
  change(cur, want) {
    const B = BARKEEP, see = G.room === B.R && !G.abstract;
    if (cur >= 0) this.stash(cur);
    const outN = cur >= 0 ? B.npc : null; B.npc = null;
    if (want >= 0 && cur >= 0) this.handTale(this.m[cur], this.m[want].d || (this.m[want].d = this.blank()), want);
    if (outN) { if (see) this.leave(outN, cur, want); else outN.dispose(); }
    for (const k in B.props) B.props[k].visible = false;
    if (want < 0) { B.st = 'closed'; return; }
    const d = this.unstash(want);
    const N = this.onDuty(want, d, see ? this.upstairs(want, this._v) : null);
    if (see) { this.follow(N, this.stairWay(want, true).slice(1)); B.returnT = 0; }
    if (see && outN) setTimeout(() => { if (B.npc === N && !N.hp.dead) this.say(N, 'takeOver', this.W(cur).name); }, 2400);
    return N;
  },
  // the one going off: up the stairs (a helper on his way up), a word to the one coming on
  leave(N, i, next) {
    const h = this.wire(N, i);
    h.ph = 'up'; h.t = 0; N.hurry = 1;
    this.toStairs(h);
    if (next >= 0) setTimeout(() => { if (!N.hp.dead) this.say(N, 'handOver'); }, 4200);
  },

  /* ---- hearing it upstairs ---- */
  heard(e) {
    const B = BARKEEP, R = B.R; if (!R || !this.m.length) return;
    const inR = e.room === 'saloon' || roomAt(e.x, e.z, 0.05, (e.y || 0) + 0.1) === R || (e.npc && B.npc && e.npc === B.npc.id && B.npc.room === R);
    const outside = !inR && Math.hypot(e.x - R.doorW.x, e.z - R.doorW.z) < 16;
    const k = { shot: 1, npcShot2: 1, npcShot: 0.6, npcDead: 0.5, npcKo: 0.35, npcDown: 0.3, npcSlam: 0.35, punch: 0.15, npcPunch: 0.15, glass: 0.2 }[e.type];
    if (!k || (!inR && !(outside && (e.type === 'shot' || e.type === 'npcShot2')))) return;
    // those at the scene see it: you did it
    for (const h of this.helpers) if (h.npc.room === R && !h.npc.hp.dead && !h.npc.hp.out && e.by === 'player' && /npcShot|npcDead|npcKo|npcDown|shot/.test(e.type)) {
      h.saw = (h.saw || 0) + 1;
      const who = e.npc && NPCS.list.find((n) => n.id === e.npc && n !== h.npc);
      if (who && e.type === 'npcShot' && !h.said['saw' + who.id]) { h.said['saw' + who.id] = 1; this.note(h.i, 'Du hast gesehen, wie der Fremde auf ' + who.name + ' geschossen hat (' + TIME.stamp() + ').'); }
    }
    // (shooting at people in here puts them on edge; at bottles, less so)
    if (inR && e.by === 'player') { if (e.type === 'npcShot') this.shotsAt = TIME.min; else if (e.type === 'shot') this.noiseAt = TIME.min; }
    const hr = TIME.hour();
    for (const m of this.living()) {
      if (m.i === B.whoI && B.npc) continue;
      if (this.helpers.some((h) => h.i === m.i)) continue;
      const sl = this.asleep(m.i, hr), gun = e.type === 'shot' || e.type === 'npcShot2';
      m.noise = (m.noise || 0) * Math.exp(-(G.time - (m.noiseT || G.time)) / 30) + k * (sl && !gun ? 0.35 : 1) * (outside ? 0.7 : 1); m.noiseT = G.time;
      if (m.noise >= 0.9 && !m.comeT) { m.comeT = G.time + (sl ? 11 + Math.random() * 9 : 3.5 + Math.random() * 4); m.why = gun ? 'shots' : 'noise'; m.wasAsleep = sl; }
    }
  },

  /* ---- the ones who came down ---- */
  makeBody(i, pos, yaw) {
    const W = this.W(i), m = this.m[i];
    const N = new NPC({ attitude: () => (m.d ? m.d.att : 0), id: 'crew_' + W.id, name: W.name, room: null, scene: BARKEEP.scene0, pos, yaw, desc: W.desc });
    N.room = roomAt(pos.x, pos.z, 0.05, pos.y + 0.1); N.voiceProfile = W.voice; N.voiceKey = W.id; N.role = W.name + ' aus dem Saloon (' + W.age + ')';
    if (m.d && m.d.body) { N.hp.load(m.d.body); if (m.d.bodyAt !== null && N.hp.heal) N.hp.heal(Math.max(0, TIME.min - m.d.bodyAt)); }
    return this.wire(N, i);
  },
  wire(N, i) {
    const W = this.W(i), m = this.m[i];
    if (!m.d) m.d = this.blank();
    const h = { i, npc: N, ph: 'down', t: 0, said: {}, saw: 0 };
    N.id = 'crew_' + W.id; N.voiceKey = W.id; N.held = () => [];
    N.talkLog = m.d.talkLog || (m.d.talkLog = []); N.asked = new Set(m.d.asked || []);
    N.persona = this.persona(h);
    N.gossip = { facts: () => m.d.mem.filter((x) => !/hat dir erzählt/.test(x) && /\bEr\b|Fremde/.test(x)), hear: (from, f) => this.note(i, GOSSIP.told(from, f)) };
    N.fight = new Brawler(N, W.fight); N.fight.on = false;
    N.onHarm = (info) => this.helperHarm(h, info); N.onBump = null;
    this.helpers.push(h);
    return h;
  },
  note(i, text) { const d = this.m[i].d || (this.m[i].d = this.blank()); d.mem.push(text); if (d.mem.length > 10) d.mem.shift(); if (/Fremde.*(umgebracht|erschossen|getötet|erschlagen)/.test(text)) this.learnKiller(i); },
  come(m) {
    m.comeT = 0; m.noise = 0;
    const h = this.makeBody(m.i, this.upstairs(m.i, this._v).clone(), 0);
    // shots below, or the saloon has seen killing: he takes his gun down with him, ready
    if (m.why === 'shots' || this.alert() >= 0.5) this.arm(h);
    h.npc.hurry = m.why === 'shots' ? 2.1 : 1.5; this.follow(h.npc, this.stairWay(m.i, true).slice(1));
    this.note(m.i, (m.wasAsleep ? 'Du bist oben von ' + (m.why === 'shots' ? 'Schüssen' : 'Lärm') + ' aufgewacht' : 'Du hast oben ' + (m.why === 'shots' ? 'Schüsse' : 'Lärm') + ' gehört') + ' und bist in den Saloon hinuntergelaufen (' + TIME.stamp() + ').');
  },
  // his own gun (BARKEEP.WHO[i].gun), drawn
  arm(h) {
    const G0 = this.W(h.i).gun; if (!G0 || h.gun) return;
    h.gun = new Gunman(h.npc, Object.assign({}, G0, { onWord: (k) => this.react(h, k === 'warn' ? 'gunWarn' : 'gunWarn2', 'Der Fremde hat seine Waffe in der Hand. Du hast deine ' + (G0.kind === 'shotgun' ? 'Schrotflinte' : 'Waffe') + ' auf ihn gerichtet und warnst ihn: Waffe runter.') }));
    h.gun.draw(); h.npc.held = () => h.gun ? h.gun.held() : [];
  },
  /* how much on edge the saloon is: one of them killed in the last three days (1), shots in the saloon in the last
     hours (0.6, fading); the next one at the bar keeps his gun at hand, those coming down bring theirs */
  alert() {
    let a = 0;
    for (const m of this.m) if (m.died && m.died.by === 'player' && TIME.min - m.died.at < 4320) a = 1;
    if (this.shotsAt !== undefined) a = Math.max(a, 0.7 * clamp(1 - (TIME.min - this.shotsAt) / 360, 0, 1));
    if (this.noiseAt !== undefined) a = Math.max(a, 0.35 * clamp(1 - (TIME.min - this.noiseAt) / 120, 0, 1));
    return a;
  },
  helperHarm(h, info) {
    const N = h.npc, m = this.m[h.i];
    if (info.type === 'dead') { h.ph = 'dead'; h.diedAt = TIME.min; this.died(h.i, info, this.seenBy(N)); return; }
    if (info.type === 'shot') { if (info.zone === 'hat') return; this.note(h.i, 'Er hat dir ' + zoneInto(info.zone, info.side) + ' geschossen (' + TIME.stamp() + ').'); m.d.att = -1; m.d.grudge = Math.min(1, m.d.grudge + 0.6); m.d.shotAt = TIME.min; h.ph = 'hurt'; h.t = 0; if (N.fight.on) N.fight.stop(); return; }
    if (info.type === 'blow' && !N.fight.on && h.ph !== 'hurt' && !N.hp.busy()) {
      m.d.att = Math.max(-1, m.d.att - 0.1); m.d.grudge = Math.min(1, m.d.grudge + 0.05);
      h.resume = h.ph === 'brawl' ? h.resume : h.ph;   // what he was on (to take up again after the fight)
      N.crouchT = 0; N.free(0); N.free(1);
      if (this.W(h.i).fight.courage >= 0.5) { h.ph = 'brawl'; N.fight.start(); }
      else { h.ph = 'up'; this.toStairs(h); N.hurry = 2.2; h.climb = false; if (!h.said.fled) { h.said.fled = 1; this.react(h, 'stop', 'Der Fremde hat dich mit der Faust geschlagen. Du bist alt und kein Schläger, du weichst zurück und flüchtest nach oben.'); } }
    }
  },
  // anyone (other than the dead one) who has it in view: in the same room, awake
  seenBy(N) {
    const R = N.room || null, by = [];
    const B = BARKEEP.npc;
    if (B && B !== N && !B.hp.dead && !B.hp.out && (B.room || null) === R) by.push('barkeep');
    for (const h of this.helpers) if (h.npc !== N && !h.npc.hp.dead && !h.npc.hp.out && (h.npc.room || null) === R) by.push(h.npc.id);
    const D = DOC.npc; if (D && !D.hp.dead && !D.hp.out && (D.room || null) === R && (R || Math.hypot(D.pos.x - N.pos.x, D.pos.z - N.pos.z) < 30)) by.push('doctor');
    return by;
  },
  toStairs(h) { const f = this.stair(-1, this._v); h.npc.hurry = Math.max(1, h.npc.hurry || 1); h.npc.walkTo(f.x, f.z); h.climb = false; },
  aimedAt(N) {
    if (!(GUN.camW > 0.5)) return false;
    const cam = G.cam, d = this._v.set(N.pos.x, N.pos.y + 1.4, N.pos.z).sub(cam.position), L = d.length(); if (L > 18) return false;
    d.divideScalar(L); return cam.getWorldDirection(this._w).dot(d) > Math.cos(0.12 + 0.5 / L);
  },
  updHelper(h, dt) {
    const N = h.npc, B = BARKEEP, BN = B.npc, R = B.R, H = N.hp;
    h.t += dt;
    if (h.ph === 'dead') return;
    if (H.dead) { h.ph = 'dead'; return; }
    N.handShape[0] = N.handShape[1] = null;
    if (H.busy() || H.out) { N.free(0); N.free(1); N.crouchT = 0; return; }
    const inside = G.room === N.room && !!N.room, dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    /* you killed one of them and he caught you at it: run out, and he comes after you, out of the door, and shoots
       when he has you in sight; a while, then back to the body */
    if (h.gun && h.angry && h.ph !== 'chase' && h.ph !== 'up' && h.ph !== 'hurt' && h.ph !== 'down' && h.ph !== 'fetchS' && this.W(h.i).gun.courage >= 0.6 && !inside && N.room === R
      && G.time - (h.chaseDone || -99) > 90 && Math.hypot(PLAY.pos.x - R.doorW.x, PLAY.pos.z - R.doorW.z) < 25 && !PHP.out) {
      if (N.fight.on) N.fight.stop(); N.crouchT = 0; N.free(0); N.free(1); h.ph = 'chase'; h.t = 0; h.walkT = 0; if (!h.gun.on) h.gun.draw(); this.say(N, 'chase');
    }
    if (h.ph === 'chase') {
      // (he shoots at you running or armed; you stand still with your gun away: he comes up and holds you there)
      const see = h.gun.on && h.gun.sees(), run = Math.hypot(PLAY.vx, PLAY.vz), moving = !see || dP > (run > 2 ? 14 : 4);
      if (moving && (!N.walking() || (h.walkT -= dt) <= 0)) { h.walkT = 1.2; N.hurry = 2.1; N.walkTo(PLAY.pos.x, PLAY.pos.z); }
      if (see && (run > 2 || GUN.state !== 'holster')) h.gun.provoked = G.time; else if (see && G.time - (h.gun.provoked || -99) > 2) h.gun.provoked = null;
      h.gun.cover = true;
      if (!h.gun.on) h.gun.draw();
      h.gun.update(dt, moving);
      if (h.t > 30 || dP > 45 || PHP.out || (!see && N.room !== R && h.t > 14)) { h.gun.cover = false; h.chaseDone = G.time; h.ph = 'back'; h.t = 0; N.hurry = 1.4; if (N.room !== R) { const p = rwp(R, 1.5, 0, R.z0 + 2.5); N.walkTo(p.x, p.z); } }
      return;
    }
    /* armed: while you are a danger (gun out, shots, a killing) he stands his ground with it; once you have put it
       away and stayed calm, he lowers it and sees to the rest (the hurt man, the body); out of the room, he puts it up */
    if (h.gun && h.gun.on && h.ph !== 'up' && h.ph !== 'hurt' && h.ph !== 'down') {
      const calm = GUN.state === 'holster' && G.time - GUNMAN.lastShot > 10 && G.time - (h.gun.provoked || -99) > 12;
      h.calmT = calm || !inside ? (h.calmT || 0) + dt : 0;
      if (h.calmT > (inside ? 6 : 8)) h.gun.holster();
      else if (h.gun.update(dt)) { if (h.ph === 'brawl') { N.fight.stop(); h.ph = 'look'; } return; }
    } else if (h.gun && h.gun.st === 'holster') h.gun.update(dt);
    // trouble again with the gun put away: out with it
    if (h.gun && !h.gun.on && inside && h.ph !== 'up' && (GUN.state !== 'holster' || G.time - GUNMAN.lastShot < 2)) { h.gun.draw(); h.calmT = 0; }
    // a gun on him: hands up, whatever he was doing (unarmed)
    if (inside && this.aimedAt(N) && h.ph !== 'up' && !(h.gun && h.gun.on)) {
      if (N.fight.on) N.fight.stop();
      N.stop(); N.crouchT = 0; N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); N.fear = G.time + 0.6;
      if (!h.said.hands || G.time - h.said.hands > 20) { h.said.hands = G.time; this.say(N, 'hands'); }
      if (h.ph === 'brawl') h.ph = 'look';
      return;
    }
    if (h.ph === 'brawl') { const r = N.fight.update(dt); if (r) { h.ph = h.resume === 'up' ? 'up' : h.resume === 'fetch' ? 'fetch' : 'look'; h.resume = null; h.t = 0; if (h.ph === 'up') { h.climb = false; this.toStairs(h); } this.note(h.i, 'Du hast dich mit dem Fremden geprügelt' + (r === 'won' ? ' und ihn umgehauen' : '') + ' (' + TIME.stamp() + ').'); } return; }
    if (h.ph === 'hurt') {
      // hurt: to the doctor (if there is one), then back up
      if (!H.needsDoc() || !DOC.npc || DOC.npc.hp.dead) { h.ph = 'up'; this.toStairs(h); return; }
      const sp = DOC.spot('patient');
      if (!h.docAsked) { if (Math.hypot(N.pos.x - sp.x, N.pos.z - sp.z) > 0.8) { if (!N.walking()) N.walkTo(sp.x, sp.z, sp.yaw); } else { h.docAsked = true; DOC.request(N, () => { h.ph = 'up'; this.toStairs(h); }); } }
      return;
    }
    if (h.ph === 'up') {
      // at the foot of the stairs: up them and gone
      if (!N.walking()) {
        // at the foot: up the stairs, along the corridor to his door, and in
        if (!h.climb) { h.climb = true; this.follow(N, this.stairWay(h.i, false).slice(1)); }
        else this.gone(h);
      }
      if (h.t > 60) this.gone(h);
      return;
    }
    if (h.ph === 'down') {
      if (N.walking() && h.t < 25) return;
      h.ph = 'look'; h.t = 0;
      // a step off the stairs into the room, each to his own spot (so two do not stand in each other)
      { const k = this.helpers.filter((x) => x !== h && x.ph !== 'dead').length, p = rwp(R, 1.1 + k * 1.0, 0, R.z0 + 1.7 + k * 0.5); N.walkTo(p.x, p.z); }
      if (BN && BN.hp.dead && G.room === R && dP < 14) { h.caught = true; }
      // what the one at the bar can tell him (he is alive): who shot him
      if (BN && !BN.hp.dead) this.handTale({ i: B.whoI, d: null }, this.m[h.i].d, h.i);
      if (G.room === R && !(BN && BN.hp.dead)) this.react(h, 'down', 'Du bist von oben heruntergekommen, weil du ' + (this.m[h.i].why === 'shots' ? 'Schüsse' : 'Lärm') + ' gehört hast. ' + (BN ? C2(BN, this.W(B.whoI).name) : 'Hinter der Theke ist keiner.'));
      return;
    }
    // running for the doctor: to him, a word, and back
    if (h.ph === 'fetch') {
      const D = DOC.npc;
      if (!D || D.hp.dead || DOC.st === 'call' || h.t > 90) { h.ph = 'back'; h.t = 0; return; }
      if (Math.hypot(N.pos.x - D.pos.x, N.pos.z - D.pos.z) < 3.2 && (N.room || null) === (D.room || null)) {
        if (DOC.call(PLACEMAP.find('im Saloon'), true, this.W(h.i).name)) { this.say(N, 'docCall'); this.note(h.i, 'Du bist zum Doc gelaufen und hast ihn in den Saloon geholt (' + TIME.stamp() + ').'); }
        h.ph = 'back'; h.t = 0; N.hurry = 1.8; return;
      }
      if (!N.walking() || (h.walkT = (h.walkT || 0) - dt) <= 0) { h.walkT = 2; N.walkTo(D.pos.x, D.pos.z); }
      return;
    }
    // running for the sheriff: a killing (the body is here); he is told who it was, if this one knows
    if (h.ph === 'fetchS') {
      const S = SHERIFF.npc;
      if (!S || S.hp.dead || h.t > 120) { h.ph = 'back'; h.t = 0; return; }
      if (Math.hypot(N.pos.x - S.pos.x, N.pos.z - S.pos.z) < 3.2 && (N.room || null) === (S.room || null)) {
        const dead = this.lastDead ? this.W(this.lastDead.i).name : 'einer von uns', known = !!(this.lastDead && this.lastDead.died && this.lastDead.died.known);
        SHERIFF.report(this.W(h.i).name, PLACEMAP.find('im Saloon'), dead + ' liegt tot im Saloon' + (known ? ', der Fremde hat ihn ' + this.howOf(this.lastDead) : ', ' + this.howOf(this.lastDead) + ', wer es war, weiß keiner'), known);
        this.say(N, 'sheriff'); this.note(h.i, 'Du hast den Sheriff in den Saloon geholt (' + TIME.stamp() + ').');
        h.ph = 'back'; h.t = 0; N.hurry = 1.8; return;
      }
      if (!N.walking() || (h.walkT = (h.walkT || 0) - dt) <= 0) { h.walkT = 2; N.hurry = 2.1; N.walkTo(S.pos.x, S.pos.z); }
      return;
    }
    if (h.ph === 'back') {
      const p = BN || null, f = p ? p.pos : this.stair(-1, this._v);
      if (!N.walking()) { if (N.room === R && (Math.hypot(N.pos.x - f.x, N.pos.z - f.z) < 2.5 || !p || !p.hp.busy() || h.t > 6)) { h.ph = 'look'; h.t = 0; } else N.walkTo(f.x + 0.8, f.z); }
      if (h.t > 60) { h.ph = 'look'; h.t = 0; }
      return;
    }
    // looking after things: who needs him most
    const lying = BN && (BN.hp.busy() || (BN.hp.needsDoc() && B.st === 'hurt'));
    if (BN && BN.hp.dead) return this.vigil(h, dt, BN, inside, dP);
    if (BN && B.st === 'brawl' && N.fight && this.W(h.i).fight.courage >= 0.6 && !PHP.out) { h.ph = 'brawl'; N.fight.start(); this.react(h, 'join', 'Der Fremde prügelt sich mit ' + this.W(B.whoI).name + ', du gehst mit den Fäusten dazwischen.'); this.note(h.i, 'Der Fremde hat sich mit ' + this.W(B.whoI).name + ' geprügelt, du bist dazwischengegangen (' + TIME.stamp() + ').'); return; }
    if (BN && B.st === 'brawl' && !h.said.stop) { h.said.stop = 1; this.say(N, 'stop'); }
    if (BN && lying && BN.room === N.room) return this.tend(h, dt, BN);
    if (h.t > 12 && !(BN && B.st === 'brawl')) { if (G.room === R && !h.said.quiet) { h.said.quiet = 1; this.say(N, 'quiet'); } h.ph = 'up'; this.toStairs(h); }
    else if (BN) { N.lookAt(this._v.set(BN.pos.x, BN.pos.y + 1.5, BN.pos.z), 1); if (inside && dP < 7 && Math.random() < dt * 0.3) N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1); }
  },
  // the one at the bar is hurt: hands on the wound; when it is quiet, one of them runs for the doctor
  tend(h, dt, P) {
    const N = h.npc, H = P.hp, w = AID.woundOf(P);
    const docCame = DOC.callJob && DOC.callJob.P === P || DOC.queue.some((q) => q.npc === P) || DOC.st === 'call';
    const other = this.helpers.find((x) => x !== h && x.pressing && G.time - x.pressing < 0.5);
    // a second man (or the bleeding is held now): one goes for the doctor
    if (!docCame && DOC.npc && !DOC.npc.hp.dead && (other || (h.pressT || 0) > 18 || !w) && !h.fetch && !this.helpers.some((x) => x !== h && x.ph === 'fetch')) { h.fetch = true; h.ph = 'fetch'; h.t = 0; N.crouchT = 0; N.free(0); N.free(1); this.say(N, 'fetch'); N.hurry = 2.2; const d = DOC.npc.pos; N.walkTo(d.x, d.z); return; }
    if (!w) { N.crouchT = 0; N.free(0); N.free(1); N.lookAt(this._v.set(P.pos.x, P.pos.y + 0.6, P.pos.z), 1); if (h.t > 60 && !P.hp.busy()) { h.ph = 'up'; this.toStairs(h); } return; }
    h.ph = 'look';
    const p = H.woundPoint(w, this._v, this._w); if (!p) return;
    // a spot by the wound, clear of his body
    if (!h.spot || Math.hypot(P.pos.x - h.at[0], P.pos.z - h.at[1]) > 0.5) {
      let best = null, bd = 1e9;
      for (let a = 0; a < 10; a++) { const x = p.x + Math.cos(a * TAU / 10) * 0.7, z = p.z + Math.sin(a * TAU / 10) * 0.7; if (HARM.blockedAt(x, z, P.pos.y, 0.2)) continue; const tor = P.ch.p.torso.matrixWorld.elements, hd = P.ch.p.head.matrixWorld.elements; if (Math.hypot(x - tor[12], z - tor[14]) < 0.42 || Math.hypot(x - hd[12], z - hd[14]) < 0.45) continue; const dd = Math.hypot(x - N.pos.x, z - N.pos.z); if (dd < bd) { bd = dd; best = [x, z]; } }
      h.spot = best || [p.x + 0.6, p.z]; h.at = [P.pos.x, P.pos.z];
    }
    if (Math.hypot(N.pos.x - h.spot[0], N.pos.z - h.spot[1]) > 0.3) { if (!N.walking()) { N.hurry = 1.6; N.walkTo(h.spot[0], h.spot[1]); } return; }
    N.stop(); N.crouchT = P.hp.busy() ? 1 : 0.2;
    if (!h.said.help) { h.said.help = 1; this.say(N, 'help'); }
    const q = H.woundPoint(w, this._v, this._w);
    N.faceYaw = Math.atan2(q.x - N.pos.x, q.z - N.pos.z); N.lookAt(q, 1);
    const l = N.toLocal(q, this._w), push = Math.sin(h.t * 2.2) * 0.01;
    N.reach(0, l.x + 0.035, l.y + push, Math.max(0.25, l.z - 0.05)); N.reach(1, l.x - 0.035, l.y + push, Math.max(0.25, l.z - 0.05));
    N.handShape[0] = N.handShape[1] = { open: 0.85 };
    H.press(w, G.time + 0.25); h.pressT = (h.pressT || 0) + dt; h.pressing = G.time;
    if (h.pressT > 8 && !w.art && !w.pressed) { w.pressed = true; w.b *= 0.35; }
    if (!h.bloody) { h.bloody = true; this.note(h.i, 'Du hast ' + P.name + ' die Wunde abgedrückt, bis der Doc kam (' + TIME.stamp() + ').'); }
  },
  // the body of the one at the bar: on his knees by it, a hand on him; then he stays near it
  vigil(h, dt, P, inside, dP) {
    const N = h.npc;
    if (!h.knelt) {
      const e = P.ch.p.torso.matrixWorld.elements, tx = e[12], tz = e[14];
      if (!h.spot) { const a = Math.atan2(N.pos.x - tx, N.pos.z - tz); h.spot = [tx + Math.sin(a) * 0.7, tz + Math.cos(a) * 0.7]; if (HARM.blockedAt(h.spot[0], h.spot[1], P.pos.y, 0.2)) h.spot = [tx + Math.sin(a + 1.6) * 0.7, tz + Math.cos(a + 1.6) * 0.7]; }
      if (Math.hypot(N.pos.x - h.spot[0], N.pos.z - h.spot[1]) > 0.35 && h.t < 15) { if (!N.walking()) N.walkTo(h.spot[0], h.spot[1]); return; }
      N.stop(); N.crouchT = 1; h.kneelT = (h.kneelT || 0) + dt;
      const nk = P.ch.p.head.getWorldPosition(this._v); nk.y -= 0.1; N.faceYaw = Math.atan2(nk.x - N.pos.x, nk.z - N.pos.z); N.lookAt(nk, 1);
      const l = N.toLocal(nk, this._w); N.reach(1, l.x, l.y, Math.max(0.25, l.z)); N.mood = 'sad'; N.moodT = G.time + 4;
      if (h.kneelT > 3.5) {
        h.knelt = true; h.kneltT = G.time; N.free(1); N.crouchT = 0;
        // you are still here, standing over him: he knows
        const seen = (h.caught || h.saw) && inside && dP < 14;
        if (seen) { this.learnKiller(h.i); if (h.gun && this.W(h.i).gun.courage >= 0.6) { h.gun.draw(); h.gun.provoked = G.time; } this.react(h, 'caught', P.name + ' liegt tot vor dir, du hast neben ihm gekniet. Der Fremde steht hier, er hat ihn ' + this.howOf(this.lastDead) + '. Du sagst es ihm ins Gesicht.'); h.angry = true; }
        else this.react(h, 'grief', P.name + ' liegt tot vor dir, du hast neben ihm gekniet, er ist ' + HARM.howDied(this.howOf(this.lastDead)) + '. Er war ' + (this.KIN[this.W(h.i).id] && this.KIN[this.W(h.i).id][this.W(BARKEEP.whoI).id] ? 'dein ' + this.KIN[this.W(h.i).id][this.W(BARKEEP.whoI).id] : 'einer von euch') + '. Wer es war, hast du nicht gesehen.');
      }
      return;
    }
    N.mood = 'sad'; N.moodT = G.time + 2;
    // somebody has to fetch the sheriff: the most timid of them goes (not into your gun; alone only once you are gone)
    if (this.sheriffCalled !== this.lastDead && SHERIFF.npc && !SHERIFF.npc.hp.dead && G.time - h.kneltT > 5 && SHERIFF.st !== 'respond' && SHERIFF.st !== 'scene') {
      const others = this.helpers.filter((x) => x !== h && x.ph !== 'dead' && x.ph !== 'up'), timid = others.every((x) => this.W(x.i).fight.courage >= this.W(h.i).fight.courage);
      if (timid && (others.length || !inside)) { this.sheriffCalled = this.lastDead; h.ph = 'fetchS'; h.t = 0; N.crouchT = 0; if (h.gun) h.gun.holster(); return; }
    }
    // the one who did it is still here: Walt (and Hank) go for him, Jeb wants him gone
    if (h.angry && inside && dP < 6 && GUN.state === 'holster' && this.W(h.i).fight.courage >= 0.6 && !PHP.out && !h.fought) { h.fought = true; h.ph = 'brawl'; h.npc.fight.start(); return; }
    if (h.angry && inside && !h.said.out && G.time - h.kneltT > 8) { h.said.out = 1; this.say(N, 'out'); }
    if (inside && dP < 10) N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1); else N.lookAt(this._v.set(P.pos.x, P.pos.y + 0.3, P.pos.z), 1);
  },
  gone(h) {
    const i = this.helpers.indexOf(h); if (i >= 0) this.helpers.splice(i, 1);
    const m = this.m[h.i]; if (m.d) { m.d.body = h.npc.hp.save(); m.d.bodyAt = TIME.min; m.d.talkLog = (h.npc.talkLog || []).slice(-12); m.d.asked = [...(h.npc.asked || [])]; }
    if (h.gun) h.gun.dispose();
    h.npc.dispose();
  },
  // he knows you did it: how he takes it (the tempers of npc/barkeep_fate.js), unless he already has
  learnKiller(i) {
    const B = BARKEEP, onDuty = i === B.whoI && B.npc && !B.npc.hp.dead;
    const d = onDuty ? B : this.m[i].d; if (!d || d.temper) return;
    const dead = this.lastDead; if (!dead) return;
    const T = B.TEMPERS, W = this.W(i), w = T.map((t) => t.w * (t.need ? t.need(W) : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), k = 0; while (r > w[k] && k < T.length - 1) { r -= w[k]; k++; }
    const t = T[k]; d.temper = t.id; d.grudge = Math.max(d.grudge || 0, t.grudge); d.att = Math.min(d.att || 0, t.att); d.metNew = false;
    if (t.id === 'poison') d.poisonNext = true;
    const txt = 'Du weißt, dass der Fremde ' + this.W(dead.i).name + ' ' + this.howOf(dead) + ' hat. ' + t.mem;
    if (onDuty) B.remember(txt); else this.note(i, txt);
    if (dead.died) dead.died.known = true;
  },
  // the word for how he died ("erschossen"), also for old saves
  howOf(m) { return (m && m.died && (m.died.how || HARM.howOf(m.died.cause))) || 'umgebracht'; },
  // one of them is dead (behind the bar or one who came down): the others learn it, as they learn it
  died(i, info, seen) {
    const m = this.m[i], B = BARKEEP;
    const how = info.how || HARM.howOf(info.cause), cause = HARM.howDied(how);
    m.died = { at: TIME.min, cause, how, by: info.by || 'player', known: false, seen: seen || [] };
    this.lastDead = m;
    // those who saw it (in the room) know it was you
    if ((info.by || 'player') === 'player') {
      for (const s of m.died.seen) {
        if (s === 'doctor') { DOC.knows.push('Du hast gesehen, wie der Fremde ' + this.W(i).name + ' ' + how + ' hat (' + TIME.stamp() + ').'); if (DOC.knows.length > 6) DOC.knows.shift(); m.died.known = true; continue; }
        const h = this.helpers.find((x) => x.npc.id === s);
        if (h) { this.note(h.i, 'Du hast gesehen, wie der Fremde ' + this.W(i).name + ' ' + how + ' hat (' + TIME.stamp() + ').'); this.learnKiller(h.i); }
        else if (s === 'barkeep' && B.npc) { B.remember('Du hast gesehen, wie der Fremde ' + this.W(i).name + ' ' + how + ' hat (' + TIME.stamp() + ').'); this.learnKiller(B.whoI); }
      }
    }
  },
  // the body is taken away (BARKEEP.removeBody, or one who came down): a grave; the rest hear of it
  buried(i) {
    const m = this.m[i], dd = m.died || (m.died = { at: TIME.min, cause: 'gestorben', known: false });
    m.alive = false;
    for (const o of this.m) {
      if (!o.alive || o.away || o.i === i) continue;
      const d = o.i === BARKEEP.whoI && BARKEEP.npc && !BARKEEP.npc.hp.dead ? BARKEEP : (o.d || (o.d = this.blank()));
      const say = (t) => (d === BARKEEP ? BARKEEP.remember(t) : this.note(o.i, t));
      if (d.mem.some((x) => x.indexOf(this.W(i).name + ' ist tot') >= 0)) continue;
      say(this.W(i).name + ' ist tot (' + dd.cause + ', ' + TIME.stamp(dd.at) + '). Er liegt jetzt bei der Kirche. ' + (this.W(o.i).id === 'walt' && this.W(i).id === 'hank' ? 'Du vermisst deinen Bruder und trägst jetzt seine Schürze. ' : '') + (dd.by !== 'player' || dd.known ? '' : 'Wer es war, weiß niemand; du beobachtest jeden Fremden genau.'));
      if (dd.by !== 'player') continue;
      if (!dd.known) d.att = Math.min(d.att || 0, -0.15);
      else if (!d.temper) this.learnKiller(o.i);
    }
    if (!this.living().length) this.closedAt = TIME.min;
  },
  // the new owner comes to town: he only knows what people say
  ownerArrives() {
    const B = BARKEEP, o = this.m[this.OWNER]; o.away = false; o.alive = true; o.d = this.blank();
    const knew = this.m.some((m) => m.died && m.died.known && m.died.by === 'player');
    o.d.mem.push('Du hast den Saloon in Dust Creek gekauft, billig, weil drei Barkeeper hintereinander gestorben sind (' + TIME.stamp() + ').');
    const hows = [...new Set(this.m.filter((m) => m.died).map((m) => this.howOf(m)))].join(' oder ');
    o.d.mem.push(knew ? 'Man erzählt dir in der Stadt, ein Fremder hat sie ' + hows + '. Du hast seine Beschreibung gehört.' : 'Sie sind ' + hows + ' worden, wer es war, weiß keiner. Du traust keinem Fremden.');
    o.d.att = knew ? -0.6 : -0.3; o.d.grudge = knew ? 0.4 : 0.15;
    this.closedAt = null;
    if (knew) { this.lastDead = this.m.filter((m) => m.died).slice(-1)[0] || this.lastDead; }
    B.st = 'closed';
  },
  /* ---- every frame ---- */
  update(dt) {
    const B = BARKEEP; if (!B.R || !this.m.length) return;
    for (let i = this.helpers.length - 1; i >= 0; i--) { const h = this.helpers[i]; this.updHelper(h, dt); if (h.ph === 'dead' && TIME.min - (h.diedAt || TIME.min) > 120 && B.unseen()) { GRAVES.add(this.W(h.i).name, TIME.day()); this.helpers.splice(i, 1); if (h.gun) h.gun.dispose(); h.npc.dispose(); this.buried(h.i); } }
    for (const m of this.living()) if (m.comeT && G.time > m.comeT) { if (m.i === B.whoI && B.npc) m.comeT = 0; else this.come(m); }
    // everybody is dead: closed; three days later the new owner
    if (!this.living().length) {
      if (this.closedAt === null) this.closedAt = TIME.min;
      const o = this.m[this.OWNER];
      if (o && o.away && TIME.min - this.closedAt >= 4320 && B.unseen()) this.ownerArrives();
      return;
    }
    if (B.st === 'dead') return;
    const want = this.dutyAt(TIME.hour()), cur = B.npc && !B.npc.hp.dead ? B.whoI : -1;
    if (want === cur) return;
    // the one there finishes first (serving, hurt, a fight, a gun on him …)
    if (cur >= 0) { const N = B.npc; if (!(B.st === 'idle' && !B.cur && !B.orders.length && !B.pending && !N.hp.needsDoc() && !N.hp.busy() && !N.talking && !N.thinking && B.aimedT <= 0 && !N.fight.on && !this.helpers.some((h) => h.ph !== 'up'))) return; }
    if (want >= 0 && this.helpers.some((h) => h.i === want)) return;   // (he is down here already; let him go up first)
    this.change(cur, want);
  },
  beforeSkip(m, soft) {
    if (soft || m < 20) return;
    // asleep, you do not see them come and go: whoever came down goes back up, a hurt man is seen to by the doctor
    for (const h of this.helpers.slice()) {
      if (h.ph === 'dead') continue;
      if (h.npc.fight.on) h.npc.fight.stop();
      const BN = BARKEEP.npc;
      if (BN && !BN.hp.dead && BN.hp.needsDoc() && DOC.npc && !DOC.npc.hp.dead && !(DOC.st === 'call')) DOC.call(PLACEMAP.find('im Saloon'), true, true);
      this.gone(h);
    }
    for (const x of this.m) x.comeT = 0;
  },
  settled() { return !this.helpers.some((h) => h.ph !== 'dead') && !this.m.some((x) => x.comeT); },
  save() {
    return { m: this.m.map((x) => ({ alive: x.alive, away: x.away, died: x.died ? { at: x.died.at, cause: x.died.cause, how: x.died.how || null, known: !!x.died.known, by: x.died.by || 'player' } : null, d: x.d ? { ...x.d, asked: x.d.asked || [], mem: x.d.mem.slice(-10) } : null })),
      closedAt: this.closedAt, lastDead: this.lastDead ? this.lastDead.i : null, helpers: this.helpers.filter((h) => h.ph !== 'dead').map((h) => h.i), deadHelpers: this.helpers.filter((h) => h.ph === 'dead').map((h) => h.i) };
  },
  load(s) {
    if (!s || !Array.isArray(s.m)) return;
    for (const h of this.helpers) { if (h.gun) h.gun.dispose(); h.npc.dispose(); }
    this.helpers.length = 0;
    s.m.forEach((x, i) => {
      const m = this.m[i]; if (!m || !x) return;
      m.alive = !!x.alive; m.away = !!x.away; m.died = x.died || null; m.comeT = 0; m.noise = 0;
      if (i !== BARKEEP.whoI || BARKEEP.st === 'closed' || !BARKEEP.npc) { const d = this.blank(); if (x.d) for (const k in d) if (x.d[k] !== undefined) d[k] = x.d[k]; d.mem = Array.isArray(d.mem) ? d.mem.filter((t) => typeof t === 'string').slice(-10) : []; m.d = d; }
    });
    // those who were down here when you left went back up; a body of one of them was taken away meanwhile
    for (const i of s.deadHelpers || []) { const m = this.m[i]; if (m && m.alive) { if (!GRAVES.list.some((g) => g.name === this.W(i).name)) GRAVES.add(this.W(i).name, TIME.day()); this.buried(i); } }
    this.closedAt = typeof s.closedAt === 'number' ? s.closedAt : null;
    this.lastDead = typeof s.lastDead === 'number' ? this.m[s.lastDead] || null : null;
  },
  // an old save (before the crew): whoever came before the one there is dead
  legacy(whoI, gone) {
    for (const m of this.m) if (m.i < this.OWNER && (m.i < whoI || (gone && m.i === whoI))) { m.alive = false; m.died = m.died || { at: TIME.min, cause: 'gestorben', known: true }; this.lastDead = m; }
  }
};
