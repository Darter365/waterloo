# Decisions

What Chris has decided, why, and what is still open. Newest first within each part. CLAUDE.md loads this file into every
session, so keep entries to a line or two and put detail in the pull request or `docs/ROADMAP.md`.

**Keeping it current (the rule):** when a conversation or pull request settles something, add it here in the same change, with
the date. If a choice was Claude's and Chris has not confirmed it, list it under "Claude's choices awaiting Chris" instead.
Never record a guess as a decision.

## The game

- **Core loop (Oct 2026).** The player commands as Napoleon at corps level. Orders are commander, action, objective, manner.
  The challenge is fog of war and slow, unreliable communication; the reward is a well-timed order that works with the others.
- **Teaching comes from playing (26 Oct).** Each battle opens with a briefing. Causes on tap, a narrated replay, a glossary and
  in-game sources were deferred then; causes ("why?") were added in release 4 for the umpire's log and after the battle.
- **One engine for every battle (26 Oct).** No battle or era code in the simulation; battles and eras are data. Era range is
  ancient to the 1870s. Sieges and naval actions are out of the core.
- **Either side playable, a page per battle, nights summarised, all four Gettysburg starts (Oct).** Not built yet: one side is
  playable per battle today.
- **A dice stream per purpose (12 Nov).** Approved, on the research (common random numbers). It changes results, so it is a
  class 3 task and the references are re-recorded once. Its acceptance test is under "Claude's choices" until Chris confirms it.
- **Measures of the core loop come before a performance baseline (12 Nov).** Belief error, report staleness, order latency,
  orders overtaken and decision gaps, computed from the contract alone (`docs/METHOD.md`, section 5). Not built.
- **Agent playtests through every view (12 Nov):** Napoleon's, the umpire's and Wellington's. Wellington's waits until the
  allied side is playable. Not built.
- **Long-term aim.** A 3D game set at the generals' historical headquarters, with sound, riders arriving and a spotting glass,
  later on an engine suited to large asset counts. The map interface and core mechanics come first.

## How we work

- **Claude may merge its own pull requests (12 Nov).** Chris approves the task and the gates decide the merge: the classes and
  gates are in `CLAUDE.md` under Merging. This replaces "`main` changes only on Chris's say" for classes 1 to 3. A brief that
  says "show me first" still wins.
- **Use every tool Claude has (12 Nov).** Skills, connectors, subagents, scheduled tasks and the browser on Chris's desktop, for
  research, building, testing and release. `docs/METHOD.md`, section 8, says which for what.
- **Instructions for the planning project (12 Nov).** Chris adopted the proposed text for the project's instructions field; he
  may change it. A revision for merging and tools is in the project (`claude/INSTRUCTIONS_PROPOSAL.md`).
- **The rules doc and the full roadmap are in the repository and the project (12 Nov).** `docs/RULES.md` is the "Simulation
  rules" tab of "Waterloo Game: Simulation Rules" as exported on 12 Nov (revision 37, dated 23 Oct). Its "Order of battle" tab
  is not copied yet.
- **Confidence keeps the packs' words (12 Nov):** `doc`, `approx`, `low`, `none`. No new scale.
- **Seeds and a battle held back from tuning: set aside (12 Nov).** Proposed by Claude; Chris said to ignore it for now.
- **Desktop first (12 Nov).** Develop and judge on a desktop browser from now on, to make things easier. The page must still
  load and play on a phone and offline, but the phone no longer drives design, and phone-only polish waits.
- **Repository layout (12 Nov).** The plan and these decisions live in `docs/`; browser tests live in `source/sim/tests/`.
  Still to do, in its own pull request: stop committing the built site by hand (have GitHub build and publish it).
- **A Claude project for planning (12 Nov).** Design talk, reviews and playtest notes go in a Claude project; code changes go
  through Claude Code sessions on this repository. `docs/START_HERE.md` is the brief for a new conversation.
- **Claude Code for the build work (9 Nov).** One task, one branch, one pull request. `main` is the live site and changes only
  on Chris's say.
- **Results-neutral by default.** Any change not meant to alter how battles fight must replay all 120 reference battles
  exactly. A change that does alter them needs Chris's go-ahead before the references are re-recorded. The Waterloo band
  (`tools/band.js`) was agreed with Chris and is not Claude's to move.
- **Accuracy over speculation.** Every number is sourced or marked `(est.)`. Say what was verified and what was not.

## Release 4 (9 Nov) and the 3D view (10 Nov)

- **The campaign verdict sits beside the engine's grade, it does not replace it,** so the 1815 band stays valid.
- **"Why?" shows only on the umpire's map and after the battle,** to keep the fog.
- **3D starts with the umpire's picture** (truth), offered only on the umpire's map or after the battle. The headquarters view
  from Napoleon's beliefs comes later.
- **Look:** simple, cartoon, low-poly, flat colour, easy for Claude to change. No painted assets.
- **On the ground everything is life size** (10 Nov): heights as surveyed, the eye 2.5 m up, real sizes for trees, buildings
  and troops. From above the scene stays enlarged so the field reads.
- **The light follows the hour and the weather** (10 Nov): sun position from date, place and time; haze and overcast from the
  game's own seeing distance.
