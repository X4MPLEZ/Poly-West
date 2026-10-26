/* ---------- save game ----------
   Each system that has something worth keeping registers a part: collect() returns plain data, apply(data) puts
   it back. The whole save carries a format version; when the format changes, V goes up and migrate() converts
   older saves step by step, so nobody loses their game with an update. Stored in this browser only. */
const SAVE = {
  KEY: 'polywest.save', V: 1, parts: {}, timer: 0,
  part(name, collect, apply) { this.parts[name] = { collect, apply }; },
  snapshot() {
    const o = { v: this.V, at: Date.now(), parts: {} };
    for (const [n, p] of Object.entries(this.parts)) { try { o.parts[n] = p.collect(); } catch (e) { /* skip a part that fails */ } }
    return o;
  },
  raw() { return JSON.stringify(this.snapshot()); },
  write() { try { localStorage.setItem(this.KEY, this.raw()); return true; } catch (e) { return false; } },
  stored() { try { return localStorage.getItem(this.KEY); } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* nothing to clear */ } },
  load(raw) {
    let o = null;
    try { o = JSON.parse(raw); } catch (e) { return false; }
    o = this.migrate(o);
    if (!o) return false;
    for (const [n, p] of Object.entries(this.parts)) if (o.parts[n] !== undefined) { try { p.apply(o.parts[n]); } catch (e) { /* keep the default */ } }
    return true;
  },
  // old format -> new format, one version at a time (example for later: if (o.v === 1) { ...; o.v = 2; })
  migrate(o) {
    if (!o || typeof o.v !== 'number' || !o.parts || o.v > this.V) return null;
    return o;
  },
  init() {
    this.part('player', () => ({ pos: [PLAY.pos.x, PLAY.pos.y, PLAY.pos.z].map((v) => +v.toFixed(2)), yaw: +PLAY.yaw.toFixed(3), cam: +PLAY.camYaw.toFixed(3) }),
      (d) => { PLAY.pos.set(d.pos[0], d.pos[1], d.pos[2]); PLAY.yaw = d.yaw; PLAY.camYaw = d.cam; GAIT.init = false; G.lookAt = null; });
    this.part('gun', () => ({ ammo: GUN.ammo, reserve: GUN.reserve }), (d) => { GUN.ammo = clamp(d.ammo | 0, 0, 6); GUN.reserve = clamp(d.reserve | 0, 0, GUN.MAX); });
    const raw = this.stored();
    if (raw) this.load(raw);
    // keep it fresh: now and then, and whenever the page is hidden or closed
    const flush = () => { if (!SIT.busy()) this.write(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
  },
  update(dt) { this.timer += dt; if (this.timer > 20) { this.timer = 0; if (!SIT.busy()) this.write(); } }
};
