/* The perception layer and the event stream (engine roadmap, B2): the one contract between the sim and whatever draws it.
   A client (the 2D map today, a 3D headquarters later) needs nothing else from the engine:

     const V = WView.install(E);
     V.world()            the ground, once: heights, roads, woods, buildings, places (never changes during a battle); and what the
                          era's arms and formations are, as capabilities (does it ride, is it a crew, does it face all round)
     V.snapshot('chief')  what the player's commander believes right now: his own brigades as last reported, the enemy as last
                          seen, who he thinks holds each place, what he hears, the orders he has given as far as he knows;
                          where he stands (at) and the telescope he carries (glass: its power and its field, from the packs)
     V.snapshot('truth')  the umpire's picture: every brigade where it really is (the umpire's map, replays, the end of the battle)
                          every snapshot carries the light: the sun's height and bearing, how far the day lets a man see
                          (the weather's haze included), whether the air has turned damp, the wind and the wet of the ground
     V.watch('chief')     start collecting timed events for that viewer ('truth' as well, or instead)
     V.drain('chief', n)  the events with seq > n: guns firing, volleys, charges, lines breaking, places changing hands, dispatches
     V.why(ref)           the chain of causes behind a log entry (umpire's knowledge: shown only on the umpire's map and afterwards)
     V.losses(id, t, m)   what fire cost a unit in the m minutes before t, and from whom (umpire's knowledge, as above)

   For measuring the core loop (tools/loop.js, docs/METHOD.md section 5) the snapshots also carry, as plain values:
     chief  each order's objective as he wrote it, how many conditions it has, and the staff's estimate of when it will arrive and
            be acted on (the order form's own ranges); each dispatch, and its event, says whether the staff starred it as news
     truth  every order with the minute its rider was due to leave and the minutes it was really received and acted on, and its status; and beside each unit whether
            it is a crewed arm (its strength counts guns, not men) and the opaque key the commander's picture uses for it, if
            he has one, so that belief can be set against truth

   Rules the contract keeps (tools/test_view.js checks each):
   - Plain data. Everything returned survives JSON.stringify and shares no object with the engine.
   - No dice. Looking never changes the battle: a battle watched every tick ends on the same state hash as one never watched.
   - Fog is kept. A 'chief' snapshot is built only from the commander's belief record, and a 'chief' event carries a position only
     if it could be seen from where he stands; one he can only hear carries a bearing, a loudness and a delay, and nothing else.
     Enemy bodies are named by an opaque key, never by the unit's real id.
   Values marked (est.) are mine. */
