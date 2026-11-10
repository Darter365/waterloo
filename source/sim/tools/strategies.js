/* The strategy bench (release 4): fight each battle the way different players would, and judge whether the results are believable.
   The 1815 band (tools/band.js) checks one plan, Napoleon's. A player tries others, so this fights every battle that has a `stakes`
   block three ways or more, through the same order builder and riders the game uses:
     idle        no orders at all
     historical  the pack's historical plan
     <others>    the pack's `strategies`: opening orders given at the start
   and holds the results to expectations any battle should meet. A failure that is already known is listed as a known gap, not failed
   (KNOWN below): the list may only shrink.
     node tools/strategies.js [--n 6] [--battle waterloo] [--seed 2000] */
'use strict';
const path = require('path');
const SIM = path.join(__dirname, '..');
const P = require(path.join(SIM, 'packs', 'all.js')), R = require(path.join(SIM, 'replay.js')), Scr = require(path.join(SIM, 'script.js')), St = require(path.join(SIM, 'stakes.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const N = +arg('--n', 6), SEED0 = +arg('--seed', 2000), ONLY = arg('--battle', null);
// gaps known when this bench was written (9 November): the engine has no rule yet for a defender going over to the attack
const KNOWN = { 'waterloo:idle-punished': 'the allies never attack an idle French army: the field ends a draw (needs a rule for a defender taking the initiative)' };
const med = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };

function fight(battle, seed, plan) {
  const B = P.battle(battle).battle, E = R.setup({ battle, seed, history: 'uncertain' }), refused = [];
  if (plan === 'historical') Scr.historical(E, {});
  else if (plan !== 'idle') for (const spec of B.strategies[plan].orders) { const r = E.command.order(JSON.parse(JSON.stringify(spec))); if (!r.ok) refused.push(`${spec.to}: ${r.error || 'refused'}`); }
  E.run();
  const j = St.judge(E, B.stakes), me = B.stakes.side, enemies = E.sideIds.filter(s => E.coalition[s] !== E.coalition[me]);
  return { grade: E.result.grade, why: E.result.why, tier: j.tier, score: j.score, title: j.title, own: E.result.cas[me].kw, enemy: enemies.reduce((a, s) => a + E.result.cas[s].kw, 0),
    worst: Math.max(...E.sideIds.map(s => E.result.cas[s].kw / E.armyStr0[s])), refused };
}

let failed = 0, gaps = 0, checks = 0;
const t0 = Date.now();
for (const id of Object.keys(P.battles)) {
  const B = P.battle(id).battle; if (!B.stakes || !B.command || (ONLY && ONLY !== id)) continue;
  const plans = ['idle', ...(B.plans && B.plans.historical ? ['historical'] : []), ...Object.keys(B.strategies || {}).filter(k => k !== 'expect')], res = {};
  console.log(`\n${B.name}: ${N} battles a plan, seeds from ${SEED0}`);
  for (const p of plans) {
    const r = res[p] = []; for (let s = 0; s < N; s++) r.push(fight(id, SEED0 + s, p));
    const g = {}; for (const x of r) g[x.grade] = (g[x.grade] || 0) + 1;
    const name = p === 'idle' ? 'No orders' : p === 'historical' ? 'The historical orders' : B.strategies[p].name;
    console.log(`  ${name.padEnd(34)} campaign ${med(r.map(x => x.score)).toString().padStart(3)}/100 (tier ${med(r.map(x => x.tier))})  k&w own ${med(r.map(x => x.own))} enemy ${med(r.map(x => x.enemy))}  ${Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    if (r[0].refused.length) console.log('    refused: ' + r[0].refused.join('; '));
  }
  const check = (key, pass, what) => { checks++; const k = id + ':' + key; if (pass) { console.log(`  ok    ${what}`); if (KNOWN[k]) console.log(`        (listed as a known gap but now passing: remove it from KNOWN)`); } else if (KNOWN[k]) { gaps++; console.log(`  gap   ${what}\n        known: ${KNOWN[k]}`); } else { failed++; console.log(`  FAIL  ${what}`); } };
  const all = Object.values(res).flat(), active = plans.filter(p => p !== 'idle');
  check('orders-accepted', all.every(x => !x.refused.length), 'every order of every plan is accepted by the order builder');
  check('idle-unrewarded', res.idle.every(x => x.tier >= 4), 'doing nothing never earns better than "the campaign slipping away"');
  check('idle-below-attack', active.some(p => med(res[p].map(x => x.score)) > med(res.idle.map(x => x.score))), 'at least one plan that attacks scores above doing nothing');
  if ((B.strategies || {}).expect && B.strategies.expect.idleLoses) check('idle-punished', res.idle.filter(x => x.grade !== 'Draw').length >= N / 2, 'an idle army is attacked and loses the field in at least half the battles');
  check('plans-differ', Math.max(...plans.map(p => med(res[p].map(x => x.score)))) - Math.min(...plans.map(p => med(res[p].map(x => x.score)))) >= 10, 'different plans end at least 10 campaign points apart');
  check('losses-sane', all.every(x => x.worst < 0.6), `no army loses 60% of its men killed and wounded (worst ${Math.round(100 * Math.max(...all.map(x => x.worst)))}%)`);
  check('attacks-bite', active.every(p => med(res[p].map(x => x.enemy)) > 3 * med(res.idle.map(x => x.enemy)) || med(res[p].map(x => x.enemy)) > 5000), 'every attacking plan hurts the enemy far more than doing nothing does');
}
console.log(`\nstrategies: ${checks - failed - gaps} of ${checks} expectations met; ${gaps} known gap${gaps === 1 ? '' : 's'} (listed, not failed)${failed ? '; ' + failed + ' FAILED' : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failed ? 1 : 0);
