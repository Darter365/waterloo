/* Turns a gate's printed output into pass or fail, for GitHub Actions (.github/workflows/gates.yml and nightly.yml).
   Several gates print their result for a reader and exit 0 whatever happened: refset.js prints "DIVERGED" and exits 0, regress.sh
   keeps only the lines it greps for, the UI audit prints its counts, band.js prints its verdict, the fuzz writes its findings to
   files. A machine needs an exit code. This tool reads what the gate printed and changes nothing about the gate itself: the rules
   below are the ones a person reading the same output would apply. It draws no dice and loads nothing from the simulation.
     node tools/ci_verdict.js refs <log> <battles>   every "checked N ... battles" line has 0 diverged, and the Ns add up to <battles>
     node tools/ci_verdict.js regress <log>          every section of regress.sh reported, no console error, no BAD, no failed check
     node tools/ci_verdict.js uiaudit <log>          four layouts, each with 0 findings and 0 console errors
     node tools/ci_verdict.js offline <log>          service worker active, no external request, played offline, check passed
     node tools/ci_verdict.js band <log> <battles>   <battles> fought and "VERDICT in band"
     node tools/ci_verdict.js fuzz <log>             every file fuzz.sh writes is there, with no finding and no determinism failure
     node tools/ci_verdict.js selftest               the rules above against good and bad samples
   Exit 0 when the gate passed, 1 with the reasons when it did not. */
'use strict';
const fs = require('fs'), path = require('path');
const SIM = path.join(__dirname, '..');
const lines = s => s.split(/\r?\n/);

// refset.js check: one summary line per file, and a DIVERGED or RESULT line per battle that differs
function refs(log, want) {
  const why = [], sums = lines(log).map(l => l.match(/^checked (\d+) (\w+) battles: (\d+) identical, (\d+) diverged$/)).filter(Boolean);
  const total = sums.reduce((a, m) => a + +m[1], 0);
  for (const m of sums) if (+m[4] !== 0 || +m[3] !== +m[1]) why.push(`${m[2]}: ${m[4]} of ${m[1]} diverged`);
  for (const l of lines(log)) if (/^(DIVERGED|RESULT) /.test(l)) why.push(l.slice(0, 160));
  if (total !== want) why.push(`${total} reference battles checked, expected ${want} (a replay that crashes prints no summary line)`);
  return why;
}

