/* ================= the after-action report (step 6) ================= */
// Written from three things: the umpire's record of what really happened (SIM.log, SIM.metrics), what you knew and when
// (G.knew, the command layer's intel, your order log), and the same battle fought again in the background with one thing changed.
// The engine is deterministic, so a re-run with nothing changed must reproduce your battle exactly; the first job checks that.
const AAR = { jobs: [], done: {}, workers: [], idle: [], running: 0, gen: 0, total: 0, noWorker: false, luck: false };
const AAR_EVERY = 10; // minutes between the strength samples drawn on the chart
const MOMENTS = [['lhsFall', 'La Haye Sainte falls'], ['hougFall', 'Hougoumont falls'], ['plancenoitLost', 'Plancenoit lost to the Prussians'], ['neyCav', 'Ney’s cavalry goes in'], ['guardAttack', 'the Guard attacks'], ['frBreak', 'the French army breaks'], ['alBreak', 'Wellington’s army breaks']];

/* ----- live record kept while you play ----- */
function sampleLive(force) { if (!G || !SIM) return; if (force || SIM.t >= (G.nextSample ?? -1)) { (G.samples || (G.samples = [])).push(WReplay.sample(SIM)); G.nextSample = SIM.t + AAR_EVERY; } }
function aarReset() { AAR.gen++; AAR.jobs = []; AAR.done = {}; AAR.total = 0; AAR.luck = false; const s = $('aar'); if (s) s.hidden = true; }

/* ----- the re-run worker, built from the very scripts this page runs ----- */
function aarWorkers() {
  if (AAR.workers.length || AAR.noWorker) return;
  try {
    const src = [...document.querySelectorAll('script[id^="src-"]')].map(el => el.textContent).join('\n;\n'); // packs, then the engine, in page order
    const body = src + `
;self.onmessage = e => { const d = e.data; try { const r = WReplay.run(d.opts, d.log, d.opt); self.postMessage({ id: d.id, gen: d.gen, s: WReplay.summary(r.E, d.opt.keepSamples ? r.samples : null) }); } catch (err) { self.postMessage({ id: d.id, gen: d.gen, err: String(err && err.message || err) }); } };`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) { const w = new Worker(url); w.onmessage = ev => aarResult(w, ev.data); w.onerror = ev => { ev.preventDefault(); aarResult(w, { id: w.job, gen: w.gen, err: 'worker error' }); }; AAR.workers.push(w); AAR.idle.push(w); }
  } catch (err) { AAR.noWorker = true; }
}
const aarOpts = () => ({ seed: G.opts.seed, history: G.opts.history, scenario: G.opts.scenario, staff: G.opts.staff, silence: G.opts.silence });
function aarQueue(id, label, opt) { if (AAR.done[id] || AAR.jobs.some(j => j.id === id)) return; AAR.jobs.push({ id, label, opt }); AAR.total++; aarPump(); }
function aarPump() {
  if (AAR.noWorker) { // no workers in this browser: one re-run at a time on the page itself, with a pause between them
    if (AAR.running || !AAR.jobs.length) return; const j = AAR.jobs.shift(); AAR.running = 1; const gen = AAR.gen;
    setTimeout(() => { let d; try { const r = WReplay.run(aarOpts(), G.orderLog, j.opt); d = { id: j.id, gen, s: WReplay.summary(r.E, j.opt.keepSamples ? r.samples : null) }; } catch (err) { d = { id: j.id, gen, err: String(err) }; } AAR.running = 0; aarResult(null, d); }, 60);
    return;
  }
  while (AAR.idle.length && AAR.jobs.length) { const w = AAR.idle.pop(), j = AAR.jobs.shift(); w.job = j.id; w.gen = AAR.gen; AAR.running++; w.postMessage({ id: j.id, gen: AAR.gen, opts: aarOpts(), log: G.orderLog, opt: j.opt }); }
}
function aarResult(w, d) {
  if (w) { AAR.idle.push(w); AAR.running--; }
  if (d.gen === AAR.gen) { AAR.done[d.id] = d; aarAfter(d.id); renderWhatIfs(); if (d.id === 'base') updateReviewFlags(); }
  aarPump();
}

