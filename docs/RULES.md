# Waterloo Game: Simulation Rules

Oct 23, 2026 · @Chris

## Summary

The game simulates the battle at brigade level, in 2-minute steps, with nothing scripted by the clock. You command corps as Napoleon, with orders you build from menus that riders carry to their recipients. Every commander, you and the computer's included, acts on his own incomplete and ageing picture of the battle.

- **Scale.** About 120 units on a 9 × 7 km map, from 05:00 or 11:00 until dark at about 21:10.
- **Dynamics.** Events fire when conditions are met, not at fixed times. Cohesion holds and then collapses, damage persists, and breaking spreads to neighbouring units. That is how a few bad decisions can snowball.
- **Realism anchors.** Combat numbers follow battlefield hit rates and the effect of wet ground on roundshot. Couriers ride at period speeds, and the 1824 Kriegsspiel serves as the template: the program acts as the umpire.
- **What is mine, not sourced.** Most coefficients in this document are my estimates, set so that the history comes out right. Each is labelled *(est.)*, and the calibration harness will tune them.

**What I need from you:** the eight open decisions at the end. The most important is whether the simulation runs at brigade level, which I recommend, or division level.

## Architecture

&#91;embedded content: engine loop · 6 steps per 2-minute tick, truth hidden from the player\]

The engine keeps one true state of the battle and a separate belief record for every commander. Each tick runs the same six steps in order. Only step 6 lets information out of the true state, and it reaches you only through reports carried by riders, which take time to arrive. Your orders go back in the same way, at the start of a later tick.

## Time, scenarios and the end

The simulation advances in 2-minute ticks, the same step Reisswitz's Kriegsspiel used. You don't play tick by tick, though. The game pauses whenever a rider reaches you, and never lets more than your chosen interval pass without one.

**Decision cadence**

- **Pause on any report** that reaches you, on every decision point, and whenever you can see your orders taking effect from your post: an attack going in, a brigade falling back, a place changing hands, something new on the field. Also on a sound or sight you'd notice, such as a sudden cannonade or smoke rising in the east. (Decided 23 October 2026.) Changed 26 October after the second playtest (step 5e): news that arrives close together is gathered into one stop. The clock runs on for up to 15 minutes after the first item, or 8 after a starred one, and a dispatch is starred only for news Napoleon did not already have (est.). With the playtest's orders the stops in a battle fell from about 110 to about 38. You can switch to stopping only for starred dispatches at any time.
- **A ceiling on silence** (default 45 minutes, adjustable 20–60). If nothing has happened by then, your duty officer brings a summary, so you never go too long without news.
- **"Advance until…"** lets you skip ahead to a time you choose or until a condition is met. Example: *until La Haye Sainte reports*.

**Scenarios**

| Start | Ground | French army | What it tests |
| --- | --- | --- | --- |
| 11:00 historical | Drying: wetness 0.6, firm by about 11:30 | Deployed as at 11:00 | The battle as fought |
| 05:00 wet field | Soaked: wetness 1.0, rain stopping about 08:00 | Only the troops near La Belle Alliance; the rest arrive along the Brussels road in windows (Reille around 09:00, the Guard, cavalry and Lobau after, Durutte around 12:00) | Attack early with part of the army on mud, or wait |
| Dry night | Firm: wetness 0.3 | Same arrival times as history | Whether mud or slow assembly delayed the start |

Each scenario runs with one of three history settings: **strict** (Prussians enter at 17:00, Grouchy never comes), **historical plus uncertainty** (the default you chose), or **open what-if** (wider ranges).

**Light and the end**

- Sunrise is at 03:48 and sunset at about 20:20 local solar time. Civil twilight ends at about 21:10, which is my calculation for 50.7° N in mid-June.
- From sunset, how far troops can see and how well they shoot fall steadily. After 21:10 no new attacks can begin. Pursuit and rout continue until 21:30, when the game is scored.
- The game also ends early if either army's army morale collapses (see Cohesion).

## Map and ground

The battlefield is a grid of 50 m squares covering about 9 × 7 km. It runs from Braine-l'Alleud and the Forest of Soignes in the west to Ohain, the Lasne valley and the Bois de Paris in the east, and south to Le Caillou. That's about 25,000 squares, each recording a height, a terrain type and a wetness value.

- **Heights.** Taken roughly from period and modern maps in step 4. The Mont-Saint-Jean ridge stands about 10–15 m above the valley in front of it, enough to hide a second line behind the crest.
- **Off-map routes** come in at the map edges: the Prussian roads from Wavre through Saint-Lambert and the Lasne valley, Zieten's road through Ohain, Grouchy's area between Walhain and Wavre with the Dyle bridges at Moustier, Ottignies and Limale, and the Hal force's road from the west.

**Terrain**

| Terrain | Infantry speed | Protection from fire | Blocks sight | Notes |
| --- | --- | --- | --- | --- |
| Open / pasture | 1.0 | — | No |  |
| Standing rye | 0.9, becoming 1.0 once trampled | — | Hides men lying down and skirmishers | Flattened where columns pass |
| Ploughland | 0.8 | — | No | Gets muddy 20% faster |
| Orchard / hedges | 0.6 | Hits ×0.7 | Partly |  |
| Wood | 0.5 | Hits ×0.5 | Yes | No formed cavalry or guns |
| Walled farm / village | 0.4 | Hits ×0.3 | Yes | Defender ×2 in close combat |
| Sunken lane | 0.5 to cross | Hits ×0.5 for troops in it | Partly | Disorders cavalry crossing at speed |
| Stream / marsh | 0.3–0.4 | — | No | Lasne and Smohain valleys |
| Paved road (Brussels and Nivelles chaussées) | 1.2 in column | — | No | Not affected by mud |

*(est.)* for all the multipliers.

**Strongpoints.** Hougoumont, La Haye Sainte, Papelotte, La Haye, Smohain, Frichermont, Plancenoit, Mont-Saint-Jean farm and La Belle Alliance are each split into sections: buildings, walled garden, orchard, wood. Each section has a garrison capacity and an access route. Resupply and reinforcement can only come along that route, which is how La Haye Sainte can starve for ammunition.

**Ground wetness (0 = dry, 1 = soaked)**

- It starts at 1.0 in the 05:00 scenario. Once the rain stops around 08:00 it falls by about 0.13 an hour to reach 0.6 by 11:00, the point the sources call dry enough to open the battle. It bottoms out at 0.2.
- Low ground such as the valley floors and the Lasne dries at half that rate. Ground that heavy traffic has churned gains 0.1.

| Effect | Formula *(est.)* | Soaked (1.0) | Historical 11:30 (0.55) | Dry (0.2) |
| --- | --- | --- | --- | --- |
| Infantry cross-country speed | × (1 − 0.35W) | 0.65 | 0.81 | 0.93 |
| Artillery off-road speed | × (1 − 0.6W) | 0.40 | 0.67 | 0.88 |
| Country-lane speed | × (1 − 0.5W) | 0.50 | 0.73 | 0.90 |
| Cavalry charge impetus | × (1 − 0.5W) | 0.50 | 0.73 | 0.90 |
| Roundshot effect (ricochet) | × (2 − W) | 1.0 | 1.45 | 1.8 |

The roundshot row follows the sources: on firm ground ricochet roughly doubles what a ball can do, and wet ground smothers it.

## Units and leaders

The simulation's basic unit is the brigade, about 1,500–3,500 men. Each brigade is drawn to its real footprint and knows its own condition. Giving orders at corps level while simulating brigades means a corps can come apart piece by piece: one brigade breaks, and the one beside it wavers.

- **Counts.** About 120 brigades and strongpoint garrisons, plus about 40 artillery batteries.
- **Prussian brigades** were the size of divisions, about 6,000 men. Each is split into two echelons.
- **Imperial Guard infantry** is grouped by pairs of battalions, so the final attack has the right granularity.

**What each unit tracks**

| Value | Range | Meaning |
| --- | --- | --- |
| Strength | men (guns for artillery) | Reduced by killed, wounded, captured and stragglers |
| Quality | 0.7–1.25 *(est.)* | Landwehr and raw troops 0.7–0.8, line 1.0, veterans, KGL and British Guards 1.1, Imperial Guard 1.25. Scales fire, how fast cohesion recovers, and resistance to panic |
| Cohesion | 0–100 | Order and will to fight. The heart of the model (see Cohesion and cascades) |
| Fatigue | 0–100 | From marching, fighting and lack of sleep. Slows movement and recovery |
| Ammunition | cartridges per man; rounds per gun | Musket and rifle ammunition tracked separately |
| Wind | 0–100 (cavalry) | Spent by charging; recovered by resting |
| Formation | see below | Sets footprint, firepower and vulnerability |
| Status | steady, shaken, disordered, broken, rallying | Follows from cohesion |

