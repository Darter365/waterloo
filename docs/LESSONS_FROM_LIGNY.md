<!-- Snapshot taken 12 November 2026 of the "Adding a battle: lessons from Ligny" tab (revision 34) of the Claude doc "Adding a battle: lessons from Ligny", https://claude.ai/artifact/PgKerAsVzv1zorfpC8mWPE.
     The Claude doc stays the master; this copy can lag it. Made by reading the tab through the Claude Docs connector and
     converting it to Markdown with a script (method and checks: docs/SOURCES.md, "Snapshots"). Not edited by hand. -->

# Adding a battle: lessons from Ligny

Oct 28, 2026 · @Chris

A working log of what it takes to add a battle to the engine, written while Ligny (16 June 1815) is added: the steps, what was hard, where the engine's assumptions did not fit, and where the simulated battle departs from the historical one. It is meant to make the next battle easier.

## The steps

Adding Ligny took ten steps, in this order. Research and terrain took about half the effort; making the recorded battle come out right took most of the rest. The file names are under `source/sim/`.

1. **Sources first.** Find an order of battle by regiment, a timeline of the key events, and the losses as ranges. Note which source each figure comes from.
2. **Heights.** Fetch a grid through the web tools (EU-DEM via Open Topo Data, about 40 requests for 10 × 8 km). Check it against heights fetched separately, and remove only spikes beyond all eight neighbours. Write `packs/maps/<id>.grid.asc`.
3. **Ground.** Trace streams from the grid. Place villages and landmarks from two sources, or one source plus a distance check. Draw roads from a period map if one can be read. Mark every estimate as est. in `<id>.geojson` and `<id>.map.json`, then run `node tools/map.js build`.
4. **Order of battle.** One CSV row per brigade or battery: strength, position, formation, quality, and arrival time for forces off the map (`#force` lines). Then run `node tools/oob.js import`.
5. **Leaders.** Add new commanders to the leader book with estimated traits, and raise its version.
6. **The battle pack.**
   - Places: sections with cover and capacity. Mark open villages `street`; cover 0.3 or less means loopholed walls.
   - Objectives, roads of arrival and retreat, and sides with posture, reserve and habits (`feeds`, `retake`).
   - Start, weather, victory terms and metrics.
   - Recorded orders as plan rules, timed about 30 minutes before the action they caused.
   - `commanders.generic`, and targets marked PROPOSED.
7. **Register and validate.** Add the packs to `packs/all.js` and to `build_game.py`'s PACKS, then run `node packs/validate.js <id>` until it is clean.
8. **Fight it.** First with generic commanders (the lab, or `tools/fight.js`) to prove it loads. Then from the recorded orders (runner `plan`). Trace losses by cause before changing anything.
9. **Calibrate.** Change only what a source justifies, and record each change with its reason. Judge with `node tools/tune.js --battles <id> --n 100`. Check that Waterloo is unchanged with `node refset.js check` on a snapshot of the code.
10. **Ship.** Add self-tests, then run `check.sh`, the browser suite (`regress.sh`) and `deploy.sh`. Publish the lab. Then the full game: stage 2, below.

## Challenges by stage

Research and data gathering took more care than code. The workspace that builds the battle can only reach GitHub and the package registries, so every map number and coordinate has to come through the web tools. Those tools pass each page through a summariser, which can repeat or invent numbers, so every value needs a cross-check. The table grows as the work goes on.

