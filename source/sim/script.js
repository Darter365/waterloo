/* Napoleon's historical orders on 18 June, given through the order builder as a player would give them,
   and timed by what Napoleon himself believes rather than by the true state of the battle.
   Times follow the standard accounts; where they disagree I take the usual middle reading. */
(function (root) {
'use strict';
const hyp = Math.hypot;

// opt.from: the player hands over at that minute ("fight it out to the end"): orders Napoleon gave before then are history, and only
// the later ones, and those that wait on events (the Guard to Plancenoit), are still to come
function historical(E, opt) {
  const C = E.command, B = C.B.napoleon, S = { done: {}, at: {} };
  const ours = sp => B.places[sp] && B.places[sp].holder === 'FR';
  const enemyHolds = sp => B.places[sp] && B.places[sp].holder && B.places[sp].holder !== 'FR';
  // something in the east: unidentified troops or Prussians, beyond Frischermont, in Napoleon's record
  const eastTroops = () => [...B.c.values()].some(c => (c.side === 'PR' || !c.side) && c.x > E.ll2m(50.68, 4.445)[0] && c.str > 1000);
  const prisonerSaysBulow = () => B.knownCorps && B.knownCorps.bulow;
  const ownCoh = id => { const o = B.own.get(id); return o && o.tState >= 0 ? o : null; };
  const shaken = id => { const o = ownCoh(id); return o && (o.status === 'broken' || o.coh < 40); };
  const garrisonOf = sp => [...B.own.values()].find(o => o.task === 'garrison' && o.sp === sp && !o.gone);
  const pool1 = ['bourgeois', 'charlet', 'schmitz', 'aulard', 'nogues', 'grenier'];
  const pool3 = ['schmitz', 'aulard', 'bourgeois', 'charlet', 'nogues', 'grenier', 'husson', 'campi', 'gauthier', 'jamin'];
  // (6) the 05:00 start: the army goes to its ground as each corps comes up (est.: the times only follow the accounts that the
  // army was not all in place at 09:00 and was drawn up by about 11:00); Napoleon goes forward to Rossomme
  const arrived = cid => [...E.units].filter(u => u.side === 'FR' && E.command && (cid === 'drouot' ? (u.corps === 'guard' || u.corps === 'guardcav') : u.corps === cid)).every(u => B.own.has(u.id));
  const dawn = E.scenario === '0500' ? [
    { id: 'depDerlon', at: 6 * 60, spec: { to: 'derlon', action: 'advance', objective: { place: 'depOwn' } } },
    { id: 'depMilhaud', at: 6 * 60, spec: { to: 'milhaud', action: 'advance', objective: { place: 'depOwn' } } },
    { id: 'depReille', at: 8 * 60, when: () => arrived('reille'), spec: { to: 'reille', action: 'advance', objective: { place: 'depOwn' } } },
    { id: 'depKell', at: 8 * 60 + 30, when: () => arrived('kellermann'), spec: { to: 'kellermann', action: 'advance', objective: { place: 'depOwn' } } },
    { id: 'depLobau', at: 9 * 60, when: () => arrived('lobau'), spec: { to: 'lobau', action: 'advance', objective: { place: 'depOwn' } } },
    { id: 'depGuard', at: 9 * 60 + 15, spec: { to: 'drouot', action: 'advance', objective: { place: 'depOwn' } } },
    { id: 'hqRossomme', at: 9 * 60 + 30, spec: { to: 'hq', action: 'moveHQ', post: 'rossomme' } },
  ] : [];
  const steps = dawn.concat([
    { id: 'hougoumont', at: 11 * 60 + 5, spec: { to: 'reille', action: 'attack', objective: { place: 'hougoumont' }, with: ['bauduin'], manner: { formation: 'attack', losses: 'any' }, text: 'Reille: Prince Jérôme to clear the wood of Hougoumont.' } },
    { id: 'reilleGuns', at: 11 * 60 + 10, spec: { to: 'reille', action: 'bombard', objective: { place: 'ridgeWest' }, with: ['aBach', 'aFoy', 'aJer', 'aIIres'], manner: { site: 'here' } } },
    { id: 'grandBattery', at: 11 * 60 + 15, spec: { to: 'grandBattery', action: 'bombard', objective: { place: 'ridgeEast' }, manner: { site: 'batterySiteA', facing: 344 }, text: 'The grand battery forms in front of I Corps.' } },
    // Soult's letter of about 13:00 to Grouchy: come toward us, but it also spoke of Wavre (accounts differ on how clearly)
    { id: 'grouchy', at: 13 * 60, spec: { to: 'grouchy', action: 'marchToGuns', ambiguity: 0.3, text: "Soult writes to Grouchy to manoeuvre toward the army's right." } },
    { id: 'east', by: 13 * 60 + 15, when: () => E.t >= 13 * 60 + 15 || (E.t >= 12 * 60 + 45 && (eastTroops() || prisonerSaysBulow())), spec: { to: 'lobau', action: 'advance', objective: { place: 'eastFlank' }, with: ['bellair', 'thevenet', 'bony', 'tromelin', 'dommanget', 'vinot', 'colbert', 'merlin', 'aVI'], manner: { formation: 'columns', facing: 70 }, text: 'Lobau, Domon and Subervie to face east toward Saint-Lambert.' } },
    { id: 'derlon', at: 13 * 60 + 30, spec: { to: 'derlon', action: 'attack', objective: { place: 'ridgeEast' }, with: { lead: ['charlet', 'schmitz', 'nogues'], support: ['aulard', 'grenier'] }, manner: { losses: 'normal' }, text: "d'Erlon's corps goes forward against the ridge east of the road.", onAct: E2 => { E2.flags.alliedEngaged = E2.t; } } },
    { id: 'derlonLhs', at: 13 * 60 + 30, spec: { to: 'derlon', action: 'attack', objective: { place: 'lhs' }, with: ['bourgeois'], manner: { formation: 'attack', losses: 'heavy' } } },
    { id: 'derlonPap', at: 13 * 60 + 30, spec: { to: 'derlon', action: 'attack', objective: { place: 'papelotte' }, with: { lead: ['pegot'], support: ['brue'] }, manner: { formation: 'attack', losses: 'heavy' } } },
    { id: 'lhs2', at: 15 * 60, when: () => !ours('lhs'), spec: { to: 'ney', action: 'attack', objective: { place: 'lhs' }, with: { pool: pool1, n: 1 }, manner: { formation: 'attack', losses: 'heavy' }, text: 'Ney is to take La Haye Sainte.' } },
    { id: 'lhs3', at: 17 * 60 + 30, when: () => !ours('lhs'), spec: { to: 'ney', action: 'attack', objective: { place: 'lhs' }, with: { pool: pool3, n: 3 }, manner: { formation: 'attack', losses: 'any', bring: ['sappers'] }, text: 'Ney: La Haye Sainte at all costs, with Donzelot and the engineers.' } },
    { id: 'yg', when: () => enemyHolds('plancenoit') || (() => { const g = garrisonOf('plancenoit'); return g && (g.coh < 35 || g.status === 'broken'); })(), spec: { to: 'drouot', action: 'attack', objective: { place: 'plancenoit' }, with: ['yg1', 'yg2'], manner: { formation: 'attack', losses: 'any' }, text: 'The Young Guard to retake Plancenoit.' } },
    { id: 'og', when: () => S.done.yg && E.t - S.done.yg > 40 && (enemyHolds('plancenoit') || ['yg1', 'yg2'].every(id => shaken(id))), spec: { to: 'drouot', action: 'attack', objective: { place: 'plancenoit' }, with: ['g2gren', 'g2chas'], manner: { formation: 'attack', losses: 'heavy' }, text: 'Two battalions of the Old Guard to Plancenoit.' } },
    // Napoleon rides forward to La Belle Alliance to send the Guard in
    { id: 'hqForward', at: 18 * 60 + 30, spec: { to: 'hq', action: 'moveHQ', post: 'ba' } },
    { id: 'guard', at: 19 * 60, spec: { to: 'drouot', action: 'attack', objective: { place: 'ridgeRightCentre' }, with: ['g3gren', 'g4gren', 'g3chas', 'g4chas'], manner: { formation: 'attack', losses: 'light' }, text: 'The Middle Guard to attack the allied right-centre, Ney at its head.', onAct: E2 => { E2.flags.guardAttacking = E2.t; E2.metrics.guardAttack = E2.t; E2.leaders.ney.unit = 'g3gren'; } } },
  ]);
  if (opt && opt.from != null) for (const st of steps) { const due = st.at ?? st.by; if (due != null && due < opt.from) S.done[st.id] = -1; }
  C.script = function () {
    for (const st of steps) {
      if (S.done[st.id]) continue;
      if (st.at != null && E.t < st.at) continue;
      if (st.when && !st.when()) continue;
      const r = C.order(Object.assign({}, st.spec));
      S.done[st.id] = E.t;
      if (!r.ok) E.logEvent('orders', `Script order ${st.id} refused: ${r.error}`, { side: 'FR', hidden: true });
      else { S.at[st.id] = r.order; for (const o of r.orders || [r.order]) o.byScript = true; }
    }
  };
  C.scriptState = S;
  return S;
}

root.WScript = { historical };
if (typeof module !== 'undefined' && module.exports) module.exports = root.WScript;
})(typeof globalThis !== 'undefined' ? globalThis : this);
