/* ================= (9) map style: the Emperor's paper map, or a colour map with relief ================= */
// A prototype for choosing the look until a 3D client exists. The colour map paints the ground from the same height grid the sim
// uses: fields and meadows in greens and ripening-crop ochres, shaded relief lit from the north-west, dark woods, and plumes over
// burning buildings. It is drawing only: nothing here reads the dice or changes the battle. The choice is kept in this browser.
let MAPSTYLE = 'paper';
try { MAPSTYLE = localStorage.getItem('waterloo.mapstyle') === 'colour' ? 'colour' : 'paper'; } catch (e) { /* storage blocked: paper */ }
function setMapStyle(v) { MAPSTYLE = v === 'colour' ? 'colour' : 'paper'; mapColour = MAPSTYLE === 'colour'; try { localStorage.setItem('waterloo.mapstyle', MAPSTYLE); } catch (e) { /* not kept */ } document.body.classList.toggle('mapcolour', MAPSTYLE === 'colour'); scheduleTerrain(true); requestDraw(); }
document.body.classList.toggle('mapcolour', MAPSTYLE === 'colour'); mapColour = MAPSTYLE === 'colour';
let COLOUR = null;
function colourRelief() {
  if (COLOUR) return COLOUR;
  const K = 4, Wd = (NX - 1) * K + 1, Hd = (NY - 1) * K + 1, c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
  const x = c.getContext('2d'), im = x.createImageData(Wd, Hd), d = im.data;
  // field patches: smooth value noise at two scales, fixed by a seed so the fields never move
  const noise = (cell, seed) => { const R = rng(seed), nx = Math.ceil(WM / cell) + 2, ny = Math.ceil(HM / cell) + 2, v = new Float32Array(nx * ny); for (let i = 0; i < v.length; i++) v[i] = R();
    return (px, py) => { const fx = px / cell, fy = py / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = v[iy * nx + ix], b = v[iy * nx + ix + 1], cc = v[(iy + 1) * nx + ix], dd = v[(iy + 1) * nx + ix + 1]; return (a + (b - a) * sx) * (1 - sy) + (cc + (dd - cc) * sx) * sy; }; };
  const big = noise(700, 18150618), small = noise(220, 1815), fine = noise(70, 618);
  // the lie of the land: height against its surroundings (about 400 m), so valleys sit in shadow and crests catch the light
  const HB = (() => { const R = 8, tmp = new Float32Array(NX * NY), out = new Float32Array(NX * NY);
    for (let r = 0; r < NY; r++) for (let c = 0; c < NX; c++) { let a = 0, n = 0; for (let i = -R; i <= R; i++) { const cc = c + i; if (cc < 0 || cc >= NX) continue; a += HD[r * NX + cc]; n++; } tmp[r * NX + c] = a / n; }
    for (let r = 0; r < NY; r++) for (let c = 0; c < NX; c++) { let a = 0, n = 0; for (let i = -R; i <= R; i++) { const rr = r + i; if (rr < 0 || rr >= NY) continue; a += tmp[rr * NX + c]; n++; } out[r * NX + c] = a / n; }
    return out; })();
  const meadow = [112, 138, 70], crop = [190, 176, 106], low = [86, 112, 60], Z = 14, Lx = -0.55, Ly = -0.55, Lz = 0.63; // light from the north-west, relief exaggerated fourteenfold
  for (let py = 0; py < Hd; py++) for (let px = 0; px < Wd; px++) {
    const wx = px / K * CELL, wy = py / K * CELL, h = hdAt(wx, wy), gx = samp(GXD, wx, wy) * Z, gy = samp(GYD, wx, wy) * Z, nl = Math.hypot(gx, gy, 1);
    const rel = Math.max(-12, Math.min(12, h - samp(HB, wx, wy)));
    const shade = Math.max(0, (-gx * Lx - gy * Ly + Lz) / nl), f = (0.5 + 0.75 * shade) * (1 + 0.018 * rel);
    const ripe = Math.min(1, Math.max(0, 0.2 + 0.55 * big(wx, wy) + 0.15 * (small(wx, wy) - 0.5) + 0.3 * (h - 120) / 40)), hl = Math.min(1, Math.max(0, (h - ZMIN) / 30));
    const o = 4 * (py * Wd + px), grain = 0.94 + 0.12 * fine(wx, wy);
    for (let k = 0; k < 3; k++) { const base = (meadow[k] + (crop[k] - meadow[k]) * ripe) * hl + low[k] * (1 - hl); d[o + k] = Math.max(0, Math.min(255, Math.round(base * f * grain))); }
    d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); COLOUR = c; return c;
}
function drawWoodColour(g, w, s, cx0, cy0) {
  const pts = w.pts;
  g.save(); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * s + cx0, y * s + cy0) : g.moveTo(x * s + cx0, y * s + cy0)); g.closePath();
  g.fillStyle = '#3f5226'; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1; g.clip();
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; for (const [x, y] of pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const step = Math.max(10, 6 / s), R = rng(hashStr(w.name)), rad = Math.min(5, Math.max(1.4, 7 * s));
  for (let y = by0; y <= by1; y += step) for (let x = bx0 + ((y / step) % 2) * step / 2; x <= bx1; x += step) {
    const jx = x + (R() - 0.5) * step * 0.7, jy = y + (R() - 0.5) * step * 0.7, qx = jx * s + cx0, qy = jy * s + cy0, r = rad * (0.8 + 0.4 * R());
    g.fillStyle = '#2c3b19'; g.beginPath(); g.arc(qx + r * 0.35, qy + r * 0.4, r, 0, 7); g.fill();
    g.fillStyle = R() < 0.5 ? '#55692e' : '#4b6029'; g.beginPath(); g.arc(qx, qy, r, 0, 7); g.fill();
    g.fillStyle = '#7a8f3e'; g.globalAlpha = 0.7; g.beginPath(); g.arc(qx - r * 0.35, qy - r * 0.35, r * 0.38, 0, 7); g.fill(); g.globalAlpha = 1;
  }
  g.restore();
}
{ const rt0 = renderTerrain;
  renderTerrain = function () {
    if (MAPSTYLE !== 'colour') return rt0();
    if (!cssW) return;
    const M = 0.18, cw = Math.ceil(cssW * (1 + 2 * M)), ch = Math.ceil(cssH * (1 + 2 * M)), ox = cssW * M, oy = cssH * M;
    tcan.width = Math.round(cw * dpr); tcan.height = Math.round(ch * dpr);
    const s = view.s, cx0 = view.tx + ox, cy0 = view.ty + oy; tview = { s, cx0, cy0, cw, ch };
    const g = tctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
    const sx0 = cx0, sy0 = cy0, sx1 = WM * s + cx0, sy1 = HM * s + cy0, wx0 = -cx0 / s, wy0 = -cy0 / s, wx1 = (cw - cx0) / s, wy1 = (ch - cy0) / s;
    g.save(); g.beginPath(); g.rect(sx0, sy0, sx1 - sx0, sy1 - sy0); g.clip();
    g.imageSmoothingEnabled = true; g.drawImage(colourRelief(), sx0, sy0, sx1 - sx0, sy1 - sy0);
    // faint 10 m contours keep it readable as a map
    g.strokeStyle = '#3d4a22'; g.lineJoin = 'round'; g.lineWidth = 0.7; g.globalAlpha = 0.22; g.beginPath();
    for (let L = Math.ceil(ZMIN / 10) * 10; L <= ZMAX; L += 10) for (const pl of contours(L)) { if (pl.bx1 < wx0 || pl.bx0 > wx1 || pl.by1 < wy0 || pl.by0 > wy1) continue; const p = pl.p; g.moveTo(p[0] * s + cx0, p[1] * s + cy0); for (let j = 2; j < p.length; j += 2) g.lineTo(p[j] * s + cx0, p[j + 1] * s + cy0); }
    g.stroke(); g.globalAlpha = 1;
    if (layers.woods) for (const w of WOODS) drawWoodColour(g, w, s, cx0, cy0);
    if (layers.water) {
      g.strokeStyle = '#4f7fa6'; g.lineCap = 'round'; g.lineJoin = 'round'; const zf = Math.pow(s / 0.095, 0.35);
      for (const st of STREAMS) { let pts = []; for (let i = 0; i < st.length; i += 3) pts.push(st[i], st[i + 1]); const accs = []; for (let i = 2; i < st.length; i += 3) accs.push(st[i]); pts = chaikin(chaikin(pts, false), false); const n = pts.length / 2;
        for (let i = 0; i < n - 1; i++) { const a = accs[Math.min(accs.length - 1, Math.floor(i / n * accs.length))]; if (a < 300) continue; g.lineWidth = Math.min(3.4, 0.9 + 0.45 * Math.log2(a / 300)) * zf; g.beginPath(); g.moveTo(pts[2 * i] * s + cx0, pts[2 * i + 1] * s + cy0); g.lineTo(pts[2 * i + 2] * s + cx0, pts[2 * i + 3] * s + cy0); g.stroke(); } }
    }
    g.restore();
  };
}
{ const hk0 = drawHeightKey; drawHeightKey = function (g) { if (MAPSTYLE !== 'colour') hk0(g); }; }
// smoke and flame over burning buildings: the columns could be seen across the field
function drawFires(g) {
  if (MAPSTYLE !== 'colour' || !SIM || !SIM.sps) return;
  const wd = ((SIM.wind && SIM.wind.dir) || 270) + 180, wx = Math.sin(wd * Math.PI / 180), wy = -Math.cos(wd * Math.PI / 180), s = view.s;
  for (const sp of SIM.sps) for (const sec of sp.secs || []) {
    if (!sec.burnt) continue; const [x, y] = P(sec.x, sec.y), k = Math.max(0.6, Math.min(2.2, s / 0.12));
    for (let i = 5; i >= 0; i--) { const d = i * 26 * k, r = (10 + i * 7) * k, cx = x + wx * d + Math.sin(i * 1.7) * 4 * k, cy = y + wy * d - i * 3 * k, gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(40,36,34,${0.5 - i * 0.06})`); gr.addColorStop(1, 'rgba(60,55,50,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
    const fr = g.createRadialGradient(x, y, 0, x, y, 9 * k); fr.addColorStop(0, 'rgba(255,190,80,0.95)'); fr.addColorStop(0.5, 'rgba(230,90,30,0.7)'); fr.addColorStop(1, 'rgba(200,60,20,0)'); g.fillStyle = fr; g.beginPath(); g.arc(x, y, 9 * k, 0, 7); g.fill();
  }
}
{ const ed = extraDraw; extraDraw = g => { drawFires(g); if (ed) ed(g); }; }
