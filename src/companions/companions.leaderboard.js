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
  prestige: { label:'Score Prestige', tip:'Achievements ×250 + GS cumulé (+20/tier par familier) + fusions ×15 + Caphras ×10 + percées ×100 + argent dépensé /100 — exactement le Score Prestige affiché dans l\'onglet Succès.' },
  gs:       { label:'Gearscore Max',  tip:'Le Gearscore le plus élevé (normGS, échelle sur 1000) parmi tous les familiers actuellement possédés.' },
  fusion:   { label:'Fusions',        tip:'Nombre total de fusions de familiers réalisées depuis la création du compte.' },
  ach:      { label:'Achievements',   tip:'Nombre d\'achievements débloqués sur le total disponible.' },
};
const LB_PAGE_SIZE = 15;
let lbRows = null; // cache de la réponse RPC (rafraîchie à chaque ouverture de l'onglet, pas à chaque interaction)
let lbCategory = 'prestige';
let lbSearch = '';
let lbShowMeOnly = false;
let lbPage = 1;
let lbMyUserId = null;
let lbError = null;

function renderMyStatsAndLeaderboard(){
  renderMyStatsGrid();
  fetchAndRenderCompanionLeaderboard();
}

function renderMyStatsGrid(){
  const el = document.getElementById('my-stats-grid');
  if(!el) return;
  const indexProgress = companionIndexProgress(PETS);
  const tiles = [
    { ico:'🥚', lbl:'Œufs ouverts', val: fmtN(totalHatched||0) },
    { ico:'💰', lbl:'Argent dépensé', val: fmtN(silverSpent||0) },
    { ico:'🔗', lbl:'Fusions', val: fmtN(fusionCount||0) },
    { ico:'🌟', lbl:'Percées', val: fmtN(breakthroughCount||0) },
    // 2026-07-20, "Completion 48pet * 5 tier" -- espèce×tier distincts possédés / 240 (voir
    // companionIndexProgress()/COMPANION_INDEX_MAX, catalog.js)
    { ico:'📖', lbl:'Complétion Index', val: `${indexProgress}/${COMPANION_INDEX_MAX}` },
    { ico:'🏆', lbl:'Succès', val: `${completedAchievements.size}/${ACHIEVEMENTS.length}` },
    { ico:'👑', lbl:'Score Prestige', val: fmtN(typeof prestigeScore==='function' ? prestigeScore() : 0) },
  ];
  el.innerHTML = tiles.map(t=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:9px 12px">
      <div style="font-size:10px;color:var(--cream2)">${t.ico} ${t.lbl}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:var(--gold)">${t.val}</div>
    </div>`).join('');
}
function fmtN(n){ return n.toLocaleString('fr-FR'); }
function lbScoreOf(row, cat){ return cat==='prestige' ? Number(row.prestige_score||0) : cat==='gs' ? (row.gs_max||0) : cat==='fusion' ? (row.fusion_count||0) : (row.achievements_count||0); }
function lbSorted(cat){ return [...(lbRows||[])].sort((a,b)=>lbScoreOf(b,cat)-lbScoreOf(a,cat)); }
function lbMedal(rank){ return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':''; }

async function fetchAndRenderCompanionLeaderboard(){
  const el = document.getElementById('companion-leaderboard');
  if(!el) return;
  lbError = null;
  el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">Chargement…</div>`;
  document.getElementById('lb-podium') && (document.getElementById('lb-podium').innerHTML = '');
  try{
    const hostWin = window.parent;
    if(!hostWin || hostWin===window){ lbError = "Indisponible hors du jeu."; renderLeaderboardUi(); return; }
    const sb = typeof hostWin.getSbClient==='function' ? hostWin.getSbClient() : null;
    const currentUser = typeof hostWin.getCurrentUserForSync==='function' ? hostWin.getCurrentUserForSync() : null;
    const isGuestFn = hostWin.isGuest;
    if(!sb || !currentUser){ lbError = "Connecte-toi pour voir le classement."; renderLeaderboardUi(); return; }
    if(typeof isGuestFn==='function' && isGuestFn()){ lbError = "Le classement n'est pas disponible en compte invité."; renderLeaderboardUi(); return; }
    lbMyUserId = currentUser.id;
    const { data, error } = await sb.rpc('companion_leaderboard');
    if(error){ lbError = `Erreur : ${escapeHtmlLb(error.message)}`; renderLeaderboardUi(); return; }
    lbRows = data || [];
    renderLeaderboardUi();
  }catch(e){
    lbError = "Classement indisponible pour l'instant.";
    renderLeaderboardUi();
  }
}

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
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">Personne n'est encore synchronisé — ouvre ce module au moins une fois (synchro toutes les 60s) pour apparaître ici.</div>`;
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
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">Aucun joueur ne correspond à cette recherche.</div>`;
    return;
  }
  if(lbShowMeOnly){
    const myRank = rankMap.get(lbMyUserId);
    if(!myRank){
      el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:12px">Synchronise-toi d'abord (ouvre ce module, attends jusqu'à 60s) pour voir ta position.</div>`;
      return;
    }
    const idx = myRank - 1;
    const windowSlice = fullSorted.slice(Math.max(0, idx-3), idx+4);
    el.innerHTML = lbRowsHtml(windowSlice, rankMap) + `<div style="font-size:10px;color:var(--cream3);text-align:center;padding:8px 0">Voisinage de ton rang (#${myRank})</div>`;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / LB_PAGE_SIZE));
  if(lbPage > totalPages) lbPage = totalPages;
  const start = (lbPage-1)*LB_PAGE_SIZE;
  el.innerHTML = lbRowsHtml(list.slice(start, start+LB_PAGE_SIZE), rankMap) + lbPagerHtml(totalPages);
  lbWirePager(totalPages);
}

