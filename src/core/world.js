/* ---------- shared world services: events, a spatial grid, the actors ----------
   Small on purpose; every system uses these instead of keeping its own copies, so that NPCs, horses and saving
   can plug in later without touching the systems that already exist. */

/* world events: what happened where (a shot, a punch, someone sat down). Kept for a while for NPCs to notice,
   and handed to listeners at once. */
const WORLD_EVENTS = [];
const EVENT_LISTENERS = [];
function worldEvent(type, x, y, z, extra) {
  const e = Object.assign({ type, x, y, z, t: G.time }, extra || {});
  WORLD_EVENTS.push(e);
  if (WORLD_EVENTS.length > 60) WORLD_EVENTS.shift();
  for (const fn of EVENT_LISTENERS) fn(e);
  return e;
}
function onWorldEvent(fn) { EVENT_LISTENERS.push(fn); }

/* a grid of square cells for anything with x, z: ask for everything near a point without looking at everything */
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); this._out = []; }
  key(x, z) { return Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell); }
  add(it) { const k = this.key(it.x, it.z); it._cell = k; (this.map.get(k) || (this.map.set(k, []), this.map.get(k))).push(it); return it; }
  remove(it) { const L = this.map.get(it._cell); if (L) { const i = L.indexOf(it); if (i >= 0) L.splice(i, 1); } }
  // for things that move (NPCs): call after changing it.x / it.z
  moved(it) { if (this.key(it.x, it.z) !== it._cell) { this.remove(it); this.add(it); } }
  // everything in the cells touching the circle (callers check the exact distance); the array is reused
  near(x, z, r) {
    const out = this._out, c = this.cell; out.length = 0;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) { const L = this.map.get(i + ',' + j); if (L) for (const it of L) out.push(it); }
    return out;
  }
}

/* actors: everyone who acts in the world. The player is the first; NPCs and horses get the same shape
   { id, kind, pos, yaw, room, seat }, so seats, events, memory and saving treat them all alike. */
const ACTORS = {
  list: [], byId: new Map(),
  add(a) { this.list.push(a); this.byId.set(a.id, a); return a; },
  get(id) { return this.byId.get(id); }
};
