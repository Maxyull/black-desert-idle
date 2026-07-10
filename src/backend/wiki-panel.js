// ============================================================
// WIKI — panneau plein écran (2026-07-11, demande explicite : port à l'identique du mockup
// bdi-wiki.html/bdi-wiki.md fourni par l'utilisateur — sidebar nav groupée, breadcrumb, article
// + infobox + sommaire, recherche live) ═══════════════════════════════════════════════════════
// Remplace l'ancienne modale à onglets plats (renderWikiHtml(), toujours définie dans
// game-supabase.js pour son contenu WIKI_SECTIONS/renderCodexHtml — cette réutilisation en fait
// la source de vérité unique, jamais de duplication de texte ici).
//
// Écarts assumés par rapport au mockup fourni (voir CLAUDE.md §30 "Maquettes externes") :
// - Palette : couleurs du mockup reprises À L'IDENTIQUE (demande explicite), pas la palette
//   officielle §29 — scopées sous #wikiOverlay uniquement pour ne pas déteindre sur le reste du
//   jeu (même logique que le module Compagnons, qui a "son propre :root de couleurs").
// - Contenu : le mockup mélange des sujets qui, dans le vrai jeu, vivent dans DES PANNEAUX
//   SÉPARÉS (Compagnons = iframe isolée §28, Compendium Zones/Boss/PEN = compendium-react.js).
//   Plutôt que dupliquer ou inventer ce contenu ici, les entrées correspondantes de la sidebar
//   sont des raccourcis qui ouvrent directement ces vrais panneaux (icône ↗), jamais des articles
//   inventés. Idem pour la Guilde/Discord : aucun lien Discord réel n'existe dans le code, donc
//   pas de lien inventé — note honnête à la place.
// - Codex : le mockup a un état "verrouillé/découvert" façon succès — la vraie liste d'objets
//   (renderCodexHtml()) n'a PAS cette notion de découverte, c'est juste un catalogue à jour. Pas
//   de mécanique de déblocage fictive ajoutée : tout est affiché "découvert".

const WK_V = { // variables couleur copiées à l'identique depuis classement-public.html/bdi-wiki.html
  bg:'#080810', s1:'#10101e', s2:'#181828', s3:'#202038',
  border:'#2a2a44', border2:'#3a3a58',
  gold:'#c8a96e', gold2:'#e8c880', goldDim:'#5a4820',
  blue:'#6a8fb0', blue2:'#90b8d8',
  green:'#44b060', green2:'#70d890',
  red:'#c04040', red2:'#e06060',
  cream:'#ddd0b8', cream2:'#9a8e78', cream3:'#585040',
};

let wkCurrentId = 'accueil';
let wkScrollHandler = null;

function wkT(fr, en) { return LANG === 'fr' ? fr : en; }

// Structure de nav groupée, comme le mockup — chaque item est soit un article réel (WIKI_SECTIONS
// / renderCodexHtml), soit un raccourci vers un autre panneau du jeu (openCompanionsModule /
// openCompendiumReact / openPatchNotesReact), jamais un contenu inventé.
function wkNavGroups() {
  return [
    { title: wkT('Général', 'General'), items: [
      { id:'accueil', ico:'🏠', label:wkT('Accueil','Home'), kind:'home' },
      { id:'tuto', ico:'🔰', label:wkT('Tutoriel','Tutorial'), kind:'tuto' },
      { id:'patchnotes', ico:'📜', label:wkT('Notes de version','Patch notes'), kind:'link',
        open:()=>{ if (typeof openPatchNotesReact === 'function') openPatchNotesReact(); } },
    ]},
    { title: wkT('Guides de jeu', 'Game guides'), items: [
      { id:'combat', ico:'⚔️', label:wkT('Combat & Zones','Combat & Zones'), kind:'section', sec:'combat' },
      { id:'enh', ico:'✦', label:wkT('Optimisation','Enhancement'), kind:'section', sec:'enh' },
      { id:'market', ico:'🏛️', label:wkT('Marché','Market'), kind:'section', sec:'market' },
      { id:'account', ico:'💾', label:wkT('Compte & Sauvegarde','Account & Save'), kind:'section', sec:'account' },
    ]},
    { title: wkT('Objets', 'Items'), items: [
      { id:'codex', ico:'📖', label:wkT('Codex des objets','Item codex'), kind:'codex' },
    ]},
    { title: wkT('Compagnons & Monde', 'Companions & World'), items: [
      { id:'companions', ico:'🐾', label:wkT('Familiers (fusion, catalogue…)','Companions (fusion, catalog…)'), kind:'link',
        open:()=>{ if (typeof openCompanionsModule === 'function') openCompanionsModule(); } },
      { id:'compendium', ico:'🗺️', label:wkT('Zones, Boss & Maîtrise PEN','Zones, Bosses & PEN Mastery'), kind:'link',
        open:()=>{ if (typeof openCompendiumReact === 'function') openCompendiumReact(); } },
    ]},
    { title: wkT('Communauté', 'Community'), items: [
      { id:'about', ico:'ℹ️', label:wkT('À propos','About'), kind:'section', sec:'about' },
      { id:'discord', ico:'💬', label:wkT('Discord','Discord'), kind:'discord' },
    ]},
  ];
}
function wkFlatItems() { return wkNavGroups().flatMap(g => g.items.map(it => ({ ...it, group:g.title }))); }
function wkFindItem(id) { return wkFlatItems().find(it => it.id === id); }

