# Playtests

Notes from play sessions, by people and by agents. The method is `docs/METHOD.md`, section 6: one question per session, written
down first; the player thinks aloud or writes an after-action report and nobody explains the game during play; the notes record
what the player believed against what was true, which orders arrived too late to matter, where there was nothing worth deciding
and where a result felt unearned. Observation is kept apart from any proposed fix.

**What an agent playtest can and cannot show.** An agent tests whether the fog leaves enough to plan with, and whether a plan can
be dominant. It does not measure whether the game is fun: Chris and a newcomer do that. An agent has also read the history of
these battles, which no test can take away from it; each report says where the player leant on that instead of on what he was shown.

## Running one (`source/sim/tools/agentplay.js`)

```
cd source/sim
node tools/agentplay.js new <folder> --battle waterloo --seed 1815 --view chief    # the briefing, the order menu, turn 0
node tools/agentplay.js next <folder> orders.json [--until HH:MM]                  # give orders, run to the next stop
node tools/agentplay.js umpire <folder> --out <another folder>                     # after the battle: the truth and the causes
node tools/agentplay.js verify <folder>                                            # the saved replay ends on the same state
```

- `--view chief` is Napoleon's view: each turn is written from `view.snapshot('chief')` and his drained events and nothing else
  (`tools/test_agentplay.js` fails if truth reaches a turn). `--view truth` is the umpire's picture at each stop.
- Orders are the order builder's own specs, in a JSON array; the menu printed at turn 0 gives their shape.
- A session is three agents, each with a fresh context: the **player**, given only the session folder and the two commands; the
  **umpire's reader**, given the umpire's record and the turns the player was shown but not the player's reasoning; and whoever
  writes the session up. The player's journal and the reader's notes are filed unedited.
- Each session's folder here holds `question.md` (written before play), `replay.json` (battle, seed, settings, order log, stops,
  result and final state hash: `node tools/replay.js fight <file>` fights it again), `session.json`, the player's journal and
  after-action report, the reader's observations, and a summary.

## Sessions

| Date | Battle, view, seed | Question | Folder |
| --- | --- | --- | --- |
| 12 Nov 2026 | Waterloo, Napoleon's view, seed 1815 | Is there enough to form a plan at 11:00, and to know in time whether it is working? | `2026-11-12-waterloo-napoleon-agent/` (**not played**: the player agent was stopped before its first move) |

What the allied side needs before Wellington's view can be played: `wellington-headless.md`.
