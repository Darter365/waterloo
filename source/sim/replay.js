/* Waterloo replays (step 6): fight a battle again from the orders the player gave, or with one of them changed.
   The engine is deterministic: the same settings, seed and orders, given at the same minutes, fight the same battle.
   Used by the game (to fight again from a chosen moment), by its re-run worker (the what-ifs) and by the tests. */
(function (root) {
'use strict';
const req = n => (typeof require === 'function' ? require(n) : null);
const En = () => root.WEngine || req('./engine.js'), AI = () => root.WAI || req('./ai.js'), Cmd = () => root.WCommand || req('./command.js'), Ord = () => root.WOrders || req('./orders.js'), Scr = () => root.WScript || req('./script.js');
const clone = x => JSON.parse(JSON.stringify(x));
const START = 660;

// a battle set up exactly as the game sets one up
function setup(o) {
  const E = En().create({ seed: o.seed, history: o.history, scenario: o.scenario });
  AI().make({ plan: 'script' }).init(E);
  Cmd().install(E, { staff: o.staff, silence: o.silence }); Ord().install(E);
  E.command.morningLook();
  return E;
}
// one entry of the order log: an order, a letter of several steps, tearing one up while it was still being written, or handing over
function apply(E, e, made) {
  const C = E.command;
  if (e.k === 'order') { const r = C.order(clone(e.spec)); made[e.i] = r.ok ? (r.orders || [r.order]) : []; }
  else if (e.k === 'seq') { const r = C.orderSeq(clone(e.specs)); made[e.i] = r.ok ? (r.orders || [r.order]) : []; }
  else if (e.k === 'cancel') { const os = made[e.ref]; const o = os && os[e.step || 0]; if (o) C.cancel(o); }
  else if (e.k === 'hist') Scr().historical(E, { from: e.t }); // the player handed the rest of the day to Napoleon's own orders
}
// the log with one change: an order left out, or sent so many minutes earlier or later
function variant(log, v, start = START) {
  let L = log.map(e => Object.assign({}, e));
  if (v && v.drop != null) L = L.filter(e => e.i !== v.drop && !(e.k === 'cancel' && e.ref === v.drop));
  if (v && v.shift != null) for (const e of L) if (e.i === v.shift || (e.k === 'cancel' && e.ref === v.shift)) e.t = Math.max(start, e.t + v.by);
  return L.sort((a, b) => a.t - b.t || a.i - b.i);
}
// what the after-action report keeps of a battle every ten minutes
function sample(E) {
  const s = { t: E.t, ranks: {}, kw: {}, morale: Object.assign({}, E.morale) };
  for (const side of ['FR', 'AL', 'PR']) { let r = 0, k = 0; for (const u of E.units) { if (u.side !== side) continue; k += u.killed + u.wounded; if (u.onMap && !u.gone && u.status !== 'broken' && u.type !== 'art') r += u.str; } s.ranks[side] = Math.round(r); s.kw[side] = Math.round(k); }
  return s;
}
/* run: o = the game's settings {seed, history, scenario, staff, silence}; log = the order log; opt:
   { until, seed (another draw of chance), historical (Napoleon's own orders instead of yours), drop, shift + by, every (sample minutes),
     onEntry(E, entry) after each log entry is applied, onStep(E) after each step } */
function run(o, log, opt = {}) {
  const E = setup(Object.assign({}, o, opt.seed != null ? { seed: opt.seed } : {}));
  if (opt.historical) Scr().historical(E);
  const L = opt.historical ? [] : variant(log || [], opt, E.t), made = {}, samples = [], every = opt.every || 10, until = opt.until ?? Infinity;
  let i = 0, nextS = E.t;
  while (!E.over && E.t < until) {
    while (i < L.length && L[i].t <= E.t) { apply(E, L[i], made); if (opt.onEntry) opt.onEntry(E, L[i], made); i++; }
    if (E.t >= nextS) { samples.push(sample(E)); nextS += every; }
    E.step();
    if (opt.onStep) opt.onStep(E);
  }
  if (E.over) samples.push(sample(E));
  return { E, samples, made };
}
const GRADES = ['French catastrophe', 'Allied victory', 'Marginal Allied victory', 'Draw', 'Marginal French victory', 'French victory', 'Decisive French victory'];
// a short account of how a battle went, for comparing one run with another
function summary(E, samples) {
  const R = E.result || { grade: 'unfinished', t: E.t, cas: null };
  const places = {}; for (const sp of E.sps) places[sp.id] = sp.holder || null;
  return { grade: R.grade, gradeN: GRADES.indexOf(R.grade), why: R.why, t: R.t, cas: R.cas, metrics: Object.assign({}, E.metrics), morale: Object.assign({}, E.morale), crest: !!E.flags.crestFR, places, samples: samples || [] };
}

root.WReplay = { setup, apply, variant, run, summary, sample, GRADES, START };
if (typeof module !== 'undefined' && module.exports) module.exports = root.WReplay;
})(typeof globalThis !== 'undefined' ? globalThis : this);