function wkChangeCallout() {
  if (typeof contentIsUnread !== 'function' || !contentIsUnread('wiki')) return '';
  const entry = (typeof CONTENT_UPDATE_VERSION !== 'undefined') ? CONTENT_UPDATE_VERSION.wiki : null;
  if (!entry || !entry.desc) return '';
  return `<div class="wk-callout">🆕 ${wkEscape(entry.desc[LANG] || entry.desc.fr)}</div>`;
}
function wkEscape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function wkSlug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

// ---- rendu de l'article actif (contenu réel uniquement) ----
function wkArticleHtml(item) {
  if (item.kind === 'home') return wkHomeHtml();
  if (item.kind === 'tuto') return wkTutoHtml();
  if (item.kind === 'codex') return wkChangeCallout() + (typeof renderCodexHtml === 'function' ? renderCodexHtml() : '');
  if (item.kind === 'section') {
    const sec = (typeof WIKI_SECTIONS !== 'undefined') ? WIKI_SECTIONS.find(s => s.id === item.sec) : null;
    if (!sec) return '';
    return (item.sec === 'combat' ? wkChangeCallout() : '') + (sec[LANG] || sec.fr);
  }
  if (item.kind === 'discord') return wkDiscordHtml();
  return '';
}
function wkHomeHtml() {
  const version = (typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES[0]) ? PATCH_NOTES[0].v : '';
  return `<p class="wk-lead">${wkT(
    'Bienvenue sur le Wiki de Velia Idle — jeu idle de farm automatique inspiré de Black Desert Online. Retrouve ici les règles de combat/zones, l\'optimisation, le marché, ainsi que des raccourcis vers le Compendium et le module Compagnons.',
    'Welcome to the Velia Idle Wiki — an automatic idle-farming game inspired by Black Desert Online. Here you\'ll find combat/zone rules, enhancement, the market, plus shortcuts to the Compendium and Companions module.')}</p>
    <h3>${wkT('Systèmes principaux','Main systems')}</h3>
    <ul>
      <li><b>${wkT('Combat & Zones','Combat & Zones')}</b> — ${wkT('PA/PD requis, loot progressif','required AP/DP, progressive loot')}</li>
      <li><b>${wkT('Optimisation','Enhancement')}</b> — +1 ${wkT('à','to')} PEN, Pierre de Cron</li>
      <li><b>${wkT('Marché','Market')}</b> — ${wkT('carnet d\'ordres joueur à joueur','player-to-player order book')}</li>
      <li><b>${wkT('Compagnons','Companions')}</b> — ${wkT('collection, fusion et classement (module dédié)','collection, fusion and leaderboard (dedicated module)')}</li>
    </ul>`;
}
// réutilise le vrai renderTutoPageHtml() (game-supabase.js) — pas de duplication du texte, et le
// bouton #btnStartTutoWiki qu'il génère reste câblé en bas de wkRenderArticleAndInfobox.
function wkTutoHtml() {
  return typeof renderTutoPageHtml === 'function' ? renderTutoPageHtml() : '';
}
function wkDiscordHtml() {
  return `<div class="wk-callout" style="border-left-color:${WK_V.blue}">💬 ${wkT(
    'Pas encore de serveur Discord officiel pour le moment — cette section sera complétée dès qu\'un lien existera.',
    'No official Discord server yet — this section will be filled in once a link exists.')}</div>`;
}

