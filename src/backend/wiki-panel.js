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

// Structure de nav groupée, comme le mockup — chaque item est soit un article réel (WIKI_SECTIONS
// / renderCodexHtml), soit un raccourci vers un autre panneau du jeu (openCompanionsModule /
// openCompendiumReact / openPatchNotesReact), jamais un contenu inventé.
/**
 * Construit la structure de navigation groupée du Wiki (accueil, guides, objets, compagnons/monde,
 * communauté). Chaque item est soit un article réel (WIKI_SECTIONS/renderCodexHtml), soit un
 * raccourci vers un autre panneau du jeu — jamais de contenu inventé.
 * @returns {Array<{title:string, items:Array<object>}>} groupes de navigation avec leurs items
 */
function wkNavGroups() {
  return [
    { title: i18next.t('backend:backend.wiki.nav_group_general'), items: [
      { id:'accueil', ico:'🏠', label:i18next.t('backend:backend.wiki.nav_home'), kind:'home' },
      { id:'tuto', ico:'🔰', label:i18next.t('backend:backend.wiki.nav_tuto'), kind:'tuto' },
      { id:'patchnotes', ico:'📜', label:i18next.t('backend:backend.wiki.nav_patchnotes'), kind:'link',
        open:()=>{ if (typeof openPatchNotesReact === 'function') openPatchNotesReact(); } },
    ]},
    { title: i18next.t('backend:backend.wiki.nav_group_guides'), items: [
      { id:'combat', ico:'⚔️', label:i18next.t('backend:backend.wiki.nav_combat'), kind:'section', sec:'combat' },
      { id:'enh', ico:'✦', label:i18next.t('backend:backend.wiki.nav_enh'), kind:'section', sec:'enh' },
      { id:'market', ico:'🏛️', label:i18next.t('backend:backend.wiki.nav_market'), kind:'section', sec:'market' },
      { id:'account', ico:'💾', label:i18next.t('backend:backend.wiki.nav_account'), kind:'section', sec:'account' },
    ]},
    { title: i18next.t('backend:backend.wiki.nav_group_items'), items: [
      { id:'codex', ico:'📖', label:i18next.t('backend:backend.wiki.nav_codex'), kind:'codex' },
    ]},
    { title: i18next.t('backend:backend.wiki.nav_group_companions_world'), items: [
      { id:'companions', ico:'🐾', label:i18next.t('backend:backend.wiki.nav_companions'), kind:'link',
        open:()=>{ if (typeof openCompanionsModule === 'function') openCompanionsModule(); } },
      { id:'compendium', ico:'🗺️', label:i18next.t('backend:backend.wiki.nav_compendium'), kind:'link',
        open:()=>{ if (typeof openCompendiumReact === 'function') openCompendiumReact(); } },
    ]},
    { title: i18next.t('backend:backend.wiki.nav_group_community'), items: [
      { id:'about', ico:'ℹ️', label:i18next.t('backend:backend.wiki.nav_about'), kind:'section', sec:'about' },
      { id:'discord', ico:'💬', label:i18next.t('backend:backend.wiki.nav_discord'), kind:'discord' },
    ]},
  ];
}
/** @returns {Array<object>} tous les items de nav à plat, chacun enrichi du titre de son groupe (`group`) */
function wkFlatItems() { return wkNavGroups().flatMap(g => g.items.map(it => ({ ...it, group:g.title }))); }
/** @param {string} id identifiant d'item de nav @returns {object|undefined} l'item correspondant, ou undefined si inconnu */
function wkFindItem(id) { return wkFlatItems().find(it => it.id === id); }

/**
 * Bandeau "🆕" affiché en tête d'article si le contenu Wiki a une mise à jour non vue par le joueur.
 * @returns {string} HTML du bandeau, ou chaîne vide si rien de nouveau
 */
