/* ================= the field in relief: a 3D view of the umpire's picture ================= */
// The first client drawn from the contract alone (view.js): the ground from view.world(), the armies from view.snapshot('truth').
// It shows true positions, so it opens only where the umpire's picture may be shown: on the umpire's map, and after the battle
// (CLAUDE.md, rule 5). It reads nothing from the engine and draws no dice.
// The look is flat colour and few polygons on purpose: every colour and size is a constant below, and nothing is a painted asset.
// three.js (vendor/three.min.js, MIT) is carried in the page as text and only started the first time this view opens.
// Sizes marked (est.) are chosen to read well at a distance; they are not measurements.
const V3 = { on: false, sim: null, tick: -1, prev: null, cur: null, units: new Map(), err: null, frames: 0,
  cam: { az: 0, pol: 0.95, dist: 7000, tx: 0, tz: 0, ground: false, pitch: 0, field: 'wide', atPost: false }, glass: null, chief: null, still: false, t0: 0 };
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
  // Standing at headquarters: the ground view opens at the commander's post (the contract's own place for him), facing the enemy's
  // centre of mass. If a building within CLEAR metres would fill the view ahead (inside HALF degrees either side), the eye steps
  // forward STEP metres at a time, at most REACH, until the view is open: a commander stands where he can see (all est.).
  POST: { CLEAR: 80, HALF: 50, STEP: 5, REACH: 80 },
  // Men in place of slabs, on the ground only. Sizes are ordinary ones and estimates, not measurements (est. throughout):
  //  PX      a body is drawn man by man where a man would stand at least this many pixels tall; below that the stand-in reads as well.
  //          The distance follows (derived in v3Cone): 1.75 m and 6 px give about 175 m in the wide view at 690 px, 1 km at the eye's
  //          step, and FAR (the cap) through a 30-times glass.
  //  MAX     the most instances of each kind drawn at once. Bodies are taken nearest first; when one does not fit, it and all beyond
  //          it keep their stand-ins. At these caps the figures come to about 1.25 million triangles (v3Men() reports the count drawn).
  //  FILE, RANK, COL_RANK   metres a man (or horseman) takes along the front, between ranks in line, and between ranks in column.
  //  MARCH   files abreast on the road. GUN_GAP, GUN_ROW: metres between pieces and between rows of them. CREW: men drawn at each piece.
  //  BLOCK   metres from one column or square to the next; SHARE, the part of that a column fills; RING, ranks in an all-round block.
  //  LINE, LINES, MASS   how the share of men in the firing line and the density (both the contract's) are read: see v3Layout.
  //  LOOSE   how far men stand from their places, by the body's state (metres); a body out of order is a crowd, MOB_H of its height as a stand-in.
  //  SEG, THIN, TEETH, NOTCH, BAND   the stand-in: its blocks are at most SEG long and at least THIN deep, with TEETH steps in the top
  //          edge, each up to NOTCH lower, under a dark band BAND deep.
  //  COL     colours of everything that is not the side's own colour. Coats take the map's colour for the side: a label, not a uniform.
  FIG: { PX: 6, FAR: 6000, PAD: 1.5, HIDE: 2, MOVE: 1,
    MAX: { foot: 9000, horse: 2400, crew: 700, gun: 130, flag: 200, block: 1500 },
    MAN: 1.75, WHEEL: 1.45, PIKE: 3, CLOTH: [1.6, 1.4], GUIDON: 0.7, GUIDON_UP: 1.2,
    FILE: { foot: 0.65, horse: 1 }, RANK: { foot: 0.8, horse: 3 }, COL_RANK: { foot: 1.6, horse: 6 }, MARCH: { foot: 4, horse: 2 },
    GUN_GAP: 12, GUN_ROW: 4, CREW: 5, CREW_AT: [[-0.95, 0.2, 0], [0.95, 0.2, 0], [-1.1, 1.7, 0.5], [1.1, 1.7, -0.5], [0, 3.4, 0]], // right, behind, turned (radians): where the crew stand about the piece
    BLOCK: 60, SHARE: 0.6, RING: 4, LINE: 0.9, LINES: 0.35, MASS: 3.2, BEHIND: 5,
    ORDERED: ['steady', 'shaken', 'disordered'], LOOSE: { steady: 0.08, shaken: 0.25, disordered: 0.7, _: 0.3 }, MOB_TURN: 2.2, MOB_H: 0.6,
    SEG: 40, THIN: 1.5, TEETH: 6, NOTCH: 0.22, BAND: 0.12,
    COL: { SKIN: 0xd9a781, HAT: 0x1c1b1a, TROUSER: 0xd8d2c4, PACK: 0x3a2f24, MUSKET: 0x4a3626, BOOT: 0x24201c, CARRIAGE: 0x6f7355, BARREL: 0xb08d3c, HORSES: [0x6b4226, 0x4a2f1c, 0x2a221d, 0x8a6a48, 0x9a958c] } },
  // Scenery, not survey (like the far hills and the tufts): none of it is in the map data, none of it is read by the simulation, and the
  // caption says so. All est., chosen so that the ground has something on it between the eye and the armies.
  //  DETAIL  a fine mottled texture multiplied into the ground's picture near the eye: a tile SIZE pixels square, repeated every FINE
  //          metres (fading out between FINE_FADE metres) and again every COARSE metres (fading between COARSE_FADE), AMT strong.
  //  PLOTS   a patchwork of field plots painted into the ground's picture for the ground view only: blocks about CELL metres across,
  //          each cut into strips STRIP metres wide on its own bearing, each strip one of TINTS (multipliers on the ground's colour), AMT strong.
  //  STAFF   a few figures beside the standpoint at headquarters: metres to the right and forward of the eye as it first looks, the way
  //          each is turned (radians), and whether he is mounted.
  DETAIL: { SIZE: 256, FINE: 5, FINE_FADE: [20, 110], COARSE: 90, COARSE_FADE: [300, 2200], AMT: [0.42, 0.34] },
  PLOTS: { CELL: 430, STRIP: [45, 120], AMT: 0.7, TINTS: [[1.07, 1.04, 0.84], [0.9, 1.0, 0.84], [1.0, 0.91, 0.78], [0.95, 1.04, 0.9], [1.1, 1.06, 0.8], [1, 1, 1], [0.86, 0.95, 0.8]] },
  STAFF: [[-6, 9, 0.25, 1], [-8.2, 12.5, -0.3, 1], [7, 10.5, -0.45, 1], [4.4, 11.5, 0.9, 0], [5.6, 12.1, -2.3, 0]],
  // Firing, from the event stream (est. throughout: sizes chosen to read, not measured). KINDS is keyed by the contract's own event kinds:
  //  n      fewest and most flashes drawn for one event; per, metres of front to a flash (else one for each piece, the event's size);
  //  roll   the game minutes over which one event's flashes are spread, so a volley rolls along the line;
  //  flash  its radius; puff, the smoke's radius as it leaves the muzzle and when it has spread; up and out, metres above the ground and before the front rank.
  // BACK: firing more than this many game minutes old when it is read is not drawn (the battle was hurried on, or the view was shut).
  // FLASH_MS and PUFF_MS are how long each lasts on the screen (real time); RISE, metres a second the smoke lifts; TIERS, the opacities a
  // puff passes through as it thins. From above everything is drawn V3K.ABOVE.FX times larger, like the rest of that view.
  FX: { FLASH_MAX: 300, PUFF_MAX: 480, QUEUE: 1500, BACK: 4, FLASH_MS: 150, PUFF_MS: 5200, RISE: 0.45, TIERS: [0.55, 0.4, 0.26, 0.13], FLASH: 0xffd98a,
    KINDS: { cannon: { n: [1, 6], per: 0, roll: 0.5, flash: 1.5, puff: [1.8, 7], up: 1.1, out: 2 }, volley: { n: [3, 10], per: 30, roll: 0.8, flash: 0.45, puff: [0.9, 3.6], up: 1.4, out: 0.8 } } },
  NOTE: 'Scenery, not survey: the far hills, field plots, grass and the staff. Ranks are set out by rule inside each body’s true footprint.',
  MASK: { RIM: '#0b0a09', SHADE: 'rgba(11,10,9,.38)', SOFT: 0.86 }, // the eyepiece: its dark surround, and the shading that begins at SOFT of its radius
  // Two scales. From above, heights, trees and blocks are drawn large so the field reads at five kilometres; every figure is (est.)
  // and chosen for legibility. On the ground everything is life size: heights as surveyed, the eye at the engine's own 2.5 m for a
  // mounted officer, and the rest my estimates of ordinary sizes (est.): a mature tree 18 m, a fruit tree 4 m, a hedge 2 m, a garden
  // wall 2 m, a cottage 5 m to the eaves, a farm 7 m, men 1.8 m, horsemen 2.6 m, guns and crews 1.7 m.
  ABOVE: { STEP: 2, EX: 3, TREE_H: 150, TREE_R: 46, TREE_GAP: 55, TREE_JIT: 56, TRUNK: [6, 8], ORCH: { gap: 30, th: 22, tr: [3, 4], cr: 15, ch: 13, lift: 30 }, BUSH: { gap: 26, r: 17, h: 14, lift: 10, jit: 8 },
    WALL_H: 14, WALL_T: 8, HOUSE: { k: 1.6, w: 22, d: 16, h: 16 }, FARM: { h: 24, roof: 18 }, H: { inf: 40, cav: 55, art: 30 }, SMOKE: 1, MIN_F: 60, MIN_D: 40, LIFT: 2, HIDE: 30, NEAR: 8, FAR: 60000, FX: 14 },
  GROUND: { STEP: 1, EX: 1, TREE_H: 18, TREE_R: 5, TREE_GAP: 14, TREE_JIT: 9, TRUNK: [0.35, 0.45], ORCH: { gap: 9, th: 1.8, tr: [0.12, 0.16], cr: 2.2, ch: 1.8, lift: 3 }, BUSH: { gap: 2.4, r: 1.4, h: 1.1, lift: 0.9, jit: 0.5 },
    WALL_H: 2, WALL_T: 0.5, HOUSE: { k: 1, w: 0, d: 0, h: 5 }, FARM: { h: 7, roof: 4 }, H: { inf: 1.8, cav: 2.6, art: 1.7 }, SMOKE: 0.45, MIN_F: 20, MIN_D: 6, LIFT: 0.05, HIDE: 3, NEAR: 0.8, FAR: 25000, EYE: 2.5, FX: 1 },
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
// a fine mottled tile for the ground near the eye: three sizes of soft blotch and a little grain, repeating without a seam, and middling
// grey on average so that it darkens and lightens the ground's own colours by turns (scenery; repeatable, no dice)
function v3DetailTile() {
  const n = V3K.DETAIL.SIZE, cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'), img = c.createImageData(n, n), d = img.data;
  const lat = (p, sd) => { const g = n / p, v = (i, j) => v3rand(((i % g + g) % g) * 131 + ((j % g + g) % g) * 7919 + sd), sm = t => t * t * (3 - 2 * t); return (x, y) => { const fx = x / p, fy = y / p, i = Math.floor(fx), j = Math.floor(fy), a = sm(fx - i), b = sm(fy - j); return (v(i, j) * (1 - a) + v(i + 1, j) * a) * (1 - b) + (v(i, j + 1) * (1 - a) + v(i + 1, j + 1) * a) * b - 0.5; }; };
  const A = lat(64, 11), B = lat(16, 23), C = lat(4, 37);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = (y * n + x) * 4, v = 0.5 * A(x, y) + 0.3 * B(x, y) + 0.25 * C(x, y) + 0.12 * (v3rand(k + 5) - 0.5), blade = v3rand(k + 9) > 0.93 ? -0.1 : 0;
    d[k] = 255 * v3clamp(0.5 + 0.8 * v + blade, 0, 1); d[k + 1] = 255 * v3clamp(0.5 + 0.9 * v + blade * 0.6, 0, 1); d[k + 2] = 255 * v3clamp(0.5 + 0.55 * v + blade, 0, 1); d[k + 3] = 255; }
  c.putImageData(img, 0, 0); return cv;
}
// which invented plot a point of the field falls in, as a tint for the ground there: the nearest of a scatter of block centres (one to a
// CELL square, placed by v3rand), then the strip of that block the point lies in (scenery: these are not the fields of the day)
function v3Plot(x, y) {
  const K = V3K.PLOTS, gx = Math.floor(x / K.CELL), gy = Math.floor(y / K.CELL); let best = Infinity, id = 0;
  for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) { const h = i * 7349 + j * 91813, px = (i + v3rand(h)) * K.CELL, py = (j + v3rand(h + 1)) * K.CELL, d = (px - x) * (px - x) + (py - y) * (py - y); if (d < best) { best = d; id = h; } }
  const th = v3rand(id + 2) * Math.PI, wd = v3lerp(K.STRIP[0], K.STRIP[1], v3rand(id + 3)), strip = Math.floor((x * Math.cos(th) + y * Math.sin(th)) / wd);
  return K.TINTS[Math.floor(v3rand(id * 31 + strip * 17 + 4) * K.TINTS.length) % K.TINTS.length];
}
function v3Ground(W, plots) { // the ground's picture: height bands shaded by slope as a printed relief map is, contour lines, then woods, water and roads
  const sc = V3K.TEX / Math.max(W.size.w, W.size.h), cv = document.createElement('canvas'); cv.width = Math.round(W.size.w * sc); cv.height = Math.round(W.size.h * sc);
  const c = cv.getContext('2d'), g = W.grid, w = cv.width, h = cv.height, hs = new Float32Array(w * h); let lo = Infinity, hi = -Infinity; for (const v of g.heights) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { const fx = v3clamp(px / sc / g.cell, 0, g.nx - 1.001), fy = v3clamp(py / sc / g.cell, 0, g.ny - 1.001), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, k = j * g.nx + i, H = g.heights;
    hs[py * w + px] = (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) + (H[k + g.nx] * (1 - a) + H[k + g.nx + 1] * a) * b; }
  const img = c.createImageData(w, h), d = img.data, m = 2 / sc * 2, lx = -0.5, ly = -0.5, lz = 0.707; // lit from the north-west, as relief maps are by custom
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { const k = py * w + px, x0 = Math.max(0, px - 2), x1 = Math.min(w - 1, px + 2), y0 = Math.max(0, py - 2), y1 = Math.min(h - 1, py + 2), v = hs[k];
    const nxv = -(hs[py * w + x1] - hs[py * w + x0]) / m * V3K.SHADE_Z, nyv = -(hs[y1 * w + px] - hs[y0 * w + px]) / m * V3K.SHADE_Z, len = Math.hypot(nxv, nyv, 1);
    let f = v3clamp((nxv * lx + nyv * ly + lz) / len / lz, 0.62, 1.3);
    if (Math.floor(v / V3K.CONTOUR) !== Math.floor(hs[py * w + x1 - (x1 > px ? 1 : 0)] / V3K.CONTOUR) || Math.floor(v / V3K.CONTOUR) !== Math.floor(hs[Math.min(h - 1, py + 1) * w + px] / V3K.CONTOUR)) f *= 0.84;
    const band = Math.round((v - lo) / Math.max(1, hi - lo) * 7) / 7, tint = plots ? v3Plot(px / sc, py / sc) : null; // on the ground, the invented field plots tint it
    for (let q = 0; q < 3; q++) d[k * 4 + q] = Math.min(255, v3lerp(V3K.LOW[q], V3K.HIGH[q], band) * f * (tint ? 1 + (tint[q] - 1) * V3K.PLOTS.AMT : 1)); d[k * 4 + 3] = 255; }
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
  V3.eye = (SIM.view.P && SIM.view.P.EYE) || V3K.GROUND.EYE; // the eye's height is the contract's (the engine's own, for a mounted officer)
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
  // from above: hard-edged colour, in keeping with the facets. On the ground the picture's ten-metre pixels would stand as squares
  // underfoot, so there it is smoothed, tinted with field plots and given a fine texture near the eye (scenery, not survey)
  const tex = new T.CanvasTexture(v3Ground(W, V3.cam.ground)); tex.magFilter = V3.cam.ground ? T.LinearFilter : T.NearestFilter;
  const gmat = new T.MeshLambertMaterial({ map: tex }); V3.eyeAt = new T.Vector3(); V3.detail = false;
  if (V3.cam.ground) { const D = V3K.DETAIL, dt = new T.CanvasTexture(v3DetailTile()); dt.wrapS = dt.wrapT = T.RepeatWrapping; const fl = v => v.toFixed(3);
    gmat.onBeforeCompile = sh => { sh.uniforms.v3Tile = { value: dt }; sh.uniforms.v3EyeAt = { value: V3.eyeAt }; V3.detail = true;
      sh.vertexShader = 'varying vec3 v3Wp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  v3Wp = position;');
      sh.fragmentShader = 'uniform sampler2D v3Tile; uniform vec3 v3EyeAt; varying vec3 v3Wp;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { float v3d = distance(v3Wp, v3EyeAt); vec3 v3a = texture2D(v3Tile, v3Wp.xz / ${fl(D.FINE)}).rgb * 2.0, v3b = texture2D(v3Tile, v3Wp.zx / ${fl(D.COARSE)}).rgb * 2.0;
    diffuseColor.rgb *= mix(vec3(1.0), v3a, ${fl(D.AMT[0])} * (1.0 - smoothstep(${fl(D.FINE_FADE[0])}, ${fl(D.FINE_FADE[1])}, v3d))) * mix(vec3(1.0), v3b, ${fl(D.AMT[1])} * (1.0 - smoothstep(${fl(D.COARSE_FADE[0])}, ${fl(D.COARSE_FADE[1])}, v3d))); }`); }; }
  // each facet gets its own three corners and its own normal, so the facets are flat by construction (not by a shader trick that
  // went black on facets close to the eye in the ground view)
  const flat = geo.toNonIndexed(); flat.computeVertexNormals();
  S.add(new T.Mesh(flat, gmat)); V3.tris = idx.length / 3;
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
  if (V3.cam.ground) { const n = V3K.TUFT_N * V3K.TUFT_N; const tg = { p: [], c: [] }; for (let b = 0; b < 3; b++) { const a = b * 2.1 + 0.4, lean = 0.28 + 0.1 * b, bx = Math.cos(a) * 0.04, bz = Math.sin(a) * 0.04, tx = Math.cos(a) * lean * 0.4, tz = Math.sin(a) * lean * 0.4, w = 0.035, nx = -Math.sin(a) * w, nz = Math.cos(a) * w, top = 0.2 - 0.03 * b;
      for (const [u, v] of [[1, -1], [-1, 1]]) tg.p.push(bx + nx * u, -0.2, bz + nz * u, bx + nx * v, -0.2, bz + nz * v, bx + tx, top, bz + tz); for (let q = 0; q < 6; q++) tg.c.push(1, 1, 1); } // a tuft is three blades leaning apart (each drawn from both sides), not a cone: cones read as fir trees through the glass
    V3.tufts = new T.InstancedMesh(v3Geo(tg), lam(), n); V3.tufts.frustumCulled = false; for (let i = 0; i < n; i++) tint(V3.tufts, i, V3K.TUFT, i); S.add(V3.tufts); }
  V3.unitGeo = new T.BoxGeometry(1, 1, 1); V3.at = at; V3.put = put;
  v3FxBuild(); V3.men = null; V3.menStat = null; if (V3.cam.ground) v3MenBuild(); // on the ground the bodies are men and stand-in blocks; from above they stay the enlarged blocks
  if (fresh) { V3.cam.tx = W.size.w / 2; V3.cam.tz = W.size.h / 2; V3.cam.dist = Math.max(W.size.w, W.size.h) * 0.85; V3.cam.az = 0; V3.cam.pol = 0.95; }
}
function v3SideColour(side) { const v = getComputedStyle(document.documentElement).getPropertyValue('--m-' + String(side).toLowerCase()).trim(); return v || '#666666'; }
function v3Take() { // a new tick: keep the last picture to glide from, take the new one
  const snap = SIM.view.snapshot('truth'), m = new Map(); for (const u of snap.units) m.set(u.id, u);
  V3.prev = V3.cur || m; V3.cur = m; V3.prevT = V3.snap && V3.prev !== m ? V3.snap.t : null; V3.curT = snap.t; V3.snap = snap; V3.tick = SIM.tick;
  v3FxTake(snap);
  // the player's commander, from his own snapshot: only where he stands and the glass he carries are read here (the picture drawn
  // stays the umpire's). A battle with no command layer has no commander to stand beside, and no glass.
  { let c = null; try { c = SIM.view.snapshot('chief'); } catch (e) { c = null; } V3.glass = c && c.glass ? c.glass : null; if (!V3.glass && V3.cam.field === 'glass') v3Field('wide');
    const was = V3.chief; V3.chief = c && c.at ? { x: c.at.x, y: c.at.y, side: c.side } : null; $('v3h').hidden = !V3.chief;
    if (V3.cam.ground && V3.cam.atPost && V3.chief && was && (was.x !== V3.chief.x || was.y !== V3.chief.y)) v3ToPost(true); } // headquarters moved: the eye goes with it
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
  const cap = $('v3cap'); cap.textContent = `${C.ground ? (C.atPost ? 'On the ground at headquarters' : 'On the ground') : 'The field in relief'} · the umpire’s picture · ${V3.snap.clock} · ${how}`;
  // what is invented is said on the picture itself, in a second line: the map knows none of it
  if (C.ground) { const n = document.createElement('span'); n.className = 'v3note'; n.textContent = V3K.NOTE; cap.appendChild(n); }
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
// Where the player's commander stands, and which way he would look: read from the contract (his own snapshot for his place, the
// truth for the enemy, since this is the umpire's picture). The facing is toward the enemy's centre of mass, by strength, or, with no
// enemy on the field, toward the nearest objective.
function v3Chief() { let c = null; try { c = SIM.view.snapshot('chief'); } catch (e) { c = null; } return c && c.at ? { x: c.at.x, y: c.at.y, side: c.side } : null; }
function v3Blocked(W, x, y, dx, dy) { // does a building stand close ahead of this spot, or over it?
  const K = V3K.POST, cosH = Math.cos(K.HALF * Math.PI / 180);
  for (const b of [...W.buildings, ...W.houses]) { const r = (b.rot || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), hw = b.w / 2, hh = b.h / 2, u = (x - b.x) * cs + (y - b.y) * sn, v = -(x - b.x) * sn + (y - b.y) * cs;
    if (Math.abs(u) < hw + 1 && Math.abs(v) < hh + 1) return true;
    for (const [a, c] of [[0, 0], [-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh], [0, -hh], [0, hh], [-hw, 0], [hw, 0]]) { const px = b.x + a * cs - c * sn - x, py = b.y + a * sn + c * cs - y, d = Math.hypot(px, py); if (d < K.CLEAR && (px * dx + py * dy) / (d || 1) > cosH) return true; } }
  return false;
}
function v3ToPost(keepLook) { // put the eye at headquarters; keepLook leaves its facing alone (headquarters moved while you were looking)
  const C = V3.cam, at = V3.chief || v3Chief(), W = V3.W; if (!at || !W) return false;
  const snap = V3.snap || SIM.view.snapshot('truth'), co = Object.fromEntries(W.sides.map(sd => [sd.id, sd.coalition])); let sx = 0, sy = 0, sw = 0;
  for (const u of snap.units) if (co[u.side] !== co[at.side]) { sx += u.x * u.str; sy += u.y * u.str; sw += u.str; }
  let aim = sw > 0 ? [sx / sw, sy / sw] : null;
  if (!aim) { let bd = Infinity; for (const o of W.objectives) if (o.x != null) { const d = Math.hypot(o.x - at.x, o.y - at.y); if (d > 1 && d < bd) { bd = d; aim = [o.x, o.y]; } } }
  let dx = 0, dy = -1; if (aim) { const d = Math.hypot(aim[0] - at.x, aim[1] - at.y) || 1; dx = (aim[0] - at.x) / d; dy = (aim[1] - at.y) / d; }
  let step = 0; while (step < V3K.POST.REACH && v3Blocked(W, at.x + dx * step, at.y + dy * step, dx, dy)) step += V3K.POST.STEP;
  if (step >= V3K.POST.REACH && v3Blocked(W, at.x + dx * step, at.y + dy * step, dx, dy)) step = 0; // no open view within reach: stay at the post itself
  C.tx = v3clamp(at.x + dx * step, 0, W.size.w); C.tz = v3clamp(at.y + dy * step, 0, W.size.h); C.atPost = true; V3.postStep = step; V3.postAim = aim;
  V3.staffAt = { x: C.tx, z: C.tz, dx, dz: dy, side: at.side }; V3.menSig = null; // the staff group (scenery) stands beside this spot, set by the way the commander first looks
  if (!keepLook) { C.az = Math.atan2(-dx, -dy); C.pitch = 0; } // the camera looks along (-sin az, -cos az)
  v3Caption(); return true;
}
function v3Ground2(on, here) { // down to the ground, or back up. Down is to headquarters; `here` steps down where the view from above is centred instead
  V3.cam.ground = on; V3.cam.pitch = 0; V3.cam.atPost = false; if (V3.on) { v3Build(); V3.tick = -1; V3.cur = V3.prev = null; } const b = $('v3g'); b.textContent = on ? 'From above' : 'On the ground'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
  $('v3f').hidden = !on; v3Field(V3.cam.field); // the field's steps belong to the ground view; the step last used is kept
  if (on && !here) v3ToPost(); $('v3h').textContent = on ? 'To headquarters' : 'Step down here'; $('v3h').hidden = !(V3.chief || v3Chief());
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
    o.visible = !V3.cam.ground; } // on the ground the bodies are drawn as men and stand-in blocks instead (v3Bodies); the box only keeps the place
  const C = V3.cam, cam = V3.camera, ty = V3.at(C.tx, C.tz);
  const fov = v3Fov(); let saz = 0, spi = 0;
  if (C.ground && C.field === 'glass' && V3.glass && !V3.still) { // a held glass wanders a little: three slow swings, the same every time it is raised
    const s = (performance.now() - V3.t0) / 1000, a = V3K.FIELD.SWAY * V3.glass.field * Math.PI / 180, P = V3K.FIELD.SWAY_S, w = k => 2 * Math.PI * s / P[k];
    saz = a * (0.6 * Math.sin(w(0)) + 0.3 * Math.sin(w(1) + 1) + 0.1 * Math.sin(w(2))); spi = a * (0.6 * Math.sin(w(1)) + 0.3 * Math.sin(w(0) + 2) + 0.1 * Math.sin(w(2) + 1)); }
  V3.sway = [saz, spi];
  if (C.ground) { const ey = ty + V3.eye, az = C.az + saz, pi = C.pitch + spi, cp = Math.cos(pi); cam.position.set(C.tx, ey, C.tz); cam.lookAt(C.tx - Math.sin(az) * cp * 100, ey + Math.sin(pi) * 100, C.tz - Math.cos(az) * cp * 100); } // standing on the ground, looking the way the view from above was facing
  else { cam.position.set(C.tx + C.dist * Math.sin(C.pol) * Math.sin(C.az), ty + C.dist * Math.cos(C.pol), C.tz + C.dist * Math.sin(C.pol) * Math.cos(C.az)); cam.lookAt(C.tx, ty, C.tz); }
  V3.dome.position.copy(cam.position); if (V3.sunDir) V3.disc.position.copy(cam.position).addScaledVector(V3.sunDir, V3.K.FAR * 0.75); if (V3.tufts) v3Tufts();
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); v3Caption(); } v3Mask();
  if (C.ground && V3.men) v3MenFrame(t);
  V3.eyeAt.copy(cam.position); v3FxFrame(t);
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
// the second button: from above, step down where the view is centred (the first way this view worked); on the ground, go back to headquarters
$('v3h').addEventListener('click', () => { if (V3.cam.ground) v3ToPost(); else v3Ground2(true, true); });
// one finger or the mouse turns the field; two fingers, the wheel or shift-drag move and zoom
(function () {
  const el = $('v3c'), P = new Map(); let pinch = 0, mid = null;
  const pan = (dx, dy) => { const C = V3.cam, k = C.ground ? V3K.WALK : C.dist / Math.max(200, V3.h || 400); C.tx = v3clamp(C.tx - (dx * Math.cos(C.az) + dy * Math.sin(C.az)) * k, 0, V3.W.size.w); C.tz = v3clamp(C.tz - (-dx * Math.sin(C.az) + dy * Math.cos(C.az)) * k, 0, V3.W.size.h); if (C.atPost) { C.atPost = false; v3Caption(); } };
  const zoom = f => { const C = V3.cam; if (C.ground) { const d = (1 - f) * 900; C.tx = v3clamp(C.tx - Math.sin(C.az) * d, 0, V3.W.size.w); C.tz = v3clamp(C.tz - Math.cos(C.az) * d, 0, V3.W.size.h); if (C.atPost) { C.atPost = false; v3Caption(); } } else C.dist = v3clamp(C.dist * f, 600, 16000); }; // on the ground, zooming in is walking forward
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; mid = null; });
  el.addEventListener('pointermove', e => { if (!P.has(e.pointerId) || !V3.on) return; const was = P.get(e.pointerId), dx = e.clientX - was[0], dy = e.clientY - was[1]; P.set(e.pointerId, [e.clientX, e.clientY]);
    // through the glass or the eye's step a drag turns the eye less, by the power, so a narrow field can still be aimed
    if (P.size === 1) { if (e.shiftKey || e.buttons === 2) pan(dx, dy); else if (V3.cam.ground) { const k = 1 / v3Power(); V3.cam.az += dx * V3K.FIELD.TURN * k; V3.cam.pitch = v3clamp(V3.cam.pitch + dy * V3K.FIELD.TILT * k, -0.5, 0.6); } else { V3.cam.az -= dx * 0.006; V3.cam.pol = v3clamp(V3.cam.pol - dy * 0.005, 0.15, 1.45); } }
    else if (P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (pinch) zoom(pinch / Math.max(1, d)); if (mid) pan(m[0] - mid[0], m[1] - mid[1]); pinch = d; mid = m; } });
  const up = e => { P.delete(e.pointerId); pinch = 0; mid = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
})();
/* ---------- men in place of slabs (the ground view) ---------- */
// A body near the eye, or inside the glass's field, is drawn man by man: ranks of plain low-poly figures, life size, laid out inside
// the footprint, facing and strength the contract gives. Everything farther keeps a cheap stand-in: blocks with a broken top edge, one
// for each line or column, following the ground. The contract does not say where each company stands, so the layout inside a
// footprint is a general rule (v3Layout) and an estimate; coats take the map's colour for the side, which is not a uniform.
function v3Hex(h) { return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }
// a box from corner to corner, in a colour, without the faces named in `skip` (b bottom, t top, f front (-z), k back (+z), l, r)
function v3Box(out, x0, y0, z0, x1, y1, z1, col, skip) {
  const F = { r: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], l: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], t: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    b: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], k: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], f: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] };
  for (const k in F) { if (skip && skip.includes(k)) continue; const q = F[k]; for (const i of [0, 1, 2, 0, 2, 3]) { out.p.push(q[i][0], q[i][1], q[i][2]); out.c.push(col[0], col[1], col[2]); } }
  return out;
}
// lean the vertices added since `from` about a level axis through (py, pz): a sloped musket, a horse's neck, a gun's trail
function v3Lean(out, from, ang, py, pz) { const c = Math.cos(ang), s = Math.sin(ang); for (let i = from; i < out.p.length; i += 3) { const y = out.p[i + 1] - py, z = out.p[i + 2] - pz; out.p[i + 1] = py + y * c - z * s; out.p[i + 2] = pz + y * s + z * c; } }
function v3Geo(out) { const T = globalThis.THREE, g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(out.p), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(out.c), 3)); g.computeVertexNormals(); return g; }
// the models: every figure stands with its feet at 0, faces -z, and is a few boxes. `tint` parts are white and take the instance's
// colour (the coat, the horse's hide, the flag); `fixed` parts carry their own colours.
function v3Models() {
  const G = V3K.FIG, C = G.COL, c = k => v3Hex(C[k]), W = [1, 1, 1], o = () => ({ p: [], c: [] });
  const man = (tint, fixed, y, musket, pack) => { // a man standing with his feet at height y (0 on foot)
    v3Box(tint, -0.22, y + 0.85, -0.12, 0.22, y + 1.45, 0.12, W, 'b'); v3Box(tint, -0.31, y + 0.88, -0.07, -0.22, y + 1.43, 0.07, W, 'r'); v3Box(tint, 0.22, y + 0.88, -0.07, 0.31, y + 1.43, 0.07, W, 'l');
    v3Box(fixed, -0.09, y + 1.45, -0.1, 0.09, y + 1.68, 0.1, c('SKIN'), 'tb'); v3Box(fixed, -0.11, y + 1.68, -0.12, 0.11, y + 1.9, 0.12, c('HAT'), 'b');
    if (pack) v3Box(fixed, -0.16, y + 1.0, 0.12, 0.16, y + 1.4, 0.24, c('PACK'), 'f');
    if (musket) { const from = fixed.p.length; v3Box(fixed, 0.23, y + 0.8, -0.03, 0.28, y + 2.2, 0.02, c('MUSKET'), 'b'); v3Lean(fixed, from, 0.12, y + 0.8, 0); } };
  const legs = (fixed, y) => { v3Box(fixed, -0.18, y, -0.09, -0.03, y + 0.85, 0.09, c('TROUSER'), 'tb'); v3Box(fixed, 0.03, y, -0.09, 0.18, y + 0.85, 0.09, c('TROUSER'), 'tb'); };
  const foot = [o(), o()]; man(foot[0], foot[1], 0, true, true); legs(foot[1], 0);
  const crew = [o(), o()]; man(crew[0], crew[1], 0, false, false); legs(crew[1], 0);
  // a horse: barrel, neck, head, four legs, tail; the hide takes the instance's colour, legs and tail are darker shares of it
  const horse = o(), dark = [0.45, 0.45, 0.45], mane = [0.25, 0.25, 0.25];
  v3Box(horse, -0.28, 0.85, -0.75, 0.28, 1.5, 0.75, W);
  { const from = horse.p.length; v3Box(horse, -0.13, 1.2, -0.95, 0.13, 2.0, -0.6, W, 'b'); v3Lean(horse, from, -0.5, 1.2, -0.75); }
  { const from = horse.p.length; v3Box(horse, -0.1, 1.72, -1.72, 0.1, 1.98, -1.12, W, 'k'); v3Lean(horse, from, -0.3, 1.9, -1.15); }
  for (const [x, z] of [[-0.26, -0.7], [0.12, -0.7], [-0.26, 0.55], [0.12, 0.55]]) v3Box(horse, x, 0, z, x + 0.14, 0.9, z + 0.15, dark, 'tb');
  v3Box(horse, -0.06, 0.75, 0.75, 0.06, 1.42, 0.85, mane, 'f');
  // his rider: a man seated at the saddle's height, his legs hanging at the horse's sides
  const rider = [o(), o()]; man(rider[0], rider[1], 0.68, false, false);
  v3Box(rider[1], -0.4, 0.78, -0.28, -0.28, 1.56, -0.06, c('BOOT'), ''); v3Box(rider[1], 0.28, 0.78, -0.28, 0.4, 1.56, -0.06, c('BOOT'), '');
  // a gun: barrel, cheeks, axle, two wheels, and a trail that runs back to the ground
  const gun = o(), wood = c('CARRIAGE'), R = G.WHEEL / 2;
  v3Box(gun, -0.09, R + 0.2, -1.55, 0.09, R + 0.38, 0.3, c('BARREL')); v3Box(gun, -0.2, R - 0.05, -0.5, 0.2, R + 0.2, 0.45, wood); v3Box(gun, -0.82, R - 0.06, -0.06, 0.82, R + 0.06, 0.06, wood, 'lr');
  { const from = gun.p.length; v3Box(gun, -0.12, R - 0.1, 0.2, 0.12, R + 0.12, 2.5, wood, 'f'); v3Lean(gun, from, Math.asin((R - 0.1) / 2.3), R, 0.2); }
  for (const x of [-0.82, 0.72]) for (let k = 0; k < 8; k++) { const a0 = k / 8 * 2 * Math.PI, a1 = (k + 1) / 8 * 2 * Math.PI, y0 = R + R * Math.cos(a0), z0 = R * Math.sin(a0), y1 = R + R * Math.cos(a1), z1 = R * Math.sin(a1), x1 = x + 0.1, P = (...v) => { gun.p.push(...v); for (let q = 0; q < v.length / 3; q++) gun.c.push(wood[0] * 0.8, wood[1] * 0.8, wood[2] * 0.8); };
    P(x1, R, 0, x1, y1, z1, x1, y0, z0, x, R, 0, x, y0, z0, x, y1, z1, x, y0, z0, x1, y0, z0, x1, y1, z1, x, y0, z0, x1, y1, z1, x, y1, z1); } // the outer face, the inner face, the rim
  // a colour on its pike: the cloth takes the instance's colour
  const flag = o(); v3Box(flag, -0.03, 0, -0.03, 0.03, G.PIKE, 0.03, [0.35, 0.3, 0.25], 'b'); v3Box(flag, 0.03, G.PIKE - G.CLOTH[1], -0.012, 0.03 + G.CLOTH[0], G.PIKE, 0.012, W, 'l');
  // the stand-in: a block a metre each way with a broken top edge and a dark upper band (hats at a distance); it takes the side's colour
  const block = o(), n = G.TEETH; for (let k = 0; k < n; k++) { const x0 = -0.5 + k / n, x1 = x0 + 1 / n, h = 1 - G.NOTCH * v3rand(k * 31 + 5), band = h - G.BAND; v3Box(block, x0, 0, -0.5, x1, band, 0.5, W, 'tb'); v3Box(block, x0, band, -0.5, x1, h, 0.5, dark, 'b'); }
  return { foot, crew, horse, rider, gun, flag, block };
}
// the instanced meshes, built once for each scene: meshes of one kind share their matrices (a man's coat and the rest of him)
function v3MenBuild() {
  const T = globalThis.THREE, G = V3K.FIG, S = V3.scene, M = v3Models(), mat = both => new T.MeshLambertMaterial({ vertexColors: true, side: both ? T.DoubleSide : T.FrontSide }); // a wheel and a colour are seen from either side
  const kind = (max, parts) => { const k = { max, cap: max, n: 0, m: new Float32Array(max * 16), meshes: [], cols: [], tris: 0, unit: new Array(max) }, attr = new T.InstancedBufferAttribute(k.m, 16); attr.setUsage(T.DynamicDrawUsage);
    for (const [out, tinted] of parts) { const g = v3Geo(out), mesh = new T.InstancedMesh(g, mat(tinted === 2 || out === M.gun), max); mesh.instanceMatrix = attr; mesh.count = 0; mesh.frustumCulled = false; k.tris += g.attributes.position.count / 3;
      let col = null; if (tinted) { col = new Float32Array(max * 3).fill(1); mesh.instanceColor = new T.InstancedBufferAttribute(col, 3); mesh.instanceColor.setUsage(T.DynamicDrawUsage); } k.cols.push(col); k.meshes.push(mesh); S.add(mesh); }
    k.attr = attr; return k; };
  V3.men = { foot: kind(G.MAX.foot, [[M.foot[0], 1], [M.foot[1], 0]]), crew: kind(G.MAX.crew, [[M.crew[0], 1], [M.crew[1], 0]]), horse: kind(G.MAX.horse, [[M.horse, 1], [M.rider[0], 1], [M.rider[1], 0]]),
    gun: kind(G.MAX.gun, [[M.gun, 0]]), flag: kind(G.MAX.flag, [[M.flag, 2]]), block: kind(G.MAX.block, [[M.block, 1]]) };
  for (const k in V3.men) for (const mesh of V3.men[k].meshes) mesh.userData.fig = k;
  V3.jit = V3.jit || Float32Array.from({ length: 4096 }, (_, i) => v3rand(i + 17)); V3.menSig = null; V3.menStat = null; V3.sideRGB = new Map();
}
function v3SideRGB(side) { let c = V3.sideRGB.get(side); if (!c) { const k = new globalThis.THREE.Color(v3SideColour(side)); c = [k.r, k.g, k.b]; V3.sideRGB.set(side, c); } return c; }
// one instance: at (x, y, z), turned to face the compass heading h (radians), scaled s; colours (0..1) for each tinted mesh in turn
function v3Inst(kind, x, y, z, h, s, cols, unit, sy) {
  const K = V3.men[kind]; if (K.n >= K.cap) return false; const i = K.n++, m = K.m, o = i * 16, c = Math.cos(h) * s, n = Math.sin(h) * s;
  m[o] = c; m[o + 1] = 0; m[o + 2] = n; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = sy == null ? s : sy; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = -n; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0; m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
  let q = 0; for (const col of K.cols) if (col) { const cc = cols[q++] || cols[0]; col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2]; }
  K.unit[i] = unit; return true;
}
// How a body fills its footprint: rows of men, each a line with a centre (cx, cz), a width and depth, the way it faces within the body
// (yaw, degrees) and its men. From the contract's capabilities and the footprint alone, never from a formation's name:
//   a crew: its pieces GUN_GAP apart along the front, in as many rows as that needs;
//   a body holding a place: one rank lining the edge of its footprint, facing out;
//   an all-round formation: hollow blocks BLOCK metres apart, RING ranks deep, facing out;
//   a column of march: MARCH files, as long as its footprint;
//   otherwise by the share of its men in the firing line (fire): nearly all, one line; a third or more, that many lines one behind
//   another; fewer, columns BLOCK apart each SHARE of its interval wide (one mass where the formation is very dense).
// A body that is no longer in order (not steady, shaken or disordered) is a crowd scattered over its footprint, backs to the enemy.
function v3Layout(u, F, D) {
  const G = V3K.FIG, W = V3.W, A = (W.arms || {})[u.arm] || {}, Fm = (W.formations || {})[u.form] || W.formationElse || {}, rows = [], n = Math.max(1, Math.round(u.str));
  const guns = A.crew > 0, mounted = !!A.mounted, file = guns ? G.GUN_GAP : mounted ? G.FILE.horse : G.FILE.foot, rank = guns ? G.GUN_ROW : mounted ? G.RANK.horse : G.RANK.foot, deep = guns ? G.GUN_ROW : mounted ? G.COL_RANK.horse : G.COL_RANK.foot;
  const L = { rows, guns, mounted, mob: false, n, file, head: [0, 0] };
  const row = (cx, cz, w, d, yaw, m, gap) => { m = Math.round(m); if (m < 1) return null; const per = Math.max(1, Math.min(m, Math.floor(w / file))), ranks = Math.ceil(m / per), r = { cx, cz, w, yaw, n: m, per, ranks, d: d != null ? d : Math.min(ranks * gap, 1e9) }; rows.push(r); return r; };
  if (!G.ORDERED.includes(u.status)) { L.mob = true; rows.push({ cx: 0, cz: 0, w: F, d: D, yaw: 180, n, per: n, ranks: 1 }); return L; }
  if (guns) { const per = Math.max(1, Math.floor(F / file)), ranks = Math.ceil(n / per); row(0, 0, F, ranks > 1 ? D : G.GUN_ROW, 0, n, 0); L.head = [0, D / 2 + 6]; return L; }
  if (u.place) { const peri = 2 * (F + D); for (const [cx, cz, w, yaw] of [[0, -D / 2, F, 0], [F / 2, 0, D, 90], [0, D / 2, F, 180], [-F / 2, 0, D, 270]]) row(cx, cz, w, null, yaw, n * w / peri, rank); L.head = [0, 0]; return L; }
  if (Fm.allRound) { const c = Math.max(1, Math.round(F / G.BLOCK)), each = n / c, t = G.RING * rank;
    for (let k = 0; k < c; k++) { const x = (k + 0.5 - c / 2) * F / c, s = v3clamp(each / (4 * G.RING) * file + t, 8, Math.max(8, Math.min(F / c * 0.85, D))), h = s / 2 - t / 2;
      for (const [dx, dz, yaw] of [[0, -h, 0], [h, 0, 90], [0, h, 180], [-h, 0, 270]]) row(x + dx, dz, s - t, t, yaw, each / 4, rank); }
    L.head = [(0.5 - c / 2) * F / c, 0]; return L; }
  if (Fm.column) { const files = mounted ? G.MARCH.horse : G.MARCH.foot, r = row(0, 0, files * file, D, 0, n, 0); r.per = Math.min(n, files); r.ranks = Math.ceil(n / r.per); L.head = [0, -D / 2 - 4]; return L; }
  const fire = Fm.fire == null ? 0.2 : Fm.fire;
  if (fire >= G.LINE) { const r = row(0, 0, F, null, 0, n, rank); L.head = [0, r.d / 2 + G.BEHIND]; return L; }
  if (fire >= G.LINES) { const k = Math.max(2, Math.round(1 / fire)); for (let j = 0; j < k; j++) { const r = row(0, 0, F, null, 0, n / k, rank); r.cz = -D / 2 + r.d / 2 + j * (D - r.d) / (k - 1); } L.head = [0, rows[0].cz + rows[0].d / 2 + G.BEHIND]; return L; }
  const c = (Fm.density || 0) >= G.MASS ? 1 : Math.max(1, Math.round(F / G.BLOCK)), w = c === 1 ? F : F / c * G.SHARE;
  for (let k = 0; k < c; k++) { const r = row((k + 0.5 - c / 2) * F / c, 0, w, null, 0, n / c, deep); r.d = Math.min(r.d, D); r.cz = -D / 2 + r.d / 2; }
  L.head = mounted ? [rows[0].cx, -D / 2 - G.BEHIND] : [rows[0].cx, rows[0].cz + rows[0].d / 2 + G.BEHIND]; return L;
}
// the cone the eye takes in, widened so a small turn needs no new layout, and how far off a man is still worth drawing as a man
function v3Cone() {
  const C = V3.cam, G = V3K.FIG, cam = V3.camera, fov = v3Fov() * Math.PI / 180, th = Math.tan(fov / 2), asp = (V3.w || 1) / Math.max(1, V3.h || 1), cp = Math.cos(C.pitch);
  const glass = C.field === 'glass' && V3.glass, half = glass ? Math.atan(th * (V3.maskR || V3.h / 2) / (V3.h / 2)) : Math.atan(th * Math.hypot(1, asp));
  // a man of height MAN at distance d stands MAN / d / (2 tan(fov / 2) / h) pixels tall (derived), so he is PX pixels tall at this distance
  const range = Math.min(G.FAR, V3.scene.fog ? V3.scene.fog.far : G.FAR, G.MAN * (V3.h || 690) / (G.PX * 2 * th));
  return { x: C.tx, y: cam.position.y, z: C.tz, ax: -Math.sin(C.az) * cp, ay: Math.sin(C.pitch), az: -Math.cos(C.az) * cp, half: Math.min(Math.PI * 0.49, half * G.PAD), slack: half * (G.PAD - 1), range, fov };
}
// lay every body out again: men where they are near enough and the budget allows (nearest bodies first), stand-in blocks elsewhere
function v3Bodies(t) {
  const G = V3K.FIG, K = V3.K, W = V3.W, men = V3.men, cone = v3Cone(), jit = V3.jit, D2R = Math.PI / 180, cosH = Math.cos(cone.half), HORSES = G.COL.HORSES.map(v3Hex);
  for (const k in men) men[k].n = 0;
  const list = [];
  for (const [id] of V3.units) { const c = V3.cur.get(id), p = V3.prev.get(id) || c, x = v3lerp(p.x, c.x, t), y = v3lerp(p.y, c.y, t), turn = ((c.facing - p.facing + 540) % 360) - 180;
    list.push({ id, c, x, y, f: (p.facing + turn * t) * D2R, F: Math.max(1, v3lerp(p.front, c.front, t)), D: Math.max(1, v3lerp(p.depth, c.depth, t)), d: Math.hypot(x - cone.x, y - cone.z) }); }
  list.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
  let full = false, bodies = 0, left = 0, nearest = Infinity; const inCone = (x, y, z, r) => { const dx = x - cone.x, dy = y - cone.y, dz = z - cone.z, d = Math.hypot(dx, dy, dz); if (d <= r) return true; const a = Math.acos(v3clamp((dx * cone.ax + dy * cone.ay + dz * cone.az) / d, -1, 1)); return a <= cone.half + Math.asin(Math.min(1, r / d)); };
  for (const b of list) {
    const u = b.c, L = v3Layout(u, b.F, b.D), cf = Math.cos(b.f), sf = Math.sin(b.f), rad = Math.hypot(b.F, b.D) / 2 + 2, gy = V3.at(b.x, b.y), col = v3SideRGB(u.side), seed = (Math.imul(b.id.length * 31 + b.id.charCodeAt(0) * 7 + b.id.charCodeAt(b.id.length - 1), 2654435761) >>> 0) & 4095;
    const world = (lx, lz) => [b.x + lx * cf - lz * sf, b.y + lx * sf + lz * cf]; // the body's frame to the field: x along its front, z to its rear
    let asMen = !full && b.d - rad < cone.range && inCone(b.x, gy + 1, b.y, rad);
    if (asMen) { // try to draw it man by man; if the budget runs out part-way, take the men back and fall through to the stand-in
      const kind = L.guns ? 'gun' : L.mounted ? 'horse' : 'foot', K0 = {}; for (const k in men) K0[k] = men[k].n; let ok = true, drawn = 0, q = seed;
      for (const r of L.rows) { const cy = Math.cos(r.yaw * D2R), sy = Math.sin(r.yaw * D2R), head = b.f + r.yaw * D2R;
        for (let k = 0; k < r.n && ok; k++) { const i = k % r.per, rk = (k - i) / r.per; q = (q + 3) & 4095; let lx, lz, h = head;
          if (L.mob) { lx = (jit[q] - 0.5) * r.w; lz = (jit[(q + 1) & 4095] - 0.5) * r.d; h += (jit[(q + 2) & 4095] - 0.5) * G.MOB_TURN; }
          else { const j = G.LOOSE[u.status] || G.LOOSE._; lx = (i - (r.per - 1) / 2) * (r.w / r.per) + (jit[q] - 0.5) * j; lz = -r.d / 2 + (rk + 0.5) * r.d / r.ranks + (jit[(q + 1) & 4095] - 0.5) * j; h += (jit[(q + 2) & 4095] - 0.5) * j * 0.3; }
          const bx = r.cx + lx * cy - lz * sy, bz = r.cz + lx * sy + lz * cy, [wx, wz] = world(bx, bz), dx = wx - cone.x, dz = wz - cone.z, dy = gy + 1 - cone.y, d2 = dx * dx + dy * dy + dz * dz, dot = dx * cone.ax + dy * cone.ay + dz * cone.az;
          if (d2 < G.HIDE * G.HIDE || dot <= 0 || dot * dot < cosH * cosH * d2) continue; // too close to the eye to draw, or outside what it takes in
          const y = V3.at(wx, wz), s = 0.94 + 0.12 * jit[(q + 5) & 4095], shade = 0.86 + 0.28 * jit[(q + 7) & 4095], cc = [col[0] * shade, col[1] * shade, col[2] * shade];
          if (L.guns) { ok = v3Inst('gun', wx, y, wz, h, 1, [], b.id); // the piece, and the men who serve it standing round its trail (CREW of them; the rest are with the teams, not drawn)
            for (let m = 0; m < G.CREW && ok; m++) { const o = G.CREW_AT[m % G.CREW_AT.length], ch = Math.cos(h), sh = Math.sin(h), mx = wx + o[0] * ch - o[1] * sh, mz = wz + o[0] * sh + o[1] * ch; ok = v3Inst('crew', mx, V3.at(mx, mz), mz, h + o[2], s, [cc], b.id); } }
          else if (L.mounted) ok = v3Inst('horse', wx, y, wz, h, s, [HORSES[(q + k) % HORSES.length], cc], b.id);
          else ok = v3Inst('foot', wx, y, wz, h, s, [cc], b.id);
          if (ok) { drawn++; if (d2 < nearest * nearest) nearest = Math.sqrt(d2); } } }
      if (ok && !L.mob && !L.guns) { const [hx, hz] = world(L.head[0], L.head[1]), r0 = L.rows[0], [fx, fz] = world(r0.cx, r0.cz); // a mounted officer and a colour (or guidon) for each body drawn as men
        v3Inst('horse', hx, V3.at(hx, hz), hz, b.f, 1.04, [HORSES[seed % HORSES.length], col], b.id); v3Inst('flag', L.mounted ? hx + 1.5 * cf : fx, V3.at(L.mounted ? hx + 1.5 * cf : fx, L.mounted ? hz + 1.5 * sf : fz) + (L.mounted ? G.GUIDON_UP : 0), L.mounted ? hz + 1.5 * sf : fz, b.f, L.mounted ? G.GUIDON : 1, [[Math.min(1, col[0] * 1.25 + 0.08), Math.min(1, col[1] * 1.25 + 0.08), Math.min(1, col[2] * 1.25 + 0.08)]], b.id); }
      if (!ok) { for (const k in men) men[k].n = K0[k]; asMen = false; full = true; left++; } else bodies++;
    } else if (full && b.d - rad < cone.range && inCone(b.x, gy + 1, b.y, rad)) left++;
    if (asMen) continue;
    // the stand-in: one block for each line or column, cut into lengths of SEG metres so that it follows the ground
    const hgt = ((W.arms || {})[u.arm] || {}).height || K.H[u.arm] || K.H.inf, hh = hgt * (L.mob ? G.MOB_H : 1);
    for (const r of L.rows) { const cy = Math.cos(r.yaw * D2R), sy = Math.sin(r.yaw * D2R), head = b.f + r.yaw * D2R, w = L.mob ? r.w * 0.8 : r.w, d = Math.max(G.THIN, L.mob ? r.d * 0.8 : r.d), segs = Math.max(1, Math.ceil(w / G.SEG));
      for (let k = 0; k < segs; k++) { const lx = (k + 0.5 - segs / 2) * w / segs, [wx, wz] = world(r.cx + lx * cy, r.cz + lx * sy);
        if (Math.hypot(wx - cone.x, wz - cone.z) < Math.max(w / segs, d) / 2 + K.HIDE) continue; // never the inside of a block: the eye is standing in it
        const K2 = men.block; if (K2.n >= K2.max) break; const i = K2.n++, m = K2.m, o = i * 16, ch = Math.cos(head), sh = Math.sin(head), ws = w / segs;
        m[o] = ch * ws; m[o + 1] = 0; m[o + 2] = sh * ws; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = hh; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = -sh * d; m[o + 9] = 0; m[o + 10] = ch * d; m[o + 11] = 0; m[o + 12] = wx; m[o + 13] = V3.at(wx, wz) + K.LIFT; m[o + 14] = wz; m[o + 15] = 1;
        const cl = K2.cols[0]; cl[i * 3] = col[0]; cl[i * 3 + 1] = col[1]; cl[i * 3 + 2] = col[2]; K2.unit[i] = b.id; } }
  }
  // the staff beside the standpoint at headquarters: a few horsemen and two officers on foot. Scenery: the contract places the commander
  // and nobody round him, so these stand for a staff that was there without being any record of who or where
  let staff = 0; if (V3.staffAt) { const A = V3.staffAt, col = v3SideRGB(A.side), h0 = Math.atan2(A.dx, -A.dz);
    for (const [r, f, turn, mounted] of V3K.STAFF) { const x = A.x - A.dz * r + A.dx * f, z = A.z + A.dx * r + A.dz * f, q = Math.round((r + 20) * 7 + f * 3);
      if (mounted ? v3Inst('horse', x, V3.at(x, z), z, h0 + turn, 1, [HORSES[q % HORSES.length], col], '(staff)') : v3Inst('crew', x, V3.at(x, z), z, h0 + turn, 1, [col], '(staff)')) staff++; } }
  let tris = 0, inst = 0; for (const k in men) { const Kd = men[k]; Kd.attr.needsUpdate = true; for (const mesh of Kd.meshes) { mesh.count = Kd.n; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; } tris += Kd.n * Kd.tris; inst += Kd.n; }
  V3.menStat = { staff, foot: men.foot.n, horse: men.horse.n, crew: men.crew.n, gun: men.gun.n, flag: men.flag.n, block: men.block.n, bodies, left, tris, instances: inst, range: Math.round(cone.range), nearest: nearest === Infinity ? null : nearest, max: Object.fromEntries(Object.entries(men).map(([k, v]) => [k, v.cap])) };
  V3.menAt = cone;
}
// called every frame on the ground: lay the bodies out again only when something moved (the bodies, the eye, or the field of view)
function v3MenFrame(t) {
  const C = V3.cam, last = V3.menAt, sig = `${V3.tick}|${t}|${V3.w}x${V3.h}|${C.field}`; let need = sig !== V3.menSig || !last;
  if (!need) { const cp = Math.cos(C.pitch), ax = -Math.sin(C.az) * cp, ay = Math.sin(C.pitch), az = -Math.cos(C.az) * cp; need = Math.hypot(C.tx - last.x, C.tz - last.z) > V3K.FIG.MOVE || Math.acos(v3clamp(ax * last.ax + ay * last.ay + az * last.az, -1, 1)) > last.slack * 0.6; }
  if (need) { V3.menSig = sig; v3Bodies(t); }
}
/* ---------- the field alive: gun flashes, volleys and their smoke, from the contract's event stream (no sound) ---------- */
// Every firing the umpire's stream reports ('truth': this is the umpire's picture) is drawn where and when it happened: flashes along
// the firing body's front and a puff of smoke from each, timed inside the tick as the stream times them and gliding with the bodies.
// Read with watch() and drain() only; looking changes nothing in the battle (tools/test_view.js holds the contract to that).
function v3FxBuild() {
  const T = globalThis.THREE, X = V3K.FX, S = V3.scene, was = V3.fx;
  const flash = new T.InstancedMesh(new T.OctahedronGeometry(1, 0), new T.MeshBasicMaterial({ color: X.FLASH, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, fog: false }), X.FLASH_MAX);
  flash.count = 0; flash.frustumCulled = false; flash.userData.fx = 'flash'; S.add(flash);
  const tiers = X.TIERS.map(op => { const m = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: V3K.SMOKE, transparent: true, opacity: op, depthWrite: false }), X.PUFF_MAX); m.count = 0; m.frustumCulled = false; m.userData.fx = 'puff'; S.add(m); return m; });
  // a new scene (the scale changed) keeps the stream's place and what is still in the air; a new battle starts afresh
  V3.fx = was && was.sim === SIM ? Object.assign(was, { flash, tiers }) : { sim: SIM, seq: 0, queue: [], flashes: [], puffs: [], flash, tiers, drained: 0, shot: { cannon: 0, volley: 0 }, recent: [], watching: false };
  if (!V3.fx.watching) { SIM.view.watch('truth'); V3.fx.watching = true; V3.fx.seq = SIM.view.drain('truth', 0).reduce((a, e) => Math.max(a, e.seq), 0); } // begin from now: nothing that happened before the view was opened is replayed
}
// a new tick: take the stream's new events; those of firing are queued to show at their own minute as the picture glides to this tick
function v3FxTake(snap) {
  const X = V3K.FX, fx = V3.fx; if (!fx) return; const ev = SIM.view.drain('truth', fx.seq), from = Math.max(V3.prevT == null ? snap.t : V3.prevT, snap.t - X.BACK);
  for (const e of ev) { fx.seq = Math.max(fx.seq, e.seq); fx.drained++; if (!X.KINDS[e.kind] || e.unit == null || e.t < from - 1e-6 || fx.queue.length >= X.QUEUE) continue; // older than the glide now starting: a battle hurried on while the view was shut
    const K = X.KINDS[e.kind], u = V3.cur.get(e.unit); if (!u) continue; const n = v3clamp(Math.round(K.per ? u.front / K.per : e.size), K.n[0], K.n[1]);
    for (let i = 0; i < n; i++) fx.queue.push({ t: Math.min(snap.t, e.t + (i ? v3rand(e.seq * 7 + i) * K.roll : 0)), unit: e.unit, kind: e.kind, k: e.seq * 13 + i }); }
  fx.queue.sort((a, b) => a.t - b.t); fx.wind = snap.wind;
}
// one shot: where on the body's front it is fired from, by the same layout the men stand in; a flash there and a puff before it
function v3Shot(q, t, now) {
  const X = V3K.FX, K = X.KINDS[q.kind], fx = V3.fx, c = V3.cur.get(q.unit); if (!c) return; const p = V3.prev.get(q.unit) || c, D2R = Math.PI / 180;
  const x = v3lerp(p.x, c.x, t), y = v3lerp(p.y, c.y, t), turn = ((c.facing - p.facing + 540) % 360) - 180, f = (p.facing + turn * t) * D2R, L = v3Layout(c, Math.max(1, v3lerp(p.front, c.front, t)), Math.max(1, v3lerp(p.depth, c.depth, t)));
  if (L.mob) return; const r = L.rows[q.k % L.rows.length], a = (v3rand(q.k) - 0.5) * r.w, cy = Math.cos(r.yaw * D2R), sy = Math.sin(r.yaw * D2R), lz = -r.d / 2 - K.out, bx = r.cx + a * cy - lz * sy, bz = r.cz + a * sy + lz * cy, cf = Math.cos(f), sf = Math.sin(f);
  const wx = x + bx * cf - bz * sf, wz = y + bx * sf + bz * cf, s = V3.K.FX, gy = V3.at(wx, wz) + K.up * s, h = f + r.yaw * D2R;
  if (fx.flashes.length < X.FLASH_MAX) fx.flashes.push({ x: wx, y: gy, z: wz, r: K.flash * s, born: now });
  if (fx.puffs.length < X.PUFF_MAX) fx.puffs.push({ x: wx + Math.sin(h) * K.puff[0] * s, y: gy, z: wz - Math.cos(h) * K.puff[0] * s, r0: K.puff[0] * s, r1: K.puff[1] * s, born: now, spin: v3rand(q.k + 3) * 6 });
  fx.shot[q.kind]++; fx.recent.push({ unit: q.unit, kind: q.kind, x: wx, z: wz, t: q.t, shown: fx.shown, body: [x, y, f / D2R, L.rows[0] ? Math.max(1, v3lerp(p.front, c.front, t)) : 0, Math.max(1, v3lerp(p.depth, c.depth, t))], out: K.out }); if (fx.recent.length > 60) fx.recent.shift();
}
function v3FxFrame(t) {
  const X = V3K.FX, fx = V3.fx; if (!fx || !V3.cur) return; const now = fx.held != null ? fx.held : performance.now(), shown = fx.shown = v3lerp(V3.prevT == null ? V3.curT : V3.prevT, V3.curT, t), M = V3.fxM || (V3.fxM = new globalThis.THREE.Matrix4());
  while (fx.queue.length && fx.queue[0].t <= shown + 1e-9) v3Shot(fx.queue.shift(), t, now);
  let n = 0; fx.flashes = fx.flashes.filter(o => now - o.born < X.FLASH_MS);
  for (const o of fx.flashes) { const a = (now - o.born) / X.FLASH_MS, r = o.r * (0.7 + 0.6 * a); M.makeScale(r, r, r).setPosition(o.x, o.y, o.z); fx.flash.setMatrixAt(n++, M); }
  fx.flash.count = n; fx.flash.instanceMatrix.needsUpdate = true;
  // smoke: each puff swells, rises and drifts down the wind as it thins; the thinning is done by passing it from one mesh to the next, fainter one
  const w = fx.wind || { dir: 0, speed: 0 }, wb = (w.dir + 180) * Math.PI / 180, wx = Math.sin(wb) * w.speed, wz = -Math.cos(wb) * w.speed, cnt = fx.tiers.map(() => 0); fx.puffs = fx.puffs.filter(o => now - o.born < X.PUFF_MS);
  for (const o of fx.puffs) { const age = (now - o.born) / 1000, a = age * 1000 / X.PUFF_MS, k = Math.min(fx.tiers.length - 1, Math.floor(a * fx.tiers.length)), r = v3lerp(o.r0, o.r1, Math.sqrt(a));
    M.makeRotationY(o.spin).scale(V3.tmp.set(r, r * 0.75, r)).setPosition(o.x + wx * age, o.y + X.RISE * age * V3.K.FX + r * 0.3, o.z + wz * age); fx.tiers[k].setMatrixAt(cnt[k]++, M); }
  fx.tiers.forEach((m, k) => { m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; });
}
// test hooks (view3dtest.py)
globalThis.WGame && Object.assign(globalThis.WGame, { v3: () => ({ on: V3.on, err: V3.err, units: V3.units.size, shown: V3.cur ? V3.cur.size : 0, tris: V3.tris || 0, frames: V3.frames, tick: V3.tick, smoke: V3.smoke ? V3.smoke.count : 0, button: !$('v3btn').hidden, three: !!globalThis.THREE,
    mover: (() => { let best = null, bd = 0; for (const [id, o] of V3.units) { const c = V3.cur.get(id), p = V3.prev.get(id) || c, d = Math.hypot(c.x - p.x, c.y - p.y); if (d > bd) { bd = d; best = { id, x: o.position.x, z: o.position.z, cx: c.x, cy: c.y, px: p.x, py: p.y, d }; } } return best; })() }), // the brigade that moved furthest this tick
  v3Open: () => v3Open(), v3Close: () => v3Close(), v3Cam: (az, pol, dist) => { V3.cam.az = az; V3.cam.pol = pol; V3.cam.dist = dist; },
  v3Probe: (nx, ny) => { const T = globalThis.THREE, rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(nx, ny), V3.camera); const h = rc.intersectObjects(V3.scene.children.filter(o => o.visible), false)[0]; if (!h) return null; let unit = null; for (const [id, o] of V3.units) if (o === h.object) unit = id; const fig = h.object.userData.fig || null; if (fig === 'block') unit = V3.men.block.unit[h.instanceId];
    return { dist: Math.round(h.distance), unit, geo: h.object.geometry.type, colour: h.object.material.color.getHexString(), instance: h.instanceId ?? null, figure: fig && fig !== 'block' ? fig : null, body: fig ? V3.men[fig].unit[h.instanceId] : null }; }, // what is drawn at a point of the screen (-1..1)
  v3Stand: (x, y, az) => { V3.cam.tx = x; V3.cam.tz = y; V3.cam.az = az; if (V3.cam.atPost) { V3.cam.atPost = false; v3Caption(); } }, v3Sky: () => Object.assign({ horizon: V3.scene.background.getHexString(), sunColour: V3.sun.color.getHexString(), tufts: V3.tufts ? V3.tufts.count : 0, step: V3.K.STEP }, V3.light), v3Eye: () => ({ ex: V3.K.EX, treeH: V3.K.TREE_H, blockH: V3.K.H.inf, ground: V3.cam.ground, y: V3.camera.position.y, floor: V3.at(V3.cam.tx, V3.cam.tz), trees: V3.trees, shrubs: V3.shrubs, fov: V3.camera.fov }),
  // the field's steps: v3Field(step) sets one ('wide', 'eye', 'glass') or steps on; v3Glass() says what is shown and why
  v3Field: to => { v3Field(to); return V3.cam.field; }, v3Still: on => { V3.still = !!on; },
  v3At: () => ({ x: V3.cam.tx, z: V3.cam.tz, az: V3.cam.az, pitch: V3.cam.pitch, ground: V3.cam.ground, atPost: V3.cam.atPost, step: V3.postStep || 0, aim: V3.postAim || null, caption: $('v3cap').firstChild ? $('v3cap').firstChild.textContent : '', second: $('v3h').hidden ? null : $('v3h').textContent }),
  // the scenery and the firing: what is drawn that the map does not hold, and what the event stream has put on the field
  v3Scene: () => ({ ground: V3.cam.ground, detail: !!V3.detail, plots: V3.cam.ground, smooth: V3.cam.ground, staff: V3.men && V3.menStat ? V3.menStat.staff : 0, staffAt: V3.staffAt || null, note: (document.querySelector('#v3cap .v3note') || {}).textContent || null, tufts: V3.tufts ? V3.tufts.geometry.attributes.position.count / 3 : 0 }),
  v3FxHold: on => { if (V3.fx) V3.fx.held = on ? performance.now() : null; }, // stop the flashes and smoke ageing, so a test or a picture can catch them (new ones still appear)
  v3Fx: () => V3.fx ? { seq: V3.fx.seq, drained: V3.fx.drained, queued: V3.fx.queue.length, flashes: V3.fx.flash.count, puffs: V3.fx.tiers.reduce((a, m) => a + m.count, 0), shot: Object.assign({}, V3.fx.shot), recent: V3.fx.recent.slice(-40), shown: V3.fx.shown, caps: { flash: V3K.FX.FLASH_MAX, puff: V3K.FX.PUFF_MAX }, scale: V3.K.FX } : null,
  // what the contract says, for the tests to work the standpoint out for themselves: the commander's place, the sides, and every body's side, place and strength
  v3Contract: () => { const W = SIM.view.world(), T = SIM.view.snapshot('truth'); let c = null; try { c = SIM.view.snapshot('chief'); } catch (e) { c = null; }
    return { at: c && c.at, side: c && c.side, glass: c && c.glass, eye: SIM.view.P.EYE, sides: W.sides, arms: W.arms, formations: W.formations, objectives: W.objectives, buildings: W.buildings, units: T.units.map(u => ({ id: u.id, side: u.side, arm: u.arm, form: u.form, x: u.x, y: u.y, str: u.str, front: u.front, depth: u.depth, facing: u.facing, status: u.status })) }; },
  // the bodies on the ground: how many instances of each kind are drawn, the caps, the triangles, and which bodies are drawn as men
  v3Men: () => V3.men && V3.menStat ? Object.assign({ trisEach: Object.fromEntries(Object.entries(V3.men).map(([k, v]) => [k, v.tris])), asMen: [...new Set(['foot', 'horse', 'gun'].flatMap(k => V3.men[k].unit.slice(0, V3.men[k].n)))].filter(id => V3.units.has(id)), hide: V3K.FIG.HIDE, px: V3K.FIG.PX }, V3.menStat) : null,
  // every figure drawn for one body: its kind, where it stands and the compass heading it faces (degrees), read back from what is drawn
  v3Figures: id => { const out = []; if (V3.men) for (const k of ['foot', 'horse', 'gun', 'crew', 'flag', 'block']) { const K = V3.men[k]; for (let i = 0; i < K.n; i++) if (K.unit[i] === id) { const o = i * 16; out.push([k, K.m[o + 12], K.m[o + 14], (Math.atan2(K.m[o + 2], K.m[o]) * 180 / Math.PI + 360) % 360, K.m[o + 13]]); } } return out; },
  v3Look: (x, y, up) => { const C = V3.cam, dx = x - C.tx, dz = y - C.tz, d = Math.hypot(dx, dz) || 1; C.az = Math.atan2(-dx, -dz); C.pitch = Math.atan2(V3.at(x, y) + (up || 0) - (V3.at(C.tx, C.tz) + V3.eye), d); return { az: C.az, pitch: C.pitch, dist: d }; }, // turn the eye to a point of the field
  v3Cap: caps => { if (!V3.men) return null; for (const k in V3.men) V3.men[k].cap = Math.min(V3.men[k].max, caps && caps[k] != null ? caps[k] : V3.men[k].max); V3.menSig = null; return true; }, // lower a kind's cap for a test of the budget (never above the constant); no argument restores them
  v3Post: () => v3ToPost(), v3Project: (x, y, up) => { const v = new globalThis.THREE.Vector3(x, V3.at(x, y) + (up || 0), y).project(V3.camera); return { x: v.x, y: v.y, z: v.z }; }, // where a point of the field falls on the screen (-1..1)
  v3Glass: () => ({ field: V3.cam.field, fov: V3.camera ? V3.camera.fov : null, want: v3Fov(), power: v3Power(), glass: V3.glass, h: V3.h, w: V3.w, mask: !$('v3m').hidden, maskR: V3.maskR || 0, sway: V3.sway || [0, 0], button: !$('v3f').hidden, label: $('v3f').textContent, caption: $('v3cap').firstChild ? $('v3cap').firstChild.textContent : '',
    turn: V3K.FIELD.TURN / v3Power() }) });
