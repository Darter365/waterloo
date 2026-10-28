/* ================= 8d. the staff speaking up ================= */
// At each stop one or two of the officers round you may say something. They speak only from what headquarters knows (Napoleon's
// record, the reports in, the orders sent), never from the umpire's truth, so they can be wrong, as the real staff were. No dice:
// the same battle gives the same remarks, and nothing they say changes the battle.
// (phase 5) the officers and their remarks are the battle's (its game block: staff.remarks, in the order they are weighed); a remark's
// when says what headquarters must know for it to be said. Five remarks every battle has are written here ('generic:quiet' and the rest).
const SF = GB.staff || { officers: {}, remarks: [] }, STAFF = SF.officers, SPEAK = SF.chief || Object.keys(STAFF)[0], GUARDSAYS = SF.guard || SPEAK;
const tmin = s => typeof s === 'number' ? s : +s.split(':')[0] * 60 + +s.split(':')[1];
function staffRemarks() {
  const C = SIM.command, B = C.B[CHIEF], I = C.intel || {}, t = SIM.t, said = G.said || (G.said = {}), out = [];
  const mine = C.orders.filter(o => o.from === CHIEF && o.status !== 'cancelled' && !o.byScript);
  const sentTo = (to, since) => mine.some(o => o.to === to && o.issuedAt >= (since ?? -1));
  const place = id => B.places[id] && B.places[id].holder;
  const say = (id, who, text, again) => { if (said[id] != null && (again == null || t - said[id] < again)) return; out.push({ id, who, text, t }); };
  const lastReport = cid => { let r = null; for (const m of C.inbox) if (m.from === cid && m.kind === 'report') r = m; return r; };
  const ownBroken = [...B.own.values()].filter(o => !o.gone && o.status === 'broken').length;
  const sc = G.opts.scenario;
  const met = w => {
    if (w.briefing && !G.briefing) return false;
    if (w.start && sc !== w.start) return false;
    if (w.before && !(t < tmin(w.before))) return false;
    if (w.after && !(t >= tmin(w.after))) return false;
    if (w.post && C.hq.post !== w.post) return false;
    if (w.intel && I[w.intel] == null) return false;
    if (w.notIntel && I[w.notIntel] != null) return false;
    const since = w.since ? I[w.since] : null;
    if (w.notSentTo && sentTo(w.notSentTo, since)) return false;
    if (w.noOrderTo && mine.some(o => o.to === w.noOrderTo && o.issuedAt >= (since ?? -1))) return false;
    if (w.seen) { const m = C.inbox.find(x => x.kind === 'sight' && (x.text || '').includes(w.seen)); if (!m || t - m.t >= (w.within ?? Infinity)) return false; }
    if (w.place) { const h = place(w.place); if (w.holder && h !== w.holder) return false; if (w.holderNot && (!h || h === w.holderNot)) return false; }
    if (w.attackWith && !mine.some(o => o.to === w.attackWith.to && o.spec.action === 'attack' && (o.spec.with || []).some(id => w.attackWith.ids.includes(id)))) return false;
    if (w.noOrders && mine.some(o => RKIND(o.to) !== 'hq' && RKIND(o.to) !== 'offmap')) return false;
    return true;
  };
  const generic = {
    // silence: an order under way and nothing from that corps for an hour and a quarter
    quiet() { for (const cid of CORPS) {
      const o = mine.filter(x => x.to === cid && x.sentAt != null && x.sentAt <= t).pop(); if (!o) continue;
      const r = lastReport(cid), since = r ? r.writtenAt ?? r.t : o.sentAt;
      if (t - since >= 75) say('quiet' + cid, SPEAK, `We have had nothing from ${SIM.leaders[cid].name} since ${hm(since)}, Sire. Shall I send an officer to find him?`, 90);
    } },
    // an order not acknowledged within the hour
    ack() { for (const o of mine) if (RKIND(o.to) !== 'hq' && RKIND(o.to) !== 'offmap' && o.sentAt != null && o.ackedAt == null && o.status !== 'lost' && t - o.sentAt >= 60 && !o.carrier) say('ack' + (o.spec.general ? 'army' + o.issuedAt : o.id), SPEAK, o.spec.general ? `Not every corps has acknowledged your order of ${hm(o.issuedAt)} to retreat, Sire.` : `Your order to ${SHORT[o.to] || o.to} of ${hm(o.issuedAt)} has not been acknowledged, Sire. The rider may be down.`); },
    // (8) losses, as the corps returns give them: army morale now falls with the men lost, and the staff say so when the returns are heavy
    losses() { let n0 = 0, down = 0; for (const r of B.own.values()) { const u = SIM.byId[r.uid]; if (!u || u.side !== SIDE || u.type === 'art' || u.mergedInto) continue; n0 += u.str0 || 0; if (r.srcState && r.srcState !== 'own eyes') down += Math.max(0, (u.str0 || 0) - r.str); }
      const f = n0 ? down / n0 : 0, k = Math.round(down / 1000);
      if (f >= 0.4) say('loss40', GUARDSAYS, `By the returns, Sire, two men in five of the foot and horse are down. The army will not stand much more of this.`);
      else if (f >= 0.25) say('loss25', SPEAK, `The corps returns put our losses at some ${k} thousand men, Sire, a quarter of the foot and horse. The men feel it.`); },
    // late in the day
    dusk() { if (t >= tmin(SF.duskAt || '19:45')) say('dusk', SPEAK, 'Darkness by nine, Sire. Whatever is to be done must be done in the next hour.'); },
    retreat() { if (t >= tmin(SF.retreatAt || '18:00') && ownBroken >= 6 && !mine.some(o => o.spec.action === 'retreat')) say('retreat', SPEAK, `Sire, ${ownBroken} of our brigades are reported broken. It is time to think of ${SF.road || 'the road back'} while the Guard still stands.`); },
  };
  for (const r of SF.remarks) { if (typeof r === 'string') { const g = generic[r.replace(/^generic:/, '')]; if (g) g(); continue; } if (met(r.when || {})) say(r.id, r.who, r.text, r.again); }
  const pick = out.slice(0, 2); for (const r of pick) said[r.id] = t;
  (G.staffLog || (G.staffLog = [])).push(...pick);
  return pick;
}
function staffHTML(list) {
  return list.map(r => `<article class="disp staff"><header><b>${esc(STAFF[r.who] || r.who)}</b><time>at your side · ${hm(r.t)}</time></header><p>“${esc(r.text)}”</p></article>`).join('');
}
