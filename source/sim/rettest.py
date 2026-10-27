import os
# the general retreat in the browser: give it at 14:00 with the Guard as rearguard, fight on to the end, check the verdict and the re-run
import asyncio, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pr.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1440, 'height': 900})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        await pg.goto('file://' + D + 'pr.html'); await pg.wait_for_timeout(800)
        await pg.fill('#s-seed', '31'); await pg.click('#s-go'); await pg.wait_for_timeout(300)
        await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont'); await pg.click('#ob-send')
        await pg.select_option('#r-stop', 'decide')
        while (await pg.inner_text('#clock')) < '14:00':
            await pg.select_option('#r-to', '840'); await pg.click('#r-go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(150)
                if (await pg.inner_text('#go')) == 'Continue': break
        await pg.select_option('#ob-to', 'army'); await pg.wait_for_timeout(100)
        print('ACTS', await pg.eval_on_selector('#ob-act', 's => [...s.options].map(o => o.textContent)'))
        print('PREVIEW', (await pg.inner_text('#ob-prev')).replace('\n', ' | '))
        await pg.screenshot(path=D + 'pr_order.png')
        await pg.click('#ob-send'); await pg.wait_for_timeout(200)
        print('SENT', await pg.inner_text('.sentnote'))
        print('ORDERS', (await pg.inner_text('#orders')).replace('\n', ' | ')[:700])
        # run to the end with stops for stars only, continuing at each stop
        t0 = time.time()
        while time.time() - t0 < 300:
            if (await pg.inner_text('#go')) == 'The verdict': break
            if (await pg.inner_text('#go')) == 'Continue': await pg.click('#go')
            await pg.wait_for_timeout(300)
        print('END', await pg.inner_text('#clock'))
        v = await pg.inner_text('#verdict'); print('VERDICT', v[:500].replace('\n', ' | '))
        t0 = time.time()
        while time.time() - t0 < 120:
            if (await pg.inner_text('#aar-prog')).startswith('All'): break
            await pg.wait_for_timeout(500)
        print(await pg.inner_text('#aar-check'))
        print((await pg.inner_text('#aar-table')).replace('\n', ' | ')[:900])
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
