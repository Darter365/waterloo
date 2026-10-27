/* Era pack: a TEST era for the engine's pre-gunpowder mechanics (lasting melee, armour, arrows, stakes). It is not calibrated against any
   battle: every number is an estimate made only to exercise the mechanics on the test bench, and will be replaced when the first
   pre-gunpowder battle is built (roadmap phase 5). Built on the Napoleonic pack (like): it takes its other numbers and replaces the arms,
   formations, weapons, movement and obstacles. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
const foot = { // frontage and depth of a body on foot (m), as the Napoleonic foot's, with wider files
  line: { F: { of: 'files', mul: [0.9], min: 30 }, D: 6 }, deep: { F: { of: 'files', mul: [0.9, 0.5], min: 20 }, D: 12 },
  schiltron: { F: { of: 'files', mul: [0.9, 0.25], min: 20 }, D: { of: 'files', mul: [0.9, 0.25], min: 20 } },
  road: { F: 6, D: { of: 'men', mul: [0.5], min: 30 } }, _: { F: { of: 'files', mul: [0.9, 0.5], min: 20 }, D: 12 } };
P.register('era', 'medieval-test', {
  name: 'Test: an army of about 1400', like: 'napoleonic',
  // a fighting man disables MELEE_KILL of the enemy a tick, before armour; only a clear superiority (SHOCK_WIN) breaks in at the first shock,
  // a clear inferiority (SHOCK_REPULSE) is thrown back, and between them the two lock hand to hand
  K: { MELEE_LOCK: 1, MELEE_KILL: 0.03, MELEE_COH: 4, MAN_FRONT: 0.9, SHOCK_WIN: 1.8, SHOCK_REPULSE: 0.6 },
  // an arrow that disables a man of a formed body, by range (m): most arrows fall harmless or stick in shields and gambesons (est.: about
  // 1-3% at 50-150 m, so that Agincourt's few thousand archers, loosing for some minutes, account for a few thousand French)
  hit: [[0, 0.02], [50, 0.018], [100, 0.012], [150, 0.008], [200, 0.005], [250, 0.0025], [251, 0]],
  arms: {
    mna: { move: 'foot', speed: { walk: 40, quick: 55 }, height: 1.8, holds: true, assaults: true, column: 'road', melee: 'polearm', protection: 0.9, flee: 1.1, shapes: foot },
    archer: { move: 'foot', speed: { walk: 55, quick: 75 }, height: 1.8, holds: true, assaults: true, column: 'road', weapon: 'longbow', melee: 'dagger', protection: 0.15, flee: 1.4, vsHorse: 0.6, shapes: foot }, // vsHorse: archers alone stand a charge badly
    levy: { move: 'foot', speed: { walk: 50, quick: 65 }, height: 1.8, holds: true, assaults: true, allRound: true, column: 'road', melee: 'spear', protection: 0.1, flee: 1.4, shapes: foot },
    knight: { move: 'horse', speed: { walk: 100, trot: 200, charge: 330 }, height: 2.6, charges: true, column: 'road', melee: 'lance', protection: 0.5, shock: { heavy: 1.4, light: 1 }, flee: 1.3, // protection: the horses were the weak point
      shapes: { line: { F: { of: 'men', mul: [1.2], min: 40 }, D: 8 }, road: { F: 8, D: { of: 'men', mul: [1.5], min: 30 } }, _: { F: { of: 'men', mul: [0.5], min: 40 }, D: 24 } } },
  },
  formations: {
    line: { fire: 1, density: 1.2, mass: 1, speed: 0.8, breaksTo: 'deep', vsHorse: 1, relief: 1.2 },
    deep: { fire: 0.3, density: 2.5, mass: 1.3, relief: 2.5, vsHorse: 1.2 },
    schiltron: { fire: 0.3, density: 3, mass: 0.8, pace: 0.1, allRound: true, toTicks: [[50, 1]], toTicksElse: 2, fromTicks: 1, breaksTo: 'deep', relief: 2, vsHorse: 2 },
    road: { fire: 0.05, density: 3, mass: 0.4, column: true, lane: 0.15, meleeD: 0.4, vsHorse: 0.3 },
    garrison: { fire: 0.6, density: 1, mass: 1 },
  },
  formationElse: { fire: 0.2, mass: 1, vsHorse: 0.8, meleeD: 1 },
  movement: {
    foot: { wet: 0.5, ROAD: 1.2, LANE: [1, 0.5, 0.1], WOOD: [0.5, 'wet'], ORCH: [0.6, 'wet'], BUILD: 0.4, VILL: 0.6, STREAM: [0.35, 'wet'], SUNKEN: [0.5, 'wet'] },
    horse: { wet: 0.6, ROAD: 1.2, LANE: [1, 0.5, 0.1], WOOD: 0.12, ORCH: [0.35, 'wet'], BUILD: 0.1, VILL: 0.6, STREAM: [0.35, 'wet'], SUNKEN: [0.35, 'wet'] },
    rider: { wet: 0.4, ROAD: 1.5, LANE: [1.15, 'wet'], WOOD: [0.35, 'wet'], BUILD: 0.3, VILL: 0.9, STREAM: [0.5, 'wet'], SUNKEN: [0.6, 'wet'], ORCH: [0.7, 'wet'] },
  },
  // longbow: six arrows a minute, all ranks shooting over the front, two sheaves a man, little against plate; no smoke
  weapons: {
    longbow: { reach: 250, arc: 90, firingRanks: 99, rate: 6, pen: 0.1, smoke: 0, ammo: 'arrows' },
    polearm: { reach: 0, melee: { power: 1.0, ranks: 2, pen: 0.6 } }, dagger: { reach: 0, melee: { power: 0.5, ranks: 1, pen: 0.8 } },
    spear: { reach: 0, melee: { power: 0.8, ranks: 2, pen: 0.3 } }, lance: { reach: 0, melee: { power: 1.5, ranks: 1, pen: 0.5 } },
  },
  obstacles: {
    stakes: { cross: { foot: 0.6, horse: 0 }, disorder: 2, cover: 1, melee: 1.2, horse: 0 },
    palisade: { cross: { foot: 0.2, horse: 0 }, disorder: 6, cover: 0.5, melee: 1.8, horse: 0 },
    hedge: { cross: { foot: 0.5, horse: 0.25 }, disorder: 4, cover: 0.7, melee: 1.3, horse: 0.5 },
  },
  fieldwork: { kind: 'stakes', minutes: 20 }, // archers drive their stakes in about twenty minutes (est.)
});
P.register('nation', 'medieval-test', { era: 'medieval-test', nations: {
  EN: { name: 'English (test)', ranks: 4, battalion: 400, form: 'line' },
  FRM: { name: 'French (test)', ranks: 6, battalion: 500, form: 'deep' },
} });
})(typeof globalThis !== 'undefined' ? globalThis : this);
