# Waterloo as Napoleon, agent player, 12 November 2026: not played

**Status: the battle was not played.** The question was written (`question.md`) and the session was set up (Waterloo, Napoleon's
view, seed 1815, history "uncertain", the 11:00 start, Soult's staff, 45 minutes' silence). The player agent read nothing and
gave no order: the model's safeguards stopped it on its first step, flagging the brief itself. The brief asked the player to
write a journal of its thinking before every move, which is this project's "thinks aloud" rule; that request is the likely
trigger (the flag's category was "reasoning extraction"), but I do not know that for certain. The session was not played by
anyone else in its place, so there is no after-action report, no umpire's reading and no order log here.

There are therefore **no playtest observations** from this session. Nothing below is one.

## What can be said without a playtest (from building and testing the harness)

These are facts about the view, checked by running the harness; they are not evidence about play.

- A turn of Napoleon's view can be written from the contract alone, and it is kept honest by a test: 18 turn files of a
  scripted battle are byte for byte the same when every unit, place and army morale is falsified whenever the harness looks
  (`tools/test_agentplay.js`, seed 1003; a deliberate leak planted in a copy of the harness failed the test on 16 of 18 files).
- A played battle replays exactly: the scripted battle's saved replay, fought again by `replay.js` alone, ends on the same
  state hash and result.
- At 11:00, seed 1815, the commander holds 16 enemy contacts. In the one battle I looked at for this (seed 7, two orders at
  11:00), the umpire's record gave 15 contacts for 52 allied bodies on the field at 11:00, and 18,849 men believed against
  69,292 true: about seven tenths of Wellington’s army is unseen at the start. One battle; not a rate.
- Four things the contract does not tell a client, each of which a player would feel: an order reads "sent" from the minute
  it is given; dispatches have no ★ or !! mark; only the last twenty dispatches are kept; the truth carries no orders
  (`docs/DECISIONS.md`, open questions).

## To run it

```
cd source/sim
node tools/agentplay.js new /tmp/play/nap --battle waterloo --seed 1815 --view chief
```

then a player with only that folder and the `next` command, then `umpire` for the reader (`docs/playtests/README.md`). How to
brief the player so that the safeguards let it play is an open question in `docs/DECISIONS.md`.
