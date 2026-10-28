/* Waterloo commanders: corps execution, Wellington, the Prussians, Ney, and the French historical-orders script.
   Every commander decides from his side's contacts (what has been seen), and orders travel by rider. */
(function (root) {
'use strict';
const hyp = Math.hypot, D2R = Math.PI / 180;
const Doc = () => root.WDoctrine || (typeof require === 'function' ? require('./doctrine.js') : null); // (3d) the generic habits ai.js shares
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fvec = deg => [Math.sin(deg * D2R), -Math.cos(deg * D2R)];
const bearing = (dx, dy) => (Math.atan2(dx, -dy) / D2R + 360) % 360;
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = clamp(t, 0, 1); return hyp(px - ax - t * dx, py - ay - t * dy); }
function polyDist(px, py, p) { let m = Infinity; for (let i = 1; i < p.length; i++) m = Math.min(m, segDist(px, py, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1])); return m; }
function nearestOnPoly(px, py, p) { let best = null, bd = Infinity; for (let i = 1; i < p.length; i++) { const [ax, ay] = p[i - 1], [bx, by] = p[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; let t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1); const q = [ax + t * dx, ay + t * dy], d = hyp(px - q[0], py - q[1]); if (d < bd) { bd = d; best = q; } } return best; }

/* ===================== what a commander knows ===================== */
// With the command layer running, every decision below reads the deciding commander's own belief record;
// without it (the 5a engine check), the side's shared sightings and the true state stand in.
function known(E, cid, maxAge, pred, coal) {
  if (E.command && E.command.B[cid]) { const out = []; for (const c of E.command.B[cid].c.values()) if (E.t - c.t <= maxAge && (!pred || pred(c))) out.push(c); return out; }
  const side = coal || E.coalition[(E.leaders[cid] || {}).side] || E.coalition[E.sideIds[1]]; // the commander's coalition's sightings
  return Object.values(E.contacts[side]).filter(c => E.t - c.t <= maxAge && (!pred || pred(c)));
}
function ownState(E, cid, u) {
  if (E.command && E.command.B[cid]) { const o = E.command.B[cid].own.get(u.id); if (o && o.tState >= 0) return o; return { str: u.str0, coh: 75, status: 'steady', x: u.x, y: u.y }; }
  return u;
}
function placeHolder(E, cid, spid) { if (E.command && E.command.B[cid]) { const p = E.command.B[cid].places[spid]; if (p) return p.holder; } return E.spById[spid].holder; }
// a computer commander's order to one of his brigades: carried by an aide when the command layer runs, at once otherwise
function viaAide(E, from, u, label, fn) {
  if (!E.command) { fn(); return; }
  E.command.message(from, null, label, () => {});
  const last = E.command.pendingLaunch[E.command.pendingLaunch.length - 1]; last.r.toPos = [u.x, u.y];
  last.r.onDeliver = () => { if (E.formed(u)) fn(); };
}
function news(E, cid) { return E.command && E.command.B[cid] ? E.command.B[cid].news : null; }

