# The offline release: the same game page as the published artifact, made into a home-screen web app that works with no signal.
# - fonts embedded (no Google Fonts), so nothing is fetched from the network
# - a web app manifest and icons, so Safari's "Add to Home Screen" gives an app-like icon and full screen
# - a service worker that keeps every file in the phone's cache, so it opens offline after the first visit
import base64, io, os, re, json, hashlib
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SIM = os.path.join(HERE, '..', 'sim')
OUT = os.path.join(HERE, 'site')
FONTS = os.path.join(HERE, 'fonts') # the woff2 files from the @fontsource packages (5.3.0), OFL-licensed
os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)

def font(pkg, name):
    p = os.path.join(FONTS, name)
    return base64.b64encode(open(p, 'rb').read()).decode()
FACES = [
    ('EB Garamond', 'normal', 400, 'eb-garamond', 'eb-garamond-latin-400-normal.woff2'),
    ('EB Garamond', 'normal', 500, 'eb-garamond', 'eb-garamond-latin-500-normal.woff2'),
    ('EB Garamond', 'normal', 600, 'eb-garamond', 'eb-garamond-latin-600-normal.woff2'),
    ('EB Garamond', 'italic', 400, 'eb-garamond', 'eb-garamond-latin-400-italic.woff2'),
    ('IM Fell English', 'normal', 400, 'im-fell-english', 'im-fell-english-latin-400-normal.woff2'),
    ('IM Fell English', 'italic', 400, 'im-fell-english', 'im-fell-english-latin-400-italic.woff2'),
    ('IM Fell English SC', 'normal', 400, 'im-fell-english-sc', 'im-fell-english-sc-latin-400-normal.woff2'),
    ('Monsieur La Doulaise', 'normal', 400, 'monsieur-la-doulaise', 'monsieur-la-doulaise-latin-400-normal.woff2'),
]
fontcss = ''.join(f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{font(pkg, f)}) format('woff2')}}\n" for fam, st, w, pkg, f in FACES)

game = open(os.path.join(SIM, 'game.html'), encoding='utf-8').read()
# the Google Fonts links are replaced by the embedded faces
game = re.sub(r'<link rel="preconnect"[^>]*>\n?', '', game)
game = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n?', '', game)
assert 'fonts.googleapis' not in game and 'fonts.gstatic' not in game
title = re.search(r'<title>(.*?)</title>', game).group(1)
game = game.replace(f'<title>{title}</title>\n', '', 1)
stamp = hashlib.sha1(game.encode()).hexdigest()[:10]

head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="Command Napoleon's army at Waterloo through riders, reports and orders.">
<meta name="theme-color" content="#e7ddc6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15110d" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Waterloo">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}
{fontcss}</style>
</head>
<body>
'''
tail = f'''
<script>
// the offline release: keep every file of the game in this device's cache (release {stamp})
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {{}});
</script>
</body>
</html>
'''
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(head + game + tail)

# icons: an ink "W" on the map's paper, with the double rule of the map's cartouche
def ttf(pkg, name):
    f = TTFont(os.path.join(FONTS, name)); f.flavor = None; b = io.BytesIO(); f.save(b); b.seek(0); return b
PAPER, INK, ACCENT = (243, 234, 210), (57, 44, 32), (138, 74, 23)
def icon(size, maskable=False):
    im = Image.new('RGB', (size, size), PAPER); d = ImageDraw.Draw(im)
    if not maskable:
        m = round(size * 0.06); d.rectangle([m, m, size - m - 1, size - m - 1], outline=INK, width=max(2, size // 64))
        m2 = round(size * 0.095); d.rectangle([m2, m2, size - m2 - 1, size - m2 - 1], outline=INK, width=max(1, size // 160))
    fw = ImageFont.truetype(ttf('im-fell-english-sc', 'im-fell-english-sc-latin-400-normal.woff2'), round(size * (0.46 if maskable else 0.56)))
    fy = ImageFont.truetype(ttf('im-fell-english', 'im-fell-english-latin-400-italic.woff2'), round(size * (0.10 if maskable else 0.12)))
    d.text((size / 2, size * (0.46 if maskable else 0.45)), 'W', font=fw, fill=INK, anchor='mm')
    d.text((size / 2, size * (0.70 if maskable else 0.75)), '1815', font=fy, fill=ACCENT, anchor='mm')
    return im
icon(512).save(os.path.join(OUT, 'icons', 'icon-512.png'))
icon(192).save(os.path.join(OUT, 'icons', 'icon-192.png'))
icon(180).save(os.path.join(OUT, 'icons', 'apple-touch-icon.png'))
icon(512, True).save(os.path.join(OUT, 'icons', 'maskable-512.png'))

manifest = {
    'name': "Waterloo: Napoleon's Command", 'short_name': 'Waterloo', 'description': "Command Napoleon's army at Waterloo through riders, reports and orders.",
    'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any', 'background_color': '#e7ddc6', 'theme_color': '#e7ddc6',
    'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
              {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
}
open(os.path.join(OUT, 'manifest.webmanifest'), 'w').write(json.dumps(manifest, indent=1))

files = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/maskable-512.png']
sw = f'''// Waterloo offline release {stamp}: every file is cached on install, and served from the cache first, so the game opens with no signal.
// A new release changes this file, which makes the browser install the new cache and drop the old one.
const CACHE = 'waterloo-{stamp}', FILES = {json.dumps(files)};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then(hit => hit || fetch(e.request).then(r => {{ if (r.ok && new URL(e.request.url).origin === location.origin) {{ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }} return r; }}).catch(() => caches.match('index.html'))));
}});
'''
open(os.path.join(OUT, 'sw.js'), 'w').write(sw)
open(os.path.join(OUT, 'README.md'), 'w').write(f'''# Waterloo: Napoleon's Command

A command game of 18 June 1815: you are Napoleon, and you know only what your eyes, your aides and your corps commanders' riders tell you.

Open the site once in Safari (or Chrome), then **Add to Home Screen**. After that it opens from the icon with no signal.

Everything is in `index.html` (engine, map and game); `sw.js` keeps it in the device's cache. Release {stamp}.

`lab.html` is the battle lab: any battle in the engine's packs (Waterloo, and an invented test battle), fought by the generic commanders
or with you commanding one army through its own sightings; it also fights a battle many times and judges the results against the
battle's targets. The source and the tools are in `source/`.
''')
print('offline release', stamp, 'index.html', os.path.getsize(os.path.join(OUT, 'index.html')) // 1024, 'KB')