(function (root) {
'use strict';
const hyp = Math.hypot, D2R = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const bearing = (dx, dy) => (Math.atan2(dx, -dy) / D2R + 360) % 360;
const r1 = v => Math.round(v * 10) / 10;
const VERSION = 1;
const TICK_MIN = 2;
const P = {
  SOUND_MPS: 340,                 // the bang trails the flash by distance / 340 m a second (physics)
  HEAR: { cannon: 12000, volley: 4000, charge: 1500, melee: 1200 }, // (est.) metres each kind of noise carries
  EYE: 2.5,                       // the engine's own eye height for a mounted officer
  RIDER_SEEN: 800,                // (est.) a rider coming in is noticed this far from headquarters
  KEEP: 6000,                     // events kept per viewer; older ones are dropped (a client drains far more often)
};
// a repeatable number in [0, 1) from a name and a tick: spreads a tick's events over its two minutes without touching the dice
function spread(name, tick) { let h = 2166136261 ^ tick; for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
const plain = x => JSON.parse(JSON.stringify(x));

// where the sun stands, by the same approximation the engine uses for its height (NOAA's; local mean time): height and bearing in
// degrees, the bearing clockwise from north
function sunPos(date, lat, lon, tLMT) {
  const [Y, Mo, D] = date.split('-').map(Number), leap = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0;
  const n = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][Mo - 1] + D + (leap && Mo > 2 ? 1 : 0), utc = tLMT - 4 * lon;
  const g = 2 * Math.PI / (leap ? 366 : 365) * (n - 1 + (utc / 60 - 12) / 24);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = ((tLMT + eq) / 4 - 180) * D2R, phi = lat * D2R, sa = clamp(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha), -1, 1), alt = Math.asin(sa);
  let az = Math.acos(clamp((Math.sin(dec) - sa * Math.sin(phi)) / Math.max(1e-9, Math.cos(alt) * Math.cos(phi)), -1, 1)) / D2R; if (ha > 0) az = 360 - az;
  return { alt: alt / D2R, az };
}
function install(E) {
  if (E.view) return E.view;
  const W = E.W, C = () => E.command, arms = E.era.arms;
  const crewed = u => !!(arms[u.arm] && arms[u.arm].crew);
  const here = u => u.onMap && !u.gone && u.str > 0;
  const keys = new Map(); // an enemy unit's real id -> the opaque key the commander's picture uses for it
  const keyOf = tid => { if (!keys.has(tid)) keys.set(tid, 'c' + (keys.size + 1)); return keys.get(tid); };

  /* ---------- the ground ---------- */
  let worldCache = null;
  function world() {
    if (worldCache) return worldCache;
    const pick = k => plain(W[k] || []);
    return (worldCache = {
      v: VERSION, battle: E.battleId, size: { w: W.WM, h: W.HM },
      origin: { lat: W.LAT0, lon: W.LON0, mPerLat: W.MLAT, mPerLon: W.MLON },
      grid: { nx: W.NX, ny: W.NY, cell: W.CELL, heights: Array.from(W.H, r1) },
      roads: pick('ROADS'), sunken: pick('SUNKEN'), streams: pick('STREAMS'), woods: pick('WOODS'), villages: pick('VILLAGES'),
      buildings: pick('BUILDINGS'), houses: pick('HOUSES'), enclosures: pick('ENCLOSURES'), hedges: pick('HEDGES'), landmarks: pick('LM'),
      places: E.sps.map(sp => ({ id: sp.id, name: sp.name, x: r1(sp.x), y: r1(sp.y) })),
      objectives: Object.values(E.objectives || {}).map(o => ({ id: o.id, name: o.name, x: o.point ? r1(o.point[0]) : null, y: o.point ? r1(o.point[1]) : null })),
      sides: E.sides.map(s => ({ id: s.id, coalition: E.coalition[s.id] })),
      // what a client needs to draw a body as men rather than a block, as capabilities and never as names: whether an arm rides,
      // how many serve each piece if it is a crew, how tall a target it makes; and for each formation the share of the men in the
      // firing line, how dense it stands, whether it faces all round and whether it is a column of march (all from the era pack)
      arms: Object.fromEntries(Object.entries(arms).map(([id, a]) => [id, { mounted: !!a.charges, crew: a.crew || 0, height: a.height || null }])),
      formations: Object.fromEntries(Object.entries(E.era.formations || {}).map(([id, f]) => [id, { fire: f.fire ?? null, density: f.density ?? null, allRound: !!f.allRound, column: !!f.column }])),
      formationElse: { fire: (E.era.formationElse || {}).fire ?? null, density: null, allRound: false, column: false },
      light: { sunset: E.light.sunset, dark: E.light.dark },
    });
  }

  /* ---------- snapshots ---------- */
  // a commander's telescope, from the packs (his own power, or the era's when his file gives none): how many times it magnifies,
  // the angle across the circle seen in the eyepiece, and the true field that follows (derived: tan(field / 2) = tan(apparent / 2)
  // / power). Null where the era has no telescope. It is for drawing only: the engine's sighting rules have their own constants.
  function glassOf(L) {
    const g = E.era.glass || {}, power = typeof L.glass === 'number' ? L.glass : g.power;
    if (!(power > 1) || !(g.apparent > 0)) return null;
    return { power, apparent: g.apparent, field: Math.round(2 * Math.atan(Math.tan(g.apparent * D2R / 2) / power) / D2R * 1000) / 1000 };
  }
  const common = who => ({ v: VERSION, who, battle: E.battleId, t: E.t, clock: E.fmtT(E.t), over: !!E.over,
    light: { sun: r1(E.light.sunAt(E.t)), bearing: r1(sunPos(E.light.date, E.light.lat, E.light.lon, E.t).az), seeing: Math.round(E.bgVis(E.t)), damp: E.light.humidFrom != null && E.t > E.light.humidFrom }, ground: { wet: r1(E.wet) }, wind: { dir: Math.round(E.wind.dir), speed: r1(E.wind.speed) } });
  function truth() {
    const S = common('truth');
    S.units = E.units.filter(here).map(u => ({ id: u.id, side: u.side, name: u.name, corps: u.corps || null, arm: u.arm, x: r1(u.x), y: r1(u.y), facing: Math.round(u.facing),
      form: u.form, front: Math.round(u.F), depth: Math.round(u.D), str: Math.round(u.str), coh: Math.round(u.coh), status: u.status, task: u.task.kind, place: u.spId || null,
      firing: !!u.firedTick, charging: !!u.charge, crew: crewed(u), key: keys.get(u.id) || null }));
    S.places = E.sps.map(sp => ({ id: sp.id, holder: sp.holder || null }));
    S.morale = Object.fromEntries(E.sideIds.map(s => [s, Math.round(E.morale[s])]));
    S.riders = C() ? C().riders.filter(r => r.status === 'riding' && r.x != null).map(r => ({ x: r1(r.x), y: r1(r.y), side: r.side, kind: r.kind })) : [];
    S.smoke = { nx: E.SX, ny: E.SY, cell: 100, a: Array.from(E.smoke, v => Math.round(v * 100) / 100) };
    S.result = E.result ? { grade: E.result.grade, why: E.result.why, t: E.result.t } : null;
    // every order as it really went (the umpire's knowledge): the commander's own picture of his orders is in chief().orders
    S.orders = C() && C().orders ? C().orders.map(o => ({ id: o.id, from: o.from, to: o.to, action: o.action, status: o.status, objective: objective(o), conditions: (o.spec.conditions || []).length,
      issuedAt: o.issuedAt, sentAt: at(o.sentAt), receivedAt: at(o.receivedAt), actedAt: at(o.actedAt), misread: !!o.misread })) : [];
    return S;
  }
  const at = v => v == null ? null : r1(v);
  // where an order points, as it was written: the named place (and the strongpoint it stands for, if any) or the point on the map
  function objective(o) {
    const ob = (o.spec && o.spec.objective) || {}, named = ob.place ? E.objectives[ob.place] : null;
    const p = named && C().centre ? C().centre(named) : ob.point || null;
    return p ? { place: ob.place || null, sp: (named && named.sp) || null, x: r1(p[0]), y: r1(p[1]) } : null;
  }
  // The staff's estimate of when an order will reach its man and when he will act on it: the earliest and the latest minute, by the
  // ranges the order form shows the player (_game_orders.js, expectSpec): the staff's writing time, a rider by road or across wet
  // country to where the recipient's troops are believed to stand, and the time to pass an order down. Built from the commander's
  // beliefs and the rules' own ranges, never from the dice already drawn for this order. `act` is null when a condition cannot be
  // timed (a place changing hands, another order done); the whole estimate is null for headquarters' own tasks and for a
  // recipient off the map. It is the estimate as the staff would give it now: a client that wants it as given takes it at once.
  function expected(c, B, L, o) {
    const CK = c.CK, s = o.spec || {}, kind = c.RECIPIENTS && c.RECIPIENTS[o.to] ? c.RECIPIENTS[o.to].kind : null;
    if (!CK || !kind || kind === 'hq' || kind === 'offmap' || kind === 'army') return null;
    const X = c.X, fc = X.front ? X.front.cmd : null, gb = c.GRAND_BATTERY || [];
    const recs = [...B.own.values()].filter(r => { const u = E.byId[r.uid]; if (!u || r.gone) return false; const k = c.cmdOf(u);
      return o.to === fc ? (X.frontCorps || []).includes(k) : kind === 'battery' ? gb.includes(u.id) || !!u.gbattery : k === o.to; });
    // The numbers here are the order form's and the order code's, copied so that the estimate matches what the player is shown, and
    // must follow them if they change: 2500 m when he has no report of the recipient's troops (est., _game_orders.js rideTimes); an
    // urgent order written in half the time, a wounded commander's in half as long again, and 30% more for each further step of a
    // letter (est., orders.js write and SEQ_WRITE); a quarter added to the straight line for a ride across country (est., rideTimes);
    // wet ground slowing a rider by up to 40% (rules doc, command.js RIDER_CROSS). The estimate counts from the minute the order was
    // given: an order held while headquarters is moving is written later than this says.
    const d = recs.length ? hyp(recs.reduce((a, r) => a + r.x, 0) / recs.length - L.x, recs.reduce((a, r) => a + r.y, 0) / recs.length - L.y) : 2500;
    const w = CK.WRITE[c.opts.staff]; if (!w) return null;
    const f = (s.urgent ? 0.5 : 1) * (c.hq.wounded ? 1.5 : 1) * (o.seq ? 1 + 0.3 * (o.seq.n - 1) : 1);
    const pass = kind === 'marshal' || kind === 'battery' || s.direct ? CK.INTERP_DIRECT : CK.INTERP;
    const arrive = [o.issuedAt + w[0] * f + d / CK.RIDER_ROAD, o.issuedAt + w[1] * f + d * 1.25 / (CK.RIDER_CROSS * (1 - 0.4 * E.wet))];
    let act = [arrive[0] + pass[0], arrive[1] + pass[1]], open = false;
    for (const k of s.conditions || []) { if (k.type === 'time') act = act.map(v => Math.max(v, k.after)); else open = true; }
    return { arrive: arrive.map(r1), act: open ? null : act.map(r1) };
  }
  // an order as its writer knows it: written, sent, acknowledged (he learns nothing else until a report tells him)
  const known = o => o.status === 'cancelled' ? 'cancelled' : o.ackedAt != null ? 'acknowledged' : o.sentAt != null ? 'sent' : 'writing';
  function chief() {
    const c = C(); if (!c) throw new Error('view: this battle has no command layer, so there is no commander to see through');
    const id = c.X.chief, B = c.B[id], L = E.leaders[id], S = common('chief');
    S.side = c.side; S.commander = id;
    S.at = { x: r1(L.x), y: r1(L.y), post: c.hq.post || null, moving: !!c.hq.moving };
    S.glass = glassOf(L);
    S.own = [...B.own.values()].map(r => { const u = E.byId[r.uid]; return { id: r.uid, name: u.name, corps: u.corps || null, arm: u.arm, x: r1(r.x), y: r1(r.y), form: r.form || null,
      str: Math.round(r.str), state: r.cohWord || null, task: r.task || null, place: r.sp || null, gone: !!r.gone, seenAt: r.t, reportedAt: r.tState, src: r.src }; });
    S.enemy = [...B.c.values()].map(r => ({ key: keyOf(r.tid), identified: !!r.idLevel, side: r.side || null, nation: r.nat || null, corps: r.corps || null, kind: r.kind,
      x: r1(r.x), y: r1(r.y), str: Math.round(r.str), guns: r.guns || 0, form: r.form || null, status: r.status || null, moving: !!r.moving, facing: Math.round(r.dir || 0),
      place: r.garrison || null, seenAt: r.t, src: r.src }));
    S.places = Object.entries(B.places).map(([sp, p]) => ({ id: sp, holder: p.holder || null, knownAt: p.t, src: p.src }));
    S.heard = c.heard(id).map(h => ({ dir: h.dir, kind: h.k, words: h.w, level: r1(h.v) }));
    S.orders = c.orders.filter(o => o.from === id).map(o => ({ id: o.id, to: o.to, action: o.action, text: c.describe ? c.describe(o) : o.action, state: known(o), issuedAt: o.issuedAt, ackedAt: o.ackedAt ?? null,
      objective: objective(o), conditions: (o.spec.conditions || []).length, expect: expected(c, B, L, o) }));
    S.dispatches = c.inbox.slice(-20).map(m => ({ id: m.id, t: m.t, kind: m.kind, title: m.title || null, text: m.text || null, from: m.from || null, starred: !!m.decision }));
    S.riders = c.riders.filter(r => r.status === 'riding' && r.to === id && r.x != null && hyp(r.x - L.x, r.y - L.y) < P.RIDER_SEEN).map(r => ({ x: r1(r.x), y: r1(r.y) }));
    return S;
  }
  const snapshot = (who = 'chief') => who === 'truth' ? truth() : chief();

  /* ---------- the event stream ---------- */
  const feeds = {}; let seq = 0, logAt = 0, inboxAt = 0, charging = new Set(), stepping = false;
  function watch(who = 'chief') {
    if (who === 'chief' && !C()) throw new Error('view: no command layer to watch through');
    if (!feeds[who]) feeds[who] = [];
    if (!stepping) { stepping = true; logAt = E.log.length; inboxAt = C() ? C().inbox.length : 0; const step = E.step; E.step = function () { const t0 = E.t, tick = E.tick, was = E.over; step(); if (!was) collect(t0, tick); }; }
    return V;
  }
  const push = (who, e) => { const f = feeds[who]; e.seq = ++seq; f.push(e); if (f.length > P.KEEP) f.splice(0, f.length - P.KEEP); };
  // what the commander gets of one event: seen (with its place), only heard (a bearing, a loudness, a delay), or nothing
  function perceive(e) {
    const c = C(), L = E.leaders[c.X.chief], d = hyp(e.x - L.x, e.y - L.y), s = E.los(L.x, L.y, P.EYE, e.x, e.y, 2);
    const seen = s.clear && d <= E.bgVis(E.t) * s.trans; // (est.) smoke on the line shortens the day's seeing
    const reach = P.HEAR[e.kind] || 0, heard = d < reach;
    if (!seen && !heard) return null;
    const out = { t: e.t, kind: e.kind, seen };
    if (seen) { out.x = e.x; out.y = e.y; out.size = e.size; if (e.side) out.side = e.side; if (e.place) out.place = e.place; }
    if (heard) { out.bearing = Math.round(bearing(e.x - L.x, e.y - L.y)); out.delay = r1(d / P.SOUND_MPS); out.loud = r1(clamp(Math.sqrt((e.size || 1) / (e.kind === 'cannon' ? 8 : 1500)), 0.2, 3) * Math.pow(1 - d / reach, 2)); } // (est.)
    return out;
  }
  function emit(e) {
    if (feeds.truth) push('truth', Object.assign({}, e));
    if (feeds.chief && e.x != null) { const p = perceive(e); if (p) push('chief', p); }
  }
  const LOG_KIND = { break: 'break', rally: 'rally', place: 'place', arrival: 'arrival', army: 'army', end: 'end' };
  function collect(t0, tick) {
    const now = new Set();
    for (const u of E.units) {
      if (!here(u)) continue;
      if (u.firedTick) emit({ t: r1(t0 + TICK_MIN * spread(u.id, tick)), kind: crewed(u) ? 'cannon' : 'volley', x: r1(u.x), y: r1(u.y), side: u.side, unit: u.id, size: Math.round(u.str) });
      if (u.charge) { now.add(u.id); if (!charging.has(u.id)) emit({ t: r1(t0 + TICK_MIN * spread(u.id + '!', tick)), kind: 'charge', x: r1(u.x), y: r1(u.y), side: u.side, unit: u.id, size: Math.round(u.str) }); }
      else if (u.melee && u.meleeAtk) emit({ t: r1(t0 + TICK_MIN * spread(u.id + 'x', tick)), kind: 'melee', x: r1(u.x), y: r1(u.y), side: u.side, unit: u.id, size: Math.round(u.str) });
    }
    charging = now;
    for (; logAt < E.log.length; logAt++) {
      const l = E.log[logAt], kind = LOG_KIND[l.cat]; if (!kind) continue;
      const u = l.unit ? E.byId[l.unit] : null, sp = l.sp ? E.spById[l.sp] : null, at = u && u.onMap ? u : sp;
      emit({ t: l.t, kind, x: at ? r1(at.x) : null, y: at ? r1(at.y) : null, side: l.side || (u && u.side) || null, unit: l.unit || null, place: l.sp || null, size: u ? Math.round(u.str) : 0, text: l.text, log: logAt });
    }
    if (C() && feeds.chief) for (; inboxAt < C().inbox.length; inboxAt++) { const m = C().inbox[inboxAt]; push('chief', { t: m.t, kind: 'dispatch', id: m.id, about: m.kind, title: m.title || null, starred: !!m.decision }); }
  }
  function drain(who = 'chief', since = 0) { const f = feeds[who]; if (!f) return []; let i = f.length; while (i > 0 && f[i - 1].seq > since) i--; return plain(f.slice(i)); }

  /* ---------- why: the chain of causes behind a log entry, nearest first ---------- */
  function why(ref, depth = 6) {
    const start = typeof ref === 'number' ? ref : ref && ref.cause;
    const out = [], seen = new Set();
    (function walk(i, d) {
      const c = E.causes[i]; if (c == null || typeof i !== 'number' || seen.has(i) || d > depth) return;
      seen.add(i); out.push({ t: c.t, text: c.text, depth: d });
      for (const k of c.links || []) walk(k, d + 1);
    })(start, 0);
    return out;
  }

  /* ---------- who hurt whom: fire losses by firer, kept in ten-minute blocks from the engine's damage hook (no dice) ---------- */
  const hurt = new Map(); // target id -> Map('block|firer|kind' -> men)
  const prevHook = E.onDmg;
  E.onDmg = function (t, cas, kind, src) {
    if (prevHook) prevHook(t, cas, kind, src);
    if (!t || !(cas > 0)) return;
    let m = hurt.get(t.id); if (!m) hurt.set(t.id, (m = new Map()));
    const k = Math.floor(E.t / 10) + '|' + (src ? src.id : '') + '|' + kind; m.set(k, (m.get(k) || 0) + cas);
  };
  // what fire cost a unit in the minutes before t, and from whom (the largest first). Guns count their casualties in men hit.
  function losses(unitId, t = E.t, minutes = 30) {
    const m = hurt.get(unitId), by = new Map(); let total = 0; if (!m) return { men: 0, minutes, by: [] };
    const b1 = Math.floor(t / 10), b0 = Math.floor((t - minutes) / 10);
    for (const [k, cas] of m) { const [b, src, kind] = k.split('|'); if (+b < b0 || +b > b1) continue; total += cas; const kk = src + '|' + kind; by.set(kk, (by.get(kk) || 0) + cas); }
    const list = [...by].map(([kk, cas]) => { const [src, kind] = kk.split('|'), u = E.byId[src]; return { from: u ? u.name : null, side: u ? u.side : null, kind: kind === 'art' ? 'guns' : 'musketry', men: Math.round(cas) }; })
      .filter(x => x.men >= 1).sort((a, b) => b.men - a.men);
    return { men: Math.round(total), minutes, by: list.slice(0, 4) };
  }

  const V = { version: VERSION, P, world, snapshot, watch, drain, why, losses };
  E.view = V;
  return V;
}

const api = { version: VERSION, install, P, sunPos };
root.WView = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
