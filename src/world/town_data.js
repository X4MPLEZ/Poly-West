/* ---------- Dust Creek: buildings and street props ---------- */
const COL = {
  wood: rgb(0x8b5a3c), woodLight: rgb(0xb08055), woodDark: rgb(0x5a3a28), plank: rgb(0x9d7653),
  roof: rgb(0x4f403a), roofRed: rgb(0x7d3c2c), trim: rgb(0xeadfca), glass: rgb(0x262833), door: rgb(0x4a3123),
  white: rgb(0xe9e0cf), sign: rgb(0xeee2c6), iron: rgb(0x3b3532), canvas: rgb(0xebdfc6), hay: rgb(0xd9b45c),
  water: rgb(0x58798a), earth: rgb(0x8d6446), stone: rgb(0xa79c8c)
};
/* sign cells (atlas tile 32 + index). st: board (framed), plain (no frame), paint (lettering straight on the
   surface, the cell is neutral so the box takes the wall colour). ink: dark, cream or gold. */
const SIGNS = [
  { t: 'SALOON', s: 'WHISKEY & CARDS', st: 'paint', ink: 'cream' },
  { t: 'GENERAL STORE', s: 'DRY GOODS & FEED', st: 'board', ink: 'dark' },
  { t: 'BANK', s: '', st: 'plain', ink: 'gold', font: 'serif' },
  { t: 'ROOMS & BATHS', s: '', st: 'paint', ink: 'cream' },
  { t: 'SHERIFF', s: 'DUST CREEK', st: 'board', ink: 'cream' },
  { t: 'BARBER', s: 'SHAVE & HAIRCUT', st: 'paint', ink: 'gold', font: 'serif' },
  { t: 'STABLES', s: 'HORSES & FEED', st: 'paint', ink: 'cream' },
  { t: 'U.S. POST OFFICE', s: 'TELEGRAPH', st: 'board', ink: 'cream', font: 'sans' },
  { t: 'GUNSMITH', s: 'GUNS & AMMO', st: 'paint', ink: 'cream' },
  { t: 'APOTHECARY', s: 'DRUGS & MEDICINE', st: 'board', ink: 'gold', font: 'serif' },
  { t: 'DRY GOODS', s: 'FEED, SEED & TOOLS', st: 'paint', ink: 'cream' },
  { t: 'HOT BATHS', s: '25 CENTS', st: 'paint', ink: 'gold', font: 'serif' }
];
const GOLD = rgb(0xd6a943);
const NORTH_Z = -5.6, SOUTH_Z = 9.6;
/* crown: shape of the false front's top; porch: roof (posts + roof), awning, deck (boardwalk only), steps (stone) */
const BUILDINGS = [
  { side: 'n', x: -33, w: 10, d: 11, h: 5.0, front: 7.4, wall: 0x7f8f9b, win: 2, type: 'store' },
  { side: 'n', x: -19.5, w: 13, d: 13, h: 8.2, front: 9.8, wall: 0x9c5a3c, two: true, saloon: true, crown: 'arch', type: 'saloon', backWins: [2.6, 5.0, -5.7] },
  { side: 'n', x: -5.5, w: 9, d: 10, h: 5.8, flat: true, wall: 0xc39a6e, tile: 7, win: 1, bars: true, porch: 'steps', type: 'bank' },
  { side: 'n', x: 7.5, w: 11.5, d: 12, h: 7.8, front: 9.0, wall: 0x7c8a6a, two: true, shutters: true, type: 'hotel', backWins: [-4.2] },
  { side: 'n', x: 21, w: 8.5, d: 9, h: 4.6, flat: true, adobe: true, wall: 0xcfa577, tile: 4, win: 1, bars: true, type: 'sheriff' },
  { side: 's', x: -31, w: 12, d: 13, h: 5.6, wall: 0x9a3c2a, barn: true, type: 'livery' },
  { side: 's', x: -16.5, w: 8, d: 9, h: 4.8, front: 6.6, wall: 0xe4dac8, bigWin: true, crown: 'step', porch: 'awning', type: 'barber' },
  { side: 's', x: -5, w: 7, d: 10, h: 5.2, front: 7.6, wall: 0x5d4b42, win: 1, porch: 'deck', type: 'gunsmith' },
  { side: 's', x: 7, w: 10, d: 10, h: 5.4, pitch: 3.0, wall: 0xb08a5c, win: 2, type: 'post' },
  { side: 's', x: 21, w: 9, d: 9, h: 4.4, front: 6.2, flat: true, wall: 0xd1aa80, tile: 4, win: 1, crown: 'arch', type: 'apothecary' },
  // built after the church (late), so the rooms that were there before keep their numbers (and their furniture)
  { side: 'n', x: 33.5, w: 8, d: 9, h: 4.8, front: 6.6, wall: 0xdcd5c3, win: 1, porch: 'roof', type: 'doctor', late: true }
];
function frontWins(b) {
  if (b.bigWin) return [{ u: -2.55, y: 0.9, w: 2.0, h: 1.8 }, { u: 2.55, y: 0.9, w: 2.0, h: 1.8 }];
  const wn = b.win === undefined ? 1 : b.win, out = [];
  for (let k = 1; k <= wn; k++) {
    const off = 1.2 + (k * (b.w / 2 - 1.4)) / (wn + 0.4);
    out.push({ u: -off, y: 1.15, w: 1.2, h: 1.55 }, { u: off, y: 1.15, w: 1.2, h: 1.55 });
  }
  return out;
}
function crownTop(b) { return b.crown === 'arch' ? b.front + 1.15 : b.crown === 'step' ? b.front + 1.53 : b.front + 0.87; }
function porchHasPosts(b) { return b.two || !b.porch || b.porch === 'roof'; }
