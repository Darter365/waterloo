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
- **Long-term aim.** A 3D game set at the generals' historical headquarters, with sound, riders arriving and a spotting glass,
  later on an engine suited to large asset counts. The map interface and core mechanics come first.

## How we work

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

- Campaign score tiers and points (`stakes.js`, each pack's `stakes`): 90, 72, 54, 32, 10, plus or minus 8 for the exchange.
- At Waterloo the historical orders score 7 and doing nothing scores 24. Defensible (1815 was a catastrophe), but worth a look.
- A tap within 28 screen pixels of a named place takes the place when ordering from the map.
- Life-size object sizes in the ground view (tree 18 m, wall 2 m, cottage 5 m, farm 7 m, men 1.8 m), and the 14 m tree spacing.
- Sky and light colours, and reading short seeing as overcast only while the sun is up (the game has no cloud data).
- Slopes are steepened tenfold for the shading painted on the ground; the view from above draws heights three times life size.

## Open questions (not decided)

- **The idle-army gap.** The allies never attack a French army that sits still, so the field ends a draw. Fixing it changes
  how battles fight.
- **One shared dice sequence.** Changing one order shifts all later luck. A stream per purpose would let what-ifs share luck,
  but changes results.
- **Generic commanders on every side win Waterloo for the French** (a marginal French victory in 29 battles of 30, roadmap,
  27 Oct; not re-run since). Fair counterfactual, or an attacker that is too strong?
  A battle outside June 1815 is needed to tell.
- **Brigades in the ground view are flat slabs.** Ranks of simple figures is the suggested next step; shadows are another.
- **Vegetation exists only where the map data has it.** Ligny has none recorded.
- **Never measured:** frame rate of the 3D view on a real GPU or phone (tests use software rendering).
- **Which comes next:** moving the 2D map onto the contract, or the idle-army rule. Chris has not chosen.
