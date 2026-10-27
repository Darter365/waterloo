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
const Plans = () => root.WPlans || req('./plans.js');
const hyp = Math.hypot;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DECIDE = 5;            // ticks between a commander's decisions (10 minutes), times his tempo
const FEED_EVERY = 25, FEED_MAX = 7, REOCC_EVERY = 40, REOCC_MAX = 2; // minutes, counts (est.)
const PREP = 40;             // minutes of bombardment before an attack, less with aggression (est.)
const WITHDRAW_MORALE = 25, ADVANCE_BROKEN = 6;
const GUN_RANGE = 900;       // guns preparing an attack come up to this far from the objective (est.: inside a 6-pounder's long range)
const GIVE_UP_MORALE = 50;   // an attacker whose line and reserve are spent calls the attack off below this morale, or at sunset (est.)
const RETAKE_EVERY = 60;
const FRESH_COH = 55;
const HORSE_BEHIND = 1100;   // m short of the objective an attacker's horse waits: beyond canister and the worst of the roundshot, within
                             // reach of a counter-charge (1300 m). Tried: 800 (out of reach) and 500 (shot to pieces before the attack went in)
const KEEN = 0.65;           // a corps general this aggressive strikes elsewhere when the main effort has no room for his men (est.)        // a body goes into an attack with at least this cohesion (est.)     // minutes between a defender's tries to retake a place it lost (est.)

function make(opts = {}) {
  const S = {}; // per side: what its commanders have decided
  const ai = {
    S, generic: true,
    init(E) {
      // embedded: run inside another commander object (ai.js), which owns E.ai, the unit-level behaviour and the plans (3d)
      if (!opts.embedded) { E.ai = ai; E.plan = E.plan || { steps: [], done: {} }; }
      const sides = opts.sides || E.sideIds;
      for (const sd of E.sides) {
        if (!sides.includes(sd.id)) continue;
        const st = S[sd.id] = { posture: sd.posture || 'defend', reserve: new Set(), fed: {}, reocc: {}, attack: {}, orderObj: {}, prepFrom: null, next: 0, advanced: false, withdrawn: false };
        const mine = E.units.filter(u => u.side === sd.id && u.onMap);
        for (const u of mine) if (!u.task || u.task.kind === 'hold') u.task = { kind: 'hold', since: E.t, lieDown: !!(E.nations[u.nat] || {}).lieDown };
        if (sd.crest) st.crestLine = crestInit(E, sd.id, sd.crest); // a first line behind a crest (battle pack)
        // (3d) a field commander's strokes are aimed at the enemy's line: the crest of the army named (initiative.charge.lineOf)
        const ch = sd.initiative && sd.initiative.charge; if (ch && ch.lineOf) { const o = E.sides.find(s => s.id === ch.lineOf); if (o && o.crest) st.chargeLine = crestLine(E, o.crest); }
        // reserves: the corps the battle names, else the third of the foot furthest from the enemy
        const resCorps = sd.reserve || [];
        if (resCorps.length) for (const u of mine) { if (resCorps.includes(u.corps)) st.reserve.add(u.id); }
        else {
          const foe = centroid(E.units.filter(u => u.onMap && E.isEnemy(u, mine[0] || u)));
          const foot = mine.filter(u => E.era.arms[u.arm].holds && !u.held).sort((a, b) => dist(b, foe) - dist(a, foe));
          for (const u of foot.slice(0, Math.floor(foot.length / 3))) st.reserve.add(u.id);
        }
      }
      // (3d) what the battle's record says an arriving army did (its timetable: below) runs alongside, as the plan rules do; the corps it
      // names are left to it (opts.timetables: false leaves every army to its generic commander)
      if (!opts.embedded && opts.timetables !== false) for (const sd of E.sides) if (S[sd.id] && hasTimetable(sd)) {
        S[sd.id].timetable = approachInit(E, sd.id, sd, {});
        E.timedCorps = E.timedCorps || new Set();
        for (const k of ['waits', 'follows', 'flanks']) for (const x of sd[k] || []) E.timedCorps.add(x.corps);
      }
      return ai;
    },
    tick(E) {
      if (!opts.embedded) AI().unitControl(E);
      for (const sd of E.sides) if (S[sd.id] && sd.crest) crestTick(E, sd.id, sd.crest);
      // (3d) horse behind a crest line watches every tick (Uxbridge's counter-charges); subordinates take their own initiative every tick
      // (Lobau, Ney), except in a general retreat
      for (const sd of E.sides) if (S[sd.id] && sd.counter && S[sd.id].crestLine) counterTick(E, sd.id, sd.counter, S[sd.id].crestLine, S[sd.id]);
      for (const sd of E.sides) if (S[sd.id] && sd.initiative && !E.flags[sd.id.toLowerCase() + 'Withdraw']) {
        if (sd.initiative.garrison) garrisonTick(E, sd.id, sd.initiative.garrison, S[sd.id]);
        if (sd.initiative.charge && S[sd.id].chargeLine) chargeTick(E, sd.id, sd.initiative.charge, S[sd.id].chargeLine, S[sd.id]);
      }
      for (const sd of E.sides) if (S[sd.id] && S[sd.id].timetable) approachTick(E, sd.id, sd, S[sd.id].timetable);
      for (const sd of E.sides) if (S[sd.id] && S[sd.id].timetable) toGunsTick(E, sd.id, sd, S[sd.id].timetable);
      for (const [side, st] of Object.entries(S)) {
        const chief = chiefOf(E, side), sd = E.sides.find(s => s.id === side);
        if (E.t < st.next) continue;
        st.next = E.t + DECIDE * 2 * (chief ? chief.tempo || 1 : 1);
        if (!sd.withdraw && !st.withdrawn && E.morale[side] < WITHDRAW_MORALE && !partnerEngaged(E, side)) { withdraw(E, side, st); continue; }
        if (st.posture === 'attack') { upkeep(E, side); attack(E, side, st, chief); } else defend(E, side, st, chief); // (a defender's halted counter-attacks are left to the unit rules, as Wellington's were)
        if (!sd.counter) cavalry(E, side, st);
      }
      if (E.plans && !opts.embedded) E.plans.tick(E);
    },
    receive(E, o) { AI().apply(E, o); },
    onArrival(E, u) { const st = S[u.side]; if (st && st.timetable && approachArrival(E, u, E.sides.find(s => s.id === u.side), st.timetable)) return; arrival(E, u, st); },
    onRepulse(E, a, d, tgt) { for (const sd of E.sides) if (S[sd.id] && sd.initiative && sd.initiative.escalate) escalateOnRepulse(E, sd.id, sd.initiative.escalate, a, tgt, S[sd.id]); },
  };
  return ai;
}

/* ----- what the commanders know ----- */
const dist = (u, p) => p ? hyp(u.x - p[0], u.y - p[1]) : 0;
const centroid = us => us.length ? [us.reduce((a, u) => a + u.x, 0) / us.length, us.reduce((a, u) => a + u.y, 0) / us.length] : null;
function chiefOf(E, side) { const id = (E.sides.find(s => s.id === side) || {}).chief; return id && E.leaders[id] ? E.leaders[id] : Object.values(E.leaders).find(l => l.side === side && l.rank === 3) || null; }
function leaderOf(E, side, corps) { // the corps' own general: placed with the corps, or riding with one of its units; else the chief
  return Object.values(E.leaders).find(l => l.side === side && l.alive !== false && (l.corps === corps || l.id === corps || (l.unit && E.byId[l.unit] && E.byId[l.unit].corps === corps))) || chiefOf(E, side); }
const seen = (E, side, maxAge, pred) => { const ch = chiefOf(E, side); return AI().known(E, ch ? ch.id : null, maxAge, c => (c.side ? E.coalition[c.side] !== E.coalition[side] : true) && (!pred || pred(c)), E.coalition[side]); };
function partnerEngaged(E, side) { return E.sideIds.some(s => s !== side && E.coalition[s] === E.coalition[side] && E.engaged && Object.keys(E.engaged).some(k => E.units.some(u => u.side === s && u.corps === k))) || E.sideIds.some(s => s !== side && E.coalition[s] === E.coalition[side] && E.flags[s.toLowerCase() + 'Engaged']); }
const formedOf = (E, side) => E.units.filter(u => u.side === side && E.formed(u) && u.onMap);
// the bodies the commander disposes of: not those of a corps that marches, halts and attacks by the battle's timetable (below)
const freeOf = (E, side) => formedOf(E, side).filter(u => !(E.timedCorps && E.timedCorps.has(u.corps)));
const TIMETABLE = ['delays', 'waits', 'follows', 'flanks', 'press', 'pursue', 'reports', 'toGuns'];
const hasTimetable = sd => TIMETABLE.some(k => sd[k]);
const isFoot = (E, u) => E.era.arms[u.arm].move === 'foot' && !u.held;
const isHorse = (E, u) => !!E.era.arms[u.arm].charges;
const isGuns = (E, u) => !!E.era.arms[u.arm].crew;
function objValue(E, o, side) { // what it is worth to this army: the side's own valuation (battle pack), else the map's
  const sd = side && E.sides.find(s => s.id === side), own = sd && sd.objectives && o.id && sd.objectives[o.id];
  return own ?? o.value ?? (o.sp && E.spById[o.sp] ? E.spById[o.sp].value || 0 : 0); }
function objHolder(E, side, o) { // who holds it, as the side's chief believes
  if (o.sp) { const ch = chiefOf(E, side); return AI().placeHolder(E, ch ? ch.id : null, o.sp); }
  if (o.line) return o.takenAt ? o.by : o.holder;
  return null;
}
// a commander's order to some of his units, by rider
function order(E, side, corps, spec) {
  const L = leaderOf(E, side, corps), ch = chiefOf(E, side), id = `d${side}${E.t}_${(E.dOrders = (E.dOrders || 0) + 1)}`;
  // (3a) as clear as the chief writes them (leader file: clarity), which sets the odds a general misreads one
  E.sendOrder(Object.assign({ id, from: ch ? ch.id : (L ? L.id : null), to: L ? L.id : null, direct: L === ch, clarity: ch && ch.clarity != null ? ch.clarity : 0.9 }, spec));
  return id;
}
// how many bodies an objective has room for in one attack: a place by the men its walls hold (one body per 600), a line by its length
// (one per 450 m), anything else two (est.); more than that only crowd each other (tried: five brigades on a farm for 500 men)
function room(E, o) {
  if (o.sp && E.spById[o.sp]) return Math.max(1, Math.round(E.spById[o.sp].secs.reduce((a, s) => a + (s.burnt ? 0 : s.cap), 0) / 600));
  if (o.line) { let L = 0; for (let i = 1; i < o.line.length; i++) L += hyp(o.line[i][0] - o.line[i - 1][0], o.line[i][1] - o.line[i - 1][1]); return Math.max(1, Math.round(L / 450)); }
  return 2;
}
// bodies of this army now going in at each objective (by the orders the doctrine gave)
function loads(E, side, st) {
  const out = {};
  for (const u of E.units) if (u.side === side && E.formed(u) && (u.task.kind === 'attack' || u.task.kind === 'support') && st.orderObj[u.task.order]) { const k = st.orderObj[u.task.order]; out[k] = (out[k] || 0) + 1; }
  return out;
}

