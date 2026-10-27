const W = require('./data.js'), En = require('./engine.js'), AI = require('./ai.js'), Cmd = require('./command.js'), Ord = require('./orders.js'), Scr = require('./script.js');
function battle(seed, opts = {}) {
  const E = En.create(Object.assign({ seed }, opts));
  AI.make({ plan: 'script' }).init(E);
  Cmd.install(E, opts.command || {}); Ord.install(E);
  if (opts.script) opts.script(E); else Scr.historical(E);
  E.run();
  return E;
}
module.exports = { battle };
if (require.main === module) {
  const seed = +(process.argv[2] || 1);
  const t0 = Date.now(); const E = battle(seed);
  console.log('ran in', Date.now() - t0, 'ms; ended', E.fmtT(E.t), E.result && E.result.grade, E.result && E.result.why);
  console.log('metrics', Object.fromEntries(Object.entries(E.metrics).map(([k, v]) => [k, v == null ? null : E.fmtT(v)])));
  console.log('casualties', JSON.stringify(E.result && E.result.cas));
  const C = E.command;
  console.log('riders', C.riders.length, 'orders', E.orders.length, 'inbox', C.inbox.length);
  for (const m of C.inbox.slice(0, 60)) console.log(E.fmtT(m.t), '[' + m.kind + ']', m.title, '::', m.text.slice(0, 400));
}
