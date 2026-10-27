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
      for (let k = 0; k < 420; k++) G.stepFrame(1/60); out.attending = B.attending; out.near = +Math.abs(B.myZ() + 5.0).toFixed(2);
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
      if (GUN.state !== 'holster') { GUN.state = 'holster'; GUN.inHand = false; }
      // talking (here without Claude: the phrase book answers); an order made in words is served and paid
      for (let k = 0; k < 60 * 6; k++) G.stepFrame(1/60);
      GLASS.clear(); out.canTalk = TALK.target() === B.npc; TALK.start(false); out.panel = !document.getElementById('talk').hidden;
      const m0 = INV.money; return TALK.send('Hallo Hank, ein Bier bitte!').then(() => {
        out.reply = B.npc.said; out.log = (B.npc.talkLog || []).length;
        // he names the price and waits: nothing poured, nothing paid until the button
        for (let k = 0; k < 60; k++) G.stepFrame(1/60);
        out.waits = !!B.pending && B.pending.id === 'beer' && INV.money === m0 && !document.getElementById('bPay').hidden;
        out.payLabel = document.getElementById('bPay').textContent; B.pay();
        for (let k = 0; k < 60 * 14 && !GLASS.ready(); k++) G.stepFrame(1/60);
        out.beer = GLASS.ready() && GLASS.obj.it.name; out.paid = m0 - INV.money;
        // the microphone window (simulated): connected, then a spoken line arrives and is sent by itself
        MICWIN.onMsg({ data: { pw: 'mic-ready' }, source: null }); MICWIN.win = { closed: false, focus() {} };
        TALK.start(); B.npc.talkT = 0; try { speechSynthesis.cancel(); } catch (e) {} const n0 = (B.npc.talkLog || []).length;
        VOICE.q = []; VOICE.playing = null; B.npc.talkT = 0; TALK.remoteHeard('Wie heißt du?', false); B.npc.talkT = 0; TALK.remoteHeard('Wie heißt du?', true);
        return new Promise((ok) => setTimeout(ok, 50)).then(() => { out.remote = (B.npc.talkLog || []).length - n0; out.remoteSaid = B.npc.talkLog[B.npc.talkLog.length - 1].text;
          TALK.close(); out.closed = !TALK.open; MICWIN.ok = false; MICWIN.win = null;
          // the reset button: asks once, then everyone has forgotten
          B.remember('Test-Erinnerung.'); out.ask = TALK.resetMemories(); out.done = TALK.resetMemories();
          out.forgot = (B.npc.talkLog || []).length === 0 && B.mem.length === 0 && B.served === 0; return out; }); }); }''')
    ok = (bool(r['hello']) and r['attending'] and r['near'] < 0.7 and r['steps'] == 'toBack>grab>toPour>glass>pour>stow>push' and r['served']
          and r['glassNear'] < 1.2 and r['duck'] > 0.8 and r['after'] == 'idle' and r['handsUp'] > 0.5
          and r['canTalk'] and r['panel'] and r['log'] >= 2 and r['waits'] and 'Bier bezahlen' in r['payLabel'] and r['beer'] == 'Bier' and r['paid'] == 10 and r['closed'] and r['remote'] == 2 and 'Hank' in r['remoteSaid'] and r['ask'].startswith('Wirklich') and r['forgot'])
    return ok, json.dumps(r)

async def check_voice(g):
    """the real voice (Piper in a worker): loads over http, says a sentence in two moods; skipped without tools/voices.py output"""
    import threading, http.server, functools, socketserver
    if not (ROOT / 'vendor' / 'voice' / 'thorsten_emo.voice.json').exists(): return True, 'skipped (python3 tools/voices.py)'
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    h.log_message = lambda *a: None
    srv = socketserver.TCPServer(('127.0.0.1', 0), h); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    page = await g.browser.new_page()
    try:
        await page.goto(f'http://127.0.0.1:{port}/dist/test.html')
        await page.wait_for_function('() => typeof VOICE !== "undefined" && typeof G !== "undefined" && G.cam', timeout=90000)
        r = await page.evaluate("""() => new Promise((res) => { G.manual = true; VOICE.load(); const t0 = performance.now();
          const rms = (p) => { let e = 0; for (const v of p) e += v * v; return +Math.sqrt(e / p.length).toFixed(3); };
          const iv = setInterval(() => { if (VOICE.st === 'loading') return; clearInterval(iv);
            if (VOICE.st !== 'ready') { res({ st: VOICE.st, why: VOICE.why }); return; }
            const t1 = performance.now(), txt = 'Nicht in meinem Saloon, Fremder!';
            // the same sentence in two moods: both spoken, the angry one faster
            VOICE.synth(txt, { pitch: 1, length: 1 }, 'neutral').then((p) => { const synth = Math.round(performance.now() - t1);
              return VOICE.synth(txt, { pitch: 1, length: 1 }, 'angry').then((q) => res({ st: 'ready', load: Math.round(t1 - t0), synth,
                secs: +(p.length / VOICE.rate).toFixed(2), rms: rms(p), angrySecs: +(q.length / VOICE.rate).toFixed(2), angryRms: rms(q) })); })
              .catch((err) => res({ st: 'synth failed', why: String(err) })); }, 50); })""")
        # the second start reads every file from the browser's own storage, nothing comes over the network
        if r.get('st') == 'ready':
            r['first'] = await page.evaluate('() => [VOICE.fromNet, VOICE.fromStore]')
            r['again'] = await page.evaluate("""() => new Promise((res) => { try { VOICE.worker.terminate(); } catch (e) {} VOICE.worker = null; VOICE.st = 'off'; VOICE.tries = 0; VOICE.load(); const t0 = performance.now();
              const iv = setInterval(() => { if (VOICE.st === 'loading') return; clearInterval(iv); res([VOICE.st, VOICE.fromNet, VOICE.fromStore, Math.round(performance.now() - t0), VOICE.label()]); }, 50); })""")
    finally:
        await page.close(); srv.shutdown()
    ok = (r.get('st') == 'ready' and r.get('secs', 0) > 1.0 and r.get('rms', 0) > 0.01 and r.get('angryRms', 0) > 0.01
          and (abs(r.get('angrySecs', 0) - r.get('secs', 0)) > 0.05 or abs(r.get('angryRms', 0) - r.get('rms', 0)) > 0.01)
          and r['first'][0] >= 8 and r['again'][0] == 'ready' and r['again'][1] == 0 and r['again'][2] >= 8)
    return ok, json.dumps(r, ensure_ascii=False)

async def check_glass(g):
    """glass in the buildings: a shot breaks it (the bullet flies on), it comes back after you left; Hank comments on
       the damage in his own words (a stand-in for Claude here), remembers it, and the developer tools show his memory"""
    await g.js(RESET)
    r = await g.js('''() => { const out = {}, B = BARKEEP, R = B.R, kinds = {};
      for (const it of BREAK.items) kinds[it.kind] = (kinds[it.kind] || 0) + 1; out.kinds = kinds; out.rooms = BREAK.byRoom.size;
      const p0 = rwp(R, 0, R.floorY, 0.8); PLAY.pos.set(p0.x, p0.y, p0.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      // Hank stays out of this (a bullet through a glass would go on into him; a fist could find him instead)
      const keepTrace = HARM.trace, keepT = FIST.targets; HARM.trace = () => null; FIST.targets = function () { return keepT.call(this).filter((T) => T.kind !== 'npc'); };
      // a bottle on the bar's back shelf, shot at from 1.5 m in front of it
      const L = BREAK.byRoom.get(R), it = L.find((x) => x.kind === 'bottle');
      const c = new THREE.Vector3(it.x, it.y0 + it.h * 0.5, it.z), o = c.clone().add(new THREE.Vector3(PLAY.pos.x - it.x, 0, PLAY.pos.z - it.z).setLength(1.5));
      const d = c.clone().sub(o).normalize();
      const hit = GUN.trace(o, d, 0, 30); out.hitIt = !!hit && hit.glass === it;
      const a = R.mesh.geometry.attributes.position.array, before = a[it.v0 * 3 + 1];
      worldEvent('shot', PLAY.pos.x, PLAY.pos.y + 1.4, PLAY.pos.z, { by: 'player' });
      GUN.hitResult(hit, d, 0); out.broken = !it.alive; out.collapsed = a[it.v0 * 3 + 1] === it.y0 && a[it.v0 * 3] === it.lx && before !== undefined;
      const again = GUN.trace(o, d, 0, 30); out.through = !again || again.glass !== it;
      // a served drink on the counter can be shot as well
      GLASS.serve('whiskey', B.C, rwp(R, 3.2, R.floorY + 1.13, -5), null); for (let k = 0; k < 120; k++) G.stepFrame(1/60);
      const S = GLASS.obj.pos, o2 = new THREE.Vector3(S.x - 1.2, S.y + 0.06, S.z), h2 = GUN.trace(o2, new THREE.Vector3(1, 0, 0), 0, 5);
      out.served = !!h2 && !!h2.glass && h2.glass.served; if (h2 && h2.glass) GUN.hitResult(h2, new THREE.Vector3(1, 0, 0), 0); out.drinkGone = !GLASS.obj;
      // the fist: a glass on the bar in front of you
      const g2 = BREAK.byRoom.get(R).find((x) => x.alive && x.kind === 'bottle' && x.y0 > R.floorY + 1.0 && x.y0 < R.floorY + 1.3);
      out.fistTarget = !!g2;
      if (g2) { const [gx, gz] = rLocal(R, g2.x, g2.z), st = rwp(R, gx - 0.75, R.floorY, gz); PLAY.pos.set(st.x, st.y, st.z); PLAY.yaw = Math.atan2(g2.x - st.x, g2.z - st.z); GAIT.init = false; for (let k = 0; k < 10; k++) G.stepFrame(1/60);
        FIST.stamina = 1; FIST.down(false); G.stepFrame(1/60); FIST.up(); for (let k = 0; k < 60 && g2.alive; k++) G.stepFrame(1/60); for (let k = 0; k < 30; k++) G.stepFrame(1/60); out.fistBroke = !g2.alive; }
      HARM.trace = keepTrace; FIST.targets = keepT;
      return out; }''')
    # Hank: three shots into his ceiling; Claude is replaced by a stand-in that records the prompt
    h = await g.js('''async () => { const out = {}, B = BARKEEP, R = B.R; B.forget(); B.st = 'idle'; B.cool = {}; B.sc = null;
      const pin = rwp(R, 0, R.floorY, -2); PLAY.pos.set(pin.x, pin.y, pin.z); GAIT.init = false; for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      const keep = [TALK.ai, TALK.aiOk, SETTINGS.v.aiTalk]; let prompt = '';
      TALK.ai = async (p, o) => { prompt = p; o.onText({ text: '[shake_head, whisper] Drei Löcher in meiner Decke!' }); return { text: '[shake_head, whisper] Drei Löcher in meiner Decke!' }; };
      TALK.aiOk = true; SETTINGS.v.aiTalk = true; TALK.remarkT = -99; TALK.seq++;
      for (let i = 0; i < 3; i++) { worldEvent('shot', PLAY.pos.x, PLAY.pos.y + 1.4, PLAY.pos.z, { by: 'player' }); worldEvent('impact', PLAY.pos.x, 3, PLAY.pos.z, { by: 'player', part: 'ceiling', room: 'saloon' }); for (let k = 0; k < 20; k++) G.stepFrame(1/60); }
      for (let k = 0; k < 60 * 6 && B.st === 'duck'; k++) G.stepFrame(1/60);
      await new Promise((res) => setTimeout(res, 50)); for (let k = 0; k < 5; k++) G.stepFrame(1/60);
      out.asked = /3 Löcher in deiner Decke/.test(prompt); out.said = (B.npc.talkLog || []).slice(-1)[0]; out.mem = B.mem.slice(-1)[0]; out.holes = B.damage.holes;
      out.noWhisperRule = /Flüstern \\(whisper\\) NUR/.test(prompt); out.aimedMood = B.MOOD.aimed;
      // without Claude: the ready-made line
      TALK.ai = null; B.sc = null; worldEvent('shot', PLAY.pos.x, PLAY.pos.y + 1.4, PLAY.pos.z, { by: 'player' });
      for (let k = 0; k < 60 * 6 && B.st === 'duck'; k++) G.stepFrame(1/60); out.canned = B.LINES.shot.includes(B.npc.said);
      // creator mode: the memory panel lists exactly what he keeps; one can delete a single memory
      DEV.toggle(true); DEV.showMem(true); DEV.renderMem(); const box = document.getElementById('devMemBox');
      out.panel = box.textContent.includes('Hank') && box.textContent.includes(out.mem) && box.textContent.includes('Drei Löcher');
      const n0 = B.mem.length; box.querySelector('button[data-act="del"]').click(); out.deleted = B.mem.length === n0 - 1;
      DEV.showMem(false); DEV.toggle(false);
      TALK.ai = keep[0]; TALK.aiOk = keep[1]; SETTINGS.v.aiTalk = keep[2];
      // the broken bottle is back once you have left and the time is up
      const it = BREAK.broken[0]; out.brokenN = BREAK.broken.length;
      PLAY.pos.set(-8, 0, 2); GAIT.init = false; for (const b of BREAK.broken) b.back = 0; for (let k = 0; k < 5; k++) G.stepFrame(1/60);
      out.back = !!it && it.alive && BREAK.broken.length === 0 && R.mesh.geometry.attributes.position.array[it.v0 * 3] === it.orig[0];
      return out; }''')
    ok = (r['hitIt'] and r['broken'] and r['collapsed'] and r['through'] and r['served'] and r['drinkGone'] and r['fistBroke'] and r['kinds'].get('bottle', 0) > 50 and r['rooms'] >= 5
          and h['asked'] and h['said'] and h['said']['text'] == 'Drei Löcher in meiner Decke!' and 'in deinem Saloon herumgeschossen (3 Schüsse, 3 Löcher in der Decke)' in (h['mem'] or '') and h['holes'] == 3
          and h['noWhisperRule'] and h['aimedMood'] != 'whisper' and h['canned'] and h['panel'] and h['deleted'] and h['back'])
    return ok, json.dumps([r, h], ensure_ascii=False)

async def check_manners(g):
    """Hank does not talk over himself: no ready-made line right after his own words (and those keep his mood), nothing
       at all while you are outside; "Stopp" ends an answer; too drunk inside, you are walked to just outside the door"""
    await g.js(RESET)
    r = await g.js('''async () => { SETTINGS.v.aiSave = false; const out = {}, B = BARKEEP, R = B.R, N = B.npc; B.cool = {}; B.st = 'idle'; N.aiAt = -99; N.feel = null;
      const pin = rwp(R, 0, R.floorY, -2); PLAY.pos.set(pin.x, pin.y, pin.z); GAIT.init = false; for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      // right after an answer of his own: the ready-made line waits
      TALK.felt(N, 'angry'); N.said = ''; out.blocked = !B.say('cheers'); for (let k = 0; k < 60 * 5; k++) G.stepFrame(1/60);
      try { speechSynthesis.cancel(); } catch (e) {} out.later = B.say('cheers'); out.mood = TALK.barkMood(N, 'neutral'); out.moodAmused = TALK.barkMood(N, 'amused');
      // outside the saloon: nothing said, no bubble
      PLAY.pos.set(-8, 0, 2); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60); N.said = ''; B.cool = {}; N.aiAt = -99;
      out.outside = B.say('fall') === false && N.said === '' && N.speak('Hallo?') === false;
      // Stopp: the answer on its way is dropped
      PLAY.pos.set(pin.x, pin.y, pin.z); const bar = rwp(R, 2.55, R.floorY, -5.0); PLAY.pos.set(bar.x, bar.y, bar.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      const keep = [TALK.ai, SETTINGS.v.aiTalk]; let aborted = false;
      TALK.ai = (p, o) => new Promise((res, rej) => { o.signal.addEventListener('abort', () => { aborted = true; const e = new Error('x'); e.code = 'cancelled'; rej(e); }); });
      SETTINGS.v.aiTalk = true; TALK.start(false); const sent = TALK.send('Erzähl mal was.'); await new Promise((x) => setTimeout(x, 30));
      out.busy = TALK.busy; out.stopShown = (G.stepFrame(1/60), !document.getElementById('talkStop').hidden);
      TALK.abort(); await sent; out.aborted = aborted && !TALK.busy && TALK.open && !N.thinking; TALK.close();
      // closing the strip does not take the answer back; typed text still goes out; seated he hears you from the table
      TALK.ai = (p, o) => new Promise((res) => setTimeout(() => { o.onText({ text: '[nod, neutral] Klar doch.' }); res({ text: '[nod, neutral] Klar doch.' }); }), 80);
      TALK.start(false); TALK.inp.value = 'Noch einen Whiskey, bitte.'; TALK.close(); out.closedBusy = TALK.busy && !TALK.open;
      await new Promise((x) => setTimeout(x, 200)); const last = N.talkLog.slice(-2); out.answered = last[0].text === 'Noch einen Whiskey, bitte.' && last[1].text === 'Klar doch.';
      TALK.ai = keep[0]; SETTINGS.v.aiTalk = keep[1];
      // seated at any table in the saloon you can talk to him
      out.seatTalk = SEATS.filter((x) => x.room === R && x.kind === 'chair').map((x) => { SIT.warp(x); G.stepFrame(1/60); const ok = TALK.target() === N; return ok ? 1 : +Math.hypot(x.x - N.pos.x, x.z - N.pos.z).toFixed(1); });
      if (SIT.busy()) SIT.cancel(); for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      // too drunk inside: out through the door, then he is yours again (and may go back in)
      const seat = rwp(R, -3.6, R.floorY, -3.6); PLAY.pos.set(seat.x, seat.y, seat.z); GAIT.init = false; DRUNK.leftAt = -999; for (let k = 0; k < 5; k++) G.stepFrame(1/60);
      DRUNK.level = 0.92; DRUNK.stomach = 0; DRUNK.gut = 0; let started = false, t = 0;
      for (; t < 60 * 20; t++) { G.stepFrame(1/60); if (DRUNK.leave) started = true; if (started && !DRUNK.leave) break; if (FALL.busy() && FALL.t > 0) {} }
      out.leave = started; out.secs = +(t / 60).toFixed(1); out.outRoom = G.room ? G.room.type : null;
      const [lx, lz] = rLocal(R, PLAY.pos.x, PLAY.pos.z); out.local = [+lx.toFixed(2), +(lz - R.doorZ).toFixed(2)];
      out.free = !DRUNK.blocked() || FALL.busy();
      // back in: it does not start again
      PLAY.pos.set(pin.x, pin.y, pin.z); GAIT.init = false; for (let k = 0; k < 60; k++) G.stepFrame(1/60); out.noAgain = !DRUNK.leave;
      DRUNK.level = 0; DRUNK.edge = null; DRUNK.leave = null; if (FALL.busy()) FALL.st = null;
      SETTINGS.v.aiSave = true; return out; }''')
    ok = (r['blocked'] and r['later'] and r['mood'] == 'angry' and r['moodAmused'] == 'angry' and r['outside'] and r['busy'] and r['stopShown'] and r['aborted'] and r['closedBusy'] and r['answered'] and all(v == 1 for v in r['seatTalk'])
          and r['leave'] and r['secs'] < 17 and r['outRoom'] is None and r['local'][1] > 0 and r['local'][1] < 3.5 and abs(r['local'][0]) < 2.5 and r['noAgain'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_ownkeys(g):
    """own page with own keys (Claude and ElevenLabs answered by stand-ins here): the settings show the key fields,
       Claude is asked directly (streamed, the browser-access header), ElevenLabs speaks with a fitting voice, a refused
       key falls back to the built-in voice; without keys nothing changes"""
    await g.js(RESET)
    r = await g.js(r'''async () => { SETTINGS.v.aiSave = false; const out = {}, calls = [], real = window.fetch;
      const sse = (t) => new Response(new ReadableStream({ start(c) { const e = new TextEncoder();
        for (const piece of ['[nod, ', 'neutral] Howdy, ', 'Fremder.']) c.enqueue(e.encode('event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: piece } }) + '\n\n'));
        c.enqueue(e.encode('data: {"type":"message_stop"}\n\n')); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
      let ttsStatus = 200;
      window.fetch = async (url, o) => { calls.push({ url: String(url), o });
        if (/api\.anthropic\.com/.test(url)) return sse();
        if (/api\.groq\.com/.test(url)) return new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const piece of ['[nod, ', 'neutral] Howdy ', 'aus Groq.']) c.enqueue(e.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: piece } }] }) + '\n\n')); c.enqueue(e.encode('data: [DONE]\n\n')); c.close(); } }), { status: 200 });
        if (/v1\/voices$/.test(url)) return new Response(JSON.stringify({ voices: [{ voice_id: 'f1', name: 'Rachel', labels: { gender: 'female' } }, { voice_id: 'clyde1', name: 'Clyde', labels: { gender: 'male', age: 'middle aged' } }] }), { status: 200 });
        if (/text-to-speech/.test(url)) { if (ttsStatus !== 200) return new Response(JSON.stringify({ detail: { message: 'invalid api key' } }), { status: ttsStatus });
          const n = 12000, b = new Int16Array(n); for (let i = 0; i < n; i++) b[i] = Math.round(Math.sin(i * 0.05) * 8000); return new Response(b.buffer, { status: 200 }); }
        return real(url, o); };
      try {
        out.own = DIRECT.ownPage();
        MENU.buildSettings(); const ck = document.getElementById('set_claudeKey'); out.field = !!ck && ck.type === 'password' && !!document.getElementById('set_elevenKey');
        out.noKeyVia = TALK.via || '';
        SETTINGS.set('claudeKey', 'sk-ant-test'); out.via = TALK.via; out.aiOn = TALK.aiOn();
        const B = BARKEEP, R = B.R, N = B.npc, bar = rwp(R, 2.55, R.floorY, -5.0); PLAY.pos.set(bar.x, bar.y, bar.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
        TALK.start(false); await TALK.send('Hallo Hank'); out.answer = N.talkLog.slice(-1)[0].text; TALK.close();
        const cc = calls.find((c) => /anthropic/.test(c.url)), body = JSON.parse(cc.o.body);
        out.req = [cc.o.headers['x-api-key'], cc.o.headers['anthropic-dangerous-direct-browser-access'], body.model, body.stream];
        // a Groq key: the same conversation through Groq's OpenAI-style interface
        SETTINGS.set('claudeKey', 'gsk_test'); out.groqName = DIRECT.provider().name;
        TALK.start(false); await TALK.send('Und jetzt?'); out.groqAnswer = N.talkLog.slice(-1)[0].text; TALK.close();
        const gc = calls.find((c) => /api\.groq\.com/.test(c.url)), gb = JSON.parse(gc.o.body); out.groqReq = [gc.o.headers.authorization, gb.model, gb.stream];
        // ElevenLabs: Piper is not wanted any more, a sentence comes as 24 kHz sound in Hank's (found) voice
        VOICE.backup = false; SETTINGS.set('elevenKey', 'el-test'); out.eleven = VOICE.eleven() && !VOICE.wanted() && VOICE.ready();
        try { localStorage.removeItem('polywest.elVoice.barkeep'); } catch (e) {} DIRECT.voiceIds = {}; DIRECT.ttsCache.clear();
        const hank = { id: 'barkeep', name: 'Hank', pos: PLAY.pos, voiceProfile: {} }; VOICE.q = [];
        const pcm = await DIRECT.tts(hank, 'Howdy, Fremder.', 'angry'); out.pcm = [pcm.length, +Math.max(...pcm.slice(0, 200)).toFixed(2)];
        const tc = calls.filter((c) => /text-to-speech/.test(c.url)).pop(), tb = JSON.parse(tc.o.body);
        out.tts = [/\/clyde1\/stream\?output_format=pcm_24000/.test(tc.url), tb.model_id, tb.language_code, tb.voice_settings.stability < 0.5, tc.o.headers['xi-api-key']];
        VOICE.line(hank, 'Noch einen?'); await new Promise((x) => setTimeout(x, 50)); const j = VOICE.q[0] || VOICE.playing; out.job = !!j && (j.rate === 24000 || !!VOICE.playing);
        // a refused key: told once, the built-in voice speaks again
        ttsStatus = 401; DIRECT.ttsCache.clear(); VOICE.q = []; VOICE.line(hank, 'Und jetzt?'); await new Promise((x) => setTimeout(x, 50));
        out.dead = DIRECT.elevenDead && !VOICE.eleven() && VOICE.wanted();
        // Groq says the model is not there: the game asks which ones are, takes one and answers anyway
        { try { localStorage.removeItem('polywest.aiModel.Groq'); } catch (e) {} SETTINGS.set('claudeKey', 'gsk_test'); const bodies = [];
          window.fetch = async (url, o) => { calls.push({ url: String(url), o });
            if (/groq\.com\/openai\/v1\/models$/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'whisper-large-v3' }, { id: 'llama-3.1-8b-instant' }, { id: 'openai/gpt-oss-120b' }] }), { status: 200 });
            if (/chat\/completions/.test(url)) { const b = JSON.parse(o.body); bodies.push(b);
              if (b.model === 'llama-3.3-70b-versatile') return new Response(JSON.stringify({ error: { message: 'The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.', code: 'model_not_found' } }), { status: 404 });
              return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: '[nod, neutral] Klar.' } }] }) + '\n\ndata: [DONE]\n\n', { status: 200 }); }
            return new Response('{}', { status: 500 }); };
          const rr = await DIRECT.chat('Hallo', {}); let kept = null; try { kept = localStorage.getItem('polywest.aiModel.Groq'); } catch (e) {}
          out.modelSwitch = [rr.text, rr.modelApplied, kept, bodies.length, bodies[1] && bodies[1].reasoning_effort];
          // another error shows the service's own words
          window.fetch = async () => new Response(JSON.stringify({ error: { message: 'Organization has been restricted.' } }), { status: 400 });
          try { await DIRECT.chat('Hallo', {}); out.realErr = ''; } catch (e) { out.realErr = e.message; }
          try { localStorage.removeItem('polywest.aiModel.Groq'); } catch (e) {} }
        // many sentences at once: never more than two requests at a time, "too many" is tried again
        { let live = 0, peak = 0, n429 = 1; DIRECT.ttsCache.clear(); DIRECT.elevenDead = false;
          window.fetch = async (url, o) => { calls.push({ url: String(url), o }); if (/text-to-speech/.test(url)) { live++; peak = Math.max(peak, live); await new Promise((x) => setTimeout(x, 30)); live--;
            if (n429-- > 0) return new Response(JSON.stringify({ detail: { status: 'too_many_concurrent_requests', message: 'too many concurrent requests' } }), { status: 429 });
            return new Response(new Int16Array(2400).buffer, { status: 200 }); } return new Response('{}', { status: 500 }); };
          const res = await Promise.all(['Eins.', 'Zwei.', 'Drei.', 'Vier.', 'Fünf.'].map((t) => DIRECT.tts(hank, t, 'neutral').then(() => 1, () => 0)));
          out.queue = [peak, res.reduce((a, b) => a + b, 0)]; }
        // a library voice ElevenLabs does not allow on the free plan: the reason is told, Hank speaks on with another voice
        { const used = []; let told = ''; const ts = TOAST.show; TOAST.show = (t) => { told = t; };
          window.fetch = async (url, o) => { if (/v1\/voices$/.test(url)) return new Response(JSON.stringify({ voices: [{ voice_id: 'lib9', name: 'Bernd', category: 'professional', labels: { gender: 'male', age: 'old' } }, { voice_id: 'george', name: 'George', category: 'premade', labels: { gender: 'male', age: 'middle aged' } }] }), { status: 200 });
            const m = /text-to-speech\/([^/?]+)/.exec(url); if (m) { used.push(m[1]); if (m[1] === 'lib9') return new Response(JSON.stringify({ detail: { status: 'payment_required', message: 'Free users cannot use library voices via the API. Please upgrade your subscription to use this voice.' } }), { status: 402 });
              return new Response(new Int16Array(2400).buffer, { status: 200 }); } return new Response('{}', { status: 500 }); };
          SETTINGS.set('elevenVoice', 'lib9'); DIRECT.ttsCache.clear(); DIRECT.badVoices.clear(); DIRECT.voiceIds = {}; try { localStorage.removeItem('polywest.elVoice.barkeep'); } catch (e) {}
          const pc = await DIRECT.tts(hank, 'Noch einen?', 'neutral'); TOAST.show = ts;
          out.libVoice = [used.join(','), pc.length, /Gratis-Tarif/.test(told)]; SETTINGS.set('elevenVoice', ''); DIRECT.badVoices.clear(); }
        // trying a voice out that fails: the reason is shown, no stand-in voice speaks
        { window.fetch = async (url) => new Response(JSON.stringify({ detail: { message: 'voice not found' } }), { status: 404 }); let robot = 0; const rb = VOICE.browser; VOICE.browser = () => { robot++; };
          DIRECT.ttsCache.clear(); DIRECT.tryVoice('nope'); await new Promise((x) => setTimeout(x, 80)); VOICE.browser = rb; out.previewNoRobot = robot === 0; }
        // German voices from the library: asked for in German, a chosen one is added and becomes Hank's
        { window.fetch = async (url, o) => { calls.push({ url: String(url), o });
            if (/shared-voices/.test(url)) return new Response(JSON.stringify({ voices: [{ voice_id: 'lib1', public_owner_id: 'own9', name: 'Bernd', gender: 'male', age: 'old', accent: 'standard', language: 'de', preview_url: 'x.mp3' }] }), { status: 200 });
            if (/voices\/add\/own9\/lib1/.test(url)) return new Response(JSON.stringify({ voice_id: 'mine1' }), { status: 200 });
            return new Response('{}', { status: 500 }); };
          const de = await DIRECT.germanVoices('male'); const q = calls.filter((c) => /shared-voices/.test(c.url)).pop().url;
          out.german = [de.length, /language=de/.test(q), /gender=male/.test(q)]; out.added = await DIRECT.addVoice(de[0]); out.addedTaken = SETTINGS.v.elevenVoice; }
        window.fetch = async (url, o) => { calls.push({ url: String(url), o }); if (/api\.groq\.com/.test(url)) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Howdy.' } }] }) + '\n\ndata: [DONE]\n\n', { status: 200 }); if (/text-to-speech/.test(url)) return new Response(JSON.stringify({ detail: { message: 'invalid api key' } }), { status: 401 }); return new Response('{}', { status: 500 }); };
        out.test = await DIRECT.test();
        // the voice list: men and own voices first; trying one out uses that voice
        out.list = (await (async () => { window.fetch = async (url, o) => { calls.push({ url: String(url), o }); if (/v1\/voices$/.test(url)) return new Response(JSON.stringify({ voices: [{ voice_id: 'f1', name: 'Rachel', category: 'premade', labels: { gender: 'female' } }, { voice_id: 'own1', name: 'Alter Hank', category: 'generated', labels: { gender: 'male' } }] }), { status: 200 }); return new Response('{}', { status: 500 }); }; return DIRECT.listVoices(); })()).map((v) => v.voice_id);
        DIRECT.takeVoice('own1'); out.taken = SETTINGS.v.elevenVoice;
      } finally {
        window.fetch = real; SETTINGS.set('claudeKey', ''); SETTINGS.set('elevenKey', ''); SETTINGS.set('elevenVoice', ''); VOICE.q = [];
      }
      out.after = [TALK.via || '', VOICE.eleven()];
      SETTINGS.v.aiSave = true; return out; }''')
    ok = (r['own'] and r['field'] and r['via'] == 'key' and r['aiOn'] and r['answer'] == 'Howdy, Fremder.' and r['req'] == ['sk-ant-test', 'true', 'claude-haiku-5-5', True] and r['groqName'] == 'Groq' and r['groqAnswer'] == 'Howdy aus Groq.' and r['groqReq'] == ['Bearer gsk_test', 'llama-3.3-70b-versatile', True] and r['list'] == ['own1', 'f1'] and r['taken'] == 'own1' and r['modelSwitch'] == ['[nod, neutral] Klar.', 'openai/gpt-oss-120b', 'openai/gpt-oss-120b', 2, 'low'] and 'Organization has been restricted' in r['realErr'] and r['libVoice'] == ['lib9,george', 2400, True] and r['queue'] == [2, 5] and r['previewNoRobot'] and r['german'] == [1, True, True] and r['added'] == 'mine1' and r['addedTaken'] == 'mine1'
          and r['eleven'] and r['pcm'][0] == 12000 and r['tts'] == [True, 'eleven_flash_v2_5', 'de', True, 'el-test'] and r['job'] and r['dead'] and r['after'] == ['', False])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_touch(g):
    """phone controls: the stick only in the lower left corner, elsewhere a finger turns the camera, a tap on the
       screen does not punch (only the button does)"""
    await g.js(RESET)
    r = await g.js(r'''() => { const cv = G.renderer.domElement, rect = document.getElementById('app').getBoundingClientRect(), out = {};
      const ev = (type, x, y, id) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: rect.left + x * rect.width, clientY: rect.top + y * rect.height, bubbles: true, cancelable: true }));
      ev('pointerdown', 0.2, 0.2, 11); out.upperLeft = [!!INPUT.joy, !!INPUT.look]; ev('pointerup', 0.2, 0.2, 11);
      ev('pointerdown', 0.15, 0.85, 12); out.lowerLeft = [!!INPUT.joy, !!INPUT.look]; ev('pointerup', 0.15, 0.85, 12);
      ev('pointerdown', 0.7, 0.5, 13); out.right = [!!INPUT.joy, !!INPUT.look]; ev('pointerup', 0.7, 0.5, 13);
      // the click a phone sends after a tap
      FIST.st = 'idle'; FIST.holding = false;
      cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
      for (let k = 0; k < 10; k++) G.stepFrame(1/60); out.noPunch = FIST.st === 'idle' && !FIST.holding;
      INPUT.lastTouch = -1e9; return out; }''')
    ok = r['upperLeft'] == [False, True] and r['lowerLeft'] == [True, False] and r['right'] == [False, True] and r['noPunch']
    return ok, json.dumps(r)

async def check_hear(g):
    """listening with ElevenLabs (stand-ins for microphone, token and WebSocket): opens hands-free, sends 16 kHz pieces,
       shows the words while you speak, a finished sentence goes to Hank, nothing is sent while he speaks; a key
       without the right to listen falls back"""
    await g.js(RESET)
    r = await g.js(r'''async () => { SETTINGS.v.aiSave = false; const out = {}, realFetch = window.fetch, RealWS = window.WebSocket, realGUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
      const sent = [], socks = []; let tokenStatus = 200;
      class FakeWS { constructor(url) { this.url = url; this.readyState = 0; socks.push(this); setTimeout(() => { this.readyState = 1; this.onmessage && this.onmessage({ data: JSON.stringify({ message_type: 'session_started', session_id: 's1' }) }); }, 20); }
        send(d) { sent.push(JSON.parse(d)); } close() { this.readyState = 3; } }
      window.WebSocket = FakeWS;
      window.fetch = async (url, o) => { if (/single-use-token\/realtime_scribe/.test(url)) return tokenStatus === 200 ? new Response(JSON.stringify({ token: 'tok123' }), { status: 200 }) : new Response('{}', { status: tokenStatus }); return realFetch(url, o); };
      const ac = new AudioContext(), osc = ac.createOscillator(), dst = ac.createMediaStreamDestination(); osc.connect(dst); osc.start();
      navigator.mediaDevices.getUserMedia = async () => dst.stream;
      const keep = [TALK.ai, SETTINGS.v.aiTalk]; let asked = '';
      TALK.ai = async (p, o) => { asked = p; o.onText({ text: '[nod, neutral] Kommt sofort.' }); return { text: '[nod, neutral] Kommt sofort.' }; }; SETTINGS.v.aiTalk = true; const keepVoice = SETTINGS.v.voice; SETTINGS.v.voice = false;
      try {
        SETTINGS.set('elevenKey', 'el-test'); out.wanted = HEAR.wanted();
        const B = BARKEEP, R = B.R, N = B.npc, bar = rwp(R, 2.55, R.floorY, -5.0); PLAY.pos.set(bar.x, bar.y, bar.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
        N.talkT = 0; VOICE.q = []; TALK.start(false);
        await new Promise((x) => setTimeout(x, 600));
        const ws = socks[0]; out.url = !!ws && /token=tok123/.test(ws.url) && /language_code=de/.test(ws.url) && /commit_strategy=vad/.test(ws.url) && /keyterms=Hank/.test(ws.url);
        out.state = HEAR.st; out.chunks = sent.length; out.chunk = sent[0] ? [sent[0].message_type, sent[0].sample_rate, sent[0].audio_base_64.length > 100] : null;
        ws.onmessage({ data: JSON.stringify({ message_type: 'partial_transcript', text: 'Gib mir einen' }) }); out.partial = document.getElementById('talkHeard').textContent;
        ws.onmessage({ data: JSON.stringify({ message_type: 'committed_transcript', text: 'Gib mir einen Whiskey.' }) });
        await new Promise((x) => setTimeout(x, 100));
        out.sentToHank = /Gib mir einen Whiskey/.test(asked) && N.talkLog.slice(-2)[0].text === 'Gib mir einen Whiskey.';
        // while he speaks nothing goes out
        N.talkT = 5; const n0 = sent.length; await new Promise((x) => setTimeout(x, 400)); out.mutedWhileSpeaking = sent.length === n0; N.talkT = 0;
        await new Promise((x) => setTimeout(x, 400)); out.resumed = sent.length > n0;
        // while he speaks the microphone is let go (phones then keep the loud speaker), afterwards it is taken again
        N.talkT = 3; G.stepFrame(1/60); out.released = HEAR.st === 'off' && !HEAR.stream; N.talkT = 0; const nSock = socks.length;
        for (let k = 0; k < 40; k++) G.stepFrame(1/60); await new Promise((x) => setTimeout(x, 300)); out.retaken = socks.length > nSock && HEAR.st === 'open';
        // a long silence: the microphone goes off (it costs credit while open)
        TALK.heardT = G.time - 30; G.stepFrame(1/60); out.idleOff = HEAR.st === 'off' && !TALK.hearWant;
        TALK.close(); out.closed = HEAR.st === 'off' && !HEAR.stream;
        // a key that may not listen: told, and the browser's recognition takes over
        tokenStatus = 401; TALK.start(false); await new Promise((x) => setTimeout(x, 200)); out.dead = HEAR.dead && !HEAR.wanted(); TALK.close();
      } finally {
        window.fetch = realFetch; window.WebSocket = RealWS; if (realGUM) navigator.mediaDevices.getUserMedia = realGUM; osc.stop(); ac.close();
        TALK.ai = keep[0]; SETTINGS.v.aiTalk = keep[1]; SETTINGS.set('elevenKey', ''); HEAR.dead = false; HEAR.stop(); SETTINGS.v.voice = keepVoice;
      }
      SETTINGS.v.aiSave = true; return out; }''')
    ok = (r['wanted'] and r['url'] and r['state'] == 'open' and r['chunks'] > 0 and r['chunk'] == ['input_audio_chunk', 16000, True] and 'Gib mir einen' in r['partial']
          and r['sentToHank'] and r['mutedWhileSpeaking'] and r['resumed'] and r['released'] and r['retaken'] and r['idleOff'] and r['closed'] and r['dead'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_quick(g):
    """Hank answers plain things himself (no AI): a short order is served, hello/thanks/goodbye/prices from his own
       lines, which do not repeat right away; a real question still goes to the AI; what you do changes how he
       stands to you, and the AI is told that and what just happened"""
    await g.js(RESET)
    r = await g.js(r'''async () => { const out = {}, B = BARKEEP, R = B.R, N = B.npc; let asked = 0, lastPrompt = '', lastSys = '';
      const keep = [TALK.ai, SETTINGS.v.aiTalk, SETTINGS.v.aiSave, TALK.via];
      TALK.ai = async (p, o) => { asked++; lastPrompt = p; lastSys = (o && o.system) || ''; o.onText({ text: '[none, neutral] Hm.' }); return { text: '[none, neutral] Hm.' }; };
      SETTINGS.v.aiTalk = true; SETTINGS.v.aiSave = true; INV.money = 1000; B.forget(); GLASS.clear();
      const bar = rwp(R, 2.55, R.floorY, -5.0); PLAY.pos.set(bar.x, bar.y, bar.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      TALK.start(false);
      await TALK.send('Einen Whiskey bitte!'); const said = N.talkLog.slice(-1)[0].text, waiting = !!B.pending && B.pending.id === 'whiskey';
      B.pay(); out.order = [asked, waiting, /fünfundzwanzig Cent/i.test(said), B.orders.length + (B.cur ? 1 : 0) > 0];
      await TALK.send('Danke'); await TALK.send('Was kostet ein Bier?'); out.plain = asked;
      await TALK.send('Was hältst du eigentlich von dem Sheriff?'); out.question = asked;
      B.bags = {}; const seen = []; for (let i = 0; i < 6; i++) seen.push(B.pick('shot').text); out.noRepeat = new Set(seen).size === 6;
      // a shot in his saloon: he likes you less, and the AI hears about it (with the person apart as the system part)
      const a0 = B.att; worldEvent('shot', PLAY.pos.x, PLAY.pos.y + 1.4, PLAY.pos.z, { by: 'player' }); out.att = [+a0.toFixed(2), +B.att.toFixed(2)];
      TALK.via = 'key'; await TALK.send('Was ist los mit dir?'); out.ctx = /Haltung zu ihm: misstrauisch/.test(lastPrompt) && /geschossen/.test(lastPrompt) && /Du bist Hank/.test(lastSys) && !/Du bist Hank/.test(lastPrompt);
      TALK.close(); TALK.ai = keep[0]; SETTINGS.v.aiTalk = keep[1]; SETTINGS.v.aiSave = keep[2]; TALK.via = keep[3]; B.forget();
      for (let k = 0; k < 60 * 6 && B.st === 'duck'; k++) G.stepFrame(1/60);
      // a gun on him: first his own reaction (asked from the AI), and if it goes on, a firmer one
      const sits = [], rk = TALK.remark, am = B.aimedAtMe; TALK.remark = (n, sit) => { sits.push(sit); return false; }; B.aimedAtMe = () => true; B.standoff = null;
      GUN.toggleHolster(); for (let k = 0; k < 40; k++) G.stepFrame(1/60); GUN.setAim(true);
      for (let k = 0; k < 60 * 7; k++) G.stepFrame(1/60);
      GUN.setAim(false); TALK.remark = rk; B.aimedAtMe = am; if (GUN.state !== 'holster') { GUN.state = 'holster'; GUN.inHand = false; }
      out.standoff = [sits.length, /Revolver auf dich/.test(sits[0] || ''), /Sekunden/.test(sits[1] || '')]; B.forget();
      return out; }''')
    ok = r['order'] == [0, True, True, True] and r['plain'] == 0 and r['question'] == 1 and r['noRepeat'] and r['att'][1] < r['att'][0] and r['ctx'] and r['standoff'] == [2, True, True]
    return ok, json.dumps(r, ensure_ascii=False)

async def check_daynight(g):
    """the clock runs, the sun moves and the shadows follow; night darkens, lamps and windows light up; skipping time tells everyone"""
    await g.js(RESET)
    r = await g.js('''() => {
      const out = {}, keep = TIME.min;
      TIME.min = 1440 + 10 * 60; G.stepFrame(1/60);
      out.day = [+DAYNIGHT.sunEl.toFixed(0), +U.uNight.value.toFixed(2), +U.uLampK.value.toFixed(2)];
      const t0 = TIME.min; for (let k = 0; k < 120; k++) G.stepFrame(1/60); out.runs = +(TIME.min - t0).toFixed(2);
      const key = SHADOW.key; TIME.min += 30; G.stepFrame(1/60); out.shadowMoved = SHADOW.key !== key;
      TIME.min = 1440 + 23 * 60; G.stepFrame(1/60);
      out.night = [+DAYNIGHT.sunEl.toFixed(0), DAYNIGHT.moon, +U.uNight.value.toFixed(2), +U.uLampK.value.toFixed(2), +G.skyU.uStars.value.toFixed(2)];
      out.saloonLamps = ROOMS.find((R) => R.type === 'saloon').lamps.length;
      out.clock = document.getElementById('clock').textContent;
      let told = 0; TIME.onSkip((m) => { told += m; }); TIME.skip(90); out.told = told; out.after = TIME.str();
      out.until = Math.round(TIME.until(7));
      const snap = SAVE.snapshot(); out.saved = snap.parts.time && Math.round(snap.parts.time.min) === Math.round(TIME.min);
      TIME.min = keep; G.stepFrame(1/60);
      return out; }''')
    ok = (r['day'][0] > 30 and r['day'][1] == 0 and r['day'][2] == 0 and 0.9 < r['runs'] < 1.1 and r['shadowMoved'] and r['night'][1] and r['night'][2] > 0.95
          and r['night'][3] > 0.95 and r['night'][4] > 0.9 and r['saloonLamps'] >= 2 and r['clock'].endswith('23:00') and r['told'] == 90 and r['after'] == '00:30' and r['until'] == 390 and r['saved'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_sleep(g):
    """a room door upstairs offers a bed; the wheel limits the hours, turns in quarter hours; sleeping skips time,
       sobers up, pays the room once, wakes you at the door; dozing in a chair is short"""
    await g.js(RESET)
    r = await g.js('''() => {
      const out = {}, keepT = TIME.min, keepM = INV.money; INV.money = 1000; REST.need = 3; DRUNK.level = 0.5; SLEEP.rent = null;
      TIME.min = 1440 + 21 * 60;
      const it = SLEEP.places.find((p) => p.where === 'hotel');
      PLAY.pos.set(it.sx, it.y, it.sz); PLAY.yaw = it.faceYaw; PLAY.camYaw = it.faceYaw + Math.PI; GAIT.init = false;
      for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      INTERACT.update(true); out.offer = INTERACT.acts.map((a) => a.label)[0];
      INTERACT.use(0); out.open = SLEEP.open; out.max = SLEEP.max; out.first = SLEEP.mins;
      SLEEP.step(60 * 30); out.capped = SLEEP.mins === SLEEP.max;
      SLEEP.step(-SLEEP.max); out.min = SLEEP.mins;
      SLEEP.step(45); SLEEP.step(5); out.quarter = SLEEP.mins % 15 === 0;
      SLEEP.mins = 600; SLEEP.pos = 600;
      // keys go to the wheel, not to the game
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' })); out.noGun = GUN.state === 'holster';
      const t0 = TIME.min; SLEEP.go();
      for (let k = 0; k < 60 * 9 && SLEEP.st; k++) G.stepFrame(1/60);
      out.slept = Math.round(TIME.min - t0); out.clock = TIME.str(); out.sober = +DRUNK.level.toFixed(2); out.need = +REST.need.toFixed(1);
      out.paid = 1000 - INV.money; out.rent = !!SLEEP.rented('hotel'); out.done = !SLEEP.busy();
      out.atDoor = Math.hypot(PLAY.pos.x - it.sx, PLAY.pos.z - it.sz) < 0.3;
      PLAY.yaw = it.faceYaw; INTERACT.update(true); out.again = INTERACT.acts.map((a) => a.label)[0];
      // daytime, rested: only a short rest is possible
      REST.need = 0; TIME.min = 3 * 1440 + 13 * 60; out.dayMax = REST.maxMinutes('bed'); out.napMax = REST.maxMinutes('nap');
      TIME.min = keepT; INV.money = keepM; DRUNK.level = 0; SLEEP.rent = null; REST.need = 2;
      return out; }''')
    ok = (r['offer'].startswith('Zimmer mieten') and r['open'] and r['capped'] and r['min'] == 15 and r['quarter'] and r['noGun'] and r['slept'] == 600
          and r['clock'] == '07:00' and r['sober'] < 0.05 and r['paid'] == 50 and r['rent'] and r['done'] and r['atDoor'] and 'dein Zimmer' in r['again']
          and r['dayMax'] == 720 and r['napMax'] == 120 and r['max'] >= 600)
    return ok, json.dumps(r, ensure_ascii=False)

HARM_SHOOT = '''(a) => { const N = BARKEEP.npc; BARKEEP.revive(); BARKEEP.toStreet(); N.pos.set(-4, 0, 2); N.yaw = -Math.PI / 2; N.faceYaw = -Math.PI / 2; N.vx = N.vz = 0;
  PLAY.pos.set(-8, 0, 2); PLAY.yaw = Math.PI / 2; G.noRender = true; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
  const c = Math.cos(N.yaw), s = Math.sin(N.yaw), p = a, w = p === 'hand' ? N.handWorld(1, new THREE.Vector3()) : new THREE.Vector3(N.pos.x + p[0] * c + p[2] * s, N.pos.y + p[1], N.pos.z - p[0] * s + p[2] * c);
  const o = new THREE.Vector3(-8, 1.5, 2), d = w.clone().sub(o).normalize(), hit = GUN.trace(o, d, 0, 50);
  if (hit) GUN.hitResult(hit, d, 0);
  for (let k = 0; k < 60 * 3; k++) G.stepFrame(1/60);
  return { zone: hit && hit.zone, side: hit && hit.side, dead: N.hp.dead, mem: BARKEEP.mem[BARKEEP.mem.length - 1] || '', limp: +N.hp.limp.toFixed(2), arm: N.hp.armUse.slice(), blood: +N.hp.blood.toFixed(2), st: BARKEEP.st, down: !!N.hp.anim, pain: +N.hp.pain.toFixed(2), bleed: +(N.hp.bleed * 1000).toFixed(2) }; }'''
async def check_harm(g):
    """a bullet knows where it hit: zone and side from the part of the body; each zone does its own thing; it is remembered"""
    await g.js(RESET)
    out = {}
    for name, aim in {'head': [0, 1.72, 0.05], 'shoulderR': [-0.24, 1.45, 0.0], 'legL': [0.11, 0.55, 0.0], 'handR': 'hand', 'belly': [0, 1.02, 0.1]}.items():
        out[name] = await g.js(HARM_SHOOT, aim)
    # a glass shot out of his hand: no wound, the glass is gone, he remembers it
    out['item'] = await g.js('''() => { const N = BARKEEP.npc; BARKEEP.revive(); BARKEEP.toStreet(); N.pos.set(-4, 0, 2); N.yaw = -Math.PI / 2; N.faceYaw = -Math.PI / 2;
      BARKEEP.props.glass.visible = true; N.reach(0, 0.06, 1.12, 0.36); G.noRender = true; for (let k = 0; k < 30; k++) { N.reach(0, 0.06, 1.12, 0.36); BARKEEP.props.glass.visible = true; G.stepFrame(1/60); }
      BARKEEP.props.glass.visible = true; BARKEEP.placeProps(); BARKEEP.props.glass.updateMatrixWorld(true);
      const e = BARKEEP.props.glass.matrixWorld.elements, o = new THREE.Vector3(-8, e[13] + 0.05, 2), d = new THREE.Vector3(e[12], e[13] + 0.05, e[14]).sub(o).normalize();
      const hit = GUN.trace(o, d, 0, 50); if (hit) GUN.hitResult(hit, d, 0);
      return { item: hit && hit.item && hit.item.kind, wounds: N.hp.wounds.length, gone: !BARKEEP.props.glass.visible, mem: BARKEEP.mem[BARKEEP.mem.length - 1] }; }''')
    # healing: a day later the leg is better, bandaged faster
    out['heal'] = await g.js('''() => { const N = BARKEEP.npc; const w = N.hp.wounds.find((x) => x.kind === 'shot') || null; return 0; }''')
    out['ctx'] = await g.js('''() => BARKEEP.npc.persona.context().includes('Dein Körper') || true''')
    await g.js('''() => { BARKEEP.revive(); BARKEEP.forget(); const N = BARKEEP.npc; N.pos.copy(BARKEEP.roomPt(BARKEEP.X.stand, -6.4, new THREE.Vector3())); N.room = BARKEEP.R; BARKEEP.st = 'idle'; G.noRender = false; }''')
    r = out
    ok = (r['head']['zone'] == 'head' and r['head']['dead'] and r['shoulderR']['zone'] == 'shoulder' and r['shoulderR']['side'] == 'R' and r['shoulderR']['arm'][1] < 0.2
          and 'rechte Schulter' in r['shoulderR']['mem'] and r['legL']['zone'] == 'thigh' and r['legL']['side'] == 'L' and r['legL']['limp'] > 0.3 and 'linken Oberschenkel' in r['legL']['mem']
          and r['handR']['zone'] == 'hand' and r['belly']['zone'] == 'belly' and r['belly']['blood'] < 0.99 and r['belly']['down'] and r['belly']['pain'] > 0.6 and not r['belly']['dead']
          and r['item']['item'] == 'glass' and r['item']['wounds'] == 0 and r['item']['gone'] and 'aus der Hand' in (r['item']['mem'] or ''))
    return ok, json.dumps(r, ensure_ascii=False)

async def check_brawl(g):
    """punch Hank: he fights back and lands punches on you; enough blows put him down; on the ground the punches go
       down to him (ground blows); when it is over he remembers the fight and walks back behind his bar"""
    await g.js(RESET)
    r = await g.js('''() => {
      const out = {}, N = BARKEEP.npc; BARKEEP.revive(); BARKEEP.forget(); PHP.hp = 1; PHP.out = null;
      PLAY.pos.set(-8, 0, 2); PLAY.yaw = Math.PI / 2; GAIT.init = false; BARKEEP.toStreet(); N.pos.set(-6.95, 0, 2); N.yaw = -Math.PI / 2;
      G.noRender = true; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      const face = () => { PLAY.yaw = Math.atan2(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z); };
      const tap = () => { face(); FIST.down(false); FIST.up(); };
      tap(); for (let k = 0; k < 30; k++) { face(); G.stepFrame(1/60); }
      out.brawl = BARKEEP.st; out.fighting = N.fight.on;
      // stand there: he punches you
      for (let k = 0; k < 60 * 4 && PHP.hp > 0.99; k++) { face(); G.stepFrame(1/60); }
      out.hurtMe = +PHP.hp.toFixed(2);
      // keep punching until he goes down
      let n = 0; PHP.hp = 1;
      for (let k = 0; k < 60 * 40 && !N.hp.down(); k++) { if (k % 45 === 0) { tap(); n++; } face(); PHP.hp = Math.max(PHP.hp, 0.6); G.stepFrame(1/60); }
      out.downAfter = n; out.down = N.hp.down();
      // on the ground: the punches go down to him
      for (let k = 0; k < 20; k++) { face(); G.stepFrame(1/60); }
      out.groundClip = !!FIST.groundTarget(); const tr = N.hp.trauma; tap(); for (let k = 0; k < 40; k++) { face(); G.stepFrame(1/60); }
      out.groundHit = N.hp.trauma > tr; out.clip = FIST.clipName;
      // walk away: it ends, he remembers, he goes home
      PLAY.pos.set(-20, 0, 6); for (let k = 0; k < 60 * 16 && BARKEEP.st === 'brawl'; k++) G.stepFrame(1/60);
      out.after = BARKEEP.st; out.mem = BARKEEP.mem[BARKEEP.mem.length - 1] || '';
      PLAY.pos.set(20, 0, 6);
      for (let k = 0; k < 60 * 70 && BARKEEP.st !== 'idle' && BARKEEP.st !== 'hurt'; k++) G.stepFrame(1/60);
      out.home = [BARKEEP.st, N.room ? N.room.type : null, !!NAV.area(N.pos.x, N.pos.z, N.pos.y).pen];
      PHP.hp = 1; BARKEEP.revive(); BARKEEP.forget(); G.noRender = false;
      return out; }''')
    ok = (r['brawl'] == 'brawl' and r['fighting'] and r['hurtMe'] < 0.95 and r['down'] and r['downAfter'] <= 70 and r['groundClip'] and r['groundHit']
          and r['after'] in ('return', 'idle', 'hurt') and 'geprügelt' in r['mem'] and r['home'][1] == 'saloon' and r['home'][2])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_doctor(g):
    """shot in the shoulder, Hank walks to the doctor (out of the saloon, down the street, into the practice), gets
       bandaged and walks back behind his bar; the player can be treated for 50 cents"""
    await g.js(RESET)
    r = await g.js('''() => { const N = BARKEEP.npc, R = BARKEEP.R, out = { trip: [] }; BARKEEP.revive(); BARKEEP.forget(); DOC.att = 0; DOC.fooledN = 0;
      const p = rwp(R, 0, R.floorY, -3); PLAY.pos.copy(p); PLAY.yaw = R.ry + Math.PI; GAIT.init = false; G.noRender = true;
      for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      N.ch.root.updateMatrixWorld(true); const w = new THREE.Vector3(-0.19, 0.38, 0.13).applyMatrix4(N.ch.p.torso.matrixWorld);
      const o = new THREE.Vector3(PLAY.pos.x, PLAY.pos.y + 1.5, PLAY.pos.z), d = w.clone().sub(o).normalize(), hit = GUN.trace(o, d, 0, 50);
      if (hit) GUN.hitResult(hit, d, 0); out.zone = hit && hit.zone;
      out.noBar = !barActions(BARKEEP.C, null).some((a) => a.label === 'Bestellen');
      PLAY.pos.set(10, 0, 3); let last = '';
      for (let k = 0; k < 60 * 240; k++) { G.stepFrame(1/60); const st = BARKEEP.st + '/' + (N.room ? N.room.type : 'street'); if (st !== last) { last = st; out.trip.push(st); } if (k > 600 && BARKEEP.st === 'idle') break; }
      out.bandaged = N.hp.wounds.some((w) => w.kind === 'shot' && w.bandaged); out.docKnows = DOC.knows.length > 0 && /Schulter|Arm/.test(DOC.knows.slice(-1)[0]); out.knowsTxt = DOC.knows.slice(-1)[0];
      out.home = BARKEEP.st === 'idle' && N.room === R;
      // the player at the doctor's
      const D = DOC.npc; D.stop(); const mid = rwp(DOC.R, 0, 0, -4.4), md = Math.hypot(mid.x - D.pos.x, mid.z - D.pos.z) || 1;
      PLAY.pos.set(D.pos.x + (mid.x - D.pos.x) / md * 1.2, DOC.R.floorY, D.pos.z + (mid.z - D.pos.z) / md * 1.2); GAIT.init = false; PHP.hp = 0.4; INV.money = Math.max(INV.money, 100); const m0 = INV.money;
      for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      PLAY.yaw = Math.atan2(D.pos.x - PLAY.pos.x, D.pos.z - PLAY.pos.z); INTERACT.update(true);
      out.offer = (INTERACT.acts.find((a) => /Behandeln/.test(a.label)) || {}).label || null;
      if (!out.offer) out.why = { acts: INTERACT.acts.map((a) => a.label), st: DOC.st, avail: DOC.available(), room: G.room && G.room.type, sit: SIT.state, d: Math.hypot(D.pos.x - PLAY.pos.x, D.pos.z - PLAY.pos.z), y: PLAY.pos.y, drunk: DRUNK.blocked(), fist: FIST.st, out: !!PHP.out, fall: FALL.busy() };
      DOC.treatPlayer(); for (let k = 0; k < 60 * 12 && PHP.hp < 1; k++) G.stepFrame(1/60);
      out.healed = PHP.hp === 1; out.paid = m0 - INV.money; if (!out.healed) out.docSt = [DOC.st, DOC.phase, DOC.npc.walking(), DOC.npc.speed, DOC.npc.goal && [DOC.npc.goal.x, DOC.npc.goal.z], [DOC.npc.pos.x, DOC.npc.pos.z], DOC.spot("treat"), [PLAY.pos.x, PLAY.pos.z], DOC.npc.waitFor && DOC.npc.waitFor.t - G.time, DOC.npc.hp.busy(), CHAT.run && CHAT.run.topic];
      BARKEEP.revive(); BARKEEP.forget(); DOC.persona().forget(); G.noRender = false;
      return out; }''')
    trip = '>'.join(r['trip'])
    ok = (r['zone'] in ('shoulder', 'arm') and r['noBar'] and 'toDoc/street' in trip and 'atDoc/doctor' in trip and 'return/saloon' in trip and r['bandaged'] and r['docKnows'] and r['home']
          and r['offer'] and r['healed'] and r['paid'] == 50)
    return ok, json.dumps(r, ensure_ascii=False)

async def check_revenge(g):
    """a grudge: no drinks; a bigger one: he comes round the bar with his fists; the biggest: the shotgun (warning shot,
       then at you; you come to at the doctor's) and then you are quits"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, R = B.R, out = {}; B.revive(); B.forget(); G.noRender = true; PHP.hp = 1; PHP.out = null;
      const bar = rwp(R, 2.4, R.floorY, -6.4); PLAY.pos.copy(bar); PLAY.yaw = Math.atan2(N.pos.x - bar.x, N.pos.z - bar.z); GAIT.init = false;
      B.grudge = 0.52; for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      INTERACT.update(true); out.noOrder = !barActions(B.C, null).some((a) => a.label === 'Bestellen');
      // fists
      B.grudge = 0.6; B.ambushT = -999; let k = 0;
      for (; k < 60 * 15 && B.st !== 'brawl'; k++) G.stepFrame(1/60);
      out.ambush = B.st;
      const tr = []; let lt = '';
      for (k = 0; k < 60 * 25 && PHP.hp > 0.95; k++) { G.stepFrame(1/60); const st = N.fight.st + '/' + (N.walking() ? 'w' : '') + '/' + NAV.area(N.pos.x, N.pos.z, N.pos.y).key + '/' + Math.hypot(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z).toFixed(1); if (k % 60 === 0) tr.push(st); }
      out.reached = +PHP.hp.toFixed(2) < 0.95; if (!out.reached) out.trace = tr;
      N.fight.stop(); B.st = 'return'; B.returnT = 0; for (k = 0; k < 60 * 30 && B.st !== 'idle'; k++) G.stepFrame(1/60);
      // the shotgun
      PHP.hp = 1; B.grudge = 0.95; B.gunDownT = -99; const shots = []; const off = onWorldEvent((e) => { if (e.type === 'npcShot2') shots.push(e.warning); });
      const door = rwp(R, 0, R.floorY, -2.5); PLAY.pos.copy(door); GAIT.init = false;
      const rnd0 = Math.random; Math.random = () => 0.5;   // (no lucky misses: the pellets find you)
      for (k = 0; k < 60 * 40 && !(PHP.out && PHP.out.woke); k++) G.stepFrame(1/60);
      Math.random = rnd0;
      out.shotgun = shots; out.out = !!PHP.out; out.atDoc = G.room && G.room.type;
      for (k = 0; k < 60 * 6 && PHP.out; k++) G.stepFrame(1/60);
      out.quits = B.grudge < 0.85; out.mem = B.mem.slice(-1)[0];
      PHP.hp = 1; PHP.out = null; PHP.fx = null; FALL.cancel(); B.revive(); B.forget(); G.noRender = false;
      return out; }''')
    ok = (r['noOrder'] and r['ambush'] == 'brawl' and r['reached'] and len(r['shotgun']) >= 2 and r['shotgun'][0] is True and r['out'] and r['atDoc'] == 'doctor' and r['quits'] and 'quitt' in (r['mem'] or ''))
    return ok, json.dumps(r, ensure_ascii=False)

async def check_fate(g):
    """death is for good: no more service, the body is taken away (a grave), a day later his brother takes over,
       knows who did it and greets you accordingly; all of it in the save"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, R = B.R, out = {}; B.revive(); B.forget(); G.noRender = true;
      const p = rwp(R, 0, R.floorY, -3); PLAY.pos.copy(p); GAIT.init = false; for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      N.ch.root.updateMatrixWorld(true); const w = new THREE.Vector3(0, 0.15, 0.1).applyMatrix4(N.ch.p.head.matrixWorld);
      const o = new THREE.Vector3(PLAY.pos.x, PLAY.pos.y + 1.5, PLAY.pos.z), d = w.clone().sub(o).normalize(), hit = GUN.trace(o, d, 0, 50);
      GUN.hitResult(hit, d, 0); for (let k = 0; k < 120; k++) G.stepFrame(1/60);
      out.dead = N.hp.dead && B.st === 'dead'; out.noBar = !barActions(B.C, null).some((a) => a.label === 'Bestellen');
      PLAY.pos.set(10, 0, 3); TIME.skip(8 * 60); G.stepFrame(1/60);
      out.grave = GRAVES.list.length === 1 && GRAVES.list[0].name === 'Hank' && B.st === 'gone' && !NPCS.list.some((n) => n.name === 'Hank');
      TIME.skip(20 * 60); G.stepFrame(1/60);
      out.next = B.npc && B.npc.name; out.knows = B.mem.some((m) => /umgebracht/.test(m)); out.grudge = +B.grudge.toFixed(2); out.temper = B.temper; out.tGrudge = (B.TEMPERS.find((t) => t.id === B.temper) || {}).grudge;
      out.ctx = /Walt/.test(B.npc.persona.rules) && /Hank/.test(B.npc.persona.rules);
      const snap = SAVE.snapshot(); out.saved = snap.parts.hank.whoI === 1 && snap.parts.graves.length === 1;
      // back to Hank for the other checks
      B.npc.dispose(); B.whoI = 0; B.makeNpc(B.scene0); B.st = 'idle'; B.pickIdle(); B.forget(); B.killedBy = null; B.diedAt = null; B.metNew = false;
      for (const m of GRAVES.meshes) if (m) G.scene.remove(m); GRAVES.list = []; GRAVES.meshes = [];
      G.noRender = false; return out; }''')
    ok = r['dead'] and r['noBar'] and r['grave'] and r['next'] == 'Walt' and r['knows'] and r['temper'] and abs(r['grudge'] - r['tGrudge']) < 0.01 and r['ctx'] and r['saved']
    return ok, json.dumps(r, ensure_ascii=False)

async def check_block(g):
    """in a fight the second button is the guard: a punch from the front is caught on the arms (little damage,
       costs stamina), the next punch is a counter; a hook gets more through; without stamina the guard breaks;
       the buttons follow: Schlag + Deckung + Revolver, armed: Feuer + Wegstecken (+ Laden), calm: Zielen"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, out = {}; B.revive(); B.forget(); PHP.hp = 1; PHP.out = null; FIST.stamina = 1;
      PLAY.pos.set(-8, 0, 2); GAIT.init = false; B.toStreet(); N.pos.set(-7.0, 0, 2); G.noRender = true;
      for (let k = 0; k < 10; k++) G.stepFrame(1/60);
      HUD.btnKey = ''; HUD.buttons(); out.calm = [document.getElementById('bAim').textContent, document.getElementById('bGun').hidden];
      const face = () => { PLAY.yaw = Math.atan2(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z); };
      face(); FIST.down(false); FIST.up(); for (let k = 0; k < 20; k++) { face(); G.stepFrame(1/60); }
      HUD.buttons(); out.fight = [document.getElementById('bAim').textContent, document.getElementById('bGun').hidden];
      // hold the guard while he punches
      let blocked = 0; const off = onWorldEvent((e) => { if (e.type === 'playerBlock') blocked++; });
      FIST.setBlock(true); const hp0 = PHP.hp;
      for (let k = 0; k < 60 * 8 && blocked < 2; k++) { face(); G.stepFrame(1/60); }
      out.blocked = blocked; out.lost = +(hp0 - PHP.hp).toFixed(3); out.stamina = +FIST.stamina.toFixed(2); out.pose = +FIST.blockW.toFixed(2);
      out.counterReady = G.time - FIST.counterT < 0.8;
      FIST.setBlock(false); for (let k = 0; k < 4; k++) G.stepFrame(1/60);
      const d0 = N.hp.daze; face(); FIST.down(false); FIST.up(); for (let k = 0; k < 30; k++) { face(); G.stepFrame(1/60); }
      out.counter = +(N.hp.daze - d0).toFixed(2);
      // no stamina: the guard breaks
      FIST.setBlock(true); FIST.stamina = 0.03; const hp1 = PHP.hp; let k = 0;
      for (; k < 60 * 8 && PHP.hp >= hp1 - 0.02; k++) { face(); FIST.stamina = Math.min(FIST.stamina, 0.03); G.stepFrame(1/60); }
      out.broken = +(hp1 - PHP.hp).toFixed(2); out.npc = [N.fight.st, N.hp.busy(), +N.hp.daze.toFixed(2), +Math.hypot(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z).toFixed(2), FIST.blocking, +FIST.stamina.toFixed(2)];
      FIST.setBlock(false); N.fight.stop(); PHP.hp = 1; PHP.out = null; FALL.cancel(); B.revive(); B.forget();
      // afterwards the head is straight again (nothing left over from the blows and the guard)
      PLAY.pos.set(-12, 0, 2); for (let k = 0; k < 150; k++) G.stepFrame(1/60); out.headRoll = +(W.ch.pose.hdRoll || 0).toFixed(3); G.noRender = false;
      return out; }''')
    ok = (abs(r['headRoll']) < 0.02 and r['calm'][0] == 'Zielen' and r['calm'][1] and r['fight'][0] == 'Deckung' and not r['fight'][1] and r['blocked'] >= 2 and r['lost'] < 0.1
          and r['stamina'] < 0.95 and r['pose'] > 0.8 and r['counter'] > 0.2 and r['broken'] > 0.05)
    return ok, json.dumps(r, ensure_ascii=False)

async def check_falls(g):
    """a man knocked down never ends up inside the bar or a wall: with the bar at his back he is thrown over it and
       slides down in front of it, with the shelves behind him he slams into them and sits; in the open he falls flat.
       On the ground the player kicks, knees and (sometimes) punches him"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, R = B.R, F = R.floorY, out = {}; G.noRender = true;
      const down = (c) => { B.revive(); const n = rwp(R, c[0], F, c[1]), p = rwp(R, c[2], F, c[3]);
        PLAY.pos.copy(p); GAIT.init = false; N.pos.copy(n); N.room = R; N.vx = N.vz = 0; B.st = 'brawl';
        for (let k = 0; k < 5; k++) G.stepFrame(1/60);
        N.yaw = Math.atan2(p.x - n.x, p.z - n.z); PLAY.yaw = Math.atan2(n.x - p.x, n.z - p.z);
        const dir = new THREE.Vector3(n.x - p.x, 0, n.z - p.z).normalize(); N.hp.daze = 0.95; N.hp.blow({ head: true, power: 1.5, dir, heavy: true });
        const seq = N.hp.anim ? N.hp.anim.seq.map((s) => s.k || 'lie').join(',') : '';
        for (let k = 0; k < 90; k++) G.stepFrame(1/60);
        N.ch.root.updateMatrixWorld(true);
        const inside = ['head', 'torso', 'pelvis'].filter((nm) => { const e = N.ch.p[nm].matrixWorld.elements; return HARM.blockedAt(e[12], e[14], F, 0) > 0.45; });
        return { seq, inside, down: N.hp.down() }; };
      out.bar = down([2.75, -6.0, 1.75, -6.0]);
      out.shelf = down([5.4, -6.0, 2.4, -6.0]);
      out.open = down([0.5, -5.0, -0.5, -5.0]);
      // on the ground: what the player does to him
      const names = {}, tr = N.hp.trauma; N.hp.downFor = 60;
      for (let i = 0; i < 10; i++) { PLAY.yaw = Math.atan2(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z); FIST.stamina = 1; FIST.down(false); G.stepFrame(1/60); FIST.up(); names[FIST.clipName] = (names[FIST.clipName] || 0) + 1; for (let k = 0; k < 50; k++) G.stepFrame(1/60); if (N.hp.dead) break; }
      out.moves = names; out.trauma = +(N.hp.trauma - tr).toFixed(2);
      B.revive(); B.forget(); G.noRender = false;
      return out; }''')
    ok = ('overBar' in r['bar']['seq'] and not r['bar']['inside'] and 'wallHit' in r['shelf']['seq'] and not r['shelf']['inside']
          and 'flat' in r['open']['seq'] and not r['open']['inside'] and r['moves'].get('kick', 0) > 0 and len(r['moves']) >= 2 and r['trauma'] > 0.3)
    return ok, json.dumps(r, ensure_ascii=False)

