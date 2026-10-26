/* ---------- HUD: perf readout, gait info, slow motion, sound toggle, hints ---------- */
const HUD = {
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
    this.hint(coarse ? 'Links ziehen: laufen · Rechts ziehen: Kamera · Schlag antippen oder halten · Ziehen: Revolver · Knopf erscheint an Sitzplätzen' : 'WASD gehen · Shift rennen · Maus: Kamera · Linksklick schlagen, halten: Overhand · Q Revolver · Rechtsklick zielen · R laden · E benutzen');
    if (coarse) { document.getElementById('app').classList.add('touch'); GUN.touch = true; }
    this.hintTimer = setTimeout(() => this.hideHint(), 14000);
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
  on('bFire', () => { if (GUN.state === 'holster') FIST.down(false); else GUN.pressFire(); });
  const bf = document.getElementById('bFire');
  for (const ev of ['pointerup', 'pointercancel']) bf.addEventListener(ev, () => FIST.up());
  on('bAim', () => GUN.setAim(!GUN.wantAim));
  on('bReload', () => GUN.pressReload());
  on('bHolster', () => GUN.toggleHolster());
}
