import os
# (9) the colour map: screenshots of both styles at the same moment, desktop and phone, and no page errors
import asyncio, time, sys
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pm.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': W, 'height': H}, has_touch=W < 600)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        await pg.goto('file://' + D + 'pm.html'); await pg.wait_for_timeout(800)
        await pg.fill('#s-seed', '4242'); await pg.click('#s-go'); await pg.wait_for_timeout(400)
        await pg.select_option('#ob-to', 'derlon'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'ridgeEast'); await pg.click('#ob-send')
        await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont'); await pg.click('#ob-send')
        await pg.select_option('#r-stop', 'decide')
        while (await pg.inner_text('#clock')) < '15:30':
            await pg.click('#go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(120)
                if (await pg.inner_text('#go')) in ('Continue', 'The verdict'): break
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView()"); await pg.wait_for_timeout(300)
        el = await pg.query_selector('#mapbox')
        await el.screenshot(path=D + f'pm_paper_{W}.png')
        await pg.evaluate("document.querySelector('#hqbox') && document.querySelector('#hqbox').closest('details') && (document.querySelector('#hqbox').closest('details').open = true)")
        await pg.select_option('#h-map', 'colour'); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView()"); await pg.wait_for_timeout(300)
        await el.screenshot(path=D + f'pm_colour_{W}.png')
        await pg.click('#zfit'); await pg.wait_for_timeout(1500); await el.screenshot(path=D + f'pm_colour_fit_{W}.png')
        await pg.select_option('#h-map', 'paper'); await pg.wait_for_timeout(1200); await el.screenshot(path=D + f'pm_paper_fit_{W}.png')
        await pg.select_option('#h-map', 'colour'); await pg.wait_for_timeout(600)
        print('clock', await pg.inner_text('#clock'), 'errors', errs[:5])
        await b.close()
asyncio.run(main())
