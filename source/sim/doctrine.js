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
      E.ai = ai; E.plan = E.plan || { steps: [], done: {} };
      const sides = opts.sides || E.sideIds;
      for (const sd of E.sides) {
        if (!sides.includes(sd.id)) continue;
        const st = S[sd.id] = { posture: sd.posture || 'defend', reserve: new Set(), fed: {}, reocc: {}, attack: {}, orderObj: {}, prepFrom: null, next: 0, advanced: false, withdrawn: false };
        const mine = E.units.filter(u => u.side === sd.id && u.onMap);
        for (const u of mine) if (!u.task || u.task.kind === 'hold') u.task = { kind: 'hold', since: E.t, lieDown: !!(E.nations[u.nat] || {}).lieDown };
        if (sd.crest) crestInit(E, sd.id, sd.crest); // a first line behind a crest (battle pack)
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
      for (const sd of E.sides) if (S[sd.id] && sd.crest) crestTick(E, sd.id, sd.crest);
      for (const [side, st] of Object.entries(S)) {
        const chief = chiefOf(E, side);
        if (E.t < st.next) continue;
        st.next = E.t + DECIDE * 2 * (chief ? chief.tempo || 1 : 1);
        if (!st.withdrawn && E.morale[side] < WITHDRAW_MORALE && !partnerEngaged(E, side)) { withdraw(E, side, st); continue; }
        upkeep(E, side);
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
function leaderOf(E, side, corps) { // the corps' own general: placed with the corps, or riding with one of its units; else the chief
  return Object.values(E.leaders).find(l => l.side === side && l.alive !== false && (l.corps === corps || l.id === corps || (l.unit && E.byId[l.unit] && E.byId[l.unit].corps === corps))) || chiefOf(E, side); }
const seen = (E, side, maxAge, pred) => { const ch = chiefOf(E, side); return AI().known(E, ch ? ch.id : null, maxAge, c => (c.side ? E.coalition[c.side] !== E.coalition[side] : true) && (!pred || pred(c)), E.coalition[side]); };
function partnerEngaged(E, side) { return E.sideIds.some(s => s !== side && E.coalition[s] === E.coalition[side] && E.engaged && Object.keys(E.engaged).some(k => E.units.some(u => u.side === s && u.corps === k))) || E.sideIds.some(s => s !== side && E.coalition[s] === E.coalition[side] && E.flags[s.toLowerCase() + 'Engaged']); }
const formedOf = (E, side) => E.units.filter(u => u.side === side && E.formed(u) && u.onMap);
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
  const agg = chief ? chief.agg : 0.6, mine = formedOf(E, side);
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
  const pressed = mine.filter(u => isFoot(E, u) && !u.detachment && u.task.kind !== 'garrisonGo' && !st.reserve.has(u.id) && (u.coh < 55 || u.str < u.str0 * 0.6) && seen(E, side, 20, c => hyp(c.x - u.x, c.y - u.y) < 500 && c.status !== 'broken').length).sort((a, b) => a.coh - b.coh)[0];
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

/* ----- horse: fall on shaken or blown enemies near the line (the cavalry chief's aggression) ----- */
function cavalry(E, side, st) {
  const sd = E.sides.find(s => s.id === side), cc = sd.cavChief && E.leaders[sd.cavChief] ? E.leaders[sd.cavChief] : chiefOf(E, side), agg = cc ? cc.agg : 0.6;
  const horse = formedOf(E, side).filter(u => isHorse(E, u) && !u.charge && u.wind > 60 && u.coh > 50 && u.task.kind === 'hold');
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
function groupBy(a, f) { const o = {}; for (const x of a) (o[f(x)] = o[f(x)] || []).push(x); return o; }

const api = { make, crestInit, crestTick, crestLine };
root.WDoctrine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
