# What is missing for Wellington to be commanded headless

Asked for on 12 November 2026 with the agent harness: find out and report, do not build. Read from the code on that day
(`command.js`, `orders.js`, `ai.js`, `doctrine.js`, `plans.js`, `view.js`, `stakes.js`, `packs/battles/waterloo.js`); nothing
here was tested by running it. "Read" below means I opened the lines named; a judgement is marked as one.

## What already works for either side

- **The contract.** `view.snapshot('chief')` shows whoever the command layer's chief is (`view.js`: `c.X.chief`). Nothing in it
  is French. The agent harness needs no change beyond the view's name.
- **An opponent.** The computer can command the French two ways today: the historical orders (`script.js`, the pack's
  `plans.historical`, side `FR`), or the generic doctrine, which `ai.js` hands any army named in `opts.generic`
  (`ai.js`, where `S.generic` is built).
- **Beliefs.** The command block already gives Wellington a belief record (`commanders: { AL: ['wellington'] }`) and a glass
  (`eyes`), because the doctrine reasons from it.

## What is missing

1. **The command layer takes its side from the battle, not from the game.** `command.js` builds one configuration per battle
   (`cfgOf`, cached), with one `side` and one `chief`, and `install(E, opts)` has no option for either. `orders.js` closes over
   that side and chief (`CHIEF` on 20 lines), and the inbox, the sightings "from headquarters", the sound alerts and the riders
   bringing reports all go to that one chief (`command.js`, on 23 lines). `replay.js` `setup` passes no side. Needed: the side as a
   setting of the game, and a command block per playable side.
2. **Waterloo has no allied command block.** The pack's `recipients`, `posts`, `reporters`, `front`, `battery`, `retreat` and
   `prefForm` are all the French army's. The reporters are seven French commanders. Needed: the same tables for the
   Anglo-allied army.
3. **There is nobody under Wellington to order or to hear from.** In the chain of command the Anglo-allied army is one "corps"
   of 52 bodies under Wellington himself, plus Prince Frederik's corps at Hal with no commander. The pack names no Hill, Orange,
   Uxbridge or Picton as a commander with a belief record. An order needs a recipient who reads it and reports back; today
   there is none. This is data (and sourcing: who commanded which brigades on the day, with a citation), not engine code.
4. **Wellington's own decisions are doctrine today.** `commanders: { generic: ['AL'] }` gives the allied army to the generic
   doctrine, with his habits as pack data on the side (`crest`, `sectors`, `feeds`, `reoccupy`, `counter`, `stepBack`, `shifts`,
   `advance`, `withdraw`, `calls`, `liaison`). With a player in the saddle each habit must be sorted: the player's order, a
   subordinate's initiative that stays automatic (as Ney's is for Napoleon), or a staff habit. That sorting is a design
   decision, and it changes how battles fight for that side, so rule 2 applies to it.
5. **The Prussians are a second army in the same coalition.** Blücher is not Wellington's subordinate. The pack already has a
   liaison rule (Müffling's message) and reports from Bülow and Zieten to Wellington. Needed: a decision on what the player may
   send Blücher (a request, as Napoleon's order to Grouchy is a recipient "off the map"), and what he hears back.
6. **Nothing judges the allied commander's day.** `stakes` has one block, `side: 'FR'`; the strategy bench, the briefing texts
   (`game.starts`) and the campaign verdict are Napoleon's. Needed: an allied `stakes` block (a target and score: Chris only,
   class 4), a briefing, and strategies for the bench.
7. **Small French assumptions in the order code.** Writing times are keyed by the French staff (`CK.WRITE`: `soult`,
   `berthier`); the retreat order's text and the off-map dice label are Waterloo's French ones (`orders.js`). Each needs a
   per-side value in the pack.
8. **The game page** has one side's setup form, order builder lists and headquarters posts. Outside this task; listed so the
   count is honest.

## What it adds up to (judgement)

Items 1 and 7 are engine work that should leave the reference battles identical (class 2) if the French stay the default.
Items 2, 3, 5 and 6 are pack data and need sources and Chris's targets. Item 4 is the real design question and the only one
that must change results. The harness itself is ready: once `setup` can be told the side, `--view chief` is Wellington's view.

Which player decision this serves: the defender's, which is a different game from Napoleon's (when to feed a farm, when to
commit the reserve, whether to trust that Blücher is coming). It is also the cleanest test of the idle-army gap from the other
side: a human Wellington can attack a French army that sits still.
