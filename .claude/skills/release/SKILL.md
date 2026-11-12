---
name: release
description: Take a finished branch of Napoleon's Command through its gates, pull request, merge and the check of the live site. Use when a change is ready to hand over, merge, publish or release. Lists the steps and gates in order by merge class and points at CLAUDE.md and source/README.md.
---

# Release a change

This is a checklist, not the procedure. The procedure is `CLAUDE.md`: "Merging" (classes, gates, what follows a merge), its
commands table, and "How to work here". Building is `source/README.md`, "Building". Read those now. If this file and they
disagree, they are right: fix this file in the same pull request.

## Steps, in order

1. **Class.** Name the class of the change, the higher if unsure. A brief that says "show me first" means: open the pull
   request and wait, whatever the class.
2. **Record.** Decisions settled by this work go in `docs/DECISIONS.md` with the date; a choice of Claude's goes under
   "Claude's choices awaiting Chris". Update `docs/ROADMAP.md` if a step is finished.
3. **Gates for the class,** run in this session with the output kept for the pull request:
   - Class 1: `sh check.sh`.
   - Class 2: `sh check.sh`; all 120 reference battles identical; `sh regress.sh`; the UI audit; the offline test.
   - Class 3: the `results-change` skill's list.
   - Class 4: whatever the brief asks; none of them permits a merge.
4. **Build last** (classes 2 and 3): `sh ../deploy.sh`, and commit the source change and the rebuilt root site together.
   Never edit the built files at the root by hand.
5. **Reviewer** (classes 2 and 3; any class if the brief asks): write the diff against `main` to a file outside the
   repository, give its path and the pull request's description to the `reviewer` subagent, and paste its findings into
   the pull request unedited. Act on a blocking finding or say why not.
6. **Pull request.** What changed; what was verified, with the numbers (which suites, how many battles, which seeds); what
   was not; screenshots of anything the player sees; Claude's choices awaiting Chris.
7. **Merge or wait.** Merge only if the class is 1, 2 or 3 and every gate passed in this session. Otherwise wait. A gate
   that fails stops the merge; never edit a test, a band, a `KNOWN` list or the lint allow-list to pass one.
8. **After a merge.** Label the pull request `self-merged`. Wait for the site to publish, load the live page and play one
   order through. If that fails, revert the merge at once and tell Chris.
9. **Tell Chris.** A push notification after a merge, a revert or a failed gate, and a short report.
