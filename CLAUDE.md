# Poly West

Low-Poly-Western im Browser, in der Art von Red Dead Redemption, nur grafisch einfach. Ziel ist eine große offene Welt.
Die erste Stadt heißt **Dust Creek**. Das Spiel wird als **eine einzige HTML-Datei** gebaut und als Claude-Artefakt veröffentlicht.

## Für wen, wie arbeiten
- Auftraggeber: Merkel. Antworten auf **Deutsch** und knapp. Im Spiel steht alles auf Deutsch, die Code-Kommentare sind englisch.
- **Zielgeräte:** PC zuerst. Am Handy muss es im **Querformat** spielbar sein (Touch-Steuerung in `play/input.js` und `ui/hud.js`).
- **Stil:** Low Poly mit flachen Flächen und Vertexfarben. Animationen sind das Wichtigste, weil der Look einfach ist.
- **Ton:** Umgebung und Schritte werden leise synthetisch erzeugt. Für Schuss und Schläge werden echte Aufnahmen verwendet (`audio/samples.js`, Lizenzen im Kopf der Datei und auf dem Startbildschirm).
- **Menschen:** bisher ein NPC, Hank, der Barkeeper im Saloon (`npc/`). Weitere NPCs nach `docs/npc-konzept.md`. Noch keine Tiere.
- Nach jeder Änderung: bauen, testen, Bilder ansehen, committen, veröffentlichen (siehe unten).

## Befehle
```
python3 build.py --local          # dist/test.html für die Tests (Three.js aus vendor/)
python3 build.py                  # dist/poly-west.html, das Artefakt (Three.js r159 von jsdelivr, unpkg als Ersatz)
python3 tests/run.py              # alle Prüfungen; Exit-Code = Anzahl Fehler
python3 tests/run.py seats gait   # nur einzelne Prüfungen
python3 tests/run.py --golden     # gewollte Änderung an der Welt als neue Referenz übernehmen
```
- Die Tests laufen in headless Chrome (Playwright, `tests/harness.py`). Das Spiel bietet dafür `G.manual = true`, `G.stepFrame(dt)`, `G.noRender` (rechnen ohne zu zeichnen) und `G.camHook` (eigene Kamera für Bilder).
- **fingerprint** prüft, ob die gebaute Welt exakt gleich geblieben ist: Meshes, Kollisionen, Plattformen, Sitzplätze, Türen. Nach reinen Umbauten muss das Ergebnis „identical“ sein. Nach gewollten Änderungen `--golden` ausführen.
- **budget**: Zeichenaufrufe und Dreiecke in festen Ansichten. Liegt ein Wert über der Grenze, gilt die Prüfung als nicht bestanden.
- Bilder zum Ansehen landen in `tests/out/`; der Ordner ist nicht im Repo.
- **Stimmen:** `python3 tools/voices.py [thorsten karlsson kerstin]` baut die Stimm-Dateien nach `vendor/voice/` (nicht im Repo, ca. 45 MB für Laufzeit + Thorsten medium, 22 kHz; Quellen: sherpa-onnx-Releases (alle Piper-Stimmen) bzw. rhasspy/piper v0.0.2). `build.py` verlinkt sie nach `dist/voice/`; die Prüfung `voice` lädt sie über einen lokalen http-Server.
- Veröffentlichen: Artefakt-Tool mit `dist/poly-west.html` (immer derselbe Pfad, damit der Link bleibt). Das Artefakt deklariert `capabilities: {sample: {}}` (KI-Gespräche); beim erneuten Veröffentlichen `capabilities` weglassen, dann bleibt die Deklaration. Die Stimm-Dateien gehen als `files` mit (`voice/<name>` → `vendor/voice/<name>`, `.wasm` als `application/wasm`, Binärdateien als `application/octet-stream`); weggelassene Dateien bleiben beim nächsten Veröffentlichen erhalten, also nur mitschicken, wenn sie sich geändert haben.

## Aufbau
Alle Skripte teilen sich **einen gemeinsamen Gültigkeitsbereich**: Es gibt keine Module und keine Imports, nur Globale. Die Reihenfolge steht in `src/manifest.txt`.
Eine neue Datei muss dort eingetragen werden, sonst bricht der Build ab. Was beim Laden einer Datei sofort ausgeführt wird, darf nur Dinge aus früheren Dateien benutzen. Innerhalb von Funktionen ist alles erreichbar.

