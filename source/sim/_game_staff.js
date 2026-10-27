/* ================= 8d. the staff speaking up ================= */
// At each stop one or two of the officers round you may say something. They speak only from what headquarters knows (Napoleon's
// record, the reports in, the orders sent), never from the umpire's truth, so they can be wrong, as the real staff were. No dice:
// the same battle gives the same remarks, and nothing they say changes the battle.
const STAFF = {
  soult: 'Soult, major-général', drouot: 'Drouot, commanding the Guard', flahaut: 'Flahaut, aide-de-camp', labedoyere: 'La Bédoyère, aide-de-camp', gourgaud: 'Gourgaud, aide-de-camp',
};
function staffRemarks() {
  const C = SIM.command, B = C.B.napoleon, I = C.intel || {}, t = SIM.t, said = G.said || (G.said = {}), out = [];
  const mine = C.orders.filter(o => o.from === 'napoleon' && o.status !== 'cancelled' && !o.byScript);
  const sentTo = (to, since) => mine.some(o => o.to === to && o.issuedAt >= (since ?? -1));
  const place = id => B.places[id] && B.places[id].holder;
  const say = (id, who, text, again) => { if (said[id] != null && (again == null || t - said[id] < again)) return; out.push({ id, who, text, t }); };
  const lastReport = cid => { let r = null; for (const m of C.inbox) if (m.from === cid && m.kind === 'report') r = m; return r; };
  const ownBroken = [...B.own.values()].filter(o => !o.gone && o.status === 'broken').length;
  const sc = G.opts.scenario;
  // the morning: Soult wanted part of Grouchy's force called in (the exchange is in the standard accounts; the words here are paraphrase)
  if (G.briefing && !sentTo('grouchy')) say('grouchy0', 'soult', 'Sire, I would send at once for part of Marshal Grouchy’s force. The English will not be beaten in an hour, and the Prussians beaten at Ligny are not destroyed.');
  if (sc === '0500' && t < 9 * 60) say('ground', 'drouot', 'The ground will not bear the guns yet, Sire. Give it two or three hours and the roundshot will bound again instead of burying itself.');
  if (sc === '0500' && t >= 11 * 60 && C.hq.post === 'caillou') say('hqfar', 'labedoyere', 'We see nothing of the field from Le Caillou, Sire. From Rossomme the whole of it would be in front of you.');
  // the east: before the troops there are named, some of the staff hope they are Grouchy's
  if (I.eastSeen != null && I.bulowNamed == null) say('east', 'gourgaud', 'Troops in the east, Sire, beyond Frischermont toward Saint-Lambert. Some of us think it is Grouchy coming up.');
  if (I.eastSeen != null && !mine.some(o => o.to === 'lobau' && o.issuedAt >= I.eastSeen)) say('eastLobau', 'soult', 'If those are Prussians, Sire, Lobau should be facing them before they reach Plancenoit.', 60);
  if (I.bulowNamed != null && !sentTo('grouchy', I.bulowNamed)) say('bulow', 'soult', 'Bülow, Sire: a whole corps, thirty thousand men. Grouchy must be told to come to us now.');
  // silence: an order under way and nothing from that corps for an hour and a quarter
  for (const cid of CORPS) {
    const o = mine.filter(x => x.to === cid && x.sentAt != null && x.sentAt <= t).pop(); if (!o) continue;
    const r = lastReport(cid), since = r ? r.writtenAt ?? r.t : o.sentAt;
    if (t - since >= 75) say('quiet' + cid, 'soult', `We have had nothing from ${SIM.leaders[cid].name} since ${hm(since)}, Sire. Shall I send an officer to find him?`, 90);
  }
  // an order not acknowledged within the hour
  for (const o of mine) if (o.to !== 'hq' && o.to !== 'grouchy' && o.sentAt != null && o.ackedAt == null && o.status !== 'lost' && t - o.sentAt >= 60 && !o.carrier) say('ack' + (o.spec.general ? 'army' + o.issuedAt : o.id), 'soult', o.spec.general ? `Not every corps has acknowledged your order of ${hm(o.issuedAt)} to retreat, Sire.` : `Your order to ${SHORT[o.to] || o.to} of ${hm(o.issuedAt)} has not been acknowledged, Sire. The rider may be down.`);
  // the cavalry going up without infantry (Napoleon's own words on the day were near this)
  const neySeen = C.inbox.find(m => m.kind === 'sight' && /Marshal Ney is leading/.test(m.text || ''));
  if (neySeen && t - neySeen.t < 60) say('neyCav', 'flahaut', 'Ney has taken the cavalry up an hour too soon, Sire. Without infantry behind them they cannot hold the plateau.');
  // places changing hands
  if (place('lhs') === 'FR') say('lhs', 'soult', 'La Haye Sainte is ours, Sire. Ney will be asking for infantry to push on from it.');
  if (place('plancenoit') && place('plancenoit') !== 'FR' && t > 13 * 60) say('plancenoit', 'drouot', 'The Prussians are in Plancenoit, Sire, behind our right. The Young Guard could take it back.');
  if (place('hougoumont') === 'FR') say('houg', 'gourgaud', 'Hougoumont has fallen, Sire. Reille’s left is free.');
  // the Guard going in
  const guardIn = mine.some(o => o.to === 'drouot' && o.spec.action === 'attack' && (o.spec.with || []).some(id => /^g[1-4]/.test(id)));
  if (guardIn) say('guard', 'drouot', 'With the Middle Guard gone forward, Sire, the Old Guard battalions are all that stand between the army and the road.');
  // (8) losses, as the corps returns give them: army morale now falls with the men lost, and the staff say so when the returns are heavy
  { let n0 = 0, down = 0; for (const r of B.own.values()) { const u = SIM.byId[r.uid]; if (!u || u.side !== 'FR' || u.type === 'art' || u.mergedInto) continue; n0 += u.str0 || 0; if (r.srcState && r.srcState !== 'own eyes') down += Math.max(0, (u.str0 || 0) - r.str); }
    const f = n0 ? down / n0 : 0, k = Math.round(down / 1000);
    if (f >= 0.4) say('loss40', 'drouot', `By the returns, Sire, two men in five of the foot and horse are down. The army will not stand much more of this.`);
    else if (f >= 0.25) say('loss25', 'soult', `The corps returns put our losses at some ${k} thousand men, Sire, a quarter of the foot and horse. The men feel it.`); }
  // late in the day
  if (t >= 19 * 60 + 45) say('dusk', 'soult', 'Darkness by nine, Sire. Whatever is to be done must be done in the next hour.');
  if (t >= 18 * 60 && ownBroken >= 6 && !mine.some(o => o.spec.action === 'retreat')) say('retreat', 'soult', `Sire, ${ownBroken} of our brigades are reported broken. It is time to think of the road to Charleroi while the Guard still stands.`);
  // a quiet morning
  if (t >= 12 * 60 + 30 && !mine.some(o => o.to !== 'hq' && o.to !== 'grouchy')) say('idle', 'soult', 'The men have stood in the mud since dawn, Sire. Wellington will not come off his ridge to attack us.');
  const pick = out.slice(0, 2); for (const r of pick) said[r.id] = t;
  (G.staffLog || (G.staffLog = [])).push(...pick);
  return pick;
}
function staffHTML(list) {
  return list.map(r => `<article class="disp staff"><header><b>${esc(STAFF[r.who] || r.who)}</b><time>at your side · ${hm(r.t)}</time></header><p>“${esc(r.text)}”</p></article>`).join('');
}
