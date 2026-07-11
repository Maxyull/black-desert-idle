// ============================================================
// CLASSEMENT PUBLIC (jeu principal) — panneau enrichi (2026-07-11, demande explicite : "fait le
// meme classement [que le Classement Public Compagnons] avec toute les infos global du menu a
// gauche") ═══════════════════════════════════════════════════════════════════════════════════
// Reprend le même traitement que companions.leaderboard.js (podium top 3, catégories en onglets,
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

const LB2_CATS = {
  silver:   { icon:'💰', label:{fr:'Silver',en:'Silver'}, tip:{fr:'Silver total gagné à vie (S.silverEarned).',en:'Lifetime total silver earned.'},
    val:r=>Number(r.silver||0), fmt:r=>fmt(r.silver||0) },
  gs:       { icon:'⚔️', label:{fr:'Gearscore',en:'Gearscore'}, tip:{fr:'Record de Gearscore (PA/PD affichés entre parenthèses).',en:'Gearscore record (AP/DP shown in parentheses).'},
    val:r=>Number(r.gearscore||0), fmt:r=>`${Math.round(r.gearscore||0)} (${(r.ap||0).toFixed(1)}/${(r.dp||0).toFixed(1)})` },
  zone:     { icon:'🗺️', label:{fr:'Meilleure zone',en:'Best zone'}, tip:{fr:'Zone la plus avancée jamais atteinte.',en:'Furthest zone ever reached.'},
    val:r=>Number(r.best_zone_index||0), fmt:r=>tr(r.best_zone_name||'—') },
  sh:       { icon:'⏱️', label:{fr:'Silver/heure',en:'Silver/hour'}, tip:{fr:'Meilleur taux de farm (silver/heure) jamais atteint, avec la zone associée.',en:'Best farming rate (silver/hour) ever reached, with the associated zone.'},
    val:r=>Number(r.silver_per_hour||0), fmt:r=>`${fmt(r.silver_per_hour||0)}/h · ${tr(r.best_zone_name||'—')}` },
  kpm:      { icon:'🏹', label:{fr:'Kills/min',en:'Kills/min'}, tip:{fr:'Record de kills par minute, avec la zone associée.',en:'Kills-per-minute record, with the associated zone.'},
    val:r=>Number(r.best_kpm||0), fmt:r=>`${(r.best_kpm||0).toFixed(1)}/min · ${tr(r.best_zone_name||'—')}` },
  item:     { icon:'🎯', label:{fr:'Meilleur objet',en:'Best item'}, tip:{fr:'Objet le plus accumulé (quantité totale ramassée à vie).',en:'Most stockpiled item (total lifetime quantity picked up).'},
    val:r=>Number(r.best_item_count||0), fmt:r=>`${tr(r.best_item_name||'—')} (${fmt(r.best_item_count||0)})`, filter:r=>!!r.best_item_name },
  treasure: { icon:'🗺️', label:{fr:'Trésors',en:'Treasures'}, tip:{fr:'Morceaux du Trésor de Velia ramassés à vie.',en:'Lifetime Velia Treasure pieces picked up.'},
    val:r=>Number(r.treasure_count||0), fmt:r=>fmt(r.treasure_count||0) },
};
const LB2_PAGE_SIZE = 15;
let lb2Rows = null;
let lb2Cat = 'silver';
let lb2Search = '';
let lb2ShowMeOnly = false;
let lb2Page = 1;
let lb2Error = null;

