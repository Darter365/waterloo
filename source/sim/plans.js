/* Plan rules (engine roadmap, phase 3c): what a battle's record says its commanders did, as data. A plan is a list of rules; each rule
   is "when this holds, give this order", checked every tick in the order written, and done once. Conditions read what the plan's
   commander believes when the command layer keeps a belief record for him (as: his id), else the truth. Nothing here knows a battle:
   places, units, corps and times all come from the plan.

   A plan:   { side, as, via, rules: [rule...] }
     side    the army whose orders these are
     as      the commander whose belief the conditions read (and whose orders they are)
     via     'builder': each rule's spec goes through the order builder (C.order), as a player's order would;
             'order':   each rule's order goes straight to E.sendOrder (no command layer needed)
   A rule:   { id, at, by, start, when, spec | order, also, onAct }
     at      not before this time ('13:30' or minutes); by: the time it is due (a hand-over to the player skips rules due before then)
     start   only in this start of the battle (a battle pack's starts key, e.g. '0500')
     when    a condition (below), or a list of them that must all hold
     spec    an order-builder spec (via 'builder'); order: an engine order (via 'order'), with optional also: [more orders]
     onAct   what the order sets when it is carried out: { flag, metric, leaderUnit: { leader: unit } }
   Conditions (all JSON):
     { after: t } { before: t }                  the clock
     { place, holder: 'ours'|'enemy'|'nobody'|'notOurs' }   who holds a place (believed)
     { contact: { side: [ids, null = unidentified], over: men, region: { east|west|north|south: [lat, lon] } } }  a sighting
     { knows: corps }                            a prisoner or report has named this enemy corps
     { garrison: place, below: coh }             our garrison there is broken or below this cohesion (believed)
     { shaken: [unit ids], below: coh }          every one of them broken or below this cohesion (believed)
     { done: rule id, since: minutes }           that rule was carried out at least this long ago
     { arrived: [corps] }                        every body of these corps is on the field (believed)
     { flag } { metric } { morale: side, below } the engine's flags, metrics and army morale
     { any: [...] } { all: [...] } { not: c }    combinations
*/
(function (root) {
'use strict';
const tmin = t => typeof t === 'string' ? (([h, m]) => +h * 60 + +m)(t.split(':')) : t;

function make(E, plan, opt = {}) {
  const C = E.command, side = plan.side, coal = E.coalition[side];
  const B = () => (C && plan.as && C.B[plan.as]) || null; // the commander's belief record, if the command layer keeps one
  const S = { done: {}, at: {}, plan };
  // what the commander believes (or the truth)
  const placeHolder = id => { const b = B(); if (b) return b.places[id] ? b.places[id].holder : null; const sp = E.spById[id]; return sp ? sp.holder : null; };
  const contacts = () => { const b = B(); return b ? [...b.c.values()] : Object.values(E.contacts[coal] || {}); };
  const own = id => { const b = B(); if (b) { const o = b.own.get(id); return o && o.tState >= 0 ? o : null; } const u = E.byId[id]; return u && u.onMap && !u.gone ? { coh: u.coh, status: u.status } : null; };
  const ownAll = () => { const b = B(); return b ? [...b.own.values()] : E.units.filter(u => u.side === side && u.onMap && !u.gone).map(u => ({ id: u.id, task: u.task.kind, sp: u.spId, coh: u.coh, status: u.status, gone: u.gone })); };
  const xy = ll => E.ll2m(ll[0], ll[1]);
  function test(c) {
    if (Array.isArray(c)) return c.every(test);
    if (c.any) return c.any.some(test);
    if (c.all) return c.all.every(test);
    if (c.not) return !test(c.not);
    if (c.after != null) return E.t >= tmin(c.after);
    if (c.before != null) return E.t < tmin(c.before);
    if (c.place) { const h = placeHolder(c.place); return c.holder === 'ours' ? h === coal : c.holder === 'enemy' ? !!h && h !== coal : c.holder === 'nobody' ? !h : c.holder === 'notOurs' ? h !== coal : h === c.holder; }
    if (c.contact) {
      const q = c.contact, sides = q.side || null, R = q.region || {};
      const box = { east: R.east && xy(R.east)[0], west: R.west && xy(R.west)[0], north: R.north && xy(R.north)[1], south: R.south && xy(R.south)[1] };
      return contacts().some(k => (!sides || sides.includes(k.side || null)) && (q.over == null || k.str > q.over)
        && (box.east == null || k.x > box.east) && (box.west == null || k.x < box.west) && (box.north == null || k.y < box.north) && (box.south == null || k.y > box.south));
    }
    if (c.knows) { const b = B(); return !!(b && b.knownCorps && b.knownCorps[c.knows]); }
    if (c.garrison) { const g = ownAll().find(o => o.task === 'garrison' && o.sp === c.garrison && !o.gone); return !!g && (g.coh < c.below || g.status === 'broken'); }
    if (c.shaken) return c.shaken.every(id => { const o = own(id); return !!o && (o.status === 'broken' || o.coh < c.below); });
    if (c.done) return !!S.done[c.done] && E.t - S.done[c.done] > (c.since || 0);
    if (c.arrived) { const b = B(); return E.units.filter(u => u.side === side && c.arrived.includes(u.corps)).every(u => b ? b.own.has(u.id) : u.onMap); }
    if (c.flag) return !!E.flags[c.flag];
    if (c.metric) return E.metrics[c.metric] != null;
    if (c.morale) return E.morale[c.morale] < c.below;
    throw new Error(`plan ${plan.id || side}: unknown condition ${JSON.stringify(c)}`);
  }
  function onAct(a) {
    if (!a) return undefined;
    return (E2) => { if (a.flag) E2.flags[a.flag] = E2.t; if (a.metric) E2.metrics[a.metric] = E2.t; if (a.leaderUnit) for (const [l, u] of Object.entries(a.leaderUnit)) if (E2.leaders[l]) E2.leaders[l].unit = u; };
  }
  // engine orders: map places and points given as [lat, lon] into metres
  const orderOf = (r, o, id) => Object.assign({ id, from: plan.as, side }, o, o.points ? { points: o.points.map(xy) } : {}, r.onAct ? { onAct: onAct(r.onAct) } : {});
  const rules = plan.rules.filter(r => !r.start || r.start === E.scenario);
  // a hand-over: rules due before then are history
  if (opt.from != null) for (const r of rules) { const due = tmin(r.at ?? r.by); if (due != null && due < opt.from) S.done[r.id] = -1; }
  function tick() {
    for (const r of rules) {
      if (S.done[r.id]) continue;
      if (r.at != null && E.t < tmin(r.at)) continue;
      if (r.when && !test(r.when)) continue;
      if (plan.via === 'builder') {
        const res = C.order(Object.assign({}, r.spec, r.onAct ? { onAct: onAct(r.onAct) } : {}));
        S.done[r.id] = E.t;
        if (!res.ok) E.logEvent('orders', `Plan order ${r.id} refused: ${res.error}`, { side, hidden: true });
        else { S.at[r.id] = res.order; for (const o of res.orders || [res.order]) o.byScript = true; }
      } else {
        S.done[r.id] = E.t;
        E.sendOrder(orderOf(r, r.order, r.id));
        for (const a of r.also || []) E.sendOrder(orderOf({}, a, r.id + '_' + (a.obj || a.kind)));
      }
    }
  }
  return { S, tick, test };
}

// a battle's plans: E.plans runs every plan installed (the generic commanders call E.plans.tick each tick); a 'builder' plan runs from
// the command layer's script hook instead, as the player's orders do
function install(E, plan, opt = {}) {
  const p = make(E, plan, opt);
  if (plan.via === 'builder') { E.command.script = p.tick; E.command.scriptState = p.S; return p.S; }
  if (!E.plans) { const list = []; E.plans = { list, tick: E2 => { for (const q of list) q.tick(); } }; }
  E.plans.list.push(p);
  return p.S;
}

// the checks the validator runs on a plan: every place, unit, corps, rule and leader it names exists (W: the battle's map data)
const KINDS = ['after', 'before', 'place', 'contact', 'knows', 'garrison', 'shaken', 'done', 'arrived', 'flag', 'metric', 'morale', 'any', 'all', 'not'];
function check(plan, W, B, err) {
  const ids = new Set(plan.rules.map(r => r.id)), units = new Set(W.RAW.map(r => r[0]).concat(...(W.FORCES || []).map(f => f.units.map(u => u[0])), Object.keys(B.extraUnits || {})));
  const places = new Set([...W.STRONGPOINTS.map(s => s.id), ...Object.keys(W.OBJECTIVES)]), corps = new Set(Object.values(W.CORPS).concat(...(W.FORCES || []).map(f => f.units.map(u => u[7]))));
  const who = `plan ${plan.id}`;
  if (!B.sides.some(s => s.id === plan.side)) err(`${who}: side "${plan.side}" is not an army of this battle`);
  if (!['builder', 'order'].includes(plan.via)) err(`${who}: via must be 'builder' or 'order'`);
  const cond = (c, r) => {
    if (Array.isArray(c)) return c.forEach(x => cond(x, r));
    const k = Object.keys(c).find(x => KINDS.includes(x)); if (!k) return err(`${who} rule ${r.id}: unknown condition ${JSON.stringify(c)}`);
    if (k === 'any' || k === 'all') return c[k].forEach(x => cond(x, r));
    if (k === 'not') return cond(c.not, r);
    if (k === 'place' && !places.has(c.place)) err(`${who} rule ${r.id}: place "${c.place}" is not on the map`);
    if (k === 'garrison' && !places.has(c.garrison)) err(`${who} rule ${r.id}: place "${c.garrison}" is not on the map`);
    if (k === 'done' && !ids.has(c.done)) err(`${who} rule ${r.id}: no rule "${c.done}" to wait on`);
    if (k === 'shaken') for (const u of c.shaken) if (!units.has(u)) err(`${who} rule ${r.id}: no unit "${u}"`);
    if (k === 'arrived') for (const x of c.arrived) if (!corps.has(x)) err(`${who} rule ${r.id}: no corps "${x}"`);
  };
  for (const r of plan.rules) {
    if (!r.id) err(`${who}: a rule has no id`);
    if (r.when) cond(r.when, r);
    if (plan.via === 'builder' && !r.spec) err(`${who} rule ${r.id}: a builder plan's rule needs a spec`);
    if (plan.via === 'order' && !r.order) err(`${who} rule ${r.id}: an order plan's rule needs an order`);
    const us = r.spec ? [].concat(Array.isArray(r.spec.with) ? r.spec.with : r.spec.with ? [...(r.spec.with.lead || []), ...(r.spec.with.support || []), ...(r.spec.with.pool || [])] : []) : [...((r.order || {}).units || []), ...((r.order || {}).supports || [])];
    for (const u of us) if (!units.has(u)) err(`${who} rule ${r.id}: no unit "${u}"`);
  }
}

const api = { make, install, check, tmin };
root.WPlans = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
