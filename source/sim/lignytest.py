# (phase 5, stage 2) Ligny in the full game: begin, two orders, ride on with stops to 16:00, hand over to the end, the verdict and the
# after-action report, whose re-run check proves the game and its re-runs set the battle up the same way. Usage: lignytest.py [page] [hist|none]
import asyncio, os, sys, time
from playwright.async_api import async_playwright
SIM = os.path.dirname(os.path.abspath(__file__)) + '/'
OUT = SIM
page = sys.argv[1] if len(sys.argv) > 1 else 'game_ligny.html'; mode = sys.argv[2] if len(sys.argv) > 2 else 'hist'
html = open(SIM + page).read()
open(OUT + 'pl.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1440, 'height': 900})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://' + OUT + 'pl.html'); await pg.wait_for_timeout(1200)
        print('TITLE', await pg.title(), '|', await pg.inner_text('#g-h1'), '|', (await pg.inner_text('#s-intro'))[:90], '|', await pg.inner_text('#s-go'))
        await pg.fill('#s-seed', '4242'); await pg.click('#s-go'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + 'l_begin.png')
        print('BRIEF', (await pg.inner_text('#stopcards'))[:700].replace('\n', ' | '))
        print('TO', await pg.eval_on_selector('#ob-to', 's => [...s.options].map(o => o.value).join(",")'))
        await pg.select_option('#ob-to', 'vandamme'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'stamand')
        print('PREVIEW', (await pg.inner_text('#ob-prev'))[:500].replace('\n', ' | '))
        await pg.click('#ob-send'); await pg.wait_for_timeout(200)
        await pg.select_option('#ob-to', 'gerard'); await pg.select_option('#ob-act', 'bombard'); await pg.select_option('#ob-obj', 'ligny'); await pg.click('#ob-send'); await pg.wait_for_timeout(200)
        print('ORDERS', (await pg.inner_text('#orders'))[:400].replace('\n', ' | ') if await pg.query_selector('#orders') else '-')
        await pg.select_option('#r-stop', 'decide')
        stops = 0
        while (await pg.inner_text('#clock')) < '16:00' and stops < 30:
            await pg.select_option('#r-to', '960'); await pg.click('#r-go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(150)
                if (await pg.inner_text('#go')) == 'Continue': break
            stops += 1
            if stops <= 3: print('STOP', await pg.inner_text('#clock'), (await pg.inner_text('#stopcards'))[:600].replace('\n', ' | '))
        print('AT', await pg.inner_text('#clock'), 'stops', stops)
        await pg.screenshot(path=OUT + 'l_1600.png')
        print('ARMY', (await pg.inner_text('#army'))[:500].replace('\n', ' | '))
        print('ENEMY', (await pg.inner_text('#enemy'))[:500].replace('\n', ' | '))
        await pg.select_option('#r-to', 'end'); await pg.click('#r-go'); await pg.wait_for_timeout(200)
        print('BOX', (await pg.inner_text('#endbox')).replace('\n', ' | ')[:300])
        await pg.check(f'input[name=endmode][value={mode}]'); await pg.click('#end-go'); t0 = time.time()
        while time.time() - t0 < 150:
            await pg.wait_for_timeout(300)
            if (await pg.inner_text('#go')) == 'The verdict': break
        print('ENDED', round(time.time() - t0, 1), 's at', await pg.inner_text('#clock'))
        print('VERDICT', (await pg.inner_text('#verdict'))[:1400].replace('\n', ' | '))
        t0 = time.time()
        while time.time() - t0 < 150:
            if (await pg.inner_text('#aar-prog')).startswith('All'): break
            await pg.wait_for_timeout(500)
        print('AARSUM', await pg.inner_text('#aar-sum'))
        print('AARCHECK', await pg.inner_text('#aar-check'))
        print('AARTABLE', (await pg.inner_text('#aar-table')).replace('\n', ' | ')[:1200])
        await pg.screenshot(path=OUT + 'l_end.png', full_page=False)
        await (await pg.query_selector('#aar')).screenshot(path=OUT + 'l_aar.png')
        print('ERRORS', errs[:8]); await b.close()
asyncio.run(main())
