/* ---------- boot ---------- */
function readPal() { readPalette(); PAL.order = getComputedStyle(document.documentElement).getPropertyValue('--m-order').trim() || '#7b2a9e'; }
function themeChanged() { readPal(); legend(); scheduleTerrain(true); requestDraw(); }
readPal();
new ResizeObserver(() => resize()).observe(box);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (document.fonts && document.fonts.load) Promise.all(["13px 'IM Fell English SC'", "italic 12px 'IM Fell English'", "12px 'IM Fell English'", "11px 'EB Garamond'"].map(f => document.fonts.load(f).catch(() => 0))).then(() => requestDraw());
$('s-seed').value = (Math.random() * 1e6) | 0;
newGame(readSetup());
requestAnimationFrame(loop);
