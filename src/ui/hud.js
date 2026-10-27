/* ---------- HUD: perf readout, gait info, slow motion, sound toggle, hints ---------- */
const HUD = {
  aimMode: 'aim', clockT: 0, vitT: 0,
  /* the buttons say what they do right now, and only what makes sense now shows:
     unarmed: Schlag + Zielen (draws); in a fight: Schlag + Deckung + a small revolver button; armed: Feuer +
     Wegstecken, Laden only when there is room in the cylinder; peaceful things (Reden, Hinsetzen, Bestellen …) in
     the column of context buttons, never in place of the fist */
  buttons() {
    const fight = FIST.inFight(), armed = GUN.state !== 'holster';
    const mode = armed ? 'aim' : fight ? 'block' : 'aim';
    const key = mode + '/' + armed + '/' + GUN.wantAim + '/' + (GUN.ammo < 6 && GUN.reserve > 0) + '/' + !!GUN.reload + '/' + fight + '/' + GUN.reloadThenHolster;
    if (key === this.btnKey) return;
    this.btnKey = key; this.aimMode = mode;
    const ba = this.$('bAim'), bg = this.$('bGun'), br = this.$('bReload'), bt = this.$('bTalk');
    ba.textContent = mode === 'block' ? 'Deckung' : GUN.wantAim ? 'Wegstecken' : 'Zielen';
    ba.classList.toggle('block', mode === 'block');
    bg.hidden = !(fight && !armed);
    br.hidden = !(((armed || !fight) && GUN.ammo < 6 && GUN.reserve > 0) || GUN.reload);
    document.getElementById('app').classList.toggle('fighting', fight || (armed && !GUN.reloadThenHolster));
    void bt;
  },
  /* ---- the fight cue round the cross: you see a blow coming, you see that you caught it, and that now is the moment
     to hit back. flash(kind, text): 'block' | 'hit' for a moment; the steady ones ('warn', 'counter') come from tick ---- */
  cueFlash(kind, text, secs) { this.cueHold = { kind, text, until: G.time + (secs || 0.6) }; this.cueKey = null; },
  fightCue() {
    let kind = '', text = '';
    const H = this.cueHold;
    if (H && G.time < H.until) { kind = H.kind; text = H.text; }
    else if (FIST.counterReady()) { kind = 'counter'; text = 'Konter!'; }
    else if (GUN.state === 'holster') {
      for (const N of NPCS.list) {
        const F = N.fight;
        if (F && F.on && F.st === 'wind' && !N.hp.busy() && Math.hypot(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z) < 3.2) { kind = FIST.blocking ? 'warn guard' : 'warn'; break; }
      }
      if (!kind && FIST.blocking) kind = 'guard';
    }
    if (FIST.blocking !== this.cueBlk) { this.cueBlk = FIST.blocking; this.$('bAim').classList.toggle('on', FIST.blocking); }
    const key = kind + '/' + text + '/' + (H ? H.until : 0);
    if (key === this.cueKey) return;
    this.cueKey = key;
    const el = this.cueEl || (this.cueEl = this.$('cue'));
    el.className = ''; void el.offsetWidth;   // (restart the animation)
    if (kind) el.className = kind;
    if (kind === 'counter') el.style.setProperty('--cueDur', Math.max(0.1, FIST.COUNTER_WIN - (G.time - FIST.counterT)).toFixed(2) + 's');
    this.$('cueT').textContent = text;
    this.$('bFire').classList.toggle('counter', kind === 'counter');
  },
  // the clock only shows when it means something: on waking, after hours went by, at the full hour, with the bag open
  showClock(secs) { this.clockT = Math.max(this.clockT, secs || 5); },
  // life and stamina under the cross: only in a fight or while hurt
  vitals(dt) {
    const show = FIST.inFight() || PHP.hp < 0.995 || FIST.stamina < 0.995;
    this.vitT = show ? 2.5 : Math.max(0, this.vitT - dt);
    const el = this.vitEl || (this.vitEl = this.$('vitals'));
    const on = this.vitT > 0;
    if (on !== this.vitOn) { this.vitOn = on; el.classList.toggle('on', on); }
    if (!on) return;
    const hp = PHP.hp.toFixed(3), st = FIST.stamina.toFixed(3);
    if (hp !== this.lastHp) { this.lastHp = hp; this.$('vLife').style.transform = `scaleX(${hp})`; el.classList.toggle('lowLife', PHP.hp < 0.3); }
    if (st !== this.lastSt) { this.lastSt = st; this.$('vStam').style.transform = `scaleX(${st})`; el.classList.toggle('lowStam', FIST.stamina < 0.2); }
  },
  tick(dt) {
    this.buttons(); this.vitals(dt); this.fightCue();
    const h = TIME.hour(), full = Math.floor(h);
    if (this.lastHour !== undefined && full !== this.lastHour) this.showClock(4);
    this.lastHour = full;
    this.clockT = Math.max(0, this.clockT - dt);
    const on = this.clockT > 0 || WHEEL.open || MENU.open || SLEEP.busy();
    if (on !== this.clockOn) { this.clockOn = on; this.$('name').classList.toggle('on', on); }
  },
  init(onHud) {
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    $('hudBtn').addEventListener('click', onHud);
    $('slowBtn').addEventListener('click', () => this.setSlow(!G.slow));
    $('soundBtn').addEventListener('click', () => this.setSound(!SFX.on));
    this.setSound(SFX.on, true);
    this.winT = 0; this.winN = 0; this.lastText = 0; this.costs = [];
    this.fpsEl = $('fps');
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.hint(coarse ? 'Unten links ziehen: laufen · sonst wischen: Kamera · Schlag antippen oder halten · im Kampf Deckung halten · Zielen zieht den Revolver · ☰ Menü' : 'WASD gehen · Shift rennen · Maus: Kamera · Linksklick schlagen, halten: Overhand · Rechtsklick zielen, im Kampf: Deckung · Q Revolver · R laden · E benutzen · Tab Tasche · Esc Menü');
    if (coarse) { document.getElementById('app').classList.add('touch'); GUN.touch = true; }
    this.hintTimer = setTimeout(() => this.hideHint(), 14000);
    // the place and the time at the start, and after every jump in time (sleep, blackout)
    this.showClock(8);
    TIME.onSkip((m, soft) => { if (!soft) this.showClock(7); });
  },
  setSlow(on) {
    G.slow = on;
    this.$('slowBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    this.$('slowBtn').textContent = on ? 'Zeitlupe ¼' : 'Zeitlupe';
  },
  setSound(on, silent) {
    if (!silent) SFX.setOn(on);
    const b = this.$('soundBtn');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Ton ausschalten' : 'Ton einschalten');
    this.$('soundOn').hidden = !on; this.$('soundOff').hidden = on;
    this.audioState();
  },
  // a small dot on the speaker while sound is switched on but the browser has not let it start yet
  audioState() {
    const waiting = SFX.on && !(SFX.ctx && SFX.ctx.state === 'running');
    this.$('soundBtn').classList.toggle('waiting', waiting);
    this.$('soundBtn').title = waiting ? 'Ton startet bei der ersten Berührung' : '';
  },
  hintTimer: 0,
  hint(t) { clearTimeout(this.hintTimer); const h = this.$('hint'); h.textContent = t; h.classList.remove('fade'); },
  hideHint() { this.$('hint').classList.add('fade'); },
  firstInput() {
    this.audioState();
    if (!this.used) { this.used = true; clearTimeout(this.hintTimer); this.hintTimer = setTimeout(() => this.hideHint(), 2500); }
  },
  // frame rate, refreshed four times a second
  frame(frameMs, cost, calls, tris, now) {
    this.winT += frameMs; this.winN++;
    if (now - this.lastText > 250 && this.winN > 0) {
      const fps = (1000 * this.winN) / this.winT;
      this.fpsEl.textContent = String(Math.round(fps));
      this.fpsEl.style.color = fps >= 55 ? 'var(--good)' : fps >= 30 ? 'var(--warn)' : 'var(--bad)';
      this.winT = 0; this.winN = 0; this.lastText = now;
    }
  }
};

/* touch buttons: each reacts on finger down; the aim button toggles */
function initGunPad(onAction) {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); fn(); onAction('gun'); });
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  on('bFire', () => GUN.attack(false));
  const bf = document.getElementById('bFire');
  for (const ev of ['pointerup', 'pointercancel']) bf.addEventListener(ev, () => FIST.up());
  // the second button: the guard while someone fights you (held), otherwise aim (draws the revolver) / put it away
  on('bAim', () => { if (HUD.aimMode === 'block') FIST.setBlock(true); else GUN.aimButton(); });
  const ba = document.getElementById('bAim');
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) ba.addEventListener(ev, () => FIST.setBlock(false));
  on('bGun', () => GUN.aimButton());
  on('bReload', () => GUN.pressReload());

}