/* ===================== order execution (corps level) ===================== */
function units(E, ids) { return ids.map(id => E.byId[id]).filter(u => u && E.formed(u)); }
function execAttack(E, o) {
  const ob = E.objectives[o.obj]; if (!ob) return;
  const leads = units(E, o.units), sup = units(E, o.supports || []);
  leads.forEach((u, i) => {
    let tp = ob.line ? lerp(ob.line[0], ob.line[1], (i + 0.5) / leads.length) : ob.point;
    if (o.points && o.points[i]) tp = o.points[i];
    if (u.spId && u.type === 'gar') E.leaveSp(u);
    E.setTask(u, { kind: 'attack', sp: ob.sp || null, point: tp, order: o.id, attempts: (u.task.order === o.id ? u.task.attempts || 0 : 0), maxAttempts: o.maxAttempts ?? 3, form: o.form || 'attack', engineers: !!o.engineers, guard: !!o.guard }, o.cause);
    u.path = [tp]; u.stopAt = 0; u.lying = false;
    if (u.type === 'inf') E.setForm(u, o.form || 'attack');
  });
  sup.forEach((u, i) => { const lead = leads[Math.min(i, leads.length - 1)]; if (!lead) return; E.setTask(u, { kind: 'support', of: lead.id, order: o.id, form: o.supportForm || 'columns', obj: o.obj, sp: ob.sp || null }, o.cause); if (u.type === 'inf') E.setForm(u, o.supportForm || 'columns'); });
  if (!E.flags.opened && o.opens !== false) { E.flags.opened = E.t; E.logEvent('army', 'The battle opens.', { important: true }); }
}
function execAdvance(E, o) {
  const ob = E.objectives[o.obj] || (o.point ? { point: o.point } : null); if (!ob) return;
  const us = units(E, o.units);
  us.forEach((u, i) => {
    let tp = ob.line ? lerp(ob.line[0], ob.line[1], (i + 0.5) / us.length) : [ob.point[0] + (i - (us.length - 1) / 2) * 180 * (o.spreadX ?? 1), ob.point[1] + (o.offsetY || 0)];
    if (ob.own && u.task.kind === 'screen') return; // a corps going to its ground does not call in its cavalry screen
    if (ob.own && u.deploy) { tp = u.deploy.slice(); E.setTask(u, { kind: 'move', dest: tp, arriveFacing: u.deployFacing, arriveForm: u.type === 'inf' ? u.deployForm : null, order: o.id, then: 'hold' }, o.cause); E.routeTo(u, tp, true); return; } // (6) each to its own place in the line
    if (u.spId && u.type === 'gar') E.leaveSp(u);
    E.setTask(u, { kind: 'move', dest: tp, arriveFacing: o.facing ?? null, arriveForm: o.arriveForm || null, order: o.id, then: o.then || 'hold' }, o.cause);
    E.routeTo(u, tp, o.march !== false);
    if (u.type === 'inf' && o.form) E.setForm(u, o.form);
  });
}
function execBombard(E, o) {
  const site = E.objectives[o.site], area = E.objectives[o.area];
  const us = units(E, o.units);
  us.forEach((u, i) => {
    const sp = o.sitePoints && o.sitePoints[i] ? o.sitePoints[i] : site ? (site.line ? lerp(site.line[0], site.line[1], (i + 0.5) / us.length) : site.point) : [u.x, u.y]; // (phase 3) each battery's own site
    E.setTask(u, { kind: 'bombard', area: area ? (area.line || [area.point, area.point]) : null, areaKey: o.area || null, site: sp, order: o.id, incendiary: !!o.incendiary, arriveFacing: o.facing ?? null }, o.cause);
    if (hyp(sp[0] - u.x, sp[1] - u.y) > 60) { E.routeTo(u, sp, true); } else u.path = null;
  });
  if (!E.flags.opened && o.opens) { E.flags.opened = E.t; E.logEvent('army', 'The guns open fire: the battle has begun.', { important: true }); }
}
function execHold(E, o) { for (const u of units(E, o.units)) { E.setTask(u, { kind: 'hold', order: o.id, lieDown: !!o.lieDown }, o.cause); u.path = null; } }
function execCavRaid(E, o) {
  const area = E.objectives[o.area]; const home = o.home;
  for (const u of units(E, o.units)) { E.setTask(u, { kind: 'cavRaid', area: area.line || [area.point, area.point], home: home || [u.x, u.y - 0], order: o.id, charges: 0, maxCharges: o.maxCharges ?? 6 }, o.cause); u.path = null; }
}
// (6) the general retreat: each brigade makes for the high road and marches off the field toward Charleroi; the rearguard first
// stands across the road at Rossomme and follows once the rest are past
function execRetire(E, o) {
  const us = units(E, o.units), side = us.length ? us[0].side : undefined, own = o.exit ? E.ll2m(o.exit[0], o.exit[1]) : null, exit = own || E.retreatExit(side), rg = o.rear ? E.rearguardLine(side) : null; // own: (phase 5) a body leaving the field by another way than its army's retreat (d'Erlon's corps recalled)
  us.forEach((u, i) => {
    if (u.spId) E.leaveSp(u);
    const tp = rg ? lerp(rg[0], rg[1], (i + 0.5) / us.length) : exit, task = rg ? { kind: 'rearguard', dest: tp, since: E.t, order: o.id } : own ? { kind: 'retire', since: E.t, order: o.id, exit: own } : { kind: 'retire', since: E.t, order: o.id };
    if (u.charge) { u.charge.prevTask = task; return; } // a charge in progress rides back first, then takes up the order (below, under rally)
    E.setTask(u, task, o.cause); E.routeTo(u, tp, true);
    if (u.type === 'inf' && u.form !== 'square') E.setForm(u, 'columns');
  });
}
function execGarrison(E, o) { const sp = E.spById[o.sp]; for (const u of units(E, o.units)) { E.setTask(u, { kind: 'garrisonGo', sp: o.sp, order: o.id }, o.cause); E.routeTo(u, [sp.secs[0].x, sp.secs[0].y], true); } }

