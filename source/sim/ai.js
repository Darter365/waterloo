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
  const us = units(E, o.units), side = us.length ? us[0].side : undefined, exit = E.retreatExit(side), rg = o.rear ? E.rearguardLine(side) : null;
  us.forEach((u, i) => {
    if (u.spId) E.leaveSp(u);
    const tp = rg ? lerp(rg[0], rg[1], (i + 0.5) / us.length) : exit, task = rg ? { kind: 'rearguard', dest: tp, since: E.t, order: o.id } : { kind: 'retire', since: E.t, order: o.id };
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
      if (!u.path || !u.path.length) { if (E.atRear(u, 200)) E.withdrawUnit(u); else E.routeTo(u, E.retreatExit(u.side), true); }
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

/* ===================== Wellington ===================== */
function allies(E) { return E.units.filter(u => u.side === 'AL' && E.formed(u)); }
function wellingtonInit(E, S) {
  // first-line infantry hold behind the crest, lying down when bombarded; reserves hold. (3d) The crest and the first line are the battle
  // pack's (side AL: crest), and the habit is the generic doctrine's (doctrine.js: crestInit, crestTick)
  const cfg = E.sides.find(s => s.id === 'AL').crest;
  for (const u of E.units) {
    if (u.side !== 'AL' || !u.onMap) continue;
    if (u.type === 'inf') u.task = { kind: 'hold', lieDown: true, crest: null, res: [u.x, u.y], resFacing: u.facing, resForm: u.form, since: E.t };
    else if (u.type === 'art') u.task = { kind: 'hold', since: E.t };
    else if (u.type === 'cav') u.task = { kind: 'hold', since: E.t, home: [u.x, u.y] };
  }
  S.crestLine = Doc().crestInit(E, 'AL', cfg); S.crestCfg = cfg;
  S.reserves = ['lambert', 'kruse', 'bruAv', 'bruButlar', 'bruSpecht', 'detmers', 'aubreme', 'adam', 'duplat', 'hhalkett'];
  S.hougFeeds = 0; S.lhsFeeds = 0; S.lastFeed = 0; S.lastReserve = 0; S.counterCharged = {};
}
function wellingtonUnits(E, S) {
  // crest behaviour every tick: stand up and come forward when enemy foot approach the crest (the generic doctrine's crest habit)
  Doc().crestTick(E, 'AL', S.crestCfg);
}
function wellington(E, S) {
  const t = E.t, W = E.leaders.wellington, crest = S.crestLine, N = news(E, 'wellington');
  const frSeen = (maxAge, pred) => known(E, 'wellington', maxAge, c => c.side === 'FR' && (!pred || pred(c)));
  // feed Hougoumont through the hollow way. This was decided on the spot by Byng and Cooke, who could see the farm,
  // not by Wellington from the elm, so it reads the garrison's true state, as a local reaction (rules doc: subordinates react locally).
  const hg = E.byId[E.spById.hougoumont.garrison];
  if (hg && E.formed(hg) && t - S.lastFeed > 25 && S.hougFeeds < 7) {
    const cap = E.spById.hougoumont.secs.filter(s => s.held === 'AL' && !s.burnt).reduce((a, s) => a + s.cap, 0);
    const attacked = E.near(hg.x, hg.y, 600, e => e.side === 'FR' && E.formed(e) && e.type === 'inf').length > 0;
    if (attacked && (hg.str < Math.min(cap, 2200) * 0.6 || hg.coh < 45)) {
      const donors = ['byng', 'maitland', 'duplat', 'hhalkett', 'bruAv', 'bruButlar'].map(id => E.byId[id]).filter(u => u && E.formed(u) && u.str > 900 && u.coh > 45);
      const d = donors[0];
      if (d) {
        const men = clamp(Math.round(Math.min(cap, 2200) * 0.8 - hg.str), 300, 700);
        const det = E.detach(d, men, 'feed' + S.hougFeeds + d.id, `${d.name}'s battalion for Hougoumont`);
        if (det) { const sp = E.spById.hougoumont; E.setTask(det, { kind: 'garrisonGo', sp: sp.id }); det.path = [sp.access[0], sp.access[1]]; S.hougFeeds++; S.lastFeed = t; E.logEvent('orders', `${d.name} sends ${det.str | 0} men down the hollow way into Hougoumont.`, { side: 'AL', hidden: true }); }
      }
    }
  }
  // La Haye Sainte reinforcement
  const lg = E.byId[E.spById.lhs.garrison];
  if (lg && E.formed(lg) && lg.str < 300 && S.lhsFeeds < 2 && t - (S.lastLhs || 0) > 30) { // decided by Alten and Ompteda on the spot
    const d = [E.byId.ompteda, E.byId.kielm, E.byId.kruse].find(u => u && E.formed(u) && u.str > 700);
    if (d) { const det = E.detach(d, 220, 'lhsfeed' + S.lhsFeeds, `Companies of ${d.name} for La Haye Sainte`); if (det) { det.ammo = 50; E.setTask(det, { kind: 'garrisonGo', sp: 'lhs' }); det.path = [E.spById.lhs.access[0], E.spById.lhs.access[1]]; S.lhsFeeds++; S.lastLhs = t; } }
  }
  uxbridge(E, S);
  // reserves to the threatened sector
  if (t - S.lastReserve > 20) {
    const sectors = [{ n: 'right', x0: 0, x1: E.ll2m(50.68, 4.403)[0] }, { n: 'centre', x0: E.ll2m(50.68, 4.403)[0], x1: E.ll2m(50.68, 4.4215)[0] }, { n: 'left', x0: E.ll2m(50.68, 4.4215)[0], x1: 99999 }];
    let worst = null, ws = 0;
    for (const s of sectors) {
      const mine = E.units.filter(u => u.side === 'AL' && u.type === 'inf' && u.onMap && u.task.crest && u.x >= s.x0 && u.x < s.x1);
      const weak = mine.reduce((a, u) => { const o = ownState(E, 'wellington', u); return a + (o.status !== 'broken' && !o.gone ? Math.max(0, 55 - o.coh) * o.str / 1000 : u.str0 / 300); }, 0);
      const foes = frSeen(30, c => c.x >= s.x0 && c.x < s.x1 && polyDist(c.x, c.y, crest) < 700).reduce((a, c) => a + c.str, 0);
      const sc = weak + foes / 1500;
      if (sc > ws) { ws = sc; worst = s; }
    }
    if (worst && ws > 3) {
      const cand = S.reserves.map(id => E.byId[id]).filter(u => u && E.formed(u) && u.task.kind === 'hold' && !u.task.crest && u.coh > 50);
      cand.sort((a, b) => Math.abs(a.x - (worst.x0 + Math.min(worst.x1, 9000)) / 2) - Math.abs(b.x - (worst.x0 + Math.min(worst.x1, 9000)) / 2));
      const r = cand[0];
      if (r) {
        // take the place of the weakest first-line brigade in that sector, or stand behind it
        const first = E.units.filter(u => u.side === 'AL' && u.type === 'inf' && u.task.crest && u.x >= worst.x0 && u.x < worst.x1).sort((a, b) => (E.formed(a) ? a.coh : 0) - (E.formed(b) ? b.coh : 0))[0];
        const spot = first ? [first.task.res[0], first.task.res[1] - 140] : [r.x, r.y];
        const q = nearestOnPoly(spot[0], spot[1], crest);
        S.lastReserve = t; S.reserves = S.reserves.filter(id => id !== r.id); const wn = worst.n;
        viaAide(E, 'wellington', r, `Wellington's order to ${r.name}`, () => {
          E.setTask(r, { kind: 'move', dest: spot, then: { kind: 'hold', lieDown: true, crest: q ? [q[0], q[1] + 15] : null, res: spot, resFacing: 180 } });
          E.routeTo(r, spot, true);
          E.logEvent('orders', `Wellington brings ${r.name} up behind the ${wn}.`, { side: 'AL', hidden: true });
        });
      }
    }
  }
  // re-occupy abandoned farms in front of the line if no French are close
  for (const id of ['lhs', 'sandpit', 'papelotte', 'lahaye', 'smohain', 'hougoumont']) {
    const sp = E.spById[id]; if (sp.holder || S['reocc_' + id] && t - S['reocc_' + id] < 40 || (S['reoccN_' + id] || 0) >= 2) continue;
    if (E.command ? frSeen(20, c => hyp(c.x - sp.x, c.y - sp.y) < 450 && c.status !== 'broken').length : E.near(sp.x, sp.y, 400, e => e.side === 'FR' && E.formed(e)).length) continue;
    const donor = E.units.filter(u => u.side === 'AL' && u.type === 'inf' && E.formed(u) && u.str > 900 && u.coh > 55 && hyp(u.x - sp.x, u.y - sp.y) < 1200).sort((a, b) => hyp(a.x - sp.x, a.y - sp.y) - hyp(b.x - sp.x, b.y - sp.y))[0];
    if (donor && !sp.secs.every(s => s.burnt)) { S['reocc_' + id] = t; S['reoccN_' + id] = (S['reoccN_' + id] || 0) + 1; const tt = t; viaAide(E, 'wellington', donor, `Wellington's order to re-occupy ${sp.name}`, () => { if (sp.holder) return; const det = E.detach(donor, id === 'hougoumont' ? 700 : 300, 're' + id + tt, `${donor.name}'s companies for ${sp.name}`); if (det) { det.detachment = true; E.setTask(det, { kind: 'garrisonGo', sp: id }); det.path = [sp.access[0], sp.access[1]]; } }); }
  }
  if (!S.stepBack && t > 15 * 60) { const hurt = E.units.filter(u => u.side === 'AL' && u.type === 'inf' && E.formed(u) && u.task.crest && (u.srcArt || 0) > 150); if (hurt.length >= 3) { S.stepBack = t; for (const u of hurt) viaAide(E, 'wellington', u, `Wellington's order to ${u.name} to step back`, () => { if (!u.task.res) return; const r = [u.task.res[0], u.task.res[1] - 90]; u.task.res = r; if (u.task.state !== 'up') { u.path = [r]; u.lying = false; } }); E.logEvent('orders', 'Wellington pulls the first line back a hundred paces out of the cannonade.', { side: 'AL', hidden: true }); } }
  // Müffling's messages to Blücher: when the French main attack comes in, when things go badly, and every hour (est.)
  if (E.command) {
    const attackSeen = frSeen(15, c => (c.kind === 'inf' || c.kind === 'troops') && polyDist(c.x, c.y, crest) < 1100 && c.moving).reduce((a, c) => a + c.str, 0) > 3000;
    const lhsLost = placeHolder(E, 'wellington', 'lhs') === 'FR';
    const why = attackSeen && !S.toldAttack ? 'attack' : E.morale.AL < 55 && !S.toldDanger ? 'danger' : lhsLost && !S.toldLhs ? 'lhs' : t - (S.lastMsg || 0) >= 60 ? 'hourly' : null;
    if (why) {
      if (why === 'attack') S.toldAttack = t; if (why === 'danger') S.toldDanger = t; if (why === 'lhs') S.toldLhs = t; S.lastMsg = t;
      const m = E.morale.AL, engaged = !!S.toldAttack;
      E.command.message('wellington', 'blucher', `Müffling's message to Blücher (${why})`, (B, w) => { B.news.alMorale = { v: m, t: w }; if (engaged && !B.news.wellEngaged) B.news.wellEngaged = w; if (lhsLost) B.news.lhsLost = w; });
    }
  }
  // left-wing cavalry moves to the centre once Zieten arrives
  const zietenKnown = E.command ? Object.values(E.command.B.wellington.friends).some(f => E.t - f.t < 30 && hyp(f.x - E.spById.papelotte.x, f.y - E.spById.papelotte.y) < 1500) || (N && N.zieten) : E.metrics.zietenPapelotte;
  if (zietenKnown && !S.cavShift) { S.cavShift = true; for (const id of ['vivian', 'vandeleur']) { const c = E.byId[id]; if (c && E.formed(c) && !c.charge) viaAide(E, 'wellington', c, `Wellington's order to ${c.name}`, () => { if (c.charge) return; const dest = E.ll2m(50.6850, 4.4040); E.setTask(c, { kind: 'move', dest: [dest[0] + (id === 'vivian' ? 0 : 250), dest[1]], then: 'hold' }); E.routeTo(c, c.task.dest, true); }); } E.logEvent('orders', 'With Zieten on the left, Vivian and Vandeleur ride to the centre.', { side: 'AL', hidden: true }); }
  // general advance
  // the general advance: when he knows the Prussians are in, and sees the French infantry going: the Guard thrown back,
  // or six bodies of French foot seen running within half an hour (est.). Broken cavalry doesn't count; it rallies.
  const prIn = E.command ? !!(N && N.prEngaged) : !!E.flags.prEngaged;
  const frGoing = E.command ? (frSeen(30, c => c.guard && c.status === 'broken').length > 0 || frSeen(30, c => c.status === 'broken' && c.kind === 'inf').length >= 6) : (E.morale.FR < 30 || E.flags.FRBroken);
  if (!S.advanced && prIn && frGoing && E.t > 17 * 60) {
    S.advanced = true; E.logEvent('orders', 'Wellington raises his hat: the general advance.', { side: 'AL', important: true });
    for (const u of allies(E)) if (u.type !== 'gar' && u.type !== 'art' && u.coh > 40) { const dest = [u.x, u.y + 1400]; E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest]; u.lying = false; }
  }
  // (6) the French drawing off in order: about half an hour after the retreat begins he sees their positions emptying (est.) and
  // sends the line forward to follow up, as he did at 19:30 on the day
  if (!S.advanced && E.flags.frWithdraw && E.t - E.flags.frWithdraw >= 30) {
    S.advanced = true; E.logEvent('orders', 'Wellington sees the French drawing off and sends his line forward.', { side: 'AL', important: true });
    for (const u of allies(E)) if (u.type !== 'gar' && u.type !== 'art' && u.coh > 40) { const dest = [u.x, u.y + 1400]; E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest]; u.lying = false; }
  }
  // withdrawal if the line has gone and no Prussians by 19:00
  if (!S.withdraw && E.morale.AL < 25 && E.t > 19 * 60 && !prIn) {
    S.withdraw = true; E.logEvent('orders', 'Wellington orders the army back on the Forest of Soignes.', { side: 'AL', important: true });
    for (const u of allies(E)) viaAide(E, 'wellington', u, `Wellington's order to ${u.name} to withdraw`, () => { if (u.spId && u.type === 'gar') E.leaveSp(u); /* (8) a garrison comes out first: it cannot march while it holds the buildings, and stood there for good */ const dest = [u.x, Math.max(80, u.y - 2500)]; E.setTask(u, { kind: 'move', dest, then: 'hold' }); E.routeTo(u, dest, true); });
    E.flags.alWithdraw = E.t;
  }
  // call up the Hal force if the French threaten the west flank
  if (!S.halCalled) { const thr = frSeen(30, c => c.x < E.ll2m(50.68, 4.383)[0] && c.str > 1500).length > 0; if (thr) { S.halCalled = true; const base = E.t + E.rnd.range(240, 360, 'Hal force delay'); for (const u of E.offmap.filter(o => o.group === 'hal')) { u.arriveAt = base + (u.baseArrive || 0); u.marchThen = { kind: 'hold' }; } E.logEvent('orders', 'Wellington sends for Prince Frederik at Hal.', { side: 'AL', hidden: true }); } }
}

