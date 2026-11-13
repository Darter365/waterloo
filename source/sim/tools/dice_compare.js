/* How much unrelated luck does one changed order re-roll? (the dice-streams task, docs/METHOD.md section 4)
   Fights each battle three times with Napoleon's historical orders and one extra order at 16:30:
     base       Lobau is told to advance on Frischermont
     objective  the same order, with Smohain as its objective (one order changed)
     later      the base order, sent 20 minutes later (one order delayed)
   and compares each changed battle with the base, draw by draw, from 16:30 on. A draw's identity is its purpose, whose draw it is,
   the tick, and how many times it was asked for in that tick; a draw "occurs in both" when both battles asked for that identity.
     node tools/dice_compare.js [--n 30] [--seed 1000] [--dice single,purpose,keyed] [--out file.json]
   The engine's dice are chosen by create({ dice }): 'keyed' is the engine's own; 'single' (one sequence, the engine up to 0.4) and
   'purpose' (a sequence for each purpose) are kept in makeRng for this comparison alone. Under 'keyed' the re-rolled share is nought
   by construction, so the column that compares the three fairly is the share of the base battle's later log events that still happen,
   word for word and at the same minute, in the changed battle. results/dice_compare_2026-11-12.json is the run the design was chosen on. */
'use strict';
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
const SIM = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const T0 = 990; // 16:30
const ORDER = pl => ({ to: 'lobau', action: 'advance', objective: { place: pl }, conditions: [], manner: {} });
const CASES = { base: [T0, 'frischermont'], objective: [T0, 'smohain'], later: [T0 + 20, 'frischermont'] };

function fight(seed, dice, which) {
  const R = require(path.join(SIM, 'replay.js')), Scr = require(path.join(SIM, 'script.js'));
  const trace = new Map(), [at, place] = CASES[which];
  const E = R.setup({ seed, history: 'uncertain', scenario: '1100', staff: seed % 2 ? 'soult' : 'berthier', silence: 0, dice, diceTrace: trace });
  Scr.historical(E);
  let sent = false, guard = 0;
  while (!E.over && guard++ < 2000) { if (!sent && E.t >= at) { sent = true; const r = E.command.order(ORDER(place)); if (!r.ok) throw new Error('order refused: ' + r.error); } E.step(); }
  const tick0 = (T0 - 660) / 2, draws = new Map();
  for (const [k, v] of trace) { const p = k.split('|'); if (+p[3] >= tick0) draws.set(k, v); }
  const events = new Set(E.log.filter(e => e.t >= T0).map(e => e.t + '|' + e.cat + '|' + e.text));
  return { draws, events, grade: E.result && E.result.grade, kw: E.sideIds.map(s => E.result.cas[s].kw) };
}
function compare(base, other) {
  let both = 0, differ = 0; const by = {};
  for (const [k, v] of base.draws) {
    const w = other.draws.get(k); if (w === undefined) continue;
    const why = k.slice(0, k.indexOf('|')), b = by[why] || (by[why] = [0, 0]); both++; b[0]++;
    if (w !== v) { differ++; b[1]++; }
  }
  let ev = 0; for (const e of base.events) if (other.events.has(e)) ev++;
  return { drawsBase: base.draws.size, both, differ, by, eventsBase: base.events.size, eventsSame: ev, gradeSame: base.grade === other.grade, kwGap: base.kw.reduce((a, x, i) => a + Math.abs(x - other.kw[i]), 0) };
}

if (process.send) {
  process.on('message', ({ seeds, modes }) => {
    const out = [];
    for (const seed of seeds) for (const dice of modes) { const base = fight(seed, dice, 'base'); for (const c of ['objective', 'later']) out.push(Object.assign({ seed, dice, change: c }, compare(base, fight(seed, dice, c)))); }
    process.send(out, () => process.exit(0));
  });
} else {
  const n = +arg('--n', 30), seed0 = +arg('--seed', 1000), modes = arg('--dice', 'single,purpose,keyed').split(','), procs = 2;
  const seeds = Array.from({ length: n }, (_, i) => seed0 + i); let got = [], done = 0;
  const pct = (a, q) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(q * v.length))]; };
  for (let p = 0; p < procs; p++) {
    const w = fork(__filename); w.send({ seeds: seeds.filter((_, i) => i % procs === p), modes });
    w.on('message', m => {
      got = got.concat(m); if (++done < procs) return;
      if (arg('--out')) fs.writeFileSync(arg('--out'), JSON.stringify(got));
      console.log(`${n} battles, seeds ${seed0} to ${seed0 + n - 1}; one order changed at 16:30; draws and events from 16:30 on`);
      console.log('dice     change     later draws  in both   of those, re-rolled (min, median, max)   log events kept (median)   same grade   k&w gap (median)');
      for (const dice of modes) for (const c of ['objective', 'later']) {
        const r = got.filter(x => x.dice === dice && x.change === c), share = r.map(x => 100 * x.differ / Math.max(1, x.both)), ev = r.map(x => 100 * x.eventsSame / Math.max(1, x.eventsBase));
        console.log(`${dice.padEnd(8)} ${c.padEnd(10)} ${String(pct(r.map(x => x.drawsBase), .5)).padStart(8)}  ${String(pct(r.map(x => x.both), .5)).padStart(8)}   ${pct(share, 0).toFixed(1).padStart(6)}% ${pct(share, .5).toFixed(1).padStart(6)}% ${pct(share, .99).toFixed(1).padStart(6)}%             ${pct(ev, .5).toFixed(1).padStart(6)}%                 ${String(r.filter(x => x.gradeSame).length).padStart(2)}/${r.length}        ${Math.round(pct(r.map(x => x.kwGap), .5))}`);
      }
      for (const dice of modes) {
        const by = {}; for (const x of got.filter(x => x.dice === dice)) for (const [k, [a, b]] of Object.entries(x.by)) { const t = by[k] || (by[k] = [0, 0]); t[0] += a; t[1] += b; }
        console.log(`\n${dice}: by purpose (draws in both, re-rolled), busiest first`);
        for (const [k, [a, b]] of Object.entries(by).sort((x, y) => y[1][0] - x[1][0]).slice(0, 14)) console.log(`  ${k.padEnd(24)} ${String(a).padStart(8)}  ${(100 * b / a).toFixed(1).padStart(5)}%`);
        const kept = Object.entries(by).filter(([, [a, b]]) => b === 0).map(([k]) => k);
        console.log(`  purposes with no draw re-rolled: ${kept.length} of ${Object.keys(by).length}`);
      }
    });
  }
}
