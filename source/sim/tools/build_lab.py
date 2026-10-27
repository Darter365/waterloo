# Build the battle lab (engine roadmap 4a): one self-contained page with every pack, the engine, the commanders and the lab's own script.
#   python3 tools/build_lab.py      writes lab.html (the page body, as the artifact is published) and ../offline/site/lab.html (a whole
#                                   document for the offline site, next to the game)
import os, re
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = lambda p: open(os.path.join(D, p), encoding='utf-8').read()
# the same packs, in the same order, as the game (build_game.py is the one list)
PACKS = eval(re.search(r"^PACKS = (\[.*?\])$", R('build_game.py'), re.M).group(1))
srcs = PACKS + ['packs/validate.js', 'data.js', 'engine.js', 'ai.js', 'command.js', 'orders.js', 'plans.js', 'script.js', 'doctrine.js', 'replay.js']
eng = re.search(r"const VERSION = '([^']+)'", R('engine.js')).group(1)
sid = lambda f: 'src-' + f[:-3].replace('/', '-')
code = ''.join(f'<script id="{sid(f)}">\n' + R(f) + '\n</script>\n' for f in srcs)
assert '</script' not in ''.join(R(f) for f in srcs) + R('lab/lab.js')
body = R('lab/body.html').replace('__ENGINE__', eng)
style = '<style>\n' + R('lab/lab.css') + '</style>\n'
page = ('<title>Battle lab</title>\n' + style + body + '\n' + code + '<script>\n' + R('lab/lab.js') + '\n</script>\n')
out = os.path.join(D, 'lab.html'); open(out, 'w', encoding='utf-8').write(page)
print('wrote', out, len(page) // 1024, 'KB')
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<title>Battle lab</title>\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n'
       + style + '</head>\n<body>\n' + body + '\n' + code + '<script>\n' + R('lab/lab.js') + '\n</script>\n</body>\n</html>\n')
site = os.path.join(D, '..', 'offline', 'site'); os.makedirs(site, exist_ok=True)
out2 = os.path.join(site, 'lab.html'); open(out2, 'w', encoding='utf-8').write(doc)
print('wrote', os.path.normpath(out2), len(doc) // 1024, 'KB')
