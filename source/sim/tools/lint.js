/* The battle-name lint (engine roadmap, phase 1). The engine must not know which battle it is running: every unit, place, route,
   leader, corps, side or nation that a battle pack defines belongs in the pack, not in engine code. This lint reads the engine's
   source, finds every string, template and regular expression that names something from a battle pack (and every W.KEY that is not in
   the shared map schema), and compares the count with the allow-list. The allow-list records today's debt; it may only shrink.
     node tools/lint.js            fails (exit 1) on any name not allowed, or used more often than allowed
     node tools/lint.js --update   rewrites the allow-list to today's counts (only when a count has gone down, or with --force)
     node tools/lint.js --list     prints every allowed name by file and kind
   Comments are not read: a comment may name Waterloo freely. */
'use strict';
(() => {
const fs = require('fs'), path = require('path');
const SIM = path.join(__dirname, '..'), ALLOW = path.join(__dirname, 'lint-allow.json');
const P = require(path.join(SIM, 'packs', 'all.js'));
const FILES = ['engine.js', 'ai.js', 'command.js', 'orders.js', 'replay.js']; // the sim; script.js is Napoleon's script for Waterloo (battle content, moves to the pack in phase 3)
const SCHEMA = ['LAT0', 'LON0', 'MLAT', 'MLON', 'NX', 'NY', 'CELL', 'WM', 'HM', 'll2m', 'm2ll', 'H', 'RAW', 'STRONGPOINTS', 'OBJECTIVES', 'ROUTES', 'LEADERS',
  'LM', 'ROADS', 'SUNKEN', 'HEDGES', 'WOODS', 'BUILDINGS', 'ENCLOSURES', 'STREAMS', 'VILLAGES', 'HOUSES', 'LABELS', 'EDGE_LABELS', 'NAT', 'OFFMAP',
  'QUALITY', 'CALIBRE', 'CORPS', 'DIVISION', 'CHOKES', 'rng', 'hashStr'];

/* ----- the names each battle defines, by kind ----- */
function battleNames() {
  const names = new Map(); // name -> kind
  const add = (kind, n) => { if (typeof n === 'string' && n.length >= 2 && !names.has(n)) names.set(n, kind); };
  for (const id of Object.keys(P.battles)) {
    const R = P.battle(id), W = R.W, B = R.battle;
    for (const s of B.sides) add('side', s.id);
    for (const n of B.nations || []) add('nation', n);
    for (const l of B.leaders || []) { add('leader', l.id); const p = P.leader(l.id); if (p) add('leader', p.name); }
    for (const list of ['RAW', 'PRUSSIANS', 'HAL_FORCE', 'GROUCHY_FORCE', 'HORSE_BATTERIES']) for (const r of W[list] || []) add('unit', r[0]);
    for (const list of ['PRUSSIANS', 'HAL_FORCE', 'GROUCHY_FORCE']) for (const r of W[list] || []) add('corps', r[7]);
    for (const v of Object.values(W.CORPS || {})) add('corps', v);
    for (const v of Object.values(W.DIVISION || {})) add('division', v);
    for (const sp of W.STRONGPOINTS || []) { add('place', sp.id); add('place', sp.name); } // (section names are plain words: wood, farm, buildings)
    for (const [k, o] of Object.entries(W.OBJECTIVES || {})) { add('place', k); add('place', o.name); }
    for (const k of Object.keys(W.ROUTES || {})) add('route', k);
    for (const c of W.CHOKES || []) { add('place', c.id); add('place', c.name); }
    for (const v of W.VILLAGES || []) add('place', v.n);
    for (const v of W.LM || []) add('place', v.n);
    for (const v of W.BUILDINGS || []) add('place', v.n);
  }
  return names;
}

/* ----- a small JavaScript tokenizer: strings, templates and regular expressions, with comments skipped ----- */
function literals(src) {
  const out = []; let i = 0, prev = ''; // prev: the last significant token, to tell a regex from a division
  const regexOK = () => prev === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|in|of|delete|void|throw|new|else|do|=>|&&|\|\||\?\?)$/.test(prev);
  const starts = [0]; for (let k = 0; k < src.length; k++) if (src[k] === '\n') starts.push(k + 1);
  const line = (k) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= k) lo = m; else hi = m - 1; } return lo + 1; };
  const at = (k) => (k < src.length ? src[k] : ''); // never undefined: /[\w]/.test(undefined) is true
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) break; i = e + 2; continue; }
    if (c === '\'' || c === '"') { let j = i + 1, s = ''; while (j < src.length && src[j] !== c) { if (src[j] === '\\') { s += src[j + 1]; j += 2; } else s += src[j++]; } out.push({ kind: 'str', text: s, line: line(i) }); i = j + 1; prev = 'lit'; continue; }
    if (c === '`') { // a template: its text parts are read; its ${...} parts are code and are tokenized in turn
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { let depth = 1, k = j + 2; while (k < src.length && depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; else if (src[k] === '`') { k++; while (k < src.length && src[k] !== '`') k++; } k++; } out.push(...literals(src.slice(j + 2, k - 1)).map(t => ({ ...t, line: t.line + line(j) - 1 }))); s += ' '; j = k; continue; }
        s += src[j++];
      }
      out.push({ kind: 'str', text: s, line: line(i) }); i = j + 1; prev = 'lit'; continue;
    }
    if (c === '/' && regexOK()) { let j = i + 1, cls = false; while (j < src.length && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '\n') break; j++; } out.push({ kind: 're', text: src.slice(i + 1, j), line: line(i) }); i = j + 1; while (/[a-z]/.test(at(i))) i++; prev = 'lit'; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(at(j))) j++; const w = src.slice(i, j); if (src[i - 1] === '.' && src[i - 2] === 'W' && !/[\w$]/.test(src[i - 3] || '')) out.push({ kind: 'key', text: w, line: line(i) }); else out.push({ kind: 'id', text: w, line: line(i) }); prev = w; i = j; continue; }
    if (/[0-9]/.test(c)) { while (/[\w.]/.test(at(i))) i++; prev = 'num'; continue; }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (['===', '!==', '...', '**=', '>>>'].includes(three)) { prev = three; i += 3; continue; }
    if (['=>', '&&', '||', '??', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '++', '--', '?.'].includes(two)) { prev = two; i += 2; continue; }
    prev = c; i++;
  }
  return out;
}

