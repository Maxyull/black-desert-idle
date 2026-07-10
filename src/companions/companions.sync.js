// ═══ SYNC ADMIN (2026-07-19, demande explicite : "branche des stats sur toutes les nouvelle
// fonctionnalité de compagnons dans menu admin") ═══════════════════════════════════════════
// Ce module est 100% local (localStorage, voir companions.save.js) : rien n'en sortait jusqu'ici,
// donc aucune stat cross-joueurs n'était possible côté admin. Ce fichier pousse un petit résumé
// de compteurs (jamais l'état complet du roster/inventaire) vers Supabase, en réutilisant EXACTEMENT
// le client déjà authentifié de la page hôte (iframe SAME-ORIGIN, voir combat/boss.js:
// openCompanionsModule -- pas de sandbox, window.parent est directement accessible en JS) :
// pas de duplication du SDK Supabase ni d'auth séparée dans l'iframe.
// répartitions par rareté/tier/section (2026-07-20, demande explicite : "pet par tier, rareté,
// catégorie, et tout ce qui se genere dans compagnon") -- objets simples {clé:compte}, jamais le
// détail nominatif de chaque pet (économie fermée, voir README.md) -- sérialisés en JSONB côté
// serveur (voir supabase/migrations/20260720100000_companion_stats_breakdowns.sql). Fonction pure,
// testable isolément sans dépendre de window.parent.
function computeCompanionBreakdowns() {
  const rarity = {}, tier = {}, section = {};
  (Array.isArray(PETS) ? PETS : []).forEach(p => {
    rarity[p.rar] = (rarity[p.rar] || 0) + 1;
    const t = p.tier || 1;
    tier[t] = (tier[t] || 0) + 1;
    const sec = p.cat && p.cat.sec;
    if (sec) section[sec] = (section[sec] || 0) + 1;
  });
  return { rarity, tier, section };
}

function syncCompanionStatsToServer() {
  try {
    const hostWin = window.parent;
    if (!hostWin || hostWin === window) return; // ouvert hors iframe (ex: fichier local direct) -- no-op
    const sb = hostWin.sb, currentUser = hostWin.currentUser;
    const isGuestFn = hostWin.isGuest;
    if (!sb || !currentUser || (typeof isGuestFn === 'function' && isGuestFn())) return;
    const breakdowns = computeCompanionBreakdowns();
    let hardAchCount = 0;
    if (completedAchievements && typeof ACHIEVEMENTS !== 'undefined') {
      ACHIEVEMENTS.forEach(a => { if (a.hard && completedAchievements.has(a.id)) hardAchCount++; });
    }
    sb.rpc('sync_companion_stats', {
      p_pet_count: Array.isArray(PETS) ? PETS.length : 0,
      p_silver: SILVER || 0,
      p_hatch_count: totalHatched || 0,
      p_fusion_count: fusionCount || 0,
      p_caphras_upgrade_count: caphrasUpgradeCount || 0,
      p_breakthrough_count: breakthroughCount || 0,
      p_achievements_count: completedAchievements ? completedAchievements.size : 0,
      p_login_streak: loginStreak || 0,
      p_pity_triggered: !!pityEverTriggered,
      p_rarity_breakdown: breakdowns.rarity,
      p_tier_breakdown: breakdowns.tier,
      p_section_breakdown: breakdowns.section,
      p_hard_achievements_count: hardAchCount,
      p_fusion_downgrade_count: fusionLostHighRarityCount || 0,
    }).catch(()=>{});
  } catch(e) {}
}
// throttlé à 60s (pas à chaque autosave de 5s, voir companions.save.js) : ce sont des compteurs
// admin, pas une sauvegarde temps réel -- inutile de spammer la RPC. 1er envoi après 5s (laisse
// loadGame() terminer), pour qu'un joueur qui ouvre puis referme vite le module soit quand même compté.
setTimeout(syncCompanionStatsToServer, 5000);
setInterval(syncCompanionStatsToServer, 60000);
