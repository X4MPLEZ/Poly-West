/* ---------- tiredness and sleep ----------
   need: the hours of sleep the body asks for. Awake it grows by half an hour per hour (16 hours awake -> 8 hours
   of sleep), sleeping pays it back an hour per hour; it shows on the wheel and in a word when it gets late.
   A bed allows up to 12 hours at any time; a chair or bench a doze of 2 hours, or at night the whole night.
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
    TIME.onSkip((m, soft) => {
      const h = m / 60;
      DRUNK.level = Math.max(0, DRUNK.level - h * 0.14 - (DRUNK.stomach + DRUNK.gut) * 0.5 * Math.min(1, h));
      DRUNK.stomach = Math.max(0, DRUNK.stomach - h * 0.5); DRUNK.gut = Math.max(0, DRUNK.gut - h * 0.5);
      if (!soft) FIST.stamina = 1;
    });
  },
  // the longest sleep in minutes: in a bed always up to 12 hours; in a chair or on a bench a doze of two hours,
  // or, in the evening and at night, through the night until the morning
  maxMinutes(kind) {
    if (kind === 'bed') return 720;
    const h = TIME.hour();
    if (h >= 19 || h < 5) return Math.max(120, Math.round(TIME.until(7) / 15) * 15);
    return 120;
  },
  // tired, fresh … in words for the wheel
  word() { const n = this.need; return n < 2 ? 'ausgeschlafen' : n < 5 ? 'etwas müde' : n < 9 ? 'müde' : n < 13 ? 'sehr müde' : 'todmüde'; },
  slept(minutes) { this.need = Math.max(0, this.need - minutes / 60); }
};
SAVE.part('rest', () => ({ need: +REST.need.toFixed(2) }), (d) => { if (d && isFinite(+d.need)) REST.need = clamp(+d.need, 0, 24); });
