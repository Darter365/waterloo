/* ================= your orders on the map: the one being written, and every one you have sent ================= */
// Everything here is drawn from what Napoleon knows: where his brigades last reported, and what his corps commanders have told him.
const TASKMATCH = { attack: ['attack', 'cavRaid', 'charge', 'garrison', 'garrisonGo'], advance: ['move', 'march'], withdraw: ['move', 'march'], bombard: ['bombard'], screen: ['screen'], retreat: ['retire', 'rearguard'], support: ['support', 'attack'], hold: ['hold'], rally: ['rally'], detach: ['move'] };
const SHORT = GB.short; // (phase 5) the battle's short names for the recipients
const DOING = { retreat: 'going back', attack: 'attacking', advance: 'on the move', withdraw: 'on the move', detach: 'on the move', bombard: 'firing', screen: 'out screening', support: 'supporting', hold: 'holding', rally: 're-forming' };
const STAGES = [['writing', 'Being written'], ['sent', 'Sent'], ['ack', 'Acknowledged'], ['under', 'Under way'], ['done', 'Done']];

/* ----- which brigades an order concerns, as Napoleon knows them ----- */
function ownRecs(f) { const B = SIM.command.B[CHIEF]; return [...B.own.values()].filter(o => !o.gone && SIM.byId[o.uid] && f(SIM.byId[o.uid], o)); }
function orderRecs(o) {
  const s = o.spec, to = o.to || s.to, a = s.action;
  if (Array.isArray(s.with) && s.with.length) return ownRecs(u => s.with.includes(u.id));
  if (RKIND(to) === 'hq' || RKIND(to) === 'offmap') return [];
  if (to === BATTERY) return ownRecs(u => u.type === 'art' && (GB_IDS.includes(u.id) || u.gbattery));
  const mine = u => to === FC ? FRONT.includes(cmdOf(u)) : cmdOf(u) === to;
  if (a === 'bombard') return ownRecs(u => mine(u) && u.type === 'art');
  if (a === 'screen') return ownRecs(u => mine(u) && u.type === 'cav');
  if (a === 'attack' || a === 'advance' || a === 'withdraw' || a === 'support') {
    const cavCorps = kindOf(to) === 'cavalry';
    const r = ownRecs(u => mine(u) && (cavCorps ? u.type === 'cav' : u.type === 'inf'));
    if (r.length) return r;
  }
  if (a === 'rally') { const r = ownRecs((u, o) => mine(u) && u.type !== 'art' && (o.status === 'broken' || o.task === 'rally' || (o.coh != null && o.coh < 55))); return r.length ? r : ownRecs(u => mine(u) && u.type !== 'art'); }
  return ownRecs(u => mine(u));
}
const centreOf = recs => recs.length ? [recs.reduce((a, o) => a + o.x, 0) / recs.length, recs.reduce((a, o) => a + o.y, 0) / recs.length] : null;

/* ----- where an order sends them ----- */
function objGeom(spec) {
  const C = SIM.command, o = spec.objective;
  if (spec.action === 'moveHQ') return { pt: SIM.ll2m(...SIM.command.POSTS[spec.post].at), r: 90 };
  if (spec.action === 'sector') { if (!spec.goal) return null; const ob = SIM.objectives[spec.goal]; if (!ob) return null; return ob.line && !ob.sp ? { line: ob.line, pt: C.centre(ob) } : { pt: C.centre(ob), r: ob.sp ? 160 : 220 }; }
  if (spec.action === 'support') { const p = believedCentre(o && o.corps); return p ? { pt: p, r: 260 } : null; }
  if (!o) return null; if (o.point) return { pt: o.point, r: 140 };
  if (o.place) { const ob = SIM.objectives[o.place]; if (!ob) return null; if (ob.line && !ob.sp) return { line: ob.line, pt: C.centre(ob) }; return { pt: C.centre(ob), r: ob.sp ? 160 : 220 }; }
  return null;
}
function orderGeom(o) {
  const s = o.spec, a = s.action, nap = SIM.leaders[CHIEF], recs = orderRecs(o);
  let to = objGeom(s), from = null, froms = null, kind = a === 'attack' ? 'attack' : 'move';
  if (a === 'moveHQ' || a === 'observe') { from = [nap.x, nap.y]; kind = a === 'observe' ? 'look' : 'hq'; }
  else if (a === 'bombard') { froms = recs.map(r => [r.x, r.y]); kind = 'fire'; }
  else if (a === 'hold' || a === 'rally') { const c = centreOf(recs); if (!c) return null; const spread = Math.max(...recs.map(q => Math.hypot(q.x - c[0], q.y - c[1]))); to = recs.length > 1 && spread > 250 ? { pt: c, r: 0, ring: true, each: recs.map(q => [q.x, q.y]) } : { pt: c, r: spread + 180, ring: true }; kind = 'hold'; }
  else if (a === 'sector') { from = centreOf(recs); kind = 'goal'; }
  else from = centreOf(recs);
  if (!to) return null;
  return { from, froms, to, kind, recs };
}