| Datei | Inhalt |
|---|---|
| `core/util.js` | Hilfsfunktionen (`clamp`, `lerp`, `smoothstep`, `rgb`, `mulberry32`) und `MB`: der Mesh-Baukasten (`box`, `cyl`, `beam`, `quad`, `geo`, `push`/`pop` von Matrizen, `build`) |
| `core/settings.js` | `SETTINGS`: Einstellungen mit Standardwerten, gespeichert; Systeme hängen sich mit `SETTINGS.on(key, fn)` an |
| `core/world.js` | Weltereignisse (`worldEvent`, `onWorldEvent`), `Grid` (räumliches Raster), `ACTORS` (Spieler, später NPCs und Pferde) |
| `world/terrain.js` | Gelände (`heightAt`, `surfaceHeight`), Kollisionslisten `COLL`/`PLATS`/`CAMBLOCK`, Straße |
| `world/town_data.js` | `BUILDINGS` (welches Haus wo, Fassade, Veranda), `SIGNS`, Farben `COL` |
| `world/facades.js` | Fassaden, Fenster, Veranden, Giebelkronen |
| `world/decor.js` | Schilder, Embleme, Dinge vor den Läden (`decorate`), Verandabänke |
| `world/town.js` | Scheune, Kirche, Wasserturm, Windrad, Wagen, Zäune und `buildTown()` |
| `world/rooms.js` | Räume: Raumrahmen (`rwp`/`rLocal`), Wände (`lining`), Treppen, Obergeschosse, Türen, `updateRooms` (Sichtbarkeit, Belichtung, Türen) |
| `world/furniture.js` | Möbel-Bausteine (`chair`, `bench`, `stool` …), Sitzplatz-Meldung `seatHere`, **Prefabs + `place()`** |
| `world/interiors.js` | `FURNISH`: die Einrichtung jedes Gebäudes |
| `world/nature.js` | Kakteen, Büsche, Felsen, Tafelberge, Steppenläufer, Geier |
| `world/chunks.js` | statische Welt pro Zelle (96 m) zusammengefasst; `chunkKind` (aus welcher Quelle ein Dreieck stammt) |
| `gfx/atlas.js` | Textur-Atlas (512 px): Kacheln 0–31 Detail, 32+ Schilder (256×64), 64+ Symbole |
| `char/rig.js` | Cowboy: 13 starre Teile, `applyPose` (Bein-IK, Arm-Override `armOv`) |
| `char/gait.js` | Gang: Füße fest in der Welt, Schrittzyklus, Körperbewegung; bei Sitzen übernimmt `SIT.pose` |
| `gfx/dust.js` | Staub bei Schritten |
| `gfx/shaders.js` | GLSL: `litV`/`litF` (draußen), `inF` (innen, Licht aus Tür/Fenstern), Rauch, Schlagspur |
| `gfx/render.js` | Renderer, Uniforms `U`, `W` (Szene), `assembleScene`, Licht, Schatten |
| `play/player.js` | `PLAY` (Position, Blick, Tempo), Bewegung, `collide`, `groundAt`, Spieler-Akteur |
| `play/input.js` | Tastatur, Maus, Touch-Joystick, Gamepad |
| `play/camera.js` | Third-Person-Kamera, innen/außen, Zielkamera über der Schulter |
| `audio/sfx.js` | Web-Audio-Grundlagen, Schritte |
| `audio/samples.js` | eingebettete MP3-Aufnahmen und ihre Lizenzen |
| `audio/voice.js` | `VOICE`: echte Stimmen mit Piper (neuronales TTS) im Browser, in einem Worker: onnxruntime-web + piper_phonemize (espeak, nur Deutsch); Satz für Satz (`push`), Tonhöhe/Tempo pro NPC aus `npc.voiceProfile`. Dateien aus `tools/voices.py` (siehe oben) |
| `combat/fx.js` | Mündungsfeuer, Rauch, Splitter, Einschusslöcher je Material (`surfaceOf`) |
| `combat/gun.js` | Revolver: Holster → Ziehen → Zielen/Schießen → Nachladen, Flaschen, Treffer |
| `combat/gun_sound.js` | `GSFX`: Aufnahmen abspielen und Mechanik-Geräusche |
| `combat/dummy.js` | Übungspuppe |
| `combat/fist.js` | Faustkampf: Schläge als Faustbahnen mit Arm-IK, Overhand, Deckung, Ausdauer |
| `interact/interact.js` | **ein System für alles Benutzbare**: Einträge mit Ort, Raum, Belegung, Verb; Fokus und Hinweis „E …“ |
| `interact/sit.js` | Hinsetzen, Sitzen, Aufstehen (`SIT_KINDS` legt pro Sitzart Höhe, Füße und Hände fest), `SIT.warp(seat)` |
| `interact/drink.js` | Trinken: `GLASS` (serviertes Getränk, rutscht über die Theke), `DRINK` (Arm-Animation greifen → heben → Schluck → abstellen), Theken (`makeCounter`, `barActions`), `SHOP` (Bestellliste), Glas-Geräusche (Rutschen, Anheben, Abstellen) |
| `play/drunk.js` | `DRUNK`: Magen → Blut; Gleichgewicht als Federkette (Kopf führt, Oberkörper folgt, Hüfte/Füße werden mitgezogen → `drift`), Kurs-Drift, Stolpern, Schluckauf, Kamera, Anstoßen an Wänden (`bump`, nur Kopf und Ton), wirkt verzögert (Magen → Darm → Blut), bei zu viel drinnen allein rausgehen (`leave`), letzte halbe Minute volltrunken (`edge`), dann Filmriss mit Aufwachen woanders |
| `play/fall.js` | `FALL`: Hinfallen, Krabbeln, Aufstehen als Schlüsselposen (`FALL_KEYS`, Abläufe aus `makeSeq`): Richtung aus Neigung + Laufrichtung, jeder Sturz leicht anders; nach vorn (Hände, Gesicht, weiterkrabbeln), zur Seite, am Ende selbst steuerbares Krabbeln (`crawling()` → `crawlMove` in player.js), liegend Aufwachen |
| `gfx/post.js` | `POST`: Unschärfe, Doppeltsehen, Wabern, warme Farbe, Abdunkeln bis Schwarz, Blinzeln beim Aufwachen; nur wenn betrunken (sonst direkt auf den Bildschirm) |
| `ui/micwin.js` | `MICWIN`: Mikrofon-Fenster. Im claude.ai-Rahmen ist das Mikrofon gesperrt; das Spiel öffnet sich selbst als kleines Fenster (`#mic`), das zuhört und den Text per `postMessage` zurückschickt. Bei offenem Gesprächsstreifen freihändig (nicht während der NPC spricht) |
| `ui/wheel.js` | `WHEEL`: Schnellrad für die Tasche (Tab halten / Taschen-Knopf / Steuerkreuz hoch), Zeit läuft langsamer |
| `core/items.js` | `ITEMS` (Getränke, Flasche), `INV` (Geld in Cent, Tasche), `TOAST` (Meldungen oben) |
| `npc/npc.js` | `NPC`: Körper aus dem Rig (`buildCharacter(farben, {hat, gun, apron, bowtie, garter, hair})`), Gehen zu einem Ziel (`goTo`), Blick (`lookAt`), Hände per Arm-IK (`reach`), Ducken/Lehnen, Gesten (`gesture`); `SAY` Sprechblasen; `NPCS.bodies` Kollision mit dem Spieler |
| `npc/barkeep.js` | `BARKEEP`: Hank. Arbeitet hinter der Theke (polieren, wischen, umsehen), kommt zum Gast, bedient von Hand (`order` ← `SHOP.buy`), duckt sich bei Schüssen, Hände hoch beim Zielen, Sprüche (`LINES`), Gedächtnis (`mem`), `persona` für Gespräche |
| `npc/talk.js` | `TALK`: Gespräche. V / „Reden“ → Spracherkennung (de-DE), wo das Mikrofon erlaubt ist; in claude.ai nicht, dann Textzeile für das System-Diktat (Win+H, Handy-Tastatur), schickt nach Diktierpause selbst → Claude über die `sample`-Capability (schnellste Stufe `quick`, gestreamt, Format `[aktion] Worte`) → Sprechblase wächst mit, jeder fertige Satz geht sofort an `VOICE`. Alles, was ein NPC sagt, geht über `npc.speak` → `VOICE.line` (echte Stimme, sonst sofort Browser-Stimme). Ohne KI antwortet `persona.offline`. Die KI redet nur; Aktionen prüft `persona.act`. |
| `audio/ambient.js` | Umgebungston, im Raum verteilt |
| `ui/hud.js`, `ui/page.html` | Anzeige, Touch-Knöpfe, CSS, Startbildschirm |
| `ui/menu.js` | Pausenmenü (Esc/P/☰/Start): Spiel, Einstellungen (aus `SETTINGS.SPEC` gebaut), Steuerung |
| `dev/devtools.js` | Entwickler-Werkzeuge (F2): Infos, Teleport, freie Kamera, Zeitraffer, Overlays (Kollision, Böden, Plätze, Zellen), Position kopieren |
| `core/save.js` | Spielstand: Teile melden `collect`/`apply` an, Format mit Version und `migrate()` |
| `main.js` | Start und Hauptschleife (Reihenfolge der Updates pro Frame) |

