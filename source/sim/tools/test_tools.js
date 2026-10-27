/* Self-tests for the phase 1 tools: the lint's tokenizer and the pack validator (does each catch what it should?).
     node tools/test_tools.js */
'use strict';
const path = require('path'), assert = require('assert');
const { literals } = require('./lint.js');
const P = require('../packs/all.js'), validate = require('../packs/validate.js');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

/* ----- tokenizer ----- */
const lit = s => literals(s).filter(t => t.kind !== 'id').map(t => t.kind + ':' + t.text);
ok(lit("a = 'x' + \"y\"").join() === 'str:x,str:y', 'strings');
ok(lit('// "not this"\n/* \'nor this\' */ b = 1').length === 0, 'comments are skipped');
ok(lit('c = a / b / 2; d = /gHoug|gLHS/.test(x)').join() === 're:gHoug|gLHS', 'a regex is told from a division');
ok(lit('t = `at ${name} and ${f(`in ${u.id}`)} end`').join() === "str:in  ,str:at   and   end", 'templates and nested templates');
ok(lit('f(W.PRUSSIANS, W.RAW, E.W.x, NW.y)').join() === 'key:PRUSSIANS,key:RAW,key:x', 'W.KEY reads (not NW.y)');
ok(lit('x = y\n/ 2 / z').length === 0, 'division across a line');
ok(lit("if (a) return /^g\\d/.test(id)").join() === 're:^g\\d', 'a regex after return');
ok(lit('let v = id').length === 0, 'an identifier at the end of the input');
ok(literals('const roundshot = canisterReach + x').filter(t => t.kind === 'id').map(t => t.text).join() === 'const,roundshot,canisterReach,x', 'identifiers are read (for era words)');

