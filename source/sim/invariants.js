// The umpire's own audit: fight battles and check the true state after every tick for things that should be impossible.
// Modes: 'hist' (Napoleon's own orders), 'chaos' (a player giving random legal orders at random times), 'idle' (no orders).
// A chaos battle is also fought twice to check it is deterministic. Each finding names the seed and minute so it can be replayed.
const R = require('./replay.js'), Scr = require('./script.js'), Ord = require('./orders.js'), W = require('./data.js');
const TASKS = new Set(['hold', 'attack', 'support', 'rally', 'move', 'march', 'bombard', 'cavRaid', 'charge', 'garrison', 'garrisonGo', 'pursue', 'screen', 'retire', 'rearguard']);
const STATUS = new Set(['steady', 'shaken', 'disordered', 'broken']);
const OSTAT = new Set(['writing', 'queued', 'riding', 'received', 'waiting', 'interpreting', 'acting', 'done', 'lost', 'cancelled', 'carried', 'superseded']);
const fin = v => typeof v === 'number' && Number.isFinite(v);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// a chaos player: every 20-70 minutes, a few random legal orders (its own dice, not the battle's)
function chaosPlayer(seed) {
  const r = mulberry(seed * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
  const TO = ['ney', 'reille', 'derlon', 'lobau', 'drouot', 'milhaud', 'kellermann', 'grandBattery', 'grouchy', 'hq', 'army'];
  const PLACES = ['hougoumont', 'lhs', 'papelotte', 'lahaye', 'smohain', 'frischermont', 'plancenoit', 'ridgeWest', 'ridgeRightCentre', 'ridgeCentre', 'ridgeEast', 'ridgeLeft', 'msj', 'ba', 'rossomme', 'eastFlank', 'boisDeParis', 'lasne', 'depOwn'];
  let next = 0, log = [], made = {};
  return {
    log,
    act(E) {
      if (E.t < next) return;
      next = E.t + 20 + Math.floor(r() * 50);
      const C = E.command, n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        if (r() < 0.04 && E.t < 20 * 60) { const s = { to: 'army', action: 'retreat', rearguard: pick(['drouot', 'lobau', null]) }; const res = C.order(s); log.push({ t: E.t, spec: s, ok: res.ok }); continue; }
        const to = pick(TO.filter(x => x !== 'army')), kind = C.RECIPIENTS[to].kind, acts = C.ALLOWED[kind].filter(a => a !== 'retreat'), action = pick(acts);
        const s = { to, action, conditions: [], manner: {} };
        if (['advance', 'attack', 'bombard', 'screen', 'withdraw', 'observe'].includes(action)) s.objective = r() < 0.15 ? { point: [1000 + r() * 8000, 1000 + r() * 6000] } : { place: pick(PLACES) };
        if (action === 'support') s.objective = { corps: pick(['reille', 'derlon', 'lobau', 'drouot', 'milhaud', 'kellermann']) };
        if (action === 'sector') { s.sector = pick(['left', 'centre', 'right', 'whole', 'none']); if (r() < 0.6) s.goal = pick(PLACES.filter(p => p !== 'depOwn')); }
        if (action === 'moveHQ') s.post = pick(['caillou', 'rossomme', 'ba', 'knoll']);
        if (action === 'detach') { const us = E.units.filter(u => u.side === 'FR' && E.formed(u) && E.command.cmdOf(u) === to); if (!us.length) continue; s.with = [pick(us).id]; s.detachTo = pick(['reille', 'derlon', 'lobau', 'drouot', 'milhaud', 'kellermann'].filter(x => x !== to)); }
        if (r() < 0.3) s.manner.losses = pick(['light', 'normal', 'heavy', 'any']);
        if (r() < 0.2) s.manner.formation = pick(['attack', 'mass', 'line', 'columns']);
        if (r() < 0.15) s.urgent = true;
        if (r() < 0.25) s.conditions.push(pick([{ type: 'time', after: E.t + 30 }, { type: 'place', sp: pick(['hougoumont', 'lhs', 'plancenoit']), holder: pick(['FR', 'AL']) }, { type: 'bombard', by: 'grandBattery', target: pick(PLACES), minutes: 30 }]));
        let res;
        if (r() < 0.15 && !['hq', 'grouchy', 'ney'].includes(to)) res = C.orderSeq([s, Object.assign({}, s, { action: pick(acts.filter(a => a !== 'detach')), conditions: [{ type: 'after', step: 0, when: 'start', minutes: 30 }] })]);
        else res = C.order(s);
        log.push({ t: E.t, spec: s, ok: res.ok, err: res.error });
        if (res.ok && r() < 0.08) C.cancel(res.order);
      }
    },
  };
}

