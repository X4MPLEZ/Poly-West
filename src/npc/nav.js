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
  /* ---- out in the open: a grid over the town (1 m cells, buildings and everything at least knee high blocked),
     searched only when the straight way is blocked (behind the church, round the bank …), then pulled tight ---- */
  G0: [-95, -48], GW: 190, GH: 96, grid: null,
  // (built once: every collider and every room drawn into the cells it covers, with half a metre to spare)
  makeGrid() {
    const g = this.grid = new Uint8Array(this.GW * this.GH), W = this.GW, H = this.GH, x0 = this.G0[0], z0 = this.G0[1], r = 0.5;
    const each = (minx, maxx, minz, maxz, test) => {
      const i0 = Math.max(0, Math.floor(minx - x0)), i1 = Math.min(W - 1, Math.floor(maxx - x0)), j0 = Math.max(0, Math.floor(minz - z0)), j1 = Math.min(H - 1, Math.floor(maxz - z0));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (test(x0 + i + 0.5, z0 + j + 0.5)) g[j * W + i] = 1;
    };
    for (const c of COLL) {
      if (c.y0 !== undefined && c.y0 > 1) continue;
      if (c.r !== undefined) { if ((c.h || 0.8) < 0.45) continue; const rr = c.r + r; each(c.cx - rr, c.cx + rr, c.cz - rr, c.cz + rr, (x, z) => (x - c.cx) ** 2 + (z - c.cz) ** 2 < rr * rr); continue; }
      if ((c.h || 3) < 0.45) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a), ex = c.hx + c.hz + r;
      each(c.cx - ex, c.cx + ex, c.cz - ex, c.cz + ex, (x, z) => { const dx = x - c.cx, dz = z - c.cz, lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; return Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r; });
    }
    for (const R of ROOMS) {
      if (R.parent || R.x0 === undefined) continue;
      const cs = [[R.x0, R.z0], [R.x1, R.z0], [R.x0, R.z1], [R.x1, R.z1]].map((q) => rwp(R, q[0], 0, q[1]));
      each(Math.min(...cs.map((p) => p.x)) - 1, Math.max(...cs.map((p) => p.x)) + 1, Math.min(...cs.map((p) => p.z)) - 1, Math.max(...cs.map((p) => p.z)) + 1, (x, z) => { const [lx, lz] = rLocal(R, x, z); return lx > R.x0 - 0.3 && lx < R.x1 + 0.3 && lz > R.z0 - 0.3 && lz < R.z1 + 0.3; });
    }
  },
  cell(x, z) { const i = Math.floor(x - this.G0[0]), j = Math.floor(z - this.G0[1]); return i < 0 || j < 0 || i >= this.GW || j >= this.GH ? -1 : j * this.GW + i; },
  free(x, z) { const c = this.cell(x, z); return c < 0 || !this.grid[c]; },
  lineFree(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4); for (let k = 1; k < n; k++) { const t = k / n; if (!this.free(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; },
  // the way through the open from a to b (points in between; empty when the straight line is free)
  open(ax, az, bx, bz) {
    if (!this.grid) this.makeGrid();
    if (this.lineFree(ax, az, bx, bz)) return [];
    const W = this.GW, s = this.cell(ax, az), e = this.cell(bx, bz); if (s < 0 || e < 0) return [];
    const g = this.grid, cost = new Float32Array(W * this.GH).fill(1e9), from = new Int32Array(W * this.GH).fill(-1), open = [s];
    const h = (c) => Math.hypot((c % W) - (e % W), Math.floor(c / W) - Math.floor(e / W));
    cost[s] = 0; let found = false, it = 0;
    while (open.length && it++ < 40000) {
      let bi = 0, bf = 1e9; for (let k = 0; k < open.length; k++) { const f = cost[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k; } }
      const c = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (c === e) { found = true; break; }
      const ci = c % W, cj = Math.floor(c / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= this.GH) continue;
        const n = nj * W + ni; if (g[n] && n !== e) continue;
        if (di && dj && (g[cj * W + ni] || g[nj * W + ci])) continue;   // (no corner cutting)
        const nc = cost[c] + (di && dj ? 1.414 : 1);
        if (nc < cost[n]) { if (cost[n] >= 1e9) open.push(n); cost[n] = nc; from[n] = c; }
      }
    }
    if (!found) return [];
    const pts = []; for (let c = from[e]; c >= 0 && c !== s; c = from[c]) pts.push([this.G0[0] + (c % W) + 0.5, this.G0[1] + Math.floor(c / W) + 0.5]);
    pts.reverse();
    // pulled tight: keep only the corners the straight line cannot cut
    const out = []; let cx = ax, cz = az;
    for (let k = 0; k < pts.length; k++) { const nx = k + 1 < pts.length ? pts[k + 1] : [bx, bz]; if (!this.lineFree(cx, cz, nx[0], nx[1])) { out.push(pts[k]); cx = pts[k][0]; cz = pts[k][1]; } }
    return out;
  },
  // the points between a and b (not including b itself)
  route(ax, az, ay, bx, bz, by) {
    const out = this.doors(ax, az, ay, bx, bz, by);
    // the open-air legs between them go round what is in the way
    const pts = [[ax, az]].concat(out, [[bx, bz]]), res = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k], q = pts[k + 1];
      if (k > 0) res.push(p);
      if (!roomAt(p[0], p[1], 0.05, surfaceHeight(p[0], p[1]) + 0.5) && !roomAt(q[0], q[1], 0.05, surfaceHeight(q[0], q[1]) + 0.5)) for (const w of this.open(p[0], p[1], q[0], q[1])) res.push(w);
    }
    return res;
  },
  doors(ax, az, ay, bx, bz, by) {
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
