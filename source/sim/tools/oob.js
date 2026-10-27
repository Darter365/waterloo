/* Orders of battle as spreadsheets (engine roadmap 4d). An army list kept as a CSV file, one row per body of troops, becomes the
   order-of-battle part of a battle pack (RAW, CORPS, DIVISION, QUALITY, CALIBRE, TRAITS, FORCES), and any battle's can be written out
   the same way to edit in a spreadsheet.
     node tools/oob.js export <battle> [out.csv]          a battle's order of battle as CSV
     node tools/oob.js import <in.csv> <battle> [out.js]  a CSV as an order-of-battle pack (packs/oob/<battle>.js by default)
     node tools/oob.js check <in.csv> <battle>            is the pack the CSV's? (the self-tests run this on every committed CSV)
   Columns (a header row names them; order free; blank = not given):
     id, side, name, parent, nation, arm, strength (men, or guns), lat, lon, facing (degrees), formation, uncertainty (m), note,
     corps, division, quality, calibre, traits ("guard=1; kind=heavy; prestige=15"), frontage, radius, battalions,
     arrives (a body that comes on later: minutes or HH:MM), force (the group it comes with)
   A body with "arrives" is off the map at the start and comes with its force; its corps is the road (route) it marches by.
   Force settings are lines of their own: #force, <group>, marches=1, fatigue0=30, ammo0.pirch=40
   The CSV is the source; the .js it makes is what the game and the engine load (a page cannot read a CSV from disk). */
'use strict';
const fs = require('fs'), path = require('path');