/* ----- validator: the shipped battle is clean; broken copies are caught ----- */
const clean = validate('waterloo'); ok(clean.errors.length === 0, 'waterloo validates: ' + clean.errors.join('; '));
const base = P.battles.waterloo;
const broken = (id, change, expect) => {
  const B = JSON.parse(JSON.stringify({ ...base, map: undefined })); B.map = { ...base.map }; change(B);
  P.register('battle', id, B); const r = validate(id); delete P.battles[id];
  ok(r.errors.some(e => expect.test(e)), `${id}: expected an error matching ${expect}, got: ${r.errors.join(' | ') || 'none'}`);
};
broken('t-era', B => { B.era = 'bronze'; }, /era "bronze"/);
broken('t-nation', B => { B.nations = B.nations.filter(x => x !== 'KGL'); }, /nation "KGL" is not in the battle's nations/);
broken('t-side', B => { B.sides = B.sides.map(s => ({ ...s, coalition: 'X' })); }, /same coalition/);
broken('t-light', B => { B.weather = { ...B.weather, vis: [[600, 3000], [500, 4000]] }; }, /run forward in time/);
broken('t-dup', B => { B.map.RAW = [...B.map.RAW, B.map.RAW[0]]; }, /used twice/);
broken('t-off', B => { const r = [...B.map.RAW[0]]; r[7] = 51.5; B.map.RAW = [r, ...B.map.RAW.slice(1)]; }, /km outside the map/);
broken('t-arm', B => { const r = [...B.map.RAW[0]]; r[5] = 'chariot'; B.map.RAW = [r, ...B.map.RAW.slice(1)]; }, /arm "chariot"/);
broken('t-leader', B => { B.leaders = [...B.leaders, { id: 'caesar', side: 'FR', at: [50.67, 4.41] }]; }, /no leader pack holds him/);
broken('t-lunit', B => { B.leaders = B.leaders.map(l => l.id === 'ney' ? { id: 'ney', side: 'FR', unit: 'nobody' } : l); }, /unit "nobody" does not exist/);
broken('t-route', B => { B.routeOf = { pirch: 'nowhere' }; }, /routeOf: corps pirch/);
broken('t-obj', B => { B.map.OBJECTIVES = { ...B.map.OBJECTIVES, bad: { name: 'x', sp: 'atlantis' } }; }, /strongpoint "atlantis"/);
broken('t-grid', B => { B.map.H = B.map.H.slice(0, 10); }, /height grid/);
// (phase 3c) plans and side objectives
const planEdit = f => B => { const pl = B.plans.historical; pl.rules = pl.rules.map(r => JSON.parse(JSON.stringify(r))); f(pl.rules); };
broken('t-plan-unit', planEdit(rs => { rs.find(r => r.id === 'hougoumont').spec.with = ['nobody']; }), /rule hougoumont: no unit "nobody"/);
broken('t-plan-place', planEdit(rs => { rs.find(r => r.id === 'lhs2').when = { place: 'atlantis', holder: 'ours' }; }), /place "atlantis" is not on the map/);
broken('t-plan-done', planEdit(rs => { rs.find(r => r.id === 'og').when = [{ done: 'ghost', since: 40 }]; }), /no rule "ghost"/);
broken('t-plan-cond', planEdit(rs => { rs.find(r => r.id === 'lhs2').when = { sunny: true }; }), /unknown condition/);
broken('t-feed', B => { B.sides = B.sides.map(s => s.id === 'AL' ? { ...s, feeds: [{ ...s.feeds[0], donors: ['nobody'] }] } : s); }, /feeds unit "nobody"/);
broken('t-call', B => { B.sides = B.sides.map(s => s.id === 'AL' ? { ...s, calls: [{ ...s.calls[0], force: 'atlantis' }] } : s); }, /calls force "atlantis"/);
broken('t-init', B => { B.sides = B.sides.map(s => s.id === 'FR' ? { ...s, initiative: { garrison: [{ ...s.initiative.garrison[0], leader: 'nobody' }], escalate: [] } } : s); }, /initiative leader "nobody"/);
broken('t-side-obj', B => { B.sides = B.sides.map(s => s.id === 'FR' ? { ...s, objectives: { atlantis: 2 } } : s); }, /objective "atlantis" is not on the map/);
// (3d) an arriving army's timetable and a detached force's march to the guns name things that must exist
const onSide = (B, id, f) => { B.sides = B.sides.map(s => s.id === id ? f(JSON.parse(JSON.stringify(s))) : s); };
broken('t-wait-road', B => onSide(B, 'PR', s => { s.waits[0].road = ['nowhere', 2]; return s; }), /waits road "nowhere"/);
broken('t-wait-rest', B => onSide(B, 'PR', s => { s.waits[0].attack.foot = [s.waits[0].attack.foot[0]]; return s; }), /must end with an entry for the rest/);
broken('t-follow', B => onSide(B, 'PR', s => { s.follows[0].after = 'nobody'; return s; }), /follows after "nobody"/);
broken('t-delay-key', B => onSide(B, 'PR', s => { s.delays.units[0].add.ghost = 1; return s; }), /add "ghost", which is not a draw/);
broken('t-divert', B => onSide(B, 'PR', s => { s.flanks[0].divert.to = 'nobody'; return s; }), /flanks divert leader "nobody"/);
broken('t-toguns', B => onSide(B, 'FR', s => { s.toGuns[0].force = 'nobody'; return s; }), /toGuns force "nobody"/);
// the toy battle's Green corps keeps its timetable under the generic commanders: it comes on late by its draws, halts out of sight,
// is released and attacks; without timetables (opts.timetables: false) it is the generic commander's
{ const En = require('../engine.js'), D = require('../doctrine.js');
  const E = En.create({ battle: 'toy-ridge', seed: 5, scenario: '1100' }), ai = D.make().init(E), st = ai.S.GR.timetable; // (seed 5: released at 15:30)
  ok(!!st && E.units.filter(u => u.side === 'GR').every(u => u.arriveAt !== u.baseArrive), 'timetable: the toy Green corps comes on by its draws');
  let hidden = false; while (!E.over && E.t < 17 * 60) { E.step(); if (E.units.some(u => u.side === 'GR' && u.onMap && u.task.wait && u.concealed === 0.3)) hidden = true; }
  ok(hidden && st.waits.green.release != null && st.waits.green.attack != null, 'timetable: Green halts out of sight, is released and attacks');
  const E2 = En.create({ battle: 'toy-ridge', seed: 2, scenario: '1100' }), ai2 = D.make({ timetables: false }).init(E2);
  ok(!ai2.S.GR.timetable && !E2.timedCorps && E2.units.filter(u => u.side === 'GR').every(u => u.arriveAt === u.baseArrive), 'timetable: off, Green is the generic commander\'s'); }
// plan conditions read the clock, places and flags (the truth, with no command layer)
{ const En = require('../engine.js'), Pl = require('../plans.js'); require('../ai.js');
  const E = En.create({ battle: 'toy-ridge', seed: 1 });
  const p = Pl.make(E, { side: 'RD', via: 'order', rules: [] }), t = c => p.test(c);
  ok(t({ after: '11:00' }) && !t({ after: '11:01' }) && t({ before: 661 }), 'plan: the clock');
  ok(t({ place: 'ferme', holder: 'enemy' }) && t({ place: 'ferme', holder: 'notOurs' }) && !t({ place: 'ferme', holder: 'ours' }), 'plan: who holds a place');
  ok(t({ any: [{ flag: 'nope' }, { not: { flag: 'nope' } }] }) && !t({ all: [{ after: 0 }, { metric: 'fermeFall' }] }), 'plan: any, all, not, flags and metrics');
  ok(t([{ morale: 'RD', below: 76 }]) && !t({ morale: 'RD', below: 75 }), 'plan: army morale');
  let threw = false; try { t({ sunny: 1 }); } catch (e) { threw = true; } ok(threw, 'plan: an unknown condition is an error, not false');
  // an 'order' plan sends its order when its rule holds, once
  const q = Pl.install(E, { id: 'x', side: 'RD', as: 'carmin', via: 'order', rules: [{ id: 'go', at: '11:04', order: { to: 'vermillon', kind: 'attack', obj: 'ferme', units: ['r1'], form: 'attack' } }] });
  while (E.t < 670) { E.plans.tick(E); E.step(); }
  ok(q.done.go === 664 && E.orders.filter(o => o.id === 'go').length === 1, 'plan: an order plan fires once, on time'); }
// (4d) orders of battle as CSV: Waterloo's goes out and comes back the same; every committed CSV is its pack's source
{ const O = require('./oob.js'), fs = require('fs'), W = P.battle('waterloo').W;
  const back = O.importRows(O.parseCSV(O.toCSV(O.exportRows(W))));
  ok(!back.errs.length, 'oob: Waterloo re-imports without errors: ' + back.errs.join('; '));
  for (const k of ['RAW', 'CORPS', 'DIVISION', 'QUALITY', 'CALIBRE', 'TRAITS', 'FORCES']) {
    const a = W[k], b = back.O[k], same = Array.isArray(a) ? JSON.stringify(a) === JSON.stringify(b) : Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(x => JSON.stringify(a[x]) === JSON.stringify(b[x]));
    ok(same, `oob: Waterloo's ${k} survives the round trip through CSV`); }
  ok(O.parseCSV('a,"b,""c"""\n1,2\n').join('|') === 'a,b,"c"|1,2', 'oob: CSV quotes');
  const bad = O.importRows(O.parseCSV('id,side,name,nation,arm,strength,lat,lon\nx,AL,X,GB,inf,0,50,4\nx,AL,Y,GB,inf,10,,\n'));
  ok(bad.errs.some(e => /strength "0"/.test(e)) && bad.errs.some(e => /used twice/.test(e)) && bad.errs.some(e => /lat and lon/.test(e)), 'oob: bad rows are named by line: ' + bad.errs.join('; '));
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'packs', 'oob')).filter(f => f.endsWith('.csv'))) {
    const id = f.slice(0, -4), r = O.importRows(O.parseCSV(fs.readFileSync(path.join(__dirname, '..', 'packs', 'oob', f), 'utf8')));
    ok(fs.readFileSync(path.join(__dirname, '..', 'packs', 'oob', id + '.js'), 'utf8') === O.packJS(id, r.O, 'packs/oob/' + f), `oob: packs/oob/${id}.js is made from ${f} (run node tools/oob.js import packs/oob/${f} ${id})`); } }
