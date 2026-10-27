/* ---------- interaction: one system for everything one can use ----------
   Every usable thing is an entry with a place, the room it belongs to, an occupant and a verb. The best entry
   near you and in front of you is in focus; E (pad: Y, touch: the context button) uses it.
   NPCs will later look up and use the same entries (seat.occ tells who sits where). */

// how one sits on each kind of seat (seat frame: z forward, y up from the floor under the seat)
//   top: seat height, back: hips behind the seat centre, foot/footY/footW: ankles ahead / height / apart,
//   lean: upper body (+ forward), stand: where one stands before sitting down (side: beside it instead, open: no backrest,
//   come from anywhere), wood: the seat creaks
const SIT_KINDS = {
  chair:  { top: 0.5,  back: -0.03, foot: 0.44, footY: 0.085, footW: 0.15, lean: 0.05, stand: 0.3, wood: true },
  bench:  { top: 0.47, back: -0.02, foot: 0.44, footY: 0.085, footW: 0.16, lean: 0.08, stand: 0.3, wood: true },
  pew:    { top: 0.47, back: -0.02, foot: 0.42, footY: 0.085, footW: 0.13, lean: 0.0, stand: 0.3, wood: true },
  sofa:   { top: 0.43, back: -0.05, foot: 0.52, footY: 0.085, footW: 0.18, lean: -0.1, stand: 0.42 },
  barber: { top: 0.6,  back: -0.04, foot: 0.43, footY: 0.33, footW: 0.12, lean: -0.08, stand: 0.38, arms: [0.31, 0.88, 0.1] },
  stool:  { top: 0.78, back: -0.02, foot: 0.19, footY: 0.36, footW: 0.17, lean: 0.14, stand: -0.02, side: 0.42, open: true, wood: true }
};