function apply(E, o) {
  o.status = 'done';
  const L = E.leaders[o.to];
  // interpretation: misreading risk = (1 - clarity) x (1 - skill) x 0.5
  const clarity = o.clarity ?? 0.9, skill = L ? L.skill : 0.7;
  if (clarity < 1 && o.kind === 'attack' && o.form && L && E.rnd('misread order') < (1 - clarity) * (1 - skill) * 0.5) {
    const alt = o.form === 'attack' ? 'mass' : o.form === 'mass' ? 'attack' : o.form;
    E.logEvent('orders', `${L.name} reads the order differently and forms ${alt === 'mass' ? 'the massed division columns' : 'columns of attack'}.`, { side: L.side, hidden: true });
    o.form = alt;
  }
  if (o.kind === 'attack' && o.guard && E.metrics.guardAttack == null) E.metrics.guardAttack = E.t; // (phase 5) the Guard going in, however the order came (Ligny's recorded orders go straight out)
  if (o.kind === 'attack') execAttack(E, o);
  else if (o.kind === 'advance' || o.kind === 'move' || o.kind === 'withdraw') execAdvance(E, o);
  else if (o.kind === 'bombard') execBombard(E, o);
  else if (o.kind === 'hold') execHold(E, o);
  else if (o.kind === 'cavRaid') execCavRaid(E, o);
  else if (o.kind === 'garrison') execGarrison(E, o);
  else if (o.kind === 'retire') execRetire(E, o);
  if (o.onAct) o.onAct(E, o);
  if (o.text) E.logEvent('orders', o.text, { side: L ? L.side : E.sideIds[0], hidden: o.hidden !== false ? true : false });
}