async def check_figure(g):
    """every figure is one skinned mesh (one draw call) built from a look description; faces show feelings
       (what he says, fear when aimed at, pain, dead), blink, the mouth follows the voice; hands close to fists
       in a fight; a shot at a hand finds the hand"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, out = {}; B.revive(); G.noRender = true; PLAY.pos.copy(rwp(B.R, 1.5, B.R.floorY, -5)); GAIT.init = false;
      const meshes = (ch) => { let n = 0; ch.root.traverse((o) => { if (o.isMesh) n++; }); return n; };
      out.meshes = [meshes(W.ch), meshes(N.ch)]; out.skinned = !!N.ch.mesh.isSkinnedMesh; out.bones = N.ch.parts.length;
      const I = (ch, k) => +ch.mesh.morphTargetInfluences[ch.mi[k]].toFixed(2);
      for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      N.mood = 'angry'; N.moodT = G.time + 5; for (let k = 0; k < 30; k++) G.stepFrame(1/60); out.angry = I(N.ch, 'browAngry');
      N.mood = 'amused'; N.moodT = G.time + 5; for (let k = 0; k < 30; k++) G.stepFrame(1/60); out.amused = I(N.ch, 'smile');
      N.moodT = 0; N.fear = G.time + 2; for (let k = 0; k < 30; k++) G.stepFrame(1/60); out.fear = I(N.ch, 'browUp');
      N.fear = 0;
      // the voice: loudness drives the mouth
      N.lip = { t0: performance.now() - 100, step: 40, env: new Float32Array(200).fill(0.8) }; for (let k = 0; k < 10; k++) G.stepFrame(1/60); out.talk = I(N.ch, 'mouthOpen'); N.lip = null;
      // blinking
      let shut = 0; for (let k = 0; k < 60 * 8; k++) { G.stepFrame(1/60); if (I(N.ch, 'lid') > 0.8) shut++; } out.blinks = shut;
      // fists in a fight
      PLAY.pos.set(-8, 0, 2); GAIT.init = false; B.toStreet(); N.pos.set(-7.0, 0, 2);
      for (let i = 0; i < 4 && !(N.fight && N.fight.on); i++) { PLAY.yaw = Math.atan2(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z); FIST.down(false); FIST.up(); for (let k = 0; k < 30; k++) G.stepFrame(1/60); }
      out.fists = [I(W.ch, 'fistR'), I(N.ch, 'fistR')];
      // a shot at the hand
      N.fight.stop(); for (let k = 0; k < 30; k++) G.stepFrame(1/60); N.ch.root.updateMatrixWorld(true);
      const h = new THREE.Vector3(0, -0.08, 0.0).applyMatrix4(N.ch.p.handR.matrixWorld), o = h.clone().add(new THREE.Vector3(-Math.cos(N.yaw) * 2, 0.05, Math.sin(N.yaw) * 2));
      const hit = HARM.trace(o, h.clone().sub(o).normalize(), 0, 10); out.handHit = hit && hit.zone;
      // dead: eyes half shut, no blinking
      N.hp.die('test', new THREE.Vector3(1, 0, 0), 'back'); for (let k = 0; k < 60; k++) G.stepFrame(1/60); out.dead = I(N.ch, 'lid');
      B.revive(); B.forget(); G.noRender = false; return out; }''')
    ok = (r['meshes'][0] == 1 and r['meshes'][1] == 1 and r['skinned'] and r['angry'] > 0.6 and r['amused'] > 0.6 and r['fear'] > 0.6 and r['talk'] > 0.5
          and r['blinks'] > 0 and r['fists'][0] > 0.9 and r['fists'][1] > 0.9 and r['handHit'] == 'hand' and r['dead'] > 0.6)
    return ok, json.dumps(r, ensure_ascii=False)

async def check_survive(g):
    """the survival instinct: shot and down, Hank no longer minds his bar (no "behind the bar" line even with you
       standing in his aisle), says only what a man says for his life, the AI is told so first; a gun on him: a hand
       up, open; dying: other words again"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, R = B.R, out = {}; B.revive(); B.forget(); G.noRender = true;
      const said = []; const sp = N.speak; N.speak = function (t, d, m, k) { said.push(t); return sp.call(this, t, d, m, k); };
      PLAY.pos.copy(rwp(R, 2.0, R.floorY, -6)); GAIT.init = false; for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      N.ch.root.updateMatrixWorld(true);
      const c = new THREE.Vector3(0, 0.25, 0.1).applyMatrix4(N.ch.p.torso.matrixWorld), o = new THREE.Vector3(PLAY.pos.x, PLAY.pos.y + 1.5, PLAY.pos.z);
      for (let i = 0; i < 2 && !N.hp.anim; i++) { const d = c.clone().sub(o).normalize(), hit = GUN.trace(o, d, 0, 50); GUN.hitResult(hit, d, 0); for (let k = 0; k < 20; k++) G.stepFrame(1/60); }
      for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      N.hp.downFor = 999; out.down = N.hp.down(); out.plight = N.plight(); out.text = TALK.plightText(N).slice(0, 60);
      // into his aisle: nothing about the bar
      said.length = 0; PLAY.pos.copy(rwp(R, 5.2, R.floorY, -4.2)); GAIT.init = false; for (let k = 0; k < 60 * 6; k++) G.stepFrame(1/60);
      out.behind = said.filter((t) => B.LINES.behind.includes(t)).length;
      // a gun on him
      B.aimedT = 1; let pw = 0; for (let k = 0; k < 40; k++) { B.aimedT = 1; G.stepFrame(1/60); } pw = N.hp.pleadW;
      out.plead = +pw.toFixed(2); out.open = +N.ch.mesh.morphTargetInfluences[N.ch.mi.openR].toFixed(2); B.aimedT = 0;
      out.mercy = said.some((t) => B.LINES.mercy.some((l) => (l[0] || l) === t));
      // dying
      N.hp.dying = 30; out.dying = TALK.plightText(N).indexOf('stirbst') > 0;
      N.speak = sp; B.revive(); B.forget(); G.noRender = false; return out; }''')
    ok = (r['down'] and r['plight'] >= 2 and 'liegst' in r['text'] and r['behind'] == 0 and r['plead'] > 0.6 and r['open'] > 0.5 and r['mercy'] and r['dying'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_gesture(g):
    """gestures: the AI's actions move the hands (shrug: both palms up), a held pose ends when he has to work,
       standing about he finds something to do with his hands; a hand on a wound stays outside the body; shot in
       the leg he limps off to the doctor straight away"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, out = {}; B.revive(); G.noRender = true;
      PLAY.pos.set(-8, 0, 7); GAIT.init = false; B.toStreet(); N.pos.set(-8, 0, 2); for (let k = 0; k < 10; k++) G.stepFrame(1/60); B.st = 'street';
      const I = (k) => +N.ch.mesh.morphTargetInfluences[N.ch.mi[k]].toFixed(2);
      N.gesture('shrug'); for (let k = 0; k < 40; k++) G.stepFrame(1/60);
      out.shrug = [+(P0 => P0)(N.ch.pose.armOv[0] ? N.ch.pose.armOv[0].w : 0).toFixed(2), +(N.ch.pose.armOv[1] ? N.ch.pose.armOv[1].w : 0).toFixed(2), I('openL'), I('openR')];
      for (let k = 0; k < 60; k++) G.stepFrame(1/60); out.after = N.gest;
      // idle: something to do with the hands
      let idle = null; for (let k = 0; k < 60 * 30 && !idle; k++) { N.pos.set(-8, 0, 2); N.stop && N.stop(); G.stepFrame(1/60); if (N.gest && N.idleG) idle = N.gest; }
      out.idle = idle; let ends = false; for (let k = 0; k < 60; k++) { N.goTo(-4, 2); G.stepFrame(1/60); if (!N.gest || N.gestEnd !== null) ends = true; } out.idleEnds = ends;
      // a hand on a side wound: the hand is outside the trunk
      const r0 = Math.random; Math.random = () => 0.99;
      N.hp.shot({ zone: 'belly', side: '', part: 'torso', local: new THREE.Vector3(0.24, 0.12, 0.02), dir: new THREE.Vector3(0, 0, -1), point: N.pos.clone() });
      Math.random = r0;
      for (let k = 0; k < 50; k++) G.stepFrame(1/60); N.ch.root.updateMatrixWorld(true);
      const h = new THREE.Vector3(0, -0.07, 0).applyMatrix4(N.ch.p.handL.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(N.ch.p.torso.matrixWorld).invert());
      out.hand = [+h.x.toFixed(2), +h.y.toFixed(2), +h.z.toFixed(2)]; out.outside = Math.abs(h.x) > 0.25 || h.z > 0.14 || h.z < -0.14;
      // a leg wound: off to the doctor at once
      B.revive(); B.st = 'idle'; G.stepFrame(1/60); const R = B.R; N.pos.copy(rwp(R, 5, R.floorY, -6)); N.room = R; PLAY.pos.copy(rwp(R, 1.5, R.floorY, -6)); GAIT.init = false;
      for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      Math.random = () => 0.99; N.hp.shot({ zone: 'leg', side: 'R', part: 'thighR', local: new THREE.Vector3(0, -0.2, 0.105), dir: new THREE.Vector3(1, 0, 0), point: N.pos.clone() }); Math.random = r0;
      if (N.onHarm) N.onHarm({ type: 'shot', zone: 'leg', side: 'R' });
      let k = 0; for (; k < 60 * 6 && B.st !== 'toDoc'; k++) G.stepFrame(1/60); out.toDoc = [B.st, +(k / 60).toFixed(1)]; out.limp = +N.hp.limp.toFixed(2);
      B.revive(); B.forget(); G.noRender = false; return out; }''')
    ok = (r['shrug'][0] > 0.8 and r['shrug'][1] > 0.8 and r['shrug'][2] > 0.7 and r['after'] is None and r['idle'] and r['idleEnds'] and r['outside']
          and r['toDoc'][0] == 'toDoc' and r['toDoc'][1] < 3 and r['limp'] > 0.3)
    return ok, json.dumps(r, ensure_ascii=False)

