/* The campaign's verdict: what the day's result meant for the commander's campaign (release 4).
   The engine grades the field (who held it, who broke). That grade says nothing of what the commander needed: at Waterloo a quiet draw
   leaves Wellington on his ridge with Blücher beside him, which for Napoleon is a day lost. This module reads the finished battle and
   the battle pack's `stakes` block and gives a second verdict beside the grade. It changes nothing in the battle and draws no dice;
   the engine's grades, and the calibration targets judged by them, stand as they were.

   A pack's stakes block:
     side    the army judged (the one the player commands)
     brief   what the day demands, shown before the battle
     rules   read in order; the first whose `if` fits gives the verdict
               if.ownBroken            this army broke
               if.enemyBroken: 'AL'    that enemy army broke (true: any enemy army)
               if.grade: 'text'        the engine's grade contains the text
               if.unhurt: ['AL', 0.05] that enemy army lost under 5% of its men: this army never seriously attacked it
             tier 1 (the campaign won) to 5 (the campaign lost), a title and a sentence or two saying why
             flat: true leaves the exchange out of the score (an army that refused battle earns nothing by its light losses)
   The score is the tier's base plus up to 8 points either way for the exchange of losses. Bases and the 8 are my estimates (est.):
   they order results for the player and are not history. */
(function (root) {
'use strict';
const BASE = { 1: 90, 2: 72, 3: 54, 4: 32, 5: 10 }; // (est.)
const EXCHANGE_PTS = 8;                              // (est.) at two to one for or against
const TIER = { 1: 'The campaign won', 2: 'The campaign in your favour', 3: 'The campaign undecided', 4: 'The campaign slipping away', 5: 'The campaign lost' };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function judge(E, stakes) {
  const S = stakes || (E.stakes || null); if (!S || !E.result) return null;
  const R = E.result, me = S.side, mine = E.coalition[me], lost = s => (R.cas[s] ? R.cas[s].kw + R.cas[s].cap : 0);
  const enemies = E.sideIds.filter(s => E.coalition[s] !== mine), broke = s => E.metrics[s.toLowerCase() + 'Break'] != null;
  const fits = c => !c || ((!c.ownBroken || broke(me)) && (c.enemyBroken == null || (c.enemyBroken === true ? enemies.some(broke) : broke(c.enemyBroken)))
    && (c.grade == null || R.grade.includes(c.grade)) && (c.unhurt == null || lost(c.unhurt[0]) < c.unhurt[1] * E.armyStr0[c.unhurt[0]]));
  const rule = S.rules.find(r => fits(r.if)); if (!rule) return null;
  const own = lost(me), theirs = enemies.reduce((a, s) => a + lost(s), 0), ratio = theirs / Math.max(1, own);
  const adj = rule.flat ? -EXCHANGE_PTS : clamp(EXCHANGE_PTS * Math.log2(Math.max(0.01, ratio)), -EXCHANGE_PTS, EXCHANGE_PTS);
  const crew = u => !!(E.era.arms[u.arm] && E.era.arms[u.arm].crew);
  const left = Math.round(E.units.filter(u => u.side === me && E.formed(u) && !crew(u)).reduce((a, u) => a + u.str, 0));
  return { tier: rule.tier, tierName: TIER[rule.tier], title: rule.title, text: rule.text, score: Math.round(clamp(BASE[rule.tier] + adj, 0, 100)),
    exchange: { own: Math.round(own), enemy: Math.round(theirs), ratio: Math.round(ratio * 100) / 100, counted: !rule.flat }, left, start: Math.round(E.armyStr0[me]), side: me };
}
const api = { judge, BASE, EXCHANGE_PTS, TIER };
root.WStakes = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
