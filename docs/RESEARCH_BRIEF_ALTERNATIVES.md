<!-- Snapshot taken 12 November 2026 of the "Alternatives and theories" tab (revision 17) of the Claude doc "Waterloo Game: Research Brief", https://claude.ai/artifact/CKc1kCyPztzPPd4tgmuaFf.
     The Claude doc stays the master; this copy can lag it. Made by reading the tab through the Claude Docs connector and
     converting it to Markdown with a script (method and checks: docs/SOURCES.md, "Snapshots"). Not edited by hand. -->

# Alternatives and theories

Oct 23, 2026 · @Chris

## Summary

Historians disagree sharply about how close Napoleon came. That disagreement is useful: it gives the model a target range instead of a single answer.

- **The pessimist benchmark.** A study in the Marine Corps University's Journal of Advanced Military Studies replayed the battle on a modified board game many times. It never produced a French victory and only rarely a draw. Its author thought one change might have broken Wellington: committing the Guard coherently at 18:00 instead of 19:30.
- **The optimist benchmark.** One experienced tabletop wargamer reports the French winning more often than not. Napoleon's own recorded odds were 90 in 100 at breakfast, cut to 60 in 100 once Bülow appeared (his own account, so self-serving).
- **The big alternatives** are Grouchy marching to the guns, an earlier start on drier ground, the Guard at 18:00, a better-formed d'Erlon attack, supported cavalry, and Zieten turning away from Wellington. Historians judge most of them as smaller than their reputation, and Grouchy's most of all.
- **Proposed tuning target:** Napoleon's historical orders lose most of the time. Skilled play can win the battle perhaps a third of the time. I'll check those two numbers with the calibration harness; they are my proposal, not a sourced figure.

## Grouchy marches to the guns

The most famous what-if is also the most contested, and the newer analyses mostly shrink it. Grouchy had three moments when he could have turned west: at daybreak from Gembloux, in the early morning, or at about 11:30 at Walhain when Gérard urged it.

| View | Claim | Source |
| --- | --- | --- |
| Optimist (Ropes, 1892) | Leaving at daybreak for the Moustier and Ottignies bridges, or taking Gérard's advice at noon, would almost certainly have stopped Bülow and Pirch | Ropes, *The Campaign of Waterloo* |
| Analytical (Napoleon Series) | Only an early march on Moustier and Ottignies had any chance. Even then, one critic reckoned he could not have crossed the Dyle before about 16:00, then would have had to beat two Prussian corps and cross 6–8 miles of rough country | Napoleon Series, "Grouchy at Walhain" |
| Waterloo Association | Even if he had marched, it would probably have been too late to change the battle | Libert, Napoleon Series |
| Clausewitz | Grouchy should have split his force out of Gembloux and crossed the Dyle upstream at Limale, not attacked Wavre head-on | Clausewitz, *Campaign of 1815* |
| Revisionist (Dawson) | Questions whether some key orders existed in 1815 or were written later to make Grouchy the scapegoat, and whether Gérard's famous advice happened as told | Dawson, *Napoleon and Grouchy* |

**For the model.** Grouchy should be a branch you can try to trigger, not a free gift.

- You can only reach him by courier. Historically his orders arrived 3 to 7 hours after they were written.
- If he marches at noon, my estimate is that his leading corps, about 15,000 men under Gérard, reaches the east flank between 18:00 and 21:00.
- The Prussians react by leaving more of Pirch's and Thielmann's men in the way.
- An early-morning march via Moustier mostly meets Pirch around the Lasne valley rather than reaching your field.

## Weather and an earlier start

Without the rain the attack could probably have started 2–3 hours earlier, but not at dawn. The army still had to arrive and feed itself.

