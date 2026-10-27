import os
import asyncio, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pd.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1440, 'height': 900})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        await pg.goto('file://' + D + 'pd.html'); await pg.wait_for_timeout(800)
        await pg.select_option('#s-scen', '0500'); await pg.fill('#s-seed', '808'); await pg.click('#s-go'); await pg.wait_for_timeout(400)
        print('CLOCK', await pg.inner_text('#clock')); print('BRIEF', (await pg.inner_text('#stopcards'))[:400].replace('\n', ' | '))
        await pg.screenshot(path=D + 'pd_0500.png')
        await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'advance'); await pg.select_option('#ob-obj', 'depOwn')
        print('PREVIEW', (await pg.inner_text('#ob-prev')).replace('\n', ' | '))
        await pg.click('#ob-send')
        await pg.select_option('#ob-to', 'derlon'); await pg.select_option('#ob-act', 'advance'); await pg.select_option('#ob-obj', 'depOwn'); await pg.click('#ob-send')
        await pg.select_option('#r-stop', 'decide')
        while (await pg.inner_text('#clock')) < '08:00':
            await pg.select_option('#r-to', '480'); await pg.click('#r-go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(150)
                if (await pg.inner_text('#go')) == 'Continue': break
        print('AT', await pg.inner_text('#clock')); print('STOP', (await pg.inner_text('#stopcards'))[:900].replace('\n', ' | '))
        print('ORDERS', (await pg.inner_text('#orders'))[:500].replace('\n', ' | '))
        await pg.screenshot(path=D + 'pd_0800.png')
        await pg.evaluate('WGame.runToEnd()'); await pg.wait_for_timeout(500)
        t0 = time.time()
        while time.time() - t0 < 120:
            if (await pg.inner_text('#aar-prog')).startswith('All'): break
            await pg.wait_for_timeout(500)
        print(await pg.inner_text('#aar-check')); print((await pg.inner_text('#aar-head')).replace('\n', ' | ')[:600])
        await (await pg.query_selector('#aar-chart')).screenshot(path=D + 'pd_chart.png')
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
