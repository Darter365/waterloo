# Quick checks for every change (about a minute): the pack validator, the lint, the tools' self-tests, and a sample of the reference
# battles (a phase that must stay bit-identical runs the full set: node refset.js check ref/ref_<mode>.json for each mode).
cd "$(dirname "$0")"
set -e
node packs/validate.js waterloo
node tools/lint.js
node tools/test_tools.js
node refset.js check ref/ref_hist.json 4
node refset.js check ref/ref_chaos.json 3
node refset.js check ref/ref_dawn.json 2
node refset.js check ref/ref_dry.json 2