function uxbridge(E, S) {
  const t = E.t, crest = S.crestLine;
  // Uxbridge: counter-charge French infantry that has come close and is shaken or tumbling back
  const targets = E.units.filter(u => u.side === 'FR' && u.type === 'inf' && E.formed(u) && polyDist(u.x, u.y, crest) < 380 && u.y > 0 && (u.status !== 'steady' || u.task.kind === 'rally' || u.form === 'mass' && u.halted));
  for (const tg of targets) {
    if (S.counterCharged[tg.id] && t - S.counterCharged[tg.id] < 40) continue;
    const cavs = E.units.filter(c => c.side === 'AL' && c.type === 'cav' && E.formed(c) && !c.charge && c.wind > 60 && c.coh > 50 && c.task.kind === 'hold' && hyp(c.x - tg.x, c.y - tg.y) < 1300).sort((a, b) => hyp(a.x - tg.x, a.y - tg.y) - hyp(b.x - tg.x, b.y - tg.y));
    if (cavs.length && E.rnd('Uxbridge counter-charge') < 0.25 * E.leaders.uxbridge.agg) {
      const c = cavs[0]; E.charge(c, tg, E.cause(`Uxbridge launched ${c.name} at ${tg.name}`)); S.counterCharged[tg.id] = t;
      E.logEvent('combat', `${c.name} charges ${tg.name}.`, { side: 'AL', unit: c.id, important: true });
      if (cavs[1] && cavs[1].cavKind === 'heavy') E.charge(cavs[1], tg); break;
    }
  }
  // allied cavalry counter-charge spent French horsemen on the plateau
  for (const fc of E.units.filter(u => u.side === 'FR' && u.type === 'cav' && E.formed(u) && polyDist(u.x, u.y, crest) < 450 && u.y < crest[0][1] + 500 && (u.wind < 50 || u.coh < 50))) {
    const c = E.units.find(c => c.side === 'AL' && c.type === 'cav' && E.formed(c) && !c.charge && c.wind > 60 && c.coh > 45 && hyp(c.x - fc.x, c.y - fc.y) < 900 && c.task.kind === 'hold');
    if (c && E.rnd('allied cavalry counter') < 0.12) { E.charge(c, fc, E.cause(`${c.name} counter-charged blown French cavalry`)); break; }
  }
}