const INTERACT = {
  items: [], wide: [], grid: new Grid(4), focus: null, acts: [], key: '',
  add(it) { it.id = this.items.length; this.items.push(it); return this.grid.add(it); },
  near(x, z, r) { return this.grid.near(x, z, r); },
  init() {
    for (const S of SEATS) {
      const it = this.add(makeSeat(S));
      // where to stand: in front, clear of the seat's own collider (a bench); if a table or desk is in the way,
      // beside the seat instead, on whichever side is free (a chair tucked under a table is slid onto from the side)
      const y = it.y + 0.1, free = (x, z) => { const [cx, cz] = collide(x, z, y); return Math.hypot(cx - x, cz - z) < 0.1; };
      if (!it.k.side) {
        const [cx, cz] = collide(it.sx, it.sz, y);
        if (Math.hypot(cx - it.sx, cz - it.sz) < 0.05) continue;
        if (Math.hypot(cx - it.x, cz - it.z) > it.k.stand * 0.85 && Math.hypot(cx - it.sx, cz - it.sz) < 0.4) { it.sx = cx; it.sz = cz; continue; }
        const sides = [1, -1].filter((sd) => free(it.x + it.fz * 0.45 * sd, it.z - it.fx * 0.45 * sd));
        if (sides.length) { it.sides = sides; it.sideD = 0.45; it.sx = it.x - it.fx * 0.02; it.sz = it.z - it.fz * 0.02; }
      } else { it.sides = [1, -1]; it.sideD = it.k.side; }
    }
    // long things (bar counters) are checked by distance to their whole length, not through the grid
    for (const C of COUNTERS) this.wide.push(Object.assign(makeCounter(C), { id: 'bar' + this.wide.length }));
    AID.init();
    const $ = (id) => document.getElementById(id);
    this.ui = [{ row: $('prompt1'), txt: $('promptTxt'), btn: $('bUse') }, { row: $('prompt2'), txt: $('promptTxt2'), btn: $('bUse2') }];
    this.ui.forEach((u, i) => {
      u.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); u.btn.classList.add('down'); this.use(i); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) u.btn.addEventListener(ev, () => u.btn.classList.remove('down'));
    });
  },
  // E (pad Y, the first button) does the first thing on offer, R (pad B, the second button) the second
  use(i) {
    const a = this.acts[i || 0];
    if (a) { a.run(); this.update(true); return true; }
    return false;
  },
  // a straight walk from a to b must not lead through furniture (tables between you and a chair, say)
  clear(ax, az, bx, bz, y) {
    const L = Math.hypot(bx - ax, bz - az);
    for (let s = 0.3; s < L - 0.45; s += 0.3) {
      const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L, [cx, cz] = collide(x, z, y);
      if (Math.hypot(cx - x, cz - z) > 0.22) return false;
    }
    return true;
  },
  update(force) {
    if (this.seated !== SIT.busy()) { this.seated = SIT.busy(); document.getElementById('app').classList.toggle('seated', this.seated); }
    let best = null, acts = [];
    const free = !DRINK.busy() && !SHOP.open && !DRUNK.blocked();
    if (AID.owns()) { best = AID.entry; acts = AID.acts(); }
    else if (SIT.state === 'sit') {
      best = SIT.seat;
      if (free) acts = best.bar ? barActions(COUNTERS.find((c) => c.room === best.room) || this.wide[0], best).concat([{ label: 'Aufstehen', run: () => SIT.stand() }])
        : [{ label: 'Aufstehen', run: () => SIT.stand() }, { label: TIME.hour() >= 19 || TIME.hour() < 5 ? 'Hier übernachten' : 'Dösen', run: () => SLEEP.show({ kind: 'nap', seat: best }) }];
    } else if (!force && SIT.state === 'none' && G.frameNo % 3 !== 0 && this.focus && !this.focus.occ && free) return;   // the search runs every third frame
    else if (SIT.state === 'none' && free && !GUN.aiming() && FIST.st === 'idle' && !(GUN.state === 'draw' || GUN.state === 'holstering')) {
      const p = PLAY.pos, room = ROOMSTATE.cur;
      const cand = [];
      for (const it of this.near(p.x, p.z, 2.2).concat(this.wide)) {
        if (it.room !== room || it.occ || Math.abs(it.y - p.y) > 0.6) continue;
        const s = it.score(p);
        if (s < 1e8) cand.push([s, it]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      best = cand.length ? cand[0][1] : null;
      const sc = best && cand.find((c) => c[1].verb !== best.verb), second = sc ? sc[1] : null;
      const of = (it) => (it.actions ? it.actions(p) : [{ label: it.label, run: () => it.use() }]);
      if (best) acts = of(best);
      // something else of another kind close by (the bar, while a stool is in focus) gets the second key
      if (second && acts.length < 2 && second.verb !== best.verb) acts = acts.concat(of(second).slice(0, 1));
    }
    this.focus = best; this.acts = acts;
    const key = acts.map((a) => a.label).join('|');
    if (key !== this.key) {
      this.key = key;
      this.ui.forEach((u, i) => { const a = acts[i]; u.row.hidden = !a; u.btn.hidden = !a; if (a) { u.txt.textContent = a.label; u.btn.textContent = a.label; } });
      document.getElementById('prompt').hidden = !acts.length;
    }
  }
};

function makeSeat(S) {
  const k = SIT_KINDS[S.kind] || SIT_KINDS.chair;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  return Object.assign(S, {
    k, fx, fz, occ: null, verb: 'sit', label: 'Hinsetzen',
    sx: S.x + fx * k.stand, sz: S.z + fz * k.stand,   // where one stands before sitting down
    // that spot as seen from p: seats taken from the side (stools, tucked chairs) from the free side nearer to you
    spot(p) {
      if (!this.sides) return [this.sx, this.sz];
      let side = (p.x - this.x) * this.fz - (p.z - this.z) * this.fx >= 0 ? 1 : -1;   // + = the seat's left (+x)
      if (!this.sides.includes(side)) side = -side;
      return [this.sx + this.fz * this.sideD * side, this.sz - this.fx * this.sideD * side];
    },
    score(p) {
      const [sx, sz] = this.spot(p), dx = sx - p.x, dz = sz - p.z, d = Math.hypot(dx, dz);
      if (d > 1.55) return 1e9;
      // not from behind the backrest, and roughly where you look or walk
      if (!this.k.open && (p.x - this.x) * this.fx + (p.z - this.z) * this.fz < (this.sides ? -0.4 : -0.15)) return 1e9;
      const toward = Math.atan2(this.x - p.x, this.z - p.z), a = d < 0.45 ? 0 : Math.abs(wrapA(toward - PLAY.yaw));
      if (a > 1.9) return 1e9;
      if (!INTERACT.clear(p.x, p.z, sx, sz, p.y)) return 1e9;
      return d + a * 0.45;
    },
    use() { SIT.begin(this); }
  });
}
