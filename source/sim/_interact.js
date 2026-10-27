/* ================= interaction ================= */
let selected = null;
const tip = document.getElementById('tip'), status = document.getElementById('status'), hint = document.getElementById('modehint');
const pointers = new Map(); let dragStart = null, pinch = null, moved = false;
function screenToWorld(x, y) { return [(x - view.tx) / view.s, (y - view.ty) / view.s]; }
function clampView() { const minS = s0 * 0.8, maxS = s0 * 16; view.s = Math.min(maxS, Math.max(minS, view.s));
  const mx = cssW * 0.6, my = cssH * 0.6; view.tx = Math.min(cssW - mx * 0.2, Math.max(view.tx, cssW * 0.4 - WM * view.s)); view.ty = Math.min(cssH - my * 0.2, Math.max(view.ty, cssH * 0.4 - HM * view.s)); }
function zoomAt(px, py, f) { const [wx, wy] = screenToWorld(px, py); view.s *= f; clampView(); view.tx = px - wx * view.s; view.ty = py - wy * view.s; clampView(); requestDraw(); scheduleTerrain(false); }
let anim = null;
function flyTo(la, lo, z) {
  const [wx, wy] = ll2m(la, lo), S = s0 * z, F = { ...view }, t0 = performance.now();
  cancelAnimationFrame(anim);
  const stepF = now => { const t = Math.min(1, (now - t0) / 520), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    view.s = Math.exp(Math.log(F.s) + (Math.log(S) - Math.log(F.s)) * e);
    const cxF = (cssW / 2 - F.tx) / F.s, cyF = (cssH / 2 - F.ty) / F.s, cx = cxF + (wx - cxF) * e, cy = cyF + (wy - cyF) * e;
    view.tx = cssW / 2 - cx * view.s; view.ty = cssH / 2 - cy * view.s; requestDraw();
    if (t < 1) anim = requestAnimationFrame(stepF); else { scheduleTerrain(true); requestDraw(); } };
  anim = requestAnimationFrame(stepF);
}
function hitUnit(x, y) {
  for (let i = unitHits.length - 1; i >= 0; i--) { const h = unitHits[i];
    if (h.kind === 'circle') { if (Math.hypot(x - h.x, y - h.y) <= h.r) return h.u; }
    else { let ins = false; const p = h.pts; for (let a = 0, b = p.length - 1; a < p.length; b = a++) { if ((p[a][1] > y) !== (p[b][1] > y) && x < (p[b][0] - p[a][0]) * (y - p[a][1]) / (p[b][1] - p[a][1]) + p[a][0]) ins = !ins; } if (ins) return h.u;
      const cx = p.reduce((s, q) => s + q[0], 0) / 4, cy = p.reduce((s, q) => s + q[1], 0) / 4; if (Math.hypot(x - cx, y - cy) < 5) return h.u; } }
  return null;
}
function hitOff(x, y) { for (const h of offHits) if (Math.hypot(x - h.x, y - h.y) < h.r) return h.o; return null; }
function showTip(html, x, y) { tip.innerHTML = html; tip.hidden = false; const tw = tip.offsetWidth, th = tip.offsetHeight; let lx = x + 16, ly = y + 14; if (lx + tw > cssW - 6) lx = x - tw - 14; if (ly + th > cssH - 6) ly = y - th - 12; tip.style.left = Math.max(6, lx) + 'px'; tip.style.top = Math.max(6, ly) + 'px'; }
function readGround(x, y) {
  const [wx, wy] = screenToWorld(x, y);
  if (wx < 0 || wy < 0 || wx > WM || wy > HM) { status.textContent = 'Off the sheet.'; return; }
  const ob = obstacleAt(wx, wy), sm = SIM ? SIM.smokeAt(wx, wy) : 0;
  status.textContent = `Ground ${hAt(wx, wy).toFixed(0)} m · slope ${slopeDegAt(wx, wy).toFixed(1)}° · ${whereIs(wx, wy)}${ob[0] ? ' · in ' + (ob[1] === 'wood' ? ob[2] : ob[1] === 'building' ? 'the buildings of ' + ob[2] : ob[2]) : ''}${sm > 0.4 ? ' · smoke ' + (sm > 1.6 ? 'thick' : sm > 0.9 ? 'heavy' : 'drifting') : ''}`;
}
let hoverAt = null;
function refreshTip() { if (!hoverAt || tip.hidden) return; const u = hitUnit(hoverAt[0], hoverAt[1]); if (u) showTip(hoverHTML(u, false), hoverAt[0], hoverAt[1]); }
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (pointers.size === 1 && typeof penDown === 'function' && penDown(e.offsetX, e.offsetY)) { dragStart = null; return; } // the game's pencil (8c)
  if (pointers.size === 1) { dragStart = { x: e.offsetX, y: e.offsetY, tx: view.tx, ty: view.ty }; moved = false; }
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s, w: screenToWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; moved = true; }
});
canvas.addEventListener('pointermove', e => {
  const x = e.offsetX, y = e.offsetY;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [x, y]);
  if (typeof penMove === 'function' && penMove(x, y, pointers.size)) return;
  if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; view.s = pinch.s * d / pinch.d; clampView(); view.tx = cx - pinch.w[0] * view.s; view.ty = cy - pinch.w[1] * view.s; clampView(); requestDraw(); scheduleTerrain(false); return; }
  if (dragStart && pointers.size === 1) {
    const dx = x - dragStart.x, dy = y - dragStart.y;
    if (!moved && Math.hypot(dx, dy) > 5) { moved = true; canvas.classList.add('pan'); tip.hidden = true; }
    if (moved) { view.tx = dragStart.tx + dx; view.ty = dragStart.ty + dy; clampView(); requestDraw(); scheduleTerrain(false); return; }
  }
  if (e.pointerType === 'mouse') {
    hoverAt = [x, y]; readGround(x, y);
    const u = hitUnit(x, y), ah = u || typeof hitAlarm !== 'function' ? null : hitAlarm(x, y), o = u || ah ? null : hitOff(x, y);
    if (u) showTip(hoverHTML(u, false), x, y); else if (ah) { const t = alarmTip(ah); showTip(`<b>${t.title}</b><div>${t.text}</div>`, x, y); } else if (o) showTip(`<b>${o.title}</b><div>${o.text}</div>`, x, y); else tip.hidden = true;
  }
});
function endPointer(e) {
  if (pointers.size === 1 && typeof penUp === 'function' && penUp(e.offsetX, e.offsetY)) { pointers.delete(e.pointerId); dragStart = null; return; }
  const wasMoved = moved; pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 1) { const [q] = [...pointers.values()]; dragStart = { x: q[0], y: q[1], tx: view.tx, ty: view.ty }; }
  if (pointers.size === 0) { canvas.classList.remove('pan'); dragStart = null; if (wasMoved) { scheduleTerrain(true); requestDraw(); } else if (e.type === 'pointerup' && !(typeof glassTap === 'function' && glassTap(e.offsetX, e.offsetY))) click(e.offsetX, e.offsetY, e.pointerType); }
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { tip.hidden = true; hoverAt = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016))); }, { passive: false });
canvas.addEventListener('dblclick', e => zoomAt(e.offsetX, e.offsetY, 1.8));
function setHint(t) { if (t) { hint.textContent = t; hint.hidden = false; } else hint.hidden = true; }
document.getElementById('zin').addEventListener('click', () => zoomAt(cssW / 2, cssH / 2, 1.6));
document.getElementById('zout').addEventListener('click', () => zoomAt(cssW / 2, cssH / 2, 1 / 1.6));
document.getElementById('zfit').addEventListener('click', () => { fitView(); scheduleTerrain(true); requestDraw(); });
