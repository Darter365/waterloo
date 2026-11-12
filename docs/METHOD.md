# Method

How this project checks its history, its simulation and its play, and which of Claude's tools to use for what. `CLAUDE.md`
holds the rules checked on every change; this file holds procedures, read when the work calls for them. Drafted by Claude on
12 November 2026 from research into wargame design, simulation validation and game testing (sources at the end). It stays
under "Claude's choices awaiting Chris" in `DECISIONS.md` until he confirms it.

## 1. What the model owes the history

- The game models a command problem: an agent (the player's commander), his aims, the choices open to him, and what in the
  world helps or blocks them. Fidelity is owed first to that: delay, report error, order transit, how subordinates read orders.
- Below the player's horizon, design for effect. A brigade fight needs the right result and duration, not a mechanism for
  every cause. A proposal that adds detail says which player decision it serves.
- The map makes claims about process. A 3D view makes claims about how the field looked, which need their own evidence. Keep
  saying what is survey and what is scenery, for every new visual.
- Each battle gets short designer's notes: sources used, points the sources dispute, what was abstracted and why. (Not built.)

## 2. Numbers and sources

- **Four kinds of number** (rule 4): *sourced* names a work someone can open; *derived* shows its working from sourced values;
  *calibrated* was tuned so a battle lands in a band, and names the band; *estimated* is judgement, marked `(est.)`.
- **Confidence uses the packs' own words** (decided 12 Nov): `doc`, taken from a document or survey someone can open;
  `approx`, placed or sized by eye from one; `low`, an interpretation of the record; `none`, invented (the test battle).
  These meanings are read off today's packs (est.). The packs spell the field two ways, `conf` and `confidence`.
- **Citing.** Name the work and say whether it was opened in this session or recalled. No page numbers or quotations from
  memory. Where accounts disagree, store the range and who says what, and look for a source from each army's tradition.
- **Known weak spots.** `docs/RULES.md` cites Wikipedia, web articles and a web copy of Keegan for some sourced values, and a
  "research brief" that is not in the repository. Those are `approx` at best until a source pass replaces them (section 8).

## 3. Validation

Four questions, after Sargent: is the idea of the model sound, does the code do what was meant, do the results match the
world, is the data good.

**Exists.** Determinism, 120 reference battles replayed by state hash, the invariants fuzzer, the lint, the contract's fog
tests, the band, the multi-battle tuner, the strategy bench. `docs/RULES.md` ("Calibration and testing") also plans a
bad-play suite, a skilled-play suite (should win 25 to 40%) and a sensitivity sweep. Look there and in `tools/` before adding
a check.

**To add** (none built unless it says so):

- **First contact.** When a new battle's data is complete, run it before any tuning and save the result. It is the only
  untuned evidence that battle will ever give.
- **Extreme cases** on the bench: overwhelming odds win, an army with no orders does not win, zero visibility stops reports.
- **Rank the sensitivity sweep by confidence.** A constant that moves the bands a lot and is graded `low` or `(est.)` is where
  research time goes first.
- **Turning points.** `band.js` shows timings against 1815 but does not pass or fail on them. Watched, or banded: Chris's call.
- **A reviewer who did not do the tuning.** A fresh session or subagent, given results and sources but not the tuning history,
  says whether the battle reads as plausible.
- **Counterfactuals.** Confidence falls with distance from the historical orders. The strategy bench's expectations are design
  judgements, not history; label them so.

**Set aside** by Chris on 12 Nov: seeds and a battle held back from tuning. Raise again when a battle outside June 1815 exists.

## 4. Comparing two versions or two plans

- Same seeds, enough battles, and the spread with an interval, not one battle or one median. Say which seeds, and whether
  they are the calibration seeds (1000 to 1499).
- State what a run is expected to show before running it.
- **Dice** (approved 12 Nov, not built). Today one sequence feeds every draw, labelled by purpose (`rnd('shock')`) only for
  counting, so one changed order re-rolls all later luck. Two designs: a stream per purpose, or each draw keyed by seed,
  purpose, unit and tick. The second is what the literature on agent models recommends, because within one purpose a changed
  order still shifts who gets which draw. The task measures both before choosing. Until it lands, compare distributions.

## 5. Measures of the core loop (approved 12 Nov; built 12 Nov as `tools/loop.js`)

Computed from the contract and the event stream alone, never from engine objects, so they draw no dice: `node tools/loop.js
<battle> --check` shows that a measured battle ends on the same state hashes as the same battle not measured, and `check.sh`
runs it for Waterloo and Ligny. Each measure tests one of the roadmap's "rules the loop must keep".

    node tools/loop.js <battle> [--n 30] [--seed 2000] [--plans idle,historical] [--out file]

It fights the battle under no orders, the historical orders and each of the pack's `strategies`, prints each measure's median
and 10th to 90th centile over battles, and saves `results/loop_<battle>.json` (no clock time in it: the same command gives
the same file). Seeds start at 2000, the strategy bench's; they are not the calibration seeds.

| Measure | How it is computed | Loop rule it tests |
| --- | --- | --- |
| Belief error | Every 10 minutes, the distance from each believed position to the true one: his own brigades by id, the enemy by the key the truth carries beside each unit. Reported for the middle body and for the body at the 90th centile (most brigades stand still, so the middle one hides those that moved), averaged over the day. Beside it, the share of the enemy's horse and foot he has no mark for at all. | Fog is fair |
| Report staleness | At the same readings, the age of the newest sighting of each enemy body on his map, and of the newest report of each of his brigades; the median body, averaged over the day. | Fog is fair |
| Order latency | Given to received for every order that arrived; given to acted on for orders without conditions. Against the staff's estimate as first given: the share that arrived, and that were acted on, inside its earliest-to-latest range, and the minutes from the middle of that range. | Delay is learnable |
| Orders overtaken | For an order with an objective, the situation there is who holds the place and how many enemy horse and foot stand within 800 m. Overtaken: the true situation when it arrived differs from the true situation when it was given. Kept apart from "written on a false picture": belief and truth already differed when it was given. The first is the price of delay, the second of fog. | Delay is learnable |
| Decision gaps | The stretches between dispatches the staff starred, from the battle's first minute to its last: the longest, the median, and stars an hour. | Orders interact; good play gets credit |

**Thresholds, all (est.)** and all in `DEF` at the top of the tool: readings every 10 minutes; 800 m round an objective; a
changed situation is a change of holder, or the enemy's strength there at least doubling or halving by at least 1,000 men;
"a choice worth making" is read as a starred dispatch reaching the commander.

**What the contract gained for this** (plain values, checked in `tools/test_view.js`): on the commander's side, each order's
objective, its count of conditions and the staff's estimate (the order form's ranges, from his beliefs, never from dice
already drawn), and whether each dispatch was starred; on the umpire's side, every order with the minutes it was really sent,
received and acted on, and beside each unit its key in the commander's picture and whether it is a crewed arm.

