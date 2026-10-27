/* The pack registry: eras, nations, leaders and battles are data, registered here and resolved into one battle the engine can run.
   Nothing in a pack is code the sim depends on for its rules; a battle names its era, the nations it uses and the leaders it places,
   and the engine reads only what this resolver hands it. (Engine roadmap, phase 1.) */
(function (root) {
'use strict';
const P = root.WPacks || (root.WPacks = { eras: {}, nations: {}, leaders: {}, battles: {}, resolved: {} });
P.register = function (kind, id, data) {
  const shelf = P[kind + 's']; if (!shelf) throw new Error(`unknown pack kind "${kind}"`);
  shelf[id] = Object.assign({ id }, data); delete P.resolved[id]; return shelf[id];
};
// leaders: a file holds whole people (name, army, temperament); a battle places them (side, where they stand, the unit they ride with)
P.leader = function (id) {
  for (const book of Object.values(P.leaders)) if (book.people && book.people[id]) {
    // a person's settings over his book's defaults for his nation and rank, over the book's general defaults
    const p = book.people[id], D = book.defaults || {}, nd = (D[p.nation] && D[p.nation][p.rank]) || {}, gd = D._ || {};
    return Object.assign({}, p, { traits: Object.assign({}, gd.traits, nd.traits, p.traits), habits: Object.assign({}, gd.habits, nd.habits, p.habits) });
  }
  return null;
};
// an era may be built on another (like: 'napoleonic'): it takes the other's numbers and tables, its K merged and the rest replaced where it
// gives its own. A quick port of a neighbouring era is a few lines.
P.era = function (id) {
  const e = P.eras[id]; if (!e) return null; if (!e.like) return e;
  const base = P.era(e.like); if (!base) throw new Error(`era "${id}" is built on "${e.like}", which is not loaded`);
  return Object.assign({}, base, e, { K: Object.assign({}, base.K, e.K), base: base.id });
};
P.battle = function (id) {
  if (P.resolved[id]) return P.resolved[id];
  const B = P.battles[id]; if (!B) throw new Error(`no battle pack "${id}"`);
  const era = P.era(B.era); if (!era) throw new Error(`battle "${id}" names era "${B.era}", which is not loaded`);
  // a nation code is looked up in the books of the battle's era first (France 1415 and France 1815 are different armies), then in any book
  const nations = {}; for (const n of B.nations || []) { let found = null, any = null; for (const book of Object.values(P.nations)) if (book.nations && book.nations[n]) { if (!book.era || book.era === B.era) found = book.nations[n]; any = any || book.nations[n]; } nations[n] = found || any; }
  // the map and order-of-battle object the engine reads (W): the battle's own data, with its leaders made whole
  // a battle's map need only hold what it has: the rest is empty (a test bench map has no woods, roads or farms)
  const W = Object.assign({ STREAMS: [], ENCLOSURES: [], VILLAGES: [], WOODS: [], ROADS: [], SUNKEN: [], BUILDINGS: [], HOUSES: [], LM: [], LABELS: [], EDGE_LABELS: [],
    CHOKES: [], ROUTES: {}, OBJECTIVES: {}, STRONGPOINTS: [], RAW: [], QUALITY: {}, CALIBRE: {}, CORPS: {}, DIVISION: {}, HORSE_BATTERIES: [], FORCES: [], TRAITS: {} }, B.map);
  W.LEADERS = (B.leaders || []).map(pl => { const p = P.leader(pl.id) || {}; return Object.assign({ id: pl.id, side: pl.side, name: p.name }, p.traits || {}, { rank: p.rank }, pl.at ? { at: pl.at } : {}, pl.unit ? { unit: pl.unit } : {}, pl.corps ? { corps: pl.corps } : {}, p.habits || {}); });
  const R = { id, battle: B, era, nations, W, sides: B.sides, sideIds: B.sides.map(s => s.id), coalition: Object.fromEntries(B.sides.map(s => [s.id, s.coalition || s.id])) };
  P.resolved[id] = R; return R;
};
if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);
