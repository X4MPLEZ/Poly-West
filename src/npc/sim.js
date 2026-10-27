/* ---------- the town goes on while you do not watch: sleeping, the fast clock ----------
   Game time and the people's own time are one: a game minute is 1/TIME.RATE seconds of their lives (2 s). When
   the clock jumps (TIME.skip: sleep, waking up somewhere) or runs fast (the developers' "Uhr 60×", which passes
   its extra minutes on as small skips every frame), those seconds are lived here, in steps of a second, without
   bodies or pictures: the wounds bleed and close (G.abstract: a man who is awake keeps a hand on it), the fallen
   get up, people walk their way (NPC.ff: along the route, no collisions), the doctor treats who comes, the dead
   barkeeper is taken away and the next one arrives — exactly as it would have gone, only without drawing any of it.
   Nobody speaks (canBeHeard is false while G.abstract). Once nothing is going on any more, the rest of the time
   is healing only and done at once. */
const WORLDSIM = {
  pre: [],
  // fn(minutes, soft) before a jump is lived through (stop what cannot go on without you: a fight, a gun drawn)
  before(fn) { this.pre.push(fn); },
  run(m, soft) {
    if (!(m > 0)) return;
    for (const f of this.pre) { try { f(m, soft); } catch (e) { /* one must not stop the rest */ } }
    const end = TIME.min + m;
    let left = m / TIME.RATE, healM = 0;
    G.abstract = true;
    try {
      while (left > 1e-6) {
        const s = Math.min(1, left); left -= s;
        TIME.min += s * TIME.RATE; healM += s * TIME.RATE;
        this.step(s, soft);
        if (healM >= 5) { this.heal(healM); healM = 0; }
        if (!soft && this.settled()) break;
      }
      TIME.min = end;
      this.heal(healM + left * TIME.RATE);
    } finally { G.abstract = false; }
  },
  step(s, soft) {
    const fighting = (N) => N && N.fight && N.fight.on;
    for (const N of NPCS.list.slice()) if (!(soft && fighting(N))) N.hp.update(s);
    if (!(soft && fighting(BARKEEP.npc))) BARKEEP.update(s);
    if (!(soft && fighting(DOC.npc))) DOC.update(s);
    for (const N of NPCS.list) N.ff(s);
  },
  heal(m) { if (m > 0) for (const N of NPCS.list) N.hp.heal(m); },
  // nothing left that would change but healing
  settled() {
    for (const N of NPCS.list) { const H = N.hp; if (H.dead) continue; if (H.anim || H.bleed > 0 || H.dying > 0 || N.walking()) return false; }
    return BARKEEP.settled() && DOC.settled();
  }
};
