const { battle } = require('./run5b.js');
process.on('message', ({ seeds, K, opts }) => {
  const out = [];
  for (const s of seeds) {
    const E = battle(s, Object.assign({ K }, opts || {}));
    const m = E.metrics, r = E.result || {}, I = E.command.intel, h = t => E.history_.find(x => x.t >= t);
    out.push({ seed: s, grade: r.grade, why: r.why, end: E.t, lhs: m.lhsFall, houg: m.hougFall, bulow: m.bulowAttack, zieten: m.zietenPapelotte, frBreak: m.frBreak, guard: m.guardAttack, guardRep: m.guardRepulsed, neyCav: m.neyCav, plL: m.plancenoitLost,
      fr: r.cas ? r.cas.FR.kw : 0, frCap: r.cas ? r.cas.FR.cap : 0, al: r.cas ? r.cas.AL.kw : 0, pr: r.cas ? r.cas.PR.kw : 0, alBreak: m.alBreak,
      fr14: h(840) ? h(840).kw.FR : null, al14: h(840) ? h(840).kw.AL : null, fr17: h(1020) ? h(1020).kw.FR : null, al17: h(1020) ? h(1020).kw.AL : null, fr20: h(1200) ? h(1200).kw.FR : null, al20: h(1200) ? h(1200).kw.AL : null, pr20: h(1200) ? h(1200).kw.PR : null,
      alBroke: E.log.filter(l => l.cat === 'break' && l.side === 'AL' && E.byId[l.unit] && !E.byId[l.unit].detachment && E.byId[l.unit].type !== 'gar' && !/companies|battalion for/i.test(E.byId[l.unit].name)).length,
      eastSeen: I.eastSeen, bulowNamed: I.bulowNamed, prisoner: I.prisoner, lhsKnown: I.lhsKnown, plKnown: I.plancenoitKnown, hougKnown: I.hougoumontKnown,
      reports: E.command.inbox.filter(x => x.kind === 'report').length, summaries: E.command.inbox.filter(x => x.kind === 'summary').length, decisions: E.command.inbox.filter(x => x.decision).length,
      ridersLost: E.command.riders.filter(x => x.status === 'lost' || x.status === 'captured').length, ordersLost: E.command.orders.filter(o => o.status === 'lost').length, misreads: E.command.orders.filter(o => o.misread).length,
      mMin: ['FR', 'AL', 'PR'].map(k => Math.round(Math.min(...E.history_.map(x => x.morale[k])))), m18: h(1080) ? ['FR', 'AL', 'PR'].map(k => Math.round(h(1080).morale[k])) : null, mEnd: ['FR', 'AL', 'PR'].map(k => Math.round(E.morale[k])),
      wellEngagedAtBlucher: E.command.B.blucher.news.wellEngaged ?? null, release: E.ai.S.bulowRelease ?? null, advance: E.ai.S.advanced ? true : false });
  }
  process.send(out, () => process.exit(0)); // (8) exit only once the message is out: a large batch was lost when the process exited first
});
