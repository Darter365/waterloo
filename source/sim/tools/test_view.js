/* The contract's own tests (view.js): plain data, no dice, fog kept, events in order, causes walkable.
     node tools/test_view.js [battle=waterloo] [seed=1003] */
'use strict';
const path = require('path'), crypto = require('crypto');
const SIM = path.join(__dirname, '..');
const R = require(path.join(SIM, 'replay.js')), Scr = require(path.join(SIM, 'script.js')), View = require(path.join(SIM, 'view.js'));
const battle = process.argv[2] || 'waterloo', seed = +(process.argv[3] || 1003);
let passed = 0, failed = 0;
const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log('FAIL ' + what); } };
// the reference battles' hash (refset.js): every unit, army morale, every place, and the number of dice drawn
function stateHash(E) {
  const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
  const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
  const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0);
  return crypto.createHash('sha1').update(JSON.stringify([E.t, E.morale, units, places, dice])).digest('hex').slice(0, 16);
}
const make = () => { const E = R.setup({ battle, seed, history: 'uncertain' }); Scr.historical(E, {}); return E; };

// 1. a battle never watched
const A = make(), hashesA = []; while (!A.over) { A.step(); if (A.t % 30 === 0) hashesA.push(stateHash(A)); } hashesA.push(stateHash(A));

// 2. the same battle, watched through the contract every tick
const B = make(), V = View.install(B), hashesB = []; V.watch('chief'); V.watch('truth');
const world = V.world();
ok(JSON.stringify(JSON.parse(JSON.stringify(world))) === JSON.stringify(world), 'the world is plain data');
ok(world.grid.heights.length === world.grid.nx * world.grid.ny, 'the height grid is whole');
// arms and formations as capabilities: every arm and formation a body on the field has is described, and matches the era pack
{ const era = B.era, T0 = V.snapshot('truth'), armsSeen = new Set(T0.units.map(u => u.arm)), formsSeen = new Set(T0.units.map(u => u.form));
  ok([...armsSeen].every(a => world.arms[a] && typeof world.arms[a].mounted === 'boolean' && typeof world.arms[a].crew === 'number'), `every arm on the field is described to a client (${[...armsSeen].join(', ')})`);
  ok(Object.entries(world.arms).every(([id, a]) => a.mounted === !!era.arms[id].charges && a.crew === (era.arms[id].crew || 0)), 'an arm rides or serves pieces as the era pack says');
  ok([...formsSeen].every(f => world.formations[f] || world.formationElse), `every formation on the field is described (${[...formsSeen].join(', ')})`);
  ok(Object.entries(world.formations).every(([id, f]) => f.allRound === !!era.formations[id].allRound && f.column === !!era.formations[id].column && f.fire === (era.formations[id].fire ?? null)), 'a formation faces all round, marches or fires as the era pack says'); }