function check(E, prev, out, ctx) {
  // each distinct finding once per battle (the first minute it appears), keyed by its words with the numbers taken out
  const seen = ctx.seen || (ctx.seen = new Set());
  const v = (what, extra) => { const key = what.replace(/-?\d+(\.\d+)?/g, '#'); if (seen.has(key) || out.length >= 400) return; seen.add(key); out.push(Object.assign({ seed: ctx.seed, mode: ctx.mode, scen: ctx.scen, t: E.fmtT(E.t), what }, extra || {})); };
  for (const s of ['FR', 'AL', 'PR']) if (!fin(E.morale[s]) || E.morale[s] < 0 || E.morale[s] > 100) v(`army morale ${s} = ${E.morale[s]}`);
  for (const u of E.units) {
    const p = prev.get(u.id);
    if (u.onMap && !u.gone) {
      for (const k of ['x', 'y', 'str', 'coh', 'fatigue', 'ammo', 'facing']) if (!fin(u[k])) v(`${u.id}.${k} not a number (${u[k]})`, { unit: u.id });
      if (u.x < -5 || u.x > W.WM + 5 || u.y < -5 || u.y > W.HM + 5) v(`${u.id} off the map at ${Math.round(u.x)},${Math.round(u.y)}`, { unit: u.id });
      if (!STATUS.has(u.status)) v(`${u.id} status ${u.status}`, { unit: u.id });
      if (!u.task || !TASKS.has(u.task.kind)) v(`${u.id} task ${u.task && u.task.kind}`, { unit: u.id });
      if (u.status !== 'broken' && u.str > 0 && u.coh < 0 && p && p.coh < 0) v(`${u.id} formed with cohesion ${Math.round(u.coh)} for two ticks`, { unit: u.id, kind: 'negcoh' });
      if (u.coh > (u.cohMax ?? 100) + 0.5) v(`${u.id} cohesion ${u.coh.toFixed(1)} above its cap ${u.cohMax}`, { unit: u.id });
      if (u.path) for (const q of u.path) if (!q || !fin(q[0]) || !fin(q[1])) { v(`${u.id} path has a bad point`, { unit: u.id }); break; }
      if (u.status === 'broken' && u.spId) v(`${u.id} broken but still garrisoning ${u.spId}`, { unit: u.id });
      if (p && p.onMap && !p.gone && Math.hypot(u.x - p.x, u.y - p.y) > (u.type === 'cav' ? 900 : 600)) v(`${u.id} jumped ${Math.round(Math.hypot(u.x - p.x, u.y - p.y))} m in one tick (${u.task.kind})`, { unit: u.id, kind: 'jump' });
      if (u.type === 'art' && !fin(u.rounds)) v(`${u.id} rounds ${u.rounds}`, { unit: u.id });
    }
    for (const k of ['killed', 'wounded', 'captured', 'stragglers']) { if (!fin(u[k]) || u[k] < -0.01) v(`${u.id}.${k} = ${u[k]}`, { unit: u.id }); else if (p && u[k] < p[k] - 0.01) v(`${u.id}.${k} went down ${p[k].toFixed(0)}→${u[k].toFixed(0)}`, { unit: u.id }); }
    if (u.str < -0.01) v(`${u.id} strength ${u.str}`, { unit: u.id });
    if (u.str > u.str0 + 1) v(`${u.id} strength ${Math.round(u.str)} above its start ${Math.round(u.str0)}`, { unit: u.id });
  }
  for (const sp of E.sps) {
    if (![null, undefined, 'FR', 'AL'].includes(sp.holder)) v(`${sp.id} holder ${sp.holder}`);
    if (sp.garrison) { const g = E.byId[sp.garrison]; if (!g || g.spId !== sp.id) v(`${sp.id} garrison ${sp.garrison} is not in it`, { kind: 'garrison' }); else if (!E.formed(g)) v(`${sp.id} garrison ${g.id} is not formed (${g.status})`, { kind: 'garrison' }); }
    if (sp.holder && !sp.secs.some(s => s.held === sp.holder)) v(`${sp.id} held by ${sp.holder} with no section held`, { kind: 'holder' });
  }
  for (const u of E.units) if (u.spId && E.formed(u)) { const sp = E.spById[u.spId]; if (!sp || sp.garrison !== u.id) v(`${u.id} thinks it garrisons ${u.spId}, whose garrison is ${sp && sp.garrison}`, { unit: u.id, kind: 'garrison' }); }
  const C = E.command;
  if (C) {
    for (const o of C.orders) { if (!OSTAT.has(o.status)) v(`order ${o.id} status ${o.status}`); if (o.status === 'writing' && o.writtenAt != null && E.t > o.writtenAt + 10 && !C.hq.moving) v(`order ${o.id} to ${o.to} still being written ${Math.round(E.t - o.writtenAt)} min after it was due`, { kind: 'stuckOrder' }); }
    for (const r of C.riders) if (r.status === 'riding') { if (!fin(r.x) || !fin(r.y)) v(`rider ${r.id} position not a number`); if (!r.offmapAt && E.t - r.leftAt > 180) v(`rider ${r.id} (${r.label}) riding for ${Math.round(E.t - r.leftAt)} min`, { kind: 'stuckRider' }); }
  }
}
// units that should be moving and have not moved for an hour (warnings: some are blocked for real reasons)
function stuckWatch(E, st, out, ctx) {
  for (const u of E.units) {
    if (!E.formed(u) || !u.path || !u.path.length || !['move', 'march', 'retire', 'rearguard', 'garrisonGo'].includes(u.task.kind) || u.task.wait || u.halted) { st.delete(u.id); continue; }
    if (E.chokes.some(ch => Math.hypot(u.x - ch.x, u.y - ch.y) < ch.r + 400)) { st.delete(u.id); continue; } // queueing for the Lasne crossing is by design
    const s = st.get(u.id); if (!s || Math.hypot(u.x - s.x, u.y - s.y) > 30) { st.set(u.id, { x: u.x, y: u.y, t: E.t }); continue; }
    if (E.t - s.t >= 60 && !s.told) { s.told = true; out.push({ seed: ctx.seed, mode: ctx.mode, scen: ctx.scen, t: E.fmtT(E.t), what: `${u.id} (${u.task.kind}, ${u.form}) has not moved for an hour with ${u.path.length} waypoints left`, unit: u.id, kind: 'stuck', warn: true }); }
  }
}
function fight(seed, mode, scen, history) {
  const ctx = { seed, mode, scen }, out = [], prev = new Map(), st = new Map();
  let E, chaos = null;
  try {
    E = R.setup({ seed, history: history || 'uncertain', scenario: scen, staff: seed % 2 ? 'soult' : 'berthier', silence: 0 });
    if (mode === 'hist') Scr.historical(E); else if (mode === 'chaos') chaos = chaosPlayer(seed);
    let guard = 0;
    while (!E.over && guard++ < 2000) {
      if (chaos) chaos.act(E);
      for (const u of E.units) prev.set(u.id, { x: u.x, y: u.y, coh: u.status !== 'broken' ? u.coh : 99, onMap: u.onMap, gone: u.gone, killed: u.killed, wounded: u.wounded, captured: u.captured, stragglers: u.stragglers });
      E.step(); check(E, prev, out, ctx); stuckWatch(E, st, out, ctx);
    }
    if (!E.over) out.push({ seed, mode, scen, what: 'battle never ended', t: E.fmtT(E.t) });
  } catch (err) { out.push({ seed, mode, scen, t: E ? E.fmtT(E.t) : '-', what: 'EXCEPTION ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err), kind: 'exception' }); }
  return { out, E, chaos };
}
// the state of a finished battle, condensed, for the determinism check
function fingerprint(E) { return JSON.stringify([E.t, E.result && E.result.grade, E.morale, E.units.map(u => [u.id, Math.round(u.x), Math.round(u.y), Math.round(u.str), Math.round(u.coh)])]); }

if (require.main === module) {
  const [mode, from, n, scen, history] = [process.argv[2] || 'chaos', +(process.argv[3] || 1), +(process.argv[4] || 10), process.argv[5] || '1100', process.argv[6] || 'uncertain'];
  const all = []; let det = 0, detFail = [];
  for (let s = from; s < from + n; s++) {
    const a = fight(s, mode, scen, history); all.push(...a.out);
    if (mode === 'chaos' && s % 5 === 0 && a.E) { const b = fight(s, mode, scen, history); det++; if (!b.E || fingerprint(a.E) !== fingerprint(b.E)) detFail.push(s); }
  }
  console.log(JSON.stringify({ mode, scen, history, from, n, findings: all, determinism: { checked: det, failed: detFail } }));
}
module.exports = { fight, chaosPlayer, check };
