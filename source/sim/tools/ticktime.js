/* How fast the simulation runs: milliseconds per 2-minute tick and battles per minute, for Waterloo and Ligny over fixed seeds
   (docs/METHOD.md, section 7). The roadmap gives about 13 ms a tick (27 October) and a budget of under 20 ms on the phone; until this
   tool nothing measured either.
     node tools/ticktime.js              the full run (seeds 1 to 6 of each battle), beside the stored baseline
     node tools/ticktime.js --short      the short run check.sh makes (seeds 1 and 2 of each battle)
     node tools/ticktime.js --verify     also fights every battle a second time with no clock and compares the two, checkpoint by checkpoint
     node tools/ticktime.js --record     three fresh processes of the short run and three of the full one; writes results/ticktime_baseline.json
     node tools/ticktime.js --json       one run as JSON (what --record reads)
   TICKTIME_MACHINE names the machine in the output and the baseline (default: the processor's own name).

   What the number can tell us: whether a change made the simulation slower or faster than the baseline, on the same machine and Node.
   What it cannot: the time a tick takes on a phone. A cloud machine is not a phone, its neighbours' load moves the figure from one run
   to the next, and a browser's engine is not Node's. The 20 ms budget is printed for scale only; the phone has to be measured on a phone.

   The measurement only reads the clock around E.step(). It draws no dice and writes no engine state (rule 1): every Waterloo battle is
   fought exactly as refset.js fights its 'hist' references, on the same seeds, and its checkpoints are compared with ref/p2_hist.json
   on every run. Ligny has no references, so --verify compares it with an unclocked twin. A difference prints DIVERGED and exits 1.

   Every tick counts, the first ones included: each process starts cold, as a player's page does, so the early ticks of the first
   battle carry the engine's compilation. That is why the short run reads a little slower than the full one and each has its own baseline. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execFileSync } = require('child_process');
const SIM = path.join(__dirname, '..');
const R = require(path.join(SIM, 'replay.js')), Scr = require(path.join(SIM, 'script.js'));
const BASE = path.join(SIM, 'results', 'ticktime_baseline.json'), REF = path.join(SIM, 'ref', 'p2_hist.json');

const SEEDS = { short: [1, 2], full: [1, 2, 3, 4, 5, 6] }; // the first reference seeds, so Waterloo can be held to ref/p2_hist.json
const WARN = 1.5;      // (est.) warn when a figure is more than half as slow again as the baseline. Three fresh processes on the cloud
                       // machine the baseline was recorded on differed by far less (the spread is stored in the baseline and printed),
                       // but a shared machine has worse minutes than those three; a real slowdown worth acting on is larger than either
const BUDGET_MS = 20;  // the roadmap's budget for a tick on the phone (docs/ROADMAP.md). Not checked here: this is not a phone
const ROADMAP_MS = 13; // the roadmap's own figure of 27 October; the machine it was taken on is not recorded

// the reference battles' hash, as refset.js and tools/test_view.js compute it: every unit, army morale, every place, the dice drawn
function stateHash(E) {
  const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
  const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
  const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0);
  return crypto.createHash('sha1').update(JSON.stringify([E.t, E.morale, units, places, dice])).digest('hex').slice(0, 16);
}
// Waterloo exactly as refset.js sets up a 'hist' reference; Ligny as tools/test_view.js sets it up (the game's own set-up, historical orders)
const BATTLES = {
  waterloo: seed => { const E = R.setup({ seed, history: 'uncertain', scenario: '1100', staff: seed % 2 ? 'soult' : 'berthier', silence: 0 }); Scr.historical(E); return E; },
  ligny: seed => { const E = R.setup({ battle: 'ligny', seed, history: 'uncertain' }); Scr.historical(E, {}); return E; },
};
const now = () => Number(process.hrtime.bigint()) / 1e6; // milliseconds; the tool's clock, never the simulation's

// one battle: with the clock, each tick's time; without it, the same loop and the same checkpoints and nothing else
function fight(battle, seed, clocked) {
  const t0 = now(), E = BATTLES[battle](seed), ticks = [], cps = []; let guard = 0;
  while (!E.over && guard++ < 2000) {
    if (clocked) { const a = now(); E.step(); ticks.push(now() - a); } else E.step();
    if (E.t % 30 === 0) cps.push([E.t, stateHash(E)]);
  }
  cps.push([E.t, stateHash(E)]);
  return { ticks, cps, wall: now() - t0, units: E.units.length };
}
const centile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const same = (a, b) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

function machine() {
  const c = os.cpus();
  return { name: process.env.TICKTIME_MACHINE || (c[0] ? c[0].model.trim() : 'unknown processor'), cpu: c[0] ? c[0].model.trim() : 'unknown', cores: c.length, arch: os.arch(), platform: os.platform() };
}
function measure(mode, verify) {
  const ref = {}; for (const e of JSON.parse(fs.readFileSync(REF, 'utf8')).entries) ref[e.seed] = e.cps;
  const out = { mode, seeds: SEEDS[mode], node: process.version, machine: machine(), battles: {}, diverged: [], checked: { reference: 0, twin: 0 } };
  let wall = 0, n = 0;
  for (const battle of Object.keys(BATTLES)) {
    const all = [], walls = []; let units = 0;
    for (const seed of SEEDS[mode]) {
      const f = fight(battle, seed, true); all.push(...f.ticks); walls.push(f.wall); units = Math.max(units, f.units);
      if (battle === 'waterloo') { out.checked.reference++; if (!ref[seed] || !same(f.cps, ref[seed])) out.diverged.push(`${battle} seed ${seed}: differs from ref/p2_hist.json`); }
      if (verify) { out.checked.twin++; if (!same(f.cps, fight(battle, seed, false).cps)) out.diverged.push(`${battle} seed ${seed}: the clocked battle differs from its unclocked twin`); }
    }
    all.sort((a, b) => a - b);
    const w = walls.reduce((a, b) => a + b, 0); wall += w; n += walls.length;
    out.battles[battle] = { battles: walls.length, ticks: all.length, units, median: centile(all, 0.5), p95: centile(all, 0.95), max: all[all.length - 1], perMinute: 60000 * walls.length / w };
  }
  out.perMinute = 60000 * n / wall; // battles a minute, set-up included, one battle at a time on one core
  return out;
}

const ms = v => v.toFixed(v < 10 ? 2 : 1), pc = (a, b) => { const d = 100 * (a / b - 1); return (d >= 0 ? '+' : '') + d.toFixed(0) + '%'; };
function report(m, base) {
  const L = [], b = base && base[m.mode], mc = m.machine;
  L.push(`tick time, ${m.mode} run: seeds ${m.seeds[0]} to ${m.seeds[m.seeds.length - 1]} of each battle, Node ${m.node}, ${mc.name} (${mc.cores} cores, ${mc.platform} ${mc.arch})`);
  const slow = [];
  for (const [id, r] of Object.entries(m.battles)) {
    const br = b && b.battles[id];
    L.push(`  ${id.padEnd(9)} ${String(r.ticks).padStart(5)} ticks  median ${ms(r.median).padStart(5)} ms  95th ${ms(r.p95).padStart(5)} ms  worst ${ms(r.max).padStart(5)} ms  ${r.perMinute.toFixed(0).padStart(3)} battles a minute` +
      (br ? `   | baseline ${ms(br.median)} / ${ms(br.p95)} ms (${pc(r.median, br.median)}, ${pc(r.p95, br.p95)})` : ''));
    if (br) for (const [k, name] of [['median', 'median'], ['p95', '95th centile']]) if (r[k] > WARN * br[k]) slow.push(`${id} ${name} ${ms(r[k])} ms against ${ms(br[k])} ms`);
  }
  L.push(`  both      ${m.perMinute.toFixed(0)} battles a minute` + (b ? `   | baseline ${b.perMinute.toFixed(0)}; three runs of the baseline spread ${b.spreadPct.toFixed(0)}% in the median, ${b.spreadP95Pct.toFixed(0)}% in the 95th centile` : ''));
  if (!base) L.push('  no baseline: node tools/ticktime.js --record writes results/ticktime_baseline.json');
  else {
    const bm = base.machine, like = bm.cpu === mc.cpu && bm.cores === mc.cores && base.node.split('.')[0] === m.node.split('.')[0];
    if (!like) L.push(`  the baseline was recorded on ${bm.name} (${bm.cores} cores), Node ${base.node}: another machine or Node, so the comparison shows little`);
    if (slow.length) L.push(`  WARNING slower than ${WARN} times (est.) the baseline${like ? '' : ' (on another machine)'}: ${slow.join('; ')}. Run it again before believing it; this does not fail the check`);
    else L.push(`  within ${WARN} times (est.) the baseline of ${base.recorded.slice(0, 10)}`);
  }
  L.push(`  not a phone: the roadmap's ${ROADMAP_MS} ms a tick and its budget of under ${BUDGET_MS} ms are for the phone, which this run does not measure`);
  if (m.diverged.length) for (const d of m.diverged) L.push('  DIVERGED ' + d);
  else L.push(`  no dice drawn by the measurement: ${m.checked.reference} Waterloo battles identical to ref/p2_hist.json` + (m.checked.twin ? `, ${m.checked.twin} battles identical to their unclocked twins` : ''));
  return L.join('\n');
}

// the baseline: three fresh processes of each run, the middle value of each figure, and how far the three were apart
function record() {
  const mid = v => v.slice().sort((a, b) => a - b)[1], spread = v => 100 * (Math.max(...v) - Math.min(...v)) / mid(v);
  const out = { recorded: new Date().toISOString(), node: process.version, machine: machine(), runs: 3,
    note: 'Each figure is the middle one of three fresh processes; spreadPct and spreadP95Pct are the widest (highest minus lowest, over the middle) of any battle. Milliseconds per 2-minute tick. A cloud machine, not a phone.' };
  for (const mode of ['short', 'full']) {
    const runs = []; for (let i = 0; i < 3; i++) runs.push(JSON.parse(execFileSync(process.execPath, [__filename, '--json', ...(mode === 'short' ? ['--short'] : [])], { encoding: 'utf8' })));
    const bad = runs.flatMap(r => r.diverged); if (bad.length) { console.log(bad.map(d => 'DIVERGED ' + d).join('\n')); process.exit(1); }
    const battles = {}; let sm = 0, sp = 0;
    for (const id of Object.keys(BATTLES)) {
      const of = k => runs.map(r => r.battles[id][k]);
      battles[id] = { ticks: runs[0].battles[id].ticks, median: mid(of('median')), p95: mid(of('p95')), max: mid(of('max')), perMinute: mid(of('perMinute')), medians: of('median'), p95s: of('p95') };
      sm = Math.max(sm, spread(of('median'))); sp = Math.max(sp, spread(of('p95')));
    }
    out[mode] = { seeds: SEEDS[mode], battles, perMinute: mid(runs.map(r => r.perMinute)), perMinutes: runs.map(r => r.perMinute), spreadPct: sm, spreadP95Pct: sp };
  }
  fs.writeFileSync(BASE, JSON.stringify(out, null, 1) + '\n');
  return out;
}

module.exports = { measure, report, stateHash };
if (require.main === module) {
  const args = process.argv.slice(2), mode = args.includes('--short') ? 'short' : 'full';
  if (args.includes('--record')) {
    const b = record();
    for (const mode of ['short', 'full']) { const r = b[mode]; console.log(`${mode.padEnd(5)} ` + Object.entries(r.battles).map(([id, x]) => `${id} median ${ms(x.median)} ms, 95th ${ms(x.p95)} ms`).join('; ') + `; ${r.perMinute.toFixed(0)} battles a minute; three runs spread ${r.spreadPct.toFixed(0)}% (median), ${r.spreadP95Pct.toFixed(0)}% (95th)`); }
    console.log('wrote results/ticktime_baseline.json');
    return;
  }
  const m = measure(mode, args.includes('--verify'));
  if (args.includes('--json')) console.log(JSON.stringify(m));
  else console.log(report(m, fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null));
  if (m.diverged.length && args.includes('--verify')) process.exit(1);
}
