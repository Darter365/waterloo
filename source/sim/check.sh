# Quick checks for every change (about a minute): the pack validator, the lint, the tools' self-tests, the test bench, and a sample of
# the reference battles. ref/ref_*.json are release 3's (phases 0-2b were bit-identical to them); ref/p2_*.json are phase 2's, recorded
# once Waterloo was back in band: a change meant to leave results alone must replay them exactly (full set: node refset.js check ref/p2_<mode>.json).
cd "$(dirname "$0")"
set -e
node packs/validate.js waterloo
node tools/lint.js
node tools/test_tools.js
node tools/bench.js --n 60 | tail -1
node refset.js check ref/p2_hist.json 4
node refset.js check ref/p2_chaos.json 3
node refset.js check ref/p2_dawn.json 2
node refset.js check ref/p2_dry.json 2
