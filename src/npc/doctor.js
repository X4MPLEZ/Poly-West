/* ---------- Doc Whitfield, the doctor ----------
   Lives in his practice (world/interiors.js: doctor). When nobody needs him he works: writes at his desk, sorts the
   medicine cabinet, washes his hands, looks out of the window. The wounded come to him (DOC.request(npc) from their
   behaviour, Hank: npc/barkeep.js): the patient stands by the couch, Doc turns him to the light, cleans the wound
   and wraps it (both hands circling the wound), and the wound is bandaged (Vitals.bandageAll): the bleeding stops
   and it heals faster. The player can be treated too (50 ¢). Whoever is knocked out by a bullet wakes up here.
   What his patients tell him (who did it) he keeps, and it changes how he sees you. */
const DOC = {
  npc: null, R: null, st: 'idle', act: null, actT: 0, queue: [], cur: null, mem: [], att: 0, recent: [], knows: [], cool: {}, bags: {}, lastLine: {},
  PRICE: 50, _v: new THREE.Vector3(), _w: new THREE.Vector3(),
  // places in the practice (room frame): x, z, facing (room angle: 0 = towards the door)
  SPOTS: { desk: [2.2, -3.95, 0], cabinet: [0.3, -7.75, Math.PI], window: [-1.9, -1.0, 0], wash: [2.95, -5.6, -Math.PI / 2], treat: [0.75, -5.5, -Math.PI / 2], patient: [-0.1, -5.5, Math.PI / 2] },
  MOOD: { hello: 'neutral', treat: 'neutral', done: 'neutral', broke: 'disgusted', healthy: 'amused', shot: 'angry', hurt: 'angry', bye: 'neutral', thanks: 'neutral', patient: 'neutral' },
  LINES: {
    hello: ['Doktor Whitfield. Wo tut’s weh?', 'Komm rein. Fass nichts an.', 'Na? Wieder was gebrochen?', 'Sprechstunde ist immer. Leider.', 'Setz dich, wenn du blutest. Sonst bleib stehen.'],
    patient: ['Halt still. Das brennt jetzt.', 'Zeig her… hm. Das wird wieder.', 'Beiß die Zähne zusammen.', 'Sauberer Durchschuss. Du hast Glück gehabt.', 'Ruhig. Ich hab schon Schlimmeres gesehen.'],
    done: ['So. Fertig. Nicht nass werden lassen.', 'Das hält. Komm in drei Tagen wieder.', 'Fertig. Und jetzt raus mit dir.', 'Verbunden. Versuch, nicht wieder angeschossen zu werden.'],
    healthy: ['Dir fehlt nichts. Ausser vielleicht Verstand.', 'Gesund wie ein Pferd. Geh.', 'Ich sehe nichts. Komm wieder, wenn du blutest.'],
    broke: ['Fünfzig Cent. Ohne Geld kein Verband.', 'Ich arbeite nicht umsonst, mein Freund.', 'Erst bezahlen. Dann flicken.'],
    shot: [['Nicht in meiner Praxis!', 'angry'], ['Leg die Waffe weg, verdammt!', 'angry'], ['Ich flicke Löcher, ich will keine machen!', 'angry']],
    hurt: [['Aaah! Bist du verrückt?!', 'angry'], ['Verdammt! Ich bin Arzt!', 'angry'], ['Du schießt auf den einzigen Arzt im Umkreis?!', 'angry']],
    refuse: [['Für dich? Nein. Such dir einen anderen Arzt.', 'disgusted'], ['Dich flick ich nicht. Raus.', 'angry']],
    thanks: ['Schon gut.', 'Dafür bin ich da.', 'Bezahlt ist bezahlt.'],
    bye: ['Pass auf dich auf.', 'Und komm nicht so bald wieder.', 'Bis zum nächsten Loch.'],
    coming: [['Ich komme! Geh voraus!', 'surprised'], ['Meine Tasche… los, schnell!', 'surprised'], ['Bin unterwegs!', 'surprised'], ['Verdammt. Ich komme.', 'angry']],
    comingCalm: [['Ich seh es mir an.', 'neutral'], ['Gut, ich komme mit.', 'neutral'], ['Na schön. Zeig es mir.', 'neutral']],
    onsite: [['Platz da! Lasst mich ran!', 'angry'], ['Halt still. Ich bin ja da.', 'neutral'], ['Zeig her… ruhig atmen.', 'neutral']],
    dead: [['Der ist tot. Da kann ich nichts mehr tun.', 'sleepy'], ['Tot. Kein Puls mehr. Zu spät.', 'sleepy'], ['Für den kommt jede Hilfe zu spät.', 'sleepy'], ['Er ist tot. Ich hätte früher hier sein müssen.', 'sleepy']],
    late: [['Zu spät. Für den kann ich nichts mehr tun.', 'sleepy'], ['Er ist tot. Ich hätte früher da sein müssen.', 'sleepy']],
    fooled: [['Da ist niemand. Hältst du mich für einen Narren?', 'angry'], ['Ich laufe quer durch die Stadt für nichts?!', 'angry'], ['Das war das letzte Mal, dass ich dir glaube.', 'disgusted']],
    refuseCall: [['Ich falle nicht noch einmal auf dich herein.', 'disgusted'], ['Such dir einen anderen Dummen.', 'disgusted']],
    sell: [['Wickel fest, nicht zu fest. Und dann bring ihn zu mir.', 'neutral'], ['Ein Verband ersetzt keinen Arzt. Merk dir das.', 'neutral'], ['Hier. Druck drauf, dann wickeln.', 'neutral']],
    mutter: [['Wo hab ich nur das Laudanum hingestellt…', 'whisper'], ['Boston… hätte ich nur nie…', 'whisper'], ['Drei Schusswunden diese Woche. Drei.', 'whisper'], ['Die Hände… immer die Hände waschen.', 'whisper'], ['Hm. Das Rezept stimmt so nicht.', 'whisper']]
  },
  // where he is called to: anything in town you can name, and how ("hinter der Kirche", "beim Wasserturm", "bei
  // Hank"): npc/places.js
  placeOf(text) { return PLACEMAP.find(text); },
  // called from a conversation: where to (the place you named, or with you), how urgent (how you said it)
  callFromTalk(action) {
    const t = (TALK.lastText || '').toLowerCase(), place = action === 'follow' ? null : this.placeOf(t);
    const urgent = /verblut|stirbt|sterb|schnell|sofort|notfall|blutet|angeschossen|tot\b|lebt|eilt/.test(t);
    this.call(place || 'follow', urgent);
  },
  /* a call for help: he goes there (runs, if it is urgent), looks for whoever is hurt, patches him up where he lies;
     nobody there: he was made a fool of, and remembers it (twice, and he no longer believes you easily) */
  call(place, urgent, trusted) {
    const N = this.npc; if (!N || N.hp.dead || N.hp.busy() || this.st === 'fight') return false;
    if (!trusted && this.fooledN >= 2 && this.att < -0.2 && !this.patientNear(PLAY.pos, 30)) { this.say('refuseCall'); return false; }
    // place: 'follow' (with you), 'here' (by himself, round him), or what PLACEMAP found
    let dest = null, R = null;
    const P = place && typeof place === 'object' ? place : null;
    if (P && P.street) place = 'street';
    else if (P) { R = P.R || P.room || null; dest = { x: P.x, z: P.z }; }
    this.callJob = { place: P ? (P.type || 'spot') : place, where: P, R, dest, urgent, t: 0, phase: 'go', P: null, walkT: 0, by: typeof trusted === 'string' ? trusted : null };
    this.st = 'call'; this.queue.length = 0; this.cur = null;
    N.hurry = urgent ? 2.1 : 1.3; N.free(0); N.free(1); N.endGesture && N.endGesture();
    if (dest) N.walkTo(dest.x, dest.z);
    return true;
  },
  // the one most in need near a point (alive and hurt first, else a body)
  patientNear(p, r, room) {
    let best = null, bs = -1;
    for (const n of NPCS.list) {
      if (n === this.npc) continue;
      if (room !== undefined && (n.room || null) !== (room || null)) continue;
      if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > r) continue;
      // (only who needs him: dead, bleeding, an open gunshot; a bandaged man is done)
      const H = n.hp, need = (H.dead && !n.docChecked) || H.bleed > 0.0005 || H.dying > 0 || H.wounds.some((w) => w.kind === 'shot' && !w.bandaged && w.heal < 0.6);
      const sc = H.dead ? 0.5 : n.plight();
      if (need && sc > bs) { bs = sc; best = n; }
    }
    return best;
  },
  updCall(dt) {
    const J = this.callJob, N = this.npc; J.t += dt;
    const home = () => { J.phase = 'home'; N.hurry = 1; const s = this.spot('desk'); N.walkTo(s.x, s.z, s.yaw); N.crouchT = 0; N.free(0); N.free(1); };
    if (J.phase === 'go') {
      // on the way, or following you: whoever lies hurt close by is the one
      const P = this.patientNear(N.pos, 7, N.room);
      if (P) { J.P = P; J.phase = 'to'; this.say('onsite', 20); return; }
      if (J.place === 'follow' || J.place === 'street') {
        J.walkT -= dt;
        if (J.walkT <= 0) { J.walkT = 0.8; const d = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z); if (d > 1.8) N.walkTo(PLAY.pos.x, PLAY.pos.z); else N.stop(Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z)); }
        if (J.t > 90) J.phase = 'none';
      } else if (!N.walking()) J.phase = 'look';
      if (J.t > 120) J.phase = 'none';
      return;
    }
    if (J.phase === 'look') { const P = this.patientNear(N.pos, 14, N.room); if (P) { J.P = P; J.phase = 'to'; this.say('onsite', 20); } else J.phase = 'none'; return; }
    if (J.phase === 'none' && J.place === 'here') { home(); return; }   // (he went by himself: nobody fooled him)
    if (J.phase === 'none') {
      // made a fool of
      this.fooledN = (this.fooledN || 0) + 1; this.feel(-0.35);
      this.remember('Der Fremde hat dich zu einem Verletzten ' + (J.where ? J.where.name : 'irgendwo in der Stadt') + ' gerufen. Da war niemand (' + TIME.stamp() + ').');
      this.say('fooled'); N.gesture('fist_shake'); home(); return;
    }
    if (J.phase === 'to') {
      const P = J.P;
      // dead: he goes to him all the same and sees for himself (phase 'check')
      if (P.hp.dead) J.dead = true;
      // he sees the doctor coming and waits for him (on his way to the practice, say): he stops where he is
      if (Math.hypot(N.pos.x - P.pos.x, N.pos.z - P.pos.z) < 14) P.waitFor = { by: N, t: G.time + 1.5 };
      // a free spot beside him (by his chest, where the wound is), the one nearest to the doctor; again if he moved
      if (J.spot && Math.hypot(P.pos.x - J.at[0], P.pos.z - J.at[1]) > 0.5) J.spot = null;
      if (!J.spot) {
        const e = P.ch.p.torso.matrixWorld.elements, cx = e[12], cz = e[14];
        let best = null, bd = 1e9;
        for (let a = 0; a < 8; a++) { const x = cx + Math.cos(a * Math.PI / 4) * 0.72, z = cz + Math.sin(a * Math.PI / 4) * 0.72; if (HARM.blockedAt(x, z, P.pos.y, 0.22)) continue; const d = Math.hypot(x - N.pos.x, z - N.pos.z); if (d < bd) { bd = d; best = [x, z]; } }
        J.spot = best || [cx, cz]; J.at = [P.pos.x, P.pos.z]; J.toT = J.toT || 0;
      }
      J.toT += dt;
      const dS = Math.hypot(N.pos.x - J.spot[0], N.pos.z - J.spot[1]), dP = Math.hypot(N.pos.x - P.pos.x, N.pos.z - P.pos.z);
      if (dS > 0.3 && !(J.toT > 6 && dP < 1.7)) { if (!N.walking() || (J.walkT -= dt) <= 0) { J.walkT = 1.5; N.walkTo(J.spot[0], J.spot[1]); } if (J.toT > 25) J.phase = 'none'; return; }
      N.stop(); J.t = 0; N.hurry = 1;
      if (J.dead || P.hp.dead) { J.phase = 'check'; return; }
      J.phase = 'work'; this.askHow(P);
      return;
    }
    // a body: down on one knee, two fingers on the neck, a moment; then he knows
    if (J.phase === 'check') {
      const P = J.P; N.crouchT = 1;
      const nk = P.ch.p.head.getWorldPosition(this._v); nk.y -= 0.12;
      N.faceYaw = Math.atan2(nk.x - N.pos.x, nk.z - N.pos.z); N.lookAt(nk, 1);
      const l = N.toLocal(nk, this._w); N.reach(1, l.x, l.y, Math.max(0.25, l.z)); N.handShape[1] = { point: 0.6, open: 0.3 };
      if (J.t > 3.2) {
        P.docChecked = true; N.handShape[1] = null; N.free(1); N.crouchT = 0;
        const said = this.say('dead');
        if (!said && G.room === (N.room || null)) TOAST.show('Doc: „Der ist tot. Da kann ich nichts mehr tun.“');
        this.remember(P.name + ' war tot, als du kamst. Du konntest nichts mehr tun (' + TIME.stamp() + ').');
        worldEvent('docChecked', P.pos.x, P.pos.y, P.pos.z, { by: 'doctor', npc: P.id });
        J.phase = 'after'; J.t = 0; N.gesture('shake_head');
      }
      return;
    }
    if (J.phase === 'work') {
      const P = J.P, lying = P.hp.busy();
      P.waitFor = { by: N, t: G.time + 1.5 };
      if (P.hp.dead) { this.say('late'); P.waitFor = null; home(); return; }
      N.crouchT = lying ? 1 : 0;
      const w = P.hp.wounds.find((x) => x.kind === 'shot' && !x.bandaged && x.part && x.lp) || P.hp.wounds[0];
      const part = w && w.part ? P.ch.p[w.part] : P.ch.p.torso;
      this._v.set(w && w.lp ? w.lp[0] : 0, w && w.lp ? w.lp[1] : 0.25, w && w.lp ? w.lp[2] : 0.15); part.updateMatrixWorld(); this._v.applyMatrix4(part.matrixWorld);
      N.faceYaw = Math.atan2(this._v.x - N.pos.x, this._v.z - N.pos.z); N.lookAt(this._v, 1);
      const l = N.toLocal(this._v, this._w), a = J.t * 5.5, r = J.t > 1.5 ? 0.08 : 0.03;
      N.reach(0, l.x + 0.06 + Math.cos(a) * r, l.y + Math.sin(a) * r * 0.6, Math.max(0.25, l.z - 0.06));
      N.reach(1, l.x - 0.06 - Math.cos(a) * r, l.y - Math.sin(a) * r * 0.6, Math.max(0.25, l.z - 0.06));
      if (J.t > 6) {
        const H = P.hp; H.bandageAll(); H.dying = 0; H.bleed = 0; H.blood = Math.max(H.blood, BLOOD_FAINT + 0.07);
        if (H.anim && H.anim.holding()) H.downFor = Math.min(H.downFor, H.downT + 5);
        this.learn(P, 0); this.snip(); this.say('done');
        if (J.by) this.remember(J.by + ' hat dich zu ' + P.name + ' geholt, der verletzt dalag. Du hast ihn versorgt (' + TIME.stamp() + ').'); else { this.feel(0.15); this.remember('Der Fremde hat dich zu ' + P.name + ' gerufen, der verletzt dalag. Du hast ihn versorgt (' + TIME.stamp() + ').'); }
        P.waitFor = null;
        if (P.onHarm) P.onHarm({ type: 'treated', by: 'doctor' });
        this.queue = this.queue.filter((q) => q.npc !== P);
        J.phase = 'after'; J.t = 0; N.free(0); N.free(1); N.crouchT = 0;
      }
      return;
    }
    if (J.phase === 'after') { if (J.t > 6) home(); return; }
    if (J.phase === 'home') { if (!N.walking() && N.room === this.R) { this.st = 'idle'; this.callJob = null; this.pickAct(); } else if (!N.walking()) { const s = this.spot('desk'); N.walkTo(s.x, s.z, s.yaw); } }
  },
  pick(kind) { return BARKEEP.pick.call(this, kind); },
  // while he works on someone he asks how it happened, and the patient tells him (heard: a little talk; not heard,
  // he learns it anyway: learn())
  askHow(P) {
    const N = this.npc, H = P.hp, w = H.wounds.filter((x) => x.kind === 'shot').slice(-1)[0];
    const harm = P.gossip ? P.gossip.facts().filter((m) => /geschossen|geprügelt|verbunden/.test(m)).slice(-2).join(' ') : '';
    const where = w ? zoneInto(w.zone, w.side) : '';
    const off = [[0, ['Wer war das?', 'Wie ist das passiert?', 'Was ist passiert?'][Math.floor(Math.random() * 3)], 'neutral'],
      [1, harm && /Fremde|Er hat/.test(harm) ? 'Der Fremde. ' + (where ? 'Hat mir ' + where + ' geschossen.' : 'Wer sonst.') : 'Frag nicht.', 'angry'],
      [0, ['Halt still. Ich bin gleich fertig.', 'Dieser Kerl… Halt still.', 'Das wird wieder. Beiß die Zähne zusammen.'][Math.floor(Math.random() * 3)], 'neutral']];
    return CHAT.topic(N, P, 'Doc Whitfield versorgt gerade ' + P.name + ' (' + H.describe() + '). Der Doc fragt, wie das passiert ist und wer es war; ' + P.name + ' erzählt es knapp, mit Schmerzen' + (harm ? ' (was er erlebt hat: ' + harm + ')' : '') + '. Der Doc kommentiert trocken.', off);
  },
  init(scene) {
    const R = this.R = ROOMS.find((r) => r.type === 'doctor');
    if (!R) return;
    const s = this.SPOTS.desk, p = rwp(R, s[0], R.floorY, s[1]);
    this.npc = new NPC({
      id: 'doctor', name: 'Doc', room: R, scene, pos: p, yaw: this.yawFor(s[2]), walkSpeed: 1.3,
      desc: { skin: 0, build: { width: 0.95, belly: 0.1 }, face: { nose: 'small', brows: 0.9 }, hair: { style: 'slick', color: rgb(0x9a948a) }, beard: { style: 'goatee', color: rgb(0x8a8378) },
        outfit: { hat: null, bandana: null, shirt: { color: rgb(0xe8e4da) }, vest: rgb(0x2a2a2e), pants: { color: rgb(0x34322f) }, boots: rgb(0x1e1a18), belt: rgb(0x1e1a18), bowtie: rgb(0x2a2a2e), glasses: true, gun: false } }
    });
    const N = this.npc;
    N.role = 'Doc Whitfield, der Arzt von Dust Creek (um die sechzig, gebildet, trocken)';
    N.gossip = { facts: () => this.mem.filter((m) => !/hat dir erzählt/.test(m)), hear: (from, f) => { this.knows.push(GOSSIP.told(from, f)); if (this.knows.length > 6) this.knows.shift(); } };
    N.voiceProfile = { male: true, pitch: 1.04, length: 0.98, noiseW: 0.7, browserPitch: 0.95, rate: 1.02, prefer: ['daniel', 'adam'] };
    N.persona = this.persona();
    N.fight = new Brawler(N, { courage: 0.3, power: 0.7, skill: 0.35, toughness: 0.85 });
    N.onHarm = (info) => this.onHarm(info);
    onWorldEvent((e) => this.event(e));
    // the player at the doctor's: get patched up
    const it = { x: p.x, y: R.floorY, z: p.z, room: R, occ: null, verb: 'doc', kind: 'doc', fx: 0, fz: 1, sx: p.x, sz: p.z };
    it.score = (q) => { if (!this.available()) return 1e9; const d = Math.hypot(N.pos.x - q.x, N.pos.z - q.z); if (d > 3.6) return 1e9; it.x = N.pos.x; it.z = N.pos.z; it.sx = N.pos.x; it.sz = N.pos.z; return d + 0.5; };
    it.actions = () => [{ label: 'Behandeln lassen (' + this.PRICE + ' ¢)', run: () => this.treatPlayer() }, { label: 'Verbandszeug kaufen (' + ITEMS.bandage.price + ' ¢)', run: () => this.sellBandage() }];
    // he moves about, so he is not in the grid of fixed things but checked like the bar counters
    it.id = 'doc'; INTERACT.wide.push(it);
    this.pickAct();
  },
  yawFor(a) { const R = this.R, A = rwp(R, 0, 0, 0), B = rwp(R, Math.sin(a), 0, Math.cos(a)); return Math.atan2(B.x - A.x, B.z - A.z); },
  doorPoint() { const d = rwp(this.R, 0, this.R.floorY + 1.4, this.R.z1); return new THREE.Vector3(d.x, d.y, d.z); },
  spot(name) { const s = this.SPOTS[name], p = rwp(this.R, s[0], this.R.floorY, s[1]); return { x: p.x, z: p.z, yaw: this.yawFor(s[2]) }; },
  available() { const N = this.npc; return !!N && !N.hp.busy() && N.room === this.R && (this.st === 'idle' || this.st === 'treat'); },
  fooledN: 0,
  // he asks: what happened to you, what a patient told him about you, who did that field dressing (each once)
  curious() {
    const N = this.npc, day = TIME.day();
    if (N.plight() >= 2 || this.att < -0.7) return;
    if (PHP.hp < 0.6 && TALK.wonder(N, 'hurt' + day, 'Der Fremde kommt verletzt in deine Praxis, er blutet.', 'Du blutest ja. Was ist passiert?', 'surprised')) return;
    const shot = this.knows.filter((k) => /der Fremde war es|Fremde hat|erzählt/.test(k)).slice(-1)[0];
    if (shot && TALK.wonder(N, 'shooter' + shot.length + shot.slice(0, 10), 'Ein Patient hat dir über den Fremden erzählt: ' + shot + ' Jetzt steht der Fremde in deiner Praxis.', 'Man hat mir erzählt, was du getan hast. Stimmt das?', 'neutral')) return;
    if (this.aidSeen && TALK.wonder(N, 'aid' + this.aidSeen, 'Du hast vorhin ' + this.aidSeen + ' behandelt; jemand hatte ihm schon einen Notverband angelegt, und es heißt, das war der Fremde.', 'Der Notverband an ' + this.aidSeen + '… das warst du? Nicht schlecht.', 'amused')) this.aidSeen = null;
  },
  settled() { return !this.npc || this.npc.hp.dead || (this.st === 'idle' && !this.queue.length && !this.npc.walking()); },
  // where someone who was shot down wakes up: by the couch
  wakeSpot() { if (!this.npc || this.npc.hp.dead) return null; const s = this.spot('patient'); return { p: new THREE.Vector3(s.x, this.R.floorY, s.z), yaw: s.yaw }; },
  patientFee() {
    const fee = Math.min(INV.money, 100);
    INV.money -= fee;
    setTimeout(() => { if (fee) TOAST.show('Der Doktor hat sich bedient: −' + money(fee) + '.', 'money'); }, 3200);
    this.remember('Du hast ihn zusammengeflickt, nachdem man ihn angeschossen hatte (' + TIME.stamp() + ').');
  },
  remember(text) { this.mem.push(text); if (this.mem.length > 10) this.mem.shift(); },
  feel(d) { this.att = clamp(this.att + d, -1, 1); },
  say(kind, cool) {
    if (cool && (this.cool[kind] || -99) > G.time - cool) return false;
    if (!this.npc.canBeHeard() || !TALK.mayBark(this.npc, kind === 'shot' || kind === 'hurt')) return false;
    this.cool[kind] = G.time;
    const l = this.pick(kind); if (!l) return false;
    this.npc.speak(l.text, undefined, l.mood || this.MOOD[kind], true);
    return true;
  },
  /* ---- patients ---- */
  // someone comes to be treated; done(npc) is called once the wound is bandaged
  request(patient, done) { if (!this.queue.some((q) => q.npc === patient)) this.queue.push({ npc: patient, done, t: G.time }); },
  sellBandage() {
    if (this.att < -0.6) { this.say('refuse'); return; }
    if (!INV.pay(ITEMS.bandage.price)) { this.say('broke'); return; }
    INV.add('bandage'); TOAST.show('Verbandszeug (' + INV.items.bandage + ' in der Tasche).');
    this.say('sell', 10);
  },
  treatPlayer() {
    if (this.att < -0.6) { this.say('refuse'); return; }
    if (PHP.hp > 0.97 && PHP.poison < 0.05) { this.say('healthy'); return; }
    if (INV.money < this.PRICE) { this.say('broke'); return; }
    INV.money -= this.PRICE; TOAST.show('Behandlung (−' + this.PRICE + ' ¢).', 'money');
    this.queue.unshift({ player: true, t: G.time });
  },
  onHarm(info) {
    const N = this.npc;
    if (info.type === 'dead') { this.st = 'dead'; this.queue.length = 0; this.cur = null; return; }
    if (info.type === 'shot' && info.zone !== 'hat') {
      this.feel(-1); this.remember('Er hat dir ' + zoneInto(info.zone, info.side) + ' geschossen (' + TIME.stamp() + ').');
      SAY.hide(N); const l = this.pick('hurt'); if (N.canBeHeard()) N.speak(l.text, undefined, l.mood, true);
      // a doctor patches himself up
      setTimeout(() => { if (!N.hp.dead) N.hp.bandageAll(); }, 25000);
    }
    if (info.type === 'blow') {
      this.feel(-0.1);
      if (!N.fight.on && !N.hp.dead) { this.remember('Er hat dich geschlagen (' + TIME.stamp() + ').'); this.st = 'fight'; N.fight.start(); }
    }
  },
  event(e) {
    if (!this.npc || e.by !== 'player' || this.npc.hp.dead) return;
    const inside = G.room === this.R;
    if (e.type === 'shot' && inside) { this.feel(-0.2); this.say('shot', 6); }
    if ((e.type === 'npcShot' || e.type === 'npcDown' || e.type === 'npcDead') && e.npc !== 'doctor' && G.room === this.R) this.feel(-0.3);
    // somebody goes down near him: once it is quiet for a moment, he goes to help by himself
    if ((e.type === 'npcShot' || e.type === 'npcDown' || e.type === 'npcDead') && e.npc !== 'doctor') {
      const N = this.npc, V = NPCS.list.find((n) => n.id === e.npc);
      if (V && (V.room || null) === (N.room || null) && Math.hypot(V.pos.x - N.pos.x, V.pos.z - N.pos.z) < 16 && this.st === 'idle')
        setTimeout(() => { if (this.st === 'idle' && this.patientNear(V.pos, 1, V.room)) { if (!V.hp.dead) this.say('onsite', 20); this.call('here', !V.hp.dead); } }, 2500 + Math.random() * 1500);
    }
  },
  /* ---- per frame ---- */
  update(dt) {
    const N = this.npc; if (!N) return;
    if (N.hp.dead) { this.st = 'dead'; return; }
    const inside = G.room === this.R;
    if (N.hp.busy()) return;
    if (this.st === 'call') { this.updCall(dt); return; }
    if (this.st === 'fight') { const r = N.fight.update(dt); if (r) { this.st = 'idle'; N.walkTo(this.spot('desk').x, this.spot('desk').z, this.spot('desk').yaw); } return; }
    // greet who comes in
    if (inside && !this.wasInside) setTimeout(() => this.say('hello', 90), 900);
    this.wasInside = inside;
    if (inside && this.st === 'idle') this.curious();
    // a gun on him: hands up
    const aimed = inside && GUN.camW > 0.5 && this.aimedAtMe();
    if (aimed) { N.stop(); N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); return; }
    if (this.queue.length && this.st !== 'treat') { this.cur = this.queue.shift(); this.st = 'treat'; this.tt = 0; this.phase = 'go'; }
    if (this.st === 'treat') { this.updTreat(dt); return; }
    this.updIdle(dt, inside);
  },
  aimedAtMe() {
    const cam = G.cam, d = this._v.set(this.npc.pos.x, this.npc.pos.y + 1.4, this.npc.pos.z).sub(cam.position), L = d.length();
    if (L > 18) return false;
    d.divideScalar(L);
    return cam.getWorldDirection(this._f || (this._f = new THREE.Vector3())).dot(d) > Math.cos(0.12 + 0.5 / L);
  },
  pickAct() {
    const acts = ['desk', 'desk', 'cabinet', 'wash', 'window'];
    this.act = acts[Math.floor(Math.random() * acts.length)]; this.actT = 8 + Math.random() * 10;
    const s = this.spot(this.act); this.npc.walkTo(s.x, s.z, s.yaw);
  },
  updIdle(dt, inside) {
    const N = this.npc, t = G.time;
    this.mutterT = (this.mutterT === undefined ? 50 + Math.random() * 60 : this.mutterT) - dt;
    if (this.mutterT <= 0) { this.mutterT = 80 + Math.random() * 120; if (inside && !N.talking && !TALK.open && !N.walking()) this.say('mutter'); }
    // he looks at you when you are close
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (inside && dP < 5) N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 0.9); else N.lookTW = 0;
    if (N.talking || N.thinking) { N.stop(Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z)); N.free(0); N.free(1); if (N.thinking) N.reach(1, -0.04, 1.47, 0.2); return; }
    if (N.walking()) { N.free(0); N.free(1); return; }
    this.actT -= dt;
    if (this.actT <= 0) { this.pickAct(); return; }
    if (this.act === 'desk') { N.leanT = 0.35; N.reach(1, -0.05 + Math.sin(t * 1.7) * 0.06, 0.95, 0.55 + Math.sin(t * 0.9) * 0.03); N.reach(0, 0.25, 0.92, 0.5, 0.7); }
    else if (this.act === 'cabinet') { const k = Math.sin(t * 0.6); N.reach(1, -0.1 + k * 0.15, 1.35 + Math.cos(t * 0.7) * 0.25, 0.42); N.free(0); }
    else if (this.act === 'wash') { const a = t * 6; N.leanT = 0.2; N.reach(0, 0.06 + Math.cos(a) * 0.03, 0.95, 0.42); N.reach(1, -0.06 - Math.cos(a) * 0.03, 0.95 + Math.sin(a) * 0.02, 0.44); }
    // what it sounds like: the pen, the cabinet doors and bottles, the water
    if ((this.fT = (this.fT || 0) - dt) <= 0 && N.arrived() && N.canBeHeard()) {
      const h = N.handWorld(1, this._fv || (this._fv = new THREE.Vector3()));
      if (this.act === 'desk') { this.fT = 0.8 + Math.random() * 1.6; FOLEY.scribble(h); }
      else if (this.act === 'cabinet') { this.fT = 1.5 + Math.random() * 2.5; if (Math.random() < 0.4) FOLEY.cabinet(h); else FOLEY.clink(h, 0.5, Math.random() < 0.5 ? 'bottle' : 'shot'); }
      else if (this.act === 'wash') { this.fT = 0.9 + Math.random() * 0.8; FOLEY.splash(h); }
      else this.fT = 2;
    }
    else { N.free(0); N.free(1); if (!inside || dP > 5) N.lookAt(N.toWorld(Math.sin(t * 0.3) * 2, 1.6, 5, this._v), 0.6); }
  },
  // the treatment: patient to the couch, Doc to the patient, hands on the wound, wrap, done
  updTreat(dt) {
    const N = this.npc, C = this.cur, P = C.player ? null : C.npc;
    const sp = this.spot('treat'), pp = this.spot('patient');
    this.tt += dt;
    if (P && (P.hp.dead || P.hp.busy())) { this.cur = null; this.st = 'idle'; return; }
    if (this.phase === 'go') {
      N.walkTo(sp.x, sp.z, sp.yaw); N.free(0); N.free(1);
      if (P) P.walkTo(pp.x, pp.z, pp.yaw);
      this.phase = 'wait'; this.tt = 0;
    } else if (this.phase === 'wait') {
      const dPl = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
      const ready = !N.walking() && (C.player ? dPl < 2.9 : !P.walking() && Math.hypot(P.pos.x - pp.x, P.pos.z - pp.z) < 0.6);
      // (you stay away: he waves you over)
      if (C.player && !N.walking() && !ready && this.tt > 2 && !C.waved) { C.waved = true; N.gesture('beckon'); }
      if (ready) { this.phase = 'work'; this.tt = 0; if (!P || !this.askHow(P)) this.say('patient'); }
      else if (this.tt > 40) { this.cur = null; this.st = 'idle'; }
    } else if (this.phase === 'work') {
      // where the wound is (the first open gunshot; the player: the chest)
      let target;
      if (P) {
        const w = P.hp.wounds.find((x) => x.kind === 'shot' && !x.bandaged && x.part && x.lp) || P.hp.wounds[0];
        const part = w && w.part ? P.ch.p[w.part] : P.ch.p.torso;
        this._v.set(w && w.lp ? w.lp[0] : 0, w && w.lp ? w.lp[1] : 0.25, w && w.lp ? w.lp[2] : 0.15);
        part.updateMatrixWorld(); this._v.applyMatrix4(part.matrixWorld);
        N.faceYaw = Math.atan2(P.pos.x - N.pos.x, P.pos.z - N.pos.z);
        P.faceYaw = Math.atan2(N.pos.x - P.pos.x, N.pos.z - P.pos.z);
        target = this._v;
      } else { target = this._v.set(PLAY.pos.x, PLAY.pos.y + 1.25, PLAY.pos.z); N.faceYaw = Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z); }
      N.lookAt(target, 1);
      const l = N.toLocal(target, this._w), a = this.tt * 5.5, r = this.tt > 1.5 ? 0.09 : 0.03;
      N.reach(0, l.x + 0.06 + Math.cos(a) * r, l.y + Math.sin(a) * r * 0.6, Math.max(0.25, l.z - 0.08));
      N.reach(1, l.x - 0.06 - Math.cos(a) * r, l.y - Math.sin(a) * r * 0.6, Math.max(0.25, l.z - 0.08));
      N.leanT = 0.25;
      if (this.tt > 5.5) {
        if (P) { const n = P.hp.bandageAll(); this.learn(P, n); if (C.done) C.done(P); }
        else { PHP.hp = 1; PHP.daze = 0; PHP.poison = 0; PHP.sick = 0; worldEvent('treated', PLAY.pos.x, PLAY.pos.y, PLAY.pos.z, { by: 'doctor' }); this.remember('Du hast ihn behandelt (' + TIME.stamp() + ').'); this.feel(0.05); }
        this.snip(); this.say('done');
        this.cur = null; this.st = 'idle'; N.free(0); N.free(1); this.actT = 3; this.act = 'stand';
      }
    }
  },
  // what a patient tells him while he works
  learn(P, n) {
    if (P.hp.wounds.some((w) => w.fieldAt && TIME.min - w.fieldAt < 600) && P.aidBy === 'player') this.aidSeen = P.name;
    const who = P.name, harm = P === BARKEEP.npc ? BARKEEP.mem.filter((m) => /geschossen|geprügelt/.test(m)).slice(-1)[0] : null;
    const wounds = P.hp.describe();
    const line = who + ' war bei dir: ' + wounds + (harm ? '. Er sagt, der Fremde war es: „' + harm.replace(/^Er /, 'Er ') + '“' : '') + ' (' + TIME.stamp() + ').';
    this.knows.push(line); if (this.knows.length > 6) this.knows.shift();
    if (harm) this.feel(-0.25);
    void n;
  },
  snip() {
    GSFX.run(() => { const { g, t } = GSFX.out(0.5, this.npc.pos); for (let i = 0; i < 2; i++) SFX.noiseHit(t + i * 0.12, g, { type: 'highpass', freq: 3200, q: 2, gain: 0.25, attack: 0.001, decay: 0.03 }); });
  },
  persona() {
    const D = this;
    return {
      rules: [
        'Du bist Doc Whitfield, der Arzt von Dust Creek, einem staubigen Städtchen im Wilden Westen (Arizona-Territorium, 1885). Bleib immer in dieser Rolle.',
        'Wer du bist: um die sechzig, graues Haar, schwarze Weste, Fliege. Studiert in Boston, aus Gründen, über die du nicht sprichst, hier gelandet. Gebildet, ruhig, trocken und ein wenig zynisch. Du hast zu viele Schusswunden gesehen. Du duzt jeden.',
        'Dust Creek hat: den Saloon (Hank, sein Bruder Walt und der alte Jeb schenken dort in Schichten aus), ein Hotel, eine Bank, das Büro des Sheriffs, einen Mietstall, einen Barbier, einen Waffenhändler, die Post, eine Apotheke, einen Gemischtwarenladen, eine Kirche und deine Praxis am Ostende.',
        'Dein Kopf ist nicht leer: Dir geht das Laudanum aus und die Postkutsche bringt keins; nachts greifst du selbst manchmal zur Flasche, das weiß keiner. Hank hältst du für ehrlich und stur, er schenkt zu großzügig ein. Du bist neugierig wie ein Arzt: Du fragst nach, wie etwas passiert ist und wer es war, und sprichst den Fremden auf das an, was dir Patienten über ihn erzählt haben.',
        'Eine Behandlung kostet 50 Cent; Verbandszeug verkaufst du für 15 Cent (Knopf im Spiel). wer verletzt ist, kann sich bei dir behandeln lassen (dafür gibt es im Spiel einen Knopf, du musst nichts weiter tun).',
        'Du kennst jeden Winkel der Stadt: die Kirche mit dem Friedhof am Westende, die Hauptstraße mit Saloon, Hotel, Bank, Sheriff, Mietstall mit der Koppel dahinter, Barbier, Waffenhändler, Post, Apotheke und Laden, den Wasserturm und das Windrad hinter den Häusern im Osten, die Brücke über das ausgetrocknete Bachbett. Nennt er einen Ort wie „hinter der Kirche“, weißt du sofort, wo das ist.',
        'Sagt dir der Fremde, dass irgendwo jemand verletzt ist, verblutet oder stirbt, und du glaubst ihm: action come (du gehst sofort hin, bei Lebensgefahr rennst du; den Ort nennt er selbst). Sollst du einfach mitkommen: action follow. Wurdest du schon umsonst gerufen, bist du misstrauisch und fragst nach, statt gleich loszulaufen.',
        'Sprich einfaches, gepflegtes Deutsch. Höchstens zwei kurze Sätze, zusammen unter 30 Wörtern, denn es wird laut vorgelesen. Kein Markdown, keine Emojis, keine Handlungen in Sternchen. Sag nie zweimal dasselbe.',
        'Von der modernen Welt weißt du nichts.',
        'Deine Stimme hat Farbe: meist ruhig (neutral), trocken belustigt (amused), verärgert (angry), angewidert (disgusted), überrascht (surprised), müde (sleepy). Flüstern (whisper) nur für echte Geheimnisse.',
        'action ist genau eines von: none, nod, laugh, shake_head, point_door, shrug (Achselzucken), wave (winken), beckon (herwinken), point_you (auf ihn zeigen), fist_shake (Faust schütteln), calm_down (beschwichtigen), scratch_head (am Kopf kratzen), facepalm, cross_arms (Arme verschränken), come (du gehst zu einem Verletzten), follow (du gehst mit ihm). Nimm die Geste, die zu deinen Worten passt, oft auch none.'
      ].join('\n'),
      context() {
        const lines = ['Es ist ' + TIME.words() + ', ' + TIME.str() + ' Uhr.'];
        lines.push(PHP.hp < 0.6 ? 'Der Fremde ist übel zugerichtet, er blutet und hat Prellungen.' : PHP.hp < 0.95 ? 'Der Fremde hat ein paar Schrammen.' : 'Der Fremde sieht gesund aus.');
        if (GUN.state !== 'holster' && !GUN.reloadThenHolster) lines.push('Er hat seinen Revolver in der Hand!');
        const a = D.att; lines.push('Deine Haltung zu ihm: ' + (a < -0.5 ? 'du hältst ihn für einen gefährlichen Schläger' : a < -0.15 ? 'misstrauisch' : a < 0.3 ? 'sachlich' : 'freundlich') + '.');
        if (D.fooledN) lines.push('Er hat dich schon ' + (D.fooledN === 1 ? 'einmal' : D.fooledN + '-mal') + ' umsonst zu einem angeblich Verletzten gerufen.');
        if (D.st === 'call') lines.push('Du bist gerade unterwegs zu einem Verletzten.');
        if (D.knows.length) lines.push('Was deine Patienten dir erzählt haben: ' + D.knows.slice(-3).join(' '));
        const body = D.npc.hp.describe(); if (body) lines.push('Dein Körper: ' + body + '.');
        if (D.mem.length) lines.push('Was du dir von ihm gemerkt hast: ' + D.mem.slice(-5).join(' '));
        return lines.join('\n');
      },
      offline(text) {
        const t = text.toLowerCase(), r = (x) => x[Math.floor(Math.random() * x.length)];
        if (/verletz|blut|weh|behandel|verband|hilf/.test(t)) return { say: PHP.hp < 0.97 ? 'Zeig her. Fünfzig Cent, dann flick ich dich.' : 'Dir fehlt nichts. Geh nach Hause.', action: 'none' };
        if (/hank|barkeeper|saloon/.test(t)) return { say: D.knows.length ? 'Hank? Der war hier. Mehr sag ich nicht.' : 'Hank schenkt aus, ich flicke zusammen. So läuft das hier.', action: 'none' };
        if (/\b(hallo|howdy|hi|hey|tag|abend|morgen)\b/.test(t)) return { say: r(['Tag.', 'Was gibt’s?']), action: 'nod' };
        if (/danke/.test(t)) return { say: 'Schon gut.', action: 'nod' };
        if (/tschüss|bis dann|ich geh/.test(t)) return { say: 'Pass auf dich auf.', action: 'nod' };
        return { say: r(['Hm.', 'Interessant.', 'Wenn du meinst.', 'Ich bin Arzt, kein Pfarrer.']), action: 'none' };
      },
      quick(text) {
        const t = text.toLowerCase().replace(/[.!,;:"„“”']/g, ' ').replace(/\s+/g, ' ').trim(), words = t.split(' ').length;
        const line = (kind, action) => { const l = D.pick(kind); return l && { say: l.text, mood: l.mood || D.MOOD[kind], action: action || 'none', quick: true }; };
        // a call for help (no need to think about that): he comes
        if (/verblut|angeschossen|stirbt|sterb|blutet|verletzt|notfall|hilfe|schwer verwundet/.test(t) && (D.placeOf(t) || /komm|schnell|mit\b/.test(t))) {
          if (D.fooledN >= 2 && D.att < -0.2) return line('refuseCall', 'shake_head');
          return line(/verblut|stirbt|sterb|schnell|notfall/.test(t) ? 'coming' : 'comingCalm', D.placeOf(t) ? 'come' : 'follow');
        }
        if (words <= 4 && /^(hallo|hi|hey|howdy|servus|moin|tag|guten (tag|abend|morgen))\b/.test(t)) return line('hello', 'nod');
        if (words <= 4 && /^(danke|vielen dank)\b/.test(t)) return line('thanks', 'nod');
        if (words <= 5 && /\b(tschüss|bis dann|bis bald|auf wiedersehen|ich geh)\b/.test(t)) return line('bye', 'nod');
        return null;
      },
      forget() { D.mem = []; D.att = 0; D.knows = []; },
      memory() { return { events: D.mem.slice().concat(D.knows.map((k) => 'Gehört: ' + k)), inPrompt: 5, facts: [['Haltung zu dir', D.att.toFixed(2)]] }; },
      forgetEvent(i) { if (i < D.mem.length) D.mem.splice(i, 1); else D.knows.splice(i - D.mem.length, 1); },
      act(action) { if (action === 'come' || action === 'follow') { D.callFromTalk(action); return; } if (GESTURE.AI.includes(action)) D.npc.gesture(action, action === 'point_door' ? D.doorPoint() : null); }
    };
  }
};
SAVE.part('doc', () => ({ fooled: DOC.fooledN, mem: DOC.mem.slice(-10), knows: DOC.knows.slice(-6), att: +DOC.att.toFixed(3), body: DOC.npc ? DOC.npc.hp.save() : null, asked: DOC.npc && DOC.npc.asked ? [...DOC.npc.asked] : [] }), (d) => {
  if (!d) return;
  DOC.att = clamp(+d.att || 0, -1, 1); DOC.fooledN = d.fooled | 0;
  DOC.mem = Array.isArray(d.mem) ? d.mem.filter((x) => typeof x === 'string').slice(-10) : [];
  DOC.knows = Array.isArray(d.knows) ? d.knows.filter((x) => typeof x === 'string').slice(-6) : [];
  if (d.body && DOC.npc) { DOC.npc.hp.load(d.body); if (DOC.npc.hp.dead) DOC.st = 'dead'; }
  // the questions he has asked you already (TALK.wonder): not again
  if (DOC.npc && Array.isArray(d.asked)) DOC.npc.asked = new Set(d.asked.filter((x) => typeof x === 'string'));
});
