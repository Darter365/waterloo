/* ================= shared drawing: the engine state and a commander's belief on the map ================= */
const FORM = { line: 'in line', twoLines: 'in two lines', columns: 'battalion columns', attack: 'columns of attack', mass: "d'Erlon's massed division column", square: 'in square', road: 'road column', garrison: 'holding the buildings', battery: 'in battery', park: 'artillery park', limbered: 'limbered up' };
const TASKS = { hold: 'holding', attack: 'attacking', support: 'supporting', rally: 'rallying', move: 'moving', march: 'marching', bombard: 'bombarding', cavRaid: 'charging on the plateau', charge: 'charging', garrison: 'garrisoning', garrisonGo: 'going into a strongpoint', pursue: 'pursuing out of control' };
let mapColour = false; // (9) the colour map style: units get a light edge and stay solid against the green
let SIM = null, prevPos = new Map(), frac = 1, flashes = [], viewMode = 'truth', truthAlpha = 1, extraDraw = null, beliefFocus = null, beliefFocusCol = null; // beliefFocus: own brigades to pick out (others are dimmed)
const lerpPos = u => { const p = prevPos.get(u.id); if (!p || frac >= 1 || Math.hypot(p[0] - u.x, p[1] - u.y) > 1500) return [u.x, u.y]; return [p[0] + (u.x - p[0]) * frac, p[1] + (u.y - p[1]) * frac]; };
const alive = u => u.onMap && !u.gone && u.str > 0;

