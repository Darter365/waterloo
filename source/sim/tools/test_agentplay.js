/* The agent harness's own tests (tools/agentplay.js): Napoleon's view cannot leak the truth, and a played battle replays exactly.
     node tools/test_agentplay.js [seed=1003] [--keep]

   The leak test. The same scripted battle is played twice through the chief's view. In the second, whenever the harness is
   looking (that is, at every moment except while the engine steps, the contract collects its events, or an order is being given),
   the truth is a lie: every unit on both sides stands somewhere else at twice its strength and broken, every place has changed
   hands and every army's morale is 3. Before the engine next moves, the truth is put back. If anything the harness writes for the
   chief were read from the truth instead of from his beliefs, the two sets of turns would differ. They must be byte for byte the
   same, and both battles must end on the same state. The test proves it has teeth by playing the umpire's view the same two
   ways and requiring those turns to differ. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const SIM = path.join(__dirname, '..');
const R = require(path.join(SIM, 'replay.js')), View = require(path.join(SIM, 'view.js')), AP = require(path.join(__dirname, 'agentplay.js'));
const seed = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) || 1003), keep = process.argv.includes('--keep');
let passed = 0, failed = 0;
const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log('FAIL ' + what); } };
const settings = { battle: 'waterloo', seed, history: 'uncertain', scenario: '1100', staff: 'soult', silence: 45 };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentplay-'));

/* ---------- the lie ---------- */
let lying = false; const kept = new WeakMap();
function lie(E) {
  if (!lying || E.over || kept.has(E)) return;
  kept.set(E, { units: E.units.map(u => [u.x, u.y, u.str, u.coh, u.status]), morale: Object.assign({}, E.morale), holders: E.sps.map(sp => sp.holder) });
  for (const u of E.units) { u.x += 1234; u.y -= 777; u.str *= 2; u.coh = 1; u.status = 'broken'; }
  for (const k of Object.keys(E.morale)) E.morale[k] = 3;
  for (const sp of E.sps) sp.holder = E.sideIds.find(s => s !== sp.holder);
}
function unlie(E) {
  const k = kept.get(E); if (!k) return; kept.delete(E);
  E.units.forEach((u, i) => { [u.x, u.y, u.str, u.coh, u.status] = k.units[i]; });
  for (const s of Object.keys(k.morale)) E.morale[s] = k.morale[s];
  E.sps.forEach((sp, i) => { sp.holder = k.holders[i]; });
}
// outermost around the engine's step (outside the contract's own wrapper, so its events are collected from the real battle)
const install = View.install, apply = R.apply;
View.install = E => {
  const V = install(E); if (V.__lieWrapped) return V; V.__lieWrapped = true;
  const watch = V.watch; let wrapped = false;
  V.watch = who => { const r = watch(who); if (!wrapped) { wrapped = true; const inner = E.step; E.step = () => { unlie(E); inner(); lie(E); }; lie(E); } return r; };
  return V;
};
R.apply = (E, e, made) => { unlie(E); try { return apply(E, e, made); } finally { lie(E); } }; // giving an order is the game's act, not a look

