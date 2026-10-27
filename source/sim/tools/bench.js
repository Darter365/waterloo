/* The test bench (engine roadmap 2h). Small staged engagements written as data, each with an expected range: a battalion firing on a
   column, horse charging a square, guns on a column, archers on armoured men. Each runs many times in seconds and works as a unit test for
   an era's numbers: when a number changes, the bench shows which behaviours moved before any full battle is fought.
     node tools/bench.js [era|case id ...] [--n 200]     runs the cases (all, or one era's, or the ones named)
   A case (bench/<era>.js) gives: id, era, what (one line), units (in metres on a flat field 3 km x 2 km unless size says), orders (a
   function that gives the engine's tasks), minutes, measure (a function of the engine), unit (what the measure counts), basis (history or pin), known (a gap the engine has, stated), expect [lo, hi]
   for the median (or the mean, with aggregate: 'mean'), and source (where the range comes from; "est." with the reasoning where no source gives it). */
'use strict';
const path = require('path'), fs = require('fs');
const SIM = path.join(__dirname, '..');
const P = require(path.join(SIM, 'packs', 'all.js')), En = require(path.join(SIM, 'engine.js'));

// a flat field for a case: the map, two sides that fall back to opposite edges, and the case's units
function benchBattle(c) {
  const id = 'bench:' + c.id, [Wd, Ht] = c.size || [3000, 2000], CELL = 50, NX = Math.round(Wd / CELL) + 1, NY = Math.round(Ht / CELL) + 1;
  const LAT0 = c.lat ?? 50.7, LON0 = c.lon ?? 4.4, MLAT = 111230, MLON = 111320 * Math.cos(LAT0 * Math.PI / 180), WM = (NX - 1) * CELL, HM = (NY - 1) * CELL;
  const ll2m = (lat, lon) => [(lon - LON0) * MLON, (LAT0 - lat) * MLAT], m2ll = (x, y) => [LAT0 - y / MLAT, LON0 + x / MLON];
  const H = new Array(NX * NY).fill(100);
  if (c.slope) for (let r = 0; r < NY; r++) for (let q = 0; q < NX; q++) H[r * NX + q] = 100 + c.slope * (HM - r * CELL); // rising to the north (y = 0)
  const sides = c.sides || [{ id: 'X', name: 'Blue', morale0: 70, rear: 'N', retreat: 'rX' }, { id: 'Y', name: 'Red', morale0: 70, rear: 'S', retreat: 'rY' }];
  const RAW = c.units.map(u => { const [la, lo] = m2ll(u.at[0], u.at[1]); return [u.id, u.side, u.name || u.id, c.id, u.nat, u.arm, u.str, la, lo, u.facing ?? 0, u.form || 'columns', 0, '', u.extra]; });
  const TRAITS = Object.fromEntries(c.units.filter(u => u.traits).map(u => [u.id, u.traits]));
  const QUALITY = Object.fromEntries(c.units.filter(u => u.q != null).map(u => [u.id, u.q]));
  const CALIBRE = Object.fromEntries(c.units.filter(u => u.cal != null).map(u => [u.id, u.cal]));
  P.register('battle', id, {
    name: c.what, date: c.date || '1815-06-18', era: c.era, nations: [...new Set(c.units.map(u => u.nat))], sides,
    starts: { bench: { t: c.t0 ?? 720, wet0: c.wet ?? 0.3 } }, weather: { vis: [[0, 8000]] }, leaders: [],
    map: { LAT0, LON0, MLAT, MLON, NX, NY, CELL, WM, HM, ll2m, m2ll, H, RAW, TRAITS, QUALITY, CALIBRE, OBSTACLES: (c.obstacles || []).map(o => ({ kind: o.kind, pts: o.at.map(p => m2ll(p[0], p[1])) })), // given in metres
      ROUTES: { rX: [m2ll(WM / 2, HM / 2), m2ll(WM / 2, 0)], rY: [m2ll(WM / 2, HM / 2), m2ll(WM / 2, HM)] } },
  });
  return id;
}
const pct = (a, q) => { const v = [...a].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(q * v.length))]; };
function runCase(c, n) {
  const id = benchBattle(c), out = [];
  for (let seed = 1; seed <= n; seed++) {
    const E = En.create({ battle: id, seed, scenario: 'bench', history: 'uncertain' });
    if (c.orders) c.orders(E);
    for (let m = 0; m < c.minutes && !E.over; m += 2) E.step();
    out.push(c.measure(E));
  }
  const med = c.aggregate === 'mean' ? out.reduce((a, v) => a + v, 0) / out.length : pct(out, 0.5), ok = med >= c.expect[0] && med <= c.expect[1];
  return { c, p10: pct(out, 0.1), med, p90: pct(out, 0.9), ok };
}
module.exports = { benchBattle, runCase };
if (require.main === module) {
  const args = process.argv.slice(2), ni = args.indexOf('--n'), n = ni >= 0 ? +args[ni + 1] : 200, pick = args.filter((a, i) => !a.startsWith('--') && (ni < 0 || i !== ni + 1));
  const cases = fs.readdirSync(path.join(SIM, 'bench')).filter(f => f.endsWith('.js')).flatMap(f => require(path.join(SIM, 'bench', f))).filter(c => c && c.id);
  const run = cases.filter(c => !pick.length || pick.includes(c.era) || pick.includes(c.id));
  let bad = 0; const fmt = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString();
  for (const c of run) {
    const t0 = Date.now(), r = runCase(c, n); if (!r.ok && !c.known) bad++;
    console.log(`${r.ok ? 'ok  ' : c.known ? 'KNOWN' : 'OFF '} ${c.id.padEnd(30)} ${fmt(r.p10).padStart(6)} ${fmt(r.med).padStart(6)} ${fmt(r.p90).padStart(6)}  expect ${c.expect[0]}-${c.expect[1]} ${c.unit}  (${n} runs, ${Date.now() - t0} ms)`);
    console.log(`     ${c.what}`);
    console.log(`     ${c.basis === 'pin' ? 'pinned to today' : 'from the record'}: ${c.source}`);
    if (c.known && !r.ok) console.log(`     known gap: ${c.known}`);
  }
  const known = run.filter(c => c.known).length;
  console.log(`${run.length - bad - known} of ${run.length} cases in their expected range${known ? `; ${known} known gap${known > 1 ? 's' : ''} (listed, not failed)` : ''}`);
  if (bad) process.exit(1);
}
