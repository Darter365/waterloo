/* Agent playtests (docs/METHOD.md, section 6): a headless battle that an agent plays through one view, a stop at a time.

     node tools/agentplay.js new <dir> [--battle waterloo] [--seed 1815] [--view chief|truth] [--scenario 1100]
                                       [--history uncertain] [--staff soult] [--silence 45]
         set the battle up and write the first turn (the briefing, the order menu and the picture at the start)
     node tools/agentplay.js next <dir> [orders.json] [--until HH:MM] [--full]
         give the orders in the file at the present stop, run to the next stop and write the next turn
     node tools/agentplay.js menu <dir>
         the order builder's menu again: who can be ordered to do what, the places, the posts, the shape of an order
     node tools/agentplay.js umpire <dir> --out <dir2>
         after the battle: fight it again from the saved replay and write the umpire's record (truth and causes) to dir2
     node tools/agentplay.js verify <dir>
         fight the saved replay again and say whether it ends on the same state as the battle that was played

   The views (view.js is the only source for what a view may know):
     chief  Napoleon's view. Each turn is built from V.snapshot('chief') and V.drain('chief') and nothing else. The code that writes
            a chief turn is handed plain data, never the engine; the driver touches the engine only to step it, to check an order
            against the order builder (validate: fixed tables, no state) and to give it. tools/test_agentplay.js fails if any truth
            reaches a chief turn: it fights the same battle twice, and in one of them moves, doubles and breaks every unit, flips
            every place and rewrites army morale whenever the harness is looking. The turns must be byte for byte the same.
     truth  the umpire's picture at each stop, for an agent that plays knowing everything (can a plan be dominant?).
   The umpire's record is written after the battle from the replay, for judging the engine: what was true at each of the player's
   stops against what he believed, every order's real history, the log with its causes.

   Orders are the order builder's own specs (orders.js), in a JSON array. Each entry is one of
     { "to": "reille", "action": "attack", "objective": { "place": "hougoumont" }, ... }   one order
     { "seq": [ spec, spec, ... ] }                                                          one letter of several steps
     { "cancel": "o12" }                                                                     tear up an order still being written
   An order the builder refuses is reported with the builder's own reason and is not logged.

   A stop (my choices, est.; the game page's own stops need the ★ and !! marks, which the contract does not carry):
     - fifteen minutes after the first dispatch to come in since the last stop, so riders arriving together make one stop;
     - or sixty minutes with no dispatch at all;
     - or the minute given with --until, which rides on through any dispatches;
     - or the end of the battle.
   In the chief's view the stop is decided from his own event stream alone, so when the clock stops tells him nothing new.

   The session folder holds session.json (settings, order log, stops), turn-NNN.txt and turn-NNN.json, and at the end replay.json:
   the same replay file tools/replay.js reads (settings and order log), with the result and the final state hash. Every call fights
   the battle again from the start with the logged orders, which is exact because the engine is deterministic (rule 6). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const SIM = path.join(__dirname, '..');
const R = require(path.join(SIM, 'replay.js')), View = require(path.join(SIM, 'view.js')), St = require(path.join(SIM, 'stakes.js')), P = require(path.join(SIM, 'packs', 'all.js'));

const GATHER = 15, MAXRUN = 60;   // (est.) minutes: see "A stop" above. GATHER is the game page's own figure for ordinary news
const COLS = 72;                  // width of the sketch map in characters
const hm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t) % 60).padStart(2, '0')}`;
const unhm = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s); if (!m) throw new Error(`not a time: ${s} (use HH:MM)`); return +m[1] * 60 + +m[2]; };
const clone = x => JSON.parse(JSON.stringify(x));
const num = n => Math.round(n).toLocaleString('en-GB');
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const bearingOf = (dx, dy) => (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; // north is up the map: y grows southward
const compass = b => COMPASS[Math.round(b / 45) % 8];

// the reference battles' hash (refset.js, tools/test_view.js): every unit, army morale, every place, and the number of dice drawn
function stateHash(E) {
  const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
  const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
  const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0);
  return crypto.createHash('sha1').update(JSON.stringify([E.t, E.morale, units, places, dice])).digest('hex').slice(0, 16);
}

/* ---------- what is fixed before the battle: the order builder's tables and the briefing (no battle state) ---------- */
const strip = html => String(html || '').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').split('\n').map(s => s.trim()).filter(Boolean).join('\n');
function menuOf(E, settings) {
  const C = E.command, B = P.battle(E.battleId).battle, start = ((B.game || {}).starts || {})[settings.scenario] || {};
  return clone({
    battle: B.name, side: C.side, commander: C.X.chief,
    brief: strip(start.brief), stakes: B.stakes ? B.stakes.brief : null,
    recipients: Object.entries(C.RECIPIENTS).map(([id, r]) => ({ id, name: r.name, kind: r.kind, actions: C.ALLOWED[r.kind] })),
    actions: C.ACTIONS,
    objectives: Object.values(E.objectives).map(o => ({ id: o.id, name: o.name, x: o.point ? Math.round(o.point[0]) : null, y: o.point ? Math.round(o.point[1]) : null, line: !!o.line && !o.sp })),
    posts: Object.entries(C.POSTS).map(([id, p]) => ({ id, name: p.name, note: p.note || null })),
    sectors: Object.entries(C.SECTORS).map(([id, corps]) => ({ id, corps })),
    rearguards: C.RETREAT_TO,
  });
}
function menuText(M) {
  const L = [];
  L.push(`THE ORDER MENU (${M.battle}; you command as ${M.commander}, side ${M.side})`, '');
  L.push('Who can be ordered, and to do what (the id is what an order names):');
  for (const r of M.recipients) L.push(`  ${r.id.padEnd(13)} ${r.name}: ${r.actions.join(', ')}`);
  L.push('', 'What each action means: ' + Object.entries(M.actions).map(([k, v]) => `${k} = "${v}"`).join('; '));
  L.push('', 'Places an order can name as its objective (id, name, map position in metres; "line" is a stretch of ridge):');
  for (const o of M.objectives) L.push(`  ${o.id.padEnd(17)} ${o.name}${o.x != null ? ` (${o.x}, ${o.y})` : ''}${o.line ? ' [line]' : ''}`);
  L.push('', 'Posts for headquarters (moveHQ): ' + M.posts.map(p => `${p.id} = ${p.name}${p.note ? ' (' + p.note + ')' : ''}`).join('; '));
  if (M.sectors.length) L.push('Sectors a marshal can be given (sector): ' + M.sectors.map(s => `${s.id} [${s.corps.join(', ')}]`).join('; ') + '; none = take command back');
  L.push('', 'The shape of an order (JSON). Only "to" and "action" are always needed:');
  L.push('  { "to": id, "action": id,');
  L.push('    "objective": { "place": objective id } or { "point": [x, y] } or { "corps": recipient id } (support),');
  L.push('    "with": [own brigade ids],            only these brigades (default: the whole command)');
  L.push('    "manner": { "formation": "line" | "columns" | "attack" | "mass", "losses": "light" | "normal" | "heavy" | "any",');
  L.push('                "bring": ["guns", "sappers"], "site": objective id or "here" (where guns stand to bombard) },');
  L.push('    "conditions": [ { "type": "time", "after": minutes since midnight }, { "type": "place", "sp": place id, "holder": coalition },');
  L.push('                    { "type": "bombard", "by": recipient id, "minutes": n }, { "type": "after", "order": order id, "when": "done", "minutes": n } ],');
  L.push('    "urgent": true,                       written in half the time, less clearly');
  L.push('    "post": post id (moveHQ), "sector": sector id and "goal": objective id (sector), "detachTo": recipient id (detach),');
  L.push('    "rearguard": recipient id (retreat, given to "army") }');
  L.push('  advance, attack, bombard, screen, withdraw and observe need an objective. Each condition and each manner makes an order less clear.');
  L.push('  A file of orders is a JSON array of such orders; { "seq": [order, order] } is one letter of several steps for one commander;');
  L.push('  { "cancel": "o12" } tears up an order that is still being written.');
  return L.join('\n');
}