/* ----- start: when the battle ends ----- */
function aarStart() {
  if (!$('aar')) return;
  sampleLive(true);
  $('aar').hidden = false;
  renderAarHead(); renderAarChart(); renderWhatIfs(); renderAgain(); renderReview();
  aarWorkers();
  aarQueue('base', 'Fought again with nothing changed', { keepSamples: true });
  aarQueue('hist', 'Napoleon’s own orders on the same day', { historical: true });
  for (const e of liveEntries()) aarQueue('drop' + e.i, 'Without: ' + entryLabel(e), { drop: e.i });
}
// once every "without" run is in, try the three orders that mattered most sent half an hour sooner
function aarAfter(id) {
  const drops = liveEntries().map(e => AAR.done['drop' + e.i]);
  if (/^drop/.test(id) && drops.every(Boolean) && AAR.done.base && !AAR.soonerQueued) {
    AAR.soonerQueued = true;
    const ranked = liveEntries().map(e => ({ e, imp: impact(AAR.done.base.s, AAR.done['drop' + e.i].s) })).filter(x => x.e.t - 30 >= G.t0 && !(x.e.k === 'order' && x.e.spec.to === 'hq')).sort((a, b) => b.imp.score - a.imp.score).slice(0, 3);
    for (const { e } of ranked) aarQueue('soon' + e.i, soonLabel(e), { shift: e.i, by: -30 });
  }
}

/* ----- your orders, as entries of the log ----- */
// the entries that became orders (not tear-ups, and not orders torn up before they were sent)
function liveEntries() {
  const torn = new Set(G.orderLog.filter(e => e.k === 'cancel' && (e.step || 0) === 0).map(e => e.ref));
  return G.orderLog.filter(e => e.k !== 'cancel' && !torn.has(e.i));
}
function placeName(s) { const ob = s.objective || {}; if (ob.place && SIM.objectives[ob.place]) return SIM.objectives[ob.place].name; if (ob.point) return place(ob.point[0], ob.point[1]); if (ob.corps) return CORPS_OF[ob.corps] || WCommand.CORPSNAME[ob.corps] || ob.corps; if (s.action === 'moveHQ') return WCommand.POSTS[s.post].name; if (s.action === 'detach') return SHORT[s.detachTo] || s.detachTo; if (s.action === 'sector' && s.goal && SIM.objectives[s.goal]) return 'to take ' + SIM.objectives[s.goal].name; return ''; }
function shortSpec(s) { const p = placeName(s), a = s.action === 'moveHQ' ? 'move to' : s.action === 'sector' ? (s.sector === 'none' ? 'hand the front back' : `take command of the ${s.sector === 'whole' ? 'whole front' : s.sector + ' of the line'}`) : WOrders.ACTIONS[s.action] || s.action; return `${a}${p ? ' ' + p : ''}`; }
function entryLabel(e) { if (e.k === 'hist') return `Napoleon’s own orders from ${hm(e.t)}`; const list = e.k === 'seq' ? e.specs : [e.spec], to = list[0].to; return `${to === 'hq' ? 'Headquarters' : to === 'grandBattery' ? 'the grand battery' : SHORT[to] || to}: ${list.map(shortSpec).join(', then ')} (${hm(e.t)})`; }
const soonLabel = e => e.k === 'hist' ? `Napoleon’s own orders, handed over 30 minutes sooner (${hm(e.t - 30)})` : capF(entryLabel(e)) + ', sent 30 minutes sooner';
function entryOrders(e) { if (e.k === 'hist') return SIM.command.orders.filter(o => o.byScript && o.issuedAt >= e.t); return (G.made && G.made[e.i] || []).map(id => SIM.command.orders.find(o => o.id === id)).filter(Boolean); }

