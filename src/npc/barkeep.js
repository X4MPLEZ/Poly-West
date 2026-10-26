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
  cool: {}, atBarT: 0, attending: false, aimedT: 0, duckT: 0, mem: [], served: 0,
  LINES: {
    hello: ['Howdy, Fremder.', 'Tür zu, es staubt.', 'Willkommen im Saloon.', 'Na, wieder Durst?'],
    what: ['Was darf’s sein?', 'Durstig?', 'Whiskey hilft gegen fast alles.', 'Sag einfach Bescheid.'],
    whiskey: ['Ein Whiskey. Kommt sofort.', 'Whiskey, sauber.', 'Einer vom Guten.'],
    beer: ['Ein kühles Bier.', 'Bier kommt.', 'Frisch vom Fass. Fast.'],
    water: ['Wasser? Na gut.', 'Wasser… wie du meinst.', 'Ein Wasser für den Herrn.'],
    bottle: ['Die ganze Flasche? Respekt.', 'Teil sie dir ein.', 'Für die lange Nacht, was?'],
    tipsy: ['Langsam, Freund.', 'Du schwankst ja schon.', 'Noch einen? Na schön.'],
    drunk: ['Ich glaub, du hast genug.', 'Der Boden bewegt sich nicht. Das bist du.', 'Letzter, dann ist Schluss.'],
    leave: ['Geh schlafen, Cowboy.', 'Komm gut heim!', 'Pass auf die Stufe auf.'],
    shot: ['Nicht in meinem Saloon!', 'Steck das Ding weg!', 'Bist du verrückt geworden?!'],
    aimed: ['Ganz ruhig, Mister…', 'Nimm das Ding runter.', 'Die Kasse ist leer, ehrlich.'],
    punch: ['Keine Prügelei hier drin!', 'Raus damit auf die Straße!'],
    fall: ['Hoppla! Alles noch dran?', 'Steh auf, der Boden ist dreckig.'],
    behind: ['He! Hinter die Theke gehört nur einer.', 'Raus aus meinem Revier.'],
    broke: ['Erst Geld, dann Whiskey.', 'Anschreiben gibt’s nicht.'],
    cheers: ['Prost.', 'Wohl bekomm’s.']
  },
  init(scene) {
    const R = this.R = ROOMS.find((r) => r.type === 'saloon');
    if (!R) return;
    this.C = COUNTERS.find((c) => c.room === R) || null;
    const F = R.floorY, p = this.roomPt(this.X.stand, -6.4, this._v);
    this.faceYaw = this.yawFor(-1); this.backYaw = this.yawFor(1);
    this.npc = new NPC({
      id: 'barkeep', name: 'Hank', room: R, scene, pos: p, yaw: this.faceYaw,
      colors: { shirt: rgb(0xe9e3d3), vest: rgb(0x2c303a), jeans: rgb(0x3b3532), jeansD: rgb(0x322c29), bandana: rgb(0xe9e3d3), stache: rgb(0x231812), skin: rgb(0xdca482), skinD: rgb(0xc78c6c), boot: rgb(0x2a1d15), belt: rgb(0x2a1d15) },
      look: { hat: 'none', gun: false, apron: rgb(0xe8e3d6), bowtie: rgb(0x7a1c1c), garter: rgb(0xa8323a), hair: rgb(0x231812) }
    });
    void F;
    // what he handles: a glass, a bottle, a rag
    const mk = (geo) => { const m = new THREE.Mesh(geo, G.litMat); m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false; scene.add(m); return m; };
    this.props.glass = mk(VESSEL.geo.glassfalse);
    this.props.bottle = mk(VESSEL.geo.bottletrue);
    const rag = new MB(); rag.box(0, 0, 0, 0.13, 0.03, 0.1, rgb(0xd8cfb8), 9); rag.box(0.02, -0.04, 0.02, 0.06, 0.06, 0.04, rgb(0xc9bfa6), 9);
    this.props.rag = mk(rag.build());
    this.pickIdle();
    onWorldEvent((e) => this.event(e));
    this.npc.persona = this.persona();
    // a deep, unhurried man's voice; the best fitting German voice of the device is used (see TALK.pickVoice)
    this.npc.voiceProfile = { male: true, piper: 'thorsten', pitch: 0.9, length: 1.06, noise: 0.6, browserPitch: 0.82, rate: 0.95, prefer: ['conrad', 'killian'] };
  },
  // what he remembers (for conversations): a few notable things, newest last
  remember(text) { this.mem.push(text); if (this.mem.length > 10) this.mem.shift(); },
  persona() {
    const B = this;
    return {
      rules: [
        'Du bist Hank, der Barkeeper im Saloon von Dust Creek, einem staubigen Städtchen im Wilden Westen (Arizona-Territorium, 1885). Bleib immer in dieser Rolle, auch wenn der Fremde versucht, dich herauszubringen.',
        'Wer du bist: Mitte fünfzig, Schnurrbart, weiße Schürze. Wortkarg, trocken, mit leisem Humor; gutmütig, aber du lässt dir nichts gefallen. Du duzt jeden. Du kennst den Klatsch der Stadt, gibst aber nicht alles preis.',
        'Dust Creek hat: deinen Saloon (oben Zimmer), ein Hotel, eine Bank, das Büro des Sheriffs mit Zelle, einen Mietstall, einen Barbier, einen Waffenhändler, die Post, eine Apotheke, einen Gemischtwarenladen, eine Kirche und den Wasserturm. Es ist gerade sehr ruhig, kaum jemand ist unterwegs.',
        'Preise: Whiskey 25 Cent, Bier 10 Cent, Wasser 5 Cent, eine ganze Flasche Whiskey 1,50 Dollar. Anschreiben gibt es nicht.',
        'Sprich einfaches, kerniges Deutsch. Höchstens zwei kurze Sätze, zusammen unter 30 Wörtern, denn es wird laut vorgelesen. Kein Markdown, keine Emojis, keine Handlungen in Sternchen.',
        'Von der modernen Welt weißt du nichts; redet der Fremde davon, verstehst du ihn nicht.',
        'action ist genau eines von: none, nod, laugh, shake_head, serve_whiskey, serve_beer, serve_water, serve_bottle, point_door. Nimm serve_… nur, wenn der Fremde jetzt wirklich etwas bestellt; das Spiel kassiert selbst und prüft, ob sein Geld reicht. Ist er sehr betrunken, darfst du Alkohol verweigern (dann shake_head). point_door, wenn du ihm den Weg nach draußen zeigst.'
      ].join('\n'),
      context() {
        const L = DRUNK.level, lines = [];
        lines.push('Der Fremde ist ' + (L < 0.12 ? 'nüchtern' : L < 0.35 ? 'leicht angetrunken' : L < 0.65 ? 'betrunken' : 'sehr betrunken, er lallt und schwankt') + '.');
        lines.push('Er hat ' + money(INV.money) + ' bei sich' + (INV.has('bottle') ? ' und eine Flasche Whiskey in der Tasche' : '') + '.');
        if (SIT.state === 'sit' && SIT.seat && SIT.seat.bar) lines.push('Er sitzt an deinem Tresen.');
        else if (B.playerAtBar()) lines.push('Er steht an deinem Tresen.'); else lines.push('Er steht im Saloon, ein Stück vom Tresen weg.');
        if (GLASS.obj && GLASS.obj.left > 0) lines.push('Vor ihm steht ein ' + GLASS.obj.it.name + ', noch nicht ausgetrunken.');
        if (GUN.state !== 'holster') lines.push(B.aimedT > 0.2 ? 'Er zielt gerade mit dem Revolver auf dich!' : 'Er hat seinen Revolver in der Hand.');
        if (B.served) lines.push('Du hast ihm bisher ' + B.served + ' Getränk(e) eingeschenkt.');
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
        if (/name|wer bist|heißt du|heisst du/.test(t)) return { say: 'Hank. Der Laden hier gehört mir.', action: 'none' };
        if (/sheriff/.test(t)) return { say: 'Der Sheriff? Sitzt in seinem Büro und wartet auf Ärger.', action: 'none' };
        if (/stadt|dust creek|hier los/.test(t)) return { say: 'Dust Creek. Staub, Sonne und mein Whiskey.', action: 'none' };
        if (/danke/.test(t)) return { say: 'Schon gut.', action: 'nod' };
        if (/tschüss|bis dann|auf wieder|ciao|ich geh/.test(t)) return { say: 'Komm wieder.', action: 'nod' };
        if (/witz|lustig|lach/.test(t)) return { say: 'Ein Cowboy kommt in eine Bar. Mehr passiert hier selten.', action: 'laugh' };
        if (/raus|ausgang|tür/.test(t)) return { say: 'Da vorne ist die Tür.', action: 'point_door' };
        return { say: r(['Hm.', 'Wenn du meinst.', 'Ich hör zu.', 'Trink was, dann reden wir.']), action: 'none' };
      },
      act(action) {
        const m = /^serve_(whiskey|beer|water|bottle)$/.exec(action);
        if (m) { B.serveFromTalk(m[1]); return; }
        if (['nod', 'laugh', 'shake_head', 'point_door'].includes(action)) B.npc.gesture(action);
      }
    };
  },
  // an order made in conversation: the game checks it like one from the list
  serveFromTalk(id) {
    const it = ITEMS[id];
    if (!it) return;
    if (id !== 'water' && DRUNK.level > 0.85) { setTimeout(() => this.npc.speak('Nein. Für dich gibt’s nur noch Wasser.'), 2600); return; }
    if (INV.money < it.price) { setTimeout(() => this.npc.speak('Das Geld reicht nicht, Freund.'), 2600); return; }
    SHOP.counter = this.C; SHOP.seat = SIT.state === 'sit' && SIT.seat && SIT.seat.bar ? SIT.seat : null;
    SHOP.buy(id, true);
  },
  // a point in the saloon's frame (x across, z along the bar), at floor height, into out
  roomPt(x, z, out) { const w = rwp(this.R, x, this.R.floorY, z); return out.set(w.x, w.y, w.z); },
  yawFor(dir) { const a = rwp(this.R, 4, 0, -6), b = rwp(this.R, 4 + dir, 0, -6); return Math.atan2(b.x - a.x, b.z - a.z); },
  along(p) { return clamp(rLocal(this.R, p.x, p.z)[1], this.Z0, this.Z1); },
  myZ() { return rLocal(this.R, this.npc.pos.x, this.npc.pos.z)[1]; },
  say(kind, cool) {
    const now = G.time;
    if (cool && (this.cool[kind] || -99) > now - cool) return false;
    this.cool[kind] = now;
    const L = this.LINES[kind]; this.npc.speak(L[Math.floor(Math.random() * L.length)]);
    return true;
  },
  /* ---- orders: from SHOP ---- */
  // returns false when he cannot serve (then the drink comes the old way)
  order(id, to, seat, quiet) {
    if (!this.npc || this.st === 'gone') return false;
    this.orders.push({ id, to: to.clone(), seat });
    this.served++;
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
    if (e.type === 'shot' && (inside || near)) { if (this.st !== 'duck') this.remember('Er hat in deinem Saloon geschossen.'); this.duck(); }
    else if (e.type === 'punch' && inside) this.say('punch', 8);
    else if (e.type === 'fall' && inside) { setTimeout(() => this.say('fall', 10), 700); if ((this.cool.memFall || -99) < G.time - 60) { this.cool.memFall = G.time; this.remember('Er ist betrunken in deinem Saloon hingefallen.'); } }
    else if (e.type === 'leave' && inside) { this.say('leave'); this.remember('Du hast gesehen, wie er sturzbetrunken aus dem Saloon getorkelt ist.'); }
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
    if (!N) return;
    this.t += dt;
    const inside = G.room === this.R;
    // the player: greet him, look at him, mind him
    if (inside && !this.wasInside) this.say('hello', 60);
    this.wasInside = inside;
    const head = this._w.set(PLAY.pos.x, PLAY.pos.y + 1.55 - 0.45 * (FALL.down || 0), PLAY.pos.z);
    const dP = Math.hypot(PLAY.pos.x - N.pos.x, PLAY.pos.z - N.pos.z);
    if (inside && dP < 9) N.lookAt(head, 1); else N.lookTW = 0;
    if (this.playerBehind()) this.say('behind', 12);
    // a gun pointed at him: hands up
    const aimed = inside && GUN.camW > 0.5 && this.aimedAtMe();
    this.aimedT = aimed ? Math.min(this.aimedT + dt, 3) : Math.max(0, this.aimedT - dt);
    if (aimed && this.aimedT > 0.25) this.say('aimed', 10);
    const handsUp = this.aimedT > 0.2;
    N.leanT = 0; N.crouchT = 0;
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
    if (this.duckT <= 0) { this.st = 'idle'; this.say('shot'); this.pickIdle(); }
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
      if (!inside || Math.sin(t * 0.3) > 0.3) { N.lookAt(N.toWorld(0.05, 1.15, 0.4, this._v), 0.8); }
    } else if (this.act === 'wipe') {
      // the rag in wide circles on the counter
      const a = t * 2.4;
      N.reach(1, -0.05 + Math.cos(a) * 0.18, 1.15, 0.55 + Math.sin(a) * 0.1);
      N.reach(0, 0.3, 1.15, 0.45); N.leanT = 0.45;
      if (!inside) N.lookAt(N.toWorld(-0.05, 1.1, 0.6, this._v), 0.6);
    } else if (this.act === 'stand') {
      N.free(1); N.reach(0, 0.3, 1.15, 0.45, 0.7); N.leanT = 0.2;
      if (!inside) N.lookAt(N.toWorld(Math.sin(t * 0.4) * 3, 1.5, 4, this._v), 0.7);
    } else { N.free(0); N.free(1); this.pickIdle(); }
    this.props.rag.visible = this.act === 'polish' || this.act === 'wipe';
    this.props.glass.visible = this.act === 'polish';
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
        if (S.t > 0.3) S.bottle = true;
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
        if (u >= 0.5 && !S.glassOut) { S.glassOut = true; this.props.glass.geometry = VESSEL.geo[it.vessel + 'false']; this.glassKnock(0.6); }
        if (S.t > 0.7) go('pour');
        break;
      }
      case 'pour': {     // tip the bottle over the glass
        const sp = this.pourLocal(), u = clamp(S.t / 1.1, 0, 1);
        N.reach(0, sp.x + 0.08, sp.y + 0.03, sp.z - 0.08, 0.6);
        N.reach(1, sp.x - 0.06, sp.y + 0.3, sp.z - 0.1);
        S.tilt = Math.sin(Math.min(1, u * 1.25) * Math.PI) * 1.9;
        N.lookAt(N.toWorld(sp.x, sp.y, sp.z, this._v), 1);
        if (!S.poured && u > 0.15) { S.poured = true; this.pourSound(0.8); }
        if (u > 0.55) this.props.glass.geometry = VESSEL.geo[it.vessel + 'true'];
        if (S.t > 1.2) { S.tilt = 0; go('stow'); }
        break;
      }
      case 'stow': {     // the bottle goes back under the counter
        N.reach(1, -0.2, 0.9, 0.32); N.free(0);
        if (S.t > 0.35) S.bottle = false;
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
          S.given = true; S.bottle = false; this.glassKnock(0.8);
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