/* ===================== unit-level behaviour shared by all commanders ===================== */
function unitControl(E) {
  for (const u of E.units) {
    if (!E.formed(u)) continue;
    const t = u.task;
    if (t.kind === 'attack') {
      if (u.type === 'cav') continue;
      const status = u.status, led = u.leader && E.leaders[u.leader] && E.leaders[u.leader].alive;
      const underFire = E.tick - u.lastHit < 2;
      if (status === 'disordered' || (status === 'shaken' && underFire && !led)) { u.halted = true; }
      else if (u.halted && u.coh >= 50) u.halted = false;
      // after dark no new attacks
      if (E.t > E.light.dark) { u.halted = true; }
      if (u.halted) continue;
      // direction: the strongpoint section still held by the enemy, else the assigned point, else the nearest enemy in front
      let goal = t.point;
      if (t.sp) { const sp = E.spById[t.sp]; const sec = sp.secs.find(s => s.held && s.held !== E.coalition[u.side] && !s.burnt); if (sec) goal = [sec.x, sec.y]; else if (sp.holder && sp.holder === E.coalition[u.side]) { /* already ours */ if (u.type !== 'gar') { E.setTask(u, { kind: 'hold' }); continue; } } else { const s0 = sp.secs.find(s => !s.burnt) || sp.secs[0]; goal = [s0.x, s0.y]; if (hyp(u.x - s0.x, u.y - s0.y) < s0.r + 60) { const enemyIn = E.near(s0.x, s0.y, s0.r + 80, e => E.isEnemy(u, e) && E.formed(e)).length; if (!enemyIn) { E.enterSp(u, sp); continue; } } } }
      const blk = E.near(u.x, u.y, 260, e => E.isEnemy(u, e) && E.formed(e) && e.type !== 'art' && !e.spId);
      let tgt = null, bd = 1e9; for (const e of blk) { const d = hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; tgt = e; } }
      if (tgt && (!t.sp || hyp(tgt.x - goal[0], tgt.y - goal[1]) < 300)) { goal = [tgt.x, tgt.y]; t.targetUnit = tgt.id; }
      const d = hyp(goal[0] - u.x, goal[1] - u.y);
      u.pace = d < 300 ? 'quick' : null;
      if (u.standoffUntil && E.tick < u.standoffUntil) { // firefight at about 90 m before pressing again
        const back = Math.max(0, 90 - Math.max(0, d - (tgt ? (u.D + tgt.D) / 2 : 30))); if (back > 5) { const v = [u.x - goal[0], u.y - goal[1]], L = hyp(v[0], v[1]) || 1; u.path = [[u.x + v[0] / L * back, u.y + v[1] / L * back]]; u.stopAt = 0; } else u.path = null; u.pace = null; continue; }
      if (d > 40) { u.path = [goal]; u.stopAt = tgt ? (u.D + tgt.D) / 2 + 35 : (t.sp ? 30 : 0); }
      else if (!tgt && !t.sp) { // reached the objective with no enemy in front
        E.setTask(u, { kind: 'hold', reached: t.order }); u.path = null; E.setForm(u, 'line');
      }
      if (t.engineers && t.sp && E.rnd && u.contactTicks === 1) { const sp = E.spById[t.sp]; const sec = sp.secs.find(s => s.held && s.held !== E.coalition[u.side]); if (sec && sec.cover <= 0.3 && E.rnd('gate broken') < 0.1) { u.gateBonus = true; u.gateAt = E.tick; E.logEvent('event', `Sappers with axes break a gate at ${sp.name}!`, { side: u.side, unit: u.id, important: true }); } }
      if (t.sp === 'hougoumont' && u.side === 'FR' && u.contactTicks === 1 && E.spById.hougoumont.secs.find(s => s.held === 'AL' && !s.burnt && s.cover <= 0.3) === E.spById.hougoumont.secs.find(s => s.held === 'AL' && !s.burnt) && E.rnd('gate broken') < 0.08) { u.gateBonus = true; u.gateAt = E.tick; E.logEvent('event', 'A sous-lieutenant with an axe smashes through the north gate of Hougoumont!', { side: 'FR', unit: u.id, important: true }); }
    } else if (t.kind === 'support') {
      const lead = E.byId[t.of];
      if (!lead || !E.formed(lead) || lead.task.kind === 'rally' || lead.status === 'disordered') {
        // take over the attack
        if (u.coh >= 50 && E.t < E.light.dark) { const ob = E.objectives[t.obj]; const pt = lead && lead.task.point ? lead.task.point : (ob ? ob.point : [u.x, u.y]); E.setTask(u, { kind: 'attack', sp: t.sp, point: pt, order: t.order, attempts: 0, maxAttempts: 2, form: 'attack' }); E.setForm(u, 'attack'); u.path = [pt]; }
        else { E.setTask(u, { kind: 'hold' }); u.path = null; }
        continue;
      }
      if (lead.task.kind === 'hold' || lead.task.kind === 'garrison') { E.setTask(u, { kind: 'hold' }); u.path = null; continue; }
      const [bx, by] = fvec((lead.facing + 180) % 360), pos = [lead.x + bx * 170, lead.y + by * 170];
      if (hyp(pos[0] - u.x, pos[1] - u.y) > 40) { u.path = [pos]; u.stopAt = 0; }
    } else if (t.kind === 'rally') {
      if (!u.path || !u.path.length) {
        // re-attack if the order still stands and the unit has recovered
        const prev = t.prev;
        if (prev && (prev.kind === 'retire' || prev.kind === 'rearguard')) { E.setTask(u, prev); E.routeTo(u, prev.kind === 'retire' ? E.retreatExit(u.side) : prev.dest, true); }
        else if (prev && prev.kind === 'attack' && u.coh >= 55 && (prev.attempts || 0) + 1 < (prev.maxAttempts ?? 3) && E.t < E.light.dark && u.type === 'inf') {
          const L = u.corps && E.leaders[u.corps]; const keen = L ? L.agg : 0.6;
          if (E.rnd('renew attack') < 0.15 + 0.25 * keen) { E.setTask(u, Object.assign({}, prev, { attempts: (prev.attempts || 0) + 1 })); u.path = [prev.point]; E.setForm(u, prev.form || 'attack'); E.logEvent('combat', `${u.name} goes forward again.`, { side: u.side, unit: u.id }); }
        } else if (u.type === 'cav' && prev && prev.kind === 'cavRaid') { u.task = prev; }
        else if (E.t - t.since > 30 && u.type !== 'cav') { E.setTask(u, { kind: 'hold' }); }
        else if (u.type === 'cav' && E.t - t.since > 10 && !(prev && prev.kind === 'cavRaid')) { E.setTask(u, { kind: 'hold' }); }
      }
    } else if (t.kind === 'move') {
      if ((!u.path || !u.path.length) && u.formTimer === 0) { if (t.then === 'hold') E.setTask(u, { kind: 'hold', lieDown: !!t.lieDown, order: t.order }); else if (t.then && typeof t.then === 'object') { E.setTask(u, t.then); } }
    } else if (t.kind === 'bombard') {
      if (u.type === 'art' && (!u.path || !u.path.length) && u.form === 'limbered' && u.formTimer === 0) { u.formTo = 'battery'; u.formTimer = 1; }
      if (u.task.arriveFacing == null && t.area && u.form === 'battery') { const q = nearestOnPoly(u.x, u.y, t.area); if (q) u.facing = bearing(q[0] - u.x, q[1] - u.y); }
    } else if (t.kind === 'cavRaid') {
      if (u.charge) continue;
      if (u.wind < 55 || u.coh < 40 || t.charges >= t.maxCharges) {
        if (hyp(u.x - t.home[0], u.y - t.home[1]) > 80) u.path = [t.home];
        if (t.charges >= t.maxCharges || u.coh < 35) { E.setTask(u, { kind: 'rally', at: t.home }); u.path = [t.home]; }
        continue;
      }
      // choose a target on or near the area that we can see
      const cands = E.near(u.x, u.y, 1100, e => E.isEnemy(u, e) && E.formed(e) && e.type !== 'gar' && polyDist(e.x, e.y, t.area) < 450);
      let best = null, bs = -1;
      for (const e of cands) { const l = E.losU(u, e, 2.6); if (!l.clear && hyp(e.x - u.x, e.y - u.y) > 300) continue; const sc = (e.form === 'square' ? 1 : e.type === 'art' ? 2 : e.type === 'cav' ? 1.5 : 3) / (1 + hyp(e.x - u.x, e.y - u.y) / 400) * (e.status === 'steady' ? 1 : 1.6); if (sc > bs) { bs = sc; best = e; } }
      if (best) { if (E.charge(u, best, t.cause)) { u.charge.prevTask = t; t.charges++; } }
      else { // ride up onto the plateau to look
        const q = nearestOnPoly(u.x, u.y, t.area); if (q && hyp(q[0] - u.x, q[1] - u.y) > 120) { u.path = [q]; u.pace = null; }
      }
    } else if (t.kind === 'garrisonGo') {
      const sp = E.spById[t.sp];
      const dIn = hyp(u.x - sp.secs[0].x, u.y - sp.secs[0].y);
      // (8) out of road short of the place: march on (once), else give up; before, it went in from wherever it stood, up to a kilometre away
      if ((!u.path || !u.path.length) && dIn > 400) { if (!t.rerouted) { t.rerouted = true; E.routeTo(u, [sp.secs[0].x, sp.secs[0].y], true); } else E.setTask(u, { kind: 'hold' }); }
      else if (!u.path || !u.path.length || dIn < 80) {
        if (!sp.holder || sp.holder === E.coalition[u.side]) { E.enterSp(u, sp); }
        else { E.setTask(u, { kind: 'attack', sp: sp.id, point: [sp.x, sp.y], attempts: 0, maxAttempts: 3, form: 'attack' }); }
      }
    } else if (t.kind === 'pursue') {
      if (!u.path || !u.path.length) { u.pursuing = false; const [bx, by] = E.rallyBack(u); E.setTask(u, { kind: 'rally', at: [u.x + bx, u.y + by] }); u.path = [u.task.at]; }
      u.wind = Math.max(0, u.wind - 2);
    } else if (t.kind === 'retire') {
      if (!u.path || !u.path.length) { if (t.exit ? hyp(u.x - t.exit[0], u.y - t.exit[1]) < 200 : E.atRear(u, 200)) E.withdrawUnit(u); else E.routeTo(u, t.exit || E.retreatExit(u.side), true); }
    } else if (t.kind === 'rearguard') {
      if ((!u.path || !u.path.length) && !t.arrived) { t.arrived = E.t; u.facing = E.frontFacing(u.side); if (u.type === 'inf') E.setForm(u, 'square'); }
      // follow once nothing of ours that is still formed is north of the rearguard, or it is badly hurt, or after two hours
      const behind = E.units.some(f => f.side === u.side && f !== u && E.formed(f) && f.task.kind !== 'rearguard' && E.rearOf(u.side, t.dest, f, 150));
      if ((t.arrived && E.t - t.arrived > 20 && !behind) || u.coh < 35 || E.t - t.since > 120) { E.setTask(u, { kind: 'retire', since: E.t }); E.routeTo(u, E.retreatExit(u.side), true); if (u.type === 'inf') E.setForm(u, 'columns'); }
    } else if (t.kind === 'march') {
      if (t.wait) continue;
      if (!u.path || !u.path.length) {
        if (t.then) { const nt = typeof t.then === 'function' ? t.then(E, u) : t.then; if (nt) E.setTask(u, nt); }
        else E.setTask(u, { kind: 'hold' });
        if (u.form === 'road') E.setForm(u, 'columns'); if (u.type === 'art' && u.form === 'limbered') { u.formTo = 'battery'; u.formTimer = 1; }
      }
    }
  }
}

