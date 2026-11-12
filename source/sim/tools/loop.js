/* Measures of the core loop (docs/METHOD.md, section 5; approved 12 November 2026). The game's subject is command under fog: what
   the commander could know, when he knew it, and what an order could and could not do. This tool puts numbers on that, for a named
   battle fought many times under each plan the pack knows: no orders, the historical orders, and each of the pack's `strategies`.

     Belief error       how far the commander's picture stands from the truth: for his own brigades and for the enemy he has on his
                        map, the distance between the believed and the true position; and the share of the enemy's men he has no
                        mark for at all                                                          (loop rule: fog is fair)
     Report staleness   the age of the newest news he has of each body on his map               (fog is fair)
     Order latency      from giving an order to its being acted on, and beside the staff's estimate of that (delay is learnable)
     Orders overtaken   the share of orders that arrived after the situation at their objective had changed (delay is learnable)
     Decision gaps      the longest stretch in which no starred dispatch reached him             (orders interact; good play gets credit)

   The measures read the contract only (view.js: world, snapshot('chief'), snapshot('truth'), watch, drain). `measure` below is
   handed the view and nothing else: it never sees an engine object, draws no dice and writes no state. The driver that sets a battle
   up and steps it is the same as the strategy bench's, and `--check` shows that a measured battle ends on the same state hashes as
   one that was never looked at.

     node tools/loop.js <battle> [--n 30] [--seed 2000] [--plans idle,historical] [--out results/loop_<battle>.json] [--check [k]]

   Seeds start at 2000, the strategy bench's: they are not the calibration seeds (1000 to 1499). The file written holds no clock
   time, so the same command gives the same file.

   Every threshold below is (est.): my judgement, listed in docs/DECISIONS.md under "Claude's choices awaiting Chris". */
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const SIM = path.join(__dirname, '..');

const DEF = {
  SAMPLE: 10,       // (est.) minutes between two readings of belief against truth; the after-action report samples at the same step
  NEAR: 800,        // (est.) metres round an order's objective that count as "the situation it addressed"
  SWING: 2,         // (est.) the enemy's strength there has changed if it has at least doubled or halved...
  SWING_MEN: 1000,  // (est.) ...and by at least this many men, about a weak brigade, so that small bodies coming and going do not count
};
// (est.) "a choice worth making" is read as: a dispatch the staff starred reached the commander. The star is the game's own mark for
// news he does not have yet (command.js, receiveReport), so the measure adds no rule of its own; but news is only half of a choice.
// Whether he had anything free to order with is not measured here.

