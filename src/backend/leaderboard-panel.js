// ============================================================
// CLASSEMENT PUBLIC (jeu principal) — panneau enrichi (2026-07-11, demande explicite : "fait le
// meme classement [que le Classement Public Compagnons] avec toute les infos global du menu a
// gauche") ═══════════════════════════════════════════════════════════════════════════════════
// Reprend le même traitement que leaderboard.js (podium top 3, catégories en onglets,
// recherche, pagination, "Ma position") mais appliqué au VRAI classement du jeu principal
// (table `player_stats`, déjà alimentée par syncPlayerStats() -- records À VIE, jamais un
// instantané, voir le commentaire au-dessus de cette fonction dans game-supabase.js) : les 7
// catégories existantes (Silver/Gearscore/Zone/Silver-heure/Kills-min/Meilleur objet/Trésors)
// sont conservées telles quelles, aucune nouvelle donnée inventée.
//
// Contrairement au Wiki (overlay isolé, couleurs de mockup à l'identique) ou au module Compagnons
// (iframe avec son propre thème), ce panneau vit DANS le chrome du jeu principal (bouton
// #btnLeaderboard au milieu des autres boutons déjà stylés) -- il réutilise donc les vraies
// variables CSS déjà en place (var(--gold)/var(--ink)/var(--panel)...) et les classes existantes
// (.admTable, .bossPodium/.bossPodiumStep, .catTab) plutôt qu'une palette séparée.
//
// Textes via i18next (2026-07-11, migré après coup pour rejoindre le chantier docs/I18N_PLAN.md en
// cours en parallèle -- clés dans locales/{fr,en}/backend.json, préfixe backend.leaderboard.*).

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
  };
}
const LB2_PAGE_SIZE = 15;
let lb2Rows = null;
let lb2Cat = 'silver';
let lb2Search = '';
let lb2ShowMeOnly = false;
let lb2Page = 1;
let lb2Error = null;

