/* The battle lab (engine roadmap 4a, with 3e): any battle pack, on a map, fought by the generic commanders, or with you commanding one
   army through its own sightings (the enemy shown only as your army has seen him) and orders that go by rider. It also fights a battle
   many times and judges the results against the battle's targets, shows the pack's versions and validation, and keeps a battle as a
   replay to fight again. Everything here reads packs; nothing knows a particular battle. */
(() => {
'use strict';
const P = WPacks, En = WEngine, D = WDoctrine, $ = id => document.getElementById(id);
const hyp = Math.hypot, D2R = Math.PI / 180;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const PALETTE = ['#2f5596', '#b0352d', '#3f7a35', '#8a5a1e', '#6b4b8a', '#1f7a7a'];
const st = { id: null, E: null, ai: null, side: '', umpire: false, playing: false, speed: 10, acc: 0, last: 0, log: [], logShown: 0, sel: new Set(), aim: null, orders: [], nObj: 0, view: null, terrain: null, contours: null, hover: null, settings: null };

/* ----- battles ----- */
const battles = Object.keys(P.battles).sort((a, b) => (P.battles[a].name || a).localeCompare(P.battles[b].name || b));
for (const id of battles) { const o = document.createElement('option'); o.value = id; o.textContent = P.battles[id].name || id; $('battle').appendChild(o); }
const sideColour = (E, s) => { const sd = E.sides.find(x => x.id === s); const i = E.sideIds.indexOf(s); return (sd && sd.colour) || PALETTE[i % PALETTE.length]; };

function pickBattle(id) {
  stop(); st.id = id; const B = P.battles[id];
  // the header: versions, fingerprint, validation
  const v = P.versions(id); $('vchip').innerHTML = `version <b>${(v.battle || '').split(' ').pop()}</b>`;
  $('fpchip').innerHTML = `packs <b>${P.fingerprint(id)}</b>`; $('fpchip').title = 'a hash of everything this battle resolves to: a replay names it';
  const r = P.validate(id), vc = $('valchip');
  vc.className = 'chip ' + (r.errors.length ? 'bad' : r.warnings.length ? 'warn' : 'ok');
  vc.innerHTML = r.errors.length ? `<b>${r.errors.length} errors</b>` : r.warnings.length ? `valid, <b>${r.warnings.length} warnings</b>` : '<b>valid</b>';
  $('versions').innerHTML = Object.entries(v).map(([k, x]) => `<tr><th>${k}</th><td>${esc(x)}</td></tr>`).join('') + `<tr><th>engine</th><td>${En.version}</td></tr><tr><th>fingerprint</th><td class="num">${P.fingerprint(id)}</td></tr>`;
  $('valout').innerHTML = (r.errors.length || r.warnings.length) ? `<ul class="msgs">${r.errors.map(m => `<li class="e">${esc(m)}</li>`).join('')}${r.warnings.map(m => `<li class="w">${esc(m)}</li>`).join('')}</ul>` : '<p class="verdict ok" style="margin:0">No errors, no warnings.</p>';
  if (r.stats) $('valout').insertAdjacentHTML('beforeend', `<p class="muted" style="margin:6px 0 0">${esc(Object.entries(r.stats).map(([k, x]) => `${x} ${k}`).join(', '))}</p>`);
  // starts and sides
  $('start').innerHTML = Object.keys(B.starts || { '': 1 }).map(k => `<option value="${k}">${k || 'default'}</option>`).join('');
  $('side').innerHTML = '<option value="">nobody (watch)</option>' + (B.sides || []).map(s => `<option value="${s.id}">${esc(s.name || s.id)}</option>`).join('');
  $('runner').querySelector('option[value=targets]').textContent = B.targets ? `as the targets say (${B.targets.runner || 'generic'})` : 'generic (no targets)';
  $('manyout').innerHTML = '';
  if (r.errors.length) { st.E = null; draw(); logLine(null, 'This battle has errors and cannot be fought: see Pack.'); return; }
  newBattle();
}

/* ----- one battle ----- */
function newBattle(fromReplay) {
  stop();
  const seed = +$('seed').value || 1, start = $('start').value || undefined, side = $('side').value;
  st.settings = { battle: st.id, seed, scenario: start, side };
  const E = st.E = En.create({ battle: st.id, seed, scenario: start });
  const others = E.sideIds.filter(s => s !== side);
  st.ai = D.make({ sides: others }).init(E);
  st.side = side; st.sel.clear(); st.aim = null; st.orders = fromReplay ? fromReplay.slice() : []; st.replayIdx = 0; st.replaying = !!fromReplay; st.logShown = 0; st.nObj = 0;
  $('log').innerHTML = ''; $('selcard').innerHTML = '';
  st.terrain = terrainImage(E.W); st.contours = contours(E.W, 5);
  fit(); draw(); panel();
  logLine(E.t, `${P.battles[st.id].name}: seed ${seed}${start ? ', start ' + start : ''}. ${side ? `You command the ${sideName(side)} army; the others are the generic commanders.` : 'Every army has the generic commanders.'}`);
}
const sideName = s => { const sd = st.E.sides.find(x => x.id === s); return sd ? sd.name || s : s; };
function step() {
  const E = st.E; if (!E || E.over) return;
  // a replay's orders, at the minutes they were given
  if (st.replaying) while (st.replayIdx < st.orders.length && st.orders[st.replayIdx].t <= E.t) giveOrder(st.orders[st.replayIdx++], true);
  E.step();
}
function stop() { st.playing = false; $('play').textContent = 'Play'; }
function loop(ts) {
  requestAnimationFrame(loop);
  if (!st.playing || !st.E) { st.last = ts; return; }
  const dt = Math.min(0.25, (ts - (st.last || ts)) / 1000); st.last = ts;
  st.acc += dt * st.speed; const t0 = performance.now();
  while (st.acc >= 2 && !st.E.over && performance.now() - t0 < 40) { step(); st.acc -= 2; }
  if (st.E.over) { stop(); st.acc = 0; }
  draw(); panel();
}
requestAnimationFrame(loop);

/* ----- the player's orders (3e): by rider, from the army's chief to the general of the bodies ordered ----- */
function chiefOf(E, side) { const sd = E.sides.find(s => s.id === side), id = sd && sd.chief; return id && E.leaders[id] ? id : (Object.values(E.leaders).find(l => l.side === side) || {}).id || null; }
function generalOf(E, u) {
  if (u.leader && E.leaders[u.leader]) return u.leader;
  const L = Object.values(E.leaders).find(l => l.side === u.side && l.alive !== false && (l.corps === u.corps || (l.unit && E.byId[l.unit] && E.byId[l.unit].corps === u.corps)));
  return L ? L.id : chiefOf(E, u.side);
}
function giveOrder(o, replay) {
  const E = st.E, us = o.units.map(id => E.byId[id]).filter(u => u && E.formed(u)); if (!us.length) return;
  const from = chiefOf(E, st.side), to = generalOf(E, us[0]), id = `lab${E.t}_${++st.nObj}`;
  const spec = { id, from, to, direct: from === to, units: us.map(u => u.id), clarity: 0.9 };
  if (o.kind === 'attack' || o.kind === 'bombard') {
    const k = '_lab' + st.nObj; E.objectives[k] = { id: k, name: 'the place marked', point: o.point };
    if (o.kind === 'attack') Object.assign(spec, { kind: 'attack', obj: k, form: 'attack', maxAttempts: 2 });
    else Object.assign(spec, { kind: 'bombard', area: k, sitePoints: us.map(u => { const d = hyp(o.point[0] - u.x, o.point[1] - u.y); if (d <= 900) return [u.x, u.y]; const f = (d - 900) / d; return [u.x + (o.point[0] - u.x) * f, u.y + (o.point[1] - u.y) * f]; }) });
  } else if (o.kind === 'move') Object.assign(spec, { kind: 'move', point: o.point, then: 'hold' });
  else if (o.kind === 'hold') Object.assign(spec, { kind: 'hold' });
  else if (o.kind === 'retire') {
    const sd = E.sides.find(s => s.id === st.side);
    if (sd.exit) Object.assign(spec, { kind: 'retire' });
    else { const back = { S: [0, 1500], N: [0, -1500], E: [1500, 0], W: [-1500, 0] }[sd.rear] || [0, 0], c = centroid(us); Object.assign(spec, { kind: 'move', point: [c[0] + back[0], c[1] + back[1]], then: 'hold' }); }
  }
  E.sendOrder(spec);
  if (!replay) st.orders.push({ t: E.t, kind: o.kind, units: o.units.slice(), point: o.point || null });
  const name = us.length === 1 ? us[0].name : `${us.length} bodies`, gen = E.leaders[to] ? E.leaders[to].name : 'their general';
  logLine(E.t, `Order to ${gen}: ${name} to ${o.kind === 'attack' ? 'attack' : o.kind === 'move' ? 'march' : o.kind === 'bombard' ? 'bombard' : o.kind === 'hold' ? 'hold where they are' : 'fall back'}${o.point && E.nearestPlace ? ' near ' + E.nearestPlace(o.point[0], o.point[1]) : ''}.`, true);
}
const centroid = us => [us.reduce((a, u) => a + u.x, 0) / us.length, us.reduce((a, u) => a + u.y, 0) / us.length];

/* ----- the map ----- */
const cv = $('map'), g = cv.getContext('2d'); let dpr = 1, cw = 0, ch = 0;
function resize() { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); cw = r.width; ch = r.height; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); if (st.E && !st.view) fit(); draw(); }
new ResizeObserver(resize).observe($('mapbox'));
function fit() { const W = st.E.W, s = Math.min(cw / W.WM, ch / W.HM) * 0.96; st.view = { s, tx: (cw - W.WM * s) / 2, ty: (ch - W.HM * s) / 2 }; }
const S = (x, y) => [x * st.view.s + st.view.tx, y * st.view.s + st.view.ty], M = (sx, sy) => [(sx - st.view.tx) / st.view.s, (sy - st.view.ty) / st.view.s];
function hexA(c, a) { if (c.startsWith('rgba')) return c; const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function terrainImage(W) { // height tint and hillshade from the north-west, one pixel a grid cell
  const { NX, NY, H, CELL } = W, c = document.createElement('canvas'); c.width = NX; c.height = NY;
  const x = c.getContext('2d'), img = x.createImageData(NX, NY); let lo = Infinity, hi = -Infinity; for (const h of H) { if (h < lo) lo = h; if (h > hi) hi = h; }
  const col = v => { const n = parseInt(v.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }, L = col(css('--low')), Hc = col(css('--high')), dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
  for (let r = 0; r < NY; r++) for (let q = 0; q < NX; q++) {
    const i = r * NX + q, h = H[i], f = (h - lo) / ((hi - lo) || 1), dx = (H[r * NX + Math.min(NX - 1, q + 1)] - H[r * NX + Math.max(0, q - 1)]) / (2 * CELL), dy = (H[Math.min(NY - 1, r + 1) * NX + q] - H[Math.max(0, r - 1) * NX + q]) / (2 * CELL);
    const shade = Math.max(-1, Math.min(1, (-dx - dy) * 6)) * (dark ? 22 : 30);
    for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, L[k] + (Hc[k] - L[k]) * f + shade));
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0); return { c, lo, hi };
}
function contours(W, step) { // marching squares: segments in metres, every `step` m; every fourth one bold
  const { NX, NY, H, CELL } = W, out = []; let lo = Infinity, hi = -Infinity; for (const h of H) { if (h < lo) lo = h; if (h > hi) hi = h; }
  for (let lev = Math.ceil(lo / step) * step; lev <= hi; lev += step) {
    const segs = [], bold = Math.round(lev / step) % 4 === 0;
    for (let r = 0; r < NY - 1; r++) for (let q = 0; q < NX - 1; q++) {
      const a = H[r * NX + q], b = H[r * NX + q + 1], c = H[(r + 1) * NX + q + 1], d = H[(r + 1) * NX + q], x0 = q * CELL, y0 = r * CELL;
      const p = []; const e = (h1, h2, x1, y1, x2, y2) => { if ((h1 < lev) !== (h2 < lev)) { const t = (lev - h1) / (h2 - h1); p.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
      e(a, b, x0, y0, x0 + CELL, y0); e(b, c, x0 + CELL, y0, x0 + CELL, y0 + CELL); e(c, d, x0 + CELL, y0 + CELL, x0, y0 + CELL); e(d, a, x0, y0 + CELL, x0, y0);
      if (p.length >= 2) segs.push(p[0], p[1]); if (p.length === 4) segs.push(p[2], p[3]);
    }
    out.push({ lev, bold, segs });
  }
  return out;
}
function poly(pts, close) { g.beginPath(); pts.forEach((p, i) => { const [x, y] = S(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); }
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = css('--bg'); g.fillRect(0, 0, cw, ch);
  const E = st.E; if (!E || !st.view) return; const W = E.W, s = st.view.s;
  const [x0, y0] = S(0, 0), [x1, y1] = S(W.WM, W.HM);
  g.imageSmoothingEnabled = true; g.drawImage(st.terrain.c, x0, y0, x1 - x0, y1 - y0);
  // contours
  for (const c of st.contours) { g.strokeStyle = css(c.bold ? '--contour-b' : '--contour'); g.lineWidth = c.bold ? 1 : 0.6; g.beginPath(); for (let i = 0; i < c.segs.length; i += 2) { const [a, b] = S(...c.segs[i]), [d, e] = S(...c.segs[i + 1]); g.moveTo(a, b); g.lineTo(d, e); } g.stroke(); }
  // woods, villages, water, roads, buildings
  for (const w of W.WOODS || []) { poly(w.pts, true); g.fillStyle = css('--wood'); g.fill(); g.strokeStyle = css('--woodline'); g.lineWidth = 0.8; g.stroke(); }
  for (const v of W.VILLAGES || []) { const [x, y] = S(v.cx, v.cy); g.beginPath(); g.arc(x, y, v.r * s, 0, 7); g.fillStyle = css('--village'); g.fill(); }
  g.strokeStyle = css('--water'); g.lineWidth = Math.max(1, 6 * s);
  for (const sm of W.STREAMS || []) { g.beginPath(); let on = false; for (let k = 0; k < sm.length; k += 3) { if (sm[k + 2] < 300) { on = false; continue; } const [x, y] = S(sm[k], sm[k + 1]); on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } g.stroke(); }
  for (const r of W.ROADS || []) { poly(r.pts); g.strokeStyle = css(r.kind === 'chaussee' ? '--road' : '--lane'); g.lineWidth = Math.max(1, (r.kind === 'chaussee' ? 14 : 8) * s); g.stroke(); }
  for (const b of [...(W.BUILDINGS || []), ...(W.ENCLOSURES || [])]) { const [x, y] = S(b.x, b.y); g.save(); g.translate(x, y); g.rotate((b.rot || 0) * D2R); if (b.kind) { g.strokeStyle = css('--build'); g.lineWidth = 1; g.strokeRect(-b.w * s / 2, -b.h * s / 2, b.w * s, b.h * s); } else { g.fillStyle = css('--build'); g.fillRect(-b.w * s / 2, -b.h * s / 2, b.w * s, b.h * s); } g.restore(); }
  // objectives and places
  g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
  for (const [k, o] of Object.entries(E.objectives)) {
    if (k.startsWith('_') || o.sp || !(o.value || E.sides.some(sd => sd.objectives && sd.objectives[k] != null))) continue; // the lines and points that matter to someone
    if (o.line) { poly(o.line); g.setLineDash([6, 4]); g.strokeStyle = css('--obj'); g.lineWidth = 2; g.stroke(); g.setLineDash([]); const [x, y] = S(...o.point); g.fillStyle = css('--obj'); g.fillText(o.name + (o.takenAt != null ? ' (taken)' : ''), x, y - 8); }
    else if (o.point) { const [x, y] = S(...o.point); g.fillStyle = css('--obj'); g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.fill(); g.fillText(o.name, x, y - 9); }
  }
  for (const sp of E.sps) {
    for (const sec of sp.secs) { const [x, y] = S(sec.x, sec.y); g.beginPath(); g.arc(x, y, Math.max(3, sec.r * s), 0, 7); g.lineWidth = 2; g.strokeStyle = sec.burnt ? css('--muted') : sec.held ? holderColour(E, sec.held) : css('--muted'); g.stroke(); }
    const [x, y] = S(sp.x, sp.y); g.fillStyle = css('--ink'); g.fillText(sp.name, x, y - Math.max(8, sp.secs[0].r * s) - 6);
  }
  // units: your own (or everyone's, watching or as umpire); the enemy as your army has seen him
  const fog = st.side && !st.umpire, coal = st.side ? E.coalition[st.side] : null;
  for (const u of E.units) {
    if (!u.onMap || u.gone || u.str <= 0) continue;
    if (fog && E.coalition[u.side] !== coal) continue;
    drawUnit(u.x, u.y, u.F, u.D, u.facing, sideColour(E, u.side), u.status === 'broken' ? 0.35 : 1, u.status === 'broken', st.sel.has(u.id) || st.hover === u.id, !!E.era.arms[u.arm].crew);
  }
  if (fog) for (const [key, c] of Object.entries(E.contacts[coal] || {})) { // a sighting: where it was, as big as it looked, fading with age
    const age = E.t - c.t; if (age > 60) continue; const u = E.byId[key], F = u ? u.F : 120, Dd = u ? u.D : 40;
    drawUnit(c.x, c.y, F, Dd, u ? u.facing : 0, sideColour(E, c.side || E.sideIds.find(s => E.coalition[s] !== coal)), Math.max(0.15, 1 - age / 60), true, false, c.type === 'art');
  }
  // leaders
  for (const L of Object.values(E.leaders)) { if (L.alive === false || L.offmap || (fog && E.coalition[L.side] !== coal)) continue; const p = E.leaderPos(L); if (!p) continue; const [x, y] = S(p[0], p[1]); g.fillStyle = sideColour(E, L.side); g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 2.5 : 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = css('--bg'); g.lineWidth = 1; g.stroke(); }
  // your orders on the way: a dashed line from the body to the point
  for (const o of E.orders) if (o.id && String(o.id).startsWith('lab') && o.status !== 'done') { const u = E.byId[o.units[0]], p = o.point || (o.obj && E.objectives[o.obj] && E.objectives[o.obj].point) || (o.area && E.objectives[o.area] && E.objectives[o.area].point); if (!u || !p) continue; const [a, b] = S(u.x, u.y), [c, d] = S(p[0], p[1]); g.setLineDash([4, 4]); g.strokeStyle = css('--sel'); g.lineWidth = 1.5; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.setLineDash([]); }
  // hover label
  const hu = st.hover && E.byId[st.hover]; if (hu) { const [x, y] = S(hu.x, hu.y); g.font = '600 12px system-ui, sans-serif'; const t = `${hu.name} · ${Math.round(hu.str)}${E.era.arms[hu.arm].crew ? ' guns' : ' men'} · ${hu.status}`; const w = g.measureText(t).width + 12; g.fillStyle = css('--panel'); g.fillRect(x - w / 2, y - 34, w, 20); g.fillStyle = css('--ink'); g.fillText(t, x, y - 20); }
  hud();
}
function holderColour(E, coalKey) { const s = E.sideIds.find(x => E.coalition[x] === coalKey); return s ? sideColour(E, s) : css('--muted'); }
function drawUnit(x, y, F, Dd, facing, col, alpha, hollow, sel, guns) {
  const s = st.view.s, [sx, sy] = S(x, y), w = Math.max(4, F * s), h = Math.max(3, Dd * s);
  g.save(); g.translate(sx, sy); g.rotate((facing || 0) * D2R); g.globalAlpha = alpha;
  if (hollow) { g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(-w / 2, -h / 2, w, h); } else { g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h); }
  if (guns) { g.fillStyle = hollow ? col : css('--bg'); g.beginPath(); g.arc(0, 0, Math.max(1.5, Math.min(w, h) / 4), 0, 7); g.fill(); }
  g.fillStyle = hollow ? col : css('--bg'); g.fillRect(-w / 2, -h / 2, w, Math.max(1, h * 0.2)); // the front edge
  if (sel) { g.globalAlpha = 1; g.strokeStyle = css('--sel'); g.lineWidth = 2; g.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); }
  g.restore();
}
function hud() {
  const E = st.E, h = $('maphud'); if (!E) { h.innerHTML = ''; return; }
  h.innerHTML = E.sideIds.map(s => `<span class="chip"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${sideColour(E, s)}"></i>${esc(sideName(s))}</span>`).join('') + (st.side && !st.umpire ? '<span class="chip">the enemy: as last seen</span>' : '');
}

/* ----- pointer: pan, zoom, pick, aim ----- */
const pts = new Map(); let drag = null, pinch = null, moved = false;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); moved = false; if (pts.size === 1) drag = { x: e.offsetX, y: e.offsetY, tx: st.view && st.view.tx, ty: st.view && st.view.ty }; else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: hyp(a[0] - b[0], a[1] - b[1]), s: st.view.s, c: M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; drag = null; } });
cv.addEventListener('pointermove', e => {
  if (!st.view) return;
  if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = hyp(a[0] - b[0], a[1] - b[1]); zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.s * d / pinch.d, pinch.c); moved = true; return; }
  if (drag) { const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; if (moved) { st.view.tx = drag.tx + dx; st.view.ty = drag.ty + dy; draw(); } return; }
  const u = pick(e.offsetX, e.offsetY); const id = u ? u.id : null; if (id !== st.hover) { st.hover = id; draw(); }
});
cv.addEventListener('pointerup', e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (drag && !moved) click(e.offsetX, e.offsetY, e.shiftKey); drag = null; });
cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); if (!st.view) return; zoomAt(e.offsetX, e.offsetY, st.view.s * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
function zoomAt(sx, sy, s, at) { const [mx, my] = at || M(sx, sy); st.view.s = Math.max(0.01, Math.min(2, s)); st.view.tx = sx - mx * st.view.s; st.view.ty = sy - my * st.view.s; draw(); }
function pick(sx, sy) {
  const E = st.E; if (!E) return null; const [x, y] = M(sx, sy), fog = st.side && !st.umpire, coal = st.side ? E.coalition[st.side] : null; let best = null, bd = Math.max(25, 12 / st.view.s);
  for (const u of E.units) { if (!u.onMap || u.gone || u.str <= 0 || (fog && E.coalition[u.side] !== coal)) continue; const d = hyp(u.x - x, u.y - y) - Math.max(u.F, u.D) / 2; if (d < bd) { bd = d; best = u; } }
  return best;
}
function click(sx, sy, add) {
  const E = st.E; if (!E) return;
  if (st.aim) { const p = M(sx, sy); giveOrder({ kind: st.aim, units: [...st.sel], point: [Math.round(p[0]), Math.round(p[1])] }); st.aim = null; cv.classList.remove('aim'); $('hint').hidden = true; draw(); panel(); return; }
  const u = pick(sx, sy);
  if (!u) { st.sel.clear(); } else if (add) { st.sel.has(u.id) ? st.sel.delete(u.id) : st.sel.add(u.id); } else { st.sel.clear(); st.sel.add(u.id); }
  draw(); panel();
}

/* ----- the panel ----- */
function panel() {
  const E = st.E; if (!E) return;
  $('clock').firstChild.nodeValue = E.fmtT(E.t);
  $('clocknote').textContent = E.over ? `${E.result.grade} (${E.result.why})` : E.t >= E.light.sunset ? 'after sunset' : '';
  $('bars').innerHTML = E.sideIds.map(s => { const m = Math.max(0, Math.round(E.morale[s])); return `<span>${esc(sideName(s))}</span><span class="bar"><i style="width:${Math.min(100, m)}%;background:${sideColour(E, s)}"></i></span><span class="num">${m}</span>`; }).join('');
  // the selected bodies, and what you may order them
  const us = [...st.sel].map(id => E.byId[id]).filter(Boolean), mine = st.side && us.length && us.every(u => u.side === st.side);
  if (!us.length) $('selcard').innerHTML = st.side ? '<p class="muted" style="margin:0">Click one of your bodies (shift-click for more) to give it an order.</p>' : '';
  else {
    const guns = us.every(u => E.era.arms[u.arm].crew), u = us[0], L = E.leaders[generalOf(E, u)];
    $('selcard').innerHTML = `<div class="card"><div class="t">${us.length === 1 ? esc(u.name) : us.length + ' bodies'}</div>` +
      (us.length === 1 ? `<div class="muted">${esc(u.parent || '')}${L ? ' · ' + esc(L.name) : ''}</div><div class="num">${Math.round(u.str)} ${E.era.arms[u.arm].crew ? 'guns' : 'men'} · ${u.form} · cohesion ${Math.round(u.coh)} · ${u.status} · ${u.task.kind}</div>` : '') +
      (mine && !E.over ? `<div class="row">${guns ? '<button data-o="bombard">Bombard…</button>' : '<button data-o="attack">Attack…</button>'}<button data-o="move">March to…</button><button data-o="hold">Hold</button><button data-o="retire">Fall back</button></div><div class="muted" style="font-size:12px">Orders go by rider from ${esc((E.leaders[chiefOf(E, st.side)] || {}).name || 'the chief')} to the general; they take minutes to arrive.</div>` : '') + '</div>';
    $('selcard').querySelectorAll('button[data-o]').forEach(b => b.onclick = () => {
      const k = b.dataset.o;
      if (k === 'hold' || k === 'retire') { giveOrder({ kind: k, units: [...st.sel] }); panel(); draw(); return; }
      st.aim = k; cv.classList.add('aim'); $('hint').hidden = false; $('hint').textContent = `Click the map: where to ${k === 'move' ? 'march' : k}`;
    });
  }
  // the log
  const box = $('log');
  for (; st.logShown < E.log.length; st.logShown++) { const l = E.log[st.logShown]; if (l.hidden && !(st.umpire || !st.side)) continue; if (!(l.important || ['orders', 'place', 'army', 'break', 'end'].includes(l.cat))) continue; if (st.side && !st.umpire && l.side && E.coalition[l.side] !== E.coalition[st.side] && l.cat === 'orders') continue; logLine(l.t, l.text, l.important); }
}
function logLine(t, text, imp) { const d = document.createElement('div'); d.innerHTML = `<span>${t == null ? '' : st.E ? st.E.fmtT(t) : ''}</span><span class="${imp ? 'imp' : ''}">${esc(text)}</span>`; const box = $('log'); box.prepend(d); while (box.children.length > 300) box.lastChild.remove(); }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ----- controls ----- */
$('battle').onchange = () => pickBattle($('battle').value);
$('newb').onclick = () => newBattle();
$('play').onclick = () => { if (!st.E || st.E.over) return; st.playing = !st.playing; $('play').textContent = st.playing ? 'Pause' : 'Play'; st.last = performance.now(); };
$('step').onclick = () => { if (!st.E) return; for (let i = 0; i < 5 && !st.E.over; i++) step(); draw(); panel(); };
$('toend').onclick = () => { if (!st.E) return; stop(); const t0 = performance.now(); const chunk = () => { const c0 = performance.now(); while (!st.E.over && performance.now() - c0 < 60) step(); draw(); panel(); if (!st.E.over) setTimeout(chunk, 0); }; chunk(); };
$('speed').onchange = () => { st.speed = +$('speed').value; };
$('umpire').onchange = () => { st.umpire = $('umpire').checked; st.logShown = 0; $('log').innerHTML = ''; panel(); draw(); };
$('side').onchange = () => newBattle();
$('start').onchange = () => newBattle();
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('sel', x === b)); for (const t of ['fight', 'many', 'pack']) $('tab-' + t).hidden = t !== b.dataset.tab; });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (st.E) { st.terrain = terrainImage(st.E.W); draw(); } });

