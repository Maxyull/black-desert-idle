// ═══ TES STATS + CLASSEMENT PUBLIC CROSS-JOUEURS (2026-07-20, demande explicite : "ajouter
// classement, oeuf ouvert, argent depensé..." — refonte 2026-07-21, port à l'identique du mockup
// externe classement-public.html/leaderboard-notes.md fourni par l'utilisateur, voir CLAUDE.md
// §30 "Maquettes externes") ═══════════════════════════════════════════════════════════════════
// "Tes stats" reste 100% local (aucun appel réseau) -- juste une lecture groupée de compteurs déjà
// suivis ailleurs (totalHatched, silverSpent, fusionCount...). Le classement, lui, appelle la RPC
// publique companion_leaderboard() (voir supabase/migrations/20260721100000_companion_leaderboard_prestige.sql)
// via le même pattern cross-window que sync.js (getSbClient()/getCurrentUserForSync()/
// isGuest() sur window.parent -- jamais de 2e SDK Supabase dans l'iframe).
//
// Écarts assumés par rapport au mockup fourni :
// - Onglet Guildes retiré : aucun système de guilde n'existe en jeu (src/social/chat.js). Pas de
//   filtre "Ma guilde" ni de segmented control saison/all-time : le jeu n'a pas de notion de
//   saison, une seule vue (records actuels).
// - Pas d'indicateur de mouvement ▲▼ : nécessiterait de stocker un rang précédent par snapshot,
//   qui n'existe pas côté serveur -- un delta inventé serait trompeur (voir leaderboard-notes.md,
//   ce point y est explicitement listé comme "backend uniquement, à traiter plus tard").
// - Couleurs : classes déjà existantes du module (`.chip`/`.search-box`/`.schip`/`.gs-badge`,
//   companions.css) réutilisées telles quelles plutôt que les couleurs codées en dur du mockup —
//   ce module a déjà son propre thème cohérent (voir companions/README.md), l'inclusion dans un
//   onglet existant (pas un overlay isolé comme le Wiki) rend une 2e palette parallèle incohérente
//   à l'écran plutôt que fidèle à l'esprit "identique" du mockup.

const LB_CATS = {
  prestige: { label:i18next.t('companions:companions.leaderboard.cat_prestige'), tip:i18next.t('companions:companions.leaderboard.cat_prestige_tip') },
  gs:       { label:i18next.t('companions:companions.leaderboard.cat_gs'),       tip:i18next.t('companions:companions.leaderboard.cat_gs_tip') },
  fusion:   { label:i18next.t('companions:companions.leaderboard.cat_fusion'),   tip:i18next.t('companions:companions.leaderboard.cat_fusion_tip') },
  ach:      { label:i18next.t('companions:companions.leaderboard.cat_ach'),      tip:i18next.t('companions:companions.leaderboard.cat_ach_tip') },
};
const LB_PAGE_SIZE = 15;
let lbRows = null; // cache de la réponse RPC (rafraîchie à chaque ouverture de l'onglet, pas à chaque interaction)
let lbCategory = 'prestige';
let lbSearch = '';
let lbShowMeOnly = false;
let lbPage = 1;
let lbMyUserId = null;
let lbError = null;

/** Rafraîchit l'onglet Classement : "Tes stats" (local) puis relance le fetch réseau du classement public. */
function renderMyStatsAndLeaderboard(){
  renderMyStatsGrid();
  fetchAndRenderCompanionLeaderboard();
}

