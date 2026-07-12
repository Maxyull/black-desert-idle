// ============================================================
// CLASSEMENT PUBLIC (jeu principal) — panneau enrichi (2026-07-11, demande explicite : "fait le
// meme classement [que le Classement Public Compagnons] avec toute les infos global du menu a
// gauche") ═══════════════════════════════════════════════════════════════════════════════════
// Reprend le même traitement que leaderboard.js (podium top 3, catégories en onglets,
// recherche, pagination, "Ma position") mais appliqué au VRAI classement du jeu principal
// (table `player_stats`, déjà alimentée par syncPlayerStats() -- records À VIE, jamais un
// instantané, voir le commentaire au-dessus de cette fonction dans game-supabase.js) : les 7
// catégories d'origine (Silver/Gearscore/Zone/Silver-heure/Kills-min/Meilleur objet/Trésors)
// sont conservées telles quelles, aucune donnée existante modifiée -- + une 8e catégorie
// Compendium ajoutée le 2026-07-11 (voir plus bas), sur le même modèle.
//
// Contrairement au Wiki (overlay isolé, couleurs de mockup à l'identique) ou au module Compagnons
// (iframe avec son propre thème), ce panneau vit DANS le chrome du jeu principal (bouton
// #btnLeaderboard au milieu des autres boutons déjà stylés) -- il réutilise donc les vraies
// variables CSS déjà en place (var(--gold)/var(--ink)/var(--panel)...) et les classes existantes
// (.admTable, .bossPodium/.bossPodiumStep, .catTab) plutôt qu'une palette séparée.
//
// Textes via i18next (2026-07-11, migré après coup pour rejoindre le chantier docs/I18N_PLAN.md en
// cours en parallèle -- clés dans locales/{fr,en}/backend.json, préfixe backend.leaderboard.*).
//
// 2026-07-11 (demande explicite, reskin + refonte "Classement" -- mockup validé itérativement
// avec l'utilisateur) : catégorie Compendium (r.compendium_pct, déjà calculée par
// compendiumOverallPct()/game-core.js et déjà envoyée à chaque sync -- jamais utilisée par un
// classement avant), barre "Ta position" quand le joueur est hors du top LB2_TOP_N (rang réel
// calculé sur les jusqu'à 500 lignes déjà chargées, aucune requête supplémentaire), "vu il y a
// Xmin/Xj" par ligne (podium ET tableau) via player_stats.updated_at, et remplacement de l'alerte
// navigateur brute (marketRequireAuth()) par un panneau invité stylé (lb2GuestGateHtml()) --
// réutilise le texte EXACT de market:market.auth_verified_required et le VRAI bouton
// #btnLinkAccount (game-supabase.js) plutôt que de dupliquer le flux de liaison de compte.
// market.js n'est PAS modifié : marketRequireAuth() garde son alert() pour le Marché, ce fichier
// fait sa propre vérification isGuest()/currentUser (mêmes globals déjà lus par
// marketRequireAuth(), pas une nouvelle logique).