let lastC = 0, lastT = 0, nC = 0, nT = 0, leak = 0, keyLeak = 0, posOnUnseen = 0, extraOnUnseen = 0, order = 0, subTick = 0, staleShown = 0, enemySeen = 0, ownFromBelief = 0, ownChecked = 0, kinds = {}, heardOnly = 0, moved = 0, tampered = 0;
// the values the loop's measures read (tools/loop.js): orders, the staff's estimate, starred dispatches, the keys beside the truth
let diceSeen = 0, diceTampered = 0, ordKnows = 0, ordShape = 0, ordSeen = 0, expSeen = 0, starShape = 0, stars = 0, keyWrong = 0, keyOwn = 0, keysMatched = 0, truthOrd = 0, truthOrdBad = 0;
function checkOrders(S) {
  for (const o of S.orders) { ordSeen++;
    if (SECRET.some(k => k in o)) ordKnows++;                              // when it truly arrived and was acted on is the umpire's to know
    if (!(o.objective === null || (num(o.objective.x) && num(o.objective.y))) || !Number.isInteger(o.conditions)) ordShape++;
    if (o.expect !== null) { expSeen++; if (!pair(o.expect.arrive) || !(o.expect.act === null || pair(o.expect.act)) || o.expect.arrive[0] < o.issuedAt) ordShape++; } }
}
const SECRET = ['receivedAt', 'actedAt', 'sentAt', 'status', 'misread'], num = v => typeof v === 'number' && isFinite(v), pair = a => Array.isArray(a) && a.length === 2 && num(a[0]) && num(a[1]) && a[0] <= a[1];
const side = B.command.side, chiefId = B.command.X.chief, Bel = B.command.B[chiefId];
while (!B.over) {
  B.step();
  if (B.t % 30 === 0) hashesB.push(stateHash(B));
  const S = V.snapshot('chief'), T = B.tick % 15 === 0 ? V.snapshot('truth') : null, js = JSON.stringify(S);
  if (B.tick % 15 === 0) {
    ok(JSON.stringify(JSON.parse(js)) === js, `chief snapshot is plain data at ${S.clock}`);
    ok(JSON.stringify(JSON.parse(JSON.stringify(T))) === JSON.stringify(T), `truth snapshot is plain data at ${S.clock}`);
  }
  // fog: every enemy shown is a belief record, at the believed place; nothing else of the enemy is in the snapshot
  ok(S.enemy.length === Bel.c.size, `enemy bodies shown (${S.enemy.length}) are exactly the commander's contacts (${Bel.c.size}) at ${S.clock}`);
  for (const u of B.units) {
    if (B.coalition[u.side] === B.coalition[side] || !u.onMap || u.gone) continue;
    const rec = Bel.c.get(u.id);
    if (js.includes('"' + u.id + '"')) keyLeak++;                       // an enemy unit's real id must never appear
    if (rec) { enemySeen++; if (Math.hypot(rec.x - u.x, rec.y - u.y) > 50) staleShown++; }
  }
  const believed = new Set([...Bel.c.values()].map(r => Math.round(r.x * 10) / 10 + ',' + Math.round(r.y * 10) / 10));
  for (const e of S.enemy) if (!believed.has(e.x + ',' + e.y)) leak++;      // every enemy body shown stands at a believed place
  if (B.tick % 15 === 0) {                                                  // move, double and restore every unseen enemy unit: the picture must not change
    const unseen = B.units.filter(u => B.coalition[u.side] !== B.coalition[side] && !Bel.c.get(u.id)), keep = unseen.map(u => [u.x, u.y, u.str, u.status]);
    for (const u of unseen) { u.x += 1234; u.y -= 777; u.str *= 2; u.status = 'broken'; }
    if (JSON.stringify(V.snapshot('chief')) !== js) moved++;
    unseen.forEach((u, i) => { [u.x, u.y, u.str, u.status] = keep[i]; }); tampered += unseen.length;
    // the staff's estimate must not know the dice already drawn for an order, nor where his own brigades really are: shift every
    // order's writing, sending and acting minute and every one of his units, and the picture must not change (then put them back)
    const os = B.command.orders.filter(o => o.sentAt != null), mine = B.units.filter(u => B.coalition[u.side] === B.coalition[side]);
    const keepO = os.map(o => [o.writtenAt, o.sentAt, o.actAt]), keepU = mine.map(u => [u.x, u.y]);
    for (const o of os) { o.writtenAt += 17; o.sentAt += 17; if (o.actAt != null) o.actAt += 17; } for (const u of mine) { u.x += 900; u.y -= 600; }
    if (JSON.stringify(V.snapshot('chief')) !== js) diceSeen++;
    os.forEach((o, i) => { [o.writtenAt, o.sentAt, o.actAt] = keepO[i]; }); mine.forEach((u, i) => { [u.x, u.y] = keepU[i]; }); diceTampered += os.length;
  }
  checkOrders(S);
  for (const d of S.dispatches) if (typeof d.starred !== 'boolean') starShape++;
  if (T) {
    const shown = new Map(S.enemy.map(e => [e.key, e]));
    for (const u of T.units) { if (u.key == null) continue;
      if (B.coalition[u.side] === B.coalition[side]) keyOwn++;
      const e = shown.get(u.key), rec = Bel.c.get(u.id); if (!e) continue;                 // a key outlives a contact that has been dropped
      keysMatched++; if (!rec || Math.abs(e.x - rec.x) > 0.06 || Math.abs(e.y - rec.y) > 0.06) keyWrong++; }
    truthOrd = T.orders.length;
    for (const o of T.orders) if (!num(o.issuedAt) || (o.receivedAt != null && o.receivedAt < o.issuedAt) || (o.actedAt != null && o.receivedAt != null && o.actedAt < o.receivedAt) || typeof o.status !== 'string') truthOrdBad++;
  }
  for (const o of S.own) { const rec = Bel.own.get(o.id); ownChecked++; if (rec && Math.abs(o.x - rec.x) < 0.06 && Math.abs(o.y - rec.y) < 0.06) ownFromBelief++; }
  const ec = V.drain('chief', lastC), et = V.drain('truth', lastT);
  for (const e of ec) { if (e.seq <= lastC) order++; lastC = e.seq; nC++; kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    if (e.kind === 'dispatch') { if (typeof e.starred !== 'boolean') starShape++; else if (e.starred) stars++; continue; }
    if (!e.seen && (e.x != null || e.y != null)) posOnUnseen++;
    if (!e.seen && (e.side != null || e.size != null || e.place != null)) extraOnUnseen++;
    if (e.unit != null || e.text != null) extraOnUnseen++;
    if (!e.seen) heardOnly++; }
  for (const e of et) { if (e.seq <= lastT) order++; lastT = e.seq; nT++; if (e.t < B.t - 2 - 1e-9 || e.t > B.t + 1e-9) subTick++; }
}
hashesB.push(stateHash(B));
ok(hashesA.length === hashesB.length && hashesA.every((h, i) => h === hashesB[i]), `watching changes nothing: ${hashesA.length} state hashes identical`);
ok(A.result.grade === B.result.grade && A.t === B.t, 'the watched battle ends the same way at the same minute');
ok(leak === 0, `every enemy body shown stands where the commander believes it (${leak} that do not)`);
ok(tampered > 0 && moved === 0, `moving and doubling every unseen enemy unit never changes the chief's snapshot (${tampered} units tampered with)`);
ok(keyLeak === 0, `no enemy unit's real id in any chief snapshot (${keyLeak})`);
ok(enemySeen > 0 && staleShown > 0, `the enemy is drawn where believed, not where he is (${staleShown} of ${enemySeen} sightings over 50 m out)`);
ok(ownChecked > 0 && ownFromBelief === ownChecked, `own brigades are drawn from reports (${ownFromBelief} of ${ownChecked})`);
ok(posOnUnseen === 0, `no position on an event the commander could not see (${posOnUnseen})`);
ok(extraOnUnseen === 0, `no side, size, unit or text on a chief event that should not carry it (${extraOnUnseen})`);
ok(order === 0, 'event sequence numbers only rise');
ok(subTick === 0, `every event is timed inside its own tick (${subTick} outside)`);
ok(nT > 1000 && nC > 100 && nC < nT, `the commander perceives part of what happens (${nC} of ${nT} events; ${heardOnly} only heard)`);
ok(kinds.dispatch > 10 && kinds.cannon > 0, `the chief's stream carries dispatches and gunfire (${JSON.stringify(kinds)})`);