/* ----- attack ----- */
// an order not yet acted on (its rider still on the way, or its general still taking it in): the commander does not order again
// (tried without: a corps was ordered in three times while the first rider rode, and counted itself fought out before it had fought)
function pending(E, ids) { return !!ids && ids.some(id => { const o = E.orders.find(x => x.id === id); return o && o.status !== 'done'; }); }
// a body halted in its attack (disordered, its cohesion under 50) for HALT_MAX minutes falls back a little to re-form; before, it stood
// in the attack all day and its corps waited on it
const HALT_MAX = 30, HALT_BACK = 300; // min, m (est.)
function upkeep(E, side) {
  for (const u of E.units) {
    if (u.side !== side || !E.formed(u) || u.task.kind !== 'attack') continue;
    if (!u.halted) { u.task.haltedSince = null; continue; }
    if (u.task.haltedSince == null) { u.task.haltedSince = E.t; continue; }
    if (E.t - u.task.haltedSince < HALT_MAX) continue;
    const g = u.task.point || [u.x, u.y], v = [u.x - g[0], u.y - g[1]], L = hyp(v[0], v[1]) || 1, back = L > 1 ? [u.x + v[0] / L * HALT_BACK, u.y + v[1] / L * HALT_BACK] : [u.x, u.y];
    E.setTask(u, { kind: 'rally', at: back, prev: u.task, since: E.t }); u.path = [back]; u.halted = false;
    E.logEvent('combat', `${u.name} falls back to re-form.`, { side, unit: u.id });
  }
}
// the objectives held by the enemy (or nobody), best first: worth to the army over the strength the chief knows stands near each (seen in the
// last half hour within DEFENDED m), so an army goes where its blow tells most (tried: by worth and distance alone, which sent the corps
// of a larger army at the strongest places and lost them there)
const DEFENDED = 500, DEF_SCALE = 2500; // m; men that halve a place's attraction (est.)
function defenders(E, side, o) {
  return seen(E, side, 30, c => c.status !== 'broken' && (o.line ? AI().polyDist(c.x, c.y, o.line) : hyp(c.x - o.point[0], c.y - o.point[1])) < DEFENDED).reduce((a, c) => a + (c.kind === 'art' ? 300 : c.str || 0), 0);
}
function targets(E, side, here) {
  const coal = E.coalition[side];
  const out = Object.entries(E.objectives).filter(([k]) => !k.startsWith('_')).map(([k, o]) => ({ k, o, v: objValue(E, o, side), h: objHolder(E, side, o) })).filter(x => x.v > 0 && x.h !== coal && x.o.point);
  for (const x of out) x.score = x.v / (1 + defenders(E, side, x.o) / DEF_SCALE);
  out.sort((a, b) => b.score - a.score || dist({ x: here[0], y: here[1] }, a.o.point) - dist({ x: here[0], y: here[1] }, b.o.point));
  if (out.length) return out;
  // nothing on the map worth taking from the enemy: go for his nearest body of troops the chief knows of (a passing objective)
  const foe = seen(E, side, 30, c => c.status !== 'broken').sort((a, b) => dist({ x: here[0], y: here[1] }, [a.x, a.y]) - dist({ x: here[0], y: here[1] }, [b.x, b.y]))[0];
  if (!foe) return out;
  const k = '_foe' + side, o = E.objectives[k] = Object.assign(E.objectives[k] || { id: k }, { name: 'the enemy in front', point: [foe.x, foe.y] });
  return [{ k, o, v: 1, h: null, score: 1 }];
}
// a corps still coming up (units yet to reach the field, or marching on it) waits until it has all arrived, unless the day is late
function coming(E, side, corps) { return E.t < E.light.sunset - 180 && E.units.some(u => u.side === side && (u.corps || side) === corps && !u.gone && u.str > 0 && (!u.onMap || u.task.kind === 'march')); }
function attack(E, side, st, chief) {
  const agg = chief ? chief.agg : 0.6, mine = freeOf(E, side);
  if (!mine.length) return; // nothing on the field yet
  const here = centroid(mine), objs = targets(E, side, here);
  if (!objs.length) return;
  // the main effort: the chief's best target, which every gun prepares; when it falls (or is no longer the enemy's) the next, after a
  // second, shorter bombardment. Corps go in there as far as it has room; one with no room waits, unless its general is keen, when it
  // strikes elsewhere to hold the enemy there (tried: every corps at its own best target at once, which the defender beat one by one)
  let main = st.main && objs.find(x => x.k === st.main.k);
  if (!main) { const n = st.main ? st.main.n + 1 : 0; main = objs[0]; st.main = { k: main.k, since: E.t, n }; if (n && chief) E.logEvent('orders', `${chief.name} turns his guns on ${main.o.name}.`, { side, hidden: true }); }
  if (st.prepFrom == null) st.prepFrom = E.t;
  guns(E, side, st, main, mine);
  // the bombardment lasts less with an aggressive chief and more with one who combines his arms with care (leader file: agg, coord)
  const prepped = E.t - st.main.since >= PREP * (1.2 - agg) * (st.main.n ? 0.5 : 1) * (0.5 + (chief && chief.coord != null ? chief.coord : 0.5));
  const dark = E.t > E.light.dark; // no new attacks in the dark
  // each corps not in reserve goes for an objective: the nearest of the most valuable; it renews the attack while it has the heart
  const corpsOf = groupBy(mine.filter(u => isFoot(E, u) && !st.reserve.has(u.id)), u => u.corps || side);
  let inFight = 0; const load = loads(E, side, st);
  for (const [corps, us] of Object.entries(corpsOf)) {
    if (coming(E, side, corps)) { inFight++; continue; }
    const L = leaderOf(E, side, corps), keen = L ? L.agg : 0.6, c = centroid(us);
    const a = st.attack[corps];
    if (a && (pending(E, a.ids) || us.some(u => u.task.kind === 'attack' || u.task.kind === 'support'))) { inFight++; continue; } // its order on the way, or still going in
    if (a && a.n >= 1 + Math.round(3 * keen)) continue; // spent: it has gone in as often as its general will take it
    if (dark) continue;
    // it goes (again) with the bodies that have the heart for it, once they are two-fifths of its men (est.); the rest wait or rally; a corps
    // that has not got there in an hour and a half after its last attack is fought out
    const ready = us.filter(u => u.coh >= FRESH_COH && u.task.kind !== 'garrison'), men = us.reduce((s, u) => s + u.str, 0);
    if (!ready.length || (a && ready.reduce((s, u) => s + u.str, 0) < 0.4 * men)) { if (!a || E.t - a.t < 90) inFight++; continue; }
    inFight++;
    if (!prepped) continue; // the guns have not done their work yet
    // where it goes: the main effort while it has room (as many bodies as that, the nearest; the rest follow as support, one behind each);
    // else, a keen general's corps at the target most attractive to it (attraction, less for distance), a cautious one's not at all
    const pull = x => x.score / (1 + dist({ x: c[0], y: c[1] }, x.o.point) / 3000); // (est.)
    const free = room(E, main.o) - (load[main.k] || 0);
    const x = free > 0 ? main : keen >= KEEN ? objs.filter(y => y.k !== main.k && room(E, y.o) - (load[y.k] || 0) > 0).sort((p, q) => pull(q) - pull(p))[0] : null;
    if (!x) continue;
    const bodies = ready.slice().sort((p, q) => dist(p, x.o.point) - dist(q, x.o.point));
    const n = Math.min(bodies.length, Math.max(1, room(E, x.o) - (load[x.k] || 0)));
    const take = bodies.slice(0, Math.min(bodies.length, n * 2)); load[x.k] = (load[x.k] || 0) + n;
    const plan = [[x, take]];
    st.attack[corps] = { k: x.k, n: (a ? a.n : 0) + 1, t: E.t, ids: [] };
    for (const [x, take] of plan) {
      const lead = take.slice(0, n), sup = take.slice(n);
      const points = x.o.line ? lanes(E, side, x.o, lead) : undefined;
      const id = order(E, side, corps, { kind: 'attack', obj: x.k, units: lead.map(u => u.id), supports: sup.map(u => u.id), points, form: 'attack', maxAttempts: 1 + Math.round(2 * keen) });
      st.orderObj[id] = x.k; st.attack[corps].ids.push(id);
    }
  }
  horseUp(E, side, st, mine, objs);
  // the reserve goes in where the enemy is giving way (an objective whose defenders are seen shaken), or, once the line is spent, to
  // try once more while there is daylight; chance per decision by the chief's readiness to commit it (leader file)
  const res = [...st.reserve].map(id => E.byId[id]).filter(u => u && E.formed(u) && u.onMap);
  if (res.length && chief && !dark) {
    const coal = E.coalition[side];
    const weak = objs.find(x => { const p = x.o.point; return seen(E, side, 20, c => hyp(c.x - p[0], c.y - p[1]) < 400 && (c.status === 'broken' || c.status === 'disordered')).length > 0; });
    // our foot stand on the enemy's line: the reserve goes up to make it good (the moment a reserve is kept for)
    const gk = Object.keys(E.objectives).find(k => { const o = E.objectives[k]; return o.line && o.takenAt != null && o.by === coal; }), gained = gk && { k: gk, o: E.objectives[gk] };
    const last = !inFight && E.t < E.light.sunset - 60 && E.morale[side] >= 40;
    const tgt = gained || weak || (last ? objs[0] : null), ready = chief.reserve ?? 0.5;
    if (tgt && E.rnd('commit the reserve') < ready * (gained ? 0.6 : weak ? 0.3 : 0.5)) {
      for (const u of res) st.reserve.delete(u.id); // its horse now comes up behind the attack with the rest (horseUp)
      const foot = res.filter(u => isFoot(E, u)), byCorps = groupBy(foot, u => u.corps || side);
      for (const [corps, us] of Object.entries(byCorps)) { const id = order(E, side, corps, { kind: 'attack', obj: tgt.k, units: us.map(u => u.id), form: 'attack', maxAttempts: 2 }); st.orderObj[id] = tgt.k; st.attack[corps] = { k: tgt.k, n: 1, t: E.t, ids: [id] }; }
      E.logEvent('orders', `${chief.name} throws in his reserve against ${tgt.o.name}.`, { side, important: true });
      return;
    }
  }
  // the attack has failed: line spent, reserve gone in or never sent, the men disheartened or the sun down; the attacker calls it off,
  // unless his men stand on a line he came to take (he holds what he won into the night)
  const holding = Object.values(E.objectives).some(o => o.line && o.takenAt != null && o.by === E.coalition[side]);
  if (!inFight && !st.withdrawn && !holding && !mine.some(u => u.task.kind === 'attack' || u.task.kind === 'support') && (E.morale[side] < GIVE_UP_MORALE || E.t > E.light.sunset - 30)
    && (!res.length || E.t > E.light.sunset) && E.sides.find(x => x.id === side).exit && E.rnd('call off the attack') < 0.3) {
    E.logEvent('orders', `${chief ? chief.name : 'The commander'} calls off the attack.`, { side, important: true });
    withdraw(E, side, st);
  }
}
// the horse not held in reserve comes up behind the attack, near enough (HORSE_BEHIND) to fall on what the attack shakes and to meet the
// enemy's horse; before, it stood where it began, too far back to act
function horseUp(E, side, st, mine, objs) {
  const atk = Object.values(st.attack).filter(a => E.t - a.t < 120).map(a => objs.find(x => x.k === a.k)).filter(Boolean)[0] || objs[0];
  if (!atk) return;
  const here = centroid(mine), p = atk.o.point, v = [here[0] - p[0], here[1] - p[1]], L = hyp(v[0], v[1]) || 1;
  const stage = [p[0] + v[0] / L * HORSE_BEHIND, p[1] + v[1] / L * HORSE_BEHIND];
  const idle = mine.filter(u => isHorse(E, u) && !st.reserve.has(u.id) && u.task.kind === 'hold' && !u.charge && !u.path && dist(u, stage) > 400);
  if (!idle.length) return;
  const byCorps = groupBy(idle, u => u.corps || side);
  for (const [corps, us] of Object.entries(byCorps)) order(E, side, corps, { kind: 'move', units: us.map(u => u.id), point: stage, spreadX: 1.5 });
}
// where on a line each leading body strikes: spread along it, and clear of the enemy's walled places in front of it (a column whose road
// passes within LANE_CLEAR of a held farm is drawn into the farm's fight; tried without: half an army's attacks on a ridge ended in the
// farm before it)
const LANE_CLEAR = 300; // m (est.: the unit-level pull toward an enemy is 260 m)
function lanes(E, side, o, lead) {
  const coal = E.coalition[side], held = E.sps.filter(sp => sp.holder && sp.holder !== coal);
  const at = f => { let L = 0; const seg = []; for (let i = 1; i < o.line.length; i++) { const d = hyp(o.line[i][0] - o.line[i - 1][0], o.line[i][1] - o.line[i - 1][1]); seg.push(d); L += d; } let r = f * L; for (let i = 0; i < seg.length; i++) { if (r <= seg[i] || i === seg.length - 1) { const g = Math.min(1, r / (seg[i] || 1)); return [o.line[i][0] + (o.line[i + 1][0] - o.line[i][0]) * g, o.line[i][1] + (o.line[i + 1][1] - o.line[i][1]) * g]; } r -= seg[i]; } return o.line[0]; };
  const clear = (u, p) => held.every(sp => AI().polyDist(sp.x, sp.y, [[u.x, u.y], p]) > LANE_CLEAR);
  const used = [], out = [];
  for (let i = 0; i < lead.length; i++) {
    const u = lead[i], base = (i + 0.5) / lead.length;
    const cands = []; for (let f = 0.05; f < 1; f += 0.05) cands.push(f);
    cands.sort((a, b) => Math.abs(a - base) - Math.abs(b - base));
    const f = cands.find(f => clear(u, at(f)) && used.every(g => Math.abs(g - f) > 0.15)) ?? base;
    used.push(f); out.push(at(f));
  }
  return out;
}
// the guns: every battery not already firing on the main effort is sent to, from within GUN_RANGE of it (an order is not repeated while
// its rider may still be on the way)
function guns(E, side, st, main, mine) {
  st.gunOrder = st.gunOrder || {};
  const p = main.o.point, us = mine.filter(u => isGuns(E, u) && !u.path && !(u.task.kind === 'bombard' && u.task.areaKey === main.k) && (u.task.kind === 'hold' || u.task.kind === 'bombard')
    && !(st.gunOrder[u.id] && st.gunOrder[u.id].k === main.k && E.t - st.gunOrder[u.id].t < 30));
  if (!us.length) return;
  for (const [corps, g] of Object.entries(groupBy(us, u => u.corps || side))) {
    const sites = g.map(u => { const d = dist(u, p); if (d <= GUN_RANGE) return [u.x, u.y]; const f = (d - GUN_RANGE) / d; return [u.x + (p[0] - u.x) * f, u.y + (p[1] - u.y) * f]; });
    order(E, side, corps, { kind: 'bombard', units: g.map(u => u.id), area: main.k, sitePoints: sites, opens: true });
    for (const u of g) st.gunOrder[u.id] = { k: main.k, t: E.t };
  }
}

