# Napoleon's Command (Waterloo and Ligny)

A browser game of command under fog of war: the player is Napoleon, gives written orders that riders carry, and learns of the
battle from reports. One battle-agnostic simulation fights every battle; battles and eras are data. It runs offline from GitHub
Pages, on a desktop browser first and still on a phone. The long-term aim is a 3D headquarters view on the same simulation.

**What Chris has decided, what was Claude's own choice and what is open is in `docs/DECISIONS.md`, loaded below. If its text is
not in your context, read that file before anything else.**

## Layout

- `source/` is the source. **The repository root is the built site that GitHub Pages serves.** Never edit `index.html`, `lab.html`,
  `ligny.html`, `sw.js`, `manifest.webmanifest` or the root `README.md` by hand: `sh source/deploy.sh` rebuilds and copies them.
- `source/sim/` the simulation and the game page: `engine.js` (combat, movement, morale), `ai.js` and `doctrine.js` (commanders),
  `command.js` (beliefs, riders, reports), `orders.js`, `view.js` (the contract a client draws from), `stakes.js` (campaign verdict),
  `_game*.js` and `_shared_draw.js` (the page), `_game_3d.js` (the 3D relief view), `packs/` (eras, nations, battles, maps),
  `tools/`, `tests/` (browser tests), `ref/` (reference battles).
- `docs/` is the project's memory: `DECISIONS.md` (the decision log), `ROADMAP.md` (the plan, condensed), `START_HERE.md` (the
  brief for a new planning conversation), `METHOD.md` (procedures and tools), `RULES.md` (the rules doc, a snapshot).
- `source/README.md` describes every folder and how to add a battle. Read it before structural work.
- No bundler and no npm packages. `build_game.py` concatenates the scripts into one HTML page. Every `_game*.js` file shares one
  function scope, so top-level names must be unique across them.

## Commands (run from `source/sim` unless a path is given)

| What | Command | About |
| --- | --- | --- |
| Quick checks, before every commit | `sh check.sh` | 2 min |
| All 120 reference battles | `for m in hist chaos dawn dry; do node refset.js check ref/p2_$m.json; done` | 4 min |
| Waterloo against its 1815 band | `node tools/band.js 500` | long |
| The contract's tests | `node tools/test_view.js waterloo 1003` | 20 s |
| The agent harness's tests | `node tools/test_agentplay.js` | 15 s |
| Strategy bench | `node tools/strategies.js --n 6` | 1 min |
| Simulation speed beside its baseline | `node tools/ticktime.js` (`--verify`, `--record`) | 20 s |
| Browser suite (builds first) | `sh regress.sh` | 10 min |
| UI audit: contrast, overflow, console | `python3 tools/pw.py tests/uiaudit.py` | 3 min |
| Offline build test | `python3 tools/pw.py ../offline/offtest.py` (after `python3 ../offline/build_offline.py`) | 1 min |
| Build the game page only | `python3 build_game.py` | 1 s |
| Build everything into the repository root | `sh ../deploy.sh` | 10 s |

Run browser tests through `tools/pw.py`: it uses Playwright's Chromium, or the Chrome a cloud session ships. In a cloud session
the SessionStart hook runs `source/claude-setup.sh`, which installs any missing Python package and says so in one line. The hook
runs only in a session on this one repository; in a project thread or a session with several repositories, run the script by hand.

## Rules that are not negotiable

1. **A change meant to leave results alone must replay the reference battles exactly.** Run the 120. UI, tools, text and the
   contract never draw dice (`E.rnd`) and never write engine state.
2. **A change meant to alter how battles fight needs Chris's go-ahead first.** It must keep Waterloo inside its band
   (`tools/band.js`; the band was agreed with Chris and is not yours to move), and the references are re-recorded only with his say.
3. **No battle or era names in the engine.** `tools/lint.js` holds an allow-list that may only shrink. New behaviour is a general
   rule plus pack data.
4. **Every number is sourced, derived, calibrated or marked `(est.)`** in a comment: sourced names a work someone can open,
   derived shows its working, calibrated names the band it was tuned to. Never present an estimate as history. If a
   historical fact is uncertain or you cannot source it, say so and ask; do not fill the gap.
5. **Fog of war is kept.** Napoleon's map shows only what he knew. Causes and true positions appear only on the umpire's map and
   after the battle. `tools/test_view.js` enforces this for the contract.
6. **Same seed and same orders give the same battle.** No `Math.random`, no clock time and no iteration over unordered state in
   the simulation. Verified in Node and Chromium only (`docs/METHOD.md`, section 7).
7. **Offline, and desktop first.** The offline build makes no external request. Design and judge on a desktop browser (1440 px
   wide, light and dark). The page must still load and play at 390 px, and the suites keep testing that, but the phone no longer
   drives design.
8. **New clients draw from `view.js` only** (`world`, `snapshot`, `drain`, `why`, `losses`), never from engine objects.

