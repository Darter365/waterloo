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
- **Dice keyed by seed, purpose, owner and tick (12 Nov; engine 0.5).** Approved as "a dice stream per purpose", on the
  research (common random numbers). Both designs were measured first (30 battles, one order changed at 16:30): a stream per
  purpose re-rolled a median 70% of the later draws both battles ask for, against 72% for the one sequence; keyed draws re-roll
  none and keep about three quarters of the later events (`docs/METHOD.md`, section 4). Chris accepted the keyed design as
  built, and its merge, on 12 Nov, knowing which gates it failed: Waterloo is in its band over seeds 1000 to 1499 (allied
  victories 84.6%, was 87.6%; Prussian losses 7.9k, was 7.7k, band to 8.0k), but `tune.js` at 60 battles reads the Prussian
  median as 8.2k, and the strategy bench at 6 battles a plan failed "plans end 10 points apart" at Waterloo. On his say
  ("Accept and merge", then "Fix both, then merge") four tests were changed and the 120 references re-recorded once: three
  checks pinned to one seed were re-pinned (`test_tools.js`, test battle, seed 5 to 7; `check.sh`, the contract at Ligny,
  seed 7 to 8; `tests/speedtest.py`, seed 777 to 778, where units are moving at 13:32), and the strategy bench fights more
  battles a plan (it was 6, and 2 in `check.sh`), where it passes. How many, and which seeds, are Claude's (below).
- **The acceptance test for the dice streams (confirmed by Chris, 12 Nov, in the task brief).** Waterloo in its band over seeds
  1000 to 1499, with a before-and-after table; `tune.js` with no check that is in band today leaving it; the strategy bench
  with no new failure; the fuzz with no finding; a new test that, with one order changed, draws the order does not touch stay
  identical; same seed and same orders still give the same battle, and the reference hash still counts dice drawn or the pull
  request says what replaced it; class 2's other gates; the 120 references re-recorded once, after everything else passes; a
  fresh-context reviewer's findings in the pull request. If Waterloo leaves its band: no retuning, stop and report.
- **Measures of the core loop come before a performance baseline (12 Nov).** Belief error, report staleness, order latency,
  orders overtaken and decision gaps, computed from the contract alone (`docs/METHOD.md`, section 5). Built 12 Nov as
  `tools/loop.js`; its definitions and thresholds are Claude's (below).
- **Agent playtests through every view (12 Nov):** Napoleon's, the umpire's and Wellington's. The harness is built
  (`tools/agentplay.js`, Napoleon's view and the umpire's; `docs/playtests/`). Wellington's waits until the allied side is
  playable: what that needs is listed in `docs/playtests/wellington-headless.md`. **The first playtest has not been run:** the
  player agent was stopped by the model's safeguards before its first move (12 Nov), and it is Chris's call how to try again.
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
  rules" tab of "Waterloo Game: Simulation Rules" as exported on 12 Nov (revision 37, dated 23 Oct). Its "Order of battle" tab,
  the research brief (both tabs) and "Adding a battle: lessons from Ligny" were copied on 12 Nov by the source pass
  (`docs/SOURCES.md`, "Snapshots"). "Engine split: Waterloo to Gettysburg" is not copied: it waits for Chris's own export.
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

