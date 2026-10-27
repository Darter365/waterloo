/* Replay files (engine roadmap 4e): a battle's settings and order log with the engine and pack versions it was fought with.
     node tools/replay.js record <out.json> [--seed n] [--scenario 1100]   fight with the historical orders and save the replay and result
     node tools/replay.js check <file.json>                                 can this build fight the same battle from it?
     node tools/replay.js fight <file.json>                                 fight it again and compare with the result it recorded
   The game's order log (G.orderLog) is the same format: a replay is { kind, format, battle, engine, packs, fingerprint, settings, log }. */
'use strict';
const fs = require('fs'), path = require('path');
const R = require(path.join(__dirname, '..', 'replay.js'));
const [cmd, file, ...rest] = process.argv.slice(2);
const arg = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
function fight(rep) {
  const { E } = R.run(rep.settings, rep.log);
  while (!E.over) E.step();
  return { grade: E.result.grade, why: E.result.why, t: E.result.t, cas: E.result.cas };
}
if (cmd === 'record') {
  const seed = +arg('seed', 1), o = { battle: 'waterloo', seed, history: 'uncertain', scenario: arg('scenario', '1100'), staff: seed % 2 ? 'soult' : 'berthier', silence: 0 };
  const rep = R.record(o, [{ i: 0, t: 660, k: 'hist' }]);
  rep.result = fight(rep);
  fs.writeFileSync(file, JSON.stringify(rep, null, 1));
  console.log(`saved ${file}: ${rep.result.grade} (${rep.result.why}), engine ${rep.engine}, packs ${rep.fingerprint}`);
} else if (cmd === 'check' || cmd === 'fight') {
  const rep = JSON.parse(fs.readFileSync(file, 'utf8')), c = R.check(rep);
  console.log(c.ok ? 'this build fights the same battle from it' : (c.fatal ? 'cannot fight it: ' : 'it can be fought, but may come out differently: ') + c.notes.join('; '));
  if (cmd === 'fight' && !c.fatal) {
    const now = fight(rep), same = rep.result && JSON.stringify(rep.result) === JSON.stringify(now);
    console.log(`now: ${now.grade} (${now.why}) at ${Math.floor(now.t / 60)}:${String(now.t % 60).padStart(2, '0')}` + (rep.result ? (same ? ' - the same as recorded' : ` - recorded: ${rep.result.grade} (${rep.result.why})`) : ''));
    if (rep.result && !same) process.exitCode = 1;
  }
} else console.log('usage: node tools/replay.js record|check|fight <file.json> [--seed n] [--scenario 1100]');