/* ----- defence ----- */
function defend(E, side, st, chief) {
  const coal = E.coalition[side], mine = freeOf(E, side), sd = E.sides.find(s => s.id === side);
  // (3d) a side whose battle pack gives it habits of its own uses them in place of the generic ones (Waterloo's allies: Wellington's)
  if (sd.feeds) feedTick(E, side, sd.feeds, st);
  if (sd.sectors && st.crestLine) sectorTick(E, side, sd.sectors, st.crestLine, st);
  if (sd.reoccupy) reoccupyTick(E, side, sd.reoccupy, st);
  if (sd.stepBack) stepBackTick(E, side, sd.stepBack, st);
  if (sd.liaison && st.crestLine) liaisonTick(E, side, sd.liaison, st.crestLine, st);
  if (sd.shifts) shiftTick(E, side, sd.shifts, st);
  if (sd.advance) advanceTick(E, side, sd.advance, st);
  if (sd.withdraw) withdrawTick(E, side, sd.withdraw, st, sd.advance && sd.advance.partner);
  if (sd.calls) callTick(E, side, sd.calls, st);
  // the garrisons of the places that matter are fed from the nearest foot while they are attacked (decided on the spot)
  if (!sd.feeds) for (const sp of E.sps) {
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
  if (!sd.reoccupy) for (const sp of E.sps) {
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
  const pressed = !sd.sectors && mine.filter(u => isFoot(E, u) && !u.detachment && u.task.kind !== 'garrisonGo' && !st.reserve.has(u.id) && (u.coh < 55 || u.str < u.str0 * 0.6) && seen(E, side, 20, c => hyp(c.x - u.x, c.y - u.y) < 500 && c.status !== 'broken').length).sort((a, b) => a.coh - b.coh)[0];
  if (pressed) {
    const res = [...st.reserve].map(id => E.byId[id]).filter(u => u && E.formed(u) && u.task.kind === 'hold' && u.coh > 50).sort((a, b) => (isHorse(E, a) - isHorse(E, b)) || dist(a, [pressed.x, pressed.y]) - dist(b, [pressed.x, pressed.y]))[0];
    if (res) {
      st.reserve.delete(res.id);
      const enemyC = centroid(E.units.filter(e => E.isEnemy(res, e) && E.formed(e) && e.onMap)) || [pressed.x, pressed.y];
      const v = [pressed.x - enemyC[0], pressed.y - enemyC[1]], L = hyp(v[0], v[1]) || 1, spot = [pressed.x + v[0] / L * 150, pressed.y + v[1] / L * 150];
      AI().viaAide(E, chief ? chief.id : null, res, `the order to ${res.name}`, () => { E.setTask(res, { kind: 'move', dest: spot, then: 'hold' }); E.routeTo(res, spot, true); });
      E.logEvent('orders', `${chief ? chief.name : 'The commander'} brings ${res.name} up behind ${pressed.name}.`, { side, hidden: true });
    }
  }
  // retake a place the enemy took from us (one we held at some time: not one that was his from the start), once his attack there has
  // slackened (none of his foot seen attacking near it); chance by aggression
  st.everHeld = st.everHeld || new Set(); for (const sp of E.sps) if (sp.holder === coal) st.everHeld.add(sp.id);
  if (!sd.reoccupy && chief && E.t - (st.retakeAt ?? -99) > RETAKE_EVERY && E.t < E.light.sunset) {
    const lost = E.sps.filter(sp => sp.value && sp.holder && sp.holder !== coal && st.everHeld.has(sp.id) && mine.some(u => hyp(u.x - sp.x, u.y - sp.y) < 1500));
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
  if (!sd.advance && !st.advanced) {
    const broken = seen(E, side, 30, c => c.status === 'broken').length;
    const foeBreaking = E.sideIds.some(s => E.coalition[s] !== coal && E.flags[s + 'Broken']);
    if (foeBreaking || broken >= ADVANCE_BROKEN) {
      st.advanced = true; const foe = centroid(E.units.filter(e => e.onMap && E.coalition[e.side] !== coal && E.formed(e)));
      E.logEvent('orders', `${chief ? chief.name : 'The commander'} orders the general advance.`, { side, important: true });
      for (const u of mine) if (!isGuns(E, u) && !u.held && u.coh > 40) { const v = foe ? [foe[0] - u.x, foe[1] - u.y] : [0, 1], L = hyp(v[0], v[1]) || 1, dest = [u.x + v[0] / L * 1400, u.y + v[1] / L * 1400]; E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest]; u.lying = false; }
    }
  }
}

/* ----- (3d) the crest: a defender's first line out of sight behind a ridge, as Wellington kept his. Battle pack, per side:
   crest: { from: [{ road, reverse, slice: [a, b] } | { objective }], first: [unit ids], ahead, up, horse, quiet, standForm: { nation: form },
            restForm: { nation: form } (the form a body brought up later goes back to, 'columns' for nations not listed; else its nation's) }
   Each body of the first line takes a place on the crest line (ahead m toward the enemy from its nearest point) and holds behind it,
   lying down; it stands up and comes to the crest when enemy foot are within up m of its place there and no enemy horse within horse m,
   and goes back down after quiet ticks without them, or at once if horse appear (lines are what horse ride down). Release 3's values
   (Wellington: 15 m, 380 m, 500 m, 4 ticks) are Waterloo's, est. ----- */
function crestLine(E, cfg) {
  let pts = [];
  for (const part of cfg.from) {
    let p;
    if (part.road) { const r = E.W.ROADS.find(x => x.name === part.road); if (!r) throw new Error(`crest: no road "${part.road}"`); p = r.pts.slice(); }
    else if (part.objective) p = E.objectives[part.objective].line.slice();
    if (part.reverse) p.reverse();
    if (part.slice) p = p.slice(part.slice[0], part.slice[1]);
    pts = pts.concat(p);
  }
  return pts;
}
function crestInit(E, side, cfg) {
  const line = crestLine(E, cfg), fwd = E.frontFacing(side) * Math.PI / 180, ahead = cfg.ahead ?? 15;
  const off = [Math.sin(fwd) * ahead, -Math.cos(fwd) * ahead];
  for (const u of E.units) {
    if (u.side !== side || !u.onMap || !cfg.first.includes(u.id) || !u.task || u.task.kind !== 'hold') continue;
    const q = AI().nearestOnPoly(u.x, u.y, line);
    u.task.crest = q ? [q[0] + Math.round(off[0] * 1e9) / 1e9, q[1] + Math.round(off[1] * 1e9) / 1e9] : null;
    u.task.lieDown = true; u.task.res = [u.x, u.y]; u.task.resFacing = u.facing; u.task.resForm = u.form;
  }
  return line;
}
function crestTick(E, side, cfg) {
  const up = cfg.up ?? 380, hr = cfg.horse ?? 500, quiet = cfg.quiet ?? 4, face = E.frontFacing(side), stand = cfg.standForm || {};
  for (const u of E.units) {
    if (u.side !== side || !E.formed(u) || !isFoot(E, u) || u.task.kind !== 'hold' || !u.task.crest) continue;
    const t = u.task, [cx, cy] = t.crest;
    const foes = E.near(cx, cy, up, e => E.isEnemy(u, e) && E.formed(e) && isFoot(E, e));
    const cav = E.near(cx, cy, hr, e => E.isEnemy(u, e) && E.formed(e) && isHorse(E, e));
    if (foes.length && !cav.length) {
      if (t.state !== 'up') { t.state = 'up'; u.lying = false; u.path = [[cx, cy]]; u.stopAt = 0; t.arriveFacing = face; if (stand[u.nat]) E.setForm(u, stand[u.nat]); }
      t.quiet = 0;
    } else if (t.state === 'up') {
      t.quiet = (t.quiet || 0) + 1;
      if (t.quiet > quiet || cav.length) { t.state = 'down'; u.path = [t.res]; t.arriveFacing = t.resFacing; if (!cav.length) E.setForm(u, t.resForm || (cfg.restForm ? cfg.restForm[u.nat] || 'columns' : (E.nations[u.nat] || {}).form || 'columns')); }
    }
    if (!u.path && t.arriveFacing != null && t.state === 'up') u.facing = face;
  }
}

/* ----- (3d) feeding a garrison from bodies the battle names (battle pack, per side: feeds). Decided on the spot by the generals who can
   see the place, so it reads the garrison's true state. Each feed: { place, donors: [unit ids, in order of choice], every: minutes
   between feeds, max: feeds in all, when: { attacked: m (enemy foot this near), below: share of the walls' room, capMax: room counted at
   most, coh } or { strBelow: men }, donor: { str, coh } (the least a donor keeps), men: { fill, min, max } (to fill this share of the
   room) or { fixed }, ammo (the newcomers' cartridges), id and name ('{n}' the feed's number, '{donor}' the donor's id or name),
   says (the log line: '{donor}', '{men}') }. Release 3's Hougoumont and La Haye Sainte feeds are Waterloo's. ----- */
function feedTick(E, side, feeds, st) {
  const coal = E.coalition[side], fill = (s, n, d, m) => s.replace('{n}', n).replace('{donor}', d).replace('{men}', m);
  st.feeds = st.feeds || {};
  for (const f of feeds) {
    const sp = E.spById[f.place], g = E.byId[sp.garrison], k = st.feeds[f.place] || (st.feeds[f.place] = { n: 0, t: 0 });
    if (!g || !E.formed(g) || k.n >= f.max || !(E.t - k.t > f.every)) continue;
    const w = f.when, cap = sp.secs.filter(s => s.held === coal && !s.burnt).reduce((a, s) => a + s.cap, 0), room = w.capMax ? Math.min(cap, w.capMax) : cap;
    if (w.strBelow != null) { if (!(g.str < w.strBelow)) continue; }
    else { const attacked = E.near(g.x, g.y, w.attacked, e => E.isEnemy(g, e) && E.formed(e) && isFoot(E, e)).length > 0; if (!(attacked && (g.str < room * w.below || g.coh < w.coh))) continue; }
    const d = f.donors.map(id => E.byId[id]).filter(u => u && E.formed(u) && u.str > f.donor.str && (f.donor.coh == null || u.coh > f.donor.coh))[0];
    if (!d) continue;
    const men = f.men.fixed != null ? f.men.fixed : clamp(Math.round(room * f.men.fill - g.str), f.men.min, f.men.max);
    const det = E.detach(d, men, fill(f.id, k.n, d.id, ''), fill(f.name, k.n, d.name, ''));
    if (!det) continue;
    if (f.ammo != null) det.ammo = f.ammo;
    E.setTask(det, { kind: 'garrisonGo', sp: sp.id }); det.path = [sp.access[0], sp.access[1]]; k.n++; k.t = E.t;
    if (f.says) E.logEvent('orders', fill(f.says, k.n, d.name, det.str | 0), { side, hidden: true });
  }
}

/* ----- (3d) the cavalry behind a crest line (battle pack, per side: counter), as Uxbridge handled the allied horse: it falls on enemy foot
   that has come within near m of the line and is shaken, falling back or halted in a mass (chance per tick: chance x the cavalry chief's
   aggression, each target once every `every` min), from the horse within reach m that is holding, fresh (wind) and steady (coh); a second
   heavy brigade goes in beside the first; and on enemy horse blown or shaken on the near side of the line (spent: within near m of it and
   ahead m beyond its first point, chance per tick), from the first such brigade within reach. Release 3's values are Uxbridge's. ----- */
function counterTick(E, side, cfg, line, st) {
  const sd = E.sides.find(s => s.id === side), cc = sd.cavChief && E.leaders[sd.cavChief], agg = cc ? cc.agg : 0.6, poly = AI().polyDist;
  st.counterCharged = st.counterCharged || {};
  const mineHorse = c => c.side === side && isHorse(E, c) && E.formed(c) && !c.charge && c.task.kind === 'hold';
  const targets = E.units.filter(u => E.coalition[u.side] !== E.coalition[side] && isFoot(E, u) && E.formed(u) && poly(u.x, u.y, line) < cfg.near && (u.status !== 'steady' || u.task.kind === 'rally' || u.form === 'mass' && u.halted));
  for (const tg of targets) {
    if (st.counterCharged[tg.id] && E.t - st.counterCharged[tg.id] < cfg.every) continue;
    const cavs = E.units.filter(c => mineHorse(c) && c.wind > cfg.wind && c.coh > cfg.coh && hyp(c.x - tg.x, c.y - tg.y) < cfg.reach).sort((a, b) => hyp(a.x - tg.x, a.y - tg.y) - hyp(b.x - tg.x, b.y - tg.y));
    if (cavs.length && E.rnd('counter-charge') < cfg.chance * agg) {
      const c = cavs[0]; E.charge(c, tg, E.cause(`${cc ? cc.name : 'The cavalry'} launched ${c.name} at ${tg.name}`)); st.counterCharged[tg.id] = E.t;
      E.logEvent('combat', `${c.name} charges ${tg.name}.`, { side, unit: c.id, important: true });
      if (cfg.second && cavs[1] && cavs[1].cavKind === cfg.second) E.charge(cavs[1], tg); break;
    }
  }
  const sp = cfg.spent; if (!sp) return;
  const f = E.frontFacing(side) * Math.PI / 180, fw = [Math.round(Math.sin(f) * 1e9) / 1e9, Math.round(-Math.cos(f) * 1e9) / 1e9], o = line[0];
  for (const fc of E.units.filter(u => E.coalition[u.side] !== E.coalition[side] && isHorse(E, u) && E.formed(u) && poly(u.x, u.y, line) < sp.near && (u.x - o[0]) * fw[0] + (u.y - o[1]) * fw[1] < sp.ahead && (u.wind < sp.wind || u.coh < sp.coh))) {
    const c = E.units.find(c => mineHorse(c) && c.wind > cfg.wind && c.coh > sp.cohOwn && hyp(c.x - fc.x, c.y - fc.y) < sp.reach);
    if (c && E.rnd('cavalry counter') < sp.chance) { E.charge(c, fc, E.cause(`${c.name} counter-charged blown enemy horse`)); break; }
  }
}

/* ----- (3d) a defender's line in sectors, its reserves brought up behind the sector in most trouble (battle pack, per side: sectors), as
   Wellington fed his line. Every `every` min the chief scores each sector from what he knows: his first-line bodies' weakness (cohesion
   under weakAt, by their men; a body gone counts its whole strength) plus the enemy he has seen within foeNear m of the line (men /
   foeScale); the worst over `threshold` gets the reserve nearest its middle, sent by aide to stand `behind` m behind its weakest body, on
   the crest with the rest. { bounds: [lat, [lon...]] (the sector edges along a parallel), names, units: [reserve ids], every, threshold,
   weakAt, foeNear, foeScale, behind, ahead (its place on the crest), midCap (m: where the last sector's middle is taken) } ----- */
function sectorTick(E, side, cfg, line, st) {
  if (!(E.t - (st.lastReserve || 0) > cfg.every)) return;
  const coal = E.coalition[side], ch = chiefOf(E, side), cid = ch ? ch.id : null, A = AI();
  st.reservesLeft = st.reservesLeft || cfg.units.slice();
  const xs = cfg.bounds[1].map(lo => E.ll2m(cfg.bounds[0], lo)[0]), edges = [0, ...xs, 99999];
  const sectors = cfg.names.map((n, i) => ({ n, x0: edges[i], x1: edges[i + 1] }));
  const foeSeen = (age, pred) => A.known(E, cid, age, c => !!c.side && E.coalition[c.side] !== coal && pred(c));
  let worst = null, ws = 0;
  for (const s of sectors) {
    const mine = E.units.filter(u => u.side === side && isFoot(E, u) && u.onMap && u.task.crest && u.x >= s.x0 && u.x < s.x1);
    const weak = mine.reduce((a, u) => { const o = A.ownState(E, cid, u); return a + (o.status !== 'broken' && !o.gone ? Math.max(0, cfg.weakAt - o.coh) * o.str / 1000 : u.str0 / 300); }, 0);
    const foes = foeSeen(30, c => c.x >= s.x0 && c.x < s.x1 && A.polyDist(c.x, c.y, line) < cfg.foeNear).reduce((a, c) => a + c.str, 0);
    const sc = weak + foes / cfg.foeScale; if (sc > ws) { ws = sc; worst = s; }
  }
  if (!worst || !(ws > cfg.threshold)) return;
  const mid = (worst.x0 + Math.min(worst.x1, cfg.midCap)) / 2;
  const cand = st.reservesLeft.map(id => E.byId[id]).filter(u => u && E.formed(u) && u.task.kind === 'hold' && !u.task.crest && u.coh > 50).sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid));
  const r = cand[0]; if (!r) return;
  const first = E.units.filter(u => u.side === side && isFoot(E, u) && u.task.crest && u.x >= worst.x0 && u.x < worst.x1).sort((a, b) => (E.formed(a) ? a.coh : 0) - (E.formed(b) ? b.coh : 0))[0];
  const f = E.frontFacing(side) * Math.PI / 180, fw = [Math.round(Math.sin(f) * 1e9) / 1e9, Math.round(-Math.cos(f) * 1e9) / 1e9];
  const spot = first ? [first.task.res[0] - fw[0] * cfg.behind, first.task.res[1] - fw[1] * cfg.behind] : [r.x, r.y];
  const q = A.nearestOnPoly(spot[0], spot[1], line);
  st.lastReserve = E.t; st.reservesLeft = st.reservesLeft.filter(id => id !== r.id); const wn = worst.n, face = E.frontFacing(side);
  A.viaAide(E, cid, r, `${ch ? ch.name : 'The chief'}'s order to ${r.name}`, () => {
    E.setTask(r, { kind: 'move', dest: spot, then: { kind: 'hold', lieDown: true, crest: q ? [q[0] + fw[0] * cfg.ahead, q[1] + fw[1] * cfg.ahead] : null, res: spot, resFacing: face } });
    E.routeTo(r, spot, true);
    E.logEvent('orders', `${ch ? ch.name : 'The chief'} brings ${r.name} up behind the ${wn}.`, { side, hidden: true });
  });
}
/* ----- (3d) farms in front of a line taken back when they stand empty (battle pack, per side: reoccupy): { places, every, max, near (m: no
   enemy seen this near in 20 min; nearTrue without the command layer), donor: { str, coh, within }, men, menAt: { place: men } } ----- */