/* ----- unit drawing from the engine's state ----- */
function nBnOf(u) { return Math.max(1, Math.round(u.str / (u.side === 'FR' ? 520 : u.side === 'PR' ? 700 : 560))); }
function simBlocks(u, detail) {
  const F = u.F, D = u.D, n = nBnOf(u), out = [];
  if (u.type === 'inf') {
    if (u.form === 'twoLines') { const bd = 20, n1 = Math.ceil(n / 2), n2 = n - n1; const row = (k, fw) => { if (!detail || k < 2) { out.push([0, fw, F, bd]); return; } const gap = 10, w = (F - gap * (k - 1)) / k; for (let i = 0; i < k; i++) out.push([-F / 2 + w / 2 + i * (w + gap), fw, w, bd]); }; row(n1, D / 2 - bd / 2); if (n2) row(n2, -D / 2 + bd / 2); return out; }
    if ((u.form === 'columns' || u.form === 'attack') && detail) { const w = Math.min(u.form === 'attack' ? 36 : 42, F / n * (u.form === 'attack' ? 0.75 : 0.55)); for (let i = 0; i < n; i++) out.push([-F / 2 + F / n * (i + 0.5), (u.form === 'attack' && i % 2) ? -12 : 0, w, u.form === 'attack' ? 70 : 50]); return out; }
    if (u.form === 'square' && detail) { const cols = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); out.push([-F / 2 + F / cols * (c + 0.5) + (r ? 20 : 0), r ? -30 : 30, 30, 30]); } return out; }
    out.push([0, 0, F, D]); return out;
  }
  if (u.type === 'cav' && u.form === 'columns' && detail) { const nSq = Math.max(2, Math.round(u.str / 150)), n1 = Math.ceil(nSq / 2), n2 = nSq - n1; for (const [k, fw] of [[n1, D / 2 - 8], [n2, -D / 2 + 8]]) { if (!k) continue; const w = Math.min(46, F / n1 * 0.62); for (let i = 0; i < k; i++) out.push([-F / 2 + F / n1 * (i + 0.5), fw, w, 16]); } return out; }
  out.push([0, 0, F, D]); return out;
}
function drawUnits(g) {
  unitHits = []; if (!SIM) return;
  const zf = zoomF(), s = view.s, detail = zf >= 2.2;
  // orders: faint arrows to where each attacking brigade is heading
  if (layers.orders) {
    g.save(); g.lineWidth = 1.2; g.setLineDash([4, 4]);
    for (const u of SIM.units) {
      if (!alive(u) || u.status === 'broken') continue;
      let goal = null; const t = u.task;
      if (u.charge) { const tg = SIM.byId[u.charge.target]; if (tg) goal = [tg.x, tg.y]; }
      else if (t.kind === 'attack' && t.point) goal = t.sp ? [SIM.spById[t.sp].x, SIM.spById[t.sp].y] : t.point;
      else if ((t.kind === 'move' || t.kind === 'march' || t.kind === 'garrisonGo') && u.path && u.path.length) goal = u.path[u.path.length - 1];
      if (!goal) continue;
      const [x0, y0] = P(...lerpPos(u)), [x1, y1] = P(goal[0], goal[1]); if (Math.hypot(x1 - x0, y1 - y0) < 12) continue;
      g.strokeStyle = sideColor(u.side); g.globalAlpha = u.charge ? 0.85 : 0.4; if (u.charge) { g.setLineDash([]); g.lineWidth = 2; } else { g.setLineDash([4, 4]); g.lineWidth = 1.2; }
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const an = Math.atan2(y1 - y0, x1 - x0); g.setLineDash([]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 7 * Math.cos(an - 0.4), y1 - 7 * Math.sin(an - 0.4)); g.moveTo(x1, y1); g.lineTo(x1 - 7 * Math.cos(an + 0.4), y1 - 7 * Math.sin(an + 0.4)); g.stroke();
    }
    g.restore();
  }
  // strongpoints: who holds them
  if (truthAlpha === 1) for (const sp of SIM.sps) {
    if (!sp.holder) continue; const [x, y] = P(sp.x, sp.y), col = sp.holder === 'FR' ? PAL.FR : PAL.AL;
    g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 9, y - 2); g.lineTo(x + 9, y - 16); g.stroke(); g.fillStyle = col; g.fillRect(x + 9, y - 16, 9, 6); g.restore();
  }
  for (const u of SIM.units) {
    if (!alive(u)) continue;
    if (!layers.broken && u.status === 'broken') continue;
    const col = sideColor(u.side), sel = selected === u, [ux, uy] = lerpPos(u);
    const alpha = (u.status === 'broken' ? 0.35 : u.status === 'disordered' ? 0.6 : u.status === 'shaken' ? 0.8 : u.lying ? 0.62 : 0.92) * truthAlpha;
    if (u.type === 'gar' && u.spSec) {
      const [x, y] = P(ux, uy), rr = Math.max(4.5, u.spSec.r * s);
      g.save(); g.strokeStyle = col; g.lineWidth = sel ? 3 : 2; g.globalAlpha = Math.max(0.5 * truthAlpha, alpha); g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke();
      g.fillStyle = col; g.globalAlpha = 0.16; g.fill(); g.globalAlpha = 1; g.fillRect(x - 2.5, y - 2.5, 5, 5); g.restore();
      unitHits.push({ u, kind: 'circle', x, y, r: rr + 3 }); continue;
    }
    const th = u.facing * Math.PI / 180, fx = Math.sin(th), fy = -Math.cos(th), ax = Math.cos(th), ay = Math.sin(th);
    const quad = (al, fw, w, d, minW, minD) => { const W2 = Math.max(w, minW / s), Dd = Math.max(d, minD / s), cx = ux + ax * al + fx * fw, cy = uy + ay * al + fy * fw; const c = (a, f) => P(cx + ax * a * W2 / 2 + fx * f * Dd / 2, cy + ay * a * W2 / 2 + fy * f * Dd / 2); return [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)]; };
    const env = quad(0, 0, u.F, u.D, 6, 3.2);
    const blocks = simBlocks(u, detail).map(([al, fw, w, d]) => quad(al, fw, w, d, u.form === 'twoLines' ? 3 : 2.5, u.form === 'twoLines' ? 1.6 : 3));
    g.save(); g.globalAlpha = 1;
    for (const sp of blocks) {
      g.beginPath(); sp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
      if (u.type === 'inf') { g.fillStyle = col; g.globalAlpha = alpha; g.fill(); g.globalAlpha = 1; g.strokeStyle = PAL.ink; g.lineWidth = 0.5; if (u.status === 'broken') g.setLineDash([2, 2]); g.stroke(); g.setLineDash([]); }
      else if (u.type === 'cav') {
        g.fillStyle = PAL.paper; g.globalAlpha = 0.85 * alpha; g.fill(); g.globalAlpha = alpha; g.save(); g.clip();
        g.strokeStyle = col; g.lineWidth = 1.05; const xs = sp.map(p => p[0]), ys = sp.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        g.beginPath(); for (let d = x0 - (y1 - y0); d < x1; d += 3.1) { g.moveTo(d, y1); g.lineTo(d + (y1 - y0), y0); } g.stroke(); g.restore();
        g.strokeStyle = col; g.lineWidth = 1.1; g.globalAlpha = alpha; g.beginPath(); sp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke(); g.globalAlpha = 1;
      } else if (u.type === 'art') {
        g.fillStyle = PAL.paper; g.globalAlpha = alpha; g.fill(); g.strokeStyle = col; g.lineWidth = 1.1; g.stroke();
        if (u.form === 'battery' || u.form === 'park') { const n = Math.min(Math.round(u.str), Math.max(2, Math.floor(Math.hypot(sp[1][0] - sp[0][0], sp[1][1] - sp[0][1]) / 4))); g.fillStyle = col; for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = sp[0][0] + (sp[1][0] - sp[0][0]) * t, y = sp[0][1] + (sp[1][1] - sp[0][1]) * t, mx = (sp[3][0] - sp[0][0]) * 0.5, my = (sp[3][1] - sp[0][1]) * 0.5; g.beginPath(); g.arc(x + mx * 0.6, y + my * 0.6, 1.25, 0, 7); g.fill(); } }
        g.globalAlpha = 1;
        if (u.firedTick && playing) { const [cx, cy] = P(ux + fx * (u.D / 2 + 20), uy + fy * (u.D / 2 + 20)); g.fillStyle = 'rgba(255,214,140,0.85)'; g.beginPath(); g.arc(cx, cy, 2.2, 0, 7); g.fill(); }
      }
      if (u.status !== 'broken') { g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); g.lineTo(sp[1][0], sp[1][1]); g.strokeStyle = PAL.ink; g.lineWidth = sel ? 2.4 : 1.4; g.stroke(); }
    }
    if (sel) { g.beginPath(); env.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.strokeStyle = PAL.ink; g.lineWidth = 1; g.setLineDash([3, 2]); g.stroke(); g.setLineDash([]); }
    g.restore();
    unitHits.push({ u, kind: 'poly', pts: env });
  }
  // headquarters
  for (const id of ['napoleon', 'wellington', 'blucher']) {
    const L = SIM.leaders[id]; const p = SIM.leaderPos(L); if (!p) continue; if (id === 'blucher') continue;
    const [x, y] = P(p[0], p[1]), col = id === 'napoleon' ? PAL.FR : PAL.AL;
    g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 18); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 12, y - 15); g.lineTo(x, y - 11); g.closePath(); g.fill(); g.stroke(); g.restore();
    if (zf > 1.2) label(L.name, x + 6, y - 24, 'unit', 'l', col, 2, false, 1.1);
  }
  if (!layers.ulabels) return;
  if (zf >= 2.1) {
    for (const u of SIM.units) {
      if (!alive(u) || u.type === 'gar' || (u.type === 'art' && zf < 3.2) || u.status === 'broken') continue;
      const [ux, uy] = lerpPos(u), [x, y] = P(ux, uy), th = u.facing * Math.PI / 180, back = (u.D / 2 * s + 9);
      label(u.name.replace(/, (1st|2nd) echelon/, ''), x - Math.sin(th) * back, y + Math.cos(th) * back, 'unit', 'c', sideColor(u.side), u.type === 'art' ? 4.6 : 4, false);
    }
  } else {
    for (const gr of DYN_GROUPS) {
      const mem = SIM.units.filter(u => alive(u) && u.status !== 'broken' && (gr.corps ? u.corps === gr.corps : gr.ids.includes(u.id)) && u.type !== 'art');
      if (!mem.length) continue; let cx = 0, cy = 0; mem.forEach(u => { cx += u.x; cy += u.y; }); cx /= mem.length; cy /= mem.length;
      const [x, y] = P(cx + (gr.dx || 0), cy + (gr.dy || 0));
      label(gr.t, x, y, 'group', 'c', sideColor(gr.side), 0, true);
    }
  }
}
const DYN_GROUPS = [
  { t: 'I CORPS', side: 'FR', corps: 'derlon', dy: 260 }, { t: 'II CORPS', side: 'FR', corps: 'reille', dy: 240 }, { t: 'VI CORPS', side: 'FR', corps: 'lobau', dy: 200 },
  { t: 'GARDE', side: 'FR', corps: 'guard', dy: 220 }, { t: 'III CAV', side: 'FR', corps: 'kellermann', dy: 170 }, { t: 'IV CAV', side: 'FR', corps: 'milhaud', dy: 170 },
  { t: 'BÜLOW', side: 'PR', corps: 'bulow', dx: 300 }, { t: 'PIRCH', side: 'PR', corps: 'pirch', dx: 300 }, { t: 'ZIETEN', side: 'PR', corps: 'zieten', dy: -250 },
  { t: 'COOKE', side: 'AL', ids: ['byng', 'maitland'], dy: -190 }, { t: 'ALTEN', side: 'AL', ids: ['chalkett', 'kielm', 'ompteda'], dy: -380 }, { t: 'PICTON', side: 'AL', ids: ['kempt', 'pack', 'best', 'vincke'], dy: -420 },
  { t: 'CLINTON', side: 'AL', ids: ['adam', 'duplat', 'hhalkett'], dy: -240 }, { t: 'BRUNSWICK', side: 'AL', ids: ['bruAv', 'bruButlar', 'bruSpecht'], dy: -200 },
];
function drawSmoke(g) {
  if (!SIM || !layers.smoke) return;
  const SX = SIM.SX, SY = SIM.SY, sm = SIM.smoke;
  if (!drawSmoke.c) { drawSmoke.c = document.createElement('canvas'); drawSmoke.c.width = SX; drawSmoke.c.height = SY; drawSmoke.x = drawSmoke.c.getContext('2d'); drawSmoke.im = drawSmoke.x.createImageData(SX, SY); }
  const d = drawSmoke.im.data;
  for (let i = 0; i < SX * SY; i++) { const a = Math.min(0.62, sm[i] * 0.32); d[4 * i] = 238; d[4 * i + 1] = 236; d[4 * i + 2] = 228; d[4 * i + 3] = Math.round(a * 255); }
  drawSmoke.x.putImageData(drawSmoke.im, 0, 0);
  const [x0, y0] = P(-50, -50), [x1, y1] = P((SX - 1) * 100 + 50, (SY - 1) * 100 + 50);
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(drawSmoke.c, x0, y0, x1 - x0, y1 - y0); g.restore();
}
function drawFlashes(g) {
  if (!layers.flashes) { flashes = []; return; }
  const now = performance.now(); flashes = flashes.filter(f => now - f.t0 < 4000);
  for (const f of flashes) { const a = 1 - (now - f.t0) / 4000, [x, y] = P(f.x, f.y), r = (f.big ? 26 : 16) * (1.4 - a * 0.6);
    g.save(); g.strokeStyle = f.side === 'FR' ? PAL.FR : f.side === 'PR' ? PAL.PR : PAL.AL; g.globalAlpha = a; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore(); }
}
let offHits = [];
function drawOffmap(g) {
  offHits = []; if (!SIM || viewMode === 'napoleon') return;
  const groups = [['bulow', 'Bülow · IV Corps', 50.6933, 4.5040], ['pirch', 'Pirch I · II Corps', 50.6790, 4.5040], ['zieten', 'Zieten · I Corps', 50.7083, 4.4860], ['hal', 'Prince Frederik (Hal)', 50.6900, 4.3590], ['grouchy', 'Grouchy', 50.6550, 4.5040]];
  for (const [key, title, la, lo] of groups) {
    const mem = SIM.offmap.filter(u => (u.corps === key || u.group === key) && !u.onMap && !u.gone);
    if (!mem.length) continue;
    const due = mem.filter(u => u.arriveAt != null).map(u => u.arriveAt); const next = due.length ? Math.min(...due) : null;
    const [wx, wy] = ll2m(la, lo), ex = Math.min(Math.max(wx, 0), WM), ey = Math.min(Math.max(wy, 0), HM), [cx, cy] = P(ex, ey);
    if (cx < -4 || cy < -4 || cx > cssW + 4 || cy > cssH + 4) continue;
    const dir = wx > WM ? [1, 0] : wx < 0 ? [-1, 0] : wy < 0 ? [0, -1] : [0, 1], side = key === 'grouchy' ? 'FR' : key === 'hal' ? 'AL' : 'PR', col = sideColor(side);
    const ax = cx - dir[0] * 4, ay = cy - dir[1] * 4;
    g.save(); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.2; g.globalAlpha = next == null ? 0.4 : 1;
    g.beginPath(); g.moveTo(ax - dir[0] * 16, ay - dir[1] * 16); g.lineTo(ax, ay); g.stroke();
    const an = Math.atan2(dir[1], dir[0]); g.beginPath(); g.moveTo(ax + Math.cos(an) * 4, ay + Math.sin(an) * 4); g.lineTo(ax - Math.cos(an - 0.5) * 9, ay - Math.sin(an - 0.5) * 9); g.lineTo(ax - Math.cos(an + 0.5) * 9, ay - Math.sin(an + 0.5) * 9); g.closePath(); g.fill();
    g.font = `12px 'IM Fell English SC', Georgia, serif`; g.textBaseline = 'middle';
    const lx = dir[0] > 0 ? ax - 22 : dir[0] < 0 ? ax + 22 : ax, ly = dir[1] > 0 ? ay - 18 : dir[1] < 0 ? ay + 18 : ay;
    g.textAlign = dir[0] > 0 ? 'right' : dir[0] < 0 ? 'left' : 'center';
    const txt = title + (next != null ? ` · due ${SIM.fmtT(Math.max(next, SIM.t))}` : ' · not coming');
    g.lineWidth = 3; g.strokeStyle = PAL.paper; g.globalAlpha = 0.9; g.strokeText(txt, lx, ly); g.globalAlpha = next == null ? 0.6 : 1; g.fillText(txt, lx, ly); g.restore();
    offHits.push({ o: { title, text: `${mem.length} formations still off the field. ${next != null ? 'Leading troops due about ' + SIM.fmtT(next) + ' (the umpire knows; the commanders don\'t).' : 'Not coming in this battle.'}` }, x: cx, y: cy, r: 22 });
  }
}

