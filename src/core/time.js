/* ---------- the clock of the world ----------
   Game time in minutes since the first morning (day 1 starts at 0:00, the game at 10:00). A day lasts 48 real
   minutes (half a game minute per real second, like the big westerns). Systems ask TIME.hour() (0…24) and
   TIME.min; skipping time (sleeping) goes through TIME.skip(minutes), which tells everybody who listens with
   TIME.onSkip(fn(minutes)) so wounds heal, drink wears off and people move on as if those hours had passed. */
const TIME = {
  min: 600, RATE: 0.5, frozen: false, skipFns: [], tickFns: [],
  update(dt) { if (!this.frozen && !(typeof SLEEP !== 'undefined' && SLEEP.st)) this.min += dt * this.RATE * (this.speed || 1); for (const f of this.tickFns) f(dt); },
  hour() { return (this.min / 60) % 24; },
  day() { return Math.floor(this.min / 1440) + 1; },
  // 0 at full day, 1 deep in the night (follows the sun; see gfx/daynight.js for the light itself)
  night() { const h = this.hour(); return h < 5 ? 1 : h < 7 ? 1 - smoothstep(5, 7, h) : h < 18.5 ? 0 : h < 20.5 ? smoothstep(18.5, 20.5, h) : 1; },
  str(m) { const t = m === undefined ? this.min : m, h = Math.floor(t / 60) % 24, mm = Math.floor(t % 60); return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; },
  // the time of day in words, for the people of the town (and the AI)
  words() {
    const h = this.hour();
    return h < 4.5 ? 'tiefe Nacht' : h < 6 ? 'früher Morgen, es dämmert' : h < 9 ? 'Morgen' : h < 11.5 ? 'Vormittag' : h < 13.5 ? 'Mittag' : h < 17 ? 'Nachmittag' : h < 19 ? 'früher Abend' : h < 21 ? 'Abend, die Sonne geht unter' : h < 23.5 ? 'später Abend, es ist dunkel' : 'Mitternacht';
  },
  // when something happened, for memories: "Tag 3, abends"
  stamp(m) {
    const t = m === undefined ? this.min : m, h = (t / 60) % 24, d = Math.floor(t / 1440) + 1;
    return 'Tag ' + d + ', ' + (h < 5 ? 'nachts' : h < 11 ? 'morgens' : h < 14 ? 'mittags' : h < 18 ? 'nachmittags' : h < 22 ? 'abends' : 'nachts');
  },
  // how long ago, in words: "vor 5 Min.", "vor 3 Std.", "vor 2 Tagen"
  ago(m) { const d = Math.max(0, this.min - m); return d < 60 ? 'vor ' + Math.max(1, Math.round(d)) + ' Min.' : d < 1440 * 1.5 ? 'vor ' + Math.round(d / 60) + ' Std.' : 'vor ' + Math.round(d / 1440) + ' Tagen'; },
  onSkip(fn) { this.skipFns.push(fn); },
  onTick(fn) { this.tickFns.push(fn); },
  skip(minutes) {
    const m = Math.max(0, minutes);
    this.min += m;
    for (const f of this.skipFns) { try { f(m); } catch (e) { /* one system failing must not stop the others */ } }
    worldEvent('timeSkip', 0, 0, 0, { by: 'world', minutes: m });
  },
  // minutes from now until the clock shows hour h (0…24) next
  until(h) { const now = this.hour(); let d = (h - now) * 60; if (d < 0) d += 1440; return d; }
};
SAVE.part('time', () => ({ min: +TIME.min.toFixed(1) }), (d) => { if (d && isFinite(+d.min)) TIME.min = Math.max(0, +d.min); });
