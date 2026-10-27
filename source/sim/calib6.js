// 500 historical battles (seeds 1000-1499) and 100 strict (5000-5099) with a set of calibration values
const { runBatch, show } = require('./sweep5b.js');
const K = JSON.parse(process.argv[2] || '{}'), tag = process.argv[3] || 'c6';
(async () => {
  let t0 = Date.now();
  const res = await runBatch(K, 500, 1000);
  require('fs').writeFileSync(__dirname + `/calib_${tag}_500.json`, JSON.stringify(res));
  console.log('historical 500 done', ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(K)); show(res);
  t0 = Date.now();
  const st = await runBatch(K, 100, 5000, 2, { history: 'strict' });
  require('fs').writeFileSync(__dirname + `/strict_${tag}_100.json`, JSON.stringify(st));
  console.log('strict 100 done', ((Date.now() - t0) / 1000).toFixed(0) + 's'); show(st);
})();
