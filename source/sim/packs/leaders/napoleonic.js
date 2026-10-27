/* Leader pack: the commanders of the 1815 campaign, apart from any one battle. A battle places them (side, where they stand,
   the brigade they ride with); this file holds who they are. Traits (0-1, from the rules doc where listed, otherwise est.):
   agg aggression, ini initiative, obe obedience (how literally he follows orders), skill, exp exposure (how far forward he rides);
   rank 3 army, 2 corps or wing, 1 division. Phase 3 of the engine roadmap builds the AI's reading of these. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
P.register('leader', 'napoleonic-1815', {
  people: {
    // habits.writes: minutes to write an order (Napoleon's went through his chief of staff; Wellington pencilled his own: est.)
    napoleon: { name: 'Napoleon', army: 'FR', rank: 3, traits: { agg: 0.7, ini: 0.8, obe: 1, skill: 0.85, exp: 0.3 }, habits: { writes: [5, 15] } },
    ney: { name: 'Ney', army: 'FR', rank: 2, traits: { agg: 0.95, ini: 0.9, obe: 0.4, skill: 0.55, exp: 0.95 } },
    derlon: { name: "d'Erlon", army: 'FR', rank: 2, traits: { agg: 0.6, ini: 0.5, obe: 0.7, skill: 0.55, exp: 0.6 } },
    reille: { name: 'Reille', army: 'FR', rank: 2, traits: { agg: 0.4, ini: 0.4, obe: 0.8, skill: 0.75, exp: 0.5 } },
    jerome: { name: 'Jérôme', army: 'FR', rank: 1, traits: { agg: 0.9, ini: 0.8, obe: 0.3, skill: 0.35, exp: 0.7 } },
    lobau: { name: 'Lobau', army: 'FR', rank: 2, traits: { agg: 0.6, ini: 0.7, obe: 0.7, skill: 0.85, exp: 0.6 } },
    drouot: { name: 'Drouot', army: 'FR', rank: 2, traits: { agg: 0.5, ini: 0.4, obe: 0.9, skill: 0.8, exp: 0.5 } },
    duhesme: { name: 'Duhesme', army: 'FR', rank: 1, traits: { agg: 0.7, ini: 0.6, obe: 0.8, skill: 0.7, exp: 0.8 } },
    kellermann: { name: 'Kellermann', army: 'FR', rank: 2, traits: { agg: 0.6, ini: 0.6, obe: 0.8, skill: 0.75, exp: 0.6 } },
    milhaud: { name: 'Milhaud', army: 'FR', rank: 2, traits: { agg: 0.7, ini: 0.5, obe: 0.8, skill: 0.65, exp: 0.6 } },
    wellington: { name: 'Wellington', army: 'AL', rank: 3, traits: { agg: 0.3, ini: 0.8, obe: 1, skill: 0.95, exp: 0.7 }, habits: { writes: [2, 6] } },
    uxbridge: { name: 'Uxbridge', army: 'AL', rank: 2, traits: { agg: 0.85, ini: 0.8, obe: 0.6, skill: 0.6, exp: 0.9 } },
    orange: { name: 'Prince of Orange', army: 'AL', rank: 2, traits: { agg: 0.7, ini: 0.6, obe: 0.7, skill: 0.35, exp: 0.8 } },
    picton: { name: 'Picton', army: 'AL', rank: 1, traits: { agg: 0.8, ini: 0.7, obe: 0.7, skill: 0.75, exp: 0.9 } },
    hill: { name: 'Hill', army: 'AL', rank: 2, traits: { agg: 0.4, ini: 0.5, obe: 0.9, skill: 0.8, exp: 0.5 } },
    blucher: { name: 'Blücher', army: 'PR', rank: 3, traits: { agg: 0.95, ini: 0.9, obe: 1, skill: 0.7, exp: 0.8 } },
    bulow: { name: 'Bülow', army: 'PR', rank: 2, traits: { agg: 0.5, ini: 0.6, obe: 0.8, skill: 0.85, exp: 0.5 } },
    pirch: { name: 'Pirch I', army: 'PR', rank: 2, traits: { agg: 0.5, ini: 0.4, obe: 0.9, skill: 0.6, exp: 0.5 } },
    zieten: { name: 'Zieten', army: 'PR', rank: 2, traits: { agg: 0.6, ini: 0.4, obe: 0.9, skill: 0.7, exp: 0.6 } },
  },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
