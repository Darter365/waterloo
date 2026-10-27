/* Nation pack: the armies of 1815. Drill and organisation that differ by army, not by battle.
   ranks: men deep in line (British and KGL two, others three); battalion: men in a battalion for counting battalions in a brigade (est.).
   (phase 2) gunCalibre: the field gun a battery has when the battle does not say (British 9-pounders, others 6); form: the formation its foot
   return to after square (Wellington's army stood in two lines); lieDown: its foot lie down behind a crest under bombardment when told to
   hold there (Wellington's practice, followed by his whole army). */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
P.register('nation', 'napoleonic', { version: '1.0',
  era: 'napoleonic',
  nations: {
    FR: { name: 'French', ranks: 3, battalion: 520, form: 'columns' },
    GB: { name: 'British', ranks: 2, battalion: 560, gunCalibre: 9, form: 'twoLines', lieDown: true },
    KGL: { name: "King's German Legion", ranks: 2, battalion: 560, form: 'twoLines', lieDown: true },
    HAN: { name: 'Hanoverian', ranks: 3, battalion: 560, form: 'twoLines', lieDown: true },
    NL: { name: 'Netherlands', ranks: 3, battalion: 560, form: 'twoLines', lieDown: true },
    NAS: { name: 'Nassau', ranks: 3, battalion: 560, form: 'twoLines', lieDown: true },
    BRU: { name: 'Brunswick', ranks: 3, battalion: 560, form: 'twoLines', lieDown: true },
    MIX: { name: 'Mixed', ranks: 3, battalion: 560, form: 'twoLines', lieDown: true },
    PR: { name: 'Prussian', ranks: 3, battalion: 700, form: 'columns' },
  },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