/* ===================== the Prussians ===================== */
function prussianInit(E, S) {
  const H = E.history, rnd = E.rnd, wide = H === 'open' ? 1.5 : 1;
  const hes = H !== 'strict' && rnd('Gneisenau hesitates') < 0.10 * wide ? rnd.range(60, 120, 'hesitation') : 0;
  const fire = H === 'strict' ? 60 : rnd.tri(0, 60, 180 * (H === 'open' ? 1.3 : 1), 'fire in Wavre');
  S.prDelay = { hes, fire };
  if (hes) E.logEvent('hidden', `Gneisenau doubts Wellington will stand, and holds the Prussian march back ${Math.round(hes)} minutes.`, { side: 'PR', hidden: true });
  E.logEvent('hidden', `The fire in Wavre costs Bülow's rear brigades ${Math.round(fire)} minutes (most likely about 60).`, { side: 'PR', hidden: true });
  for (const u of E.offmap.filter(o => o.group === 'prussians')) {
    const lead = /^b15|^b16/.test(u.id), dev = (fire - 60) * (lead ? 0.7 : 1);
    u.arriveAt = u.baseArrive + hes + dev + (H === 'open' ? rnd.normal('march noise') * 25 : rnd.normal('march noise') * 12);
    if (u.corps === 'zieten') u.arriveAt = u.baseArrive + hes * 0.5 + rnd.normal('Zieten march') * 30 * wide;
  }
  S.bulowRelease = null; S.bulowAttack = null; S.exitDelay = H === 'strict' ? 0 : (rnd("Bülow's exit from the woods") < 0.8 ? 0 : 45);
  if (S.exitDelay) E.logEvent('hidden', "Bülow's guides pick a poor track out of the Bois de Paris: 45 minutes lost.", { side: 'PR', hidden: true });
  // Grouchy: hears the guns at 11:30
  S.grouchy = { decided: false, comes: false };
}
function onPrussianArrival(E, u, S) {
  if (u.corps === 'bulow') {
    // wait concealed at Saint-Lambert until released, then file through the Lasne defile to the Bois de Paris
    u.task = { kind: 'march', then: null, since: E.t, wait: true }; u.path = null; u.halted = true;
    // they wait on the Saint-Lambert plateau, just past the map edge: EU-DEM puts it at 112-120 m against 100-105 m at the edge point
    u.heightBonus = 15;
    u.concealed = 0.02; // kept in the hollows and woods round Saint-Lambert (rules doc: concealment; value est., set so the French first glimpse them around midday)
  } else if (u.corps === 'pirch') {
    u.task = { kind: 'march', then: (E2, uu) => ({ kind: 'hold', prReady: true }), since: E.t };
  } else if (u.corps === 'zieten') {
    u.task = { kind: 'march', then: (E2, uu) => ({ kind: 'hold', zReady: true }), since: E.t };
  } else if (u.group === 'grouchy') {
    u.task = { kind: 'march', then: (E2, uu) => ({ kind: 'attack', point: E2.spById.plancenoit.secs[0].x ? [E2.spById.plancenoit.x, E2.spById.plancenoit.y] : [uu.x - 1500, uu.y], attempts: 0, maxAttempts: 2, form: 'attack' }), since: E.t };
  }
}
function prussians(E, S) {
  const t = E.t, strict = E.history === 'strict';
  const bul = E.units.filter(u => u.corps === 'bulow' && u.onMap && E.formed(u));
  // release from Saint-Lambert
  if (!S.bulowRelease) {
    const echelons = bul.filter(u => u.type === 'inf').length, BN = news(E, 'blucher');
    if (BN) {
      // Blücher judges Wellington seriously engaged after an hour of heavy cannonade from Mont-Saint-Jean (est.), or when Müffling says so
      const g = Object.entries(E.command.B.blucher.soundSlow).filter(([k]) => k.startsWith('guns')).reduce((a, [, v]) => a + v, 0);
      if (g >= 15) { if (BN.heavySince == null) BN.heavySince = t; } else if (g < 8) BN.heavySince = null;
      if (BN.heavySince != null && t - BN.heavySince >= 60 && !BN.wellEngaged) BN.wellEngaged = t;
    }
    const engaged = BN ? !!BN.wellEngaged : E.flags.alliedEngaged;
    const danger = BN ? !!(BN.alMorale && BN.alMorale.v < 55) : E.morale.AL < 55;
    if ((strict && t >= 13 * 60) || (!strict && ((echelons >= 4 && engaged) || (echelons >= 2 && danger) || t >= 15 * 60 + 30 && echelons >= 2))) {
      S.bulowRelease = t; E.logEvent('hidden', 'Blücher orders Bülow forward from Saint-Lambert into the Lasne valley.', { side: 'PR', hidden: true });
    }
  }
  if (S.bulowRelease) {
    for (const u of bul) if (u.task.kind === 'march' && u.task.wait) { u.task.wait = false; u.halted = false; u.heightBonus = 0; u.concealed = null; u.path = E.routes.bulow.slice(2).map(p => [p[0], p[1]]); u.task.then = (E2, uu) => ({ kind: 'hold', atWood: true }); }
  }
  // (6) the French drawing off: Blücher presses for the high road behind them, as Gneisenau's pursuit did on the night (est. 20 min to see it)
  if (!S.prPursuit && E.flags.frWithdraw && E.t - E.flags.frWithdraw >= 20) {
    const pr = E.units.filter(u => u.side === 'PR' && u.onMap && E.formed(u) && u.type !== 'art' && u.coh > 45);
    if (pr.length) {
      S.prPursuit = E.t; E.logEvent('orders', 'Blücher sees the French going and drives for the Charleroi road.', { side: 'PR', important: true });
      const road = E.routes.frRetreat;
      for (const u of pr) { const q = nearestOnPoly(u.x, u.y, road), dest = [q[0], Math.max(q[1], u.y)]; E.setTask(u, { kind: 'attack', point: dest, attempts: 0, maxAttempts: 1, form: 'columns' }); u.path = [dest]; }
    }
  }
  // assemble in the Bois de Paris, then attack Plancenoit and Frischermont
  const atWood = bul.filter(u => u.task.kind === 'hold' && u.task.atWood);
  if (!S.bulowAttack && atWood.filter(u => u.type === 'inf').length >= (strict ? 4 : 3)) { if (!S.woodReady) S.woodReady = t; const BN2 = news(E, 'blucher'), alBad = BN2 ? !!(BN2.alMorale && BN2.alMorale.v < 45) : E.morale.AL < 45; if (t >= S.woodReady + 20 + S.exitDelay || alBad) { S.bulowAttack = t; E.logEvent('hidden', 'Bülow debouches from the Bois de Paris.', { side: 'PR', hidden: true }); } }
  if (strict && !S.bulowAttack && t >= 16 * 60 + 30) S.bulowAttack = t;
  if (S.bulowAttack) {
    for (const u of bul) {
      if (u.task.kind !== 'hold' || !u.task.atWood) continue;
      const pl = E.spById.plancenoit, fr = E.spById.frischermont;
      let tgt;
      if (u.type === 'inf') { const north = /^b15/.test(u.id); tgt = north ? 'eastFlankN' : 'plancenoit'; }
      if (u.type === 'inf') {
        if (tgt === 'plancenoit') { E.setTask(u, { kind: 'attack', sp: 'plancenoit', point: [pl.x, pl.y], attempts: 0, maxAttempts: 3, form: 'attack' }); u.path = [[pl.x, pl.y]]; E.setForm(u, 'attack'); }
        else { const p = E.objectives.eastFlank.line[1]; E.setTask(u, { kind: 'attack', point: [p[0], p[1]], attempts: 0, maxAttempts: 6, form: 'attack' }); u.path = [p]; E.setForm(u, 'attack'); }
      } else if (u.type === 'art') { const site = E.ll2m(50.6655 + E.rnd('gun site') * 0.004, 4.4492); E.setTask(u, { kind: 'bombard', area: E.objectives.eastFlank.line, site }); E.routeTo(u, site, true); }
      else if (u.type === 'cav') { E.setTask(u, { kind: 'cavRaid', area: E.objectives.eastFlank.line, home: [u.x, u.y], charges: 0, maxCharges: 4 }); }
    }
    // keep pressing Plancenoit with whatever is rested
    if (E.tick % 10 === 0) for (const u of E.units.filter(u => u.side === 'PR' && u.type === 'inf' && E.formed(u) && u.task.kind === 'hold' && !u.task.atWood && u.coh > 65 && (u.corps === 'bulow' || u.corps === 'pirch'))) {
      const pl = E.spById.plancenoit; if (pl.holder === 'AL') continue;
      E.setTask(u, { kind: 'attack', sp: 'plancenoit', point: [pl.x, pl.y], attempts: 0, maxAttempts: 4, form: 'attack' }); u.path = [[pl.x, pl.y]];
    }
  }
  // Pirch follows Bülow along the same road, after Bülow's columns have cleared Saint-Lambert
  for (const u of E.units.filter(u => u.corps === 'pirch' && u.onMap && E.formed(u) && u.task.kind === 'hold' && u.task.prReady)) {
    u.task.prReady = false; const pl = E.spById.plancenoit;
    E.setTask(u, { kind: 'attack', sp: 'plancenoit', point: [pl.x, pl.y], attempts: 0, maxAttempts: 4, form: 'attack' }); u.path = [[pl.x, pl.y]];
  }
  if (S.bulowRelease) for (const u of E.units.filter(u => u.corps === 'pirch' && u.onMap && u.task.kind === 'march' && !u.path)) { u.path = E.routes.bulow.slice(2).map(p => [p[0], p[1]]); }
  // Zieten: down the Ohain road to Papelotte, then into the French right
  for (const u of E.units.filter(u => u.corps === 'zieten' && u.onMap && E.formed(u) && u.task.kind === 'hold' && u.task.zReady)) {
    u.task.zReady = false;
    if (S.zietenDiverted) { const pl = E.spById.plancenoit; E.setTask(u, { kind: 'attack', sp: 'plancenoit', point: [pl.x, pl.y], attempts: 0, maxAttempts: 3, form: 'attack' }); u.path = [[pl.x, pl.y]]; continue; }
    if (u.type === 'inf') { const pts = [E.spById.papelotte, E.spById.lahaye, E.spById.smohain]; const target = E.units.filter(e => e.side === 'FR' && E.formed(e) && hyp(e.x - u.x, e.y - u.y) < 2500).sort((a, b) => hyp(a.x - u.x, a.y - u.y) - hyp(b.x - u.x, b.y - u.y))[0];
      const p = target ? [target.x, target.y] : [pts[0].x, pts[0].y - 100];
      E.setTask(u, { kind: 'attack', point: p, attempts: 0, maxAttempts: 4, form: 'attack' }); u.path = [p]; }
    else if (u.type === 'cav') E.setTask(u, { kind: 'cavRaid', area: E.objectives.ridgeEast.line, home: [u.x, u.y], charges: 0, maxCharges: 4 });
    else { E.setTask(u, { kind: 'bombard', area: E.objectives.ridgeEast.line, site: [u.x - 300, u.y + 300] }); E.routeTo(u, u.task.site, true); }
  }
  // Zieten diverted south? (35% when near Wellington's left while Plancenoit is in crisis)
  if (!S.zietenCheck) {
    const lead = E.units.find(u => u.corps === 'zieten' && u.onMap && E.formed(u) && hyp(u.x - E.spById.papelotte.x, u.y - E.spById.papelotte.y) < 2000);
    // Zieten hears of Plancenoit's trouble from an officer Bülow sends him (rules doc: Zieten diverted)
    if (E.command && !S.crisisSent && S.bulowAttack && t - S.bulowAttack > 30 && placeHolder(E, 'bulow', 'plancenoit') === 'FR') { S.crisisSent = t; E.command.message('bulow', 'zieten', 'an officer from Bülow asking Zieten for help at Plancenoit', B => { B.news.crisis = E.t; }); }
    const ZN = news(E, 'zieten');
    const crisis = ZN ? !!ZN.crisis : E.spById.plancenoit.holder === 'FR' && S.bulowAttack && t - S.bulowAttack > 30;
    if (lead && crisis) {
      S.zietenCheck = t;
      if (E.history !== 'strict' && E.rnd('Zieten diverted') < 0.35 * (E.history === 'open' ? 1.3 : 1)) {
        S.zietenDiverted = t; E.logEvent('hidden', 'Zieten, told the Prussians at Plancenoit are in trouble, turns his column south.', { side: 'PR', hidden: true, important: true });
        S.mufflingAt = t + E.rnd.range(10, 30, 'Müffling ride'); S.mufflingOk = E.rnd('Müffling persuades Zieten') < 0.6;
      }
    }
  }
  if (S.zietenDiverted && S.mufflingAt && t >= S.mufflingAt) {
    S.mufflingAt = null;
    if (S.mufflingOk) { S.zietenDiverted = null; E.logEvent('hidden', 'Müffling gallops after Zieten and brings him back to Wellington\'s left.', { side: 'PR', hidden: true }); for (const u of E.units.filter(u => u.corps === 'zieten' && E.formed(u) && u.onMap)) { if (u.task.kind === 'attack' && u.task.sp === 'plancenoit') { E.setTask(u, { kind: 'hold', zReady: true }); } } }
    else E.logEvent('hidden', 'Müffling cannot find Zieten in time; I Corps goes on toward Plancenoit.', { side: 'PR', hidden: true });
  }
  if (E.command) {
    if (E.flags.prEngaged && !S.toldPr) { S.toldPr = t; E.command.message('bulow', 'wellington', "Bülow's officer to Wellington: the Prussians are engaged", B => { B.news.prEngaged = E.t; }); }
    if (E.metrics.zietenPapelotte && !S.toldZ) { S.toldZ = t; E.command.message('zieten', 'wellington', "Zieten's officer to Wellington", B => { B.news.zieten = E.t; }, 1); }
  }
  // Grouchy hears the cannonade
  if (!S.grouchy.decided && E.flags.opened && t >= 11 * 60 + 30) {
    S.grouchy.decided = true;
    if (E.history !== 'strict' && E.rnd('Gérard persuades Grouchy') < 0.10 * (E.history === 'open' ? 1.5 : 1)) {
      S.grouchy.comes = true; const block = E.rnd('Dyle crossings');
      const arr = block < 0.3 ? null : t + E.rnd.tri(300, 400, 560, 'Grouchy march');
      E.logEvent('hidden', arr ? `Gérard persuades Grouchy to march to the guns; he will reach the field around ${E.fmtT(arr)}.` : 'Grouchy turns west, but the Dyle crossings are held: he never arrives.', { side: 'FR', hidden: true, important: true });
      if (arr) for (const u of E.offmap.filter(o => o.group === 'grouchy')) u.arriveAt = arr + u.baseArrive;
    } else E.logEvent('hidden', 'Grouchy hears the guns at Walhain but keeps on toward Wavre.', { side: 'FR', hidden: true });
  }
}

