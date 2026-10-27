/* A battle's historical orders (for Waterloo, Napoleon's on 18 June), given through the order builder as a player would give them,
   and timed by what the commander himself believes rather than by the true state of the battle. The orders are the battle pack's
   'historical' plan (plans.js reads it); this file keeps the old entry point (WScript.historical) for the game, the reference battles
   and the tools. */
(function (root) {
'use strict';
// Napoleon's historical orders are now data: the battle pack's plan 'historical' (phase 3c), run by plans.js through the order builder.
// opt.from: the player hands over at that minute ("fight it out to the end"): orders Napoleon gave before then are history, and only
// the later ones, and those that wait on events (the Guard to Plancenoit), are still to come
const Plans = () => root.WPlans || (typeof require === 'function' ? require('./plans.js') : null);
const Packs = () => root.WPacks || (typeof require === 'function' ? require('./packs/all.js') : null);
function historical(E, opt) {
  const plan = (Packs().battle(E.battleId || 'waterloo').battle.plans || {}).historical;
  if (!plan) throw new Error(`battle ${E.battleId} has no historical plan`);
  return Plans().install(E, plan, opt || {});
}

root.WScript = { historical };
if (typeof module !== 'undefined' && module.exports) module.exports = root.WScript;
})(typeof globalThis !== 'undefined' ? globalThis : this);
