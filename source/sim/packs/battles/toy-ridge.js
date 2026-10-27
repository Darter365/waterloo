/* Battle pack: "The ridge at Saint-Ail", a SMALL TEST BATTLE built from files alone (engine roadmap 4f). It is invented: a field of
   4 km by 8 km with a ridge, a walled farm in front of it, a village on its eastern end and a wood to the west; a Blue army holds the
   ridge, a Red army attacks it from the south, and a Green corps marches to Blue's help from the east in the afternoon. It uses the
   Napoleonic era and nations, and leaders of its own. No line of engine code knows it: it exists to prove that a battle can be added as
   data, and to try the generic commanders (doctrine.js) on something small. */
(function (root) {
'use strict';
// the ground is a terrain pack made by the map pipeline from survey files: packs/maps/toy-ridge.map.json (spot heights every 400 m, the
// roads, wood, farm and village as GeoJSON). This file holds what the battle makes of it: places, objectives, roads of march, sides.
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
const T = P.terrain('toy-ridge'); if (!T) throw new Error('toy-ridge: load packs/maps/toy-ridge.js before the battle');
const { m2ll, WM, HM } = T;
// places are written in design metres (Blue's ridge at y = 1200), which the terrain's field runs 1500 m north of, so that each army has
// ground behind it to rally on: a broken brigade runs until no enemy is within 800 m for 15-30 minutes, about 2-4 km (first tries, with
// 0.4 and 1.6 km behind Red, lost every beaten Red brigade off the south edge before it could rally)
const OY = 1500;
const ll = (x, y) => m2ll(x, y + OY), edge = (x, y) => m2ll(x, y); // edge: true map metres
const STRONGPOINTS = [
  { id: 'ferme', garrison: 'bGar1', name: 'Haute Ferme', key: true, sections: [
      { name: 'orchard', at: ll(2000, 1610), r: 60, cover: 0.6, cap: 400 }, { name: 'farm', at: ll(2000, 1550), r: 35, cover: 0.3, cap: 500 }], // stone-built: it does not burn
    access: [ll(2000, 1300), ll(2000, 1500)] },
  { id: 'stail', garrison: 'bGar2', name: 'Saint-Ail', key: true, sections: [
      { name: 'village', at: ll(3200, 1180), r: 200, cover: 0.4, cap: 2000 }, { name: 'churchyard', at: ll(3200, 1150), r: 40, cover: 0.3, cap: 600 }],
    access: [ll(3200, 900), ll(3200, 1100)] },
];
const OBJECTIVES = {
  ferme: { name: 'Haute Ferme', sp: 'ferme' }, stail: { name: 'Saint-Ail', sp: 'stail' },
  ailRidge: { name: 'the ridge either side of the crossroads', value: 1, holder: 'BL', flag: 'ridgeTaken', line: [ll(1400, 1180), ll(2700, 1160)],
    says: { taken: 'Red infantry stand on the ridge.', regained: 'Blue clears the ridge again.' } },
  redRise: { name: 'the Red rise', point: ll(2000, 2700) },
};
const ROUTES = { blueRetreat: [ll(2000, 1000), edge(2000, 10)], redRetreat: [ll(2000, 2400), edge(2000, HM - 10)],
  green: [ll(WM + 200, 900), ll(WM - 30, 900), ll(3600, 950)], greenRetreat: [ll(3600, 950), ll(WM - 10, 900)] };
// the order of battle is a spreadsheet: packs/oob/toy-ridge.csv, made into packs/oob/toy-ridge.js by tools/oob.js (engine roadmap 4d)
P.register('leader', 'toy-ridge', { version: '1.0', era: 'napoleonic', people: {
  azur: { name: 'General Azur', nation: 'GB', army: 'BL', rank: 3, traits: { agg: 0.35, ini: 0.6, obe: 1, skill: 0.75, exp: 0.5 } },
  cobalt: { name: 'General Cobalt', nation: 'GB', army: 'BL', rank: 2, traits: { agg: 0.5, ini: 0.5, obe: 0.8, skill: 0.65, exp: 0.6 } },
  carmin: { name: 'Marshal Carmin', nation: 'FR', army: 'RD', rank: 3, traits: { agg: 0.75, ini: 0.7, obe: 1, skill: 0.7, exp: 0.4 } },
  vermillon: { name: 'General Vermillon', nation: 'FR', army: 'RD', rank: 2, traits: { agg: 0.7, ini: 0.6, obe: 0.7, skill: 0.6, exp: 0.7 } },
  garance: { name: 'General Garance', nation: 'FR', army: 'RD', rank: 2, traits: { agg: 0.55, ini: 0.5, obe: 0.8, skill: 0.7, exp: 0.6 } },
  sinople: { name: 'General Sinople', nation: 'PR', army: 'GR', rank: 3, traits: { agg: 0.7, ini: 0.6, obe: 0.9, skill: 0.65, exp: 0.6 } },
}, source: 'invented for the test battle', confidence: 'none: fiction' });
P.register('battle', 'toy-ridge', { version: '1.0', oob: 'toy-ridge', terrain: 'toy-ridge',
  name: 'The ridge at Saint-Ail (test)', date: '1815-07-02', era: 'napoleonic', nations: ['GB', 'NL', 'FR', 'PR'],
  // posture: how its generic commanders fight (attack, defend); reserve: the corps they hold back; objectives: what an objective is worth to
  // this army when it differs from the map's value (Red's aim is the ridge, the farm and the village only on the way; Green marches on Red's
  // rear, the rise where Red's reserve and guns stand)
  sides: [
    { id: 'BL', name: 'Blue', colour: '#2f5f9f', morale0: 70, coalition: 'BL', chief: 'azur', rear: 'N', retreat: 'blueRetreat', posture: 'defend', reserve: ['blueRes'],
      crest: { from: [{ objective: 'ailRidge' }], first: ['b1', 'b2'] } },
    { id: 'RD', name: 'Red', colour: '#b0352d', morale0: 75, coalition: 'RD', chief: 'carmin', rear: 'S', retreat: 'redRetreat', exit: edge(2000, HM - 20), rearguard: ll(2000, 2900), posture: 'attack', reserve: ['redRes'], objectives: { ailRidge: 2 } },
    { id: 'GR', name: 'Green', colour: '#3f7a35', morale0: 70, coalition: 'BL', chief: 'sinople', rear: 'E', retreat: 'greenRetreat', posture: 'attack', objectives: { redRise: 2 } },
  ],
  starts: { '1100': { t: 660, wet0: 0.3 } },
  weather: { vis: [[600, 7000], [1200, 6000]] },
  coalitionNames: { BL: 'Blue', RD: 'Red' }, coalitionAdjectives: { BL: 'Blue', RD: 'Red' },
  victory: { attacker: 'RD', marginal: 'ailRidge' },
  // (4b) the battle is invented, so these are not history: they keep it a working test of the generic commanders (a battle is fought, the
  // ridge is fought over, Green comes into it, losses stay in a sane range). Red rarely wins: see the engine roadmap's notes.
  targets: { runner: 'doctrine', checks: [
    { what: 'Red reaches the ridge', metric: 'ridgeTaken', min: 50 },
    { what: 'Green comes into the fight', metric: 'greenEngaged', min: 80 },
    { what: 'Red killed and wounded (median)', losses: 'RD', median: [3000, 11000] },
    { what: 'Blue killed and wounded (median)', losses: 'BL', median: [1500, 7000] },
    { what: 'battles not a draw', share: 'victory', min: 50 },
  ] },
  corpsNames: { green: 'the Green corps' },
  metrics: [
    { id: 'fermeFall', when: 'taken', place: 'ferme', by: 'RD' }, { id: 'stailFall', when: 'taken', place: 'stail', by: 'RD' },
    { id: 'greenEngaged', when: 'fires', side: 'GR', at: 'RD' }, { id: 'ridgeTaken', when: 'line', line: 'ailRidge' },
  ],
  leaders: [{ id: 'azur', side: 'BL', at: ll(2000, 900) }, { id: 'cobalt', side: 'BL', unit: 'b2' }, { id: 'carmin', side: 'RD', at: ll(2000, 2800) },
    { id: 'vermillon', side: 'RD', unit: 'r1' }, { id: 'garance', side: 'RD', unit: 'r3' }, { id: 'sinople', side: 'GR', corps: 'green' }],
  map: { STRONGPOINTS, OBJECTIVES, ROUTES },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