/** Reconstruit la grille "Tes stats" (compteurs 100% locaux, aucun appel réseau). */
function renderMyStatsGrid(){
  const el = document.getElementById('my-stats-grid');
  if(!el) return;
  const indexProgress = companionIndexProgress(PETS);
  const tiles = [
    { ico:'🥚', lbl:i18next.t('companions:companions.leaderboard.tile_eggs'), val: fmtN(totalHatched||0) },
    { ico:'💰', lbl:i18next.t('companions:companions.leaderboard.tile_spent'), val: fmtN(silverSpent||0) },
    { ico:'🔗', lbl:i18next.t('companions:companions.leaderboard.tile_fusions'), val: fmtN(fusionCount||0) },
    { ico:'🌟', lbl:i18next.t('companions:companions.leaderboard.tile_breakthroughs'), val: fmtN(breakthroughCount||0) },
    // 2026-07-20, "Completion 48pet * 5 tier" -- espèce×tier distincts possédés / 240 (voir
    // companionIndexProgress()/COMPANION_INDEX_MAX, catalog.js)
    { ico:'📖', lbl:i18next.t('companions:companions.leaderboard.tile_index'), val: `${indexProgress}/${COMPANION_INDEX_MAX}` },
    { ico:'🏆', lbl:i18next.t('companions:companions.leaderboard.tile_achievements'), val: `${completedAchievements.size}/${ACHIEVEMENTS.length}` },
    { ico:'👑', lbl:i18next.t('companions:companions.leaderboard.tile_prestige'), val: fmtN(typeof prestigeScore==='function' ? prestigeScore() : 0) },
  ];
  el.innerHTML = tiles.map(t=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:9px 12px">
      <div style="font-size:10px;color:var(--cream2)">${t.ico} ${t.lbl}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:var(--gold)">${t.val}</div>
    </div>`).join('');
}
/** @param {number} n - nombre brut. @returns {string} nombre formaté avec séparateurs de milliers FR. */
function fmtN(n){ return n.toLocaleString(NUM_LOCALE); }
/** @param {object} row - ligne du classement (résultat RPC). @param {string} cat - clé de LB_CATS. @returns {number} valeur du joueur pour cette catégorie. */
function lbScoreOf(row, cat){ return cat==='prestige' ? Number(row.prestige_score||0) : cat==='gs' ? (row.gs_max||0) : cat==='fusion' ? (row.fusion_count||0) : (row.achievements_count||0); }
/** @param {string} cat - clé de LB_CATS. @returns {object[]} copie de lbRows triée par lbScoreOf décroissant. */
function lbSorted(cat){ return [...(lbRows||[])].sort((a,b)=>lbScoreOf(b,cat)-lbScoreOf(a,cat)); }
/** @param {number} rank - rang 1-based. @returns {string} emoji médaille pour le top 3, chaîne vide sinon. */
function lbMedal(rank){ return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':''; }

/** Appelle la RPC publique companion_leaderboard() via le client déjà authentifié de la page hôte (pattern cross-window de sync.js), gère les cas hors-iframe/déconnecté/invité, puis rend l'UI. */
async function fetchAndRenderCompanionLeaderboard(){
  const el = document.getElementById('companion-leaderboard');
  if(!el) return;
  lbError = null;
  el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">${i18next.t('companions:companions.common.loading')}</div>`;
  document.getElementById('lb-podium') && (document.getElementById('lb-podium').innerHTML = '');
  try{
    const hostWin = window.parent;
    if(!hostWin || hostWin===window){ lbError = i18next.t('companions:companions.leaderboard.unavailable_outside'); renderLeaderboardUi(); return; }
    const sb = typeof hostWin.getSbClient==='function' ? hostWin.getSbClient() : null;
    const currentUser = typeof hostWin.getCurrentUserForSync==='function' ? hostWin.getCurrentUserForSync() : null;
    const isGuestFn = hostWin.isGuest;
    if(!sb || !currentUser){ lbError = i18next.t('companions:companions.leaderboard.login_required'); renderLeaderboardUi(); return; }
    if(typeof isGuestFn==='function' && isGuestFn()){ lbError = i18next.t('companions:companions.leaderboard.guest_blocked'); renderLeaderboardUi(); return; }
    lbMyUserId = currentUser.id;
    const { data, error } = await sb.rpc('companion_leaderboard');
    if(error){ lbError = i18next.t('companions:companions.common.error_with_message', {message:escapeHtmlLb(error.message)}); renderLeaderboardUi(); return; }
    lbRows = data || [];
    renderLeaderboardUi();
  }catch(e){
    lbError = i18next.t('companions:companions.leaderboard.unavailable');
    renderLeaderboardUi();
  }
}

/** Reconstruit podium/contrôles/liste du classement depuis lbRows (cache) selon lbCategory/lbSearch/lbShowMeOnly/lbPage — gère les états erreur/vide/recherche sans résultat/pas encore synchronisé. */
function renderLeaderboardUi(){
  const el = document.getElementById('companion-leaderboard');
  const podiumEl = document.getElementById('lb-podium');
  const controlsEl = document.getElementById('lb-controls');
  if(!el) return;
  if(lbError){
    el.innerHTML = `<div style="font-size:11px;color:var(--red2);padding:12px">${escapeHtmlLb(lbError)}</div>`;
    if(podiumEl) podiumEl.innerHTML = '';
    if(controlsEl) controlsEl.innerHTML = '';
    return;
  }
  if(!lbRows || !lbRows.length){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">${i18next.t('companions:companions.leaderboard.nobody_synced')}</div>`;
    if(podiumEl) podiumEl.innerHTML = '';
    if(controlsEl) controlsEl.innerHTML = '';
    return;
  }
  if(controlsEl) controlsEl.innerHTML = lbControlsHtml();
  lbWireControls();
  const fullSorted = lbSorted(lbCategory);
  const rankMap = new Map(fullSorted.map((r,i)=>[r.user_id, i+1]));
  if(podiumEl) podiumEl.innerHTML = lbPodiumHtml(fullSorted.slice(0,3));

  let list = fullSorted;
  if(lbSearch.trim()){
    const t = lbSearch.trim().toLowerCase();
    list = list.filter(r => (r.display_name||'').toLowerCase().includes(t));
  }
  if(!list.length){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">${i18next.t('companions:companions.leaderboard.no_match')}</div>`;
    return;
  }
  if(lbShowMeOnly){
    const myRank = rankMap.get(lbMyUserId);
    if(!myRank){
      el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">${i18next.t('companions:companions.leaderboard.sync_first')}</div>`;
      return;
    }
    const idx = myRank - 1;
    const windowSlice = fullSorted.slice(Math.max(0, idx-3), idx+4);
    el.innerHTML = lbRowsHtml(windowSlice, rankMap) + `<div style="font-size:10px;color:var(--cream3);text-align:center;padding:8px 0">${i18next.t('companions:companions.leaderboard.rank_neighborhood', {rank:myRank})}</div>`;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / LB_PAGE_SIZE));
  if(lbPage > totalPages) lbPage = totalPages;
  const start = (lbPage-1)*LB_PAGE_SIZE;
  el.innerHTML = lbRowsHtml(list.slice(start, start+LB_PAGE_SIZE), rankMap) + lbPagerHtml(totalPages);
  lbWirePager(totalPages);
}