/* ----- era words and arm types: the sim must not know the period or branch on what a unit is (roadmap section 3, rules 2 and 3) ----- */
// a period piece named in code or text (in a name like roundshot() or SMOKE_MUSKET, or a string like 'square')
const ERA_WORDS = ['musket', 'square', 'canister', 'roundshot', 'howitzer', 'bayonet', 'cuirass', 'lancer', 'sabre', 'limber', 'rifle', 'cartridge', 'grapeshot', 'cannon', 'gunner'];
// a branch on the arm: the literals 'inf', 'cav', 'art', 'gar' (phase 2 replaces them with capabilities)
const ARMS = ['inf', 'cav', 'art', 'gar'];
const eraRx = new RegExp(ERA_WORDS.join('|'), 'gi');

/* ----- count the battle names in each file ----- */
function scan() {
  const names = battleNames(), found = {};
  // longest names first, so "La Haye Sainte" is counted once and not also as "La Haye"
  const list = [...names.keys()].sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp('(?<![\\w$])(' + list.map(esc).join('|') + ')(?![\\w$])', 'g');
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(SIM, f), 'utf8'), counts = {}, where = {};
    for (const t of literals(src)) {
      const bump = k => { counts[k] = (counts[k] || 0) + 1; (where[k] = where[k] || []).push(t.line); };
      if (t.kind === 'key') { if (!SCHEMA.includes(t.text)) bump('W.' + t.text); continue; }
      for (const m of t.text.matchAll(eraRx)) bump('era:' + m[0].toLowerCase());
      if (t.kind === 'id') continue;
      if (t.kind === 'str' && ARMS.includes(t.text)) bump('arm:' + t.text);
      // a regular expression's alternatives name units ("g\d|yg|guyot"): read it as words
      const text = t.kind === 're' ? t.text.replace(/\\[dwsb]/g, ' ').replace(/[\^$()|?*+[\]{}]/g, ' ') : t.text;
      for (const m of text.matchAll(rx)) bump(m[1]);
    }
    found[f] = { counts, where };
  }
  return { found, names };
}

