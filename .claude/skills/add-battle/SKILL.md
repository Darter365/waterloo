---
name: add-battle
description: Add a new battle to Napoleon's Command as pack data (terrain, army lists, the battle file). Use when asked to add, import or start a battle or its map or order of battle. Lists the steps and gates in order and points at the procedure in source/README.md and docs/METHOD.md.
---

# Add a battle

This is a checklist, not the procedure. The procedure is `source/README.md`, "Adding a battle" (and "The chain of command");
the standards for its numbers are `docs/METHOD.md`, sections 2 and 3. Read those now. If this file and they disagree, they
are right: fix this file in the same pull request.

## Before starting

- Settle the class with Chris's brief (`CLAUDE.md`, Merging). Pack data that changes no existing battle is class 2. Giving
  the battle targets or a `stakes` block, or making it playable, is class 4: open the pull request and wait.
- Rule 3: a battle is data. If it seems to need engine code, stop: that is a general rule plus pack data, and if it changes
  how battles fight it is a separate, approved task (the `results-change` skill).
- Rule 4 and `docs/METHOD.md` section 2: every number is sourced, derived, calibrated or `(est.)`; confidence uses the
  packs' words; name each work and whether it was opened in this session. Where accounts disagree, keep the range and who
  says what. If something cannot be sourced, ask Chris; do not fill the gap.

## Steps, in order

1. Terrain, then army lists, then the battle file, then registering the files: steps 1 to 3 of "Adding a battle".
2. Validate and fight it: step 4 of "Adding a battle". Print the chain of command and read where the code parts from the
   table ("The chain of command").
3. First contact (`docs/METHOD.md`, section 3): run the battle before any tuning and save the result. Say how many battles
   and which seeds.
4. Do not tune era constants to make it fit. A constant that must move is a results-changing task.

## Gates, in order

The class decides (`CLAUDE.md`, Merging; commands in its table). For class 2: `sh check.sh`; all 120 reference battles
identical; `sh regress.sh`; the UI audit; the offline test; `sh ../deploy.sh` so the rebuilt site is in the last commit;
then the `reviewer` subagent on the diff, with its findings in the pull request.

## Hand over

A pull request that says what was verified with the numbers and what was not, lists the sources and the disputed points,
and records any choice of Claude's in `docs/DECISIONS.md` under "Claude's choices awaiting Chris". Then the `release` skill.
