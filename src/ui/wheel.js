/* ---------- the quick wheel: what you carry, one gesture away ----------
   PC: hold Tab, point at a slot with the mouse, let go (or click a slot). Touch: the bag button, then tap a slot.
   Gamepad: hold the d-pad up, point with the right stick, let go. Time slows down while the wheel is open.
   Slots are built fresh each time from what you carry, so new things only need an entry in slots(). */
const WHEEL = {
  open: false, sel: -1, list: [], aim: new THREE.Vector2(), N: 6,
  ICON: {
    gun: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11h20l2-2h3v5h-4l-1 2H14l-2 3v6H7l1-7-4-2z" fill="currentColor"/></svg>',
    bottle: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6v6l3 4v16H10V13l3-4z" fill="currentColor"/><rect x="12" y="16" width="8" height="6" fill="#1b120b" opacity=".45"/></svg>',
    bandage: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="9" width="22" height="14" rx="7" fill="currentColor"/><path d="M14 12h4v3h3v4h-3v3h-4v-3h-3v-4h3z" fill="#7a1c1c"/></svg>',
    fist: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 13c0-2 2-3 4-3h10c2 0 3 2 3 4v6c0 4-3 7-7 7h-4c-4 0-6-3-6-6z" fill="currentColor"/></svg>'
  },
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('wheel'); this.ring = $('wheelRing'); this.mid = $('wheelMid');
    $('bagBtn').addEventListener('click', () => this.toggle());
    $('bBag').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.toggle(); });
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el || e.target === this.mid) this.close(); });
    document.addEventListener('mousemove', (e) => {
      if (!this.open) return;
      if (document.pointerLockElement) this.aim.add(new THREE.Vector2(e.movementX, e.movementY)).clampLength(0, 120);
      else { const r = this.ring.getBoundingClientRect(); this.aim.set(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); }
      this.pick();
    });
  },
  // what can be in the wheel right now
  slots() {
    const s = [];
    // (no "draw the revolver" here: it is out only while you aim)
    for (const id of Object.keys(INV.items)) {
      const it = ITEMS[id];
      if (it.kind === 'aid') s.push({ icon: 'bandage', label: it.name, sub: INV.items[id] + ' Stück', run: () => this.selfAid(), ok: !FALL.busy() && !DRINK.busy() });
      if (it.kind === 'carry') s.push({ icon: it.vessel === 'bottle' ? 'bottle' : 'bottle', label: it.name, sub: (INV.sips[id] ?? it.sips) + ' Schlucke', run: () => DRINK.start(id), ok: !DRUNK.blocked() && !(DRINK.busy() && DRINK.src === 'glass') });
    }
    return s;
  },
  // a dressing on your own cuts and holes: some of it back, and the bag one roll lighter
  selfAid() {
    if (PHP.hp > 0.92) { TOAST.show('Du bist nicht verletzt.'); return; }
    if (!INV.remove('bandage')) return;
    PHP.hp = Math.min(1, PHP.hp + 0.22); FOLEY.cloth(PLAY.pos, 1.3);
    TOAST.show('Du verbindest dich notdürftig.');
  },
  toggle() { if (this.open) this.close(); else this.show(); },
  show() {
    if (this.open || MENU.open || SHOP.open || DRUNK.out) return;
    this.open = true; this.sel = -1; this.aim.set(0, 0);
    this.list = this.slots();
    this.ring.textContent = '';
    for (let i = 0; i < this.N; i++) {
      const a = (i / this.N) * TAU - Math.PI / 2, s = this.list[i];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wSlot' + (s ? '' : ' empty');
      b.style.left = (50 + Math.cos(a) * 36) + '%'; b.style.top = (50 + Math.sin(a) * 36) + '%';
      if (s) {
        b.innerHTML = this.ICON[s.icon] + '<span></span>' + (s.sub ? '<small></small>' : '');
        b.querySelector('span').textContent = s.label; if (s.sub) b.querySelector('small').textContent = s.sub;
        b.disabled = !s.ok;
        b.addEventListener('pointerenter', () => { this.sel = i; this.mark(); });
        b.addEventListener('click', (e) => { e.stopPropagation(); this.sel = i; this.use(); });
      } else b.disabled = true;
      this.ring.appendChild(b);
    }
    this.mid.innerHTML = '<b></b><small></small>';
    this.mid.querySelector('b').textContent = money(INV.money);
    this.mid.querySelector('small').textContent = GUN.touch ? 'Antippen' : 'Tab loslassen';
    this.el.hidden = false;
    GUN.setAim(false); FIST.up();
  },
  pick() {
    if (this.aim.length() < 30) { this.sel = -1; this.mark(); return; }
    const a = Math.atan2(this.aim.y, this.aim.x) + Math.PI / 2, i = ((Math.round((a / TAU) * this.N) % this.N) + this.N) % this.N;
    this.sel = this.list[i] && this.list[i].ok ? i : -1; this.mark();
  },
  mark() { [...this.ring.children].forEach((b, i) => b.classList.toggle('sel', i === this.sel)); },
  use() { const s = this.list[this.sel]; this.close(); if (s && s.ok) s.run(); },
  close() { if (!this.open) return; this.open = false; this.el.hidden = true; },
  // gamepad: right stick points
  pad(x, y) { if (!this.open) return; if (Math.hypot(x, y) > 0.5) { this.aim.set(x * 100, y * 100); this.pick(); } }
};
