import os
# (9) !! alarms: they appear in the notices and on the map, a mark opens its notice, and the "!! and ★" stop setting works
import asyncio, time, sys
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pa.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)
dark = 'dark' in sys.argv
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': W, 'height': H}, color_scheme='dark' if dark else 'light', has_touch=W < 600)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + D + 'pa.html'); await pg.wait_for_timeout(800)
        await pg.fill('#s-seed', '4242'); await pg.click('#s-go'); await pg.wait_for_timeout(400)
        await pg.select_option('#ob-to', 'derlon'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'ridgeEast'); await pg.click('#ob-send')
        await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont'); await pg.click('#ob-send')
        await pg.select_option('#r-stop', 'alarm')
        found = 0; stops = 0
        while stops < 40 and found < 2:
            await pg.click('#go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(120)
                if (await pg.inner_text('#go')) in ('Continue', 'The verdict'): break
            stops += 1
            txt = await pg.inner_text('#stopcards')
            if '!!' in txt:
                found += 1
                print('STOP', await pg.inner_text('#clock'), '|', ' | '.join(l for l in txt.split('\n') if '!!' in l)[:500])
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView()"); await pg.wait_for_timeout(300)
        marks = await pg.evaluate('JSON.stringify(WGame.alarmMarks())'); print('MARKS', marks[:400])
        import json; ms = json.loads(marks)
        if ms:
            box = await (await pg.query_selector('#map')).bounding_box()
            m = ms[-1]; await pg.mouse.move(box['x'] + m['x'], box['y'] + m['y']); await pg.wait_for_timeout(200)
            print('HOVER', (await pg.inner_text('#tip'))[:300].replace('\n', ' | '))
            await pg.mouse.click(box['x'] + m['x'], box['y'] + m['y']); await pg.wait_for_timeout(300)
            sel = await pg.evaluate("(() => { const a = document.querySelector('#stopcards article.sel, #inbox li.sel'); return a ? a.innerText.slice(0, 200) : null; })()")
            print('OPENED', (sel or 'nothing selected').replace('\n', ' | '))
            el = await pg.query_selector('#mapbox'); await el.screenshot(path=D + f'pa_map_{W}{"_dark" if dark else ""}.png')
        print('stops', stops, 'errors', errs[:5])
        await b.close()
asyncio.run(main())
