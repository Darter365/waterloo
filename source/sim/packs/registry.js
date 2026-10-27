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
P.leader = function (id) { for (const book of Object.values(P.leaders)) if (book.people && book.people[id]) return book.people[id]; return null; };
P.battle = function (id) {
  if (P.resolved[id]) return P.resolved[id];
  const B = P.battles[id]; if (!B) throw new Error(`no battle pack "${id}"`);
  const era = P.eras[B.era]; if (!era) throw new Error(`battle "${id}" names era "${B.era}", which is not loaded`);
  const nations = {}; for (const n of B.nations || []) { let found = null; for (const book of Object.values(P.nations)) if (book.nations && book.nations[n]) found = book.nations[n]; nations[n] = found; }
  // the map and order-of-battle object the engine reads (W): the battle's own data, with its leaders made whole
  const W = Object.assign({}, B.map);
  W.LEADERS = (B.leaders || []).map(pl => { const p = P.leader(pl.id) || {}; return Object.assign({ id: pl.id, side: pl.side, name: p.name }, p.traits || {}, { rank: p.rank }, pl.at ? { at: pl.at } : {}, pl.unit ? { unit: pl.unit } : {}, pl.corps ? { corps: pl.corps } : {}, p.habits || {}); });
  const R = { id, battle: B, era, nations, W, sides: B.sides, sideIds: B.sides.map(s => s.id), coalition: Object.fromEntries(B.sides.map(s => [s.id, s.coalition || s.id])) };
  P.resolved[id] = R; return R;
};
if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);
