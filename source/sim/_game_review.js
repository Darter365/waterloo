/* ================= 7. the umpire's review ================= */
// At the end the umpire looks over the battle for things that look wrong: numbers far outside anything in 1815, places that changed
// hands too often, brigades wiped out, orders that stuck, a re-run that did not match. You can flag any turning point that looks wrong
// to you and add a note. All of it, with the seed, the settings and your orders (enough to fight the same battle again), can be saved
// where Claude can read it (on the published page) or copied to paste into a conversation (anywhere, offline included).
const REVIEW = { db: null, saved: null };
(async () => { try { if (window.claude && window.claude.use) REVIEW.db = await window.claude.use('db'); } catch (e) { REVIEW.db = null; } if (G && G.phase === 'over') renderReview(); })();
function autoFlags() {
  const R = SIM.result, M = SIM.metrics, f = [], C = SIM.command;
  const range = { FR: [20000, 27000, 'French'], AL: [13000, 17000, 'Anglo-allied'], PR: [5000, 8000, 'Prussian'] };
  for (const [k, [lo, hi, n]] of Object.entries(range)) { const v = R.cas[k].kw; if (v > hi * 1.6 || (v < lo * 0.3 && R.t > 18 * 60)) f.push({ id: 'cas' + k, text: `${n} killed and wounded: ${fmt(v)}, against ${fmt(lo)}–${fmt(hi)} in 1815.` }); }
  const flips = {}; for (const l of SIM.log) if (l.cat === 'place' && l.sp) flips[l.sp] = (flips[l.sp] || 0) + 1;
  for (const [sp, n] of Object.entries(flips)) if (n >= 7) f.push({ id: 'flip' + sp, text: `${capF(SIM.spById[sp].name)} changed hands ${n} times.` });
  for (const u of SIM.units) if (u.str0 > 400 && (u.killed + u.wounded) / u.str0 > 0.8) f.push({ id: 'gone' + u.id, text: `${u.name} lost ${Math.round(100 * (u.killed + u.wounded) / u.str0)}% of its men killed and wounded.` });
  for (const o of C.orders) if (o.from === 'napoleon' && o.receivedAt != null && o.actedAt == null && o.status !== 'waiting' && o.status !== 'cancelled' && o.to !== 'grouchy' && o.to !== 'hq' && SIM.t - o.receivedAt > 60) f.push({ id: 'stuck' + o.id, text: `Your order of ${hm(o.issuedAt)} to ${SHORT[o.to] || o.to} arrived at ${hm(o.receivedAt)} and was never acted on (${o.status}).` });
  if (M.bulowAttack != null && M.bulowAttack < 14 * 60) f.push({ id: 'bulowEarly', text: `Bülow attacked at ${hm(M.bulowAttack)}, far earlier than about 16:30 in 1815.` });
  if (M.frBreak != null && M.frBreak < 17 * 60) f.push({ id: 'frEarly', text: `The French army broke at ${hm(M.frBreak)}.` });
  if (M.hougFall != null) f.push({ id: 'houg', text: `Hougoumont fell at ${hm(M.hougFall)}; it held all day in 1815.`, note: true });
  if (AAR.done.base && AAR.done.base.s && (AAR.done.base.s.grade !== R.grade || JSON.stringify(AAR.done.base.s.cas) !== JSON.stringify(R.cas))) f.push({ id: 'replay', text: 'Fought again from your orders with nothing changed, the battle did not come out the same.' });
  return f;
}
const flagsHTML = flags => flags.length ? `<ul>${flags.map(x => `<li class="${x.note ? 'note' : 'warn'}">${esc(x.text)}</li>`).join('')}</ul>` : `<p class="small ok">Nothing the umpire would query: every figure is within reach of 1815 and nothing stuck${AAR.done.base ? ', and the re-run matched' : ''}.</p>`;
function updateReviewFlags() { const el = $('rv-auto'); if (!el || !SIM || !SIM.over) return; G.reviewFlags = autoFlags(); el.innerHTML = flagsHTML(G.reviewFlags); }
function reviewEvents() { return SIM.log.filter(l => l.important || ['break', 'place', 'army', 'end'].includes(l.cat)).slice(0, 120); }
function renderReview() {
  const box = $('aar-review'); if (!box || !SIM || !SIM.over) return;
  const flags = autoFlags(), ev = reviewEvents(), mine = G.review || (G.review = { flagged: {}, notes: '' });
  box.innerHTML = `<p class="small">The umpire’s own checks are below. Tick any turning point that looks wrong to you and say why in the note: ${REVIEW.db ? 'save it and Claude can read it from this page,' : 'copy it and paste it to Claude,'} with your seed and orders, so the same battle can be fought again to see what happened.</p>
  <div class="rv-auto" id="rv-auto">${flagsHTML(flags)}</div>
  ${(G.marks || []).some(m => m.kind === 'note') ? `<p class="small"><b>Your notes on the map:</b> ${(G.marks || []).filter(m => m.kind === 'note').map(m => `${m.t != null ? hm(m.t) + ' ' : ''}“${esc(m.text)}”`).join('; ')}</p>` : ''}
  <details class="rv-ev"><summary>Turning points: tick any that look wrong (${ev.length})</summary><ul>${ev.map((l, i) => `<li><label><input type="checkbox" data-rv="${i}"${mine.flagged[i] ? ' checked' : ''}><time>${hm(l.t)}</time> ${esc(capF(l.text))}</label></li>`).join('')}</ul></details>
  <label class="rv-lab" for="rv-notes">Your notes for the umpire</label>
  <textarea id="rv-notes" rows="4" placeholder="What looked wrong, or right, and where…">${esc(mine.notes)}</textarea>
  <div class="row">${REVIEW.db ? '<button type="button" id="rv-save">Save for Claude</button>' : ''}<button type="button" id="rv-copy">Copy for Claude</button><span class="small" id="rv-msg" aria-live="polite">${REVIEW.saved ? `Saved at ${REVIEW.saved}.` : ''}</span></div>
  <textarea id="rv-out" class="rv-out" rows="5" readonly hidden></textarea>`;
  G.reviewFlags = flags;
}
function reviewRecord() {
  const ev = reviewEvents(), mine = G.review || { flagged: {}, notes: '' };
  return { kind: 'waterloo-review', version: 'release 3', savedAt: new Date().toISOString(), seed: G.opts.seed, opts: G.opts,
    result: { grade: SIM.result.grade, why: SIM.result.why, t: SIM.result.t, cas: SIM.result.cas, withdrawn: SIM.result.withdrawn || null }, metrics: SIM.metrics,
    orders: G.orderLog, refoughtFrom: G.refoughtFrom || null, toEnd: G.toEnd ? { mode: G.toEnd, from: G.toEndFrom } : null,
    umpireFlags: (G.reviewFlags || []).map(x => x.text), playerFlags: Object.keys(mine.flagged).filter(k => mine.flagged[k]).map(i => ({ t: ev[i].t, text: ev[i].text })),
    notes: mine.notes, mapNotes: (G.marks || []).filter(m => m.kind === 'note').map(m => ({ t: m.t, text: m.text })) };
}
document.addEventListener('change', e => { if (!G || !G.review) return; const c = e.target.closest('[data-rv]'); if (c) G.review.flagged[c.dataset.rv] = c.checked; });
document.addEventListener('input', e => { if (e.target.id === 'rv-notes' && G && G.review) G.review.notes = e.target.value.slice(0, 4000); });
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || !G || !SIM) return;
  if (b.id === 'rv-copy') {
    const txt = 'Waterloo umpire’s review (paste this to Claude):\n' + JSON.stringify(reviewRecord());
    let ok = false; try { await navigator.clipboard.writeText(txt); ok = true; } catch (err) { ok = false; }
    const out = $('rv-out'); if (!ok) { out.hidden = false; out.value = txt; out.focus(); out.select(); }
    $('rv-msg').textContent = ok ? 'Copied. Paste it into a conversation with Claude.' : 'Your browser would not copy it: the text is selected below, copy it by hand.';
  } else if (b.id === 'rv-save' && REVIEW.db) {
    b.disabled = true; $('rv-msg').textContent = 'Saving…';
    try { const id = `s${G.opts.seed}-${Date.now()}`; await REVIEW.db.collection('reviews').doc(id).set(reviewRecord()); REVIEW.saved = new Date().toTimeString().slice(0, 5); $('rv-msg').textContent = `Saved at ${REVIEW.saved}. Claude can read it from this page.`; }
    catch (err) { $('rv-msg').textContent = err && err.code === 'quota_exceeded' ? 'The page’s store is full: copy it instead.' : 'It could not be saved here (you may only have view access): copy it instead.'; }
    b.disabled = false;
  }
});
