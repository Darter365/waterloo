/* Battle pack: Ligny, 16 June 1815 (engine roadmap, phase 5: the first proof battle). Napoleon, with Vandamme's III Corps, Gérard's IV
   Corps, the Guard and Grouchy's cavalry (about 61,000), attacks Blücher's I, II and III Corps (about 84,000) along the Ligny brook; Bülow's
   IV Corps never came up. d'Erlon's I Corps, sent for from Quatre Bras, appeared on the French left about 17:30, was taken for the
   enemy, and was recalled by Ney before it fought; Lobau's VI Corps came up from Charleroi too late to fight. The Guard broke the
   Prussian centre at Ligny about 20:00, in a thunderstorm; the Prussians drew off north in the night, in order, toward Wavre.
   Sources: the order of battle in packs/oob/ligny.csv (its header); the ground in packs/maps/ligny.map.json (its source); the course of
   the battle from Wikipedia (Battle of Ligny), napoleon-empire.org, the Ligny reconstitution blog (reconstitutionshistoriques.blogg.org)
   and the napoleonistyka mirror. Est. throughout where a number has no source. The lessons of adding it are in the doc "Adding a battle:
   lessons from Ligny". */
(function (root) {
'use strict';
const P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);
const T = P.terrain('ligny'); if (!T) throw new Error('ligny: load packs/maps/ligny.js before the battle');
// places: the villages along the brook. Sections are ordered outer to inner; cover multiplies hits on the men inside; cap is the men who can
// fight from it; access is the defender's way in (from behind) and the door. Strengths of the villages est.: stone farms, hedged gardens
// and walled churchyards along a brook with steep, willowed banks (the accounts); Ligny about a kilometre long with its château and
// two farms (d'en Haut, upstream, and d'en Bas). No section has cover 0.3 or less: the engine treats those as loopholed walls that fire
// cannot clear and assaults cannot take in good order (Hougoumont's rules), and every place along the brook changed hands on the day
const STRONGPOINTS = [
  { id: 'wagnelee', garrison: 'gWagnelee', name: 'Wagnelée', sections: [{ name: 'village', at: [50.5231, 4.5330], r: 180, cover: 0.45, cap: 1200, street: true }], access: [[50.5265, 4.5345], [50.5235, 4.5332]] },
  { id: 'hameau', name: 'le Hameau', sections: [{ name: 'hamlet', at: [50.5190, 4.5370], r: 110, cover: 0.45, cap: 600, street: true }], access: [[50.5215, 4.5395], [50.5192, 4.5372]] },
  { id: 'lahaye', garrison: 'gLaHaye', name: 'Saint-Amand-la-Haye', key: true, sections: [
      { name: 'hamlet', at: [50.5125, 4.5440], r: 130, cover: 0.45, cap: 900, street: true },
      { name: 'farm', at: [50.5121, 4.5432], r: 40, cover: 0.35, cap: 500 }],
    access: [[50.5155, 4.5470], [50.5123, 4.5436]] },
  { id: 'stamand', garrison: 'gStAmand', name: 'Saint-Amand', key: true, sections: [
      { name: 'village', at: [50.5050, 4.5500], r: 240, cover: 0.4, cap: 2500, street: true },
      { name: 'churchyard', at: [50.5042, 4.5498], r: 40, cover: 0.35, cap: 600 }],
    access: [[50.5100, 4.5520], [50.5050, 4.5502]] },
  { id: 'ligny', garrison: 'gLigny', name: 'Ligny', key: true, sections: [
      { name: 'the upper village and the château', at: [50.5098, 4.5705], r: 230, cover: 0.4, cap: 2200, street: true },
      { name: 'the lower village and the Ferme d’en Bas', at: [50.5132, 4.5782], r: 230, cover: 0.4, cap: 2000, street: true },
      { name: 'the churchyard', at: [50.5119, 4.5747], r: 45, cover: 0.35, cap: 700 }],
    access: [[50.5165, 4.5745], [50.5120, 4.5748]] },
  { id: 'brye', name: 'Brye', sections: [{ name: 'village', at: [50.5241, 4.5567], r: 200, cover: 0.4, cap: 1600, street: true }], access: [[50.5280, 4.5580], [50.5243, 4.5568]] },
  { id: 'bussy', name: 'the Bussy mill', key: true, sections: [{ name: 'the mill and its farm', at: [50.5240, 4.5670], r: 40, cover: 0.5, cap: 250 }], access: [[50.5270, 4.5680], [50.5242, 4.5671]] },
  { id: 'sombreffe', garrison: 'gSombreffe', name: 'Sombreffe', sections: [
      { name: 'village', at: [50.5315, 4.5970], r: 250, cover: 0.4, cap: 2000, street: true },
      { name: 'château', at: [50.5310, 4.5985], r: 50, cover: 0.35, cap: 500 }],
    access: [[50.5350, 4.5990], [50.5313, 4.5980]] },
  { id: 'potriaux', garrison: 'gPotriaux', name: 'Mont-Potriaux', sections: [{ name: 'hamlet', at: [50.5178, 4.5900], r: 90, cover: 0.45, cap: 500, street: true }], access: [[50.5210, 4.5920], [50.5180, 4.5901]] },
  { id: 'tongrenelle', garrison: 'gTongrenelle', name: 'Tongrenelle', sections: [{ name: 'village', at: [50.5115, 4.6128], r: 150, cover: 0.4, cap: 1200, street: true }], access: [[50.5150, 4.6150], [50.5117, 4.6129]] },
  { id: 'tongrinne', garrison: 'gTongrinne', name: 'Tongrinne', key: true, sections: [{ name: 'village', at: [50.5157, 4.6239], r: 200, cover: 0.4, cap: 1800, street: true }], access: [[50.5195, 4.6230], [50.5159, 4.6239]] },
  { id: 'boignee', garrison: 'gBoignee', name: 'Boignée', sections: [{ name: 'village', at: [50.5040, 4.6200], r: 150, cover: 0.4, cap: 900, street: true }], access: [[50.5080, 4.6190], [50.5042, 4.6200]] },
  { id: 'balatre', garrison: 'gBalatre', name: 'Balâtre', sections: [{ name: 'village', at: [50.4985, 4.6379], r: 170, cover: 0.4, cap: 1000, street: true }], access: [[50.5025, 4.6370], [50.4987, 4.6379]] },
];
// objectives: the places, and lines brigades spread along. ligneLine: the slope above the brook from la Haye to Ligny, Blücher's front; its
// holding at nightfall is a marginal French win (as the brook villages were the French at the end of the day)
const OBJECTIVES = {
  wagnelee: { name: 'Wagnelée', sp: 'wagnelee' }, hameau: { name: 'le Hameau', sp: 'hameau' }, lahaye: { name: 'Saint-Amand-la-Haye', sp: 'lahaye' },
  stamand: { name: 'Saint-Amand', sp: 'stamand' }, ligny: { name: 'Ligny', sp: 'ligny' }, brye: { name: 'Brye', sp: 'brye' }, bussy: { name: 'the Bussy mill', sp: 'bussy' },
  sombreffe: { name: 'Sombreffe', sp: 'sombreffe' }, potriaux: { name: 'Mont-Potriaux', sp: 'potriaux' }, tongrenelle: { name: 'Tongrenelle', sp: 'tongrenelle' },
  tongrinne: { name: 'Tongrinne', sp: 'tongrinne' }, boignee: { name: 'Boignée', sp: 'boignee' }, balatre: { name: 'Balâtre', sp: 'balatre' },
  ligneLine: { name: 'the slope above the brook from la Haye to Ligny', value: 1, holder: 'PR', flag: 'brookFR', line: [[50.5150, 4.5460], [50.5160, 4.5770]],
    says: { taken: 'French infantry stand on the slope above the brook between la Haye and Ligny.', regained: 'The Prussians clear the slope above the brook again.' } },
  heights: { name: 'the Prussian centre between Ligny and the Bussy mill', line: [[50.5180, 4.5600], [50.5195, 4.5770]] },
  westLine: { name: 'the Prussian right from Wagnelée to Saint-Amand', line: [[50.5205, 4.5360], [50.5130, 4.5480]] },
  eastLine: { name: "Thielmann's front from Sombreffe to Tongrinne", line: [[50.5240, 4.5980], [50.5180, 4.6230]] },
  batteryLigny: { name: 'the rise south of Ligny', line: [[50.5040, 4.5640], [50.5050, 4.5790]] },
  batteryStAmand: { name: 'the rise south of Saint-Amand', line: [[50.5000, 4.5420], [50.5005, 4.5530]] },
  fleurus: { name: 'Fleurus', point: [50.4835, 4.5480] },
  fleurusRoad: { name: 'the Fleurus road below Mont-Potriaux', point: [50.5070, 4.5770] },
  guardStaging: { name: 'the low ground south-west of Ligny', line: [[50.5010, 4.5600], [50.5020, 4.5700]] },
  naveau: { name: 'the Naveau mill', point: [50.48551, 4.55522] },
};
// roads of march (lat, lon; the first point off the field). derlon: from Frasnes by Villers-Perwin, onto the French left (est.); lobau: up the
// Charleroi road through Fleurus; the two lines of retreat: the French back through Fleurus on Charleroi, the Prussians north by Tilly
const ROUTES = {
  derlon: [[50.5100, 4.4900], [50.5085, 4.5085], [50.5060, 4.5170], [50.5040, 4.5230]],
  lobau: [[50.4600, 4.5380], [50.4725, 4.5435], [50.4800, 4.5470], [50.4870, 4.5540]],
  frRetreat: [[50.4900, 4.5540], [50.4800, 4.5470], [50.4725, 4.5435], [50.4600, 4.5380]],
  prRetreat: [[50.5240, 4.5700], [50.5350, 4.5720], [50.5465, 4.5720], [50.5600, 4.5720]],
};
P.register('battle', 'ligny', { version: '0.1', oob: 'ligny', terrain: 'ligny',
  name: 'Ligny', date: '1815-06-16', era: 'napoleonic', nations: ['FR', 'PR'],
  sides: [
    { id: 'FR', name: 'French', colour: '#2f4f8f', morale0: 80, coalition: 'FR', fatigue0: 20, rallyBack: 600, chief: 'napoleon', rear: 'S', retreat: 'frRetreat', exit: [50.4725, 4.5435], rearguard: [50.4900, 4.5540], posture: 'attack',
      // (generic French commander only) the brook villages and the Prussian centre behind Ligny first; nothing behind his own line (est.)
      objectives: { ligny: 3, stamand: 2, heights: 2, lahaye: 2, ligneLine: 2, wagnelee: 1, hameau: 1, tongrinne: 1, tongrenelle: 1, potriaux: 1, sombreffe: 1, bussy: 2, brye: 1 },
      retreatSays: 'The French army falls back on Fleurus and Charleroi.' },
    { id: 'PR', name: 'Prussian', colour: '#4a4a4a', morale0: 75, coalition: 'PR', fatigue0: 20, rallyBack: 900, chief: 'blucher', rear: 'N', retreat: 'prRetreat', exit: [50.5465, 4.5720], posture: 'defend',
      reserve: ['pirch'], retreatSays: 'Gneisenau orders the army back on Tilly and Wavre.',
      // Blücher took the brook villages back again and again, often while the French were still fighting in them, with whatever brigade
      // was to hand (the accounts: Ligny and Saint-Amand changed hands several times; his feeding of the villages is the usual criticism of
      // the day). The generic defender waits an hour and for the enemy's attack to slacken; here (est.) he tries every 20 minutes, nearly
      // always goes in, and sends brigades already worn (tried: every 30 min at 0.6, which left Ligny French for good by about 16:45)
      retake: { every: 20, slack: false, coh: 45, str: 800, chance: 0.9, places: ['ligny', 'stamand', 'lahaye'] },
      // the brook villages fed from the brigades behind them, as Blücher fed Ligny and Saint-Amand all afternoon (doctrine.js: feedTick;
      // Waterloo's Hougoumont values, est.). No reoccupy habit: Wellington's (take back farms that stand empty) replaces the generic
      // defender's counter-attack on places the enemy holds, and Blücher counter-attacked all afternoon
      feeds: [
        { place: 'ligny', donors: ['z2a', 'z2b', 'jagow', 'p6a', 'p6b', 'p8a'], every: 25, max: 7, when: { attacked: 800, below: 0.6, capMax: 4900, coh: 45 },
          donor: { str: 1200, coh: 45 }, men: { fill: 0.8, min: 400, max: 1200 }, id: 'feedLigny{n}{donor}', name: "{donor}'s battalions for Ligny", says: '{donor} sends {men} men into Ligny.' },
        { place: 'stamand', donors: ['jagow', 'z1a', 'z1b', 'p7a', 'p7b', 'p5a'], every: 25, max: 7, when: { attacked: 800, below: 0.6, capMax: 3100, coh: 45 },
          donor: { str: 1200, coh: 45 }, men: { fill: 0.8, min: 400, max: 1200 }, id: 'feedStAmand{n}{donor}', name: "{donor}'s battalions for Saint-Amand", says: '{donor} sends {men} men into Saint-Amand.' },
      ] },
  ],
  starts: { '1400': { t: 840, wet0: 0.1 } },
  // a hot day; a thunderstorm in the evening as the Guard went in (the accounts give no times: est. 19:10 to 20:00, smoke lingering after)
  weather: { humidFrom: 1140, vis: [[840, 7000], [1140, 7000], [1150, 2500], [1200, 3000], [1230, 4500]] },
  coalitionNames: { FR: 'French', PR: 'Prussians' }, coalitionAdjectives: { FR: 'French', PR: 'Prussian' },
  // the grade: decisive if the Prussian army breaks while the French hold the Bussy mill (Blücher's post behind Ligny) with no Prussian within
  // 600 m; marginal if at the end the French hold the three brook villages the day was fought for, or the Prussians have drawn off. In 1815 the
  // Prussian centre broke at Ligny about 20:00 and the army drew off in the night, in order, toward Wavre: a French victory short of decisive
  victory: { attacker: 'FR', decisive: { holds: 'bussy', within: 600, morale: 40 }, marginal: { holds: ['ligny'] }, drawnOff: true },
  corpsNames: { vandamme: "Vandamme's III Corps", gerard: "Gérard's IV Corps", guard: 'the Imperial Guard', guardcav: 'the Guard heavy cavalry', pajol: "Pajol's cavalry", exelmans: "Exelmans' cavalry",
    milhaud: "Milhaud's cuirassiers", derlon: "d'Erlon's I Corps", lobau: "Lobau's VI Corps", zieten: "Zieten's I Corps", pirch: "Pirch's II Corps", thielmann: "Thielmann's III Corps" },
  metrics: [
    { id: 'stAmandFall', when: 'taken', place: 'stamand', by: 'FR' }, { id: 'lahayeFall', when: 'taken', place: 'lahaye', by: 'FR' },
    { id: 'lignyFall', when: 'taken', place: 'ligny', by: 'FR' }, { id: 'lignyRetaken', when: 'taken', place: 'ligny', by: 'PR', after: 'lignyFall', every: true },
    { id: 'lignyLast', when: 'taken', place: 'ligny', by: 'FR', every: true }, { id: 'stAmandLast', when: 'taken', place: 'stamand', by: 'FR', every: true }, // the last time each fell
    { id: 'bussyFall', when: 'taken', place: 'bussy', by: 'FR' }, { id: 'tongrinneFall', when: 'taken', place: 'tongrinne', by: 'FR' },
    { id: 'thielmannEngaged', when: 'fires', corps: 'thielmann', at: 'FR' }, { id: 'derlonEngaged', when: 'fires', corps: 'derlon', at: 'PR' },
    { id: 'derlonSeen', when: 'near', corps: 'derlon', place: 'wagnelee', within: 2500, says: 'A column is seen coming in from the west, toward the French left.' },
    { id: 'guardRepulsed', when: 'prestige', side: 'FR', says: 'The Guard is thrown back.' },
  ],
  leaders: [
    { id: 'napoleon', side: 'FR', at: [50.48551, 4.55522] }, { id: 'vandamme', side: 'FR', unit: 'vernier' }, { id: 'girard', side: 'FR', unit: 'piat' },
    { id: 'gerard', side: 'FR', unit: 'rome' }, { id: 'grouchy', side: 'FR', at: [50.4985, 4.6080] }, { id: 'pajol', side: 'FR', unit: 'stlaurent' },
    { id: 'exelmans', side: 'FR', unit: 'burthe' }, { id: 'milhaud', side: 'FR', unit: 'dubois' }, { id: 'drouot', side: 'FR', unit: 'ogGren' },
    { id: 'duhesme', side: 'FR', unit: 'yg1' }, { id: 'lobau', side: 'FR', unit: 'bellair' }, // Lobau rides with his corps, coming up from Charleroi
    { id: 'blucher', side: 'PR', at: [50.5240, 4.5670] }, { id: 'zieten', side: 'PR', at: [50.5170, 4.5620] }, { id: 'pirch', side: 'PR', unit: 'p7a' },
    { id: 'thielmann', side: 'PR', at: [50.5300, 4.6025] },
  ],
  // (4b) what a calibrated engine should give for Ligny fought with the recorded orders (PROPOSED, to be decided with Chris). The sources:
  // French killed and wounded 7,000 to 13,000 (most 8,500 to 12,000); Prussian 12,000 to 25,000 (most about 16,000), with about 8,000 more
  // gone in the night; Saint-Amand taken within about a quarter of an hour of the first attack and fought over all afternoon; Ligny's
  // centre broken by the Guard between 19:45 and 20:30; the Prussians drawing off north in the night in fair order (a French victory,
  // not a rout)
  targets: { runner: 'plan', checks: [
    { what: 'French victories (any)', share: 'French victory', min: 60, max: 95 },
    { what: 'Prussian victories (any)', share: 'Prussian victory', below: 10 },
    { what: 'French killed and wounded (median)', losses: 'FR', median: [8000, 13000] },
    { what: 'Prussian killed and wounded (median)', losses: 'PR', median: [12000, 20000] },
    { what: 'Saint-Amand taken', metric: 'stAmandFall', min: 80 },
    { what: 'Saint-Amand first taken (median)', metric: 'stAmandFall', median: ['14:30', '16:30'] },
    { what: 'Ligny taken', metric: 'lignyFall', min: 60 },
    { what: 'Ligny taken for the last time (median)', metric: 'lignyLast', median: ['19:30', '21:00'] },
    { what: 'Ligny retaken by the Prussians', metric: 'lignyRetaken', min: 30 },
  ] },
  // the historical battle (ai.js): the Prussians are commanded by the generic doctrine with the habits above, and Blücher's counter-strokes
  // from the record below; the French by Napoleon's orders
  commanders: { generic: ['PR'] },
  /* (phase 5, stage 2) the command layer for Ligny played as Napoleon (command.js, orders.js): his corps commanders, where he can stand,
     what he can order. Est. where the accounts say nothing. Grouchy is on the field here, commanding the cavalry of the right wing (Pajol's
     and Exelmans' corps); Ney is at Quatre Bras with the left wing, so there is no field commander between Napoleon and his corps. */
  command: {
    side: 'FR', chief: 'napoleon',
    commanders: { FR: ['napoleon', 'vandamme', 'gerard', 'grouchy', 'drouot', 'milhaud', 'lobau'], PR: ['blucher', 'zieten', 'pirch', 'thielmann'] },
    corpsCmd: { vandamme: 'vandamme', gerard: 'gerard', pajol: 'grouchy', exelmans: 'grouchy', guard: 'drouot', guardcav: 'drouot', milhaud: 'milhaud', lobau: 'lobau', derlon: 'derlon',
      zieten: 'zieten', pirch: 'pirch', thielmann: 'thielmann' },
    defaultCmd: { FR: 'napoleon', PR: 'blucher' },
    up: { zieten: 'blucher', pirch: 'blucher', thielmann: 'blucher' }, // the corps commanders' sightings reach Blücher at the Bussy mill
    eyes: ['napoleon', 'vandamme', 'gerard', 'grouchy', 'drouot', 'blucher', 'zieten', 'pirch', 'thielmann'],
    reporters: ['vandamme', 'gerard', 'grouchy', 'drouot', 'milhaud', 'lobau'],
    reserve: ['drouot', 'milhaud'], // in sight of headquarters: they write when something happens
    askInfantry: ['vandamme', 'gerard'],
    // Napoleon watched from the Naveau mill north of Fleurus (the accounts); the rise south of Ligny, where the Guard's guns stood, is under fire
    posts: {
      naveau: { name: 'the Naveau mill', at: [50.48551, 4.55522] },
      fleurus: { name: 'Fleurus', at: [50.4835, 4.5480], note: 'the rear' },
      rise: { name: 'the rise south of Ligny', at: [50.5045, 4.5715], note: 'under fire', forward: true },
    },
    post0: 'naveau', morningPost: 'naveau',
    arriving: ['lobau', 'derlon'], // a corps still on its road: the rider meets its commander where the road comes on
    // unidentified troops well south of the brook can only be French, well north of it only Prussian (est. boundaries, m from the map's top)
    guess: [{ own: true, as: 'FR', y0: 5000 }, { own: false, as: 'PR', y1: 3500 }],
    toward: { any: [{ y0: 3300 }], facing: { PR: [100, 260] } }, // Prussians coming south over the brook
    intel: { places: [['stamand', 'FR'], ['ligny', 'FR']] },
    corpsName: { zieten: "Zieten's I Corps", pirch: "Pirch's II Corps", thielmann: "Thielmann's III Corps", vandamme: "Vandamme's III Corps", gerard: "Gérard's IV Corps",
      pajol: "Pajol's cavalry", exelmans: "Exelmans' cavalry", grouchy: "Grouchy's cavalry", guard: 'the Guard', guardcav: 'the Guard heavy cavalry', milhaud: "Milhaud's cuirassiers",
      lobau: "Lobau's VI Corps", derlon: "d'Erlon's I Corps" },
    recipients: {
      vandamme: { name: 'Vandamme (III Corps)', kind: 'corps' }, gerard: { name: 'Gérard (IV Corps)', kind: 'corps' }, grouchy: { name: 'Grouchy (the cavalry of the right)', kind: 'cavalry' },
      milhaud: { name: 'Milhaud (IV Cavalry Corps)', kind: 'cavalry' }, drouot: { name: 'Drouot (the Guard)', kind: 'corps' }, lobau: { name: 'Lobau (VI Corps)', kind: 'corps' },
      hq: { name: 'your own headquarters', kind: 'hq' }, army: { name: 'the whole army', kind: 'army' },
    },
    retreatTo: ['vandamme', 'gerard', 'grouchy', 'milhaud', 'drouot', 'lobau'],
    retreat: { on: 'Charleroi', by: 'the Fleurus road', at: 'Fleurus', rearguards: { drouot: 'the Guard', lobau: 'Lobau' } },
    guardAttack: ['ogGren', 'ogChas', 'mgGren', 'mgChas'], // the Guard going in: the prestige attack
  },
  // (phase 5, stage 2) the game page for Ligny: the briefing, what the panels list, the 1815 figures beside the result (est. where marked)
  game: {
    title: 'Napoleon at Ligny', date: '16 juin 1815',
    page: { h1: 'Ligny <span>· Napoleon’s command</span>', lead: 'You are the Emperor on the afternoon of 16 June 1815. You see the field from your post and learn the rest from riders. Every order you give is written, carried across the field and passed down before a single brigade moves.',
      cartouche: 'Bataille de Ligny', mapLabel: "Napoleon's staff map of the Ligny battlefield: his own corps where they last reported, and the enemy where he was last seen." },
    help: {
      ney: '<b>Grouchy.</b> Here Grouchy commands the cavalry of the right wing, Pajol’s and Exelmans’ corps, facing Thielmann on the Prussian left. Ney is away at Quatre Bras with the left wing: there is no field commander between you and your corps.',
      post: '<b>Your post.</b> You start at the Naveau mill above Fleurus, from where you see the whole valley of the Ligny. Fleurus is behind it; the rise south of Ligny is closer to the fighting but under fire. Your staff can also send an aide to look at a place for you.',
      fight: '<b>Fighting it out, and retreating.</b> “To the end…” beside Ride on runs the clock to nightfall with no more stops: Napoleon’s own orders from that hour, or no more orders at all. To break off, write to <i>The whole army (general retreat)</i>: each corps commander gets a letter and marches off toward Charleroi by Fleurus, with the Guard or Lobau as rearguard. The battle is then judged on what you bring away.',
      limits: '<b>Limits.</b> Not in the game: Ney’s battle at Quatre Bras, d’Erlon’s corps beyond its march and recall as they happened, and the Prussian retreat in the night. The roads and some of the places on the map are estimates. The engine is calibrated against history with Napoleon’s own orders, and at Ligny the French losses still run high and Ligny falls too early; it is not a prediction.',
      offline: null },
    helpSwap: [['bombard Hougoumont, then attack it', 'bombard Saint-Amand, then attack it']],
    intro: 'Blücher’s army holds the villages along the Ligny brook, from Wagnelée to Balâtre, with its reserves on the open slopes behind. Ney is at Quatre Bras with the left wing. The battle begins at 14:00 and ends with the dark, or when an army breaks.',
    starts: { '1400': { label: '14:00, as in 1815: a hot day, the ground dry', begin: 'Begin at 14:00',
      brief: '<p><b>The situation at 14:00.</b> Your army faces north across the Ligny brook: Vandamme’s III Corps, with Girard’s division, before Saint-Amand on the left; Gérard’s IV Corps before Ligny in the centre; Grouchy with Pajol’s and Exelmans’ cavalry on the right, watching Tongrinne and Boignée. The Guard and Milhaud’s cuirassiers are in reserve near Fleurus.</p><p>Blücher holds every village along the brook, Saint-Amand and Ligny strongly. Zieten’s and Pirch’s corps stand on the slopes between Brye and the Bussy mill, in full view; Thielmann’s corps holds the left, from Sombreffe to Balâtre. You have about 60,000 men against 80,000.</p><p>Ney has been told to take Quatre Bras and turn on the Prussian right. Lobau’s VI Corps is coming up from Charleroi and will not be here before evening.</p><p>Your headquarters is at the Naveau mill outside Fleurus, from where you see the whole valley. Nothing moves until you order it. Write your first orders, then press Continue.</p>' } },
    corps: ['vandamme', 'gerard', 'grouchy', 'drouot', 'milhaud', 'lobau'],
    corpsTitle: { vandamme: 'Vandamme · III Corps', gerard: 'Gérard · IV Corps', grouchy: 'Grouchy · the cavalry of the right', drouot: 'Drouot · the Guard', milhaud: 'Milhaud · IV Cavalry Corps', lobau: 'Lobau · VI Corps' },
    corpsOf: { vandamme: "Vandamme's III Corps", gerard: "Gérard's IV Corps", grouchy: "Grouchy's cavalry", drouot: 'the Guard', milhaud: "Milhaud's cuirassiers", lobau: "Lobau's VI Corps" },
    short: { army: 'The whole army', vandamme: 'Vandamme', gerard: 'Gérard', grouchy: 'Grouchy', drouot: 'Drouot', milhaud: 'Milhaud', lobau: 'Lobau', hq: 'Headquarters' },
    orderTo: ['vandamme', 'gerard', 'grouchy', 'milhaud', 'drouot', 'lobau', 'hq', 'army'],
    placeGroups: [['The brook villages', ['wagnelee', 'hameau', 'lahaye', 'stamand', 'ligny', 'potriaux', 'tongrenelle', 'boignee', 'balatre']],
      ['Behind the brook', ['brye', 'bussy', 'heights', 'ligneLine', 'westLine', 'sombreffe', 'tongrinne', 'eastLine']],
      ['Our side', ['batteryStAmand', 'batteryLigny', 'guardStaging', 'fleurusRoad', 'fleurus', 'naveau']]],
    gunGroups: [['vandamme', 'Vandamme’s guns'], ['gerard', 'Gérard’s guns'], ['grouchy', 'Grouchy’s horse guns'], ['drouot', 'the Guard’s guns'], ['milhaud', 'Milhaud’s horse guns'], ['lobau', 'Lobau’s guns']],
    sites: ['batteryStAmand', 'batteryLigny'],
    places: ['wagnelee', 'hameau', 'lahaye', 'stamand', 'ligny', 'brye', 'potriaux', 'sombreffe', 'tongrenelle', 'tongrinne', 'boignee', 'balatre'],
    condPlace: 'stamand', obDefaults: { corps: 'gerard', detachTo: 'drouot' },
    history: [['Saint-Amand first taken', 'stAmandFall', '≈15:15'], ['Ligny first taken', 'lignyFall', 'entered ≈15:30, fought over'], ['Ligny taken for the last time', 'lignyLast', '≈19:45–20:30'], ['A column seen on the left (d’Erlon)', 'derlonSeen', '≈17:30'], ['The Guard attacks', 'guardAttack', '≈19:30'], ['Prussian army breaks', 'prBreak', 'not broken: drew off in the night'], ['French army breaks', 'frBreak', 'did not break']],
    losses: [['French', 'FR', '8,500–12,000 (sources 7,000–13,000)'], ['Prussian', 'PR', 'about 16,000 (12,000–25,000), and about 8,000 gone in the night']],
    lossRange: { FR: [8500, 12000, 'French'], PR: [12000, 25000, 'Prussian'] },
    review: [{ id: 'stAmandEarly', metric: 'stAmandFall', before: '14:30', text: 'Saint-Amand fell at {t}, before the first attack went in on the day (about 15:00).' },
      { id: 'lignyEarly', metric: 'lignyLast', before: '17:00', text: 'Ligny fell for the last time at {t}; it held until the Guard went in, about 20:00, on the day.', note: true }],
    moments: [['stAmandFall', 'Saint-Amand falls'], ['lignyFall', 'Ligny falls'], ['lignyRetaken', 'the Prussians retake Ligny'], ['guardAttack', 'the Guard attacks'], ['prBreak', 'the Prussian army breaks'], ['frBreak', 'the French army breaks']],
    views: [['Saint-Amand', 50.5070, 4.5470, 3.6], ['Ligny', 50.5110, 4.5745, 3.6], ['Brye & Bussy', 50.5225, 4.5610, 3.0], ['Sombreffe & Tongrinne', 50.5200, 4.6100, 2.6], ['Fleurus', 50.4880, 4.5520, 3.0], ['Whole field', 50.5110, 4.5800, 1.0]],
    enemyDecisions: 'Blücher’s decisions',
    hqLeaders: ['napoleon', 'blucher'],
    groups: [{ t: 'III CORPS', side: 'FR', corps: 'vandamme', dy: 260 }, { t: 'IV CORPS', side: 'FR', corps: 'gerard', dy: 240 }, { t: 'GARDE', side: 'FR', corps: 'guard', dy: 220 },
      { t: 'PAJOL', side: 'FR', corps: 'pajol', dy: 170 }, { t: 'EXELMANS', side: 'FR', corps: 'exelmans', dy: 170 }, { t: 'IV CAV', side: 'FR', corps: 'milhaud', dy: 170 }, { t: 'VI CORPS', side: 'FR', corps: 'lobau', dy: 200 },
      { t: 'ZIETEN', side: 'PR', corps: 'zieten', dy: -260 }, { t: 'PIRCH', side: 'PR', corps: 'pirch', dy: -260 }, { t: 'THIELMANN', side: 'PR', corps: 'thielmann', dy: -260 }],
    offGroups: [['derlon', 'd’Erlon · I Corps', 50.5100, 4.4900, 'FR'], ['lobau', 'Lobau · VI Corps', 50.4600, 4.5380, 'FR']],
    keyPlaces: ['Ligny', 'Saint-Amand', 'Brye', 'Sombreffe'],
    edgeLabels: [['Tilly · Wavre', 50.5460, 4.5720, 'n'], ['Charleroi 12 km', 50.4730, 4.5435, 's']],
    waterLabels: [['le ruisseau de Ligny', 50.5090, 4.5900, 0]],
    letters: { place: 'Au quartier impérial', date: 'le 16 juin 1815',
      address: { vandamme: 'Monsieur le Comte Vandamme', gerard: 'Monsieur le Comte Gérard', grouchy: 'Monsieur le Maréchal Comte de Grouchy', drouot: 'Monsieur le Comte Drouot', milhaud: 'Monsieur le Comte Milhaud', lobau: 'Monsieur le Comte de Lobau', army: 'Messieurs les Commandants des corps d’armée' },
      signed: { vandamme: 'Cte Vandamme', gerard: 'Cte Gérard', grouchy: 'Le Maréchal Cte de Grouchy', drouot: 'Cte Drouot', milhaud: 'Cte Milhaud', lobau: 'Cte de Lobau' } },
    // the staff at Napoleon's side (the same officers as on the 18th), and what they may say from what headquarters knows (paraphrase, est.)
    staff: { officers: { soult: 'Soult, major-général', drouot: 'Drouot, commanding the Guard', flahaut: 'Flahaut, aide-de-camp', labedoyere: 'La Bédoyère, aide-de-camp', gourgaud: 'Gourgaud, aide-de-camp' },
      chief: 'soult', guard: 'drouot', road: 'the road to Charleroi',
      remarks: [
        { id: 'slopes', who: 'soult', when: { briefing: true }, text: 'Their reserves stand on the forward slopes behind the villages, Sire, in full view of our guns.' },
        { id: 'stamand', who: 'gourgaud', when: { place: 'stamand', holder: 'FR' }, text: 'Saint-Amand is ours, Sire. Vandamme will be asking to push on to la Haye.' },
        { id: 'ligny', who: 'soult', when: { place: 'ligny', holder: 'FR' }, text: 'Ligny is ours, Sire. Their centre behind it is open, if the Guard goes in now.' },
        { id: 'guard', who: 'drouot', when: { attackWith: { to: 'drouot', ids: ['ogGren', 'ogChas', 'mgGren', 'mgChas'] } }, text: 'The Old and Middle Guard are going in, Sire. Only the Young Guard and the cavalry remain in hand.' },
        'generic:quiet', 'generic:ack', 'generic:losses', 'generic:dusk', 'generic:retreat',
        { id: 'idle', who: 'soult', when: { after: '14:45', noOrders: true }, text: 'Every hour we wait, Sire, is an hour more for the Prussians to come up, and an hour less of daylight to finish them.' } ] },
  },
  // (phase 3c) plans: what the record says the commanders did, as rules (plans.js), straight out as orders (via 'order': each rule names the
  // brigades, as the record does; the lab and the game fight the same orders). The accounts give the times things happened; an order takes about half an hour to write,
  // ride and be acted on, so each rule is set about 30 min before the time it records (est. to the quarter hour where the accounts disagree)
  plans: {
    historical: { id: 'historical', side: 'FR', as: 'napoleon', via: 'order', rules: [
      // the guns fire on the villages and over them on the Prussian masses on the slope behind, in full view (Wellington's remark that they
      // would be 'damnably mauled'): their area is the slope above the brook
      { id: 'gunsStAmand', at: '14:00', order: { to: 'vandamme', kind: 'bombard', units: ['a3div', 'a3res', 'aGir'], site: 'batteryStAmand', area: 'ligneLine', opens: true, text: "Vandamme's guns open on Saint-Amand and the slope behind it." } },
      { id: 'gunsLigny', at: '14:00', order: { to: 'gerard', kind: 'bombard', units: ['a4div', 'a4res'], site: 'batteryLigny', area: 'ligneLine', text: "Gérard's guns open on Ligny and the slope behind it." } },
      { id: 'gunsEast', at: '14:15', order: { to: 'grouchy', kind: 'bombard', units: ['aHPaj', 'aHExe'], area: 'eastLine', text: "Grouchy's horse guns fire on Thielmann's line." } },
      { id: 'stamand', at: '14:10', order: { to: 'vandamme', kind: 'attack', obj: 'stamand', units: ['vernier', 'corsin'], supports: ['dufour', 'lagarde'], form: 'attack', maxAttempts: 4,
        text: "The Guard's three signal guns fire: Lefol's division goes in against Saint-Amand." } },
      { id: 'ligny', at: '14:35', order: { to: 'gerard', kind: 'attack', obj: 'ligny', units: ['rome', 'lecapitaine', 'schoeffer'], supports: ['desprez'], form: 'attack', maxAttempts: 4, text: 'Gérard sends three columns against Ligny.' } },
      { id: 'lahaye', at: '15:00', order: { to: 'girard', kind: 'attack', obj: 'lahaye', units: ['devilliers', 'piat'], form: 'attack', maxAttempts: 4, text: 'Girard attacks Saint-Amand-la-Haye from the west.' } },
      { id: 'potriaux', at: '15:15', order: { to: 'gerard', kind: 'attack', obj: 'potriaux', units: ['baume'], supports: ['toussaint'], form: 'attack', maxAttempts: 3, text: 'Hulot attacks the Prussian posts at Mont-Potriaux.' } },
      // the fight in the villages went on all afternoon: Vandamme and Gérard renewed their attacks while the Prussians held (est. hourly)
      { id: 'stamand2', at: '15:45', when: { place: 'stamand', holder: 'notOurs' }, order: { to: 'vandamme', kind: 'attack', obj: 'stamand', units: ['vernier', 'corsin', 'dufour', 'lagarde'], form: 'attack', maxAttempts: 3, text: 'Vandamme sends Lefol and Berthezène at Saint-Amand again.' } },
      { id: 'ligny2', at: '16:00', when: { place: 'ligny', holder: 'notOurs' }, order: { to: 'gerard', kind: 'attack', obj: 'ligny', units: ['rome', 'lecapitaine', 'schoeffer', 'desprez'], form: 'attack', maxAttempts: 3, text: 'Gérard renews the attack on Ligny.' } },
      { id: 'ligny3', at: '17:15', when: { place: 'ligny', holder: 'notOurs' }, order: { to: 'gerard', kind: 'attack', obj: 'ligny', units: ['rome', 'lecapitaine', 'schoeffer', 'desprez', 'baume', 'toussaint'], form: 'attack', maxAttempts: 3, text: 'Gérard throws Hulot into Ligny beside Pécheux and Vichery.' } },
      { id: 'stamand3', at: '17:00', when: { place: 'stamand', holder: 'notOurs' }, order: { to: 'vandamme', kind: 'attack', obj: 'stamand', units: ['vernier', 'corsin', 'dufour', 'lagarde'], form: 'attack', maxAttempts: 3, text: 'Vandamme renews the attack on Saint-Amand.' } },
      { id: 'ligny4', at: '18:30', when: { place: 'ligny', holder: 'notOurs' }, order: { to: 'gerard', kind: 'attack', obj: 'ligny', units: ['rome', 'lecapitaine', 'schoeffer', 'desprez', 'baume', 'toussaint'], form: 'attack', maxAttempts: 2, text: "Gérard's men go into Ligny once more." } },
      { id: 'habert', at: '16:45', when: { any: [{ place: 'stamand', holder: 'notOurs' }, { place: 'lahaye', holder: 'notOurs' }] },
        order: { to: 'vandamme', kind: 'attack', obj: 'lahaye', units: ['gengoult', 'dupeyroux'], form: 'attack', maxAttempts: 3, text: "Vandamme sends Habert's division to la Haye." } },
      { id: 'youngGuard', at: '17:30', when: { any: [{ place: 'stamand', holder: 'notOurs' }, { place: 'lahaye', holder: 'notOurs' }] },
        order: { to: 'duhesme', kind: 'attack', obj: 'stamand', units: ['yg1', 'yg2'], form: 'attack', maxAttempts: 3, text: 'The Young Guard goes to help Vandamme at Saint-Amand.' } },
      // the Guard's attack on Ligny, held back an hour by the alarm over d'Erlon's column: 60 guns open, then the Guard with Gérard's
      // divisions, Milhaud's cuirassiers and the Guard's heavy horse go in through the village in the storm
      { id: 'guardUp', at: '17:00', order: { to: 'drouot', kind: 'advance', obj: 'guardStaging', units: ['ogGren', 'ogChas', 'mgGren', 'mgChas'], form: 'columns', text: 'The Guard moves up toward Ligny.' } },
      { id: 'gunsGuard', at: '19:00', order: { to: 'drouot', kind: 'bombard', units: ['aGuard', 'aGuardRes'], site: 'batteryLigny', area: 'ligny', text: 'Sixty guns open on Ligny.' } },
      { id: 'guardLigny', at: '19:15', order: { to: 'drouot', kind: 'attack', obj: 'ligny', units: ['ogGren', 'ogChas'], supports: ['mgGren', 'mgChas'], form: 'attack', maxAttempts: 3, guard: true,
        text: 'The Guard goes in against Ligny.' } },
      { id: 'gerardAgain', at: '19:15', order: { to: 'gerard', kind: 'attack', obj: 'ligny', units: ['rome', 'lecapitaine', 'schoeffer', 'desprez'], form: 'attack', maxAttempts: 3, text: "Gérard's divisions go in again beside the Guard." } },
      { id: 'cuirassiers', at: '19:30', order: { to: 'milhaud', kind: 'cavRaid', units: ['dubois', 'travers', 'farine', 'vial', 'ggren', 'gdrag'], area: 'heights', maxCharges: 4,
        text: "Milhaud's cuirassiers and the Guard's heavy horse ride through Ligny onto the Prussian centre." } },
      { id: 'heights', at: '19:45', when: { place: 'ligny', holder: 'ours' }, order: { to: 'drouot', kind: 'attack', obj: 'heights', units: ['ogGren', 'ogChas', 'mgGren', 'mgChas'], form: 'attack', maxAttempts: 2,
        text: 'The Guard climbs out of Ligny onto the heights behind it.' } },
    ] },
    // Blücher's counter-strokes, as the record has them: II Corps on the right against the French left about 17:00, Thielmann's push down
    // the Fleurus road about 18:00, and the last effort at Saint-Amand about 19:00 (installed with the historical plan: script.js; and in
    // the game from the start, since the computer commands Blücher whatever the player does: replay.js)
    blucher: { id: 'blucher', side: 'PR', as: 'blucher', via: 'order', withHistorical: true, rules: [
      { id: 'tippelskirch', at: '16:15', order: { to: 'pirch', kind: 'attack', obj: 'hameau', units: ['p5a', 'p5b'], form: 'attack', maxAttempts: 3, text: "Blücher sends Tippelskirch's brigade round by Wagnelée against the French left." } },
      { id: 'brause', at: '16:30', order: { to: 'pirch', kind: 'attack', obj: 'lahaye', units: ['p7a', 'p7b'], form: 'attack', maxAttempts: 3, text: "Brause's brigade goes in at la Haye." } },
      { id: 'thielmann', at: '17:30', order: { to: 'thielmann', kind: 'attack', obj: 'fleurusRoad', units: ['t11'], form: 'attack', maxAttempts: 2, text: 'Thielmann sends Luck’s brigade down the Fleurus road.' } },
      { id: 'lastEffort', at: '18:30', when: { place: 'stamand', holder: 'notOurs' }, order: { to: 'zieten', kind: 'attack', obj: 'stamand', units: ['z1a', 'z1b', 'z2a', 'z2b'], form: 'attack', maxAttempts: 2,
        text: 'Blücher leads a last effort against Saint-Amand.' } },
    ] },
    // (stage 2) d'Erlon's recall was Ney's order from Quatre Bras, not Napoleon's: part of the battle whoever commands the French
    // (always: installed with the recorded orders and in the game from the start). offField: no rider crosses this map with it
    ney: { id: 'ney', side: 'FR', as: 'ney', via: 'order', always: true, rules: [
      { id: 'derlonRecalled', at: '18:30', order: { unitTo: 'schmitz', kind: 'retire', units: ['nogues', 'grenier', 'schmitz', 'aulard'], exit: [50.5085, 4.5085], writeMin: 0, rideMin: 0, offField: true,
        text: "Ney's orders reach d'Erlon: his corps turns back toward Frasnes, leaving Durutte's division and Jacquinot's cavalry." } },
    ] },
  },
  map: { STRONGPOINTS, OBJECTIVES, ROUTES },
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