/* ---------- a chief turn: written from the contract's plain data alone (this function is never handed the engine) ---------- */
function nearText(world, x, y) {
  let best = null;
  for (const p of world.places.concat(world.objectives.filter(o => o.x != null))) { const d = Math.hypot(x - p.x, y - p.y); if (!best || d < best.d) best = { d, p }; }
  if (!best) return `(${Math.round(x)}, ${Math.round(y)})`;
  return best.d < 150 ? `at ${best.p.name}` : `${Math.round(best.d / 50) * 50} m ${compass(bearingOf(x - best.p.x, y - best.p.y))} of ${best.p.name}`;
}
const xy = o => `(${Math.round(o.x)}, ${Math.round(o.y)})`;
// a sketch of the map as the viewer has it: own troops in lower case, the enemy in capitals, places as digits
function sketch(world, own, enemy, hq) {
  const W = world.size.w, H = world.size.h, rows = Math.max(8, Math.round(COLS * H / W / 2)), g = Array.from({ length: rows }, () => Array(COLS).fill('.'));
  const put = (x, y, ch, force) => { const c = Math.floor(x / W * COLS), r = Math.floor(y / H * rows); if (c < 0 || r < 0 || c >= COLS || r >= rows) return; if (force || g[r][c] === '.' || /[0-9a-z]/.test(g[r][c]) && /[A-Z?]/.test(ch) || /[0-9]/.test(g[r][c])) g[r][c] = ch; };
  const legend = []; world.places.forEach((p, i) => { const ch = String(i % 10); put(p.x, p.y, ch); legend.push(`${ch}=${p.name}`); });
  for (const u of own) if (!u.gone) put(u.x, u.y, u.arm === 'cav' ? 'c' : u.arm === 'art' ? 'g' : 'i');
  for (const e of enemy) put(e.x, e.y, e.kind === 'cav' ? 'C' : e.kind === 'art' ? 'G' : e.kind === 'inf' || e.kind === 'gar' ? 'I' : '?');
  if (hq) put(hq.x, hq.y, '@', true);
  return g.map(r => '  ' + r.join('')).join('\n') + `\n  north is up; the map is ${num(W)} m wide and ${num(H)} m deep; (x, y) are metres from the top-left corner\n  i c g = your foot, horse, guns   I C G ? = the enemy   @ = you   ` + legend.join(' ');
}
function eventLines(world, events) {
  const seen = {}, heard = {};
  for (const e of events) {
    if (e.kind === 'dispatch') continue;
    if (e.seen) { const k = `${e.kind}|${e.side || '?'}|${e.place ? 'at ' + ((world.places.find(p => p.id === e.place) || {}).name || e.place) : nearText(world, e.x, e.y)}`; const s = seen[k] || (seen[k] = { n: 0, t0: e.t, t1: e.t }); s.n++; s.t1 = e.t; }
    else { const k = `${e.kind}|${compass(e.bearing)}`; const h = heard[k] || (heard[k] = { n: 0, loud: 0, t0: e.t, t1: e.t }); h.n++; h.loud = Math.max(h.loud, e.loud || 0); h.t1 = e.t; }
  }
  const L = [];
  for (const [k, s] of Object.entries(seen).sort((a, b) => b[1].n - a[1].n).slice(0, 14)) { const [kind, side, where] = k.split('|'); L.push(`  seen: ${kind} (${side}) ${where}${s.n > 1 ? `, ${s.n} times ${hm(s.t0)} to ${hm(s.t1)}` : ` at ${hm(s.t0)}`}`); }
  for (const [k, h] of Object.entries(heard).sort((a, b) => b[1].n - a[1].n).slice(0, 10)) { const [kind, dir] = k.split('|'); L.push(`  heard, not seen: ${kind} to the ${dir}, ${h.n} time${h.n > 1 ? 's' : ''} ${hm(h.t0)} to ${hm(h.t1)}, loudest ${h.loud}`); }
  return L;
}
function chiefTurn(d) {
  const { world, snapshot: S, events, dispatches, receipts, menu, turn, since, full, after } = d, L = [], t = S.t;
  L.push(`NAPOLEON'S VIEW · ${menu.battle} · turn ${turn} · ${S.clock}${S.over ? ' · THE BATTLE IS OVER' : ''}`);
  L.push('Everything below is what you have been told, have seen or have heard. Reports are as old as their times say.');
  if (turn === 0) {
    L.push('', 'THE SITUATION', menu.brief || '(no briefing)', '', menu.stakes || '', '', menuText(menu));
    const marks = (world.landmarks || []).map(m => `${m.n} (${Math.round(m.x)}, ${Math.round(m.y)})`).concat((world.villages || []).filter(v => v.cx != null).map(v => `${v.n} (${Math.round(v.cx)}, ${Math.round(v.cy)})`));
    if (marks.length) L.push('', 'Landmarks and villages a dispatch may name: ' + marks.join('; '));
  }
  L.push('', `You are ${S.at.post ? 'at ' + ((menu.posts.find(p => p.id === S.at.post) || {}).name || S.at.post) : 'in the saddle'} ${xy(S.at)}${S.at.moving ? ', headquarters on the move' : ''}. Sun ${S.light.sun}° up, bearing ${S.light.bearing}°; a man can see about ${num(S.light.seeing)} m${S.light.damp ? '; the air is damp' : ''}. Ground wet ${S.ground.wet}; wind from ${S.wind.dir}° at ${S.wind.speed}.`);
  if (receipts && receipts.length) { L.push('', `ORDERS YOU GAVE AT ${hm(since)}`); for (const r of receipts) L.push(r.ok ? `  accepted: ${r.orders.map(o => `[${o.id}] ${o.text}`).join(' | ')}${r.note ? ' (' + r.note + ')' : ''}` : `  REFUSED: ${r.error}  <- ${JSON.stringify(r.entry)}`); }
  L.push('', turn === 0 ? 'DISPATCHES' : `DISPATCHES SINCE ${hm(since)} (${dispatches.length})`);
  for (const m of dispatches) L.push(`  [${hm(m.t)}] ${m.kind}${m.title ? ' · ' + m.title : ''}: ${m.text || ''}`);
  if (!dispatches.length) L.push('  none');
  const ev = eventLines(world, events);
  if (ev.length) { L.push('', `SEEN AND HEARD FROM WHERE YOU STAND SINCE ${hm(since)}`); L.push(...ev); }
  if (S.heard.length) L.push('', 'THE SOUND OF THE FIELD NOW: ' + S.heard.map(h => `${h.words} to the ${h.dir}`).join('; '));
  if (S.riders.length) L.push('', `${S.riders.length} rider${S.riders.length > 1 ? 's' : ''} in sight, coming in.`);
  L.push('', 'YOUR ORDERS (as far as you know)');
  for (const o of S.orders) L.push(`  [${o.id}] ${o.text} · ${o.state}, given ${hm(o.issuedAt)}${o.ackedAt != null ? ', acknowledged ' + hm(o.ackedAt) : ''}`);
  if (!S.orders.length) L.push('  none given');
  L.push('', 'YOUR ARMY AS LAST REPORTED');
  const by = {}; for (const u of S.own) (by[u.corps || '-'] = by[u.corps || '-'] || []).push(u);
  for (const [corps, us] of Object.entries(by)) {
    const live = us.filter(u => !u.gone), str = live.reduce((a, u) => a + u.str, 0), states = {}, tasks = {};
    for (const u of live) { states[u.state || '?'] = (states[u.state || '?'] || 0) + 1; tasks[u.task || '?'] = (tasks[u.task || '?'] || 0) + 1; }
    const cx = live.reduce((a, u) => a + u.x, 0) / (live.length || 1), cy = live.reduce((a, u) => a + u.y, 0) / (live.length || 1), newest = Math.max(...us.map(u => u.reportedAt ?? u.seenAt));
    L.push(`  ${corps}: ${live.length} bodies, ${num(str)} men${live.some(u => u.arm === 'art') ? ' and guns' : ''}, centred ${live.length ? nearText(world, cx, cy) : '-'}; ${Object.entries(states).map(([k, v]) => `${v} ${k}`).join(', ')}; doing: ${Object.entries(tasks).map(([k, v]) => `${v} ${k}`).join(', ')}; newest report ${hm(newest)}${us.length - live.length ? `; ${us.length - live.length} gone` : ''}`);
    for (const u of us) if (full || turn === 0 || (u.reportedAt ?? u.seenAt) > since) L.push(`      ${u.id} ${u.name} ${u.arm} ${num(u.str)}${u.arm === 'art' ? ' guns' : ''} ${u.state || '?'} ${u.task || '?'}${u.form ? ' ' + u.form : ''} ${nearText(world, u.x, u.y)} ${xy(u)}${u.place ? ' in ' + u.place : ''}${u.gone ? ' GONE' : ''} · reported ${hm(u.reportedAt ?? u.seenAt)} (${u.src})`);
  }
  if (!full && turn > 0) L.push('  (brigades are listed only where a report has come since the last stop; --full lists all)');
  L.push('', `THE ENEMY AS LAST SEEN (${S.enemy.length} bodies; ages matter)`);
  for (const e of S.enemy.slice().sort((a, b) => b.seenAt - a.seenAt)) L.push(`  ${e.key} ${e.identified ? (e.nation || e.side || '') + (e.corps ? ' ' + e.corps : '') : 'unidentified'} ${e.kind} about ${num(e.str)}${e.guns ? ` with ${e.guns} guns` : ''}${e.form ? ' ' + e.form : ''}${e.status ? ' ' + e.status : ''}${e.moving ? ' moving, heading ' + e.facing + '°' : ''} ${nearText(world, e.x, e.y)} ${xy(e)}${e.place ? ' holding ' + e.place : ''} · seen ${hm(e.seenAt)}, ${Math.round(t - e.seenAt)} min ago (${e.src})`);
  L.push('', 'WHO HOLDS THE PLACES (as far as you know): ' + S.places.map(p => `${(world.places.find(q => q.id === p.id) || {}).name || p.id} ${p.holder || 'nobody'} (${hm(p.knownAt)})`).join('; '));
  L.push('', 'SKETCH MAP', sketch(world, S.own, S.enemy, S.at));
  if (after) { L.push('', 'AFTER THE BATTLE (the field is over, so the result is known)', `  ${after.grade} (${after.why}) at ${hm(after.t)}`); if (after.verdict) L.push(`  The campaign: ${after.verdict.tierName} · ${after.verdict.title} · ${after.verdict.score}/100. ${after.verdict.text}`); if (after.cas) L.push('  Losses, killed and wounded / taken: ' + Object.entries(after.cas).map(([s, c]) => `${s} ${num(c.kw)} / ${num(c.cap)}`).join('; ')); }
  else L.push('', 'Write your orders (or none) and call next. --until HH:MM rides on to that minute whatever comes in.');
  return L.join('\n') + '\n';
}