/* ===================== French corps reactions and Ney ===================== */
function frenchReactions(E, S) {
  const t = E.t;
  if (E.flags.frWithdraw) return; // (6) in a general retreat nobody starts anything new: no garrisons, no charges, no exploitation
  // Lobau garrisons Plancenoit when the Prussians close in (initiative)
  const pl = E.spById.plancenoit;
  const prNear = E.command ? known(E, 'lobau', 20, c => (c.side === 'PR' || (!c.side && c.x > pl.x - 500)) && c.status !== 'broken' && hyp(c.x - pl.x, c.y - pl.y) < 1600).length > 0 : E.units.some(u => u.side === 'PR' && E.formed(u) && hyp(u.x - pl.x, u.y - pl.y) < 1600);
  if (prNear && !pl.garrison && !S.lobauGarrison) {
    const cand = ['tromelin', 'bony', 'thevenet'].map(id => E.byId[id]).find(u => u && E.formed(u) && u.task.kind !== 'garrison');
    if (cand && E.rnd('Lobau initiative') < 0.7) { S.lobauGarrison = t; E.setTask(cand, { kind: 'garrisonGo', sp: 'plancenoit' }); E.routeTo(cand, [pl.secs[0].x, pl.secs[0].y], true); E.logEvent('orders', `Lobau throws ${cand.name} into Plancenoit.`, { side: 'FR', hidden: true }); }
  }
  // Jérôme escalates at Hougoumont when his men are thrown back
  // (handled in onRepulse)
  // Ney: the misread retreat. He sees allied units moving back over the crest and sends the cavalry.
  // Ney's own initiatives need him in command of a sector with the cavalry and the centre in it
  const neyFront = !E.command || (E.command.ney.active && ['whole', 'centre', 'left'].includes(E.command.ney.sector));
  if (!S.neyCav && neyFront && E.flags.alliedEngaged && t > 15 * 60 + 20 && E.tick % 5 === 0) {
    const ney = E.leaders.ney, np = E.leaderPos(ney);
    const crest = S.crestLine;
    const seen = known(E, 'ney', 10, c => c.side === 'AL' && c.moving && polyDist(c.x, c.y, crest) < 450 && np && hyp(c.x - np[0], c.y - np[1]) < 2500);
    if (seen.length && E.rnd('a retreat is misread') < ney.ini * 0.3) launchNeyCavalry(E, S, 'misread');
    else if (t > 15 * 60 + 45 && E.rnd('Ney loses patience') < ney.agg * 0.08) launchNeyCavalry(E, S, 'misread');
  }
  if (!S.neyExploit && neyFront && placeHolder(E, 'ney', 'lhs') === 'FR' && t < 19 * 60 + 40 && E.tick % 5 === 0) {
    S.neyExploit = t; const lhs = E.spById.lhs;
    const guns = ['aHMil', 'aHKel', 'aHGC', 'aQuiot', 'aDonz'].filter(id => E.byId[id] && E.formed(E.byId[id]) && !reserved(E, E.byId[id])).slice(0, 3);
    E.sendOrder({ id: 'neyGuns', from: 'ney', to: 'derlon', kind: 'bombard', units: guns, site: 'lhsGunSite', area: 'ridgeCentre', direct: true, rideMin: 4, text: 'Ney runs horse guns up beside La Haye Sainte to batter the allied centre.' });
    const inf = fittest(E, ['husson', 'campi', 'nogues', 'grenier', 'schmitz', 'aulard', 'bourgeois', 'charlet', 'gauthier', 'jamin'], 2);
    if (inf.length) E.sendOrder({ id: 'neyCentre', from: 'ney', to: 'derlon', kind: 'attack', obj: 'ridgeCentre', units: inf, form: 'attack', maxAttempts: 3, direct: true, rideMin: 5, text: 'Ney sends what infantry he can find against the allied centre.' });
    E.logEvent('orders', 'With La Haye Sainte taken, Ney presses the allied centre.', { side: 'FR', important: true });
    if (E.command && E.command.neyInitiative) E.command.neyInitiative('exploit', inf.concat(guns));
  }
  if (S.neyCav && !S.neyCav2 && neyFront && t - S.neyCav > 40 && E.flags.allowKellermann !== false) {
    // Ney asks for more; Kellermann and the Guard heavy cavalry follow
    const ney = E.leaders.ney;
    if (E.rnd('Ney commits more cavalry') < ney.agg * 0.25) launchNeyCavalry(E, S, 'second');
  }
}
function launchNeyCavalry(E, S, phase) {
  const area = 'ridgeWest', home = E.ll2m(50.6745, 4.4040);
  if (phase === 'misread') {
    S.neyCav = E.t; const ids = ['dubois', 'travers', 'farine', 'vial', 'gchev', 'glanc'].filter(id => !E.byId[id] || !reserved(E, E.byId[id]));
    if (!ids.length) return; // every one of them held back by the Emperor's order
    E.metrics.neyCav = E.t; const hg = ['aHMil', 'aHGC'].filter(id => !E.byId[id] || !reserved(E, E.byId[id]));
    if (hg.length) E.sendOrder({ from: 'ney', to: 'milhaud', kind: 'bombard', units: hg, site: 'cavGunSite', area: 'ridgeWest', direct: true, rideMin: 3 });
    if (E.command && E.command.neyInitiative) E.command.neyInitiative('cavalry', ids.filter(id => E.byId[id] && E.formed(E.byId[id])));
    E.logEvent('orders', 'Ney thinks he sees the Allies falling back over the crest and leads the cuirassiers forward.', { side: 'FR', important: true, hidden: false });
    E.sendOrder({ from: 'ney', to: 'milhaud', kind: 'cavRaid', units: ids, area, home, maxCharges: 7, direct: true, rideMin: 3, cause: E.cause('Ney misread a retreat on the ridge') });
    E.leaders.ney.unit = 'farine';
  } else {
    S.neyCav2 = E.t; const ids = ['picquet', 'guiton', 'blanchard', 'donop', 'guyot'].filter(id => !E.byId[id] || !reserved(E, E.byId[id]));
    if (!ids.length) return;
    if (!E.byId.aHKel || !reserved(E, E.byId.aHKel)) E.sendOrder({ from: 'ney', to: 'kellermann', kind: 'bombard', units: ['aHKel'], site: 'cavGunSite', area: 'ridgeWest', direct: true, rideMin: 5 });
    if (E.command && E.command.neyInitiative) E.command.neyInitiative('cavalry2', ids.filter(id => E.byId[id] && E.formed(E.byId[id])));
    E.logEvent('orders', 'Kellermann\'s cuirassiers and the Guard heavy cavalry follow Ney onto the plateau.', { side: 'FR', important: true });
    E.sendOrder({ from: 'ney', to: 'kellermann', kind: 'cavRaid', units: ids, area, home: E.ll2m(50.6735, 4.4000), maxCharges: 6, direct: true, rideMin: 5, cause: E.cause('Ney asked for more cavalry') });
  }
}

