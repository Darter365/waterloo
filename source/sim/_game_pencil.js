/* ================= 8c. pencil marks ================= */
// Your own marks on the staff map: lines and arrows drawn with a finger or the mouse, and short notes. Nothing in the battle reads
// them. They stay on the map for the rest of the battle, and the after-action report lists your notes.
const PEN = { mode: null, stroke: null, at: null };
function penMode(m) {
  if (!G) return;
  PEN.mode = PEN.mode === m ? null : m; PEN.stroke = null; closeNote();
  document.querySelectorAll('#penctl button[data-pen]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pen === PEN.mode ? 'true' : 'false'));
  canvas.classList.toggle('tool', !!PEN.mode);
  if (PEN.mode && G.pick) cancelPick();
  if (PEN.mode && typeof glassOff === 'function') glassOff();
  setHint(PEN.mode === 'line' ? 'Pencil: drag to draw. Two fingers still pan and zoom. Tap ✎ again to put the pencil down.' : PEN.mode === 'note' ? 'Tap where the note should go.' : PEN.mode === 'rub' ? 'Tap a mark to rub it out.' : null);
}
const marks = () => G ? (G.marks || (G.marks = [])) : [];
// the hooks _interact.js calls before it pans: each returns true when the pencil has taken the pointer
function penDown(x, y) { if (!PEN.mode || !G) return false; if (PEN.mode === 'line') PEN.stroke = { kind: 'line', pts: [screenToWorld(x, y)], t: SIM ? SIM.t : null }; PEN.at = [x, y]; return true; }
function penMove(x, y, n) {
  if (!PEN.mode || !G) return false;
  if (n !== 1) { PEN.stroke = null; PEN.at = null; return false; } // a second finger: let it pan and pinch
  if (PEN.stroke) { const w = screenToWorld(x, y), l = PEN.stroke.pts[PEN.stroke.pts.length - 1]; if (Math.hypot(w[0] - l[0], w[1] - l[1]) * view.s > 3) { PEN.stroke.pts.push(w); requestDraw(); } }
  return !!PEN.at;
}
function penUp(x, y) {
  if (!PEN.mode || !G || !PEN.at) return false;
  const tap = Math.hypot(x - PEN.at[0], y - PEN.at[1]) < 6; PEN.at = null;
  if (PEN.mode === 'line' && PEN.stroke) { if (PEN.stroke.pts.length >= 2) marks().push(PEN.stroke); PEN.stroke = null; requestDraw(); }
  else if (PEN.mode === 'note' && tap) openNote(x, y);
  else if (PEN.mode === 'rub' && tap) { const i = nearestMark(x, y); if (i >= 0) { marks().splice(i, 1); requestDraw(); } }
  return true;
}
function nearestMark(x, y) {
  let best = -1, bd = 18;
  marks().forEach((m, i) => {
    if (m.kind === 'note') { const [sx, sy] = P(m.at[0], m.at[1]); const d = Math.hypot(sx - x, sy - y) - (x > sx && x < sx + m.text.length * 7 && Math.abs(y - sy) < 10 ? 18 : 0); if (d < bd) { bd = d; best = i; } return; }
    for (let k = 1; k < m.pts.length; k++) { const [ax, ay] = P(...m.pts[k - 1]), [bx, by] = P(...m.pts[k]), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), d = Math.hypot(x - ax - t * dx, y - ay - t * dy); if (d < bd) { bd = d; best = i; } }
  });
  return best;
}
function openNote(x, y) {
  const f = $('pennote'); PEN.noteAt = screenToWorld(x, y);
  f.style.left = Math.max(6, Math.min(cssW - 230, x - 10)) + 'px'; f.style.top = Math.max(6, Math.min(cssH - 44, y + 10)) + 'px';
  f.hidden = false; const i = f.querySelector('input'); i.value = ''; setTimeout(() => i.focus(), 0);
}
function closeNote() { const f = $('pennote'); if (f) f.hidden = true; PEN.noteAt = null; }
$('pennote').addEventListener('submit', e => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v && PEN.noteAt) { marks().push({ kind: 'note', at: PEN.noteAt, text: v.slice(0, 60), t: SIM ? SIM.t : null }); requestDraw(); } closeNote(); });
$('pennote').addEventListener('keydown', e => { if (e.key === 'Escape') closeNote(); });
$('penctl').addEventListener('click', e => { const b = e.target.closest('button[data-pen]'); if (b) penMode(b.dataset.pen); });
// graphite on the paper: a soft grey-black line, notes in a small italic hand
function drawMarks(g) {
  const list = marks().concat(PEN.stroke ? [PEN.stroke] : []); if (!list.length) return;
  g.save(); g.strokeStyle = PAL.ink; g.fillStyle = PAL.ink; g.globalAlpha = 0.72; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.7;
  for (const m of list) {
    if (m.kind === 'note') { const [x, y] = P(m.at[0], m.at[1]); g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke(); g.font = 'italic 14px "IM Fell English", Georgia, serif'; g.fillText(m.text, x + 7, y + 4); continue; }
    g.beginPath(); m.pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  }
  g.restore();
}
{ const ed = extraDraw; extraDraw = g => { if (ed) ed(g); drawMarks(g); }; }
