cd "$(dirname "$0")"
( node invariants.js chaos 800 120 1100 > f4_a.json; node invariants.js chaos 960 30 dry > f4_c.json; node invariants.js chaos 990 15 1100 strict > f4_g.json ) &
( node invariants.js chaos 920 40 0500 > f4_b.json; node invariants.js hist 1530 30 1100 > f4_d.json; node invariants.js hist 8100 20 0500 > f4_e.json; node invariants.js chaos 1005 15 1100 open > f4_h.json; node invariants.js idle 2020 10 1100 > f4_f.json ) &
wait; echo FUZZDONE