Starting cohesion is 75–90, set by quality. Both armies lose 5 for the soaked night; the French start more tired because they arrived late in the dark.

**Formations and footprints** *(est., about 0.6 m per file)*

| Formation | 600-man battalion | Strength | Weakness |
| --- | --- | --- | --- |
| Line, 3 ranks (French, Prussian) | about 120 m front | Full firepower | Slow, and fragile if hit in the flank |
| Line, 2 ranks (British) | about 180 m front | More muskets firing | Thin |
| Column of attack (2-company front) | about 40 m front, 9 ranks deep | Speed, control, morale | Few muskets can fire; deep target for guns |
| *Colonne de division par bataillon* (d'Erlon's) | whole division with battalion-wide front, about 24 ranks deep | Weight, momentum | Cannot form square; huge target |
| Square | about 30 m a side | Safe from cavalry when steady | Can't move; worst target for artillery |
| Skirmish screen | spread 200–400 m ahead | Screens, harasses | Ridden down by cavalry in the open |
| Road column | long; see Movement | Fastest march | Useless in a fight |

Changing between line and column takes 3–5 minutes per brigade. Forming square takes 1–2 minutes if the unit is steady, and is impossible if it is disordered or in d'Erlon's massed formation *(est.)*.

**Leaders and traits** *(est., from the reputations in the sources; all adjustable)*

| Leader | Aggression | Initiative | Obedience | Skill | Exposure |
| --- | --- | --- | --- | --- | --- |
| Ney | 0.95 | 0.9 | 0.4 | 0.55 | 0.95 |
| Jérôme | 0.9 | 0.8 | 0.3 | 0.35 | 0.7 |
| d'Erlon | 0.6 | 0.5 | 0.7 | 0.55 | 0.6 |
| Reille | 0.4 | 0.4 | 0.8 | 0.75 | 0.5 |
| Lobau | 0.6 | 0.7 | 0.7 | 0.85 | 0.6 |
| Drouot (Guard) | 0.5 | 0.4 | 0.9 | 0.8 | 0.5 |
| Grouchy | 0.3 | 0.2 | 0.95 | 0.5 | 0.4 |
| Gérard | 0.8 | 0.9 | 0.5 | 0.75 | 0.7 |
| Wellington | 0.3 | 0.8 | — | 0.95 | 0.7 |
| Uxbridge | 0.85 | 0.8 | 0.6 | 0.6 | 0.9 |
| Prince of Orange | 0.7 | 0.6 | 0.7 | 0.35 | 0.8 |
| Blücher | 0.95 | 0.9 | — | 0.7 | 0.8 |
| Bülow | 0.5 | 0.6 | 0.8 | 0.85 | 0.5 |
| Zieten | 0.6 | 0.4 | 0.9 | 0.7 | 0.6 |

- **Aggression** sets how readily he attacks.
- **Initiative** is how far he acts without orders, or bends them.
- **Obedience** is how literally he follows orders.
- **Skill** governs how accurately he reads orders, picks formations and coordinates.
- **Exposure** is how far forward he leads. It raises both the morale bonus to his troops and his own risk of being hit.

Generals do fall: on the day Picton was killed, Duhesme was mortally wounded, and Uxbridge and the Prince of Orange were wounded. Each hour under fire carries a 1–6% chance of a hit, scaled by exposure and how heavy the fire is *(est.)*. A replacement brings different traits.

## Movement

Speed is a base rate from the drill regulations, multiplied by terrain, ground wetness, slope and fatigue. Road movement also goes through choke points that hold units in a queue.

| Mode | Base rate (dry, open, fresh) | Basis |
| --- | --- | --- |
| Infantry, ordinary step | 49 m/min (about 3 km/h) | 76 paces/min × about 0.65 m, from the 1808 French manual |
| Infantry, quick step | 70 m/min (about 4.2 km/h) | 100–108 paces/min. Double the fatigue; loses cohesion steadily |
| Infantry, final rush | 100 m/min, last 100 m only | 120–160 paces/min. Rarely used because it broke up formations |
| Road column on a paved road | 60 m/min (about 3.6 km/h) | Sources give 2–2.5 mph for large columns |
| Cavalry: walk / trot / charge | 100 / 220 / 400 m/min | *(est.)* Charge speed for the last 150–200 m only |
| Foot artillery, limbered | 60 m/min on roads | Off road × (1 − 0.6W). Limbering or unlimbering takes 2 min *(est.)* |
| Horse artillery | 120 m/min | *(est.)* |

**Modifiers**

- **Terrain and wetness:** the factors in the Map section multiply together.
- **Uphill slope:** grades over 5% × 0.85; steep ground × 0.7 *(est.)*.
- **Fatigue:** above 50, × 0.9; above 75, × 0.75.

**Roads, columns and choke points**

- **Column length.** A column takes time to pass a point in proportion to its size, using Clausewitz's rule of thumb that an infantry division with its artillery needs about an hour. A 6,000-man column on a paved road is roughly 3.5 km long.
- **Choke points** (the Saint-Lambert and Lasne defiles, the Genappe bridge, village streets) have a throughput limit. Units queue first-come, first-served. The Lasne defile's limit halves when wetness is above 0.7 *(est.)*. This is what can make the Prussians late, or early.
- **Crowding.** Friendly units get in each other's way. Passing through another unit's line takes time, and densely packed ground suffers more from artillery.
- **Route-finding.** "March to" orders follow the road network. "Advance in battle order" moves straight across country, over the cheapest ground.

**Fatigue** *(est.)*

| Activity | Per hour |
| --- | --- |
| Marching, ordinary step | +2 |
| Quick step | +6 |
| Fighting | +8 to +12 |
| Waiting in column | +1 |
| Rest out of contact | −6 |

Above fatigue 60, cohesion recovers half as fast.

## Combat

Fire causes casualties, and casualties and shock wear down cohesion. Most attacks are decided when one side's cohesion gives way, not in hand-to-hand fighting. Fire is worked out every 2-minute tick for every pair of units that are in range and can see each other.

**Musketry**

Expected hits = muskets firing × rounds per minute × 2 min × hit chance × modifiers. About 1 in 4 hits is a death, which matches Wellington's army losing 3,500 killed to 10,200 wounded.

| Range | Hit chance per round *(est., calibrated)* | Anchor |
| --- | --- | --- |
| 30 m or less | 15% | Point-blank volleys |
| 50 m | 8% |  |
| 100 m | 5% | Albuera: about 5% casualties per volley at 100 yd |
| 150 m | 3% | Battlefield 3–5% at 100–200 yd |
| 200 m | 1.5% |  |
| 300 m | 0.5% | Hougoumont 0.45% and Vitoria 0.2% overall |

- **Rate.** Sustained fire averages 1 round a minute per man firing. Short volley bursts reach 2.2 a minute, matching Prussian trials of 2–2.5.
- **Who can fire.** Line, 3 ranks: two-thirds of the men. Line, 2 ranks: all of them. Column: about 15–20%. Square: one face, about 25%. Skirmishers: all, at half the hit chance.
- **Modifiers.** Quality (0.7–1.25). Cohesion (× cohesion/80, capped at 1.1). A first volley held until close (× 1.5, once). Smoke where the firers stand (× 0.6–1.0). Target's cover (from the terrain table). Target lying down behind a crest (× 0.4). Dusk (× 0.5–1).
- **Baker rifles.** × 1.6 hit chance beyond 100 m, but × 0.6 rate of fire *(est.)*.

**Artillery**

Casualties per roundshot = base × target density × ricochet (2 − W) × target visibility × smoke *(all est.)*.

- **Base, 12-pounder.** 0.35 casualties per round inside 600 m, 0.2 at 600–1,000 m, 0.08 out to 1,600 m. 6- and 8-pounders × 0.7. Rate: 12-pounder 1 round/min; lighter guns 2 rounds/min.
- **Target density.** Line 1, cavalry 1.5, column 2.5, square 3, road column 3, d'Erlon's mass 3.5.
- **Visibility.** Visible 1.0. Partly hidden 0.5. Behind the crest, firing at a remembered position, 0.2. That last value is what makes Wellington's reverse slope work.
- **Canister.** 12-pounder inside 550–600 m: about 4 casualties per round at 100–200 m, 2.5 at 300 m, 1 at 500 m. Lighter guns × 0.6 and shorter range.
- **Shell.** Howitzer shells can set buildings on fire, which is how Hougoumont burned.
- **Shock.** Losses to artillery cost 1.3 times as much cohesion as the same losses to musketry. Taking fire without being able to reply costs a little cohesion every tick.

