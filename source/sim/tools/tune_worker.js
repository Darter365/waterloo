/* A worker for tools/tune.js: fights one battle's seeds with era constants changed (K), the way its targets say it is fought, and
   sends back what the targets are judged on: the result, every army's killed and wounded, the metrics. */
'use strict';
const path = require('path'), SIM = path.join(__dirname, '..');
process.on('message', ({ battle, seeds, K, runner }) => {
  const P = require(path.join(SIM, 'packs', 'all.js')), En = require(path.join(SIM, 'engine.js'));
  const out = [];
  for (const seed of seeds) {
    let E;
    if (runner === 'historical') { // the battle as recorded: its historical plan through the command layer (Waterloo: Napoleon's orders)
      const AI = require(path.join(SIM, 'ai.js')), Cmd = require(path.join(SIM, 'command.js')), Ord = require(path.join(SIM, 'orders.js')), Scr = require(path.join(SIM, 'script.js'));
      E = En.create({ battle, seed, K }); AI.make({ plan: 'script' }).init(E); Cmd.install(E, {}); Ord.install(E); Scr.historical(E);
    } else { // the generic commanders on every side
      E = En.create({ battle, seed, K }); require(path.join(SIM, 'doctrine.js')).make().init(E);
    }
    E.run();
    const r = E.result || {};
    out.push({ seed, grade: r.grade || 'unfinished', why: r.why, t: E.t, kw: Object.fromEntries(Object.entries(r.cas || {}).map(([s, c]) => [s, c.kw])), metrics: Object.assign({}, E.metrics) });
  }
  process.send(out, () => process.exit(0));
});