- **Haze, a horizon beyond the map, shaded relief, finer facets and grass tufts** were all asked for (10 Nov). The far hills and
  the tufts are scenery, not survey.
- **three.js is vendored** (0.149.0) and carried in the page as text, so the offline build makes no request.

## Claude's choices awaiting Chris

These were made to keep moving and are easy to change. Raise them when the subject comes up.

- **The chain of command as one table (12 Nov).** Chris asked for Claude's recommendation to be built (corps and divisions as objects with a commander); the
  shape is Claude's. Every army, wing, corps and division is an entry in `battle.chain` (`P.chain`, `source/README.md`), and a battle's
  `chain` block states only what the rule "a leader commands the corps or division that carries his id" cannot know. Results are
  unchanged (the 120 replay exactly): no rule reads the table yet.
- Campaign score tiers and points (`stakes.js`, each pack's `stakes`): 90, 72, 54, 32, 10, plus or minus 8 for the exchange.
- At Waterloo the historical orders score 7 and doing nothing scores 24. Defensible (1815 was a catastrophe), but worth a look.
- A tap within 28 screen pixels of a named place takes the place when ordering from the map.
- Life-size object sizes in the ground view (tree 18 m, wall 2 m, cottage 5 m, farm 7 m, men 1.8 m), and the 14 m tree spacing.
- Sky and light colours, and reading short seeing as overcast only while the sun is up (the game has no cloud data).
- **The merge classes and gates** in `CLAUDE.md` (12 Nov): which changes are class 1, 2, 3 or Chris only; the fresh-context
  reviewer; the live-site check after a merge; the standing permission to revert.
- **The acceptance test for the dice streams** (12 Nov): Waterloo in its band over seeds 1000 to 1499; `tune.js` with no check
  that is in band today leaving it; the strategy bench with no new failure; the fuzz clean; and a new test that, with one
  order changed, draws the order does not touch stay identical. Also open: a stream per purpose only, or each draw keyed by
  purpose, unit and tick (`docs/METHOD.md`, section 4).
- **`docs/METHOD.md` as a whole, and the four kinds of number in rule 4** (sourced, derived, calibrated, estimated) (12 Nov).
- **`docs/RULES.md` is a snapshot and the Claude doc stays the master** (12 Nov). The other way round is possible.
- **What `doc`, `approx`, `low` and `none` mean** (`docs/METHOD.md`, section 2), read off today's packs.
- **How simulation speed is measured** (`tools/ticktime.js`, 12 Nov). Seeds 1 to 6 of Waterloo and Ligny under the historical
  orders (1 and 2 in `check.sh`), because those are reference seeds and each Waterloo battle is held to `ref/p2_hist.json` as it
  is timed; every tick counts, the cold first ones included; the baseline in `results/ticktime_baseline.json` is the middle of
  three fresh processes; the warning is at 1.5 times the baseline (est.) and never fails the check.
- Slopes are steepened tenfold for the shading painted on the ground; the view from above draws heights three times life size.

## Open questions (not decided)

- **Three rules for who leads a corps.** `doctrine.js`, `ai.js` and `command.js` each work it out their own way, and
  `node tools/oob.js chain <battle>` lists where they part from the table. Waterloo: the generic commanders put Blücher, not
  Bülow, at the head of IV Corps; the historical runner gives the Guard no general. Ligny: the same for the Guard, and the command
  block sends d'Erlon's corps through a leader the battle does not place. One rule for all three may change how battles fight.
- **A leader riding with a brigade does two jobs:** it says where he is, and it gives that one brigade a bonus in the assault
  and in rallying. Separating them changes results.
- **The idle-army gap.** The allies never attack a French army that sits still, so the field ends a draw. Fixing it changes
  how battles fight.
- **Determinism across browsers.** Verified in Node and Chromium only. The simulation uses `Math.sin`, `cos`, `pow`, `exp` and
  `log`, which other engines may round differently, so a battle may not replay identically in Safari or Firefox. Not tested.
- **Sources behind the rules doc.** Some sourced values rest on Wikipedia, web articles and a "research brief" that is not in
  the repository. A source pass is proposed (`docs/METHOD.md`, section 2).
- **Generic commanders on every side win Waterloo for the French** (a marginal French victory in 29 battles of 30, roadmap,
  27 Oct; not re-run since). Fair counterfactual, or an attacker that is too strong?
  A battle outside June 1815 is needed to tell.
- **Brigades in the ground view are flat slabs.** Ranks of simple figures is the suggested next step; shadows are another.
- **Vegetation exists only where the map data has it.** Ligny has none recorded.
- **Never measured:** frame rate of the 3D view on a real GPU or phone (tests use software rendering), and the time a tick takes
  on a phone or in a browser. Simulation speed is now measured on every change, in Node on the machine that runs `check.sh`
  (`tools/ticktime.js`, 12 Nov: Waterloo about 5 ms a tick, 95th centile 12 ms, on a two-core cloud Xeon), which shows a
  slowdown but says nothing about the roadmap's budget of under 20 ms on the phone.
- **Which comes next:** moving the 2D map onto the contract, or the idle-army rule. Chris has not chosen.
