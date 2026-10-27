/* The map pipeline (engine roadmap 4c): a battle's ground from survey files. A map spec names the field (its north-west corner, size and
   grid), where its heights come from, and a GeoJSON file of what stands on it; the tool writes the terrain pack the engine and the game
   load (packs/maps/<id>.js), with the heights packed as the Waterloo map's are (16-bit decimetres, base64).
     node tools/map.js build <spec.json>          write packs/maps/<id>.js
     node tools/map.js check <spec.json>          is the pack the spec's? (the self-tests run this on every committed spec)
   Spec (JSON): { id, origin: [lat, lon] of the north-west corner, size: [metres east, metres south], cell: metres (50),
     heights: { spots: <csv of lat,lon,h> , smooth: metres of survey error allowed (0) } | { grid: <ESRI ASCII grid in degrees> },
     features: <GeoJSON file>, source: what the survey is (kept in the pack) }
   Heights from spot heights are a thin-plate spline through them (the surface that bends least while passing through every spot; with
   smooth > 0 it may miss each by about that much). A grid is read with bilinear interpolation.
   GeoJSON features, by properties.layer:
     road (LineString; kind: chaussee | road | lane | track; name)        stream (LineString)        sunken (LineString: a sunken lane)
     wood (Polygon; name)        village (Point; name, r: radius m)       building (Point; name, w, h m, rot degrees)
     enclosure (Point; kind: wall | hedge; name, w, h, rot)                landmark (Point; name: what a place is called in reports)
   Paths are read relative to the spec file. */
'use strict';
const fs = require('fs'), path = require('path');

/* ----- spot heights: a thin-plate spline ----- */
function tps(pts, smooth) { // pts: [[x, y, h]] in metres; returns f(x, y)
  const n = pts.length, s = 1000, X = pts.map(p => [p[0] / s, p[1] / s]); // in km, for a well-conditioned system
  const phi = r => r > 0 ? r * r * Math.log(r) : 0, N = n + 3, A = Array.from({ length: N }, () => new Float64Array(N + 1));
  const lam = (smooth || 0) / s; // regularization, scaled to the kernel's units (est.: about the misfit allowed, km)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i][j] = phi(Math.hypot(X[i][0] - X[j][0], X[i][1] - X[j][1])) + (i === j ? lam : 0);
    A[i][n] = 1; A[i][n + 1] = X[i][0]; A[i][n + 2] = X[i][1]; A[n][i] = 1; A[n + 1][i] = X[i][0]; A[n + 2][i] = X[i][1];
    A[i][N] = pts[i][2];
  }
  for (let c = 0; c < N; c++) { // Gaussian elimination, partial pivoting
    let p = c; for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('spot heights: the points are degenerate (all in a line, or repeated)');
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < N; r++) if (r !== c) { const f = A[r][c] / A[c][c]; if (f) for (let k = c; k <= N; k++) A[r][k] -= f * A[c][k]; }
  }
  const w = A.map((row, i) => row[N] / row[i]);
  return (x, y) => { x /= s; y /= s; let h = w[n] + w[n + 1] * x + w[n + 2] * y; for (let i = 0; i < n; i++) h += w[i] * phi(Math.hypot(x - X[i][0], y - X[i][1])); return h; };
}
/* ----- an ESRI ASCII grid in degrees: bilinear ----- */
function ascGrid(text) {
  const lines = text.split(/\r?\n/), hd = {}; let i = 0;
  for (; i < 6; i++) { const [k, v] = lines[i].trim().split(/\s+/); hd[k.toLowerCase()] = +v; }
  const nc = hd.ncols, nr = hd.nrows, cs = hd.cellsize, x0 = hd.xllcorner ?? hd.xllcenter - cs / 2, y0 = hd.yllcorner ?? hd.yllcenter - cs / 2, nd = hd.nodata_value;
  const Z = lines.slice(i).join(' ').trim().split(/\s+/).map(Number); if (Z.length < nc * nr) throw new Error(`grid: ${Z.length} values for ${nc} x ${nr}`);
  return (lat, lon) => { // rows run north to south
    const c = (lon - x0) / cs - 0.5, r = (y0 + nr * cs - lat) / cs - 0.5, c0 = Math.max(0, Math.min(nc - 2, Math.floor(c))), r0 = Math.max(0, Math.min(nr - 2, Math.floor(r)));
    const fx = Math.max(0, Math.min(1, c - c0)), fy = Math.max(0, Math.min(1, r - r0)), z = (rr, cc) => { const v = Z[rr * nc + cc]; if (v === nd) throw new Error('grid: no data under the field'); return v; };
    return (z(r0, c0) * (1 - fx) + z(r0, c0 + 1) * fx) * (1 - fy) + (z(r0 + 1, c0) * (1 - fx) + z(r0 + 1, c0 + 1) * fx) * fy;
  };
}

