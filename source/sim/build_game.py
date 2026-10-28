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
head = ('<title>Napoleon at Waterloo</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Monsieur+La+Doulaise&display=swap">\n'
        '<style>\n' + R('_css_base.css') + '\n' + R('_css_viewer.css') + '\n' + R('_css_game.css') + '</style>\n')
imports = "const { LAT0, LON0, MLAT, MLON, NX, NY, CELL, WM, HM, ll2m, m2ll, H, LM, ROADS, SUNKEN, HEDGES, WOODS, BUILDINGS, ENCLOSURES, SANDPIT, VILLAGES, HOUSES, LABELS, EDGE_LABELS, STREAMS, NAT, DEBATED, LION, rng, hashStr } = WData;"
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
game = '\n'.join([
    "(() => {", "'use strict';", imports,
    '/* ================= terrain (from the map) ================= */', L(207, 315),
    '/* ================= obstacles ================= */', L(581, 588),
    L(598, 615), view, L(637, 766), live, L(1027, 1075),
    R('_shared_draw.js'), R('_interact.js'), R('_game.js'), R('_game_orders.js'), R('_game_disp.js'), R('_game_letters.js'), R('_game_staff.js'), R('_game_pencil.js'), R('_game_alarm.js'), R('_game_mapstyle.js'), R('_game_glass.js'), R('_game_aar.js'), R('_game_review.js'), R('_game_end.js'), R('_game_boot.js'), '})();'])
# the packs first (registry, then eras, nations, leaders, battles: the order packs/all.js loads them in node), then the engine
PACKS = ['packs/registry.js', 'packs/eras/napoleonic.js', 'packs/eras/medieval-test.js', 'packs/nations/napoleonic.js', 'packs/leaders/napoleonic.js', 'packs/maps/toy-ridge.js', 'packs/oob/toy-ridge.js', 'packs/maps/ligny.js', 'packs/oob/ligny.js', 'packs/battles/waterloo.js', 'packs/battles/toy-ridge.js', 'packs/battles/ligny.js']
srcs = PACKS + ['data.js', 'engine.js', 'ai.js', 'command.js', 'orders.js', 'plans.js', 'script.js', 'doctrine.js', 'replay.js']
sid = lambda f: 'src-' + f[:-3].replace('/', '-')
# each engine script carries an id so the after-action report's re-run worker can be built from the same source (step 6);
# the worker takes every script whose id starts "src-", in page order
html = head + '\n' + R('_game_body.html') + '\n' + ''.join(f'<script id="{sid(f)}">\n' + R(f) + '\n</script>\n' for f in srcs) + '<script>\n' + game + '\n</script>\n'
assert '</script' not in ''.join(R(f) for f in srcs) + game
assert open(os.path.join(D, 'packs', 'all.js')).read().count('require(') == len(PACKS), 'packs/all.js and PACKS disagree'
out = os.path.join(D, 'game.html'); open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
