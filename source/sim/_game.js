/* ================= the game: Napoleon's command ================= */
let playing = false, lastStepAt = 0, G = null, OB = null;
/* (B1) the speed of the clock, as game time to real time: 1x is real time (one 2-minute tick every two minutes), 480x is eight game
   minutes a second (the old default). Between ticks the map glides from the last tick's positions to this one's, so at slow speeds the
   picture moves rather than jumps; at the fast speeds a tick is shorter than the eye can follow and the map simply redraws each tick. */
const SPEEDS = [1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960, 1800];
const TICK_MIN = 2; // game minutes in one engine tick
const speedName = x => x === 1 ? '1× · real time' : x < 60 ? `${x}×` : x === 60 ? '60× · a minute a second' : `${x}× · ${x / 60} minutes a second`;
let speed = (() => { try { const v = +localStorage.getItem('waterloo.speed'); return SPEEDS.includes(v) ? v : 480; } catch (e) { return 480; } })();
const tickMs = () => G && G.toEnd ? 1000 / 60 : TICK_MIN * 60000 / speed; // real milliseconds per tick
function setSpeed(x) {
  if (!SPEEDS.includes(x) || x === speed) return;
  const now = performance.now(), f = playing ? Math.min(1, (now - lastStepAt) / tickMs()) : 0; // keep the share of the tick already run
  speed = x; if (playing) lastStepAt = now - f * tickMs();
  try { localStorage.setItem('waterloo.speed', String(x)); } catch (e) { }
  const sel = $('r-speed'); if (sel) sel.value = String(x); setRun();
}
// the time the map shows: while the clock runs it trails the engine by up to one tick and glides to it (frac 0 shows the last tick)
const shownT = () => playing && frac < 1 ? SIM.t - TICK_MIN * (1 - frac) : SIM.t;
const clockText = () => { const t = shownT(), h = SIM.fmtT(Math.floor(t)); return playing && speed <= 30 ? `${h}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}` : h; };
viewMode = 'napoleon'; layers.riders = false; layers.flashes = false;
const clockEl = document.getElementById('clock');
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const capF = s => s && !/^d['’]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s; // never “D'Erlon”
const hm = t => SIM.fmtT(Math.round(t));
const compWord = b => ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east', 'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'][Math.round(b / 22.5) % 16];
const narrow = () => innerWidth <= 980;
const cmdOf = u => SIM.command.cmdOf(u);
// (phase 5) what the panels list comes from the battle's game block (GB) and its command block (XB): Waterloo's values were here
const XB = GAMEB.battle.command, CHIEF = XB.chief, SIDE = XB.side, US = GAMEB.coalition[SIDE];
const CORPS = GB.corps, CORPS_TITLE = GB.corpsTitle, CORPS_OF = GB.corpsOf, ORDER_TO = GB.orderTo;
const FC = XB.front ? XB.front.cmd : null, FRONT = XB.front ? XB.front.corps : []; // the field commander (Waterloo: Ney) and the corps of his front
const GB_IDS = XB.battery ? XB.battery.units : []; // the grand battery
const RKIND = to => (XB.recipients[to] || {}).kind; // corps, cavalry, battery, marshal, offmap, hq, army
const OFFMAP = Object.keys(XB.recipients).filter(k => RKIND(k) === 'offmap'), BATTERY = Object.keys(XB.recipients).find(k => RKIND(k) === 'battery') || null;
const NEEDS_OBJ = ['advance', 'attack', 'bombard', 'screen', 'withdraw', 'observe'];
const PLACE_GROUPS = GB.placeGroups, GUN_GROUPS = GB.gunGroups, SITES = GB.sites || [], SPS = GB.places, HIST = GB.history.map(([lab, key, h]) => [lab, key, h]);
const ENEMY = GAMEB.sideIds.find(s => GAMEB.coalition[s] !== US); // the colour the legend gives the enemy
document.title = GB.title;

/* ---------- a new battle ---------- */
function readSetup() {
  return { mapMode: $('s-map').value, scenario: $('s-scen').value, history: $('s-hist').value, staff: $('s-staff').value, silence: +$('s-sil').value, stop: $('s-stop').value, seed: (+$('s-seed').value || (Math.random() * 1e6) | 0) >>> 0 };
}
function newGame(o) {
  // (phase 5, stage 2) set up exactly as the after-action report's re-runs are (replay.js), so a battle fought again from the order log
  // comes out the same: the same engine, commanders, command layer and the recorded orders the computer follows whatever the player does
  SIM = WReplay.setup({ battle: GAME_ID, seed: o.seed, history: o.history, scenario: o.scenario, staff: o.staff, silence: o.silence });
  G = { umpire: o.mapMode === 'umpire', logShown: 0, selOrder: null, hoverWid: null, dispSel: null, focusCorps: null, focusEnemy: null, opts: o, phase: 'setup', shown: 0, curFrom: 0, current: [], stopT: SIM.t, prevStopT: SIM.t, briefing: true, stopMode: o.stop, runTo: null, newIds: new Set(), pick: false, sent: null, sel: null, latch: {}, gatherUntil: null, scan: 0, orderLog: [], orderIdx: {}, made: {}, t0: SIM.t, knew: [], knewNow: null, samples: [], nextSample: null, stops: [], refoughtFrom: null, toEnd: null, toEndFrom: null };
  $('endbox').hidden = true;
  aarReset();
  OB = freshOB(CORPS[0]);
  viewMode = G.umpire ? 'compare' : 'napoleon'; layers.riders = G.umpire; layers.flashes = G.umpire; selected = null; prevPos.clear(); GLIDE.clear(); frac = 1; flashes = [];
  $('verdictBox').hidden = true; $('unitDetails').hidden = true; $('cartsub').textContent = G.umpire ? `${GB.date} · la carte de l’arbitre` : `${GB.date} · carte de l’Empereur`;
  $('viewbar').hidden = !G.umpire; $('umpBox').hidden = !G.umpire; $('umplog').innerHTML = ''; setView(viewMode);
  renderLayers(); legend(); renderAll(); requestDraw();
}
function begin() {
  G.phase = 'play'; $('setup').hidden = true; G.briefing = true; G.stopT = SIM.t; G.staffNow = staffRemarks();
  ['dispBox', 'obBox'].forEach(id => $(id).open = true);
  renderAll(); setRun(); setTimeout(() => $('go').focus(), 50);
}
$('setupform').addEventListener('submit', e => { e.preventDefault(); newGame(readSetup()); begin(); });
$('s-rnd').addEventListener('click', () => { $('s-seed').value = (Math.random() * 1e6) | 0; });

/* ---------- the clock ---------- */
// (B1) on Continue the first tick runs at once and the map glides to it over the tick's length
function setPlaying(p) { playing = p && SIM && !SIM.over && G.phase === 'play'; if (playing) { lastStepAt = performance.now() - tickMs(); frac = 0; G.briefing = false; G.newIds = new Set(); G.dispSel = null; if (G.pick) cancelPick(); } setRun(); }
function stepGame() {
  if (!SIM || SIM.over) return;
  const n0 = SIM.log.length; for (const u of SIM.units) prevPos.set(u.id, [u.x, u.y, u.facing]); for (const r of SIM.command.riders) riderPrev.set(r, [r.x, r.y]);
  SIM.step(); noteKnowledge(); sampleLive();
  if (G.umpire) for (let i = n0; i < SIM.log.length; i++) noteEvent(SIM.log[i]);
  if (SIM.over) { endGame(); return; }
  if (G.toEnd) return; // fighting it out: no stops
  // (5e) news is gathered: the clock stops 15 minutes after the first item that counts, or 8 after a ★ one, whichever comes first,
  // so several riders arriving close together make one stop (est.; the stops in a battle fell from about 110 to about 38)
  const C = SIM.command, mode = G.runTo != null ? 'decide' : G.stopMode;
  for (; G.scan < C.inbox.length; G.scan++) { const m = C.inbox[G.scan]; if (!stopsFor(m, mode)) continue; G.gatherUntil = Math.min(G.gatherUntil ?? Infinity, m.t + (m.alarm ? GATHER_ALARM : m.decision ? GATHER_STAR : GATHER)); G.gatherReal = Math.min(G.gatherReal ?? Infinity, performance.now() + (m.alarm ? 2000 : m.decision ? 4000 : 8000)); }
  if ((G.gatherUntil != null && SIM.t >= G.gatherUntil) || (G.runTo != null && SIM.t >= G.runTo)) halt();
}
/* (B1) when the clock stops by itself: kinds of news, each a setting. The three ready-made settings are the stops of release 3
   (news: anything; !! and ★; ★ only); "Stop for…" picks the kinds one by one. */
const STOP_KINDS = [['rider', 'a rider brings a report'], ['sight', 'something is seen or heard from headquarters'], ['star', 'a dispatch needs a decision (★)'], ['alarm', 'a quick event: an attack, a charge, a line breaking (!!)'], ['place', 'a farm or village changes hands'], ['hq', 'headquarters is in danger']];
const STOP_PRESETS = { decide: ['star'], alarm: ['star', 'alarm'] };
const msgKinds = m => [m.kind === 'report' && 'rider', (m.kind === 'sight' || m.kind === 'sound' || m.kind === 'summary') && 'sight', m.decision && 'star', m.alarm && 'alarm', m.refs && m.refs.sp && m.refs.sp.length && 'place', m.alarm && m.alarm.some(a => a.kind === 'hq') && 'hq'].filter(Boolean);
let customStops = (() => { try { const v = JSON.parse(localStorage.getItem('waterloo.stops')); if (Array.isArray(v)) return new Set(v); } catch (e) { } return new Set(['star', 'alarm', 'place', 'hq']); })();
function stopsFor(m, mode) {
  if (m.pause === false) return false;
  if (mode === 'all') return true;
  const want = mode === 'custom' ? customStops : new Set(STOP_PRESETS[mode] || []);
  return msgKinds(m).some(k => want.has(k));
}
const GATHER = 15, GATHER_STAR = 8, GATHER_ALARM = 4; // (9) a !! event stops the clock within 4 minutes, so there is time to answer it
// (B1) and within 8 real seconds (4 for ★, 2 for !!): at slow speeds 15 game minutes would be a quarter of an hour of waiting
function halt() {
  const C = SIM.command, B = C.B[CHIEF];
  G.current = C.inbox.slice(G.shown); G.curFrom = G.shown; G.shown = C.inbox.length;
  G.prevStopT = G.stopT; G.stopT = SIM.t; G.runTo = null; G.sent = null; G.gatherUntil = null; G.gatherReal = null; G.scan = C.inbox.length; frac = 1; if (G.stops[G.stops.length - 1] !== SIM.t) G.stops.push(SIM.t);
  G.newIds = new Set(Object.entries(B.firstSeen).filter(([k, t]) => t > G.prevStopT && B.c.has(k)).map(([k]) => k));
  G.staffNow = staffRemarks();
  playing = false; setRun(); renderAll(); requestDraw();
  $('dispBox').open = true;
  if (!narrow()) $('dispBox').scrollIntoView({ block: 'nearest' });
}
let shownClock = '';
function loop(now) {
  if (playing && SIM && !SIM.over) {
    const iv = tickMs(); let n = 0; glideMs = Math.min(1500, Math.max(250, iv * 0.8));
    while (playing && now - lastStepAt >= iv && n < (G.toEnd ? 6 : 4)) { stepGame(); lastStepAt += iv; n++; }
    if (now - lastStepAt > iv * 4) lastStepAt = now; // fallen behind (a slow device, or the tab was hidden): carry on from now
    if (playing && G.gatherReal != null && now >= G.gatherReal) halt();
    // (B1) between ticks the map glides; only worth drawing every frame when a tick lasts long enough to see (about 0.2 s or more)
    frac = playing && iv >= 200 ? Math.min(1, Math.max(0, (now - lastStepAt) / iv)) : 1;
    if (n && playing) refreshLive();
    if (playing && (n || iv >= 200)) { requestDraw(); const c = clockText(); if (c !== shownClock) { shownClock = c; clockEl.textContent = c; const b = $('runtxt').querySelector('b'); if (b) b.textContent = c; } }
  }
  if (!playing) frac = 1;
  if (flashes.length || glideBusy) requestDraw();
  requestAnimationFrame(loop);
}
function setRun() {
  const go = $('go'), txt = $('runtxt'), read = $('readbtn'), bar = $('runbar');
  bar.hidden = !G || G.phase === 'setup';
  if (!SIM || !G) return;
  clockEl.textContent = shownClock = clockText();
  const sp = $('r-speed'); if (sp) { sp.hidden = G.phase !== 'play' || !!G.toEnd; sp.value = String(speed); }
  if (G.phase === 'over') { go.disabled = false; txt.innerHTML = `<b>${hm(SIM.result.t)}</b> · the battle is over`; go.textContent = 'The verdict'; read.hidden = true; return; }
  const ride = $('rideon'); if (ride) ride.hidden = playing || G.phase !== 'play';
  if (G.toEnd) { txt.innerHTML = `<b>${hm(SIM.t)}</b> · fighting it out to the end: ${END_WORD[G.toEnd]}`; go.textContent = 'To the end'; go.disabled = true; read.hidden = true; return; }
  go.disabled = false;
  if (playing) { const waiting = G.gatherUntil != null ? SIM.command.inbox.length - G.shown : 0; txt.innerHTML = `<b>${clockText()}</b> · the clock is running${G.runTo != null ? ` to ${hm(G.runTo)}` : ''}${waiting ? ` · ${waiting} dispatch${waiting > 1 ? 'es' : ''} in, stopping ${G.gatherReal != null && (G.gatherUntil - SIM.t) * 60000 / speed > G.gatherReal - performance.now() ? 'in a moment' : 'by ' + hm(G.gatherUntil)}` : '…'}`; go.textContent = 'Stop the clock'; go.setAttribute('aria-pressed', 'true'); read.hidden = true; return; }
  const n = G.current.length;
  txt.innerHTML = G.briefing ? `<b>${hm(SIM.t)}</b> · your army awaits your orders` : `<b>${hm(SIM.t)}</b> · ${n ? `${n} dispatch${n > 1 ? 'es' : ''}` : 'the clock is stopped'}`;
  go.textContent = 'Continue'; go.setAttribute('aria-pressed', 'false'); read.hidden = false;
}
$('go').addEventListener('click', goClick);
{ const sel = $('r-speed'); sel.innerHTML = SPEEDS.map(x => `<option value="${x}">${speedName(x)}</option>`).join(''); sel.value = String(speed); sel.addEventListener('change', e => setSpeed(+e.target.value)); }
function goClick() {
  if (!G || G.phase === 'setup' || G.phase === 'refight' || (G.toEnd && G.phase !== 'over')) return;
  if (G.phase === 'over') { $('verdictBox').open = true; $('verdictBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (playing) halt(); else setPlaying(true); // stopping by hand shows whatever has come in since the last stop
}
$('readbtn').addEventListener('click', () => { $('dispBox').open = true; $('dispBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

/* ---------- panels ---------- */
function renderAll() { if (!SIM) return; renderStop(); renderEarlier(); renderOB(); refreshLive(); }
function refreshLive() {
  if (!SIM) return;
  clockEl.textContent = shownClock = clockText();
  renderOrders(); renderArmy(); renderEnemy(); renderHQ(); renderUmpLog(); setRun(); updateDusk(); refreshTip();
  if (G.sel) { const d = $('unitcard'); if (d) d.innerHTML = selHTML(G.sel); }
}
function believedCentre(to) {
  const B = SIM.command.B[CHIEF];
  const recs = [...B.own.values()].filter(o => { const u = SIM.byId[o.uid]; if (!u || o.gone) return false; const c = cmdOf(u); return to === FC ? FRONT.includes(c) : to === BATTERY ? (GB_IDS.includes(u.id) || u.gbattery) : c === to; });
  if (!recs.length) return null;
  return [recs.reduce((a, o) => a + o.x, 0) / recs.length, recs.reduce((a, o) => a + o.y, 0) / recs.length];
}
function flyToXY(p, z) { if (!p) return; const [la, lo] = m2ll(p[0], p[1]); showMap(); flyTo(la, lo, Math.max(z || 2.4, zoomF())); }
function showMap() { if (narrow()) { const r = box.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
function writeTo(cid) { OB = freshOB(cid); OB.touched = true; G.selOrder = null; renderOB(); frameDraft(); requestDraw(); $('obBox').open = true; $('obBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function briefingHTML() {
  const st = GB.starts[G.opts.scenario] || Object.values(GB.starts)[0];
  return `<div class="brief">${st.brief}</div>`;
}
function dispHTML(m) {
  const lag = m.writtenAt != null ? Math.round(m.t - m.writtenAt) : 0;
  const when = m.writtenAt != null && lag >= 2 ? `written ${hm(m.writtenAt)} · arrived ${hm(m.t)}` : hm(m.t);
  const body = m.lines && m.lines.length > 1 ? `<ul>${m.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : `<p>${esc(m.text)}</p>`;
  const sel = G.dispSel && G.dispSel.id === m.id, hasMap = refsWorthShowing(m.refs);
  const alarmLine = i => m.alarm && m.alarm.some(a => a.line === i) ? '<span class="alarm" title="Seen from headquarters: a quick event">!!</span> ' : '';
  const body2 = m.lines && m.lines.length > 1 ? `<ul>${m.lines.map((l, i) => `<li data-li="${i}" class="${sel && G.dispSel.line === i ? 'on' : ''}">${alarmLine(i)}${esc(l)}</li>`).join('')}</ul>` : body;
  let acts = hasMap ? `<button class="mapbtn" data-show="${m.id}" aria-pressed="${sel ? 'true' : 'false'}">${sel ? 'Shown on the map' : 'See it on the map'}</button>` : '';
  if (CORPS.includes(m.from) || (FC && m.from === FC) || OFFMAP.includes(m.from)) acts += `<button data-write="${m.from}">Write to ${SIM.leaders[m.from] ? SIM.leaders[m.from].name : m.from}</button>`;
  const actsH = acts ? `<div class="dact">${acts}</div>` : '';
  if (isLetter(m)) return `<article class="disp lt k-${m.kind}${m.decision ? ' decide' : ''}${sel ? ' sel' : ''}${hasMap ? ' clickable' : ''}" data-mid="${m.id}">${letterHTML(m, body2, actsH)}</article>`;
  return `<article class="disp k-${m.kind}${m.decision ? ' decide' : ''}${m.alarm ? ' alarmed' : ''}${sel ? ' sel' : ''}${hasMap ? ' clickable' : ''}" data-mid="${m.id}"><header><b>${m.alarm ? '<span class="alarm" title="Seen from headquarters: a quick event">!!</span> ' : ''}${esc(m.title)}</b><time>${when}</time></header>${body2}${actsH}</article>`;
}
function renderStop() {
  const box = $('stopcards');
  if (!G || G.phase === 'setup') { box.innerHTML = '<p class="small">Choose your settings and begin.</p>'; $('dispcount').textContent = ''; return; }
  const n = G.current.length;
  let h = `<div class="stophead"><b>${hm(G.stopT)}</b><span>${G.briefing ? 'before the battle' : n ? `${n} new since ${hm(G.prevStopT)}` : `nothing new since ${hm(G.prevStopT)}`}</span></div>`;
  if (G.briefing) h += briefingHTML();
  h += staffHTML(G.staffNow || []);
  h += G.current.slice().reverse().map(dispHTML).join('');
  if (G.newIds.size) h += `<p class="small">Rings on the map mark ${G.newIds.size} bod${G.newIds.size > 1 ? 'ies' : 'y'} of troops reported for the first time since ${hm(G.prevStopT)}.</p>`;
  box.innerHTML = h; $('dispcount').textContent = n ? `${n} new` : '';
}
function renderEarlier() {
  const C = SIM.command, list = $('inbox'), items = C.inbox.slice(0, G.curFrom).slice(-200).reverse();
  list.innerHTML = items.map(m => `<li class="k-${m.kind}${m.decision ? ' decide' : ''}${refsWorthShowing(m.refs) ? ' clickable' : ''}${G.dispSel && G.dispSel.id === m.id ? ' sel' : ''}" data-mid="${m.id}"><time>${hm(m.t)}</time><div><b>${m.alarm ? '<span class="alarm">!!</span> ' : ''}${esc(m.title)}</b>${m.writtenAt != null && m.t - m.writtenAt >= 8 ? `<span class="lag"> · ${Math.round(m.t - m.writtenAt)} min on the road</span>` : ''}<p>${esc(m.text)}</p></div></li>`).join('') || '<li class="none">Nothing yet.</li>';
  $('earlierBox').hidden = !items.length;
}
function onDispClick(e) {
  const b = e.target.closest('button');
  if (b && b.dataset.write) { writeTo(b.dataset.write); return; }
  const card = e.target.closest('[data-mid]'); if (!card) return;
  const li = e.target.closest('li[data-li]'), line = li ? +li.dataset.li : null;
  showDispatch(+card.dataset.mid, line);
}
$('stopcards').addEventListener('click', onDispClick);
$('inbox').addEventListener('click', onDispClick);

/* ---------- your army, as last reported ---------- */
function renderArmy() {
  const C = SIM.command, B = C.B[CHIEF];
  const rows = CORPS.map(cid => {
    const recs = [...B.own.values()].filter(o => SIM.byId[o.uid] && cmdOf(SIM.byId[o.uid]) === cid), live = recs.filter(o => !o.gone);
    const men = live.filter(o => o.type !== 'art').reduce((a, o) => a + o.str, 0), guns = live.filter(o => o.type === 'art').reduce((a, o) => a + o.str, 0);
    const known = live.filter(o => o.type !== 'art' && o.tState >= 0);
    const st = known.filter(o => o.status !== 'broken' && o.coh >= 50).length, sh = known.filter(o => o.status !== 'broken' && o.coh < 50).length, br = known.filter(o => o.status === 'broken').length, tot = Math.max(1, st + sh + br);
    const att = known.filter(o => o.task === 'attack' || o.task === 'cavRaid' || o.task === 'charge').length, ral = known.filter(o => o.task === 'rally').length, mv = known.filter(o => ['move', 'march', 'support'].includes(o.task)).length;
    const doing = [att && `${att} attacking`, ral && `${ral} re-forming`, br && `${br} broken`, mv && `${mv} on the move`].filter(Boolean).join(', ') || 'holding';
    const last = [...C.inbox].reverse().find(m => m.kind === 'report' && m.from === cid);
    return `<tr data-corps="${cid}"><td><span class="nm">${CORPS_TITLE[cid]}</span><span class="sm">${doing} · ${last ? 'last report ' + hm(last.writtenAt) : 'no report yet'}</span><div class="cond3" title="${st} steady, ${sh} shaken, ${br} broken">${st ? `<i class="s" style="flex:${st / tot}"></i>` : ''}${sh ? `<i class="h" style="flex:${sh / tot}"></i>` : ''}${br ? `<i class="b" style="flex:${br / tot}"></i>` : ''}</div></td><td class="num">${fmt(Math.round(men / 100) * 100)} men<span class="sm">${Math.round(guns)} guns</span></td></tr>`;
  }).join('');
  // the field commander (Waterloo: Ney) and the commanders off the map (Grouchy), where the battle has them
  let kv = '';
  if (FC) {
    const N = C.ney, FN = GB.fieldNote || {}, nm = SIM.leaders[FC] ? SIM.leaders[FC].name : FC, free = N.active && (FN.free || []).includes(N.sector);
    const held = Object.keys(C.reserved || {}).map(id => SIM.byId[id]).filter(u => u && u.type !== 'art' && B.own.get(u.id) && !B.own.get(u.id).gone);
    const neyTxt = (!N.active ? `You have taken the front back; ${nm} waits for orders.` : `Commands ${N.sector === 'whole' ? 'the whole front' : 'the ' + N.sector + ' of the line'}${N.goal ? ', with orders to take ' + SIM.objectives[N.goal].name : ', on his own judgement'}.`)
      + (free ? FN.text || '' : '')
      + (held.length ? ` <br><span class="small">Held back by your order: ${held.map(u => esc(u.name)).join(', ')}.</span>` : '');
    kv += `<dt>${esc(nm)}</dt><dd>${neyTxt}</dd>`;
  }
  for (const id of OFFMAP) {
    const nm = SIM.leaders[id] ? SIM.leaders[id].name : id, sent = C.orders.filter(o => o.to === id && o.status !== 'cancelled'), ans = C.inbox.filter(m => m.from === id);
    kv += `<dt>${esc(nm)}</dt><dd>${((GB.offmapNote || {})[id] || 'Off the map.')} ${sent.length ? `You have written to him ${sent.length === 1 ? 'once' : sent.length + ' times'}; ${ans.length ? 'his last answer came at ' + hm(ans[ans.length - 1].t) : 'no answer yet'}.` : 'You have not written to him today.'}</dd>`;
  }
  $('army').innerHTML = `<p class="small">Strengths and condition as your corps last reported them, so they are always somewhat out of date. Tap a corps to find it on the map.</p><table class="armyt"><tbody>${rows}</tbody></table>${kv ? `
  <dl class="kv">${kv}</dl>` : ''}`;
}
$('army').addEventListener('click', e => { const tr = e.target.closest('[data-corps]'); if (tr) flyToXY(believedCentre(tr.dataset.corps), 2.2); });

/* ---------- the enemy, as you know him ---------- */
function renderEnemy() {
  const C = SIM.command, B = C.B[CHIEF], t = SIM.t;
  const fresh = [...B.c.values()].filter(c => t - c.t <= 45 && c.side !== SIDE);
  const sum = k => fresh.filter(c => c.kind === k).reduce((a, c) => a + c.str, 0);
  const guns = fresh.filter(c => c.kind === 'art').reduce((a, c) => a + (c.guns || 0), 0), unk = fresh.filter(c => !c.side);
  const r5 = n => fmt(Math.round(n / 500) * 500);
  const XI = XB.intel || {}, xE = XI.east ? SIM.ll2m(...XI.east)[0] : Infinity, east = XI.east ? fresh.filter(c => ((XB.flank && c.side === XB.flank.side) || !c.side) && c.x > xE) : []; // troops in the east (Waterloo)
  const kc = Object.entries(B.knownCorps || {});
  const places = SPS.map(id => { const pb = B.places[id], sp = SIM.spById[id]; if (!pb) return ''; return `<span class="chip ${pb.holder === US ? 'fr' : pb.holder ? 'al' : ''}" title="${esc(pb.src)}">${sp.name}${pb.holder ? '' : ' · empty'} · ${hm(pb.t)}</span>`; }).join('');
  $('enemy').innerHTML = `<p class="small">Seen or reported in the last 45 minutes (strengths are estimates, and the same troops can be counted twice by two reports):</p>
  <dl class="kv"><dt>Infantry</dt><dd>about ${r5(sum('inf'))}</dd><dt>Cavalry</dt><dd>about ${r5(sum('cav'))}</dd><dt>Guns</dt><dd>${guns || 'none counted'}</dd>${unk.length ? `<dt>Unknown</dt><dd>${unk.length} bod${unk.length > 1 ? 'ies' : 'y'} of troops nobody has identified</dd>` : ''}${east.length ? `<dt>East</dt><dd>${east.length} bod${east.length > 1 ? 'ies' : 'y'} of troops ${GB.eastWord || 'in the east'}, about ${r5(east.reduce((a, c) => a + (c.kind === 'art' ? 0 : c.str), 0))} men</dd>` : ''}</dl>
  ${kc.length ? `<p class="small" style="margin-top:.6em">Identified:</p><ul class="small">${kc.map(([k, v]) => `<li>${C.CORPSNAME[k] || k}, named ${hm(v.t)}${v.claim ? `; a prisoner put it at about ${r5(v.claim)} men` : ''}</li>`).join('')}</ul>` : ''}
  <p class="small" style="margin-top:.6em">Who holds the farms and villages, as you last heard:</p><div class="chips">${places}</div>`;
}

/* ---------- headquarters and the clock ---------- */
function hqInfo() {
  const C = SIM.command, P0 = C.POSTS, W = SIM.wet, V = SIM.bgVis(SIM.t);
  const post = C.hq.moving ? `Riding to ${P0[C.hq.moving.to].name}; set up about ${hm(C.hq.moving.arriveAt)}` : `At ${P0[C.hq.post].name}`;
  const ground = W > 0.8 ? 'soaked' : W > 0.55 ? 'soft and heavy' : W > 0.35 ? 'drying' : 'firm';
  const L = SIM.light, light = SIM.t < L.sunset - 15 ? 'good daylight' : SIM.t < L.sunset + 25 ? 'the sun is going down' : SIM.t < L.dark ? 'dusk' : 'nearly dark'; // (phase 2) from the computed sun
  const wind = SIM.wind.speed < 0.8 ? 'barely a breath of wind' : SIM.wind.speed < 1.5 ? 'a light wind' : 'a fresh breeze';
  return `<dl class="kv"><dt>Your post</dt><dd>${post}${C.hq.wounded ? ' · you are wounded' : ''}</dd><dt>Staff</dt><dd>${G.opts.staff === 'berthier' ? 'Berthier: orders written in 3–8 minutes, two or three riders' : 'Soult: orders written in 5–15 minutes, one rider'}</dd>
  <dt>Light</dt><dd>${light}; you can see about ${(V / 1000).toFixed(0)} km where the smoke allows</dd><dt>Ground</dt><dd>${ground}</dd><dt>Wind</dt><dd>${wind} from the ${comp((SIM.wind.dir + 360) % 360)}, carrying the smoke ${comp((SIM.wind.dir + 180) % 360)}</dd></dl>`;
}
function renderHQ() {
  const box = $('hqbox');
  if (!box.dataset.built) {
    box.dataset.built = '1';
    box.innerHTML = `<div id="hqinfo"></div>
    <div class="row"><label for="h-letters">Letters</label><select id="h-letters"><option value="letters">as written: “Monsieur le Comte…”, “Sire,…”</option><option value="plain">plain text</option></select></div>
    <div class="row"><label for="h-map">Map</label><select id="h-map"><option value="paper">the Emperor’s paper map</option><option value="colour">colour, with relief</option></select></div>
    <p class="small">The clock's speed, from real time to half an hour a second, is beside Continue under the map (the keys <kbd>,</kbd> and <kbd>.</kbd> change it); so are when to stop the clock and riding on to a set time.</p>`;
    $('h-map').value = MAPSTYLE; $('h-map').addEventListener('change', e => setMapStyle(e.target.value));
    $('h-letters').value = LETTERS ? 'letters' : 'plain'; $('h-letters').addEventListener('change', e => setLetters(e.target.value === 'letters'));
  }
  $('hqinfo').innerHTML = hqInfo();
  // the ride-on times beside Continue: every half hour from now to dark
  $('r-stop').value = G.stopMode; $('r-custom').hidden = G.stopMode !== 'custom';
  const sel = $('r-to'), first = Math.ceil((SIM.t + 1) / 30) * 30, keep = +sel.value;
  if (sel.dataset.from !== String(first)) { sel.dataset.from = first; let h = ''; for (let t = first; t <= SIM.light.end; t += 30) h += `<option value="${t}">to ${SIM.fmtT(t)}</option>`; sel.innerHTML = h + '<option value="end">to the end…</option>'; if (keep > SIM.t) sel.value = keep; }
}
$('r-stop').addEventListener('change', e => { if (G) G.stopMode = e.target.value; $('r-custom').hidden = e.target.value !== 'custom'; });
{ const box = $('r-custom'); box.innerHTML = '<legend class="vh">Stop the clock when</legend>' + STOP_KINDS.map(([k, w]) => `<label><input type="checkbox" value="${k}"${customStops.has(k) ? ' checked' : ''}> ${w}</label>`).join('');
  box.addEventListener('change', () => { customStops = new Set([...box.querySelectorAll('input:checked')].map(i => i.value)); try { localStorage.setItem('waterloo.stops', JSON.stringify([...customStops])); } catch (e) { } }); }
$('r-go').addEventListener('click', () => { if (!G || G.phase !== 'play') return; if ($('r-to').value === 'end') { openEndBox(true); return; } const v = +$('r-to').value; if (v > SIM.t) { G.runTo = v; setPlaying(true); showMap(); } });

/* ---------- the order builder ---------- */
// (phase 5) the form's first choices: Waterloo's were d'Erlon to support, the centre, La Belle Alliance (or Rossomme from there), the Guard
function freshOB(to) {
  const C = SIM && SIM.command, here = C ? (C.hq.moving ? C.hq.moving.to : C.hq.post) : XB.post0, posts = Object.keys(XB.posts);
  const post = posts.find(k => k !== here && k !== XB.post0 && !XB.posts[k].note) || posts.find(k => k !== here) || here;
  const rg = (GB.rearguards || [])[0], other = c => CORPS.find(k => k !== c) || c;
  const D = GB.obDefaults || {};
  return { to: to || CORPS[0], action: null, place: null, point: null, corps: D.corps || other(to || CORPS[0]), sector: GB.sector0 || 'whole', goal: '', post, rearguard: rg ? rg[0] : '', withMode: 'any', withIds: new Set(), detachTo: D.detachTo || other(to || CORPS[0]), formation: '', losses: '', bring: new Set(), site: '', urgent: false, conds: [], seq: [] };
}
const kindOf = to => SIM.command.RECIPIENTS[to].kind;
const WITH_ACTS = ['attack', 'advance', 'withdraw', 'hold', 'screen', 'bombard', 'support'];
function specFromOB() {
  const a = OB.action, s = { to: OB.to, action: a, conditions: OB.conds.map(c => Object.assign({}, c)), manner: {} };
  if (NEEDS_OBJ.includes(a)) { if (OB.point) s.objective = { point: OB.point.slice() }; else if (OB.place) s.objective = { place: OB.place }; }
  if (a === 'support') s.objective = { corps: OB.corps };
  if (a === 'sector') { s.sector = OB.sector; if (OB.goal && OB.sector !== 'none') s.goal = OB.goal; }
  if (a === 'moveHQ') s.post = OB.post;
  if (a === 'retreat') s.rearguard = OB.rearguard || null;
  if (a === 'detach') { s.with = [...OB.withIds]; s.detachTo = OB.detachTo; }
  else if (OB.withMode === 'these' && OB.withIds.size && WITH_ACTS.includes(a)) s.with = [...OB.withIds];
  if (OB.formation) s.manner.formation = OB.formation;
  if (OB.losses) s.manner.losses = OB.losses;
  if (OB.bring.size) s.manner.bring = [...OB.bring];
  if (OB.site) s.manner.site = OB.site;
  if (OB.urgent) s.urgent = true;
  return s;
}
function brigadesFor(to) {
  const B = SIM.command.B[CHIEF], groups = [];
  const pick = f => [...B.own.values()].filter(o => !o.gone && SIM.byId[o.uid] && f(SIM.byId[o.uid]));
  if (to === FC) for (const c of FRONT) groups.push([CORPS_TITLE[c], pick(u => cmdOf(u) === c && u.type !== 'art')]);
  else if (to === BATTERY) groups.push(['Batteries', pick(u => u.type === 'art' && (GB_IDS.includes(u.id) || u.gbattery))]);
  else groups.push([CORPS_TITLE[to], pick(u => cmdOf(u) === to)]);
  return groups.filter(g => g[1].length);
}
const opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${esc(t)}</option>`;
const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, t]) => opt(v, t, cur)).join('')}</select>`;
const row = (lab, html, forId) => `<div class="row"><label${forId ? ` for="${forId}"` : ''}>${lab}</label>${html}</div>`;
function objSelect() {
  let h = `<select id="ob-obj">`;
  if (!OB.place && !OB.point) h += opt('', 'choose a place…', '');
  if (OB.point) h += opt('__pt', 'the point you marked: ' + whereIs(OB.point[0], OB.point[1]), '__pt');
  for (const [g, keys] of PLACE_GROUPS) h += `<optgroup label="${g}">${keys.filter(k => SIM.objectives[k] && (!(GB.placeOnlyAt || {})[k] || G.opts.scenario === GB.placeOnlyAt[k])).map(k => opt(k, capF(SIM.objectives[k].name), OB.point ? '' : OB.place)).join('')}</optgroup>`;
  return h + '</select>';
}
function renderOB() {
  const box = $('ob');
  if (!SIM || !G || G.phase !== 'play') { box.innerHTML = G && G.phase === 'over' ? '<p class="small">The battle is over.</p>' : '<p class="small">Begin the battle to give orders.</p>'; return; }
  const C = SIM.command, R = C.RECIPIENTS, kind = kindOf(OB.to), acts = C.ALLOWED[kind].filter(k => k !== 'retreat' || kind === 'army');
  if (!acts.includes(OB.action)) OB.action = acts[0];
  const a = OB.action; let h = '';
  if (G.sent) h += `<p class="sentnote">Your order to ${esc(G.sent.to)} is with the staff (${G.sent.when}).</p>`;
  if (OB.seq.length) h += `<div class="letter"><b>Letter to ${esc(SHORT[OB.to] || OB.to)}</b><ol>${OB.seq.map((x, i) => `<li>${esc(capF(C.describe({ spec: x, to: OB.to, steps: OB.seq.map(y => ({ spec: y })) }, true)))}${i === OB.seq.length - 1 ? ` <button type="button" class="x" data-popstep="1" aria-label="Remove this step">×</button>` : ''}</li>`).join('')}<li class="now">Step ${OB.seq.length + 1}: being written below</li></ol></div>`;
  h += row('To', sel('ob-to', ORDER_TO.map(k => [k, k === 'hq' ? 'Your headquarters' : k === 'army' ? 'The whole army (general retreat)' : capF(R[k].name)]), OB.to).replace('<select', OB.seq.length ? '<select disabled' : '<select'), 'ob-to');
  h += row('Order', sel('ob-act', acts.map(k => [k, capF(C.ACTIONS[k])]), a), 'ob-act');
  if (NEEDS_OBJ.includes(a)) h += row(a === 'observe' ? 'Look at' : 'Where', objSelect(), 'ob-obj') + `<div class="pickrow"><button type="button" class="pickbtn" id="ob-pick" aria-pressed="${G.pick ? 'true' : 'false'}">${OB.point ? 'Mark another point on the map' : 'Or mark a point on the map'}</button></div>`;
  if (a === 'support') h += row('Support', sel('ob-corps', CORPS.filter(c => c !== OB.to).map(c => [c, CORPS_OF[c]]), OB.corps), 'ob-corps');
  if (a === 'sector') {
    h += row('Sector', sel('ob-sector', Object.entries(GB.sectorNames || {}).concat([['none', 'none: hand the front back to me']]), OB.sector), 'ob-sector');
    if (OB.sector !== 'none') h += row('Goal', sel('ob-goal', [['', 'his own judgement']].concat(PLACE_GROUPS.flatMap(g => g[1]).filter(k => SIM.objectives[k]).map(k => [k, 'take ' + SIM.objectives[k].name])), OB.goal), 'ob-goal') + `<p class="sub">With a goal, ${SIM.leaders[FC] ? SIM.leaders[FC].name : 'he'} sends two fresh brigades at it every 20 minutes or so until it is taken. Without one he acts on his own: cavalry charges, following up success.</p>`;
  }
  if (a === 'moveHQ') h += row('To', sel('ob-post', Object.entries(SIM.command.POSTS).map(([k, p]) => [k, capF(p.name) + (p.note ? ` (${p.note})` : '')]), OB.post), 'ob-post') + `<p class="sub">Moving takes 10–20 minutes; orders you write meanwhile wait until you are set up.</p>`;
  if (a === 'retreat') h += row('Rearguard', sel('ob-rg', (GB.rearguards || []).concat([['', 'none: every corps goes as best it can']]), OB.rearguard), 'ob-rg')
    + `<p class="sub">${GB.retreatNote || 'One letter to each corps commander, each carried by its own rider. Each corps marches off the field as its letter arrives; the rearguard stands until the rest are past (two hours at most), then follows. The battle is judged on what you bring away.'}</p>`;
  if (a === 'detach') h += row('Send to', sel('ob-dto', CORPS.filter(c => c !== OB.to).map(c => [c, CORPS_OF[c]]), OB.detachTo), 'ob-dto');
  if (a === 'detach' || (WITH_ACTS.includes(a) && kind !== 'hq' && kind !== 'offmap')) {
    const groups = brigadesFor(OB.to), isDet = a === 'detach';
    h += `<fieldset><legend>${isDet ? 'Which brigades' : 'With'}</legend>${isDet ? '' : `<div class="radios"><label><input type="radio" name="ob-with" value="any"${OB.withMode !== 'these' ? ' checked' : ''}> as he sees fit</label><label><input type="radio" name="ob-with" value="these"${OB.withMode === 'these' ? ' checked' : ''}> these brigades:</label></div>`}
      ${isDet || OB.withMode === 'these' ? `<div class="checks2">${groups.map(([g, recs]) => (groups.length > 1 ? `<h4>${g}</h4>` : '') + recs.map(o => { const u = SIM.byId[o.uid]; return `<label><input type="checkbox" data-wid="${u.id}"${OB.withIds.has(u.id) ? ' checked' : ''}>${esc(u.name)}<span>${u.type === 'art' ? Math.round(o.str) + ' guns' : (u.type === 'cav' ? 'horse ' : 'foot ') + fmt(Math.round(o.str / 50) * 50)}${o.cohWord ? ' · ' + o.cohWord : ''}</span></label>`; }).join('')).join('')}</div>` : ''}</fieldset>`;
  }
  // how
  let how = '';
  const footKind = kind === 'corps' || kind === 'marshal';
  if (a === 'attack' && footKind) how += row('Formation', sel('ob-form', [['', 'as he judges best'], ['attack', 'columns of attack'], ['mass', 'massed division columns'], ['line', 'deployed in line']], OB.formation), 'ob-form') + ((GB.formNote || {})[OB.to] && !OB.formation ? `<p class="sub">${GB.formNote[OB.to]}</p>` : '');
  if ((a === 'advance' || a === 'withdraw') && footKind) how += row('Formation', sel('ob-form', [['', 'as he judges best'], ['columns', 'battalion columns'], ['line', 'deployed in line']], OB.formation), 'ob-form');
  if (a === 'attack') how += row('Press', sel('ob-loss', [['', 'as he judges best (three assaults)'], ['light', 'lightly: one assault, a third of his brigades'], ['normal', 'normally: two assaults'], ['heavy', 'hard: three assaults'], ['any', 'at any cost: four, with everything he has']], OB.losses), 'ob-loss');
  if (a === 'attack' && kind !== 'cavalry') how += row('Bring', `<span class="radios">${kind === 'corps' ? `<label><input type="checkbox" data-bring="guns"${OB.bring.has('guns') ? ' checked' : ''}> his guns</label>` : ''}<label><input type="checkbox" data-bring="sappers"${OB.bring.has('sappers') ? ' checked' : ''}> sappers, to break into buildings</label></span>`);
  if (a === 'bombard') how += row('Guns at', sel('ob-site', [['', 'where the gunners judge: they close to about 1.2 km if out of range'], ['here', 'where they stand now']].concat(SITES.map(k => [k, SIM.objectives[k].name])), OB.site), 'ob-site');
  if (how) h += `<fieldset><legend>How</legend>${how}</fieldset>`;
  { const HN = (GB.fieldNote || {}).holdNote; if (FC && HN && a === 'hold' && (HN.kinds.includes(kind) || HN.to.includes(OB.to))) h += `<p class="sub" style="margin-left:0">While this order stands, ${SIM.leaders[FC] ? SIM.leaders[FC].name : 'the field commander'} cannot take these brigades for attacks or charges of his own.</p>`; }
  // conditions
  if (kind !== 'hq' && kind !== 'offmap') {
    const times = []; for (let t = Math.ceil((SIM.t + 5) / 10) * 10; t <= SIM.light.end - 10; t += 10) times.push([t, SIM.fmtT(t)]);
    const cond = (c, i) => {
      let x = '';
      if (c.type === 'time') x = `Not before <select data-ci="${i}" data-k="after">${times.map(([v, t]) => opt(v, t, c.after)).join('')}</select>`;
      if (c.type === 'place') x = `When <select data-ci="${i}" data-k="sp">${SPS.map(id => opt(id, SIM.spById[id].name, c.sp)).join('')}</select><select data-ci="${i}" data-k="holder">${opt(US, 'is ours', c.holder)}${opt(GAMEB.coalition[ENEMY], 'is held by the enemy', c.holder)}</select>`;
      if (c.type === 'bombard') x = `After <select data-ci="${i}" data-k="by">${GUN_GROUPS.map(([v, t]) => opt(v, t, c.by)).join('')}</select> has fired on <select data-ci="${i}" data-k="target">${opt('', 'any target', c.target || '')}${PLACE_GROUPS.flatMap(g => g[1]).filter(k => SIM.objectives[k]).map(k => opt(k, SIM.objectives[k].name, c.target || '')).join('')}</select> for <select data-ci="${i}" data-k="minutes">${[15, 30, 45, 60, 90].map(m => opt(m, m + ' minutes', c.minutes)).join('')}</select>`;
      if (c.type === 'after') x = `When step <select data-ci="${i}" data-k="step">${OB.seq.map((y, j) => opt(j, `${j + 1} (${C.ACTIONS[y.action]})`, c.step)).join('')}</select><select data-ci="${i}" data-k="when">${opt('start', 'begins', c.when)}${opt('done', 'is done', c.when)}</select>, then wait <select data-ci="${i}" data-k="minutes">${[0, 15, 30, 45, 60, 90].map(m => opt(m, m ? m + ' minutes' : 'no time', c.minutes)).join('')}</select>`;
      return `<div class="cond">${x}<button type="button" class="x" data-delc="${i}" aria-label="Remove this condition">×</button></div>`;
    };
    h += `<fieldset><legend>Conditions</legend>${OB.conds.map(cond).join('')}<div class="addc">${OB.conds.length < 3 ? `<button type="button" class="mini" data-addc="time">+ a time</button><button type="button" class="mini" data-addc="place">+ a farm changes hands</button><button type="button" class="mini" data-addc="bombard">+ after guns have fired</button>${OB.seq.length ? '<button type="button" class="mini" data-addc="after">+ after an earlier step</button>' : ''}` : ''}</div><p class="sub" style="margin-left:0">He judges a farm by what he himself knows of it, and a step done by what his own brigades report.</p></fieldset>`;
    h += `<div class="radios" style="margin:6px 0"><label><input type="checkbox" id="ob-urg"${OB.urgent ? ' checked' : ''}> Urgent: written in half the time, but clarity −0.15</label></div>`;
  }
  h += '<div class="preview" id="ob-prev"></div>';
  box.innerHTML = `<div class="ob">${h}</div>`;
  updatePreview();
}
function leaderOf(to) { return to === BATTERY ? SIM.leaders[XB.battery.cmd] : RKIND(to) === 'hq' ? null : SIM.leaders[to]; }
function updatePreview() {
  const box = $('ob-prev'); if (!box) return;
  const C = SIM.command, spec = specFromOB(); let err = C.validate(spec);
  if (!err && OB.withMode === 'these' && WITH_ACTS.includes(OB.action) && !OB.withIds.size) err = 'Tick the brigades you mean, or leave it to him';
  if (!err && spec.action === 'detach' && OB.withIds.size === 0) err = 'Tick the brigades to send';
  const n = OB.seq.length + 1, steps = OB.seq.map(y => ({ spec: y }));
  if (err) { box.innerHTML = `<div class="err">${esc(err)}.</div>${OB.seq.length ? `<button class="send" id="ob-sendseq">Send the letter without this step (${OB.seq.length} step${OB.seq.length > 1 ? 's' : ''})</button>` : '<button class="send" id="ob-send" disabled>Send the order</button>'}`; return; }
  const text = OB.seq.length ? `${C.RECIPIENTS[spec.to].name}: ` + OB.seq.concat([spec]).map((y, i) => (i ? 'then ' : 'first ') + C.describe({ spec: y, to: spec.to, steps }, true)).join('; ') : C.describe({ spec, to: spec.to }), cl = Math.max(0.3, C.clarity(spec) - 0.05 * (n - 1)), L = leaderOf(spec.to), kind = kindOf(spec.to);
  const CK = WCommand.CK, nap = SIM.leaders[CHIEF], W = SIM.wet;
  let lines = [];
  if (kind !== 'hq' && kind !== 'offmap' && L) lines.push(spec.to === BATTERY ? `${capF(C.RECIPIENTS[BATTERY].name)} answers to ${L.name}’s gunners. Chance it is misread: about ${Math.max(1, Math.round((1 - cl) * (1 - L.skill) * 50))}%.` : `Chance ${L.name} misreads it: about ${Math.max(1, Math.round((1 - cl) * (1 - L.skill) * 50))}%.`);
  const w = CK.WRITE[G.opts.staff], f = (spec.urgent ? 0.5 : 1) * (C.hq.wounded ? 1.5 : 1) * (1 + 0.3 * (n - 1)), wr = [w[0] * f, w[1] * f];
  const rng2 = (a, b) => `${Math.max(1, Math.round(a))}–${Math.max(2, Math.round(b))}`;
  if (spec.action === 'moveHQ') lines.push('Headquarters takes 10–20 minutes to move.');
  else if (spec.action === 'observe') { const p = spec.objective && (spec.objective.point || C.centre(SIM.objectives[spec.objective.place])); if (p) { const d = Math.hypot(p[0] - nap.x, p[1] - nap.y); lines.push(`An aide rides there, looks about him and rides back: about ${rng2(2 * d / CK.RIDER_ROAD, 2.6 * d / (CK.RIDER_CROSS * (1 - 0.4 * W)))} minutes.`); } }
  else if (kind === 'army') { const d = 2500, ride = [d / CK.RIDER_ROAD, d * 1.25 / (CK.RIDER_CROSS * (1 - 0.4 * W))], pass = CK.INTERP, nl = C.RETREAT_TO.length; lines.push(`${nl === 6 ? 'Six' : nl} letters, written together in ${rng2(...wr)} min · each ridden in about ${rng2(...ride)} · passed down in ${rng2(...pass)}.`); lines.push(`${C.hq.moving ? `Headquarters is on the move: the staff start writing once it is set up, about ${hm(C.hq.moving.arriveAt)}` : `The first corps should begin to go back about ${hm(SIM.t + wr[0] + ride[0] + pass[0])}–${hm(SIM.t + wr[1] + ride[1] + pass[1])}`}${spec.conditions.length ? ', and then only when its conditions are met' : ''}.`); lines.push('The enemy will see it within half an hour or so, and follow.'); }
  else if (kind === 'offmap') lines.push(`Written in ${rng2(...wr)} minutes. ${(GB.offmapNote || {}).ride || 'A rider needs hours to find him, and his answer as long to come back.'}`);
  else {
    const p = believedCentre(spec.to), d = p ? Math.hypot(p[0] - nap.x, p[1] - nap.y) : 2500, ride = [d / CK.RIDER_ROAD, d * 1.25 / (CK.RIDER_CROSS * (1 - 0.4 * W))];
    const direct = kind === 'marshal' || kind === 'battery', pass = direct ? CK.INTERP_DIRECT : CK.INTERP;
    const lo = SIM.t + wr[0] + ride[0] + pass[0], hi = SIM.t + wr[1] + ride[1] + pass[1];
    const gm = orderGeom({ spec, to: spec.to });
    if (gm && gm.to && gm.recs.length && spec.action !== 'hold' && spec.action !== 'rally') { const c = centreOf(gm.recs), d2 = Math.hypot(gm.to.pt[0] - c[0], gm.to.pt[1] - c[1]); if (d2 > 150) lines.push(`${gm.recs.length > 1 ? `His ${gm.recs.length} ${gm.recs.every(r => r.type === 'art') ? 'batteries' : 'brigades'} are` : `${SIM.byId[gm.recs[0].uid].name} is`} about ${d2 >= 1000 ? (d2 / 1000).toFixed(1) + ' km' : Math.round(d2 / 50) * 50 + ' m'} ${compWord(bearing(c[0] - gm.to.pt[0], c[1] - gm.to.pt[1]))} of it, as last reported.`); }
    // (5e) how many brigades he would throw in if left to choose (the same rule the engine uses: the nearest fit foot, a share set by the losses you accept and his aggression)
    if (spec.action === 'attack' && !spec.with && L) { const cav = kind === 'cavalry', cands = ownRecs((u, o) => (spec.to === FC ? FRONT.includes(cmdOf(u)) : cmdOf(u) === spec.to) && u.type === (cav ? 'cav' : 'inf') && o.status !== 'broken' && o.task !== 'garrison').length, m = spec.manner || {}, share = m.losses === 'any' ? 1 : m.losses === 'light' ? 0.34 : 0.4 + 0.4 * (L.agg ?? 0.5), nn = Math.max(1, Math.round(cands * share)), lead = Math.max(1, Math.ceil(nn * 0.6)); if (cands) lines.push(`Left to choose, ${L.name} would send about ${lead} brigade${lead > 1 ? 's' : ''}${nn - lead > 0 ? ` with ${nn - lead} more in support` : ''}.`); }
    lines.push(`Written in ${rng2(...wr)} min${G.opts.staff === 'berthier' ? ' (two or three riders)' : ''} · ridden in about ${rng2(...ride)} · passed down in ${rng2(...pass)}.`);
    lines.push(`${C.hq.moving ? `Headquarters is on the move: the staff start writing once it is set up, about ${hm(C.hq.moving.arriveAt)}` : `At the earliest, troops move about ${hm(lo)}–${hm(hi)}`}${OB.seq.length || spec.conditions.length ? ', and then only when its conditions are met' : ''}.`);
    if (n > 1) lines.push(`A letter of ${n} steps: one rider, read and acknowledged together; each step after the first lowers clarity by 0.05 and adds 30% to the writing (est.).`);
    const ex = expectDraftSteps(); const last = ex && ex[ex.length - 1]; if (last && (n > 1 || spec.conditions.length)) lines.push(last.open ? 'It waits on something you cannot time: the timeline under Your orders shows it open-ended.' : `${n > 1 ? 'This step' : 'With its conditions it'} should begin about ${hm(last.act[0])}–${hm(last.act[1])}.`);
    for (const c of spec.conditions) if (c.type === 'bombard' && c.by && c.target && !fireStartGuess(c.by, c.target, ex)) lines.push(`<span class="warn">No order of yours has ${GUN_GROUPS.find(g => g[0] === c.by)[1]} firing on ${SIM.objectives[c.target].name}. Fire on any other place does not count, so unless you send one he will wait.</span>`);
  }
  const canSeq = kind !== 'hq' && kind !== 'offmap' && kind !== 'marshal' && kind !== 'army' && n < 4;
  box.innerHTML = `${LETTERS && spec.to !== 'hq' ? orderLetterHTML(spec, text) : `<div class="otext">“${esc(capF(text))}.”</div>`}<div class="meter">Clarity ${cl.toFixed(2)}<i><b style="width:${Math.round(cl * 100)}%"></b></i></div><div class="times">${lines.join('<br>')}</div><button class="send" id="ob-send">${n > 1 ? `Send the letter (${n} steps)` : 'Send the order'}</button>${canSeq ? `<button class="then" id="ob-then">${n === 1 ? `Add a next step for ${spec.to === BATTERY ? C.RECIPIENTS[BATTERY].name : SHORT[spec.to]}` : `Add step ${n + 1} to this letter`}</button>` : ''}`;
  renderTimeline();
}
function sendOrder(withoutCurrent) {
  const spec = specFromOB(), C = SIM.command, list = withoutCurrent ? OB.seq.slice() : OB.seq.concat([spec]), copy = JSON.parse(JSON.stringify(list)), r = list.length > 1 ? C.orderSeq(list) : C.order(list[0]);
  if (!r.ok) { const b = $('ob-prev'); if (b) b.insertAdjacentHTML('afterbegin', `<div class="err">${esc(r.error)}.</div>`); return; }
  logOrder(copy, r);
  const o = r.order, to = OB.to;
  G.sent = { to: RKIND(to) === 'hq' ? 'headquarters' : C.RECIPIENTS[to].name.replace(/ \(.*\)/, ''), when: (r.orders && r.orders.length > 1 ? `${r.orders.length} ${RKIND(to) === 'army' ? 'letters' : 'steps'}, ` : '') + (RKIND(o.to) === 'hq' ? 'acted on at once' : o.status === 'queued' ? 'held until headquarters is set up' : `ready about ${hm(o.writtenAt)}`) };
  OB = freshOB(to); G.pick = false; G.selOrder = o.id; canvas.classList.remove('tool'); setHint(null);
  renderOB(); renderOrders(); renderHQ(); requestDraw();
}
$('ob').addEventListener('change', e => {
  const t = e.target, id = t.id;
  if (id === 'ob-to') { if (OB.seq.length) { renderOB(); return; } OB = freshOB(t.value); OB.touched = true; G.selOrder = null; renderOB(); frameDraft(); requestDraw(); return; }
  OB.touched = true;
  if (id === 'ob-act') { const keep = { place: OB.place, point: OB.point, conds: OB.conds, urgent: OB.urgent, seq: OB.seq }; OB = Object.assign(freshOB(OB.to), keep, { action: t.value, touched: true }); renderOB(); frameDraft(); requestDraw(); return; }
  if (id === 'ob-obj') { if (t.value !== '__pt') { OB.place = t.value || null; OB.point = null; } renderOB(); frameDraft(); requestDraw(); return; }
  if (id === 'ob-corps') { OB.corps = t.value; frameDraft(); }
  if (id === 'ob-sector') { OB.sector = t.value; renderOB(); requestDraw(); return; }
  if (id === 'ob-goal') { OB.goal = t.value; frameDraft(); }
  if (id === 'ob-post') { OB.post = t.value; frameDraft(); }
  if (id === 'ob-rg') { OB.rearguard = t.value; }
  if (id === 'ob-dto') OB.detachTo = t.value;
  if (t.name === 'ob-with') { OB.withMode = t.value; renderOB(); return; }
  if (t.dataset.wid) { if (t.checked) OB.withIds.add(t.dataset.wid); else OB.withIds.delete(t.dataset.wid); }
  if (id === 'ob-form') OB.formation = t.value;
  if (id === 'ob-loss') OB.losses = t.value;
  if (t.dataset.bring) { if (t.checked) OB.bring.add(t.dataset.bring); else OB.bring.delete(t.dataset.bring); }
  if (id === 'ob-site') OB.site = t.value;
  if (id === 'ob-urg') OB.urgent = t.checked;
  if (t.dataset.ci != null) { const c = OB.conds[+t.dataset.ci], k = t.dataset.k; c[k] = k === 'after' || k === 'minutes' || k === 'step' ? +t.value : k === 'target' ? (t.value || null) : t.value; }
  if (id === 'ob-form' && (GB.formNote || {})[OB.to]) { renderOB(); return; }
  updatePreview(); requestDraw();
});
$('ob').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'ob-pick') { if (G.pick) cancelPick(); else { G.pick = true; canvas.classList.add('tool'); b.setAttribute('aria-pressed', 'true'); setHint('Click the map where you mean. Esc to cancel.'); showMap(); } return; }
  if (b.dataset.addc) { const k = b.dataset.addc; OB.touched = true; OB.conds.push(k === 'time' ? { type: 'time', after: Math.ceil((SIM.t + 30) / 10) * 10 } : k === 'place' ? { type: 'place', sp: GB.condPlace || SPS[0], holder: US } : k === 'after' ? { type: 'after', step: OB.seq.length - 1, when: 'start', minutes: 30 } : { type: 'bombard', by: GUN_GROUPS.some(g => g[0] === OB.to) ? OB.to : GUN_GROUPS[0][0], target: OB.place || null, minutes: 30 }); renderOB(); return; }
  if (b.id === 'ob-then' && !b.disabled) { addStep(); return; }
  if (b.id === 'ob-sendseq') { sendOrder(true); return; }
  if (b.dataset.popstep) { const last = OB.seq.pop(); OB.conds = OB.conds.filter(c => !(c.type === 'after' && c.step >= OB.seq.length)); if (!OB.seq.length) OB.conds = OB.conds.filter(c => c.type !== 'after'); renderOB(); requestDraw(); return; }
  if (b.dataset.delc != null) { OB.conds.splice(+b.dataset.delc, 1); renderOB(); return; }
  if (b.id === 'ob-send' && !b.disabled) sendOrder();
});
// put the step being written into the letter and start the next one for the same commander
function addStep() {
  const spec = specFromOB(); if (SIM.command.validate(spec)) return;
  const seq = OB.seq.concat([spec]), prev = spec;
  OB = freshOB(prev.to); OB.seq = seq; OB.touched = true;
  OB.action = prev.action === 'bombard' ? 'attack' : prev.action; OB.place = prev.objective && prev.objective.place || null; OB.point = prev.objective && prev.objective.point || null;
  OB.conds = [{ type: 'after', step: seq.length - 1, when: 'start', minutes: prev.action === 'bombard' ? 45 : 0 }];
  renderOB(); requestDraw();
}
function cancelPick() { G.pick = false; canvas.classList.remove('tool'); setHint(null); const b = $('ob-pick'); if (b) b.setAttribute('aria-pressed', 'false'); }

/* ---------- drawing on top of the belief map ---------- */
extraDraw = g => {
  if (!SIM || !G) return;
  const s = view.s, zf = zoomF();
  if (viewMode === 'napoleon') {
    const nap = SIM.leaders[CHIEF], [x, y] = P(nap.x, nap.y);
    g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 18); g.stroke(); g.fillStyle = PAL.FR; g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 12, y - 15); g.lineTo(x, y - 11); g.closePath(); g.fill(); g.stroke(); g.restore();
    if (zf > 1.2) label('Headquarters', x + 6, y - 24, 'unit', 'l', PAL.FR, 1, false, 1.1);
    // troops reported for the first time since the last stop
    const B = SIM.command.B[CHIEF];
    for (const id of G.newIds) { const c = B.c.get(id); if (!c) continue; const [cx, cy] = P(c.x, c.y), [W, D] = contactBox(c), r = Math.max(10, Math.max(W, D) * s / 2 + 7); g.save(); g.strokeStyle = PAL.flag; g.lineWidth = 2; g.globalAlpha = 0.9; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore(); }
    // the selected block
    if (G.sel && G.sel.belief) { const h = unitHits.find(h => h.u && ((G.sel.o && h.u.o === G.sel.o) || (G.sel.c && h.u.c === G.sel.c))); if (h && h.pts) { g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 1.2; g.setLineDash([3, 2]); polyFill(g, h.pts); g.stroke(); g.restore(); } }
  }
  // your orders and the one being written (see _game_orders.js)
  drawOrders(g); drawDispatch(g); drawEnemyFocus(g); drawCorpsName(g);
};

/* ---------- map interaction ---------- */
function click(x, y, ptype) {
  if (G && G.pick) {
    const [wx, wy] = screenToWorld(x, y);
    if (wx < 0 || wy < 0 || wx > WM || wy > HM) return;
    OB.point = [wx, wy]; OB.place = null; OB.touched = true; G.selOrder = null; cancelPick(); renderOB(); requestDraw();
    if (narrow()) $('obBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const ah = hitAlarm(x, y); if (ah) { showDispatch(ah.m.id, ah.a.line != null && ah.m.lines && ah.m.lines.length > 1 ? ah.a.line : null); return; } // (9) a !! mark opens its notice
  const u = hitUnit(x, y); readGround(x, y);
  if (!u) { clearHighlights(); tip.hidden = true; return; } // a click on open ground turns every highlight off
  clearHighlights(true);
  if (u.belief === 'own') G.focusCorps = cmdOf(u.unit); // a brigade picks out its whole corps
  if (!u.belief && u.side === SIDE) G.focusCorps = cmdOf(u); // the same on the umpire's map
  if (u.belief === 'enemy') G.focusEnemy = u.c.corps ? { corps: u.c.corps } : { tid: u.c.tid };
  selectUnit(u); renderOrders();
  if (ptype !== 'mouse') showTip(hoverHTML(u, false), x, y);
}
function selHTML(u) {
  if (!u.belief) return unitHTML(u, true);
  let h = hoverHTML(u, false);
  if (u.belief === 'own') {
    const c = cmdOf(u.unit), recs = ownRecs(x => cmdOf(x) === c), men = recs.filter(r => r.type !== 'art').reduce((a, r) => a + r.str, 0), guns = recs.filter(r => r.type === 'art').reduce((a, r) => a + r.str, 0);
    const last = [...SIM.command.inbox].reverse().find(m => m.kind === 'report' && m.from === c), live = liveOrders().filter(o => o.to === c);
    h += `<div class="corpsbox"><b>${CORPS_TITLE[c] || CORPS_OF[c] || c}</b><div>${recs.length} brigades and batteries, about ${fmt(Math.round(men / 100) * 100)} men and ${Math.round(guns)} guns as last reported${last ? ` (last report written ${hm(last.writtenAt)})` : ''}. They are picked out on the map.</div>${live.length ? `<div>Your latest order: ${esc(capF(SIM.command.describe(live[0])))}, ${orderPhase(live[0]).txt}.</div>` : ''}</div>`;
    if (G.phase === 'play' && CORPS.includes(c)) h += `<div class="btns"><button type="button" data-write="${c}">Write to ${SIM.leaders[c].name}</button></div>`;
  }
  if (u.belief === 'enemy') {
    const B = SIM.command.B[CHIEF], c = u.c, kc = c.corps && B.knownCorps && B.knownCorps[c.corps];
    h += c.corps ? `<div class="corpsbox"><b>${SIM.command.CORPSNAME[c.corps] || c.corps}</b><div>${[...B.c.values()].filter(x => x.corps === c.corps && SIM.t - x.t < 200).length} bodies of troops on your map are known to belong to it; they are ringed.${kc && kc.claim ? ` A prisoner put it at about ${fmt(Math.round(kc.claim / 500) * 500)} men (${hm(kc.t)}).` : ''}</div></div>` : `<div class="corpsbox"><div>Nobody has yet told you which corps these troops belong to.</div></div>`;
  }
  return `<div class="tipcard">${h}</div>`;
}
function clearHighlights(keepTip) {
  if (!G) return;
  G.selOrder = null; G.dispSel = null; G.focusCorps = null; G.focusEnemy = null; G.hoverWid = null;
  if (OB) OB.touched = false; // the draft stays in the form; touching it again puts it back on the map
  selectUnit(null); if (!keepTip) tip.hidden = true;
  renderOrders(); renderStop(); renderEarlier(); requestDraw();
}
function selectUnit(u) {
  G.sel = u || null; selected = u && !u.belief ? u : null;
  const d = $('unitDetails');
  if (u) { d.hidden = false; d.open = true; $('unitcard').innerHTML = selHTML(u); } else d.hidden = true;
  requestDraw();
}
$('unitcard').addEventListener('click', e => { const b = e.target.closest('[data-write]'); if (b) writeTo(b.dataset.write); });
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('select,input,textarea,button')) return;
  if (e.key === ' ') { e.preventDefault(); goClick(); }
  else if (e.key === ',' || e.key === '<' || e.key === '.' || e.key === '>') { const i = SPEEDS.indexOf(speed) + (e.key === ',' || e.key === '<' ? -1 : 1); if (i >= 0 && i < SPEEDS.length) setSpeed(SPEEDS[i]); }
  else if (e.key === '+' || e.key === '=') zoomAt(cssW / 2, cssH / 2, 1.4); else if (e.key === '-') zoomAt(cssW / 2, cssH / 2, 1 / 1.4);
  else if (e.key.startsWith('Arrow')) { const d = 60; if (e.key === 'ArrowLeft') view.tx += d; if (e.key === 'ArrowRight') view.tx -= d; if (e.key === 'ArrowUp') view.ty += d; if (e.key === 'ArrowDown') view.ty -= d; clampView(); requestDraw(); scheduleTerrain(false); }
  else if (e.key === 'Escape') { if (G && G.pick) cancelPick(); else clearHighlights(); }
});

/* ---------- the end: the umpire opens his map ---------- */
function endGame() {
  playing = false; G.phase = 'over';
  const C = SIM.command; G.current = C.inbox.slice(G.shown); G.curFrom = G.shown; G.shown = C.inbox.length; G.prevStopT = G.stopT; G.stopT = SIM.t; G.newIds = new Set();
  if (G.pick) cancelPick();
  viewMode = 'compare'; layers.riders = true; $('cartsub').textContent = `${GB.date} · la carte de l’arbitre`;
  renderVerdict(); renderLayers(); legend(); renderAll();
  $('verdictBox').hidden = false; $('verdictBox').open = true;
  $('verdictBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  requestDraw();
  aarStart();
}
const VIEWNOTES = { napoleon: 'Your map as it stood at the end: what you believed.', truth: 'The umpire’s map: every brigade where it really was.', compare: 'Your belief drawn over the truth, which is shown faint underneath.' };
function renderVerdict() {
  const R = SIM.result, C = SIM.command, t = hm;
  const cas = GB.losses;
  const hidden = SIM.log.filter(l => l.cat === 'hidden');
  const mis = C.orders.filter(o => o.from === CHIEF && o.misread);
  const arrivals = {}; for (const l of SIM.log) if (l.cat === 'arrival' && l.unit && SIM.byId[l.unit]) { const k = SIM.byId[l.unit].corps; if (!arrivals[k]) arrivals[k] = l; }
  // (5e) one list in time order: arrivals, hidden events and your misread orders
  const never = Object.entries(arrivals).filter(([k]) => C.CORPSNAME[k] && SIM.units.some(u => u.corps === k && u.side !== SIDE)).map(([k, l]) => ({ t: l.t, s: `The first of ${C.CORPSNAME[k]} reach the edge of the field.` }))
    .concat(SIM.log.filter(l => l.cat === 'hidden').map(l => ({ t: l.t, s: capF(l.text) })))
    .concat(C.orders.filter(o => o.from === CHIEF && o.misread).map(o => ({ t: o.receivedAt, s: `${o.misread} (your order of ${t(o.issuedAt)}).` })))
    .sort((a, b) => a.t - b.t);
  const theirs = SIM.log.filter(l => l.cat === 'orders' && GAMEB.coalition[l.side] && GAMEB.coalition[l.side] !== US);
  const mine = C.orders.filter(o => o.from === CHIEF);
  const fate = o => o.status === 'cancelled' ? 'torn up' : o.status === 'lost' ? 'never arrived: every rider was lost' : RKIND(o.to) === 'hq' ? 'done' : RKIND(o.to) === 'offmap' ? (o.receivedAt ? `reached ${SIM.leaders[o.to] ? SIM.leaders[o.to].name : o.to} ${t(o.receivedAt)}` : 'still on the road') : o.actedAt != null ? `arrived ${t(o.receivedAt)}, acted on ${t(o.actedAt)}` : o.receivedAt ? `arrived ${t(o.receivedAt)}, ${o.status === 'waiting' ? 'its conditions were never met' : 'not acted on'}` : 'still on the road';
  const wd = R.withdrawn, retreatTxt = wd ? `<p class="small">You ordered the retreat at ${t(wd.from)}. Marched off the field in order: ${fmt(wd.men)} of the ${fmt(wd.menAtStart)} formed foot and horse you had then, and ${wd.guns} of ${wd.gunsAll} guns.${wd.stillHere > 500 ? ` Still on the field and formed at the end: ${fmt(wd.stillHere)}, who would get away in the dark.` : ''} ${GB.retreatDay ? ' ' + GB.retreatDay : ''}</p>` : '';
  $('verdict').innerHTML = `<p class="verdict-g">${R.grade}</p><p class="small">The battle ended at ${t(R.t)} (${R.why}). Seed ${SIM.seed}.</p>${retreatTxt}
  <div class="seg" id="viewseg" role="group" aria-label="Whose map"><button data-view="napoleon">Your map</button><button data-view="truth">Umpire’s map</button><button data-view="compare">Both</button></div>
  <p class="small" id="viewnote"></p>
  <div class="tscroll"><table class="forces"><thead><tr><th></th><th>Killed &amp; wounded</th><th>Taken &amp; straggled</th><th>1815 (rules doc)</th></tr></thead><tbody>${cas.map(([n, k, h]) => `<tr><td><span class="dot" style="background:var(--p-${k.toLowerCase()})"></span>${n}</td><td>${fmt(R.cas[k].kw)}</td><td>${fmt(R.cas[k].cap)}</td><td class="small">${h}</td></tr>`).join('')}</tbody></table></div>
  <table class="forces moments"><thead><tr><th>Moment</th><th>This battle</th><th>1815</th></tr></thead><tbody>${HIST.map(([lab, key, h]) => `<tr><td>${lab}</td><td>${SIM.metrics[key] != null ? t(SIM.metrics[key]) : '—'}</td><td class="small">${h}</td></tr>`).join('')}</tbody></table>
  <p style="margin-top:.9em"><b>What you were never told</b></p>
  <ol class="hiddenlist">${never.map(x => `<li><time>${t(x.t)}</time><span>${esc(x.s)}</span></li>`).join('')}</ol>
  <p style="margin-top:.9em"><b>How your orders went</b></p>
  <ol class="hiddenlist">${mine.map(o => `<li><time>${t(o.issuedAt)}</time><span>${esc(capF(C.describe(o)))}<br><span class="small">${o.byScript ? 'Napoleon’s own order, given for you · ' : ''}${fate(o)}${o.misread ? ' · misread: ' + esc(o.misread) : ''}</span></span></li>`).join('') || '<li><time></time><span class="small">You gave no orders.</span></li>'}</ol>
  <details class="inner"><summary>${GB.enemyDecisions || 'The enemy’s decisions'} (${theirs.length})</summary><ol class="hiddenlist">${theirs.map(l => `<li><time>${t(l.t)}</time><span>${esc(capF(l.text))}</span></li>`).join('')}</ol></details>
  <details class="inner"><summary>The umpire’s log: turning points</summary><ol class="hiddenlist">${SIM.log.filter(l => l.important || ['break', 'place', 'army', 'end'].includes(l.cat)).map(l => `<li><time>${t(l.t)}</time><span>${esc(capF(l.text))}</span></li>`).join('')}</ol></details>
  <div class="btnrow"><button class="bigbtn" id="aar-open" type="button">The after-action report</button><button class="bigbtn quiet" id="again" type="button">Fight another battle</button></div>`;
  setView(viewMode);
  $('viewseg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); });
  $('again').addEventListener('click', () => { $('s-seed').value = (Math.random() * 1e6) | 0; newGame(readSetup()); $('setup').hidden = false; G.phase = 'setup'; setRun(); renderAll(); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
function setView(v) { viewMode = v; document.querySelectorAll('#viewseg button, #viewseg2 button').forEach(x => x.setAttribute('aria-pressed', x.dataset.view === v ? 'true' : 'false')); if ($('viewnote')) $('viewnote').textContent = VIEWNOTES[v]; tip.hidden = true; if (G) selectUnit(null); requestDraw(); }
$('viewseg2').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); });
// a flash on the umpire's map where something important happens (as in the replay)
function noteEvent(l) {
  if (!l.important && !['break', 'place'].includes(l.cat)) return;
  const u = l.unit ? SIM.byId[l.unit] : null, sp = l.sp ? SIM.spById[l.sp] : null, at = u && u.onMap ? [u.x, u.y] : sp ? [sp.x, sp.y] : null;
  if (at) flashes.push({ x: at[0], y: at[1], t0: performance.now(), side: l.side || (u && u.side) || SIDE, big: l.cat === 'place' || l.cat === 'army' });
}
function renderUmpLog() {
  if (!G || !G.umpire) return; const list = $('umplog'), frag = document.createDocumentFragment();
  for (; G.logShown < SIM.log.length; G.logShown++) { const l = SIM.log[G.logShown]; if (!(l.important || ['break', 'place', 'army', 'end'].includes(l.cat) || l.cat === 'hidden' || (l.cat === 'orders' && l.side !== SIDE))) continue; const li = document.createElement('li'); li.innerHTML = `<time>${hm(l.t)}</time><span>${esc(capF(l.text))}</span>`; frag.prepend(li); }
  list.prepend(frag); while (list.children.length > 300) list.lastChild.remove();
}

/* ---------- jump to, layers, legend ---------- */
const SECTORS = GB.views; // the map's jump-to buttons
for (const [t, la, lo, z] of SECTORS) { const b = document.createElement('button'); b.textContent = t; b.addEventListener('click', () => { showMap(); if (z === 1.0) { fitView(); scheduleTerrain(true); requestDraw(); return; } flyTo(la, lo, z); }); $('sectors').appendChild(b); }
function renderLayers() {
  const defs = [['myorders', 'Your orders'], ['ulabels', 'Troop names'], ['smoke', 'Powder smoke'], ['tint', 'Height tint'], ['hach', 'Hachures'], ['contours', 'Contours'], ['woods', 'Woods'], ['water', 'Brooks'], ['roads', 'Roads & farms'], ['dusk', 'Dusk shading']]
    .concat(G && (G.phase === 'over' || G.umpire) ? [['units', 'True troops'], ['flashes', 'Event flashes'], ['riders', 'Riders'], ['orders', 'Orders & charges'], ['broken', 'Broken units']] : []);
  const lw = $('layers'); lw.innerHTML = '';
  for (const [k, t] of defs) { const l = document.createElement('label'), i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!layers[k]; i.addEventListener('change', () => { layers[k] = i.checked; if (['tint', 'hach', 'contours', 'woods', 'water'].includes(k)) scheduleTerrain(true); updateDusk(); requestDraw(); }); l.append(i, document.createTextNode(t)); lw.appendChild(l); }
}
function updateDusk() { const d = $('dusk'); if (!SIM || !layers.dusk) { d.style.opacity = 0; return; } const v = SIM.bgVis(SIM.t), day = 8000; d.style.opacity = Math.max(0, Math.min(0.3, (1 - v / day) * 0.38 - 0.05)).toFixed(3); }
function legend() {
  const items = [
    ['own', SIDE, 'Your brigade, where it last reported; it fades as the report ages'], ['owncav', SIDE, 'Your cavalry (hatched)'], ['ownart', SIDE, 'Your battery'],
    ['inf', ENEMY, 'Enemy infantry as seen or reported, fading with age'], ['cav', ENEMY, 'Enemy cavalry'], ['unk', '', 'Troops nobody has identified'],
    ['old', ENEMY, 'An older report, with how far they may have moved since'], ['brk', ENEMY, 'Seen running'], ['hold', SIDE, 'Who you last heard holds a farm or village'],
    ['plume', '', 'Smoke rising from a burning farm'], ['new', '', 'Reported for the first time since your last stop'], ['hq', SIDE, 'Your headquarters'],
    ['draft', '', 'The order you are writing; its brigades are picked out and the rest dimmed'], ['dnews', '', 'What the dispatch you tapped told you about'], ['dsound', '', 'The bearing guns or musketry were heard on'], ['osent', '', 'An order sent, no word back yet'], ['oack', '', 'Acknowledged by its commander'], ['ounder', '', 'Reported under way'], ['oghost', '', 'Where you expect a move to end; gone once they report there'],
  ];
  const L = $('legend'); L.innerHTML = '';
  for (const [k, side, t] of items) {
    const c = document.createElement('canvas'); c.width = 68; c.height = 36; const g = c.getContext('2d'); g.scale(2, 2); g.fillStyle = PAL.paper; g.fillRect(0, 0, 34, 18);
    const col = side ? sideColor(side) : PAL.ink;
    const hatch = () => { g.save(); g.beginPath(); g.rect(5, 5, 24, 8); g.clip(); g.strokeStyle = col; g.lineWidth = 1; for (let d = -8; d < 30; d += 3) { g.beginPath(); g.moveTo(5 + d, 13); g.lineTo(13 + d, 5); g.stroke(); } g.restore(); g.strokeStyle = col; g.strokeRect(5, 5, 24, 8); };
    if (k === 'own' || k === 'inf') { g.globalAlpha = 0.9; g.fillStyle = col; g.fillRect(5, 6, 24, 7); g.globalAlpha = 1; g.fillStyle = PAL.ink; g.fillRect(5, 5, 24, 1.4); }
    if (k === 'owncav' || k === 'cav') hatch();
    if (k === 'ownart') { g.strokeStyle = col; g.strokeRect(5, 6, 24, 6); g.fillStyle = col; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(7 + i * 4, 8, 1.1, 0, 7); g.fill(); } }
    if (k === 'unk') { g.fillStyle = PAL.hach; g.globalAlpha = 0.35; g.fillRect(5, 5, 24, 9); g.globalAlpha = 1; g.strokeStyle = PAL.hach; g.setLineDash([3, 2]); g.strokeRect(5, 5, 24, 9); g.setLineDash([]); g.fillStyle = PAL.ink; g.font = "bold 9px Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 17, 9.5); }
    if (k === 'old') { g.strokeStyle = col; g.globalAlpha = 0.5; g.setLineDash([2, 3]); g.beginPath(); g.arc(17, 9, 8, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha = 0.4; g.fillStyle = col; g.fillRect(10, 7, 14, 4); g.globalAlpha = 1; }
    if (k === 'brk') { g.globalAlpha = 0.4; g.fillStyle = col; g.fillRect(5, 6, 24, 7); g.globalAlpha = 1; g.strokeStyle = PAL.ink; g.lineWidth = 0.6; g.setLineDash([2, 2]); g.strokeRect(5, 6, 24, 7); g.setLineDash([]); }
    if (k === 'hold') { g.fillStyle = PAL.build; g.fillRect(9, 9, 8, 6); g.strokeStyle = PAL.ink; g.lineWidth = 0.8; g.beginPath(); g.moveTo(19, 15); g.lineTo(19, 3); g.stroke(); g.fillStyle = col; g.fillRect(19, 3, 8, 5); }
    if (k === 'plume') { g.fillStyle = 'rgba(90,85,80,0.55)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(14 + i * 3, 13 - i * 4, 3 + i * 1.5, 0, 7); g.fill(); } }
    if (k === 'new') { g.strokeStyle = PAL.flag; g.lineWidth = 1.6; g.beginPath(); g.arc(17, 9, 7, 0, 7); g.stroke(); g.globalAlpha = 0.85; g.fillStyle = sideColor(ENEMY); g.fillRect(12, 7.5, 10, 3); g.globalAlpha = 1; }
    if (['draft', 'osent', 'oack', 'ounder'].includes(k)) { const o = PAL.order, w = { draft: 3, osent: 1.6, oack: 2, ounder: 2.4 }[k], d = { draft: [], osent: [4, 3], oack: [7, 2], ounder: [] }[k]; g.lineCap = 'round'; g.strokeStyle = o; g.lineWidth = w; g.setLineDash(d); g.beginPath(); g.moveTo(3, 12); g.lineTo(20, 8); g.stroke(); g.setLineDash([]); g.globalAlpha = k === 'draft' ? 0.25 : 0.12; g.fillStyle = o; g.beginPath(); g.arc(26, 7, 5, 0, 7); g.fill(); g.globalAlpha = 1; g.lineWidth = 1.2; g.beginPath(); g.arc(26, 7, 5, 0, 7); g.stroke(); }
    if (k === 'dnews') { g.strokeStyle = PAL.flag; g.lineWidth = 2; g.beginPath(); g.arc(12, 9, 6, 0, 7); g.stroke(); g.globalAlpha = 0.85; g.fillStyle = sideColor(ENEMY); g.fillRect(8, 7.5, 8, 3); g.globalAlpha = 1; g.setLineDash([3, 2]); g.lineWidth = 1.4; g.beginPath(); g.moveTo(19, 13); g.lineTo(30, 6); g.stroke(); g.setLineDash([]); }
    if (k === 'dsound') { g.beginPath(); g.moveTo(4, 15); g.lineTo(30, 3); g.lineTo(30, 13); g.closePath(); g.globalAlpha = 0.2; g.fillStyle = PAL.flag; g.fill(); g.globalAlpha = 1; g.strokeStyle = PAL.flag; g.setLineDash([3, 2]); g.stroke(); g.setLineDash([]); }
    if (k === 'oghost') { g.globalAlpha = 0.2; g.fillStyle = PAL.order; g.fillRect(5, 6, 24, 6); g.globalAlpha = 1; g.strokeStyle = PAL.order; g.setLineDash([3, 2]); g.lineWidth = 1.2; g.strokeRect(5, 6, 24, 6); g.setLineDash([]); }
    if (k === 'hq') { g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(14, 16); g.lineTo(14, 3); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(14, 3); g.lineTo(23, 5); g.lineTo(14, 8); g.closePath(); g.fill(); }
    const sp = document.createElement('span'); sp.textContent = t; L.append(c, sp);
  }
}


/* ---------- (step 6) the order log: every order and tear-up with its minute, so the battle can be fought again ---------- */
// The same settings, seed and log fight the same battle (WReplay in replay.js); the after-action report re-runs it with changes.
function logOrder(list, r) {
  const i = G.orderLog.length, os = r.orders || [r.order];
  G.orderLog.push(list.length > 1 ? { i, t: SIM.t, k: 'seq', specs: list } : { i, t: SIM.t, k: 'order', spec: list[0] });
  os.forEach((o, step) => { G.orderIdx[o.id] = { i, step }; });
  G.made[i] = os.map(o => o.id);
}
function logCancel(o) { const m = G.orderIdx[o.id]; if (m) G.orderLog.push({ i: G.orderLog.length, t: SIM.t, k: 'cancel', ref: m.i, step: m.step }); }
// what Napoleon came to know of the farms and villages, and when (for the report's "when you knew" lane)
function noteKnowledge() {
  const B = SIM.command.B[CHIEF], prev = G.knewNow || (G.knewNow = {});
  for (const id of SPS) { const pb = B.places[id]; if (!pb) continue; const h = pb.holder || null; if (!(id in prev)) { prev[id] = h; continue; } if (prev[id] !== h) { G.knew.push({ sp: id, holder: h, t: SIM.t, src: pb.src }); prev[id] = h; } }
}
// read-only hooks for the tests and the umpire's review
globalThis.WGame = { runToEnd: () => { while (SIM && !SIM.over) stepGame(); }, marks: () => G && G.marks, screenOf: id => { const sp = SIM.spById[id]; return P(sp.x, sp.y); }, log: () => G && G.orderLog, opts: () => G && G.opts, result: () => SIM && SIM.result, t: () => SIM && SIM.t, metrics: () => SIM && SIM.metrics,
  clock: () => SIM && ({ t: SIM.t, shown: shownT(), frac, speed, playing, tickMs: tickMs(), glides: GLIDE.size, glideBusy }), lerp: id => SIM && SIM.byId[id] && lerpPos(SIM.byId[id]), stopKinds: () => G ? G.current.filter(m => m.pause !== false).map(m => msgKinds(m)) : [], lerpAll: () => SIM ? SIM.units.filter(u => u.onMap && !u.gone).map(u => [u.id, ...lerpPos(u).map(v => Math.round(v * 10) / 10)]) : [] };
