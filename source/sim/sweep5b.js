const { fork } = require('child_process');
function runBatch(K, N, start = 1, procs = 2, opts = {}) {
  return new Promise(res => {
    const seeds = Array.from({ length: N }, (_, i) => start + i), chunks = Array.from({ length: procs }, (_, p) => seeds.filter((_, i) => i % procs === p));
    let got = [], done = 0;
    for (const c of chunks) { const w = fork(__dirname + '/worker5b.js'); w.on('message', m => { got = got.concat(m); if (++done === procs) res(got); }); w.send({ seeds: c, K, opts }); }
  });
}
const pct = (a, q) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
const T = t => t == null ? '  -  ' : String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.round(t % 60)).padStart(2, '0');
function show(res) {
  const n = res.length, inT = (k, lo, hi, nev) => Math.round(100 * res.filter(r => (r[k] != null && r[k] >= lo && r[k] <= hi) || (nev && r[k] == null)).length / n), nv = k => res.filter(r => r[k] == null).length;
  const line = (k, isT, lo, hi, nev) => console.log(k.padEnd(12), isT ? `${T(pct(res.map(r => r[k]), .1))} ${T(pct(res.map(r => r[k]), .5))} ${T(pct(res.map(r => r[k]), .9))}` : `${pct(res.map(r => r[k]), .1)} ${pct(res.map(r => r[k]), .5)} ${pct(res.map(r => r[k]), .9)}`, 'never', nv(k), lo != null ? 'inT ' + inT(k, lo, hi, nev) : '');
  line('lhs', 1, 1020, 1140); line('bulow', 1, 930, 1080); line('zieten', 1, 1110, 1200, 1); line('frBreak', 1); line('guardRep', 1); line('neyCav', 1); line('plL', 1);
  line('fr', 0, 20000, 27000); line('al', 0, 13000, 17000); line('pr', 0, 5000, 8000);
  line('eastSeen', 1); line('prisoner', 1); line('bulowNamed', 1); line('lhsKnown', 1); line('plKnown', 1); line('release', 1); line('wellEngagedAtBlucher', 1);
  const g = {}; for (const r of res) g[r.grade] = (g[r.grade] || 0) + 1; console.log(JSON.stringify(g));
  if (res[0] && res[0].mMin) for (const [i, k] of ['FR', 'AL', 'PR'].entries()) console.log('morale ' + k, 'min', pct(res.map(r => r.mMin[i]), .1), pct(res.map(r => r.mMin[i]), .5), pct(res.map(r => r.mMin[i]), .9), '18:00', pct(res.map(r => r.m18 && r.m18[i]), .1), pct(res.map(r => r.m18 && r.m18[i]), .5), pct(res.map(r => r.m18 && r.m18[i]), .9));
  { const c = { allied: 0, marginalAllied: 0, draw: 0, marginalFrench: 0, french: 0 }; for (const r of res) { const g = r.grade || ''; if (/^Marginal Allied/.test(g)) c.marginalAllied++; else if (/Allied victory|catastrophe/.test(g)) c.allied++; else if (/^Marginal French/.test(g)) c.marginalFrench++; else if (/French victory/.test(g)) c.french++; else c.draw++; } console.log('spread %', Object.entries(c).map(([k, v]) => k + ' ' + (100 * v / n).toFixed(1)).join(', ')); }
  const avg = k => (res.reduce((a, r) => a + (r[k] || 0), 0) / n).toFixed(1);
  console.log('houg', res.filter(r => r.houg != null).length, 'alBreak', res.filter(r => r.alBreak != null).length, 'alBroke', avg('alBroke'), 'reports', avg('reports'), 'summaries', avg('summaries'), 'decisions', avg('decisions'), 'ridersLost', avg('ridersLost'), 'ordersLost', avg('ordersLost'), 'misreads', avg('misreads'), 'advance', res.filter(r => r.advance).length);
}
module.exports = { runBatch, show };
if (require.main === module) {
  (async () => {
    const N = +(process.argv[2] || 40), grid = JSON.parse(process.argv[3] || '[{}]'), start = +(process.argv[4] || 1000);
    for (const K of grid) { const t0 = Date.now(); const r = await runBatch(K, N, start); console.log('== K', JSON.stringify(K), ((Date.now() - t0) / 1000).toFixed(0) + 's'); show(r); if (process.argv[5]) require('fs').writeFileSync(process.argv[5], JSON.stringify(r)); }
  })();
}