/* ----- descriptions ----- */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const bearing = (dx, dy) => (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
const comp = b => COMPASS[Math.round(b / 22.5) % 16];
function whereIs(x, y) {
  let best = null, bd = Infinity; for (const l of LM) { const d = Math.hypot(l.x - x, l.y - y); if (d < bd) { bd = d; best = l; } }
  const n = best.n === "the Lion's Mound site" ? 'the crest west of the crossroads' : best.n; // the mound was raised in the 1820s
  if (bd < 40) return 'at ' + n;
  const dist = bd < 1000 ? Math.round(bd / 10) * 10 + ' m' : (bd / 1000).toFixed(1) + ' km';
  return `${dist} ${comp(bearing(x - best.x, y - best.y))} of ${n}`;
}
const fmt = n => Math.round(n).toLocaleString('en-GB');
const place = (x, y) => { const w = whereIs(x, y); return w.startsWith('at ') ? w.slice(3) : w; };
const formOf = u => u.type === 'cav' && u.form === 'columns' ? 'columns of squadrons' : (FORM[u.form] || u.form);
function unitHTML(u, rich) {
  const what = u.type === 'art' ? `${Math.round(u.str)} of ${u.guns0 || u.str0} guns` : `${fmt(u.str)} of ${fmt(u.str0)} men`;
  const kind = { inf: 'infantry', cav: 'cavalry', art: 'artillery', gar: 'garrison' }[u.type];
  const task = u.status === 'broken' ? (u.rallyT ? 'out of contact, trying to rally' : 'running for the rear') : u.charge ? 'charging ' + (SIM.byId[u.charge.target] ? SIM.byId[u.charge.target].name : '') : (TASKS[u.task.kind] || u.task.kind) + (u.task.sp ? ' ' + SIM.spById[u.task.sp].name : '');
  const nat = NAT[u.nat] || (u.side === 'PR' ? 'Prussian' : '');
  const coh = Math.round(u.coh), st = u.status;
  if (!rich) return `<b>${u.name}</b><div class="sub">${u.parent}</div><div>${nat} ${kind} · ${what}</div><div>${st} (cohesion ${coh}) · ${formOf(u)}${u.lying ? ', lying down' : ''} · ${task}</div>`;
  const cas = u.killed + u.wounded;
  return `<h3>${u.name}</h3><div class="small"><i>${u.parent}</i></div><dl>
    <dt>Strength</dt><dd>${what}</dd>
    <dt>Losses</dt><dd>${fmt(cas)} killed and wounded · ${fmt(u.captured + u.stragglers)} taken or straggled</dd>
    <dt>Condition</dt><dd>${st} · cohesion ${coh} of ${Math.round(u.cohMax)} · fatigue ${Math.round(u.fatigue)}</dd>
    <dt>Doing</dt><dd>${task}${u.halted ? ' (halted)' : ''} · ${formOf(u)}${u.lying ? ', lying down' : ''}</dd>
    ${u.type === 'art' ? `<dt>Rounds</dt><dd>${Math.round(u.rounds)} a gun</dd>` : `<dt>Cartridges</dt><dd>${Math.round(u.ammo)} a man</dd>`}
    ${u.type === 'cav' ? `<dt>Horses' wind</dt><dd>${Math.round(u.wind)}</dd>` : ''}
    <dt>Quality</dt><dd>${u.q.toFixed(2)}</dd>
    <dt>Where</dt><dd>${whereIs(u.x, u.y)}</dd></dl>`;
}

/* ================= Napoleon's map: what he believes ================= */
const SIDECOL = side => side === 'FR' ? PAL.FR : side === 'PR' ? PAL.PR : side === 'AL' ? PAL.AL : PAL.hach;
const NATW = { GB: 'British', KGL: 'British', HAN: 'Hanoverian', NL: 'Dutch-Belgian', NAS: 'Nassau', BRU: 'Brunswick', MIX: 'allied', PR: 'Prussian', FR: 'French' };
const CORPSN = { bulow: "Bülow's IV Corps", pirch: "Pirch's II Corps", zieten: "Zieten's I Corps", wellington: "Wellington's army", hal: 'the Hal force' };
function contactBox(c) {
  const k = c.kind;
  if (k === 'art') return [Math.min(400, Math.max(40, (c.guns || 6) * 15)), 26];
  if (k === 'cav') return [Math.min(420, Math.max(90, c.str * 0.2)), 44];
  return [Math.min(650, Math.max(70, c.str * 0.11)), k === 'troops' ? 70 : 56];
}
function quadAt(x, y, facing, W, D) {
  const th = (facing ?? 180) * Math.PI / 180, fx = Math.sin(th), fy = -Math.cos(th), ax = Math.cos(th), ay = Math.sin(th);
  const c = (a, f) => P(x + ax * a * W / 2 + fx * f * D / 2, y + ay * a * W / 2 + fy * f * D / 2);
  return [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)];
}
function polyFill(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function drawBelief(g) {
  if (!SIM || !SIM.command) return;
  const C = SIM.command, B = C.B.napoleon, now = SIM.t, s = view.s, zf = zoomF();
  if (viewMode === 'napoleon') unitHits = [];
  // places as Napoleon believes them
  for (const sp of SIM.sps) {
    const pb = B.places[sp.id]; if (!pb || !pb.holder) continue; const [x, y] = P(sp.x, sp.y), a = Math.max(0.35, Math.exp(-(now - pb.t) / 90));
    g.save(); g.globalAlpha = a; g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 12, y - 2); g.lineTo(x - 12, y - 16); g.stroke(); g.fillStyle = pb.holder === 'FR' ? PAL.FR : PAL.AL; g.fillRect(x - 21, y - 16, 9, 6); g.restore();
  }
  for (const [id, pl] of Object.entries(B.plumes)) { const sp = SIM.spById[id]; const [x, y] = P(sp.x, sp.y); g.save(); g.globalAlpha = Math.max(0.25, Math.exp(-(now - pl.t) / 120)); g.fillStyle = 'rgba(90,85,80,0.55)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + 4 + k * 3, y - 10 - k * 9, 5 + k * 2.5, 0, 7); g.fill(); } g.restore(); }
  // own corps, as last reported
  for (const o of B.own.values()) {
    const u = SIM.byId[o.uid]; if (!u || o.gone || u.type === 'gar' && u.spId) continue;
    const foc = beliefFocus ? beliefFocus.has(o.uid) : null;
    const ageP = now - o.t, a = Math.max(mapColour ? 0.8 : 0.5, Math.exp(-ageP / 60)) * 0.92 * (foc === false ? 0.3 : 1);
    const fp = WEngine.footprint(Object.assign({}, u, { form: o.form || u.form, str: o.str || u.str }));
    const pts = quadAt(o.x, o.y, u.facing, Math.max(fp.F, 6 / s), Math.max(fp.D, 3.2 / s));
    if (foc) { g.save(); polyFill(g, pts); g.lineJoin = 'round'; g.strokeStyle = beliefFocusCol || PAL.order || PAL.flag; g.lineWidth = 7; g.globalAlpha = 0.5; g.stroke(); g.restore(); }
    g.save(); polyFill(g, pts); if (mapColour) { g.lineJoin = 'round'; g.strokeStyle = 'rgba(246,240,222,0.9)'; g.lineWidth = 3; g.globalAlpha = a; g.stroke(); }
    if (u.type === 'inf') { g.fillStyle = PAL.FR; g.globalAlpha = a * (o.status === 'broken' ? 0.4 : 1); g.fill(); }
    else { g.fillStyle = PAL.paper; g.globalAlpha = a; g.fill(); g.strokeStyle = PAL.FR; g.lineWidth = 1.1; g.stroke(); if (u.type === 'cav') { g.save(); g.clip(); g.beginPath(); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); for (let d = x0 - (y1 - y0); d < x1; d += 3.1) { g.moveTo(d, y1); g.lineTo(d + (y1 - y0), y0); } g.stroke(); g.restore(); } }
    if (o.status === 'broken') { g.setLineDash([2, 2]); g.strokeStyle = PAL.ink; g.lineWidth = 0.6; g.stroke(); g.setLineDash([]); }
    else { g.globalAlpha = a; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.strokeStyle = PAL.ink; g.lineWidth = 1.3; g.stroke(); }
    g.restore();
    if (viewMode === 'napoleon') unitHits.push({ u: { belief: 'own', o, unit: u }, kind: 'poly', pts });
    if ((zf >= 2.1 || foc && zf >= 1.2) && layers.ulabels && viewMode === 'napoleon') { const [x, y] = P(o.x, o.y); label(u.name, x, y + Math.max(fp.D * s / 2, 3) + 9, 'unit', 'c', foc ? beliefFocusCol || PAL.order || PAL.FR : PAL.FR, foc ? 1.5 : 4.2, false); }
  }
  // the enemy, as seen and reported
  for (const c of B.c.values()) {
    const age = now - c.t; if (age > 200) continue;
    // rules doc: opacity e^(-age/45). On screen it bottoms out at 0.3 so old news stays legible until it is dropped after about three hours.
    const a = Math.max(0.35, Math.exp(-age / 45));
    const col = SIDECOL(c.side), [W, D] = contactBox(c);
    // uncertainty: moving bodies spread about 50 m per 10 minutes since the report (rules doc)
    if (c.moving || age > 20) { const r = (25 + (c.moving ? 5 : 2) * age) * s; if (r > 6) { const [x, y] = P(c.x, c.y); g.save(); g.globalAlpha = 0.35 * a + 0.1; g.strokeStyle = col; g.setLineDash([2, 3]); g.lineWidth = 1; g.beginPath(); g.arc(x, y, r + Math.max(W, D) * s / 2, 0, 7); g.stroke(); g.restore(); } }
    if (c.ghost && now - c.ghost.t < 60) { const gp = quadAt(c.ghost.x, c.ghost.y, c.dir, W, D); g.save(); polyFill(g, gp); g.globalAlpha = 0.5 * a; g.strokeStyle = col; g.setLineDash([3, 3]); g.lineWidth = 1; g.stroke(); g.restore(); }
    const pts = quadAt(c.x, c.y, c.dir ?? 0, Math.max(W, 6 / s), Math.max(D, 3.2 / s));
    g.save(); polyFill(g, pts); if (mapColour) { g.lineJoin = 'round'; g.strokeStyle = 'rgba(246,240,222,0.85)'; g.lineWidth = 3; g.globalAlpha = Math.max(0.5, a); g.stroke(); }
    if (c.kind === 'inf') { g.fillStyle = col; g.globalAlpha = 0.85 * a; g.fill(); }
    else if (c.kind === 'troops') { g.fillStyle = col; g.globalAlpha = 0.35 * a; g.fill(); g.globalAlpha = a; g.strokeStyle = col; g.setLineDash([3, 2]); g.lineWidth = 1.2; g.stroke(); g.setLineDash([]); }
    else { g.fillStyle = PAL.paper; g.globalAlpha = 0.9 * a; g.fill(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 1.1; g.stroke(); if (c.kind === 'cav') { g.save(); g.clip(); g.beginPath(); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); for (let d = x0 - (y1 - y0); d < x1; d += 3.1) { g.moveTo(d, y1); g.lineTo(d + (y1 - y0), y0); } g.stroke(); g.restore(); } else { g.fillStyle = col; const n = Math.min(12, c.guns || 4); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = pts[0][0] + (pts[1][0] - pts[0][0]) * t, y = pts[0][1] + (pts[1][1] - pts[0][1]) * t; g.beginPath(); g.arc(x + (pts[3][0] - pts[0][0]) * 0.3, y + (pts[3][1] - pts[0][1]) * 0.3, 1.2, 0, 7); g.fill(); } } }
    if (!c.side) { const [x, y] = P(c.x, c.y); g.globalAlpha = a; g.fillStyle = PAL.ink; g.font = `bold ${Math.round(11 * Math.min(1.4, Math.max(0.9, zf / 2)))}px 'EB Garamond', Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x, y); }
    if (c.status === 'broken') { g.globalAlpha = a; g.strokeStyle = PAL.ink; g.setLineDash([2, 2]); g.lineWidth = 0.8; polyFill(g, pts); g.stroke(); g.setLineDash([]); }
    g.restore();
    if (viewMode === 'napoleon') unitHits.push({ u: { belief: 'enemy', c }, kind: 'poly', pts });
    if (zf >= 3.0 && layers.ulabels && viewMode === 'napoleon' && a > 0.25) { const [x, y] = P(c.x, c.y); label(`${SIM.fmtT(c.t)} · ${srcShort(c.src)}`, x, y + Math.max(D * s / 2, 3) + 9, 'small', 'c', col, 5, false, 0.95); }
  }
}
function srcShort(src) { return src.replace(/'s report, \d\d:\d\d$/, "'s report").replace(/^own eyes$/, 'seen from headquarters'); }
function drawRiders(g) {
  if (!SIM || !SIM.command || !layers.riders) return;
  for (const r of SIM.command.riders) {
    if (r.status !== 'riding' || r.offmapAt != null) continue;
    if (viewMode === 'napoleon' && r.side !== 'FR') continue;
    const col = r.side === 'FR' ? PAL.FR : r.side === 'PR' ? PAL.PR : PAL.AL;
    g.save(); g.strokeStyle = col; g.globalAlpha = 0.45; g.lineWidth = 1.2; g.setLineDash([1.5, 2.5]); g.beginPath(); r.trail.concat([[r.x, r.y]]).forEach(([x, y], i) => { const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); g.setLineDash([]);
    const [x, y] = P(r.x, r.y); g.globalAlpha = 1; g.fillStyle = PAL.paper; g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill(); g.lineWidth = 1.6; g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); g.restore();
    unitHits.push({ u: { belief: 'rider', r }, kind: 'circle', x, y, r: 7 });
  }
}
function drawScene(g) {
  drawSmoke(g);
  truthAlpha = viewMode === 'compare' ? 0.3 : 1;
  if (viewMode !== 'napoleon') { if (layers.units) drawUnits(g); else unitHits = []; }
  if (viewMode !== 'truth') drawBelief(g);
  drawRiders(g);
  if (viewMode !== 'napoleon') drawFlashes(g);
  if (extraDraw) extraDraw(g);
  truthAlpha = 1;
}
function hoverHTML(u, rich) {
  if (!u.belief) return unitHTML(u, rich);
  const t = SIM.fmtT, now = SIM.t;
  if (u.belief === 'rider') { const r = u.r; return `<b>A rider</b><div>Carrying ${r.label}.</div><div class="sub">Left ${t(r.leftAt)}, ${(r.ridden / 1000).toFixed(1)} km ridden.</div>`; }
  if (u.belief === 'own') { const o = u.o, un = u.unit; return `<b>${un.name}</b><div class="sub">${un.parent}</div><div>${o.tState >= 0 ? `${Math.round(o.str).toLocaleString('en-GB')} ${un.type === 'art' ? 'guns' : 'men'}, ${o.cohWord || 'condition unknown'}` : 'Condition unknown'}${o.task ? ' · ' + (TASKS[o.task] || o.task) : ''}</div><div class="conf">Position as of ${t(o.t)} (${srcShort(o.src)}), ${Math.round(now - o.t)} min ago${o.tState >= 0 ? `; condition as of ${t(o.tState)}` : ''}</div>`; }
  const c = u.c, kind = c.kind === 'troops' ? 'troops' : c.kind === 'art' ? 'guns' : c.kind === 'cav' ? 'cavalry' : 'infantry', formTxt = c.form ? (c.kind === 'cav' && c.form === 'columns' ? 'columns of squadrons' : FORM[c.form] || c.form) : '';
  const who = c.corps ? CORPSN[c.corps] || '' : c.nat ? NATW[c.nat] : c.side === 'AL' ? "Wellington's (by position)" : c.side === 'PR' ? 'Prussian' : 'unidentified';
  return `<b>${c.kind === 'art' ? (c.guns || '?') + ' guns' : 'About ' + (Math.round(c.str / (c.str > 2000 ? 500 : 100)) * (c.str > 2000 ? 500 : 100)).toLocaleString('en-GB') + ' ' + kind}</b><div class="sub">${who}${formTxt ? ' · ' + formTxt : ''}${c.status === 'broken' ? ' · running' : ''}</div><div>${c.moving ? 'On the move. ' : ''}${whereIs(c.x, c.y)}</div><div class="conf">Seen ${t(c.t)} · ${c.src} · ${Math.round(now - c.t)} min ago</div>${c.ghost ? `<div class="conf">An earlier report (${c.ghost.src}) put them ${Math.round(Math.hypot(c.x - c.ghost.x, c.y - c.ghost.y))} m away.</div>` : ''}`;
}
