#!/usr/bin/env python3
"""Regression tests for the game. Build first: python3 build.py --local
   python3 tests/run.py                 all checks
   python3 tests/run.py gait seats      only some
   python3 tests/run.py --golden        accept the current world fingerprint as the new reference
Each check prints PASS/FAIL and a one-line detail; the exit code is the number of failures."""
import asyncio, json, sys, time, pathlib
from playwright.async_api import async_playwright
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from harness import open_game, OUT, ROOT

GOLDEN = ROOT / 'tests' / 'golden.json'
# performance budget (headless renderer, fixed views): draw calls and triangles per frame
BUDGET = {'street': {'calls': 70, 'tris': 260000}, 'saloon': {'calls': 60, 'tris': 260000}}

RESET = '''() => { G.noRender = true; G.camHook = null; INPUT.keys.clear(); if (SIT.busy()) { SIT.cancel(); }
  if (GUN.state !== 'holster') { GUN.state = 'holster'; GUN.inHand = false; GUN.reload = null; } GUN.setAim(false); GUN.hipT = 0;
  FIST.st = 'idle'; FIST.clip = null; FIST.fight = 0; FIST.holding = false; FIST.queued = false; FIST.stamina = 1;
  PLAY.vx = PLAY.vz = 0; PLAY.softColl = 0; GAIT.init = false; G.lookAt = null; }'''
PLACE = '''(a) => { PLAY.pos.set(a[0], a[1], a[2]); PLAY.yaw = a[3] + Math.PI; PLAY.camYaw = a[3]; PLAY.camPitch = 0.3; PLAY.camDist = 5;
  PLAY.vx = PLAY.vz = 0; GAIT.init = false; G.lookAt = null; for (let k = 0; k < 20; k++) G.stepFrame(1/60); }'''
WALK = '''(a) => { const [yaw, secs, keys] = a; INPUT.keys.clear(); (keys || ['w']).forEach(k => INPUT.keys.add(k));
  for (let k = 0; k < Math.round(secs * 60); k++) { PLAY.camYaw = yaw; G.stepFrame(1/60); }
  INPUT.keys.clear(); for (let k = 0; k < 30; k++) G.stepFrame(1/60);
  return { pos: [PLAY.pos.x, PLAY.pos.y, PLAY.pos.z].map(v => +v.toFixed(2)), room: G.room ? G.room.type : null }; }'''

# a fingerprint of everything that was built: meshes, colliders, platforms, seats, doors.
# Refactors must keep it identical; intended changes to the world are accepted with --golden.
FINGERPRINT = '''() => {
  const r = (v) => Math.round(v * 100) / 100, meshes = [], tot = { v: 0, s: 0, c: 0 };
  // order-independent: the same pieces built in another order give the same signature
  const sig = (o) => { const a = o.geometry.attributes, P = a.position.array; let s = 0, c = 0;
    for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; s += x + 2 * y + 3 * z + 0.01 * (x * x + y * y * 2 + z * z * 3); }
    if (a.color) { const C = a.color.array; for (let i = 0; i < C.length; i += 3) c += C[i] + 2 * C[i + 1] + 3 * C[i + 2] + C[i] * C[i + 1]; }
    o.updateMatrixWorld(); const e = o.matrixWorld.elements;
    tot.v += P.length / 3; tot.s += s; tot.c += c;
    return [P.length / 3, r(s), r(c), r(e[12]), r(e[13]), r(e[14])].join(':'); };
  for (const o of W.worldMeshes.concat(ROOMS.map((R) => R.mesh))) meshes.push(sig(o));
  for (const D of DOORS) for (const m of D.meshes) meshes.push('door:' + sig(m).split(':').slice(0, 3).join(':'));
  meshes.sort();
  const sum = (L, f) => r(L.reduce((t, x) => t + f(x), 0));
  // the sum over everything stays the same when the same triangles are only regrouped into other meshes (chunks)
  return { total: [tot.v, Math.round(tot.s), Math.round(tot.c)], meshes: meshes.length, meshHash: meshes.join('|').split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7),
    coll: [COLL.length, sum(COLL, (c) => c.cx * 3 + c.cz * 7 + (c.r || c.hx + c.hz))], plats: [PLATS.length, sum(PLATS, (p) => p.cx + p.cz * 3 + p.y * 5)],
    camblock: CAMBLOCK.length, seats: [SEATS.length, sum(SEATS, (s) => s.x + s.z * 3 + s.yaw)], doors: DOORS.length, rooms: ROOMS.length }; }'''

async def check_boot(g):
    n = await g.js('() => ({ seats: INTERACT.items.length, rooms: ROOMS.length, doors: DOORS.length })')
    return not g.errors, f"{n} errors={g.errors[:2]}"

