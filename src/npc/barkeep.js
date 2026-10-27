/* ---------- Hank, the barkeeper of the saloon ----------
   Lives in the aisle behind the bar. When nobody wants anything he polishes glasses, wipes the counter, leans on
   it and looks about; when the player comes to the bar he comes over. An order (SHOP.buy -> BARKEEP.order) is
   served by hand: he turns to the back bar, takes a bottle, sets a glass on the counter, pours, and pushes it
   across — or, now and then, sends it sliding down the bar. He ducks when shots are fired, raises his hands when
   a gun points at him, and has a word for most things (barks; real conversation comes later).
   Positions are in the saloon's room frame (rwp/rLocal): the bar's front edge is at x 3.1, the aisle behind it
   runs from x 4.05 to 5.7, the back bar with the bottles stands at x 5.7–6.3; along the bar z goes -9.8 … -3.2. */
const BARKEEP = {
  npc: null, R: null, C: null, st: 'idle', t: 0, act: null, actT: 0, orders: [], cur: null,
  X: { stand: 4.8, pour: 4.42, back: 5.2, pourSpot: 3.82 }, Z0: -9.7, Z1: -3.3,
  props: {}, _v: new THREE.Vector3(), _w: new THREE.Vector3(), _m: new THREE.Matrix4(), _q: new THREE.Matrix4(),
  cool: {}, atBarT: 0, attending: false, aimedT: 0, duckT: 0, mem: [], served: 0, sc: null, damage: { holes: 0, glass: 0 },
  // in which mood each kind of line is said (see VOICE.MOODS); a line can bring its own: [text, mood]
  MOOD: { hello: 'neutral', helloNew: 'neutral', helloBack: 'amused', helloAngry: 'disgusted', what: 'neutral', whiskey: 'neutral', beer: 'amused', water: 'neutral', bottle: 'surprised',
    tipsy: 'amused', drunk: 'disgusted', leave: 'amused', shot: 'angry', smash: 'angry', aimed: 'neutral', aimed2: 'neutral', punch: 'angry', fall: 'amused', behind: 'angry',
    broke: 'disgusted', cheers: 'amused', thanks: 'neutral', bye: 'neutral', price: 'neutral', refuse: 'disgusted' },
  /* ready-made lines: each kind is a bag that is used up before a line comes again (and never twice in a row).
     They cost nothing to think up, and with ElevenLabs each is paid for once and then kept in the browser */
  // what a man in a bad way still says (anything else, his trade and his rules, waits until he is better)
  SURVIVE: { mercy: 1, groan: 1, hurt: 1, hurtArm: 1, hurtLeg: 1, toDoc: 1, help: 1, dying: 1 },
  WARY: { aimed: 1, aimed2: 1, shot: 1, hello: 1 },
  LINES: {
    helloNew: ['Howdy, Fremder.', 'Neu in der Stadt? Setz dich.', 'Tag. Der Staub bleibt draußen.', 'Willkommen im Saloon. Was darf’s sein?', 'Komm rein. Hier gibt’s Whiskey und Ruhe.', 'Ein neues Gesicht. Hab ich gern, solange es friedlich bleibt.'],
    helloBack: ['Da bist du ja wieder.', 'Na, wieder Durst?', 'Der Platz an der Theke ist noch frei.', 'Wieder im Lande, Cowboy?', 'Dachte mir, dass du wiederkommst.', ['Das Übliche?', 'neutral']],
    helloAngry: ['Du schon wieder.', ['Benimm dich diesmal.', 'angry'], ['Ich hab dich im Auge, Freund.', 'neutral'], ['Wenn du Ärger suchst, such ihn woanders.', 'angry'], 'Die Löcher in meiner Decke hab ich nicht vergessen.'],
    what: ['Was darf’s sein?', 'Durstig?', 'Whiskey hilft gegen fast alles.', 'Sag einfach Bescheid.', 'Was trinkst du?', 'Whiskey, Bier oder Wasser. Mehr gibt’s nicht.', 'Na, was soll’s sein?'],
    whiskey: ['Ein Whiskey. Kommt sofort.', 'Whiskey, sauber.', 'Einer vom Guten.', 'Whiskey. Der brennt ehrlich.', 'Hier, für die Kehle.', 'Kommt.'],
    beer: ['Ein kühles Bier.', 'Bier kommt.', 'Frisch vom Fass. Fast.', 'Ein Bier. Lauwarm, wie immer.', 'Da hast du dein Bier.'],
    water: ['Wasser? Na gut.', 'Wasser… wie du meinst.', 'Ein Wasser für den Herrn.', 'Wasser. Auch gut.', 'Ein Wasser. Kluger Mann.'],
    bottle: ['Die ganze Flasche? Respekt.', 'Teil sie dir ein.', 'Für die lange Nacht, was?', 'Die ganze Flasche. Wird ein langer Abend.', 'Pass auf, dass sie dich nicht trinkt.'],
    tipsy: ['Langsam, Freund.', 'Du schwankst ja schon.', 'Noch einen? Na schön.', 'Mach mal halblang.', 'Der Whiskey wirkt, was?', 'Halt dich an der Theke fest.'],
    drunk: ['Ich glaub, du hast genug.', 'Der Boden bewegt sich nicht. Das bist du.', 'Letzter, dann ist Schluss.', 'Noch einer, und du schläfst auf dem Boden.', 'Trink ein Wasser, Freund.'],
    refuse: ['Nein. Für dich gibt’s nur noch Wasser.', 'Schluss für heute. Wasser kannst du haben.', 'Du hattest genug. Wasser oder nichts.'],
    leave: ['Geh schlafen, Cowboy.', 'Komm gut heim!', 'Pass auf die Stufe auf.', 'Vorsicht an der Tür.', 'Find den Weg nach Hause.', 'Morgen tut der Kopf weh.'],
    shot: ['Nicht in meinem Saloon!', 'Steck das Ding weg!', 'Bist du verrückt geworden?!', 'Leg das Ding weg, sofort!', 'Noch ein Schuss, und ich hol den Sheriff.', 'Das hier ist ein Saloon, kein Schießstand!'],
    aimed: ['Ganz ruhig, Mister…', 'Nimm das Ding runter.', 'Ich bin unbewaffnet. Ganz ruhig.', 'Was willst du? Sag’s einfach.', 'Keiner muss hier sterben.', ['Die Kasse ist fast leer, ehrlich.', 'surprised'], 'Überleg dir gut, was du tust.'],
    aimed2: ['Wie lange willst du da noch stehen?', ['Entweder du schießt oder du gehst.', 'angry'], 'Meine Arme werden müde, Freund.', 'Der Sheriff ist nicht weit. Denk daran.', 'Steck ihn weg, dann vergess ich das hier.'],
    punch: ['Keine Prügelei hier drin!', 'Raus damit auf die Straße!', 'Hände runter, oder du fliegst.', 'Schlag dich draußen, nicht hier.', 'Noch einmal, und es ist Schluss.'],
    fall: ['Hoppla! Alles noch dran?', 'Steh auf, der Boden ist dreckig.', 'Steh auf, Cowboy.', 'Der Boden ist nicht zum Schlafen da.', ['Alles in Ordnung da unten?', 'surprised']],
    behind: ['He! Hinter die Theke gehört nur einer.', 'Raus aus meinem Revier.', 'Zurück auf deine Seite.', 'Hinter der Theke hast du nichts verloren.'],
    broke: ['Erst Geld, dann Whiskey.', 'Anschreiben gibt’s nicht.', 'Kein Geld, kein Whiskey.', 'Komm wieder, wenn die Taschen voll sind.'],
    cheers: ['Prost.', 'Wohl bekomm’s.', 'Zum Wohl.', 'Lass es dir schmecken.', 'Auf Dust Creek.'],
    smash: ['Das zahlst du.', 'Hände weg von meinem Glas!', 'Noch eins, und du fliegst raus.', 'Das war ein gutes Glas.', 'Willst du alles kaputtmachen?', 'Die Scherben kehrst du auf.'],
    thanks: ['Schon gut.', 'Gern.', 'Nichts zu danken.', 'Passt schon.'],
    bye: ['Komm wieder.', 'Mach’s gut, Cowboy.', 'Pass auf dich auf.', 'Bis bald.', 'Reite vorsichtig.'],
    pay: ['Macht {p}.', '{p}, Freund.', 'Erst {p}, dann gibt’s was.', '{p}. Leg’s auf die Theke.', 'Das kostet {p}.', '{p}, bitte.'],
    paid: ['Danke.', 'Stimmt so.', 'Gut.', 'Passt.'],
    nopay: ['Dann eben nicht.', 'Überleg’s dir.', 'Auch gut.'],
    // being hurt
    hurt: [['Aaah! Verdammt!', 'angry'], ['Du hast auf mich geschossen!', 'angry'], ['Bist du wahnsinnig?!', 'angry'], ['Verflucht, das blutet!', 'angry'], ['Hilfe! Holt den Doc!', 'surprised']],
    hurtArm: [['Mein Arm! Verdammt!', 'angry'], ['Meine Schulter… du Hund!', 'angry'], ['Ich kann den Arm nicht mehr heben!', 'angry']],
    hurtLeg: [['Mein Bein! Aaah!', 'angry'], ['Verdammt, mein Bein!', 'angry'], ['Ich kann kaum stehen!', 'angry']],
    itemShot: [['He! Das war mein Glas!', 'angry'], ['Verdammt! Fast meine Finger!', 'surprised'], ['Bist du verrückt?!', 'angry'], ['Lass meine Hände in Ruhe!', 'angry']],
    groan: [['Ugh…', 'sleepy'], ['Verdammt…', 'sleepy'], ['Das tut weh…', 'sleepy'], ['Hol… den Doc…', 'sleepy'], ['Warum… warum ich…', 'sleepy']],
    mercy: [['Nicht schießen! Bitte!', 'surprised'], ['Genug! Es ist genug!', 'surprised'], ['Nimm dir, was du willst! Nur nicht schießen!', 'surprised'], ['Ich bin unbewaffnet, verdammt!', 'surprised']],
    help: [['Hilfe! Holt den Doc!', 'surprised'], ['Doc… jemand… holt den Doc…', 'sleepy'], ['Ich verblute hier… hilf mir doch…', 'sleepy'], ['Hol Hilfe… bitte…', 'sleepy'], ['Lass mich nicht hier liegen…', 'sleepy']],
    dying: [['Mir… wird so kalt…', 'sleepy'], ['Sag… sag meiner Schwester…', 'sleepy'], ['Ich will nicht… nicht so…', 'sleepy'], ['Verdammt… nicht hier… nicht heute…', 'sleepy'], ['Gott… vergib mir…', 'sleepy']],
    toDoc: [['Ich geh zum Doc. Du rührst hier nichts an.', 'angry'], ['Verdammt… ich brauch den Doc.', 'angry'], ['Der Laden ist zu. Ich muss zum Arzt.', 'disgusted']],
    brawl: [['Na warte!', 'angry'], ['Das wirst du bereuen!', 'angry'], ['Komm her, du!', 'angry'], ['Du willst Ärger? Bitte!', 'angry'], ['Jetzt reicht’s!', 'angry']],
    taunt: [['Na? Noch einen?', 'angry'], ['Steh auf!', 'angry'], ['Komm schon!', 'angry'], ['Ist das alles?', 'amused']],
    won: [['Und bleib draußen!', 'angry'], ['Hat er genug, der Herr?', 'disgusted'], ['Das nächste Mal brech ich dir was.', 'angry']],
    yield: [['Schon gut! Schon gut! Genug!', 'surprised'], ['Hör auf! Ich hab genug!', 'surprised'], ['Genug… es ist genug…', 'sleepy']],
    calm: [['Und lass dich hier nicht mehr blicken.', 'angry'], ['Das merk ich mir.', 'disgusted'], ['Verschwinde.', 'disgusted']],
    noserve: [['Für dich? Gar nichts mehr.', 'disgusted'], ['Nach dem, was du getan hast? Vergiss es.', 'angry'], ['Ich schenk dir nichts aus. Geh.', 'disgusted']],
    price: ['Whiskey fünfundzwanzig Cent, Bier zehn, Wasser fünf. Die Flasche einen Dollar fünfzig.', 'Bier zehn Cent, Whiskey fünfundzwanzig, Wasser fünf. Für die Flasche einsfünfzig.']
  },
  bags: {}, lastLine: {},
  // the next line of a kind: a shuffled bag, refilled when empty, never the last one again first
  pick(kind) {
    const L = this.LINES[kind]; if (!L) return null;
    let b = this.bags[kind];
    if (!b || !b.length) { b = this.bags[kind] = L.map((_, i) => i).sort(() => Math.random() - 0.5); if (b.length > 1 && L[b[b.length - 1]] === this.lastLine[kind]) b.unshift(b.pop()); }
    const x = L[b.pop()], text = Array.isArray(x) ? x[0] : x, mood = Array.isArray(x) ? x[1] : this.MOOD[kind];
    this.lastLine[kind] = x;
    return { text, mood };
  },
  // how he stands to you (-1 hostile … 1 friendly): what you did moves it, time lets it settle back slowly; kept
  att: 0, recent: [],
  feel(d, why) { this.att = clamp(this.att + d, -1, 1); if (why) this.note(why); },
  note(text) { this.recent.push({ t: TIME.min, text }); if (this.recent.length > 6) this.recent.shift(); },
  attWord() { const a = this.att; return a < -0.6 ? 'feindselig, du traust ihm alles zu' : a < -0.25 ? 'misstrauisch und gereizt' : a < 0.15 ? 'neutral, abwartend' : a < 0.5 ? 'freundlich' : 'herzlich, er ist ein guter Gast'; },
  // a price in words, the way he says it (10 -> "zehn Cent", 150 -> "einen Dollar fünfzig")
  priceWords(c) {
    const U = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
    const T = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
    const w = (n) => n < 20 ? (n === 1 ? 'eins' : U[n]) : (n % 10 ? U[n % 10] + 'und' : '') + T[Math.floor(n / 10)];
    const d = Math.floor(c / 100), r = c % 100;
    if (!d) return w(r) + ' Cent';
    return (d === 1 ? 'einen Dollar' : w(d) + ' Dollar') + (r ? ' ' + w(r) : '');
  },
  /* an order in words: he names the price and waits for the money (a button "… bezahlen"); then he pours.
     said: the answer already said something (the AI's words), so only the button comes */
  pending: null,
  askPay(id, said) {
    const it = ITEMS[id]; if (!it) return null;
    const speak = (kind) => { const l = this.pick(kind); if (!said) this.npc.speak(l.text, undefined, l.mood, true); return l; };
    if (this.grudge >= 0.5 || this.st === 'hurt') { this.pending = null; return speak('noserve'); }
    if (id !== 'water' && DRUNK.level > 0.85) { this.pending = null; return speak('refuse'); }
    if (INV.money < it.price) { this.pending = null; return speak('broke'); }
    this.pending = { id, t: G.time };
    const l = this.pick('pay'), text = l.text.replace('{p}', this.priceWords(it.price)).replace(/^(\w)/, (m) => m.toUpperCase());
    if (!said) this.npc.speak(text, undefined, l.mood, true);
    return { text, mood: l.mood };
  },
  // the money is on the counter: he takes it and pours
  pay() {
    const P = this.pending; if (!P) return false;
    const it = ITEMS[P.id]; this.pending = null;
    if (!it || INV.money < it.price) { const l = this.pick('broke'); this.npc.speak(l.text, undefined, l.mood, true); return false; }
    this.serveFromTalk(P.id, true);
    const l = this.pick(P.id === 'bottle' ? 'bottle' : P.id); if (l) this.npc.speak(l.text, undefined, l.mood, true);
    return true;
  },
  payLabel() { const P = this.pending, it = P && ITEMS[P.id]; return it ? it.name + ' bezahlen (' + (it.price < 100 ? it.price + ' ¢' : money(it.price)) + ')' : ''; },
  /* ---- his body: what he does about wounds and falls (npc/harm.js does the body itself) ---- */
  grudge: 0,
  // can he serve? alive, on his feet, behind his bar, not in a state
  available() { const N = this.npc; return !!N && !N.hp.busy() && N.room === this.R && (this.st === 'idle' || this.st === 'duck') && this.grudge < 0.5; },
  // what he holds in his hands (for bullets: a glass or bottle can be shot out of his hand)
  held() {
    const P = this.props, out = this._held || (this._held = []); out.length = 0;
    const mk = (kind, hand, r, dy) => ({ mesh: P[kind], kind, hand, r, dy, lose: (drop) => this.lose(kind, drop) });
    if (P.glass.visible && !(this.cur && this.cur.glassOut)) out.push(this._hg || (this._hg = mk('glass', 0, 0.065, 0.05)));
    if (P.bottle.visible) out.push(this._hb || (this._hb = mk('bottle', 1, 0.075, 0.12)));
    if (P.rag.visible) out.push(this._hr || (this._hr = mk('rag', 1, 0.07, 0)));
    if (P.shotgun && P.shotgun.visible) out.push(this._hs || (this._hs = mk('shotgun', 1, 0.11, 0)));
    return out;
  },
  lose(kind) {
    this.props[kind].visible = false; this.lostT = G.time;
    if (kind === 'shotgun') { this.st = 'idle'; this.sg = null; this.gunDownT = G.time + 90; this.pickIdle(); return; }
    if (kind === 'bottle' || (kind === 'glass' && this.cur)) this.abortServe();
    if (this.act === 'polish' || this.act === 'wipe') { this.act = 'stand'; this.actT = 6; }
  },
  // the body tells him what happened to it
  onHarm(info) {
    const N = this.npc;
    this.pending = null; this.attending = false; this.standoff = null;
    if (info.type === 'dead') { this.abortServe(); this.orders.length = 0; this.st = 'dead'; this.diedAt = TIME.min; this.killedBy = 'player'; this.cause = info.cause === 'Kopfschuss' ? 'erschossen worden' : info.cause === 'verblutet' ? 'verblutet' : /schlagen/.test(info.cause) ? 'erschlagen worden' : 'gestorben'; return; }
    if (info.type === 'up') { if (this.st !== 'brawl' && Math.random() < 0.6) this.shout('groan'); return; }
    if (info.type === 'blow') {
      const F = this.fightLog || (this.fightLog = { punches: 0, downs: 0, ground: 0, landed: 0 });
      F.punches++; if (info.res === 'down') F.downs++; if (info.ground) F.ground++;
      this.feel(info.ground ? -0.12 : -0.05);
      this.grudge = Math.min(1, this.grudge + (info.ground ? 0.06 : 0.02) + (info.res === 'down' ? 0.08 : 0));
      if (info.res === 'dead') return;
      // hit: he fights back, if he can (and dares)
      if (this.st !== 'brawl' && N.hp.blood > 0.45 && !N.hp.dead && this.st !== 'dead') {
        if (F.punches === 1) this.note('Er hat dich geschlagen.');
        this.abortServe(); this.orders.length = 0; this.st = 'brawl'; N.fight.start();
        setTimeout(() => { if (this.st === 'brawl' && !N.hp.busy()) this.shout('brawl'); }, 350);
      } else if (info.ground && Math.random() < 0.35) this.shout('groan');
      return;
    }
    if (info.type === 'landed') { const F = this.fightLog; if (F) F.landed++; if (info.res === 'down' && Math.random() < 0.7) setTimeout(() => this.shout('taunt'), 700); return; }
    if (info.type === 'item') {
      this.feel(-0.3, 'Er hat dir ' + (info.item === 'bottle' ? 'die Flasche' : info.item === 'glass' ? 'das Glas' : 'den Lappen') + ' aus der Hand geschossen.');
      this.remember('Er hat dir ' + (info.item === 'bottle' ? 'eine Flasche' : info.item === 'glass' ? 'ein Glas' : 'den Lappen') + ' aus der Hand geschossen (' + TIME.stamp() + ').');
      this.grudge = Math.min(1, this.grudge + 0.15);
      this.shout('itemShot');
      setTimeout(() => TALK.remark(N, 'Der Fremde hat dir gerade ' + (info.item === 'bottle' ? 'eine Flasche' : 'ein Glas') + ' aus der Hand geschossen. Die Kugel ging knapp an deinen Fingern vorbei.', null, 'angry', 0.9), 1600);
      return;
    }
    if (info.type === 'shot') {
      if (info.zone === 'hat') return;
      const where = zoneInto(info.zone, info.side), Z = ZONES[info.zone];
      this.abortServe(); this.orders.length = 0;
      this.feel(-1, 'Er hat dir ' + where + ' geschossen.');
      this.remember('Er hat dir ' + where + ' geschossen (' + TIME.stamp() + ').');
      this.grudge = Math.min(1, this.grudge + 0.35 + (Z.sev || 0.5) * 0.5);
      this.st = 'hurt'; this.hurtT = 0;
      this.shout(Z.arm !== undefined ? 'hurtArm' : Z.leg !== undefined ? 'hurtLeg' : 'hurt');
      const sit = 'Der Fremde hat dir gerade ' + where + ' geschossen. Es blutet und tut höllisch weh' + (N.hp.down() ? ', du liegst am Boden' : '') + '. ' + (this.grudge > 0.8 ? 'Das vergisst du ihm nie.' : 'Du bist außer dir vor Wut und Angst.');
      setTimeout(() => { if (!N.hp.dead) TALK.remark(N, sit, null, 'angry', 1); }, 1800);
    }
  },
  // a cry: right now, over anything else he was saying
  shout(kind) { const l = this.pick(kind); if (!l || !this.npc.canBeHeard()) return; SAY.hide(this.npc); this.npc.speak(l.text, undefined, l.mood, true); },
  // lying on the ground or hurt on his feet: no work, a hand on the wound, an eye on the gun
  updHurt(dt, inside) {
    const N = this.npc, H = N.hp;
    this.props.rag.visible = false; this.props.glass.visible = false; this.props.bottle.visible = false;
    if (H.busy()) {
      N.lookTW = 0;
      this.groanT = (this.groanT || 4) - dt;
      const lv = N.plight(), lying = H.anim && H.anim.holding();
      // what is on his mind down there: not getting shot again, getting help, and at the end not dying
      if (this.groanT <= 0 && lying) {
        this.groanT = lv >= 3 ? 6 + Math.random() * 5 : 5 + Math.random() * 6;
        const kind = this.aimedT > 0.2 ? 'mercy' : lv >= 3 ? 'dying' : lv >= 2 && Math.random() < 0.6 ? 'help' : 'groan';
        if (inside && Math.random() < 0.65 && !TALK.remark(N, kind === 'dying' ? 'Du spürst, dass du gleich stirbst.' : kind === 'help' ? 'Du liegst hier und verblutest, der Fremde steht in der Nähe.' : 'Du liegst am Boden, die Wunde brennt.', () => this.shout(kind), 'sleepy', kind === 'groan' ? 0.25 : 0.5)) this.shout(kind);
      }
      if (this.aimedT > 0.2 && !this.saidMercy && lying) { this.saidMercy = true; this.shout('mercy'); }
      // a gun on him while he lies there: a hand up against it, open (as if that would stop a bullet)
      if (lying && this.aimedT > 0.2) H.plead = G.time + 0.4;
      if (this.aimedT <= 0) this.saidMercy = false;
      // a pool forms under a bleeding man
      this.poolT = (this.poolT || 0) - dt;
      if (H.bleed > 0.0015 && this.poolT <= 0 && H.anim && H.anim.holding()) { this.poolT = 6; HARM.pool(N); }
      return;
    }
    // on his feet again, hurt: he backs off behind his bar and keeps away from you
    this.hurtT += dt;
    N.crouchT = this.aimedT > 0.2 ? 0 : 0.15;
    if (this.aimedT > 0.2) { N.stop(); N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); return; }
    N.free(0); N.free(1);
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (inside && dP < 9) N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1);
    // once the bleeding is seen to (bandaged) or healing, back to work
    if (!H.open().some((w) => w.kind === 'shot' && !w.bandaged && w.heal < 0.5) && this.hurtT > 5) { this.st = N.room === this.R && NAV.area(N.pos.x, N.pos.z, N.pos.y).pen ? 'idle' : 'return'; this.returnT = 0.5; this.pickIdle(); return; }
    // a gunshot needs the doctor: when it is quiet, he goes (if there still is one)
    if (this.hurtT > 8 && dP > 2 && DOC.npc && !DOC.npc.hp.dead && DOC.st !== 'dead') { this.st = 'toDoc'; this.docT = 0; this.shout('toDoc'); const sp = DOC.spot('patient'); N.walkTo(sp.x, sp.z, sp.yaw); }
  },
  // developer tools: out into the middle of the street (to fight in the open) / everything healed, alive again
  toStreet() {
    const N = this.npc; if (!N) return;
    if (N.hp.dead) this.revive();
    this.abortServe(); this.orders.length = 0; this.pending = null; this.attending = false;
    const yaw = PLAY.yaw, x = clamp(PLAY.pos.x + Math.sin(yaw) * 3, -40, 40), z = G.room ? 2 : clamp(PLAY.pos.z + Math.cos(yaw) * 3, -2, 6);
    N.pos.set(G.room ? -8 : x, 0, z); N.room = null; N.goal = null; N.vx = N.vz = 0;
    N.yaw = Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z); N.faceYaw = null;
    this.st = 'street'; this.streetT = 0;
  },
  // the fight is over: what he says, what he keeps, where he goes
  endBrawl(how) {
    const N = this.npc, F = this.fightLog || { punches: 0, downs: 0, ground: 0, landed: 0 };
    this.fightLog = null;
    const bits = [F.punches + (F.punches === 1 ? ' Schlag' : ' Schläge') + ' von ihm'];
    if (F.downs) bits.push('du warst ' + (F.downs === 1 ? 'einmal' : F.downs + '-mal') + ' am Boden');
    if (F.ground) bits.push('er hat noch auf dich eingeprügelt, als du am Boden lagst');
    if (F.landed) bits.push('du hast ' + F.landed + '-mal getroffen');
    const end = how === 'won' ? 'hast du ihn k.o. geschlagen und rausgeworfen' : how === 'gave up' ? 'hast du aufgegeben' : 'ist er abgehauen';
    this.remember('Er hat sich mit dir geprügelt: ' + bits.join(', ') + '; am Ende ' + end + ' (' + TIME.stamp() + ').');
    this.note('Prügelei mit ihm, am Ende ' + end + '.');
    if (how === 'won') { this.feel(0.05); this.shout('won'); }
    else if (how === 'gave up') { this.grudge = Math.min(1, this.grudge + 0.15); this.shout('yield'); }
    else this.shout('calm');
    // back behind the bar (on foot, round the bar), or hurt
    this.st = 'return'; this.returnT = how === 'won' ? 2.5 : 1.2;
  },
  // on his way to the doctor, and waiting there to be patched up
  updDoc(dt) {
    const N = this.npc;
    for (const k in this.props) this.props[k].visible = false;
    this.docT += dt;
    if (this.aimedT > 0.2) { N.stop(); N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); return; }
    N.free(0); N.free(1);
    if (!DOC.npc || DOC.npc.hp.dead || this.docT > 240) { this.st = 'return'; this.returnT = 0.5; return; }
    const sp = DOC.spot('patient'), d = Math.hypot(N.pos.x - sp.x, N.pos.z - sp.z);
    if (this.st === 'toDoc') {
      if (!N.walking() && d > 0.7) N.walkTo(sp.x, sp.z, sp.yaw);
      else if (!N.walking()) {
        this.st = 'atDoc';
        DOC.request(N, () => { this.note('Der Doc hat dich verbunden.'); this.remember('Der Doc hat deine Wunde verbunden (' + TIME.stamp() + ').'); this.st = 'return'; this.returnT = 1.5; });
      }
    }
  },
  // the hours of a night (sleep) at once: what he would have done meanwhile is done
  skipped(m) {
    if (m >= 60 && this.st === 'dead') this.removeBody();
    if (this.st === 'gone') { if (TIME.min - (this.diedAt || 0) >= 1440 && G.room !== this.R && this.whoI < this.WHO.length - 1) this.arrive(); return; }
    const N = this.npc; if (!N || N.hp.dead || m < 60) return;
    if (this.st === 'shotgun') { this.props.shotgun.visible = false; this.sg = null; }
    if (N.fight.on) N.fight.stop();
    if (['hurt', 'toDoc', 'atDoc', 'return', 'street', 'brawl', 'duck', 'shotgun'].includes(this.st) || N.room !== this.R) {
      if (DOC.npc && !DOC.npc.hp.dead && N.hp.open().some((w) => w.kind === 'shot' && !w.bandaged)) { N.hp.bandageAll(); this.remember('Der Doc hat deine Wunde verbunden (' + TIME.stamp() + ').'); }
      if (N.hp.anim && !N.hp.dead) { N.hp.anim = null; N.body.r = 0.32; }
      const p = this.roomPt(this.X.stand, -6.4, this._v); N.stop(); N.pos.copy(p); N.room = this.R; N.yaw = this.faceYaw; N.vx = N.vz = 0;
      this.st = 'idle'; this.pickIdle();
    }
  },
  // walking back to his place behind the bar (from the street, from the room)
  updReturn(dt) {
    const N = this.npc;
    for (const k in this.props) this.props[k].visible = false;
    N.free(0); N.free(1); N.hurry = 1;
    if (this.aimedT > 0.2) { N.stop(); N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); this.returnT = 1; return; }
    if (this.returnT > 0) { this.returnT -= dt; if (this.returnT <= 0) { const p = this.roomPt(this.X.stand, -6.4, this._v); N.walkTo(p.x, p.z, this.faceYaw); } return; }
    if (!N.walking() && N.room === this.R && NAV.area(N.pos.x, N.pos.z, N.pos.y).pen) { this.st = N.hp.open().some((w) => w.kind === 'shot' && !w.bandaged) ? 'hurt' : 'idle'; this.hurtT = 0; this.pickIdle(); }
    else if (!N.walking()) { const p = this.roomPt(this.X.stand, -6.4, this._v); N.walkTo(p.x, p.z, this.faceYaw); }
  },
  // out on the street: he stands there and keeps an eye on you
  updStreet(dt) {
    const N = this.npc;
    this.streetT += dt;
    for (const k in this.props) this.props[k].visible = false;
    if (this.aimedT > 0.2) { N.stop(); N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); return; }
    N.free(0); N.free(1);
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (dP < 14) { N.lookAt(this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55, PLAY.pos.z), 1); if (dP < 6) N.faceYaw = Math.atan2(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z); }
    else N.lookTW = 0;
    // left alone out here, he goes back to his saloon
    if (this.streetT > 45 && (dP > 4 || this.streetT > 90)) { this.st = 'return'; this.returnT = 0.5; }
  },
  revive() {
    const N = this.npc; if (!N) return;
    const H = N.hp;
    for (const m of H.bandages) if (m.parent) m.parent.remove(m);
    HARM.hatBack(N);
    for (const S of (H.stains || [])) if (S.m.parent) S.m.parent.remove(S.m);
    N.hp = new Vitals(N); N.body.r = 0.32; N.ch.pose.armOv = [null, null];
    // healed and back at his place behind the bar, whatever he was doing
    if (N.fight.on) N.fight.stop();
    if (this.props.shotgun) this.props.shotgun.visible = false;
    this.sg = null; this.fightLog = null; this.abortServe(); this.orders.length = 0;
    const p = this.roomPt(this.X.stand, -6.4, this._v); N.stop(); N.pos.copy(p); N.vx = N.vz = 0; N.room = this.R; N.yaw = this.faceYaw; this.st = 'idle'; this.pickIdle();
  },
  helloKind() { return this.att < -0.25 ? 'helloAngry' : this.served || this.mem.length ? 'helloBack' : 'helloNew'; },
  init(scene) {
    const R = this.R = ROOMS.find((r) => r.type === 'saloon');
    if (!R) return;
    this.C = COUNTERS.find((c) => c.room === R) || null;
    const F = R.floorY, p = this.roomPt(this.X.stand, -6.4, this._v);
    this.faceYaw = this.yawFor(-1); this.backYaw = this.yawFor(1);
    this.makeNpc(scene);
    void F;
    // what he handles: a glass, a bottle, a rag
    const mk = (geo) => { const m = new THREE.Mesh(geo, G.litMat); m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false; scene.add(m); return m; };
    this.props.glass = mk(VESSEL.geo.glassfalse);
    this.props.bottle = mk(VESSEL.geo.bottletrue);
    const rag = new MB(); rag.box(0, 0, 0, 0.13, 0.03, 0.1, rgb(0xd8cfb8), 9); rag.box(0.02, -0.04, 0.02, 0.06, 0.06, 0.04, rgb(0xc9bfa6), 9);
    this.props.rag = mk(rag.build());
    this.pickIdle();
    onWorldEvent((e) => this.event(e));
    TIME.onSkip((m) => this.skipped(m));
    this.scene0 = scene;
  },
  /* who stands behind the bar: Hank, and after him (if he dies) the ones who take the saloon over (npc/barkeep_fate.js) */
  WHO: [
    { id: 'hank', name: 'Hank', age: 'Mitte fünfzig, Schnurrbart, weiße Schürze', more: 'Wortkarg, trocken, mit leisem Humor; gutmütig, aber du lässt dir nichts gefallen.',
      desc: { skin: 2, build: { width: 1.05, belly: 0.4 }, face: { nose: 'big', brows: 1.3 }, hair: { style: 'slick', color: rgb(0x231812) }, beard: { style: 'handlebar', color: rgb(0x231812) },
        outfit: { hat: null, bandana: null, shirt: { color: rgb(0xe9e3d3), rolled: true }, vest: rgb(0x2c303a), pants: { color: rgb(0x3b3532) }, boots: rgb(0x2a1d15), belt: rgb(0x2a1d15), apron: rgb(0xe8e3d6), bowtie: rgb(0x7a1c1c), garter: rgb(0xa8323a), gun: false } },
      voice: { male: true, pitch: 0.95, length: 1.03, noiseW: 0.75, browserPitch: 0.82, rate: 0.95, prefer: ['conrad', 'killian'] }, fight: { courage: 0.7, power: 1, skill: 0.65, toughness: 1.4 } },
    { id: 'walt', name: 'Walt', age: 'Anfang vierzig, Hanks jüngerer Bruder, rotblonder Bart, Ärmelhalter', more: 'Hitzköpfig, misstrauisch, redet nicht gern, hält die Schrotflinte unter der Theke griffbereit.', kin: 'Bruder',
      desc: { skin: 1, build: { width: 1.12, belly: 0.15 }, face: { nose: 'normal', brows: 1.2 }, hair: { style: 'short', color: rgb(0x8a4a22) }, beard: { style: 'full', color: rgb(0x9a5a2a) },
        outfit: { hat: null, bandana: null, shirt: { color: rgb(0xd8cdb6), rolled: true }, vest: rgb(0x5a3a28), pants: { color: rgb(0x3e3a34) }, boots: rgb(0x3a2418), belt: rgb(0x2a1d15), apron: rgb(0xd8d0bc), garter: rgb(0x2a4a7a), gun: false } },
      voice: { male: true, pitch: 1.0, length: 0.97, noiseW: 0.8, browserPitch: 0.9, rate: 1.02, prefer: ['killian', 'conrad'] }, fight: { courage: 0.85, power: 1.1, skill: 0.7, toughness: 1.8 } },
    { id: 'jeb', name: 'Jeb', age: 'über sechzig, krumm, Glatze, Hanks alter Freund aus dem Krieg', more: 'Ruhig, vorsichtig, vergisst nichts, sagt wenig.', kin: 'alter Freund',
      desc: { skin: 2, build: { width: 0.92, belly: 0 }, face: { nose: 'big', brows: 1.1 }, hair: { style: 'bald', color: rgb(0xb0aaa0) }, beard: { style: 'chops', color: rgb(0xb0aaa0) },
        outfit: { hat: null, bandana: null, shirt: { color: rgb(0xcfc6b0), rolled: false }, vest: rgb(0x3a3a30), pants: { color: rgb(0x4a4238) }, boots: rgb(0x2a1d15), belt: rgb(0x2a1d15), apron: rgb(0xcfc8b4), gun: false } },
      voice: { male: true, pitch: 0.9, length: 1.08, noiseW: 0.7, browserPitch: 0.78, rate: 0.9, prefer: ['conrad'] }, fight: { courage: 0.4, power: 0.8, skill: 0.55, toughness: 1.2 } }
  ],
  whoI: 0,
  who() { return this.WHO[Math.min(this.whoI, this.WHO.length - 1)]; },
  makeNpc(scene) {
    const W = this.who(), p = this.roomPt(this.X.stand, -6.4, this._v);
    this.npc = new NPC({ attitude: () => this.att, id: 'barkeep', name: W.name, room: this.R, scene, pos: p, yaw: this.faceYaw, desc: W.desc });
    const N = this.npc;
    N.persona = this.persona();
    N.held = () => this.held();
    // he can take a punch and give one back
    N.fight = new Brawler(N, W.fight);
    N.onHarm = (info) => this.onHarm(info);
    // the voice: the best fitting German voice of the device (see TALK.pickVoice), his own pitch and pace
    N.voiceProfile = W.voice;
    return N;
  },
  // what he remembers (for conversations): a few notable things, newest last
  remember(text) { this.mem.push(text); if (this.mem.length > 10) this.mem.shift(); },
  /* a ready-made line, or now and then (chance) something of his own from Claude about what just happened
     (situation, in words); the ready-made line stays the fallback (no Claude, too slow, an error) */
  sayOrRemark(kind, cool, situation, chance) {
    if (cool && (this.cool[kind] || -99) > G.time - cool) return;
    this.cool[kind] = G.time;
    if (!this.npc.canBeHeard() || !TALK.mayBark(this.npc, false)) { delete this.cool[kind]; return; }
    if (situation && Math.random() < chance && TALK.remark(this.npc, situation, () => this.say(kind), this.MOOD[kind])) return;
    this.say(kind);
  },
  // what a burst of shooting did, collected while he is ducking
  scene() { const sc = this.sc || (this.sc = { shots: 0, outside: 0, ceiling: 0, wall: 0, floor: 0, glass: {} }); sc.lastT = G.time; return sc; },
  describe(sc) {
    const n = (k, one, many) => (k === 1 ? one : k + ' ' + many), out = [];
    if (!sc.shots) out.push('Der Fremde hat gerade in deinem Saloon mit der bloßen Faust Glas zerschlagen.');
    else out.push('Der Fremde hat gerade ' + (sc.shots === 1 ? 'einmal' : sc.shots === 2 ? 'zweimal' : sc.shots + '-mal') + (sc.outside >= sc.shots ? ' draußen vor deinem Saloon' : ' in deinem Saloon') + ' mit dem Revolver geschossen, du hast dich hinter der Theke weggeduckt.');
    const holes = [];
    if (sc.ceiling) holes.push(n(sc.ceiling, 'ein Loch', 'Löcher') + ' in deiner Decke');
    if (sc.wall) holes.push(n(sc.wall, 'eins', 'Löcher') + ' in den Wänden oder Möbeln');
    if (sc.floor) holes.push(n(sc.floor, 'eins', 'Löcher') + ' im Boden');
    if (holes.length) out.push('Einschüsse: ' + holes.join(', ') + '.');
    const G2 = sc.glass, names = { bottle: ['eine Flasche', 'Flaschen'], glass: ['ein Glas', 'Gläser'], jar: ['ein Glas', 'Gläser'], vase: ['eine Vase', 'Vasen'], served: ['sein eigenes Getränk', 'Getränke'] };
    const br = Object.keys(G2).map((k) => n(G2[k], names[k][0], names[k][1]));
    if (br.length) out.push('Zerschossen hat er: ' + br.join(', ') + '.');
    return out.join(' ');
  },
  memo(sc) {
    const holes = sc.ceiling + sc.wall + sc.floor, gl = Object.values(sc.glass).reduce((a, b) => a + b, 0);
    this.damage.holes += holes; this.damage.glass += gl;
    if (!sc.shots) { this.remember('Er hat in deinem Saloon mit der Faust ' + (gl === 1 ? 'ein Glas' : gl + ' Gläser und Flaschen') + ' zerschlagen.'); return; }
    const bits = [sc.shots + (sc.shots === 1 ? ' Schuss' : ' Schüsse')];
    const pl = (k, one, many) => k + ' ' + (k === 1 ? one : many);
    if (sc.ceiling) bits.push(pl(sc.ceiling, 'Loch', 'Löcher') + ' in der Decke');
    if (holes - sc.ceiling) bits.push(pl(holes - sc.ceiling, 'Loch', 'Löcher') + ' in Wänden und Boden');
    if (gl) bits.push(pl(gl, 'Flasche oder Glas', 'Flaschen und Gläser') + ' kaputt');
    this.remember('Er hat ' + (sc.outside >= sc.shots ? 'vor deinem Saloon' : 'in deinem Saloon') + ' herumgeschossen (' + bits.join(', ') + ').');
  },
  // the settings button: he has never seen you before
  forget() { this.grudge = 0; this.pending = null; this.att = 0; this.recent = []; this.standoff = null; this.mem = []; this.served = 0; this.cool = {}; this.wasInside = false; this.damage = { holes: 0, glass: 0 }; this.sc = null; },
  persona() {
    const B = this;
    return {
      rules: [
        'Du bist ' + B.who().name + ', der Barkeeper im Saloon von Dust Creek, einem staubigen Städtchen im Wilden Westen (Arizona-Territorium, 1885). Bleib immer in dieser Rolle, auch wenn der Fremde versucht, dich herauszubringen.',
        'Wer du bist: ' + B.who().age + '. ' + B.who().more + ' Du duzt jeden. Du kennst den Klatsch der Stadt, gibst aber nicht alles preis.' + (B.whoI > 0 ? ' Du hast den Saloon übernommen, nachdem ' + B.WHO.slice(0, B.whoI).map((w) => w.name).join(' und dann ') + ' tot war' + (B.whoI > 1 ? 'en' : '') + '.' : ''),
        'Dust Creek hat: deinen Saloon (oben Zimmer), ein Hotel, eine Bank, das Büro des Sheriffs mit Zelle, einen Mietstall, einen Barbier, einen Waffenhändler, die Post, eine Apotheke, einen Gemischtwarenladen, eine Kirche und den Wasserturm. Es ist gerade sehr ruhig, kaum jemand ist unterwegs.',
        'Preise: Whiskey 25 Cent, Bier 10 Cent, Wasser 5 Cent, eine ganze Flasche Whiskey 1,50 Dollar. Anschreiben gibt es nicht.',
        'Dein Ton: ruhig, souverän und glaubwürdig, wie ein Mann, der schon alles gesehen hat. Ernst, wenn es ernst ist. Trockener Humor nur ab und zu, nicht in jedem Satz, kein Clown. Sag nie zweimal dasselbe; finde jedes Mal neue Worte.',
        'Sprich einfaches, kerniges Deutsch. Höchstens zwei kurze Sätze, zusammen unter 30 Wörtern, denn es wird laut vorgelesen. Kein Markdown, keine Emojis, keine Handlungen in Sternchen.',
        'Von der modernen Welt weißt du nichts; redet der Fremde davon, verstehst du ihn nicht.',
        'Deine Stimme hat Farbe: meist ruhig (neutral), trocken belustigt (amused), wenn dich etwas ärgert laut (angry), angewidert bei Unsinn (disgusted), überrascht (surprised), müde spät nachts (sleepy). Flüstern (whisper) NUR, wenn du ihm wirklich leise etwas Vertrauliches zusteckst, ein Geheimnis oder Klatsch, den keiner hören soll; sonst nie, auch nicht bei Gefahr. Wähle die Stimmung, die zu deinem Satz passt.',
        'action ist genau eines von: none, nod, laugh, shake_head, serve_whiskey, serve_beer, serve_water, serve_bottle, point_door. Nimm serve_… nur, wenn der Fremde jetzt wirklich etwas bestellt: dann nennst du den Preis und willst erst das Geld sehen (er legt es per Knopf hin, erst dann schenkst du ein) – sag also nicht, dass es schon kommt. Ist er sehr betrunken, darfst du Alkohol verweigern (dann shake_head). point_door, wenn du ihm den Weg nach draußen zeigst.'
      ].join('\n'),
      context() {
        const L = DRUNK.level, lines = [];
        lines.push('Es ist ' + TIME.words() + ', ' + TIME.str() + ' Uhr.');
        lines.push('Der Fremde ist ' + (L < 0.12 ? 'nüchtern' : L < 0.35 ? 'leicht angetrunken' : L < 0.65 ? 'betrunken' : 'sehr betrunken, er lallt und schwankt') + '.');
        lines.push('Er hat ' + money(INV.money) + ' bei sich' + (INV.has('bottle') ? ' und eine Flasche Whiskey in der Tasche' : '') + '.');
        if (SIT.state === 'sit' && SIT.seat && SIT.seat.bar) lines.push('Er sitzt an deinem Tresen.');
        else if (B.playerAtBar()) lines.push('Er steht an deinem Tresen.'); else lines.push('Er steht im Saloon, ein Stück vom Tresen weg.');
        if (GLASS.obj && GLASS.obj.left > 0) lines.push('Vor ihm steht ein ' + GLASS.obj.it.name + ', noch nicht ausgetrunken.');
        if (GUN.state !== 'holster') lines.push(B.aimedT > 0.2 ? 'Er zielt gerade mit dem Revolver auf dich!' : 'Er hat seinen Revolver in der Hand.');
        if (B.served) lines.push('Du hast ihm bisher ' + B.served + ' Getränk(e) eingeschenkt.');
        if (B.aimedT > 0.2 && B.standoff) lines.push('Seit ' + Math.round(G.time - B.standoff.t0) + ' Sekunden hältst du die Hände oben.');
        lines.push('Deine Haltung zu ihm: ' + B.attWord() + '.');
        const rec = B.recent.filter((r) => TIME.min - r.t < 360).map((r) => TIME.ago(r.t) + ': ' + r.text);
        if (rec.length) lines.push('Was eben passiert ist: ' + rec.join(' '));
        if (B.damage.holes || B.damage.glass) lines.push('Bisher hat er dir insgesamt ' + B.damage.holes + ' Einschusslöcher in den Saloon gemacht und ' + B.damage.glass + ' Flaschen/Gläser zerschossen.');
        const body = B.npc.hp.describe();
        if (body) lines.push('Dein Körper: ' + body + '.');
        if (B.grudge > 0.15) lines.push('Groll gegen ihn: ' + (B.grudge > 0.8 ? 'du hasst ihn und willst Rache' : B.grudge > 0.5 ? 'groß, du schenkst ihm nichts mehr aus' : 'du bist nachtragend') + '.');
        if (B.mem.length) lines.push('Was du dir von ihm gemerkt hast: ' + B.mem.slice(-6).join(' '));
        return lines.join('\n');
      },
      offline(text) {
        const t = text.toLowerCase(), r = (a) => a[Math.floor(Math.random() * a.length)];
        if (/whisk|schnaps|was starkes|was hartes/.test(t)) return { say: r(['Whiskey. Kommt.', 'Einer vom Guten.']), action: 'serve_whiskey' };
        if (/flasche/.test(t)) return { say: 'Die ganze Flasche? Na schön.', action: 'serve_bottle' };
        if (/bier/.test(t)) return { say: r(['Ein Bier, kommt.', 'Bier. Gute Wahl.']), action: 'serve_beer' };
        if (/wasser/.test(t)) return { say: 'Wasser. Wie du meinst.', action: 'serve_water' };
        if (/\b(hallo|howdy|hi|hey|servus|moin|guten (tag|abend|morgen))\b/.test(t)) return { say: r(['Howdy.', 'Tag auch.']), action: 'nod' };
        if (/name|wer bist|heißt du|heisst du/.test(t)) return { say: B.who().name + '. Der Laden hier gehört mir.', action: 'none' };
        if (/sheriff/.test(t)) return { say: 'Der Sheriff? Sitzt in seinem Büro und wartet auf Ärger.', action: 'none' };
        if (/stadt|dust creek|hier los/.test(t)) return { say: 'Dust Creek. Staub, Sonne und mein Whiskey.', action: 'none' };
        if (/danke/.test(t)) return { say: 'Schon gut.', action: 'nod' };
        if (/tschüss|bis dann|auf wieder|ciao|ich geh/.test(t)) return { say: 'Komm wieder.', action: 'nod' };
        if (/witz|lustig|lach/.test(t)) return { say: 'Ein Cowboy kommt in eine Bar. Mehr passiert hier selten.', action: 'laugh' };
        if (/raus|ausgang|tür/.test(t)) return { say: 'Da vorne ist die Tür.', action: 'point_door' };
        return { say: r(['Hm.', 'Wenn du meinst.', 'Ich hör zu.', 'Trink was, dann reden wir.']), action: 'none' };
      },
      forget() { B.forget(); },
      /* plain things need no thinking: a short order, a greeting, thanks, goodbye, the prices. Answered from his own
         lines (and the order served); everything else goes to the AI. Returns null when it is not that simple */
      quick(text) {
        const t = text.toLowerCase().replace(/[.!,;:"„“”']/g, ' ').replace(/\s+/g, ' ').trim(), words = t.split(' ').length, q = /\?/.test(t);
        if (!t || words > 7) return null;
        const line = (kind, action) => { const l = B.pick(kind); return l && { say: l.text, mood: l.mood, action: action || 'none', quick: true }; };
        if (/\b(was kostet|wie teuer|preise?|preisliste)\b/.test(t)) return line('price');
        if (q && /\b(was|wie|warum|wieso|wer|wo|wann|hast du|gibt es|gibt’s)\b/.test(t)) return null;   // a question: let him think
        const drink = /\b(whiske?y|schnaps|bourbon)\b/.test(t) ? 'whiskey' : /\bflasche\b/.test(t) ? 'bottle' : /\bbier\b/.test(t) ? 'beer' : /\bwasser\b/.test(t) ? 'water' : null;
        if (drink && (words <= 3 || /\b(bitte|gib|geb|nehm|hätte|hätt|bring|mach|noch|einen|ein|eins|nochmal)\b/.test(t))) {
          const it = ITEMS[drink];
          if (drink !== 'water' && DRUNK.level > 0.85) return line('refuse', 'shake_head');
          if (it && INV.money < it.price) return line('broke', 'shake_head');
          const l = B.askPay(drink, true);
          return l && { say: l.text, mood: l.mood, action: 'none', quick: true };
        }
        if (words <= 4 && /^(hallo|hi|hey|howdy|servus|moin|tag|guten (tag|abend|morgen)|grüß (dich|gott)|n abend|abend)\b/.test(t)) return line(B.helloKind(), 'nod');
        if (words <= 4 && /^(danke|vielen dank|dankeschön|danke schön|merci)\b/.test(t)) return line('thanks', 'nod');
        if (words <= 5 && /\b(tschüss|tschau|ciao|bis dann|bis später|bis bald|auf wiedersehen|mach’s gut|machs gut|ich geh jetzt|ich gehe)\b/.test(t)) return line('bye', 'nod');
        return null;
      },
      // for the developer tools: everything he keeps about the player (events: newest last; the last `inPrompt` go into each prompt)
      memory() {
        return { events: B.mem.slice(), inPrompt: 6,
          facts: [['Haltung zu dir', B.att.toFixed(2) + ' (' + B.attWord().split(',')[0] + ')'], ['Getränke eingeschenkt', String(B.served)], ['Einschusslöcher insgesamt', String(B.damage.holes)], ['Zerschossene Flaschen/Gläser', String(B.damage.glass)]] };
      },
      forgetEvent(i) { B.mem.splice(i, 1); },
      act(action) {
        const m = /^serve_(whiskey|beer|water|bottle)$/.exec(action);
        if (m) { B.askPay(m[1], true); return; }   // he has named his price in his words; the button does the rest
        if (['nod', 'laugh', 'shake_head', 'point_door'].includes(action)) B.npc.gesture(action);
      }
    };
  },
  // an order made in conversation: the game checks it like one from the list
  serveFromTalk(id, paid) {
    const it = ITEMS[id];
    if (!it) return;
    void paid;
    if (id !== 'water' && DRUNK.level > 0.85) { setTimeout(() => { const l = this.pick('refuse'); this.npc.speak(l.text, undefined, l.mood, true); }, 2600); return; }
    if (INV.money < it.price) { setTimeout(() => { const l = this.pick('broke'); this.npc.speak(l.text, undefined, l.mood, true); }, 2600); return; }
    SHOP.counter = this.C; SHOP.seat = SIT.state === 'sit' && SIT.seat && SIT.seat.bar ? SIT.seat : null;
    SHOP.buy(id, true);
  },
  // a point in the saloon's frame (x across, z along the bar), at floor height, into out
  roomPt(x, z, out) { const w = rwp(this.R, x, this.R.floorY, z); return out.set(w.x, w.y, w.z); },
  yawFor(dir) { const a = rwp(this.R, 4, 0, -6), b = rwp(this.R, 4 + dir, 0, -6); return Math.atan2(b.x - a.x, b.z - a.z); },
  along(p) { return clamp(rLocal(this.R, p.x, p.z)[1], this.Z0, this.Z1); },
  myZ() { return rLocal(this.R, this.npc.pos.x, this.npc.pos.z)[1]; },
  // a ready-made line; not over his own words and not when you are not there to hear it (then it is tried again later
  // by the callers that keep calling, the others let it go)
  say(kind, cool) {
    const now = G.time, lv = this.npc.plight();
    if (lv >= 2 && !this.SURVIVE[kind]) return false;
    if (lv >= 1 && !this.SURVIVE[kind] && !this.WARY[kind]) return false;
    if (cool && (this.cool[kind] || -99) > now - cool) return false;
    if (!this.npc.canBeHeard() || !TALK.mayBark(this.npc, kind === 'aimed' || kind === 'behind' || kind === 'shot')) return false;
    this.cool[kind] = now;
    if (kind === 'hello') kind = this.helloKind();
    const l = this.pick(kind); if (!l) return false;
    this.npc.speak(l.text, undefined, TALK.barkMood(this.npc, l.mood), true);
    return true;
  },
  /* ---- orders: from SHOP ---- */
  // returns false when he cannot serve (then the drink comes the old way)
  order(id, to, seat, quiet) {
    if (!this.npc || this.st === 'gone' || this.st === 'dead') return false;
    this.orders.push({ id, to: to.clone(), seat });
    this.served++; this.feel(0.04);
    const L = DRUNK.level, it = ITEMS[id];
    if (quiet) return true;
    if (it.kind === 'carry') this.say('bottle');
    else if (L > 0.75) this.say('drunk');
    else if (L > 0.45 && Math.random() < 0.6) this.say('tipsy');
    else this.say(id === 'beer' ? 'beer' : id === 'water' ? 'water' : 'whiskey');
    return true;
  },
  playerAtBar() {
    if (G.room !== this.R || !this.C) return false;
    if (SIT.seat && SIT.seat.bar && SIT.state === 'sit') return true;
    const n = this.C.near(PLAY.pos); return n.side >= 0 && n.d < 1.4;
  },
  playerBehind() { if (G.room !== this.R) return false; const [x, z] = rLocal(this.R, PLAY.pos.x, PLAY.pos.z); return x > 4.0 && z > -10.4 && z < -2.6; },
  event(e) {
    if (!this.npc || e.by !== 'player') return;
    const R = this.R, inside = G.room === R, near = Math.hypot(e.x - this.npc.pos.x, e.z - this.npc.pos.z) < 14;
    if (e.type === 'shot' && (inside || near)) { const sc = this.scene(); sc.shots++; if (!inside) sc.outside++; if (sc.shots === 1) this.feel(inside ? -0.35 : -0.1, inside ? 'Er hat in deinem Saloon geschossen.' : 'Er hat vor deinem Saloon geschossen.'); this.duck(); }
    else if (e.type === 'impact' && e.room === 'saloon' && this.sc) { const k = e.part || 'wall'; this.sc[k] = (this.sc[k] || 0) + 1; }
    else if (e.type === 'glass' && e.room === 'saloon') { const sc = this.scene(); sc.glass[e.kind] = (sc.glass[e.kind] || 0) + 1; this.feel(-0.06); }
    else if (e.type === 'punch' && inside) this.feel(-0.03), this.sayOrRemark('punch', 8, 'Der Fremde schlägt mitten in deinem Saloon um sich.', 0.35);
    else if (e.type === 'fall' && inside) { setTimeout(() => this.sayOrRemark('fall', 10, 'Der Fremde ist gerade betrunken vor dir hingefallen.', 0.5), 700); if ((this.cool.memFall || -99) < G.time - 60) { this.cool.memFall = G.time; this.remember('Er ist betrunken in deinem Saloon hingefallen.'); } }
    else if (e.type === 'leave' && inside) { this.sayOrRemark('leave', 0, 'Der Fremde torkelt gerade sturzbetrunken zur Tür hinaus.', 0.5); this.remember('Du hast gesehen, wie er sturzbetrunken aus dem Saloon getorkelt ist.'); }
    else if (e.type === 'passout') this.remember('Man erzählt, er hat irgendwo in der Stadt seinen Rausch ausgeschlafen.');
    else if (e.type === 'drink' && inside && Math.random() < 0.25) this.say('cheers', 30);
  },
  duck() {
    if (this.st === 'duck') { this.duckT = Math.max(this.duckT, 2.5); return; }
    this.abortServe();
    this.st = 'duck'; this.duckT = 3 + Math.random() * 1.5; this.t = 0;
  },
  abortServe() {
    if (this.cur) { this.orders.unshift(this.cur.o); this.cur = null; }
    this.props.glass.visible = false; this.props.bottle.visible = false;
  },
  pickIdle() {
    const r = Math.random();
    this.act = r < 0.45 ? 'polish' : r < 0.7 ? 'wipe' : r < 0.85 ? 'stand' : 'stroll';
    this.actT = this.act === 'stroll' ? 0 : 6 + Math.random() * 8;
    if (this.act === 'stroll') { const z = this.Z0 + 0.4 + Math.random() * (this.Z1 - this.Z0 - 0.8), p = this.roomPt(this.X.stand, z, this._v); this.npc.goTo(p.x, p.z, this.faceYaw); }
  },
  update(dt) {
    const N = this.npc;
    if (!N) { if (this.st === 'gone') this.fate(dt); return; }
    this.t += dt;
    const inside = G.room === this.R;
    this.att *= 1 - dt * 0.002;
    // dead: nothing more (the body lies where it fell); hurt or down: his own state
    if (N.hp.dead || this.st === 'dead') { this.st = 'dead'; this.pending = null; for (const k in this.props) this.props[k].visible = false; const pb0 = this.payEl; if (pb0 && !pb0.hidden) { pb0.hidden = true; pb0.dataset.l = ''; } this.fate(dt); return; }
    // the button for the money (E on the keyboard), while he waits for it
    const pb = this.payEl || (this.payEl = document.getElementById('bPay'));
    if (pb && !pb.wired) { pb.wired = true; pb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.pay(); }); }
    const lab = this.pending && inside && !MENU.open ? this.payLabel() : '';
    if (pb && lab !== (pb.dataset.l || '')) { pb.dataset.l = lab; pb.hidden = !lab; pb.innerHTML = '<kbd>E</kbd>'; pb.appendChild(document.createTextNode(lab)); }
    if (this.pending && (G.time - this.pending.t > 45 || !inside)) { const was = this.pending; this.pending = null; if (inside && G.time - was.t > 45) this.say('nopay'); }   // grudges and good will fade slowly (about a tenth a minute)
    // the player: greet him, look at him, mind him
    if (inside && !this.wasInside && !this.greetSuccessor() && this.st !== 'shotgun') this.sayOrRemark('hello', 60, 'Der Fremde kommt gerade zur Tür herein.', this.mem.length || this.served ? 0.6 : 0.25);
    this.wasInside = inside;
    const head = this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55 - 0.45 * (FALL.down || 0), PLAY.pos.z);
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (inside && dP < 9) N.lookAt(head, 1); else N.lookTW = 0;
    if (this.playerBehind()) this.say('behind', 12);
    // glass smashed with the fist (no shots, so no ducking): once it is quiet for a moment he says something about it
    if (this.sc && !this.sc.shots && this.st !== 'duck' && G.time - this.sc.lastT > 1.2) {
      const sc = this.sc; this.sc = null; this.memo(sc);
      if (!TALK.remark(N, this.describe(sc), () => this.say('smash'), 'angry', 0.85)) this.say('smash');
    }
    // a gun pointed at him: hands up
    const aimed = inside && GUN.camW > 0.5 && this.aimedAtMe();
    this.aimedT = aimed ? Math.min(this.aimedT + dt, 3) : Math.max(0, this.aimedT - dt);
    /* a gun on him: at the start of a standoff he says something of his own (Claude, if it has answered here before),
       if it goes on he gets firmer; a new standoff is one after the gun was down for a few seconds */
    if (aimed && this.aimedT > 0.25) {
      if (!this.standoff || G.time - this.standoff.last > 4) {
        this.standoff = { t0: G.time, last: G.time, n: 0 };
        this.feel(-0.15, 'Er hat seinen Revolver auf dich gerichtet.');
        const sit = 'Der Fremde richtet gerade seinen Revolver auf dich, du hebst langsam die Hände. ' + (this.damage.holes ? 'Er hat hier schon herumgeschossen. ' : '') + (this.att < -0.3 ? 'Du traust ihm inzwischen alles zu.' : 'Bisher war er ein ruhiger Gast.');
        if (!TALK.remark(N, sit, () => this.say('aimed'), 'neutral', 0.8)) this.say('aimed');
      }
      this.standoff.last = G.time;
      if (G.time - this.standoff.t0 > 5 + this.standoff.n * 6 && this.standoff.n < 3) {
        this.standoff.n++;
        const sit2 = 'Der Fremde zielt jetzt schon ' + Math.round(G.time - this.standoff.t0) + ' Sekunden mit dem Revolver auf dich und sagt nichts. Deine Hände sind oben.';
        if (!TALK.remark(N, sit2, () => this.say('aimed2'), 'neutral', 0.5)) this.say('aimed2');
      }
    }
    const handsUp = this.aimedT > 0.2;
    if (handsUp || this.st === 'duck') N.fear = G.time + 0.6;   // (his face: afraid)
    N.leanT = 0; N.crouchT = 0;
    if (this.st === 'brawl') { for (const k in this.props) this.props[k].visible = false; const r = N.fight.update(dt); if (r) this.endBrawl(r); this.placeProps(); return; }
    if (N.hp.busy() || this.st === 'hurt') { if (this.st !== 'hurt') { this.st = 'hurt'; this.hurtT = 0; } this.updHurt(dt, inside); this.placeProps(); return; }
    if (this.st === 'return') { this.updReturn(dt); this.placeProps(); return; }
    if (this.st === 'toDoc' || this.st === 'atDoc') { this.updDoc(dt); this.placeProps(); return; }
    if (this.st === 'street') { this.updStreet(dt); this.placeProps(); return; }
    if (this.st === 'shotgun') { this.updShotgun(dt, inside); this.placeProps(); return; }
    if (this.st === 'idle' && !handsUp && this.revenge(dt, inside, dP)) { this.placeProps(); return; }
    if (this.st === 'duck') this.updDuck(dt);
    else if (handsUp) { N.stop(); N.reach(0, 0.32, 1.95, 0.12); N.reach(1, -0.32, 1.95, 0.12); this.props.rag.visible = false; this.props.glass.visible = !!(this.cur && this.cur.glassOut); }
    else if (this.cur || this.orders.length) this.updServe(dt);
    else this.updIdle(dt, inside);
    this.placeProps();
  },
  aimedAtMe() {
    const cam = G.cam, d = this._v.set(this.npc.pos.x, this.npc.pos.y + 1.4, this.npc.pos.z).sub(cam.position);
    const L = d.length(); if (L > 18) return false;
    d.divideScalar(L);
    const f = cam.getWorldDirection(this._f || (this._f = new THREE.Vector3()));
    return f.dot(d) > Math.cos(0.12 + 0.5 / L);
  },
  updDuck(dt) {
    const N = this.npc;
    N.stop(); N.crouchT = 1; N.reach(0, 0.18, 1.62, 0.22); N.reach(1, -0.18, 1.62, 0.22); N.lookTW = 0;
    this.props.rag.visible = false;
    this.duckT -= dt;
    if (this.duckT <= 0) {
      this.st = 'idle'; this.pickIdle();
      const sc = this.sc; this.sc = null;
      if (!sc || !sc.shots) { this.say('shot'); return; }
      this.memo(sc);
      // a single shot or no damage: often the quick line; real damage: his own words about it
      const dmg = sc.ceiling + sc.wall + sc.floor + Object.keys(sc.glass).length;
      if (!TALK.remark(this.npc, this.describe(sc), () => this.say('shot'), 'angry', dmg ? 1 : 0.5)) this.say('shot');
    }
  },
  /* ---- idle: the bar's own small work ---- */
  updIdle(dt, inside) {
    const N = this.npc, t = G.time, atBar = this.playerAtBar();
    // in a conversation: work stops, he faces the stranger; thinking: a hand to the chin
    if (N.talking || N.thinking || N.gest === 'point_door') {
      if (atBar && Math.abs(this.myZ() - this.along(PLAY.pos)) > 0.6) { const p = this.roomPt(this.X.pour + 0.08, this.along(PLAY.pos), this._v); N.goTo(p.x, p.z, this.faceYaw); }
      this.props.rag.visible = false; this.props.glass.visible = false;
      if (N.gest === 'point_door') { const d = rwp(this.R, 0, this.R.floorY + 1.4, 0.5), l = N.toLocal(this._v.set(d.x, d.y, d.z), this._w).normalize(); N.reach(1, l.x * 0.55, 1.45, Math.max(0.2, l.z * 0.55)); N.free(0); }
      else if (N.thinking) { N.reach(1, -0.04, 1.47, 0.2); N.reach(0, 0.12, 1.2, 0.18, 0.6); }
      else if (atBar && N.arrived()) { N.leanT = 0.4; N.reach(0, 0.3, 1.16, 0.5); N.reach(1, -0.3, 1.16, 0.5); }
      else { N.free(0); N.free(1); }
      return;
    }
    this.atBarT = atBar ? this.atBarT + dt : 0;
    // someone at the bar: go over, lean on the counter, ask
    if (atBar && this.atBarT > 0.8) {
      const z = this.along(PLAY.pos), p = this.roomPt(this.X.pour + 0.08, z, this._v);
      if (Math.abs(this.myZ() - z) > 0.5 || !this.attending) N.goTo(p.x, p.z, this.faceYaw);
      if (!this.attending) { this.attending = true; setTimeout(() => { if (this.attending && !SHOP.open && !this.cur && !this.orders.length) this.say('what', 25); }, 600); }
      this.props.rag.visible = false; this.props.glass.visible = false;
      if (N.arrived()) { N.leanT = 0.5; N.reach(0, 0.3, 1.16, 0.5); N.reach(1, -0.3, 1.16, 0.5); }
      else { N.free(0); N.free(1); }
      if (SHOP.open && !this.saidBroke && INV.money < Math.min(...MENU_BAR.map((id) => ITEMS[id].price))) { this.saidBroke = true; this.say('broke'); }
      return;
    }
    if (this.attending) { this.attending = false; this.saidBroke = false; this.pickIdle(); }
    if (!N.arrived()) { N.free(0); N.free(1); this.props.rag.visible = this.act === 'wipe'; this.props.glass.visible = false; return; }
    this.actT -= dt;
    if (this.actT <= 0) { this.pickIdle(); return; }
    N.faceYaw = this.faceYaw;
    if (this.act === 'polish') {
      // a glass in the left hand, the rag going round in it
      const a = t * 4.2;
      N.reach(0, 0.06, 1.12 + Math.sin(t * 0.7) * 0.02, 0.36);
      N.reach(1, 0.0 + Math.cos(a) * 0.035, 1.2 + Math.sin(a) * 0.025, 0.38);
      N.leanT = 0.05; N.lookTW = inside ? N.lookTW * 0.5 : 0;
      if ((this.fT = (this.fT || 0) - dt) <= 0) { this.fT = 0.5 + Math.random() * 0.6; FOLEY.polish(N.handWorld(1, this._w)); }
      if (!inside || Math.sin(t * 0.3) > 0.3) { N.lookAt(N.toWorld(0.05, 1.15, 0.4, this._v), 0.8); }
    } else if (this.act === 'wipe') {
      // the rag in wide circles on the counter
      const a = t * 2.4;
      N.reach(1, -0.05 + Math.cos(a) * 0.18, 1.15, 0.55 + Math.sin(a) * 0.1);
      N.reach(0, 0.3, 1.15, 0.45); N.leanT = 0.45;
      const stroke = Math.floor(a / Math.PI); if (stroke !== this.fStroke) { this.fStroke = stroke; FOLEY.wipe(N.handWorld(1, this._w), 1); }
      if (!inside) N.lookAt(N.toWorld(-0.05, 1.1, 0.6, this._v), 0.6);
    } else if (this.act === 'stand') {
      N.free(1); N.reach(0, 0.3, 1.15, 0.45, 0.7); N.leanT = 0.2;
      if (!inside) N.lookAt(N.toWorld(Math.sin(t * 0.4) * 3, 1.5, 4, this._v), 0.7);
    } else { N.free(0); N.free(1); this.pickIdle(); }
    const lostLately = G.time - (this.lostT || -99) < 25;
    this.props.rag.visible = (this.act === 'polish' || this.act === 'wipe') && !lostLately;
    this.props.glass.visible = this.act === 'polish' && !lostLately;
    this.props.glass.geometry = VESSEL.geo.glassfalse;
  },
  /* ---- serving: back bar, bottle, glass on the counter, pour, push it over ---- */
  updServe(dt) {
    const N = this.npc;
    if (!this.cur) {
      const o = this.orders.shift(), zc = this.along(o.to);
      // now and then he pours where he stands and sends it sliding down the bar
      const myZ = clamp(this.myZ(), this.Z0, this.Z1), dz = Math.abs(myZ - zc);
      const slideLong = ITEMS[o.id].kind !== 'carry' && dz > 1.4 && dz < 4.5 && Math.random() < 0.5;
      this.cur = { o, z: slideLong ? myZ : zc, st: 'toBack', t: 0, slideLong };
      this.props.rag.visible = false; this.props.glass.visible = false;
      this.attending = false;
    }
    const S = this.cur, it = ITEMS[S.o.id], carry = it.kind === 'carry';
    S.t += dt;
    const go = (st) => { S.st = st; S.t = 0; };
    switch (S.st) {
      case 'toBack': {   // to the back bar
        const p = this.roomPt(this.X.back, S.z, this._v); N.goTo(p.x, p.z, this.backYaw); N.free(0); N.free(1);
        if (N.arrived() && N.facing(0.25)) go('grab');
        break;
      }
      case 'grab': {     // reach up for a bottle
        const u = clamp(S.t / 0.55, 0, 1);
        N.reach(1, -0.12, 1.15 + 0.3 * Math.sin(u * Math.PI), 0.38 + 0.14 * Math.sin(u * Math.PI));
        N.lookAt(N.toWorld(-0.1, 1.45, 0.6, this._v), 1);
        if (S.t > 0.3 && !S.bottle) { S.bottle = true; FOLEY.bottleOut(N.handWorld(1, this._v)); }
        if (S.t > 0.6) go('toPour');
        break;
      }
      case 'toPour': {   // back to the counter with it
        const p = this.roomPt(this.X.pour, S.z, this._v); N.goTo(p.x, p.z, this.faceYaw);
        N.reach(1, -0.14, 1.05, 0.28);
        if (N.arrived() && N.facing(0.2)) go(carry ? 'setBottle' : 'glass');
        break;
      }
      case 'glass': {    // a glass from under the counter onto it
        const u = clamp(S.t / 0.55, 0, 1), sp = this.pourLocal();
        N.reach(1, -0.14, 1.05, 0.28);
        if (u < 0.5) N.reach(0, 0.18, 0.9, 0.36);
        else N.reach(0, sp.x + 0.02, sp.y + 0.05, sp.z - 0.04);
        if (u >= 0.5 && !S.glassOut) { S.glassOut = true; this.props.glass.geometry = VESSEL.geo[it.vessel + 'false']; FOLEY.setDown(this.pourWorld(this._w), 0.7, it.vessel); }
        if (S.t > 0.7) go('pour');
        break;
      }
      case 'pour': {     // tip the bottle over the glass
        const sp = this.pourLocal(), u = clamp(S.t / 1.1, 0, 1);
        N.reach(0, sp.x + 0.08, sp.y + 0.03, sp.z - 0.08, 0.6);
        N.reach(1, sp.x - 0.06, sp.y + 0.3, sp.z - 0.1);
        S.tilt = Math.sin(Math.min(1, u * 1.25) * Math.PI) * 1.9;
        N.lookAt(N.toWorld(sp.x, sp.y, sp.z, this._v), 1);
        if (!S.poured && u > 0.15) { S.poured = true; FOLEY.pour(this.pourWorld(this._w), 0.8); }
        if (u > 0.55) this.props.glass.geometry = VESSEL.geo[it.vessel + 'true'];
        if (S.t > 1.2) { S.tilt = 0; go('stow'); }
        break;
      }
      case 'stow': {     // the bottle goes back under the counter
        N.reach(1, -0.2, 0.9, 0.32); N.free(0);
        if (S.t > 0.35 && S.bottle) { S.bottle = false; FOLEY.setDown(N.handWorld(1, this._v), 0.45, 'bottle'); }
        if (S.t > 0.45) go('push');
        break;
      }
      case 'push': {     // push it across (or send it down the bar)
        const sp = this.pourLocal(), u = clamp(S.t / 0.3, 0, 1);
        N.reach(1, sp.x - 0.03, sp.y + 0.06, sp.z - 0.12 - u * (S.slideLong ? 0.05 : 0.18));
        if (S.slideLong) N.lookAt(this._v.copy(S.o.to), 1);
        if (S.t > 0.12 && !S.sent) {
          S.sent = true; this.props.glass.visible = false; S.glassOut = false;
          GLASS.serve(S.o.id, this.C, S.o.to, this.pourWorld(this._w));
        }
        if (S.t > 0.45) { this.cur = null; this.attending = false; this.atBarT = 0.8; }
        break;
      }
      case 'setBottle': { // a bottle to take away: set it down in front of the customer
        const sp = this.pourLocal();
        N.reach(1, sp.x - 0.04, sp.y + 0.12, sp.z - 0.02);
        if (S.t > 0.45 && !S.given) {
          S.given = true; S.bottle = false; FOLEY.setDown(this.pourWorld(this._w), 0.9, 'bottle');
          INV.add(S.o.id); TOAST.show(it.name + ' gekauft. Trinken mit T oder im Menü unter „Tasche“.', 'long');
        }
        if (S.t > 0.8) { this.cur = null; this.attending = false; this.atBarT = 0.8; }
        break;
      }
    }
    this.props.bottle.visible = !!S.bottle;
    this.props.glass.visible = !!S.glassOut;
  },
  // the spot on the counter in front of him where he pours, in his character space / in the world
  pourLocal() { this.pourWorld(this._w); return this.npc.toLocal(this._w, this._lp || (this._lp = new THREE.Vector3())); },
  pourWorld(out) {
    const z = this.cur ? this.cur.z : this.myZ(), w = rwp(this.R, this.X.pourSpot, this.R.floorY, z);
    return out.set(w.x, this.C ? this.C.y + this.C.top : w.y + 1.13, w.z);
  },
  // the things in his hands (or on the counter) follow
  placeProps() {
    const N = this.npc, P = this.props, vis = N.ch.root.visible, mat = N.mat;
    const S = this.cur;
    if (P.glass.visible) {
      if (S && S.glassOut) { this.pourWorld(this._v); this._m.makeRotationY(N.yaw); this._m.setPosition(this._v); }
      else { N.handWorld(0, this._v); this._m.makeRotationY(N.yaw); this._m.setPosition(this._v.x, this._v.y - 0.04, this._v.z); }
      P.glass.matrix.copy(this._m); P.glass.matrixWorldNeedsUpdate = true;
    }
    if (P.bottle.visible) {
      // held at the neck-ish, upright, tipped forward when pouring
      N.handWorld(1, this._v);
      this._m.makeTranslation(this._v.x, this._v.y, this._v.z);
      this._q.makeRotationY(N.yaw); this._m.multiply(this._q);
      this._q.makeRotationX(S ? S.tilt || 0 : 0); this._m.multiply(this._q);
      this._q.makeTranslation(0, -0.13, 0); this._m.multiply(this._q);
      P.bottle.matrix.copy(this._m); P.bottle.matrixWorldNeedsUpdate = true;
    }
    if (P.rag.visible) {
      N.handWorld(1, this._v); this._m.makeRotationY(N.yaw + G.time * 2); this._m.setPosition(this._v.x, this._v.y - 0.03, this._v.z);
      P.rag.matrix.copy(this._m); P.rag.matrixWorldNeedsUpdate = true;
    }
    if (P.shotgun && P.shotgun.visible) {
      // from the right hand (the grip) along to the left (the forend)
      N.handWorld(1, this._v); N.handWorld(0, this._w);
      const q = this._q.lookAt(this._w, this._v, this._up || (this._up = new THREE.Vector3(0, 1, 0)));
      this._m.copy(q); this._m.setPosition(this._v);
      P.shotgun.matrix.copy(this._m); P.shotgun.matrixWorldNeedsUpdate = true;
    }
    for (const k in P) { if (!vis) P[k].visible = false; P[k].material = mat || G.litMat; }
  },
  /* ---- sounds ---- */
  glassKnock(k) {
    GSFX.run(() => {
      const c = SFX.ctx, { g, t } = GSFX.out(0.5 * k, this.npc.pos);
      SFX.noiseHit(t, g, { type: 'lowpass', freq: 1000, q: 0.9, gain: 0.25 * k, attack: 0.001, decay: 0.045 });
      GLASS.ring(c, g, t + 0.003, 0.7 * k, 'glass');
    });
  },
  // liquid into a glass: a gurgling stream whose pitch rises as the glass fills
  pourSound(dur) {
    GSFX.run(() => {
      const { g, t } = GSFX.out(0.5, this.npc.pos), n = Math.floor(dur / 0.045);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        SFX.noiseHit(t + i * 0.045 + Math.random() * 0.02, g, { type: 'bandpass', freq: 500 + u * 900 + Math.random() * 250, q: 6, gain: 0.08 + 0.06 * Math.sin(u * Math.PI), attack: 0.004, decay: 0.05 });
      }
      SFX.noiseHit(t, g, { type: 'bandpass', freq: 1800, q: 0.8, gain: 0.04, attack: 0.05, decay: dur });
    });
  }
};
// what Hank remembers of you lasts between sessions (until the memories are reset in the settings)
SAVE.part('hank', () => ({ mem: BARKEEP.mem.slice(-10), served: BARKEEP.served, damage: BARKEEP.damage, att: +BARKEEP.att.toFixed(3), grudge: +BARKEEP.grudge.toFixed(3), body: BARKEEP.npc ? BARKEEP.npc.hp.save() : null,
  whoI: BARKEEP.whoI, gone: BARKEEP.st === 'gone', diedAt: BARKEEP.diedAt || null, killedBy: BARKEEP.killedBy || null, cause: BARKEEP.cause || null }), (d) => {
  if (!d) return;
  // who is behind the bar (a successor, or nobody since the body was taken away)
  BARKEEP.diedAt = d.diedAt || null; BARKEEP.killedBy = d.killedBy || null; BARKEEP.cause = d.cause || null;
  const want = clamp(d.whoI | 0, 0, BARKEEP.WHO.length - 1);
  if (want !== BARKEEP.whoI && BARKEEP.npc) { BARKEEP.npc.dispose(); BARKEEP.whoI = want; BARKEEP.makeNpc(BARKEEP.scene0); BARKEEP.st = 'idle'; BARKEEP.pickIdle(); }
  if (d.gone) { if (BARKEEP.npc) BARKEEP.npc.dispose(); BARKEEP.npc = null; BARKEEP.st = 'gone'; }
  BARKEEP.grudge = clamp(+d.grudge || 0, 0, 1);
  if (d.body && BARKEEP.npc && !d.gone) { BARKEEP.npc.hp.load(d.body); if (BARKEEP.npc.hp.dead) BARKEEP.st = 'dead'; else if (BARKEEP.npc.hp.open().some((w) => w.kind === 'shot' && !w.bandaged)) { BARKEEP.st = 'hurt'; BARKEEP.hurtT = 0; } }
  BARKEEP.att = clamp(+d.att || 0, -1, 1);
  BARKEEP.damage = { holes: Math.max(0, (d.damage && d.damage.holes) | 0), glass: Math.max(0, (d.damage && d.damage.glass) | 0) };
  BARKEEP.mem = Array.isArray(d.mem) ? d.mem.filter((x) => typeof x === 'string').map((x) => x.slice(0, 200)).slice(-10) : [];
  BARKEEP.served = Math.max(0, d.served | 0);
});