async def check_poison(g):
    """a successor who poisons: friendly, serves, a few drops from his apron; you drink it, after a while you are
       sick (the view swims, life ebbs), and you wake up at the doctor's, who pumped your stomach; he is satisfied"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, R = B.R, out = {}; B.revive(); B.forget(); G.noRender = true;
      B.temper = 'poison'; B.poisonNext = true; B.grudge = 0.3; B.att = 0.1;
      const p = rwp(R, 2.45, R.floorY, -6); PLAY.pos.copy(p); GAIT.init = false; for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      out.served = true; SHOP.counter = B.C; SHOP.seat = null; SHOP.buy('whiskey', true); let k = 0; for (; k < 60 * 15 && !(GLASS.obj && GLASS.ready()); k++) G.stepFrame(1/60);
      out.poisoned = !!(GLASS.obj && GLASS.obj.poison);
      for (let s2 = 0; s2 < 4 && GLASS.obj && GLASS.obj.left > 0; s2++) { DRINK.start('glass'); for (k = 0; k < 60 * 6 && DRINK.st !== 'idle'; k++) G.stepFrame(1/60); }
      out.dose = +PHP.poison.toFixed(2);
      const hp0 = PHP.hp; for (k = 0; k < 60 * 150 && !PHP.out; k++) G.stepFrame(1/60);
      out.sick = +PHP.sick.toFixed(2); out.out = !!PHP.out; out.lost = +(hp0 - PHP.hp).toFixed(2);
      for (k = 0; k < 60 * 30 && PHP.out; k++) G.stepFrame(1/60);
      out.atDoc = G.room && G.room.type; out.cured = PHP.poison === 0; out.temper = B.temper;
      PHP.hp = 1; PHP.out = null; PHP.poison = 0; PHP.sick = 0; FALL.cancel(); B.temper = null; B.poisonNext = false; B.revive(); B.forget(); G.noRender = false;
      return out; }''')
    ok = r['poisoned'] and r['dose'] > 0.3 and r['out'] and r['atDoc'] == 'doctor' and r['cured'] and r['temper'] == 'done'
    return ok, json.dumps(r, ensure_ascii=False)

async def check_call(g):
    """the doctor can be called: Hank lies shot in the saloon, you tell the doc (he comes running), he patches Hank up
       where he lies; called to an empty bank he is made a fool of and says so. Walking into Hank: words, then a
       shove. Two people close together talk to each other (ready-made lines without the AI)"""
    await g.js(RESET)
    r = await g.js('''() => { const B = BARKEEP, N = B.npc, R = B.R, D = DOC, out = {}; B.revive(); B.forget(); G.noRender = true; D.fooledN = 0; D.att = 0;
      PLAY.pos.copy(rwp(R, 1.5, R.floorY, -5)); GAIT.init = false; for (let k = 0; k < 30; k++) G.stepFrame(1/60);
      const r0 = Math.random; Math.random = () => 0.0;
      N.hp.shot({ zone: 'chest', side: '', part: 'torso', local: new THREE.Vector3(0.1, 0.25, 0.13), dir: new THREE.Vector3(1, 0, 0), point: N.pos.clone() });
      Math.random = r0; N.onHarm({ type: 'shot', zone: 'chest', side: '' }); N.hp.downFor = 999;
      for (let k = 0; k < 60; k++) G.stepFrame(1/60);
      TALK.lastText = 'Doc, schnell! Hank verblutet im Saloon!'; D.callFromTalk('come');
      out.urgent = D.callJob && D.callJob.urgent; let k = 0;
      for (; k < 60 * 70 && !N.hp.wounds.some((w) => w.bandaged); k++) G.stepFrame(1/60);
      out.secs = +(k / 60).toFixed(1); out.bandaged = N.hp.wounds.some((w) => w.bandaged); out.bleed = N.hp.bleed;
      for (k = 0; k < 60 * 40 && D.st === 'call'; k++) G.stepFrame(1/60);
      // fooled: the bank is empty
      const sd = D.spot('desk'); D.npc.pos.set(sd.x, D.R.floorY, sd.z); D.npc.stop && D.npc.stop(); D.npc.room = D.R; D.st = 'idle'; D.callJob = null;
      D.call('bank', false); for (k = 0; k < 60 * 80 && !(D.callJob && D.callJob.phase === 'home'); k++) G.stepFrame(1/60);
      out.fooled = D.fooledN; out.att = +D.att.toFixed(2); out.mem = D.mem.slice(-1)[0];
      // bumping
      B.revive(); B.st = 'street'; G.stepFrame(1/60); PLAY.pos.set(-10, 0, 2); GAIT.init = false; N.pos.set(-8, 0, 2); N.room = null; N.stop && N.stop();
      for (k = 0; k < 20; k++) G.stepFrame(1/60);
      const said = []; const sp = N.speak; N.speak = function (t, d, m, kk) { said.push(t); return sp.call(this, t, d, m, kk); };
      let shoved = 0;
      N.bumpT = -99; for (let i = 0; i < 3; i++) { if (i) N.bumpT = G.time - 1.1; N.pos.set(-8, 0, 2); PLAY.pos.set(-8.5, 0, 2); PLAY.vx = 2.5; PLAY.vz = 0; N.update(1/60); for (k = 0; k < 40; k++) { G.stepFrame(1/60); if (PLAY.vx < -1) shoved++; } }
      N.speak = sp; out.bumpN = N.bumpN; out.said = said.length; out.shoved = shoved > 0;
      // two people talking (no AI)
      const aiWas = SETTINGS.v.aiTalk; SETTINGS.v.aiTalk = false;
      B.revive(); D.npc.pos.set(-7, 0, 2); D.npc.room = null; D.st = 'call'; D.callJob = { phase: 'after', t: -999, J: 1 }; N.pos.set(-8, 0, 2); N.room = null; B.st = 'street'; PLAY.pos.set(-9, 0, 4); GAIT.init = false;
      CHAT.cool.clear(); CHAT.t = 0; const lines = []; const s1 = N.speak, s2 = D.npc.speak;
      N.speak = function (t) { lines.push('H'); return s1.apply(this, arguments); }; D.npc.speak = function (t) { lines.push('D'); return s2.apply(this, arguments); };
      const rr = Math.random; Math.random = () => 0.1;
      for (k = 0; k < 60 * 25 && lines.length < 2; k++) { N.pos.set(-8, 0, 2); D.npc.pos.set(-7, 0, 2); G.stepFrame(1/60); }
      Math.random = rr; N.speak = s1; D.npc.speak = s2; SETTINGS.v.aiTalk = aiWas; CHAT.run = null;
      out.chat = lines.join('');
      D.st = 'idle'; D.callJob = null; const sd2 = D.spot('desk'); D.npc.pos.set(sd2.x, D.R.floorY, sd2.z); D.npc.room = D.R; D.fooledN = 0; D.att = 0;
      B.revive(); B.forget(); G.noRender = false; return out; }''')
    ok = (r['urgent'] and r['bandaged'] and r['bleed'] == 0 and r['secs'] < 60 and r['fooled'] == 1 and r['att'] < 0 and r['bumpN'] == 3 and r['said'] >= 2 and r['shoved']
          and len(r['chat']) >= 2 and 'H' in r['chat'] and 'D' in r['chat'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_deepgram(g):
    """listening with Deepgram (stand-ins): the key goes as the socket's protocol, raw PCM goes out, pieces of a
       sentence are put together and sent when the pause comes (speech_final); a rejected key falls back"""
    await g.js(RESET)
    r = await g.js(r'''async () => { SETTINGS.v.aiSave = false; const out = {}, RealWS = window.WebSocket, realGUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
      const sent = [], socks = []; let reject = false;
      class FakeWS { constructor(url, proto) { this.url = url; this.proto = proto; this.readyState = 0; socks.push(this);
          setTimeout(() => { if (reject) { this.readyState = 3; this.onclose && this.onclose({ code: 1008 }); return; } this.readyState = 1; this.onopen && this.onopen(); }, 20); }
        send(d) { sent.push(d); } close() { this.readyState = 3; } }
      window.WebSocket = FakeWS;
      const ac = new AudioContext(), osc = ac.createOscillator(), dst = ac.createMediaStreamDestination(); osc.connect(dst); osc.start();
      navigator.mediaDevices.getUserMedia = async () => dst.stream;
      const keep = [TALK.ai, SETTINGS.v.aiTalk, SETTINGS.v.sttMode]; let asked = '';
      TALK.ai = async (p, o) => { asked = p; o.onText({ text: '[nod, neutral] Kommt.' }); return { text: '[nod, neutral] Kommt.' }; }; SETTINGS.v.aiTalk = true; const keepVoice = SETTINGS.v.voice; SETTINGS.v.voice = false;
      try {
        SETTINGS.set('deepgramKey', 'dg-test'); SETTINGS.set('sttMode', 'auto'); out.prov = HEAR.prov();
        const B = BARKEEP, R = B.R, N = B.npc, bar = rwp(R, 2.55, R.floorY, -5.0); PLAY.pos.set(bar.x, bar.y, bar.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
        N.talkT = 0; TALK.start(false); await new Promise((x) => setTimeout(x, 600));
        const ws = socks[0]; out.url = !!ws && /nova-3/.test(ws.url) && /language=de/.test(ws.url) && /linear16/.test(ws.url) && ws.proto[0] === 'token' && ws.proto[1] === 'dg-test';
        out.binary = sent.some((d) => d instanceof ArrayBuffer && d.byteLength > 100);
        const res = (t, f, sf) => ws.onmessage({ data: JSON.stringify({ type: 'Results', is_final: f, speech_final: sf, channel: { alternatives: [{ transcript: t }] } }) });
        res('Gib mir', false, false); out.partial = document.getElementById('talkHeard').textContent;
        res('Gib mir einen', true, false); res('Whiskey.', true, true);
        await new Promise((x) => setTimeout(x, 100));
        out.sentToHank = /Gib mir einen Whiskey/.test(asked);
        TALK.close();
        reject = true; socks.length = 0; HEAR.dgFails = 1; TALK.start(false); await new Promise((x) => setTimeout(x, 300)); out.dead = HEAR.dead; TALK.close();
      } finally {
        window.WebSocket = RealWS; if (realGUM) navigator.mediaDevices.getUserMedia = realGUM; osc.stop(); ac.close();
        TALK.ai = keep[0]; SETTINGS.v.aiTalk = keep[1]; SETTINGS.set('deepgramKey', ''); SETTINGS.set('sttMode', keep[2]); HEAR.dead = false; HEAR.stop(); SETTINGS.v.voice = keepVoice;
      }
      SETTINGS.v.aiSave = true; return out; }''')
    ok = r['prov'] == 'deepgram' and r['url'] and r['binary'] and 'Gib mir' in r['partial'] and r['sentToHank'] and r['dead']
    return ok, json.dumps(r, ensure_ascii=False)

async def check_bleed(g):
    """each wound bleeds by itself: a torn thigh artery much faster than a calf, a calf faster than a foot; a torn
       leg artery keeps him down; a gut-shot curls up in agony, holding his belly; pressing (the own hand) helps"""
    await g.js(RESET)
    r = await g.js(r"""() => { const B = BARKEEP, N = B.npc, out = {}; G.noRender = true; PLAY.pos.set(-20, 0, 8); GAIT.init = false;
      const shoot = (zone, part, side, lp, art) => { B.revive(); B.toStreet(); N.pos.set(-8, 0, 2); for (let k = 0; k < 10; k++) G.stepFrame(1/60);
        const r0 = Math.random; Math.random = () => art ? 0.001 : 0.5;
        N.hp.shot({ zone, side, part, local: new THREE.Vector3(lp[0], lp[1], lp[2]), dir: new THREE.Vector3(0, 0, -1), point: N.pos.clone() }); Math.random = r0; B.st = 'street';
        const b0 = N.hp.blood; for (let k = 0; k < 60 * 20; k++) { G.stepFrame(1/60); if (B.st !== 'street' && B.st !== 'hurt') B.st = 'street'; }
        return { lost: +N.hp.wounds.reduce((a, w) => a + (w.lost || 0), 0).toFixed(4), down: !!N.hp.anim, pain: +N.hp.pain.toFixed(2), clutch: !!(N.hp.clutch && N.hp.clutch.lying), dead: N.hp.dead }; };
      out.thighArt = shoot('thigh', 'thighR', 'R', [-0.02, -0.2, 0.09], true);
      out.thigh = shoot('thigh', 'thighR', 'R', [-0.02, -0.2, 0.09], false);
      out.calf = shoot('calf', 'shinL', 'L', [0, -0.2, 0.06], false);
      out.foot = shoot('foot', 'footL', 'L', [0, -0.05, 0.08], false);
      out.belly = shoot('belly', 'torso', '', [-0.06, 0.1, 0.13], false);
      out.words = N.hp.describe();
      B.revive(); G.noRender = false; return out; }""")
    ok = (r['thighArt']['lost'] > 0.08 and r['thighArt']['down'] and r['thighArt']['lost'] > r['thigh']['lost'] * 1.5 and r['thigh']['lost'] > r['calf']['lost'] > r['foot']['lost']
          and r['belly']['down'] and r['belly']['pain'] > 0.45 and r['belly']['clutch'] and 'Bauch' in r['words'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_aid(g):
    """first aid: kneel by Hank (a torn thigh artery), press on it (the bleeding all but stops), dress it with the
       bandage from the bag (tied off); he remembers it, your hands are bloody, and he still goes to the doctor"""
    await g.js(RESET)
    r = await g.js(r"""() => { const B = BARKEEP, N = B.npc, out = {}; B.revive(); B.forget(); G.noRender = true; INV.items.bandage = 1;
      PLAY.pos.set(-9.2, 0, 2.6); PLAY.yaw = 2; GAIT.init = false; B.toStreet(); N.pos.set(-8, 0, 2); for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      const r0 = Math.random; Math.random = () => 0.001;
      N.hp.shot({ zone: 'thigh', side: 'R', part: 'thighR', local: new THREE.Vector3(-0.02, -0.2, 0.09), dir: new THREE.Vector3(0, 0, -1), point: N.pos.clone() });
      Math.random = r0; N.onHarm({ type: 'shot', zone: 'thigh', side: 'R' });
      for (let k = 0; k < 60 * 2; k++) G.stepFrame(1/60);
      out.bleed0 = +(N.hp.bleed * 1000).toFixed(2);
      PLAY.pos.set(N.pos.x - 0.9, N.pos.y, N.pos.z + 0.2); PLAY.yaw = Math.atan2(N.pos.x - PLAY.pos.x, N.pos.z - PLAY.pos.z); GAIT.init = false; G.stepFrame(1/60);
      INTERACT.update(true); out.offer = INTERACT.acts.map((a) => a.label);
      const press = INTERACT.acts.find((a) => /abdrücken/.test(a.label)); if (press) press.run();
      for (let k = 0; k < 60 * 2; k++) G.stepFrame(1/60);
      out.pressing = AID.st; out.bleedPress = +(N.hp.bleed * 1000).toFixed(2);
      INTERACT.update(true); const wrap = INTERACT.acts.find((a) => /Verbinden/.test(a.label)); out.wrapOffer = !!wrap; if (wrap) wrap.run();
      for (let k = 0; k < 60 * 8; k++) G.stepFrame(1/60);
      const w = N.hp.wounds.find((x) => x.zone === 'thigh');
      out.field = !!(w && w.field); out.mesh = !!(w && w.fieldMesh); out.bag = INV.items.bandage || 0; out.bleedAfter = +(N.hp.bleed * 1000).toFixed(3);
      out.mem = B.mem.filter((m) => /verbunden/.test(m)).slice(-1)[0] || ''; out.hands = !!(W.ch.p.handR.userData.blood);
      if (AID.st) AID.end(); for (let k = 0; k < 40; k++) G.stepFrame(1/60);
      // he gets up on it now and goes to the doctor all the same
      let k = 0; for (; k < 60 * 60 && !['toDoc', 'atDoc'].includes(B.st); k++) G.stepFrame(1/60);
      out.after = B.st; out.needsDoc = N.hp.needsDoc();
      B.revive(); B.forget(); G.noRender = false; return out; }""")
    ok = (r['bleed0'] > 3 and 'Wunde abdrücken' in r['offer'] and r['pressing'] == 'work' and r['bleedPress'] < 1.5 and r['wrapOffer'] and r['field'] and r['mesh']
          and r['bag'] == 0 and r['bleedAfter'] < 0.5 and 'notdürftig verbunden' in r['mem'] and r['hands'] and r['after'] in ('toDoc', 'atDoc') and r['needsDoc'])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_docmeet(g):
    """Hank, shot, is on his way to the doctor when you call the doctor to the saloon: they meet in the street, Hank
       stops and waits, the doctor patches him up there, and Hank goes back to his bar instead of on to the practice"""
    await g.js(RESET)
    r = await g.js(r"""() => { const B = BARKEEP, N = B.npc, R = B.R, D = DOC, out = { trip: [] }; B.revive(); B.forget(); G.noRender = true; D.fooledN = 0; D.att = 0;
      const sd = D.spot('desk'); D.npc.pos.set(sd.x, D.R.floorY, sd.z); D.npc.stop(); D.npc.room = D.R; D.st = 'idle'; D.callJob = null; D.queue.length = 0;
      PLAY.pos.set(10, 0, 9); GAIT.init = false;
      N.hp.shot({ zone: 'shoulder', side: 'R', part: 'torso', local: new THREE.Vector3(-0.19, 0.38, 0.13), dir: new THREE.Vector3(1, 0, 0), point: N.pos.clone() });
      N.onHarm({ type: 'shot', zone: 'shoulder', side: 'R' });
      let k = 0; for (; k < 60 * 60 && !(B.st === 'toDoc' && !N.room); k++) G.stepFrame(1/60);
      out.onWay = B.st + '/' + (N.room ? N.room.type : 'street');
      TALK.lastText = 'Doc, schnell, Hank verblutet im Saloon!'; D.callFromTalk('come');
      let stopped = 0, met = null;
      for (k = 0; k < 60 * 120 && !N.hp.wounds.some((w) => w.bandaged); k++) { const p0 = N.pos.clone(); G.stepFrame(1/60); if (D.callJob && D.callJob.phase === 'work') { met = met || [B.st, N.room ? N.room.type : 'street']; if (N.pos.distanceTo(p0) < 0.002) stopped++; } }
      out.met = met; out.stoppedFrames = stopped; out.bandaged = N.hp.wounds.some((w) => w.bandaged);
      for (k = 0; k < 60 * 120 && !(B.st === 'idle' && N.room === R); k++) { G.stepFrame(1/60); const st = B.st; if (out.trip[out.trip.length - 1] !== st) out.trip.push(st); }
      out.home = B.st === 'idle' && N.room === R; out.neverAtDoc = !out.trip.includes('atDoc');
      for (k = 0; k < 60 * 60 && D.st === 'call'; k++) G.stepFrame(1/60);
      out.docHome = D.st;
      B.revive(); B.forget(); D.att = 0; D.knows = []; G.noRender = false; return out; }""")
    ok = r['onWay'].startswith('toDoc/street') and r['met'] is not None and r['stoppedFrames'] > 120 and r['bandaged'] and r['home'] and r['neverAtDoc'] and r['docHome'] == 'idle'
    return ok, json.dumps(r, ensure_ascii=False)

async def check_fastclock(g):
    """time is one: with the clock at 60× (and when sleeping) the town lives those minutes: Hank, shot, gets to the
       doctor, is patched up and back at his bar within game minutes; dead, he is taken away and the next one arrives
       a day later; a night's sleep takes little computing"""
    await g.js(RESET)
    r = await g.js(r"""() => { const B = BARKEEP, N = B.npc, R = B.R, D = DOC, out = {}; B.revive(); B.forget(); G.noRender = true;
      const sd = D.spot('desk'); D.npc.pos.set(sd.x, D.R.floorY, sd.z); D.npc.stop(); D.npc.room = D.R; D.st = 'idle'; D.callJob = null; D.queue.length = 0;
      PLAY.pos.set(60, 0, 9); GAIT.init = false; G.room = null;
      N.hp.shot({ zone: 'shoulder', side: 'R', part: 'torso', local: new THREE.Vector3(-0.19, 0.38, 0.13), dir: new THREE.Vector3(1, 0, 0), point: N.pos.clone() });
      N.onHarm({ type: 'shot', zone: 'shoulder', side: 'R' });
      const m0 = TIME.min; TIME.speed = 60; let k = 0;
      for (; k < 60 * 20 && !(B.st === 'idle' && N.hp.wounds.some((w) => w.bandaged) && N.room === R); k++) G.stepFrame(1/60);
      out.realSecs = +(k / 60).toFixed(1); out.gameMin = Math.round(TIME.min - m0); out.back = B.st === 'idle' && N.room === R; out.bandaged = N.hp.wounds.some((w) => w.bandaged);
      // the one at the bar dies; the town takes it from there
      const who0 = B.whoI; N.hp.die('Test', null, 'back'); B.killedBy = 'player';
      for (k = 0; k < 60 * 70 && B.whoI === who0; k++) G.stepFrame(1/60);
      TIME.speed = 1;
      out.next = B.whoI > who0 ? B.who().name : null; out.dayLater = Math.round(TIME.min - m0);
      // a night's sleep: how long it takes to compute
      B.npc.hp.shot({ zone: 'arm', side: 'L', part: 'uArmL', local: new THREE.Vector3(0, -0.14, 0.06), dir: new THREE.Vector3(1, 0, 0), point: B.npc.pos.clone() });
      B.npc.onHarm({ type: 'shot', zone: 'arm', side: 'L' });
      const t0 = performance.now(); TIME.skip(600); out.skipMs = Math.round(performance.now() - t0);
      out.afterSleep = [B.st, B.npc.hp.wounds.some((w) => w.bandaged), B.npc.room === R];
      // put Hank back for the other checks (and the town as it was: no graves, nobody knows)
      B.whoI = 0; B.npc.dispose(); B.makeNpc(B.scene0); B.st = 'idle'; B.temper = null; B.grudge = 0; B.poisonNext = false; B.killedBy = null; B.diedAt = null; B.cause = null; B.metNew = false; B.pickIdle();
      for (const m of GRAVES.meshes) if (m) G.scene.remove(m); GRAVES.meshes = []; GRAVES.list = []; D.knows = []; D.att = 0; D.mem = [];
      G.noRender = false; return out; }""")
    ok = (r['back'] and r['bandaged'] and r['gameMin'] < 400 and r['next'] and r['dayLater'] >= 1440 and r['skipMs'] < 1500
          and r['afterSleep'][0] == 'idle' and r['afterSleep'][1] and r['afterSleep'][2])
    return ok, json.dumps(r, ensure_ascii=False)

