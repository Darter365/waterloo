/* The pack registry: eras, nations, leaders and battles are data, registered here and resolved into one battle the engine can run.
   Nothing in a pack is code the sim depends on for its rules; a battle names its era, the nations it uses and the leaders it places,
   and the engine reads only what this resolver hands it. (Engine roadmap, phase 1.) */
(function (root) {
'use strict';
const P = root.WPacks || (root.WPacks = { eras: {}, nations: {}, leaders: {}, battles: {}, oobs: {}, maps: {}, resolved: {} });
P.oobs = P.oobs || {}; P.maps = P.maps || {};
/* (4c) a terrain pack (made by tools/map.js from survey files): the field's grid, heights and features. P.terrain(id) gives it ready for a
   battle's map: heights unpacked (16-bit decimetres) and the conversions between latitude-longitude and map metres built from its corner. */
P.terrain = function (id) {
  const T = P.maps[id]; if (!T) return null;
  if (T._W) return T._W;
  const bin = typeof atob === 'function' ? atob(T.TB64) : Buffer.from(T.TB64, 'base64').toString('binary');
  const dv = new DataView(new ArrayBuffer(bin.length)); for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  const H = new Float32Array(T.NX * T.NY); for (let i = 0; i < H.length; i++) H[i] = dv.getInt16(i * 2, true) / 10;
  const { LAT0, LON0, MLAT, MLON } = T, ll2m = (lat, lon) => [(lon - LON0) * MLON, (LAT0 - lat) * MLAT], m2ll = (x, y) => [LAT0 - y / MLAT, LON0 + x / MLON];
  const W = Object.assign({}, T, { H, ll2m, m2ll }); delete W.TB64; delete W.source; delete W.id;
  Object.defineProperty(T, '_W', { value: W, enumerable: false }); return W;
};
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
  // (4d) a battle may take its order of battle from an oob pack (made from a CSV by tools/oob.js): oob: '<id>'
  const O = B.oob ? P.oobs[B.oob] : null; if (B.oob && !O) throw new Error(`battle "${id}" names order of battle "${B.oob}", which is not loaded`);
  // (4c) and its ground from a terrain pack: terrain: '<id>' (the battle's own map keys come on top)
  const TW = B.terrain ? P.terrain(B.terrain) : null; if (B.terrain && !TW) throw new Error(`battle "${id}" names terrain "${B.terrain}", which is not loaded`);
  const W = Object.assign({ STREAMS: [], ENCLOSURES: [], VILLAGES: [], WOODS: [], ROADS: [], SUNKEN: [], BUILDINGS: [], HOUSES: [], LM: [], LABELS: [], EDGE_LABELS: [],
    CHOKES: [], ROUTES: {}, OBJECTIVES: {}, STRONGPOINTS: [], RAW: [], QUALITY: {}, CALIBRE: {}, CORPS: {}, DIVISION: {}, FORCES: [], TRAITS: {} }, TW || {}, B.map,
    O ? { RAW: O.RAW, CORPS: O.CORPS, DIVISION: O.DIVISION, QUALITY: O.QUALITY, CALIBRE: O.CALIBRE, TRAITS: O.TRAITS, FORCES: O.FORCES } : {});
  W.LEADERS = (B.leaders || []).map(pl => { const p = P.leader(pl.id) || {}; return Object.assign({ id: pl.id, side: pl.side, name: p.name }, p.traits || {}, { rank: p.rank }, pl.at ? { at: pl.at } : {}, pl.unit ? { unit: pl.unit } : {}, pl.corps ? { corps: pl.corps } : {}, p.habits || {},
    p.glass && typeof p.glass.power === 'number' ? { glass: p.glass.power } : {}); }); // his telescope's power, for the view only (view.js); the era's when he gives none
  const R = { id, battle: B, era, nations, W, sides: B.sides, sideIds: B.sides.map(s => s.id), coalition: Object.fromEntries(B.sides.map(s => [s.id, s.coalition || s.id])) };
  R.chain = P.chain(B, W);
  P.resolved[id] = R; return R;
};
/* The chain of command as one table (12 Nov 2026). Until now a corps and a division were labels on a unit, and who commanded one was
   worked out afresh wherever it was needed. Here every army, wing, corps and division of a battle is an entry:
     { id, kind: 'army' | 'wing' | 'corps' | 'division', side, parent, name, commander, units, parts }
   parent: what it answers to (a division's corps, a corps's army, or the wing a pack puts it under); commander: a leader's id, or null
   when the battle places nobody at its head; units: the bodies that start in it, in the order of battle's order (a corps's list
   includes its divisions' brigades; an army's own list is only the bodies that belong to no corps); parts: the entries directly
   under it. (They are not called formations here because the era packs use that word for line, column and square.)
   Made from what the packs already say: a unit's corps and division (the order of battle), each side's chief and corps0 (the battle),
   and the leaders the battle places. A leader commands the corps or division that carries his id (Reille commands "reille", Jérôme
   the division "jerome"). What that rule cannot know a battle states in its own chain block:
     chain: { guard: { commander: 'drouot' }, guardcav: { under: 'guard' },
              grouchy: { kind: 'wing', side: 'FR', name: "Grouchy's cavalry", commander: 'grouchy' }, pajol: { under: 'grouchy' } }
   An entry that block names and no unit belongs to (a wing) needs its side. Membership here is the start of the battle; a brigade
   sent to another corps by order changes its own corps, and the engine's unitsOf follows that.
   The table is plain data and changes nothing by itself: the validator holds the packs' other command tables to it, and
   node tools/oob.js chain <battle> prints it beside what the commanders' code works out today. */
P.chain = function (B, W) {
  const F = {}, given = B.chain || {}, sides = B.sides || [], sideOf = Object.fromEntries(sides.map(s => [s.id, s]));
  const X = B.command || {}, names = Object.assign({}, B.corpsNames, X.corpsName);
  const put = (id, kind, side, parent) => F[id] || (F[id] = { id, kind, side, parent, name: null, commander: null, units: [], parts: [] });
  for (const s of sides) { const a = put(s.id, 'army', s.id, null); a.name = s.name || null; a.commander = s.chief || null; }
  const enrol = (uid, side, corps, div) => {
    if (!sideOf[side]) return; // the validator reports a unit on a side the battle does not have
    const c = corps || sideOf[side].corps0 || null;
    if (c) put(c, 'corps', side, side).units.push(uid); else F[side].units.push(uid); // a body with no corps answers to the army itself
    if (div) put(div, 'division', side, c || side).units.push(uid);
  };
  for (const r of W.RAW || []) if (r[5] !== 'hq') enrol(r[0], r[1], (W.CORPS || {})[r[0]], (W.DIVISION || {})[r[0]]);
  for (const G of W.FORCES || []) for (const r of G.units || []) enrol(r[0], r[1], r[7], (W.DIVISION || {})[r[0]]);
  // the leaders a battle knows: those it places, and a commander off the map whom its command block describes (Waterloo's Grouchy)
  const leaderSide = {}; for (const l of B.leaders || []) leaderSide[l.id] = l.side;
  for (const [lid, o] of Object.entries(X.offmap || {})) if (o && o.leader && !leaderSide[lid]) leaderSide[lid] = X.side || (sides[0] || {}).id;
  // what the battle states: entries of its own (a wing), and the commander, parent, name or kind of any other
  for (const [fid, g] of Object.entries(given)) {
    const f = F[fid] || put(fid, g.kind || 'corps', g.side || leaderSide[g.commander] || null, null);
    if (g.kind) f.kind = g.kind; if (g.name) f.name = g.name; if (g.under) f.parent = g.under; else if (f.parent == null && f.kind !== 'army') f.parent = f.side;
    if ('commander' in g) f.commander = g.commander || null;
  }
  for (const f of Object.values(F)) {
    if (f.kind === 'army') continue;
    if (!f.name && names[f.id]) f.name = names[f.id];
    if (!(given[f.id] && 'commander' in given[f.id]) && leaderSide[f.id] === f.side) f.commander = f.id; // his own corps or division carries his id
  }
  for (const f of Object.values(F)) if (f.parent && F[f.parent]) F[f.parent].parts.push(f.id);
  return F;
};
// who a corps's orders reach it through: its own commander if he is one of those listed, else the nearest above it who is
// (a corps whose general is not written to answers through his wing's; one with no general at all through the army's)
P.chainUp = function (F, id, listed) {
  for (let f = F[id], n = 0; f && n < 20; f = F[f.parent], n++) if (f.commander && (!listed || listed.includes(f.commander))) return f.commander;
  return null;
};
/* (phase 4e) versions. Every pack carries version: 'major.minor', raised when its numbers change (minor) or its meaning does (major);
   a replay made with other versions may not fight the same battle. P.fingerprint hashes everything a battle resolves to (its own data,
   its era, nations and leaders, code in the pack included), so a pack edited without raising its version is caught as well. */
P.hash = function (x) { // FNV-1a, 32 bits, over a canonical JSON (typed arrays as arrays, functions by their source)
  const s = JSON.stringify(x, (k, v) => (v && v.buffer instanceof ArrayBuffer && typeof v.length === 'number') ? Array.from(v) : typeof v === 'function' ? 'fn:' + v.toString() : v);
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};
P.versions = function (id) {
  const R = P.battle(id), B = R.battle, era = P.eras[B.era], out = { battle: `${id} ${B.version || '?'}`, era: `${era.id} ${era.version || '?'}` };
  if (era.like) out.eraBase = `${era.like} ${(P.eras[era.like] || {}).version || '?'}`;
  out.nations = [...new Set(Object.values(P.nations).filter(b => b.nations && (B.nations || []).some(n => b.nations[n])).map(b => `${b.id} ${b.version || '?'}`))].sort().join(', ');
  out.leaders = [...new Set(Object.values(P.leaders).filter(b => b.people && (B.leaders || []).some(l => b.people[l.id])).map(b => `${b.id} ${b.version || '?'}`))].sort().join(', ');
  return out;
};
P.fingerprint = function (id) {
  const R = P.battle(id);
  return P.hash({ battle: R.battle, era: R.era, nations: R.nations, leaders: R.W.LEADERS, oob: R.battle.oob ? P.oobs[R.battle.oob] : null, terrain: R.battle.terrain ? P.maps[R.battle.terrain] : null });
};
if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);