/** @returns {object} définitions des 8 catégories du classement public (icône, label, formateur, extracteur de valeur), recalculées à chaque appel pour suivre i18next.t() en direct. */
function LB2_CATS_() {
  return {
    silver:   { icon:'💰', label:i18next.t('backend:backend.leaderboard.cat_silver_label'), tip:i18next.t('backend:backend.leaderboard.cat_silver_tip'),
      val:r=>Number(r.silver||0), fmt:r=>fmt(r.silver||0) },
    gs:       { icon:'⚔️', label:i18next.t('backend:backend.leaderboard.cat_gs_label'), tip:i18next.t('backend:backend.leaderboard.cat_gs_tip'),
      val:r=>Number(r.gearscore||0), fmt:r=>`${Math.round(r.gearscore||0)} (${(r.ap||0).toFixed(1)}/${(r.dp||0).toFixed(1)})` },
    zone:     { icon:'🗺️', label:i18next.t('backend:backend.leaderboard.cat_zone_label'), tip:i18next.t('backend:backend.leaderboard.cat_zone_tip'),
      val:r=>Number(r.best_zone_index||0), fmt:r=>tr(r.best_zone_name||'—') },
    sh:       { icon:'⏱️', label:i18next.t('backend:backend.leaderboard.cat_sh_label'), tip:i18next.t('backend:backend.leaderboard.cat_sh_tip'),
      val:r=>Number(r.silver_per_hour||0), fmt:r=>`${fmt(r.silver_per_hour||0)}/h · ${tr(r.best_zone_name||'—')}` },
    kpm:      { icon:'🏹', label:i18next.t('backend:backend.leaderboard.cat_kpm_label'), tip:i18next.t('backend:backend.leaderboard.cat_kpm_tip'),
      val:r=>Number(r.best_kpm||0), fmt:r=>`${(r.best_kpm||0).toFixed(1)}/min · ${tr(r.best_zone_name||'—')}` },
    item:     { icon:'🎯', label:i18next.t('backend:backend.leaderboard.cat_item_label'), tip:i18next.t('backend:backend.leaderboard.cat_item_tip'),
      val:r=>Number(r.best_item_count||0), fmt:r=>`${tr(r.best_item_name||'—')} (${fmt(r.best_item_count||0)})`, filter:r=>!!r.best_item_name },
    treasure: { icon:'🗺️', label:i18next.t('backend:backend.leaderboard.cat_treasure_label'), tip:i18next.t('backend:backend.leaderboard.cat_treasure_tip'),
      val:r=>Number(r.treasure_count||0), fmt:r=>fmt(r.treasure_count||0) },
    // 8e catégorie (2026-07-11) : compendium_pct est un entier 0-100, déjà monotone (zones/boss/PEN
    // ne font QUE monter, voir le commentaire au-dessus de compendium_pct dans syncPlayerStats(),
    // game-supabase.js) -- pas besoin d'un "best_compendium_pct" séparé, la valeur courante suffit.
    compendium: { icon:'🧭', label:i18next.t('backend:backend.leaderboard.cat_compendium_label'), tip:i18next.t('backend:backend.leaderboard.cat_compendium_tip'),
      val:r=>Number(r.compendium_pct||0), fmt:r=>`${Math.round(r.compendium_pct||0)}%`, isNew:true },
  };
}
const LB2_PAGE_SIZE = 15;
// seuil "top" affiché en podium+tableau immédiat avant pagination -- au-delà, la barre "Ta
// position" prend le relais plutôt que de forcer à paginer pour se retrouver (voir lb2RenderBody).
const LB2_TOP_N = 20;
let lb2Rows = null;
let lb2Cat = 'silver';
let lb2Search = '';
let lb2ShowMeOnly = false;
let lb2Page = 1;
let lb2Error = null;

