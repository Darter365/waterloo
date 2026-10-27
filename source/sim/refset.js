// Phase 0 of the engine roadmap: the Waterloo reference battles. Every 30 game minutes each battle's whole state is hashed: every unit's
// position, strength, cohesion, status and formation at full precision, army morale, every farm's holder and sections, and the number
// of dice drawn. Phase 1 (restructuring) must reproduce every hash; the first hash that differs names the minute a battle diverged.
//   node refset.js record <mode> <from> <n> <out.json>    modes: hist (Napoleon's orders, 11:00), dawn (05:00), dry, chaos
//   node refset.js check <ref.json> [n]                   replays the reference battles and reports the first divergence of each
const R = require('./replay.js'), Scr = require('./script.js'), { chaosPlayer } = require('./invariants.js'), crypto = require('crypto'), fs = require('fs');
const SCEN = { hist: '1100', dawn: '0500', dry: 'dry', chaos: '1100' };
function stateHash(E) {
  const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
  const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
  const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0);
  return crypto.createHash('sha1').update(JSON.stringify([E.t, E.morale, units, places, dice])).digest('hex').slice(0, 16);
}
function fightRef(mode, seed) {
  const E = R.setup({ seed, history: 'uncertain', scenario: SCEN[mode], staff: seed % 2 ? 'soult' : 'berthier', silence: 0 });
  let chaos = null; if (mode === 'chaos') chaos = chaosPlayer(seed); else Scr.historical(E);
  const cps = []; let guard = 0;
  while (!E.over && guard++ < 2000) { if (chaos) chaos.act(E); E.step(); if (E.t % 30 === 0) cps.push([E.t, stateHash(E)]); }
  cps.push([E.t, stateHash(E)]);
  return { mode, seed, cps, result: E.result ? { grade: E.result.grade, why: E.result.why, t: E.result.t } : null };
}
const [cmd, a1, a2, a3, a4] = process.argv.slice(2);
if (cmd === 'record') {
  const out = []; for (let s = +a2; s < +a2 + +a3; s++) out.push(fightRef(a1, s));
  fs.writeFileSync(a4, JSON.stringify({ release: process.env.REF_RELEASE || 'release 3', recorded: new Date().toISOString(), mode: a1, entries: out }));
  console.log('recorded', a1, out.length, 'battles to', a4);
} else if (cmd === 'check') {
  const ref = JSON.parse(fs.readFileSync(a1, 'utf8')), lim = a2 ? +a2 : ref.entries.length; let bad = 0;
  for (const e of ref.entries.slice(0, lim)) {
    const now = fightRef(e.mode, e.seed), n = Math.max(now.cps.length, e.cps.length);
    for (let i = 0; i < n; i++) { const p = e.cps[i], q = now.cps[i]; if (!p || !q || p[0] !== q[0] || p[1] !== q[1]) { bad++; console.log(`DIVERGED ${e.mode} seed ${e.seed} at ${p ? Math.floor(p[0] / 60) + ':' + String(p[0] % 60).padStart(2, '0') : 'end'}`); break; } }
  }
  console.log(`checked ${lim} ${ref.mode} battles: ${lim - bad} identical, ${bad} diverged`);
}