function lb2Medal(rank) { return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':''; }
function lb2Sorted(cat) {
  const info = LB2_CATS_()[cat];
  const rows = info.filter ? lb2Rows.filter(info.filter) : lb2Rows;
  return [...rows].sort((a,b) => info.val(b) - info.val(a));
}

async function openLeaderboard2() {
  if (!marketRequireAuth()) return;
  lb2Error = null;
  openInfo(i18next.t('backend:backend.leaderboard.panel_title'), lb2ShellHtml());
  const { data, error } = await sb.from('player_stats').select('*').limit(500);
  if (error) { lb2Error = error.message; lb2RenderBody(); return; }
  lb2Rows = data || [];
  lb2RenderBody();
}

function lb2ShellHtml() {
  return `<div id="lb2Podium"></div>
    <div id="lb2Controls"></div>
    <div id="lb2Body"><div class="admEmpty">${escapeHtml(i18next.t('backend:backend.gear.loading'))}</div></div>`;
}

function lb2ControlsHtml() {
  const cats = LB2_CATS_();
  const tabs = Object.entries(cats).map(([k,c]) =>
    `<button class="catTab${k===lb2Cat?' active':''}" data-lb2cat="${k}" title="${escapeHtml(c.tip)}">${c.icon} ${escapeHtml(c.label)}</button>`).join('');
  return `<div class="catTabs">${tabs}</div>
    <div class="lb2ToolRow">
      <input type="text" id="lb2Search" class="lb2SearchBox" placeholder="${escapeHtml(i18next.t('backend:backend.leaderboard.search_placeholder'))}" value="${escapeHtml(lb2Search)}">
      <button class="lb2MeToggle${lb2ShowMeOnly?' on':''}" id="lb2MeToggle">${escapeHtml(i18next.t('backend:backend.leaderboard.me_toggle'))}</button>
    </div>`;
}

function lb2RenderBody() {
  const podiumEl = $a('lb2Podium'), controlsEl = $a('lb2Controls'), bodyEl = $a('lb2Body');
  if (!bodyEl) return; // panneau refermé entre-temps
  if (lb2Error) {
    podiumEl.innerHTML = ''; controlsEl.innerHTML = '';
    bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml(lb2Error)}</div>`;
    return;
  }
  if (!lb2Rows) { bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml(i18next.t('backend:backend.gear.loading'))}</div>`; return; }

  controlsEl.innerHTML = lb2ControlsHtml();
  lb2WireControls();

  const fullSorted = lb2Sorted(lb2Cat);
  const rankMap = new Map(fullSorted.map((r,i) => [r.user_id, i+1]));
  podiumEl.innerHTML = lb2PodiumHtml(fullSorted.slice(0,3));
  wirePlayerNameLinks();

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

function lb2WireControls() {
  const search = $a('lb2Search');
  if (search) search.oninput = e => { lb2Search = e.target.value; lb2Page = 1; lb2RenderBody(); };
  document.querySelectorAll('[data-lb2cat]').forEach(btn => {
    btn.onclick = () => { lb2Cat = btn.dataset.lb2cat; lb2Page = 1; lb2RenderBody(); };
  });
  const meToggle = $a('lb2MeToggle');
  if (meToggle) meToggle.onclick = () => { lb2ShowMeOnly = !lb2ShowMeOnly; lb2RenderBody(); };
}

function lb2PodiumHtml(top3) {
  if (!top3.length) return '';
  const info = LB2_CATS_()[lb2Cat];
  const order = [1,0,2]; // 2e/1er/3e, ordre visuel classique (voir .bossPodium)
  return `<div class="bossPodium">${order.map(i => {
    const r = top3[i]; if (!r) return '';
    const rank = i+1;
    const isYou = r.user_id === currentUser?.id;
    return `<div class="bossPodiumStep rank${rank}${isYou?' lb2You':''}">
      <div class="bossPodiumMedal">${lb2Medal(rank)}</div>
      <div class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}" style="font-size:11px;color:var(--ink);cursor:pointer">${escapeHtml(r.display_name||'?')}${isYou?` ${escapeHtml(i18next.t('backend:backend.leaderboard.you_suffix'))}`:''}</div>
      <div class="bossPodiumReward" style="color:var(--gold)">${escapeHtml(info.fmt(r))}</div>
    </div>`;
  }).join('')}</div>`;
}

function lb2TableHtml(rows, rankMap) {
  const info = LB2_CATS_()[lb2Cat];
  return `<table class="admTable"><thead><tr><th>#</th><th>${escapeHtml(i18next.t('backend:backend.common.player_label'))}</th><th>${escapeHtml(info.label)}</th></tr></thead>
    <tbody>${rows.map(r => {
      const rank = rankMap.get(r.user_id);
      const isYou = r.user_id === currentUser?.id;
      return `<tr class="admPlayerRow${isYou?' isYou':''}${rank<=3?' admTop':''}">
        <td>${lb2Medal(rank)||('#'+rank)}</td>
        <td><span class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}">${escapeHtml(r.display_name||'?')}${isYou?` ${escapeHtml(i18next.t('backend:backend.leaderboard.you_suffix'))}`:''}</span></td>
        <td>${info.fmt(r)}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}
function lb2PagerHtml(totalPages) {
  if (totalPages<=1) return '';
  return `<div class="lb2Pager">
    <button class="lb2PagerBtn" id="lb2Prev" ${lb2Page<=1?'disabled':''}>${escapeHtml(i18next.t('backend:backend.leaderboard.pager_prev'))}</button>
    <span class="lb2PagerNum">${escapeHtml(i18next.t('backend:backend.leaderboard.pager_page'))} ${lb2Page} / ${totalPages}</span>
    <button class="lb2PagerBtn" id="lb2Next" ${lb2Page>=totalPages?'disabled':''}>${escapeHtml(i18next.t('backend:backend.leaderboard.pager_next'))}</button>
  </div>`;
}
function lb2WirePager(totalPages) {
  const prev = $a('lb2Prev'), next = $a('lb2Next');
  if (prev) prev.onclick = () => { lb2Page--; lb2RenderBody(); };
  if (next) next.onclick = () => { lb2Page++; lb2RenderBody(); };
}