/* ----- CSV (RFC 4180: quotes around fields with commas, quotes or line breaks; a quote inside doubled) ----- */
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}
const cell = v => { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = rows => rows.map(r => r.map(cell).join(',')).join('\n') + '\n';

const COLS = ['id', 'side', 'name', 'parent', 'nation', 'arm', 'strength', 'lat', 'lon', 'facing', 'formation', 'uncertainty', 'note', 'corps', 'division', 'quality', 'calibre', 'traits', 'frontage', 'radius', 'battalions', 'arrives', 'force'];
const EXTRA = { frontage: 'F', radius: 'R', battalions: 'nBn' };
const num = s => s === '' || s == null ? undefined : +s;
const val = s => s !== '' && !isNaN(+s) ? +s : s;
const traitsOf = s => { const o = {}; for (const kv of (s || '').split(';').map(x => x.trim()).filter(Boolean)) { const [k, v] = kv.split('='); o[k.trim()] = v == null ? true : v.trim() === 'true' ? true : v.trim() === 'false' ? false : val(v.trim()); } return o; };
const traitsStr = o => Object.entries(o || {}).map(([k, v]) => v === true ? `${k}=true` : `${k}=${v}`).join('; ');
const hhmm = s => /^\d{1,2}:\d\d$/.test(s) ? +s.split(':')[0] * 60 + +s.split(':')[1] : +s;

/* ----- a battle's order of battle as rows ----- */
function exportRows(W) {
  const rows = [COLS];
  for (const r of W.RAW) {
    const [id, side, name, parent, nat, arm, str, la, lo, facing, form, unc, note, extra] = r, x = extra || {};
    const r7 = v => typeof v === 'number' ? Math.round(v * 1e7) / 1e7 : v; // 1 cm: a position computed from map metres reads cleanly
    rows.push([id, side, name, parent, nat, arm, str, r7(la), r7(lo), facing, form, unc, note, W.CORPS[id], (W.DIVISION || {})[id], (W.QUALITY || {})[id], (W.CALIBRE || {})[id], traitsStr((W.TRAITS || {})[id]), x.F, x.R, x.nBn, '', '']);
  }
  for (const F of W.FORCES || []) {
    const set = [`#force`, F.group, `marches=${F.marches ? 1 : 0}`]; if (F.fatigue0 != null) set.push(`fatigue0=${F.fatigue0}`); for (const [k, v] of Object.entries(F.ammo0 || {})) set.push(`ammo0.${k}=${v}`);
    rows.push(set);
    for (const [id, side, name, parent, nat, arm, str, route, q, arrive] of F.units)
      rows.push([id, side, name, parent, nat, arm, str, '', '', '', '', '', '', route, (W.DIVISION || {})[id], q, (W.CALIBRE || {})[id], traitsStr((W.TRAITS || {})[id]), '', '', '', arrive, F.group]);
  }
  return rows;
}
/* ----- rows to an order of battle (errors name the line) ----- */
function importRows(rows) {
  const lead = rows.findIndex(r => !(r[0] || '').startsWith('#')); rows = rows.slice(Math.max(0, lead)); // comment lines above the header
  const errs = [], head = rows[0].map(h => h.trim().toLowerCase()), at = k => head.indexOf(k);
  for (const k of ['id', 'side', 'name', 'nation', 'arm', 'strength']) if (at(k) < 0) errs.push(`the header has no "${k}" column`);
  if (errs.length) return { errs };
  const O = { RAW: [], CORPS: {}, DIVISION: {}, QUALITY: {}, CALIBRE: {}, TRAITS: {}, FORCES: [] }, forces = {}, seen = new Set();
  const force = g => forces[g] || (forces[g] = { group: g, marches: false, units: [] });
  rows.slice(1).forEach((r, i) => {
    const line = i + 2, g = k => at(k) >= 0 ? (r[at(k)] ?? '').trim() : '';
    if (r[0] && r[0].startsWith('#force')) { const F = force(r[1].trim()); for (const kv of r.slice(2)) { const [k, v] = kv.split('=').map(s => s.trim()); if (k === 'marches') F.marches = v === '1' || v === 'true'; else if (k === 'fatigue0') F.fatigue0 = +v; else if (k.startsWith('ammo0.')) (F.ammo0 = F.ammo0 || {})[k.slice(6)] = +v; else if (k) errs.push(`line ${line}: unknown force setting "${k}"`); } return; }
    if (r[0] && r[0].startsWith('#')) return;
    const id = g('id'); if (!id) { errs.push(`line ${line}: no id`); return; }
    if (seen.has(id)) errs.push(`line ${line}: id "${id}" is used twice`); seen.add(id);
    const str = num(g('strength')); if (!(str > 0) && !(g('arm') === 'hq' && str === 0)) errs.push(`line ${line} (${id}): strength "${g('strength')}" is not a number above 0 (0 only for a headquarters marker, arm hq)`);
    if (g('corps')) O.CORPS[id] = g('corps'); if (g('division')) O.DIVISION[id] = g('division');
    if (g('calibre')) O.CALIBRE[id] = +g('calibre'); if (g('traits')) O.TRAITS[id] = traitsOf(g('traits'));
    if (g('arrives') !== '') {
      if (!g('force')) errs.push(`line ${line} (${id}): a body that arrives later needs a force`);
      if (!g('corps')) errs.push(`line ${line} (${id}): a body that arrives later needs a corps (the road it marches by)`);
      delete O.CORPS[id];
      force(g('force')).units.push([id, g('side'), g('name'), g('parent'), g('nation'), g('arm'), str, g('corps'), num(g('quality')) ?? 1, hhmm(g('arrives'))]);
      return;
    }
    if (g('quality')) O.QUALITY[id] = +g('quality');
    const la = num(g('lat')), lo = num(g('lon')); if (!(isFinite(la) && isFinite(lo))) errs.push(`line ${line} (${id}): lat and lon are needed for a body on the field at the start`);
    const extra = {}; for (const [c, k] of Object.entries(EXTRA)) if (g(c) !== '') extra[k] = +g(c);
    const row = [id, g('side'), g('name'), g('parent'), g('nation'), g('arm'), str, la, lo, num(g('facing')) ?? 0, g('formation') || 'columns', num(g('uncertainty')) ?? 0, g('note')];
    if (Object.keys(extra).length) row.push(extra);
    O.RAW.push(row);
  });
  O.FORCES = Object.values(forces).map(F => Object.assign({ group: F.group, marches: F.marches, units: F.units }, F.fatigue0 != null ? { fatigue0: F.fatigue0 } : {}, F.ammo0 ? { ammo0: F.ammo0 } : {}));
  return { O, errs };
}
function packJS(id, O, src) {
  return `/* Order of battle for "${id}", made by tools/oob.js from ${src} (edit the CSV, then: node tools/oob.js import ${src} ${id}). */\n` +
    `(function (root) {\n'use strict';\nconst P = root.WPacks || (typeof require === 'function' ? require('../registry.js') : null);\n` +
    `P.register('oob', ${JSON.stringify(id)}, ${JSON.stringify(O)});\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n`;
}
module.exports = { parseCSV, toCSV, exportRows, importRows, packJS };

if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2), P = require('../packs/all.js');
  if (cmd === 'export') { const t = toCSV(exportRows(P.battle(a).W)); if (b) { fs.writeFileSync(b, t); console.log(`wrote ${b}`); } else process.stdout.write(t); }
  else if (cmd === 'import' || cmd === 'check') {
    const { O, errs } = importRows(parseCSV(fs.readFileSync(a, 'utf8')));
    if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
    const out = c || path.join(__dirname, '..', 'packs', 'oob', b + '.js'), rel = path.relative(path.join(__dirname, '..'), a), js = packJS(b, O, rel);
    if (cmd === 'check') { const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === js; console.log(same ? `${out} is ${a}'s` : `${out} is not ${a}'s: run node tools/oob.js import ${rel} ${b}`); process.exit(same ? 0 : 1); }
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, js);
    console.log(`wrote ${out}: ${O.RAW.length} bodies on the field, ${O.FORCES.reduce((s, F) => s + F.units.length, 0)} to come in ${O.FORCES.length} forces`);
  } else console.log('usage: node tools/oob.js export <battle> [out.csv] | import <in.csv> <battle> [out.js] | check <in.csv> <battle>');
}
