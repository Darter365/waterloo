"""Run a browser test with whichever Chromium this machine has.

    python3 tools/pw.py immtest.py 390 844 dark        (from source/sim; regress.sh runs every test this way)

The tests call p.chromium.launch() and so expect Playwright's own Chromium (python3 -m playwright install chromium). A Claude Code
cloud session has no such download but ships Chrome at $CHROME_PATH. When Playwright's browser is missing, this falls back to that
Chrome, or to any Chrome or Chromium on the PATH. Where Playwright's Chromium is installed, nothing changes."""
import os, runpy, shutil, sys
from playwright.async_api import BrowserType, Error

_launch = BrowserType.launch

def system_chrome():
    for c in (os.environ.get('CHROME_PATH'), shutil.which('google-chrome'), shutil.which('chromium'), shutil.which('chromium-browser')):
        if c and os.path.exists(c): return c
    return None

async def launch(self, **kw):
    if 'executable_path' in kw or 'channel' in kw: return await _launch(self, **kw)
    try: return await _launch(self, **kw)
    except Error as e:
        chrome = system_chrome()
        if "Executable doesn't exist" not in str(e) or not chrome: raise
        kw['executable_path'] = chrome; kw['args'] = list(kw.get('args') or []) + ['--no-sandbox']  # the cloud VM runs as root
        return await _launch(self, **kw)

BrowserType.launch = launch
if len(sys.argv) < 2: sys.exit('usage: python3 tools/pw.py <test.py> [arguments]')
script = os.path.abspath(sys.argv[1]); sys.argv = sys.argv[1:]; sys.path.insert(0, os.path.dirname(script))
runpy.run_path(script, run_name='__main__')