- **"If it had not rained."** The line comes from Hugo's *Les Misérables*. In exile Napoleon told Gourgaud the rain may have mattered more than people thought. A 1993 meteorological study concluded the soaked ground ruled out a start before late morning.
- **The Tambora theory.** In 2018 Matthew Genge of Imperial College London proposed, in the journal *Geology*, that electrically charged ash from the April 1815 Tambora eruption reached the ionosphere and triggered a burst of cloud and heavy rain over Europe. His evidence is indirect: lab work, models, and records from the Krakatau and Pinatubo eruptions, because 1815 weather data is sparse. It is a plausible theory, not a settled one.
- **The counterargument.** A historian writing in War on the Rocks argues the army was spread out after its march and needed time to gather and cook in any case. Reille only passed Le Caillou around 09:00.

**For the model.** Offer a "dry night" variant: the ground starts firm, but arrival times stay the same.

- A full attack becomes possible around 09:00–10:00 instead of 11:30, which is about two more hours before Bülow arrives.
- Your 05:00 scenario covers the opposite case: wet ground and a partly assembled army.
- Between them they test the two explanations against each other: mud, or time to assemble.

## Napoleon's choices

Napoleon's plan was sound on paper. The fight became a straight frontal brawl on a front under 5 km, partly through his subordinates' mistakes and partly through his own overconfidence.

- **The intended plan.** Pin Wellington's strong right at Hougoumont, break the weaker left, and push him north-west, away from the Prussians. The Fondation Napoléon attributes the failure to Wellington's defences, ineffective French artillery and errors by the corps commanders.
- **Overconfidence.** At breakfast Soult and Reille warned him about Wellington's infantry. Napoleon called the battle "nothing more than eating breakfast" and put the odds at 90 in 100.
- **Manoeuvre instead of assault?** Going round Wellington's right toward Hal would have pushed him onto the Prussians, which is exactly what Napoleon wanted to avoid. Wellington also expected that move and had 17,000 men at Hal for it. Going round the left meant the broken ground at Papelotte, heading toward the Prussians. The Marine Corps University study judges frontal attack the least bad option.
- **Hougoumont.** Reille's 11:00 orders didn't call for taking the château. The attack escalated anyway, and the French spent 33 battalions there to Wellington's 21. A 1907 alternate-history story asks what if the north gate had not been shut.
- **The Guard at 18:00.** After La Haye Sainte fell around 18:00–18:30, Ney asked for fresh troops. Napoleon refused, saying he had none to give, because the Guard was holding Plancenoit. The Guard attacked at about 19:30. The Marine Corps study names the 18:00 Guard attack as the one realistic chance. Wikipedia goes further and claims an earlier fall of La Haye Sainte would almost certainly have broken the allied centre; that is a strong claim from a weak source.

**For the model.** These are all choices you can make in the game.

- Make 18:00–19:00 a true crisis window: Wellington's centre is weakest there, and the Prussians are not yet fully in action.
- Give Jérôme an escalation trait at Hougoumont.
- Let a western flanking move bring Wellington's Hal force onto the field.

## Tactical alternatives

Each of the three big French attacks has a well-documented alternative. That makes formation and support real choices for you rather than flavour.

**d'Erlon's formation, 13:30**

- Most of I Corps attacked in *colonne de division par bataillon*: each battalion in a full three-rank line, the next one a few paces behind it. Eyewitnesses give gaps of 3–6 paces, a front of about 150–180 men and a depth of about 24 ranks.
- Captain Duthilt of the 45th complained the formation made it impossible to form square. The Union Brigade's charge then broke it.
- Why it was used is disputed. One theory is a garbled order: Napoleon wanted *colonne de bataillon par division*, the normal battalion column two companies wide. Another is a deliberate choice for firepower and momentum. Barbero argues for brigade-sized columns instead.
- Not every unit used it. The 85th Line, detached from Durutte's division, formed square and held off the British heavy cavalry.

**The cavalry charges, about 16:00**

- Ney seems to have taken allied movement on the ridge for a retreat and sent the cavalry without infantry. The Fondation Napoléon says Napoleon could not stop it once it started.
- The infantry divisions of Foy and Bachelu joined only near the end. Horse artillery was not brought close enough to wreck the squares.
- Dawson's *Waterloo: The Truth at Last*, based on French archives, disputes that Ney simply threw the cavalry away.