## Merging

Chris approves the task; the gates decide the merge. Claude merges its own pull request when the change is in class 1, 2 or 3
and every gate for that class passed in this session, with the output in the pull request. Otherwise it opens the pull request
and waits. If unsure of the class, take the higher one. A task brief that says "show me first" overrides this section.

| Class | What | Gates |
| --- | --- | --- |
| 1. Record | `docs/`, comments, tests and tools the page does not load | `sh check.sh` |
| 2. Results-neutral | The page, the contract, tools and pack data that change no battle | `check.sh`; all 120 reference battles identical; `regress.sh`; the UI audit; the offline test; the rebuilt site in the last commit |
| 3. Results-changing, approved | A change to how battles fight that Chris approved as a task, with its acceptance test written in `docs/DECISIONS.md` before work began | Class 2's gates bar the references; that acceptance test; Waterloo in its band over 500; `tune.js` with no check leaving its band; the strategy bench with no new failure; references re-recorded in the same pull request; a before-and-after table |
| 4. Chris only | A band, target or campaign score; rules 1 to 8 and this section; a new dependency; repository or Pages settings; deleting from `ref/` or `results/`; making a new battle playable | None: open the pull request and wait |

- A gate that fails stops the merge. Never edit a test, a band, a `KNOWN` list or the lint allow-list to pass one.
- Before merging class 2 or 3, a reviewer with fresh context (a subagent that did not write the change) reads the diff against
  the rules above. Its findings go in the pull request.
- The pull request says what was verified with the numbers and what was not, and shows screenshots of anything the player sees.
- After merging: label it `self-merged`, wait for the site to publish, load the live page and play one order through. If that
  fails, revert the merge at once and tell Chris. A revert needs no approval.

## How to work here

- One task, one branch, one pull request. Never push to `main` directly: `main` is the live site and changes only by a merge
  under Merging above. A release commit carries the source change and the rebuilt root site together.
- Method for validation, sources, playtests and performance, and which of Claude's tools to use for what, is in
  `docs/METHOD.md`. Read it before calibration, new battle data, performance work or a playtest. `docs/RULES.md` is a snapshot
  of the rules doc: every calibration value and where it came from.
- Report what you verified with the numbers (which suites, how many battles), and what you did not. Explain design choices and
  name your assumptions. Known gaps are listed in the tools (`bench.js`, `strategies.js` KNOWN), never hidden.
- Comments say why, in plain prose. British spelling. UI text is plain, period-neutral English.
- Tests reach the page's internals through `globalThis.WGame`; add hooks there, not globals.
- **Record decisions.** When a conversation or pull request settles something, add a dated line to `docs/DECISIONS.md` in the
  same change. A choice of yours that Chris has not confirmed goes under "Claude's choices awaiting Chris", never as a decision.
  Update `docs/ROADMAP.md` when a step is finished.
- Keep this file short. Put procedures in `source/README.md`.

## State on 12 November 2026 and what is next

Release 4 (9 Nov) added the campaign verdict, orders written from the map, "why?" on events, the view contract and the strategy
bench. The 3D relief view of the umpire's picture was merged on 12 Nov. Chris has not chosen the order of what follows.

1. **Move the 2D map onto the contract.** `_shared_draw.js`, `_game*.js`, `../map/live.js` and `lab/lab.js` still read `SIM.*`
   directly. They should draw from `view.snapshot()` and `view.drain()` alone, in both Napoleon's and the umpire's modes, with no
   change to any result. This is the prerequisite for a headquarters view drawn from Napoleon's beliefs.
2. **The idle-army gap** (`strategies.js`, `waterloo:idle-punished`): the allies never attack a French army that sits still, so
   the field ends a draw. It needs a general rule for a defender taking the initiative. It changes results: rule 2 applies.
3. **Sound** from the event stream: guns and volleys by bearing, loudness and delay. Web Audio, synthesised, no assets.
4. **A calibrated battle outside June 1815** to prove the engine is era-agnostic; the lint allow-list should shrink with it.
5. **3D from headquarters:** the camera at Napoleon's position, drawn from what he knows; then judge whether a native engine is
   worth it. If so, embed this JavaScript simulation; do not port it.
6. **Have GitHub build and publish the site,** so the built files are no longer committed at the root. Its own pull request;
   it needs a Pages setting changed by Chris.

Approved by Chris on 12 Nov, order not chosen: **a dice stream per purpose** (class 3; acceptance test in `DECISIONS.md`),
**measures of the core loop** from the contract (`docs/METHOD.md`, section 5), and **agent playtests** through Napoleon's view,
the umpire's and, once the allied side is playable, Wellington's.

`docs/ROADMAP.md` condenses the "Engine roadmap" doc in Chris's Claude account. Ask him when the order of work matters.

@docs/DECISIONS.md
