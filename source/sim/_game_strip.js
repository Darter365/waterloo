/* ================= orders from the map (release 4) ================= */
// Tap one of your brigades and a strip opens on the map for its commander: Attack, Advance, Hold. Tap the place, and the order is
// ready to send without leaving the map. The strip writes the same draft the form does (OB), so the form below always shows what the
// strip holds, and what the strip cannot say (which brigades, formation, conditions, a letter of several steps) is under More.
// A tap within reach of a named place takes the place; anywhere else it marks the point.
const STRIP = { to: null, stage: null }; // stage: action, place, ready, sent
const STRIP_ACTS = [['attack', 'Attack'], ['advance', 'Advance'], ['hold', 'Hold']];
const STRIP_VERB = { attack: 'to attack', advance: 'to advance to' };
const STRIP_SNAP = 28; // a tap this many screen pixels from a named place takes the place (and never less than 150 m)
function stripName(to) { const L = SIM.leaders[to]; return L ? L.name : capF((SIM.command.RECIPIENTS[to] || {}).name || to); }
function stripOpen(to) {
  if (!SIM || !G || G.phase !== 'play' || !ORDER_TO.includes(to) || !SIM.command.RECIPIENTS[to]) { stripClose(); return; }
  if (typeof GLASS !== 'undefined' && GLASS.on) return;
  if (G.pick) cancelPick();
  STRIP.to = to; STRIP.stage = 'action'; stripRender();
}
function stripClose() { if (STRIP.stage === 'place' && G && G.pick) cancelPick(); STRIP.to = null; STRIP.stage = null; const s = $('strip'); if (s) s.hidden = true; }
function stripRender() {
  const s = $('strip'); if (!s) return;
  if (!STRIP.to || !SIM || !G || G.phase !== 'play') { s.hidden = true; return; }
  const C = SIM.command, to = STRIP.to, who = `<b>${esc(stripName(to))}</b>`, x = '<button type="button" class="strip-x" data-strip="close" aria-label="Close">×</button>';
  let h = '';
  if (STRIP.stage === 'action') {
    const acts = STRIP_ACTS.filter(([a]) => C.ALLOWED[kindOf(to)].includes(a));
    h = `<div class="strip-t">${who}${x}</div><div class="strip-b">${acts.map(([a, t]) => `<button type="button" data-strip="act" data-act="${a}">${t}</button>`).join('')}<button type="button" class="quiet" data-strip="more">More…</button></div>`;
  } else if (STRIP.stage === 'place') {
    h = `<div class="strip-t"><span>Tap the place for ${who} ${STRIP_VERB[OB.action] || 'to go to'}.</span>${x}</div>`;
  } else if (STRIP.stage === 'ready') {
    const spec = specFromOB(), err = C.validate(spec);
    h = `<div class="strip-t"><span>${who}: ${esc(C.describe({ spec, to }, true))}</span>${x}</div>${err ? `<div class="err">${esc(err)}.</div>` : ''}<div class="strip-b"><button type="button" class="go" data-strip="send"${err ? ' disabled' : ''}>Send</button>${NEEDS_OBJ.includes(OB.action) ? '<button type="button" data-strip="place">Another place</button>' : ''}<button type="button" class="quiet" data-strip="more">More…</button></div>`;
  } else if (STRIP.stage === 'sent') {
    h = `<div class="strip-t"><span>Your order to ${esc(G.sent ? G.sent.to : stripName(to))} is with the staff${G.sent ? ` (${esc(G.sent.when)})` : ''}.</span>${x}</div>`;
  }
  s.innerHTML = h; s.hidden = false;
}
function stripAct(a) {
  const to = STRIP.to; OB = freshOB(to); OB.action = a; OB.touched = true; G.selOrder = null; G.sent = null;
  if (NEEDS_OBJ.includes(a)) stripAskPlace(); else { STRIP.stage = 'ready'; renderOB(); stripRender(); requestDraw(); }
}
function stripAskPlace() { STRIP.stage = 'place'; G.pick = true; canvas.classList.add('tool'); setHint(null); renderOB(); stripRender(); requestDraw(); }
// the map was tapped while the strip waited for a place (called from click() in pick mode)
function stripPlace(wx, wy) {
  let best = null, bd = Math.max(150, STRIP_SNAP / view.s);
  for (const [k, o] of Object.entries(SIM.objectives)) { if (!o.point || !PLACE_GROUPS.some(([, keys]) => keys.includes(k)) || ((GB.placeOnlyAt || {})[k] && G.opts.scenario !== GB.placeOnlyAt[k])) continue; const d = Math.hypot(o.point[0] - wx, o.point[1] - wy); if (d < bd) { bd = d; best = k; } }
  if (best) { OB.place = best; OB.point = null; } else { OB.point = [wx, wy]; OB.place = null; }
  OB.touched = true; G.selOrder = null; cancelPick(); STRIP.stage = 'ready'; renderOB(); stripRender(); requestDraw();
}
$('strip').addEventListener('click', e => {
  const b = e.target.closest('[data-strip]'); if (!b || !STRIP.to) return;
  const k = b.dataset.strip;
  if (k === 'close') { stripClose(); return; }
  if (k === 'act') { stripAct(b.dataset.act); return; }
  if (k === 'place') { stripAskPlace(); return; }
  if (k === 'more') { const to = STRIP.to, drafted = STRIP.stage === 'ready' || STRIP.stage === 'place'; stripClose(); if (!drafted) { OB = freshOB(to); OB.touched = true; } renderOB(); $('obBox').open = true; $('obBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (k === 'send') { const before = SIM.command.orders.length; sendOrder(false); if (SIM.command.orders.length > before) { STRIP.stage = 'sent'; stripRender(); } else stripRender(); }
});
// test hooks (release4test.py)
globalThis.WGame && Object.assign(globalThis.WGame, {
  strip: () => ({ hidden: $('strip').hidden, text: $('strip').innerText, to: STRIP.to, stage: STRIP.stage, pick: !!(G && G.pick), place: OB && OB.place, point: !!(OB && OB.point), act: OB && OB.action, orders: SIM.command.orders.length, logged: G.orderLog.length, last: SIM.command.orders.length ? SIM.command.describe(SIM.command.orders[SIM.command.orders.length - 1]) : null }),
  tapOf: (corps, place) => { const B = SIM.command.B[CHIEF], o = [...B.own.values()].find(o => cmdOf(SIM.byId[o.uid]) === corps && SIM.byId[o.uid].type === 'inf'), r = canvas.getBoundingClientRect(), [x, y] = P(o.x, o.y), h = SIM.objectives[place].point, [hx, hy] = P(h[0], h[1]); return { x: r.left + x, y: r.top + y, hx: r.left + hx, hy: r.top + hy }; },
  farTap: () => { const r = canvas.getBoundingClientRect(), need = 2 * Math.max(150, STRIP_SNAP / view.s); for (let i = 2; i < 10; i++) for (let j = 2; j < 9; j++) { const x = r.width * i / 12, y = r.height * j / 12, [wx, wy] = screenToWorld(x, y); if (wx < 0 || wy < 0 || wx > WM || wy > HM) continue; if (Object.values(SIM.objectives).every(o => !o.point || Math.hypot(o.point[0] - wx, o.point[1] - wy) > need)) return { x: r.left + x, y: r.top + y }; } return null; },
  phase: () => G && G.phase, fightOut: mode => fightToEnd(mode),
});
