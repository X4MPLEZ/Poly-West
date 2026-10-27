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
    calm: [['Na also. Geht doch.', 'neutral']]
  },
  bags: {},
  line(kind, f) { const L = this.LINES[kind], B = this.bags[kind] || (this.bags[kind] = []); if (!B.length) for (let i = 0; i < L.length; i++) B.splice(Math.floor(Math.random() * (B.length + 1)), 0, i); const x = L[B.pop()]; return { text: x[0].replace('{f}', f || ''), mood: x[1] }; },
  say(kind, f) { const N = this.npc; if (!N || !N.canBeHeard()) return false; const l = this.line(kind, f); SAY.hide(N); return N.speak(l.text, undefined, l.mood, true); },
  react(kind, situation, f) { if (!TALK.remark(this.npc, situation, () => this.say(kind, f), this.line(kind, f).mood, 1)) this.say(kind, f); },
  remember(t) { this.mem.push(t); if (this.mem.length > 10) this.mem.shift(); },
  CRIMES: [],   // { t (game min), kind: 'shots' | 'wound' | 'kill', who (victim name), x, z, room, seen (anyone saw it), known (he knows it) }
  crime(kind, e, victim) {
    const R = e.room ? ROOMS.find((r) => r.type === e.room && !r.parent) : roomAt(e.x, e.z, 0.05, (e.y || 0) + 0.1);
    let C = this.CRIMES.find((c) => c.kind === kind && c.who === (victim || null) && TIME.min - c.t < 20);
    if (!C) { C = { t: TIME.min, kind, who: victim || null, x: e.x, z: e.z, room: R ? R.type : null, seen: false, known: false }; this.CRIMES.push(C); if (this.CRIMES.length > 12) this.CRIMES.shift(); }
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
  WHAT: { shots: 'herumgeschossen', wound: 'auf jemanden geschossen', kill: 'jemanden umgebracht' },
  learn(C, how) {
    if (C.known) return;
    C.known = true;
    const what = C.kind === 'kill' ? (C.who || 'jemanden') + ' umgebracht' : C.kind === 'wound' ? 'auf ' + (C.who || 'jemanden') + ' geschossen' : 'herumgeschossen';
    this.remember('Der Fremde hat ' + (C.room ? PLACEMAP.words('in ' + (PLACEMAP.ROOMS.find((r) => r[0] === C.room) || [0, 0, 'der Stadt'])[2]) : 'auf der Straße') + ' ' + what + ' (' + TIME.stamp(C.t) + '). ' + how + '.');
    if (C.kind !== 'shots') this.wanted = Math.max(this.wanted, C.kind === 'kill' ? 1 : 0.8);
    this.att = Math.max(-1, this.att - (C.kind === 'kill' ? 0.8 : C.kind === 'wound' ? 0.5 : 0.15));
  },
  init(scene) {
    const R = this.R = ROOMS.find((r) => r.type === 'sheriff' && !r.parent); if (!R) return;
    const s = this.SPOTS.desk, p = rwp(R, s[0], R.floorY, s[1]), L = this.LOOKS;
    const N = this.npc = new NPC({ id: 'sheriff', name: L.name, room: R, scene, pos: p, yaw: this.yawFor(0), desc: L.desc, attitude: () => this.att });
    N.role = 'Sheriff ' + L.name + ', der Sheriff von Dust Creek (' + L.age + ')';
    N.voiceProfile = L.voice; N.voiceKey = 'sheriff';
    N.fight = new Brawler(N, { courage: 0.95, power: 1.2, skill: 0.8, toughness: 1.7 });
    N.gun = new Gunman(N, { kind: 'revolver', skill: 0.85, courage: 0.95, onWord: (k) => this.say(k === 'warn' ? 'warnGun' : 'warnGun2') });
    N.held = () => N.gun.held();
    N.onHarm = (info) => this.onHarm(info);
    N.gossip = { facts: () => this.mem.filter((m) => /Fremde/.test(m) && !/hat dir erzählt/.test(m)), hear: (from, f) => { this.remember(GOSSIP.told(from, f)); if (/Fremde.*(umgebracht|erschossen)/.test(f)) this.wanted = Math.max(this.wanted, 0.9); } };
    N.persona = this.persona();
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
      else if (e.type === 'npcShot') { const V = NPCS.list.find((n) => n.id === e.npc); if (V && V !== N) this.crime(e.dead ? 'kill' : 'wound', e, V.name); }
      else if (e.type === 'npcDead') { const V = NPCS.list.find((n) => n.id === e.npc); if (V && V !== N) this.crime('kill', e, V.name); }
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
    if (info.type === 'blow') { this.wanted = Math.max(this.wanted, 0.6); this.remember('Der Fremde hat dich geschlagen (' + TIME.stamp() + ').'); if (!N.fight.on && !N.gun.on) { this.st = 'fight'; N.fight.start(); } }
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
    if (N.hp.busy()) return;
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (this.st === 'fight') { const r = N.fight.update(dt); if (r) { this.st = this.wanted >= 0.6 ? 'arrest' : 'back'; this.t = 0; } return; }
    // wanted and he sees you, anywhere in town: he comes for you
    if (this.wanted >= 0.6 && (this.st === 'office' || this.st === 'back' || this.st === 'scene') && this.inSight() && dP < 25) { this.st = 'arrest'; this.t = 0; N.gun.draw(); this.react('arrest', 'Du hast den Fremden gefunden, den du verhaften willst: ' + (this.mem.slice(-1)[0] || '') + ' Du richtest den Revolver auf ihn.'); }
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
      if (here && this.wanted >= 0.6) { this.st = 'arrest'; this.t = 0; this.react('arrest', 'Du stehst vor dem Fremden. ' + (this.mem.slice(-1)[0] || '') + ' Du richtest den Revolver auf ihn und verhaftest ihn.'); return; }
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
  goBack() { const N = this.npc, s = this.spot('desk'); this.st = 'back'; this.t = 0; this.checked = this.asked = this.spoke = false; N.hurry = 1; N.walkTo(s.x, s.z, s.yaw); },
  // gun on you: put yours away and stay, and you are his; draw or shoot, and he fires (Gunman); run, and he lets you go for now
  arrest(dt, dP) {
    const N = this.npc;
    N.gun.draw(); N.gun.update(dt);
    if (!this.arrT) { this.arrT = 0; this.giveT = 0; }
    this.arrT += dt;
    if (this.arrT < 0.2 && N.canBeHeard()) this.say('arrest');
    const calm = GUN.state === 'holster' && !GUN.reloadThenHolster && Math.hypot(PLAY.vx, PLAY.vz) < 1.2 && dP < 9;
    this.giveT = calm ? this.giveT + dt : Math.max(0, this.giveT - dt * 0.5);
    if (dP > 3 && dP < 30 && this.inSight()) { if (!N.walking() || (this.chaseT = (this.chaseT || 0) - dt) <= 0) { this.chaseT = 1; N.hurry = calm ? 1.2 : 2.1; N.walkTo(PLAY.pos.x, PLAY.pos.z); } }
    if (this.giveT > 3.5 && !PHP.out) { this.say('come'); this.lockUp(); return; }
    if (PHP.out && PHP.out.by === N) { this.remember('Du hast den Fremden niedergeschossen (' + TIME.stamp() + ').'); this.wanted = 0.3; this.arrT = 0; this.goBack(); return; }
    if (!this.inSight()) { this.lostT = (this.lostT || 0) + dt; if (this.lostT > 20) { this.remember('Der Fremde ist dir entkommen (' + TIME.stamp() + ').'); this.say('escaped'); this.arrT = 0; this.lostT = 0; this.goBack(); } }
    else this.lostT = 0;
  },
  // the cell: dark, and you wake up there in the morning, the fine taken
  lockUp() {
    const N = this.npc;
    this.arrT = 0; this.goBack();
    if (GUN.state !== 'holster') { GUN.setAim(false); GUN.state = 'holster'; GUN.inHand = false; }
    const crime = this.CRIMES.filter((c) => c.known && c.kind !== 'shots').slice(-1)[0];
    this.jailed = (this.jailed || 0) + 1;
    PHP.out = { t: 0, by: N, jail: true, why: crime ? crime.kind : 'shots' };
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
    if (this.st !== 'office') { this.npc.gun.drop(); this.arrT = 0; const s = this.spot('desk'); this.npc.stop(); this.npc.pos.set(s.x, this.R.floorY, s.z); this.npc.room = this.R; this.st = 'office'; }
  },
  settled() { return !this.npc || this.npc.hp.dead || this.st === 'office'; },
  persona() {
    const S = this;
    return {
      actions: ['none', 'nod', 'shake_head', 'point_door', 'point_you', 'fist_shake', 'calm_down', 'cross_arms', 'shrug'],
      rules: ['Du bist Sheriff ' + S.LOOKS.name + ', der Sheriff von Dust Creek (Arizona-Territorium, 1885): ' + S.LOOKS.age + '. Ruhig, gerecht, unbestechlich, hart, wenn es sein muss. Du duzt jeden.',
        'In deiner Stadt wird nicht geschossen. Wer jemanden anschießt oder umbringt, kommt in deine Zelle oder vor den Richter. Du kennst Hank, Walt und Jeb vom Saloon und Doc Whitfield gut.',
        'Kerniges, einfaches Deutsch, höchstens zwei kurze Sätze unter 25 Wörtern, es wird laut vorgelesen. Kein Markdown, keine Sternchen. Von der modernen Welt weißt du nichts.'].join('\n'),
      context() {
        const out = ['Es ist ' + TIME.words() + ', ' + TIME.str() + ' Uhr.'];
        out.push(S.st === 'arrest' ? 'Du verhaftest den Fremden gerade, dein Revolver ist auf ihn gerichtet.' : S.st === 'scene' || S.st === 'respond' ? 'Du bist wegen Schüssen ausgerückt.' : 'Du bist in deinem Büro.');
        if (GUN.state !== 'holster' && !GUN.reloadThenHolster) out.push('Der Fremde hat seine Waffe in der Hand.');
        out.push('Was du über den Fremden weißt: ' + (S.wanted >= 0.6 ? 'du willst ihn verhaften. ' : S.wanted > 0 ? 'du traust ihm nicht. ' : '') + (S.mem.slice(-5).join(' ') || 'nichts Besonderes.'));
        const body = S.npc.hp.describe(); if (body) out.push('Dein Körper: ' + body + '.');
        return out.join('\n');
      },
      offline(text) { const t = text.toLowerCase(); return /ergeb|verhaft|ok|gut|ja/.test(t) && S.st === 'arrest' ? { say: 'Vernünftig. Waffe weg und mitkommen.', action: 'nod' } : /hilfe|mord|tot|geschossen/.test(t) ? { say: 'Wo? Zeig’s mir.', action: 'nod' } : { say: ['Hm.', 'Ich hör zu.', 'Mach keinen Ärger.'][Math.floor(Math.random() * 3)], action: 'none' }; },
      act(action) { if (GESTURE.AI.includes(action)) S.npc.gesture(action, action === 'point_door' ? null : null); },
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