/* ----- how far an order has got, as far as Napoleon knows ----- */
const PH_RANK = { torn: -1, writing: 0, sent: 1, ack: 2, under: 3, done: 4 };
function orderPhase(o) {
  const raw = rawPhase(o); if (!G || o.from !== CHIEF || raw.k === 'torn' || raw.k === 'writing') return raw;
  const L = G.latch[o.id] || (G.latch[o.id] = {});
  if (raw.k === 'under' && L.under == null) L.under = raw.at;
  if (raw.k === 'done' && !L.done) { L.done = { at: raw.at, txt: raw.txt }; if (L.under == null) L.under = raw.at; }
  if (L.done) return { k: 'done', at: L.done.at, txt: L.done.txt, underAt: L.under };
  if (L.under != null) return raw.k === 'under' ? Object.assign({}, raw, { at: L.under, underAt: L.under }) : { k: 'under', at: L.under, underAt: L.under, txt: `reported ${DOING[o.spec.action] || 'under way'} from ${hm(L.under)}; by the latest reports none are now` };
  return raw;
}
function rawPhase(o) {
  const C = SIM.command, B = C.B[CHIEF], s = o.spec, t = SIM.t;
  if (o.status === 'cancelled') return { k: 'torn', txt: 'torn up' };
  if (o.status === 'queued') return { k: 'writing', txt: 'waiting until headquarters is set up' };
  if (o.to === 'hq') {
    if (s.action === 'moveHQ') return C.hq.moving && C.hq.moving.to === s.post ? { k: 'under', at: o.issuedAt, txt: `riding there, set up about ${hm(C.hq.moving.arriveAt)}` } : { k: 'done', at: o.issuedAt, txt: C.hq.post === s.post ? 'headquarters set up' : 'done' };
    return o.status === 'done' ? { k: 'done', txt: 'the aide is back' } : { k: 'under', at: o.issuedAt, txt: `the aide rode out at ${hm(o.issuedAt)}` };
  }
  if (t < o.writtenAt) return { k: 'writing', at: o.writtenAt, txt: `being written, ready about ${hm(o.writtenAt)}` };
  if (RKIND(o.to) === 'offmap') { const r = C.inbox.find(m => m.from === o.to && m.writtenAt >= o.sentAt); return r ? { k: 'ack', at: r.t, txt: `answered ${hm(r.writtenAt)}` } : { k: 'sent', at: o.sentAt, txt: `sent ${hm(o.sentAt)} · no answer yet` }; }
  const recs = orderRecs(o), geo = objGeom(s);
  // done: the farm is ours, or the brigades are reported where they were sent
  if (s.action === 'attack' && s.objective && s.objective.place) { const ob = SIM.objectives[s.objective.place]; if (ob && ob.sp) { const pb = B.places[ob.sp]; if (pb && pb.holder === US && pb.t > o.sentAt) return { k: 'done', at: pb.t, txt: `${ob.name} taken (${pb.src.replace(/, \d\d:\d\d$/, '')}, ${hm(pb.t)})` }; } }
  if ((s.action === 'advance' || s.action === 'withdraw') && geo && recs.length) {
    const there = recs.filter(r => r.t > o.sentAt && Math.hypot(r.x - geo.pt[0], r.y - geo.pt[1]) < (geo.r || 200) + 250);
    if (there.length >= Math.max(1, Math.ceil(recs.length / 2))) return { k: 'done', at: Math.max(...there.map(r => r.t)), txt: `reported there ${hm(Math.max(...there.map(r => r.t)))}` };
  }
  // under way: brigades report doing what was ordered, after it could have arrived
  const want = TASKMATCH[s.action] || [], sp = s.objective && s.objective.place && SIM.objectives[s.objective.place] ? SIM.objectives[s.objective.place].sp : null;
  // a hold order is "under way" only from reports written after he acknowledged it: they were holding before it came
  const going = recs.filter(r => r.tState > o.sentAt + 5 && (s.action !== 'hold' || (o.ackedAt != null && r.tState >= o.ackedAt - 10)) && want.includes(r.task) && (!sp || s.action !== 'attack' || !r.sp || r.sp === sp));
  const word = recs.every(r => r.type === 'art') ? ['battery', 'batteries'] : ['brigade', 'brigades'];
  if (going.length) { const at = Math.min(...going.map(r => r.tState)); return { k: 'under', at, n: going.length, txt: `${going.length} of ${recs.length} ${word[recs.length > 1 ? 1 : 0]} reported ${DOING[s.action] || 'under way'} (latest report ${hm(Math.max(...going.map(r => r.tState)))})` }; }
  if (o.ackedAt) return { k: 'ack', at: o.ackedAt, txt: `acknowledged ${hm(o.ackedAt)}${s.conditions.length ? ', waiting on its conditions' : ''}` };
  return { k: 'sent', at: o.sentAt, txt: `sent ${hm(o.sentAt)} · no word yet` };
}
// the orders worth drawing: the latest to each recipient, and anything picked in the list
// a letter's steps: the order that carried it and the steps that rode with it
const letterOf = o => { const C = SIM.command, head = o.carrier ? C.orders.find(x => x.id === o.carrier) : o; return head && head.seq && head.seq.ids ? head.seq.ids.map(id => C.orders.find(x => x.id === id)).filter(Boolean) : [o]; };
function liveOrders() {
  const C = SIM.command, latest = {};
  for (const o of C.orders) { if (o.from !== CHIEF || o.status === 'cancelled' || o.carrier) continue; latest[o.to] = o; }
  const out = [];
  for (const head of Object.values(latest)) for (const o of letterOf(head)) { if (RKIND(o.to) === 'offmap') continue; const ph = orderPhase(o); if (ph.k !== 'done' || SIM.t - (ph.at ?? 0) < 30 || o.id === G.selOrder) out.push(o); }
  return out;
}

