import os
# UI audit: play a battle through and, at every stop and at the end, check every visible piece of text for being empty or unreadable
# (contrast against its real background), every panel for spilling sideways, and the console for errors. Desktop and phone, light and dark.
import asyncio, json, sys, time
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = open(D + 'game.html').read()
open(D + 'pu.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
AUDIT = r"""(() => {
  const out = [];
  const rgb = s => { let m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = s.match(/color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; } return null; };
  // the map's own overlays sit on the drawn paper, not on the page: composite them over the map's paper colour
  const paper = rgb(getComputedStyle(document.documentElement).getPropertyValue('--m-paper').trim().replace(/^#(..)(..)(..)$/, (_, a, b, c) => `rgb(${parseInt(a, 16)},${parseInt(b, 16)},${parseInt(c, 16)})`));
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = el => { const mb = el.closest('#mapbox'); let layers = []; for (let e = el; e && e !== mb; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; } } let base = mb && paper ? paper : { r: 255, g: 255, b: 255 }; for (const c of layers.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; return base; };
  const visible = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; if (e.tagName === 'DETAILS' && !e.open && !e.contains(el.closest('summary'))) { if (e !== el && !el.closest('summary')) return false; } } return true; };
  // text contrast
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seenEl = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || seenEl.has(el)) continue; seenEl.add(el);
    if (['SCRIPT', 'STYLE', 'OPTION', 'TITLE'].includes(el.tagName) || el.closest('svg') || el.closest('canvas')) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el), fg = rgb(cs.color); if (!fg) continue; const bg = bgOf(el);
    const fgm = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const L1 = lum(fgm), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(cs.fontSize) >= 18.5 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) out.push({ k: 'contrast', cr: +cr.toFixed(2), text: t.slice(0, 60), sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' in ' + (el.closest('[id]') ? '#' + el.closest('[id]').id : '?') });
  }
  // cards and list items with no text at all
  for (const el of document.querySelectorAll('article, .disp, li, .brief, .preview, .glasscap, .endbox, td, th, button, summary')) {
    if (!visible(el)) continue; if (el.closest('svg')) continue;
    if (!el.innerText.trim() && !el.querySelector('svg, img, input, select, canvas') && !(el.tagName === 'TD' || el.tagName === 'TH')) out.push({ k: 'empty', sel: el.tagName.toLowerCase() + '.' + (el.className || '') + ' in ' + (el.closest('[id]') ? '#' + el.closest('[id]').id : '?') });
  }
  // sideways spill: the page, and panels other than scrollers
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push({ k: 'pageScroll', w: document.documentElement.scrollWidth, vw: innerWidth });
  for (const el of document.querySelectorAll('.panel .body, .aar-part, .disp, .preview, .brief, .endbox, .runbar')) { if (!visible(el)) continue; if (el.scrollWidth > el.clientWidth + 2 && !el.closest('.tscroll')) out.push({ k: 'spill', sel: el.className + ' in ' + (el.closest('[id]') ? '#' + el.closest('[id]').id : '?'), sw: el.scrollWidth, cw: el.clientWidth }); }
  return out;
})()"""
async def run(p, W, H, dark, seed):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': W, 'height': H}, color_scheme='dark' if dark else 'light', has_touch=W < 600)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
    await pg.goto('file://' + D + 'pu.html'); await pg.wait_for_timeout(800)
    finds = []
    async def audit(where):
        for f in await pg.evaluate(AUDIT): f['where'] = where; finds.append(f)
    await audit('setup')
    await pg.fill('#s-seed', str(seed)); await pg.click('#s-go'); await pg.wait_for_timeout(400)
    for d in await pg.query_selector_all('details'): await d.evaluate('d => d.open = true')
    await audit('briefing')
    await pg.select_option('#ob-to', 'army'); await pg.wait_for_timeout(100); await audit('retreat draft')
    await pg.select_option('#ob-to', 'reille'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont'); await pg.click('#ob-then'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'hougoumont'); await audit('letter draft'); await pg.click('#ob-send')
    await pg.select_option('#ob-to', 'derlon'); await pg.select_option('#ob-act', 'attack'); await pg.select_option('#ob-obj', 'ridgeEast'); await pg.click('#ob-send')
    await pg.select_option('#r-stop', 'all')
    stops = 0
    while (await pg.inner_text('#clock')) < '16:30' and stops < 40:
        await pg.click('#go'); t0 = time.time()
        while time.time() - t0 < 60:
            await pg.wait_for_timeout(120)
            if (await pg.inner_text('#go')) in ('Continue', 'The verdict'): break
        stops += 1
        for d in await pg.query_selector_all('details'): await d.evaluate('d => d.open = true')
        if stops % 3 == 1: await audit('stop ' + await pg.inner_text('#clock'))
    await pg.select_option('#r-to', 'end'); await pg.click('#r-go'); await pg.wait_for_timeout(200); await audit('end box')
    await pg.check('input[name=endmode][value=hist]'); await pg.click('#end-go')
    t0 = time.time()
    while time.time() - t0 < 120 and (await pg.inner_text('#go')) != 'The verdict': await pg.wait_for_timeout(300)
    t0 = time.time()
    while time.time() - t0 < 120 and not (await pg.inner_text('#aar-prog')).startswith('All'): await pg.wait_for_timeout(500)
    for d in await pg.query_selector_all('details'): await d.evaluate('d => d.open = true')
    await audit('the end + report')
    await b.close()
    return finds, errs
async def main():
    async with async_playwright() as p:
        report = {}
        for (W, H, dark) in [(1440, 900, False), (1440, 900, True), (390, 844, False), (390, 844, True)]:
            f, e = await run(p, W, H, dark, 2718)
            key = f'{W}{" dark" if dark else ""}'
            agg = {}
            for x in f:
                k = (x['k'], x.get('sel', ''), x.get('text', '')[:40] if x['k'] == 'contrast' else '')
                if k not in agg: agg[k] = dict(x, n=0)
                agg[k]['n'] += 1
            report[key] = {'findings': list(agg.values()), 'errors': e[:10]}
            print(key, len(agg), 'distinct findings,', len(e), 'console errors', flush=True)
        json.dump(report, open(D + 'uiaudit.json', 'w'), indent=1)
asyncio.run(main())
