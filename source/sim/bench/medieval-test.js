/* Test bench cases for the pre-gunpowder mechanics (the medieval TEST era: uncalibrated numbers, see its pack). They check that the
   mechanics behave in the right direction and size: armour turns arrows, stakes stop horse, a melee between armoured men lasts.
   X falls back north, Y south; the field is flat; ground soaked (wet 1) where said, as at Agincourt. */
const hold = (E, ...ids) => { for (const id of ids) E.setTask(E.byId[id], { kind: 'hold' }); };
const lostPct = (E, id) => 100 * (E.byId[id].str0 - E.byId[id].str) / E.byId[id].str0;
const advance = (E, id, toward) => { const u = E.byId[id], t = E.byId[toward]; E.setTask(u, { kind: 'attack', targetUnit: toward }); E.routeTo(u, [t.x, t.y]); };
const archers = { id: 'A', side: 'X', nat: 'EN', arm: 'archer', str: 1000, at: [1500, 1000], facing: 180, form: 'line' };
module.exports = [
  { id: 'arrows-on-armour', era: 'medieval-test', minutes: 10, wet: 1, date: '1415-10-25',
    what: '1,000 archers shoot at 1,000 dismounted men-at-arms walking at them across soaked ground from 250 m.',
    units: [archers, { id: 'M', side: 'Y', nat: 'FRM', arm: 'mna', str: 1000, at: [1500, 1260], facing: 0, form: 'deep' }],
    orders: E => { hold(E, 'A'); advance(E, 'M', 'A'); }, measure: E => lostPct(E, 'M'), unit: '% of the men-at-arms down',
    basis: 'history', expect: [2, 15], source: 'est.: plate turned most arrows at all but close range; at Agincourt the arrows disordered and slowed the French men-at-arms more than they killed them' },
  { id: 'arrows-on-levy', era: 'medieval-test', minutes: 10, wet: 1, date: '1415-10-25',
    what: 'The same arrows at 1,000 unarmoured levies walking in.',
    units: [archers, { id: 'M', side: 'Y', nat: 'FRM', arm: 'levy', str: 1000, at: [1500, 1260], facing: 0, form: 'deep' }],
    orders: E => { hold(E, 'A'); advance(E, 'M', 'A'); }, measure: E => lostPct(E, 'M'), unit: '% of the levies down',
    basis: 'history', expect: [10, 60], source: 'est.: unarmoured men in the open were cut to pieces by massed archery' },
  { id: 'horse-on-archers', era: 'medieval-test', minutes: 8, aggregate: 'mean',
    what: '500 mounted knights charge the archers in the open from 800 m.',
    units: [archers, { id: 'K', side: 'Y', nat: 'FRM', arm: 'knight', str: 500, at: [1500, 1800], facing: 0, form: 'deep', traits: { kind: 'heavy' } }],
    orders: E => { hold(E, 'A'); E.charge(E.byId.K, E.byId.A); }, measure: E => E.byId.A.status === 'broken' ? 100 : 0, unit: '% of runs the archers break',
    basis: 'history', expect: [40, 100], source: 'est.: archers in the open caught by heavy horse were ridden down (Patay, 1429)' },
  { id: 'stakes-stop-horse', era: 'medieval-test', minutes: 8, aggregate: 'mean',
    what: 'The same charge, with the archers behind a line of stakes 10 m in front of them.',
    units: [archers, { id: 'K', side: 'Y', nat: 'FRM', arm: 'knight', str: 500, at: [1500, 1800], facing: 0, form: 'deep', traits: { kind: 'heavy' } }],
    obstacles: [{ kind: 'stakes', at: [[1000, 1015], [2000, 1015]] }],
    orders: E => { hold(E, 'A'); E.charge(E.byId.K, E.byId.A); }, measure: E => E.byId.A.status === 'broken' ? 100 : 0, unit: '% of runs the archers break',
    basis: 'history', expect: [0, 15], source: 'Agincourt (1415): the French horse could not reach the archers behind their stakes' },
  { id: 'melee-lasts', era: 'medieval-test', minutes: 40,
    what: '1,000 men-at-arms attack 1,000 men-at-arms standing on open ground: how long until one side breaks or draws off.',
    units: [{ id: 'D', side: 'X', nat: 'EN', arm: 'mna', str: 1000, at: [1500, 1000], facing: 180, form: 'line' },
      { id: 'M', side: 'Y', nat: 'FRM', arm: 'mna', str: 1000, at: [1500, 1150], facing: 0, form: 'deep' }],
    orders: E => { hold(E, 'D'); advance(E, 'M', 'D'); },
    measure: E => { const l = E.log.find(x => /locked hand to hand/.test(x.text)), e = E.log.find(x => l && x.t >= l.t && /(breaks and runs|draws off)/.test(x.text)); return l ? ((e ? e.t : E.t) - l.t) : -1; },
    unit: 'minutes locked hand to hand', basis: 'history', expect: [6, 40], source: 'est.: a melee between armoured bodies went on for many minutes, front ranks relieved from behind, until one side gave way' },
];
