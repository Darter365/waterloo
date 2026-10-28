/* Waterloo engine: the umpire. One true state, 2-minute ticks, seeded randomness with a cause log.
   Mechanics follow the "Waterloo Game: Simulation Rules" doc; every coefficient marked (est.) lives in K. */
(function (root) {
'use strict';
const Packs = root.WPacks || (typeof require === 'function' ? require('./packs/all.js') : null);
/* (phase 1) Everything below is built once per battle from its resolved pack: the battle's map and order of battle (W), its era's
   numbers (ERA) and its nations' drill (NATIONS). Nothing in it names a battle except where the lint allow-list records it. */
function buildWorld(BATTLE) {
const W = BATTLE.W, ERA = BATTLE.era, NATIONS = BATTLE.nations, SIDES = BATTLE.sides, SIDE_IDS = BATTLE.sideIds, COAL = BATTLE.coalition;
const ROUTE_OF = BATTLE.battle.routeOf || {}; // a corps that marches by another's road (Waterloo: Pirch's II Corps follows Bülow's)
const SIDE_BY = Object.fromEntries(SIDES.map(s => [s.id, s])); // each army's own settings (battle pack): fatigue0, chief, rear, retreat ...
const COALS = [...new Set(SIDES.map(s => COAL[s.id]))]; // the coalitions, in the battle's order
const STARTS = BATTLE.battle.starts || {}, WEATHER = BATTLE.battle.weather || {}, TRAITS = W.TRAITS || {}, METRICS = BATTLE.battle.metrics || [];
const COAL_NAME = BATTLE.battle.coalitionNames || {}, CORPS_NAME = BATTLE.battle.corpsNames || {};
const natOf = u => NATIONS[u.nat] || {};
const gunCal = nat => (NATIONS[nat] && NATIONS[nat].gunCalibre) || ERA.gunCalibre; // a battery's guns when the battle does not say
// (phase 2) an army's rear edge: N, S, E or W. "Toward the rear by more than d" and "past the edge, within m of it", written per edge so the
// arithmetic is exactly release 3's
const rearOf = (edge, p, u, d) => edge === 'S' ? p[1] > u.y + d : edge === 'N' ? p[1] < u.y - d : edge === 'E' ? p[0] > u.x + d : p[0] < u.x - d;
const toRear = (edge, d) => edge === 'S' ? [0, d] : edge === 'N' ? [0, -d] : edge === 'E' ? [d, 0] : [-d, 0];
/* ---------------- arms, formations, movement and weapons: the era's tables (phase 2) ---------------- */
const ARMS = ERA.arms, FORMS = ERA.formations, FORM0 = ERA.formationElse, WEAPONS = ERA.weapons, MOVES = ERA.movement, PLACE = ERA.place;
const PLACE_ARM = Object.keys(ARMS).find(k => ARMS[k].holds); // the arm that garrisons farms ('gar' in an order of battle is this arm, holding a place)
const ALL_ROUND = Object.keys(FORMS).find(k => FORMS[k].allRound); // the era's all-round formation (the square)
const armIdOf = type => type === 'gar' ? PLACE_ARM : type;
const A = u => ARMS[u.arm]; // what the unit's arm is made of and can do
const served = u => !!A(u).crew; // guns served by a crew
const charges = u => !!A(u).charges; // horse that charges
const foot = u => A(u).move === 'foot' && !u.held; // foot in the open (not holding a farm)
const canAllRound = u => !!A(u).allRound && !u.held;
const allRound = f => !!(f && FORMS[f] && FORMS[f].allRound);
const weaponOf = u => WEAPONS[u.weapon || A(u).weapon];
const marchForm = type => ARMS[armIdOf(type)].column; // the column a body marches in
// a foot unit garrisons a place (and leaves it); u.type keeps 'gar' for the pages that still read it (phase 3 retires it)
function hold(u) { if (A(u).holds) { u.held = true; u.type = 'gar'; } }
function unhold(u, force) { if (force && !A(u).holds) u.arm = PLACE_ARM; if (u.held || force) { u.held = false; u.type = u.arm; } } // force: release 3 made any evicted garrison foot
const offEdge = (edge, u, m) => edge === 'S' ? u.y > HM - m : edge === 'N' ? u.y < m : edge === 'E' ? u.x > WM - m : u.x < m;
const { NX, NY, CELL, WM, HM, ll2m, m2ll, H } = W;

/* ---------------- calibration constants (est.): the era's, in its pack ---------------- */
const K = ERA.K;

/* ---------------- RNG with logged draws ---------------- */
function makeRng(seed) {
  let s = seed >>> 0; const counts = {};
  const raw = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const r = (why) => { counts[why || '?'] = (counts[why || '?'] || 0) + 1; return raw(); };
  r.counts = counts;
  r.normal = (why) => { const u = Math.max(1e-9, r(why)), v = r(why); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  r.logn = (sig, why) => Math.exp(sig * r.normal(why) - sig * sig / 2);
  r.tri = (a, m, b, why) => { const u = r(why), f = (m - a) / (b - a); return u < f ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)); };
  r.range = (a, b, why) => a + (b - a) * r(why);
  return r;
}

/* ---------------- geometry ---------------- */
const hyp = Math.hypot, D2R = Math.PI / 180;
const fvec = deg => [Math.sin(deg * D2R), -Math.cos(deg * D2R)];
const bearing = (dx, dy) => (Math.atan2(dx, -dy) / D2R + 360) % 360;
const angDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function samp(A, x, y, nx = NX, ny = NY, cell = CELL) {
  let fx = x / cell, fy = y / cell;
  if (fx < 0) fx = 0; else if (fx > nx - 1.0001) fx = nx - 1.0001;
  if (fy < 0) fy = 0; else if (fy > ny - 1.0001) fy = ny - 1.0001;
  const c = fx | 0, r = fy | 0, tx = fx - c, ty = fy - r, i = r * nx + c;
  return (A[i] * (1 - tx) + A[i + 1] * tx) * (1 - ty) + (A[i + nx] * (1 - tx) + A[i + nx + 1] * tx) * ty;
}
const hAt = (x, y) => samp(H, x, y);
// (phase 2g) does segment a-b cross segment c-d? where along a-b (0-1), or -1
function segX(ax, ay, bx, by, cx, cy, dx, dy) { const r1 = bx - ax, r2 = by - ay, s1 = dx - cx, s2 = dy - cy, den = r1 * s2 - r2 * s1; if (!den) return -1; const t = ((cx - ax) * s2 - (cy - ay) * s1) / den, u = ((cx - ax) * r2 - (cy - ay) * r1) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1; }
const polyLen = p => { let L = 0; for (let i = 1; i < p.length; i++) L += hyp(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = clamp(t, 0, 1); return hyp(px - ax - t * dx, py - ay - t * dy); }
function polyDist(px, py, p) { let m = Infinity; for (let i = 1; i < p.length; i++) m = Math.min(m, segDist(px, py, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1])); return m; }
function inPoly(x, y, pts) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
function inRect(x, y, r, pad = 0) { const a = -r.rot * D2R, dx = x - r.x, dy = y - r.y, u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a); return Math.abs(u) <= r.w / 2 + pad && Math.abs(v) <= r.h / 2 + pad; }
const fmtT = t => { const h = Math.floor(t / 60), m = Math.round(t - h * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };

/* ---------------- terrain grids (built once) ---------------- */
const T = { OPEN: 0, WOOD: 1, ORCH: 2, BUILD: 3, VILL: 4, ROAD: 5, LANE: 6, STREAM: 7, SUNKEN: 8 };
const TT = new Uint8Array(NX * NY), OBH = new Float32Array(NX * NY), LOW = new Uint8Array(NX * NY);
(function buildTerrain() {
  const toM = p => p; // features are already metres in WData
  for (let r = 0; r < NY; r++) for (let c = 0; c < NX; c++) {
    const x = c * CELL, y = r * CELL, i = r * NX + c; let t = T.OPEN;
    for (const s of W.STREAMS) { for (let k = 0; k < s.length - 3; k += 3) { if (s[k + 2] < 300) continue; if (segDist(x, y, s[k], s[k + 1], s[k + 3], s[k + 4]) < 30) { t = T.STREAM; LOW[i] = 1; break; } if (segDist(x, y, s[k], s[k + 1], s[k + 3], s[k + 4]) < 110) LOW[i] = 1; } if (t === T.STREAM) break; }
    for (const e of W.ENCLOSURES) if (inRect(x, y, e, 10)) t = T.ORCH;
    for (const v of W.VILLAGES) if (hyp(x - v.cx, y - v.cy) < v.r * 0.65) t = T.VILL;
    for (const w of W.WOODS) if (inPoly(x, y, w.pts)) t = T.WOOD;
    for (const rd of W.ROADS) { const d = polyDist(x, y, rd.pts); if (d < 25) t = rd.kind === 'chaussee' ? T.ROAD : (t === T.ROAD ? T.ROAD : T.LANE); }
    for (const sk of W.SUNKEN) if (polyDist(x, y, sk) < 25) t = T.SUNKEN;
    for (const b of W.BUILDINGS) if (inRect(x, y, b, 20)) t = T.BUILD;
    TT[i] = t;
    OBH[i] = t === T.WOOD ? 15 : t === T.BUILD ? 8 : t === T.VILL ? 6 : t === T.ORCH ? 3 : 0;
  }
})();
const cellIdx = (x, y) => { const c = clamp(Math.round(x / CELL), 0, NX - 1), r = clamp(Math.round(y / CELL), 0, NY - 1); return r * NX + c; };
const COVER = { [T.WOOD]: 0.5, [T.ORCH]: 0.7, [T.BUILD]: 0.3, [T.VILL]: 0.4, [T.SUNKEN]: 0.5 };

/* ---------------- pathfinding on a 100 m grid ---------------- */
const PC = 100, PNX = Math.floor(WM / PC) + 1, PNY = Math.floor(HM / PC) + 1;
const TNAME = Object.keys(T); // terrain class index -> name, for the movement table
// the share of open-ground pace on this ground, by how the body moves (era movement table)
function terrainSpeed(move, tt, Wet) {
  const M = MOVES[move], v = M[TNAME[tt]], cross = 1 - M.wet * Wet;
  if (v == null) return cross;
  if (typeof v === 'number') return v;
  if (v[1] === 'wet') return v[0] * cross;
  return v[0] - v[1] * Wet + v[2]; // lanes
}
const moveOf = type => MOVES[type] ? type : ARMS[armIdOf(type)] ? ARMS[armIdOf(type)].move : type; // astar takes a movement class or an arm
function astar(E, type, sx, sy, tx, ty) {
  type = moveOf(type);
  const key = type + Math.round(E.wet * 10);
  let cost = E.pathCost[key];
  if (!cost) {
    cost = new Float32Array(PNX * PNY);
    for (let r = 0; r < PNY; r++) for (let c = 0; c < PNX; c++) { const tt = TT[cellIdx(c * PC, r * PC)]; cost[r * PNX + c] = PC / Math.max(0.05, terrainSpeed(type, tt, E.wet)); }
    E.pathCost[key] = cost;
  }
  const s = clamp(Math.round(sy / PC), 0, PNY - 1) * PNX + clamp(Math.round(sx / PC), 0, PNX - 1), g = clamp(Math.round(ty / PC), 0, PNY - 1) * PNX + clamp(Math.round(tx / PC), 0, PNX - 1);
  const gc = g % PNX, gr = (g / PNX) | 0;
  const dist = new Float32Array(PNX * PNY).fill(Infinity), prev = new Int32Array(PNX * PNY).fill(-1), closed = new Uint8Array(PNX * PNY);
  const heap = []; const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const hFn = n => { const c = n % PNX, r = (n / PNX) | 0; return hyp(c - gc, r - gr) * PC / 1.2; };
  dist[s] = 0; push(s, hFn(s));
  while (heap.length) {
    const [, n] = pop(); if (closed[n]) continue; closed[n] = 1; if (n === g) break;
    const c = n % PNX, r = (n / PNX) | 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue; const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= PNX || rr >= PNY) continue;
      const m = rr * PNX + cc; if (closed[m]) continue; const step = (cost[n] + cost[m]) / 2 * (dr && dc ? 1.4142 : 1);
      const nd = dist[n] + step; if (nd < dist[m]) { dist[m] = nd; prev[m] = n; push(m, nd + hFn(m)); }
    }
  }
  const path = []; let n = g; if (prev[n] < 0 && n !== s) return [[tx, ty]];
  while (n >= 0 && n !== s) { path.push([(n % PNX) * PC, ((n / PNX) | 0) * PC]); n = prev[n]; }
  path.reverse();
  // simplify: drop collinear points
  const out = []; for (let i = 0; i < path.length; i++) { if (i > 0 && i < path.length - 1) { const a = path[i - 1], b = path[i], c = path[i + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0])) continue; } out.push(path[i]); }
  if (out.length) out[out.length - 1] = [tx, ty]; else out.push([tx, ty]);
  return out;
}

/* ---------------- formations ---------------- */
const RANKS = u => (NATIONS[u.nat] ? NATIONS[u.nat].ranks : 3); // men deep in line, by army (nation pack)
function nBn(u) { return Math.max(1, Math.round(u.str / (NATIONS[u.nat] ? NATIONS[u.nat].battalion : 560))); } // battalions in a brigade, by army's battalion size
// a dimension of a body (m): a number, or { of, mul, add, min, max } or { of, steps, else } over its men, files, battalions or pairs
function dimOf(d, u) {
  if (typeof d === 'number') return d;
  const x = d.of === 'men' ? u.str : d.of === 'files' ? u.str / RANKS(u) : d.of === 'bns' ? nBn(u) : Math.ceil(nBn(u) / 2);
  if (d.steps) return stepBy(d.steps, x, d.else);
  let v = x; for (const m of d.mul || []) v *= m;
  if (d.add != null) v = d.add + v; if (d.min != null) v = Math.max(d.min, v); if (d.max != null) v = Math.min(d.max, v);
  return v;
}
function footprint(u) {
  if (!u.arm) { u.arm = armIdOf(u.type); u.held = u.type === 'gar'; } // a unit made outside the engine
  if (u.held) { const s = u.spSec; return { F: s ? s.r * PLACE.size : PLACE.sizeElse, D: s ? s.r * PLACE.size : PLACE.sizeElse }; }
  const sh = A(u).shapes, row = sh[u.form] || sh._;
  return { F: dimOf(row.F, u), D: dimOf(row.D, u) };
}
const fcol = k => Object.fromEntries(Object.entries(FORMS).filter(([, f]) => f[k] != null).map(([n, f]) => [n, f[k]]));
const DENSITY = fcol('density'), MASSF = fcol('mass'); // by formation (era formation table)
// the share of the men who can fire: the formation's, and in a line only the front ranks the weapon allows (2 of 3 in a French line)
function fireFrac(u) { const f = FORMS[u.form]; if (!f || f.fire == null) return FORM0.fire; if (f.ranksFire) return f.fire * Math.min(1, weaponOf(u).firingRanks / RANKS(u)); return f.fire; }
// ticks to change formation: into the all-round one by cohesion (1 if 50 or more, else 2), out of it 1, into or out of a mass 3, else 2
const FORM_TICKS = (u, to) => { const T1 = FORMS[to] || {}, T0 = FORMS[u.form] || {}; if (T1.toTicks) return stepBy(T1.toTicks, u.coh, T1.toTicksElse); if (T0.fromTicks != null) return T0.fromTicks; return Math.max(T1.ticks ?? 2, T0.ticks ?? 2); };

/* ---------------- light and visibility ---------------- */
/* (phase 2) light from the date and the place: the sun's altitude through the day at the middle of the map, by the battle's clock (local
   mean time), with the usual approximation (NOAA's; good to a minute or two). The era says what the light does: how far a man can see and how
   much fire tells once the sun is down, when it is too dark to rally (dusk) and when fighting stops. The weather adds its own haze. */