async def check_fingerprint(g, golden=False):
    fp = await g.js(FINGERPRINT)
    if golden or not GOLDEN.exists():
        GOLDEN.write_text(json.dumps(fp, indent=1)); return True, 'reference written'
    ref = json.loads(GOLDEN.read_text())
    diff = {k: (ref.get(k), fp[k]) for k in fp if ref.get(k) != fp[k]}
    return not diff, ('identical' if not diff else f'changed: {diff}  (intended? run with --golden)')

async def check_budget(g):
    out, ok = {}, True
    views = {
        'street': '() => { PLAY.pos.set(-8, 0, 2); G.camHook = () => { G.cam.position.set(-8, 6, 22); G.cam.lookAt(-8, 2, 0); G.cam.updateMatrixWorld(); }; }',
        'saloon': '() => { PLAY.pos.set(-19.5, 0.35, -8); GAIT.init = false; G.camHook = () => { G.cam.position.set(-19.5, 2.4, -4); G.cam.lookAt(-19.5, 1.2, -12); G.cam.updateMatrixWorld(); }; }'}
    for name, js in views.items():
        await g.js(js); await g.step(30)
        info = await g.js('() => ({ calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles })')
        b = BUDGET[name]; out[name] = info
        ok &= info['calls'] <= b['calls'] and info['tris'] <= b['tris']
    return ok, f"{out} budget={BUDGET['street']}"

GAIT_SC = {
    'reverse_run': [(['w', 'Shift'], 1.5), (['s', 'Shift'], 1.5), (['w', 'Shift'], 1.0)],
    'turn90_run': [(['w', 'Shift'], 1.2), (['d', 'Shift'], 1.2), (['s', 'Shift'], 1.2), (['a', 'Shift'], 1.2)],
    'zigzag_walk': [(['w', 'a'], 0.5), (['w', 'd'], 0.5)] * 4,
    'strafe_aim': [(['a'], 1.2), (['d'], 1.2), (['s'], 1.0)],
}
# frames with the feet passing close in a sharp turn are normal; these are the levels measured when the gait was tuned
GAIT_MAX_CROSS = {'reverse_run': 2, 'turn90_run': 12, 'zigzag_walk': 2, 'strafe_aim': 0}
async def check_gait(g):
    res, ok = {}, True
    for name, steps in GAIT_SC.items():
        await g.js(RESET)
        r = await g.js('''(a) => { const [steps, aim] = a; PLAY.pos.set(0, 0, 2); PLAY.yaw = 0; PLAY.camYaw = Math.PI;
          if (aim) { GUN.toggleHolster(); for (let k = 0; k < 40; k++) G.stepFrame(1/60); GUN.setAim(true); }
          for (let k = 0; k < 30; k++) G.stepFrame(1/60);
          let cross = 0, maxSep = 0;
          for (const [keys, secs] of steps) { INPUT.keys.clear(); keys.forEach(k => INPUT.keys.add(k));
            for (let k = 0; k < Math.round(secs * 60); k++) { PLAY.camYaw = Math.PI; G.stepFrame(1/60);
              const L = W.ch.pose.ank[0], R = W.ch.pose.ank[1];
              if (Math.abs(L.z - R.z) < 0.3 && L.x - R.x < 0.06) cross++;
              maxSep = Math.max(maxSep, Math.hypot(L.x - R.x, L.z - R.z)); } }
          INPUT.keys.clear(); GUN.setAim(false); return { cross, maxSep: +maxSep.toFixed(2) }; }''', [steps, name.endswith('aim')])
        res[name] = r; ok &= r['cross'] <= GAIT_MAX_CROSS[name] and r['maxSep'] <= 1.15
    return ok, json.dumps(res)

async def check_fists(g):
    await g.js(RESET)
    r = await g.js('''() => { PLAY.pos.set(5, 0, 2); const keys = [['w'], ['s'], ['a'], ['d'], ['w','a'], []];
      let minF = 9, minA = 9; const head = new THREE.Vector3(), a = new THREE.Vector3(), f = new THREE.Vector3(), q = new THREE.Vector3();
      for (let i = 0; i < 36; i++) {
        INPUT.keys.clear(); keys[i % keys.length].forEach(k => INPUT.keys.add(k));
        FIST.stamina = 1; FIST.down(false); G.stepFrame(1/60);
        if (i % 7 === 3) { for (let k = 0; k < 30; k++) G.stepFrame(1/60); } FIST.up();
        for (let k = 0; k < 26; k++) { G.stepFrame(1/60);
          head.set(0, 0.17, 0.02).applyMatrix4(W.ch.p.head.matrix);
          for (const n of ['fArmR', 'fArmL']) { const m = W.ch.p[n].matrix; a.set(0, 0, 0).applyMatrix4(m); f.set(0, -0.3, 0).applyMatrix4(m);
            minF = Math.min(minF, f.distanceTo(head)); for (let t = 0; t <= 1; t += 0.1) { q.lerpVectors(a, f, t); minA = Math.min(minA, q.distanceTo(head)); } } } }
      INPUT.keys.clear(); for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      return { minFist: +minF.toFixed(3), minForearm: +minA.toFixed(3) }; }''')
    return r['minFist'] >= 0.21 and r['minForearm'] >= 0.17, json.dumps(r)