/* ----- replays (4e): this battle's settings and your orders, with the versions ----- */
$('repcopy').onclick = async () => {
  if (!st.E) return;
  const r = { kind: 'battle-replay', format: 1, runner: 'lab', battle: st.id, engine: En.version, packs: P.versions(st.id), fingerprint: P.fingerprint(st.id), settings: st.settings, log: st.orders };
  const t = JSON.stringify(r); $('reptext').value = t;
  try { await navigator.clipboard.writeText(t); $('repnote').textContent = 'Copied.'; } catch (e) { $('reptext').select(); $('repnote').textContent = 'Selected: copy it with your keyboard.'; }
};
$('repload').onclick = () => {
  let r; try { r = JSON.parse($('reptext').value); } catch (e) { $('repnote').textContent = 'That is not a replay (not JSON).'; return; }
  if (r.kind !== 'battle-replay' || r.runner !== 'lab') { $('repnote').textContent = 'That is not a replay made here.'; return; }
  if (!P.battles[r.battle]) { $('repnote').textContent = `Battle "${r.battle}" is not in this lab.`; return; }
  const notes = []; if (r.engine !== En.version) notes.push(`engine ${r.engine}, now ${En.version}`); if (r.fingerprint !== P.fingerprint(r.battle)) notes.push(`packs ${r.fingerprint}, now ${P.fingerprint(r.battle)}`);
  $('repnote').textContent = notes.length ? `Fighting it again; it may come out differently (${notes.join('; ')}).` : 'Fighting it again: the same engine and packs, so the same battle.';
  $('battle').value = r.battle; if (st.id !== r.battle) pickBattle(r.battle);
  $('seed').value = r.settings.seed; $('start').value = r.settings.scenario || ''; $('side').value = r.settings.side || '';
  newBattle(r.log);
  document.querySelector('.tabs button[data-tab=fight]').click();
};