**Infantry attacks**

As an attacker closes inside 50–100 m, the defender fires; then the game rolls a shock test.

- **Attacker's push:** cohesion × quality × mass (line 1.0, column 1.2, mass 1.4) × freshness.
- **Defender's resolve:** cohesion × quality × cover, plus a bonus if its volley just landed well, plus random variation.

The most common result is that the attacker halts and a firefight follows. Otherwise the attacker falls back, or the defender gives way. Real hand-to-hand fighting happens only in buildings and villages, or against a disordered defender, and it is bloody for both sides.

**Cavalry**

- **Warning time.** Infantry need 1–2 minutes to form square. How far away they spot the charge depends on the crest, smoke and standing crops. Sunken ground can turn a charge into a disaster for the infantry.
- **Against a steady square** (cohesion above 40) cavalry can't break in. If the square is shaken the chance is 3% per charge; if it is disordered, 15% *(est.)*. Each charge costs the horses 25 wind and the square a little cohesion.
- **Against infantry not in square:** a hard morale test. If they fail, they break and lose 10–30% of their men.
- **Against guns:** the gunners shelter and the guns fall silent while cavalry is among them. They fire again once the cavalry leaves.
- **Cavalry against cavalry:** speed, weight, cohesion and flank position decide it. The winner may pursue out of control, more likely under an aggressive, less skilled leader: the Uxbridge effect.
- **Combined arms** comes out of the numbers on its own. Squares are triple-density targets that can't move, so horse artillery or infantry brought to 300 m makes the cavalry deadly.

**Strongpoints**

- Walls reduce hits to × 0.3, and defenders fight hand-to-hand at × 2.
- Gates and doors are weak points. An attack carrying axes or led by engineers is more likely to break in, as Lieutenant Legros briefly did at Hougoumont's north gate.
- A section on fire must be abandoned, but the rest of the strongpoint can still be held.

## Cohesion and cascades

Cohesion is what makes the battle unpredictable. It holds up under punishment, then falls through thresholds. Damage lowers how high it can ever recover, and breaking spreads to nearby units in their line of sight. All values below are *(est.)*, to be tuned by calibration.

**Status thresholds**

| Cohesion | Status | Behaviour |
| --- | --- | --- |
| 50 and up | Steady | Follows orders normally |
| 30–49 | Shaken | Won't advance into fire unless a leader is with it; fire × 0.9 |
| 15–29 | Disordered | Can't change formation or attack; fire × 0.6 |
| Below 15 | Broken | Flees toward the rear along its line of retreat and ignores orders. Loses men heavily if pursued |

**What costs cohesion**

| Cause | Cost |
| --- | --- |
| Casualties | −3 per 1% of the unit lost in a tick (× 1.3 from artillery, × 2 from the flank or rear) |
| Charged by cavalry when not in square | −25, before its morale test |
| A friendly unit breaks within 400 m, in sight | −4 × √(size of the broken unit ÷ own size) × (1.5 − quality) |
| Broken troops running through the unit | −5 |
| Its leader killed | −10 |
| Out of ammunition | −15, and it can no longer fire |
| Enemy on its flank or rear within 500 m, not faced | −5 per tick |
| Under fire and unable to reply | −0.5 per tick |

**"La Garde recule."** When a Guard unit breaks, every French unit that can see it loses an extra 15. Smoke and folds in the ground limit who sees it. That squares two accounts in the sources: the Guard's repulse broke the army, yet most French troops saw little of it.

**Recovery and lasting damage**

- Out of fire and not hurrying, a unit recovers 1.5 a tick. That halves if fatigue is above 60. A leader with the unit adds 50%. Napoleon or Wellington within 500 m doubles it, and once an hour gives an instant +5.
- Each point lost below 50 permanently lowers the unit's maximum by 0.3. A unit badly shaken at 14:00 is fragile for the rest of the day.

**Army morale (0–100)**

- **Start:** French 80 (the army expected to be in Brussels by midday), Anglo-allied 70 (a mixed army with many raw troops), Prussian 75 *(est.)*.
- **Changes:** −0.6 per 1% of the army's starting foot and horse killed, wounded or taken, and −0.08 per 1% of its strength broken (release 2; was −0.5 per 1% broken and nothing for losses). −8 for a key point lost and +5 for one taken (La Haye Sainte, Hougoumont, Plancenoit, La Belle Alliance, the ridge crest). −10 when an enemy army appears on your flank or rear. −5 for a senior leader lost. French −15 if the Guard is repulsed. Allies +10 when the Prussians engage.
- **Below 35:** units stop recovering cohesion.
- **Below 20 the army breaks.** Every unit then tests each tick, and the rout pours onto the roads. The French escape route crosses the narrow Genappe bridge, so a rout there means heavy captures, as in 1815.

**Rally.** A broken unit with no enemy within 800 m for 15–30 minutes and a leader present rallies to 30–40 cohesion. It stays worn out for the rest of the day.

## Supply

Ammunition, horses and food are physical quantities that move along roads. A strongpoint can fall simply because the right cartridges never reached it.

| Item | Starting amount | Rules |
| --- | --- | --- |
| Musket cartridges | 50 per man *(est.)* | Under 15: fire × 0.5. Out: −15 cohesion and the unit can't fire |
| Rifle cartridges (Baker) | 60 per man at La Haye Sainte (sourced); 50 elsewhere *(est.)* | Separate supply. Only reachable if that army's rifle-ammunition wagon is nearby |
| Artillery rounds | 100–150 per gun in limbers and caissons *(est.)* | Army reserve park on the Brussels road near Le Caillou; Wellington's behind Mont-Saint-Jean |
| Cavalry wind | 100, less fatigue | A charge costs 25; trotting 1 a minute; rest out of fire restores 2 a minute. Wet ground × 1.5 cost |
| Prussian ammunition | Bülow full; Pirch and Zieten 30–50 per man *(est.)* | Low after Ligny, according to one account |

**Resupply**

- A unit within 800 m of its corps' wagons, and out of contact, regains 20 cartridges a man every 15 minutes.
- Wagons travel on the road network.
- Strongpoints are resupplied only along their access route: the hollow way behind Hougoumont, the crossing from the ridge to La Haye Sainte. If that route is under fire, a wagon gets through 30–60% of the time *(est.)*. One Royal Waggon Train driver did exactly this at Hougoumont.
- At the start of each game a hidden roll decides where the rifle-ammunition wagon is. In 1815 it never reached Baring. All three allied farms nearly ran dry.

**Food (05:00 scenario).** Troops who haven't cooked yet carry +10 fatigue until they spend 30–45 minutes over their soup. You decide: feed them first, or march them hungry.

## Command and orders

Every order passes through three stages: it is written, it is carried, and it is interpreted. Each stage takes time and can go wrong. Orders that are short and clear survive best, and you can watch your riders on the map.

**The order builder**

