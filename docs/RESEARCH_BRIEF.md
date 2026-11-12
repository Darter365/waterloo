<!-- Snapshot taken 12 November 2026 of the "Waterloo Game: Research Brief" tab (revision 15) of the Claude doc "Waterloo Game: Research Brief", https://claude.ai/artifact/CKc1kCyPztzPPd4tgmuaFf.
     The Claude doc stays the master; this copy can lag it. Made by reading the tab through the Claude Docs connector and
     converting it to Markdown with a script (method and checks: docs/SOURCES.md, "Snapshots"). Not edited by hand. -->

# Waterloo Game: Research Brief

Oct 23, 2026 · @Chris

## Summary

The sources support the approved design, and five findings should shape the build.

1. **The late start was about arrival as much as mud.** Reille's corps only passed Napoleon's headquarters at Le Caillou around 09:00, with the Guard, cavalry and Lobau well behind and Durutte's division arriving near midday. A 05:00 start is therefore mainly a problem of an army that hasn't arrived yet, on wet ground. That makes it a real decision, and it can be played.
2. **The Prussian timetable came out of friction.** Bülow marched at dawn, a fire in Wavre and the Lasne defile slowed him, and he attacked at 16:30. Zieten reached the east flank around 19:00–19:30. Those delays are natural random events for the game.
3. **Napoleon really could not see much.** For part of the day he stood at Rossomme, about 1.5 km behind the line, where the field was out of view. Wellington kept most of his troops behind the crest, and powder smoke built up through the day. Fog of war sits at the centre of the history, so the game is right to put it at the centre too.
4. **Units broke and ran out of ammunition long before they were shot to pieces.** Muskets that hit 60–70% of the time on a range hit 1–5% in battle. La Haye Sainte fell when its rifle ammunition ran out. The model should track cohesion and supply, not just casualties.
5. **Kriegsspiel is the right historical template.** A Prussian officer published it in 1824. An umpire holds the true picture, players write orders, couriers take time, and dice settle losses. The game can play the umpire's role.

Alternate histories and theories for tuning the model: Alternatives and theories

## The armies

Napoleon brought about 72,000 men and 246 guns against Wellington's 68,000 and 156; about 48,000 Prussians joined from late afternoon. Strengths below are at Waterloo, not at the campaign's start, so they run lower than many order-of-battle tables.

**French (your command)**

| Formation | Commander | Men at Waterloo | Guns | Notes |
| --- | --- | --- | --- | --- |
| I Corps | d'Erlon | 16,000–19,400 | 44–46 | Four infantry divisions largely unused on 16–17 June; Jacquinot's light cavalry on the far right |
| II Corps | Reille | 13,000–15,000 | \~46 | Girard's division left behind after Ligny; Quatre Bras losses; Piré's light cavalry on the left |
| VI Corps | Lobau | 6,000–7,000 infantry | \~30 | Teste's division detached to Grouchy; Domon and Subervie's cavalry (about 3,000) attached on the east flank |
| Imperial Guard | Drouot | \~12,000 infantry; \~20,000 with cavalry and artillery | 96 | Old, Middle and Young Guard; Young Guard 8 battalions, 4,000+; Guard battalions 531–654 men each |
| Guard cavalry | Lefebvre-Desnouettes (light), Guyot (heavy) | in the Guard total | — | Committed in the great cavalry charges |
| III Cavalry Corps | Kellermann | \~3,700 | 12 | Heavy cavalry |
| IV Cavalry Corps | Milhaud | \~3,000 | 12 | Cuirassiers |
| Total | Napoleon; Ney commands the front from \~13:00 | 72,000–74,000 | 246 | Guns: 84 front line, 36 with cavalry, 30 in the centre, 96 with the Guard |

Division names inside each corps come from my own knowledge and will be confirmed when I build the order of battle in step 3.

**Anglo-allied (computer-run)**