function wkChangeCallout() {
  if (typeof contentIsUnread !== 'function' || !contentIsUnread('wiki')) return '';
  const entry = (typeof CONTENT_UPDATE_VERSION !== 'undefined') ? CONTENT_UPDATE_VERSION.wiki : null;
  if (!entry || !entry.desc) return '';
  return `<div class="wk-callout">🆕 ${wkEscape(entry.desc[LANG] || entry.desc.fr)}</div>`;
}
/** @param {*} s valeur à insérer dans du HTML @returns {string} version échappée (&,<,>,",') */
function wkEscape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/** @param {string} t texte de titre @returns {string} slug ancre (minuscules, sans accents/diacritiques, tirets) */
function wkSlug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

// ---- rendu de l'article actif (contenu réel uniquement) ----
/**
 * Rend le corps HTML de l'article correspondant à un item de nav, selon son `kind`
 * (home/tuto/codex/section/discord/link). Ne fait que dispatcher vers le contenu réel du jeu,
 * jamais de texte inventé ici.
 * @param {object} item item de nav (voir wkNavGroups)
 * @returns {string} HTML de l'article
 */
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
/** @returns {string} HTML de l'article d'accueil (résumé des systèmes de jeu, version courante) */
function wkHomeHtml() {
  const version = (typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES[0]) ? PATCH_NOTES[0].v : '';
  return `<p class="wk-lead">${i18next.t('backend:backend.wiki.home_lead')}</p>
    <h3>${i18next.t('backend:backend.wiki.home_systems_title')}</h3>
    <ul>
      <li><b>${i18next.t('backend:backend.wiki.nav_combat')}</b> — ${i18next.t('backend:backend.wiki.home_system_combat_desc')}</li>
      <li><b>${i18next.t('backend:backend.wiki.nav_enh')}</b> — +1 ${i18next.t('backend:backend.wiki.home_system_pen_word')} PEN, Pierre de Cron</li>
      <li><b>${i18next.t('backend:backend.wiki.nav_market')}</b> — ${i18next.t('backend:backend.wiki.home_system_market_desc')}</li>
      <li><b>${i18next.t('backend:backend.wiki.home_system_companions_title')}</b> — ${i18next.t('backend:backend.wiki.home_system_companions_desc')}</li>
    </ul>`;
}
// réutilise le vrai renderTutoPageHtml() (game-supabase.js) — pas de duplication du texte, et le
// bouton #btnStartTutoWiki qu'il génère reste câblé en bas de wkRenderArticleAndInfobox.
/** @returns {string} HTML de la page tutoriel, délégué à renderTutoPageHtml() (game-supabase.js), ou '' si indisponible */
function wkTutoHtml() {
  return typeof renderTutoPageHtml === 'function' ? renderTutoPageHtml() : '';
}
// lien réel (2026-07-21, corrigé : #btnDiscord dans le header du jeu a toujours eu un vrai lien
// d'invitation, jamais lu depuis ici -- cette page affirmait à tort "pas encore de serveur").
// URL sortie du template literal (pas de "//" brut dans un template multi-ligne, voir scripts/build.py
// -- "https://" au milieu d'un template literal multi-ligne a fait planter le strip de commentaires
// du build, une ligne entière avalée comme un commentaire // -- bug réel constaté le 2026-07-21).
const WK_DISCORD_URL = 'https:' + '//discord.gg/fEubtqMjtP';
/** @returns {string} HTML de la page Discord (intro + bouton d'invitation vers le vrai lien du serveur) */
function wkDiscordHtml() {
  const lead = i18next.t('backend:backend.wiki.discord_intro');
  const label = i18next.t('backend:backend.wiki.discord_join_button');
  return `<p class="wk-lead">${lead}</p>` +
    `<a class="wk-btn" href="${WK_DISCORD_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">💬 ${label}</a>`;
}

// ---- headings -> ancres pour le sommaire (les articles réels utilisent <h3>, pas <h2>) ----
/** @param {string} html corps d'article @returns {string} même HTML avec un `id` slug ajouté sur chaque `<h3>` */
function wkInjectHeadingIds(html) {
  return html.replace(/<h3>(.*?)<\/h3>/g, (m, txt) => `<h3 id="${wkSlug(txt.replace(/<[^>]+>/g,''))}">${txt}</h3>`);
}
/** @param {string} html corps d'article avec ids injectés @returns {Array<{id:string, txt:string}>} sommaire extrait des `<h3 id>` */
function wkExtractHeadings(html) {
  const out = []; const re = /<h3 id="([^"]+)">(.*?)<\/h3>/g; let m;
  while ((m = re.exec(html))) out.push({ id:m[1], txt:m[2].replace(/<[^>]+>/g,'') });
  return out;
}