// regress.sh: the section names are read from the script, so a test added there is expected here without a second list
function sections(script) { return [...script.matchAll(/^echo "### ([^"]+)"/gm)].map(m => m[1]); }
function regress(log, script) {
  const why = [], want = sections(script), got = new Map(); let cur = null;
  for (const l of lines(log)) {
    const h = l.match(/^### (.+)$/);
    if (h) { cur = h[1]; got.set(cur, []); } else if (cur) got.get(cur).push(l);
  }
  for (const name of want) {
    if (!got.has(name)) { why.push(`section "${name}" is missing`); continue; }
    if (name === 'done') continue;
    const body = got.get(name), errs = body.filter(l => /^\s*errors\b/i.test(l));
    // every test ends by printing the page's console errors; a test that crashed prints no such line, because regress.sh filters the traceback out
    if (!errs.length) why.push(`section "${name}" printed no errors line: the test did not finish`);
    for (const l of errs) if (!/\[\]\s*$/.test(l)) why.push(`section "${name}": ${l.trim().slice(0, 200)}`);
    for (const l of body) {
      if (/(^|\s)BAD(\s|$)/.test(l)) why.push(`section "${name}": ${l.slice(0, 200)}`);
      if (/did not come out exactly/.test(l)) why.push(`section "${name}": the replay check failed: ${l.slice(0, 160)}`);
      if (/^CHECK\b.*\bFalse\b/.test(l)) why.push(`section "${name}": ${l.slice(0, 240)}`);
    }
  }
  return why;
}

// tests/uiaudit.py: one line per layout
function uiaudit(log) {
  const why = [], rows = lines(log).map(l => l.match(/^(\d+(?: dark)?) (\d+) distinct findings, (\d+) console errors$/)).filter(Boolean);
  for (const key of ['1440', '1440 dark', '390', '390 dark']) {
    const m = rows.find(r => r[1] === key);
    if (!m) why.push(`layout ${key} did not report`);
    else if (+m[2] || +m[3]) why.push(`layout ${key}: ${m[2]} findings, ${m[3]} console errors (see uiaudit.json)`);
  }
  return why;
}

// offline/offtest.py
function offline(log) {
  const why = [], has = re => lines(log).some(l => re.test(l));
  if (!has(/^service worker active True \| external requests \[\]$/)) why.push('service worker not active, or the page made an external request');
  if (!has(/^offline reload title .+\| setup visible True$/)) why.push('the page did not reload offline');
  if (!has(/^offline AAR: All \d+ re-runs done\. \| Check passed/)) why.push('the battle played offline did not finish its report with the check passed');
  if (!has(/^errors \[\]$/)) why.push('console errors, or the test did not finish');
  return why;
}

// tools/band.js
function band(log, want) {
  const why = [], f = log.match(/^fought (\d+) battles/m);
  if (!f || +f[1] !== want) why.push(`expected ${want} battles fought, the log says ${f ? f[1] : 'none'}`);
  if (/^VERDICT out of band$/m.test(log)) for (const l of lines(log)) if (/^OUT /.test(l)) why.push(l.replace(/\s+/g, ' '));
  if (!/^VERDICT in band$/m.test(log)) why.push('no "VERDICT in band" line');
  return why;
}

// fuzz.sh: invariants.js writes one JSON file per run; the names are read from the script
function fuzzFiles(script) { return [...script.matchAll(/>\s*(f\d+_\w+\.json)/g)].map(m => m[1]); }
function fuzz(log, script, read) {
  const why = []; let battles = 0, found = 0;
  if (!/^FUZZDONE$/m.test(log)) why.push('fuzz.sh did not print FUZZDONE');
  for (const f of fuzzFiles(script)) {
    let r; try { r = JSON.parse(read(f)); } catch (e) { why.push(`${f} is missing or not JSON: that run crashed`); continue; }
    battles += r.n; found += r.findings.length;
    const kinds = {}; for (const x of r.findings) { const k = String(x.what).replace(/-?\d+(\.\d+)?/g, '#').slice(0, 100); kinds[k] = (kinds[k] || 0) + 1; }
    for (const [k, n] of Object.entries(kinds)) why.push(`${f} (${r.mode}, ${r.scen}): ${n} × ${k}`);
    if (r.determinism.failed.length) why.push(`${f}: seeds ${r.determinism.failed.join(', ')} did not replay identically`);
  }
  return { why, battles, found };
}

function selftest() {
  let n = 0, bad = 0; const ok = (c, what) => { n++; if (!c) { bad++; console.log('FAILED ' + what); } };
  const r4 = 'checked 60 hist battles: 60 identical, 0 diverged\nchecked 30 chaos battles: 30 identical, 0 diverged\nchecked 15 dawn battles: 15 identical, 0 diverged\nchecked 15 dry battles: 15 identical, 0 diverged\n';
  ok(!refs(r4, 120).length, 'refs: 120 identical pass');
  ok(refs(r4, 11).length === 1, 'refs: the wrong total fails');
  ok(refs(r4.replace('60 identical, 0', '59 identical, 1') + 'DIVERGED hist seed 7 at 13:30\n', 120).length === 2, 'refs: a divergence fails and is named');
  ok(refs(r4.split('\n').slice(1).join('\n'), 120).length === 1, 'refs: a missing summary line fails');
  const sh = 'echo "### a"; x\necho "### b"; y\necho "### done"\n', good = '### a\nVERDICT Draw\nerrors []\n### b\nCHECK glide: True\n  errors []\nERRORS []\n### done\n';
  ok(sections(sh).join() === 'a,b,done', 'regress: sections read from the script');
  ok(!regress(good, sh).length, 'regress: a clean log passes');
  ok(regress(good.replace('### b\n', ''), sh).length >= 1, 'regress: a missing section fails');
  ok(regress(good.replace('errors []\n### b', '### b'), sh).length === 1, 'regress: a section with no errors line fails');
  ok(regress(good.replace('ERRORS []', "ERRORS ['TypeError: x']"), sh).length === 1, 'regress: a console error fails');
  ok(regress(good.replace('VERDICT Draw', 'OPEN BAD {}'), sh).length === 1, 'regress: BAD fails');
  ok(regress(good.replace('glide: True', 'glide: False'), sh).length === 1, 'regress: a False check fails');
  ok(regress(good.replace('VERDICT Draw', 'CHECK Fought again from your orders with nothing changed, the battle did not come out exactly as you fought it'), sh).length === 1, 'regress: a failed replay check fails');
  ok(regress(good.replace('### done\n', ''), sh).length === 1, 'regress: an unfinished run fails');
  const ua = '1440 0 distinct findings, 0 console errors\n1440 dark 0 distinct findings, 0 console errors\n390 0 distinct findings, 0 console errors\n390 dark 0 distinct findings, 0 console errors\n';
  ok(!uiaudit(ua).length, 'uiaudit: clean passes');
  ok(uiaudit(ua.replace('390 dark 0 distinct', '390 dark 2 distinct')).length === 1, 'uiaudit: a finding fails');
  ok(uiaudit(ua.split('\n').slice(0, 3).join('\n')).length === 1, 'uiaudit: a missing layout fails');
  const off = 'service worker active True | external requests []\nfonts loaded []\noffline reload title Napoleon | setup visible True\noffline AAR: All 3 re-runs done. | Check passed: fought again\nerrors []\n';
  ok(!offline(off).length, 'offline: clean passes');
  ok(offline(off.replace('requests []', "requests ['https://example.org/x']")).length === 1, 'offline: an external request fails');
  ok(offline(off.replace('errors []', "errors ['x']")).length === 1, 'offline: a console error fails');
  ok(offline('').length === 4, 'offline: an empty log fails');
  const bd = 'fought 500 battles in 9.0 min; saved results/x.json\n\nIN BAND  allied victories 75-90% (now 80.0%)\nVERDICT in band\n';
  ok(!band(bd, 500).length, 'band: in band passes');
  ok(band(bd, 100).length === 1, 'band: the wrong number of battles fails');
  ok(band(bd.replace('IN BAND ', 'OUT     ').replace('VERDICT in band', 'VERDICT out of band'), 500).length === 2, 'band: out of band fails and names the check');
  ok(band('', 500).length === 2, 'band: an empty log fails');
  const fsh = '( node invariants.js chaos 1 2 1100 > f4_a.json ) &\n( node invariants.js hist 3 4 0500 > f4_b.json ) &\nwait; echo FUZZDONE\n';
  const fz = (findings, failed) => JSON.stringify({ mode: 'chaos', scen: '1100', n: 2, findings, determinism: { checked: 1, failed } });
  ok(fuzzFiles(fsh).join() === 'f4_a.json,f4_b.json', 'fuzz: file names read from the script');
  ok(!fuzz('FUZZDONE\n', fsh, () => fz([], [])).why.length && fuzz('FUZZDONE\n', fsh, () => fz([], [])).battles === 4, 'fuzz: clean passes and counts battles');
  ok(fuzz('FUZZDONE\n', fsh, f => f === 'f4_a.json' ? fz([{ what: 'unit 12 off the map', seed: 1 }], []) : fz([], [])).why.length === 1, 'fuzz: a finding fails');
  ok(fuzz('FUZZDONE\n', fsh, () => fz([], [5])).why.length === 2, 'fuzz: a determinism failure fails');
  ok(fuzz('FUZZDONE\n', fsh, f => f === 'f4_a.json' ? '' : fz([], [])).why.length === 1, 'fuzz: an empty file fails');
  ok(fuzz('', fsh, () => fz([], [])).why.length === 1, 'fuzz: an unfinished run fails');
  console.log(bad ? `ci_verdict: ${bad} of ${n} self-checks failed` : `ci_verdict: ${n} self-checks passed`);
  return bad;
}

if (require.main === module) {
  const [mode, file, arg] = process.argv.slice(2);
  if (mode === 'selftest') process.exit(selftest() ? 1 : 0);
  const fn = { refs, regress, uiaudit, offline, band, fuzz }[mode];
  if (!fn || !file) { console.log('usage: node tools/ci_verdict.js refs|regress|uiaudit|offline|band|fuzz <log> [battles]   or   selftest'); process.exit(1); }
  const log = fs.readFileSync(file, 'utf8'); let why, note = '';
  if (mode === 'refs' || mode === 'band') { if (!(+arg > 0)) { console.log(`${mode} needs the number of battles expected`); process.exit(1); } why = fn(log, +arg); note = ` (${arg} battles)`; }
  else if (mode === 'regress') why = regress(log, fs.readFileSync(path.join(SIM, 'regress.sh'), 'utf8'));
  else if (mode === 'fuzz') { const r = fuzz(log, fs.readFileSync(path.join(SIM, 'fuzz.sh'), 'utf8'), f => fs.readFileSync(path.join(SIM, f), 'utf8')); why = r.why; note = ` (${r.battles} battles, ${r.found} findings)`; }
  else why = fn(log);
  console.log(why.length ? `GATE FAILED ${mode}${note}\n  ` + why.join('\n  ') : `GATE PASSED ${mode}${note}`);
  process.exit(why.length ? 1 : 0);
}
module.exports = { refs, regress, uiaudit, offline, band, fuzz, sections, fuzzFiles, selftest };
