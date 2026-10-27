/* Fight any battle pack with the generic commanders (doctrine.js) on every side, many times, and summarise: the quick port and quick
   tuning tool of the engine roadmap (phase 4: the battle test page runs the same thing in the browser).
     node tools/fight.js <battle> [n=20] [--start <name>] [--log <seed>] [--trace <seed>] [--no-timetables]
   --log prints one battle's log (the important lines) instead of the summary; --trace adds, every half hour, each army's morale and
   what its formed bodies are doing (task counts, mean cohesion). */
'use strict';
const path = require('path');
const SIM = path.join(__dirname, '..');
const P = require(path.join(SIM, 'packs', 'all.js')), En = require(path.join(SIM, 'engine.js')), D = require(path.join(SIM, 'doctrine.js'));
require(path.join(SIM, 'ai.js'));
function fight(battle, seed, start, every) {
  const E = En.create({ battle, seed, scenario: start });
  D.make(process.argv.includes('--no-timetables') ? { timetables: false } : {}).init(E); // (3d) --no-timetables: without the battle's timetables
  if (!every) { E.run(); return E; }
  let next = E.t; const out = [];
  while (!E.over) { if (E.t >= next) { next += every; out.push({ t: E.t, text: trace(E) }); } E.step(); }
  E.trace = out; return E;
}
function trace(E) {
  return E.sideIds.map(s => { const us = E.units.filter(u => u.side === s && u.onMap && E.formed(u)), tk = {};
    for (const u of us) tk[u.task.kind] = (tk[u.task.kind] || 0) + 1;
    const coh = us.length ? Math.round(us.reduce((a, u) => a + u.coh, 0) / us.length) : 0;
    return `${s} m${Math.round(E.morale[s])} n${us.length} c${coh} ` + Object.entries(tk).map(([k, v]) => k + v).join(' '); }).join(' | ');
}
const pct = (a, q) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
module.exports = { fight };
if (require.main === module) {
  const args = process.argv.slice(2), battle = args[0], n = +(args[1] && !args[1].startsWith('--') ? args[1] : 20);
  const si = args.indexOf('--start'), start = si >= 0 ? args[si + 1] : undefined, ti = args.indexOf('--trace'), li = ti >= 0 ? ti : args.indexOf('--log');
  if (!battle) { console.log('usage: node tools/fight.js <battle> [n] [--start <name>] [--log <seed>]'); process.exit(1); }
  if (li >= 0) {
    const E = fight(battle, +args[li + 1], start, ti >= 0 ? 30 : 0), lines = [];
    for (const l of E.log) if (l.important || ['orders', 'place', 'army', 'break', 'end'].includes(l.cat)) lines.push({ t: l.t, text: `[${l.cat}${l.side ? ' ' + l.side : ''}] ${l.text}` });
    for (const x of E.trace || []) lines.push({ t: x.t - 0.5, text: '  ~ ' + x.text });
    for (const l of lines.sort((a, b) => a.t - b.t)) console.log(E.fmtT(Math.ceil(l.t)), l.text);
    return;
  }
  const t0 = Date.now(), res = [];
  for (let s = 1; s <= n; s++) { const E = fight(battle, s, start); res.push({ grade: E.result.grade, why: E.result.why, t: E.t, cas: E.result.cas, metrics: E.metrics, morale: E.morale }); }
  const B = P.battle(battle), sides = B.sideIds;
  console.log(`${B.battle.name}: ${n} battles with the generic commanders on every side (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const g = {}; for (const r of res) g[r.grade] = (g[r.grade] || 0) + 1;
  console.log('results    ', Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(100 * v / n)}%`).join(', '));
  const why = {}; for (const r of res) why[r.why] = (why[r.why] || 0) + 1;
  console.log('ended by   ', Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', '));
  for (const s of sides) console.log(`${s.padEnd(4)} k&w p10/50/90`, [0.1, 0.5, 0.9].map(q => pct(res.map(r => r.cas[s].kw), q)).join(' / '), ' morale at the end p50', Math.round(pct(res.map(r => r.morale[s]), 0.5)));
  for (const k of Object.keys(res[0].metrics)) { const v = res.map(r => r.metrics[k]); const got = v.filter(x => x != null).length; if (got) console.log(`${k.padEnd(12)} in ${got} of ${n}; p50 ${En.fmtT(pct(v, 0.5))}`); }
}