function reoccupyTick(E, side, cfg, st) {
  const coal = E.coalition[side], ch = chiefOf(E, side), cid = ch ? ch.id : null, A = AI();
  st.reocc = st.reocc || {};
  for (const id of cfg.places) {
    const sp = E.spById[id], r = st.reocc[id] || (st.reocc[id] = { t: 0, n: 0 });
    if (sp.holder || r.t && E.t - r.t < cfg.every || r.n >= cfg.max) continue;
    if (E.command ? A.known(E, cid, 20, c => !!c.side && E.coalition[c.side] !== coal && hyp(c.x - sp.x, c.y - sp.y) < cfg.near && c.status !== 'broken').length : E.near(sp.x, sp.y, cfg.nearTrue, e => E.coalition[e.side] !== coal && E.formed(e)).length) continue;
    const donor = E.units.filter(u => u.side === side && isFoot(E, u) && E.formed(u) && u.str > cfg.donor.str && u.coh > cfg.donor.coh && hyp(u.x - sp.x, u.y - sp.y) < cfg.donor.within).sort((a, b) => hyp(a.x - sp.x, a.y - sp.y) - hyp(b.x - sp.x, b.y - sp.y))[0];
    if (donor && !sp.secs.every(s => s.burnt)) { r.t = E.t; r.n++; const tt = E.t; A.viaAide(E, cid, donor, `${ch ? ch.name : 'The chief'}'s order to re-occupy ${sp.name}`, () => { if (sp.holder) return; const det = E.detach(donor, (cfg.menAt || {})[id] ?? cfg.men, 're' + id + tt, `${donor.name}'s companies for ${sp.name}`); if (det) { det.detachment = true; E.setTask(det, { kind: 'garrisonGo', sp: id }); det.path = [sp.access[0], sp.access[1]]; } }); }
  }
}
/* ----- (3d) the first line stepped back out of a cannonade (battle pack, per side: stepBack): once, after `after`, when `count` bodies on
   the crest have taken more than `art` casualties from guns, each is moved `back` m further behind it ----- */
