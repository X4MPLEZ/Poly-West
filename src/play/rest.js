/* ---------- tiredness and sleep ----------
   need: the hours of sleep the body asks for. Awake it grows by half an hour per hour (16 hours awake -> 8 hours
   of sleep), sleeping pays it back an hour per hour. How long one CAN sleep follows from it: what the body needs,
   plus a little more at night (the night is for sleeping), and a short rest is always possible. A bed allows up to
   12 hours, a nap in a chair at most 2. Drink makes the sleep longer and heavier.
   What sleep does (sobering up, healing, the town going on) is done by everyone who listens to TIME.onSkip. */
const REST = {
  need: 2, lastToast: 0,
  init() {
    TIME.onTick((dt) => {
      if (SLEEP.busy()) return;
      this.need = Math.min(24, this.need + dt * TIME.RATE * (TIME.speed || 1) / 60 * 0.5);
      // a word when the body starts asking for it (once in a while, never in a fight)
      if (this.need > 9 && G.time - this.lastToast > 300 && !FIST.active()) { this.lastToast = G.time; TOAST.show(this.need > 13 ? 'Du kannst kaum noch die Augen offen halten. Zeit zu schlafen.' : 'Du wirst müde.'); }
    });
    // whatever passes while asleep: drink wears off, stamina comes back
    TIME.onSkip((m) => {
      const h = m / 60;
      DRUNK.level = Math.max(0, DRUNK.level - h * 0.14 - (DRUNK.stomach + DRUNK.gut) * 0.5 * Math.min(1, h));
      DRUNK.stomach = Math.max(0, DRUNK.stomach - h * 0.5); DRUNK.gut = Math.max(0, DRUNK.gut - h * 0.5);
      FIST.stamina = 1;
    });
  },
  // the longest sleep in minutes for a bed ('bed') or a chair ('nap'), starting now
  maxMinutes(kind) {
    const h = TIME.hour(), night = h >= 20 || h < 4 ? 2.5 : h >= 18 || h < 7 ? 1.25 : 0.5;
    let hours = this.need + night + Math.min(DRUNK.level, 1) * 4;
    // in a bed at night one can always sleep through until the morning
    if (kind === 'bed' && (h >= 20 || h < 5)) hours = Math.max(hours, TIME.until(7.5) / 60);
    hours = clamp(hours, 1, kind === 'nap' ? 2 : 12);
    return Math.round(hours * 4) * 15;
  },
  // tired, fresh … in words for the wheel
  word() { const n = this.need; return n < 2 ? 'ausgeschlafen' : n < 5 ? 'etwas müde' : n < 9 ? 'müde' : n < 13 ? 'sehr müde' : 'todmüde'; },
  slept(minutes) { this.need = Math.max(0, this.need - minutes / 60); }
};
SAVE.part('rest', () => ({ need: +REST.need.toFixed(2) }), (d) => { if (d && isFinite(+d.need)) REST.need = clamp(+d.need, 0, 24); });