// ---- headings -> ancres pour le sommaire (les articles réels utilisent <h3>, pas <h2>) ----
function wkInjectHeadingIds(html) {
  return html.replace(/<h3>(.*?)<\/h3>/g, (m, txt) => `<h3 id="${wkSlug(txt.replace(/<[^>]+>/g,''))}">${txt}</h3>`);
}
function wkExtractHeadings(html) {
  const out = []; const re = /<h3 id="([^"]+)">(.*?)<\/h3>/g; let m;
  while ((m = re.exec(html))) out.push({ id:m[1], txt:m[2].replace(/<[^>]+>/g,'') });
  return out;
}

function wkRelated(item) {
  const group = wkNavGroups().find(g => g.items.some(it => it.id === item.id));
  return (group ? group.items : []).filter(it => it.id !== item.id).slice(0, 4);
}

function wkRenderInfobox(item, headings) {
  const isHome = item.kind === 'home';
  const rowsHtml = isHome ? `
      <div class="wk-ib-row"><span class="wk-ib-label">${wkT('Développeur','Developer')}</span><span class="wk-ib-val">Maxyull</span></div>
      <div class="wk-ib-row"><span class="wk-ib-label">${wkT('Version','Version')}</span><span class="wk-ib-val wk-gold">${wkEscape((typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES[0]) ? PATCH_NOTES[0].v : '—')}</span></div>
      <div class="wk-ib-row"><span class="wk-ib-label">${wkT('Moteur','Engine')}</span><span class="wk-ib-val">JS + Supabase</span></div>
      <div class="wk-ib-row"><span class="wk-ib-label">${wkT('Licence','License')}</span><span class="wk-ib-val">${wkT('Fan gratuit','Free fan project')}</span></div>` : '';
  const tocHtml = headings.length ? `
    <div class="wk-toc">
      <div class="wk-toc-title">${wkT('Sommaire','Contents')}</div>
      ${headings.map(h => `<div class="wk-toc-item" data-id="${h.id}">${wkEscape(h.txt)}</div>`).join('')}
    </div>` : '';
  const related = wkRelated(item);
  const relatedHtml = related.length ? `
    <div class="wk-related-title">${wkT('Voir aussi','See also')}</div>
    ${related.map(it => `<div class="wk-related-item" data-nav="${it.id}"><span class="wk-related-ico">${it.ico}</span><span class="wk-related-name">${wkEscape(it.label)}</span></div>`).join('')}` : '';
  return `<div class="wk-infobox">
      <div class="wk-infobox-art">${item.ico}</div>
      <div class="wk-infobox-name">${wkEscape(item.label)}</div>
      <div class="wk-infobox-cat">${wkEscape(item.group || '')}</div>
      ${rowsHtml ? `<div class="wk-infobox-rows">${rowsHtml}</div>` : ''}
    </div>${tocHtml}${relatedHtml}`;
}

function wkRenderArticleAndInfobox(item) {
  const article = document.getElementById('wkArticle');
  const infoboxCol = document.getElementById('wkInfoboxCol');
  const rawBody = wkArticleHtml(item);
  const bodyHtml = wkInjectHeadingIds(rawBody);
  const headings = wkExtractHeadings(bodyHtml);
  article.innerHTML = `
    <div class="wk-art-title">${item.ico} ${wkEscape(item.label)}</div>
    <div class="wk-hr"></div>
    <div class="wk-art-body">${bodyHtml}</div>`;
  infoboxCol.innerHTML = wkRenderInfobox(item, headings);
  const tutoBtn = document.getElementById('btnStartTutoWiki');
  // SEUL point d'entrée du tutoriel d'arrivée (voir game-supabase.js) : trackId:'onboarding' doit
  // être préservé, c'est ce qui alimente les stats admin de démarrage du tutoriel (onboarding_stats).
  if (tutoBtn) tutoBtn.onclick = () => { closeWikiPanel(); if (typeof startTutorial === 'function' && typeof TUTORIAL_STEPS !== 'undefined') startTutorial(TUTORIAL_STEPS, { trackId:'onboarding' }); };
  infoboxCol.querySelectorAll('.wk-related-item').forEach(el => {
    el.onclick = () => wkNavigate(el.dataset.nav);
  });
  infoboxCol.querySelectorAll('.wk-toc-item').forEach(el => {
    el.onclick = () => document.getElementById(el.dataset.id)?.scrollIntoView({ behavior:'smooth', block:'start' });
  });
  const col = article.closest('.wk-article-col');
  col.scrollTop = 0;
  if (wkScrollHandler) col.removeEventListener('scroll', wkScrollHandler);
  const headingEls = [...article.querySelectorAll('.wk-art-body h3[id]')];
  wkScrollHandler = () => {
    let current = headingEls[0]?.id;
    for (const h of headingEls) { if (h.getBoundingClientRect().top - col.getBoundingClientRect().top < 40) current = h.id; }
    infoboxCol.querySelectorAll('.wk-toc-item').forEach(t => t.classList.toggle('on', t.dataset.id === current));
  };
  col.addEventListener('scroll', wkScrollHandler);
  wkScrollHandler();
}

