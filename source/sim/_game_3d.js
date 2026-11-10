/* ================= the field in relief: a 3D view of the umpire's picture ================= */
// The first client drawn from the contract alone (view.js): the ground from view.world(), the armies from view.snapshot('truth').
// It shows true positions, so it opens only where the umpire's picture may be shown: on the umpire's map, and after the battle
// (CLAUDE.md, rule 5). It reads nothing from the engine and draws no dice.
// The look is flat colour and few polygons on purpose: every colour and size is a constant below, and nothing is a painted asset.
// three.js (vendor/three.min.js, MIT) is carried in the page as text and only started the first time this view opens.
// Sizes marked (est.) are chosen to read well at a distance; they are not measurements.
const V3 = { on: false, sim: null, tick: -1, prev: null, cur: null, units: new Map(), err: null, frames: 0,
  cam: { az: 0, pol: 0.95, dist: 7000, tx: 0, tz: 0 } };
const V3K = {
  EX: 3,                       // (est.) heights drawn three times life size: the ridges are 20 to 40 m over several km
  STEP: 2,                     // one facet per 2 grid cells (100 m): the low-poly look, and a quarter of the triangles
  TEX: 1024,                   // ground picture, pixels along the long side
  LOW: [0x9c, 0xb8, 0x6a], HIGH: [0xe2, 0xd9, 0x9a], // ground colour from the lowest ground to the highest
  WOOD: '#5f8a4a', TREE: 0x3f6f3a, ROAD: '#e9d3a0', LANE: '#d9c79b', WATER: '#5b93b8', HOUSE: 0xe8dcc0, FARM: 0xb5654a, ROOF: 0x8a3b2c,
  SKY_DAY: 0xcfe6f2, SKY_DUSK: 0x8a7f9a, SMOKE: 0xf4f1e8,
  H: { inf: 40, cav: 55, art: 30 }, // (est.) block heights by arm, metres
  TREE_GAP: 95, TREES: 1600, SMOKE_MIN: 0.12, SMOKE_MAX: 500,
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
function v3Height(W, x, y) { // metres above datum at a point, between the grid's posts
  const g = W.grid, fx = v3clamp(x / g.cell, 0, g.nx - 1.001), fy = v3clamp(y / g.cell, 0, g.ny - 1.001), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, h = g.heights, k = j * g.nx + i;
  return (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) + (h[k + g.nx] * (1 - a) + h[k + g.nx + 1] * a) * b;
}
function v3Inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function v3Ground(W) { // the ground's picture: height tint, woods, water, roads, drawn flat and draped over the relief
  const sc = V3K.TEX / Math.max(W.size.w, W.size.h), cv = document.createElement('canvas'); cv.width = Math.round(W.size.w * sc); cv.height = Math.round(W.size.h * sc);
  const c = cv.getContext('2d'), g = W.grid; let lo = Infinity, hi = -Infinity; for (const v of g.heights) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let j = 0; j < g.ny; j += V3K.STEP) for (let i = 0; i < g.nx; i += V3K.STEP) { const t = (g.heights[j * g.nx + i] - lo) / Math.max(1, hi - lo), band = Math.round(t * 7) / 7; // eight flat bands, like a cut-paper model
    c.fillStyle = `rgb(${V3K.LOW.map((v, k) => Math.round(v3lerp(v, V3K.HIGH[k], band))).join(',')})`; c.fillRect(i * g.cell * sc, j * g.cell * sc, g.cell * V3K.STEP * sc + 1, g.cell * V3K.STEP * sc + 1); }
  const line = (pts, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = c.lineCap = 'round'; c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p[0] * sc, p[1] * sc) : c.moveTo(p[0] * sc, p[1] * sc)); c.stroke(); };
  c.fillStyle = V3K.WOOD; for (const w of W.woods) { c.beginPath(); w.pts.forEach((p, k) => k ? c.lineTo(p[0] * sc, p[1] * sc) : c.moveTo(p[0] * sc, p[1] * sc)); c.closePath(); c.fill(); }
  // a stream is a run of (x, y, catchment) triples; the engine counts it a stream where the catchment reaches 300 cells, and so does this
  for (const s of W.streams) for (let k = 0; k + 5 < s.length; k += 3) if (s[k + 2] >= 300) line([[s[k], s[k + 1]], [s[k + 3], s[k + 4]]], V3K.WATER, 3);
  for (const r of W.roads) line(r.pts, r.kind === 'chaussee' ? V3K.ROAD : V3K.LANE, r.kind === 'chaussee' ? 4 : 2.2);
  for (const s of W.sunken) line(s, V3K.LANE, 2.2);
  return cv;
}
function v3Build() {
  const T = globalThis.THREE, W = SIM.view.world(), g = W.grid, box = $('v3'), cv = $('v3c');
  if (V3.renderer) { V3.renderer.dispose(); }
  const R = V3.renderer = new T.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const S = V3.scene = new T.Scene(); V3.camera = new T.PerspectiveCamera(38, 1, 50, 60000); V3.W = W; V3.units = new Map(); V3.sim = SIM; V3.tick = -1; V3.prev = V3.cur = null;
  V3.hemi = new T.HemisphereLight(0xffffff, 0x8a8f70, 0.5); S.add(V3.hemi); V3.sun = new T.DirectionalLight(0xfff4dc, 0.5); V3.sun.position.set(-0.5, 1, 0.6); S.add(V3.sun);
  // the ground: one flat-shaded facet per STEP cells
  const st = V3K.STEP, nx = Math.floor((g.nx - 1) / st) + 1, ny = Math.floor((g.ny - 1) / st) + 1, pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = i * st * g.cell, y = j * st * g.cell; pos[k * 3] = x; pos[k * 3 + 1] = g.heights[j * st * g.nx + i * st] * V3K.EX; pos[k * 3 + 2] = y; uv[k * 2] = x / W.size.w; uv[k * 2 + 1] = 1 - y / W.size.h; }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const tex = new T.CanvasTexture(v3Ground(W)); tex.magFilter = T.NearestFilter; // hard-edged colour, in keeping with the facets
  S.add(new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex, flatShading: true }))); V3.tris = idx.length / 3;
  const at = (x, y) => v3Height(W, x, y) * V3K.EX, M = new T.Matrix4(), Q = new T.Quaternion(), UP = new T.Vector3(0, 1, 0);
  const put = (mesh, i, x, y, sx, sy, sz, rot, lift) => { Q.setFromAxisAngle(UP, -(rot || 0) * Math.PI / 180); M.compose(new T.Vector3(x, at(x, y) + (lift || 0), y), Q, new T.Vector3(sx, sy, sz)); mesh.setMatrixAt(i, M); };
  // trees: five-sided cones scattered through each wood
  const spots = []; W.woods.forEach((w, wi) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of w.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = y0, n = 0; y < y1; y += V3K.TREE_GAP) for (let x = x0; x < x1; x += V3K.TREE_GAP, n++) { const px = x + (v3rand(n * 7 + wi) - 0.5) * 70, py = y + (v3rand(n * 13 + wi + 5) - 0.5) * 70; if (spots.length < V3K.TREES && v3Inside(w.pts, px, py)) spots.push([px, py, 0.8 + v3rand(n + 99) * 0.6]); } });
  if (spots.length) { const m = new T.InstancedMesh(new T.ConeGeometry(34, 95, 5), new T.MeshLambertMaterial({ color: V3K.TREE, flatShading: true }), spots.length); spots.forEach((p, i) => put(m, i, p[0], p[1], p[2], p[2], p[2], 0, 47 * p[2])); S.add(m); }
  // village houses, then the named farms and châteaux with a roof each
  if (W.houses.length) { const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: V3K.HOUSE, flatShading: true }), W.houses.length); W.houses.forEach((h, i) => put(m, i, h.x, h.y, Math.max(22, h.w * 1.6), 16, Math.max(16, h.h * 1.6), h.rot, 8)); S.add(m); } // (est.) drawn 1.6 times size so a village reads from above
  if (W.buildings.length) { const n = W.buildings.length, m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: V3K.FARM, flatShading: true }), n), r = new T.InstancedMesh(new T.ConeGeometry(0.72, 1, 4, 1, false, Math.PI / 4), new T.MeshLambertMaterial({ color: V3K.ROOF, flatShading: true }), n);
    W.buildings.forEach((b, i) => { put(m, i, b.x, b.y, b.w, 24, b.h, b.rot, 12); put(r, i, b.x, b.y, b.w, 18, b.h, b.rot, 33); }); S.add(m); S.add(r); }
  // smoke: soft white lumps over the cells that hold it
  V3.smoke = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: V3K.SMOKE, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false }), V3K.SMOKE_MAX); V3.smoke.count = 0; S.add(V3.smoke);
  V3.unitGeo = new T.BoxGeometry(1, 1, 1); V3.at = at; V3.put = put;
  V3.cam.tx = W.size.w / 2; V3.cam.tz = W.size.h / 2; V3.cam.dist = Math.max(W.size.w, W.size.h) * 0.85; V3.cam.az = 0; V3.cam.pol = 0.95;
}
function v3SideColour(side) { const v = getComputedStyle(document.documentElement).getPropertyValue('--m-' + String(side).toLowerCase()).trim(); return v || '#666666'; }
function v3Take() { // a new tick: keep the last picture to glide from, take the new one
  const snap = SIM.view.snapshot('truth'), m = new Map(); for (const u of snap.units) m.set(u.id, u);
  V3.prev = V3.cur || m; V3.cur = m; V3.snap = snap; V3.tick = SIM.tick;
  const T = globalThis.THREE, S = V3.scene;
  for (const [id, o] of V3.units) if (!m.has(id)) { S.remove(o); o.material.dispose(); V3.units.delete(id); }
  for (const u of snap.units) if (!V3.units.has(u.id)) { const o = new T.Mesh(V3.unitGeo, new T.MeshLambertMaterial({ color: new T.Color(v3SideColour(u.side)), flatShading: true })); V3.units.set(u.id, o); S.add(o); }
  // smoke and light change by the tick, not the frame
  const sm = snap.smoke, cells = []; for (let j = 0; j < sm.ny; j++) for (let i = 0; i < sm.nx; i++) { const a = sm.a[j * sm.nx + i]; if (a > V3K.SMOKE_MIN) cells.push([a, i, j]); }
  cells.sort((p, q) => q[0] - p[0]); const n = Math.min(cells.length, V3K.SMOKE_MAX);
  for (let k = 0; k < n; k++) { const [a, i, j] = cells[k], x = (i + 0.5) * sm.cell, y = (j + 0.5) * sm.cell, r = 45 + 55 * Math.min(1, a); V3.put(V3.smoke, k, x + (v3rand(k) - 0.5) * 40, y + (v3rand(k + 7) - 0.5) * 40, r, r * 0.7, r, v3rand(k + 3) * 360, 40 + r * 0.5); }
  V3.smoke.count = n; V3.smoke.instanceMatrix.needsUpdate = true;
  const day = v3clamp(snap.light.sun / 25, 0, 1); V3.sun.intensity = 0.12 + 0.4 * day; V3.hemi.intensity = 0.42 + 0.14 * day; // (est.) the light fails as the sun nears the horizon
  V3.scene.background = new T.Color(V3K.SKY_DUSK).lerp(new T.Color(V3K.SKY_DAY), day);
  $('v3cap').textContent = `The field in relief · the umpire’s picture · ${snap.clock} · heights drawn ×${V3K.EX}`;
}
function v3Frame() { // called every frame by the page's loop; cheap unless the view is open
  const b = $('v3btn'), ok = v3ok(); if (b.hidden === ok) b.hidden = !ok;
  if (!V3.on) return; if (!ok || V3.sim !== SIM) { v3Close(); return; }
  if (V3.tick !== SIM.tick) v3Take();
  const box = $('v3'), w = box.clientWidth, h = box.clientHeight, R = V3.renderer; if (V3.w !== w || V3.h !== h) { V3.w = w; V3.h = h; R.setSize(w, h, false); V3.camera.aspect = w / Math.max(1, h); V3.camera.updateProjectionMatrix(); }
  const t = V3.prev === V3.cur ? 1 : frac; // between ticks the blocks glide, as the flat map's do
  for (const [id, o] of V3.units) { const c = V3.cur.get(id), p = V3.prev.get(id) || c, x = v3lerp(p.x, c.x, t), y = v3lerp(p.y, c.y, t), turn = ((c.facing - p.facing + 540) % 360) - 180, f = p.facing + turn * t;
    const hh = (V3K.H[c.arm] || 40) * (c.status === 'steady' || c.status === 'shaken' ? 1 : 0.6), fr = Math.max(60, v3lerp(p.front, c.front, t)), dp = Math.max(40, v3lerp(p.depth, c.depth, t));
    o.position.set(x, V3.at(x, y) + hh / 2 + 2, y); o.rotation.y = -f * Math.PI / 180; o.scale.set(fr, hh, dp); o.material.emissive.setHex(c.firing ? 0x3a2a08 : 0x000000); o.material.opacity = 1; }
  const C = V3.cam, cam = V3.camera, ty = V3.at(C.tx, C.tz); cam.position.set(C.tx + C.dist * Math.sin(C.pol) * Math.sin(C.az), ty + C.dist * Math.cos(C.pol), C.tz + C.dist * Math.sin(C.pol) * Math.cos(C.az)); cam.lookAt(C.tx, ty, C.tz);
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
// one finger or the mouse turns the field; two fingers, the wheel or shift-drag move and zoom
(function () {
  const el = $('v3c'), P = new Map(); let pinch = 0, mid = null;
  const pan = (dx, dy) => { const C = V3.cam, k = C.dist / Math.max(200, V3.h || 400); C.tx = v3clamp(C.tx - (dx * Math.cos(C.az) + dy * Math.sin(C.az)) * k, 0, V3.W.size.w); C.tz = v3clamp(C.tz - (-dx * Math.sin(C.az) + dy * Math.cos(C.az)) * k, 0, V3.W.size.h); };
  const zoom = f => { V3.cam.dist = v3clamp(V3.cam.dist * f, 600, 16000); };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; mid = null; });
  el.addEventListener('pointermove', e => { if (!P.has(e.pointerId) || !V3.on) return; const was = P.get(e.pointerId), dx = e.clientX - was[0], dy = e.clientY - was[1]; P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size === 1) { if (e.shiftKey || e.buttons === 2) pan(dx, dy); else { V3.cam.az -= dx * 0.006; V3.cam.pol = v3clamp(V3.cam.pol - dy * 0.005, 0.15, 1.45); } }
    else if (P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (pinch) zoom(pinch / Math.max(1, d)); if (mid) pan(m[0] - mid[0], m[1] - mid[1]); pinch = d; mid = m; } });
  const up = e => { P.delete(e.pointerId); pinch = 0; mid = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
})();
// test hooks (view3dtest.py)
globalThis.WGame && Object.assign(globalThis.WGame, { v3: () => ({ on: V3.on, err: V3.err, units: V3.units.size, shown: V3.cur ? V3.cur.size : 0, tris: V3.tris || 0, frames: V3.frames, tick: V3.tick, smoke: V3.smoke ? V3.smoke.count : 0, button: !$('v3btn').hidden, three: !!globalThis.THREE,
    mover: (() => { let best = null, bd = 0; for (const [id, o] of V3.units) { const c = V3.cur.get(id), p = V3.prev.get(id) || c, d = Math.hypot(c.x - p.x, c.y - p.y); if (d > bd) { bd = d; best = { id, x: o.position.x, z: o.position.z, cx: c.x, cy: c.y, px: p.x, py: p.y, d }; } } return best; })() }), // the brigade that moved furthest this tick
  v3Open: () => v3Open(), v3Close: () => v3Close(), v3Cam: (az, pol, dist) => { V3.cam.az = az; V3.cam.pol = pol; V3.cam.dist = dist; } });
