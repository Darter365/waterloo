---
name: results-change
description: Make a change to how battles fight in Napoleon's Command (engine, commanders, command layer, era constants, or anything that moves a reference battle). Use when a task is class 3, or when a change meant to be neutral turns out to alter results. Lists the steps and gates in order and points at CLAUDE.md and docs/METHOD.md.
---

# A results-changing change (class 3)

This is a checklist, not the procedure. The rules are `CLAUDE.md`: rules 1, 2 and 6, and the class 3 row and the bullets
under "Merging". How to compare two versions is `docs/METHOD.md`, section 4. Read those now. If this file and they disagree,
they are right: fix this file in the same pull request.

## Before any code

1. Chris approved this change as a task. If he did not, stop and ask (rule 2).
2. Its acceptance test is written in `docs/DECISIONS.md`, with numbers, before work begins. If it is only under "Claude's
   choices awaiting Chris", he has not confirmed it: ask him to before starting.
3. If the change touches a band, a target or a campaign score, it is class 4: open the pull request and wait.
4. Write down what each run is expected to show before running it (`docs/METHOD.md`, section 4).
5. Record the "before": the same runs as the gates below, on `main`, same seeds.

## While working

- A general rule plus pack data; no battle or era names in the engine (rule 3). Determinism holds (rule 6).
- Every new constant carries its kind (rule 4). A calibrated value names the band it was tuned to.
- Never edit a test, a band, a `KNOWN` list or the lint allow-list to pass a gate.

## Gates, in order

The class 3 row's gates, then the build and the reviewer. Commands are in the table in `CLAUDE.md` and in
`source/README.md`, "Testing" (`tune.js` is only there), which also says what each checks.

1. `sh check.sh`. Its sample of the reference battles diverges until step 7: everything before that sample must pass, and
   the whole script must pass after it.
2. The browser suite, the UI audit and the offline test.
3. The acceptance test from `docs/DECISIONS.md`.
4. Waterloo in its band over 500 (`tools/band.js`).
5. `tools/tune.js`: no check leaves its band.
6. The strategy bench: no new failure.
7. Re-record the reference battles in the same pull request (usage is at the top of `refset.js`), then replay all 120
   against the new files and run `sh check.sh` again.
8. `sh ../deploy.sh`, so the rebuilt site is in the last commit.
9. The `reviewer` subagent on the diff; its findings go in the pull request.

A gate that fails stops the merge. Report the failure to Chris; do not move a constant, a band or a test to get past it.

## Hand over

A pull request with the before-and-after table (the middle and the spread, how many battles, which seeds), what was
verified and what was not, and screenshots of anything the player sees. If a calibration value moved, tell Chris: the rules
doc in his Claude account is the master and `docs/RULES.md` is a snapshot. Then the `release` skill.
