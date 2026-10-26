/* ---------- things one can own, buy and use; the player's purse and bag ----------
   Money is kept in cents. ITEMS describes each kind of thing once; INV holds what the player carries.
   A drink is served in a vessel (glass, mug, bottle) and taken in sips; alc is what one sip adds to the blood. */
const ITEMS = {
  beer:    { name: 'Bier', price: 10, kind: 'drink', vessel: 'mug', sips: 3, alc: 0.045, sipT: 0.95 },
  whiskey: { name: 'Whiskey', price: 25, kind: 'drink', vessel: 'shot', sips: 1, alc: 0.14, sipT: 0.45 },
  water:   { name: 'Wasser', price: 5, kind: 'drink', vessel: 'glass', sips: 2, alc: -0.04, sipT: 0.8 },
  bottle:  { name: 'Flasche Whiskey', price: 150, kind: 'carry', vessel: 'bottle', sips: 6, alc: 0.1, sipT: 0.75 }
};
const MENU_BAR = ['beer', 'whiskey', 'water', 'bottle'];

function money(c) { return '$' + (c / 100).toFixed(2); }
function price(c) { return c < 100 ? c + ' ¢' : money(c); }

const INV = {
  money: 1000, items: {}, sips: {},     // sips: what is left in an opened bottle
  has(id) { return (this.items[id] || 0) > 0; },
  add(id, n) { this.items[id] = (this.items[id] || 0) + (n || 1); if (ITEMS[id].kind === 'carry' && this.sips[id] === undefined) this.sips[id] = ITEMS[id].sips; },
  remove(id) { if (!this.has(id)) return false; this.items[id]--; if (!this.items[id]) { delete this.items[id]; delete this.sips[id]; } return true; },
  pay(c) { if (this.money < c) return false; this.money -= c; TOAST.show('−' + price(c), 'money'); return true; },
  // one sip from a carried bottle; the empty bottle is thrown away
  sipFrom(id) { if (!this.has(id)) return false; this.sips[id] = (this.sips[id] ?? ITEMS[id].sips) - 1; if (this.sips[id] <= 0) { this.remove(id); TOAST.show('Die Flasche ist leer.'); } return true; }
};
SAVE.part('inv', () => ({ money: INV.money, items: INV.items, sips: INV.sips }),
  (d) => { INV.money = Math.max(0, d.money | 0); INV.items = {}; INV.sips = {}; for (const k in d.items || {}) if (ITEMS[k]) INV.items[k] = d.items[k] | 0; for (const k in d.sips || {}) if (ITEMS[k]) INV.sips[k] = d.sips[k] | 0; });

/* short messages at the top of the screen: money spent, a bottle empty, what happened while you were out */
const TOAST = {
  show(text, kind) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div'); el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), kind === 'long' ? 5200 : 2400);
    setTimeout(() => el.remove(), kind === 'long' ? 6000 : 3200);
  }
};
