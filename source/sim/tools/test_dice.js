/* The dice's own tests (engine.js, makeRng; docs/METHOD.md section 4).
     node tools/test_dice.js [seed=1003]
   1. Same seed and same orders: the same draws and the same battle (rule 6).
   2. One order changed, or sent later. A draw's identity is its purpose, whose draw it is, the tick, and its count within the tick,
      and a keyed draw's value follows from its identity: so "a draw both battles ask for has the same value" is true by
      construction, and is checked here only as a guard on the generator. What the design is for is tested on the field itself,
      at two moments. At 17:10 the order is written and on its way but the corps has not yet acted on it: next to nothing on the
      field may differ (98% of bodies the same (est.): a rider on a different road can be seen by someone) (under the old single sequence the delayed order has by then re-rolled a third of the field). At 18:00 the
      corps has been marching to the new order for half an hour and the battle is honestly parting: four fifths of the bodies
      outside the corps must still stand exactly as in the unchanged battle, and more of them than under the single sequence,
      which is fought beside it; and two thirds of the unchanged battle's later events must still happen, word for word, at the
      same minute. The fractions are margins under what seeds 1003, 1010 and 1017 gave (est.): 86 to 93% of bodies, 76 to 94% of
      events; the single sequence kept 60 to 75% of bodies.
   3. Every draw says whose it is (bar three that belong to the whole field or the one headquarters: gusts, the headquarters moving, Napoleon hit), and no owner's draw is asked for more often in a
      tick than its rule needs (once; twice for a normal deviate). More means two things share one identity and so each other's
      luck. Checked across the ways battles are fought: the command layer with either chief of staff, aides sent to look, a second
      battle, and the generic commanders with no command layer.
   4. The values behave as dice: evenly spread, and one owner's draws in successive ticks, or for two purposes, are unrelated. */
'use strict';
const path = require('path'), crypto = require('crypto');
const SIM = path.join(__dirname, '..');
const R = require(path.join(SIM, 'replay.js')), Scr = require(path.join(SIM, 'script.js'));
const seed = +(process.argv[2] || 1003), T0 = 990; // the changed order goes out at 16:30
let passed = 0, failed = 0;
const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log('FAIL ' + what); } };
const ORDER = pl => ({ to: 'lobau', action: 'advance', objective: { place: pl }, conditions: [], manner: {} });
function stateHash(E) { // as refset.js
  const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
  const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
  const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0);
  return crypto.createHash('sha1').update(JSON.stringify([E.t, E.morale, units, places, dice])).digest('hex').slice(0, 16);
}
const unitState = (E, own) => new Map(E.units.filter(u => own == null || E.command.cmdOf(u) !== own).map(u => [u.id, [u.x, u.y, u.str, u.coh, u.status, u.form].join()]));
function fight(s, at, place, o = {}) {
  const trace = new Map(), E = R.setup({ seed: s, history: 'uncertain', scenario: '1100', staff: o.staff || 'soult', silence: 0, dice: o.dice, diceTrace: trace });
  Scr.historical(E);
  let sent = at == null, guard = 0, after40 = null, after90 = null;
  while (!E.over && guard++ < 2000) {
    if (!sent && E.t >= at) { sent = true; const r = E.command.order(ORDER(place)); if (!r.ok) throw new Error('order refused: ' + r.error); }
    if (o.aidesAt && E.t === o.aidesAt) for (const pl of ['plancenoit', 'papelotte']) E.command.order({ to: 'hq', action: 'observe', objective: { place: pl }, conditions: [], manner: {} });
    E.step();
    if (E.t === T0 + 40) after40 = { others: unitState(E, 'lobau'), all: unitState(E, null) };
    if (E.t === T0 + 90) after90 = { others: unitState(E, 'lobau'), all: unitState(E, null) };
  }
  return { E, trace, after40, after90, hash: stateHash(E), dice: Object.values(E.rnd.counts).reduce((a, b) => a + b, 0), events: new Set(E.log.filter(e => e.t >= T0).map(e => e.t + '|' + e.cat + '|' + e.text)) };
}
const stood = (a, b, when, which) => { let n = 0, same = 0; for (const [id, st] of a[when][which]) { n++; if (b[when][which].get(id) === st) same++; } return [same, n]; };
const same = (a, b) => { if (a.size !== b.size) return false; for (const [k, v] of a) if (b.get(k) !== v) return false; return true; };

