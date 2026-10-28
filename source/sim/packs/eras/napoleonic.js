/* Era pack: the Napoleonic wars (about 1792-1815). Every number here is an estimate unless a source is named; the rules doc
   (Waterloo Game: Simulation Rules) records where each came from and every value changed in calibration. Moved verbatim out of the
   engine in phase 1 of the engine roadmap; the engine reads them from here. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
P.register('era', 'napoleonic', { version: '1.1', // 1.1 (phase 5): the open-village constants (EDGE_*), used only where a battle marks a section street
  name: 'The Napoleonic wars',
  /* ---------------- calibration constants (est.) ---------------- */
  K: {
  FIRE: 1.0,            // musketry multiplier on the hit table
  ARTY: 1.1,            // artillery multiplier (calibrated from 1.0)
  COH_CAS: 2.0,         // cohesion lost per 1% of the unit lost in a tick (calibrated from 3)
  // walled farms (5c, all est.; set so two brigades thrown at Hougoumont no longer always carry it within the hour, while La Haye Sainte still falls about 18:30):
  WALL_REFORM: 40,      // cohesion a garrison re-forms to when driven back into a walled section (was 25-30)
  WALL_COHF: 0.5,       // cohesion lost per casualty behind walls, as a share of the open-ground rate (was 0.65)
  WALL_HOLD: 25,        // walls hold while the defenders' cohesion is at least this
  GATE_HOLD: 40,        // a broken gate lets the attackers in only if the defenders are below this; otherwise the party is shut in and killed
  WALL_FIRE: 0.7,       // musketry against men behind walls and loopholes, on top of the section's cover
  WALL_MELEE: 0.3,      // the defenders' share of the close-quarter losses at a wall (the attackers' is unchanged)
  SEC_FIRE_PER_M: 1.0,  // muskets that can bear on a farm section: this many per metre of its perimeter
  // (Ligny, est.) fighting at the edge of an open village (a section marked street): foot within EDGE_R m of it take cover, EDGE_COVER times
  // the section's own, and at least EDGE_FIRE of them fire (they spread among the gardens and houses). Only sections marked street use these.
  EDGE_COVER: 1.5, EDGE_R: 60, EDGE_FIRE: 0.6, // EDGE_FIRE as the garrison formation fires: both sides fight from the houses; the defenders keep the better cover
  WALL_SHOCK: 0.5,      // cohesion the defenders lose for each assault they beat off, as a share of the open-ground rate
  NOAMMO_MELEE: 1,      // wall bonus in the melee test when the defenders have no cartridges (2 = no change; release 1: 1, they can no longer hold the loopholes)
  // (6) skirmishing round a held farm (est.; 0 = off): enemy foot within SKIRM_R of a garrisoned farm keep skirmishers at it, and the garrison
  // answers from the loopholes even when no assault is going in. SKIRM_FULL men within range is full pressure.
  SKIRM_AMMO: 1.7,      // the garrison's cartridges spent per man per 2-minute tick at full pressure (release 1; 0 = off)
  SKIRM_R: 450, SKIRM_FULL: 3000,
  SKIRM_HOLD: 150, SKIRM_LINGER: 0.4, // minutes the skirmishers stay round the farm after the last column has gone back, and their pressure then
  SKIRM_SHARE: 0.1,     // share of the besiegers out as skirmishers
  SKIRM_P: 0.01,        // hit chance of a skirmish shot at that range (about the musketry table's value at 250 m)
  // release 1 (was off in 5e): with the skirmish fire below draining La Haye Sainte's cartridges, the walls can now hold as they did in 1815
  WALL_FLOOR: 30,       // fire alone cannot take a walled garrison that still has cartridges below this cohesion (0 = off)
  SHELTER: 1,           // a garrison shelled in an orchard or wood with no enemy close takes cover in its buildings (0 = off)
  COH_ART: 1.3,         // artillery shock multiplier
  COH_FLANK: 2.0,       // fire from flank/rear
  NOREPLY: 0.5,         // under fire, unable to reply, per tick
  FLANK_THREAT: 5,      // enemy on flank/rear within 500 m, not faced, per tick
  CONTAGION: 4,         // break of a neighbour
  RECOVER: 1.5,         // per tick out of fire
  CAP_LOSS: 0.3,        // permanent max-cohesion loss per point below 50
  SHOCK_REPULSE: 0.8, SHOCK_WIN: 1.3, SHOCK_SIGMA: 0.3,
  CAV_BREAK_TEST: 1.0,  // scales the infantry morale test against cavalry
  MORALE_BROKEN: 0.08,  // army morale per 1% of army strength broken (release 2: 0.08, was 0.5; the losses that broke a brigade now count through MORALE_CAS)
  MORALE_CAS: 0.6,      // (8) army morale per 1% of the army's starting foot and horse killed, wounded or taken (release 2, est.; 0 = off)
  SMOKE_MUSKET: 0.00035, SMOKE_GUN: 0.03, SMOKE_DECAY: 0.87, SMOKE_DECAY_HUMID: 0.93, SMOKE_VIS: 0.8,
  KW_RATIO: 0.25,       // share of hits that are deaths (1 in 4)
  UNDER_FIRE_RECOVER: 0.5,
  BLIND: 0.4,           // area fire at ground the gunners cannot see behind a crest (overshoot and ricochet) (calibration addition; release 1: 0.4, was 0.2, bringing Wellington's losses to the 1815 range)
  // (phase 2, moved from the engine unchanged) starting cohesion by quality: COH0 + (q - COH0_Q0) x COH0_Q, kept within COH0_MIN-COH0_MAX (est.)
  COH0: 75, COH0_Q0: 0.75, COH0_Q: 30, COH0_MIN: 72, COH0_MAX: 90,
  DRY_RATE: 0.13, WET_FLOOR: 0.2, // the ground dries this much an hour once the rain stops, never below the floor (rules doc)
  /* (phase 2) army morale from events, in general form (release 3 had them for named Waterloo events; these reproduce its values):
     a place or line of value v changing hands: the takers' coalition +PLACE_GAIN x v each; the losers' army -PLACE_LOSS x v and its partners
     -PLACE_LOSS_ALLY x v (est., rules doc). A fresh corps from off the map firing its first shots: each enemy army -FRESH_ENEMY, each
     partner army it came to help +FRESH_HELP for the first such corps of its army, half for the second, a third for the third (a force
     under FRESH_MEN foot and horse counts pro rata) (release 3's values for the Prussians' and Zieten's arrivals: -10 and +10, -10 and +5). LINE_NEAR, LINE_CLEAR, LINE_BACK: foot within this many metres of a valued line hold it while none of the holders' foot or
     horse are within LINE_CLEAR; the holders have it back once it has been clear this many minutes. PRESTIGE_SIGHT: how far comrades see
     a prestige unit thrown back (m). */
  PLACE_GAIN: 5, PLACE_LOSS: 8, PLACE_LOSS_ALLY: 4, FRESH_ENEMY: 10, FRESH_HELP: 10, FRESH_MEN: 5000, LINE_NEAR: 120, LINE_CLEAR: 250, LINE_BACK: 20, PRESTIGE_SIGHT: 3000,
},
  /* (phase 2) light: the sun's altitude (degrees) at sunset, at dark (civil dusk: no more rallying, fire at its weakest) and when fighting
     stops (est.: release 3 had 21:10 and 21:30 at Waterloo, where the sun reaches -6 and -9 degrees at about 21:01 and 21:32); once the sun
     is down, how far a man can see by how far it is below the horizon (m), and the share of fire that tells (release 3's values at sunset,
     dark and the end, est.) */
  light: { sunset: -0.833, dark: -6, end: -9, vis: [[0.833, 5000], [6, 1000], [9, 600]], fire: [[0.833, 1], [6, 0.5]] },
  gunCalibre: 6, // pounds: a battery's guns when neither the battle nor its nation says
  // orders by rider (phase 2, moved from the engine unchanged): minutes to write when the sender's leader file does not say, minutes for
  // the receiver to read and act (direct: an order for one unit, or from close by), a rider's speed across country (km/h) and how much wet
  // ground slows him (all est.)
  orders: { write: [3, 8], interp: [10, 20], interpDirect: [2, 5], rider: 8, riderWet: 0.4 },
  // musketry: chance a musket aimed at a formed body hits, by range in metres (rules doc table; nothing past 300 m)
  hit: [[0, 0.15], [30, 0.15], [50, 0.08], [100, 0.05], [150, 0.03], [200, 0.015], [300, 0.005], [301, 0]],
  // roundshot: hits per gun per shot by range band (below each limit), scaled by calibre in pounds (12+ x1, 9+ x0.8, lighter x0.7)
  roundshot: { bands: [[600, 0.35], [1000, 0.2], [1600, 0.08]], calibre: [[12, 1], [9, 0.8]], calibreElse: 0.7 },
  // canister: reach by calibre (12+ 580 m, else 420 m); hits per gun by range, flat to the first point and straight between (and past) the
  // later ones; never below the floor; lighter guns x0.6
  canister: { reach: [[12, 580]], reachElse: 420, curve: [[200, 4], [300, 2.5], [500, 1.0]], floor: 0.6, calibre: [[12, 1]], calibreElse: 0.6 },
  crew: 12, // gunners per gun, est.
  /* (phase 2) the arms: what each kind of unit is made of and can do. The sim asks these questions of a unit ("does it ride", "is it a
     crew serving guns", "can it face all round", "can it hold a farm"), never its arm's name, so an era can add archers, pikes or elephants
     as rows here. Numbers moved from the engine unchanged (release 3, est. unless the rules doc gives them).
     move: how it moves (a row of the movement table); speed: metres a minute at each pace; height: how tall a target it makes, m;
     holds: can garrison a farm or village; allRound: can form the era's all-round formation; assaults: goes in with the bayonet on an
     attack order; charges: charges on horseback (and rests its horses' wind); crew: gunners a gun (it is a gun crew); column: the
     formation it marches in; shells: the share of its pieces that fire shells (howitzers); shock: the weight of a charge by the unit's kind (battle traits: heavy, lancer, else light);
     density: how dense a target to roundshot, by formation (where not the formation table's); flee: how much faster it runs when broken; deploys: the formation guns unlimber into. */
  arms: {
    inf: { move: 'foot', speed: { walk: 49, quick: 70 }, height: 1.8, holds: true, allRound: true, assaults: true, column: 'road', weapon: 'musket', melee: 'bayonet', flee: 1.4,
      shapes: { // frontage F and depth D (m): a number, or { of: men | files (men a rank) | bns (battalions) | pairs (of battalions), mul, add, min, max }
        line: { F: { of: 'files', mul: [0.6, 1.15], min: 40 }, D: 25 }, twoLines: { F: { of: 'files', mul: [0.6, 1.15, 0.5], min: 40 }, D: 110 },
        attack: { F: { of: 'bns', mul: [45] }, D: 80 }, mass: { F: 160, D: { of: 'bns', mul: [13], add: 12 } },
        square: { F: { of: 'pairs', mul: [70] }, D: { of: 'bns', steps: [[2, 110]], else: 35 } }, road: { F: 12, D: { of: 'men', mul: [0.5], min: 40 } },
        _: { F: { of: 'bns', mul: [70] }, D: 60 } } }, // battalion columns at deploying interval
    cav: { move: 'horse', speed: { walk: 100, trot: 220, charge: 400 }, height: 2.6, charges: true, column: 'road', shock: { heavy: 1.25, lancer: 1.1, light: 1.0 }, flee: 1.5,
      density: { line: 1.2, _: 1.5 },
      shapes: { line: { F: { of: 'men', mul: [0.5, 1.1], min: 60 }, D: 20 }, road: { F: 10, D: { of: 'men', mul: [0.8], min: 40 } }, _: { F: { of: 'men', mul: [0.22], min: 110 }, D: 60 } } },
    art: { move: 'guns', speed: { walk: 60, horse: 110 }, height: 1.8, crew: 12, column: 'limbered', deploys: 'battery', shells: 0.25, weapon: 'guns', flee: 1.4,
      meleeD: 0.5, roadMen: 30, seenAs: 15, // stands an assault half as well as foot; a gun and team take the road of 30 men; seen like 15 men a gun
      shapes: { limbered: { F: 14, D: { of: 'men', mul: [22], min: 30 } }, road: { F: 14, D: { of: 'men', mul: [22], min: 30 } },
        park: { F: { of: 'men', mul: [2.2], add: 40, max: 260 }, D: 80 }, _: { F: { of: 'men', mul: [15], min: 30 }, D: 30 } } },
  },
  // a body holding a farm or village: it stands as big as the section it holds (1.4 x its radius, or 60 m), 4 m tall to an observer
  // (walls and roofs), and makes a thin target to roundshot
  place: { size: 1.4, sizeElse: 60, height: 4, density: 0.5, leaveForm: 'columns' }, // leaveForm: the formation a body leaving it takes
  lyingHeight: 0.5, // a man lying down, m
  /* movement: how ground slows a body, by how it moves (rules doc table for foot; horse and guns cannot move formed through woods or
     buildings). A number is the share of open-ground pace; [k, 'wet'] is k times the open-ground pace on wet ground, which is
     1 - wet x the ground's wetness; lane: [a, b, c] is a - b x wetness + c. Riders carry messages. */
  movement: {
    foot: { wet: 0.35, ROAD: 1.2, LANE: [1, 0.5, 0.1], WOOD: [0.5, 'wet'], ORCH: [0.6, 'wet'], BUILD: 0.4, VILL: 0.6, STREAM: [0.35, 'wet'], SUNKEN: [0.5, 'wet'] },
    horse: { wet: 0.5, ROAD: 1.2, LANE: [1, 0.5, 0.1], WOOD: 0.12, ORCH: [0.35, 'wet'], BUILD: 0.1, VILL: 0.6, STREAM: [0.35, 'wet'], SUNKEN: [0.35, 'wet'] },
    guns: { wet: 0.6, ROAD: 1.2, LANE: [1, 0.5, 0.1], WOOD: 0.12, ORCH: [0.35, 'wet'], BUILD: 0.1, VILL: 0.6, STREAM: [0.2, 'wet'], SUNKEN: [0.35, 'wet'] },
    rider: { wet: 0.4, ROAD: 1.5, LANE: [1.15, 'wet'], WOOD: [0.35, 'wet'], BUILD: 0.3, VILL: 0.9, STREAM: [0.5, 'wet'], SUNKEN: [0.6, 'wet'], ORCH: [0.7, 'wet'] },
  },
  /* formations: fire, the share of the men who can fire (ranksFire: only the front ranks the weapon allows, so 2 of 3 in a French line);
     density, how dense a target the body makes; mass, its weight in a push; speed, a multiplier on its pace (pace: a fixed share instead);
     ticks, 2-minute ticks to form it (or leave it); allRound, it faces every way (no flank, fires all round, stands off horse);
     breaksTo, the formation a body that breaks falls into; column, it uses roads at road pace (lane: and lanes, plus this); meleeD, how well
     it stands an assault; vsHorse, how well it stands a charge caught out of the all-round formation */
  formations: {
    line: { fire: 1, ranksFire: true, density: 1, mass: 1.0, speed: 0.8, breaksTo: 'columns', vsHorse: 1 },
    twoLines: { fire: 0.5, ranksFire: true, density: 0.8, mass: 0.95, vsHorse: 1.05 },
    columns: { fire: 0.18, density: 2.5, mass: 1.1 },
    attack: { fire: 0.15, density: 2.5, mass: 1.2 },
    mass: { fire: 0.12, density: 3.5, mass: 1.4, speed: 0.9, ticks: 3, breaksTo: 'columns', vsHorse: 0.6 },
    square: { fire: 0.25, density: 3, mass: 0.5, pace: 0.2, allRound: true, toTicks: [[50, 1]], toTicksElse: 2, fromTicks: 1, breaksTo: 'columns', meleeD: 0.75 },
    road: { fire: 0.03, density: 3, mass: 0.4, column: true, lane: 0.15, meleeD: 0.4, vsHorse: 0.3 },
    garrison: { fire: 0.6, density: 1, mass: 1 },
    battery: { density: 0.6, speed: 0.25, deployed: true }, park: { density: 1, speed: 0.25, deployed: true }, limbered: { density: 1.5, column: true },
  },
  formationElse: { fire: 0.2, mass: 1, vsHorse: 0.8, meleeD: 1 },
  /* (phase 2g) obstacles on the map, by kind: cross, the share of its pace a body keeps while crossing, by how it moves (0: it cannot cross
     formed); disorder, cohesion it costs; cover, the share of musketry that still finds men close behind it; melee, how much harder it makes
     them to dislodge; horse, how much of a charge's weight carries over it (est. throughout: no Waterloo line is an obstacle yet) */
  obstacles: {
    hedge: { cross: { foot: 0.5, horse: 0.25, guns: 0.1 }, disorder: 4, cover: 0.7, melee: 1.3, horse: 0.5 },
    wall: { cross: { foot: 0.4, horse: 0, guns: 0 }, disorder: 6, cover: 0.4, melee: 1.6, horse: 0 },
    ditch: { cross: { foot: 0.5, horse: 0.3, guns: 0.1 }, disorder: 3, cover: 0.8, melee: 1.2, horse: 0.6 },
    abatis: { cross: { foot: 0.25, horse: 0, guns: 0 }, disorder: 8, cover: 0.8, melee: 1.5, horse: 0 },
  },
  /* weapons: musket, the smoothbore (hit table above; front ranks firing: 2); rifle, slower to load and more accurate past 100 m (Baker);
     guns, roundshot and canister above, shots a minute by calibre, howitzer shells that can fire buildings, caissons that can blow up */
  weapons: {
    musket: { reach: 300, arc: 75, firingRanks: 2, rate: 1, ammo: 'musket', volley: { within: 60, mul: 1.5 } }, // the first volley, loaded with care, at under 60 m
    rifle: { reach: 300, arc: 75, firingRanks: 2, rate: 0.6, longHit: { beyond: 100, mul: 1.6 }, ammo: 'rifle', volley: { within: 60, mul: 1.5 } },
    bayonet: { reach: 0, melee: { power: 1, ranks: 2 } },
    guns: { reach: 1600, rateByCal: [[12, 1]], rateElse: 2, fireBuildings: 0.005, caisson: 0.002 },
  },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
