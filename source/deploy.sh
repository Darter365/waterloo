#!/bin/sh
# Build the game page and the offline site, and copy the site to the repository root (GitHub Pages serves it from there).
set -e
cd "$(dirname "$0")"
python3 sim/build_game.py
python3 offline/build_offline.py
cp -r offline/site/* ..
echo "site copied to the repository root; commit and push to publish"
