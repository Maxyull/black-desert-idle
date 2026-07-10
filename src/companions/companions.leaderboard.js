// ═══ TES STATS + CLASSEMENT CROSS-JOUEURS (2026-07-20, demande explicite : "ajouter classement,
// oeuf ouvert, argent depensé...") ═══════════════════════════════════════════════════════════════
// "Tes stats" reste 100% local (aucun appel réseau) -- juste une lecture groupée de compteurs déjà
// suivis ailleurs (totalHatched, silverSpent, fusionCount...). Le classement, lui, appelle la RPC
// publique companion_leaderboard() (voir supabase/migrations/20260720140000_companion_leaderboard.sql)
// via le même pattern cross-window que companions.sync.js (getSbClient()/getCurrentUserForSync()/
// isGuest() sur window.parent -- jamais de 2e SDK Supabase dans l'iframe).

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
    // companionIndexProgress()/COMPANION_INDEX_MAX, companions.catalog.js)
    { ico:'📖', lbl:'Complétion Index', val: `${indexProgress}/${COMPANION_INDEX_MAX}` },
    { ico:'🏆', lbl:'Succès', val: `${completedAchievements.size}/${ACHIEVEMENTS.length}` },
  ];
  el.innerHTML = tiles.map(t=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:9px 12px">
      <div style="font-size:10px;color:var(--cream2)">${t.ico} ${t.lbl}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:var(--gold)">${t.val}</div>
    </div>`).join('');
}
function fmtN(n){ return n.toLocaleString('fr-FR'); }

async function fetchAndRenderCompanionLeaderboard(){
  const el = document.getElementById('companion-leaderboard');
  if(!el) return;
  el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Chargement…</div>`;
  try{
    const hostWin = window.parent;
    if(!hostWin || hostWin===window){ el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Indisponible hors du jeu.</div>`; return; }
    const sb = typeof hostWin.getSbClient==='function' ? hostWin.getSbClient() : null;
    const currentUser = typeof hostWin.getCurrentUserForSync==='function' ? hostWin.getCurrentUserForSync() : null;
    const isGuestFn = hostWin.isGuest;
    if(!sb || !currentUser){ el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Connecte-toi pour voir le classement.</div>`; return; }
    if(typeof isGuestFn==='function' && isGuestFn()){ el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Le classement n'est pas disponible en compte invité.</div>`; return; }
    const { data, error } = await sb.rpc('companion_leaderboard');
    if(error){ el.innerHTML = `<div style="font-size:11px;color:var(--red2)">Erreur : ${escapeHtmlLb(error.message)}</div>`; return; }
    const rows = data || [];
    if(!rows.length){ el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Personne n'est encore synchronisé.</div>`; return; }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>
        <th style="text-align:left;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">#</th>
        <th style="text-align:left;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">Joueur</th>
        <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">📦 Familiers</th>
        <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">🔗 Fusions</th>
        <th style="text-align:right;padding:5px 8px;color:var(--cream3);border-bottom:1px solid var(--border)">📖 Index</th>
      </tr></thead>
      <tbody>${rows.map((r,i)=>{
        const isYou = currentUser && r.user_id===currentUser.id;
        return `<tr style="${isYou?'background:rgba(200,169,110,.1)':''}">
          <td style="padding:5px 8px;border-bottom:1px solid var(--border);color:${i<3?'var(--gold)':'var(--cream2)'}">#${i+1}</td>
          <td style="padding:5px 8px;border-bottom:1px solid var(--border);color:${isYou?'var(--gold)':'var(--cream)'}">${escapeHtmlLb(r.display_name||'?')}${isYou?' (toi)':''}</td>
          <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${fmtN(r.pet_count||0)}</td>
          <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${fmtN(r.fusion_count||0)}</td>
          <td style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--border)">${r.unique_species_count||0}/${COMPANION_INDEX_MAX}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }catch(e){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Classement indisponible pour l'instant.</div>`;
  }
}
function escapeHtmlLb(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