async def check_gun(g):
    await g.js(RESET)
    r = await g.js('''() => { PLAY.pos.set(-8, 0, 2); for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      GUN.toggleHolster(); for (let k = 0; k < 50; k++) G.stepFrame(1/60); const drawn = GUN.state;
      GUN.setAim(true); for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      for (let i = 0; i < 6; i++) { GUN.pressFire(); for (let k = 0; k < 30; k++) G.stepFrame(1/60); }
      const empty = GUN.ammo; GUN.setAim(false); GUN.pressReload(); for (let k = 0; k < 400 && GUN.reload; k++) G.stepFrame(1/60);
      const after = [GUN.ammo, GUN.reserve]; GUN.toggleHolster(); for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      return { drawn, empty, after, end: GUN.state }; }''')
    if not (r['drawn'] == 'drawn' and r['empty'] == 0 and r['after'][0] == 6 and r['end'] == 'holster'): return False, json.dumps(r)
    # reload while holstered: draw, reload, put it back
    h = await g.js('''() => { GUN.ammo = 2; GUN.reserve = 12; GUN.pressReload(); let saw = false;
      for (let k = 0; k < 600; k++) { G.stepFrame(1/60); if (GUN.reload) saw = true; if (saw && GUN.state === 'holster') break; }
      return { saw, ammo: GUN.ammo, st: GUN.state }; }''')
    # touch aim button: press = draw and aim, press again = straight back into the holster (also mid-draw)
    t = await g.js('''() => { GUN.aimButton(); for (let k = 0; k < 40; k++) G.stepFrame(1/60);
      const a = [GUN.state, GUN.wantAim, HUD.$('bAim').textContent];
      GUN.aimButton(); const b = HUD.$('bAim').textContent; for (let k = 0; k < 40; k++) G.stepFrame(1/60); const c = GUN.state;
      GUN.aimButton(); for (let k = 0; k < 15; k++) G.stepFrame(1/60); GUN.aimButton(); for (let k = 0; k < 70; k++) G.stepFrame(1/60);
      return { a, b: HUD.$('bAim').textContent, c, d: GUN.state }; }''')
    ok = h['saw'] and h['ammo'] == 6 and h['st'] == 'holster' and t['a'][1] and t['a'][2] == 'Wegstecken' and t['c'] == 'holster' and t['d'] == 'holster' and t['b'] == 'Zielen'
    return ok, json.dumps([h, t])

async def check_doors(g):
    await g.js(RESET)
    D = '() => { const D = DOORS.find(d => d.R.type === "store"); return D.angle; }'
    await g.js(PLACE, [-33, 0.35, -2.2, 0.0])
    mx = await g.js('''() => { const D = DOORS.find(d => d.R.type === "store"); INPUT.keys.add('w'); let mx = -9;
      for (let k = 0; k < 300; k++) { PLAY.camYaw = 0; G.stepFrame(1/60); mx = Math.max(mx, D.angle); } INPUT.keys.clear(); for (let k = 0; k < 240; k++) G.stepFrame(1/60); return { mx, room: G.room && G.room.type, rest: D.angle }; }''')
    mn = await g.js('''() => { const D = DOORS.find(d => d.R.type === "store"); INPUT.keys.add('w'); let mn = 9;
      for (let k = 0; k < 320; k++) { PLAY.camYaw = Math.PI; G.stepFrame(1/60); mn = Math.min(mn, D.angle); } INPUT.keys.clear(); return { mn, room: G.room && G.room.type }; }''')
    ok = mx['mx'] > 1.2 and mx['room'] == 'store' and abs(mx['rest']) < 0.05 and mn['mn'] < -1.2 and mn['room'] is None
    return ok, f"in: open {mx['mx']:.2f} room {mx['room']} closed {mx['rest']:.2f} · out: open {mn['mn']:.2f} room {mn['room']}"

async def check_stairs(g):
    await g.js(RESET)
    await g.js(PLACE, [-19.6, 0.35, -17.75, 1.5708])
    up = await g.js(WALK, [1.5708, 4.2])
    await g.js(RESET)
    await g.js(PLACE, [2.6, 0.35, -7.4, 0.0])
    hotel = await g.js(WALK, [0.0, 4.0])
    ok = up['room'] == 'saloonUp' and hotel['room'] == 'hotelUp'
    return ok, f"saloon {up} · hotel {hotel}"

