/* Leader pack: the commanders of the 1815 campaign, apart from any one battle. A battle places them (side, where they stand,
   the brigade they ride with); this file holds who they are, and follows them from battle to battle.
   rank: 3 army, 2 corps or wing, 1 division. nation: the army whose staff habits he has (defaults below).
   traits (0-1): agg aggression; ini initiative (acting without orders); obe obedience (how literally he reads orders); skill; exp
     exposure (how far forward he rides); reserve (how readily he commits his reserves); rally (how well he rallies men round him);
     coord (how well he combines foot, horse and guns); tempo (how quickly he acts on an order: 1 usual, under 1 quicker).
   habits: writes (minutes to write an order); clarity (how clear his orders are, 0-1); reports (minutes between his reports).
   source and confidence: where the settings come from and how far to trust them. The first five traits are the rules doc's; the
   rest default by nation and rank (est.) until a source sets them. A setting a person does not give comes from the defaults. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
P.register('leader', 'napoleonic-1815', { version: '1.1', // 1.1: the commanders added for Ligny
  era: 'napoleonic',
  // defaults by nation and rank (est.: the engine's values before leader files, so that a leader the file leaves out acts as before)
  defaults: {
    _: { traits: { agg: 0.5, ini: 0.5, obe: 0.8, skill: 0.6, exp: 0.5, reserve: 0.5, rally: 0.5, coord: 0.5, tempo: 1 }, habits: { writes: [3, 8], clarity: 0.9, reports: [25, 45] } },
  },
  people: {
    // writes: Napoleon's orders went through his chief of staff; Wellington pencilled his own (est.)
    napoleon: { name: 'Napoleon', nation: 'FR', army: 'FR', rank: 3, traits: { agg: 0.7, ini: 0.8, obe: 1, skill: 0.85, exp: 0.3 }, habits: { writes: [5, 15] } },
    ney: { name: 'Ney', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.95, ini: 0.9, obe: 0.4, skill: 0.55, exp: 0.95 } },
    derlon: { name: "d'Erlon", nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.6, ini: 0.5, obe: 0.7, skill: 0.55, exp: 0.6 } },
    reille: { name: 'Reille', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.4, ini: 0.4, obe: 0.8, skill: 0.75, exp: 0.5 } },
    jerome: { name: 'Jérôme', nation: 'FR', army: 'FR', rank: 1, traits: { agg: 0.9, ini: 0.8, obe: 0.3, skill: 0.35, exp: 0.7 } },
    lobau: { name: 'Lobau', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.6, ini: 0.7, obe: 0.7, skill: 0.85, exp: 0.6 } },
    drouot: { name: 'Drouot', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.5, ini: 0.4, obe: 0.9, skill: 0.8, exp: 0.5 } },
    duhesme: { name: 'Duhesme', nation: 'FR', army: 'FR', rank: 1, traits: { agg: 0.7, ini: 0.6, obe: 0.8, skill: 0.7, exp: 0.8 } },
    kellermann: { name: 'Kellermann', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.6, ini: 0.6, obe: 0.8, skill: 0.75, exp: 0.6 } },
    milhaud: { name: 'Milhaud', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.7, ini: 0.5, obe: 0.8, skill: 0.65, exp: 0.6 } },
    wellington: { name: 'Wellington', nation: 'GB', army: 'AL', rank: 3, traits: { agg: 0.3, ini: 0.8, obe: 1, skill: 0.95, exp: 0.7 }, habits: { writes: [2, 6] } },
    uxbridge: { name: 'Uxbridge', nation: 'GB', army: 'AL', rank: 2, traits: { agg: 0.85, ini: 0.8, obe: 0.6, skill: 0.6, exp: 0.9 } },
    orange: { name: 'Prince of Orange', nation: 'NL', army: 'AL', rank: 2, traits: { agg: 0.7, ini: 0.6, obe: 0.7, skill: 0.35, exp: 0.8 } },
    picton: { name: 'Picton', nation: 'GB', army: 'AL', rank: 1, traits: { agg: 0.8, ini: 0.7, obe: 0.7, skill: 0.75, exp: 0.9 } },
    hill: { name: 'Hill', nation: 'GB', army: 'AL', rank: 2, traits: { agg: 0.4, ini: 0.5, obe: 0.9, skill: 0.8, exp: 0.5 } },
    blucher: { name: 'Blücher', nation: 'PR', army: 'PR', rank: 3, traits: { agg: 0.95, ini: 0.9, obe: 1, skill: 0.7, exp: 0.8 } },
    bulow: { name: 'Bülow', nation: 'PR', army: 'PR', rank: 2, traits: { agg: 0.5, ini: 0.6, obe: 0.8, skill: 0.85, exp: 0.5 } },
    pirch: { name: 'Pirch I', nation: 'PR', army: 'PR', rank: 2, traits: { agg: 0.5, ini: 0.4, obe: 0.9, skill: 0.6, exp: 0.5 } },
    zieten: { name: 'Zieten', nation: 'PR', army: 'PR', rank: 2, traits: { agg: 0.6, ini: 0.4, obe: 0.9, skill: 0.7, exp: 0.6 } },
    // added for Ligny (est., from their reputations in the accounts of the campaign; to be checked against Wavre, where several fought again):
    // Vandamme hard-driving and touchy about orders from anyone but the Emperor; Gérard able and forward; Grouchy careful and literal;
    // Pajol and Exelmans bold cavalry generals; Girard led from the front and fell at la Haye; Thielmann steady (Clausewitz his chief of staff)
    vandamme: { name: 'Vandamme', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.8, ini: 0.6, obe: 0.6, skill: 0.75, exp: 0.7 } },
    gerard: { name: 'Gérard', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.75, ini: 0.7, obe: 0.8, skill: 0.8, exp: 0.8 } },
    grouchy: { name: 'Grouchy', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.4, ini: 0.3, obe: 0.95, skill: 0.65, exp: 0.5 } },
    pajol: { name: 'Pajol', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.75, ini: 0.7, obe: 0.8, skill: 0.75, exp: 0.8 } },
    exelmans: { name: 'Exelmans', nation: 'FR', army: 'FR', rank: 2, traits: { agg: 0.8, ini: 0.7, obe: 0.75, skill: 0.75, exp: 0.8 } },
    girard: { name: 'Girard', nation: 'FR', army: 'FR', rank: 1, traits: { agg: 0.85, ini: 0.7, obe: 0.8, skill: 0.75, exp: 0.95 } },
    thielmann: { name: 'Thielmann', nation: 'PR', army: 'PR', rank: 2, traits: { agg: 0.5, ini: 0.5, obe: 0.8, skill: 0.7, exp: 0.5 } },
  },
  source: 'rules doc, Waterloo Game: Simulation Rules (the first five traits); est. otherwise', confidence: 'low: interpretations of the record, to be checked across the battles each leader fought',
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
