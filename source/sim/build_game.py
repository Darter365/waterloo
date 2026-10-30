import os
D = os.path.dirname(os.path.abspath(__file__))
R = lambda p: open(os.path.join(D, p), encoding='utf-8').read()
tpl = open(os.path.join(D, '..', 'map', 'template.html'), encoding='utf-8').read().split('\n')
L = lambda a, b: '\n'.join(tpl[a - 1:b])
def expect(n, s):
    assert tpl[n - 1].lstrip().startswith(s), (n, tpl[n - 1][:80])
expect(207, 'let ZMIN'); expect(315, '}'); expect(581, 'function inPoly'); expect(588, '}'); expect(598, '/* ================= palette')
expect(615, '}'); expect(617, '/* ================= view'); expect(621, 'const layers'); expect(635, '}'); expect(637, '/* ================= terrain cache')
expect(766, '}'); expect(768, '/* ================= live drawing'); expect(806, 'function draw()'); expect(827, '}'); expect(828, 'function drawRoads')
expect(918, '}'); expect(919, 'function sideColor'); expect(1027, 'function drawFrame'); expect(1075, '}')
head = ('<title>__TITLE__</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Monsieur+La+Doulaise&display=swap">\n'
        '<style>\n' + R('_css_base.css') + '\n' + R('_css_viewer.css') + '\n' + R('_css_game.css') + '</style>\n')