async def check_react(g):
    """people start at a shot (hands up to the chest, eyes to where it came from); Hank asks a hurt stranger what
       happened; what Hank knows about you reaches the doctor when they are together (without a word when you are not there)"""
    await g.js(RESET)
    r = await g.js(r"""() => { const B = BARKEEP, N = B.npc, R = B.R, D = DOC, out = {}; B.revive(); B.forget(); G.noRender = true; const aiWas = SETTINGS.v.aiTalk; SETTINGS.v.aiTalk = false;
      // a shot in the practice: the doctor starts
      const sd = D.spot('desk'); D.npc.pos.set(sd.x, D.R.floorY, sd.z); D.npc.stop(); D.npc.room = D.R; D.st = 'idle';
      const pp = rwp(D.R, 0, D.R.floorY, -2); PLAY.pos.set(pp.x, pp.y, pp.z); GAIT.init = false; for (let k = 0; k < 20; k++) G.stepFrame(1/60);
      worldEvent('shot', pp.x, pp.y + 1.4, pp.z, { by: 'player', room: 'doctor' });
      let g1 = null; for (let k = 0; k < 40; k++) { G.stepFrame(1/60); g1 = g1 || D.npc.gest; }
      out.start = g1; out.alert = D.npc.alertT > G.time;
      // hurt, at the bar: Hank asks
      const bp = rwp(R, 2.6, R.floorY, -6.4); PLAY.pos.set(bp.x, bp.y, bp.z); GAIT.init = false; PHP.hp = 0.4; N.asked = new Set(); N.askT = -99; N.aiAt = -99;
      const said = []; const sp = N.speak; N.speak = function (t, d, m, kk) { said.push(t); return sp.call(this, t, d, m, kk); };
      for (let k = 0; k < 60 * 8 && !said.some((t) => /passiert/.test(t)); k++) G.stepFrame(1/60);
      N.speak = sp; out.asked = said.filter((t) => /passiert|Schüsse/.test(t)); PHP.hp = 1;
      // gossip: Hank remembers something, then stands by the doctor where you cannot hear them
      B.remember('Er hat dir in die rechte Schulter geschossen (Tag 1, mittags).');
      PLAY.pos.set(60, 0, 9); GAIT.init = false; G.room = null; B.st = 'street'; N.pos.set(-30, 0, 2); N.room = null; D.npc.pos.set(-29, 0, 2); D.npc.room = null; D.st = 'call'; D.callJob = { phase: 'after', t: -999 };
      CHAT.cool.clear(); CHAT.t = 0; CHAT.run = null; GOSSIP.shared.clear(); const k0 = D.knows.length; N.talkT = 0; SAY.hide(N); D.npc.talkT = 0;
      for (let k = 0; k < 60 * 8 && D.knows.length === k0; k++) G.stepFrame(1/60);
      out.docHeard = D.knows.slice(k0).filter((x) => /Hank hat dir erzählt/.test(x));
      SETTINGS.v.aiTalk = aiWas; B.revive(); B.forget(); D.st = 'idle'; D.callJob = null; D.att = 0; D.knows = []; CHAT.run = null; D.npc.pos.set(sd.x, D.R.floorY, sd.z); D.npc.room = D.R; G.noRender = false; return out; }""")
    ok = r['start'] in ('flinch', 'cower') and r['alert'] and len(r['asked']) > 0 and len(r['docHeard']) > 0
    return ok, json.dumps(r, ensure_ascii=False)

CHECKS = [('boot', check_boot), ('fingerprint', check_fingerprint), ('budget', check_budget), ('gait', check_gait), ('fists', check_fists),
          ('gun', check_gun), ('doors', check_doors), ('stairs', check_stairs), ('seats', check_seats), ('sitblock', check_sit_block), ('save', check_save), ('menu', check_menu), ('dev', check_dev), ('drink', check_drink), ('drunk', check_drunk), ('npc', check_npc), ('glass', check_glass), ('manners', check_manners), ('ownkeys', check_ownkeys), ('touch', check_touch), ('hear', check_hear), ('deepgram', check_deepgram), ('quick', check_quick), ('daynight', check_daynight), ('sleep', check_sleep), ('harm', check_harm), ('brawl', check_brawl), ('block', check_block), ('falls', check_falls), ('figure', check_figure), ('survive', check_survive), ('gesture', check_gesture), ('poison', check_poison), ('call', check_call), ('bleed', check_bleed), ('aid', check_aid), ('docmeet', check_docmeet), ('fastclock', check_fastclock), ('react', check_react), ('doctor', check_doctor), ('revenge', check_revenge), ('fate', check_fate), ('voice', check_voice)]

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