/** @param {number} rank. @returns {string} médaille (🥇🥈🥉) pour les 3 premiers, '' sinon. */
function lb2Medal(rank) { return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':''; }
// rows optionnel (défaut : lb2Rows, l'état réel du panneau) -- garder ce paramètre permet de
// tester lb2Sorted()/lb2ComputeYourRankInfo() avec des données fabriquées, sans dépendre de l'état
// mutable du module (voir tests/tests.js, testLb2ComputeYourRankInfoFindsRealRankOutsideTop20).
/** @param {string} cat - clé LB2_CATS_. @param {object[]} [rows] - défaut lb2Rows. @returns {object[]} lignes filtrées (si la catégorie a un filter) et triées décroissant par valeur de catégorie. */
function lb2Sorted(cat, rows) {
  const info = LB2_CATS_()[cat];
  const source = rows || lb2Rows;
  const filtered = info.filter ? source.filter(info.filter) : source;
  return [...filtered].sort((a,b) => info.val(b) - info.val(a));
}
// rang réel (1-based) + nombre total de joueurs classés dans cette catégorie (après filtre
// éventuel de la catégorie, ex: item.filter) -- null si le joueur n'a pas encore de record
// synchronisé. Fonction PURE (ne lit aucun état module) pour rester facilement testable.
/** @param {object[]} rows @param {string} cat @param {string} userId. @returns {{rank:number,total:number}|null} rang réel (1-based) + total classé dans cette catégorie, null si pas de record. Fonction pure. */
function lb2ComputeYourRankInfo(rows, cat, userId) {
  if (!userId) return null;
  const sorted = lb2Sorted(cat, rows);
  const idx = sorted.findIndex(r => r.user_id === userId);
  if (idx === -1) return null;
  return { rank: idx+1, total: sorted.length };
}
// "vu il y a Xmin/Xj" (2026-07-11) -- calcul pur depuis player_stats.updated_at, déjà récupéré via
// .select('*') (aucun nouveau champ). Réutilise pneRelativeTime() (progression/patch-notes-engage-
// react.js, charge AVANT ce fichier -- voir index.dev.html) plutôt que dupliquer un formatage
// relatif de plus (cmTimeAgo dans market.js fait un calcul voisin mais sans i18next).
/** @param {string} updatedAtIso. @returns {{text:string,recent:boolean}|null} "vu il y a Xmin/Xj" formaté, recent=vrai si <1h, null si date invalide. */
function lb2SeenInfo(updatedAtIso) {
  if (!updatedAtIso) return null;
  const ts = new Date(updatedAtIso).getTime();
  if (Number.isNaN(ts)) return null;
  const recent = (Date.now() - ts) < 3600000; // moins d'1h (vert, voir styles.css .lb2Seen.recent)
  const time = typeof pneRelativeTime === 'function' ? pneRelativeTime(ts) : '';
  return { text: i18next.t('backend:backend.leaderboard.seen_label', { time }), recent };
}

// invité (compte anonyme) : panneau stylé réutilisant le texte EXACT de marketRequireAuth() (voir
// market.js) et le VRAI bouton de liaison de compte (#btnLinkAccount, game-supabase.js) --
// n'appelle PAS marketRequireAuth() ici (son alert() reste réservé au cas "aucune session du
// tout", ci-dessous) pour ne pas déclencher son alert() natif sur le cas invité qu'on veut styliser.
/** @returns {string} HTML du panneau invité stylé (compte anonyme), réutilise le texte de marketRequireAuth() et le vrai bouton de liaison de compte. */
function lb2GuestGateHtml() {
  return `<div class="lb2GuestGate">
    <div class="lb2GuestIcon">🔒</div>
    <div class="lb2GuestTxt">${escapeHtml(i18next.t('market:market.auth_verified_required'))}</div>
    <button class="lb2GuestBtn" id="lb2LinkAccountBtn">${escapeHtml(i18next.t('backend:backend.leaderboard.link_account_button'))}</button>
  </div>`;
}
/** Câble le bouton du panneau invité (délègue au vrai bouton #btnLinkAccount, jamais de logique dupliquée). */
function lb2WireGuestGate() {
  const btn = $a('lb2LinkAccountBtn');
  // délègue au VRAI bouton de liaison de compte déjà câblé (game-supabase.js) plutôt que de
  // réimplémenter showAuthOverlay(true)/authSub ici -- un seul endroit source de vérité pour ce flux.
  if (btn) btn.onclick = () => { const real = $a('btnLinkAccount'); if (real) real.click(); };
}

/** Ouvre le panneau Classement public : panneau invité si compte anonyme, sinon charge player_stats (jusqu'à 500 lignes) et rend le corps. */
async function openLeaderboard2() {
  if (!sb || !currentUser) { marketRequireAuth(); return; } // aucune session du tout (cas rare) -- alerte historique conservée
  if (isGuest()) {
    openInfo(i18next.t('backend:backend.leaderboard.panel_title'), lb2GuestGateHtml());
    lb2WireGuestGate();
    return;
  }
  lb2Error = null;
  openInfo(i18next.t('backend:backend.leaderboard.panel_title'), lb2ShellHtml());
  const { data, error } = await sb.from('player_stats').select('*').limit(500);
  if (error) { lb2Error = error.message; lb2RenderBody(); return; }
  lb2Rows = data || [];
  lb2RenderBody();
}

/** @returns {string} coquille statique du panneau (podium/ta-position/contrôles/corps vides, remplis ensuite par lb2RenderBody). */
function lb2ShellHtml() {
  return `<div class="lb2Summary">${escapeHtml(i18next.t('backend:backend.leaderboard.summary'))}</div>
    <div id="lb2Podium"></div>
    <div id="lb2YourRank"></div>
    <div id="lb2Controls"></div>
    <div id="lb2Body"><div class="admEmpty">${escapeHtml(i18next.t('backend:backend.gear.loading'))}</div></div>`;
}

/** @param {number} total - joueurs classés dans la catégorie active. @returns {string} HTML des onglets de catégorie + recherche + bouton "Ma position". */
function lb2ControlsHtml(total) {
  const cats = LB2_CATS_();
  const tabs = Object.entries(cats).map(([k,c]) =>
    `<button class="catTab${k===lb2Cat?' active':''}" data-lb2cat="${k}" title="${escapeHtml(c.tip)}">${c.icon} ${escapeHtml(c.label)}${c.isNew?` <span class="patchNewTag">${escapeHtml(i18next.t('backend:backend.leaderboard.new_tag'))}</span>`:''}</button>`).join('');
  return `<div class="catTabs">${tabs}</div>
    <div class="lb2RankedCount">${escapeHtml(i18next.t('backend:backend.leaderboard.ranked_count', { count: total }))}</div>
    <div class="lb2ToolRow">
      <input type="text" id="lb2Search" class="lb2SearchBox" placeholder="${escapeHtml(i18next.t('backend:backend.leaderboard.search_placeholder'))}" value="${escapeHtml(lb2Search)}">
      <button class="lb2MeToggle${lb2ShowMeOnly?' on':''}" id="lb2MeToggle">${escapeHtml(i18next.t('backend:backend.leaderboard.me_toggle'))}</button>
    </div>`;
}

/** Reconstruit tout le corps du panneau Classement (podium, barre "Ta position", contrôles, tableau paginé ou voisinage de rang selon lb2ShowMeOnly) depuis l'état module (lb2Rows/lb2Cat/lb2Search/lb2Page). */
function lb2RenderBody() {
  const podiumEl = $a('lb2Podium'), yourRankEl = $a('lb2YourRank'), controlsEl = $a('lb2Controls'), bodyEl = $a('lb2Body');
  if (!bodyEl) return; // panneau refermé entre-temps
  if (lb2Error) {
    podiumEl.innerHTML = ''; if (yourRankEl) yourRankEl.innerHTML = ''; controlsEl.innerHTML = '';
    bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml(lb2Error)}</div>`;
    return;
  }
  if (!lb2Rows) { bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml(i18next.t('backend:backend.gear.loading'))}</div>`; return; }

  const fullSorted = lb2Sorted(lb2Cat);
  const rankMap = new Map(fullSorted.map((r,i) => [r.user_id, i+1]));

  controlsEl.innerHTML = lb2ControlsHtml(fullSorted.length);
  lb2WireControls();

  podiumEl.innerHTML = lb2PodiumHtml(fullSorted.slice(0,3));
  wirePlayerNameLinks();

  // "Ta position" (2026-07-11, demande explicite) : rang réel hors du top LB2_TOP_N, calculé sur
  // TOUTES les lignes déjà chargées (fullSorted), pas seulement la page affichée. Masquée en mode
  // "Ma position" (lb2ShowMeOnly) qui montre déjà le voisinage du rang -- doublon sinon.
  if (yourRankEl) {
    const myRankInfo = lb2ComputeYourRankInfo(lb2Rows, lb2Cat, currentUser?.id);
    if (!lb2ShowMeOnly && myRankInfo && myRankInfo.rank > LB2_TOP_N) {
      const info = LB2_CATS_()[lb2Cat];
      const myRow = fullSorted[myRankInfo.rank-1];
      yourRankEl.innerHTML = `<div class="lb2YourRankBar">
        <span>${escapeHtml(i18next.t('backend:backend.leaderboard.your_position_label'))}</span>
        <span class="rk">#${myRankInfo.rank}</span>
        <span>· ${escapeHtml(info.fmt(myRow))}</span>
        <span class="hint">${escapeHtml(i18next.t('backend:backend.leaderboard.your_position_hint', { count: myRankInfo.total }))}</span>
      </div>`;
    } else {
      yourRankEl.innerHTML = '';
    }
  }

  let list = fullSorted;
  if (lb2Search.trim()) {
    const t = lb2Search.trim().toLowerCase();
    list = list.filter(r => (r.display_name||'').toLowerCase().includes(t));
  }
  if (!list.length) {
    bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml(i18next.t('backend:backend.leaderboard.no_search_match'))}</div>`;
    return;
  }
  if (lb2ShowMeOnly) {
    const myRank = rankMap.get(currentUser?.id);
    if (!myRank) {
      bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml(i18next.t('backend:backend.leaderboard.no_record_yet'))}</div>`;
      return;
    }
    const idx = myRank - 1;
    bodyEl.innerHTML = lb2TableHtml(fullSorted.slice(Math.max(0, idx-3), idx+4), rankMap) +
      `<div class="admSummary" style="text-align:center">${escapeHtml(i18next.t('backend:backend.leaderboard.rank_neighborhood'))} (#${myRank})</div>`;
    wirePlayerNameLinks();
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / LB2_PAGE_SIZE));
  if (lb2Page > totalPages) lb2Page = totalPages;
  const start = (lb2Page-1)*LB2_PAGE_SIZE;
  bodyEl.innerHTML = lb2TableHtml(list.slice(start, start+LB2_PAGE_SIZE), rankMap) + lb2PagerHtml(totalPages);
  wirePlayerNameLinks();
  lb2WirePager(totalPages);
}