/* ----- drawing ----- */
function cased(g, build, w, col, alpha, dash) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.globalAlpha = 0.8 * alpha; g.strokeStyle = PAL.paper; g.lineWidth = w + 4; g.setLineDash([]); g.beginPath(); build(); g.stroke();
  g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); build(); g.stroke(); g.restore();
}
function arrowHead(g, x, y, an, size, col, alpha) {
  const pts = [[x, y], [x - size * Math.cos(an - 0.42), y - size * Math.sin(an - 0.42)], [x - size * Math.cos(an + 0.42), y - size * Math.sin(an + 0.42)]];
  g.save(); g.globalAlpha = alpha; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath();
  g.strokeStyle = PAL.paper; g.lineWidth = 3; g.stroke(); g.fillStyle = col; g.fill(); g.restore();
}
// st: { w, dash, alpha, fill, label, labelForce, ghost }
function drawGlyph(g, gm, st) {
  const col = PAL.order, s = view.s, T = gm.to; let [px, py] = P(T.pt[0], T.pt[1]);
  let rScr = 0;
  // the objective
  if (T.line) {
    const [a, b] = T.line, [x0, y0] = P(a[0], a[1]), [x1, y1] = P(b[0], b[1]), band = Math.max(8, 140 * s);
    g.save(); g.globalAlpha = st.fill; g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = band; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
    cased(g, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); }, Math.max(1.5, st.w - 1), col, st.alpha, st.dash);
    rScr = 0;
  } else if (T.each) {
    // a spread-out corps told to hold or re-form: a small dotted ring on each brigade
    for (const q of T.each) { const [qx, qy] = P(q[0], q[1]), rr = Math.max(9, 110 * s); cased(g, () => g.arc(qx, qy, rr, 0, 7), Math.max(1.5, st.w - 1), col, st.alpha, [3, 4]); }
    const top = T.each.reduce((a, q) => q[1] < a[1] ? q : a, T.each[0]); [px, py] = P(top[0], top[1]); rScr = Math.max(9, 110 * s);
  } else {
    rScr = Math.max(9, (T.r || 140) * s);
    g.save(); g.globalAlpha = st.fill; g.fillStyle = col; g.beginPath(); g.arc(px, py, rScr, 0, 7); g.fill(); g.restore();
    cased(g, () => g.arc(px, py, rScr, 0, 7), Math.max(1.5, st.w - 1), col, st.alpha, T.ring ? [3, 4] : st.dash);
  }
  // the movement
  const line = (f, head) => {
    const [fx, fy] = P(f[0], f[1]), d = Math.hypot(px - fx, py - fy); if (d < rScr + 14) return;
    const an = Math.atan2(py - fy, px - fx), ex = px - Math.cos(an) * (rScr + 3), ey = py - Math.sin(an) * (rScr + 3);
    cased(g, () => { g.moveTo(fx, fy); g.lineTo(ex, ey); }, st.w, col, st.alpha, st.dash);
    if (head) arrowHead(g, ex, ey, an, 9 + st.w * 1.6, col, st.alpha);
  };
  if (gm.froms) gm.froms.forEach(f => line(f, false));
  else if (gm.from && gm.kind !== 'hold') line(gm.from, gm.kind !== 'look');
  // where you expect them to end up (moves only): a dashed outline at the objective, confirmed when they report there
  if (st.ghost && gm.from && (gm.kind === 'move') && gm.recs.length) {
    const width = Math.min(1600, gm.recs.reduce((a, r) => { const u = SIM.byId[r.uid]; return a + (u ? SIM.footprint(Object.assign({}, u, { form: 'line', str: r.str })).F : 300); }, 0) * 0.8);
    const an = T.line ? Math.atan2(T.line[1][1] - T.line[0][1], T.line[1][0] - T.line[0][0]) * 180 / Math.PI : Math.atan2(T.pt[1] - gm.from[1], T.pt[0] - gm.from[0]) * 180 / Math.PI + 90, pts = quadAt(T.pt[0], T.pt[1], an, width, 60);
    g.save(); polyFill(g, pts); g.globalAlpha = 0.18 * st.alpha; g.fillStyle = col; g.fill(); g.globalAlpha = st.alpha; g.setLineDash([4, 3]); g.strokeStyle = col; g.lineWidth = 1.6; g.stroke(); g.restore();
  }
  if (st.label) label(st.label, px + rScr + 6, py - Math.max(10, rScr * 0.4) + (st.labelRow || 0) * 15, 'unit', 'l', col, st.labelForce ? 0 : 2.5, !!st.labelForce, 1.12);
}
const PHASE_STYLE = {
  draft: { w: 4, dash: [], alpha: 1, fill: 0.2 },
  writing: { w: 2, dash: [2, 5], alpha: 0.6, fill: 0.05 },
  sent: { w: 2.2, dash: [7, 5], alpha: 0.75, fill: 0.07 },
  ack: { w: 2.8, dash: [12, 4], alpha: 0.9, fill: 0.1 },
  under: { w: 3.2, dash: [], alpha: 0.95, fill: 0.12 },
  done: { w: 2, dash: [], alpha: 0.45, fill: 0.06 },
};
const PHASE_WORD = { writing: 'being written', sent: 'sent, no word yet', ack: 'acknowledged', under: 'under way', done: 'done' };
function drawOrders(g) {
  if (!SIM || !G || !PAL.order) return;
  const zf = zoomF(), drafting = G.phase === 'play' && OB && OB.touched;
  // your orders already sent
  if (layers.myorders && viewMode !== 'truth') for (const o of liveOrders()) {
    const gm = orderGeom(o); if (!gm) continue;
    const ph = orderPhase(o), sel = o.id === G.selOrder, base = PHASE_STYLE[ph.k] || PHASE_STYLE.sent;
    const st = Object.assign({}, base, sel ? { w: base.w + 1.5, alpha: 1, fill: base.fill + 0.06 } : drafting ? { alpha: base.alpha * 0.45 } : {});
    st.ghost = ph.k !== 'done'; st.labelForce = sel; st.labelRow = o.seq ? o.seq.index : 0;
    st.label = sel || zf >= 1.35 ? `${SHORT[o.to] || o.to}${o.seq ? ` · step ${o.seq.index + 1}` : ''} · ${PHASE_WORD[ph.k] || ph.txt}${ph.at != null && ph.k !== 'writing' ? ' ' + hm(ph.at) : ''}` : null;
    drawGlyph(g, gm, st);
  }
  // the order being written
  if (drafting) {
    const specs = OB.seq.concat([specFromOB()]);
    specs.forEach((sp, i) => { const gm = orderGeom({ spec: sp, to: OB.to }); if (gm) drawGlyph(g, gm, Object.assign({}, PHASE_STYLE.draft, i < specs.length - 1 ? { w: 3, alpha: 0.8 } : {}, { ghost: true, labelForce: true, labelRow: i, label: `${SHORT[OB.to] || ''} · ${specs.length > 1 ? 'step ' + (i + 1) + ' of your draft' : 'your draft order'}` })); });
  }
  // a brigade you are pointing at in the order's list
  if (G.hoverWid) { const h = unitHits.find(h => h.u && h.u.o && h.u.o.uid === G.hoverWid); if (h && h.pts) { const cx = h.pts.reduce((a, p) => a + p[0], 0) / 4, cy = h.pts.reduce((a, p) => a + p[1], 0) / 4; g.save(); g.strokeStyle = PAL.order; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.stroke(); g.restore(); } }
}
// which of your brigades to pick out on the map (everyone else is dimmed)
function updateFocus() {
  let ids = null;
  if (G && G.phase === 'play' && OB && OB.touched && !['hq', 'offmap', 'army'].includes(RKIND(OB.to))) {
    const spec = specFromOB(); ids = new Set((OB.withMode === 'these' && OB.withIds.size ? ownRecs(u => OB.withIds.has(u.id)) : spec.action === 'detach' ? ownRecs(u => OB.withIds.has(u.id) || cmdOf(u) === OB.to) : orderRecs({ spec, to: OB.to })).map(r => r.uid));
    for (const st of OB.seq) for (const r of orderRecs({ spec: st, to: OB.to })) ids.add(r.uid); // every step of the letter
  } else if (G && G.selOrder) { const o = SIM.command.orders.find(x => x.id === G.selOrder); if (o && RKIND(o.to) !== 'hq' && RKIND(o.to) !== 'offmap') ids = new Set(orderRecs(o).map(r => r.uid)); }
  else if (G && G.focusCorps) ids = new Set(ownRecs(u => cmdOf(u) === G.focusCorps).map(r => r.uid));
  let col = null;
  if (!ids && G && G.dispSel) { const r = dispRefs(); if (r && r.own && r.own.length) { ids = new Set(r.own); col = PAL.flag; } }
  beliefFocus = ids && ids.size ? ids : null; beliefFocusCol = col;
}
// bring the brigades and the place they are sent to into view
function frameDraft() { if (!OB || !OB.touched) return; const gm = orderGeom({ spec: specFromOB(), to: OB.to }); const pts = (gm ? gm.recs.map(r => [r.x, r.y]).concat(gm.to ? [gm.to.pt] : []) : orderRecs({ spec: specFromOB(), to: OB.to }).map(r => [r.x, r.y])); frameTo(pts, 2.4); }
function frameOrder(o) { const gm = orderGeom(o); if (gm) frameTo(gm.recs.map(r => [r.x, r.y]).concat([gm.to.pt]), 2.4); }
// (5e) orders never zoom in closer than about 2.4 times the whole sheet, and the frame is at least 2 km across, so the ground around stays in view
function frameTo(pts, maxZ) {
  if (!pts.length) return;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 500, mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const hw = Math.max(1000, (Math.max(...xs) - Math.min(...xs)) / 2 + pad), hh = Math.max(700, (Math.max(...ys) - Math.min(...ys)) / 2 + pad);
  const x0 = mx - hw, x1 = mx + hw, y0 = my - hh, y1 = my + hh;
  const [sx0, sy0] = P(x0, y0), [sx1, sy1] = P(x1, y1);
  if (sx0 >= 0 && sy0 >= 0 && sx1 <= cssW && sy1 <= cssH && view.s >= s0 * 1.2) return; // already in view
  const z = Math.max(1, Math.min(maxZ || 3.6, Math.min(cssW / (s0 * (x1 - x0)), cssH / (s0 * (y1 - y0)))));
  const [la, lo] = m2ll((x0 + x1) / 2, (y0 + y1) / 2); flyTo(la, lo, z);
}