/* 1. the same battle twice */
const base = fight(seed, T0, 'frischermont'), again = fight(seed, T0, 'frischermont');
ok(base.E.rnd.mode === 'keyed', `the engine's own dice are the keyed ones (${base.E.rnd.mode})`);
ok(same(base.trace, again.trace), 'same seed, same orders: every draw the same');
ok(base.hash === again.hash, `same seed, same orders: the same battle (${base.hash}, ${again.hash})`);
ok(base.trace.size === base.dice, `every draw has its own identity (${base.trace.size} identities, ${base.dice} dice drawn)`);

/* 2. one order changed */
const tick0 = (T0 - R.START) / 2, kept90 = {}; let acted = 0;
for (const [name, other] of [['its objective changed', fight(seed, T0, 'smohain')], ['sent twenty minutes later', fight(seed, T0 + 20, 'frischermont')]]) {
  let later = 0, both = 0, rerolled = 0, before = 0, beforeOff = 0, kept = 0;
  for (const [k, v] of base.trace) {
    const w = other.trace.get(k), late = +k.split('|')[3] >= tick0;
    if (!late) { before++; if (w !== v) beforeOff++; continue; }
    later++; if (w === undefined) continue; both++; if (w !== v) rerolled++;
  }
  for (const e of base.events) if (other.events.has(e)) kept++;
  const [same, n] = stood(base, other, 'after40', 'all'), [same90, n90] = stood(base, other, 'after90', 'others'), [corps90, nc90] = stood(base, other, 'after90', 'all');
  kept90[name] = same90 / n90;
  ok(other.hash !== base.hash, `one order with ${name}: the battle is a different one`);
  ok(beforeOff === 0, `one order with ${name}: nothing before 16:30 differs (${beforeOff} of ${before} draws)`);
  ok(rerolled === 0, `one order with ${name}: no draw asked for in both battles is re-rolled (${rerolled} of ${both})`);
  ok(both > 0.5 * later, `one order with ${name}: most later draws are asked for in both battles (${both} of ${later})`);
  ok(same >= 0.98 * n && n > 100, `one order with ${name}: at 17:10, before the corps acts on it, the field is all but untouched (${same} of ${n} bodies the same)`);
  if (corps90 - same90 === nc90 - n90) console.log(`  (one order with ${name}: on this seed the corps stands at 18:00 as it did unchanged, so the 18:00 check is idle)`);
  else acted++;
  ok(same90 >= 0.8 * n90, `one order with ${name}: at 18:00 four fifths of the bodies outside Lobau's corps stand as in the unchanged battle (${same90} of ${n90})`);
  ok(kept >= base.events.size * 2 / 3, `one order with ${name}: two thirds of the later events still happen (${kept} of ${base.events.size})`);
  console.log(`  one order with ${name}: ${later} draws from 16:30, ${both} in both battles, ${rerolled} re-rolled; at 17:10 ${same} of ${n} bodies unchanged; at 18:00 ${same90} of ${n90} outside the corps; ${kept} of ${base.events.size} later events kept`);
}
ok(seed !== 1003 || acted === 2, `on the seed check.sh runs, both changes have moved the corps by 18:00, so the 18:00 checks are not idle (${acted} of 2)`);
{ // the single sequence, fought the same way, must do worse: the delayed order shifts every later draw
  const b1 = fight(seed, T0, 'frischermont', { dice: 'single' }), l1 = fight(seed, T0 + 20, 'frischermont', { dice: 'single' });
  const [same, n] = stood(b1, l1, 'after40', 'all'), [same90, n90] = stood(b1, l1, 'after90', 'others');
  // (the margins in this file not marked otherwise are (est.): wide enough to hold on any seed tried, tight enough to catch a broken generator)
  ok(same < 0.9 * n, `the old single sequence fails the 17:10 check with the order sent later (${same} of ${n} bodies unchanged)`);
  ok(same90 / n90 < kept90['sent twenty minutes later'], `the old single sequence keeps fewer bodies unchanged at 18:00 (${same90} of ${n90})`);
  console.log(`  the old single sequence, order sent twenty minutes later: ${same} of ${n} bodies unchanged at 17:10, ${same90} of ${n90} outside the corps at 18:00`); }
const otherSeed = fight(seed + 1, T0, 'frischermont');
{ let both = 0, eq = 0; for (const [k, v] of base.trace) { const w = otherSeed.trace.get(k); if (w !== undefined) { both++; if (w === v) eq++; } }
  ok(both > 1000 && eq < both / 1000, `another seed is other luck (${eq} of ${both} shared draws equal)`); }

