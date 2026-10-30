/* ---------- boot ---------- */
function readPal() { readPalette(); PAL.order = getComputedStyle(document.documentElement).getPropertyValue('--m-order').trim() || '#7b2a9e'; }
function themeChanged() { readPal(); legend(); scheduleTerrain(true); requestDraw(); }
readPal();
{ const ro = new ResizeObserver(() => resize()); ro.observe(box); const mo = new MutationObserver(themeChanged); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  HOOKS.push(() => ro.disconnect(), () => mo.disconnect(), () => { for (const w of AAR.workers) w.terminate(); }); hook(matchMedia('(prefers-color-scheme: dark)'), 'change', themeChanged); }
if (document.fonts && document.fonts.load) Promise.all(["13px 'IM Fell English SC'", "italic 12px 'IM Fell English'", "12px 'IM Fell English'", "11px 'EB Garamond'"].map(f => document.fonts.load(f).catch(() => 0))).then(() => requestDraw());
// (phase 5) the page's words for this battle, from its game block (Waterloo's stand in the page itself)
if (GB.page) { const PG = GB.page; if (PG.h1) $('g-h1').innerHTML = PG.h1; if (PG.lead) $('g-lead').textContent = PG.lead; if (PG.cartouche) $('g-cart').textContent = PG.cartouche; if (PG.mapLabel) canvas.setAttribute('aria-label', PG.mapLabel); }
$('s-intro').textContent = GB.intro;
// (phase 5) the battles this app plays, in date order; choosing one starts it on a fresh page
{ const sb = $('s-battle'); const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  sb.innerHTML = globalThis.WApp.battles().map(id => { const b = WPacks.battles[id], [y, m, d] = String(b.date).split('-'); return `<option value="${id}">${esc(b.name)}, ${+d} ${MON[m - 1]} ${y}</option>`; }).join(''); sb.value = GAME_ID;
  sb.addEventListener('change', () => { if (sb.value !== GAME_ID) globalThis.WApp.start(sb.value); }); }
{ const sc = $('s-scen'); sc.innerHTML = Object.entries(GB.starts).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join(''); const go = () => { $('s-go').textContent = (GB.starts[sc.value] || {}).begin || 'Begin'; }; sc.addEventListener('change', go); go(); }
for (const [k, html] of Object.entries(GB.help || {})) { const el = document.querySelector(`[data-help="${k}"]`); if (!el) continue; if (html == null) el.hidden = true; else el.innerHTML = html; }
for (const [a, b] of GB.helpSwap || []) { const el = document.querySelector('[data-help="steps"]'); if (el) el.innerHTML = el.innerHTML.replace(a, b); }
$('s-seed').value = (Math.random() * 1e6) | 0;
newGame(readSetup());
requestAnimationFrame(loop);
