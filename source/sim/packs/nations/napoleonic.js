/* Nation pack: the armies of 1815. Drill and organisation that differ by army, not by battle.
   ranks: men deep in line (British and KGL two, others three); battalion: men in a battalion for counting battalions in a brigade (est.). */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
P.register('nation', 'napoleonic', {
  nations: {
    FR: { name: 'French', ranks: 3, battalion: 520 },
    GB: { name: 'British', ranks: 2, battalion: 560 },
    KGL: { name: "King's German Legion", ranks: 2, battalion: 560 },
    HAN: { name: 'Hanoverian', ranks: 3, battalion: 560 },
    NL: { name: 'Netherlands', ranks: 3, battalion: 560 },
    NAS: { name: 'Nassau', ranks: 3, battalion: 560 },
    BRU: { name: 'Brunswick', ranks: 3, battalion: 560 },
    MIX: { name: 'Mixed', ranks: 3, battalion: 560 },
    PR: { name: 'Prussian', ranks: 3, battalion: 700 },
  },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