/* ----- comparing a re-run with your battle ----- */
const enemyKw = s => s.cas ? s.cas.AL.kw + s.cas.PR.kw : 0;
function impact(a, b) {
  const dG = b.gradeN - a.gradeN, dF = b.cas.FR.kw - a.cas.FR.kw, dE = enemyKw(b) - enemyKw(a);
  return { dG, dF, dE, score: Math.abs(dG) * 10000 + Math.abs(dE - dF) };
}
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(Math.round(n / 100) * 100));
function momentsDiff(a, b) {
  const out = [];
  for (const [k, lab] of MOMENTS) { const x = a.metrics[k], y = b.metrics[k]; if ((x == null) !== (y == null) || (x != null && Math.abs(x - y) >= 20)) out.push(`${capF(lab)} ${y == null ? 'never' : hm(y)} (${x == null ? 'never' : hm(x)})`); }
  return out;
}
function gradeCell(s, base) {
  const d = base ? s.gradeN - base.gradeN : 0;
  return `<b>${esc(s.grade)}</b>${base && d ? `<span class="dg ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ better for you' : '▼ worse for you'}</span>` : ''}`;
}

/* ----- rendering ----- */
function renderAarHead() {
  const R = SIM.result, cas = R.cas;
  $('aar-sum').innerHTML = `<b>${esc(R.grade)}</b> at ${hm(R.t)} (${esc(R.why)}). Seed ${G.opts.seed}. Killed and wounded: French ${fmt(cas.FR.kw)}, Anglo-allied ${fmt(cas.AL.kw)}, Prussian ${fmt(cas.PR.kw)}. You gave ${liveEntries().filter(e => e.k !== 'hist').length} order${liveEntries().filter(e => e.k !== 'hist').length === 1 ? '' : 's'}${G.toEnd ? `; from ${hm(G.toEndFrom)} you fought it out to the end with ${END_WORD[G.toEnd]}` : ''}${G.refoughtFrom ? `; this battle was fought again from ${hm(G.refoughtFrom)} with your earlier orders replayed` : ''}.`;
}
// the day at a glance: strength in the ranks, your orders, the farms as they were and as you knew them, and the turning points
function renderAarChart() {
  const box = $('aar-chart'), C = SIM.command, B = C.B.napoleon, t0 = G.t0, t1 = Math.max(SIM.t, t0 + 60);
  const Wd = Math.max(720, Math.min(1400, box.clientWidth || 900)), L = 150, Rm = 18, x = t => L + (Math.max(t0, Math.min(t1, t)) - t0) / (t1 - t0) * (Wd - L - Rm);
  const entries = liveEntries(), farms = farmLanes(), turns = turningPoints();
  const H1 = 120, rowO = 18, rowF = 24, top = 14;
  const yO = top + H1 + 34, yF = yO + entries.length * rowO + 30, yT = yF + farms.length * rowF + 30, H = yT + 88;
  let s = `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" class="aarsvg" role="img" aria-label="The battle hour by hour: strength in the ranks, your orders, who held the farms and when you learned it, and the turning points">`;
  // hour lines
  for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) s += `<line class="hr" x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 8}"/><text class="hrl" x="${x(t)}" y="${top - 3}">${SIM.fmtT(t)}</text>`;
  // 1. men in the ranks
  const smp = G.samples || [], maxR = Math.max(1, ...smp.flatMap(p => [p.ranks.FR, p.ranks.AL, p.ranks.PR]));
  const yR = v => top + H1 - v / maxR * (H1 - 8);
  s += `<text class="sec" x="6" y="${top + 12}">Men in the ranks</text><text class="sub" x="6" y="${top + 26}">not broken, not guns</text>`;
  for (const [side, cls, name] of [['FR', 'fr', 'French'], ['AL', 'al', 'Anglo-allied'], ['PR', 'pr', 'Prussian']]) {
    const pts = smp.filter(p => p.ranks[side] > 0 || side !== 'PR').map(p => `${x(p.t).toFixed(1)},${yR(p.ranks[side]).toFixed(1)}`);
    if (pts.length > 1) { s += `<polyline class="ln ${cls}" points="${pts.join(' ')}"><title>${name}</title></polyline>`; const last = smp[smp.length - 1]; s += `<text class="lnl ${cls}" x="${x(last.t) - 4}" y="${yR(last.ranks[side]) - 4}" text-anchor="end">${name} ${fmt(Math.round(last.ranks[side] / 1000))}k</text>`; }
  }
  s += `<line class="base" x1="${L}" x2="${Wd - Rm}" y1="${top + H1}" y2="${top + H1}"/>`;
  // 2. your orders: from when you gave them to when they were acted on
  s += `<text class="sec" x="6" y="${yO - 12}">Your orders</text>`;
  entries.forEach((e, k) => {
    const y = yO + k * rowO, os = entryOrders(e), head = os[0], last = os[os.length - 1], lab = entryLabel(e);
    const acted = os.map(o => o.actedAt).filter(v => v != null), sent = head && head.sentAt, end = acted.length ? Math.max(...acted) : null;
    const fate = e.k === 'hist' ? `${os.length} of his orders given, ${acted.length} acted on` : !head ? 'refused' : head.status === 'cancelled' ? 'torn up' : head.status === 'lost' ? 'every rider lost' : head.to === 'hq' ? 'done at once' : head.to === 'grouchy' ? (head.receivedAt ? `reached Grouchy ${hm(head.receivedAt)}` : 'never reached Grouchy') : end != null ? `acted on ${acted.map(hm).join(', ')}` : head.receivedAt ? 'its conditions were never met' : 'still on the road';
    const x0 = x(e.t), x1 = x(end ?? (head && head.to === 'hq' ? e.t + 2 : t1)), open = end == null && !(head && head.to === 'hq');
    s += `<g class="ord${open ? ' open' : ''}"><title>${esc(capF(lab))}: ${esc(fate)}</title><rect class="hit" x="${L}" y="${y - 12}" width="${Wd - L - Rm}" height="${rowO}"/>`;
    s += `<line class="ob" x1="${x0}" x2="${Math.max(x0 + 2, x1)}" y1="${y}" y2="${y}"/>`;
    if (sent && sent > e.t) s += `<circle class="os" cx="${x(sent)}" cy="${y}" r="2.6"/>`;
    for (const a of acted) s += `<path class="oa" d="M${x(a)} ${y - 5} l4 5 l-4 5 l-4 -5 z"/>`;
    const txt = lab.length > 70 ? lab.slice(0, 68) + '…' : lab, right = x0 > Wd * 0.62;
    s += `<text class="ol" x="${right ? x0 - 6 : Math.max(x0, x1) + 6}" y="${y + 4}" text-anchor="${right ? 'end' : 'start'}">${esc(capF(txt))}</text></g>`;
    s += `<text class="rowl" x="6" y="${y + 4}">${k + 1}</text>`;
  });
  if (!entries.length) s += `<text class="sub" x="${L}" y="${yO + 4}">You gave no orders.</text>`;
  // 3. farms and villages: who really held them (solid) and who you believed held them (hatched, beneath)
  s += `<text class="sec" x="6" y="${yF - 12}">Farms and villages</text><text class="sub" x="${L}" y="${yF - 12}">solid: who really held it · light: who you believed held it</text>`;
  farms.forEach((f, k) => {
    const y = yF + k * rowF; s += `<text class="rowl" x="6" y="${y + 6}">${esc(f.name)}</text>`;
    const seg = (list, cls, dy, h) => list.forEach((p, i) => { const a = p.t, b = i + 1 < list.length ? list[i + 1].t : t1; if (b <= a) return; s += `<rect class="${cls} h-${p.h || 'no'}" x="${x(a)}" y="${y + dy}" width="${Math.max(1, x(b) - x(a))}" height="${h}"><title>${esc(f.name)}: ${p.h === 'FR' ? 'French' : p.h ? 'the enemy’s' : 'empty'} from ${hm(a)}${cls === 'kn' && p.src ? ' (' + esc(p.src) + ')' : ''}</title></rect>`; });
    seg(f.truth, 'tr', -4, 7); seg(f.knew, 'kn', 5, 5);
    for (const p of f.truth.slice(1)) { const k2 = f.knew.find(q => q.t >= p.t && q.h === p.h); if (k2 && k2.t > p.t) s += `<line class="lag" x1="${x(p.t)}" x2="${x(k2.t)}" y1="${y + 3}" y2="${y + 3}"><title>You heard ${Math.round(k2.t - p.t)} minutes later</title></line>`; }
  });
  if (!farms.length) s += `<text class="sub" x="${L}" y="${yF + 4}">No farm or village changed hands.</text>`;
  // 4. turning points: what really happened (filled) and when you learned the biggest of them (hollow)
  s += `<text class="sec" x="6" y="${yT - 12}">Turning points</text><text class="sub" x="6" y="${yT + 2}">filled: it happened</text><text class="sub" x="6" y="${yT + 16}">hollow: you learned it</text>`;
  // labels are packed into five rows so none overlaps; a label near the right edge is written to the left of its dot
  const lv = [-1e9, -1e9, -1e9, -1e9, -1e9];
  turns.forEach(p => {
    const xx = x(p.t), lab = p.label.length > 40 ? p.label.slice(0, 38) + '…' : p.label, tw = lab.length * 5.3 + 12, left = xx + tw > Wd - Rm;
    const a = left ? xx - tw : xx - 5, b = left ? xx + 5 : xx + tw;
    let L2 = lv.findIndex(v => v < a); if (L2 < 0) L2 = lv.indexOf(Math.min(...lv));
    lv[L2] = b; const y = yT + L2 * 15;
    s += `<g class="tp ${p.known ? 'known' : ''} ${p.side || ''}"><title>${hm(p.t)} ${esc(p.label)}</title><circle cx="${xx}" cy="${y}" r="4"/><text x="${left ? xx - 7 : xx + 7}" y="${y + 4}" text-anchor="${left ? 'end' : 'start'}">${esc(lab)}</text></g>`;
  });
  s += '</svg>';
  box.innerHTML = s;
}
// who held each farm, in truth (from the umpire's log) and in your belief (as Napoleon's record changed)
function farmLanes() {
  const out = [];
  for (const id of SPS) {
    const sp = SIM.spById[id], truth = [{ t: G.t0, h: sp.holder0 || null }];
    for (const l of SIM.log) if (l.cat === 'place' && l.sp === id) truth.push({ t: l.t, h: / by the French/.test(l.text) ? 'FR' : / by the Allies/.test(l.text) ? 'AL' : null });
    const knew = [{ t: G.t0, h: sp.holder0 || null }].concat(G.knew.filter(k => k.sp === id).map(k => ({ t: k.t, h: k.holder, src: k.src })));
    if (truth.length > 1 || knew.length > 1) out.push({ id, name: sp.name.replace(/^the /, 'The '), truth, knew });
  }
  return out;
}
function turningPoints() {
  const C = SIM.command, I = C.intel || {}, M = SIM.metrics, out = [];
  for (const l of SIM.log) {
    if (l.cat === 'army' || l.cat === 'end') out.push({ t: l.t, label: l.text.replace(/\.$/, ''), side: l.side || '' });
    else if (l.cat === 'orders' && l.important && /^(Ney|With La Haye|Kellermann)/.test(l.text)) out.push({ t: l.t, label: l.text.replace(/\.$/, ''), side: 'FR' });
    else if (l.cat === 'place' && /crest/.test(l.text)) out.push({ t: l.t, label: l.text.replace(/\.$/, ''), side: l.side || '' });
  }
  if (M.guardAttack != null) out.push({ t: M.guardAttack, label: 'The Guard goes in', side: 'FR' });
  if (I.eastSeen != null) out.push({ t: I.eastSeen, label: 'You first see troops in the east', known: true });
  if (I.bulowNamed != null) out.push({ t: I.bulowNamed, label: 'You learn it is Bülow', known: true });
  const neySeen = C.inbox.find(m => (m.lines || [m.text || '']).some(x => /Marshal Ney is leading/.test(x))); if (neySeen) out.push({ t: neySeen.t, label: 'You see Ney take the cavalry forward', known: true });
  return out.filter(p => p.t != null).sort((a, b) => a.t - b.t).slice(0, 26);
}
// the what-if table, filled in as the re-runs come back
function renderWhatIfs() {
  const tb = $('aar-table'); if (!tb) return;
  const base = AAR.done.base && AAR.done.base.s, actual = { grade: SIM.result.grade, gradeN: WReplay.GRADES.indexOf(SIM.result.grade), cas: SIM.result.cas, metrics: SIM.metrics };
  const nDone = Object.keys(AAR.done).length, pending = AAR.total - nDone;
  $('aar-prog').innerHTML = AAR.noWorker && !nDone ? 'Re-running the battle on this page (your browser has no background workers), one battle every few seconds…' : pending > 0 ? `<span class="spin" aria-hidden="true"></span> Fighting the battle again: ${nDone} of ${AAR.total} done…` : nDone ? `All ${nDone} re-runs done.` : '';
  // the re-run must reproduce your battle, or the what-ifs mean nothing
  let check = '';
  if (base) { const same = base.grade === actual.grade && JSON.stringify(base.cas) === JSON.stringify(actual.cas); check = same ? '<p class="small ok">Check passed: fought again from your orders with nothing changed, the battle came out exactly as you fought it.</p>' : '<p class="small warn">Fought again from your orders with nothing changed, the battle did not come out exactly as you fought it, so the what-ifs below may mislead. Please tell me (Claude) the seed.</p>'; }
  const ref = base || actual;
  const row = (id, label, extra) => { const d = AAR.done[id]; if (!d) return `<tr class="wait"><td>${esc(label)}</td><td colspan="4" class="small">${AAR.jobs.some(j => j.id === id) || AAR.running ? 'waiting…' : '—'}</td></tr>`; if (d.err) return `<tr><td>${esc(label)}</td><td colspan="4" class="small warn">could not be re-run (${esc(d.err)})</td></tr>`; const s = d.s, im = impact(ref, s), md = momentsDiff(ref, s);
    return `<tr class="${extra || ''}"><td>${esc(label)}</td><td>${gradeCell(s, ref)}</td><td class="num">${fmt(s.cas.FR.kw)}<span class="d">${id === 'base' ? '' : signed(im.dF)}</span></td><td class="num">${fmt(enemyKw(s))}<span class="d">${id === 'base' ? '' : signed(im.dE)}</span></td><td class="small">${md.length ? esc(md.join('; ')) : id === 'base' ? '' : 'no turning point moved by 20 minutes or more'}</td></tr>`; };
  let h = `<thead><tr><th>What changed</th><th>Result</th><th>French killed &amp; wounded</th><th>Enemy killed &amp; wounded</th><th>Turning points that moved (yours in brackets)</th></tr></thead><tbody>`;
  h += `<tr class="you"><td><b>Your battle, as you fought it</b></td><td><b>${esc(actual.grade)}</b></td><td class="num">${fmt(actual.cas.FR.kw)}</td><td class="num">${fmt(enemyKw(actual))}</td><td></td></tr>`;
  h += row('base', 'Fought again, nothing changed', 'chk');
  h += row('hist', 'Napoleon’s own orders on the same day', 'hist');
  const drops = liveEntries().map(e => ({ e, d: AAR.done['drop' + e.i] }));
  const ranked = drops.every(x => x.d && !x.d.err) && base ? drops.slice().sort((a, b) => impact(base, b.d.s).score - impact(base, a.d.s).score) : drops;
  for (const { e } of ranked) h += row('drop' + e.i, 'Without: ' + entryLabel(e));
  for (const e of liveEntries()) if (AAR.done['soon' + e.i] || AAR.jobs.some(j => j.id === 'soon' + e.i)) h += row('soon' + e.i, soonLabel(e), 'soon');
  tb.innerHTML = h + '</tbody>';
  $('aar-check').innerHTML = check;
  // the headline: which order mattered most, one way or the other
  let head = '';
  if (base && drops.length && drops.every(x => x.d && !x.d.err)) {
    const scored = drops.map(x => ({ e: x.e, s: x.d.s, im: impact(base, x.d.s) }));
    const helped = scored.filter(x => x.im.dG < 0 || (x.im.dG === 0 && x.im.dE - x.im.dF < -1500)).sort((a, b) => b.im.score - a.im.score)[0];
    const hurt = scored.filter(x => x.im.dG > 0 || (x.im.dG === 0 && x.im.dE - x.im.dF > 1500)).sort((a, b) => b.im.score - a.im.score)[0];
    const idle = scored.filter(x => x.im.dG === 0 && Math.abs(x.im.dE - x.im.dF) < 500);
    const said = x => `without it the battle ends as ${x.s.grade.replace(/^./, c => c.toLowerCase())}${x.im.dG === 0 ? ' all the same' : ''}, with French losses ${signed(x.im.dF)} and the enemy’s ${signed(x.im.dE)}`;
    if (helped) head += `<p><b>The order that did you most good:</b> ${esc(entryLabel(helped.e))}. ${esc(capF(said(helped)))}.</p>`;
    if (hurt) head += `<p><b>The order that cost you most:</b> ${esc(entryLabel(hurt.e))}. ${esc(capF(said(hurt)))}.</p>`;
    if (idle.length) head += `<p class="small">Changed little either way (same result, losses within 500): ${idle.map(x => esc(entryLabel(x.e))).join('; ')}.</p>`;
    if (!helped && !hurt) head += '<p>No single order changed the result: leaving any one out gives the same result or close to it.</p>';
  }
  const hist = AAR.done.hist && AAR.done.hist.s;
  if (hist) head = `<p><b>Against Napoleon on the day:</b> his own orders, fought on this same day with the same dice, end in ${esc(hist.grade.replace(/^./, c => c.toLowerCase()))} with French losses ${fmt(hist.cas.FR.kw)} (yours ${fmt(actual.cas.FR.kw)}) and the enemy’s ${fmt(enemyKw(hist))} (yours ${fmt(enemyKw(actual))}).</p>` + head;
  $('aar-head').innerHTML = head;
  renderLuck();
}
// how much was luck: your orders, and Napoleon's, on eight other draws of chance
function renderLuck() {
  const box = $('aar-luck'); if (!box) return;
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(k => (G.opts.seed + k * 7919) >>> 0);
  if (!AAR.luck) { box.innerHTML = `<p class="small">Was it skill or the dice? Your orders were timed to your battle; on another day events come at other times. <button type="button" id="aar-luckgo">Fight your orders, and Napoleon’s, on 8 other days</button> (16 more battles, a minute or two).</p>`; return; }
  const chips = pre => seeds.map(sd => { const d = AAR.done[pre + sd]; return d && d.s ? `<span class="gchip g${d.s.gradeN}" title="seed ${sd}: ${esc(d.s.grade)}">${esc(shortGrade(d.s.grade))}</span>` : d && d.err ? '<span class="gchip">error</span>' : '<span class="gchip wait">…</span>'; }).join('');
  const tally = pre => { const g = {}; for (const sd of seeds) { const d = AAR.done[pre + sd]; if (d && d.s) g[d.s.grade] = (g[d.s.grade] || 0) + 1; } return Object.entries(g).sort((a, b) => WReplay.GRADES.indexOf(b[0]) - WReplay.GRADES.indexOf(a[0])).map(([k, v]) => `${v} ${k.replace(/^./, c => c.toLowerCase())}`).join(', '); };
  box.innerHTML = `<div class="luck"><div><b>Your orders</b><div class="chips">${chips('luckY')}</div><p class="small">${tally('luckY')}</p></div><div><b>Napoleon’s orders</b><div class="chips">${chips('luckH')}</div><p class="small">${tally('luckH')}</p></div></div>`;
}
const shortGrade = g => ({ 'French catastrophe': 'French rout', 'Allied victory': 'Allied win', 'Marginal Allied victory': 'Allied edge', 'Draw': 'Draw', 'Marginal French victory': 'French edge', 'French victory': 'French win', 'Decisive French victory': 'French triumph' }[g] || g);
function startLuck() {
  if (AAR.luck) return; AAR.luck = true;
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(k => (G.opts.seed + k * 7919) >>> 0);
  for (const sd of seeds) { aarQueue('luckY' + sd, 'your orders, seed ' + sd, { seed: sd }); aarQueue('luckH' + sd, 'Napoleon’s orders, seed ' + sd, { seed: sd, historical: true }); }
  renderWhatIfs();
}
// fight it again from a moment you choose, with your orders up to then given again at the same minutes
function renderAgain() {
  const box = $('aar-again'); if (!box) return;
  const times = [...new Set([G.t0].concat(G.stops || [], liveEntries().map(e => e.t)))].filter(t => t < SIM.t && (G.toEndFrom == null || t <= G.toEndFrom)).sort((a, b) => a - b);
  box.innerHTML = `<p class="small">The same seed and your orders up to the moment you choose fight the same battle up to then; from there it is yours to change. Orders you gave at that very minute are not replayed, so you can give different ones.</p>
  <div class="row"><label for="aar-from">Fight on from</label><select id="aar-from">${times.map(t => `<option value="${t}">${SIM.fmtT(t)}${t === G.t0 ? ' (the start)' : (G.stops || []).includes(t) ? ' (a stop)' : ''}${liveEntries().some(e => e.t === t) ? ' · you gave orders' : ''}</option>`).join('')}</select><button type="button" id="aar-fight">Fight again</button></div>`;
}
function refight(T) {
  const opts = Object.assign({}, G.opts), old = G.orderLog.slice();
  const keep = old.filter(e => e.t < T && (e.k !== 'cancel' || old[e.ref].t < T)).sort((a, b) => a.t - b.t || a.i - b.i);
  aarReset(); newGame(opts); G.phase = 'refight'; $('setup').hidden = true; G.briefing = false; G.refoughtFrom = T; setRun();
  const made = {}, idMap = {}; let i = 0;
  setRunText(`Fighting the battle again up to ${hm(T)}…`); showMap();
  const chunk = () => {
    let n = 0;
    while (SIM.t < T && !SIM.over && n < 25) {
      while (i < keep.length && keep[i].t <= SIM.t) relogApply(keep[i++], made, idMap);
      const n0 = SIM.log.length; SIM.step(); noteKnowledge(); sampleLive(); n++;
      if (G.umpire) for (let k = n0; k < SIM.log.length; k++) noteEvent(SIM.log[k]);
    }
    if (SIM.t < T && !SIM.over) { setRunText(`Fighting the battle again up to ${hm(T)}… ${hm(SIM.t)}`); requestDraw(); setTimeout(chunk, 0); return; }
    // stop at T as the clock would, with the last twenty minutes' news in front of you
    const C = SIM.command; G.shown = Math.max(0, C.inbox.findIndex(m => m.t > T - 20)); if (G.shown < 0 || !C.inbox.some(m => m.t > T - 20)) G.shown = C.inbox.length;
    G.stopT = Math.max(G.t0, T - 20); G.phase = 'play'; ['dispBox', 'obBox'].forEach(id => $(id).open = true); halt();
    if (SIM.over) endGame();
  };
  setTimeout(chunk, 30);
}
// an old log entry given again: it goes into the new log under a new number, and tear-ups follow their orders
function relogApply(e, made, idMap) {
  const C = SIM.command;
  if (e.k === 'hist') { WScript.historical(SIM, { from: e.t }); G.orderLog.push({ i: G.orderLog.length, t: SIM.t, k: 'hist' }); return; }
  if (e.k === 'cancel') { const ni = idMap[e.ref]; if (ni == null) return; const os = (G.made[ni] || []).map(id => C.orders.find(o => o.id === id)); const o = os[e.step || 0]; if (o && C.cancel(o)) logCancel(o); return; }
  const list = e.k === 'seq' ? e.specs : [e.spec], copy = JSON.parse(JSON.stringify(list)), r = list.length > 1 ? C.orderSeq(JSON.parse(JSON.stringify(list))) : C.order(JSON.parse(JSON.stringify(list[0])));
  if (!r.ok) return; idMap[e.i] = G.orderLog.length; logOrder(copy, r);
}
function setRunText(t) { const el = $('runtxt'); if (el) el.innerHTML = esc(t); }

/* ----- wiring ----- */
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'aar-luckgo') startLuck();
  else if (b.id === 'aar-fight') { const T = +$('aar-from').value; if (G && T >= G.t0) { window.scrollTo({ top: 0, behavior: 'smooth' }); refight(T); } }
  else if (b.id === 'aar-open') $('aar').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
let aarResizeT = 0;
addEventListener('resize', () => { clearTimeout(aarResizeT); aarResizeT = setTimeout(() => { if (G && G.phase === 'over' && !$('aar').hidden) renderAarChart(); }, 200); });