/* ----- the list of your orders ----- */
function stepper(o, ph) {
  if (o.to === 'hq' || o.status === 'cancelled') return '';
  const order = ['writing', 'sent', 'ack', 'under', 'done'], k = order.indexOf(ph.k);
  const when = { writing: '', sent: o.sentAt != null && SIM.t >= o.sentAt ? hm(o.sentAt) : '', ack: o.ackedAt != null || ph.underAt != null ? hm(Math.min(o.ackedAt ?? Infinity, ph.underAt ?? (ph.k === 'under' ? ph.at : Infinity))) : '', under: ph.underAt != null ? hm(ph.underAt) : ph.k === 'under' ? hm(ph.at) : '', done: ph.k === 'done' ? hm(ph.at) : '' };
  return `<div class="stepper">${STAGES.filter(([key]) => !(key === 'writing' && k > 0)).map(([key, lab]) => { const i = order.indexOf(key); return `<span class="${i < k ? 'on' : i === k ? 'cur' : ''}">${lab}${(i <= k && when[key]) ? ' ' + when[key] : ''}</span>`; }).join('<i>›</i>')}</div>`;
}
function renderOrders() {
  const C = SIM.command, mine = C.orders.filter(o => o.from === CHIEF).slice().reverse();
  $('orders').innerHTML = mine.map(o => { const ph = orderPhase(o); return `<li class="st-${o.status}${o.id === G.selOrder ? ' sel' : ''}" data-oid="${o.id}" tabindex="0"><time>${hm(o.issuedAt)}</time><div>${o.seq ? `<span class="stepno">Step ${o.seq.index + 1} of ${o.seq.n}</span>` : ''}<b>${esc(capF(C.describe(o)))}</b>${stepper(o, ph)}<p class="small">${capF(ph.txt)} · clarity ${o.clarity.toFixed(2)}${o.status === 'writing' && SIM.t < o.writtenAt ? ` <button class="tear" data-tear="${o.id}">Tear it up</button>` : ''}</p></div></li>`; }).join('') || '<li class="none">No orders yet.</li>';
  updateFocus(); renderTimeline();
}
function pickOrder(id) {
  G.selOrder = G.selOrder === id ? null : id;
  if (G.selOrder && OB) OB.touched = false; // looking at a sent order, not drafting
  renderOrders(); updateFocus();
  const o = SIM.command.orders.find(x => x.id === G.selOrder); if (o) { showMap(); frameOrder(o); }
  requestDraw();
}
$('orders').addEventListener('click', e => {
  const b = e.target.closest('[data-tear]'); if (b) { const o = SIM.command.orders.find(x => x.id === b.dataset.tear); if (SIM.command.cancel(o)) { logCancel(o); renderOrders(); requestDraw(); } return; }
  const li = e.target.closest('li[data-oid]'); if (li) pickOrder(li.dataset.oid);
});
$('orders').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-oid]')) { e.preventDefault(); pickOrder(e.target.dataset.oid); } });
// pointing at a brigade's name in the order form rings it on the map
$('ob').addEventListener('mouseover', e => { const l = e.target.closest('.checks2 label'); const id = l && l.querySelector('[data-wid]') ? l.querySelector('[data-wid]').dataset.wid : null; if (id !== G.hoverWid) { G.hoverWid = id; requestDraw(); } });
$('ob').addEventListener('mouseleave', () => { if (G.hoverWid) { G.hoverWid = null; requestDraw(); } });

