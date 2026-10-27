/* ---------- finding the way: people walk from room to street to room ----------
   The town is simple: every building has one door, so a way is a chain of door points. A point belongs to an area:
   the street (no room), a room, or a fenced part of a room (the aisle behind the saloon bar, which is only open at
   its front end). NAV.route(from, to) gives the points to walk through; NPC.walkTo follows them one after the other.
   Upper floors are not part of it yet (nobody goes upstairs). */
const NAV = {
  // fenced parts of rooms: rect in the room's frame, and the way in/out (inside the fence, just outside it)
  PENS: [{ type: 'saloon', name: 'aisle', rect: [4.05, 6.3, -10.2, -2.8], mouth: [4.75, -2.25], out: [2.75, -2.15] }],
  _v: new THREE.Vector3(),
  area(x, z, y) {
    const R = roomAt(x, z, 0.05, y === undefined ? 0.5 : y + 0.1);
    if (!R) return { key: 'street', R: null };
    for (const P of this.PENS) {
      if (P.type !== R.type) continue;
      const [lx, lz] = rLocal(R, x, z), r = P.rect;
      if (lx > r[0] && lx < r[1] && lz > r[2] && lz < r[3]) return { key: R.type + '.' + P.name, R, pen: P };
    }
    return { key: R.type, R };
  },
  door(R, inside) { const p = inside ? rwp(R, 0, R.floorY, R.z1 - 1.1) : rwp(R, 0, 0, R.z1 + 1.7); return [p.x, p.z]; },
  pen(R, P, inside) { const q = inside ? P.mouth : P.out, p = rwp(R, q[0], R.floorY, q[1]); return [p.x, p.z]; },
  // the points between a and b (not including b itself)
  route(ax, az, ay, bx, bz, by) {
    const A = this.area(ax, az, ay), B = this.area(bx, bz, by), out = [];
    if (A.key === B.key) return out;
    // out of a pen, out of the room
    if (A.pen) { out.push(this.pen(A.R, A.pen, true), this.pen(A.R, A.pen, false)); }
    if (A.R && (!B.R || B.R !== A.R)) out.push(this.door(A.R, true), this.door(A.R, false));
    // into the other room, into its pen
    if (B.R && (!A.R || A.R !== B.R)) out.push(this.door(B.R, false), this.door(B.R, true));
    if (B.pen) out.push(this.pen(B.R, B.pen, false), this.pen(B.R, B.pen, true));
    return out;
  }
};