const hyp = Math.hypot;
const sorted = a => a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y);
// the q-th centile by nearest rank (as tools/fight.js); null for an empty list
const pct = (a, q) => { const v = sorted(a); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
const med = a => pct(a, 0.5);
const mean = a => { const v = sorted(a); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
const share = (a, f) => a.length ? 100 * a.filter(f).length / a.length : null;
const r1 = v => v == null ? null : Math.round(v * 10) / 10;

// has the situation at an objective changed between two readings of it? Returns why ('holder', 'strength') or null.
function changed(a, b, D = DEF) {
  if (!a || !b) return null;
  if (a.holder !== undefined && b.holder !== undefined && a.holder !== b.holder) return 'holder';
  const lo = Math.min(a.enemy, b.enemy), hi = Math.max(a.enemy, b.enemy);
  return hi - lo >= D.SWING_MEN && hi >= D.SWING * lo ? 'strength' : null;
}

/* ---------- the measures: everything here comes from the view V ---------- */
function measure(V, D = DEF) {
  const world = V.world(), coal = Object.fromEntries(world.sides.map(s => [s.id, s.coalition]));
  V.watch('chief');
  const first = V.snapshot('chief'), me = first.side, t0 = first.t, foe = s => coal[s] !== coal[me];
  const orders = new Map(), samples = [], stars = [];
  let seq = 0, nextSample = t0, tEnd = t0;
  // the situation at an objective: who holds the place (if it is one), and the enemy's horse and foot within NEAR of it. Guns are
  // left out on both sides of the comparison: the truth counts a battery in guns and a sighting counts it in men
  const believed = (S, ob) => ({ holder: ob.sp ? (S.places.find(p => p.id === ob.sp) || {}).holder : undefined,
    enemy: S.enemy.filter(e => !e.guns && !(e.side && !foe(e.side)) && hyp(e.x - ob.x, e.y - ob.y) <= D.NEAR).reduce((a, e) => a + e.str, 0) });
  const actual = (T, ob) => ({ holder: ob.sp ? (T.places.find(p => p.id === ob.sp) || {}).holder : undefined,
    enemy: T.units.filter(u => !u.crew && foe(u.side) && hyp(u.x - ob.x, u.y - ob.y) <= D.NEAR).reduce((a, u) => a + u.str, 0) });

  function sample(S, T) {
    const byId = new Map(T.units.map(u => [u.id, u])), byKey = new Map(T.units.filter(u => u.key).map(u => [u.key, u]));
    const own = [], enemy = [], shown = new Set();
    for (const o of S.own) { const u = byId.get(o.id); if (u && !o.gone) own.push(hyp(o.x - u.x, o.y - u.y)); }
    for (const e of S.enemy) { shown.add(e.key); const u = byKey.get(e.key); if (u) enemy.push(hyp(e.x - u.x, e.y - u.y)); }
    const foes = T.units.filter(u => foe(u.side) && !u.crew), all = foes.reduce((a, u) => a + u.str, 0), dark = foes.filter(u => !u.key || !shown.has(u.key)).reduce((a, u) => a + u.str, 0);
    samples.push({ t: S.t, ownErr: med(own), ownErr90: pct(own, 0.9), enemyErr: med(enemy), enemyErr90: pct(enemy, 0.9), unknown: all ? 100 * dark / all : null,
      staleEnemy: med(S.enemy.map(e => S.t - e.seenAt)), staleOwn: med(S.own.filter(o => !o.gone).map(o => S.t - o.seenAt)) });
  }
  // what became of each order, from the umpire's list
  function follow(T) {
    const by = new Map(T.orders.map(o => [o.id, o]));
    for (const r of orders.values()) { const o = by.get(r.id); if (!o) continue;
      r.status = o.status;
      if (o.receivedAt != null && r.receivedAt == null) { r.receivedAt = o.receivedAt; r.onArrival = r.objective ? actual(T, r.objective) : null; }
      if (o.actedAt != null) r.actedAt = o.actedAt; }
  }
  const riding = r => r.receivedAt == null && !['done', 'lost', 'cancelled', 'superseded'].includes(r.status);

  // call once before the first step and once after every step
  function tick() {
    const S = V.snapshot('chief'); let T = null; const truth = () => T || (T = V.snapshot('truth'));
    tEnd = S.t;
    for (const e of V.drain('chief', seq)) { seq = e.seq; if (e.kind === 'dispatch' && e.starred) stars.push(e.t); }
    // a new order: keep the staff's estimate as first given, and the situation at its objective as he believed it and as it was
    for (const o of S.orders) if (!orders.has(o.id)) orders.set(o.id, { id: o.id, to: o.to, action: o.action, issuedAt: o.issuedAt, conditions: o.conditions, expect: o.expect, objective: o.objective,
      believed: o.objective ? believed(S, o.objective) : null, wasTrue: o.objective ? actual(truth(), o.objective) : null, receivedAt: null, actedAt: null, onArrival: null, status: null });
    // while an order is on the road the truth is read every tick, so the situation "on arrival" is within one tick of it
    if ([...orders.values()].some(riding)) follow(truth());
    if (S.t >= nextSample || S.over) { sample(S, truth()); follow(truth()); nextSample += D.SAMPLE; }
    return S.over;
  }

  function result() {
    const os = [...orders.values()], field = os.filter(o => o.expect), got = field.filter(o => o.receivedAt != null), acted = got.filter(o => o.actedAt != null);
    const plain = acted.filter(o => o.conditions === 0), timed = acted.filter(o => o.expect.act), aimed = got.filter(o => o.objective && o.onArrival), written = os.filter(o => o.objective && o.wasTrue);
    const edges = [t0, ...stars.slice().sort((a, b) => a - b), tEnd], gaps = edges.slice(1).map((t, i) => t - edges[i]);
    const mid = a => (a[0] + a[1]) / 2;
    return {
      start: t0, end: tEnd, samples: samples.length,
      ownErr: r1(mean(samples.map(s => s.ownErr))), ownErr90: r1(mean(samples.map(s => s.ownErr90))), enemyErr: r1(mean(samples.map(s => s.enemyErr))), enemyErr90: r1(mean(samples.map(s => s.enemyErr90))), unknown: r1(mean(samples.map(s => s.unknown))),
      staleEnemy: r1(mean(samples.map(s => s.staleEnemy))), staleOwn: r1(mean(samples.map(s => s.staleOwn))),
      orders: field.length, received: got.length, lost: r1(share(field, o => o.status === 'lost')),
      delivery: r1(med(got.map(o => o.receivedAt - o.issuedAt))), latency: r1(med(plain.map(o => o.actedAt - o.issuedAt))),
      arriveIn: r1(share(got, o => o.receivedAt >= o.expect.arrive[0] && o.receivedAt <= o.expect.arrive[1])), arriveLate: r1(share(got, o => o.receivedAt > o.expect.arrive[1])),
      actIn: r1(share(timed, o => o.actedAt >= o.expect.act[0] && o.actedAt <= o.expect.act[1])), actLate: r1(share(timed, o => o.actedAt > o.expect.act[1])),
      actError: r1(med(timed.map(o => o.actedAt - mid(o.expect.act)))),
      aimed: aimed.length, overtaken: r1(share(aimed, o => changed(o.wasTrue, o.onArrival, D))), falsePicture: r1(share(written, o => changed(o.believed, o.wasTrue, D))),
      stars: stars.length, longestGap: r1(Math.max(...gaps)), medianGap: r1(med(gaps)), starsPerHour: r1(tEnd > t0 ? stars.length / ((tEnd - t0) / 60) : null),
      series: samples.map(s => [s.t, r1(s.ownErr), r1(s.enemyErr), r1(s.unknown), r1(s.staleEnemy), r1(s.staleOwn), r1(s.ownErr90), r1(s.enemyErr90)]),
      orderList: field.map(o => ({ to: o.to, action: o.action, conditions: o.conditions, issuedAt: o.issuedAt, receivedAt: o.receivedAt, actedAt: o.actedAt, expect: o.expect, status: o.status,
        overtaken: changed(o.wasTrue, o.onArrival, D), falsePicture: changed(o.believed, o.wasTrue, D) })),
    };
  }
  return { tick, result };
}

/* ---------- the driver: sets a battle up and steps it, as the strategy bench does ---------- */
const load = () => ({ P: require(path.join(SIM, 'packs', 'all.js')), R: require(path.join(SIM, 'replay.js')), Scr: require(path.join(SIM, 'script.js')), View: require(path.join(SIM, 'view.js')) });
function setup(L, battle, seed, plan) {
  const B = L.P.battle(battle).battle, E = L.R.setup({ battle, seed, history: 'uncertain' });
  if (plan === 'historical') L.Scr.historical(E, {});
  else if (plan !== 'idle') for (const spec of B.strategies[plan].orders) E.command.order(JSON.parse(JSON.stringify(spec)));
  return E;
}
function fight(L, battle, seed, plan, onHalfHour) {
  const E = setup(L, battle, seed, plan), M = measure(L.View.install(E));
  M.tick();
  while (!E.over) { E.step(); M.tick(); if (onHalfHour && E.t % 30 === 0) onHalfHour(E); }
  if (onHalfHour) onHalfHour(E);
  return M.result();
}
// the reference battles' state hash (refset.js, tools/test_view.js). This reads the engine: it is the check on the measures, not one of them
function stateHash(E) {
  const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
  const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
  const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0);
  return crypto.createHash('sha1').update(JSON.stringify([E.t, E.morale, units, places, dice])).digest('hex').slice(0, 16);
}
// a battle measured against the same battle never looked at: the state hash every half hour and at the end
function check(L, battle, seed, plan) {
  const A = setup(L, battle, seed, plan), a = []; while (!A.over) { A.step(); if (A.t % 30 === 0) a.push(stateHash(A)); } a.push(stateHash(A));
  const b = []; fight(L, battle, seed, plan, E => b.push(stateHash(E)));
  return { hashes: a.length, same: a.length === b.length && a.every((h, i) => h === b[i]) };
}

const MEASURES = [ // key, label, unit, what a reader should know
  ['ownErr', 'Belief error, own: the middle brigade', 'm', 'distance from believed to true position of the median brigade, averaged over the day'],
  ['ownErr90', 'Belief error, own: the worst tenth', 'm', 'the same for the brigade at the 90th centile: most brigades stand still, so the middle one hides the ones that moved'],
  ['enemyErr', 'Belief error, enemy: the middle body', 'm', 'the same for enemy bodies he has a mark for'],
  ['enemyErr90', 'Belief error, enemy: the worst tenth', 'm', 'the enemy body at the 90th centile'],
  ['unknown', 'Enemy he has no mark for', '%', 'share of the enemy\'s horse and foot on the field, averaged over the day'],
  ['staleEnemy', 'Report staleness, enemy', 'min', 'median age of the newest sighting of each enemy body on his map'],
  ['staleOwn', 'Report staleness, own', 'min', 'median age of the newest report of each of his brigades'],
  ['orders', 'Orders to the field', '', 'orders of his own sent to a commander on the field'],
  ['delivery', 'Given to received', 'min', 'median over orders that arrived'],
  ['latency', 'Order latency: given to acted on', 'min', 'median over orders without conditions'],
  ['arriveIn', 'Arrived inside the staff\'s range', '%', 'of orders that arrived'],
  ['arriveLate', 'Arrived later than the staff said', '%', 'of orders that arrived'],
  ['actIn', 'Acted on inside the staff\'s range', '%', 'of orders the staff could time'],
  ['actError', 'Acted on against the middle of the estimate', 'min', 'median; above zero is late'],
  ['lost', 'Orders lost on the road', '%', 'every rider lost'],
  ['overtaken', 'Orders overtaken', '%', 'of orders with an objective that arrived: the situation there changed on the road'],
  ['falsePicture', 'Orders written on a false picture', '%', 'of orders with an objective: belief and truth already differed when written'],
  ['longestGap', 'Decision gap: longest', 'min', 'longest stretch with no starred dispatch'],
  ['medianGap', 'Decision gap: median', 'min', 'median stretch between starred dispatches'],
  ['starsPerHour', 'Starred dispatches an hour', '', ''],
];
function summarise(rows) {
  const out = {};
  for (const [k] of MEASURES) { const v = rows.map(r => r[k]); out[k] = { p10: pct(v, 0.1), p50: pct(v, 0.5), p90: pct(v, 0.9), n: sorted(v).length }; }
  // the day by the hour: the median over battles of each reading taken in that hour
  const hours = {};
  for (const r of rows) for (const s of r.series) { const h = Math.floor(s[0] / 60); (hours[h] = hours[h] || []).push(s); }
  out.byHour = Object.keys(hours).map(Number).sort((a, b) => a - b).map(h => ({ hour: h, battles: new Set(hours[h].map(s => s.b)).size, ownErr: r1(med(hours[h].map(s => s[1]))), enemyErr: r1(med(hours[h].map(s => s[2]))),
    unknown: r1(med(hours[h].map(s => s[3]))), staleEnemy: r1(med(hours[h].map(s => s[4]))), staleOwn: r1(med(hours[h].map(s => s[5]))), ownErr90: r1(med(hours[h].map(s => s[6]))), enemyErr90: r1(med(hours[h].map(s => s[7]))) }));
  return out;
}

module.exports = { DEF, MEASURES, changed, pct, measure, fight, check, summarise, stateHash, load };

if (require.main === module) {
  const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
  const battle = args[0] && !args[0].startsWith('--') ? args[0] : null;
  if (!battle) { console.log('usage: node tools/loop.js <battle> [--n 30] [--seed 2000] [--plans idle,historical] [--out file] [--check [k]]'); process.exit(1); }
  const L = load(), B = L.P.battle(battle).battle;
  if (!B.command) { console.log(`${battle} has no command layer, so there is no commander to measure`); process.exit(1); }
  const N = +arg('--n', 30), SEED0 = +arg('--seed', 2000);
  const known = ['idle', ...(B.plans && B.plans.historical ? ['historical'] : []), ...Object.keys(B.strategies || {}).filter(k => k !== 'expect')];
  const plans = arg('--plans', null) ? arg('--plans').split(',').filter(p => known.includes(p)) : known;
  const nameOf = p => p === 'idle' ? 'No orders' : p === 'historical' ? 'The historical orders' : B.strategies[p].name;
  const t0 = Date.now();

  if (args.includes('--check')) {
    const k = +arg('--check', 1); let bad = 0, hashes = 0, n = 0;
    for (const p of plans) for (let s = 0; s < k; s++) { const c = check(L, battle, SEED0 + s, p); n++; hashes += c.hashes; if (!c.same) { bad++; console.log(`FAIL ${battle} seed ${SEED0 + s}, ${nameOf(p)}: measuring changed the battle`); } }
    console.log(`loop: measuring changes nothing: ${n - bad} of ${n} battles end on the same state hashes as the same battles not measured (${battle}, ${plans.length} plans, seeds ${SEED0} to ${SEED0 + k - 1}, ${hashes} hashes; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    process.exit(bad ? 1 : 0);
  }

  const out = { tool: 'tools/loop.js', battle, name: B.name, n: N, seeds: [SEED0, SEED0 + N - 1], node: process.version, thresholds: DEF,
    choice: 'a starred dispatch reaching the commander (est.)', measures: MEASURES.map(([key, label, unit, note]) => ({ key, label, unit, note })), plans: {} };
  console.log(`${B.name}: the core loop over ${N} battles a plan, seeds ${SEED0} to ${SEED0 + N - 1}. Median (10th to 90th centile) over battles.`);
  for (const p of plans) {
    const rows = []; for (let s = 0; s < N; s++) { const r = fight(L, battle, SEED0 + s, p); r.seed = SEED0 + s; r.series.forEach(x => { x.b = s; }); rows.push(r); }
    const sum = summarise(rows);
    out.plans[p] = { name: nameOf(p), summary: sum, battles: rows.map(r => { const { series, ...rest } = r; return rest; }) };
    console.log(`\n  ${nameOf(p)}`);
    for (const [k, label, unit] of MEASURES) { const m = sum[k]; console.log(`    ${label.padEnd(48)} ${m.n ? `${String(m.p50).padStart(7)} ${unit.padEnd(3)} (${m.p10} to ${m.p90})${m.n < N ? `  in ${m.n} of ${N} battles` : ''}` : '      –     nothing to measure'}`); }
  }
  const file = arg('--out', path.join(SIM, 'results', `loop_${battle}.json`));
  fs.writeFileSync(file, JSON.stringify(out) + '\n');
  console.log(`\nloop: ${plans.length} plans, ${N * plans.length} battles (${((Date.now() - t0) / 1000).toFixed(0)} s); saved to ${path.relative(process.cwd(), file)}`);
}
