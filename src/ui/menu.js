/* ---------- pause menu: the game stops, three tabs (game, settings, controls) ----------
   Opened with Esc / P, the menu button top right, or Start on a gamepad. The settings controls are built from
   SETTINGS.SPEC, so a new setting only needs a line there. */
const MENU = {
  open: false, tab: 'game', armed: 0,
  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('menu');
    $('menuBtn').addEventListener('click', () => this.toggle());
    $('mClose').addEventListener('click', () => this.close());
    $('mResume').addEventListener('click', () => { this.close(); if (INPUT.lock) INPUT.lock(); });   // (the click catches the mouse again)
    $('mSave').addEventListener('click', () => { const ok = SAVE.write(); this.note(ok ? 'Gespeichert.' : 'Speichern ist in diesem Browser nicht möglich.'); });
    $('mNew').addEventListener('click', () => {
      // two taps, so that nobody loses the game by accident
      if (G.time - this.armed < 4 && this.armedNew) { SAVE.clear(); SAVE.write = () => true; location.reload(); return; }
      this.armedNew = true; this.armed = G.time; $('mNew').textContent = 'Wirklich neu anfangen? Nochmal tippen';
      setTimeout(() => { this.armedNew = false; $('mNew').textContent = 'Neues Spiel'; }, 4000);
    });
    $('mDev').addEventListener('click', () => { this.close(); DEV.toggle(true); });
    $('mReset').addEventListener('click', () => { SETTINGS.reset(); this.buildSettings(); });
    for (const b of this.el.querySelectorAll('[data-tab]')) b.addEventListener('click', () => this.show(b.dataset.tab));
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    this.buildSettings();
    SETTINGS.on('dev', (on) => { $('mDev').hidden = !on; });
    SETTINGS.on('showFps', (on) => { $('fpsBox').hidden = !on; });
    // leaving the tab pauses the game
    document.addEventListener('visibilitychange', () => { if (document.hidden && !G.manual) this.show('game', true); });
  },
  toggle() { if (this.open) this.close(); else this.show('game', true); },
  show(tab, openIt) {
    if (openIt && !this.open) {
      this.open = true; this.el.hidden = false;
      INPUT.keys.clear(); FIST.up(); GUN.setAim(false);
      try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* ignore */ }
      if (SFX.ctx && SFX.ctx.state === 'running') SFX.ctx.suspend();
      this.note('');
      document.getElementById('app').classList.add('paused');
    }
    this.tab = tab;
    if (tab === 'bag') this.buildBag();
    for (const b of this.el.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
    for (const p of this.el.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== tab;
    const first = this.el.querySelector(`[data-pane="${tab}"] button, [data-pane="${tab}"] input`);
    if (first && openIt) first.focus({ preventScroll: true });
  },
  close() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true;
    document.getElementById('app').classList.remove('paused');
    if (SFX.ctx && SFX.ctx.state === 'suspended' && SFX.on) SFX.ctx.resume();
    document.getElementById('gl').focus({ preventScroll: true });
  },
  buildBag() {
    document.getElementById('mMoney').textContent = money(INV.money);
    const box = document.getElementById('mBag'); box.textContent = '';
    const ids = Object.keys(INV.items);
    if (!ids.length) { const p = document.createElement('p'); p.className = 'mSmall'; p.textContent = 'Die Tasche ist leer. Im Saloon gibt es was zu trinken.'; box.appendChild(p); return; }
    for (const id of ids) {
      const it = ITEMS[id], row = document.createElement('div'); row.className = 'mItem';
      const name = document.createElement('span'); name.textContent = (INV.items[id] > 1 ? INV.items[id] + '× ' : '') + it.name;
      if (it.kind === 'carry') { const sm = document.createElement('small'); sm.textContent = ' ' + (INV.sips[id] ?? it.sips) + ' Schlucke übrig'; name.appendChild(sm); }
      row.appendChild(name);
      if (it.kind === 'carry') { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Trinken'; b.addEventListener('click', () => { this.close(); DRINK.start(id); }); row.appendChild(b); }
      box.appendChild(row);
    }
  },
  note(t) { document.getElementById('mNote').textContent = t; },
  buildSettings() {
    const box = document.getElementById('mSettings');
    box.textContent = '';
    for (const s of SETTINGS.SPEC) {
      if (s.own && !DIRECT.ownPage()) continue;   // own keys: only on the game's own page
      if (s.group) { const h = document.createElement('h3'); h.textContent = s.group; box.appendChild(h); continue; }
      const row = document.createElement('div'); row.className = 'mRow';
      const id = 'set_' + (s.key || s.label.replace(/\W+/g, '_')), lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = s.label; row.appendChild(lab);
      const v = SETTINGS.v[s.key];
      if (s.type === 'range') {
        const inp = document.createElement('input'); inp.type = 'range'; inp.id = id; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = v;
        const out = document.createElement('output'); out.htmlFor = id;
        const fmt = (x) => (s.step < 1 ? (+x).toFixed(1) : String(Math.round(x))) + (s.unit || '');
        out.textContent = fmt(v);
        inp.addEventListener('input', () => { out.textContent = fmt(inp.value); SETTINGS.set(s.key, +inp.value); });
        row.append(inp, out);
      } else if (s.type === 'toggle') {
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = id; inp.checked = v; inp.className = 'mSwitch';
        inp.addEventListener('change', () => SETTINGS.set(s.key, inp.checked));
        row.appendChild(inp);
      } else if (s.type === 'action') {
        // a button that runs something and shows its answer next to it
        const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = s.button; b.className = 'mAct';
        const out = document.createElement('output'); out.className = 'mActOut';
        b.addEventListener('click', () => { out.textContent = '…'; Promise.resolve(s.run()).then((t) => { out.textContent = t || ''; }); });
        row.append(b, out);
      } else if (s.type === 'voices') {
        /* Hank's voice: the voices of the ElevenLabs account (listen with a sentence of his, take one), or German
           voices from ElevenLabs' library (spoken by Germans; listen to their sample, add one to the account) */
        const mk = (txt, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.className = cls || 'mAct'; return b; };
        const bMine = mk('Meine Stimmen'), bDe = mk('Deutsche Stimmen suchen'); bMine.id = id;
        const box = document.createElement('div'); box.className = 'mVoices';
        const field = () => document.getElementById('set_elevenVoice');
        const info = (L) => [L.gender === 'male' ? 'Mann' : L.gender === 'female' ? 'Frau' : L.gender, L.age, L.accent, L.descriptive || (L.description || '').slice(0, 80), L.use_case].filter(Boolean).join(' · ');
        const row2 = (name, sub, on, btns) => {
          const it = document.createElement('div'); it.className = 'mVoice' + (on ? ' on' : '');
          const t = document.createElement('div'); t.className = 'mVoiceT';
          const nm = document.createElement('b'); nm.textContent = (on ? '✓ ' : '') + name; t.appendChild(nm);
          const sm = document.createElement('small'); sm.textContent = sub; t.appendChild(sm);
          it.append(t, ...btns); box.appendChild(it);
        };
        const help = (txt) => { const p = document.createElement('p'); p.className = 'mVoiceHelp'; p.textContent = txt; box.appendChild(p); };
        const drawMine = (list) => {
          box.textContent = '';
          const cur = (SETTINGS.v.elevenVoice || '').trim();
          for (const v of list) {
            const play = mk('▶', 'mAct mVoiceB'); play.title = 'Anhören'; play.addEventListener('click', () => DIRECT.tryVoice(v.voice_id));
            const take = mk(v.voice_id === cur ? 'Gewählt' : 'Nehmen', 'mAct mVoiceB');
            take.addEventListener('click', () => { DIRECT.takeVoice(v.voice_id); if (field()) field().value = v.voice_id; drawMine(list); });
            row2(v.name, info(v.labels || {}) + (v.category && v.category !== 'premade' ? ' · eigene' : ' · Standard (englisch)'), v.voice_id === cur, [play, take]);
          }
          help('Die Standard-Stimmen sind englische Sprecher und sprechen Deutsch mit Akzent. Echte deutsche Stimmen: „Deutsche Stimmen suchen“.');
        };
        let audio = null;
        const drawDe = (list) => {
          box.textContent = '';
          if (!list.length) help('Keine gefunden.');
          for (const v of list) {
            const play = mk('▶', 'mAct mVoiceB'); play.title = 'Hörprobe';
            play.addEventListener('click', () => { try { if (audio) audio.pause(); audio = new Audio(v.preview_url); audio.play(); } catch (e) { /* no sample */ } });
            const add = mk('Hinzufügen', 'mAct mVoiceB');
            add.addEventListener('click', () => {
              add.textContent = '…';
              DIRECT.addVoice(v).then((nid) => { if (field()) field().value = nid; add.textContent = 'Gewählt'; TOAST.show('Hank spricht jetzt mit „' + v.name + '“.'); },
                (e) => { add.textContent = 'Hinzufügen'; help(e.message || 'Fehler'); });
            });
            row2(v.name, info(v) + (v.language ? ' · ' + v.language : ''), false, [play, add]);
          }
          help('▶ spielt die Hörprobe des Sprechers. „Hinzufügen“ legt die Stimme in deinem ElevenLabs-Konto ab und gibt sie Hank (dafür braucht der Schlüssel „Stimmen: Schreiben“; sonst auf elevenlabs.io in der Voice Library „Add to my voices“ und hier „Meine Stimmen“).');
        };
        const need = () => { if ((SETTINGS.v.elevenKey || '').trim()) return true; box.textContent = 'Erst oben den ElevenLabs-Schlüssel eintragen.'; return false; };
        bMine.addEventListener('click', () => { if (!need()) return; box.textContent = 'lädt …'; DIRECT.listVoices().then(drawMine, (e) => { box.textContent = e.message || 'Fehler'; }); });
        bDe.addEventListener('click', () => { if (!need()) return; box.textContent = 'sucht …'; DIRECT.germanVoices('male').then(drawDe, (e) => { box.textContent = e.message || 'Fehler'; }); });
        const btns = document.createElement('div'); btns.className = 'mVoiceBtns'; btns.append(bMine, bDe);
        row.classList.add('mRowText'); row.append(btns, box);
      } else if (s.type === 'secret' || s.type === 'text') {
        // a key or an id: typed or pasted; kept on change (trimmed); the game's keys do nothing while typing here
        const inp = document.createElement('input'); inp.type = s.type === 'secret' ? 'password' : 'text'; inp.id = id; inp.value = v || ''; inp.className = 'mText';
        inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = s.type === 'secret' ? 'einfügen …' : 'optional';
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
        inp.addEventListener('change', () => SETTINGS.set(s.key, inp.value.trim()));
        row.classList.add('mRowText'); row.appendChild(inp);
      } else if (s.type === 'choice') {
        const grp = document.createElement('div'); grp.className = 'mSeg'; grp.setAttribute('role', 'radiogroup'); grp.setAttribute('aria-label', s.label);
        for (const [val, text] of s.options) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', val === v ? 'true' : 'false');
          b.addEventListener('click', () => { SETTINGS.set(s.key, val); for (const o of grp.children) o.setAttribute('aria-checked', o === b ? 'true' : 'false'); });
          grp.appendChild(b);
        }
        row.appendChild(grp);
      }
      box.appendChild(row);
    }
  }
};