/* ===================== Wellington =====================
   (3d) Wellington is the generic doctrine (doctrine.js, defend) with his habits and numbers in the Waterloo pack (side AL: crest, feeds,
   counter, sectors, reoccupy, stepBack, liaison, shifts, advance, withdraw, calls). The reference battles replay exactly with it, as they
   did with the code it replaced (release 3's wellingtonInit, wellingtonUnits, wellington and uxbridge). */

/* ===================== armies on the march, and the generals' own initiative =====================
   (3d) Blücher's march and Grouchy's choice are the generic habits of an arriving army (doctrine.js: approachInit, approachArrival,
   approachTick, toGunsTick) with Waterloo's numbers in the pack (side PR: delays, waits, follows, flanks, press, pursue, reports; side FR:
   toGuns). The reference battles replay exactly with them, as they did with the code they replaced (release 3's prussianInit,
   onPrussianArrival and prussians). The generals' own strokes (Lobau, Ney, Jérôme) are the pack's initiative, by the same module. Both run
   for every army not handed to the generic doctrine, which takes its own decisions. */
function initiativeTick(E, S) {
  for (const sd of E.sides) {
    const st = S.timetable[sd.id];
    if (!st || !sd.initiative || E.flags[sd.id.toLowerCase() + 'Withdraw']) continue; // (6) in a general retreat nobody starts anything new
    if (sd.initiative.garrison) Doc().garrisonTick(E, sd.id, sd.initiative.garrison, st);
    if (sd.initiative.charge && st.chargeLine) Doc().chargeTick(E, sd.id, sd.initiative.charge, st.chargeLine, st);
  }
}

