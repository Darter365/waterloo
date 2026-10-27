/* The pack validator (engine roadmap, phase 1). Checks that a battle and everything it names (its era, nations and leaders) is
   complete and consistent before the engine runs it, so a mistake in a new or hand-edited battle file shows up as a plain message
   ("unit 'byng' stands 3.2 km outside the map") rather than as a strange battle.
     node packs/validate.js [battle id]        prints errors and warnings; exits 1 if there are errors
   In a page: WPacks.validate('waterloo') returns { errors, warnings, stats }.
   Errors are things the engine cannot run correctly with; warnings are things that are legal but unusual and worth a look. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('./all.js') : null);

// an order of battle names a unit's arm from its era's arms table, or 'gar' (foot holding a place at the start) or 'hq' (a marker)
const UNIT_EXTRA = ['F', 'R', 'nBn']; // optional per-unit overrides: frontage (m), radius of a garrison (m), battalions
const TRAITS = ['agg', 'ini', 'obe', 'skill', 'exp'];
// map keys every battle provides (G) or may provide (O); anything else in a battle's map is listed as battle-specific (phase 2 retires them)
const MAP_KEYS = {
  G: ['LAT0', 'LON0', 'MLAT', 'MLON', 'NX', 'NY', 'CELL', 'WM', 'HM', 'll2m', 'm2ll', 'H', 'RAW', 'STRONGPOINTS', 'OBJECTIVES', 'ROUTES', 'LEADERS'],
  O: ['LM', 'ROADS', 'SUNKEN', 'HEDGES', 'WOODS', 'BUILDINGS', 'ENCLOSURES', 'STREAMS', 'VILLAGES', 'HOUSES', 'LABELS', 'EDGE_LABELS', 'NAT', 'OFFMAP',
    'QUALITY', 'CALIBRE', 'CORPS', 'DIVISION', 'CHOKES', 'rng', 'hashStr', 'TRAITS', 'FORCES', 'OBSTACLES'],
};

function validate(id) {
  const errors = [], warnings = [], E = (m) => errors.push(m), Wn = (m) => warnings.push(m);
  const num = (v) => typeof v === 'number' && isFinite(v);
  let R;
  try { R = P.battle(id); } catch (err) { return { errors: [String(err.message || err)], warnings, stats: {} }; }
  const B = R.battle, W = R.W, era = R.era;
  const ARMS = [...Object.keys(era.arms || {}), 'gar', 'hq'], FORMS = [...Object.keys(era.formations || {}), 'hq'];

  /* ----- the battle ----- */
  if (!B.name) E('the battle has no name');
  if (!/^-?\d{1,4}-\d\d-\d\d$/.test(B.date || '')) E(`date "${B.date}" is not YYYY-MM-DD (the sun's light is computed from it)`);
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

  /* ----- the weather's visibility (the light itself is computed from the date and the place) ----- */
  const VIS = (B.weather || {}).vis;
  if (!Array.isArray(VIS) || !VIS.length) E('weather: no visibility table (vis: [[minute, metres], ...])');
  else for (let i = 0; i < VIS.length; i++) {
    const [t, v] = VIS[i];
    if (!num(t) || !num(v) || v <= 0) E(`weather: visibility row ${i} is not [minute, metres > 0]`);
    if (i && t <= VIS[i - 1][0]) E(`weather: visibility rows must run forward in time (row ${i})`);
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
  const forces = W.FORCES || [];
  forces.forEach((F, i) => { if (!F.group) E(`FORCES ${i}: no group name`); if (!Array.isArray(F.units)) E(`FORCES ${F.group}: no units`); if (F.fatigue0 != null && !(num(F.fatigue0) && F.fatigue0 >= 0 && F.fatigue0 <= 100)) E(`FORCES ${F.group}: fatigue0 must be 0-100`); });
  for (const F of forces) { const list = 'FORCES ' + F.group, kind = F.marches ? 'expected' : 'detached'; (F.units || []).forEach((r, n) => {
    if (!Array.isArray(r) || r.length !== 10) { E(`${list} row ${n}: expected 10 fields, got ${Array.isArray(r) ? r.length : typeof r}`); return; }
    unit(list, r, n, kind);
    const [uid, , , , , , , route, q, arrive] = r;
    // the eighth field is the force's corps; it marches by the route of that name, or by the one the battle's routeOf names for it
    const road = (B.routeOf || {})[route] || route;
    if (!W.ROUTES || !W.ROUTES[road]) E(`${list} '${uid}': corps "${route}" has no route (no ROUTES.${road}${road !== route ? '' : ', and no routeOf entry'})`);
    if (!num(q) || q <= 0 || q > 1.5) E(`${list} '${uid}': quality ${q} must be in (0, 1.5]`);
    if (!num(arrive) || arrive < 0) E(`${list} '${uid}': arrival offset ${arrive} must be minutes >= 0`);
  }); }
  for (const k of ['QUALITY', 'CALIBRE', 'CORPS', 'DIVISION']) for (const [uid, v] of Object.entries(W[k] || {})) {
    if (!units[uid]) { E(`${k}: "${uid}" is not a unit`); continue; }
    if (k === 'QUALITY' && (!num(v) || v <= 0 || v > 1.5)) E(`QUALITY '${uid}': ${v} must be in (0, 1.5]`);
    if (k === 'CALIBRE' && (units[uid].type !== 'art' || !num(v) || v <= 0)) E(`CALIBRE '${uid}': only batteries have a calibre, in pounds > 0`);
  }
  // unit traits (phase 2): what a unit is beyond its arm
  // a trait some arms only can have: horse artillery is guns (a crew); a kind is the weight of a charge (an arm with shock)
  const TRAIT_KEYS = { horse: a => a.crew, kind: a => a.shock, guard: null, weapon: null, ammo: null, ammo0: null, prestige: null };
  for (const [uid, tr] of Object.entries(W.TRAITS || {})) {
    const u = units[uid]; if (!u) { E(`TRAITS: "${uid}" is not a unit`); continue; }
    for (const [k, v] of Object.entries(tr)) {
      if (!(k in TRAIT_KEYS)) { E(`TRAITS ${uid}: unknown trait "${k}" (known: ${Object.keys(TRAIT_KEYS).join(', ')})`); continue; }
      const arm = (era.arms || {})[u.type === 'gar' ? Object.keys(era.arms || {}).find(x => era.arms[x].holds) : u.type];
      if (TRAIT_KEYS[k] && !(arm && TRAIT_KEYS[k](arm))) E(`TRAITS ${uid}: "${k}" is not a trait its arm (${u.type}) can have`);
      if (k === 'kind' && arm && arm.shock && !(v in arm.shock)) E(`TRAITS ${uid}: kind "${v}" must be one of ${Object.keys(arm.shock).join(', ')}`);
      if (k === 'weapon' && !(era.weapons || {})[v]) E(`TRAITS ${uid}: weapon "${v}" is not one the era knows`);
      if (k === 'ammo0' && !(num(v) && v >= 0)) E(`TRAITS ${uid}: ammo0 must be cartridges >= 0`);
      if (k === 'prestige' && !(num(v) && v > 0 && v <= 50)) E(`TRAITS ${uid}: prestige must be 1-50 (morale points)`);
    }
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
  for (const [i, o] of (W.OBSTACLES || []).entries()) {
    if (!(era.obstacles || {})[o.kind]) E(`obstacle ${i}: kind "${o.kind}" is not one the era knows (${Object.keys(era.obstacles || {}).join(', ') || 'none'})`);
    if (!Array.isArray(o.pts) || o.pts.length < 2) E(`obstacle ${i}: a line needs at least two points`); else o.pts.forEach(p => where(`obstacle ${i} (${o.kind})`, p, 100));
  }
  for (const c of W.CHOKES || []) { where(`choke ${c.id}`, c.at); if (!num(c.rate) || c.rate <= 0) E(`choke ${c.id}: rate (men a minute) must be > 0`); }

  /* ----- each army's settings, the starts and the weather (phase 2) ----- */
  for (const sd of sides) {
    if (sd.rear && !['N', 'S', 'E', 'W'].includes(sd.rear)) E(`side ${sd.id}: rear "${sd.rear}" must be N, S, E or W`);
    if (!sd.rear || !sd.retreat) E(`side ${sd.id}: needs rear (the edge it falls back to) and retreat (the route it runs by)`);
    if (sd.retreat && !(W.ROUTES || {})[sd.retreat]) E(`side ${sd.id}: retreat route "${sd.retreat}" does not exist`);
    for (const k of ['chief', 'cavChief']) if (sd[k] && !(B.leaders || []).some(pl => pl.id === sd[k])) E(`side ${sd.id}: ${k} "${sd[k]}" is not a placed leader`);
    for (const k of ['exit', 'rearguard']) if (sd[k]) where(`side ${sd.id} ${k}`, sd[k], 500);
    if (sd.fatigue0 != null && !(num(sd.fatigue0) && sd.fatigue0 >= 0 && sd.fatigue0 <= 100)) E(`side ${sd.id}: fatigue0 must be 0-100`);
    for (const [kind, w] of Object.entries(sd.wagons || {})) {
      if (!(num(w.near) && num(w.far) && w.near >= 0 && w.far >= 0 && w.near + w.far <= 1)) E(`side ${sd.id}: wagon ${kind}: near and far are chances that add to at most 1`);
      if (w.far > 0 && !num(w.farFrom)) E(`side ${sd.id}: wagon ${kind}: a far wagon needs farFrom (the minute it can be reached)`);
      if (!w.says || !w.says.near || !w.says.far || !w.says.lost || !w.short) E(`side ${sd.id}: wagon ${kind}: needs says (near, far, lost) and short texts`);
    }
  }
  const starts = B.starts || {};
  if (!Object.keys(starts).length) E('the battle has no starts (each a clock time and ground)');
  for (const [k, st] of Object.entries(starts)) {
    if (!num(st.t) || st.t < 0 || st.t >= 24 * 60) E(`start ${k}: t must be minutes after midnight`);
    if (!num(st.wet0) || st.wet0 < 0 || st.wet0 > 1) E(`start ${k}: wet0 must be 0-1`);
    if (st.dryFrom != null && !(num(st.dryFrom) && st.dryFrom >= st.t)) E(`start ${k}: dryFrom must be at or after the start`);
    if ((st.back || st.come) && !sideIds.has(st.side)) E(`start ${k}: side "${st.side}" is not one of the battle's sides`);
    for (const b of st.back || []) { for (const c of b.corps || []) if (!Object.values(W.CORPS || {}).includes(c)) E(`start ${k}: no unit belongs to corps "${c}"`); for (const id of b.units || []) if (!units[id]) E(`start ${k}: unit "${id}" does not exist`); if (!num(b.dy)) E(`start ${k}: each body held back needs dy (metres)`); }
    const C = st.come; if (C) {
      if (!C.route) E(`start ${k}: the brigades coming up need a route name`);
      const vr = (W.ROUTES || {})[C.via && C.via[0]]; if (!vr) E(`start ${k}: via route "${C.via && C.via[0]}" does not exist`); else for (const i of C.via.slice(1)) if (!vr[i]) E(`start ${k}: via route ${C.via[0]} has no point ${i}`);
      for (const [t0, ids] of C.columns || []) { if (!num(t0)) E(`start ${k}: a column's time must be minutes`); for (const id of ids) { if (!units[id]) E(`start ${k}: unit "${id}" does not exist`); else if (units[id].side !== st.side) E(`start ${k}: ${id} is not on side ${st.side}`); } }
    }
  }
  // (phase 2) turning points, valued places and lines
  const WHEN = ['taken', 'fires', 'near', 'prestige', 'line'], mids = new Set();
  for (const m of B.metrics || []) {
    if (!m.id || mids.has(m.id)) E(`metric "${m.id}": missing or repeated id`); mids.add(m.id);
    if (!WHEN.includes(m.when)) { E(`metric ${m.id}: when "${m.when}" must be one of ${WHEN.join(', ')}`); continue; }
    if ((m.when === 'taken' || m.when === 'near') && !(W.STRONGPOINTS || []).some(sp => sp.id === m.place)) E(`metric ${m.id}: place "${m.place}" is not a strongpoint`);
    if (m.when === 'taken' && !new Set(sides.map(x => x.coalition || x.id)).has(m.by)) E(`metric ${m.id}: by "${m.by}" is not a coalition`);
    if (m.when === 'line' && !((W.OBJECTIVES || {})[m.line] || {}).line) E(`metric ${m.id}: line "${m.line}" is not an objective with a line`);
    if ((m.when === 'fires' || m.when === 'near') && !m.side && !m.corps) E(`metric ${m.id}: needs a side or a corps`);
    if (m.side && !sideIds.has(m.side)) E(`metric ${m.id}: side "${m.side}" is not one of the battle's sides`);
    if (m.after && !(B.metrics || []).some(x => x.id === m.after)) E(`metric ${m.id}: after "${m.after}" is not a metric`);
  }
  for (const sp of W.STRONGPOINTS || []) if (sp.value != null && !(num(sp.value) && sp.value >= 0)) E(`strongpoint ${sp.id}: value must be >= 0`);
  for (const [k, o] of Object.entries(W.OBJECTIVES || {})) if (o.value) {
    if (!o.line) E(`objective ${k}: only a line can carry a value (places carry theirs on the strongpoint)`);
    if (!new Set(sides.map(x => x.coalition || x.id)).has(o.holder)) E(`objective ${k}: holder "${o.holder}" is not a coalition (who holds it at the start)`);
  }
  const wx = B.weather || {};
  if (wx.cohesion0 != null && !num(wx.cohesion0)) E('weather: cohesion0 must be a number');
  if (wx.humidFrom != null && !num(wx.humidFrom)) E('weather: humidFrom must be minutes after midnight');

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
  const guns = Object.values(era.arms || {}).some(a => a.crew);
  if (era.roundshot) { table('roundshot.bands', era.roundshot.bands, true); table('roundshot.calibre', [...era.roundshot.calibre].reverse(), false); }
  else if (guns) E(`era ${era.id}: no roundshot table`);
  if (era.canister) { table('canister.curve', era.canister.curve, true); if (!num(era.canister.floor) || !num(era.canister.reachElse)) E(`era ${era.id}: canister needs floor and reachElse`); }
  else if (guns) E(`era ${era.id}: no canister table`);
  if (guns && (!num(era.crew) || era.crew <= 0)) E(`era ${era.id}: crew per gun must be > 0`);
  for (const [k, o] of Object.entries(era.obstacles || {})) { if (!o.cross || typeof o.cross !== 'object') E(`era ${era.id}: obstacle ${k} needs cross (pace kept by how a body moves)`); for (const f of ['cover', 'melee', 'horse', 'disorder']) if (o[f] != null && !num(o[f])) E(`era ${era.id}: obstacle ${k}.${f} must be a number`); }
  if (era.fieldwork && !(era.obstacles || {})[era.fieldwork.kind]) E(`era ${era.id}: fieldworks are "${era.fieldwork.kind}", which is not an obstacle kind`);
  if (era.K && era.K.MELEE_LOCK) for (const k of ['MELEE_KILL', 'MELEE_COH', 'MAN_FRONT']) if (!num(era.K[k])) E(`era ${era.id}: a lasting melee needs K.${k}`);
  // (phase 2) arms, formations, movement, weapons
  const F_ = era.formations || {}, MV = era.movement || {}, WP = era.weapons || {}, AR = era.arms || {};
  if (!Object.keys(F_).length) E(`era ${era.id}: no formations table`);
  for (const [f, row] of Object.entries(F_)) {
    for (const k of ['fire', 'density', 'mass', 'speed', 'pace', 'vsHorse', 'meleeD', 'lane', 'ticks', 'fromTicks']) if (row[k] != null && !(num(row[k]) && row[k] >= 0)) E(`era ${era.id}: formation ${f}.${k} must be a number >= 0`);
    if (row.fire != null && row.fire > 1) E(`era ${era.id}: formation ${f}: fire is a share of the men, 0-1`);
    if (row.breaksTo && !F_[row.breaksTo]) E(`era ${era.id}: formation ${f} breaks to "${row.breaksTo}", which is not a formation`);
    if (row.toTicks) table(`formation ${f}.toTicks`, [...row.toTicks].reverse(), false);
  }
  if (Object.values(F_).filter(r => r.allRound).length > 1) E(`era ${era.id}: more than one all-round formation`);
  const DIMOF = ['men', 'files', 'bns', 'pairs'];
  const dimOk = (d, what) => { if (num(d)) return; if (!d || typeof d !== 'object' || !DIMOF.includes(d.of)) { E(`era ${era.id}: ${what} must be a number or { of: ${DIMOF.join('|')}, ... }`); return; } for (const m of d.mul || []) if (!num(m)) E(`era ${era.id}: ${what}.mul must be numbers`); if (d.steps && !num(d.else)) E(`era ${era.id}: ${what}: steps need an else`); };
  for (const [a, arm] of Object.entries(AR)) {
    if (!MV[arm.move]) E(`era ${era.id}: arm ${a} moves as "${arm.move}", which is not in the movement table`);
    if (!arm.speed || !num(arm.speed.walk)) E(`era ${era.id}: arm ${a} needs speed.walk (m a minute)`);
    if (!num(arm.height) || arm.height <= 0) E(`era ${era.id}: arm ${a} needs a height (m)`);
    if (!F_[arm.column]) E(`era ${era.id}: arm ${a} marches in "${arm.column}", which is not a formation`);
    if (arm.deploys && !F_[arm.deploys]) E(`era ${era.id}: arm ${a} deploys into "${arm.deploys}", which is not a formation`);
    if (arm.weapon && !WP[arm.weapon]) E(`era ${era.id}: arm ${a} carries "${arm.weapon}", which is not a weapon`);
    if (!num(arm.flee)) E(`era ${era.id}: arm ${a} needs flee (how much faster it runs when broken)`);
    if (!arm.shapes || !arm.shapes._) E(`era ${era.id}: arm ${a} needs shapes, with a default (_)`);
    else for (const [f, sh] of Object.entries(arm.shapes)) { if (f !== '_' && !F_[f]) E(`era ${era.id}: arm ${a} has a shape for "${f}", which is not a formation`); dimOk(sh.F, `arm ${a} shape ${f}.F`); dimOk(sh.D, `arm ${a} shape ${f}.D`); }
  }
  if (!Object.values(AR).some(a => a.holds)) E(`era ${era.id}: no arm can hold a place (holds)`);
  for (const [m, row] of Object.entries(MV)) {
    if (!num(row.wet) || row.wet < 0 || row.wet > 1) E(`era ${era.id}: movement ${m}.wet must be 0-1`);
    for (const [t, v] of Object.entries(row)) if (t !== 'wet' && !(num(v) || (Array.isArray(v) && (v[1] === 'wet' ? num(v[0]) : v.length === 3 && v.every(num))))) E(`era ${era.id}: movement ${m}.${t} must be a number, [k, 'wet'] or [a, b, c]`);
  }
  for (const [w, row] of Object.entries(WP)) {
    const missile = row.rate != null || row.rateByCal; if (missile && (!num(row.reach) || row.reach <= 0)) E(`era ${era.id}: weapon ${w} fires, so needs a reach (m)`);
    if (!missile && !row.melee) E(`era ${era.id}: weapon ${w} neither fires (rate) nor fights hand to hand (melee)`);
    if (row.melee && !(num(row.melee.power) && row.melee.power > 0)) E(`era ${era.id}: weapon ${w}: melee needs a power > 0`);
    if (row.arc != null && !(num(row.arc) && row.arc > 0 && row.arc <= 180)) E(`era ${era.id}: weapon ${w}: arc must be 0-180 degrees`);
    if (row.longHit && !(num(row.longHit.beyond) && num(row.longHit.mul))) E(`era ${era.id}: weapon ${w}: longHit needs beyond and mul`);
  }
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
