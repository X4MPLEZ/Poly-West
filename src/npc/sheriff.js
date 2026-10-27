/* ---------- Sheriff Cole: the law in Dust Creek ----------
   In his office (desk, window, the cell). Shooting anywhere in town brings him out with his revolver drawn, to
   where it came from; somebody can also run and fetch him (npc/crew.js reports a killing). At the scene he looks:
   a body (he checks it), who is there, what the people there saw (witnesses only: CREW / DOC memories, what he saw
   himself). Then, by what you did:
     shots, nobody hurt: a warning, the second time a fine;
     someone shot or killed: he arrests you (gun on you, "hands up"); put your gun away and stay, and you wake up in
     his cell the next morning (fined); draw on him or shoot, and he shoots (Gunman); run, and he gives up after a while
     but does not forget (wanted: the next time he sees you in town he comes for you).
   Crimes are what you did (CRIMES); what he knows of them is what someone saw. Kept in the save. */
const SHERIFF = {
  npc: null, R: null, st: 'office', t: 0, act: 'desk', actT: 0, mem: [], att: 0, wanted: 0, fined: 0, warned: 0, alarm: null, job: null, cool: {},
  _v: new THREE.Vector3(), _w: new THREE.Vector3(),
  SPOTS: { desk: [-1.6, -4.55, 0], window: [-2.2, -1.0, 0], rack: [2.0, -2.6, Math.PI / 2], cell: [2.5, -6.9, 0] },
  LOOKS: { name: 'Cole', age: 'Ende vierzig, grauer Schnurrbart, Stern an der Weste, schwarzer Hut',
    desc: { skin: 1, build: { width: 1.06, belly: 0.1 }, face: { nose: 'normal', brows: 1.15 }, hair: { style: 'short', color: rgb(0x6a645c) }, beard: { style: 'stache', color: rgb(0x7a7268) },
      outfit: { hat: { style: 'cowboy', color: rgb(0x22201e), band: rgb(0x5a4a3a) }, bandana: null, shirt: { color: rgb(0xb8b0a0), rolled: false }, vest: rgb(0x3a2e24), pants: { color: rgb(0x3a3630) }, boots: rgb(0x2a1d15), belt: rgb(0x2a1d15), badge: rgb(0xd8b84a), gun: true } },
    voice: { male: true, pitch: 0.93, length: 1.02, noiseW: 0.75, browserPitch: 0.85, rate: 0.97, prefer: ['george', 'bill'] } },
  LINES: {
    out: [['Was ist hier los?', 'angry'], ['Wer hat hier geschossen?', 'angry'], ['Sheriff! Keiner rührt sich!', 'angry']],
    warn: [['Noch einmal so eine Knallerei, und du schläfst bei mir.', 'angry'], ['In meiner Stadt wird nicht rumgeballert. Merk dir das.', 'angry']],
    fine: [['Das kostet dich {f}. Zahl, oder du sitzt.', 'angry'], ['{f} Strafe. Und das war die letzte Warnung.', 'angry']],
    arrest: [['Hände hoch! Du bist verhaftet.', 'angry'], ['Waffe runter und Hände hoch! Im Namen des Gesetzes!', 'angry']],
    come: [['Ganz ruhig. Du kommst mit mir.', 'neutral'], ['So ist es gut. Und jetzt ab in die Zelle.', 'neutral']],
    escaped: [['Lauf nur. Ich krieg dich.', 'angry'], ['Du kommst nicht weit.', 'angry']],
    dead: [['Der ist hin.', 'sad'], ['Für den kommt jede Hilfe zu spät.', 'sad']],
    warnGun: [['Waffe runter! Ich sag’s nicht zweimal.', 'angry'], ['Leg sie hin. Langsam.', 'angry']],
    warnGun2: [['Letzte Chance, Mister.', 'angry']],
    hello: [['Tag.', 'neutral'], ['Ich hab ein Auge auf dich.', 'neutral'], ['Benimm dich in meiner Stadt.', 'neutral']],
    calm: [['Na also. Geht doch.', 'neutral']],
    halt: [['Stehen bleiben!', 'angry'], ['Halt! Bleib stehen!', 'angry']],
    halt2: [['Bleib stehen, oder ich schieße!', 'angry'], ['Letzte Warnung! Stehen bleiben!', 'angry']],
    hunt: [['Wo ist er hin?', 'angry'], ['Du entkommst mir nicht.', 'angry'], ['Den krieg ich.', 'angry']],
    // hands on you: the boot when you hit him, the run and the tackle when you run, the knee in your back
    kick: [['Nicht mit mir, Freundchen!', 'angry'], ['Hände weg vom Gesetz!', 'angry'], ['Da hast du dich mit dem Falschen angelegt!', 'angry'], ['Den Sheriff schlägt man nicht!', 'angry']],
    runDown: [['Renn ruhig. Ich bin schneller!', 'angry'], ['Bleib stehen, verdammt!', 'angry'], ['Du kommst mir nicht davon!', 'angry']],
    tackle: [['Hab dich!', 'angry'], ['Runter mit dir!', 'angry'], ['Schluss mit dem Gerenne!', 'angry']],
    pin: [['Liegen bleiben!', 'angry'], ['Keine Bewegung, oder es tut weh!', 'angry'], ['Zappel nicht rum, das macht es nur schlimmer.', 'angry'], ['Unten bleiben, hab ich gesagt!', 'angry']],
    pinFace: [['Gesicht in den Dreck und keine Bewegung!', 'angry'], ['Stillhalten! Hände auf den Rücken!', 'angry'], ['Liegen bleiben!', 'angry']],
    cuffs: [['Du bist verhaftet. Die Nacht verbringst du bei mir.', 'angry'], ['So. Und jetzt ab in die Zelle mit dir.', 'neutral'], ['Das war’s. Du kommst mit.', 'neutral']],
    cuffsBlow: [['Einen Gesetzeshüter angreifen. Das kostet dich eine Nacht hinter Gittern.', 'angry'], ['Du schlägst mich? In meiner Stadt? Ab in die Zelle.', 'angry']]
  },
  bags: {},
  line(kind, f) { const L = this.LINES[kind], B = this.bags[kind] || (this.bags[kind] = []); if (!B.length) for (let i = 0; i < L.length; i++) B.splice(Math.floor(Math.random() * (B.length + 1)), 0, i); const x = L[B.pop()]; return { text: x[0].replace('{f}', f || ''), mood: x[1] }; },
  LOUD: { halt: 1, halt2: 1, hunt: 1, arrest: 1, out: 1, escaped: 1, runDown: 1, tackle: 1 },
  say(kind, f) { const N = this.npc; if (!N) return false; N.loud = !!this.LOUD[kind]; if (!N.canBeHeard()) { N.loud = false; return false; } const l = this.line(kind, f); SAY.hide(N); const r = N.speak(l.text, undefined, l.mood, true); N.loud = false; return r; },
  react(kind, situation, f) { if (!TALK.remark(this.npc, situation, () => this.say(kind, f), this.line(kind, f).mood, 1)) this.say(kind, f); },
  remember(t) { this.mem.push(t); if (this.mem.length > 10) this.mem.shift(); },
  CRIMES: [],   // { t (game min), kind: 'shots' | 'wound' | 'kill', who (victim name), how ('erschossen' …), x, z, room, seen (anyone saw it), known (he knows it) }
  crime(kind, e, victim, how) {
    const R = e.room ? ROOMS.find((r) => r.type === e.room && !r.parent) : roomAt(e.x, e.z, 0.05, (e.y || 0) + 0.1);
    let C = this.CRIMES.find((c) => c.kind === kind && c.who === (victim || null) && TIME.min - c.t < 20);
    if (!C) { C = { t: TIME.min, kind, who: victim || null, x: e.x, z: e.z, room: R ? R.type : null, seen: false, known: false }; this.CRIMES.push(C); if (this.CRIMES.length > 12) this.CRIMES.shift(); }
    if (how && (!C.how || C.how === 'umgebracht')) C.how = how;   // (how it was done: the words the AI gets, so it does not make it up)
    // witnesses: anyone awake in that room (or near, outside); the sheriff himself if he sees it
    const N = this.npc;
    // (the one who was shot and lives knows best who did it)
    for (const n of NPCS.list) { if (n.hp.dead || n === N) continue; if (victim && n.name === victim) { C.seen = true; continue; } if (n.hp.out) continue; if ((n.room || null) === (R || null) && Math.hypot(n.pos.x - e.x, n.pos.z - e.z) < (R ? 20 : 25)) C.seen = true; }
    if (N && !N.hp.dead && this.sees(e.x, (e.y || 0) + 1, e.z)) { C.seen = true; this.learn(C, 'Du hast es selbst gesehen'); }
    return C;
  },
  sees(x, y, z) {
    const N = this.npc; if (!N) return false;
    const R = roomAt(x, z, 0.05, y - 0.9);
    if ((R || null) !== (N.room || null)) return false;
    const o = this._v.set(N.pos.x, N.pos.y + 1.6, N.pos.z), d = this._w.set(x, y, z).sub(o), L = d.length(); if (L > 45) return false;
    const ray = GUN.ray; ray.set(o, d.divideScalar(L)); ray.near = 0.3; ray.far = L - 0.3;
    return ray.intersectObjects(W.worldMeshes.concat(R && R.mesh ? [R.mesh] : []), false).length === 0;
  },
  learn(C, how) {
    if (C.known) return;
    C.known = true;
    const what = C.kind === 'kill' ? (C.who || 'jemanden') + ' ' + (C.how || 'umgebracht') : C.kind === 'wound' ? 'auf ' + (C.who || 'jemanden') + ' geschossen' : 'herumgeschossen';
    this.remember('Der Fremde hat ' + (C.room ? PLACEMAP.words('in ' + (PLACEMAP.ROOMS.find((r) => r[0] === C.room) || [0, 0, 'der Stadt'])[2]) : 'auf der Straße') + ' ' + what + ' (' + TIME.stamp(C.t) + '). ' + how + '.');
    if (C.kind !== 'shots') this.wanted = Math.max(this.wanted, C.kind === 'kill' ? 1 : 0.8);
    this.att = Math.max(-1, this.att - (C.kind === 'kill' ? 0.8 : C.kind === 'wound' ? 0.5 : 0.15));
  },
  init(scene) {
    const R = this.R = ROOMS.find((r) => r.type === 'sheriff' && !r.parent); if (!R) return;
    const s = this.SPOTS.desk, p = rwp(R, s[0], R.floorY, s[1]), L = this.LOOKS;
    const N = this.npc = new NPC({ id: 'sheriff', name: L.name, room: R, scene, pos: p, yaw: this.yawFor(0), desc: L.desc, attitude: () => this.att });
    N.role = 'Sheriff ' + L.name + ', der Sheriff von Dust Creek (' + L.age + ')';
    N.runSpeed = RUN * 1.1;   // (he runs you down: faster than you)
    N.poseFx = (P, dt) => this.grabPose(P, dt);
    N.voiceProfile = L.voice; N.voiceKey = 'sheriff';
    N.fight = new Brawler(N, { courage: 0.95, power: 1.2, skill: 0.8, toughness: 1.7 });
    N.gun = new Gunman(N, { kind: 'revolver', skill: 0.85, courage: 0.95, onWord: (k) => this.say(k === 'warn' ? 'warnGun' : 'warnGun2') });
    N.held = () => N.gun.held();
    N.onHarm = (info) => this.onHarm(info);
    N.gossip = { facts: () => this.mem.filter((m) => /Fremde/.test(m) && !/hat dir erzählt/.test(m)), hear: (from, f) => { this.remember(GOSSIP.told(from, f)); if (/Fremde.*(umgebracht|erschossen)/.test(f)) this.wanted = Math.max(this.wanted, 0.9); } };
    N.persona = this.persona();
    // giving yourself up while he arrests you (he moves about: checked like the bar counters)
    const it = { x: p.x, y: R.floorY, z: p.z, room: null, occ: null, verb: 'surrender', kind: 'surrender', id: 'sheriff', fx: 0, fz: 1, sx: p.x, sz: p.z };
    it.score = (q) => { if (this.st !== 'arrest' || N.hp.dead || N.hp.busy() || PHP.out) return 1e9; const d = Math.hypot(N.pos.x - q.x, N.pos.z - q.z); if (d > 8 || !this.inSight()) return 1e9; it.room = N.room || null; it.x = it.sx = N.pos.x; it.z = it.sz = N.pos.z; it.y = N.pos.y; return d * 0.2; };
    it.actions = () => [{ label: 'Ergeben', run: () => this.surrender() }];
    INTERACT.wide.push(it);
    onWorldEvent((e) => this.event(e));
    WORLDSIM.before((m, soft) => this.beforeSkip(m, soft));
  },
  yawFor(a) { const R = this.R, A = rwp(R, 0, 0, 0), B = rwp(R, Math.sin(a), 0, Math.cos(a)); return Math.atan2(B.x - A.x, B.z - A.z); },
  spot(name) { const s = this.SPOTS[name], p = rwp(this.R, s[0], this.R.floorY, s[1]); return { x: p.x, z: p.z, yaw: this.yawFor(s[2]) }; },
  // what happens in town reaches him: crimes (what you did) and the noise (shots bring him out)
  event(e) {
    const N = this.npc; if (!N) return;
    if (e.by === 'player') {
      if (e.type === 'shot') this.crime('shots', e);
      else if (e.type === 'npcShot') { const V = NPCS.list.find((n) => n.id === e.npc); if (V && V !== N) this.crime(e.dead ? 'kill' : 'wound', e, V.name, 'erschossen'); }
      else if (e.type === 'npcDead') { const V = NPCS.list.find((n) => n.id === e.npc); if (V && V !== N) this.crime('kill', e, V.name, e.how); }
    }
    if ((e.type === 'shot' || e.type === 'npcShot2') && e.by !== 'sheriff' && !N.hp.dead && !N.hp.busy()) {
      if (this.st === 'office' || this.st === 'back') this.alarm = { x: e.x, z: e.z, room: e.room || null, t: G.time + 2 + Math.random() * 2 };
      else if (this.st === 'respond' && this.job) { this.job.x = e.x; this.job.z = e.z; }
    }
  },
  // someone comes running: a killing / a shooting at a place (PLACEMAP), the stranger did it or not known
  report(by, place, what, known) {
    const N = this.npc; if (!N || N.hp.dead) return false;
    this.remember(by + ' hat dir gemeldet: ' + what + ' (' + TIME.stamp() + ').');
    if (known) { for (const C of this.CRIMES) if (TIME.min - C.t < 240 && C.kind !== 'shots') this.learn(C, by + ' hat es gesehen'); }
    if (this.st === 'office' || this.st === 'back') this.go(place.x, place.z, place.R || null, true);
    return true;
  },
  go(x, z, R, urgent) {
    const N = this.npc;
    this.st = 'respond'; this.t = 0; this.job = { x, z, R, t: 0 };
    N.hurry = urgent ? 2.1 : 1.4; N.free(0); N.free(1); N.leanT = 0;
    N.gun.draw();
    N.walkTo(x, z);
    if (N.canBeHeard()) this.say('out');
  },
  onHarm(info) {
    const N = this.npc;
    if (info.type === 'dead') { this.st = 'dead'; N.gun.drop(); return; }
    if (info.type === 'shot' && info.zone !== 'hat') { this.wanted = 1; this.att = -1; this.remember('Der Fremde hat auf dich geschossen (' + TIME.stamp() + ').'); N.gun.draw(); N.gun.provoked = G.time; if (this.st === 'office' || this.st === 'back') this.st = 'arrest'; }
    // a fist in his face: no brawl with the law, a boot in your chest, and then he is on top of you
    if (info.type === 'blow') { this.wanted = Math.max(this.wanted, 0.6); this.assault = true; this.remember('Der Fremde hat dich geschlagen (' + TIME.stamp() + ').'); if (!this.grab) this.kickQ = G.time; }
  },
  // the crimes he could learn of at the scene: what the people there saw
  ask() {
    let learned = null;
    for (const C of this.CRIMES) {
      if (C.known || !C.seen || TIME.min - C.t > 720) continue;
      if (Math.hypot(C.x - this.npc.pos.x, C.z - this.npc.pos.z) > 25) continue;
      this.learn(C, 'Zeugen haben es dir erzählt'); learned = C;
    }
    return learned;
  },
  inSight() { const N = this.npc; return !PHP.out && Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z) < 30 && N.gun.sees(); },
  /* ---- every frame ---- */
  update(dt) {
    const N = this.npc; if (!N) return;
    if (N.hp.dead) { this.st = 'dead'; return; }
    this.t += dt;
    if (N.hp.busy()) { if (this.grab) this.endGrab(); return; }
    if (this.grab) { this.updGrab(dt); return; }
    if (this.kickQ) { if (G.time - this.kickQ > 2.5 || PHP.out) this.kickQ = 0; else if (!N.hitFrom || G.time > N.hitFrom.until - 0.3) { this.kickQ = 0; this.startKick(); return; } }
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (this.st === 'fight') { const r = N.fight.update(dt); if (r) { this.st = this.wanted >= 0.6 ? 'arrest' : 'back'; this.t = 0; } return; }
    // wanted and he sees you, anywhere in town: he comes for you
    if (this.wanted >= 0.6 && (this.st === 'office' || this.st === 'back' || this.st === 'scene' || this.st === 'respond') && this.inSight() && dP < 25) { this.st = 'arrest'; this.t = 0; this.arrT = 0; this.reacted = true; N.gun.draw(); this.react('arrest', 'Du hast den Fremden gefunden, den du verhaften willst: ' + (this.mem.slice(-1)[0] || '') + ' Du richtest den Revolver auf ihn.'); }
    if (this.alarm && G.time > this.alarm.t) { const A = this.alarm; this.alarm = null; const R = A.room ? ROOMS.find((r) => r.type === A.room && !r.parent) : null; this.go(A.x, A.z, R, true); }
    if (this.st === 'office') return this.office(dt);
    if (this.st === 'respond') {
      // on the way (gun in hand, ready); there, or he sees you with a gun: the scene
      if (N.gun.on && N.gun.st !== 'draw') N.gun.update(dt); else if (N.gun.on) N.gun.update(dt);
      const J = this.job, d = Math.hypot(J.x - N.pos.x, J.z - N.pos.z);
      if (!N.walking() && d > 2.5 && this.t < 60) N.walkTo(J.x, J.z);
      if (d < 3 || (this.t > 3 && N.room && N.room === (J.R || N.room) && J.R) || this.t > 70) { this.st = 'scene'; this.t = 0; N.stop(); }
      return;
    }
    if (this.st === 'scene') {
      N.gun.update(dt);
      // a body: he goes down by it a moment
      if (!this.checked) { const V = NPCS.list.find((n) => n !== N && n.hp.dead && !n.sheriffSaw && (n.room || null) === (N.room || null) && Math.hypot(n.pos.x - N.pos.x, n.pos.z - N.pos.z) < 10); if (V) { V.sheriffSaw = true; this.checked = true; this.remember(V.name + ' lag tot da, als du kamst (' + TIME.stamp() + ').'); setTimeout(() => this.say('dead'), 600); } }
      if (this.t > 2 && !this.asked) {
        this.asked = true; this.ask();
        // nobody saw it, but you are the one standing where the shooting was, a moment ago
        for (const C of this.CRIMES) if (!C.known && TIME.min - C.t < 20 && Math.hypot(C.x - PLAY.pos.x, C.z - PLAY.pos.z) < 10 && this.inSight()) this.learn(C, 'Du hast ihn genau da angetroffen, wo eben geschossen wurde');
      }
      const here = this.inSight() && dP < 20;
      // the witnesses told him, and you are gone: they show him which way, and he goes after you
      if (!here && this.wanted >= 0.6 && this.asked && this.t > 4 && this.huntFor !== this.wanted + ':' + this.mem.length) { this.huntFor = this.wanted + ':' + this.mem.length; this.st = 'arrest'; this.t = 0; this.arrT = 0; this.seenAt = null; this.say('hunt'); return; }
      if (here && this.wanted >= 0.6) { this.st = 'arrest'; this.t = 0; this.arrT = 0; this.reacted = true; this.react('arrest', 'Du stehst vor dem Fremden. ' + (this.mem.slice(-1)[0] || '') + ' Du richtest den Revolver auf ihn und verhaftest ihn.'); return; }
      // only shooting: a word (the first time), a fine (after that)
      if (here && this.t > 2.5 && !this.spoke) {
        this.spoke = true;
        const shots = this.CRIMES.filter((c) => c.kind === 'shots' && c.known && TIME.min - c.t < 120).length || (this.CRIMES.some((c) => c.kind === 'shots' && TIME.min - c.t < 30 && c.seen) ? 1 : 0);
        if (shots) {
          if (!this.warned) { this.warned = 1; this.remember('Du hast den Fremden verwarnt, weil er herumgeschossen hat (' + TIME.stamp() + ').'); this.react('warn', 'Der Fremde hat in der Stadt herumgeschossen, verletzt wurde keiner. Du verwarnst ihn, beim nächsten Mal kostet es.'); }
          else { const f = Math.min(INV.money, 200); INV.money -= f; this.fined++; this.remember('Du hast dem Fremden ' + money(f) + ' Strafe abgenommen, weil er wieder herumgeschossen hat (' + TIME.stamp() + ').'); if (f) TOAST.show('Strafe: ' + money(f), 'money'); this.react('fine', 'Der Fremde hat schon wieder herumgeschossen. Du nimmst ihm ' + money(f) + ' Strafe ab.', money(f)); }
        }
      }
      if (this.t > 25) this.goBack();
      return;
    }
    if (this.st === 'arrest') return this.arrest(dt, dP);
    if (this.st === 'back') {
      if (!N.walking()) { if (N.room === this.R) { this.st = 'office'; this.t = 0; N.gun.holster(); this.act = 'desk'; this.actT = 0; } else { const s = this.spot('desk'); N.walkTo(s.x, s.z, s.yaw); } }
      if (N.gun.on) N.gun.update(dt);
    }
  },
  goBack() { const N = this.npc, s = this.spot('desk'); N.gun.cover = false; this.st = 'back'; this.t = 0; this.checked = this.asked = this.spoke = false; N.hurry = 1; N.walkTo(s.x, s.z, s.yaw); },
  /* gun on you: put yours away and stay (or give up: E "Ergeben", or say it), and you are his; draw or shoot, and
     he fires (Gunman). He walks up to you with the gun on you; run, and he runs after you: "stop!", and a killer who
     keeps running is shot at. Out of sight he goes to where he saw you last, then follows your trail (the noise,
     people pointing); after long enough without you he gives up for now (but does not forget: wanted) */
  arrest(dt, dP) {
    const N = this.npc, see = this.inSight(), P = PLAY.pos, run = Math.hypot(PLAY.vx, PLAY.vz);
    if (!this.arrT) { this.arrT = 0; this.giveT = 0; this.lostT = 0; this.fleeT = 0; this.haltN = 0; this.chaseT = 0; this.huntT = 0; this.saidRun = false; this.saidA = this.reacted; this.reacted = false; }
    this.arrT += dt;
    if (see) { this.seenAt = { x: P.x, z: P.z, t: G.time }; this.lostT = 0; } else this.lostT += dt;
    const calm = see && GUN.state === 'holster' && !GUN.reloadThenHolster && run < 1.2;
    // nothing worse than shots or a wound and you run after his "stop!": he puts the gun up and runs you down
    const runDown = this.haltN >= 1 && this.wanted < 1 && G.time - (this.haltT || -99) > 0.8;
    // his legs: up to you (to 3 m), or after you
    let moving = false;
    this.chaseT -= dt;
    if (see) {
      if (runDown) {
        if (dP < 1.6 && run < 1) { if (N.walking()) N.stop(); }
        else { moving = true; if (!N.walking() || this.chaseT <= 0) { this.chaseT = 0.25; N.hurry = 2.4; N.walkTo(P.x + PLAY.vx * 0.3, P.z + PLAY.vz * 0.3); } }
        if (!this.saidRun) { this.saidRun = true; this.say('runDown'); }
        // close enough and you are still going: the dive
        if (dP < 2.3 && run > 1.0 && !FALL.busy()) { this.startTackle(); return; }
      } else if (dP > 3.2) { moving = true; if (!N.walking() || this.chaseT <= 0) { this.chaseT = 0.5; N.hurry = calm && dP < 10 ? 1.3 : 2.2; N.walkTo(P.x, P.z); } }
      else if (N.walking()) N.stop();
    } else {
      moving = true;
      if (!N.walking() || this.chaseT <= 0) {
        this.chaseT = 2; N.hurry = 2.1;
        const S = this.seenAt;
        if (S && Math.hypot(S.x - N.pos.x, S.z - N.pos.z) > 1.5 && G.time - S.t < 12) N.walkTo(S.x, S.z);
        else if (dP < 60) N.walkTo(P.x, P.z);   // (your trail)
      }
      if ((this.huntT -= dt) <= 0) { this.huntT = 14 + Math.random() * 8; if (this.lostT > 3) this.say('hunt'); }
    }
    if (runDown) this.stowGun(); else { N.gun.draw(); N.gun.cover = true; N.gun.update(dt, moving); }
    if (see && !this.saidA) { this.saidA = true; if (!TALK.remarking) this.say('arrest'); }
    if (see && dP < 14 && !this.told) { this.told = true; TOAST.show('Der Sheriff verhaftet dich: Waffe weg und stehen bleiben, oder E „Ergeben“.', 'long'); }
    // giving up: gun away, standing, near him (or you said so: giveT set)
    this.giveT = calm && dP < 4.5 ? this.giveT + dt : this.giveT >= 50 ? this.giveT : Math.max(0, this.giveT - dt * 0.5);
    if (this.giveT > 3 && !PHP.out) { this.say('come'); this.lockUp(); return; }
    // running from him: "stop!" twice; a killer who keeps running is shot at
    this.fleeT = see && run > 2.6 && dP > 3.5 ? this.fleeT + dt : Math.max(0, this.fleeT - dt);
    if (this.fleeT > 0.6 && G.time - (this.haltT || -99) > 3.5 && this.haltN < (this.wanted >= 1 ? 2 : 1)) { this.haltT = G.time; this.haltN++; this.say(this.haltN === 1 ? 'halt' : 'halt2'); }
    if (this.haltN >= 2 && G.time - this.haltT > 1.5 && this.fleeT > 0.6 && this.wanted >= 1 && see) N.gun.provoked = G.time;
    // you are down by his bullet: he takes you in all the same (the doc patches you up in the cell)
    if (PHP.out && PHP.out.by === N) {
      const crime = this.CRIMES.filter((c) => c.known && c.kind !== 'shots').slice(-1)[0];
      if (this.wanted >= 0.6) { PHP.out.jail = true; PHP.out.why = crime ? crime.kind : 'wound'; this.jailed = (this.jailed || 0) + 1; this.remember('Du hast den Fremden niedergeschossen und eingesperrt (' + TIME.stamp() + ').'); this.wanted = crime && crime.kind === 'kill' ? 0.4 : 0; }
      else { this.remember('Du hast den Fremden niedergeschossen (' + TIME.stamp() + ').'); this.wanted = 0.3; }
      this.arrT = 0; this.told = false; this.goBack(); return;
    }
    // you stopped and put the gun away: no shooting at a man who gives up
    if (calm && this.fleeT <= 0 && G.time - GUNMAN.lastShot > 3) N.gun.provoked = null;
    if (this.lostT > 45 || dP > 90) { this.remember('Der Fremde ist dir entkommen (' + TIME.stamp() + ').'); if (N.canBeHeard()) this.say('escaped'); this.arrT = 0; this.lostT = 0; this.told = false; this.goBack(); }
  },
  /* ---- hands on you ----
     kick: a push kick from the chest (chamber, out, back) when you hit him; you go down on your back, he is on you.
     dive: running you down, a flying tackle from two metres; you go down on your face under him.
     Then he kneels on you, a hand on your back, the other on your arm, and after a moment you are his. */
  grab: null,
  stowGun() { const g = this.npc.gun; if (g.on) { if (g.m) g.m.visible = false; g.st = 'off'; GSFX.run(() => GSFX.holster()); } g.cover = false; },
  startKick() {
    const N = this.npc; if (this.grab || N.hp.busy() || PHP.out || N.hp.dead) return;
    this.stowGun(); if (N.fight.on) N.fight.stop(); N.free(0); N.free(1);
    this.grab = { ph: 'kick', t: 0, hit: false, why: 'assault' }; this.st = 'arrest'; this.arrT = 0.01;
    N.stop(Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z));
    this.say('kick');
  },
  startTackle() {
    const N = this.npc; if (this.grab || N.hp.busy() || PHP.out) return;
    this.stowGun(); N.free(0); N.free(1);
    const lead = 0.35, tx = PLAY.pos.x + PLAY.vx * lead - N.pos.x, tz = PLAY.pos.z + PLAY.vz * lead - N.pos.z, d = Math.hypot(tx, tz) || 1;
    this.grab = { ph: 'dive', t: 0, hit: false, dx: tx / d, dz: tz / d, why: null };
    N.stop(); N.yaw = N.faceYaw = Math.atan2(tx, tz); N.solid = false; N.vx = N.vz = 0;
    this.say('tackle');
  },
  endGrab() { const N = this.npc; this.grab = null; N.solid = true; N.crouchT = 0; N.leanT = 0; N.free(0); N.free(1); },
  // the boot lands: you fly back and go down (and stay down, he is coming)
  kickHit(dx, dz) {
    const N = this.npc;
    PHP.hit({ power: 1.1, heavy: true, dir: { x: dx, z: dz }, by: N });
    if (PHP.out) return;
    if (!FALL.busy()) FALL.start(true, 'back', Math.atan2(dx, dz)); else FALL.keep = true;
    PLAY.vx += dx * 3.2; PLAY.vz += dz * 3.2;
    FOLEY.kick(PLAY.pos, true); FOLEY.grunt(N.pos, N.voiceProfile ? N.voiceProfile.pitch : 1, 1.2);
    G.hitStop = Math.max(G.hitStop || 0, 0.1); PLAY.camShake = Math.max(PLAY.camShake, 0.16);
    worldEvent('npcPunch', PLAY.pos.x, PLAY.pos.y + 1, PLAY.pos.z, { by: N.id, kick: true });
  },
  // the tackle lands: both of you go down, you on your face
  tackleHit() {
    const N = this.npc, G0 = this.grab;
    if (!FALL.busy()) FALL.start(true, 'fwd', Math.atan2(G0.dx, G0.dz)); else FALL.keep = true;
    PLAY.vx = G0.dx * 2.5; PLAY.vz = G0.dz * 2.5;
    FOLEY.bodyFall(PLAY.pos, 1.1); FOLEY.grunt(PLAY.pos, 1, 1.1); FOLEY.grunt(N.pos, N.voiceProfile ? N.voiceProfile.pitch : 1, 1);
    PLAY.camShake = Math.max(PLAY.camShake, 0.2); G.hitStop = Math.max(G.hitStop || 0, 0.08);
    PHP.hit({ power: 0.35, chip: true, dir: { x: G0.dx, z: G0.dz }, by: N });
    worldEvent('npcPunch', PLAY.pos.x, PLAY.pos.y + 0.5, PLAY.pos.z, { by: N.id, tackle: true });
  },
  // where to kneel: beside your chest, on his side of you
  pinSpot() {
    const N = this.npc; W.ch.root.updateMatrixWorld(true);
    const e = W.ch.p.torso.matrixWorld.elements; let tx = e[12], tz = e[14];
    if (Math.hypot(tx - PLAY.pos.x, tz - PLAY.pos.z) > 2) { tx = PLAY.pos.x; tz = PLAY.pos.z; }   // (not posed yet)
    let ax = N.pos.x - tx, az = N.pos.z - tz; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
    return { x: tx + ax * 0.5, z: tz + az * 0.5, tx, tz };
  },
  updGrab(dt) {
    const N = this.npc, G0 = this.grab, P = PLAY.pos; G0.t += dt;
    const dx = P.x - N.pos.x, dz = P.z - N.pos.z, d = Math.hypot(dx, dz) || 1;
    if (PHP.out && G0.ph !== 'pin') { this.endGrab(); return; }
    if (G0.ph === 'kick') {
      if (G0.t < 0.24) N.stop(Math.atan2(dx, dz));
      N.reach(0, 0.18, 1.35, 0.28); N.reach(1, -0.22, 1.25, 0.12); N.handShape[0] = N.handShape[1] = { fist: 0.9 };
      if (!G0.hit && G0.t > 0.3 && G0.t < 0.44) {
        const f = (dx * Math.sin(N.yaw) + dz * Math.cos(N.yaw)) / d;
        if (d < 1.6 && f > 0.55 && !FALL.busy() && !SIT.busy()) { G0.hit = true; this.kickHit(dx / d, dz / d); }
      }
      if (G0.t > 0.85) {
        if (G0.hit && FALL.busy() && !PHP.out) { G0.ph = 'pounce'; G0.t = 0; N.free(0); N.free(1); }
        else { this.endGrab(); this.st = 'arrest'; this.arrT = 0; }
      }
      return;
    }
    if (G0.ph === 'pounce') {
      // a few quick steps to you, then the jump
      const S = this.pinSpot(), sd = Math.hypot(S.x - N.pos.x, S.z - N.pos.z);
      if (sd > 1.5 && G0.t < 4) { N.hurry = 2.4; if (!N.walking() || (G0.wt = (G0.wt || 0) - dt) <= 0) { G0.wt = 0.3; N.walkTo(S.x, S.z); } return; }
      N.stop(); N.solid = false; G0.ph = 'leap'; G0.t = 0; G0.from = [N.pos.x, N.pos.z]; G0.to = [S.x, S.z]; N.yaw = N.faceYaw = Math.atan2(S.tx - N.pos.x, S.tz - N.pos.z);
      return;
    }
    if (G0.ph === 'leap') {
      const u = clamp(G0.t / 0.34, 0, 1), e = u * u * (3 - 2 * u);
      N.pos.x = lerp(G0.from[0], G0.to[0], e); N.pos.z = lerp(G0.from[1], G0.to[1], e); N.vx = N.vz = 0;
      N.reach(0, 0.25, 0.9, 0.6); N.reach(1, -0.25, 0.9, 0.6);
      if (u >= 1) { G0.ph = 'pin'; G0.t = 0; FOLEY.bodyFall(N.pos, 0.8); FOLEY.grunt(P, 1, 1); PLAY.camShake = Math.max(PLAY.camShake, 0.12); }
      return;
    }
    if (G0.ph === 'dive') {
      // through the air at you: fast, low, arms out
      const v = G0.t < 0.36 ? 8.6 : 2.5 * Math.max(0, 1 - (G0.t - 0.36) / 0.25);
      const nx = N.pos.x + G0.dx * v * dt, nz = N.pos.z + G0.dz * v * dt; const [cx, cz] = collide(nx, nz, N.pos.y + 0.1, N.body, 0.28); N.pos.x = cx; N.pos.z = cz; N.vx = N.vz = 0;
      N.reach(0, 0.22, 0.95, 0.75); N.reach(1, -0.22, 0.95, 0.75); N.handShape[0] = N.handShape[1] = { open: 0.8 };
      if (!G0.hit && d < 1.35 && G0.t < 0.5 && !FALL.busy()) { G0.hit = true; this.tackleHit(); }
      if (G0.t > 0.62) {
        if (G0.hit && FALL.busy() && !PHP.out) { const S = this.pinSpot(); G0.ph = 'leap'; G0.t = 0.2; G0.from = [N.pos.x, N.pos.z]; G0.to = [S.x, S.z]; N.yaw = N.faceYaw = Math.atan2(S.tx - N.pos.x, S.tz - N.pos.z); }
        else { this.endGrab(); this.st = 'arrest'; this.arrT = 0; }   // (missed: up again and after you)
      }
      return;
    }
    if (G0.ph === 'pin') {
      // knee down by you, a hand on your back, the other on your arm
      const S = this.pinSpot(); N.stop(); N.crouchT = 1; N.leanT = 0.7; N.vx = N.vz = 0;
      N.pos.x += (S.x - N.pos.x) * Math.min(1, dt * 6); N.pos.z += (S.z - N.pos.z) * Math.min(1, dt * 6);
      N.yaw += wrapA(Math.atan2(S.tx - N.pos.x, S.tz - N.pos.z) - N.yaw) * Math.min(1, dt * 8); N.faceYaw = N.yaw;
      const b = this._v.set(S.tx, PLAY.pos.y + 0.28, S.tz), lb = N.toLocal(b, this._w);
      N.reach(0, lb.x + 0.12, lb.y + 0.02, Math.max(0.3, lb.z)); N.reach(1, lb.x - 0.14, lb.y, Math.max(0.3, lb.z - 0.05)); N.handShape[0] = N.handShape[1] = { open: 0.7 };
      N.lookAt(b, 1);
      if (G0.t > 0.45 && !G0.said) { G0.said = true; this.say(G0.why === 'assault' ? 'pin' : 'pinFace'); }
      if (G0.t > 3.2 && !PHP.out) { const blow = G0.why === 'assault'; this.say(blow ? 'cuffsBlow' : 'cuffs'); this.lockUp(blow ? 'assault' : null); }
      if (G0.t > 3.4 || PHP.out) { if (G0.t > 6 || (PHP.out && PHP.out.t > 3)) this.endGrab(); }
      return;
    }
  },
  /* his body for the grab (char/rig pose, character space: +z ahead, +x his left), after the gait */
  grabPose(P, dt) {
    const G0 = this.grab; if (!G0) return;
    const sm = (a, b, x) => smoothstep(a, b, x), t = G0.t;
    if (G0.ph === 'kick') {
      // the right boot: knee up (chamber), driven out at chest height, back down
      const up = t < 0.5 ? sm(0, 0.24, t) : 1 - sm(0.5, 0.82, t), out = sm(0.22, 0.34, t) * (1 - sm(0.46, 0.66, t));
      const a = P.ank[1], cx = -0.1, cy = lerp(0.5, 0.98, out), cz = lerp(0.28, 0.82, out);
      a.x = lerp(a.x, cx, up); a.y = lerp(a.y, cy, up); a.z = lerp(a.z, cz, up);
      P.ftPitch[1] = lerp(P.ftPitch[1], -0.5, out);
      P.spPitch -= 0.4 * up + 0.15 * out; P.pel.z -= 0.1 * up; P.pelPitch -= 0.12 * up; P.hdPitch += 0.25 * up;
      P.ank[0].z -= 0.06 * up;
    } else if (G0.ph === 'dive') {
      // flat out through the air, then down on the ground
      const k = sm(0, 0.2, t), land = sm(0.36, 0.55, t);
      P.pel.y = lerp(P.pel.y, lerp(0.75, 0.35, land), k); P.pelPitch += lerp(1.25, 1.35, land) * k; P.spPitch += 0.2 * k; P.hdPitch -= 0.9 * k;
      for (let i = 0; i < 2; i++) { const a = P.ank[i]; a.x = lerp(a.x, i === 0 ? 0.14 : -0.12, k); a.y = lerp(a.y, lerp(0.55, 0.15, land) + i * 0.08, k); a.z = lerp(a.z, -0.75 - i * 0.1, k); }
    } else if (G0.ph === 'leap') {
      // a short jump onto you: off the ground, landing low
      const u = clamp(t / 0.34, 0, 1);
      P.pel.y += Math.sin(u * Math.PI) * 0.22; P.pelPitch += 0.55 * Math.sin(u * Math.PI * 0.5); P.spPitch += 0.4;
    } else if (G0.ph === 'pin') {
      P.spPitch += 0.25; P.hdPitch += 0.35;
    }
  },
  // you give up (E "Ergeben", or you said so): your gun goes away, he takes you
  surrender() {
    if (this.st !== 'arrest' || PHP.out) return false;
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; }
    this.giveT = 50; return true;
  },
  giveUp(t) { return /ergeb|ich komm(e)? mit|nicht schießen|schieß nicht|hände hoch|ich geb(e)? auf|verhafte mich|bin unbewaffnet/i.test(t); },
  // the cell: dark, and you wake up there in the morning, the fine taken
  lockUp(why) {
    const N = this.npc;
    this.arrT = 0; this.told = false; this.goBack();
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; }
    const crime = this.CRIMES.filter((c) => c.known && c.kind !== 'shots').slice(-1)[0];
    this.jailed = (this.jailed || 0) + 1;
    PHP.out = { t: 0, by: N, jail: true, why: crime ? crime.kind : why || (this.assault ? 'assault' : 'shots') };
    this.assault = false;
    this.remember('Du hast den Fremden verhaftet und eine Nacht eingesperrt (' + TIME.stamp() + ').');
    this.wanted = crime && crime.kind === 'kill' ? 0.4 : 0;   // (a killing: he keeps an eye on you)
  },
  // where you wake up after the night in the cell
  jailSpot() { const s = this.spot('cell'); return { p: new THREE.Vector3(s.x, this.R.floorY, s.z), yaw: s.yaw }; },
  office(dt) {
    const N = this.npc;
    if (N.gun.on) N.gun.update(dt);
    this.actT -= dt;
    if (this.actT <= 0) { const r = Math.random(); this.act = r < 0.55 ? 'desk' : r < 0.8 ? 'window' : 'rack'; this.actT = 10 + Math.random() * 14; const s = this.spot(this.act); N.walkTo(s.x, s.z, s.yaw); }
    if (!N.walking()) {
      const t = G.time;
      if (this.act === 'desk') { N.leanT = 0.3; N.reach(1, -0.05 + Math.sin(t * 1.3) * 0.05, 0.95, 0.5); N.free(0); }
      else if (this.act === 'rack') { N.reach(1, -0.1, 1.3, 0.45); N.free(0); }
      else { N.leanT = 0; N.free(0); N.free(1); }
    }
    if (G.room === this.R && Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z) < 6) {
      N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1);
      if (!this.greeted) { this.greeted = true; setTimeout(() => this.say('hello'), 700); }
    } else if (G.room !== this.R) this.greeted = false;
  },
  beforeSkip(m, soft) {
    if (soft || m < 20 || !this.npc || this.npc.hp.dead) return;
    if (this.npc.fight.on) this.npc.fight.stop();
    if (this.grab) this.endGrab();
    if (this.st !== 'office') { this.npc.gun.drop(); this.npc.gun.cover = false; this.arrT = 0; this.told = false; const s = this.spot('desk'); this.npc.stop(); this.npc.pos.set(s.x, this.R.floorY, s.z); this.npc.room = this.R; this.st = 'office'; }
  },
  settled() { return !this.npc || this.npc.hp.dead || this.st === 'office'; },
  persona() {
    const S = this;
    return {
      actions: ['none', 'take_in', 'nod', 'shake_head', 'point_door', 'point_you', 'fist_shake', 'calm_down', 'cross_arms', 'shrug'],
      rules: ['Du bist Sheriff ' + S.LOOKS.name + ', der Sheriff von Dust Creek (Arizona-Territorium, 1885): ' + S.LOOKS.age + '. Ruhig, gerecht, unbestechlich, hart, wenn es sein muss. Du duzt jeden.',
        'In deiner Stadt wird nicht geschossen. Wer jemanden anschießt oder umbringt, kommt in deine Zelle oder vor den Richter. Du kennst Hank, Walt und Jeb vom Saloon und Doc Whitfield gut.',
        'Ergibt sich der Fremde, während du ihn verhaftest (er sagt es oder kommt mit), wähle die Aktion take_in.',
        'Kerniges, einfaches Deutsch, höchstens zwei kurze Sätze unter 25 Wörtern, es wird laut vorgelesen. Kein Markdown, keine Sternchen. Von der modernen Welt weißt du nichts.'].join('\n'),
      context() {
        const out = ['Es ist ' + TIME.words() + ', ' + TIME.str() + ' Uhr.'];
        out.push(S.st === 'arrest' ? 'Du verhaftest den Fremden gerade, dein Revolver ist auf ihn gerichtet.' : S.st === 'scene' || S.st === 'respond' ? 'Du bist wegen Schüssen ausgerückt.' : 'Du bist in deinem Büro.');
        if (GUN.state !== 'holster' && !GUN.reloadThenHolster) out.push('Der Fremde hat seine Waffe in der Hand.');
        out.push('Was du über den Fremden weißt: ' + (S.wanted >= 0.6 ? 'du willst ihn verhaften. ' : S.wanted > 0 ? 'du traust ihm nicht. ' : '') + (S.mem.slice(-5).join(' ') || 'nichts Besonderes.'));
        const body = S.npc.hp.describe(); if (body) out.push('Dein Körper: ' + body + '.');
        return out.join('\n');
      },
      quick(text) { return S.st === 'arrest' && S.giveUp(text) ? { say: 'Vernünftig. Hände hoch und mitkommen.', action: 'take_in', mood: 'neutral' } : null; },
      offline(text) { const t = text.toLowerCase(); return S.st === 'arrest' && (S.giveUp(t) || /ok|gut|ja/.test(t)) ? { say: 'Vernünftig. Waffe weg und mitkommen.', action: 'take_in' } : /hilfe|mord|tot|geschossen/.test(t) ? { say: 'Wo? Zeig’s mir.', action: 'nod' } : { say: ['Hm.', 'Ich hör zu.', 'Mach keinen Ärger.'][Math.floor(Math.random() * 3)], action: 'none' }; },
      act(action) { if (action === 'take_in') { S.surrender(); return; } if (GESTURE.AI.includes(action)) S.npc.gesture(action, action === 'point_door' ? null : null); },
      forget() { S.mem = []; S.att = 0; S.wanted = 0; S.warned = 0; },
      memory() { return { events: S.mem.slice(), inPrompt: 5, facts: [['Gesucht', S.wanted.toFixed(2)], ['Haltung zu dir', S.att.toFixed(2)]] }; },
      forgetEvent(i) { S.mem.splice(i, 1); }
    };
  }
};
SAVE.part('sheriff', () => ({ mem: SHERIFF.mem.slice(-10), att: +SHERIFF.att.toFixed(3), wanted: +SHERIFF.wanted.toFixed(2), warned: SHERIFF.warned, fined: SHERIFF.fined, jailed: SHERIFF.jailed || 0, crimes: SHERIFF.CRIMES.slice(-12), body: SHERIFF.npc ? SHERIFF.npc.hp.save() : null }), (d) => {
  if (!d) return;
  SHERIFF.mem = Array.isArray(d.mem) ? d.mem.filter((x) => typeof x === 'string').slice(-10) : [];
  SHERIFF.att = clamp(+d.att || 0, -1, 1); SHERIFF.wanted = clamp(+d.wanted || 0, 0, 1); SHERIFF.warned = d.warned | 0; SHERIFF.fined = d.fined | 0; SHERIFF.jailed = d.jailed | 0;
  SHERIFF.CRIMES = Array.isArray(d.crimes) ? d.crimes.filter((c) => c && typeof c.kind === 'string').slice(-12) : [];
  if (d.body && SHERIFF.npc) { SHERIFF.npc.hp.load(d.body); if (SHERIFF.npc.hp.dead) SHERIFF.st = 'dead'; }
});