# (phase 5) one page plays every battle that has a game block: bootGame(id) runs the whole game for one battle in its own closure, and
# stop() ends it (its loop, its page-wide listeners, its workers), so the shell below can swap in another battle without a reload.
# ROOT is this boot's copy of the page; once stopped, $ looks only there, so a late timer of the old battle cannot touch the new one.
# The battle's map comes from its packs (Waterloo's is data.js, the others' terrain packs), with what only Waterloo's map has left empty.
battle_pre = r"""const ROOT = document.getElementById('game-root'), DUMMY = document.createElement('div'); let DEAD = false, FRAMES = 0; const HOOKS = [];
const hook = (t, type, fn, o) => { t.addEventListener(type, fn, o); HOOKS.push(() => t.removeEventListener(type, fn, o)); };
globalThis.WBATTLE = GAME_ID;
const GAMEB = WPacks.battle(GAME_ID), GB = GAMEB.battle.game;
const WD = (() => { const W = GAMEB.W; return Object.assign({ HEDGES: [], SANDPIT: null, DEBATED: null, LION: null }, W, {
  LABELS: W.LABELS && W.LABELS.length ? W.LABELS : (W.VILLAGES || []).map(v => { const [la, lo] = W.m2ll(v.cx, v.cy); return [v.n, la, lo, v.r >= 150 ? 'village' : 'hamlet', 'c']; }),
  EDGE_LABELS: W.EDGE_LABELS && W.EDGE_LABELS.length ? W.EDGE_LABELS : (GB.edgeLabels || []),
  NAT: W.NAT || Object.fromEntries(Object.entries(GAMEB.nations).map(([k, n]) => [k, n ? n.name : k])), rng: W.rng || WData.rng, hashStr: W.hashStr || WData.hashStr }); })();
"""
imports = "const { LAT0, LON0, MLAT, MLON, NX, NY, CELL, WM, HM, ll2m, m2ll, H, LM, ROADS, SUNKEN, HEDGES, WOODS, BUILDINGS, ENCLOSURES, SANDPIT, VILLAGES, HOUSES, LABELS, EDGE_LABELS, STREAMS, NAT, DEBATED, LION, rng, hashStr } = WD;"
layers = "const layers = { tint: true, hach: true, contours: true, woods: true, water: true, roads: true, units: true, riders: false, myorders: true, ulabels: true, orders: true, broken: true, smoke: true, flashes: false, debated: false, dusk: true };"
draw = """function draw() {
  drawPending = false; PEND = [];
  const g = ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAL.bg; g.fillRect(0, 0, cssW, cssH);
  const [sx0, sy0] = P(0, 0), [sx1, sy1] = P(WM, HM);
  g.fillStyle = 'rgba(30,20,10,0.22)'; g.fillRect(sx0 + 3, sy0 + 4, sx1 - sx0, sy1 - sy0);
  g.fillStyle = PAL.paper; g.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  if (tview) { const k = view.s / tview.s; g.drawImage(tcan, view.tx - tview.cx0 * k, view.ty - tview.cy0 * k, tview.cw * k, tview.ch * k); }
  g.save(); g.beginPath(); g.rect(sx0, sy0, sx1 - sx0, sy1 - sy0); g.clip();
  if (layers.roads) drawRoads(g);
  if (layers.debated) drawDebated(g);
  updateFocus();
  drawScene(g);
  placeLabels();
  drawLabels(g);
  g.restore();
  drawOffmap(g);
  drawFrame(g);
  drawScale(g); drawHeightKey(g); drawNorth(g);
}"""
view = L(617, 635).replace(tpl[620], layers)
live = L(768, 805) + '\n' + draw + '\n' + L(828, 919)
# the map's Waterloo-only marks, drawn only where a battle has them (phase 5): the sandpit, Wellington's elm, the farms whose names
# always show, the brooks' names, and the frame's graticule (which ran over Waterloo's degrees)
roads = L(828, 919)
for a, b in [
    ("  g.beginPath(); rectPath(g, SANDPIT); g.fillStyle = PAL.road; g.fill(); g.strokeStyle = PAL.hach; g.lineWidth = 0.8; g.stroke();",
     "  if (SANDPIT) { g.beginPath(); rectPath(g, SANDPIT); g.fillStyle = PAL.road; g.fill(); g.strokeStyle = PAL.hach; g.lineWidth = 0.8; g.stroke(); }"),
    ("  { const [x, y] = ll2m(50.6801611, 4.4116889), [px, py] = P(x, y); g.fillStyle = PAL.woodink; g.beginPath(); g.arc(px - 5, py - 5, 2.6, 0, 7); g.fill(); }",
     "  for (const [la, lo] of GB.trees || []) { const [x, y] = ll2m(la, lo), [px, py] = P(x, y); g.fillStyle = PAL.woodink; g.beginPath(); g.arc(px - 5, py - 5, 2.6, 0, 7); g.fill(); }"),
    ("const KEY_FARMS = ['Hougoumont', 'La Haye Sainte', 'Papelotte', 'La Belle Alliance', 'Frischermont', 'Le Caillou'];", "const KEY_FARMS = GB.keyPlaces || [];"),
    ("    const a = near(50.6790, 4.4890, 800), b = near(50.6885, 4.4610, 400);\n    if (a) { const [px, py] = P(a[0], a[1]); label('la Lasne', px, py, 'water', 'l', PAL.water, 5, false); }\n    if (b) { const [px, py] = P(b[0], b[1]); label('ruisseau de Smohain', px, py, 'water', 'l', PAL.water, 5, false); }",
     "    for (const [t, la, lo, minA] of GB.waterLabels || []) { const a = near(la, lo, minA); if (a) { const [px, py] = P(a[0], a[1]); label(t, px, py, 'water', 'l', PAL.water, 5, false); } }"),
]:
    assert roads.count(a) == 1, a[:60]; roads = roads.replace(a, b)
live = live.replace(L(828, 919), roads)
frame = L(1027, 1075)
for a, b in [("for (let lo = 4.37; lo < 4.5001; lo += 0.01, k++)", "for (let lo = Math.floor(LON0 * 100) / 100 + 0.01; lo < LON0 + WM / MLON + 0.0001; lo += 0.01, k++)"),
             ("for (let la = 50.64; la < 50.708; la += 0.01, k++)", "for (let la = Math.floor((LAT0 - HM / MLAT) * 100) / 100 + 0.01; la < LAT0; la += 0.01, k++)")]:
    assert frame.count(a) == 1, a; frame = frame.replace(a, b)
