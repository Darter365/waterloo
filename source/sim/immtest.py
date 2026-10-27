import os
# 8a-8d in the browser: letters, the staff, the pencil and the glass
import asyncio, time, sys
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pi.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)
dark = 'dark' in sys.argv
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': W, 'height': H}, color_scheme='dark' if dark else 'light', has_touch=W < 600)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        await pg.goto('file://' + D + 'pi.html'); await pg.wait_for_timeout(800)
        await pg.fill('#s-seed', '4242'); await pg.click('#s-go'); await pg.wait_for_timeout(400)
        print('BRIEF STAFF', (await pg.inner_text('#stopcards')).split('Nothing moves')[1][:400].replace('\n', ' | ') if 'Nothing moves' in await pg.inner_text('#stopcards') else '')
        await pg.select_option('#ob-to', 'derlon'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'ridgeEast')
        print('LETTER', (await pg.inner_text('#ob-prev')).split('Clarity')[0].replace('\n', ' | '))
        await pg.click('#ob-send')
        await pg.select_option('#r-stop', 'decide')
        for _ in range(6):
            await pg.click('#go'); t0 = time.time()
            while time.time() - t0 < 60:
                await pg.wait_for_timeout(150)
                if (await pg.inner_text('#go')) == 'Continue': break
            txt = await pg.inner_text('#stopcards')
            if 'at your side' in txt or 'Sire,' in txt: break
        print('STOP at', await pg.inner_text('#clock')); print((await pg.inner_text('#stopcards'))[:1200].replace('\n', ' | '))
        el = await pg.query_selector('#stopcards'); await el.screenshot(path=D + f'pi_stop_{W}{"_dark" if dark else ""}.png')
        # pencil: draw a line and write a note
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView()"); await pg.wait_for_timeout(300)
        box = await (await pg.query_selector('#map')).bounding_box()
        cx, cy = box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5
        await pg.click('#penctl button[data-pen=line]')
        await pg.mouse.move(cx - 80, cy); await pg.mouse.down(); 
        for k in range(12): await pg.mouse.move(cx - 80 + k * 12, cy - k * 4)
        await pg.mouse.up()
        await pg.click('#penctl button[data-pen=note]'); await pg.mouse.click(cx + 40, cy + 40); await pg.wait_for_timeout(100)
        await pg.fill('#pennote-in', 'Prussians here?'); await pg.press('#pennote-in', 'Enter')
        await pg.click('#penctl button[data-pen=note]')
        print('MARKS', await pg.evaluate('JSON.stringify(WGame.marks ? WGame.marks() : null)'))
        await pg.screenshot(path=D + f'pi_pencil_{W}{"_dark" if dark else ""}.png')
        # the glass, at La Haye Sainte
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView()"); await pg.wait_for_timeout(300); box = await (await pg.query_selector('#map')).bounding_box()
        await pg.click('#glassbtn'); await pg.wait_for_timeout(100)
        pt = await pg.evaluate("(() => { const s = WGame.screenOf('lhs'); return s; })()")
        await pg.mouse.click(box['x'] + pt[0], box['y'] + pt[1]); await pg.wait_for_timeout(1500)
        print('GLASS', (await pg.inner_text('#glasscap')).replace('\n', ' | '))
        await pg.screenshot(path=D + f'pi_glass_{W}{"_dark" if dark else ""}.png')
        await pg.click('#glassoff')
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