/* ---------- a truth turn: the umpire's picture, from the contract's truth snapshot and events ---------- */
function truthTurn(d) {
  const { world, snapshot: S, events, receipts, menu, turn, since, after } = d, L = [];
  L.push(`THE UMPIRE'S VIEW (the truth) · ${menu.battle} · turn ${turn} · ${S.clock}${S.over ? ' · THE BATTLE IS OVER' : ''}`);
  if (turn === 0) L.push('', 'THE SITUATION', menu.brief || '', '', menu.stakes || '', '', menuText(menu));
  if (receipts && receipts.length) { L.push('', `ORDERS GIVEN AT ${hm(since)}`); for (const r of receipts) L.push(r.ok ? `  accepted: ${r.orders.map(o => `[${o.id}] ${o.text}`).join(' | ')}` : `  REFUSED: ${r.error}  <- ${JSON.stringify(r.entry)}`); }
  L.push('', 'Army morale: ' + Object.entries(S.morale).map(([s, m]) => `${s} ${m}`).join(', ') + `. Seeing ${num(S.light.seeing)} m.`);
  L.push('', `WHAT HAPPENED SINCE ${hm(since)}`);
  for (const e of events) if (e.text) L.push(`  [${hm(e.t)}] ${e.kind}: ${e.text}`);
  for (const side of world.sides.map(s => s.id)) {
    const us = S.units.filter(u => u.side === side); L.push('', `${side}: ${us.length} bodies on the field, ${num(us.reduce((a, u) => a + u.str, 0))} men`);
    const by = {}; for (const u of us) (by[u.corps || '-'] = by[u.corps || '-'] || []).push(u);
    for (const [corps, cu] of Object.entries(by)) L.push(`  ${corps}: ` + cu.map(u => `${u.id} ${u.arm} ${num(u.str)} coh ${u.coh} ${u.status} ${u.task}${u.place ? ' in ' + u.place : ''} ${xy(u)}`).join(' | '));
  }
  L.push('', 'PLACES: ' + S.places.map(p => `${(world.places.find(q => q.id === p.id) || {}).name || p.id} ${p.holder || 'nobody'}`).join('; '));
  if (after) { L.push('', `RESULT: ${after.grade} (${after.why}) at ${hm(after.t)}`); if (after.verdict) L.push(`  The campaign: ${after.verdict.tierName} · ${after.verdict.title} · ${after.verdict.score}/100`); }
  return L.join('\n') + '\n';
}

