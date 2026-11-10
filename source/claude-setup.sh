#!/bin/bash
# Prepares a Claude Code cloud session for this repository. The SessionStart hook in .claude/settings.json runs it when a session
# starts or resumes. Cloud only: on your own machine it exits at once (FORCE=1 bash source/claude-setup.sh runs it there too).
#
# The cloud image already has Node 22, Python 3, Playwright for Python and Chrome (at $CHROME_PATH). On 9 November 2026 the one thing
# it lacked was brotli, which the offline build needs to pack the fonts. This installs whichever of the builds' and tests' Python
# imports is missing, and prints one line saying what it did; Claude sees that line at the start of the session. It only looks
# the modules up (it does not import them), so a session that already has everything pays a fraction of a second.
if [ "$CLAUDE_CODE_REMOTE" != "true" ] && [ "$FORCE" != "1" ]; then exit 0; fi

missing=$(python3 - <<'PY'
import importlib.util
need = {'brotli': 'brotli', 'playwright': 'playwright', 'PIL': 'pillow', 'fontTools': 'fonttools', 'numpy': 'numpy', 'scipy': 'scipy'}
print(' '.join(pkg for mod, pkg in need.items() if importlib.util.find_spec(mod) is None))
PY
)
if [ -z "$missing" ]; then
  echo "waterloo setup: build and test packages present"
elif pip install -q --break-system-packages $missing >/dev/null 2>&1 || pip install -q $missing >/dev/null 2>&1; then
  echo "waterloo setup: installed $missing"
else
  echo "waterloo setup: could not install $missing (try: pip install $missing)"
fi
# the browser tests need a Chromium: Playwright's own, or the Chrome the cloud image ships (source/sim/tools/pw.py finds either)
if [ ! -x "${CHROME_PATH:-/usr/bin/google-chrome}" ] && ! ls "$HOME"/.cache/ms-playwright/chromium-* >/dev/null 2>&1; then
  echo "waterloo setup: no Chrome found; the browser tests need one (python3 -m playwright install chromium)"
fi
exit 0
