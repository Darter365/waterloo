/* Waterloo orders: the order builder, writing and riding, interpretation, and how a corps commander carries an order out.
   Follows "Command and orders" in the rules doc. Values marked est. are mine. */
(function (root) {
'use strict';
const hyp = Math.hypot;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const Cmd = root.WCommand || (typeof require === 'function' ? require('./command.js') : null);
const AI = () => root.WAI || (typeof require === 'function' ? require('./ai.js') : null);

const RECIPIENTS = {
  reille: { name: 'Reille (II Corps)', kind: 'corps' }, derlon: { name: "d'Erlon (I Corps)", kind: 'corps' }, lobau: { name: 'Lobau (VI Corps)', kind: 'corps' },
  milhaud: { name: 'Milhaud (IV Cavalry Corps)', kind: 'cavalry' }, kellermann: { name: 'Kellermann (III Cavalry Corps)', kind: 'cavalry' },
  drouot: { name: 'Drouot (the Guard)', kind: 'corps' }, grandBattery: { name: 'the grand battery', kind: 'battery' },
  ney: { name: 'Marshal Ney', kind: 'marshal' }, grouchy: { name: 'Marshal Grouchy (off the map)', kind: 'grouchy' }, hq: { name: 'your own headquarters', kind: 'hq' },
  army: { name: 'the whole army', kind: 'army' },
};
// (6) a general retreat goes as one letter to each corps commander, each carried by its own rider
const RETREAT_TO = ['reille', 'derlon', 'lobau', 'drouot', 'milhaud', 'kellermann'];
const ACTIONS = {
  advance: 'advance to', attack: 'attack', hold: 'hold', support: 'support', bombard: 'bombard', screen: 'screen and observe', withdraw: 'withdraw to',
  rally: 'rally and re-form', detach: 'detach brigades to', sector: 'take command of a sector', marchToGuns: 'march to the guns', moveHQ: 'move headquarters', observe: 'send an aide to look at', retreat: 'retreat on Charleroi',
};
const ALLOWED = {
  corps: ['advance', 'attack', 'hold', 'support', 'bombard', 'screen', 'withdraw', 'rally', 'detach', 'retreat'],
  cavalry: ['advance', 'attack', 'hold', 'support', 'screen', 'withdraw', 'rally', 'detach', 'retreat'], army: ['retreat'],
  battery: ['bombard', 'hold', 'advance', 'withdraw'], marshal: ['attack', 'hold', 'advance', 'sector', 'rally'], grouchy: ['marchToGuns', 'hold', 'advance'], hq: ['moveHQ', 'observe'],
};
const PREF_FORM = { derlon: 'mass' }; // d'Erlon's own choice of formation when left to him (est., after 18 June)
const ATTEMPTS = { light: 1, normal: 2, heavy: 3, any: 4 };
const SECTORS = { left: ['reille', 'kellermann'], centre: ['derlon', 'milhaud'], right: ['derlon', 'lobau'], whole: ['reille', 'derlon', 'milhaud', 'kellermann'] };
const GRAND_BATTERY = ['aQuiot', 'aIres', 'aDonz', 'aMarc', 'aDur', 'aGuard12'];

function install(E) {
  const C = E.command, CK = C.CK, rnd = E.rnd, fmtT = E.fmtT, W = E.W;
  const cmdOf = Cmd.cmdOf;

  /* ---------- clarity (rules doc: one action and one objective score high; each condition lowers it) ---------- */
  function clarity(spec) {
    let c = 0.95;
    c -= 0.08 * (spec.conditions || []).length;
    const m = spec.manner || {}; c -= 0.03 * ['formation', 'pace', 'bring', 'losses'].filter(k => m[k] != null && !(Array.isArray(m[k]) && !m[k].length)).length;
    if (spec.urgent) c -= 0.15;
    if (spec.objective && spec.objective.point) c -= 0.04;
    if (Array.isArray(spec.with) && spec.with.length > 4) c -= 0.03;
    if (spec.ambiguity) c -= spec.ambiguity;
    return clamp(c, 0.3, 0.95);
  }
  C.clarity = clarity;
  function validate(spec) {
    const R = RECIPIENTS[spec.to]; if (!R) return `Nobody called ${spec.to}`;
    if (!ALLOWED[R.kind].includes(spec.action)) return `${R.name} can't be ordered to ${ACTIONS[spec.action] || spec.action}`;
    const needsObj = ['advance', 'attack', 'bombard', 'screen', 'withdraw', 'observe'].includes(spec.action);
    if (needsObj && !(spec.objective && (spec.objective.place || spec.objective.point))) return 'This order needs an objective';
    if (spec.objective && spec.objective.place && !E.objectives[spec.objective.place]) return `Unknown place ${spec.objective.place}`;
    if (spec.action === 'moveHQ' && !Cmd.POSTS[spec.post]) return 'Choose a post: caillou, rossomme, ba or knoll';
    if (spec.action === 'sector' && !SECTORS[spec.sector] && spec.sector !== 'none') return 'Choose a sector: left, centre, right, whole, or none to take command back';
    if (spec.action === 'support' && !(spec.objective && spec.objective.corps)) return 'Say which corps to support';
    if (spec.action === 'detach' && !(spec.detachTo && Array.isArray(spec.with) && spec.with.length)) return 'Say which brigades and to whom';
    if (spec.action === 'retreat' && spec.rearguard && !RETREAT_TO.includes(spec.rearguard)) return 'Choose the rearguard: the Guard, Lobau or none';
    if (spec.action === 'retreat' && R.kind !== 'army' && !spec.general) return 'A retreat is ordered for the whole army: choose “The whole army” as the recipient';
    return null;
  }
  C.validate = validate;
  C.RECIPIENTS = RECIPIENTS; C.ACTIONS = ACTIONS; C.ALLOWED = ALLOWED; C.SECTORS = SECTORS;

  /* ---------- issuing ---------- */
  C.order = function (spec) {
    spec = Object.assign({ from: 'napoleon', conditions: [], manner: {} }, spec);
    const err = validate(spec); if (err) return { ok: false, error: err };
    if (spec.to === 'army') { // the general retreat: a copy for each corps commander, written and carried separately
      const orders = [];
      for (const to of RETREAT_TO) { const r = C.order(Object.assign({}, spec, { to, general: true, conditions: (spec.conditions || []).map(c => Object.assign({}, c)), manner: Object.assign({}, spec.manner) })); if (r.ok) orders.push(r.order); }
      return orders.length ? { ok: true, order: orders[0], orders } : { ok: false, error: 'No corps to send it to' };
    }
    const o = { id: 'o' + C.nextId++, spec, from: spec.from, to: spec.to, action: spec.action, clarity: clarity(spec), issuedAt: E.t, status: 'writing', log: [] };
    C.orders.push(o);
    if (spec.to === 'hq') { staffAction(o); return { ok: true, order: o }; }
    if (C.hq.moving && spec.from === 'napoleon') { o.status = 'queued'; o.log.push(`${fmtT(E.t)} held until headquarters arrives at ${Cmd.POSTS[C.hq.moving.to].name}`); return { ok: true, order: o }; }
    write(o); return { ok: true, order: o };
  };
  /* ---------- a letter with several steps for one commander: one rider, read and acknowledged together ---------- */
  const SEQ_STEP = 0.05, SEQ_WRITE = 0.3; // each extra step lowers clarity by 0.05 and adds 30% to the writing time (est.)
  C.orderSeq = function (specs) {
    if (!specs || !specs.length) return { ok: false, error: 'No steps' };
    const to = specs[0].to; if (specs.some(x => x.to !== to)) return { ok: false, error: 'Every step must go to the same commander' };
    if (to === 'hq' || to === 'grouchy') return { ok: false, error: 'Steps can only be given to a commander on the field' };
    const full = specs.map(x => Object.assign({ from: 'napoleon', conditions: [], manner: {} }, x, { conditions: (x.conditions || []).map(c => Object.assign({}, c)) }));
    for (const x of full) { const err = validate(x); if (err) return { ok: false, error: err }; }
    if (full.length === 1) return C.order(full[0]);
    const n = full.length, orders = [];
    full.forEach((x, i) => {
      for (const c of x.conditions) if (c.type === 'after' && c.step != null) { c.order = orders[c.step] ? orders[c.step].id : null; delete c.step; }
      const o = { id: 'o' + C.nextId++, spec: x, from: x.from, to, action: x.action, clarity: clamp(clarity(x) - SEQ_STEP * (n - 1), 0.3, 0.95), issuedAt: E.t, status: 'writing', log: [], seq: { index: i, n } };
      if (i > 0) o.carrier = orders[0].id;
      orders.push(o); C.orders.push(o);
    });
    orders[0].seq.ids = orders.map(o => o.id);
    if (C.hq.moving) { for (const o of orders) { o.status = 'queued'; o.log.push(`${fmtT(E.t)} held until headquarters arrives`); } return { ok: true, order: orders[0], orders }; }
    write(orders[0]); return { ok: true, order: orders[0], orders };
  };
  const followers = o => C.orders.filter(x => x.carrier === o.id);
  function write(o) {
    const s = o.spec, staff = C.opts.staff, range = s.from === 'napoleon' ? CK.WRITE[staff] : s.from === 'ney' ? CK.WRITE.ney : CK.WRITE.corps;
    const w = rnd.range(range[0], range[1], 'order writing') * (s.urgent ? 0.5 : 1) * (C.hq.wounded && s.from === 'napoleon' ? 1.5 : 1) * (o.seq ? 1 + SEQ_WRITE * (o.seq.n - 1) : 1);
    o.writtenAt = E.t + w; o.sentAt = o.writtenAt; o.status = 'writing';
    for (const f of followers(o)) { f.writtenAt = o.writtenAt; f.sentAt = o.sentAt; f.status = 'writing'; }
    const toName = RECIPIENTS[o.to] ? RECIPIENTS[o.to].name : o.to;
    const r = { kind: 'order', from: s.from, to: o.to === 'grandBattery' ? null : o.to === 'grouchy' ? null : o.to, side: 'FR', label: `the order to ${toName.replace(/ \(.*\)/, '')} of ${fmtT(o.writtenAt)}`, text: o.seq ? describeLetter(o) : describe(o), payload: o, group: 'g' + o.id };
    if (o.to === 'grandBattery') { const g = batteryUnits(); r.toPos = g.length ? [g.reduce((a, u) => a + u.x, 0) / g.length, g.reduce((a, u) => a + u.y, 0) / g.length] : null; }
    if (o.to === 'grouchy') { r.toPos = [W.WM - 20, W.HM * 0.82]; r.offmapRide = Math.max(30, rnd.tri(...CK.GROUCHY_RIDE, 'ride to Grouchy') - 60); }
    r.onDeliver = rr => { received(rr.payload); for (const f of followers(rr.payload)) received(f); };
    r.onLost = rr => { for (const oo of [rr.payload].concat(followers(rr.payload))) { oo.status = 'lost'; oo.log.push(`${fmtT(E.t)} every rider lost`); } };
    r.onLaunch = rr => { for (const oo of [rr.payload].concat(followers(rr.payload))) if (oo.status === 'writing') oo.status = 'riding'; }; // (7) on the road: 'writing' meant both before
    C.pendingLaunch.push({ at: o.writtenAt, r });
    o.log.push(`${fmtT(E.t)} written in ${Math.round(w)} min; clarity ${o.clarity.toFixed(2)}`);
  }
  C.describe = describe;
  // an order can be torn up while it is still being written; once a rider has it, only a new order can change it
  C.cancel = function (o) {
    if (!o || o.status !== 'writing' || E.t >= o.writtenAt) return false;
    for (const x of [o].concat(followers(o))) { x.status = 'cancelled'; x.log.push(`${fmtT(E.t)} torn up before it was sent`); } C.pendingLaunch = C.pendingLaunch.filter(p => p.r.payload !== o); return true;
  };
  const GUNS_OF = by => by === 'grandBattery' ? 'the grand battery' : `${E.leaders[by] ? E.leaders[by].name : by}'s guns`;
  function refPhrase(ref) { const s = ref.spec, obj = s.objective && s.objective.place ? C.objName(s) : null; return s.action === 'bombard' ? 'the bombardment' : s.action === 'attack' ? `the attack${obj ? ' on ' + obj : ''}` : s.action === 'advance' || s.action === 'withdraw' ? `the move${obj ? ' to ' + obj : ''}` : s.action === 'screen' ? 'the screen' : 'the previous step'; }
  function condText(c, own) {
    if (c.type === 'time') return `not before ${fmtT(c.after)}`;
    if (c.type === 'place') return `when ${E.spById[c.sp].name} ${c.holder === 'FR' ? 'is ours' : 'is held by the enemy'}`;
    if (c.type === 'bombard') return c.by ? `after ${GUNS_OF(c.by)} ${c.by === 'grandBattery' ? 'has' : 'have'} fired${c.target && E.objectives[c.target] ? ' on ' + E.objectives[c.target].name : ''} for ${c.minutes} minutes` : `after the battery has fired ${c.minutes} minutes`;
    if (c.type === 'after') { const ref = C.orders.find(x => x.id === c.order) || (own && own[c.step]); if (!ref) return 'after the previous step'; const ph = refPhrase(ref.spec ? ref : { spec: ref });
      if (c.when === 'done') { const sp = ref.spec && ref.spec.objective && ref.spec.objective.place && E.objectives[ref.spec.objective.place] && E.objectives[ref.spec.objective.place].sp; return `${c.minutes ? c.minutes + ' minutes after' : 'once'} ${sp && ref.spec.action === 'attack' ? E.spById[sp].name + (c.minutes ? ' is' : ' is') + ' taken' : ph + ' is done'}`; }
      return `${c.minutes ? c.minutes + ' minutes after' : 'as soon as'} ${ph} begins`; }
    if (c.type === 'relieved') return 'until relieved';
    return '';
  }
  C.condText = condText;
  // a whole letter: "first ...; then ...; then ..."
  function describeLetter(o) {
    const ids = o.seq && o.seq.ids ? o.seq.ids : [o.id], list = ids.map(id => C.orders.find(x => x.id === id)).filter(Boolean);
    const toName = RECIPIENTS[o.to] ? RECIPIENTS[o.to].name : o.to;
    return `${toName}: ` + list.map((x, i) => (i === 0 ? 'first ' : 'then ') + describe(x, true)).join('; ');
  }
  C.describeLetter = describeLetter;
  function describe(o, bare) {
    const s = o.spec, toName = o.to === 'hq' ? 'Headquarters' : RECIPIENTS[o.to] ? RECIPIENTS[o.to].name : o.to;
    let t = `${toName}: ${ACTIONS[s.action] || s.action}`;
    if (s.action === 'support') t += ` ${Cmd.CORPSNAME[s.objective.corps] || s.objective.corps}`;
    else if (s.objective) t += ` ${C.objName(s)}`;
    if (s.action === 'sector') t = s.sector === 'none' ? `${toName}: hand the front back to the Emperor` : `${toName}: take command of the ${s.sector === 'whole' ? 'whole front' : s.sector + ' of the line'}${s.goal ? ', to take ' + (E.objectives[s.goal] ? E.objectives[s.goal].name : s.goal) : ''}`;
    if (s.action === 'moveHQ') t = `Headquarters: move to ${Cmd.POSTS[s.post].name}`;
    if (s.action === 'retreat') t = `${o.to === 'army' ? 'The whole army' : toName}: retreat on Charleroi by the high road${s.rearguard ? (s.rearguard === o.to ? ', covering the army as its rearguard at Rossomme' : `, ${s.rearguard === 'drouot' ? 'the Guard' : 'Lobau'} covering`) : ''}`;
    const names = ids => { const n = ids.map(id => E.byId[id] ? E.byId[id].name : id); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]; };
    if (s.action === 'detach') t = `${toName}: send ${Array.isArray(s.with) && s.with.length ? names(s.with) : 'brigades'} to ${Cmd.CORPSNAME[s.detachTo === 'drouot' ? 'guard' : s.detachTo] || s.detachTo}`;
    else if (Array.isArray(s.with) && s.with.length) t += `, with ${names(s.with)}`;
    const m = s.manner || {};
    if (m.formation) t += `, ${m.formation === 'mass' ? 'in massed division columns' : m.formation === 'attack' ? 'in columns of attack' : m.formation === 'line' ? 'deployed in line' : m.formation === 'columns' ? 'in battalion columns' : m.formation}`;
    if (m.losses) t += m.losses === 'any' ? ', at any cost' : `, accepting ${m.losses} losses`;
    if (m.site && m.site !== 'here' && E.objectives[m.site]) t += `, the guns to stand on ${E.objectives[m.site].name}`; else if (m.site === 'here') t += ', the guns to fire from where they stand';
    if (m.bring && m.bring.length) t += `, bringing ${m.bring.join(' and ')}`;
    for (const c of s.conditions || []) { const ct = condText(c, o.steps); if (ct) t += ', ' + ct; }
    if (s.urgent) t += ' (urgent)';
    return bare ? t.slice(toName.length + 2) : t;
  }

  /* ---------- receiving and interpreting ---------- */
  function received(o) {
    if (o.status === 'done' || o.status === 'superseded' || o.status === 'cancelled') return;
    o.receivedAt = E.t; o.status = 'received'; o.log.push(`${fmtT(E.t)} received`);
    if (o.to === 'grouchy') return grouchyReceives(o);
    const L = recipientLeader(o), skill = L ? L.skill : 0.7;
    const direct = o.to === 'ney' || o.to === 'grandBattery' || o.spec.from === 'ney' || o.spec.direct;
    o.actAt = E.t + rnd.range(...(direct ? CK.INTERP_DIRECT : CK.INTERP), 'interpretation');
    // misreading (rules doc): chance = (1 - clarity) x (1 - skill) x 0.5; picks the wrong formation or objective
    o.understood = {};
    const p = (1 - o.clarity) * (1 - skill) * 0.5;
    if (rnd('misread order') < p) {
      const m = o.spec.manner || {}, form = m.formation || PREF_FORM[o.to] || null;
      if (form && ['attack', 'mass', 'line'].includes(form) && o.spec.action === 'attack') { o.understood.form = form === 'attack' ? 'mass' : form === 'mass' ? 'attack' : 'attack'; o.misread = `${L ? L.name : 'The recipient'} understands ${o.understood.form === 'mass' ? 'massed division columns' : 'columns of attack'}`; }
      else if (o.spec.objective && o.spec.objective.place) { const alt = neighbourObjective(o.spec.objective.place); if (alt) { o.understood.obj = alt; o.misread = `${L ? L.name : 'The recipient'} takes the objective to be ${E.objectives[alt].name}`; } }
      if (o.misread) { o.log.push(`${fmtT(E.t)} misread: ${o.misread}`); E.logEvent('orders', `${o.misread}.`, { side: 'FR', hidden: true }); }
    }
    if (!o.understood.form && o.spec.action === 'attack') o.understood.form = (o.spec.manner || {}).formation || PREF_FORM[o.to] || 'attack';
    const rep = o.to === 'grandBattery' ? 'derlon' : o.to;
    if (C.REP[rep]) C.REP[rep].acks.push(o);
    o.status = 'waiting';
  }
  function recipientLeader(o) { return E.leaders[o.to === 'grandBattery' ? 'derlon' : o.to]; }
  function neighbourObjective(key) {
    const ob = E.objectives[key], c = centre(ob); let best = null, bd = 1600;
    for (const [k, o2] of Object.entries(E.objectives)) { if (k === key || /Site$|^pt|^dep/.test(k)) continue; const d = hyp(centre(o2)[0] - c[0], centre(o2)[1] - c[1]); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function centre(ob) { if (ob.sp) { const sp = E.spById[ob.sp]; return [sp.x, sp.y]; } if (ob.line) return [(ob.line[0][0] + ob.line[1][0]) / 2, (ob.line[0][1] + ob.line[1][1]) / 2]; return ob.point; }
  C.centre = centre;
  function conditionsMet(o) {
    const B = C.B[o.to === 'grandBattery' ? 'derlon' : o.to] || C.B.napoleon;
    for (const c of o.spec.conditions || []) {
      if (c.type === 'time' && E.t < c.after) return false;
      if (c.type === 'place') { const pb = B.places[c.sp]; const h = pb ? pb.holder : E.spById[c.sp].holder; if (c.holder === 'FR' ? h !== 'FR' : h === 'FR' || !h) return false; }
      if (c.type === 'bombard' && c.by) { const since = fireSince(c.by, c.target); if (since == null || E.t - since < c.minutes) return false; }
      else if (c.type === 'bombard') { if (C.firing.battery == null || E.t - C.firing.battery < c.minutes) return false; }
      if (c.type === 'after') {
        const ref = C.orders.find(x => x.id === c.order); if (!ref || ref.actedAt == null) return false;
        if (c.when === 'done') { if (ref.doneAt == null) { if (!refDone(ref, B)) return false; ref.doneAt = E.t; } if (E.t < ref.doneAt + (c.minutes || 0)) return false; }
        else { const begun = stepBegan(ref); if (begun == null || E.t < begun + (c.minutes || 0)) return false; }
      }
    }
    return true;
  }
  // the commander judges a step done by what he himself knows: the farm is his, or his brigades stand where they were sent
  function refDone(ref, B) {
    const s = ref.spec, key = (ref.understood && ref.understood.obj) || (s.objective && s.objective.place), ob = key ? E.objectives[key] : (s.objective && s.objective.point ? { point: s.objective.point } : null);
    if (!ob) return true;
    if (s.action === 'attack' && ob.sp) { const pb = B.places[ob.sp]; return !!(pb && pb.holder === 'FR'); }
    if (s.action === 'advance' || s.action === 'withdraw') { const c = centre(ob), mine = (ref.units || []).map(id => B.own.get(id)).filter(r => r && !r.gone); return mine.length > 0 && mine.filter(r => hyp(r.x - c[0], r.y - c[1]) < 400).length >= Math.ceil(mine.length / 2); }
    return true;
  }
  // "after the bombardment begins" means when the guns of that step first fire under it, not when the order is read:
  // guns that must first move up can take half an hour or more. If they have not opened 45 minutes after the order was acted on,
  // the commander takes the bombardment as begun and goes on (est.).
  const GUNS_WAIT = 45;
  function stepBegan(ref) {
    if (ref.spec.action !== 'bombard') return ref.actedAt;
    if (C.orderFire[ref.id] != null) return C.orderFire[ref.id];
    return E.t - ref.actedAt >= GUNS_WAIT ? ref.actedAt + GUNS_WAIT : null;
  }
  C.stepBegan = stepBegan;
  /* ---------- when a group of guns began firing on a target (everyone on the field hears and sees a cannonade) ---------- */
  C.fireStart = {}; C.orderFire = {};
  function groupBatteries(by) { return by === 'grandBattery' ? batteryUnits() : E.units.filter(u => u.side === 'FR' && u.type === 'art' && E.formed(u) && !u.gbattery && cmdOf(u) === by); }
  const fireKey = (by, tg) => by + '|' + (tg || '*');
  // the place a battery has been told to fire on: the objective of the order behind its task (yours, Ney's or the day's)
  function taskTarget(u) {
    if (u.task.areaKey) return u.task.areaKey;
    const o = u.task.order != null ? C.orders.find(x => x.id === u.task.order) : null;
    return o ? ((o.understood && o.understood.obj) || (o.spec.objective && o.spec.objective.place) || null) : null;
  }
  function trackFire() {
    // the first time any gun fires under each bombardment order
    for (const u of E.units) if (u.side === 'FR' && u.type === 'art' && u.task.kind === 'bombard' && u.task.order != null && u.lastFired >= E.tick - 1 && C.orderFire[u.task.order] == null) C.orderFire[u.task.order] = E.t;
    const keys = new Set();
    for (const o of C.orders) { if (o.status === 'cancelled' || o.from !== 'napoleon') continue; const g = o.to === 'grandBattery' ? 'grandBattery' : o.to;
      if (o.spec.action === 'bombard') { keys.add(fireKey(g, null)); if (o.spec.objective && o.spec.objective.place) keys.add(fireKey(g, o.spec.objective.place)); }
      for (const c of o.spec.conditions || []) if (c.type === 'bombard' && c.by) keys.add(fireKey(c.by, c.target)); }
    for (const k of keys) {
      // a named target counts only for guns whose orders name that same place (5e: was any fire landing within 700 m, so fire on La Haye Sainte counted as fire on the crossroads)
      const [by, tg] = k.split('|');
      const firing = groupBatteries(by).some(u => u.task.kind === 'bombard' && u.lastFired >= E.tick - 1 && (tg === '*' || taskTarget(u) === tg));
      const st = C.fireStart[k];
      if (firing) { if (!st || E.t - st.lastFire > 10) C.fireStart[k] = { since: E.t, lastFire: E.t }; else st.lastFire = E.t; }
    }
  }
  function fireSince(by, tg) { const st = C.fireStart[fireKey(by, tg)]; return st && E.t - st.lastFire <= 10 ? st.since : null; }
  C.fireSince = fireSince;
  /* ---------- deviation: a cautious commander questions an attack he thinks hopeless ---------- */
  function deviation(o) {
    if (o.spec.action !== 'attack' || o.deviated) return false;
    const L = recipientLeader(o), B = C.B[o.to]; if (!L || !B || (L.agg ?? 0.5) >= 0.5) return false;
    const ob = E.objectives[o.understood.obj || o.spec.objective.place] || E.objectives['pt' + o.id]; if (!ob) return false;
    const c = centre(ob), foes = [...B.c.values()].filter(x => E.t - x.t < 40 && x.side !== 'FR' && hyp(x.x - c[0], x.y - c[1]) < 700).reduce((a, x) => a + x.str, 0);
    const mine = pick(o, 'attack').lead.reduce((a, u) => a + u.str, 0);
    if (foes > 1.5 * mine && rnd('commander hesitates') < (1 - L.obe) * 0.6) {
      o.deviated = true; o.actAt = E.t + 30; o.log.push(`${fmtT(E.t)} ${L.name} doubts the attack and asks for confirmation`);
      C.flag(o.to, { kind: 'doubt', urgent: true, text: `The enemy is in great strength at ${C.objName(o.spec)}, about ${Math.round(foes / 500) * 500} men. I will wait half an hour for Your Majesty's confirmation before I attack.` });
      return true;
    }
    return false;
  }

  /* ---------- choosing units ---------- */
  function corpsUnits(cid) { return E.units.filter(u => u.side === 'FR' && E.formed(u) && cmdOf(u) === cid); }
  function batteryUnits() { return GRAND_BATTERY.map(id => E.byId[id]).filter(u => u && E.formed(u)).concat(E.units.filter(u => u.side === 'FR' && u.type === 'art' && E.formed(u) && u.gbattery && !GRAND_BATTERY.includes(u.id))); }
  function fitness(B, u) { const o = B && B.own.get(u.id); const coh = o && o.tState >= 0 ? o.coh : u.coh0 ?? 70, str = o && o.tState >= 0 ? o.str : u.str0; return coh * str; }
  function pick(o, kind) {
    const s = o.spec, w = s.with, B = C.B[o.to === 'grandBattery' ? 'derlon' : o.to] || C.B.napoleon;
    const alive = ids => ids.map(id => E.byId[id]).filter(u => u && E.formed(u));
    if (Array.isArray(w) && w.length) return { lead: alive(w), support: [] };
    if (w && w.lead) return { lead: alive(w.lead), support: alive(w.support || []) };
    if (w && w.pool) { const c = alive(w.pool).filter(u => u.status !== 'disordered' && u.task.kind !== 'attack' && u.task.kind !== 'garrison').sort((a, b) => fitness(B, b) - fitness(B, a)); return { lead: c.slice(0, w.n || 1), support: [] }; }
    if (o.to === 'grandBattery') return { lead: batteryUnits(), support: [] };
    const pool = o.to === 'ney' ? SECTORS[(C.ney.sector || 'whole')].flatMap(corpsUnits) : corpsUnits(o.to);
    if (kind === 'bombard') return { lead: pool.filter(u => u.type === 'art'), support: [] };
    if (kind === 'screen') return { lead: pool.filter(u => u.type === 'cav' && u.cavKind !== 'heavy').slice(0, 2), support: [] };
    if (kind === 'attack') {
      const ob = E.objectives[o.understood && o.understood.obj || (s.objective && s.objective.place)] || E.objectives['pt' + o.id], c = ob ? centre(ob) : [0, 0];
      const arm = RECIPIENTS[o.to] && RECIPIENTS[o.to].kind === 'cavalry' ? 'cav' : 'inf';
      const cand = pool.filter(u => u.type === arm && u.task.kind !== 'garrison' && u.status !== 'disordered').sort((a, b) => hyp(a.x - c[0], a.y - c[1]) - hyp(b.x - c[0], b.y - c[1]));
      const L = recipientLeader(o), share = s.manner && s.manner.losses === 'any' ? 1 : s.manner && s.manner.losses === 'light' ? 0.34 : 0.4 + 0.4 * (L ? L.agg : 0.5);
      const n = Math.max(1, Math.round(cand.length * share)), lead = cand.slice(0, Math.max(1, Math.ceil(n * 0.6))), support = cand.slice(lead.length, n);
      return { lead, support };
    }
    return { lead: pool, support: [] };
  }
  C.pick = pick;

  /* ---------- acting ---------- */
  function act(o) {
    if (deviation(o)) return;
    o.status = 'done'; o.actedAt = E.t; o.log.push(`${fmtT(E.t)} acting`);
    const s = o.spec, ai = AI(), m = s.manner || {};
    let objKey = (o.understood && o.understood.obj) || (s.objective && s.objective.place) || null;
    if (!objKey && s.objective && s.objective.point) { objKey = 'pt' + o.id; E.objectives[objKey] = { name: C.objName(s), point: s.objective.point }; }
    const base = { id: o.id, to: o.to === 'grandBattery' ? 'derlon' : o.to === 'ney' ? 'ney' : o.to, clarity: 1, cause: E.cause(`${E.leaders[s.from] ? E.leaders[s.from].name : 'Napoleon'}'s order of ${fmtT(o.sentAt)}: ${describe(o)}`) };
    const exec = x => { ai.apply(E, Object.assign({}, base, x)); };
    const attempts = ATTEMPTS[m.losses] || (s.action === 'attack' ? 3 : 1);
    switch (s.action) {
      case 'attack': {
        const { lead, support } = pick(o, 'attack');
        const inf = lead.filter(u => u.type === 'inf' || u.type === 'gar'), cav = lead.filter(u => u.type === 'cav'), sup = support.filter(u => u.type !== 'art');
        const form = o.understood.form || 'attack';
        if (inf.length) exec({ kind: 'attack', obj: objKey, units: inf.map(u => u.id), supports: sup.map(u => u.id), form, supportForm: form === 'mass' ? 'mass' : 'columns', maxAttempts: attempts, engineers: (m.bring || []).includes('sappers'), guard: inf.some(u => /^g[34]/.test(u.id)) });
        if (cav.length) { const ob = E.objectives[objKey]; exec({ kind: 'cavRaid', units: cav.map(u => u.id), area: objKey, home: [cav[0].x, cav[0].y], maxCharges: attempts * 2 }); }
        if ((m.bring || []).includes('guns')) { const guns = (o.to === 'ney' ? [] : corpsUnits(o.to)).filter(u => u.type === 'art'); if (guns.length) exec({ kind: 'bombard', units: guns.map(u => u.id), site: null, area: objKey }); }
        o.units = inf.concat(cav).map(u => u.id);
        // the main attack: Ney's initiatives and the Prussian timetable key off it
        if (inf.length + sup.length >= 3 && !E.flags.alliedEngaged) E.flags.alliedEngaged = E.t;
        if (inf.some(u => /^g[34]/.test(u.id)) && !E.flags.guardAttacking) { E.flags.guardAttacking = E.t; E.metrics.guardAttack = E.t; }
        break;
      }
      case 'bombard': {
        const { lead } = pick(o, 'bombard'), guns = lead.filter(u => u.type === 'art');
        const ob = E.objectives[objKey], c = centre(ob);
        let site = m.site && E.objectives[m.site] ? m.site : null;
        if (!site && m.site !== 'here') { // guns already within effective roundshot range stay put; others come to about 1.2 km off the target (est.)
          const far = guns.filter(u => hyp(u.x - c[0], u.y - c[1]) > 1700);
          if (far.length) { const gx = far.reduce((a, u) => a + u.x, 0) / far.length, gy = far.reduce((a, u) => a + u.y, 0) / far.length, d = hyp(gx - c[0], gy - c[1]); let k = 1200;
            // (6) never on top of a farm the enemy holds: the gunners stop short, at least 600 m from its walls (est.), on their side of it.
            // Before this, guns sent against the ridge west of the road could unlimber against Hougoumont's walls, which is what made
            // "bombard the ridge, then attack Hougoumont" carry the farm almost every time.
            const enemyFarm = q => E.sps.some(sp => sp.holder && sp.holder !== 'FR' && hyp(sp.x - q[0], sp.y - q[1]) < 600);
            const at = kk => [c[0] + (gx - c[0]) / d * kk, c[1] + (gy - c[1]) / d * kk];
            while (k < d && enemyFarm(at(k))) k += 100;
            const p = at(Math.min(k, d)); site = 'pt' + o.id + 's'; E.objectives[site] = { name: 'a battery site', line: [[p[0] - 300, p[1]], [p[0] + 300, p[1]]] }; }
        }
        exec({ kind: 'bombard', units: guns.map(u => u.id), site, area: objKey, opens: true, facing: m.facing });
        if (o.to === 'grandBattery') guns.forEach(u => u.gbattery = true);
        o.units = guns.map(u => u.id);
        break;
      }
      case 'advance': case 'withdraw': {
        const { lead } = pick(o, 'advance');
        exec({ kind: 'advance', obj: objKey, units: lead.map(u => u.id), form: m.formation || (s.action === 'withdraw' ? 'columns' : null), facing: m.facing ?? null, march: true });
        o.units = lead.map(u => u.id); break;
      }
      case 'hold': { const { lead } = pick(o, 'hold'); exec({ kind: 'hold', units: lead.map(u => u.id) }); o.units = lead.map(u => u.id); break; }
      case 'screen': {
        const { lead } = pick(o, 'screen'), c = centre(E.objectives[objKey]);
        for (const u of lead) { const d = hyp(c[0] - u.x, c[1] - u.y), stop = d > 2000 ? [u.x + (c[0] - u.x) * (1 - 1800 / d), u.y + (c[1] - u.y) * (1 - 1800 / d)] : [u.x, u.y]; E.setTask(u, { kind: 'screen', area: c, order: o.id }, base.cause); E.routeTo(u, stop, true); }
        o.units = lead.map(u => u.id); break;
      }
      case 'support': {
        // idle infantry nearest the corps being supported (two brigades unless the order names them)
        const tgt0 = E.units.filter(u => u.side === 'FR' && E.formed(u) && cmdOf(u) === s.objective.corps);
        const cx = tgt0.length ? tgt0.reduce((a, u) => a + u.x, 0) / tgt0.length : 0, cy = tgt0.length ? tgt0.reduce((a, u) => a + u.y, 0) / tgt0.length : 0;
        const lead = Array.isArray(s.with) && s.with.length ? pick(o, 'support').lead : corpsUnits(o.to === 'ney' ? 'derlon' : o.to).filter(u => u.type === 'inf' && (u.task.kind === 'hold' || u.task.kind === 'move')).sort((a, b) => hyp(a.x - cx, a.y - cy) - hyp(b.x - cx, b.y - cy)).slice(0, 2), tgt = E.units.filter(u => u.side === 'FR' && E.formed(u) && cmdOf(u) === s.objective.corps && u.task.kind === 'attack');
        for (const u of lead.filter(u => u.type !== 'art')) { const near = tgt.sort((a, b) => hyp(a.x - u.x, a.y - u.y) - hyp(b.x - u.x, b.y - u.y))[0]; if (near) E.setTask(u, { kind: 'support', of: near.id, order: o.id, form: 'columns', obj: near.task.obj, sp: near.task.sp || null }, base.cause); }
        o.units = lead.map(u => u.id); break;
      }
      case 'rally': {
        for (const u of corpsUnits(o.to === 'ney' ? 'derlon' : o.to)) if (u.coh < 55 && u.type !== 'art' && u.task.kind !== 'garrison') { const at = [u.x, u.y + 500]; E.setTask(u, { kind: 'rally', at, since: E.t }, base.cause); u.path = [at]; }
        break;
      }
      case 'detach': {
        const tgt = s.detachTo, them = corpsUnits(tgt), cx = them.length ? them.reduce((a, u) => a + u.x, 0) / them.length : null, cy = them.length ? them.reduce((a, u) => a + u.y, 0) / them.length + 300 : null;
        for (const id of s.with) { const u = E.byId[id]; if (!u || !E.formed(u)) continue; u.corps = tgt === 'drouot' ? 'guard' : tgt; if (cx != null) { E.setTask(u, { kind: 'move', dest: [cx, cy], then: 'hold' }, base.cause); E.routeTo(u, [cx, cy], true); } }
        break;
      }
      case 'retreat': {
        const us = corpsUnits(o.to).concat(o.to === 'derlon' ? batteryUnits() : []).filter((u, i, a) => a.indexOf(u) === i);
        exec({ kind: 'retire', units: us.map(u => u.id), rear: s.rearguard === o.to });
        o.units = us.map(u => u.id);
        if (C.ney.active) { C.ney.active = false; C.ney.sector = null; C.ney.goal = null; }
        if (!E.flags.frWithdraw) E.beginRetreat(o);
        break;
      }
      case 'sector': if (s.sector === 'none') { C.ney.active = false; C.ney.sector = null; C.ney.goal = null; E.logEvent('orders', 'Ney hands the front back to the Emperor.', { side: 'FR', important: true }); break; } C.ney.active = true; C.ney.sector = s.sector; C.ney.goal = s.goal || null; C.ney.since = E.t; C.ney.lastMove = 0; E.logEvent('orders', `Ney takes command of the ${s.sector} of the line${s.goal ? ' with orders to take ' + E.objectives[s.goal].name : ''}.`, { side: 'FR', important: true }); break;
    }
    // (5e) brigades the Emperor himself tells to hold are kept in reserve: Ney cannot take them for his own charges until another order moves them
    if (s.from === 'napoleon' && o.units) for (const id of o.units) { if (s.action === 'hold') C.reserved[id] = o.id; else delete C.reserved[id]; }
    if (s.onAct) s.onAct(E, o);
    if (s.text) E.logEvent('orders', s.text, { side: 'FR', hidden: true });
  }
  C.reserved = {};
  C.orderTick = function () {
    for (const o of C.orders) {
      if (o.status === 'waiting' && E.t >= o.actAt && conditionsMet(o)) act(o);
      else if (o.status === 'queued' && !C.hq.moving && !o.carrier) write(o);
    }
    trackFire();
    // the grand battery has opened when three or more batteries are bombarding (everyone hears it)
    if (C.firing.battery == null) { const n = E.units.filter(u => u.side === 'FR' && u.type === 'art' && u.task.kind === 'bombard' && u.lastFired >= E.tick - 1).length; if (n >= 3) C.firing.battery = E.t; }
    neyTick();
  };

  /* ---------- staff actions at headquarters: moving, and sending aides to look ---------- */
  function staffAction(o) {
    const s = o.spec;
    if (s.action === 'moveHQ') {
      const nap = E.leaders.napoleon, to = E.ll2m(...Cmd.POSTS[s.post].at);
      C.hq.moving = { from: [nap.x, nap.y], to: s.post, toXY: to, leftAt: E.t, arriveAt: E.t + rnd.range(...CK.HQ_MOVE, 'moving headquarters') };
      o.status = 'done'; o.log.push(`${fmtT(E.t)} headquarters rides for ${Cmd.POSTS[s.post].name}`);
      E.logEvent('orders', `Napoleon rides to ${Cmd.POSTS[s.post].name}.`, { side: 'FR', important: true });
    } else if (s.action === 'observe') {
      const tgt = s.objective.point || centre(E.objectives[s.objective.place]), nap = E.leaders.napoleon;
      o.status = 'riding';
      const aide = { kind: 'aide', from: 'napoleon', to: null, toPos: tgt, side: 'FR', label: `an aide sent to look at ${C.objName(s)}`, payload: o, group: 'g' + o.id };
      aide.onDeliver = r => aideLooks(r, o);
      aide.onLost = () => { o.status = 'lost'; o.log.push(`${fmtT(E.t)} the aide did not come back`); };
      C.launch(aide); o.log.push(`${fmtT(E.t)} an aide rides out`);
    }
  }
  function aideLooks(r, o) {
    // the aide looks about him with his glass from where he has ridden to, then rides back
    const seen = [], p = [r.x, r.y];
    for (const e of E.units) {
      if (!e.onMap || e.gone || e.str <= 0 || e.side === 'FR') continue;
      const d = hyp(e.x - p[0], e.y - p[1]); if (d > 5000) continue;
      const l = E.los(p[0], p[1], 2.5, e.x, e.y, e.type === 'cav' ? 2.6 : e.lying ? 0.5 : 1.8); if (!l.clear) continue;
      if (rnd('aide sighting') < E.detectP(d / CK.TELESCOPE, l.trans, e.type === 'art' ? e.str * 15 : e.str)) seen.push(e);
    }
    const places = {}; for (const sp of E.sps) if (hyp(sp.x - p[0], sp.y - p[1]) < 1500) places[sp.id] = sp.holder;
    const lookedAt = E.t;
    const back = { kind: 'aide', from: null, fromPos: p, to: 'napoleon', side: 'FR', label: `the aide returning from ${C.objName(o.spec)}`, group: 'b' + o.id };
    back.onDeliver = () => {
      const B = C.B.napoleon, src = `aide at ${fmtT(lookedAt)}`;
      const recs = seen.map(e => { const rec = { tid: e.id, side: hyp(e.x - p[0], e.y - p[1]) < CK.ID_GLASS ? e.side : null, nat: hyp(e.x - p[0], e.y - p[1]) < CK.ID_GLASS ? e.nat : null, idLevel: hyp(e.x - p[0], e.y - p[1]) < CK.ID_GLASS ? 1 : 0, kind: e.type === 'gar' ? 'inf' : e.type, guns: e.type === 'art' ? e.str : 0, form: e.form, status: e.status === 'broken' ? 'broken' : null, str: (e.type === 'art' ? e.str * 12 : e.str) * (1 + rnd.normal('aide estimate') * 0.2), x: e.x, y: e.y, t: lookedAt, src, moving: false }; C.mergeContact(B, rec); return rec; });
      for (const [sp, h] of Object.entries(places)) { const o2 = B.places[sp]; if (!o2 || o2.t <= lookedAt) B.places[sp] = { holder: h, t: lookedAt, src }; }
      // (5e) the aide says what he saw and where, as a corps commander would, not just a count
      const groups = C.cluster ? C.cluster(recs).filter(g => g.str > 250 || g.guns).slice(0, 5) : [];
      const text = recs.length ? `From ${C.whereIs(p[0], p[1]).replace(/^at /, '')} at ${fmtT(lookedAt)} I saw ${recs.length} bodies of enemy troops, about ${(Math.round(recs.reduce((a, c) => a + (c.kind === 'art' ? 0 : c.str), 0) / 500) * 500).toLocaleString('en-GB')} men${recs.some(c => c.kind === 'art') ? ' and guns' : ''}${groups.length ? ': ' + groups.map(g => C.describeGroup(g, 0)).join('; ') : ''}. They are marked on your map.` : `From ${C.whereIs(p[0], p[1]).replace(/^at /, '')} at ${fmtT(lookedAt)} I saw no enemy troops.`;
      C.inboxPush({ kind: 'report', from: 'aide', title: `Aide's report, ${fmtT(lookedAt)}`, text, decision: groups.some(g => g.side === 'PR' || (!g.side && g.x > W.WM * 0.6)), writtenAt: lookedAt, refs: { tids: recs.map(r => r.tid), sp: Object.keys(places), at: p } });
      o.status = 'done';
    };
    back.onLost = () => { o.status = 'lost'; };
    C.launch(back);
  }
  C.hqTick = function () {
    const m = C.hq.moving, nap = E.leaders.napoleon; if (!m) { riskAtPost(); return; }
    const f = clamp((E.t - m.leftAt) / Math.max(1, m.arriveAt - m.leftAt), 0, 1);
    nap.x = m.from[0] + (m.toXY[0] - m.from[0]) * f; nap.y = m.from[1] + (m.toXY[1] - m.from[1]) * f;
    if (E.t >= m.arriveAt) { C.hq.post = m.to; C.hq.moving = null; C.inboxPush({ kind: 'sight', title: `At ${Cmd.POSTS[m.to].name}`, text: `Headquarters is set up at ${Cmd.POSTS[m.to].name}.`, decision: false, refs: { at: [nap.x, nap.y] } }); }
  };
  function riskAtPost() {
    // only the forward post is under fire (rules doc, open decision 3: wounded, army morale -10, orders slower)
    if (C.hq.post !== 'knoll' || C.hq.wounded) return;
    const nap = E.leaders.napoleon, hot = E.near(nap.x, nap.y, 900, u => u.side !== 'FR' && E.formed(u) && u.firedTick).length;
    const perHour = hot ? 0.06 : 0.01;
    if (rnd('Napoleon hit') < perHour / 30) { C.hq.wounded = true; E.morale.FR -= 10; E.logEvent('leader', 'Napoleon is wounded at the forward post.', { side: 'FR', important: true }); C.inboxPush({ kind: 'sight', title: 'Your Majesty is hit', text: 'A ball has struck Your Majesty. The wound is not mortal, but the army has seen you fall and every order now takes longer to write.', decision: true }); }
  }

  /* ---------- Grouchy, off the map ---------- */
  function grouchyReceives(o) {
    const T = E.ai && E.ai.S && E.ai.S.timetable, Gs = T && T.FR && T.FR.toGuns ? T.FR.toGuns.grouchy : null, G = E.leaders.grouchy; // (3d) the AI's record of Grouchy's own choice (doctrine.js: toGunsTick)
    o.status = 'done'; o.actedAt = E.t;
    let reply;
    if (o.spec.action === 'marchToGuns') {
      if (Gs && Gs.comes) reply = 'I am already marching toward Your Majesty, as Gérard urged.';
      else if (rnd('Grouchy obeys') < o.clarity * G.obe + 0.05) {
        if (Gs) Gs.comes = true;
        const blocked = rnd('Dyle crossings') < 0.3;
        const arr = blocked ? null : E.t + rnd.tri(...CK.GROUCHY_MARCH, 'Grouchy march');
        if (arr) for (const u of E.offmap.filter(x => x.group === 'grouchy')) u.arriveAt = arr + (u.baseArrive || 0);
        E.logEvent('hidden', arr ? `Grouchy receives the Emperor's order and turns west; he will reach the field around ${fmtT(arr)}.` : 'Grouchy turns west, but the Prussian rearguard holds the Dyle crossings: he never arrives.', { side: 'FR', hidden: true, important: true });
        reply = arr ? 'I have Your Majesty\'s order and am marching on Maransart by the Dyle bridges.' : 'I have Your Majesty\'s order. I am trying to force the Dyle crossings, but the Prussians hold them.';
      } else { reply = 'I have Your Majesty\'s dispatch. I continue on Wavre after the Prussians, as my instructions of this morning direct.'; E.logEvent('hidden', 'Grouchy reads the order as confirming his march on Wavre.', { side: 'FR', hidden: true }); }
    } else reply = `I have Your Majesty's order (${describe(o)}).`;
    // his answer takes as long to come back
    const back = { kind: 'report', from: null, fromPos: [W.WM - 20, W.HM * 0.82], to: 'napoleon', side: 'FR', label: `Grouchy's reply of ${fmtT(E.t)}`, group: 'gr' + o.id };
    const written = E.t;
    back.onDeliver = () => C.inboxPush({ kind: 'report', from: 'grouchy', title: `Grouchy, ${fmtT(written)}`, text: reply, decision: true, writtenAt: written });
    C.pendingLaunch.push({ at: E.t + Math.max(30, rnd.tri(...CK.GROUCHY_RIDE, 'ride from Grouchy') - 60), r: back });
  }

  /* ---------- Ney in command of a sector ---------- */
  function neyTick() {
    const N = C.ney; if (!N.active || E.tick % 5 !== 0) return;
    const L = E.leaders.ney; if (!L || L.alive === false) return;
    const B = C.B.ney, goal = N.goal ? E.objectives[N.goal] : null; if (!goal) return;
    const sp = goal.sp ? E.spById[goal.sp] : null, held = sp ? (B.places[sp.id] && B.places[sp.id].holder === 'FR') : false;
    if (held) return;
    const pool = SECTORS[N.sector].flatMap(corpsUnits);
    if (pool.some(u => u.task.kind === 'attack' && (u.task.sp === goal.sp || u.task.obj === N.goal))) return;
    if (E.t - (N.lastMove || 0) < 20) return;
    const fresh = pool.filter(u => u.type === 'inf' && u.status === 'steady' && !C.reserved[u.id] && u.task.kind !== 'attack' && u.task.kind !== 'garrison').sort((a, b) => fitness(B, b) - fitness(B, a)).slice(0, 2);
    if (!fresh.length) return;
    N.lastMove = E.t;
    E.sendOrder({ id: 'ney' + C.nextId++, from: 'ney', to: cmdOf(fresh[0]), kind: 'attack', obj: N.goal, units: fresh.map(u => u.id), form: 'attack', maxAttempts: 3, direct: true, text: `Ney sends ${fresh.map(u => u.name).join(' and ')} against ${goal.name}.` });
  }

  /* ---------- orders the computer's own commanders give (Ney, Jérôme): carried by riders too ---------- */
  E.sendOrder = function (x) {
    const from = x.from, us = (x.units || []).map(id => E.byId[id]).filter(Boolean);
    const target = us.length ? [us.reduce((a, u) => a + u.x, 0) / us.length, us.reduce((a, u) => a + u.y, 0) / us.length] : (C.posOf(x.to) || null);
    const range = from === 'ney' ? CK.WRITE.ney : from === 'napoleon' ? CK.WRITE[C.opts.staff] : CK.WRITE.corps;
    const w = x.writeMin ?? rnd.range(range[0], range[1], 'order writing') * (x.direct ? 0.5 : 1);
    x.sentAt = E.t; x.status = 'carried'; E.orders.push(x);
    const r = { kind: 'order', from, to: null, toPos: target, side: E.leaders[from] ? E.leaders[from].side : 'FR', label: `${E.leaders[from] ? E.leaders[from].name : from}'s order`, text: x.text || '', payload: x, group: 'g' + (x.id || C.nextId++) + 'x' + C.nextId++ };
    r.onDeliver = () => { x.status = 'interpreting'; const at = E.t + rnd.range(...(x.direct ? CK.INTERP_DIRECT : CK.INTERP), 'interpretation') * (x.direct ? 0.5 : 1); C.legacy.push({ at, x }); };
    r.onLost = () => { x.status = 'lost'; };
    C.pendingLaunch.push({ at: E.t + w, r });
    return x;
  };
  C.legacy = [];
  const prevTick = C.orderTick;
  C.orderTick = function () { prevTick(); const due = C.legacy.filter(p => E.t >= p.at); C.legacy = C.legacy.filter(p => E.t < p.at); for (const p of due) { p.x.status = 'acting'; if (E.ai) E.ai.receive(E, p.x); } };
  return C;
}

root.WOrders = { install, RECIPIENTS, ACTIONS, ALLOWED, SECTORS, RETREAT_TO };
if (typeof module !== 'undefined' && module.exports) module.exports = root.WOrders;
})(typeof globalThis !== 'undefined' ? globalThis : this);
