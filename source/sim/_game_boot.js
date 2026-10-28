/* ---------- boot ---------- */
function readPal() { readPalette(); PAL.order = getComputedStyle(document.documentElement).getPropertyValue('--m-order').trim() || '#7b2a9e'; }
function themeChanged() { readPal(); legend(); scheduleTerrain(true); requestDraw(); }
readPal();
new ResizeObserver(() => resize()).observe(box);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (document.fonts && document.fonts.load) Promise.all(["13px 'IM Fell English SC'", "italic 12px 'IM Fell English'", "12px 'IM Fell English'", "11px 'EB Garamond'"].map(f => document.fonts.load(f).catch(() => 0))).then(() => requestDraw());
// (phase 5) the page's words for this battle, from its game block (Waterloo's stand in the page itself)
if (GB.page) { const PG = GB.page; if (PG.h1) $('g-h1').innerHTML = PG.h1; if (PG.lead) $('g-lead').textContent = PG.lead; if (PG.cartouche) $('g-cart').textContent = PG.cartouche; if (PG.mapLabel) canvas.setAttribute('aria-label', PG.mapLabel); }
$('s-intro').textContent = GB.intro;
{ const sc = $('s-scen'); sc.innerHTML = Object.entries(GB.starts).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join(''); const go = () => { $('s-go').textContent = (GB.starts[sc.value] || {}).begin || 'Begin'; }; sc.addEventListener('change', go); go(); }
for (const [k, html] of Object.entries(GB.help || {})) { const el = document.querySelector(`[data-help="${k}"]`); if (!el) continue; if (html == null) el.hidden = true; else el.innerHTML = html; }
for (const [a, b] of GB.helpSwap || []) { const el = document.querySelector('[data-help="steps"]'); if (el) el.innerHTML = el.innerHTML.replace(a, b); }
$('s-seed').value = (Math.random() * 1e6) | 0;
newGame(readSetup());
requestAnimationFrame(loop);
