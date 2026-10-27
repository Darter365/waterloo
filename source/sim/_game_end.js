/* ================= fight it out to the end ================= */
// You hand over and the clock runs to nightfall with no more stops: the front left to Ney, Napoleon's own orders from this hour,
// or no more orders at all. The handing over goes into the order log, so the after-action report can fight it again.
function renderEndBox() {
  const ney = SIM.leaders.ney, neyUp = ney && ney.alive !== false;
  $('endmodes').innerHTML = [
    ['ney', 'Leave the front to Ney', neyUp ? 'A letter gives him the whole front, with orders to take the crossroads. He throws in fresh brigades from Reille’s, d’Erlon’s and the cavalry corps as he sees fit; the Guard and Lobau stay as they are.' : 'Ney is down: he cannot take the front.', !neyUp],
    ['hist', 'Napoleon’s own orders from here', `The orders he gave on the day after ${hm(SIM.t)}, each timed as he timed it and by what he knew, given to your army as it now stands.`],
    ['none', 'No more orders', 'Every commander carries on with what he was last told, and waits when it is done.']
  ].map(([v, t, d, off], i) => `<label class="${off ? 'off' : ''}"><input type="radio" name="endmode" value="${v}"${off ? ' disabled' : ''}${i === (neyUp ? 0 : 1) ? ' checked' : ''}><span><b>${t}</b><i>${esc(d)}</i></span></label>`).join('');
}
function openEndBox(open) {
  const b = $('endbox'); if (!G || G.phase !== 'play' || SIM.over) open = false;
  if (open) renderEndBox(); b.hidden = !open; if (open) $('end-go').focus();
}
function fightToEnd(mode) {
  if (!G || G.phase !== 'play' || SIM.over || G.toEnd) return;
  const C = SIM.command;
  if (mode === 'ney') { const spec = { to: 'ney', action: 'sector', sector: 'whole', goal: 'ridgeCentre', conditions: [], manner: {} }; const r = C.order(JSON.parse(JSON.stringify(spec))); if (r.ok) logOrder([spec], r); }
  else if (mode === 'hist') { WScript.historical(SIM, { from: SIM.t }); G.orderLog.push({ i: G.orderLog.length, t: SIM.t, k: 'hist' }); }
  G.toEnd = mode; G.toEndFrom = SIM.t; G.runTo = null; G.gatherUntil = null;
  $('endbox').hidden = true; if (G.pick) cancelPick();
  setPlaying(true); showMap();
}
const END_WORD = { ney: 'the front left to Ney', hist: 'Napoleon’s own orders', none: 'no more orders' };
$('end-go').addEventListener('click', () => { const v = (document.querySelector('input[name=endmode]:checked') || {}).value; if (v) fightToEnd(v); });
$('end-no').addEventListener('click', () => openEndBox(false));
