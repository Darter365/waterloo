# (phase 5) one app, several battles: switch Waterloo -> Ligny -> Waterloo -> Ligny on the start screen and check that each battle's page
# comes up whole, the player's settings carry over, the stopped battles' loops have ended, and a battle then plays without errors
import asyncio, os, sys, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'ps.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1440, 'height': 900})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://' + D + 'ps.html'); await pg.wait_for_timeout(1200)
        async def state():
            return await pg.evaluate("() => ({ cur: WApp.current, h1: document.getElementById('g-h1').textContent, to: [...document.querySelectorAll('#ob-to option')].map(o => o.value).join(','), start: document.getElementById('s-go').textContent, map: document.getElementById('s-map').value, roots: document.querySelectorAll('#game-root').length, boots: WApp.boots.length })")
        print('BATTLES', await pg.eval_on_selector('#s-battle', 's => [...s.options].map(o => o.value + "=" + o.textContent).join(" | ")'))
        print('FIRST', await state())
        await pg.select_option('#s-map', 'umpire')
        for bid in ['ligny', 'waterloo', 'ligny']:
            await pg.select_option('#s-battle', bid); await pg.wait_for_timeout(1000); print('SWITCH', bid, await state())
        f0 = await pg.evaluate("() => WApp.boots.map(b => b.frames())"); await pg.wait_for_timeout(1000); f1 = await pg.evaluate("() => WApp.boots.map(b => b.frames())")
        print('FRAMES', f0, f1, 'only the last runs:', all(a == b for a, b in zip(f0[:-1], f1[:-1])) and f1[-1] > f0[-1])
        await pg.click('#s-go'); await pg.wait_for_timeout(500)
        await pg.select_option('#ob-to', 'vandamme'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'stamand'); await pg.click('#ob-send'); await pg.wait_for_timeout(200)
        await pg.select_option('#r-to', '960'); await pg.click('#r-go'); t0 = time.time()
        while time.time() - t0 < 60:
            await pg.wait_for_timeout(200)
            if (await pg.inner_text('#go')) == 'Continue': break
        print('PLAYED to', await pg.inner_text('#clock'), '|', (await pg.inner_text('#stopcards'))[:160].replace('\n', ' | '))
        print('errors', errs[:8]); await b.close()
asyncio.run(main())
