# Source: Waterloo · Napoleon's command

The game served at the repository root (GitHub Pages) is built from here.

| Folder | What it holds |
| --- | --- |
| `sim/` | The engine (`engine.js`, `ai.js`, `command.js`, `orders.js`, `script.js`, `replay.js`, `data.js`), the game page (`_game*.js`, `_shared_draw.js`, `_interact.js`, `_css_*.css`, `_game_body.html`), and the tests |
| `sim/ref/` | Phase 0 reference battles: 400 Waterloo battles with a state hash every 30 game minutes |
| `sim/results/` | Calibration batches for the current release |
| `map/` | The map template and the scripts that built the terrain data |
| `offline/` | The offline home-screen build, with its fonts |

## Building
- `python3 sim/build_game.py` writes `sim/game.html` (the artifact page).
- `./deploy.sh` builds the game and the offline site and copies the site to the repository root.

## Testing
- `node sim/refset.js check sim/ref/ref_hist.json` replays the reference battles; any divergence is reported at the minute it starts.
- `sh sim/fuzz.sh` runs the invariant checker and the chaos player over several hundred battles, then `node sim/fzsum.js`.
- `sh sim/regress.sh` runs the browser suite (needs Playwright and Chromium); `python3 sim/uiaudit.py` checks contrast, empty cards and spills.
- `node sim/sweep5b.js 500 '[{}]' 1000` runs the 500-battle calibration batch; `node sim/calib8.js` runs the other modes.

The plan of record is the engine roadmap doc; the rules and every calibration value are in the rules doc.