// what the loop's measures read. A battle whose historical orders go straight to the engine (Ligny's) shows the commander no orders
// of his own, so the order values are checked there on three hours of the pack's first plan given through the order builder
let actedSeen = 0;
if (!ordSeen) { const pack = require(path.join(SIM, 'packs', 'all.js')).battle(battle).battle, plan = Object.keys(pack.strategies || {}).find(k => k !== 'expect');
  if (plan) { const E2 = R.setup({ battle, seed, history: 'uncertain' }), V2 = View.install(E2), until = E2.t + 180;
    for (const spec of pack.strategies[plan].orders) E2.command.order(JSON.parse(JSON.stringify(spec)));
    while (!E2.over && E2.t < until) { E2.step(); checkOrders(V2.snapshot('chief')); }
    const T2 = V2.snapshot('truth'); actedSeen = T2.orders.filter(o => o.actedAt != null).length;
    for (const o of T2.orders) if (!num(o.issuedAt) || (o.receivedAt != null && o.receivedAt < o.issuedAt) || (o.actedAt != null && o.receivedAt != null && o.actedAt < o.receivedAt)) truthOrdBad++; } }
ok(diceSeen === 0 && (diceTampered > 0 || !B.command.orders.length), `shifting the minutes already rolled for every order, and every one of his own units, never changes the chief's snapshot (${diceTampered} orders tampered with)`);
ok(ordSeen > 0 && ordKnows === 0, `the commander's orders never carry when they truly arrived or were acted on (${ordKnows} of ${ordSeen})`);
ok(ordShape === 0 && expSeen > 0, `every order shown has an objective or none, a count of conditions and a well-formed estimate (${expSeen} estimates, ${ordShape} malformed)`);
ok(starShape === 0 && stars === B.command.inbox.filter(m => m.decision).length, `every dispatch says whether the staff starred it, and the stream stars the same ones (${stars})`);
{ const T = V.snapshot('truth'), all = B.command.orders;
  ok(T.orders.length === all.length && truthOrdBad === 0, `the truth lists every order with its real times in order (${T.orders.length} orders)`);
  ok(T.orders.filter(o => o.actedAt != null).length === all.filter(o => o.actedAt != null).length && (actedSeen > 0 || T.orders.some(o => o.actedAt != null)), 'the truth says which orders were acted on'); }