function wkRenderBreadcrumb(item) {
  const el = document.getElementById('wkCrumb');
  el.innerHTML = `<span class="wk-crumb-link" data-nav="accueil">Wiki</span><span class="wk-sep">/</span>` +
    (item.id !== 'accueil' ? `<span class="wk-crumb-link" data-nav="__group__">${wkEscape(item.group || '')}</span><span class="wk-sep">/</span>` : '') +
    `<span class="wk-cur">${wkEscape(item.label)}</span>`;
  el.querySelectorAll('.wk-crumb-link').forEach(a => { if (a.dataset.nav === 'accueil') a.onclick = () => wkNavigate('accueil'); });
}

function wkRenderNav() {
  const el = document.getElementById('wkNav');
  el.innerHTML = wkNavGroups().map(g => `
    <div class="wk-nav-group">
      <div class="wk-nav-group-title">${wkEscape(g.title)}</div>
      ${g.items.map(it => `<div class="wk-nav-item${it.id === wkCurrentId ? ' active' : ''}" data-nav="${it.id}">
        <span class="wk-nav-ico">${it.ico}</span>${wkEscape(it.label)}${it.kind === 'link' ? '<span class="wk-ext">↗</span>' : ''}
      </div>`).join('')}
    </div>`).join('');
  el.querySelectorAll('.wk-nav-item').forEach(elm => { elm.onclick = () => wkNavigate(elm.dataset.nav); });
}

function wkNavigate(id) {
  const item = wkFindItem(id);
  if (!item) return;
  if (item.kind === 'link') { closeWikiPanel(); item.open(); return; }
  wkCurrentId = id;
  wkRenderNav();
  wkRenderBreadcrumb(item);
  wkRenderArticleAndInfobox(item);
  wkCloseSearch();
}

// ---- recherche live (titres uniquement, comme le mockup) ----
function wkCloseSearch() { document.getElementById('wkSearchResults')?.remove(); }
function wkRunSearch(q) {
  wkCloseSearch();
  q = q.trim().toLowerCase();
  if (!q) return;
  const matches = wkFlatItems().filter(it => it.label.toLowerCase().includes(q) || (it.group || '').toLowerCase().includes(q));
  const wrap = document.createElement('div');
  wrap.className = 'wk-search-results'; wrap.id = 'wkSearchResults';
  wrap.innerHTML = matches.length
    ? matches.map(it => `<div class="wk-sr-item" data-nav="${it.id}"><span class="wk-sr-ico">${it.ico}</span><span>${wkEscape(it.label)}${it.kind === 'link' ? ' ↗' : ''}</span></div>`).join('')
    : `<div class="wk-no-results">${wkT('Aucun résultat pour','No results for')} « ${wkEscape(q)} »</div>`;
  wrap.querySelectorAll('.wk-sr-item').forEach(el => { el.onmousedown = () => wkNavigate(el.dataset.nav); });
  document.getElementById('wkSearchWrap').appendChild(wrap);
}

function wkBuildOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'wikiOverlay';
  overlay.innerHTML = `
    <div class="wk-hdr">
      <div class="wk-logo">◈ Velia Idle <span>Wiki</span></div>
      <div class="wk-search-wrap" id="wkSearchWrap">
        <span class="wk-search-ico">🔍</span>
        <input class="wk-search-box" id="wkSearchBox" placeholder="${wkT('Rechercher…','Search…')}">
      </div>
      <button class="wk-close" id="wkClose">✕ ${wkT('Fermer','Close')}</button>
    </div>
    <div class="wk-crumb" id="wkCrumb"></div>
    <div class="wk-wrap">
      <div class="wk-nav" id="wkNav"></div>
      <div class="wk-article-col"><div class="wk-article" id="wkArticle"></div></div>
      <div class="wk-infobox-col" id="wkInfoboxCol"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('wkClose').onclick = closeWikiPanel;
  document.getElementById('wkSearchBox').addEventListener('input', e => wkRunSearch(e.target.value));
  document.getElementById('wkSearchBox').addEventListener('blur', () => setTimeout(wkCloseSearch, 150));
  return overlay;
}

function openWikiPanel() {
  let overlay = document.getElementById('wikiOverlay');
  if (!overlay) { wkInjectStyles(); overlay = wkBuildOverlay(); }
  overlay.classList.add('open');
  if (typeof markContentSeen === 'function') markContentSeen('wiki');
  wkNavigate(wkCurrentId);
}
function closeWikiPanel() {
  document.getElementById('wikiOverlay')?.classList.remove('open');
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
}

function wkInjectStyles() {
  if (document.getElementById('wkStyles')) return;
  const s = document.createElement('style');
  s.id = 'wkStyles';
  s.textContent = `
#wikiOverlay { display:none; position:fixed; inset:0; z-index:955; background:${WK_V.bg}; color:${WK_V.cream};
  font-family:'Inter',sans-serif; flex-direction:column; }
#wikiOverlay.open { display:flex; }
#wikiOverlay * { box-sizing:border-box; }
#wikiOverlay .wk-hdr { background:linear-gradient(180deg,#0c0c1a,transparent); border-bottom:1px solid ${WK_V.border};
  padding:10px 18px; display:flex; align-items:center; gap:16px; flex-shrink:0; }
#wikiOverlay .wk-logo { font-family:'Cinzel',serif; font-size:16px; color:${WK_V.gold}; letter-spacing:.08em;
  display:flex; align-items:center; gap:8px; white-space:nowrap; }
#wikiOverlay .wk-logo span { color:${WK_V.cream3}; font-size:10px; font-weight:400; letter-spacing:.15em; text-transform:uppercase; }
#wikiOverlay .wk-search-wrap { position:relative; flex:1; max-width:420px; }
#wikiOverlay .wk-search-box { width:100%; background:${WK_V.s2}; border:1px solid ${WK_V.border}; border-radius:20px;
  padding:7px 14px 7px 32px; font-size:12px; color:${WK_V.cream}; outline:none; font-family:'Inter',sans-serif; }
#wikiOverlay .wk-search-box::placeholder { color:${WK_V.cream3}; }
#wikiOverlay .wk-search-box:focus { border-color:${WK_V.goldDim}; }
#wikiOverlay .wk-search-ico { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:12px; color:${WK_V.cream3}; pointer-events:none; }
#wikiOverlay .wk-close { margin-left:auto; font-family:'Cinzel',serif; font-size:11px; background:transparent;
  border:1px solid ${WK_V.border2}; color:${WK_V.cream}; border-radius:6px; padding:6px 14px; cursor:pointer; flex-shrink:0; }
#wikiOverlay .wk-close:hover { border-color:${WK_V.gold}; color:${WK_V.gold2}; }
#wikiOverlay .wk-crumb { padding:7px 18px; font-size:10px; color:${WK_V.cream3}; border-bottom:1px solid ${WK_V.border};
  background:${WK_V.s1}; flex-shrink:0; display:flex; gap:6px; align-items:center; }
#wikiOverlay .wk-crumb .wk-sep { color:${WK_V.border2}; }
#wikiOverlay .wk-crumb-link { color:${WK_V.cream2}; cursor:pointer; }
#wikiOverlay .wk-crumb-link:hover { color:${WK_V.gold2}; }
#wikiOverlay .wk-crumb .wk-cur { color:${WK_V.gold2}; }
#wikiOverlay .wk-wrap { flex:1; overflow:hidden; display:grid; grid-template-columns:220px 1fr 260px; }
#wikiOverlay .wk-nav { border-right:1px solid ${WK_V.border}; background:${WK_V.s1}; overflow-y:auto; padding:14px 10px; }
#wikiOverlay .wk-nav-group { margin-bottom:16px; }
#wikiOverlay .wk-nav-group-title { font-family:'Cinzel',serif; font-size:9px; letter-spacing:.12em; text-transform:uppercase;
  color:${WK_V.cream3}; padding:0 8px 6px; }
