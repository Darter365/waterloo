/* ================= dispatches on the map: what each piece of news changed ================= */
// Each dispatch carries refs: the enemy bodies (tids), your brigades (own), farms (sp), moves since the last news, and for sounds the bearings heard from headquarters.
function refsWorthShowing(r) { return !!(r && ((r.tids && r.tids.length) || (r.own && r.own.length) || (r.sp && r.sp.length) || (r.dirs && r.dirs.length) || (r.moves && r.moves.length) || r.at)); }
function dispItem() { return G && G.dispSel ? SIM.command.inbox.find(x => x.id === G.dispSel.id) || null : null; }
function dispRefs() { const m = dispItem(); if (!m) return null; return G.dispSel.line != null && m.lineRefs ? m.lineRefs[G.dispSel.line] : m.refs; }
function refPoints(r, m) {
  const B = SIM.command.B.napoleon, pts = [];
  for (const id of r.tids || []) { const c = B.c.get(id); if (c) pts.push([c.x, c.y]); }
  for (const id of r.own || []) { const o = B.own.get(id); if (o && !o.gone) pts.push([o.x, o.y]); }
  for (const id of r.sp || []) { const sp = SIM.spById[id]; if (sp) pts.push([sp.x, sp.y]); }
  for (const mv of r.moves || []) pts.push(mv.from, mv.to);
  if (r.dirs && r.dirs.length && m && m.hq) { pts.push(m.hq); for (const b of r.dirs) pts.push([m.hq[0] + Math.sin(b * Math.PI / 180) * 2500, m.hq[1] - Math.cos(b * Math.PI / 180) * 2500]); }
  if (!pts.length && r.at) pts.push(r.at);
  return pts;
}
function showDispatch(id, line) {
  const same = G.dispSel && G.dispSel.id === id && G.dispSel.line === line;
  const m = SIM.command.inbox.find(x => x.id === id);
  G.selOrder = null; G.focusCorps = null; G.focusEnemy = null; if (OB) OB.touched = false; selectUnit(null);
  G.dispSel = same || !m ? null : { id, line };
  renderStop(); renderEarlier(); renderOrders();
  if (G.dispSel) { const r = dispRefs(); if (r) { showMap(); frameTo(refPoints(r, m)); } }
  requestDraw();
}
function ringAt(g, x, y, r, col, w, alpha) { g.save(); g.globalAlpha = alpha ?? 1; g.strokeStyle = PAL.paper; g.lineWidth = w + 3; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore(); }
function drawDispatch(g) {
  const m = dispItem(), r = dispRefs(); if (!m || !r || viewMode === 'truth') return;
  const B = SIM.command.B.napoleon, col = PAL.flag, s = view.s, pts = [];
  // sounds: the bearing they were heard on, from where headquarters stood
  if (r.dirs && r.dirs.length && m.hq) {
    const [hx, hy] = P(m.hq[0], m.hq[1]), R = 3000 * s;
    for (const b of r.dirs) {
      const a = (b - 90) * Math.PI / 180, w = 14 * Math.PI / 180;
      g.save(); g.beginPath(); g.moveTo(hx, hy); g.arc(hx, hy, R, a - w, a + w); g.closePath(); g.globalAlpha = 0.16; g.fillStyle = col; g.fill(); g.globalAlpha = 0.9; g.strokeStyle = col; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.stroke(); g.restore();
      label(m.k === 'muskets' ? 'musketry heard' : m.kind === 'summary' ? 'firing heard' : 'guns heard', hx + Math.cos(a) * R * 0.75, hy + Math.sin(a) * R * 0.75, 'unit', 'c', col, 0, true, 1.1);
    }
  }
  // what moved since the last news of it
  for (const mv of r.moves || []) {
    const [x0, y0] = P(mv.from[0], mv.from[1]), [x1, y1] = P(mv.to[0], mv.to[1]); if (Math.hypot(x1 - x0, y1 - y0) < 8) continue;
    g.save(); g.globalAlpha = 0.6; g.fillStyle = col; g.beginPath(); g.arc(x0, y0, 3, 0, 7); g.fill(); g.restore();
    cased(g, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); }, 1.8, col, 0.9, [4, 3]);
    arrowHead(g, x1, y1, Math.atan2(y1 - y0, x1 - x0), 9, col, 0.9);
  }
  // the enemy bodies it told you about
  for (const id of r.tids || []) { const c = B.c.get(id); if (!c) continue; const [x, y] = P(c.x, c.y), [W, D] = contactBox(c); ringAt(g, x, y, Math.max(11, Math.max(W, D) * s / 2 + 8), col, 2.6); pts.push([x, y]); }
  // your own brigades it was about (when it is a few, ring them as well as picking them out)
  if ((r.own || []).length && r.own.length <= 6) for (const id of r.own) { const h = unitHits.find(h => h.u && h.u.o && h.u.o.uid === id); if (!h || !h.pts) continue; const cx = h.pts.reduce((a, p) => a + p[0], 0) / 4, cy = h.pts.reduce((a, p) => a + p[1], 0) / 4, rr = Math.max(...h.pts.map(p => Math.hypot(p[0] - cx, p[1] - cy))) + 8; ringAt(g, cx, cy, Math.max(12, rr), col, 2.6); }
  // farms that changed hands
  for (const id of r.sp || []) { const sp = SIM.spById[id]; if (!sp) continue; const [x, y] = P(sp.x, sp.y); ringAt(g, x, y, Math.max(16, 120 * s), col, 3); const pb = B.places[id]; label(`${sp.name}: ${pb && pb.holder === 'FR' ? 'ours' : pb && pb.holder ? 'the enemy’s' : 'empty'}`, x, y - Math.max(16, 120 * s) - 10, 'unit', 'c', col, 0, true, 1.1); }
  if (!(r.tids || []).length && !(r.sp || []).length && !(r.own || []).length && !(r.dirs || []).length && r.at) { const [x, y] = P(r.at[0], r.at[1]); ringAt(g, x, y, 18, col, 3); }
  // a caption at the top of the picture
  const all = refPoints(r, m).map(p => P(p[0], p[1])); if (all.length) { const top = all.reduce((a, p) => p[1] < a[1] ? p : a, all[0]); label(m.title, top[0], Math.max(20, top[1] - 34), 'unit', 'c', col, 0, true, 1.2); }
}
// an enemy body you clicked: if its corps is known, ring every body of that corps
function drawEnemyFocus(g) {
  if (!G || !G.focusEnemy || viewMode === 'truth') return;
  const B = SIM.command.B.napoleon, s = view.s, F = G.focusEnemy;
  const list = F.corps ? [...B.c.values()].filter(c => c.corps === F.corps && SIM.t - c.t < 200) : [B.c.get(F.tid)].filter(Boolean);
  for (const c of list) { const [x, y] = P(c.x, c.y), [W, D] = contactBox(c); ringAt(g, x, y, Math.max(11, Math.max(W, D) * s / 2 + 8), SIDECOL(c.side), 2.4, 0.9); }
  if (F.corps && list.length) { const cx = list.reduce((a, c) => a + c.x, 0) / list.length, cy = Math.min(...list.map(c => c.y)); const [x, y] = P(cx, cy); label(WCommand.CORPSNAME[F.corps] || F.corps, x, y - 26, 'group', 'c', SIDECOL(list[0].side), 0, true, 1); }
}
// your corps, when you click one of its brigades: its name over it
function drawCorpsName(g) {
  if (!G || !G.focusCorps || !beliefFocus) return;
  const recs = ownRecs(u => cmdOf(u) === G.focusCorps); if (!recs.length) return;
  const cx = recs.reduce((a, r) => a + r.x, 0) / recs.length, cy = Math.min(...recs.map(r => r.y)), [x, y] = P(cx, cy);
  label((CORPS_TITLE[G.focusCorps] || G.focusCorps).toUpperCase(), x, y - 30, 'group', 'c', PAL.order, 0, true, 1);
}