/* ---------- the session ---------- */
const sessionFile = dir => path.join(dir, 'session.json');
const load = dir => JSON.parse(fs.readFileSync(sessionFile(dir), 'utf8'));
const save = (dir, s) => fs.writeFileSync(sessionFile(dir), JSON.stringify(s, null, 1));
const turnName = n => 'turn-' + String(n).padStart(3, '0');

/* Fight the session's battle from the start to its last recorded stop, give the new orders there, and run to the next stop.
   Returns what the turn is written from. For the chief's view the data returned is the contract's and nothing else. */
function advance(session, entries, opt = {}) {
  const view = session.view, chief = view === 'chief';
  const E = R.setup(session.settings), V = View.install(E); V.watch(view);
  const world = V.world(), menu = menuOf(E, session.settings), made = {}, log = session.log;
  const snap = () => V.snapshot(view);
  let S = snap(), li = 0, seq = 0, shown = 0; // shown: the newest dispatch the viewer had at the last stop (ids only rise)
  const seenIds = () => { for (const m of S.dispatches || []) if (m.id > shown) shown = m.id; };
  const stops = session.stops, target = stops.length ? stops[stops.length - 1] : S.t;
  const give = () => { while (li < log.length && log[li].t <= S.t) { R.apply(E, log[li], made); li++; } };
  // 1. the battle so far, exactly as it was played
  seenIds();
  while (!S.over && S.t < target) { give(); E.step(); S = snap(); seenIds(); for (const e of V.drain(view, seq)) seq = e.seq; }
  if (S.t !== target) throw new Error(`the session does not replay: reached ${hm(S.t)}, expected the stop at ${hm(target)}`);
  give();
  if (!stops.length) { stops.push(S.t); return { E, V, world, menu, S, events: V.drain(view, 0), dispatches: S.dispatches || [], receipts: [], since: S.t, first: true }; }
  if (S.over) throw new Error('the battle is over');
  // 2. the new orders, through the order builder; what was accepted is read back from the viewer's own list of orders
  const receipts = [], C = E.command, ordersNow = () => (chief ? snap().orders : C.orders.filter(o => o.from === C.X.chief).map(o => ({ id: o.id, text: C.describe(o), state: o.status })));
  for (const raw of entries || []) {
    const before = ordersNow(), ids = new Set(before.map(o => o.id)), i = log.length;
    if (raw && raw.cancel) {
      let ref = null; for (const [k, os] of Object.entries(made)) os.forEach((o, step) => { if (o.id === raw.cancel) ref = { ref: +k, step }; });
      if (!ref) { receipts.push({ ok: false, error: `no order ${raw.cancel} of yours to tear up`, entry: raw }); continue; }
      const e = Object.assign({ i, t: S.t, k: 'cancel' }, ref); R.apply(E, e, made);
      const now = ordersNow().find(o => o.id === raw.cancel);
      if (now && now.state === 'cancelled') { log.push(e); li = log.length; receipts.push({ ok: true, orders: [{ id: raw.cancel, text: 'torn up' }], entry: raw }); }
      else receipts.push({ ok: false, error: `${raw.cancel} has already left with its rider: only a new order can change it`, entry: raw });
      continue;
    }
    const specs = raw && raw.seq ? raw.seq : [raw], bad = specs.map(s => (s && typeof s === 'object' && s.to && s.action ? C.validate(Object.assign({ from: C.X.chief, conditions: [], manner: {} }, s)) : 'an order needs "to" and "action"')).find(Boolean);
    if (bad || (raw.seq && specs.some(s => s.to !== specs[0].to))) { receipts.push({ ok: false, error: bad || 'every step of a letter must go to the same commander', entry: raw }); continue; }
    const e = raw.seq && specs.length > 1 ? { i, t: S.t, k: 'seq', specs: clone(specs) } : { i, t: S.t, k: 'order', spec: clone(specs[0]) };
    R.apply(E, e, made);
    const fresh = ordersNow().filter(o => !ids.has(o.id));
    if (!fresh.length) { receipts.push({ ok: false, error: 'refused by the order builder', entry: raw }); continue; }
    log.push(e); li = log.length; receipts.push({ ok: true, orders: fresh.map(o => ({ id: o.id, text: o.text })), entry: raw });
  }
  // 3. on to the next stop
  const disp = new Map(), events = []; let gather = null;
  const until = opt.until != null ? opt.until : null;
  if (until != null && until <= S.t) throw new Error(`--until ${hm(until)} is not after ${hm(S.t)}`);
  while (!S.over) {
    E.step(); S = snap();
    for (const e of V.drain(view, seq)) { seq = e.seq; events.push(e); if (chief && e.kind === 'dispatch' && gather == null) gather = e.t + GATHER; if (!chief && (e.kind === 'break' || e.kind === 'place' || e.kind === 'army') && gather == null) gather = e.t + GATHER; }
    if (chief) for (const m of S.dispatches) if (m.id > shown && !disp.has(m.id)) disp.set(m.id, m); // the snapshot keeps the last twenty: gather them as they come
    if (until != null ? S.t >= until : (gather != null && S.t >= gather) || S.t - target >= MAXRUN) break;
  }
  stops.push(S.t);
  return { E, V, world, menu, S, events, dispatches: [...disp.values()].sort((a, b) => a.t - b.t || a.id - b.id), receipts, since: target };
}
// what is known once the field is over (the game shows the verdict then): the grade, the campaign's verdict and the losses
function afterOf(E) {
  if (!E.over || !E.result) return null;
  const B = P.battle(E.battleId).battle, j = B.stakes ? St.judge(E, B.stakes) : null;
  return clone({ grade: E.result.grade, why: E.result.why, t: E.result.t, cas: E.result.cas, verdict: j ? { tier: j.tier, tierName: j.tierName, title: j.title, text: j.text, score: j.score } : null });
}
function writeTurn(dir, session, r, opt = {}) {
  const turn = session.stops.length - 1, after = r.S.over ? afterOf(r.E) : null;
  const data = { world: r.world, snapshot: r.S, events: r.events, dispatches: r.dispatches, receipts: r.receipts, menu: r.menu, turn, since: r.since, full: !!opt.full, after };
  const plain = clone(data); // the writer gets a copy that shares nothing with the engine
  const text = session.view === 'chief' ? chiefTurn(plain) : truthTurn(plain);
  fs.writeFileSync(path.join(dir, turnName(turn) + '.txt'), text);
  fs.writeFileSync(path.join(dir, turnName(turn) + '.json'), JSON.stringify({ kind: 'agentplay-turn', view: session.view, turn, t: r.S.t, clock: r.S.clock, since: r.since, over: !!r.S.over, receipts: r.receipts, dispatches: r.dispatches, events: r.events, snapshot: r.S, after }));
  save(dir, session);
  if (r.S.over) { const rep = R.record(session.settings, session.log, { result: clone(r.E.result), hash: stateHash(r.E), stops: session.stops, view: session.view, harness: { tool: 'agentplay', gather: GATHER, maxRun: MAXRUN } }); fs.writeFileSync(path.join(dir, 'replay.json'), JSON.stringify(rep, null, 1)); }
  return { turn, text, file: path.join(dir, turnName(turn) + '.txt') };
}
function start(dir, settings, view) {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(sessionFile(dir))) throw new Error(`${dir} already holds a session`);
  if (view !== 'chief' && view !== 'truth') throw new Error(`no view "${view}": chief (Napoleon's) or truth (the umpire's)`);
  const session = { kind: 'agentplay-session', format: 1, view, settings, log: [], stops: [] };
  const r = advance(session, []);
  fs.writeFileSync(path.join(dir, 'menu.txt'), menuText(r.menu) + '\n');
  return writeTurn(dir, session, r, { full: true });
}
function next(dir, entries, opt = {}) {
  const session = load(dir);
  return writeTurn(dir, session, advance(session, entries, opt), opt);
}