#wikiOverlay .wk-nav-item { display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:6px; cursor:pointer;
  font-size:11.5px; color:${WK_V.cream2}; transition:all .12s; margin-bottom:1px; }
#wikiOverlay .wk-nav-item:hover { background:${WK_V.s2}; color:${WK_V.cream}; }
#wikiOverlay .wk-nav-item.active { background:${WK_V.s2}; color:${WK_V.gold2}; border-left:3px solid ${WK_V.gold}; padding-left:6px; }
#wikiOverlay .wk-nav-ico { width:14px; text-align:center; font-size:12px; flex-shrink:0; }
#wikiOverlay .wk-ext { margin-left:auto; font-size:9px; color:${WK_V.cream3}; }
#wikiOverlay .wk-article-col { overflow-y:auto; }
#wikiOverlay .wk-article { padding:26px 34px 60px; max-width:820px; }
#wikiOverlay .wk-art-title { font-family:'Cinzel',serif; font-size:24px; color:${WK_V.cream}; letter-spacing:.02em; }
#wikiOverlay .wk-hr { height:1px; background:linear-gradient(90deg,${WK_V.border},transparent); margin:18px 0; }
#wikiOverlay .wk-lead { font-size:13.5px; line-height:1.75; color:${WK_V.cream2}; margin-bottom:8px; }
#wikiOverlay .wk-art-body h3 { font-family:'Cinzel',serif; font-size:14px; color:${WK_V.gold2}; letter-spacing:.03em;
  margin:20px 0 8px; padding-bottom:6px; border-bottom:1px solid ${WK_V.border}; scroll-margin-top:14px; }
#wikiOverlay .wk-art-body p { font-size:13px; line-height:1.8; color:${WK_V.cream2}; margin-bottom:12px; }
#wikiOverlay .wk-art-body p b, #wikiOverlay .wk-art-body p strong { color:${WK_V.cream}; font-weight:500; }
#wikiOverlay .wk-art-body ul { margin:0 0 12px 18px; }
#wikiOverlay .wk-art-body li { font-size:13px; line-height:1.8; color:${WK_V.cream2}; margin-bottom:3px; }
#wikiOverlay .wk-btn, #wikiOverlay .wk-art-body button { font-family:'Cinzel',serif; font-size:11px; font-weight:600;
  letter-spacing:.04em; padding:8px 18px; border-radius:6px; cursor:pointer; border:1px solid ${WK_V.goldDim};
  background:transparent; color:${WK_V.gold2}; }
#wikiOverlay .wk-btn:hover, #wikiOverlay .wk-art-body button:hover { background:rgba(200,169,110,.1); }
#wikiOverlay .wk-callout { background:${WK_V.s2}; border:1px solid ${WK_V.border}; border-left:3px solid ${WK_V.blue};
  border-radius:6px; padding:10px 14px; font-size:12px; color:${WK_V.cream2}; margin:0 0 14px; }
#wikiOverlay .wk-infobox-col { border-left:1px solid ${WK_V.border}; background:${WK_V.s1}; overflow-y:auto; padding:16px; }
#wikiOverlay .wk-infobox { background:${WK_V.s2}; border:1px solid ${WK_V.border}; border-radius:10px; overflow:hidden; }
#wikiOverlay .wk-infobox-art { aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:48px;
  background:radial-gradient(circle,${WK_V.s3},${WK_V.s1}); border-bottom:1px solid ${WK_V.border}; }
#wikiOverlay .wk-infobox-name { font-family:'Cinzel',serif; font-size:13px; color:${WK_V.gold2}; text-align:center; padding:10px 10px 2px; }
#wikiOverlay .wk-infobox-cat { font-size:10px; color:${WK_V.cream3}; text-align:center; padding-bottom:8px; }
#wikiOverlay .wk-infobox-rows { padding:4px 12px 12px; }
#wikiOverlay .wk-ib-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0;
  border-bottom:1px solid ${WK_V.border}; font-size:11px; }
#wikiOverlay .wk-ib-row:last-child { border-bottom:none; }
#wikiOverlay .wk-ib-label { color:${WK_V.cream3}; }
#wikiOverlay .wk-ib-val { color:${WK_V.cream}; font-family:'JetBrains Mono',monospace; font-size:11px; }
#wikiOverlay .wk-ib-val.wk-gold { color:${WK_V.gold2}; }
#wikiOverlay .wk-toc { margin-top:16px; }
#wikiOverlay .wk-toc-title, #wikiOverlay .wk-related-title { font-family:'Cinzel',serif; font-size:9px; letter-spacing:.12em;
  text-transform:uppercase; color:${WK_V.cream3}; margin-bottom:8px; }