**Limits to keep in mind when reading a result.**

- A star is news, and news is only half of a choice: the tool does not ask whether he had anything free to order with.
- The staff's estimate in the contract is a second copy of the order form's (`_game_orders.js`, `expectSpec`), without its
  guesses for bombardment conditions. They become one when the page moves onto the contract (roadmap step 1).
- The order form shows the true writing time as soon as an order is given (`o.writtenAt`), a die already drawn. The contract's
  estimate does not, so it is a little wider than what the player sees today.
- An order whose historical plan goes straight to the engine (Ligny's: `via: 'order'`) is not the commander's order, so it has
  no latency and cannot be overtaken. Only plans given through the order builder are measured.
- Orders to headquarters itself and to a commander off the map have no estimate and are left out.
- Overtaken is judged at the objective only. A recipient whose own corps has changed (broken, already engaged) is not seen.
- One run of 30 battles a plan on each battle (seeds 2000 to 2029) is the whole evidence so far; the numbers are in the pull
  request that added the tool, not here.

## 6. Playtests

- One question per session, written down first. The player thinks aloud or writes an after-action report; nobody explains the
  game during play.
- Record what the player believed against what was true, which orders arrived too late, where there was nothing worth
  deciding, and where a result felt unearned. Keep observation apart from the proposed fix.
- **Agent players** (approved 12 Nov) play through each view: Napoleon's (`snapshot('chief')` and its events only), the
  umpire's (truth, for judging the engine), and Wellington's once the allied side is playable. An agent tests whether the fog
  leaves enough to plan with and whether a plan can be dominant; it does not measure whether the game is fun. Chris and a
  newcomer do that.
- Fog that leaves nothing to reason from is a defect, not realism.

## 7. Performance and execution

- **The budget exists.** The roadmap gives about 13 ms per 2-minute tick (27 Oct) and a budget of under 20 ms on the phone.
  No tool was found that checks it on each change. Add one to `check.sh`: median and 95th centile over fixed seeds, on a
  named machine, with the result kept in `results/`.
- Simulation speed sets how much validation is affordable: `band.js 500` is listed as "long".
- **Frame rate on a real GPU has never been measured** (the tests use software rendering). The built-in browser on Chris's
  desktop can measure it (section 8).
- **Determinism is verified in Node and Chromium only.** The simulation calls `Math.sin`, `cos`, `pow`, `exp`, `log`,
  `atan2` and `hypot`, whose results the language leaves to each engine. A battle may not replay identically in Safari or
  Firefox, and a Node upgrade could move the references. Test before relying on seeds across devices; record the Node
  version the references were made on. (Read from the code; not tested.)

## 8. Claude's tools and what each is for

Decided 12 Nov: use them fully. Check what the session actually has before assuming.

| Work | Use | Notes |
| --- | --- | --- |
| Finding sources | Web search and fetch; deep research for a pass across many works | Open the page; a search snippet is not a source |
| Reading scanned books and maps | The PDF tools; image search for reference only | Nothing copied into the game without a licence |
| Chris's own documents | The Claude Docs connector (rules doc, roadmap, lessons from Ligny); Google Drive and Docs | The Claude docs are the masters; `docs/RULES.md` is a snapshot |
| What was said before | Search past conversations in the project | Before asking Chris to repeat himself |
| Build work | A Claude Code session on the repository, one task per branch | `CLAUDE.md`, Merging |
| Parallel or independent work | Subagents | Two battles' data at once; the reviewer before a merge; the tuning-blind review |
| Long builds and standing checks | Scheduled tasks | A build that ends in a pull request; a nightly band and fuzz; a weekly source pass; copying `docs/` into the project |
| Repeated procedures | Skills | Add a battle, a results-changing change, a release. Repository skills do not load in a project thread, so the procedure itself lives in `docs/` |
| Gates Claude cannot skip | GitHub Actions on every pull request, as required checks | Not set up. Needs Chris to change a repository setting |
| What the cloud cannot measure | The built-in browser and computer use on Chris's desktop | Frame rate on his GPU; other browser engines; a native editor later |
| Showing Chris a result | Artifacts | A dashboard for a batch of runs; the branch's built page to try before it merges |
| Telling Chris | A push notification | After a merge, a revert or a failed gate |
| Review and design | Account skills where present: code review, testing strategy, deploy checklist, design critique, accessibility review, statistical analysis | A session may not have them; say which were used |

Monarch and Robinhood are attached to scheduled tasks by default and have nothing to do with this project. Never call them
from it.

## 9. A task brief

```
Task: <one outcome>
Class: 1, 2, 3 or 4 (CLAUDE.md, Merging). Add "show me first" if Chris wants to see it before it merges.
Acceptance: <what must be true, with numbers; for class 3, copied from docs/DECISIONS.md>
Set up: attach Darter365/waterloo with push access; read CLAUDE.md, docs/DECISIONS.md and docs/METHOD.md; run
  source/claude-setup.sh by hand if the session is not bound to the repository.
Hand over: the pull request with what was verified (numbers) and what was not; screenshots of anything the player sees;
  then merge or wait, by class; a push notification with the result.
Do not use the finance connectors.
```

## Sources

- Sargent, "Verification and validation of simulation models", Journal of Simulation 7 (2013).
  https://ics.uu.nl/docs/vakken/msosi/VerificationValidationSargent.pdf
- Sabin, "The continuing merits of manual wargaming". https://www.professionalwargaming.co.uk/Manual-Wargaming-Sabin.pdf
- McCall, the Historical Problem Space framework.
  https://gamingthepast.net/theory-practice/the-historical-problem-space-framework-for-game-analysis/
- Chapman, Digital Games as History (Routledge, 2016).
- The Dupuy Institute on validating combat models. https://dupuyinstitute.org/2017/10/26/validating-trevor-dupuys-combat-models/
- White, "On Maps and Manoeuvres: The Challenge of Mapping Waterloo", British Journal for Military History.
  https://journals.gold.ac.uk/index.php/bjmh/article/download/673/795/886
- Klein et al., common random numbers in agent-based models (2024). https://arxiv.org/html/2409.02086v2
- De Mesentier Silva et al., "Exploring Gameplay With AI Agents" (2018). https://ojs.aaai.org/index.php/AIIDE/article/view/13034
- International Kriegsspiel Society, an umpire's notes. https://kriegsspiel.org/?p=2920
- Claude Code documentation: skills, subagents, hooks. https://code.claude.com/docs/en/skills
- ES Discuss, accuracy of the Math functions. https://esdiscuss.org/topic/es6-accuracy-of-special-functions