/* ================= the timeline: when each order should happen, and what the reports say did ================= */
// Expected times use the same estimates as the order preview: staff writing time, a rider's speed over the ground as it is,
// and the 10-20 minutes a corps commander needs to pass an order down. A condition you cannot time (a farm changing hands,
// a step being done) leaves the bar open-ended.
function rideTimes(to) {
  const CK = WCommand.CK, nap = SIM.leaders[CHIEF], W = SIM.wet, p = believedCentre(to), d = p ? Math.hypot(p[0] - nap.x, p[1] - nap.y) : 2500;
  return [d / CK.RIDER_ROAD, d * 1.25 / (CK.RIDER_CROSS * (1 - 0.4 * W))];
}
function fireStartGuess(by, target, draftStarts) {
  // your latest bombardment order for those guns on that target: when the reports say they opened, or else when they should
  for (const o of SIM.command.orders.slice().reverse()) if (o.from === CHIEF && o.status !== 'cancelled' && o.to === by && o.spec.action === 'bombard' && (!target || (o.spec.objective && o.spec.objective.place === target))) {
    const ph = orderPhase(o); if (ph.k === 'under' || ph.k === 'done') { const a = ph.underAt ?? ph.at; return [a, a]; }
    const e = expectOrder(o); return e.open ? null : e.guns || e.act;
  }
  if (draftStarts) for (const d of draftStarts) if (d.spec.to === by && d.spec.action === 'bombard' && (!target || (d.spec.objective && d.spec.objective.place === target)) && !d.open) return d.guns || d.act;
  // any target will do: as early as the first report that has them firing
  if (!target) { const recs = ownRecs(u => u.type === 'art' && (by === BATTERY ? (GB_IDS.includes(u.id) || u.gbattery) : cmdOf(u) === by && !u.gbattery)).filter(r => r.task === 'bombard'); if (recs.length) { const t = Math.min(...recs.map(r => r.tState)); return [t, t]; } }
  return null;
}
function expectSpec(spec, t0, written, n, prevStarts, draftStarts) {
  const CK = WCommand.CK, to = spec.to, direct = RKIND(to) === 'marshal' || RKIND(to) === 'battery', pass = direct ? CK.INTERP_DIRECT : CK.INTERP;
  if (!written) { const w = CK.WRITE[G.opts.staff], f = (spec.urgent ? 0.5 : 1) * (SIM.command.hq.wounded ? 1.5 : 1) * (1 + 0.3 * ((n || 1) - 1)); written = [t0 + w[0] * f, t0 + w[1] * f]; }
  const ride = rideTimes(to), arrive = [written[0] + ride[0], written[1] + ride[1]], begin = [arrive[0] + pass[0], arrive[1] + pass[1]];
  let act = begin.slice(), open = false;
  for (const c of spec.conditions || []) {
    if (c.type === 'time') act = [Math.max(act[0], c.after), Math.max(act[1], c.after)];
    else if (c.type === 'bombard') { const fs = fireStartGuess(c.by || GUN_GROUPS[0][0], c.target || null, draftStarts); if (!fs) open = true; else act = [Math.max(act[0], fs[0] + c.minutes), Math.max(act[1], fs[1] + c.minutes)]; }
    else if (c.type === 'after') { const ps0 = c.order ? refStart(c.order) : prevStarts && prevStarts[c.step], ps = ps0 && !c.order && ps0.guns ? Object.assign({}, ps0, { act: ps0.guns }) : ps0; if (!ps || ps.open || c.when === 'done') open = true; else act = [Math.max(act[0], ps.act[0] + (c.minutes || 0)), Math.max(act[1], ps.act[1] + (c.minutes || 0))]; }
    else if (c.type === 'place') open = true;
  }
  // guns told to bombard from farther than about 1.7 km first close to about 1.2 km: at roughly 40 m a minute over wet ground, and 5 minutes to unlimber (est.)
  let guns = null;
  if (spec.action === 'bombard' && spec.objective && (spec.objective.place || spec.objective.point)) {
    const tgt = spec.objective.point || SIM.command.centre(SIM.objectives[spec.objective.place]), recs = orderRecs({ spec, to }).filter(r => r.type === 'art');
    if (recs.length) { const c = centreOf(recs), d = Math.hypot(tgt[0] - c[0], tgt[1] - c[1]), m = spec.manner || {}, move = m.site === 'here' ? 0 : m.site && SIM.objectives[m.site] ? Math.hypot(SIM.command.centre(SIM.objectives[m.site])[0] - c[0], SIM.command.centre(SIM.objectives[m.site])[1] - c[1]) : Math.max(0, d - 1200) * (d > 1700 ? 1 : 0), mins = move > 60 ? move / (60 * (1 - 0.5 * SIM.wet) + 10) + 5 : 0; guns = [act[0] + mins, act[1] + mins * 1.3]; }
  }
  return { spec, t0, written, arrive, begin, act, open, guns };
}
function refStart(id) { const o = SIM.command.orders.find(x => x.id === id); if (!o) return null; const ph = orderPhase(o); if (ph.k === 'under' || ph.k === 'done') { const a = ph.underAt ?? ph.at; return { act: [a, a], open: false }; } const e = expectOrder(o); return o.spec.action === 'bombard' ? Object.assign({}, e, { act: e.guns || e.act }) : e; }
function expectOrder(o) {
  const key = SIM.t + ':' + SIM.command.orders.length; // a new order (a bombardment, say) can change when this one should start
  if (o._exT === key && o._ex) return o._ex;
  const n = o.seq ? o.seq.n : 1, written = o.writtenAt != null && o.status !== 'queued' ? [o.writtenAt, o.writtenAt] : null;
  const ex = expectSpec(o.spec, o.issuedAt, written, n, null, null);
  if (o.ackedAt) { ex.arrive = [Math.min(ex.arrive[0], o.ackedAt), Math.min(ex.arrive[1], o.ackedAt)]; }
  o._ex = ex; o._exT = key; return ex;
}
function expectDraftSteps() {
  if (!OB || !G || G.phase !== 'play') return null;
  const specs = OB.seq.concat([specFromOB()]).map(x => Object.assign({ conditions: [] }, x)), out = [];
  if (specs.some(x => SIM.command.validate(x))) return null;
  const n = specs.length, first = expectSpec(specs[0], SIM.t, null, n, out, out); out.push(first);
  for (let i = 1; i < n; i++) out.push(expectSpec(specs[i], SIM.t, first.written, n, out, out));
  return out;
}
function renderTimeline() {
  const box = $('otl'); if (!box || !SIM || !G) return;
  const rows = [];
  for (const o of liveOrders()) { if (o.to === 'hq') continue; rows.push({ o, ex: expectOrder(o), ph: orderPhase(o) }); }
  if (OB && OB.touched && G.phase === 'play' && !['hq', 'offmap', 'army'].includes(RKIND(OB.to))) { const d = expectDraftSteps(); if (d) d.forEach((ex, i) => rows.push({ draft: true, i, n: d.length, ex })); }
  if (!rows.length) { box.innerHTML = ''; return; }
  const now = SIM.t, tMin = Math.floor(Math.min(now - 15, ...rows.map(r => r.ex.t0)) / 10) * 10;
  let tMax = Math.max(now + 60, ...rows.map(r => r.ex.act[1] + 15)); tMax = Math.min(tMax, tMin + 300);
  const W = 330, L = 6, R = 6, rowH = 30, top = 16, H = top + rows.length * rowH + 6, x = t => L + (Math.max(tMin, Math.min(tMax, t)) - tMin) / (tMax - tMin) * (W - L - R);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="otlsvg" role="img" aria-label="Timeline of your orders: expected stages and what the reports say">`;
  for (let t = Math.ceil(tMin / 30) * 30; t <= tMax; t += 30) if (x(t) > 14 && x(t) < W - 14) svg += `<line class="tk" x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${H}"/><text class="tkl" x="${x(t)}" y="${top - 6}">${SIM.fmtT(t)}</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH, by = y + 15, ex = r.ex, s = ex.spec, who = SHORT[s.to] || s.to;
    const lab = r.draft ? `Draft${r.n > 1 ? ' step ' + (r.i + 1) : ''}: ${who}, ${WOrders.ACTIONS[s.action]}${s.objective && s.objective.place ? ' ' + SIM.objectives[s.objective.place].name : ''}` : `${who}${r.o.seq ? ' · step ' + (r.o.seq.index + 1) : ''}: ${WOrders.ACTIONS[s.action]}${s.objective && s.objective.place ? ' ' + SIM.objectives[s.objective.place].name : ''}`;
    svg += `<g class="row${r.draft ? ' draft' : ''}${r.o && r.o.id === G.selOrder ? ' sel' : ''}"${r.o ? ` data-oid="${r.o.id}"` : ''}><rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}"/><text class="lab" x="${L}" y="${y + 10}">${esc(lab.length > 58 ? lab.slice(0, 56) + '…' : lab)}</text>`;
    const seg = (a, b, cls) => { if (b - a < 0.5) return ''; return `<rect class="${cls}" x="${x(a)}" y="${by}" width="${Math.max(1, x(b) - x(a))}" height="8"/>`; };
    svg += seg(ex.t0, ex.written[1], 'sw') + seg(ex.written[0], ex.arrive[1], 'sr') + seg(ex.arrive[0], ex.begin[1], 'sp');
    if (ex.act[1] > ex.begin[0] + 1) svg += seg(ex.begin[0], ex.act[1], 'sc');
    if (ex.open) svg += `<line class="open" x1="${x(ex.begin[0])}" x2="${W - R}" y1="${by + 4}" y2="${by + 4}"/><text class="q" x="${W - R - 2}" y="${by + 7}">?</text>`;
    else svg += `<line class="exr" x1="${x(ex.act[0])}" x2="${x(ex.act[1])}" y1="${by + 4}" y2="${by + 4}"/><path class="exd" d="M${x(ex.act[0])} ${by - 1} l4 5 l-4 5 l-4 -5 z"/>`;
    if (r.ph) {
      if (r.o.ackedAt) svg += `<path class="ack" d="M${x(r.o.ackedAt) - 3} ${by + 3} l2.5 3 l5 -6"/>`;
      if (r.ph.k === 'under' || r.ph.k === 'done') { const a0 = r.ph.underAt ?? r.ph.at, a1 = r.ph.k === 'done' ? Math.max(r.ph.at, a0 + 1) : now; svg += `<rect class="real" x="${x(a0)}" y="${by + 1}" width="${Math.max(2, x(a1) - x(a0))}" height="6"/>`; }
      if (r.ph.k === 'done') svg += `<circle class="done" cx="${x(r.ph.at)}" cy="${by + 4}" r="3.5"/>`;
      if (r.o.status === 'lost') svg += `<text class="q" x="${x(now) + 4}" y="${by + 7}">no word</text>`;
    }
    svg += '</g>';
  });
  svg += `<line class="now" x1="${x(now)}" x2="${x(now)}" y1="${top - 4}" y2="${H}"/>`;
  box.innerHTML = svg + '</svg><div class="otlkey"><span><i class="k sw"></i>written</span><span><i class="k sr"></i>riding</span><span><i class="k sp"></i>passed down</span><span><i class="k sc"></i>waiting</span><span><i class="k exd"></i>expected start</span><span><i class="k real"></i>reported doing it</span></div>';
}
$('otl') && $('otl').addEventListener('click', e => { const g = e.target.closest('[data-oid]'); if (g) pickOrder(g.dataset.oid); });