/** @param {object} item item de nav actif @returns {Array<object>} jusqu'à 4 autres items du même groupe ("voir aussi") */
function wkRelated(item) {
  const group = wkNavGroups().find(g => g.items.some(it => it.id === item.id));
  return (group ? group.items : []).filter(it => it.id !== item.id).slice(0, 4);
}

/**
 * Construit le HTML de la colonne infobox (fiche article + sommaire + articles liés) affichée à
 * droite de l'article actif.
 * @param {object} item item de nav actif
 * @param {Array<{id:string, txt:string}>} headings sommaire extrait de l'article (wkExtractHeadings)
 * @returns {string} HTML de l'infobox
 */
function wkRenderInfobox(item, headings) {
  const isHome = item.kind === 'home';
  const rowsHtml = isHome ? `
      <div class="wk-ib-row"><span class="wk-ib-label">${i18next.t('backend:backend.wiki.infobox_developer_label')}</span><span class="wk-ib-val">Maxyull</span></div>
      <div class="wk-ib-row"><span class="wk-ib-label">${i18next.t('backend:backend.wiki.infobox_version_label')}</span><span class="wk-ib-val wk-gold">${wkEscape((typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES[0]) ? PATCH_NOTES[0].v : '—')}</span></div>
      <div class="wk-ib-row"><span class="wk-ib-label">${i18next.t('backend:backend.wiki.infobox_engine_label')}</span><span class="wk-ib-val">JS + Supabase</span></div>
      <div class="wk-ib-row"><span class="wk-ib-label">${i18next.t('backend:backend.wiki.infobox_license_label')}</span><span class="wk-ib-val">${i18next.t('backend:backend.wiki.infobox_license_value')}</span></div>` : '';
  const tocHtml = headings.length ? `
    <div class="wk-toc">
      <div class="wk-toc-title">${i18next.t('backend:backend.wiki.infobox_toc_title')}</div>
      ${headings.map(h => `<div class="wk-toc-item" data-id="${h.id}">${wkEscape(h.txt)}</div>`).join('')}
    </div>` : '';
  const related = wkRelated(item);
  const relatedHtml = related.length ? `
    <div class="wk-related-title">${i18next.t('backend:backend.wiki.infobox_related_title')}</div>
    ${related.map(it => `<div class="wk-related-item" data-nav="${it.id}"><span class="wk-related-ico">${it.ico}</span><span class="wk-related-name">${wkEscape(it.label)}</span></div>`).join('')}` : '';
  return `<div class="wk-infobox">
      <div class="wk-infobox-art">${item.ico}</div>
      <div class="wk-infobox-name">${wkEscape(item.label)}</div>
      <div class="wk-infobox-cat">${wkEscape(item.group || '')}</div>
      ${rowsHtml ? `<div class="wk-infobox-rows">${rowsHtml}</div>` : ''}
    </div>${tocHtml}${relatedHtml}`;
}

/**
 * Rend intégralement l'article actif et son infobox dans le DOM (#wkArticle/#wkInfoboxCol),
 * câble le bouton "démarrer le tutoriel", les clics sommaire/articles liés, et le suivi de
 * la section visible au scroll (surlignage du sommaire).
 * @param {object} item item de nav actif
 * @returns {void}
 */
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

/** @param {object} item item de nav actif — met à jour le fil d'ariane (#wkCrumb) @returns {void} */
function wkRenderBreadcrumb(item) {
  const el = document.getElementById('wkCrumb');
  el.innerHTML = `<span class="wk-crumb-link" data-nav="accueil">Wiki</span><span class="wk-sep">/</span>` +
    (item.id !== 'accueil' ? `<span class="wk-crumb-link" data-nav="__group__">${wkEscape(item.group || '')}</span><span class="wk-sep">/</span>` : '') +
    `<span class="wk-cur">${wkEscape(item.label)}</span>`;
  el.querySelectorAll('.wk-crumb-link').forEach(a => { if (a.dataset.nav === 'accueil') a.onclick = () => wkNavigate('accueil'); });
}