function sunAlt(date, lat, lon, tLMT) {
  const [Y, Mo, D] = date.split('-').map(Number), leap = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0;
  const n = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][Mo - 1] + D + (leap && Mo > 2 ? 1 : 0), utc = tLMT - 4 * lon;
  const g = 2 * Math.PI / (leap ? 366 : 365) * (n - 1 + (utc / 60 - 12) / 24);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = ((tLMT + eq) / 4 - 180) * D2R, phi = lat * D2R, cz = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
  return 90 - Math.acos(clamp(cz, -1, 1)) / D2R;
}
const LE = ERA.light, [CLAT, CLON] = m2ll(WM / 2, HM / 2);
const SUN = new Float64Array(1442); for (let m = 0; m <= 1441; m++) SUN[m] = sunAlt(BATTLE.battle.date, CLAT, CLON, m);
const sunAt = t => { const m = clamp(t, 0, 1440), i = Math.floor(m); return SUN[i] + (SUN[i + 1] - SUN[i]) * (m - i); };
const eveningAt = alt => { let lo = 720, hi = 1440; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (sunAt(m) > alt) lo = m; else hi = m; } return lo; };
const lerpClamp = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (x - a) / (b - a); } return pts[pts.length - 1][1]; };
const SUNSET = eveningAt(LE.sunset), DARK = eveningAt(LE.dark), END = eveningAt(LE.end); // the minutes, after noon, the sun sinks to each
// how far a man can see (m): the weather's haze by the clock, and once the sun is down, the failing light
function bgVis(t) { const w = lerpClamp(WEATHER.vis, t), alt = sunAt(t); return alt >= LE.sunset ? w : Math.min(w, lerpClamp(LE.vis, -alt)); }
const duskFire = t => { const alt = sunAt(t); return alt >= LE.sunset ? 1 : lerpClamp(LE.fire, -alt); }; // the share of fire that tells in failing light
const K_CURV = 0.87 / (2 * 6371000);
const HIT = ERA.hit;
function hitChance(r, tab = HIT) { for (let i = 1; i < tab.length; i++) if (r <= tab[i][0]) { const [a, pa] = tab[i - 1], [b, pb] = tab[i]; return pa + (pb - pa) * (r - a) / (b - a); } return 0; } // a weapon's own table, else the era's musket
const stepBy = (tab, v, dflt) => { for (const [lim, val] of tab) if (v >= lim) return val; return dflt; }; // the first row whose threshold v reaches
const bandBelow = (tab, r) => { for (const [lim, val] of tab) if (r < lim) return val; return 0; }; // the first band r is below
const curveAt = (pts, r) => { if (r <= pts[0][0]) return pts[0][1]; let i = 1; while (i < pts.length - 1 && r > pts[i][0]) i++; const [a, pa] = pts[i - 1], [b, pb] = pts[i]; return pa + (pb - pa) * (r - a) / (b - a); };
const RS = ERA.roundshot, CN = ERA.canister;
function roundshot(r, cal) { const b = bandBelow(RS.bands, r); return b * stepBy(RS.calibre, cal, RS.calibreElse); }
const CREW = ERA.crew; // gunners per gun (era pack)
function canister(r, cal) { const lim = stepBy(CN.reach, cal, CN.reachElse); if (r > lim) return 0; const b = curveAt(CN.curve, r); return Math.max(CN.floor, b) * stepBy(CN.calibre, cal, CN.calibreElse); }