## Konventionen
- **Einheiten:** Meter und Sekunden. Y zeigt nach oben. Der Straßenboden liegt auf y=0, Veranden auf 0.35.
- **Blickrichtung:** `yaw` = 0 schaut nach +z, die Vorwärtsrichtung ist `(sin yaw, cos yaw)`.
- **Charakterraum:** +x ist die *linke* Seite des Cowboys, +z ist vorn. Der Arm-/Bein-Index 0 ist links, 1 ist rechts.
- **Gebäude:** lokaler Rahmen mit der Front zu +z. Nordseite ry=0, Südseite ry=π.
- **Raumkoordinaten:** `rwp(R, x, y, z)` rechnet von Raum zu Welt um, `rLocal(R, X, Z)` umgekehrt. Kollisionen im Raum: `rColl(R, x0, x1, z0, z1, h)` und `rCircle(R, x, z, r)`.
- **Neue Räume und Möbel:** als Liste mit `place(mb, R, [[prefab, x, z, ry, {opts}], …], rnd)` (siehe `world/furniture.js`). Einzelstücke wie Klavier oder Tresor bleiben Code direkt daneben. Ältere Räume werden umgestellt, sobald man sie ohnehin anfasst. Sheriff und Post sind bereits umgestellt und können als Vorbild dienen.
- **Zufall:** Die Welt wird mit `mulberry32(seed)` gebaut, damit sie bei jedem Start gleich ist. Die Reihenfolge der `rnd()`-Aufrufe darf sich bei Umbauten nicht ändern, sonst ändert sich die Welt (fingerprint).
- **Sitzplätze** melden sich selbst über `seatHere` an. `seat.occ` enthält die Akteur-ID; so finden später auch NPCs freie Plätze.
- **Neue Aktionen** laufen über `INTERACT` (Eintrag mit `verb`, `score(p)` und entweder `label`+`use()` oder `actions(p)` → bis zu zwei `{label, run}`), nicht über eigene Tastenabfragen. Erste Aktion: E / Y / Knopf 1, zweite: R / B / Knopf 2. Lange Dinge (Theken) stehen in `INTERACT.wide` statt im Raster.
- **Theken:** `counterHere(mb, x0, x1, z, topY)` beim Bauen eines Tresens (Kunden auf der −z-Seite).
- **Arm-Animationen mit Gegenstand:** wie `DRINK.pose` – nach dem Körper `torsoInverse(P)`, Ziel im Charakterraum, `armIK`, in `P.armOv[i]` mischen; der Gegenstand folgt in einer `late()`-Funktion der Hand.
- **Was andere mitbekommen sollen** (Schuss, Schlag, Hinsetzen …): `worldEvent(type, x, y, z, {by, …})`.
- **Neue NPCs:** `new NPC({...})` + eigenes Verhalten-Objekt (Vorbild `BARKEEP`); sprechen können sie mit `npc.persona = { rules, context(), offline(text), act(action) }`. Regel: Die KI redet nur, was passiert entscheidet `act` mit Prüfung (Geld, Zustand …).
- **Neue Einstellung:** eine Zeile in `SETTINGS.SPEC`, dann `SETTINGS.on('key', fn)` im System; das Menü baut den Regler selbst.
- **Neues Entwickler-Werkzeug:** Knopf in `#dev` (page.html) + Funktion in `DEV`. Bei Fehlermeldungen von Merkel nach „Position kopieren“ fragen.
- **Was gespeichert werden soll:** `SAVE.part(name, collect, apply)`. Ändert sich das Format, wird `SAVE.V` erhöht und `migrate` ergänzt.
- **Leistung:** Statische Dinge kommen in die Chunks. Pro Frame keine neuen Objekte anlegen (Vektoren wiederverwenden). Pro Raum ein Mesh. Am Handy höchstens etwa 70 Zeichenaufrufe.
- Three.js **r159** (letzte Version mit `three.min.js`). Kein Modul-Build.

## Stand und Plan
- **Fertig:** Stadt mit 11 betretbaren Gebäuden, Treppen, Türen in beide Richtungen und Saloon-Pendeltüren, Gang-Animation, Revolver, Faustkampf mit Übungspuppe, Hinsetzen (98 Plätze), Spielstand, Pausenmenü mit Einstellungen, Entwickler-Werkzeuge, Trinken an der Theke (stehend/sitzend), Flasche aus der Tasche, Geld, Betrunkenheit (Schwanken, Stolpern, Hinfallen, Krabbeln, Doppeltsehen, ungenaue Schläge) mit Filmriss, Schnellrad für die Tasche, erster NPC (Hank, Barkeeper) mit KI-Gesprächen per Sprache oder Text.
- **Als Nächstes:** Tag/Nacht mit Schlafen, weitere NPCs mit Alltag (siehe Konzept), Pferd, Soziales/Duell und Wildnis.
- Das NPC-Konzept steht in `docs/npc-konzept.md`. Spielidee (Leben im Westen, Ruf, Beziehungen, Überraschungen) und Sprachsteuerung per Mikrofon: `docs/spielidee.md`.