game = '\n'.join([
    "function bootGame(GAME_ID) {", "'use strict';", battle_pre, imports,
    '/* ================= terrain (from the map) ================= */', L(207, 315),
    '/* ================= obstacles ================= */', L(581, 588),
    L(598, 615), view, L(637, 766), live, frame,
    R('_shared_draw.js'), R('_interact.js'), R('_game.js'), R('_game_orders.js'), R('_game_disp.js'), R('_game_letters.js'), R('_game_staff.js'), R('_game_pencil.js'), R('_game_alarm.js'), R('_game_mapstyle.js'), R('_game_glass.js'), R('_game_aar.js'), R('_game_review.js'), R('_game_end.js'), R('_game_boot.js'),
    'return { id: GAME_ID, frames: () => FRAMES, stop() { DEAD = true; playing = false; for (const f of HOOKS.splice(0)) f(); } };', '}'])
# the packs first (registry, then eras, nations, leaders, battles: the order packs/all.js loads them in node), then the engine
PACKS = ['packs/registry.js', 'packs/eras/napoleonic.js', 'packs/eras/medieval-test.js', 'packs/nations/napoleonic.js', 'packs/leaders/napoleonic.js', 'packs/maps/toy-ridge.js', 'packs/oob/toy-ridge.js', 'packs/maps/ligny.js', 'packs/oob/ligny.js', 'packs/battles/waterloo.js', 'packs/battles/toy-ridge.js', 'packs/battles/ligny.js']
srcs = PACKS + ['data.js', 'engine.js', 'ai.js', 'command.js', 'orders.js', 'plans.js', 'script.js', 'doctrine.js', 'replay.js']
sid = lambda f: 'src-' + f[:-3].replace('/', '-')
# each engine script carries an id so the after-action report's re-run worker can be built from the same source (step 6);
# the worker takes every script whose id starts "src-", in page order
assert '</script' not in ''.join(R(f) for f in srcs) + game
assert open(os.path.join(D, 'packs', 'all.js')).read().count('require(') == len(PACKS), 'packs/all.js and PACKS disagree'
# (phase 5) one app: every battle with a game block, chosen on the start screen (the select #s-battle), in the link (#ligny), or the one this
# viewer played last; Waterloo the first time. Changing battle stops the running one and boots the other on a fresh copy of the page.
shell = r"""const WApp = (() => {
  let root = document.getElementById('game-root'), cur = null; const PRISTINE = root.innerHTML, boots = [];
  const ok = id => !!(id && WPacks.battles[id] && WPacks.battles[id].game);
  const battles = () => Object.keys(WPacks.battles).filter(ok).sort((a, b) => String(WPacks.battles[a].date).localeCompare(String(WPacks.battles[b].date)));
  const KEEP = ['s-hist', 's-staff', 's-sil', 's-map', 's-stop']; // the player's settings carry over to the next battle; the start and seed are the battle's
  function start(id) {
    if (!ok(id)) id = 'waterloo';
    if (cur) {
      const keep = KEEP.map(k => [k, (document.getElementById(k) || {}).value]);
      cur.stop(); const fresh = root.cloneNode(false); fresh.innerHTML = PRISTINE; root.replaceWith(fresh); root = fresh;
      for (const [k, v] of keep) { const el = document.getElementById(k); if (el && [...el.options].some(o => o.value === v)) el.value = v; }
    }
    try { localStorage.setItem('napoleon.battle', id); } catch (e) { }
    cur = bootGame(id); boots.push(cur); window.scrollTo(0, 0);
  }
  let first = ''; try { first = (location.hash || '').slice(1); } catch (e) { }
  if (!ok(first)) { try { first = localStorage.getItem('napoleon.battle') || ''; } catch (e) { } }
  globalThis.WApp = { start, battles, boots, get current() { return cur && cur.id; } }; // (WGame is each battle's own test hooks)
  start(ok(first) ? first : 'waterloo');
  return globalThis.WApp;
})();"""
html = (head.replace('__TITLE__', "Napoleon's Command") + '\n<div id="game-root">\n' + R('_game_body.html') + '\n</div>\n'
        + ''.join(f'<script id="{sid(f)}">\n' + R(f) + '\n</script>\n' for f in srcs) + '<script>\n' + game + '\n' + shell + '\n</script>\n')
out = os.path.join(D, 'game.html'); open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