// (4e) a replay names the versions it was fought with; check() says what has changed since
{ const R = require('../replay.js'), r = R.record({ seed: 3, history: 'uncertain', scenario: '1100', staff: 'soult', silence: 0 }, []);
  ok(R.check(r).ok, 'replay: a fresh replay checks');
  ok(!R.check(Object.assign({}, r, { engine: '0.1' })).ok && R.check(Object.assign({}, r, { engine: '0.1' })).notes[0].includes('engine'), 'replay: another engine version is noted');
  ok(R.check(Object.assign({}, r, { fingerprint: '0' })).notes.some(x => /without a new version/.test(x)), 'replay: an edited pack with the same version is caught');
  ok(R.check({ kind: 'x' }).fatal, 'replay: not a replay'); }
// (4c) the map pipeline: the spline passes through its spots; a grid is read as it should be; every committed spec is its pack's source
{ const M = require('./map.js'), fs = require('fs');
  const pts = [[0, 0, 100], [1000, 0, 110], [0, 1000, 95], [1000, 1000, 120], [500, 500, 130], [250, 800, 104]], f = M.tps(pts, 0);
  ok(pts.every(p => Math.abs(f(p[0], p[1]) - p[2]) < 1e-6), 'map: the thin-plate spline passes through every spot height');
  const g = M.ascGrid('ncols 2\nnrows 2\nxllcorner 4.0\nyllcorner 50.0\ncellsize 0.01\nNODATA_value -9999\n10 20\n30 40\n');
  ok(Math.abs(g(50.01, 4.01) - 25) < 1e-9 && Math.abs(g(50.005, 4.005) - 30) < 1e-9 && Math.abs(g(50.015, 4.005) - 10) < 1e-9, 'map: an ESRI grid reads north row first, bilinear between cell centres');
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'packs', 'maps')).filter(f => f.endsWith('.map.json'))) {
    const r = M.build(path.join(__dirname, '..', 'packs', 'maps', f));
    ok(fs.existsSync(r.out) && fs.readFileSync(r.out, 'utf8') === r.js, `map: packs/maps/${r.id}.js is made from ${f} (run node tools/map.js build packs/maps/${f})`); }
  const T = P.terrain('toy-ridge'), [x, y] = T.ll2m(...T.m2ll(1234, 5678));
  ok(Math.abs(x - 1234) < 1e-6 && Math.abs(y - 5678) < 1e-6 && T.H.length === T.NX * T.NY, 'map: a terrain pack unpacks (heights, conversions)'); }
console.log(`tools: ${n} checks passed`);
// every bench case builds a battle pack that validates
{ const { benchBattle } = require('./bench.js'), fs = require('fs'), path = require('path');
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'bench')).filter(f => f.endsWith('.js'))) for (const c of require(path.join(__dirname, '..', 'bench', f)).filter(c => c && c.id)) {
    const r = validate(benchBattle(c)); assert(!r.errors.length, `bench ${c.id}: ${r.errors.join('; ')}`); n++; }
  console.log(`tools: bench packs validate (${n} checks in all)`); }
