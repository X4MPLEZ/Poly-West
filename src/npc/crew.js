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
    out: [['Verschwinde. Sofort.', 'angry'], ['Raus hier. Lass uns allein.', 'sad']],
    quiet: [['Na gut. Ich geh wieder hoch.', 'neutral'], ['Ruft, wenn was ist.', 'neutral']],
    hands: [['Nicht schießen!', 'surprised'], ['Ganz ruhig, Mister…', 'neutral']],
    takeOver: [['Ich übernehme, {o}. Leg dich hin.', 'neutral'], ['Alles ruhig, {o}? Ich mach weiter.', 'neutral'], ['Geh schlafen, {o}. Ich hab’s.', 'neutral']],
    handOver: [['Ruhiger Tag. Bis morgen.', 'sleepy'], ['Pass auf den da auf.', 'whisper'], ['Die Theke gehört dir.', 'sleepy']]
  },
  bags: {},
  line(kind, o) {
    const L = this.LINES[kind], B = this.bags[kind] || (this.bags[kind] = []);
    if (!B.length) for (let i = 0; i < L.length; i++) B.splice(Math.floor(Math.random() * (B.length + 1)), 0, i);
    const x = L[B.pop()]; return { text: x[0].replace('{o}', o || ''), mood: x[1] };
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
    for (const h of this.helpers) h.npc.dispose();
    this.helpers.length = 0; this.closedAt = null; this.lastDead = null; this.told.clear();
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
    if (where) { N.pos.copy(where); N.room = roomAt(N.pos.x, N.pos.z, 0.05, N.pos.y + 0.1); N.yaw = B.yawFor(1); N.faceYaw = null; }
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
  change(cur, want) {
    const B = BARKEEP, see = G.room === B.R && !G.abstract;
    if (cur >= 0) this.stash(cur);
    const outN = cur >= 0 ? B.npc : null; B.npc = null;
    if (want >= 0 && cur >= 0) this.handTale(this.m[cur], this.m[want].d || (this.m[want].d = this.blank()), want);
    if (outN) { if (see) this.leave(outN, cur, want); else outN.dispose(); }
    for (const k in B.props) B.props[k].visible = false;
    if (want < 0) { B.st = 'closed'; return; }
    const d = this.unstash(want);
    const N = this.onDuty(want, d, see ? this.stair(8, this._v) : null);
    if (see && outN) setTimeout(() => { if (B.npc === N && !N.hp.dead) this.say(N, 'takeOver', this.W(cur).name); }, 2400);
    return N;
  },
  // the one going off: up the stairs (a helper on his way up), a word to the one coming on
  leave(N, i, next) {
    const h = this.wire(N, i);
    h.ph = 'up'; h.t = 0; N.hurry = 1;
    const f = this.stair(-1, this._v); N.walkTo(f.x, f.z);
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
    N.room = roomAt(pos.x, pos.z, 0.05, pos.y + 0.1); N.voiceProfile = W.voice; N.role = W.name + ' aus dem Saloon (' + W.age + ')';
    if (m.d && m.d.body) { N.hp.load(m.d.body); if (m.d.bodyAt !== null && N.hp.heal) N.hp.heal(Math.max(0, TIME.min - m.d.bodyAt)); }
    return this.wire(N, i);
  },
  wire(N, i) {
    const W = this.W(i), m = this.m[i];
    if (!m.d) m.d = this.blank();
    const h = { i, npc: N, ph: 'down', t: 0, said: {}, saw: 0 };
    N.id = 'crew_' + W.id; N.persona = null; N.held = () => [];
    N.gossip = { facts: () => m.d.mem.filter((x) => !/hat dir erzählt/.test(x) && /\bEr\b|Fremde/.test(x)), hear: (from, f) => this.note(i, GOSSIP.told(from, f)) };
    N.fight = new Brawler(N, W.fight); N.fight.on = false;
    N.onHarm = (info) => this.helperHarm(h, info); N.onBump = null;
    this.helpers.push(h);
    return h;
  },
  note(i, text) { const d = this.m[i].d || (this.m[i].d = this.blank()); d.mem.push(text); if (d.mem.length > 10) d.mem.shift(); if (/Fremde.*(umgebracht|erschossen|getötet|erschlagen)/.test(text)) this.learnKiller(i); },
  come(m) {
    m.comeT = 0; m.noise = 0;
    const h = this.makeBody(m.i, this.stair(10, this._v).clone(), 0);
    const f = this.stair(-1, this._w); h.npc.hurry = m.why === 'shots' ? 2.1 : 1.5; h.npc.goTo(f.x, f.z);
    this.note(m.i, (m.wasAsleep ? 'Du bist oben von ' + (m.why === 'shots' ? 'Schüssen' : 'Lärm') + ' aufgewacht' : 'Du hast oben ' + (m.why === 'shots' ? 'Schüsse' : 'Lärm') + ' gehört') + ' und bist in den Saloon hinuntergelaufen (' + TIME.stamp() + ').');
  },
  helperHarm(h, info) {
    const N = h.npc, m = this.m[h.i];
    if (info.type === 'dead') { h.ph = 'dead'; h.diedAt = TIME.min; this.died(h.i, info, this.seenBy(N)); return; }
    if (info.type === 'shot') { if (info.zone === 'hat') return; this.note(h.i, 'Er hat dir ' + zoneInto(info.zone, info.side) + ' geschossen (' + TIME.stamp() + ').'); m.d.att = -1; m.d.grudge = Math.min(1, m.d.grudge + 0.6); m.d.shotAt = TIME.min; h.ph = 'hurt'; h.t = 0; if (N.fight.on) N.fight.stop(); return; }
    if (info.type === 'blow' && !N.fight.on && h.ph !== 'hurt' && !N.hp.busy()) {
      m.d.att = Math.max(-1, m.d.att - 0.1); m.d.grudge = Math.min(1, m.d.grudge + 0.05);
      if (this.W(h.i).fight.courage >= 0.5) { h.ph = 'brawl'; N.fight.start(); } else { h.ph = 'up'; this.toStairs(h); }
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
  toStairs(h) { const f = this.stair(-1, this._v); h.npc.hurry = 1; h.npc.walkTo(f.x, f.z); },
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
    // a gun on him: hands up, whatever he was doing
    if (inside && this.aimedAt(N) && h.ph !== 'up') {
      if (N.fight.on) N.fight.stop();
      N.stop(); N.crouchT = 0; N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); N.fear = G.time + 0.6;
      if (!h.said.hands || G.time - h.said.hands > 20) { h.said.hands = G.time; this.say(N, 'hands'); }
      if (h.ph === 'brawl') h.ph = 'look';
      return;
    }
    if (h.ph === 'brawl') { const r = N.fight.update(dt); if (r) { h.ph = 'look'; h.t = 0; this.note(h.i, 'Du hast dich mit dem Fremden geprügelt' + (r === 'won' ? ' und ihn umgehauen' : '') + ' (' + TIME.stamp() + ').'); } return; }
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
        if (!h.climb) { h.climb = true; const s = this.stair(12, this._v); N.goTo(s.x, s.z); }
        else this.gone(h);
      }
      if (h.t > 40) this.gone(h);
      return;
    }
    if (h.ph === 'down') {
      if (N.walking() && h.t < 12) return;
      h.ph = 'look'; h.t = 0;
      if (BN && BN.hp.dead && G.room === R && dP < 14) { h.caught = true; }
      // what the one at the bar can tell him (he is alive): who shot him
      if (BN && !BN.hp.dead) this.handTale({ i: B.whoI, d: null }, this.m[h.i].d, h.i);
      if (G.room === R && !(BN && BN.hp.dead)) this.say(N, 'down');
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
    if (h.ph === 'back') {
      const p = BN || null, f = p ? p.pos : this.stair(-1, this._v);
      if (!N.walking()) { if (N.room === R && (Math.hypot(N.pos.x - f.x, N.pos.z - f.z) < 2.5 || !p || !p.hp.busy() || h.t > 6)) { h.ph = 'look'; h.t = 0; } else N.walkTo(f.x + 0.8, f.z); }
      if (h.t > 60) { h.ph = 'look'; h.t = 0; }
      return;
    }
    // looking after things: who needs him most
    const lying = BN && (BN.hp.busy() || (BN.hp.needsDoc() && B.st === 'hurt'));
    if (BN && BN.hp.dead) return this.vigil(h, dt, BN, inside, dP);
    if (BN && B.st === 'brawl' && N.fight && this.W(h.i).fight.courage >= 0.6 && !PHP.out) { h.ph = 'brawl'; N.fight.start(); this.say(N, 'join'); this.note(h.i, 'Der Fremde hat sich mit ' + this.W(B.whoI).name + ' geprügelt, du bist dazwischengegangen (' + TIME.stamp() + ').'); return; }
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
        this.say(N, seen ? 'griefSeen' : 'grief');
        if (seen) { this.learnKiller(h.i); setTimeout(() => this.say(N, 'caught'), 2600); h.angry = true; }
      }
      return;
    }
    N.mood = 'sad'; N.moodT = G.time + 2;
    // the one who did it is still here: Walt (and Hank) go for him, Jeb wants him gone
    if (h.angry && inside && dP < 6 && GUN.state === 'holster' && this.W(h.i).fight.courage >= 0.6 && !PHP.out && !h.fought) { h.fought = true; h.ph = 'brawl'; h.npc.fight.start(); return; }
    if (h.angry && inside && !h.said.out && G.time - h.kneltT > 8) { h.said.out = 1; this.say(N, 'out'); }
    if (inside && dP < 10) N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1); else N.lookAt(this._v.set(P.pos.x, P.pos.y + 0.3, P.pos.z), 1);
  },
  gone(h) {
    const i = this.helpers.indexOf(h); if (i >= 0) this.helpers.splice(i, 1);
    const m = this.m[h.i]; if (m.d) { m.d.body = h.npc.hp.save(); m.d.bodyAt = TIME.min; }
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
    const txt = 'Du weißt, dass der Fremde ' + this.W(dead.i).name + ' umgebracht hat. ' + t.mem;
    if (onDuty) B.remember(txt); else this.note(i, txt);
    if (dead.died) dead.died.known = true;
  },
  // one of them is dead (behind the bar or one who came down): the others learn it, as they learn it
  died(i, info, seen) {
    const m = this.m[i], B = BARKEEP;
    const cause = info.cause === 'Kopfschuss' ? 'erschossen worden' : info.cause === 'verblutet' ? 'verblutet' : /schlagen/.test(info.cause || '') ? 'erschlagen worden' : 'gestorben';
    m.died = { at: TIME.min, cause, by: info.by || 'player', known: false, seen: seen || [] };
    this.lastDead = m;
    // those who saw it (in the room) know it was you
    if ((info.by || 'player') === 'player') {
      for (const s of m.died.seen) {
        if (s === 'doctor') { DOC.knows.push('Du hast gesehen, wie der Fremde ' + this.W(i).name + ' umgebracht hat (' + TIME.stamp() + ').'); if (DOC.knows.length > 6) DOC.knows.shift(); m.died.known = true; continue; }
        const h = this.helpers.find((x) => x.npc.id === s);
        if (h) { this.note(h.i, 'Du hast gesehen, wie der Fremde ' + this.W(i).name + ' umgebracht hat (' + TIME.stamp() + ').'); this.learnKiller(h.i); }
        else if (s === 'barkeep' && B.npc) { B.remember('Du hast gesehen, wie der Fremde ' + this.W(i).name + ' umgebracht hat (' + TIME.stamp() + ').'); this.learnKiller(B.whoI); }
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
    o.d.mem.push(knew ? 'Man erzählt dir in der Stadt, ein Fremder hat sie umgebracht. Du hast seine Beschreibung gehört.' : 'Wer sie umgebracht hat, weiß keiner. Du traust keinem Fremden.');
    o.d.att = knew ? -0.6 : -0.3; o.d.grudge = knew ? 0.4 : 0.15;
    this.closedAt = null;
    if (knew) { this.lastDead = this.m.filter((m) => m.died).slice(-1)[0] || this.lastDead; }
    B.st = 'closed';
  },
  /* ---- every frame ---- */
  update(dt) {
    const B = BARKEEP; if (!B.R || !this.m.length) return;
    for (let i = this.helpers.length - 1; i >= 0; i--) { const h = this.helpers[i]; this.updHelper(h, dt); if (h.ph === 'dead' && TIME.min - (h.diedAt || TIME.min) > 120 && B.unseen()) { GRAVES.add(this.W(h.i).name, TIME.day()); this.helpers.splice(i, 1); h.npc.dispose(); this.buried(h.i); } }
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
    return { m: this.m.map((x) => ({ alive: x.alive, away: x.away, died: x.died ? { at: x.died.at, cause: x.died.cause, known: !!x.died.known, by: x.died.by || 'player' } : null, d: x.d ? { ...x.d, asked: x.d.asked || [], mem: x.d.mem.slice(-10) } : null })),
      closedAt: this.closedAt, lastDead: this.lastDead ? this.lastDead.i : null, helpers: this.helpers.filter((h) => h.ph !== 'dead').map((h) => h.i), deadHelpers: this.helpers.filter((h) => h.ph === 'dead').map((h) => h.i) };
  },
  load(s) {
    if (!s || !Array.isArray(s.m)) return;
    for (const h of this.helpers) h.npc.dispose();
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
