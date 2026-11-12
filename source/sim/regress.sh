cd "$(dirname "$0")"
python3 build_game.py > /dev/null   # the tests read game.html, which is a build product and not in the repository
echo "### aar6"; timeout 1200 python3 tools/pw.py tests/aar6.py 2>&1 | grep -E "^(STOPS|AAR wait|CHECK|HEAD|LUCK|REFIGHT|errors|VERDICT)" | cut -c1-600
echo "### endtest"; timeout 900 python3 tools/pw.py tests/endtest.py 2>&1 | grep -E "at 1|ended|Check|errors|Draw|victory at" | cut -c1-300
echo "### rettest"; timeout 600 python3 tools/pw.py tests/rettest.py 2>&1 | grep -E "^(SENT|END|VERDICT|Check|errors)" | cut -c1-400
echo "### dawntest"; timeout 600 python3 tools/pw.py tests/dawntest.py 2>&1 | grep -E "^(CLOCK|AT|Check|errors)" | cut -c1-300
echo "### imm desktop"; timeout 600 python3 tools/pw.py tests/immtest.py 2>&1 | grep -E "^(BRIEF|LETTER|STOP|GLASS|errors)" | cut -c1-400
echo "### imm phone dark"; timeout 600 python3 tools/pw.py tests/immtest.py 390 844 dark 2>&1 | grep -E "^(GLASS|errors)" | cut -c1-400
echo "### speed (B1)"; timeout 600 python3 tools/pw.py tests/speedtest.py 2>&1 | grep -E "^(SPEEDS|SLOW|GLIDE|STOP|REAL|FAST|STOPFOR|CHECK|errors)" | cut -c1-400
echo "### ligny"; timeout 900 python3 tools/pw.py tests/lignytest.py 2>&1 | grep -E "^(TITLE|TO|VERDICT|AARSUM|AARCHECK|ERRORS)" | cut -c1-400
echo "### switch"; timeout 600 python3 tools/pw.py tests/switchtest.py 2>&1 | grep -E "^(BATTLES|SWITCH|FRAMES|PLAYED|errors)" | cut -c1-300
echo "### release 4 (phone)"; timeout 900 python3 tools/pw.py tests/release4test.py 2>&1 | grep -E "^(START|BRIEF|STRIP|VERDICT|STAKES|WHY|errors)" | cut -c1-300
echo "### relief view (3D, phone)"; timeout 900 python3 tools/pw.py tests/view3dtest.py 2>&1 | grep -E "^(FOG|OPEN|CANVAS|TICKS|HQ|GROUND|FIELD|LIGHT|INSIDE|ABOVE|NIGHT|CLOSE|AFTER|errors)" | cut -c1-300
echo "### relief view (3D, desktop)"; timeout 900 python3 tools/pw.py tests/view3dtest.py desktop 2>&1 | grep -E "^(DFOG|HQ|WIDE|EYE|GLASS|SWAY|AIM|STEPS|WALK|STEPDOWN|errors)" | cut -c1-300
echo "### done"