/** @returns {string} HTML des contrôles du classement (recherche, chips de catégorie, toggle "Ma position"). */
function lbControlsHtml(){
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
    <input class="search-box" id="lb-search" placeholder="${i18next.t('companions:companions.leaderboard.search_placeholder')}" value="${escapeHtmlLb(lbSearch)}" style="width:180px">
    <div style="display:flex;gap:6px">
      ${Object.entries(LB_CATS).map(([k,c])=>`<button class="chip ${k===lbCategory?'on':''}" data-lbcat="${k}">${escapeHtmlLb(c.label)}</button>`).join('')}
    </div>
    <button class="schip ${lbShowMeOnly?'on':''}" id="lb-me-toggle" style="margin-left:auto">${i18next.t('companions:companions.leaderboard.me_toggle')}</button>
  </div>`;
}
/** Câble les événements des contrôles du classement (recherche, chips de catégorie, toggle "Ma position"). */
function lbWireControls(){
  const search = document.getElementById('lb-search');
  if(search) search.oninput = e => { lbSearch = e.target.value; lbPage = 1; renderLeaderboardUi(); };
  document.querySelectorAll('[data-lbcat]').forEach(btn=>{
    btn.onclick = () => { lbCategory = btn.dataset.lbcat; lbPage = 1; renderLeaderboardUi(); };
  });
  const meToggle = document.getElementById('lb-me-toggle');
  if(meToggle) meToggle.onclick = () => { lbShowMeOnly = !lbShowMeOnly; renderLeaderboardUi(); };
}

/** @param {object[]} top3 - les 3 premiers du classement trié. @returns {string} HTML du podium (ordre visuel 2e/1er/3e), vide si aucun. */
function lbPodiumHtml(top3){
  if(!top3.length) return '';
  const cat = LB_CATS[lbCategory];
  const order = [1,0,2]; // 2e/1er/3e, comme un vrai podium
  return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:end;margin-bottom:14px">
    ${order.map(i=>{
      const r = top3[i]; if(!r) return '<div></div>';
      const rank = i+1;
      const isMe = r.user_id === lbMyUserId;
      return `<div style="order:${rank===1?2:rank===2?1:3};background:var(--s3);border:1px solid ${rank===1?'var(--gold-dim)':'var(--border)'};border-radius:10px;padding:${rank===1?'18px 10px 12px':'12px 10px'};text-align:center;${isMe?'outline:1px solid var(--gold)':''}">
        <div style="font-family:'Cinzel',serif;font-size:${rank===1?'20px':'16px'};color:${rank===1?'var(--gold2)':'var(--cream2)'}">${lbMedal(rank)} #${rank}</div>
        <div style="font-size:11px;color:var(--cream);margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtmlLb(r.display_name||'?')}${isMe?' <span style="color:var(--gold2)">'+i18next.t('companions:companions.leaderboard.you_suffix')+'</span>':''}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--gold2)">${fmtN(lbScoreOf(r,lbCategory))}</div>
      </div>`;
    }).join('')}
  </div>
  <div style="font-size:9px;color:var(--cream3);margin:-8px 0 12px;display:flex;align-items:center;gap:4px" title="${escapeHtmlLb(cat.tip)}">ⓘ ${escapeHtmlLb(cat.label)} — ${i18next.t('companions:companions.leaderboard.hover_hint')}</div>`;
}

