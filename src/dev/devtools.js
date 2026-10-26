/* ---------- developer tools (F2, or the pause menu once switched on in the settings) ----------
   A small panel: where you are and what the renderer costs, teleport to any place, a free-flying camera,
   slower or faster time, overlays for colliders / walkable platforms / seats / chunks, and a few shortcuts.
   "Position kopieren" puts the spot on the clipboard, so a bug can be reported with its exact place. */
const DEV = {
  on: false, fly: false, flyPos: new THREE.Vector3(), flyYaw: 0, flyPitch: 0, overlays: {}, infoT: 0,
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('dev'); this.info = $('devInfo');
    $('devClose').addEventListener('click', () => this.toggle(false));
    $('devFly').addEventListener('click', () => this.setFly(!this.fly));
    $('devHere').addEventListener('click', () => this.playerToCamera());
    $('devCopy').addEventListener('click', () => this.copyPos());
    $('devAmmo').addEventListener('click', () => { GUN.ammo = 6; GUN.reserve = GUN.MAX; });
    $('devMoney').addEventListener('click', () => { INV.money += 1000; TOAST.show('+$10.00', 'money'); });
    $('devDrunk').addEventListener('click', () => { DRUNK.level = Math.min(1.2, DRUNK.level + 0.2); });
    $('devSober').addEventListener('click', () => { DRUNK.level = 0; DRUNK.stomach = 0; });
    for (const b of this.el.querySelectorAll('[data-speed]')) b.addEventListener('click', () => this.setSpeed(+b.dataset.speed));
    for (const b of this.el.querySelectorAll('[data-overlay]')) b.addEventListener('click', () => this.setOverlay(b.dataset.overlay, !this.overlays[b.dataset.overlay]));
    const sel = $('devPlace');
    this.places = this.listPlaces();
    for (const [i, p] of this.places.entries()) { const o = document.createElement('option'); o.value = i; o.textContent = p.name; sel.appendChild(o); }
    sel.addEventListener('change', () => { if (sel.value !== '') this.teleport(this.places[+sel.value]); sel.value = ''; });
    SETTINGS.on('dev', (on) => { if (!on) this.toggle(false); });
    this.setSpeed(1);
  },
  toggle(on) {
    if (on === undefined) on = !this.on;
    if (on && !SETTINGS.v.dev) SETTINGS.set('dev', true);
    this.on = on; this.el.hidden = !on;
    if (!on) { this.setFly(false); for (const k of Object.keys(this.overlays)) this.setOverlay(k, false); }
  },

  /* ---- places to jump to: in front of every door, inside every room, and a few spots outdoors ---- */
  listPlaces() {
    const NAMES = { store: 'Gemischtwaren', saloon: 'Saloon', bank: 'Bank', hotel: 'Hotel', sheriff: 'Sheriff', livery: 'Mietstall', barber: 'Barbier',
      gunsmith: 'Büchsenmacher', post: 'Post', apothecary: 'Apotheke', church: 'Kirche' };
    const out = [{ name: 'Straße, Ortsmitte', x: -8, z: 2, yaw: Math.PI / 2 }];
    for (const R of ROOMS) {
      if (R.parent || R.doorZ === undefined) continue;
      const n = NAMES[R.type] || R.type, front = rwp(R, 0, 0, R.doorZ + 2.6), inside = rwp(R, 0, R.floorY, R.doorZ - 2.2), yawIn = Math.atan2(-R.s, -R.c);
      out.push({ name: n + ' (vor der Tür)', x: front.x, z: front.z, yaw: yawIn });
      out.push({ name: n + ' (drinnen)', x: inside.x, z: inside.z, y: R.floorY, yaw: yawIn });
    }
    out.push({ name: 'Ortsausgang Ost', x: 52, z: roadZ(52), yaw: Math.PI / 2 }, { name: 'Am Bach', x: creekX(14) - 7, z: 14, yaw: Math.PI / 2 },
      { name: 'Wüste Süd', x: -10, z: 70, yaw: 0 }, { name: 'Wüste Nord', x: 0, z: -70, yaw: Math.PI });
    return out;
  },
  teleport(p) {
    if (SIT.busy()) SIT.cancel();
    const y = p.y !== undefined ? p.y : groundAt(p.x, p.z, 50);
    PLAY.pos.set(p.x, y, p.z); PLAY.yaw = p.yaw; PLAY.camYaw = p.yaw + Math.PI; PLAY.vx = PLAY.vz = 0;
    GAIT.init = false; G.lookAt = null; PLAY.softColl = 0;
    if (this.fly) { this.flyPos.set(p.x, y + 2.2, p.z).addScaledVector(new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)), 4); this.flyYaw = p.yaw + Math.PI; }
  },

  /* ---- free camera: WASD fly, mouse / right finger look, Space up, X down, Shift fast ---- */
  setFly(on) {
    this.fly = on;
    document.getElementById('devFly').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      this.flyPos.copy(G.cam.position);
      const d = new THREE.Vector3(); G.cam.getWorldDirection(d);
      this.flyYaw = Math.atan2(-d.x, -d.z); this.flyPitch = Math.asin(clamp(-d.y, -1, 1));
      G.camHook = () => this.flyCam();
    } else if (G.camHook) G.camHook = null;
  },
  look(dx, dy, touch) {
    const k = touch ? 0.006 : 0.003;
    this.flyYaw -= dx * k; this.flyPitch = clamp(this.flyPitch + dy * k, -1.45, 1.45);
  },
  flyCam() {
    G.cam.position.copy(this.flyPos);
    const cp = Math.cos(this.flyPitch);
    G.cam.lookAt(this.flyPos.x - Math.sin(this.flyYaw) * cp, this.flyPos.y - Math.sin(this.flyPitch), this.flyPos.z - Math.cos(this.flyYaw) * cp);
    G.cam.updateMatrixWorld();
  },
  playerToCamera() {
    const p = this.fly ? this.flyPos : G.cam.position;
    this.teleport({ x: p.x, z: p.z, yaw: this.fly ? this.flyYaw + Math.PI : PLAY.yaw, y: groundAt(p.x, p.z, p.y) });
  },
  update(dt) {
    if (this.fly) {
      const k = INPUT.keys, rdt = dt / (G.timeScale || 1) / (G.slow ? 0.25 : 1);   // the camera moves in real time
      let f = 0, s = 0, u = 0;
      if (k.has('w') || k.has('ArrowUp')) f++; if (k.has('s') || k.has('ArrowDown')) f--;
      if (k.has('d') || k.has('ArrowRight')) s++; if (k.has('a') || k.has('ArrowLeft')) s--;
      if (k.has(' ')) u++; if (k.has('x')) u--;
      f += -INPUT.stickY - (INPUT.padY || 0); s += INPUT.stickX + (INPUT.padX || 0);
      if (INPUT.padLookX || INPUT.padLookY) this.look(INPUT.padLookX * 12, INPUT.padLookY * 12, false);
      const sp = (k.has('Shift') ? 22 : 7) * rdt, cy = Math.cos(this.flyYaw), sy = Math.sin(this.flyYaw), cp = Math.cos(this.flyPitch);
      this.flyPos.x += (-sy * cp * f + cy * s) * sp; this.flyPos.z += (-cy * cp * f - sy * s) * sp;
      this.flyPos.y += (-Math.sin(this.flyPitch) * f + u) * sp;
    }
    if (!this.on) return;
    this.infoT -= dt / (G.timeScale || 1);
    if (this.infoT > 0) return;
    this.infoT = 0.25;
    const p = PLAY.pos, d = G.drawInfo || { calls: 0, tris: 0 }, R = G.room;
    const lines = [
      `x ${p.x.toFixed(1)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(1)}  ↻ ${Math.round(((PLAY.yaw * 180 / Math.PI) % 360 + 360) % 360)}°`,
      `${R ? 'Raum: ' + R.type : 'draußen'}  ·  ${SIT.busy() ? 'sitzt (' + SIT.state + ')' : PLAY.moving ? 'läuft ' + PLAY.speed.toFixed(1) + ' m/s' : 'steht'}`,
      `Revolver: ${GUN.state} ${GUN.ammo}/${GUN.reserve}  ·  Faust: ${FIST.st}`,
      `Fokus: ${INTERACT.focus ? (INTERACT.focus.kind || INTERACT.focus.verb) + ' #' + INTERACT.focus.id : '–'}  ·  ${money(INV.money)}`,
      `Rausch ${DRUNK.level.toFixed(2)} (Magen ${DRUNK.stomach.toFixed(2)})${DRINK.busy() ? '  ·  trinkt: ' + DRINK.st : ''}`,
      `${d.calls} Aufrufe · ${(d.tris / 1000).toFixed(0)}k Dreiecke · ${HUD.fpsEl.textContent} FPS`
    ];
    this.info.textContent = lines.join('\n');
  },
  setSpeed(v) {
    G.timeScale = v;
    for (const b of this.el.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', +b.dataset.speed === v ? 'true' : 'false');
  },
  copyPos() {
    const p = PLAY.pos, t = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} (Blick ${PLAY.yaw.toFixed(2)}${G.room ? ', ' + G.room.type : ''})`;
    const done = () => { const b = document.getElementById('devCopy'); b.textContent = 'Kopiert'; setTimeout(() => { b.textContent = 'Position kopieren'; }, 1500); };
    try { navigator.clipboard.writeText(t).then(done, () => window.prompt('Position', t)); } catch (e) { window.prompt('Position', t); }
  },

  /* ---- overlays: built once as lines, drawn on top of everything ---- */
  setOverlay(name, on) {
    this.overlays[name] = on;
    const b = this.el.querySelector(`[data-overlay="${name}"]`); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!this.lines) this.lines = {};
    if (on && !this.lines[name]) this.lines[name] = this.buildOverlay(name);
    if (this.lines[name]) this.lines[name].visible = on;
  },
  buildOverlay(name) {
    const P = [], C = [];
    const seg = (a, b, c) => { P.push(a[0], a[1], a[2], b[0], b[1], b[2]); C.push(c[0], c[1], c[2], c[0], c[1], c[2]); };
    const rect = (cx, cz, hx, hz, a, y0, y1, c) => {
      const ca = Math.cos(a), sa = Math.sin(a), pts = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => [cx + x * ca + z * sa, cz - x * sa + z * ca]);
      for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; seg([p[0], y0, p[1]], [q[0], y0, q[1]], c); seg([p[0], y1, p[1]], [q[0], y1, q[1]], c); seg([p[0], y0, p[1]], [p[0], y1, p[1]], c); }
    };
    const circle = (cx, cz, r, y0, y1, c) => { for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU, a1 = ((i + 1) / 12) * TAU; for (const y of [y0, y1]) seg([cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], c); } };
    if (name === 'coll') for (const c of COLL) {
      const y0 = (c.y0 !== undefined ? c.y0 + 0.5 : surfaceHeight(c.cx, c.cz)) + 0.02, y1 = c.top !== undefined ? c.top + 0.2 : y0 + Math.min(c.h || 1.5, 2.5);
      if (c.r !== undefined) circle(c.cx, c.cz, c.r, y0, y1, [1, 0.3, 0.2]); else rect(c.cx, c.cz, c.hx, c.hz, c.a, y0, y1, [1, 0.3, 0.2]);
    }
    if (name === 'plats') for (const p of PLATS) rect(p.cx, p.cz, p.hx, p.hz, p.a, p.y + 0.03, p.y + 0.03, [0.3, 0.8, 1]);
    if (name === 'seats') for (const it of INTERACT.items) {
      const top = it.y + (it.k ? it.k.top : 0.5), c = [0.3, 1, 0.4];
      seg([it.x, it.y, it.z], [it.x, top + 0.4, it.z], c);
      seg([it.x, top, it.z], [it.x + it.fx * 0.4, top, it.z + it.fz * 0.4], c);
      seg([it.sx, it.y + 0.02, it.sz], [it.sx, it.y + 0.3, it.sz], [1, 1, 0.3]);
    }
    if (name === 'chunks') for (const m of CHUNKS.cells.values()) {
      const b = m.geometry.boundingBox; if (!b) continue;
      rect((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, (b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, 0, Math.max(b.min.y, -2), Math.min(b.max.y, 25), [1, 0.4, 1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.85 }));
    m.renderOrder = 10; m.frustumCulled = false;
    G.scene.add(m);
    return m;
  }
};