function stepBackTick(E, side, cfg, st) {
  if (st.stepBack || !(E.t > Plans().tmin(cfg.after))) return;
  const hurt = E.units.filter(u => u.side === side && isFoot(E, u) && E.formed(u) && u.task.crest && (u.srcArt || 0) > cfg.art); if (hurt.length < cfg.count) return;
  const ch = chiefOf(E, side), cid = ch ? ch.id : null, f = E.frontFacing(side) * Math.PI / 180, fw = [Math.round(Math.sin(f) * 1e9) / 1e9, Math.round(-Math.cos(f) * 1e9) / 1e9];
  st.stepBack = E.t;
  for (const u of hurt) AI().viaAide(E, cid, u, `${ch ? ch.name : 'The chief'}'s order to ${u.name} to step back`, () => { if (!u.task.res) return; const r = [u.task.res[0] - fw[0] * cfg.back, u.task.res[1] - fw[1] * cfg.back]; u.task.res = r; if (u.task.state !== 'up') { u.path = [r]; u.lying = false; } });
  E.logEvent('orders', `${ch ? ch.name : 'The chief'} pulls the first line back out of the cannonade.`, { side, hidden: true });
}

/* ----- (3d) a defender's last moves (battle pack, per side): when an allied army is in the fight (partner: { news, flag }: the chief's
   news of it with the command layer, the engine's flag without), when to go over to the advance, when to give up the field, forces to
   call up and horse to shift. Release 3's Wellington. ----- */
const fwOf = (E, side) => { const f = E.frontFacing(side) * Math.PI / 180; return [Math.round(Math.sin(f) * 1e9) / 1e9, Math.round(-Math.cos(f) * 1e9) / 1e9]; };
function partnerIn(E, side, p) { if (!p) return false; const ch = chiefOf(E, side), N = AI().news(E, ch ? ch.id : null); return E.command ? !!(N && N[p.news]) : !!E.flags[p.flag]; }
const enemySides = (E, side) => E.sideIds.filter(s => E.coalition[s] !== E.coalition[side]);
const foeSeenBy = (E, side) => { const ch = chiefOf(E, side), coal = E.coalition[side]; return (age, pred) => AI().known(E, ch ? ch.id : null, age, c => !!c.side && E.coalition[c.side] !== coal && pred(c)); };
function goForward(E, side, dist, coh) {
  const fw = fwOf(E, side);
  for (const u of E.units) if (u.side === side && E.formed(u) && !u.held && !isGuns(E, u) && u.coh > coh) { const dest = [u.x + fw[0] * dist, u.y + fw[1] * dist]; E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest]; u.lying = false; }
}
// the general advance { after, partner, prestige (a broken body of prestige seen), broken (enemy bodies of `kind` seen running in 30 min), morale
// (without the command layer: an enemy army this low, or broken), dist, coh, says, followUp: minutes after the enemy begins to draw off, followSays }
function advanceTick(E, side, cfg, st) {
  const ch = chiefOf(E, side), seen = foeSeenBy(E, side), inP = cfg.partner ? partnerIn(E, side, cfg.partner) : true, foes = enemySides(E, side);
  const going = E.command ? ((cfg.prestige && seen(30, c => c.guard && c.status === 'broken').length > 0) || seen(30, c => c.status === 'broken' && c.kind === cfg.kind).length >= cfg.broken) : foes.some(s => E.morale[s] < cfg.morale || E.flags[s + 'Broken']);
  if (!st.advanced && inP && going && E.t > Plans().tmin(cfg.after)) { st.advanced = true; E.logEvent('orders', cfg.says || `${ch ? ch.name : 'The chief'} orders the general advance.`, { side, important: true }); goForward(E, side, cfg.dist, cfg.coh); }
  const wk = foes.map(s => E.flags[s.toLowerCase() + 'Withdraw']).find(x => x);
  if (cfg.followUp != null && !st.advanced && wk && E.t - wk >= cfg.followUp) { st.advanced = true; E.logEvent('orders', cfg.followSays || `${ch ? ch.name : 'The chief'} sees the enemy drawing off and sends his line forward.`, { side, important: true }); goForward(E, side, cfg.dist, cfg.coh); }
}
// giving up the field { morale, after, unlessPartner, partner, back (m toward the rear edge), edge (m kept from it), says }
function withdrawTick(E, side, cfg, st, partnerCfg) {
  if (st.withdraw || !(E.morale[side] < cfg.morale) || !(E.t > Plans().tmin(cfg.after)) || (cfg.unlessPartner && partnerIn(E, side, partnerCfg))) return;
  const ch = chiefOf(E, side), sd = E.sides.find(s => s.id === side), W = E.W;
  st.withdraw = true; E.logEvent('orders', cfg.says || `${ch ? ch.name : 'The chief'} orders the army back.`, { side, important: true });
  for (const u of E.units.filter(x => x.side === side && E.formed(x))) AI().viaAide(E, ch ? ch.id : null, u, `${ch ? ch.name : 'The chief'}'s order to ${u.name} to withdraw`, () => {
    if (u.spId && u.held) E.leaveSp(u); // a garrison comes out first: it cannot march while it holds the buildings
    const b = cfg.back, e = cfg.edge, dest = sd.rear === 'N' ? [u.x, Math.max(e, u.y - b)] : sd.rear === 'S' ? [u.x, Math.min(W.HM - e, u.y + b)] : sd.rear === 'E' ? [Math.min(W.WM - e, u.x + b), u.y] : [Math.max(e, u.x - b), u.y];
    E.setTask(u, { kind: 'move', dest, then: 'hold' }); E.routeTo(u, dest, true); });
  E.flags[side.toLowerCase() + 'Withdraw'] = E.t;
}
// forces off the field called up when the enemy is seen on a flank { force, when: { west|east: [lat, lon], over: men, age: min }, delay: [min, max], says }
function callTick(E, side, calls, st) {
  st.called = st.called || {}; const seen = foeSeenBy(E, side);
  for (const c of calls) {
    if (st.called[c.force]) continue;
    const w = c.when, xw = w.west && E.ll2m(...w.west)[0], xe = w.east && E.ll2m(...w.east)[0];
    if (!seen(w.age, k => (xw == null || k.x < xw) && (xe == null || k.x > xe) && k.str > w.over).length) continue;
    st.called[c.force] = true; const base = E.t + E.rnd.range(c.delay[0], c.delay[1], 'force called up');
    for (const u of E.offmap.filter(o => o.group === c.force)) { u.arriveAt = base + (u.baseArrive || 0); u.marchThen = { kind: 'hold' }; }
    if (c.says) E.logEvent('orders', c.says, { side, hidden: true });
  }
}
// horse moved when an allied force is known to have come up { when: { friendNear: place, within, age, news, metric }, units, to: [lat, lon], spread, says }
function shiftTick(E, side, shifts, st) {
  st.shifted = st.shifted || {}; const ch = chiefOf(E, side), cid = ch ? ch.id : null, N = AI().news(E, cid);
  shifts.forEach((s, i) => {
    const w = s.when, sp = E.spById[w.friendNear];
    const known = E.command ? Object.values(E.command.B[cid].friends).some(f => E.t - f.t < w.age && hyp(f.x - sp.x, f.y - sp.y) < w.within) || (N && N[w.news]) : E.metrics[w.metric];
    if (!known || st.shifted[i]) return;
    st.shifted[i] = true;
    s.units.forEach((id, k) => { const c = E.byId[id]; if (c && E.formed(c) && !c.charge) AI().viaAide(E, cid, c, `${ch ? ch.name : 'The chief'}'s order to ${c.name}`, () => { if (c.charge) return; const dest = E.ll2m(s.to[0], s.to[1]); E.setTask(c, { kind: 'move', dest: [dest[0] + k * s.spread, dest[1]], then: 'hold' }); E.routeTo(c, c.task.dest, true); }); });
    if (s.says) E.logEvent('orders', s.says, { side, hidden: true });
  });
}