const reserved = (E, u) => !!(E.command && E.command.reserved && E.command.reserved[u.id]); // held back by the Emperor's own order: Ney cannot take them (5e)
function fittest(E, ids, n) { return ids.map(id => E.byId[id]).filter(u => u && E.formed(u) && !reserved(E, u) && u.status !== 'disordered' && u.task.kind !== 'attack' && u.task.kind !== 'garrison').sort((a, b) => b.coh * b.str - a.coh * a.str).slice(0, n).map(u => u.id); }
function runPlan(E, S) {
  const plan = E.plan;
  for (const p of plan.steps) {
    if (plan.done[p.id]) continue;
    if (p.at != null && E.t < p.at) continue;
    if (p.when && !p.when(E)) continue;
    plan.done[p.id] = E.t;
    if (p.prep) p.prep(E);
    const o = Object.assign({ id: p.id }, p.order, { onAct: p.onAct });
    if (p.pick) { o.units = p.pick(E); if (!o.units.length) continue; }
    E.sendOrder(o);
    if (p.also) for (const a of p.also) E.sendOrder(Object.assign({ id: p.id + '_' + a.obj }, a));
  }
}

/* ===================== the AI object ===================== */
function make(opts = {}) {
  const S = {};
  const ai = {
    S,
    init(E) {
      E.ai = ai; E.plan = { steps: [], done: {} };
      // (3d) the allied army is commanded by the generic doctrine, its habits from the battle pack (opts.generic may name more armies);
      // the others march, halt and attack by their timetables and their generals' initiative (battle pack)
      // (phase 5) the battle pack names the armies the generic doctrine commands in the historical battle (Waterloo: the allies; Ligny:
      // the Prussians); opts.generic may name more
      const B = (root.WPacks || (typeof require === 'function' ? require('./packs/all.js') : null)).battle(E.battleId).battle, setup = B.setup || {};
      S.generic = [...new Set([...((B.commanders || {}).generic || []), ...(opts.generic || [])])];
      S.gen = Doc().make({ sides: S.generic, embedded: true }).init(E);
      S.timetable = {};
      for (const sd of E.sides) if (!S.generic.includes(sd.id)) S.timetable[sd.id] = Doc().approachInit(E, sd.id, sd, {});
      // the other armies' starting posture: hold, guns holding fire until ordered (their orders come from the plan)
      for (const u of E.units) if (!S.generic.includes(u.side) && u.onMap) u.task = { kind: 'hold', since: E.t };
      // (phase 5) the start as the battle pack sets it: bodies posted to screen a flank (Waterloo: Marbot's hussars toward Lasne), and
      // batteries made up out of a larger one (Waterloo: the Guard's 24 twelve-pounders for the grand battery)
      for (const sc of setup.screens || []) { const u = E.byId[sc.unit]; if (u) u.task = { kind: 'screen', area: E.ll2m(sc.at[0], sc.at[1]), since: E.t }; }
      for (const d of setup.detach || []) {
        const g = E.byId[d.from];
        if (g && !E.byId[d.id]) { g.str -= d.guns; g.str0 -= d.guns; g.guns0 = g.str; const u = addUnit(E, { id: d.id, side: g.side, name: d.name, parent: d.parent, nat: g.nat, type: 'art', str: d.guns, x: g.x + (d.dx || 0), y: g.y + (d.dy || 0), facing: d.facing || 0, form: d.form, q: d.q, corps: d.corps, cal: d.cal }); u.coh = d.coh; u.shells = 0; }
      }
      return ai;
    },
    tick(E) {
      unitControl(E);
      S.gen.tick(E);
      for (const sd of E.sides) if (S.timetable[sd.id]) Doc().approachTick(E, sd.id, sd, S.timetable[sd.id]);
      for (const sd of E.sides) if (S.timetable[sd.id]) Doc().toGunsTick(E, sd.id, sd, S.timetable[sd.id]);
      initiativeTick(E, S);
      if (E.plan.steps.length) runPlan(E, S);
      if (E.plans) E.plans.tick(E); // (phase 5) plans whose rules go straight out as orders (plans.js, via 'order'); a 'builder' plan runs from the command layer
      if (opts.onTick) opts.onTick(E, S);
    },
    receive(E, o) { apply(E, o); },
    onArrival(E, u) { if (S.timetable[u.side]) Doc().approachArrival(E, u, E.sides.find(s => s.id === u.side), S.timetable[u.side]); },
    onRepulse(E, a, d, tgt) {
      // a general sends his next body in when an attack is thrown back (the battle pack's initiative.escalate: Jérôme at Hougoumont)
      for (const sd of E.sides) if (S.timetable[sd.id] && sd.initiative && sd.initiative.escalate) Doc().escalateOnRepulse(E, sd.id, sd.initiative.escalate, a, tgt, S.timetable[sd.id]);
      S.gen.onRepulse(E, a, d, tgt); // and the generic armies' generals
    },
  };
  return ai;
}
function addUnit(E, spec) {
  // create a unit after start (uses the engine's internal factory via detach-like path)
  const u = Object.assign({ q: 1, coh: 80, cohMax: 100, fatigue: 25, ammo: 50, rounds: 120, wind: 100, status: 'steady', lying: false, onMap: true, gone: false, formTo: null, formTimer: 0, task: { kind: 'hold' }, path: null, killed: 0, wounded: 0, captured: 0, stragglers: 0, hitTick: { mus: 0, art: 0, flank: 0, cav: 0 }, firedTick: false, lastHit: -99, lastFired: -99, shells: 0, silencedUntil: 0, isGuard: true, minCoh: 80 }, spec);
  u.str0 = u.str; u.guns0 = u.str; const fp = E.footprint(u); u.F = fp.F; u.D = fp.D; E.units.push(u); E.byId[u.id] = u; return u;
}

const api = { make, apply, unitControl, known, ownState, viaAide, placeHolder, news, nearestOnPoly, polyDist, addUnit, fittest, reserved }; // (phase 3) the helpers the generic commanders share
root.WAI = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
