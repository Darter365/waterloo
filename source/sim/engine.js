/* Waterloo engine: the umpire. One true state, 2-minute ticks, seeded randomness with a cause log.
   Mechanics follow the "Waterloo Game: Simulation Rules" doc; every coefficient marked (est.) lives in K. */
(function (root) {
'use strict';
const W = root.WData || (typeof require === 'function' ? require('./data.js') : null);
const { NX, NY, CELL, WM, HM, ll2m, m2ll, H } = W;

/* ---------------- calibration constants (est.) ---------------- */
const K = {
  FIRE: 1.0,            // musketry multiplier on the hit table
  ARTY: 1.1,            // artillery multiplier (calibrated from 1.0)
  COH_CAS: 2.0,         // cohesion lost per 1% of the unit lost in a tick (calibrated from 3)
  // walled farms (5c, all est.; set so two brigades thrown at Hougoumont no longer always carry it within the hour, while La Haye Sainte still falls about 18:30):
  WALL_REFORM: 40,      // cohesion a garrison re-forms to when driven back into a walled section (was 25-30)
  WALL_COHF: 0.5,       // cohesion lost per casualty behind walls, as a share of the open-ground rate (was 0.65)
  WALL_HOLD: 25,        // walls hold while the defenders' cohesion is at least this
  GATE_HOLD: 40,        // a broken gate lets the attackers in only if the defenders are below this; otherwise the party is shut in and killed
  WALL_FIRE: 0.7,       // musketry against men behind walls and loopholes, on top of the section's cover
  WALL_MELEE: 0.3,      // the defenders' share of the close-quarter losses at a wall (the attackers' is unchanged)
  SEC_FIRE_PER_M: 1.0,  // muskets that can bear on a farm section: this many per metre of its perimeter
  WALL_SHOCK: 0.5,      // cohesion the defenders lose for each assault they beat off, as a share of the open-ground rate
  NOAMMO_MELEE: 1,      // wall bonus in the melee test when the defenders have no cartridges (2 = no change; release 1: 1, they can no longer hold the loopholes)
  // (6) skirmishing round a held farm (est.; 0 = off): enemy foot within SKIRM_R of a garrisoned farm keep skirmishers at it, and the garrison
  // answers from the loopholes even when no assault is going in. SKIRM_FULL men within range is full pressure.
  RIFLE_NEAR: 0.25, RIFLE_FAR: 0.35, RIFLE_FAR_T: 1050, // the hidden roll for La Haye Sainte's rifle-ammunition wagon: near, far (reachable from this minute), else lost (est.; 5e: 0.4, 0.3, 16:00)
  SKIRM_AMMO: 1.7,      // the garrison's cartridges spent per man per 2-minute tick at full pressure (release 1; 0 = off)
  SKIRM_R: 450, SKIRM_FULL: 3000,
  SKIRM_HOLD: 150, SKIRM_LINGER: 0.4, // minutes the skirmishers stay round the farm after the last column has gone back, and their pressure then
  SKIRM_SHARE: 0.1,     // share of the besiegers out as skirmishers
  SKIRM_P: 0.01,        // hit chance of a skirmish shot at that range (about the musketry table's value at 250 m)
  // release 1 (was off in 5e): with the skirmish fire below draining La Haye Sainte's cartridges, the walls can now hold as they did in 1815
  WALL_FLOOR: 30,       // fire alone cannot take a walled garrison that still has cartridges below this cohesion (0 = off)
  SHELTER: 1,           // a garrison shelled in an orchard or wood with no enemy close takes cover in its buildings (0 = off)
  COH_ART: 1.3,         // artillery shock multiplier
  COH_FLANK: 2.0,       // fire from flank/rear
  NOREPLY: 0.5,         // under fire, unable to reply, per tick
  FLANK_THREAT: 5,      // enemy on flank/rear within 500 m, not faced, per tick
  CONTAGION: 4,         // break of a neighbour
  RECOVER: 1.5,         // per tick out of fire
  CAP_LOSS: 0.3,        // permanent max-cohesion loss per point below 50
  SHOCK_REPULSE: 0.8, SHOCK_WIN: 1.3, SHOCK_SIGMA: 0.3,
  CAV_BREAK_TEST: 1.0,  // scales the infantry morale test against cavalry
  MORALE_BROKEN: 0.08,  // army morale per 1% of army strength broken (release 2: 0.08, was 0.5; the losses that broke a brigade now count through MORALE_CAS)
  MORALE_CAS: 0.6,      // (8) army morale per 1% of the army's starting foot and horse killed, wounded or taken (release 2, est.; 0 = off)
  SMOKE_MUSKET: 0.00035, SMOKE_GUN: 0.03, SMOKE_DECAY: 0.87, SMOKE_DECAY_HUMID: 0.93, SMOKE_VIS: 0.8,
  KW_RATIO: 0.25,       // share of hits that are deaths (1 in 4)
  UNDER_FIRE_RECOVER: 0.5,
  BLIND: 0.4,           // area fire at ground the gunners cannot see behind a crest (overshoot and ricochet) (calibration addition; release 1: 0.4, was 0.2, bringing Wellington's losses to the 1815 range)
};

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
function terrainSpeed(type, tt, Wet) {
  if (type === 'rider') { const x = 1 - 0.4 * Wet; return tt === T.ROAD ? 1.5 : tt === T.LANE ? 1.15 * x : tt === T.WOOD ? 0.35 * x : tt === T.BUILD ? 0.3 : tt === T.VILL ? 0.9 : tt === T.STREAM ? 0.5 * x : tt === T.SUNKEN ? 0.6 * x : tt === T.ORCH ? 0.7 * x : x; }
  // infantry factors from the rules table; cavalry and guns cannot move formed through woods or buildings
  const cross = type === 'art' ? (1 - 0.6 * Wet) : type === 'cav' ? (1 - 0.5 * Wet) : (1 - 0.35 * Wet);
  switch (tt) {
    case T.ROAD: return 1.2;
    case T.LANE: return 1 - 0.5 * Wet + 0.1;
    case T.WOOD: return type === 'inf' ? 0.5 * cross : 0.12;
    case T.ORCH: return (type === 'inf' ? 0.6 : 0.35) * cross;
    case T.BUILD: return type === 'inf' ? 0.4 : 0.1;
    case T.VILL: return 0.6;
    case T.STREAM: return (type === 'art' ? 0.2 : 0.35) * cross;
    case T.SUNKEN: return (type === 'inf' ? 0.5 : 0.35) * cross;
    default: return cross;
  }
}
function astar(E, type, sx, sy, tx, ty) {
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
const RANKS = u => (u.nat === 'GB' || u.nat === 'KGL') ? 2 : 3;
function nBn(u) { return Math.max(1, Math.round(u.str / (u.side === 'FR' ? 520 : u.side === 'PR' ? 700 : 560))); }
function footprint(u) {
  if (u.type === 'gar') { const s = u.spSec; return { F: s ? s.r * 1.4 : 60, D: s ? s.r * 1.4 : 60 }; }
  if (u.type === 'art') {
    if (u.form === 'limbered' || u.form === 'road') return { F: 14, D: Math.max(30, u.str * 22) };
    if (u.form === 'park') return { F: Math.min(260, 40 + u.str * 2.2), D: 80 };
    return { F: Math.max(30, u.str * 15), D: 30 };
  }
  if (u.type === 'cav') {
    if (u.form === 'line') return { F: Math.max(60, u.str / 2 * 1.1), D: 20 };
    if (u.form === 'road') return { F: 10, D: Math.max(40, u.str * 0.8) };
    return { F: Math.max(110, u.str * 0.22), D: 60 };
  }
  const line = u.str / RANKS(u) * 0.6 * 1.15, n = nBn(u);
  switch (u.form) {
    case 'line': return { F: Math.max(40, line), D: 25 };
    case 'twoLines': return { F: Math.max(40, line / 2), D: 110 };
    case 'attack': return { F: n * 45, D: 80 };
    case 'mass': return { F: 160, D: 12 + n * 13 };
    case 'square': return { F: Math.ceil(n / 2) * 70, D: n > 1 ? 110 : 35 };
    case 'road': return { F: 12, D: Math.max(40, u.str * 0.5) };
    default: return { F: n * 70, D: 60 }; // battalion columns at deploying interval
  }
}
const FIRE_FRAC = { line: 1, twoLines: 0.5, columns: 0.18, attack: 0.15, mass: 0.12, square: 0.25, road: 0.03, garrison: 1 };
const DENSITY = { line: 1, twoLines: 0.8, columns: 2.5, attack: 2.5, mass: 3.5, square: 3, road: 3, garrison: 1, battery: 0.6, park: 1, limbered: 1.5 };
const MASSF = { line: 1.0, twoLines: 0.95, columns: 1.1, attack: 1.2, mass: 1.4, square: 0.5, road: 0.4, garrison: 1 };
function fireFrac(u) { if (u.form === 'line' && RANKS(u) === 3) return 2 / 3; if (u.form === 'twoLines') return RANKS(u) === 3 ? 1 / 3 : 0.5; return FIRE_FRAC[u.form] ?? 0.2; }
const FORM_TICKS = (u, to) => { if (to === 'square') return u.coh >= 50 ? 1 : 2; if (u.form === 'square') return 1; if (to === 'mass' || u.form === 'mass') return 3; if (to === 'road' || u.form === 'road') return 2; return 2; };

/* ---------------- light and visibility ---------------- */
const SUNSET = 20 * 60 + 20, DARK = 21 * 60 + 10, END = 21 * 60 + 30;
function bgVis(t) { const pts = [[300, 3000], [540, 6000], [720, 8000], [960, 6000], [SUNSET, 5000], [DARK, 1000], [END, 600]]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (t - a) / (b - a); } return 600; }
const duskFire = t => t <= SUNSET ? 1 : t >= DARK ? 0.5 : 1 - 0.5 * (t - SUNSET) / (DARK - SUNSET);
const K_CURV = 0.87 / (2 * 6371000);
const HIT = [[0, 0.15], [30, 0.15], [50, 0.08], [100, 0.05], [150, 0.03], [200, 0.015], [300, 0.005], [301, 0]];
function hitChance(r) { for (let i = 1; i < HIT.length; i++) if (r <= HIT[i][0]) { const [a, pa] = HIT[i - 1], [b, pb] = HIT[i]; return pa + (pb - pa) * (r - a) / (b - a); } return 0; }
function roundshot(r, cal) { const b = r < 600 ? 0.35 : r < 1000 ? 0.2 : r < 1600 ? 0.08 : 0; return b * (cal >= 12 ? 1 : cal >= 9 ? 0.8 : 0.7); }
const CREW = 12; // gunners per gun, est.
function canister(r, cal) { const lim = cal >= 12 ? 580 : 420; if (r > lim) return 0; const b = r <= 200 ? 4 : r <= 300 ? 4 - 1.5 * (r - 200) / 100 : 2.5 - 1.5 * (r - 300) / 200; return Math.max(0.6, b) * (cal >= 12 ? 1 : 0.6); }

/* ================= engine ================= */
function create(opts = {}) {
  const seed = opts.seed ?? (Math.random() * 1e9) | 0;
  const rnd = makeRng(seed);
  const scenario = opts.scenario || '1100', history = opts.history || 'uncertain';
  const E = {
    seed, rnd, scenario, history, K: Object.assign({}, K, opts.K || {}), t: scenario === '0500' ? 300 : 660, tick: 0,
    units: [], byId: {}, sps: [], spById: {}, leaders: {}, log: [], causes: [], orders: [], contacts: { FR: {}, AL: {}, PR: {} },
    morale: { FR: 80, AL: 70, PR: 75 }, armyStr0: { FR: 0, AL: 0, PR: 0 }, lossAcc: { FR: 0, AL: 0, PR: 0 }, wet: 0.6, wet0: 0.6, smoke: null, wind: { dir: 270, speed: 1.0 }, gustT: 0,
    pathCost: {}, losCache: new Map(), metrics: { lhsFall: null, hougFall: null, bulowAttack: null, zietenPapelotte: null, plancenoitLost: null, plancenoitRetaken: null, guardAttack: null, guardRepulsed: null, frBreak: null, alBreak: null, prEngaged: null },
    flags: {}, over: false, result: null, ai: null, ruleHooks: [], history_: [], spTaken: {},
  };
  E.fmtT = fmtT; E.W = W; E.T = T; E.TT = TT; E.hAt = hAt; E.ll2m = ll2m; E.m2ll = m2ll;
  const log = (cat, text, extra = {}) => { const e = { t: E.t, cat, text, ...extra }; E.log.push(e); return e; };
  E.logEvent = log;

  /* ----- environment ----- */
  if (scenario === '0500') E.wet0 = 1.0; else if (scenario === 'dry') E.wet0 = 0.3; else E.wet0 = 0.6;
  E.wet = E.wet0;
  const SX = Math.ceil(WM / 100) + 1, SY = Math.ceil(HM / 100) + 1; E.SX = SX; E.SY = SY;
  E.smoke = new Float32Array(SX * SY); let smokeTmp = new Float32Array(SX * SY);
  E.wind.dir = history === 'strict' ? 270 : 270 + rnd.normal('wind') * 25; E.wind.speed = history === 'strict' ? 1.0 : clamp(1.0 + rnd.normal('wind') * 0.35, 0.4, 2.2);
  E.gustT = E.t + rnd.range(20, 60, 'gust');
  const smokeAt = (x, y) => samp(E.smoke, x, y, SX, SY, 100);
  function addSmoke(x, y, amt) { const c = clamp(Math.round(x / 100), 0, SX - 1), r = clamp(Math.round(y / 100), 0, SY - 1); E.smoke[r * SX + c] += amt; }
  function wetness() {
    let w;
    if (scenario === '0500') w = E.t < 480 ? 1.0 : Math.max(0.2, 1.0 - 0.13 * (E.t - 480) / 60);
    else if (scenario === 'dry') w = Math.max(0.2, 0.3 - 0.13 * (E.t - 660) / 60);
    else w = Math.max(0.2, 0.6 - 0.13 * (E.t - 660) / 60);
    E.wet = w; E.wetLow = Math.min(1, E.wet0 - 0.5 * (E.wet0 - w));
  }
  const wetAt = (x, y) => LOW[cellIdx(x, y)] ? E.wetLow : E.wet;
  function stepSmoke() {
    const humid = E.t > 900, dec = humid ? E.K.SMOKE_DECAY_HUMID : E.K.SMOKE_DECAY;
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
  const targetH = u => (u.type === 'cav' ? 2.6 : u.lying ? 0.5 : u.type === 'gar' ? 4 : 1.8) + (u.heightBonus || 0);
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
    const o = { id: sp.id, name: sp.name, key: !!sp.key, secs, access: acc, holder: null, garrison: null, x: secs[secs.length - 1].x, y: secs[secs.length - 1].y };
    E.sps.push(o); E.spById[sp.id] = o;
  }
  E.objectives = {};
  for (const [k, o] of Object.entries(W.OBJECTIVES)) {
    const ob = { id: k, name: o.name };
    if (o.sp) { ob.sp = o.sp; const sp = E.spById[o.sp]; ob.point = [sp.x, sp.y]; }
    if (o.point) ob.point = ll2m(o.point[0], o.point[1]);
    if (o.line) { ob.line = o.line.map(p => ll2m(p[0], p[1])); ob.point = [(ob.line[0][0] + ob.line[1][0]) / 2, (ob.line[0][1] + ob.line[1][1]) / 2]; }
    if (o.own) ob.own = true;
    E.objectives[k] = ob;
  }
  E.routes = {}; for (const [k, r] of Object.entries(W.ROUTES)) E.routes[k] = r.map(p => ll2m(p[0], p[1]));
  E.chokes = W.CHOKES.map(c => { const [x, y] = ll2m(c.at[0], c.at[1]); return { ...c, x, y, used: 0, queue: [] }; });

  /* ----- units ----- */
  function makeUnit(spec) {
    const u = Object.assign({
      q: 1, coh: 80, cohMax: 100, fatigue: 15, ammo: 50, rounds: 120, wind: 100, status: 'steady', lying: false, onMap: true, gone: false,
      form: 'columns', formTo: null, formTimer: 0, task: { kind: 'hold' }, path: null, killed: 0, wounded: 0, captured: 0, stragglers: 0,
      hitTick: { mus: 0, art: 0, flank: 0, cav: 0 }, firedTick: false, lastHit: -99, lastFired: -99, brokeAt: null, rallyT: 0, leader: null, spId: null, spSec: null,
      cal: 6, howitzers: 0, deployedT: 0, silencedUntil: 0, isGuard: false, charge: null, retreatRoute: null, kills: 0, inContact: null, contactTicks: 0, stalemates: 0,
    }, spec);
    u.str0 = u.str;
    if (u.type === 'art') { u.guns0 = u.str; u.howitzers = Math.round(u.str * 0.25); }
    const fp = footprint(u); u.F = fp.F; u.D = fp.D;
    E.units.push(u); E.byId[u.id] = u; return u;
  }
  const FORMMAP = { line: 'line', twoLines: 'twoLines', columns: 'columns', garrison: 'garrison', battery: 'battery', park: 'park', hq: 'hq' };
  for (const r of W.RAW) {
    const [id, side, name, parent, nat, type, str, la, lo, facing, form, conf, note] = r;
    if (type === 'hq') continue;
    const [x, y] = ll2m(la, lo), q = W.QUALITY[id] ?? (type === 'art' ? 1 : 1.0);
    const u = makeUnit({ id, side, name, parent, nat, type, str, x, y, facing, form: FORMMAP[form] || 'columns', q, conf, note, corps: W.CORPS[id] || null, div: W.DIVISION[id] || null, cal: type === 'art' ? (W.CALIBRE[id] || (nat === 'GB' ? 9 : 6)) : 0 });
    u.isGuard = /^(g\d|yg|guyot|gchev|glanc|aGuard)/.test(id);
    u.cavKind = type === 'cav' ? (/cuirass|Household|Union|Carabin|Trip|Dragoon|Grenadiers à cheval/i.test(note + name + parent) ? 'heavy' : /Lancer/i.test(note + name) ? 'lancer' : 'light') : null;
    if (type === 'cav' && ['dubois', 'travers', 'farine', 'vial', 'guiton', 'donop', 'blanchard', 'guyot', 'somerset', 'ponsonby', 'trip'].includes(id)) u.cavKind = 'heavy';
    if (side === 'AL' && !u.corps) u.corps = 'wellington';
  }
  for (const r of (W.HORSE_BATTERIES || [])) { const [id, side, name, parent, nat, type, str, la, lo, facing] = r; const [x, y] = ll2m(la, lo); makeUnit({ id, side, name, parent, nat, type, str, x, y, facing, form: 'battery', q: id === 'aHGC' ? 1.15 : 1, corps: 'horseart', cal: 6, horse: true }); }
  // starting cohesion and fatigue: 75-90 by quality, -5 for the soaked night; French more tired
  for (const u of E.units) {
    u.coh = clamp(75 + (u.q - 0.75) * 30, 72, 90) - 5; u.cohMax = 100; u.minCoh = u.coh;
    u.fatigue = u.side === 'FR' ? 25 : 15; if (u.type === 'art') u.form = u.form === 'park' ? 'park' : 'battery';
    if (u.id === 'gLHS') u.ammo = 60;
  }
  // garrisons into strongpoints
  const GARRISON_SP = { gHoug: 'hougoumont', gLHS: 'lhs', gSand: 'sandpit', gPap: 'papelotte', gLaHaye: 'lahaye', gSmo: 'smohain', gFri: 'frischermont' };
  for (const [uid, spid] of Object.entries(GARRISON_SP)) { const u = E.byId[uid], sp = E.spById[spid]; if (!u) continue; occupy(u, sp, 'AL'); }
  function occupy(u, sp, side) {
    // (7) the old garrison, if another unit, stops being the garrison (before, two units could both think they held the place)
    if (sp.garrison && sp.garrison !== u.id) { const g0 = E.byId[sp.garrison]; if (g0 && g0.spId === sp.id) { g0.spId = null; g0.spSec = null; if (g0.type === 'gar') g0.type = 'inf'; g0.form = 'columns'; const fp0 = footprint(g0); g0.F = fp0.F; g0.D = fp0.D; if (g0.task.kind === 'garrison') g0.task = { kind: 'hold', since: E.t }; } }
    for (const s of sp.secs) if (!s.burnt) s.held = side;
    sp.holder = side; sp.garrison = u.id; u.spId = sp.id; u.type = u.type === 'inf' || u.type === 'gar' ? 'gar' : u.type; u.form = 'garrison';
    const sec = outerHeld(sp, side); u.spSec = sec; if (sec) { u.x = sec.x; u.y = sec.y; }
    u.task = { kind: 'garrison', sp: sp.id };
    const fp = footprint(u); u.F = fp.F; u.D = fp.D;
  }
  E.occupy = occupy;
  function outerHeld(sp, side) { for (const s of sp.secs) if (s.held === side && !s.burnt) return s; return null; }
  E.outerHeld = outerHeld;
  // every French brigade remembers its place in the 11:00 line (the 05:00 start sends them there)
  for (const u of E.units) if (u.side === 'FR') { u.deploy = [u.x, u.y]; u.deployForm = u.form; u.deployFacing = u.facing; }
  // off-map forces
  E.offmap = [];
  const addOff = (arr, group) => { for (const r of arr) { const [id, side, name, parent, nat, type, str, route, q, arrive] = r; const u = makeUnit({ id, side, name, parent, nat, type, str, x: -9999, y: -9999, facing: 270, form: type === 'art' ? 'limbered' : 'road', q, onMap: false, corps: route, group, baseArrive: arrive, cal: type === 'art' ? 6 : 0 }); u.coh = clamp(75 + (q - 0.75) * 30, 72, 90) - 5; u.fatigue = side === 'PR' ? 30 : 20; if (side === 'PR' && (route === 'pirch' || route === 'zieten')) u.ammo = r.ammo || 40; E.offmap.push(u); } };
  addOff(W.PRUSSIANS, 'prussians'); addOff(W.HAL_FORCE, 'hal'); addOff(W.GROUCHY_FORCE, 'grouchy');
  if (scenario === '0500') dawn();
  /* (6) the 05:00 start. Est. throughout: the sources agree that the rain stopped about 06:00, that Napoleon at 05:00 set the attack for
     09:00, that many French units had bivouacked well south of La Belle Alliance and that some were still not in place at 09:00; they
     do not give each corps' bivouac. So: d'Erlon's corps and Milhaud's cuirassiers lie a few hundred metres behind their 11:00 ground
     (the vanguard halted there the evening before); the Guard lies round Le Caillou; Reille, Kellermann and Lobau come up the high road
     from the direction of Genappe through the morning, one brigade every 10 minutes or so. The allied army is in its 11:00 places. */
  function dawn() {
    const RX = ll2m(50.6380, 4.4270)[0];
    const CAILLOU = 1300; // the Guard: about 1.3 km south of its 11:00 ground, round Le Caillou
    const COME = [ // [first arrival, unit ids in order of march]
      [375, ['huber', 'wathiez', 'aHPire']], [405, ['husson', 'campi', 'aBach']], [435, ['gauthier', 'jamin', 'aFoy']], [465, ['bauduin', 'soye', 'aJer', 'aIIres']],
      [495, ['picquet', 'guiton', 'blanchard', 'donop', 'aHKel']], [525, ['bellair', 'thevenet', 'bony', 'tromelin', 'aVI']], [570, ['dommanget', 'vinot', 'colbert', 'merlin', 'aHDS']],
    ];
    for (const u of E.units) {
      if (u.side !== 'FR') continue;
      const c = u.corps;
      if (c === 'derlon' || c === 'milhaud' || u.id === 'aHMil' || u.id === 'aHJac') { u.y += c === 'milhaud' || u.id === 'aHMil' ? 300 : 350; if (u.type === 'inf') u.form = 'columns'; if (u.type === 'art') u.form = 'park'; }
      else if (c === 'guard' || c === 'guardcav' || u.id === 'aHGC') { u.y += CAILLOU; if (u.type === 'art') u.form = 'park'; }
      const fp = footprint(u); u.F = fp.F; u.D = fp.D;
    }
    E.routes.frArrive = [[RX, HM + 200], [RX, HM - 30]].concat(W.ROUTES.frRetreat.slice(1, 3).reverse().map(p => ll2m(p[0], p[1])));
    for (const [t0, ids] of COME) ids.forEach((id, k) => {
      const u = E.byId[id]; if (!u) return;
      u.onMap = false; u.x = -9999; u.y = -9999; u.form = u.type === 'art' ? 'limbered' : 'road'; const fp = footprint(u); u.F = fp.F; u.D = fp.D;
      u.group = 'frArrive'; u.route = 'frArrive'; u.arriveAt = t0 + k * 10; u.baseArrive = u.arriveAt;
      // they halt about 700 m behind their place in the line, off the road, and wait for orders
      u.marchThen = { kind: 'move', dest: [u.deploy[0], u.deploy[1] + 700], then: 'hold' };
      E.offmap.push(u);
    });
  }
  for (const s of ['FR', 'AL']) E.armyStr0[s] = E.units.filter(u => u.side === s && (u.onMap || u.group === 'frArrive') && u.type !== 'art').reduce((a, u) => a + u.str, 0);
  E.armyStr0.PR = E.units.filter(u => u.side === 'PR' && u.type !== 'art').reduce((a, u) => a + u.str, 0);

  /* ----- leaders ----- */
  for (const L of W.LEADERS) { const l = { ...L, alive: true, wounded: false, orig: L.name }; if (L.at) { const [x, y] = ll2m(L.at[0], L.at[1]); l.x = x; l.y = y; } E.leaders[L.id] = l; if (L.unit && E.byId[L.unit]) E.byId[L.unit].leader = L.id; }
  const leaderPos = l => l.unit && E.byId[l.unit] ? [E.byId[l.unit].x, E.byId[l.unit].y] : l.x != null ? [l.x, l.y] : null;
  E.leaderPos = leaderPos;

  /* ----- start-of-game hidden draws ----- */
  const rw = rnd('rifle wagon');
  E.flags.rifleWagon = rw < E.K.RIFLE_NEAR ? 'near' : rw < E.K.RIFLE_NEAR + E.K.RIFLE_FAR ? 'far' : 'lost';
  log('hidden', `The rifle-ammunition wagon for La Haye Sainte is ${E.flags.rifleWagon === 'near' ? 'close behind the ridge' : E.flags.rifleWagon === 'far' ? 'stuck far back on the Brussels road' : 'lost on the road from Brussels'}.`, { cause: 'start roll' });

  /* ----- spatial index ----- */
  const BK = 400; let buckets = new Map();
  function rebuildIndex() { buckets = new Map(); for (const u of E.units) { if (!u.onMap || u.gone || u.str <= 0) continue; const k = Math.floor(u.x / BK) + ',' + Math.floor(u.y / BK); let b = buckets.get(k); if (!b) { b = []; buckets.set(k, b); } b.push(u); } }
  function near(x, y, r, filter) { const out = []; const c0 = Math.floor((x - r) / BK), c1 = Math.floor((x + r) / BK), r0 = Math.floor((y - r) / BK), r1 = Math.floor((y + r) / BK); for (let c = c0; c <= c1; c++) for (let rr = r0; rr <= r1; rr++) { const b = buckets.get(c + ',' + rr); if (!b) continue; for (const u of b) if (hyp(u.x - x, u.y - y) <= r && (!filter || filter(u))) out.push(u); } return out; }
  E.near = near; E.rebuildIndex = rebuildIndex;
  const enemyOf = s => s === 'FR' ? ['AL', 'PR'] : ['FR'];
  const isEnemy = (a, b) => (a.side === 'FR') !== (b.side === 'FR');
  E.isEnemy = isEnemy; E.enemyOf = enemyOf;
  const alive = u => u.onMap && !u.gone && u.str > 0;
  const formed = u => alive(u) && u.status !== 'broken';
  E.alive = alive; E.formed = formed;

  /* ----- tasks and formations ----- */
  function setForm(u, f) { if (u.form === f || u.formTo === f) return; if (u.type === 'gar') return; if (f === 'square' && (u.status === 'disordered' || u.status === 'broken' || u.form === 'mass' || u.type !== 'inf')) return; u.formTo = f; u.formTimer = FORM_TICKS(u, f); }
  E.setForm = setForm;
  function setTask(u, task, cause) { u.task = Object.assign({ since: E.t }, task); u.path = null; u.halted = false; if (cause) u.task.cause = cause; }
  E.setTask = setTask;
  function routeTo(u, dest, march) { dest = [clamp(dest[0], 10, WM - 10), clamp(dest[1], 10, HM - 10)]; // (7) a destination past the edge of the map was never reached
    if (march) { u.path = astar(E, u.type === 'gar' ? 'inf' : u.type, u.x, u.y, dest[0], dest[1]); } else u.path = [dest]; u.pathDest = dest; }
  E.routeTo = routeTo;

  /* ----- order delivery (riders) ----- */
  E.sendOrder = function (o) {
    // o: { from, to, kind, ..., urgent, conditions }. Delay = writing + riding; interpretation delay applied by the receiver.
    const from = E.leaders[o.from], to = E.leaders[o.to] || null;
    const fp = from ? leaderPos(from) : null, tp = to ? leaderPos(to) : (o.unitTo && E.byId[o.unitTo] ? [E.byId[o.unitTo].x, E.byId[o.unitTo].y] : null);
    const dist = fp && tp ? hyp(fp[0] - tp[0], fp[1] - tp[1]) : 1500;
    const write = o.writeMin ?? (o.from === 'napoleon' ? rnd.range(5, 15, 'order writing') : o.from === 'wellington' ? rnd.range(2, 6, 'order writing') : rnd.range(3, 8, 'order writing')) * (o.urgent ? 0.5 : 1);
    const speed = (8 * (1 - 0.4 * E.wet) * 1000 / 60); // cross-country rider, m/min
    const ride = o.rideMin ?? dist / speed;
    const interp = o.interpMin ?? (o.direct ? rnd.range(2, 5, 'interpretation') : rnd.range(10, 20, 'interpretation'));
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
    cavalry();
    applyDamage();
    cohesionAndMorale();
    supplyAndFatigue();
    stepSmoke();
    events();
    if (E.tick % 5 === 0) sighting();
    if (E.command) E.command.tick();
    keyPoints();
    for (const s of ['FR', 'AL', 'PR']) E.morale[s] = clamp(E.morale[s], 0, 100); // (7) events after the morale step could leave it outside 0-100 for a tick
    endCheck();
    E.t += 2; E.tick++;
    if (E.tick % 15 === 0) E.history_.push(snapshotLite());
    if (E.t % 60 === 0) E.moraleAt = Object.assign(E.moraleAt || {}, { [E.t]: { ...E.morale } });
  };

  /* ----- arrivals of off-map forces ----- */
  function arrivals() {
    for (const u of E.offmap) {
      if (u.onMap || u.gone || u.arriveAt == null || E.t < u.arriveAt) continue;
      const route = E.routes[u.route || (u.corps === 'bulow' || u.corps === 'pirch' ? 'bulow' : u.corps)];
      if (!route) continue;
      // choke point: the Lasne crossing limits throughput
      u.onMap = true; const [sx, sy] = route[0];
      // enter just inside the edge on the first on-map waypoint
      u.x = route[1][0]; u.y = route[1][1]; u.facing = bearing(route[2][0] - u.x, route[2][1] - u.y);
      u.form = u.type === 'art' ? 'limbered' : 'road'; const fp = footprint(u); u.F = fp.F; u.D = fp.D;
      setTask(u, { kind: 'march', route: route.slice(2), then: u.marchThen || null });
      u.path = route.slice(2).map(p => [p[0], p[1]]);
      log('arrival', `${u.name} appears at the edge of the field.`, { side: u.side, unit: u.id, hidden: true });
      if (u.side === 'FR' && E.command && E.command.noteOwn) E.command.noteOwn(u, 'seen coming up the high road');
      if (E.ai && E.ai.onArrival) E.ai.onArrival(E, u);
    }
  }

  /* ----- local reactions: squares, facing threats, lying down ----- */
  function reactions() {
    for (const u of E.units) {
      if (!formed(u) || u.type === 'art') continue;
      if (u.formTimer > 0) continue;
      const cavNear = u.type === 'inf' ? near(u.x, u.y, 650, e => isEnemy(u, e) && e.type === 'cav' && formed(e) && e.charge && e.charge.target === u.id) : [];
      if (u.type === 'inf' && cavNear.length) {
        // warning depends on seeing them: crest, smoke
        for (const c of cavNear) { const l = losU(u, c, 1.8); const d = hyp(c.x - u.x, c.y - u.y); if (l.clear && l.trans > 0.35 && d < 600 * l.trans + 50) { if (u.form !== 'square' && u.formTo !== 'square') { setForm(u, 'square'); u.squareFor = c.id; } break; } }
      } else if (u.form === 'square' && u.formTo == null) {
        const anyCav = near(u.x, u.y, 800, e => isEnemy(u, e) && e.type === 'cav' && formed(e));
        if (!anyCav.length) setForm(u, u.prevForm || (u.side === 'AL' ? 'twoLines' : 'columns'));
      }
      // wheel to face a close threat that is not in front, unless already engaged to the front
      if (u.type === 'inf' && u.form !== 'square' && !u.path && u.task.kind !== 'garrison') {
        const th = near(u.x, u.y, 400, e => isEnemy(u, e) && formed(e) && e.type !== 'art');
        if (th.length) { let best = null, bd = 1e9; for (const e of th) { const d = hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
          const front = th.some(e => hyp(e.x - u.x, e.y - u.y) < 220 && angDiff(u.facing, bearing(e.x - u.x, e.y - u.y)) < 60);
          if (!front && angDiff(u.facing, bearing(best.x - u.x, best.y - u.y)) > 60) u.facing = bearing(best.x - u.x, best.y - u.y); }
      }
      // lie down behind the crest under bombardment when no enemy foot or horse is close (Wellington's habit)
      if (u.side === 'AL' && u.type === 'inf' && u.task.kind === 'hold' && u.task.lieDown) {
        const threat = near(u.x, u.y, 450, e => isEnemy(u, e) && formed(e) && (e.type === 'inf' || e.type === 'cav')).length;
        u.lying = !threat && u.form !== 'square';
      } else if (u.lying && u.task.kind !== 'hold') u.lying = false;
    }
  }

  /* ----- movement ----- */
  function speedOf(u) {
    const tt = TT[cellIdx(u.x, u.y)], wet = wetAt(u.x, u.y);
    let base;
    if (u.type === 'inf' || u.type === 'gar') base = u.pace === 'quick' ? 70 : 49;
    else if (u.type === 'cav') base = u.pace === 'trot' ? 220 : u.pace === 'charge' ? 400 : 100;
    else base = u.horse || (u.nat === 'GB' && /troop|horse/i.test(u.name + u.parent)) || u.id === 'aRes' ? 110 : 60;
    let f = terrainSpeed(u.type === 'gar' ? 'inf' : u.type, tt, wet);
    if ((u.form === 'road' || u.form === 'limbered') && tt === T.ROAD) f = 1.2; else if (u.form === 'road' && tt === T.LANE) f = (1 - 0.5 * wet) + 0.15;
    if (u.form === 'line') f *= 0.8; else if (u.form === 'mass') f *= 0.9; else if (u.form === 'square') f = 0.2; else if (u.form === 'battery' || u.form === 'park') f *= u.type === 'art' ? 0.25 : 1;
    // (7) a square edges along at a fifth of the pace (est.); (8) for any task, not only a retreat: a party in square with enemy horse in sight
    // could not move at all before, and stood for hours. (8) the battery clause was cut off by a comment in (7); it never mattered, since guns limber to move.
    if (u.fatigue > 75) f *= 0.75; else if (u.fatigue > 50) f *= 0.9;
    // uphill
    if (u.path && u.path.length) { const [tx, ty] = u.path[0], d = hyp(tx - u.x, ty - u.y); if (d > 1) { const ahead = Math.min(50, d), nx = u.x + (tx - u.x) / d * ahead, ny = u.y + (ty - u.y) / d * ahead, gr = (hAt(nx, ny) - hAt(u.x, u.y)) / ahead; if (gr > 0.08) f *= 0.7; else if (gr > 0.05) f *= 0.85; } }
    if (u.status === 'broken') f = Math.max(f, 0.6) * (u.type === 'cav' ? 1.5 : 1.4);
    return base * f;
  }
  E.speedOf = speedOf;
  function movement() {
    for (const u of E.units) {
      if (!alive(u)) continue;
      // formation change in progress
      if (u.formTimer > 0) { u.formTimer--; if (u.formTimer === 0 && u.formTo) { if (u.formTo === 'square') u.prevForm = u.form; u.form = u.formTo; u.formTo = null; const fp = footprint(u); u.F = fp.F; u.D = fp.D; } continue; }
      if (u.type === 'gar' && u.status !== 'broken') continue;
      if (u.status === 'broken') { flee(u); continue; }
      if (u.task.kind === 'garrison' && u.spId) continue;
      if (!u.path || !u.path.length) continue;
      if (u.halted) continue;
      // artillery must limber to move
      if (u.type === 'art' && (u.form === 'battery' || u.form === 'park')) { if (hyp(u.path[u.path.length - 1][0] - u.x, u.path[u.path.length - 1][1] - u.y) > 60) { u.formTo = 'limbered'; u.formTimer = 1; continue; } else { u.path = null; continue; } }
      let budget = speedOf(u) * 2;
      while (budget > 0 && u.path.length) {
        const [tx, ty] = u.path[0], dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy);
        if (d < 1) { u.path.shift(); continue; }
        const stopShort = u.path.length === 1 && u.stopAt ? u.stopAt : 0;
        const go = Math.min(budget, d - stopShort);
        if (d - stopShort <= 0.5) { u.path.shift(); break; } // there (or as close as it means to go)
        if (go <= 0.5) break; // (8) the tick's march is spent; this was path.shift(), which dropped the next waypoint whenever a tick ended within half a metre of one
        u.x += dx / d * go; u.y += dy / d * go; budget -= go;
        if (u.status !== 'broken' && go > 5) u.facing = bearing(dx, dy);
        if (go >= d - 0.5) u.path.shift();
        u.movedTick = E.tick;
        // choke point: one column files through at a time (the Lasne crossing)
        let held = false;
        for (const ch of E.chokes) if (hyp(u.x - ch.x, u.y - ch.y) < ch.r && (u.form === 'road' || u.form === 'limbered')) {
          // (7) the column filing through is only the current one while it is still in column, on the move and of the same army; before,
          // a brigade that stopped in the defile, or an enemy one sent there, kept it shut for the rest of the day
          const cu = ch.cur && E.byId[ch.cur], filing = cu && alive(cu) && cu.side === u.side && (cu.form === 'road' || cu.form === 'limbered') && cu.path && cu.path.length && hyp(cu.x - ch.x, cu.y - ch.y) <= ch.r + 60;
          if (!filing) { if (ch.cur !== u.id) { ch.cur = u.id; ch.until = E.t + (u.type === 'art' ? u.str * 30 : u.str) / (ch.rate * (wetAt(ch.x, ch.y) > 0.7 ? 0.5 : 1)); } }
          if (ch.cur !== u.id || E.t < ch.until) { held = true; }
        }
        if (held) { const ch = E.chokes.find(c => hyp(u.x - c.x, u.y - c.y) < c.r); if (ch && ch.cur === u.id && E.t < ch.until) { budget = 0; } else if (ch && ch.cur !== u.id) { u.x -= dx / d * go; u.y -= dy / d * go; budget = 0; } }
      }
      u.x = clamp(u.x, 5, WM - 5); u.y = clamp(u.y, 5, HM - 5);
      if (!u.path.length) {
        u.path = null;
        if (u.task.arriveFacing != null) u.facing = u.task.arriveFacing;
        if (u.task.arriveForm) setForm(u, u.task.arriveForm);
        if (u.type === 'art' && u.form === 'limbered' && u.task.kind !== 'march') { u.formTo = u.task.parkForm || 'battery'; u.formTimer = 1; }
      }
    }
  }
  function flee(u) {
    // run toward the army's rear along the retreat road
    const route = u.side === 'FR' ? E.routes.frRetreat : u.side === 'PR' ? E.routes.prRetreat : E.routes.alRetreat;
    let best = route[route.length - 1], bi = route.length - 1;
    for (let i = 0; i < route.length; i++) { const p = route[i]; const ahead = u.side === 'FR' ? p[1] > u.y + 200 : u.side === 'AL' ? p[1] < u.y - 200 : p[0] > u.x + 200; if (ahead) { best = p; bi = i; break; } }
    const enemies = near(u.x, u.y, 700, e => isEnemy(u, e) && formed(e));
    let vx = best[0] - u.x, vy = best[1] - u.y; const L = hyp(vx, vy) || 1; vx /= L; vy /= L;
    for (const e of enemies) { const dx = u.x - e.x, dy = u.y - e.y, d = hyp(dx, dy) || 1; vx += dx / d * 0.6; vy += dy / d * 0.6; }
    const L2 = hyp(vx, vy) || 1, sp = speedOf(u) * 2;
    u.x = clamp(u.x + vx / L2 * sp, 5, WM - 5); u.y = clamp(u.y + vy / L2 * sp, 5, HM - 5); u.facing = bearing(vx, vy);
    // leaving the field
    if ((u.side === 'FR' && u.y > HM - 60) || (u.side === 'AL' && u.y < 60) || (u.side === 'PR' && u.x > WM - 60)) { u.gone = true; u.left = E.t; }
  }

  /* ----- fire ----- */
  const dmg = new Map(), secFire = new Map(); // secFire: muskets already firing at a garrison's section this tick
  function addDmg(t, cas, kind, flank, src) { if (E.onDmg) E.onDmg(t, cas, kind, src); let d = dmg.get(t.id); if (!d) { d = { mus: 0, art: 0, flank: 0, srcs: [] }; dmg.set(t.id, d); } d[kind] += cas; if (flank) d.flank += cas; if (src && d.srcs.length < 4) d.srcs.push(src.id); }
  function frontRange(a, b) {
    if (b.spSec) return Math.max(40, hyp(a.x - b.spSec.x, a.y - b.spSec.y) - b.spSec.r - a.D / 2);
    if (a.spSec) return Math.max(40, hyp(b.x - a.spSec.x, b.y - a.spSec.y) - a.spSec.r - b.D / 2);
    return Math.max(25, hyp(a.x - b.x, a.y - b.y) - (a.D + b.D) / 2);
  }
  function onFlank(t, from) { if (t.form === 'square' || t.type === 'gar') return false; return angDiff(t.facing, bearing(from.x - t.x, from.y - t.y)) > 100; }
  E.onFlank = onFlank;
  const fireCount = new Map();
  // (6) skirmish fire round held farms: see K.SKIRM_*. No dice, so with SKIRM_AMMO at 0 nothing changes.
  function skirmishFarms() {
    if (!E.K.SKIRM_AMMO) return;
    for (const g of E.units) {
      if (!formed(g) || g.type !== 'gar' || !g.spId) continue;
      const sp = E.spById[g.spId], foes = near(sp.x, sp.y, E.K.SKIRM_R, e => isEnemy(g, e) && formed(e) && e.type === 'inf' && !e.spId);
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
      const rifle = /95th|Rifle|Light Bn|Baker/i.test(g.name + g.parent + (g.note || '')), sec = g.spSec, cover = sec ? sec.cover : 0.4;
      if (g.ammo > 0) {
        const firers = Math.min(g.str, sec ? sec.cap : g.str) * 0.6 * press;
        if (tgt) addDmg(tgt, firers * 2 * (rifle ? 0.6 * 1.6 : 1) * E.K.SKIRM_P * g.q * (g.ammo < 15 ? 0.5 : 1) * duskFire(E.t), 'mus', false, g);
        g.ammo = Math.max(0, g.ammo - E.K.SKIRM_AMMO * press);
      }
      addDmg(g, men * E.K.SKIRM_SHARE * 2 * E.K.SKIRM_P * cover * (cover <= 0.3 ? E.K.WALL_FIRE : 1) * duskFire(E.t), 'mus', false, tgt);
    }
  }
  function fire() {
    dmg.clear(); fireCount.clear(); secFire.clear();
    const dusk = duskFire(E.t);
    for (const u of E.units) {
      if (!formed(u) || u.formTo === 'limbered') continue;
      if (u.type === 'inf' || u.type === 'gar') {
        if (u.lying || u.form === 'road' || u.ammo <= 0) continue;
        const cands = near(u.x, u.y, 330, e => isEnemy(u, e) && alive(e));
        let best = null, br = Infinity;
        for (const e of cands) {
          const r = frontRange(u, e); if (r > 300) continue;
          if (u.form !== 'square' && u.type !== 'gar' && angDiff(u.facing, bearing(e.x - u.x, e.y - u.y)) > 75) continue;
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
        let firers = men * (u.type === 'gar' ? 0.6 : fireFrac(u)) * ov * (u.formTimer > 0 ? 0.5 : 1);
        if (best.spSec && E.K.SEC_FIRE_PER_M) { // only so many muskets can bear on a farm's walls: about this many per metre of its perimeter (est.)
          const cap = 2 * Math.PI * best.spSec.r * E.K.SEC_FIRE_PER_M, used = secFire.get(best.id) || 0; secFire.set(best.id, used + firers); firers = Math.min(firers, Math.max(0, cap - used)); }
        const close = r < 110 && (best.task.kind === 'attack' || u.task.kind === 'attack');
        u.closeTicks = close && u.closeWith === best.id ? (u.closeTicks || 0) + 1 : close ? 1 : 0; u.closeWith = close ? best.id : null;
        const rate = close ? (u.closeTicks <= 2 ? 2 : 1.2) : 1, rifle = /95th|Rifle|Light Bn|Baker/i.test(u.name + u.parent + (u.note || ''));
        let p = hitChance(r); if (rifle && r > 100) p *= 1.6;
        const tcell = TT[cellIdx(best.x, best.y)], sc = best.spSec || (best.secCover && hyp(best.x - best.secCover.x, best.y - best.secCover.y) < best.secCover.r ? best.secCover : null), cover = sc ? sc.cover : (COVER[tcell] ?? 1);
        const sm = clamp(1 - 0.25 * smokeAt(u.x, u.y), 0.6, 1);
        const first = !u.volleyUsed && r < 60 ? 1.5 : 1; if (first > 1) u.volleyUsed = true;
        const am = u.ammo < 15 ? 0.5 : 1;
        const hits = firers * rate * (rifle ? 0.6 : 1) * 2 * p * u.q * Math.min(1.1, u.coh / 80) * sm * cover * (best.spSec && cover <= 0.3 ? E.K.WALL_FIRE : 1) * (best.lying ? 0.4 : 1) * dusk * first * am * E.K.FIRE * statusFire(u);
        addDmg(best, hits, 'mus', onFlank(best, u), u);
        u.ammo = Math.max(0, u.ammo - rate * 2 * (rifle ? 0.6 : 1) * (firers / Math.max(1, u.str)));
        u.firedTick = true; u.lastFired = E.tick; u.fireTarget = best.id;
        addSmoke(u.x, u.y, firers * rate * 2 * E.K.SMOKE_MUSKET);
        if (r < 300) u.inContact = best.id;
      } else if (u.type === 'art') {
        if (u.form !== 'battery' && u.form !== 'park') continue;
        if (u.rounds <= 0 || E.t < u.silencedUntil || u.str < 0.5) continue;
        const tgt = pickArtTarget(u); if (!tgt) continue;
        if (u.form === 'park' && u.task.kind !== 'bombard' && tgt.r > 900) continue;
        if (!E.flags.opened && u.task.kind !== 'bombard' && E.tick - u.lastHit > 5 && !(tgt.r < 900 && (tgt.e.task.kind === 'attack' || tgt.e.charge))) continue;
        if (tgt.r > (E.flags.opened ? 1400 : 1000) && u.task.kind !== 'bombard') continue;
        const { e, r } = tgt; const vis = e.type === 'gar' ? Math.min(0.5, tgt.vis) : tgt.vis;
        const guns = u.str * (u.form === 'park' ? 0.85 : 1), rate = u.cal >= 12 ? 1 : 2, rounds = guns * rate * 2;
        let per;
        const can = canister(r, u.cal);
        if (can > 0 && vis >= 0.5) per = can; else per = roundshot(r, u.cal) * (2 - wetAt(e.x, e.y));
        let dens = e.type === 'cav' ? (e.form === 'line' ? 1.2 : 1.5) : e.type === 'gar' ? 0.5 : (DENSITY[e.form] ?? 1);
        if (can > 0 && vis >= 0.5) dens = Math.pow(dens, 0.3); // canister is a cone: depth matters little
        const cover = e.spSec ? e.spSec.cover : 1, sm = clamp(1 - 0.2 * smokeAt(e.x, e.y), 0.6, 1);
        const sizeF = can > 0 && vis >= 0.5 ? clamp(e.F / 80, 0.3, 1) : clamp(e.F / 150, 0.15, 1) * clamp(e.D / 40, 0.5, 1.5);
        const hits = rounds * per * dens * sizeF * vis * cover * sm * duskFire(E.t) * E.K.ARTY * clamp(u.coh / 80, 0.5, 1.1);
        addDmg(e, hits, 'art', false, u); fireCount.set(e.id, (fireCount.get(e.id) || 0) + 1);
        u.rounds -= rate * 2; u.firedTick = true; u.lastFired = E.tick; u.fireTarget = e.id; u.fireVis = vis;
        addSmoke(u.x, u.y, rounds * E.K.SMOKE_GUN);
        // howitzer shells can fire buildings
        if (e.spSec && e.spSec.burnable && u.howitzers > 0 && !e.spSec.burnt) {
          const p = 1 - Math.pow(1 - 0.005 * (u.task.incendiary ? 3 : 1), u.howitzers * 2 * rate * vis);
          if (rnd('building fire') < p) burnSection(E.spById[e.spId], e.spSec, u);
        }
        if (e.type === 'art' && rnd('caisson') < 0.002 * Math.min(10, hits)) { addDmg(e, 0.5, 'art', false, u); e.coh -= 10; log('event', `A caisson explodes in ${e.name}'s battery.`, { side: e.side, unit: e.id }); }
      }
    }
  }
  function statusFire(u) { return u.status === 'shaken' ? 0.9 : u.status === 'disordered' ? 0.6 : 1; }
  function pickArtTarget(u) {
    const cands = near(u.x, u.y, 1600, e => isEnemy(u, e) && alive(e) && !(e.type === 'cav' && e.charge && e.charge.phase === 'charge'));
    let best = null, bs = -1;
    const area = u.task.kind === 'bombard' ? u.task.area : null;
    for (const e of cands) {
      const r = hyp(e.x - u.x, e.y - u.y); if (r > 1600) continue;
      // don't fire over friends close to the target
      if (near(e.x, e.y, 120, f => !isEnemy(u, f) && formed(f) && f !== u).length) continue;
      let l = losU(u, e, 2.2);
      if (!l.clear && e.spSec) { const d0 = hyp(e.x - u.x, e.y - u.y) || 1, k = Math.max(0, 1 - e.spSec.r * 0.85 / d0); l = los(u.x, u.y, 2.2, u.x + (e.x - u.x) * k, u.y + (e.y - u.y) * k, 3); }
      let vis = 0;
      if (l.clear && rnd('art spotting') < Math.max(0.15, l.trans)) { const half = los(u.x, u.y, 2.2, e.x, e.y, 0.9); vis = half.clear ? 1 : 0.5; }
      else if (area) { const c = E.contacts[u.side === 'FR' ? 'FR' : 'AL'][e.id]; if (c && E.t - c.t < 30 && hyp(c.x - e.x, c.y - e.y) < 200) vis = 0.2; else if (polyDist(e.x, e.y, area) < 350 && e.type !== 'gar') vis = E.K.BLIND; }
      if (!vis) continue;
      if (area && polyDist(e.x, e.y, area) > 500 && r > 600) continue;
      const dens = DENSITY[e.form] ?? 1.5, threat = e.type === 'inf' && e.task.kind === 'attack' ? 1.6 : 1;
      const score = 1 / (1 + (fireCount.get(e.id) || 0) * 1.5) * (e.type === 'gar' && !(area && e.spId && polyDist(e.x, e.y, area) < 50) && u.task.targetUnit !== e.id ? 0.25 : 1) * vis * dens * threat * (r < 600 ? 2 : r < 1000 ? 1.2 : 0.6) * (e.type === 'art' ? (r < 900 ? 0.8 : 0.3) : 1) * (u.task.targetUnit === e.id ? 3 : 1);
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
      if (!formed(u) || u.type !== 'inf' || u.task.kind !== 'attack' || u.halted) continue;
      if (u.formTimer > 0 || (u.standoffUntil && E.tick < u.standoffUntil)) continue;
      const tgt = currentTarget(u); if (!tgt) continue;
      const r = tgt.range;
      if (r > 55) { u.contactTicks = 0; continue; }
      if (u.form === 'road') { setForm(u, u.task.form || 'attack'); continue; } // (8) a column of route deploys before it can assault
      u.contactTicks = (u.contactTicks || 0) + 1;
      if (u.contactTicks % 2 !== 1) continue; // test every other tick while in contact
      shock(u, tgt);
    }
  }
  // (8) how far in front of its centre a body reaches for an assault: half its depth, except a column of route, whose depth runs back along
  // the road (half of it was 900 m for a big brigade, so a column a kilometre off "reached" a village and was set down inside it)
  const reachD = u => (u.form === 'road' || u.form === 'limbered') ? 30 : u.D / 2;
  function currentTarget(u) {
    const t = u.task;
    if (t.targetUnit) { const e = E.byId[t.targetUnit]; if (e && formed(e) && e.spId) { t.sp = e.spId; t.targetUnit = null; } else if (e && formed(e)) return { unit: e, range: frontRange(u, e) }; else t.targetUnit = null; }
    if (t.sp) { const sp = E.spById[t.sp]; const sec = sp.secs.find(s => s.held && s.held !== sideKey(u) && (s.held === 'FR') !== (u.side === 'FR') && !s.burnt); if (sec) { const g = E.byId[sp.garrison]; const r = Math.max(10, hyp(u.x - sec.x, u.y - sec.y) - sec.r - reachD(u)); return { sp, sec, unit: g && formed(g) ? g : null, range: r }; } }
    // nearest enemy in front within 120 m blocks the way
    const blk = near(u.x, u.y, 160, e => isEnemy(u, e) && formed(e) && e.type !== 'art' && !e.spId);
    let best = null, br = Infinity; for (const e of blk) { const r = frontRange(u, e); if (r < br && angDiff(u.facing, bearing(e.x - u.x, e.y - u.y)) < 80) { br = r; best = e; } }
    if (best) { u.task.targetUnit = best.id; return { unit: best, range: br }; }
    const gar = near(u.x, u.y, 260, e => isEnemy(u, e) && formed(e) && e.spId)[0];
    if (gar) { const sp = E.spById[gar.spId]; const sec = sp && sp.secs.find(s => s.held && (s.held === 'FR') !== (u.side === 'FR') && !s.burnt); if (sec) { u.task.sp = sp.id; return { sp, sec, unit: gar, range: Math.max(10, hyp(u.x - sec.x, u.y - sec.y) - sec.r - reachD(u)) }; } }
    return null;
  }
  const sideKey = u => u.side === 'PR' ? 'AL' : u.side; // Prussians and Anglo-allies share control of places
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
    const melee = (tgt.sec && cover <= 0.3) ? (d.outOfAmmo ? K_.NOAMMO_MELEE : 2) : Math.sqrt(1 / cover); // defenders with no cartridges can no longer hold the loopholes
    const volley = dmg.get(a.id) ? clamp(dmg.get(a.id).mus / Math.max(1, a.str) * 100 / 3, 0, 2) * 10 : 0;
    const formD = d.form === 'square' ? 0.75 : d.form === 'road' ? 0.4 : d.type === 'art' ? 0.5 : 1;
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
  function repulse(a, cause) {
    const back = fvec((a.facing + 180) % 360), fb = [a.x + back[0] * 380, a.y + back[1] * 380];
    a.task = { kind: 'rally', at: fb, prev: a.task, since: E.t, cause }; a.path = [fb]; a.halted = false; a.contactTicks = 0;
    if (a.coh < 15) breakUnit(a, cause);
  }
  E.repulse = repulse;
  function giveGround(d, a, dist) {
    if (d.type === 'gar') return;
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
    g.type = 'inf'; g.form = 'columns'; const fp = footprint(g); g.F = fp.F; g.D = fp.D;
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
    log('place', `${sp.name} ${to ? (from ? 'is taken by the ' : 'is occupied by the ') + (to === 'FR' ? 'French' : 'Allies') : 'is abandoned'}.`, { sp: sp.id, cause, important: true });
    if (sp.key) {
      if (to === 'FR') { E.morale.FR += 5; E.morale.AL -= 8; E.morale.PR -= 4; } else if (to === 'AL' && from === 'FR') { E.morale.AL += 5; E.morale.PR += 5; E.morale.FR -= 8; } else if (from === 'FR') E.morale.FR -= 8; else if (from === 'AL') E.morale.AL -= 8;
    }
    if (sp.id === 'lhs' && to === 'FR' && E.metrics.lhsFall == null) E.metrics.lhsFall = E.t;
    if (sp.id === 'hougoumont' && to === 'FR' && E.metrics.hougFall == null) E.metrics.hougFall = E.t;
    if (sp.id === 'plancenoit') { if (to === 'AL') { if (E.metrics.plancenoitLost == null) E.metrics.plancenoitLost = E.t; } else if (to === 'FR' && E.metrics.plancenoitLost != null) E.metrics.plancenoitRetaken = E.t; }
    if (E.ai && E.ai.onPlace) E.ai.onPlace(E, sp, from, to);
  }
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
  E.retreatExit = () => { const p = ll2m(50.6380, 4.4270); return [p[0], HM - 40]; };
  E.rearguardLine = () => { const [x, y] = ll2m(50.65675, 4.41333); return [[x - 420, y + 60], [x + 420, y + 60]]; };
  E.withdrawUnit = function (u) { u.gone = true; u.left = E.t; u.saved = true; u.path = null; };
  E.beginRetreat = function (o) {
    E.flags.frWithdraw = E.t; E.metrics.frWithdraw = E.t;
    E.flags.frWithdrawStr = E.units.filter(u => u.side === 'FR' && formed(u) && u.type !== 'art').reduce((a, u) => a + u.str, 0);
    E.morale.FR -= 5; // the army sees itself going back (est.)
    log('army', 'The French army begins to retreat on Charleroi.', { side: 'FR', important: true });
  };
  E.leaveSp = function (u) { const sp = u.spId ? E.spById[u.spId] : null; if (sp && sp.garrison === u.id) { sp.garrison = null; } u.spId = null; u.spSec = null; if (u.type === 'gar') u.type = 'inf'; u.form = 'columns'; const fp = footprint(u); u.F = fp.F; u.D = fp.D; };
  // detach part of a brigade (e.g. into Hougoumont)
  E.detach = function (u, men, newId, name) { men = Math.min(men, u.str - 100); if (men < 50) return null; u.str -= men; u.str0 -= men; const d = makeUnit({ id: newId, side: u.side, name, parent: u.name, nat: u.nat, type: 'inf', str: men, x: u.x, y: u.y, facing: u.facing, form: 'columns', q: u.q, corps: u.corps, div: u.div }); d.coh = u.coh; d.cohMax = u.cohMax; d.fatigue = u.fatigue; d.ammo = u.ammo; const fp = footprint(u); u.F = fp.F; u.D = fp.D; return d; };

  /* ----- cavalry ----- */
  function cavalry() {
    for (const c of E.units) {
      if (c.type !== 'cav' || !formed(c) || !c.charge) continue;
      const ch = c.charge, t = E.byId[ch.target];
      if (!t || !alive(t) || t.status === 'broken' && ch.phase !== 'pursue') { endCharge(c, false); continue; }
      const d = hyp(t.x - c.x, t.y - c.y) - (t.D + c.D) / 2;
      if (ch.phase === 'approach') { c.pace = 'trot'; c.path = [[t.x, t.y]]; c.stopAt = 0; if (d < 260) { ch.phase = 'charge'; c.path = null; } continue; }
      if (ch.phase === 'charge') { c.pace = 'charge'; resolveCharge(c, t); continue; }
    }
  }
  function impetus(c) { const kind = c.cavKind === 'heavy' ? 1.25 : c.cavKind === 'lancer' ? 1.1 : 1.0; return c.q * clamp(c.coh / 80, 0.3, 1.1) * clamp(c.wind / 100, 0.2, 1) * (1 - 0.5 * wetAt(c.x, c.y)) * kind; }
  function resolveCharge(c, t) {
    const ch = c.charge; c.wind -= 25 * (E.wet > 0.6 ? 1.5 : 1) * 0.6; ch.n = (ch.n || 0) + 1;
    const imp = impetus(c), flank = onFlank(t, c);
    let crossing = 1; { const mx = (c.x + t.x) / 2, my = (c.y + t.y) / 2; const tt = TT[cellIdx(mx, my)]; if (tt === T.SUNKEN) crossing = 0.5; else if (tt === T.ORCH || tt === T.WOOD || tt === T.BUILD) crossing = 0.4; }
    const c0 = E.cause(`${c.name} charged ${t.name}`);
    if (t.type === 'cav') {
      const a = imp * Math.sqrt(c.str) * (flank ? 1.5 : 1) * rnd.logn(0.25, 'cavalry melee'), b = impetus(t) * Math.sqrt(t.str) * (t.charge ? 1 : 0.65) * rnd.logn(0.25, 'cavalry melee');
      addCas(c, c.str * rnd.range(0.03, 0.07, 'cav cas'), 'melee'); addCas(t, t.str * rnd.range(0.03, 0.07, 'cav cas'), 'melee');
      if (a > b) { t.coh -= 30; c.coh -= 8; log('combat', `${c.name} rides down ${t.name}.`, { side: c.side, unit: c.id, cause: c0 }); if (t.coh < 15) breakUnit(t, c0); else giveGround(t, c, 500); maybePursue(c, t, c0); }
      else { c.coh -= 30; t.coh -= 8; log('combat', `${c.name} is beaten off by ${t.name}.`, { side: c.side, unit: c.id, cause: c0 }); if (c.coh < 15) breakUnit(c, c0); endCharge(c, true); }
      return;
    }
    if (t.type === 'art') {
      t.silencedUntil = E.t + 4; c.wind -= 5; c.coh -= 3;
      log('combat', `${c.name} rides among ${t.name}'s guns; the gunners take shelter.`, { side: c.side, unit: c.id, cause: c0 });
      endCharge(c, true); return;
    }
    if (t.type === 'gar') { c.coh -= 12; addCas(c, c.str * 0.05, 'mus'); endCharge(c, true); return; }
    // infantry
    if (t.form === 'square' && !t.formTo) {
      const p = t.coh > 40 ? 0 : t.coh >= 30 ? 0.03 : 0.15;
      if (rnd('square break-in') < p) { log('combat', `${c.name} breaks into the square of ${t.name}!`, { side: c.side, unit: c.id, cause: c0, important: true }); addCas(t, t.str * rnd.range(0.25, 0.5, 'square broken'), 'captured'); breakUnit(t, c0); maybePursue(c, t, c0); return; }
      t.coh -= 2; addCas(t, t.str * rnd.range(0.004, 0.012, 'cav vs square'), 'mus'); addCas(c, c.str * rnd.range(0.02, 0.05, 'cav vs square'), 'mus'); c.coh -= 4;
      endCharge(c, true); return;
    }
    t.coh -= flank ? 35 : 25;
    const resist = t.coh * t.q * crossing ** -1 * (t.form === 'line' ? 1 : t.form === 'twoLines' ? 1.05 : t.form === 'mass' ? 0.6 : t.form === 'road' ? 0.3 : 0.8) * (t.formTo === 'square' ? 0.7 : 1) * rnd.logn(0.3, 'cavalry morale test');
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
    const L = c.leader ? E.leaders[c.leader] : (c.corps === 'wellington' || c.side === 'AL' ? E.leaders.uxbridge : null);
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
      if (u.type === 'art') { const crewLoss = Math.min(u.str, tot / CREW); u.str = Math.max(0, u.str - crewLoss); u.killed += crewLoss * CREW * E.K.KW_RATIO; u.wounded += crewLoss * CREW * (1 - E.K.KW_RATIO); u.coh -= tot / 40 * 3; u.lastHit = E.tick; continue; } // casualties capped at the crew: about 12 gunners a gun
      addCas(u, tot, 'fire');
      const pct = tot / Math.max(1, before) * 100, artShare = d.art / Math.max(1e-6, d.mus + d.art), flankShare = d.flank / Math.max(1e-6, d.mus + d.art);
      let loss = E.K.COH_CAS * pct * (1 + (E.K.COH_ART - 1) * artShare) * (1 + (E.K.COH_FLANK - 1) * flankShare);
      if (u.spSec) loss *= u.spSec.cover <= 0.3 && E.K.WALL_COHF ? E.K.WALL_COHF : 0.5 + 0.5 * u.spSec.cover;
      u.srcArt = (u.srcArt || 0) + d.art; u.srcMus = (u.srcMus || 0) + d.mus;
      if (!u.firedTick && u.type !== 'cav') loss += E.K.NOREPLY;
      // men behind loopholed walls with cartridges in their pouches are not driven out by fire alone (5e, est.): fire cannot take them below the floor
      if (E.K.WALL_FLOOR && u.spSec && u.spSec.cover <= 0.3 && !u.spSec.burnt && u.ammo > 0 && !u.outOfAmmo && u.coh - loss < E.K.WALL_FLOOR) loss = Math.max(0, u.coh - E.K.WALL_FLOOR);
      u.coh -= loss; u.lastHit = E.tick; u.hitBy = d.srcs;
      // (5e, est.) a garrison caught by a cannonade in an orchard or wood, with no enemy foot or horse within 400 m, takes cover in its stone buildings
      if (E.K.SHELTER && u.spSec && u.spId && u.spSec.cover > 0.3 && d.art > d.mus) {
        const sp = E.spById[u.spId], side = u.side === 'PR' ? 'AL' : u.side, inner = sp.secs.find(s => s.held === side && !s.burnt && s.cover <= 0.3);
        if (inner && inner !== u.spSec && !near(u.x, u.y, 400, e => isEnemy(u, e) && formed(e) && (e.type === 'inf' || e.type === 'cav')).length) {
          const was = u.spSec.name; for (const s2 of sp.secs) { if (s2 === inner) break; if (s2.held === side) s2.held = null; }
          u.spSec = inner; u.x = inner.x; u.y = inner.y;
          log('combat', `Under the cannonade the defenders of ${sp.name} leave the ${was} and take cover in the ${inner.name}.`, { side: u.side, unit: u.id });
        }
      }
      if (d.art > 0) u.underArt = E.tick;
    }
    // (7) was alive(u), which missed a unit wiped out to exactly 0 in one tick: it went on "garrisoning" with no men
    for (const u of E.units) if (u.onMap && !u.gone && u.str < 25 && u.type !== 'art') { u.gone = true; u.left = E.t; if (u.spId) { const sp = E.spById[u.spId]; evictGarrison(sp, u, 'destroyed'); } }
  }
  function breakUnit(u, cause) {
    if (u.status === 'broken' || u.gone) return;
    u.status = 'broken'; u.coh = Math.min(u.coh, 12); u.brokeAt = E.t; u.lying = false; u.charge = null; u.halted = false;
    if (u.form === 'square' || u.form === 'line' || u.form === 'mass') { u.form = 'columns'; const fp = footprint(u); u.F = fp.F; u.D = fp.D; }
    if (u.spId) { const sp = E.spById[u.spId]; if (sp.garrison === u.id) { sp.garrison = null; for (const s of sp.secs) if (s.held === sideKey(u)) s.held = null; refreshHolder(sp, null, cause); } u.spId = null; u.spSec = null; u.type = u.type === 'gar' ? 'inf' : u.type; }
    if (u.form === 'garrison') { u.form = 'columns'; const fp = footprint(u); u.F = fp.F; u.D = fp.D; } // (7) a broken garrison is no longer in its farm's formation
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
    // La Garde recule
    if (u.isGuard && u.type === 'inf' && E.flags.guardAttacking && (u.task.guard || (u.task.prev && u.task.prev.guard))) {
      if (!E.flags.guardRepulsed) { E.flags.guardRepulsed = E.t; E.metrics.guardRepulsed = E.t; E.morale.FR -= 15; log('event', '"La Garde recule!" The cry runs along the French line.', { side: 'FR', cause: c, important: true }); }
      for (const f of E.units) if (f.side === 'FR' && formed(f) && f !== u && hyp(f.x - u.x, f.y - u.y) < 3000 && losU(f, u, 2).clear) f.coh -= 15;
    }
    if (u.leader && E.leaders[u.leader]) { /* leader rides with the fugitives */ }
    if (E.ai && E.ai.onBreak) E.ai.onBreak(E, u, c);
  }
  E.breakUnit = breakUnit;
  function cohesionAndMorale() {
    const dusk = E.t > DARK;
    for (const u of E.units) {
      if (!alive(u)) continue;
      // flank threat
      if (formed(u) && u.type !== 'art' && u.type !== 'gar' && u.form !== 'square' && E.tick % 2 === 0) {
        const th = near(u.x, u.y, 500, e => isEnemy(u, e) && formed(e) && e.type !== 'art' && e.str > 500);
        if (th.some(e => onFlank(u, e) && hyp(e.x - u.x, e.y - u.y) < 500 && !(e.charge && e.charge.target !== u.id))) u.coh -= E.K.FLANK_THREAT;
      }
      // broken troops running through
      if (u.status === 'broken') { for (const f of near(u.x, u.y, 60, f => f.side === u.side && formed(f) && f !== u)) { f.passedBy = f.passedBy || {}; if (!f.passedBy[u.id]) { f.passedBy[u.id] = 1; f.coh -= 5; } } }
      // recovery out of fire
      const quiet = E.tick - u.lastHit > 2 && !near(u.x, u.y, 300, e => isEnemy(u, e) && formed(e)).length;
      if (u.status !== 'broken' && quiet && E.morale[u.side === 'PR' ? 'PR' : u.side] >= 35 && u.task.kind !== 'pursue' && u.pace !== 'quick') {
        let rec = E.K.RECOVER * (u.fatigue > 60 ? 0.5 : 1) * (0.7 + 0.3 * u.q);
        if (u.leader && E.leaders[u.leader] && E.leaders[u.leader].alive) rec *= 1.5;
        const chief = u.side === 'FR' ? E.leaders.napoleon : E.leaders.wellington; const cp = leaderPos(chief);
        if (cp && hyp(cp[0] - u.x, cp[1] - u.y) < 500) rec *= 2;
        u.coh = Math.min(u.cohMax, u.coh + rec);
      }
      else if (u.status !== 'broken' && !quiet && E.tick - u.lastHit <= 2 && !E.near(u.x, u.y, 250, e => isEnemy(u, e) && formed(e) && e.type !== 'art').length && E.morale[u.side === 'PR' ? 'PR' : u.side] >= 35) {
        u.coh = Math.min(u.cohMax, u.coh + E.K.RECOVER * E.K.UNDER_FIRE_RECOVER * u.q * (u.fatigue > 60 ? 0.5 : 1));
      }
      // wind recovery for cavalry
      if (u.type === 'cav' && !u.charge && quiet) u.wind = Math.min(100 - u.fatigue / 3, u.wind + 4);
      // permanent damage
      if (u.coh < u.minCoh) { if (u.coh < 50) u.cohMax = Math.min(u.cohMax, 100 - E.K.CAP_LOSS * (50 - Math.max(0, u.coh))); u.minCoh = u.coh; }
      // status
      const prev = u.status;
      if (u.status === 'broken') {
        // rally: no enemy within 800 m for 15-30 min and a leader near
        if (!near(u.x, u.y, 800, e => isEnemy(u, e) && formed(e)).length) { u.rallyT = (u.rallyT || 0) + 2; if (!u.rallyNeed) u.rallyNeed = rnd.range(15, 30, 'rally'); if (u.rallyT >= u.rallyNeed && E.morale[u.side === 'PR' ? 'PR' : u.side] >= 20 && !dusk) { u.status = 'disordered'; u.coh = rnd.range(30, 40, 'rally'); u.cohMax = Math.min(u.cohMax, 55); u.rallyT = 0; u.rallyNeed = 0; u.task = { kind: 'hold', since: E.t }; u.path = null; log('rally', `${u.name} rallies.`, { side: u.side, unit: u.id }); if (E.ai && E.ai.onRally) E.ai.onRally(E, u); } }
        else u.rallyT = 0;
        // stragglers
        if (rnd('stragglers') < 0.5) addCas(u, u.str * 0.01, 'stragglers');
        // pursuit by cavalry
        const cav = near(u.x, u.y, 250, e => isEnemy(u, e) && e.type === 'cav' && formed(e));
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
      if (prev !== u.status && (u.status === 'disordered') && u.form === 'square' && u.formTo == null) { /* stays in square but weaker */ }
      // raw units leave the field
      if ((u.q <= 0.72) && u.coh < 40 && E.tick - u.lastHit < 3 && rnd('raw unit leaves') < 0.02) { u.gone = true; u.left = E.t; log('event', `${u.name} leaves the field.`, { side: u.side, unit: u.id, important: true }); E.morale[u.side] -= 1; }
    }
    // (8) the army feels its losses: men killed, wounded or taken since the last tick, as a share of its strength at the start
    for (const s of ['FR', 'AL', 'PR']) { if (E.K.MORALE_CAS && E.lossAcc[s]) E.morale[s] -= E.K.MORALE_CAS * E.lossAcc[s] / Math.max(1, E.armyStr0[s]) * 100; E.lossAcc[s] = 0; }
    // army break: every unit tests each tick
    for (const s of ['FR', 'AL', 'PR']) {
      E.morale[s] = clamp(E.morale[s], 0, 100);
      if (E.morale[s] < 20) {
        if (!E.flags[s + 'Broken']) { E.flags[s + 'Broken'] = E.t; if (s === 'FR') E.metrics.frBreak = E.t; if (s === 'AL') E.metrics.alBreak = E.t; log('army', `The ${s === 'FR' ? 'French' : s === 'AL' ? 'Anglo-allied' : 'Prussian'} army is breaking.`, { side: s, important: true }); }
        for (const u of E.units) if (u.side === s && formed(u) && u.type !== 'art') { const p = clamp(0.05 * (1 + (55 - u.coh) / 20) / u.q, 0.01, 0.5); if (rnd('army rout') < p) breakUnit(u, E.cause('The army was breaking')); }
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
      if (u.type === 'art') { u.rounds = Math.min(130, u.rounds + 1.5); if (out && u.rounds < 100 && E.tick % 7 === 0) u.rounds = Math.min(130, u.rounds + 40); continue; }
      if (u.ammo <= 0 && !u.outOfAmmo) { u.outOfAmmo = true; u.coh -= 15; log('supply', `${u.name} is out of ammunition.`, { side: u.side, unit: u.id, important: u.type === 'gar' }); }
      if (u.ammo > 0) u.outOfAmmo = false;
      if (u.type === 'gar' && u.spId) {
        if (u.ammo < 30 && E.tick % 7 === 0) {
          const sp = E.spById[u.spId], [ax, ay] = sp.access[0], [bx, by] = sp.access[1], mx = (ax + bx) / 2, my = (ay + by) / 2;
          const underFire = near(mx, my, 350, e => isEnemy(u, e) && formed(e)).length > 0 || E.tick - u.lastHit < 2;
          const rifles = u.id === 'gLHS' || /95th|Rifle/i.test(u.name + u.parent);
          let available = true;
          if (rifles) available = E.flags.rifleWagon === 'near' || (E.flags.rifleWagon === 'far' && E.t >= E.K.RIFLE_FAR_T);
          const p = !available ? 0 : underFire ? rnd.range(0.3, 0.6, 'resupply odds') : 0.95;
          if (rnd('resupply') < p) { u.ammo = Math.min(50, u.ammo + 20); log('supply', `Cartridges get through to ${sp.name}.`, { side: u.side, unit: u.id }); }
          else if (rifles && !available && !u.warnedRifle) { u.warnedRifle = true; log('supply', `No rifle cartridges can be found for ${sp.name}; musket rounds do not fit the Baker rifle.`, { side: u.side, unit: u.id, important: true }); }
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
    for (const side of ['FR', 'AL']) {
      const mine = E.units.filter(u => formed(u) && (side === 'FR' ? u.side === 'FR' : u.side !== 'FR'));
      const theirs = E.units.filter(u => alive(u) && (side === 'FR' ? u.side !== 'FR' : u.side === 'FR'));
      const book = E.contacts[side];
      for (const e of theirs) {
        // nearest few observers
        let obs = mine.map(o => [hyp(o.x - e.x, o.y - e.y), o]).filter(a => a[0] < 8000).sort((a, b) => a[0] - b[0]).slice(0, 4);
        let seen = false, bestR = 1e9;
        let seer = null, seenTrans = 1;
        for (const [r, o] of obs) { const l = losU(o, e, 2.5); if (!l.clear) continue; if (rnd('sighting') < detectP(r, l.trans, e.str * (e.type === 'art' ? 15 : 1)) * (e.concealed ?? 1)) { seen = true; bestR = Math.min(bestR, r); seer = o; seenTrans = l.trans; break; } }
        if (seen && E.command) E.command.observed(seer, e, bestR, seenTrans);
        if (seen) { const c = book[e.id] || (book[e.id] = {}); Object.assign(c, { t: E.t, x: e.x, y: e.y, form: e.form, type: e.type, str: e.str * rnd.range(0.75, 1.25, 'strength estimate') * (1 + rnd.normal('strength estimate') * 0.1 * Math.max(0, bestR / 1000 - 1)), r: bestR, id: bestR < 1000 ? e.id : (c.id || null), side: e.side, moving: e.movedTick === E.tick }); }
      }
    }
  }

  /* ----- key points, Prussian engagement ----- */
  function keyPoints() {
    // Prussians engage: any Prussian unit firing at or assaulting a French unit
    if (!E.flags.prEngaged) {
      const pr = E.units.find(u => u.side === 'PR' && alive(u) && u.firedTick && u.fireTarget && E.byId[u.fireTarget] && E.byId[u.fireTarget].side === 'FR');
      if (pr) { E.flags.prEngaged = E.t; E.metrics.prEngaged = E.t; E.morale.FR -= 10; E.morale.AL += 10; log('army', `The Prussians are engaged: ${pr.name} opens fire near ${nearestPlace(pr.x, pr.y)}.`, { side: 'PR', important: true }); if (E.metrics.bulowAttack == null && pr.corps === 'bulow') E.metrics.bulowAttack = E.t; }
    }
    if (E.metrics.bulowAttack == null) { const b = E.units.find(u => u.corps === 'bulow' && alive(u) && u.firedTick && u.fireTarget && E.byId[u.fireTarget] && E.byId[u.fireTarget].side === 'FR'); if (b) E.metrics.bulowAttack = E.t; }
    if (!E.flags.zietenEngaged) { const z = E.units.find(u => u.corps === 'zieten' && alive(u) && u.firedTick && u.fireTarget && E.byId[u.fireTarget] && E.byId[u.fireTarget].side === 'FR'); if (z) { E.flags.zietenEngaged = E.t; E.morale.FR -= 10; E.morale.AL += 5; log('army', 'Zieten falls on the French right near Papelotte.', { side: 'PR', important: true }); } }
    if (E.metrics.zietenPapelotte == null) { const pap = E.spById.papelotte; const z = E.units.find(u => u.corps === 'zieten' && alive(u) && hyp(u.x - pap.x, u.y - pap.y) < 700); if (z) { E.metrics.zietenPapelotte = E.t; log('army', `Zieten's leading troops reach Papelotte.`, { side: 'PR', important: true }); } }
    // ridge crest key point: French formed infantry holding the allied crest with no allied formed foot within 250 m
    const crest = E.objectives.ridgeCentre.line;
    const frOnCrest = E.units.filter(u => u.side === 'FR' && formed(u) && u.type === 'inf' && polyDist(u.x, u.y, crest) < 120 && !near(u.x, u.y, 250, e => e.side !== 'FR' && formed(e) && e.type !== 'art').length);
    const held = frOnCrest.length > 0;
    if (held && !E.flags.crestFR) { E.flags.crestFR = E.t; E.morale.FR += 5; E.morale.AL -= 8; log('place', 'French infantry stand on the crest of the Mont-Saint-Jean ridge.', { side: 'FR', important: true }); }
    else if (!held && E.flags.crestFR && E.t - E.flags.crestFR > 20) { E.flags.crestFR = null; E.morale.AL += 5; E.morale.FR -= 8; log('place', 'The Allies clear the crest again.', { side: 'AL' }); }
  }
  function nearestPlace(x, y) { let best = 'the field', bd = Infinity; for (const l of W.LM) { const d = hyp(l.x - x, l.y - y); if (d < bd) { bd = d; best = l.n; } } return best; }
  E.nearestPlace = nearestPlace;

  /* ----- end and score ----- */
  function endCheck() {
    if (E.t >= END - 2) return finish('nightfall');
    if (E.flags.FRBroken && E.t - E.flags.FRBroken > 40) return finish('French army broken');
    if (E.flags.ALBroken && E.t - E.flags.ALBroken > 40 && !E.flags.prEngaged) return finish('Anglo-allied army broken');
    // (6) the retreat is over when nine-tenths of the foot and horse that were formed when it began have left the field
    if (E.flags.frWithdraw && E.t - E.flags.frWithdraw > 30 && E.tick % 5 === 0) {
      const left = E.units.filter(u => u.side === 'FR' && formed(u) && u.type !== 'art').reduce((a, u) => a + u.str, 0);
      if (left < 0.1 * E.flags.frWithdrawStr) return finish('the French army has drawn off');
    }
  }
  function finish(why) {
    E.over = true; const r = E.result = { why, t: E.t };
    const cas = side => { let kw = 0, cap = 0, str = 0; for (const u of E.units) { if (u.side !== side && !(side === 'AL' && u.side === 'AL')) continue; kw += u.killed + u.wounded; cap += u.captured + u.stragglers; } return { kw: Math.round(kw), cap: Math.round(cap) }; };
    r.cas = { FR: cas('FR'), AL: cas('AL'), PR: cas('PR') };
    // grade
    const crestFR = !!E.flags.crestFR, frBroke = E.flags.FRBroken, alBroke = E.flags.ALBroken;
    const frM = E.morale.FR, roadHeld = !E.units.some(u => u.side !== 'FR' && formed(u) && hyp(u.x - E.spById.ba.x, u.y - E.spById.ba.y) < 600);
    if (alBroke && !frBroke && frM >= 40 && roadHeld) r.grade = 'Decisive French victory';
    else if (alBroke && !frBroke) r.grade = 'French victory';
    else if (frBroke && frBroke < 18 * 60) r.grade = 'French catastrophe';
    else if (frBroke) r.grade = 'Allied victory';
    else if (crestFR) r.grade = 'Marginal French victory';
    else if (E.flags.frWithdraw && frM >= 20) r.grade = 'Marginal Allied victory';
    else r.grade = 'Draw';
    if (E.flags.frWithdraw) { // what the retreat brought away: brigades that marched off in order, and their guns
      const fr = E.units.filter(u => u.side === 'FR'), sv = fr.filter(u => u.saved);
      r.withdrawn = { from: E.flags.frWithdraw, men: Math.round(sv.filter(u => u.type !== 'art').reduce((a, u) => a + u.str, 0)), guns: Math.round(sv.filter(u => u.type === 'art').reduce((a, u) => a + u.str, 0)),
        gunsAll: Math.round(fr.filter(u => u.type === 'art').reduce((a, u) => a + (u.guns0 || u.str0 || 0), 0)), menAtStart: Math.round(E.flags.frWithdrawStr), stillHere: Math.round(fr.filter(u => formed(u) && u.type !== 'art').reduce((a, u) => a + u.str, 0)) };
    }
    log('end', `The battle ends (${why}): ${r.grade}.`, { important: true });
  }
  E.finish = finish;

  function snapshotLite() { return { t: E.t, morale: { ...E.morale }, kw: { FR: sumSide('FR', 'kw'), AL: sumSide('AL', 'kw'), PR: sumSide('PR', 'kw') } }; }
  function sumSide(side, what) { let s = 0; for (const u of E.units) if (u.side === side) s += what === 'kw' ? u.killed + u.wounded : u.str; return Math.round(s); }
  E.sumSide = sumSide;
  E.run = function (until = END) { while (!E.over && E.t < until) E.step(); return E; };
  return E;
}

const api = { create, K, fmtT, T, TT, footprint, hitChance, bgVis, LOW };
root.WEngine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