1. **Recipient:** a corps commander, the cavalry reserve, the Guard, the grand battery, Ney (for a whole sector), Grouchy (off the map), or your own headquarters.
2. **Action:** advance to, attack, hold, support, bombard, screen or observe, withdraw to, rally and re-form, detach brigades to, hand a sector to Ney, march to the guns (Grouchy only), move headquarters.
3. **Objective:** a named place (Hougoumont, La Haye Sainte, Papelotte, Plancenoit, the ridge crest, Mont-Saint-Jean, Frichermont, the Lasne defile…) or a point you tap on the map.
4. **Manner (optional):** formation (line, column of attack, division mass, or the commander's choice), pace, supporting arms to bring, how many losses to accept.
5. **Conditions (optional):** *after the battery has fired 30 minutes*, *when La Haye Sainte falls*, *not before 14:00*, *until relieved*.

A condition on gunfire counts only fire on the place it names, and a step that waits for a bombardment to begin counts from when its guns first fire, not from when the order is read (5e). Each order gets a **clarity** score. One action and one objective score high; every added condition lowers it.

**Writing and riding** *(est.)*

| Step | Soult (default) | Berthier variant |
| --- | --- | --- |
| Writing | 5–15 min | 3–8 min |
| Riders per order | 1 | 2–3, by different routes |
| Rider speed | 12 km/h on roads; 8 km/h across country × (1 − 0.4W) | same |
| Loss risk | 3–10% per km under fire | same, but one rider usually gets through |
| To Grouchy | about 3 h base, with a long tail; history shows 3–7 h | same |

An urgent order is written in half the time but loses clarity. The recipient sends back an acknowledgement with his next report. **If none comes, you can't tell whether the order was lost or the reply was.**

**Interpretation**

- **Delay before action.** The recipient takes 10–20 minutes to pass the order down to his divisions.
- **Misreading.** Chance = (1 − clarity) × (1 − skill) × 0.5 *(est.)*. A misread order picks the wrong formation or objective. Telling d'Erlon "column" carries a real risk that he forms the massed division column.
- **Deviation.** If the order clashes with what the recipient believes, his initiative and aggression decide whether he adapts. Ney spotting an apparent retreat may charge, taking the reserve cavalry with him; you see it from your post and he explains in his next report. Brigades the Emperor has ordered to hold stay out of his reach until another order of the Emperor's moves them (5e). A highly obedient Grouchy carries on toward Wavre.

**Handing a sector to Ney**

You give him a sector (left, centre, right or the whole front) and a goal. He then issues orders to the corps there himself. That is faster than you can, because he is on the spot and needs no long rides, but his traits now drive the battle there.

**Where Napoleon stands**

| Post | Distance behind the line | What you see | Risk |
| --- | --- | --- | --- |
| Le Caillou | 2.7 km | Almost nothing | None |
| Rossomme | about 1.5 km | Can't see the battlefield | Very low |
| La Belle Alliance | at the French line | Your own front and the valley; not behind Wellington's crest | Low |
| Forward knoll toward La Haye Sainte | 500–800 m forward | Part of the ridge crest | Under fire |

Moving between posts takes 10–20 minutes, and you can't issue orders while riding. Units within 500 m of you rally faster. Being hit is possible only at the forward post; what happens then is open decision 6.

## Fog of war

Every commander, you included, keeps a belief record: a list of contacts, each with an identity guess, a strength range, a position, the time it was seen and who saw it. The map draws your record and never the truth, and that applies to your own corps as well.

**Where information comes from**

- **Your own eyes** from your post, with a telescope.
- **Aides you send to look.** Sending one is an order, and it takes a rider.
- **Corps reports**, sent every 45–90 minutes or when something important happens.
- **Cavalry patrols and pickets**, prisoners and captured letters. A prisoner identified Bülow's corps at 13:30.
- **Sound.** Heavy cannon fire carries more than 20 km; Grouchy heard Waterloo from 23 km away. Sound gives a direction and a rough intensity, and nothing more.

**Seeing** *(est.)*

- **Line of sight** is traced over the height grid. A mounted observer's eye is at 2.5 m. Standing infantry is 1.8 m tall, infantry lying down 0.5 m, cavalry 2.5 m. The reverse slope does the rest.
- **Detection range.** A body of more than 2,000 men in clear air is certain to be seen within 1.5 km, has an even chance at 4 km, and can still be glimpsed out to about 8 km in open country.
- **Identification** (whose troops they are) needs less than about 1 km, a patrol or a prisoner. Napoleon first wondered whether the troops in the east were Grouchy's.
- **Smoke** and haze have their own rules, in the next part.
- **Standing rye** hides skirmishers and men lying down beyond 150 m, until it is trampled.

**Smoke, haze and light**

Eyewitnesses agree the field went blind. Black-powder smoke was whitish-grey, hung low, and needed a brisk breeze to clear; one gunner could see further charges only when the wind freshened, and Vivian said it was too thick to see ten yards during the cavalry attacks ([Keegan, The Face of Battle](https://erenow.org/ww/thefaceofbattlekeeganjohn/3.php)). One account argues the hot afternoon after the cold, wet night added mist to the hanging smoke, so that by mid-afternoon Napoleon could not see into the valley ([WarHistory.org](https://warhistory.org/article/did-the-appalling-weather-on-the-eve-of-waterloo-change-the-course-of-history)). One period narrative mentions a light west wind ([Project Gutenberg](https://www.gutenberg.org/files/75682/75682-h/75682-h.htm)).

The model therefore has three layers *(values est.)*:

| Layer | How it works | Effect |
| --- | --- | --- |
| Background visibility | A curve over the day: about 3 km at 05:00 (mist after the rain), 6 km by 09:00, 8 km at midday, back to about 6 km from 16:00 (humid haze), falling to about 1 km by 21:10 | Detection chance falls with range ÷ visibility. A column 7 km off, like Bülow near Saint-Lambert, can be glimpsed only around midday |
| Powder smoke | Firing adds smoke to each square, a cannon round far more than a musket volley, rising to about 15 m. A light westerly breeze carries it east along the valley. It thins with a half-life of about 10 minutes in a steady breeze, or 20 in humid air or low ground. Gusts every 20–60 minutes clear a strip for a few minutes | Visibility along a line of sight falls with all the smoke it crosses. Firing into smoke × 0.6–1.0 |
| Fires and gun flashes | Burning buildings send up a plume visible for kilometres. Gun flashes show through the smoke | You can see where the fighting is and roughly how heavy it is, but not who is winning |

**What follows from this**

- **Cavalry warning time** depends on smoke as well as crops. A Lüneburg battalion moving toward La Haye Sainte failed to spot cuirassiers coming through smoke and tall crops ([Telegraph timeline](https://chestnut-ah.livejournal.com/960216.html)).
- **The "misread retreat" event** becomes more likely the more of the ridge crest is hidden from Ney.
- **Wind.** Each game draws direction and strength around a light westerly. Strict history fixes it at a light westerly.

**Reports**

- A report is written from the sender's belief at the moment he writes it, then carried by rider like any order.
- It covers his own state (losses, ammunition, morale described in words), what he can see of the enemy, and his intentions.
- **Optimism.** Aggressive commanders overstate their success and understate their losses by up to 20% *(est.)*. Cautious ones tend to overestimate the enemy; on the morning of the battle, Napoleon himself wrongly put Wellington's army a quarter larger than his own.
- **Strength errors** are ±25%, plus 10% for every km beyond the first. Position errors grow with range and with the report's age.

**How the map shows it**

- Each contact is drawn at its reported position, labelled with the time and the source, for example *13:40 · d'Erlon's aide*.
- It fades as it ages: opacity = e^(−age ÷ 45 min).
- Moving enemy formations get an uncertainty zone that widens about 50 m for every 10 minutes since the report.
- Conflicting reports show both positions as ghosts until one is confirmed.
- Your own corps appear only *as last reported*.
- At the end, the true positions are revealed over your belief.

## The other commanders

Every computer-run commander makes decisions the same way. Every 10 simulated minutes, or as soon as new information reaches him, he scores his options by how much each serves his goals and how likely it is to work given what he believes, minus the risk, weighted by how cautious he is. His orders then travel by rider, exactly like yours. Because he decides from his own record of the battle, he can be fooled, can be late and can blunder.

**Wellington**

- **Goals, in order:** keep the army intact; hold the line from Hougoumont through La Haye Sainte to Papelotte until the Prussians are engaged; always keep a reserve.
- **Habits:**
  - Keeps troops behind the crest, lying down under bombardment.
  - Feeds Hougoumont through the hollow way.
  - Lets Uxbridge counter-attack disordered infantry.
  - Sends reserves (Chassé, Brunswick, Lambert) to whichever sector looks most threatened.
- **Recalling Hal:** if he sees French troops threatening his west flank, he calls up the Hal force, which arrives 4–6 hours later.
- **General advance:** when French army morale is low and the Prussians are engaged.
- **Withdrawal:** if his line breaks and no Prussians have arrived by his deadline (default 19:00), he falls back on the Forest of Soignes.

**The Prussians**

- **Hesitation.** At the start, a 10% chance that Gneisenau's distrust holds the march back 1–2 hours.
- **Bülow's march** carries its own delays: the Wavre fire costs 0–3 hours, most likely about 1, and the Lasne defile adds a wait that depends on how wet it is.
- **Concealment.** At Saint-Lambert he stays hidden until two brigades have come up and Wellington is engaged, or until Blücher, seeing Wellington in danger, orders him in.
- **His target** is Plancenoit and Frichermont: the French rear and the Brussels road.
- **Pirch** follows to support Bülow.
- **Zieten** takes the Ohain road, with the chance to be diverted south described in the alternatives tab.
- **Thielmann** holds Wavre against Grouchy.

**Grouchy (off the map)**

- His march is simulated abstractly.
- By default he follows his orders toward Wavre. At 11:30, when he hears your guns, a 10% roll decides whether Gérard talks him into turning west.
- Your own orders to him arrive with the long delays in the Command section.
- If he does turn west, he has to cross the Dyle at Moustier, Ottignies or Limale and get past Prussian rearguards. The result can be delay, blockage, or a force of a certain size arriving on your east edge at a certain time.

**Your own subordinates**

- They follow your orders and, when idle, their standing instruction: hold, support a neighbour, or obey Ney.
- They react locally without waiting for you: forming square when cavalry appears, pulling skirmishers back.
- How far they improvise depends on their traits.

## Events and randomness

An event is a rule: a condition on the state of the battle, a chance of happening while that condition holds, an effect, and a cause recorded for the after-action trail. Only sunlight and the weather run by the clock. Big outcomes are never one coin flip; they build up from many small, recorded draws.

| Event | Can happen when | Chance *(est.)* | Effect |
| --- | --- | --- | --- |
| Gneisenau hesitates | At the start | 10% | Prussian march delayed 1–2 h |
| Fire in Wavre | Bülow's column passing through Wavre | Always; delay drawn 0–3 h, most likely 1 h | Bülow and Pirch delayed |
| Bülow's exit from the woods | Bülow leaving the Bois de Paris | 80% good route, 20% poor route | +45 min on the poor route |
| Zieten diverted | Zieten near Wellington's left while Plancenoit is in crisis | 35% | Turns south; Müffling brings him back 60% of the time within 30 min |
| Gérard persuades Grouchy | Grouchy hears a heavy cannonade | 10% | Grouchy marches west |
| A retreat is misread | Allied units seen moving back over the crest by Ney | Ney's initiative × 0.3 per sighting | Ney sends the cavalry |
| Hougoumont escalates | Jérôme's men driven back | Jérôme's aggression × 0.5 | He commits more troops |
| Gate broken | Assault on a gate with axes or engineers | 10% per assault | Break-in, which the defenders may close again |
| Building catches fire | Howitzer shell hits a building section | 0.5% per hit | Section burns and is abandoned |
| Caisson explodes | Battery under counter-battery fire | 0.2% per hit | Casualties and a shock to nearby units |
| Leader hit | Leader in a fire zone | 1–6% per hour × exposure | Wounded or killed; a replacement takes over |
| Raw unit leaves the field | Raw cavalry or Landwehr under fire with cohesion below 40 | 2% per tick | Unit gone |
| Courier captured | Rider's route passes an enemy patrol | Per km | Enemy reads the intercepted message |
| Prisoner taken | Contact with an enemy patrol | Per contact | The enemy unit is identified |
| Rifle-ammunition wagon | At the start, hidden | Near / far / lost | Decides whether Baring can be resupplied |

**How the random numbers work**

- **One seed per game.** It is shown on screen, and every draw is logged with its cause, so any battle can be replayed exactly.
- **Delays use skewed distributions**: mostly near the usual value, with a long tail of bad days. Morale tests use bell-curve noise.
- **History settings.** *Open what-if* widens every range by 1.5×. *Strict* fixes the Prussians at 17:00 and keeps Grouchy away.

## Outcomes and the after-action report

The battle is scored at 21:30, or earlier if an army collapses. There are seven grades, and each is judged only by the state of the field. That is how history gets graded too: as an Allied victory.

| Grade | Condition |
| --- | --- |
| Decisive French victory | Wellington's army breaks, or withdraws before 19:00, while French army morale is 40 or more and the Brussels road is held |
| French victory | Wellington is driven off the ridge or is withdrawing at nightfall; French army intact |
| Marginal French victory | The French hold part of the ridge crest at nightfall; both armies intact |
| Draw | Both armies still in their own positions at nightfall, neither broken |
| Marginal Allied victory | The French withdraw in good order (army morale 20 or more) |
| Allied victory (historical) | The French army breaks after 18:00 |
| French catastrophe | The French army breaks before 18:00, or Napoleon is captured or killed |

**The after-action report**

1. **The chain of causes.** Every change in the battle is recorded together with what caused it: cohesion losses, breaks, events, orders arriving. The report traces back from the key moments, such as *French army broke 20:14*, and tells the three to five most important chains in plain language with times. For example: Bülow's guide found the good route → he attacked 40 minutes early → Lobau was pulled east → d'Erlon's second attack went in without support.
2. **Your battle against history.** Your key events set beside the real times. For example: La Haye Sainte fell at 16:40, against about 18:00 historically.
3. **What you believed versus what was true.** A time slider replays your map next to the real positions, and a list shows what was hidden from you (the lost rifle-ammunition wagon, Zieten turning south).
4. **Casualties** for each army, against the historical ranges.
5. **The seed and settings**, so you can replay the same battle and try a different decision.

## Calibration and testing

Before you play it, the engine runs without a screen hundreds of times. The aim is to check that history comes out as a likely result, that results vary realistically, and that bad play collapses in believable ways.

**1. Historical orders, 500 runs** compared against the research brief

| Measure | Target |
| --- | --- |
| When La Haye Sainte falls | Most often 17:00–19:00, but sometimes earlier, later or not at all |
| When Bülow attacks | 15:30–18:00, centred on 16:30 |
| When Zieten reaches Papelotte | 18:30–20:00, or not at all if he is diverted |
| French killed and wounded by the end | 20,000–27,000, with the rout adding prisoners |
| Wellington's losses | 13,000–17,000 |
| Prussian losses | 5,000–8,000 |
| Outcome | Allied victory or worse for the French 70–85% of the time |

Casualties are also checked at 14:00, 17:00 and 20:00, not just at the end. The "Allied victory or worse" figure is my proposed target; Esdaile's results argue for higher.

**2. Strict-history setting.** The French should almost never win, matching Esdaile's replays.

**3. Bad-play suite.** Scripted blunders, each run 200 times, must collapse in believable ways and never crash or produce impossible results.

- The Guard committed at 13:00.
- The cavalry sent in at 12:00, before the guns have done their work.
- Brigade after brigade fed into Hougoumont.
- Lobau never sent to face the Prussians.
- Everything sent in at once at 11:30.
- Withdrawing at 15:00.

**4. Skilled-play suite.** Plans built on the historians' alternatives: the Guard at 18:00, combined-arms attacks, an early start on dry ground. These should win the battle 25–40% of the time.

**5. Sensitivity.** Each setting from the tuning table is moved 10–20% while everything else is held fixed. Outcomes should shift smoothly. Only the known knife-edge moments may swing hard: the 18:00 crisis window, Zieten's decision, the rifle-ammunition wagon. A sharp swing anywhere else gets investigated as a bug.

**6. Performance.** About 160 units over about 500 ticks is light work for a phone. Sightlines are recomputed every 10 simulated minutes, or when an observer moves.

## Release 1 (26 October 2026)

The first playable release adds: the after-action report (step 6), fighting it out to the end, the umpire's review, the general retreat, the 05:00 start, the calibration fixes below, and four pieces of immersion: letters, the view through the glass, pencil marks and the staff speaking up. It is played on the published page, or offline as a home-screen web app at **darter365.github.io/waterloo** (open it once in Safari, then Add to Home Screen; after that it opens with no signal).

Nothing added for immersion, review or the report draws on the battle's dice: the same seed, settings and orders, given at the same minutes, still fight the same battle. That was checked by re-running the browser game's own order log headlessly (identical) and 20 historical battles against the 500-battle batch (20 of 20 identical).

### Calibration changes in release 1

Every value changed, with the 5e value. All are estimates (est.) set by the 500-battle runs, not sourced figures.

| Setting | 5e | Release 1 | What it does |
| --- | --- | --- | --- |
| Skirmish fire round a held farm: cartridges per man per 2-minute tick at full pressure | (none) | 1.7 | New. Enemy foot within 450 m of a garrisoned farm keep skirmishers at it; the garrison answers. Full pressure is 3,000 men; 10% of them are out as skirmishers at a hit chance of 0.01 |
| Skirmishers stay round the farm after their columns go back | (none) | 150 min at 0.4 pressure | New. In 5e no French were within 450 m of La Haye Sainte between d'Erlon's attack and the final assault, so its cartridges never ran low |
| Wall floor (fire alone cannot take a walled garrison with cartridges below this cohesion) | 0 (off) | 30 | Was a switched-off 5e test |
| Shelter (a garrison shelled in an orchard or wood with no enemy close takes cover in its buildings) | off | on | Was a switched-off 5e test |
| Wall bonus in hand-to-hand when the defenders have no cartridges | 2 (no change) | 1 | Without cartridges they can no longer hold the loopholes |
| La Haye Sainte's rifle-ammunition wagon: near / far / lost | 40 / 30 / 30% | 25 / 35 / 40% | In 1815 it never reached Baring |
| A far wagon can get through from | 16:00 | 17:30 |  |
| Area fire at ground behind a crest (overshoot and ricochet) | 0.2 | 0.4 | Brings Wellington's losses into the 1815 range |

And one fix, not a value: guns told to bombard a place without a site chose a spot about 1.2 km short of it. Sent against the ridge west of the road, that spot was Hougoumont's walls, and they unlimbered there. A chosen spot is now kept at least 600 m from any farm the enemy holds.

**Results.** 500 historical battles (seeds 1000–1499) and 100 strict, with Napoleon's own orders:

| Measure | 1815 | 5e | Release 1 |
| --- | --- | --- | --- |
| La Haye Sainte falls | yes, about 18:15–18:30 | 84% of battles; median 18:38 | 86%; median 18:36 (10–90%: 18:20–19:04) |
| ... after its garrison ran out of cartridges | yes | never (0 of 30 sampled) | 59% of falls in an 80-battle sample; 85% when the wagon is lost, which is when it runs out, about 17:40 |
| Hougoumont falls | held all day | 10 of 500 | 1 of 500 |
| Wellington's killed and wounded | 13,000–17,000 | median 12,600; 40% in range | 13,800; 71% |
| French killed and wounded | 20,000–27,000 | 25,600; 83% | 25,600; 82% |
| Prussian killed and wounded | 5,000–8,000 | 7,500; 63% | 7,800; 54% |
| French army breaks | about 20:15 | median 20:32 | 20:30 |
| Results | Allied victory | 479 Allied victories, 21 draws | 473, 27 |
| Strict history (100) |  | 99, 1 | 100, 0 |

A player's attack on Hougoumont with two brigades from 11:00, 16 battles each (5e → release 1): no guns, attack at 12:30: 4 → 0 falls; no guns, attack at once: 11 → 0; Hougoumont bombarded first: 13 → 4 (it caught fire in 7); the ridge bombarded first: 15 → 4.

### New rules in release 1

**Skirmish fire round a held farm.** Each tick a garrison that is not already firing at something checks for enemy foot (not cavalry) within 450 m of its farm. Their numbers set the pressure, up to full at 3,000 men. A tenth of them are out as skirmishers and fire at the walls (hit chance 0.01, times the section's cover and the wall factor). The garrison answers from the loopholes at the nearest of them and spends cartridges at 1.7 a man a tick at full pressure. When the columns go back, their skirmishers stay in the hedges and hollows for 150 minutes at 0.4 pressure. All est. Resupply is unchanged: a musket-armed garrison can be resupplied along its access route, and Baring's riflemen only from the rifle wagon.

**Fighting at the edge of an open village (phase 5, Ligny).** A battle may mark a section `street`: an open village of houses, gardens and hedges, with no continuous wall. Foot within 60 m of the edge of such a section held by the enemy are among its outlying houses too. Musketry against them is multiplied by 1.5 times the section's cover, where they would otherwise stand in the open. At least 0.6 of their men fire, as a garrison's do, where a column would otherwise fire with 0.15. Era constants EDGE\_COVER 1.5, EDGE\_R 60 and EDGE\_FIRE 0.6, all est., chosen on Ligny (era pack 1.1). No Waterloo section is marked `street`, so Waterloo's battles are unchanged. Plancenoit's fight was of this kind, but marking it would change Waterloo's results and need a recalibration.

**The general retreat.** You write one order to *the whole army*. The staff write a copy for each corps commander (Reille, d'Erlon, Lobau, Drouot, Milhaud, Kellermann), and each copy is written, ridden and passed down like any order. As each arrives, that corps' brigades leave any farm they hold and make for the high road. They march off the southern edge toward Charleroi and count as brought away; the grand battery goes with d'Erlon. A rearguard (the Guard or Lobau, or none) first stands across the road at Rossomme, in squares. It follows once nothing formed of ours is north of it, or once it is badly hurt, or after two hours. When the first copy is acted on, the army sees itself going back: army morale −5 (est.). Ney's sector command and the French commanders' own initiatives stop.

The enemy reacts. About half an hour after the retreat begins (est.), Wellington sees the French positions emptying and sends his line forward, as he did at 19:30 on the day. After about 20 minutes (est.), Blücher drives his formed brigades for the nearest point of the Charleroi road. The battle ends at dark, or once nine-tenths of the foot and horse formed when the retreat began have left the field. If the army does not break, the result is a marginal Allied victory, and the verdict gives what was brought away, in men and guns, and what was still formed on the field at the end. If it breaks on the way, it is graded as any broken army.

**The 05:00 start.** Est. throughout. The sources agree that the rain stopped about 06:00, that at 05:00 Napoleon set the attack for 09:00, that much of the army had bivouacked well south of La Belle Alliance, and that some of it was not in place at 09:00. They do not give each corps' bivouac. So:

- d'Erlon's corps and Milhaud's cuirassiers lie 300–350 m behind their 11:00 ground, where the vanguard halted the evening before.
- The Guard lies round Le Caillou, about 1.3 km south of its 11:00 ground.
- Reille, Kellermann and Lobau come up the high road from the direction of Genappe, one brigade about every 10 minutes: Piré's horse 06:15, Bachelu 06:45, Foy 07:15, Jérôme 07:45, Kellermann 08:15, Lobau 08:45, Domon and Subervie 09:30. Each halts about 700 m behind its 11:00 ground.
- The allied army is in its 11:00 places.
- Napoleon is at Le Caillou. The ground is soaked until 08:00 and then dries as at 11:00 (the existing 05:00 wetness). Seeing is 3 km at 05:00, rising to 6 km by 09:00.

A new place, *their places in the line of battle*, sends each brigade to its own place in the 11:00 line. Napoleon's own orders for this start put each corps on its ground once it is up (d'Erlon and Milhaud 06:00, Reille from 08:00, Kellermann from 08:30, Lobau from 09:00, the Guard 09:15), move headquarters to Rossomme at 09:30, and then follow the 11:00 script. A corps on its way to its ground does not call in its cavalry screen (Marbot's hussars on the right).

With those orders, 100 battles (seeds 8000–8099) end in 96 Allied victories and 4 draws, much as at 11:00. La Haye Sainte falls in 88 of them (median 18:28), and the French army breaks at a median 20:32. Wellington's and the French losses are as at 11:00. The Prussians lose more: a median of 9,700 against 7,800. I have not traced why.

**Fighting it out to the end.** From any stop you can hand over and let the clock run to nightfall with no more stops:

- leave the front to Ney: a letter gives him the whole front with orders to take the crossroads;
- Napoleon's own orders from that hour: those of his orders whose time is still to come, or that wait on an event, given to your army as it stands;
- no more orders.

The hand-over goes into the order log, so the after-action report can fight it again.

### The after-action report, the review, and immersion

**The after-action report.** The game keeps a log of every order and tear-up with its minute, and samples the strength in the ranks every 10 minutes. At the end, the report draws the day hour by hour: men in the ranks for each army; each of your orders from when you gave it to when it was acted on; who held each farm and village against who you believed held it, with the delay before you heard; and the turning points against when you learned of them.

Beside it, the same battle is fought again in the background, in web workers built from the very scripts the page runs:

- with nothing changed, as a check that it reproduces your battle exactly;
- with Napoleon's own orders on the same seed;
- without each of your orders in turn, ranked by how much it mattered;
- with the three orders that mattered most sent 30 minutes sooner;
- on request, with your orders and with Napoleon's on 8 other seeds.

You can go back to any stop and fight on from there. Your earlier orders are given again at the same minutes, so the battle is the same up to that point. A re-run with one change shows one possible day, not a law.

**The umpire's review.** At the end the umpire flags:

- killed and wounded more than 1.6 times the top of the 1815 range, or under 0.3 times its bottom;
- a farm that changed hands 7 times or more;
- a brigade with more than 80% of its men killed and wounded;
- an order that arrived and was never acted on;
- Bülow attacking before 14:00;
- the French army breaking before 17:00;
- Hougoumont falling;
- a re-run that did not reproduce the battle.

The player can tick turning points that look wrong and write a note. On the published page, *Save for Claude* stores the review, with the seed, settings, order log and any notes written on the map, in the page's database (collection `reviews`), where Claude can read it. Anywhere, offline included, *Copy for Claude* copies the same record as text to paste into a conversation.

**Letters (8a).** Orders are shown as the letter Soult's office would send: place and hour, “Monsieur le Comte …”, “The Emperor orders you to …”, signed *Le Major-Général, Duc de Dalmatie* (with the Berthier staff, *Prince de Neuchâtel et de Wagram*). Reports from the commanders open “Sire,” and carry their signature; a deputy signs his own name. The wording of each order is exactly the plain text, only dressed. Plain text is a setting.

**The view through the glass (8b).** You choose a place, and the map closes in on it inside an eyepiece. Ground that cannot be seen from Napoleon's position is shaded, using the line of sight the command layer uses (eye at 2.5 m, standing infantry at 1.8 m). So is ground beyond the day's seeing (the visibility curve times the telescope factor 1.6), and ground under thick smoke. Only enemy bodies Napoleon himself saw there in the last 20 minutes are ringed and described. Older reports there are counted but not confirmed. No dice, and no change to his record.

**Pencil marks (8c).** Freehand lines and short notes on the map in graphite, kept in the player's game only; the battle never reads them. Notes go into the review.

**The staff speaking up (8d).** At each stop, at most two remarks from Soult, Drouot, Flahaut, La Bédoyère or Gourgaud. Each is chosen by a fixed rule from what headquarters knows: Napoleon's record, the reports in and the orders sent. Some examples:

- the morning advice to recall part of Grouchy's force (paraphrased from the standard accounts);
- troops seen in the east that some take for Grouchy;
- Bülow named;
- no word from a corps for 75 minutes;
- an order unacknowledged after an hour;
- the cavalry going up without infantry;
- La Haye Sainte, Hougoumont or Plancenoit changing hands;
- the Guard committed;
- the light failing;
- six brigades reported broken after 18:00, with no retreat ordered.

Because they speak from belief, they can be wrong. No dice.

### Investigated and not changed

**The Allied win rate (95% with Napoleon's own orders; 5e 96%).** The reason it barely moves is that the allied army is never in danger of breaking. Across 40 battles, the lowest allied army morale reached had a median of 61 (the army breaks below 20). Only 2 battles fell below 40, and none below 30. Army morale here falls only when brigades break and at a few events (La Haye Sainte lost, the crest taken, a general hit); losses alone do not touch it. Making the day the “nearest-run thing” would mean adding casualties to army morale. That changes every army's breaking point and needs a full recalibration, and there is no 1815 frequency to aim at. It is left as a decision.

**Pursuit losses.** By 21:30 the French have a median of 4,500 taken and straggled, about 1,600 of them after the army breaks, and have lost about 160 of their 282 guns. In 1815 the French lost 8,000 captured (6,000–7,000 of them wounded) and about 220 guns ([Wikipedia](https://en.wikipedia.org/wiki/Battle_of_Waterloo)), and 15,000 more left the colours afterwards. Most of that came in the night retreat through Genappe, which the game does not play. The game's wounded prisoners are counted as wounded. So the figures are not comparable, and nothing was changed.

**Open.** Why the Prussians lose more in the 05:00 start. Whether the rifle wagon odds (est.) are right: they decide how often La Haye Sainte holds.

## Release 2 (26 October 2026)

Army morale now falls with casualties. With Napoleon's own orders, the day now ends in an Allied victory 83% of the time, a draw 16%, and a marginal French victory 0.4%. The target was Allied victories 75–90%, the rest mostly draws or marginal results, French wins under 5%. The fuzz found five engine bugs, all fixed, and the interface's small text now meets contrast in both themes.

### Calibration changes

Two values changed and nothing else; both are *(est.)*.

| Value | Release 1 | Release 2 | What it does |
| --- | --- | --- | --- |
| MORALE\_CAS (new) | none | 0.6 | Army morale lost per 1% of the army's starting foot and horse killed, wounded or taken |
| MORALE\_BROKEN | 0.5 | 0.08 | Army morale lost per 1% of its strength seen to break. Most of what it stood for, the men lost, now counts through MORALE\_CAS |

Losses alone, at any weight, broke the French earlier rather than adding swings. At MORALE\_CAS 0.5 the French break moved to a median of 19:46. At 1.0, half the battles were French catastrophes before 18:00. The broken-brigade drain was counting the same men twice, so it came down as the losses went in. The sweep, Napoleon's orders, 200 battles each unless marked:

| MORALE\_CAS | MORALE\_BROKEN | Allied victory | Draw |
| --- | --- | --- | --- |
| 0 | 0.5 | 96.0% (500 battles) | 4.0% |
| 0.5 | 0.5 | 100% | 0% |
| 1.0 | 0.5 | 100%, half of them before 18:00 | 0% |
| 0.5 | 0.1 | 66.5% | 33.0% |
| 0.5 | 0.15 | 89.0% | 10.5% |
| 0.6 | 0.1 | 89.5% | 10.0% |
| 0.75 | 0 | 85.5% | 14.0% |
| 0.5 | 0.13 | 82.2% (500) | 17.4% |
| **0.6** | **0.08** | **83.2% (500)** | **16.4%** |

I chose 0.6 and 0.08: mid-target, with a little more weight on losses than 0.5 and 0.13, which gives the same spread.

### Results

500 battles, Napoleon's orders, seeds 1000–1499. "Before" is release 1 with this release's engine fixes but the old morale values.

| Measure | Target | Before | Release 2 |
| --- | --- | --- | --- |
| Allied victory | 75–90% | 96.0% | 83.2% |
| Draw | most of the rest | 4.0% | 16.4% |
| Marginal French victory | the rest | 0% | 0.4% |
| French victory | under 5% | 0% | 0% |
| French army breaks, median when it does |  | 20:30 | 20:34 |
| La Haye Sainte falls | about 18:30 | 85%, median 18:36 | 85%, median 18:36 |
| Hougoumont falls | holds | 2 of 500 | 2 of 500 |
| French killed and wounded, median | 20–27k | 25.5k (83% in range) | 25.7k (81%) |
| Allied killed and wounded, median | 13–17k | 13.6k (71%) | 13.9k (74%) |
| Prussian killed and wounded, median | 5–8k | 7.8k (55%) | 7.8k (54%) |
| French morale low point, median |  | 0 | 12 |
| Allied morale low point, median |  | 58 | 53 |

The draws are near misses: French morale ends between 20 and 35, just above the breaking point, after the Guard is thrown back.

Other modes, 100 battles each:

- **Strict history:** 93% Allied victory, 7% draw.
- **05:00 start:** 85% Allied victory, 14% draw, 1% decisive French victory. In that battle, seed 8027, the Allied army broke at 20:30.
- **Open history:** 84% Allied victory, 16% draw.
- **Dry ground:** 75% Allied victory, 25% draw.

### Engine fixes

All were found by the fuzz.

1. **Dropped waypoints.** Marching units dropped their next waypoint whenever a 2-minute tick ended within half a metre of one. A unit could cut a corner or stop short. One sent to garrison a farm walked in from up to a kilometre away. Fixed. A garrison order that ends more than 400 m short now marches on once, and otherwise holds.
2. **Columns reaching from a kilometre off.** A brigade still in column of route could "reach" a farm or village from a kilometre away and be set down inside it, because half its road column's length counted as reach. A column of route now reaches 30 m and deploys before it assaults. This never happened with Napoleon's orders (the 500 battles are unchanged), only with players' orders.
3. **Squares that could not move.** A party in square with enemy horse within 800 m could not move at all, and stood for hours. Squares now edge along at a fifth of the pace under any task *(est.)*.
4. **Garrisons left behind.** When Wellington orders a withdrawal (his army below 25 after 19:00 with no Prussians engaged, now reachable since losses cost morale), farm garrisons were told to march but could not leave their buildings. They now come out first.
5. **A clause cut off by a comment.** A comment added in release 1 had cut off the clause slowing guns in battery. It never mattered, since guns limber to move, and it is restored.

Tooling: the batch runner lost the results of 500-battle batches, because its workers exited before their results were sent.

### Interface

- **Small grey text** (times, the order stepper, the inbox's delays) is darker. Light: #8a7860 to #6f604b, contrast 3.2–3.6 to 4.5–5.1. Dark: #8d7e67 to #9a8a72, 3.9–4.5 to 4.6–5.6.
- **Times on letter cards:** ink from 65% to 75%, contrast 4.1 to 5.5 in light, 3.8 to 4.9 in dark. The hover tips' second line goes from 72% to 78%.
- **The staff on losses.** They now remark on heavy losses, from the corps returns: Soult at a quarter of the foot and horse, Drouot at two in five.
- **The notes** gain a paragraph, "An army's nerve". No number is shown to the player.

### Checks

Fuzz after the last fix: 280 battles (chaos player in every scenario and history mode, Napoleon's orders, idle), 0 findings. 44 of 44 determinism re-runs were identical. The browser regression suite (after-action report, fighting it out, the general retreat, the 05:00 start, letters, staff and glass on desktop and phone) passed with no page errors, and every replay check was identical. The UI audit (desktop and phone, light and dark, from the briefing to the report) found 0 problems, against 233–252 before. The offline build passed its no-signal test.

## Release 3 (26 October 2026)

Release 3 makes two additions to how the battle reaches you, and neither changes any result. Seven battles (four with Napoleon's orders, three with the chaos player) gave identical fingerprints with the old and new code.

**!! alerts.** Quick events that headquarters itself sees are marked !! in the notices, in the earlier list, and on the map, where the mark fades over 20 minutes:

| What is seen | !! when |
| --- | --- |
| Your brigade going forward | Each new attack; "again" if it went forward within the last 2 hours |
| Enemy coming forward | Each new advance; "again" if one was seen in the same 1.2 km square within 90 minutes |
| A cavalry charge | Yours or the enemy's, including Ney taking the reserve cavalry forward |
| Troops breaking or running | Yours or the enemy's, and the enemy's line wavering (3 bodies seen running in half an hour) |
| The enemy near headquarters | Enemy foot or horse within 800 m |

A new stop setting, "Stop for !! and ★", stops the clock within 4 minutes of an alert *(est.)*, against 8 for a ★ notice and 15 for other news. With "Stop for news", an alert also stops it within 4 minutes. Clicking or tapping a mark opens its notice.

**Colour map (prototype).** A second map style, chosen in the headquarters panel and kept in your browser:

- Shaded relief from the same height grid, lit from the north-west, with relief exaggerated 14 times *(est., for legibility)*.
- Woods, streams, and smoke and flame over burnt buildings.
- The field colours are decoration, not data: the sim has no crop or field map.

The paper map stays the default.

**Checks.** The browser regression suite passed with no page errors. The UI audit found 0 problems after the !! mark on dark-mode notices was moved to the map's own red (contrast 5.3). The offline build passed its no-signal test.

## Open decisions and estimates

Decided 23 October 2026: Chris accepted all eight recommendations. Since then, decision 6 (wind) has a source: a period account of a light west wind, now used in the Fog of war section.

| # | Decision | Recommended | Alternatives |
| --- | --- | --- | --- |
| 1 | Level the battle is simulated at | Brigade: more realistic frontages and chain reactions | Division: simpler and faster, but coarser |
| 2 | Longest silence before a summary | 45 min | 20–60 min, or off |
| 3 | Napoleon hit at the forward post | Wounded: army morale −10 and your orders slower, but you keep playing | The game ends as a catastrophe; or no personal risk at all |
| 4 | Napoleon's health rule | Off by default, available as an option | On by default |
| 5 | Army strengths where sources disagree | Midpoint of the range | Low or high end |
| 6 | Wind direction (not researched) | A light breeze from the west, varied with each game's seed | One fixed direction, after I research it |
| 7 | End of the game | Scored at 21:30 | Play on into the night retreat and pursuit |
| 8 | d'Erlon's overnight position in the 05:00 start | Assume nearest the line and flag it | I research the bivouacs further before step 4 |

**Sourced and estimated values**

- **From the research:** march rates, the hit-rate anchors, gun ranges, the 60 rifle rounds at La Haye Sainte, strengths, timings, casualty ranges, the drying of the ground by about 11:00, courier delays to Grouchy, and the killed-to-wounded ratio.
- **My estimates, marked (est.):** every multiplier and threshold that turns those facts into rules. Examples are the mud factors, the canister and roundshot effects, cohesion costs, trait values and event chances. Calibration will tune them, and I'll report every value it changes.

## Generic commanders (engine roadmap, phase 3)

These values drive the commanders that fight any battle from its packs (`doctrine.js`): the test battle, the battle lab, and Waterloo when it is fought without its own commanders. Waterloo's own commanders (`ai.js`) and every Waterloo number above are unchanged. All are estimates, set on the invented test battle, not on history.

| Value | Setting | What it does |
| --- | --- | --- |
| Decision interval | 10 min x the chief's tempo | How often an army's chief reconsiders |
| Bombardment before an attack | 40 min x (1.2 - aggression) x (0.5 + coordination); half for each later main effort | The guns prepare the main effort before the corps go in |
| Gun range for the main effort | 900 m | Batteries come up to within this of their target |
| Room at an objective | a place: 1 body per 600 men its walls hold; a line: 1 per 450 m; else 2 | Bodies sent at once; the rest follow as support |
| Fresh enough to attack | cohesion 55 | A corps renews its attack once two-fifths of its men are this fresh; after 90 minutes without it, it is fought out |
| Attacks per corps | 1 + 3 x its general's aggression | Then the corps is spent |
| A strike elsewhere | general's aggression 0.65 or more | When the main effort has no room, his corps attacks another objective |
| Lane clear of farms | 300 m | Attack lanes on a line avoid enemy-held places in front of it |
| Halted in an attack | 30 min, then 300 m back to re-form | A body stuck disordered in an attack falls back |
| Horse behind the attack | 1,100 m short of the objective | Within reach of a counter-charge, out of canister |
| Counter-charge | 0.25 x the cavalry chief's aggression each decision | At shaken enemy bodies, or blown or runaway enemy horse, within 1,300 m |
| Reserve committed | 0.6 x readiness when the army stands on the enemy's line; 0.3 x readiness when the defenders are seen shaken; 0.5 x readiness once the line is spent | Readiness: the chief's reserve setting (0.5 usual) |
| Calling off the attack | morale under 50 with line and reserve spent, or 30 min before sunset; 0.3 each decision | Not while the army holds a line it came to take |
| Feeding a garrison | 250-700 men, every 25 min, at most 7 times | When the place is attacked and its garrison is under 60% of capacity or cohesion 45 |
| Retaking a place | every 60 min, chance 0.3 x (aggression + 0.3) | Only a place the army held; not while the enemy is seen attacking near it |
| General advance | the enemy army broken, or 6 enemy bodies seen running in 30 min | The defender goes forward |
| Withdrawal | morale under 25 | Unless an allied army is still fighting |
| The crest | first line 15 m behind it; stand up when enemy foot are within 380 m and no enemy horse within 500 m; down after 4 quiet ticks | Waterloo's values (release 3), now read from the battle pack |

Leader settings that now act, with the defaults reproducing release 3: **rally** (recovery near a unit's leader x (1 + rally), near the army's chief x (1 + 2 x rally); 0.5 gives release 3's x1.5 and x2), **coord** (above), **clarity** of the chief's orders (the odds a general misreads one).

Wellington's, Uxbridge's, Lobau's, Jérôme's and Ney's habits are now these generic habits fed with Waterloo's numbers from the battle pack (the allied side's `crest`, `feeds`, `counter`, `sectors`, `reoccupy`, `stepBack`, `liaison`, `shifts`, `advance`, `withdraw` and `calls`; the French side's `initiative`). The values are release 3's, unchanged: the 120 phase 2 reference battles replay exactly.

Blücher's march and Grouchy's choice at Walhain are the same kind of thing: the habits of an arriving army, fed with release 3's numbers, unchanged, from the Prussian side's `delays`, `waits`, `follows`, `flanks`, `press`, `pursue` and `reports` and the French side's `toGuns` (`doctrine.js` describes every key). The generic commanders run a battle's timetable alongside their own decisions and leave the corps it names to it.

The French side also has objective values for a generic French commander. They are used only when the French are not given Napoleon's orders, so the game and the band are unaffected. The values are est., from Napoleon's plan of the day:

| Objective | Worth to a generic French commander |
| --- | --- |
| The crossroads and the ridge either side | 3 |
| La Haye Sainte | 2 |
| The ridge east of La Haye Sainte | 2 |
| Hougoumont | 1 |
| The ridge west of the Brussels road | 1 |
| Papelotte | 0.5 |
| Plancenoit, La Belle Alliance | 0 (behind his own line: his to defend, not attack) |
