cd "$(dirname "$0")"
echo "### aar6"; timeout 1200 python3 aar6.py 2>&1 | grep -E "^(STOPS|AAR wait|CHECK|HEAD|LUCK|REFIGHT|errors|VERDICT)" | cut -c1-600
echo "### endtest"; timeout 900 python3 endtest.py 2>&1 | grep -E "at 1|ended|Check|errors|Draw|victory at" | cut -c1-300
echo "### rettest"; timeout 600 python3 rettest.py 2>&1 | grep -E "^(SENT|END|VERDICT|Check|errors)" | cut -c1-400
echo "### dawntest"; timeout 600 python3 dawntest.py 2>&1 | grep -E "^(CLOCK|AT|Check|errors)" | cut -c1-300
echo "### imm desktop"; timeout 600 python3 immtest.py 2>&1 | grep -E "^(BRIEF|LETTER|STOP|GLASS|errors)" | cut -c1-400
echo "### imm phone dark"; timeout 600 python3 immtest.py 390 844 dark 2>&1 | grep -E "^(GLASS|errors)" | cut -c1-400
echo "### speed (B1)"; timeout 600 python3 speedtest.py 2>&1 | grep -E "^(SPEEDS|SLOW|GLIDE|STOP|REAL|FAST|STOPFOR|CHECK|errors)" | cut -c1-400
echo "### ligny"; timeout 900 python3 lignytest.py 2>&1 | grep -E "^(TITLE|TO|VERDICT|AARSUM|AARCHECK|ERRORS)" | cut -c1-400
echo "### switch"; timeout 600 python3 switchtest.py 2>&1 | grep -E "^(BATTLES|SWITCH|FRAMES|PLAYED|errors)" | cut -c1-300
echo "### done"
