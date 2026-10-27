/* ================= 8b. the view through the glass ================= */
// Tap the glass, then a place: the map closes in on it inside the eyepiece. Ground your eye cannot reach from where you stand (behind
// a crest, in a hollow, under thick smoke, beyond the day's seeing) is shaded, and the troops shown are only those you yourself saw
// there in the last twenty minutes. It is worked out from your record and the lie of the land, with no dice: it shows nothing your own
// eyes have not already given you, and looking changes nothing in the battle.
const GLASS = { on: null, view: null };
const NAT_WORD = { GB: 'British', KGL: 'King’s German Legion', HAN: 'Hanoverian', NL: 'Dutch-Belgian', NAS: 'Nassau', BRU: 'Brunswick', PR: 'Prussian', FR: 'French' };
function glassBtn(on) { const b = $('glassbtn'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
function glassOff() { GLASS.on = null; GLASS.view = null; glassBtn(false); $('glasscap').hidden = true; if (!PEN.mode && !(G && G.pick)) { canvas.classList.remove('tool'); setHint(null); } requestDraw(); }
function glassToggle() {
  if (!G || !SIM || G.phase === 'setup') return;
  if (GLASS.on) { glassOff(); return; }
  if (PEN.mode) penMode(PEN.mode); if (G.pick) cancelPick();
  GLASS.on = 'aim'; glassBtn(true); canvas.classList.add('tool'); setHint('Tap the place you want to look at through the glass.');
}
// called by _interact.js for a tap; true when the glass took it
function glassTap(x, y) {
  if (GLASS.on !== 'aim') return false;
  const w = screenToWorld(x, y); glassLook(w); return true;
}
function glassLook(w) {
  const C = SIM.command, B = C.B.napoleon, nap = SIM.leaders.napoleon, o = [nap.x, nap.y];
  const dist = Math.hypot(w[0] - o[0], w[1] - o[1]), R = Math.max(250, Math.min(700, dist * 0.18)), step = R / 22, seeing = WEngine.bgVis(SIM.t) * WCommand.CK.TELESCOPE;
  const cells = [];
  for (let gy = -R; gy <= R; gy += step) for (let gx = -R; gx <= R; gx += step) {
    if (gx * gx + gy * gy > R * R) continue;
    const cx = w[0] + gx, cy = w[1] + gy, r = Math.hypot(cx - o[0], cy - o[1]);
    const l = r > seeing ? { clear: false } : SIM.los(o[0], o[1], 2.5, cx, cy, 1.8), smoke = SIM.smokeAt ? SIM.smokeAt(cx, cy) : 0;
    cells.push({ x: cx, y: cy, why: r > seeing ? 'far' : !l.clear ? 'ground' : l.trans < 0.35 || smoke > 1.2 ? 'smoke' : null });
  }
  const seen = [...B.c.values()].filter(c => c.src === 'own eyes' && SIM.t - c.t <= 20 && Math.hypot(c.x - w[0], c.y - w[1]) <= R);
  const own = [...B.own.values()].filter(r2 => !r2.gone && r2.src === 'own eyes' && SIM.t - r2.t <= 20 && Math.hypot(r2.x - w[0], r2.y - w[1]) <= R);
  GLASS.on = 'view'; GLASS.view = { w, R, step, cells, seen: seen.map(c => [c.x, c.y]), dist };
  canvas.classList.remove('tool'); setHint(null);
  // the words: where you are looking, what you see there, and what you cannot
  const hid = cells.filter(c => c.why).length / cells.length, why = k => cells.filter(c => c.why === k).length / cells.length;
  const dir = compWord(bearing(w[0] - o[0], w[1] - o[1])), from = WCommand.POSTS[C.hq.post] ? WCommand.POSTS[C.hq.post].name : 'where you stand';
  const what = c => { const n = Math.max(100, Math.round(c.str / 100) * 100), k = c.kind === 'art' ? `${c.guns || ''} guns`.trim() : c.kind === 'cav' ? 'cavalry' : c.kind === 'inf' ? 'infantry' : 'troops', s = c.side === 'FR' ? 'French ' : c.nat ? (NAT_WORD[c.nat] || '') + ' ' : c.side === 'PR' ? 'Prussian ' : c.side === 'AL' ? 'allied ' : '';
    return `${c.kind === 'art' ? '' : 'about ' + fmt(n) + ' '}${s}${k}${c.form && FORM[c.form] && c.kind !== 'art' ? ', ' + FORM[c.form] : ''}${c.status === 'broken' ? ', in flight' : c.status === 'disordered' ? ', in disorder' : ''}${c.moving ? ', on the move' : ''}${c.garrison ? ' in the buildings' : ''}`; };
  let txt = `<b>Through the glass from ${esc(from)}</b>, looking ${dir}, ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist / 50) * 50 + ' m'}, toward ${esc(place(w[0], w[1]))}.`;
  const lines = seen.map(what).concat(own.length ? [`${own.length} of your own brigade${own.length > 1 ? 's' : ''}`] : []);
  txt += lines.length ? ` You make out ${esc(lines.slice(0, 4).join('; '))}${lines.length > 4 ? `; and ${lines.length - 4} more bodies` : ''}.` : ' Nothing of the enemy shows there.';
  const older = [...B.c.values()].filter(c => c.side !== 'FR' && !(c.src === 'own eyes' && SIM.t - c.t <= 20) && Math.hypot(c.x - w[0], c.y - w[1]) <= R).length;
  if (older) txt += ` Your map shows ${older} bod${older > 1 ? 'ies' : 'y'} of the enemy here from older reports, which you cannot confirm from where you stand.`;
  if (hid > 0.12) txt += ` Shaded: ${[why('ground') > 0.05 ? 'ground the lie of the land hides from you' : '', why('smoke') > 0.05 ? 'smoke' : '', why('far') > 0.05 ? 'too far for today’s light' : ''].filter(Boolean).join(', ')} (${Math.round(hid * 100)}% of the view); whatever is there, you cannot see it.`;
  const cap = $('glasscap'); cap.innerHTML = `<p>${txt}</p><button type="button" id="glassoff">Lower the glass</button>`; cap.hidden = false;
  // close in so the eyepiece fills about two-thirds of the sheet's height
  const [la, lo] = m2ll(w[0], w[1]), z = Math.max(1, Math.min(8, (cssH * 0.33) / (R * s0)));
  flyTo(la, lo, z); requestDraw();
}
$('glassbtn').addEventListener('click', glassToggle);
$('glasscap').addEventListener('click', e => { if (e.target.closest('#glassoff')) glassOff(); });
function drawGlass(g) {
  const V = GLASS.view; if (!V) return;
  if (playing) { glassOff(); return; }
  const [cx, cy] = P(V.w[0], V.w[1]), r = V.R * view.s, cs = V.step * view.s;
  g.save();
  // the hidden ground inside the eyepiece
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
  for (const [kind, col] of [['ground', 'rgba(40,30,22,0.5)'], ['far', 'rgba(40,30,22,0.5)'], ['smoke', 'rgba(215,212,205,0.7)']]) {
    g.beginPath(); for (const c of V.cells) { if (c.why !== kind) continue; const [x, y] = P(c.x, c.y); g.rect(x - cs / 2 - 0.5, y - cs / 2 - 0.5, cs + 1, cs + 1); } g.fillStyle = col; g.fill();
  }
  g.restore(); g.save();
  // the eyepiece: dark beyond the lens, a brass rim, a faint cross
  g.fillStyle = 'rgba(18,14,10,0.78)'; g.beginPath(); g.rect(0, 0, cssW, cssH); g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, 2 * Math.PI, true); g.closePath(); g.fill('evenodd');
  g.lineWidth = 7; g.strokeStyle = '#7a5a22'; g.beginPath(); g.arc(cx, cy, r + 3.5, 0, 7); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = '#c9a65a'; g.beginPath(); g.arc(cx, cy, r + 0.5, 0, 7); g.stroke();
  g.globalAlpha = 0.35; g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
  // what you saw there, ringed
  g.globalAlpha = 0.9; g.strokeStyle = PAL.flag; g.lineWidth = 2;
  for (const [sx, sy] of V.seen) { const [x, y] = P(sx, sy); g.beginPath(); g.arc(x, y, Math.max(8, 9 * zoomF()), 0, 7); g.stroke(); }
  g.restore();
}
// the eyepiece goes on top of everything the map draws, its labels included
{ const d0 = draw; draw = function () { d0(); if (GLASS.view) { const g = ctx; g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); drawGlass(g); g.restore(); } }; }
