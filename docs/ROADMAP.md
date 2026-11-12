# Roadmap

A condensed copy of the "Engine roadmap" doc in Chris's Claude account, with where things stand on 12 November 2026. The full
text as it stood on 9 November is beside this file (`roadmap-full-2026-11-09.txt`, tables flattened). If this file and the doc
disagree, ask Chris; the order of work is his.

## The aim

One simulation that knows no battle and no era; battles and eras are data, checked by a validator and tried on a test bench.
It serves a command game that is engaging, immersive and true to its period, good enough to teach with.

## Phases

| Phase | What | Status |
| --- | --- | --- |
| 0. Freeze the reference | Fingerprints of 400 reference battles | Done 26 Oct |
| 1. Restructure | Engine created per battle; data into packs; schema, validator, lint | Done; the 400 replayed exactly |
| 2. General sim | Capabilities, weapons and formations as data, light from date and latitude, general morale events, supply, lasting melee, obstacles, the test bench | Done; Waterloo in its 1815 band over 500 battles; 120 battles recorded as the new reference |
| 3. Generic commanders and leader files | Doctrine from settings and objectives; plan rules; Wellington, Blücher, Lobau and Ney as data | Done 27 Oct, except either side playable, which the roadmap marks done but the game does not yet offer (one side per battle) |
| 4. Tools | Battle lab, tuner, map pipeline, CSV armies, versions, a test battle from files alone | Done 27 Oct |
| 5. Proof battles | Ligny, Cowpens, a pre-gunpowder battle, Gettysburg, in that order | Ligny playable (28 to 30 Oct), 7 of 9 proposed checks in band. The rest not started |

## Since the roadmap was written

- **Release 4 (9 Nov):** the campaign verdict, orders written from the map, "why?" on events, the view contract (`view.js`)
  and the strategy bench.
- **Claude Code (9 Nov):** `CLAUDE.md`, the session setup hook, `tools/pw.py`.
- **3D relief view (10 to 12 Nov, merged 12 Nov):** the umpire's picture in three.js, drawn from the contract alone; a view
  from above and a life-size view from the ground; light from the hour and the weather. This is the roadmap's "browser 3D"
  option taken as the first step, not a choice of final engine.
- **The chain of command as data (12 Nov):** every army, wing, corps and division an entry with its commander
  (`battle.chain`), checked by the validator and printed by `tools/oob.js chain`. No change to results; the commanders' code
  does not read it yet (`DECISIONS.md`, open questions).

## What is next (order not yet chosen by Chris)

1. Move the 2D map onto the contract (no change to results). Prerequisite for a headquarters view from Napoleon's beliefs.
2. The idle-army rule: a defender who takes the initiative. Changes results, so it needs Chris's go-ahead.
3. Sound from the event stream.
4. A calibrated battle outside June 1815 (the roadmap's order says Cowpens).
5. 3D from headquarters: camera at Napoleon's position, drawn from what he knows; then judge whether a native engine is worth
   it. If so, embed this JavaScript simulation rather than port it.
6. Repository: have GitHub build and publish the site, so built files are no longer committed at the root.

## Planned battles and what each proves

| Battle | Proves | Engine change expected |
| --- | --- | --- |
| Ligny, 16 Jun 1815 | A second battle of the same era from data alone | None |
| Cowpens, 17 Jan 1781 | A second era pack, company-scale units, command by voice | None beyond phases 2 to 4 |
| A pre-gunpowder battle (Agincourt, Hastings or Cannae) | Lasting melee, armour against missiles, obstacles; targets will be ranges because the sources dispute the numbers | None beyond phases 2 to 4 |
| Gettysburg, 1 to 3 Jul 1863 | Rifle-musket era, three days with summarised nights, either side | The day-and-night clock |
| Long Island, Bunker Hill | Boats as a way to cross water | A water-crossing feature |
| Yorktown | Needs a siege module | Deferred by decision |

## Risks the roadmap names

- Generic commanders fight Waterloo differently from the hand-written ones (they win it for the French; see the open
  questions in `DECISIONS.md`).
- The earlier the era, the thinner and more disputed the evidence.
- Leader files are interpretations; each setting carries a source and a confidence.
- New battles are slow data work (maps, orders of battle).

## A later native 3D client

The roadmap keeps three ways open to run the simulation inside a native engine (embed the JavaScript, port to C++, or run it
as a separate process) and compares Unreal, Unity, Godot and browser 3D. Nothing is decided beyond "browser first, then
judge". The full text has the comparison tables.
