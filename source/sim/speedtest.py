import os
# (B1) real-time play: speeds from 1x to 1800x, the map gliding between ticks, the clock with seconds at slow speeds, stopping and
# resuming mid-tick, the speed keys, and the frame rate while the clock runs slowly
import asyncio, time, sys, json
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'ps.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': W, 'height': H}, has_touch=W < 600)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + D + 'ps.html'); await pg.wait_for_timeout(800)
        await pg.select_option('#s-map', 'umpire'); await pg.fill('#s-seed', '777'); await pg.click('#s-go'); await pg.wait_for_timeout(400)
        clock = lambda: pg.evaluate('JSON.stringify(WGame.clock())')
        opts = await pg.evaluate("[...document.querySelectorAll('#r-speed option')].map(o => o.textContent)"); print('SPEEDS', ' | '.join(opts))
        # an order so that something moves
        await pg.select_option('#ob-to', 'derlon'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'ridgeEast'); await pg.click('#ob-send')
        # ride on to 13:30 at the fastest speed, so that the armies are moving
        await pg.select_option('#r-speed', '1800'); await pg.select_option('#r-to', '810')
        for _ in range(12):
            await pg.click('#r-go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(100)
                if not json.loads(await clock())['playing']: break
            if json.loads(await clock())['t'] >= 810: break
            await pg.select_option('#r-to', '810')
        print('RODE', 'to', json.loads(await clock())['t'] // 60, 'h')
        await pg.select_option('#r-speed', '30')
        await pg.click('#go'); await pg.wait_for_timeout(300)
        c0 = json.loads(await clock()); txt0 = await pg.inner_text('#clock')
        # count frames drawn over two seconds
        fps = await pg.evaluate("new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); })")
        c1 = json.loads(await clock()); txt1 = await pg.inner_text('#clock')
        print('SLOW', f"speed {c1['speed']}x tick {c1['tickMs']:.0f} ms; t {c0['t']}->{c1['t']}; shown {c0['shown']:.3f}->{c1['shown']:.3f}; clock '{txt0}'->'{txt1}'; frames/s {fps:.0f}")
        ok_slow = c1['shown'] > c0['shown'] and ':' in txt1[3:] and c1['t'] - c0['t'] <= 2
        # a unit's drawn position lies between its last two tick positions
        ids = await pg.evaluate("WGame.log() && Object.keys(WGame.metrics() || {}).length")
        mv = dict((r[0], r[1:]) for r in await pg.evaluate("WGame.lerpAll()"))
        await pg.wait_for_timeout(1200)
        c1b = json.loads(await clock())
        mv2 = dict((r[0], r[1:]) for r in await pg.evaluate("WGame.lerpAll()"))
        moved = sum(1 for k in mv if k in mv2 and mv[k] != mv2[k]) if c1b['t'] == c1['t'] else -1
        print('GLIDE', f'{moved} units moved on screen between two moments of the same tick (t {c1["t"]}, frac {c1["frac"]:.2f} -> {c1b["frac"]:.2f})')
        await pg.evaluate("document.activeElement && document.activeElement.blur()")
        # change speed mid-tick: the share of the tick already run is kept
        c2 = json.loads(await clock()); await pg.keyboard.press('Period'); c3 = json.loads(await clock())
        print('KEY', f"'.' {c2['speed']}x -> {c3['speed']}x; frac {c2['frac']:.2f} -> {c3['frac']:.2f}")
        await pg.keyboard.press('Comma'); c4 = json.loads(await clock()); print('KEY', f"',' -> {c4['speed']}x")
        # stop by hand mid-tick: the map snaps to the engine's time
        await pg.click('#go'); await pg.wait_for_timeout(200); c5 = json.loads(await clock()); txt5 = await pg.inner_text('#clock')
        print('STOP', f"playing {c5['playing']} frac {c5['frac']} shown {c5['shown']} t {c5['t']} clock '{txt5}'")
        # 1x: real time
        await pg.select_option('#r-speed', '1'); await pg.click('#go'); await pg.wait_for_timeout(2500); c6 = json.loads(await clock())
        print('REAL', f"1x: tick {c6['tickMs']/1000:.0f} s; shown advanced {(c6['shown'] - (c6['t'] - 2)) * 60:.1f} game s in 2.5 s; clock '{await pg.inner_text('#clock')}'")
        await pg.click('#go'); await pg.wait_for_timeout(200)
        # 480x until the first stop for news
        await pg.select_option('#r-speed', '480'); t0 = time.time(); ta = json.loads(await clock())['t']; await pg.click('#go')
        while time.time() - t0 < 30:
            await pg.wait_for_timeout(100)
            if not json.loads(await clock())['playing']: break
        tb = json.loads(await clock())['t']; el = time.time() - t0
        print('FAST', f"480x: {tb - ta} game minutes in {el:.1f} s real (expected at most {8 * el + 2:.0f}: 8 a second, plus the first tick at once)")
        sp = await pg.evaluate("localStorage.getItem('waterloo.speed')"); print('SAVED', sp)
        # stop settings: only 'a farm or village changes hands'
        await pg.select_option('#r-stop', 'custom'); await pg.wait_for_timeout(100)
        vis = await pg.is_visible('#r-custom')
        for k in ['rider', 'sight', 'star', 'alarm', 'hq']: await pg.uncheck(f'#r-custom input[value="{k}"]')
        await pg.check('#r-custom input[value="place"]')
        await pg.select_option('#r-speed', '1800'); t0 = time.time(); ta = json.loads(await clock())['t']; await pg.click('#go')
        while time.time() - t0 < 90:
            await pg.wait_for_timeout(150)
            if not json.loads(await clock())['playing']: break
        kinds = json.loads(await pg.evaluate('JSON.stringify(WGame.stopKinds())')); tb = json.loads(await clock())['t']
        stopped_on_place = all('place' in k for k in kinds[-1:]) and any('place' in k for k in kinds)
        print('STOPFOR', f"custom (places only): ran {ta}->{tb}; panel shown {vis}; news at the stop by kind: {kinds[-4:]}")
        el = await pg.query_selector('#runbar'); await el.screenshot(path=D + f'ps_runbar_{W}.png')
        print('CHECK', 'slow clock runs with seconds:', ok_slow, '| glide:', moved > 0, '| speed keys:', c3['speed'] == 60 and c4['speed'] == 30, '| stop snaps:', c5['frac'] == 1 and c5['shown'] == c5['t'], '| real time:', 0.5 < (c6['shown'] - (c6['t'] - 2)) * 60 < 6, '| stop for places:', vis and (stopped_on_place or tb >= 1288))
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
