const INPUT = { keys: new Set(), joy: null, look: null, stickX: 0, stickY: 0, padRun: false, padLookX: 0, padLookY: 0, padPrev: [] };

function initInput(app, canvas, onAction) {
  const joyEl = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  const R = 52;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    const rect = app.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const touchLike = e.pointerType !== 'mouse';
    if (touchLike && !app.classList.contains('touch')) { app.classList.add('touch'); GUN.touch = true; }
    if (touchLike && !INPUT.joy && x < rect.width * 0.5) {
      INPUT.joy = { id: e.pointerId, ox: x, oy: y };
      joyEl.hidden = false; joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; knob.style.transform = 'translate(0px, 0px)';
      onAction('move');
    } else if (!INPUT.look) {
      INPUT.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      onAction('look');
    } else return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (INPUT.joy && e.pointerId === INPUT.joy.id) {
      const rect = app.getBoundingClientRect();
      let dx = e.clientX - rect.left - INPUT.joy.ox, dy = e.clientY - rect.top - INPUT.joy.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      INPUT.stickX = dx / R; INPUT.stickY = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (INPUT.look && e.pointerId === INPUT.look.id) {
      const dx = e.clientX - INPUT.look.x, dy = e.clientY - INPUT.look.y;
      INPUT.look.x = e.clientX; INPUT.look.y = e.clientY;
      lookBy(dx, dy, e.pointerType !== 'mouse');
    }
  });
  const end = (e) => {
    if (INPUT.joy && e.pointerId === INPUT.joy.id) { INPUT.joy = null; INPUT.stickX = INPUT.stickY = 0; joyEl.hidden = true; }
    if (INPUT.look && e.pointerId === INPUT.look.id) INPUT.look = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  // mouse: right button aims (pointer lock if the page allows it), left button fires
  canvas.addEventListener('mousedown', (e) => {
    if (SIT.busy() || DEV.fly || MENU.open || SHOP.open || WHEEL.open || DRINK.busy() || DRUNK.blocked()) return;
    if (e.button === 2) {
      GUN.setAim(true); onAction('aim');
      try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed here */ }
    } else if (e.button === 0) { if (GUN.state === 'holster') FIST.down(true); else GUN.pressFire(); onAction('fire'); }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) FIST.up();
    if (e.button === 2) { GUN.setAim(false); try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (err) { /* ignore */ } }
  });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) lookBy(e.movementX, e.movementY, false); });
  canvas.addEventListener('wheel', (e) => { SETTINGS.set('camDist', +clamp(PLAY.camDist * Math.exp(e.deltaY * 0.0012), 3.2, 12).toFixed(1)); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (SHOP.open) { if (SHOP.key(k)) e.preventDefault(); return; }
    if (k === 'Escape' || k === 'p') { MENU.toggle(); return; }
    if (DRUNK.blocked() && k !== 'F2') return;
    if (k === 'F2') { e.preventDefault(); DEV.toggle(); return; }
    if (MENU.open) return;
    if (k === 'Tab') { e.preventDefault(); if (!e.repeat) WHEEL.show(); return; }
    if (WHEEL.open) { const n = parseInt(k, 10); if (n >= 1 && n <= WHEEL.N) { WHEEL.sel = n - 1; WHEEL.use(); } if (k === 'Escape') WHEEL.close(); return; }
    if (DEV.fly && (k === 'q' || k === 'r' || k === 'f' || k === 'e')) return;
    if (k === 'm') { onAction('sound'); return; }
    if (k === 'h') { onAction('hud'); return; }
    if (k === 't') { onAction('slow'); return; }
    if (k === 'e' && !e.repeat) { INTERACT.use(0); onAction('use'); return; }
    if (k === 'r' && !e.repeat && INTERACT.use(1)) { onAction('use'); return; }   // R is the second action when one is offered
    if (k === 't' && !e.repeat) { if (INV.has('bottle')) DRINK.start('bottle'); else TOAST.show('Du hast keine Flasche dabei.'); return; }
    if ((SIT.busy() || DRINK.busy()) && (k === 'q' || k === 'r' || k === 'f')) return;
    if (k === 'q' && !e.repeat) { GUN.toggleHolster(); onAction('gun'); return; }
    if (k === 'r' && !e.repeat) { GUN.pressReload(); onAction('gun'); return; }
    if (k === 'f' && !e.repeat) { if (GUN.state === 'holster') FIST.down(false); else GUN.pressFire(); onAction('fire'); return; }
    if (k === '+' || k === '=') SETTINGS.set('camDist', +clamp(PLAY.camDist * 0.85, 3.2, 12).toFixed(1));
    if (k === '-') SETTINGS.set('camDist', +clamp(PLAY.camDist / 0.85, 3.2, 12).toFixed(1));
    if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', ' ', 'x'].includes(k)) {
      if (k === ' ') e.preventDefault();
      INPUT.keys.add(k);
      if (k !== 'Shift') onAction('move');
      if (k.startsWith('Arrow')) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; INPUT.keys.delete(k);
    if (k === 'Tab' && WHEEL.open) { if (WHEEL.sel >= 0) WHEEL.use(); else WHEEL.close(); } if (k === 'f') FIST.up(); if (k === 'Shift') INPUT.keys.delete('Shift'); });
  window.addEventListener('blur', () => { INPUT.keys.clear(); });
}

