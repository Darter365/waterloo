import os
# fight it out to the end: each way of handing over, then the after-action report's re-run must reproduce the battle
import asyncio, json, sys, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pe.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
modes = sys.argv[1:] or ['ney', 'hist', 'none']
async def one(p, mode):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1440, 'height': 900})).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    await pg.goto('file://' + D + 'pe.html'); await pg.wait_for_timeout(800)
    await pg.fill('#s-seed', '5150'); await pg.click('#s-go'); await pg.wait_for_timeout(300)
    await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont'); await pg.click('#ob-send')
    await pg.select_option('#ob-to', 'grandBattery'); await pg.select_option('#ob-act', 'bombard'); await pg.select_option('#ob-obj', 'ridgeEast'); await pg.click('#ob-send')
    # ride on to 14:00 with stops only for stars, continuing through stops
    await pg.select_option('#r-stop', 'decide')
    while (await pg.inner_text('#clock')) < '14:00':
        await pg.select_option('#r-to', '840'); await pg.click('#r-go')
        t0 = time.time()
        while time.time() - t0 < 60:
            await pg.wait_for_timeout(150)
            if (await pg.inner_text('#go')) == 'Continue': break
    print(mode, 'at', await pg.inner_text('#clock'))
    await pg.select_option('#r-to', 'end'); await pg.click('#r-go'); await pg.wait_for_timeout(200)
    print('  box:', (await pg.inner_text('#endbox')).replace('\n', ' | ')[:300])
    await pg.check(f'input[name=endmode][value={mode}]'); await pg.click('#end-go'); t0 = time.time()
    await pg.wait_for_timeout(1500); print('  running:', await pg.inner_text('#runtxt'), '| go disabled', await pg.is_disabled('#go'))
    while time.time() - t0 < 120:
        await pg.wait_for_timeout(300)
        if (await pg.inner_text('#go')) == 'The verdict': break
    print('  ended in', round(time.time() - t0, 1), 's at', await pg.inner_text('#clock'))
    t0 = time.time()
    while time.time() - t0 < 120:
        if (await pg.inner_text('#aar-prog')).startswith('All'): break
        await pg.wait_for_timeout(500)
    print('  ', await pg.inner_text('#aar-sum'))
    print('  ', await pg.inner_text('#aar-check'))
    print('  ', (await pg.inner_text('#aar-table')).replace('\n', ' | ')[:1500])
    v = await pg.inner_text('#verdict'); i = v.find('How your orders went'); print('  verdict orders:', v[i:i+900].replace('\n', ' | '))
    if mode == 'hist': await (await pg.query_selector('#aar')).screenshot(path=D + 'pe_hist.png')
    print('  errors', errs[:5]); await b.close()
async def main():
    async with async_playwright() as p:
        for m in modes: await one(p, m)
asyncio.run(main())