**The Guard's attack, about 19:30**

- Five Middle Guard battalions led, with three Old Guard battalions in support, battalions of 531–654 men. Whether they advanced in columns or in battalion squares is still argued.
- The 1st Foot Guards rose and fired at close range; the 52nd swung out against the column's flank; Chassé's Dutch-Belgians charged with the bayonet.
- Historians agree there were 23 Guard battalions on the field, but only 11 of them can be placed with certainty.

**For the model.**

- Choosing a formation trades firepower and speed against vulnerability to cavalry.
- Cavalry gets a large bonus only when infantry or horse artillery are within reach to support it.
- A defender lying hidden behind the crest gets a first-volley shock bonus.
- Fire into a column's flank multiplies the damage to its cohesion.

## Command and staff

Most historians blame staff work more than any single tactical decision. A minority defend Soult's performance.

- **Soult instead of Berthier.** Berthier, Napoleon's chief of staff for most of the wars, died after a fall from a window on 1 June 1815.
  - Soult was a fine field commander but new to staff work. He sent single couriers where Berthier sent several, set up no courier line to Grouchy, and was slow to turn plans into written orders.
  - Napoleon also changed orders verbally after they had been written.
  - An early-1900s study of the marshals concludes the poor staff work lost the campaign.
  - The dissent: one historical society argues the campaign was in fact well run, and Soult did well on short notice.
- **Ney.** He commanded the front from about 13:00. Ney and Soult were personal enemies, so reports of Napoleon criticising Ney that came through Soult are suspect. In exile Napoleon said he should have given the left wing to Soult rather than Ney.
- **Absent marshals.** Davout stayed in Paris as war minister, Suchet guarded the Alps, and Murat was not used. Alternate-history forums often build a "dream team" of Davout, Suchet, Berthier and Murat.
- **Napoleon's health.** Hemorrhoids are not in dispute: Jérôme's diary records leeches applied during the campaign. Cystitis is also suggested, and one account has him dozing after breakfast under laudanum. A 1988 surgical journal paper made the case. Andrew Roberts and others reject it as an excuse invented to protect Napoleon's legend. Lethargy at key moments is noted more widely.

**For the model.**

- Staff quality sets how many couriers carry each order, how long orders take to write, and how often messages are lost. Soult is the default, with a Berthier variant.
- An optional health rule keeps you at Rossomme in the late morning and adds delay to your orders.
- Ney gets an initiative trait: he acts on what he sees without waiting for you.

## The allied side

The allies had their own near misses. Each of them can become a random roll the player can't see.

- **Would the Prussians march at all?** After Ligny, Gneisenau distrusted Wellington and favoured falling back toward Liège. Blücher and Grolmann insisted on marching to Wellington. Bülow's orders were to stay hidden near Saint-Lambert unless Wellington was already fighting.
- **Zieten's near-diversion, about 18:00–19:00.** Zieten's scouts reported Wellington close to defeat, and he saw stragglers coming back. Then Major von Scharnhorst arrived with Blücher's order to go and help Bülow at Plancenoit, and Zieten turned his leading units south. Müffling, the Prussian liaison at Wellington's headquarters, rode over and persuaded him to come back. His arrival is what let Wellington move Vivian's and Vandeleur's cavalry to the centre.
- **The route.** Hugo claims a local shepherd guided Bülow onto the one exit from the woods his artillery could use. He also reports Müffling saying that an hour later Wellington would have been beaten. Both are literary retellings, so I'd use them only as colour.
- **The force at Hal.** About 17,000 men, mostly Dutch under Prince Frederik, sat at Hal and Tubize, about 15 km west. They guarded Wellington's route to the coast and were never called in. One wargame variant that adds them moves its victory scale one full step in the allies' favour.
- **The Prince of Orange.** After La Haye Sainte fell, he ordered a KGL battalion under Ompteda forward in line, and French cuirassiers cut it to pieces. Recent work by Baker-Smith re-evaluates the Dutch-Belgian contribution more favourably.
- **Wellington's breaking point.** Müffling recorded the Duke saying that if the Prussians did not come soon he would have to retreat.