async def check_seats(g):
    """every seat: reachable from the side it is meant to be used from, sit down, stand up, seat free again"""
    await g.js(RESET)
    r = await g.js('''() => { const bad = [], kinds = {}; let n = 0;
      for (const S of INTERACT.items) { if (S.verb !== 'sit') continue; n++;
        // stand a step away from where one sits down, facing the seat
        const g0 = S.sides ? { x: S.x + S.fz * 1.2 * S.sides[0], z: S.z - S.fx * 1.2 * S.sides[0] } : { x: S.x + S.fx, z: S.z + S.fz };
        const [sx, sz] = S.spot(g0); let dx = sx - S.x, dz = sz - S.z; const l = Math.hypot(dx, dz) || 1;
        let [px, pz] = collide(sx + dx / l * 0.6, sz + dz / l * 0.6, S.y);
        SIT.cancel(); PLAY.pos.set(px, S.y, pz); PLAY.yaw = Math.atan2(S.x - px, S.z - pz); PLAY.vx = PLAY.vz = 0; GAIT.init = false;
        for (let k = 0; k < 4; k++) G.stepFrame(1/30);
        INTERACT.update();
        const f = INTERACT.focus;
        if (!f || f.kind !== S.kind) { bad.push(S.kind + '#' + S.id + ' focus ' + (f ? f.kind + '#' + f.id : '-')); continue; }
        INTERACT.use(); let t = 0;
        while (SIT.state !== 'sit' && t < 6) { G.stepFrame(1/30); t += 1/30; }
        if (SIT.state !== 'sit') { bad.push(S.kind + '#' + S.id + ' stuck ' + SIT.state); SIT.cancel(); continue; }
        const d = Math.hypot(PLAY.pos.x - f.x, PLAY.pos.z - f.z);
        SIT.stand(); t = 0; while (SIT.state !== 'none' && t < 3) { G.stepFrame(1/30); t += 1/30; }
        if (SIT.state !== 'none' || f.occ || d > 0.01) bad.push(S.kind + '#' + S.id + ' up ' + SIT.state + ' d ' + d.toFixed(2));
        kinds[S.kind] = (kinds[S.kind] || 0) + 1; }
      return { n, ok: n - bad.length, bad: bad.slice(0, 8), kinds }; }''')
    # a seat taken by a neighbour seat is fine (benches have several places), so allow a few focus mix-ups
    hard = [b for b in r['bad'] if 'focus' not in b]
    return not hard and r['ok'] >= r['n'] * 0.9, json.dumps(r)

async def check_sit_block(g):
    """sitting blocks the gun and fists; moving stands you up"""
    await g.js(RESET)
    r = await g.js('''() => { const S = INTERACT.items.find(s => s.kind === 'bench' && !s.room);
      PLAY.pos.set(S.sx + S.fx * 0.8, S.y, S.sz + S.fz * 0.8); PLAY.yaw = S.yaw + Math.PI; GAIT.init = false;
      GUN.toggleHolster(); for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      INTERACT.update(); INTERACT.use(); let t = 0; while (SIT.state !== 'sit' && t < 6) { G.stepFrame(1/60); t += 1/60; }
      const sat = SIT.state, holstered = GUN.state; GUN.toggleHolster(); GUN.setAim(true); FIST.down(); G.stepFrame(1/60);
      const blocked = GUN.state === 'holster' && !GUN.wantAim && !FIST.holding;
      INPUT.keys.add('w'); for (let k = 0; k < 90; k++) G.stepFrame(1/60); INPUT.keys.clear();
      return { sat, holstered, blocked, after: SIT.state, prompt: document.getElementById('prompt').hidden }; }''')
    return r['sat'] == 'sit' and r['holstered'] == 'holster' and r['blocked'] and r['after'] == 'none', json.dumps(r)

async def check_save(g):
    await g.js(RESET)
    r = await g.js('''() => { PLAY.pos.set(3, 0, 4); GUN.ammo = 3; GUN.reserve = 11; SAVE.write();
      const raw = SAVE.raw(); PLAY.pos.set(0, 0, 0); GUN.ammo = 6; SAVE.load(raw); GAIT.init = false;
      return { v: JSON.parse(raw).v, pos: [PLAY.pos.x, PLAY.pos.z], ammo: [GUN.ammo, GUN.reserve] }; }''')
    return r['pos'] == [3, 4] and r['ammo'] == [3, 11], json.dumps(r)

