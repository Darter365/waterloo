/* ================= live drawing ================= */
let drawPending = false;
function requestDraw() { if (!drawPending) { drawPending = true; requestAnimationFrame(draw); } }
let unitHits = [], LB = [], PEND = [];
const FONT = { village: ["'IM Fell English SC'", 13, 'normal', 0.14], hamlet: ["'IM Fell English'", 12, 'italic', 0.02], farm: ["'IM Fell English'", 12, 'italic', 0], wood: ["'IM Fell English'", 12.5, 'italic', 0.04], small: ["'IM Fell English'", 10.5, 'italic', 0], ridge: ["'IM Fell English'", 15, 'italic', 0.22], water: ["'IM Fell English'", 12, 'italic', 0.06], unit: ["'IM Fell English'", 10.5, 'italic', 0], group: ["'IM Fell English SC'", 11.5, 'normal', 0.1], edge: ["'IM Fell English'", 11, 'italic', 0] };
const REF_S = 0.095; // px per metre of the desktop whole-sheet view
const zoomF = () => view.s / REF_S;
function fontPx(style, mul = 1) {
  const z = zoomF(), base = FONT[style][1];
  if (style === 'unit') return base * Math.max(0.9, Math.min(1.5, Math.pow(z / 2.1, 0.35))) * mul;
  if (style === 'group') return base * Math.max(0.85, Math.min(1.4, Math.pow(z, 0.3))) * mul;
  if (style === 'edge') return base * mul;
  return base * Math.max(0.82, Math.min(2.1, Math.pow(z, 0.42))) * mul;
}
function label(str, x, y, style, align, color, pri, force, mul = 1) { PEND.push({ str, x, y, style, align, color, pri, force, mul }); }
function drawLabels(g) {
  LB = []; PEND.sort((a, b) => a.pri - b.pri);
  for (const L of PEND) {
    const [fam, , fst, track] = FONT[L.style], px = fontPx(L.style, L.mul);
    g.font = `${fst} ${px.toFixed(1)}px ${fam}, 'EB Garamond', Georgia, serif`;
    if ('letterSpacing' in g) g.letterSpacing = (track * px).toFixed(1) + 'px';
    const w = g.measureText(L.str).width, dx = L.align === 'l' ? 6 : L.align === 'r' ? -6 : 0;
    const x0 = L.align === 'l' ? L.x + dx : L.align === 'r' ? L.x + dx - w : L.x - w / 2;
    const box = [x0 - 2, L.y - px * 0.55, x0 + w + 2, L.y + px * 0.55];
    if (!L.force && LB.some(o => !(box[2] < o[0] || box[0] > o[2] || box[3] < o[1] || box[1] > o[3]))) continue;
    LB.push(box);
    g.textAlign = L.align === 'l' ? 'left' : L.align === 'r' ? 'right' : 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 3.2; g.strokeStyle = PAL.paper; g.globalAlpha = 0.88; g.strokeText(L.str, L.x + dx, L.y); g.globalAlpha = 1;
    g.fillStyle = L.color; g.fillText(L.str, L.x + dx, L.y);
  }
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  PEND = [];
}
function polyPath(g, pts) { pts.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? g.lineTo(a, b) : g.moveTo(a, b); }); }
function rectPath(g, r) {
  const a = r.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), hw = r.w / 2, hh = r.h / 2;
  [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([u, v], i) => { const [px, py] = P(r.x + u * c - v * sn, r.y + u * sn + v * c); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
}
function draw() {
  drawPending = false; PEND = [];
  const g = ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAL.bg; g.fillRect(0, 0, cssW, cssH);
  const [sx0, sy0] = P(0, 0), [sx1, sy1] = P(WM, HM);
  g.fillStyle = 'rgba(30,20,10,0.22)'; g.fillRect(sx0 + 3, sy0 + 4, sx1 - sx0, sy1 - sy0);
  g.fillStyle = PAL.paper; g.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  if (tview) { const k = view.s / tview.s; g.drawImage(tcan, view.tx - tview.cx0 * k, view.ty - tview.cy0 * k, tview.cw * k, tview.ch * k); }
  g.save(); g.beginPath(); g.rect(sx0, sy0, sx1 - sx0, sy1 - sy0); g.clip();
  if (viewshedImg) drawViewshed(g);
  if (layers.roads) drawRoads(g);
  if (layers.flags) drawFlags(g);
  if (layers.debated) drawDebated(g);
  if (layers.units) drawUnits(g); else unitHits = [];
  placeLabels();
  drawLabels(g);
  if (sight) drawSight(g);
  g.restore();
  drawOffmap(g);
  drawFrame(g);
  drawScale(g); drawNorth(g);
}
function drawRoads(g) {
  const zf = zoomF();
  for (const e of ENCLOSURES) {
    g.beginPath(); rectPath(g, e);
    if (e.kind === 'wall') { g.strokeStyle = PAL.ink; g.lineWidth = 1.3; g.stroke(); }
    else { g.setLineDash([1, 3.2]); g.lineCap = 'round'; g.strokeStyle = PAL.woodink; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
      if (zf > 2.2) { const R = rng(hashStr(e.n)); g.fillStyle = PAL.woodink; g.globalAlpha = 0.6; for (let u = -e.w / 2 + 12; u < e.w / 2 - 6; u += 22) for (let v = -e.h / 2 + 12; v < e.h / 2 - 6; v += 22) { const [px, py] = P(e.x + u + (R() - 0.5) * 6, e.y + v + (R() - 0.5) * 6); g.beginPath(); g.arc(px, py, Math.max(1, 3 * view.s), 0, 7); g.fill(); } g.globalAlpha = 1; } }
  }
  for (const r of ROADS) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (r.kind === 'chaussee') {
      const w = Math.max(3.2, 16 * view.s);
      g.beginPath(); polyPath(g, r.pts); g.strokeStyle = PAL.ink; g.lineWidth = w; g.stroke();
      g.beginPath(); polyPath(g, r.pts); g.strokeStyle = PAL.road; g.lineWidth = Math.max(1.6, w - 1.8); g.stroke();
    } else if (r.kind === 'lane') {
      const w = Math.max(2.2, 8 * view.s);
      g.beginPath(); polyPath(g, r.pts); g.strokeStyle = PAL.ink; g.globalAlpha = 0.85; g.lineWidth = w; g.stroke();
      g.beginPath(); polyPath(g, r.pts); g.strokeStyle = PAL.paper; g.globalAlpha = 1; g.lineWidth = Math.max(0.8, w - 1.6); g.stroke();
    } else {
      g.beginPath(); polyPath(g, r.pts); g.strokeStyle = PAL.ink; g.globalAlpha = 0.75; g.lineWidth = 1; g.setLineDash([5, 3.5]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
  }
  for (const pts of SUNKEN) {
    g.strokeStyle = PAL.hach; g.lineWidth = 0.9;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L, step = Math.max(9, 5 / view.s);
      for (let d = 0; d < L; d += step) for (const sd of [-1, 1]) {
        const x = ax + (bx - ax) * d / L, y = ay + (by - ay) * d / L, o = Math.max(2.4, 8.5 * view.s) / view.s;
        const [p1x, p1y] = P(x + nx * o * sd, y + ny * o * sd), [p2x, p2y] = P(x + nx * (o + 4 / view.s) * sd, y + ny * (o + 4 / view.s) * sd);
        g.beginPath(); g.moveTo(p1x, p1y); g.lineTo(p2x, p2y); g.stroke();
      }
    }
  }
  for (const pts of HEDGES) { g.beginPath(); polyPath(g, pts); g.setLineDash([0.5, 3.6]); g.lineCap = 'round'; g.strokeStyle = PAL.woodink; g.lineWidth = 2.6; g.stroke(); g.setLineDash([]); g.lineCap = 'butt'; }
  g.beginPath(); rectPath(g, SANDPIT); g.fillStyle = PAL.road; g.fill(); g.strokeStyle = PAL.hach; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = PAL.build; g.strokeStyle = PAL.ink; g.lineWidth = 0.6;
  for (const hs of HOUSES) { g.beginPath(); rectPath(g, { ...hs, w: Math.max(hs.w, 2.2 / view.s), h: Math.max(hs.h, 1.8 / view.s) }); g.fill(); }
  for (const b of BUILDINGS) { g.beginPath(); rectPath(g, { ...b, w: Math.max(b.w, 4 / view.s), h: Math.max(b.h, 4 / view.s) }); g.fill(); g.stroke(); }
  for (const v of VILLAGES) if (v.church) { const [x, y] = P(v.cx, v.cy); g.strokeStyle = PAL.ink; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y + 4); g.moveTo(x - 3.5, y - 2.5); g.lineTo(x + 3.5, y - 2.5); g.stroke(); }
  { const [x, y] = ll2m(50.6801611, 4.4116889), [px, py] = P(x, y); g.fillStyle = PAL.woodink; g.beginPath(); g.arc(px - 5, py - 5, 2.6, 0, 7); g.fill(); }
}
const KEY_FARMS = ['Hougoumont', 'La Haye Sainte', 'Papelotte', 'La Belle Alliance', 'Frischermont', 'Le Caillou'];
function placeLabels() {
  const zf = zoomF(), close = zf >= 2.1;
  for (const [t, la, lo, st, al] of LABELS) {
    if (st === 'small' && zf < 2.6) continue;
    if (st === 'ridge' && (zf < 1.3 || zf > 3.6)) continue;
    const [x, y] = ll2m(la, lo), [px, py] = P(x, y), key = KEY_FARMS.includes(t);
    const col = st === 'wood' ? PAL.woodink : st === 'ridge' ? PAL.hach : PAL.ink;
    let pri, force;
    if (st === 'village') { pri = 1; force = true; }
    else if (st === 'farm' || st === 'hamlet') { pri = close ? 1.5 : (key ? 3 : 7); force = close; if (!close && zf < 1.35 && !key) continue; }
    else if (st === 'ridge') { pri = 8; force = false; }
    else { pri = 5; force = false; }
    label(t, px, py, st, al, col, pri, force);
  }
  if (layers.water) {
    const near = (la, lo, minA) => { const [tx, ty] = ll2m(la, lo); let best = null, bd = Infinity; for (const st of STREAMS) for (let i = 0; i < st.length; i += 3) { if (st[i + 2] < minA) continue; const d = Math.hypot(st[i] - tx, st[i + 1] - ty); if (d < bd) { bd = d; best = [st[i], st[i + 1]]; } } return best; };
    const a = near(50.6790, 4.4890, 800), b = near(50.6885, 4.4610, 400);
    if (a) { const [px, py] = P(a[0], a[1]); label('la Lasne', px, py, 'water', 'l', PAL.water, 5, false); }
    if (b) { const [px, py] = P(b[0], b[1]); label('ruisseau de Smohain', px, py, 'water', 'l', PAL.water, 5, false); }
  }
  for (const [t, la, lo, edge] of EDGE_LABELS) {
    const [x, y] = ll2m(la, lo), [px, py] = P(x, y);
    if (edge === 'n') label('↑ ' + t, px, py + 10, 'edge', 'l', PAL.ink, 4, false);
    else label('↓ ' + t, px, py - 10, 'edge', 'l', PAL.ink, 4, false);
  }
}
function drawFlags(g) {
  g.save(); g.strokeStyle = PAL.flag; g.lineCap = 'round';
  if (zoomF() >= 2) for (const r of ROADS) if (r.conf === 'approx') { g.lineWidth = Math.max(6, 20 * view.s); g.globalAlpha = 0.1; g.beginPath(); polyPath(g, r.pts); g.stroke(); }
  g.globalAlpha = 0.7; g.setLineDash([1.5, 3]); g.lineWidth = 1.4;
  for (const w of WOODS) { g.beginPath(); polyPath(g, w.pts); g.closePath(); g.stroke(); }
  const [lx, ly] = P(LION[0], LION[1]), rr = Math.max(5, 85 * view.s);
  g.setLineDash([2, 2.5]); g.globalAlpha = 0.9; g.lineWidth = 1.2; g.beginPath(); g.arc(lx, ly, rr, 0, 7); g.stroke();
  for (const v of VILLAGES) if (v.approxPos) { const [x, y] = P(v.cx, v.cy); g.globalAlpha = 0.7; g.setLineDash([1.5, 3]); g.lineWidth = 1.3; g.beginPath(); g.arc(x, y, Math.max(8, v.r * view.s), 0, 7); g.stroke(); }
  g.restore();
  if (zoomF() > 1.8) label('butte du Lion (1826), retirée du relief', lx, ly + rr + 9, 'small', 'c', PAL.flag, 6, false);
}
function drawDebated(g) {
  g.save(); g.strokeStyle = PAL.debate; g.fillStyle = PAL.debate; g.lineCap = 'round';
  const band = (pts, lab, sub) => {
    g.globalAlpha = 0.8; g.lineWidth = Math.max(4, 22 * view.s); g.setLineDash([Math.max(3, 18 * view.s), Math.max(3, 14 * view.s)]); g.beginPath(); polyPath(g, pts); g.stroke(); g.setLineDash([]);
    if (zoomF() > 1.5) { const [x, y] = P(pts[pts.length - 1][0], pts[pts.length - 1][1]); label(lab, x + 4, y - 3, 'small', 'l', PAL.debate, 6, false, 1.05); if (sub && zoomF() > 2.6) label(sub, x + 4, y + 11, 'small', 'l', PAL.debate, 6.5, false, 0.95); }
  };
  band(DEBATED.siteA, 'Grand battery, site A', 'main ridge, in front of I Corps');
  band(DEBATED.siteB, 'Grand battery, site B', 'intermediate rise, ≈650 m from the allied crest');
  const [a, b] = DEBATED.bylandtBack, [ax, ay] = P(a[0], a[1]), [bx, by] = P(b[0], b[1]);
  if (zoomF() > 2) { g.globalAlpha = 0.9; g.lineWidth = 1.4; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(ax + 18, ay); g.lineTo(bx + 18, by); g.stroke(); g.setLineDash([]); const ang = Math.atan2(by - ay, bx - ax); g.beginPath(); g.moveTo(bx + 18, by); g.lineTo(bx + 18 - 7 * Math.cos(ang - 0.45), by - 7 * Math.sin(ang - 0.45)); g.lineTo(bx + 18 - 7 * Math.cos(ang + 0.45), by - 7 * Math.sin(ang + 0.45)); g.closePath(); g.fill(); }
  g.restore();
}
function sideColor(side) { return side === 'FR' ? PAL.FR : side === 'AL' ? PAL.AL : PAL.PR; }
function unitBlocks(u, detail) {
  // returns list of [along, forward, width, depth] in metres, relative to the unit centre
  const F = u.F, D = u.D, out = [];
  const nBn = Math.max(1, u.nBn);
  if (u.type === 'inf') {
    if (u.form === 'line') out.push([0, 0, F, D]);
    else if (u.form === 'twoLines') {
      const bd = 20, n1 = Math.ceil(nBn / 2), n2 = nBn - n1;
      const row = (n, fwd) => { if (!detail || n < 2) { out.push([0, fwd, F, bd]); return; } const gap = 10, w = (F - gap * (n - 1)) / n; for (let i = 0; i < n; i++) out.push([-F / 2 + w / 2 + i * (w + gap), fwd, w, bd]); };
      row(n1, D / 2 - bd / 2); if (n2) row(n2, -D / 2 + bd / 2);
    } else {
      if (!detail) out.push([0, 0, F, D]);
      else { const w = Math.min(42, F / nBn * 0.55); for (let i = 0; i < nBn; i++) out.push([-F / 2 + F / nBn * (i + 0.5), 0, w, 50]); }
    }
  } else if (u.type === 'cav') {
    if (!detail) out.push([0, 0, F, D]);
    else { const nSq = Math.max(2, Math.round(u.str / 150)), n1 = Math.ceil(nSq / 2), n2 = nSq - n1; for (const [n, fwd] of [[n1, D / 2 - 8], [n2, -D / 2 + 8]]) { if (!n) continue; const w = Math.min(46, F / n1 * 0.62); for (let i = 0; i < n; i++) out.push([-F / 2 + F / n1 * (i + 0.5), fwd, w, 16]); } }
  } else out.push([0, 0, F, D]);
  return out;
}
function drawUnits(g) {
  unitHits = []; const zf = zoomF(), s = view.s, detail = zf >= 2.2;
  if (layers.halos) {
    g.save(); g.setLineDash([1.2, 3]); g.lineCap = 'round'; g.lineWidth = 1;
    for (const u of UNITS) { if (u.type === 'hq') continue; const [x, y] = P(u.x, u.y); const rr = (u.conf + (u.type === 'gar' ? 0 : Math.max(u.F, u.D) / 2)) * s; if (rr < 5) continue; g.strokeStyle = sideColor(u.side); g.globalAlpha = 0.22; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); }
    g.restore();
  }
  for (const u of UNITS) {
    const col = sideColor(u.side), sel = selected === u;
    if (u.type === 'hq') continue;
    if (u.type === 'gar') {
      const [x, y] = P(u.x, u.y), rr = Math.max(4.5, u.R * s);
      g.save(); g.strokeStyle = col; g.lineWidth = sel ? 3 : 2; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke();
      g.fillStyle = col; g.globalAlpha = 0.16; g.fill(); g.globalAlpha = 1; g.fillRect(x - 2.5, y - 2.5, 5, 5); g.restore();
      unitHits.push({ u, kind: 'circle', x, y, r: rr + 3 });
      continue;
    }
    const th = u.facing * Math.PI / 180, fx = Math.sin(th), fy = -Math.cos(th), ax = Math.cos(th), ay = Math.sin(th);
    const quad = (al, fw, w, d, minW, minD) => { const W = Math.max(w, minW / s), Dd = Math.max(d, minD / s), cx = u.x + ax * al + fx * fw, cy = u.y + ay * al + fy * fw; const c = (a, f) => P(cx + ax * a * W / 2 + fx * f * Dd / 2, cy + ay * a * W / 2 + fy * f * Dd / 2); return [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)]; };
    const env = quad(0, 0, u.F, u.D, 6, 3.2);
    const blocks = unitBlocks(u, detail).map(([al, fw, w, d]) => quad(al, fw, w, d, u.form === 'twoLines' ? 3 : 2.5, u.form === 'twoLines' ? 1.6 : (u.type === 'art' ? 3 : 3.2)));
    g.save();
    for (const sp of blocks) {
      g.beginPath(); sp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
      if (u.type === 'inf') { g.fillStyle = col; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1; g.strokeStyle = PAL.ink; g.lineWidth = 0.5; g.stroke(); }
      else if (u.type === 'cav') {
        g.fillStyle = PAL.paper; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.save(); g.clip();
        g.strokeStyle = col; g.lineWidth = 1.05; const xs = sp.map(p => p[0]), ys = sp.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        g.beginPath(); for (let d = x0 - (y1 - y0); d < x1; d += 3.1) { g.moveTo(d, y1); g.lineTo(d + (y1 - y0), y0); } g.stroke(); g.restore();
        g.strokeStyle = col; g.lineWidth = 1.1; g.beginPath(); sp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
      } else if (u.type === 'art') {
        g.fillStyle = PAL.paper; g.fill(); g.strokeStyle = col; g.lineWidth = 1.1; g.stroke();
        const n = Math.min(u.str, Math.max(2, Math.floor(Math.hypot(sp[1][0] - sp[0][0], sp[1][1] - sp[0][1]) / 4)));
        g.fillStyle = col;
        for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = sp[0][0] + (sp[1][0] - sp[0][0]) * t, y = sp[0][1] + (sp[1][1] - sp[0][1]) * t, mx = (sp[3][0] - sp[0][0]) * 0.5, my = (sp[3][1] - sp[0][1]) * 0.5; g.beginPath(); g.arc(x + mx * 0.6, y + my * 0.6, 1.25, 0, 7); g.fill(); }
      }
      g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); g.lineTo(sp[1][0], sp[1][1]); g.strokeStyle = PAL.ink; g.lineWidth = sel ? 2.4 : 1.4; g.stroke();
    }
    if (sel) { g.beginPath(); env.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.strokeStyle = PAL.ink; g.lineWidth = 1; g.setLineDash([3, 2]); g.stroke(); g.setLineDash([]); }
    g.restore();
    unitHits.push({ u, kind: 'poly', pts: env });
  }
  for (const u of UNITS) if (u.type === 'hq') {
    const [x, y] = P(u.x, u.y), col = sideColor(u.side);
    g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 18); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 12, y - 15); g.lineTo(x, y - 11); g.closePath(); g.fill(); g.stroke(); g.restore();
    if (zf > 1.2) label(u.name, x + 10, y - 23, 'farm', 'l', col, 2, true, 1.05);
    unitHits.push({ u, kind: 'circle', x: x + 4, y: y - 12, r: 11 });
  }
  if (!layers.ulabels) return;
  if (zf >= 2.1) {
    for (const u of UNITS) {
      if (u.type === 'hq' || u.type === 'gar' || (u.type === 'art' && zf < 3.2)) continue;
      const [x, y] = P(u.x, u.y), th = u.facing * Math.PI / 180, back = (u.D / 2 * s + 9);
      label(u.name, x - Math.sin(th) * back, y + Math.cos(th) * back, 'unit', 'c', sideColor(u.side), u.type === 'art' ? 4.6 : 4, false);
    }
  } else {
    for (const gr of GROUPS) {
      const [x, y] = P(...ll2m(gr.la, gr.lo)), col = sideColor(gr.side);
      label(gr.t, x, y, 'group', 'c', col, 0, true);
      if (gr.s && zf > 1.15) label(gr.s, x, y + fontPx('group') * 1.05, 'small', 'c', col, 0.5, false);
    }
  }
}
let offHits = [];
function drawOffmap(g) {
  offHits = [];
  const [sx0, sy0] = P(0, 0), [sx1, sy1] = P(WM, HM);
  for (const o of OFFMAP) {
    const [wx, wy] = ll2m(o.la, o.lo);
    const ex = Math.min(Math.max(wx, 0), WM), ey = Math.min(Math.max(wy, 0), HM); // anchor on the sheet edge
    const [cx, cy] = P(ex, ey);
    if (cx < -4 || cy < -4 || cx > cssW + 4 || cy > cssH + 4) continue;
    let dir = wx > WM ? [1, 0] : wx < 0 ? [-1, 0] : wy < 0 ? [0, -1] : [0, 1];
    if (wy > HM && wx > WM * 0.9) dir = [0.7, 0.7];
    const col = sideColor(o.side), ax = cx - dir[0] * 4, ay = cy - dir[1] * 4;
    g.save(); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(ax - dir[0] * 16, ay - dir[1] * 16); g.lineTo(ax, ay); g.stroke();
    const an = Math.atan2(dir[1], dir[0]); g.beginPath(); g.moveTo(ax + Math.cos(an) * 4, ay + Math.sin(an) * 4); g.lineTo(ax - Math.cos(an - 0.5) * 9, ay - Math.sin(an - 0.5) * 9); g.lineTo(ax - Math.cos(an + 0.5) * 9, ay - Math.sin(an + 0.5) * 9); g.closePath(); g.fill();
    g.font = `12px 'IM Fell English SC', Georgia, serif`; g.textBaseline = 'middle';
    const lx = dir[0] > 0 ? ax - 22 : dir[0] < 0 ? ax + 22 : ax - (dir[0] ? 0 : 10), ly = dir[1] > 0 ? ay - 18 : dir[1] < 0 ? ay + 18 : ay;
    g.textAlign = dir[0] > 0 ? 'right' : dir[0] < 0 ? 'left' : 'center';
    g.lineWidth = 3; g.strokeStyle = PAL.paper; g.globalAlpha = 0.9; g.strokeText(o.title, lx, ly); g.globalAlpha = 1; g.fillText(o.title, lx, ly);
    g.restore();
    offHits.push({ o, x: cx, y: cy, r: 22 });
  }
}
function drawFrame(g) {
  const [x0, y0] = P(0, 0), [x1, y1] = P(WM, HM);
  g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 0.8; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = PAL.fg2; g.lineWidth = 2.2; g.strokeRect(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10);
  g.lineWidth = 0.8; g.font = `9.5px 'EB Garamond', Georgia, serif`; g.fillStyle = PAL.fg2;
  const stepPx = 0.01 * MLON * view.s, every = stepPx > 46 ? 1 : stepPx > 23 ? 2 : 5;
  let k = 0;
  for (let lo = 4.37; lo < 4.5001; lo += 0.01, k++) { const [x] = P(...ll2m(LAT0, lo)); if (x < 0 || x > cssW) continue; g.beginPath(); g.moveTo(x, y1 + 5); g.lineTo(x, y1 + 9); g.moveTo(x, y0 - 5); g.lineTo(x, y0 - 9); g.stroke(); if (k % every === 0 && y1 + 22 < cssH) { g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(lo.toFixed(2) + '°E', x, y1 + 11); } }
  const stepPy = 0.01 * MLAT * view.s, everyY = stepPy > 30 ? 1 : 2; k = 0;
  for (let la = 50.64; la < 50.708; la += 0.01, k++) { const [, y] = P(...ll2m(la, LON0)); if (y < 0 || y > cssH) continue; g.beginPath(); g.moveTo(x0 - 5, y); g.lineTo(x0 - 9, y); g.moveTo(x1 + 5, y); g.lineTo(x1 + 9, y); g.stroke(); if (k % everyY === 0 && x0 > 52) { g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(la.toFixed(2) + '°N', x0 - 11, y); } }
  g.restore();
}
function drawScale(g) {
  const target = Math.min(140, cssW * 0.32) / view.s; let L = 50; for (const c of [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]) if (c <= target) L = c;
  const px = L * view.s, x = 14, y = cssH - 26, segs = 4;
  g.save(); g.fillStyle = PAL.paper; g.globalAlpha = 0.88; g.fillRect(x - 6, y - 22, px + 56, 42); g.globalAlpha = 1;
  g.strokeStyle = PAL.ink; g.lineWidth = 0.8;
  for (let i = 0; i < segs; i++) { g.fillStyle = i % 2 ? PAL.paper : PAL.ink; g.fillRect(x + px * i / segs, y, px / segs, 5); }
  g.strokeRect(x, y, px, 5);
  g.fillStyle = PAL.ink; g.font = `11px 'EB Garamond', Georgia, serif`; g.textBaseline = 'bottom'; g.textAlign = 'center';
  g.fillText('0', x, y - 2); g.fillText(L >= 1000 ? (L / 1000) + ' km' : L + ' m', x + px, y - 2);
  const yd = L * 1.0936 >= 100 ? Math.round(L * 1.0936 / 10) * 10 : Math.round(L * 1.0936 / 5) * 5, ypx = yd / 1.0936 * view.s;
  g.textBaseline = 'top'; g.globalAlpha = 0.8; g.fillText(yd + ' yards', x + ypx, y + 8); g.beginPath(); g.moveTo(x + ypx, y + 5); g.lineTo(x + ypx, y + 9); g.stroke();
  g.restore();
}
function drawNorth(g) {
  const x = cssW - 26, y = 44;
  g.save(); g.fillStyle = PAL.paper; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y - 10, 17, 0, 7); g.fill(); g.globalAlpha = 1;
  g.fillStyle = PAL.ink; g.strokeStyle = PAL.ink; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 5, y); g.lineTo(x, y - 4); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x - 5, y); g.lineTo(x, y - 4); g.closePath(); g.fillStyle = PAL.paper; g.fill(); g.stroke();
  g.font = `11px 'IM Fell English SC', Georgia, serif`; g.fillStyle = PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', x, y + 1 - 26 + 30);
  g.restore();
}

