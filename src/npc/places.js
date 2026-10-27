/* ---------- where things are in Dust Creek, for people who are told "behind the church" ----------
   PLACEMAP.find(text) reads a place out of what you say: a building (the saloon, the bank, the church …), a spot
   in the open (the graveyard, the water tower, the windmill, the corral, the bridge, the trough …) or a person
   ("bei Hank"), and how it relates to it (hinter, vor, neben, in, bei). It returns where that is ({ x, z }), the
   room when it is inside one, and the place in words (dative: "hinter der Kirche") for what people remember.
   Buildings use their own frame (front = the door side), spots in the open face the street. */
const PLACEMAP = {
  // room type, words, the name in the dative
  ROOMS: [
    ['saloon', /saloon|\bbar\b|kneipe|theke|wirtshaus/, 'dem Saloon'], ['hotel', /hotel/, 'dem Hotel'], ['bank', /\bbank\b/, 'der Bank'],
    ['sheriff', /sheriff|gefängnis|gefaengnis|zelle/, 'dem Sheriffbüro'], ['livery', /mietstall|\bstall|scheune/, 'dem Mietstall'],
    ['barber', /barbier|friseur|frisör/, 'dem Barbier'], ['gunsmith', /waffen/, 'dem Waffenhändler'], ['post', /\bpost/, 'der Post'],
    ['apothecary', /apothek/, 'der Apotheke'], ['store', /gemischtwaren|kramladen|krämer|\bladen\b|store/, 'dem Gemischtwarenladen'],
    ['church', /kirche/, 'der Kirche'], ['doctor', /praxis|beim (doc|arzt)|zum (doc|arzt)/, 'der Praxis']
  ],
  // spots in the open: words, where (x, z), the name in the dative
  SPOTS: [
    [/friedhof|gräber|graeber|\bgrab\b/, -63, 13, 'dem Friedhof'], [/wasserturm|\bturm\b/, 34, 16, 'dem Wasserturm'],
    [/windrad|windmühle|windmuehle|windpumpe/, 47, -27, 'dem Windrad'], [/koppel|pferch|corral|gatter|pferde/, -30, 23, 'der Koppel'],
    [/brücke|bruecke/, null, null, 'der Brücke'], [/tränke|traenke|trog/, -27.5, 6, 'der Tränke'], [/\bwagen\b|planwagen/, 29.5, 3.4, 'dem Wagen'],
    [/ortsausgang|stadtrand|ende der stadt|östlich|osten|ostende/, 58, 3, 'dem Ostende der Stadt'], [/westlich|westen|westende/, -45, 2, 'dem Westende der Stadt'],
    [/hauptstraße|hauptstrasse|straße|strasse|draußen|draussen/, null, null, 'der Straße']
  ],
  REL: [['behind', /\bhinter(m|n|em|er|s)?\b|\bhinten\b/], ['front', /\bvor(m|n|em|er|s)?\b|\bdavor\b/], ['beside', /\bneben\b|\bseitlich\b|\bdaneben\b/], ['in', /\b(im|drin|drinnen|innen)\b|\bin (der|dem|den|die|das)\b/], ['at', /\b(bei|beim|am|an|unter|unterm|auf)\b/]],
  REL_WORD: { behind: 'hinter', front: 'vor', beside: 'neben', in: 'in', at: 'bei' },
  // "bei dem" → "beim", "in dem" → "im"
  words(s) { return s.replace(/^bei dem /, 'beim ').replace(/^in dem /, 'im ').replace(/^vor dem /, 'vorm ').replace(/^hinter dem /, 'hinter dem '); },
  rel(t) { for (const [k, re] of this.REL) if (re.test(t)) return k; return null; },
  find(text) {
    const t = (text || '').toLowerCase(), rel = this.rel(t);
    // a person: where he is now
    for (const N of NPCS.list) {
      if (N.name && new RegExp('\\b' + N.name.toLowerCase() + '\\b').test(t) && !/doc\b/.test(N.name.toLowerCase())) {
        const near = (/bei|neben|zu/.test(t)) || !this.ROOMS.some(([, re]) => re.test(t));
        if (near) return { x: N.pos.x, z: N.pos.z, R: N.room || null, name: 'bei ' + N.name, npc: N };
      }
    }
    for (const [type, re, dat] of this.ROOMS) {
      if (!re.test(t)) continue;
      const R = ROOMS.find((r) => r.type === type && !r.parent); if (!R) continue;
      const r = rel || 'in', zm = (R.z0 + R.z1) / 2;
      const p = r === 'behind' ? rwp(R, 0, 0, R.z0 - 3.5) : r === 'front' ? rwp(R, 0, 0, R.z1 + 3) : r === 'beside' ? rwp(R, R.x1 + 3, 0, zm) : r === 'in' ? rwp(R, 0, R.floorY, zm) : rwp(R, 0, 0, R.z1 + 2.5);
      return { x: p.x, z: p.z, R: r === 'in' ? R : null, room: R, name: this.words((r === 'in' ? 'in ' : this.REL_WORD[r] + ' ') + dat), type };
    }
    for (const [re, sx, sz, dat] of this.SPOTS) {
      if (!re.test(t)) continue;
      let x = sx, z = sz;
      if (/brücke/i.test(dat)) { const B = W.bridge; if (!B) continue; x = B.x; z = B.z; }
      if (x === null) return { x: null, z: null, R: null, name: 'auf ' + dat, street: true };
      // (in the open: "behind" is away from the street, "in front" towards it)
      const away = Math.sign(z - 2) || 1, r = rel || 'at';
      if (r === 'behind') z += away * 4.5; else if (r === 'front') z -= away * 4; else if (r === 'beside') x += 4;
      return { x, z, R: null, name: this.words((r === 'at' || r === 'in' ? 'bei ' : this.REL_WORD[r] + ' ') + dat) };
    }
    return null;
  }
};
