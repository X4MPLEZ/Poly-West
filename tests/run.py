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
BUDGET = {'street': {'calls': 60, 'tris': 260000}, 'saloon': {'calls': 60, 'tris': 260000}}

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
  const r = (v) => Math.round(v * 100) / 100, meshes = [];
  const sig = (o) => { const a = o.geometry.attributes, P = a.position.array; let s = 0, c = 0;
    for (let i = 0; i < P.length; i++) s += P[i] * ((i % 7) + 1);
    if (a.color) { const C = a.color.array; for (let i = 0; i < C.length; i++) c += C[i] * ((i % 5) + 1); }
    o.updateMatrixWorld(); const e = o.matrixWorld.elements;
    return [P.length / 3, r(s), r(c), r(e[12]), r(e[13]), r(e[14])].join(':'); };
  for (const o of W.worldMeshes.concat(ROOMS.map((R) => R.mesh))) meshes.push(sig(o));
  for (const D of DOORS) for (const m of D.meshes) meshes.push('door:' + sig(m).split(':').slice(0, 3).join(':'));
  meshes.sort();
  const sum = (L, f) => r(L.reduce((t, x) => t + f(x), 0));
  return { meshes: meshes.length, meshHash: meshes.join('|').split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7),
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
    return r['drawn'] == 'drawn' and r['empty'] == 0 and r['after'][0] == 6 and r['end'] == 'holster', json.dumps(r)

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
        INTERACT.use(); t = 0; while (SIT.state !== 'none' && t < 3) { G.stepFrame(1/30); t += 1/30; }
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

CHECKS = [('boot', check_boot), ('fingerprint', check_fingerprint), ('budget', check_budget), ('gait', check_gait), ('fists', check_fists),
          ('gun', check_gun), ('doors', check_doors), ('stairs', check_stairs), ('seats', check_seats), ('sitblock', check_sit_block), ('save', check_save)]

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