/* ---------- the umpire's record, after the battle: the truth and the causes, for judging the engine ----------
   Fought again from the replay with both views watched (watching draws no dice: tools/test_view.js). Truth comes from the contract
   (snapshot('truth'), drain('truth'), why, losses). Two things the contract does not carry are read from the command layer, read
   only: which true unit each of the commander's contacts is (the contract hides it behind an opaque key, rightly), and each order's
   real history (written, received, acted on). Both are listed in the pull request as gaps to close before section 5's measures. */
function umpire(rep) {
  const E = R.setup(rep.settings), V = View.install(E); V.watch('chief'); V.watch('truth');
  const C = E.command, chiefId = C.X.chief, Bel = C.B[chiefId], side = C.side, mine = s => E.coalition[s] === E.coalition[side];
  const log = (rep.log || []).slice().sort((a, b) => a.t - b.t || a.i - b.i), made = {}, stops = new Set(rep.stops || []), atStops = [], inbox = [];
  const med = a => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return Math.round(v[Math.floor(v.length / 2)]); };
  const look = () => {
    const T = V.snapshot('truth'), S = V.snapshot('chief'), tu = Object.fromEntries(T.units.map(u => [u.id, u]));
    const enemyTrue = T.units.filter(u => !mine(u.side)), contacts = [...Bel.c.values()], known = new Set(contacts.map(c => c.tid));
    const cErr = contacts.filter(c => tu[c.tid]).map(c => ({ unit: c.tid, name: tu[c.tid].name, age: Math.round(E.t - c.t), err: Math.round(Math.hypot(c.x - tu[c.tid].x, c.y - tu[c.tid].y)), strBelieved: Math.round(c.str), strTrue: tu[c.tid].str, statusTrue: tu[c.tid].status }));
    const ownErr = S.own.filter(o => tu[o.id]).map(o => ({ unit: o.id, age: Math.round(E.t - (o.reportedAt ?? o.seenAt)), err: Math.round(Math.hypot(o.x - tu[o.id].x, o.y - tu[o.id].y)), strBelieved: o.str, strTrue: tu[o.id].str, stateBelieved: o.state, cohTrue: tu[o.id].coh, statusTrue: tu[o.id].status, taskBelieved: o.task, taskTrue: tu[o.id].task }));
    const unseen = enemyTrue.filter(u => !known.has(u.id));
    const bySide = {}; for (const u of unseen) { const b = bySide[u.side] || (bySide[u.side] = { bodies: 0, men: 0 }); b.bodies++; b.men += u.str; }
    const placesWrong = S.places.filter(p => { const tp = T.places.find(q => q.id === p.id); return tp && (tp.holder || null) !== (p.holder || null) && !(tp.holder && p.holder && E.coalition[tp.holder] === E.coalition[p.holder]); }).map(p => ({ id: p.id, believed: p.holder, truth: T.places.find(q => q.id === p.id).holder, knownAt: p.knownAt }));
    return { t: E.t, clock: E.fmtT(E.t), morale: T.morale,
      enemy: { onField: enemyTrue.length, men: enemyTrue.reduce((a, u) => a + u.str, 0), contacts: contacts.length, contactsGone: contacts.filter(c => !tu[c.tid]).length, medianErr: med(cErr.map(c => c.err)), maxErr: cErr.length ? Math.max(...cErr.map(c => c.err)) : null, medianAge: med(cErr.map(c => c.age)), believedMen: Math.round(contacts.reduce((a, c) => a + c.str, 0)), unseen: bySide, worst: cErr.sort((a, b) => b.err - a.err).slice(0, 5) },
      own: { bodies: ownErr.length, medianErr: med(ownErr.map(o => o.err)), maxErr: ownErr.length ? Math.max(...ownErr.map(o => o.err)) : null, medianAge: med(ownErr.map(o => o.age)), believedMen: ownErr.reduce((a, o) => a + o.strBelieved, 0), trueMen: ownErr.reduce((a, o) => a + o.strTrue, 0), brokenUnknown: ownErr.filter(o => (o.statusTrue === 'broken' || o.statusTrue === 'routed') && !/brok|rout|flee/i.test(o.stateBelieved || '')).map(o => o.unit), worst: ownErr.sort((a, b) => b.err - a.err).slice(0, 5) },
      placesWrong, truth: { byCorps: summarise(T.units), places: T.places } };
  };
  const summarise = units => { const by = {}; for (const u of units) { const k = u.side + ':' + (u.corps || '-'); const b = by[k] || (by[k] = { bodies: 0, men: 0, broken: 0, x: 0, y: 0, tasks: {} }); b.bodies++; b.men += u.str; if (u.status !== 'ok' && u.status !== 'steady' && u.status !== 'formed') b.tasks['status ' + u.status] = (b.tasks['status ' + u.status] || 0) + 1; b.x += u.x; b.y += u.y; b.tasks[u.task] = (b.tasks[u.task] || 0) + 1; } for (const b of Object.values(by)) { b.x = Math.round(b.x / b.bodies); b.y = Math.round(b.y / b.bodies); } return by; };
  let li = 0, nIn = 0, lastC = 0, lastT = 0; const samples = [], truthEvents = {}; let nChief = 0, nTruth = 0;
  if (stops.has(E.t)) atStops.push(look());
  while (!E.over) {
    while (li < log.length && log[li].t <= E.t) { R.apply(E, log[li], made); li++; }
    if (E.t % 30 === 0) samples.push(R.sample(E));
    E.step();
    for (; nIn < C.inbox.length; nIn++) { const m = C.inbox[nIn]; inbox.push({ t: m.t, kind: m.kind, from: m.from || null, title: m.title, text: m.text, writtenAt: m.writtenAt ?? null, star: !!m.decision, alarm: !!m.alarm }); }
    for (const e of V.drain('chief', lastC)) { lastC = e.seq; nChief++; }
    for (const e of V.drain('truth', lastT)) { lastT = e.seq; nTruth++; truthEvents[e.kind] = (truthEvents[e.kind] || 0) + 1; }
    if (stops.has(E.t)) atStops.push(look());
  }
  samples.push(R.sample(E));
  const B = P.battle(E.battleId).battle, world = V.world();
  const orders = C.orders.map(o => ({ id: o.id, from: o.from, to: o.to, byPlayer: o.from === chiefId && !o.byScript, text: C.describe(o), status: o.status, clarity: o.clarity != null ? Math.round(o.clarity * 100) / 100 : null, issuedAt: o.issuedAt, writtenAt: o.writtenAt ?? null, receivedAt: o.receivedAt ?? null, actAt: o.actAt ?? null, actedAt: o.actedAt ?? null, ackedAt: o.ackedAt ?? null, understood: o.understood ?? null, history: o.log }));
  const events = E.log.map((l, i) => ({ t: l.t, cat: l.cat, text: l.text, side: l.side || null, hidden: !!l.hidden, important: !!l.important, why: V.why(l).filter(c => c.text !== l.text).map(c => `${hm(c.t)} ${c.text}`), fire: l.cat === 'break' && l.unit ? V.losses(l.unit, l.t) : null, startRoll: typeof l.cause === 'string' ? l.cause : null }));
  return clone({ kind: 'agentplay-umpire', battle: E.battleId, settings: rep.settings, hash: stateHash(E), sameAsPlayed: rep.hash ? stateHash(E) === rep.hash : null,
    result: E.result, verdict: B.stakes ? St.judge(E, B.stakes) : null, metrics: E.metrics, perceived: { chiefEvents: nChief, truthEvents: nTruth, truthByKind: truthEvents },
    places: world.places, stops: atStops, orders, dispatches: inbox, log: events, samples });
}
function umpireText(U) {
  const L = [], pl = id => (U.places.find(p => p.id === id) || {}).name || id;
  L.push(`THE UMPIRE'S RECORD · ${U.battle} · seed ${U.settings.seed}`, 'The truth and the causes, written after the battle from its replay. Not for the player while he plays.', '');
  L.push(`RESULT: ${U.result.grade} (${U.result.why}) at ${hm(U.result.t)}`);
  if (U.verdict) L.push(`The campaign: ${U.verdict.tierName} · ${U.verdict.title} · ${U.verdict.score}/100. Exchange: own ${num(U.verdict.exchange.own)} lost, enemy ${num(U.verdict.exchange.enemy)}. Formed men left ${num(U.verdict.left)} of ${num(U.verdict.start)}.`);
  L.push('Losses, killed and wounded / taken: ' + Object.entries(U.result.cas).map(([s, c]) => `${s} ${num(c.kw)} / ${num(c.cap)}`).join('; '));
  L.push('Turning points (minute, or none): ' + Object.entries(U.metrics).map(([k, v]) => `${k} ${v == null ? 'none' : typeof v === 'number' && v > 300 ? hm(v) : v}`).join(', '));
  L.push(`The commander perceived ${U.perceived.chiefEvents} events of ${U.perceived.truthEvents} that happened.`, `Replays to the state that was played: ${U.sameAsPlayed === null ? 'not recorded' : U.sameAsPlayed ? 'yes' : 'NO'} (hash ${U.hash}).`);
  L.push('', 'EVERY ORDER AND WHAT REALLY BECAME OF IT (issued > written and sent > received > acted on; "player" marks the player\'s own)');
  for (const o of U.orders) L.push(`  [${o.id}] ${o.byPlayer ? 'player' : o.from} · ${o.text}\n      status ${o.status}; clarity ${o.clarity}; issued ${hm(o.issuedAt)}${o.writtenAt != null ? ', sent ' + hm(o.writtenAt) : ''}${o.receivedAt != null ? ', received ' + hm(o.receivedAt) : ', never received'}${o.actedAt != null ? ', acted on ' + hm(o.actedAt) : o.actAt != null ? ', due to act ' + hm(o.actAt) : ''}${o.receivedAt != null ? ` (${Math.round(o.receivedAt - o.issuedAt)} min from the pen to his hand)` : ''}\n      ${o.history.join(' · ')}`);
  L.push('', 'BELIEF AGAINST TRUTH AT EACH OF THE PLAYER\'S STOPS');
  for (const s of U.stops) {
    L.push(`  ${s.clock}  morale ${Object.entries(s.morale).map(([k, v]) => k + ' ' + v).join(' ')}`);
    L.push(`      enemy: ${s.enemy.contacts} contacts held (${s.enemy.contactsGone} of them no longer on the field) for ${s.enemy.onField} bodies really there; believed ${num(s.enemy.believedMen)} men, truly ${num(s.enemy.men)}; position error median ${s.enemy.medianErr} m, worst ${s.enemy.maxErr} m; median age ${s.enemy.medianAge} min; never seen: ${Object.entries(s.enemy.unseen).map(([k, v]) => `${k} ${v.bodies} bodies ${num(v.men)} men`).join(', ') || 'none'}`);
    if (s.enemy.worst.length) L.push('      worst placed: ' + s.enemy.worst.slice(0, 3).map(c => `${c.name} ${c.err} m out, seen ${c.age} min ago`).join('; '));
    L.push(`      own: believed ${num(s.own.believedMen)} men, truly ${num(s.own.trueMen)}; position error median ${s.own.medianErr} m, worst ${s.own.maxErr} m; median report age ${s.own.medianAge} min${s.own.brokenUnknown.length ? '; broken without his knowing: ' + s.own.brokenUnknown.join(', ') : ''}`);
    if (s.placesWrong.length) L.push('      places he has wrong: ' + s.placesWrong.map(p => `${pl(p.id)} (believes ${p.believed || 'nobody'}, truly ${p.truth || 'nobody'}, his news from ${hm(p.knownAt)})`).join('; '));
    L.push('      truth by corps: ' + Object.entries(s.truth.byCorps).map(([k, b]) => `${k} ${b.bodies}/${num(b.men)} at (${b.x}, ${b.y}) ${Object.entries(b.tasks).map(([t, n]) => `${n} ${t}`).join(' ')}`).join(' | '));
  }
  L.push('', 'WHAT REACHED HEADQUARTERS (★ needs a decision, !! a quick event; written > arrived)');
  for (const m of U.dispatches) L.push(`  [${hm(m.t)}]${m.star ? ' ★' : ''}${m.alarm ? ' !!' : ''} ${m.kind}${m.writtenAt != null ? ` (written ${hm(m.writtenAt)}, ${Math.round(m.t - m.writtenAt)} min on the road)` : ''} ${m.title}: ${m.text}`);
  L.push('', 'THE UMPIRE\'S LOG, WITH CAUSES (hidden = the player was never shown it)');
  for (const e of U.log) { L.push(`  [${hm(e.t)}] ${e.cat}${e.hidden ? ' (hidden)' : ''}: ${e.text}${e.startRoll ? ' {' + e.startRoll + '}' : ''}`); for (const w of e.why) L.push(`        because: ${w}`); if (e.fire && e.fire.men) L.push(`        fire in the half hour before: ${e.fire.men} men, from ${e.fire.by.map(b => `${b.from} (${b.kind}) ${b.men}`).join(', ')}`); }
  L.push('', 'STRENGTH EVERY HALF HOUR (formed foot and horse in the ranks; killed and wounded so far; army morale)');
  for (const s of U.samples) L.push(`  ${hm(s.t)}  ` + Object.keys(s.ranks).map(k => `${k} ${num(s.ranks[k])} ranks, ${num(s.kw[k])} k&w, morale ${Math.round(s.morale[k])}`).join(' | '));
  return L.join('\n') + '\n';
}
// the saved replay, fought again by replay.js alone: does it end on the state the played battle ended on?
function verify(rep) {
  const { E } = R.run(rep.settings, rep.log); while (!E.over) E.step();
  const check = R.check(rep);
  return { same: stateHash(E) === rep.hash && JSON.stringify(E.result) === JSON.stringify(rep.result), hash: stateHash(E), recorded: rep.hash, grade: E.result.grade, notes: check.notes };
}