/** @param {object[]} rows - lignes à afficher (déjà paginées/filtrées). @param {Map} rankMap - user_id -> rang dans le classement complet. @returns {string} HTML de la table du classement. */
function lbRowsHtml(rows, rankMap){
  const cat = LB_CATS[lbCategory];
  return `<table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr>
      <th style="text-align:left;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">#</th>
      <th style="text-align:left;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">${i18next.t('companions:companions.leaderboard.col_player')}</th>
      <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">${escapeHtmlLb(cat.label)}</th>
      <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">${i18next.t('companions:companions.leaderboard.col_pets')}</th>
      <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">${i18next.t('companions:companions.leaderboard.col_index')}</th>
    </tr></thead>
    <tbody>${rows.map(r=>{
      const rank = rankMap.get(r.user_id);
      const isYou = r.user_id === lbMyUserId;
      return `<tr style="${isYou?'background:rgba(212,169,85,.1)':''}">
        <td style="padding:5px 8px;border-bottom:1px solid var(--border);color:${rank<=3?'var(--gold)':'var(--cream2)'}">${lbMedal(rank)||('#'+rank)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid var(--border);color:${isYou?'var(--gold)':'var(--cream)'}">${escapeHtmlLb(r.display_name||'?')}${isYou?' '+i18next.t('companions:companions.leaderboard.you_suffix'):''}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--gold2);font-family:'JetBrains Mono',monospace">${fmtN(lbScoreOf(r,lbCategory))}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${fmtN(r.pet_count||0)}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${r.unique_species_count||0}/${COMPANION_INDEX_MAX}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}
/** @param {number} totalPages - nombre total de pages. @returns {string} HTML du pager Précédent/Suivant (vide si 1 seule page). */
function lbPagerHtml(totalPages){
  if(totalPages<=1) return '';
  return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 0">
    <button class="schip" id="lb-prev" ${lbPage<=1?'disabled':''}>${i18next.t('companions:companions.leaderboard.prev_btn')}</button>
    <span style="font-size:10px;color:var(--cream3)">Page ${lbPage} / ${totalPages}</span>
    <button class="schip" id="lb-next" ${lbPage>=totalPages?'disabled':''}>${i18next.t('companions:companions.leaderboard.next_btn')}</button>
  </div>`;
}
/** @param {number} totalPages - nombre total de pages. Câble les boutons Précédent/Suivant du pager. */
function lbWirePager(totalPages){
  const prev = document.getElementById('lb-prev'), next = document.getElementById('lb-next');
  if(prev) prev.onclick = () => { lbPage--; renderLeaderboardUi(); };
  if(next) next.onclick = () => { lbPage++; renderLeaderboardUi(); };
}
/** @param {*} s - texte potentiellement fourni par un autre joueur (pseudo). @returns {string} version échappée sûre pour insertion HTML. */
function escapeHtmlLb(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