/* ---------- one scripted battle through a view ---------- */
const hm = s => { const [h, m] = s.split(':'); return +h * 60 + +m; };
const SCRIPT = [
  { orders: [{ to: 'grandBattery', action: 'bombard', objective: { place: 'ridgeCentre' } }, { to: 'reille', action: 'attack', objective: { place: 'hougoumont' }, with: ['bauduin'] },
    { to: 'derlon', action: 'dance' }, { to: 'lobau', action: 'advance', objective: { place: 'eastFlank' } }], until: '11:04' },
  { orders: 'cancel-lobau', until: '11:30' },
  { orders: [{ seq: [{ to: 'derlon', action: 'attack', objective: { place: 'lhs' } }, { to: 'derlon', action: 'attack', objective: { place: 'ridgeCentre' }, conditions: [{ type: 'after', step: 0, when: 'done' }] }] }] },
  { orders: [] }, { orders: [{ to: 'hq', action: 'moveHQ', post: 'ba' }] }, { orders: [], until: '13:30' }, { orders: [] },
  { orders: [{ to: 'drouot', action: 'attack', objective: { place: 'ridgeCentre' }, manner: { losses: 'heavy' } }], until: '23:59' },
];
function play(name, view, lie_, script) {
  lying = lie_;
  const dir = path.join(tmp, name); AP.start(dir, settings, view);
  for (const step of script) {
    if (AP.load(dir).stops.length && JSON.parse(fs.readFileSync(path.join(dir, lastTurn(dir) + '.json'), 'utf8')).over) break;
    let orders = step.orders;
    if (orders === 'cancel-lobau') { const t = JSON.parse(fs.readFileSync(path.join(dir, lastTurn(dir) + '.json'), 'utf8')), o = (t.receipts.find(r => r.ok && r.entry.to === 'lobau') || { orders: [{}] }).orders[0]; orders = [{ cancel: o.id }, { cancel: 'o999' }]; }
    AP.next(dir, orders, { until: step.until ? hm(step.until) : null });
  }
  lying = false;
  return dir;
}
const lastTurn = dir => fs.readdirSync(dir).filter(f => /^turn-\d+\.json$/.test(f)).sort().pop().replace('.json', '');
const turns = dir => fs.readdirSync(dir).filter(f => /^turn-\d+\.(txt|json)$/.test(f)).sort();
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

const t0 = Date.now();
const plain = play('chief', 'chief', false, SCRIPT), lied = play('chief-lied', 'chief', true, SCRIPT);
const A = turns(plain), B = turns(lied);
ok(A.length === B.length && A.length >= 2 * SCRIPT.length, `both battles made the same turns (${A.length / 2} and ${B.length / 2})`);
const differ = A.filter((f, i) => f !== B[i] || read(plain, f) !== read(lied, B[i]));
ok(differ.length === 0, `Napoleon's turns are byte for byte the same when the truth is a lie (${A.length} files; differing: ${differ.join(', ') || 'none'})`);
const repA = JSON.parse(read(plain, 'replay.json')), repB = JSON.parse(read(lied, 'replay.json'));
ok(repA.hash === repB.hash && JSON.stringify(repA.log) === JSON.stringify(repB.log) && JSON.stringify(repA.stops) === JSON.stringify(repB.stops), `the lie never reached the battle: both end on state ${repA.hash}, with the same orders and stops`);

// teeth: the umpire's view, played the same two ways, must show the lie
const SHORT = [{ orders: [{ to: 'reille', action: 'attack', objective: { place: 'hougoumont' } }], until: '11:20' }, { orders: [], until: '11:40' }];
const tA = play('truth', 'truth', false, SHORT), tB = play('truth-lied', 'truth', true, SHORT);
ok(turns(tA).some(f => read(tA, f) !== read(tB, f)), 'the same lie does show in the umpire\'s turns, so the test can see a leak');
ok(/THE UMPIRE'S VIEW/.test(read(tA, 'turn-001.txt')) && /coh \d+/.test(read(tA, 'turn-001.txt')), 'the umpire\'s turn carries the truth (cohesion, every unit)');