/* ================= engine ================= */
function create(opts = {}) {
  const seed = opts.seed ?? (Math.random() * 1e9) | 0;
  const rnd = makeRng(seed);
  const scenario = opts.scenario || '1100', history = opts.history || 'uncertain';
  const START = STARTS[scenario] || STARTS[Object.keys(STARTS)[0]]; // the start (battle pack); an unknown one is the first
  const E = {
    seed, rnd, scenario, history, K: Object.assign({}, K, opts.K || {}), t: START.t, tick: 0,
    units: [], byId: {}, sps: [], spById: {}, leaders: {}, log: [], causes: [], orders: [], contacts: Object.fromEntries(SIDE_IDS.map(s => [s, {}])),
    morale: Object.fromEntries(SIDES.map(s => [s.id, s.morale0])), armyStr0: Object.fromEntries(SIDE_IDS.map(s => [s, 0])), lossAcc: Object.fromEntries(SIDE_IDS.map(s => [s, 0])), wet: 0.6, wet0: 0.6, smoke: null, wind: { dir: 270, speed: 1.0 }, gustT: 0,
    pathCost: {}, losCache: new Map(), metrics: Object.fromEntries([...(BATTLE.battle.metrics || []).map(m => m.id), 'guardAttack', ...SIDE_IDS.map(x => x.toLowerCase() + 'Break')].map(k => [k, null])),
    flags: {}, over: false, result: null, ai: null, ruleHooks: [], history_: [], spTaken: {},
  };
  E.fmtT = fmtT; E.W = W; E.T = T; E.TT = TT; E.hAt = hAt; E.ll2m = ll2m; E.m2ll = m2ll;
  E.light = { sunset: SUNSET, dark: DARK, end: END, sunAt }; // (phase 2) this battle's light, computed
  E.battleId = BATTLE.id; E.sideIds = SIDE_IDS; E.sides = SIDES; E.coalition = COAL; E.footprint = footprint; E.bgVis = bgVis; E.nations = NATIONS; E.era = ERA;
  const log = (cat, text, extra = {}) => { const e = { t: E.t, cat, text, ...extra }; E.log.push(e); return e; };
  E.logEvent = log;

  /* ----- environment ----- */
  E.wet0 = START.wet0;
  E.wet = E.wet0;
  const DRY_FROM = START.dryFrom ?? START.t; // the ground dries from this minute (after the rain stops)
  const SX = Math.ceil(WM / 100) + 1, SY = Math.ceil(HM / 100) + 1; E.SX = SX; E.SY = SY;
  E.smoke = new Float32Array(SX * SY); let smokeTmp = new Float32Array(SX * SY);
  E.wind.dir = history === 'strict' ? 270 : 270 + rnd.normal('wind') * 25; E.wind.speed = history === 'strict' ? 1.0 : clamp(1.0 + rnd.normal('wind') * 0.35, 0.4, 2.2);
  E.gustT = E.t + rnd.range(20, 60, 'gust');
  const smokeAt = (x, y) => samp(E.smoke, x, y, SX, SY, 100);
  function addSmoke(x, y, amt) { const c = clamp(Math.round(x / 100), 0, SX - 1), r = clamp(Math.round(y / 100), 0, SY - 1); E.smoke[r * SX + c] += amt; }
  function wetness() {
    const w = E.t < DRY_FROM ? E.wet0 : Math.max(E.K.WET_FLOOR, E.wet0 - E.K.DRY_RATE * (E.t - DRY_FROM) / 60);
    E.wet = w; E.wetLow = Math.min(1, E.wet0 - 0.5 * (E.wet0 - w));
  }
  const wetAt = (x, y) => LOW[cellIdx(x, y)] ? E.wetLow : E.wet;
  function stepSmoke() {
    const humid = E.t > (WEATHER.humidFrom ?? Infinity), dec = humid ? E.K.SMOKE_DECAY_HUMID : E.K.SMOKE_DECAY;
    const [wx, wy] = fvec((E.wind.dir + 180) % 360), shift = E.wind.speed * 120 / 100; // cells per tick, downwind
    const gust = E.t >= E.gustT && E.t < E.gustT + 4;
    if (E.t >= E.gustT + 4) E.gustT = E.t + rnd.range(20, 60, 'gust');
    const s = E.smoke, o = smokeTmp;
    for (let r = 0; r < SY; r++) for (let c = 0; c < SX; c++) {
      const sx = c - wx * shift, sy = r - wy * shift;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const g = (cc, rr) => (cc < 0 || rr < 0 || cc >= SX || rr >= SY) ? 0 : s[rr * SX + cc];
      let v = (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
      v *= dec; if (gust) v *= 0.55;
      o[r * SX + c] = v;
    }
    E.smoke = o; smokeTmp = s;
  }
  E.smokeAt = smokeAt;
  E.astar = (type, sx, sy, tx, ty) => astar(E, type, sx, sy, tx, ty);

  /* ----- line of sight ----- */
  function los(ax, ay, eye, bx, by, th) {
    const d = hyp(bx - ax, by - ay); if (d < 70) return { clear: true, trans: 1, d };
    const n = Math.max(2, Math.ceil(d / 50)), h0 = hAt(ax, ay) + eye, h1 = hAt(bx, by) + th;
    let maxS = -Infinity, sm = 0;
    for (let i = 1; i < n; i++) {
      const f = i / n, x = ax + (bx - ax) * f, y = ay + (by - ay) * f, dd = d * f;
      const ob = (dd > 70 && d - dd > 70) ? OBH[cellIdx(x, y)] : 0;
      const sl = (hAt(x, y) + ob - dd * dd * K_CURV - h0) / dd; if (sl > maxS) maxS = sl;
      sm += smokeAt(x, y) * (d / n) / 100;
    }
    const sT = (h1 - d * d * K_CURV - h0) / d;
    return { clear: sT >= maxS, trans: Math.exp(-sm * E.K.SMOKE_VIS), d, margin: sT - maxS };
  }
  E.los = los;
  const targetH = u => (charges(u) ? A(u).height : u.lying ? ERA.lyingHeight : u.held ? PLACE.height : A(u).height) + (u.heightBonus || 0);
  function losU(a, b, eye = 2.5) {
    const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    const c = E.losCache.get(key);
    if (c && E.tick - c.tick < 3 && hyp(c.ax - a.x, c.ay - a.y) < 40 && hyp(c.bx - b.x, c.by - b.y) < 40 && c.lyA === a.lying && c.lyB === b.lying) return a.id < b.id ? c.ab : c.ba;
    const ab = los(a.x, a.y, eye, b.x, b.y, targetH(b)), ba = los(b.x, b.y, eye, a.x, a.y, targetH(a));
    const rec = { tick: E.tick, ax: a.id < b.id ? a.x : b.x, ay: a.id < b.id ? a.y : b.y, bx: a.id < b.id ? b.x : a.x, by: a.id < b.id ? b.y : a.y, lyA: a.id < b.id ? a.lying : b.lying, lyB: a.id < b.id ? b.lying : a.lying, ab: a.id < b.id ? ab : ba, ba: a.id < b.id ? ba : ab };
    E.losCache.set(key, rec);
    return ab;
  }
  E.losU = losU;
  function detectP(r, trans, men) { const V = bgVis(E.t), r50 = 4000 * V / 8000 * Math.pow(Math.max(200, men) / 2000, 0.25), re = r / Math.max(0.05, trans); return 1 / (1 + Math.exp((re - r50) / 700)); }
  E.detectP = detectP;

  /* ----- strongpoints ----- */
  for (const sp of W.STRONGPOINTS) {
    const secs = sp.sections.map(s => { const [x, y] = ll2m(s.at[0], s.at[1]); return { ...s, x, y, held: null, burnt: false }; });
    const acc = sp.access.map(p => ll2m(p[0], p[1]));
    const o = { id: sp.id, name: sp.name, key: !!sp.key, value: sp.value ?? (sp.key ? 1 : 0), secs, access: acc, holder: null, garrison: null, x: secs[secs.length - 1].x, y: secs[secs.length - 1].y };
    E.sps.push(o); E.spById[sp.id] = o;
  }
  E.streetSecs = E.sps.flatMap(sp => sp.secs.filter(s => s.street)); // (Ligny) sections that are open villages: see edgeSec
  E.objectives = {};
  for (const [k, o] of Object.entries(W.OBJECTIVES)) {
    const ob = { id: k, name: o.name };
    if (o.sp) { ob.sp = o.sp; const sp = E.spById[o.sp]; ob.point = [sp.x, sp.y]; }
    if (o.point) ob.point = ll2m(o.point[0], o.point[1]);
    if (o.line) { ob.line = o.line.map(p => ll2m(p[0], p[1])); ob.point = [(ob.line[0][0] + ob.line[1][0]) / 2, (ob.line[0][1] + ob.line[1][1]) / 2]; }
    if (o.own) ob.own = true;
    if (o.value) Object.assign(ob, { value: o.value, holder: o.holder, flag: o.flag, says: o.says, takenAt: null }); // (phase 2) a line worth holding
    E.objectives[k] = ob;
  }
  /* ----- obstacles (phase 2g): lines on the map (hedges, walls, stakes, ditches) and fieldworks dug in the battle; the era says how each
     slows a body crossing it by how it moves (0: it cannot cross formed), how much it disorders it, the cover it gives the men behind it,
     and how it stands against horse ----- */
  E.obstacles = (W.OBSTACLES || []).map((o, i) => mkObstacle(o.kind, o.pts.map(p => ll2m(p[0], p[1])), o.name || o.kind + ' ' + (i + 1)));
  function mkObstacle(kind, pts, name) { const K_ = (ERA.obstacles || {})[kind]; if (!K_) throw new Error(`obstacle kind "${kind}" is not in the era`); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { kind, K: K_, pts, name, x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, y0: Math.min(...ys) - 1, y1: Math.max(...ys) + 1 }; }
  // the first obstacle the segment a-b crosses, and where (0-1 along it)
  function crossed(ax, ay, bx, by) {
    let best = null, bt = 2;
    for (const o of E.obstacles) {
      if (Math.max(ax, bx) < o.x0 || Math.min(ax, bx) > o.x1 || Math.max(ay, by) < o.y0 || Math.min(ay, by) > o.y1) continue;
      for (let i = 1; i < o.pts.length; i++) { const t = segX(ax, ay, bx, by, o.pts[i - 1][0], o.pts[i - 1][1], o.pts[i][0], o.pts[i][1]); if (t >= 0 && t < bt) { bt = t; best = o; } }
    }
    return best ? { o: best, t: bt } : null;
  }
  E.crossed = crossed; E.addObstacle = (kind, pts, name) => { const o = mkObstacle(kind, pts, name); E.obstacles.push(o); return o; };
  // the obstacle a shot or a charge from a to t must pass, if it lies close in front of t (the men behind it are covered by it)
  const shelterOf = (a, t, within) => { if (!E.obstacles.length) return null; const c = crossed(a.x, a.y, t.x, t.y); if (!c) return null; return (1 - c.t) * hyp(t.x - a.x, t.y - a.y) <= within ? c.o : null; };
  E.routes = {}; for (const [k, r] of Object.entries(W.ROUTES)) E.routes[k] = r.map(p => ll2m(p[0], p[1])); E.routeOf = ROUTE_OF;
  E.chokes = W.CHOKES.map(c => { const [x, y] = ll2m(c.at[0], c.at[1]); return { ...c, x, y, used: 0, queue: [] }; });

  /* ----- units ----- */
  function makeUnit(spec) {
    const u = Object.assign({
      q: 1, coh: 80, cohMax: 100, fatigue: 15, ammo: 50, rounds: 120, wind: 100, status: 'steady', lying: false, onMap: true, gone: false,
      form: 'columns', formTo: null, formTimer: 0, task: { kind: 'hold' }, path: null, killed: 0, wounded: 0, captured: 0, stragglers: 0,
      hitTick: { mus: 0, art: 0, flank: 0, cav: 0 }, firedTick: false, lastHit: -99, lastFired: -99, brokeAt: null, rallyT: 0, leader: null, spId: null, spSec: null,
      cal: 6, shells: 0, deployedT: 0, silencedUntil: 0, isGuard: false, charge: null, retreatRoute: null, kills: 0, inContact: null, contactTicks: 0, stalemates: 0,
    }, spec);
    u.str0 = u.str; u.arm = armIdOf(u.type); u.held = u.type === 'gar'; // the arm, from the order of battle; 'gar' is foot holding a place
    if (served(u)) { u.guns0 = u.str; u.shells = Math.round(u.str * A(u).shells); }
    const fp = footprint(u); u.F = fp.F; u.D = fp.D;
    E.units.push(u); E.byId[u.id] = u; return u;
  }
  for (const r of W.RAW) {
    const [id, side, name, parent, nat, type, str, la, lo, facing, form, conf, note] = r;
    if (type === 'hq') continue;
    const [x, y] = ll2m(la, lo), q = W.QUALITY[id] ?? 1, tr = TRAITS[id] || {};
    const u = makeUnit({ id, side, name, parent, nat, type, str, x, y, facing, form: FORMS[form] ? form : (NATIONS[nat] && FORMS[NATIONS[nat].form] ? NATIONS[nat].form : 'columns'), q, conf, note, corps: W.CORPS[id] || null, div: W.DIVISION[id] || null, cal: ARMS[armIdOf(type)].crew ? (W.CALIBRE[id] || gunCal(nat)) : 0 });
    u.isGuard = !!tr.guard; // (phase 2) from the battle's unit traits, not the unit's id
    u.cavKind = ARMS[armIdOf(type)].shock ? (tr.kind || 'light') : null;
    if (tr.horse) u.horse = true; if (tr.prestige) u.prestige = tr.prestige; if (tr.weapon) u.weapon = tr.weapon; if (tr.ammo) u.ammoKind = tr.ammo; if (tr.ammo0 != null) u.ammo = tr.ammo0;
    if (!u.corps && SIDE_BY[side].corps0) u.corps = SIDE_BY[side].corps0;
  }
  // starting cohesion and fatigue: 75-90 by quality (era), plus the weather's (Waterloo: -5 for the soaked night); each army's fatigue (battle)
  for (const u of E.units) {
    u.coh = clamp(E.K.COH0 + (u.q - E.K.COH0_Q0) * E.K.COH0_Q, E.K.COH0_MIN, E.K.COH0_MAX) + (WEATHER.cohesion0 || 0); u.cohMax = 100; u.minCoh = u.coh;
    u.fatigue = SIDE_BY[u.side].fatigue0 ?? 15; if (served(u)) u.form = u.form === 'park' ? 'park' : A(u).deploys;
  }
  // garrisons into strongpoints: each place names its garrison at the start (battle pack)
  for (const spd of W.STRONGPOINTS) if (spd.garrison) { const u = E.byId[spd.garrison], sp = E.spById[spd.id]; if (!u) continue; occupy(u, sp, COAL[u.side]); }
  function occupy(u, sp, side) {
    // (7) the old garrison, if another unit, stops being the garrison (before, two units could both think they held the place)
    if (sp.garrison && sp.garrison !== u.id) { const g0 = E.byId[sp.garrison]; if (g0 && g0.spId === sp.id) { g0.spId = null; g0.spSec = null; unhold(g0); g0.form = PLACE.leaveForm; const fp0 = footprint(g0); g0.F = fp0.F; g0.D = fp0.D; if (g0.task.kind === 'garrison') g0.task = { kind: 'hold', since: E.t }; } }
    for (const s of sp.secs) if (!s.burnt) s.held = side;
    sp.holder = side; sp.garrison = u.id; u.spId = sp.id; hold(u); u.form = 'garrison';
    const sec = outerHeld(sp, side); u.spSec = sec; if (sec) { u.x = sec.x; u.y = sec.y; }
    u.task = { kind: 'garrison', sp: sp.id };
    const fp = footprint(u); u.F = fp.F; u.D = fp.D;
  }
  E.occupy = occupy;
  function outerHeld(sp, side) { for (const s of sp.secs) if (s.held === side && !s.burnt) return s; return null; }
  E.outerHeld = outerHeld;
  // every brigade remembers its place in the opening line (a start that holds an army back sends it there)
  for (const u of E.units) { u.deploy = [u.x, u.y]; u.deployForm = u.form; u.deployFacing = u.facing; }
  // off-map forces
  E.offmap = []; E.corpsMen0 = {}; E.engaged = {};
  // forces off the map (battle pack): each marches on its own or waits to be sent for
  for (const F of W.FORCES || []) for (const r of F.units) {
    const [id, side, name, parent, nat, type, str, route, q, arrive] = r;
    const u = makeUnit({ id, side, name, parent, nat, type, str, x: -9999, y: -9999, facing: 270, form: marchForm(type), q, onMap: false, corps: route, group: F.group, baseArrive: arrive, cal: ARMS[armIdOf(type)].crew ? gunCal(nat) : 0 });
    u.coh = clamp(E.K.COH0 + (q - E.K.COH0_Q0) * E.K.COH0_Q, E.K.COH0_MIN, E.K.COH0_MAX) + (WEATHER.cohesion0 || 0); u.fatigue = F.fatigue0 ?? 20;
    if (F.ammo0 && F.ammo0[route] != null) u.ammo = F.ammo0[route];
    u.reinforcement = true; E.corpsMen0[route] = (E.corpsMen0[route] || 0) + (ARMS[armIdOf(type)].crew ? 0 : str); // a fresh corps (its foot and horse)
    if (F.marches) u.arriveAt = arrive; // a force that marches on its own comes on at its minute (a battle's commanders may move it)
    u.expected = !!F.marches; E.offmap.push(u); // expected: the force marches to the field on its own (it counts in its army's strength at the start)
  }
  if (START.back || START.come) startVariant(START);
  // (phase 2) a start that holds an army back (battle pack): bodies lying behind their opening ground, and brigades still on the road, which
  // come on at the army's rear edge in order of march and halt behind their place in the line. (Waterloo's 05:00 start: see the pack.)
  function startVariant(S) {
    const sd = SIDE_BY[S.side], dir = sd.rear;
    for (const u of E.units) {
      if (u.side !== S.side) continue;
      const b = (S.back || []).find(b => (b.corps || []).includes(u.corps) || (b.units || []).includes(u.id));
      if (b) { const [dx, dy] = toRear(dir, b.dy); u.x += dx; u.y += dy; if (b[u.arm]) u.form = b[u.arm]; }
      const fp = footprint(u); u.F = fp.F; u.D = fp.D;
    }
    const C = S.come; if (!C) return;
    const [RX, RY] = ll2m(C.x[0], C.x[1]); // where the road crosses the rear edge: one point just off the map, one just on it
    const entry = dir === 'S' ? [[RX, HM + 200], [RX, HM - 30]] : dir === 'N' ? [[RX, -200], [RX, 30]] : dir === 'E' ? [[WM + 200, RY], [WM - 30, RY]] : [[-200, RY], [30, RY]];
    E.routes[C.route] = entry.concat(C.via.slice(1).map(i => ll2m(W.ROUTES[C.via[0]][i][0], W.ROUTES[C.via[0]][i][1])));
    for (const [t0, ids] of C.columns) ids.forEach((id, k) => {
      const u = E.byId[id]; if (!u) return;
      u.onMap = false; u.x = -9999; u.y = -9999; u.form = marchForm(u.type); const fp = footprint(u); u.F = fp.F; u.D = fp.D;
      u.group = C.route; u.route = C.route; u.arriveAt = t0 + k * C.every; u.baseArrive = u.arriveAt; u.expected = true;
      // they halt behind their place in the line, off the road, and wait for orders
      const [hx, hy] = toRear(dir, C.haltBehind); u.marchThen = { kind: 'move', dest: [u.deploy[0] + hx, u.deploy[1] + hy], then: 'hold' };
      E.offmap.push(u);
    });
  }
  // each army's foot and horse at the start: on the field, or marching to it on their own (forces that come only if sent for, like Grouchy's, do not count)
  for (const s of SIDE_IDS) E.armyStr0[s] = E.units.filter(u => u.side === s && (u.onMap || u.expected) && !served(u)).reduce((a, u) => a + u.str, 0);

  /* ----- leaders ----- */
  for (const L of W.LEADERS) { const l = { ...L, alive: true, wounded: false, orig: L.name }; if (L.at) { const [x, y] = ll2m(L.at[0], L.at[1]); l.x = x; l.y = y; } E.leaders[L.id] = l; if (L.unit && E.byId[L.unit]) E.byId[L.unit].leader = L.id; }
  const leaderPos = l => l.unit && E.byId[l.unit] ? [E.byId[l.unit].x, E.byId[l.unit].y] : l.x != null ? [l.x, l.y] : null;
  E.leaderPos = leaderPos;

  /* ----- start-of-game hidden draws ----- */
  // (phase 2) each army's ammunition wagons (battle pack): for an ammunition the army is short of, a hidden roll at the start says whether its
  // wagon is near, far back (reachable from a set minute) or lost. Any other ammunition is always to hand.
  E.wagons = {};
  for (const sd of SIDES) for (const [kind, w] of Object.entries(sd.wagons || {})) {
    const r = rnd(w.roll || kind + ' wagon'), state = r < w.near ? 'near' : r < w.near + w.far ? 'far' : 'lost';
    (E.wagons[sd.id] = E.wagons[sd.id] || {})[kind] = { state, from: w.farFrom, short: w.short };
    log('hidden', w.says[state], { cause: 'start roll' });
  }

  /* ----- spatial index ----- */
  const BK = 400; let buckets = new Map();
  function rebuildIndex() { buckets = new Map(); for (const u of E.units) { if (!u.onMap || u.gone || u.str <= 0) continue; const k = Math.floor(u.x / BK) + ',' + Math.floor(u.y / BK); let b = buckets.get(k); if (!b) { b = []; buckets.set(k, b); } b.push(u); } }
  function near(x, y, r, filter) { const out = []; const c0 = Math.floor((x - r) / BK), c1 = Math.floor((x + r) / BK), r0 = Math.floor((y - r) / BK), r1 = Math.floor((y + r) / BK); for (let c = c0; c <= c1; c++) for (let rr = r0; rr <= r1; rr++) { const b = buckets.get(c + ',' + rr); if (!b) continue; for (const u of b) if (hyp(u.x - x, u.y - y) <= r && (!filter || filter(u))) out.push(u); } return out; }
  E.near = near; E.rebuildIndex = rebuildIndex;
  const enemyOf = s => SIDE_IDS.filter(x => COAL[x] !== COAL[s]);
  const isEnemy = (a, b) => COAL[a.side] !== COAL[b.side]; // armies of one coalition do not fight each other
  E.isEnemy = isEnemy; E.enemyOf = enemyOf;
  const alive = u => u.onMap && !u.gone && u.str > 0;
  const formed = u => alive(u) && u.status !== 'broken';
  E.alive = alive; E.formed = formed;

  /* ----- tasks and formations ----- */
  function setForm(u, f) { if (u.form === f || u.formTo === f) return; if (u.held) return; if (allRound(f) && (u.status === 'disordered' || u.status === 'broken' || u.form === 'mass' || !canAllRound(u))) return; u.formTo = f; u.formTimer = FORM_TICKS(u, f); }
  E.setForm = setForm;
  function setTask(u, task, cause) { u.task = Object.assign({ since: E.t }, task); u.path = null; u.halted = false; if (cause) u.task.cause = cause; }
  E.setTask = setTask;
  function routeTo(u, dest, march) { dest = [clamp(dest[0], 10, WM - 10), clamp(dest[1], 10, HM - 10)]; // (7) a destination past the edge of the map was never reached
    if (march) { u.path = astar(E, A(u).move, u.x, u.y, dest[0], dest[1]); } else u.path = [dest]; u.pathDest = dest; }
  E.routeTo = routeTo;

  /* ----- order delivery (riders) ----- */
  E.sendOrder = function (o) {
    // o: { from, to, kind, ..., urgent, conditions }. Delay = writing + riding; interpretation delay applied by the receiver.
    const from = E.leaders[o.from], to = E.leaders[o.to] || null;
    const fp = from ? leaderPos(from) : null, tp = to ? leaderPos(to) : (o.unitTo && E.byId[o.unitTo] ? [E.byId[o.unitTo].x, E.byId[o.unitTo].y] : null);
    const dist = fp && tp ? hyp(fp[0] - tp[0], fp[1] - tp[1]) : 1500;
    const OR = ERA.orders, wr = (from && from.writes) || OR.write; // minutes to write: the sender's habit (leader file), else the era's
    const write = o.writeMin ?? rnd.range(wr[0], wr[1], 'order writing') * (o.urgent ? 0.5 : 1);
    const speed = (OR.rider * (1 - OR.riderWet * E.wet) * 1000 / 60); // cross-country rider, m/min
    const ride = o.rideMin ?? dist / speed;
    const interp = o.interpMin ?? (o.direct ? rnd.range(OR.interpDirect[0], OR.interpDirect[1], 'interpretation') : rnd.range(OR.interp[0], OR.interp[1], 'interpretation'));
    o.sentAt = E.t; o.arriveAt = E.t + write + ride; o.actAt = o.arriveAt + interp; o.status = 'riding';
    E.orders.push(o); return o;
  };

  /* ----- events & causes ----- */
  E.cause = (text, links) => { const c = { t: E.t, text, links: links || [] }; E.causes.push(c); return E.causes.length - 1; };

  /* ===================== tick ===================== */
  E.step = function () {
    if (E.over) return;
    wetness();
    rebuildIndex();
    arrivals();
    // commanders (AI) and order delivery
    if (!E.command) for (const o of E.orders) if (o.status === 'riding' && E.t >= o.actAt) { o.status = 'acting'; if (E.ai) E.ai.receive(E, o); }
    if (E.ai) E.ai.tick(E);
    reactions();
    movement();
    rebuildIndex();
    for (const u of E.units) { u.hitTick.mus = u.hitTick.art = u.hitTick.flank = u.hitTick.cav = 0; u.firedTick = false; u.casTick = 0; }
    fire();
    skirmishFarms();
    assaults();
    if (E.K.MELEE_LOCK) melees();
    cavalry();
    applyDamage();
    cohesionAndMorale();
    supplyAndFatigue();
    if (ERA.fieldwork) works();
    stepSmoke();
    events();
    if (E.tick % 5 === 0) sighting();
    if (E.command) E.command.tick();
    keyPoints();
    for (const s of SIDE_IDS) E.morale[s] = clamp(E.morale[s], 0, 100); // (7) events after the morale step could leave it outside 0-100 for a tick
    endCheck();
    E.t += 2; E.tick++;
    if (E.tick % 15 === 0) E.history_.push(snapshotLite());
    if (E.t % 60 === 0) E.moraleAt = Object.assign(E.moraleAt || {}, { [E.t]: { ...E.morale } });
  };

  /* ----- arrivals of off-map forces ----- */
  function arrivals() {
    for (const u of E.offmap) {
      if (u.onMap || u.gone || u.arriveAt == null || E.t < u.arriveAt) continue;
      const route = E.routes[u.route || ROUTE_OF[u.corps] || u.corps];
      if (!route) continue;
      // choke point: the Lasne crossing limits throughput
      u.onMap = true; const [sx, sy] = route[0];
      // enter just inside the edge on the first on-map waypoint
      u.x = route[1][0]; u.y = route[1][1]; u.facing = bearing(route[2][0] - u.x, route[2][1] - u.y);
      u.form = A(u).column; const fp = footprint(u); u.F = fp.F; u.D = fp.D;
      setTask(u, { kind: 'march', route: route.slice(2), then: u.marchThen || null });
      u.path = route.slice(2).map(p => [p[0], p[1]]);
      log('arrival', `${u.name} appears at the edge of the field.`, { side: u.side, unit: u.id, hidden: true });
      if (E.command && E.command.noteOwn && E.command.side === u.side) E.command.noteOwn(u, 'seen coming up the high road');
      if (E.ai && E.ai.onArrival) E.ai.onArrival(E, u);
    }
  }

  /* ----- local reactions: squares, facing threats, lying down ----- */
  function reactions() {
    for (const u of E.units) {
      if (!formed(u) || served(u)) continue;
      if (u.formTimer > 0) continue;
      const cavNear = canAllRound(u) ? near(u.x, u.y, 650, e => isEnemy(u, e) && charges(e) && formed(e) && e.charge && e.charge.target === u.id) : [];
      if (canAllRound(u) && cavNear.length) {
        // warning depends on seeing them: crest, smoke
        for (const c of cavNear) { const l = losU(u, c, 1.8); const d = hyp(c.x - u.x, c.y - u.y); if (l.clear && l.trans > 0.35 && d < 600 * l.trans + 50) { if (!allRound(u.form) && !allRound(u.formTo)) { setForm(u, ALL_ROUND); u.squareFor = c.id; } break; } }
      } else if (allRound(u.form) && u.formTo == null) {
        const anyCav = near(u.x, u.y, 800, e => isEnemy(u, e) && charges(e) && formed(e));
        if (!anyCav.length) setForm(u, u.prevForm || natOf(u).form || 'columns');
      }
      // wheel to face a close threat that is not in front, unless already engaged to the front
      if (foot(u) && !allRound(u.form) && !u.path && u.task.kind !== 'garrison') {
        const th = near(u.x, u.y, 400, e => isEnemy(u, e) && formed(e) && !served(e));
        if (th.length) { let best = null, bd = 1e9; for (const e of th) { const d = hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
          const front = th.some(e => hyp(e.x - u.x, e.y - u.y) < 220 && angDiff(u.facing, bearing(e.x - u.x, e.y - u.y)) < 60);
          if (!front && angDiff(u.facing, bearing(best.x - u.x, best.y - u.y)) > 60) u.facing = bearing(best.x - u.x, best.y - u.y); }
      }
      // lie down behind the crest under bombardment when no enemy foot or horse is close (Wellington's habit)
      if (natOf(u).lieDown && foot(u) && u.task.kind === 'hold' && u.task.lieDown) {
        const threat = near(u.x, u.y, 450, e => isEnemy(u, e) && formed(e) && !served(e) && !e.held).length;
        u.lying = !threat && !allRound(u.form);
      } else if (u.lying && u.task.kind !== 'hold') u.lying = false;
    }
  }

  /* ----- movement ----- */
  function speedOf(u) {
    const tt = TT[cellIdx(u.x, u.y)], wet = wetAt(u.x, u.y);
    const sp = A(u).speed, M = MOVES[A(u).move], fr = FORMS[u.form];
    const base = u.horse ? sp.horse : (sp[u.pace] ?? sp.walk); // the arm's pace (horse artillery, from the battle's traits, keeps up with the cavalry)
    let f = terrainSpeed(A(u).move, tt, wet);
    if (fr && fr.column && tt === T.ROAD) f = M.ROAD; else if (fr && fr.lane != null && tt === T.LANE) f = (M.LANE[0] - M.LANE[1] * wet) + fr.lane; // columns keep to the roads
    if (fr) { if (fr.pace != null) f = fr.pace; else if (fr.speed != null) f *= fr.speed; } // the formation's own pace
    // (7) a square edges along at a fifth of the pace (est.); (8) for any task, not only a retreat: a party in square with enemy horse in sight
    // could not move at all before, and stood for hours. (8) the battery clause was cut off by a comment in (7); it never mattered, since guns limber to move.
    if (u.fatigue > 75) f *= 0.75; else if (u.fatigue > 50) f *= 0.9;
    // uphill
    if (u.path && u.path.length) { const [tx, ty] = u.path[0], d = hyp(tx - u.x, ty - u.y); if (d > 1) { const ahead = Math.min(50, d), nx = u.x + (tx - u.x) / d * ahead, ny = u.y + (ty - u.y) / d * ahead, gr = (hAt(nx, ny) - hAt(u.x, u.y)) / ahead; if (gr > 0.08) f *= 0.7; else if (gr > 0.05) f *= 0.85; } }
    if (u.status === 'broken') f = Math.max(f, 0.6) * A(u).flee;
    return base * f;
  }
  E.speedOf = speedOf;
  function movement() {
    for (const u of E.units) {
      if (!alive(u)) continue;
      // formation change in progress
      if (u.formTimer > 0) { u.formTimer--; if (u.formTimer === 0 && u.formTo) { if (allRound(u.formTo)) u.prevForm = u.form; u.form = u.formTo; u.formTo = null; const fp = footprint(u); u.F = fp.F; u.D = fp.D; } continue; }
      if (u.held && u.status !== 'broken') continue;
      if (u.status === 'broken') { flee(u); continue; }
      if (u.task.kind === 'garrison' && u.spId) continue;
      if (!u.path || !u.path.length) continue;
      if (u.halted) continue;
      // artillery must limber to move
      if (served(u) && FORMS[u.form] && FORMS[u.form].deployed) { if (hyp(u.path[u.path.length - 1][0] - u.x, u.path[u.path.length - 1][1] - u.y) > 60) { u.formTo = A(u).column; u.formTimer = 1; continue; } else { u.path = null; continue; } }
      let budget = speedOf(u) * 2;
      while (budget > 0 && u.path.length) {
        const [tx, ty] = u.path[0], dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy);
        if (d < 1) { u.path.shift(); continue; }
        const stopShort = u.path.length === 1 && u.stopAt ? u.stopAt : 0;
        let go = Math.min(budget, d - stopShort);
        if (d - stopShort <= 0.5) { u.path.shift(); break; } // there (or as close as it means to go)
        if (go <= 0.5) break; // (8) the tick's march is spent; this was path.shift(), which dropped the next waypoint whenever a tick ended within half a metre of one
        const spent = go;
        if (E.obstacles.length) { // (2g) crossing a hedge, wall or ditch costs pace and order; a body that cannot cross it formed halts at it
          const c = crossed(u.x, u.y, u.x + dx / d * go, u.y + dy / d * go);
          if (c && u.crossedOb !== c.o) { const f = c.o.K.cross[A(u).move] ?? 1; if (!f) { go = Math.max(0, go * c.t - 3); budget = 0; } else { go *= f; u.coh -= c.o.K.disorder || 0; u.crossedOb = c.o; } }
          else if (!c) u.crossedOb = null;
        }
        u.x += dx / d * go; u.y += dy / d * go; budget -= spent;
        if (u.status !== 'broken' && go > 5) u.facing = bearing(dx, dy);
        if (go >= d - 0.5) u.path.shift();
        u.movedTick = E.tick;
        // choke point: one column files through at a time (the Lasne crossing)
        let held = false;
        for (const ch of E.chokes) if (hyp(u.x - ch.x, u.y - ch.y) < ch.r && FORMS[u.form] && FORMS[u.form].column) {
          // (7) the column filing through is only the current one while it is still in column, on the move and of the same army; before,
          // a brigade that stopped in the defile, or an enemy one sent there, kept it shut for the rest of the day
          const cu = ch.cur && E.byId[ch.cur], filing = cu && alive(cu) && cu.side === u.side && FORMS[cu.form] && FORMS[cu.form].column && cu.path && cu.path.length && hyp(cu.x - ch.x, cu.y - ch.y) <= ch.r + 60;
          if (!filing) { if (ch.cur !== u.id) { ch.cur = u.id; ch.until = E.t + (u.str * (A(u).roadMen || 1)) / (ch.rate * (wetAt(ch.x, ch.y) > 0.7 ? 0.5 : 1)); } }
          if (ch.cur !== u.id || E.t < ch.until) { held = true; }
        }
        if (held) { const ch = E.chokes.find(c => hyp(u.x - c.x, u.y - c.y) < c.r); if (ch && ch.cur === u.id && E.t < ch.until) { budget = 0; } else if (ch && ch.cur !== u.id) { u.x -= dx / d * go; u.y -= dy / d * go; budget = 0; } }
      }
      u.x = clamp(u.x, 5, WM - 5); u.y = clamp(u.y, 5, HM - 5);
      if (!u.path.length) {
        u.path = null;
        if (u.task.arriveFacing != null) u.facing = u.task.arriveFacing;
        if (u.task.arriveForm) setForm(u, u.task.arriveForm);
        if (served(u) && u.form === A(u).column && u.task.kind !== 'march') { u.formTo = u.task.parkForm || A(u).deploys; u.formTimer = 1; }
      }
    }
  }
  function flee(u) {
    // run toward the army's rear along the retreat road
    const sd = SIDE_BY[u.side], route = E.routes[sd.retreat];
    let best = route[route.length - 1], bi = route.length - 1;
    for (let i = 0; i < route.length; i++) { const p = route[i]; const ahead = rearOf(sd.rear, p, u, 200); if (ahead) { best = p; bi = i; break; } }
    const enemies = near(u.x, u.y, 700, e => isEnemy(u, e) && formed(e));
    let vx = best[0] - u.x, vy = best[1] - u.y; const L = hyp(vx, vy) || 1; vx /= L; vy /= L;
    for (const e of enemies) { const dx = u.x - e.x, dy = u.y - e.y, d = hyp(dx, dy) || 1; vx += dx / d * 0.6; vy += dy / d * 0.6; }
    const L2 = hyp(vx, vy) || 1, sp = speedOf(u) * 2;
    u.x = clamp(u.x + vx / L2 * sp, 5, WM - 5); u.y = clamp(u.y + vy / L2 * sp, 5, HM - 5); u.facing = bearing(vx, vy);
    // leaving the field
    if (offEdge(sd.rear, u, 60)) { u.gone = true; u.left = E.t; }
  }

  /* ----- fire ----- */
  const dmg = new Map(), secFire = new Map(); // secFire: muskets already firing at a garrison's section this tick
  function addDmg(t, cas, kind, flank, src) { if (E.onDmg) E.onDmg(t, cas, kind, src); let d = dmg.get(t.id); if (!d) { d = { mus: 0, art: 0, flank: 0, srcs: [] }; dmg.set(t.id, d); } d[kind] += cas; if (flank) d.flank += cas; if (src && d.srcs.length < 4) d.srcs.push(src.id); }
  function frontRange(a, b) {
    if (b.spSec) return Math.max(40, hyp(a.x - b.spSec.x, a.y - b.spSec.y) - b.spSec.r - a.D / 2);
    if (a.spSec) return Math.max(40, hyp(b.x - a.spSec.x, b.y - a.spSec.y) - a.spSec.r - b.D / 2);
    return Math.max(25, hyp(a.x - b.x, a.y - b.y) - (a.D + b.D) / 2);
  }
  function onFlank(t, from) { if (allRound(t.form) || t.held) return false; return angDiff(t.facing, bearing(from.x - t.x, from.y - t.y)) > 100; }
  E.onFlank = onFlank;
  const fireCount = new Map();
  // (Ligny, est.) an open village (a section marked street: houses, gardens and hedges, no continuous wall): foot fighting within K.EDGE_R of
  // its edge are among its outlying houses too, so they take cover (K.EDGE_COVER times the section's cover) and spread out to fire (at least
  // K.EDGE_FIRE of their men). Walled farms keep the siege rules. A battle with no street section (Waterloo) is unchanged.
  const edgeCache = new Map();
  function edgeSec(u) {
    if (!E.streetSecs.length || !E.K.EDGE_COVER || u.spSec || served(u) || !foot(u)) return null;
    if (edgeCache.has(u.id)) return edgeCache.get(u.id);
    let found = null; const side = sideKey(u);
    for (const s of E.streetSecs) if (s.held && s.held !== side && !s.burnt && hyp(u.x - s.x, u.y - s.y) < s.r + E.K.EDGE_R + u.D / 2) { found = s; break; }
    edgeCache.set(u.id, found); return found;
  }
  // (6) skirmish fire round held farms: see K.SKIRM_*. No dice, so with SKIRM_AMMO at 0 nothing changes.
  function skirmishFarms() {
    if (!E.K.SKIRM_AMMO) return;
    for (const g of E.units) {
      if (!formed(g) || !g.held || !g.spId) continue;
      const sp = E.spById[g.spId], foes = near(sp.x, sp.y, E.K.SKIRM_R, e => isEnemy(g, e) && formed(e) && foot(e) && !e.spId);
      let press = 0, tgt = null, men = 0;
      if (foes.length) {
        men = foes.reduce((a, e) => a + e.str, 0); press = clamp(men / E.K.SKIRM_FULL, 0, 1);
        let td = Infinity; for (const e of foes) { const d = hyp(e.x - sp.x, e.y - sp.y); if (d < td) { td = d; tgt = e; } }
        sp.skirmT = E.t; sp.skirmBy = tgt.id; sp.skirmP = Math.max(press, sp.skirmP && E.t - sp.skirmT < 4 ? sp.skirmP : 0);
      } else if (sp.skirmT != null && E.t - sp.skirmT < E.K.SKIRM_HOLD && sp.holder === sideKey(g)) {
        // the skirmishers stay in the hedges and hollows round the farm after their columns have gone back (est.)
        press = E.K.SKIRM_LINGER * Math.min(1, sp.skirmP || 1); men = press * E.K.SKIRM_FULL;
        const by = E.byId[sp.skirmBy]; tgt = by && formed(by) ? by : null;
      }
      if (!press || g.firedTick) continue;
      const wp = weaponOf(g), rifle = wp.longHit, sec = g.spSec, cover = sec ? sec.cover : 0.4;
      if (g.ammo > 0) {
        const firers = Math.min(g.str, sec ? sec.cap : g.str) * 0.6 * press;
        if (tgt) addDmg(tgt, firers * 2 * (rifle ? wp.rate * rifle.mul : 1) * E.K.SKIRM_P * g.q * (g.ammo < 15 ? 0.5 : 1) * duskFire(E.t), 'mus', false, g);
        g.ammo = Math.max(0, g.ammo - E.K.SKIRM_AMMO * press);
      }
      addDmg(g, men * E.K.SKIRM_SHARE * 2 * E.K.SKIRM_P * cover * (cover <= 0.3 ? E.K.WALL_FIRE : 1) * duskFire(E.t), 'mus', false, tgt);
    }
  }
  function fire() {
    dmg.clear(); fireCount.clear(); secFire.clear(); edgeCache.clear();
    const dusk = duskFire(E.t);
    for (const u of E.units) {
      if (!formed(u) || u.formTo === 'limbered') continue;
      const wp = weaponOf(u); if (!wp) continue; // (phase 2) what it fires: small arms, or guns served by a crew
      if (!served(u)) {
        if (u.lying || (FORMS[u.form] && FORMS[u.form].column) || u.ammo <= 0) continue;
        const cands = near(u.x, u.y, wp.reach + 30, e => isEnemy(u, e) && alive(e));
        let best = null, br = Infinity;
        for (const e of cands) {
          const r = frontRange(u, e); if (r > wp.reach) continue;
          if (!allRound(u.form) && !u.held && angDiff(u.facing, bearing(e.x - u.x, e.y - u.y)) > wp.arc) continue;
          const edgeFight = (e.spSec && hyp(u.x - e.spSec.x, u.y - e.spSec.y) < e.spSec.r + 200) || (u.spSec && hyp(e.x - u.spSec.x, e.y - u.spSec.y) < u.spSec.r + 200);
          if (!edgeFight && !losU(u, e, 1.7).clear) continue;
          const pr = r - (e.task.kind === 'attack' && e.task.targetUnit === u.id ? 40 : 0);
          if (pr < br) { br = pr; best = e; }
        }
        if (!best) continue;
        if (!E.flags.opened && frontRange(u, best) > 200 && E.tick - u.lastHit > 5) continue;
        if (!E.flags.opened) { E.flags.opened = E.t; log('army', 'Musketry breaks out: the battle has begun.', { important: true }); }
        const r = frontRange(u, best), sec = u.spSec, men = sec ? Math.min(u.str, sec.cap) : u.str;
        const ov = clamp((best.F + 80) / Math.max(40, u.F), 0.25, 1);
        const edge = edgeSec(u);
        let firers = men * (edge ? Math.max(fireFrac(u), E.K.EDGE_FIRE) : fireFrac(u)) * ov * (u.formTimer > 0 ? 0.5 : 1);
        if (best.spSec && E.K.SEC_FIRE_PER_M) { // only so many muskets can bear on a farm's walls: about this many per metre of its perimeter (est.)
          const cap = 2 * Math.PI * best.spSec.r * E.K.SEC_FIRE_PER_M, used = secFire.get(best.id) || 0; secFire.set(best.id, used + firers); firers = Math.min(firers, Math.max(0, cap - used)); }
        const close = r < 110 && (best.task.kind === 'attack' || u.task.kind === 'attack');
        u.closeTicks = close && u.closeWith === best.id ? (u.closeTicks || 0) + 1 : close ? 1 : 0; u.closeWith = close ? best.id : null;
        const rate = close ? (u.closeTicks <= 2 ? 2 : 1.2) : 1;
        let p = hitChance(r, wp.hit || HIT); if (wp.longHit && r > wp.longHit.beyond) p *= wp.longHit.mul; // a rifle's reach past the musket's
        const tcell = TT[cellIdx(best.x, best.y)], sc = best.spSec || (best.secCover && hyp(best.x - best.secCover.x, best.y - best.secCover.y) < best.secCover.r ? best.secCover : null);
        let cover = sc ? sc.cover : (COVER[tcell] ?? 1);
        if (!sc) { const es = edgeSec(best); if (es) cover = Math.min(cover, es.cover * E.K.EDGE_COVER); }
        const sh = shelterOf(u, best, 60); if (sh) cover *= sh.K.cover ?? 1; // (2g) behind a hedge or wall
        const sm = clamp(1 - 0.25 * smokeAt(u.x, u.y), 0.6, 1);
        const fv = wp.volley, first = fv && !u.volleyUsed && r < fv.within ? fv.mul : 1; if (first > 1) u.volleyUsed = true; // a first volley, loaded with care
        const am = u.ammo < 15 ? 0.5 : 1;
        let hits = firers * rate * wp.rate * 2 * p * u.q * Math.min(1.1, u.coh / 80) * sm * cover * (best.spSec && cover <= 0.3 ? E.K.WALL_FIRE : 1) * (best.lying ? 0.4 : 1) * dusk * first * am * E.K.FIRE * statusFire(u);
        const prot = A(best).protection; if (prot) hits *= 1 - prot * (1 - (wp.pen ?? 1)); // (2f) armour turns some of what hits it
        addDmg(best, hits, 'mus', onFlank(best, u), u);
        u.ammo = Math.max(0, u.ammo - rate * 2 * wp.rate * (firers / Math.max(1, u.str)));
        u.firedTick = true; u.lastFired = E.tick; u.fireTarget = best.id;
        if (wp.smoke !== 0) addSmoke(u.x, u.y, firers * rate * 2 * E.K.SMOKE_MUSKET * (wp.smoke ?? 1)); // bows make none
        if (r < 300) u.inContact = best.id;
      } else {
        if (!(FORMS[u.form] && FORMS[u.form].deployed)) continue;
        if (u.rounds <= 0 || E.t < u.silencedUntil || u.str < 0.5) continue;
        const tgt = pickArtTarget(u); if (!tgt) continue;
        if (u.form === 'park' && u.task.kind !== 'bombard' && tgt.r > 900) continue;
        if (!E.flags.opened && u.task.kind !== 'bombard' && E.tick - u.lastHit > 5 && !(tgt.r < 900 && (tgt.e.task.kind === 'attack' || tgt.e.charge))) continue;
        if (tgt.r > (E.flags.opened ? 1400 : 1000) && u.task.kind !== 'bombard') continue;
        const { e, r } = tgt; const vis = e.held ? Math.min(0.5, tgt.vis) : tgt.vis;
        const guns = u.str * (u.form === 'park' ? 0.85 : 1), rate = stepBy(wp.rateByCal, u.cal, wp.rateElse), rounds = guns * rate * 2;
        let per;
        const can = canister(r, u.cal);
        if (can > 0 && vis >= 0.5) per = can; else per = roundshot(r, u.cal) * (2 - wetAt(e.x, e.y));
        const ad = A(e).density; let dens = ad ? (ad[e.form] ?? ad._) : e.held ? PLACE.density : (DENSITY[e.form] ?? 1);
        if (can > 0 && vis >= 0.5) dens = Math.pow(dens, 0.3); // canister is a cone: depth matters little
        const cover = e.spSec ? e.spSec.cover : 1, sm = clamp(1 - 0.2 * smokeAt(e.x, e.y), 0.6, 1);
        const sizeF = can > 0 && vis >= 0.5 ? clamp(e.F / 80, 0.3, 1) : clamp(e.F / 150, 0.15, 1) * clamp(e.D / 40, 0.5, 1.5);
        const hits = rounds * per * dens * sizeF * vis * cover * sm * duskFire(E.t) * E.K.ARTY * clamp(u.coh / 80, 0.5, 1.1);
        addDmg(e, hits, 'art', false, u); fireCount.set(e.id, (fireCount.get(e.id) || 0) + 1);
        u.rounds -= rate * 2; u.firedTick = true; u.lastFired = E.tick; u.fireTarget = e.id; u.fireVis = vis;
        addSmoke(u.x, u.y, rounds * E.K.SMOKE_GUN);
        // shells can fire buildings
        if (e.spSec && e.spSec.burnable && u.shells > 0 && !e.spSec.burnt) {
          const p = 1 - Math.pow(1 - wp.fireBuildings * (u.task.incendiary ? 3 : 1), u.shells * 2 * rate * vis);
          if (rnd('building fire') < p) burnSection(E.spById[e.spId], e.spSec, u);
        }
        if (served(e) && rnd('caisson') < wp.caisson * Math.min(10, hits)) { addDmg(e, 0.5, 'art', false, u); e.coh -= 10; log('event', `A caisson explodes in ${e.name}'s battery.`, { side: e.side, unit: e.id }); }
      }
    }
  }
  function statusFire(u) { return u.status === 'shaken' ? 0.9 : u.status === 'disordered' ? 0.6 : 1; }
  function pickArtTarget(u) {
    const cands = near(u.x, u.y, weaponOf(u).reach, e => isEnemy(u, e) && alive(e) && !(charges(e) && e.charge && e.charge.phase === 'charge'));
    let best = null, bs = -1;
    const area = u.task.kind === 'bombard' ? u.task.area : null;
    for (const e of cands) {
      const r = hyp(e.x - u.x, e.y - u.y); if (r > weaponOf(u).reach) continue;
      // don't fire over friends close to the target
      if (near(e.x, e.y, 120, f => !isEnemy(u, f) && formed(f) && f !== u).length) continue;
      let l = losU(u, e, 2.2);
      if (!l.clear && e.spSec) { const d0 = hyp(e.x - u.x, e.y - u.y) || 1, k = Math.max(0, 1 - e.spSec.r * 0.85 / d0); l = los(u.x, u.y, 2.2, u.x + (e.x - u.x) * k, u.y + (e.y - u.y) * k, 3); }
      let vis = 0;
      if (l.clear && rnd('art spotting') < Math.max(0.15, l.trans)) { const half = los(u.x, u.y, 2.2, e.x, e.y, 0.9); vis = half.clear ? 1 : 0.5; }
      else if (area) { const c = E.contacts[COAL[u.side]][e.id]; if (c && E.t - c.t < 30 && hyp(c.x - e.x, c.y - e.y) < 200) vis = 0.2; else if (polyDist(e.x, e.y, area) < 350 && !e.held) vis = E.K.BLIND; }
      if (!vis) continue;
      if (area && polyDist(e.x, e.y, area) > 500 && r > 600) continue;
      const dens = DENSITY[e.form] ?? 1.5, threat = foot(e) && e.task.kind === 'attack' ? 1.6 : 1;
      const score = 1 / (1 + (fireCount.get(e.id) || 0) * 1.5) * (e.held && !(area && e.spId && polyDist(e.x, e.y, area) < 50) && u.task.targetUnit !== e.id ? 0.25 : 1) * vis * dens * threat * (r < 600 ? 2 : r < 1000 ? 1.2 : 0.6) * (served(e) ? (r < 900 ? 0.8 : 0.3) : 1) * (u.task.targetUnit === e.id ? 3 : 1);
      if (score > bs) { bs = score; best = { e, vis, r }; }
    }
    return best;
  }
  function burnSection(sp, sec, by) {
    if (sec.burnt) return; sec.burnt = true; sec.held = null;
    const c = E.cause(`Howitzer shells from ${by.name} set the ${sec.name} of ${sp.name} on fire`);
    log('event', `The ${sec.name} of ${sp.name} ${/s$/.test(sec.name) ? 'are' : 'is'} on fire.`, { cause: c, sp: sp.id });
    if (E.command) E.command.onFire(sp, sec);
    const g = E.byId[sp.garrison];
    if (g && g.spSec === sec) { const nxt = sp.secs.find(s => s.held === sideKey(g) && !s.burnt); if (nxt) { g.spSec = nxt; g.x = nxt.x; g.y = nxt.y; } else evictGarrison(sp, g, 'fire'); }
    if (g) g.coh -= 6;
    refreshHolder(sp, null, c);
  }

  /* ----- infantry assaults and strongpoints ----- */
  function assaults() {
    for (const u of E.units) {
      if (!formed(u) || !A(u).assaults || u.held || u.task.kind !== 'attack' || u.halted) continue;
      if (u.formTimer > 0 || (u.standoffUntil && E.tick < u.standoffUntil) || u.melee) continue; // (2f) a locked melee is fought in melees()
      const tgt = currentTarget(u); if (!tgt) continue;
      const r = tgt.range;
      if (r > 55) { u.contactTicks = 0; continue; }
      if (FORMS[u.form] && FORMS[u.form].column) { setForm(u, u.task.form || 'attack'); continue; } // (8) a column of route deploys before it can assault
      u.contactTicks = (u.contactTicks || 0) + 1;
      if (u.contactTicks % 2 !== 1) continue; // test every other tick while in contact
      shock(u, tgt);
    }
  }
  // (8) how far in front of its centre a body reaches for an assault: half its depth, except a column of route, whose depth runs back along
  // the road (half of it was 900 m for a big brigade, so a column a kilometre off "reached" a village and was set down inside it)
  const reachD = u => (FORMS[u.form] && FORMS[u.form].column) ? 30 : u.D / 2;
  function currentTarget(u) {
    const t = u.task;
    if (t.targetUnit) { const e = E.byId[t.targetUnit]; if (e && formed(e) && e.spId) { t.sp = e.spId; t.targetUnit = null; } else if (e && formed(e)) return { unit: e, range: frontRange(u, e) }; else t.targetUnit = null; }
    if (t.sp) { const sp = E.spById[t.sp]; const sec = sp.secs.find(s => s.held && s.held !== sideKey(u) && !s.burnt); if (sec) { const g = E.byId[sp.garrison]; const r = Math.max(10, hyp(u.x - sec.x, u.y - sec.y) - sec.r - reachD(u)); return { sp, sec, unit: g && formed(g) ? g : null, range: r }; } }
    // nearest enemy in front within 120 m blocks the way
    const blk = near(u.x, u.y, 160, e => isEnemy(u, e) && formed(e) && !served(e) && !e.spId);
    let best = null, br = Infinity; for (const e of blk) { const r = frontRange(u, e); if (r < br && angDiff(u.facing, bearing(e.x - u.x, e.y - u.y)) < 80) { br = r; best = e; } }
    if (best) { u.task.targetUnit = best.id; return { unit: best, range: br }; }
    const gar = near(u.x, u.y, 260, e => isEnemy(u, e) && formed(e) && e.spId)[0];
    if (gar) { const sp = E.spById[gar.spId]; const sec = sp && sp.secs.find(s => s.held && s.held !== sideKey(u) && !s.burnt); if (sec) { u.task.sp = sp.id; return { sp, sec, unit: gar, range: Math.max(10, hyp(u.x - sec.x, u.y - sec.y) - sec.r - reachD(u)) }; } }
    return null;
  }
  const sideKey = u => COAL[u.side]; // armies of one coalition share control of places
  function shock(a, tgt) {
    const K_ = E.K, d = tgt.unit;
    if (!d) { // empty section: walk in
      if (tgt.sec) takeSection(a, tgt.sp, tgt.sec, null); return;
    }
    const lead = u => u.leader && E.leaders[u.leader] && E.leaders[u.leader].alive ? 1 + 0.15 * E.leaders[u.leader].exp : 1;
    const fresh = u => 1 - u.fatigue / 250;
    const sizeF = clamp(Math.pow(a.str / Math.max(1, Math.min(d.str, tgt.sec ? tgt.sec.cap : d.str)), 0.2), 0.6, 1.6);
    if (a.gateBonus && a.gateAt != null && E.tick - a.gateAt > 2) a.gateBonus = false; // a broken gate is only good for the rush that follows it
    const push = a.coh * a.q * (MASSF[a.form] ?? 1) * fresh(a) * lead(a) * sizeF * (onFlank(d, a) ? 1.6 : 1) * (a.gateBonus ? 1.5 : 1);
    const cover = tgt.sec ? tgt.sec.cover : (COVER[TT[cellIdx(d.x, d.y)]] ?? 1);
    let melee = (tgt.sec && cover <= 0.3) ? (d.outOfAmmo ? K_.NOAMMO_MELEE : 2) : Math.sqrt(1 / cover); // defenders with no cartridges can no longer hold the loopholes
    const sh = !tgt.sec && shelterOf(a, d, 40); if (sh) melee *= sh.K.melee ?? 1; // (2g) defending a hedge, wall or palisade
    const volley = dmg.get(a.id) ? clamp(dmg.get(a.id).mus / Math.max(1, a.str) * 100 / 3, 0, 2) * 10 : 0;
    const formD = (FORMS[d.form] && FORMS[d.form].meleeD) ?? A(d).meleeD ?? 1; // how well its formation, else its arm, stands an assault
    const resolve = d.coh * d.q * melee * formD * fresh(d) * lead(d) + volley;
    const ratio = push / Math.max(1, resolve) * rnd.logn(K_.SHOCK_SIGMA, 'shock test');
    const where = tgt.sp ? `${tgt.sec.name} of ${tgt.sp.name}` : d.name;
    const bloody = (tgt.sec && cover <= 0.3) || d.status === 'disordered';
    const wallD = tgt.sec && cover <= 0.3 ? K_.WALL_SHOCK : 1; // defenders behind walls are hardly shaken by an assault they beat off (est.)
    if (bloody) { const fa = rnd.range(0.02, 0.05, 'melee'), fd = rnd.range(0.02, 0.05, 'melee') * (tgt.sec && cover <= 0.3 ? K_.WALL_MELEE : 1); addCas(a, a.str * fa, 'melee'); addCas(d, d.str * fd, 'melee'); }
    if (ratio < K_.SHOCK_REPULSE) {
      a.coh -= 10 + rnd('shock') * 10; d.coh -= 2 * wallD; a.stalemates = 0;
      const c = E.cause(`${a.name}'s attack on ${where} was thrown back (push ${push.toFixed(0)} against resolve ${resolve.toFixed(0)})`);
      log('combat', `${a.name} is thrown back from ${where}.`, { side: a.side, unit: a.id, cause: c });
      repulse(a, c);
      if (E.ai && E.ai.onRepulse) E.ai.onRepulse(E, a, d, tgt);
    } else if (ratio < K_.SHOCK_WIN && K_.MELEE_LOCK && !tgt.sec && !served(d)) {
      lockMelee(a, d); // (2f) neither gives way: hand to hand, until one side breaks or draws off
    } else if (ratio < K_.SHOCK_WIN) {
      a.coh -= 3; d.coh -= 3 * wallD; a.stalemates = (a.stalemates || 0) + 1; a.standoffUntil = E.tick + 3 + Math.floor(rnd('firefight length') * 4);
      if (a.stalemates >= 4) { a.coh -= 5; }
    } else if (tgt.sec && cover <= 0.3 && a.gateBonus && K_.GATE_HOLD && !d.outOfAmmo && d.coh >= K_.GATE_HOLD && !tgt.sec.burnt) {
      // a gate broken in against defenders still in good order: the party that got in is shut in and killed, as at Hougoumont's north gate
      addCas(a, a.str * rnd.range(0.01, 0.03, 'shut in'), 'melee'); a.coh -= 8; d.coh -= 4; a.stalemates = (a.stalemates || 0) + 1; a.standoffUntil = E.tick + 3 + Math.floor(rnd('firefight length') * 4);
      log('combat', `The men who broke into ${where} are shut in and cut down; the defenders close the gate behind them.`, { side: d.side, unit: d.id, important: !!tgt.sp });
    } else if (tgt.sec && cover <= 0.3 && !a.gateBonus && !d.outOfAmmo && d.coh >= K_.WALL_HOLD && !tgt.sec.burnt) {
      // walls hold unless a gate is broken, the defenders' cartridges are gone, or they are already shaken to pieces
      a.coh -= 4; d.coh -= 2 * wallD; a.stalemates = (a.stalemates || 0) + 1; a.standoffUntil = E.tick + 3 + Math.floor(rnd('firefight length') * 4);
    } else {
      d.coh -= 15 + rnd('shock') * 10; a.coh -= 4; a.stalemates = 0;
      const c = E.cause(`${a.name} broke into ${where} (push ${push.toFixed(0)} against resolve ${resolve.toFixed(0)})`);
      log('combat', `${a.name} drives the defenders out of ${where}.`, { side: a.side, unit: a.id, cause: c, important: !!tgt.sp });
      if (tgt.sec) takeSection(a, tgt.sp, tgt.sec, d, c);
      else { d.coh = Math.min(d.coh, 28); giveGround(d, a, 250); if (d.coh < 15) breakUnit(d, c); }
    }
    a.gateBonus = false;
  }
  /* ----- (2f) lasting melee: where the era has it (MELEE_LOCK), two bodies that close and neither gives way fight hand to hand each tick:
     each loses men by the other's fighting men (its frontage in files, times the ranks its weapon reaches with), the weapon's power and the
     armour it meets, and cohesion by its losses, less what depth gives it (fresh ranks relieving the front). It ends when one breaks, or the
     attacker draws off, worn and the weaker. ----- */
  function lockMelee(a, d) { a.melee = d.id; a.meleeAtk = true; d.melee = a.id; d.meleeAtk = false; a.meleeSince = d.meleeSince = E.t; log('combat', `${a.name} and ${d.name} are locked hand to hand.`, { side: a.side, unit: a.id }); }
  function unlockMelee(u) { const o = u.melee && E.byId[u.melee]; if (o && o.melee === u.id) o.melee = null; u.melee = null; }
  const meleeArm = u => (WEAPONS[A(u).melee] || {}).melee || { power: 1, ranks: 1 };
  function melees() {
    for (const a of E.units) {
      if (!a.melee || !a.meleeAtk) continue;
      const d = E.byId[a.melee];
      if (!d || !formed(a) || !formed(d) || frontRange(a, d) > 80) { unlockMelee(a); continue; }
      const wa = meleeArm(a), wd = meleeArm(d), files = u => Math.max(1, u.F / E.K.MAN_FRONT);
      const fightA = Math.min(a.str, files(a) * (wa.ranks || 1)), fightD = Math.min(d.str, files(d) * (wd.ranks || 1));
      const armour = (u, w) => 1 - (A(u).protection || 0) * (1 - (w.pen ?? 1)), sh = shelterOf(a, d, 40), flank = onFlank(d, a) ? 1.5 : 1;
      const casD = fightA * E.K.MELEE_KILL * wa.power * armour(d, wa) * a.q * clamp(a.coh / 80, 0.3, 1.1) * flank * rnd.logn(0.25, 'melee');
      const casA = fightD * E.K.MELEE_KILL * wd.power * armour(a, wd) * d.q * clamp(d.coh / 80, 0.3, 1.1) * (sh ? sh.K.melee ?? 1 : 1) * rnd.logn(0.25, 'melee');
      addCas(a, casA, 'melee'); addCas(d, casD, 'melee');
      const relief = u => (FORMS[u.form] && FORMS[u.form].relief) || 1;
      a.coh -= (E.K.MELEE_COH + E.K.COH_CAS * 100 * casA / Math.max(1, a.str)) / relief(a); d.coh -= (E.K.MELEE_COH + E.K.COH_CAS * 100 * casD / Math.max(1, d.str)) / relief(d);
      a.lastHit = d.lastHit = E.tick;
      if (a.coh < 40 && a.coh < d.coh * 0.6) { unlockMelee(a); const c = E.cause(`${a.name} drew off from the melee with ${d.name}`); log('combat', `${a.name} draws off from ${d.name}.`, { side: a.side, unit: a.id, cause: c }); repulse(a, c); }
    }
  }
  function repulse(a, cause) {
    const back = fvec((a.facing + 180) % 360), fb = [a.x + back[0] * 380, a.y + back[1] * 380];
    a.task = { kind: 'rally', at: fb, prev: a.task, since: E.t, cause }; a.path = [fb]; a.halted = false; a.contactTicks = 0;
    if (a.coh < 15) breakUnit(a, cause);
  }
  E.repulse = repulse;
  function giveGround(d, a, dist) {
    if (d.held) return;
    const v = [d.x - a.x, d.y - a.y], L = hyp(v[0], v[1]) || 1; const dest = [d.x + v[0] / L * dist, d.y + v[1] / L * dist];
    d.task = { kind: 'rally', at: dest, prev: d.task, since: E.t }; d.path = [dest];
  }
  function takeSection(a, sp, sec, d, cause) {
    const side = sideKey(a); sec.held = side;
    if (d) {
      const next = sp.secs.find(s => s.held === sideKey(d) && !s.burnt);
      if (next) { d.spSec = next; d.x = next.x; d.y = next.y; d.coh = Math.max(d.coh, next.cover <= 0.3 && E.K.WALL_REFORM ? E.K.WALL_REFORM : 30); }
      else evictGarrison(sp, d, 'assault', cause);
    }
    // attacker occupies the section it took, and needs a few minutes to sort itself out
    a.x = sec.x; a.y = sec.y; a.inSp = sp.id; a.secCover = sec; a.standoffUntil = E.tick + 4;
    const stillHeld = sp.secs.some(s => s.held && s.held !== side && !s.burnt);
    if (!stillHeld) {
      const prev = sp.holder; sp.holder = side;
      if (prev !== side) spChanged(sp, prev, side, a, cause);
      // the attacking brigade leaves a garrison and stays; (7) unless a garrison of its own side is still in the place, which keeps it
      const g0 = sp.garrison && E.byId[sp.garrison];
      if (g0 && g0 !== a && formed(g0) && g0.spId === sp.id && sideKey(g0) === side) { for (const s of sp.secs) if (!s.burnt && !s.held) s.held = side; a.task = { kind: 'hold', since: E.t }; a.path = null; }
      else { a.task = { kind: 'garrison', sp: sp.id, since: E.t }; a.path = null; E.occupy(a, sp, side); }
    }
  }
  function evictGarrison(sp, g, how, cause) {
    sp.garrison = null; g.spId = null; g.spSec = null;
    const cap = how === 'assault' ? rnd.range(0.15, 0.4, 'capture') : 0.05;
    addCas(g, g.str * cap, 'captured');
    unhold(g, true); g.form = PLACE.leaveForm; const fp = footprint(g); g.F = fp.F; g.D = fp.D;
    breakUnit(g, cause ?? E.cause(`${g.name} driven from ${sp.name} (${how})`));
    for (const s of sp.secs) if (s.held === sideKey(g)) s.held = null;
    refreshHolder(sp, null, cause);
  }
  // (7) a place belongs to whoever holds a section of it that is not burnt; when the old holder has none left it passes to the side that
  // does, or to nobody. Before, a garrison breaking with the enemy already in one section left the place "held" by a side with no men in it.
  function refreshHolder(sp, by, cause) {
    const sides = new Set(sp.secs.filter(s => s.held && !s.burnt).map(s => s.held));
    let h = sp.holder; if (!h || !sides.has(h)) h = sides.size === 1 ? [...sides][0] : null;
    if (h !== sp.holder) { const prev = sp.holder; sp.holder = h; spChanged(sp, prev, h, by, cause); }
  }
  E.refreshHolder = refreshHolder;
  function spChanged(sp, from, to, by, cause) {
    log('place', `${sp.name} ${to ? (from ? 'is taken by the ' : 'is occupied by the ') + (COAL_NAME[to] || to) : 'is abandoned'}.`, { sp: sp.id, cause, important: true, holder: to });
    placeMorale(sp.value, to, from); // (phase 2) by the place's value (battle pack)
    for (const m of METRICS) if (m.when === 'taken' && m.place === sp.id && m.by === to && (!m.after || E.metrics[m.after] != null) && (m.every || E.metrics[m.id] == null)) E.metrics[m.id] = E.t;
    if (E.ai && E.ai.onPlace) E.ai.onPlace(E, sp, from, to);
  }
  // (phase 2) army morale when a place or line of value v changes hands: takers gain, the losing army and its partners lose (era numbers)
  function placeMorale(v, to, from) { if (!v) return; for (const sd of SIDES) { const c = COAL[sd.id]; if (to && c === to) E.morale[sd.id] += E.K.PLACE_GAIN * v; else if (from && c === from) E.morale[sd.id] -= (sd.id === from ? E.K.PLACE_LOSS : E.K.PLACE_LOSS_ALLY) * v; } }
  E.spChanged = spChanged;
  // a unit entering an empty strongpoint
  E.enterSp = function (u, sp) { if (sp.garrison && E.byId[sp.garrison] && formed(E.byId[sp.garrison]) && E.byId[sp.garrison] !== u) { // reinforce
      const g = E.byId[sp.garrison]; mergeInto(g, u); return g; }
    // (7) a farm burnt out in every section cannot be garrisoned: the men stand outside it (before, they "held" a farm with no section held)
    if (sp.secs.every(s => s.burnt)) { E.setTask(u, { kind: 'hold', since: E.t }); u.path = null; return null; }
    const prev = sp.holder; occupy(u, sp, sideKey(u)); if (prev !== sideKey(u)) spChanged(sp, prev, sideKey(u), u); return u; };
  function mergeInto(g, u) { const tot = g.str + u.str; g.coh = (g.coh * g.str + u.coh * u.str) / tot; g.q = (g.q * g.str + u.q * u.str) / tot; g.ammo = (g.ammo * g.str + u.ammo * u.str) / tot; g.str = tot; g.str0 += u.str0; u.str = 0; u.gone = true; u.mergedInto = g.id; }
  E.mergeInto = mergeInto;
  // (6) the general retreat: where the high road leaves the map, the rearguard's line at Rossomme, and a brigade marching off in order
  // (phase 2) from the side's data: where its line of retreat leaves the map, and a rearguard's line across it (420 m either side, 60 m back)
  const exitSide = s => SIDE_BY[s] && SIDE_BY[s].exit ? SIDE_BY[s] : SIDES.find(x => x.exit);
  E.retreatExit = (s) => { const sd = exitSide(s), p = ll2m(sd.exit[0], sd.exit[1]); return sd.rear === 'S' ? [p[0], HM - 40] : sd.rear === 'N' ? [p[0], 40] : sd.rear === 'E' ? [WM - 40, p[1]] : [40, p[1]]; };
  E.rearguardLine = (s) => { const sd = exitSide(s), [x, y] = ll2m(sd.rearguard[0], sd.rearguard[1]), [bx, by] = toRear(sd.rear, 60), [ax, ay] = sd.rear === 'S' || sd.rear === 'N' ? [420, 0] : [0, 420]; return [[x - ax + bx, y - ay + by], [x + ax + bx, y + ay + by]]; };
  E.withdrawUnit = function (u) { u.gone = true; u.left = E.t; u.saved = true; u.path = null; };
  // (phase 3) which way is back, for any army: its own rear edge (battle pack); a broken pursuit rallies toward its coalition's lead army's
  // rear, the distance the battle gives (side.rallyBack, m; 750 if none: est.)
  const coalSide = s => SIDE_BY[COAL[s]] || SIDE_BY[s];
  E.rearOf = (s, p, u, d) => rearOf(SIDE_BY[s].rear, p, u, d);
  E.atRear = (u, m) => offEdge(SIDE_BY[u.side].rear, u, m);
  E.frontFacing = s => ({ S: 0, N: 180, E: 270, W: 90 })[SIDE_BY[s].rear] || 0;
  E.rallyBack = u => { const cs = coalSide(u.side); return toRear(cs.rear, cs.rallyBack ?? 750); };
  E.beginRetreat = function (o) { // (phase 2) any army: the side the order is for (the attacker by default)
    const s = (o && o.side) || ((BATTLE.battle.victory || {}).attacker) || SIDE_IDS[0], wk = s.toLowerCase() + 'Withdraw';
    E.flags[wk] = E.t; E.metrics[wk] = E.t;
    E.flags[wk + 'Str'] = E.units.filter(u => u.side === s && formed(u) && !served(u)).reduce((a, u) => a + u.str, 0);
    E.morale[s] -= 5; // the army sees itself going back (est.)
    log('army', SIDE_BY[s].retreatSays || `The ${SIDE_BY[s].name} army begins to retreat.`, { side: s, important: true });
  };
  E.leaveSp = function (u) { const sp = u.spId ? E.spById[u.spId] : null; if (sp && sp.garrison === u.id) { sp.garrison = null; } u.spId = null; u.spSec = null; unhold(u); u.form = PLACE.leaveForm; const fp = footprint(u); u.F = fp.F; u.D = fp.D; };
  // detach part of a brigade (e.g. into Hougoumont)
  E.detach = function (u, men, newId, name) { men = Math.min(men, u.str - 100); if (men < 50) return null; u.str -= men; u.str0 -= men; const d = makeUnit({ id: newId, side: u.side, name, parent: u.name, nat: u.nat, type: PLACE_ARM, str: men, x: u.x, y: u.y, facing: u.facing, form: 'columns', q: u.q, corps: u.corps, div: u.div }); d.coh = u.coh; d.cohMax = u.cohMax; d.fatigue = u.fatigue; d.ammo = u.ammo; const fp = footprint(u); u.F = fp.F; u.D = fp.D; return d; };

  /* ----- cavalry ----- */
  function cavalry() {
    for (const c of E.units) {
      if (!charges(c) || !formed(c) || !c.charge) continue;
      const ch = c.charge, t = E.byId[ch.target];
      if (!t || !alive(t) || t.status === 'broken' && ch.phase !== 'pursue') { endCharge(c, false); continue; }
      const d = hyp(t.x - c.x, t.y - c.y) - (t.D + c.D) / 2;
      if (ch.phase === 'approach') { c.pace = 'trot'; c.path = [[t.x, t.y]]; c.stopAt = 0; if (d < 260) { ch.phase = 'charge'; c.path = null; } continue; }
      if (ch.phase === 'charge') { c.pace = 'charge'; resolveCharge(c, t); continue; }
    }
  }
  // the weight of the charge by the unit's kind (battle traits)
  function impetus(c) { const kind = (A(c).shock && A(c).shock[c.cavKind]) ?? 1.0; return c.q * clamp(c.coh / 80, 0.3, 1.1) * clamp(c.wind / 100, 0.2, 1) * (1 - 0.5 * wetAt(c.x, c.y)) * kind; }
  function resolveCharge(c, t) {
    const ch = c.charge; c.wind -= 25 * (E.wet > 0.6 ? 1.5 : 1) * 0.6; ch.n = (ch.n || 0) + 1;
    const imp = impetus(c), flank = onFlank(t, c);
    let crossing = 1; { const mx = (c.x + t.x) / 2, my = (c.y + t.y) / 2; const tt = TT[cellIdx(mx, my)]; if (tt === T.SUNKEN) crossing = 0.5; else if (tt === T.ORCH || tt === T.WOOD || tt === T.BUILD) crossing = 0.4; }
    { const sh = shelterOf(c, t, 60); if (sh) crossing *= sh.K.horse ?? 1; } // (2g) stakes or a palisade before the foot: horse cannot come at them
    const c0 = E.cause(`${c.name} charged ${t.name}`);
    if (charges(t)) {
      const a = imp * Math.sqrt(c.str) * (flank ? 1.5 : 1) * rnd.logn(0.25, 'cavalry melee'), b = impetus(t) * Math.sqrt(t.str) * (t.charge ? 1 : 0.65) * rnd.logn(0.25, 'cavalry melee');
      addCas(c, c.str * rnd.range(0.03, 0.07, 'cav cas'), 'melee'); addCas(t, t.str * rnd.range(0.03, 0.07, 'cav cas'), 'melee');
      if (a > b) { t.coh -= 30; c.coh -= 8; log('combat', `${c.name} rides down ${t.name}.`, { side: c.side, unit: c.id, cause: c0 }); if (t.coh < 15) breakUnit(t, c0); else giveGround(t, c, 500); maybePursue(c, t, c0); }
      else { c.coh -= 30; t.coh -= 8; log('combat', `${c.name} is beaten off by ${t.name}.`, { side: c.side, unit: c.id, cause: c0 }); if (c.coh < 15) breakUnit(c, c0); endCharge(c, true); }
      return;
    }
    if (served(t)) {
      t.silencedUntil = E.t + 4; c.wind -= 5; c.coh -= 3;
      log('combat', `${c.name} rides among ${t.name}'s guns; the gunners take shelter.`, { side: c.side, unit: c.id, cause: c0 });
      endCharge(c, true); return;
    }
    if (t.held) { c.coh -= 12; addCas(c, c.str * 0.05, 'mus'); endCharge(c, true); return; }
    // infantry
    if (allRound(t.form) && !t.formTo) {
      const p = t.coh > 40 ? 0 : t.coh >= 30 ? 0.03 : 0.15;
      if (rnd('square break-in') < p) { log('combat', `${c.name} breaks into the square of ${t.name}!`, { side: c.side, unit: c.id, cause: c0, important: true }); addCas(t, t.str * rnd.range(0.25, 0.5, 'square broken'), 'captured'); breakUnit(t, c0); maybePursue(c, t, c0); return; }
      t.coh -= 2; addCas(t, t.str * rnd.range(0.004, 0.012, 'cav vs square'), 'mus'); addCas(c, c.str * rnd.range(0.02, 0.05, 'cav vs square'), 'mus'); c.coh -= 4;
      endCharge(c, true); return;
    }
    t.coh -= flank ? 35 : 25;
    const resist = t.coh * t.q * crossing ** -1 * ((FORMS[t.form] && FORMS[t.form].vsHorse) ?? FORM0.vsHorse) * (A(t).vsHorse ?? 1) * (allRound(t.formTo) ? 0.7 : 1) * rnd.logn(0.3, 'cavalry morale test');
    const attack = imp * 60 * crossing * E.K.CAV_BREAK_TEST;
    if (resist < attack) {
      log('combat', `${c.name} catches ${t.name} out of square and breaks it.`, { side: c.side, unit: c.id, cause: c0, important: true });
      addCas(t, t.str * rnd.range(0.1, 0.3, 'ridden down'), 'captured'); breakUnit(t, c0); c.coh -= 8; maybePursue(c, t, c0);
    } else {
      log('combat', `${t.name} beats off ${c.name}.`, { side: t.side, unit: t.id, cause: c0 });
      c.coh -= 15; addCas(c, c.str * 0.05, 'mus'); t.coh += 5; endCharge(c, true);
    }
  }
  function maybePursue(c, t, cause) {
    const cc = SIDE_BY[c.side].cavChief, L = c.leader ? E.leaders[c.leader] : (cc ? E.leaders[cc] : null); // a brigade with no leader of its own: the army's cavalry chief
    const agg = L ? L.agg : 0.6, skill = L ? L.skill : 0.6;
    const p = clamp(agg * (1 - skill) * 1.5, 0, 0.9);
    if (rnd('uncontrolled pursuit') < p) {
      const dir = bearing(t.x - c.x, t.y - c.y), v = fvec(dir), dest = [clamp(c.x + v[0] * 1400, 50, WM - 50), clamp(c.y + v[1] * 1400, 50, HM - 50)];
      c.charge = null; c.pursuing = true; c.task = { kind: 'pursue', at: dest, since: E.t, cause }; c.path = [dest]; c.pace = 'trot';
      log('combat', `${c.name} gallops on out of control after the fugitives.`, { side: c.side, unit: c.id, cause, important: true });
    } else endCharge(c, true);
  }
  function endCharge(c, back) {
    const ch = c.charge; c.charge = null; c.pace = null;
    if (back) { const home = ch && ch.home ? ch.home : [c.x, c.y]; c.task = { kind: 'rally', at: home, since: E.t, prev: ch && ch.prevTask }; c.path = [home]; }
  }
  E.charge = function (c, t, cause) { if (c.wind < 30 || !formed(c) || c.status === 'disordered') return false; c.charge = { target: t.id, phase: 'approach', home: [c.x, c.y], prevTask: c.task }; c.task = { kind: 'charge', target: t.id, since: E.t, cause }; c.path = [[t.x, t.y]]; c.pace = 'trot'; c.stopAt = 0; return true; };

  /* ----- casualties and cohesion ----- */
  function addCas(u, n, kind) {
    n = Math.min(n, u.str); if (n <= 0) return; u.str -= n; if (kind !== 'stragglers' && E.lossAcc) E.lossAcc[u.side] += n;
    if (kind === 'captured') u.captured += n; else if (kind === 'stragglers') u.stragglers += n; else { u.killed += n * E.K.KW_RATIO; u.wounded += n * (1 - E.K.KW_RATIO); }
    u.casTick = (u.casTick || 0) + n;
  }
  E.addCas = addCas;
  function applyDamage() {
    for (const [id, d] of dmg) {
      const u = E.byId[id]; if (!alive(u)) continue;
      const before = u.str, tot = (d.mus + d.art) * rnd.logn(0.2, 'casualty noise');
      if (served(u)) { const crewLoss = Math.min(u.str, tot / CREW); u.str = Math.max(0, u.str - crewLoss); u.killed += crewLoss * CREW * E.K.KW_RATIO; u.wounded += crewLoss * CREW * (1 - E.K.KW_RATIO); u.coh -= tot / 40 * 3; u.lastHit = E.tick; continue; } // casualties capped at the crew: about 12 gunners a gun
      addCas(u, tot, 'fire');
      const pct = tot / Math.max(1, before) * 100, artShare = d.art / Math.max(1e-6, d.mus + d.art), flankShare = d.flank / Math.max(1e-6, d.mus + d.art);
      let loss = E.K.COH_CAS * pct * (1 + (E.K.COH_ART - 1) * artShare) * (1 + (E.K.COH_FLANK - 1) * flankShare);
      if (u.spSec) loss *= u.spSec.cover <= 0.3 && E.K.WALL_COHF ? E.K.WALL_COHF : 0.5 + 0.5 * u.spSec.cover;
      u.srcArt = (u.srcArt || 0) + d.art; u.srcMus = (u.srcMus || 0) + d.mus;
      if (!u.firedTick && A(u).weapon) loss += E.K.NOREPLY; // under fire and unable to reply (horse has no fire of its own to reply with)
      // men behind loopholed walls with cartridges in their pouches are not driven out by fire alone (5e, est.): fire cannot take them below the floor
      if (E.K.WALL_FLOOR && u.spSec && u.spSec.cover <= 0.3 && !u.spSec.burnt && u.ammo > 0 && !u.outOfAmmo && u.coh - loss < E.K.WALL_FLOOR) loss = Math.max(0, u.coh - E.K.WALL_FLOOR);
      u.coh -= loss; u.lastHit = E.tick; u.hitBy = d.srcs;
      // (5e, est.) a garrison caught by a cannonade in an orchard or wood, with no enemy foot or horse within 400 m, takes cover in its stone buildings
      if (E.K.SHELTER && u.spSec && u.spId && u.spSec.cover > 0.3 && d.art > d.mus) {
        const sp = E.spById[u.spId], side = COAL[u.side], inner = sp.secs.find(s => s.held === side && !s.burnt && s.cover <= 0.3);
        if (inner && inner !== u.spSec && !near(u.x, u.y, 400, e => isEnemy(u, e) && formed(e) && !served(e) && !e.held).length) {
          const was = u.spSec.name; for (const s2 of sp.secs) { if (s2 === inner) break; if (s2.held === side) s2.held = null; }
          u.spSec = inner; u.x = inner.x; u.y = inner.y;
          log('combat', `Under the cannonade the defenders of ${sp.name} leave the ${was} and take cover in the ${inner.name}.`, { side: u.side, unit: u.id });
        }
      }
      if (d.art > 0) u.underArt = E.tick;
    }
    // (7) was alive(u), which missed a unit wiped out to exactly 0 in one tick: it went on "garrisoning" with no men
    for (const u of E.units) if (u.onMap && !u.gone && u.str < 25 && !served(u)) { u.gone = true; u.left = E.t; if (u.spId) { const sp = E.spById[u.spId]; evictGarrison(sp, u, 'destroyed'); } }
  }
  function breakUnit(u, cause) {
    if (u.status === 'broken' || u.gone) return;
    if (u.melee) unlockMelee(u);
    u.status = 'broken'; u.coh = Math.min(u.coh, 12); u.brokeAt = E.t; u.lying = false; u.charge = null; u.halted = false;
    const bt = FORMS[u.form] && FORMS[u.form].breaksTo; if (bt) { u.form = bt; const fp = footprint(u); u.F = fp.F; u.D = fp.D; }
    if (u.spId) { const sp = E.spById[u.spId]; if (sp.garrison === u.id) { sp.garrison = null; for (const s of sp.secs) if (s.held === sideKey(u)) s.held = null; refreshHolder(sp, null, cause); } u.spId = null; u.spSec = null; unhold(u); }
    if (u.form === 'garrison') { u.form = PLACE.leaveForm; const fp = footprint(u); u.F = fp.F; u.D = fp.D; } // (7) a broken garrison is no longer in its farm's formation
    const c = E.cause(`${u.name} broke`, [cause]);
    log('break', `${u.name} breaks and runs.`, { side: u.side, unit: u.id, cause: c, important: u.str > 1500 || u.isGuard });
    // army morale
    const army = u.side, frac = u.str / Math.max(1, E.armyStr0[army]) * 100;
    E.morale[army] -= E.K.MORALE_BROKEN * frac;
    // contagion to neighbours that can see it
    for (const n of near(u.x, u.y, 400, f => f.side === u.side && formed(f) && f !== u)) {
      if (!losU(n, u, 2).clear) continue;
      n.coh -= E.K.CONTAGION * Math.sqrt(u.str / Math.max(200, n.str)) * (1.5 - n.q);
    }
    // (phase 2) a unit of prestige thrown back from an attack the whole army is watching (an order marked so): its army loses heart once, and
    // its comrades in sight each time (battle traits)
    if (u.prestige && (u.task.guard || (u.task.prev && u.task.prev.guard))) {
      const pm = METRICS.find(m => m.when === 'prestige' && m.side === u.side);
      if (!E.flags[u.side + 'Prestige']) { E.flags[u.side + 'Prestige'] = E.t; E.morale[u.side] -= u.prestige; if (pm) { E.flags[pm.id] = E.t; E.metrics[pm.id] = E.t; } log('event', pm && pm.says || `${u.name} is thrown back, and the army sees it.`, { side: u.side, cause: c, important: true }); }
      for (const f of E.units) if (f.side === u.side && formed(f) && f !== u && hyp(f.x - u.x, f.y - u.y) < E.K.PRESTIGE_SIGHT && losU(f, u, 2).clear) f.coh -= u.prestige;
    }
    if (u.leader && E.leaders[u.leader]) { /* leader rides with the fugitives */ }
    if (E.ai && E.ai.onBreak) E.ai.onBreak(E, u, c);
  }
  E.breakUnit = breakUnit;
  function cohesionAndMorale() {
    const dusk = sunAt(E.t) < LE.dark; // too dark to rally
    for (const u of E.units) {
      if (!alive(u)) continue;
      // flank threat
      if (formed(u) && !served(u) && !u.held && !allRound(u.form) && E.tick % 2 === 0) {
        const th = near(u.x, u.y, 500, e => isEnemy(u, e) && formed(e) && !served(e) && e.str > 500);
        if (th.some(e => onFlank(u, e) && hyp(e.x - u.x, e.y - u.y) < 500 && !(e.charge && e.charge.target !== u.id))) u.coh -= E.K.FLANK_THREAT;
      }
      // broken troops running through
      if (u.status === 'broken') { for (const f of near(u.x, u.y, 60, f => f.side === u.side && formed(f) && f !== u)) { f.passedBy = f.passedBy || {}; if (!f.passedBy[u.id]) { f.passedBy[u.id] = 1; f.coh -= 5; } } }
      // recovery out of fire
      const quiet = E.tick - u.lastHit > 2 && !near(u.x, u.y, 300, e => isEnemy(u, e) && formed(e)).length;
      if (u.status !== 'broken' && quiet && E.morale[u.side] >= 35 && u.task.kind !== 'pursue' && u.pace !== 'quick') {
        let rec = E.K.RECOVER * (u.fatigue > 60 ? 0.5 : 1) * (0.7 + 0.3 * u.q);
        // (phase 3a) by the leaders' gift for rallying men (leader file: rally, 0.5 usual, which gives release 3's x1.5 and x2)
        if (u.leader && E.leaders[u.leader] && E.leaders[u.leader].alive) rec *= 1 + (E.leaders[u.leader].rally ?? 0.5);
        const chief = E.leaders[SIDE_BY[u.side].chief]; const cp = chief ? leaderPos(chief) : null;
        if (cp && hyp(cp[0] - u.x, cp[1] - u.y) < 500) rec *= 1 + 2 * (chief.rally ?? 0.5);
        u.coh = Math.min(u.cohMax, u.coh + rec);
      }
      else if (u.status !== 'broken' && !quiet && E.tick - u.lastHit <= 2 && !E.near(u.x, u.y, 250, e => isEnemy(u, e) && formed(e) && !served(e)).length && E.morale[u.side] >= 35) {
        u.coh = Math.min(u.cohMax, u.coh + E.K.RECOVER * E.K.UNDER_FIRE_RECOVER * u.q * (u.fatigue > 60 ? 0.5 : 1));
      }
      // wind recovery for cavalry
      if (charges(u) && !u.charge && quiet) u.wind = Math.min(100 - u.fatigue / 3, u.wind + 4);
      // permanent damage
      if (u.coh < u.minCoh) { if (u.coh < 50) u.cohMax = Math.min(u.cohMax, 100 - E.K.CAP_LOSS * (50 - Math.max(0, u.coh))); u.minCoh = u.coh; }
      // status
      const prev = u.status;
      if (u.status === 'broken') {
        // rally: no enemy within 800 m for 15-30 min and a leader near
        if (!near(u.x, u.y, 800, e => isEnemy(u, e) && formed(e)).length) { u.rallyT = (u.rallyT || 0) + 2; if (!u.rallyNeed) u.rallyNeed = rnd.range(15, 30, 'rally'); if (u.rallyT >= u.rallyNeed && E.morale[u.side] >= 20 && !dusk) { u.status = 'disordered'; u.coh = rnd.range(30, 40, 'rally'); u.cohMax = Math.min(u.cohMax, 55); u.rallyT = 0; u.rallyNeed = 0; u.task = { kind: 'hold', since: E.t }; u.path = null; log('rally', `${u.name} rallies.`, { side: u.side, unit: u.id }); if (E.ai && E.ai.onRally) E.ai.onRally(E, u); } }
        else u.rallyT = 0;
        // stragglers
        if (rnd('stragglers') < 0.5) addCas(u, u.str * 0.01, 'stragglers');
        // pursuit by cavalry
        const cav = near(u.x, u.y, 250, e => isEnemy(u, e) && charges(e) && formed(e));
        if (cav.length) addCas(u, u.str * 0.04 * cav.length, 'captured');
        continue;
      }
      u.coh = Math.min(u.coh, u.cohMax);
      if (u.coh < 15 && u.spId && u.spSec) { // a garrison falls back into the next walled section before it gives up the place
        const sp = E.spById[u.spId], i = sp.secs.indexOf(u.spSec), nxt = sp.secs.slice(i + 1).find(s => s.held === sideKey(u) && !s.burnt);
        if (nxt) { u.spSec.held = null; u.spSec = nxt; u.x = nxt.x; u.y = nxt.y; u.coh = nxt.cover <= 0.3 && E.K.WALL_REFORM ? E.K.WALL_REFORM : 25; log('combat', `The defenders of ${sp.name} fall back into the ${nxt.name}.`, { side: u.side, unit: u.id }); continue; }
      }
      if (u.coh < 15) { breakUnit(u, E.cause(`${u.name}'s cohesion collapsed`)); continue; }
      u.status = u.coh >= 50 ? 'steady' : u.coh >= 30 ? 'shaken' : 'disordered';
      // raw units leave the field
      if ((u.q <= 0.72) && u.coh < 40 && E.tick - u.lastHit < 3 && rnd('raw unit leaves') < 0.02) { u.gone = true; u.left = E.t; log('event', `${u.name} leaves the field.`, { side: u.side, unit: u.id, important: true }); E.morale[u.side] -= 1; }
    }
    // (8) the army feels its losses: men killed, wounded or taken since the last tick, as a share of its strength at the start
    for (const s of SIDE_IDS) { if (E.K.MORALE_CAS && E.lossAcc[s]) E.morale[s] -= E.K.MORALE_CAS * E.lossAcc[s] / Math.max(1, E.armyStr0[s]) * 100; E.lossAcc[s] = 0; }
    // army break: every unit tests each tick
    for (const s of SIDE_IDS) {
      E.morale[s] = clamp(E.morale[s], 0, 100);
      if (E.morale[s] < 20) {
        if (!E.flags[s + 'Broken']) { E.flags[s + 'Broken'] = E.t; E.metrics[s.toLowerCase() + 'Break'] = E.t; log('army', `The ${SIDE_BY[s].name} army is breaking.`, { side: s, important: true }); }
        for (const u of E.units) if (u.side === s && formed(u) && !served(u)) { const p = clamp(0.05 * (1 + (55 - u.coh) / 20) / u.q, 0.01, 0.5); if (rnd('army rout') < p) breakUnit(u, E.cause('The army was breaking')); }
      }
    }
  }

  /* ----- (2g) fieldworks: a body holding with orders to dig throws up a work along its front once it has dug long enough (era) ----- */
  function works() {
    const FW = ERA.fieldwork; if (!FW) return;
    for (const u of E.units) {
      if (!formed(u) || u.task.kind !== 'hold' || !u.task.dig || u.task.dug) continue;
      u.digging = (u.digging || 0) + 2;
      if (u.digging >= FW.minutes) {
        const [fx, fy] = fvec(u.facing), ax = -fy, ay = fx, cx = u.x + fx * (u.D / 2 + 6), cy = u.y + fy * (u.D / 2 + 6);
        E.addObstacle(FW.kind, [[cx - ax * u.F / 2, cy - ay * u.F / 2], [cx + ax * u.F / 2, cy + ay * u.F / 2]], `${u.name}'s works`);
        u.task.dug = true; log('event', `${u.name} has dug in.`, { side: u.side, unit: u.id });
      }
    }
  }

  /* ----- supply and fatigue ----- */
  function supplyAndFatigue() {
    for (const u of E.units) {
      if (!alive(u)) continue;
      const moved = u.movedTick === E.tick, fought = u.firedTick || u.lastHit === E.tick;
      let df = fought ? 10 : moved ? (u.pace === 'quick' || u.pace === 'trot' || u.pace === 'charge' ? 6 : 2) : u.form === 'road' ? 1 : -6;
      if (u.charge) df = 12;
      u.fatigue = clamp(u.fatigue + df / 30, 0, 100);
      // ammunition: resupply out of contact near the wagons (abstracted as behind own lines)
      const out = E.tick - u.lastHit > 5 && E.tick - u.lastFired > 5;
      if (served(u)) { u.rounds = Math.min(130, u.rounds + 1.5); if (out && u.rounds < 100 && E.tick % 7 === 0) u.rounds = Math.min(130, u.rounds + 40); continue; }
      if (u.ammo <= 0 && !u.outOfAmmo) { u.outOfAmmo = true; u.coh -= 15; log('supply', `${u.name} is out of ammunition.`, { side: u.side, unit: u.id, important: !!u.held }); }
      if (u.ammo > 0) u.outOfAmmo = false;
      if (u.held && u.spId) {
        if (u.ammo < 30 && E.tick % 7 === 0) {
          const sp = E.spById[u.spId], [ax, ay] = sp.access[0], [bx, by] = sp.access[1], mx = (ax + bx) / 2, my = (ay + by) / 2;
          const underFire = near(mx, my, 350, e => isEnemy(u, e) && formed(e)).length > 0 || E.tick - u.lastHit < 2;
          const wg = (E.wagons[u.side] || {})[u.ammoKind]; // the wagon for its ammunition, if its army is short of it
          const available = !wg || wg.state === 'near' || (wg.state === 'far' && E.t >= wg.from);
          const p = !available ? 0 : underFire ? rnd.range(0.3, 0.6, 'resupply odds') : 0.95;
          if (rnd('resupply') < p) { u.ammo = Math.min(50, u.ammo + 20); log('supply', `Cartridges get through to ${sp.name}.`, { side: u.side, unit: u.id }); }
          else if (wg && !available && !u.warnedAmmo) { u.warnedAmmo = true; log('supply', wg.short.replace('{place}', sp.name), { side: u.side, unit: u.id, important: true }); }
        }
      } else if (out && u.ammo < 35 && E.tick % 7 === 0 && u.task.kind !== 'march') u.ammo = Math.min(50, u.ammo + 20);
    }
  }

  /* ----- events ----- */
  function events() {
    // leaders hit
    for (const L of Object.values(E.leaders)) {
      if (!L.alive || L.wounded || !L.unit) continue; const u = E.byId[L.unit]; if (!u || !alive(u)) continue;
      if (E.tick - u.lastHit > 0) continue;
      const I = clamp((u.casTick || 0) / Math.max(1, u.str) * 100 / 2, 0, 1), p = (0.01 + 0.05 * I) * L.exp / 30;
      if (rnd('leader hit') < p) {
        const killed = rnd('leader killed') < 0.35; L.wounded = true; if (killed) L.alive = false;
        const c = E.cause(`${L.name} was ${killed ? 'killed' : 'wounded'} with ${u.name}`);
        log('leader', `${L.name} is ${killed ? 'killed' : 'wounded'}.`, { side: L.side, unit: u.id, cause: c, important: true });
        u.coh -= 10; if (L.rank >= 2) E.morale[L.side] -= 5;
        // deputy takes over with ordinary traits
        L.name = `${L.orig}'s deputy`; L.agg = 0.5; L.ini = 0.4; L.obe = 0.8; L.skill = 0.5; L.exp = 0.5; L.wounded = false; L.alive = true; L.replaced = true;
        if (E.ai && E.ai.onLeader) E.ai.onLeader(E, L, killed);
        if (E.command) E.command.flag(L.id, { kind: 'leader', urgent: true, text: `${L.orig} has been ${killed ? 'killed' : 'wounded'}; his deputy has taken command.` });
      }
    }
    for (const h of E.ruleHooks) h(E);
  }

  /* ----- sighting: who has seen what (side-level contacts) ----- */
  function sighting() {
    for (const side of COALS) { // each coalition keeps one book of what it has seen
      const mine = E.units.filter(u => formed(u) && COAL[u.side] === side);
      const theirs = E.units.filter(u => alive(u) && COAL[u.side] !== side);
      const book = E.contacts[side];
      for (const e of theirs) {
        // nearest few observers
        let obs = mine.map(o => [hyp(o.x - e.x, o.y - e.y), o]).filter(a => a[0] < 8000).sort((a, b) => a[0] - b[0]).slice(0, 4);
        let seen = false, bestR = 1e9;
        let seer = null, seenTrans = 1;
        for (const [r, o] of obs) { const l = losU(o, e, 2.5); if (!l.clear) continue; if (rnd('sighting') < detectP(r, l.trans, e.str * (A(e).seenAs || 1)) * (e.concealed ?? 1)) { seen = true; bestR = Math.min(bestR, r); seer = o; seenTrans = l.trans; break; } }
        if (seen && E.command) E.command.observed(seer, e, bestR, seenTrans);
        if (seen) { const c = book[e.id] || (book[e.id] = {}); Object.assign(c, { t: E.t, x: e.x, y: e.y, form: e.form, type: e.type, str: e.str * rnd.range(0.75, 1.25, 'strength estimate') * (1 + rnd.normal('strength estimate') * 0.1 * Math.max(0, bestR / 1000 - 1)), r: bestR, id: bestR < 1000 ? e.id : (c.id || null), side: e.side, moving: e.movedTick === E.tick }); }
      }
    }
  }

  /* ----- turning points and morale events (phase 2: the battle's metrics and valued lines, the era's numbers) ----- */
  const firedOn = (u, side) => u.firedTick && u.fireTarget && E.byId[u.fireTarget] && (side ? E.byId[u.fireTarget].side === side : isEnemy(u, E.byId[u.fireTarget]));
  function keyPoints() {
    // a fresh corps from off the map fires its first shots: the enemy loses heart and the army it came to help takes it
    for (const u of E.units) if (u.reinforcement && alive(u) && E.engaged[u.corps] == null && firedOn(u)) { E.engaged[u.corps] = E.t; freshCorps(u); }
    for (const m of METRICS) {
      if (E.metrics[m.id] != null) continue;
      if (m.when === 'fires') { const u = E.units.find(x => (m.side ? x.side === m.side : x.corps === m.corps) && alive(x) && firedOn(x, m.at)); if (u) { E.metrics[m.id] = E.t; E.flags[m.id] = E.t; } }
      else if (m.when === 'held') { const sp = E.spById[m.place]; if (sp && sp.holder === m.by) E.metrics[m.id] = E.t; } // (phase 5) the first time the place is theirs, however it became so
      else if (m.when === 'near') { const sp = E.spById[m.place], u = E.units.find(x => x.corps === m.corps && alive(x) && hyp(x.x - sp.x, x.y - sp.y) < m.within); if (u) { E.metrics[m.id] = E.t; if (m.says) log('army', m.says, { side: u.side, important: true }); } }
    }
    // a line worth holding (battle objectives with a value): the enemy's foot stand on it with none of the holders close; the holders have it
    // back once it has been clear a while
    for (const [k, o] of Object.entries(E.objectives)) {
      if (!o.value || !o.line || !o.holder) continue;
      const on = E.units.filter(u => COAL[u.side] !== o.holder && formed(u) && foot(u) && polyDist(u.x, u.y, o.line) < E.K.LINE_NEAR && !near(u.x, u.y, E.K.LINE_CLEAR, e => COAL[e.side] === o.holder && formed(e) && !served(e)).length);
      if (on.length && !o.takenAt) { o.takenAt = E.t; o.by = COAL[on[0].side]; placeMorale(o.value, o.by, o.holder); if (o.flag) E.flags[o.flag] = E.t; for (const m of METRICS) if (m.when === 'line' && m.line === k && E.metrics[m.id] == null) E.metrics[m.id] = E.t; log('place', o.says ? o.says.taken : `The enemy stand on ${o.name}.`, { side: on[0].side, important: true }); }
      else if (!on.length && o.takenAt && E.t - o.takenAt > E.K.LINE_BACK) { placeMorale(o.value, o.holder, o.by); o.takenAt = null; if (o.flag) E.flags[o.flag] = null; log('place', o.says ? o.says.regained : `${o.name} is clear again.`, { side: o.holder }); }
    }
  }
  function freshCorps(u) {
    // a corps-sized force (FRESH_MEN or more) counts in full, a smaller one pro rata; the army it helps takes heart from the first such corps
    // in full, and from each one after it less (a half, a third ...)
    const f = Math.min(1, (E.corpsMen0[u.corps] || 0) / E.K.FRESH_MEN), c = COAL[u.side];
    const nth = Object.keys(E.engaged).filter(k => E.offmap.some(o => o.corps === k && o.side === u.side)).length; // this corps included
    for (const sd of SIDES) { if (COAL[sd.id] !== c) E.morale[sd.id] -= E.K.FRESH_ENEMY * f; else if (sd.id !== u.side) E.morale[sd.id] += E.K.FRESH_HELP * f / nth; }
    log('army', `${CORPS_NAME[u.corps] || 'Fresh troops'} come${CORPS_NAME[u.corps] ? 's' : ''} into the fight: ${u.name} opens fire near ${nearestPlace(u.x, u.y)}.`, { side: u.side, important: true });
  }
  function nearestPlace(x, y) { let best = 'the field', bd = Infinity; for (const l of W.LM) { const d = hyp(l.x - x, l.y - y); if (d < bd) { bd = d; best = l.n; } } return best; }
  E.nearestPlace = nearestPlace;

  /* ----- end and score ----- */
  /* ----- (phase 2) the end and the grade, in general form: the battle ends at nightfall, when an army has been breaking for 40 minutes
     with no partner army still in the fight, or when a retreating army has drawn off; the grade follows the battle's victory terms
     (attacker; what a decisive win must hold; a collapse before which minute is a catastrophe; the line whose holding is a marginal win) ----- */
  const fought = s => E.flags[s.toLowerCase() + 'Engaged'] || E.units.some(u => u.side === s && u.lastFired >= 0);
  function endCheck() {
    if (E.t >= END - 2) return finish('nightfall');
    for (const s of SIDE_IDS) { const b = E.flags[s + 'Broken']; if (!b || E.t - b <= 40) continue; if (!SIDE_IDS.some(p => p !== s && COAL[p] === COAL[s] && !E.flags[p + 'Broken'] && fought(p))) return finish(`${SIDE_BY[s].name} army broken`); }
    // (6) the retreat is over when nine-tenths of the foot and horse that were formed when it began have left the field
    for (const s of SIDE_IDS) { const wk = s.toLowerCase() + 'Withdraw'; if (E.flags[wk] && E.t - E.flags[wk] > 30 && E.tick % 5 === 0) {
      const left = E.units.filter(u => u.side === s && formed(u) && !served(u)).reduce((a, u) => a + u.str, 0);
      if (left < 0.1 * E.flags[wk + 'Str']) return finish(`the ${SIDE_BY[s].name} army has drawn off`);
    } }
  }
  function finish(why) {
    E.over = true; const r = E.result = { why, t: E.t };
    const cas = side => { let kw = 0, cap = 0; for (const u of E.units) { if (u.side !== side) continue; kw += u.killed + u.wounded; cap += u.captured + u.stragglers; } return { kw: Math.round(kw), cap: Math.round(cap) }; };
    r.cas = Object.fromEntries(SIDE_IDS.map(sd => [sd, cas(sd)]));
    // grade
    const V = BATTLE.battle.victory || {}, att = V.attacker || SIDE_IDS[0], attC = COAL[att], defC = COALS.find(c => c !== attC);
    const adj = c => (BATTLE.battle.coalitionAdjectives || {})[c] || COAL_NAME[c] || c;
    const attBroke = E.flags[attC + 'Broken'], defBroke = E.flags[defC + 'Broken'], attM = E.morale[att];
    const D = V.decisive, sp = D && E.spById[D.holds], held = !sp || !E.units.some(u => COAL[u.side] !== attC && formed(u) && hyp(u.x - sp.x, u.y - sp.y) < D.within);
    // marginal: the battle's line objective flagged taken (Waterloo), or (Ligny) every place in marginal.holds held by the attacker at the end
    const mh = V.marginal && V.marginal.holds, mo = typeof V.marginal === 'string' && E.objectives[V.marginal];
    const marginal = mh ? mh.every(id => E.spById[id] && E.spById[id].holder === attC) : mo ? !!E.flags[mo.flag] : Object.values(E.objectives).some(o => o.value && o.line && o.takenAt && o.by === attC);
    const wk = att.toLowerCase() + 'Withdraw', defWk = SIDE_IDS.some(s => COAL[s] === defC && E.flags[s.toLowerCase() + 'Withdraw']);
    if (defBroke && !attBroke && attM >= (D ? D.morale : 40) && held) r.grade = `Decisive ${adj(attC)} victory`;
    else if (defBroke && !attBroke) r.grade = `${adj(attC)} victory`;
    else if (attBroke && V.catastropheBefore != null && attBroke < V.catastropheBefore) r.grade = `${adj(attC)} catastrophe`;
    else if (attBroke) r.grade = `${adj(defC)} victory`;
    else if (marginal || (V.drawnOff && defWk)) r.grade = `Marginal ${adj(attC)} victory`; // (Ligny) victory.drawnOff: the defender giving up the field is at least that
    else if (E.flags[wk] && attM >= 20) r.grade = `Marginal ${adj(defC)} victory`;
    else r.grade = 'Draw';
    if (E.flags[wk]) { // what the retreat brought away: brigades that marched off in order, and their guns
      const fr = E.units.filter(u => u.side === att), sv = fr.filter(u => u.saved);
      r.withdrawn = { from: E.flags[wk], men: Math.round(sv.filter(u => !served(u)).reduce((a, u) => a + u.str, 0)), guns: Math.round(sv.filter(u => served(u)).reduce((a, u) => a + u.str, 0)),
        gunsAll: Math.round(fr.filter(u => served(u)).reduce((a, u) => a + (u.guns0 || u.str0 || 0), 0)), menAtStart: Math.round(E.flags[wk + 'Str']), stillHere: Math.round(fr.filter(u => formed(u) && !served(u)).reduce((a, u) => a + u.str, 0)) };
    }
    log('end', `The battle ends (${why}): ${r.grade}.`, { important: true });
  }
  E.finish = finish;

  function snapshotLite() { return { t: E.t, morale: { ...E.morale }, kw: Object.fromEntries(SIDE_IDS.map(s => [s, sumSide(s, 'kw')])) }; }
  function sumSide(side, what) { let s = 0; for (const u of E.units) if (u.side === side) s += what === 'kw' ? u.killed + u.wounded : u.str; return Math.round(s); }
  E.sumSide = sumSide;
  E.run = function (until = END) { while (!E.over && E.t < until) E.step(); return E; };
  return E;
}

return { create, K, fmtT, T, TT, footprint, hitChance, bgVis, LOW, light: { sunset: SUNSET, dark: DARK, end: END, sunAt } };
}
const worlds = {};
function world(id) { id = id || root.WBATTLE || 'waterloo'; return worlds[id] || (worlds[id] = buildWorld(Packs.battle(id))); }
// the default world is the current battle's (the game page sets WBATTLE); a battle can also be named in create({ battle })
// (phase 4e) the engine's version: raised when a change alters how battles fight (a replay made before may not fight the same battle)
const VERSION = '0.4';
const api = { version: VERSION, create: (opts = {}) => world(opts.battle).create(opts), world, fmtT: t => world().fmtT(t), footprint: u => world().footprint(u), hitChance: r => world().hitChance(r), bgVis: t => world().bgVis(t) };
for (const k of ['K', 'T', 'TT', 'LOW']) Object.defineProperty(api, k, { get: () => world()[k], enumerable: true });
root.WEngine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