Wellington had about 68,000 men and 156 guns, a mix of Peninsula veterans and new troops. His army was organised as I Corps (Prince of Orange), II Corps (Hill), the Cavalry Corps (Uxbridge) and a reserve under his own hand. About 17,000 more sat at Hal and Tubize to the west and never reached the field. I will build the sector-by-sector deployment in step 3.

**Prussian (computer-run, arriving)**

| Corps | Commander | Strength | Route and timing |
| --- | --- | --- | --- |
| IV | Bülow | 30,000–32,000, fresh | Dion-le-Mont at about 04:00, through Wavre, Chapelle-Saint-Lambert, Lasne, Bois de Paris; attacks at 16:30 |
| II | Pirch I | \~27,000 after Ligny | Follows Bülow; held up in Wavre until after 16:00; only part engaged, from about 17:00 |
| I | Zieten | not found for this day | Northern road through Ohain; at Ohain about 18:00, at Papelotte and Smohain 19:00–19:30 |
| III | Thielmann | 15,000–24,000 | Stays at Wavre and fights Grouchy |

**Grouchy's wing (detached)**

Grouchy had 32,000–33,000 men and 80 guns: Vandamme's III Corps (about 17,100), Gérard's IV Corps (about 15,000), the cavalry of Exelmans and Pajol, and Teste's division. He reached Wavre at 16:00 and spent the battle there.

## The ground

The battle was fought on a small field: two low ridges about 1.1–1.2 km apart, the whole field roughly 5 km wide and 1.6 km deep. Wellington's army stood on the northern ridge, Mont-Saint-Jean, and most of it was kept behind the crest, out of the French gunners' view.

