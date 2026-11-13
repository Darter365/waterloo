# Quick checks for every change (about six minutes on a two-core machine): the pack validator, the lint, the tools' self-tests, the test bench, the contract's
# tests (view.js), the agent harness's (Napoleon's view leaks no truth; a played battle replays exactly), the dice's tests, the strategy bench, the loop's measures leaving a battle as it was (tools/loop.js), and a sample of the reference battles. ref/ref_*.json are release 3's (phases 0-2b were bit-identical to them); ref/p2_*.json are phase 2's, recorded
# once Waterloo was back in band: a change meant to leave results alone must replay them exactly (full set: node refset.js check ref/p2_<mode>.json).
cd "$(dirname "$0")"
set -e
node packs/validate.js waterloo
node tools/lint.js
node tools/test_tools.js
node tools/bench.js --n 60 | tail -1
node packs/validate.js toy-ridge | tail -1
node tools/fight.js toy-ridge 3 | sed -n 2p
node tools/test_view.js waterloo 1003 | tail -1
node tools/test_view.js ligny 8 | tail -1
node tools/test_agentplay.js | tail -1
node tools/test_dice.js | tail -1
# 12 battles a plan, not 2: a plan is judged by its middle battle, and Napoleon's own orders end in an allied victory about four
# times in five, so the middle of 2 or of 6 can be a draw (it was, with the keyed dice). More battles on Chris's say, 12 Nov; 12 here and 30 for the gate are Claude's figures.
node tools/strategies.js --n 12 | tail -1
node tools/loop.js waterloo --check 1 | tail -1
node tools/loop.js ligny --check 1 | tail -1
node refset.js check ref/p2_hist.json 4
node refset.js check ref/p2_chaos.json 3
node refset.js check ref/p2_dawn.json 2
node refset.js check ref/p2_dry.json 2
# simulation speed beside the stored baseline (results/ticktime_baseline.json). It warns on a slowdown and never fails the check: a cloud machine is not a phone
node tools/ticktime.js --short
