// release 2 checks in the other modes, with the engine's own defaults
const { runBatch, show } = require('./sweep5b.js');
(async () => {
  for (const [tag, start, opts] of [['strict', 5000, { history: 'strict' }], ['dawn', 8000, { scenario: '0500' }], ['open', 6000, { history: 'open' }], ['dry', 7000, { scenario: 'dry' }]]) {
    const t0 = Date.now(); const r = await runBatch({}, 100, start, 2, opts);
    require('fs').writeFileSync(__dirname + `/r2_${tag}_100.json`, JSON.stringify(r));
    console.log(`== ${tag} 100`, ((Date.now() - t0) / 1000).toFixed(0) + 's'); show(r);
  }
})();
