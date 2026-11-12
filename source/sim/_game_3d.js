/* ================= the field in relief: a 3D view of the umpire's picture ================= */
// The first client drawn from the contract alone (view.js): the ground from view.world(), the armies from view.snapshot('truth').
// It shows true positions, so it opens only where the umpire's picture may be shown: on the umpire's map, and after the battle
// (CLAUDE.md, rule 5). It reads nothing from the engine and draws no dice.
// The look is flat colour and few polygons on purpose: every colour and size is a constant below, and nothing is a painted asset.
// three.js (vendor/three.min.js, MIT) is carried in the page as text and only started the first time this view opens.
// Sizes marked (est.) are chosen to read well at a distance; they are not measurements.
const V3 = { on: false, sim: null, tick: -1, prev: null, cur: null, units: new Map(), err: null, frames: 0,
  cam: { az: 0, pol: 0.95, dist: 7000, tx: 0, tz: 0, ground: false, pitch: 0, field: 'wide' }, glass: null, still: false, t0: 0 };
const V3K = {
  TEX: 1024,                   // ground picture, pixels along the long side
  LOW: [0x9c, 0xb8, 0x6a], HIGH: [0xe2, 0xd9, 0x9a], // ground colour from the lowest ground to the highest
  WOOD: '#4f7a3f', ORCHARD_GROUND: '#8fb564', ROAD: '#e9d3a0', LANE: '#d9c79b', WATER: '#5b93b8', HOUSE: 0xe8dcc0, FARM: 0xb5654a, ROOF: 0x8a3b2c,
  SMOKE: 0xf4f1e8,
  // the sky and the light (all est.: ordinary colours of a north-European day, driven by the contract's sun and seeing)
  ZENITH: { day: 0x5f9bd6, dusk: 0x40507f, night: 0x0a0f1e, grey: 0x9099a1 }, RIM: { day: 0xdce9f1, low: 0xf3c79a, night: 0x161c2c, grey: 0xb7bdc0 },
  SUN: { high: 0xfff2d8, low: 0xff9548 }, CLEAR: 7000, MURK: 2500, // seeing at or over CLEAR metres is a clear day; at MURK the sky is fully overcast
  SHADE_Z: 10,                 // (est.) slopes are steepened tenfold for the shading painted on the ground (the ground itself is not)
  CONTOUR: 5,                  // a faint line on the ground every 5 m of height
  FAR_HILLS: [0x86a070, 0x8ea3a0], APRON: 0xb4bd7c, TUFT: [0x7f9a4e, 0x93ab5c, 0xa7b565], TUFT_GAP: 2.5, TUFT_N: 64, // scenery beyond the map and at your feet: decoration, not survey
  SMOKE_MIN: 0.12, SMOKE_MAX: 500, TREES: 7000,
  CROWNS: [0x2f6b34, 0x3f7f3a, 0x4f8f3f, 0x2a5a30], TRUNK: 0x6b4a2e, ORCHARD: [0x6fa64a, 0x86b85a], BUSH: [0x4c8a3c, 0x3c7434, 0x5d9a48], WALL: 0xb9a98c,
  WALK: 1.5,                   // metres moved for each pixel dragged with two fingers in the ground view
  // The field of view on the ground, top to bottom of the picture. Three steps, changed by a button:
  //  wide   60 degrees (est.: the view as first built; it takes in the field but draws a man a kilometre off about one pixel tall).
  //  eye    a screen correction, not history. A healthy eye separates about one minute of arc (the usual measure of normal sight;
  //         recalled, no source opened). One pixel at the centre of a picture h pixels tall with field f spans atan(2 tan(f/2) / h),
  //         so one pixel is one minute when tan(f/2) = h tan(1') / 2 (derived): at h = 690 that is f = 11.5 degrees, 5.8 times the
  //         wide view. A CSS pixel is itself defined as about 1.3 minutes at arm's length, so the picture then holds roughly what
  //         an eye on the spot could make out. Kept between EYE_MIN and the wide field (est.), so a small screen is not all zoom.
  //  glass  the commander's telescope, from the contract (the packs' power): tan(f/2) = tan(WIDE/2) / power (derived: the wide
  //         view is taken as power 1), shown in a round eyepiece whose circle is the glass's true field. SWAY is how far a held glass
  //         wanders, as a share of that field, and SWAY_S the seconds of its three slow swings (est.; repeatable, no dice).
  FIELD: { ABOVE: 38, WIDE: 60, ARCMIN: 1, EYE_MIN: 8, SWAY: 0.03, SWAY_S: [3.1, 4.7, 1.3], TURN: 0.004, TILT: 0.003 },
  MASK: { RIM: '#0b0a09', SHADE: 'rgba(11,10,9,.38)', SOFT: 0.86 }, // the eyepiece: its dark surround, and the shading that begins at SOFT of its radius
  // Two scales. From above, heights, trees and blocks are drawn large so the field reads at five kilometres; every figure is (est.)
  // and chosen for legibility. On the ground everything is life size: heights as surveyed, the eye at the engine's own 2.5 m for a
  // mounted officer, and the rest my estimates of ordinary sizes (est.): a mature tree 18 m, a fruit tree 4 m, a hedge 2 m, a garden
  // wall 2 m, a cottage 5 m to the eaves, a farm 7 m, men 1.8 m, horsemen 2.6 m, guns and crews 1.7 m.
  ABOVE: { STEP: 2, EX: 3, TREE_H: 150, TREE_R: 46, TREE_GAP: 55, TREE_JIT: 56, TRUNK: [6, 8], ORCH: { gap: 30, th: 22, tr: [3, 4], cr: 15, ch: 13, lift: 30 }, BUSH: { gap: 26, r: 17, h: 14, lift: 10, jit: 8 },
    WALL_H: 14, WALL_T: 8, HOUSE: { k: 1.6, w: 22, d: 16, h: 16 }, FARM: { h: 24, roof: 18 }, H: { inf: 40, cav: 55, art: 30 }, SMOKE: 1, MIN_F: 60, MIN_D: 40, LIFT: 2, HIDE: 30, NEAR: 8, FAR: 60000 },
  GROUND: { STEP: 1, EX: 1, TREE_H: 18, TREE_R: 5, TREE_GAP: 14, TREE_JIT: 9, TRUNK: [0.35, 0.45], ORCH: { gap: 9, th: 1.8, tr: [0.12, 0.16], cr: 2.2, ch: 1.8, lift: 3 }, BUSH: { gap: 2.4, r: 1.4, h: 1.1, lift: 0.9, jit: 0.5 },
    WALL_H: 2, WALL_T: 0.5, HOUSE: { k: 1, w: 0, d: 0, h: 5 }, FARM: { h: 7, roof: 4 }, H: { inf: 1.8, cav: 2.6, art: 1.7 }, SMOKE: 0.45, MIN_F: 20, MIN_D: 6, LIFT: 0.05, HIDE: 3, NEAR: 0.8, FAR: 25000, EYE: 2.5 },
};
const v3lerp = (a, b, t) => a + (b - a) * t;
const v3clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const v3ok = () => !!(SIM && SIM.view && G && (G.umpire || G.phase === 'over'));
function v3rand(i) { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; } // repeatable scatter, never the battle's dice
function v3Load() {
  if (globalThis.THREE) return true;
  try { const s = document.createElement('script'); s.textContent = $('three-src').textContent; document.head.appendChild(s); } catch (e) { V3.err = String(e); }
  return !!globalThis.THREE;
}
const v3K = () => V3.cam.ground ? V3K.GROUND : V3K.ABOVE;
function v3Height(W, x, y) { // metres above datum at a point ON THE DRAWN GROUND: the same facets the mesh has (every STEP-th post, two triangles a square),
  // so trees, blocks and the eye stand on the surface you see and never sink under a facet
  const g = W.grid, st = V3.K.STEP, nx = Math.floor((g.nx - 1) / st), ny = Math.floor((g.ny - 1) / st), c = g.cell * st;
  const fx = v3clamp(x / c, 0, nx - 0.001), fy = v3clamp(y / c, 0, ny - 0.001), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, h = (ii, jj) => g.heights[jj * st * g.nx + ii * st];
  const A = h(i, j), B = h(i + 1, j), C = h(i, j + 1), D = h(i + 1, j + 1);
  return a + b <= 1 ? A + (B - A) * a + (C - A) * b : D + (C - D) * (1 - a) + (B - D) * (1 - b); // the mesh splits each square along the B-C diagonal
}
function v3Inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function v3Ground(W) { // the ground's picture: height bands shaded by slope as a printed relief map is, contour lines, then woods, water and roads
  const sc = V3K.TEX / Math.max(W.size.w, W.size.h), cv = document.createElement('canvas'); cv.width = Math.round(W.size.w * sc); cv.height = Math.round(W.size.h * sc);
  const c = cv.getContext('2d'), g = W.grid, w = cv.width, h = cv.height, hs = new Float32Array(w * h); let lo = Infinity, hi = -Infinity; for (const v of g.heights) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { const fx = v3clamp(px / sc / g.cell, 0, g.nx - 1.001), fy = v3clamp(py / sc / g.cell, 0, g.ny - 1.001), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, k = j * g.nx + i, H = g.heights;
    hs[py * w + px] = (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) + (H[k + g.nx] * (1 - a) + H[k + g.nx + 1] * a) * b; }
  const img = c.createImageData(w, h), d = img.data, m = 2 / sc * 2, lx = -0.5, ly = -0.5, lz = 0.707; // lit from the north-west, as relief maps are by custom
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { const k = py * w + px, x0 = Math.max(0, px - 2), x1 = Math.min(w - 1, px + 2), y0 = Math.max(0, py - 2), y1 = Math.min(h - 1, py + 2), v = hs[k];
    const nxv = -(hs[py * w + x1] - hs[py * w + x0]) / m * V3K.SHADE_Z, nyv = -(hs[y1 * w + px] - hs[y0 * w + px]) / m * V3K.SHADE_Z, len = Math.hypot(nxv, nyv, 1);
    let f = v3clamp((nxv * lx + nyv * ly + lz) / len / lz, 0.62, 1.3);
    if (Math.floor(v / V3K.CONTOUR) !== Math.floor(hs[py * w + x1 - (x1 > px ? 1 : 0)] / V3K.CONTOUR) || Math.floor(v / V3K.CONTOUR) !== Math.floor(hs[Math.min(h - 1, py + 1) * w + px] / V3K.CONTOUR)) f *= 0.84;
    const band = Math.round((v - lo) / Math.max(1, hi - lo) * 7) / 7; for (let q = 0; q < 3; q++) d[k * 4 + q] = Math.min(255, v3lerp(V3K.LOW[q], V3K.HIGH[q], band) * f); d[k * 4 + 3] = 255; }
  c.putImageData(img, 0, 0);
  const line = (pts, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = c.lineCap = 'round'; c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p[0] * sc, p[1] * sc) : c.moveTo(p[0] * sc, p[1] * sc)); c.stroke(); };
  c.fillStyle = V3K.WOOD; for (const w of W.woods) { c.beginPath(); w.pts.forEach((p, k) => k ? c.lineTo(p[0] * sc, p[1] * sc) : c.moveTo(p[0] * sc, p[1] * sc)); c.closePath(); c.fill(); }
  // a stream is a run of (x, y, catchment) triples; the engine counts it a stream where the catchment reaches 300 cells, and so does this
  c.fillStyle = V3K.ORCHARD_GROUND; for (const e of W.enclosures) if (e.kind !== 'wall') { c.save(); c.translate(e.x * sc, e.y * sc); c.rotate((e.rot || 0) * Math.PI / 180); c.fillRect(-e.w / 2 * sc, -e.h / 2 * sc, e.w * sc, e.h * sc); c.restore(); }
  for (const s of W.streams) for (let k = 0; k + 5 < s.length; k += 3) if (s[k + 2] >= 300) line([[s[k], s[k + 1]], [s[k + 3], s[k + 4]]], V3K.WATER, 3);
  for (const r of W.roads) line(r.pts, r.kind === 'chaussee' ? V3K.ROAD : V3K.LANE, r.kind === 'chaussee' ? 4 : 2.2);
  for (const s of W.sunken) line(s, V3K.LANE, 2.2);
  return cv;
}
function v3Build() {
  const T = globalThis.THREE, W = SIM.view.world(), g = W.grid, box = $('v3'), cv = $('v3c');
  const K = V3.K = v3K(), fresh = V3.sim !== SIM;
  if (V3.scene) V3.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); // the last scale's models
  if (!V3.renderer) { V3.renderer = new T.WebGLRenderer({ canvas: cv, antialias: true }); V3.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); }
  const S = V3.scene = new T.Scene(); V3.camera = new T.PerspectiveCamera(38, 1, K.NEAR, K.FAR); V3.w = 0; V3.W = W; V3.units = new Map(); V3.sim = SIM; V3.tick = -1; V3.prev = V3.cur = null;
  V3.hemi = new T.HemisphereLight(0xffffff, 0x8a8f70, 0.5); S.add(V3.hemi); V3.sun = new T.DirectionalLight(0xfff4dc, 0.5); S.add(V3.sun);
  S.fog = new T.Fog(0xffffff, 1000, K.FAR); S.background = new T.Color(0xffffff);
  // the sky: a dome that goes where the eye goes, pale at the rim and deep overhead; and the sun's disc
  const dg = new T.SphereGeometry(K.FAR * 0.8, 24, 12); dg.setAttribute('color', new T.BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
  V3.dome = new T.Mesh(dg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); V3.dome.renderOrder = -2; S.add(V3.dome);
  V3.disc = new T.Mesh(new T.SphereGeometry(K.FAR * 0.012, 12, 8), new T.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false })); V3.disc.renderOrder = -1; S.add(V3.disc);
  // the ground: one flat-shaded facet per STEP cells
  const st = K.STEP, nx = Math.floor((g.nx - 1) / st) + 1, ny = Math.floor((g.ny - 1) / st) + 1, pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = i * st * g.cell, y = j * st * g.cell; pos[k * 3] = x; pos[k * 3 + 1] = g.heights[j * st * g.nx + i * st] * K.EX; pos[k * 3 + 2] = y; uv[k * 2] = x / W.size.w; uv[k * 2 + 1] = 1 - y / W.size.h; }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const tex = new T.CanvasTexture(v3Ground(W)); tex.magFilter = T.NearestFilter; // hard-edged colour, in keeping with the facets
  // each facet gets its own three corners and its own normal, so the facets are flat by construction (not by a shader trick that
  // went black on facets close to the eye in the ground view)
  const flat = geo.toNonIndexed(); flat.computeVertexNormals();
  S.add(new T.Mesh(flat, new T.MeshLambertMaterial({ map: tex }))); V3.tris = idx.length / 3;
  // beyond the map (decoration, not survey): the ground runs on level from the map's edge, and two lines of far hills close the view,
  // so the land has a horizon instead of an edge. The haze takes them as it would.
  { const rim = []; for (let i = 0; i < nx; i++) rim.push(i); for (let j = 1; j < ny; j++) rim.push(j * nx + nx - 1); for (let i = nx - 2; i >= 0; i--) rim.push((ny - 1) * nx + i); for (let j = ny - 2; j >= 1; j--) rim.push(j * nx);
    let mean = 0; for (const k of rim) mean += pos[k * 3 + 1]; mean /= rim.length; const cx = W.size.w / 2, cz = W.size.h / 2, out = 9000, ap = [];
    const far = k => { const x = pos[k * 3], z = pos[k * 3 + 2], dd = Math.hypot(x - cx, z - cz) || 1; return [x + (x - cx) / dd * out, mean, z + (z - cz) / dd * out]; };
    for (let q = 0; q < rim.length; q++) { const a = rim[q], b = rim[(q + 1) % rim.length], A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], B = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], A2 = far(a), B2 = far(b); ap.push(...A, ...A2, ...B, ...B, ...A2, ...B2); }
    const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.BufferAttribute(new Float32Array(ap), 3)); ag.computeVertexNormals(); S.add(new T.Mesh(ag, new T.MeshLambertMaterial({ color: V3K.APRON, side: T.DoubleSide })));
    V3K.FAR_HILLS.forEach((col, ring) => { const R = Math.hypot(cx, cz) + 3500 + ring * 3500, n = 60, hp = [];
      for (let q = 0; q < n; q++) { const a0 = q / n * 2 * Math.PI, a1 = (q + 1) / n * 2 * Math.PI, h0 = (25 + 70 * v3rand(q + ring * 100)) * K.EX * (1 + ring * 0.6), h1 = (25 + 70 * v3rand((q + 1) % n + ring * 100)) * K.EX * (1 + ring * 0.6);
        const P0 = [cx + R * Math.sin(a0), mean - 20, cz + R * Math.cos(a0)], P1 = [cx + R * Math.sin(a1), mean - 20, cz + R * Math.cos(a1)], Q0 = [P0[0], mean + h0, P0[2]], Q1 = [P1[0], mean + h1, P1[2]]; hp.push(...P0, ...Q0, ...P1, ...P1, ...Q0, ...Q1); }
      const hg = new T.BufferGeometry(); hg.setAttribute('position', new T.BufferAttribute(new Float32Array(hp), 3)); hg.computeVertexNormals(); S.add(new T.Mesh(hg, new T.MeshLambertMaterial({ color: col, side: T.DoubleSide }))); }); }
  const facet = g => { const f = g.toNonIndexed(); f.computeVertexNormals(); return f; }; // flat faces by construction, as for the ground
  const at = (x, y) => v3Height(W, x, y) * K.EX, M = new T.Matrix4(), Q = new T.Quaternion(), UP = new T.Vector3(0, 1, 0);
  const put = (mesh, i, x, y, sx, sy, sz, rot, lift) => { Q.setFromAxisAngle(UP, -(rot || 0) * Math.PI / 180); M.compose(new T.Vector3(x, at(x, y) + (lift || 0), y), Q, new T.Vector3(sx, sy, sz)); mesh.setMatrixAt(i, M); };
  // trees: a trunk and two stacked cones each, scattered through every wood in four greens
  const tint = (mesh, i, list, n) => mesh.setColorAt(i, new T.Color(list[Math.floor(v3rand(n) * list.length) % list.length]));
  const lam = () => new T.MeshLambertMaterial({ color: 0xffffff });
  const spots = []; W.woods.forEach((w, wi) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of w.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = y0, n = 0; y < y1; y += K.TREE_GAP) for (let x = x0; x < x1; x += K.TREE_GAP, n++) { const px = x + (v3rand(n * 7 + wi) - 0.5) * K.TREE_JIT, py = y + (v3rand(n * 13 + wi + 5) - 0.5) * K.TREE_JIT; if (spots.length < V3K.TREES && v3Inside(w.pts, px, py)) spots.push([px, py, 0.7 + v3rand(n + 99) * 0.7]); } });
  if (spots.length) { const H = K.TREE_H, Rr = K.TREE_R, n = spots.length, trunk = new T.InstancedMesh(facet(new T.CylinderGeometry(K.TRUNK[0], K.TRUNK[1], 1, 5)), new T.MeshLambertMaterial({ color: V3K.TRUNK }), n),
      low = new T.InstancedMesh(facet(new T.ConeGeometry(Rr, H * 0.6, 6)), lam(), n), top = new T.InstancedMesh(facet(new T.ConeGeometry(Rr * 0.7, H * 0.5, 6)), lam(), n);
    spots.forEach((p, i) => { const k = p[2]; put(trunk, i, p[0], p[1], k, H * 0.3 * k, k, 0, H * 0.15 * k); put(low, i, p[0], p[1], k, k, k, v3rand(i) * 60, H * 0.5 * k); put(top, i, p[0], p[1], k, k, k, v3rand(i + 1) * 60, H * 0.82 * k); tint(low, i, V3K.CROWNS, i * 3); tint(top, i, V3K.CROWNS, i * 3); });
    S.add(trunk); S.add(low); S.add(top); }
  V3.trees = spots.length;
  // orchards: round-headed fruit trees in rows; hedges: a line of bushes; a garden wall: a low wall round its plot
  const fruit = [], bushes = [], walls = [];
  for (const e of W.enclosures) { const r = (e.rot || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), loc = (u, v) => [e.x + u * cs - v * sn, e.y + u * sn + v * cs];
    if (e.kind === 'wall') { walls.push([e.x + (-e.h / 2) * -sn, e.y + (-e.h / 2) * cs, e.w, K.WALL_T, e.rot], [e.x + (e.h / 2) * -sn, e.y + (e.h / 2) * cs, e.w, K.WALL_T, e.rot], [e.x + (-e.w / 2) * cs, e.y + (-e.w / 2) * sn, K.WALL_T, e.h, e.rot], [e.x + (e.w / 2) * cs, e.y + (e.w / 2) * sn, K.WALL_T, e.h, e.rot]); continue; }
    for (let v = -e.h / 2 + K.ORCH.gap / 2; v < e.h / 2; v += K.ORCH.gap) for (let u = -e.w / 2 + K.ORCH.gap / 2; u < e.w / 2; u += K.ORCH.gap) fruit.push(loc(u, v)); }
  for (const h of W.hedges) for (let k = 0; k + 1 < h.length; k++) { const a = h[k], b = h[k + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(d / K.BUSH.gap)); for (let q = 0; q < n; q++) bushes.push([a[0] + (b[0] - a[0]) * q / n, a[1] + (b[1] - a[1]) * q / n]); }
  if (fruit.length) { const n = fruit.length, tr = new T.InstancedMesh(facet(new T.CylinderGeometry(K.ORCH.tr[0], K.ORCH.tr[1], 1, 5)), new T.MeshLambertMaterial({ color: V3K.TRUNK }), n), cr = new T.InstancedMesh(facet(new T.IcosahedronGeometry(1, 0)), lam(), n);
    fruit.forEach((p, i) => { const k = 0.85 + v3rand(i + 400) * 0.4; put(tr, i, p[0], p[1], 1, K.ORCH.th * k, 1, 0, K.ORCH.th / 2 * k); put(cr, i, p[0], p[1], K.ORCH.cr * k, K.ORCH.ch * k, K.ORCH.cr * k, v3rand(i) * 90, K.ORCH.lift * k); tint(cr, i, V3K.ORCHARD, i + 5); }); S.add(tr); S.add(cr); }
  if (bushes.length) { const m = new T.InstancedMesh(facet(new T.IcosahedronGeometry(1, 0)), lam(), bushes.length); bushes.forEach((p, i) => { const k = 0.8 + v3rand(i + 700) * 0.6; put(m, i, p[0] + (v3rand(i + 1) - 0.5) * K.BUSH.jit, p[1] + (v3rand(i + 2) - 0.5) * K.BUSH.jit, K.BUSH.r * k, K.BUSH.h * k, K.BUSH.r * k, v3rand(i) * 90, K.BUSH.lift * k); tint(m, i, V3K.BUSH, i + 9); }); S.add(m); }
  if (walls.length) { const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: V3K.WALL }), walls.length); walls.forEach((w, i) => put(m, i, w[0], w[1], w[2], K.WALL_H, w[3], w[4], K.WALL_H / 2)); S.add(m); }
  V3.shrubs = fruit.length + bushes.length;
  // village houses, then the named farms and châteaux with a roof each
  if (W.houses.length) { const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: V3K.HOUSE }), W.houses.length); W.houses.forEach((h, i) => put(m, i, h.x, h.y, Math.max(K.HOUSE.w, h.w * K.HOUSE.k), K.HOUSE.h, Math.max(K.HOUSE.d, h.h * K.HOUSE.k), h.rot, K.HOUSE.h / 2)); S.add(m); }
  if (W.buildings.length) { const n = W.buildings.length, m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: V3K.FARM }), n), r = new T.InstancedMesh(facet(new T.ConeGeometry(0.72, 1, 4, 1, false, Math.PI / 4)), new T.MeshLambertMaterial({ color: V3K.ROOF }), n);
    W.buildings.forEach((b, i) => { put(m, i, b.x, b.y, b.w, K.FARM.h, b.h, b.rot, K.FARM.h / 2); put(r, i, b.x, b.y, b.w, K.FARM.roof, b.h, b.rot, K.FARM.h + K.FARM.roof / 2); }); S.add(m); S.add(r); }
  // smoke: soft white lumps over the cells that hold it
  V3.smoke = new T.InstancedMesh(facet(new T.IcosahedronGeometry(1, 0)), new T.MeshLambertMaterial({ color: V3K.SMOKE, transparent: true, opacity: 0.6, depthWrite: false }), V3K.SMOKE_MAX); V3.smoke.count = 0; S.add(V3.smoke);
  V3.tmp = new T.Vector3();
  // on the ground, tufts of grass stand round your feet and stay put as you walk: something near to judge distance by (decoration)
  V3.tufts = null; V3.tuftAt = null;
  if (V3.cam.ground) { const n = V3K.TUFT_N * V3K.TUFT_N; V3.tufts = new T.InstancedMesh(facet(new T.ConeGeometry(0.09, 0.4, 4)), lam(), n); V3.tufts.frustumCulled = false; for (let i = 0; i < n; i++) tint(V3.tufts, i, V3K.TUFT, i); S.add(V3.tufts); }
  V3.unitGeo = new T.BoxGeometry(1, 1, 1); V3.at = at; V3.put = put;
  if (fresh) { V3.cam.tx = W.size.w / 2; V3.cam.tz = W.size.h / 2; V3.cam.dist = Math.max(W.size.w, W.size.h) * 0.85; V3.cam.az = 0; V3.cam.pol = 0.95; }
}
function v3SideColour(side) { const v = getComputedStyle(document.documentElement).getPropertyValue('--m-' + String(side).toLowerCase()).trim(); return v || '#666666'; }
function v3Take() { // a new tick: keep the last picture to glide from, take the new one
  const snap = SIM.view.snapshot('truth'), m = new Map(); for (const u of snap.units) m.set(u.id, u);
  V3.prev = V3.cur || m; V3.cur = m; V3.snap = snap; V3.tick = SIM.tick;
  // the player's commander, from his own snapshot: only where he stands and the glass he carries are read here (the picture drawn
  // stays the umpire's). A battle with no command layer has no commander to stand beside, and no glass.
  { let c = null; try { c = SIM.view.snapshot('chief'); } catch (e) { c = null; } V3.glass = c && c.glass ? c.glass : null; if (!V3.glass && V3.cam.field === 'glass') v3Field('wide'); }
  const T = globalThis.THREE, S = V3.scene;
  for (const [id, o] of V3.units) if (!m.has(id)) { S.remove(o); o.material.dispose(); V3.units.delete(id); }
  for (const u of snap.units) if (!V3.units.has(u.id)) { const o = new T.Mesh(V3.unitGeo, new T.MeshLambertMaterial({ color: new T.Color(v3SideColour(u.side)) })); V3.units.set(u.id, o); S.add(o); }
  // smoke and light change by the tick, not the frame
  const sm = snap.smoke, cells = []; for (let j = 0; j < sm.ny; j++) for (let i = 0; i < sm.nx; i++) { const a = sm.a[j * sm.nx + i]; if (a > V3K.SMOKE_MIN) cells.push([a, i, j]); }
  cells.sort((p, q) => q[0] - p[0]); const n = Math.min(cells.length, V3K.SMOKE_MAX);
  for (let k = 0; k < n; k++) { const [a, i, j] = cells[k], x = (i + 0.5) * sm.cell, y = (j + 0.5) * sm.cell, r = (45 + 55 * Math.min(1, a)) * V3.K.SMOKE; V3.put(V3.smoke, k, x + (v3rand(k) - 0.5) * 40, y + (v3rand(k + 7) - 0.5) * 40, r, r * 0.7, r, v3rand(k + 3) * 360, r * 0.9); }
  V3.smoke.count = n; V3.smoke.instanceMatrix.needsUpdate = true;
  v3Light(snap.light);
  v3Caption();
}
// (The seeing also shortens as the light fails, so it is read as weather only while the sun is up; after sunset the sky is drawn clear.)
// the light of the hour and the weather, from the contract: the sun's height and bearing place and colour the sun, and the day's
// seeing (how far a man can see, haze and rain included) sets the haze and how overcast the sky is. Colours and curves are (est.).
function v3Light(L) {
  const T = globalThis.THREE, K = V3.K, mix = (a, b, t) => new T.Color(a).lerp(new T.Color(b), v3clamp(t, 0, 1));
  const alt = L.sun, up = v3clamp(Math.sin(alt * Math.PI / 180), 0, 1), murk = v3clamp((V3K.CLEAR - L.seeing) / (V3K.CLEAR - V3K.MURK), 0, 1) * v3clamp(alt / 8, 0, 1), dayness = v3clamp((alt + 6) / 14, 0, 1), low = 1 - v3clamp(alt / 18, 0, 1);
  const zen = mix(mix(V3K.ZENITH.night, V3K.ZENITH.dusk, (alt + 12) / 10), V3K.ZENITH.day, (alt + 2) / 12).lerp(new T.Color(V3K.ZENITH.grey).multiplyScalar(0.25 + 0.75 * dayness), murk);
  const rim = mix(mix(V3K.RIM.night, V3K.RIM.low, (alt + 13) / 13), V3K.RIM.day, (alt - 2) / 16).lerp(new T.Color(V3K.RIM.grey).multiplyScalar(0.2 + 0.8 * dayness), murk);
  const sunCol = mix(V3K.SUN.low, V3K.SUN.high, alt / 22), az = L.bearing * Math.PI / 180, a = alt * Math.PI / 180;
  const dir = V3.sunDir = new T.Vector3(Math.sin(az) * Math.cos(a), Math.sin(a), -Math.cos(az) * Math.cos(a)); // x east, z south
  V3.sun.color.copy(sunCol); V3.sun.intensity = 0.6 * Math.min(1, up * 2.2) * (1 - 0.8 * murk); V3.sun.position.copy(dir).multiplyScalar(1000);
  V3.hemi.color.copy(zen).lerp(new T.Color(0xffffff), 0.55); V3.hemi.groundColor.set(0x7d8262); V3.hemi.intensity = 0.16 + 0.28 * dayness + 0.14 * murk * dayness; // under cloud the light comes from the whole sky
  V3.scene.background.copy(rim); V3.scene.fog.color.copy(rim);
  if (V3.cam.ground) { V3.scene.fog.near = L.seeing * 0.08; V3.scene.fog.far = Math.min(K.FAR * 0.78, Math.max(1500, L.seeing) * 1.6); } else { V3.scene.fog.near = 7000; V3.scene.fog.far = Math.max(26000, L.seeing * 5); } // from above the haze is thinned so the field still reads
  const g = V3.dome.geometry, p = g.attributes.position, col = g.attributes.color, R = K.FAR * 0.8, c = new T.Color();
  for (let i = 0; i < p.count; i++) { const e = v3clamp(p.getY(i) / R, 0, 1), near = v3clamp((new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize().dot(dir) - 0.7) / 0.3, 0, 1); // warmer toward a low sun
    // after sunset the glow stays a while where the sun went down
    c.copy(rim).lerp(zen, Math.pow(e, 0.55)); if (alt > -14) c.lerp(sunCol, 0.35 * near * low * (1 - murk) * v3clamp((alt + 14) / 8, 0, 1)); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true; V3.disc.material.color.copy(sunCol); V3.disc.visible = alt > -0.5 && murk < 0.85; V3.light = { alt, bearing: L.bearing, seeing: L.seeing, murk, sun: V3.sun.intensity, sky: V3.hemi.intensity, fogFar: V3.scene.fog.far };
}
function v3Tufts() { // re-lay the tufts when the eye has moved a few metres; each stands on a fixed spot of ground
  const C = V3.cam, gap = V3K.TUFT_GAP, n = V3K.TUFT_N, ax = Math.round(C.tx / gap), az = Math.round(C.tz / gap); if (V3.tuftAt && Math.abs(V3.tuftAt[0] - ax) < 4 && Math.abs(V3.tuftAt[1] - az) < 4) return;
  V3.tuftAt = [ax, az]; let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++, k++) { const gx = ax - n / 2 + i, gz = az - n / 2 + j, hsh = gx * 7919 + gz * 104729, s = 0.6 + v3rand(hsh + 2) * 1.1; V3.put(V3.tufts, k, (gx + v3rand(hsh)) * gap, (gz + v3rand(hsh + 1)) * gap, s, s, s, v3rand(hsh + 3) * 90, 0.2 * s); }
  V3.tufts.instanceMatrix.needsUpdate = true;
}
// the field of view for the present step (degrees, top to bottom), and how many times it magnifies the wide view
function v3Fov() {
  const C = V3.cam, F = V3K.FIELD, half = Math.tan(F.WIDE * Math.PI / 360); if (!C.ground) return F.ABOVE;
  if (C.field === 'glass' && V3.glass) return 2 * Math.atan(half / V3.glass.power) * 180 / Math.PI;
  if (C.field === 'eye') return v3clamp(2 * Math.atan((V3.h || 690) * Math.tan(F.ARCMIN / 60 * Math.PI / 180) / 2) * 180 / Math.PI, F.EYE_MIN, F.WIDE);
  return F.WIDE;
}
const v3Power = () => Math.tan(V3K.FIELD.WIDE * Math.PI / 360) / Math.tan(v3Fov() * Math.PI / 360);
function v3Caption() {
  if (!V3.snap) return; const C = V3.cam, x = n => (Math.round(n * 10) / 10).toString();
  const how = !C.ground ? 'heights drawn ×' + V3K.ABOVE.EX : 'life size · ' + (C.field === 'glass' && V3.glass ? `through the glass, ${x(V3.glass.power)}×`
    : C.field === 'eye' ? `as sharp as the eye (a screen correction, ${x(v3Power())}×; not a glass)` : 'wide view');
  $('v3cap').textContent = `${C.ground ? 'On the ground' : 'The field in relief'} · the umpire’s picture · ${V3.snap.clock} · ${how}`;
}
// the round eyepiece: everything outside the glass's true field is blacked out. Its radius on the screen is derived: the circle seen
// in the eyepiece (apparent) against the wide field the screen stands for, r = (h / 2) tan(apparent / 2) / tan(WIDE / 2).
function v3Mask() {
  const m = $('v3m'), on = V3.cam.ground && V3.cam.field === 'glass' && !!V3.glass; if (m.hidden === on) m.hidden = !on; if (!on) return;
  const r = Math.round(Math.min(Math.min(V3.w, V3.h) / 2 - 4, V3.h / 2 * Math.tan(V3.glass.apparent * Math.PI / 360) / Math.tan(V3K.FIELD.WIDE * Math.PI / 360)));
  if (V3.maskR !== r) { V3.maskR = r; m.style.background = `radial-gradient(circle at 50% 50%, transparent ${Math.round(r * V3K.MASK.SOFT)}px, ${V3K.MASK.SHADE} ${r - 2}px, ${V3K.MASK.RIM} ${r}px)`; }
}
// step the field on: wide, the eye, the glass (where the commander has one), and round again
function v3Field(to) {
  const C = V3.cam, steps = V3.glass ? ['wide', 'eye', 'glass'] : ['wide', 'eye']; C.field = to && steps.includes(to) ? to : steps[(steps.indexOf(C.field) + 1) % steps.length]; V3.t0 = performance.now();
  $('v3f').textContent = 'View: ' + { wide: 'wide', eye: 'the eye', glass: 'the glass' }[C.field]; v3Caption();
}
function v3Ground2(on) { // step down to the ground where the view from above is centred, or back up
  V3.cam.ground = on; V3.cam.pitch = 0; if (V3.on) { v3Build(); V3.tick = -1; V3.cur = V3.prev = null; } const b = $('v3g'); b.textContent = on ? 'From above' : 'On the ground'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
  $('v3f').hidden = !on; v3Field(V3.cam.field); // the field's steps belong to the ground view; the step last used is kept
}
function v3Frame() { // called every frame by the page's loop; cheap unless the view is open
  const b = $('v3btn'), ok = v3ok(); if (b.hidden === ok) b.hidden = !ok;
  if (!V3.on) return; if (!ok || V3.sim !== SIM) { v3Close(); return; }
  if (V3.tick !== SIM.tick) v3Take();
  const box = $('v3'), w = box.clientWidth, h = box.clientHeight, R = V3.renderer; if (V3.w !== w || V3.h !== h) { V3.w = w; V3.h = h; R.setSize(w, h, false); V3.camera.aspect = w / Math.max(1, h); V3.camera.updateProjectionMatrix(); }
  const t = V3.prev === V3.cur ? 1 : frac; // between ticks the blocks glide, as the flat map's do
  for (const [id, o] of V3.units) { const c = V3.cur.get(id), p = V3.prev.get(id) || c, x = v3lerp(p.x, c.x, t), y = v3lerp(p.y, c.y, t), turn = ((c.facing - p.facing + 540) % 360) - 180, f = p.facing + turn * t;
    const K = V3.K, hh = (K.H[c.arm] || K.H.inf) * (c.status === 'steady' || c.status === 'shaken' ? 1 : 0.6), fr = Math.max(K.MIN_F, v3lerp(p.front, c.front, t)), dp = Math.max(K.MIN_D, v3lerp(p.depth, c.depth, t));
    o.position.set(x, V3.at(x, y) + hh / 2 + K.LIFT, y); o.rotation.y = -f * Math.PI / 180; o.scale.set(fr, hh, dp); o.material.emissive.setHex(c.firing ? 0x3a2a08 : 0x000000);
    // on the ground, a brigade you are standing inside is not drawn: you would see only the inside of its block
    if (V3.cam.ground) { o.updateMatrixWorld(); const v = V3.tmp.set(V3.cam.tx, o.position.y, V3.cam.tz); o.worldToLocal(v); o.visible = !(Math.abs(v.x) < 0.5 + K.HIDE / fr && Math.abs(v.z) < 0.5 + K.HIDE / dp); } else o.visible = true; }
  const C = V3.cam, cam = V3.camera, ty = V3.at(C.tx, C.tz);
  const fov = v3Fov(); let saz = 0, spi = 0;
  if (C.ground && C.field === 'glass' && V3.glass && !V3.still) { // a held glass wanders a little: three slow swings, the same every time it is raised
    const s = (performance.now() - V3.t0) / 1000, a = V3K.FIELD.SWAY * V3.glass.field * Math.PI / 180, P = V3K.FIELD.SWAY_S, w = k => 2 * Math.PI * s / P[k];
    saz = a * (0.6 * Math.sin(w(0)) + 0.3 * Math.sin(w(1) + 1) + 0.1 * Math.sin(w(2))); spi = a * (0.6 * Math.sin(w(1)) + 0.3 * Math.sin(w(0) + 2) + 0.1 * Math.sin(w(2) + 1)); }
  V3.sway = [saz, spi];
  if (C.ground) { const ey = ty + V3K.GROUND.EYE, az = C.az + saz, pi = C.pitch + spi, cp = Math.cos(pi); cam.position.set(C.tx, ey, C.tz); cam.lookAt(C.tx - Math.sin(az) * cp * 100, ey + Math.sin(pi) * 100, C.tz - Math.cos(az) * cp * 100); } // standing on the ground, looking the way the view from above was facing
  else { cam.position.set(C.tx + C.dist * Math.sin(C.pol) * Math.sin(C.az), ty + C.dist * Math.cos(C.pol), C.tz + C.dist * Math.sin(C.pol) * Math.cos(C.az)); cam.lookAt(C.tx, ty, C.tz); }
  V3.dome.position.copy(cam.position); if (V3.sunDir) V3.disc.position.copy(cam.position).addScaledVector(V3.sunDir, V3.K.FAR * 0.75); if (V3.tufts) v3Tufts();
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); v3Caption(); } v3Mask();
  R.render(V3.scene, cam); V3.frames++;
}
function v3Open() {
  if (!v3ok()) return false;
  if (!v3Load()) { V3.err = V3.err || 'three.js did not start'; return false; }
  try { if (V3.sim !== SIM || !V3.renderer) v3Build(); } catch (e) { V3.err = String(e && e.message || e); $('v3cap').textContent = 'This device cannot draw the relief view.'; $('v3').hidden = false; V3.on = false; return false; }
  V3.on = true; V3.err = null; V3.tick = -1; $('v3').hidden = false; $('v3btn').setAttribute('aria-pressed', 'true'); stripClose(); return true;
}
function v3Close() { V3.on = false; $('v3').hidden = true; $('v3btn').setAttribute('aria-pressed', 'false'); }
$('v3btn').addEventListener('click', () => V3.on ? v3Close() : v3Open());
$('v3x').addEventListener('click', v3Close);
$('v3g').addEventListener('click', () => v3Ground2(!V3.cam.ground));
$('v3f').addEventListener('click', () => v3Field());
// one finger or the mouse turns the field; two fingers, the wheel or shift-drag move and zoom
(function () {
  const el = $('v3c'), P = new Map(); let pinch = 0, mid = null;
  const pan = (dx, dy) => { const C = V3.cam, k = C.ground ? V3K.WALK : C.dist / Math.max(200, V3.h || 400); C.tx = v3clamp(C.tx - (dx * Math.cos(C.az) + dy * Math.sin(C.az)) * k, 0, V3.W.size.w); C.tz = v3clamp(C.tz - (-dx * Math.sin(C.az) + dy * Math.cos(C.az)) * k, 0, V3.W.size.h); };
  const zoom = f => { const C = V3.cam; if (C.ground) { const d = (1 - f) * 900; C.tx = v3clamp(C.tx - Math.sin(C.az) * d, 0, V3.W.size.w); C.tz = v3clamp(C.tz - Math.cos(C.az) * d, 0, V3.W.size.h); } else C.dist = v3clamp(C.dist * f, 600, 16000); }; // on the ground, zooming in is walking forward
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; mid = null; });
  el.addEventListener('pointermove', e => { if (!P.has(e.pointerId) || !V3.on) return; const was = P.get(e.pointerId), dx = e.clientX - was[0], dy = e.clientY - was[1]; P.set(e.pointerId, [e.clientX, e.clientY]);
    // through the glass or the eye's step a drag turns the eye less, by the power, so a narrow field can still be aimed
    if (P.size === 1) { if (e.shiftKey || e.buttons === 2) pan(dx, dy); else if (V3.cam.ground) { const k = 1 / v3Power(); V3.cam.az += dx * V3K.FIELD.TURN * k; V3.cam.pitch = v3clamp(V3.cam.pitch + dy * V3K.FIELD.TILT * k, -0.5, 0.6); } else { V3.cam.az -= dx * 0.006; V3.cam.pol = v3clamp(V3.cam.pol - dy * 0.005, 0.15, 1.45); } }
    else if (P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (pinch) zoom(pinch / Math.max(1, d)); if (mid) pan(m[0] - mid[0], m[1] - mid[1]); pinch = d; mid = m; } });
  const up = e => { P.delete(e.pointerId); pinch = 0; mid = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
})();
// test hooks (view3dtest.py)
globalThis.WGame && Object.assign(globalThis.WGame, { v3: () => ({ on: V3.on, err: V3.err, units: V3.units.size, shown: V3.cur ? V3.cur.size : 0, tris: V3.tris || 0, frames: V3.frames, tick: V3.tick, smoke: V3.smoke ? V3.smoke.count : 0, button: !$('v3btn').hidden, three: !!globalThis.THREE,
    mover: (() => { let best = null, bd = 0; for (const [id, o] of V3.units) { const c = V3.cur.get(id), p = V3.prev.get(id) || c, d = Math.hypot(c.x - p.x, c.y - p.y); if (d > bd) { bd = d; best = { id, x: o.position.x, z: o.position.z, cx: c.x, cy: c.y, px: p.x, py: p.y, d }; } } return best; })() }), // the brigade that moved furthest this tick
  v3Open: () => v3Open(), v3Close: () => v3Close(), v3Cam: (az, pol, dist) => { V3.cam.az = az; V3.cam.pol = pol; V3.cam.dist = dist; },
  v3Probe: (nx, ny) => { const T = globalThis.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(nx, ny), V3.camera); const h = rc.intersectObjects(V3.scene.children.filter(o => o.visible), false)[0]; if (!h) return null; let unit = null; for (const [id, o] of V3.units) if (o === h.object) unit = id; return { dist: Math.round(h.distance), unit, geo: h.object.geometry.type, colour: h.object.material.color.getHexString(), instance: h.instanceId ?? null }; }, // what is drawn at a point of the screen (-1..1)
  v3Stand: (x, y, az) => { V3.cam.tx = x; V3.cam.tz = y; V3.cam.az = az; }, v3Sky: () => Object.assign({ horizon: V3.scene.background.getHexString(), sunColour: V3.sun.color.getHexString(), tufts: V3.tufts ? V3.tufts.count : 0, step: V3.K.STEP }, V3.light), v3Eye: () => ({ ex: V3.K.EX, treeH: V3.K.TREE_H, blockH: V3.K.H.inf, ground: V3.cam.ground, y: V3.camera.position.y, floor: V3.at(V3.cam.tx, V3.cam.tz), trees: V3.trees, shrubs: V3.shrubs, fov: V3.camera.fov }),
  // the field's steps: v3Field(step) sets one ('wide', 'eye', 'glass') or steps on; v3Glass() says what is shown and why
  v3Field: to => { v3Field(to); return V3.cam.field; }, v3Still: on => { V3.still = !!on; },
  v3At: () => ({ x: V3.cam.tx, z: V3.cam.tz, az: V3.cam.az, pitch: V3.cam.pitch, ground: V3.cam.ground }),
  v3Glass: () => ({ field: V3.cam.field, fov: V3.camera ? V3.camera.fov : null, want: v3Fov(), power: v3Power(), glass: V3.glass, h: V3.h, w: V3.w, mask: !$('v3m').hidden, maskR: V3.maskR || 0, sway: V3.sway || [0, 0], button: !$('v3f').hidden, label: $('v3f').textContent, caption: $('v3cap').textContent,
    turn: V3K.FIELD.TURN / v3Power() }) });