// nothing of the truth by name: no enemy unit's real id, and no truth-only field, in any chief turn before the end
{ const E = R.setup(settings), side = E.command.side, enemyIds = E.units.filter(u => E.coalition[u.side] !== E.coalition[side]).map(u => u.id);
  const FORBIDDEN = new Set(['coh', 'morale', 'smoke', 'unit', 'tid', 'uid', 'result', 'why', 'cause', 'hash']);
  let idLeaks = 0, keyLeaks = [], early = 0, n = 0;
  const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (FORBIDDEN.has(k)) keyLeaks.push(k); walk(v); } };
  for (const f of A.filter(f => f.endsWith('.json'))) { const js = read(plain, f), t = JSON.parse(js); n++;
    for (const id of enemyIds) if (js.includes('"' + id + '"')) idLeaks++;
    walk({ snapshot: t.snapshot, events: t.events, dispatches: t.dispatches, receipts: t.receipts.map(r => ({ ok: r.ok, orders: r.orders, error: r.error })) });
    if (!t.over && t.after) early++;
    if (!t.over && /AFTER THE BATTLE/.test(read(plain, f.replace('.json', '.txt')))) early++; }
  ok(idLeaks === 0, `no enemy unit's real id in any chief turn (${enemyIds.length} ids against ${n} turns: ${idLeaks})`);
  ok(keyLeaks.length === 0, `no truth-only field in any chief turn (${[...new Set(keyLeaks)].join(', ') || 'none'})`);
  ok(early === 0, 'the result is shown only once the battle is over');
  const last = JSON.parse(read(plain, lastTurn(plain) + '.json')); ok(last.over && last.after && last.after.grade && /AFTER THE BATTLE/.test(read(plain, lastTurn(plain) + '.txt')), `the last turn is the end of the battle and carries the verdict (${last.after && last.after.grade})`); }

// orders: the builder's refusals are reported and not logged; tearing up works while the order is being written
{ const t1 = JSON.parse(read(plain, 'turn-001.json')), t2 = JSON.parse(read(plain, 'turn-002.json'));
  ok(t1.receipts.length === 4 && t1.receipts.filter(r => r.ok).length === 3 && /can't be ordered/.test(t1.receipts[2].error), 'an order the builder refuses comes back with the builder\'s reason');
  ok(t2.receipts[0].ok && !t2.receipts[1].ok, 'an order still being written can be torn up; one that does not exist cannot');
  ok(t2.snapshot.orders.some(o => o.state === 'cancelled'), 'the torn-up order shows as cancelled in the commander\'s own list');
  ok(repA.log.length === 7 && repA.log.filter(e => e.k === 'cancel').length === 1 && repA.log.filter(e => e.k === 'seq').length === 1 && !JSON.stringify(repA.log).includes('dance'), `the order log holds what was accepted and nothing else (${repA.log.length} entries)`);
  ok(repA.log.every((e, i) => e.i === i && (i === 0 || e.t >= repA.log[i - 1].t)), 'the log is numbered and in time order, as the game\'s is'); }

// the replay: fought again by replay.js alone it ends on the same state; the umpire's record is of the same battle
{ const v = AP.verify(repA);
  ok(v.same, `the saved replay fights the same battle (${v.hash} against ${v.recorded})`);
  ok(repA.kind === 'battle-replay' && R.check(repA).ok && repA.settings.seed === seed, 'replay.json is the game\'s own replay format, with the seed and settings');
  const U = AP.umpire(repA), txt = AP.umpireText(U);
  ok(U.sameAsPlayed === true, 'the umpire\'s record is written from the same battle (watching it changes nothing)');
  ok(U.stops.length === repA.stops.length && U.stops.every((s, i) => s.t === repA.stops[i]), `the record compares belief with truth at each of the player's ${repA.stops.length} stops`);
  ok(U.orders.filter(o => o.byPlayer).length >= 6 && U.orders.some(o => o.receivedAt != null) && U.log.some(e => e.why.length), 'it carries every order\'s real history and the causes');
  ok(U.stops.some(s => s.enemy.medianErr > 0) && U.stops.some(s => Object.keys(s.enemy.unseen).length), 'belief and truth do differ in it');
  ok(txt.length > 5000 && /BELIEF AGAINST TRUTH/.test(txt), 'and reads as text'); }

if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
console.log(`agentplay: ${passed} checks passed${failed ? ', ' + failed + ' FAILED' : ''} (waterloo, seed ${seed}, ${((Date.now() - t0) / 1000).toFixed(0)} s)${keep ? ' kept in ' + tmp : ''}`);
process.exit(failed ? 1 : 0);
