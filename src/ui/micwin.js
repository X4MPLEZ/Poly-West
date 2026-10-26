/* ---------- the microphone window ----------
   claude.ai shows the artifact inside a frame that is not allowed to use the microphone. A window the game opens
   itself (the same page with #mic) is a page of its own, outside that frame, where the browser asks for the
   microphone the normal way. That small window listens all the time (speech recognition, German) and passes
   what it hears to the game (postMessage to the window that opened it). The game decides what to use: while you
   are talking with someone, and not while they are speaking (so they never answer themselves).
   Game side: MICWIN.open() (from a click), connected(); the window side: MICWIN.run() instead of the game. */
const MICWIN = {
  win: null, ok: false,
  init() { window.addEventListener('message', (e) => this.onMsg(e)); },
  open() {
    if (this.connected()) { try { this.win.focus(); } catch (e) { /* ignore */ } return true; }
    try { this.win = window.open(location.href.split('#')[0] + '#mic', 'polywest-mic', 'popup,width=400,height=320'); } catch (e) { this.win = null; }
    if (!this.win) { TOAST.show('Das Fenster wurde blockiert: Pop-ups für diese Seite erlauben und nochmal.', 'long'); return false; }
    TOAST.show('Im neuen Fenster „Mikrofon einschalten“ drücken.', 'long');
    return true;
  },
  connected() { return this.ok && !!this.win && !this.win.closed; },
  onMsg(e) {
    const d = e.data;
    if (!d || typeof d !== 'object' || typeof d.pw !== 'string') return;
    if (this.win && e.source && e.source !== this.win) return;
    if (d.pw === 'mic-ready') { if (e.source) this.win = e.source; this.ok = true; TOAST.show('Mikrofon verbunden. Bei Hank: V drücken und einfach sprechen.', 'long'); TALK.micLinked(); }
    else if (d.pw === 'mic-closed') { this.ok = false; TALK.micLinked(); }
    else if (d.pw === 'heard') TALK.remoteHeard(String(d.text || '').slice(0, 300), !!d.final);
    else if (d.pw === 'mic-error') TALK.remoteError(String(d.error || ''));
  },
  /* ---- inside the small window ---- */
  run() {
    document.title = 'Poly West – Mikrofon';
    document.body.innerHTML = '<main id="mw"><h1>Mikrofon für Poly West</h1><button id="mwGo" type="button">Mikrofon einschalten</button>' +
      '<p id="mwSt"></p><p id="mwHeard"></p></main>';
    const st = document.createElement('style');
    st.textContent = 'body{margin:0;background:#110b07;color:#f3e8d6;font:16px "Barlow Semi Condensed",system-ui,sans-serif}#mw{padding:18px}' +
      'h1{font:400 20px Rye,Georgia,serif;color:#e7a640;margin:0 0 12px}button{font:700 16px inherit;padding:12px 18px;border-radius:12px;border:2px solid #e7a640;background:rgba(231,166,64,.2);color:#f3e8d6}' +
      'button[data-on]{background:#ff7a66;border-color:#ff7a66;color:#1b120b}#mwSt{color:#bba88c;font-size:14px;line-height:1.35}#mwHeard{font-weight:600;font-size:17px;min-height:1.4em}';
    document.head.appendChild(st);
    const $ = (id) => document.getElementById(id), say = (t) => { $('mwSt').textContent = t; };
    const game = window.opener, SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const send = (m) => { try { game.postMessage(m, '*'); } catch (e) { say('Keine Verbindung zum Spiel mehr. Dieses Fenster schließen und im Spiel neu öffnen.'); } };
    if (!SR) { say('Dieser Browser kann keine Sprache erkennen. Chrome oder Edge können es.'); $('mwGo').disabled = true; return; }
    if (!game) { say('Kein Spiel gefunden. Bitte im Spiel bei Hank auf „🎤 Fenster“ drücken.'); $('mwGo').disabled = true; return; }
    let rec = null, on = false;
    const start = () => {
      rec = new SR(); rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i], text = r[0].transcript.trim();
          if (!text) continue;
          $('mwHeard').textContent = '„' + text + (r.isFinal ? '“' : ' …“');
          send({ pw: 'heard', text, final: r.isFinal });
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        say('Fehler: ' + e.error); send({ pw: 'mic-error', error: e.error });
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { on = false; $('mwGo').removeAttribute('data-on'); $('mwGo').textContent = 'Mikrofon einschalten'; }
      };
      // recognition stops by itself now and then: start it again while switched on
      rec.onend = () => { if (on) setTimeout(() => { if (on) try { rec.start(); } catch (e) { /* already running */ } }, 250); };
      rec.start();
    };
    $('mwGo').addEventListener('click', () => {
      if (on) { on = false; try { rec.stop(); } catch (e) { /* ignore */ } $('mwGo').removeAttribute('data-on'); $('mwGo').textContent = 'Mikrofon einschalten'; say('Aus.'); send({ pw: 'mic-closed' }); return; }
      on = true; $('mwGo').setAttribute('data-on', ''); $('mwGo').textContent = 'Mikrofon ausschalten';
      try { start(); } catch (e) { say('Startet nicht: ' + e.message); return; }
      say('Bereit. Zurück ins Spiel: bei Hank V drücken (oder „Reden“) und einfach sprechen. Dieses Fenster offen lassen, es darf im Hintergrund sein.');
      send({ pw: 'mic-ready' });
    });
    window.addEventListener('beforeunload', () => send({ pw: 'mic-closed' }));
    say('Dieses Fenster hört für das Spiel zu, denn im claude.ai-Rahmen ist das Mikrofon gesperrt.');
  }
};