function build(specFile) {
  const dir = path.dirname(specFile), S = JSON.parse(fs.readFileSync(specFile, 'utf8')), rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
  const [LAT0, LON0] = S.origin, CELL = S.cell || 50, NX = Math.round(S.size[0] / CELL) + 1, NY = Math.round(S.size[1] / CELL) + 1, WM = (NX - 1) * CELL, HM = (NY - 1) * CELL;
  const MLAT = 111230, MLON = 111320 * Math.cos((LAT0 - HM / 2 / MLAT) * Math.PI / 180); // metres a degree, at the middle of the field
  const ll2m = (la, lo) => [(lo - LON0) * MLON, (LAT0 - la) * MLAT], m2ll = (x, y) => [LAT0 - y / MLAT, LON0 + x / MLON], r1 = v => Math.round(v * 10) / 10;
  // heights
  let hAt;
  if (S.heights.spots) { const rows = rd(S.heights.spots).split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')), head = rows[0].split(',').map(s => s.trim()); const ia = head.indexOf('lat'), io = head.indexOf('lon'), ih = head.indexOf('h');
    if (ia < 0 || io < 0 || ih < 0) throw new Error('spot heights: the header must name lat, lon and h');
    const pts = rows.slice(1).map(l => { const c = l.split(','); const [x, y] = ll2m(+c[ia], +c[io]); return [x, y, +c[ih]]; }); const f = tps(pts, S.heights.smooth); hAt = f; }
  else if (S.heights.grid) { const g = ascGrid(rd(S.heights.grid)); hAt = (x, y) => g(...m2ll(x, y)); }
  else throw new Error('heights: give spots or grid');
  const buf = Buffer.alloc(NX * NY * 2);
  for (let r = 0; r < NY; r++) for (let c = 0; c < NX; c++) { const h = Math.round(hAt(c * CELL, r * CELL) * 10); if (h < -32768 || h > 32767) throw new Error('heights out of range'); buf.writeInt16LE(h, (r * NX + c) * 2); }
  // features
  const T = { ROADS: [], STREAMS: [], SUNKEN: [], WOODS: [], VILLAGES: [], BUILDINGS: [], ENCLOSURES: [], LM: [] }, warn = [];
  const pt = c => ll2m(c[1], c[0]).map(r1), line = cs => cs.map(pt);
  for (const f of JSON.parse(rd(S.features)).features) {
    const p = f.properties || {}, g = f.geometry, L = p.layer, nm = p.name || '';
    if (L === 'road') T.ROADS.push({ kind: p.kind || 'lane', name: nm, pts: line(g.coordinates) });
    else if (L === 'stream') T.STREAMS.push(line(g.coordinates).flatMap(([x, y]) => [x, y, 1000])); // 1000: counts as a stream (the engine's flow threshold is 300)
    else if (L === 'sunken') T.SUNKEN.push(line(g.coordinates));
    else if (L === 'wood') T.WOODS.push({ name: nm, pts: line(g.coordinates[0]) });
    else if (L === 'village') { const [x, y] = pt(g.coordinates); T.VILLAGES.push({ n: nm, cx: x, cy: y, r: p.r || 200, houses: [] }); }
    else if (L === 'building') { const [x, y] = pt(g.coordinates); T.BUILDINGS.push({ n: nm, x, y, w: p.w || 40, h: p.h || 30, rot: p.rot || 0 }); }
    else if (L === 'enclosure') { const [x, y] = pt(g.coordinates); T.ENCLOSURES.push({ kind: p.kind || 'wall', n: nm, x, y, w: p.w || 100, h: p.h || 80, rot: p.rot || 0 }); }
    else if (L === 'landmark') { const [x, y] = pt(g.coordinates); T.LM.push({ n: nm, x, y }); }
    else warn.push(`feature "${nm}": unknown layer "${L}"`);
  }
  const data = Object.assign({ source: S.source || '', LAT0, LON0, MLAT, MLON, NX, NY, CELL, WM, HM, TB64: buf.toString('base64') }, T);
  const js = `/* Terrain for "${S.id}", made by tools/map.js from ${path.basename(specFile)} (edit the survey files, then: node tools/map.js build ${path.relative(path.join(__dirname, '..'), specFile)}). */\n` +
    `(function (root) {\n'use strict';\nconst P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);\nP.register('map', ${JSON.stringify(S.id)}, ${JSON.stringify(data)});\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n`;
  return { id: S.id, js, warn, NX, NY, out: path.join(__dirname, '..', 'packs', 'maps', S.id + '.js') };
}
module.exports = { build, tps, ascGrid };

if (require.main === module) {
  const [cmd, spec] = process.argv.slice(2);
  if (cmd !== 'build' && cmd !== 'check') { console.log('usage: node tools/map.js build|check <spec.json>'); process.exit(1); }
  const r = build(spec); for (const w of r.warn) console.log('warning', w);
  if (cmd === 'check') { const same = fs.existsSync(r.out) && fs.readFileSync(r.out, 'utf8') === r.js; console.log(same ? `${r.out} is ${spec}'s` : `${r.out} is not ${spec}'s: run node tools/map.js build ${spec}`); process.exit(same ? 0 : 1); }
  fs.mkdirSync(path.dirname(r.out), { recursive: true }); fs.writeFileSync(r.out, r.js);
  console.log(`wrote ${r.out}: ${r.NX} x ${r.NY} heights, ${r.js.length} bytes`);
}
