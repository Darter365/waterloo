/* The multi-battle tuner (engine roadmap 4b): try the era's constants against every battle that has targets at once, so a change that
   puts one battle in its band does not quietly push another out of its own.
     node tools/tune.js [--n 60] [--battles waterloo,toy-ridge] [--set NAME=v ...] [--sweep NAME=v1,v2,...] [--seed 1000] [--procs 2] [--generic AL,PR] [--no-timetables]
   --set changes an era constant (E.K) for every run; --sweep tries each value in turn (several sweeps: every combination). Each battle is
   fought the way its targets say (runner: 'historical' = its recorded plan through the command layer; else the generic commanders on
   every side), n times from the same seeds for every setting, so settings are compared on the same dice.
   Targets live in the battle packs (targets: { runner, checks }); a check is one of
     { what, share: 'grade regex', not: 'grade regex', min, max, below }   per cent of battles whose result matches
     { what, losses: side, median: [lo, hi] }                              median killed and wounded of an army
     { what, metric: id, min, max }                                        per cent of battles in which the metric happened
     { what, metric: id, median: ['HH:MM', 'HH:MM'] }                      its median time, where it happened
   The output is a table: for each setting, each battle's checks in or out of its band, and how many battles were wholly in band. */
'use strict';
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
const SIM = path.join(__dirname, '..'), P = require(path.join(SIM, 'packs', 'all.js'));

const pct = (a, q) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
const hm = t => t == null ? '–' : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const tmin = s => typeof s === 'string' ? +s.split(':')[0] * 60 + +s.split(':')[1] : s;
const kfmt = n => n == null ? '–' : (n / 1000).toFixed(1) + 'k';

function fightAll(battle, runner, K, n, seed0, procs, aiOpts) {
  return new Promise((res, rej) => {
    const seeds = Array.from({ length: n }, (_, i) => seed0 + i), chunks = Array.from({ length: procs }, (_, p) => seeds.filter((_, i) => i % procs === p)).filter(c => c.length);
    let got = [], done = 0;
    for (const c of chunks) { const w = fork(path.join(__dirname, 'tune_worker.js')); w.on('message', m => { got = got.concat(m); if (++done === chunks.length) res(got.sort((a, b) => a.seed - b.seed)); }); w.on('error', rej); w.send({ battle, seeds: c, K, runner, aiOpts }); }
  });
}
// a battle's results against its targets: [{ what, value, ok }]
function judge(targets, res) {
  const n = res.length;
  return targets.checks.map(c => {
    if (c.share) {
      const re = new RegExp(c.share), not = c.not ? new RegExp(c.not) : null, v = 100 * res.filter(r => re.test(r.grade) && !(not && not.test(r.grade))).length / n;
      const ok = (c.min == null || v >= c.min) && (c.max == null || v <= c.max) && (c.below == null || v < c.below);
      return { what: c.what, value: v.toFixed(1) + '%', ok, band: c.below != null ? `under ${c.below}%` : `${c.min ?? 0}-${c.max ?? 100}%` };
    }
    if (c.losses) { const v = pct(res.map(r => r.kw[c.losses]), 0.5); return { what: c.what, value: kfmt(v), ok: v >= c.median[0] && v <= c.median[1], band: `${kfmt(c.median[0])}-${kfmt(c.median[1])}` }; }
    if (c.metric && c.median) { const v = pct(res.map(r => r.metrics[c.metric]), 0.5); return { what: c.what, value: hm(v), ok: v != null && v >= tmin(c.median[0]) && v <= tmin(c.median[1]), band: `${c.median[0]}-${c.median[1]}` }; }
    if (c.metric) { const v = 100 * res.filter(r => r.metrics[c.metric] != null).length / n; return { what: c.what, value: v.toFixed(0) + '%', ok: (c.min == null || v >= c.min) && (c.max == null || v <= c.max), band: `${c.min ?? 0}-${c.max ?? 100}%` }; }
    throw new Error(`target check ${JSON.stringify(c)}: share, losses or metric`);
  });
}
module.exports = { judge, fightAll };

if (require.main === module) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; }, all = k => a.flatMap((x, i) => x === '--' + k ? [a[i + 1]] : []);
  const n = +opt('n', 60), seed0 = +opt('seed', 1000), procs = +opt('procs', 2), aiOpts = Object.assign({}, opt('generic') ? { generic: opt('generic').split(',') } : {}, process.argv.includes('--no-timetables') ? { timetables: false } : {}); // --generic AL: those armies by the generic doctrine (3d); --no-timetables: the generic commanders alone, without the battles' timetables
  const battles = (opt('battles', '') || Object.keys(P.battles).filter(id => P.battles[id].targets).join(',')).split(',').filter(Boolean);
  const base = {}; for (const s of all('set')) { const [k, v] = s.split('='); base[k.replace(/^K\./, '')] = +v; }
  let grid = [{}]; for (const s of all('sweep')) { const [k, vs] = s.split('='); grid = grid.flatMap(g => vs.split(',').map(v => Object.assign({}, g, { [k.replace(/^K\./, '')]: +v }))); }
  for (const id of battles) if (!P.battles[id] || !P.battles[id].targets) { console.log(`battle "${id}" has no targets`); process.exit(1); }
  (async () => {
    const rows = [];
    for (const g of grid) {
      const K = Object.assign({}, base, g), label = Object.keys(K).length ? Object.entries(K).map(([k, v]) => `${k}=${v}`).join(' ') : 'as the era has it';
      console.log(`\n== ${label}`);
      let inBand = 0;
      for (const id of battles) {
        const T = P.battles[id].targets, t0 = Date.now(), res = await fightAll(id, T.runner || 'doctrine', K, n, seed0, procs, aiOpts), J = judge(T, res);
        const g2 = {}; for (const r of res) g2[r.grade] = (g2[r.grade] || 0) + 1;
        console.log(`${P.battles[id].name}: ${n} battles in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${Object.entries(g2).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${Math.round(100 * v / n)}%`).join(', ')}`);
        for (const j of J) console.log(`  ${j.ok ? 'IN ' : 'OUT'} ${j.what.padEnd(34)} ${String(j.value).padStart(7)}   (band ${j.band})`);
        if (J.every(j => j.ok)) inBand++;
        rows.push({ setting: label, battle: id, checks: J });
      }
      console.log(`-> in band in ${inBand} of ${battles.length} battles`);
    }
    if (grid.length > 1) {
      console.log('\nsetting'.padEnd(40) + battles.map(b => b.padStart(14)).join(''));
      for (const g of grid) { const label = Object.entries(Object.assign({}, base, g)).map(([k, v]) => `${k}=${v}`).join(' '); console.log(label.padEnd(39) + battles.map(b => { const r = rows.find(x => x.setting === label && x.battle === b); const out = r.checks.filter(c => !c.ok).length; return (out ? `${out} out` : 'in band').padStart(14); }).join('')); }
    }
    const jf = opt('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(rows, null, 1));
  })();
}