module.exports = { start, next, advance, chiefTurn, truthTurn, menuOf, menuText, umpire, umpireText, verify, stateHash, load, GATHER, MAXRUN };

/* ---------- the command line ---------- */
if (require.main === module) {
  const [cmd, dir, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; }, has = k => rest.includes('--' + k);
  try {
    if (cmd === 'new' && dir) {
      const seed = +arg('seed', 1815) >>> 0;
      const settings = { battle: arg('battle', 'waterloo'), seed, history: arg('history', 'uncertain'), scenario: arg('scenario', '1100'), staff: arg('staff', 'soult'), silence: +arg('silence', 45) };
      const r = start(dir, settings, arg('view', 'chief'));
      console.log(`turn ${r.turn} written: ${r.file} (read it; the order menu is also in ${path.join(dir, 'menu.txt')})`);
    } else if (cmd === 'next' && dir) {
      const file = rest.find(a => !a.startsWith('--') && a !== arg('until') && a.endsWith('.json'));
      const entries = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
      if (!Array.isArray(entries)) throw new Error('the orders file must be a JSON array');
      const r = next(dir, entries, { until: arg('until') ? unhm(arg('until')) : null, full: has('full') });
      console.log(`turn ${r.turn} written: ${r.file}`);
    } else if (cmd === 'menu' && dir) {
      console.log(fs.readFileSync(path.join(dir, 'menu.txt'), 'utf8'));
    } else if (cmd === 'umpire' && dir) {
      const out = arg('out'); if (!out) throw new Error('say where the umpire\'s record goes: --out <folder> (not the player\'s folder)');
      if (path.resolve(out) === path.resolve(dir)) throw new Error('the umpire\'s record must not be written into the player\'s folder');
      const file = fs.existsSync(path.join(dir, 'replay.json')) ? path.join(dir, 'replay.json') : null;
      if (!file) throw new Error('no replay.json: the umpire\'s record is written after the battle is over');
      const U = umpire(JSON.parse(fs.readFileSync(file, 'utf8')));
      fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'umpire.json'), JSON.stringify(U)); fs.writeFileSync(path.join(out, 'umpire.txt'), umpireText(U));
      console.log(`the umpire's record: ${path.join(out, 'umpire.txt')} (${U.result.grade}; replays to the played state: ${U.sameAsPlayed})`);
    } else if (cmd === 'verify' && dir) {
      const v = verify(JSON.parse(fs.readFileSync(path.join(dir, 'replay.json'), 'utf8')));
      console.log(v.same ? `the replay fights the same battle: ${v.grade}, state ${v.hash}` : `NOT the same: now ${v.hash} (${v.grade}), recorded ${v.recorded}${v.notes.length ? '; ' + v.notes.join('; ') : ''}`);
      if (!v.same) process.exitCode = 1;
    } else console.log('usage: node tools/agentplay.js new|next|menu|umpire|verify <dir> ... (see the head of the file)');
  } catch (err) { console.error('agentplay: ' + err.message); process.exitCode = 1; }
}
