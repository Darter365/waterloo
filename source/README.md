# Source: Waterloo · Napoleon's command, and the engine under it

The game served at the repository root (GitHub Pages) is built from here, with the battle lab beside it (`lab.html`).

| Folder | What it holds |
| --- | --- |
| `sim/` | The engine (`engine.js`), the commanders (`doctrine.js`: generic, for any battle, with each battle's habits and timetables as data in its pack; `ai.js`: the historical runner, which gives the armies not commanded generically their recorded plan, timetable and generals' initiative), plan rules (`plans.js`), the command layer (`command.js`, `orders.js`), replays (`replay.js`), the game page (`_game*.js`, `_css_*.css`, `_game_body.html`) and the tests |
| `sim/view.js` | The contract between the sim and whatever draws it (release 4): the ground once, snapshots of what the commander believes or of the truth, a timed event stream filtered by what he can see and hear, and causes. Plain data, no dice; a 3D client needs nothing else from the engine. `tools/test_view.js` holds it to its rules |
| `sim/stakes.js` | The campaign's verdict beside the field's grade, from each battle pack's `stakes` block; the engine's grades and the calibration targets are untouched |
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
3. The battle: `sim/packs/battles/<id>.js` with its sides, places, objectives, roads of march, leaders, victory rules, targets, and for a battle the game plays its `stakes` (what the day meant for the campaign) and `strategies` (plans for the strategy bench) (see `toy-ridge.js`, and `waterloo.js` for the last two); add the files to `sim/packs/all.js` and `PACKS` in `sim/build_game.py`.
   What the record says a side's commanders did goes in the same file, as data the generic commanders run alongside: plan rules (`plans`), a defender's habits (`crest`, `feeds`, `sectors` ...), generals' initiative (`initiative`), and an arriving army's timetable (`delays`, `waits`, `follows`, `flanks`, `press`, `pursue`, `reports`; `toGuns` for a detached force). `doctrine.js` describes every key; Waterloo's Prussians and the test battle's Green corps are worked examples. `fight.js --no-timetables` fights without them.
4. `node sim/packs/validate.js <id>`, then `node sim/tools/fight.js <id> 20`, or open the lab.

## Testing
- `sh sim/check.sh`: the validator, the lint, the tools' self-tests, the test bench, the test battle and a sample of the reference battles (about two minutes).
- `node sim/refset.js check sim/ref/p2_hist.json` replays the reference battles; any divergence is reported at the minute it starts.
- `node sim/tools/band.js 500` checks Waterloo against its band; `node sim/tools/tune.js --n 60` checks every battle with targets.
- `node sim/tools/test_view.js [battle] [seed]` tests the contract: plain data, a watched battle ends on the same state hashes as an unwatched one, and nothing the commander did not know reaches his snapshot or his events.
- `node sim/tools/strategies.js --n 6` is the strategy bench: every battle with a `stakes` block fought with no orders, the historical orders and the pack's `strategies`, held to expectations (idle play is never rewarded, plans differ, losses are sane). Known gaps are listed, not failed.
- `sh sim/regress.sh` runs the browser suite (needs Playwright and Chromium). `release4test.py` is the phone-size test of the start, the order strip, the verdict and the causes.

The plan of record is the engine roadmap doc; the rules and every calibration value are in the rules doc.