/** Reconstruit intégralement la sidebar de navigation (#wkNav) et câble les clics de chaque item. @returns {void} */
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

/**
 * Point d'entrée de navigation du Wiki : si l'item cible est un raccourci (`kind:'link'`), ferme
 * le panneau et ouvre le vrai panneau visé (Compagnons/Compendium/Patch notes) ; sinon met à jour
 * l'id courant et re-rend nav/breadcrumb/article/infobox.
 * @param {string} id identifiant d'item de nav
 * @returns {void}
 */
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
/** Ferme/retire le dropdown de résultats de recherche live s'il existe. @returns {void} */
function wkCloseSearch() { document.getElementById('wkSearchResults')?.remove(); }
/**
 * Recherche live sur les titres/groupes de la nav et affiche un dropdown de résultats cliquables
 * (ou un message "aucun résultat").
 * @param {string} q requête tapée par l'utilisateur
 * @returns {void}
 */
function wkRunSearch(q) {
  wkCloseSearch();
  q = q.trim().toLowerCase();
  if (!q) return;
  const matches = wkFlatItems().filter(it => it.label.toLowerCase().includes(q) || (it.group || '').toLowerCase().includes(q));
  const wrap = document.createElement('div');
  wrap.className = 'wk-search-results'; wrap.id = 'wkSearchResults';
  wrap.innerHTML = matches.length
    ? matches.map(it => `<div class="wk-sr-item" data-nav="${it.id}"><span class="wk-sr-ico">${it.ico}</span><span>${wkEscape(it.label)}${it.kind === 'link' ? ' ↗' : ''}</span></div>`).join('')
    : `<div class="wk-no-results">${i18next.t('backend:backend.wiki.search_no_results')} « ${wkEscape(q)} »</div>`;
  wrap.querySelectorAll('.wk-sr-item').forEach(el => { el.onmousedown = () => wkNavigate(el.dataset.nav); });
  document.getElementById('wkSearchWrap').appendChild(wrap);
}

/**
 * Construit la structure DOM de l'overlay Wiki (header/recherche/breadcrumb/nav/article/infobox)
 * et l'ajoute au `document.body`. Appelé une seule fois, à la première ouverture du panneau.
 * @returns {HTMLElement} l'élément overlay créé (#wikiOverlay)
 */
function wkBuildOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'wikiOverlay';
  overlay.innerHTML = `
    <div class="wk-hdr">
      <div class="wk-logo">◈ Velia Idle <span>Wiki</span></div>
      <div class="wk-search-wrap" id="wkSearchWrap">
        <span class="wk-search-ico">🔍</span>
        <input class="wk-search-box" id="wkSearchBox" placeholder="${i18next.t('backend:backend.wiki.search_placeholder')}">
      </div>
      <button class="wk-close" id="wkClose">✕ ${i18next.t('backend:backend.wiki.close_button')}</button>
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

/**
 * Ouvre le panneau Wiki : construit l'overlay/les styles au premier appel (lazy), le rend visible,
 * marque le contenu Wiki comme vu et navigue vers le dernier item consulté (`wkCurrentId`).
 * @returns {void}
 */
function openWikiPanel() {
  let overlay = document.getElementById('wikiOverlay');
  if (!overlay) { wkInjectStyles(); overlay = wkBuildOverlay(); }
  overlay.classList.add('open');
  if (typeof markContentSeen === 'function') markContentSeen('wiki');
  wkNavigate(wkCurrentId);
}
/** Ferme le panneau Wiki et rafraîchit le badge de patch notes du header. @returns {void} */
function closeWikiPanel() {
  document.getElementById('wikiOverlay')?.classList.remove('open');
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
}

/** Injecte le `<style>` du panneau Wiki dans le `<head>` une seule fois (no-op si déjà présent). @returns {void} */
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