- **How the five loop measures are defined (12 Nov)**, `tools/loop.js` and `docs/METHOD.md`, section 5. Every threshold is
  (est.): belief is read against truth every 10 minutes; "the situation an order addressed" is who holds its objective and the
  enemy's horse and foot within 800 m of it; that situation has "changed" if the holder changed, or the enemy's strength there
  at least doubled or halved by at least 1,000 men; "a choice worth making" is a dispatch the staff starred reaching the
  commander (the game's own mark, but news only, not whether he had troops free); belief error is given for the middle body
  and the body at the 90th centile; "overtaken" (truth when given against truth on arrival) is kept apart from "written on a
  false picture" (belief against truth when given). Seeds 2000 to 2029, the strategy bench's.
- **What the contract gained for the measures (12 Nov):** on the commander's side each order's objective, count of conditions
  and the staff's estimate, and whether a dispatch is starred; on the umpire's side every order's real times and status, and
  beside each unit its key in the commander's picture and whether it is a crewed arm. The estimate is a second copy of the
  order form's until the page moves onto the contract, and unlike the form it does not use the writing time already rolled.
- **The reviewer subagent and three skills (12 Nov).** Chris asked for them; the wording is Claude's. The reviewer has `Read`,
  `Grep` and `Glob` only, so the session writes the diff to a file for it; it adds two standards of its own (a change is the
  highest class of anything in it; "blocking" means a rule broken, a gate weakened or a class set too low). `add-battle` puts a
  pack with `targets` or `stakes` in class 4; `results-change` asks Chris to confirm an acceptance test that is still Claude's.
- **How GitHub judges a gate (12 Nov).** Chris asked for the gates in GitHub Actions; these parts are Claude's. (1) `refset.js`,
  `regress.sh`, the UI audit, the offline test, `band.js` and the fuzz exit 0 whatever happened, so a new tool,
  `tools/ci_verdict.js`, reads each one's output and fails the job. Its rules: every reference battle identical and the count
  right; every section of `regress.sh` present with an empty console-error line, no `BAD`, no `False` check, no failed replay
  check; the UI audit at 0 findings and 0 console errors in all four layouts (today's figures, so any new finding fails); the
  offline test with no external request; `VERDICT in band`; no fuzz finding and no determinism failure. No gate was edited.
  (2) The quick job runs `bash -o pipefail check.sh`, not `sh check.sh`: under `sh` a check piped through `tail` cannot fail.
  (3) Node is pinned to 22.23.4, the version the 120 replay on today; the version they were recorded on is not known.
  (4) Python packages are pinned in the workflow to the versions the gates passed on. (5) The nightly runs at 07:17 UTC.
  (6) GitHub's own actions (checkout, setup-node, setup-python, upload-artifact) are named by major version, `v7`, not by
  commit; naming the commit is stricter and costs an edit at each update. Found on the way and left alone: `fzsum.js` reads
  `fz_*.json` but `fuzz.sh` writes `f4_*.json`, so it sums nothing today.
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
- **How many battles the strategy bench fights, and the re-pinned seeds** (12 Nov). Chris said to re-pin and to use more
  battles; the figures are Claude's: 30 a plan as the gate (the historical orders end in an allied victory in 24 of 30 on
  seeds 2000 to 2029) and 12 in `check.sh`, which is why `check.sh` now takes about six minutes, not two; seeds 7 (test
  battle), 8 (Ligny) and 778 (speed test) as the nearest seed above the old one on which each check holds.
- **Inside the dice** (12 Nov): no draw in today's battles is keyed by a running id (a rider with no label would fall back
  to one; none exists). The player's orders are keyed by their recipient, so
  several to one general in one tick take turns; the commanders' own orders by what they say; a rider by what he carries and
  the minute he left. Three draws have no owner (gusts, the headquarters moving, Napoleon hit). The two older designs stay
  in `makeRng` for `tools/dice_compare.js` alone. `tools/test_dice.js` judges the field (untouched until the corps acts on
  the order; four fifths of the bodies outside it unchanged at 18:00, and more than under one sequence), because "the same
  draw has the same value" is true of keyed dice by construction. Known and left: `'gate broken'` and `'counter-charge'`
  can each be asked twice for one owner in a tick by two rules; identities are 32 bits, so two can rarely share a count.
- **`docs/METHOD.md` as a whole, and the four kinds of number in rule 4** (sourced, derived, calibrated, estimated) (12 Nov).
- **`docs/RULES.md` is a snapshot and the Claude doc stays the master** (12 Nov). The other way round is possible.
- **What `doc`, `approx`, `low` and `none` mean** (`docs/METHOD.md`, section 2), read off today's packs.
- **How simulation speed is measured** (`tools/ticktime.js`, 12 Nov). Seeds 1 to 6 of Waterloo and Ligny under the historical
  orders (1 and 2 in `check.sh`), because those are reference seeds and each Waterloo battle is held to `ref/p2_hist.json` as it
  is timed; every tick counts, the cold first ones included; the baseline in `results/ticktime_baseline.json` is the middle of
  three fresh processes; the warning is at 1.5 times the baseline (est.) and never fails the check.
- **How the desktop was measured (12 Nov):** frame times at clock speed 120 with one order given, 60 s a view; engines compared on
  seeds 1 to 3 with the historical orders, against Node; `tools/engines.js` as the standing way to repeat it.
