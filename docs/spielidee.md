# Spielidee (Stand: Vorschlag, noch nicht entschieden)

**Ein Leben im Wilden Westen** in einer lebendigen Welt mit Menschen und Tieren. Überraschungen entstehen aus Systemen, die aufeinandertreffen, nicht aus festen Geschichten.
Erst ein Einzelspieler-Spiel. Später vielleicht ein Koop-Besuch, bei dem ein Freund dich in deiner Welt besucht (im Artefakt über die `room`-Funktion, ohne eigenen Server).

## Säulen
1. **Leben:**
   - Wohnort: erst ein Hotelzimmer mieten, später ein Haus kaufen und einrichten.
   - Jobs: Barkeeper, Holz hacken, Gold waschen, Pokern, Kopfgeld, Postkutsche.
   - Bedürfnisse: Hunger, Schlaf, Sauberkeit.
2. **Beziehungen:**
   - NPCs mit Gedächtnis.
   - Freundschaft, Flirt, Geschenke, Tanz, Heirat, Familie.
   - Feinde und Rache.
3. **Ruf:**
   - Ehrlich oder gewalttätig, aber nur das zählt, was jemand gesehen hat.
   - Daran richten sich Preise, Grüße, der Blick des Sheriffs und Steckbriefe.
4. **Überraschungen:**
   - Zufällige Ereignisse wie ein Betrunkener, der Streit sucht, ein Überfall, ein Prediger, ein Sandsturm oder ein Goldgerücht.
   - Tiere mit eigenem Verhalten, zum Beispiel ein Hund zum Adoptieren.
   - Geheimnisse und lustige Physik.

**Tagesablauf als Kern:** morgens aufwachen, tagsüber Job oder Abenteuer, abends Saloon, nachts schlafen (dabei wird gespeichert).
**Erstes Ziel:** „Ein Tag in Dust Creek“: ein Zimmer, ein Job, 6–8 NPCs mit eigenem Alltag, ein Saloonabend, ein einfacher Ruf.

## KI für Gespräche
- Die NPCs funktionieren **ohne KI** (Regeln und Satzkatalog). Die KI ist ein Bonus für echte Gespräche.
- **Im Artefakt:** über die `sample`-Funktion des Artefakts. Sie fragt Claude mit dem Konto des Spielers, also ohne Schlüssel und ohne Kosten für uns.
- **Später öffentlich:** ein kleiner Vermittlungsserver (zum Beispiel ein Cloudflare Worker) mit einem günstigen Modell und Grenzen pro Spieler. Abos wie ChatGPT, Gemini oder Claude enthalten keinen API-Zugang.
- **Mikrofon:**
  - Spracherkennung des Browsers (Web Speech API, Deutsch), mit einer Sprechtaste.
  - Die KI liefert die Antwort und einen Vorschlag für die Reaktion. Was passiert, entscheidet die Spiellogik.
  - Vorlesen über die Browser-Stimmen (speechSynthesis), mit eigener Stimme und Tonhöhe pro NPC.
  - Etwa 2–4 Sekunden Wartezeit, die der NPC mit einer Geste überbrückt. Ob das Mikrofon im Artefakt erlaubt ist, muss getestet werden.
