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
// Agrégats GS pour le Classement Public (2026-07-21, catégorie "Prestige"/"Gearscore" du mockup
// classement-public.html — voir migration 20260721100000_companion_leaderboard_prestige.sql).
// gsSumWithTier reproduit EXACTEMENT le terme par-pet de prestigeScore() (companions.achievements.js:
// `score += normGS(p); score += (p.tier||1)*20;`) pour que le prestige_score calculé côté serveur
// corresponde au vrai prestigeScore() affiché localement au joueur. Fonction pure, testable isolément.
function computeCompanionGsAggregates() {
  let gsSumWithTier = 0, gsMax = 0;
  (Array.isArray(PETS) ? PETS : []).forEach(p => {
    const gs = normGS(p);
    gsSumWithTier += gs + (p.tier || 1) * 20;
    if (gs > gsMax) gsMax = gs;
  });
  return { gsSumWithTier, gsMax };
}

async function syncCompanionStatsToServer() {
  try {
    const hostWin = window.parent;
    if (!hostWin || hostWin === window) return; // ouvert hors iframe (ex: fichier local direct) -- no-op
    // bug corrigé #1 (2026-07-20) : `hostWin.sb`/`hostWin.currentUser` étaient TOUJOURS undefined
    // (déclarations `let` top-level, jamais attachées à `window` -- voir getSbClient()/
    // getCurrentUserForSync() dans game-supabase.js pour le détail). Passer par ces accesseurs
    // `function` (eux bien attachés à `window`) au lieu de lire les variables directement.
    const sb = typeof hostWin.getSbClient === 'function' ? hostWin.getSbClient() : null;
    const currentUser = typeof hostWin.getCurrentUserForSync === 'function' ? hostWin.getCurrentUserForSync() : null;
    const isGuestFn = hostWin.isGuest;
    if (!sb || !currentUser || (typeof isGuestFn === 'function' && isGuestFn())) return;
    const breakdowns = computeCompanionBreakdowns();
    let hardAchCount = 0;
    if (completedAchievements && typeof ACHIEVEMENTS !== 'undefined') {
      ACHIEVEMENTS.forEach(a => { if (a.hard && completedAchievements.has(a.id)) hardAchCount++; });
    }
    // complétion Index (2026-07-20, demande explicite : "Completion 48pet * 5 tier pour l'index et
    // classement") -- comptait initialement l'ESPÈCE seule (48 max, indifférent au palier) ;
    // compte désormais chaque combo ESPÈCE×TIER distinct (48×5=240 max, voir
    // companionIndexProgress()/COMPANION_INDEX_MAX, companions.catalog.js). Colonne serveur
    // inchangée (unique_species_count, migration 20260720130000_companion_stats_egg_and_index.sql)
    // -- seule la sémantique du nombre envoyé change, pas le schéma. Les valeurs déjà en base sous
    // l'ancien calcul (max 48) se corrigent d'elles-mêmes au prochain sync de chaque joueur.
    const uniqueSpeciesCount = companionIndexProgress(Array.isArray(PETS) ? PETS : []);
    const { gsSumWithTier, gsMax } = computeCompanionGsAggregates();
    // bug corrigé #2 (2026-07-20) : le builder Postgrest renvoyé par sb.rpc(...) n'implémente QUE
    // `.then()` (thenable), pas `.catch()` -- l'ancien `.catch(()=>{})` levait silencieusement
    // "TypeError: ...catch is not a function", avalée par le try/catch englobant, AVANT même que
    // la requête HTTP ne parte (le thenable ne s'exécute qu'au premier `.then()`/`await`). Combiné
    // au bug #1 ci-dessus, ces deux bugs empêchaient TOUTE synchronisation depuis la création de ce
    // fichier, pour tous les comptes (invité ou non) -- confirmé en observant zéro requête réseau
    // sortante malgré des appels répétés. `await` déclenche correctement l'exécution réelle.
    await sb.rpc('sync_companion_stats', {
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
      p_unique_species_count: uniqueSpeciesCount,
      p_gs_sum_with_tier: gsSumWithTier,
      p_gs_max: gsMax,
    });
  } catch(e) {}
}
// throttlé à 60s (pas à chaque autosave de 5s, voir companions.save.js) : ce sont des compteurs
// admin, pas une sauvegarde temps réel -- inutile de spammer la RPC. 1er envoi après 5s (laisse
// loadGame() terminer), pour qu'un joueur qui ouvre puis referme vite le module soit quand même compté.
setTimeout(syncCompanionStatsToServer, 5000);
setInterval(syncCompanionStatsToServer, 60000);