- Slopes are steepened tenfold for the shading painted on the ground; the view from above draws heights three times life size.
- **The source pass's conventions** (12 Nov, `docs/SOURCES.md`): one row per number; today's sourcing graded in the packs'
  words; an outcome of improved, part or none; no page numbers until someone has checked them against the scan (the
  pages were read through the fetch tool's summary, not by eye); estimates left out unless a source turned up.
- **Snapshots made by converting the connector's read of a tab, not from its Markdown export** (12 Nov). The export
  arrives as inline base64 that cannot be written exactly. The conversion reproduces `docs/RULES.md` byte for byte, and
  matches the size of the brief's own export. Chris asked for his own export where exactness could not be had; that is
  what "Engine split" waits for.
- **The agent harness's stops (12 Nov):** fifteen minutes after the first dispatch since the last stop, or sixty minutes with
  none, or the minute the player names, or the end. The game page's own stops need the ★ and !! marks, which the contract
  does not carry, so the harness cannot copy them. Both figures are estimates.
- **What a turn of Napoleon's view holds (12 Nov):** the contract's snapshot and events rendered as text (dispatches, things
  seen and heard, his orders, his army by corps, the enemy list with ages, a sketch map), with the JSON beside it. Positions
  are given against the nearest named place. Brigades are listed only where a report has come since the last stop.
- **What "cannot leak" is taken to mean (12 Nov):** the turns are byte for byte the same when every unit, place and army
  morale is falsified whenever the harness is looking (`tools/test_agentplay.js`). It does not stop an agent with a shell from
  reading the code or the packs: the player's brief forbids that, and nothing enforces it.
- **The umpire's record reads two things outside the contract (12 Nov),** read only and after the battle: which true unit each
  of the commander's contacts is, and each order's real history. The contract has carried both since the loop measures were
  built the same day (`key` beside each true unit, `orders` in the truth); the harness has not been moved onto them.
- **A playtest's folder** (12 Nov): `question.md` written first, `replay.json`, `session.json`, the player's journal and report
  and the reader's notes unedited, and a summary (`docs/playtests/README.md`).

## Open questions (not decided)

- **Ligny's historical orders are not the commander's orders.** The plan goes straight to the engine (`via: 'order'`), so no
  rider carries them and the loop's order measures are empty for it (`tools/loop.js`, 12 Nov). Putting it through the order
  builder, as Waterloo's is, would change how Ligny fights.
- **The staff's estimate is almost never wrong, and is about 20 minutes wide** (12 Nov, `tools/loop.js`, 30 battles a plan):
  at Waterloo 341 of 359 of Napoleon's historical orders arrived inside the range the staff gave; under the packs' strategies
  all 119 at Waterloo and all 90 at Ligny did. That is close to true by construction: the range is the full spread of the writing dice plus a
  road and a cross-country ride, so only the ride can fall outside. Is a wide range that always holds what "delay is
  learnable" should mean, or should the staff give a narrower estimate that is sometimes wrong?
- **The order form shows the writing time already rolled** (`o.writtenAt`, set when the order is given), so the player's
  estimate is narrower than the staff could know. Small; noted while building the loop measures.
- **Three rules for who leads a corps.** `doctrine.js`, `ai.js` and `command.js` each work it out their own way, and
  `node tools/oob.js chain <battle>` lists where they part from the table. Waterloo: the generic commanders put Blücher, not
  Bülow, at the head of IV Corps; the historical runner gives the Guard no general. Ligny: the same for the Guard, and the command
  block sends d'Erlon's corps through a leader the battle does not place. One rule for all three may change how battles fight.
- **A leader riding with a brigade does two jobs:** it says where he is, and it gives that one brigade a bonus in the assault
  and in rallying. Separating them changes results.
- **The idle-army gap.** The allies never attack a French army that sits still, so the field ends a draw. Fixing it changes
  how battles fight.
- **Determinism across browsers: measured 12 Nov, and it does not hold.** The same seed and orders give the same battle within
  one engine, not across engines. Against Node, on seeds 1 to 3 with the historical orders: Chromium (Chris's desktop and the
  cloud) parts from Node in the last bit from about 14:00 and ends the same; SpiderMonkey and JavaScriptCore end seed 1 four
  minutes early with 3,656 more allied left. Grade and reason matched in all twelve. `docs/METHOD.md`, section 7, has the table.
  Open: does a seed need to mean the same battle on every device? If so the simulation needs its own Math functions, which
  changes results (class 3). Rule 6 in `CLAUDE.md` still says "verified in Node and Chromium"; its wording is Chris's to change.
- **Sources behind the rules doc.** The source pass of 12 Nov (`docs/SOURCES.md`) checked 107 numbers against primary
  documents and standard histories: 65 now have an openable source, 29 have one in part, 13 have none. It changed no value.
  Its 26 proposals are open: values that look wrong (the wind, the time an order takes to reach Grouchy, the Wavre fire,
  Zieten's and Bülow's strengths, some order-of-battle totals), targets that should be ranges, and works to obtain. No
  Dutch-Belgian source was opened, and no figure was checked by eye against a page image.
- **Generic commanders on every side win Waterloo for the French** (a marginal French victory in 29 battles of 30, roadmap,
  27 Oct; not re-run since). Fair counterfactual, or an attacker that is too strong?
  A battle outside June 1815 is needed to tell.
- **Brigades in the ground view are flat slabs.** Ranks of simple figures is the suggested next step; shadows are another.
- **Vegetation exists only where the map data has it.** Ligny has none recorded.
- **Frame rate: measured on the desktop 12 Nov; the phone and the tick budget are not.** On Chris's RTX 4070 Ti at 144 Hz the 3D
  view from above never missed its slot in 60 s (the pane capped it at 72 a second), and on the ground it held 144 a second with
  one 132 ms hitch (`docs/METHOD.md`, section 7). Still unmeasured: a phone; a full-size window; frame cost under the cap; the
  time a tick takes on a phone or in a browser. Simulation speed is measured on every change, in Node on the machine that runs
  `check.sh` (`tools/ticktime.js`, 12 Nov: Waterloo about 5 ms a tick, 95th centile 12 ms, on a two-core cloud Xeon), which
  shows a slowdown but says nothing about the roadmap's budget of under 20 ms on the phone.
- **Things the contract does not tell a client** (four found building the agent harness, 12 Nov; changing `view.js` is a class 2
  task of its own). Still open: an order reads "sent" from the minute it is given, while it is still being written (11:02 for
  an order written until 11:11, seed 1815), so a client cannot say when an order can still be torn up; dispatches carry no !!
  mark; a snapshot holds only the last twenty dispatches. Closed the same day by the loop measures (pull request 6): a
  dispatch now says whether it is starred, and the truth lists every order with when it was received and acted on. The
  agent harness's stops do not use the star yet.
- **How to run the first agent playtest.** The player's brief asked for a journal written before every move, and the model's
  safeguards stopped the agent on it. Options: a brief that asks only for an after-action report; a different model for the
  player; or Chris plays the first one through the harness himself.
- **Left by the dice change (12 Nov).** (1) Waterloo's Prussian losses sit on the band's upper edge whichever dice are used:
  over seeds 1000 to 1499 the median is 7,929 and 236 of 500 battles lose more than 8.0k; over seeds 1500 to 1999 it is 7,816
  on the old dice and 7,843 on the new. Resampling 60 from the 500 puts the median over 8.0k in 38% of samples (10% on the
  old dice), so `tune.js` at 60 battles will often fail that check: more battles, or a look at the band. (2) Checks that
  hang on one seed: the test battle's "Green halts out of sight" (`test_tools.js`; holds on 32 of 60 seeds, old dice and
  new), the contract's "the commander perceives part of what happens" at Ligny (`test_view.js`; fails on seeds 8 and 9
  of 7 to 14 on the old dice, on 3, 5 and 7 of 1 to 9 on the new), and the speed test's glide check, which needs a unit on the
  move at 13:32. Each will trip again at the next change to results unless it is made to hold on any seed. (3) Records made on the old dice were not redone: `results/engines/` (the same battle in four
  engines), `results/loop_*.json` and the numbers quoted from them, `results/ticktime_baseline.json`, and the playtest in
  `docs/playtests/`. Their seeds now fight different battles. (4) The working behind the figures in (1) was done in the build session
  and is in pull request 15, not in a tool: the bootstrap and the resampling are not repeatable from the repository.
  (5) `replay.js` passes `dice` through to the engine, so a replay file could ask for one of the two old designs; no file
  the game writes does.
- **Which comes next:** moving the 2D map onto the contract, or the idle-army rule. Chris has not chosen.
