/* Era pack: the Napoleonic wars (about 1792-1815). Every number here is an estimate unless a source is named; the rules doc
   (Waterloo Game: Simulation Rules) records where each came from and every value changed in calibration. Moved verbatim out of the
   engine in phase 1 of the engine roadmap; the engine reads them from here. */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
P.register('era', 'napoleonic', {
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
  WALL_SHOCK: 0.5,      // cohesion the defenders lose for each assault they beat off, as a share of the open-ground rate
  NOAMMO_MELEE: 1,      // wall bonus in the melee test when the defenders have no cartridges (2 = no change; release 1: 1, they can no longer hold the loopholes)
  // (6) skirmishing round a held farm (est.; 0 = off): enemy foot within SKIRM_R of a garrisoned farm keep skirmishers at it, and the garrison
  // answers from the loopholes even when no assault is going in. SKIRM_FULL men within range is full pressure.
  RIFLE_NEAR: 0.25, RIFLE_FAR: 0.35, RIFLE_FAR_T: 1050, // the hidden roll for La Haye Sainte's rifle-ammunition wagon: near, far (reachable from this minute), else lost (est.; 5e: 0.4, 0.3, 16:00)
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
},
  // musketry: chance a musket aimed at a formed body hits, by range in metres (rules doc table; nothing past 300 m)
  hit: [[0, 0.15], [30, 0.15], [50, 0.08], [100, 0.05], [150, 0.03], [200, 0.015], [300, 0.005], [301, 0]],
  // roundshot: hits per gun per shot by range band (below each limit), scaled by calibre in pounds (12+ x1, 9+ x0.8, lighter x0.7)
  roundshot: { bands: [[600, 0.35], [1000, 0.2], [1600, 0.08]], calibre: [[12, 1], [9, 0.8]], calibreElse: 0.7 },
  // canister: reach by calibre (12+ 580 m, else 420 m); hits per gun by range, flat to the first point and straight between (and past) the
  // later ones; never below the floor; lighter guns x0.6
  canister: { reach: [[12, 580]], reachElse: 420, curve: [[200, 4], [300, 2.5], [500, 1.0]], floor: 0.6, calibre: [[12, 1]], calibreElse: 0.6 },
  crew: 12, // gunners per gun, est.
  // formations: the share of the men who can fire, how dense a target the body makes, and its weight in a push
  fireShare: { line: 1, twoLines: 0.5, columns: 0.18, attack: 0.15, mass: 0.12, square: 0.25, road: 0.03, garrison: 1 },
  density: { line: 1, twoLines: 0.8, columns: 2.5, attack: 2.5, mass: 3.5, square: 3, road: 3, garrison: 1, battery: 0.6, park: 1, limbered: 1.5 },
  mass: { line: 1.0, twoLines: 0.95, columns: 1.1, attack: 1.2, mass: 1.4, square: 0.5, road: 0.4, garrison: 1 },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
