/* The in-band check (engine roadmap: from phase 2c on, Waterloo must stay inside its 1815 targets as special cases become general rules).
   Fights N battles with Napoleon's historical orders (seeds from 1000, the calibration seeds), saves them, and compares them with release 3
   (results/calib_r2_500.json: the sim was unchanged from release 2 to release 3) and with the targets.
     node tools/band.js [N=500] [name]      writes results/<name>.json (default band_<date>)
     node tools/band.js --show <file.json>  compares a saved batch
   The band (decided with Chris): allied victories 75-90% of battles, French victories under 5%, the rest mostly draws or marginal results;
   losses in their 1815 ranges (French 20,000-27,000 killed and wounded, Anglo-allied 13,000-17,000, Prussian 5,000-8,000: rules doc).
   Timings are shown against release 3 and history but are not pass/fail: they are the turning points to watch. */
'use strict';
const path = require('path'), fs = require('fs');
const SIM = path.join(__dirname, '..');
const { runBatch } = require(path.join(SIM, 'sweep5b.js'));
const BASE = path.join(SIM, 'results', 'calib_r2_500.json');

const pct = (a, q) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
const hm = t => t == null ? '  –  ' : String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.round(t % 60)).padStart(2, '0');
const k = n => n == null ? '–' : (n / 1000).toFixed(1) + 'k';
function grades(res) {
  const c = { allied: 0, marginalAllied: 0, draw: 0, marginalFrench: 0, french: 0 };
  for (const r of res) { const g = r.grade || ''; if (/^Marginal Allied/.test(g)) c.marginalAllied++; else if (/Allied victory|French catastrophe/.test(g)) c.allied++; else if (/^Marginal French/.test(g)) c.marginalFrench++; else if (/French victory/.test(g)) c.french++; else c.draw++; }
  for (const key of Object.keys(c)) c[key] = 100 * c[key] / res.length;
  return c;
}
function compare(res, base) {
  const out = [], line = s => { out.push(s); };
  const g = grades(res), gb = grades(base);
  line(`${res.length} battles (release 3: ${base.length})`);
  line(`result          now     release 3`);
  for (const [key, name] of [['allied', 'allied victory'], ['marginalAllied', 'marginal allied'], ['draw', 'draw'], ['marginalFrench', 'marginal French'], ['french', 'French victory']]) line(`${name.padEnd(16)}${g[key].toFixed(1).padStart(5)}%  ${gb[key].toFixed(1).padStart(6)}%`);
  line('');
  line(`killed & wounded   p10    p50    p90   | release 3 p50 | 1815`);
  const loss = [['fr', 'French', 20000, 27000], ['al', 'Anglo-allied', 13000, 17000], ['pr', 'Prussian', 5000, 8000]];
  for (const [key, name, lo, hi] of loss) line(`${name.padEnd(16)} ${k(pct(res.map(r => r[key]), .1)).padStart(6)} ${k(pct(res.map(r => r[key]), .5)).padStart(6)} ${k(pct(res.map(r => r[key]), .9)).padStart(6)}   | ${k(pct(base.map(r => r[key]), .5)).padStart(6)}        | ${k(lo)}-${k(hi)}`);
  line('');
  line(`turning point      p10    p50    p90   never | release 3 p50 | 1815`);
  for (const [key, name, hist] of [['lhs', 'La Haye Sainte', '≈18:30'], ['bulow', 'Bülow attacks', '≈16:30'], ['zieten', 'Zieten arrives', '≈19:00'], ['neyCav', 'Ney’s cavalry', '≈16:00'], ['plL', 'Plancenoit lost', '≈18:00'], ['guardRep', 'Guard repulsed', '≈19:45'], ['frBreak', 'French break', '≈20:00']]) {
    const v = res.map(r => r[key]), never = v.filter(x => x == null).length;
    line(`${name.padEnd(16)} ${hm(pct(v, .1))}  ${hm(pct(v, .5))}  ${hm(pct(v, .9))}  ${String(never).padStart(4)} |     ${hm(pct(base.map(r => r[key]), .5))}     | ${hist}`);
  }
  // the band
  const checks = [
    [`allied victories 75-90% (now ${g.allied.toFixed(1)}%)`, g.allied >= 75 && g.allied <= 90],
    [`French victories under 5% (now ${(g.french + g.marginalFrench).toFixed(1)}%)`, g.french + g.marginalFrench < 5],
    ...loss.map(([key, name, lo, hi]) => { const m = pct(res.map(r => r[key]), .5); return [`${name} losses (median ${k(m)}) within ${k(lo)}-${k(hi)}`, m >= lo && m <= hi]; }),
  ];
  line('');
  for (const [txt, ok] of checks) line(`${ok ? 'IN BAND ' : 'OUT     '} ${txt}`);
  line(checks.every(c => c[1]) ? 'VERDICT in band' : 'VERDICT out of band');
  return out.join('\n');
}
module.exports = { compare, grades };
if (require.main === module) {
  const args = process.argv.slice(2);
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  if (args[0] === '--show') { console.log(compare(JSON.parse(fs.readFileSync(args[1], 'utf8')), base)); return; }
  const N = +(args[0] || 500), name = args[1] || 'band_' + new Date().toISOString().slice(0, 10);
  (async () => {
    const t0 = Date.now(), res = await runBatch({}, N, 1000);
    res.sort((a, b) => a.seed - b.seed);
    const file = path.join(SIM, 'results', name + '.json'); fs.writeFileSync(file, JSON.stringify(res));
    console.log(`fought ${N} battles in ${((Date.now() - t0) / 60000).toFixed(1)} min; saved ${path.relative(SIM, file)}\n`);
    console.log(compare(res, base));
  })();
}