/* ----- many battles: in workers built from this page's own scripts, judged against the battle's targets ----- */
let pool = null, running = null;
function workers() {
  if (pool) return pool;
  const src = [...document.querySelectorAll('script[id^="src-"]')].map(el => el.textContent).join('\n;\n');
  const body = src + `
;self.onmessage = e => { const d = e.data, out = [];
  for (const seed of d.seeds) { try { let E;
    if (d.runner === 'historical') { E = WEngine.create({ battle: d.battle, seed }); WAI.make({ plan: 'script' }).init(E); WCommand.install(E, {}); WOrders.install(E); WScript.historical(E); }
    else if (d.runner === 'plan') { E = WEngine.create({ battle: d.battle, seed }); WAI.make({ plan: 'script' }).init(E); WScript.historical(E); } // (phase 5) the recorded plans, without the command layer
    else { E = WEngine.create({ battle: d.battle, seed }); WDoctrine.make(d.runner === 'bare' ? { timetables: false } : {}).init(E); } // bare: without the battle's timetables (3d)
    E.run(); const r = E.result || {};
    out.push({ seed, grade: r.grade || 'unfinished', why: r.why, t: E.t, kw: Object.fromEntries(Object.entries(r.cas || {}).map(([s, c]) => [s, c.kw])), metrics: Object.assign({}, E.metrics) });
  } catch (err) { out.push({ seed, err: String(err && err.message || err) }); } self.postMessage({ one: out[out.length - 1] }); }
  self.postMessage({ done: true }); };`;
  const url = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  pool = Array.from({ length: n }, () => new Worker(url)); return pool;
}
$('runmany').onclick = () => {
  const id = st.id, B = P.battles[id], n = Math.max(1, Math.min(500, +$('n').value || 20)), seed0 = +$('seed0').value || 1000;
  const runner = $('runner').value === 'targets' && B.targets ? (B.targets.runner || 'doctrine') : $('runner').value === 'bare' ? 'bare' : 'doctrine';
  let ws; try { ws = workers(); } catch (e) { $('manyout').innerHTML = '<p class="verdict bad">This browser will not start workers here.</p>'; return; }
  const res = []; running = { id, n, ws: ws.length }; $('runmany').disabled = true; $('stopmany').disabled = false; $('manyprog').textContent = `0 of ${n}`;
  const seeds = Array.from({ length: n }, (_, i) => seed0 + i), t0 = performance.now(); let doneW = 0;
  ws.forEach((w, i) => { w.onmessage = e => { if (!running || running.id !== id) return; if (e.data.one) { res.push(e.data.one); $('manyprog').textContent = `${res.length} of ${n}`; manyShow(id, res, n, runner, t0); } if (e.data.done && ++doneW === ws.length) { running = null; $('runmany').disabled = false; $('stopmany').disabled = true; } }; w.postMessage({ battle: id, seeds: seeds.filter((_, k) => k % ws.length === i), runner }); });
};
$('stopmany').onclick = () => { if (pool) pool.forEach(w => w.terminate()); pool = null; running = null; $('runmany').disabled = false; $('stopmany').disabled = true; $('manyprog').textContent += ' (stopped)'; };
const pct = (a, q) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : null; };
const kf = v => v == null ? '–' : (v / 1000).toFixed(1) + 'k', tm = t => t == null ? '–' : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`, tmin = s => typeof s === 'string' ? +s.split(':')[0] * 60 + +s.split(':')[1] : s;
function judge(T, res) { // the same judgement as tools/tune.js
  const n = res.length;
  return T.checks.map(c => {
    if (c.share) { const re = new RegExp(c.share), not = c.not ? new RegExp(c.not) : null, v = 100 * res.filter(r => re.test(r.grade) && !(not && not.test(r.grade))).length / n; return { what: c.what, value: v.toFixed(0) + '%', ok: (c.min == null || v >= c.min) && (c.max == null || v <= c.max) && (c.below == null || v < c.below), band: c.below != null ? `under ${c.below}%` : `${c.min ?? 0}–${c.max ?? 100}%` }; }
    if (c.losses) { const v = pct(res.map(r => r.kw[c.losses]), 0.5); return { what: c.what, value: kf(v), ok: v >= c.median[0] && v <= c.median[1], band: `${kf(c.median[0])}–${kf(c.median[1])}` }; }
    if (c.metric && c.median) { const v = pct(res.map(r => r.metrics[c.metric]), 0.5); return { what: c.what, value: tm(v), ok: v != null && v >= tmin(c.median[0]) && v <= tmin(c.median[1]), band: `${c.median[0]}–${c.median[1]}` }; }
    const v = 100 * res.filter(r => r.metrics[c.metric] != null).length / n; return { what: c.what, value: v.toFixed(0) + '%', ok: (c.min == null || v >= c.min) && (c.max == null || v <= c.max), band: `${c.min ?? 0}–${c.max ?? 100}%` };
  });
}
function manyShow(id, all, n, runner, t0) {
  const B = P.battles[id], res = all.filter(r => !r.err), errs = all.filter(r => r.err); if (!res.length) { $('manyout').innerHTML = errs.length ? `<p class="verdict bad">${esc(errs[0].err)}</p>` : ''; return; }
  const gr = {}; for (const r of res) gr[r.grade] = (gr[r.grade] || 0) + 1;
  const sides = Object.keys(res[0].kw), mets = Object.keys(res[0].metrics).filter(k => res.some(r => r.metrics[k] != null));
  let h = `<p class="muted" style="margin:0">${res.length} of ${n} fought (${runner === 'historical' || runner === 'plan' ? 'the recorded plan' : runner === 'bare' ? 'generic commanders, no timetables' : 'generic commanders'}), ${((performance.now() - t0) / 1000).toFixed(0)} s${errs.length ? `; ${errs.length} failed: ${esc(errs[0].err)}` : ''}</p>`;
  h += '<h3>Results</h3><table>' + Object.entries(gr).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${Math.round(100 * v / res.length)}%</td></tr>`).join('') + '</table>';
  h += '<h3>Killed and wounded</h3><table><tr><th>army</th><th class="n">p10</th><th class="n">median</th><th class="n">p90</th></tr>' + sides.map(s => `<tr><td>${esc(B.sides.find(x => x.id === s) ? B.sides.find(x => x.id === s).name : s)}</td>${[0.1, 0.5, 0.9].map(q => `<td class="n">${kf(pct(res.map(r => r.kw[s]), q))}</td>`).join('')}</tr>`).join('') + '</table>';
  if (mets.length) h += '<h3>When things happened</h3><table><tr><th>metric</th><th class="n">in</th><th class="n">median</th></tr>' + mets.map(k => `<tr><td>${esc(k)}</td><td class="n">${res.filter(r => r.metrics[k] != null).length}/${res.length}</td><td class="n">${tm(pct(res.map(r => r.metrics[k]), 0.5))}</td></tr>`).join('') + '</table>';
  if (B.targets) { const J = judge(B.targets, res), ok = J.every(j => j.ok); h += `<h3>Against its targets</h3><p class="verdict ${ok ? 'ok' : 'bad'}" style="margin:0">${ok ? 'In band' : `${J.filter(j => !j.ok).length} out of band`}${res.length < 100 ? ' (few battles: read it as a sketch)' : ''}</p><table>` + J.map(j => `<tr><td>${j.ok ? '✓' : '✗'} ${esc(j.what)}</td><td class="n">${j.value}</td><td class="n muted">${j.band}</td></tr>`).join('') + '</table>'; }
  $('manyout').innerHTML = h;
}

// for tests and the curious: the lab's state, a unit's place on screen, and the order call the buttons make
globalThis.WLab = { st, screenOf: id => { const u = st.E && st.E.byId[id]; return u ? S(u.x, u.y) : null; }, giveOrder, step };

/* ----- start: the first battle, or the one named in the address (#id) ----- */
const want = (location.hash || '').slice(1);
$('battle').value = battles.includes(want) ? want : battles.includes('toy-ridge') ? 'toy-ridge' : battles[0];
requestAnimationFrame(() => { resize(); pickBattle($('battle').value); });
})();