- **The sunken lane (chemin d'Ohain)** ran along Wellington's crest. A battlefield map based on Johnston's 1815 engraving shows it sunken for about 1 km east of the Mont-Saint-Jean crossroads and 650 m west, giving the defenders cover. That figure comes from a game's map notes, so treat it as approximate.
- **The crops** were rye standing nearly as tall as a man. They hid skirmishers early in the day and were trampled flat by the columns later.
- **East flank.** Past Papelotte the ground falls away. A sunken road, a stream and marshy banks made the farms there hard to attack.
- **The Prussian approach.** Their route ran through the Lasne valley, where swollen streams had turned the bottom into a muddy swamp, then through the Bois de Paris. Zieten took a longer but better road to the north, through Ohain.

| Strongpoint | Position | Defenders and what happened |
| --- | --- | --- |
| Hougoumont | About 450 m in front of Wellington's right: château, farm, walled garden, orchard, wood to the south | Held at first by about 800 Nassauers, 300 Hanoverian riflemen and Guards light companies. Wellington fed in 21 battalions (about 12,000 men) over the day; the French used 33. More than 6,000 men fell there. |
| La Haye Sainte | About 450 m in front of the centre, on the Brussels road; orchard about 250 m long on its south side | 2nd Light Battalion KGL under Major Baring, 378–400 men with Baker rifles and 60 rounds each. The engineers who could have fortified it were sent to Hougoumont. It fell at about 18:00 when the rifle ammunition ran out. |
| Papelotte, La Haye, Smohain, Frichermont | Wellington's far left | Held by Nassau troops; covered Zieten's arrival around 19:00 |
| Plancenoit | Less than 1,000 yards from La Belle Alliance, behind the French right | About 500 inhabitants, who had fled. Bülow's target; changed hands repeatedly from 17:00 to 20:00 |

**Command posts**

- **Napoleon.** He spent the night at Le Caillou farm, 2.7 km behind La Belle Alliance. Rossomme farm, about 1.5 km south of La Belle Alliance, was a post from which he could not see the battlefield. He later moved forward to La Belle Alliance, and at the end into the valley toward La Haye Sainte to watch the Guard attack.
- **Wellington.** He commanded mostly from the Waterloo Elm, at the crossroads of the sunken lane and the Brussels road.

## Historical timeline

This is the baseline the game should reproduce if you give Napoleon's actual orders. It runs in time order because the battle's cause and effect matter here. Times are approximate in every source; ones that disagree are marked.

| Time | Event |
| --- | --- |
| 03:48 | Sunrise. Rain has fallen since early afternoon on the 17th |
| 05:00 | Napoleon fixes the attack for 09:00. One account says he had first wanted 06:00 (secondary source) |
| \~08:00 | Rain tapers off and a drying wind picks up |
| \~09:00 | Reille's II Corps passes Le Caillou, followed by the Guard and Kellermann; Lobau further back |
| 10:00 | Soult writes to Grouchy telling him to march on Wavre |
| 11:00 | Bülow's vanguard reaches Chapelle-Saint-Lambert. Reille's orders, issued now, do not call for taking Hougoumont |
| 11:30 | Grouchy, at Walhain about 23 km away, hears the guns. Gérard urges a march toward them; Grouchy refuses |
| 11:35 | First shots at Hougoumont (sources range from 11:00 to 11:35) |
| \~12:00 | Durutte's division reaches the field |
| \~13:00 | The grand battery of 80–84 guns opens; Ney gets command of the front; troops are seen to the east |
| 13:30 | A prisoner confirms they are Bülow's corps. Lobau, Domon and Subervie are sent to face them. A postscript to Grouchy orders him to hurry |
| 13:30 | d'Erlon attacks from La Haye Sainte to Papelotte with about 17,000 men and no cavalry support. He is repulsed, and Uxbridge's heavy cavalry charge too far |
| \~16:00 | French cavalry charges: first about 4,800 sabres (Milhaud and the Guard light cavalry), then about 9,000 in 67 squadrons. The gap between Hougoumont and La Haye Sainte leaves them a front of about 450 m |
| 16:00 | Grouchy reaches Wavre and engages Thielmann |
| 16:30 | Bülow attacks Lobau |
| 17:00–19:00 | Grouchy receives the 13:30 postscript (sources say 17:00 or 19:00) |
| 17:00–18:00 | Pirch's leading troops arrive; Plancenoit is lost, then retaken by the Young Guard |
| \~18:00 | La Haye Sainte falls. Ney asks for more troops; Napoleon has none to spare. Zieten's lead brigade reaches Ohain |
| 19:00–19:30 | Zieten reaches Smohain and Papelotte. Wellington moves Vivian's and Vandeleur's cavalry to his centre |
| \~19:30 | The Guard attacks with five Middle Guard battalions, three Old Guard battalions following. It is repulsed |
| \~20:00 | Wellington orders a general advance; Prussians storm Plancenoit; the French army routs |
| \~20:20 | Sunset |
| 23:00 | Prussian cavalry reaches Genappe in pursuit |

## Weather, daylight and the 05:00 scenario

The sources support a 05:00 start, and it turns the game into a real dilemma: you would have hours of extra daylight with the Prussians far off, but only part of your army is on the field, the ground is wet, and the men are hungry.

**What the sources say**

- **Rain.** Heavy rain and thunderstorms fell from early afternoon on 17 June until dawn. It eased around 08:00, and a drying breeze followed.
- **Light.** Sunrise was at 03:48 and sunset at about 20:20 local solar time. A meteorological study says the moon was between first quarter and full and gave little light after dark. Hugo's novel says it was full; that is fiction, so I'm using the study.
- **Why the start slipped.** Napoleon wanted to attack early, then moved it to 09:00 and finally 11:30. Drouot, commanding the Guard, advised waiting so the guns could move and roundshot would bounce on firmer ground.
- **The army wasn't there yet.** One historian argues the more basic reason was that the army was spread out after the night march: troops had to gather, and the men had to cook something to eat. Units had arrived in darkness and rain, too late to light fires.
- **Arrival order.** Reille's corps reached the field around 09:00, with the Guard, the cavalry and Lobau far behind. Durutte's division arrived around midday.
- **The other armies.** Wellington's army was on the ridge from dawn. Bülow set out at about 04:00 and his vanguard was at Chapelle-Saint-Lambert only by 11:00.

**What this means for the scenario (my design inference, not sourced)**

- At 05:00 you have whatever was close to La Belle Alliance overnight. Everything else enters along the Brussels road from Le Caillou in arrival windows: Reille around 09:00, then the Guard, the cavalry and Lobau.
- I couldn't confirm where d'Erlon's corps spent the night. Until I can, I'll assume it was the nearest to the line and arrives first, and flag that as an assumption.
- Ground wetness becomes a number that starts at saturated and dries with sun and wind. It slows marching, kills roundshot ricochet and weakens cavalry charges, and the effect fades through the morning.
- So the decision is real: attack at 06:00 with part of the army on mud while the Prussians are 10 or more hours away, or wait for a stronger blow and give them time.

## Movement data

Infantry under fire moved at about 3–4 km/h. Columns on the road managed about 3.5–4 km/h before allowing for halts and congestion, and an infantry division took about an hour to pass a single point. That last figure is what makes defiles and bridges such strong choke points.

| Rate | Value | Source and note |
| --- | --- | --- |
| French ordinary step | 76 paces/min | 1808 infantry manual. A pace of about 0.65 m gives about 49 m/min, or 3 km/h (my conversion) |
| Quick step | 100–108 paces/min | Used by columns advancing, on good ground or when speed mattered. About 4.2 km/h |
| Double step | 120–160 paces/min | Rarely used because it broke up the formation |
| Rates observed in battle | 60–90 paces/min | Allied columns at Austerlitz about 66; Soult's corps about 80 (forum compilation; secondary) |
| Road march, large column | 2–2.5 mph | 15 miles a day was a normal day's march |
| Division passing a point | \~1 hour | Clausewitz, quoted second-hand: an infantry division with its artillery |
| Artillery teams | 6 horses for a 12-pounder, 4 for the others | Doubling teams in mud slowed everything else |

**Friction on the Prussian route**

- Bülow's corps had to march through Wavre, which was packed with Pirch's troops. A mill near the main bridge caught fire and held them up further.
- The defile at Saint-Lambert was described as close to impassable, and the Lasne valley was swamp.
- Pirch's whole corps had not cleared Wavre until after 16:00.

These are friction events for the game to roll for: how long Wavre is blocked, how long the defile takes to pass.

**Mud.** I found no source that puts a number on how much wet ground slowed troops or guns. The slow-down factors will be my estimates, flagged as such in the rules spec and tuned so that history reproduces.

## Combat data

In battle, firepower was 10–30 times weaker than on the practice range. What settled most fights was morale, terrain, ammunition and how well the arms worked together.

**Musketry**

| Measure | Value | Source |
| --- | --- | --- |
| Range trials, linear target | 60–70% hits at 100 yd; 16–20% at 300 yd | Hughes, *Firepower* (via JAR) |
| Average in battle | 1–3% of shots hit | Hughes (via forum summary) |
| At 100–200 yd in battle | 3–5% | ScotWars summary of Hughes |
| Albuera, British volleys at 100 yd | \~5% casualties per volley | Hughes (via napolun) |
| Vitoria, British | 459 rounds per French casualty | Henegan (via napolun) |
| Hougoumont, French | 224 shots per hit | Adkin (via napolun) |
| Rate of fire | 2–2.5 rounds/min | Prussian trials, 1810 |
| Upkeep | New flint about every 30 shots; barrels foul with powder | Museum notes (WASC) |

The Baker rifle was more accurate but slower to load, and it needed its own ammunition. That detail is what decided La Haye Sainte.

**Artillery**

- **Range.** Gunners planned on about 1,100 yd whatever the calibre. On firm ground, with a low trajectory, roundshot bounced and could reach twice as far.
- **Wet ground.** Ploughed, muddy or soggy ground smothered the bounce. That is why the delay was worth waiting for.
- **French 12-pounder.** Effective with roundshot to about 825–900 m, canister to 550–600 m, maximum range 1,600–1,800 m. About one round per minute.
- **The reverse slope.** Wellington kept most of his troops out of sight behind the crest, so the opening bombardment did far less damage than intended.

**Cavalry**

- The French cavalry charges hit unbroken British squares with almost no infantry or close artillery support, and largely failed.
- Fire from Hougoumont and La Haye Sainte squeezed about 9,000 horsemen into a front of about 450 m.
- Uxbridge's British heavy cavalry broke d'Erlon's attack, then charged too far and was cut up in turn.

**Strongpoints and ammunition**

- **La Haye Sainte.** Each rifleman started with 60 rounds and was running short by 16:00. Baring asked for more five times and never got rifle cartridges. The farm fell at about 18:00.
- **Hougoumont.** The garrison ran low too, and a Royal Waggon Train driver took a cart of ammunition through French lines to resupply it.
- **Escalation.** Reille's orders did not call for taking Hougoumont. The fight there grew into a drain on French troops: 33 battalions against Wellington's 21.

## Command, couriers and fog of war

The 1824 Prussian Kriegsspiel already did what this game plans to do, and its structure maps almost one to one.

**How Kriegsspiel worked (Reisswitz, 1824)**

- **An umpire holds the true map.** Players never see it; they get only what their troops could plausibly report.
- **Written orders.** Players write orders, and the umpire moves the blocks according to how he judges the troops would interpret and carry them out.
- **Short turns.** Each turn was 2 minutes, with tables giving movement by troop type and terrain.
- **Combat.** Dice and loss tables settled fights, and units suffered partial losses rather than vanishing.
- **Messages took time.** Their travel time was worked out from courier rides along the roads. The umpire could delay them, lose them, or hand them to the enemy.
- **A link to Waterloo.** Reisswitz demonstrated the game in 1824 to the Prussian chief of staff, Müffling. Müffling had been the Prussian liaison at Wellington's headquarters at Waterloo.
- **A modern benchmark.** A current Kriegsspiel group's handbook moves dispatches at about 15 map squares per turn.

**Waterloo's own record of messages**

- **Grouchy's dispatches.** At 06:00 Grouchy reported that the Prussians had marched overnight. Soult's 10:00 reply sent him toward Wavre. One account has a courier reaching him with it around 13:00. The urgent 13:30 postscript reached him at about 17:00 by one account and about 19:00 by another, either way too late.
- **Delegation to Ney.** From about 13:00 Ney ran the front. The unsupported cavalry charges and the refused request for reinforcements both came out of that hand-off.
- **Wellington's orders** were written on prepared skins that could be wiped and reused.
- **Napoleon's health.** One source says he went back to Rossomme because he felt ill. That is contested, so I'd leave it out unless you want it as an optional rule.

## Casualty targets for calibration

If you play Napoleon's historical orders, the game should end inside these ranges by nightfall. Rout and pursuit losses come at the very end.

| Army | Killed and wounded | Captured or missing | Source |
| --- | --- | --- | --- |
| French | 24,000–26,000, including 6,000–7,000 captured | Another 15,000 scattered in the days after; 220 guns lost | Barbero (via Adventures in Historyland); Wikipedia |
| French, other count | \~25,000 | 8,000–9,000 captured | History Crunch; Napoleon Guide |
| Wellington | \~13,700 (3,500 killed, 10,200 wounded) | 3,300 missing; \~17,000 in all | Adkin (via Adventures in Historyland) |
| Prussian | \~5,600 (1,200 killed, 4,400 wounded) | 1,400 missing; \~7,000 in all | Barbero |
| Fighting at Hougoumont alone | More than 6,000, both sides together | — | HistoryNet |

I'll check the French total at checkpoints through the day, not just at the end: killed, wounded and captured should rise gradually, then jump after 20:00 when the army routs.

## Design recommendations

These are my proposals based on the research above, for you to accept or cut before I write the rules in step 3. Each one turns something documented into a rule.

&#91;embedded content: information loop · 6 stages, truth hidden from the player\]

The loop is the whole game: you never act on the truth, only on what a rider brought you, and every order you send takes time to arrive.

**Information and the map**

1. **The game is the umpire.** It keeps two separate pictures: what is really happening on the field, and what you believe. The map draws only the second.
2. **Couriers are real objects on the map.** Each report or order is a rider with a route and a speed that drops in mud. Transit time is the ride plus the time to write the message. Riders who pass through fire can be killed or captured. You can watch your orders travel.
3. **Where Napoleon stands is a decision.** Rossomme is safe but you can't see the field. La Belle Alliance sees more and shortens rides. A forward knoll sees most but is exposed. This is what actually happened on the day.
4. **Line of sight from where you stand.** The game works out what you can see from your post using a rough height map. The reverse slope hides Wellington's reserves. Smoke builds where firing is heavy, drifts with the wind and clears slowly, so visibility falls through the day. Standing rye hides skirmishers until it is trampled.
5. **Reports show their age.** Enemy units sit at their last reported position, labelled with the time and who reported it, and fade as the report ages. An uncertainty zone grows with age and distance. When two reports conflict, both positions show until one is confirmed. Your own corps report too, and commanders tend to sound more confident than they should.
6. **After-action reveal.** When the game ends, the true positions are laid over what you believed, with a replay. That is where the fog of war pays off.

**Movement**

1. **Units are drawn to scale.** Each block's width and depth come from its strength and formation, line versus column, so frontage is visible at a glance.
2. **Roads and defiles.** Movement runs on a road network with choke points (the Lasne valley, Saint-Lambert, the Genappe bridge). Columns queue at them according to how long the column is, using the hour-per-division rule.
3. **Ground wetness is one number.** It starts saturated and dries with sun and wind over the day. It sets march speed, how well roundshot bounces and how hard cavalry can charge. This one variable is what your 05:00 scenario turns on.

**Combat**

1. **Fights are contests of cohesion.** Fire tables are calibrated to battlefield hit rates of 1–5%, not range trials. Casualties wear down a unit's cohesion, and units break long before they are destroyed.
2. **Each arm has its own role, and the numbers produce it.** Artillery effect depends on ground hardness, whether the target is visible, and how densely it is packed (columns and squares suffer most). Canister works only inside about 550 m. Cavalry achieves little against formed squares unless infantry or guns are with it, but squares are easy prey for artillery. The rock-paper-scissors comes out of the data, not hand-written rules.
3. **Ammunition is a real resource.** Units carry a set number of cartridges (60 at La Haye Sainte). Rifle and musket ammunition are separate supplies, and wagons resupply along the roads. A strongpoint can fall because it ran dry.

**Command and uncertainty**

1. **Commanders have traits.** Ney is aggressive and acts on his own initiative. Jérôme lets a fight like Hougoumont escalate. You can give Ney a whole sector to run and accept the risk.
2. **Prussians and Grouchy run on probabilities.** How long the Wavre fire delays them, how slow the Lasne defile is, whether Zieten nearly gets diverted south, and when Grouchy receives his orders are all drawn from ranges for each game.
3. **A calibration harness.** Before publishing, the game plays Napoleon's real orders hundreds of times with different seeds. The results are compared with the timeline and casualty tables above, and the rules are tuned until history is the likely outcome but not a fixed one.

## Conflicts, gaps and estimates

These are the places where I'm relying on judgement or a weak source, so you know what to trust least.

**Where sources disagree**

- **Corps strengths.** Figures for the start of the campaign run 10–30% higher than strengths on the day. I give ranges and will use the midpoint unless you prefer the low end.
- **First shot at Hougoumont.** Between 11:00 and 11:35.
- **Grouchy's 13:30 postscript.** It reached him at about 17:00 or about 19:00, depending on the account.
- **The moon.** A meteorological study says it gave little light; Hugo says it was full. I use the study.
- **Strongpoint distances.** About 450 m from the line by one source. A local resident's figures were 1,000 paces for Hougoumont and 500 for La Haye Sainte, which don't agree with that.

**What I didn't find**

- Where d'Erlon's corps spent the night of 17–18 June. The 05:00 scenario needs this, so for now it is an assumption.
- Zieten's I Corps strength on the day.
- Wellington's deployment sector by sector. I'll put that together from the order of battle in step 3.
- Any number for how much mud slowed troops and guns. Those factors will be my estimates.

**How I gathered the figures**

Most figures come from search extracts of the pages listed under Sources, checked against at least two of them where I could. The books underneath them (Hughes, Adkin, Barbero, Hofschroer, Siborne) are cited second-hand. I didn't read them directly.

## Sources

**Armies and strengths**

- [Britannica: Battle of Waterloo, the first hours](https://www.britannica.com/event/Battle-of-Waterloo/The-first-hours-of-battle)
- [Wikipedia: Battle of Waterloo](https://en.wikipedia.org/wiki/Battle_of_Waterloo)
- [Wikipedia: Waterloo campaign order of battle](https://en.wikipedia.org/wiki/Waterloo_campaign_order_of_battle)
- [Battlefield Anomalies: Waterloo](https://battlefieldanomalies.com/napoleonic-wars/waterloo/)
- [Napoleon Guide: French order of battle](https://www.napoleonguide.com/waterloo_froob.htm)
- [Napoleon Guide: Prussian order of battle](https://napoleonguide.com/waterloo_proob1.htm)
- [National Army Museum: Battle of Waterloo](https://www.nam.ac.uk/explore/battle-waterloo)
- [Wikipedia: Battle of Wavre](https://en.wikipedia.org/wiki/Battle_of_Wavre)
- [Wikipedia: Pirch I](https://en.wikipedia.org/wiki/Georg_Dubislav_Ludwig_von_Pirch)
- [ATO magazine: Waterloo rules (Bülow and Pirch strengths)](https://www.atomagazine.com/extras/Loo_rules_final.pdf)
- [Fun Trivia: Imperial Guard battalion strengths](https://www.funtrivia.com/trivia-quiz/History/Charge-of-the-Imperial-Guard-at-Waterloo-286938.html)

**Timeline, Prussians and Grouchy**

- [Wikipedia: Ligny through Wavre to Waterloo](https://en.wikipedia.org/wiki/Waterloo_campaign:_Ligny_through_Wavre_to_Waterloo)
- [Waterloo Battlefield Guide: chronology](https://erenow.org/ww/waterloo-battlefield-guide/15.php)
- [Waterloo Battlefield Guide: Wavre](https://erenow.org/ww/waterloo-battlefield-guide/9.php)
- [Waterloo Association: Prussian assault on Plancenoit](https://www.waterlooassociation.org.uk/2018/06/01/prussian-assault-on-plancenoit/)
- [Napoleon Series: French defence of Plancenoit (PDF)](https://www.napoleon-series.org/military-info/battles/1815/waterloo/Plancenoit/Plancenoit.pdf)
- [Napoleon Series: Battle of Wavre](https://www.napoleon-series.org/military-info/battles/hundred/c_chapter6.html)
- [1911 Encyclopaedia Britannica: Waterloo Campaign](https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Waterloo_Campaign,_1815)
- [Ropes, The Campaign of Waterloo (Gutenberg)](https://www.gutenberg.org/files/56995/56995-h/56995-h.htm)
- [Napoléon & Empire: Battle of Waterloo](https://www.napoleon-empire.org/en/battles/waterloo.php)
- [Napoleonistyka: Battle of Waterloo (arrival order, Hofschroer)](https://www.napolun.com/mirror/napoleonistyka.atspace.com/BATTLE_OF_WATERLOO.htm)

**Ground and strongpoints**

- [Lines of Battle wiki: Waterloo map notes](https://linesofbattle.wiki.gg/wiki/Battle_of_Waterloo)
- [Lipscombe: Hougoumont and La Haye Sainte (PDF)](http://www.nick-lipscombe.net/CMP%20Waterloo%20v1%20ch6.pdf)
- [Wikipedia: List of Waterloo Battlefield locations](https://en.wikipedia.org/wiki/List_of_Waterloo_Battlefield_locations)
- [Wikipedia: Hougoumont](https://en.wikipedia.com/wiki/Hougomont)
- [Project Hougoumont: Hougoumont garrison](https://projecthougoumont.com/?p=3063)
- [Project Hougoumont: La Haye Sainte](https://projecthougoumont.com/?p=3067)
- [Spink: 2nd Light Battalion KGL at La Haye Sainte](https://spink.com/lot/18003000031)
- [HistoryNet: Hougoumont](https://historynet.com/?p=13725456)
- [Traces of War: Rossomme Farm](https://www.tracesofwar.com/sights/69155/Rossomme-Farm.htm)

**Weather and light**

- [Bulletin of the American Meteorological Society (1993): meteorology of Waterloo (PDF)](https://journals.ametsoc.org/view/journals/bams/74/3/1520-0477_1993_074_0413_ghetws_2_0_co_2.pdf)
- [War on the Rocks: Napoleon's makeshift army](https://warontherocks.com/why-napoleons-makeshift-army-ultimately-lost-the-most-famous-battle-in-european-history/)
- [Warfare History Network: Terrible slaughter at Waterloo](https://warfarehistorynetwork.com/article/terrible-slaughter-at-waterloo/)
- [Pastnow: Waterloo timeline (Roberts, sunrise)](https://pastnow.wordpress.com/2015/06/18/june-18-1815-battle-of-waterloo/)

**Movement and combat**

- [Napoleon Series: French paces from the 1808 Manuel d'Infanterie](https://www.napoleon-series.org/research/abstract/military/army/france/miscellaneous/c_paces.html)
- [Rod MacArthur: Napoleonic infantry march rates](https://rodwargaming.wordpress.com/miltary-historical-research/military-historical-research/napoleonic-infantry-march-rates/)
- [TMP: march rates discussion](http://theminiaturespage.com/boards/msg.mv?id=457480)
- [TMP: column length discussion](http://theminiaturespage.com/boards/msg.mv?id=226865)
- [Journal of the American Revolution: musket range (Hughes)](https://allthingsliberty.com/2013/08/how-far-is-musket-shot-farther-than-you-think/)
- [ScotWars: smoothbore musketry](https://old.scotwars.com/equip_smoothbore_musketry.htm)
- [Napolun: infantry tactics and musket fire](https://www.napolun.com/mirror/napoleonistyka.atspace.com/infantry_tactics_2.htm)
- [Napoleon Series: artillery in the Grande Armée](https://www.napoleon-series.org/military-info/organization/c_kevarty3.html)
- [Napoleon Guide: artillery ranges](https://www.napoleonguide.com/artillery_ranges.htm)
- [Wikipedia: Canon de 12 Gribeauval](https://en.wikipedia.org/wiki/Canon_de_12_Gribeauval)
- [TMP: canister range and ricochet on wet ground](http://theminiaturespage.com/boards/msg.mv?id=226500)

**Command and Kriegsspiel**

- [Wikipedia: Kriegsspiel](https://en.wikipedia.org/wiki/Kriegsspiel)
- [Wikipedia: Georg von Reisswitz](https://en.wikipedia.org/wiki/Georg_von_Reisswitz)
- [Kriegsspiel.org handbook (PDF)](https://kriegsspiel.org/wp-content/uploads/2022/07/KS_Handbook_v1.pdf)
- [Adventures in Historyland: Grouchy](https://adventuresinhistoryland.com/2015/07/07/grouchy-the-invincible/)

**Casualties**

- [Adventures in Historyland: Waterloo, counting the cost](https://adventuresinhistoryland.com/2015/07/19/waterloo-counting-the-cost/)
- [History Crunch: Battle of Waterloo](https://historycrunch.com/battle-of-waterloo/)
