/* ---------- settings: what the player can adjust, kept in this browser ----------
   SETTINGS.v holds the values; SETTINGS.set(key, value) stores them and calls the appliers that systems register
   with SETTINGS.on(key, fn). The menu builds its controls from SETTINGS.SPEC. */
const SETTINGS = {
  KEY: 'polywest.settings',
  SPEC: [
    { group: 'Ton' },
    { key: 'volume', label: 'Lautstärke', type: 'range', min: 0, max: 100, step: 1, def: 30, unit: '%' },
    { key: 'ambient', label: 'Umgebung', type: 'range', min: 0, max: 100, step: 1, def: 100, unit: '%' },
    { group: 'Steuerung' },
    { key: 'sensMouse', label: 'Maus-Empfindlichkeit', type: 'range', min: 25, max: 250, step: 5, def: 100, unit: '%' },
    { key: 'sensTouch', label: 'Touch-Empfindlichkeit', type: 'range', min: 25, max: 250, step: 5, def: 100, unit: '%' },
    { key: 'invertY', label: 'Y-Achse umkehren', type: 'toggle', def: false },
    { group: 'Grafik' },
    { key: 'quality', label: 'Bildqualität', type: 'choice', def: 'high', options: [['low', 'Niedrig'], ['mid', 'Mittel'], ['high', 'Hoch']] },
    { key: 'camDist', label: 'Kamera-Abstand', type: 'range', min: 3.2, max: 12, step: 0.1, def: 7.5, unit: ' m' },
    { key: 'blood', label: 'Blut', type: 'choice', def: 'normal', options: [['off', 'Aus'], ['normal', 'Normal'], ['more', 'Stark']] },
    { key: 'showFps', label: 'Bildrate anzeigen', type: 'toggle', def: true },
    { group: 'Gespräche' },
    { key: 'aiTalk', label: 'KI-Gespräche (Claude)', type: 'toggle', def: true },
    { key: 'aiSave', label: 'KI sparen (Bestellen, Grüßen, Danke ohne KI)', type: 'toggle', def: true },
    { key: 'voice', label: 'Antworten vorlesen', type: 'toggle', def: true },
    { key: 'voiceHQ', label: 'Echte Stimmen (lädt einmal ca. 45 MB)', type: 'toggle', def: true },
    { key: 'voiceVol', label: 'Lautstärke der Stimmen', type: 'range', min: 0, max: 150, step: 5, def: 100, unit: '%' },
    { label: 'Stimme testen', type: 'action', button: 'Abspielen', run: () => VOICE.test() },
    { label: 'Erinnerungen zurücksetzen (alle Figuren vergessen dich)', type: 'action', button: 'Zurücksetzen', run: () => TALK.resetMemories() },
    // only on the game's own page (not in claude.ai): keys stay in this browser
    { group: 'Eigene Schlüssel', own: true },
    { key: 'claudeKey', label: 'KI-Schlüssel: Claude, Groq oder OpenAI (wird am Anfang erkannt)', type: 'secret', def: '', own: true },
    { key: 'aiModel', label: 'KI-Modell (leer = passendes wird genommen)', type: 'text', def: '', own: true },
    { key: 'elevenKey', label: 'ElevenLabs-Schlüssel (elevenlabs.io)', type: 'secret', def: '', own: true },
    { key: 'deepgramKey', label: 'Deepgram-Schlüssel (deepgram.com, nur Zuhören)', type: 'secret', def: '', own: true },
    { key: 'sttMode', label: 'Spracheingabe', type: 'choice', def: 'auto', own: true, options: [['auto', 'Automatisch'], ['eleven', 'ElevenLabs'], ['deepgram', 'Deepgram'], ['browser', 'Browser'], ['type', 'Tippen / Diktier-App']] },
    { key: 'voiceModel', label: 'ElevenLabs-Stimme', type: 'choice', def: 'flash', own: true, options: [['flash', 'Schnell'], ['v3', 'Ausdrucksstark (v3)']] },
    { label: 'Hanks Stimme aussuchen', type: 'voices', own: true },
    { key: 'elevenVoice', label: 'Hanks Stimme: Voice-ID (leer = passende wird gesucht)', type: 'text', def: '', own: true },
    { label: 'Schlüssel prüfen', type: 'action', button: 'Prüfen', run: () => DIRECT.test(), own: true },
    { group: 'Entwicklung' },
    { key: 'dev', label: 'Entwickler-Werkzeuge (F2 oder Knopf oben rechts)', type: 'toggle', def: false }
  ],
  v: {}, fns: {},
  load() {
    for (const s of this.SPEC) if (s.key) this.v[s.key] = s.def;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { /* none */ }
    // the old volume from before the settings existed
    if (!saved) { try { const old = parseInt(localStorage.getItem('dustcreek-volume'), 10); if (old >= 0 && old <= 100) this.v.volume = old; } catch (e) { /* none */ } }
    if (saved && typeof saved === 'object') for (const s of this.SPEC) if (s.key && s.key in saved && typeof saved[s.key] === typeof s.def) this.v[s.key] = saved[s.key];
  },
  on(key, fn) { (this.fns[key] = this.fns[key] || []).push(fn); fn(this.v[key]); },
  set(key, value) {
    this.v[key] = value;
    try { localStorage.setItem(this.KEY, JSON.stringify(this.v)); } catch (e) { /* not kept */ }
    for (const fn of this.fns[key] || []) fn(value);
  },
  reset() { for (const s of this.SPEC) if (s.key) this.set(s.key, s.def); }
};
SETTINGS.load();
