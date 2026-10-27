/* ================= (9) !! alarms: quick events seen from headquarters ================= */
// A new or renewed attack, a cavalry charge, a line breaking or running, the enemy close to headquarters: marked !! in the dispatches
// and on the map, where the mark stays twenty minutes and fades as it ages. Click or tap a mark to open its notice. The alarms are
// only what headquarters saw (the command layer's own sightings), and nothing here draws dice or changes the battle.
const ALARM_MIN = 20;
const ALARM_WORD = { attack: 'An attack', renewed: 'A renewed attack', charge: 'A cavalry charge', break: 'Troops breaking', hq: 'The enemy near headquarters' };
let alarmHits = [];
function liveAlarms() {
  if (!SIM || !G || G.phase === 'setup' || !SIM.command) return [];
  const inbox = SIM.command.inbox, out = [];
  for (let i = inbox.length - 1; i >= 0; i--) {
    const m = inbox[i]; if (SIM.t - m.t > ALARM_MIN) break;
    if (m.alarm) for (const a of m.alarm) if (a.at) out.push({ m, a, age: Math.max(0, SIM.t - m.t) });
  }
  return out;
}
function drawAlarms(g) {
  alarmHits = [];
  if (viewMode !== 'napoleon') return;
  const list = liveAlarms(); if (!list.length) return;
  const placed = [];
  g.save(); g.font = `bold 16px 'EB Garamond', Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const it of list.reverse()) { // oldest first, so the newest is drawn on top
    let [x, y] = P(it.a.at[0], it.a.at[1]); const px = x, py = y;
    y -= 22; for (const q of placed) if (Math.abs(q[0] - x) < 26 && Math.abs(q[1] - y) < 20) y = q[1] - 21; placed.push([x, y]);
    const alpha = 1 - 0.55 * it.age / ALARM_MIN, w = 28, h = 21, red = '#a3290f', light = '#f6efdc'; // the map is paper (or colour) in both themes, so fixed colours read in both
    g.globalAlpha = alpha;
    g.strokeStyle = red; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y + h / 2); g.stroke();
    g.beginPath(); g.arc(px, py, 3.2, 0, 7); g.fillStyle = red; g.fill();
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, 5) : g.rect(x - w / 2, y - h / 2, w, h); g.fillStyle = red; g.fill(); g.strokeStyle = light; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = light; g.fillText('!!', x, y + 1);
    alarmHits.push({ x0: x - w / 2 - 3, y0: y - h / 2 - 3, x1: x + w / 2 + 3, y1: y + h / 2 + 3, m: it.m, a: it.a });
  }
  g.restore();
}
function hitAlarm(x, y) {
  for (let i = alarmHits.length - 1; i >= 0; i--) { const h = alarmHits[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h; }
  return null;
}
function alarmTip(h) {
  const m = h.m, line = h.a.line != null && m.lines ? m.lines[h.a.line] : m.text;
  return { title: `!! ${ALARM_WORD[h.a.kind] || 'Seen'} · ${hm(m.t)}`, text: esc(line || '') + '<div class="small">Click to open the notice.</div>' };
}
{ const ed = extraDraw; extraDraw = g => { if (ed) ed(g); drawAlarms(g); }; }
// for the browser tests: the marks drawn now, in screen pixels
globalThis.WGame && Object.assign(globalThis.WGame, { alarmMarks: () => alarmHits.map(h => ({ x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2, kind: h.a.kind, mid: h.m.id, line: h.a.line })) });