/* ----- (3d) a liaison officer with an allied army's chief (battle pack, per side: liaison), as Müffling kept Blücher told: a message when
   the enemy's main attack is seen coming in (attack: { men moving within `within` m of the line, seen in `age` min }), when the army's
   morale falls under `danger`, when `place` is lost, and every `every` min; it tells the ally's chief the army's morale (news alMorale),
   that it is engaged (wellEngaged, once the attack has come) and that the place is lost (lhsLost). Only with the command layer. ----- */
function liaisonTick(E, side, cfg, line, st) {
  if (!E.command) return;
  const ch = chiefOf(E, side), cid = ch ? ch.id : null, seen = foeSeenBy(E, side), A = AI(), t = E.t;
  const attackSeen = seen(cfg.attack.age, c => cfg.attack.kinds.includes(c.kind) && A.polyDist(c.x, c.y, line) < cfg.attack.within && c.moving).reduce((a, c) => a + c.str, 0) > cfg.attack.men;
  const lost = A.placeHolder(E, cid, cfg.place) && A.placeHolder(E, cid, cfg.place) !== E.coalition[side];
  const why = attackSeen && !st.toldAttack ? 'attack' : E.morale[side] < cfg.danger && !st.toldDanger ? 'danger' : lost && !st.toldLost ? 'lost' : t - (st.lastMsg || 0) >= cfg.every ? 'hourly' : null;
  if (!why) return;
  if (why === 'attack') st.toldAttack = t; if (why === 'danger') st.toldDanger = t; if (why === 'lost') st.toldLost = t; st.lastMsg = t;
  const m = E.morale[side], engaged = !!st.toldAttack;
  E.command.message(cid, cfg.to, `${cfg.label} (${why === 'lost' ? cfg.place : why})`, (B, w) => { B.news.alMorale = { v: m, t: w }; if (engaged && !B.news.wellEngaged) B.news.wellEngaged = w; if (lost) B.news.lhsLost = w; });
}

/* ----- (3d) subordinates' initiative (battle pack, per side: initiative), as Lobau and Jérôme took it:
   garrison: a general throws one of his bodies into a place when the enemy he knows of comes within `within` m of it (enemies of `sides`, or
     unidentified troops more than `unknownEastOf` m east of it) and it has no garrison: { leader, place, within, age, sides, unknownEastOf,
     units (in order of choice), chance (each tick), says ('{unit}') }
   escalate: when an attack on a place is thrown back, its general sends the next of his bodies in (chance x his aggression): { place,
     leader, to (the corps general the order goes through), units, chance, maxAttempts, rideMin, says ('{unit}') } ----- */
function garrisonTick(E, side, list, st) {
  st.garrisoned = st.garrisoned || {};
  list.forEach((g, i) => {
    const sp = E.spById[g.place], A = AI();
    const near = E.command ? A.known(E, g.leader, g.age, c => (g.sides.includes(c.side) || (!c.side && c.x > sp.x + g.unknownEastOf)) && c.status !== 'broken' && hyp(c.x - sp.x, c.y - sp.y) < g.within).length > 0
      : E.units.some(u => g.sides.includes(u.side) && E.formed(u) && hyp(u.x - sp.x, u.y - sp.y) < g.within);
    if (!near || sp.garrison || st.garrisoned[i]) return;
    const cand = g.units.map(id => E.byId[id]).find(u => u && E.formed(u) && u.task.kind !== 'garrison');
    if (cand && E.rnd('initiative') < g.chance) { st.garrisoned[i] = E.t; E.setTask(cand, { kind: 'garrisonGo', sp: sp.id }); E.routeTo(cand, [sp.secs[0].x, sp.secs[0].y], true); if (g.says) E.logEvent('orders', g.says.replace('{unit}', cand.name), { side, hidden: true }); }
  });
}
function escalateOnRepulse(E, side, list, a, tgt, st) {
  for (const g of list) {
    if (a.side !== side || !tgt.sp || tgt.sp.id !== g.place) continue;
    const L = E.leaders[g.leader]; st.repulses = st.repulses || {}; st.repulses[g.place] = (st.repulses[g.place] || 0) + 1;
    if (E.rnd('escalate') < (L ? L.agg : 0.5) * g.chance) {
      const next = g.units.map(id => E.byId[id]).find(u => u && E.formed(u) && u.task.kind !== 'attack' && u.task.sp !== g.place);
      if (next) { E.sendOrder({ id: g.place.slice(0, 4) + '_' + next.id, from: g.leader, to: g.to, kind: 'attack', obj: g.place, units: [next.id], form: 'attack', maxAttempts: g.maxAttempts, direct: true, rideMin: g.rideMin, cause: E.cause(`${L ? L.name : 'Its general'} threw ${next.name} into ${E.spById[g.place].name} after ${a.name} was repulsed`) }); if (g.says) E.logEvent('orders', g.says.replace('{unit}', next.name), { side, hidden: true }); }
    }
  }
}

/* ----- (3d) a field commander's own strokes (battle pack, per side: initiative.charge), as Ney's: while he commands a front (the command
   layer's fieldFront, when it has one), every `every` ticks after `after` once `flag` is set, he may take enemy bodies seen moving back
   near the line for a retreat (chance: his initiative x `chance.times`) or lose patience after `patience.after` (his aggression x
   `patience.times`) and launch his first wave of horse; `after2` min later (unless `block` is set false) a second wave (his aggression x
   `times`); and once `exploit.place` is his, run guns up beside it and send what foot he can find at the enemy centre. Units held back
   by the commander-in-chief's own order are left out (the command layer's reserved). ----- */
function chargeTick(E, side, cfg, line, st) {
  const A = AI(), g = cfg, L = E.leaders[g.leader], t = E.t, tm = Plans().tmin;
  const front = !E.command || !E.command.fieldFront || E.command.fieldFront(g.leader, g.front);
  if (!st.charge1 && front && E.flags[g.flag] && t > tm(g.after) && E.tick % g.every === 0) {
    const np = E.leaderPos(L), s = g.sees;
    const seen = A.known(E, g.leader, s.age, c => s.sides.includes(c.side) && (!s.moving || c.moving) && A.polyDist(c.x, c.y, line) < s.nearLine && np && hyp(c.x - np[0], c.y - np[1]) < s.within);
    if (seen.length && E.rnd('a retreat is misread') < L[g.chance.trait] * g.chance.times) launchWave(E, side, g, g.waves[0], st, 'charge1');
    else if (t > tm(g.patience.after) && E.rnd('patience') < L[g.patience.trait] * g.patience.times) launchWave(E, side, g, g.waves[0], st, 'charge1');
  }
  const x = g.exploit;
  if (x && !st.exploit && front && A.placeHolder(E, g.leader, x.place) === E.coalition[side] && t < tm(x.before) && E.tick % g.every === 0) {
    st.exploit = t;
    const guns = x.guns.filter(id => E.byId[id] && E.formed(E.byId[id]) && !A.reserved(E, E.byId[id])).slice(0, x.gunCount);
    E.sendOrder({ id: x.gunId, from: g.leader, to: x.to, kind: 'bombard', units: guns, site: x.gunSite, area: x.area, direct: true, rideMin: x.gunRideMin, text: x.gunText });
    const inf = A.fittest(E, x.foot, x.footCount);
    if (inf.length) E.sendOrder({ id: x.footId, from: g.leader, to: x.to, kind: 'attack', obj: x.area, units: inf, form: 'attack', maxAttempts: x.maxAttempts, direct: true, rideMin: x.footRideMin, text: x.footText });
    E.logEvent('orders', x.says, { side, important: true });
    if (E.command && E.command.neyInitiative) E.command.neyInitiative(x.note, inf.concat(guns));
  }
  const w2 = g.waves[1];
  if (w2 && st.charge1 && !st.charge2 && front && t - st.charge1 > w2.after && E.flags[w2.block] !== false) {
    if (E.rnd('more cavalry') < L[w2.trait] * w2.times) launchWave(E, side, g, w2, st, 'charge2');
  }
}
function launchWave(E, side, g, w, st, key) {
  const A = AI(), free = id => !E.byId[id] || !A.reserved(E, E.byId[id]);
  st[key] = E.t; const ids = w.units.filter(free);
  if (!ids.length) return; // every one of them held back by the commander-in-chief's order
  if (w.metric) E.metrics[w.metric] = E.t;
  const hg = w.guns.filter(free);
  if (hg.length) E.sendOrder({ from: g.leader, to: w.to, kind: 'bombard', units: hg, site: w.gunSite, area: w.area, direct: true, rideMin: w.gunRideMin });
  if (E.command && E.command.neyInitiative) E.command.neyInitiative(w.note, ids.filter(id => E.byId[id] && E.formed(E.byId[id])));
  E.logEvent('orders', w.says, { side, important: true });
  E.sendOrder({ from: g.leader, to: w.to, kind: 'cavRaid', units: ids, area: w.area, home: E.ll2m(w.home[0], w.home[1]), maxCharges: w.maxCharges, direct: true, rideMin: w.rideMin, cause: E.cause(w.cause) });
  if (w.rides) E.leaders[g.leader].unit = w.rides;
}

