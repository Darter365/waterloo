import os
# the field in relief (3D umpire's view) at phone size: hidden on Napoleon's map during play, opens on the umpire's map, draws every
# brigade the contract's truth snapshot holds, glides between ticks, and opens after the battle on Napoleon's map
#   python3 tools/pw.py tests/view3dtest.py [shots-folder]            the phone-size run (390 x 844)
#   python3 tools/pw.py tests/view3dtest.py desktop [shots-folder]    the desktop run (1440 x 900): the ground view's field steps
#                                                                     (wide, the eye, the glass)
import asyncio, math, sys
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # source/sim: the built page is read from there, and scratch pages are written there
html = open(D + 'game.html').read()
open(D + 'pv.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
DESKTOP = 'desktop' in sys.argv[1:]; ARGS = [a for a in sys.argv[1:] if a != 'desktop']
SHOTS = ARGS[0] if ARGS else None
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
r3 = lambda v: round(v, 3) if isinstance(v, float) else v
OPEN = "document.getElementById('s-more').open = true"
async def start(pg, mode):
    await pg.goto('file://' + D + 'pv.html'); await pg.wait_for_timeout(800)
    await pg.evaluate(OPEN); await pg.select_option('#s-map', mode); await pg.fill('#s-seed', '4242'); await pg.tap('#s-go'); await pg.wait_for_timeout(500)
async def dstart(pg, mode):  # the desktop run starts a battle with the mouse
    await pg.goto('file://' + D + 'pv.html'); await pg.wait_for_timeout(800)
    await pg.evaluate(OPEN); await pg.select_option('#s-map', mode); await pg.fill('#s-seed', '4242'); await pg.click('#s-go'); await pg.wait_for_timeout(500)
async def desktop():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=GL)
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' else None)
        shot = (lambda n: pg.screenshot(path=f'{SHOTS}/{n}.png')) if SHOTS else (lambda n: asyncio.sleep(0))
        # 1. fog, at desktop size too: on Napoleon's map during play there is no button, the view will not open and three.js is not started
        await dstart(pg, 'napoleon'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("WGame.v3()"); r = await pg.evaluate("WGame.v3Open()")
        print('DFOG', 'OK' if not v['button'] and r is False and not v['three'] and not await pg.evaluate("!!globalThis.THREE") else 'BAD', v['button'], r, v['three'])
        # 2. the umpire's map, on the ground: the field's three steps
        await dstart(pg, 'umpire'); await pg.evaluate("document.getElementById('mapbox').scrollIntoView({block: 'start'})"); await pg.wait_for_timeout(300)
        g0 = await pg.evaluate("({ f: document.getElementById('v3f').hidden })")
        await pg.click('#v3btn'); await pg.wait_for_timeout(1200); a0 = await pg.evaluate("WGame.v3Eye()"); f0 = await pg.evaluate("document.getElementById('v3f').hidden")
        await pg.click('#v3g'); await pg.wait_for_timeout(1500); g = await pg.evaluate("WGame.v3Glass()")
        # headquarters: "On the ground" opens at the commander's post as the contract gives it (or up to 80 m forward of it, where a building
        # would fill the view), at the engine's eye height, facing the enemy's centre of mass by strength; worked out here from the contract alone
        at = await pg.evaluate("WGame.v3At()"); c = await pg.evaluate("WGame.v3Contract()"); e = await pg.evaluate("WGame.v3Eye()"); co = {sd['id']: sd['coalition'] for sd in c['sides']}
        foe = [u for u in c['units'] if co[u['side']] != co[c['side']]]; sw = sum(u['str'] for u in foe); cx = sum(u['x'] * u['str'] for u in foe) / sw; cy = sum(u['y'] * u['str'] for u in foe) / sw
        d = math.hypot(cx - c['at']['x'], cy - c['at']['y']); dx = (cx - c['at']['x']) / d; dy = (cy - c['at']['y']) / d; az = math.atan2(-dx, -dy)
        off = math.hypot(at['x'] - c['at']['x'] - dx * at['step'], at['z'] - c['at']['y'] - dy * at['step']); pj = await pg.evaluate(f"WGame.v3Project({cx}, {cy}, 0)"); pr = await pg.evaluate("WGame.v3Probe(0, 0)")
        print('HQ', 'OK' if at['ground'] and at['atPost'] and off < 0.2 and 0 <= at['step'] <= 80 and abs(at['az'] - az) < 1e-6 and abs(e['y'] - e['floor'] - c['eye']) < 0.01 and c['eye'] == 2.5 and abs(pj['x']) < 0.01 and pj['z'] < 1 and (pr is None or pr['dist'] > 80) and 'at headquarters' in at['caption'] and at['second'] == 'To headquarters' else 'BAD',
              {'post': [c['at']['x'], c['at']['y']], 'eye': [r3(at['x']), r3(at['z'])], 'stepped forward m': at['step'], 'faces': r3(math.degrees(-at['az']) % 360), 'enemy centre on screen x': r3(pj['x']), 'first thing ahead m': pr and pr['dist'], 'eye height': r3(e['y'] - e['floor'])})
        # wide: 60 degrees as before, no eyepiece; the button belongs to the ground view only
        print('WIDE', 'OK' if g0['f'] and f0 and a0['fov'] == 38 and g['button'] and g['field'] == 'wide' and g['fov'] == 60 and not g['mask'] and 'wide view' in g['caption'] and g['sway'] == [0, 0] else 'BAD', {k: r3(g[k]) for k in ('field', 'fov', 'mask', 'label', 'h', 'w')})
        await shot('v3d_1_wide')
        # the eye: one pixel at the centre spans one minute of arc, tan(f/2) = h tan(1') / 2 (kept between 8 and 60 degrees); a screen correction, and the caption says so
        await pg.click('#v3f'); await pg.wait_for_timeout(500); g = await pg.evaluate("WGame.v3Glass()")
        want = min(60, max(8, 2 * math.degrees(math.atan(g['h'] * math.tan(math.radians(1 / 60)) / 2)))); px = math.degrees(math.atan(2 * math.tan(math.radians(g['fov'] / 2)) / g['h'])) * 60
        print('EYE', 'OK' if g['field'] == 'eye' and abs(g['fov'] - want) < 1e-6 and 0.99 < px < 1.01 and not g['mask'] and 'screen correction' in g['caption'] and 'not a glass' in g['caption'] and g['sway'] == [0, 0] else 'BAD', {'fov': r3(g['fov']), 'want': r3(want), 'arcmin a pixel': r3(px), 'power': r3(g['power']), 'caption': g['caption'][-60:]})
        await shot('v3d_2_eye')
        # the glass: the commander's power from the contract, tan(f/2) = tan(30 degrees) / power, in a round eyepiece; the caption states the power
        await pg.click('#v3f'); await pg.wait_for_timeout(500); g = await pg.evaluate("WGame.v3Glass()")
        P = g['glass']['power']; want = 2 * math.degrees(math.atan(math.tan(math.radians(30)) / P)); rwant = round(g['h'] / 2 * math.tan(math.radians(g['glass']['apparent'] / 2)) / math.tan(math.radians(30)))
        print('GLASS', 'OK' if g['field'] == 'glass' and P == 30 and abs(g['fov'] - want) < 1e-6 and abs(g['power'] - P) < 1e-6 and g['mask'] and g['maskR'] == rwant and f'through the glass, {P}×' in g['caption'] else 'BAD', {'power': P, 'fov': r3(g['fov']), 'want': r3(want), 'true field': g['glass']['field'], 'eyepiece radius px': g['maskR'], 'caption': g['caption'][-28:]})
        # the hand's sway is slight (never over 3% of the glass's field) and repeatable; held still for the checks that follow
        sw = []
        for i in range(6): await pg.wait_for_timeout(180); sw.append((await pg.evaluate("WGame.v3Glass()"))['sway'])
        lim = math.radians(0.03 * g['glass']['field']); big = max(max(abs(a), abs(b)) for a, b in sw); moved = len({tuple(x) for x in sw}) > 1
        await pg.evaluate("WGame.v3Still(true)"); await pg.wait_for_timeout(200); st = (await pg.evaluate("WGame.v3Glass()"))['sway']
        print('SWAY', 'OK' if moved and 0 < big <= lim * 1.0001 and st == [0, 0] else 'BAD', {'largest, degrees': round(math.degrees(big), 4), 'limit': round(math.degrees(lim), 4), 'still': st})
        # aiming: a drag turns the eye by 0.004 radians a pixel in the wide view, and by that over the power through the glass
        box = await pg.evaluate("(() => { const r = document.getElementById('v3c').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
        async def drag(dx):
            a = await pg.evaluate("WGame.v3At()"); await pg.mouse.move(box[0], box[1]); await pg.mouse.down(); await pg.mouse.move(box[0] + dx / 2, box[1], steps=4); await pg.mouse.move(box[0] + dx, box[1], steps=4); await pg.mouse.up(); await pg.wait_for_timeout(120)
            return (await pg.evaluate("WGame.v3At()"))['az'] - a['az']
        dg = await drag(120); await shot('v3d_3_glass'); await pg.evaluate("WGame.v3Field('wide')"); await pg.wait_for_timeout(200); dw = await drag(120)
        print('AIM', 'OK' if abs(dw - 120 * 0.004) < 1e-6 and abs(dg - 120 * 0.004 / P) < 1e-6 else 'BAD', {'wide, radians for 120 px': r3(dw), 'glass': round(dg, 5), 'ratio': r3(dw / dg) if dg else None})
        # the steps go round: wide, the eye, the glass, wide; and from above the field is as it was
        seq = []
        for i in range(3): await pg.click('#v3f'); await pg.wait_for_timeout(150); seq.append((await pg.evaluate("WGame.v3Glass()"))['field'])
        await pg.click('#v3g'); await pg.wait_for_timeout(1200); a1 = await pg.evaluate("WGame.v3Eye()"); f1 = await pg.evaluate("document.getElementById('v3f').hidden"); m1 = (await pg.evaluate("WGame.v3Glass()"))['mask']
        print('STEPS', 'OK' if seq == ['eye', 'glass', 'wide'] and a1['fov'] == 38 and not a1['ground'] and f1 and not m1 else 'BAD', seq, a1['fov'], f1, m1)
        # walking leaves headquarters (the caption stops saying so); the second button goes back; and from above the second button steps down
        # where the view is centred, as the ground view first worked
        await pg.click('#v3g'); await pg.wait_for_timeout(1200); await pg.mouse.move(box[0], box[1]); await pg.mouse.wheel(0, -100); await pg.wait_for_timeout(200); w1 = await pg.evaluate("WGame.v3At()")
        await pg.click('#v3h'); await pg.wait_for_timeout(200); w2 = await pg.evaluate("WGame.v3At()")
        await pg.click('#v3g'); await pg.wait_for_timeout(1200); up = await pg.evaluate("WGame.v3At()"); await pg.evaluate("WGame.v3Stand(3350, 5250, 0.05)"); await pg.click('#v3h'); await pg.wait_for_timeout(1500); w3 = await pg.evaluate("WGame.v3At()"); e3 = await pg.evaluate("WGame.v3Eye()")
        print('WALK', 'OK' if not w1['atPost'] and math.hypot(w1['x'] - at['x'], w1['z'] - at['z']) > 50 and 'headquarters' not in w1['caption'] and w2['atPost'] and math.hypot(w2['x'] - at['x'], w2['z'] - at['z']) < 0.01 and abs(w2['az'] - az) < 1e-6 else 'BAD', {'walked m': r3(math.hypot(w1['x'] - at['x'], w1['z'] - at['z'])), 'back at post': w2['atPost']})
        print('STEPDOWN', 'OK' if up['second'] == 'Step down here' and not up['ground'] and w3['ground'] and not w3['atPost'] and abs(w3['x'] - 3350) < 0.01 and abs(w3['z'] - 5250) < 0.01 and abs(w3['az'] - 0.05) < 1e-9 and abs(e3['y'] - e3['floor'] - 2.5) < 0.01 else 'BAD', [w3['x'], w3['z'], w3['az'], w3['atPost']])
        print('errors', errs[:6])
        await b.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=GL)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' else None)
        shot = (lambda n: pg.screenshot(path=f'{SHOTS}/{n}.png')) if SHOTS else (lambda n: asyncio.sleep(0))
        # 1. Napoleon's map, during play: no button, and the view refuses to open; three.js has not been started
        await start(pg, 'napoleon'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("WGame.v3()"); r = await pg.evaluate("WGame.v3Open()")
        print('FOG', 'OK' if not v['button'] and r is False and not v['three'] else 'BAD', v['button'], r, v['three'])
        # 2. the umpire's map: the button shows, the view opens and draws what the truth snapshot holds
        await start(pg, 'umpire'); await pg.evaluate("document.getElementById('mapbox').scrollIntoView({block: 'start'})"); await pg.wait_for_timeout(300)
        await pg.tap('#v3btn'); await pg.wait_for_timeout(1500)
        v = await pg.evaluate("WGame.v3()"); n = await pg.evaluate("WGame.sim ? 0 : 0")
        print('OPEN', 'OK' if v['on'] and not v['err'] and v['units'] > 50 and v['units'] == v['shown'] and v['tris'] > 5000 and v['frames'] > 3 else 'BAD', {k: v[k] for k in ('on', 'err', 'units', 'shown', 'tris', 'frames')})
        await shot('v3_1_open')
        px = await pg.evaluate("(() => { const c = document.getElementById('v3c'), g = c.getContext('webgl2') || c.getContext('webgl'); return [c.width, c.height]; })()")
        print('CANVAS', 'OK' if px[0] >= 390 and px[1] > 300 else 'BAD', px)
        # 3. time runs: the blocks follow the ticks, and between ticks they stand between the last picture and the new one
        await pg.evaluate("WGame.v3Close()"); pos = await pg.evaluate("WGame.tapOf('derlon', 'ridgeCentre')")
        await pg.touchscreen.tap(pos['x'], pos['y']); await pg.wait_for_timeout(250); await pg.tap('#strip [data-act=attack]'); await pg.wait_for_timeout(150)
        await pg.touchscreen.tap(pos['hx'], pos['hy']); await pg.wait_for_timeout(250); await pg.tap('#strip [data-strip=send]'); await pg.wait_for_timeout(200)
        await pg.select_option('#r-speed', '240')
        await pg.evaluate("WGame.v3Open()"); await pg.tap('#go'); mids = 0; still = 0; last = -1; t0 = (await pg.evaluate("WGame.v3()"))['tick']
        for i in range(420):
            await pg.wait_for_timeout(70); v = await pg.evaluate("WGame.v3()"); f = v['mover']
            if f and f['d'] > 20:
                along = ((f['x'] - f['px']) * (f['cx'] - f['px']) + (f['z'] - f['py']) * (f['cy'] - f['py'])) / (f['d'] ** 2)
                if 0.03 < along < 0.97: mids += 1
            still = still + 1 if v['tick'] == last else 0; last = v['tick']
            if still >= 8:  # the clock stopped for news: ride on
                still = 0
                try: await pg.tap('#go', timeout=1500)
                except Exception: pass
            if mids >= 5: break
        v = await pg.evaluate("WGame.v3()")
        print('TICKS', 'OK' if v['tick'] > t0 and v['on'] and mids > 0 else 'BAD', t0, '->', v['tick'], '| frames', v['frames'], '| seen mid-glide', mids, '| smoke lumps', v['smoke'])
        await pg.evaluate("WGame.v3Cam(0.5, 1.15, 3600)"); await pg.wait_for_timeout(400); await shot('v3_2_running')
        # on the ground: the eye comes down to a rider's height, looks level, and walks forward on a pinch or scroll
        await pg.evaluate("WGame.v3Stand(3350, 5250, 0.05)"); await pg.tap('#v3g'); await pg.wait_for_timeout(1500); e = await pg.evaluate("WGame.v3Eye()")
        hq = await pg.evaluate("WGame.v3At()"); c = await pg.evaluate("WGame.v3Contract()")  # "On the ground" now opens at headquarters, not where the view from above was centred
        print('HQ', 'OK' if hq['atPost'] and math.hypot(hq['x'] - c['at']['x'], hq['z'] - c['at']['y']) <= hq['step'] + 0.2 <= 80.2 and 'at headquarters' in hq['caption'] else 'BAD', [c['at']['x'], c['at']['y']], [r3(hq['x']), r3(hq['z'])], hq['step'])
        print('GROUND', 'OK' if e['ground'] and abs(e['y'] - e['floor'] - 2.5) < 0.01 and e['ex'] == 1 and e['treeH'] <= 25 and e['blockH'] <= 2 and e['fov'] == 60 and e['trees'] > 2000 and e['shrubs'] > 300 else 'BAD', {k: round(v, 1) if isinstance(v, float) else v for k, v in e.items()})
        k = await pg.evaluate("WGame.v3Sky()")
        print('LIGHT', 'OK' if k['alt'] > 50 and 120 < k['bearing'] < 240 and k['sun'] > 0.4 and k['tufts'] == 4096 and k['step'] == 1 and 3000 < k['fogFar'] <= 20000 else 'BAD', {a: (round(b, 2) if isinstance(b, float) else b) for a, b in k.items()})
        # the field's steps at phone size: the eye keeps one minute of arc a pixel (or its 8 degree floor), and the eyepiece fits the screen
        await pg.tap('#v3f'); await pg.wait_for_timeout(400); g = await pg.evaluate("WGame.v3Glass()"); want = min(60, max(8, 2 * math.degrees(math.atan(g['h'] * math.tan(math.radians(1 / 60)) / 2)))); ok = g['field'] == 'eye' and abs(g['fov'] - want) < 1e-6
        await pg.tap('#v3f'); await pg.wait_for_timeout(400); g = await pg.evaluate("WGame.v3Glass()"); want = 2 * math.degrees(math.atan(math.tan(math.radians(30)) / g['glass']['power']))
        print('FIELD', 'OK' if ok and g['field'] == 'glass' and abs(g['fov'] - want) < 1e-6 and g['mask'] and 0 < g['maskR'] <= min(g['w'], g['h']) / 2 and 'through the glass' in g['caption'] else 'BAD', {'eye': ok, 'glass fov': r3(g['fov']), 'eyepiece radius px': g['maskR'], 'box': [g['w'], g['h']]})
        await shot('v3_4b_glass'); await pg.evaluate("WGame.v3Field('wide')"); await pg.wait_for_timeout(300)
        await shot('v3_4_ground'); await pg.evaluate("WGame.v3Stand(2470, 4760, 0.0)"); await pg.wait_for_timeout(400); await shot('v3_5_ground_wood')
        pr = await pg.evaluate("WGame.v3Probe(0, -0.6)"); print('INSIDE', 'OK' if pr and pr['unit'] is None else 'BAD', pr)  # standing in a brigade's block, the block is not drawn
        await pg.tap('#v3g'); await pg.wait_for_timeout(1200); e = await pg.evaluate("WGame.v3Eye()"); print('ABOVE', 'OK' if not e['ground'] and e['y'] - e['floor'] > 300 and e['ex'] == 3 and e['trees'] < 1000 else 'BAD', e['ex'], e['trees'])
        await pg.evaluate("WGame.v3Cam(0.3, 1.1, 2600)"); await pg.evaluate("WGame.v3Stand(2600, 4300, 0.3)"); await pg.wait_for_timeout(400); await shot('v3_6_trees_above')
        await pg.tap('#v3x'); await pg.wait_for_timeout(200); v = await pg.evaluate("WGame.v3()"); print('CLOSE', 'OK' if not v['on'] else 'BAD')
        # 4. Napoleon's map after the battle: now the picture may be shown
        await start(pg, 'napoleon'); await pg.evaluate("WGame.fightOut('mine')")
        for i in range(240):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("WGame.phase() === 'over'"): break
        await pg.wait_for_timeout(300); r = await pg.evaluate("WGame.v3Open()"); await pg.wait_for_timeout(1200); v = await pg.evaluate("WGame.v3()")
        print('AFTER', 'OK' if v['button'] and r and v['on'] and v['units'] > 30 else 'BAD', v['button'], r, v['units'], v['err'])
        k = await pg.evaluate("WGame.v3Sky()"); print('NIGHT', 'OK' if k['alt'] < 0 and k['sun'] == 0 and k['sky'] < 0.3 and k['murk'] == 0 else 'BAD', {a: (round(b, 2) if isinstance(b, float) else b) for a, b in k.items()})
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView({block: 'start'})"); await pg.evaluate("WGame.v3Cam(-0.4, 1.0, 5200)"); await pg.wait_for_timeout(500); await shot('v3_3_after'); await pg.evaluate("WGame.v3Stand(3350, 5250, 0.05)"); await pg.tap('#v3g'); await pg.wait_for_timeout(1500); await shot('v3_7_ground_dusk')
        print('errors', errs[:6])
        await b.close()
asyncio.run(desktop() if DESKTOP else main())
