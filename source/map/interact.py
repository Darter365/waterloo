import os
import asyncio, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
MLAT=111230; import math; MLON=111320*math.cos(math.radians(50.673))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto('file://'+D+'test.html'); await pg.wait_for_timeout(1200)
        box=await pg.eval_on_selector('#map','e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}')
        # compute view: whole-sheet fit
        W,H=box[2],box[3]; WM,HM=9900,7750; s0=min((W-28)/WM,(H-28)/HM); tx=(W-WM*s0)/2; ty=(H-HM*s0)/2
        def scr(la,lo):
            x=(lo-4.36)*MLON; y=(50.708-la)*MLAT; return box[0]+x*s0+tx, box[1]+y*s0+ty
        # zoom 1.5 screenshot via wheel at centre
        await pg.mouse.move(*scr(50.672,4.415)); 
        for _ in range(3): await pg.mouse.wheel(0,-90); await pg.wait_for_timeout(50)
        await pg.wait_for_timeout(600); await pg.screenshot(path=D+'shot_z15.png')
        # reset
        await pg.evaluate("document.getElementById('zfit').click()"); await pg.wait_for_timeout(400)
        # hover Kempt
        await pg.mouse.move(*scr(50.6820,4.4152)); await pg.wait_for_timeout(200)
        print('TIP:', await pg.inner_text('#tip'))
        print('STATUS:', await pg.inner_text('#status'))
        # click select
        await pg.mouse.click(*scr(50.6820,4.4152)); await pg.wait_for_timeout(200)
        print('CARD:', (await pg.inner_text('#unitcard'))[:500])
        # sight line Rossomme -> La Haye Sainte area
        await pg.evaluate("document.querySelector('.seg button[data-mode=sight]').click(); window.scrollTo(0,0)")
        await pg.mouse.click(*scr(50.65675,4.41333)); await pg.wait_for_timeout(100)
        await pg.mouse.click(*scr(50.6805,4.4100)); await pg.wait_for_timeout(300)
        print('SIGHT1:', await pg.inner_text('#result'))
        await pg.mouse.click(*scr(50.6683,4.4136)); await pg.wait_for_timeout(100)
        await pg.mouse.click(*scr(50.6850,4.4092)); await pg.wait_for_timeout(300)
        print('SIGHT2 (BA->Somerset):', await pg.inner_text('#result'))
        await pg.screenshot(path=D+'shot_sight.png')
        # performance of terrain render at high zoom
        t=await pg.evaluate('''async () => { const c=document.getElementById('map'); const t0=performance.now(); for(let i=0;i<6;i++){ c.dispatchEvent(new WheelEvent('wheel',{deltaY:-200,clientX:500,clientY:400,bubbles:true,cancelable:true})); } await new Promise(r=>setTimeout(r,400)); return performance.now()-t0; }''')
        print('zoom-in wall ms', round(t))
        await pg.screenshot(path=D+'shot_deep.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