/* ----- horse: fall on shaken or blown enemies near the line (the cavalry chief's aggression) ----- */
function cavalry(E, side, st) {
  const sd = E.sides.find(s => s.id === side), cc = sd.cavChief && E.leaders[sd.cavChief] ? E.leaders[sd.cavChief] : chiefOf(E, side), agg = cc ? cc.agg : 0.6;
  const horse = freeOf(E, side).filter(u => isHorse(E, u) && !u.charge && u.wind > 60 && u.coh > 50 && u.task.kind === 'hold');
  if (!horse.length) return;
  // shaken or rallying enemies, and the enemy's horse when it is blown or galloping out of hand after a charge (est.: the moment a horse
  // reserve is kept for)
  const targets = E.units.filter(e => e.onMap && E.formed(e) && E.isEnemy(horse[0], e) && !isGuns(E, e) && !e.held && (e.status !== 'steady' || e.task.kind === 'rally' || (isHorse(E, e) && (e.wind < 40 || e.pursuing))) && horse.some(h => hyp(h.x - e.x, h.y - e.y) < 1300));
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
/* ===================== (3d) an army marching onto the field (battle pack, per side) =====================
   What the record says an arriving army's commanders did, as habits with the battle's numbers in the pack (Waterloo: Blücher's march from
   Wavre and Grouchy's choice at Walhain; release 3's prussianInit, onPrussianArrival and prussians, moved here unchanged). The historical
   commander (ai.js) runs them for every army it has not handed to the generic doctrine; a generic army decides for itself.
     delays   the march's chances, drawn once at the start and added to the arrival minutes of a force that marches on its own
     waits    a corps halts out of sight where it comes on until its chief releases it, then takes a road to cover near the enemy,
              assembles there and attacks
     follows  a corps that comes on after a waiting corps, by its road, and attacks a place
     flanks   a corps that comes on beside the ally's line and attacks the nearest enemy; it may be diverted to help a corps in trouble
     press    rested foot sent at a place again while the enemy holds it
     pursue   when the enemy has been drawing off a while, everything formed but the guns drives for his road of retreat
     reports  officers sent to the ally's chief when a flag or metric is first set
     toGuns   a detached force off the field that may hear the guns and march to them
   The keys of each block are given where it is read. Times are minutes or 'hh:mm'; places, objectives, roads, leaders and corps are the
   battle's ids; 'roll' names the dice (for the log of draws: it does not change them). Under strict history nothing is left to chance:
   a draw takes its 'strict' value, chances do not happen. */
const tm = t => Plans().tmin(t);
const histOpen = E => E.history === 'open', histStrict = E => E.history === 'strict';
const roadOf = (E, r) => E.routes[r[0]].slice(r[1]).map(p => [p[0], p[1]]); // [road id, first point]
function attackAt(E, u, f) { // a body sent at a place ({ place }), a point of an objective's line ({ point: [objective, index] }) or a point objective ({ point: [objective] })
  if (f.place) { const pl = E.spById[f.place]; E.setTask(u, { kind: 'attack', sp: f.place, point: [pl.x, pl.y], attempts: 0, maxAttempts: f.maxAttempts, form: 'attack' }); u.path = [[pl.x, pl.y]]; return; }
  const o = E.objectives[f.point[0]], p = o.line && f.point[1] != null ? o.line[f.point[1]] : o.point; // a point of its line, else the objective's point
  E.setTask(u, { kind: 'attack', point: [p[0], p[1]], attempts: 0, maxAttempts: f.maxAttempts, form: 'attack' }); u.path = [p];
}
function approachInit(E, side, sd, st) {
  const rnd = E.rnd, open = histOpen(E), strict = histStrict(E);
  st.draws = {}; st.waits = {}; st.flanks = {}; st.told = {}; st.toGuns = {};
  // a field commander's strokes are aimed at the line of the army named (initiative.charge.lineOf: its crest)
  const ch = sd.initiative && sd.initiative.charge; if (ch && ch.lineOf) { const o = E.sides.find(s => s.id === ch.lineOf); if (o && o.crest) st.chargeLine = crestLine(E, o.crest); }
  /* delays: { force, draws, units }
       a draw is a chance { key, roll, chance, open (x the chance under open history), range: [min, max], rangeRoll, says ('{min}': logged when it happens) }
       or a spread { key, roll, tri: [lo, mode, hi], openHi (x hi under open history), strict (its value under strict history), centre (the
       delay the listed minutes already allow for), says (always logged) }
       units: [{ corps (else every unit of the force), add: { key: weight }, lead: { units, add: { key: weight } }, noise: { roll, sd, openSd | openTimes } }]:
       a unit comes on at its listed minute + the sum of weight x (draw - centre) + a normal spread of sd minutes (openSd, or sd x openTimes,
       under open history); a later entry naming the unit's corps replaces the first (each entry draws its own spread) */
  const d = sd.delays;
  if (d) {
    const v = st.draws, centre = {};
    for (const g of d.draws) {
      centre[g.key] = g.centre || 0;
      v[g.key] = g.tri ? (strict ? g.strict : rnd.tri(g.tri[0], g.tri[1], g.tri[2] * (open ? g.openHi || 1 : 1), g.roll))
        : !strict && rnd(g.roll) < g.chance * (open ? g.open || 1 : 1) ? rnd.range(g.range[0], g.range[1], g.rangeRoll) : 0;
    }
    for (const g of d.draws) if (g.says && (g.tri || v[g.key])) E.logEvent('hidden', g.says.replace('{min}', Math.round(v[g.key])), { side, hidden: true });
    for (const u of E.offmap.filter(o => o.group === d.force)) for (const r of d.units) {
      if (r.corps && r.corps !== u.corps) continue;
      const lead = r.lead && r.lead.units.includes(u.id) ? r.lead.add : {}, nz = r.noise;
      let at = u.baseArrive;
      for (const [k, w] of Object.entries(r.add)) at += (v[k] - centre[k]) * (lead[k] ?? w);
      const n = rnd.normal(nz.roll);
      u.arriveAt = at + (open && nz.openSd != null ? n * nz.openSd : n * nz.sd * (open ? nz.openTimes || 1 : 1));
    }
  }
  // waits: the minutes a corps may lose getting out of its cover (assemble.exit: { roll, ok (the chance the way out goes well), lost (min), says })
  for (const w of sd.waits || []) {
    const x = w.assemble.exit, ws = st.waits[w.corps] = { release: null, attack: null, ready: null, exitDelay: 0 };
    if (x) { ws.exitDelay = strict ? 0 : (rnd(x.roll) < x.ok ? 0 : x.lost); if (ws.exitDelay && x.says) E.logEvent('hidden', x.says, { side, hidden: true }); }
  }
  for (const g of sd.toGuns || []) st.toGuns[g.force] = { decided: false, comes: false };
  return st;
}
// a body of the army comes on: a waiting corps halts out of sight (hide: { concealed (x the chance it is seen), height (m it stands above the
// ground where it halts: a plateau just past the map's edge) }); a following or flank corps marches to its road's end and halts, ready; a
// detached force that marched to the guns attacks its place
function approachArrival(E, u, sd, st) {
  const w = (sd.waits || []).find(x => x.corps === u.corps);
  if (w) { u.task = { kind: 'march', then: null, since: E.t, wait: true }; u.path = null; u.halted = true; if (w.hide) { u.heightBonus = w.hide.height; u.concealed = w.hide.concealed; } return true; }
  if ((sd.follows || []).some(x => x.corps === u.corps)) { u.task = { kind: 'march', then: () => ({ kind: 'hold', ready: 'follow' }), since: E.t }; return true; }
  if ((sd.flanks || []).some(x => x.corps === u.corps)) { u.task = { kind: 'march', then: () => ({ kind: 'hold', ready: 'flank' }), since: E.t }; return true; }
  const g = (sd.toGuns || []).find(x => x.force === u.group);
  if (g) { const pl = E.spById[g.place]; u.task = { kind: 'march', then: () => ({ kind: 'attack', point: [pl.x, pl.y], attempts: 0, maxAttempts: g.maxAttempts, form: 'attack' }), since: E.t }; return true; }
  return false;
}
function approachTick(E, side, sd, st) {
  const t = E.t, strict = histStrict(E), A = AI(), coal = E.coalition[side];
  const waits = sd.waits || [], mine = waits.map(w => E.units.filter(u => u.corps === w.corps && u.onMap && E.formed(u)));
  /* waits[].release: { by (the chief who decides), partner (the ally's army), strictAt, when: [{ foot, engaged | danger | after }] (any one: at
       least `foot` bodies of the corps' foot on the field, and the ally believed seriously engaged, or in danger, or the hour), danger (the
       ally's morale, as the chief believes it, under which he is in danger), heard: { prefix, heavy, quiet, for, flag } (the ally is seriously
       engaged after `for` min of cannonade from him at least `heavy` loud, the count starting again when it falls under `quiet`; or the
       ally's officer says so; without the command layer, the engine's flag), news: { engaged, morale } (the keys of the chief's news), says }
     waits[].road: [road, first point]: where it goes when released; it halts at the road's end and musters there */
  waits.forEach((w, i) => {
    const ws = st.waits[w.corps], r = w.release;
    if (!ws.release) {
      const foot = mine[i].filter(u => isFoot(E, u)).length, N = A.news(E, r.by), nk = r.news;
      if (N) {
        const h = r.heard, g = Object.entries(E.command.B[r.by].soundSlow).filter(([k]) => k.startsWith(h.prefix)).reduce((a, [, v]) => a + v, 0);
        if (g >= h.heavy) { if (N.heavySince == null) N.heavySince = t; } else if (g < h.quiet) N.heavySince = null;
        if (N.heavySince != null && t - N.heavySince >= h.for && !N[nk.engaged]) N[nk.engaged] = t;
      }
      const engaged = N ? !!N[nk.engaged] : E.flags[r.heard.flag];
      const danger = N ? !!(N[nk.morale] && N[nk.morale].v < r.danger) : E.morale[r.partner] < r.danger;
      if ((strict && t >= tm(r.strictAt)) || (!strict && r.when.some(c => foot >= c.foot && (c.engaged ? engaged : c.danger ? danger : t >= tm(c.after))))) {
        ws.release = t; if (r.says) E.logEvent('hidden', r.says, { side, hidden: true });
      }
    }
    if (ws.release) for (const u of mine[i]) if (u.task.kind === 'march' && u.task.wait) { u.task.wait = false; u.halted = false; u.heightBonus = 0; u.concealed = null; u.path = roadOf(E, w.road); u.task.then = () => ({ kind: 'hold', muster: w.corps }); }
  });
  // pursue: { after (min the enemy has been drawing off), coh, says }: everything formed but the guns, with cohesion over coh, drives for the
  // nearest point of the enemy's road of retreat, never back toward his front
  const pu = sd.pursue;
  if (pu && !st.pursuit) {
    const foe = enemySides(E, side).find(s => E.flags[s.toLowerCase() + 'Withdraw']), fw = foe ? E.flags[foe.toLowerCase() + 'Withdraw'] : null;
    if (fw && t - fw >= pu.after) {
      const us = E.units.filter(u => u.side === side && u.onMap && E.formed(u) && !isGuns(E, u) && u.coh > pu.coh);
      if (us.length) {
        st.pursuit = t; E.logEvent('orders', pu.says, { side, important: true });
        const fsd = E.sides.find(s => s.id === foe), road = E.routes[fsd.retreat], rear = fsd.rear;
        for (const u of us) {
          const q = A.nearestOnPoly(u.x, u.y, road), dest = rear === 'N' ? [q[0], Math.min(q[1], u.y)] : rear === 'E' ? [Math.max(q[0], u.x), q[1]] : rear === 'W' ? [Math.min(q[0], u.x), q[1]] : [q[0], Math.max(q[1], u.y)];
          E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest];
        }
      }
    }
  }
  /* waits[].assemble: { foot (bodies of foot mustered before it goes; strictFoot under strict history), after (min to get ready once they
       are), exit (above), crisis (the ally's morale, as the chief believes it, under which they go at once), strictAt, says }
     waits[].attack: { foot: [{ units (else the rest), place | point: [objective, index], maxAttempts }], guns: { area (an objective), site:
       { lat, spread (a random part of it, degrees), lon } }, horse: { area, maxCharges } }: every body that reaches the muster afterwards
       goes in the same way
     press: { after (the waiting corps whose attack starts it), corps, place, every (ticks), coh, maxAttempts }: rested foot of these corps,
       halted and not mustering, sent at the place again unless their coalition holds it */
  waits.forEach((w, i) => {
    const ws = st.waits[w.corps], a = w.assemble, r = w.release, at = w.attack;
    const muster = mine[i].filter(u => u.task.kind === 'hold' && u.task.muster);
    if (!ws.attack && muster.filter(u => isFoot(E, u)).length >= (strict ? a.strictFoot : a.foot)) {
      if (!ws.ready) ws.ready = t;
      const N = A.news(E, r.by), bad = N ? !!(N[r.news.morale] && N[r.news.morale].v < a.crisis) : E.morale[r.partner] < a.crisis;
      if (t >= ws.ready + a.after + ws.exitDelay || bad) { ws.attack = t; if (a.says) E.logEvent('hidden', a.says, { side, hidden: true }); }
    }
    if (strict && !ws.attack && t >= tm(a.strictAt)) ws.attack = t;
    if (!ws.attack) return;
    for (const u of mine[i]) {
      if (u.task.kind !== 'hold' || !u.task.muster) continue;
      if (isFoot(E, u)) { attackAt(E, u, at.foot.find(x => !x.units || x.units.includes(u.id))); E.setForm(u, 'attack'); }
      else if (isGuns(E, u)) { const s = at.guns.site, site = E.ll2m(s.lat + E.rnd('gun site') * s.spread, s.lon); E.setTask(u, { kind: 'bombard', area: E.objectives[at.guns.area].line, site }); E.routeTo(u, site, true); }
      else if (isHorse(E, u)) E.setTask(u, { kind: 'cavRaid', area: E.objectives[at.horse.area].line, home: [u.x, u.y], charges: 0, maxCharges: at.horse.maxCharges });
    }
    const p = sd.press;
    if (p && p.after === w.corps && E.tick % p.every === 0) for (const u of E.units.filter(x => x.side === side && isFoot(E, x) && E.formed(x) && x.task.kind === 'hold' && !x.task.muster && x.coh > p.coh && p.corps.includes(x.corps))) {
      if (E.spById[p.place].holder === coal) continue;
      attackAt(E, u, p);
    }
  });
  // follows: [{ corps, after (the waiting corps: once it is released, a body of this one still on the march with nowhere to go takes its road),
  // road, place, maxAttempts }]
  for (const f of sd.follows || []) {
    for (const u of E.units.filter(x => x.corps === f.corps && x.onMap && E.formed(x) && x.task.kind === 'hold' && x.task.ready === 'follow')) { u.task.ready = null; attackAt(E, u, f); }
    if (st.waits[f.after] && st.waits[f.after].release) for (const u of E.units.filter(x => x.corps === f.corps && x.onMap && x.task.kind === 'march' && !x.path)) u.path = roadOf(E, f.road);
  }
  /* flanks: [{ corps, near (m: its foot attack the nearest enemy within this), place, dy (m south of the place, negative north: where its foot
       go when no enemy is near), maxAttempts, area (an objective: its horse raid it, its guns bombard it), gunAt: [dx, dy] (m from where the
       guns halt), horseCharges, divert }]
     divert: { help (the waiting corps), from, to (that corps' general, this one's), place, after (min since that corps attacked), message,
       near: { place, within } (this corps' head is near the ally's line), roll, chance, openTimes, says, maxAttempts, recall: { ride: [min,
       max], rideRoll, roll, chance, ok, fail } }: once the waiting corps has been attacking `after` min and the enemy holds its place, its
       general sends an officer for help; when this corps' general has the news and his head is near the line, he may turn south (chance),
       and a liaison officer from the ally may ride after him and bring him back (chance) */
  for (const f of sd.flanks || []) {
    const fs = st.flanks[f.corps] = st.flanks[f.corps] || {}, dv = f.divert;
    for (const u of E.units.filter(x => x.corps === f.corps && x.onMap && E.formed(x) && x.task.kind === 'hold' && x.task.ready === 'flank')) {
      u.task.ready = null;
      if (fs.diverted) { attackAt(E, u, { place: dv.place, maxAttempts: dv.maxAttempts }); continue; }
      if (isFoot(E, u)) {
        const target = E.units.filter(e => E.coalition[e.side] !== coal && E.formed(e) && hyp(e.x - u.x, e.y - u.y) < f.near).sort((a, b) => hyp(a.x - u.x, a.y - u.y) - hyp(b.x - u.x, b.y - u.y))[0];
        const pl = E.spById[f.place], p = target ? [target.x, target.y] : [pl.x, pl.y + f.dy];
        E.setTask(u, { kind: 'attack', point: p, attempts: 0, maxAttempts: f.maxAttempts, form: 'attack' }); u.path = [p];
      } else if (isHorse(E, u)) E.setTask(u, { kind: 'cavRaid', area: E.objectives[f.area].line, home: [u.x, u.y], charges: 0, maxCharges: f.horseCharges });
      else { E.setTask(u, { kind: 'bombard', area: E.objectives[f.area].line, site: [u.x + f.gunAt[0], u.y + f.gunAt[1]] }); E.routeTo(u, u.task.site, true); }
    }
    if (!dv) continue;
    if (!fs.check) {
      const np = E.spById[dv.near.place], hw = st.waits[dv.help], hp = E.spById[dv.place], foeHolds = h => !!h && h !== coal;
      const lead = E.units.find(u => u.corps === f.corps && u.onMap && E.formed(u) && hyp(u.x - np.x, u.y - np.y) < dv.near.within);
      if (E.command && !fs.crisisSent && hw.attack && t - hw.attack > dv.after && foeHolds(A.placeHolder(E, dv.from, dv.place))) { fs.crisisSent = t; E.command.message(dv.from, dv.to, dv.message, B => { B.news.crisis = E.t; }); }
      const N = A.news(E, dv.to);
      const crisis = N ? !!N.crisis : foeHolds(hp.holder) && hw.attack && t - hw.attack > dv.after;
      if (lead && crisis) {
        fs.check = t;
        if (!strict && E.rnd(dv.roll) < dv.chance * (histOpen(E) ? dv.openTimes || 1 : 1)) {
          fs.diverted = t; if (dv.says) E.logEvent('hidden', dv.says, { side, hidden: true, important: true });
          const rc = dv.recall; if (rc) { fs.recallAt = t + E.rnd.range(rc.ride[0], rc.ride[1], rc.rideRoll); fs.recallOk = E.rnd(rc.roll) < rc.chance; }
        }
      }
    }
    if (fs.diverted && fs.recallAt && t >= fs.recallAt) {
      fs.recallAt = null; const rc = dv.recall;
      if (fs.recallOk) { fs.diverted = null; E.logEvent('hidden', rc.ok, { side, hidden: true }); for (const u of E.units.filter(x => x.corps === f.corps && E.formed(x) && x.onMap)) if (u.task.kind === 'attack' && u.task.sp === dv.place) E.setTask(u, { kind: 'hold', ready: 'flank' }); }
      else E.logEvent('hidden', rc.fail, { side, hidden: true });
    }
  }
  // reports: [{ flag | metric, from, to, label, news (the key it sets in the recipient's news), writeMin }] (only with the command layer)
  if (E.command) (sd.reports || []).forEach((r, i) => {
    if ((r.flag ? E.flags[r.flag] : E.metrics[r.metric]) && !st.told[i]) { st.told[i] = t; E.command.message(r.from, r.to, r.label, B => { B.news[r.news] = E.t; }, r.writeMin); }
  });
}
/* toGuns: [{ force, flag (the battle has begun), at (the hour the guns are heard), roll, chance, openTimes, blocked (the chance its road is
   held), blockRoll, march: [lo, mode, hi] (min), marchRoll, says: { comes ('{at}'), blocked, stays }, place, maxAttempts }]: once, the force's
   general hears the guns and may be persuaded to march to them; if he does and his road is open, his bodies come on after the march at
   their listed minutes (as gaps between them) and attack the place */