/* camera / aim from a drag or mouse movement in pixels */
function lookBy(dx, dy, touch) {
  const sens = (touch ? SETTINGS.v.sensTouch : SETTINGS.v.sensMouse) / 100;
  dx *= sens; dy *= sens * (SETTINGS.v.invertY ? -1 : 1);
  if (DEV.fly) { DEV.look(dx, dy, touch); return; }
  if (!touch) FIST.look(dx, dy);
  if (GUN.camW > 0.3) {
    const k = touch ? 0.0042 : 0.0026;
    PLAY.camYaw -= dx * k;
    PLAY.aimPitch = clamp(PLAY.aimPitch + dy * k * 0.8, -0.75, 0.9);
  } else {
    PLAY.camYaw -= dx * 0.0065;
    PLAY.camPitch = clamp(PLAY.camPitch + dy * 0.0045, 0.04, 1.15);
  }
}

function pollGamepad(onAction) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && Array.from(pads).find((g) => g && g.connected);
  INPUT.padX = INPUT.padY = 0; INPUT.padRun = false; INPUT.padLookX = INPUT.padLookY = 0;
  if (!p) return;
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
  INPUT.padX = dz(p.axes[0] || 0); INPUT.padY = dz(p.axes[1] || 0);
  INPUT.padLookX = dz(p.axes[2] || 0); INPUT.padLookY = dz(p.axes[3] || 0);
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
  INPUT.padRun = b(0) || b(10);
  const prev = INPUT.padPrev;
  if (b(5) && !prev[5]) onAction('slow');
  if (b(9) && !prev[9]) MENU.toggle();
  // d-pad up held: the quick wheel, the right stick points, letting go uses
  if (b(12) && !prev[12]) WHEEL.show();
  if (!b(12) && prev[12] && WHEEL.open) { if (WHEEL.sel >= 0) WHEEL.use(); else WHEEL.close(); }
  if (WHEEL.open) { WHEEL.pad(INPUT.padLookX, INPUT.padLookY); INPUT.padLookX = INPUT.padLookY = 0; INPUT.padPrev = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(b); return; }
  if (MENU.open) { INPUT.padPrev = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(b); return; }
  if (b(8) && !prev[8]) onAction('sound');
  if (b(3) && !prev[3]) INTERACT.use(0);
  if (b(1) && !prev[1]) INTERACT.use(1);
  if (SIT.busy()) { INPUT.padPrev = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(b); if (INPUT.padX || INPUT.padY) onAction('move'); return; }
  if (b(6) !== !!prev[6]) GUN.setAim(b(6));
  if (b(7) && !prev[7]) { if (GUN.state === 'holster') FIST.down(false); else GUN.pressFire(); }
  if (!b(7) && prev[7]) FIST.up();
  if (b(2) && !prev[2]) GUN.pressReload();
  if (b(4) && !prev[4]) GUN.toggleHolster();
  INPUT.padPrev = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(b);
  if (GUN.camW > 0.3) { PLAY.camYaw -= INPUT.padLookX * 0.05; PLAY.aimPitch = clamp(PLAY.aimPitch + INPUT.padLookY * 0.03, -0.75, 0.9); INPUT.padLookX = INPUT.padLookY = 0; }
  if (INPUT.padX || INPUT.padY) onAction('move');
}
