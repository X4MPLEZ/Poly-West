/* ---------- what a person looks like, as data ----------
   One description per figure (the player, Hank, the doctor, later anyone in town); char/rig.js builds the body from
   it. Everything a character editor or a shop would change lives here: build, skin, face, hair, beard, clothes.
     build:  { width 0.9..1.15, belly 0..1 }
     skin:   index into LOOK.SKIN (or a colour)
     face:   { nose: 'small' | 'normal' | 'big', brows: thickness 0.7..1.4 }
     hair:   { style: 'short' | 'slick' | 'long' | 'balding' | 'bald', color }
     beard:  { style: 'none' | 'stubble' | 'stache' | 'handlebar' | 'goatee' | 'chops' | 'full', color }
     outfit: { hat: null | { style: 'cowboy', color, band }, bandana: null | colour, shirt: { color, rolled },
               vest: null | colour, pants: { color }, boots: colour, belt: colour, buckle: colour,
               apron, bowtie, garter (null | colour), glasses (bool), gun (bool) }
   lookFrom(colors, opt) turns the older colour lists into a description. */
const LOOK = {
  SKIN: [0xf0c8a8, 0xe8b590, 0xdca482, 0xd99f78, 0xc68a62, 0xa96d48, 0x8a5434, 0x5e3a24].map(rgb),
  HAIR: { black: rgb(0x1c1512), dark: rgb(0x2e2018), brown: rgb(0x5a3a26), red: rgb(0x8a4a22), blond: rgb(0xc4a064), grey: rgb(0x9a948a), white: rgb(0xd8d4cc) },
  HAIR_STYLES: ['short', 'slick', 'long', 'balding', 'bald'],
  BEARDS: ['none', 'stubble', 'stache', 'handlebar', 'goatee', 'chops', 'full'],
  // the player's cowboy, and the base every description is filled from
  BASE: {
    build: { width: 1, belly: 0 },
    skin: 3,
    face: { nose: 'normal', brows: 1 },
    hair: { style: 'short', color: rgb(0x4a3020) },
    beard: { style: 'stache', color: rgb(0x5a3a26) },
    outfit: {
      hat: { style: 'cowboy', color: rgb(0x5b3b26), band: rgb(0x2a1d15) }, bandana: rgb(0xc23a2c),
      shirt: { color: rgb(0xe3d3b3), rolled: false }, vest: rgb(0x4a352a), pants: { color: rgb(0x3f5878) },
      boots: rgb(0x6a4029), belt: rgb(0x2a1d15), buckle: rgb(0xd9b04c),
      apron: null, bowtie: null, garter: null, glasses: false, gun: true
    }
  },
  // a full description from a partial one (deep for the groups)
  make(d) {
    const B = this.BASE, o = d || {};
    const L = {
      build: Object.assign({}, B.build, o.build), skin: o.skin !== undefined ? o.skin : B.skin,
      face: Object.assign({}, B.face, o.face), hair: Object.assign({}, B.hair, o.hair), beard: Object.assign({}, B.beard, o.beard),
      outfit: Object.assign({}, B.outfit, o.outfit)
    };
    L.outfit.shirt = Object.assign({}, B.outfit.shirt, o.outfit && o.outfit.shirt);
    L.outfit.pants = Object.assign({}, B.outfit.pants, o.outfit && o.outfit.pants);
    if (L.outfit.hat) L.outfit.hat = Object.assign({}, B.outfit.hat, L.outfit.hat);
    return L;
  },
  skinCol(L) { return Array.isArray(L.skin) ? L.skin : this.SKIN[clamp(L.skin | 0, 0, this.SKIN.length - 1)]; },
  // the older way of giving a look: a colour list and a few options
  from(colors, opt) {
    const C = colors || {}, O = opt || {}, d = { outfit: {} }, f = d.outfit;
    if (C.skin) d.skin = C.skin;
    if (C.shirt) f.shirt = { color: C.shirt };
    if (C.vest) f.vest = C.vest;
    if (C.jeans) f.pants = { color: C.jeans };
    if (C.boot) f.boots = C.boot;
    if (C.belt) f.belt = C.belt;
    if (C.bandana) f.bandana = C.bandana;
    if (C.hat) f.hat = { color: C.hat, band: C.band || rgb(0x2a1d15) };
    if (C.stache) d.beard = { style: 'stache', color: C.stache };
    if (O.hat === 'none') { f.hat = null; d.hair = { style: 'slick', color: O.hair || rgb(0x2e2018) }; }
    if (O.gun === false) f.gun = false;
    for (const k of ['apron', 'bowtie', 'garter']) if (O[k]) f[k] = O[k];
    return this.make(d);
  }
};