async def check_menu(g):
    """menu opens and closes, pauses the game, settings are kept and applied"""
    await g.js(RESET)
    r = await g.js('''() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      const opened = MENU.open && !document.getElementById('menu').hidden;
      MENU.show('set'); const rows = document.querySelectorAll('#mSettings .mRow').length;
      SETTINGS.set('sensMouse', 200); const y0 = PLAY.camYaw; lookBy(10, 0, false); const turned = +(y0 - PLAY.camYaw).toFixed(4);
      SETTINGS.set('sensMouse', 100); SETTINGS.set('invertY', true); const p0 = PLAY.camPitch; lookBy(0, 10, false); const inv = PLAY.camPitch < p0; SETTINGS.set('invertY', false);
      SETTINGS.set('quality', 'low'); const prLow = G.renderer.getPixelRatio(); SETTINGS.set('quality', 'high'); const prHigh = G.renderer.getPixelRatio();
      const kept = JSON.parse(localStorage.getItem(SETTINGS.KEY)).quality;
      SETTINGS.set('camDist', 5); const cam = PLAY.camDist; SETTINGS.set('camDist', 7.5);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return { opened, rows, turned, inv, prLow, prHigh, kept, cam, closed: !MENU.open }; }''')
    ok = r['opened'] and r['rows'] >= 9 and abs(r['turned'] - 0.13) < 0.001 and r['inv'] and r['prLow'] < r['prHigh'] and r['kept'] == 'high' and r['cam'] == 5 and r['closed']
    return ok, json.dumps(r)

async def check_dev(g):
    """developer tools: places, teleport, free camera, overlays"""
    await g.js(RESET)
    r = await g.js('''() => { DEV.toggle(true); const n = DEV.places.length;
      const P = DEV.places.find(p => p.name.startsWith('Saloon (drinnen)')); DEV.teleport(P); for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      const room = G.room && G.room.type;
      DEV.setFly(true); const c0 = DEV.flyPos.clone(); INPUT.keys.add('w'); for (let k = 0; k < 30; k++) G.stepFrame(1/60); INPUT.keys.clear();
      const flew = +c0.distanceTo(DEV.flyPos).toFixed(2), stayed = +Math.hypot(PLAY.pos.x - P.x, PLAY.pos.z - P.z).toFixed(2);
      DEV.setFly(false);
      for (const o of ['coll', 'plats', 'seats', 'chunks']) DEV.setOverlay(o, true);
      const segs = Object.values(DEV.lines).map(m => m.geometry.attributes.position.count / 2);
      for (const o of ['coll', 'plats', 'seats', 'chunks']) DEV.setOverlay(o, false);
      DEV.setSpeed(2); const ts = G.timeScale; DEV.setSpeed(1); DEV.toggle(false);
      return { n, room, flew, stayed, segs, ts }; }''')
    ok = r['n'] >= 20 and r['room'] == 'saloon' and r['flew'] > 2 and r['stayed'] < 0.05 and min(r['segs']) > 10 and r['ts'] == 2
    return ok, json.dumps(r)

