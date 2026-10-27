import os
# 5e check: replay the second playtest's orders in the built game and record what the player sees
import asyncio, json, re, sys, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'p6.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)
SETC = "(vals => { const ss = () => [...document.querySelectorAll('#ob select')].filter(s => !s.id); vals.forEach((v, i) => { if (v != null) { const s = ss()[i]; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } }); return ss().map(s => s.value); })"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://' + D + 'p6.html'); await pg.wait_for_timeout(1200)
        await pg.fill('#s-seed', '4242'); await pg.click('#s-go'); await pg.wait_for_timeout(500)
        async def sel(s, v): await pg.select_option(s, v); await pg.wait_for_timeout(60)
        async def click(s): await pg.click(s); await pg.wait_for_timeout(80)
        async def setc(vals): return await pg.evaluate(SETC + '(' + json.dumps(vals) + ')')
        async def prev(): return (await pg.inner_text('#ob-prev')).replace('\n', ' | ')
        # 11:00 orders, as in the playtest
        await sel('#ob-to', 'hq'); await click('#ob-send')
        await sel('#ob-to', 'grandBattery'); await sel('#ob-act', 'bombard'); await sel('#ob-obj', 'ridgeEast'); await click('#ob-send')
        await sel('#ob-to', 'reille'); await sel('#ob-act', 'bombard'); await sel('#ob-obj', 'hougoumont'); await click('#ob-then')
        await sel('#ob-act', 'attack'); await sel('#ob-obj', 'hougoumont'); await click('#ob input[value=these]'); await click('#ob input[data-wid=bauduin]'); await click('#ob input[data-wid=soye]'); await sel('#ob-loss', 'normal'); await setc([None, 'start', '30'])
        print('LETTER PREVIEW', await prev()); await click('#ob-send')
        await sel('#ob-to', 'derlon'); await sel('#ob-act', 'attack'); await sel('#ob-obj', 'ridgeEast'); await sel('#ob-form', 'attack'); await click('#ob button[data-addc=bombard]'); await setc(['grandBattery', 'ridgeEast', '45'])
        print('DERLON PREVIEW', await prev()); await click('#ob-send')
        await sel('#ob-to', 'lobau'); await sel('#ob-act', 'advance'); await sel('#ob-obj', 'eastFlank'); await click('#ob-send')
        stops = []; plan_done = set()
        async def run_until(tt):
            while True:
                if (await pg.inner_text('#go')) == 'The verdict': return
                clock = await pg.inner_text('#clock')
                if clock >= tt: return
                await pg.click('#go'); t0 = time.time()
                while time.time() - t0 < 90:
                    await pg.wait_for_timeout(100)
                    if (await pg.inner_text('#go')) in ('Continue', 'The verdict'): break
                stops.append({'clock': await pg.inner_text('#clock'), 'text': await pg.inner_text('#stopcards'), 'stars': await pg.evaluate("document.querySelectorAll('#stopcards article.decide').length")})
        await run_until('13:00')
        await sel('#ob-to', 'grouchy'); await click('#ob-send')
        # an order torn up while it is still being written
        await sel('#ob-to', 'milhaud'); await sel('#ob-act', 'advance'); await sel('#ob-obj', 'ba'); await click('#ob-send')
        await pg.evaluate("document.querySelector('[data-tear]') && document.querySelector('[data-tear]').click()"); await pg.wait_for_timeout(100)
        print('after tear:', (await pg.inner_text('#orders')).split('\n')[:3])
        await run_until('13:44')
        await sel('#ob-to', 'derlon'); await sel('#ob-act', 'rally'); await click('#ob-send')
        await run_until('14:36')
        await sel('#ob-to', 'ney'); await sel('#ob-act', 'attack'); await sel('#ob-obj', 'lhs'); await sel('#ob-loss', 'normal'); await click('#ob input[data-bring=sappers]'); await click('#ob button[data-addc=bombard]'); await setc(['grandBattery', 'lhs', '30'])
        print('NEY PREVIEW (no battery order yet)', await prev()); await click('#ob-send')
        await sel('#ob-to', 'grandBattery'); await sel('#ob-act', 'bombard'); await sel('#ob-obj', 'lhs'); await sel('#ob-site', 'here'); await click('#ob-send')
        await sel('#ob-to', 'drouot'); await sel('#ob-act', 'advance'); await sel('#ob-obj', 'plancenoit'); await click('#ob input[value=these]'); await click('#ob input[data-wid=yg1]'); await click('#ob input[data-wid=yg2]'); await click('#ob-send')
        await sel('#ob-to', 'kellermann'); await sel('#ob-act', 'hold'); await click('#ob-send')
        await pg.screenshot(path=D + 'p5e_1436.png')
        await run_until('18:18')
        await sel('#ob-to', 'drouot'); await sel('#ob-act', 'bombard'); await sel('#ob-obj', 'ridgeCentre'); await click('#ob input[value=these]'); await click('#ob input[data-wid=aGuard]'); await click('#ob-then')
        await sel('#ob-act', 'attack'); await sel('#ob-obj', 'ridgeCentre'); await click('#ob input[value=these]')
        for w in ['g3gren', 'g4gren', 'g3chas', 'g4chas']: await click(f'#ob input[data-wid={w}]')
        await sel('#ob-loss', 'heavy'); await setc([None, 'start', '30'])
        print('GUARD PREVIEW', await prev()); await click('#ob-send')
        await pg.screenshot(path=D + 'p5e_1818.png')
        await run_until('23:00')
        await pg.click('#go'); await pg.wait_for_timeout(1200)
        orders = await pg.inner_text('#orders'); verdict = await pg.inner_text('#verdict')
        await pg.screenshot(path=D + 'p5e_end.png')
        print('STOPS', len(stops), 'with a star', sum(1 for s in stops if s['stars']))
        allt = '\n'.join(s['text'] for s in stops)
        for k in ['are charging', 'Ney is', 'following Ney', 'stand on the crest', 'cleared his crest', 'wavering', 'Headquarters in danger', 'streaming back', 'letter of', 'conditions you set', 'Since my last report', 'sent him on', 'Along the front']:
            print(f'  {k!r}: {len(re.findall(re.escape(k), allt))}')
        print('ORDERS', orders.replace('\n', ' | ')[:2500])
        print('VERDICT', verdict[:700].replace('\n', ' | '))
        print('errors', errs[:8])
        json.dump(stops, open(D + 'p6_stops.json', 'w'))
        dump = await pg.evaluate("JSON.stringify({log: WGame.log(), opts: WGame.opts(), result: WGame.result(), metrics: WGame.metrics()})")
        open(D + 'p6_game.json', 'w').write(dump)
        # ---- after-action report ----
        t0 = time.time()
        while time.time() - t0 < 240:
            prog = await pg.inner_text('#aar-prog')
            if prog.startswith('All'): break
            await pg.wait_for_timeout(1000)
        print('AAR wait', round(time.time() - t0), 's:', prog)
        print('CHECK', await pg.inner_text('#aar-check'))
        print('HEAD', (await pg.inner_text('#aar-head')).replace('\n', ' | '))
        print('TABLE', (await pg.inner_text('#aar-table')).replace('\n', ' | ')[:4000])
        await pg.evaluate("document.getElementById('aar').scrollIntoView()")
        await pg.screenshot(path=D + 'p6_aar.png', full_page=False)
        el = await pg.query_selector('#aar'); await el.screenshot(path=D + 'p6_aar_full.png')
        # luck
        await pg.click('#aar-luckgo'); t0 = time.time()
        while time.time() - t0 < 300:
            prog = await pg.inner_text('#aar-prog')
            if prog.startswith('All'): break
            await pg.wait_for_timeout(1000)
        print('LUCK', round(time.time() - t0), 's:', (await pg.inner_text('#aar-luck')).replace('\n', ' | '))
        # fight again from 14:36
        opts = await pg.eval_on_selector('#aar-from', "s => [...s.options].map(o => o.value + '=' + o.textContent)")
        print('FROM options', opts[:40])
        pick = await pg.eval_on_selector('#aar-from', "s => { const o = [...s.options].find(o => +o.value >= 870 && /orders/.test(o.textContent)); s.value = o.value; return o.value; }")
        print('fighting again from', pick); await pg.click('#aar-fight'); t0 = time.time()
        while time.time() - t0 < 120:
            await pg.wait_for_timeout(300)
            if (await pg.inner_text('#go')) == 'Continue' and not (await pg.inner_text('#runtxt')).startswith('Fighting'): break
        print('REFIGHT', round(time.time() - t0, 1), 's; clock', await pg.inner_text('#clock'), '|', await pg.inner_text('#runtxt'))
        lg = await pg.evaluate("JSON.stringify(WGame.log())"); old = json.load(open(D + 'p5e_game.json'))['log'] if False else None
        print('relog entries', len(json.loads(lg)), [ (e['t'], e['k']) for e in json.loads(lg)])
        print('stop text', (await pg.inner_text('#stopcards'))[:600].replace('\n', ' | '))
        await pg.screenshot(path=D + 'p6_refight.png')
        print('errors after', errs[:8])
        await b.close()
asyncio.run(main())
