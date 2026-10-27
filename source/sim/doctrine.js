/* Generic commanders (engine roadmap, phase 3b). Any battle's armies fight from their objectives and their leaders' settings, with no
   code written for the battle: an army that attacks bombards and storms the objectives worth most to it, renews the attack while its
   men have the heart for it, and throws in its reserves where the enemy is giving way; an army that defends holds its line, feeds the
   garrisons of the places that matter, plugs a sagging front with its reserves, retakes what was abandoned, lets its horse fall on
   shaken attackers, and goes over to the advance when the enemy breaks. Either withdraws when its morale fails.
   Every choice is made from what the deciding commander knows (his belief record when the command layer runs; his side's sightings
   otherwise) and goes out as an order by rider (E.sendOrder), so delay and fog apply. The numbers below are est.: they shape how a
   doctrine plays and are tuned on the test battles, not on Waterloo. Leader settings (leader files) modulate them.
   Battle pack, per side: posture ('attack' or 'defend'), reserve (corps held back), line (an objective key: the line it defends).
   Plan rules (plans.js) run alongside for anything a battle's record says its commanders did. */
(function (root) {
'use strict';
const req = n => (typeof require === 'function' ? require(n) : null);
const AI = () => root.WAI || req('./ai.js');
const hyp = Math.hypot;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DECIDE = 5;            // ticks between a commander's decisions (10 minutes), times his tempo
const FEED_EVERY = 25, FEED_MAX = 7, REOCC_EVERY = 40, REOCC_MAX = 2; // minutes, counts (est.)
const PREP = 40;             // minutes of bombardment before an attack, less with aggression (est.)
const WITHDRAW_MORALE = 25, ADVANCE_BROKEN = 6;
const GUN_RANGE = 900;       // guns preparing an attack come up to this far from the objective (est.: inside a 6-pounder's long range)
const GIVE_UP_MORALE = 50;   // an attacker whose line and reserve are spent calls the attack off below this morale, or at sunset (est.)
const RETAKE_EVERY = 60;     // minutes between a defender's tries to retake a place it lost (est.)

function make(opts = {}) {
  const S = {}; // per side: what its commanders have decided
  const ai = {
    S, generic: true,
    init(E) {
      E.ai = ai; E.plan = E.plan || { steps: [], done: {} };
      const sides = opts.sides || E.sideIds;
      for (const sd of E.sides) {
        if (!sides.includes(sd.id)) continue;
        const st = S[sd.id] = { posture: sd.posture || 'defend', reserve: new Set(), fed: {}, reocc: {}, attack: {}, prepFrom: null, next: 0, advanced: false, withdrawn: false };
        const mine = E.units.filter(u => u.side === sd.id && u.onMap);
        for (const u of mine) if (!u.task || u.task.kind === 'hold') u.task = { kind: 'hold', since: E.t, lieDown: !!(E.nations[u.nat] || {}).lieDown };
        // reserves: the corps the battle names, else the third of the foot furthest from the enemy
        const resCorps = sd.reserve || [];
        if (resCorps.length) for (const u of mine) { if (resCorps.includes(u.corps)) st.reserve.add(u.id); }
        else {
          const foe = centroid(E.units.filter(u => u.onMap && E.isEnemy(u, mine[0] || u)));
          const foot = mine.filter(u => E.era.arms[u.arm].holds && !u.held).sort((a, b) => dist(b, foe) - dist(a, foe));
          for (const u of foot.slice(0, Math.floor(foot.length / 3))) st.reserve.add(u.id);
        }
      }
      return ai;
    },
    tick(E) {
      AI().unitControl(E);
      for (const [side, st] of Object.entries(S)) {
        const chief = chiefOf(E, side);
        if (E.t < st.next) continue;
        st.next = E.t + DECIDE * 2 * (chief ? chief.tempo || 1 : 1);
        if (!st.withdrawn && E.morale[side] < WITHDRAW_MORALE && !partnerEngaged(E, side)) { withdraw(E, side, st); continue; }
        if (st.posture === 'attack') attack(E, side, st, chief); else defend(E, side, st, chief);
        cavalry(E, side, st);
      }
      if (E.plans) E.plans.tick(E);
    },
    receive(E, o) { AI().apply(E, o); },
    onArrival(E, u) { arrival(E, u, S[u.side]); },
  };
  return ai;
}

/* ----- what the commanders know ----- */
const dist = (u, p) => p ? hyp(u.x - p[0], u.y - p[1]) : 0;
const centroid = us => us.length ? [us.reduce((a, u) => a + u.x, 0) / us.length, us.reduce((a, u) => a + u.y, 0) / us.length] : null;
function chiefOf(E, side) { const id = (E.sides.find(s => s.id === side) || {}).chief; return id && E.leaders[id] ? E.leaders[id] : Object.values(E.leaders).find(l => l.side === side && l.rank === 3) || null; }
function leaderOf(E, side, corps) { return Object.values(E.leaders).find(l => l.side === side && (l.corps === corps || l.id === corps)) || chiefOf(E, side); }
const seen = (E, side, maxAge, pred) => { const ch = chiefOf(E, side); return AI().known(E, ch ? ch.id : null, maxAge, c => (c.side ? E.coalition[c.side] !== E.coalition[side] : true) && (!pred || pred(c)), E.coalition[side]); };
function partnerEngaged(E, side) { return E.sideIds.some(s => s !== side && E.coalition[s] === E.coalition[side] && E.engaged && Object.keys(E.engaged).some(k => E.units.some(u => u.side === s && u.corps === k))) || E.sideIds.some(s => s !== side && E.coalition[s] === E.coalition[side] && E.flags[s.toLowerCase() + 'Engaged']); }
const formedOf = (E, side) => E.units.filter(u => u.side === side && E.formed(u) && u.onMap);
const isFoot = (E, u) => E.era.arms[u.arm].move === 'foot' && !u.held;
const isHorse = (E, u) => !!E.era.arms[u.arm].charges;
const isGuns = (E, u) => !!E.era.arms[u.arm].crew;
function objValue(E, o) { return o.value ?? (o.sp && E.spById[o.sp] ? E.spById[o.sp].value || 0 : 0); }
function objHolder(E, side, o) { // who holds it, as the side's chief believes
  if (o.sp) { const ch = chiefOf(E, side); return AI().placeHolder(E, ch ? ch.id : null, o.sp); }
  if (o.line) return o.takenAt ? o.by : o.holder;
  return null;
}
// a commander's order to some of his units, by rider
function order(E, side, corps, spec) {
  const L = leaderOf(E, side, corps), ch = chiefOf(E, side);
  E.sendOrder(Object.assign({ id: `d${side}${E.t}_${(E.dOrders = (E.dOrders || 0) + 1)}`, from: ch ? ch.id : (L ? L.id : null), to: L ? L.id : null, direct: L === ch }, spec));
}

/* ----- attack ----- */
// the objectives worth most to the army, held by the enemy (or nobody), nearest first among equals
function targets(E, side, here) {
  const coal = E.coalition[side];
  return Object.entries(E.objectives).map(([k, o]) => ({ k, o, v: objValue(E, o), h: objHolder(E, side, o) })).filter(x => x.v > 0 && x.h !== coal && x.o.point)
    .sort((a, b) => b.v - a.v || dist({ x: here[0], y: here[1] }, a.o.point) - dist({ x: here[0], y: here[1] }, b.o.point));
}
// a corps still coming up (units yet to reach the field, or marching on it) waits until it has all arrived, unless the day is late
function coming(E, side, corps) { return E.t < E.light.sunset - 180 && E.units.some(u => u.side === side && (u.corps || side) === corps && !u.gone && u.str > 0 && (!u.onMap || u.task.kind === 'march')); }
function attack(E, side, st, chief) {
  const agg = chief ? chief.agg : 0.6, mine = formedOf(E, side);
  if (!mine.length) return; // nothing on the field yet
  const here = centroid(mine), objs = targets(E, side, here);
  if (!objs.length) return;
  if (st.prepFrom == null) st.prepFrom = E.t;
  guns(E, side, st, objs, mine);
  if (E.t - st.prepFrom < PREP * (1.2 - agg)) return;
  if (E.t > E.light.dark) return; // no new attacks in the dark
  // each corps not in reserve goes for an objective: the nearest of the most valuable; it renews the attack while it has the heart
  const corpsOf = groupBy(mine.filter(u => isFoot(E, u) && !st.reserve.has(u.id)), u => u.corps || side);
  let inFight = 0;
  for (const [corps, us] of Object.entries(corpsOf)) {
    if (coming(E, side, corps)) { inFight++; continue; }
    const L = leaderOf(E, side, corps), keen = L ? L.agg : 0.6, c = centroid(us);
    const a = st.attack[corps];
    if (a && us.some(u => u.task.kind === 'attack' || u.task.kind === 'support')) { inFight++; continue; } // still going in
    if (a && a.n >= 1 + Math.round(3 * keen)) continue; // spent: it has gone in as often as its general will take it
    inFight++;
    if (a && us.reduce((s, u) => s + u.coh, 0) / us.length < 55) continue; // not yet rallied
    const tgt = a ? objs.find(x => x.k === a.k) || objs[0] : objs.slice(0, 3).sort((x, y) => dist({ x: c[0], y: c[1] }, x.o.point) - dist({ x: c[0], y: c[1] }, y.o.point))[0];
    const fresh = us.filter(u => u.coh >= 50 && u.task.kind !== 'garrison').sort((x, y) => dist(x, tgt.o.point) - dist(y, tgt.o.point));
    if (!fresh.length) continue;
    const lead = fresh.slice(0, Math.max(1, Math.ceil(fresh.length / 2))), sup = fresh.slice(lead.length);
    st.attack[corps] = { k: tgt.k, n: (a ? a.n : 0) + 1, t: E.t };
    order(E, side, corps, { kind: 'attack', obj: tgt.k, units: lead.map(u => u.id), supports: sup.map(u => u.id), form: 'attack', maxAttempts: 1 + Math.round(2 * keen) });
  }
  // the reserve goes in where the enemy is giving way (an objective whose defenders are seen shaken), or, once the line is spent, to
  // try once more while there is daylight; chance per decision by the chief's readiness to commit it (leader file)
  const res = [...st.reserve].map(id => E.byId[id]).filter(u => u && E.formed(u) && u.onMap);
  if (res.length && chief) {
    const weak = objs.find(x => { const p = x.o.point; return seen(E, side, 20, c => hyp(c.x - p[0], c.y - p[1]) < 400 && (c.status === 'broken' || c.status === 'disordered')).length > 0; });
    const last = !inFight && E.t < E.light.sunset - 60 && E.morale[side] >= 40;
    const tgt = weak || (last ? objs[0] : null), ready = chief.reserve ?? 0.5;
    if (tgt && E.rnd('commit the reserve') < ready * (weak ? 0.3 : 0.5)) {
      for (const u of res) st.reserve.delete(u.id);
      const foot = res.filter(u => isFoot(E, u)), byCorps = groupBy(foot, u => u.corps || side);
      for (const [corps, us] of Object.entries(byCorps)) { order(E, side, corps, { kind: 'attack', obj: tgt.k, units: us.map(u => u.id), form: 'attack', maxAttempts: 2 }); st.attack[corps] = { k: tgt.k, n: 1, t: E.t }; }
      E.logEvent('orders', `${chief.name} throws in his reserve against ${tgt.o.name}.`, { side, important: true });
      return;
    }
  }
  // the attack has failed: line spent, reserve gone in or never sent, the men disheartened or the sun down; the attacker calls it off
  if (!inFight && !st.withdrawn && !mine.some(u => u.task.kind === 'attack' || u.task.kind === 'support') && (E.morale[side] < GIVE_UP_MORALE || E.t > E.light.sunset)
    && (!res.length || E.t > E.light.sunset) && E.sides.find(x => x.id === side).exit && E.rnd('call off the attack') < 0.3) {
    E.logEvent('orders', `${chief ? chief.name : 'The commander'} calls off the attack.`, { side, important: true });
    withdraw(E, side, st);
  }
}
// the guns: every idle battery bombards the objective its corps is attacking (the army's first, before), from within range of it, and
// turns to the next once that one is taken
function guns(E, side, st, objs, mine) {
  const coal = E.coalition[side];
  const idle = mine.filter(u => isGuns(E, u) && (u.task.kind === 'hold' || (u.task.kind === 'bombard' && u.task.areaKey && objHolder(E, side, E.objectives[u.task.areaKey] || {}) === coal)) && !u.path);
  if (!idle.length) return;
  const byCorps = groupBy(idle, u => u.corps || side);
  for (const [corps, us] of Object.entries(byCorps)) {
    const a = st.attack[corps], tgt = (a && objs.find(x => x.k === a.k)) || objs[0], p = tgt.o.point;
    const sites = us.map(u => { const d = dist(u, p); if (d <= GUN_RANGE) return [u.x, u.y]; const f = (d - GUN_RANGE) / d; return [u.x + (p[0] - u.x) * f, u.y + (p[1] - u.y) * f]; });
    order(E, side, corps, { kind: 'bombard', units: us.map(u => u.id), area: tgt.k, sitePoints: sites, opens: true });
  }
}

/* ----- defence ----- */
function defend(E, side, st, chief) {
  const coal = E.coalition[side], mine = formedOf(E, side);
  // the garrisons of the places that matter are fed from the nearest foot while they are attacked (decided on the spot)
  for (const sp of E.sps) {
    if (!sp.value || sp.holder !== coal) continue;
    const g = E.byId[sp.garrison]; if (!g || !E.formed(g) || g.side !== side) continue;
    const f = st.fed[sp.id] || (st.fed[sp.id] = { n: 0, t: -99 });
    if (f.n >= FEED_MAX || E.t - f.t < FEED_EVERY) continue;
    const cap = sp.secs.filter(s => s.held === coal && !s.burnt).reduce((a, s) => a + s.cap, 0);
    const attacked = E.near(g.x, g.y, 600, e => E.isEnemy(g, e) && E.formed(e) && isFoot(E, e)).length > 0;
    if (!attacked || !(g.str < cap * 0.6 || g.coh < 45)) continue;
    const donor = mine.filter(u => isFoot(E, u) && u !== g && u.str > 900 && u.coh > 45 && u.task.kind === 'hold' && hyp(u.x - sp.x, u.y - sp.y) < 1500).sort((a, b) => hyp(a.x - sp.x, a.y - sp.y) - hyp(b.x - sp.x, b.y - sp.y))[0];
    if (!donor) continue;
    const det = E.detach(donor, clamp(Math.round(cap * 0.8 - g.str), 250, 700), `feed${sp.id}${f.n}${side}`, `${donor.name}'s men for ${sp.name}`);
    if (det) { det.detachment = true; E.setTask(det, { kind: 'garrisonGo', sp: sp.id }); det.path = [sp.access[0], sp.access[1]]; f.n++; f.t = E.t; E.logEvent('orders', `${donor.name} sends ${det.str | 0} men into ${sp.name}.`, { side, hidden: true }); }
  }
  // abandoned places in front of the line are taken back if the enemy is not close
  for (const sp of E.sps) {
    if (!sp.value || sp.holder || sp.secs.every(s => s.burnt)) continue;
    const r = st.reocc[sp.id] || (st.reocc[sp.id] = { n: 0, t: -99 });
    if (r.n >= REOCC_MAX || E.t - r.t < REOCC_EVERY) continue;
    if (seen(E, side, 20, c => hyp(c.x - sp.x, c.y - sp.y) < 450 && c.status !== 'broken').length) continue;
    const donor = mine.filter(u => isFoot(E, u) && u.str > 900 && u.coh > 55 && hyp(u.x - sp.x, u.y - sp.y) < 1200).sort((a, b) => hyp(a.x - sp.x, a.y - sp.y) - hyp(b.x - sp.x, b.y - sp.y))[0];
    if (!donor) continue;
    r.n++; r.t = E.t;
    AI().viaAide(E, chief ? chief.id : null, donor, `the order to re-occupy ${sp.name}`, () => { if (sp.holder) return; const det = E.detach(donor, 300, `re${sp.id}${E.t}${side}`, `${donor.name}'s companies for ${sp.name}`); if (det) { det.detachment = true; E.setTask(det, { kind: 'garrisonGo', sp: sp.id }); det.path = [sp.access[0], sp.access[1]]; } });
  }
  // a sagging part of the line: the nearest reserve comes up behind the weakest unit the enemy is pressing
  const pressed = mine.filter(u => isFoot(E, u) && !st.reserve.has(u.id) && (u.coh < 55 || u.str < u.str0 * 0.6) && seen(E, side, 20, c => hyp(c.x - u.x, c.y - u.y) < 500 && c.status !== 'broken').length).sort((a, b) => a.coh - b.coh)[0];
  if (pressed) {
    const res = [...st.reserve].map(id => E.byId[id]).filter(u => u && E.formed(u) && u.task.kind === 'hold' && u.coh > 50).sort((a, b) => dist(a, [pressed.x, pressed.y]) - dist(b, [pressed.x, pressed.y]))[0];
    if (res) {
      st.reserve.delete(res.id);
      const enemyC = centroid(E.units.filter(e => E.isEnemy(res, e) && E.formed(e) && e.onMap)) || [pressed.x, pressed.y];
      const v = [pressed.x - enemyC[0], pressed.y - enemyC[1]], L = hyp(v[0], v[1]) || 1, spot = [pressed.x + v[0] / L * 150, pressed.y + v[1] / L * 150];
      AI().viaAide(E, chief ? chief.id : null, res, `the order to ${res.name}`, () => { E.setTask(res, { kind: 'move', dest: spot, then: 'hold' }); E.routeTo(res, spot, true); });
      E.logEvent('orders', `${chief ? chief.name : 'The commander'} brings ${res.name} up behind ${pressed.name}.`, { side, hidden: true });
    }
  }
  // retake a place the enemy took, once his attack there has slackened (none of his foot seen attacking near it); chance by aggression
  if (chief && E.t - (st.retakeAt ?? -99) > RETAKE_EVERY && E.t < E.light.sunset) {
    const lost = E.sps.filter(sp => sp.value && sp.holder && sp.holder !== coal && mine.some(u => hyp(u.x - sp.x, u.y - sp.y) < 1500));
    for (const sp of lost) {
      if (seen(E, side, 20, c => hyp(c.x - sp.x, c.y - sp.y) < 700 && c.moving && c.kind === 'inf').length) continue;
      const by = mine.filter(u => isFoot(E, u) && u.task.kind === 'hold' && u.coh > 65 && u.str > 1200 && hyp(u.x - sp.x, u.y - sp.y) < 1500).sort((a, b) => hyp(a.x - sp.x, a.y - sp.y) - hyp(b.x - sp.x, b.y - sp.y)).slice(0, 2);
      if (!by.length) continue;
      st.retakeAt = E.t;
      if (E.rnd('retake') >= 0.3 * (chief.agg + 0.3)) break;
      const k = Object.keys(E.objectives).find(k => E.objectives[k].sp === sp.id); if (!k) break;
      for (const u of by) st.reserve.delete(u.id);
      order(E, side, by[0].corps || side, { kind: 'attack', obj: k, units: [by[0].id], supports: by.slice(1).map(u => u.id), form: 'attack', maxAttempts: 2 });
      E.logEvent('orders', `${chief.name} sends ${by[0].name} to retake ${sp.name}.`, { side, important: true });
      break;
    }
  }
  // the general advance: the enemy is breaking (his army, or six bodies seen running within half an hour)
  if (!st.advanced) {
    const broken = seen(E, side, 30, c => c.status === 'broken').length;
    const foeBreaking = E.sideIds.some(s => E.coalition[s] !== coal && E.flags[s + 'Broken']);
    if (foeBreaking || broken >= ADVANCE_BROKEN) {
      st.advanced = true; const foe = centroid(E.units.filter(e => e.onMap && E.coalition[e.side] !== coal && E.formed(e)));
      E.logEvent('orders', `${chief ? chief.name : 'The commander'} orders the general advance.`, { side, important: true });
      for (const u of mine) if (!isGuns(E, u) && !u.held && u.coh > 40) { const v = foe ? [foe[0] - u.x, foe[1] - u.y] : [0, 1], L = hyp(v[0], v[1]) || 1, dest = [u.x + v[0] / L * 1400, u.y + v[1] / L * 1400]; E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest]; u.lying = false; }
    }
  }
}

/* ----- horse: fall on shaken or blown enemies near the line (the cavalry chief's aggression) ----- */
function cavalry(E, side, st) {
  const sd = E.sides.find(s => s.id === side), cc = sd.cavChief && E.leaders[sd.cavChief] ? E.leaders[sd.cavChief] : chiefOf(E, side), agg = cc ? cc.agg : 0.6;
  const horse = formedOf(E, side).filter(u => isHorse(E, u) && !u.charge && u.wind > 60 && u.coh > 50 && u.task.kind === 'hold');
  if (!horse.length) return;
  const targets = E.units.filter(e => e.onMap && E.formed(e) && E.isEnemy(horse[0], e) && !isGuns(E, e) && !e.held && (e.status !== 'steady' || e.task.kind === 'rally') && horse.some(h => hyp(h.x - e.x, h.y - e.y) < 1300));
  for (const tg of targets) {
    if (st['cc' + tg.id] && E.t - st['cc' + tg.id] < 40) continue;
    const c = horse.filter(h => !h.charge).sort((a, b) => hyp(a.x - tg.x, a.y - tg.y) - hyp(b.x - tg.x, b.y - tg.y))[0];
    if (c && E.rnd('counter-charge') < 0.25 * agg) { E.charge(c, tg, E.cause(`${c.name} charged ${tg.name}`)); st['cc' + tg.id] = E.t; E.logEvent('combat', `${c.name} charges ${tg.name}.`, { side, unit: c.id, important: true }); break; }
  }
}

/* ----- withdrawal, and forces arriving ----- */
function withdraw(E, side, st) {
  st.withdrawn = true; const sd = E.sides.find(s => s.id === side), ch = chiefOf(E, side);
  E.logEvent('orders', `${ch ? ch.name : 'The commander'} orders the army to fall back.`, { side, important: true });
  if (sd.exit) { // off the field by its line of retreat, the freshest brigade of foot standing as rearguard across it
    const all = formedOf(E, side), rg = all.filter(u => isFoot(E, u)).sort((a, b) => b.coh * b.str - a.coh * a.str)[0];
    E.beginRetreat({ side });
    if (rg && sd.rearguard) order(E, side, side, { kind: 'retire', units: [rg.id], rear: true });
    order(E, side, side, { kind: 'retire', units: all.filter(u => u !== rg || !sd.rearguard).map(u => u.id) });
    return;
  }
  for (const u of formedOf(E, side)) { if (u.spId) E.leaveSp(u); const back = { S: [0, 2500], N: [0, -2500], E: [2500, 0], W: [-2500, 0] }[sd.rear] || [0, 0]; const dest = [clamp(u.x + back[0], 80, E.W.WM - 80), clamp(u.y + back[1], 80, E.W.HM - 80)]; E.setTask(u, { kind: 'move', dest, then: 'hold' }); E.routeTo(u, dest, true); }
}
function arrival(E, u, st) {
  if (!st) return;
  // a force coming on marches along its road and halts at its end; its commander sends it in (attack) or posts it (defence) from there,
  // once the whole corps is up (coming(), above)
  u.task.then = { kind: 'hold', since: E.t };
}
function groupBy(a, f) { const o = {}; for (const x of a) (o[f(x)] = o[f(x)] || []).push(x); return o; }

const api = { make };
root.WDoctrine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
