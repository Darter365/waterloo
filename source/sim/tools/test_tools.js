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
console.log(`tools: ${n} checks passed`);
// every bench case builds a battle pack that validates
{ const { benchBattle } = require('./bench.js'), fs = require('fs'), path = require('path');
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'bench')).filter(f => f.endsWith('.js'))) for (const c of require(path.join(__dirname, '..', 'bench', f)).filter(c => c && c.id)) {
    const r = validate(benchBattle(c)); assert(!r.errors.length, `bench ${c.id}: ${r.errors.join('; ')}`); n++; }
  console.log(`tools: bench packs validate (${n} checks in all)`); }
