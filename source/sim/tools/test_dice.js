/* The dice's own tests (engine.js, makeRng; docs/METHOD.md section 4).
     node tools/test_dice.js [seed=1003]
   1. Same seed and same orders: the same draws and the same battle (rule 6).
   2. One order changed, or sent later: the battle differs, and yet every draw that both battles asked for has the same value.
      "A draw the order does not touch" is one whose identity (purpose, whose draw, tick, count within the tick) occurs in both.
   3. Every draw says whose it is (bar the few that belong to the whole field), and no purpose asks for the same owner's draw more
      often in a tick than its own rule needs: a higher count means two different things share one identity and each other's luck.
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
function fight(s, at, place) {
  const trace = new Map(), E = R.setup({ seed: s, history: 'uncertain', scenario: '1100', staff: 'soult', silence: 0, diceTrace: trace });
  Scr.historical(E);
  let sent = at == null, guard = 0;
  while (!E.over && guard++ < 2000) { if (!sent && E.t >= at) { sent = true; const r = E.command.order(ORDER(place)); if (!r.ok) throw new Error('order refused: ' + r.error); } E.step(); }
  return { E, trace, hash: stateHash(E), dice: Object.values(E.rnd.counts).reduce((a, b) => a + b, 0) };
}
const same = (a, b) => { if (a.size !== b.size) return false; for (const [k, v] of a) if (b.get(k) !== v) return false; return true; };

/* 1. the same battle twice */
const base = fight(seed, T0, 'frischermont'), again = fight(seed, T0, 'frischermont');
ok(base.E.rnd.mode === 'keyed', `the engine's own dice are the keyed ones (${base.E.rnd.mode})`);
ok(same(base.trace, again.trace), 'same seed, same orders: every draw the same');
ok(base.hash === again.hash, `same seed, same orders: the same battle (${base.hash}, ${again.hash})`);
ok(base.trace.size === base.dice, `every draw has its own identity (${base.trace.size} identities, ${base.dice} dice drawn)`);

/* 2. one order changed */
const tick0 = (T0 - R.START) / 2;
for (const [name, other] of [['its objective changed', fight(seed, T0, 'smohain')], ['sent twenty minutes later', fight(seed, T0 + 20, 'frischermont')]]) {
  let later = 0, both = 0, rerolled = 0, before = 0, beforeOff = 0;
  for (const [k, v] of base.trace) {
    const w = other.trace.get(k), late = +k.split('|')[3] >= tick0;
    if (!late) { before++; if (w !== v) beforeOff++; continue; }
    later++; if (w === undefined) continue; both++; if (w !== v) rerolled++;
  }
  ok(other.hash !== base.hash, `one order with ${name}: the battle is a different one`);
  ok(beforeOff === 0, `one order with ${name}: nothing before 16:30 differs (${beforeOff} of ${before} draws)`);
  ok(rerolled === 0, `one order with ${name}: no draw asked for in both battles is re-rolled (${rerolled} of ${both})`);
  ok(both > 0.5 * later, `one order with ${name}: most later draws are asked for in both battles (${both} of ${later})`);
  console.log(`  one order with ${name}: ${later} draws from 16:30, ${both} in both battles, ${rerolled} re-rolled`);
}
const otherSeed = fight(seed + 1, T0, 'frischermont');
{ let both = 0, eq = 0; for (const [k, v] of base.trace) { const w = otherSeed.trace.get(k); if (w !== undefined) { both++; if (w === v) eq++; } }
  ok(both > 1000 && eq < both / 1000, `another seed is other luck (${eq} of ${both} shared draws equal)`); }

/* 3. whose draw, and how often */
const FIELD = new Set(['gust', 'moving headquarters', 'Napoleon hit']); // the whole field's, or the one headquarters'
const MOST = { 'strength estimate': 3, 'position error': 4, melee: 3, // a range and a normal; x and y; an assault's loss and the locked fight's in one tick
  'order writing': 4, interpretation: 4, 'misread order': 4 }; // a general's draw is his own: three orders to him in one tick (d'Erlon at 13:30) take three in turn
const noOwner = new Set(), tooOften = {};
for (const k of base.trace.keys()) {
  const [why, a, , , n] = k.split('|');
  if (a === '' && !FIELD.has(why)) noOwner.add(why);
  if (+n + 1 > (MOST[why] || 2)) tooOften[why] = Math.max(tooOften[why] || 0, +n + 1);
}
ok(noOwner.size === 0, `every draw says whose it is (without an owner: ${[...noOwner].join(', ') || 'none'})`);
ok(Object.keys(tooOften).length === 0, `no owner's draw is asked for more often in a tick than its rule needs (${JSON.stringify(tooOften)})`);

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