#wikiOverlay .wk-related-title { margin:18px 0 8px; }
#wikiOverlay .wk-toc-item { font-size:11px; color:${WK_V.cream2}; padding:5px 0; cursor:pointer; border-left:2px solid transparent;
  padding-left:8px; transition:all .12s; }
#wikiOverlay .wk-toc-item:hover { color:${WK_V.gold2}; border-left-color:${WK_V.goldDim}; }
#wikiOverlay .wk-toc-item.on { color:${WK_V.gold2}; border-left-color:${WK_V.gold}; }
#wikiOverlay .wk-related-item { display:flex; align-items:center; gap:8px; padding:6px 4px; cursor:pointer; border-radius:6px; transition:all .12s; }
#wikiOverlay .wk-related-item:hover { background:${WK_V.s2}; }
#wikiOverlay .wk-related-item:hover .wk-related-name { color:${WK_V.gold2}; }
#wikiOverlay .wk-related-ico { font-size:16px; width:22px; text-align:center; }
#wikiOverlay .wk-related-name { font-size:11px; color:${WK_V.cream2}; }
#wikiOverlay .wk-search-results { position:absolute; top:calc(100% + 6px); left:0; right:0; background:${WK_V.s2};
  border:1px solid ${WK_V.border2}; border-radius:8px; overflow:hidden; z-index:10; box-shadow:0 8px 20px rgba(0,0,0,.4); }
#wikiOverlay .wk-sr-item { display:flex; align-items:center; gap:9px; padding:8px 12px; cursor:pointer; font-size:12px; color:${WK_V.cream2}; }
#wikiOverlay .wk-sr-item:hover { background:${WK_V.s3}; color:${WK_V.gold2}; }
#wikiOverlay .wk-sr-ico { font-size:14px; width:18px; text-align:center; }
#wikiOverlay .wk-no-results { font-size:11px; color:${WK_V.cream3}; padding:8px 12px; }
/* Habillage local des blocs réels réutilisés (Codex des objets), sans toucher au style global du jeu */
#wikiOverlay .admSummary { font-size:12px; color:${WK_V.cream2}; margin-bottom:14px; }
#wikiOverlay .codexRow { display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid ${WK_V.border}; }
#wikiOverlay .codexIcon { font-size:20px; width:26px; text-align:center; flex-shrink:0; }
#wikiOverlay .codexName { font-size:12.5px; color:${WK_V.cream}; }
#wikiOverlay .codexDesc { font-size:10.5px; color:${WK_V.cream3}; }
@media (max-width:1024px) {
  /* nav transformée en bandeau horizontal scrollable plutôt que masquée (sinon plus aucun moyen
     de changer de section sur mobile, voir CLAUDE.md §14) ; infobox/sommaire/related passent sous
     l'article au lieu d'une colonne à droite */
  #wikiOverlay .wk-wrap { grid-template-columns:1fr; grid-template-rows:auto 1fr auto; }
  #wikiOverlay .wk-nav { display:flex; flex-direction:row; overflow-x:auto; padding:8px 10px; border-right:none; border-bottom:1px solid ${WK_V.border}; }
  #wikiOverlay .wk-nav-group { display:flex; align-items:center; gap:4px; margin-bottom:0; margin-right:14px; flex-shrink:0; }
  #wikiOverlay .wk-nav-group-title { display:none; }
  #wikiOverlay .wk-nav-item { white-space:nowrap; margin-bottom:0; }
  #wikiOverlay .wk-nav-item.active { border-left:none; border-bottom:2px solid ${WK_V.gold}; padding-left:9px; }
  #wikiOverlay .wk-infobox-col { border-left:none; border-top:1px solid ${WK_V.border}; max-height:40vh; }
  #wikiOverlay .wk-article { padding:18px 16px 30px; }
}
@media (max-width:600px) {
  #wikiOverlay .wk-hdr { flex-wrap:wrap; gap:8px; }
  #wikiOverlay .wk-search-wrap { order:3; max-width:none; flex-basis:100%; }
}`;
  document.head.appendChild(s);
}
