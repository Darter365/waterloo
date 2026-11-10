import os
# the field in relief (3D umpire's view) at phone size: hidden on Napoleon's map during play, opens on the umpire's map, draws every
# brigade the contract's truth snapshot holds, glides between ticks, and opens after the battle on Napoleon's map
import asyncio, sys
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pv.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
OPEN = "document.getElementById('s-more').open = true"
async def start(pg, mode):
    await pg.goto('file://' + D + 'pv.html'); await pg.wait_for_timeout(800)
    await pg.evaluate(OPEN); await pg.select_option('#s-map', mode); await pg.fill('#s-seed', '4242'); await pg.tap('#s-go'); await pg.wait_for_timeout(500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
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
        await pg.evaluate("WGame.v3Stand(3350, 5150, 0.1)"); await pg.tap('#v3g'); await pg.wait_for_timeout(500); e = await pg.evaluate("WGame.v3Eye()")
        print('GROUND', 'OK' if e['ground'] and 5 < e['y'] - e['floor'] < 30 and e['fov'] == 60 and e['trees'] > 200 and e['shrubs'] > 50 else 'BAD', {k: round(v, 1) if isinstance(v, float) else v for k, v in e.items()})
        await shot('v3_4_ground'); await pg.evaluate("WGame.v3Stand(2450, 4900, 0.0)"); await pg.wait_for_timeout(400); await shot('v3_5_ground_wood')
        pr = await pg.evaluate("WGame.v3Probe(0, -0.6)"); print('INSIDE', 'OK' if pr and pr['dist'] > 25 else 'BAD', pr)  # standing in a brigade's block, the block is not drawn
        await pg.tap('#v3g'); await pg.wait_for_timeout(300); e = await pg.evaluate("WGame.v3Eye()"); print('ABOVE', 'OK' if not e['ground'] and e['y'] - e['floor'] > 300 else 'BAD')
        await pg.evaluate("WGame.v3Cam(0.3, 1.1, 2600)"); await pg.evaluate("WGame.v3Stand(2600, 4300, 0.3)"); await pg.wait_for_timeout(400); await shot('v3_6_trees_above')
        await pg.tap('#v3x'); await pg.wait_for_timeout(200); v = await pg.evaluate("WGame.v3()"); print('CLOSE', 'OK' if not v['on'] else 'BAD')
        # 4. Napoleon's map after the battle: now the picture may be shown
        await start(pg, 'napoleon'); await pg.evaluate("WGame.fightOut('mine')")
        for i in range(240):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("WGame.phase() === 'over'"): break
        await pg.wait_for_timeout(300); r = await pg.evaluate("WGame.v3Open()"); await pg.wait_for_timeout(1200); v = await pg.evaluate("WGame.v3()")
        print('AFTER', 'OK' if v['button'] and r and v['on'] and v['units'] > 30 else 'BAD', v['button'], r, v['units'], v['err'])
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView({block: 'start'})"); await pg.evaluate("WGame.v3Cam(-0.4, 1.0, 5200)"); await pg.wait_for_timeout(500); await shot('v3_3_after')
        print('errors', errs[:6])
        await b.close()
asyncio.run(main())