**For the model.**

- Zieten turns toward Plancenoit with some probability. If he does, Wellington cannot move cavalry off his left.
- Wellington withdraws from the field if his line is badly hurt and no Prussians have arrived by a certain hour.
- The Hal force recalls itself if you threaten the west flank.
- The Prince of Orange may throw units forward in line when French cavalry is nearby.

## Historiography

The sources are partisan, and it shows. Who "won" Waterloo shapes how much weight the Prussians get, and this model should give them a lot.

- **Wellington's dispatch.** His report of 19 June praised the Prussian attack as decisive but suggested they came late. He then avoided public debate on the battle for decades.
- **Siborne's model.** Siborne's 1838 scale model showed about 48,000 Prussians engaged at the crisis of the battle. Wellington dismissed it, and Siborne later took about 40,000 Prussian figures off it. Hofschröer's 2004 book argues Wellington deliberately played down the Prussian part. A London Review of Books reviewer accepted the vanity but doubted there was any great "secret."
- **Clausewitz's study.** Clausewitz, chief of staff to Thielmann at Wavre, wrote the *Campaign of 1815*, translated in 2010 by Bassford, Moran and Pedlow. In his sequence, Plancenoit fell and Zieten broke through before the Guard was beaten. Wellington answered with an 1842 memorandum and privately called such histories lying works. Clausewitz also used counterfactuals deliberately, as an analytical tool, which a 2017 *Journal of Strategic Studies* article examines.
- **Revisionist French sources.** Dawson's books on Grouchy and on the battle use French archive material. Among other things they put Young Guard troops at Smohain to hold Lobau's northern flank.
- **How reliable are the eyewitnesses?** Accounts of the Guard attack disagree on almost every detail. Napoleon's own memoirs were Clausewitz's main source and are the least reliable on facts. A reviewer of Simms's book notes that all three allied farm strongpoints fell, or nearly fell, for lack of ammunition.

**For the model.**

- Treat Prussian pressure as decisive, not a late extra, and calibrate it hard.
- Where the record is unclear, such as the Guard's formation, the game can be explicit and offer the alternatives.
- Ammunition at the strongpoints is a theme on both sides, not a single incident.

## Alternate-history writing

A French win at Waterloo is one of the most popular scenarios in English-language alternate history, and the most popular in French. Nearly every serious version ends with Napoleon losing the war anyway.

