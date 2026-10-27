/* Waterloo command and fog of war: what each commander believes, the riders who carry orders and reports,
   and the order builder. Follows the "Command and orders" and "Fog of war" sections of the rules doc.
   Every value in CK is my estimate unless the rules doc gives it; the comments say which. */
(function (root) {
'use strict';
const hyp = Math.hypot, D2R = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const bearing = (dx, dy) => (Math.atan2(dx, -dy) / D2R + 360) % 360;
const COMPASS = ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east', 'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'];
const comp = b => COMPASS[Math.round(b / 22.5) % 16];
const round = (n, to) => Math.round(n / to) * to;
const roundStr = n => n >= 1000 ? round(n, n >= 5000 ? 1000 : 500) : round(n, 100) || 100;
const fmtN = n => Math.round(n).toLocaleString('en-GB');

const CK = {
  TELESCOPE: 1.6,        // a commander's glass stretches detection range (est.)
  ID_EYE: 1000,          // identification needs less than about 1 km (rules doc)
  ID_GLASS: 1800,        // ... or this far through a commander's telescope (est.)
  KIND_RANGE: 3000,      // beyond this, you can't tell foot from horse (est.)
  ADC_BASE: 4,           // minutes for a brigade's sighting to be passed up (est.)
  ADC_SPEED: 250,        // aide's gallop within a corps, m/min (est.)
  RIDER_CROSS: 8000 / 60, // 8 km/h across country (rules doc), x (1 - 0.4W)
  RIDER_ROAD: 12000 / 60, // 12 km/h on roads (rules doc)
  LOSS_NEAR: 0.03, LOSS_CLOSE: 0.10, // per km under fire (rules doc: 3-10%)
  NEAR: 800, CLOSE: 300, CAPTURE: 0.4,
  REPORT_MIN: 45, REPORT_MAX: 90, REPORT_GAP: 15, // rules doc: every 45-90 min or on events
  OPTIMISM: 0.2, CAUTION: 0.25, STR_ERR: 0.25, STR_ERR_KM: 0.10, // rules doc
  POS_ERR: 25, POS_ERR_KM: 35, // m of position error, plus per km of range (est.)
  FADE: 45, DRIFT_PER_MIN: 5,  // rules doc: opacity e^(-age/45); zone +50 m per 10 min
  SILENCE: 45,                 // rules doc default ceiling on silence
  PATROL_EVERY: 20, PATROL_RANGE: 3500, PATROL_SEE: 1500, PATROL_PRISONER: 0.08, // est.
  WRITE: { soult: [5, 15], berthier: [3, 8], corps: [3, 8], ney: [1, 3], wellington: [2, 6] }, // rules doc for Soult/Berthier
  INTERP: [10, 20], INTERP_DIRECT: [3, 8],     // rules doc: 10-20 min to pass an order down
  GROUCHY_RIDE: [170, 210, 420],               // min; rules doc: about 3 h base, history 3-7 h
  GROUCHY_MARCH: [240, 300, 420],              // min from receiving the order to reaching the field (est.)
  HQ_MOVE: [10, 20],                           // rules doc
};

/* ---------- who commands whom ---------- */
const CORPS_CMD = { derlon: 'derlon', reille: 'reille', lobau: 'lobau', milhaud: 'milhaud', kellermann: 'kellermann', guard: 'drouot', guardcav: 'drouot', grouchy: 'napoleon', wellington: 'wellington', bulow: 'bulow', pirch: 'pirch', zieten: 'zieten', hal: 'wellington' };
const HORSE_CMD = { aHMil: 'milhaud', aHKel: 'kellermann', aHGC: 'drouot', aHJac: 'derlon', aHPire: 'reille', aHDS: 'lobau' };
const FRONT = ['derlon', 'reille', 'milhaud', 'kellermann']; // Ney, as field commander, hears from these
const COMMANDERS = { FR: ['napoleon', 'ney', 'derlon', 'reille', 'lobau', 'drouot', 'milhaud', 'kellermann'], AL: ['wellington'], PR: ['blucher', 'bulow', 'pirch', 'zieten'] };
const POSTS = {
  caillou: { name: 'Le Caillou', at: [50.6461, 4.4207] },
  rossomme: { name: 'Rossomme', at: [50.65675, 4.41333] },
  ba: { name: 'La Belle Alliance', at: [50.6680, 4.4140] },
  knoll: { name: 'the knoll toward La Haye Sainte', at: [50.6735, 4.4128] },
};
const NATWORD = { GB: 'British', KGL: 'British', HAN: 'Hanoverian', NL: 'Dutch-Belgian', NAS: 'Nassau', BRU: 'Brunswick', MIX: 'allied', PR: 'Prussian', FR: 'French' };
const KINDWORD = { inf: 'infantry', cav: 'cavalry', art: 'guns', gar: 'infantry' };
const CORPSNAME = { bulow: "Bülow's IV Corps", pirch: "Pirch's II Corps", zieten: "Zieten's I Corps", wellington: "Wellington's army", hal: "Prince Frederik's corps from Hal",
  derlon: "d'Erlon's I Corps", reille: "Reille's II Corps", lobau: "Lobau's VI Corps", guard: 'the Guard', guardcav: 'the Guard cavalry', milhaud: "Milhaud's cuirassiers", kellermann: "Kellermann's cuirassiers", grouchy: "Grouchy's wing" };

function cmdOf(u) {
  if (u.gbattery) return 'derlon'; // the grand battery answers to I Corps' gunners, wherever its guns came from
  if (HORSE_CMD[u.id]) return HORSE_CMD[u.id];
  if (u.corps && CORPS_CMD[u.corps]) return CORPS_CMD[u.corps];
  return u.side === 'FR' ? 'napoleon' : u.side === 'AL' ? 'wellington' : 'bulow';
}

/* =================================================================== */
function install(E, opts = {}) {
  const W = E.W, rnd = E.rnd, fmtT = E.fmtT;
  const C = {
    opts: Object.assign({ staff: 'soult', silence: CK.SILENCE }, opts), CK,
    B: {}, riders: [], inbox: [], orders: [], nextId: 1, lastPlace: {}, soundSrc: [], firing: { battery: null },
    hq: { post: 'rossomme', moving: null, wounded: false },
  };
  E.command = C;
  // Napoleon's HQ starts at Rossomme; Grouchy is a leader off the map
  // (6) at 05:00 he is still at Le Caillou, where he spent the night
  if (E.scenario === '0500') C.hq.post = 'caillou';
  const nap = E.leaders.napoleon; { const [x, y] = E.ll2m(...POSTS[C.hq.post].at); nap.x = x; nap.y = y; }
  if (!E.leaders.grouchy) E.leaders.grouchy = { id: 'grouchy', side: 'FR', name: 'Grouchy', agg: 0.4, ini: 0.3, obe: 0.9, skill: 0.6, exp: 0.4, rank: 2, alive: true, offmap: true, orig: 'Grouchy' };
  const LM = W.LM;

  /* ---------- positions ---------- */
  function posOf(id) {
    const L = E.leaders[id]; if (!L) return null;
    if (L.offmap) return null;
    if (L.unit && E.byId[L.unit] && E.byId[L.unit].onMap && !E.byId[L.unit].gone) { const u = E.byId[L.unit]; return [u.x, u.y]; }
    // (6) a French commander whose corps is still coming up the high road: the rider meets him where the road enters the field
    if (L.side === 'FR' && L.unit && E.byId[L.unit] && !E.byId[L.unit].onMap && !E.byId[L.unit].gone && E.byId[L.unit].group === 'frArrive') return E.retreatExit();
    if (L.x != null) return [L.x, L.y];
    // Prussian commanders ride with their leading formation; before it arrives, off the east edge
    const corps = L.corps || id; // the corps he rides with (a placement's corps, else his own)
    const mine = E.units.filter(u => u.corps === corps && u.onMap && !u.gone && u.str > 0);
    if (mine.length) { let best = mine[0]; for (const u of mine) if (u.x < best.x) best = u; return [best.x + 150, best.y]; }
    const r = E.routes[E.routeOf[corps] || corps]; return r ? [r[0][0], r[0][1]] : null;
  }
  C.posOf = posOf;
  const PERIOD = { "the Lion's Mound site": 'the crest west of the crossroads' }; // the mound was raised in the 1820s: dispatches name what was there in 1815
  function whereIs(x, y) {
    let best = null, bd = Infinity; for (const l of LM) { const d = hyp(l.x - x, l.y - y); if (d < bd) { bd = d; best = l; } }
    const n = PERIOD[best.n] || best.n;
    if (bd < 200) return 'at ' + n;
    if (bd < 600) return 'near ' + n;
    const dist = bd < 1000 ? round(bd, 100) + ' m' : (bd / 1000).toFixed(1) + ' km';
    return `${dist} ${comp(bearing(x - best.x, y - best.y))} of ${n}`;
  }
  C.whereIs = whereIs;

  /* ---------- belief records ---------- */
  function makeBelief(id, side) { return { id, side, c: new Map(), own: new Map(), friends: {}, places: {}, sound: {}, soundSlow: {}, soundAlertAt: {}, pending: [], plumes: {}, lastPlaceSeen: {}, intercepts: [], firstSeen: {}, news: {} }; }
  for (const side of E.sideIds) for (const id of COMMANDERS[side] || []) C.B[id] = makeBelief(id, side);
  // everyone starts knowing the morning's positions roughly: own units exactly, the enemy line as seen at dawn
  for (const id of Object.keys(C.B)) {
    const B = C.B[id];
    for (const sp of E.sps) if (sp.holder) B.places[sp.id] = { holder: sp.holder, t: E.t, src: 'the morning' };
  }
  function strErr(r) { return CK.STR_ERR + CK.STR_ERR_KM * Math.max(0, r / 1000 - 1); }
  // a sighting of enemy unit e by an observer at range r: noisy, partly identified
  function sightRecord(e, r, src, glass, t) {
    const err = strErr(r), sd = CK.POS_ERR + CK.POS_ERR_KM * r / 1000;
    const idR = glass ? CK.ID_GLASS : CK.ID_EYE, red = e.nat === 'GB' || e.nat === 'KGL' || e.nat === 'HAN';
    const level = r <= idR || (red && r <= idR * 1.6) ? 1 : 0; // redcoats show further (est.)
    const men = e.type === 'art' ? e.str * 12 : e.str;
    // unidentified troops on the enemy's side of the valley, west of Frischermont, can only be the enemy's (est. boundary)
    const guess = level ? null : e.side !== 'FR' ? (e.y < 3700 && e.x < 7500 ? 'AL' : null) : (e.y > 3300 && e.x < 7500 ? 'FR' : null);
    return { tid: e.id, side: level ? (e.side === 'FR' ? 'FR' : e.side) : guess, nat: level ? e.nat : null, idLevel: level, corps: null,
      kind: r <= CK.KIND_RANGE || e.type === 'art' ? e.type === 'gar' ? 'inf' : e.type : 'troops', guns: e.type === 'art' ? Math.round(e.str * (1 + rnd.normal('gun count') * 0.15)) : 0,
      form: r < 2500 ? e.form : null, status: r < 1500 && e.status === 'broken' ? 'broken' : r < 1200 && e.status === 'disordered' ? 'disordered' : null,
      str: Math.max(50, men * (1 + rnd.normal('strength estimate') * err)), x: e.x + rnd.normal('position error') * sd, y: e.y + rnd.normal('position error') * sd,
      t: t ?? E.t, src, moving: !!e.path && e.path.length > 0 && e.task.kind !== 'hold', dir: e.facing, garrison: e.spId || null, guard: !!(e.isGuard && e.type === 'inf' && r < 1200) };
  }
  function mergeContact(B, rec) {
    const old = B.c.get(rec.tid);
    if (!old) { B.c.set(rec.tid, rec); if (!B.firstSeen[rec.tid]) B.firstSeen[rec.tid] = E.t; return rec; }
    const idLevel = Math.max(old.idLevel || 0, rec.idLevel || 0);
    const keepId = { side: rec.side || old.side, nat: rec.nat || old.nat, corps: rec.corps || old.corps, idLevel, guard: rec.guard || old.guard };
    if (rec.t < old.t) { Object.assign(old, keepId); return old; } // older news: only identity can improve
    let ghost = null;
    if (old.src !== rec.src && hyp(old.x - rec.x, old.y - rec.y) > 400 && rec.t - old.t < 20) ghost = { x: old.x, y: old.y, t: old.t, src: old.src };
    const kind = rec.kind === 'troops' && old.kind !== 'troops' ? old.kind : rec.kind;
    Object.assign(old, rec, keepId, { kind, ghost, guns: rec.guns || old.guns });
    return old;
  }
  C.mergeContact = mergeContact;
  const cohWord = (status, coh) => status === 'broken' ? 'broken' : coh >= 65 ? 'steady' : coh >= 50 ? 'tired but steady' : coh >= 30 ? 'shaken' : 'disordered';
  C.cohWord = cohWord;
  function ownRecord(u, src, t) {
    return { uid: u.id, x: u.x, y: u.y, t: t ?? E.t, tState: t ?? E.t, src, srcState: src, str: u.str, type: u.type, cohWord: cohWord(u.status, u.coh), coh: u.coh, status: u.status, task: u.task.kind, sp: u.task.sp || u.spId || null, form: u.form, ammo: u.type === 'art' ? u.rounds : u.ammo, gone: u.gone || !u.onMap };
  }
  function mergeOwn(B, rec) {
    // positions and condition age separately: a glimpse from headquarters moves a block but says nothing of its state
    const old = B.own.get(rec.uid);
    if (rec.src === 'own eyes') { if (old) { if (rec.t >= old.t) { old.x = rec.x; old.y = rec.y; old.t = rec.t; old.src = 'own eyes'; old.form = rec.form; } } else { const u = E.byId[rec.uid]; if (u) B.own.set(rec.uid, Object.assign(ownRecord(u, 'own eyes', rec.t), { tState: -1, srcState: null, cohWord: null })); } return; }
    if (!old) { B.own.set(rec.uid, Object.assign({}, rec)); return; }
    if (rec.tState >= (old.tState ?? -1)) Object.assign(old, { str: rec.str, cohWord: rec.cohWord, coh: rec.coh, status: rec.status, task: rec.task, sp: rec.sp, ammo: rec.ammo, gone: rec.gone, tState: rec.tState, srcState: rec.srcState || rec.src });
    if (rec.t >= old.t) Object.assign(old, { x: rec.x, y: rec.y, t: rec.t, src: rec.src, form: rec.form });
  }
  C.mergeOwn = mergeOwn;
  function mergePlace(B, spid, holder, t, src) { const o = B.places[spid]; if (!o || o.t <= t) B.places[spid] = { holder, t, src }; }
  C.queue = function (cmdId, at, fn) { const B = C.B[cmdId]; if (B) B.pending.push({ at, fn }); };

  /* ---------- observation: brigades see, and pass it up their chain ---------- */
  function chainFor(u) {
    const c = cmdOf(u), out = [c];
    if (u.side === 'FR' && FRONT.includes(c)) out.push('ney');
    if (u.side === 'PR' && (c === 'bulow' || c === 'pirch')) out.push('blucher');
    return out.filter(id => C.B[id] && E.leaders[id] && E.leaders[id].alive !== false);
  }
  C.observed = function (o, e, r, trans) {
    // called by the engine's sighting pass when brigade o sees enemy e
    for (const cid of chainFor(o)) {
      const p = posOf(cid), d = p ? hyp(p[0] - o.x, p[1] - o.y) : 3000, delay = CK.ADC_BASE + d / CK.ADC_SPEED;
      const rec = sightRecord(e, r, `${E.leaders[o.leader] ? E.leaders[o.leader].name : o.name}'s ${o.type === 'cav' ? 'vedettes' : 'outposts'}`, false, E.t);
      rec.src = `${o.name}`;
      C.queue(cid, E.t + delay, B => mergeContact(B, rec));
    }
  };
  function ownReports() {
    // every brigade tells its commander how it stands, roughly every ten minutes
    for (const u of E.units) {
      if (!u.onMap && !u.left) continue;
      for (const cid of chainFor(u)) {
        const p = posOf(cid), d = p ? hyp(p[0] - u.x, p[1] - u.y) : 3000, delay = CK.ADC_BASE + d / CK.ADC_SPEED;
        const rec = ownRecord(u, u.name, E.t); C.queue(cid, E.t + delay, B => mergeOwn(B, rec));
      }
    }
  }
  /* ---------- a commander's own eyes, with a telescope ---------- */
  const EYE_LIST = ['napoleon', 'ney', 'derlon', 'reille', 'lobau', 'drouot', 'wellington', 'blucher', 'bulow', 'zieten'];
  function eyes(cid) {
    const L = E.leaders[cid], B = C.B[cid]; if (!L || !B || L.alive === false) return;
    const p = posOf(cid); if (!p) return;
    const side = B.side, mineSide = s => side === 'FR' ? s === 'FR' : s !== 'FR';
    for (const e of E.units) {
      if (!e.onMap || e.gone || e.str <= 0) continue;
      const r = hyp(e.x - p[0], e.y - p[1]); if (r > 9500) continue;
      const own = mineSide(e.side);
      if (own && side !== 'FR' && e.side !== side) { if (r < 6000) { const l2 = E.los(p[0], p[1], 2.5, e.x, e.y, 1.8 + (e.heightBonus || 0)); if (l2.clear) B.friends[e.id] = { x: e.x, y: e.y, t: E.t, str: e.str, firing: e.firedTick }; } continue; }
      if (own && cid !== 'napoleon') continue; // corps commanders know their own troops through their own reports
      const l = E.los(p[0], p[1], 2.5, e.x, e.y, (e.type === 'cav' ? 2.6 : e.lying ? 0.5 : e.type === 'gar' ? 4 : 1.8) + (e.heightBonus || 0)); if (!l.clear) continue;
      const men = e.type === 'art' ? e.str * 15 : e.str;
      if (rnd('commander sighting') >= E.detectP(r / CK.TELESCOPE, l.trans, men) * (e.concealed ?? 1)) continue;
      if (own) { if (r < 4000) { mergeOwn(B, { uid: e.id, x: e.x, y: e.y, t: E.t, src: 'own eyes', form: e.form }); if (cid === 'napoleon') watchOwn(e); } continue; }
      const rec = sightRecord(e, r, 'own eyes', true, E.t);
      const fresh = !B.c.has(e.id);
      mergeContact(B, rec);
      if (cid === 'napoleon') { if (fresh) C.notice.push(rec); else if (r < 4000) watchEnemy(e, rec); }
    }
    // strongpoints in view: who holds them
    for (const sp of E.sps) {
      const r = hyp(sp.x - p[0], sp.y - p[1]); if (r > 3000) continue;
      const l = E.los(p[0], p[1], 2.5, sp.x, sp.y, 6); if (!l.clear || l.trans < 0.3) continue;
      const before = B.places[sp.id];
      if (cid === 'napoleon' && before && before.holder !== sp.holder) seen(sp.holder === 'FR' ? `Our troops are in ${sp.name}.` : sp.holder ? `${cap(sp.name)} is in the enemy's hands.` : `${cap(sp.name)} has been abandoned.`, { sp: [sp.id], at: [sp.x, sp.y] });
      mergePlace(B, sp.id, sp.holder, E.t, 'own eyes');
    }
  }
  /* ---------- what Napoleon can see happen from his post (a stop in the game) ---------- */
  C.seen = {}; C.seenE = {}; C.seenNow = []; C.seenRefs = [];
  // what Napoleon saw, and what it was about (so the game can show it on the map)
  const seen = (text, ref) => { C.seenNow.push(text); C.seenRefs.push(ref || null); };
  const once = (key, gap) => { if (E.t - (C.seen['_' + key] ?? -999) < gap) return false; C.seen['_' + key] = E.t; return true; };
  function watchOwn(u) {
    const prev = C.seen[u.id], now = { task: u.task.kind, status: u.status, sp: u.spId, charge: !!u.charge };
    C.seen[u.id] = now; if (!prev) return;
    const where = whereIs(u.x, u.y).replace(/^at /, 'at '), R = { own: [u.id], at: [u.x, u.y] }, A = k => Object.assign({ alarm: k }, R); // (9) !! alarms: quick events seen
    // how a staff officer would name it: 'Charlet's brigade', 'Dubois's cuirassiers', 'the 2e Grenadiers', 'Foy's battery'
    const nm = u.name.replace(/^The /, 'the ');
    const regiment = /^\d|Grenadiers|Chasseurs|Lancers|Dragoons|Horse|Gendarmes|^the /i.test(nm);
    const what = u.type === 'art' ? nm : regiment ? (/^the /.test(nm) ? nm : 'the ' + nm) : u.type === 'cav' ? `${nm}'s horsemen` : `${nm}'s brigade`;
    const is = (u.type === 'cav' && !regiment) || regiment ? 'are' : 'is', has = is === 'are' ? 'have' : 'has';
    if (now.status === 'broken' && prev.status !== 'broken') { C.sawBreak[u.id] = E.t; if (once(u.id + 'b', 10)) seen(`${cap(what)} ${is} breaking and running, ${where}.`, A('break')); return; }
    if (prev.status === 'broken' && now.status !== 'broken') { if (once(u.id + 'r', 15)) seen(`${cap(what)} ${has} rallied.`, R); return; }
    if ((now.task === 'attack' || now.task === 'cavRaid') && prev.task !== now.task) { const again = C.atkAt[u.id] != null && E.t - C.atkAt[u.id] <= 120; C.atkAt[u.id] = E.t; if (once(u.id + 'a', 15)) seen(u.type === 'cav' ? `${cap(what)} ${is} riding up the slope${again ? ' again' : ''}, ${where}.` : `${cap(what)} ${is} going forward${again ? ' again' : ''}${u.task.sp ? ' against ' + E.spById[u.task.sp].name : ''}.`, A(again ? 'renewed' : 'attack')); return; }
    if (now.charge && !prev.charge && u.type === 'cav') { if (once(u.id + 'c', 10)) seen(`${cap(what)} ${is} charging, ${where}.`, A('charge')); return; }
    if (now.task === 'rally' && prev.task !== 'rally') { if (once(u.id + 't', 15)) seen(`${cap(what)} ${has} been thrown back, ${where}.`, R); return; }
    if (now.sp && now.sp !== prev.sp) { if (once(u.id + 's', 15)) seen(`${cap(what)} ${is} in ${E.spById[now.sp].name}.`, R); return; }
    if (now.task === 'bombard' && prev.task !== 'bombard') { if (once(u.id + 'g', 15)) C.gunsNow.push({ nm, id: u.id }); }
  }
  C.gunsNow = [];
  function watchEnemy(e, rec) {
    const prev = C.seenE[e.id], toward = e.side !== 'FR' && rec.moving && (e.y > 3300 || e.x > 7000) && (() => { const d = ((e.facing % 360) + 360) % 360; return e.side === 'PR' ? d > 180 && d < 340 : d > 100 && d < 260; })();
    const now = { status: rec.status, charge: !!e.charge, toward };
    C.seenE[e.id] = now; if (!prev) return;
    const who = rec.side ? (NATWORD[rec.nat] || (rec.side === 'PR' ? 'Prussian' : 'enemy')) : 'enemy', kind = rec.kind === 'cav' ? 'cavalry' : rec.kind === 'art' ? 'guns' : rec.kind === 'inf' ? 'infantry' : 'troops';
    const area = Math.round(e.x / 1200) + ',' + Math.round(e.y / 1200), where = whereIs(e.x, e.y), R = { tids: [e.id], at: [e.x, e.y] }, A = k => Object.assign({ alarm: k }, R);
    if (now.status === 'broken' && prev.status !== 'broken') { C.runSeen.push(E.t); if (once('eb' + area, 15)) seen(`${cap(who)} ${kind} are running, ${where}.`, A('break')); return; }
    if (now.charge && !prev.charge) { if (once('ec' + area, 10)) seen(`${cap(who)} cavalry are charging, ${where}.`, A('charge')); return; }
    if (now.toward && !prev.toward && rec.str > 1000) { const again = C.advAt[area] != null && E.t - C.advAt[area] <= 90; C.advAt[area] = E.t; if (once('ea' + area, 20)) seen(`${cap(who)} ${kind} are coming forward${again ? ' again' : ''}, ${where}.`, A(again ? 'renewed' : 'attack')); }
  }
  C.notice = []; C.ney = { active: true, sector: 'whole', goal: null, since: E.t };
  /* ---------- (5e) things too big to miss from the post: no dice, so they never change the battle ---------- */
  // A cavalry charge, our infantry on the enemy's crest, Ney taking the reserve cavalry forward, the enemy wavering,
  // the enemy close to headquarters. Each is seen if headquarters has a line of sight to it (or, for the crest, is within 4 km).
  C.runSeen = []; C.chargeSeen = {}; C.neyNotes = []; C.sawBreak = {}; C.lastRequest = {}; C.atkAt = {}; C.advAt = {};
  const ownWhat = u => { const nm = u.name.replace(/^The /, 'the '), regiment = /^\d|Grenadiers|Chasseurs|Lancers|Dragoons|Horse|Gendarmes|^the /i.test(nm); return u.type === 'art' ? nm : regiment ? (/^the /.test(nm) ? nm : 'the ' + nm) : u.type === 'cav' ? `${nm}'s horsemen` : `${nm}'s brigade`; };
  C.ownWhat = ownWhat;
  function conspicuous() {
    const p = posOf('napoleon'); if (!p) return;
    // enemy cavalry charging, within 3.5 km and in sight
    for (const e of E.units) {
      if (e.side === 'FR' || e.type !== 'cav' || !e.charge || !E.formed(e) || C.chargeSeen[e.id] === e.charge) continue;
      const r = hyp(e.x - p[0], e.y - p[1]); if (r > 3500) continue;
      if (!E.los(p[0], p[1], 2.5, e.x, e.y, 2.6).clear) continue;
      C.chargeSeen[e.id] = e.charge;
      const tgt = E.byId[e.charge.target], who = r < CK.ID_GLASS * 1.6 ? (NATWORD[e.nat] || 'enemy') : 'enemy', area = Math.round(e.x / 1200) + ',' + Math.round(e.y / 1200);
      if (!once('ec' + area, 10)) continue;
      seen(`${cap(who)} cavalry are charging${tgt && tgt.side === 'FR' ? ' ' + ownWhat(tgt) : ''}, ${whereIs(e.x, e.y)}.`, { tids: [e.id], own: tgt && tgt.side === 'FR' ? [tgt.id] : [], at: [e.x, e.y], alarm: 'charge' });
    }
    // our infantry on the crest of the ridge, or thrown off it
    const crest = E.objectives.ridgeCentre && E.objectives.ridgeCentre.line;
    if (crest) { const cx = (crest[0][0] + crest[1][0]) / 2, cy = (crest[0][1] + crest[1][1]) / 2;
      if (hyp(cx - p[0], cy - p[1]) < 4000) {
        if (E.flags.crestFR && C.seen._crestAt !== E.flags.crestFR) { C.seen._crestAt = E.flags.crestFR; const on = E.units.filter(u => u.side === 'FR' && E.formed(u) && u.type === 'inf' && hyp(u.x - cx, u.y - cy) < 700); seen(`Our infantry stand on the crest of the enemy's ridge, ${whereIs(cx, cy)}!`, { own: on.map(u => u.id), at: [cx, cy] }); }
        if (!E.flags.crestFR && C.seen._crestAt && C.seen._crestGone !== C.seen._crestAt) { C.seen._crestGone = C.seen._crestAt; seen('The enemy has cleared his crest again.', { at: [cx, cy] }); }
      } }
    // the enemy wavering: three or more bodies seen running in half an hour
    C.runSeen = C.runSeen.filter(t => E.t - t <= 30);
    if (C.runSeen.length >= 3 && once('waver', 30)) seen(`Across the valley the enemy's line is wavering: ${C.runSeen.length} of his bodies have been seen running in the last half hour.`, { alarm: 'break' });
    // headquarters in danger
    if (!C.hq.moving) {
      const close = E.near(p[0], p[1], 800, u => u.side !== 'FR' && E.formed(u) && u.type !== 'art'), back = E.near(p[0], p[1], 500, u => u.side === 'FR' && u.status === 'broken' && u.onMap && !u.gone);
      if (close.length && once('hqdanger', 20)) { const c = close.sort((a, b) => hyp(a.x - p[0], a.y - p[1]) - hyp(b.x - p[0], b.y - p[1]))[0], d = Math.round(hyp(c.x - p[0], c.y - p[1]) / 100) * 100;
        inbox({ kind: 'sight', title: 'Headquarters in danger', text: `${cap(NATWORD[c.nat] || 'enemy')} ${c.type === 'cav' ? 'cavalry' : 'infantry'} are within ${d} m of headquarters. The staff urge Your Majesty to move back.`, decision: true, refs: { tids: close.map(u => u.id), at: [c.x, c.y] }, alarm: [{ kind: 'hq', at: [c.x, c.y], line: null }] }); }
      else if (back.length >= 2 && once('hqrout', 20)) inbox({ kind: 'sight', title: 'Headquarters', text: `Our broken troops are streaming back past headquarters: ${back.slice(0, 3).map(ownWhat).join(', ')}.`, decision: true, refs: { own: back.map(u => u.id), at: [p[0], p[1]] } });
    }
  }
  // Ney acts on his own: the reserve cavalry going forward is seen from any post, and he says why in his next report
  C.neyInitiative = function (kind, ids) {
    const us = (ids || []).map(id => E.byId[id]).filter(Boolean);
    // name the cavalry as a staff officer would, by corps
    const CAVGROUP = { dubois: "Milhaud's cuirassiers", travers: "Milhaud's cuirassiers", farine: "Milhaud's cuirassiers", vial: "Milhaud's cuirassiers", gchev: 'the Guard light cavalry', glanc: 'the Guard light cavalry', picquet: "Kellermann's cavalry", guiton: "Kellermann's cavalry", blanchard: "Kellermann's cavalry", donop: "Kellermann's cavalry", guyot: 'the Guard heavy cavalry' };
    const names = [...new Set(us.filter(u => u.type !== 'art').map(u => CAVGROUP[u.id] || ownWhat(u)))];
    const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || 'the cavalry';
    const at = fmtT(E.t);
    if (kind === 'cavalry') { seen(`Marshal Ney is leading ${list} forward onto the plateau, without Your Majesty's order.`, { own: us.map(u => u.id), alarm: 'charge' }); C.neyNotes.push(`At ${at} I took the cuirassiers forward: I saw the enemy falling back over the crest.`); }
    else if (kind === 'cavalry2') { seen(`${cap(list)} are following Ney onto the plateau, without Your Majesty's order.`, { own: us.map(u => u.id), alarm: 'charge' }); C.neyNotes.push(`At ${at} I called up more cavalry to finish the work on the plateau.`); }
    else if (kind === 'exploit') { seen(`With La Haye Sainte taken, Ney is running guns up beside it and sending ${list} against the enemy's centre.`, { own: us.map(u => u.id), alarm: 'attack' }); C.neyNotes.push(`At ${at}, with La Haye Sainte ours, I sent what infantry I could find against the enemy's centre and ran guns up beside the farm. Give me fresh infantry and the centre is ours.`); }
  };
  /* ---------- places: whoever has troops there knows at once; neighbours soon after ---------- */
  function placeWatch() {
    for (const sp of E.sps) {
      const was = C.lastPlace[sp.id]; if (was === sp.holder && was !== undefined) continue;
      C.lastPlace[sp.id] = sp.holder; if (was === undefined) continue;
      for (const u of E.near(sp.x, sp.y, 1500, u => E.formed(u))) for (const cid of chainFor(u)) {
        const p = posOf(cid), d = p ? hyp(p[0] - u.x, p[1] - u.y) : 3000, at = E.t + CK.ADC_BASE + d / CK.ADC_SPEED, h = sp.holder;
        C.queue(cid, at, B => mergePlace(B, sp.id, h, at, u.name));
      }
    }
  }
  C.onFire = function (sp, sec) {
    // a burning building sends up a plume seen for kilometres
    for (const [cid, B] of Object.entries(C.B)) { const p = posOf(cid); if (!p || hyp(p[0] - sp.x, p[1] - sp.y) > 12000) continue; B.plumes[sp.id] = { t: E.t, name: sp.name, sec: sec.name }; if (cid === 'napoleon') inbox({ kind: 'sight', title: `Smoke over ${sp.name}`, text: `A tall plume of smoke is rising from ${sp.name}: the ${sec.name} ${sec.name.endsWith('s') ? 'are' : 'is'} on fire.`, decision: false, refs: { sp: [sp.id], at: [sp.x, sp.y] } }); }
  };

  /* ---------- sound ---------- */
  // Heavy cannon fire carries more than 20 km (rules doc). Each commander hears firing by direction and weight.
  function sound() {
    const src = [];
    for (const u of E.units) if (u.firedTick && u.onMap) src.push([u.x, u.y, u.type === 'art' ? u.str * 1.0 : u.str / 1500, u.type === 'art' ? 'guns' : 'muskets', u.side]);
    for (const [cid, B] of Object.entries(C.B)) {
      const p = posOf(cid) || (cid === 'grouchy' ? null : null); if (!p) continue;
      const now = {};
      for (const [x, y, w, k] of src) {
        const d = hyp(x - p[0], y - p[1]); if (k === 'muskets' && d > 6000) continue;
        const sec = Math.round(bearing(x - p[0], y - p[1]) / 45) % 8, key = k + sec;
        now[key] = (now[key] || 0) + w / (1 + Math.pow(d / (k === 'guns' ? 4000 : 1500), 2));
      }
      for (let s = 0; s < 8; s++) for (const k of ['guns', 'muskets']) {
        const key = k + s, v = now[key] || 0;
        B.sound[key] = 0.6 * (B.sound[key] || 0) + 0.4 * v;       // last few minutes
        B.soundSlow[key] = 0.93 * (B.soundSlow[key] || 0) + 0.07 * v; // the last half hour or so
      }
    }
  }
  const SECT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function soundWord(v, k) { return k === 'guns' ? (v > 40 ? 'a tremendous cannonade' : v > 15 ? 'a heavy cannonade' : v > 4 ? 'steady gunfire' : v > 0.8 ? 'occasional gunfire' : null) : (v > 3 ? 'very heavy musketry' : v > 1 ? 'heavy musketry' : v > 0.3 ? 'musketry' : v > 0.08 ? 'scattered shots' : null); }
  C.soundWord = soundWord; C.SECT = SECT;
  function soundAlerts() {
    const B = C.B.napoleon, hits = [];
    for (let s = 0; s < 8; s++) for (const k of ['guns', 'muskets']) {
      const key = k + s, v = B.sound[key] || 0, slow = B.soundSlow[key] || 0;
      const thr = k === 'guns' ? 6 : 0.6;
      if (v > thr && v > 3 * slow + thr * 0.5 && E.t - (B.soundAlertAt[key] || -999) > 40) { B.soundAlertAt[key] = E.t; hits.push({ s, k, v }); }
    }
    if (!hits.length) return;
    const top = hits.sort((a, b) => b.v / (b.k === 'guns' ? 6 : 0.6) - a.v / (a.k === 'guns' ? 6 : 0.6))[0], dirs = [...new Set(hits.filter(h => h.k === top.k).map(h => SECT[h.s]))];
    const dirTxt = dirs.length > 1 ? dirs.slice(0, -1).join(', ') + ' and ' + dirs[dirs.length - 1] : dirs[0];
    const w = soundWord(top.v, top.k);
    const last = [...C.inbox].reverse().find(m => m.kind === 'sound');
    if (last && E.t - last.t <= 10 && last.k === top.k) { for (const d of dirs) if (!last.dirs.includes(d)) last.dirs.push(d); last.refs = { dirs: last.dirs.map(d => SECT.indexOf(d) * 45) }; const dt = last.dirs.length > 1 ? last.dirs.slice(0, -1).join(', ') + ' and ' + last.dirs[last.dirs.length - 1] : last.dirs[0]; last.text = `${w[0].toUpperCase() + w.slice(1)} has broken out to the ${dt}.`; return; }
    // (5e) starred only for the first firing of the day, or when the firing in that quarter comes from beyond Frischermont, where only the Prussians (or Grouchy) can be
    const firstSound = !C.inbox.some(m => m.kind === 'sound'), hp = posOf('napoleon'), xE = W.WM * 0.6;
    const fromEast = hp && E.units.some(u => u.firedTick && u.onMap && (u.side === 'PR' || u.x > xE) && dirs.includes(SECT[Math.round(bearing(u.x - hp[0], u.y - hp[1]) / 45) % 8]));
    inbox({ kind: 'sound', k: top.k, dirs, refs: { dirs: dirs.map(d => SECT.indexOf(d) * 45) }, title: `${top.k === 'guns' ? 'Cannonade' : 'Musketry'} to the ${dirs[0]}`, text: `${w[0].toUpperCase() + w.slice(1)} has broken out to the ${dirTxt}.`, decision: firstSound || fromEast });
  }
  C.heard = function (cid) {
    const B = C.B[cid]; if (!B) return [];
    const out = [];
    for (let s = 0; s < 8; s++) for (const k of ['guns', 'muskets']) { const w = soundWord(B.sound[k + s] || 0, k); if (w) out.push({ dir: SECT[s], k, w, v: B.sound[k + s] }); }
    return out.sort((a, b) => b.v - a.v);
  };

  /* ---------- inbox (Napoleon) ---------- */
  function mergeRefs(a, b) { if (!a) return b ? JSON.parse(JSON.stringify(b)) : null; if (!b) return a; for (const k of ['tids', 'own', 'sp', 'moves', 'dirs']) if (b[k]) a[k] = (a[k] || []).concat(b[k].filter(x => !(a[k] || []).includes(x))); if (!a.at && b.at) a.at = b.at; if (!a.alarm && b.alarm) a.alarm = b.alarm; return a; }
  C.mergeRefs = mergeRefs;
  // every item records where headquarters was, so the game can draw what was heard or seen from it
  function inbox(m) { m.t = E.t; m.id = C.nextId++; if (m.pause == null) m.pause = true; const p = posOf('napoleon'); if (p) m.hq = [p[0], p[1]]; C.inbox.push(m); if (m.kind === 'report' || m.kind === 'summary') C.lastNews = E.t; return m; }
  C.inboxPush = inbox; C.lastNews = E.t;

  /* ---------- riders ---------- */
  const CELL = 50, NX = W.NX, NY = W.NY;
  const ttAt = (x, y) => E.TT[clamp(Math.round(y / CELL), 0, NY - 1) * NX + clamp(Math.round(x / CELL), 0, NX - 1)];
  function riderSpeed(x, y) { const tt = ttAt(x, y), T = E.T, wet = E.wet; if (tt === T.ROAD) return CK.RIDER_ROAD; const cross = CK.RIDER_CROSS * (1 - 0.4 * wet); return tt === T.LANE ? cross * 1.15 : tt === T.WOOD ? cross * 0.35 : tt === T.BUILD ? cross * 0.3 : tt === T.STREAM ? cross * 0.5 : tt === T.SUNKEN ? cross * 0.6 : cross; }
  function avoidPath(side, a, b, belief) {
    // riders keep clear of enemy troops their sender knows about by swinging toward their own rear
    const back = side === 'FR' ? 1 : -1; let pts = [a, b];
    for (let k = 0; k < 2; k++) {
      let hit = null;
      for (const c of (belief ? belief.c.values() : [])) {
        if (E.t - c.t > 40 || c.side === (side === 'FR' ? 'FR' : null)) continue;
        for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, tt = clamp(((c.x - ax) * dx + (c.y - ay) * dy) / L2, 0, 1); if (hyp(c.x - ax - tt * dx, c.y - ay - tt * dy) < 450) { hit = [i, c]; break; } }
        if (hit) break;
      }
      if (!hit) break;
      const [i, c] = hit; pts.splice(i, 0, [c.x, c.y + back * 900]);
    }
    let path = [];
    for (let i = 1; i < pts.length; i++) path = path.concat(E.astar('rider', pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
    return path;
  }
  function launch(r) {
    r.id = 'r' + C.nextId++; r.status = 'riding'; r.ridden = 0; r.leftAt = E.t; r.trail = [];
    if (r.onLaunch) r.onLaunch(r);
    const from = r.fromPos || posOf(r.from) || [W.WM / 2, W.HM / 2];
    r.x = from[0]; r.y = from[1];
    const to = r.toPos || posOf(r.to);
    r.dest = to; r.path = to ? avoidPath(r.side, from, to, C.B[r.from] || null) : [];
    if (r.spread) for (let i = 0; i < r.path.length; i++) { const f = Math.sin(Math.PI * i / Math.max(1, r.path.length - 1)); r.path[i] = [r.path[i][0] + r.spread * f, r.path[i][1] + Math.abs(r.spread) * 0.3 * f]; }
    C.riders.push(r); return r;
  }
  C.launch = launch;
  C.message = function (from, to, label, fn, writeMin) {
    const r = { kind: 'message', from, to, side: E.leaders[from] ? E.leaders[from].side : 'AL', label, group: 'm' + C.nextId++ };
    const written = E.t;
    r.onDeliver = () => { const B = C.B[to]; if (B) fn(B, written); };
    C.pendingLaunch.push({ at: E.t + (writeMin ?? rnd.range(2, 6, 'message writing')), r });
  };
  function nearestEnemy(side, x, y, R) { let best = null, bd = R; for (const u of E.near(x, y, R, u => E.formed(u) && ((u.side === 'FR') !== (side === 'FR')))) { const d = hyp(u.x - x, u.y - y); if (d < bd) { bd = d; best = u; } } return best ? [best, bd] : null; }
  function moveRiders() {
    for (const r of C.riders) {
      if (r.status !== 'riding') continue;
      if (r.offmapAt != null) { if (E.t >= r.offmapAt) deliver(r); continue; }
      // the recipient may have moved: ride on toward where he is now
      if (r.to && !r.toPos && E.tick % 2 === 0) { const p = posOf(r.to); if (p && r.dest && hyp(p[0] - r.dest[0], p[1] - r.dest[1]) > 300) { r.dest = p; r.path = E.astar('rider', r.x, r.y, p[0], p[1]); } }
      let budget = 2;
      while (budget > 0 && r.path.length) {
        const [tx, ty] = r.path[0], d = hyp(tx - r.x, ty - r.y), v = riderSpeed(r.x, r.y), step = v * budget;
        if (d <= step) { r.x = tx; r.y = ty; r.path.shift(); budget -= d / v; r.ridden += d; }
        else { r.x += (tx - r.x) / d * step; r.y += (ty - r.y) / d * step; r.ridden += step; budget = 0; }
      }
      if (E.tick % 2 === 0) { r.trail.push([r.x, r.y]); if (r.trail.length > 12) r.trail.shift(); }
      // danger: riding near formed enemy troops (rules doc: 3-10% per km under fire)
      const ne = nearestEnemy(r.side, r.x, r.y, CK.NEAR);
      if (ne) {
        const [eu, d] = ne, km = Math.max(0.05, (riderSpeed(r.x, r.y) * 2) / 1000), rate = d < CK.CLOSE ? CK.LOSS_CLOSE : CK.LOSS_NEAR;
        if (rnd('rider under fire') < 1 - Math.pow(1 - rate, km)) {
          const captured = (eu.type === 'cav' || d < CK.CLOSE) && rnd('rider captured') < CK.CAPTURE;
          r.status = captured ? 'captured' : 'lost'; r.lostAt = E.t; r.lostWhere = whereIs(r.x, r.y);
          E.logEvent('hidden', `A rider carrying ${r.label} is ${captured ? 'captured' : 'shot down'} ${r.lostWhere}.`, { side: r.side, hidden: true, rider: r.id });
          if (captured) intercept(r, eu);
          lostCheck(r);
          continue;
        }
      }
      if (!r.path.length) {
        if (r.offmapRide) { r.offmapAt = E.t + r.offmapRide; continue; }
        const p = r.toPos || posOf(r.to);
        if (!p || hyp(p[0] - r.x, p[1] - r.y) < 120) deliver(r);
        else r.path = E.astar('rider', r.x, r.y, p[0], p[1]);
      }
    }
    // keep the list short: drop riders finished more than half an hour ago
    if (E.tick % 15 === 0) C.riders = C.riders.filter(r => r.status === 'riding' || E.t - (r.doneAt ?? r.lostAt ?? E.t) < 30);
  }
  function lostCheck(r) {
    r.doneAt = E.t;
    const g = r.group ? C.riders.filter(x => x.group === r.group) : [r];
    if (g.every(x => x.status === 'lost' || x.status === 'captured') && !C.pendingLaunch.some(p => p.r.group === r.group) && r.onLost) r.onLost(r);
  }
  function intercept(r, by) {
    const cid = cmdOf(by), B = C.B[cid]; if (B) B.intercepts.push({ t: E.t, from: r.from, to: r.to, label: r.label, text: r.text || '' });
    E.logEvent('hidden', `Men of ${by.name} take a ${r.side === 'FR' ? 'French' : r.side === 'PR' ? 'Prussian' : 'British'} courier: the message (${r.label}) is read at ${E.leaders[cid] ? E.leaders[cid].name + "'s" : 'enemy'} headquarters.`, { side: by.side, hidden: true });
  }
  C.delivered = {};
  function deliver(r) {
    r.status = 'delivered'; r.doneAt = E.t;
    if (r.group) { if (C.delivered[r.group]) { r.duplicate = true; return; } C.delivered[r.group] = E.t; }
    if (r.onDeliver) r.onDeliver(r);
  }
  C.deliver = deliver;

  /* ---------- reports from corps commanders ---------- */
  const REPORTERS = ['derlon', 'reille', 'lobau', 'drouot', 'milhaud', 'kellermann', 'ney'];
  const RESERVE = ['drouot', 'milhaud', 'kellermann']; // in sight of headquarters: they write when something happens
  const REP = {}; for (const id of REPORTERS) REP[id] = { next: E.t + rnd.range(CK.REPORT_MIN, CK.REPORT_MAX, 'report interval'), last: E.t - 30, acks: [], events: [], known: {}, told: {}, areas: {} };
  for (const id of REPORTERS) for (const sp of E.sps) REP[id].told['place_' + sp.id] = sp.holder; // the morning's holders are known to all
  C.REP = REP;
  C.flag = function (cid, ev) { const R = REP[cid]; if (R) R.events.push(Object.assign({ t: E.t }, ev)); };
  function corpsUnits(cid) { return E.units.filter(u => u.side === 'FR' && cmdOf(u) === cid && (u.onMap || u.left)); }
  function nearMine(cid, sp) { return E.units.some(u => u.side === 'FR' && u.onMap && !u.gone && (cid === 'ney' ? FRONT.includes(cmdOf(u)) : cmdOf(u) === cid) && hyp(sp.x - u.x, sp.y - u.y) < 1200); }
  function hasNews(cid) {
    // something a commander would send a rider about at once: a brigade broken, a place won or lost, a new enemy body
    const R = REP[cid], B = C.B[cid], p = posOf(cid); if (!p) return false;
    for (const o of B.own.values()) if (o.status === 'broken' && !R.known['broke_' + o.uid] && E.byId[o.uid] && (cid === 'ney' ? FRONT.includes(cmdOf(E.byId[o.uid])) : cmdOf(E.byId[o.uid]) === cid)) return true;
    for (const sp of E.sps) { const pb = B.places[sp.id]; if (!pb || !nearMine(cid, sp)) continue; const was = R.known['place_' + sp.id]; R.known['place_' + sp.id] = pb.holder; if (was !== undefined && was !== pb.holder) return true; }
    for (const [tid, t0] of Object.entries(B.firstSeen)) {
      if (t0 <= R.last || R.known['seen_' + tid]) continue; const c = B.c.get(tid); if (!c) continue; R.known['seen_' + tid] = 1;
      const cell = Math.round(c.x / 1500) + ',' + Math.round(c.y / 1500); if (R.areas[cell]) continue;
      const close = RESERVE.includes(cid) ? E.units.some(u => u.side === 'FR' && cmdOf(u) === cid && u.onMap && hyp(u.x - c.x, u.y - c.y) < 2500) : true;
      if (close && (c.side === 'PR' || (!c.side && c.x > W.WM * 0.6) || c.str > 2500)) return true;
    }
    return false;
  }
  function reportDue(cid) {
    const R = REP[cid], L = E.leaders[cid]; if (!L || L.alive === false) return false;
    if (cid === 'ney') { if (!(C.ney.active && C.ney.goal) && !R.acks.length && !R.events.length) return false; }
    else if (!corpsUnits(cid).some(u => u.onMap && !u.gone)) return false;
    if (E.t - R.last < CK.REPORT_GAP) return false;
    if (E.t >= R.next && (!RESERVE.includes(cid) || corpsUnits(cid).some(u => u.onMap && !u.gone && (u.task.kind !== 'hold' || E.tick - u.lastHit < 15)))) return true;
    if (E.t >= R.next) R.next = E.t + 10;
    if (R.events.some(e => e.urgent) || (E.tick % 2 === 0 && hasNews(cid))) return true;
    if (R.acks.length && E.t - R.acks[0].receivedAt > 20) return true; // a short note to say the order arrived
    return false;
  }
  function cluster(list) {
    const groups = []; const sorted = [...list].sort((a, b) => b.str - a.str);
    for (const c of sorted) { let g = groups.find(g => hyp(g.x - c.x, g.y - c.y) < 700 && (g.side === c.side) && (g.kindSet.size < 3)); if (!g) { g = { x: c.x, y: c.y, side: c.side, nat: c.nat, natMixed: false, str: 0, guns: 0, items: [], kindSet: new Set(), corps: c.corps }; groups.push(g); } g.items.push(c); g.str += c.kind === 'art' ? 0 : c.str; g.guns += c.guns || 0; g.kindSet.add(c.kind); if (c.nat) { const nw = NATWORD[c.nat]; if (!g.nat) g.nat = c.nat; else if (NATWORD[g.nat] !== nw) g.natMixed = true; } if (c.corps) g.corps = c.corps; }
    for (const g of groups) if (g.natMixed) g.nat = g.side === 'PR' ? 'PR' : 'MIX';
    return groups;
  }
  function describeGroup(g, bias) {
    const kinds = [...g.kindSet].filter(k => k !== 'art'), who = g.corps ? CORPSNAME[g.corps] || '' : '';
    const nat = g.nat ? NATWORD[g.nat] + ' ' : g.side ? '' : '';
    const str = g.str * (1 + bias);
    let body;
    if (!kinds.length) body = `${g.guns || 'some'} ${nat}guns`;
    else if (kinds.includes('troops')) body = `${g.side ? `about ${fmtN(roundStr(str))} ${nat}troops` : `a body of troops, about ${fmtN(roundStr(str))} men`}`;
    else body = `about ${fmtN(roundStr(str))} ${nat}${kinds.map(k => KINDWORD[k]).join(' and ')}${g.guns ? ` with ${g.guns} guns` : ''}`;
    if (who) body += ` (${who})`;
    // (5e) which bodies are running is no longer tacked onto every group: a report says once how many have broken since the last one
    const moving = g.items.some(c => c.moving && c.status !== 'broken');
    return `${body} ${whereIs(g.x, g.y)}${moving ? ', on the move' : ''}${!g.side && !g.corps ? ' (whose, we cannot tell)' : ''}`;
  }
  C.cluster = cluster; C.describeGroup = describeGroup;
  // the enemy bodies a commander has seen break since he last wrote, and where
  function enemyBreaks(R, B, t, near) {
    const list = [...B.c.values()].filter(c => c.status === 'broken' && c.side !== 'FR' && t - c.t <= 40 && !R.known['eb_' + c.tid] && (!near || near(c)));
    list.forEach(c => R.known['eb_' + c.tid] = 1);
    if (!list.length) return null;
    const places = [...new Set(list.map(c => whereIs(c.x, c.y).replace(/^(at|near) /, '').replace(/^.* of /, '')))].slice(0, 2);
    return list.length === 1 ? `Since my last report I have seen one body of the enemy break, near ${places[0]}.` : `Since my last report I have seen ${list.length} bodies of the enemy break, near ${places.join(' and ')}${list.length >= 3 ? ': his line there is wavering' : ''}.`;
  }
  function writeReport(cid) {
    const R = REP[cid], L = E.leaders[cid], B = C.B[cid], t = E.t;
    const agg = L.agg ?? 0.5, bias = (agg - 0.5) * 2; // + optimistic, - cautious
    const mine = cid === 'ney' ? E.units.filter(u => u.side === 'FR' && FRONT.includes(cmdOf(u)) && (u.onMap || u.left)) : corpsUnits(cid);
    const ownRecs = mine.map(u => B.own.get(u.id)).filter(Boolean);
    // losses as the commander knows them, understated if he is aggressive
    const known = ownRecs.reduce((a, o) => { const u = E.byId[o.uid]; return a + Math.max(0, (u ? u.str0 : 0) - (o.gone ? 0 : o.str)); }, 0);
    const lossStated = known * (1 - CK.OPTIMISM * Math.max(0, bias));
    const live = ownRecs.filter(o => !o.gone && o.status !== 'broken' && o.type !== 'art'), foot = ownRecs.filter(o => !o.gone && o.type !== 'art' && o.tState >= 0);
    const avgCoh = foot.length ? foot.reduce((a, o) => a + (o.status === 'broken' ? 10 : o.coh), 0) / foot.length : 0;
    const mood = !live.length ? 'my corps is scattered' : avgCoh >= 65 ? 'the men are in good heart' : avgCoh >= 52 ? 'the men are tired but steady' : avgCoh >= 38 ? 'several brigades are badly shaken' : 'the corps is in great disorder';
    const inf = live.filter(o => o.type === 'inf'), ammo = inf.length ? inf.reduce((a, o) => a + o.ammo, 0) / inf.length : 50;
    const broken = ownRecs.filter(o => o.status === 'broken' && !R.known['broke_' + o.uid]); broken.forEach(o => R.known['broke_' + o.uid] = 1);
    for (const tid of Object.keys(B.firstSeen)) R.known['seen_' + tid] = 1;
    for (const c of B.c.values()) if (t - c.t <= 40) R.areas[Math.round(c.x / 1500) + ',' + Math.round(c.y / 1500)] = 1;
    const attacking = ownRecs.filter(o => o.task === 'attack' && !o.gone && o.status !== 'broken'), rallying = ownRecs.filter(o => o.task === 'rally' && !o.gone);
    // what he can see of the enemy (fresh contacts only)
    // what his own troops can see: fresh contacts within 4 km of any of his brigades (patrols reach further)
    const seen = [...B.c.values()].filter(c => t - c.t <= 40 && c.side !== 'FR' && (cid === 'ney' || /patrol|prisoner/.test(c.src) || mine.some(u => u.onMap && !u.gone && hyp(c.x - u.x, c.y - u.y) < 4000)));
    const groups = cluster(seen).filter(g => g.str > 250 || g.guns).slice(0, 4);
    const enemyBias = bias < 0 ? CK.CAUTION * -bias : 0;
    // places in his sector
    const placesTxt = [];
    for (const sp of E.sps) { const pb = B.places[sp.id]; if (!pb || t - pb.t > 60) continue; if (!nearMine(cid, sp)) continue; const was = R.told['place_' + sp.id]; if (was === pb.holder || (was === undefined && !pb.holder)) { R.told['place_' + sp.id] = pb.holder; continue; } R.told['place_' + sp.id] = pb.holder; placesTxt.push(pb.holder === 'FR' ? `${cap(sp.name)} is ours.` : pb.holder ? `${cap(sp.name)} is held by the enemy.` : `${cap(sp.name)} is empty.`); }
    const parts = [];
    if (cid === 'ney') {
      // Ney writes as the commander of the front: how each corps stands, not brigade by brigade (5e: his reports repeated the corps commanders' word for word)
      const byCorps = FRONT.map(c => {
        const of = list => list.filter(o => E.byId[o.uid] && cmdOf(E.byId[o.uid]) === c);
        const a = of(attacking).length, r = of(rallying).length, b = of(broken).length; if (!a && !r && !b) return null;
        const bits = [a ? `${a} attacking` : '', r ? `${r} re-forming` : '', b ? `${b} newly broken` : ''].filter(Boolean);
        return `${CORPSNAME[c]}, ${bits.join(', ')}`;
      }).filter(Boolean);
      parts.push(byCorps.length ? `Along the front: ${byCorps.join('; ')}.` : 'The line holds where it stands.');
      for (const n of (C.neyNotes || []).splice(0)) parts.push(n);
    } else {
    if (attacking.length) parts.push(`${attacking.length > 1 ? `${attacking.length} of my brigades are` : 'One of my brigades is'} attacking${attacking[0] && E.byId[attacking[0].uid] && E.byId[attacking[0].uid].task.sp ? ' ' + E.spById[E.byId[attacking[0].uid].task.sp].name : ''}.`);
    if (rallying.length) parts.push(`${rallying.map(o => nameOf(o.uid)).join(', ')} ${rallying.length > 1 ? 'were thrown back and are' : 'was thrown back and is'} re-forming.`);
    if (broken.length) parts.push(`${broken.map(o => nameOf(o.uid)).join(' and ')} ${broken.length > 1 ? 'have' : 'has'} broken.`);
    if (!attacking.length && !rallying.length && !broken.length) parts.push('I hold my positions.');
    }
    parts.push(known > 150 ? `I put my losses at about ${fmtN(roundStr(lossStated))} men; ${mood}.` : `My losses are slight; ${mood}.`);
    if (ammo < 20) parts.push('Cartridges are running short.');
    for (const p of placesTxt) parts.push(p);
    if (groups.length) parts.push('Of the enemy I see ' + groups.map(g => describeGroup(g, enemyBias)).join('; ') + '.');
    const eb = enemyBreaks(R, B, t, c => cid === 'ney' || mine.some(u => u.onMap && !u.gone && hyp(c.x - u.x, c.y - u.y) < 4000)); if (eb) parts.push(eb);
    const prisoners = R.events.filter(e => e.kind === 'prisoner'); for (const e of prisoners) parts.push(e.text);
    const ackTxt = ackTexts(R.acks); parts.push(...ackTxt);
    // requests: Ney asks for infantry when he has none fresh and has a success to exploit
    let request = null;
    const fresh = live.filter(o => o.type === 'inf' && o.coh > 60 && o.task !== 'attack').length;
    if ((cid === 'ney' || cid === 'derlon') && attacking.length + rallying.length > 0 && fresh === 0) { request = 'I need fresh infantry to finish this.'; parts.push(request); }
    const urgentEv = R.events.filter(e => e.urgent);
    const decision = !!(urgentEv.length || broken.length || placesTxt.length || request || prisoners.length);
    const rep = {
      from: cid, writtenAt: t, text: parts.join(' '), decision, request, brokeIds: broken.map(o => o.uid), urgent: urgentEv.length > 0, prisoners: prisoners.length > 0,
      contacts: seen.map(c => Object.assign({}, c, { str: c.str * (1 + enemyBias), src: `${L.name}'s report` })),
      own: ownRecs.map(o => Object.assign({}, o, { str: o.str, srcRep: cid })), places: Object.fromEntries(E.sps.filter(sp => B.places[sp.id]).map(sp => [sp.id, B.places[sp.id]])),
      acks: R.acks.map(o => o.id), lossStated, title: `${L.name}, ${fmtT(t)}`, knownCorps: Object.assign({}, B.knownCorps || {}),
    };
    R.acks = []; R.events = []; R.last = t; R.next = t + rnd.range(CK.REPORT_MIN, CK.REPORT_MAX, 'report interval');
    return rep;
  }
  function cap(s) { return s[0].toUpperCase() + s.slice(1); }
  function nameOf(uid) { const u = E.byId[uid]; return u ? u.name : uid; }
  function ackText(o) {
    const s = o.spec, obj = objName(s);
    const what = s.action === 'attack' ? `to attack ${obj}` : s.action === 'bombard' ? `to bombard ${obj}` : s.action === 'hold' ? 'to hold' : s.action === 'advance' ? `to advance to ${obj}` : s.action === 'withdraw' ? `to fall back on ${obj}` : s.action === 'screen' ? `to watch ${obj}` : s.action === 'rally' ? 'to rally and re-form' : s.action === 'support' ? `to support ${CORPSNAME[s.objective && s.objective.corps] || 'the attack'}` : s.action;
    let how = '';
    if (o.understood && o.understood.form) how = o.understood.form === 'mass' ? ' My divisions will go forward in massed columns.' : o.understood.form === 'attack' ? ' My brigades will go forward in columns of attack.' : o.understood.form === 'line' ? ' I will deploy in line.' : '';
    if (o.understood && o.understood.obj && o.understood.obj !== (s.objective && s.objective.place)) how += ` I take it you mean ${E.objectives[o.understood.obj] ? E.objectives[o.understood.obj].name : o.understood.obj}.`;
    // only an order that has conditions, and is still waiting on them, gets the line about conditions (5e: every order waiting to be passed down got it)
    const when = o.status === 'waiting' && (s.conditions || []).length ? ' I will act when the conditions you set are met.' : '';
    return `I have Your Majesty's order of ${fmtT(o.sentAt)} ${what}.${how}${when}`;
  }
  // a letter of several steps is acknowledged once, in one sentence
  function ackLetter(list) {
    const head = list[0], how = list.map(o => o.understood && o.understood.form ? (o.understood.form === 'mass' ? ' My divisions will go forward in massed columns.' : o.understood.form === 'attack' ? ' My brigades will go forward in columns of attack.' : o.understood.form === 'line' ? ' I will deploy in line.' : '') : '').find(Boolean) || '';
    const mis = list.map(o => o.understood && o.understood.obj && o.understood.obj !== (o.spec.objective && o.spec.objective.place) ? ` I take it you mean ${E.objectives[o.understood.obj] ? E.objectives[o.understood.obj].name : o.understood.obj}.` : '').join('');
    const steps = list.map((o, i) => (i === 0 ? 'first to ' : 'then to ') + (C.describe ? C.describe(o, true) : o.spec.action)).join('; ');
    const waits = list.some(o => (o.spec.conditions || []).length && o.status === 'waiting');
    return `I have Your Majesty's letter of ${fmtT(head.sentAt)}: ${steps}.${how}${mis}${waits ? ' I will take each step as its conditions are met.' : ''}`;
  }
  function ackTexts(acks) {
    const out = [], done = new Set();
    for (const o of acks) {
      if (done.has(o.id)) continue;
      const head = o.carrier ? C.orders.find(x => x.id === o.carrier) : o;
      if (head && head.seq && head.seq.ids) { const list = head.seq.ids.map(id => C.orders.find(x => x.id === id)).filter(Boolean); list.forEach(x => done.add(x.id)); out.push(ackLetter(list)); }
      else { done.add(o.id); out.push(ackText(o)); }
    }
    return out;
  }
  function objName(s) { const ob = s.objective || {}; if (ob.place) return E.objectives[ob.place] ? E.objectives[ob.place].name : ob.place; if (ob.point) { const w = whereIs(ob.point[0], ob.point[1]); return w.startsWith('at ') ? w.slice(3) : 'the ground ' + w; } if (ob.corps) return CORPSNAME[ob.corps]; return 'the objective'; }
  C.objName = objName;
  function sendReport(cid) {
    const rep = writeReport(cid), L = E.leaders[cid];
    const writeMin = rnd.range(...(cid === 'ney' ? CK.WRITE.ney : CK.WRITE.corps), 'report writing');
    const r = { kind: 'report', from: cid, to: 'napoleon', side: 'FR', label: `${L.name}'s report of ${fmtT(E.t)}`, text: rep.text, payload: rep, group: 'g' + C.nextId++ };
    r.onDeliver = rr => receiveReport(rr.payload);
    C.pendingLaunch.push({ at: E.t + writeMin, r });
  }
  C.pendingLaunch = [];
  function receiveReport(rep) {
    const B = C.B.napoleon, src = `${E.leaders[rep.from].name}'s report, ${fmtT(rep.writtenAt)}`;
    const refs = { tids: [], own: [], sp: [], moves: [], corps: rep.from };
    for (const c of rep.contacts) { const old = B.c.get(c.tid), from = old ? [old.x, old.y] : null; mergeContact(B, Object.assign({}, c, { src })); const now = B.c.get(c.tid); refs.tids.push(c.tid); if (from && now && now.src === src && hyp(now.x - from[0], now.y - from[1]) > 400) refs.moves.push({ tid: c.tid, from, to: [now.x, now.y] }); } // sightings carry 25 m + 35 m/km of error, so only a shift of 400 m counts as a move
    for (const o of rep.own) { const old = B.own.get(o.uid), from = old ? [old.x, old.y] : null, st0 = old ? old.status : null; mergeOwn(B, Object.assign({}, o, { src })); const now = B.own.get(o.uid); if (!now || now.gone) continue; refs.own.push(o.uid); if (from && hyp(now.x - from[0], now.y - from[1]) > 150) refs.moves.push({ uid: o.uid, from, to: [now.x, now.y] }); }
    for (const [sp, pl] of Object.entries(rep.places)) { const was = B.places[sp] ? B.places[sp].holder : undefined; mergePlace(B, sp, pl.holder, pl.t, src); if (B.places[sp] && B.places[sp].holder !== was) refs.sp.push(sp); }
    for (const id of rep.acks) { const o = C.orders.find(x => x.id === id); if (o) o.ackedAt = E.t; }
    B.knownCorps = B.knownCorps || {}; for (const [k, v] of Object.entries(rep.knownCorps || {})) if (!B.knownCorps[k]) B.knownCorps[k] = { t: E.t, claim: v.claim };
    // (5e) a report is starred only for news the Emperor does not have yet: a break he did not see from his post, a place changing hands on his map,
    // new troops in the east, a prisoner, an urgent request or doubt, or a call for infantry he has not heard in the last hour
    const xE = W.WM * 0.6, newEast = refs.tids.some(id => { const c = B.c.get(id); return c && (c.side === 'PR' || (!c.side && c.x > xE)) && (B.firstSeen[id] ?? E.t) >= E.t - 1; });
    const newBreak = (rep.brokeIds || []).some(id => !C.sawBreak[id]);
    const req = !!rep.request && E.t - (C.lastRequest[rep.from] ?? -999) > 60; if (req) C.lastRequest[rep.from] = E.t;
    const decision = !!(rep.urgent || rep.prisoners || newBreak || refs.sp.length || newEast || req || (rep.decision && rep.brokeIds == null));
    inbox({ kind: 'report', from: rep.from, title: rep.title, text: rep.text, decision, request: rep.request, writtenAt: rep.writtenAt, refs });
  }
  function reports() {
    for (const cid of REPORTERS) if (reportDue(cid)) sendReport(cid);
    for (const p of C.pendingLaunch.filter(p => E.t >= p.at)) {
      const r = p.r; const n = r.kind === 'order' && C.opts.staff === 'berthier' ? 2 + (rnd('extra rider') < 0.5 ? 1 : 0) : 1;
      for (let i = 0; i < n; i++) launch(Object.assign({}, r, { spread: n > 1 ? (i - (n - 1) / 2) * 700 : 0, onDeliver: r.onDeliver, onLost: r.onLost }));
    }
    C.pendingLaunch = C.pendingLaunch.filter(p => E.t < p.at);
  }
  /* ---------- the duty officer: never more than the silence ceiling without news ---------- */
  function dutyOfficer() {
    if (E.t - C.lastNews < C.opts.silence) return;
    const B = C.B.napoleon, heard = C.heard('napoleon').slice(0, 3);
    const lastBy = REPORTERS.map(id => { const m = [...C.inbox].reverse().find(m => m.kind === 'report' && m.from === id); return m ? `${E.leaders[id].name} at ${fmtT(m.writtenAt)}` : null; }).filter(Boolean);
    const fresh = [...B.c.values()].filter(c => E.t - c.t < 30 && c.src === 'own eyes' && c.side !== 'FR');
    const g = cluster(fresh).filter(g => g.str > 400).slice(0, 3);
    const parts = [`No rider has come in for ${Math.round(E.t - C.lastNews)} minutes.`];
    if (g.length) parts.push('From here we can see ' + g.map(x => describeGroup(x, 0)).join('; ') + '.');
    else parts.push('From here we can see little of the enemy.');
    if (heard.length) parts.push('We hear ' + heard.map(h => `${h.w} to the ${h.dir}`).join(', ') + '.');
    if (lastBy.length) parts.push('Last reports: ' + lastBy.join(', ') + '.');
    inbox({ kind: 'summary', from: 'duty', title: `Duty officer, ${fmtT(E.t)}`, text: parts.join(' '), decision: false, refs: { tids: g.flatMap(x => x.items.map(c => c.tid)), dirs: heard.map(h => SECT.indexOf(h.dir) * 45) } });
  }
  /* ---------- Napoleon notices things from his post ---------- */
  function noticeFromPost() {
    if (!C.notice.length) return;
    const fresh = C.notice.filter(c => c.str > 1500 || c.kind === 'art'); C.notice = [];
    if (!fresh.length) return;
    const groups = cluster(fresh).filter(g => g.str > 1500);
    for (const g of groups) {
      const B = C.B.napoleon, key = Math.round(g.x / 1500) + ',' + Math.round(g.y / 1500);
      if (B.firstSeen['area' + key] && E.t - B.firstSeen['area' + key] < 90) continue; B.firstSeen['area' + key] = E.t;
      seen(`New: ${describeGroup(g, 0)}.`, { tids: g.items.map(c => c.tid), at: [g.x, g.y] });
    }
  }
  function flushSeen() {
    if (C.gunsNow.length) { const g = C.gunsNow.map(x => x.nm), ids = C.gunsNow.map(x => x.id); C.gunsNow = []; seen(`Guns are moving up to open fire: ${g.length > 1 ? g.slice(0, -1).join(', ') + ' and ' + g[g.length - 1] : g[0]}.`, { own: ids }); }
    if (!C.seenNow.length) return;
    const lines = [], lineRefs = [];
    C.seenNow.forEach((l, i) => { const j = lines.indexOf(l), r = C.seenRefs[i]; if (j < 0) { lines.push(l); lineRefs.push(r); } else if (r) lineRefs[j] = mergeRefs(lineRefs[j], r); });
    C.seenNow = []; C.seenRefs = [];
    // (9) the !! alarms in this notice, each placed where it was seen (or where the brigades it names stand)
    const alarm = []; lineRefs.forEach((r, i) => { if (!r || !r.alarm) return; let at = r.at; if (!at) { const us = [...(r.own || []), ...(r.tids || [])].map(id => E.byId[id]).filter(Boolean); if (us.length) at = [us.reduce((a, u) => a + u.x, 0) / us.length, us.reduce((a, u) => a + u.y, 0) / us.length]; } alarm.push({ kind: r.alarm, at: at || null, line: i }); });
    inbox({ kind: 'sight', alarm: alarm.length ? alarm : undefined, title: `Seen from ${C.hq.moving ? 'the saddle' : POSTS[C.hq.post] ? POSTS[C.hq.post].name : 'headquarters'}`, text: lines.join(' '), lines, lineRefs, refs: lineRefs.reduce(mergeRefs, null), decision: lines.some(l => /in the enemy's hands|breaking|Prussian|whose, we cannot tell|charging|Ney is|following Ney|stand on the crest|cleared his crest|wavering/.test(l)) });
  }

  /* ---------- patrols and prisoners ---------- */
  // Light cavalry on a screening task sends patrols out; patrols see what is near their line and sometimes bring back a prisoner.
  C.patrolAt = {};
  function patrols() {
    for (const u of E.units) {
      if (!E.formed(u) || u.type !== 'cav' || u.task.kind !== 'screen') continue;
      if (E.t - (C.patrolAt[u.id] || -999) < CK.PATROL_EVERY) continue; C.patrolAt[u.id] = E.t;
      const area = u.task.area || [u.x, u.y], d = hyp(area[0] - u.x, area[1] - u.y), reach = Math.min(CK.PATROL_RANGE, d + 1500);
      const ux = (area[0] - u.x) / (d || 1), uy = (area[1] - u.y) / (d || 1);
      const px = u.x + ux * reach, py = u.y + uy * reach;
      const enemies = E.units.filter(e => e.onMap && !e.gone && e.str > 0 && (e.side === 'FR') !== (u.side === 'FR') && segD(e.x, e.y, u.x, u.y, px, py) < CK.PATROL_SEE);
      const cid = cmdOf(u), p = posOf(cid), delay = CK.ADC_BASE + (p ? hyp(p[0] - u.x, p[1] - u.y) : 3000) / CK.ADC_SPEED + reach / 300;
      for (const e of enemies) {
        const r = Math.max(400, segD(e.x, e.y, u.x, u.y, px, py));
        if (rnd('patrol sighting') > 0.7 * (e.concealed ? e.concealed * 5 : 1)) continue;
        const rec = sightRecord(e, r, `${u.name}'s patrol`, false, E.t + reach / 300); rec.idLevel = Math.max(rec.idLevel, r < 1200 ? 1 : 0); if (rec.idLevel) { rec.side = e.side; rec.nat = e.nat; }
        for (const c2 of chainFor(u)) C.queue(c2, E.t + delay, B => mergeContact(B, rec));
      }
      // prisoners come from the far end of the patrol's ride, where it meets the enemy's vedettes
      const far = enemies.filter(e => hyp(e.x - px, e.y - py) < CK.PATROL_SEE);
      if (far.length && rnd('prisoner taken') < CK.PATROL_PRISONER) prisoner(u, far[Math.floor(rnd('which prisoner') * far.length)], delay);
    }
  }
  function segD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1); return hyp(px - ax - t * dx, py - ay - t * dy); }
  function prisoner(captor, e, delay) {
    // a prisoner names his corps and, as prisoners will, its strength and orders (rules doc: a prisoner identified Bülow at 13:30)
    const corps = e.corps && CORPSNAME[e.corps] ? e.corps : null;
    const corpsMen = E.units.filter(u => u.corps === e.corps && u.type !== 'art').reduce((a, u) => a + u.str0, 0);
    const claim = corpsMen * (1 + rnd.normal('prisoner exaggerates') * 0.2);
    const text = corps ? `A ${NATWORD[e.nat] || ''} ${e.type === 'cav' ? 'trooper' : 'soldier'} taken by ${captor.name}'s patrol says he belongs to ${CORPSNAME[corps]}, about ${fmtN(roundStr(claim))} men, ${whereIs(e.x, e.y)}.` : `${captor.name}'s patrol has taken a prisoner ${whereIs(e.x, e.y)}.`;
    E.logEvent('event', `${captor.name}'s patrol takes a prisoner from ${e.name}.`, { side: captor.side, unit: captor.id, important: !!corps });
    const cid = cmdOf(captor), at = E.t;
    // a prisoner who is sent on to the Emperor tells his own story there; the corps report only says he was sent (5e: it repeated it)
    const sentOn = captor.side === 'FR' && corps && !(C.B.napoleon.knownCorps && C.B.napoleon.knownCorps[e.corps]) && !C.escorting;
    const corpsText = sentOn ? `${captor.name}'s patrol has taken a ${NATWORD[e.nat] || ''} prisoner ${whereIs(e.x, e.y)}; I have sent him on to Your Majesty.`.replace('a  ', 'a ') : text;
    for (const c2 of chainFor(captor)) C.queue(c2, E.t + delay, B => {
      if (c2 === cid && C.B[cid]) C.flag(cid, { kind: 'prisoner', urgent: true, text: corpsText });
      for (const c of B.c.values()) if (E.byId[c.tid] && E.byId[c.tid].corps === e.corps) { c.corps = e.corps; c.idLevel = 2; c.side = e.side; c.nat = e.nat; }
      const rec = sightRecord(e, 800, 'a prisoner', false, E.t); rec.corps = e.corps; rec.idLevel = 2; rec.side = e.side; rec.nat = e.nat; mergeContact(B, rec);
      B.knownCorps = B.knownCorps || {}; B.knownCorps[e.corps] = { t: E.t, claim };
    });
    if (captor.side === 'FR' && !C.firstPrisoner) C.firstPrisoner = { t: E.t, corps: e.corps };
    // an important prisoner is sent on to the Emperor (as the Prussian hussar was on 18 June)
    if (captor.side === 'FR' && corps && !(C.B.napoleon.knownCorps && C.B.napoleon.knownCorps[e.corps]) && !C.escorting) {
      C.escorting = true;
      const r = { kind: 'escort', from: null, fromPos: [captor.x, captor.y], to: 'napoleon', side: 'FR', label: `a prisoner from ${e.name} under escort`, group: 'p' + C.nextId++ };
      r.onDeliver = () => { C.escorting = false; const B = C.B.napoleon; B.knownCorps = B.knownCorps || {}; if (!B.knownCorps[e.corps]) B.knownCorps[e.corps] = { t: E.t, claim }; for (const c of B.c.values()) if (E.byId[c.tid] && E.byId[c.tid].corps === e.corps) { c.corps = e.corps; c.idLevel = 2; c.side = e.side; c.nat = e.nat; }
        inbox({ kind: 'report', from: 'prisoner', title: `A prisoner, taken at ${fmtT(at)}`, text: `${text} He is brought before Your Majesty.`, decision: true, writtenAt: at, refs: { tids: [...B.c.values()].filter(c => c.corps === e.corps).map(c => c.tid), at: [e.x, e.y], enemyCorps: e.corps } }); };
      r.onLost = () => { C.escorting = false; };
      C.pendingLaunch.push({ at: E.t + delay * 0.5, r });
    }
  }
  C.prisoner = prisoner;

  /* ---------- the tick ---------- */
  C.intel = {};
  function intel() {
    const B = C.B.napoleon, I = C.intel, xE = E.ll2m(50.68, 4.445)[0];
    if (I.eastSeen == null && [...B.c.values()].some(c => (c.side === 'PR' || !c.side) && c.x > xE && c.str > 1000)) I.eastSeen = E.t;
    if (I.bulowNamed == null && B.knownCorps && B.knownCorps.bulow) I.bulowNamed = E.t;
    if (I.prisoner == null && C.firstPrisoner) I.prisoner = C.firstPrisoner.t;
    // when Napoleon first believes La Haye Sainte or Hougoumont is his, or Plancenoit is lost to the Prussians
    for (const [sp, h] of [['lhs', 'FR'], ['hougoumont', 'FR'], ['plancenoit', 'AL']]) { const k = sp + 'Known', pb = B.places[sp]; if (I[k] == null && pb && pb.holder === h) I[k] = E.t; }
  }
  for (const sp of E.sps) sp.holder0 = sp.holder;
  /* ---------- the game starts at 11:00 with the morning's knowledge (not used by the replay or the calibration) ---------- */
  C.noteOwn = (u, src) => { C.B.napoleon.own.set(u.id, ownRecord(u, src, E.t)); };
  C.morningLook = function () {
    // Napoleon knows his own army as it stood at 11:00, and what he and his staff saw of the enemy line from La Belle Alliance that morning
    const B = C.B.napoleon, p = E.ll2m(...POSTS.ba.at);
    for (const u of E.units) if (u.side === 'FR' && u.onMap && !u.gone) B.own.set(u.id, ownRecord(u, 'the morning state', E.t));
    for (const e of E.units) {
      if (!e.onMap || e.gone || e.str <= 0 || e.side === 'FR') continue;
      const r = hyp(e.x - p[0], e.y - p[1]); if (r > 6000) continue;
      const l = E.los(p[0], p[1], 2.5, e.x, e.y, (e.type === 'cav' ? 2.6 : e.type === 'gar' ? 4 : 1.8) + (e.heightBonus || 0)); if (!l.clear) continue;
      if (rnd('morning look') >= E.detectP(r / CK.TELESCOPE, l.trans, e.type === 'art' ? e.str * 15 : e.str) * (e.concealed ?? 1)) continue;
      mergeContact(B, sightRecord(e, r, 'the morning reconnaissance', true, E.t));
    }
  };
  C.tick = function () {
    if (E.tick % 2 === 0) intel();
    // deliveries into belief records
    for (const B of Object.values(C.B)) { if (!B.pending.length) continue; const due = B.pending.filter(p => E.t >= p.at); B.pending = B.pending.filter(p => E.t < p.at); for (const p of due) p.fn(B); }
    if (E.tick % 5 === 0) ownReports();
    for (const cid of EYE_LIST) if (cid === 'napoleon' ? E.tick % 2 === 0 : E.tick % 3 === 1) eyes(cid);
    placeWatch();
    sound(); soundAlerts();
    patrols();
    if (C.script) C.script();
    if (C.orderTick) C.orderTick();
    reports();
    moveRiders();
    if (E.tick % 2 === 0) conspicuous();
    noticeFromPost(); flushSeen();
    dutyOfficer();
    if (C.hqTick) C.hqTick();
  };
  return C;
}

root.WCommand = { install, CK, POSTS, CORPS_CMD, CORPSNAME, cmdOf, COMMANDERS, NATWORD };
if (typeof module !== 'undefined' && module.exports) module.exports = root.WCommand;
})(typeof globalThis !== 'undefined' ? globalThis : this);
