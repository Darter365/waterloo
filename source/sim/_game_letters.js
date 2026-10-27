/* ================= 8a. letters ================= */
// Orders go out as the letters Soult's office wrote, in the Emperor's name over the major-général's signature, and reports come in
// as the commanders wrote them. Only the dress changes: what each letter says is exactly what the plain text says.
const ADDRESS = {
  reille: 'Monsieur le Comte Reille', derlon: 'Monsieur le Comte d’Erlon', lobau: 'Monsieur le Comte de Lobau', drouot: 'Monsieur le Comte Drouot',
  milhaud: 'Monsieur le Comte Milhaud', kellermann: 'Monsieur le Comte Kellermann', ney: 'Monsieur le Maréchal Prince de la Moskowa',
  grouchy: 'Monsieur le Maréchal Comte de Grouchy', grandBattery: 'Monsieur le Général Desales', army: 'Messieurs les Commandants des corps d’armée',
};
const SIGNED = { reille: 'Cte Reille', derlon: 'Drouet, Cte d’Erlon', lobau: 'Cte de Lobau', drouot: 'Cte Drouot', milhaud: 'Cte Milhaud', kellermann: 'Cte Kellermann', ney: 'Le Maréchal Prince de la Moskowa', grouchy: 'Le Maréchal Cte de Grouchy' };
let LETTERS = true; try { LETTERS = localStorage.getItem('waterloo.letters') !== 'plain'; } catch (e) { /* storage blocked: letters on */ }
function setLetters(on) { LETTERS = on; try { localStorage.setItem('waterloo.letters', on ? 'letters' : 'plain'); } catch (e) { /* not kept */ } if (SIM && G) { renderStop(); updatePreview(); } }
const isLetter = m => LETTERS && m.kind === 'report' && (CORPS.includes(m.from) || m.from === 'ney' || m.from === 'grouchy');
// a report as its commander wrote it: the salutation, the body as written, and his signature (a deputy signs his own name)
function letterHTML(m, inner, acts) {
  const L = SIM.leaders[m.from], sig = L && L.replaced ? `${L.name}` : SIGNED[m.from] || (L ? L.name : m.from);
  const when = m.writtenAt != null ? hm(m.writtenAt) : hm(m.t), lag = m.writtenAt != null ? Math.round(m.t - m.writtenAt) : 0;
  return `<header><b>${esc(m.title)}</b><time>${lag >= 2 ? `written ${when} · arrived ${hm(m.t)}` : when}</time></header><div class="lbody"><p class="sal">Sire,</p>${inner}<p class="sig">${esc(sig)}</p></div>${acts}`;
}
// an order as Soult's office would send it
function orderLetterHTML(spec, text) {
  const C = SIM.command, to = spec.to, post = WCommand.POSTS[C.hq.moving ? C.hq.moving.to : C.hq.post].name;
  const rest = text.replace(/^[^:]*:\s*/, ''), body = to === 'army' ? `The Emperor orders the army to ${rest}.` : /^first /.test(rest) ? `The Emperor orders you first to ${rest.slice(6).replace(/; then /g, '; then to ')}.` : `The Emperor orders you to ${rest}.`;
  const sig = G.opts.staff === 'berthier' ? 'Le Major-Général, Prince de Neuchâtel et de Wagram' : 'Le Major-Général, Duc de Dalmatie';
  return `<div class="oletter"><div class="ohead">Au quartier impérial, ${esc(post)} · le 18 juin 1815, ${hm(SIM.t)}</div><div class="osal">${esc(ADDRESS[to] || to)},</div><div class="obody">${esc(body)}</div><div class="osig">${esc(sig)}</div></div>`;
}