async def check_drink(g):
    """order at the bar standing and seated, drink, a bottle from the bag, getting drunk, passing out"""
    await g.js(RESET)
    r = await g.js('''() => { const out = {}; INV.money = 1000; INV.items = {}; INV.sips = {}; DRUNK.level = 0; DRUNK.stomach = 0; GLASS.clear();
      const C = INTERACT.wide[0], mx = (C.ax + C.bx) / 2, mz = (C.az + C.bz) / 2;
      // stand in front of the middle of the bar, facing it
      PLAY.pos.set(mx - C.fx * 0.75, C.y, mz - C.fz * 0.75); PLAY.yaw = C.yaw; GAIT.init = false;
      for (let k = 0; k < 10; k++) G.stepFrame(1/60); INTERACT.update(true);
      out.offer = INTERACT.acts.map(a => a.label).join(',');
      INTERACT.acts.find(a => a.label === 'Bestellen').run(); out.shop = SHOP.open; SHOP.key('2');
      // Hank fetches the bottle, pours and pushes the glass over
      out.money = INV.money; for (let k = 0; k < 60 * 14 && !GLASS.ready(); k++) G.stepFrame(1/60); for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      out.ready = GLASS.ready(); INTERACT.update(true); out.offer2 = INTERACT.acts.map(a => a.label).join(',');
      INTERACT.use(0); let t = 0; const st = []; while ((DRINK.busy()) && t < 6) { G.stepFrame(1/60); t += 1/60; if (st[st.length - 1] !== DRINK.st) st.push(DRINK.st); }
      out.phases = st.join('>'); out.stomach = +DRUNK.stomach.toFixed(3); out.left = GLASS.obj.left;
      // a bottle: buy it, drink from it
      SHOP.show(C, null); SHOP.buy('bottle'); for (let k = 0; k < 60 * 14 && !INV.has('bottle'); k++) G.stepFrame(1/60); out.bag = JSON.stringify(INV.items);
      DRINK.start('bottle'); t = 0; while (DRINK.busy() && t < 6) { G.stepFrame(1/60); t += 1/60; } out.bottleSips = INV.sips.bottle;
      // on a stool: a beer, three sips
      const S = INTERACT.items.find(s => s.kind === 'stool'); SIT.warp(S); for (let k = 0; k < 5; k++) G.stepFrame(1/60); INTERACT.update(true);
      out.seatOffer = INTERACT.acts.map(a => a.label).join(',');
      INTERACT.use(0); SHOP.buy('beer'); for (let k = 0; k < 60 * 14 && !GLASS.ready(); k++) G.stepFrame(1/60); for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      for (let i = 0; i < 3; i++) { INTERACT.update(true); INTERACT.use(0); t = 0; while (DRINK.busy() && t < 6) { G.stepFrame(1/60); t += 1/60; } }
      out.beerLeft = GLASS.obj.left; out.stillSitting = SIT.state;
      SIT.stand(); for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      return out; }''')
    ok = ('Bestellen' in r['offer'] and r['shop'] and r['money'] == 975 and r['ready'] and r['offer2'].startswith('Trinken')
          and r['phases'] == 'reach>lift>sip>lower>back>idle' and r['stomach'] > 0.1 and r['left'] == 0 and 'bottle' in r['bag'] and r['bottleSips'] == 5
          and r['seatOffer'] == 'Bestellen,Aufstehen' and r['beerLeft'] == 0 and r['stillSitting'] == 'sit')
    # drunk walking and passing out
    r2 = await g.js('''() => { DRUNK.level = 0.75; DRUNK.stomach = 0; PLAY.pos.set(-8, 0, 2); PLAY.yaw = 0; PLAY.camYaw = Math.PI; GAIT.init = false;
      let maxSep = 0, x0 = PLAY.pos.x; INPUT.keys.add('w'); for (let k = 0; k < 300; k++) { PLAY.camYaw = Math.PI; G.stepFrame(1/60); const L = W.ch.pose.ank[0], R = W.ch.pose.ank[1]; maxSep = Math.max(maxSep, Math.hypot(L.x - R.x, L.z - R.z)); }
      INPUT.keys.clear(); const drift = +Math.abs(PLAY.pos.x - x0).toFixed(2);
      // the last stretch: held just under the top for a while, then down, black, and awake somewhere else with slow blinks
      const m0 = INV.money, p0 = PLAY.pos.clone(); DRUNK.level = 1.05; for (let k = 0; k < 60 * 2; k++) G.stepFrame(1/60);
      const edge = !!DRUNK.edge && !DRUNK.out, held = +DRUNK.level.toFixed(2);
      DRUNK.edge.t = DRUNK.edge.dur; let dark = 0, lids = 0, lastLid = 0, wakeT = 0;
      let crawled = false; for (let k = 0; k < 60 * 20 && (DRUNK.out || DRUNK.edge || k < 5); k++) { G.stepFrame(1/60); dark = Math.max(dark, POST.dark); if (FALL.crawling() === 'ctl') crawled = true;
        if (DRUNK.out && DRUNK.out.phase === 'wake') { wakeT += 1/60; if (POST.lid > lastLid) lids++; } lastLid = POST.lid; }
      return { maxSep: +maxSep.toFixed(2), drift, edge, held, crawled, dark: +dark.toFixed(2), wakeT: +wakeT.toFixed(1), out: !!DRUNK.out, level: +DRUNK.level.toFixed(2), moved: +p0.distanceTo(PLAY.pos).toFixed(1), poorer: INV.money < m0 || m0 === 0, black: document.getElementById('blackout').hidden }; }''')
    ok = (ok and r2['maxSep'] < 1.4 and r2['drift'] > 0.05 and r2['edge'] and r2['crawled'] and r2['held'] < 0.99 and r2['dark'] > 0.99 and r2['wakeT'] > 6
          and not r2['out'] and r2['level'] < 0.35 and r2['moved'] > 3 and r2['black'])
    await g.js('() => { DRUNK.level = 0; DRUNK.stomach = 0; if (SIT.busy()) SIT.cancel(); GLASS.clear(); }')
    return ok, json.dumps(r) + ' ' + json.dumps(r2)

