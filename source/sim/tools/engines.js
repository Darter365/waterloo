// Does another JavaScript engine fight the same battle? (docs/METHOD.md, section 7.) Draws no dice of the game's own: it sets up
// its own battles through replay.js, as refset.js does, and hashes every tick with refset.js's state hash, and it hashes each
// Math function the simulation calls over 200,000 fixed inputs, to show which of them an engine rounds differently.
//   node tools/engines.js record <out.json>     this engine: Waterloo, 11:00, the historical orders, seeds 1 to 3
//   bun tools/engines.js record <out.json>      the same under JavaScriptCore; any engine with require() will do
//   node tools/engines.js compare <a.json> <b.json> [...]   every file against the first: Math functions, ticks, first divergence, end
// In a page: paste this file into the console of the built game (it finds WReplay and WScript), then `await WEngines.record()`.
// Recorded on 12 November 2026: results/engines/*.json.
(function (root) {
  const paged = typeof module === 'undefined' || !module.exports, sim = paged ? null : __dirname + '/..';
  const Rp = paged ? root.WReplay : require(sim + '/replay.js'), Scr = paged ? root.WScript : require(sim + '/script.js');
  // SHA-1 in plain script, for an engine with no crypto.subtle
  function sha1(bytes) { const w = new Int32Array(80), l = bytes.length, n = ((l + 8) >> 6) + 1, m = new Int32Array(n * 16); for (let i = 0; i < l; i++) m[i >> 2] |= bytes[i] << (24 - (i % 4) * 8); m[l >> 2] |= 0x80 << (24 - (l % 4) * 8); m[n * 16 - 1] = l * 8; m[n * 16 - 2] = Math.floor(l / 536870912);
  let h0 = 0x67452301, h1 = 0xEFCDAB89 | 0, h2 = 0x98BADCFE | 0, h3 = 0x10325476, h4 = 0xC3D2E1F0 | 0; const rol = (x, c) => (x << c) | (x >>> (32 - c));
  for (let b = 0; b < n; b++) { for (let i = 0; i < 16; i++) w[i] = m[b * 16 + i]; for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1); let a = h0, bb = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) { const f = i < 20 ? (bb & c) | (~bb & d) : i < 40 ? bb ^ c ^ d : i < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d, k = i < 20 ? 0x5A827999 : i < 40 ? 0x6ED9EBA1 : i < 60 ? 0x8F1BBCDC | 0 : 0xCA62C1D6 | 0, t = (rol(a, 5) + f + e + k + w[i]) | 0; e = d; d = c; c = rol(bb, 30); bb = a; a = t; }
    h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; }
  const out = new Uint8Array(20); [h0, h1, h2, h3, h4].forEach((h, i) => { out[i * 4] = h >>> 24; out[i * 4 + 1] = h >>> 16; out[i * 4 + 2] = h >>> 8; out[i * 4 + 3] = h; }); return out.buffer; }
  const subtle = root.crypto && root.crypto.subtle, hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const digest = async bytes => hex(subtle ? await subtle.digest('SHA-1', bytes) : sha1(new Uint8Array(bytes.buffer || bytes)));
  const utf8 = s => { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s); const u = unescape(encodeURIComponent(s)), a = new Uint8Array(u.length); for (let i = 0; i < u.length; i++) a[i] = u.charCodeAt(i); return a; };
  async function maths(n) {
    n = n || 200000; let s = 12345; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; // whole-number arithmetic: the same inputs in every engine
    const xs = new Float64Array(n), ys = new Float64Array(n); for (let i = 0; i < n; i++) { xs[i] = (r() - 0.5) * 2 * Math.PI * 4; ys[i] = r() * 6000; } // angles to four turns; lengths to 6 km
    const F = { sin: i => Math.sin(xs[i]), cos: i => Math.cos(xs[i]), exp: i => Math.exp(xs[i] / 4), log: i => Math.log(ys[i] + 1e-9), pow: i => Math.pow(ys[i] / 600 + 0.01, xs[i] / 4),
      powHalf: i => Math.pow(ys[i], 0.5), pow2: i => Math.pow(xs[i], 2), atan2: i => Math.atan2(xs[i], ys[i] - 3000), acos: i => Math.acos(xs[i] / 26), hypot: i => Math.hypot(xs[i] * 100, ys[i]), hypot3: i => Math.hypot(xs[i], ys[i], xs[i] * ys[i]), sqrt: i => Math.sqrt(ys[i]) };
    const out = {}; for (const k in F) { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = F[k](i); out[k] = await digest(a); } return out;
  }
  // refset.js's state, as text (kept in step with stateHash there)
  const state = E => { const units = E.units.map(u => [u.id, u.x, u.y, u.str, u.coh, u.status, u.form, u.onMap ? 1 : 0, u.gone ? 1 : 0]);
    const places = (E.sps || []).map(sp => [sp.id, sp.holder, sp.garrison, (sp.secs || []).map(s => [s.held, s.burnt ? 1 : 0])]);
    const dice = Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0); return JSON.stringify([E.t, E.morale, units, places, dice]); };
  async function battle(seed) { // refset.js's "hist" battle, hashed every tick
    const E = Rp.setup({ seed, history: 'uncertain', scenario: '1100', staff: seed % 2 ? 'soult' : 'berthier', silence: 0 }); Scr.historical(E);
    const ticks = []; let guard = 0; while (!E.over && guard++ < 2000) { E.step(); ticks.push([E.t, await digest(utf8(state(E)))]); }
    const by = {}; for (const u of E.units) by[u.side] = (by[u.side] || 0) + (u.gone ? 0 : u.str);
    return { seed, ticks, result: E.result ? { grade: E.result.grade, why: E.result.why, t: E.result.t } : null, strength: by, morale: E.morale, dice: Object.values(E.rnd.counts || {}).reduce((a, b) => a + b, 0) };
  }
  async function record(seeds) { const out = { math: await maths(), battles: [] }; for (const s of seeds || [1, 2, 3]) out.battles.push(await battle(s)); return out; }
  const clock = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  function compare(a, b) { const lines = ['  Math functions that differ: ' + (Object.keys(a.math).filter(k => a.math[k] !== b.math[k]).join(' ') || 'none')];
    a.battles.forEach((x, j) => { const y = b.battles[j]; let d = 0, f = null; const n = Math.max(x.ticks.length, y.ticks.length);
      for (let k = 0; k < n; k++) if (!x.ticks[k] || !y.ticks[k] || x.ticks[k][1] !== y.ticks[k][1]) { d++; if (f === null) f = (x.ticks[k] || y.ticks[k])[0]; }
      lines.push(`  seed ${x.seed}: ${d ? d + ' of ' + n + ' ticks differ, first at ' + clock(f) : 'identical, all ' + n + ' ticks'}; ends ${clock(y.ticks[y.ticks.length - 1][0])} (${clock(x.ticks[x.ticks.length - 1][0])}), ${y.result.grade}, ${y.result.why}${JSON.stringify(x.result) === JSON.stringify(y.result) ? '' : '  RESULT DIFFERS'}`); });
    return lines; }
  root.WEngines = { maths, battle, record, compare };
  if (paged || typeof process === 'undefined' || !process.argv || !/engines\.js$/.test(process.argv[1] || '')) return; // required by another host: no command line
  const fs = require('fs'), [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'record') record().then(o => { o.engine = typeof Bun !== 'undefined' ? 'bun ' + Bun.version + ' (JavaScriptCore)' : 'node ' + process.version + ' (V8 ' + process.versions.v8 + ')'; fs.writeFileSync(rest[0], JSON.stringify(o)); console.log('recorded', o.engine, 'to', rest[0]); });
  else if (cmd === 'compare') { const all = rest.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))); for (let i = 1; i < all.length; i++) { console.log(`${all[i].engine || rest[i]}, against ${all[0].engine || rest[0]}`); for (const l of compare(all[0], all[i])) console.log(l); } }
  else console.log('usage: node tools/engines.js record <out.json> | compare <a.json> <b.json> [...]');
})(typeof globalThis !== 'undefined' ? globalThis : this);