/* ===================== French historical orders (Napoleon as played on the day) ===================== */
function historicalPlan(E, S) {
  const I_BATT = ['aQuiot', 'aIres', 'aDonz', 'aMarc', 'aDur'];
  return [
    { id: 'hougoumont', at: 11 * 60 + 5, order: { from: 'napoleon', to: 'reille', kind: 'attack', obj: 'hougoumont', units: ['bauduin'], form: 'attack', maxAttempts: 4, text: 'Reille: Prince Jérôme to clear the wood of Hougoumont.', clarity: 0.8 } },
    { id: 'reilleGuns', at: 11 * 60 + 10, order: { from: 'napoleon', to: 'reille', kind: 'bombard', units: ['aBach', 'aFoy', 'aJer', 'aIIres'], site: null, area: 'ridgeWest', opens: true } },
    { id: 'grandBattery', at: 11 * 60 + 15, order: { from: 'napoleon', to: 'derlon', kind: 'bombard', units: [...I_BATT, 'aGuard12'], site: 'batterySiteA', area: 'ridgeEast', facing: 344, text: 'The grand battery forms in front of I Corps.' } },
    { id: 'east', when: E => (E.t >= 13 * 60 + 15) || (E.t >= 12 * 60 + 45 && Object.values(E.contacts.FR).some(c => c.side === 'PR')), order: { from: 'napoleon', to: 'lobau', kind: 'advance', obj: 'eastFlank', units: ['bellair', 'thevenet', 'bony', 'tromelin', 'dommanget', 'vinot', 'colbert', 'merlin', 'aVI'], facing: 70, form: 'columns', text: 'Lobau, Domon and Subervie to face east toward Saint-Lambert.' } },
    { id: 'derlon', at: 13 * 60 + 30, order: { from: 'napoleon', to: 'derlon', kind: 'attack', obj: 'ridgeEast', units: ['charlet', 'schmitz', 'nogues'], supports: ['aulard', 'grenier'], form: 'mass', supportForm: 'mass', maxAttempts: 2, clarity: 0.85, text: "d'Erlon's corps goes forward against the ridge east of the road." },
      also: [{ from: 'napoleon', to: 'derlon', kind: 'attack', obj: 'lhs', units: ['bourgeois'], form: 'attack', maxAttempts: 3 }, { from: 'napoleon', to: 'derlon', kind: 'attack', obj: 'papelotte', units: ['pegot'], supports: ['brue'], form: 'attack', maxAttempts: 3 }],
      onAct: E => { E.flags.alliedEngaged = E.t; } },
    { id: 'lhs2', at: 15 * 60, when: E => E.spById.lhs.holder !== 'FR', pick: E => fittest(E, ['bourgeois', 'charlet', 'schmitz', 'aulard', 'nogues', 'grenier'], 1), order: { from: 'napoleon', to: 'ney', kind: 'attack', obj: 'lhs', units: [], form: 'attack', maxAttempts: 3, text: 'Ney is to take La Haye Sainte.' } },
    { id: 'lhs3', at: 17 * 60 + 30, when: E => E.spById.lhs.holder !== 'FR', pick: E => fittest(E, ['schmitz', 'aulard', 'bourgeois', 'charlet', 'nogues', 'grenier', 'husson', 'campi', 'gauthier', 'jamin'], 3), order: { from: 'napoleon', to: 'ney', kind: 'attack', obj: 'lhs', units: [], form: 'attack', engineers: true, maxAttempts: 4, text: 'Ney: La Haye Sainte at all costs, with Donzelot and the engineers.' } },
    { id: 'yg', when: E => E.spById.plancenoit.holder === 'AL' || (E.spById.plancenoit.garrison && E.byId[E.spById.plancenoit.garrison] && E.byId[E.spById.plancenoit.garrison].coh < 35), order: { from: 'napoleon', to: 'drouot', kind: 'attack', obj: 'plancenoit', units: ['yg1', 'yg2'], form: 'attack', maxAttempts: 4, text: 'The Young Guard to retake Plancenoit.' } },
    { id: 'og', when: E => E.plan.done.yg && E.t - E.plan.done.yg > 40 && (E.spById.plancenoit.holder === 'AL' || ['yg1', 'yg2'].every(id => !E.formed(E.byId[id]) || E.byId[id].coh < 40)), order: { from: 'napoleon', to: 'drouot', kind: 'attack', obj: 'plancenoit', units: ['g2gren', 'g2chas'], form: 'attack', maxAttempts: 3, text: 'Two battalions of the Old Guard to Plancenoit.' } },
    { id: 'guard', at: 19 * 60, order: { from: 'napoleon', to: 'drouot', kind: 'attack', obj: 'ridgeWest', units: ['g3gren', 'g4gren', 'g3chas', 'g4chas'], form: 'attack', guard: true, maxAttempts: 1, points: [E.ll2m(50.6808, 4.4005), E.ll2m(50.6808, 4.4035), E.ll2m(50.6808, 4.3975), E.ll2m(50.6808, 4.4060)], text: 'The Middle Guard to attack the allied right-centre, Ney at its head.' },
      onAct: E => { E.flags.guardAttacking = E.t; E.metrics.guardAttack = E.t; E.leaders.ney.unit = 'g3gren'; } },
  ];
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
      wellingtonInit(E, S); prussianInit(E, S);
      // French starting posture: hold; guns hold fire until ordered
      for (const u of E.units) if (u.side === 'FR' && u.onMap) u.task = { kind: 'hold', since: E.t };
      // the 11:00 deployment: Marbot's 7th Hussars (Bruno's brigade, Jacquinot) watch the far right toward Lasne and the Dyle
      if (E.byId.bruno) E.byId.bruno.task = { kind: 'screen', area: E.ll2m(50.6830, 4.4830), since: E.t };
      // detach the Guard's 24 twelve-pounders as their own battery for the grand battery
      const g = E.byId.aGuard;
      if (g && !E.byId.aGuard12) { g.str -= 24; g.str0 -= 24; g.guns0 = g.str; const u = addUnit(E, { id: 'aGuard12', side: 'FR', name: "The Guard's 12-pounders", parent: 'Guard artillery', nat: 'FR', type: 'art', str: 24, x: g.x - 150, y: g.y, facing: 0, form: 'park', q: 1.15, corps: 'guard', cal: 12 }); u.coh = 82; u.shells = 0; }
      if (opts.plan === 'historical') E.plan.steps = historicalPlan(E, S);
      // 'script' plans are given by a script through the order builder (see script.js)
      E.ruleHooks.push(E2 => { if (E2.metrics.lhsFall == null && E2.spById.lhs.holder === 'FR') E2.metrics.lhsFall = E2.t; });
      return ai;
    },
    tick(E) {
      unitControl(E);
      wellingtonUnits(E, S);
      if (E.tick % 5 === 0) { wellington(E, S); } else uxbridge(E, S);
      prussians(E, S);
      frenchReactions(E, S);
      if (E.plan.steps.length) runPlan(E, S);
      if (opts.onTick) opts.onTick(E, S);
    },
    receive(E, o) { apply(E, o); },
    onArrival(E, u) { onPrussianArrival(E, u, S); },
    onRepulse(E, a, d, tgt) {
      // Jérôme's escalation at Hougoumont
      if (a.side === 'FR' && tgt.sp && tgt.sp.id === 'hougoumont') {
        const J = E.leaders.jerome; S.hougRepulses = (S.hougRepulses || 0) + 1;
        if (E.rnd('Hougoumont escalates') < J.agg * 0.5) {
          const next = ['soye', 'jamin', 'gauthier'].map(id => E.byId[id]).find(u => u && E.formed(u) && u.task.kind !== 'attack' && u.task.sp !== 'hougoumont');
          if (next) { E.sendOrder({ id: 'houg_' + next.id, from: 'jerome', to: 'reille', kind: 'attack', obj: 'hougoumont', units: [next.id], form: 'attack', maxAttempts: 4, direct: true, rideMin: 4, cause: E.cause(`Jérôme threw ${next.name} into Hougoumont after ${a.name} was repulsed`) }); E.logEvent('orders', `Jérôme commits ${next.name} to Hougoumont.`, { side: 'FR', hidden: true }); }
        }
      }
    },
  };
  return ai;
}
function addUnit(E, spec) {
  // create a unit after start (uses the engine's internal factory via detach-like path)
  const u = Object.assign({ q: 1, coh: 80, cohMax: 100, fatigue: 25, ammo: 50, rounds: 120, wind: 100, status: 'steady', lying: false, onMap: true, gone: false, formTo: null, formTimer: 0, task: { kind: 'hold' }, path: null, killed: 0, wounded: 0, captured: 0, stragglers: 0, hitTick: { mus: 0, art: 0, flank: 0, cav: 0 }, firedTick: false, lastHit: -99, lastFired: -99, shells: 0, silencedUntil: 0, isGuard: true, minCoh: 80 }, spec);
  u.str0 = u.str; u.guns0 = u.str; const fp = E.footprint(u); u.F = fp.F; u.D = fp.D; E.units.push(u); E.byId[u.id] = u; return u;
}

const api = { make, apply, unitControl, known, ownState, viaAide, placeHolder, news, nearestOnPoly, polyDist, addUnit }; // (phase 3) the helpers the generic commanders share
root.WAI = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