function lb2Medal(rank) { return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':''; }
function lb2Sorted(cat) {
  const info = LB2_CATS[cat];
  const rows = info.filter ? lb2Rows.filter(info.filter) : lb2Rows;
  return [...rows].sort((a,b) => info.val(b) - info.val(a));
}

async function openLeaderboard2() {
  if (!marketRequireAuth()) return;
  lb2Error = null;
  openInfo(LANG==='fr' ? '🏆 Classement' : '🏆 Leaderboard', lb2ShellHtml());
  lb2WireShell();
  const { data, error } = await sb.from('player_stats').select('*').limit(500);
  if (error) { lb2Error = error.message; lb2RenderBody(); return; }
  lb2Rows = data || [];
  lb2RenderBody();
}

function lb2ShellHtml() {
  return `<div id="lb2Podium"></div>
    <div id="lb2Controls"></div>
    <div id="lb2Body"><div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div></div>`;
}
function lb2WireShell() {} // rien à câbler avant que les données arrivent (voir lb2RenderBody)

function lb2ControlsHtml() {
  const tabs = Object.entries(LB2_CATS).map(([k,c]) =>
    `<button class="catTab${k===lb2Cat?' active':''}" data-lb2cat="${k}" title="${escapeHtml(c.tip[LANG])}">${c.icon} ${c.label[LANG]}</button>`).join('');
  return `<div class="catTabs">${tabs}</div>
    <div class="lb2ToolRow">
      <input type="text" id="lb2Search" class="lb2SearchBox" placeholder="${LANG==='fr'?'Rechercher un joueur…':'Search a player…'}" value="${escapeHtml(lb2Search)}">
      <button class="lb2MeToggle${lb2ShowMeOnly?' on':''}" id="lb2MeToggle">📍 ${LANG==='fr'?'Ma position':'My position'}</button>
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
  if (!lb2Rows) { bodyEl.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`; return; }

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
    bodyEl.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Aucun joueur ne correspond à cette recherche.':'No player matches this search.'}</div>`;
    return;
  }
  if (lb2ShowMeOnly) {
    const myRank = rankMap.get(currentUser?.id);
    if (!myRank) {
      bodyEl.innerHTML = `<div class="admEmpty">${LANG==='fr'?"Pas encore de record synchronisé pour cette catégorie.":"No synced record yet for this category."}</div>`;
      return;
    }
    const idx = myRank - 1;
    bodyEl.innerHTML = lb2TableHtml(fullSorted.slice(Math.max(0, idx-3), idx+4), rankMap) +
      `<div class="admSummary" style="text-align:center">${LANG==='fr'?'Voisinage de ton rang':'Neighborhood of your rank'} (#${myRank})</div>`;
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
  const info = LB2_CATS[lb2Cat];
  const order = [1,0,2]; // 2e/1er/3e, ordre visuel classique (voir .bossPodium)
  return `<div class="bossPodium">${order.map(i => {
    const r = top3[i]; if (!r) return '';
    const rank = i+1;
    const isYou = r.user_id === currentUser?.id;
    return `<div class="bossPodiumStep rank${rank}${isYou?' lb2You':''}">
      <div class="bossPodiumMedal">${lb2Medal(rank)}</div>
      <div class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}" style="font-size:11px;color:var(--ink);cursor:pointer">${escapeHtml(r.display_name||'?')}${isYou?` (${LANG==='fr'?'toi':'you'})`:''}</div>
      <div class="bossPodiumReward" style="color:var(--gold)">${escapeHtml(info.fmt(r))}</div>
    </div>`;
  }).join('')}</div>`;
}

function lb2TableHtml(rows, rankMap) {
  const info = LB2_CATS[lb2Cat];
  return `<table class="admTable"><thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${info.label[LANG]}</th></tr></thead>
    <tbody>${rows.map(r => {
      const rank = rankMap.get(r.user_id);
      const isYou = r.user_id === currentUser?.id;
      return `<tr class="admPlayerRow${isYou?' isYou':''}${rank<=3?' admTop':''}">
        <td>${lb2Medal(rank)||('#'+rank)}</td>
        <td><span class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}">${escapeHtml(r.display_name||'?')}${isYou?` (${LANG==='fr'?'toi':'you'})`:''}</span></td>
        <td>${info.fmt(r)}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}
function lb2PagerHtml(totalPages) {
  if (totalPages<=1) return '';
  return `<div class="lb2Pager">
    <button class="lb2PagerBtn" id="lb2Prev" ${lb2Page<=1?'disabled':''}>‹ ${LANG==='fr'?'Précédent':'Previous'}</button>
    <span class="lb2PagerNum">${LANG==='fr'?'Page':'Page'} ${lb2Page} / ${totalPages}</span>
    <button class="lb2PagerBtn" id="lb2Next" ${lb2Page>=totalPages?'disabled':''}>${LANG==='fr'?'Suivant':'Next'} ›</button>
  </div>`;
}
function lb2WirePager(totalPages) {
  const prev = $a('lb2Prev'), next = $a('lb2Next');
  if (prev) prev.onclick = () => { lb2Page--; lb2RenderBody(); };
  if (next) next.onclick = () => { lb2Page++; lb2RenderBody(); };
}