function toGunsTick(E, side, sd, st) {
  for (const g of sd.toGuns || []) {
    const gs = st.toGuns[g.force];
    if (gs.decided || !E.flags[g.flag] || E.t < tm(g.at)) continue;
    gs.decided = true;
    if (!histStrict(E) && E.rnd(g.roll) < g.chance * (histOpen(E) ? g.openTimes || 1 : 1)) {
      gs.comes = true; const block = E.rnd(g.blockRoll);
      const arr = block < g.blocked ? null : E.t + E.rnd.tri(g.march[0], g.march[1], g.march[2], g.marchRoll);
      E.logEvent('hidden', arr ? g.says.comes.replace('{at}', E.fmtT(arr)) : g.says.blocked, { side, hidden: true, important: true });
      if (arr) for (const u of E.offmap.filter(o => o.group === g.force)) u.arriveAt = arr + u.baseArrive;
    } else E.logEvent('hidden', g.says.stays, { side, hidden: true });
  }
}
function groupBy(a, f) { const o = {}; for (const x of a) (o[f(x)] = o[f(x)] || []).push(x); return o; }

const api = { make, crestInit, crestTick, crestLine, feedTick, counterTick, sectorTick, reoccupyTick, stepBackTick, advanceTick, withdrawTick, callTick, shiftTick, partnerIn, liaisonTick, garrisonTick, escalateOnRepulse, chargeTick,
  approachInit, approachArrival, approachTick, toGunsTick };
root.WDoctrine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
