# NPC-Konzept (noch nicht gebaut)

Das Verhalten der NPCs entsteht aus Regeln, nicht aus festen Drehbüchern. Jeder NPC hat sechs Schichten.

1. **Persönlichkeit:** 5–6 feste Werte zwischen 0 und 1: Mut, Temperament, Geselligkeit, Laster/Trinken, Nachtragend, Ehrlichkeit.
2. **Bedürfnisse und Tagesablauf:**
   - Jeder NPC hat eine Rolle mit Stundenplan.
   - Bedürfnisse steigen mit der Zeit: Hunger, Müdigkeit, Durst, Gesellschaft.
   - Was er als Nächstes tut, wird nach Nutzen ausgewählt und von der Persönlichkeit gewichtet.
   - Gebäude haben „Plätze mit Angebot“ wie Barhocker, Bett oder Theke, ähnlich wie bei Die Sims. Dafür gibt es schon `INTERACT` mit Sitzplätzen und `seat.occ`.
3. **Emotionen:**
   - Angst, Wut und Stimmung, dazu Betrunkenheit.
   - Sie steigen schnell und klingen langsam ab.
   - Sie verschieben die Schwellen für Entscheidungen.
4. **Gedächtnis:**
   - Erinnerungen halten fest: wer, was, wann, wo und wie stark. Unwichtiges verblasst.
   - Zu jeder Person gibt es eine Beziehung aus Sympathie, Respekt bzw. Furcht und Groll.
   - Das Gedächtnis wird über Sitzungen hinweg gespeichert (`SAVE.part`).
5. **Wahrnehmung und Gerüchte:**
   - Es zählt nur, was ein NPC selbst gesehen oder gehört hat (`WORLD_EVENTS`, `onWorldEvent`). Zeugen sind entscheidend.
   - NPCs tauschen Erinnerungen aus, so entsteht ein Ruf.
6. **Rache als Plan, je nach Persönlichkeit:**
   - mutig und jähzornig: sofort ein Duell
   - mutig und berechnend: lauert auf
   - ängstlich: geht zum Sheriff, heuert jemanden an oder flieht
   - ängstlich und nachtragend: heimliche Rache

**Sprechen:** eine Mischung aus Satzkatalog (im Vorbeigehen) und Sprachmodell (für echte Gespräche). Die Regel dabei: Die KI redet nur, die Spiellogik entscheidet.

**Voraussetzungen:** ein Wegenetz, auf dem auch NPCs Türen und Treppen nutzen können, und die Spieleraktionen.

**Bau-Reihenfolge:**
1. ein NPC mit Alltag
2. Debug-Anzeige
3. Persönlichkeit und Bedürfnisse (5–8 NPCs)
4. Spieleraktionen und Wahrnehmung
5. Gedächtnis, Beziehungen, Speichern
6. Rache und Konflikt
7. Gerüchte und Ruf
8. Gespräche

**Leistung:** 15–25 NPCs, nur die nahen werden voll simuliert. Dafür sind `Grid` und `ACTORS` in `core/world.js` vorgesehen.

**Offene Fragen:**
- Wie groß wird die Bevölkerung?
- Welche Taten sind möglich?
- KI-Sprache oder feste Sätze?
- Wie lange reicht das Gedächtnis über Sitzungen?
