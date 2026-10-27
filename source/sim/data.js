/* The current battle's map and order of battle, for code that has not yet moved to packs (the map drawing, older tools).
   It is the resolved Waterloo battle pack (packs/battles/waterloo.js); see the engine roadmap, phase 1. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('./packs/all.js') : null);
root.WData = P.battle(root.WBATTLE || 'waterloo').W;
if (typeof module !== 'undefined' && module.exports) module.exports = root.WData;
})(typeof globalThis !== 'undefined' ? globalThis : this);