async def check_drunk(g):
    """drunk: the head only rolls (no spinning), the body drifts and the feet follow, fists get slow and sloppy,
    a fall runs through and hands back to the gait, the wheel drinks from the bottle"""
    await g.js(RESET)
    r = await g.js('''() => { const out = {}; INV.items = {}; INV.sips = {};
      PLAY.pos.set(-8, 0, 2); PLAY.yaw = 0; GAIT.init = false; FALL.cancel();
      let hr = [9, -9], hy = 0, moved = 0, steps = 0; const last = PLAY.pos.clone();
      for (let k = 0; k < 600; k++) { DRUNK.level = 0.6; DRUNK.stomach = 0; if (FALL.busy()) FALL.cancel(); G.stepFrame(1/60); const P = W.ch.pose;
        hr[0] = Math.min(hr[0], P.hdRoll); hr[1] = Math.max(hr[1], P.hdRoll); hy = Math.max(hy, Math.abs(P.hdYaw)); moved += PLAY.pos.distanceTo(last); last.copy(PLAY.pos);
        if (GAIT.feet[0].swing || GAIT.feet[1].swing) steps++; }
      out.headRoll = hr.map(v => +v.toFixed(2)); out.headYaw = +hy.toFixed(2); out.swayMoved = +moved.toFixed(2); out.stepFrames = steps;
      // fists: how long one punch takes, sober and drunk
      const punchT = (L) => { DRUNK.level = L; FIST.stamina = 1; FIST.st = 'idle'; FIST.clip = null; FIST.down(false); G.stepFrame(1/60); FIST.up(); let t = 0; while (FIST.st !== 'idle' && t < 3) { DRUNK.level = L; if (FALL.busy()) FALL.cancel(); G.stepFrame(1/60); t += 1/60; } return +t.toFixed(2); };
      const avg = (L) => +((punchT(L) + punchT(L) + punchT(L) + punchT(L)) / 4).toFixed(2); out.punchSober = avg(0); out.punchDrunk = avg(0.8);
      // a fall: down and back up, the gait takes over again
      out.falls = ['back', 'fwd', 'side'].map((kind) => { DRUNK.level = 0.5; FALL.cancel(); FALL.start(false, kind, -1); let t = 0, low = 9;
        while (FALL.busy() && t < 9) { G.stepFrame(1/60); t += 1/60; low = Math.min(low, W.ch.pose.pel.y); }
        return [+t.toFixed(1), +low.toFixed(2)]; });
      out.fallT = Math.max(...out.falls.map(f => f[0])); out.fallLow = out.falls[0][1];
      for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      out.afterPel = +W.ch.pose.pel.y.toFixed(2);
      // the wheel: Tab, point at the bottle, let go
      DRUNK.level = 0; INV.add('bottle'); WHEEL.show(); out.slots = WHEEL.list.map(s => s.label).join(',');
      WHEEL.sel = WHEEL.list.findIndex(s => s.label === 'Flasche Whiskey'); WHEEL.use();
      t = 0; while (DRINK.busy() && t < 5) { G.stepFrame(1/60); t += 1/60; } out.sipsLeft = INV.sips.bottle; out.wheelClosed = !WHEEL.open;
      // the wheel opened again while still drinking: the next sip can be picked right away and follows
      DRINK.start('bottle'); for (let k = 0; k < 40; k++) G.stepFrame(1/60); WHEEL.show();
      const bi = WHEEL.list.findIndex(s => s.label === 'Flasche Whiskey'); out.againOk = bi >= 0 && WHEEL.list[bi].ok; WHEEL.sel = bi; WHEEL.use();
      t = 0; while (DRINK.busy() && t < 9) { G.stepFrame(1/60); t += 1/60; } out.sipsAgain = INV.sips.bottle;
      // walking straight into a wall: no walking on the spot
      DRUNK.level = 0; DRUNK.stomach = 0; DRUNK.gut = 0; const R = ROOMS.find(r => r.type === 'saloon'); PLAY.pos.copy(rwp(R, 0, R.floorY, R.doorZ - 3)); GAIT.init = false; PLAY.camYaw = R.ry; INPUT.keys.add('w');
      for (let k = 0; k < 600; k++) { PLAY.camYaw = R.ry; G.stepFrame(1/60); } out.wallSpeed = +PLAY.speed.toFixed(2); out.wallMoving = PLAY.moving; out.wallPos = [PLAY.pos.x, PLAY.pos.z, PLAY.vx, PLAY.vz, PLAY.yaw].map(v => +v.toFixed(2)); out.wl = DRUNK.level; INPUT.keys.clear();
      DRUNK.level = 0; DRUNK.stomach = 0; return out; }''')
    ok = (abs(r['headRoll'][0]) < 0.7 and r['headRoll'][1] < 0.7 and r['headYaw'] < 0.9 and r['swayMoved'] > 0.2 and r['stepFrames'] > 20
          and r['punchDrunk'] > r['punchSober'] * 1.4 and r['fallT'] < 8 and r['fallLow'] < 0.25 and r['falls'][1][1] < 0.6 and r['falls'][2][1] < 0.3 and r['afterPel'] > 0.85
          and 'Flasche Whiskey' in r['slots'] and r['sipsLeft'] == 5 and r['wheelClosed'] and r['againOk'] and r['sipsAgain'] == 3
          and r['wallSpeed'] < 0.3 and not r['wallMoving'])
    return ok, json.dumps(r)

