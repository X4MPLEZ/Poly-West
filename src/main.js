/* ---------- boot, measurement, main loop ---------- */
(function () {
  const app = document.getElementById('app');
  const canvas = document.getElementById('gl');
  const bootMsg = document.getElementById('bootMsg');
  G.time = 0;
  G.frameNo = 0;

  function layout() {
    const r = G.renderer;
    const cssW = Math.max(1, app.clientWidth), cssH = Math.max(1, app.clientHeight), dpr = window.devicePixelRatio || 1;
    // quality: high renders above the screen's resolution for crisp edges, low below it for weak phones
    const q = SETTINGS.v.quality;
    r.setPixelRatio(q === 'low' ? Math.min(dpr, 1) * 0.75 : q === 'mid' ? clamp(dpr, 1, 1.5) : clamp(dpr, 1.5, 2));
    r.setSize(cssW, cssH, true);
    const aspect = cssW / cssH;
    G.cam.aspect = aspect;
    G.cam.fov = G.baseFov = clamp(2 * Math.atan(Math.tan(35 * DEG) / aspect) / DEG, 50, 78);
    G.cam.updateProjectionMatrix();
  }

  /* Waiting for a 1-pixel readback forces the browser to finish every queued GPU command.
     Timing between two such waits gives the true cost of a frame, not the display-capped frame rate. */
  const PX = new Uint8Array(4);
  function syncGPU() {
    const gl = G.renderer.getContext();
    G.renderer.setRenderTarget(null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PX);
  }

  function toggleHud() {
    const off = app.classList.toggle('nohud');
    const b = document.getElementById('hudBtn');
    b.setAttribute('aria-pressed', off ? 'true' : 'false');
    b.setAttribute('aria-label', off ? 'Anzeige einblenden' : 'Anzeige ausblenden');
  }
  function onAction(type) {
    if (type === 'hud') toggleHud();
    else if (type === 'slow') HUD.setSlow(!G.slow);
    else if (type === 'sound') HUD.setSound(!SFX.on);
    else HUD.firstInput(type);
  }

  let last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    const frameMs = Math.max(0.1, ts - last);
    last = ts;
    if (G.manual || MENU.open) return;
    if (SLEEP.frozen()) { pollGamepad(onAction); SLEEP.update(Math.min(frameMs / 1000, 0.1)); return; }   // the world waits while the wheel is up
    frame(Math.min(frameMs / 1000, 0.1) * (G.slow ? 0.25 : 1) * (G.timeScale || 1) * (WHEEL.open ? 0.3 : 1), frameMs, ts);
  }
  G.stepFrame = (dt) => frame(dt, dt * 1000, performance.now());
  function frame(dt, frameMs, ts) {
    // hit-stop: a landed punch freezes the world for a few frames
    if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.04; }
    // a knockdown: half a second of slow motion (counted in real time)
    if (G.slowT > 0) { G.slowT -= dt; dt *= 0.3; }
    G.time += dt;
    G.frameNo++;
    TIME.update(dt);
    SLEEP.update(Math.min(frameMs / 1000, 0.1));
    pollGamepad(onAction);
    GUN.update(dt);
    FIST.update(dt);
    DEV.update(dt);
    DRUNK.update(dt);
    FALL.update(dt);
    PHP.update(dt);
    POST.update(dt);
    DRINK.update(dt);
    updatePlayer(dt);
    GLASS.update(dt);
    updateRooms(dt);
    INTERACT.update();
    updateCamera(dt);
    if (G.camHook) G.camHook();
    updateWorld(dt, G.time);
    updateCharacterVisual();
    NPCS.update(dt);
    DRINK.late();
    GUN.late(dt);
    AMB.update(dt);
    SAVE.update(dt);
    DAYNIGHT.update(dt);
    HUD.tick(Math.min(frameMs / 1000, 0.1));
    W.dome.position.copy(G.cam.position);
    if (G.noRender) return; // tests: simulate without drawing
    G.renderer.info.reset();
    POST.render(G.renderer, G.scene, G.cam);
    G.drawInfo = { calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
    HUD.frame(frameMs, null, 0, 0, ts);
  }

  async function boot() {
    // the small microphone window (see ui/micwin.js): no game in it
    if (location.hash === '#mic') { document.getElementById('boot').classList.add('gone'); MICWIN.run(); return; }
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([document.fonts.load('22px "Rye"'), document.fonts.load('600 20px "IBM Plex Mono"'), document.fonts.load('600 14px "Barlow Semi Condensed"')]),
          new Promise((r) => setTimeout(r, 1800))
        ]);
      }
    } catch (e) { /* fonts are optional */ }
    await new Promise((r) => requestAnimationFrame(() => r()));
    try {
      initGraphics(canvas, buildAtlas('"Rye", Georgia, serif'));
    } catch (e) {
      bootMsg.textContent = 'WebGL ist auf diesem Gerät nicht verfügbar';
      return;
    }
    assembleScene();
    applyLight('lowpoly');
    G.cam = new THREE.PerspectiveCamera(60, 1, 0.3, 1600);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); bootMsg.textContent = 'Grafik neu laden: Seite aktualisieren'; document.getElementById('boot').classList.remove('gone'); });
    SFX.init();
    initInput(app, canvas, onAction);
    HUD.init(toggleHud);
    initGunPad(onAction);
    INTERACT.init();
    SLEEP.init();
    REST.init();
    PHP.init();
    NPCS.init(G.scene);
    HARM.init();
    SAVE.init();
    DAYNIGHT.init();
    MENU.init();
    SHOP.init();
    WHEEL.init();
    MICWIN.init();
    POST.init();
    DEV.init();
    G.layout = layout;
    SETTINGS.on('quality', () => layout());
    updatePlayer(0.016);
    G.lookAt = null; updateCamera(1);
    layout();
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
    document.getElementById('boot').classList.add('gone');
    requestAnimationFrame(loop);
  }
  boot();
})();