| Stage | Challenge | How it was handled | Lesson for the next battle |
| --- | --- | --- | --- |
| Orders of battle | The best-known summary (Wikipedia) names corps and brigades but gives only army totals (68,000 French, 84,000 Prussian) | Brigade strengths from two fuller lists: the French by regiment (napoleonistyka mirror), the Prussian by regiment as ranges (Hofschröer after Lettow-Vorbeck) | Find a regiment-level list first; army totals alone cannot place brigades |
| Orders of battle | Sources disagree: French 60,800–68,000, Prussians 78,000–84,000 at Ligny; French losses 8,300–12,000 | Keep each figure with its source; build from regiments and check the sums against the totals; targets become ranges | Treat every total as a range, and record which source each unit's strength came from |
| Orders of battle | Prussian strengths come as ranges (e.g. 2,027–2,330 men), which the page does not explain | Assumption to check: the lower figure is the strength on the day, after the marches and the fighting of 15 June | Write down the reading of an ambiguous figure as an assumption, and test the outcome with both |
| Coordinates | No geocoder reachable from the workspace; OpenStreetMap's refuses automated reads; French Wikipedia shows no coordinates as text; one English Wikipedia fetch returned a neighbouring village's coordinates | English Wikipedia where it states them, the US NGA gazetteer, the Mills Archive for the Naveau mill; each place checked against its neighbours' distances and the brook's course | Take each place from two sources, or from one source plus a distance check; never one fetch alone |
| Elevation | Elevation services are unreachable from the workspace | The EU-DEM 25 m dataset through the Open Topo Data API, fetched through the web tool 100 points at a time | Validate the grid (spikes, smoothness, known heights) before building on it; the summariser can garble a number |
| Elevation | The service allows about one request a second; batches of four or five parallel fetches failed | 40 rows of 80 points, two or three at a time; failures retried after about 20 s | Budget about 40 requests for a 10 × 8 km field at 0.002°; fetch rows in small batches |
| Elevation | A spike filter (3 × 3 median) flagged 27 points, most of them real valleys running along a row | Removed only points beyond all eight neighbours (one); checked three heights fetched separately: Ligny 136.1 against 136.2 m, Brye 149.2 against 149.3, Sombreffe 146.9 against 146.4 | Check the grid against points fetched on their own; never median-filter a valley away |
| Terrain | No source gives the Ligny brook's course as coordinates | Traced from the heights by flow routing; it passes the villages in the order the accounts list them, which checks both | Trace streams from the elevation grid, then check them against the named places |
| Roads | No period map (Ferraris, 1770s) could be read here, and modern roads would mislead | Roads estimated from descriptions, e.g. “a dirt road from Fleurus to the paved Namur road at the Point du Jour, 100 m east of Sombreffe”; marked est. | Trace a period map into GeoJSON before calibrating anything that depends on movement |
| Places | Four places have no coordinates in any reachable source (le Hameau, Mont-Potriaux, Boignée, the Point du Jour); the Bussy mill only a description | Placed on the traced brook between their neighbours or at the described spot; the mill at the high point east of Brye (158.7 m); all marked est. | Mark every estimated place in the files, so it can be replaced when a source turns up |
| Orders of battle | Units that came on late or never fought (d'Erlon's I Corps, Lobau's VI Corps) have no Ligny strengths of their own | Reused their Waterloo rows, since they were not engaged on the 16th | Share rows between battles of one campaign where a unit did not fight in between |
| Leaders | Seven new commanders: Vandamme, Gérard, Grouchy, Pajol, Exelmans, Girard, Thielmann | Added to the shared leader file with traits estimated from their reputations; the file's version raised to 1.1 so replays note the change | Traits are interpretations: check each against a second battle the man fought (Wavre for most of these) |

## Engine assumptions that did not fit

The roadmap expected Ligny to need no engine change. That held for the generic commanders: Ligny loaded and fought with no engine edit. The historical battle, fought from the recorded orders, met seven places where Waterloo was still built into the engine or its data conventions (first table), and six where the engine's model of the fighting or its tools did not fit Ligny (second table). Each was fixed so that all 120 Waterloo reference battles still replay exactly (checked: 120 of 120).

| Assumption | Where | What happened at Ligny | Fix |
| --- | --- | --- | --- |
| The allied army (“AL”) is the one the generic doctrine commands | ai.js | Ligny has no AL; the Prussians would have had no commander | The battle pack names them: `commanders: { generic: ['PR'] }` (Waterloo: `['AL']`) |
| Start-of-battle code picks units by id (`bruno`, `aGuard`), guarded by “if it exists” | ai.js | Ligny has its own Bruno (d'Erlon's hussars) and its own aGuard (the Guard's foot guns): Waterloo's screen and battery split would have run on them | Moved into Waterloo's pack as `setup.screens` and `setup.detach` |
| A metric for La Haye Sainte read the place by name every tick | ai.js | Crashed on the first step | A new metric kind, `held`, set in the pack |
| Off-map forces only ever arrive | ai.js | d'Erlon's corps came on, then was recalled and left by the way it came | A `retire` order may name its own `exit` |
| Plans run only through the order builder and its command layer | ai.js, script.js | The command layer's riders, staff and headquarters posts are Waterloo's: riders rode to Waterloo coordinates, off the Ligny map, and orders took three hours | Plans may go straight out as orders (`via: 'order'`), ticked by ai.js; a second side's recorded orders install with the first (`withHistorical`) |
| A section with cover 0.3 or less is a loopholed wall | engine.js | Fire cannot clear it, assaults cannot take it in good order, and a garrison under cannonade shelters there. Ligny's churchyards at 0.3 made Saint-Amand hold all day | Ligny's sections set to 0.35. Better: an explicit `fortified` flag on a section (an engine change for later) |
| Plan times are when orders are sent | plans.js | The accounts give when things happened, and an order takes about 30–45 min to write, ride and act on, so a rule at 14:30 attacked at 15:04 | Rules set about 30 min before the recorded action. Better: write the recorded time and let the tool subtract the expected delay |

The second kind showed up only once Ligny was fought from the recorded orders and its losses were traced by cause.

| Assumption | Where | What happened at Ligny | Fix |
| --- | --- | --- | --- |
| A village assault is a siege: attackers stand in the open, the garrison fires from cover | engine.js (fire) | The French lost about 12,000 men a battle to garrison musketry; the Prussians in the villages lost about 1,100 to French musketry. Gérard never took Ligny | A section can be marked `street` (an open village). Foot within 60 m of its edge take cover (1.5 × the section's) and fire as a garrison does (0.6 of their men). French losses fell from 19.6k to 15.5k, and Ligny falls |
| A marginal win is the defender's line taken, with no defender within 250 m | engine.js (grade) | The slope above the brook was never taken: garrisons do not count as foot on a line, and Prussian reserves always stood within 250 m. Every battle was a draw | `victory.marginal` may name places held at nightfall (Ligny: the village itself) |
| Only the attacker gives up the field | engine.js (grade) | A Prussian withdrawal would have been graded a draw | `victory.drawnOff`: the defender drawing off is at least a marginal win for the attacker |
| A side's habits replace its generic behaviour wholesale | doctrine.js | Giving Blücher Wellington's `reoccupy` habit switched off the generic counter-attack, so he never counter-attacked | No `reoccupy` for Blücher; the generic retake reads his numbers from the pack (`retake`: every 20 min, even while the French are still attacking) |
| A metric records the first time something happened | engine.js (metrics) | Ligny changed hands up to five times; the accounts give its last fall | A `taken` metric with `every: true` keeps the last time (`lignyLast`) |
| Names in Waterloo's command code belong to Waterloo | tools/lint.js | Grouchy and Gérard command at Ligny, so the code in command.js and orders.js that names them now counts as battle names (+8) | Allow-list raised to 323 for stage 1; stage 2 moved that code into the pack (16 left) |

At the end of stage 1 the main game still assumed Waterloo: its order builder listed Waterloo's recipients (Reille, d'Erlon, the grand battery, Grouchy off the map), its headquarters posts and its sectors. Stage 2, below, moved them into the battle pack.

## History against the sim

Fought 100 times from Napoleon's recorded orders against the generic Prussian commander, Ligny ends as it did in 92 battles: a French win. Seven of the nine proposed checks are in band. The two misses have one cause: the engine's village falls too cleanly. The French pay for it in losses, and Ligny falls about two hours early. Seeds 1000 to 1099; times are medians.

| Measure | 1815 | Sim (100 battles) | Why they differ |
| --- | --- | --- | --- |
| Result | French victory; the Prussian centre broken at Ligny; the army drew off north in the night, in fair order | French win 92% (85% marginal, 6% outright, 1% decisive); draw 8% | Close. A marginal win needs the French in Ligny at nightfall; in 8% the Prussians hold it at the end |
| French killed and wounded | 8,500–12,000 (sources range 7,000–13,000) | 15.5k (p10 12.6k, p90 18.5k) | Too high. The columns spend hours at the village edges, and Prussian guns on the heights hit them on the way in: about 7,000 of the losses are from artillery |
| Prussian killed and wounded | about 16,000 (sources range 12,000–25,000), plus about 8,000 who left in the night | 16.5k, plus 3.2k taken or straggling | In band. The night's desertions fall after the battle ends at 21:30 |
| Saint-Amand | Taken within about a quarter of an hour of the first attack; fought over all afternoon | First taken 15:14; changes hands; last taken 17:32 (p90 20:08) | Close |
| Ligny | Entered about 15:30; fought over until the Guard broke in, 19:45–20:30 | First taken 16:18; retaken by the Prussians in 35%; last taken 17:34 (p90 20:34) | Early. The engine's village is held section by section; once the French hold every section, the Prussians can only retake it by assault. In 1815 both sides were inside for hours |
| The Guard's attack | The decisive stroke, in the evening storm | Usually goes in against a village already French; thrown back in 7% | Follows from Ligny falling early |
| The Prussian army | Not broken in the field; drew off in order | Breaks about 21:00 in 7% | Close |
| Thielmann's III Corps | Little engaged; Luck's brigade down the Fleurus road about 18:00 | First fires about 16:24 | Not a real mismatch: "engaged" is its first shot, a horse battery opening on Pajol's cavalry at about 1,400 m. Guns and cavalry skirmished on that wing all afternoon in 1815 |
| d'Erlon's I Corps | Seen about 17:30, taken for the enemy, recalled before it fought | Seen 17:30 in every battle; never engaged | As recorded (it is in the orders) |
| The Bussy mill (Blücher's post) | Reached by the French after dark | Never taken | The Guard climbs out of Ligny too late to get there before nightfall |

What would close the gap, in the order to try it:

- Let both sides hold sections of one village at once, and fight from section to section, instead of the attacker standing outside until the place is cleared. That is an engine change, and it would also touch Plancenoit.
- Mark Plancenoit (Waterloo) as an open village too. Its fight was the same kind as Ligny's. That changes Waterloo's results, so it needs Waterloo recalibrated and new reference battles.
- Revisit the targets with Chris. The French-loss band rests on sources that disagree by almost a factor of two.

## Stage 2: Ligny in the full game

Ligny can now be played as Napoleon in the full game, on its own page beside Waterloo's. The engine's model of the fighting did not change. The work was moving what was still Waterloo's out of the command layer and the game page into the battle pack, as two new blocks, `command` and `game`. All 120 Waterloo reference battles still replay exactly, and the browser suite's Waterloo texts are word for word as before.

What it took, in order:

1. **The command block.** Name the chief and his staff's posts, whom he can write to and what kind each is (corps, cavalry, battery, a marshal over a front, a force off the map, headquarters, the whole army), the retreat road, and the staff's guesses about unidentified troops. Ligny: Napoleon at the Naveau mill, writing to Vandamme, Gérard, Grouchy, Milhaud, Drouot and Lobau, with no field commander between.
2. **The game block.** The title, the briefing for each start, the staff's remarks, the letter heading, the panels' groups, the map's views and labels, and the 1815 figures that the verdict and the after-action report set beside the result.
3. **The app.** Nothing to add since 30 October: the game lists every battle with a game block on its start screen, in date order, and `#<id>` at the end of its link opens one. Run `node packs/validate.js <id>`, which checks both blocks, and `switchtest.py` (in `regress.sh`), which switches between the battles.
4. **Play it headless.** Briefing, orders, letters, stops, a hand-over to the recorded orders, the verdict, and the after-action report's check that the battle fought again from the order log comes out the same. Ligny's is `lignytest.py`, now part of `regress.sh`; copy it for the next battle.
5. **Measure the recorded battle through the command layer** (100 battles), not only in the lab. The two differ (next section).

Fifteen things were still Waterloo's, or broke when Ligny used them. Most were names and numbers in code. One changed the player's battle itself and showed only when it was measured: the enemy's recorded orders (the third-last row).

| Assumption | Where | What happened at Ligny | Fix |
| --- | --- | --- | --- |
| Napoleon writes to Ney, and Ney to the corps of his front | `command.js` | Ney is at Quatre Bras; Napoleon writes to each corps himself | `command.chief`; `command.front` names a field commander and his sectors, if there is one (Ligny: none) |
| Orders go to Reille, d'Erlon, Lobau, Kellermann, Milhaud, the grand battery, or Grouchy off the map | `orders.js` | Only Milhaud and Lobau command at Ligny; Grouchy is on the field, with the cavalry of the right | `command.recipients`, each with a kind |
| Headquarters is at Rossomme, La Belle Alliance or Le Caillou | `command.js` | Riders set out from Waterloo's coordinates | `command.posts`: the Naveau mill, Fleurus, the rise south of Ligny |
| A force off the map answers by rider (Grouchy: his ride, his march, the chance he is blocked) | `orders.js` | No army off the map to write to | `command.offmap`, with Waterloo's numbers moved as they were |
| Unidentified troops in the east are Prussians; the enemy comes from the north or the east; the allied crest | `command.js` | Ligny's enemy is north, across a brook | `command.guess`, `toward`, `flank`, `crest`, `intel` |
| Nation words and corps names ("British", "Reille's II Corps") | `command.js` | Prussian troops would have been named in Waterloo's words | A `word` per nation in the nation book; `command.corpsName` |
| The retreat is on Charleroi by the high road, from Rossomme | `orders.js` | Ligny's retreat goes by the Fleurus road, from Fleurus | `command.retreat` |
| The Guard's attack means Waterloo's Guard battalions | `orders.js`, `ai.js` | Ligny's Guard has its own unit ids | `command.guardAttack`; a `guardAttack` metric set when it goes in |
| Briefings, staff remarks, letter heading, panel groups, map views, the 1815 figures in the verdict and the review | `_game*.js` | All of it described the 18th | The `game` block. Staff remarks became data with a small condition language (after a time, a place held, an order sent), plus five every battle has: silence, an order not acknowledged, heavy losses, dusk, retreat |
| One game page | `build_game.py` |  | First one page per battle; since 30 October one app for all of them. Each battle runs in its own closure that can be stopped, and the start screen swaps one for another without a reload |
| The after-action report's re-runs fought Waterloo | `replay.js` | The re-runs would have fought the wrong battle | The battle is passed through; grades come from the pack's victory terms |
| An option passed as undefined replaced its default | `command.js` | A re-run that named no staff crashed writing Napoleon's first order (found while measuring Ligny) | Undefined keeps the default |
| The other side's recorded orders, and orders from outside both armies, came with Napoleon's plan | `script.js`, `replay.js` | In the player's own battle Blücher never made his counter-strokes, and d'Erlon, recalled by Ney on the day, stayed on the field all evening | A plan can be `always` (Ney's recall); the game installs the computer side's recorded orders from the start; an order from off the map (`offField`) crosses no ground. Ligny's lab results are unchanged |
| The validator's metric list | `packs/validate.js` | A false error on Waterloo: a metric named only inside a side's habits | Habits are scanned for metric names |
| The game page and its re-runs each set the battle up, in two copies of the same steps | `_game.js, replay.js` | Once the enemy's recorded orders went into the re-runs' setup only, the after-action report said the battle fought again did not come out the same | The game uses the re-runs' setup. The report's re-run check is the test that caught it |

Battle names in engine code fell from 323 to 16 (on 153 lines, now 10). What is left: one Waterloo rule still in `ai.js` (the north gate of Hougoumont broken at the first contact), dice labels that keep Waterloo's names, example names in comments, and a locale string the lint misreads.

## History against the game

Through the command layer, Napoleon's recorded orders give the same battle as in the lab, a little cheaper for the French: they still win (95%), still lose more men than in 1815, and Ligny still falls about two hours early. The Guard's attack goes in within half an hour of the record in both. Both columns are 100 battles on seeds 1000 to 1099; times are medians. "Game" is what the full game fights as "Napoleon's own orders": the same rules, with each order written by the staff and carried by a rider on the map.

| Measure | 1815 | Lab (no command layer) | Game (command layer) |
| --- | --- | --- | --- |
| Result | French victory; the Prussians drew off in the night | French win 92%, draw 8% | French win 95%, draw 5% |
| French killed and wounded | 8,500–12,000 | 15.5k (p10 12.6k, p90 18.5k) | 14.0k (p10 11.6k, p90 17.0k) |
| Prussian killed and wounded | about 16,000 | 16.5k | 15.4k |
| Ligny taken for the last time | 19:45–20:30 | 17:34; retaken in 35% | 17:32; retaken in 27% |
| Saint-Amand taken for the last time | fought over all afternoon | 17:32 | 17:46 |
| The Guard attacks | about 19:30 | 19:58 (p10 19:52, p90 20:02) | 19:58 (p10 19:52, p90 20:02) |
| The Prussian army breaks | not broken | 7% | 3% |
| An order, sent to acted on (20 battles) | about 30–45 min (est.) | French 44 min, Prussian 34 | French 44 min, Prussian 38; 2 riders lost in 20 battles |
| d'Erlon's I Corps | recalled by Ney before it fought | recalled 18:30, gone by about 19:20 | the same |

What the comparison says:

- **The village gap carries into the game.** Ligny falls at 17:32 against 17:34 in the lab. Stage 1's diagnosis stands: each section of the village is held by one side, and the attackers fight from outside until it is cleared, where in 1815 both sides were inside for hours.
- **The French losses differ by about 1,500, and the cause is not traced.** Both runs use the same orders and the same executor (`ai.js`), and the delays agree within a few minutes. The game adds riders who ride the roads and can be lost, and the command layer's reports and sightings.
- **One played battle as a check.** Attack Saint-Amand and bombard Ligny at 14:00, then Napoleon's orders from 16:00 (seed 4242): a marginal French win, French 14.0k and Prussian 13.0k killed and wounded. The after-action report's re-run check passed, after the fix in the last row of the table above.
- **Not in the game:** ordering d'Erlon. His corps comes and is recalled at 18:30 as on the day, so the best-known what-if of Ligny (d'Erlon on the Prussian right) cannot be played yet. Ney's battle at Quatre Bras and the Prussian retreat in the night are not modelled.

## Recommendations for the next battles

The cheapest gains come before any code: decide the grade terms and targets from the record first, and get a period map. The engine changes below are ordered by how many of the next battles need them.

| Recommendation | Ligny's evidence | Matters most for |
| --- | --- | --- |
| Write the victory terms and targets from the record before the first fight, and check that each condition can actually be met | Ligny's first marginal line could never be taken, so every battle was a draw until the terms changed | Every battle |
| Give contested places both a first-taken and a last-taken target | Ligny's first fall (16:18) and its last (17:34) tell different stories; the accounts give the last | Gettysburg (the town), any village fight |
| Let both sides hold sections of one place at once and fight between them | The main gap: Ligny falls about two hours early, and the French losses run high | Gettysburg's town on the first day; Plancenoit |
| Declare a section's kind (walled, open village, wood) instead of reading walls from cover 0.3 or less | Ligny's churchyards at 0.3 became fortresses; 0.35 was a workaround | Every battle with buildings |
| Make habits adjust the generic behaviour, not replace it | Blücher's `reoccupy` habit silently switched off his counter-attacks | Every battle with a historical defender |
| Write the battle's command and game blocks (recipients, posts, sectors, briefing, staff remarks) from the record; the code side was done in stage 2 | Riders rode to Waterloo's coordinates and orders took three hours; 323 battle names in engine code before stage 2, 16 after | Every battle played as one commander |
| Write a plan's times as recorded; let the tool subtract the delay of an order | Orders acted 30–45 minutes after their recorded times until each was moved earlier by hand | Every battle with recorded orders |
| Trace a period map into GeoJSON before calibrating movement | Ligny's roads are estimates from descriptions | Cowpens (open ground, few roads), Gettysburg |
| Give objectives specific names | Ligny's `centre` collided with a word in Waterloo's command code (the lint) | Every battle |
| Check the era pack's scale and weapons before building | The edge and garrison rules assume muskets and battalions | Cowpens (companies, rifles), a pre-gunpowder battle (no firearms) |
| Put each recorded order in the plan of the commander who gave it; mark orders from outside both armies always | Ney's recall of d'Erlon sat in Napoleon's plan, and Blücher's counter-strokes came only with it: in the player's own battle the Prussians never made them | Every battle with recorded orders on both sides, or a third party (Quatre Bras, Wavre) |
| Measure the recorded battle through the command layer as well as in the lab, and trace the player's battle with no orders given | The game's French losses run about 1,500 below the lab's; the missing counter-strokes showed only when the player's battle was traced | Every battle played in the full game |

## Sources

The pages used to build Ligny, and what each gave. Two of them were read through mirrors whose addresses were not kept; they are named so they can be found again.

- [Battle of Ligny](https://en.wikipedia.org/wiki/Battle_of_Ligny) (Wikipedia): the course of the day, army totals, losses.
- [Battle of Ligny order of battle](https://en.wikipedia.org/wiki/Battle_of_Ligny_order_of_battle) (Wikipedia): corps, divisions and brigades.
- [Battle of Ligny – Order of Battle](https://battlefieldanomalies.com/napoleonic-wars/the-battle-of-ligny/battle-of-ligny-order-of-battle/) (Battlefield Anomalies): the order of battle, cross-check.
- napoleonistyka, Ligny (a mirror; address not kept): French strengths by regiment.
- Hofschröer, after Lettow-Vorbeck (via a mirror; address not kept): Prussian strengths by regiment, as ranges.
- [Ligny](https://www.napoleon-empire.org/en/battles/ligny.php) (napoleon-empire.org): positions and timings.
- [La bataille de Ligny](https://www.napoleon.org/histoire-des-2-empires/articles/la-bataille-de-ligny/) (napoleon.org): the course of the day, from the French side.
- The Ligny reconstitution blog (reconstitutionshistoriques.blogg.org): positions of the villages and farms.
- [Moulin Naveau, Fleurus](https://new.millsarchive.org/mills/index/13417) (Mills Archive): Napoleon's post, the Naveau mill.
- [EU-DEM through Open Topo Data](https://www.opentopodata.org/datasets/eudem/): the heights (25 m grid).
- The US NGA gazetteer: coordinates of villages.
