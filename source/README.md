# Source: Waterloo · Napoleon's command, and the engine under it

The game served at the repository root (GitHub Pages) is built from here, with the battle lab beside it (`lab.html`).

| Folder | What it holds |
| --- | --- |
| `sim/` | The engine (`engine.js`), the commanders (`doctrine.js`: generic, for any battle, with each battle's habits and timetables as data in its pack; `ai.js`: the historical runner, which gives the armies not commanded generically their recorded plan, timetable and generals' initiative), plan rules (`plans.js`), the command layer (`command.js`, `orders.js`), replays (`replay.js`), the game page (`_game*.js`, `_css_*.css`, `_game_body.html`) |
| `sim/tests/` | The browser tests (Playwright), one file each; `sim/regress.sh` runs them all through `sim/tools/pw.py`. They read the built page from `sim/` and write their scratch pages there |
| `sim/view.js` | The contract between the sim and whatever draws it (release 4): the ground once, snapshots of what the commander believes or of the truth, a timed event stream filtered by what he can see and hear, and causes. Plain data, no dice; a 3D client needs nothing else from the engine. `tools/test_view.js` holds it to its rules |
| `sim/_game_3d.js`, `sim/vendor/` | The field in relief: a 3D view of the umpire's picture, the first client drawn from the contract alone (`view.world()` and `view.snapshot('truth')`). Flat colour and few polygons; every colour and size is a constant at the top of the file. `vendor/three.min.js` is three.js 0.149.0 (MIT, licence beside it), carried in the page as text and started only when the view first opens. `tests/view3dtest.py` tests it at phone size |
| `sim/stakes.js` | The campaign's verdict beside the field's grade, from each battle pack's `stakes` block; the engine's grades and the calibration targets are untouched |
| `sim/packs/` | Everything a battle is, as data: eras (`eras/`), nations, leaders, battles (`battles/`), orders of battle (`oob/`, made from CSV), terrain (`maps/`, made from survey files); `validate.js` checks them |
| `sim/tools/` | `fight.js` (any battle, generic commanders), `tune.js` (era constants against every battle's targets), `band.js` (Waterloo's band), `bench.js` (single-situation tests), `oob.js` (CSV armies, and `chain <battle>`: the chain of command), `map.js` (the map pipeline), `replay.js` (replay files), `lint.js` (no battle or era names in the engine), `ticktime.js` (milliseconds per tick and battles a minute, beside `results/ticktime_baseline.json`), `build_lab.py` |
| `sim/lab/` | The battle lab page (built into `sim/lab.html` and the site's `lab.html`) |
| `sim/ref/` | Reference battles: release 3's (`ref_*`) and phase 2's (`p2_*`), a state hash every 30 game minutes |
| `sim/results/` | Calibration batches, and the simulation-speed baseline (`ticktime_baseline.json`) |
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

## The chain of command
Every army, wing, corps and division of a battle is an entry in one table, `WPacks.battle(id).chain` (the engine's `E.chain`), made by
`P.chain` in `sim/packs/registry.js`: `{ id, kind, side, parent, name, commander, units, parts }`. It is built from the order of
battle's `corps` and `division` columns, each side's `chief`, and the leaders the battle places: a leader commands the corps or
division that carries his id. Anything else a battle states in its `chain` block (`guard: { commander: 'drouot' }`,
`guardcav: { under: 'guard' }`, or a wing with no units of its own). `E.unitsOf(id)` gives the bodies in an entry now.
`node sim/tools/oob.js chain <id>` prints the tree with strengths, and lists where the code still leads a corps by a rule of its
own: the generic commanders (`E.headOf`), the historical runner (`ai.js`) and the command layer (`command.corpsCmd`) each have one.
The validator checks the table and holds `corpsCmd` to it. Nothing in the simulation decides from the table yet; see
`../docs/DECISIONS.md`.

## Testing
- `sh sim/check.sh`: the validator, the lint, the tools' self-tests, the test bench, the test battle and a sample of the reference battles (about two minutes).
- `node sim/refset.js check sim/ref/p2_hist.json` replays the reference battles; any divergence is reported at the minute it starts.
- `node sim/tools/ci_verdict.js <gate> <log>` turns a gate's printed output into pass or fail (exit code), for the GitHub workflows in `.github/workflows/` and for anyone who wants a verdict they cannot misread: `refs`, `regress`, `uiaudit`, `offline`, `band`, `fuzz`; `selftest` checks its rules. It changes no gate.
- `node sim/tools/band.js 500` checks Waterloo against its band; `node sim/tools/tune.js --n 60` checks every battle with targets.
- `node sim/tools/test_view.js [battle] [seed]` tests the contract: plain data, a watched battle ends on the same state hashes as an unwatched one, and nothing the commander did not know reaches his snapshot or his events.
- `node sim/tools/strategies.js --n 6` is the strategy bench: every battle with a `stakes` block fought with no orders, the historical orders and the pack's `strategies`, held to expectations (idle play is never rewarded, plans differ, losses are sane). Known gaps are listed, not failed.
- `sh sim/regress.sh` runs the browser suite (needs Playwright and a Chromium: `sim/tools/pw.py` runs each test with Playwright's own, or failing that with the Chrome a Claude Code cloud session ships). One test alone: `python3 tools/pw.py tests/<name>.py` from `sim/`. `tests/release4test.py` is the phone-size test of the start, the order strip, the verdict and the causes.

The plan is condensed in `../docs/ROADMAP.md` (the full engine roadmap doc is in Chris's Claude account), and what has been decided is in `../docs/DECISIONS.md`; the rules and every calibration value are in the rules doc.