/** Câble la recherche, les onglets de catégorie et le bouton "Ma position" du panneau Classement. */
function lb2WireControls() {
  const search = $a('lb2Search');
  if (search) search.oninput = e => { lb2Search = e.target.value; lb2Page = 1; lb2RenderBody(); };
  document.querySelectorAll('[data-lb2cat]').forEach(btn => {
    btn.onclick = () => { lb2Cat = btn.dataset.lb2cat; lb2Page = 1; lb2RenderBody(); };
  });
  const meToggle = $a('lb2MeToggle');
  if (meToggle) meToggle.onclick = () => { lb2ShowMeOnly = !lb2ShowMeOnly; lb2RenderBody(); };
}

/** @param {object[]} top3 - 3 meilleures lignes triées. @returns {string} HTML du podium (ordre visuel 2e/1er/3e). */
function lb2PodiumHtml(top3) {
  if (!top3.length) return '';
  const info = LB2_CATS_()[lb2Cat];
  const order = [1,0,2]; // 2e/1er/3e, ordre visuel classique (voir .bossPodium)
  return `<div class="bossPodium">${order.map(i => {
    const r = top3[i]; if (!r) return '';
    const rank = i+1;
    const isYou = r.user_id === currentUser?.id;
    const seen = lb2SeenInfo(r.updated_at);
    return `<div class="bossPodiumStep rank${rank}${isYou?' lb2You':''}">
      <div class="bossPodiumMedal">${lb2Medal(rank)}</div>
      <div class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}" style="font-size:11px;color:var(--ink);cursor:pointer">${escapeHtml(r.display_name||'?')}${isYou?` ${escapeHtml(i18next.t('backend:backend.leaderboard.you_suffix'))}`:''}</div>
      <div class="bossPodiumReward" style="color:var(--gold)">${escapeHtml(info.fmt(r))}</div>
      ${seen ? `<div class="lb2Seen lb2PodSeen${seen.recent?' recent':''}">${escapeHtml(seen.text)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/** @param {object[]} rows - lignes à afficher (déjà paginées/filtrées). @param {Map} rankMap - user_id → rang réel. @returns {string} HTML du tableau de classement. */
function lb2TableHtml(rows, rankMap) {
  const info = LB2_CATS_()[lb2Cat];
  return `<table class="admTable"><thead><tr><th>#</th><th>${escapeHtml(i18next.t('backend:backend.common.player_label'))}</th><th>${escapeHtml(info.label)}</th></tr></thead>
    <tbody>${rows.map(r => {
      const rank = rankMap.get(r.user_id);
      const isYou = r.user_id === currentUser?.id;
      const seen = lb2SeenInfo(r.updated_at);
      return `<tr class="admPlayerRow${isYou?' isYou':''}${rank<=3?' admTop':''}">
        <td>${lb2Medal(rank)||('#'+rank)}</td>
        <td><span class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}">${escapeHtml(r.display_name||'?')}${isYou?` ${escapeHtml(i18next.t('backend:backend.leaderboard.you_suffix'))}`:''}</span>${seen?`<span class="lb2Seen${seen.recent?' recent':''}">${escapeHtml(seen.text)}</span>`:''}</td>
        <td>${info.fmt(r)}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}
/** @param {number} totalPages. @returns {string} HTML du pager (précédent/page N sur M/suivant), '' si une seule page. */
function lb2PagerHtml(totalPages) {
  if (totalPages<=1) return '';
  return `<div class="lb2Pager">
    <button class="lb2PagerBtn" id="lb2Prev" ${lb2Page<=1?'disabled':''}>${escapeHtml(i18next.t('backend:backend.leaderboard.pager_prev'))}</button>
    <span class="lb2PagerNum">${escapeHtml(i18next.t('backend:backend.leaderboard.pager_page'))} ${lb2Page} / ${totalPages}</span>
    <button class="lb2PagerBtn" id="lb2Next" ${lb2Page>=totalPages?'disabled':''}>${escapeHtml(i18next.t('backend:backend.leaderboard.pager_next'))}</button>
  </div>`;
}
/** @param {number} totalPages. Câble les boutons précédent/suivant du pager. */
function lb2WirePager(totalPages) {
  const prev = $a('lb2Prev'), next = $a('lb2Next');
  if (prev) prev.onclick = () => { lb2Page--; lb2RenderBody(); };
  if (next) next.onclick = () => { lb2Page++; lb2RenderBody(); };
}
