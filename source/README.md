# Source: Waterloo · Napoleon's command, and the engine under it

The game served at the repository root (GitHub Pages) is built from here, with the battle lab beside it (`lab.html`).

| Folder | What it holds |
| --- | --- |
| `sim/` | The engine (`engine.js`), the commanders (`doctrine.js`: generic, for any battle; `ai.js`: Waterloo's own habits, being moved to data), plan rules (`plans.js`), the command layer (`command.js`, `orders.js`), replays (`replay.js`), the game page (`_game*.js`, `_css_*.css`, `_game_body.html`) and the tests |
| `sim/packs/` | Everything a battle is, as data: eras (`eras/`), nations, leaders, battles (`battles/`), orders of battle (`oob/`, made from CSV), terrain (`maps/`, made from survey files); `validate.js` checks them |
| `sim/tools/` | `fight.js` (any battle, generic commanders), `tune.js` (era constants against every battle's targets), `band.js` (Waterloo's band), `bench.js` (single-situation tests), `oob.js` (CSV armies), `map.js` (the map pipeline), `replay.js` (replay files), `lint.js` (no battle or era names in the engine), `build_lab.py` |
| `sim/lab/` | The battle lab page (built into `sim/lab.html` and the site's `lab.html`) |
| `sim/ref/` | Reference battles: release 3's (`ref_*`) and phase 2's (`p2_*`), a state hash every 30 game minutes |
| `sim/results/` | Calibration batches |
| `map/` | The map template and the scripts that built Waterloo's terrain |
| `offline/` | The offline home-screen build, with its fonts |

## Building
- `python3 sim/build_game.py` writes `sim/game.html` (the artifact page); `python3 sim/tools/build_lab.py` writes the lab.
- `./deploy.sh` builds the game, the offline site and the lab, and copies the site to the repository root.

## Adding a battle
1. Terrain: a spec, spot heights (or an ESRI grid) and a GeoJSON of roads, woods, villages and buildings in `sim/packs/maps/`; `node sim/tools/map.js build sim/packs/maps/<id>.map.json`.
2. Army lists: a CSV in `sim/packs/oob/`; `node sim/tools/oob.js import sim/packs/oob/<id>.csv <id>`.
3. The battle: `sim/packs/battles/<id>.js` with its sides, places, objectives, roads of march, leaders, victory rules and targets (see `toy-ridge.js`); add the files to `sim/packs/all.js` and `PACKS` in `sim/build_game.py`.
4. `node sim/packs/validate.js <id>`, then `node sim/tools/fight.js <id> 20`, or open the lab.

## Testing
- `sh sim/check.sh`: the validator, the lint, the tools' self-tests, the test bench, the test battle and a sample of the reference battles (about two minutes).
- `node sim/refset.js check sim/ref/p2_hist.json` replays the reference battles; any divergence is reported at the minute it starts.
- `node sim/tools/band.js 500` checks Waterloo against its band; `node sim/tools/tune.js --n 60` checks every battle with targets.
- `sh sim/regress.sh` runs the browser suite (needs Playwright and Chromium).

The plan of record is the engine roadmap doc; the rules and every calibration value are in the rules doc.