const kindOf = (names, k) => k.startsWith('W.') ? 'map key' : k.startsWith('era:') ? 'era word' : k.startsWith('arm:') ? 'arm type' : names.get(k) || '?';
if (require.main !== module) { module.exports = { literals, scan, battleNames }; return; }
const args = process.argv.slice(2);
const { found, names } = scan();
const allow = fs.existsSync(ALLOW) ? JSON.parse(fs.readFileSync(ALLOW, 'utf8')) : { files: {} };
const cat = k => k.startsWith('era:') ? 'era' : k.startsWith('arm:') ? 'arm' : 'battle';
const FIX = { battle: 'put it in the battle pack instead', era: 'name the thing by what it does, or move it to the era pack', arm: 'ask what the unit can do (a capability), not what it is' };
let bad = 0, lower = 0; const tot = { battle: 0, era: 0, arm: 0 }, allowed = { battle: 0, era: 0, arm: 0 }, lines = { battle: new Set(), era: new Set(), arm: new Set() };
for (const f of FILES) {
  const now = found[f].counts, ok = (allow.files[f] || {});
  for (const [k, n] of Object.entries(now)) {
    tot[cat(k)] += n; for (const l of found[f].where[k]) lines[cat(k)].add(f + ':' + l);
    if (!(k in ok)) { bad++; console.log(`NEW     ${f}:${found[f].where[k].join(',')}  "${k}" (${kindOf(names, k)}) x${n}: not in the allow-list; ${FIX[cat(k)]}`); }
    else if (n > ok[k]) { bad++; console.log(`MORE    ${f}:${found[f].where[k].join(',')}  "${k}" (${kindOf(names, k)}) x${n}, allowed ${ok[k]}`); }
    else if (n < ok[k]) lower++;
  }
  for (const [k, n] of Object.entries(ok)) { allowed[cat(k)] += n; if (!(k in now)) lower++; }
}
const total = tot.battle + tot.era + tot.arm;
if (args.includes('--list')) for (const f of FILES) { const byKind = {}; for (const [k, n] of Object.entries(found[f].counts)) (byKind[kindOf(names, k)] = byKind[kindOf(names, k)] || []).push(`${k}${n > 1 ? ' x' + n : ''}`); console.log(`\n${f}`); for (const [kd, l] of Object.entries(byKind)) console.log(`  ${kd}: ${l.join(', ')}`); }
if (args.includes('--update') && (!bad || args.includes('--force'))) {
  const files = {}; for (const f of FILES) files[f] = Object.fromEntries(Object.entries(found[f].counts).sort());
  fs.writeFileSync(ALLOW, JSON.stringify({ note: 'Battle names, era words (era:) and arm-type branches (arm:) the engine still uses (engine roadmap, phase 1). This list may only shrink: phases 2 and 3 move each into a pack or a capability. Regenerate with node tools/lint.js --update.', totals: tot, lines: { battle: lines.battle.size, era: lines.era.size, arm: lines.arm.size }, files }, null, 1) + '\n');
  console.log(`allow-list rewritten: ${total} uses`);
} else {
  for (const c of ['battle', 'era', 'arm']) console.log(`${c === 'battle' ? 'battle names' : c === 'era' ? 'era words  ' : 'arm types  '}  ${String(tot[c]).padStart(4)} uses on ${String(lines[c].size).padStart(3)} lines (allowed ${allowed[c]})`);
  console.log(`${bad ? bad + ' over the allow-list' : 'none over the allow-list'}${lower ? `; ${lower} fewer than allowed (run --update to lock them in)` : ''}`);
  if (bad) process.exit(1);
}
})();