/* 3. whose draw, and how often */
const FIELD = new Set(['gust', 'moving headquarters', 'Napoleon hit']); // the whole field's, or the one headquarters'
const MOST = { wind: 2, 'shock test': 2, 'casualty noise': 2, 'cavalry melee': 2, 'cavalry morale test': 2, 'gun count': 2, 'prisoner exaggerates': 2, 'aide estimate': 2, // one normal deviate: two draws
  'strength estimate': 3, 'position error': 4, melee: 3, // a range and a normal; x and y; an assault's loss and the locked fight's in one tick
  'gate broken': 2, 'counter-charge': 2, // two rules can each ask for the same owner's draw in one tick (ai.js, doctrine.js); known and left
  'extra rider': 2, 'rider under fire': 2, 'rider captured': 2, // the same order written twice in one minute is one identity (Ligny: Napoleon to Gérard, twice at 19:50)
  'order writing': 4, interpretation: 4, 'misread order': 4 }; // a general's draw is his own: three orders to him in one tick (d'Erlon at 13:30) take three in turn
const P = require(path.join(SIM, 'packs', 'all.js')), En = require(path.join(SIM, 'engine.js')), Doc = require(path.join(SIM, 'doctrine.js'));
(function noise(o) { if (!o || typeof o !== 'object') return; if (o.noise && o.noise.roll) MOST[o.noise.roll] = 2; for (const v of Object.values(o)) noise(v); })(Object.keys(P.battles).map(id => P.battle(id).battle)); // the packs' own normal deviates (a march's noise)
const generic = id => { const trace = new Map(), E = En.create({ battle: id, seed, diceTrace: trace }); Doc.make({}).init(E); E.run(); return trace; };
const ligny = () => { const trace = new Map(), E = R.setup({ battle: 'ligny', seed, history: 'uncertain', staff: 'berthier', silence: 0, diceTrace: trace }); Scr.historical(E); E.run(); return trace; };
for (const [name, trace] of [['Waterloo, Soult', base.trace], ['Waterloo, Berthier, two aides sent', fight(seed + 2, null, null, { staff: 'berthier', aidesAt: 800 }).trace], ['Ligny', ligny()],
  ...Object.keys(P.battles).map(id => [`${id}, generic commanders`, generic(id)])]) {
  const noOwner = new Set(), tooOften = {};
  for (const k of trace.keys()) {
    const [why, a, , , n] = k.split('|');
    if (a === '' && !FIELD.has(why)) noOwner.add(why);
    if (+n + 1 > (MOST[why] || 1)) tooOften[why] = Math.max(tooOften[why] || 0, +n + 1);
  }
  ok(noOwner.size === 0, `${name}: every draw says whose it is (without an owner: ${[...noOwner].join(', ') || 'none'})`);
  ok(Object.keys(tooOften).length === 0, `${name}: no owner's draw is asked for more often in a tick than its rule needs (${JSON.stringify(tooOften)})`);
}

/* 4. the values as dice */
{ const vals = [...base.trace.values()], n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n, bins = new Array(20).fill(0);
  for (const v of vals) bins[Math.min(19, Math.floor(v * 20))]++;
  const chi = bins.reduce((a, c) => a + (c - n / 20) ** 2 / (n / 20), 0);
  ok(vals.every(v => v >= 0 && v < 1), 'every draw is in [0, 1)');
  ok(Math.abs(mean - 0.5) < 0.005, `the mean is a half (${mean.toFixed(4)} over ${n})`);
  ok(chi < 43.8, `evenly spread over 20 bins (chi-square ${chi.toFixed(1)}; 43.8 is the 0.1% point for 19 degrees of freedom)`);
  // one owner's draw in one tick against his draw in the next, and against his draw for another purpose in the same tick
  const corr = pairs => { const m = pairs.length, mx = pairs.reduce((a, p) => a + p[0], 0) / m, my = pairs.reduce((a, p) => a + p[1], 0) / m; let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
  const next = [], cross = [], byOwner = new Map();
  for (const [k, v] of base.trace) {
    const [why, a, b, t, i] = k.split('|'); if (i !== '0') continue;
    const w = base.trace.get([why, a, b, +t + 1, 0].join('|')); if (w !== undefined) next.push([v, w]);
    const o = a + '|' + b + '|' + t, seen = byOwner.get(o); if (seen && seen[0] !== why) cross.push([seen[1], v]); else if (!seen) byOwner.set(o, [why, v]);
  }
  const lim = m => 4 / Math.sqrt(m); // four standard errors
  ok(next.length > 5000 && Math.abs(corr(next)) < lim(next.length), `an owner's draws in successive ticks are unrelated (r = ${corr(next).toFixed(4)} over ${next.length} pairs)`);
  ok(cross.length > 1000 && Math.abs(corr(cross)) < lim(cross.length), `an owner's draws for two purposes in one tick are unrelated (r = ${corr(cross).toFixed(4)} over ${cross.length} pairs)`); }

console.log(`dice (seed ${seed}): ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