async def check_npc(g):
    """Hank: greets, comes over, serves by hand (all steps), ducks at a shot, hands up when aimed at"""
    await g.js(RESET)
    r = await g.js('''() => { const out = {}, B = BARKEEP, R = B.R; INV.money = 1000; GLASS.clear(); B.orders = []; B.cur = null; B.st = 'idle'; B.cool = {};
      const p0 = rwp(R, 0, R.floorY, 0.8); PLAY.pos.set(p0.x, p0.y, p0.z); GAIT.init = false; for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      const p = rwp(R, 2.55, R.floorY, -5.0); PLAY.pos.set(p.x, p.y, p.z); PLAY.yaw = B.backYaw; GAIT.init = false;
      for (let k = 0; k < 10; k++) G.stepFrame(1/60); out.hello = B.npc.said;
      for (let k = 0; k < 180; k++) G.stepFrame(1/60); out.attending = B.attending; out.near = +Math.abs(B.myZ() + 5.0).toFixed(2);
      SHOP.show(B.C, null); SHOP.buy('whiskey'); const seen = [];
      for (let k = 0; k < 60 * 14 && !GLASS.ready(); k++) { G.stepFrame(1/60); const st = B.cur ? B.cur.st : null; if (st && seen[seen.length - 1] !== st) seen.push(st); }
      out.steps = seen.join('>'); out.served = GLASS.ready();
      out.glassNear = GLASS.obj ? +Math.hypot(GLASS.obj.pos.x - PLAY.pos.x, GLASS.obj.pos.z - PLAY.pos.z).toFixed(2) : -1;
      // a shot: he ducks, then comes back up
      worldEvent('shot', PLAY.pos.x, PLAY.pos.y + 1.4, PLAY.pos.z, { by: 'player' }); let low = 0;
      for (let k = 0; k < 60 * 7; k++) { G.stepFrame(1/60); low = Math.max(low, B.npc.crouch); } out.duck = +low.toFixed(2); out.after = B.st;
      // aimed at: hands up
      GUN.toggleHolster(); for (let k = 0; k < 40; k++) G.stepFrame(1/60); GUN.setAim(true); let up = 0;
      for (let k = 0; k < 90; k++) { const h = B.npc.pos; const yaw = Math.atan2(h.x - PLAY.pos.x, h.z - PLAY.pos.z); PLAY.camYaw = yaw + Math.PI; PLAY.aimPitch = 0.05; G.stepFrame(1/60); up = Math.max(up, B.aimedT); }
      GUN.setAim(false); out.handsUp = +up.toFixed(2);
      return out; }''')
    ok = (bool(r['hello']) and r['attending'] and r['near'] < 0.6 and r['steps'] == 'toBack>grab>toPour>glass>pour>stow>push' and r['served']
          and r['glassNear'] < 1.2 and r['duck'] > 0.8 and r['after'] == 'idle' and r['handsUp'] > 0.5)
    return ok, json.dumps(r)

CHECKS = [('boot', check_boot), ('fingerprint', check_fingerprint), ('budget', check_budget), ('gait', check_gait), ('fists', check_fists),
          ('gun', check_gun), ('doors', check_doors), ('stairs', check_stairs), ('seats', check_seats), ('sitblock', check_sit_block), ('save', check_save), ('menu', check_menu), ('dev', check_dev), ('drink', check_drink), ('drunk', check_drunk), ('npc', check_npc)]

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    golden = '--golden' in sys.argv
    todo = [(n, f) for n, f in CHECKS if not args or n in args]
    fails = 0
    async with async_playwright() as pw:
        g = await open_game(pw)
        for name, fn in todo:
            t0 = time.time()
            try:
                ok, detail = await (fn(g, golden) if name == 'fingerprint' else fn(g))
            except Exception as e:
                ok, detail = False, f'exception: {str(e)[:300]}'
            if g.errors and name != 'boot':
                ok, detail = False, detail + f' · page errors: {g.errors[:2]}'; g.errors.clear()
            fails += not ok
            print(f"{'PASS' if ok else 'FAIL'}  {name:12s} {time.time() - t0:5.1f}s  {detail}", flush=True)
        await g.browser.close()
    print(f'\n{len(todo) - fails}/{len(todo)} passed')
    sys.exit(fails)

if __name__ == '__main__':
    asyncio.run(main())