| Work | Turning point | Outcome imagined |
| --- | --- | --- |
| Trevelyan, "If Napoleon Had Won the Battle of Waterloo" (Westminster Gazette, 1907; reprinted in Squire's 1931 anthology) | Blücher breaks faith and stays away | A peaceful Napoleon, but his old enemies stay armed and reform is stifled for decades. Usually cited as the start of modern counterfactual history |
| Chamberlin, "If James Macdonnel Had Not Closed the Gate of Hugomont Castle" (1907) | Hougoumont falls at noon | French victory |
| Mary and Valode, *Et si… Napoléon avait triomphé à Waterloo?* (2011) | No hemorrhoid attack | French victory |
| Tsouras, *Napoleon Victorious!* (2018) | Several changes on the French side | A full alternative battle narrative |
| Roberts, Smithsonian (2015) | — | Argues Europe might have been better off |
| Adkin and Forrest, *History of War* (2023); Forrest in *History Revealed* | — | About 150,000 Austrians and a larger Russian army were already coming. Napoleon loses the war, only later |

The strategic background backs the pessimists. About 250,000 French faced roughly 850,000 coalition troops on four fronts, and the Austrians weren't expected on the Rhine until late July.

**For the model.** Victory is judged on the battlefield only. An optional epilogue screen could sketch what follows, drawing on these essays.

## Quantitative models and wargame designs

Game designers settled most of the questions this model faces long ago. Where their answers disagree, that gives us a range to aim for.

| Design or study | What it does | Lesson for this game |
| --- | --- | --- |
| Esdaile, "Napoleon at Waterloo" (Journal of Advanced Military Studies) | Plays a modified board game many times. Never a French win, rarely a draw | His view: the Prussians should always arrive at 17:00, with no optional rules for them or Grouchy. A good "strict history" setting |
| GMT *Battles of Waterloo* (Berg) | 30-minute turns, 210-yard hexes. Leader-initiative command system, variable Grouchy entry, rules for Napoleon's health, the grand battery and the château | Command friction and a health rule are established practice. The Hal force variant moves the victory scale one step |
| SPI *Wellington's Victory* (1976; 2nd edition) | Battalion scale, 100-yard hexes. A Prussian arrival chart, with Prussian positions hidden from the French player | A precedent for random Prussian arrival and fog of war |
| Turcan, *Waterloo* (computer, 1989) | You ride around the field as the commander and can be killed or captured if you get too close | A precedent for making Napoleon's own position a decision |
| Talonsoft *Campaign Waterloo* designer notes | Over 10,000 Prussian stragglers after Ligny; treats weather as a critical factor | Supports tracking how much the Prussians have recovered, and the dry-night variant |
| PBS interactive simulator | 7 graded outcomes, from Napoleon's death to an early French victory | A good shape for our results scale |
| Tabletop experience (Grid Wargaming blog) | The French win more often than they lose | Matches Napoleon's 60-in-100 after Bülow appeared |
| Lanchester analyses (Dupuy Institute; DTIC) | Historical casualty data fits simple Lanchester attrition laws poorly | Supports modelling cohesion and morale rather than pure attrition |

## Tuning table

Thirteen dials come out of this research. The ranges are my estimates, anchored to the sources above. The defaults reproduce history, and the calibration harness will test every one of them.

| # | Alternative | Model parameter | Range | Default | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | Grouchy marches | Chance he marches unasked; when his order arrives; when he reaches the field | Marches unasked 0–20%. If he leaves at noon, he arrives 18:00–21:00 with 10,000–15,000 men | 10%; historical courier delays | Ropes vs. Napoleon Series; Gérard's advice |
| 2 | Night rain | Starting ground wetness | Dry / normal / soaked | Soaked, firm by about 11:00 | 1993 meteorological study; Genge 2018 |
| 3 | French arrival | Arrival window per corps | ±1 hour around history | Reille about 09:00; Durutte about 12:00 | Hofschröer via Napoleonistyka |
| 4 | Prussian friction | Delay from the Wavre fire; time to pass the Lasne; when Bülow attacks | 0–3 h; Bülow attacks 15:30–18:00 | 16:30 ± 45 min | Main brief; wargame arrival charts |
| 5 | Zieten's diversion | Chance he turns toward Plancenoit | 0–60% | 35% | Waterloo Association account |
| 6 | Prussians hesitate | Chance Bülow waits hidden at Saint-Lambert longer | 0–30% | 10% | Gneisenau's distrust; Bülow's orders |
| 7 | Ney's initiative | Chance he charges on seeing allied movement on the crest | Trait 0–1 | High | Cavalry charge accounts |
| 8 | Staff quality | Couriers per order; writing time; chance a message is lost | Soult: 1 courier; Berthier: 2–3 | Soult | Staff-work sources |
| 9 | Napoleon's health | Pinned at Rossomme in the late morning; extra order delay | Off / on | Off | Contested; offered as an option |
| 10 | Hal force | What makes it march; time to arrive | 4–6 h after you threaten the west flank | Recalled only by a western threat | Wargame variant |
| 11 | Wellington's breaking point | Withdraws if his line is broken and no Prussians are present | Deadline 18:00–20:00 | 19:00 | Müffling |
| 12 | Guard timing | How weak Wellington's centre is, by hour | Crisis window 18:00–19:00 | As in history | Esdaile; Ney's request |
| 13 | Hougoumont | Jérôme's chance of escalating beyond his orders | 0–1 | High | Reille's orders; 33 vs. 21 battalions |

**Outcome targets for the harness:** your historical orders lose 70–85% of the time. Expert play wins the battle 25–40% of the time. A strict-history setting (no Grouchy, Prussians fixed at 17:00) matches Esdaile's results.

## Sources

As with the main tab, figures come from search extracts of these pages, cross-checked where possible. The underlying books are cited second-hand.

**Grouchy and the Prussians**

- [Ropes, The Campaign of Waterloo (Gutenberg)](https://www.gutenberg.org/files/56995/56995-h/56995-h.htm)
- [Napoleon Series: Grouchy at Walhain](https://www.napoleon-series.org/military-info/battles/1815/c_grouchyorders.html)
- [Napoleon Series: Battle of Wavre (Libert)](https://www.napoleon-series.org/military-info/battles/hundred/c_chapter6.html)
- [Goodreads: Dawson, Napoleon and Grouchy](https://www.goodreads.com/en/book/show/34413749)
- [Clausewitz, Campaign of 1815, ch. 50–58](https://www.clausewitzstudies.org/readings/1815/five50-58.htm)
- [Waterloo Association: Prussian assault on Plancenoit](https://www.waterlooassociation.org.uk/2018/06/01/prussian-assault-on-plancenoit/)
- [The Decisive Victory: Waterloo (Prussian decision)](https://dokumen.pub/the-decisive-victory-waterloo-9781472895998-9781472801043-9781472810465.html)
- [Hugo, Les Misérables, Bülow's guide (Standard Ebooks)](https://standardebooks.org/ebooks/victor-hugo/les-miserables/isabel-f-hapgood/text/chapter-2-1-11)

**Weather**

- [Imperial College London: Tambora and Waterloo](https://www.imperial.ac.uk/news/187828/napoleons-defeat-waterloo-caused-part-indonesian/)
- [ScienceAlert: Genge's findings](https://www.sciencealert.com/?p=38873)

**Napoleon's choices and tactics**

- [Esdaile, "Napoleon at Waterloo" (Journal of Advanced Military Studies, PDF)](https://www.usmcu.edu/Portals/218/1_JAMS_12_2_Esdaile.pdf)
- [Project MUSE: Esdaile abstract](https://muse.jhu.edu/pub/419/article/805917)
- [Fondation Napoléon: How did Napoleon lose Waterloo?](https://www.napoleon.org/en/history-of-the-two-empires/articles/bullet-point-35-how-did-napoleon-manage-to-lose-the-battle-of-waterloo/)
- [Fondation Napoléon: Van-Ess, the odds remark](https://www.napoleon.org/en/history-of-the-two-empires/articles/waterloo-in-the-life-of-napoleon-buonaparte-by-william-lodewyck-van-ess/)
- [Andrew Roberts: Napoleon and Wellington extract](https://andrew-roberts.net/books/napoleon-wellington/extract)
- [Waterloo: June 18, 1815, the fourth phase](https://erenow.org/ww/waterloo-june-18-1815-the-battle-for-modern-europe/6.php)
- [Wikipedia: La Haye Sainte](https://en.wikipedia.org/wiki/La_Haye_Sainte)
- [The Napoleonic Wars forum: d'Erlon's formation](https://www.thenapoleonicwars.net/forum/general-discussions/was-d-erlon-s-attack-in-line-formation)
- [Dining Table Napoleon: d'Erlon's attack](https://diningtablenapoleon.com/derlons-attack-at-waterloo-a-wargamers-puzzle/)
- [Hexwar: myths of Waterloo](https://www.hexwar.com/wiki/games/napoleons-last-battles/common/myths.html)
- [Napoleon Series: column versus line](https://www.napoleon-series.org/military-info/organization/maida/c_maida3.html)
- [Project Hougoumont: the Guard attack](https://www.projecthougoumont.com/trying-to-understand-the-guard-attack-at-waterloo/)
- [Goodreads: Dawson, Waterloo: The Truth at Last](https://www.goodreads.com/book/show/41633548)

**Command, staff and health**

- [Dunn-Pattison, Napoleon's Marshals (Gutenberg)](https://www.gutenberg.org/files/34400/34400-h/34400-h.htm)
- [War on the Rocks: Napoleon's makeshift army](https://warontherocks.com/why-napoleons-makeshift-army-ultimately-lost-the-most-famous-battle-in-european-history/)
- [Napoleonic Historical Society: Waterloo perspectives](https://napoleonichistoricalsociety.org/waterloo-perspectives/)
- [Napoleon Books: Soult's couriers](https://napoleonbooks.com/news/)
- [Welling et al., "Piles of defeat" (1988)](https://link.springer.com/article/10.1007/BF02554365)
- [Age of Revolution: Bonaparte's health](https://ageofrevolution.org/?p=8559)
- [Substack: hemorrhoids and Waterloo](https://jjmilt.substack.com/p/did-a-bad-case-of-hemorrhoids-cause)

**Allied side and historiography**

- [Napoleon Series review: Wellington's Smallest Victory](https://www.napoleon-series.org/reviews/general/c_smallest.html)
- [LRB: Dictators on the Loose](https://www.lrb.co.uk/the-paper/v27/n01/miles-taylor/dictators-on-the-loose)
- [NPR: Hofschröer interview](https://www.npr.org/2005/06/19/4707924/wellingtons-waterloo-a-model-victory-of-deceit)
- [Clausewitz Studies: Wellington versus Clausewitz](https://clausewitzstudies.org/readings/1815/eight.htm)
- [Taylor & Francis: Clausewitz's counterfactuals](https://www.tandfonline.com/doi/full/10.1080/01402390.2017.1308862)
- [The Low Countries: the Prince of Orange (PDF)](https://the-low-countries.com/wp-content/uploads/2024/08/TLC_23_GrootDeel_JeroenVanZanten.pdf)
- [History of War: Wellington's Hidden Heroes](https://www.historyofwar.org/bookpage/baker_smith_wellingtons_hidden_heroes.html)
- [Goodreads: Simms, The Longest Afternoon](https://www.goodreads.com/book/show/24903542)

**Alternate history and strategy**

- [Uchronia: Trevelyan's essay](https://uchronia.com/label/trevifnapo.html)
- [Shannon Selin: What if Napoleon won Waterloo?](https://shannonselin.com/?p=2657)
- [Uchronia: Tsouras, Napoleon Victorious!](https://www.uchronia.com/label/tsounapole.html)
- [History Revealed: Forrest interview](https://historyrevealed.com/period/modern/membership/alternate-history-what-if-napoleon-won-waterloo)
- [World History Encyclopedia: Waterloo](https://worldhistory.org/article/2303)

**Wargames and models**

- [GMT: Battles of Waterloo](https://www.gmtgames.com/p-254-battles-of-waterloo.aspx)
- [Grognard: Hal garrison variant](https://grognard.com/variants1/baw.txt)
- [Wellington's Victory support booklet (PDF)](https://gamers-hq.de/media/pdf/5c/9b/fe/WV2_Support_Booklet.pdf)
- [Wikipedia: Waterloo (1989 video game)](https://en.wikipedia.org/wiki/Waterloo_(video_game))
- [Campaign Waterloo designer notes (PDF)](https://wargameds.s3.amazonaws.com/web/nap/Waterloo/Notes.pdf)
- [PBS: Waterloo interactive simulator](https://www.pbs.org/empires/napoleon/n_war/ibs/)
- [Grid Wargaming: Waterloo](http://www.gridwargaming.co.uk/2024/06/the-battle-of-waterloo-belgium-june.html)
- [Dupuy Institute: Lanchester and historical warfare](https://dupuyinstitute.org/2018/05/02/the-lanchester-equations-and-historical-warfare/)
- [DTIC: historical analyses in combat modelling (PDF)](https://apps.dtic.mil/sti/pdfs/ADA557493.pdf)
