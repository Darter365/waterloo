import os
# release 4 in the browser, at phone size: one-tap start, the stakes in the briefing, an order written from the map, the campaign
# verdict and the causes ("why") at the end
import asyncio, sys
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pi.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
async def main():
    async with async_playwright() as p:
        kw = {'executable_path': '/usr/bin/google-chrome', 'args': ['--no-sandbox']} if os.path.exists('/usr/bin/google-chrome') else {}
        b = await p.chromium.launch(**kw); ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' else None)
        await pg.goto('file://' + D + 'pi.html'); await pg.wait_for_timeout(900)
        shot = (lambda n: pg.screenshot(path=f'{SHOTS}/{n}.png')) if SHOTS else (lambda n: asyncio.sleep(0))
        # 1. the start: the fold is shut, Begin is on the first screen
        s = await pg.evaluate("() => { const r = document.getElementById('s-go').getBoundingClientRect(), m = document.getElementById('s-more'); return { open: m.open, beginBottom: Math.round(r.bottom), vh: innerHeight, rows: [...document.querySelectorAll('#setupform > .row')].length } }")
        print('START', s, 'OK' if not s['open'] and s['beginBottom'] <= s['vh'] and s['rows'] == 2 else 'BAD')
        await shot('r4_1_start')
        await pg.evaluate("document.getElementById('s-more').open = true"); await pg.fill('#s-seed', '4242'); await pg.evaluate("document.getElementById('s-more').open = false")
        await pg.tap('#s-go'); await pg.wait_for_timeout(500)
        brief = await pg.inner_text('#stopcards')
        print('BRIEF', 'OK' if 'What the day demands' in brief else 'BAD', brief[brief.find('What the day'):][:120].replace('\n', ' '))
        # 2. an order from the map: tap one of Reille's brigades, Attack, tap Hougoumont, Send
        await pg.evaluate("document.getElementById('mapbox').scrollIntoView({block: 'start'})"); await pg.wait_for_timeout(300)
        pos = await pg.evaluate("WGame.tapOf('reille', 'hougoumont')")
        await pg.touchscreen.tap(pos['x'], pos['y']); await pg.wait_for_timeout(300)
        st = await pg.evaluate("WGame.strip()")
        print('STRIP OPEN', 'OK' if not st['hidden'] and st['to'] == 'reille' and 'Attack' in st['text'] else 'BAD', st['text'].replace('\n', ' | '))
        await shot('r4_2_strip')
        await pg.tap('#strip [data-act=attack]'); await pg.wait_for_timeout(200)
        st = await pg.inner_text('#strip'); print('STRIP PLACE', 'OK' if 'Tap the place' in st else 'BAD', st.replace('\n', ' | '))
        await pg.touchscreen.tap(pos['hx'] + 6, pos['hy'] + 5); await pg.wait_for_timeout(300)
        st = await pg.evaluate("Object.assign(WGame.strip(), { formTo: document.getElementById('ob-to').value })")
        print('STRIP READY', 'OK' if st['place'] == 'hougoumont' and st['act'] == 'attack' and 'Send' in st['text'] and 'Reille: attack Hougoumont' in st['text'] and st['formTo'] == 'reille' else 'BAD', st['text'].replace('\n', ' | '))
        await shot('r4_3_ready')
        n0 = (await pg.evaluate("WGame.strip()"))['orders']
        await pg.tap('#strip [data-strip=send]'); await pg.wait_for_timeout(300)
        st = await pg.evaluate("WGame.strip()"); st['n'] = st['orders']
        print('STRIP SENT', 'OK' if st['n'] == n0 + 1 and st['logged'] == 1 and 'with the staff' in st['text'] else 'BAD', st['last'], '|', st['text'].replace('\n', ' | '))
        await shot('r4_4_sent')
        # a tap on open ground with the strip asking for a place marks a point; Close puts everything away
        await pg.touchscreen.tap(pos['x'], pos['y']); await pg.wait_for_timeout(200); await pg.tap('#strip [data-act=advance]'); await pg.wait_for_timeout(150)
        far = await pg.evaluate("WGame.farTap()"); await pg.touchscreen.tap(far['x'], far['y']); await pg.wait_for_timeout(200)
        st = await pg.evaluate("WGame.strip()"); print('STRIP POINT', 'OK' if st['point'] and not st['place'] and not st['pick'] and 'Send' in st['text'] else 'BAD', st['text'].replace('\n', ' | '))
        await pg.tap('#strip [data-strip=close]'); await pg.wait_for_timeout(100)
        print('STRIP CLOSE', 'OK' if await pg.evaluate("WGame.strip().hidden && !WGame.strip().pick") else 'BAD')
        # 3. fight it out with that one order, and read the verdict
        await pg.evaluate("WGame.fightOut('mine')")
        for i in range(240):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("WGame.phase() === 'over'"): break
        v = await pg.evaluate("""() => { const s = document.getElementById('stakes'); const whys = document.querySelectorAll('#verdict details.why'); const first = whys[0]; if (first) { first.open = true; for (let d = first.closest('details.inner'); d; d = d.parentElement.closest('details')) d.open = true; }
            return { grade: document.querySelector('.verdict-g').textContent, stakes: s ? s.innerText : null, whys: whys.length, firstWhy: first ? first.parentElement.textContent.slice(0, 300) : null, score: s ? +(s.querySelector('.stakes-s').textContent.split('/')[0]) : null } }""")
        print('VERDICT', v['grade'], '|', (v['stakes'] or 'NO STAKES').replace('\n', ' | ')[:420])
        print('STAKES', 'OK' if v['stakes'] and v['score'] is not None and 0 <= v['score'] <= 100 else 'BAD')
        print('WHY', 'OK' if v['whys'] > 3 and v['firstWhy'] else 'BAD', v['whys'], 'entries;', (v['firstWhy'] or '').replace('\n', ' | '))
        if SHOTS:
            await pg.evaluate("document.getElementById('verdictBox').scrollIntoView({block: 'start'})"); await pg.wait_for_timeout(400); await shot('r4_5_verdict')
        print('errors', errs[:6])
        await b.close()
asyncio.run(main())