function lbControlsHtml(){
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
    <input class="search-box" id="lb-search" placeholder="Rechercher un joueur…" value="${escapeHtmlLb(lbSearch)}" style="width:180px">
    <div style="display:flex;gap:6px">
      ${Object.entries(LB_CATS).map(([k,c])=>`<button class="chip ${k===lbCategory?'on':''}" data-lbcat="${k}">${escapeHtmlLb(c.label)}</button>`).join('')}
    </div>
    <button class="schip ${lbShowMeOnly?'on':''}" id="lb-me-toggle" style="margin-left:auto">📍 Ma position</button>
  </div>`;
}
function lbWireControls(){
  const search = document.getElementById('lb-search');
  if(search) search.oninput = e => { lbSearch = e.target.value; lbPage = 1; renderLeaderboardUi(); };
  document.querySelectorAll('[data-lbcat]').forEach(btn=>{
    btn.onclick = () => { lbCategory = btn.dataset.lbcat; lbPage = 1; renderLeaderboardUi(); };
  });
  const meToggle = document.getElementById('lb-me-toggle');
  if(meToggle) meToggle.onclick = () => { lbShowMeOnly = !lbShowMeOnly; renderLeaderboardUi(); };
}

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
        <div style="font-size:11px;color:var(--cream);margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtmlLb(r.display_name||'?')}${isMe?' <span style="color:var(--gold2)">(toi)</span>':''}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--gold2)">${fmtN(lbScoreOf(r,lbCategory))}</div>
      </div>`;
    }).join('')}
  </div>
  <div style="font-size:9px;color:var(--cream3);margin:-8px 0 12px;display:flex;align-items:center;gap:4px" title="${escapeHtmlLb(cat.tip)}">ⓘ ${escapeHtmlLb(cat.label)} — survole pour le détail du calcul</div>`;
}

function lbRowsHtml(rows, rankMap){
  const cat = LB_CATS[lbCategory];
  return `<table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr>
      <th style="text-align:left;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">#</th>
      <th style="text-align:left;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">Joueur</th>
      <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">${escapeHtmlLb(cat.label)}</th>
      <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">📦 Familiers</th>
      <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">📖 Index</th>
    </tr></thead>
    <tbody>${rows.map(r=>{
      const rank = rankMap.get(r.user_id);
      const isYou = r.user_id === lbMyUserId;
      return `<tr style="${isYou?'background:rgba(212,169,85,.1)':''}">
        <td style="padding:5px 8px;border-bottom:1px solid var(--border);color:${rank<=3?'var(--gold)':'var(--cream2)'}">${lbMedal(rank)||('#'+rank)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid var(--border);color:${isYou?'var(--gold)':'var(--cream)'}">${escapeHtmlLb(r.display_name||'?')}${isYou?' (toi)':''}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--gold2);font-family:'JetBrains Mono',monospace">${fmtN(lbScoreOf(r,lbCategory))}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${fmtN(r.pet_count||0)}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${r.unique_species_count||0}/${COMPANION_INDEX_MAX}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}
function lbPagerHtml(totalPages){
  if(totalPages<=1) return '';
  return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 0">
    <button class="schip" id="lb-prev" ${lbPage<=1?'disabled':''}>‹ Précédent</button>
    <span style="font-size:10px;color:var(--cream3)">Page ${lbPage} / ${totalPages}</span>
    <button class="schip" id="lb-next" ${lbPage>=totalPages?'disabled':''}>Suivant ›</button>
  </div>`;
}
function lbWirePager(totalPages){
  const prev = document.getElementById('lb-prev'), next = document.getElementById('lb-next');
  if(prev) prev.onclick = () => { lbPage--; renderLeaderboardUi(); };
  if(next) next.onclick = () => { lbPage++; renderLeaderboardUi(); };
}
function escapeHtmlLb(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
