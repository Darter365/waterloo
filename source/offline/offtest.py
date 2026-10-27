import os
# the offline release: serve it, let the service worker cache it, go offline, reload, and play a little
import asyncio, subprocess, time, sys
from playwright.async_api import async_playwright
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); reqs = []
            pg.on('request', lambda r: reqs.append(r.url) if not r.url.startswith('http://localhost:8765') and not r.url.startswith('data:') and not r.url.startswith('blob:') else None)
            await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(1500)
            ready = await pg.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
            print('service worker active', ready, '| external requests', reqs[:5])
            fonts = await pg.evaluate("document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.style + ' ' + f.weight))")
            print('fonts loaded', fonts)
            await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(1500)
            print('offline reload title', await pg.title(), '| setup visible', await pg.is_visible('#s-go'))
            await pg.fill('#s-seed', '99'); await pg.click('#s-go'); await pg.wait_for_timeout(500)
            await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont')
            await pg.screenshot(path=SITE + '/../off_phone_order.png')
            await pg.click('#ob-send'); await pg.evaluate('WGame.runToEnd()'); await pg.wait_for_timeout(500)
            t0 = time.time()
            while time.time() - t0 < 150:
                if (await pg.inner_text('#aar-prog')).startswith('All'): break
                await pg.wait_for_timeout(1000)
            print('offline AAR:', await pg.inner_text('#aar-prog'), '|', await pg.inner_text('#aar-check'))
            print('errors', errs[:5]); await b.close()
    finally:
        srv.terminate()
asyncio.run(main())
