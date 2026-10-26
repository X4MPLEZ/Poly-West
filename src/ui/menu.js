/* ---------- pause menu: the game stops, three tabs (game, settings, controls) ----------
   Opened with Esc / P, the menu button top right, or Start on a gamepad. The settings controls are built from
   SETTINGS.SPEC, so a new setting only needs a line there. */
const MENU = {
  open: false, tab: 'game', armed: 0,
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('menu');
    $('menuBtn').addEventListener('click', () => this.toggle());
    $('mClose').addEventListener('click', () => this.close());
    $('mResume').addEventListener('click', () => this.close());
    $('mSave').addEventListener('click', () => { const ok = SAVE.write(); this.note(ok ? 'Gespeichert.' : 'Speichern ist in diesem Browser nicht möglich.'); });
    $('mNew').addEventListener('click', () => {
      // two taps, so that nobody loses the game by accident
      if (G.time - this.armed < 4 && this.armedNew) { SAVE.clear(); SAVE.write = () => true; location.reload(); return; }
      this.armedNew = true; this.armed = G.time; $('mNew').textContent = 'Wirklich neu anfangen? Nochmal tippen';
      setTimeout(() => { this.armedNew = false; $('mNew').textContent = 'Neues Spiel'; }, 4000);
    });
    $('mDev').addEventListener('click', () => { this.close(); DEV.toggle(true); });
    $('mReset').addEventListener('click', () => { SETTINGS.reset(); this.buildSettings(); });
    for (const b of this.el.querySelectorAll('[data-tab]')) b.addEventListener('click', () => this.show(b.dataset.tab));
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    this.buildSettings();
    SETTINGS.on('dev', (on) => { $('mDev').hidden = !on; });
    SETTINGS.on('showFps', (on) => { $('fpsBox').hidden = !on; });
    // leaving the tab pauses the game
    document.addEventListener('visibilitychange', () => { if (document.hidden && !G.manual) this.show('game', true); });
  },
  toggle() { if (this.open) this.close(); else this.show('game', true); },
  show(tab, openIt) {
    if (openIt && !this.open) {
      this.open = true; this.el.hidden = false;
      INPUT.keys.clear(); FIST.up(); GUN.setAim(false);
      try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* ignore */ }
      if (SFX.ctx && SFX.ctx.state === 'running') SFX.ctx.suspend();
      this.note('');
      document.getElementById('app').classList.add('paused');
    }
    this.tab = tab;
    if (tab === 'bag') this.buildBag();
    for (const b of this.el.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
    for (const p of this.el.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== tab;
    const first = this.el.querySelector(`[data-pane="${tab}"] button, [data-pane="${tab}"] input`);
    if (first && openIt) first.focus({ preventScroll: true });
  },
  close() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true;
    document.getElementById('app').classList.remove('paused');
    if (SFX.ctx && SFX.ctx.state === 'suspended' && SFX.on) SFX.ctx.resume();
    document.getElementById('gl').focus({ preventScroll: true });
  },
  buildBag() {
    document.getElementById('mMoney').textContent = money(INV.money);
    const box = document.getElementById('mBag'); box.textContent = '';
    const ids = Object.keys(INV.items);
    if (!ids.length) { const p = document.createElement('p'); p.className = 'mSmall'; p.textContent = 'Die Tasche ist leer. Im Saloon gibt es was zu trinken.'; box.appendChild(p); return; }
    for (const id of ids) {
      const it = ITEMS[id], row = document.createElement('div'); row.className = 'mItem';
      const name = document.createElement('span'); name.textContent = (INV.items[id] > 1 ? INV.items[id] + '× ' : '') + it.name;
      if (it.kind === 'carry') { const sm = document.createElement('small'); sm.textContent = ' ' + (INV.sips[id] ?? it.sips) + ' Schlucke übrig'; name.appendChild(sm); }
      row.appendChild(name);
      if (it.kind === 'carry') { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Trinken'; b.addEventListener('click', () => { this.close(); DRINK.start(id); }); row.appendChild(b); }
      box.appendChild(row);
    }
  },
  note(t) { document.getElementById('mNote').textContent = t; },
  buildSettings() {
    const box = document.getElementById('mSettings');
    box.textContent = '';
    for (const s of SETTINGS.SPEC) {
      if (s.group) { const h = document.createElement('h3'); h.textContent = s.group; box.appendChild(h); continue; }
      const row = document.createElement('div'); row.className = 'mRow';
      const id = 'set_' + s.key, lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = s.label; row.appendChild(lab);
      const v = SETTINGS.v[s.key];
      if (s.type === 'range') {
        const inp = document.createElement('input'); inp.type = 'range'; inp.id = id; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = v;
        const out = document.createElement('output'); out.htmlFor = id;
        const fmt = (x) => (s.step < 1 ? (+x).toFixed(1) : String(Math.round(x))) + (s.unit || '');
        out.textContent = fmt(v);
        inp.addEventListener('input', () => { out.textContent = fmt(inp.value); SETTINGS.set(s.key, +inp.value); });
        row.append(inp, out);
      } else if (s.type === 'toggle') {
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = id; inp.checked = v; inp.className = 'mSwitch';
        inp.addEventListener('change', () => SETTINGS.set(s.key, inp.checked));
        row.appendChild(inp);
      } else if (s.type === 'choice') {
        const grp = document.createElement('div'); grp.className = 'mSeg'; grp.setAttribute('role', 'radiogroup'); grp.setAttribute('aria-label', s.label);
        for (const [val, text] of s.options) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', val === v ? 'true' : 'false');
          b.addEventListener('click', () => { SETTINGS.set(s.key, val); for (const o of grp.children) o.setAttribute('aria-checked', o === b ? 'true' : 'false'); });
          grp.appendChild(b);
        }
        row.appendChild(grp);
      }
      box.appendChild(row);
    }
  }
};
