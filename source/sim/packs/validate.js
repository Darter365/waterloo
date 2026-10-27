/* The pack validator (engine roadmap, phase 1). Checks that a battle and everything it names (its era, nations and leaders) is
   complete and consistent before the engine runs it, so a mistake in a new or hand-edited battle file shows up as a plain message
   ("unit 'byng' stands 3.2 km outside the map") rather than as a strange battle.
     node packs/validate.js [battle id]        prints errors and warnings; exits 1 if there are errors
   In a page: WPacks.validate('waterloo') returns { errors, warnings, stats }.
   Errors are things the engine cannot run correctly with; warnings are things that are legal but unusual and worth a look. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('./all.js') : null);

// the arms the engine knows today (phase 2 replaces these with capabilities: fires, charges, garrisons, limbers ...)
const ARMS = ['inf', 'gar', 'cav', 'art', 'hq'];
const FORMS = ['line', 'twoLines', 'columns', 'garrison', 'battery', 'park', 'hq'];
const UNIT_EXTRA = ['F', 'R', 'nBn']; // optional per-unit overrides: frontage (m), radius of a garrison (m), battalions
const TRAITS = ['agg', 'ini', 'obe', 'skill', 'exp'];
// map keys every battle provides (G) or may provide (O); anything else in a battle's map is listed as battle-specific (phase 2 retires them)
const MAP_KEYS = {
  G: ['LAT0', 'LON0', 'MLAT', 'MLON', 'NX', 'NY', 'CELL', 'WM', 'HM', 'll2m', 'm2ll', 'H', 'RAW', 'STRONGPOINTS', 'OBJECTIVES', 'ROUTES', 'LEADERS'],
  O: ['LM', 'ROADS', 'SUNKEN', 'HEDGES', 'WOODS', 'BUILDINGS', 'ENCLOSURES', 'STREAMS', 'VILLAGES', 'HOUSES', 'LABELS', 'EDGE_LABELS', 'NAT', 'OFFMAP',
    'QUALITY', 'CALIBRE', 'CORPS', 'DIVISION', 'CHOKES', 'rng', 'hashStr'],
};

function validate(id) {
  const errors = [], warnings = [], E = (m) => errors.push(m), Wn = (m) => warnings.push(m);
  const num = (v) => typeof v === 'number' && isFinite(v);
  let R;
  try { R = P.battle(id); } catch (err) { return { errors: [String(err.message || err)], warnings, stats: {} }; }
  const B = R.battle, W = R.W, era = R.era;

  /* ----- the battle ----- */
  if (!B.name) E('the battle has no name');
  if (!/^\d{3,4}-\d\d-\d\d$/.test(B.date || '')) E(`date "${B.date}" is not YYYY-MM-DD`);
  for (const [n, v] of Object.entries(R.nations)) if (!v) E(`nation "${n}" is named by the battle but no loaded nation pack defines it`);
  const sides = B.sides || [], sideIds = new Set();
  if (sides.length < 2) E('a battle needs at least two sides');
  for (const s of sides) {
    if (!s.id) { E('a side has no id'); continue; }
    if (sideIds.has(s.id)) E(`side "${s.id}" is listed twice`); sideIds.add(s.id);
    if (!num(s.morale0) || s.morale0 <= 0 || s.morale0 > 100) E(`side ${s.id}: starting morale ${s.morale0} must be in 1-100`);
    if (!s.name) Wn(`side ${s.id} has no name`);
  }
  if (new Set(sides.map(s => s.coalition || s.id)).size < 2) E('every side is in the same coalition: nobody to fight');

  /* ----- daylight ----- */
  const L = B.light;
  if (!L) E('no light block (sunset, dark, end, visibility)');
  else {
    if (!(num(L.sunset) && num(L.dark) && num(L.end) && L.sunset <= L.dark && L.dark <= L.end)) E(`light: need sunset <= dark <= end (got ${L.sunset}, ${L.dark}, ${L.end})`);
    if (!Array.isArray(L.vis) || !L.vis.length) E('light: no visibility table');
    else for (let i = 0; i < L.vis.length; i++) {
      const [t, v] = L.vis[i];
      if (!num(t) || !num(v) || v <= 0) E(`light: visibility row ${i} is not [minute, metres > 0]`);
      if (i && t <= L.vis[i - 1][0]) E(`light: visibility rows must run forward in time (row ${i})`);
    }
    if (!num(L.visAfter) || L.visAfter <= 0) E('light: visAfter (visibility after the last row) must be > 0');
  }

  /* ----- the map ----- */
  for (const k of MAP_KEYS.G) if (W[k] == null) E(`map: "${k}" is missing`);
  const specific = Object.keys(W).filter(k => !MAP_KEYS.G.includes(k) && !MAP_KEYS.O.includes(k));
  if (specific.length) Wn(`map keys only this battle uses (the engine reads some by name; phase 2 retires them): ${specific.join(', ')}`);
  const { NX, NY, CELL, WM, HM } = W;
  for (const [c, r] of Object.entries(B.routeOf || {})) if (!W.ROUTES || !W.ROUTES[r]) E(`routeOf: corps ${c} is sent by route "${r}", which does not exist`);
  if (!(Number.isInteger(NX) && Number.isInteger(NY) && NX > 1 && NY > 1)) E(`map: grid ${NX} x ${NY} is not whole numbers > 1`);
  if (!(num(CELL) && CELL > 0)) E(`map: cell size ${CELL} must be > 0`);
  if (WM !== (NX - 1) * CELL || HM !== (NY - 1) * CELL) E(`map: WM, HM (${WM}, ${HM}) must be (NX-1, NY-1) x CELL = ${(NX - 1) * CELL}, ${(NY - 1) * CELL}`);
  if (W.H && W.H.length !== NX * NY) E(`map: height grid has ${W.H.length} cells, expected NX x NY = ${NX * NY}`);
  else if (W.H) { let bad = 0; for (let i = 0; i < W.H.length; i++) if (!num(W.H[i])) bad++; if (bad) E(`map: ${bad} height cells are not numbers`); }
  if (typeof W.ll2m !== 'function' || typeof W.m2ll !== 'function') E('map: ll2m and m2ll must be functions');
  else { const [x, y] = W.ll2m(...W.m2ll(WM / 2, HM / 2)); if (Math.hypot(x - WM / 2, y - HM / 2) > 0.01) E('map: m2ll and ll2m do not invert each other'); }
  const ll = typeof W.ll2m === 'function' ? W.ll2m : () => [NaN, NaN];
  // how far outside the map a [lat, lon] lies, in metres (0 inside)
  const outside = (p) => { if (!Array.isArray(p) || !num(p[0]) || !num(p[1])) return Infinity; const [x, y] = ll(p[0], p[1]); return Math.hypot(Math.max(0, -x, x - WM), Math.max(0, -y, y - HM)); };
  const where = (what, p, slack = 0) => { const d = outside(p); if (d === Infinity) E(`${what}: position ${JSON.stringify(p)} is not [lat, lon]`); else if (d > slack) E(`${what} stands ${(d / 1000).toFixed(1)} km outside the map`); };

  /* ----- order of battle ----- */
  const units = {}, natUsed = new Set();
  const unit = (list, r, n, kind) => {
    const [uid, side, name, parent, nat, type, str] = r;
    const what = `${list} row ${n} (${uid})`;
    if (typeof uid !== 'string' || !uid) { E(`${list} row ${n}: no id`); return; }
    if (units[uid]) E(`unit id "${uid}" is used twice (${units[uid].list} and ${list})`);
    units[uid] = { list, side, nat, type, str, kind, corps: kind === 'field' ? null : r[7] };
    if (!sideIds.has(side)) E(`${what}: side "${side}" is not one of the battle's sides`);
    if (!name) Wn(`${what}: no name`);
    if (!(nat in R.nations)) E(`${what}: nation "${nat}" is not in the battle's nations list`); natUsed.add(nat);
    if (!ARMS.includes(type)) E(`${what}: arm "${type}" is not one the engine knows (${ARMS.join(', ')})`);
    if (type !== 'hq' && (!num(str) || str <= 0)) E(`${what}: strength ${str} must be > 0`);
    if (type === 'art' && str > 100) Wn(`${what}: ${str} guns in one battery is a lot (artillery strength counts guns)`);
    if (type !== 'art' && type !== 'hq' && str < 50) Wn(`${what}: ${str} men is very small for a formed body`);
  };
  (W.RAW || []).forEach((r, n) => {
    if (!Array.isArray(r) || r.length < 13 || r.length > 14) { E(`RAW row ${n}: expected 13 or 14 fields, got ${Array.isArray(r) ? r.length : typeof r}`); return; }
    unit('RAW', r, n, 'field');
    const [uid, , , , , type, , la, lo, facing, form, conf, , extra] = r;
    where(`unit '${uid}'`, [la, lo]);
    if (!num(facing) || facing < 0 || facing >= 360) E(`unit '${uid}': facing ${facing} must be 0-359 degrees`);
    if (!FORMS.includes(form)) E(`unit '${uid}': formation "${form}" is not one of ${FORMS.join(', ')}`);
    if (!num(conf) || conf < 0) E(`unit '${uid}': position uncertainty ${conf} must be metres >= 0`);
    if (type === 'gar' && form !== 'garrison') Wn(`unit '${uid}' is a garrison but stands in "${form}"`);
    if (extra != null) for (const k of Object.keys(extra)) if (!UNIT_EXTRA.includes(k)) E(`unit '${uid}': unknown override "${k}" (known: ${UNIT_EXTRA.join(', ')})`);
  });
  for (const [list, kind] of [['PRUSSIANS', 'expected'], ['HAL_FORCE', 'detached'], ['GROUCHY_FORCE', 'detached']]) (W[list] || []).forEach((r, n) => {
    if (!Array.isArray(r) || r.length !== 10) { E(`${list} row ${n}: expected 10 fields, got ${Array.isArray(r) ? r.length : typeof r}`); return; }
    unit(list, r, n, kind);
    const [uid, , , , , , , route, q, arrive] = r;
    // the eighth field is the force's corps; it marches by the route of that name, or by the one the battle's routeOf names for it
    const road = (B.routeOf || {})[route] || route;
    if (!W.ROUTES || !W.ROUTES[road]) E(`${list} '${uid}': corps "${route}" has no route (no ROUTES.${road}${road !== route ? '' : ', and no routeOf entry'})`);
    if (!num(q) || q <= 0 || q > 1.5) E(`${list} '${uid}': quality ${q} must be in (0, 1.5]`);
    if (!num(arrive) || arrive < 0) E(`${list} '${uid}': arrival offset ${arrive} must be minutes >= 0`);
  });
  (W.HORSE_BATTERIES || []).forEach((r, n) => {
    if (!Array.isArray(r) || r.length !== 10) { E(`HORSE_BATTERIES row ${n}: expected 10 fields`); return; }
    unit('HORSE_BATTERIES', r, n, 'field');
    if (r[5] !== 'art') E(`HORSE_BATTERIES '${r[0]}' is not artillery`);
    where(`battery '${r[0]}'`, [r[7], r[8]]);
  });
  for (const k of ['QUALITY', 'CALIBRE', 'CORPS', 'DIVISION']) for (const [uid, v] of Object.entries(W[k] || {})) {
    if (!units[uid]) { E(`${k}: "${uid}" is not a unit`); continue; }
    if (k === 'QUALITY' && (!num(v) || v <= 0 || v > 1.5)) E(`QUALITY '${uid}': ${v} must be in (0, 1.5]`);
    if (k === 'CALIBRE' && (units[uid].type !== 'art' || !num(v) || v <= 0)) E(`CALIBRE '${uid}': only batteries have a calibre, in pounds > 0`);
  }
  for (const n of Object.keys(R.nations)) if (!natUsed.has(n)) Wn(`nation "${n}" is listed but no unit uses it`);
  for (const s of sideIds) if (!Object.values(units).some(u => u.side === s && u.type !== 'hq')) E(`side ${s} has no units`);

  /* ----- places ----- */
  const sps = new Set();
  for (const sp of W.STRONGPOINTS || []) {
    if (!sp.id || sps.has(sp.id)) E(`strongpoint "${sp.id}": missing or repeated id`); sps.add(sp.id);
    if (!sp.sections || !sp.sections.length) { E(`strongpoint ${sp.id}: no sections`); continue; }
    sp.sections.forEach((s, i) => {
      where(`strongpoint ${sp.id} section ${i} (${s.name})`, s.at);
      if (!num(s.r) || s.r <= 0) E(`strongpoint ${sp.id} section ${s.name}: radius must be > 0`);
      if (!num(s.cover) || s.cover < 0 || s.cover > 1) E(`strongpoint ${sp.id} section ${s.name}: cover ${s.cover} must be 0-1`);
      if (!num(s.cap) || s.cap <= 0) E(`strongpoint ${sp.id} section ${s.name}: capacity must be > 0`);
    });
    for (const p of sp.access || []) where(`strongpoint ${sp.id} access point`, p, 500);
  }
  for (const [k, o] of Object.entries(W.OBJECTIVES || {})) {
    if (!o.name) E(`objective ${k}: no name`);
    const n = (o.sp ? 1 : 0) + (o.point ? 1 : 0) + (o.line ? 1 : 0);
    if (n !== 1) E(`objective ${k}: needs exactly one of sp, point, line`);
    if (o.sp && !sps.has(o.sp)) E(`objective ${k}: strongpoint "${o.sp}" does not exist`);
    if (o.point) where(`objective ${k}`, o.point, 300);
    if (o.line) { if (o.line.length !== 2) E(`objective ${k}: a line is two points`); else o.line.forEach(p => where(`objective ${k}`, p, 300)); }
  }
  for (const [k, r] of Object.entries(W.ROUTES || {})) {
    if (!Array.isArray(r) || r.length < 2) { E(`route ${k}: needs at least two points`); continue; }
    r.forEach((p, i) => { const d = outside(p); if (d === Infinity) E(`route ${k} point ${i}: not [lat, lon]`); else if (d > 4000) Wn(`route ${k} point ${i} is ${(d / 1000).toFixed(1)} km off the map (routes may start off it)`); });
  }
  for (const c of W.CHOKES || []) { where(`choke ${c.id}`, c.at); if (!num(c.rate) || c.rate <= 0) E(`choke ${c.id}: rate (men a minute) must be > 0`); }

  /* ----- leaders ----- */
  const placed = new Set();
  for (const pl of B.leaders || []) {
    if (placed.has(pl.id)) E(`leader ${pl.id} is placed twice`); placed.add(pl.id);
    const p = P.leader(pl.id);
    if (!p) { E(`leader "${pl.id}" is placed but no leader pack holds him`); continue; }
    if (!sideIds.has(pl.side)) E(`leader ${pl.id}: side "${pl.side}" is not one of the battle's sides`);
    // a leader stands somewhere, rides with a unit, or (neither) arrives with his corps from off the map
    if ([pl.at, pl.unit, pl.corps].filter(Boolean).length > 1) E(`leader ${pl.id}: give one of at (where he stands), unit (whom he rides with) or corps (whose head he arrives with)`);
    if (pl.corps && !Object.values(units).some(u => u.corps === pl.corps)) E(`leader ${pl.id}: no off-map force belongs to corps "${pl.corps}"`);
    if (!pl.at && !pl.unit && !Object.values(units).some(u => u.side === pl.side && u.kind !== 'field')) E(`leader ${pl.id} has no place, and his side has no force coming onto the map for him to arrive with`);
    if (pl.at) where(`leader ${pl.id}`, pl.at);
    if (pl.unit && !units[pl.unit]) E(`leader ${pl.id}: unit "${pl.unit}" does not exist`);
    if (pl.unit && units[pl.unit] && units[pl.unit].side !== pl.side) E(`leader ${pl.id} rides with ${pl.unit}, which is on the other side`);
    for (const t of TRAITS) if (!num(p.traits && p.traits[t]) || p.traits[t] < 0 || p.traits[t] > 1) E(`leader ${pl.id}: trait ${t} must be 0-1`);
    if (![1, 2, 3].includes(p.rank)) E(`leader ${pl.id}: rank ${p.rank} must be 1 (division), 2 (corps or wing) or 3 (army)`);
  }
  for (const s of sideIds) if (!(B.leaders || []).some(pl => pl.side === s && (P.leader(pl.id) || {}).rank === 3)) Wn(`side ${s} has no army commander (rank 3)`);

  /* ----- the era ----- */
  if (!era.K) E(`era ${era.id}: no K constants`);
  else for (const [k, v] of Object.entries(era.K)) if (!num(v)) E(`era ${era.id}: K.${k} is not a number`);
  const table = (name, t, mono) => {
    if (!Array.isArray(t) || !t.length) { E(`era ${era.id}: ${name} is empty`); return; }
    for (let i = 0; i < t.length; i++) {
      if (!num(t[i][0]) || !num(t[i][1])) E(`era ${era.id}: ${name} row ${i} is not [number, number]`);
      if (i && t[i][0] <= t[i - 1][0]) E(`era ${era.id}: ${name} must run in increasing order (row ${i})`);
      if (mono && i && t[i][1] > t[i - 1][1]) E(`era ${era.id}: ${name} must not rise with range (row ${i})`);
    }
  };
  table('hit', era.hit, true);
  if (era.hit) for (const [, p] of era.hit) if (p < 0 || p > 1) E(`era ${era.id}: hit chances must be 0-1`);
  if (era.roundshot) { table('roundshot.bands', era.roundshot.bands, true); table('roundshot.calibre', [...era.roundshot.calibre].reverse(), false); }
  else E(`era ${era.id}: no roundshot table`);
  if (era.canister) { table('canister.curve', era.canister.curve, true); if (!num(era.canister.floor) || !num(era.canister.reachElse)) E(`era ${era.id}: canister needs floor and reachElse`); }
  else E(`era ${era.id}: no canister table`);
  if (!num(era.crew) || era.crew <= 0) E(`era ${era.id}: crew per gun must be > 0`);
  for (const k of ['fireShare', 'density', 'mass']) {
    if (!era[k]) { E(`era ${era.id}: no ${k} table`); continue; }
    for (const [f, v] of Object.entries(era[k])) if (!num(v) || v < 0) E(`era ${era.id}: ${k}.${f} must be a number >= 0`);
  }
  for (const f of ['line', 'columns', 'square', 'road']) if (era.fireShare && !(f in era.fireShare)) E(`era ${era.id}: fireShare has no "${f}"`);

  /* ----- nations ----- */
  for (const [n, v] of Object.entries(R.nations)) if (v) {
    if (!Number.isInteger(v.ranks) || v.ranks < 1 || v.ranks > 6) E(`nation ${n}: ranks ${v.ranks} must be 1-6`);
    if (!num(v.battalion) || v.battalion <= 0) E(`nation ${n}: battalion size must be > 0`);
  }

  const stats = { units: Object.keys(units).length, leaders: placed.size, strongpoints: sps.size, objectives: Object.keys(W.OBJECTIVES || {}).length, routes: Object.keys(W.ROUTES || {}).length, sides: sideIds.size };
  return { errors, warnings, stats };
}
P.validate = validate;
if (typeof module !== 'undefined' && module.exports) module.exports = validate;
if (typeof require === 'function' && typeof module !== 'undefined' && require.main === module) {
  const id = process.argv[2] || 'waterloo', r = validate(id);
  console.log(`${id}: ${Object.entries(r.stats).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  for (const m of r.errors) console.log('ERROR   ' + m);
  for (const m of r.warnings) console.log('warning ' + m);
  console.log(`${r.errors.length} errors, ${r.warnings.length} warnings`);
  process.exit(r.errors.length ? 1 : 0);
}
})(typeof globalThis !== 'undefined' ? globalThis : this);