ok(keysMatched > 0 && keyWrong === 0 && keyOwn === 0, `a key beside a true unit is the key of the commander's contact for that unit, and only the enemy has one (${keysMatched} matched)`);

// the light: the sun's height by the contract's own formula agrees with the engine's, and its bearing swings east to west through south
{ const L = B.light; let worst = 0; for (let t = 300; t <= 1260; t += 30) worst = Math.max(worst, Math.abs(View.sunPos(L.date, L.lat, L.lon, t).alt - L.sunAt(t)));
  ok(worst < 0.05, `the sun's height agrees with the engine's to ${worst.toFixed(3)} degrees`);
  const az = t => View.sunPos(L.date, L.lat, L.lon, t).az; ok(az(480) > 60 && az(480) < 120 && Math.abs(az(720) - 180) < 12 && az(1080) > 250 && az(1080) < 300, `the sun bears east at 08:00, south at noon, west at 18:00 (${Math.round(az(480))}, ${Math.round(az(720))}, ${Math.round(az(1080))})`);
  const S = V.snapshot('truth'); ok(typeof S.light.bearing === 'number' && typeof S.light.damp === 'boolean' && S.light.seeing > 0, 'a snapshot carries the sun\'s bearing, the damp and the seeing'); }

// the commander's place and glass: where he stands is his leader's true place (he knows where he is), and his telescope is the packs'
// (his own power, else the era's), with the true field that follows from the power and the eyepiece's circle
{ const S = V.snapshot('chief'), L = B.leaders[chiefId], P = require(path.join(SIM, 'packs', 'all.js')), person = P.leader(chiefId) || {}, era = P.era(P.battles[battle].era);
  ok(S.at && Math.abs(S.at.x - L.x) < 0.06 && Math.abs(S.at.y - L.y) < 0.06, 'the chief snapshot says where the commander stands');
  const want = person.glass ? person.glass.power : era.glass.power;
  ok(S.glass && S.glass.power === want && S.glass.apparent === era.glass.apparent, `the chief snapshot carries the commander's glass from the packs (${S.glass && S.glass.power} times)`);
  ok(S.glass && Math.abs(Math.tan(S.glass.field * Math.PI / 360) * S.glass.power - Math.tan(S.glass.apparent * Math.PI / 360)) < 2e-4, `the glass's true field follows from its power and its eyepiece (${S.glass && S.glass.field} degrees)`);
  ok(V.snapshot('truth').glass === undefined, 'the truth snapshot carries no glass: it is nobody\'s eye'); }

// 3. causes
const breaks = B.log.filter(l => l.cat === 'break' && l.cause != null), chains = breaks.map(l => V.why(l));
ok(breaks.length > 0 && chains.every(c => c.length >= 1), `every break has a cause (${breaks.length})`);
ok(chains.every(c => c.every((x, i) => i === 0 || x.t <= c[0].t)), 'no cause is later than its effect');
ok(chains.some(c => c.length >= 2), `chains link an effect to what caused it (longest ${Math.max(...chains.map(c => c.length))})`);
const ls = breaks.map(l => V.losses(l.unit, l.t)); ok(ls.some(x => x.men > 50 && x.by.length && x.by[0].from), `fire losses before a break are traced to the firers (${ls.filter(x => x.men > 50).length} of ${breaks.length} breaks)`);
ok(ls.every(x => x.by.reduce((a, b) => a + b.men, 0) <= x.men + 4), 'the firers named never account for more than was lost');
ok(V.why({}).length === 0 && V.why(1e9).length === 0, 'an entry without a cause gives an empty chain');

console.log(`view: ${passed} checks passed${failed ? ', ' + failed + ' FAILED' : ''} (${battle}, seed ${seed})`);
if (process.argv.includes('--show')) for (const l of breaks.filter(l => l.important).slice(0, 3)) { console.log(B.fmtT(l.t), l.text); for (const x of V.why(l)) console.log('   ' + '  '.repeat(x.depth) + B.fmtT(x.t) + ' ' + x.text); console.log('   fire:', JSON.stringify(V.losses(l.unit, l.t))); }
process.exit(failed ? 1 : 0);
